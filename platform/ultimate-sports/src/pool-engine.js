'use strict'

const { createPoolRules } = require('./prediction-engine')
const {
  rankScoreboard,
  scoreClassicBracket,
  scoreConfidenceCard,
  scoreHeadToHeadDuel,
  scoreSideQuestEntry,
  scoreSurvivorEntry,
  scoreUpsetBountyBracket,
  scorePlayerPropEntry,
  scoreAwardsCard
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
  if (variant === 'player-prop') {
    return scorePlayerPropEntry({
      entry,
      resultSnapshot,
      config: pool.rules && pool.rules.config
    })
  }
  if (variant === 'group-stage-card') {
    // group-stage-card is the pick-card variant used for awards-card categories
    // (and similar flat key→value pick sheets). Flat object picks go through the
    // awards-card scorer; array-shaped confidence picks still use the confidence
    // scorer for soccer-style group cards.
    if (Array.isArray(entry && entry.picks)) {
      return scoreConfidenceCard({ entry, resultSnapshot })
    }
    return scoreAwardsCard({
      entry,
      resultSnapshot,
      categories: (pool.rules && pool.rules.config && pool.rules.config.categories) ||
        (pool.metadata && pool.metadata.categories)
    })
  }
  if (variant === 'confidence') {
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
  if (variant === 'side-quest') {
    return scoreSideQuestEntry({
      entry,
      resultSnapshot,
      config: {
        ...(pool.metadata && pool.metadata.sideQuest || {}),
        ...pool.rules.config
      }
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
  if (pool && pool.rules && pool.rules.variant === 'head-to-head-duel') {
    return resolveHeadToHeadDuelWinners({ pool, entries, resultSnapshot })
  }
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

function resolveHeadToHeadDuelWinners ({ pool, entries = [], resultSnapshot } = {}) {
  const lockedEntries = entries.filter(entry => entry && entry.status === 'locked')
  const duelEntries = selectDuelEntries({ pool, entries: lockedEntries })
  if (duelEntries.length < 2) {
    const leaderboard = rankScoreboard(duelEntries.map(entry => scoreEntryForPool({ pool, entry, resultSnapshot })))
    return {
      poolId: pool && pool.poolId,
      rulesVersion: pool && pool.rules && pool.rules.rulesVersion,
      resultSnapshotId: resultSnapshot && resultSnapshot.snapshotId,
      variant: 'head-to-head-duel',
      leaderboard,
      winnerUserIds: [],
      winningScore: leaderboard.length ? leaderboard[0].score : 0,
      tied: false,
      ready: false,
      missingEntries: 2 - duelEntries.length,
      participantUserIds: participantUserIdsForPool(pool)
    }
  }

  const duel = scoreHeadToHeadDuel({
    leftEntry: duelEntries[0],
    rightEntry: duelEntries[1],
    resultSnapshot,
    scoreEntry: ({ entry, resultSnapshot }) => scoreClassicBracket({
      entry,
      resultSnapshot,
      roundWeights: pool.rules && pool.rules.config && pool.rules.config.roundWeights || {}
    })
  })

  return {
    poolId: pool && pool.poolId,
    rulesVersion: pool && pool.rules && pool.rules.rulesVersion,
    resultSnapshotId: resultSnapshot && resultSnapshot.snapshotId,
    variant: 'head-to-head-duel',
    leaderboard: duel.rows,
    winnerUserIds: duel.winnerUserIds,
    winningScore: duel.rows.length ? duel.rows[0].score : 0,
    tied: duel.tied,
    ready: true,
    participantUserIds: duelEntries.map(entry => entry.userId),
    metadata: cloneJson(pool.metadata || {})
  }
}

function selectDuelEntries ({ pool, entries }) {
  const participantUserIds = participantUserIdsForPool(pool)
  const sorted = entries.slice().sort(compareEntries)
  if (!participantUserIds.length) return sorted.slice(0, 2)
  const byUser = new Map(sorted.map(entry => [entry.userId, entry]))
  return participantUserIds.map(userId => byUser.get(userId)).filter(Boolean).slice(0, 2)
}

function participantUserIdsForPool (pool) {
  const metadata = pool && pool.metadata || {}
  const ids = metadata.participantUserIds ||
    [metadata.challengerUserId, metadata.targetUserId].filter(Boolean)
  return [...new Set(ids.filter(Boolean))]
}

function compareEntries (left, right) {
  const leftAt = left.lockedAt || left.submittedAt || ''
  const rightAt = right.lockedAt || right.submittedAt || ''
  if (leftAt !== rightAt) return leftAt.localeCompare(rightAt)
  return String(left.userId || '').localeCompare(String(right.userId || ''))
}

module.exports = {
  createPool,
  scoreEntryForPool,
  buildPoolLeaderboard,
  resolvePoolWinners,
  resolveHeadToHeadDuelWinners,
  selectDuelEntries
}
