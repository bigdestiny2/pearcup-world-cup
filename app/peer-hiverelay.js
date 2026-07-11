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
  const MAX_PENDING = 16
  const MAX_SEEN = 512
  const MAX_AGE_MS = 90 * 1000
  const ACK_AGE_MS = 30 * 1000
  const RESEND_MS = 1500
  const MIN_SEND_GAP_MS = 900
  const MAX_ATTEMPTS = 6
  const MAX_RATE_RETRIES = 3
  const MAX_CLOCK_SKEW_MS = 30 * 1000
  const TURN_FRAME_TYPES = new Set(['commit', 'dive', 'reveal', 'nudge'])

  let identityPromise = null
  const relaySessionPromises = new Map()

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

  function hasPearRuntime (rootObject) {
    if (rootObject && rootObject.Pear) return true
    // Pear injects its runtime object into the top renderer. Same-origin child
    // frames (including the packaged two-client readiness guest) share the
    // native HTTP bridge but do not receive their own `Pear` global.
    try {
      return Boolean(rootObject && rootObject.parent && rootObject.parent !== rootObject && rootObject.parent.Pear)
    } catch (err) {
      return false
    }
  }

  function relaySettings (rootObject = root) {
    const runtime = rootObject && rootObject.PearCupRuntimeSettingsValue
    const publicSettings = rootObject && rootObject.PearCupPublicRuntimeSettings
    const override = rootObject && rootObject.PearCupPeerNetOptions && rootObject.PearCupPeerNetOptions.hiveRelay
    const configured = override || (runtime && runtime.peerRelay) || (publicSettings && publicSettings.peerRelay)
    if (!configured || configured.enabled === false) return null
    let relayUrl = normalizeRelayUrl(configured.relayUrl || configured.url)
    // Pear Runtime renderers cannot fetch arbitrary HTTPS origins directly.
    // The native entrypoint exposes a narrow same-origin proxy for exactly the
    // public HiveRelay routes used here; browser and PearBrowser builds keep
    // calling the configured Cloudflare endpoint directly.
    if (rootObject && hasPearRuntime(rootObject) && rootObject.location) {
      try {
        const proxy = new URL('/pearcup-hiverelay', rootObject.location.href)
        const localHttp = proxy.protocol === 'http:' && localHttpHost(proxy.hostname)
        if (proxy.protocol === 'https:' || localHttp) relayUrl = proxy.href.replace(/\/+$/, '')
      } catch (err) {}
    }
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
    const active = { token: '', channelId: '', relayUrl: '', eventSource: null, identity: null, closed: false, fallback: null, seq: 0, resendTimer: null, lastFlushAt: 0, backoffUntil: 0 }
    const pendingByKey = new Map()

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

    // OutboxLog replays remembered descriptors through synthetic `cache-*`
    // sources. They are useful input for a late joiner, but they are not live
    // channels and must never enter the recipient set or receive an ACK. Doing
    // either writes another descriptor back into the replay log and creates a
    // request-amplifying feedback loop on shared lobby/pool topics.
    function isReplayPeer (peerId) {
      return typeof peerId === 'string' && /^cache-[a-z0-9-]+$/i.test(peerId)
    }

    function wait (ms) {
      return new Promise(resolve => rootObject.setTimeout(resolve, ms))
    }

    function retryAfterMs (response, attempt) {
      let seconds = 0
      try { seconds = Number(response && response.headers && response.headers.get('retry-after')) || 0 } catch (err) {}
      return Math.min(15_000, Math.max(1_500, seconds * 1000 || 1500 * Math.pow(2, attempt)))
    }

    async function request (path, init = {}, attempt = 0) {
      const fetchFn = opts.fetch || rootObject.fetch
      if (typeof fetchFn !== 'function') throw new Error('fetch is unavailable')
      const headers = { ...(init.headers || {}) }
      if (active.token) headers['X-Pear-Token'] = active.token
      const response = await fetchFn(endpoint(path), { ...init, headers })
      let body = null
      try { body = await response.json() } catch (err) {}
      if (response.status === 429 && attempt < MAX_RATE_RETRIES && !active.closed) {
        const delay = retryAfterMs(response, attempt)
        active.backoffUntil = Math.max(active.backoffUntil, Date.now() + delay)
        setStatus('backoff', `relay rate limit at ${path}; retrying in ${Math.ceil(delay / 1000)}s`)
        await wait(delay)
        return request(path, init, attempt + 1)
      }
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
      const now = Date.now()
      if (now < active.backoffUntil || now - active.lastFlushAt < MIN_SEND_GAP_MS) return
      // Presence/housekeeping frames can accumulate while a renderer is
      // reconnecting. Always give the current penalty-turn frames the next
      // relay slot so a stale lobby heartbeat cannot starve commit → dive →
      // reveal delivery on a busy OutboxLog channel.
      const entries = [...pending.values()]
      entries.sort((a, b) => {
        const aTurn = a.frame && a.frame.body && TURN_FRAME_TYPES.has(a.frame.body.t)
        const bTurn = b.frame && b.frame.body && TURN_FRAME_TYPES.has(b.frame.body.t)
        return Number(bTurn) - Number(aTurn)
      })
      for (const entry of entries) {
        if (entry.frame.expiresAt < now || entry.attempts >= MAX_ATTEMPTS) {
          pending.delete(entry.frame.id)
          if (entry.key && pendingByKey.get(entry.key) === entry.frame.id) pendingByKey.delete(entry.key)
          continue
        }
        // A room host commonly announces before anyone has opened an invite.
        // Do not spend its bounded retry budget until HiveRelay has actually
        // reported a recipient channel.
        if (peers.size === 0) continue
        entry.attempts += 1
        active.lastFlushAt = now
        broadcastFrame(entry.frame)
        // Send at most one application frame per flush. This avoids a burst of
        // stale presence frames when a peer returns after being offline.
        break
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
        const entry = pending.get(frame.ack)
        pending.delete(frame.ack)
        if (entry && entry.key && pendingByKey.get(entry.key) === frame.ack) pendingByKey.delete(entry.key)
        return
      }
      if (!isReplayPeer(peerId)) acknowledge(peerId, frame.id).catch(() => {})
      if (!wasSeen) emit(frame.body)
    }

    function handleRelayEvent (event) {
        let message
        try { message = JSON.parse(event.data) } catch (err) { return }
        if (!message || active.closed || active.fallback) return
        if (message.type === 'peer' && message.peerId && !isReplayPeer(message.peerId)) {
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
    function handleRelayError () {
        if (!active.closed && !active.fallback) setStatus('reconnecting', 'relay event stream reconnecting')
      }

    // Pear Runtime's web view does not provide EventSource, but it does provide
    // fetch() and a streaming response body. Consume the same SSE contract over
    // that path so normal browsers, PearBrowser, and Pear Runtime stay on the
    // shared HiveRelay transport instead of silently falling back locally.
    function openFetchEvents (eventUrl) {
      const fetchFn = opts.fetch || rootObject.fetch
      if (typeof fetchFn !== 'function') throw new Error('fetch is unavailable for relay events')
      const AbortCtor = rootObject.AbortController || (typeof AbortController === 'function' ? AbortController : null)
      const controller = AbortCtor ? new AbortCtor() : null
      let closed = false
      active.eventSource = {
        close () {
          closed = true
          try { if (controller) controller.abort() } catch (err) {}
        }
      }
      ;(async () => {
        try {
          const response = await fetchFn(eventUrl, controller ? { signal: controller.signal } : {})
          if (!response || !response.ok || !response.body || typeof response.body.getReader !== 'function') {
            throw new Error('relay SSE streaming is unavailable')
          }
          const reader = response.body.getReader()
          const decoder = decoderFor(rootObject)
          let buffer = ''
          while (!closed && !active.closed && !active.fallback) {
            const chunk = await reader.read()
            if (!chunk || chunk.done) break
            buffer += decoder.decode(chunk.value, { stream: true })
            let boundary
            while ((boundary = buffer.search(/\r?\n\r?\n/)) >= 0) {
              const block = buffer.slice(0, boundary)
              buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, '')
              const data = block.split(/\r?\n/)
                .filter(line => line.startsWith('data:'))
                .map(line => line.slice(5).replace(/^ /, ''))
                .join('\n')
              if (data) handleRelayEvent({ data })
            }
          }
          try { await reader.cancel() } catch (err) {}
          if (!closed && !active.closed && !active.fallback) handleRelayError()
        } catch (err) {
          if (!closed && !active.closed && !active.fallback) handleRelayError()
        }
      })()
    }

    function openEvents () {
      const eventUrl = withQuery(endpoint('/api/swarm/events'), { channelId: active.channelId, token: active.token })
      const EventSourceCtor = opts.EventSource || rootObject.EventSource
      if (typeof EventSourceCtor !== 'function') {
        openFetchEvents(eventUrl)
        return
      }
      const source = new EventSourceCtor(eventUrl)
      active.eventSource = source
      source.onmessage = handleRelayEvent
      source.onerror = handleRelayError
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
        // A single page can open pools, lobby, watch, and match channels. They
        // are one client session and OutboxLog tokens are valid across those
        // channels, so perform one token/status handshake per relay origin.
        // This prevents a route change (or Pear's two-client self-test) from
        // bursting several identical token requests through the native proxy.
        let sessionPromise = relaySessionPromises.get(active.relayUrl)
        if (!sessionPromise) {
          sessionPromise = (async () => {
            const tokenResponse = await request('/api/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}'
            })
            if (!tokenResponse || typeof tokenResponse.token !== 'string' || !tokenResponse.token) throw new Error('HiveRelay did not issue a token')
            active.token = tokenResponse.token
            const status = await request('/api/bridge/status')
            return { token: tokenResponse.token, status }
          })()
          relaySessionPromises.set(active.relayUrl, sessionPromise)
          sessionPromise.catch(() => {
            if (relaySessionPromises.get(active.relayUrl) === sessionPromise) relaySessionPromises.delete(active.relayUrl)
          })
        }
        const session = await sessionPromise
        active.token = session.token
        const status = session.status
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
          const key = message && TURN_FRAME_TYPES.has(message.t) && Number.isInteger(Number(message.kickId))
            ? `turn:${message.t}:${Number(message.kickId)}`
            : message && (message.t === 'hello' || message.t === 'presence')
              ? `${message.t}:${String(message.room || topic)}:${String(message.sender || '')}`
              : ''
          if (key && pendingByKey.has(key)) pending.delete(pendingByKey.get(key))
          pending.set(frame.id, { frame, attempts: 0, key })
          if (key) pendingByKey.set(key, frame.id)
          while (pending.size > MAX_PENDING) {
            const oldest = pending.keys().next().value
            const entry = pending.get(oldest)
            pending.delete(oldest)
            if (entry && entry.key && pendingByKey.get(entry.key) === oldest) pendingByKey.delete(entry.key)
          }
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
        pendingByKey.clear()
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
