// PearCup Watch voice — low-latency PTT audio over WebRTC.
//
// Holepunch/Pear's room channel carries only small, targeted signaling frames.
// Audio stays on WebRTC's encrypted media transport; it is never sent through
// the swarm message channel. A watch room is intentionally a small mesh, so
// cap media peers and use runtime-injected TURN when a deployment provides it.
(function attachPearCupWatchVoice (root) {
  const MAX_MEDIA_PEERS = 6
  const MAX_SDP_CHARS = 100000
  const MAX_CANDIDATE_CHARS = 4096
  const AUDIO_CONSTRAINTS = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: { ideal: 1 },
    latency: { ideal: 0.02 }
  }
  const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]

  const V = {
    enabled: false,
    transmitting: false,
    gettingMicrophone: false,
    stream: null,
    peers: new Map(),
    remoteStates: new Map(),
    audioElements: new Map(),
    activeSources: new Set(),
    bound: false,
    buttonBound: false
  }
  const stateListeners = new Set()

  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.pearcupWatchVoiceModule = status
    }
  }

  function watchSync () { return root.PearCupWatchSync || null }

  function selfPeerId () {
    const sync = watchSync()
    return sync && sync._state && sync._state.self ? String(sync._state.self) : ''
  }

  function peerIsKnown (peerId) {
    const sync = watchSync()
    return Boolean(peerId && sync && sync._state && sync._state.peers && sync._state.peers.has(peerId))
  }

  function voiceSupported () {
    return Boolean(
      root.navigator && root.navigator.mediaDevices && typeof root.navigator.mediaDevices.getUserMedia === 'function' &&
      typeof root.RTCPeerConnection === 'function'
    )
  }

  function isWatchVisible () {
    const watch = root.document && root.document.querySelector ? root.document.querySelector('#watch') : null
    return !watch || !watch.classList || watch.classList.contains('is-active')
  }

  function voiceIceConfig () {
    const injected = Array.isArray(root.PearCupIceServers) && root.PearCupIceServers.length
      ? root.PearCupIceServers
      : DEFAULT_ICE_SERVERS
    return { iceServers: injected }
  }

  function toast (message) {
    if (typeof root.showToast === 'function') root.showToast(message)
  }

  function safeCall (fn) {
    try { return fn() } catch (err) { return undefined }
  }

  function broadcast (message) {
    const sync = watchSync()
    if (sync && typeof sync.broadcastVoice === 'function') sync.broadcastVoice(message)
  }

  function snapshot () {
    return {
      enabled: V.enabled,
      transmitting: V.transmitting,
      gettingMicrophone: V.gettingMicrophone,
      peerCount: V.peers.size,
      speakingPeers: [...V.remoteStates.values()].filter(state => state === 'speaking').length
    }
  }

  function emitState () {
    const next = snapshot()
    stateListeners.forEach(listener => safeCall(() => listener(next)))
    render()
  }

  function trackEnabled (enabled) {
    if (!V.stream) return
    for (const track of V.stream.getAudioTracks()) track.enabled = Boolean(enabled)
  }

  function isEditableTarget (target) {
    if (!target) return false
    if (target.isContentEditable) return true
    const name = String(target.tagName || '').toLowerCase()
    if (name === 'input' || name === 'textarea' || name === 'select') return true
    return Boolean(typeof target.closest === 'function' && target.closest('[contenteditable="true"], input, textarea, select'))
  }

  function getElement (selector) {
    return root.document && typeof root.document.querySelector === 'function'
      ? root.document.querySelector(selector)
      : null
  }

  function updateText (selector, text) {
    const element = getElement(selector)
    if (element) element.textContent = text
  }

  function render () {
    const headerButton = getElement('#voiceToggle')
    const ptt = getElement('#voicePtt')
    const panel = getElement('#watchVoice')
    const remoteSpeakers = [...V.remoteStates.values()].filter(state => state === 'speaking').length
    const supported = voiceSupported()

    if (headerButton) {
      headerButton.classList.toggle('is-live', V.enabled)
      headerButton.classList.toggle('is-ptt', V.transmitting)
      headerButton.setAttribute('aria-pressed', String(V.enabled))
      headerButton.setAttribute('aria-label', V.enabled ? 'Leave P2P voice chat' : 'Join P2P voice chat')
      headerButton.title = V.enabled ? 'Leave P2P voice chat' : 'Join P2P voice chat'
    }
    if (panel) {
      panel.classList.toggle('is-ready', V.enabled)
      panel.classList.toggle('is-transmitting', V.transmitting)
      panel.classList.toggle('is-unsupported', !supported)
    }
    if (ptt) {
      ptt.disabled = !V.enabled || !supported || V.gettingMicrophone
      ptt.classList.toggle('is-live', V.transmitting)
      ptt.setAttribute('aria-pressed', String(V.transmitting))
      ptt.setAttribute('aria-label', V.enabled ? 'Hold to talk. You can also hold Space.' : 'Join voice before using push to talk')
    }

    let status = 'Voice is off'
    let hint = 'Join voice, then hold this button or Space to talk. Your microphone stays muted until you hold it.'
    if (!supported) {
      status = 'Voice needs microphone + WebRTC support'
      hint = 'Open the room in a supported Pear runtime or browser to use P2P voice.'
    } else if (V.gettingMicrophone) {
      status = 'Requesting microphone…'
      hint = 'Approve microphone access to start push to talk. Audio stays muted until you are holding the control.'
    } else if (V.transmitting) {
      status = `Broadcasting PTT${V.peers.size ? ` · ${V.peers.size} peer${V.peers.size === 1 ? '' : 's'} connected` : ''}`
      hint = 'Release the button or Space to mute immediately.'
    } else if (V.enabled && V.stream) {
      status = remoteSpeakers ? `${remoteSpeakers} watcher${remoteSpeakers === 1 ? '' : 's'} speaking · you are muted` : 'Voice ready · you are muted'
      hint = 'Hold to talk. Releasing mutes your outgoing microphone immediately.'
    } else if (V.enabled) {
      status = remoteSpeakers ? `${remoteSpeakers} watcher${remoteSpeakers === 1 ? '' : 's'} speaking` : 'Voice ready · push to talk'
      hint = 'Hold to talk when you are ready. We only ask for microphone access on your first hold.'
    }
    updateText('#voiceStatus', status)
    updateText('#voiceHint', hint)
  }

  function ensureAudioElement (peerId, stream) {
    if (!stream) return
    let audio = V.audioElements.get(peerId)
    if (!audio) {
      audio = root.document.createElement('audio')
      audio.autoplay = true
      audio.playsInline = true
      audio.muted = false
      audio.dataset.pearcupVoicePeer = peerId
      const rack = getElement('#voiceAudioRack') || root.document.body
      if (rack && typeof rack.appendChild === 'function') rack.appendChild(audio)
      V.audioElements.set(peerId, audio)
    }
    audio.srcObject = stream
    if (typeof audio.play === 'function') Promise.resolve(audio.play()).catch(() => {})
  }

  function removeAudioElement (peerId) {
    const audio = V.audioElements.get(peerId)
    if (!audio) return
    safeCall(() => audio.pause())
    audio.srcObject = null
    safeCall(() => audio.remove())
    V.audioElements.delete(peerId)
  }

  function closePeer (peerId) {
    const entry = V.peers.get(peerId)
    if (entry) {
      if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer)
      safeCall(() => entry.pc.close())
      V.peers.delete(peerId)
    }
    V.remoteStates.delete(peerId)
    removeAudioElement(peerId)
    render()
  }

  function closeAllPeers () {
    for (const peerId of [...V.peers.keys()]) closePeer(peerId)
  }

  function serializeCandidate (candidate) {
    if (!candidate) return null
    if (typeof candidate.toJSON === 'function') return candidate.toJSON()
    return {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid == null ? null : candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex == null ? null : candidate.sdpMLineIndex,
      usernameFragment: candidate.usernameFragment == null ? undefined : candidate.usernameFragment
    }
  }

  function createPeer (peerId) {
    const existing = V.peers.get(peerId)
    if (existing) return existing
    if (!peerIsKnown(peerId) || V.peers.size >= MAX_MEDIA_PEERS) return null

    const pc = new root.RTCPeerConnection(voiceIceConfig())
    const entry = {
      peerId,
      pc,
      polite: String(selfPeerId()) < String(peerId),
      makingOffer: false,
      ignoringOffer: false,
      remoteDescriptionSet: false,
      pendingIce: [],
      negotiationQueued: false,
      handlingRemote: false,
      disconnectTimer: null
    }
    V.peers.set(peerId, entry)

    pc.onicecandidate = event => {
      const candidate = serializeCandidate(event && event.candidate)
      if (candidate) broadcast({ t: 'voice:ice', to: peerId, candidate })
    }
    pc.ontrack = event => {
      const stream = event && event.streams && event.streams[0]
      if (stream) ensureAudioElement(peerId, stream)
    }
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'failed' || state === 'closed') closePeer(peerId)
      if (state === 'disconnected') {
        if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer)
        entry.disconnectTimer = setTimeout(() => {
          if (pc.connectionState === 'disconnected') closePeer(peerId)
        }, 8000)
      } else if (entry.disconnectTimer) {
        clearTimeout(entry.disconnectTimer)
        entry.disconnectTimer = null
      }
    }
    pc.onnegotiationneeded = () => { queueNegotiation(entry) }
    addLocalTrack(entry)
    return entry
  }

  function addLocalTrack (entry) {
    if (!entry || !V.stream) return
    const senders = typeof entry.pc.getSenders === 'function' ? entry.pc.getSenders() : []
    for (const track of V.stream.getAudioTracks()) {
      if (!senders.some(sender => sender && sender.track === track)) entry.pc.addTrack(track, V.stream)
    }
  }

  function addLocalTrackToKnownPeers () {
    const sync = watchSync()
    if (!sync || !sync._state || !sync._state.peers) return
    for (const peerId of sync._state.peers.keys()) {
      const entry = createPeer(peerId)
      if (entry) addLocalTrack(entry)
    }
  }

  async function negotiate (entry) {
    if (!V.enabled || !entry || !V.peers.has(entry.peerId) || entry.pc.signalingState !== 'stable') return
    try {
      entry.makingOffer = true
      const offer = await entry.pc.createOffer()
      if (!V.enabled || entry.pc.signalingState !== 'stable') return
      await entry.pc.setLocalDescription(offer)
      if (entry.pc.localDescription) {
        broadcast({ t: 'voice:offer', to: entry.peerId, description: entry.pc.localDescription })
      }
    } catch (err) {
      // The peer may have left while renegotiating. State cleanup happens through
      // the connection-state handler or the next presence heartbeat.
    } finally {
      entry.makingOffer = false
    }
  }

  function queueNegotiation (entry) {
    if (!entry || entry.negotiationQueued) return
    if (entry.handlingRemote) return
    entry.negotiationQueued = true
    Promise.resolve().then(async () => {
      entry.negotiationQueued = false
      await negotiate(entry)
    })
  }

  function validDescription (description) {
    return Boolean(
      description &&
      (description.type === 'offer' || description.type === 'answer') &&
      typeof description.sdp === 'string' &&
      description.sdp.length > 0 &&
      description.sdp.length <= MAX_SDP_CHARS
    )
  }

  function validCandidate (candidate) {
    return Boolean(candidate && typeof candidate.candidate === 'string' && candidate.candidate.length <= MAX_CANDIDATE_CHARS)
  }

  async function flushPendingIce (entry) {
    if (!entry.remoteDescriptionSet || entry.ignoringOffer) return
    const queued = entry.pendingIce.splice(0)
    for (const candidate of queued) {
      try { await entry.pc.addIceCandidate(candidate) } catch (err) {}
    }
  }

  async function handleDescription (message) {
    const description = message.description
    if (!validDescription(description) || !V.enabled) return
    const entry = createPeer(message.from)
    if (!entry) return
    const pc = entry.pc
    const offerCollision = description.type === 'offer' && (entry.makingOffer || pc.signalingState !== 'stable')
    entry.ignoringOffer = !entry.polite && offerCollision
    if (entry.ignoringOffer) return

    try {
      entry.handlingRemote = true
      if (offerCollision && entry.polite && pc.signalingState !== 'stable') {
        await pc.setLocalDescription({ type: 'rollback' })
      }
      await pc.setRemoteDescription(description)
      entry.remoteDescriptionSet = true
      await flushPendingIce(entry)
      if (description.type === 'offer') {
        addLocalTrack(entry)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        if (pc.localDescription) broadcast({ t: 'voice:answer', to: message.from, description: pc.localDescription })
      }
    } catch (err) {
      // Malformed or stale SDP must not affect the room. We intentionally don't
      // log SDP or ICE material because those values can be sensitive.
    } finally {
      entry.handlingRemote = false
    }
  }

  async function handleIce (message) {
    if (!validCandidate(message.candidate) || !V.enabled) return
    const entry = createPeer(message.from)
    if (!entry || entry.ignoringOffer) return
    if (!entry.remoteDescriptionSet) {
      if (entry.pendingIce.length < 32) entry.pendingIce.push(message.candidate)
      return
    }
    try { await entry.pc.addIceCandidate(message.candidate) } catch (err) {}
  }

  function handleVoiceMessage (message) {
    if (!message || !message.from || (message.to && message.to !== selfPeerId()) || !peerIsKnown(message.from)) return
    if (message.t === 'voice:ready') {
      if (V.enabled && V.stream) {
        const entry = createPeer(message.from)
        if (entry) queueNegotiation(entry)
      }
      return
    }
    if (message.t === 'voice:state') {
      const status = ['joined', 'idle', 'speaking'].includes(message.status) ? message.status : 'idle'
      V.remoteStates.set(message.from, status)
      render()
      return
    }
    if (message.t === 'voice:leave') {
      closePeer(message.from)
      return
    }
    if (message.t === 'voice:offer' || message.t === 'voice:answer') {
      handleDescription(message)
      return
    }
    if (message.t === 'voice:ice') handleIce(message)
  }

  function stopLocalStream () {
    if (!V.stream) return
    for (const track of V.stream.getTracks()) {
      track.enabled = false
      safeCall(() => track.stop())
    }
    V.stream = null
  }

  async function ensureMicrophone () {
    if (V.stream) return V.stream
    if (V.gettingMicrophone || !voiceSupported()) return null
    V.gettingMicrophone = true
    render()
    try {
      const stream = await root.navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false })
      for (const track of stream.getAudioTracks()) {
        // The capture starts muted even when the browser gives us an enabled track.
        // It becomes live only while the user is deliberately holding PTT.
        track.enabled = false
        if (typeof track.addEventListener === 'function') {
          track.addEventListener('ended', () => {
            if (V.stream === stream) setEnabled(false, { silent: true })
          })
        }
      }
      if (!V.enabled) {
        for (const track of stream.getTracks()) safeCall(() => track.stop())
        return null
      }
      V.stream = stream
      addLocalTrackToKnownPeers()
      return stream
    } catch (err) {
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      toast(denied ? 'Microphone permission was not granted' : 'Could not start your microphone')
      return null
    } finally {
      V.gettingMicrophone = false
      render()
    }
  }

  async function pressStart (source) {
    if (!V.enabled || !voiceSupported()) return false
    V.activeSources.add(source || 'ptt')
    const stream = await ensureMicrophone()
    if (!stream || !V.enabled || V.activeSources.size === 0) return false
    trackEnabled(true)
    if (!V.transmitting) {
      V.transmitting = true
      broadcast({ t: 'voice:state', status: 'speaking', ptt: true })
    }
    addLocalTrackToKnownPeers()
    render()
    return true
  }

  function pressEnd (source) {
    if (source) V.activeSources.delete(source)
    else V.activeSources.clear()
    if (V.activeSources.size > 0) return
    trackEnabled(false)
    if (V.transmitting) broadcast({ t: 'voice:state', status: 'idle', ptt: true })
    V.transmitting = false
    render()
  }

  function forceRelease () { pressEnd() }

  function setEnabled (enabled, options = {}) {
    const next = Boolean(enabled)
    if (next === V.enabled) {
      render()
      return V.enabled
    }
    if (next && !voiceSupported()) {
      toast('Voice chat needs microphone + WebRTC support')
      render()
      return false
    }

    V.enabled = next
    const sync = watchSync()
    if (next) {
      if (sync && typeof sync.ensureRoom === 'function') sync.ensureRoom()
      broadcast({ t: 'voice:ready', ptt: true })
      broadcast({ t: 'voice:state', status: 'joined', ptt: true })
      if (!options.silent) toast('Voice ready — hold to talk')
    } else {
      pressEnd()
      broadcast({ t: 'voice:leave', ptt: true })
      closeAllPeers()
      stopLocalStream()
      if (!options.silent) toast('Left voice chat')
    }
    emitState()
    return V.enabled
  }

  function toggle () { return setEnabled(!V.enabled) }

  function bindPttButton () {
    const button = getElement('#voicePtt')
    if (!button || button.dataset.pearcupVoiceBound) return
    button.dataset.pearcupVoiceBound = '1'
    button.addEventListener('pointerdown', event => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault()
      const id = event && event.pointerId != null ? event.pointerId : 'primary'
      safeCall(() => button.setPointerCapture(id))
      pressStart(`pointer:${id}`)
    })
    const end = event => {
      const id = event && event.pointerId != null ? event.pointerId : 'primary'
      pressEnd(`pointer:${id}`)
    }
    button.addEventListener('pointerup', end)
    button.addEventListener('pointercancel', end)
    button.addEventListener('lostpointercapture', end)
    button.addEventListener('pointerleave', end)
  }

  function bind () {
    bindPttButton()
    if (V.bound) {
      render()
      return
    }
    V.bound = true
    const sync = watchSync()
    if (sync && typeof sync.onVoice === 'function') sync.onVoice(handleVoiceMessage)
    if (sync && typeof sync.onPeerJoined === 'function') {
      sync.onPeerJoined(peerId => {
        if (V.enabled) broadcast({ t: 'voice:ready', to: peerId, ptt: true })
      })
    }
    if (sync && typeof sync.onPeerLeft === 'function') sync.onPeerLeft(peerId => closePeer(peerId))

    if (typeof root.addEventListener === 'function') {
      root.addEventListener('keydown', event => {
        if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
        if (!V.enabled || !isWatchVisible() || isEditableTarget(event.target)) return
        if (typeof event.preventDefault === 'function') event.preventDefault()
        pressStart('keyboard')
      })
      root.addEventListener('keyup', event => {
        if (event.code === 'Space') pressEnd('keyboard')
      })
      root.addEventListener('blur', forceRelease)
      root.addEventListener('pagehide', () => { setEnabled(false, { silent: true }) })
    }
    if (root.document && typeof root.document.addEventListener === 'function') {
      root.document.addEventListener('visibilitychange', () => {
        if (root.document.visibilityState === 'hidden') forceRelease()
      })
    }
    render()
  }

  function onStateChange (listener) {
    if (typeof listener !== 'function') return () => {}
    stateListeners.add(listener)
    return () => stateListeners.delete(listener)
  }

  root.PearCupWatchVoice = {
    bind,
    toggle,
    setEnabled,
    pressStart,
    pressEnd,
    forceRelease,
    onStateChange,
    getState: snapshot,
    render,
    _state: V
  }
  markModule('ready')
})(typeof window !== 'undefined' ? window : globalThis)
