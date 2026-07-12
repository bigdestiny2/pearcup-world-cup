// PearCup peer penalty match — a REAL two-client shootout.
//
// Two peers join the same room topic (PearCupPeerNet channel). They alternate:
// each round player A shoots (B keeps) then player B shoots (A keeps), five rounds.
// Every kick uses commit-reveal so the keeper can't see the aim before diving and
// the shooter can't change the aim after seeing the dive:
//   shooter → commit H(aim|nonce)   keeper → dive zone   shooter → reveal aim,nonce
// Both clients then resolve the kick deterministically (identical inputs) and animate
// from their own perspective. Reuses app.js's pitch/HUD helpers + `state` (shared
// classic-script globals, referenced bare).
//
// Transport is PearCupPeerNet.createChannel: PearBrowser swarm.v1 for published
// hyper:// apps, Pear Runtime hyperswarm for pear run, BroadcastChannel for local preview.
(function attachPearCupPeerMatch (root) {
  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.pearcupPeerMatchModule = status
    }
  }

  const Net = root.PearCupPeerNet
  if (!Net) { markModule('missing-peer-net'); console.warn('PearCupPeerNet missing — peer match disabled'); return }

  const TOTAL = 5 // rounds (each player takes 5, keeps 5)
  // HiveRelay is enqueue-based and can briefly be rate-limited while a peer
  // stream reconnects. Keep authoritative turn frames alive long enough for
  // the bounded transport replay/rejoin path to deliver them; stale kick IDs
  // are still ignored by the receiver, so this cannot rewind a match.
  // A public relay can apply a short per-client send budget while two native
  // renderers are both reconnecting. Keep each authoritative frame replayable
  // for the whole bounded recovery window instead of expiring a reveal while
  // the peer is rebuilding its SSE channel.
  const CRITICAL_RETRY_TTL_MS = 120_000
  const PM = {
    active: false, started: false, over: false,
    channel: null, code: null,
    self: null, opp: null, role: null,
    kIndex: 0, busy: false,
    commit: null,        // {aim, nonce, power} while I'm shooting
    remoteCommit: null,  // hash received while I'm keeping
    myDive: null,
    autoplayTimer: null,
    nudgeTimer: null,
    diveReceived: false,
    awaitingResolved: false,
    resolvedReceived: false,
    lastDives: new Map(),
    lastReveals: new Map(),
    lastResolved: new Map(),
    futureMessages: new Map(),
    sentCounts: new Map(),
    receivedCounts: new Map(),
    lastMessage: null,
    recoveryRequests: 0,
    lastRecoveryReason: null,
    retryTimers: new Map(),
    helloTimer: null,
    helloAttempts: 0
  }

  const $ = sel => document.querySelector(sel)
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  function syncDiagnostics (stateName) {
    const ds = root.document && root.document.documentElement && root.document.documentElement.dataset
    if (!ds) return
    const currentState = stateName || (PM.over ? 'over' : PM.started ? 'started' : PM.active ? 'joining' : 'idle')
    ds.pearcupPeerMatchState = currentState
    ds.pearcupPeerMatchActive = String(Boolean(PM.active))
    ds.pearcupPeerMatchStarted = String(Boolean(PM.started))
    if (PM.code) ds.pearcupPeerMatchCode = PM.code
    else delete ds.pearcupPeerMatchCode
    if (PM.role) ds.pearcupPeerMatchRole = PM.role
    else delete ds.pearcupPeerMatchRole
    if (PM.opp && PM.opp.name) ds.pearcupPeerMatchOpponent = PM.opp.name
    else delete ds.pearcupPeerMatchOpponent
    if (PM.channel && PM.channel.backend) ds.pearcupPeerMatchChannelBackend = PM.channel.backend
    else delete ds.pearcupPeerMatchChannelBackend
    if (ds.pearcupPendingJoin && PM.code && ds.pearcupPendingJoin === PM.code && PM.started) {
      ds.pearcupJoinState = 'started'
    }
    // Let the app shell report asynchronous deep-link transitions to runtime
    // probes. This is event-driven because a real relay handshake can take
    // longer than a fixed polling window on first boot.
    if (typeof root.PearCupOnPeerMatchState === 'function') {
      try {
        const shootout = typeof state !== 'undefined' && state && state.shootout ? state.shootout : null
        root.PearCupOnPeerMatchState({
          state: currentState,
          active: Boolean(PM.active),
          started: Boolean(PM.started),
          code: PM.code || '',
          role: PM.role || '',
          selfPeerId: PM.self && PM.self.peerId ? PM.self.peerId : '',
          opponentPeerId: PM.opp && PM.opp.peerId ? PM.opp.peerId : '',
          channelBackend: PM.channel && PM.channel.backend ? PM.channel.backend : '',
          kickIndex: PM.kIndex,
          phase: shootout && shootout.phase ? shootout.phase : '',
          busy: Boolean(PM.busy),
          remoteCommit: Boolean(PM.remoteCommit),
          sent: Object.fromEntries(PM.sentCounts),
          received: Object.fromEntries(PM.receivedCounts),
          lastMessage: PM.lastMessage,
          recoveryRequests: PM.recoveryRequests,
          lastRecoveryReason: PM.lastRecoveryReason,
          score: shootout
            ? { you: Number(shootout.you) || 0, opp: Number(shootout.opp) || 0 }
            : null
        })
      } catch (err) {}
    }
  }

  function reset () {
    stopAnnouncing()
    if (PM.autoplayTimer) { try { root.clearTimeout(PM.autoplayTimer) } catch (e) {} }
    if (PM.nudgeTimer) { try { root.clearInterval(PM.nudgeTimer) } catch (e) {} }
    for (const timer of PM.retryTimers.values()) { try { root.clearInterval(timer) } catch (e) {} }
    PM.retryTimers.clear()
    if (PM.channel) { try { PM.channel.close() } catch (e) {} }
    Object.assign(PM, {
      active: false, started: false, over: false, channel: null, code: null,
      self: null, opp: null, role: null, kIndex: 0, busy: false,
      commit: null, remoteCommit: null, myDive: null, autoplayTimer: null, nudgeTimer: null, diveReceived: false, awaitingResolved: false, resolvedReceived: false, lastDives: new Map(), lastReveals: new Map(), lastResolved: new Map(), futureMessages: new Map(), sentCounts: new Map(), receivedCounts: new Map(), lastMessage: null, recoveryRequests: 0, lastRecoveryReason: null, retryTimers: new Map(), helloTimer: null, helloAttempts: 0
    })
    syncDiagnostics('idle')
  }

  function shooterRoleForKick (k) { return k % 2 === 0 ? 'A' : 'B' } // A shoots first each round
  function iAmShooter () { return shooterRoleForKick(PM.kIndex) === PM.role }
  function roundOf (k) { return Math.floor(k / 2) }

  function releaseBackgroundChannels () {
    // Pool, lobby, and watch streams are useful around the game shell but add
    // replay/backpressure load to the same finite relay connection budget. A
    // live penalty match has one latency-sensitive topic; release the others
    // before opening it and they are restarted on the next shell render.
    const priorSkipLeave = root.PearCupRelaySkipLeaves
    root.PearCupRelaySkipLeaves = true
    try { if (root.PearCupLobby && typeof root.PearCupLobby.leave === 'function') root.PearCupLobby.leave(true) } catch (err) {}
    try {
      const watchState = root.PearCupWatchSync && root.PearCupWatchSync._state
      const challengePending = watchState && watchState.outgoing && watchState.outgoing.size > 0
      if (!challengePending && root.PearCupWatchSync && typeof root.PearCupWatchSync.leave === 'function') root.PearCupWatchSync.leave(true)
    } catch (err) {}
    try { if (root.PearCupPoolSync && typeof root.PearCupPoolSync.stop === 'function') root.PearCupPoolSync.stop() } catch (err) {}
    if (priorSkipLeave === undefined) delete root.PearCupRelaySkipLeaves
    else root.PearCupRelaySkipLeaves = priorSkipLeave
  }

  function releaseBackgroundChannelsForRelay () {
    // PearBrowser's native swarm test/adapter does not share the HTTP relay
    // budget and its lobby challenge handshake still needs the lobby channel
    // alive until the invite is accepted. Only apply the stream pause to the
    // configured HiveRelay path used by ordinary browser/Pear Runtime clients.
    try {
      if (root.PearCupHiveRelay && typeof root.PearCupHiveRelay.isConfigured === 'function' && root.PearCupHiveRelay.isConfigured(root)) releaseBackgroundChannels()
    } catch (err) {}
  }

  // ---- lifecycle ----
  function host (code, silent) {
    reset()
    releaseBackgroundChannelsForRelay()
    PM.active = true
    PM.code = code || Net.newRoomCode()
    PM.self = { peerId: externalPeerId() || Net.newPeerId(), name: state.username || 'captain', team: state.team || 'br' }
    openChannel()
    syncDiagnostics('hosting')
    if (!silent) { showToast('Room created — invite your friend'); renderInvite() }
    else showToast('Challenge sent — waiting for them to accept…')
    startAnnouncing()
  }

  function join (code) {
    reset()
    releaseBackgroundChannelsForRelay()
    PM.active = true
    PM.code = code
    PM.self = { peerId: externalPeerId() || Net.newPeerId(), name: state.username || 'captain', team: state.team || 'br' }
    openChannel()
    syncDiagnostics('joining')
    renderConnecting(code)
    startAnnouncing()
  }

  function openChannel () {
    // The match room has exactly one opponent. Replacing stale relay peer
    // mappings after a native SSE rejoin prevents retries from targeting the
    // previous channel ID and stranding a reveal on the next kick.
    PM.channel = Net.createChannel(Net.GAME_TOPIC(PM.code), { peerLimit: 1 })
    PM.channel.onMessage(onMessage)
  }

  function announce () { send({ t: 'hello', peer: PM.self }) }
  function recordMessage (map, type) { if (!type) return; map.set(type, (map.get(type) || 0) + 1) }
  function send (msg) {
    if (!PM.channel) return
    recordMessage(PM.sentCounts, msg && msg.t)
    PM.lastMessage = `sent:${msg && msg.t}:${msg && msg.kickId != null ? msg.kickId : ''}`
    PM.channel.send({ ...msg, room: PM.code, sender: PM.self.peerId })
  }

  function clearCritical (type, kickId) {
    const key = `${type}:${kickId}`
    const timer = PM.retryTimers.get(key)
    if (!timer) return
    try { root.clearInterval(timer) } catch (e) {}
    PM.retryTimers.delete(key)
  }

  function externalPeerId () {
    if (!externalAutoplayEnabled()) return ''
    const env = (typeof process !== 'undefined' && process && process.env) || {}
    const raw = String(env.PEARCUP_EXTERNAL_PEER_TEST_PEER_ID || '').trim().toLowerCase()
    return /^[a-z0-9-]{4,64}$/.test(raw) ? raw : ''
  }

  // Relay delivery is normally acknowledged and retried by HiveRelay, but a
  // match message may be sent while the other renderer is still attaching its
  // event stream. Re-send critical turn messages with fresh relay envelopes
  // for a short bounded window. The handlers are idempotent by kickId/phase,
  // so late duplicates are ignored and cannot duplicate scoring.
  function sendCritical (msg) {
    const key = `${msg.t}:${msg.kickId}`
    const expiresAt = Date.now() + CRITICAL_RETRY_TTL_MS
    clearCritical(msg.t, msg.kickId)
    send(msg)
    if (typeof root.setInterval !== 'function') return
    const timer = root.setInterval(() => {
      if (!PM.active || PM.over || Date.now() >= expiresAt) {
        try { root.clearInterval(timer) } catch (e) {}
        PM.retryTimers.delete(key)
        return
      }
      // HiveRelay already retries the signed envelope with ACK/backoff. Do
      // not manufacture another envelope while that transport entry is live;
      // otherwise a busy peer stream can spend every slot on duplicates.
      const transportPending = PM.channel && typeof PM.channel.hasPendingCritical === 'function' && PM.channel.hasPendingCritical()
      if (!transportPending) send(msg)
    }, 2500)
    PM.retryTimers.set(key, timer)
  }

  function startAnnouncing () {
    stopAnnouncing()
    PM.helloAttempts = 0
    announce()
    if (typeof root.setInterval !== 'function') return
    PM.helloTimer = root.setInterval(() => {
      if (!PM.active || PM.started) {
        stopAnnouncing()
        return
      }
      PM.helloAttempts += 1
      announce()
      if (PM.helloAttempts >= 40) stopAnnouncing()
    }, 500)
  }

  function stopAnnouncing () {
    if (!PM.helloTimer) return
    if (typeof root.clearInterval === 'function') root.clearInterval(PM.helloTimer)
    PM.helloTimer = null
  }

  function onMessage (msg) {
    if (!msg || msg.room !== PM.code || msg.sender === PM.self.peerId) return
    recordMessage(PM.receivedCounts, msg.t)
    PM.lastMessage = `received:${msg.t}:${msg.kickId != null ? msg.kickId : ''}`
    const kickId = Number(msg.kickId)
    if (['commit', 'dive', 'reveal', 'resolved', 'nudge', 'dive-ack'].includes(msg.t) && Number.isInteger(kickId)) {
      if (kickId > PM.kIndex) {
        const key = `${msg.t}:${kickId}`
        PM.futureMessages.set(key, msg)
        while (PM.futureMessages.size > 32) PM.futureMessages.delete(PM.futureMessages.keys().next().value)
        return
      }
      // A stale nudge is still useful: the peer may have advanced locally
      // after resolving a kick while this renderer missed the reveal. Allow
      // onNudge() to replay its bounded lastDives/lastReveals cache. All other
      // stale turn frames remain ignored so an old state transition cannot
      // rewind the match.
      if (kickId < PM.kIndex && msg.t !== 'nudge') return
    }
    return dispatchMessage(msg)
  }

  function dispatchMessage (msg) {
    switch (msg.t) {
      case 'hello': return onHello(msg.peer)
      case 'commit': return onCommit(msg)
      case 'dive': return onDive(msg)
      case 'reveal': return onReveal(msg)
      case 'resolved': return onResolved(msg)
      case 'nudge': return onNudge(msg)
      case 'dive-ack': return onDiveAck(msg)
      case 'leave': return onOppLeft()
    }
  }

  function onHello (peer) {
    if (PM.started || !peer) return
    if (!PM.opp) { PM.opp = peer; announce() } // re-announce so a late joiner learns me
    syncDiagnostics(PM.role ? undefined : 'connected')
    maybeStart()
  }

  function maybeStart () {
    if (PM.started || !PM.opp) return
    PM.started = true
    // Keep a watch challenge channel only while its acceptance ACK is still
    // outstanding; ordinary matches release all background streams now.
    releaseBackgroundChannels()
    if (PM.channel && typeof PM.channel.setRefreshEnabled === 'function') PM.channel.setRefreshEnabled(true)
    stopAnnouncing()
    PM.role = PM.self.peerId < PM.opp.peerId ? 'A' : 'B'
    // Both players on default names would read "captain vs captain" — disambiguate the
    // opponent (they also get a distinct pool avatar from the new name).
    if ((PM.opp.name || '').toLowerCase() === (PM.self.name || '').toLowerCase()) PM.opp.name = 'Rival'
    state.match = { opponent: { name: PM.opp.name, team: PM.opp.team }, stake: 0, peer: true }
    state.shootout = { round: 0, mode: 'shoot', you: 0, opp: 0, youDots: [], oppDots: [], phase: 'aim', busy: false, lastResult: null, peer: true }
    closeModal()
    showToast(`Connected to ${PM.opp.name} — best of five!`)
    setView('games')
    syncDiagnostics('started')
    render()
  }

  function onOppLeft () {
    if (PM.over) return
    showToast(`${PM.opp ? PM.opp.name : 'Opponent'} left the match`)
    leave(true)
  }

  function leave (silent) {
    if (!silent) send({ t: 'leave' })
    reset()
    state.match = null
    ensureShootout(true)
    hideOverlay()
    renderGames()
  }

  // ---- render / turn setup ----
  function render () {
    if (!PM.active || !PM.started) return
    ensureShootoutDom()
    const arena = document.querySelector('#games .game-arena')
    if (arena) arena.classList.remove('is-lobby')
    if (PM.over) return
    setupKick()
  }

  function setupKick () {
    const so = state.shootout
    so.round = roundOf(PM.kIndex)
    so.mode = iAmShooter() ? 'shoot' : 'keep'
    so.phase = 'aim'
    PM.busy = false; PM.myDive = null; PM.remoteCommit = null; PM.diveReceived = false; PM.awaitingResolved = false; PM.resolvedReceived = false
    // Only the current shooter owns transport-level recovery for this kick;
    // the owner alternates with the turn so a lost reveal on either side is
    // repaired without both native renderers rejoining at once.
    if (PM.channel && typeof PM.channel.setRecoveryOwner === 'function') PM.channel.setRecoveryOwner(iAmShooter())
    syncDiagnostics()

    const me = { name: PM.self.name, team: PM.self.team }
    const opp = { name: PM.opp.name, team: PM.opp.team }
    const shooterP = iAmShooter() ? me : opp
    const keeperP = iAmShooter() ? opp : me
    const sTeam = teamById(shooterP.team), kTeam = teamById(keeperP.team)

    const shooter = $('#gameShooter'), keeper = $('#gameKeeper'), ball = $('#gameBall')
    if (shooter) shooter.innerHTML = avatarSvg(shooterP.name, sTeam)
    if (keeper) { keeper.innerHTML = avatarSvg(keeperP.name, kTeam); keeper.style.left = '50%'; keeper.classList.remove('dive-left', 'dive-right', 'dive-mid') }
    if (ball) { ball.classList.remove('is-kicking'); ball.style.left = '50%'; ball.style.top = '80%' }

    setScoreboard(shooterP.name, sTeam, keeperP.name, kTeam,
      `Round ${so.round + 1} of ${TOTAL}`,
      iAmShooter() ? 'Your shot' : `${opp.name} shoots`,
      iAmShooter() ? 'Pick a corner' : 'Read the striker')

    const dock = $('#powerDock')
    if (dock) {
      dock.classList.toggle('is-keep', !iAmShooter())
      const label = dock.querySelector('.power-label')
      if (label) label.innerHTML = iAmShooter() ? 'Power &amp; timing — click a corner to shoot' : `${esc(opp.name)} is lining up — get ready to dive…`
    }

    hideShootBanner()
    renderShootoutHud()

    if (typeof setAimGridLabels === 'function') setAimGridLabels(iAmShooter())
    if (iAmShooter()) { showAimGrid(); startPowerMeter() } else { hideAimGrid(); stopPowerMeter(); showShootBanner('Keeper ready — waiting for their strike…', 'is-wait') }
    startNudge()
    scheduleExternalAutoplay()
    drainFutureMessages()
  }

  function drainFutureMessages () {
    const pending = []
    for (const [key, msg] of PM.futureMessages) {
      if (Number(msg && msg.kickId) === PM.kIndex) {
        pending.push([key, msg])
      }
    }
    for (const [key, msg] of pending) {
      PM.futureMessages.delete(key)
      dispatchMessage(msg)
    }
  }

  function startNudge () {
    if (typeof root.setInterval !== 'function') return
    if (PM.nudgeTimer) { try { root.clearInterval(PM.nudgeTimer) } catch (e) {} }
    const kickId = PM.kIndex
    const nudgeIntervalMs = PM.channel && PM.channel.backend === 'hiverelay-outboxlog-v2' ? 5000 : 2500
    let waitingTicks = 0
    PM.nudgeTimer = root.setInterval(() => {
      if (!PM.active || PM.over || PM.kIndex !== kickId) {
        try { root.clearInterval(PM.nudgeTimer) } catch (e) {}
        PM.nudgeTimer = null
        return
      }
      const want = iAmShooter()
        ? (PM.awaitingResolved ? 'resolved' : PM.commit && !PM.diveReceived ? 'dive' : '')
        : (PM.myDive != null ? 'reveal' : 'commit')
      // A keeper has no actionable recovery before the shooter's first
      // commitment arrives; waiting for a friend to choose a shot is normal,
      // not a dead relay. Likewise, only recover a shooter after a commit (or
      // a pending resolution) exists. This prevents idle rooms from both
      // rejoining on a timer and invalidating the peer mapping before play.
      const canRecover = iAmShooter()
        ? Boolean(PM.commit || PM.awaitingResolved)
        : Boolean(PM.remoteCommit || PM.myDive)
      if (want && canRecover) waitingTicks += 1
      else waitingTicks = 0
      // Either endpoint may repair a stalled route. Do not rely only on the
      // relay's connected bit: a native SSE proxy can stay logically connected
      // while its peer route is stale. The transport cooldown prevents churn,
      // while bounded turn ownership lets the current shooter repair a lost
      // commit/dive/reveal without both peers rejoining simultaneously. A
      // keeper can still repair a lost reveal when it is the only endpoint
      // holding actionable state.
      const relayRecoveryDelay = PM.channel && PM.channel.backend === 'hiverelay-outboxlog-v2'
      const recoveryAfterTicks = relayRecoveryDelay && PM.role === 'B' && want === 'reveal' ? 6 : 3
      const nudgeDue = want && canRecover && waitingTicks >= recoveryAfterTicks && waitingTicks % recoveryAfterTicks === 0
      const recoveryOwner = want === 'reveal' || iAmShooter()
      if (nudgeDue && recoveryOwner && PM.channel && typeof PM.channel.requestRecovery === 'function') {
        PM.recoveryRequests += 1
        PM.lastRecoveryReason = `${PM.role || 'peer'} turn delivery stalled`
        syncDiagnostics('playing')
        PM.channel.requestRecovery(`${PM.role || 'peer'} turn delivery stalled`)
      }
      // Nudges are a last-resort hint, not a heartbeat. Sending one on every
      // timer tick consumed the relay's per-client budget alongside ACKs and
      // caused otherwise healthy turns to self-rate-limit. Emit only at the
      // recovery boundary; the transport's signed critical retry handles the
      // normal case.
      if (nudgeDue) send({ t: 'nudge', kickId, want })
    }, nudgeIntervalMs)
  }

  function advanceKick () {
    if (PM.over) return
    PM.awaitingResolved = false
    PM.resolvedReceived = false
    PM.commit = null; PM.myDive = null; PM.remoteCommit = null; PM.busy = false
    PM.kIndex += 1
    if (PM.kIndex >= TOTAL * 2) endMatch()
    else {
      syncDiagnostics('playing')
      setupKick()
    }
  }

  function externalAutoplayEnabled () {
    const env = (typeof process !== 'undefined' && process && process.env) || {}
    return ['1', 'true', 'yes', 'on'].includes(String(env.PEARCUP_EXTERNAL_PEER_TEST_AUTOPLAY || '').toLowerCase())
  }

  function scheduleExternalAutoplay (attempt = 0) {
    if (!externalAutoplayEnabled() || !PM.started || PM.over || PM.busy) return
    if (PM.autoplayTimer) { try { root.clearTimeout(PM.autoplayTimer) } catch (e) {} }
    PM.autoplayTimer = root.setTimeout(() => {
      PM.autoplayTimer = null
      if (!PM.active || !PM.started || PM.over || PM.busy || state.shootout && state.shootout.phase !== 'aim') return
      if (iAmShooter()) onZone('left-high')
      else if (PM.remoteCommit) onZone('right-high')
      // A relay can deliver commit frames after the first timer tick. Keep the
      // deterministic test driver alive for a bounded window instead of
      // silently leaving a keeper in an unwinnable waiting state.
      if (attempt < 12 && state.shootout && state.shootout.phase === 'aim') {
        scheduleExternalAutoplay(attempt + 1)
      }
    }, attempt === 0 ? 120 : 250)
  }

  // Aim-grid click router (called from app.js when a peer match is active).
  function onZone (zone) {
    if (!PM.active || !PM.started || PM.over || PM.busy) return
    const so = state.shootout
    if (so.phase !== 'aim') return
    if (iAmShooter()) {
      const power = (typeof readPowerPct === 'function') ? readPowerPct() : 60
      const nonce = Net.newNonce()
      PM.commit = { aim: zone, nonce, power }
      so.phase = 'committed'
      hideAimGrid(); stopPowerMeter()
      showShootBanner('Struck! keeper diving…', 'is-stop')
      sendCritical({ t: 'commit', kickId: PM.kIndex, hash: Net.commitHash(zone, nonce) })
      syncDiagnostics()
    } else {
      if (!PM.remoteCommit) return
      PM.myDive = zone
      so.phase = 'dived'
      hideAimGrid()
      showShootBanner('Dive called…', 'is-stop')
      const dive = { t: 'dive', kickId: PM.kIndex, zone }
      PM.lastDives.set(PM.kIndex, dive)
      while (PM.lastDives.size > 4) PM.lastDives.delete(PM.lastDives.keys().next().value)
      sendCritical(dive)
      syncDiagnostics()
    }
  }

  function onCommit (msg) {
    if (msg.kickId !== PM.kIndex || iAmShooter()) return
    PM.remoteCommit = msg.hash
    const so = state.shootout
    if (so.phase !== 'aim') return
    syncDiagnostics()
    if (typeof setAimGridLabels === 'function') setAimGridLabels(false)
    showAimGrid()
    showShootBanner('Now! pick your dive', 'is-goal')
    setTimeout(() => hideShootBanner(), 700)
    scheduleExternalAutoplay()
  }

  function onDive (msg) {
    if (msg.kickId !== PM.kIndex || !iAmShooter() || !PM.commit) return
    clearCritical('commit', msg.kickId)
    PM.diveReceived = true
    syncDiagnostics()
    const reveal = { t: 'reveal', kickId: PM.kIndex, aim: PM.commit.aim, nonce: PM.commit.nonce, power: PM.commit.power }
    PM.lastReveals.set(PM.kIndex, reveal)
    while (PM.lastReveals.size > 4) PM.lastReveals.delete(PM.lastReveals.keys().next().value)
    sendCritical(reveal)
    resolveKick(PM.commit.aim, msg.zone, PM.commit.power, PM.commit.nonce)
  }

  function onReveal (msg) {
    if (msg.kickId !== PM.kIndex || iAmShooter() || PM.myDive == null) return
    clearCritical('dive', msg.kickId)
    if (PM.nudgeTimer) { try { root.clearInterval(PM.nudgeTimer) } catch (e) {} PM.nudgeTimer = null }
    syncDiagnostics()
    if (PM.remoteCommit && Net.commitHash(msg.aim, msg.nonce) !== PM.remoteCommit) {
      showToast('⚠ Opponent commitment mismatch — kick voided')
    }
    resolveKick(msg.aim, PM.myDive, msg.power, msg.nonce)
  }

  function onResolved (msg) {
    if (msg.kickId !== PM.kIndex || !iAmShooter()) return
    clearCritical('reveal', msg.kickId)
    PM.resolvedReceived = true
    if (PM.awaitingResolved && !PM.busy) advanceKick()
  }

  function onDiveAck (msg) {
    if (msg.kickId !== PM.kIndex || iAmShooter()) return
    clearCritical('dive', msg.kickId)
  }

  function onNudge (msg) {
    const kickId = Number(msg && msg.kickId)
    if (!Number.isInteger(kickId)) return
    if (msg.want === 'commit' && iAmShooter() && kickId === PM.kIndex && PM.commit) {
      sendCritical({ t: 'commit', kickId, hash: Net.commitHash(PM.commit.aim, PM.commit.nonce) })
      return
    }
    const dive = PM.lastDives.get(kickId)
    if (msg.want === 'dive' && !iAmShooter() && dive) {
      sendCritical(dive)
      return
    }
    const reveal = PM.lastReveals.get(kickId)
    if (msg.want === 'reveal' && reveal) sendCritical(reveal)
    const resolved = PM.lastResolved.get(kickId)
    if (msg.want === 'resolved' && resolved) sendCritical(resolved)
  }

  async function resolveKick (aim, dive, power, nonce) {
    if (PM.busy) return
    PM.busy = true
    const so = state.shootout
    // Shared outcome model from app.js: pure function of (aim, dive, power, entropy),
    // entropy = hash(aim|dive|nonce) with the shooter's revealed nonce — both clients
    // hold identical inputs after reveal, so both derive the identical outcome.
    const outcome = kickOutcome(aim, dive, power, kickEntropy(aim, dive, nonce))
    const iShot = iAmShooter()
    const aimPos = zonePosition(aim)
    const divePos = zonePosition(dive)
    const keeperEl = $('#gameKeeper'), ballEl = $('#gameBall')

    requestAnimationFrame(() => {
      if (keeperEl) {
        keeperEl.style.left = `${divePos.x}%`
        keeperEl.classList.add(divePos.x < 50 ? 'dive-left' : divePos.x > 50 ? 'dive-right' : 'dive-mid')
      }
    })
    let bx = aimPos.x, by = aimPos.y
    if (outcome === 'post') by = (typeof overBarY === 'function') ? overBarY() : 4
    if (outcome === 'save') { bx = divePos.x; by = Math.min(aimPos.y, divePos.y) }
    if (ballEl) { ballEl.classList.add('is-kicking'); requestAnimationFrame(() => { ballEl.style.left = `${bx}%`; ballEl.style.top = `${by}%` }) }
    await sleep(720)

    const scored = outcome === 'goal'
    let good, label
    if (iShot) {
      good = scored
      label = scored ? 'GOAL!' : outcome === 'save' ? 'SAVED!' : 'OVER!'
      if (scored) so.you += 1
      so.youDots.push(scored ? 'goal' : 'miss')
    } else {
      good = !scored
      label = scored ? 'GOAL!' : outcome === 'post' ? 'OVER THE BAR!' : 'SAVED!'
      if (scored) so.opp += 1
      so.oppDots.push(scored ? 'goal' : 'save')
    }
    showShootBanner(label, good ? 'is-goal' : 'is-stop')
    if (good) fireConfetti()
    renderShootoutHud()
    await sleep(1150)
    hideShootBanner()
    if (ballEl) ballEl.classList.remove('is-kicking')
    if (keeperEl) keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid')

    // Both peers now hold the same committed aim, keeper dive, nonce, and
    // power, so the deterministic outcome is already resolved locally. Do not
    // gate the next kick on a second `resolved` ACK: that ACK is useful
    // evidence/replay material, but making it authoritative creates a second
    // delivery dependency after the reveal itself has been verified.
    advanceKick()
  }

  function endMatch () {
    PM.over = true
    if (PM.channel && typeof PM.channel.setRefreshEnabled === 'function') PM.channel.setRefreshEnabled(false)
    if (PM.channel && typeof PM.channel.setRecoveryOwner === 'function') PM.channel.setRecoveryOwner(false)
    const so = state.shootout
    so.phase = 'over'
    hideAimGrid(); stopPowerMeter()
    const win = so.you > so.opp, draw = so.you === so.opp
    const title = $('#overTitle'), score = $('#overScore'), overlay = $('#shootoutOver'), prizeEl = $('#overPrize'), trophy = $('#overTrophy')
    if (title) { title.textContent = win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'; title.className = 'over-title ' + (win ? 'is-win' : 'is-lose') }
    if (score) score.textContent = `You ${so.you} – ${so.opp} ${PM.opp.name}`
    if (prizeEl) { prizeEl.textContent = win ? 'Bragging rights secured' : draw ? 'Honours even' : 'Rematch to settle it'; prizeEl.className = 'over-prize' }
    if (trophy) trophy.hidden = !win
    if (win) fireConfetti()
    if (overlay) overlay.hidden = false
    const again = $('#playAgain'); if (again) again.textContent = 'New match'
    showToast(win ? `You beat ${PM.opp.name} ${so.you}–${so.opp}!` : draw ? `Level with ${PM.opp.name} ${so.you}–${so.opp}` : `${PM.opp.name} won ${so.opp}–${so.you}`)
    syncDiagnostics('over')
  }

  // ---- invite / connect modals ----
  function hyperLaunchBase () {
    const candidates = []
    const baseEl = document.querySelector('base[href]')
    if (baseEl && baseEl.href) candidates.push(baseEl.href)
    candidates.push(location.href)
    for (const href of candidates) {
      try {
        const url = new URL(href, location.href)
        if (url.protocol === 'hyper:' && url.hostname) return `hyper://${url.hostname}/`
        const match = url.pathname.match(/\/(?:app|hyper)\/([0-9a-f]{64})(?:\/|$)/i)
        if (match) return `hyper://${match[1].toLowerCase()}/`
      } catch (e) {}
    }
    return null
  }

  function pearLaunchBase () {
    const pear = root.Pear || null
    const app = pear && (pear.app || pear.config) || {}
    for (const href of [app.applink, app.link]) {
      try {
        const url = new URL(String(href || ''))
        if (url.protocol === 'pear:' && url.hostname) return `pear://${url.hostname}/`
      } catch (e) {}
    }
    return null
  }

  function inviteLink (code) {
    const hyperBase = hyperLaunchBase()
    if (hyperBase) return `${hyperBase}?join=${encodeURIComponent(code)}`
    const pearBase = pearLaunchBase()
    if (pearBase) return `${pearBase}?join=${encodeURIComponent(code)}`
    const url = new URL(location.href)
    url.search = ''
    url.hash = ''
    url.searchParams.set('join', code)
    return url.toString()
  }
  function closeModal () {
    const m = $('#peerModal')
    if (m) { if (m._onKey) document.removeEventListener('keydown', m._onKey); m.remove() }
  }
  function modal (html) {
    closeModal()
    const el = document.createElement('div')
    el.id = 'peerModal'
    el.className = 'peer-modal'
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    el.innerHTML = `<div class="peer-modal-card">${html}</div>`
    document.body.appendChild(el)
    // Escape mirrors the Cancel button (falls back to just closing).
    el._onKey = e => { if (e.key === 'Escape') { const c = el.querySelector('#peerCancel'); c ? c.click() : closeModal() } }
    document.addEventListener('keydown', el._onKey)
    requestAnimationFrame(() => el.classList.add('is-open'))
    return el
  }
  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s))
  function renderInvite () {
    const link = inviteLink(PM.code)
    const el = modal(`
      <p class="eyebrow">Penalty Clash · Friends</p>
      <h2 class="peer-title">Invite a friend</h2>
      <p class="peer-sub">Open the link in another window/tab now, or send it to a friend on this device. Cross-device runs on the Pear swarm.</p>
      <div class="peer-code">${PM.code}</div>
      <div class="peer-link"><code>${esc(link)}</code></div>
      <div class="peer-actions">
        <button class="secondary-button" id="peerCancel" type="button">Cancel</button>
        <button class="primary-button" id="peerCopy" type="button">Copy invite link</button>
      </div>
      <p class="peer-wait"><i></i> Waiting for your friend…</p>`)
    el.querySelector('#peerCancel').onclick = () => { closeModal(); leave() }
    el.querySelector('#peerCopy').onclick = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {})
      showToast('Invite link copied')
    }
  }
  function renderConnecting (code) {
    const el = modal(`
      <p class="eyebrow">Penalty Clash · Friends</p>
      <h2 class="peer-title">Joining ${esc(code)}…</h2>
      <p class="peer-sub">Connecting to the room. Keep your friend's invite window open.</p>
      <p class="peer-wait" id="peerWaitLine"><i></i> Handshaking…</p>
      <div class="peer-actions"><button class="secondary-button" id="peerCancel" type="button">Cancel</button></div>`)
    el.querySelector('#peerCancel').onclick = () => { closeModal(); leave() }
    // Don't spin forever: if no handshake in 30s, say so and offer the way out.
    setTimeout(() => {
      if (PM.started || !document.body.contains(el)) return
      const wait = el.querySelector('#peerWaitLine')
      if (wait) { wait.innerHTML = 'Connection timed out — ask your friend for a fresh invite code.'; wait.style.color = 'var(--pink-deep)' }
      const cancel = el.querySelector('#peerCancel')
      if (cancel) cancel.textContent = 'Back to lobby'
    }, 30000)
  }
  function promptJoin () {
    const el = modal(`
      <p class="eyebrow">Penalty Clash · Friends</p>
      <h2 class="peer-title">Join a friend</h2>
      <p class="peer-sub">Enter the room code your friend shared.</p>
      <input class="peer-input" id="peerJoinCode" placeholder="Paste the 12-character invite code" autocomplete="off">
      <div class="peer-actions">
        <button class="secondary-button" id="peerCancel" type="button">Cancel</button>
        <button class="primary-button" id="peerJoinGo" type="button">Join match</button>
      </div>`)
    el.querySelector('#peerCancel').onclick = closeModal
    el.querySelector('#peerJoinGo').onclick = () => {
      const code = (el.querySelector('#peerJoinCode').value || '').trim().toLowerCase()
      if (code) join(code)
    }
  }

  function isActive () { return PM.active && PM.started && !PM.over }

  root.PearCupPeerMatch = { host, join, promptJoin, onZone, isActive, leave, render, reset, _state: PM }
  syncDiagnostics('idle')
  markModule('ready')
})(typeof window !== 'undefined' ? window : globalThis)
