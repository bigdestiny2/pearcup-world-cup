const textEncoder = new TextEncoder()

export function bytesToBase64Url (bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (let offset = 0; offset < input.length; offset += 0x8000) {
    binary += String.fromCharCode(...input.subarray(offset, offset + 0x8000))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function base64UrlToBytes (value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid base64url value')
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const output = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) output[i] = binary.charCodeAt(i)
  return output
}

export function randomBytes (length) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

export function randomHex (bytes = 16) {
  return Array.from(randomBytes(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function randomPairCode () {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const random = randomBytes(10)
  return Array.from(random, byte => alphabet[byte % alphabet.length]).join('')
}

export function cleanLabel (value, max = 48, fallback = '') {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return text.slice(0, max) || fallback
}

export function cleanTeam (value) {
  const team = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^[a-z]{2,4}$/.test(team) ? team : 'br'
}

export function fingerprint (publicKey) {
  return `${publicKey.slice(0, 6)}…${publicKey.slice(-6)}`
}

export async function sha256 (value) {
  const data = typeof value === 'string' ? textEncoder.encode(value) : value
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
}

export function claimPayload (code) {
  return textEncoder.encode(`PearCup device pairing claim v1:${code}`)
}

export function deviceRequestPayload ({ method, path, timestamp, bodyHash }) {
  return textEncoder.encode(`PearCup device request v1:${method}:${path}:${timestamp}:${bodyHash}`)
}

export function isPairCode (value) {
  return typeof value === 'string' && /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/.test(value)
}

export function isEd25519PublicKey (value) {
  try { return base64UrlToBytes(value).byteLength === 32 } catch { return false }
}
