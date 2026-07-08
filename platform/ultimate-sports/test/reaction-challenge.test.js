'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')

function clone (obj) { return JSON.parse(JSON.stringify(obj)) }

// Load a fresh ReactionChallenge module instance with stubbed browser globals.
function loadModule () {
  const prevPeerNet = global.PearCupPeerNet
  const prevRoomAccess = global.PearCupRoomAccess
  const prevDocument = global.document
  const prevUltimateFit = global.ULTIMATE_FIT_CONFIG
  const prevCore = global.PearCupCore
  const prevAdapters = global.PearCupAdapters

  try {
    global.document = {
      documentElement: {
        dataset: {}
      }
    }

    global.PearCupCore = require('../shell/core.js')
    global.PearCupAdapters = require('../shell/adapters.js')

    global.PearCupRoomAccess = {
      enforced: false,
      myCredential: () => null,
      verify: async () => true,
      signChallenge: async () => null,
      verifyProof: async () => false
    }

    // The module reads Net from globalThis (global in Node).
    // We rely on the caller having set up PearCupPeerNet with createChannel.
    delete require.cache[require.resolve('../shell/reaction-challenge.js')]
    require('../shell/reaction-challenge.js')
    return global.ReactionChallenge
  } finally {
    global.PearCupPeerNet = prevPeerNet
    global.PearCupRoomAccess = prevRoomAccess
    global.document = prevDocument
    global.ULTIMATE_FIT_CONFIG = prevUltimateFit
    global.PearCupCore = prevCore
    global.PearCupAdapters = prevAdapters
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
    digest,
    commitHash: (aim, nonce) => digest(`${aim}|${nonce}`),
    createChannel
  }
}

function loadClient (peerNet) {
  global.PearCupPeerNet = peerNet || makePeerNet()
  return loadModule()
}

test('schedule is deterministic for identical seed and options', () => {
  const RC = loadClient()
  const helpers = RC._testHelpers
  const seed = helpers.buildSeed('peer-a', 'peer-b', 'nonce-1', 'nonce-2')
  const a = helpers.buildSchedule(seed, ['goal', 'save', 'penalty'], 5)
  const b = helpers.buildSchedule(seed, ['goal', 'save', 'penalty'], 5)
  assert.deepEqual(a, b)
  assert.equal(a.length, 5)
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].round, i)
    assert.ok(a[i].id)
    assert.ok(a[i].kind)
    assert.ok(Number.isFinite(a[i].appearAt))
    assert.equal(a[i].windowMs, 800)
  }
})

test('different peer-id ordering yields the same seed', () => {
  const RC = loadClient()
  const helpers = RC._testHelpers
  const seedAB = helpers.buildSeed('peer-a', 'peer-b', 'n1', 'n2')
  const seedBA = helpers.buildSeed('peer-b', 'peer-a', 'n2', 'n1')
  assert.equal(seedAB, seedBA)
})

test('fastest valid tap wins the moment', () => {
  const RC = loadClient()
  const helpers = RC._testHelpers
  const moment = { appearAt: 1000, windowMs: 800 }

  assert.equal(helpers.scoreMoment(moment, 1200, 1300).winner, 'you')
  assert.equal(helpers.scoreMoment(moment, 1300, 1200).winner, 'opp')
})

test('tap before the moment appears is rejected', () => {
  const RC = loadClient()
  const helpers = RC._testHelpers
  const moment = { appearAt: 1000, windowMs: 800 }

  const localEarly = helpers.scoreMoment(moment, 999, 1200)
  assert.equal(localEarly.winner, 'opp')
  assert.equal(localEarly.reason, 'you-missed')

  const remoteEarly = helpers.scoreMoment(moment, 1200, 999)
  assert.equal(remoteEarly.winner, 'you')
  assert.equal(remoteEarly.reason, 'opponent-missed')

  const bothEarly = helpers.scoreMoment(moment, 500, 600)
  assert.equal(bothEarly.winner, null)
  assert.equal(bothEarly.reason, 'no-valid-tap')
})

test('tap after the window closes is rejected', () => {
  const RC = loadClient()
  const helpers = RC._testHelpers
  const moment = { appearAt: 1000, windowMs: 800 }

  assert.equal(helpers.scoreMoment(moment, 1801, 1200).winner, 'opp')
  assert.equal(helpers.scoreMoment(moment, 1200, 1801).winner, 'you')
})

test('integration: fastest valid tap wins a round', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 })

  let snap1 = null
  let snap2 = null
  let client1, client2

  try {
    const peerNet = makePeerNet()
    client1 = loadClient(peerNet)
    client2 = loadClient(peerNet)

    const unsub1 = client1.onState(s => { snap1 = s })
    const unsub2 = client2.onState(s => { snap2 = s })

    const code = client1.host('ROOM1')
    client2.join(code)

    // Handshake is synchronous in our stub, so both clients should be started.
    assert.equal(snap1.active, true)
    assert.equal(snap1.started, true)
    assert.equal(snap2.active, true)
    assert.equal(snap2.started, true)
    assert.deepEqual(snap1.schedule, snap2.schedule)

    const moment = snap1.schedule[0]

    // Advance to the moment appearance.
    t.mock.timers.tick(moment.appearAt)

    // Player 1 taps first, then player 2 a millisecond later.
    t.mock.timers.tick(1)
    const p1Tapped = client1.tap(moment.id)
    assert.equal(p1Tapped, true)

    t.mock.timers.tick(1)
    const p2Tapped = client2.tap(moment.id)
    assert.equal(p2Tapped, true)

    // Resolve the moment inside the window (include the reveal grace period).
    t.mock.timers.tick(moment.windowMs + 200)

    assert.equal(snap1.scores.you, 1)
    assert.equal(snap1.scores.opp, 0)
    assert.equal(snap2.scores.you, 0)
    assert.equal(snap2.scores.opp, 1)

    unsub1()
    unsub2()
  } finally {
    if (client1) client1.leave()
    if (client2) client2.leave()
    t.mock.timers.reset()
  }
})

test('integration: replayed/duplicate taps do not double-count', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 })

  let snap1 = null
  let snap2 = null
  let client1, client2

  try {
    const peerNet = makePeerNet()
    client1 = loadClient(peerNet)
    client2 = loadClient(peerNet)

    const unsub1 = client1.onState(s => { snap1 = s })
    const unsub2 = client2.onState(s => { snap2 = s })

    const code = client1.host('ROOM2')
    client2.join(code)

    const moment = snap1.schedule[0]
    t.mock.timers.tick(moment.appearAt)

    // Local duplicate on client1 should be ignored.
    assert.equal(client1.tap(moment.id), true)
    assert.equal(client1.tap(moment.id), false)

    // Client2 taps once legitimately.
    t.mock.timers.tick(1)
    assert.equal(client2.tap(moment.id), true)

    // Inject a replayed remote tap into client2; should be ignored.
    const replayTs = snap1.localTaps[moment.id]
    const replayed = client2._testHelpers.simulateRemoteTap(moment.id, replayTs)
    assert.equal(replayed, true)
    const replayedAgain = client2._testHelpers.simulateRemoteTap(moment.id, replayTs)
    assert.equal(replayedAgain, true) // injection accepted syntactically, but state ignores it

    t.mock.timers.tick(moment.windowMs + 200)

    // Only one point awarded (client1 wins); no double-counting.
    assert.equal(snap1.scores.you, 1)
    assert.equal(snap1.scores.opp, 0)
    assert.equal(snap2.scores.you, 0)
    assert.equal(snap2.scores.opp, 1)

    unsub1()
    unsub2()
  } finally {
    if (client1) client1.leave()
    if (client2) client2.leave()
    t.mock.timers.reset()
  }
})

test('integration: game completes after all rounds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 })

  let snap1 = null
  let snap2 = null
  let receipt = null
  let client1, client2

  try {
    global.postSettlementReceipt = (r) => { receipt = r }

    const peerNet = makePeerNet()
    client1 = loadClient(peerNet)
    client2 = loadClient(peerNet)

    const unsub1 = client1.onState(s => { snap1 = s })
    const unsub2 = client2.onState(s => { snap2 = s })

    const code = client1.host('ROOM3')
    client2.join(code)

    for (const moment of snap1.schedule) {
      t.mock.timers.tick(moment.appearAt - Date.now())
      t.mock.timers.tick(1)
      client1.tap(moment.id)
      t.mock.timers.tick(moment.windowMs + 200)
    }

    assert.equal(snap1.over, true)
    assert.equal(snap2.over, true)
    assert.equal(snap1.scores.you, 5)
    assert.equal(snap1.scores.opp, 0)
    assert.equal(snap2.scores.you, 0)
    assert.equal(snap2.scores.opp, 5)

    assert.ok(receipt)
    assert.equal(receipt.gameType, 'reaction-challenge')
    assert.equal(receipt.room, code)
    assert.ok(receipt.players.includes(receipt.winner))
    assert.equal(Object.keys(receipt.scores).length, 2)

    unsub1()
    unsub2()
  } finally {
    delete global.postSettlementReceipt
    if (client1) client1.leave()
    if (client2) client2.leave()
    t.mock.timers.reset()
  }
})
test('integration: mismatched remote commitment loses the round', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 })

  let snap1 = null
  let snap2 = null
  let client1, client2

  try {
    const peerNet = makePeerNet()
    client1 = loadClient(peerNet)
    client2 = loadClient(peerNet)

    const unsub1 = client1.onState(s => { snap1 = s })
    const unsub2 = client2.onState(s => { snap2 = s })

    const code = client1.host('ROOM-MISMATCH')
    client2.join(code)

    const moment = snap1.schedule[0]
    t.mock.timers.tick(moment.appearAt)

    // Client1 taps first; client2 taps shortly after.
    t.mock.timers.tick(10)
    assert.equal(client1.tap(moment.id), true)
    t.mock.timers.tick(10)
    assert.equal(client2.tap(moment.id), true)

    // Client1 receives a forged remote reveal that does not match client2's commitment.
    client1._testHelpers.simulateRemoteReveal(moment.round, Date.now(), 'forged-nonce')

    t.mock.timers.tick(moment.windowMs + 200)

    // Client1's local timestamp is valid and verified; the remote reveal fails verification.
    assert.equal(snap1.scores.you, 1)
    assert.equal(snap1.scores.opp, 0)

    unsub1()
    unsub2()
  } finally {
    if (client1) client1.leave()
    if (client2) client2.leave()
    t.mock.timers.reset()
  }
})

test('integration: impossible latency produces a disputed QVAC attestation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 })

  let snap1 = null
  let snap2 = null
  let client1, client2

  try {
    const peerNet = makePeerNet()
    client1 = loadClient(peerNet)
    client2 = loadClient(peerNet)

    const unsub1 = client1.onState(s => { snap1 = s })
    const unsub2 = client2.onState(s => { snap2 = s })

    const code = client1.host('ROOM-FAST')
    client2.join(code)

    const moment = snap1.schedule[0]
    t.mock.timers.tick(moment.appearAt)

    // Both players tap within 50 ms of the moment appearing — biologically implausible.
    t.mock.timers.tick(1)
    assert.equal(client1.tap(moment.id), true)
    t.mock.timers.tick(2)
    assert.equal(client2.tap(moment.id), true)

    t.mock.timers.tick(moment.windowMs + 200)

    const roundId = `rc-${moment.round + 1}`
    const attestation1 = snap1.qvacAttestations[roundId]
    const attestation2 = snap2.qvacAttestations[roundId]
    assert.ok(attestation1)
    assert.ok(attestation2)
    assert.equal(attestation1.review.ruling, 'disputed')
    assert.equal(attestation1.ruling, 'disputed')
    assert.ok(attestation1.rationale.includes('Impossible'))

    unsub1()
    unsub2()
  } finally {
    if (client1) client1.leave()
    if (client2) client2.leave()
    t.mock.timers.reset()
  }
})

test('integration: opponent disconnect forfeits the match', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 })

  let snap1 = null
  let snap2 = null
  let client1, client2

  try {
    const peerNet = makePeerNet()
    client1 = loadClient(peerNet)
    client2 = loadClient(peerNet)

    const unsub1 = client1.onState(s => { snap1 = s })
    const unsub2 = client2.onState(s => { snap2 = s })

    const code = client1.host('ROOM-FORFEIT')
    client2.join(code)

    const moment = snap1.schedule[0]
    t.mock.timers.tick(moment.appearAt)
    t.mock.timers.tick(10)
    assert.equal(client1.tap(moment.id), true)

    // Client1 disconnects mid-round.
    t.mock.timers.tick(10)
    client1.leave()

    // Let the forfeit timer fire on client2.
    t.mock.timers.tick(1)

    assert.equal(snap2.over, true)
    assert.equal(snap2.scores.you, snap2.totalRounds)

    const attestation = snap2.qvacAttestations['rc-1']
    assert.ok(attestation)
    assert.equal(attestation.ruling, 'forfeit')
    assert.ok(attestation.winnerUserId)


    unsub1()
    unsub2()
  } finally {
    if (client2) client2.leave()
    t.mock.timers.reset()
  }
})
