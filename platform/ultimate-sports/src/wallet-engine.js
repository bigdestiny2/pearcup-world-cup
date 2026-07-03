'use strict'

const { assertAllowed, assertNonEmptyString, cloneJson, stableId } = require('./util')

const WALLET_MODES = Object.freeze([
  'demo-credit',
  'sponsor-prize',
  'real-money-readiness'
])

const WALLET_ACCOUNT_STATUSES = Object.freeze([
  'active',
  'suspended',
  'closed'
])

const LEDGER_ENTRY_TYPES = Object.freeze([
  'credit',
  'debit',
  'hold',
  'release',
  'award',
  'payout-route'
])

const PAYOUT_ROUTE_TYPES = Object.freeze([
  'demo-credit',
  'sponsor-prize',
  'external-wallet'
])

function createWalletAccount (input = {}) {
  assertNonEmptyString(input.userId, 'userId')
  const mode = input.mode || 'demo-credit'
  assertAllowed(mode, WALLET_MODES, 'wallet mode')
  const status = input.status || 'active'
  assertAllowed(status, WALLET_ACCOUNT_STATUSES, 'wallet account status')
  const currency = input.currency || defaultCurrencyForMode(mode)

  return {
    accountId: input.accountId || stableId(`wallet-${input.userId}-${mode}-${currency}`, {
      userId: input.userId,
      mode,
      currency
    }),
    userId: input.userId,
    mode,
    currency,
    status,
    label: input.label || null,
    createdAt: input.createdAt || new Date().toISOString()
  }
}

function createLedgerEntry (input = {}) {
  assertNonEmptyString(input.accountId, 'accountId')
  assertNonEmptyString(input.userId, 'userId')
  const type = input.type || 'credit'
  assertAllowed(type, LEDGER_ENTRY_TYPES, 'ledger entry type')
  const amount = normalizedAmount(input.amount)
  const currency = input.currency || 'CREDITS'
  const createdAt = input.createdAt || new Date().toISOString()
  const body = {
    accountId: input.accountId,
    userId: input.userId,
    type,
    amount,
    currency,
    reason: input.reason || null,
    sourceType: input.sourceType || null,
    sourceId: input.sourceId || null,
    metadata: cloneJson(input.metadata || {}),
    createdAt
  }

  return {
    entryId: input.entryId || stableId(`wallet-entry-${input.accountId}-${type}`, body),
    ...body
  }
}

function deriveLedgerBalances (entries = [], accounts = {}) {
  const balances = {}
  Object.values(accounts || {}).forEach(account => {
    balances[account.accountId] = emptyBalance(account)
  })

  entries.forEach(entry => {
    if (!balances[entry.accountId]) balances[entry.accountId] = emptyBalance(entry)
    balances[entry.accountId] = applyLedgerEntry(balances[entry.accountId], entry)
  })

  return balances
}

function applyLedgerEntry (balance, entry = {}) {
  const next = {
    ...balance,
    userId: balance.userId || entry.userId,
    currency: balance.currency || entry.currency || 'CREDITS',
    entries: balance.entries.slice()
  }
  const amount = normalizedAmount(entry.amount)
  if (entry.type === 'credit' || entry.type === 'award') next.balance += amount
  if (entry.type === 'debit') next.balance -= amount
  if (entry.type === 'hold') next.holds += amount
  if (entry.type === 'release') next.holds = Math.max(0, next.holds - amount)
  next.available = next.balance - next.holds
  if (entry.entryId) next.entries.push(entry.entryId)
  return next
}

function createPayoutRoute (input = {}) {
  assertNonEmptyString(input.userId, 'userId')
  const routeType = input.routeType || 'demo-credit'
  assertAllowed(routeType, PAYOUT_ROUTE_TYPES, 'payout route type')
  const createdAt = input.createdAt || new Date().toISOString()
  const body = {
    userId: input.userId,
    routeType,
    label: input.label || defaultRouteLabel(routeType),
    providerRef: input.providerRef || null,
    readiness: cloneJson(input.readiness || {}),
    metadata: cloneJson(input.metadata || {}),
    createdAt
  }

  return {
    routeId: input.routeId || stableId(`payout-route-${input.userId}-${routeType}`, body),
    status: input.status || 'ready',
    ...body
  }
}

function createReceiptRewardGrant (input = {}) {
  const receipt = input.receipt
  if (!receipt || typeof receipt !== 'object') throw new TypeError('receipt is required')
  if (receipt.status !== 'complete') throw new Error('receipt must be complete before rewards can be granted')

  const winnerUserIds = cloneJson(receipt.body && receipt.body.winnerUserIds || [])
  const accountsByUserId = input.accountsByUserId || {}
  const amountPerWinner = normalizedAmount(input.amountPerWinner == null ? 100 : input.amountPerWinner)
  const currency = input.currency || 'CREDITS'
  const createdAt = input.createdAt || new Date().toISOString()
  const entries = winnerUserIds.map(userId => {
    const account = accountsByUserId[userId]
    const accountId = typeof account === 'string' ? account : account && account.accountId
    if (!accountId) throw new Error(`wallet account not found for winner: ${userId}`)
    return createLedgerEntry({
      accountId,
      userId,
      type: input.entryType || 'award',
      amount: amountPerWinner,
      currency,
      reason: input.reason || 'settlement reward',
      sourceType: 'settlement-receipt',
      sourceId: receipt.receiptId,
      metadata: {
        settlementMode: receipt.body.mode,
        targetType: receipt.body.targetType,
        targetId: receipt.body.targetId,
        prize: cloneJson(input.prize || null)
      },
      createdAt
    })
  })
  const body = {
    receiptId: receipt.receiptId,
    mode: receipt.body.mode,
    targetType: receipt.body.targetType,
    targetId: receipt.body.targetId,
    winnerUserIds,
    amountPerWinner,
    currency,
    prize: cloneJson(input.prize || null),
    entries,
    createdAt
  }

  return {
    grantId: input.grantId || stableId(`wallet-grant-${receipt.receiptId}`, body),
    status: entries.length > 0 ? 'granted' : 'no-winners',
    ...body
  }
}

function defaultCurrencyForMode (mode) {
  if (mode === 'sponsor-prize') return 'PRIZE'
  if (mode === 'real-money-readiness') return 'ROUTE'
  return 'CREDITS'
}

function defaultRouteLabel (routeType) {
  if (routeType === 'external-wallet') return 'External payout route'
  if (routeType === 'sponsor-prize') return 'Sponsor prize claim'
  return 'Demo credits'
}

function emptyBalance (source = {}) {
  return {
    accountId: source.accountId,
    userId: source.userId || null,
    currency: source.currency || 'CREDITS',
    balance: 0,
    holds: 0,
    available: 0,
    entries: []
  }
}

function normalizedAmount (value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('amount must be a non-negative number')
  return amount
}

module.exports = {
  WALLET_MODES,
  WALLET_ACCOUNT_STATUSES,
  LEDGER_ENTRY_TYPES,
  PAYOUT_ROUTE_TYPES,
  createWalletAccount,
  createLedgerEntry,
  deriveLedgerBalances,
  applyLedgerEntry,
  createPayoutRoute,
  createReceiptRewardGrant,
  defaultCurrencyForMode
}
