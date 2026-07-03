'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { bridge, platform } = require('../src')

function createRoomWithPlayers () {
  const app = platform.createUltimateSportsPlatform()
  app.dispatch({
    type: 'room:create',
    actorId: 'host',
    occurredAt: '2026-07-03T23:00:00.000Z',
    payload: {
      roomId: 'challenge-room',
      competitionId: 'challenge-comp',
      fixtureId: 'final',
      hostUserId: 'host',
      status: 'live'
    }
  })
  ;['host', 'alice', 'bob'].forEach(userId => {
    app.dispatch({
      type: 'room:join',
      actorId: userId,
      occurredAt: '2026-07-03T23:01:00.000Z',
      payload: {
        roomId: 'challenge-room',
        userId,
        username: userId
      }
    })
  })
  return app
}

function acceptChallenge (app, payload) {
  const challenge = app.dispatch({
    type: 'room:challenge',
    actorId: 'alice',
    occurredAt: '2026-07-03T23:02:00.000Z',
    payload: {
      roomId: 'challenge-room',
      targetUserId: 'bob',
      ...payload
    }
  })
  app.dispatch({
    type: 'room:acceptChallenge',
    actorId: 'bob',
    occurredAt: '2026-07-03T23:03:00.000Z',
    payload: {
      challengeId: challenge.payload.challengeId
    }
  })
  return challenge.payload.challengeId
}

test('accepted peer-game challenge materializes and dispatches a game session', () => {
  const app = createRoomWithPlayers()
  const challengeId = acceptChallenge(app, {
    challengeType: 'peer-game',
    gameType: 'penalty-clash'
  })
  const preview = app.materializeChallenge(challengeId)
  const dispatched = app.dispatchMaterializedChallenge(challengeId)
  const gameId = preview.command.payload.gameId

  assert.equal(preview.command.type, 'game:create')
  assert.deepEqual(preview.command.payload.players, ['alice', 'bob'])
  assert.equal(preview.command.payload.gameType, 'penalty-clash')
  assert.equal(dispatched.event.payload.gameId, gameId)
  assert.equal(dispatched.view.gameSessions[gameId].roomId, 'challenge-room')
})

test('accepted live-prediction challenge materializes a policy-aware market', () => {
  const app = createRoomWithPlayers()
  const challengeId = acceptChallenge(app, {
    challengeType: 'live-prediction',
    marketType: 'scoreline-lock'
  })
  const dispatched = app.dispatchMaterializedChallenge(challengeId, {
    settlementMode: 'sponsor-prize',
    gates: {
      poolRulesAccepted: true
    }
  })
  const market = dispatched.event.payload

  assert.equal(dispatched.materialization.command.type, 'market:create')
  assert.equal(market.marketType, 'scoreline-lock')
  assert.equal(market.mode, 'sponsor-prize')
  assert.deepEqual(market.options, ['home-win', 'draw', 'away-win'])
  assert.equal(market.predictionShape, 'exact-scoreline')
  assert.deepEqual(market.inputTemplate, { homeScore: 0, awayScore: 0, lockBeforeMinute: 60 })
  assert.equal(market.scoringConfig.exactScorePoints, 3)
})

test('accepted head-to-head bracket challenge materializes a two-player duel pool', () => {
  const app = createRoomWithPlayers()
  const challengeId = acceptChallenge(app, {
    challengeType: 'head-to-head-duel',
    duel: {
      title: 'My bracket vs yours'
    }
  })
  const dispatched = app.dispatchMaterializedChallenge(challengeId, {
    settlementMode: 'demo'
  })
  const pool = dispatched.event.payload

  assert.equal(dispatched.materialization.command.type, 'pool:create')
  assert.equal(pool.rules.variant, 'head-to-head-duel')
  assert.equal(pool.maxEntries, 2)
  assert.equal(pool.title, 'My bracket vs yours')
  assert.equal(pool.metadata.challengeId, challengeId)
  assert.deepEqual(pool.metadata.participantUserIds, ['alice', 'bob'])
  assert.equal(dispatched.view.pools[pool.poolId].metadata.duel.title, 'My bracket vs yours')
})

test('accepted side-quest challenge materializes a two-player side quest pool', () => {
  const app = createRoomWithPlayers()
  const challengeId = acceptChallenge(app, {
    challengeType: 'side-quest',
    sideQuest: {
      title: 'Semi-final scorers',
      condition: 'my-semi-finalists-score-more'
    }
  })
  const dispatched = app.dispatchMaterializedChallenge(challengeId, {
    settlementMode: 'sponsor-prize',
    gates: {
      poolRulesAccepted: true
    }
  })
  const pool = dispatched.event.payload

  assert.equal(pool.rules.variant, 'side-quest')
  assert.equal(pool.mode, 'sponsor-prize')
  assert.equal(pool.metadata.challengeId, challengeId)
  assert.equal(pool.metadata.targetUserId, 'bob')
  assert.equal(dispatched.view.pools[pool.poolId].title, 'Semi-final scorers')
})

test('bridge can preview challenge materialization commands', () => {
  const app = createRoomWithPlayers()
  const challengeId = acceptChallenge(app, {
    challengeType: 'peer-game',
    gameType: 'trivia-duel'
  })
  const handler = bridge.createBridgeHandler({ platform: app })
  const response = handler.handle(bridge.createBridgeRequest({
    action: 'materializeChallenge',
    requestId: 'materialize-challenge',
    payload: { challengeId }
  }))

  assert.equal(response.ok, true)
  assert.equal(response.result.command.type, 'game:create')
  assert.equal(response.result.command.payload.gameType, 'trivia-duel')
})
