'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { createHostBridge, PROTOCOL } = require('../shell/host-bridge.js')

function hostedEnv () {
  const sent = []
  const listeners = {}
  const selfWin = {}
  const topWin = {} // different object => embedded/hosted
  const bridge = createHostBridge({
    self: selfWin,
    top: topWin,
    parent: { postMessage: (msg) => sent.push(msg) },
    addEventListener: (type, handler) => { listeners[type] = handler }
  })
  return { bridge, sent, listeners }
}

test('standalone (self === top) is inert', () => {
  const sent = []
  const win = {}
  const bridge = createHostBridge({
    self: win,
    top: win, // same object => top-level, not hosted
    parent: { postMessage: (msg) => sent.push(msg) },
    addEventListener: () => { throw new Error('should not register a listener when standalone') }
  })
  assert.equal(bridge.isHosted(), false)
  let called = false
  bridge.onInit(() => { called = true })
  bridge.reportState({ profile: { username: 'a' }, wallet: { balance: 5 } })
  assert.equal(called, false, 'onInit never fires standalone')
  assert.equal(sent.length, 0, 'reportState is a no-op standalone')
})

test('hosted announces readiness and registers a message listener', () => {
  const { bridge, sent, listeners } = hostedEnv()
  assert.equal(bridge.isHosted(), true)
  assert.equal(typeof listeners.message, 'function', 'registered a message listener')
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0], { type: 'ultimate:ready', protocol: PROTOCOL })
})

test('hosted adopts an injected init and notifies listeners', () => {
  const { bridge, listeners } = hostedEnv()
  const seen = []
  bridge.onInit((data) => seen.push(data))
  const payload = { profile: { username: 'vera', team: 'no' }, wallet: { balance: 640, currency: 'USDT' } }
  listeners.message({ data: { type: 'ultimate:init', ...payload } })

  assert.deepEqual(bridge.getInjected(), payload)
  assert.equal(seen.length, 1)
  assert.deepEqual(seen[0], payload)

  // A listener registered AFTER init fires immediately with the buffered value.
  let late = null
  bridge.onInit((data) => { late = data })
  assert.deepEqual(late, payload)
})

test('hosted ignores non-init messages', () => {
  const { bridge, listeners } = hostedEnv()
  listeners.message({ data: { type: 'something-else' } })
  listeners.message({ data: null })
  listeners.message({})
  assert.equal(bridge.getInjected(), null)
})

test('reportState posts a well-formed state message to the host', () => {
  const { bridge, sent } = hostedEnv()
  sent.length = 0 // drop the initial ready
  bridge.reportState({ profile: { username: 'kaito', team: 'jp' }, wallet: { balance: 300 } })
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0], {
    type: 'ultimate:state',
    protocol: PROTOCOL,
    profile: { username: 'kaito', team: 'jp' },
    wallet: { balance: 300 }
  })
})

test('reportState tolerates a partial payload', () => {
  const { bridge, sent } = hostedEnv()
  sent.length = 0
  bridge.reportState({ wallet: { balance: 10 } })
  assert.deepEqual(sent[0], {
    type: 'ultimate:state',
    protocol: PROTOCOL,
    profile: null,
    wallet: { balance: 10 }
  })
})
