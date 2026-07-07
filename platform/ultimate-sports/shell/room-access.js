// Private-room access control for the shell's P2P join.
// The lobby launches a private room with ?host=<owner>&cap=<invite>&px=<proof>
// &pn=<nonce> in the URL. Here we (a) expose the credential this client presents
// to peers, and (b) verify an incoming peer's credential against the room owner
// key — so peers reject anyone who only has the room code but no valid invite.
// Public servers (no ?host) are unenforced: anyone may join.
//
// Challenge-response: a verifier can issue a fresh nonce over the P2P channel and
// require the joiner to sign `proofMessage(code, nonce)` with their private key.
// This stops replay of a captured hello, because the nonce is single-use and
// chosen by the verifier.
(function (root) {
  'use strict'

  const params = new URLSearchParams(root.location.search || '')
  const code = params.get('join') || ''
  const ownerKey = params.get('host') || ''
  const myCap = params.get('cap') || ''
  const myProof = params.get('px') || ''
  const myNonce = params.get('pn') || ''
  const enforced = /^[0-9a-f]{64}$/.test(ownerKey)

  // Shared identity: the lobby persisted { identity: { key, jwk } } in the same
  // origin's localStorage. We need the public key to identify ourselves and the
  // private JWK to answer a challenge-response nonce.
  let myKey = null
  let myJwk = null
  try {
    const stored = JSON.parse(root.localStorage.getItem('pearcup-prototype') || '{}')
    if (stored.identity && /^[0-9a-f]{64}$/.test(stored.identity.key || '')) {
      myKey = stored.identity.key
      myJwk = stored.identity.jwk || null
    }
  } catch { /* no identity */ }

  function inviteMessage (c, k) { return `us-invite:v1|${c}|${k}` }
  function proofMessage (c, n) { return `us-join:v1|${c}|${n}` }

  // The credential this client attaches to its P2P hello.
  // The verifier issues a fresh nonce; the joiner answers with signChallenge().
  // Self-chosen nonces are no longer accepted (zero replay protection).
  function myCredential () {
    if (!enforced) return null
    if (myKey && myKey === ownerKey) return { key: myKey, owner: true }
    return { key: myKey, cap: myCap }
  }

  // Sign a verifier-issued nonce to prove ownership of this client's key.
  async function signChallenge (nonce) {
    if (!enforced || !myKey || !myJwk || !root.UltimateID) return null
    try {
      const privKey = await root.UltimateID.importPrivate(myJwk)
      return await root.UltimateID.sign(privKey, proofMessage(code, nonce))
    } catch { return null }
  }

  // Verify a proof signed over a specific verifier-issued nonce.
  async function verifyProof (cred, nonce) {
    if (!cred || !cred.key || !cred.proof || !root.UltimateID) return false
    return root.UltimateID.verify(cred.key, proofMessage(code, nonce), cred.proof)
  }

  // Verify a peer credential against a specific owner + code (pure — testable).
  // Only structural authorization is checked here (owner key or valid invite).
  // Anti-replay proof must be verified separately via verifyProof() with a
  // verifier-issued nonce; self-chosen nonces are never accepted.
  async function verifyAgainst (cred, owner, roomCode) {
    if (!cred || !cred.key) return false
    if (cred.key === owner) return true
    if (!cred.cap || !root.UltimateID) return false
    return root.UltimateID.verify(owner, inviteMessage(roomCode, cred.key), cred.cap)
  }

  // Verify a peer for THIS room. Unenforced rooms admit everyone.
  async function verify (cred) {
    if (!enforced) return true
    return verifyAgainst(cred, ownerKey, code)
  }

  root.PearCupRoomAccess = {
    enforced, ownerKey, code, myKey, myCredential, verify, verifyAgainst, signChallenge, verifyProof
  }
})(window)
