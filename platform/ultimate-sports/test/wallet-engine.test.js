'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { constants, platform, prediction, runtime, wallet } = require('../src')

function evidencedRealMoneyGates () {
  return Object.fromEntries(constants.REAL_MONEY_GATES.map(gate => [
    gate,
    { ok: true, evidenceId: `${gate}-evidence` }
  ]))
}

function buildCompleteReceiptRuntime () {
  const app = runtime.createPlatformRuntime()
  const competitionEvent = app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T23:00:00.000Z',
    payload: {
      competitionId: 'wallet-comp',
      title: 'Wallet Cup',
      templateConfig: { kind: 'single-elimination' },
      entrants: [
        { entrantId: 'alpha', name: 'Alpha' },
        { entrantId: 'beta', name: 'Beta' }
      ]
    }
  })
  const rules = prediction.createPoolRules({ variant: 'classic-bracket', payoutPolicy: 'demo' })
  const poolEvent = app.dispatch({
    type: 'pool:create',
    actorId: 'host',
    occurredAt: '2026-07-03T23:01:00.000Z',
    payload: {
      poolId: 'wallet-pool',
      competitionId: 'wallet-comp',
      rules,
      mode: 'demo'
    }
  })
  const entryEvent = app.dispatch({
    type: 'prediction:submit',
    actorId: 'winner',
    occurredAt: '2026-07-03T23:02:00.000Z',
    payload: {
      poolId: 'wallet-pool',
      userId: 'winner',
      entryType: 'bracket',
      picks: { final: 'alpha' }
    }
  })
  const lockEvent = app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T23:03:00.000Z',
    payload: { entryId: entryEvent.payload.entryId }
  })
  const resultEvent = app.dispatch({
    type: 'result:record',
    actorId: 'feed',
    occurredAt: '2026-07-03T23:04:00.000Z',
    payload: {
      competitionId: 'wallet-comp',
      sourcePolicy: 'official-feed',
      results: {
        final: { winnerEntrantId: 'alpha', roundNumber: 1 }
      }
    }
  })
  const settlementEvent = app.dispatch({
    type: 'pool:resolve',
    actorId: 'system',
    occurredAt: '2026-07-03T23:05:00.000Z',
    payload: {
      poolId: 'wallet-pool',
      resultSnapshotId: resultEvent.payload.snapshotId
    }
  })
  app.dispatch({
    type: 'wallet:createAccount',
    actorId: 'winner',
    occurredAt: '2026-07-03T23:05:30.000Z',
    payload: {
      accountId: 'wallet-winner',
      userId: 'winner',
      mode: 'demo-credit',
      currency: 'CREDITS'
    }
  })
  const planEvent = app.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    occurredAt: '2026-07-03T23:06:00.000Z',
    payload: {
      poolId: 'wallet-pool',
      rulesVersion: poolEvent.payload.rules.rulesVersion,
      resultSnapshotId: resultEvent.payload.snapshotId,
      mode: 'demo',
      sourceEventIds: [
        competitionEvent.eventId,
        poolEvent.eventId,
        lockEvent.eventId,
        resultEvent.eventId,
        settlementEvent.eventId
      ]
    }
  })
  const receiptEvent = app.dispatch({
    type: 'settlement:receipt',
    actorId: 'system',
    occurredAt: '2026-07-03T23:07:00.000Z',
    payload: {
      settlementPlanId: planEvent.payload.settlementPlanId,
      requiredTypes: ['PoolCreated', 'PredictionEntryLocked', 'ResultSnapshotRecorded', 'PoolSettlementResolved']
    }
  })

  return { app, receiptEvent }
}

test('wallet ledger derives balances, holds, and available credits', () => {
  const account = wallet.createWalletAccount({
    accountId: 'acct-fan',
    userId: 'fan',
    mode: 'demo-credit',
    currency: 'CREDITS',
    createdAt: '2026-07-03T18:00:00.000Z'
  })
  const entries = [
    wallet.createLedgerEntry({
      entryId: 'entry-credit',
      accountId: account.accountId,
      userId: account.userId,
      type: 'credit',
      amount: 500,
      currency: 'CREDITS',
      reason: 'seed balance',
      createdAt: '2026-07-03T18:01:00.000Z'
    }),
    wallet.createLedgerEntry({
      entryId: 'entry-hold',
      accountId: account.accountId,
      userId: account.userId,
      type: 'hold',
      amount: 125,
      currency: 'CREDITS',
      reason: 'challenge stake',
      createdAt: '2026-07-03T18:02:00.000Z'
    }),
    wallet.createLedgerEntry({
      entryId: 'entry-release',
      accountId: account.accountId,
      userId: account.userId,
      type: 'release',
      amount: 25,
      currency: 'CREDITS',
      reason: 'partial release',
      createdAt: '2026-07-03T18:03:00.000Z'
    }),
    wallet.createLedgerEntry({
      entryId: 'entry-debit',
      accountId: account.accountId,
      userId: account.userId,
      type: 'debit',
      amount: 100,
      currency: 'CREDITS',
      reason: 'demo entry fee',
      createdAt: '2026-07-03T18:04:00.000Z'
    })
  ]

  const balances = wallet.deriveLedgerBalances(entries, { [account.accountId]: account })

  assert.equal(balances[account.accountId].balance, 400)
  assert.equal(balances[account.accountId].holds, 100)
  assert.equal(balances[account.accountId].available, 300)
  assert.deepEqual(balances[account.accountId].entries, ['entry-credit', 'entry-hold', 'entry-release', 'entry-debit'])
})

test('runtime grants settlement receipt rewards into replayable wallet balances', () => {
  const { app, receiptEvent } = buildCompleteReceiptRuntime()

  const grantEvent = app.dispatch({
    type: 'wallet:grantReceiptRewards',
    actorId: 'system',
    occurredAt: '2026-07-03T23:08:00.000Z',
    payload: {
      receiptId: receiptEvent.payload.receiptId,
      amountPerWinner: 250,
      currency: 'CREDITS'
    }
  })
  const view = app.view()
  const replayed = runtime.derivePlatformView(app.events())

  assert.equal(grantEvent.payload.status, 'granted')
  assert.equal(grantEvent.payload.entries[0].accountId, 'wallet-winner')
  assert.equal(view.walletRewardGrants[grantEvent.payload.grantId].receiptId, receiptEvent.payload.receiptId)
  assert.equal(view.walletBalances['wallet-winner'].balance, 250)
  assert.equal(replayed.walletBalances['wallet-winner'].available, 250)
})

test('facade treats external payout routes as real-money readiness', () => {
  const command = {
    type: 'wallet:createPayoutRoute',
    actorId: 'winner',
    payload: {
      userId: 'winner',
      routeType: 'external-wallet',
      mode: 'real-money-readiness',
      label: 'Winner payout route'
    }
  }
  const blocked = platform.createUltimateSportsPlatform()
  const ready = platform.createUltimateSportsPlatform({
    policyContext: {
      allowRealMoney: true,
      gates: evidencedRealMoneyGates()
    }
  })

  assert.equal(blocked.evaluateCommand(command).allowed, false)
  assert.equal(blocked.evaluateCommand(command).riskClass, 'regulated')

  const decision = ready.evaluateCommand(command)
  const event = ready.dispatch(command)

  assert.equal(decision.allowed, true)
  assert.equal(decision.mode, 'real-money')
  assert.equal(event.type, 'PayoutRouteCreated')
  assert.equal(ready.view().payoutRoutes[event.payload.routeId].routeType, 'external-wallet')
})
