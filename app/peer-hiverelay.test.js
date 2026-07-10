const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')

const hiveRelaySource = readFileSync(join(__dirname, 'peer-hiverelay.js'), 'utf8')
const peerNetSource = readFileSync(join(__dirname, 'peer-net.js'), 'utf8')

function waitFor (predicate, label = 'condition') {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > 2500) return reject(new Error(`timed out waiting for ${label}`))
      setTimeout(tick, 10)
    }
    tick()
  })
}

function jsonResponse (body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function base64 (value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64')
}

// An intentionally small, contract-shaped OutboxLog swarm fake. It implements
// only the public HTTP/SSE routes consumed by the PearCup adapter, making this
// test independent of a running relay while still proving the real wire shape.
function createOutboxLogFixture () {
  const channels = new Map()
  const descriptors = new Map()
  const calls = []
  let nextChannel = 0
  let nextToken = 0

  function event (source, payload) {
    setTimeout(() => {
      if (!source.closed && typeof source.onmessage === 'function') source.onmessage({ data: JSON.stringify(payload) })
    }, 0)
  }

  function connect (channelId, source) {
    const channel = channels.get(channelId)
    if (!channel) return
    channel.source = source
    for (const [otherId, other] of channels) {
      if (otherId === channelId || other.topic !== channel.topic || !other.source || other.source.closed) continue
      event(source, { type: 'peer', peerId: otherId, pubkey: null })
      event(other.source, { type: 'peer', peerId: channelId, pubkey: null })
    }
    for (const data of descriptors.get(channel.topic) || []) event(source, { type: 'message', peerId: 'cache', data })
  }

  function leave (channelId) {
    const channel = channels.get(channelId)
    if (!channel) return
    channels.delete(channelId)
    for (const [otherId, other] of channels) {
      if (other.topic === channel.topic && other.source && !other.source.closed) event(other.source, { type: 'peer-leave', peerId: channelId })
    }
  }

  return {
    calls,
    fetch: async (url, init = {}) => {
      const parsed = new URL(url)
      const path = parsed.pathname
      const method = (init.method || 'GET').toUpperCase()
      calls.push({ path, method, body: init.body || '' })
      if (path === '/api/token' && method === 'POST') return jsonResponse({ token: `token-${++nextToken}` })
      if (path === '/api/bridge/status' && method === 'GET') return jsonResponse({ ready: true, service: 'outboxlog' })
      if (path === '/api/swarm/join' && method === 'POST') {
        const payload = JSON.parse(init.body || '{}')
        const channelId = `channel-${++nextChannel}`
        channels.set(channelId, { topic: payload.topicHex, source: null })
        return jsonResponse({ channelId, topicHex: payload.topicHex, protocol: payload.protocol, version: payload.version, tier: 'A' })
      }
      if (path === '/api/swarm/send' && method === 'POST') {
        const payload = JSON.parse(init.body || '{}')
        const sender = channels.get(payload.channelId)
        const target = channels.get(payload.peerId)
        if (!sender || !target) return jsonResponse({ error: 'unknown channel' }, 404)
        if (!descriptors.has(sender.topic)) descriptors.set(sender.topic, new Set())
        descriptors.get(sender.topic).add(payload.data)
        if (target.source) event(target.source, { type: 'message', peerId: payload.channelId, data: payload.data })
        return jsonResponse({ ok: true })
      }
      if (path === '/api/swarm/leave' && method === 'POST') {
        leave(JSON.parse(init.body || '{}').channelId)
        return jsonResponse({ ok: true })
      }
      return jsonResponse({ error: 'not found' }, 404)
    },
    EventSource: function EventSource (url) {
      const parsed = new URL(url)
      const channelId = parsed.searchParams.get('channelId')
      const source = {
        onmessage: null,
        onerror: null,
        closed: false,
        close () {
          if (this.closed) return
          this.closed = true
          leave(channelId)
        }
      }
      setTimeout(() => connect(channelId, source), 0)
      return source
    },
    inject (channelId, frame) {
      const channel = channels.get(channelId)
      if (channel && channel.source) event(channel.source, { type: 'message', peerId: 'attacker', data: base64(frame) })
    },
    channelIds () { return [...channels.keys()] }
  }
}

function createClient (relay) {
  const document = { documentElement: { dataset: {} } }
  const context = {
    console,
    URL,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    crypto: globalThis.crypto,
    btoa: globalThis.btoa,
    atob: globalThis.atob,
    fetch: relay.fetch,
    EventSource: relay.EventSource,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    document,
    CustomEvent: class CustomEvent { constructor (type, init) { this.type = type; this.detail = init && init.detail } },
    dispatchEvent () {},
    PearCupRuntimeSettingsValue: {
      peerRelay: { enabled: true, relayUrl: 'https://outbox.pearcup.test', service: 'outboxlog', protocol: 'pearcup-sync-v2' }
    }
  }
  context.window = context
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(hiveRelaySource, context, { filename: 'peer-hiverelay.js' })
  vm.runInContext(peerNetSource, context, { filename: 'peer-net.js' })
  return { context, document }
}

test('HiveRelay transport delivers a signed queued message between isolated browser clients', async () => {
  const relay = createOutboxLogFixture()
  const host = createClient(relay)
  const guest = createClient(relay)
  const topic = host.context.PearCupPeerNet.GAME_TOPIC('relay-room')
  const hostChannel = host.context.PearCupPeerNet.createChannel(topic)
  const received = []

  // A host sends immediately, before a friend has joined. The adapter queues
  // it through its async token/key handshake and flushes it on peer discovery.
  hostChannel.send({ t: 'hello', room: 'relay-room', sender: 'host' })
  const guestChannel = guest.context.PearCupPeerNet.createChannel(topic)
  guestChannel.onMessage(message => received.push(message))

  await Promise.all([hostChannel.ready, guestChannel.ready])
  await waitFor(() => received.length === 1, 'signed HiveRelay delivery')

  assert.equal(hostChannel.backend, 'hiverelay-outboxlog-v2')
  assert.equal(guestChannel.backend, 'hiverelay-outboxlog-v2')
  assert.deepEqual(JSON.parse(JSON.stringify(received[0])), { t: 'hello', room: 'relay-room', sender: 'host' })
  assert.equal(host.document.documentElement.dataset.pearcupPeerNet, 'hiverelay-outboxlog-v2')
  assert.ok(relay.calls.some(call => call.path === '/api/token' && call.method === 'POST'))
  assert.ok(relay.calls.some(call => call.path === '/api/bridge/status' && call.method === 'GET'))
  assert.ok(relay.calls.some(call => call.path === '/api/swarm/join' && call.method === 'POST'))
  assert.ok(relay.calls.some(call => call.path === '/api/swarm/send' && call.method === 'POST'))

  // A relay (or other client) cannot inject an unsigned message into the app.
  relay.inject(relay.channelIds()[1], { v: 2, id: 'forged', room: topic, kind: 'data', body: { t: 'chat', text: 'forged' } })
  await new Promise(resolve => setTimeout(resolve, 40))
  assert.equal(received.length, 1)

  hostChannel.close()
  guestChannel.close()
})

test('HiveRelay settings reject credentialed or non-HTTPS public relay URLs', () => {
  const { context } = createClient(createOutboxLogFixture())
  const api = context.PearCupHiveRelay
  assert.equal(api.normalizeRelayUrl('https://relay.example.test/'), 'https://relay.example.test')
  assert.equal(api.normalizeRelayUrl('https://token@relay.example.test'), '')
  assert.equal(api.normalizeRelayUrl('http://relay.example.test'), '')
  assert.equal(api.normalizeRelayUrl('http://127.0.0.1:8787'), 'http://127.0.0.1:8787')
})

test('Games backend badge names the shared HiveRelay transport', () => {
  const source = readFileSync(join(__dirname, 'app.js'), 'utf8')
  assert.match(source, /hiverelay-outboxlog-v2/)
  assert.match(source, /HiveRelay live sync/)
})
