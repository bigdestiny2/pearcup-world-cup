'use strict'

const { REAL_MONEY_GATES } = require('./constants')
const settlement = require('./settlement-engine')
const { assertAllowed, assertNonEmptyString, cloneJson, hash32, stableId } = require('./util')

const COMPLIANCE_PROFILE_STATUSES = Object.freeze([
  'active',
  'restricted',
  'suspended'
])

const RESPONSIBLE_LIMIT_TYPES = Object.freeze([
  'daily-stake',
  'weekly-stake',
  'monthly-stake',
  'max-entries-per-day',
  'cooldown'
])

const PLAY_EXPOSURE_TYPES = Object.freeze([
  'stake',
  'entry',
  'loss',
  'win'
])

const PAYOUT_RECIPIENT_STATUSES = Object.freeze([
  'declared',
  'verified',
  'revoked'
])

function createComplianceProfile (input = {}) {
  assertNonEmptyString(input.userId, 'userId')
  const status = input.status || 'active'
  assertAllowed(status, COMPLIANCE_PROFILE_STATUSES, 'compliance profile status')
  const createdAt = input.createdAt || input.updatedAt || new Date().toISOString()
  const body = {
    userId: input.userId,
    jurisdiction: input.jurisdiction || null,
    status,
    kycVerified: input.kycVerified === true,
    ageVerified: input.ageVerified === true,
    jurisdictionAllowed: input.jurisdictionAllowed === true,
    termsAccepted: input.termsAccepted === true,
    responsiblePlayAccepted: input.responsiblePlayAccepted === true,
    evidence: cloneJson(input.evidence || {}),
    metadata: cloneJson(input.metadata || {}),
    updatedAt: input.updatedAt || createdAt
  }
  return {
    complianceProfileId: input.complianceProfileId || stableId(`compliance-profile-${input.userId}`, body),
    ...body
  }
}

function createResponsiblePlayLimit (input = {}) {
  assertNonEmptyString(input.userId, 'userId')
  const limitType = input.limitType || 'daily-stake'
  assertAllowed(limitType, RESPONSIBLE_LIMIT_TYPES, 'responsible play limit type')
  const createdAt = input.createdAt || new Date().toISOString()
  const body = {
    userId: input.userId,
    limitType,
    amount: input.amount == null ? null : nonNegativeNumber(input.amount, 'amount'),
    currency: input.currency || 'CREDITS',
    startsAt: input.startsAt || createdAt,
    endsAt: input.endsAt || null,
    status: input.status || 'active',
    source: input.source || 'user',
    metadata: cloneJson(input.metadata || {})
  }
  return {
    limitId: input.limitId || stableId(`responsible-limit-${input.userId}-${limitType}`, body),
    ...body
  }
}

function createPlayExposure (input = {}) {
  assertNonEmptyString(input.userId, 'userId')
  const exposureType = input.exposureType || 'stake'
  assertAllowed(exposureType, PLAY_EXPOSURE_TYPES, 'play exposure type')
  const amount = nonNegativeNumber(input.amount == null ? 0 : input.amount, 'amount')
  const occurredAt = input.occurredAt || new Date().toISOString()
  const body = {
    userId: input.userId,
    exposureType,
    amount,
    currency: input.currency || 'CREDITS',
    sourceType: input.sourceType || null,
    sourceId: input.sourceId || null,
    occurredAt,
    metadata: cloneJson(input.metadata || {})
  }
  return {
    exposureId: input.exposureId || stableId(`play-exposure-${input.userId}-${exposureType}`, body),
    ...body
  }
}

function createPayoutRecipientDeclaration (input = {}) {
  assertNonEmptyString(input.userId, 'userId')
  const status = input.status || 'declared'
  assertAllowed(status, PAYOUT_RECIPIENT_STATUSES, 'payout recipient status')
  const asset = input.asset || input.currency || 'USDT'
  const routeType = input.routeType || 'external-wallet'
  const declaredAt = input.declaredAt || input.createdAt || new Date().toISOString()
  const recipientHash = input.recipientHash || hash32({
    userId: input.userId,
    asset,
    routeType,
    recipient: input.recipient || input.address || input.providerRef || null
  })
  const providerRefHash = input.providerRefHash || (input.providerRef ? hash32(input.providerRef) : null)
  const body = {
    userId: input.userId,
    asset,
    routeType,
    recipientHash,
    providerRefHash,
    status,
    evidenceId: input.evidenceId || null,
    declaredAt,
    metadata: cloneJson(input.metadata || {})
  }
  return {
    declarationId: input.declarationId || stableId(`payout-recipient-${input.userId}-${asset}`, body),
    ...body
  }
}

function evaluateResponsiblePlay (input = {}) {
  const limits = (input.limits || []).filter(limit => limit && limit.status !== 'revoked')
  const exposures = input.exposures || []
  const proposedExposure = input.proposedExposure || null
  const now = input.now || proposedExposure && proposedExposure.occurredAt || new Date().toISOString()
  const statuses = limits.map(limit => limitStatus({ limit, exposures, proposedExposure, now }))
  const violations = statuses.filter(status => status.violated)
  return {
    ready: violations.length === 0,
    userId: input.userId || limits[0] && limits[0].userId || proposedExposure && proposedExposure.userId || null,
    violations,
    limitStatuses: statuses
  }
}

function collectComplianceGateEvidence (input = {}) {
  const profile = input.profile || null
  const payoutDeclaration = input.payoutDeclaration || latestActivePayoutDeclaration(input.payoutDeclarations || [])
  const responsiblePlay = input.responsiblePlay || null
  const gates = {
    ...(input.gates || {})
  }

  if (profile) {
    setGate(gates, 'kycVerified', profile.kycVerified, profileEvidence(profile, 'kycVerified'))
    setGate(gates, 'ageVerified', profile.ageVerified, profileEvidence(profile, 'ageVerified'))
    setGate(gates, 'jurisdictionAllowed', profile.jurisdictionAllowed && profile.status === 'active', profileEvidence(profile, 'jurisdictionAllowed'))
    setGate(gates, 'responsiblePlayAccepted', profile.responsiblePlayAccepted && (!responsiblePlay || responsiblePlay.ready), profileEvidence(profile, 'responsiblePlayAccepted'))
  }
  if (payoutDeclaration) {
    setGate(gates, 'payoutRouteDeclared', payoutDeclaration.status !== 'revoked', payoutDeclaration.evidenceId || payoutDeclaration.declarationId)
  }
  Object.entries(input.evidence || {}).forEach(([gate, evidence]) => {
    gates[gate] = normalizeGateEvidence(evidence)
  })

  return cloneJson(gates)
}

function createReadinessPanel (input = {}) {
  const mode = input.mode || 'real-money'
  const profile = input.profile || null
  const payoutDeclaration = input.payoutDeclaration || latestActivePayoutDeclaration(input.payoutDeclarations || [])
  const responsiblePlay = input.responsiblePlay || evaluateResponsiblePlay({
    userId: profile && profile.userId || input.userId,
    limits: input.limits || [],
    exposures: input.exposures || [],
    proposedExposure: input.proposedExposure || null,
    now: input.now
  })
  const gates = collectComplianceGateEvidence({
    profile,
    payoutDeclaration,
    payoutDeclarations: input.payoutDeclarations,
    responsiblePlay,
    gates: input.gates || {},
    evidence: input.evidence || {}
  })
  const readiness = settlement.evaluateSettlementReadiness({
    mode,
    gates,
    requireEvidence: input.requireEvidence !== false
  })
  const createdAt = input.createdAt || input.now || new Date().toISOString()
  const sections = readiness.requiredGates.map(gate => ({
    gate,
    status: gateStatus(readiness, gate),
    evidenceId: gates[gate] && gates[gate].evidenceId || null
  }))

  return {
    readinessPanelId: input.readinessPanelId || stableId(`readiness-${input.targetType || 'user'}-${input.targetId || input.userId || 'target'}`, {
      mode,
      userId: input.userId || profile && profile.userId || null,
      targetType: input.targetType || null,
      targetId: input.targetId || null,
      gates
    }),
    userId: input.userId || profile && profile.userId || null,
    targetType: input.targetType || null,
    targetId: input.targetId || null,
    mode,
    ready: readiness.ready === true && responsiblePlay.ready === true,
    readiness,
    gates,
    sections,
    responsiblePlay,
    payoutDeclarationId: payoutDeclaration && payoutDeclaration.declarationId || null,
    createdAt
  }
}

function latestActivePayoutDeclaration (declarations = []) {
  return declarations
    .filter(item => item && item.status !== 'revoked')
    .sort((left, right) => String(right.declaredAt || '').localeCompare(String(left.declaredAt || '')))[0] || null
}

function limitStatus ({ limit, exposures = [], proposedExposure = null, now }) {
  const active = isLimitActive(limit, now)
  const relevant = active ? exposuresForLimit({ limit, exposures, now }) : []
  const proposedApplies = active && proposedMatchesLimit(limit, proposedExposure)
  const proposedAmount = proposedApplies ? Number(proposedExposure.amount || 0) : 0
  const used = usageForLimit(limit, relevant)
  const projected = used + (limit.limitType === 'max-entries-per-day' ? (proposedApplies ? 1 : 0) : proposedAmount)
  const violated = active && (
    limit.limitType === 'cooldown'
      ? Date.parse(now) < Date.parse(limit.endsAt || now)
      : Number(limit.amount || 0) >= 0 && projected > Number(limit.amount || 0)
  )

  return {
    limitId: limit.limitId,
    userId: limit.userId,
    limitType: limit.limitType,
    active,
    amount: limit.amount,
    currency: limit.currency,
    used,
    projected,
    remaining: limit.limitType === 'cooldown' || limit.amount == null ? null : Math.max(0, Number(limit.amount) - used),
    violated,
    startsAt: limit.startsAt,
    endsAt: limit.endsAt
  }
}

function exposuresForLimit ({ limit, exposures, now }) {
  return exposures.filter(exposure => {
    if (!exposure || exposure.userId !== limit.userId) return false
    if (!exposureMatchesLimit(limit, exposure)) return false
    return withinLimitWindow(limit, exposure.occurredAt, now)
  })
}

function usageForLimit (limit, exposures) {
  if (limit.limitType === 'max-entries-per-day') return exposures.length
  return exposures.reduce((sum, exposure) => sum + Number(exposure.amount || 0), 0)
}

function exposureMatchesLimit (limit, exposure) {
  if (limit.limitType === 'max-entries-per-day') return exposure.exposureType === 'entry'
  if (limit.limitType === 'cooldown') return true
  return exposure.exposureType === 'stake' && exposure.currency === limit.currency
}

function proposedMatchesLimit (limit, exposure) {
  return Boolean(exposure && exposure.userId === limit.userId && exposureMatchesLimit(limit, exposure))
}

function withinLimitWindow (limit, occurredAt, now) {
  const occurred = Date.parse(occurredAt)
  const nowMs = Date.parse(now)
  if (!Number.isFinite(occurred) || !Number.isFinite(nowMs)) return false
  if (limit.limitType === 'daily-stake' || limit.limitType === 'max-entries-per-day') return occurred >= nowMs - 24 * 60 * 60 * 1000
  if (limit.limitType === 'weekly-stake') return occurred >= nowMs - 7 * 24 * 60 * 60 * 1000
  if (limit.limitType === 'monthly-stake') return occurred >= nowMs - 30 * 24 * 60 * 60 * 1000
  return true
}

function isLimitActive (limit, now) {
  if (!limit || limit.status !== 'active') return false
  const nowMs = Date.parse(now)
  const startsAt = Date.parse(limit.startsAt || now)
  const endsAt = limit.endsAt ? Date.parse(limit.endsAt) : null
  if (Number.isFinite(startsAt) && Number.isFinite(nowMs) && startsAt > nowMs) return false
  if (endsAt && Number.isFinite(endsAt) && Number.isFinite(nowMs) && limit.limitType !== 'cooldown' && endsAt < nowMs) return false
  return true
}

function setGate (gates, name, ok, evidenceId) {
  if (Object.prototype.hasOwnProperty.call(gates, name)) return
  gates[name] = ok
    ? { ok: true, evidenceId }
    : { ok: false, evidenceId: evidenceId || null }
}

function normalizeGateEvidence (value) {
  if (value && typeof value === 'object') {
    return {
      ok: value.ok === true,
      evidenceId: value.evidenceId || value.eventId || value.receiptId || value.sourceEventId || null
    }
  }
  return {
    ok: value === true,
    evidenceId: value === true ? 'manual-evidence' : null
  }
}

function profileEvidence (profile, gate) {
  return profile.evidence && (profile.evidence[gate] || profile.evidence[gate.replace(/([A-Z])/g, '-$1').toLowerCase()]) || profile.complianceProfileId
}

function gateStatus (readiness, gate) {
  if ((readiness.missingGates || []).includes(gate)) return 'missing'
  if ((readiness.missingGateEvidence || []).includes(gate)) return 'missing-evidence'
  return 'ready'
}

function nonNegativeNumber (value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new RangeError(`${label} must be a non-negative number`)
  return number
}

module.exports = {
  COMPLIANCE_PROFILE_STATUSES,
  RESPONSIBLE_LIMIT_TYPES,
  PLAY_EXPOSURE_TYPES,
  PAYOUT_RECIPIENT_STATUSES,
  REAL_MONEY_GATES,
  createComplianceProfile,
  createResponsiblePlayLimit,
  createPlayExposure,
  createPayoutRecipientDeclaration,
  evaluateResponsiblePlay,
  collectComplianceGateEvidence,
  createReadinessPanel,
  latestActivePayoutDeclaration
}
