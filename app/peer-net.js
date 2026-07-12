// PearCup live peer transport.
//
// A minimal channel surface: { topic, backend, send(msg), onMessage(fn), close() }.
// Backends are selected in production-first order:
//   1. Configured HiveRelay OutboxLog (`pearcup-sync-v2`) for every host.
//   2. PearBrowser window.pear.swarm.v1, using drive-scoped Tier A subtopics.
//   3. Optional Pear Runtime Bare worker hyperswarm, enabled only by explicit opt-in.
//   4. BroadcastChannel for local preview and same-browser smoke tests.
//
// The game/watch code stays transport-agnostic. Topic strings match the settlement
// convention: pearcup:v1:game:<id>, pearcup:v1:watch:<id>.
(function attachPearCupPeerNet (root) {
  const GAME_TOPIC = id => `pearcup:v1:game:${id}`
  const WATCH_TOPIC = id => `pearcup:v1:watch:${id}`
  const PROTOCOL = 'pearcup.peer-net.v1'

  const hasBroadcast = typeof root.BroadcastChannel === 'function'

  function truthy (value) {
    return value === true || value === '1' || value === 'true' || value === 'yes' || value === 'on'
  }

  function bareSwarmEnabled () {
    if (truthy(root.PearCupEnableBareSwarm)) return true
    if (root.PearCupPeerNetOptions && truthy(root.PearCupPeerNetOptions.enableBareSwarm)) return true
    try {
      const params = root.location && root.location.search ? new root.URLSearchParams(root.location.search) : null
      if (params && truthy(params.get('pearcupBareSwarm'))) return true
    } catch (e) {}
    try {
      const env = root.PearCupRuntimeEnv || (root.process && root.process.env) || {}
      if (truthy(env.PEARCUP_ENABLE_BARE_SWARM) || truthy(env.PEARCUP_HYPERSWARM_ENABLED)) return true
    } catch (e) {}
    return false
  }

  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.pearcupPeerNetModule = status
    }
  }

  function setBackendLabel (label) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.pearcupPeerNet = label
    }
    if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
      try { root.dispatchEvent(new root.CustomEvent('pearcup:p2p-backend', { detail: { backend: label } })) } catch (e) {}
    }
  }

  function setBackendStatus (status) {
    const ds = root.document && root.document.documentElement && root.document.documentElement.dataset
    if (ds) {
      ds.pearcupPeerNetStatus = status && status.state ? String(status.state) : ''
      if (status && status.detail) ds.pearcupPeerNetDetail = String(status.detail).slice(0, 240)
      else delete ds.pearcupPeerNetDetail
    }
    setBackendLabel(status && status.backend ? status.backend : 'hiverelay-outboxlog-v2')
  }

  function hasPearBrowserSwarm () {
    return Boolean(root.pear && root.pear.swarm && root.pear.swarm.v1 && typeof root.pear.swarm.v1.join === 'function')
  }

  function encodeFrame (msg) {
    return new root.TextEncoder().encode(JSON.stringify(msg))
  }

  function decodeFrame (data) {
    if (typeof data === 'string') return JSON.parse(data)
    if (data && typeof data.byteLength === 'number') return JSON.parse(new root.TextDecoder().decode(data))
    if (data && data.buffer && typeof data.buffer.byteLength === 'number') return JSON.parse(new root.TextDecoder().decode(data))
    return data
  }

  function createBroadcastChannel (topic, listeners, pending, label) {
    let bc = null
    if (hasBroadcast) {
      bc = new root.BroadcastChannel(topic)
      bc.onmessage = ev => listeners.forEach(fn => { try { fn(ev.data) } catch (e) { /* listener error */ } })
    }
    setBackendLabel(label || (hasBroadcast ? 'broadcast-channel' : 'noop'))
    const api = {
      backend: hasBroadcast ? 'broadcast-channel' : 'noop',
      send (msg) { if (bc) bc.postMessage(msg) },
      close () { try { if (bc) bc.close() } catch (e) { /* already closed */ } }
    }
    while (pending && pending.length) api.send(pending.shift())
    return api
  }

  function createPearBrowserSwarmChannel (topic) {
    const listeners = new Set()
    const pending = []
    const peers = new Map()
    let joined = null
    let fallback = null
    let closed = false
    let backend = 'pearbrowser-swarm-v1'

    function emit (msg) {
      listeners.forEach(fn => { try { fn(msg) } catch (e) { /* listener error */ } })
    }

    function sendToPeer (peer, msg) {
      try { peer.send(encodeFrame(msg)) } catch (e) { /* peer may have left */ }
    }

    function flushToPeer (peer) {
      if (!peer || pending.length === 0) return
      for (const msg of pending) sendToPeer(peer, msg)
    }

    function startFallback () {
      if (closed || fallback) return
      backend = hasBroadcast ? 'broadcast-channel' : 'noop'
      fallback = createBroadcastChannel(topic, listeners, pending, backend)
    }

    ;(async () => {
      try {
        joined = await root.pear.swarm.v1.join(null, {
          subtopic: topic,
          protocol: PROTOCOL,
          version: 1,
          server: true,
          client: true,
          appName: 'PearCup',
          reason: 'Connect PearCup game and watch peers in this room.'
        })
        if (closed) {
          try { joined.destroy() } catch (e) {}
          return
        }
        setBackendLabel('pearbrowser-swarm-v1')
        joined.on('peer', peer => {
          if (!peer || closed) return
          peers.set(peer.id, peer)
          flushToPeer(peer)
        })
        joined.on('message', (peer, data) => {
          if (closed) return
          try { emit(decodeFrame(data)) } catch (e) { /* ignore malformed peer frames */ }
        })
        joined.on('peer-leave', peer => { if (peer) peers.delete(peer.id) })
        joined.on('error', err => {
          if (root.console && root.console.warn) root.console.warn('PearBrowser swarm failed, using fallback transport', err && err.message ? err.message : err)
          startFallback()
        })
        joined.on('closed', () => {
          peers.clear()
          if (!closed) startFallback()
        })
      } catch (err) {
        if (root.console && root.console.warn) root.console.warn('PearBrowser swarm unavailable, using fallback transport', err && err.message ? err.message : err)
        startFallback()
      }
    })()

    return {
      topic,
      get backend () { return fallback ? fallback.backend : backend },
      send (msg) {
        if (closed) return
        if (fallback) { fallback.send(msg); return }
        if (peers.size === 0) {
          pending.push(msg)
          if (pending.length > 32) pending.shift()
          return
        }
        peers.forEach(peer => sendToPeer(peer, msg))
      },
      onMessage (fn) { listeners.add(fn); return () => listeners.delete(fn) },
      close () {
        closed = true
        pending.length = 0
        peers.clear()
        try { if (joined) joined.destroy() } catch (e) { /* already closed */ }
        try { if (fallback) fallback.close() } catch (e) { /* already closed */ }
        listeners.clear()
      }
    }
  }

  // ---- Hyperswarm backend (cross-device) via the Bare worker, when under Pear ----
  const swarm = { pipe: null, tried: false, ready: false, buf: '', listeners: new Set(), peers: 0 }
  function initSwarm () {
    if (swarm.tried) return swarm.ready
    swarm.tried = true
    try {
      const Pear = root.Pear
      if (Pear && Pear.worker && typeof Pear.worker.run === 'function') {
        swarm.pipe = Pear.worker.run('./swarm-worker.cjs')
        swarm.pipe.on('data', d => {
          swarm.buf += (typeof d === 'string' ? d : d.toString())
          let i
          while ((i = swarm.buf.indexOf('\n')) >= 0) {
            const line = swarm.buf.slice(0, i); swarm.buf = swarm.buf.slice(i + 1)
            if (!line) continue
            try {
              const m = JSON.parse(line)
              if (m.event === 'peers') swarm.peers = m.count
              swarm.listeners.forEach(fn => { try { fn(m) } catch (e) {} })
            } catch (e) {}
          }
        })
        swarm.ready = true
      }
    } catch (e) { swarm.ready = false }
    return swarm.ready
  }
  function swarmSend (obj) { if (swarm.pipe) { try { swarm.pipe.write(JSON.stringify(obj) + '\n') } catch (e) {} } }

  function createLegacyChannel (topic) {
    // Prefer PearBrowser's native direct P2P bridge for hyper:// apps.
    if (hasPearBrowserSwarm()) return createPearBrowserSwarmChannel(topic)

    // PearBrowser's native swarm is the production P2P path. The older Bare worker
    // bridge is useful for dedicated Pear Runtime testing, but it is too heavy to
    // spawn during normal renderer boot, so it requires an explicit opt-in.
    if (bareSwarmEnabled() && initSwarm()) {
      const listeners = new Set()
      const onMsg = m => { if (m.event === 'message' && m.topic === topic) listeners.forEach(fn => { try { fn(m.data) } catch (e) {} }) }
      swarm.listeners.add(onMsg)
      swarmSend({ cmd: 'join', topic })
      setBackendLabel('hyperswarm')
      return {
        topic,
        backend: 'hyperswarm',
        send (msg) { swarmSend({ cmd: 'send', topic, data: msg }) },
        onMessage (fn) { listeners.add(fn); return () => listeners.delete(fn) },
        close () { swarm.listeners.delete(onMsg); swarmSend({ cmd: 'leave', topic }) }
      }
    }
    // Fallback: BroadcastChannel (same-origin windows/tabs — dev + same-browser play).
    const listeners = new Set()
    const fallback = createBroadcastChannel(topic, listeners, [], hasBroadcast ? 'broadcast-channel' : 'noop')
    return {
      topic,
      backend: fallback.backend,
      send (msg) { fallback.send(msg) },
      onMessage (fn) { listeners.add(fn); return () => listeners.delete(fn) },
      close () { fallback.close(); listeners.clear() }
    }
  }

  function createChannel (topic, opts = {}) {
    // HiveRelay is the one transport shared by a normal browser, PearBrowser,
    // and Pear Runtime. It is deliberately opt-in through public runtime
    // settings: a release cannot accidentally point friends at a relay.
    const HiveRelay = root.PearCupHiveRelay
    if (HiveRelay && typeof HiveRelay.isConfigured === 'function' && HiveRelay.isConfigured(root) && typeof HiveRelay.createChannel === 'function') {
      setBackendLabel(HiveRelay.BACKEND || 'hiverelay-outboxlog-v2')
      return HiveRelay.createChannel(topic, {
        rootObject: root,
        ...opts,
        fallback: () => createLegacyChannel(topic),
        onStatus: setBackendStatus
      })
    }
    return createLegacyChannel(topic)
  }

  // Human-shareable room code (invite link fragment). Twelve symbols carry
  // roughly 60 bits of entropy: short enough to read or type, while still
  // making casual room enumeration infeasible for a friendly demo match.
  function newRoomCode () {
    // The alphabet avoids ambiguous characters when read aloud. Exactly 32
    // URL-safe, easy-to-read symbols for 5-bit encoding; the trailing dash
    // avoids ambiguous 0/1/I/l/O characters.
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789-'
    const bytes = new Uint8Array(16)
    const crypto = root.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto)
    if (crypto && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes)
    else for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0
    let out = ''
    let buffer = 0
    let bits = 0
    for (const byte of bytes) {
      buffer = (buffer << 8) | byte
      bits += 8
      while (bits >= 5 && out.length < 12) {
        bits -= 5
        out += alphabet[(buffer >>> bits) & 31]
      }
    }
    return out.slice(0, 12)
  }

  function newPeerId () {
    const bytes = new Uint8Array(16)
    const crypto = root.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto)
    if (crypto && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes)
    else for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  // djb2 string hash → hex. Used for commit-reveal (anti-peek in a friendly match).
  function digest (str) {
    let h = 5381
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
    return h.toString(16).padStart(8, '0')
  }
  function commitHash (aim, nonce) { return digest(`${aim}|${nonce}`) }
  function newNonce () { return `${((Math.random() * 1e9) | 0).toString(36)}${((Math.random() * 1e9) | 0).toString(36)}` }

  const api = { GAME_TOPIC, WATCH_TOPIC, createChannel, newRoomCode, newPeerId, commitHash, newNonce, digest }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupPeerNet = api
  markModule('ready')
  setBackendLabel(hasPearBrowserSwarm() ? 'pearbrowser-swarm-v1' : (hasBroadcast ? 'broadcast-channel' : 'noop'))
})(typeof globalThis !== 'undefined' ? globalThis : window)
