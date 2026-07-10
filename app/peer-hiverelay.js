// PearCup HiveRelay OutboxLog transport (pearcup-sync-v2).
//
// This is the common, relay-assisted path for ordinary browsers, PearBrowser,
// and the Pear runtime. It uses HiveRelay's public OutboxLog swarm contract:
// POST /api/token, GET /api/bridge/status, POST /api/swarm/{join,send,leave},
// and GET /api/swarm/events (SSE).
//
// The relay is an availability provider, not an authority. Every application
// frame is short-lived, signed in the client with an ephemeral Ed25519 key,
// deduplicated, and acknowledged. Wallet material and settlement never cross
// this transport.
(function attachPearCupHiveRelay (root) {
  const BACKEND = 'hiverelay-outboxlog-v2'
  const PROTOCOL = 'pearcup-sync-v2'
  const ENVELOPE_VERSION = 2
  const MAX_MESSAGE_BYTES = 12 * 1024
  const MAX_PENDING = 64
  const MAX_SEEN = 512
  const MAX_AGE_MS = 90 * 1000
  const ACK_AGE_MS = 30 * 1000
  const RESEND_MS = 1500
  const MAX_ATTEMPTS = 12
  const MAX_CLOCK_SKEW_MS = 30 * 1000

  let identityPromise = null

  function localHttpHost (host) {
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
  }

  function normalizeRelayUrl (value) {
    if (typeof value !== 'string' || !value.trim()) return ''
    try {
      const url = new URL(value.trim())
      const localHttp = url.protocol === 'http:' && localHttpHost(url.hostname)
      if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password || url.search || url.hash) return ''
      url.pathname = url.pathname.replace(/\/+$/, '') || '/'
      return url.href.replace(/\/$/, '')
    } catch {
      return ''
    }
  }

  function relaySettings (rootObject = root) {
    const runtime = rootObject && rootObject.PearCupRuntimeSettingsValue
    const publicSettings = rootObject && rootObject.PearCupPublicRuntimeSettings
    const override = rootObject && rootObject.PearCupPeerNetOptions && rootObject.PearCupPeerNetOptions.hiveRelay
    const configured = override || (runtime && runtime.peerRelay) || (publicSettings && publicSettings.peerRelay)
    if (!configured || configured.enabled === false) return null
    const relayUrl = normalizeRelayUrl(configured.relayUrl || configured.url)
    if (!relayUrl) return null
    if (configured.service && configured.service !== 'outboxlog') return null
    return { relayUrl, service: 'outboxlog', protocol: configured.protocol || PROTOCOL }
  }

  function isConfigured (rootObject = root) {
    return Boolean(relaySettings(rootObject))
  }

  function bytesToBase64 (bytes, rootObject = root) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    if (typeof rootObject.btoa === 'function') {
      let text = ''
      for (let i = 0; i < u8.length; i++) text += String.fromCharCode(u8[i])
      return rootObject.btoa(text)
    }
    if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64')
    throw new Error('base64 encoder unavailable')
  }

  function base64ToBytes (text, rootObject = root) {
    if (typeof text !== 'string' || !text || text.length > MAX_MESSAGE_BYTES * 2) throw new Error('invalid base64 frame')
    if (typeof rootObject.atob === 'function') {
      const decoded = rootObject.atob(text)
      const bytes = new Uint8Array(decoded.length)
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i)
      return bytes
    }
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(text, 'base64'))
    throw new Error('base64 decoder unavailable')
  }

  function encoderFor (rootObject = root) {
    if (typeof rootObject.TextEncoder === 'function') return new rootObject.TextEncoder()
    if (typeof TextEncoder === 'function') return new TextEncoder()
    throw new Error('text encoder unavailable')
  }

  function decoderFor (rootObject = root) {
    if (typeof rootObject.TextDecoder === 'function') return new rootObject.TextDecoder()
    if (typeof TextDecoder === 'function') return new TextDecoder()
    throw new Error('text decoder unavailable')
  }

  function randomId (rootObject = root) {
    const bytes = new Uint8Array(16)
    const crypto = rootObject.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto)
    if (crypto && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes)
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
    return bytesToBase64(bytes, rootObject).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  function stableStringify (value, depth = 0) {
    if (depth > 12) throw new Error('frame is nested too deeply')
    if (value === null) return 'null'
    if (typeof value === 'string') return JSON.stringify(value)
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('frame includes a non-finite number')
      return JSON.stringify(value)
    }
    if (Array.isArray(value)) return '[' + value.map(item => stableStringify(item, depth + 1)).join(',') + ']'
    if (typeof value === 'object') {
      const keys = Object.keys(value).sort()
      return '{' + keys.map(key => JSON.stringify(key) + ':' + stableStringify(value[key], depth + 1)).join(',') + '}'
    }
    throw new Error('frame contains an unsupported value')
  }

  function unsignedEnvelope (frame) {
    return stableStringify({
      ack: frame.ack || '',
      body: frame.body === undefined ? null : frame.body,
      expiresAt: frame.expiresAt,
      id: frame.id,
      kind: frame.kind,
      room: frame.room,
      sender: frame.sender,
      sentAt: frame.sentAt,
      seq: frame.seq,
      v: frame.v
    })
  }

  async function createIdentity (rootObject = root) {
    if (identityPromise) return identityPromise
    identityPromise = (async () => {
      const crypto = rootObject.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto)
      const subtle = crypto && crypto.subtle
      if (!subtle || typeof subtle.generateKey !== 'function') throw new Error('WebCrypto Ed25519 is required for HiveRelay sync')
      const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
      const publicRaw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey))
      if (publicRaw.byteLength !== 32) throw new Error('unexpected Ed25519 public key length')
      return {
        crypto,
        subtle,
        privateKey: pair.privateKey,
        publicKey: pair.publicKey,
        publicKeyBase64: bytesToBase64(publicRaw, rootObject)
      }
    })()
    return identityPromise
  }

  async function topicHex (topic, identity, rootObject = root) {
    const bytes = encoderFor(rootObject).encode(`${PROTOCOL}:${topic}`)
    const digest = new Uint8Array(await identity.subtle.digest('SHA-256', bytes))
    return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  function validEnvelopeShape (frame, topic, now) {
    if (!frame || typeof frame !== 'object' || frame.v !== ENVELOPE_VERSION) return false
    if (frame.room !== topic || typeof frame.id !== 'string' || !frame.id || frame.id.length > 160) return false
    if (frame.kind !== 'data' && frame.kind !== 'ack') return false
    if (typeof frame.sender !== 'string' || typeof frame.sig !== 'string') return false
    if (!Number.isInteger(frame.seq) || frame.seq < 1 || !Number.isFinite(frame.sentAt) || !Number.isFinite(frame.expiresAt)) return false
    if (frame.sentAt > now + MAX_CLOCK_SKEW_MS || frame.expiresAt < now || frame.expiresAt - frame.sentAt > MAX_AGE_MS + MAX_CLOCK_SKEW_MS) return false
    if (frame.kind === 'data' && frame.body === undefined) return false
    if (frame.kind === 'ack' && (typeof frame.ack !== 'string' || !frame.ack)) return false
    try {
      const publicKey = base64ToBytes(frame.sender, root)
      const signature = base64ToBytes(frame.sig, root)
      if (publicKey.byteLength !== 32 || signature.byteLength !== 64) return false
      return encoderFor(root).encode(stableStringify(frame)).byteLength <= MAX_MESSAGE_BYTES
    } catch {
      return false
    }
  }

  async function verifyEnvelope (frame, rootObject = root) {
    const crypto = rootObject.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto)
    const subtle = crypto && crypto.subtle
    if (!subtle) return false
    try {
      const publicKey = await subtle.importKey('raw', base64ToBytes(frame.sender, rootObject), { name: 'Ed25519' }, false, ['verify'])
      return await subtle.verify(
        { name: 'Ed25519' },
        publicKey,
        base64ToBytes(frame.sig, rootObject),
        encoderFor(rootObject).encode(unsignedEnvelope(frame))
      )
    } catch {
      return false
    }
  }

  function withQuery (url, params) {
    const parsed = new URL(url)
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && value !== '') parsed.searchParams.set(key, String(value))
    }
    return parsed.href
  }

  async function probe (settings, opts = {}) {
    const rootObject = opts.rootObject || root
    const fetchFn = opts.fetch || rootObject.fetch
    if (typeof fetchFn !== 'function') throw new Error('fetch is unavailable')
    const relayUrl = normalizeRelayUrl(settings && (settings.relayUrl || settings.url))
    if (!relayUrl) throw new Error('invalid HiveRelay URL')
    const tokenResponse = await fetchFn(relayUrl + '/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
    const tokenPayload = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenPayload || typeof tokenPayload.token !== 'string' || !tokenPayload.token) throw new Error((tokenPayload && tokenPayload.error) || 'HiveRelay token request failed')
    const statusResponse = await fetchFn(relayUrl + '/api/bridge/status', {
      headers: { 'X-Pear-Token': tokenPayload.token }
    })
    const status = await statusResponse.json()
    if (!statusResponse.ok || !status || status.ready !== true || status.service !== 'outboxlog') throw new Error('HiveRelay did not identify as an OutboxLog service')
    return { relayUrl, token: tokenPayload.token, status }
  }

  function createChannel (topic, opts = {}) {
    const rootObject = opts.rootObject || root
    const settings = opts.settings || relaySettings(rootObject)
    const fallbackFactory = typeof opts.fallback === 'function' ? opts.fallback : null
    const onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : () => {}
    const listeners = new Set()
    const peers = new Set()
    const pending = new Map()
    const seen = new Map()
    const active = { token: '', channelId: '', relayUrl: '', eventSource: null, identity: null, closed: false, fallback: null, seq: 0, resendTimer: null }

    function emit (message) {
      listeners.forEach(listener => { try { listener(message) } catch (err) {} })
    }

    function setStatus (state, detail) {
      try { onStatus({ state, detail: detail || null, backend: active.fallback ? active.fallback.backend : BACKEND }) } catch (err) {}
    }

    function rememberSeen (id) {
      if (seen.has(id)) return true
      seen.set(id, Date.now())
      while (seen.size > MAX_SEEN) seen.delete(seen.keys().next().value)
      return false
    }

    function endpoint (path) { return active.relayUrl + path }

    async function request (path, init = {}) {
      const fetchFn = opts.fetch || rootObject.fetch
      if (typeof fetchFn !== 'function') throw new Error('fetch is unavailable')
      const headers = { ...(init.headers || {}) }
      if (active.token) headers['X-Pear-Token'] = active.token
      const response = await fetchFn(endpoint(path), { ...init, headers })
      let body = null
      try { body = await response.json() } catch (err) {}
      if (!response.ok) throw new Error((body && body.error) || `HiveRelay request failed (${response.status})`)
      return body
    }

    async function post (path, body) {
      return request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      })
    }

    async function signFrame (kind, body, ack, ageMs) {
      const now = Date.now()
      const frame = {
        v: ENVELOPE_VERSION,
        id: randomId(rootObject),
        room: topic,
        sender: active.identity.publicKeyBase64,
        seq: ++active.seq,
        sentAt: now,
        expiresAt: now + ageMs,
        kind,
        body: kind === 'data' ? body : null,
        ack: ack || ''
      }
      const signature = await active.identity.subtle.sign(
        { name: 'Ed25519' },
        active.identity.privateKey,
        encoderFor(rootObject).encode(unsignedEnvelope(frame))
      )
      frame.sig = bytesToBase64(new Uint8Array(signature), rootObject)
      if (encoderFor(rootObject).encode(stableStringify(frame)).byteLength > MAX_MESSAGE_BYTES) throw new Error('peer message is too large for HiveRelay sync')
      return frame
    }

    async function sendToPeer (peerId, frame) {
      if (!active.channelId || !peerId || active.closed || active.fallback) return
      const encoded = bytesToBase64(encoderFor(rootObject).encode(JSON.stringify(frame)), rootObject)
      await post('/api/swarm/send', { channelId: active.channelId, peerId, data: encoded })
    }

    function broadcastFrame (frame) {
      for (const peerId of peers) sendToPeer(peerId, frame).catch(() => {})
    }

    function flushPending () {
      for (const entry of pending.values()) {
        if (entry.frame.expiresAt < Date.now() || entry.attempts >= MAX_ATTEMPTS) {
          pending.delete(entry.frame.id)
          continue
        }
        // A room host commonly announces before anyone has opened an invite.
        // Do not spend its bounded retry budget until HiveRelay has actually
        // reported a recipient channel.
        if (peers.size === 0) continue
        entry.attempts += 1
        broadcastFrame(entry.frame)
      }
    }

    function startResendLoop () {
      if (active.resendTimer || typeof rootObject.setInterval !== 'function') return
      active.resendTimer = rootObject.setInterval(flushPending, RESEND_MS)
    }

    function stopResendLoop () {
      if (!active.resendTimer) return
      try { rootObject.clearInterval(active.resendTimer) } catch (err) {}
      active.resendTimer = null
    }

    async function acknowledge (peerId, id) {
      const ack = await signFrame('ack', null, id, ACK_AGE_MS)
      await sendToPeer(peerId, ack)
    }

    async function handleEnvelope (peerId, encoded) {
      let frame
      try { frame = JSON.parse(decoderFor(rootObject).decode(base64ToBytes(encoded, rootObject))) } catch (err) { return }
      if (!validEnvelopeShape(frame, topic, Date.now())) return
      if (!(await verifyEnvelope(frame, rootObject))) return
      const wasSeen = rememberSeen(frame.id)
      if (frame.kind === 'ack') {
        pending.delete(frame.ack)
        return
      }
      acknowledge(peerId, frame.id).catch(() => {})
      if (!wasSeen) emit(frame.body)
    }

    function openEvents () {
      const EventSourceCtor = opts.EventSource || rootObject.EventSource
      if (typeof EventSourceCtor !== 'function') throw new Error('EventSource is unavailable')
      const eventUrl = withQuery(endpoint('/api/swarm/events'), { channelId: active.channelId, token: active.token })
      const source = new EventSourceCtor(eventUrl)
      active.eventSource = source
      source.onmessage = event => {
        let message
        try { message = JSON.parse(event.data) } catch (err) { return }
        if (!message || active.closed || active.fallback) return
        if (message.type === 'peer' && message.peerId) {
          peers.add(message.peerId)
          flushPending()
        } else if (message.type === 'peer-leave' && message.peerId) {
          peers.delete(message.peerId)
        } else if (message.type === 'message' && message.peerId && message.data) {
          handleEnvelope(message.peerId, message.data).catch(() => {})
        } else if (message.type === 'closed') {
          setStatus('reconnecting', 'relay stream closed')
        }
      }
      source.onerror = () => {
        if (!active.closed && !active.fallback) setStatus('reconnecting', 'relay event stream reconnecting')
      }
    }

    function activateFallback (reason) {
      if (active.closed || active.fallback || !fallbackFactory) {
        setStatus('unavailable', reason)
        return
      }
      try {
        active.fallback = fallbackFactory()
        if (active.fallback && typeof active.fallback.onMessage === 'function') active.fallback.onMessage(emit)
        for (const entry of pending.values()) {
          try { active.fallback.send(entry.frame.body) } catch (err) {}
        }
        pending.clear()
        setStatus('fallback', reason)
      } catch (err) {
        setStatus('unavailable', reason)
      }
    }

    const ready = (async () => {
      try {
        const configured = settings && { ...settings, relayUrl: normalizeRelayUrl(settings.relayUrl || settings.url) }
        if (!configured || !configured.relayUrl || configured.service && configured.service !== 'outboxlog') throw new Error('HiveRelay is not configured')
        active.relayUrl = configured.relayUrl
        active.identity = await createIdentity(rootObject)
        const tokenResponse = await request('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        })
        if (!tokenResponse || typeof tokenResponse.token !== 'string' || !tokenResponse.token) throw new Error('HiveRelay did not issue a token')
        active.token = tokenResponse.token
        const status = await request('/api/bridge/status')
        if (!status || status.ready !== true || status.service !== 'outboxlog') throw new Error('selected relay is not HiveRelay OutboxLog')
        const joined = await post('/api/swarm/join', {
          topicHex: await topicHex(topic, active.identity, rootObject),
          protocol: configured.protocol || PROTOCOL,
          version: ENVELOPE_VERSION,
          server: true,
          client: true,
          appName: 'PearCup',
          reason: 'Synchronize PearCup watch parties and friend matches.'
        })
        if (!joined || typeof joined.channelId !== 'string' || !joined.channelId) throw new Error('HiveRelay did not create a room channel')
        if (active.closed) {
          try { await post('/api/swarm/leave', { channelId: joined.channelId }) } catch (err) {}
          return false
        }
        active.channelId = joined.channelId
        openEvents()
        startResendLoop()
        setStatus('connected')
        flushPending()
        return true
      } catch (err) {
        activateFallback(err && err.message ? err.message : 'HiveRelay startup failed')
        return false
      }
    })()

    return {
      topic,
      get backend () { return active.fallback ? active.fallback.backend : BACKEND },
      ready,
      send (message) {
        if (active.closed) return
        if (active.fallback) {
          try { active.fallback.send(message) } catch (err) {}
          return
        }
        // A host announces immediately after createChannel(). Wait for the
        // asynchronous token/identity handshake instead of dropping that
        // first hello (or incorrectly falling back while the key is loading).
        ready.then(async () => {
          if (active.closed) return
          if (active.fallback) {
            try { active.fallback.send(message) } catch (err) {}
            return
          }
          if (!active.identity) throw new Error('HiveRelay identity did not initialize')
          const frame = await signFrame('data', message, '', MAX_AGE_MS)
          pending.set(frame.id, { frame, attempts: 0 })
          while (pending.size > MAX_PENDING) pending.delete(pending.keys().next().value)
          flushPending()
        }).catch(err => activateFallback(err && err.message ? err.message : 'could not sign relay frame'))
      },
      onMessage (listener) {
        if (typeof listener === 'function') listeners.add(listener)
        return () => listeners.delete(listener)
      },
      close () {
        if (active.closed) return
        active.closed = true
        stopResendLoop()
        pending.clear()
        peers.clear()
        try { if (active.eventSource) active.eventSource.close() } catch (err) {}
        if (active.channelId && active.token) post('/api/swarm/leave', { channelId: active.channelId }).catch(() => {})
        try { if (active.fallback) active.fallback.close() } catch (err) {}
        listeners.clear()
      }
    }
  }

  const api = { BACKEND, PROTOCOL, normalizeRelayUrl, relaySettings, isConfigured, probe, createChannel, stableStringify }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupHiveRelay = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
