const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')

const hiveRelaySource = readFileSync(join(__dirname, 'peer-hiverelay.js'), 'utf8')
const peerNetSource = readFileSync(join(__dirname, 'peer-net.js'), 'utf8')

function waitFor (predicate, label = 'condition', timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error(`timed out waiting for ${label}`))
      setTimeout(tick, 10)
    }
    tick()
  })
}

function jsonResponse (body, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => headers[String(name).toLowerCase()] || null },
    json: async () => body
  }
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
  const rateLimits = new Map()
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
      const remaining = rateLimits.get(path) || 0
      if (remaining > 0) {
        rateLimits.set(path, remaining - 1)
        return jsonResponse({ error: 'rate limited by test fixture' }, 429, { 'retry-after': '0' })
      }
      if (path === '/api/token' && method === 'POST') return jsonResponse({ token: `token-${++nextToken}` })
      if (path === '/api/bridge/status' && method === 'GET') return jsonResponse({ ready: true, service: 'outboxlog' })
      if (path === '/api/swarm/join' && method === 'POST') {
        const payload = JSON.parse(init.body || '{}')
        const channelId = `channel-${++nextChannel}`
        channels.set(channelId, { topic: payload.topicHex, source: null })
        return jsonResponse({ channelId, topicHex: payload.topicHex, protocol: payload.protocol, version: payload.version, tier: 'A' })
      }
      if (path === '/api/swarm/events' && method === 'GET') {
        const channelId = parsed.searchParams.get('channelId')
        let source = null
        const body = new ReadableStream({
          start (controller) {
            source = {
              onmessage: event => controller.enqueue(new TextEncoder().encode(`data: ${event.data}\n\n`)),
              closed: false,
              close () {
                if (this.closed) return
                this.closed = true
                leave(channelId)
                try { controller.close() } catch {}
              },
              disconnect () {
                if (this.closed) return
                this.closed = true
                try { controller.close() } catch {}
              }
            }
            setTimeout(() => connect(channelId, source), 0)
          },
          cancel () { if (source) source.close() }
        })
        return { ok: true, status: 200, body, json: async () => null }
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
    drop (channelId) {
      const channel = channels.get(channelId)
      if (channel && channel.source) {
        channel.source.close()
        return true
      }
      return false
    },
    dropFirstOpen () {
      for (const [channelId, channel] of channels) {
        if (channel.source) {
          channel.source.close()
          return channelId
        }
      }
      return ''
    },
    dropStreamWithoutLeaving () {
      for (const [channelId, channel] of channels) {
        if (channel.source && typeof channel.source.disconnect === 'function') {
          channel.source.disconnect()
          return channelId
        }
      }
      return ''
    },
    rateLimit (path, count = 1) {
      rateLimits.set(path, Math.max(0, Number(count) || 0))
    },
    channelIds () { return [...channels.keys()] }
  }
}

function createClient (relay, { fetchEvents = false } = {}) {
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
    ...(fetchEvents ? {} : { EventSource: relay.EventSource }),
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

test('HiveRelay backs off a transient 429 and still delivers the queued turn frame', async () => {
  const relay = createOutboxLogFixture()
  const host = createClient(relay)
  const guest = createClient(relay)
  const topic = host.context.PearCupPeerNet.GAME_TOPIC('relay-rate-limit-room')
  const hostChannel = host.context.PearCupPeerNet.createChannel(topic)
  const guestChannel = guest.context.PearCupPeerNet.createChannel(topic)
  const received = []
  guestChannel.onMessage(message => received.push(message))

  await Promise.all([hostChannel.ready, guestChannel.ready])
  await waitFor(() => relay.channelIds().length === 2, 'rate-limit fixture channels')
  relay.rateLimit('/api/swarm/send', 1)
  hostChannel.send({ t: 'commit', kickId: 0, hash: 'rate-limit-proof', room: 'relay-rate-limit-room', sender: 'host' })

  await waitFor(() => received.some(message => message && message.t === 'commit'), 'delivery after transient 429', 5_000)
  assert.ok(relay.calls.filter(call => call.path === '/api/swarm/send').length >= 2)
  hostChannel.close()
  guestChannel.close()
})

test('HiveRelay advisory bursts cannot starve a newer critical turn frame', async () => {
  const relay = createOutboxLogFixture()
  const host = createClient(relay)
  const guest = createClient(relay)
  const topic = host.context.PearCupPeerNet.GAME_TOPIC('relay-priority-room')
  const hostChannel = host.context.PearCupPeerNet.createChannel(topic)
  const guestChannel = guest.context.PearCupPeerNet.createChannel(topic)
  const received = []
  guestChannel.onMessage(message => received.push(message))

  await Promise.all([hostChannel.ready, guestChannel.ready])
  await waitFor(() => relay.channelIds().length === 2, 'priority fixture channels')
  for (let i = 0; i < 20; i++) hostChannel.send({ t: 'nudge', kickId: 0, want: 'dive' })
  hostChannel.send({ t: 'commit', kickId: 1, hash: 'priority-proof', room: 'relay-priority-room', sender: 'host' })

  await waitFor(() => received.some(message => message && message.t === 'commit' && message.kickId === 1), 'critical frame after advisory burst', 5_000)
  hostChannel.close()
  guestChannel.close()
})

test('HiveRelay replay descriptors never become live recipients or generate replay ACKs', async () => {
  const relay = createOutboxLogFixture()
  const host = createClient(relay)
  const guest = createClient(relay)
  const topic = host.context.PearCupPeerNet.GAME_TOPIC('relay-replay-room')
  const hostChannel = host.context.PearCupPeerNet.createChannel(topic)
  const guestChannel = guest.context.PearCupPeerNet.createChannel(topic)

  await Promise.all([hostChannel.ready, guestChannel.ready])
  hostChannel.send({ t: 'hello', room: 'relay-replay-room', sender: 'host' })
  await waitFor(() => relay.calls.some(call => call.path === '/api/swarm/send'), 'initial descriptor delivery')
  hostChannel.close()
  guestChannel.close()
  await new Promise(resolve => setTimeout(resolve, 30))

  const sendsBeforeReplay = relay.calls.filter(call => call.path === '/api/swarm/send').length
  const late = createClient(relay)
  const lateChannel = late.context.PearCupPeerNet.createChannel(topic)
  await lateChannel.ready
  // If cache-* were mistaken for a live peer, replay processing would ACK the
  // descriptor and this queued presence frame would also be sent to it.
  lateChannel.send({ t: 'presence', room: 'relay-replay-room', sender: 'late' })
  await new Promise(resolve => setTimeout(resolve, 80))

  const replaySends = relay.calls.filter(call => call.path === '/api/swarm/send').slice(sendsBeforeReplay)
  assert.equal(
    replaySends.some(call => /^cache-/i.test(JSON.parse(call.body || '{}').peerId || '')),
    false,
    'replayed descriptors must never be acknowledged or targeted as live channels'
  )
  lateChannel.close()
})

test('HiveRelay match peer limit replaces a stale native channel mapping', async () => {
  const relay = createOutboxLogFixture()
  const host = createClient(relay, { fetchEvents: true })
  const topic = host.context.PearCupPeerNet.GAME_TOPIC('runtime-stale-peer-room')
  const makeChannel = (peerLimit = 0) => host.context.PearCupHiveRelay.createChannel(topic, {
    rootObject: host.context,
    ...(peerLimit ? { peerLimit } : {})
  })
  const hostChannel = makeChannel(1)
  const firstChannel = makeChannel()
  const secondChannel = makeChannel()
  const receivedBySecond = []
  secondChannel.onMessage(message => receivedBySecond.push(message))

  await Promise.all([hostChannel.ready, firstChannel.ready, secondChannel.ready])
  await waitFor(() => relay.calls.filter(call => call.path === '/api/swarm/join').length === 3, 'stale-peer fixture joins')
  await waitFor(() => relay.channelIds().length === 3, `stale-peer fixture channels (${relay.channelIds().length})`)
  await new Promise(resolve => setTimeout(resolve, 300))
  hostChannel.send({ t: 'commit', kickId: 0, hash: 'fresh-peer-proof' })
  await waitFor(() => receivedBySecond.some(message => message && message.t === 'commit'), 'fresh peer delivery', 5_000)

  const sendCalls = relay.calls.filter(call => call.path === '/api/swarm/send')
  const targets = new Set(sendCalls.map(call => JSON.parse(call.body || '{}').peerId).filter(Boolean))
  assert.equal(targets.has(relay.channelIds()[1]), false, 'host must stop targeting the stale first peer')
  assert.ok(targets.has(relay.channelIds()[2]), 'host must target the newest live peer')
  hostChannel.close()
  firstChannel.close()
  secondChannel.close()
})

test('HiveRelay fetch-based SSE path delivers between Pear Runtime clients without EventSource', async () => {
  const relay = createOutboxLogFixture()
  const host = createClient(relay, { fetchEvents: true })
  const guest = createClient(relay, { fetchEvents: true })
  const topic = host.context.PearCupPeerNet.GAME_TOPIC('runtime-fetch-sse-room')
  const hostChannel = host.context.PearCupPeerNet.createChannel(topic)
  const guestChannel = guest.context.PearCupPeerNet.createChannel(topic)
  const received = []
  guestChannel.onMessage(message => received.push(message))

  await Promise.all([hostChannel.ready, guestChannel.ready])
  hostChannel.send({ t: 'hello', room: 'runtime-fetch-sse-room', sender: 'native-host' })
  await waitFor(() => received.length === 1, 'fetch SSE HiveRelay delivery')

  assert.deepEqual(JSON.parse(JSON.stringify(received[0])), {
    t: 'hello', room: 'runtime-fetch-sse-room', sender: 'native-host'
  })
  assert.ok(relay.calls.some(call => call.path === '/api/swarm/events' && call.method === 'GET'))
  hostChannel.close()
  guestChannel.close()
})

test('HiveRelay re-joins a stalled runtime stream before retrying a critical turn frame', async () => {
  const relay = createOutboxLogFixture()
  const host = createClient(relay, { fetchEvents: true })
  const guest = createClient(relay, { fetchEvents: true })
  const topic = host.context.PearCupPeerNet.GAME_TOPIC('runtime-rejoin-room')
  const hostChannel = host.context.PearCupPeerNet.createChannel(topic)
  const guestChannel = guest.context.PearCupPeerNet.createChannel(topic)
  const received = []
  guestChannel.onMessage(message => received.push(message))

  await Promise.all([hostChannel.ready, guestChannel.ready])
  await waitFor(() => relay.channelIds().length === 2, 'initial runtime relay channels')
  await waitFor(() => Boolean(relay.dropFirstOpen()), 'open runtime relay stream')
  assert.equal(relay.channelIds().length, 1)
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(received.length, 0)
  hostChannel.send({ t: 'commit', kickId: 0, hash: 'rejoin-proof', room: 'runtime-rejoin-room', sender: 'host' })
  guestChannel.send({ t: 'dive', kickId: 0, zone: 'right-high', room: 'runtime-rejoin-room', sender: 'guest' })

  await waitFor(() => received.some(message => message && message.t === 'commit' && message.kickId === 0), 'critical frame after relay rejoin', 16_000)
  assert.equal(relay.channelIds().length, 2)
  hostChannel.close()
  guestChannel.close()
})

test('HiveRelay exposes an explicit recovery hook for a keeper-side stalled stream', async () => {
  const relay = createOutboxLogFixture()
  const host = createClient(relay, { fetchEvents: true })
  const guest = createClient(relay, { fetchEvents: true })
  const topic = host.context.PearCupPeerNet.GAME_TOPIC('runtime-explicit-recovery-room')
  const hostChannel = host.context.PearCupPeerNet.createChannel(topic)
  const guestChannel = guest.context.PearCupPeerNet.createChannel(topic)
  const received = []
  guestChannel.onMessage(message => received.push(message))

  await Promise.all([hostChannel.ready, guestChannel.ready])
  const initialIds = relay.channelIds()
  assert.equal(initialIds.length, 2)
  await hostChannel.requestRecovery('keeper-side test recovery')
  await waitFor(() => relay.channelIds().length === 2, 'explicit recovery channels')
  hostChannel.send({ t: 'commit', kickId: 0, hash: 'explicit-recovery-proof', room: 'runtime-explicit-recovery-room', sender: 'host' })
  await waitFor(() => received.some(message => message && message.t === 'commit' && message.kickId === 0), 'critical frame after explicit recovery', 4_000)
  assert.notDeepEqual(relay.channelIds(), initialIds)
  hostChannel.close()
  guestChannel.close()
})

test('HiveRelay does not churn healthy match streams during quiet play', async () => {
  const relay = createOutboxLogFixture()
  const host = createClient(relay, { fetchEvents: true })
  const guest = createClient(relay, { fetchEvents: true })
  const topic = host.context.PearCupPeerNet.GAME_TOPIC('runtime-idle-refresh-room')
  const hostChannel = host.context.PearCupPeerNet.createChannel(topic)
  const guestChannel = guest.context.PearCupPeerNet.createChannel(topic)
  const received = []
  guestChannel.onMessage(message => received.push(message))
  hostChannel.setRefreshEnabled(true)
  guestChannel.setRefreshEnabled(true)

  await Promise.all([hostChannel.ready, guestChannel.ready])
  await waitFor(() => relay.channelIds().length === 2, 'initial idle-refresh channels')
  await waitFor(() => relay.calls.filter(call => call.path === '/api/swarm/events').length === 2, 'open quiet-play streams')
  const joinsBeforeQuietPeriod = relay.calls.filter(call => call.path === '/api/swarm/join').length
  await new Promise(resolve => setTimeout(resolve, 8_500))
  assert.equal(relay.calls.filter(call => call.path === '/api/swarm/join').length, joinsBeforeQuietPeriod)
  hostChannel.send({ t: 'commit', kickId: 0, hash: 'idle-refresh-proof', room: 'runtime-idle-refresh-room', sender: 'host' })

  await waitFor(() => received.some(message => message && message.t === 'commit' && message.kickId === 0), 'critical frame after quiet period', 4_000)
  hostChannel.close()
  guestChannel.close()
})

test('HiveRelay reopens a dropped fetch SSE stream without changing its channel', async () => {
  const relay = createOutboxLogFixture()
  const host = createClient(relay, { fetchEvents: true })
  const guest = createClient(relay, { fetchEvents: true })
  const topic = host.context.PearCupPeerNet.GAME_TOPIC('runtime-sse-reconnect-room')
  const hostChannel = host.context.PearCupPeerNet.createChannel(topic)
  const guestChannel = guest.context.PearCupPeerNet.createChannel(topic)
  const received = []
  guestChannel.onMessage(message => received.push(message))

  await Promise.all([hostChannel.ready, guestChannel.ready])
  await waitFor(() => relay.calls.filter(call => call.path === '/api/swarm/events').length === 2, 'initial reconnect streams')
  const channelIdsBefore = relay.channelIds().sort()
  await waitFor(() => Boolean(relay.dropStreamWithoutLeaving()), 'open stream to disconnect', 2_000)
  await waitFor(() => relay.calls.filter(call => call.path === '/api/swarm/events').length >= 3, 'automatic fetch SSE reconnect', 4_000)
  assert.deepEqual(relay.channelIds().sort(), channelIdsBefore)

  hostChannel.send({ t: 'commit', kickId: 0, hash: 'sse-reconnect-proof', room: 'runtime-sse-reconnect-room', sender: 'host' })
  await waitFor(() => received.some(message => message && message.t === 'commit' && message.kickId === 0), 'delivery after fetch SSE reconnect', 4_000)
  hostChannel.close()
  guestChannel.close()
})

test('HiveRelay reuses one token and status handshake across an app session channels', async () => {
  const relay = createOutboxLogFixture()
  const client = createClient(relay)
  const first = client.context.PearCupPeerNet.createChannel(client.context.PearCupPeerNet.GAME_TOPIC('session-one'))
  const second = client.context.PearCupPeerNet.createChannel(client.context.PearCupPeerNet.WATCH_TOPIC('session-two'))
  await Promise.all([first.ready, second.ready])

  assert.equal(relay.calls.filter(call => call.path === '/api/token').length, 1)
  assert.equal(relay.calls.filter(call => call.path === '/api/bridge/status').length, 1)
  assert.equal(relay.calls.filter(call => call.path === '/api/swarm/join').length, 2)
  first.close()
  second.close()
})

test('HiveRelay settings reject credentialed or non-HTTPS public relay URLs', () => {
  const { context } = createClient(createOutboxLogFixture())
  const api = context.PearCupHiveRelay
  assert.equal(api.normalizeRelayUrl('https://relay.example.test/'), 'https://relay.example.test')
  assert.equal(api.normalizeRelayUrl('https://token@relay.example.test'), '')
  assert.equal(api.normalizeRelayUrl('http://relay.example.test'), '')
  assert.equal(api.normalizeRelayUrl('http://127.0.0.1:8787'), 'http://127.0.0.1:8787')
})

test('same-origin child frames inside Pear Runtime use the native relay proxy', () => {
  const { context } = createClient(createOutboxLogFixture())
  const settings = context.PearCupHiveRelay.relaySettings({
    location: { href: 'http://localhost:9190/?join=room#games' },
    parent: { Pear: {} },
    PearCupRuntimeSettingsValue: {
      peerRelay: { enabled: true, relayUrl: 'https://outbox.pearcup.test', service: 'outboxlog' }
    }
  })
  assert.equal(settings.relayUrl, 'http://localhost:9190/pearcup-hiverelay')
})

test('Games backend badge names the shared HiveRelay transport', () => {
  const source = readFileSync(join(__dirname, 'app.js'), 'utf8')
  assert.match(source, /hiverelay-outboxlog-v2/)
  assert.match(source, /HiveRelay live sync/)
})
