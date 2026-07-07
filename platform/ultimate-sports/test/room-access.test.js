'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

function loadRoomAccess (search, store, verifyFn) {
  const prevWindow = global.window
  try {
    const win = {
      location: { search: search || '' },
      localStorage: {
        getItem: (key) => (store ? store[key] : null)
      },
      UltimateID: {
        verify: verifyFn || (() => false)
      }
    }
    global.window = win
    delete require.cache[require.resolve('../shell/room-access.js')]
    require('../shell/room-access.js')
    return win.PearCupRoomAccess
  } finally {
    global.window = prevWindow
  }
}

test('public room admits everyone', async () => {
  const RA = loadRoomAccess('', {}, () => { throw new Error('should not verify public room') })
  assert.equal(RA.enforced, false)
  assert.equal(await RA.verify(null), true)
  assert.equal(await RA.verify({ key: 'any' }), true)
})

test('owner is authorized structurally but still answers challenge-response', async () => {
  const owner = 'aabbccdd'.repeat(8)
  const RA = loadRoomAccess(`?host=${owner}&join=ROOM1`, { 'pearcup-prototype': JSON.stringify({ identity: { key: owner } }) }, () => true)
  assert.equal(RA.enforced, true)
  // Structural authorization passes for the owner key, but admission must still
  // verify a proof signed over a verifier-issued nonce (done in peer-match).
  assert.equal(await RA.verify({ key: owner }), true)
})

test('member with valid invite is authorized structurally', async () => {
  const owner = 'aabbccdd'.repeat(8)
  const member = '11223344'.repeat(8)
  const cap = 'valid-cap'
  const proof = 'valid-proof'
  const nonce = 'nonce-1'
  const verify = (key, message, sig) => {
    if (key === owner && message === `us-invite:v1|ROOM1|${member}` && sig === cap) return true
    return false
  }
  const RA = loadRoomAccess(`?host=${owner}&join=ROOM1&cap=${cap}`, { 'pearcup-prototype': JSON.stringify({ identity: { key: member } }) }, verify)
  assert.equal(RA.enforced, true)
  // verify() only checks structural authorization (valid invite). The anti-replay
  // proof must be checked separately with verifyProof() using a verifier-issued nonce.
  assert.equal(await RA.verify({ key: member, cap, proof, nonce }), true)
})

test('gate-crasher with only the code is rejected', async () => {
  const owner = 'aabbccdd'.repeat(8)
  const crasher = '11223344'.repeat(8)
  const verify = () => false
  const RA = loadRoomAccess(`?host=${owner}&join=ROOM1`, {}, verify)
  assert.equal(RA.enforced, true)
  assert.equal(await RA.verify({ key: crasher }), false)
})

test('verifyAgainst validates invite signature', async () => {
  const owner = 'aabbccdd'.repeat(8)
  const member = '11223344'.repeat(8)
  const cap = 'valid-cap'
  let verifiedInvite = null
  const verify = (key, message, sig) => {
    if (key === owner && sig === cap) { verifiedInvite = message; return true }
    return false
  }
  const RA = loadRoomAccess(`?host=${owner}&join=ROOM1`, {}, verify)
  assert.equal(await RA.verifyAgainst({ key: member, cap }, owner, 'ROOM1'), true)
  assert.equal(verifiedInvite, `us-invite:v1|ROOM1|${member}`)
})

test('verifyAgainst ignores self-chosen proof and only checks structural auth', async () => {
  const owner = 'aabbccdd'.repeat(8)
  const member = '11223344'.repeat(8)
  const cap = 'valid-cap'
  const proof = 'valid-proof'
  const nonce = 'nonce-1'
  const verify = (key, message, sig) => {
    if (key === owner && sig === cap) return true
    return false
  }
  const RA = loadRoomAccess(`?host=${owner}&join=ROOM1`, {}, verify)
  // Valid invite passes regardless of proof/nonce (structural auth only).
  assert.equal(await RA.verifyAgainst({ key: member, cap, proof, nonce }, owner, 'ROOM1'), true)
  // Self-chosen proof does not make a bad invite valid.
  assert.equal(await RA.verifyAgainst({ key: member, cap: 'bad', proof, nonce }, owner, 'ROOM1'), false)
})

test('signChallenge signs the verifier-issued nonce with the stored identity', async () => {
  const owner = 'aabbccdd'.repeat(8)
  const member = '11223344'.repeat(8)
  const cap = 'valid-cap'
  const jwk = { kty: 'OKP', d: 'secret' }
  let signedMessage = null
  const win = {
    location: { search: `?host=${owner}&join=ROOM2&cap=${cap}` },
    localStorage: {
      getItem: (key) => {
        if (key === 'pearcup-prototype') return JSON.stringify({ identity: { key: member, jwk } })
        return null
      }
    },
    UltimateID: {
      verify: () => true,
      importPrivate: async (k) => ({ imported: k }),
      sign: async (priv, message) => { signedMessage = message; return `sig:${message}` }
    }
  }
  const prevWindow = global.window
  try {
    global.window = win
    delete require.cache[require.resolve('../shell/room-access.js')]
    require('../shell/room-access.js')
    const RA = win.PearCupRoomAccess
    const proof = await RA.signChallenge('nonce-xyz')
    assert.equal(signedMessage, 'us-join:v1|ROOM2|nonce-xyz')
    assert.equal(proof, 'sig:us-join:v1|ROOM2|nonce-xyz')
  } finally {
    global.window = prevWindow
  }
})

test('signChallenge returns null without identity or in public room', async () => {
  const RA = loadRoomAccess('', {}, () => true)
  assert.equal(await RA.signChallenge('nonce'), null)
  const owner = 'aabbccdd'.repeat(8)
  const RA2 = loadRoomAccess(`?host=${owner}&join=ROOM1`, {}, () => true)
  assert.equal(await RA2.signChallenge('nonce'), null)
})

test('verifyProof checks proof against a specific nonce', async () => {
  const owner = 'aabbccdd'.repeat(8)
  const member = '11223344'.repeat(8)
  const proof = 'valid-proof'
  const nonce = 'nonce-1'
  const verify = (key, message, sig) => (key === member && message === `us-join:v1|ROOM1|${nonce}` && sig === proof)
  const RA = loadRoomAccess(`?host=${owner}&join=ROOM1`, {}, verify)
  assert.equal(await RA.verifyProof({ key: member, proof }, nonce), true)
  assert.equal(await RA.verifyProof({ key: member, proof }, 'wrong-nonce'), false)
  assert.equal(await RA.verifyProof({ key: member, proof: 'bad' }, nonce), false)
  assert.equal(await RA.verifyProof(null, nonce), false)
})

test('challenge-response flow: only verifier-issued nonce proofs are accepted', async () => {
  const owner = 'aabbccdd'.repeat(8)
  const member = '11223344'.repeat(8)
  const cap = 'valid-cap'
  const legacyProof = 'legacy-proof'
  const legacyNonce = 'legacy-nonce'
  const freshProof = 'fresh-proof'
  const freshNonce = 'fresh-nonce'
  const verify = (key, message, sig) => {
    if (key === owner && message === `us-invite:v1|ROOM1|${member}` && sig === cap) return true
    if (key === member && sig === legacyProof && message === `us-join:v1|ROOM1|${legacyNonce}`) return true
    if (key === member && sig === freshProof && message === `us-join:v1|ROOM1|${freshNonce}`) return true
    return false
  }
  const RA = loadRoomAccess(`?host=${owner}&join=ROOM1`, {}, verify)
  // verify() only checks structural authorization; a self-chosen legacy proof is
  // NOT treated as admission evidence.
  assert.equal(await RA.verify({ key: member, cap, proof: legacyProof, nonce: legacyNonce }), true)
  // Verifier-issued nonce verifies directly with verifyProof().
  assert.equal(await RA.verifyProof({ key: member, proof: freshProof }, freshNonce), true)
  // Wrong nonce for fresh proof fails.
  assert.equal(await RA.verifyProof({ key: member, proof: freshProof }, legacyNonce), false)
  // Legacy self-chosen nonce is rejected by verifyProof (wrong nonce).
  assert.equal(await RA.verifyProof({ key: member, proof: legacyProof }, freshNonce), false)
})

test('captured credential replayed under a new peer id is rejected', async () => {
  const owner = 'aabbccdd'.repeat(8)
  const member = '11223344'.repeat(8)
  const cap = 'valid-cap'
  const memberProof = 'member-proof'
  const hostNonce = 'host-nonce'
  const freshNonce = 'fresh-nonce'
  const verify = (key, message, sig) => {
    if (key === owner && message === `us-invite:v1|ROOM1|${member}` && sig === cap) return true
    if (key === member && message === `us-join:v1|ROOM1|${hostNonce}` && sig === memberProof) return true
    return false
  }
  const RA = loadRoomAccess(`?host=${owner}&join=ROOM1`, {}, verify)

  // Simulate peer-match admission: structural auth passes for the member.
  assert.equal(await RA.verify({ key: member, cap }), true)
  // Host issues a fresh nonce; member answers with a proof over that nonce.
  assert.equal(await RA.verifyProof({ key: member, proof: memberProof }, hostNonce), true)

  // Attacker captures the member's exact credential and replays it under a new
  // peer id. Structural auth still passes (same key + valid invite cap), but the
  // captured proof was signed over the host's previous nonce, not the fresh nonce
  // issued to the new connection — so replay is rejected.
  assert.equal(await RA.verify({ key: member, cap }), true)
  assert.equal(await RA.verifyProof({ key: member, proof: memberProof }, freshNonce), false)
})
