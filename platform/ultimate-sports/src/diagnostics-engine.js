'use strict'

const eventLog = require('./event-log')
const { cloneJson, hash32, stableId } = require('./util')

const DIAGNOSTIC_LEVELS = Object.freeze([
  'ok',
  'warning',
  'critical'
])

function createPeerSyncDiagnostic (input = {}) {
  const topic = input.topic || null
  const topicRoot = input.topicRoot || eventLog.eventRoot(input.topicEvents || [])
  const topicEventIds = new Set((input.topicEvents || []).map(event => event.eventId))
  const peers = normalizePeerStates(input.peers || [])
  const peerReports = peers.map(peer => {
    const peerEvents = peer.events || []
    const peerEventIds = new Set(peer.eventIds || peerEvents.map(event => event.eventId))
    const missingEventIds = topicEventIds.size
      ? [...topicEventIds].filter(eventId => !peerEventIds.has(eventId)).sort()
      : []
    const rootMatches = peer.runtimeRoot === topicRoot || peer.root === topicRoot
    const joined = peer.joined !== false
    const level = !joined || !rootMatches || missingEventIds.length > 0
      ? 'critical'
      : 'ok'
    return {
      peerId: peer.peerId,
      joined,
      runtimeRoot: peer.runtimeRoot || peer.root || null,
      eventCount: peer.eventCount == null ? peerEventIds.size : peer.eventCount,
      rootMatches,
      missingEventIds,
      level
    }
  })
  const criticalPeers = peerReports.filter(peer => peer.level === 'critical').map(peer => peer.peerId)
  const level = criticalPeers.length > 0
    ? 'critical'
    : peerReports.length === 0
      ? 'warning'
      : 'ok'

  return {
    diagnosticId: input.diagnosticId || stableId(`diagnostic-sync-${topic || 'topic'}`, {
      topic,
      topicRoot,
      peers: peerReports.map(peer => ({
        peerId: peer.peerId,
        runtimeRoot: peer.runtimeRoot,
        missingEventIds: peer.missingEventIds
      }))
    }),
    kind: 'peer-sync',
    topic,
    topicRoot,
    level,
    ok: level === 'ok',
    criticalPeers,
    peerReports,
    checkedAt: input.checkedAt || new Date().toISOString()
  }
}

function summarizeTransportStatus (status = {}) {
  const topics = status.topics || {}
  const memberships = status.memberships || {}
  const topicRows = Object.entries(topics).map(([topic, info]) => ({
    topic,
    eventCount: info.eventCount || 0,
    topicRoot: info.topicRoot || null,
    topicHash: info.topicHash || hash32(topic),
    memberCount: Object.values(memberships).filter(topicList => (topicList || []).includes(topic)).length
  }))
  const emptyTopics = topicRows.filter(row => row.eventCount === 0).map(row => row.topic)
  const orphanTopics = topicRows.filter(row => row.memberCount === 0).map(row => row.topic)
  const level = orphanTopics.length > 0
    ? 'warning'
    : 'ok'

  return {
    kind: 'transport-status',
    level,
    ok: level === 'ok',
    topicCount: topicRows.length,
    peerCount: Object.keys(memberships).length,
    emptyTopics,
    orphanTopics,
    topics: topicRows.sort((left, right) => left.topic.localeCompare(right.topic)),
    memberships: cloneJson(memberships)
  }
}

function createBracketPoolLoadSimulation (input = {}) {
  const poolId = input.poolId || 'load-pool'
  const userCount = positiveInteger(input.userCount, 100)
  const entrantIds = input.entrantIds || ['alpha', 'beta']
  const fixtureIds = input.fixtureIds || ['final']
  const actualWinnerId = input.actualWinnerId || entrantIds[0]
  const alternateWinnerId = input.alternateWinnerId || entrantIds[1] || entrantIds[0]
  const perfectEvery = positiveInteger(input.perfectEvery, 10)
  const startedAt = input.startedAt || '2026-07-03T00:00:00.000Z'
  const entries = []
  const commands = []
  const results = {}
  const expectedWinnerUserIds = []

  fixtureIds.forEach((fixtureId, index) => {
    results[fixtureId] = {
      winnerEntrantId: actualWinnerId,
      roundNumber: index + 1
    }
  })

  for (let index = 0; index < userCount; index += 1) {
    const userId = input.userIdForIndex ? input.userIdForIndex(index) : `load-user-${String(index + 1).padStart(3, '0')}`
    const perfect = index % perfectEvery === 0
    const picks = Object.fromEntries(fixtureIds.map(fixtureId => [
      fixtureId,
      perfect ? actualWinnerId : alternateWinnerId
    ]))
    const entryId = `${poolId}-${userId}`
    const submittedAt = addSeconds(startedAt, index)
    const lockedAt = addSeconds(startedAt, userCount + index)
    entries.push({ entryId, poolId, userId, picks, perfect })
    if (perfect) expectedWinnerUserIds.push(userId)
    commands.push({
      type: 'prediction:submit',
      actorId: userId,
      occurredAt: submittedAt,
      payload: {
        entryId,
        poolId,
        userId,
        entryType: 'bracket',
        picks,
        submittedAt
      }
    })
    commands.push({
      type: 'prediction:lock',
      actorId: 'load-sim',
      occurredAt: lockedAt,
      payload: {
        entryId,
        lockedAt
      }
    })
  }

  return {
    simulationId: input.simulationId || stableId(`load-sim-${poolId}`, {
      poolId,
      userCount,
      fixtureIds,
      actualWinnerId,
      perfectEvery
    }),
    poolId,
    userCount,
    fixtureIds: fixtureIds.slice(),
    entrantIds: entrantIds.slice(),
    entries,
    commands,
    results,
    expectedWinnerUserIds,
    expectedLockedCount: userCount
  }
}

function analyzePoolLoad ({ view = {}, poolId, thresholds = {} } = {}) {
  const entries = Object.values(view.predictionEntries || {}).filter(entry => !poolId || entry.poolId === poolId)
  const lockedEntries = entries.filter(entry => entry.status === 'locked')
  const settlement = poolId && view.poolSettlements ? view.poolSettlements[poolId] : null
  const entryWarningThreshold = thresholds.entryWarningThreshold || 100
  const level = entries.length >= entryWarningThreshold ? 'warning' : 'ok'
  return {
    kind: 'pool-load',
    poolId: poolId || null,
    level,
    ok: level === 'ok',
    entryCount: entries.length,
    lockedCount: lockedEntries.length,
    draftOrSubmittedCount: entries.length - lockedEntries.length,
    settlementReady: Boolean(settlement),
    winnerCount: settlement && settlement.winnerUserIds ? settlement.winnerUserIds.length : 0,
    leaderboardRows: settlement && settlement.leaderboard ? settlement.leaderboard.length : 0
  }
}

function analyzeRoomLoad ({ view = {}, roomId, thresholds = {} } = {}) {
  const participants = Object.values(view.roomParticipants && view.roomParticipants[roomId] || {})
  const activeParticipants = participants.filter(participant => participant.status !== 'left')
  const messages = Object.values(view.roomMessages || {}).filter(message => message.roomId === roomId)
  const challenges = Object.values(view.roomChallenges || {}).filter(challenge => challenge.roomId === roomId)
  const markets = Object.values(view.markets || {}).filter(market => market.roomId === roomId)
  const warnings = []
  const participantWarningThreshold = thresholds.participantWarningThreshold || 50
  const messageWarningThreshold = thresholds.messageWarningThreshold || 200
  const challengeWarningThreshold = thresholds.challengeWarningThreshold || 30
  if (activeParticipants.length > participantWarningThreshold) warnings.push('busy-room-participants')
  if (messages.length > messageWarningThreshold) warnings.push('busy-room-chat')
  if (challenges.length > challengeWarningThreshold) warnings.push('busy-room-challenges')
  const level = warnings.length > 0 ? 'warning' : 'ok'

  return {
    kind: 'room-load',
    roomId,
    level,
    ok: level === 'ok',
    warnings,
    participantCount: participants.length,
    activeParticipantCount: activeParticipants.length,
    messageCount: messages.length,
    challengeCount: challenges.length,
    marketCount: markets.length,
    readabilityScore: readabilityScore({
      activeParticipantCount: activeParticipants.length,
      messageCount: messages.length,
      challengeCount: challenges.length
    })
  }
}

function createPlatformLoadReport ({ view = {}, transportStatus = null, checkedAt = new Date().toISOString() } = {}) {
  const poolReports = Object.keys(view.pools || {}).map(poolId => analyzePoolLoad({ view, poolId }))
  const roomReports = Object.keys(view.rooms || {}).map(roomId => analyzeRoomLoad({ view, roomId }))
  const transportReport = transportStatus ? summarizeTransportStatus(transportStatus) : null
  const levels = poolReports.concat(roomReports, transportReport ? [transportReport] : []).map(report => report.level)
  const level = levels.includes('critical') ? 'critical' : levels.includes('warning') ? 'warning' : 'ok'

  return {
    reportId: stableId('platform-load-report', {
      eventRoot: view.eventRoot || null,
      poolReports,
      roomReports,
      transportLevel: transportReport && transportReport.level || null
    }),
    kind: 'platform-load',
    level,
    ok: level === 'ok',
    checkedAt,
    eventRoot: view.eventRoot || null,
    poolReports,
    roomReports,
    transportReport
  }
}

function normalizePeerStates (peers) {
  if (Array.isArray(peers)) return peers.map(normalizePeerState)
  return Object.entries(peers || {}).map(([peerId, state]) => normalizePeerState({ peerId, ...state }))
}

function normalizePeerState (peer) {
  return {
    peerId: peer.peerId,
    joined: peer.joined,
    runtimeRoot: peer.runtimeRoot || peer.root || null,
    root: peer.root || peer.runtimeRoot || null,
    eventCount: peer.eventCount,
    events: cloneJson(peer.events || []),
    eventIds: cloneJson(peer.eventIds || null)
  }
}

function readabilityScore ({ activeParticipantCount = 0, messageCount = 0, challengeCount = 0 } = {}) {
  const pressure = activeParticipantCount * 0.8 + messageCount * 0.1 + challengeCount * 1.5
  return Math.max(0, Math.round(100 - pressure))
}

function positiveInteger (value, fallback) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) return fallback
  return number
}

function addSeconds (isoDate, seconds) {
  const ms = Date.parse(isoDate)
  if (!Number.isFinite(ms)) return isoDate
  return new Date(ms + seconds * 1000).toISOString()
}

module.exports = {
  DIAGNOSTIC_LEVELS,
  createPeerSyncDiagnostic,
  summarizeTransportStatus,
  createBracketPoolLoadSimulation,
  analyzePoolLoad,
  analyzeRoomLoad,
  createPlatformLoadReport,
  readabilityScore
}
