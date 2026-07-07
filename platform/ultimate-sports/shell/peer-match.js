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
  const PREDICTION_ROUNDS = 3
  const TRIVIA_ROUNDS = 3
  const CHALLENGE_TTL_MS = 60000
  const PM = {
    active: false, started: false, over: false,
    channel: null, code: null,
    self: null, opp: null, role: null,
    kIndex: 0, busy: false,
    gameType: 'penalty-clash',
    gameTypeSet: false,
    commit: null,        // {aim, nonce, power} while I'm shooting
    remoteCommit: null,  // hash received while I'm keeping
    myDive: null,
    helloTimer: null,
    helloAttempts: 0,
    challenges: new Map(),
    // Prediction duel state
    predictionRound: 0,
    predictionScore: { you: 0, opp: 0 },
    predictionChoices: { you: null, opp: null },
    predictionCommit: null,       // {choice, nonce}
    predictionRemoteCommit: null, // hash
    predictionRemoteNonce: null,  // revealed nonce
    predictionRevealed: { you: false, opp: false },
    predictionCorrect: null,
    predictionOver: false,
    // Trivia duel state
    triviaRound: 0,
    triviaScore: { you: 0, opp: 0 },
    triviaAnswers: { you: null, opp: null },
    triviaCommit: null,
    triviaRemoteCommit: null,
    triviaRemoteNonce: null,
    triviaRevealed: { you: false, opp: false },
    triviaOver: false,
    // Free-kick duel state
    fkRound: 0,
    fkScore: { you: 0, opp: 0 },
    fkCommit: null,
    fkRemoteCommit: null,
    fkRemoteReveal: null,
    fkRevealed: { you: false, opp: false },
    fkResolved: null,
    fkBusy: false,
    fkOver: false,
    // Buzzer Beater duel state
    bbRound: 0,
    bbScore: { you: 0, opp: 0 },
    bbCommit: null,
    bbRemoteCommit: null,
    bbRemoteReveal: null,
    bbRevealed: { you: false, opp: false },
    bbResolved: null,
    bbBusy: false,
    bbOver: false,
    // Ace Serve duel state
    asRound: 0,
    asScore: { you: 0, opp: 0 },
    asCommit: null,
    asRemoteCommit: null,
    asRemoteReveal: null,
    asRevealed: { you: false, opp: false },
    asResolved: null,
    asBusy: false,
    asOver: false,
    // Home Run Derby state
    hrRound: 0,
    hrScore: { you: 0, opp: 0 },
    hrCommit: null,
    hrRemoteCommit: null,
    hrRemoteReveal: null,
    hrRevealed: { you: false, opp: false },
    hrResolved: null,
    hrBusy: false,
    hrOver: false
  }

  const $ = sel => document.querySelector(sel)
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  function syncDiagnostics (stateName) {
    const ds = root.document && root.document.documentElement && root.document.documentElement.dataset
    if (!ds) return
    ds.pearcupPeerMatchState = stateName || (PM.over ? 'over' : PM.started ? 'started' : PM.active ? 'joining' : 'idle')
    ds.pearcupPeerMatchActive = String(Boolean(PM.active))
    ds.pearcupPeerMatchStarted = String(Boolean(PM.started))
    if (PM.code) ds.pearcupPeerMatchCode = PM.code
    else delete ds.pearcupPeerMatchCode
    if (PM.role) ds.pearcupPeerMatchRole = PM.role
    else delete ds.pearcupPeerMatchRole
    if (PM.opp && PM.opp.name) ds.pearcupPeerMatchOpponent = PM.opp.name
    else delete ds.pearcupPeerMatchOpponent
    if (ds.pearcupPendingJoin && PM.code && ds.pearcupPendingJoin === PM.code && PM.started) {
      ds.pearcupJoinState = 'started'
    }
  }

  function reset () {
    stopAnnouncing()
    if (PM.channel) { try { PM.channel.close() } catch (e) {} }
    Object.assign(PM, {
      active: false, started: false, over: false, channel: null, code: null,
      self: null, opp: null, role: null, kIndex: 0, busy: false,
      gameType: 'penalty-clash', gameTypeSet: false,
      commit: null, remoteCommit: null, myDive: null, helloTimer: null, helloAttempts: 0,
      challenges: new Map(),
      predictionRound: 0,
      predictionScore: { you: 0, opp: 0 },
      predictionChoices: { you: null, opp: null },
      predictionCommit: null,
      predictionRemoteCommit: null,
      predictionRemoteNonce: null,
      predictionRevealed: { you: false, opp: false },
      predictionCorrect: null,
      predictionOver: false,
      triviaRound: 0,
      triviaScore: { you: 0, opp: 0 },
      triviaAnswers: { you: null, opp: null },
      triviaCommit: null,
      triviaRemoteCommit: null,
      triviaRemoteNonce: null,
      triviaRevealed: { you: false, opp: false },
      triviaOver: false,
      fkRound: 0,
      fkScore: { you: 0, opp: 0 },
      fkCommit: null,
      fkRemoteCommit: null,
      fkRemoteReveal: null,
      fkRevealed: { you: false, opp: false },
      fkResolved: null,
      fkBusy: false,
      fkOver: false,
      bbRound: 0,
      bbScore: { you: 0, opp: 0 },
      bbCommit: null,
      bbRemoteCommit: null,
      bbRemoteReveal: null,
      bbRevealed: { you: false, opp: false },
      bbResolved: null,
      bbBusy: false,
      bbOver: false,
      asRound: 0,
      asScore: { you: 0, opp: 0 },
      asCommit: null,
      asRemoteCommit: null,
      asRemoteReveal: null,
      asRevealed: { you: false, opp: false },
      asResolved: null,
      asBusy: false,
      asOver: false,
      hrRound: 0,
      hrScore: { you: 0, opp: 0 },
      hrCommit: null,
      hrRemoteCommit: null,
      hrRemoteReveal: null,
      hrRevealed: { you: false, opp: false },
      hrResolved: null,
      hrBusy: false,
      hrOver: false
    })
    syncDiagnostics('idle')
  }

  function shooterRoleForKick (k) { return k % 2 === 0 ? 'A' : 'B' } // A shoots first each round
  function iAmShooter () { return shooterRoleForKick(PM.kIndex) === PM.role }
  function roundOf (k) { return Math.floor(k / 2) }

  // ---- lifecycle ----
  function host (code, silent, gameType) {
    reset()
    PM.active = true
    PM.code = code || Net.newRoomCode()
    PM.gameType = gameType || 'penalty-clash'
    PM.gameTypeSet = Boolean(gameType)
    PM.self = { peerId: Net.newPeerId(), name: state.username || 'captain', team: state.team || 'br' }
    openChannel()
    syncDiagnostics('hosting')
    if (!silent) { showToast('Room created — invite your friend'); renderInvite() }
    else showToast('Challenge sent — waiting for them to accept…')
    startAnnouncing()
  }

  function join (code, gameType) {
    reset()
    PM.active = true
    PM.code = code
    PM.gameType = gameType || 'penalty-clash'
    PM.gameTypeSet = Boolean(gameType)
    PM.self = { peerId: Net.newPeerId(), name: state.username || 'captain', team: state.team || 'br' }
    openChannel()
    syncDiagnostics('joining')
    renderConnecting(code)
    startAnnouncing()
  }

  function openChannel () {
    PM.channel = Net.createChannel(Net.GAME_TOPIC(PM.code))
    PM.channel.onMessage(onMessage)
  }

  function roomCredential () {
    const RA = root.PearCupRoomAccess
    return RA && typeof RA.myCredential === 'function' ? RA.myCredential() : null
  }
  function announce (cred) { send({ t: 'hello', peer: PM.self, cred: cred || roomCredential(), gameType: PM.gameType }) }
  function send (msg) { if (PM.channel) PM.channel.send({ ...msg, room: PM.code, sender: PM.self.peerId }) }

  function challengeNonce () {
    return Net && typeof Net.newNonce === 'function' ? Net.newNonce() : `${Date.now()}-${Math.random()}`
  }

  function isChallengeExpired (entry) {
    return !entry || (Date.now() - (entry.at || 0)) > CHALLENGE_TTL_MS
  }

  function sendChallenge (toPeerId) {
    if (!PM.active || PM.started || PM.opp) return
    const existing = PM.challenges.get(toPeerId)
    if (existing && !isChallengeExpired(existing)) return
    const nonce = challengeNonce()
    PM.challenges.set(toPeerId, { nonce, at: Date.now() })
    send({ t: 'challenge', nonce, to: toPeerId })
  }

  async function onChallenge (msg) {
    if (!PM.active || PM.started || PM.opp) return
    const RA = root.PearCupRoomAccess
    if (!RA || typeof RA.signChallenge !== 'function') return
    const proof = await RA.signChallenge(msg.nonce)
    if (!proof) return
    const base = roomCredential() || { key: null }
    announce({ key: base.key, cap: base.cap, proof, nonce: msg.nonce })
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
    switch (msg.t) {
      case 'hello': return onHello(msg.peer, msg.cred, msg.gameType)
      case 'challenge': return onChallenge(msg)
      case 'commit': return onCommit(msg)
      case 'dive': return onDive(msg)
      case 'reveal': return onReveal(msg)
      case 'prediction-commit': return onPredictionCommit(msg)
      case 'prediction-reveal': return onPredictionReveal(msg)
      case 'trivia-commit': return onTriviaCommit(msg)
      case 'trivia-reveal': return onTriviaReveal(msg)
      case 'fk-commit': return onFreeKickCommit(msg)
      case 'fk-reveal': return onFreeKickReveal(msg)
      case 'bb-commit': return onBuzzerCommit(msg)
      case 'bb-reveal': return onBuzzerReveal(msg)
      case 'as-commit': return onAceCommit(msg)
      case 'as-reveal': return onAceReveal(msg)
      case 'hr-commit': return onHomeRunCommit(msg)
      case 'hr-reveal': return onHomeRunReveal(msg)
      case 'leave': return onOppLeft()
    }
  }

  async function onHello (peer, cred, gameType) {
    if (PM.started || !peer || PM.opp) return
    if (!PM.gameTypeSet && gameType) PM.gameType = gameType
    const RA = root.PearCupRoomAccess
    // Public rooms admit everyone.
    if (!RA || !RA.enforced) {
      admitOpponent(peer)
      return
    }
    // Everyone (owner and invitees) must show valid structural authorization:
    // owner key match or a host-signed invite for their key.
    let authorized = false
    try { authorized = await RA.verify(cred) } catch (e) { authorized = false }
    if (!authorized) {
      if (!PM.rejectedNote) { PM.rejectedNote = true; try { showToast('Blocked a peer without a valid room invite') } catch (e) {} }
      return
    }
    // Anti-replay: only accept a proof signed over the nonce WE issued.
    // Self-chosen nonces are rejected; expired challenges are ignored.
    const stored = PM.challenges.get(peer.peerId)
    if (stored && !isChallengeExpired(stored) && cred && cred.proof) {
      let respOk = false
      try { respOk = await RA.verifyProof(cred, stored.nonce) } catch (e) { respOk = false }
      if (respOk) {
        PM.challenges.delete(peer.peerId)
        admitOpponent(peer)
        return
      }
    }
    if (stored && isChallengeExpired(stored)) PM.challenges.delete(peer.peerId)
    // Authorized but not yet proved — issue a fresh challenge.
    sendChallenge(peer.peerId)
  }

  function admitOpponent (peer) {
    if (PM.started || !peer || PM.opp) return
    PM.opp = peer
    announce() // re-announce so a late joiner learns me
    syncDiagnostics(PM.role ? undefined : 'connected')
    maybeStart()
  }

  function maybeStart () {
    if (PM.started || !PM.opp) return
    PM.started = true
    stopAnnouncing()
    PM.role = PM.self.peerId < PM.opp.peerId ? 'A' : 'B'
    // Both players on default names would read "captain vs captain" — disambiguate the
    // opponent (they also get a distinct pool avatar from the new name).
    if ((PM.opp.name || '').toLowerCase() === (PM.self.name || '').toLowerCase()) PM.opp.name = 'Rival'
    state.match = { opponent: { name: PM.opp.name, team: PM.opp.team }, stake: 0, peer: true, gameType: PM.gameType }
    if (PM.gameType === 'trivia-duel') {
      PM.triviaRound = 0
      PM.triviaScore = { you: 0, opp: 0 }
      PM.triviaAnswers = { you: null, opp: null }
      PM.triviaCommit = null
      PM.triviaRemoteCommit = null
      PM.triviaRemoteNonce = null
      PM.triviaRevealed = { you: false, opp: false }
      PM.triviaOver = false
      closeModal()
      showToast(`Connected to ${PM.opp.name} — trivia duel!`)
      setView('games')
      syncDiagnostics('started')
      render()
      return
    }
    if (PM.gameType === 'prediction-duel') {
      PM.predictionRound = 0
      PM.predictionScore = { you: 0, opp: 0 }
      PM.predictionChoices = { you: null, opp: null }
      PM.predictionCommit = null
      PM.predictionRemoteCommit = null
      PM.predictionRemoteNonce = null
      PM.predictionRevealed = { you: false, opp: false }
      PM.predictionCorrect = null
      PM.predictionOver = false
      closeModal()
      showToast(`Connected to ${PM.opp.name} — predict the outcome!`)
      setView('games')
      syncDiagnostics('started')
      render()
      return
    }
    if (PM.gameType === 'free-kick-duel') {
      PM.fkRound = 0
      PM.fkScore = { you: 0, opp: 0 }
      PM.fkCommit = null
      PM.fkRemoteCommit = null
      PM.fkRemoteReveal = null
      PM.fkRevealed = { you: false, opp: false }
      PM.fkResolved = null
      PM.fkBusy = false
      PM.fkOver = false
      closeModal()
      showToast(`Connected to ${PM.opp.name} — free-kick duel!`)
      setView('games')
      syncDiagnostics('started')
      render()
      return
    }
    if (PM.gameType === 'buzzer-beater-duel') {
      PM.bbRound = 0
      PM.bbScore = { you: 0, opp: 0 }
      PM.bbCommit = null
      PM.bbRemoteCommit = null
      PM.bbRemoteReveal = null
      PM.bbRevealed = { you: false, opp: false }
      PM.bbResolved = null
      PM.bbBusy = false
      PM.bbOver = false
      closeModal()
      showToast(`Connected to ${PM.opp.name} — buzzer beater duel!`)
      setView('games')
      syncDiagnostics('started')
      render()
      return
    }
    if (PM.gameType === 'ace-serve-duel') {
      PM.asRound = 0
      PM.asScore = { you: 0, opp: 0 }
      PM.asCommit = null
      PM.asRemoteCommit = null
      PM.asRemoteReveal = null
      PM.asRevealed = { you: false, opp: false }
      PM.asResolved = null
      PM.asBusy = false
      PM.asOver = false
      closeModal()
      showToast(`Connected to ${PM.opp.name} — ace serve duel!`)
      setView('games')
      syncDiagnostics('started')
      render()
      return
    }
    if (PM.gameType === 'home-run-derby') {
      PM.hrRound = 0
      PM.hrScore = { you: 0, opp: 0 }
      PM.hrCommit = null
      PM.hrRemoteCommit = null
      PM.hrRemoteReveal = null
      PM.hrRevealed = { you: false, opp: false }
      PM.hrResolved = null
      PM.hrBusy = false
      PM.hrOver = false
      closeModal()
      showToast(`Connected to ${PM.opp.name} — home run derby!`)
      setView('games')
      syncDiagnostics('started')
      render()
      return
    }
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
    if (PM.gameType === 'trivia-duel') {
      renderTriviaDuel()
      return
    }
    if (PM.gameType === 'prediction-duel') {
      renderPredictionDuel()
      return
    }
    if (PM.gameType === 'free-kick-duel') {
      renderFreeKickDuel()
      return
    }
    if (PM.gameType === 'buzzer-beater-duel') {
      renderBuzzerBeaterDuel()
      return
    }
    if (PM.gameType === 'ace-serve-duel') {
      renderAceServeDuel()
      return
    }
    if (PM.gameType === 'home-run-derby') {
      renderHomeRunDerby()
      return
    }
    if (PM.gameType !== 'penalty-clash') return
    ensureShootoutDom()
    const arena = document.querySelector('#games .game-arena')
    if (arena) arena.classList.remove('is-lobby')
    if (PM.over) return
    setupKick()
  }

  function renderPredictionDuel () {
    // The UI is driven by app.js based on PM state; this keeps the arena out of lobby mode.
    const arena = document.querySelector('#games .game-arena')
    if (arena) arena.classList.remove('is-lobby')
  }

  function renderTriviaDuel () {
    // The UI is driven by app.js based on PM state; this keeps the arena out of lobby mode.
    const arena = document.querySelector('#games .game-arena')
    if (arena) arena.classList.remove('is-lobby')
  }

  function setupKick () {
    const so = state.shootout
    so.round = roundOf(PM.kIndex)
    so.mode = iAmShooter() ? 'shoot' : 'keep'
    so.phase = 'aim'
    PM.busy = false; PM.myDive = null; PM.remoteCommit = null

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

    if (iAmShooter()) { showAimGrid(); startPowerMeter() } else { hideAimGrid(); stopPowerMeter(); showShootBanner('Keeper ready — waiting for their strike…', 'is-wait') }
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
      send({ t: 'commit', kickId: PM.kIndex, hash: Net.commitHash(zone, nonce) })
    } else {
      if (!PM.remoteCommit) return
      PM.myDive = zone
      so.phase = 'dived'
      hideAimGrid()
      showShootBanner('Dive called…', 'is-stop')
      send({ t: 'dive', kickId: PM.kIndex, zone })
    }
  }

  function onCommit (msg) {
    if (msg.kickId !== PM.kIndex || iAmShooter()) return
    PM.remoteCommit = msg.hash
    const so = state.shootout
    if (so.phase !== 'aim') return
    showAimGrid()
    showShootBanner('Now! pick your dive', 'is-goal')
    setTimeout(() => hideShootBanner(), 700)
  }

  function onDive (msg) {
    if (msg.kickId !== PM.kIndex || !iAmShooter() || !PM.commit) return
    send({ t: 'reveal', kickId: PM.kIndex, aim: PM.commit.aim, nonce: PM.commit.nonce, power: PM.commit.power })
    resolveKick(PM.commit.aim, msg.zone, PM.commit.power, PM.commit.nonce)
  }

  function onReveal (msg) {
    if (msg.kickId !== PM.kIndex || iAmShooter() || PM.myDive == null) return
    if (PM.remoteCommit && Net.commitHash(msg.aim, msg.nonce) !== PM.remoteCommit) {
      showToast('⚠ Opponent commitment mismatch — kick voided')
    }
    resolveKick(msg.aim, PM.myDive, msg.power, msg.nonce)
  }

  // ---- Prediction duel: commit/reveal peer-vs-peer ----
  function onPredictionCommit (msg) {
    if (!PM.active || !PM.started || PM.gameType !== 'prediction-duel') return
    PM.predictionRemoteCommit = msg.hash
    renderGames()
  }

  function onPredictionReveal (msg) {
    if (!PM.active || !PM.started || PM.gameType !== 'prediction-duel') return
    if (PM.predictionRemoteCommit && Net.commitHash(msg.choice, msg.nonce) !== PM.predictionRemoteCommit) {
      showToast('⚠ Opponent prediction mismatch — round voided')
      return
    }
    PM.predictionChoices.opp = msg.choice
    PM.predictionRemoteNonce = msg.nonce
    PM.predictionRevealed.opp = true
    if (PM.predictionRevealed.you) resolvePredictionRound()
    else renderGames()
  }

  function predictionPick (choice) {
    if (!PM.active || !PM.started || PM.gameType !== 'prediction-duel' || PM.predictionOver) return
    if (PM.predictionChoices.you != null) return
    const nonce = Net.newNonce()
    PM.predictionChoices.you = choice
    PM.predictionCommit = { choice, nonce }
    send({ t: 'prediction-commit', round: PM.predictionRound, hash: Net.commitHash(choice, nonce) })
    renderGames()
  }

  function predictionReveal () {
    if (!PM.active || !PM.started || PM.gameType !== 'prediction-duel' || PM.predictionOver) return
    if (!PM.predictionCommit || PM.predictionRevealed.you) return
    PM.predictionRevealed.you = true
    send({ t: 'prediction-reveal', round: PM.predictionRound, choice: PM.predictionCommit.choice, nonce: PM.predictionCommit.nonce })
    if (PM.predictionRevealed.opp) resolvePredictionRound()
    else renderGames()
  }

  function predictionEntropy (localChoice, localNonce, remoteChoice, remoteNonce) {
    // Order inputs deterministically by peer id so both clients derive the same answer.
    const localFirst = PM.self.peerId < PM.opp.peerId
    const a = localFirst ? localChoice : remoteChoice
    const na = localFirst ? localNonce : remoteNonce
    const b = localFirst ? remoteChoice : localChoice
    const nb = localFirst ? remoteNonce : localNonce
    return Net.digest(`${a}|${na}|${b}|${nb}`)
  }

  function resolvePredictionRound () {
    if (!PM.active || !PM.started || PM.gameType !== 'prediction-duel') return
    const localChoice = PM.predictionChoices.you
    const remoteChoice = PM.predictionChoices.opp
    const localNonce = PM.predictionCommit && PM.predictionCommit.nonce
    const remoteNonce = PM.predictionRemoteNonce
    if (localChoice == null || remoteChoice == null || !localNonce || !remoteNonce) return
    const entropy = predictionEntropy(localChoice, localNonce, remoteChoice, remoteNonce)
    const options = window.ULTIMATE_FIT_CONFIG && window.ULTIMATE_FIT_CONFIG.predictionOptions ? window.ULTIMATE_FIT_CONFIG.predictionOptions : ['Option A', 'Option B', 'Option C', 'Option D']
    const correctIndex = Math.abs(parseInt(entropy.slice(2), 16)) % options.length
    const correct = options[correctIndex]
    PM.predictionCorrect = correct
    if (localChoice === correct) PM.predictionScore.you += 1
    if (remoteChoice === correct) PM.predictionScore.opp += 1
    const roundOver = PM.predictionRound + 1 >= PREDICTION_ROUNDS
    if (roundOver) {
      PM.predictionOver = true
      const win = PM.predictionScore.you > PM.predictionScore.opp
      const draw = PM.predictionScore.you === PM.predictionScore.opp
      showToast(win ? `You win ${PM.predictionScore.you}–${PM.predictionScore.opp}!` : draw ? `Draw ${PM.predictionScore.you}–${PM.predictionScore.opp}` : `${PM.opp.name} wins ${PM.predictionScore.opp}–${PM.predictionScore.you}`)
    }
    renderGames()
  }

  function predictionNextRound () {
    if (!PM.active || !PM.started || PM.gameType !== 'prediction-duel' || PM.predictionOver) return
    PM.predictionRound += 1
    PM.predictionChoices = { you: null, opp: null }
    PM.predictionCommit = null
    PM.predictionRemoteCommit = null
    PM.predictionRemoteNonce = null
    PM.predictionRevealed = { you: false, opp: false }
    PM.predictionCorrect = null
    renderGames()
  }

  // ---- Trivia duel: commit/reveal peer-vs-peer ----
  function onTriviaCommit (msg) {
    if (!PM.active || !PM.started || PM.gameType !== 'trivia-duel') return
    if (msg.round !== PM.triviaRound) return
    PM.triviaRemoteCommit = msg.hash
    renderGames()
  }

  function onTriviaReveal (msg) {
    if (!PM.active || !PM.started || PM.gameType !== 'trivia-duel') return
    if (msg.round !== PM.triviaRound) return
    if (PM.triviaRemoteCommit && Net.commitHash(msg.choice, msg.nonce) !== PM.triviaRemoteCommit) {
      showToast('⚠ Opponent trivia mismatch — round voided')
      return
    }
    PM.triviaAnswers.opp = msg.choice
    PM.triviaRemoteNonce = msg.nonce
    PM.triviaRevealed.opp = true
    if (PM.triviaRevealed.you) resolveTriviaQuestion()
    else renderGames()
  }

  function triviaPick (choice) {
    if (!PM.active || !PM.started || PM.gameType !== 'trivia-duel' || PM.triviaOver) return
    if (PM.triviaAnswers.you != null) return
    const nonce = Net.newNonce()
    PM.triviaAnswers.you = choice
    PM.triviaCommit = { choice, nonce }
    send({ t: 'trivia-commit', round: PM.triviaRound, hash: Net.commitHash(choice, nonce) })
    renderGames()
  }

  function triviaReveal () {
    if (!PM.active || !PM.started || PM.gameType !== 'trivia-duel' || PM.triviaOver) return
    if (!PM.triviaCommit || PM.triviaRevealed.you) return
    PM.triviaRevealed.you = true
    send({ t: 'trivia-reveal', round: PM.triviaRound, choice: PM.triviaCommit.choice, nonce: PM.triviaCommit.nonce })
    if (PM.triviaRevealed.opp) resolveTriviaQuestion()
    else renderGames()
  }

  function resolveTriviaQuestion () {
    if (!PM.active || !PM.started || PM.gameType !== 'trivia-duel') return
    const localChoice = PM.triviaAnswers.you
    const remoteChoice = PM.triviaAnswers.opp
    if (localChoice == null || remoteChoice == null) return
    const bank = window.ULTIMATE_FIT_CONFIG && window.ULTIMATE_FIT_CONFIG.triviaQuestions
    const q = bank && bank[PM.triviaRound]
    if (!q) return
    const correct = q.answer
    if (localChoice === correct) PM.triviaScore.you += 1
    if (remoteChoice === correct) PM.triviaScore.opp += 1
    const roundOver = PM.triviaRound + 1 >= TRIVIA_ROUNDS
    if (roundOver) {
      PM.triviaOver = true
      const win = PM.triviaScore.you > PM.triviaScore.opp
      const draw = PM.triviaScore.you === PM.triviaScore.opp
      showToast(win ? `You win ${PM.triviaScore.you}–${PM.triviaScore.opp}!` : draw ? `Draw ${PM.triviaScore.you}–${PM.triviaScore.opp}` : `${PM.opp.name} wins ${PM.triviaScore.opp}–${PM.triviaScore.you}`)
    }
    renderGames()
  }

  function triviaNextQuestion () {
    if (!PM.active || !PM.started || PM.gameType !== 'trivia-duel' || PM.triviaOver) return
    PM.triviaRound += 1
    PM.triviaAnswers = { you: null, opp: null }
    PM.triviaCommit = null
    PM.triviaRemoteCommit = null
    PM.triviaRemoteNonce = null
    PM.triviaRevealed = { you: false, opp: false }
    renderGames()
  }

  // ---- Free-kick duel: commit/reveal peer-vs-peer ----
  function aimZoneToWall (aim) {
    if (!aim) return 'center'
    if (aim.indexOf('left') !== -1) return 'left'
    if (aim.indexOf('right') !== -1) return 'right'
    return 'center'
  }

  function freeKickPick (aim, power, curve) {
    if (!PM.active || !PM.started || PM.gameType !== 'free-kick-duel' || PM.fkOver) return
    if (!iAmShooter()) return
    if (PM.fkCommit) return
    const nonce = Net.newNonce()
    PM.fkCommit = { aim, power, curve, nonce }
    PM.fkRevealed.you = false
    send({ t: 'fk-commit', round: PM.fkRound, hash: Net.commitHash(JSON.stringify({ aim, power, curve }), nonce) })
    renderGames()
  }

  function freeKickDive (dive, wall) {
    if (!PM.active || !PM.started || PM.gameType !== 'free-kick-duel' || PM.fkOver) return
    if (iAmShooter()) return
    if (PM.fkCommit) return
    if (!PM.fkRemoteCommit) return
    const nonce = Net.newNonce()
    PM.fkCommit = { dive, wall, nonce }
    PM.fkRevealed.you = false
    send({ t: 'fk-commit', round: PM.fkRound, hash: Net.commitHash(JSON.stringify({ dive, wall }), nonce) })
    renderGames()
  }

  function freeKickReveal () {
    if (!PM.active || !PM.started || PM.gameType !== 'free-kick-duel' || PM.fkOver) return
    if (!PM.fkCommit || PM.fkRevealed.you) return
    if (!PM.fkRemoteCommit) return
    PM.fkRevealed.you = true
    let resolved = false
    if (iAmShooter()) {
      send({ t: 'fk-reveal', round: PM.fkRound, aim: PM.fkCommit.aim, power: PM.fkCommit.power, curve: PM.fkCommit.curve, nonce: PM.fkCommit.nonce })
      if (PM.fkRemoteReveal) { resolveFreeKick(PM.fkCommit.aim, PM.fkRemoteReveal.dive, PM.fkCommit.power, PM.fkCommit.curve, PM.fkRemoteReveal.wall, PM.fkCommit.nonce); resolved = true }
    } else {
      send({ t: 'fk-reveal', round: PM.fkRound, dive: PM.fkCommit.dive, wall: PM.fkCommit.wall, nonce: PM.fkCommit.nonce })
      if (PM.fkRemoteReveal) { resolveFreeKick(PM.fkRemoteReveal.aim, PM.fkCommit.dive, PM.fkRemoteReveal.power, PM.fkRemoteReveal.curve, PM.fkCommit.wall, PM.fkRemoteReveal.nonce); resolved = true }
    }
    if (!resolved) renderGames()
  }

  function onFreeKickCommit (msg) {
    if (!PM.active || !PM.started || PM.gameType !== 'free-kick-duel') return
    if (msg.round !== PM.fkRound) return
    PM.fkRemoteCommit = msg.hash
    renderGames()
  }

  function onFreeKickReveal (msg) {
    if (!PM.active || !PM.started || PM.gameType !== 'free-kick-duel') return
    if (msg.round !== PM.fkRound) return
    if (PM.fkRemoteCommit) {
      const expected = iAmShooter()
        ? Net.commitHash(JSON.stringify({ dive: msg.dive, wall: msg.wall }), msg.nonce)
        : Net.commitHash(JSON.stringify({ aim: msg.aim, power: msg.power, curve: msg.curve }), msg.nonce)
      if (expected !== PM.fkRemoteCommit) {
        showToast('⚠ Opponent free-kick commitment mismatch — kick voided')
        return
      }
    }
    PM.fkRemoteReveal = msg
    PM.fkRevealed.opp = true
    if (PM.fkRevealed.you) {
      if (iAmShooter()) {
        resolveFreeKick(PM.fkCommit.aim, msg.dive, PM.fkCommit.power, PM.fkCommit.curve, msg.wall, PM.fkCommit.nonce)
      } else {
        resolveFreeKick(msg.aim, PM.fkCommit.dive, msg.power, msg.curve, PM.fkCommit.wall, msg.nonce)
      }
    } else {
      renderGames()
    }
  }

  function resolveFreeKick (aim, dive, power, curve, wall, nonce) {
    if (PM.fkBusy) return
    PM.fkBusy = true
    const onFrame = aim !== 'wall' && aim !== 'wide' && power >= 30 && power <= 95
    const wallBlocks = wall && wall === aimZoneToWall(aim) && Math.abs(curve) < 3
    const saved = dive === aim && Math.abs(curve) < 7
    const goal = onFrame && !wallBlocks && !saved
    let points = 0
    if (goal) points = 3
    else if (onFrame && !wallBlocks) points = 1
    if (iAmShooter()) PM.fkScore.you += points
    else PM.fkScore.opp += points
    PM.fkResolved = { aim, dive, power, curve, wall, onFrame, wallBlocks, saved, goal, points, nonce }
    const roundOver = PM.kIndex + 1 >= 6
    if (roundOver) {
      PM.fkOver = true
      const win = PM.fkScore.you > PM.fkScore.opp
      const draw = PM.fkScore.you === PM.fkScore.opp
      showToast(win ? `You win ${PM.fkScore.you}–${PM.fkScore.opp}!` : draw ? `Draw ${PM.fkScore.you}–${PM.fkScore.opp}` : `${PM.opp.name} wins ${PM.fkScore.opp}–${PM.fkScore.you}`)
    }
    renderGames()
  }

  function freeKickNextRound () {
    if (!PM.active || !PM.started || PM.gameType !== 'free-kick-duel' || PM.fkOver) return
    PM.kIndex += 1
    PM.fkRound = Math.floor(PM.kIndex / 2)
    PM.fkCommit = null
    PM.fkRemoteCommit = null
    PM.fkRemoteReveal = null
    PM.fkRevealed = { you: false, opp: false }
    PM.fkResolved = null
    PM.fkBusy = false
    if (typeof state !== 'undefined') {
      state.fkPeerAim = null
      state.fkPeerCurve = 0
      state.fkPeerDive = null
      state.fkPeerWall = 'center'
    }
    renderGames()
  }

  // ---- Buzzer Beater duel: commit/reveal peer-vs-peer ----
  function buzzerPick (aim, power) {
    if (!PM.active || !PM.started || PM.gameType !== 'buzzer-beater-duel' || PM.bbOver) return
    if (!iAmShooter()) return
    if (PM.bbCommit) return
    const nonce = Net.newNonce()
    PM.bbCommit = { aim, power, nonce }
    PM.bbRevealed.you = false
    send({ t: 'bb-commit', round: PM.bbRound, hash: Net.commitHash(JSON.stringify({ aim, power }), nonce) })
    renderGames()
  }

  function buzzerDefend (defenderRead) {
    if (!PM.active || !PM.started || PM.gameType !== 'buzzer-beater-duel' || PM.bbOver) return
    if (iAmShooter()) return
    if (PM.bbCommit) return
    if (!PM.bbRemoteCommit) return
    const nonce = Net.newNonce()
    PM.bbCommit = { defenderRead, nonce }
    PM.bbRevealed.you = false
    send({ t: 'bb-commit', round: PM.bbRound, hash: Net.commitHash(JSON.stringify({ defenderRead }), nonce) })
    renderGames()
  }

  function buzzerReveal () {
    if (!PM.active || !PM.started || PM.gameType !== 'buzzer-beater-duel' || PM.bbOver) return
    if (!PM.bbCommit || PM.bbRevealed.you) return
    if (!PM.bbRemoteCommit) return
    PM.bbRevealed.you = true
    let resolved = false
    if (iAmShooter()) {
      send({ t: 'bb-reveal', round: PM.bbRound, aim: PM.bbCommit.aim, power: PM.bbCommit.power, nonce: PM.bbCommit.nonce })
      if (PM.bbRemoteReveal) { resolveBuzzerBeater(PM.bbCommit.aim, PM.bbRemoteReveal.defenderRead, PM.bbCommit.power, PM.bbCommit.nonce); resolved = true }
    } else {
      send({ t: 'bb-reveal', round: PM.bbRound, defenderRead: PM.bbCommit.defenderRead, nonce: PM.bbCommit.nonce })
      if (PM.bbRemoteReveal) { resolveBuzzerBeater(PM.bbRemoteReveal.aim, PM.bbCommit.defenderRead, PM.bbRemoteReveal.power, PM.bbCommit.nonce); resolved = true }
    }
    if (!resolved) renderGames()
  }

  function onBuzzerCommit (msg) {
    if (!PM.active || !PM.started || PM.gameType !== 'buzzer-beater-duel') return
    if (msg.round !== PM.bbRound) return
    PM.bbRemoteCommit = msg.hash
    renderGames()
  }

  function onBuzzerReveal (msg) {
    if (!PM.active || !PM.started || PM.gameType !== 'buzzer-beater-duel') return
    if (msg.round !== PM.bbRound) return
    if (PM.bbRemoteCommit) {
      const expected = iAmShooter()
        ? Net.commitHash(JSON.stringify({ defenderRead: msg.defenderRead }), msg.nonce)
        : Net.commitHash(JSON.stringify({ aim: msg.aim, power: msg.power }), msg.nonce)
      if (expected !== PM.bbRemoteCommit) {
        showToast('⚠ Opponent buzzer beater commitment mismatch — shot voided')
        return
      }
    }
    PM.bbRemoteReveal = msg
    PM.bbRevealed.opp = true
    if (PM.bbRevealed.you) {
      if (iAmShooter()) {
        resolveBuzzerBeater(PM.bbCommit.aim, msg.defenderRead, PM.bbCommit.power, PM.bbCommit.nonce)
      } else {
        resolveBuzzerBeater(msg.aim, PM.bbCommit.defenderRead, msg.power, msg.nonce)
      }
    } else {
      renderGames()
    }
  }

  function resolveBuzzerBeater (aim, defenderRead, power, nonce) {
    if (PM.bbBusy) return
    PM.bbBusy = true
    const onTarget = aim !== 'miss' && power >= 35 && power <= 95
    const blocked = defenderRead === aim
    const basket = onTarget && !blocked
    let points = 0
    if (basket) points = 2
    else if (onTarget) points = 1
    if (iAmShooter()) PM.bbScore.you += points
    else PM.bbScore.opp += points
    PM.bbResolved = { aim, defenderRead, power, onTarget, blocked, basket, points, nonce }
    const roundOver = PM.kIndex + 1 >= 6
    if (roundOver) {
      PM.bbOver = true
      const win = PM.bbScore.you > PM.bbScore.opp
      const draw = PM.bbScore.you === PM.bbScore.opp
      showToast(win ? `You win ${PM.bbScore.you}–${PM.bbScore.opp}!` : draw ? `Draw ${PM.bbScore.you}–${PM.bbScore.opp}` : `${PM.opp.name} wins ${PM.bbScore.opp}–${PM.bbScore.you}`)
    }
    renderGames()
  }

  function buzzerNextRound () {
    if (!PM.active || !PM.started || PM.gameType !== 'buzzer-beater-duel' || PM.bbOver) return
    PM.kIndex += 1
    PM.bbRound = Math.floor(PM.kIndex / 2)
    PM.bbCommit = null
    PM.bbRemoteCommit = null
    PM.bbRemoteReveal = null
    PM.bbRevealed = { you: false, opp: false }
    PM.bbResolved = null
    PM.bbBusy = false
    if (typeof state !== 'undefined') {
      state.bbPeerAim = null
      state.bbPeerDefenderRead = null
    }
    renderGames()
  }

  // ---- Ace Serve duel: commit/reveal peer-vs-peer ----
  function aceServePick (placement, power, spin) {
    if (!PM.active || !PM.started || PM.gameType !== 'ace-serve-duel' || PM.asOver) return
    if (!iAmShooter()) return
    if (PM.asCommit) return
    const nonce = Net.newNonce()
    PM.asCommit = { placement, power, spin, nonce }
    PM.asRevealed.you = false
    send({ t: 'as-commit', round: PM.asRound, hash: Net.commitHash(JSON.stringify({ placement, power, spin }), nonce) })
    renderGames()
  }

  function aceServeReturn (returnerRead) {
    if (!PM.active || !PM.started || PM.gameType !== 'ace-serve-duel' || PM.asOver) return
    if (iAmShooter()) return
    if (PM.asCommit) return
    if (!PM.asRemoteCommit) return
    const nonce = Net.newNonce()
    PM.asCommit = { returnerRead, nonce }
    PM.asRevealed.you = false
    send({ t: 'as-commit', round: PM.asRound, hash: Net.commitHash(JSON.stringify({ returnerRead }), nonce) })
    renderGames()
  }

  function aceServeReveal () {
    if (!PM.active || !PM.started || PM.gameType !== 'ace-serve-duel' || PM.asOver) return
    if (!PM.asCommit || PM.asRevealed.you) return
    if (!PM.asRemoteCommit) return
    PM.asRevealed.you = true
    let resolved = false
    if (iAmShooter()) {
      send({ t: 'as-reveal', round: PM.asRound, placement: PM.asCommit.placement, power: PM.asCommit.power, spin: PM.asCommit.spin, nonce: PM.asCommit.nonce })
      if (PM.asRemoteReveal) { resolveAceServe(PM.asCommit.placement, PM.asRemoteReveal.returnerRead, PM.asCommit.power, PM.asCommit.spin); resolved = true }
    } else {
      send({ t: 'as-reveal', round: PM.asRound, returnerRead: PM.asCommit.returnerRead, nonce: PM.asCommit.nonce })
      if (PM.asRemoteReveal) { resolveAceServe(PM.asRemoteReveal.placement, PM.asCommit.returnerRead, PM.asRemoteReveal.power, PM.asRemoteReveal.spin); resolved = true }
    }
    if (!resolved) renderGames()
  }

  function onAceCommit (msg) {
    if (!PM.active || !PM.started || PM.gameType !== 'ace-serve-duel') return
    if (msg.round !== PM.asRound) return
    PM.asRemoteCommit = msg.hash
    renderGames()
  }

  function onAceReveal (msg) {
    if (!PM.active || !PM.started || PM.gameType !== 'ace-serve-duel') return
    if (msg.round !== PM.asRound) return
    if (PM.asRemoteCommit) {
      const expected = iAmShooter()
        ? Net.commitHash(JSON.stringify({ returnerRead: msg.returnerRead }), msg.nonce)
        : Net.commitHash(JSON.stringify({ placement: msg.placement, power: msg.power, spin: msg.spin }), msg.nonce)
      if (expected !== PM.asRemoteCommit) {
        showToast('⚠ Opponent ace serve commitment mismatch — serve voided')
        return
      }
    }
    PM.asRemoteReveal = msg
    PM.asRevealed.opp = true
    if (PM.asRevealed.you) {
      if (iAmShooter()) {
        resolveAceServe(PM.asCommit.placement, msg.returnerRead, PM.asCommit.power, PM.asCommit.spin)
      } else {
        resolveAceServe(msg.placement, PM.asCommit.returnerRead, msg.power, msg.spin)
      }
    } else {
      renderGames()
    }
  }

  function resolveAceServe (placement, returnerRead, power, spin) {
    if (PM.asBusy) return
    PM.asBusy = true
    const inBounds = placement !== 'fault' && power >= 40 && power <= 100
    const ace = inBounds && placement !== returnerRead && Math.abs(spin) >= 1 && power >= 60
    let points = 0
    if (ace) points = 2
    else if (inBounds) points = 1
    if (iAmShooter()) PM.asScore.you += points
    else PM.asScore.opp += points
    PM.asResolved = { placement, returnerRead, power, spin, inBounds, ace, points }
    const roundOver = PM.kIndex + 1 >= 6
    if (roundOver) {
      PM.asOver = true
      const win = PM.asScore.you > PM.asScore.opp
      const draw = PM.asScore.you === PM.asScore.opp
      showToast(win ? `You win ${PM.asScore.you}–${PM.asScore.opp}!` : draw ? `Draw ${PM.asScore.you}–${PM.asScore.opp}` : `${PM.opp.name} wins ${PM.asScore.opp}–${PM.asScore.you}`)
    }
    renderGames()
  }

  function aceServeNextRound () {
    if (!PM.active || !PM.started || PM.gameType !== 'ace-serve-duel' || PM.asOver) return
    PM.kIndex += 1
    PM.asRound = Math.floor(PM.kIndex / 2)
    PM.asCommit = null
    PM.asRemoteCommit = null
    PM.asRemoteReveal = null
    PM.asRevealed = { you: false, opp: false }
    PM.asResolved = null
    PM.asBusy = false
    if (typeof state !== 'undefined') {
      state.asPeerPlacement = null
      state.asPeerSpin = 0
      state.asPeerReturnerRead = null
    }
    renderGames()
  }

  // ---- Home Run Derby: commit/reveal peer-vs-peer ----
  function iAmPitcher () { return (PM.kIndex % 2 === 0 ? 'A' : 'B') === PM.role }
  function iAmBatter () { return !iAmPitcher() }

  function homeRunSwing (pitchRead, power, timing) {
    if (!PM.active || !PM.started || PM.gameType !== 'home-run-derby' || PM.hrOver) return
    if (!iAmBatter()) return
    if (PM.hrCommit) return
    const nonce = Net.newNonce()
    PM.hrCommit = { pitchRead, power, timing, nonce }
    PM.hrRevealed.you = false
    send({ t: 'hr-commit', round: PM.hrRound, hash: Net.commitHash(JSON.stringify({ pitchRead, power, timing }), nonce) })
    renderGames()
  }

  function homeRunPitch (pitchType) {
    if (!PM.active || !PM.started || PM.gameType !== 'home-run-derby' || PM.hrOver) return
    if (!iAmPitcher()) return
    if (PM.hrCommit) return
    const nonce = Net.newNonce()
    PM.hrCommit = { pitchType, nonce }
    PM.hrRevealed.you = false
    send({ t: 'hr-commit', round: PM.hrRound, hash: Net.commitHash(JSON.stringify({ pitchType }), nonce) })
    renderGames()
  }

  function homeRunReveal () {
    if (!PM.active || !PM.started || PM.gameType !== 'home-run-derby' || PM.hrOver) return
    if (!PM.hrCommit || PM.hrRevealed.you) return
    if (!PM.hrRemoteCommit) return
    PM.hrRevealed.you = true
    let resolved = false
    if (iAmBatter()) {
      send({ t: 'hr-reveal', round: PM.hrRound, pitchRead: PM.hrCommit.pitchRead, power: PM.hrCommit.power, timing: PM.hrCommit.timing, nonce: PM.hrCommit.nonce })
      if (PM.hrRemoteReveal) { resolveHomeRunDerby(PM.hrCommit.pitchRead, PM.hrRemoteReveal.pitchType, PM.hrCommit.power, PM.hrCommit.timing); resolved = true }
    } else {
      send({ t: 'hr-reveal', round: PM.hrRound, pitchType: PM.hrCommit.pitchType, nonce: PM.hrCommit.nonce })
      if (PM.hrRemoteReveal) { resolveHomeRunDerby(PM.hrRemoteReveal.pitchRead, PM.hrCommit.pitchType, PM.hrRemoteReveal.power, PM.hrRemoteReveal.timing); resolved = true }
    }
    if (!resolved) renderGames()
  }

  function onHomeRunCommit (msg) {
    if (!PM.active || !PM.started || PM.gameType !== 'home-run-derby') return
    if (msg.round !== PM.hrRound) return
    PM.hrRemoteCommit = msg.hash
    renderGames()
  }

  function onHomeRunReveal (msg) {
    if (!PM.active || !PM.started || PM.gameType !== 'home-run-derby') return
    if (msg.round !== PM.hrRound) return
    if (PM.hrRemoteCommit) {
      const expected = iAmBatter()
        ? Net.commitHash(JSON.stringify({ pitchType: msg.pitchType }), msg.nonce)
        : Net.commitHash(JSON.stringify({ pitchRead: msg.pitchRead, power: msg.power, timing: msg.timing }), msg.nonce)
      if (expected !== PM.hrRemoteCommit) {
        showToast('⚠ Opponent home run derby commitment mismatch — swing voided')
        return
      }
    }
    PM.hrRemoteReveal = msg
    PM.hrRevealed.opp = true
    if (PM.hrRevealed.you) {
      if (iAmBatter()) {
        resolveHomeRunDerby(PM.hrCommit.pitchRead, msg.pitchType, PM.hrCommit.power, PM.hrCommit.timing)
      } else {
        resolveHomeRunDerby(msg.pitchRead, PM.hrCommit.pitchType, msg.power, msg.timing)
      }
    } else {
      renderGames()
    }
  }

  function resolveHomeRunDerby (pitchRead, pitchType, power, timing) {
    if (PM.hrBusy) return
    PM.hrBusy = true
    const readCorrect = pitchRead === pitchType
    const homeRun = readCorrect && power >= 70 && timing === 'good'
    const hit = readCorrect && power >= 50
    const points = homeRun ? 4 : (hit ? 1 : 0)
    const batter = iAmBatter()
    if (batter) PM.hrScore.you += points
    else PM.hrScore.opp += points
    PM.hrResolved = { pitchRead, pitchType, power, timing, readCorrect, homeRun, hit, points }
    const roundOver = PM.kIndex + 1 >= 6
    if (roundOver) {
      PM.hrOver = true
      const win = PM.hrScore.you > PM.hrScore.opp
      const draw = PM.hrScore.you === PM.hrScore.opp
      showToast(win ? `You win ${PM.hrScore.you}–${PM.hrScore.opp}!` : draw ? `Draw ${PM.hrScore.you}–${PM.hrScore.opp}` : `${PM.opp.name} wins ${PM.hrScore.opp}–${PM.hrScore.you}`)
    }
    renderGames()
  }

  function homeRunNextRound () {
    if (!PM.active || !PM.started || PM.gameType !== 'home-run-derby' || PM.hrOver) return
    PM.kIndex += 1
    PM.hrRound = Math.floor(PM.kIndex / 2)
    PM.hrCommit = null
    PM.hrRemoteCommit = null
    PM.hrRemoteReveal = null
    PM.hrRevealed = { you: false, opp: false }
    PM.hrResolved = null
    PM.hrBusy = false
    if (typeof state !== 'undefined') {
      state.hrPeerPitchRead = null
      state.hrPeerPitchType = null
      state.hrPeerTiming = 'good'
    }
    renderGames()
  }

  function renderHomeRunDerby () {
    // The UI is driven by app.js based on PM state; this keeps the arena out of lobby mode.
    const arena = document.querySelector('#games .game-arena')
    if (arena) arena.classList.remove('is-lobby')
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

    PM.commit = null; PM.myDive = null; PM.remoteCommit = null; PM.busy = false
    PM.kIndex += 1
    if (PM.kIndex >= TOTAL * 2) endMatch()
    else setupKick()
  }

  function endMatch () {
    PM.over = true
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

  function inviteLink (code) {
    const hyperBase = hyperLaunchBase()
    if (hyperBase) return `${hyperBase}?join=${encodeURIComponent(code)}`
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
    const title = (root.ULTIMATE_MINI_GAME_TITLES && root.ULTIMATE_MINI_GAME_TITLES[PM.gameType]) || 'Penalty Clash'
    const el = modal(`
      <p class="eyebrow">${esc(title)} · Friends</p>
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
    const title = (root.ULTIMATE_MINI_GAME_TITLES && root.ULTIMATE_MINI_GAME_TITLES[PM.gameType]) || 'Penalty Clash'
    const el = modal(`
      <p class="eyebrow">${esc(title)} · Friends</p>
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
  function promptJoin (gameType) {
    const title = (root.ULTIMATE_MINI_GAME_TITLES && root.ULTIMATE_MINI_GAME_TITLES[gameType]) || 'Penalty Clash'
    const el = modal(`
      <p class="eyebrow">${esc(title)} · Friends</p>
      <h2 class="peer-title">Join a friend</h2>
      <p class="peer-sub">Enter the room code your friend shared.</p>
      <input class="peer-input" id="peerJoinCode" placeholder="e.g. k7m2ph" autocomplete="off">
      <div class="peer-actions">
        <button class="secondary-button" id="peerCancel" type="button">Cancel</button>
        <button class="primary-button" id="peerJoinGo" type="button">Join match</button>
      </div>`)
    el.querySelector('#peerCancel').onclick = closeModal
    el.querySelector('#peerJoinGo').onclick = () => {
      const code = (el.querySelector('#peerJoinCode').value || '').trim().toLowerCase()
      if (code) join(code, gameType)
    }
  }

  function isActive () { return PM.active && PM.started && !PM.over }

  root.PearCupPeerMatch = {
    host, join, promptJoin, onZone, isActive, leave, render, reset, _state: PM,
    predictionPick, predictionReveal, predictionNextRound,
    triviaPick, triviaReveal, triviaNextQuestion,
    freeKickPick, freeKickReveal, freeKickDive, freeKickNextRound,
    buzzerPick, buzzerDefend, buzzerReveal, buzzerNextRound,
    aceServePick, aceServeReturn, aceServeReveal, aceServeNextRound,
    homeRunSwing, homeRunPitch, homeRunReveal, homeRunNextRound
  }
  syncDiagnostics('idle')
  markModule('ready')
})(typeof window !== 'undefined' ? window : globalThis)
