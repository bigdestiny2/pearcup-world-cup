// Ed25519 identity + signatures for the P2P client, via WebCrypto.
// A peer's identity is a real signing keypair: the public key (32 bytes / 64 hex)
// is the shareable peer ID, the private key stays local and signs invites and
// ownership proofs. Ed25519 keeps the 64-hex format the rest of the app already
// uses and matches Pear/hypercore's key convention.
(function (root) {
  'use strict'

  const ALGO = { name: 'Ed25519' }
  const subtle = root.crypto && root.crypto.subtle
  const enc = new TextEncoder()

  function toHex (buffer) {
    return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('')
  }
  function fromHex (hex) {
    const out = new Uint8Array(hex.length / 2)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
    return out
  }

  let supportedPromise = null
  async function supported () {
    if (!subtle) return false
    if (!supportedPromise) {
      supportedPromise = (async () => {
        try {
          const kp = await subtle.generateKey(ALGO, true, ['sign', 'verify'])
          return !!kp && !!kp.privateKey
        } catch { return false }
      })()
    }
    return supportedPromise
  }

  // Generate a keypair. Returns { pub (hex), jwk (persistable private key), privKey }.
  async function generate () {
    const kp = await subtle.generateKey(ALGO, true, ['sign', 'verify'])
    const raw = await subtle.exportKey('raw', kp.publicKey)
    const jwk = await subtle.exportKey('jwk', kp.privateKey)
    return { pub: toHex(raw), jwk, privKey: kp.privateKey }
  }

  async function importPrivate (jwk) {
    return subtle.importKey('jwk', jwk, ALGO, false, ['sign'])
  }

  async function sign (privKey, message) {
    const sig = await subtle.sign(ALGO, privKey, enc.encode(message))
    return toHex(sig)
  }

  // Verify a signature against a public key given as raw hex.
  async function verify (pubHex, message, sigHex) {
    if (!subtle || !/^[0-9a-f]{64}$/.test(pubHex || '') || !/^[0-9a-f]+$/.test(sigHex || '')) return false
    try {
      const pub = await subtle.importKey('raw', fromHex(pubHex), ALGO, false, ['verify'])
      return await subtle.verify(ALGO, pub, fromHex(sigHex), enc.encode(message))
    } catch {
      return false
    }
  }

  root.UltimateID = { supported, generate, importPrivate, sign, verify }
})(typeof globalThis !== 'undefined' ? globalThis : window)
