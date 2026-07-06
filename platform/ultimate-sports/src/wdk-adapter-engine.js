'use strict'

const { assertAllowed, assertNonEmptyString, cloneJson, stableId } = require('./util')
const wallet = require('./wallet-engine')

const WDK_MODES = Object.freeze(['demo', 'sdk'])
const WDK_CURRENCIES = Object.freeze(['USDT', 'USDV', 'CREDITS'])
const WDK_STATUSES = Object.freeze(['pending', 'locked', 'released', 'refunded', 'confirmed', 'failed'])

function assertWdkMode (mode) {
  assertAllowed(mode, WDK_MODES, 'WDK mode')
}

function assertCurrency (currency) {
  assertAllowed(currency, WDK_CURRENCIES, 'WDK currency')
}

function assertAmount (amount) {
  const value = Number(amount)
  if (!Number.isFinite(value) || value < 0) throw new RangeError('amount must be a non-negative number')
  return value
}

function wdkTransactionId (prefix, body) {
  return stableId(`wdk-${prefix}`, body)
}

function createGameEscrow (input = {}) {
  assertNonEmptyString(input.gameId, 'gameId')
  const userIds = Array.isArray(input.userIds) ? input.userIds : []
  if (userIds.length === 0) throw new TypeError('userIds is required')
  const amountPerPlayer = assertAmount(input.amountPerPlayer)
  const currency = input.currency || 'CREDITS'
  assertCurrency(currency)
  const mode = input.mode || 'demo'
  assertWdkMode(mode)
  const createdAt = input.createdAt || new Date().toISOString()
  const totalAmount = amountPerPlayer * userIds.length

  const body = {
    escrowId: input.escrowId || stableId(`wdk-escrow-${input.gameId}`, { userIds, totalAmount, currency }),
    gameId: input.gameId,
    userIds: cloneJson(userIds),
    amountPerPlayer,
    totalAmount,
    currency,
    mode,
    status: 'locked',
    wdkTransactionId: input.wdkTransactionId || wdkTransactionId('escrow-locked', { gameId: input.gameId, userIds, totalAmount }),
    ledgerEntries: (input.ledgerEntries || []).map(entry => wallet.createLedgerEntry(entry)),
    createdAt
  }
  return body
}

function releaseGameEscrow (input = {}) {
  const escrow = input.escrow
  if (!escrow) throw new TypeError('escrow is required')
  const winnerUserIds = Array.isArray(input.winnerUserIds) ? input.winnerUserIds : []
  const releasedAmount = assertAmount(input.releasedAmount != null ? input.releasedAmount : escrow.totalAmount)
  const createdAt = input.createdAt || new Date().toISOString()

  return {
    releaseId: input.releaseId || stableId(`wdk-release-${escrow.escrowId}`, { winnerUserIds, releasedAmount }),
    escrowId: escrow.escrowId,
    gameId: escrow.gameId,
    winnerUserIds: cloneJson(winnerUserIds),
    releasedAmount,
    currency: escrow.currency,
    mode: escrow.mode,
    status: 'released',
    wdkTransactionId: input.wdkTransactionId || wdkTransactionId('escrow-released', { escrowId: escrow.escrowId, winnerUserIds }),
    ledgerEntries: (input.ledgerEntries || []).map(entry => wallet.createLedgerEntry(entry)),
    createdAt
  }
}

function refundGameEscrow (input = {}) {
  const escrow = input.escrow
  if (!escrow) throw new TypeError('escrow is required')
  const userIds = Array.isArray(input.userIds) ? input.userIds : escrow.userIds
  const refundedAmount = assertAmount(input.refundedAmount != null ? input.refundedAmount : escrow.totalAmount)
  const createdAt = input.createdAt || new Date().toISOString()

  return {
    refundId: input.refundId || stableId(`wdk-refund-${escrow.escrowId}`, { userIds, refundedAmount }),
    escrowId: escrow.escrowId,
    gameId: escrow.gameId,
    userIds: cloneJson(userIds),
    refundedAmount,
    currency: escrow.currency,
    mode: escrow.mode,
    status: 'refunded',
    wdkTransactionId: input.wdkTransactionId || wdkTransactionId('escrow-refunded', { escrowId: escrow.escrowId, userIds }),
    ledgerEntries: (input.ledgerEntries || []).map(entry => wallet.createLedgerEntry(entry)),
    createdAt
  }
}

function createEntryIntent (input = {}) {
  assertNonEmptyString(input.poolId, 'poolId')
  assertNonEmptyString(input.entryId, 'entryId')
  assertNonEmptyString(input.userId, 'userId')
  const amount = assertAmount(input.amount)
  const currency = input.currency || 'CREDITS'
  assertCurrency(currency)
  const mode = input.mode || 'demo'
  assertWdkMode(mode)
  const createdAt = input.createdAt || new Date().toISOString()

  return {
    intentId: input.intentId || stableId(`wdk-intent-${input.entryId}`, { poolId: input.poolId, userId: input.userId, amount }),
    poolId: input.poolId,
    entryId: input.entryId,
    userId: input.userId,
    amount,
    currency,
    mode,
    status: 'pending',
    wdkTransactionId: input.wdkTransactionId || wdkTransactionId('entry-intent', { entryId: input.entryId, amount }),
    ledgerEntries: (input.ledgerEntries || []).map(entry => wallet.createLedgerEntry(entry)),
    createdAt
  }
}

function confirmEntryIntent (input = {}) {
  const intent = input.intent
  if (!intent) throw new TypeError('intent is required')
  const createdAt = input.createdAt || new Date().toISOString()

  return {
    confirmationId: input.confirmationId || stableId(`wdk-confirm-${intent.intentId}`, { status: 'confirmed' }),
    intentId: intent.intentId,
    poolId: intent.poolId,
    entryId: intent.entryId,
    userId: intent.userId,
    amount: intent.amount,
    currency: intent.currency,
    mode: intent.mode,
    status: 'confirmed',
    wdkTransactionId: input.wdkTransactionId || wdkTransactionId('entry-confirmed', { intentId: intent.intentId }),
    ledgerEntries: (input.ledgerEntries || []).map(entry => wallet.createLedgerEntry(entry)),
    createdAt
  }
}

function reconcileEntryIntent (input = {}) {
  const intent = input.intent
  if (!intent) throw new TypeError('intent is required')
  const status = input.status || 'confirmed'
  assertAllowed(status, ['pending', 'confirmed', 'failed'], 'entry intent reconciliation status')
  const createdAt = input.createdAt || new Date().toISOString()

  return {
    reconciliationId: input.reconciliationId || stableId(`wdk-reconcile-${intent.intentId}`, { status }),
    intentId: intent.intentId,
    poolId: intent.poolId,
    entryId: intent.entryId,
    userId: intent.userId,
    amount: intent.amount,
    currency: intent.currency,
    mode: intent.mode,
    status,
    wdkTransactionId: input.wdkTransactionId || wdkTransactionId('entry-reconciled', { intentId: intent.intentId, status }),
    ledgerEntries: (input.ledgerEntries || []).map(entry => wallet.createLedgerEntry(entry)),
    createdAt
  }
}

function refundEntryIntent (input = {}) {
  const intent = input.intent
  if (!intent) throw new TypeError('intent is required')
  const createdAt = input.createdAt || new Date().toISOString()

  return {
    refundId: input.refundId || stableId(`wdk-intent-refund-${intent.intentId}`, { amount: intent.amount }),
    intentId: intent.intentId,
    poolId: intent.poolId,
    entryId: intent.entryId,
    userId: intent.userId,
    amount: intent.amount,
    currency: intent.currency,
    mode: intent.mode,
    status: 'refunded',
    wdkTransactionId: input.wdkTransactionId || wdkTransactionId('entry-refunded', { intentId: intent.intentId }),
    ledgerEntries: (input.ledgerEntries || []).map(entry => wallet.createLedgerEntry(entry)),
    createdAt
  }
}

function createPoolPayout (input = {}) {
  assertNonEmptyString(input.poolId, 'poolId')
  const receiptId = input.receiptId || null
  const winnerUserIds = Array.isArray(input.winnerUserIds) ? input.winnerUserIds : []
  const amountPerWinner = assertAmount(input.amountPerWinner)
  const totalAmount = amountPerWinner * winnerUserIds.length
  const currency = input.currency || 'CREDITS'
  assertCurrency(currency)
  const mode = input.mode || 'demo'
  assertWdkMode(mode)
  const createdAt = input.createdAt || new Date().toISOString()

  return {
    payoutId: input.payoutId || stableId(`wdk-payout-${input.poolId}`, { winnerUserIds, totalAmount }),
    poolId: input.poolId,
    receiptId,
    winnerUserIds: cloneJson(winnerUserIds),
    amountPerWinner,
    totalAmount,
    currency,
    mode,
    status: 'prepared',
    wdkTransactionId: input.wdkTransactionId || wdkTransactionId('pool-payout', { poolId: input.poolId, totalAmount }),
    ledgerEntries: (input.ledgerEntries || []).map(entry => wallet.createLedgerEntry(entry)),
    createdAt
  }
}

module.exports = {
  WDK_MODES,
  WDK_CURRENCIES,
  WDK_STATUSES,
  createGameEscrow,
  releaseGameEscrow,
  refundGameEscrow,
  createEntryIntent,
  confirmEntryIntent,
  reconcileEntryIntent,
  refundEntryIntent,
  createPoolPayout
}
