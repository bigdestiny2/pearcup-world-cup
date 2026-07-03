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
  const options = cloneJson(input.options || marketOptionsFor(marketType))
  const predictionShape = input.predictionShape || predictionShapeForMarket(marketType)

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
    challengeId: input.challengeId || null,
    stake: cloneJson(input.stake || null),
    opensAt: input.opensAt || null,
    locksAt: input.locksAt || null,
    status: input.status || 'open',
    options,
    predictionShape,
    inputTemplate: cloneJson(input.inputTemplate || inputTemplateForMarket(marketType)),
    scoringConfig: cloneJson(input.scoringConfig || scoringConfigForMarket(marketType)),
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
    .map(prediction => scoreMarketPrediction({ market, prediction, result: resolvedResult }))
    .sort(marketRowSort)
  const winningScore = rows.length ? rows[0].score : 0
  const winnerRows = winningScore > 0 ? rows.filter(row => row.score === winningScore) : []

  return {
    market: {
      ...market,
      result: cloneJson(resolvedResult),
      resolvedAt,
      status: 'resolved'
    },
    rows,
    winnerUserIds: winnerRows.map(row => row.userId)
  }
}

function scoreMarketPrediction ({ market, prediction, result }) {
  if (market && market.marketType === 'scoreline-lock') {
    return scoreScorelineLockPrediction({ market, prediction, result })
  }
  if (market && market.marketType === 'player-prop') {
    return scorePlayerPropPrediction({ market, prediction, result })
  }
  if (market && market.marketType === 'momentum-duel') {
    return scoreMomentumDuelPrediction({ market, prediction, result })
  }
  const correct = outcomesEqual(prediction.outcome, result)
  return {
    predictionId: prediction.predictionId,
    userId: prediction.userId,
    marketId: market.marketId,
    picked: cloneJson(prediction.outcome),
    actual: cloneJson(result),
    correct,
    score: correct ? 1 : 0
  }
}

function scoreMomentumDuelPrediction ({ market, prediction, result }) {
  const picked = normalizeMomentumPrediction(prediction.outcome)
  const actual = actualForMomentumDuel({ result, scoringConfig: market.scoringConfig || {} })
  const correct = Boolean(picked && actual && picked.side === actual.side)
  const points = Number(market.scoringConfig && market.scoringConfig.points || 1)

  return {
    predictionId: prediction.predictionId,
    userId: prediction.userId,
    marketId: market.marketId,
    picked: cloneJson(prediction.outcome),
    actual: cloneJson(result),
    correct,
    score: correct ? points : 0,
    pickedSide: picked && picked.side || null,
    actualSide: actual && actual.side || null,
    windowMinutes: picked && picked.windowMinutes || actual && actual.windowMinutes || null,
    pressureDelta: actual && actual.pressureDelta,
    homePressure: actual && actual.homePressure,
    awayPressure: actual && actual.awayPressure
  }
}

function scorePlayerPropPrediction ({ market, prediction, result }) {
  const picked = normalizePlayerPropPrediction(prediction.outcome)
  const actual = actualForPlayerProp({ picked, result })
  const playerHit = Boolean(picked && actual && picked.playerId === actual.playerId)
  const valueHit = Boolean(playerHit && actual.value != null && playerPropValueMatches({
    prop: picked.prop,
    pickedValue: picked.value,
    actualValue: actual.value,
    scoringConfig: market.scoringConfig || {}
  }))
  const firstScorerPoints = Number(market.scoringConfig && market.scoringConfig.firstScorerPoints || 3)
  const statPropPoints = Number(market.scoringConfig && market.scoringConfig.statPropPoints || 2)
  const score = valueHit
    ? picked.prop === 'first-scorer' ? firstScorerPoints : statPropPoints
    : 0

  return {
    predictionId: prediction.predictionId,
    userId: prediction.userId,
    marketId: market.marketId,
    picked: cloneJson(prediction.outcome),
    actual: cloneJson(result),
    correct: score > 0,
    score,
    playerId: picked && picked.playerId || null,
    prop: picked && picked.prop || null,
    pickedValue: picked && cloneJson(picked.value),
    actualValue: actual && cloneJson(actual.value),
    playerHit,
    valueHit
  }
}

function scoreScorelineLockPrediction ({ market, prediction, result }) {
  const picked = normalizeScoreline(prediction.outcome)
  const actual = normalizeScoreline(result)
  const exact = Boolean(picked && actual && picked.homeScore === actual.homeScore && picked.awayScore === actual.awayScore)
  const pickedClass = picked ? scorelineResultClass(picked) : resultClassFromValue(prediction.outcome)
  const actualClass = actual ? scorelineResultClass(actual) : resultClassFromValue(result)
  const resultClassHit = Boolean(pickedClass && actualClass && pickedClass === actualClass)
  const exactPoints = Number(market.scoringConfig && market.scoringConfig.exactScorePoints || 3)
  const resultClassPoints = Number(market.scoringConfig && market.scoringConfig.resultClassPoints || 1)
  const score = exact ? exactPoints : resultClassHit ? resultClassPoints : 0

  return {
    predictionId: prediction.predictionId,
    userId: prediction.userId,
    marketId: market.marketId,
    picked: cloneJson(prediction.outcome),
    actual: cloneJson(result),
    correct: score > 0,
    score,
    exact,
    resultClassHit,
    pickedClass: pickedClass || null,
    actualClass: actualClass || null
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

function predictionShapeForMarket (marketType) {
  if (marketType === 'scoreline-lock') return 'exact-scoreline'
  if (marketType === 'player-prop') return 'player-prop'
  if (marketType === 'momentum-duel') return 'momentum-window'
  return 'single-choice'
}

function inputTemplateForMarket (marketType) {
  if (marketType === 'scoreline-lock') {
    return {
      homeScore: 0,
      awayScore: 0,
      lockBeforeMinute: 60
    }
  }
  if (marketType === 'player-prop') {
    return {
      playerId: null,
      prop: 'first-scorer',
      value: true
    }
  }
  if (marketType === 'momentum-duel') {
    return {
      side: 'home-pressure',
      windowMinutes: 10
    }
  }
  return null
}

function scoringConfigForMarket (marketType) {
  if (marketType === 'scoreline-lock') {
    return {
      exactScorePoints: 3,
      resultClassPoints: 1
    }
  }
  if (marketType === 'player-prop') {
    return {
      firstScorerPoints: 3,
      statPropPoints: 2,
      defaultStatTolerance: 0,
      propTolerances: {
        shots: 1,
        assists: 0,
        cards: 0
      }
    }
  }
  if (marketType === 'momentum-duel') {
    return {
      points: 1,
      windowMinutes: 10,
      balancedThreshold: 2
    }
  }
  return {}
}

function marketOptionsFor (marketType) {
  if (marketType === 'scoreline-lock') return ['home-win', 'draw', 'away-win']
  if (marketType === 'momentum-duel') return ['home-pressure', 'away-pressure', 'balanced']
  if (marketType === 'player-prop') return ['first-scorer', 'shots', 'assists', 'cards']
  if (marketType === 'watch-party-streak') return ['yes', 'no']
  return ['goal', 'corner', 'card', 'shot', 'save']
}

function normalizeMomentumPrediction (value) {
  if (typeof value === 'string') {
    const side = normalizeMomentumSide(value)
    return side
      ? {
          side,
          windowMinutes: null
        }
      : null
  }
  if (!value || typeof value !== 'object') return null
  const side = normalizeMomentumSide(value.side || value.pick || value.outcome || value.pressure)
  if (!side) return null
  return {
    side,
    windowMinutes: Number.isFinite(Number(value.windowMinutes)) ? Number(value.windowMinutes) : null
  }
}

function actualForMomentumDuel ({ result, scoringConfig = {} } = {}) {
  if (typeof result === 'string') {
    const side = normalizeMomentumSide(result)
    return side
      ? {
          side,
          windowMinutes: Number(scoringConfig.windowMinutes || 10),
          homePressure: null,
          awayPressure: null,
          pressureDelta: null
        }
      : null
  }
  if (!result || typeof result !== 'object') return null
  const explicitSide = normalizeMomentumSide(result.side || result.winner || result.pressureWinner || result.outcome)
  const homePressure = momentumPressureValue(result, ['homePressure', 'home', 'homeScore', 'homeXThreat', 'homePressureScore'])
  const awayPressure = momentumPressureValue(result, ['awayPressure', 'away', 'awayScore', 'awayXThreat', 'awayPressureScore'])
  const pressureDelta = homePressure != null && awayPressure != null ? homePressure - awayPressure : null
  const threshold = Number(scoringConfig.balancedThreshold == null ? 2 : scoringConfig.balancedThreshold)
  const side = explicitSide || sideFromPressureDelta({ pressureDelta, threshold })
  if (!side) return null
  return {
    side,
    windowMinutes: Number(result.windowMinutes || scoringConfig.windowMinutes || 10),
    homePressure,
    awayPressure,
    pressureDelta
  }
}

function momentumPressureValue (result, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(result, key)) return normalizePressureNumber(result[key])
  }
  if (result.pressure && typeof result.pressure === 'object') {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(result.pressure, key)) return normalizePressureNumber(result.pressure[key])
    }
  }
  return null
}

function normalizePressureNumber (value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function sideFromPressureDelta ({ pressureDelta, threshold }) {
  if (!Number.isFinite(Number(pressureDelta))) return null
  if (Math.abs(Number(pressureDelta)) <= threshold) return 'balanced'
  return Number(pressureDelta) > 0 ? 'home-pressure' : 'away-pressure'
}

function normalizeMomentumSide (value) {
  if (value === 'home' || value === 'home-pressure' || value === 'homePressure') return 'home-pressure'
  if (value === 'away' || value === 'away-pressure' || value === 'awayPressure') return 'away-pressure'
  if (value === 'draw' || value === 'tie' || value === 'balanced') return 'balanced'
  return null
}

function normalizePlayerPropPrediction (value) {
  if (!value || typeof value !== 'object') return null
  const prop = normalizePlayerProp(value.prop || value.market || value.stat || 'first-scorer')
  const playerId = value.playerId || value.athleteId || value.entrantId || null
  if (!playerId || !prop) return null
  return {
    playerId,
    prop,
    value: Object.prototype.hasOwnProperty.call(value, 'value')
      ? value.value
      : defaultPlayerPropValue(prop)
  }
}

function actualForPlayerProp ({ picked, result }) {
  if (!picked || !result || typeof result !== 'object') return null
  if (picked.prop === 'first-scorer') {
    const playerId = result.firstScorerId || result.firstScorer || result.playerId || null
    return playerId
      ? {
          playerId,
          prop: picked.prop,
          value: true
        }
      : null
  }
  const players = result.players || result.playerStats || result.statsByPlayerId || {}
  const stats = players[picked.playerId] || {}
  const value = Object.prototype.hasOwnProperty.call(stats, picked.prop)
    ? stats[picked.prop]
    : Object.prototype.hasOwnProperty.call(result, picked.prop)
        ? result[picked.prop]
        : null
  return {
    playerId: picked.playerId,
    prop: picked.prop,
    value
  }
}

function playerPropValueMatches ({ prop, pickedValue, actualValue, scoringConfig = {} }) {
  if (prop === 'first-scorer') return actualValue === true
  const pickedNumber = Number(pickedValue)
  const actualNumber = Number(actualValue)
  if (!Number.isFinite(pickedNumber) || !Number.isFinite(actualNumber)) return pickedValue === actualValue
  const tolerances = scoringConfig.propTolerances || {}
  const tolerance = Number(Object.prototype.hasOwnProperty.call(tolerances, prop)
    ? tolerances[prop]
    : scoringConfig.defaultStatTolerance || 0)
  return Math.abs(pickedNumber - actualNumber) <= tolerance
}

function normalizePlayerProp (prop) {
  if (prop === 'assist') return 'assists'
  if (prop === 'card') return 'cards'
  if (prop === 'firstScorer') return 'first-scorer'
  if (['first-scorer', 'shots', 'assists', 'cards'].includes(prop)) return prop
  return null
}

function defaultPlayerPropValue (prop) {
  if (prop === 'first-scorer') return true
  return 0
}

function normalizeScoreline (value) {
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && /^\d+\s*-\s*\d+$/.test(value)) {
      const [home, away] = value.split('-').map(part => Number(part.trim()))
      return { homeScore: home, awayScore: away }
    }
    return null
  }
  const homeScore = Number(value.homeScore ?? value.home ?? value.homeGoals)
  const awayScore = Number(value.awayScore ?? value.away ?? value.awayGoals)
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) return null
  return {
    homeScore,
    awayScore
  }
}

function scorelineResultClass (scoreline) {
  if (scoreline.homeScore > scoreline.awayScore) return 'home-win'
  if (scoreline.homeScore < scoreline.awayScore) return 'away-win'
  return 'draw'
}

function resultClassFromValue (value) {
  if (value === 'home-win' || value === 'draw' || value === 'away-win') return value
  const scoreline = normalizeScoreline(value)
  return scoreline ? scorelineResultClass(scoreline) : null
}

function marketRowSort (left, right) {
  if (right.score !== left.score) return right.score - left.score
  if (left.exact !== right.exact) return left.exact ? -1 : 1
  return String(left.userId || '').localeCompare(String(right.userId || ''))
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
  scoreMarketPrediction,
  scoreMomentumDuelPrediction,
  scorePlayerPropPrediction,
  scoreScorelineLockPrediction,
  outcomesEqual,
  predictionShapeForMarket,
  inputTemplateForMarket,
  scoringConfigForMarket,
  marketOptionsFor,
  normalizeMomentumPrediction,
  actualForMomentumDuel,
  momentumPressureValue,
  sideFromPressureDelta,
  normalizeMomentumSide,
  normalizePlayerPropPrediction,
  actualForPlayerProp,
  playerPropValueMatches,
  normalizePlayerProp,
  normalizeScoreline,
  scorelineResultClass,
  resultClassFromValue,
  streakRowForUser,
  streakRowSort
}
