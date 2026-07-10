import assert from 'node:assert/strict'
import test from 'node:test'

import { relayTarget, routeAllowed } from '../src/index.js'

test('only exposes the HiveRelay routes PearCup actually needs', () => {
  assert.equal(routeAllowed('POST', '/api/token'), true)
  assert.equal(routeAllowed('GET', '/api/bridge/status'), true)
  assert.equal(routeAllowed('POST', '/api/swarm/join'), true)
  assert.equal(routeAllowed('POST', '/api/swarm/send'), true)
  assert.equal(routeAllowed('POST', '/api/swarm/leave'), true)
  assert.equal(routeAllowed('GET', '/api/swarm/events'), true)
  assert.equal(routeAllowed('GET', '/api/token'), false)
  assert.equal(routeAllowed('POST', '/api/admin/sweep'), false)
  assert.equal(routeAllowed('GET', '/anything-else'), false)
})

test('targets only the configured bare origin and retains the safe SSE query', () => {
  const target = relayTarget('http://172.86.76.209:9100', 'https://relay.example/api/swarm/events?channelId=a&token=b')
  assert.equal(target.href, 'http://172.86.76.209:9100/api/swarm/events?channelId=a&token=b')
  assert.throws(() => relayTarget('https://user:pass@example.com/path', 'https://relay.example/api/token'))
})
