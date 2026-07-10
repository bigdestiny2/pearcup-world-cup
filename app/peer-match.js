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
  const PM = {
    active: false, started: false, over: false,
    channel: null, code: null,
    self: null, opp: null, role: null,
    kIndex: 0, busy: false,
    commit: null,        // {aim, nonce, power} while I'm shooting
    remoteCommit: null,  // hash received while I'm keeping
    myDive: null,
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
        root.PearCupOnPeerMatchState({
          state: currentState,
          active: Boolean(PM.active),
          started: Boolean(PM.started),
          code: PM.code || '',
          channelBackend: PM.channel && PM.channel.backend ? PM.channel.backend : ''
        })
      } catch (err) {}
    }
  }

  function reset () {
    stopAnnouncing()
    if (PM.channel) { try { PM.channel.close() } catch (e) {} }
    Object.assign(PM, {
      active: false, started: false, over: false, channel: null, code: null,
      self: null, opp: null, role: null, kIndex: 0, busy: false,
      commit: null, remoteCommit: null, myDive: null, helloTimer: null, helloAttempts: 0
    })
    syncDiagnostics('idle')
  }

  function shooterRoleForKick (k) { return k % 2 === 0 ? 'A' : 'B' } // A shoots first each round
  function iAmShooter () { return shooterRoleForKick(PM.kIndex) === PM.role }
  function roundOf (k) { return Math.floor(k / 2) }

  // ---- lifecycle ----
  function host (code, silent) {
    reset()
    PM.active = true
    PM.code = code || Net.newRoomCode()
    PM.self = { peerId: Net.newPeerId(), name: state.username || 'captain', team: state.team || 'br' }
    openChannel()
    syncDiagnostics('hosting')
    if (!silent) { showToast('Room created — invite your friend'); renderInvite() }
    else showToast('Challenge sent — waiting for them to accept…')
    startAnnouncing()
  }

  function join (code) {
    reset()
    PM.active = true
    PM.code = code
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

  function announce () { send({ t: 'hello', peer: PM.self }) }
  function send (msg) { if (PM.channel) PM.channel.send({ ...msg, room: PM.code, sender: PM.self.peerId }) }

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
      case 'hello': return onHello(msg.peer)
      case 'commit': return onCommit(msg)
      case 'dive': return onDive(msg)
      case 'reveal': return onReveal(msg)
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
