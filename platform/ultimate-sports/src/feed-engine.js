'use strict'

const { RESULT_POLICIES } = require('./constants')
const { assertAllowed, assertNonEmptyString, cloneJson, ensureArray, hash32, stableId } = require('./util')

const FEED_ADAPTER_KINDS = Object.freeze([
  'soccer',
  'basketball',
  'esports',
  'awards',
  'manual'
])

const FEED_FRAME_TYPES = Object.freeze([
  'fixture',
  'clock',
  'score',
  'stat',
  'event',
  'result',
  'category-result',
  'map-result',
  'series-result'
])

function createResultSnapshot (input = {}) {
  assertNonEmptyString(input.competitionId, 'competitionId')
  const sourcePolicy = input.sourcePolicy || 'official-feed'
  assertAllowed(sourcePolicy, RESULT_POLICIES, 'source policy')

  const results = cloneJson(input.results || {})
  const cardResults = cloneJson(input.cardResults || {})
  const sourceFeedEventIds = cloneJson(input.sourceFeedEventIds || input.feedFrameIds || [])
  const payloadHash = hash32({
    competitionId: input.competitionId,
    sourcePolicy,
    sourceId: input.sourceId || null,
    results,
    cardResults,
    sourceFeedEventIds,
    feedStateHash: input.feedStateHash || null
  })

  return {
    snapshotId: input.snapshotId || stableId(`result-${input.competitionId}`, payloadHash),
    competitionId: input.competitionId,
    sourcePolicy,
    sourceId: input.sourceId || null,
    sourceActorId: input.sourceActorId || null,
    recordedAt: input.recordedAt || new Date().toISOString(),
    results,
    cardResults,
    sourceFeedEventIds,
    feedStateHash: input.feedStateHash || null,
    payloadHash
  }
}

function createHostResultCorrection (input = {}) {
  assertNonEmptyString(input.snapshotId, 'snapshotId')
  assertNonEmptyString(input.hostUserId, 'hostUserId')
  const correction = {
    correctionId: input.correctionId || stableId(`correction-${input.snapshotId}`, {
      snapshotId: input.snapshotId,
      hostUserId: input.hostUserId,
      results: input.results || {},
      cardResults: input.cardResults || {},
      reason: input.reason || null
    }),
    snapshotId: input.snapshotId,
    hostUserId: input.hostUserId,
    reason: input.reason || null,
    results: cloneJson(input.results || {}),
    cardResults: cloneJson(input.cardResults || {}),
    correctedAt: input.correctedAt || new Date().toISOString()
  }
  return correction
}

function applyResultCorrection (snapshot, correction) {
  if (!snapshot || typeof snapshot !== 'object') throw new TypeError('snapshot is required')
  if (!correction || typeof correction !== 'object') throw new TypeError('correction is required')
  if (correction.snapshotId !== snapshot.snapshotId) throw new Error('correction snapshotId does not match snapshot')
  const corrected = {
    ...snapshot,
    snapshotId: stableId(`result-${snapshot.competitionId}-corrected`, {
      originalSnapshotId: snapshot.snapshotId,
      correctionId: correction.correctionId
    }),
    sourcePolicy: snapshot.sourcePolicy === 'official-feed' ? 'hybrid' : snapshot.sourcePolicy,
    sourceId: snapshot.sourceId,
    recordedAt: correction.correctedAt,
    results: {
      ...cloneJson(snapshot.results || {}),
      ...cloneJson(correction.results || {})
    },
    cardResults: {
      ...cloneJson(snapshot.cardResults || {}),
      ...cloneJson(correction.cardResults || {})
    },
    correction: cloneJson(correction)
  }
  corrected.payloadHash = hash32({
    competitionId: corrected.competitionId,
    sourcePolicy: corrected.sourcePolicy,
    sourceId: corrected.sourceId || null,
    results: corrected.results,
    cardResults: corrected.cardResults,
    correctionId: correction.correctionId
  })
  return corrected
}

function createFeedEvent (input = {}) {
  assertNonEmptyString(input.eventId || input.type, 'feed event id or type')
  assertNonEmptyString(input.competitionId, 'competitionId')
  return {
    eventId: input.eventId || stableId(`feed-${input.type}`, {
      competitionId: input.competitionId,
      fixtureId: input.fixtureId || null,
      type: input.type,
      clock: input.clock || null,
      value: input.value || null
    }),
    competitionId: input.competitionId,
    fixtureId: input.fixtureId || null,
    clock: input.clock || null,
    type: input.type || 'result',
    value: cloneJson(input.value || null),
    sourceId: input.sourceId || null,
    createdAt: input.createdAt || new Date().toISOString()
  }
}

function createFeedAdapter (input = {}) {
  const kind = input.kind || input.adapterKind || 'manual'
  assertAllowed(kind, FEED_ADAPTER_KINDS, 'feed adapter kind')
  assertNonEmptyString(input.competitionId, 'competitionId')
  const sourcePolicy = input.sourcePolicy || defaultSourcePolicyForAdapter(kind)
  assertAllowed(sourcePolicy, RESULT_POLICIES, 'source policy')
  const sourceId = input.sourceId || `${kind}-adapter`
  const capabilities = {
    ...defaultCapabilitiesForAdapter(kind),
    ...cloneJson(input.capabilities || {})
  }
  const eventTypes = input.eventTypes || defaultEventTypesForAdapter(kind)

  return {
    adapterId: input.adapterId || stableId(`feed-adapter-${kind}-${input.competitionId}`, {
      kind,
      competitionId: input.competitionId,
      sourcePolicy,
      sourceId
    }),
    kind,
    competitionId: input.competitionId,
    sourcePolicy,
    sourceId,
    sourceName: input.sourceName || defaultSourceNameForAdapter(kind),
    capabilities,
    eventTypes: cloneJson(eventTypes),
    resultFields: cloneJson(input.resultFields || defaultResultFieldsForAdapter(kind)),
    createdAt: input.createdAt || new Date().toISOString()
  }
}

function createFeedFrame (input = {}) {
  const adapter = input.adapter || null
  const adapterId = input.adapterId || adapter && adapter.adapterId
  assertNonEmptyString(adapterId, 'adapterId')
  const competitionId = input.competitionId || adapter && adapter.competitionId
  assertNonEmptyString(competitionId, 'competitionId')
  const sourcePolicy = input.sourcePolicy || adapter && adapter.sourcePolicy || 'official-feed'
  assertAllowed(sourcePolicy, RESULT_POLICIES, 'source policy')
  const frameType = input.frameType || input.type || inferFrameType(input)
  assertAllowed(frameType, FEED_FRAME_TYPES, 'feed frame type')
  const sequence = Number.isFinite(Number(input.sequence)) ? Number(input.sequence) : 0
  const events = normalizeFrameEvents(input.events || input.event || [], {
    competitionId,
    fixtureId: input.fixtureId || null,
    sourceId: input.sourceId || adapter && adapter.sourceId || null,
    createdAt: input.createdAt
  })
  const body = {
    adapterId,
    competitionId,
    fixtureId: input.fixtureId || null,
    sourcePolicy,
    sourceId: input.sourceId || adapter && adapter.sourceId || null,
    frameType,
    sequence,
    clock: cloneJson(input.clock || null),
    score: cloneJson(input.score || null),
    stats: cloneJson(input.stats || {}),
    events,
    results: cloneJson(input.results || {}),
    cardResults: cloneJson(input.cardResults || {}),
    status: input.status || null,
    createdAt: input.createdAt || new Date().toISOString()
  }
  const frameHash = hash32(body)

  return {
    frameId: input.frameId || stableId(`feed-frame-${adapterId}-${sequence}-${frameType}`, frameHash),
    ...body,
    frameHash
  }
}

function replayFeedFrames (frames = [], options = {}) {
  const adapter = options.adapter || null
  const sortedFrames = ensureArray(frames, 'frames')
    .map(frame => cloneJson(frame))
    .sort(compareFeedFrames)
  const competitionId = options.competitionId || adapter && adapter.competitionId || sortedFrames[0] && sortedFrames[0].competitionId || null
  const state = {
    adapterId: options.adapterId || adapter && adapter.adapterId || sortedFrames[0] && sortedFrames[0].adapterId || null,
    competitionId,
    sourcePolicy: options.sourcePolicy || adapter && adapter.sourcePolicy || sortedFrames[0] && sortedFrames[0].sourcePolicy || 'official-feed',
    sourceId: options.sourceId || adapter && adapter.sourceId || sortedFrames[0] && sortedFrames[0].sourceId || null,
    frameIds: [],
    fixtureStates: {},
    results: {},
    cardResults: {},
    feedEvents: [],
    latestClock: null,
    stateHash: null
  }

  sortedFrames.forEach(frame => {
    state.frameIds.push(frame.frameId)
    if (frame.clock) state.latestClock = cloneJson(frame.clock)
    ;(frame.events || []).forEach(event => {
      state.feedEvents.push({
        ...event,
        sourceFrameId: frame.frameId
      })
    })
    if (frame.fixtureId) {
      const current = state.fixtureStates[frame.fixtureId] || {
        fixtureId: frame.fixtureId,
        clock: null,
        score: null,
        stats: {},
        status: null,
        eventIds: []
      }
      state.fixtureStates[frame.fixtureId] = {
        ...current,
        clock: frame.clock ? cloneJson(frame.clock) : current.clock,
        score: frame.score ? cloneJson(frame.score) : current.score,
        stats: {
          ...current.stats,
          ...cloneJson(frame.stats || {})
        },
        status: frame.status || current.status,
        eventIds: current.eventIds.concat((frame.events || []).map(event => event.eventId))
      }
    }
    Object.assign(state.results, cloneJson(frame.results || {}))
    Object.assign(state.cardResults, cloneJson(frame.cardResults || {}))
  })

  state.stateHash = hash32({
    adapterId: state.adapterId,
    competitionId: state.competitionId,
    sourcePolicy: state.sourcePolicy,
    sourceId: state.sourceId,
    frameIds: state.frameIds,
    fixtureStates: state.fixtureStates,
    results: state.results,
    cardResults: state.cardResults,
    feedEventIds: state.feedEvents.map(event => event.eventId)
  })
  return state
}

function createResultSnapshotFromReplay (input = {}) {
  const replay = input.replay
  if (!replay || typeof replay !== 'object') throw new TypeError('replay is required')
  const adapter = input.adapter || null
  return createResultSnapshot({
    competitionId: input.competitionId || replay.competitionId,
    sourcePolicy: input.sourcePolicy || replay.sourcePolicy,
    sourceId: input.sourceId || replay.sourceId || adapter && adapter.sourceId,
    sourceActorId: input.sourceActorId || null,
    recordedAt: input.recordedAt,
    results: input.results || replay.results,
    cardResults: input.cardResults || replay.cardResults,
    sourceFeedEventIds: replay.frameIds,
    feedStateHash: replay.stateHash
  })
}

function createFeedReplaySimulator (input = {}) {
  const adapter = input.adapter || createFeedAdapter(input.adapterConfig || input)
  const frames = []
  ensureArray(input.frames || [], 'frames').forEach(frame => {
    frames.push(createFeedFrame({ adapter, ...frame }))
  })

  return {
    adapter,
    frames,
    pushFrame (frame) {
      const created = createFeedFrame({ adapter, ...frame })
      frames.push(created)
      return created
    },
    replay () {
      return replayFeedFrames(frames, { adapter })
    },
    snapshot (options = {}) {
      return createResultSnapshotFromReplay({
        ...options,
        adapter,
        replay: replayFeedFrames(frames, { adapter })
      })
    }
  }
}

function normalizeFrameEvents (value, defaults = {}) {
  const list = Array.isArray(value) ? value : [value]
  return list.filter(Boolean).map((event, index) => {
    if (event.eventId && event.competitionId) return cloneJson(event)
    return createFeedEvent({
      competitionId: defaults.competitionId,
      fixtureId: event.fixtureId || defaults.fixtureId,
      type: event.type || event.eventType || 'event',
      clock: event.clock || null,
      value: event.value || event.payload || event,
      sourceId: event.sourceId || defaults.sourceId,
      createdAt: event.createdAt || defaults.createdAt,
      eventId: event.eventId || stableId(`feed-event-${event.type || event.eventType || 'event'}-${index + 1}`, {
        competitionId: defaults.competitionId,
        fixtureId: event.fixtureId || defaults.fixtureId,
        type: event.type || event.eventType || 'event',
        value: event.value || event.payload || event,
        createdAt: event.createdAt || defaults.createdAt || null
      })
    })
  })
}

function inferFrameType (input = {}) {
  if (Object.keys(input.results || {}).length > 0) return 'result'
  if (Object.keys(input.cardResults || {}).length > 0) return 'category-result'
  if (input.score) return 'score'
  if (input.clock) return 'clock'
  if (input.stats) return 'stat'
  return 'event'
}

function compareFeedFrames (left, right) {
  if (left.sequence !== right.sequence) return left.sequence - right.sequence
  return String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
}

function defaultSourcePolicyForAdapter (kind) {
  if (kind === 'manual' || kind === 'awards') return 'host-entered'
  return 'official-feed'
}

function defaultCapabilitiesForAdapter (kind) {
  if (kind === 'awards') {
    return {
      fixtures: true,
      clock: false,
      score: false,
      stats: false,
      events: true,
      results: true,
      cardResults: true
    }
  }
  if (kind === 'manual') {
    return {
      fixtures: true,
      clock: false,
      score: true,
      stats: true,
      events: true,
      results: true,
      cardResults: true
    }
  }
  return {
    fixtures: true,
    clock: true,
    score: true,
    stats: true,
    events: true,
    results: true,
    cardResults: false
  }
}

function defaultEventTypesForAdapter (kind) {
  if (kind === 'soccer') return ['goal', 'corner', 'card', 'shot', 'save', 'var']
  if (kind === 'basketball') return ['score', 'rebound', 'assist', 'foul', 'timeout']
  if (kind === 'esports') return ['map-win', 'round-win', 'objective', 'kill', 'timeout']
  if (kind === 'awards') return ['category-opened', 'winner-announced', 'performance', 'acceptance-speech']
  return ['score-update', 'result-entered', 'correction', 'note']
}

function defaultResultFieldsForAdapter (kind) {
  if (kind === 'awards') return ['winnerEntrantId']
  if (kind === 'esports') return ['winnerEntrantId', 'mapScore', 'seriesScore']
  if (kind === 'basketball') return ['winnerEntrantId', 'homeScore', 'awayScore']
  if (kind === 'soccer') return ['winnerEntrantId', 'homeScore', 'awayScore', 'extraTime', 'penalties']
  return ['winnerEntrantId', 'score']
}

function defaultSourceNameForAdapter (kind) {
  if (kind === 'soccer') return 'Soccer feed adapter'
  if (kind === 'basketball') return 'Basketball tournament adapter'
  if (kind === 'esports') return 'Esports feed adapter'
  if (kind === 'awards') return 'Awards/manual adapter'
  return 'Manual event adapter'
}

module.exports = {
  FEED_ADAPTER_KINDS,
  FEED_FRAME_TYPES,
  createResultSnapshot,
  createHostResultCorrection,
  applyResultCorrection,
  createFeedEvent,
  createFeedAdapter,
  createFeedFrame,
  replayFeedFrames,
  createResultSnapshotFromReplay,
  createFeedReplaySimulator
}
