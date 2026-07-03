'use strict'

const eventLog = require('./event-log')
const { cloneJson, hash32 } = require('./util')

const SNAPSHOT_VERSION = 'ultimate-sports-snapshot-v1'

function createPlatformSnapshot ({ events = [], peerId = null, joinedTopics = [], label = null, createdAt = new Date().toISOString() } = {}) {
  const normalizedEvents = eventLog.mergeEventLogs(events)
  const eventRoot = eventLog.eventRoot(normalizedEvents)
  const body = {
    version: SNAPSHOT_VERSION,
    label,
    peerId,
    createdAt,
    joinedTopics: Array.from(new Set(joinedTopics)).sort(),
    eventRoot,
    eventCount: normalizedEvents.length,
    events: cloneJson(normalizedEvents)
  }
  return {
    ...body,
    snapshotHash: hash32(body)
  }
}

function verifyPlatformSnapshot (snapshot) {
  const errors = []
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, errors: ['snapshot must be an object'] }
  }
  if (snapshot.version !== SNAPSHOT_VERSION) errors.push(`snapshot version must be ${SNAPSHOT_VERSION}`)
  if (!Array.isArray(snapshot.events)) errors.push('snapshot events must be an array')
  if (!Array.isArray(snapshot.joinedTopics)) errors.push('snapshot joinedTopics must be an array')

  const events = Array.isArray(snapshot.events) ? snapshot.events : []
  const eventErrors = []
  events.forEach((event, index) => {
    const verification = eventLog.verifyEventEnvelope(event)
    if (!verification.ok) eventErrors.push(`event ${index}: ${verification.errors.join(', ')}`)
  })
  errors.push(...eventErrors)

  const normalizedEvents = eventLog.mergeEventLogs(events)
  if (normalizedEvents.length !== events.length) errors.push('snapshot events contain duplicates or invalid envelopes')
  const expectedRoot = eventLog.eventRoot(normalizedEvents)
  if (snapshot.eventRoot !== expectedRoot) errors.push('snapshot eventRoot mismatch')
  if (snapshot.eventCount !== normalizedEvents.length) errors.push('snapshot eventCount mismatch')

  const expectedHash = hash32({
    version: snapshot.version,
    label: snapshot.label || null,
    peerId: snapshot.peerId || null,
    createdAt: snapshot.createdAt,
    joinedTopics: Array.from(new Set(snapshot.joinedTopics || [])).sort(),
    eventRoot: snapshot.eventRoot,
    eventCount: snapshot.eventCount,
    events: snapshot.events
  })
  if (snapshot.snapshotHash !== expectedHash) errors.push('snapshotHash mismatch')

  return {
    ok: errors.length === 0,
    errors,
    eventRoot: expectedRoot,
    eventCount: normalizedEvents.length
  }
}

function importPlatformSnapshot (snapshot) {
  const verification = verifyPlatformSnapshot(snapshot)
  if (!verification.ok) {
    const error = new Error(`invalid platform snapshot: ${verification.errors.join('; ')}`)
    error.verification = verification
    throw error
  }
  return {
    events: eventLog.mergeEventLogs(snapshot.events),
    joinedTopics: Array.from(new Set(snapshot.joinedTopics || [])).sort(),
    peerId: snapshot.peerId || null,
    eventRoot: snapshot.eventRoot,
    eventCount: snapshot.eventCount,
    snapshotHash: snapshot.snapshotHash
  }
}

function serializePlatformSnapshot (snapshot) {
  const verification = verifyPlatformSnapshot(snapshot)
  if (!verification.ok) throw new Error(`cannot serialize invalid platform snapshot: ${verification.errors.join('; ')}`)
  return JSON.stringify(snapshot)
}

function parsePlatformSnapshot (text) {
  if (typeof text !== 'string') throw new TypeError('snapshot text must be a string')
  return importPlatformSnapshot(JSON.parse(text))
}

module.exports = {
  SNAPSHOT_VERSION,
  createPlatformSnapshot,
  verifyPlatformSnapshot,
  importPlatformSnapshot,
  serializePlatformSnapshot,
  parsePlatformSnapshot
}

