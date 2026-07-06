'use strict'

const eventLog = require('./event-log')
const { assertAllowed, assertNonEmptyString, cloneJson, hash32, stableId, slugify } = require('./util')

const QVAC_LANES = Object.freeze([
  'commentary',
  'room-summary',
  'creator-assistant',
  'moderation-helper',
  'trivia-bank',
  'result-evidence'
])

const QVAC_RECORD_STATUSES = Object.freeze([
  'ready',
  'held',
  'rejected'
])

const MODERATION_SEVERITIES = Object.freeze([
  'none',
  'low',
  'medium',
  'high'
])

function createRoomSummary (input = {}) {
  const roomId = input.roomId || input.room && input.room.roomId
  assertNonEmptyString(roomId, 'roomId')
  const room = input.room || { roomId, title: roomId }
  const evidenceEvents = input.evidenceEvents || []
  const highlights = input.highlights || buildRoomHighlights(input)
  const createdAt = input.createdAt || new Date().toISOString()
  const body = {
    roomId,
    competitionId: room.competitionId || input.competitionId || null,
    highlightTexts: highlights.map(item => item.text),
    evidenceEventIds: evidenceEvents.map(event => event.eventId).filter(Boolean),
    feedFrameIds: (input.feedFrames || []).map(frame => frame.frameId).filter(Boolean),
    resultSnapshotIds: (input.resultSnapshots || []).map(snapshot => snapshot.snapshotId).filter(Boolean)
  }

  return qvacRecord({
    qvacRecordId: input.summaryId || input.qvacRecordId,
    prefix: `qvac-summary-${roomId}`,
    lane: 'room-summary',
    status: highlights.length > 0 ? 'ready' : 'held',
    targetType: 'room',
    targetId: roomId,
    title: input.title || `${room.title || roomId} summary`,
    text: highlights.length
      ? highlights.map(item => item.text).join(' ')
      : 'No replay evidence is available for this room yet.',
    body: {
      roomId,
      competitionId: body.competitionId,
      language: input.language || 'en',
      highlights,
      evidenceEventIds: body.evidenceEventIds,
      feedFrameIds: body.feedFrameIds,
      resultSnapshotIds: body.resultSnapshotIds,
      guardrails: {
        officialResultsInvented: false,
        resultClaimsRequireSnapshot: true
      }
    },
    evidenceEvents,
    createdAt
  })
}

function createCommentaryFrame (input = {}) {
  const feedFrame = input.feedFrame || input.frame || null
  const feedEvent = input.feedEvent || firstFeedEvent(feedFrame)
  const roomId = input.roomId || feedFrame && feedFrame.roomId || null
  const competitionId = input.competitionId || feedFrame && feedFrame.competitionId || null
  const createdAt = input.createdAt || feedFrame && feedFrame.createdAt || new Date().toISOString()
  if (!feedFrame && !feedEvent) throw new TypeError('feedFrame or feedEvent is required')

  const sourceFeedEventIds = feedEvent && feedEvent.eventId ? [feedEvent.eventId] : []
  const text = input.text || commentaryText({
    style: input.style || 'broadcast',
    feedFrame,
    feedEvent,
    language: input.language || 'en'
  })

  return qvacRecord({
    qvacRecordId: input.commentaryId || input.qvacRecordId,
    prefix: `qvac-commentary-${roomId || competitionId || 'feed'}`,
    lane: 'commentary',
    status: 'ready',
    targetType: feedFrame && feedFrame.frameId ? 'feed-frame' : 'feed-event',
    targetId: feedFrame && feedFrame.frameId || feedEvent && feedEvent.eventId,
    title: input.title || 'Live commentary',
    text,
    body: {
      roomId,
      competitionId,
      fixtureId: input.fixtureId || feedFrame && feedFrame.fixtureId || feedEvent && feedEvent.fixtureId || null,
      language: input.language || 'en',
      style: input.style || 'broadcast',
      feedFrameId: feedFrame && feedFrame.frameId || null,
      sourceFeedEventIds,
      clock: cloneJson(feedEvent && feedEvent.clock || feedFrame && feedFrame.clock || null),
      guardrails: {
        referencesFeedOnly: true,
        officialResultsInvented: false
      }
    },
    evidenceEvents: input.evidenceEvents || [],
    createdAt
  })
}

function createCreatorAssistantDraft (input = {}) {
  assertNonEmptyString(input.organizerId, 'organizerId')
  const intent = input.intent || 'create-event'
  const templateKind = input.templateKind || input.kind || 'creator-custom'
  const createdAt = input.createdAt || new Date().toISOString()
  const entrants = cloneJson(input.entrants || [])
  const poolVariants = cloneJson(input.poolVariants || input.variantIds || ['classic-bracket', 'confidence'])
  const miniGames = cloneJson(input.miniGames || input.miniGameTypes || ['trivia-duel'])
  const cardFields = cloneJson(input.cardFields || defaultCardFieldsForTemplate(templateKind))
  const sourceFacts = cloneJson(input.sourceFacts || [])
  const body = {
    organizerId: input.organizerId,
    intent,
    fitId: input.fitId || null,
    templateKind,
    title: input.title || defaultDraftTitle(templateKind),
    templateConfig: {
      kind: templateKind,
      sportOrCategory: input.sportOrCategory || categoryForTemplate(templateKind),
      entrantShape: input.entrantShape || entrantShapeForTemplate(templateKind),
      resultPolicy: input.resultPolicy || 'host-entered'
    },
    entrants,
    poolVariants,
    miniGames,
    cardFields,
    sourceFacts,
    checklist: creatorChecklist({ templateKind, poolVariants, miniGames }),
    guardrails: {
      officialResultsInvented: false,
      resultEntryRequiresHostReview: true
    }
  }

  return qvacRecord({
    qvacRecordId: input.assistantDraftId || input.qvacRecordId,
    prefix: `qvac-creator-${input.organizerId}`,
    lane: 'creator-assistant',
    status: 'ready',
    targetType: 'creator',
    targetId: input.organizerId,
    title: `Creator draft: ${body.title}`,
    text: `Drafted ${templateKind} with ${poolVariants.length} pool variants and ${miniGames.length} mini-games.`,
    body,
    evidenceEvents: input.evidenceEvents || [],
    createdAt
  })
}

function createTriviaQuestionBank (input = {}) {
  assertNonEmptyString(input.targetType || 'competition', 'targetType')
  assertNonEmptyString(input.targetId, 'targetId')
  const mode = input.mode || 'demo'
  const sourceFacts = cloneJson(input.sourceFacts || [])
  const questions = normalizeQuestions(input.questions || questionsFromFacts(sourceFacts))
  const verified = input.verified === true && questions.every(question => question.sourceFactId)
  const prizeMode = mode === 'sponsor-prize' || mode === 'real-money'
  const status = prizeMode && !verified ? 'held' : 'ready'
  const createdAt = input.createdAt || new Date().toISOString()

  return qvacRecord({
    qvacRecordId: input.questionBankId || input.qvacRecordId,
    prefix: `qvac-trivia-${input.targetType || 'competition'}-${input.targetId}`,
    lane: 'trivia-bank',
    status,
    targetType: input.targetType || 'competition',
    targetId: input.targetId,
    title: input.title || 'Trivia question bank',
    text: status === 'ready'
      ? `${questions.length} trivia questions are available.`
      : 'Trivia question bank needs verified source facts before prize mode.',
    body: {
      mode,
      verified,
      prizeEligible: verified,
      questions,
      sourceFacts,
      guardrails: {
        demoQuestionsMayBeGenerated: true,
        prizeQuestionsRequireVerifiedSourceFacts: true
      }
    },
    evidenceEvents: input.evidenceEvents || [],
    createdAt
  })
}

function createResultEvidenceReview (input = {}) {
  const targetType = input.targetType || 'fixture'
  const targetId = input.targetId || input.fixtureId || input.boutId || input.eventId
  assertNonEmptyString(targetType, 'targetType')
  assertNonEmptyString(targetId, 'targetId')
  const evidenceItems = normalizeResultEvidenceItems(input.evidenceItems || input.sources || [])
  const claimedWinner = input.claimedWinner || input.winner || null
  const expectedWinner = claimedWinner ? normalizeWinnerName(claimedWinner) : null
  const claims = evidenceItems
    .map(item => item.claimedWinnerNormalized)
    .filter(Boolean)
  const claimCounts = countValues(claims)
  const topClaim = Object.entries(claimCounts).sort((a, b) => b[1] - a[1])[0] || null
  const consensusWinner = topClaim ? topClaim[0] : null
  const corroboratingEvidence = evidenceItems.filter(item => item.claimedWinnerNormalized && item.claimedWinnerNormalized === consensusWinner)
  const trustedEvidence = corroboratingEvidence.filter(item => item.trustTier === 'official' || item.trustTier === 'verified-social' || item.trustTier === 'search-result')
  const minEvidenceCount = input.minEvidenceCount || 2
  const hasEnoughEvidence = corroboratingEvidence.length >= minEvidenceCount
  const hasTrustedEvidence = trustedEvidence.length > 0
  const expectedMatchesConsensus = !expectedWinner || expectedWinner === consensusWinner
  const hasConflict = Object.keys(claimCounts).length > 1
  const ready = Boolean(consensusWinner && hasEnoughEvidence && hasTrustedEvidence && expectedMatchesConsensus && !hasConflict)
  const status = ready ? 'ready' : 'held'
  const blockers = [
    !consensusWinner ? 'no winner claim found in evidence' : null,
    consensusWinner && !hasEnoughEvidence ? `needs ${minEvidenceCount} corroborating evidence items` : null,
    consensusWinner && !hasTrustedEvidence ? 'needs official, verified social, or web-search evidence' : null,
    !expectedMatchesConsensus ? 'claimed winner does not match evidence consensus' : null,
    hasConflict ? 'conflicting winner claims require manual review' : null
  ].filter(Boolean)
  const createdAt = input.createdAt || new Date().toISOString()

  return qvacRecord({
    qvacRecordId: input.reviewId || input.qvacRecordId,
    prefix: `qvac-result-${targetType}-${targetId}`,
    lane: 'result-evidence',
    status,
    targetType,
    targetId,
    title: input.title || 'Result evidence review',
    text: status === 'ready'
      ? `Result evidence consensus is ${displayWinner(consensusWinner)} from ${corroboratingEvidence.length} corroborating source${corroboratingEvidence.length === 1 ? '' : 's'}.`
      : `Result evidence is held: ${blockers.join('; ') || 'review required'}.`,
    body: {
      competitionId: input.competitionId || null,
      fixtureId: input.fixtureId || targetId,
      resultPolicy: input.resultPolicy || 'qvac-evidence-review',
      claimedWinner: claimedWinner || null,
      consensusWinner: consensusWinner ? displayWinner(consensusWinner) : null,
      consensusWinnerNormalized: consensusWinner,
      method: input.method || consensusField(corroboratingEvidence, 'method') || null,
      round: input.round || consensusField(corroboratingEvidence, 'round') || null,
      evidenceItems,
      sourceSummary: summarizeResultEvidence(evidenceItems),
      blockers,
      webSearchQuery: input.webSearchQuery || buildResultSearchQuery(input),
      guardrails: {
        officialResultsInvented: false,
        socialEvidenceRequiresCorroboration: true,
        webSearchEvidenceRequiresSourceUrl: true,
        prizeSettlementRequiresReadyReview: true
      }
    },
    evidenceEvents: input.evidenceEvents || [],
    createdAt
  })
}

function createModerationReview (input = {}) {
  const message = input.message || null
  const bodyText = input.body || message && message.body || ''
  assertNonEmptyString(bodyText, 'body')
  const targetType = input.targetType || (message && message.messageId ? 'room-message' : 'text')
  const targetId = input.targetId || message && message.messageId || stableId('moderation-text', bodyText)
  const labels = input.labels || moderationLabels(bodyText)
  const severity = input.severity || moderationSeverity(labels)
  assertAllowed(severity, MODERATION_SEVERITIES, 'moderation severity')
  const recommendedAction = input.recommendedAction || moderationAction(severity)
  const createdAt = input.createdAt || new Date().toISOString()

  return qvacRecord({
    qvacRecordId: input.reviewId || input.qvacRecordId,
    prefix: `qvac-moderation-${targetType}-${targetId}`,
    lane: 'moderation-helper',
    status: 'ready',
    targetType,
    targetId,
    title: 'Moderation review',
    text: labels.length
      ? `Review suggested for ${labels.join(', ')}.`
      : 'No moderation labels detected.',
    body: {
      roomId: input.roomId || message && message.roomId || null,
      userId: input.userId || message && message.userId || null,
      labels,
      severity,
      recommendedAction,
      evidence: {
        messageId: message && message.messageId || null,
        textHash: hash32(bodyText)
      }
    },
    evidenceEvents: input.evidenceEvents || [],
    createdAt
  })
}

function normalizeResultEvidenceItems (items = []) {
  return items.map((item, index) => {
    const sourceKind = item.sourceKind || item.kind || 'web-search'
    const trustTier = trustTierForEvidenceSource(sourceKind, item)
    return {
      evidenceId: item.evidenceId || stableId(`result-evidence-${index + 1}`, item),
      sourceKind,
      trustTier,
      sourceName: item.sourceName || item.publisher || null,
      sourceUrl: item.sourceUrl || item.url || null,
      capturedAt: item.capturedAt || item.seenAt || null,
      publishedAt: item.publishedAt || null,
      claimedWinner: item.claimedWinner || item.winner || null,
      claimedWinnerNormalized: normalizeWinnerName(item.claimedWinner || item.winner || ''),
      method: item.method || null,
      round: item.round || null,
      confidence: item.confidence == null ? null : Number(item.confidence),
      excerpt: item.excerpt || item.snippet || null,
      hasSourceUrl: Boolean(item.sourceUrl || item.url)
    }
  })
}

function trustTierForEvidenceSource (sourceKind, item = {}) {
  if (item.trustTier) return item.trustTier
  if (sourceKind === 'official-page' || sourceKind === 'official-api' || sourceKind === 'sanctioning-body') return 'official'
  if (sourceKind === 'verified-social' || item.verified === true) return 'verified-social'
  if (sourceKind === 'web-search' || sourceKind === 'news-search' || sourceKind === 'search-result') return 'search-result'
  return 'social'
}

function summarizeResultEvidence (items = []) {
  const summary = {
    total: items.length,
    official: 0,
    verifiedSocial: 0,
    searchResults: 0,
    social: 0,
    withUrls: 0
  }
  items.forEach(item => {
    if (item.trustTier === 'official') summary.official += 1
    else if (item.trustTier === 'verified-social') summary.verifiedSocial += 1
    else if (item.trustTier === 'search-result') summary.searchResults += 1
    else summary.social += 1
    if (item.hasSourceUrl) summary.withUrls += 1
  })
  return summary
}

function buildResultSearchQuery (input = {}) {
  const parts = [
    input.title || input.eventTitle || input.competitionId || 'fight card',
    input.fixtureTitle || input.boutTitle || input.fixtureId || input.targetId || '',
    'result winner method round'
  ].filter(Boolean)
  return parts.join(' ')
}

function consensusField (items = [], field) {
  const values = items.map(item => item[field]).filter(value => value != null && value !== '')
  const counts = countValues(values.map(value => String(value).toLowerCase()))
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ? values.find(value => String(value).toLowerCase() === top[0]) : null
}

function countValues (items = []) {
  return items.reduce((counts, item) => {
    counts[item] = (counts[item] || 0) + 1
    return counts
  }, {})
}

function normalizeWinnerName (value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function displayWinner (normalized) {
  return String(normalized || '')
    .split('-')
    .filter(Boolean)
    .map(part => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function verifyQvacRecord ({ record, evidenceEvents = [] } = {}) {
  if (!record || typeof record !== 'object') return { ok: false, errors: ['record is required'] }
  const errors = []
  if (!QVAC_LANES.includes(record.lane)) errors.push('unknown QVAC lane')
  if (!QVAC_RECORD_STATUSES.includes(record.status)) errors.push('unknown QVAC status')
  const expectedEvidenceHash = eventLog.evidenceHash(evidenceEvents)
  const expectedEventRoot = eventLog.eventRoot(evidenceEvents)
  if ((record.evidenceEventIds || []).length > 0 && record.evidenceHash !== expectedEvidenceHash) errors.push('evidenceHash mismatch')
  if ((record.evidenceEventIds || []).length > 0 && record.eventRoot !== expectedEventRoot) errors.push('eventRoot mismatch')
  return {
    ok: errors.length === 0,
    errors
  }
}

function qvacGate (record) {
  return {
    ok: Boolean(record && record.status === 'ready'),
    evidenceId: record && record.qvacRecordId || null,
    lane: record && record.lane || null,
    qvacHash: record && record.qvacHash || null
  }
}

function qvacRecord ({ qvacRecordId, prefix, lane, status, targetType, targetId, title, text, body, evidenceEvents, createdAt }) {
  assertAllowed(lane, QVAC_LANES, 'QVAC lane')
  assertAllowed(status, QVAC_RECORD_STATUSES, 'QVAC status')
  assertNonEmptyString(targetType, 'targetType')
  assertNonEmptyString(targetId, 'targetId')
  const evidenceEventIds = (evidenceEvents || []).map(event => event.eventId).filter(Boolean)
  const recordBody = cloneJson(body || {})
  const hashBody = {
    lane,
    status,
    targetType,
    targetId,
    title,
    text,
    body: recordBody,
    evidenceEventIds
  }
  return {
    qvacRecordId: qvacRecordId || stableId(prefix || `qvac-${lane}-${targetType}-${targetId}`, hashBody),
    lane,
    status,
    targetType,
    targetId,
    title,
    text,
    body: recordBody,
    evidenceEventIds,
    evidenceHash: eventLog.evidenceHash(evidenceEvents || []),
    eventRoot: eventLog.eventRoot(evidenceEvents || []),
    qvacHash: hash32(hashBody),
    createdAt
  }
}

function buildRoomHighlights (input = {}) {
  const highlights = []
  ;(input.feedFrames || []).forEach(frame => {
    ;(frame.events || []).forEach(event => {
      highlights.push({
        kind: 'feed-event',
        sourceId: event.eventId || frame.frameId,
        sourceFrameId: frame.frameId,
        text: `Feed ${event.type || frame.frameType} recorded${event.clock || frame.clock ? ` at ${formatClock(event.clock || frame.clock)}` : ''}.`
      })
    })
    if (frame.score) {
      highlights.push({
        kind: 'score',
        sourceId: frame.frameId,
        text: `Score frame recorded from ${frame.sourceId || frame.adapterId}.`
      })
    }
  })
  ;(input.resultSnapshots || []).forEach(snapshot => {
    highlights.push({
      kind: 'result-snapshot',
      sourceId: snapshot.snapshotId,
      text: `${snapshot.sourcePolicy || 'result'} snapshot recorded for ${snapshot.competitionId}.`
    })
  })
  ;(input.marketResolutions || []).forEach(resolution => {
    const market = resolution.market || {}
    highlights.push({
      kind: 'market-resolution',
      sourceId: market.marketId || resolution.marketId || resolution.streakId,
      text: `${market.marketType || 'Prediction'} resolved${resolution.result != null ? ` as ${String(resolution.result)}` : ''}.`
    })
  })
  ;(input.gameResolutions || []).forEach(result => {
    highlights.push({
      kind: 'game-resolution',
      sourceId: result.resultId || result.gameId,
      text: `${result.gameType || 'Game'} resolved for ${joinNames(result.winnerUserIds || [])}.`
    })
  })
  const activeChallenges = (input.challenges || []).filter(challenge => challenge.status === 'pending' || challenge.status === 'accepted')
  if (activeChallenges.length > 0) {
    highlights.push({
      kind: 'room-challenge',
      sourceId: activeChallenges[0].challengeId,
      text: `${activeChallenges.length} active room challenge${activeChallenges.length === 1 ? '' : 's'} in play.`
    })
  }
  const visibleMessages = (input.messages || []).filter(message => message.moderationState !== 'hidden')
  if (visibleMessages.length > 0) {
    highlights.push({
      kind: 'room-chat',
      sourceId: visibleMessages[visibleMessages.length - 1].messageId,
      text: `${visibleMessages.length} visible chat message${visibleMessages.length === 1 ? '' : 's'} in the room.`
    })
  }
  return highlights.slice(0, input.maxHighlights || 8)
}

function commentaryText ({ style, feedFrame, feedEvent }) {
  const type = feedEvent && feedEvent.type || feedFrame && feedFrame.frameType || 'update'
  const value = feedEvent && feedEvent.value ? ` ${valueSummary(feedEvent.value)}` : ''
  const clock = feedEvent && feedEvent.clock || feedFrame && feedFrame.clock
  const prefix = style === 'compact' ? 'Update' : 'Live update'
  return `${prefix}: ${type}${value}${clock ? ` at ${formatClock(clock)}` : ''}.`
}

function firstFeedEvent (feedFrame) {
  return feedFrame && Array.isArray(feedFrame.events) && feedFrame.events[0] || null
}

function valueSummary (value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  const parts = Object.entries(value)
    .slice(0, 3)
    .map(([key, item]) => `${key}:${String(item)}`)
  return parts.join(' ')
}

function formatClock (clock) {
  if (typeof clock === 'string') return clock
  if (!clock || typeof clock !== 'object') return 'live'
  if (clock.display) return clock.display
  if (clock.minute != null) return `${clock.minute}'`
  if (clock.period) return String(clock.period)
  return 'live'
}

function defaultDraftTitle (templateKind) {
  if (templateKind === 'awards-card') return 'Awards prediction night'
  if (templateKind === 'fight-card') return 'Fight card picks'
  if (templateKind === 'bingo-card') return 'Watch-party bingo'
  return 'Creator competition'
}

function categoryForTemplate (templateKind) {
  if (templateKind === 'awards-card') return 'awards'
  if (templateKind === 'fight-card') return 'combat-sports'
  return 'creator'
}

function entrantShapeForTemplate (templateKind) {
  if (templateKind === 'awards-card') return 'nominee'
  if (templateKind === 'fight-card') return 'player'
  if (templateKind === 'single-elimination') return 'creator'
  return 'custom'
}

function defaultCardFieldsForTemplate (templateKind) {
  if (templateKind === 'awards-card') {
    return [
      { fieldId: 'winner', fieldType: 'single-choice', label: 'Winner' },
      { fieldId: 'speech-length', fieldType: 'numeric-total', label: 'Speech length' }
    ]
  }
  if (templateKind === 'fight-card') {
    return [
      { fieldId: 'winner', fieldType: 'single-choice', label: 'Winner' },
      { fieldId: 'method', fieldType: 'single-choice', label: 'Method' },
      { fieldId: 'round', fieldType: 'numeric-total', label: 'Round' }
    ]
  }
  return [
    { fieldId: 'winner', fieldType: 'single-choice', label: 'Winner' },
    { fieldId: 'upset', fieldType: 'single-choice', label: 'Upset pick' }
  ]
}

function creatorChecklist ({ templateKind, poolVariants, miniGames }) {
  const checklist = [
    'name-event',
    'seed-entrants',
    'publish-rules',
    'open-invite'
  ]
  if (templateKind === 'awards-card' || poolVariants.includes('watch-party-bingo')) checklist.push('review-card-fields')
  if (miniGames.includes('trivia-duel')) checklist.push('verify-trivia-bank')
  checklist.push('assign-result-reviewer')
  return checklist
}

function questionsFromFacts (sourceFacts = []) {
  return sourceFacts.map((fact, index) => ({
    questionId: fact.questionId || stableId(`trivia-${fact.factId || index + 1}`, fact),
    prompt: fact.prompt || fact.question || `What happened in ${fact.label || fact.factId || `fact ${index + 1}`}?`,
    answer: fact.answer,
    sourceFactId: fact.factId || null,
    difficulty: fact.difficulty || 'demo'
  }))
}

function normalizeQuestions (questions = []) {
  return questions.map((question, index) => ({
    questionId: question.questionId || stableId(`trivia-question-${index + 1}`, question),
    prompt: question.prompt || question.question || `Question ${index + 1}`,
    answer: cloneJson(question.answer),
    choices: cloneJson(question.choices || []),
    sourceFactId: question.sourceFactId || question.factId || null,
    difficulty: question.difficulty || 'demo'
  }))
}

function moderationLabels (body) {
  const text = String(body || '').toLowerCase()
  const labels = []
  if (/https?:\/\//.test(text) || /\bwww\./.test(text)) labels.push('external-link')
  if (/\bfree money\b|\bguaranteed win\b|\bsend funds\b|\bwallet seed\b/.test(text)) labels.push('financial-risk')
  if (/\bidiot\b|\bstupid\b|\bshut up\b/.test(text)) labels.push('abuse')
  if ((String(body || '').match(/[A-Z]/g) || []).length >= 12 && String(body || '').toUpperCase() === String(body || '')) labels.push('excessive-caps')
  if (/(.)\1{8,}/.test(text)) labels.push('repeated-content')
  return [...new Set(labels)]
}

function moderationSeverity (labels) {
  if (labels.includes('financial-risk') || labels.includes('abuse')) return 'high'
  if (labels.includes('external-link') || labels.includes('excessive-caps')) return 'medium'
  if (labels.includes('repeated-content')) return 'low'
  return 'none'
}

function moderationAction (severity) {
  if (severity === 'high') return 'hide-message'
  if (severity === 'medium') return 'review'
  return 'allow'
}

function joinNames (items = []) {
  if (!items.length) return 'no winner'
  return items.join(', ')
}

module.exports = {
  QVAC_LANES,
  QVAC_RECORD_STATUSES,
  MODERATION_SEVERITIES,
  createRoomSummary,
  createCommentaryFrame,
  createCreatorAssistantDraft,
  createTriviaQuestionBank,
  createResultEvidenceReview,
  createModerationReview,
  verifyQvacRecord,
  qvacGate,
  buildRoomHighlights
}
