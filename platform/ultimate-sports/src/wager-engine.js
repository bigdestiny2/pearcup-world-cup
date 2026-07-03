'use strict'

const { assertNonEmptyString, cloneJson, stableId } = require('./util')

const DEFAULT_STAKE_AMOUNT = 25
const DEFAULT_STAKE_CURRENCY = 'CREDITS'

function normalizeChallengeStake (input = {}) {
  if (!input || input.enabled === false) return null
  const amount = normalizedAmount(input.amount == null ? DEFAULT_STAKE_AMOUNT : input.amount)
  const currency = input.currency || DEFAULT_STAKE_CURRENCY
  return {
    mode: input.mode || input.stakeMode || 'demo-credit',
    amount,
    currency,
    label: input.label || 'Challenge stake',
    termsAccepted: input.termsAccepted === true,
    metadata: cloneJson(input.metadata || {})
  }
}

function createChallengeWagerPlanFromView ({ challenge, view = {}, resolution = null, occurredAt = null } = {}) {
  return createChallengeWagerPlan({
    challenge,
    accountsByUserId: accountsByUserIdForView(view),
    balancesByAccountId: view.walletBalances || {},
    ledgerEntries: Object.values(view.walletLedgerEntries || {}),
    resolution: resolution || resolveChallengeWagerOutcome({ challenge, view }),
    occurredAt
  })
}

function createChallengeWagerPlan ({
  challenge,
  accountsByUserId = {},
  balancesByAccountId = {},
  ledgerEntries = [],
  resolution = null,
  occurredAt = null
} = {}) {
  if (!challenge || typeof challenge !== 'object') throw new TypeError('challenge is required')
  assertNonEmptyString(challenge.challengeId, 'challengeId')
  const stake = normalizeChallengeStake(challenge.stake)
  const participantUserIds = challengeParticipants(challenge)
  const missingAccountUserIds = stake
    ? participantUserIds.filter(userId => !accountsByUserId[userId])
    : []
  const holdRows = participantUserIds.map(userId => holdRowFor({
    challenge,
    stake,
    userId,
    account: accountsByUserId[userId],
    balance: accountsByUserId[userId] && balancesByAccountId[accountsByUserId[userId].accountId],
    ledgerEntries,
    occurredAt
  }))
  const allHeld = Boolean(stake) && missingAccountUserIds.length === 0 && holdRows.every(row => row.status === 'held')
  const settlement = settlementFor({
    challenge,
    stake,
    participantUserIds,
    accountsByUserId,
    ledgerEntries,
    resolution,
    allHeld,
    occurredAt
  })
  const status = statusFor({ stake, missingAccountUserIds, holdRows, settlement, resolution, allHeld })

  return {
    wagerPlanId: stableId(`wager-plan-${challenge.challengeId}`, {
      stake,
      participantUserIds,
      resolutionId: resolution && resolution.resolutionId || null
    }),
    challengeId: challenge.challengeId,
    roomId: challenge.roomId,
    challengeType: challenge.challengeType,
    participantUserIds,
    stake,
    status,
    missingAccountUserIds,
    holdRows,
    holdCommands: holdRows.map(row => row.commandDraft).filter(Boolean),
    settlement,
    settlementCommands: settlement ? settlement.commands : []
  }
}

function resolveChallengeWagerOutcome ({ challenge, view = {} } = {}) {
  if (!challenge) return null
  const game = Object.values(view.gameSessions || {}).find(session => session.challengeId === challenge.challengeId)
  if (game && view.gameResolutions && view.gameResolutions[game.gameId]) {
    const resolution = view.gameResolutions[game.gameId]
    return {
      resolutionId: resolution.resultId || resolution.gameId,
      targetType: 'game',
      targetId: game.gameId,
      winnerUserIds: cloneJson(resolution.winnerUserIds || []),
      tied: resolution.tied === true
    }
  }
  const market = Object.values(view.markets || {}).find(item => item.challengeId === challenge.challengeId)
  if (market && view.marketResolutions && view.marketResolutions[market.marketId]) {
    const resolution = view.marketResolutions[market.marketId]
    return {
      resolutionId: market.marketId,
      targetType: 'market',
      targetId: market.marketId,
      winnerUserIds: cloneJson(resolution.winnerUserIds || []),
      tied: (resolution.winnerUserIds || []).length !== 1
    }
  }
  const pool = Object.values(view.pools || {}).find(item => {
    return item.metadata && item.metadata.challengeId === challenge.challengeId
  })
  if (pool && view.poolSettlements && view.poolSettlements[pool.poolId]) {
    const settlement = view.poolSettlements[pool.poolId]
    return {
      resolutionId: settlement.resultSnapshotId || pool.poolId,
      targetType: 'pool',
      targetId: pool.poolId,
      winnerUserIds: cloneJson(settlement.winnerUserIds || []),
      tied: settlement.tied === true
    }
  }
  return null
}

function accountsByUserIdForView (view = {}) {
  const accounts = {}
  Object.values(view.walletAccounts || {}).forEach(account => {
    if (account.status && account.status !== 'active') return
    if (!accounts[account.userId]) accounts[account.userId] = account
  })
  return accounts
}

function challengeParticipants (challenge) {
  return [...new Set([
    challenge.challengerUserId,
    challenge.targetUserId
  ].filter(Boolean))]
}

function holdRowFor ({ challenge, stake, userId, account, balance, ledgerEntries, occurredAt }) {
  const existingHold = sumLedger({ ledgerEntries, challengeId: challenge.challengeId, userId, type: 'hold', role: 'stake-hold' })
  const held = stake && existingHold >= stake.amount
  const available = balance ? Number(balance.available || 0) : 0
  const canHold = Boolean(stake && account && !held && available >= stake.amount)
  return {
    userId,
    accountId: account && account.accountId || null,
    requiredAmount: stake ? stake.amount : 0,
    currency: stake ? stake.currency : DEFAULT_STAKE_CURRENCY,
    heldAmount: existingHold,
    available,
    status: held ? 'held' : !stake ? 'not-staked' : !account ? 'missing-account' : canHold ? 'ready' : 'insufficient-funds',
    commandDraft: canHold
      ? ledgerCommand({
          type: 'hold',
          challenge,
          stake,
          account,
          userId,
          amount: stake.amount,
          reason: 'challenge stake hold',
          role: 'stake-hold',
          occurredAt
        })
      : null
  }
}

function settlementFor ({
  challenge,
  stake,
  participantUserIds,
  accountsByUserId,
  ledgerEntries,
  resolution,
  allHeld,
  occurredAt
}) {
  if (!stake || !resolution) return null
  if (!allHeld) {
    return {
      status: 'needs-holds',
      resolution,
      commands: []
    }
  }
  const winnerSet = new Set((resolution.winnerUserIds || []).filter(userId => participantUserIds.includes(userId)))
  const tied = resolution.tied === true || winnerSet.size !== 1
  const loserUserIds = tied ? [] : participantUserIds.filter(userId => !winnerSet.has(userId))
  const winnerUserIds = tied ? [] : [...winnerSet]
  const winnerAwardAmount = winnerUserIds.length ? (loserUserIds.length * stake.amount) / winnerUserIds.length : 0
  const releaseCommands = participantUserIds
    .filter(userId => sumLedger({ ledgerEntries, challengeId: challenge.challengeId, userId, type: 'release', role: 'stake-release' }) < stake.amount)
    .map(userId => ledgerCommand({
      type: 'release',
      challenge,
      stake,
      account: accountsByUserId[userId],
      userId,
      amount: stake.amount,
      reason: tied ? 'challenge stake returned' : 'challenge stake released',
      role: 'stake-release',
      occurredAt
    }))
  const debitCommands = loserUserIds
    .filter(userId => sumLedger({ ledgerEntries, challengeId: challenge.challengeId, userId, type: 'debit', role: 'stake-loss' }) < stake.amount)
    .map(userId => ledgerCommand({
      type: 'debit',
      challenge,
      stake,
      account: accountsByUserId[userId],
      userId,
      amount: stake.amount,
      reason: 'challenge stake loss',
      role: 'stake-loss',
      occurredAt
    }))
  const awardCommands = winnerUserIds
    .filter(userId => sumLedger({ ledgerEntries, challengeId: challenge.challengeId, userId, type: 'award', role: 'stake-win' }) < winnerAwardAmount)
    .map(userId => ledgerCommand({
      type: 'award',
      challenge,
      stake,
      account: accountsByUserId[userId],
      userId,
      amount: winnerAwardAmount,
      reason: 'challenge stake win',
      role: 'stake-win',
      occurredAt
    }))
  const commands = releaseCommands.concat(debitCommands, awardCommands).filter(Boolean)

  return {
    status: commands.length ? 'ready' : 'settled',
    resolution,
    winnerUserIds,
    loserUserIds,
    tied,
    amountPerParticipant: stake.amount,
    awardAmountPerWinner: winnerAwardAmount,
    commands
  }
}

function statusFor ({ stake, missingAccountUserIds, holdRows, settlement, resolution, allHeld }) {
  if (!stake) return 'not-staked'
  if (missingAccountUserIds.length) return 'needs-accounts'
  if (holdRows.some(row => row.status === 'insufficient-funds')) return 'needs-funds'
  if (!allHeld) return 'ready-to-hold'
  if (!resolution) return 'awaiting-result'
  return settlement && settlement.status || 'settled'
}

function ledgerCommand ({ type, challenge, stake, account, userId, amount, reason, role, occurredAt }) {
  if (!account) return null
  return {
    type: `wallet:${type}`,
    actorId: userId,
    occurredAt,
    payload: {
      accountId: account.accountId,
      userId,
      amount,
      currency: stake.currency,
      reason,
      sourceType: 'room-challenge',
      sourceId: challenge.challengeId,
      metadata: {
        role,
        challengeType: challenge.challengeType,
        roomId: challenge.roomId
      }
    }
  }
}

function sumLedger ({ ledgerEntries = [], challengeId, userId, type, role }) {
  return ledgerEntries
    .filter(entry => entry.sourceType === 'room-challenge')
    .filter(entry => entry.sourceId === challengeId)
    .filter(entry => entry.userId === userId)
    .filter(entry => entry.type === type)
    .filter(entry => !role || entry.metadata && entry.metadata.role === role)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
}

function normalizedAmount (value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('stake amount must be a non-negative number')
  return amount
}

module.exports = {
  DEFAULT_STAKE_AMOUNT,
  DEFAULT_STAKE_CURRENCY,
  normalizeChallengeStake,
  createChallengeWagerPlan,
  createChallengeWagerPlanFromView,
  resolveChallengeWagerOutcome,
  accountsByUserIdForView
}
