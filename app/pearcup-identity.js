// PearCup portable identity client.
//
// A Pear root identity is intentionally never exported or imported into a web
// page. Each installation owns a separate non-extractable Ed25519 device key;
// a passkey-authenticated account explicitly approves that device during a
// short-lived pairing ceremony. The account id is an opaque 128-bit value and
// becomes the stable player id used by the demo pool ledger.
(function attachPearCupIdentity (root) {
  const SESSION_KEY = 'pearcup-identity-session-v1'
  const DEVICE_DB = 'pearcup-identity-v1'
  const DEVICE_STORE = 'devices'
  const DEVICE_KEY = 'current'
  const textEncoder = new TextEncoder()
  const listeners = new Set()
  let current = { configured: false, account: null, session: null, device: null, pending: null, error: '' }

  function publicSettings () { return root.PearCupPublicRuntimeSettings || {} }
  function config () {
    const value = publicSettings().identity || publicSettings().portableIdentity || {}
    const raw = value && (value.apiUrl || value.url)
    try {
      const url = new URL(String(raw || ''))
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return null
      // Cloudflare preview URLs are not the WebAuthn relying-party origin.
      // Keep passkey UI off there rather than presenting a login that must
      // fail origin validation. Pear hosts and the canonical Pages hostname
      // remain eligible.
      const host = root.location && root.location.hostname || ''
      const pagesPreview = host.endsWith('.pearcup-kawaii.pages.dev') && host !== 'pearcup-kawaii.pages.dev'
      return { apiUrl: url.href.replace(/\/$/, ''), enabled: value.enabled !== false && !pagesPreview }
    } catch { return null }
  }

  function base64Url (bytes) {
    const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    let binary = ''
    for (let start = 0; start < value.length; start += 0x8000) binary += String.fromCharCode(...value.subarray(start, start + 0x8000))
    return root.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  function fromBase64Url (value) {
    const text = String(value || '')
    if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('invalid base64url value')
    const binary = root.atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4))
    return Uint8Array.from(binary, character => character.charCodeAt(0))
  }

  function notify () {
    listeners.forEach(listener => { try { listener(status()) } catch (e) {} })
  }

  function status () {
    const active = config()
    return {
      configured: Boolean(active && active.enabled),
      account: current.account ? { ...current.account } : null,
      device: current.device ? { label: current.device.label, platform: current.device.platform, id: current.device.id || '' } : null,
      pending: current.pending ? { code: current.pending.code, pairUrl: current.pending.pairUrl, expiresAt: current.pending.expiresAt, device: current.pending.device } : null,
      error: current.error || ''
    }
  }

  function saveSession (session) {
    current.session = session || null
    try {
      if (session && session.token) root.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
      else root.sessionStorage.removeItem(SESSION_KEY)
    } catch (e) {}
  }

  function restoreSession () {
    if (current.session) return current.session
    try {
      const parsed = JSON.parse(root.sessionStorage.getItem(SESSION_KEY) || 'null')
      if (parsed && typeof parsed.token === 'string' && Number(parsed.expiresAt) > Date.now()) current.session = parsed
    } catch (e) {}
    return current.session
  }

  async function request (path, init = {}) {
    const active = config()
    if (!active || !active.enabled) throw new Error('portable identity is not configured for this build')
    const headers = new Headers(init.headers || {})
    headers.set('content-type', 'application/json')
    const session = restoreSession()
    if (!headers.has('authorization')) {
      if (session && session.token) headers.set('authorization', `Bearer ${session.token}`)
      else {
        try {
          if (!current.device) current.device = await getStoredDevice()
          if (current.device && current.device.token && Number(current.device.expiresAt) > Date.now()) {
            const proof = await deviceRequestProof(current.device, path, init)
            headers.set('authorization', `Device ${current.device.token}`)
            headers.set('x-pearcup-device-time', proof.timestamp)
            headers.set('x-pearcup-device-proof', proof.signature)
          }
        } catch (e) {}
      }
    }
    const response = await root.fetch(active.apiUrl + path, { ...init, headers, credentials: 'include' })
    let payload = null
    try { payload = await response.json() } catch (e) {}
    if (!response.ok) {
      const error = new Error(payload && payload.error ? payload.error : `identity request failed (${response.status})`)
      error.status = response.status
      throw error
    }
    return payload
  }

  function fromOptionsJson (value) {
    const copy = JSON.parse(JSON.stringify(value || {}))
    if (copy.challenge) copy.challenge = fromBase64Url(copy.challenge)
    if (copy.user && copy.user.id) copy.user.id = fromBase64Url(copy.user.id)
    for (const key of ['excludeCredentials', 'allowCredentials']) {
      if (Array.isArray(copy[key])) copy[key].forEach(credential => { if (credential.id) credential.id = fromBase64Url(credential.id) })
    }
    return copy
  }

  function credentialJson (credential) {
    if (credential && typeof credential.toJSON === 'function') return credential.toJSON()
    const response = credential && credential.response
    if (!credential || !response) throw new Error('passkey response was unavailable')
    const result = { id: credential.id, rawId: base64Url(credential.rawId), type: credential.type, response: { clientDataJSON: base64Url(response.clientDataJSON) } }
    if (response.attestationObject) {
      result.response.attestationObject = base64Url(response.attestationObject)
      result.response.transports = typeof response.getTransports === 'function' ? response.getTransports() : []
    } else {
      result.response.authenticatorData = base64Url(response.authenticatorData)
      result.response.signature = base64Url(response.signature)
      if (response.userHandle) result.response.userHandle = base64Url(response.userHandle)
    }
    if (credential.authenticatorAttachment) result.authenticatorAttachment = credential.authenticatorAttachment
    if (credential.clientExtensionResults) result.clientExtensionResults = credential.getClientExtensionResults ? credential.getClientExtensionResults() : {}
    return result
  }

  async function deviceRequestProof (device, path, init = {}) {
    const timestamp = Date.now()
    const body = typeof init.body === 'string' ? init.body : ''
    const hash = base64Url(new Uint8Array(await root.crypto.subtle.digest('SHA-256', textEncoder.encode(body))))
    const payload = textEncoder.encode(`PearCup device request v1:${String(init.method || 'GET').toUpperCase()}:${path}:${timestamp}:${hash}`)
    const signature = await root.crypto.subtle.sign({ name: 'Ed25519' }, device.privateKey, payload)
    return { timestamp: String(timestamp), signature: base64Url(new Uint8Array(signature)) }
  }

  function requirePasskeys () {
    if (!root.PublicKeyCredential || !root.navigator || !root.navigator.credentials) throw new Error('this host cannot create a passkey; open the PearCup browser page to approve this device')
  }

  function acceptSession (payload) {
    if (!payload || !payload.account || !payload.session) throw new Error('identity service returned an incomplete session')
    current.account = payload.account
    saveSession(payload.session)
    current.error = ''
    notify()
    return payload.account
  }

  async function enroll ({ displayName, team } = {}) {
    requirePasskeys()
    const created = await request('/v1/passkeys/register/options', { method: 'POST', body: JSON.stringify({ displayName, team }) })
    const credential = await root.navigator.credentials.create({ publicKey: fromOptionsJson(created.options) })
    const verified = await request('/v1/passkeys/register/verify', { method: 'POST', body: JSON.stringify({ ceremonyId: created.ceremonyId, response: credentialJson(credential) }) })
    return acceptSession(verified)
  }

  async function signIn () {
    requirePasskeys()
    const created = await request('/v1/passkeys/auth/options', { method: 'POST', body: '{}' })
    const credential = await root.navigator.credentials.get({ publicKey: fromOptionsJson(created.options) })
    const verified = await request('/v1/passkeys/auth/verify', { method: 'POST', body: JSON.stringify({ ceremonyId: created.ceremonyId, response: credentialJson(credential) }) })
    return acceptSession(verified)
  }

  function openDb () {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error('this host cannot securely retain a device key')); return }
      const open = root.indexedDB.open(DEVICE_DB, 1)
      open.onupgradeneeded = () => open.result.createObjectStore(DEVICE_STORE)
      open.onerror = () => reject(open.error || new Error('could not open device key store'))
      open.onsuccess = () => resolve(open.result)
    })
  }

  async function getStoredDevice () {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DEVICE_STORE, 'readonly')
      const get = tx.objectStore(DEVICE_STORE).get(DEVICE_KEY)
      get.onerror = () => reject(get.error || new Error('could not read device key'))
      get.onsuccess = () => resolve(get.result || null)
    })
  }

  async function storeDevice (device) {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DEVICE_STORE, 'readwrite')
      tx.objectStore(DEVICE_STORE).put(device, DEVICE_KEY)
      tx.onabort = () => reject(tx.error || new Error('could not retain device key'))
      tx.onerror = () => reject(tx.error || new Error('could not retain device key'))
      tx.oncomplete = () => resolve(device)
    })
  }

  function platform () {
    if (root.pear && root.pear.identity) return 'pear-browser'
    if (root.Pear) return 'pear-runtime'
    return 'browser'
  }

  async function device () {
    if (current.device && current.device.privateKey) return current.device
    const saved = await getStoredDevice()
    if (saved && saved.privateKey && saved.publicKey) { current.device = saved; return saved }
    if (!root.crypto || !root.crypto.subtle) throw new Error('WebCrypto Ed25519 is required to link this device')
    const pair = await root.crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify'])
    const publicKey = base64Url(new Uint8Array(await root.crypto.subtle.exportKey('raw', pair.publicKey)))
    const next = { privateKey: pair.privateKey, publicKey: pair.publicKey, publicKeyText: publicKey, platform: platform(), label: platform() === 'pear-runtime' ? 'Pear runtime' : platform() === 'pear-browser' ? 'Pear Browser' : 'Browser device' }
    current.device = await storeDevice(next)
    return current.device
  }

  async function startDevicePairing () {
    const local = await device()
    const pairing = await request('/v1/pairings', { method: 'POST', body: JSON.stringify({ publicKey: local.publicKeyText, label: local.label, platform: local.platform }) })
    current.pending = pairing
    current.error = ''
    notify()
    return pairing
  }

  async function claimDevicePairing () {
    if (!current.pending || !current.pending.code) throw new Error('start a device link first')
    const local = await device()
    const signature = await root.crypto.subtle.sign({ name: 'Ed25519' }, local.privateKey, textEncoder.encode(`PearCup device pairing claim v1:${current.pending.code}`))
    const active = config()
    const response = await root.fetch(`${active.apiUrl}/v1/pairings/${current.pending.code}/claim`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ proof: base64Url(new Uint8Array(signature)) })
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(payload && payload.error ? payload.error : `device claim failed (${response.status})`)
    current.account = payload.account
    current.device = await storeDevice({ ...local, id: payload.device.id, token: payload.device.token, expiresAt: payload.device.expiresAt })
    current.pending = null
    current.error = ''
    notify()
    return payload.account
  }

  async function approvePairing (code) {
    const clean = String(code || '').toUpperCase()
    const payload = await request(`/v1/pairings/${clean}/approve`, { method: 'POST', body: '{}' })
    current.error = ''
    notify()
    return payload
  }

  async function pairingStatus (code) { return request(`/v1/pairings/${String(code || '').toUpperCase()}`) }

  async function restore () {
    const active = config()
    if (!active || !active.enabled) { current.configured = false; return status() }
    current.configured = true
    try {
      const payload = await request('/v1/profile')
      current.account = payload.account
      current.error = ''
    } catch (error) {
      // An unsigned first visit is normal; show an invitation, not an error.
      current.error = error && error.status === 401 ? '' : (error && error.message ? error.message : '')
    }
    notify()
    return status()
  }

  const api = { status, restore, enroll, signIn, startDevicePairing, claimDevicePairing, approvePairing, pairingStatus, onChange: listener => { if (typeof listener === 'function') listeners.add(listener); return () => listeners.delete(listener) } }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupIdentity = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
