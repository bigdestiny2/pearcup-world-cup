'use strict'

const catalog = require('./catalog-engine')
const eventLog = require('./event-log')
const { assertAllowed, assertNonEmptyString, cloneJson, hash32, stableId, slugify } = require('./util')

const SHARE_CARD_TYPES = Object.freeze([
  'pool-win',
  'game-win',
  'streak',
  'bracket',
  'duel',
  'reward',
  'room-highlight'
])

const REMATCH_STATUSES = Object.freeze([
  'proposed',
  'accepted',
  'declined',
  'expired',
  'materialized'
])

const CALENDAR_ITEM_TYPES = Object.freeze([
  'major-event',
  'creator-template',
  'local-league',
  'awards-night',
  'arcade-night'
])

function createSpectatorReplay (input = {}) {
  const session = input.session || input.game || null
  const resolution = input.resolution || input.result || null
  if (!session || typeof session !== 'object') throw new TypeError('session is required')
  assertNonEmptyString(session.gameId, 'gameId')
  const commitments = cloneJson(input.commitments || [])
  const reveals = cloneJson(input.reveals || [])
  const evidenceEvents = input.evidenceEvents || []
  const createdAt = input.createdAt || new Date().toISOString()
  const steps = replaySteps({ commitments, reveals, resolution })
  const body = {
    gameId: session.gameId,
    gameType: session.gameType,
    roomId: session.roomId || null,
    players: cloneJson(session.players || []),
    spectators: cloneJson(input.spectators || session.spectators || []),
    stakeMode: session.stakeMode || 'none',
    resolverVersion: session.resolverVersion || null,
    resultId: resolution && resolution.resultId || null,
    resultHash: resolution && resolution.resultHash || null,
    winnerUserIds: cloneJson(resolution && resolution.winnerUserIds || []),
    steps,
    evidenceEventIds: evidenceEvents.map(event => event.eventId).filter(Boolean),
    evidenceHash: eventLog.evidenceHash(evidenceEvents),
    eventRoot: eventLog.eventRoot(evidenceEvents)
  }

  return {
    replayId: input.replayId || stableId(`spectator-replay-${session.gameId}`, body),
    status: resolution ? 'ready' : 'held',
    ...body,
    replayHash: hash32(body),
    createdAt
  }
}

function createDemoLadderSnapshot (input = {}) {
  const sessionsById = input.sessionsById || indexBy(input.sessions || [], 'gameId')
  const gameType = input.gameType || null
  const scope = input.scope || 'global'
  const createdAt = input.createdAt || new Date().toISOString()
  const results = (input.gameResolutions || input.results || [])
    .filter(result => result && result.gameId)
    .filter(result => !gameType || result.gameType === gameType)
    .filter(result => {
      const session = sessionsById[result.gameId] || {}
      return input.includePrizeModes === true || !session.stakeMode || session.stakeMode === 'none' || session.stakeMode === 'demo'
    })
    .sort((left, right) => String(left.resolvedAt || '').localeCompare(String(right.resolvedAt || '')) || String(left.gameId).localeCompare(String(right.gameId)))
  const rowsByUser = new Map()

  results.forEach(result => {
    const session = sessionsById[result.gameId] || {}
    const players = [...new Set([...(session.players || []), ...(result.rows || []).map(row => row.userId).filter(Boolean)])]
    const winners = new Set(result.winnerUserIds || [])
    const tied = result.tied === true
    players.forEach(userId => {
      const row = rowsByUser.get(userId) || emptyLadderRow(userId)
      row.played += 1
      row.gameTypes.add(result.gameType)
      if (tied) {
        row.ties += 1
        row.rating += 5
      } else if (winners.has(userId)) {
        row.wins += 1
        row.rating += 25
      } else {
        row.losses += 1
        row.rating = Math.max(0, row.rating - 10)
      }
      row.points += scoreForUser(result, userId)
      row.lastGameId = result.gameId
      row.lastPlayedAt = result.resolvedAt || null
      rowsByUser.set(userId, row)
    })
  })

  const leaderboard = [...rowsByUser.values()]
    .map(row => ({
      userId: row.userId,
      rating: row.rating,
      played: row.played,
      wins: row.wins,
      losses: row.losses,
      ties: row.ties,
      points: row.points,
      winRate: row.played ? Number((row.wins / row.played).toFixed(4)) : 0,
      gameTypes: [...row.gameTypes].filter(Boolean).sort(),
      lastGameId: row.lastGameId,
      lastPlayedAt: row.lastPlayedAt
    }))
    .sort((left, right) => right.rating - left.rating || right.wins - left.wins || left.userId.localeCompare(right.userId))
    .map((row, index) => ({
      rank: index + 1,
      ...row
    }))
  const body = {
    scope,
    gameType,
    resultIds: results.map(result => result.resultId || result.gameId),
    leaderboard
  }

  return {
    ladderId: input.ladderId || stableId(`demo-ladder-${scope}-${gameType || 'all'}`, body),
    scope,
    gameType,
    resultCount: results.length,
    leaderboard,
    ladderHash: hash32(body),
    createdAt
  }
}

function createRematchProposal (input = {}) {
  const sourceGame = input.sourceGame || input.session || null
  if (!sourceGame || typeof sourceGame !== 'object') throw new TypeError('sourceGame is required')
  assertNonEmptyString(sourceGame.gameId, 'sourceGame.gameId')
  const status = input.status || 'proposed'
  assertAllowed(status, REMATCH_STATUSES, 'rematch status')
  const requestedByUserId = input.requestedByUserId || input.actorId || sourceGame.players && sourceGame.players[0]
  assertNonEmptyString(requestedByUserId, 'requestedByUserId')
  const players = cloneJson(input.players || sourceGame.players || [])
  const targetUserIds = cloneJson(input.targetUserIds || players.filter(userId => userId !== requestedByUserId))
  const gameType = input.gameType || sourceGame.gameType
  const roomId = input.roomId || sourceGame.roomId || null
  const createdAt = input.createdAt || new Date().toISOString()
  const body = {
    sourceGameId: sourceGame.gameId,
    sourceResultId: input.sourceResult && input.sourceResult.resultId || input.sourceResultId || null,
    requestedByUserId,
    targetUserIds,
    players,
    gameType,
    roomId,
    stakeMode: input.stakeMode || sourceGame.stakeMode || 'demo'
  }

  return {
    rematchId: input.rematchId || stableId(`rematch-${sourceGame.gameId}`, body),
    status,
    ...body,
    commandDraft: roomId
      ? {
          type: 'room:challenge',
          actorId: requestedByUserId,
          payload: {
            roomId,
            challengerUserId: requestedByUserId,
            targetUserId: targetUserIds[0] || players.find(userId => userId !== requestedByUserId) || requestedByUserId,
            challengeType: 'peer-game',
            gameType,
            sideQuest: null
          }
        }
      : null,
    rematchHash: hash32(body),
    createdAt
  }
}

function createShareCard (input = {}) {
  const shareType = input.shareType || inferShareType(input)
  assertAllowed(shareType, SHARE_CARD_TYPES, 'share card type')
  const targetType = input.targetType || shareType.replace(/-.+$/, '')
  const targetId = input.targetId || targetIdFromSubject(input.subject)
  assertNonEmptyString(targetType, 'targetType')
  assertNonEmptyString(targetId, 'targetId')
  const userId = input.userId || primaryUserIdForShare(input)
  const subject = cloneJson(input.subject || {})
  const createdAt = input.createdAt || new Date().toISOString()
  const body = {
    shareType,
    targetType,
    targetId,
    userId,
    headline: input.headline || shareHeadline({ shareType, subject, userId }),
    body: input.body || shareBody({ shareType, subject, userId }),
    metrics: cloneJson(input.metrics || shareMetrics({ shareType, subject, userId })),
    channels: cloneJson(input.channels || ['in-app', 'share-card']),
    cta: input.cta || defaultShareCta(shareType),
    privacy: cloneJson(input.privacy || {
      includePrizeAmount: false,
      includeRawPicks: false,
      includePayoutRoute: false
    })
  }

  return {
    shareCardId: input.shareCardId || stableId(`share-card-${shareType}-${targetId}`, body),
    status: input.status || 'ready',
    ...body,
    shareHash: hash32(body),
    createdAt
  }
}

function createCreatorTemplateGallery (input = {}) {
  const createdAt = input.createdAt || new Date().toISOString()
  const eventFits = input.eventFits || catalog.listEventFits({})
  const templates = eventFits
    .filter(fit => ['creator', 'local', 'awards', 'combat-sports'].includes(fit.category) || fit.resultPolicy === 'host-entered')
    .map(fit => templateFromFit(fit))
  const body = {
    templates,
    featuredTemplateIds: cloneJson(input.featuredTemplateIds || templates.slice(0, 4).map(item => item.templateCardId)),
    filters: {
      categories: [...new Set(templates.map(item => item.category))].sort(),
      settlementModes: ['demo', 'sponsor-prize']
    }
  }

  return {
    galleryId: input.galleryId || stableId('creator-template-gallery', body),
    title: input.title || 'Creator templates gallery',
    ...body,
    galleryHash: hash32(body),
    createdAt
  }
}

function createContentCalendar (input = {}) {
  const startDate = input.startDate || '2026-07-03'
  const weeks = Math.max(1, Number(input.weeks || 8))
  const eventFits = input.eventFits || calendarFitOrder(catalog.listEventFits({}))
  const createdAt = input.createdAt || new Date().toISOString()
  const items = []

  for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
    const date = addDays(startDate, weekIndex * 7)
    const fit = eventFits[weekIndex % eventFits.length]
    const itemType = calendarTypeForFit(fit)
    items.push({
      calendarItemId: stableId(`calendar-${date}-${fit.fitId}`, { date, fitId: fit.fitId, itemType }),
      itemType,
      fitId: fit.fitId,
      title: itemTitleForFit(fit, weekIndex),
      category: fit.category,
      startsOn: date,
      templateKind: fit.templateKinds[0],
      recommendedVariants: cloneJson(fit.recommendedVariants.slice(0, 3)),
      recommendedMiniGames: cloneJson(fit.recommendedMiniGames.slice(0, 2)),
      defaultSettlementModes: cloneJson(fit.defaultSettlementModes)
    })
  }

  const body = {
    startDate,
    weeks,
    items
  }

  return {
    calendarId: input.calendarId || stableId(`content-calendar-${startDate}`, body),
    title: input.title || 'Year-round content calendar',
    ...body,
    calendarHash: hash32(body),
    createdAt
  }
}

function replaySteps ({ commitments = [], reveals = [], resolution = null }) {
  const steps = []
  commitments.forEach(commitment => {
    steps.push({
      stepType: 'commit',
      playerId: commitment.playerId,
      roundId: commitment.roundId,
      commitmentId: commitment.commitmentId,
      commitmentHash: commitment.commitmentHash
    })
  })
  reveals.forEach(reveal => {
    steps.push({
      stepType: 'reveal',
      playerId: reveal.playerId,
      roundId: reveal.roundId,
      revealId: reveal.revealId,
      input: cloneJson(reveal.input || {}),
      commitmentId: reveal.commitmentId || null
    })
  })
  if (resolution) {
    steps.push({
      stepType: 'result',
      resultId: resolution.resultId,
      resultHash: resolution.resultHash,
      winnerUserIds: cloneJson(resolution.winnerUserIds || []),
      rows: cloneJson(resolution.rows || [])
    })
  }
  return steps
}

function emptyLadderRow (userId) {
  return {
    userId,
    rating: 1000,
    played: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    points: 0,
    gameTypes: new Set(),
    lastGameId: null,
    lastPlayedAt: null
  }
}

function scoreForUser (result, userId) {
  const row = (result.rows || []).find(row => row.userId === userId)
  return Number(row && row.score || 0)
}

function indexBy (items = [], key) {
  return Object.fromEntries(items.filter(Boolean).map(item => [item[key], item]))
}

function inferShareType (input = {}) {
  if (input.subject && input.subject.winnerUserIds && input.subject.gameId) return 'game-win'
  if (input.subject && input.subject.winnerUserIds && input.subject.poolId) return 'pool-win'
  if (input.subject && input.subject.streakId) return 'streak'
  return 'room-highlight'
}

function targetIdFromSubject (subject = {}) {
  return subject.poolId || subject.gameId || subject.streakId || subject.receiptId || subject.roomId || subject.resultId || subject.id || 'target'
}

function primaryUserIdForShare (input = {}) {
  if (input.userId) return input.userId
  const subject = input.subject || {}
  if (Array.isArray(subject.winnerUserIds) && subject.winnerUserIds.length) return subject.winnerUserIds[0]
  if (Array.isArray(subject.players) && subject.players.length) return subject.players[0]
  return null
}

function shareHeadline ({ shareType, subject, userId }) {
  if (shareType === 'game-win') return `${userId || 'A player'} won ${subject.gameType || 'a duel'}`
  if (shareType === 'pool-win') return `${userId || 'A player'} topped ${subject.poolId || 'the pool'}`
  if (shareType === 'streak') return `${userId || 'A player'} built a live prediction streak`
  if (shareType === 'bracket') return 'Bracket picks are locked'
  if (shareType === 'duel') return 'Duel result is in'
  if (shareType === 'reward') return 'Reward granted'
  return 'Watch-room highlight'
}

function shareBody ({ shareType, subject, userId }) {
  if (shareType === 'game-win') return `${userId || 'Winner'} beat the field with ${winningScore(subject, userId)} points.`
  if (shareType === 'pool-win') return `${(subject.winnerUserIds || []).join(', ') || userId || 'Winner'} finished on top.`
  if (shareType === 'streak') return `${(subject.winnerUserIds || []).join(', ') || userId || 'Winner'} kept the streak alive.`
  return subject.title || subject.text || 'Replayable result available.'
}

function shareMetrics ({ shareType, subject, userId }) {
  if (shareType === 'game-win') {
    return {
      gameType: subject.gameType || null,
      winnerUserIds: cloneJson(subject.winnerUserIds || []),
      winningScore: winningScore(subject, userId),
      tied: subject.tied === true
    }
  }
  if (shareType === 'pool-win') {
    return {
      winnerUserIds: cloneJson(subject.winnerUserIds || []),
      winningScore: subject.winningScore || 0,
      tied: subject.tied === true
    }
  }
  if (shareType === 'streak') {
    return {
      winnerUserIds: cloneJson(subject.winnerUserIds || []),
      streakLength: subject.streakLength || subject.marketResolutions && subject.marketResolutions.length || 0
    }
  }
  return {}
}

function winningScore (subject = {}, userId = null) {
  const row = (subject.rows || []).find(row => !userId || row.userId === userId) || (subject.rows || [])[0]
  return Number(row && row.score || subject.winningScore || 0)
}

function defaultShareCta (shareType) {
  if (shareType === 'pool-win' || shareType === 'bracket') return 'Join the next pool'
  if (shareType === 'game-win' || shareType === 'duel') return 'Request a rematch'
  if (shareType === 'streak') return 'Beat the streak'
  return 'Open watch room'
}

function templateFromFit (fit) {
  return {
    templateCardId: stableId(`template-card-${fit.fitId}`, fit),
    fitId: fit.fitId,
    title: fit.title,
    category: fit.category,
    templateKind: fit.templateKinds[0],
    entrantShape: fit.entrantShape,
    resultPolicy: fit.resultPolicy,
    recommendedVariants: cloneJson(fit.recommendedVariants.slice(0, 4)),
    recommendedMiniGames: cloneJson(fit.recommendedMiniGames.slice(0, 3)),
    defaultSettlementModes: cloneJson(fit.defaultSettlementModes),
    checklist: templateChecklistForFit(fit)
  }
}

function templateChecklistForFit (fit) {
  const checklist = ['pick-template', 'add-entrants', 'publish-rules', 'invite-players']
  if (fit.resultPolicy === 'host-entered') checklist.push('assign-result-reviewer')
  if (fit.recommendedVariants.includes('watch-party-bingo')) checklist.push('review-bingo-card')
  if (fit.recommendedMiniGames.includes('trivia-duel')) checklist.push('prepare-trivia-bank')
  return checklist
}

function calendarTypeForFit (fit) {
  if (fit.category === 'creator') return 'creator-template'
  if (fit.category === 'local') return 'local-league'
  if (fit.category === 'awards') return 'awards-night'
  if ((fit.recommendedMiniGames || []).length > 2) return 'arcade-night'
  return 'major-event'
}

function calendarFitOrder (eventFits = []) {
  const byId = new Map(eventFits.map(fit => [fit.fitId, fit]))
  const preferred = [
    'world-cup',
    'local-leagues',
    'awards-prediction-pools',
    'creator-reality-brackets',
    'march-madness',
    'esports-major',
    'mma-boxing-fight-card',
    'pro-playoffs',
    'champions-league-knockout',
    'tennis-grand-slams',
    'euros-copa-america'
  ]
  const ordered = preferred.map(fitId => byId.get(fitId)).filter(Boolean)
  const seen = new Set(ordered.map(fit => fit.fitId))
  eventFits.forEach(fit => {
    if (!seen.has(fit.fitId)) ordered.push(fit)
  })
  return ordered
}

function itemTitleForFit (fit, weekIndex) {
  if (fit.category === 'creator' || fit.category === 'local') return `${fit.title} weekly`
  if (fit.category === 'awards') return `${fit.title} prediction night`
  return weekIndex === 0 ? `${fit.title} launch week` : `${fit.title} feature week`
}

function addDays (dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

module.exports = {
  SHARE_CARD_TYPES,
  REMATCH_STATUSES,
  CALENDAR_ITEM_TYPES,
  createSpectatorReplay,
  createDemoLadderSnapshot,
  createRematchProposal,
  createShareCard,
  createCreatorTemplateGallery,
  createContentCalendar,
  calendarFitOrder
}
