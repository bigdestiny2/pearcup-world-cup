import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from '@simplewebauthn/server'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  claimPayload,
  cleanLabel,
  cleanTeam,
  deviceRequestPayload,
  fingerprint,
  isEd25519PublicKey,
  isPairCode,
  randomHex,
  randomPairCode,
  sha256
} from './codec.js'

const DAY = 24 * 60 * 60 * 1000
const CEREMONY_TTL = 5 * 60 * 1000
const PAIRING_TTL = 10 * 60 * 1000
const SESSION_TTL = 30 * DAY
const DEVICE_SESSION_TTL = 14 * DAY
const PAGE_ORIGIN = 'https://pearcup-kawaii.pages.dev'

function now () { return Date.now() }

function requestPath (request) { return new URL(request.url).pathname.replace(/\/+$/, '') || '/' }

function json (body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  })
}

function error (message, status = 400) { return json({ error: message }, status) }

function securityHeaders (response, corsOrigin = '') {
  const headers = new Headers(response.headers)
  headers.set('x-content-type-options', 'nosniff')
  headers.set('x-frame-options', 'DENY')
  headers.set('referrer-policy', 'no-referrer')
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  headers.set('vary', 'Origin')
  if (corsOrigin) {
    headers.set('access-control-allow-origin', corsOrigin)
    headers.set('access-control-allow-methods', 'GET, POST, PUT, OPTIONS')
    headers.set('access-control-allow-headers', 'authorization, content-type, x-pearcup-device-time, x-pearcup-device-proof')
    headers.set('access-control-max-age', '600')
    headers.set('access-control-allow-credentials', 'true')
  }
  return new Response(response.body, { status: response.status, headers })
}

function allowedOrigin (request, path, env) {
  const origin = request.headers.get('Origin') || ''
  const browserOrigin = env.PEARCUP_RP_ORIGIN || PAGE_ORIGIN
  if (!origin) return ''
  if (origin === browserOrigin) return origin
  // Pear runtime renderers can legitimately emit Origin: null. These endpoints
  // expose only a short-lived public pairing status; approval still needs an
  // authenticated passkey session and claim still needs the device private key.
  if (origin === 'null' && /^\/v1\/(?:pairings(?:\/[^/]+(?:\/claim)?)?|profile|demo-wallet(?:\/fund)?)$/.test(path)) return origin
  return null
}

async function body (request) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 32_768) throw new Error('request is too large')
  try { return await request.json() } catch { throw new Error('invalid JSON request body') }
}

function cookieToken (request) {
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/(?:^|;\s*)__Host-pearcup_session=([^;]+)/)
  return match ? match[1] : ''
}

function authorization (request) {
  const raw = request.headers.get('authorization') || ''
  const match = raw.match(/^(Bearer|Device)\s+([A-Za-z0-9_-]{32,256})$/)
  return match ? { type: match[1].toLowerCase(), token: match[2] } : null
}

async function cleanup (env) {
  const time = now()
  await env.DB.batch([
    env.DB.prepare('DELETE FROM webauthn_ceremonies WHERE expires_at < ?').bind(time),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(time),
    env.DB.prepare('DELETE FROM device_sessions WHERE expires_at < ?').bind(time),
    env.DB.prepare('DELETE FROM pairings WHERE expires_at < ?').bind(time)
  ])
}

async function issueSession (env, accountId) {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const time = now()
  await env.DB.prepare('INSERT INTO sessions (token_hash, account_id, expires_at, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(token), accountId, time + SESSION_TTL, time, time).run()
  return { token, expiresAt: time + SESSION_TTL }
}

async function issueDeviceSession (env, deviceId, accountId) {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const time = now()
  await env.DB.prepare('INSERT INTO device_sessions (token_hash, device_id, account_id, expires_at, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(await sha256(token), deviceId, accountId, time + DEVICE_SESSION_TTL, time, time).run()
  return { token, expiresAt: time + DEVICE_SESSION_TTL }
}

async function verifyDeviceProof (request, publicKey) {
  const timestamp = Number(request.headers.get('x-pearcup-device-time'))
  const proof = request.headers.get('x-pearcup-device-proof') || ''
  if (!Number.isInteger(timestamp) || Math.abs(now() - timestamp) > 30_000 || !proof) return false
  try {
    const bodyHash = await sha256(await request.clone().text())
    const key = await crypto.subtle.importKey('raw', base64UrlToBytes(publicKey), { name: 'Ed25519' }, false, ['verify'])
    return crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      base64UrlToBytes(proof),
      deviceRequestPayload({ method: request.method.toUpperCase(), path: requestPath(request), timestamp, bodyHash })
    )
  } catch { return false }
}

async function authenticatedAccount (request, env) {
  const supplied = authorization(request)
  const token = supplied ? supplied.token : cookieToken(request)
  if (!token) return null
  const hash = await sha256(token)
  const time = now()
  if (supplied && supplied.type === 'device') {
    const row = await env.DB.prepare(`SELECT ds.account_id AS id, a.display_name, a.team, ds.device_id, dk.public_key
      FROM device_sessions ds JOIN accounts a ON a.id = ds.account_id JOIN device_keys dk ON dk.id = ds.device_id
      WHERE ds.token_hash = ? AND ds.expires_at > ?`).bind(hash, time).first()
    if (row && await verifyDeviceProof(request, row.public_key)) {
      await env.DB.prepare('UPDATE device_sessions SET last_used_at = ? WHERE token_hash = ?').bind(time, hash).run()
      return { id: row.id, displayName: row.display_name, team: row.team, deviceId: row.device_id, kind: 'device' }
    }
    return null
  }
  const row = await env.DB.prepare(`SELECT s.account_id AS id, a.display_name, a.team
    FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?`).bind(hash, time).first()
  if (!row) return null
  await env.DB.prepare('UPDATE sessions SET last_used_at = ? WHERE token_hash = ?').bind(time, hash).run()
  return { id: row.id, displayName: row.display_name, team: row.team, kind: 'passkey' }
}

async function requireAccount (request, env) {
  const account = await authenticatedAccount(request, env)
  if (!account) throw Object.assign(new Error('sign in with your PearCup passkey first'), { status: 401 })
  return account
}

function accountJson (account) { return { id: account.id, displayName: account.displayName, team: account.team } }

function sessionCookie (token) {
  return `__Host-pearcup_session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${Math.floor(SESSION_TTL / 1000)}`
}

function registrationCredential (info, fallbackId) {
  const credential = info && info.credential ? info.credential : {}
  const id = credential.id || info.credentialID || fallbackId
  const publicKey = credential.publicKey || info.credentialPublicKey
  const counter = credential.counter ?? info.counter ?? 0
  if (!id || !publicKey) throw new Error('passkey registration did not return credential material')
  return {
    id: typeof id === 'string' ? id : bytesToBase64Url(id),
    publicKey: typeof publicKey === 'string' ? publicKey : bytesToBase64Url(publicKey),
    counter: Number(counter) || 0
  }
}

async function createRegistrationOptions (request, env) {
  const input = await body(request)
  const displayName = cleanLabel(input.displayName, 18, 'captain')
  const team = cleanTeam(input.team)
  const time = now()
  const accountId = randomHex(16)
  await env.DB.prepare('INSERT INTO accounts (id, display_name, team, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(accountId, displayName, team, time, time).run()
  const options = await generateRegistrationOptions({
    rpName: env.PEARCUP_RP_NAME || 'PearCup',
    rpID: env.PEARCUP_RP_ID || 'pearcup-kawaii.pages.dev',
    userName: `pearcup-${accountId}`,
    userDisplayName: displayName,
    userID: Uint8Array.from(accountId.match(/.{2}/g).map(byte => parseInt(byte, 16))),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    supportedAlgorithmIDs: [-7, -257]
  })
  const ceremonyId = randomHex(16)
  await env.DB.prepare('INSERT INTO webauthn_ceremonies (id, account_id, kind, challenge, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(ceremonyId, accountId, 'registration', options.challenge, time + CEREMONY_TTL, time).run()
  return json({ ceremonyId, options })
}

async function verifyRegistration (request, env) {
  const input = await body(request)
  if (!/^[a-f0-9]{32}$/i.test(String(input.ceremonyId || ''))) return error('invalid registration ceremony')
  const time = now()
  const ceremony = await env.DB.prepare(`SELECT c.id, c.account_id, c.challenge, a.display_name, a.team
    FROM webauthn_ceremonies c JOIN accounts a ON a.id = c.account_id
    WHERE c.id = ? AND c.kind = 'registration' AND c.expires_at > ?`).bind(input.ceremonyId, time).first()
  if (!ceremony) return error('registration ceremony expired', 410)
  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: ceremony.challenge,
      expectedOrigin: env.PEARCUP_RP_ORIGIN || PAGE_ORIGIN,
      expectedRPID: env.PEARCUP_RP_ID || 'pearcup-kawaii.pages.dev',
      requireUserVerification: true
    })
  } catch (cause) {
    return error(`passkey verification failed: ${cause && cause.message ? cause.message : 'invalid response'}`, 400)
  }
  if (!verification.verified || !verification.registrationInfo) return error('passkey was not verified', 400)
  let credential
  try { credential = registrationCredential(verification.registrationInfo, input.response && input.response.id) } catch (cause) { return error(cause.message, 400) }
  const transports = Array.isArray(input.response && input.response.response && input.response.response.transports)
    ? input.response.response.transports.filter(value => typeof value === 'string').slice(0, 8) : []
  await env.DB.batch([
    env.DB.prepare('INSERT INTO passkey_credentials (credential_id, account_id, public_key, counter, transports_json, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(credential.id, ceremony.account_id, credential.publicKey, credential.counter, JSON.stringify(transports), time, time),
    env.DB.prepare('INSERT INTO demo_wallets (account_id, balance, currency, updated_at) VALUES (?, ?, ?, ?)')
      .bind(ceremony.account_id, 500, 'USDT', time),
    env.DB.prepare('INSERT INTO demo_wallet_events (id, account_id, amount, kind, memo, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(randomHex(16), ceremony.account_id, 500, 'welcome', 'PearCup welcome balance', time),
    env.DB.prepare('DELETE FROM webauthn_ceremonies WHERE id = ?').bind(ceremony.id)
  ])
  const session = await issueSession(env, ceremony.account_id)
  return json({ account: accountJson({ id: ceremony.account_id, displayName: ceremony.display_name, team: ceremony.team }), session: { token: session.token, expiresAt: session.expiresAt } }, 201, { 'set-cookie': sessionCookie(session.token) })
}

async function createAuthenticationOptions (request, env) {
  await body(request)
  const time = now()
  const options = await generateAuthenticationOptions({ rpID: env.PEARCUP_RP_ID || 'pearcup-kawaii.pages.dev', userVerification: 'required' })
  const ceremonyId = randomHex(16)
  await env.DB.prepare('INSERT INTO webauthn_ceremonies (id, account_id, kind, challenge, expires_at, created_at) VALUES (?, NULL, ?, ?, ?, ?)')
    .bind(ceremonyId, 'authentication', options.challenge, time + CEREMONY_TTL, time).run()
  return json({ ceremonyId, options })
}

async function verifyAuthentication (request, env) {
  const input = await body(request)
  const ceremonyId = String(input.ceremonyId || '')
  const credentialId = String(input.response && input.response.id || '')
  if (!/^[a-f0-9]{32}$/i.test(ceremonyId) || !credentialId) return error('invalid passkey sign-in request')
  const time = now()
  const [ceremony, stored] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM webauthn_ceremonies WHERE id = ? AND kind = 'authentication' AND expires_at > ?").bind(ceremonyId, time),
    env.DB.prepare(`SELECT c.*, a.display_name, a.team FROM passkey_credentials c
      JOIN accounts a ON a.id = c.account_id WHERE c.credential_id = ?`).bind(credentialId)
  ])
  const pending = ceremony.results && ceremony.results[0]
  const credentialRow = stored.results && stored.results[0]
  if (!pending || !credentialRow) return error('passkey sign-in request expired or is unknown', 410)
  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: env.PEARCUP_RP_ORIGIN || PAGE_ORIGIN,
      expectedRPID: env.PEARCUP_RP_ID || 'pearcup-kawaii.pages.dev',
      requireUserVerification: true,
      credential: {
        id: credentialRow.credential_id,
        publicKey: base64UrlToBytes(credentialRow.public_key),
        counter: Number(credentialRow.counter),
        transports: JSON.parse(credentialRow.transports_json || '[]')
      }
    })
  } catch (cause) {
    return error(`passkey verification failed: ${cause && cause.message ? cause.message : 'invalid response'}`, 400)
  }
  if (!verification.verified) return error('passkey was not verified', 400)
  const counter = Number(verification.authenticationInfo && verification.authenticationInfo.newCounter)
  await env.DB.batch([
    env.DB.prepare('UPDATE passkey_credentials SET counter = ?, last_used_at = ? WHERE credential_id = ?').bind(Number.isFinite(counter) ? counter : credentialRow.counter, time, credentialRow.credential_id),
    env.DB.prepare('DELETE FROM webauthn_ceremonies WHERE id = ?').bind(ceremonyId)
  ])
  const session = await issueSession(env, credentialRow.account_id)
  return json({ account: accountJson({ id: credentialRow.account_id, displayName: credentialRow.display_name, team: credentialRow.team }), session: { token: session.token, expiresAt: session.expiresAt } }, 200, { 'set-cookie': sessionCookie(session.token) })
}

async function startPairing (request, env) {
  const input = await body(request)
  const publicKey = String(input.publicKey || '')
  if (!isEd25519PublicKey(publicKey)) return error('device key must be a 32-byte Ed25519 public key')
  const label = cleanLabel(input.label, 48, 'PearCup device')
  const platform = cleanLabel(input.platform, 24, 'pear').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'pear'
  const time = now()
  const code = randomPairCode()
  await env.DB.prepare(`INSERT INTO pairings (code_hash, device_id, device_public_key, device_label, platform, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(await sha256(code), randomHex(16), publicKey, label, platform, time, time + PAIRING_TTL).run()
  return json({ code, expiresAt: time + PAIRING_TTL, pairUrl: `${env.PEARCUP_RP_ORIGIN || PAGE_ORIGIN}/play/?pair=${code}`, device: { label, platform, fingerprint: fingerprint(publicKey) } }, 201)
}

async function findPairing (code, env) {
  return env.DB.prepare('SELECT * FROM pairings WHERE code_hash = ? AND expires_at > ?').bind(await sha256(code), now()).first()
}

async function pairingStatus (request, env, code) {
  if (!isPairCode(code)) return error('invalid pairing code')
  const pairing = await findPairing(code, env)
  if (!pairing) return error('pairing code expired or was not found', 404)
  const status = pairing.claimed_at ? 'claimed' : pairing.account_id ? 'approved' : 'pending'
  return json({ status, expiresAt: pairing.expires_at, device: { label: pairing.device_label, platform: pairing.platform, fingerprint: fingerprint(pairing.device_public_key) } })
}

async function approvePairing (request, env, code) {
  const account = await requireAccount(request, env)
  if (!isPairCode(code)) return error('invalid pairing code')
  const pairing = await findPairing(code, env)
  if (!pairing) return error('pairing code expired or was not found', 404)
  if (pairing.account_id && pairing.account_id !== account.id) return error('this pairing code was already approved by another account', 409)
  if (pairing.claimed_at) return error('this pairing code has already been claimed', 409)
  const time = now()
  const update = await env.DB.prepare('UPDATE pairings SET account_id = ?, approved_at = ? WHERE code_hash = ? AND account_id IS NULL AND claimed_at IS NULL')
    .bind(account.id, time, pairing.code_hash).run()
  if (update.meta.changes === 0 && !pairing.account_id) return error('pairing state changed; refresh and try again', 409)
  return json({ status: 'approved', account: accountJson(account), device: { label: pairing.device_label, platform: pairing.platform, fingerprint: fingerprint(pairing.device_public_key) } })
}

async function claimPairing (request, env, code) {
  if (!isPairCode(code)) return error('invalid pairing code')
  const input = await body(request)
  const pairing = await findPairing(code, env)
  if (!pairing) return error('pairing code expired or was not found', 404)
  if (!pairing.account_id || !pairing.approved_at) return error('waiting for passkey account approval', 409)
  if (pairing.claimed_at) return error('this pairing code has already been claimed', 409)
  const existingDevice = await env.DB.prepare('SELECT id, account_id FROM device_keys WHERE public_key = ? AND revoked_at IS NULL').bind(pairing.device_public_key).first()
  if (existingDevice && existingDevice.account_id !== pairing.account_id) return error('this device is already linked to another PearCup account', 409)
  let valid = false
  try {
    const key = await crypto.subtle.importKey('raw', base64UrlToBytes(pairing.device_public_key), { name: 'Ed25519' }, false, ['verify'])
    valid = await crypto.subtle.verify({ name: 'Ed25519' }, key, base64UrlToBytes(String(input.proof || '')), claimPayload(code))
  } catch {}
  if (!valid) return error('device proof did not match the pairing request', 401)
  const time = now()
  const claimed = await env.DB.prepare('UPDATE pairings SET claimed_at = ? WHERE code_hash = ? AND claimed_at IS NULL AND account_id IS NOT NULL')
    .bind(time, pairing.code_hash).run()
  if (claimed.meta.changes !== 1) return error('pairing state changed; restart the link', 409)
  const deviceId = existingDevice ? existingDevice.id : pairing.device_id
  if (existingDevice) {
    await env.DB.prepare('UPDATE device_keys SET label = ?, platform = ?, last_used_at = ? WHERE id = ?').bind(pairing.device_label, pairing.platform, time, deviceId).run()
  } else {
    await env.DB.prepare(`INSERT INTO device_keys (id, account_id, public_key, label, platform, created_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(deviceId, pairing.account_id, pairing.device_public_key, pairing.device_label, pairing.platform, time, time).run()
  }
  const session = await issueDeviceSession(env, deviceId, pairing.account_id)
  const account = await env.DB.prepare('SELECT id, display_name, team FROM accounts WHERE id = ?').bind(pairing.account_id).first()
  return json({ account: accountJson({ id: account.id, displayName: account.display_name, team: account.team }), device: { id: deviceId, token: session.token, expiresAt: session.expiresAt } })
}

async function getProfile (request, env) {
  const account = await requireAccount(request, env)
  const [wallet, devices] = await env.DB.batch([
    env.DB.prepare('SELECT balance, currency, updated_at FROM demo_wallets WHERE account_id = ?').bind(account.id),
    env.DB.prepare('SELECT id, label, platform, created_at, last_used_at FROM device_keys WHERE account_id = ? AND revoked_at IS NULL ORDER BY last_used_at DESC').bind(account.id)
  ])
  return json({ account: accountJson(account), wallet: wallet.results && wallet.results[0] || { balance: 500, currency: 'USDT' }, devices: devices.results || [], authentication: account.kind })
}

async function updateProfile (request, env) {
  const account = await requireAccount(request, env)
  const input = await body(request)
  const displayName = cleanLabel(input.displayName, 18, account.displayName)
  const team = cleanTeam(input.team || account.team)
  await env.DB.prepare('UPDATE accounts SET display_name = ?, team = ?, updated_at = ? WHERE id = ?').bind(displayName, team, now(), account.id).run()
  return json({ account: { id: account.id, displayName, team } })
}

async function demoWallet (request, env) {
  const account = await requireAccount(request, env)
  const wallet = await env.DB.prepare('SELECT balance, currency, updated_at FROM demo_wallets WHERE account_id = ?').bind(account.id).first()
  const events = await env.DB.prepare('SELECT amount, kind, memo, created_at FROM demo_wallet_events WHERE account_id = ? ORDER BY created_at DESC LIMIT 16').bind(account.id).all()
  return json({ wallet: wallet || { balance: 500, currency: 'USDT' }, events: events.results || [] })
}

async function fundDemoWallet (request, env) {
  const account = await requireAccount(request, env)
  const input = await body(request)
  const amount = Number(input.amount)
  if (![50, 100, 500].includes(amount)) return error('demo funding amount must be 50, 100, or 500 USDT')
  const time = now()
  const update = await env.DB.prepare('UPDATE demo_wallets SET balance = MIN(10000, balance + ?), updated_at = ? WHERE account_id = ?').bind(amount, time, account.id).run()
  if (update.meta.changes !== 1) return error('demo wallet is not available', 404)
  await env.DB.prepare('INSERT INTO demo_wallet_events (id, account_id, amount, kind, memo, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(randomHex(16), account.id, amount, 'fund', 'Demo balance added', time).run()
  return demoWallet(request, env)
}

async function route (request, env) {
  const path = requestPath(request)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (request.method === 'GET' && path === '/health') return json({ ok: true, service: 'pearcup-kawaii-identity', version: 1 })
  if (request.method === 'POST' && path === '/v1/passkeys/register/options') return createRegistrationOptions(request, env)
  if (request.method === 'POST' && path === '/v1/passkeys/register/verify') return verifyRegistration(request, env)
  if (request.method === 'POST' && path === '/v1/passkeys/auth/options') return createAuthenticationOptions(request, env)
  if (request.method === 'POST' && path === '/v1/passkeys/auth/verify') return verifyAuthentication(request, env)
  if (request.method === 'POST' && path === '/v1/pairings') return startPairing(request, env)
  const pairing = path.match(/^\/v1\/pairings\/([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10})(?:\/(approve|claim))?$/)
  if (pairing) {
    if (request.method === 'GET' && !pairing[2]) return pairingStatus(request, env, pairing[1])
    if (request.method === 'POST' && pairing[2] === 'approve') return approvePairing(request, env, pairing[1])
    if (request.method === 'POST' && pairing[2] === 'claim') return claimPairing(request, env, pairing[1])
  }
  if (request.method === 'GET' && path === '/v1/profile') return getProfile(request, env)
  if (request.method === 'PUT' && path === '/v1/profile') return updateProfile(request, env)
  if (request.method === 'GET' && path === '/v1/demo-wallet') return demoWallet(request, env)
  if (request.method === 'POST' && path === '/v1/demo-wallet/fund') return fundDemoWallet(request, env)
  return error('not found', 404)
}

export default {
  async fetch (request, env) {
    const path = requestPath(request)
    const origin = allowedOrigin(request, path, env)
    if (origin === null) return securityHeaders(error('origin is not allowed', 403))
    try {
      await cleanup(env)
      return securityHeaders(await route(request, env), origin)
    } catch (cause) {
      const status = Number(cause && cause.status) || 500
      const message = status === 500 ? 'identity service error' : cause.message
      return securityHeaders(error(message, status), origin)
    }
  }
}
