'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { bridge, platform, wager } = require('../src')

test('challenge wager plans hold stakes and settle resolved peer games', () => {
  const app = createFundedChallengeApp()
  const aliceWatch = app.createWatchPartyWorkbench({
    userId: 'alice',
    roomId: 'wager-room',
    defaultStake: {
      amount: 25,
      currency: 'CREDITS',
      termsAccepted: true
    }
  })
  const trivia = aliceWatch.challengeLauncher.challengeTypes.find(item => item.gameType === 'trivia-duel')
  const challengeEvent = app.dispatch({
    ...trivia.commandDraft,
    occurredAt: '2026-07-04T10:04:00.000Z'
  })
  const challengeId = challengeEvent.payload.challengeId
  app.dispatch({
    type: 'room:acceptChallenge',
    actorId: 'bob',
    occurredAt: '2026-07-04T10:05:00.000Z',
    payload: { challengeId }
  })

  const bridgePlan = bridge.createBridgeHandler({ platform: app }).handle(bridge.createBridgeRequest({
    action: 'createChallengeWagerPlan',
    requestId: 'wager-preview',
    payload: { challengeId }
  }))
  const holdPlan = app.createChallengeWagerPlan(challengeId, {
    occurredAt: '2026-07-04T10:06:00.000Z'
  })

  assert.equal(bridgePlan.ok, true)
  assert.equal(bridgePlan.result.status, 'ready-to-hold')
  assert.equal(holdPlan.status, 'ready-to-hold')
  assert.deepEqual(holdPlan.holdCommands.map(command => command.type), ['wallet:hold', 'wallet:hold'])
  holdPlan.holdCommands.forEach(command => app.dispatch(command))

  const dispatched = app.dispatchMaterializedChallenge(challengeId)
  const gameId = dispatched.event.payload.gameId
  assert.equal(dispatched.view.gameSessions[gameId].stake.amount, 25)
  app.dispatch({
    type: 'game:start',
    actorId: 'alice',
    occurredAt: '2026-07-04T10:07:00.000Z',
    payload: { gameId }
  })
  commitAndReveal(app, {
    gameId,
    playerId: 'alice',
    input: { answers: { q1: { answer: 'A', responseMs: 400 } } },
    nonce: 'alice-nonce'
  })
  commitAndReveal(app, {
    gameId,
    playerId: 'bob',
    input: { answers: { q1: { answer: 'B', responseMs: 300 } } },
    nonce: 'bob-nonce'
  })
  app.dispatch({
    type: 'game:resolve',
    actorId: 'alice',
    occurredAt: '2026-07-04T10:10:00.000Z',
    payload: {
      gameId,
      result: {
        questionIds: ['q1'],
        correctAnswers: { q1: 'A' }
      }
    }
  })

  const settlementPlan = app.createWalletOpsWorkbench({ userId: 'alice' }).challengeWagers[0]
  assert.equal(settlementPlan.status, 'ready')
  assert.deepEqual(settlementPlan.settlement.winnerUserIds, ['alice'])
  assert.deepEqual(settlementPlan.commandDrafts.settleStake.map(command => command.type), [
    'wallet:release',
    'wallet:release',
    'wallet:debit',
    'wallet:award'
  ])
  settlementPlan.commandDrafts.settleStake.forEach(command => app.dispatch(command))

  const aliceWallet = app.createWalletOpsWorkbench({ userId: 'alice' })
  const bobWallet = app.createWalletOpsWorkbench({ userId: 'bob' })
  const settledPlan = app.createChallengeWagerPlan(challengeId)

  assert.equal(aliceWallet.accounts[0].balance.available, 125)
  assert.equal(bobWallet.accounts[0].balance.available, 75)
  assert.equal(settledPlan.status, 'settled')
  assert.equal(wager.resolveChallengeWagerOutcome({
    challenge: app.view().roomChallenges[challengeId],
    view: app.view()
  }).targetType, 'game')
})

test('challenge wager plans settle resolved live prediction markets', () => {
  const app = createFundedChallengeApp()
  const aliceWatch = app.createWatchPartyWorkbench({
    userId: 'alice',
    roomId: 'wager-room',
    defaultStake: {
      amount: 10,
      currency: 'CREDITS',
      termsAccepted: true
    }
  })
  const nextEvent = aliceWatch.challengeLauncher.challengeTypes.find(item => item.challengeType === 'live-prediction' && item.marketType === 'next-event')
  const challengeEvent = app.dispatch({
    ...nextEvent.commandDraft,
    occurredAt: '2026-07-04T11:04:00.000Z'
  })
  const challengeId = challengeEvent.payload.challengeId
  app.dispatch({
    type: 'room:acceptChallenge',
    actorId: 'bob',
    occurredAt: '2026-07-04T11:05:00.000Z',
    payload: { challengeId }
  })

  const holdPlan = app.createChallengeWagerPlan(challengeId, {
    occurredAt: '2026-07-04T11:06:00.000Z'
  })
  holdPlan.holdCommands.forEach(command => app.dispatch(command))
  const dispatched = app.dispatchMaterializedChallenge(challengeId)
  const marketId = dispatched.event.payload.marketId

  app.dispatch({
    type: 'market:predict',
    actorId: 'alice',
    occurredAt: '2026-07-04T11:07:00.000Z',
    payload: { marketId, userId: 'alice', outcome: 'goal' }
  })
  app.dispatch({
    type: 'market:predict',
    actorId: 'bob',
    occurredAt: '2026-07-04T11:07:10.000Z',
    payload: { marketId, userId: 'bob', outcome: 'corner' }
  })
  app.dispatch({
    type: 'market:lock',
    actorId: 'alice',
    occurredAt: '2026-07-04T11:08:00.000Z',
    payload: { marketId }
  })
  app.dispatch({
    type: 'market:resolve',
    actorId: 'alice',
    occurredAt: '2026-07-04T11:09:00.000Z',
    payload: { marketId, result: 'goal' }
  })

  const settlementPlan = app.createWalletOpsWorkbench({ userId: 'alice' }).challengeWagers[0]
  assert.equal(settlementPlan.status, 'ready')
  assert.equal(settlementPlan.settlement.targetType, 'market')
  assert.deepEqual(settlementPlan.settlement.winnerUserIds, ['alice'])
  settlementPlan.commandDrafts.settleStake.forEach(command => app.dispatch(command))

  assert.equal(app.createChallengeWagerPlan(challengeId).status, 'settled')
  assert.equal(app.createWalletOpsWorkbench({ userId: 'alice' }).accounts[0].balance.available, 110)
  assert.equal(app.createWalletOpsWorkbench({ userId: 'bob' }).accounts[0].balance.available, 90)
})

test('challenge wager plans settle resolved bracket side quest pools', () => {
  const app = createFundedChallengeApp()
  const aliceWatch = app.createWatchPartyWorkbench({
    userId: 'alice',
    roomId: 'wager-room',
    defaultStake: {
      amount: 15,
      currency: 'CREDITS',
      termsAccepted: true
    }
  })
  const sideQuest = aliceWatch.challengeLauncher.challengeTypes.find(item => item.challengeType === 'side-quest')
  const challengeEvent = app.dispatch({
    ...sideQuest.commandDraft,
    occurredAt: '2026-07-04T12:04:00.000Z'
  })
  const challengeId = challengeEvent.payload.challengeId
  app.dispatch({
    type: 'room:acceptChallenge',
    actorId: 'bob',
    occurredAt: '2026-07-04T12:05:00.000Z',
    payload: { challengeId }
  })

  const holdPlan = app.createChallengeWagerPlan(challengeId, {
    occurredAt: '2026-07-04T12:06:00.000Z'
  })
  holdPlan.holdCommands.forEach(command => app.dispatch(command))
  const dispatched = app.dispatchMaterializedChallenge(challengeId)
  const poolId = dispatched.event.payload.poolId
  const aliceEntry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'alice',
    occurredAt: '2026-07-04T12:07:00.000Z',
    payload: {
      poolId,
      userId: 'alice',
      entryType: 'bracket',
      picks: { semiFinalistIds: ['red'] }
    }
  })
  const bobEntry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'bob',
    occurredAt: '2026-07-04T12:07:10.000Z',
    payload: {
      poolId,
      userId: 'bob',
      entryType: 'bracket',
      picks: { semiFinalistIds: ['blue'] }
    }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'alice',
    occurredAt: '2026-07-04T12:08:00.000Z',
    payload: { entryId: aliceEntry.payload.entryId }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'bob',
    occurredAt: '2026-07-04T12:08:10.000Z',
    payload: { entryId: bobEntry.payload.entryId }
  })
  const snapshot = app.dispatch({
    type: 'result:record',
    actorId: 'host',
    occurredAt: '2026-07-04T12:09:00.000Z',
    payload: {
      competitionId: 'wager-comp',
      sourcePolicy: 'host-entered',
      results: {
        semi: {
          roundName: 'Semi-final',
          homeEntrantId: 'red',
          awayEntrantId: 'blue',
          homeScore: 2,
          awayScore: 0
        }
      }
    }
  })
  app.dispatch({
    type: 'pool:resolve',
    actorId: 'host',
    occurredAt: '2026-07-04T12:10:00.000Z',
    payload: {
      poolId,
      resultSnapshotId: snapshot.payload.snapshotId
    }
  })

  const settlementPlan = app.createWalletOpsWorkbench({ userId: 'alice' }).challengeWagers[0]
  assert.equal(settlementPlan.status, 'ready')
  assert.equal(settlementPlan.settlement.targetType, 'pool')
  assert.deepEqual(settlementPlan.settlement.winnerUserIds, ['alice'])
  settlementPlan.commandDrafts.settleStake.forEach(command => app.dispatch(command))

  assert.equal(app.createChallengeWagerPlan(challengeId).status, 'settled')
  assert.equal(app.createWalletOpsWorkbench({ userId: 'alice' }).accounts[0].balance.available, 115)
  assert.equal(app.createWalletOpsWorkbench({ userId: 'bob' }).accounts[0].balance.available, 85)
})

test('challenge wager plans settle resolved head-to-head bracket duel pools', () => {
  const app = createFundedChallengeApp()
  const aliceWatch = app.createWatchPartyWorkbench({
    userId: 'alice',
    roomId: 'wager-room',
    defaultStake: {
      amount: 20,
      currency: 'CREDITS',
      termsAccepted: true
    }
  })
  const bracketDuel = aliceWatch.challengeLauncher.challengeTypes.find(item => item.challengeType === 'head-to-head-duel')
  const challengeEvent = app.dispatch({
    ...bracketDuel.commandDraft,
    occurredAt: '2026-07-04T13:04:00.000Z'
  })
  const challengeId = challengeEvent.payload.challengeId
  app.dispatch({
    type: 'room:acceptChallenge',
    actorId: 'bob',
    occurredAt: '2026-07-04T13:05:00.000Z',
    payload: { challengeId }
  })

  const holdPlan = app.createChallengeWagerPlan(challengeId, {
    occurredAt: '2026-07-04T13:06:00.000Z'
  })
  holdPlan.holdCommands.forEach(command => app.dispatch(command))
  const dispatched = app.dispatchMaterializedChallenge(challengeId)
  const poolId = dispatched.event.payload.poolId
  const aliceEntry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'alice',
    occurredAt: '2026-07-04T13:07:00.000Z',
    payload: {
      poolId,
      userId: 'alice',
      entryType: 'bracket',
      picks: { semi: 'red', final: 'red' }
    }
  })
  const bobEntry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'bob',
    occurredAt: '2026-07-04T13:07:10.000Z',
    payload: {
      poolId,
      userId: 'bob',
      entryType: 'bracket',
      picks: { semi: 'blue', final: 'blue' }
    }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'alice',
    occurredAt: '2026-07-04T13:08:00.000Z',
    payload: { entryId: aliceEntry.payload.entryId }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'bob',
    occurredAt: '2026-07-04T13:08:10.000Z',
    payload: { entryId: bobEntry.payload.entryId }
  })
  const snapshot = app.dispatch({
    type: 'result:record',
    actorId: 'host',
    occurredAt: '2026-07-04T13:09:00.000Z',
    payload: {
      competitionId: 'wager-comp',
      sourcePolicy: 'host-entered',
      results: {
        semi: { winnerEntrantId: 'blue', roundNumber: 1 },
        final: { winnerEntrantId: 'blue', roundNumber: 2 }
      }
    }
  })
  app.dispatch({
    type: 'pool:resolve',
    actorId: 'host',
    occurredAt: '2026-07-04T13:10:00.000Z',
    payload: {
      poolId,
      resultSnapshotId: snapshot.payload.snapshotId
    }
  })

  const settlementPlan = app.createWalletOpsWorkbench({ userId: 'bob' }).challengeWagers[0]
  assert.equal(settlementPlan.status, 'ready')
  assert.equal(settlementPlan.settlement.targetType, 'pool')
  assert.deepEqual(settlementPlan.settlement.winnerUserIds, ['bob'])
  settlementPlan.commandDrafts.settleStake.forEach(command => app.dispatch(command))

  assert.equal(app.createChallengeWagerPlan(challengeId).status, 'settled')
  assert.equal(app.createWalletOpsWorkbench({ userId: 'alice' }).accounts[0].balance.available, 80)
  assert.equal(app.createWalletOpsWorkbench({ userId: 'bob' }).accounts[0].balance.available, 120)
})

function createFundedChallengeApp () {
  const app = platform.createUltimateSportsPlatform()
  app.dispatch({
    type: 'room:create',
    actorId: 'alice',
    occurredAt: '2026-07-04T10:00:00.000Z',
    payload: {
      roomId: 'wager-room',
      competitionId: 'wager-comp',
      fixtureId: 'final',
      title: 'Wager Room',
      hostUserId: 'alice',
      status: 'live'
    }
  })
  ;['alice', 'bob'].forEach((userId, index) => {
    app.dispatch({
      type: 'room:join',
      actorId: userId,
      occurredAt: `2026-07-04T10:0${index + 1}:00.000Z`,
      payload: {
        roomId: 'wager-room',
        userId,
        username: userId
      }
    })
    app.dispatch({
      type: 'wallet:createAccount',
      actorId: userId,
      occurredAt: `2026-07-04T10:0${index + 1}:10.000Z`,
      payload: {
        accountId: `${userId}-demo`,
        userId,
        mode: 'demo-credit',
        currency: 'CREDITS'
      }
    })
    app.dispatch({
      type: 'wallet:credit',
      actorId: 'system',
      occurredAt: `2026-07-04T10:0${index + 1}:20.000Z`,
      payload: {
        accountId: `${userId}-demo`,
        userId,
        amount: 100,
        currency: 'CREDITS',
        reason: 'test bankroll'
      }
    })
  })
  return app
}

function commitAndReveal (app, { gameId, playerId, input, nonce }) {
  app.dispatch({
    type: 'game:commit',
    actorId: playerId,
    occurredAt: '2026-07-04T10:08:00.000Z',
    payload: {
      gameId,
      roundId: 'trivia-main',
      playerId,
      input,
      nonce
    }
  })
  app.dispatch({
    type: 'game:reveal',
    actorId: playerId,
    occurredAt: '2026-07-04T10:09:00.000Z',
    payload: {
      gameId,
      roundId: 'trivia-main',
      playerId,
      input,
      nonce
    }
  })
}
