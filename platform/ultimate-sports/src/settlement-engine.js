'use strict'

const { REAL_MONEY_GATES, SETTLEMENT_MODES } = require('./constants')
const { assertAllowed, assertNonEmptyString, cloneJson, hash32, stableId } = require('./util')

const SPONSOR_FULFILLMENT_STATUSES = Object.freeze([
  'pending',
  'claimed',
  'fulfilled',
  'disputed',
  'cancelled'
])

const SETTLEMENT_TARGET_TYPES = Object.freeze([
  'pool',
  'game',
  'card',
  'draft',
  'market'
])

function evaluateSettlementReadiness ({ mode = 'demo', gates = {}, requireEvidence = false } = {}) {
  assertAllowed(mode, SETTLEMENT_MODES, 'settlement mode')

  if (mode === 'none' || mode === 'demo') {
    return {
      ready: true,
      mode,
      missingGates: [],
      requiredGates: []
    }
  }

  if (mode === 'sponsor-prize') {
    const requiredGates = ['poolRulesAccepted']
    const gateStatuses = gateStatusMap(requiredGates, gates, requireEvidence)
    const missingGates = gateStatuses.filter(gate => !gate.passed).map(gate => gate.name)
    const missingGateEvidence = gateStatuses.filter(gate => gate.passed && !gate.hasEvidence).map(gate => gate.name)
    return {
      ready: missingGates.length === 0 && missingGateEvidence.length === 0,
      mode,
      missingGates,
      missingGateEvidence,
      requiredGates,
      gateStatuses
    }
  }

  const gateStatuses = gateStatusMap(REAL_MONEY_GATES, gates, requireEvidence)
  const missingGates = gateStatuses.filter(gate => !gate.passed).map(gate => gate.name)
  const missingGateEvidence = gateStatuses.filter(gate => gate.passed && !gate.hasEvidence).map(gate => gate.name)
  return {
    ready: missingGates.length === 0 && missingGateEvidence.length === 0,
    mode,
    missingGates,
    missingGateEvidence,
    requiredGates: REAL_MONEY_GATES.slice(),
    gateStatuses
  }
}

function createSettlementPlan (input = {}) {
  assertNonEmptyString(input.rulesVersion, 'rulesVersion')
  const targetType = input.targetType || inferTargetType(input)
  assertAllowed(targetType, SETTLEMENT_TARGET_TYPES, 'settlement target type')
  const targetId = input.targetId || input.poolId || input.gameId || input.cardId || input.slateId || input.marketId
  assertNonEmptyString(targetId, 'targetId')
  const mode = input.mode || 'demo'
  assertAllowed(mode, SETTLEMENT_MODES, 'settlement mode')
  const readiness = evaluateSettlementReadiness({
    mode,
    gates: input.gates || {},
    requireEvidence: input.requireEvidence === true
  })

  return {
    settlementPlanId: input.settlementPlanId || stableId(`settlement-${targetType}-${targetId}`, {
      targetType,
      targetId,
      rulesVersion: input.rulesVersion,
      resultSnapshotId: input.resultSnapshotId || null,
      mode
    }),
    targetType,
    targetId,
    poolId: input.poolId || (targetType === 'pool' ? targetId : null),
    rulesVersion: input.rulesVersion,
    resultSnapshotId: input.resultSnapshotId || null,
    mode,
    readiness,
    requireEvidence: input.requireEvidence === true,
    sourceEventIds: cloneJson(input.sourceEventIds || [])
  }
}

function createSettlementReceipt (input = {}) {
  const plan = input.settlementPlan || input.plan
  const settlementResult = input.settlementResult || input.result
  if (!plan || typeof plan !== 'object') throw new TypeError('settlementPlan is required')
  if (!settlementResult || typeof settlementResult !== 'object') throw new TypeError('settlementResult is required')

  const sourceEvents = Array.isArray(input.sourceEvents) ? input.sourceEvents : []
  const dependencyCheck = verifySourceEventDependencies({
    sourceEventIds: plan.sourceEventIds || [],
    events: sourceEvents,
    requiredTypes: input.requiredTypes || []
  })
  const status = plan.readiness && plan.readiness.ready && dependencyCheck.ok ? 'complete' : 'held'
  const targetType = plan.targetType || 'pool'
  const targetId = plan.targetId || plan.poolId
  const receiptBody = {
    settlementPlanId: plan.settlementPlanId,
    targetType,
    targetId,
    poolId: plan.poolId,
    rulesVersion: plan.rulesVersion,
    resultSnapshotId: plan.resultSnapshotId,
    mode: plan.mode,
    winnerUserIds: cloneJson(settlementResult.winnerUserIds || []),
    winningScore: winningScoreFor(settlementResult),
    tied: Boolean(settlementResult.tied),
    resultId: settlementResult.resultId || settlementResult.resolutionId || settlementResult.market && settlementResult.market.marketId || null,
    resultHash: settlementResult.resultHash || null,
    sourceEventIds: cloneJson(plan.sourceEventIds || []),
    dependencyHash: dependencyCheck.dependencyHash,
    eventRoot: input.eventRoot || null
  }

  return {
    receiptId: input.receiptId || stableId(`receipt-${targetType}-${targetId}`, receiptBody),
    status,
    heldReason: status === 'held' ? heldReasonFor({ plan, dependencyCheck }) : null,
    missingSourceEventIds: dependencyCheck.missingSourceEventIds,
    missingSourceTypes: dependencyCheck.missingSourceTypes,
    body: receiptBody,
    receiptHash: hash32(receiptBody),
    createdAt: input.createdAt || new Date().toISOString()
  }
}

function inferTargetType (input = {}) {
  if (input.gameId) return 'game'
  if (input.cardId) return 'card'
  if (input.slateId) return 'draft'
  if (input.marketId) return 'market'
  return 'pool'
}

function winningScoreFor (settlementResult = {}) {
  if (Object.prototype.hasOwnProperty.call(settlementResult, 'winningScore')) return settlementResult.winningScore
  const rows = settlementResult.rows || settlementResult.leaderboard || []
  return rows.length ? rows[0].score : 0
}

function verifySourceEventDependencies ({ sourceEventIds = [], events = [], requiredTypes = [] } = {}) {
  const byId = new Map(events.map(event => [event.eventId, event]))
  const sourceSet = new Set(sourceEventIds)
  const missingSourceEventIds = sourceEventIds.filter(eventId => !byId.has(eventId))
  const presentEvents = sourceEventIds.map(eventId => byId.get(eventId)).filter(Boolean)
  const presentTypes = new Set(presentEvents.map(event => event.type))
  const missingSourceTypes = requiredTypes.filter(type => !presentTypes.has(type))
  return {
    ok: missingSourceEventIds.length === 0 && missingSourceTypes.length === 0,
    missingSourceEventIds,
    missingSourceTypes,
    dependencyHash: hash32(presentEvents.map(event => ({
      eventId: event.eventId,
      type: event.type,
      payloadHash: event.payloadHash
    })))
  }
}

function createSponsorPrizeFulfillment (input = {}) {
  assertNonEmptyString(input.receiptId, 'receiptId')
  assertNonEmptyString(input.winnerUserId, 'winnerUserId')
  const status = input.status || 'pending'
  assertSponsorFulfillmentStatus(status)
  return {
    fulfillmentId: input.fulfillmentId || stableId(`sponsor-fulfillment-${input.receiptId}-${input.winnerUserId}`, {
      receiptId: input.receiptId,
      winnerUserId: input.winnerUserId,
      prize: input.prize || null
    }),
    receiptId: input.receiptId,
    winnerUserId: input.winnerUserId,
    prize: cloneJson(input.prize || null),
    status,
    sponsorId: input.sponsorId || null,
    trackingRef: input.trackingRef || null,
    history: cloneJson(input.history || [{
      status,
      at: input.updatedAt || input.createdAt || new Date().toISOString(),
      note: input.note || null
    }])
  }
}

function updateSponsorPrizeFulfillment (fulfillment, update = {}) {
  if (!fulfillment || typeof fulfillment !== 'object') throw new TypeError('fulfillment is required')
  const status = update.status || fulfillment.status
  assertSponsorFulfillmentStatus(status)
  const history = cloneJson(fulfillment.history || [])
  history.push({
    status,
    at: update.updatedAt || new Date().toISOString(),
    note: update.note || null
  })
  return {
    ...fulfillment,
    status,
    trackingRef: Object.prototype.hasOwnProperty.call(update, 'trackingRef') ? update.trackingRef : fulfillment.trackingRef,
    history
  }
}

function gateStatusMap (requiredGates, gates, requireEvidence) {
  return requiredGates.map(name => {
    const value = gates[name]
    const passed = value === true || Boolean(value && typeof value === 'object' && value.ok === true)
    const hasEvidence = !requireEvidence || Boolean(value && typeof value === 'object' && (
      value.evidenceId || value.eventId || value.receiptId || value.sourceEventId
    ))
    return {
      name,
      passed,
      hasEvidence,
      evidenceId: value && typeof value === 'object'
        ? value.evidenceId || value.eventId || value.receiptId || value.sourceEventId || null
        : null
    }
  })
}

function heldReasonFor ({ plan, dependencyCheck }) {
  if (!plan.readiness || !plan.readiness.ready) return 'settlement-readiness-incomplete'
  if (!dependencyCheck.ok) return 'source-evidence-incomplete'
  return 'held'
}

function assertSponsorFulfillmentStatus (status) {
  if (!SPONSOR_FULFILLMENT_STATUSES.includes(status)) {
    throw new RangeError(`sponsor fulfillment status must be one of: ${SPONSOR_FULFILLMENT_STATUSES.join(', ')}`)
  }
}

module.exports = {
  SPONSOR_FULFILLMENT_STATUSES,
  SETTLEMENT_TARGET_TYPES,
  evaluateSettlementReadiness,
  createSettlementPlan,
  createSettlementReceipt,
  verifySourceEventDependencies,
  createSponsorPrizeFulfillment,
  updateSponsorPrizeFulfillment
}
