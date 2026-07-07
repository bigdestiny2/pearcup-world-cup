// PearCup Reaction Challenge — fastest-tap P2P mini-game.
//
// Two peers join the same room topic. A shared moment schedule is derived from a
// seed both players agree on, so neither can pre-compute the moments alone.
// When a moment appears each player taps; the peer with the smallest valid
// timestamp inside the latency window wins the point.
//
// This module is a standalone classic browser script; it will be wired into the
// Games surface by shell/app.js later. Public API: ReactionChallenge.host,
// ReactionChallenge.join, ReactionChallenge.leave, ReactionChallenge.tap,
// ReactionChallenge.onState / ReactionChallenge.offState.
(function attachReactionChallenge (root) {
  'use strict'

  const Net = root.PearCupPeerNet
  if (!Net) {
    if (root.console && root.console.warn) root.console.warn('PearCupPeerNet missing — Reaction Challenge disabled')
    return
  }

  const DEFAULT_ROUNDS = 5
  const WINDOW_MS = 800
  const CHALLENGE_TTL_MS = 60000
  const DEFAULT_MOMENTS = ['goal', 'save', 'penalty', 'red-card', 'VAR-overturn']

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
    schedule: [],
    currentRound: 0,
    scores: { you: 0, opp: 0 },
    localTaps: {},
    remoteTaps: {},
    resolved: new Set(),
    timers: [],
    listeners: new Set()
  }

  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.reactionChallengeModule = status
    }
  }

  function syncDiagnostics (stateName) {
    const ds = root.document && root.document.documentElement && root.document.documentElement.dataset
    if (!ds) return
    ds.reactionChallengeState = stateName || (state.over ? 'over' : state.started ? 'started' : state.active ? 'joining' : 'idle')
    ds.reactionChallengeActive = String(Boolean(state.active))
    if (state.code) ds.reactionChallengeCode = state.code
    else delete ds.reactionChallengeCode
    if (state.role) ds.reactionChallengeRole = state.role
    else delete ds.reactionChallengeRole
    if (state.opp && state.opp.name) ds.reactionChallengeOpponent = state.opp.name
    else delete ds.reactionChallengeOpponent
  }

  function getSnapshot () {
    const currentMoment = state.schedule[state.currentRound] || null
    return {
      active: state.active,
      started: state.started,
      over: state.over,
      code: state.code,
      role: state.role,
      round: state.currentRound + 1,
      totalRounds: state.schedule.length,
      scores: { ...state.scores },
      schedule: state.schedule.slice(),
      currentMoment,
      localTaps: { ...state.localTaps },
      remoteTaps: { ...state.remoteTaps },
      resolved: Array.from(state.resolved),
      statusText: state.over
        ? 'Game over'
        : state.started
          ? `Round ${state.currentRound + 1}`
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

  function clearTimers () {
    while (state.timers.length) {
      const t = state.timers.pop()
      if (typeof root.clearTimeout === 'function') root.clearTimeout(t)
    }
  }

  function reset () {
    stopAnnouncing()
    clearTimers()
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
      schedule: [],
      currentRound: 0,
      scores: { you: 0, opp: 0 },
      localTaps: {},
      remoteTaps: {},
      resolved: new Set(),
      timers: []
    })
    syncDiagnostics('idle')
  }

  // ---- lifecycle ----

  function host (code, opts) {
    reset()
    state.active = true
    state.code = code || Net.newRoomCode()
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

  function join (code) {
    reset()
    state.active = true
    state.code = code
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
      gameType: 'reaction-challenge'
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
      case 'hello': return onHello(msg.peer, msg.cred, msg.helloNonce)
      case 'challenge': return onChallenge(msg)
      case 'tap': return onTap(msg)
      case 'leave': return onOppLeft()
    }
  }

  async function onHello (peer, cred, helloNonce) {
    if (state.started || !peer || state.opp) return
    const RA = root.PearCupRoomAccess

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
    const momentOptions = root.ULTIMATE_FIT_CONFIG && root.ULTIMATE_FIT_CONFIG.reactionMoments
      ? root.ULTIMATE_FIT_CONFIG.reactionMoments
      : DEFAULT_MOMENTS
    state.schedule = buildSchedule(seed, momentOptions, DEFAULT_ROUNDS)
    state.currentRound = 0
    state.scores = { you: 0, opp: 0 }
    state.localTaps = {}
    state.remoteTaps = {}
    state.resolved = new Set()

    syncDiagnostics('started')
    emitState()
    scheduleRound(0)
  }

  function onOppLeft () {
    if (state.over) return
    leave(true)
  }

  // ---- deterministic scheduling (pure helpers) ----

  function buildSeed (peerA, peerB, nonceA, nonceB) {
    const ids = [peerA, peerB].sort()
    const nonces = [nonceA || '', nonceB || ''].sort()
    return Net.digest(`reaction-challenge|${ids[0]}|${ids[1]}|${nonces[0]}|${nonces[1]}`)
  }

  function buildSchedule (seed, kinds, totalRounds) {
    const out = []
    const pool = kinds && kinds.length ? kinds : DEFAULT_MOMENTS
    const base = 1500
    const interval = 2000
    let h = seed
    for (let i = 0; i < totalRounds; i++) {
      h = Net.digest(`${h}|${i}`)
      const kind = pool[parseInt(h.slice(0, 4), 16) % pool.length]
      const appearAt = base + i * interval + (parseInt(h.slice(4, 8), 16) % 500)
      out.push({
        id: `r${i + 1}-${kind}`,
        round: i,
        kind,
        appearAt,
        windowMs: WINDOW_MS
      })
    }
    return out
  }

  function scoreMoment (moment, localTapTs, remoteTapTs) {
    const localValid = localTapTs != null && localTapTs >= moment.appearAt && localTapTs <= moment.appearAt + moment.windowMs
    const remoteValid = remoteTapTs != null && remoteTapTs >= moment.appearAt && remoteTapTs <= moment.appearAt + moment.windowMs

    if (!localValid && !remoteValid) return { winner: null, reason: 'no-valid-tap' }
    if (localValid && !remoteValid) return { winner: 'you', reason: 'opponent-missed' }
    if (!localValid && remoteValid) return { winner: 'opp', reason: 'you-missed' }
    if (localTapTs === remoteTapTs) return { winner: null, reason: 'tie' }
    return localTapTs < remoteTapTs
      ? { winner: 'you', reason: 'faster' }
      : { winner: 'opp', reason: 'faster' }
  }

  // ---- round timing ----

  function scheduleRound (i) {
    if (!state.started || state.over || i >= state.schedule.length) return
    state.currentRound = i
    const moment = state.schedule[i]
    const now = Date.now()

    const appearDelay = Math.max(0, moment.appearAt - now)
    const resolveDelay = Math.max(0, moment.appearAt + moment.windowMs - now)

    const appearTimer = root.setTimeout(() => { emitState() }, appearDelay)
    state.timers.push(appearTimer)

    const resolveTimer = root.setTimeout(() => { resolveMoment(moment) }, resolveDelay)
    state.timers.push(resolveTimer)
  }

  function resolveMoment (moment) {
    if (state.resolved.has(moment.id)) return
    state.resolved.add(moment.id)

    const localTs = state.localTaps[moment.id]
    const remoteTs = state.remoteTaps[moment.id]
    const result = scoreMoment(moment, localTs, remoteTs)

    if (result.winner === 'you') state.scores.you += 1
    else if (result.winner === 'opp') state.scores.opp += 1

    emitState()

    if (moment.round + 1 >= state.schedule.length) {
      finishGame()
    } else {
      scheduleRound(moment.round + 1)
    }
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
      gameType: 'reaction-challenge',
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

  // ---- player input ----

  function tap (momentId) {
    if (!state.started || state.over || !state.opp) return false
    const moment = state.schedule.find(m => m.id === momentId)
    if (!moment) return false
    if (state.resolved.has(momentId)) return false
    if (state.localTaps[momentId] != null) return false

    const ts = Date.now()
    state.localTaps[momentId] = ts
    send({ t: 'tap', momentId, ts, round: moment.round })
    emitState()
    return true
  }

  function onTap (msg) {
    if (!state.started || state.over || !state.opp || msg.sender !== state.opp.peerId) return
    const moment = state.schedule.find(m => m.id === msg.momentId)
    if (!moment) return
    if (state.resolved.has(msg.momentId)) return
    if (state.remoteTaps[msg.momentId] != null) return // ignore duplicate / replay
    state.remoteTaps[msg.momentId] = msg.ts
    emitState()
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
    tap,
    onState,
    offState,
    _testHelpers: {
      buildSeed,
      buildSchedule,
      scoreMoment,
      getState: getSnapshot,
      simulateRemoteTap: function (momentId, ts) {
        if (!state.started || !state.opp) return false
        onMessage({
          t: 'tap',
          room: state.code,
          sender: state.opp.peerId,
          momentId,
          ts,
          round: 0
        })
        return true
      }
    }
  }

  root.ReactionChallenge = api
  if (typeof module !== 'undefined' && module.exports) module.exports = api

  markModule('ready')
})(typeof globalThis !== 'undefined' ? globalThis : window)
