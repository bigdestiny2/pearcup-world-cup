// Private-room access control for the shell's P2P join.
// The lobby launches a private room with ?host=<owner>&cap=<invite>&px=<proof>
// &pn=<nonce> in the URL. Here we (a) expose the credential this client presents
// to peers, and (b) verify an incoming peer's credential against the room owner
// key — so peers reject anyone who only has the room code but no valid invite.
// Public servers (no ?host) are unenforced: anyone may join.
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
  // origin's localStorage. We only need the public key here (to identify the
  // owner and relay the lobby-signed proof); no signing happens in the shell.
  let myKey = null
  try {
    const stored = JSON.parse(root.localStorage.getItem('pearcup-prototype') || '{}')
    if (stored.identity && /^[0-9a-f]{64}$/.test(stored.identity.key || '')) myKey = stored.identity.key
  } catch { /* no identity */ }

  function inviteMessage (c, k) { return `us-invite:v1|${c}|${k}` }
  function proofMessage (c, n) { return `us-join:v1|${c}|${n}` }

  // The credential this client attaches to its P2P hello.
  function myCredential () {
    if (!enforced) return null
    if (myKey && myKey === ownerKey) return { key: myKey, owner: true }
    return { key: myKey, cap: myCap, proof: myProof, nonce: myNonce }
  }

  // Verify a peer credential against a specific owner + code (pure — testable).
  async function verifyAgainst (cred, owner, roomCode) {
    if (!cred || !cred.key) return false
    if (cred.key === owner) return true
    if (!cred.cap || !root.UltimateID) return false
    const inviteOk = await root.UltimateID.verify(owner, inviteMessage(roomCode, cred.key), cred.cap)
    if (!inviteOk) return false
    if (cred.proof && cred.nonce) {
      return root.UltimateID.verify(cred.key, proofMessage(roomCode, cred.nonce), cred.proof)
    }
    return true
  }

  // Verify a peer for THIS room. Unenforced rooms admit everyone.
  async function verify (cred) {
    if (!enforced) return true
    return verifyAgainst(cred, ownerKey, code)
  }

  root.PearCupRoomAccess = { enforced, ownerKey, code, myKey, myCredential, verify, verifyAgainst }
})(window)
