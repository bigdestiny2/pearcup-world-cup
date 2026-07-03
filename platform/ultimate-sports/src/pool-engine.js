'use strict'

const { createPoolRules } = require('./prediction-engine')
const {
  rankScoreboard,
  scoreClassicBracket,
  scoreConfidenceCard,
  scoreSurvivorEntry,
  scoreUpsetBountyBracket
} = require('./scoring-engine')
const { assertNonEmptyString, cloneJson, stableId } = require('./util')

function createPool (input = {}) {
  assertNonEmptyString(input.competitionId, 'competitionId')
  const rules = input.rules || createPoolRules({
    variant: input.variant || 'classic-bracket',
    payoutPolicy: input.mode || input.payoutPolicy || 'demo',
    config: input.config || {}
  })

  const poolId = input.poolId || stableId(`pool-${rules.variant}`, {
    competitionId: input.competitionId,
    rulesVersion: rules.rulesVersion,
    entryCloseAt: input.entryCloseAt || null
  })

  return {
    poolId,
    competitionId: input.competitionId,
    title: input.title || rules.variant,
    rules,
    mode: input.mode || rules.payoutPolicy,
    maxEntries: input.maxEntries || null,
    entryOpenAt: input.entryOpenAt || null,
    entryCloseAt: input.entryCloseAt || null,
    status: input.status || 'open',
    entrantCount: 0,
    metadata: cloneJson(input.metadata || {})
  }
}

function scoreEntryForPool ({ pool, entry, resultSnapshot } = {}) {
  const variant = pool && pool.rules && pool.rules.variant
  if (variant === 'confidence' || variant === 'group-stage-card') {
    return scoreConfidenceCard({ entry, resultSnapshot })
  }
  if (variant === 'survivor') {
    return scoreSurvivorEntry({ entry, resultSnapshot })
  }
  if (variant === 'upset-bounty') {
    return scoreUpsetBountyBracket({
      entry,
      resultSnapshot,
      defaultUpsetBonus: pool.rules.config.defaultUpsetBonus
    })
  }
  return scoreClassicBracket({ entry, resultSnapshot })
}

function buildPoolLeaderboard ({ pool, entries = [], resultSnapshot } = {}) {
  if (!pool || typeof pool !== 'object') throw new TypeError('pool is required')
  const lockedEntries = entries.filter(entry => entry && entry.status === 'locked')
  const rows = lockedEntries.map(entry => scoreEntryForPool({ pool, entry, resultSnapshot }))
  return rankScoreboard(rows)
}

function resolvePoolWinners ({ pool, entries = [], resultSnapshot } = {}) {
  const leaderboard = buildPoolLeaderboard({ pool, entries, resultSnapshot })
  const winningScore = leaderboard.length ? leaderboard[0].score : 0
  const winnerRows = leaderboard.filter(row => row.score === winningScore)
  return {
    poolId: pool && pool.poolId,
    rulesVersion: pool && pool.rules && pool.rules.rulesVersion,
    resultSnapshotId: resultSnapshot && resultSnapshot.snapshotId,
    leaderboard,
    winnerUserIds: winnerRows.map(row => row.userId).filter(Boolean),
    winningScore,
    tied: winnerRows.length > 1
  }
}

module.exports = {
  createPool,
  scoreEntryForPool,
  buildPoolLeaderboard,
  resolvePoolWinners
}

