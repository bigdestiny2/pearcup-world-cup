'use strict'

const { canonicalJson, cloneJson, hash32 } = require('./util')

function createEventEnvelope ({ type, payload = {}, actorId = 'system', occurredAt = new Date().toISOString(), previousEventId = null } = {}) {
  if (typeof type !== 'string' || type.trim() === '') throw new TypeError('event type is required')
  if (typeof actorId !== 'string' || actorId.trim() === '') throw new TypeError('actorId is required')

  const unsigned = {
    type,
    actorId,
    occurredAt,
    previousEventId,
    payload: cloneJson(payload)
  }
  const payloadHash = hash32(unsigned.payload)
  const eventId = hash32({ ...unsigned, payloadHash })
  const signature = hash32({ eventId, actorId, payloadHash })

  return {
    eventId,
    type,
    actorId,
    occurredAt,
    previousEventId,
    payloadHash,
    payload: unsigned.payload,
    signature
  }
}

function verifyEventEnvelope (event) {
  if (!event || typeof event !== 'object') return { ok: false, errors: ['event is required'] }
  const errors = []
  const expectedPayloadHash = hash32(event.payload)
  if (event.payloadHash !== expectedPayloadHash) errors.push('payloadHash mismatch')
  const expectedEventId = hash32({
    type: event.type,
    actorId: event.actorId,
    occurredAt: event.occurredAt,
    previousEventId: event.previousEventId || null,
    payload: event.payload,
    payloadHash: expectedPayloadHash
  })
  if (event.eventId !== expectedEventId) errors.push('eventId mismatch')
  const expectedSignature = hash32({
    eventId: event.eventId,
    actorId: event.actorId,
    payloadHash: event.payloadHash
  })
  if (event.signature !== expectedSignature) errors.push('signature mismatch')
  return {
    ok: errors.length === 0,
    errors
  }
}

function eventRoot (events = []) {
  return hash32(events.map(event => ({
    eventId: event.eventId,
    previousEventId: event.previousEventId || null,
    payloadHash: event.payloadHash,
    signature: event.signature
  })))
}

function appendEvent (events = [], eventInput = {}) {
  const previousEventId = events.length ? events[events.length - 1].eventId : null
  const event = createEventEnvelope({ ...eventInput, previousEventId })
  return events.concat(event)
}

function mergeEventLogs (...logs) {
  const byId = new Map()
  logs.flat().forEach(event => {
    const verification = verifyEventEnvelope(event)
    if (!verification.ok) return
    if (!byId.has(event.eventId)) byId.set(event.eventId, cloneJson(event))
  })

  return [...byId.values()].sort((left, right) => {
    if (left.occurredAt !== right.occurredAt) return String(left.occurredAt).localeCompare(String(right.occurredAt))
    return String(left.eventId).localeCompare(String(right.eventId))
  })
}

function createEventLog (initialEvents = []) {
  let events = mergeEventLogs(initialEvents)

  return {
    append (eventInput) {
      events = appendEvent(events, eventInput)
      return events[events.length - 1]
    },
    merge (incomingEvents = []) {
      events = mergeEventLogs(events, incomingEvents)
      return events.slice()
    },
    events () {
      return events.slice()
    },
    root () {
      return eventRoot(events)
    }
  }
}

function evidenceHash (events = []) {
  return hash32(events.map(event => ({
    eventId: event.eventId,
    type: event.type,
    payloadHash: event.payloadHash
  })))
}

function canonicalEventPayload (value) {
  return canonicalJson(value)
}

module.exports = {
  createEventEnvelope,
  verifyEventEnvelope,
  appendEvent,
  mergeEventLogs,
  createEventLog,
  eventRoot,
  evidenceHash,
  canonicalEventPayload
}

