'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { feed, prediction, runtime } = require('../src')

test('feed adapters replay fixture, clock, score, stats, events, and result state', () => {
  const adapter = feed.createFeedAdapter({
    adapterId: 'soccer-feed',
    kind: 'soccer',
    competitionId: 'feed-comp',
    sourceId: 'official-soccer'
  })
  const simulator = feed.createFeedReplaySimulator({ adapter })
  const kickoff = simulator.pushFrame({
    frameId: 'frame-kickoff',
    sequence: 1,
    fixtureId: 'final',
    clock: { period: 1, minute: 0 },
    score: { home: 0, away: 0 },
    stats: { shots: { home: 0, away: 0 } },
    event: { type: 'kickoff', value: { team: 'home' } },
    createdAt: '2026-07-03T18:00:00.000Z'
  })
  const goal = simulator.pushFrame({
    frameId: 'frame-goal',
    sequence: 2,
    fixtureId: 'final',
    clock: { period: 1, minute: 23 },
    score: { home: 1, away: 0 },
    stats: { shots: { home: 3, away: 1 } },
    event: { type: 'goal', value: { entrantId: 'alpha', scorerId: 'player-9' } },
    results: {
      final: { winnerEntrantId: 'alpha', roundNumber: 1, homeScore: 1, awayScore: 0 }
    },
    status: 'final',
    createdAt: '2026-07-03T18:25:00.000Z'
  })

  const replay = simulator.replay()
  const snapshot = simulator.snapshot({ recordedAt: '2026-07-03T18:30:00.000Z' })

  assert.equal(adapter.capabilities.clock, true)
  assert.equal(replay.fixtureStates.final.clock.minute, 23)
  assert.equal(replay.fixtureStates.final.score.home, 1)
  assert.equal(replay.fixtureStates.final.stats.shots.home, 3)
  assert.deepEqual(replay.frameIds, [kickoff.frameId, goal.frameId])
  assert.equal(replay.feedEvents.length, 2)
  assert.equal(snapshot.results.final.winnerEntrantId, 'alpha')
  assert.deepEqual(snapshot.sourceFeedEventIds, ['frame-kickoff', 'frame-goal'])
  assert.equal(snapshot.feedStateHash, replay.stateHash)
})

test('runtime records feed frames and settles a pool from replayed adapter results', () => {
  const app = runtime.createPlatformRuntime()
  app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T19:00:00.000Z',
    payload: {
      competitionId: 'runtime-feed-comp',
      title: 'Runtime Feed Cup',
      templateConfig: { kind: 'single-elimination', sportOrCategory: 'soccer' },
      entrants: [
        { entrantId: 'alpha', name: 'Alpha' },
        { entrantId: 'beta', name: 'Beta' }
      ]
    }
  })
  const rules = prediction.createPoolRules({ variant: 'classic-bracket', payoutPolicy: 'demo' })
  app.dispatch({
    type: 'pool:create',
    actorId: 'host',
    occurredAt: '2026-07-03T19:01:00.000Z',
    payload: {
      poolId: 'runtime-feed-pool',
      competitionId: 'runtime-feed-comp',
      rules,
      mode: 'demo'
    }
  })
  const entry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'user-a',
    occurredAt: '2026-07-03T19:02:00.000Z',
    payload: {
      poolId: 'runtime-feed-pool',
      userId: 'user-a',
      entryType: 'bracket',
      picks: { final: 'alpha' }
    }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T19:03:00.000Z',
    payload: { entryId: entry.payload.entryId }
  })
  const adapterEvent = app.dispatch({
    type: 'feed:registerAdapter',
    actorId: 'feed',
    occurredAt: '2026-07-03T19:04:00.000Z',
    payload: {
      adapterId: 'runtime-soccer-feed',
      kind: 'soccer',
      competitionId: 'runtime-feed-comp',
      sourceId: 'official-soccer'
    }
  })
  const frameEvent = app.dispatch({
    type: 'feed:recordFrame',
    actorId: 'feed',
    occurredAt: '2026-07-03T19:05:00.000Z',
    payload: {
      adapterId: adapterEvent.payload.adapterId,
      frameId: 'runtime-final-frame',
      sequence: 1,
      fixtureId: 'final',
      clock: { period: 2, minute: 90 },
      score: { home: 2, away: 1 },
      stats: { corners: { home: 6, away: 2 } },
      event: { type: 'full-time', value: { score: '2-1' } },
      results: {
        final: { winnerEntrantId: 'alpha', roundNumber: 1, homeScore: 2, awayScore: 1 }
      },
      status: 'final'
    }
  })
  const snapshotEvent = app.dispatch({
    type: 'result:recordFromFeed',
    actorId: 'feed',
    occurredAt: '2026-07-03T19:06:00.000Z',
    payload: {
      adapterId: adapterEvent.payload.adapterId
    }
  })
  const settlementEvent = app.dispatch({
    type: 'pool:resolve',
    actorId: 'system',
    occurredAt: '2026-07-03T19:07:00.000Z',
    payload: {
      poolId: 'runtime-feed-pool',
      resultSnapshotId: snapshotEvent.payload.snapshotId
    }
  })
  const view = app.view()

  assert.equal(view.feedStates['runtime-soccer-feed'].fixtureStates.final.score.home, 2)
  assert.deepEqual(snapshotEvent.payload.sourceFeedEventIds, [frameEvent.payload.frameId])
  assert.equal(snapshotEvent.payload.sourcePolicy, 'official-feed')
  assert.equal(settlementEvent.payload.winnerUserIds[0], 'user-a')
  assert.equal(runtime.feedFramesForAdapter(view, 'runtime-soccer-feed').length, 1)
})

test('feed adapter presets cover basketball, esports, awards, and manual sources', () => {
  const basketball = feed.createFeedAdapter({
    kind: 'basketball',
    competitionId: 'basketball-comp'
  })
  const esports = feed.createFeedAdapter({
    kind: 'esports',
    competitionId: 'esports-comp'
  })
  const awards = feed.createFeedAdapter({
    kind: 'awards',
    competitionId: 'awards-comp'
  })
  const manual = feed.createFeedAdapter({
    kind: 'manual',
    competitionId: 'local-comp'
  })

  assert.equal(basketball.eventTypes.includes('rebound'), true)
  assert.equal(esports.resultFields.includes('mapScore'), true)
  assert.equal(awards.sourcePolicy, 'host-entered')
  assert.equal(awards.capabilities.cardResults, true)
  assert.equal(manual.sourcePolicy, 'host-entered')
  assert.equal(manual.capabilities.results, true)
})
