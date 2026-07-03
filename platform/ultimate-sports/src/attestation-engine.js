'use strict'

const eventLog = require('./event-log')
const settlement = require('./settlement-engine')
const { assertAllowed, assertNonEmptyString, cloneJson, hash32, stableId } = require('./util')

const ATTESTATION_LANES = Object.freeze([
  'result-verification',
  'settlement-referee',
  'game-fairness',
  'dispute-referee',
  'room-summary',
  'payout-readiness'
])

const ATTESTATION_STATUSES = Object.freeze([
  'verified',
  'held',
  'rejected'
])

function createAttestation ({
  lane,
  targetType,
  targetId,
  evidenceEvents = [],
  requiredTypes = [],
  assertions = {},
  attestorId = 'qvac-referee',
  summary = null,
  confidence = 1,
  rejectedReason = null,
  createdAt = new Date().toISOString()
} = {}) {
  assertAllowed(lane, ATTESTATION_LANES, 'attestation lane')
  assertNonEmptyString(targetType, 'targetType')
  assertNonEmptyString(targetId, 'targetId')
  assertNonEmptyString(attestorId, 'attestorId')

  const evidenceEventIds = evidenceEvents.map(event => event.eventId).filter(Boolean)
  const dependencyCheck = settlement.verifySourceEventDependencies({
    sourceEventIds: evidenceEventIds,
    events: evidenceEvents,
    requiredTypes
  })
  const status = rejectedReason
    ? 'rejected'
    : dependencyCheck.ok && evidenceEventIds.length > 0
        ? 'verified'
        : 'held'
  const body = {
    lane,
    targetType,
    targetId,
    attestorId,
    evidenceEventIds,
    requiredTypes: cloneJson(requiredTypes),
    dependencyHash: dependencyCheck.dependencyHash,
    evidenceHash: eventLog.evidenceHash(evidenceEvents),
    eventRoot: eventLog.eventRoot(evidenceEvents),
    assertions: cloneJson(assertions),
    confidence: Number(confidence)
  }

  return {
    attestationId: stableId(`attestation-${lane}-${targetType}-${targetId}`, body),
    lane,
    targetType,
    targetId,
    attestorId,
    status,
    rejectedReason,
    summary,
    confidence: Number(confidence),
    evidenceEventIds,
    requiredTypes: cloneJson(requiredTypes),
    missingSourceEventIds: dependencyCheck.missingSourceEventIds,
    missingSourceTypes: dependencyCheck.missingSourceTypes,
    dependencyHash: dependencyCheck.dependencyHash,
    evidenceHash: body.evidenceHash,
    eventRoot: body.eventRoot,
    assertions: cloneJson(assertions),
    attestationHash: hash32(body),
    createdAt
  }
}

function verifyAttestation ({ attestation, evidenceEvents = [] } = {}) {
  if (!attestation || typeof attestation !== 'object') return { ok: false, errors: ['attestation is required'] }
  const expected = createAttestation({
    lane: attestation.lane,
    targetType: attestation.targetType,
    targetId: attestation.targetId,
    evidenceEvents,
    requiredTypes: attestation.requiredTypes || [],
    assertions: attestation.assertions || {},
    attestorId: attestation.attestorId,
    summary: attestation.summary,
    confidence: attestation.confidence,
    rejectedReason: attestation.rejectedReason,
    createdAt: attestation.createdAt
  })
  const errors = []
  if (attestation.attestationHash !== expected.attestationHash) errors.push('attestationHash mismatch')
  if (attestation.evidenceHash !== expected.evidenceHash) errors.push('evidenceHash mismatch')
  if (attestation.eventRoot !== expected.eventRoot) errors.push('eventRoot mismatch')
  if (attestation.status !== expected.status) errors.push('status mismatch')
  return {
    ok: errors.length === 0,
    errors,
    expected
  }
}

function attestationGate (attestation) {
  return {
    ok: Boolean(attestation && attestation.status === 'verified'),
    evidenceId: attestation && attestation.attestationId || null,
    eventId: attestation && attestation.eventId || null,
    attestationHash: attestation && attestation.attestationHash || null
  }
}

module.exports = {
  ATTESTATION_LANES,
  ATTESTATION_STATUSES,
  createAttestation,
  verifyAttestation,
  attestationGate
}
