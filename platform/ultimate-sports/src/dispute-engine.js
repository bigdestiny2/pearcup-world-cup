'use strict'

const { assertAllowed, assertNonEmptyString, cloneJson, hash32, stableId } = require('./util')
const eventLog = require('./event-log')

const DISPUTE_TARGET_TYPES = Object.freeze([
  'receipt',
  'result-snapshot',
  'pool',
  'game',
  'card',
  'draft',
  'market',
  'room-message'
])

const DISPUTE_STATUSES = Object.freeze([
  'open',
  'responded',
  'resolved',
  'cancelled'
])

const DISPUTE_RESOLUTIONS = Object.freeze([
  'upheld',
  'rejected',
  'voided',
  'corrected',
  'cancelled'
])

function openDispute (input = {}) {
  assertAllowed(input.targetType, DISPUTE_TARGET_TYPES, 'dispute target type')
  assertNonEmptyString(input.targetId, 'targetId')
  assertNonEmptyString(input.openedByUserId, 'openedByUserId')
  assertNonEmptyString(input.reason, 'reason')
  const body = {
    targetType: input.targetType,
    targetId: input.targetId,
    openedByUserId: input.openedByUserId,
    reason: input.reason,
    evidenceEventIds: cloneJson(input.evidenceEventIds || [])
  }

  return {
    disputeId: input.disputeId || stableId(`dispute-${input.targetType}-${input.targetId}`, body),
    targetType: input.targetType,
    targetId: input.targetId,
    openedByUserId: input.openedByUserId,
    reason: input.reason,
    evidenceEventIds: cloneJson(input.evidenceEventIds || []),
    note: input.note || null,
    openedAt: input.openedAt || new Date().toISOString(),
    status: 'open',
    history: cloneJson(input.history || [{
      action: 'opened',
      userId: input.openedByUserId,
      at: input.openedAt || new Date().toISOString(),
      note: input.note || input.reason
    }])
  }
}

function respondToDispute ({ dispute, responderUserId, response, evidenceEventIds = [], respondedAt = new Date().toISOString() } = {}) {
  if (!dispute || typeof dispute !== 'object') throw new TypeError('dispute is required')
  assertNonEmptyString(responderUserId, 'responderUserId')
  assertNonEmptyString(response, 'response')
  const history = cloneJson(dispute.history || [])
  history.push({
    action: 'responded',
    userId: responderUserId,
    at: respondedAt,
    note: response,
    evidenceEventIds: cloneJson(evidenceEventIds)
  })

  return {
    ...dispute,
    response,
    responderUserId,
    responseEvidenceEventIds: cloneJson(evidenceEventIds),
    respondedAt,
    status: 'responded',
    history
  }
}

function resolveDispute ({ dispute, resolvedByUserId, resolution, note = null, evidenceEventIds = [], resolvedAt = new Date().toISOString() } = {}) {
  if (!dispute || typeof dispute !== 'object') throw new TypeError('dispute is required')
  assertNonEmptyString(resolvedByUserId, 'resolvedByUserId')
  assertAllowed(resolution, DISPUTE_RESOLUTIONS, 'dispute resolution')
  const history = cloneJson(dispute.history || [])
  history.push({
    action: 'resolved',
    userId: resolvedByUserId,
    at: resolvedAt,
    resolution,
    note,
    evidenceEventIds: cloneJson(evidenceEventIds)
  })

  return {
    ...dispute,
    resolution,
    resolvedByUserId,
    resolutionNote: note,
    resolutionEvidenceEventIds: cloneJson(evidenceEventIds),
    resolvedAt,
    status: resolution === 'cancelled' ? 'cancelled' : 'resolved',
    history
  }
}

function createAuditBundle ({ targetType, targetId, events = [], dispute = null, label = null, includePayloads = false, createdAt = new Date().toISOString() } = {}) {
  assertNonEmptyString(targetType, 'targetType')
  assertNonEmptyString(targetId, 'targetId')
  const eventSummaries = events.map(event => summarizeEvent(event, includePayloads))
  const body = {
    targetType,
    targetId,
    disputeId: dispute && dispute.disputeId || null,
    eventIds: eventSummaries.map(event => event.eventId),
    eventRoot: eventLog.eventRoot(events)
  }

  return {
    auditBundleId: stableId(`audit-${targetType}-${targetId}`, body),
    label,
    targetType,
    targetId,
    disputeId: body.disputeId,
    eventCount: eventSummaries.length,
    eventRoot: body.eventRoot,
    events: eventSummaries,
    dispute: cloneJson(dispute || null),
    auditHash: hash32({
      ...body,
      events: eventSummaries
    }),
    createdAt
  }
}

function summarizeEvent (event = {}, includePayloads = false) {
  const summary = {
    eventId: event.eventId,
    type: event.type,
    actorId: event.actorId,
    occurredAt: event.occurredAt,
    payloadHash: event.payloadHash,
    previousHash: event.previousHash,
    eventHash: event.eventHash
  }
  if (includePayloads) summary.payload = cloneJson(event.payload || null)
  return summary
}

module.exports = {
  DISPUTE_TARGET_TYPES,
  DISPUTE_STATUSES,
  DISPUTE_RESOLUTIONS,
  openDispute,
  respondToDispute,
  resolveDispute,
  createAuditBundle,
  summarizeEvent
}
