'use strict'

const { assertNonEmptyString, cloneJson, hash32, stableId } = require('./util')

const MINI_GAME_RESOLVERS = Object.freeze([
  'penalty-clash',
  'free-kick-duel',
  'trivia-duel',
  'reaction-challenge'
])

function resolveMiniGame ({ session, reveals = [], result = {}, resolvedAt = new Date().toISOString() } = {}) {
  if (!session || typeof session !== 'object') throw new TypeError('session is required')
  assertNonEmptyString(session.gameId, 'gameId')
  assertNonEmptyString(session.gameType, 'gameType')
  const rows = rowsForGameType({ session, reveals, result })
  const ranked = rankRows(rows, session.gameType)
  const topScore = ranked.length ? ranked[0].score : 0
  const topTieBreak = ranked.length ? ranked[0].tieBreak : null
  const winners = ranked.filter(row => {
    if (row.score !== topScore) return false
    if (topTieBreak == null) return true
    return row.tieBreak === topTieBreak
  })
  const body = {
    gameId: session.gameId,
    gameType: session.gameType,
    resolverVersion: session.resolverVersion || `${session.gameType}-v1`,
    rows: ranked,
    winnerUserIds: winners.map(row => row.userId),
    tied: winners.length !== 1,
    result: cloneJson(result)
  }

  return {
    resultId: stableId(`game-result-${session.gameId}`, body),
    gameId: session.gameId,
    gameType: session.gameType,
    resolverVersion: body.resolverVersion,
    status: 'resolved',
    rows: ranked,
    winnerUserIds: body.winnerUserIds,
    tied: body.tied,
    result: cloneJson(result),
    resultHash: hash32(body),
    resolvedAt
  }
}

function rowsForGameType ({ session, reveals, result }) {
  if (session.gameType === 'penalty-clash') return resolvePenaltyClash({ session, reveals, result })
  if (session.gameType === 'free-kick-duel') return resolveFreeKickDuel({ session, reveals, result })
  if (session.gameType === 'trivia-duel') return resolveTriviaDuel({ session, reveals, result })
  if (session.gameType === 'reaction-challenge') return resolveReactionChallenge({ session, reveals, result })
  return resolveScoreOnlyGame({ session, reveals })
}

function resolvePenaltyClash ({ session, reveals, result }) {
  const inputs = inputByPlayer(reveals)
  const players = playersFor(session, inputs)
  const roundCount = Number(result.roundCount || maxInputLength(inputs, ['shots', 'penalties', 'rounds']) || 5)

  return players.map((playerId, index) => {
    const opponentId = players[(index + 1) % players.length]
    const playerRounds = roundInputs(inputs[playerId], ['shots', 'penalties', 'rounds'], roundCount)
    const opponentRounds = roundInputs(inputs[opponentId], ['shots', 'penalties', 'rounds'], roundCount)
    const detail = playerRounds.map((round, roundIndex) => {
      const opponent = opponentRounds[roundIndex] || {}
      const shot = round.shot || round.aim || round.target || 'center'
      const keeperRead = opponent.keeperRead || opponent.keeperGuess || opponent.read || 'center'
      const power = Number(round.power == null ? 75 : round.power)
      const onTarget = shot !== 'miss' && power >= 35 && power <= 95
      const goal = onTarget && shot !== keeperRead
      return {
        roundId: round.roundId || `penalty-${roundIndex + 1}`,
        shot,
        keeperRead,
        power,
        onTarget,
        goal,
        points: goal ? 1 : 0
      }
    })
    return scoreRow({ userId: playerId, detail })
  })
}

function resolveFreeKickDuel ({ session, reveals, result }) {
  const inputs = inputByPlayer(reveals)
  const players = playersFor(session, inputs)
  const attemptCount = Number(result.attemptCount || maxInputLength(inputs, ['attempts', 'freeKicks', 'rounds']) || 3)

  return players.map((playerId, index) => {
    const opponentId = players[(index + 1) % players.length]
    const attempts = roundInputs(inputs[playerId], ['attempts', 'freeKicks', 'rounds'], attemptCount)
    const opponentReads = roundInputs(inputs[opponentId], ['attempts', 'freeKicks', 'rounds'], attemptCount)
    const detail = attempts.map((attempt, attemptIndex) => {
      const opponent = opponentReads[attemptIndex] || {}
      const aim = attempt.aim || attempt.target || 'center'
      const keeperRead = opponent.keeperRead || opponent.read || 'center'
      const wallRead = opponent.wallRead || opponent.wall || null
      const power = Number(attempt.power == null ? 75 : attempt.power)
      const curve = Number(attempt.curve || 0)
      const onFrame = aim !== 'wall' && aim !== 'wide' && power >= 30 && power <= 95
      const wallBlocks = wallRead && wallRead === aim && Math.abs(curve) < 3
      const saved = keeperRead === aim && Math.abs(curve) < 7
      const goal = onFrame && !wallBlocks && !saved
      const qualityPoint = onFrame && !wallBlocks ? 1 : 0
      return {
        roundId: attempt.roundId || `free-kick-${attemptIndex + 1}`,
        aim,
        keeperRead,
        wallRead,
        power,
        curve,
        goal,
        points: goal ? 3 : qualityPoint
      }
    })
    return scoreRow({ userId: playerId, detail })
  })
}

function resolveTriviaDuel ({ session, reveals, result }) {
  const inputs = inputByPlayer(reveals)
  const players = playersFor(session, inputs)
  const correctAnswers = result.correctAnswers || result.answers || {}
  const questionIds = result.questionIds || Object.keys(correctAnswers)

  return players.map(playerId => {
    const answers = inputs[playerId] && (inputs[playerId].answers || inputs[playerId]) || {}
    const detail = questionIds.map(questionId => {
      const answerRow = answers[questionId]
      const answer = answerRow && typeof answerRow === 'object' && Object.prototype.hasOwnProperty.call(answerRow, 'answer')
        ? answerRow.answer
        : answerRow
      const responseMs = Number(answerRow && typeof answerRow === 'object' && answerRow.responseMs || 0)
      const correct = normalizeAnswer(answer) === normalizeAnswer(correctAnswers[questionId])
      return {
        questionId,
        answer: cloneJson(answer),
        correctAnswer: cloneJson(correctAnswers[questionId]),
        responseMs,
        correct,
        points: correct ? 1 : 0
      }
    })
    return scoreRow({
      userId: playerId,
      detail,
      tieBreak: detail.reduce((sum, row) => sum + Number(row.responseMs || 0), 0)
    })
  })
}

function resolveReactionChallenge ({ session, reveals, result }) {
  const inputs = inputByPlayer(reveals)
  const players = playersFor(session, inputs)
  const moments = result.moments || uniqueMomentIds(inputs)
  const maxReactionMs = Number(result.maxReactionMs || 2000)
  const fastestByMoment = new Map()

  moments.forEach(momentId => {
    players.forEach(playerId => {
      const tap = tapForMoment(inputs[playerId], momentId)
      if (!tap || Number(tap.reactionMs) > maxReactionMs) return
      const current = fastestByMoment.get(momentId)
      if (!current || Number(tap.reactionMs) < current.reactionMs) {
        fastestByMoment.set(momentId, {
          userId: playerId,
          reactionMs: Number(tap.reactionMs)
        })
      }
    })
  })

  return players.map(playerId => {
    const detail = moments.map(momentId => {
      const tap = tapForMoment(inputs[playerId], momentId)
      const reactionMs = tap ? Number(tap.reactionMs) : null
      const fastest = fastestByMoment.get(momentId)
      const wonMoment = Boolean(fastest && fastest.userId === playerId)
      return {
        momentId,
        reactionMs,
        fastestReactionMs: fastest ? fastest.reactionMs : null,
        wonMoment,
        points: wonMoment ? 1 : 0
      }
    })
    const totalReactionMs = detail.reduce((sum, row) => sum + Number(row.reactionMs || maxReactionMs), 0)
    return scoreRow({ userId: playerId, detail, tieBreak: totalReactionMs })
  })
}

function resolveScoreOnlyGame ({ session, reveals }) {
  const inputs = inputByPlayer(reveals)
  return playersFor(session, inputs).map(playerId => {
    const input = inputs[playerId] || {}
    const score = Number(input.score || 0)
    return {
      userId: playerId,
      score,
      tieBreak: Number(input.tieBreak || 0),
      detail: cloneJson(input.detail || [])
    }
  })
}

function scoreRow ({ userId, detail, tieBreak = null }) {
  return {
    userId,
    score: detail.reduce((sum, row) => sum + Number(row.points || 0), 0),
    tieBreak,
    detail
  }
}

function rankRows (rows, gameType) {
  const lowerTieBreakWins = gameType === 'trivia-duel' || gameType === 'reaction-challenge'
  return rows.slice().sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    if (left.tieBreak != null && right.tieBreak != null && left.tieBreak !== right.tieBreak) {
      return lowerTieBreakWins ? left.tieBreak - right.tieBreak : right.tieBreak - left.tieBreak
    }
    return left.userId.localeCompare(right.userId)
  })
}

function inputByPlayer (reveals = []) {
  return Object.fromEntries(reveals
    .filter(reveal => reveal && reveal.playerId)
    .map(reveal => [reveal.playerId, cloneJson(reveal.input || {})]))
}

function playersFor (session, inputs) {
  const players = [...new Set([...(session.players || []), ...Object.keys(inputs)])]
  if (players.length < 2) throw new RangeError('mini-game resolution requires at least two players')
  return players
}

function roundInputs (input = {}, keys, count) {
  const list = keys.map(key => input && input[key]).find(Array.isArray) || []
  const normalized = list.map(item => typeof item === 'string' ? { shot: item, aim: item } : (item || {}))
  while (normalized.length < count) normalized.push({})
  return normalized.slice(0, count)
}

function maxInputLength (inputs, keys) {
  return Math.max(0, ...Object.values(inputs).map(input => {
    const list = keys.map(key => input && input[key]).find(Array.isArray)
    return list ? list.length : 0
  }))
}

function normalizeAnswer (value) {
  return String(value == null ? '' : value).trim().toLowerCase()
}

function uniqueMomentIds (inputs) {
  const ids = new Set()
  Object.values(inputs).forEach(input => {
    const taps = Array.isArray(input.taps) ? input.taps : Array.isArray(input.reactions) ? input.reactions : []
    taps.forEach(tap => {
      if (tap && tap.momentId) ids.add(tap.momentId)
    })
  })
  return [...ids]
}

function tapForMoment (input = {}, momentId) {
  const taps = Array.isArray(input.taps) ? input.taps : Array.isArray(input.reactions) ? input.reactions : []
  return taps.find(tap => tap && tap.momentId === momentId) || null
}

module.exports = {
  MINI_GAME_RESOLVERS,
  resolveMiniGame,
  resolvePenaltyClash,
  resolveFreeKickDuel,
  resolveTriviaDuel,
  resolveReactionChallenge,
  resolveScoreOnlyGame,
  rankRows
}
