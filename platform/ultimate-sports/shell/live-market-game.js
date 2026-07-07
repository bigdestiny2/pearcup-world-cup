// PearCup Live Market Game — plain-reveal P2P mini-games for watch-party markets.
//
// Supports: next-event, scoreline-lock, watch-party-streak.
// Two peers join the same room topic, submit picks, and resolve them deterministically
// from a shared seed (derived from peer ids and hello nonces). No hidden-choice
// commit/reveal is needed because the outcome is independent of pick order.
//
// Public API: LiveMarketGame.host(code, opts), LiveMarketGame.join(code),
// LiveMarketGame.pick(value), LiveMarketGame.leave(silent),
// LiveMarketGame.onState(fn) / offState(fn).
(function attachLiveMarketGame (root) {
  'use strict'

  const Net = root.PearCupPeerNet
  if (!Net) {
    if (root.console && root.console.warn) root.console.warn('PearCupPeerNet missing — LiveMarketGame disabled')
    return
  }

  const DEFAULT_ROUNDS = { 'watch-party-streak': 5, 'next-event': 1, 'scoreline-lock': 1 }
  const CHALLENGE_TTL_MS = 60000

  const state = {
    active: false,
    started: false,
    over: false,
    channel: null,
    code: null,
    self: null,
    opp: null,
    role: null,
    helloTimer: null,
    helloAttempts: 0,
    helloNonce: null,
    remoteHelloNonce: null,
    challenges: new Map(),
    gameType: 'next-event',
    options: [],
    rounds: 1,
    schedule: [],
    currentRound: 0,
    scores: { you: 0, opp: 0 },
    localPicks: {},
    remotePicks: {},
    resolved: new Set(),
    listeners: new Set()
  }

  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.liveMarketGameModule = status
    }
  }

  function syncDiagnostics (stateName) {
    const ds = root.document && root.document.documentElement && root.document.documentElement.dataset
    if (!ds) return
    ds.liveMarketGameState = stateName || (state.over ? 'over' : state.started ? 'started' : state.active ? 'joining' : 'idle')
    ds.liveMarketGameActive = String(Boolean(state.active))
    if (state.code) ds.liveMarketGameCode = state.code
    else delete ds.liveMarketGameCode
    if (state.role) ds.liveMarketGameRole = state.role
    else delete ds.liveMarketGameRole
    if (state.gameType) ds.liveMarketGameType = state.gameType
    else delete ds.liveMarketGameType
    if (state.opp && state.opp.name) ds.liveMarketGameOpponent = state.opp.name
    else delete ds.liveMarketGameOpponent
  }

  function getSnapshot () {
    const currentRound = state.schedule[state.currentRound] || null
    return {
      active: state.active,
      started: state.started,
      over: state.over,
      code: state.code,
      role: state.role,
      gameType: state.gameType,
      round: state.currentRound + 1,
      totalRounds: state.schedule.length,
      scores: { ...state.scores },
      schedule: state.schedule.slice(),
      currentRound: currentRound ? { ...currentRound } : null,
      localPicks: { ...state.localPicks },
      remotePicks: { ...state.remotePicks },
      resolved: Array.from(state.resolved),
      statusText: state.over
        ? 'Game over'
        : state.started
          ? `Round ${state.currentRound + 1} of ${state.schedule.length}`
          : state.active
            ? 'Waiting for opponent'
            : 'Idle'
    }
  }

  function emitState () {
    const snapshot = getSnapshot()
    state.listeners.forEach(fn => {
      try { fn(snapshot) } catch (e) { /* listener error */ }
    })
  }

  function reset () {
    stopAnnouncing()
    if (state.channel) {
      try { state.channel.close() } catch (e) {}
    }
    Object.assign(state, {
      active: false,
      started: false,
      over: false,
      channel: null,
      code: null,
      self: null,
      opp: null,
      role: null,
      helloTimer: null,
      helloAttempts: 0,
      helloNonce: null,
      remoteHelloNonce: null,
      challenges: new Map(),
      gameType: 'next-event',
      options: [],
      rounds: 1,
      schedule: [],
      currentRound: 0,
      scores: { you: 0, opp: 0 },
      localPicks: {},
      remotePicks: {},
      resolved: new Set()
    })
    syncDiagnostics('idle')
  }

  // ---- lifecycle ----

  function host (code, opts) {
    reset()
    state.active = true
    state.code = code || Net.newRoomCode()
    applyOpts(opts || {})
    state.self = {
      peerId: Net.newPeerId(),
      name: (opts && opts.name) || (root.state && root.state.username) || 'Player'
    }
    state.helloNonce = Net.newNonce()
    openChannel()
    syncDiagnostics('hosting')
    startAnnouncing()
    emitState()
    return state.code
  }

  function join (code, opts) {
    reset()
    state.active = true
    state.code = code
    applyOpts(opts || {})
    state.self = {
      peerId: Net.newPeerId(),
      name: (root.state && root.state.username) || 'Player'
    }
    state.helloNonce = Net.newNonce()
    openChannel()
    syncDiagnostics('joining')
    startAnnouncing()
    emitState()
  }

  function applyOpts (opts) {
    const gt = opts.gameType || 'next-event'
    state.gameType = gt
    state.rounds = opts.rounds || DEFAULT_ROUNDS[gt] || 1
    state.options = (opts.options && opts.options.length) ? opts.options.slice() : defaultOptions(gt)
  }

  function defaultOptions (gameType) {
    const ctx = root.ULTIMATE_FIT_CONFIG || {}
    if (gameType === 'next-event') return ctx.eventOptions || ['goal', 'corner', 'card', 'save']
    if (gameType === 'scoreline-lock') return ctx.scorelineLabel ? [ctx.scorelineLabel] : ['final score']
    if (gameType === 'watch-party-streak') return ['yes', 'no']
    return []
  }

  function leave (silent) {
    if (!silent && state.channel) send({ t: 'leave' })
    reset()
    emitState()
  }

  function openChannel () {
    state.channel = Net.createChannel(Net.GAME_TOPIC(state.code))
    state.channel.onMessage(onMessage)
  }

  function roomCredential () {
    const RA = root.PearCupRoomAccess
    return RA && typeof RA.myCredential === 'function' ? RA.myCredential() : null
  }

  function announce (cred) {
    send({
      t: 'hello',
      peer: state.self,
      cred: cred || roomCredential(),
      helloNonce: state.helloNonce,
      gameType: state.gameType,
      options: state.options,
      rounds: state.rounds
    })
  }

  function send (msg) {
    if (state.channel) {
      state.channel.send({ ...msg, room: state.code, sender: state.self.peerId })
    }
  }

  function challengeNonce () {
    return Net && typeof Net.newNonce === 'function' ? Net.newNonce() : `${Date.now()}-${Math.random()}`
  }

  function isChallengeExpired (entry) {
    return !entry || (Date.now() - (entry.at || 0)) > CHALLENGE_TTL_MS
  }

  function sendChallenge (toPeerId) {
    if (!state.active || state.started || state.opp) return
    const existing = state.challenges.get(toPeerId)
    if (existing && !isChallengeExpired(existing)) return
    const nonce = challengeNonce()
    state.challenges.set(toPeerId, { nonce, at: Date.now() })
    send({ t: 'challenge', nonce, to: toPeerId })
  }

  async function onChallenge (msg) {
    if (!state.active || state.started || state.opp) return
    const RA = root.PearCupRoomAccess
    if (!RA || typeof RA.signChallenge !== 'function') return
    const proof = await RA.signChallenge(msg.nonce)
    if (!proof) return
    const base = roomCredential() || { key: null }
    announce({ key: base.key, cap: base.cap, proof, nonce: msg.nonce })
  }

  function startAnnouncing () {
    stopAnnouncing()
    state.helloAttempts = 0
    announce()
    if (typeof root.setInterval !== 'function') return
    state.helloTimer = root.setInterval(() => {
      if (!state.active || state.started) {
        stopAnnouncing()
        return
      }
      state.helloAttempts += 1
      announce()
      if (state.helloAttempts >= 40) stopAnnouncing()
    }, 500)
  }

  function stopAnnouncing () {
    if (!state.helloTimer) return
    if (typeof root.clearInterval === 'function') root.clearInterval(state.helloTimer)
    state.helloTimer = null
  }

  // ---- message handling ----

  function onMessage (msg) {
    if (!msg || msg.room !== state.code || msg.sender === state.self.peerId) return
    switch (msg.t) {
      case 'hello': return onHello(msg.peer, msg.cred, msg.helloNonce, msg.gameType, msg.options, msg.rounds)
      case 'challenge': return onChallenge(msg)
      case 'pick': return onPick(msg)
      case 'leave': return onOppLeft()
    }
  }

  async function onHello (peer, cred, helloNonce, gameType, options, rounds) {
    if (state.started || !peer || state.opp) return
    const RA = root.PearCupRoomAccess

    // Adopt settings from the host's hello if we haven't locked our own.
    if (gameType && state.gameType === 'next-event') state.gameType = gameType
    if (options && options.length && !state.options.length) state.options = options.slice()
    if (rounds && state.rounds === 1) state.rounds = rounds

    // Public rooms admit everyone.
    if (!RA || !RA.enforced) {
      state.remoteHelloNonce = helloNonce
      admitOpponent(peer)
      return
    }

    // Enforced rooms require valid structural authorization (owner or signed invite).
    let authorized = false
    try { authorized = await RA.verify(cred) } catch (e) { authorized = false }
    if (!authorized) {
      if (!state.rejectedNote) {
        state.rejectedNote = true
        if (root.console && root.console.warn) root.console.warn('Blocked a peer without a valid room invite')
      }
      return
    }

    // Anti-replay: only accept a proof signed over the nonce WE issued.
    const stored = state.challenges.get(peer.peerId)
    if (stored && !isChallengeExpired(stored) && cred && cred.proof) {
      let respOk = false
      try { respOk = await RA.verifyProof(cred, stored.nonce) } catch (e) { respOk = false }
      if (respOk) {
        state.challenges.delete(peer.peerId)
        state.remoteHelloNonce = helloNonce
        admitOpponent(peer)
        return
      }
    }
    if (stored && isChallengeExpired(stored)) state.challenges.delete(peer.peerId)

    // Authorized but not yet proved — issue a fresh challenge.
    sendChallenge(peer.peerId)
  }

  function admitOpponent (peer) {
    if (state.started || !peer || state.opp) return
    state.opp = peer
    announce() // re-announce so a late joiner learns me
    syncDiagnostics('connected')
    maybeStart()
  }

  function maybeStart () {
    if (state.started || !state.opp) return
    state.started = true
    stopAnnouncing()
    state.role = state.self.peerId < state.opp.peerId ? 'A' : 'B'

    const seed = buildSeed(
      state.self.peerId,
      state.opp.peerId,
      state.helloNonce,
      state.remoteHelloNonce
    )
    state.schedule = buildSchedule(state.gameType, state.options, state.rounds, seed)
    state.currentRound = 0
    state.scores = { you: 0, opp: 0 }
    state.localPicks = {}
    state.remotePicks = {}
    state.resolved = new Set()

    syncDiagnostics('started')
    emitState()
  }

  function onOppLeft () {
    if (state.over) return
    leave(true)
  }

  // ---- deterministic scheduling ----

  function buildSeed (peerA, peerB, nonceA, nonceB) {
    const ids = [peerA, peerB].sort()
    const nonces = [nonceA || '', nonceB || ''].sort()
    return Net.digest(`live-market|${ids[0]}|${ids[1]}|${nonces[0]}|${nonces[1]}`)
  }

  function buildSchedule (gameType, options, rounds, seed) {
    const out = []
    for (let i = 0; i < rounds; i++) {
      const roundSeed = Net.digest(`${seed}|${gameType}|${i}`)
      let correct = null
      if (gameType === 'scoreline-lock') {
        const home = parseInt(roundSeed.slice(0, 4), 16) % 5
        const away = parseInt(roundSeed.slice(4, 8), 16) % 5
        correct = `${home}-${away}`
      } else if (gameType === 'watch-party-streak') {
        correct = (parseInt(roundSeed.slice(0, 4), 16) % 2 === 0) ? 'yes' : 'no'
      } else {
        // next-event and fallback
        const pool = options && options.length ? options : ['goal']
        correct = pool[parseInt(roundSeed.slice(0, 4), 16) % pool.length]
      }
      out.push({
        id: `r${i + 1}`,
        round: i,
        correct
      })
    }
    return out
  }

  function scorePick (gameType, pick, correct) {
    if (gameType === 'scoreline-lock') {
      if (pick === correct) return { points: 3, reason: 'exact' }
      const [home, away] = String(pick).split('-').map(n => parseInt(n, 10))
      const [cHome, cAway] = String(correct).split('-').map(n => parseInt(n, 10))
      const resultClass =
        (home > away ? 'home' : home < away ? 'away' : 'draw')
      const correctClass =
        (cHome > cAway ? 'home' : cHome < cAway ? 'away' : 'draw')
      if (resultClass === correctClass) return { points: 1, reason: 'result-class' }
      return { points: 0, reason: 'miss' }
    }
    if (pick === correct) return { points: 1, reason: 'correct' }
    return { points: 0, reason: 'miss' }
  }

  // ---- player input ----

  function pick (value) {
    if (!state.started || state.over || !state.opp) return false
    const roundId = state.schedule[state.currentRound] && state.schedule[state.currentRound].id
    if (!roundId) return false
    if (state.resolved.has(roundId)) return false
    if (state.localPicks[roundId] != null) return false

    state.localPicks[roundId] = value
    send({ t: 'pick', roundId, value })
    tryResolveRound()
    emitState()
    return true
  }

  function onPick (msg) {
    if (!state.started || state.over || !state.opp || msg.sender !== state.opp.peerId) return
    if (state.resolved.has(msg.roundId)) return
    if (state.remotePicks[msg.roundId] != null) return // ignore duplicate / replay
    state.remotePicks[msg.roundId] = msg.value
    tryResolveRound()
    emitState()
  }

  function tryResolveRound () {
    const round = state.schedule[state.currentRound]
    if (!round || state.resolved.has(round.id)) return
    const local = state.localPicks[round.id]
    const remote = state.remotePicks[round.id]
    if (local == null || remote == null) return

    state.resolved.add(round.id)
    const localResult = scorePick(state.gameType, local, round.correct)
    const remoteResult = scorePick(state.gameType, remote, round.correct)
    state.scores.you += localResult.points
    state.scores.opp += remoteResult.points

    const lastRound = state.currentRound + 1 >= state.schedule.length
    if (lastRound) {
      finishGame()
    } else {
      state.currentRound += 1
    }
    emitState()
  }

  function finishGame () {
    state.over = true
    syncDiagnostics('over')
    postReceipt()
    emitState()
  }

  function postReceipt () {
    if (typeof root.postSettlementReceipt !== 'function') return
    const winner = state.scores.you > state.scores.opp
      ? state.self.peerId
      : state.scores.opp > state.scores.you
        ? (state.opp ? state.opp.peerId : null)
        : null
    const receipt = {
      gameType: state.gameType,
      room: state.code,
      you: state.self.peerId,
      players: [state.self.peerId, state.opp ? state.opp.peerId : null].filter(Boolean),
      scores: {
        [state.self.peerId]: state.scores.you,
        [state.opp ? state.opp.peerId : 'opp']: state.scores.opp
      },
      winner,
      settledAt: new Date().toISOString()
    }
    try { root.postSettlementReceipt(receipt) } catch (e) {}
  }

  // ---- public subscription API ----

  function onState (fn) {
    if (typeof fn !== 'function') return () => {}
    state.listeners.add(fn)
    if (state.active) fn(getSnapshot())
    return () => { state.listeners.delete(fn) }
  }

  function offState (fn) {
    state.listeners.delete(fn)
  }

  const api = {
    host,
    join,
    leave,
    pick,
    onState,
    offState,
    _testHelpers: {
      buildSeed,
      buildSchedule,
      scorePick,
      getState: getSnapshot,
      simulateRemotePick: function (roundId, value) {
        if (!state.started || !state.opp) return false
        onMessage({ t: 'pick', room: state.code, sender: state.opp.peerId, roundId, value })
        return true
      }
    }
  }

  root.LiveMarketGame = api
  if (typeof module !== 'undefined' && module.exports) module.exports = api

  markModule('ready')
})(typeof globalThis !== 'undefined' ? globalThis : window)
