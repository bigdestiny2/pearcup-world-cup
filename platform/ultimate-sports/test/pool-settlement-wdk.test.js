'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { createPlatformRuntime } = require('../src/platform-runtime')

function runtime () {
  return createPlatformRuntime()
}

function account (rt, userId, amount = 500, currency = 'USDT') {
  const created = rt.dispatch({ type: 'wallet:createAccount', payload: { userId, currency, mode: 'real-money-readiness' } })
  rt.dispatch({ type: 'wallet:credit', payload: { accountId: created.payload.accountId, amount, currency, reason: 'seed' } })
}

function createOfficialCompetition (rt, entrants) {
  return rt.dispatch({
    type: 'competition:create',
    payload: {
      title: 'Test Cup',
      templateKind: 'single-elimination',
      entrantShape: 'team',
      entrants: entrants.map(id => ({ entrantId: id, name: id })),
      metadata: { resultSource: 'official-feed' }
    }
  })
}

function createHostEnteredCompetition (rt, entrants) {
  return rt.dispatch({
    type: 'competition:create',
    payload: {
      title: 'Creator Cup',
      templateKind: 'single-elimination',
      entrantShape: 'team',
      entrants: entrants.map(id => ({ entrantId: id, name: id })),
      resultPolicy: 'host-entered'
    }
  })
}

function addEntrantsAndPool (rt, competitionId) {
  const pool = rt.dispatch({
    type: 'pool:create',
    payload: { competitionId, title: 'Test Pool', variant: 'classic-bracket', mode: 'demo' }
  })
  return pool
}

function submitBracket (rt, poolId, userId, picks) {
  const entry = rt.dispatch({
    type: 'prediction:submit',
    payload: { poolId, userId, picks, submittedAt: new Date().toISOString() }
  })
  rt.dispatch({ type: 'prediction:lock', payload: { entryId: entry.payload.entryId } })
  return entry
}

test('official-feed pool settles and pays out via WDK', () => {
  const rt = runtime()
  account(rt, 'alice', 100, 'USDT')
  account(rt, 'bob', 100, 'USDT')
  const comp = createOfficialCompetition(rt, ['t1', 't2', 't3', 't4'])
  const pool = addEntrantsAndPool(rt, comp.payload.competitionId)
  submitBracket(rt, pool.payload.poolId, 'alice', { 'r32-1': 't1', 'r32-2': 't3' })
  submitBracket(rt, pool.payload.poolId, 'bob', { 'r32-1': 't2', 'r32-2': 't4' })
  rt.dispatch({
    type: 'wdk:createEntryIntent',
    payload: { poolId: pool.payload.poolId, entryId: 'entry-alice', userId: 'alice', amount: 10, currency: 'USDT', mode: 'demo' }
  })
  rt.dispatch({
    type: 'wdk:createEntryIntent',
    payload: { poolId: pool.payload.poolId, entryId: 'entry-bob', userId: 'bob', amount: 10, currency: 'USDT', mode: 'demo' }
  })

  const snapshot = rt.dispatch({
    type: 'result:record',
    payload: {
      competitionId: comp.payload.competitionId,
      sourcePolicy: 'official-feed',
      results: { 'r32-1': 't1', 'r32-2': 't3' }
    }
  })

  rt.dispatch({
    type: 'pool:resolve',
    payload: { poolId: pool.payload.poolId, resultSnapshotId: snapshot.payload.snapshotId }
  })
  rt.dispatch({
    type: 'settlement:plan',
    payload: {
      poolId: pool.payload.poolId,
      rulesVersion: pool.payload.rules.rulesVersion,
      mode: 'demo',
      sourceEventIds: [snapshot.eventId]
    }
  })
  const plan = Object.values(rt.view().settlementPlans)[0]
  const receiptEvent = rt.dispatch({
    type: 'settlement:receipt',
    payload: { settlementPlanId: plan.settlementPlanId }
  })
  assert.equal(receiptEvent.payload.status, 'complete')

  rt.dispatch({
    type: 'settlement:preparePayout',
    payload: { receiptId: receiptEvent.payload.receiptId, amountPerWinner: 20, currency: 'USDT', mode: 'demo' }
  })

  const view = rt.view()
  assert.equal(Object.values(view.wdkPoolPayouts).length, 1)
  const aliceBalance = Object.values(view.walletBalances).find(b => b.userId === 'alice')
  assert.equal(aliceBalance.balance, 110)
})

test('host-entered pool holds receipt until QVAC result evidence is provided', () => {
  const rt = runtime()
  account(rt, 'alice', 100, 'USDT')
  account(rt, 'bob', 100, 'USDT')
  const comp = createHostEnteredCompetition(rt, ['t1', 't2', 't3', 't4'])
  const pool = addEntrantsAndPool(rt, comp.payload.competitionId)
  submitBracket(rt, pool.payload.poolId, 'alice', { 'r32-1': 't1', 'r32-2': 't3' })
  submitBracket(rt, pool.payload.poolId, 'bob', { 'r32-1': 't2', 'r32-2': 't4' })

  const snapshot = rt.dispatch({
    type: 'result:record',
    payload: {
      competitionId: comp.payload.competitionId,
      sourcePolicy: 'official-feed',
      results: { 'r32-1': 't1', 'r32-2': 't3' }
    }
  })

  rt.dispatch({ type: 'pool:resolve', payload: { poolId: pool.payload.poolId, resultSnapshotId: snapshot.payload.snapshotId } })
  rt.dispatch({
    type: 'settlement:plan',
    payload: {
      poolId: pool.payload.poolId,
      rulesVersion: pool.payload.rules.rulesVersion,
      mode: 'sponsor-prize',
      gates: { poolRulesAccepted: true },
      sourceEventIds: [snapshot.eventId]
    }
  })
  const plan = Object.values(rt.view().settlementPlans)[0]
  const held = rt.dispatch({ type: 'settlement:receipt', payload: { settlementPlanId: plan.settlementPlanId } })
  assert.equal(held.payload.status, 'held')

  const evidence = rt.dispatch({
    type: 'qvac:reviewResultEvidence',
    payload: {
      targetType: 'pool',
      targetId: pool.payload.poolId,
      resultSnapshotId: snapshot.payload.snapshotId,
      summary: 'Host confirmed results',
      verified: true
    }
  })

  const plan2 = rt.dispatch({
    type: 'settlement:plan',
    payload: {
      poolId: pool.payload.poolId,
      rulesVersion: pool.payload.rules.rulesVersion,
      mode: 'sponsor-prize',
      gates: { poolRulesAccepted: true },
      sourceEventIds: [snapshot.eventId, evidence.eventId]
    }
  })
  const ready = rt.dispatch({
    type: 'settlement:receipt',
    payload: { settlementPlanId: plan2.payload.settlementPlanId }
  })
  assert.equal(ready.payload.status, 'complete')
})
