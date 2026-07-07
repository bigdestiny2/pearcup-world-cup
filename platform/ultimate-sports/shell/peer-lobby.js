// PearCup real matchmaking lobby.
//
// Every open client announces itself on a shared lobby topic and listens for others,
// so the "open challenges" list is LIVE peers — not hardcoded bots. Challenge a peer
// and both drop into a P2P penalty match on a shared game code (via PearCupPeerMatch).
// Transport = PearCupPeerNet (PearBrowser swarm.v1 for published hyper:// apps,
// Pear Runtime hyperswarm, BroadcastChannel for local preview; topic `pearcup:v1:lobby`).
// Presence uses a heartbeat + stale timeout.
(function attachPearCupLobby (root) {
  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.pearcupPeerLobbyModule = status
    }
  }

  const Net = root.PearCupPeerNet
  if (!Net) { markModule('missing-peer-net'); console.warn('PearCupPeerNet missing — matchmaking disabled'); return }

  const LOBBY_TOPIC = 'pearcup:v1:lobby'
  const HEARTBEAT_MS = 4000
  const STALE_MS = 12000

  const L = { channel: null, self: null, peers: new Map(), authNonces: new Map(), heartbeat: null, sweeper: null }
  const $ = s => document.querySelector(s)
  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s))

  function selfId () { return L.self && L.self.peerId }

  function ensureSelf () {
    if (!L.self) L.self = { peerId: Net.newPeerId(), name: (typeof state !== 'undefined' && state.username) || 'captain', team: (typeof state !== 'undefined' && state.team) || 'br' }
    else { L.self.name = state.username || L.self.name; L.self.team = state.team || L.self.team }
    return L.self
  }

  // Join the lobby topic + start announcing. Idempotent.
  function join () {
    ensureSelf()
    if (!L.channel) {
      L.channel = Net.createChannel(LOBBY_TOPIC)
      L.channel.onMessage(onMsg)
    }
    announce()
    renderList()
    // Heartbeat: re-announce AND re-render so peers converge even if pings crossed
    // and the list reflects the current roster regardless of message timing.
    if (!L.heartbeat) L.heartbeat = setInterval(() => { announce(); renderList() }, HEARTBEAT_MS)
    if (!L.sweeper) L.sweeper = setInterval(sweep, HEARTBEAT_MS)
  }

  function leave () {
    send({ t: 'gone' })
    if (L.heartbeat) { clearInterval(L.heartbeat); L.heartbeat = null }
    if (L.sweeper) { clearInterval(L.sweeper); L.sweeper = null }
    if (L.channel) { try { L.channel.close() } catch (e) {} L.channel = null }
    L.peers.clear()
  }

  function send (m) { if (L.channel) L.channel.send({ ...m, from: selfId() }) }
  function roomCredential () {
    const RA = root.PearCupRoomAccess
    return RA && typeof RA.myCredential === 'function' ? RA.myCredential() : null
  }
  function announce () {
    ensureSelf()
    send({ t: 'here', name: L.self.name, team: L.self.team, ts: nowStamp(), cred: roomCredential() })
  }
  // Wall-clock stamp — fine in the browser/Pear renderer.
  function nowStamp () { return (new Date()).getTime() }

  function sendAuthReq (toPeerId) {
    const RA = root.PearCupRoomAccess
    if (!RA || !RA.enforced || L.authNonces.has(toPeerId)) return
    const nonce = (Net && typeof Net.newNonce === 'function') ? Net.newNonce() : `${Date.now()}-${Math.random()}`
    L.authNonces.set(toPeerId, nonce)
    send({ t: 'auth-req', authNonce: nonce, to: toPeerId })
  }

  async function answerAuthReq (m) {
    const RA = root.PearCupRoomAccess
    if (!RA || typeof RA.signChallenge !== 'function') return
    const proof = await RA.signChallenge(m.authNonce)
    if (!proof) return
    ensureSelf()
    const base = roomCredential() || {}
    send({ t: 'here', name: L.self.name, team: L.self.team, ts: nowStamp(), cred: { ...base, proof, nonce: m.authNonce } })
  }

  async function verifyPeer (m) {
    const RA = root.PearCupRoomAccess
    if (!RA || !RA.enforced) return true
    if (L.peers.has(m.from)) return true // already proved ownership this session
    const cred = m && m.cred
    if (!cred || !cred.key) return false
    let authorized = cred.key === RA.ownerKey
    if (!authorized) { try { authorized = await RA.verify(cred) } catch (e) { authorized = false } }
    if (!authorized) return false
    const stored = L.authNonces.get(m.from)
    if (stored && cred.proof) {
      let ok = false
      try { ok = await RA.verifyProof(cred, stored) } catch (e) { ok = false }
      if (ok) { L.authNonces.delete(m.from); return true }
    }
    sendAuthReq(m.from)
    return false
  }

  function acceptPeer (m) {
    L.peers.set(m.from, { peerId: m.from, name: m.name || 'guest', team: m.team || 'br', last: nowStamp() })
    renderList()
  }

  function onMsg (m) {
    if (!m || m.from === selfId()) return
    switch (m.t) {
      case 'here':
        Promise.resolve(verifyPeer(m)).then(ok => {
          if (ok) acceptPeer(m)
        }).catch(() => {})
        break
      case 'auth-req':
        if (m.to === selfId()) answerAuthReq(m); break
      case 'gone':
        L.peers.delete(m.from); L.authNonces.delete(m.from); renderList(); break
      case 'challenge':
        if (m.to === selfId()) acceptChallenge(m); break
    }
  }

  function sweep () {
    const cut = nowStamp() - STALE_MS
    let changed = false
    for (const [id, p] of L.peers) if (p.last < cut) { L.peers.delete(id); changed = true }
    if (changed) renderList()
  }

  // ---- challenge flow ----
  function challenge (peerId) {
    const peer = L.peers.get(peerId)
    if (!peer || !root.PearCupPeerMatch) return
    const code = Net.newRoomCode()
    // I host the game silently, opponent auto-joins on accept.
    root.PearCupPeerMatch.host(code, true)
    send({ t: 'challenge', to: peerId, code, name: L.self.name })
  }

  function acceptChallenge (m) {
    if (!root.PearCupPeerMatch) return
    showToast(`${esc(m.name || 'A player')} challenged you — joining…`)
    if (typeof setView === 'function') setView('games')
    root.PearCupPeerMatch.join(m.code)
  }

  // ---- render the live list into the lobby ----
  function renderList () {
    const host = $('#lobbyLivePeers')
    if (!host) return
    const peers = [...L.peers.values()]
    if (!peers.length) {
      host.innerHTML = '<p class="lobby-empty">No players online yet — open PearCup in another window, or invite a friend with a code.</p>'
      return
    }
    host.innerHTML = peers.map(p => `
      <div class="lobby-card is-live-peer">
        ${typeof avatarSvg === 'function' ? avatarSvg(p.name, teamById(p.team), true) : ''}
        <div class="lobby-info">
          <strong>${esc(p.name)}</strong>
          <span>${teamById(p.team).flag} online now</span>
        </div>
        <span class="lobby-live-dot" title="online"><i></i>live</span>
        <button class="primary-button compact-action lobby-live-challenge" data-peer="${esc(p.peerId)}" type="button">Challenge</button>
      </div>`).join('')
    host.querySelectorAll('.lobby-live-challenge').forEach(btn =>
      btn.addEventListener('click', () => challenge(btn.dataset.peer)))
  }

  root.PearCupLobby = { join, leave, challenge, renderList, peerCount: () => L.peers.size, _state: L }
  markModule('ready')
})(typeof window !== 'undefined' ? window : globalThis)
