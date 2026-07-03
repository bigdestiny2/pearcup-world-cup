'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { eventLog, runtime } = require('../src')

test('runtime replays competition, pool settlement, live market, and game evidence', () => {
  const app = runtime.createPlatformRuntime()

  const competitionEvent = app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T09:00:00.000Z',
    payload: {
      competitionId: 'comp-runtime',
      title: 'Runtime Cup',
      templateConfig: { kind: 'single-elimination', sportOrCategory: 'soccer' },
      entrants: [
        { entrantId: 'red', name: 'Red' },
        { entrantId: 'blue', name: 'Blue' },
        { entrantId: 'green', name: 'Green' },
        { entrantId: 'gold', name: 'Gold' }
      ]
    }
  })
  const poolEvent = app.dispatch({
    type: 'pool:create',
    actorId: 'host',
    occurredAt: '2026-07-03T09:05:00.000Z',
    payload: {
      poolId: 'pool-runtime',
      competitionId: 'comp-runtime',
      variant: 'classic-bracket',
      mode: 'demo'
    }
  })
  const submittedA = app.dispatch({
    type: 'prediction:submit',
    actorId: 'user-a',
    occurredAt: '2026-07-03T09:10:00.000Z',
    payload: {
      poolId: 'pool-runtime',
      userId: 'user-a',
      entryType: 'bracket',
      picks: { semi1: 'red', semi2: 'gold', final: 'red' }
    }
  })
  const submittedB = app.dispatch({
    type: 'prediction:submit',
    actorId: 'user-b',
    occurredAt: '2026-07-03T09:11:00.000Z',
    payload: {
      poolId: 'pool-runtime',
      userId: 'user-b',
      entryType: 'bracket',
      picks: { semi1: 'blue', semi2: 'gold', final: 'gold' }
    }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T09:20:00.000Z',
    payload: { entryId: submittedA.payload.entryId }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T09:20:01.000Z',
    payload: { entryId: submittedB.payload.entryId }
  })
  const resultSnapshot = app.dispatch({
    type: 'result:record',
    actorId: 'feed',
    occurredAt: '2026-07-03T12:00:00.000Z',
    payload: {
      competitionId: 'comp-runtime',
      sourcePolicy: 'official-feed',
      sourceId: 'fixture-feed',
      results: {
        semi1: { winnerEntrantId: 'red', roundNumber: 1 },
        semi2: { winnerEntrantId: 'gold', roundNumber: 1 },
        final: { winnerEntrantId: 'red', roundNumber: 2 }
      }
    }
  })
  const settlementEvent = app.dispatch({
    type: 'pool:resolve',
    actorId: 'system',
    occurredAt: '2026-07-03T12:01:00.000Z',
    payload: {
      poolId: poolEvent.payload.poolId,
      resultSnapshotId: resultSnapshot.payload.snapshotId
    }
  })
  const planEvent = app.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    occurredAt: '2026-07-03T12:02:00.000Z',
    payload: {
      poolId: poolEvent.payload.poolId,
      rulesVersion: poolEvent.payload.rules.rulesVersion,
      resultSnapshotId: resultSnapshot.payload.snapshotId,
      mode: 'demo',
      sourceEventIds: [competitionEvent.eventId, poolEvent.eventId, settlementEvent.eventId]
    }
  })

  const marketEvent = app.dispatch({
    type: 'market:create',
    actorId: 'host',
    occurredAt: '2026-07-03T13:00:00.000Z',
    payload: {
      marketId: 'market-next',
      roomId: 'room-runtime',
      competitionId: 'comp-runtime',
      fixtureId: 'final',
      marketType: 'next-event',
      locksAt: '2026-07-03T13:02:00.000Z',
      options: ['goal', 'corner', 'card']
    }
  })
  app.dispatch({
    type: 'market:predict',
    actorId: 'user-a',
    occurredAt: '2026-07-03T13:01:00.000Z',
    payload: {
      marketId: marketEvent.payload.marketId,
      userId: 'user-a',
      outcome: 'goal'
    }
  })
  app.dispatch({
    type: 'market:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T13:02:00.000Z',
    payload: { marketId: marketEvent.payload.marketId }
  })
  app.dispatch({
    type: 'market:resolve',
    actorId: 'feed',
    occurredAt: '2026-07-03T13:03:00.000Z',
    payload: {
      marketId: marketEvent.payload.marketId,
      result: 'goal'
    }
  })

  const gameEvent = app.dispatch({
    type: 'game:create',
    actorId: 'user-a',
    occurredAt: '2026-07-03T14:00:00.000Z',
    payload: {
      gameId: 'game-runtime',
      gameType: 'penalty-clash',
      roomId: 'room-runtime',
      players: ['user-a', 'user-b'],
      stakeMode: 'demo'
    }
  })
  app.dispatch({
    type: 'game:start',
    actorId: 'user-b',
    occurredAt: '2026-07-03T14:01:00.000Z',
    payload: { gameId: gameEvent.payload.gameId }
  })
  app.dispatch({
    type: 'game:commit',
    actorId: 'user-a',
    occurredAt: '2026-07-03T14:02:00.000Z',
    payload: {
      gameId: gameEvent.payload.gameId,
      roundId: 'r1',
      playerId: 'user-a',
      input: { aim: 'left', power: 70 },
      nonce: 'nonce-a'
    }
  })
  app.dispatch({
    type: 'game:reveal',
    actorId: 'user-a',
    occurredAt: '2026-07-03T14:03:00.000Z',
    payload: {
      gameId: gameEvent.payload.gameId,
      roundId: 'r1',
      playerId: 'user-a',
      input: { aim: 'left', power: 70 },
      nonce: 'nonce-a'
    }
  })

  const view = app.view()
  assert.equal(eventLog.verifyEventEnvelope(settlementEvent).ok, true)
  assert.equal(view.poolSettlements['pool-runtime'].winnerUserIds[0], 'user-a')
  assert.equal(view.settlementPlans[planEvent.payload.settlementPlanId].readiness.ready, true)
  assert.deepEqual(view.marketResolutions['market-next'].winnerUserIds, ['user-a'])
  assert.equal(view.gameSessions['game-runtime'].status, 'active')
  assert.equal(view.gameReveals['game-runtime:r1:user-a'].input.aim, 'left')
  assert.equal(typeof app.root(), 'string')

  const replayed = runtime.derivePlatformView(app.events())
  assert.deepEqual(replayed.poolSettlements['pool-runtime'].winnerUserIds, ['user-a'])
  assert.equal(replayed.eventRoot, app.root())
})

test('event log merge drops invalid envelopes and keeps convergent replay root', () => {
  const appA = runtime.createPlatformRuntime()
  appA.dispatch({
    type: 'market:create',
    actorId: 'host',
    occurredAt: '2026-07-03T15:00:00.000Z',
    payload: {
      marketId: 'merge-market',
      roomId: 'room-merge',
      competitionId: 'comp-merge',
      marketType: 'next-event'
    }
  })

  const appB = runtime.createPlatformRuntime()
  appB.merge(appA.events())
  const forged = {
    ...appA.events()[0],
    payload: { marketId: 'forged' }
  }
  appB.merge([forged])

  assert.equal(appA.events().length, 1)
  assert.equal(appB.events().length, 1)
  assert.equal(appB.view().markets['merge-market'].marketId, 'merge-market')
  assert.equal(appB.root(), appA.root())
})

