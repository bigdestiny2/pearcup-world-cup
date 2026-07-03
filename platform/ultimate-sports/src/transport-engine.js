'use strict'

const eventLog = require('./event-log')
const { assertNonEmptyString, cloneJson, hash32 } = require('./util')

const TOPIC_KINDS = Object.freeze([
  'lobby',
  'competition',
  'pool',
  'room',
  'game',
  'feed',
  'creator'
])

function topicFor (kind, id = null) {
  if (!TOPIC_KINDS.includes(kind)) throw new RangeError(`topic kind must be one of: ${TOPIC_KINDS.join(', ')}`)
  if (kind === 'lobby') return 'pearcup:v2:lobby'
  assertNonEmptyString(id, `${kind} id`)
  return `pearcup:v2:${kind}:${id}`
}

function createTransportSim () {
  const topics = new Map()
  const memberships = new Map()

  function joinTopic ({ peerId, topic } = {}) {
    assertNonEmptyString(peerId, 'peerId')
    assertNonEmptyString(topic, 'topic')
    ensureTopic(topic)
    if (!memberships.has(peerId)) memberships.set(peerId, new Set())
    memberships.get(peerId).add(topic)
    return {
      peerId,
      topic,
      joined: true,
      topicRoot: topicRoot(topic)
    }
  }

  function leaveTopic ({ peerId, topic } = {}) {
    assertNonEmptyString(peerId, 'peerId')
    assertNonEmptyString(topic, 'topic')
    if (memberships.has(peerId)) memberships.get(peerId).delete(topic)
    return {
      peerId,
      topic,
      joined: false
    }
  }

  function publish ({ peerId, topic, events = [] } = {}) {
    requireMembership(peerId, topic)
    const store = ensureTopic(topic)
    const acceptedEventIds = []
    const rejected = []

    events.forEach(event => {
      const verification = eventLog.verifyEventEnvelope(event)
      if (!verification.ok) {
        rejected.push({ eventId: event && event.eventId || null, errors: verification.errors })
        return
      }
      if (!store.events.has(event.eventId)) {
        store.events.set(event.eventId, cloneJson(event))
        acceptedEventIds.push(event.eventId)
      }
    })

    return {
      peerId,
      topic,
      accepted: acceptedEventIds.length,
      acceptedEventIds,
      rejected,
      topicRoot: topicRoot(topic)
    }
  }

  function pull ({ peerId, topic, sinceEventIds = [] } = {}) {
    requireMembership(peerId, topic)
    const seen = new Set(sinceEventIds)
    const events = topicEvents(topic).filter(event => !seen.has(event.eventId))
    return {
      peerId,
      topic,
      events,
      topicRoot: topicRoot(topic)
    }
  }

  function syncRuntime ({ peerId, topic, runtime } = {}) {
    if (!runtime || typeof runtime.merge !== 'function' || typeof runtime.events !== 'function') {
      throw new TypeError('runtime with merge() and events() is required')
    }
    publish({ peerId, topic, events: runtime.events() })
    const pulled = pull({
      peerId,
      topic,
      sinceEventIds: runtime.events().map(event => event.eventId)
    })
    runtime.merge(pulled.events)
    publish({ peerId, topic, events: runtime.events() })
    return {
      peerId,
      topic,
      pulledCount: pulled.events.length,
      runtimeRoot: runtime.root(),
      topicRoot: topicRoot(topic)
    }
  }

  function topicEvents (topic) {
    const store = ensureTopic(topic)
    return eventLog.mergeEventLogs([...store.events.values()])
  }

  function topicRoot (topic) {
    return eventLog.eventRoot(topicEvents(topic))
  }

  function compareTopicRoots (topic, peerRoots = {}) {
    const root = topicRoot(topic)
    const mismatchedPeers = Object.keys(peerRoots).filter(peerId => peerRoots[peerId] !== root)
    return {
      topic,
      topicRoot: root,
      ok: mismatchedPeers.length === 0,
      mismatchedPeers
    }
  }

  function status () {
    const topicStatuses = {}
    for (const topic of topics.keys()) {
      topicStatuses[topic] = {
        eventCount: topics.get(topic).events.size,
        topicRoot: topicRoot(topic),
        topicHash: hash32(topic)
      }
    }
    const peerTopics = {}
    for (const [peerId, topicSet] of memberships.entries()) {
      peerTopics[peerId] = [...topicSet].sort()
    }
    return {
      topics: topicStatuses,
      memberships: peerTopics
    }
  }

  function ensureTopic (topic) {
    if (!topics.has(topic)) topics.set(topic, { events: new Map() })
    return topics.get(topic)
  }

  function requireMembership (peerId, topic) {
    assertNonEmptyString(peerId, 'peerId')
    assertNonEmptyString(topic, 'topic')
    if (!memberships.has(peerId) || !memberships.get(peerId).has(topic)) {
      throw new Error(`peer ${peerId} has not joined topic ${topic}`)
    }
  }

  return {
    joinTopic,
    leaveTopic,
    publish,
    pull,
    syncRuntime,
    topicEvents,
    topicRoot,
    compareTopicRoots,
    status
  }
}

module.exports = {
  TOPIC_KINDS,
  topicFor,
  createTransportSim
}

