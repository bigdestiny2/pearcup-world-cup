'use strict'

const { SETTLEMENT_MODES } = require('./constants')
const { assertNonEmptyString, assertAllowed, cloneJson, hash32, stableId } = require('./util')

const MARKET_TYPES = Object.freeze([
  'next-event',
  'scoreline-lock',
  'momentum-duel',
  'player-prop',
  'watch-party-streak'
])

function createPredictionMarket (input = {}) {
  assertNonEmptyString(input.roomId, 'roomId')
  assertNonEmptyString(input.competitionId, 'competitionId')
  const marketType = input.marketType || 'next-event'
  assertAllowed(marketType, MARKET_TYPES, 'market type')
  const mode = input.mode || input.settlementMode || 'demo'
  assertAllowed(mode, SETTLEMENT_MODES, 'settlement mode')
  const options = cloneJson(input.options || [])

  return {
    marketId: input.marketId || stableId(`market-${marketType}`, {
      roomId: input.roomId,
      competitionId: input.competitionId,
      fixtureId: input.fixtureId || null,
      lockAt: input.lockAt || null,
      options
    }),
    marketType,
    roomId: input.roomId,
    competitionId: input.competitionId,
    fixtureId: input.fixtureId || null,
    mode,
    gates: cloneJson(input.gates || {}),
    opensAt: input.opensAt || null,
    locksAt: input.locksAt || null,
    status: input.status || 'open',
    options,
    result: cloneJson(input.result || null)
  }
}

function submitWatchPrediction ({ market, userId, outcome, submittedAt = new Date().toISOString() } = {}) {
  if (!market || typeof market !== 'object') throw new TypeError('market is required')
  assertNonEmptyString(userId, 'userId')
  if (market.status !== 'open') throw new Error(`cannot submit to market with status ${market.status}`)
  if (market.locksAt && submittedAt > market.locksAt) throw new Error('prediction submitted after market lock')

  return {
    predictionId: stableId(`watch-prediction-${market.marketId}-${userId}`, {
      marketId: market.marketId,
      userId,
      outcome,
      submittedAt
    }),
    marketId: market.marketId,
    roomId: market.roomId,
    userId,
    outcome: cloneJson(outcome),
    submittedAt,
    status: 'submitted'
  }
}

function lockPredictionMarket (market, lockedAt = new Date().toISOString()) {
  if (!market || typeof market !== 'object') throw new TypeError('market is required')
  return {
    ...market,
    lockedAt,
    status: 'locked'
  }
}

function resolvePredictionMarket ({ market, predictions = [], result, resolvedAt = new Date().toISOString() } = {}) {
  if (!market || typeof market !== 'object') throw new TypeError('market is required')
  const resolvedResult = result == null ? market.result : result
  const rows = predictions
    .filter(prediction => prediction && prediction.marketId === market.marketId)
    .map(prediction => {
      const correct = outcomesEqual(prediction.outcome, resolvedResult)
      return {
        predictionId: prediction.predictionId,
        userId: prediction.userId,
        marketId: market.marketId,
        picked: cloneJson(prediction.outcome),
        actual: cloneJson(resolvedResult),
        correct,
        score: correct ? 1 : 0
      }
    })

  return {
    market: {
      ...market,
      result: cloneJson(resolvedResult),
      resolvedAt,
      status: 'resolved'
    },
    rows,
    winnerUserIds: rows.filter(row => row.correct).map(row => row.userId)
  }
}

function resolveWatchPredictionStreak ({
  roomId = null,
  marketResolutions = [],
  userIds = [],
  streakId = null,
  resolvedAt = new Date().toISOString()
} = {}) {
  const ordered = marketResolutions
    .filter(resolution => resolution && resolution.market)
    .filter(resolution => !roomId || resolution.market.roomId === roomId)
    .slice()
    .sort(marketResolutionSort)
  const users = userIds.length
    ? userIds.slice()
    : [...new Set(ordered.flatMap(resolution => (resolution.rows || []).map(row => row.userId).filter(Boolean)))]

  const rows = users.map(userId => streakRowForUser({ userId, marketResolutions: ordered }))
    .sort(streakRowSort)
  const top = rows[0] || null
  const winnerRows = top
    ? rows.filter(row => row.longestStreak === top.longestStreak && row.correctCount === top.correctCount)
    : []
  const body = {
    roomId,
    marketIds: ordered.map(resolution => resolution.market.marketId),
    rows,
    winnerUserIds: winnerRows.map(row => row.userId)
  }

  return {
    streakId: streakId || stableId(`watch-streak-${roomId || 'all'}`, body),
    roomId,
    marketIds: body.marketIds,
    rows,
    winnerUserIds: body.winnerUserIds,
    winningStreak: top ? top.longestStreak : 0,
    winningCorrectCount: top ? top.correctCount : 0,
    tied: winnerRows.length > 1,
    resultHash: hash32(body),
    resolvedAt
  }
}

function outcomesEqual (left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function marketOptionsFor (marketType) {
  if (marketType === 'scoreline-lock') return ['home-win', 'draw', 'away-win']
  if (marketType === 'momentum-duel') return ['home-pressure', 'away-pressure', 'balanced']
  if (marketType === 'player-prop') return ['first-scorer', 'assist', 'card']
  if (marketType === 'watch-party-streak') return ['yes', 'no']
  return ['goal', 'corner', 'card', 'shot', 'save']
}

function marketResolutionSort (left, right) {
  const leftAt = left.market.resolvedAt || left.market.lockedAt || left.market.locksAt || ''
  const rightAt = right.market.resolvedAt || right.market.lockedAt || right.market.locksAt || ''
  if (leftAt !== rightAt) return leftAt.localeCompare(rightAt)
  return left.market.marketId.localeCompare(right.market.marketId)
}

function streakRowForUser ({ userId, marketResolutions }) {
  let currentStreak = 0
  let longestStreak = 0
  let correctCount = 0
  const timeline = marketResolutions.map(resolution => {
    const row = (resolution.rows || []).find(item => item.userId === userId)
    const correct = Boolean(row && row.correct)
    if (correct) {
      currentStreak += 1
      correctCount += 1
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
    return {
      marketId: resolution.market.marketId,
      correct,
      score: row ? row.score : 0,
      picked: row ? cloneJson(row.picked) : null,
      actual: row ? cloneJson(row.actual) : cloneJson(resolution.market.result)
    }
  })

  return {
    userId,
    score: longestStreak,
    longestStreak,
    currentStreak,
    correctCount,
    marketCount: marketResolutions.length,
    timeline
  }
}

function streakRowSort (left, right) {
  if (right.longestStreak !== left.longestStreak) return right.longestStreak - left.longestStreak
  if (right.correctCount !== left.correctCount) return right.correctCount - left.correctCount
  return String(left.userId || '').localeCompare(String(right.userId || ''))
}

module.exports = {
  MARKET_TYPES,
  createPredictionMarket,
  submitWatchPrediction,
  lockPredictionMarket,
  resolvePredictionMarket,
  resolveWatchPredictionStreak,
  outcomesEqual,
  marketOptionsFor,
  streakRowForUser,
  streakRowSort
}
