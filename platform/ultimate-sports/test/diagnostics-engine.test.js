'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { diagnostics, platform, runtime, transport } = require('../src')

test('peer sync diagnostics identify lagging peers and clear after pull', () => {
  const bus = transport.createTransportSim()
  const topic = transport.topicFor('room', 'diag-room')
  const alice = runtime.createPlatformRuntime()
  const bob = runtime.createPlatformRuntime()

  bus.joinTopic({ peerId: 'alice', topic })
  bus.joinTopic({ peerId: 'bob', topic })

  alice.dispatch({
    type: 'room:create',
    actorId: 'alice',
    occurredAt: '2026-07-03T22:00:00.000Z',
    payload: {
      roomId: 'diag-room',
      competitionId: 'diag-cup',
      hostUserId: 'alice'
    }
  })
  alice.dispatch({
    type: 'room:join',
    actorId: 'alice',
    occurredAt: '2026-07-03T22:01:00.000Z',
    payload: { roomId: 'diag-room', userId: 'alice', username: 'Alice', role: 'host' }
  })
  bus.publish({ peerId: 'alice', topic, events: alice.events() })

  const lagging = diagnostics.createPeerSyncDiagnostic({
    topic,
    topicRoot: bus.topicRoot(topic),
    topicEvents: bus.topicEvents(topic),
    peers: [
      { peerId: 'alice', runtimeRoot: alice.root(), events: alice.events(), joined: true },
      { peerId: 'bob', runtimeRoot: bob.root(), events: bob.events(), joined: true }
    ]
  })

  assert.equal(lagging.level, 'critical')
  assert.deepEqual(lagging.criticalPeers, ['bob'])
  assert.equal(lagging.peerReports.find(peer => peer.peerId === 'bob').missingEventIds.length, 2)

  const pulled = bus.pull({ peerId: 'bob', topic, sinceEventIds: [] })
  bob.merge(pulled.events)

  const healthy = diagnostics.createPeerSyncDiagnostic({
    topic,
    topicRoot: bus.topicRoot(topic),
    topicEvents: bus.topicEvents(topic),
    peers: {
      alice: { runtimeRoot: alice.root(), events: alice.events(), joined: true },
      bob: { runtimeRoot: bob.root(), events: bob.events(), joined: true }
    }
  })

  assert.equal(healthy.ok, true)
  assert.equal(healthy.criticalPeers.length, 0)
})

test('bracket pool load simulation drives 100 locked entries and readable pool analysis', () => {
  const app = runtime.createPlatformRuntime()
  app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T23:00:00.000Z',
    payload: {
      competitionId: 'load-cup',
      title: 'Load Cup',
      templateConfig: { kind: 'single-elimination' },
      entrants: [
        { entrantId: 'alpha', name: 'Alpha' },
        { entrantId: 'beta', name: 'Beta' }
      ]
    }
  })
  app.dispatch({
    type: 'pool:create',
    actorId: 'host',
    occurredAt: '2026-07-03T23:01:00.000Z',
    payload: {
      poolId: 'load-pool',
      competitionId: 'load-cup',
      variant: 'classic-bracket',
      mode: 'demo'
    }
  })

  const simulation = diagnostics.createBracketPoolLoadSimulation({
    poolId: 'load-pool',
    userCount: 100,
    fixtureIds: ['final'],
    entrantIds: ['alpha', 'beta'],
    actualWinnerId: 'alpha',
    alternateWinnerId: 'beta',
    perfectEvery: 10,
    startedAt: '2026-07-03T23:02:00.000Z'
  })
  simulation.commands.forEach(command => app.dispatch(command))
  const result = app.dispatch({
    type: 'result:record',
    actorId: 'feed',
    occurredAt: '2026-07-03T23:10:00.000Z',
    payload: {
      competitionId: 'load-cup',
      results: simulation.results
    }
  })
  app.dispatch({
    type: 'pool:resolve',
    actorId: 'system',
    occurredAt: '2026-07-03T23:11:00.000Z',
    payload: {
      poolId: 'load-pool',
      resultSnapshotId: result.payload.snapshotId
    }
  })

  const analysis = diagnostics.analyzePoolLoad({
    view: app.view(),
    poolId: 'load-pool',
    thresholds: { entryWarningThreshold: 101 }
  })

  assert.equal(simulation.expectedLockedCount, 100)
  assert.equal(simulation.expectedWinnerUserIds.length, 10)
  assert.equal(analysis.entryCount, 100)
  assert.equal(analysis.lockedCount, 100)
  assert.equal(analysis.winnerCount, 10)
  assert.equal(analysis.ok, true)
})

test('room load and facade diagnostics summarize busy surfaces without raw logs', () => {
  const bus = transport.createTransportSim()
  const app = platform.createUltimateSportsPlatform({ peerId: 'host', transport: bus })
  const applied = app.applyScenario('soccer-knockout', {
    competitionId: 'diag-facade-cup',
    poolId: 'diag-facade-pool',
    roomId: 'diag-facade-room'
  })
  app.joinScenarioTopics(applied.scenario)
  app.syncTopic({ kind: 'room', id: 'diag-facade-room' })

  const roomAnalysis = diagnostics.analyzeRoomLoad({
    view: app.view(),
    roomId: 'diag-facade-room',
    thresholds: { participantWarningThreshold: 1 }
  })
  const topicDiagnostic = app.diagnoseTopic({ kind: 'room', id: 'diag-facade-room' }, {
    host: {
      runtimeRoot: app.root(),
      events: app.events(),
      joined: true
    }
  })
  const transportReport = app.diagnoseTransport()
  const loadReport = app.createLoadReport()

  assert.equal(roomAnalysis.activeParticipantCount, 1)
  assert.equal(roomAnalysis.readabilityScore <= 100, true)
  assert.equal(topicDiagnostic.ok, true)
  assert.equal(transportReport.topicCount >= 1, true)
  assert.equal(loadReport.poolReports.some(report => report.poolId === 'diag-facade-pool'), true)
})
