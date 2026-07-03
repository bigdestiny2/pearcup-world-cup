'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { platform, transport, walletOps } = require('../src')

test('ultimate day-in-life flow connects creator, picks, watch, settlement, wallet, ops, and sync', () => {
  const bus = transport.createTransportSim()
  const app = platform.createUltimateSportsPlatform({
    peerId: 'organizer',
    transport: bus
  })
  const applied = app.applyScenario('ultimate-day-in-life', {
    competitionId: 'day-cup',
    roomId: 'day-room',
    draftId: 'day-draft'
  })
  app.joinScenarioTopics(applied.scenario)

  const day = applied.scenario.dayInLife
  const competitionId = day.competitionId
  const roomId = day.roomId
  const classicPoolId = day.poolIds['classic-bracket']
  const fanAPicks = {
    [`${competitionId}:r1:m1`]: 'red',
    [`${competitionId}:r1:m2`]: 'gold',
    [`${competitionId}:r2:m1`]: 'red'
  }
  const fanBPicks = {
    [`${competitionId}:r1:m1`]: 'blue',
    [`${competitionId}:r1:m2`]: 'gold',
    [`${competitionId}:r2:m1`]: 'gold'
  }

  const creatorBefore = app.createCreatorWorkbench({ userId: day.organizerId })
  assert.equal(creatorBefore.draftEditor.controls.canPublish, true)
  assert.equal(app.view().competitions[competitionId].status, 'open')

  submitAndLockPick(app, 'fan-a', classicPoolId, fanAPicks, '2026-07-03T09:20:00.000Z')
  submitAndLockPick(app, 'fan-b', classicPoolId, fanBPicks, '2026-07-03T09:22:00.000Z')
  assert.equal(
    app.createPickWorkbench({ userId: 'fan-a', poolId: classicPoolId }).selectedPoolBuilder.currentEntry.status,
    'locked'
  )

  const marketEvent = createAndResolveNextEventMarket({ app, organizerId: day.organizerId, roomId })
  const gameEvent = createAndResolveTriviaGame({ app, organizerId: day.organizerId, roomId })

  const resultPlan = app.dispatchCreatorResultPlan({
    competitionId,
    poolIds: [classicPoolId],
    hostUserId: day.organizerId,
    occurredAt: '2026-07-03T10:00:00.000Z',
    results: {
      [`${competitionId}:r1:m1`]: { winnerEntrantId: 'red', roundNumber: 1 },
      [`${competitionId}:r1:m2`]: { winnerEntrantId: 'gold', roundNumber: 1 },
      [`${competitionId}:r2:m1`]: { winnerEntrantId: 'red', roundNumber: 2 }
    }
  })
  assert.deepEqual(app.view().poolSettlements[classicPoolId].winnerUserIds, ['fan-a'])

  const pool = app.view().pools[classicPoolId]
  const planEvent = app.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    occurredAt: '2026-07-03T10:01:00.000Z',
    payload: {
      poolId: classicPoolId,
      rulesVersion: pool.rules.rulesVersion,
      resultSnapshotId: resultPlan.plan.snapshot.snapshotId,
      mode: 'demo'
    }
  })
  const receiptEvent = app.dispatch({
    type: 'settlement:receipt',
    actorId: 'system',
    occurredAt: '2026-07-03T10:02:00.000Z',
    payload: {
      settlementPlanId: planEvent.payload.settlementPlanId
    }
  })
  const walletBefore = app.createWalletOpsWorkbench({ userId: 'fan-a' })
  app.dispatch({
    ...walletBefore.receipts[0].commandDrafts.grantRewards,
    occurredAt: '2026-07-03T10:03:00.000Z'
  })

  const opsBefore = app.createOpsWorkbench({ userId: 'operator' })
  const receiptAttestation = opsBefore.attestations.queues.find(queue => {
    return queue.targetType === 'receipt' && queue.targetId === receiptEvent.payload.receiptId
  })
  app.dispatch({
    ...receiptAttestation.commandDraft,
    occurredAt: '2026-07-03T10:04:00.000Z'
  })
  app.dispatch({
    ...opsBefore.notifications.commandDraft,
    occurredAt: '2026-07-03T10:05:00.000Z'
  })
  app.dispatch({
    ...opsBefore.roomOps.find(room => room.roomId === roomId).commandDrafts.summarizeRoom,
    occurredAt: '2026-07-03T10:06:00.000Z'
  })

  const fanExperience = app.createExperience({ userId: 'fan-a' })
  const creatorExperience = app.createExperience({ userId: day.organizerId })
  const opsAfter = app.createOpsWorkbench({ userId: 'operator' })

  assert.equal(walletBefore.receipts[0].commandDrafts.grantRewards.type, 'wallet:grantReceiptRewards')
  assert.equal(app.createWalletOpsWorkbench({ userId: 'fan-a' }).accounts[0].balance.available, walletOps.DEFAULT_REWARD_AMOUNT)
  assert.equal(opsAfter.attestations.existing.some(item => item.targetId === receiptEvent.payload.receiptId && item.status === 'verified'), true)
  assert.equal(opsAfter.notifications.total > 0, true)
  assert.equal(opsAfter.roomOps.find(room => room.roomId === roomId).latestSummaryId != null, true)
  assert.equal(creatorExperience.surfaces.creator.workbench.counts.competitions > 0, true)
  assert.equal(fanExperience.surfaces.picks.workbench.pools.length >= 2, true)
  assert.equal(fanExperience.surfaces.watch.workbench.counts.openMarkets, 0)
  assert.equal(fanExperience.surfaces.wallet.workbench.rewardGrants.length, 1)
  assert.equal(fanExperience.surfaces.ops.workbench.attestations.existing.length >= 1, true)
  assert.equal(marketEvent.type, 'PredictionMarketResolved')
  assert.equal(gameEvent.type, 'PeerGameSessionResolved')

  app.syncTopic({ kind: 'competition', id: competitionId })
  const mirror = platform.createUltimateSportsPlatform({
    peerId: 'mirror',
    transport: bus
  })
  mirror.joinTopic({ kind: 'competition', id: competitionId })
  mirror.pullTopic({ kind: 'competition', id: competitionId })

  assert.equal(mirror.root(), app.root())
  assert.deepEqual(mirror.view().poolSettlements[classicPoolId].winnerUserIds, ['fan-a'])
})

function submitAndLockPick (app, userId, poolId, picks, submittedAt) {
  const workbench = app.createPickWorkbench({ userId, poolId })
  const submit = workbench.selectedPoolBuilder.commandDrafts.submit
  const entry = app.dispatch({
    ...submit,
    occurredAt: submittedAt,
    payload: {
      ...submit.payload,
      picks
    }
  })
  const lock = app.createPickWorkbench({ userId, poolId }).selectedPoolBuilder.commandDrafts.lock
  app.dispatch({
    ...lock,
    occurredAt: addMinutes(submittedAt, 1)
  })
  return entry
}

function createAndResolveNextEventMarket ({ app, organizerId, roomId }) {
  const host = app.createWatchPartyWorkbench({ userId: organizerId, roomId })
  const nextEvent = host.marketLauncher.marketTypes.find(item => item.marketType === 'next-event')
  app.dispatch({
    ...nextEvent.commandDraft,
    occurredAt: '2026-07-03T09:30:00.000Z',
    payload: {
      ...nextEvent.commandDraft.payload,
      marketId: 'day-next-event'
    }
  })
  const fan = app.createWatchPartyWorkbench({ userId: 'fan-a', roomId })
  app.dispatch({
    ...fan.markets[0].commandDrafts.predict,
    occurredAt: '2026-07-03T09:31:00.000Z',
    payload: {
      ...fan.markets[0].commandDrafts.predict.payload,
      outcome: 'goal'
    }
  })
  const hostWithPrediction = app.createWatchPartyWorkbench({ userId: organizerId, roomId })
  app.dispatch({
    ...hostWithPrediction.markets[0].commandDrafts.lock,
    occurredAt: '2026-07-03T09:32:00.000Z'
  })
  const locked = app.createWatchPartyWorkbench({ userId: organizerId, roomId })
  return app.dispatch({
    ...locked.markets[0].commandDrafts.resolve,
    occurredAt: '2026-07-03T09:33:00.000Z',
    payload: {
      ...locked.markets[0].commandDrafts.resolve.payload,
      result: 'goal'
    }
  })
}

function createAndResolveTriviaGame ({ app, organizerId, roomId }) {
  const launcher = app.createWatchPartyWorkbench({ userId: organizerId, roomId })
  const trivia = launcher.gameLauncher.gameTypes.find(item => item.gameType === 'trivia-duel')
  app.dispatch({
    ...trivia.commandDraft,
    occurredAt: '2026-07-03T09:34:00.000Z',
    payload: {
      ...trivia.commandDraft.payload,
      gameId: 'day-trivia'
    }
  })
  const invited = app.createWatchPartyWorkbench({ userId: organizerId, roomId })
  app.dispatch({
    ...invited.games[0].commandDrafts.start,
    occurredAt: '2026-07-03T09:35:00.000Z'
  })
  const organizerActive = app.createWatchPartyWorkbench({ userId: organizerId, roomId }).games[0]
  const fanActive = app.createWatchPartyWorkbench({ userId: 'fan-a', roomId }).games[0]
  app.dispatch({
    ...organizerActive.commandDrafts.commit,
    occurredAt: '2026-07-03T09:36:00.000Z'
  })
  app.dispatch({
    ...fanActive.commandDrafts.commit,
    occurredAt: '2026-07-03T09:36:30.000Z'
  })
  const organizerCommitted = app.createWatchPartyWorkbench({ userId: organizerId, roomId }).games[0]
  const fanCommitted = app.createWatchPartyWorkbench({ userId: 'fan-a', roomId }).games[0]
  app.dispatch({
    ...organizerCommitted.commandDrafts.reveal,
    occurredAt: '2026-07-03T09:37:00.000Z'
  })
  app.dispatch({
    ...fanCommitted.commandDrafts.reveal,
    occurredAt: '2026-07-03T09:37:30.000Z'
  })
  const revealed = app.createWatchPartyWorkbench({ userId: organizerId, roomId }).games[0]
  return app.dispatch({
    ...revealed.commandDrafts.resolve,
    occurredAt: '2026-07-03T09:38:00.000Z'
  })
}

function addMinutes (isoTimestamp, minutes) {
  return new Date(new Date(isoTimestamp).getTime() + minutes * 60 * 1000).toISOString()
}
