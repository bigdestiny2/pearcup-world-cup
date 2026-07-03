'use strict'

const { cloneJson } = require('./util')

function scoreClassicBracket ({ entry, resultSnapshot, roundWeights = {} } = {}) {
  const picks = entry && entry.picks && typeof entry.picks === 'object' ? entry.picks : {}
  const results = resultSnapshot && resultSnapshot.results && typeof resultSnapshot.results === 'object'
    ? resultSnapshot.results
    : {}

  const detail = Object.keys(results).sort().map(fixtureId => {
    const result = results[fixtureId] || {}
    const picked = picks[fixtureId]
    const actual = result.winnerEntrantId || result.winnerId || result.winner
    const roundNumber = Number(result.roundNumber || 1)
    const weight = Number(roundWeights[roundNumber] || Math.pow(2, Math.max(0, roundNumber - 1)))
    const correct = Boolean(picked && actual && picked === actual)
    return {
      fixtureId,
      picked,
      actual,
      roundNumber,
      weight,
      correct,
      points: correct ? weight : 0
    }
  })

  const score = detail.reduce((sum, row) => sum + row.points, 0)
  const possibleScore = detail.reduce((sum, row) => sum + row.weight, 0)

  return {
    entryId: entry && entry.entryId,
    userId: entry && entry.userId,
    score,
    possibleScore,
    correctCount: detail.filter(row => row.correct).length,
    scoredCount: detail.length,
    perfect: detail.length > 0 && detail.every(row => row.correct),
    detail
  }
}

function scoreConfidenceCard ({ entry, resultSnapshot } = {}) {
  const picks = Array.isArray(entry && entry.picks) ? entry.picks : Object.values(entry && entry.picks || {})
  const cardResults = resultSnapshot && resultSnapshot.cardResults || {}

  const detail = picks.map((pick, index) => {
    const pickId = pick.pickId || pick.fieldId || String(index)
    const actual = cardResults[pickId]
    const confidence = Number(pick.confidence || 0)
    const correct = actual != null && pick.outcome === actual
    return {
      pickId,
      picked: pick.outcome,
      actual,
      confidence,
      correct,
      points: correct ? confidence : 0
    }
  })

  return {
    entryId: entry && entry.entryId,
    userId: entry && entry.userId,
    score: detail.reduce((sum, row) => sum + row.points, 0),
    possibleScore: detail.reduce((sum, row) => sum + row.confidence, 0),
    correctCount: detail.filter(row => row.correct).length,
    scoredCount: detail.length,
    detail
  }
}

function scoreSurvivorEntry ({ entry, resultSnapshot } = {}) {
  const picks = Array.isArray(entry && entry.picks) ? entry.picks : Object.values(entry && entry.picks || {})
  const results = resultSnapshot && resultSnapshot.results && typeof resultSnapshot.results === 'object'
    ? resultSnapshot.results
    : {}
  const usedEntrants = new Set()
  let eliminatedAt = null

  const detail = picks
    .slice()
    .sort((left, right) => Number(left.roundNumber || 0) - Number(right.roundNumber || 0))
    .map((pick, index) => {
      const fixtureId = pick.fixtureId || pick.matchId
      const entrantId = pick.entrantId || pick.teamId || pick.playerId
      const result = results[fixtureId] || {}
      const actual = result.winnerEntrantId || result.winnerId || result.winner
      const repeated = usedEntrants.has(entrantId)
      const correct = Boolean(!repeated && entrantId && actual && entrantId === actual)
      if (entrantId) usedEntrants.add(entrantId)
      if (!correct && eliminatedAt == null) eliminatedAt = pick.roundNumber || index + 1
      return {
        fixtureId,
        roundNumber: pick.roundNumber || index + 1,
        picked: entrantId,
        actual,
        repeated,
        correct,
        points: correct ? 1 : 0
      }
    })

  return {
    entryId: entry && entry.entryId,
    userId: entry && entry.userId,
    score: detail.reduce((sum, row) => sum + row.points, 0),
    possibleScore: detail.length,
    correctCount: detail.filter(row => row.correct).length,
    scoredCount: detail.length,
    alive: detail.length > 0 && eliminatedAt == null,
    eliminatedAt,
    detail
  }
}

function scoreUpsetBountyBracket ({ entry, resultSnapshot, roundWeights = {}, defaultUpsetBonus = 1 } = {}) {
  const base = scoreClassicBracket({ entry, resultSnapshot, roundWeights })
  const results = resultSnapshot && resultSnapshot.results && typeof resultSnapshot.results === 'object'
    ? resultSnapshot.results
    : {}

  const detail = base.detail.map(row => {
    const result = results[row.fixtureId] || {}
    const underdogEntrantId = result.underdogEntrantId || result.underdogId
    const upsetBonus = Number(result.upsetBonus == null ? defaultUpsetBonus : result.upsetBonus)
    const upsetHit = Boolean(row.correct && underdogEntrantId && row.picked === underdogEntrantId)
    return {
      ...row,
      upsetBonus: upsetHit ? upsetBonus : 0,
      points: row.points + (upsetHit ? upsetBonus : 0),
      upsetHit
    }
  })

  return {
    ...base,
    variant: 'upset-bounty',
    score: detail.reduce((sum, row) => sum + row.points, 0),
    possibleScore: detail.reduce((sum, row) => sum + row.weight + Number(row.upsetBonus || 0), 0),
    upsetHits: detail.filter(row => row.upsetHit).length,
    detail
  }
}

function scoreHeadToHeadDuel ({ leftEntry, rightEntry, resultSnapshot, scoreEntry = scoreClassicBracket } = {}) {
  const left = scoreEntry({ entry: leftEntry, resultSnapshot })
  const right = scoreEntry({ entry: rightEntry, resultSnapshot })
  const winnerUserIds = []

  if (left.score > right.score && left.userId) winnerUserIds.push(left.userId)
  if (right.score > left.score && right.userId) winnerUserIds.push(right.userId)
  if (left.score === right.score) {
    if (left.userId) winnerUserIds.push(left.userId)
    if (right.userId && right.userId !== left.userId) winnerUserIds.push(right.userId)
  }

  return {
    variant: 'head-to-head-duel',
    rows: rankScoreboard([left, right]),
    winnerUserIds,
    tied: left.score === right.score
  }
}

function rankScoreboard (rows) {
  const ranked = cloneJson(rows || [])
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return String(left.userId || '').localeCompare(String(right.userId || ''))
    })

  let previousScore = null
  let previousRank = 0
  ranked.forEach((row, index) => {
    if (row.score !== previousScore) previousRank = index + 1
    row.rank = previousRank
    previousScore = row.score
  })

  return ranked
}

module.exports = {
  scoreClassicBracket,
  scoreConfidenceCard,
  scoreSurvivorEntry,
  scoreUpsetBountyBracket,
  scoreHeadToHeadDuel,
  rankScoreboard
}
