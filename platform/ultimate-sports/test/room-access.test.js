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

test('owner is admitted without capability', async () => {
  const owner = 'aabbccdd'.repeat(8)
  const RA = loadRoomAccess(`?host=${owner}&join=ROOM1`, { 'pearcup-prototype': JSON.stringify({ identity: { key: owner } }) }, () => true)
  assert.equal(RA.enforced, true)
  assert.equal(await RA.verify({ key: owner }), true)
})

test('member with valid invite and proof is admitted', async () => {
  const owner = 'aabbccdd'.repeat(8)
  const member = '11223344'.repeat(8)
  const cap = 'valid-cap'
  const proof = 'valid-proof'
  const nonce = 'nonce-1'
  const verify = (key, message, sig) => {
    if (key === owner && message === `us-invite:v1|ROOM1|${member}` && sig === cap) return true
    if (key === member && message === `us-join:v1|ROOM1|${nonce}` && sig === proof) return true
    return false
  }
  const RA = loadRoomAccess(`?host=${owner}&join=ROOM1&cap=${cap}&px=${proof}&pn=${nonce}`, { 'pearcup-prototype': JSON.stringify({ identity: { key: member } }) }, verify)
  assert.equal(RA.enforced, true)
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

test('verifyAgainst requires proof when supplied', async () => {
  const owner = 'aabbccdd'.repeat(8)
  const member = '11223344'.repeat(8)
  const cap = 'valid-cap'
  const proof = 'valid-proof'
  const nonce = 'nonce-1'
  const verify = (key, message, sig) => {
    if (key === owner && sig === cap) return true
    if (key === member && sig === proof) return true
    return false
  }
  const RA = loadRoomAccess(`?host=${owner}&join=ROOM1`, {}, verify)
  // Proof present and valid.
  assert.equal(await RA.verifyAgainst({ key: member, cap, proof, nonce }, owner, 'ROOM1'), true)
  // Proof present but invalid signature.
  assert.equal(await RA.verifyAgainst({ key: member, cap, proof: 'bad', nonce }, owner, 'ROOM1'), false)
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

test('challenge-response flow: fresh nonce verifies independently of legacy proof', async () => {
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
  // Legacy self-chosen proof still verifies through verify().
  assert.equal(await RA.verify({ key: member, cap, proof: legacyProof, nonce: legacyNonce }), true)
  // Verifier-issued nonce verifies directly with verifyProof().
  assert.equal(await RA.verifyProof({ key: member, proof: freshProof }, freshNonce), true)
  // Wrong nonce for fresh proof fails.
  assert.equal(await RA.verifyProof({ key: member, proof: freshProof }, legacyNonce), false)
})
