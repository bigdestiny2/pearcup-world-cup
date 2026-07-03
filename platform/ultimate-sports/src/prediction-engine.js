'use strict'

const {
  ENTRY_TYPES,
  POOL_VARIANTS,
  RISK_CLASSES,
  SETTLEMENT_MODES
} = require('./constants')
const {
  assertAllowed,
  assertNonEmptyString,
  cloneJson,
  stableId
} = require('./util')

function createPoolRules (input = {}) {
  const variant = input.variant || 'classic-bracket'
  const payoutPolicy = input.payoutPolicy || 'demo'
  const riskClass = input.riskClass || riskClassForPayoutPolicy(payoutPolicy)
  assertAllowed(variant, POOL_VARIANTS, 'pool variant')
  assertAllowed(payoutPolicy, SETTLEMENT_MODES, 'payout policy')
  assertAllowed(riskClass, RISK_CLASSES, 'risk class')

  return {
    rulesVersion: input.rulesVersion || stableId(`rules-${variant}`, {
      variant,
      scoringVersion: input.scoringVersion || `${variant}-v1`,
      lockPolicy: input.lockPolicy || 'fixture-lock',
      tiePolicy: input.tiePolicy || 'split',
      payoutPolicy
    }),
    variant,
    scoringVersion: input.scoringVersion || `${variant}-v1`,
    lockPolicy: input.lockPolicy || 'fixture-lock',
    tiePolicy: input.tiePolicy || 'split',
    payoutPolicy,
    riskClass,
    config: cloneJson(input.config || {})
  }
}

function createPredictionEntry (input = {}) {
  assertNonEmptyString(input.poolId, 'poolId')
  assertNonEmptyString(input.userId, 'userId')
  const entryType = input.entryType || 'bracket'
  assertAllowed(entryType, ENTRY_TYPES, 'entry type')

  return {
    entryId: input.entryId || stableId(`entry-${input.poolId}-${input.userId}`, {
      poolId: input.poolId,
      userId: input.userId,
      entryType,
      picks: input.picks || {}
    }),
    poolId: input.poolId,
    userId: input.userId,
    entryType,
    picks: cloneJson(input.picks || {}),
    submittedAt: input.submittedAt || null,
    lockedAt: input.lockedAt || null,
    status: input.status || (input.submittedAt ? 'submitted' : 'draft')
  }
}

function submitPredictionEntry (entry, submittedAt = new Date().toISOString()) {
  if (!entry || typeof entry !== 'object') throw new TypeError('entry is required')
  if (entry.status === 'locked' || entry.status === 'settled') {
    throw new Error(`cannot submit entry with status ${entry.status}`)
  }
  return {
    ...entry,
    submittedAt,
    status: 'submitted'
  }
}

function lockPredictionEntry (entry, lockedAt = new Date().toISOString()) {
  if (!entry || typeof entry !== 'object') throw new TypeError('entry is required')
  if (entry.status !== 'submitted' && entry.status !== 'draft') {
    throw new Error(`cannot lock entry with status ${entry.status}`)
  }
  return {
    ...entry,
    submittedAt: entry.submittedAt || lockedAt,
    lockedAt,
    status: 'locked'
  }
}

function validateConfidencePicks (picks, options = {}) {
  const list = Array.isArray(picks) ? picks : Object.values(picks || {})
  const requireUnique = options.requireUnique !== false
  const seen = new Set()
  const errors = []

  list.forEach((pick, index) => {
    const confidence = Number(pick && pick.confidence)
    if (!Number.isFinite(confidence) || confidence <= 0) {
      errors.push(`pick ${index + 1} must have a positive confidence`)
      return
    }
    if (requireUnique && seen.has(confidence)) {
      errors.push(`confidence ${confidence} is used more than once`)
    }
    seen.add(confidence)
  })

  return {
    ok: errors.length === 0,
    errors
  }
}

function riskClassForPayoutPolicy (payoutPolicy) {
  if (payoutPolicy === 'real-money') return 'regulated'
  if (payoutPolicy === 'sponsor-prize') return 'prize'
  return 'casual'
}

module.exports = {
  createPoolRules,
  createPredictionEntry,
  submitPredictionEntry,
  lockPredictionEntry,
  validateConfidencePicks,
  riskClassForPayoutPolicy
}

