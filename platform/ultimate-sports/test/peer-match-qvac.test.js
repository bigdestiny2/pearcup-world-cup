'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')

function clone (obj) { return JSON.parse(JSON.stringify(obj)) }

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
    newRoomCode: () => `room-${Math.random().toString(36).slice(2, 8)}`,
    newNonce: () => `nonce-${Math.random().toString(36).slice(2)}`,
    digest,
    commitHash: (aim, nonce) => digest(`${aim}|${nonce}`),
    createChannel
  }
}

function setupGlobals () {
  global.PearCupCore = require('../shell/core.js')
  global.PearCupAdapters = require('../shell/adapters.js')
  global.PearCupRoomAccess = {
    enforced: false,
    myCredential: () => null,
    verify: async () => true,
    signChallenge: async () => null,
    verifyProof: async () => false
  }
  function mockEl () {
    const el = {
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      style: {},
      dataset: {},
      setAttribute: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelector: () => mockEl(),
      querySelectorAll: () => [],
      appendChild: () => {},
      remove: () => {},
      click: () => {}
    }
    return el
  }
  global.document = {
    documentElement: { dataset: {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => mockEl(),
    addEventListener: () => {},
    removeEventListener: () => {},
    body: { contains: () => false, appendChild: () => {}, removeChild: () => {} }
  }
  global.location = { href: 'http://localhost/' }
  global.requestAnimationFrame = (fn) => setTimeout(fn, 0)
  global.state = { username: 'captain', team: 'br' }
  global.showToast = () => {}
  global.renderGames = () => {}
  global.setView = () => {}
  global.closeModal = () => {}
  global.ensureShootout = () => {}
  global.hideOverlay = () => {}
  global.homeFixtures = [
    { title: 'Spain vs Austria', status: 'Today, 15:00', slots: ['es', 'at'], score: [null, null], live: false }
  ]
  global.ULTIMATE_FIT_CONFIG = {
    predictionOptions: ['Home win', 'Away win', 'Draw', 'Over 2.5 goals'],
    triviaQuestions: [
      { id: 't-1', question: 'Q1', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 't-2', question: 'Q2', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 't-3', question: 'Q3', options: ['A', 'B', 'C', 'D'], answer: 'C' }
    ]
  }
  global.ULTIMATE_TRIVIA_BANK = {
    'world-cup': global.ULTIMATE_FIT_CONFIG.triviaQuestions
  }
  global.CURRENT_FIT_ID = 'world-cup'
}

function loadInstance (peerNet) {
  global.PearCupPeerNet = peerNet
  delete require.cache[require.resolve('../shell/peer-match.js')]
  require('../shell/peer-match.js')
  return global.PearCupPeerMatch
}

function makeDuel (gameType, peerNet) {
  setupGlobals()
  const net = peerNet || makePeerNet()
  const host = loadInstance(net)
  const code = host.host(null, true, gameType)
  const guest = loadInstance(net)
  guest.join(code, gameType)
  return { host, guest, code, net }
}

test('prediction-duel event snapshot is bound to both peers', () => {
  const { host, guest } = makeDuel('prediction-duel')
  try {
    assert.equal(host._state.gameType, 'prediction-duel')
    assert.equal(guest._state.gameType, 'prediction-duel')
    assert.ok(host._state.predictionEvent)
    assert.ok(guest._state.predictionEvent)
    assert.equal(host._state.predictionEvent.title, guest._state.predictionEvent.title)
    assert.equal(guest._state.predictionEventReceived, true)
  } finally {
    host.leave(true)
    guest.leave(true)
  }
})

test('prediction-duel full match produces settlement receipt and QVAC attestations', async () => {
  const { host, guest } = makeDuel('prediction-duel')
  let receipt = null
  global.postSettlementReceipt = (r) => { receipt = r }
  try {
    const options = global.ULTIMATE_FIT_CONFIG.predictionOptions
    for (let round = 0; round < 3; round++) {
      host.predictionPick(options[0])
      guest.predictionPick(options[1])
      host.predictionReveal()
      guest.predictionReveal()
      await new Promise(r => setTimeout(r, 0))
      if (round < 2) {
        host.predictionNextRound()
        guest.predictionNextRound()
      }
    }

    assert.equal(host._state.predictionOver, true)
    assert.equal(guest._state.predictionOver, true)
    assert.equal(host._state.over, true)
    assert.equal(guest._state.over, true)
    assert.ok(receipt)
    assert.equal(receipt.gameType, 'prediction-duel')
    assert.ok(receipt.qvacAttestations.length >= 3)
  } finally {
    delete global.postSettlementReceipt
    host.leave(true)
    guest.leave(true)
  }
})

test('trivia-duel verified bank is distributed and attested on both peers', () => {
  const { host, guest } = makeDuel('trivia-duel')
  try {
    assert.ok(host._state.triviaVerifiedBank)
    assert.ok(guest._state.triviaVerifiedBank)
    assert.equal(host._state.triviaBankHash, guest._state.triviaBankHash)
    assert.ok(host._state.qvacAttestations['bank'])
    assert.ok(guest._state.qvacAttestations['bank'])
    assert.equal(host._state.qvacAttestations['bank'].ruling, 'verified')
  } finally {
    host.leave(true)
    guest.leave(true)
  }
})

test('trivia-duel round resolves against verified bank and produces QVAC attestation', async () => {
  const { host, guest } = makeDuel('trivia-duel')
  try {
    const q = host._state.triviaVerifiedBank[0]
    host.triviaPick(q.answer)
    guest.triviaPick('B')
    host.triviaReveal()
    guest.triviaReveal()
    await new Promise(r => setTimeout(r, 0))

    assert.equal(host._state.triviaScore.you, 1)
    assert.equal(host._state.triviaScore.opp, 0)
    assert.equal(guest._state.triviaScore.you, 0)
    assert.equal(guest._state.triviaScore.opp, 1)
    assert.ok(host._state.qvacAttestations['td-1'])
    assert.ok(guest._state.qvacAttestations['td-1'])
  } finally {
    host.leave(true)
    guest.leave(true)
  }
})

test('trivia-duel altered bank hash leads to disputed QVAC attestation', async () => {
  const { host, guest } = makeDuel('trivia-duel')
  try {
    // Tamper with the guest's bank after receipt but keep the bank hash stale.
    guest._state.triviaVerifiedBank[0].answer = 'Z'
    guest._state.triviaBankHash = global.PearCupCore.deterministicHash(guest._state.triviaVerifiedBank)

    const q = host._state.triviaVerifiedBank[0]
    host.triviaPick(q.answer)
    guest.triviaPick('B')
    host.triviaReveal()
    guest.triviaReveal()
    await new Promise(r => setTimeout(r, 0))

    // Both peers resolve with their own view; the tampered side's attestation is disputed.
    assert.ok(host._state.qvacAttestations['td-1'])
    assert.equal(host._state.qvacAttestations['td-1'].ruling, 'you')
    assert.ok(guest._state.qvacAttestations['td-1'])
    assert.equal(guest._state.qvacAttestations['td-1'].ruling, 'disputed')
  } finally {
    host.leave(true)
    guest.leave(true)
  }
})

test('opponent disconnect forfeits trivia-duel to remaining player', async () => {
  const { host, guest } = makeDuel('trivia-duel')
  try {
    host._state.forfeitMs = 25
    // Host picks and starts waiting for the guest; guest then disconnects.
    host.triviaPick('A')
    guest.leave(true)
    await new Promise(r => setTimeout(r, 60))

    assert.equal(host._state.triviaOver, true)
    assert.equal(host._state.over, true)
    assert.equal(host._state.triviaScore.you, 99)
    assert.equal(host._state.triviaScore.opp, 0)
  } finally {
    host.leave(true)
  }
})
