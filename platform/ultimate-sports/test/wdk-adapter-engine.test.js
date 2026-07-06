'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const wdk = require('../src/wdk-adapter-engine')
const { createPlatformRuntime } = require('../src/platform-runtime')

function runtime () {
  return createPlatformRuntime()
}

function account (runtime, userId, amount = 1000, currency = 'USDT') {
  const created = runtime.dispatch({ type: 'wallet:createAccount', payload: { userId, currency, mode: 'real-money-readiness' } })
  runtime.dispatch({ type: 'wallet:credit', payload: { accountId: created.payload.accountId, amount, currency, reason: 'seed' } })
}

test('wdk adapter creates game escrow record', () => {
  const escrow = wdk.createGameEscrow({
    gameId: 'game-1',
    userIds: ['alice', 'bob'],
    amountPerPlayer: 50,
    currency: 'USDT',
    mode: 'demo'
  })
  assert.equal(escrow.status, 'locked')
  assert.equal(escrow.totalAmount, 100)
  assert.equal(escrow.wdkTransactionId.startsWith('wdk-'), true)
})

test('runtime creates game escrow and debits players', () => {
  const rt = runtime()
  account(rt, 'alice', 200, 'USDT')
  account(rt, 'bob', 200, 'USDT')
  rt.dispatch({
    type: 'wdk:createGameEscrow',
    payload: { gameId: 'game-1', userIds: ['alice', 'bob'], amountPerPlayer: 50, currency: 'USDT', mode: 'demo' }
  })
  const view = rt.view()
  assert.equal(Object.values(view.wdkGameEscrows).length, 1)
  assert.equal(view.walletBalances[Object.keys(view.walletBalances)[0]].balance, 150)
  assert.equal(view.walletBalances[Object.keys(view.walletBalances)[1]].balance, 150)
})

test('runtime releases game escrow and awards winners', () => {
  const rt = runtime()
  account(rt, 'alice', 200, 'USDT')
  account(rt, 'bob', 200, 'USDT')
  rt.dispatch({ type: 'wdk:createGameEscrow', payload: { gameId: 'game-1', userIds: ['alice', 'bob'], amountPerPlayer: 50, currency: 'USDT', mode: 'demo' } })
  const escrow = Object.values(rt.view().wdkGameEscrows)[0]
  rt.dispatch({ type: 'wdk:releaseGameEscrow', payload: { escrowId: escrow.escrowId, winnerUserIds: ['alice'], amountPerWinner: 100 } })
  const view = rt.view()
  const balances = Object.values(view.walletBalances)
  const aliceBalance = balances.find(b => b.userId === 'alice')
  const bobBalance = balances.find(b => b.userId === 'bob')
  assert.equal(aliceBalance.balance, 250)
  assert.equal(bobBalance.balance, 150)
})

test('runtime refunds game escrow', () => {
  const rt = runtime()
  account(rt, 'alice', 200, 'USDT')
  account(rt, 'bob', 200, 'USDT')
  rt.dispatch({ type: 'wdk:createGameEscrow', payload: { gameId: 'game-1', userIds: ['alice', 'bob'], amountPerPlayer: 50, currency: 'USDT', mode: 'demo' } })
  const escrow = Object.values(rt.view().wdkGameEscrows)[0]
  rt.dispatch({ type: 'wdk:refundGameEscrow', payload: { escrowId: escrow.escrowId } })
  const view = rt.view()
  const balances = Object.values(view.walletBalances)
  assert.ok(balances.every(b => b.balance === 200))
})

test('runtime creates entry intent and pool payout', () => {
  const rt = runtime()
  account(rt, 'alice', 200, 'USDT')
  account(rt, 'bob', 200, 'USDT')
  rt.dispatch({
    type: 'wdk:createEntryIntent',
    payload: { poolId: 'pool-1', entryId: 'entry-1', userId: 'alice', amount: 25, currency: 'USDT', mode: 'demo' }
  })
  rt.dispatch({
    type: 'wdk:createEntryIntent',
    payload: { poolId: 'pool-1', entryId: 'entry-2', userId: 'bob', amount: 25, currency: 'USDT', mode: 'demo' }
  })
  const intent = Object.values(rt.view().wdkEntryIntents)[0]
  rt.dispatch({ type: 'wdk:confirmEntryIntent', payload: { intentId: intent.intentId } })
  rt.dispatch({
    type: 'wdk:createPoolPayout',
    payload: {
      poolId: 'pool-1',
      winnerUserIds: ['alice'],
      amountPerWinner: 50,
      currency: 'USDT',
      mode: 'demo'
    }
  })
  const view = rt.view()
  assert.equal(Object.values(view.wdkPoolPayouts).length, 1)
  const aliceBalance = Object.values(view.walletBalances).find(b => b.userId === 'alice')
  assert.equal(aliceBalance.balance, 225)
})
