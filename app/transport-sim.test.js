const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')
const { createWorkerSim } = require('./worker-sim.js')
const workerClient = require('./worker-client.js')
const pearWorker = require('./pear-worker.cjs')
const { createTopicBus, gameTopic } = require('./transport-sim.js')

const gameId = 'pc-transport-test'
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

function trustedSettlementWorker () {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  const shooterCommitment = core.createCommitment({
    gameId,
    roundId,
    playerId: shooter.id,
    input: shooterInput,
    nonce: 'shooter-nonce'
  })
  const keeperCommitment = core.createCommitment({
    gameId,
    roundId,
    playerId: keeper.id,
    input: keeperInput,
    nonce: 'keeper-nonce'
  })
  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, commitment: shooterCommitment }
  })
  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, commitment: keeperCommitment }
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
  worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })
  worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })
  return worker
}

test('topic bus derives stable Pear game topic names', () => {
  assert.equal(gameTopic('abc'), 'pearcup:v1:game:abc')
})

test('topic bus converges peers despite duplicate and out-of-order delivery', () => {
  const bus = createTopicBus({ topic: gameTopic(gameId) })
  const host = bus.joinPeer('host', trustedSettlementWorker())
  const spectator = bus.joinPeer('spectator')
  const report = bus.publishFrom('host', { duplicates: true, outOfOrder: true })

  assert.equal(report.length, 1)
  assert.equal(report[0].to, 'spectator')
  assert.ok(report[0].offered > host.worker.events().length)
  assert.equal(report[0].merged, host.worker.events().length)
  assert.equal(spectator.worker.view().eventRoot, host.worker.view().eventRoot)
  assert.equal(bus.converged(), true)
})

test('syncAll converges three peers and ignores duplicate second pass', () => {
  const bus = createTopicBus({ topic: gameTopic(gameId) })
  const host = bus.joinPeer('host', trustedSettlementWorker())
  const away = bus.joinPeer('away')
  const spectator = bus.joinPeer('spectator')

  const first = bus.syncAll({ duplicates: true, outOfOrder: true })
  const second = bus.syncAll({ duplicates: true, outOfOrder: true })
  const roots = bus.roots()

  assert.equal(first.converged, true)
  assert.equal(second.converged, true)
  assert.equal(new Set(roots.map(peer => peer.root)).size, 1)
  assert.equal(away.worker.events().length, host.worker.events().length)
  assert.equal(spectator.worker.events().length, host.worker.events().length)
  assert.equal(second.reports.every(report => report.merged === 0), true)
})

test('topic bus drops forged peer payout events before spectator state changes', () => {
  const trusted = trustedSettlementWorker()
  const releaseEvent = trusted.events().find(event => event.type === 'TetherWdkEscrowReleased')
  const forgedRelease = {
    ...releaseEvent,
    payload: {
      ...releaseEvent.payload,
      winnerUserId: shooter.id
    }
  }
  const maliciousWorker = {
    events: () => [forgedRelease],
    view: () => ({ eventRoot: '0xmalicious', typeCounts: { TetherWdkEscrowReleased: 1 } })
  }
  const bus = createTopicBus({ topic: gameTopic(`${gameId}-forged`) })
  bus.joinPeer('malicious', maliciousWorker)
  const spectator = bus.joinPeer('spectator')

  const report = bus.publishFrom('malicious')

  assert.equal(report.length, 1)
  assert.equal(report[0].offered, 1)
  assert.equal(report[0].merged, 0)
  assert.equal(spectator.worker.events().length, 0)
  assert.equal(Object.keys(spectator.worker.view().payouts).length, 0)
})

test('async topic bus converges a bridge-backed Pear worker peer', async () => {
  const bus = createTopicBus({ topic: gameTopic(gameId) })
  const host = bus.joinPeer('host', trustedSettlementWorker())
  const bridgeServer = pearWorker.createPearCupWorkerBridgeServer({ requireLive: false })
  const bridgeClient = workerClient.createBridgeWorkerClient({ bridge: bridgeServer })
  const spectator = bus.joinPeer('spectator', bridgeClient)

  const report = await bus.publishFromAsync('host', { duplicates: true, outOfOrder: true })
  const roots = await bus.rootsAsync()

  assert.equal(report.length, 1)
  assert.equal(report[0].to, 'spectator')
  assert.ok(report[0].offered > host.worker.events().length)
  assert.equal(report[0].merged, host.worker.events().length)
  assert.equal(spectator.worker.view().eventRoot, host.worker.view().eventRoot)
  assert.equal(new Set(roots.map(peer => peer.root)).size, 1)
  assert.equal(await bus.convergedAsync(), true)

  await bridgeClient.close()
})
