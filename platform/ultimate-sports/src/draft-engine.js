'use strict'

const { assertNonEmptyString, cloneJson, hash32, stableId } = require('./util')

function createDraftSlate (input = {}) {
  assertNonEmptyString(input.competitionId, 'competitionId')
  const athletes = (input.athletes || []).map((athlete, index) => normalizeAthlete(athlete, index))
  return {
    slateId: input.slateId || stableId('draft-slate', {
      competitionId: input.competitionId,
      athletes: athletes.map(athlete => athlete.athleteId),
      rosterSize: input.rosterSize || 3
    }),
    competitionId: input.competitionId,
    title: input.title || 'Fantasy-lite draft',
    rosterSize: input.rosterSize || 3,
    athletes,
    scoringRules: cloneJson(input.scoringRules || {})
  }
}

function normalizeAthlete (athlete, index) {
  if (typeof athlete === 'string') {
    return {
      athleteId: stableId(`athlete-${athlete}`, index),
      name: athlete,
      metadata: {}
    }
  }
  if (!athlete || typeof athlete !== 'object') throw new TypeError('athlete must be a string or object')
  assertNonEmptyString(athlete.name, 'athlete name')
  return {
    athleteId: athlete.athleteId || athlete.id || stableId(`athlete-${athlete.name}`, index),
    name: athlete.name,
    metadata: cloneJson(athlete.metadata || {})
  }
}

function createDraftEntry ({ slate, userId, athleteIds = [], submittedAt = new Date().toISOString() } = {}) {
  if (!slate || typeof slate !== 'object') throw new TypeError('slate is required')
  assertNonEmptyString(userId, 'userId')
  const uniqueAthleteIds = [...new Set(athleteIds)]
  if (uniqueAthleteIds.length !== athleteIds.length) throw new Error('draft entry cannot repeat athletes')
  if (uniqueAthleteIds.length > slate.rosterSize) throw new Error('draft entry exceeds roster size')
  const eligible = new Set(slate.athletes.map(athlete => athlete.athleteId))
  uniqueAthleteIds.forEach(athleteId => {
    if (!eligible.has(athleteId)) throw new Error(`unknown athlete ${athleteId}`)
  })
  return {
    entryId: stableId(`draft-entry-${slate.slateId}-${userId}`, uniqueAthleteIds),
    slateId: slate.slateId,
    competitionId: slate.competitionId,
    userId,
    athleteIds: uniqueAthleteIds,
    submittedAt,
    status: 'submitted'
  }
}

function scoreDraftEntry ({ slate, entry, athleteStats = {} } = {}) {
  if (!slate || typeof slate !== 'object') throw new TypeError('slate is required')
  const rules = slate.scoringRules || {}
  const detail = (entry && entry.athleteIds || []).map(athleteId => {
    const stats = athleteStats[athleteId] || {}
    const points = Object.keys(rules).reduce((sum, statName) => {
      return sum + Number(stats[statName] || 0) * Number(rules[statName] || 0)
    }, 0)
    return {
      athleteId,
      stats: cloneJson(stats),
      points
    }
  })
  return {
    entryId: entry && entry.entryId,
    userId: entry && entry.userId,
    slateId: slate.slateId,
    score: detail.reduce((sum, row) => sum + row.points, 0),
    detail
  }
}

function resolveDraftSlate ({ slate, entries = [], athleteStats = {}, resolvedAt = new Date().toISOString() } = {}) {
  if (!slate || typeof slate !== 'object') throw new TypeError('slate is required')
  const rows = entries
    .filter(entry => entry && entry.slateId === slate.slateId)
    .map(entry => scoreDraftEntry({ slate, entry, athleteStats }))
    .sort(scoreRowSort)
  const winningScore = rows.length ? rows[0].score : 0
  const winnerRows = rows.filter(row => row.score === winningScore)
  const body = {
    slateId: slate.slateId,
    athleteStats: cloneJson(athleteStats),
    rows,
    winnerUserIds: winnerRows.map(row => row.userId).filter(Boolean)
  }

  return {
    resolutionId: stableId(`draft-resolution-${slate.slateId}`, body),
    slateId: slate.slateId,
    competitionId: slate.competitionId,
    athleteStats: cloneJson(athleteStats),
    rows,
    winnerUserIds: body.winnerUserIds,
    winningScore,
    tied: winnerRows.length > 1,
    resultHash: hash32(body),
    resolvedAt
  }
}

function scoreRowSort (left, right) {
  if (right.score !== left.score) return right.score - left.score
  return String(left.userId || '').localeCompare(String(right.userId || ''))
}

module.exports = {
  createDraftSlate,
  createDraftEntry,
  scoreDraftEntry,
  resolveDraftSlate,
  scoreRowSort
}
