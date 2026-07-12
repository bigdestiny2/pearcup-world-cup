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
  const CHALLENGE_STAKES = [0, 5, 10, 25, 50, 100]
  const DEFAULT_CHALLENGE_STAKE = 10
  const WS = {
    channel: null,
    topic: null,
    self: null,
    peers: new Map(),
    incoming: new Map(),
    outgoing: new Map(),
    timers: new Map(),
    heartbeat: null,
    screenSharer: null
  }
  const $ = s => document.querySelector(s)
  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s))

  function selfId () { return WS.self || (WS.self = Net.newPeerId()) }
  function selfName () { return (typeof state !== 'undefined' && state.username) || 'guest' }
  function selfTeam () { return (typeof state !== 'undefined' && state.team) || 'br' }
  function selfPick () { return typeof root.currentWatchPick === 'function' ? root.currentWatchPick() : '' }

  // Challenge amounts are demo USDT today, but they still use the same wallet
  // debit/credit seam as pool entries. Keeping the allowed values small and
  // canonical prevents a crafted peer frame from smuggling a fractional or
  // unexpectedly large amount into the match state.
  function normalizeStake (value) {
    const amount = Number(value)
    if (!Number.isFinite(amount)) return 0
    const rounded = Math.round(amount * 100) / 100
    return CHALLENGE_STAKES.includes(rounded) ? rounded : 0
  }

  function stakeLabel (value) {
    const amount = normalizeStake(value)
    return amount > 0 ? `${amount} demo USDT` : 'bragging rights'
  }

  function selectedStake () {
    const picker = $('#watchChallengeStake')
    return normalizeStake(picker ? picker.value : DEFAULT_CHALLENGE_STAKE)
  }

  function walletBalance () {
    return typeof state !== 'undefined' && state.wallet ? Number(state.wallet.balance) || 0 : Infinity
  }

  function reserveStake (amount, memo) {
    const stake = normalizeStake(amount)
    if (!stake) return true
    if (typeof root.debitWallet === 'function') return Boolean(root.debitWallet(stake, memo || 'Penalty Clash stake'))
    if (typeof state === 'undefined' || !state.wallet) return true
    if (walletBalance() < stake) return false
    state.wallet.balance -= stake
    return true
  }

  function refundStake (pending, label) {
    if (!pending || pending.refunded || !pending.debited) return
    pending.refunded = true
    const stake = normalizeStake(pending.stake)
    if (!stake) return
    if (typeof state !== 'undefined' && state.wallet) state.wallet.balance += stake
    if (typeof root.walletLog === 'function') root.walletLog(label || 'Penalty Clash stake returned', stake, 'credit')
    if (typeof root.persist === 'function') root.persist()
    if (typeof root.refreshWallet === 'function') root.refreshWallet()
  }

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
    clearPeers('room-change')
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
  function ping () { send({ t: 'here', name: selfName(), team: selfTeam(), pick: selfPick() }) }

  const screenShareListeners = new Set()
  const peerJoinListeners = new Set()
  const peerLeaveListeners = new Set()
  const triviaListeners = new Set()
  const voiceListeners = new Set()

  function notifyPeerLeft (peerId, peer, reason) {
    if (WS.screenSharer && WS.screenSharer.peerId === peerId) WS.screenSharer = null
    peerLeaveListeners.forEach(fn => { try { fn(peerId, peer, reason) } catch (e) {} })
  }

  function clearPeers (reason) {
    WS.peers.forEach((peer, peerId) => notifyPeerLeft(peerId, peer, reason))
    WS.peers.clear()
  }

  function onScreenShareMsg (m) {
    const peer = WS.peers.get(m.from)
    const name = peer ? peer.name : (m.name || 'A watcher')
    if (m.t === 'screen:start') WS.screenSharer = { peerId: m.from, name }
    if (m.t === 'screen:stop' && WS.screenSharer && WS.screenSharer.peerId === m.from) WS.screenSharer = null
    screenShareListeners.forEach(fn => { try { fn(m, peer) } catch (e) {} })
  }

  function onMsg (m) {
    if (!m || m.from === selfId()) return
    switch (m.t) {
      case 'here': {
        const isNew = !WS.peers.has(m.from)
        if (isNew) { WS.peers.set(m.from, peerFromMessage(m)); ping() } // reply so they learn me
        else WS.peers.set(m.from, peerFromMessage(m))
        if (isNew) peerJoinListeners.forEach(fn => { try { fn(m.from, peerFromMessage(m)) } catch (e) {} })
        updatePresence(); break
      }
      case 'bye': {
        const peer = WS.peers.get(m.from)
        WS.peers.delete(m.from)
        clearPeerChallenges(m.from)
        notifyPeerLeft(m.from, peer, 'bye')
        updatePresence()
        break
      }
      case 'chat': receiveChat(m); break
      case 'react': floatReaction(m.emoji); break
      case 'trivia:round':
      case 'trivia:answer':
      case 'trivia:reveal':
      case 'trivia:clear':
        triviaListeners.forEach(fn => { try { fn(m) } catch (e) {} })
        break
      case 'voice:ready':
      case 'voice:state':
      case 'voice:leave':
      case 'voice:offer':
      case 'voice:answer':
      case 'voice:ice':
        // SDP/ICE can be sensitive, so this layer only forwards targeted frames
        // to the intended watcher. Audio itself never travels through this swarm
        // channel; WebRTC carries the encrypted media stream directly.
        if (!m.to || m.to === selfId()) voiceListeners.forEach(fn => { try { fn(m, WS.peers.get(m.from)) } catch (e) {} })
        break
      case 'challenge':
        if (m.to === selfId()) receiveChallenge(m)
        break
      case 'challenge-accept':
        if (m.to === selfId()) challengeAccepted(m)
        break
      case 'challenge-decline':
        if (m.to === selfId()) challengeDeclined(m)
        break
      case 'screen:start':
      case 'screen:stop':
      case 'screen:offer':
      case 'screen:answer':
      case 'screen:ice':
        onScreenShareMsg(m)
        break
    }
  }

  function peerFromMessage (m) {
    return {
      peerId: m.from,
      name: m.name || 'guest',
      team: m.team || 'br',
      pick: m.pick || ''
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

  // Screen-share signaling (state + WebRTC offer/answer/ICE) over the watch topic.
  function broadcastScreen (msg) { send({ ...msg, name: selfName() }) }
  function onScreenShare (fn) { screenShareListeners.add(fn); return () => screenShareListeners.delete(fn) }
  function onPeerJoined (fn) { peerJoinListeners.add(fn); return () => peerJoinListeners.delete(fn) }
  function onPeerLeft (fn) { peerLeaveListeners.add(fn); return () => peerLeaveListeners.delete(fn) }
  function broadcastTrivia (msg) { send({ ...msg, name: selfName(), team: selfTeam() }) }
  function onTrivia (fn) { triviaListeners.add(fn); return () => triviaListeners.delete(fn) }
  function broadcastVoice (msg) { send({ ...msg, name: selfName(), team: selfTeam() }) }
  function onVoice (fn) { voiceListeners.add(fn); return () => voiceListeners.delete(fn) }
  function screenShareState () {
    return {
      sharing: Boolean(WS.screenSharer),
      sharerPeerId: WS.screenSharer && WS.screenSharer.peerId,
      sharerName: WS.screenSharer && WS.screenSharer.name
    }
  }

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
    WS.outgoing.forEach(pending => refundStake(pending, 'Penalty Clash stake returned'))
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
    if (outgoing && outgoing.status === 'sent') refundStake(outgoing, 'Penalty Clash stake returned')
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
      refundStake(pending, 'Penalty Clash stake returned')
      resetSilentHostedMatch(code)
      if (typeof showToast === 'function') showToast(`${esc(pending.name || 'Watcher')} did not answer the Penalty Clash challenge.`)
      renderChallengeList()
    }, CHALLENGE_TIMEOUT_MS)
    WS.timers.set(key, timer)
  }

  function challenge (peerId, requestedStake) {
    const peer = WS.peers.get(peerId)
    if (!peer) return
    if (WS.outgoing.has(peerId)) {
      if (typeof showToast === 'function') showToast(`A Penalty Clash challenge is already waiting for ${esc(peer.name || 'this watcher')}.`)
      return
    }
    if (!root.PearCupPeerMatch) {
      if (typeof showToast === 'function') showToast('Penalty Clash is still loading.')
      return
    }
    const code = Net.newRoomCode()
    const challengeId = challengeIdFor(peerId, code)
    const stake = normalizeStake(requestedStake == null ? selectedStake() : requestedStake)
    if (!reserveStake(stake, `Penalty Clash stake vs ${peer.name || 'watcher'}`)) {
      if (typeof showToast === 'function') showToast(`You need ${stakeLabel(stake)} available to send this challenge.`)
      return
    }
    WS.outgoing.set(peerId, {
      peerId,
      challengeId,
      code,
      name: peer.name,
      team: peer.team,
      stake,
      debited: stake > 0,
      refunded: false,
      status: 'sent'
    })
    // Record the pending invite before opening the match: the peer-match
    // module uses this as the signal to keep the watch-room relay alive until
    // the recipient's accept/deny event arrives.
    root.PearCupPeerMatch.host(code, true, { stake })
    send({ t: 'challenge', to: peerId, challengeId, code, name: selfName(), team: selfTeam(), stake, expiresAt: Date.now() + CHALLENGE_TIMEOUT_MS })
    armChallengeTimeout(peerId, challengeId, code)
    renderChallengeList()
  }

  function receiveChallenge (m) {
    if (!m || !m.code) return
    const stake = normalizeStake(m.stake)
    if (m.expiresAt && Number(m.expiresAt) <= Date.now()) {
      send({ t: 'challenge-decline', to: m.from, challengeId: m.challengeId, code: m.code, name: selfName(), reason: 'expired' })
      return
    }
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
      team: m.team || 'br',
      stake,
      expiresAt: Number(m.expiresAt) || Date.now() + CHALLENGE_TIMEOUT_MS
    })
    const remaining = Math.max(1000, (Number(m.expiresAt) || (Date.now() + CHALLENGE_TIMEOUT_MS)) - Date.now())
    clearChallengeTimer(m.from, m.challengeId || `${m.from}-${m.code}`)
    const incomingKey = challengeTimerKey(m.from, m.challengeId || `${m.from}-${m.code}`)
    const incomingTimer = setTimeout(() => {
      const invite = WS.incoming.get(m.from)
      if (!invite || invite.challengeId !== (m.challengeId || `${m.from}-${m.code}`)) return
      WS.incoming.delete(m.from)
      WS.timers.delete(incomingKey)
      send({ t: 'challenge-decline', to: m.from, challengeId: invite.challengeId, code: invite.code, name: selfName(), reason: 'expired' })
      if (typeof showToast === 'function') showToast(`The ${esc(invite.name || 'watcher')} Penalty Clash challenge expired.`)
      renderChallengeList()
    }, remaining)
    WS.timers.set(incomingKey, incomingTimer)
    if (typeof showToast === 'function') showToast(`${esc(m.name || 'A watcher')} challenged you for ${stakeLabel(stake)} in Penalty Clash.`)
    renderChallengeList()
  }

  function acceptChallenge (peerId) {
    const invite = WS.incoming.get(peerId)
    if (!invite) return
    if (!root.PearCupPeerMatch) return
    if (invite.expiresAt && invite.expiresAt <= Date.now()) {
      WS.incoming.delete(peerId)
      clearChallengeTimer(peerId, invite.challengeId)
      send({ t: 'challenge-decline', to: peerId, challengeId: invite.challengeId, code: invite.code, name: selfName(), reason: 'expired' })
      if (typeof showToast === 'function') showToast('That Penalty Clash challenge expired.')
      renderChallengeList()
      return
    }
    if (!reserveStake(invite.stake, `Penalty Clash stake vs ${invite.name || 'watcher'}`)) {
      WS.incoming.delete(peerId)
      clearChallengeTimer(peerId, invite.challengeId)
      send({ t: 'challenge-decline', to: peerId, challengeId: invite.challengeId, code: invite.code, name: selfName(), reason: 'insufficient-funds' })
      if (typeof showToast === 'function') showToast(`You need ${stakeLabel(invite.stake)} available to accept this challenge.`)
      renderChallengeList()
      return
    }
    invite.debited = invite.stake > 0
    WS.incoming.delete(peerId)
    clearChallengeTimer(peerId, invite.challengeId)
    send({ t: 'challenge-accept', to: peerId, challengeId: invite.challengeId, code: invite.code, name: selfName(), team: selfTeam(), stake: invite.stake })
    if (typeof showToast === 'function') showToast(`Joining ${esc(invite.name || 'watcher')} for Penalty Clash.`)
    if (typeof setView === 'function') setView('games')
    root.PearCupPeerMatch.join(invite.code, { stake: invite.stake })
    renderChallengeList()
  }

  function declineChallenge (peerId, reason = 'declined') {
    const invite = WS.incoming.get(peerId)
    if (!invite) return
    WS.incoming.delete(peerId)
    clearChallengeTimer(peerId, invite.challengeId)
    send({ t: 'challenge-decline', to: peerId, challengeId: invite.challengeId, code: invite.code, name: selfName(), reason })
    if (typeof showToast === 'function') showToast(`Denied ${esc(invite.name || 'watcher')}'s Penalty Clash challenge.`)
    renderChallengeList()
  }

  function challengeAccepted (m) {
    const pending = WS.outgoing.get(m.from)
    if (!pending || (m.challengeId && pending.challengeId !== m.challengeId)) return
    const acceptedStake = normalizeStake(m.stake)
    if (acceptedStake !== normalizeStake(pending.stake)) {
      refundStake(pending, 'Penalty Clash stake returned')
      WS.outgoing.delete(m.from)
      clearChallengeTimer(m.from, pending.challengeId)
      resetSilentHostedMatch(pending.code)
      if (typeof showToast === 'function') showToast('Challenge amount changed before the match could start.')
      renderChallengeList()
      return
    }
    pending.status = 'accepted'
    clearChallengeTimer(m.from, pending.challengeId)
    // The match stream is authoritative now. Close the watch transport after
    // the ACK has been applied, but retain the accepted record long enough for
    // the shell/audit surface to show the transition.
    leave(true, true)
    if (typeof showToast === 'function') showToast(`${esc(m.name || pending.name || 'Watcher')} accepted - opening Penalty Clash.`)
    // Keep the accepted transition visible briefly for diagnostics, then let
    // the same watcher challenge again after this match or a later return to
    // the watch room.
    const acceptedKey = challengeTimerKey(m.from, pending.challengeId)
    const acceptedTimer = setTimeout(() => {
      const current = WS.outgoing.get(m.from)
      if (current && current.challengeId === pending.challengeId && current.status === 'accepted') WS.outgoing.delete(m.from)
      WS.timers.delete(acceptedKey)
      renderChallengeList()
    }, 15000)
    WS.timers.set(acceptedKey, acceptedTimer)
    renderChallengeList()
  }

  function challengeDeclined (m) {
    const pending = WS.outgoing.get(m.from)
    if (!pending || (m.challengeId && pending.challengeId !== m.challengeId)) return
    WS.outgoing.delete(m.from)
    clearChallengeTimer(m.from, pending.challengeId)
    refundStake(pending, 'Penalty Clash stake returned')
    resetSilentHostedMatch(pending.code)
    const reason = m.reason === 'busy' ? 'is already in a match' : m.reason === 'insufficient-funds' ? 'does not have enough demo USDT' : m.reason === 'expired' ? 'let the challenge expire' : 'denied'
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
    const chosenStake = selectedStake()
    host.innerHTML = peers.map(peer => {
      const team = typeof teamById === 'function' ? teamById(peer.team) : { flag: '⚽', name: peer.team || 'team' }
      const incoming = WS.incoming.get(peer.peerId)
      const outgoing = WS.outgoing.get(peer.peerId)
      const stake = incoming ? incoming.stake : outgoing ? outgoing.stake : chosenStake
      const detail = incoming
        ? `challenged you for ${stakeLabel(stake)}`
        : outgoing && outgoing.status === 'accepted'
          ? `accepted · ${stakeLabel(stake)} · opening game`
          : outgoing
            ? `waiting for accept · ${stakeLabel(stake)}`
            : `${esc(team.flag || '⚽')} watching with you`
      const actions = incoming
        ? `<div class="watch-challenge-actions">
            <button class="primary-button compact-action watch-peer-accept" data-watch-accept="${esc(peer.peerId)}" type="button">Accept · ${stake > 0 ? `$${stake}` : 'Free'}</button>
            <button class="secondary-button compact-action watch-peer-decline" data-watch-decline="${esc(peer.peerId)}" type="button">Deny</button>
          </div>`
        : outgoing
          ? `<button class="secondary-button compact-action watch-peer-waiting" type="button" disabled>Waiting · ${stake > 0 ? `$${stake}` : 'Free'}</button>`
          : `<button class="primary-button compact-action watch-peer-challenge" data-watch-peer="${esc(peer.peerId)}" type="button">Challenge · ${chosenStake > 0 ? `$${chosenStake}` : 'Free'}</button>`
      return `
        <div class="watch-challenge-card ${incoming ? 'is-incoming' : outgoing ? 'is-pending' : ''}">
          ${typeof avatarSvg === 'function' ? avatarSvg(peer.name, team, true) : ''}
          <div>
            <strong>${esc(peer.name)}</strong>
            <span>${detail}</span>
            ${!incoming && !outgoing ? `<small class="watch-challenge-stake-hint">Your selected stake: ${stakeLabel(chosenStake)}</small>` : ''}
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

  function leave (silent = false, preserveAccepted = false) {
    if (!silent) send({ t: 'bye' })
    if (WS.channel) { try { WS.channel.close() } catch (e) {} }
    if (preserveAccepted) {
      WS.timers.forEach(timer => clearTimeout(timer))
      WS.timers.clear()
      WS.incoming.clear()
      for (const [peerId, pending] of WS.outgoing) {
        if (!pending || pending.status !== 'accepted') WS.outgoing.delete(peerId)
      }
    } else clearChallenges()
    if (WS.heartbeat) { clearInterval(WS.heartbeat); WS.heartbeat = null }
    clearPeers('leave')
    WS.channel = null; WS.topic = null
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

  root.PearCupWatchSync = { ensureRoom, broadcastChat, react, bindReactionBar, updatePresence, renderChallengeList, challenge, acceptChallenge, declineChallenge, leave, peerCount: () => WS.peers.size + 1, broadcastScreen, onScreenShare, onPeerJoined, onPeerLeft, screenShareState, broadcastTrivia, onTrivia, broadcastVoice, onVoice, challengeStakes: CHALLENGE_STAKES.slice(), _state: WS }
  markModule('ready')
})(typeof window !== 'undefined' ? window : globalThis)
