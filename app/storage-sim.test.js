const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')
const receipts = require('./settlement-receipts.js')
const storageSim = require('./storage-sim.js')
const { createWorkerSim } = require('./worker-sim.js')

const gameId = 'pc-storage-test'
const roundId = 'pc-1'
const shooter = { id: 'user-captain', username: 'captain', teamId: 'br' }
const keeper = { id: 'user-vera', username: 'vera', teamId: 'no' }
const shooterInput = {
  role: 'shooter',
  aimZone: 'right-high',
  powerBand: 3,
  curveBand: 1,
  releaseTick: 42
}
const keeperInput = {
  role: 'keeper',
  diveZone: 'right-high',
  releaseTick: 43
}

function submitSettlement (worker) {
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: shooter.id,
    payload: {
      gameId,
      roundId,
      playerId: shooter.id,
      commitment: core.createCommitment({ gameId, roundId, playerId: shooter.id, input: shooterInput, nonce: 'shooter-nonce' })
    }
  })
  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: keeper.id,
    payload: {
      gameId,
      roundId,
      playerId: keeper.id,
      commitment: core.createCommitment({ gameId, roundId, playerId: keeper.id, input: keeperInput, nonce: 'keeper-nonce' })
    }
  })
  worker.dispatch({
    type: 'game:revealInput',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, input: shooterInput, nonce: 'shooter-nonce' }
  })
  worker.dispatch({
    type: 'game:revealInput',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, input: keeperInput, nonce: 'keeper-nonce' }
  })
  const stateHash = core.createPenaltyClashRound({
    gameId,
    roundIndex: 0,
    shooter,
    keeper,
    shooterInput,
    keeperInput,
    shooterNonce: 'shooter-nonce',
    keeperNonce: 'keeper-nonce'
  }).stateHash
  worker.dispatch({
    type: 'game:submitRoundStateHash',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, stateHash }
  })
  worker.dispatch({
    type: 'game:submitRoundStateHash',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, stateHash }
  })
  const roundEvent = worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  const attestationEvent = worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })
  const settlementEvent = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })
  return {
    type: 'TrustedGameSettlementCompleted',
    status: 'prepared',
    roundEvent,
    attestationEvent,
    settlementEvent
  }
}

test('event store appends events idempotently and snapshots the event root', () => {
  const store = storageSim.createEventStore({
    backend: storageSim.createMemoryBackend(),
    rootId: 'test-root',
    namespace: storageSim.gameNamespace(gameId)
  })
  const worker = createWorkerSim()
  worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })

  assert.equal(store.appendEvents(worker.events()), 1)
  assert.equal(store.appendEvents(worker.events()), 0)
  assert.equal(store.snapshot().events, 1)
  assert.equal(store.snapshot().eventRoot, worker.view().eventRoot)
})

test('event stores isolate namespaces on one backend', () => {
  const backend = storageSim.createMemoryBackend()
  const gameStore = storageSim.createEventStore({ backend, rootId: 'test-root', namespace: storageSim.gameNamespace(gameId) })
  const chatStore = storageSim.createEventStore({ backend, rootId: 'test-root', namespace: 'rooms/brazil-norway/chat' })
  const worker = createWorkerSim()
  worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })

  gameStore.appendEvents(worker.events())

  assert.equal(gameStore.readEvents().length, 1)
  assert.equal(chatStore.readEvents().length, 0)
  assert.deepEqual(backend.keys(), [gameStore.key])
})

test('worker persists settlement events and replays payout state after restart', () => {
  const store = storageSim.createEventStore({
    backend: storageSim.createMemoryBackend(),
    rootId: 'test-root',
    namespace: storageSim.gameNamespace(gameId)
  })
  const worker = createWorkerSim({ storage: store })
  submitSettlement(worker)
  const restarted = createWorkerSim({ storage: store })

  assert.equal(store.snapshot().events, 10)
  assert.equal(store.snapshot().eventRoot, worker.view().eventRoot)
  assert.equal(restarted.view().eventRoot, worker.view().eventRoot)
  assert.equal(Object.keys(restarted.view().payouts).length, 1)
  assert.equal(restarted.view().typeCounts.QvacRefereeAttestationCreated, 1)
})

test('worker persists settlement receipt events and replays receipt state after restart', () => {
  const store = storageSim.createEventStore({
    backend: storageSim.createMemoryBackend(),
    rootId: 'test-root',
    namespace: storageSim.gameNamespace(`${gameId}-receipt`)
  })
  const worker = createWorkerSim({ storage: store })
  const summary = submitSettlement(worker)
  const receipt = receipts.createSettlementReceipt({
    summary,
    eventRoot: worker.view().eventRoot
  })
  const receiptEvent = worker.dispatch({
    type: 'settlement:recordReceipt',
    actorId: 'settlement-auditor',
    payload: { receipt }
  })
  const restarted = createWorkerSim({ storage: store })

  assert.equal(receiptEvent.type, 'SettlementReceiptCreated')
  assert.equal(store.snapshot().events, 11)
  assert.equal(restarted.view().eventRoot, worker.view().eventRoot)
  assert.equal(restarted.view().settlementReceipts[receipt.receiptId].receiptHash, receipt.receiptHash)
  assert.equal(restarted.view().settlementReceiptsBySettlementEvent[summary.settlementEvent.eventId].receiptId, receipt.receiptId)
})

test('merged peer events are persisted once and replay to the same root', () => {
  const source = createWorkerSim()
  submitSettlement(source)
  const store = storageSim.createEventStore({
    backend: storageSim.createMemoryBackend(),
    rootId: 'test-root',
    namespace: storageSim.gameNamespace(`${gameId}-peer`)
  })
  const peer = createWorkerSim({ storage: store })

  assert.equal(peer.mergeEvents(source.events()), 10)
  assert.equal(peer.mergeEvents(source.events()), 0)

  const restartedPeer = createWorkerSim({ storage: store })
  assert.equal(store.snapshot().events, 10)
  assert.equal(restartedPeer.view().eventRoot, source.view().eventRoot)
  assert.equal(Object.keys(restartedPeer.view().attestations).length, 1)
})

test('worker ignores forged events found during storage replay', () => {
  const source = createWorkerSim()
  submitSettlement(source)
  const escrowEvent = source.events().find(event => event.type === 'TetherWdkEscrowCreated')
  const releaseEvent = source.events().find(event => event.type === 'TetherWdkEscrowReleased')
  const forgedRelease = {
    ...releaseEvent,
    payload: {
      ...releaseEvent.payload,
      winnerUserId: shooter.id
    }
  }
  const store = storageSim.createEventStore({
    backend: storageSim.createMemoryBackend(),
    rootId: 'test-root',
    namespace: storageSim.gameNamespace(`${gameId}-forged-peer`)
  })
  store.appendEvents([escrowEvent, forgedRelease])

  const restartedPeer = createWorkerSim({ storage: store })

  assert.equal(store.snapshot().events, 2)
  assert.equal(restartedPeer.events().length, 1)
  assert.equal(restartedPeer.events()[0].eventId, escrowEvent.eventId)
  assert.equal(Object.keys(restartedPeer.view().escrows).length, 1)
  assert.equal(Object.keys(restartedPeer.view().payouts).length, 0)
})
