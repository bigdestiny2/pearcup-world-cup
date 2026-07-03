const assert = require('node:assert/strict')
const { test } = require('node:test')

function loadPeerNet (globals) {
  const mod = require.resolve('./peer-net.js')
  delete require.cache[mod]
  const previous = {
    pear: global.pear,
    Pear: global.Pear,
    BroadcastChannel: global.BroadcastChannel,
    document: global.document,
    TextEncoder: global.TextEncoder,
    TextDecoder: global.TextDecoder,
    CustomEvent: global.CustomEvent,
    dispatchEvent: global.dispatchEvent,
    location: global.location,
    URLSearchParams: global.URLSearchParams,
    PearCupEnableBareSwarm: global.PearCupEnableBareSwarm,
    PearCupPeerNetOptions: global.PearCupPeerNetOptions,
    PearCupPeerNet: global.PearCupPeerNet
  }
  Object.assign(global, globals)
  const api = require('./peer-net.js')
  return {
    api,
    restore () {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete global[key]
        else global[key] = value
      }
    }
  }
}

function waitFor (predicate) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      if (predicate()) return resolve()
      if (Date.now() - start > 1000) return reject(new Error('timed out'))
      setTimeout(tick, 5)
    }
    tick()
  })
}

test('PearBrowser swarm.v1 channel queues hello until a peer connects', async (t) => {
  const handlers = new Map()
  const events = []
  const document = { documentElement: { dataset: {} } }
  const fakeChannel = {
    on (event, fn) {
      if (!handlers.has(event)) handlers.set(event, [])
      handlers.get(event).push(fn)
    },
    emit (event, ...args) {
      for (const fn of handlers.get(event) || []) fn(...args)
    },
    destroy () {}
  }
  const joins = []
  const { api, restore } = loadPeerNet({
    pear: {
      swarm: {
        v1: {
          async join (topic, opts) {
            joins.push({ topic, opts })
            return fakeChannel
          }
        }
      }
    },
    Pear: undefined,
    BroadcastChannel: undefined,
    document,
    TextEncoder,
    TextDecoder,
    CustomEvent: class CustomEvent {
      constructor (type, init) {
        this.type = type
        this.detail = init && init.detail
      }
    },
    dispatchEvent (event) {
      events.push(event)
    }
  })
  t.after(restore)

  const channel = api.createChannel(api.GAME_TOPIC('abc123'))
  channel.send({ t: 'hello', room: 'abc123' })
  await waitFor(() => joins.length === 1)

  assert.equal(document.documentElement.dataset.pearcupPeerNetModule, 'ready')
  assert.equal(document.documentElement.dataset.pearcupPeerNet, 'pearbrowser-swarm-v1')
  assert.equal(events.at(-1).type, 'pearcup:p2p-backend')
  assert.deepEqual(events.at(-1).detail, { backend: 'pearbrowser-swarm-v1' })
  assert.equal(joins[0].topic, null)
  assert.equal(joins[0].opts.subtopic, 'pearcup:v1:game:abc123')
  assert.equal(joins[0].opts.protocol, 'pearcup.peer-net.v1')
  assert.equal(joins[0].opts.server, true)
  assert.equal(joins[0].opts.client, true)

  const sent = []
  const peer = {
    id: 'peer-a',
    send (data) {
      sent.push(JSON.parse(new TextDecoder().decode(data)))
    }
  }
  fakeChannel.emit('peer', peer)
  assert.deepEqual(sent, [{ t: 'hello', room: 'abc123' }])

  let received = null
  channel.onMessage(msg => { received = msg })
  fakeChannel.emit('message', peer, new TextEncoder().encode(JSON.stringify({ t: 'hello', room: 'abc123', sender: 'peer-a' })))
  assert.deepEqual(received, { t: 'hello', room: 'abc123', sender: 'peer-a' })
  channel.close()
})

test('Pear Runtime channel does not start the Bare worker unless opted in', async (t) => {
  const rooms = new Map()
  class FakeBroadcastChannel {
    constructor (topic) {
      this.topic = topic
      this.onmessage = null
      if (!rooms.has(topic)) rooms.set(topic, new Set())
      rooms.get(topic).add(this)
    }

    postMessage (data) {
      for (const peer of rooms.get(this.topic) || []) {
        if (peer !== this && peer.onmessage) peer.onmessage({ data })
      }
    }

    close () {
      rooms.get(this.topic)?.delete(this)
    }
  }

  const document = { documentElement: { dataset: {} } }
  const { api, restore } = loadPeerNet({
    pear: undefined,
    Pear: {
      worker: {
        run () {
          throw new Error('Bare worker should not start without explicit opt-in')
        }
      }
    },
    BroadcastChannel: FakeBroadcastChannel,
    document,
    TextEncoder,
    TextDecoder
  })
  t.after(restore)

  const topic = api.WATCH_TOPIC('br-no')
  const channel = api.createChannel(topic)
  assert.equal(document.documentElement.dataset.pearcupPeerNetModule, 'ready')
  assert.equal(channel.backend, 'broadcast-channel')
  channel.close()
})

test('Pear Runtime channel can opt into Bare worker hyperswarm bridge', async (t) => {
  const writes = []
  let onData = null
  const pipe = {
    on (event, fn) {
      if (event === 'data') onData = fn
    },
    write (data) {
      writes.push(JSON.parse(String(data).trim()))
    }
  }
  const document = { documentElement: { dataset: {} } }
  const { api, restore } = loadPeerNet({
    pear: undefined,
    Pear: {
      worker: {
        run (file) {
          assert.equal(file, './swarm-worker.cjs')
          return pipe
        }
      }
    },
    BroadcastChannel: undefined,
    document,
    TextEncoder,
    TextDecoder,
    PearCupEnableBareSwarm: true
  })
  t.after(restore)

  const topic = api.WATCH_TOPIC('br-no')
  const channel = api.createChannel(topic)
  assert.equal(document.documentElement.dataset.pearcupPeerNetModule, 'ready')
  assert.equal(channel.backend, 'hyperswarm')
  assert.deepEqual(writes.shift(), { cmd: 'join', topic })

  let received = null
  channel.onMessage(msg => { received = msg })
  onData(Buffer.from(JSON.stringify({ event: 'message', topic, data: { t: 'reaction', emoji: 'fire' } }) + '\n'))
  assert.deepEqual(received, { t: 'reaction', emoji: 'fire' })

  channel.send({ t: 'chat', text: 'ready' })
  assert.deepEqual(writes.shift(), { cmd: 'send', topic, data: { t: 'chat', text: 'ready' } })

  channel.close()
  assert.deepEqual(writes.shift(), { cmd: 'leave', topic })
})

test('plain browser fallback routes same-origin BroadcastChannel messages', async (t) => {
  const rooms = new Map()
  class FakeBroadcastChannel {
    constructor (topic) {
      this.topic = topic
      this.onmessage = null
      if (!rooms.has(topic)) rooms.set(topic, new Set())
      rooms.get(topic).add(this)
    }

    postMessage (data) {
      for (const peer of rooms.get(this.topic) || []) {
        if (peer !== this && peer.onmessage) peer.onmessage({ data })
      }
    }

    close () {
      rooms.get(this.topic)?.delete(this)
    }
  }

  const document = { documentElement: { dataset: {} } }
  const { api, restore } = loadPeerNet({
    pear: undefined,
    Pear: undefined,
    BroadcastChannel: FakeBroadcastChannel,
    document,
    TextEncoder,
    TextDecoder
  })
  t.after(restore)

  const topic = api.GAME_TOPIC('local')
  const host = api.createChannel(topic)
  const guest = api.createChannel(topic)
  assert.equal(document.documentElement.dataset.pearcupPeerNetModule, 'ready')
  assert.equal(host.backend, 'broadcast-channel')
  assert.equal(guest.backend, 'broadcast-channel')

  let received = null
  guest.onMessage(msg => { received = msg })
  host.send({ t: 'hello', room: 'local' })
  assert.deepEqual(received, { t: 'hello', room: 'local' })

  host.close()
  guest.close()
})
