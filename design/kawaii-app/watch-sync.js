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

  const WS = { channel: null, topic: null, self: null, peers: new Map(), heartbeat: null }
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
      case 'bye': WS.peers.delete(m.from); updatePresence(); break
      case 'chat': receiveChat(m); break
      case 'react': floatReaction(m.emoji); break
      case 'challenge':
        if (m.to === selfId()) acceptChallenge(m)
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

  function challenge (peerId) {
    const peer = WS.peers.get(peerId)
    if (!peer || !root.PearCupPeerMatch) return
    const code = Net.newRoomCode()
    root.PearCupPeerMatch.host(code, true)
    send({ t: 'challenge', to: peerId, code, name: selfName(), team: selfTeam() })
  }

  function acceptChallenge (m) {
    if (!root.PearCupPeerMatch) return
    if (typeof showToast === 'function') showToast(`${esc(m.name || 'A watcher')} challenged you — joining Penalty Clash…`)
    if (typeof setView === 'function') setView('games')
    root.PearCupPeerMatch.join(m.code)
  }

  function renderChallengeList () {
    const host = $('#watchChallengeList')
    if (!host) return
    const peers = [...WS.peers.values()]
    if (!peers.length) {
      host.innerHTML = '<p class="watch-challenge-empty">No challengers in this room yet.</p>'
      return
    }
    host.innerHTML = peers.map(peer => {
      const team = typeof teamById === 'function' ? teamById(peer.team) : { flag: '⚽', name: peer.team || 'team' }
      return `
        <div class="watch-challenge-card">
          ${typeof avatarSvg === 'function' ? avatarSvg(peer.name, team, true) : ''}
          <div>
            <strong>${esc(peer.name)}</strong>
            <span>${esc(team.flag || '⚽')} watching with you</span>
          </div>
          <button class="primary-button compact-action watch-peer-challenge" data-watch-peer="${esc(peer.peerId)}" type="button">Challenge</button>
        </div>`
    }).join('')
    host.querySelectorAll('.watch-peer-challenge').forEach(btn =>
      btn.addEventListener('click', () => challenge(btn.dataset.watchPeer)))
  }

  function leave () {
    send({ t: 'bye' })
    if (WS.channel) { try { WS.channel.close() } catch (e) {} }
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

  root.PearCupWatchSync = { ensureRoom, broadcastChat, react, bindReactionBar, updatePresence, renderChallengeList, challenge, leave, peerCount: () => WS.peers.size + 1, _state: WS }
  markModule('ready')
})(typeof window !== 'undefined' ? window : globalThis)
