'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')

function clone (obj) { return JSON.parse(JSON.stringify(obj)) }

function loadModule () {
  const prevPeerNet = global.PearCupPeerNet
  const prevRoomAccess = global.PearCupRoomAccess
  const prevDocument = global.document
  const prevState = global.state
  const prevUltimateFit = global.ULTIMATE_FIT_CONFIG

  try {
    global.document = { documentElement: { dataset: {} } }
    global.PearCupRoomAccess = {
      enforced: false,
      myCredential: () => null,
      verify: async () => true,
      signChallenge: async () => null,
      verifyProof: async () => false
    }
    global.state = { username: 'Player' }

    delete require.cache[require.resolve('../shell/live-market-game.js')]
    require('../shell/live-market-game.js')
    return global.LiveMarketGame
  } finally {
    global.PearCupPeerNet = prevPeerNet
    global.PearCupRoomAccess = prevRoomAccess
    global.document = prevDocument
    global.state = prevState
    global.ULTIMATE_FIT_CONFIG = prevUltimateFit
  }
}

function makePeerNet () {
  const bus = new EventEmitter()
  const allChannels = []

  function digest (str) {
    let h = 5381
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
    return h.toString(16).padStart(8, '0')
  }

  function createChannel (topic) {
    const id = allChannels.length
    const listeners = new Set()
    const chan = { id, topic, listeners }
    allChannels.push(chan)
    bus.on(`msg:${id}`, (msg) => {
      listeners.forEach(fn => {
        try { fn(msg) } catch (e) {}
      })
    })
    return {
      topic,
      send (msg) {
        for (const other of allChannels) {
          if (other.id !== id) {
            bus.emit(`msg:${other.id}`, clone(msg))
          }
        }
      },
      onMessage (fn) {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
      close () {
        bus.removeAllListeners(`msg:${id}`)
        listeners.clear()
      }
    }
  }

  return {
    GAME_TOPIC: (code) => `pearcup:v1:game:${code}`,
    newPeerId: () => `peer-${Math.random().toString(36).slice(2)}`,
    newNonce: () => `nonce-${Math.random().toString(36).slice(2)}`,
    newRoomCode: () => `room-${Math.random().toString(36).slice(2, 8)}`,
    digest,
    createChannel
  }
}

function loadClient (peerNet) {
  global.PearCupPeerNet = peerNet || makePeerNet()
  return loadModule()
}

test('schedule is deterministic for identical seed and options', () => {
  const LM = loadClient()
  const helpers = LM._testHelpers
  const seed = helpers.buildSeed('peer-a', 'peer-b', 'nonce-1', 'nonce-2')
  const a = helpers.buildSchedule('next-event', ['goal', 'corner', 'card'], 3, seed)
  const b = helpers.buildSchedule('next-event', ['goal', 'corner', 'card'], 3, seed)
  assert.deepEqual(a, b)
  assert.equal(a.length, 3)
  for (const r of a) {
    assert.ok(r.id)
    assert.equal(typeof r.round, 'number')
    assert.ok(r.correct)
  }
})

test('different peer-id ordering yields the same seed', () => {
  const LM = loadClient()
  const helpers = LM._testHelpers
  const seedAB = helpers.buildSeed('peer-a', 'peer-b', 'n1', 'n2')
  const seedBA = helpers.buildSeed('peer-b', 'peer-a', 'n2', 'n1')
  assert.equal(seedAB, seedBA)
})

test('scorePick awards exact and result-class points for scoreline-lock', () => {
  const LM = loadClient()
  const helpers = LM._testHelpers

  assert.deepEqual(helpers.scorePick('scoreline-lock', '2-1', '2-1'), { points: 3, reason: 'exact' })
  assert.deepEqual(helpers.scorePick('scoreline-lock', '3-1', '2-1'), { points: 1, reason: 'result-class' })
  assert.deepEqual(helpers.scorePick('scoreline-lock', '1-2', '2-1'), { points: 0, reason: 'miss' })
  assert.deepEqual(helpers.scorePick('scoreline-lock', '1-1', '2-1'), { points: 0, reason: 'miss' })
})

test('integration: next-event resolves when both players pick the correct option', () => {
  const peerNet = makePeerNet()
  const client1 = loadClient(peerNet)
  const client2 = loadClient(peerNet)

  let snap1 = null
  let snap2 = null
  const unsub1 = client1.onState(s => { snap1 = s })
  const unsub2 = client2.onState(s => { snap2 = s })

  try {
    const code = client1.host(undefined, { gameType: 'next-event', options: ['goal'], rounds: 1 })
    client2.join(code, { gameType: 'next-event', options: ['goal'], rounds: 1 })

    assert.equal(snap1.active, true)
    assert.equal(snap1.started, true)
    assert.equal(snap2.started, true)
    assert.equal(snap1.schedule.length, 1)
    assert.deepEqual(snap1.schedule, snap2.schedule)

    const correct = snap1.schedule[0].correct
    assert.equal(correct, 'goal')

    assert.equal(client1.pick(correct), true)
    assert.equal(client2.pick(correct), true)

    assert.equal(snap1.over, true)
    assert.equal(snap2.over, true)
    assert.equal(snap1.scores.you, 1)
    assert.equal(snap1.scores.opp, 1)
  } finally {
    unsub1()
    unsub2()
    client1.leave()
    client2.leave()
  }
})

test('integration: scoreline-lock resolves exact and result-class picks', () => {
  const peerNet = makePeerNet()
  const client1 = loadClient(peerNet)
  const client2 = loadClient(peerNet)

  let snap1 = null
  let snap2 = null
  const unsub1 = client1.onState(s => { snap1 = s })
  const unsub2 = client2.onState(s => { snap2 = s })

  try {
    const code = client1.host(undefined, { gameType: 'scoreline-lock', rounds: 1 })
    client2.join(code, { gameType: 'scoreline-lock', rounds: 1 })

    const correct = snap1.schedule[0].correct
    const [home, away] = correct.split('-').map(n => parseInt(n, 10))
    const sameClass = home > away ? `${home + 1}-${away}` : away > home ? `${home}-${away + 1}` : '1-1'

    client1.pick(correct)
    client2.pick(sameClass)

    assert.equal(snap1.over, true)
    assert.equal(snap1.scores.you, 3)
    assert.equal(snap1.scores.opp, 1)
    assert.equal(snap2.scores.you, 1)
    assert.equal(snap2.scores.opp, 3)
  } finally {
    unsub1()
    unsub2()
    client1.leave()
    client2.leave()
  }
})

test('integration: watch-party-streak completes all rounds and posts a receipt', () => {
  let receipt = null
  global.postSettlementReceipt = (r) => { receipt = r }

  const peerNet = makePeerNet()
  const client1 = loadClient(peerNet)
  const client2 = loadClient(peerNet)

  let snap1 = null
  let snap2 = null
  const unsub1 = client1.onState(s => { snap1 = s })
  const unsub2 = client2.onState(s => { snap2 = s })

  try {
    const code = client1.host(undefined, { gameType: 'watch-party-streak', rounds: 3 })
    client2.join(code, { gameType: 'watch-party-streak', rounds: 3 })

    assert.equal(snap1.schedule.length, 3)

    for (const round of snap1.schedule) {
      client1.pick(round.correct)
      client2.pick(round.correct)
    }

    assert.equal(snap1.over, true)
    assert.equal(snap1.scores.you, 3)
    assert.equal(snap1.scores.opp, 3)
    assert.equal(snap2.scores.you, 3)
    assert.equal(snap2.scores.opp, 3)

    assert.ok(receipt)
    assert.equal(receipt.gameType, 'watch-party-streak')
    assert.equal(receipt.room, code)
    assert.ok(receipt.winner === null)
    assert.equal(Object.keys(receipt.scores).length, 2)
  } finally {
    delete global.postSettlementReceipt
    unsub1()
    unsub2()
    client1.leave()
    client2.leave()
  }
})

test('integration: duplicate local pick and replayed remote pick are ignored', () => {
  const peerNet = makePeerNet()
  const client1 = loadClient(peerNet)
  const client2 = loadClient(peerNet)

  let snap1 = null
  let snap2 = null
  const unsub1 = client1.onState(s => { snap1 = s })
  const unsub2 = client2.onState(s => { snap2 = s })

  try {
    const code = client1.host(undefined, { gameType: 'next-event', options: ['goal'], rounds: 1 })
    client2.join(code, { gameType: 'next-event', options: ['goal'], rounds: 1 })

    const correct = snap1.schedule[0].correct

    assert.equal(client1.pick(correct), true)
    assert.equal(client1.pick(correct), false)

    client2._testHelpers.simulateRemotePick(snap1.schedule[0].id, correct)
    client2._testHelpers.simulateRemotePick(snap1.schedule[0].id, correct)

    client2.pick(correct)

    assert.equal(snap2.scores.you, 1)
    assert.equal(snap2.scores.opp, 1)
  } finally {
    unsub1()
    unsub2()
    client1.leave()
    client2.leave()
  }
})
