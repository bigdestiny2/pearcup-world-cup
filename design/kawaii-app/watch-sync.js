// PearCup watch-party sync — shared chat, reactions, and presence between peers
// watching the same match, over the same PearCupPeerNet transport as the game.
//
// The room topic is derived from the current match (home vs away), so two friends
// watching the same live game land in the same room automatically — no code to
// exchange. Chat lines and reaction emojis broadcast to every peer; presence is a
// lightweight "here"/"bye" ping. Transport = PearBrowser swarm.v1 for published
// hyper:// apps, Pear Runtime hyperswarm, BroadcastChannel for local preview.
(function attachPearCupWatchSync (root) {
  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.pearcupWatchSyncModule = status
    }
  }

  const Net = root.PearCupPeerNet
  if (!Net) { markModule('missing-peer-net'); console.warn('PearCupPeerNet missing — watch sync disabled'); return }

  const CHALLENGE_TIMEOUT_MS = 45000
  const WS = {
    channel: null,
    topic: null,
    self: null,
    peers: new Map(),
    incoming: new Map(),
    outgoing: new Map(),
    timers: new Map(),
    heartbeat: null
  }
  const $ = s => document.querySelector(s)
  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s))

  function selfId () { return WS.self || (WS.self = Net.newPeerId()) }
  function selfName () { return (typeof state !== 'undefined' && state.username) || 'guest' }
  function selfTeam () { return (typeof state !== 'undefined' && state.team) || 'br' }

  function matchKey () {
    try {
      const st = feedState()
      const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
      return `${norm(st.home.name)}-${norm(st.away.name)}` || 'lobby'
    } catch (e) { return 'lobby' }
  }

  // Join (or re-join when the match changes) the watch room for the current game.
  function ensureRoom () {
    const topic = Net.WATCH_TOPIC(matchKey())
    if (WS.topic === topic && WS.channel) { ping(); return }
    if (WS.channel) { try { WS.channel.close() } catch (e) {} }
    clearChallenges()
    WS.peers.clear()
    WS.topic = topic
    WS.channel = Net.createChannel(topic)
    WS.channel.onMessage(onMsg)
    ping()
    updatePresence()
    // Heartbeat so peers always converge even if their initial pings crossed, and so
    // presence drops when someone goes quiet.
    if (WS.heartbeat) clearInterval(WS.heartbeat)
    WS.heartbeat = setInterval(() => { if (WS.channel) ping() }, 5000)
  }

  function send (m) { if (WS.channel) WS.channel.send({ ...m, from: selfId() }) }
  function ping () { send({ t: 'here', name: selfName(), team: selfTeam() }) }

  function onMsg (m) {
    if (!m || m.from === selfId()) return
    switch (m.t) {
      case 'here':
        if (!WS.peers.has(m.from)) { WS.peers.set(m.from, peerFromMessage(m)); ping() } // reply so they learn me
        else WS.peers.set(m.from, peerFromMessage(m))
        updatePresence(); break
      case 'bye': WS.peers.delete(m.from); clearPeerChallenges(m.from); updatePresence(); break
      case 'chat': receiveChat(m); break
      case 'react': floatReaction(m.emoji); break
      case 'challenge':
        if (m.to === selfId()) receiveChallenge(m)
        break
      case 'challenge-accept':
        if (m.to === selfId()) challengeAccepted(m)
        break
      case 'challenge-decline':
        if (m.to === selfId()) challengeDeclined(m)
        break
    }
  }

  function peerFromMessage (m) {
    return {
      peerId: m.from,
      name: m.name || 'guest',
      team: m.team || 'br'
    }
  }

  function receiveChat (m) {
    if (typeof state === 'undefined') return
    state.chat.push({ user: m.user, text: m.text, time: m.time })
    state.chat = state.chat.slice(-8)
    if ($('#chatFeed') && typeof renderWatch === 'function') renderWatch()
  }

  // Called by app.js after a local chat send.
  function broadcastChat (user, text, time) { send({ t: 'chat', user, text, time }) }

  // Local + broadcast reaction.
  function react (emoji) { floatReaction(emoji); send({ t: 'react', emoji }) }

  function floatReaction (emoji) {
    const layer = $('#reactionLayer')
    if (!layer) return
    const el = document.createElement('span')
    el.className = 'reaction-pop'
    el.textContent = emoji
    el.style.left = `${10 + Math.random() * 80}%`
    el.style.setProperty('--drift', `${(Math.random() * 60 - 30) | 0}px`)
    layer.appendChild(el)
    setTimeout(() => el.remove(), 2200)
  }

  function updatePresence () {
    const n = WS.peers.size + 1
    if (typeof state !== 'undefined') state.spectators = n
    const label = $('#wrPeers')
    if (label) label.textContent = n <= 1 ? 'Just you' : `${n} watching together`
    const count = $('#spectatorCount')
    if (count) count.textContent = `${n} peers watching`
    renderChallengeList()
  }

  function challengeIdFor (peerId, code) {
    return `${selfId()}-${peerId}-${code}-${Net.newNonce ? Net.newNonce() : Net.newRoomCode()}`
  }

  function challengeTimerKey (peerId, challengeId) {
    return `${peerId}:${challengeId}`
  }

  function clearChallengeTimer (peerId, challengeId) {
    const key = challengeTimerKey(peerId, challengeId)
    const timer = WS.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      WS.timers.delete(key)
    }
  }

  function clearChallenges () {
    WS.timers.forEach(timer => clearTimeout(timer))
    WS.timers.clear()
    WS.incoming.clear()
    WS.outgoing.clear()
  }

  function clearPeerChallenges (peerId) {
    const incoming = WS.incoming.get(peerId)
    const outgoing = WS.outgoing.get(peerId)
    if (incoming) clearChallengeTimer(peerId, incoming.challengeId)
    if (outgoing) clearChallengeTimer(peerId, outgoing.challengeId)
    WS.incoming.delete(peerId)
    WS.outgoing.delete(peerId)
  }

  function resetSilentHostedMatch (code) {
    if (!root.PearCupPeerMatch || !root.PearCupPeerMatch._state) return
    const match = root.PearCupPeerMatch._state
    if (match.active && !match.started && match.code === code && typeof root.PearCupPeerMatch.reset === 'function') {
      root.PearCupPeerMatch.reset()
    }
  }

  function armChallengeTimeout (peerId, challengeId, code) {
    clearChallengeTimer(peerId, challengeId)
    const key = challengeTimerKey(peerId, challengeId)
    const timer = setTimeout(() => {
      const pending = WS.outgoing.get(peerId)
      if (!pending || pending.challengeId !== challengeId || pending.status !== 'sent') return
      WS.outgoing.delete(peerId)
      WS.timers.delete(key)
      resetSilentHostedMatch(code)
      if (typeof showToast === 'function') showToast(`${esc(pending.name || 'Watcher')} did not answer the Penalty Clash challenge.`)
      renderChallengeList()
    }, CHALLENGE_TIMEOUT_MS)
    WS.timers.set(key, timer)
  }

  function challenge (peerId) {
    const peer = WS.peers.get(peerId)
    if (!peer) return
    if (!root.PearCupPeerMatch) {
      if (typeof showToast === 'function') showToast('Penalty Clash is still loading.')
      return
    }
    const code = Net.newRoomCode()
    const challengeId = challengeIdFor(peerId, code)
    WS.outgoing.set(peerId, {
      peerId,
      challengeId,
      code,
      name: peer.name,
      team: peer.team,
      status: 'sent'
    })
    root.PearCupPeerMatch.host(code, true)
    send({ t: 'challenge', to: peerId, challengeId, code, name: selfName(), team: selfTeam() })
    armChallengeTimeout(peerId, challengeId, code)
    renderChallengeList()
  }

  function receiveChallenge (m) {
    if (!m || !m.code) return
    const busy = root.PearCupPeerMatch && root.PearCupPeerMatch._state && root.PearCupPeerMatch._state.active
    if (busy) {
      send({ t: 'challenge-decline', to: m.from, challengeId: m.challengeId, code: m.code, name: selfName(), reason: 'busy' })
      return
    }
    WS.peers.set(m.from, peerFromMessage(m))
    WS.incoming.set(m.from, {
      peerId: m.from,
      challengeId: m.challengeId || `${m.from}-${m.code}`,
      code: m.code,
      name: m.name || 'A watcher',
      team: m.team || 'br'
    })
    if (typeof showToast === 'function') showToast(`${esc(m.name || 'A watcher')} challenged you to Penalty Clash.`)
    renderChallengeList()
  }

  function acceptChallenge (peerId) {
    const invite = WS.incoming.get(peerId)
    if (!invite) return
    if (!root.PearCupPeerMatch) return
    WS.incoming.delete(peerId)
    send({ t: 'challenge-accept', to: peerId, challengeId: invite.challengeId, code: invite.code, name: selfName(), team: selfTeam() })
    if (typeof showToast === 'function') showToast(`Joining ${esc(invite.name || 'watcher')} for Penalty Clash.`)
    if (typeof setView === 'function') setView('games')
    root.PearCupPeerMatch.join(invite.code)
    renderChallengeList()
  }

  function declineChallenge (peerId) {
    const invite = WS.incoming.get(peerId)
    if (!invite) return
    WS.incoming.delete(peerId)
    send({ t: 'challenge-decline', to: peerId, challengeId: invite.challengeId, code: invite.code, name: selfName(), reason: 'declined' })
    if (typeof showToast === 'function') showToast(`Declined ${esc(invite.name || 'watcher')}'s Penalty Clash challenge.`)
    renderChallengeList()
  }

  function challengeAccepted (m) {
    const pending = WS.outgoing.get(m.from)
    if (!pending || (m.challengeId && pending.challengeId !== m.challengeId)) return
    pending.status = 'accepted'
    clearChallengeTimer(m.from, pending.challengeId)
    if (typeof showToast === 'function') showToast(`${esc(m.name || pending.name || 'Watcher')} accepted - opening Penalty Clash.`)
    renderChallengeList()
  }

  function challengeDeclined (m) {
    const pending = WS.outgoing.get(m.from)
    if (!pending || (m.challengeId && pending.challengeId !== m.challengeId)) return
    WS.outgoing.delete(m.from)
    clearChallengeTimer(m.from, pending.challengeId)
    resetSilentHostedMatch(pending.code)
    const reason = m.reason === 'busy' ? 'is already in a match' : 'declined'
    if (typeof showToast === 'function') showToast(`${esc(m.name || pending.name || 'Watcher')} ${reason} the Penalty Clash challenge.`)
    renderChallengeList()
  }

  function renderChallengeList () {
    const host = $('#watchChallengeList')
    if (!host) return
    const peerMap = new Map(WS.peers)
    WS.incoming.forEach((invite, peerId) => {
      if (!peerMap.has(peerId)) peerMap.set(peerId, { peerId, name: invite.name, team: invite.team })
    })
    const peers = [...peerMap.values()]
    if (!peers.length) {
      host.innerHTML = `
        <div class="watch-challenge-empty">
          <strong>Just you in this watch room.</strong>
          <span>Friends who open this same match appear here as challengeable players.</span>
          ${typeof toggleInviteBar === 'function' ? '<button class="secondary-button compact-action" id="watchRoomInviteBtn" type="button">Invite watcher</button>' : ''}
        </div>`
      const invite = $('#watchRoomInviteBtn')
      if (invite) invite.addEventListener('click', () => toggleInviteBar())
      return
    }
    host.innerHTML = peers.map(peer => {
      const team = typeof teamById === 'function' ? teamById(peer.team) : { flag: '⚽', name: peer.team || 'team' }
      const incoming = WS.incoming.get(peer.peerId)
      const outgoing = WS.outgoing.get(peer.peerId)
      const detail = incoming
        ? 'challenged you to Penalty Clash'
        : outgoing && outgoing.status === 'accepted'
          ? 'accepted - opening game'
          : outgoing
            ? 'waiting for accept'
            : `${esc(team.flag || '⚽')} watching with you`
      const actions = incoming
        ? `<div class="watch-challenge-actions">
            <button class="primary-button compact-action watch-peer-accept" data-watch-accept="${esc(peer.peerId)}" type="button">Accept</button>
            <button class="secondary-button compact-action watch-peer-decline" data-watch-decline="${esc(peer.peerId)}" type="button">Decline</button>
          </div>`
        : outgoing
          ? '<button class="secondary-button compact-action watch-peer-waiting" type="button" disabled>Waiting</button>'
          : `<button class="primary-button compact-action watch-peer-challenge" data-watch-peer="${esc(peer.peerId)}" type="button">Challenge</button>`
      return `
        <div class="watch-challenge-card ${incoming ? 'is-incoming' : outgoing ? 'is-pending' : ''}">
          ${typeof avatarSvg === 'function' ? avatarSvg(peer.name, team, true) : ''}
          <div>
            <strong>${esc(peer.name)}</strong>
            <span>${detail}</span>
          </div>
          ${actions}
        </div>`
    }).join('')
    host.querySelectorAll('.watch-peer-challenge').forEach(btn =>
      btn.addEventListener('click', () => challenge(btn.dataset.watchPeer)))
    host.querySelectorAll('.watch-peer-accept').forEach(btn =>
      btn.addEventListener('click', () => acceptChallenge(btn.dataset.watchAccept)))
    host.querySelectorAll('.watch-peer-decline').forEach(btn =>
      btn.addEventListener('click', () => declineChallenge(btn.dataset.watchDecline)))
  }

  function leave () {
    send({ t: 'bye' })
    if (WS.channel) { try { WS.channel.close() } catch (e) {} }
    clearChallenges()
    WS.channel = null; WS.topic = null; WS.peers.clear()
  }

  function bindReactionBar () {
    const bar = $('#watchReactions')
    if (!bar || bar.dataset.bound) return
    bar.dataset.bound = '1'
    bar.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-react]')
      if (btn) react(btn.dataset.react)
    })
  }

  root.PearCupWatchSync = { ensureRoom, broadcastChat, react, bindReactionBar, updatePresence, renderChallengeList, challenge, acceptChallenge, declineChallenge, leave, peerCount: () => WS.peers.size + 1, _state: WS }
  markModule('ready')
})(typeof window !== 'undefined' ? window : globalThis)
