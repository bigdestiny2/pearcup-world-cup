import assert from 'node:assert/strict'
import test from 'node:test'
import { base64UrlToBytes, bytesToBase64Url, cleanLabel, cleanTeam, deviceRequestPayload, isPairCode } from '../src/codec.js'

test('base64url codec round-trips binary key material', () => {
  const original = new Uint8Array([0, 1, 2, 254, 255, 42])
  const encoded = bytesToBase64Url(original)
  assert.equal(encoded, 'AAEC_v8q')
  assert.deepEqual([...base64UrlToBytes(encoded)], [...original])
})

test('device request proofs bind method, path, time, and body digest', () => {
  const payload = new TextDecoder().decode(deviceRequestPayload({ method: 'POST', path: '/v1/profile', timestamp: 42, bodyHash: 'digest' }))
  assert.equal(payload, 'PearCup device request v1:POST:/v1/profile:42:digest')
})

test('pairing code and profile normalizers reject ambiguous input', () => {
  assert.equal(isPairCode('9CEKFHJPRT'), true)
  assert.equal(isPairCode('O0IL-12345'), false)
  assert.equal(cleanLabel('  Pear   Runtime  ', 48, 'Device'), 'Pear Runtime')
  assert.equal(cleanLabel('', 48, 'Device'), 'Device')
  assert.equal(cleanTeam(' BR '), 'br')
  assert.equal(cleanTeam('not a team'), 'br')
})
