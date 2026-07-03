'use strict'

const competition = require('./competition-engine')
const feed = require('./feed-engine')
const prediction = require('./prediction-engine')
const { cloneJson, stableId } = require('./util')

const DEFAULT_WORLD_CUP_MATCH_IDS = Object.freeze([
  'r32-1', 'r32-2', 'r32-3', 'r32-4',
  'r32-5', 'r32-6', 'r32-7', 'r32-8',
  'r32-9', 'r32-10', 'r32-11', 'r32-12',
  'r32-13', 'r32-14', 'r32-15', 'r32-16',
  'r16-1', 'r16-2', 'r16-3', 'r16-4',
  'r16-5', 'r16-6', 'r16-7', 'r16-8',
  'qf-1', 'qf-2', 'qf-3', 'qf-4',
  'sf-1', 'sf-2',
  'final-1'
])

const DEFAULT_WORLD_CUP_LINKS = Object.freeze([
  { from: ['r32-1', 'r32-2'], to: 'r16-1' },
  { from: ['r32-3', 'r32-4'], to: 'r16-2' },
  { from: ['r32-5', 'r32-6'], to: 'r16-3' },
  { from: ['r32-7', 'r32-8'], to: 'r16-4' },
  { from: ['r32-9', 'r32-10'], to: 'r16-5' },
  { from: ['r32-11', 'r32-12'], to: 'r16-6' },
  { from: ['r32-13', 'r32-14'], to: 'r16-7' },
  { from: ['r32-15', 'r32-16'], to: 'r16-8' },
  { from: ['r16-1', 'r16-2'], to: 'qf-1' },
  { from: ['r16-3', 'r16-4'], to: 'qf-2' },
  { from: ['r16-5', 'r16-6'], to: 'qf-3' },
  { from: ['r16-7', 'r16-8'], to: 'qf-4' },
  { from: ['qf-1', 'qf-2'], to: 'sf-1' },
  { from: ['qf-3', 'qf-4'], to: 'sf-2' },
  { from: ['sf-1', 'sf-2'], to: 'final-1' }
])

function createWorldCupCompatibilityPlan (input = {}) {
  const warnings = []
  const competitionId = input.competitionId || 'world-cup-compat'
  const teams = normalizeWorldCupTeams(input.teams || input.teamList || [])
  const entrantIds = new Set(teams.map(team => team.entrantId))
  const matchIds = input.bracketMatchIds || input.matchIds || DEFAULT_WORLD_CUP_MATCH_IDS
  const round32Matches = input.round32Matches || input.matches || []
  const bracketLinks = input.bracketLinks || DEFAULT_WORLD_CUP_LINKS
  const fixtures = createWorldCupFixtures({
    competitionId,
    matchIds,
    round32Matches,
    bracketLinks
  })
  const competitionPayload = {
    competitionId,
    title: input.title || 'PearCup World Cup',
    category: 'sports',
    status: input.status || 'open',
    templateConfig: {
      kind: 'single-elimination',
      sportOrCategory: 'soccer',
      entrantShape: 'team',
      resultPolicy: 'official-feed'
    },
    entrants: teams,
    fixtures
  }
  const v2Competition = competition.createCompetition(competitionPayload)
  const pools = normalizeWorldCupPools({
    pools: input.pools || [],
    competitionId,
    mode: input.mode || 'demo'
  })
  const submissions = extractWorldCupBracketSubmissions({
    ...input,
    pools,
    matchIds,
    entrantIds,
    warnings
  })
  const officialResults = normalizeWorldCupOfficialResults(input.officialResults || officialResultsFromWorkerView(input.workerView))
  const resultSnapshot = Object.keys(officialResults.results).length > 0
    ? feed.createResultSnapshot({
        competitionId,
        sourcePolicy: 'official-feed',
        sourceId: officialResults.sourceId,
        sourceActorId: officialResults.sourceActorId,
        recordedAt: officialResults.recordedAt,
        results: officialResults.results
      })
    : null

  if (!resultSnapshot) warnings.push('no official results snapshot was available for migration')

  const commands = [
    command('competition:create', input.actorId || 'compatibility-adapter', competitionPayload)
  ]
  pools.forEach(pool => commands.push(command('pool:create', input.actorId || 'compatibility-adapter', pool)))
  submissions.forEach(submission => {
    commands.push(command('prediction:submit', submission.userId, {
      entryId: submission.entryId,
      poolId: submission.poolId,
      userId: submission.userId,
      entryType: 'bracket',
      picks: submission.picks,
      submittedAt: submission.submittedAt
    }))
    commands.push(command('prediction:lock', input.actorId || 'compatibility-adapter', {
      entryId: submission.entryId,
      lockedAt: submission.lockedAt || submission.submittedAt
    }))
  })
  if (resultSnapshot) {
    commands.push(command('result:record', resultSnapshot.sourceActorId || resultSnapshot.sourceId || 'compatibility-feed', {
      competitionId,
      sourcePolicy: resultSnapshot.sourcePolicy,
      sourceId: resultSnapshot.sourceId,
      sourceActorId: resultSnapshot.sourceActorId,
      recordedAt: resultSnapshot.recordedAt,
      results: resultSnapshot.results
    }))
    pools
      .filter(pool => submissions.some(submission => submission.poolId === pool.poolId))
      .forEach(pool => {
        commands.push(command('pool:resolve', input.actorId || 'compatibility-adapter', {
          poolId: pool.poolId,
          resultSnapshotId: resultSnapshot.snapshotId
        }))
      })
  }

  return {
    source: 'pearcup-world-cup-v1',
    competition: v2Competition,
    pools,
    submissions,
    resultSnapshot,
    commands,
    warnings
  }
}

function normalizeWorldCupTeams (teams = []) {
  if (Array.isArray(teams)) {
    return teams.map((team, index) => normalizeTeam(team, index))
  }
  return Object.entries(teams || {}).map(([teamId, team], index) => normalizeTeam({
    ...team,
    id: team.id || teamId
  }, index))
}

function createWorldCupFixtures ({ competitionId, matchIds = DEFAULT_WORLD_CUP_MATCH_IDS, round32Matches = [], bracketLinks = DEFAULT_WORLD_CUP_LINKS } = {}) {
  const round32ById = new Map(round32Matches.map(match => [match.id || match.matchId || match.fixtureId, match]))
  const linkByTarget = new Map(bracketLinks.map(link => [link.to, link]))
  return matchIds.map((fixtureId, index) => {
    const round32 = round32ById.get(fixtureId)
    const link = linkByTarget.get(fixtureId)
    return {
      fixtureId,
      competitionId,
      stageId: `${competitionId}:stage:world-cup-knockout`,
      roundNumber: roundNumberForWorldCupMatch(fixtureId),
      roundName: roundNameForWorldCupMatch(fixtureId),
      fixtureIndex: index,
      startsAt: round32 && round32.startsAt || round32 && round32.time || null,
      status: fixtureStatus(round32),
      sourceSlots: sourceSlotsForFixture({ fixtureId, round32, link }),
      result: resultForRound32Fixture(round32),
      metadata: cloneJson({
        v1MatchId: fixtureId,
        v1Status: round32 && round32.status || null
      })
    }
  })
}

function normalizeWorldCupOfficialResults (officialResults = {}) {
  const winners = officialBracketWinners(officialResults)
  const results = {}
  Object.entries(winners).forEach(([fixtureId, winnerEntrantId]) => {
    if (!winnerEntrantId) return
    results[fixtureId] = {
      winnerEntrantId,
      roundNumber: roundNumberForWorldCupMatch(fixtureId),
      sourceFixtureId: fixtureId
    }
  })

  return {
    results,
    sourceId: officialResults.source || officialResults.sourceId || 'pearcup-demo-match-feed',
    sourceActorId: officialResults.sourceActorId || officialResults.source || officialResults.sourceId || 'pearcup-demo-match-feed',
    recordedAt: officialResults.capturedAt || officialResults.recordedAt || new Date().toISOString()
  }
}

function extractWorldCupBracketSubmissions (input = {}) {
  const warnings = input.warnings || []
  const matchIds = input.matchIds || DEFAULT_WORLD_CUP_MATCH_IDS
  const entrantIds = input.entrantIds || new Set()
  const pools = input.pools || normalizeWorldCupPools({
    pools: input.pools || [],
    competitionId: input.competitionId || 'world-cup-compat',
    mode: input.mode || 'demo'
  })
  const poolIds = new Set(pools.map(pool => pool.poolId))
  const submissions = []

  directSubmissions(input).forEach(submission => {
    addSubmission(submissions, normalizeSubmission({
      submission,
      matchIds,
      entrantIds,
      warnings
    }))
  })

  Object.entries(input.state && input.state.submittedPicksByTier || {}).forEach(([tier, picks]) => {
    const poolId = worldCupPoolIdForTier(tier)
    if (!poolIds.has(poolId)) return
    const userId = input.userId || userIdFromUsername(input.username || input.state.username || 'captain')
    addSubmission(submissions, normalizeSubmission({
      submission: {
        poolId,
        entryId: `${poolId}-${userId}`,
        userId,
        username: input.username || input.state.username || 'captain',
        picks,
        rulesVersion: input.rulesVersion || 'bracket-pool-v1',
        submittedAt: input.submittedAt || null
      },
      matchIds,
      entrantIds,
      warnings
    }))
  })

  return submissions.filter(submission => poolIds.has(submission.poolId))
}

function normalizeWorldCupPicks (picks = {}, options = {}) {
  const matchIds = options.matchIds || DEFAULT_WORLD_CUP_MATCH_IDS
  const matchIdSet = new Set(matchIds)
  const entrantIds = options.entrantIds || new Set()
  const warnings = options.warnings || []
  const source = picks && typeof picks === 'object' && !Array.isArray(picks) ? picks : {}
  const next = {}

  Object.entries(source).forEach(([fixtureId, entrantId]) => {
    if (!matchIdSet.has(fixtureId)) {
      warnings.push(`dropped unknown World Cup match pick: ${fixtureId}`)
      return
    }
    if (entrantIds.size > 0 && !entrantIds.has(entrantId)) {
      warnings.push(`dropped unknown World Cup entrant pick: ${entrantId}`)
      return
    }
    next[fixtureId] = entrantId
  })

  return next
}

function worldCupPoolIdForTier (tier) {
  return `world-cup-${Number(tier) || tier}`
}

function roundNumberForWorldCupMatch (fixtureId) {
  if (String(fixtureId).startsWith('r32-')) return 1
  if (String(fixtureId).startsWith('r16-')) return 2
  if (String(fixtureId).startsWith('qf-')) return 3
  if (String(fixtureId).startsWith('sf-')) return 4
  return 5
}

function roundNameForWorldCupMatch (fixtureId) {
  if (String(fixtureId).startsWith('r32-')) return 'Round of 32'
  if (String(fixtureId).startsWith('r16-')) return 'Round of 16'
  if (String(fixtureId).startsWith('qf-')) return 'Quarterfinals'
  if (String(fixtureId).startsWith('sf-')) return 'Semifinals'
  return 'Final'
}

function officialBracketWinners (officialResults = {}) {
  if (!officialResults || typeof officialResults !== 'object') return {}
  if (officialResults.matchWinners && typeof officialResults.matchWinners === 'object') return { ...officialResults.matchWinners }
  if (officialResults.winners && typeof officialResults.winners === 'object') return { ...officialResults.winners }
  if (officialResults.results && typeof officialResults.results === 'object' && !Array.isArray(officialResults.results)) {
    return Object.fromEntries(Object.entries(officialResults.results).map(([fixtureId, result]) => [
      fixtureId,
      result && typeof result === 'object' ? result.winnerEntrantId || result.winnerId || result.winner : result
    ]))
  }
  if (Array.isArray(officialResults.matches)) {
    return officialResults.matches.reduce((winners, match) => {
      const fixtureId = match && (match.fixtureId || match.matchId || match.id)
      const winnerEntrantId = match && (match.winnerEntrantId || match.winnerTeamId || match.teamId || match.winner)
      if (fixtureId && winnerEntrantId) winners[fixtureId] = winnerEntrantId
      return winners
    }, {})
  }
  const winners = {}
  Object.entries(officialResults).forEach(([key, value]) => {
    if (value && typeof value !== 'object') winners[key] = value
  })
  if (officialResults.champion && !winners['final-1']) winners['final-1'] = officialResults.champion
  return winners
}

function normalizeTeam (team, index) {
  if (typeof team === 'string') {
    return {
      entrantId: team,
      name: team,
      seed: index + 1,
      shape: 'team',
      metadata: { source: 'world-cup-v1' }
    }
  }
  return {
    entrantId: team.entrantId || team.id || team.teamId || stableId(`world-cup-team-${index + 1}`, team),
    name: team.name || team.title || team.label || team.id || `Team ${index + 1}`,
    seed: team.seed || index + 1,
    shape: 'team',
    metadata: cloneJson({
      source: 'world-cup-v1',
      flag: team.flag || null,
      colors: team.colors || null
    })
  }
}

function normalizeWorldCupPools ({ pools = [], competitionId, mode = 'demo' } = {}) {
  const sourcePools = pools.length ? pools : [{ tier: 25, max: null, prize: null, rail: null }]
  return sourcePools.map(sourcePool => {
    const tier = sourcePool.tier || sourcePool.amount || sourcePool.entryFee || 25
    const rules = prediction.createPoolRules({
      variant: 'classic-bracket',
      payoutPolicy: mode,
      rulesVersion: sourcePool.rulesVersion || 'bracket-pool-v1',
      scoringVersion: 'world-cup-bracket-v1',
      tiePolicy: 'split',
      config: {
        source: 'world-cup-v1',
        tier
      }
    })
    return {
      poolId: sourcePool.poolId || worldCupPoolIdForTier(tier),
      competitionId,
      title: sourcePool.title || `$${tier} World Cup bracket`,
      rules,
      mode,
      maxEntries: sourcePool.max || sourcePool.maxEntries || null,
      status: sourcePool.status || 'open',
      metadata: cloneJson({
        source: 'world-cup-v1',
        tier,
        prize: sourcePool.prize || null,
        rail: sourcePool.rail || null,
        entrantCount: sourcePool.entrants || null
      })
    }
  })
}

function directSubmissions (input = {}) {
  const submissions = []
  if (Array.isArray(input.bracketSubmissions)) submissions.push(...input.bracketSubmissions)
  if (input.workerView && input.workerView.bracketSubmissions) submissions.push(...Object.values(input.workerView.bracketSubmissions))
  if (input.workerView && input.workerView.bracketSubmissionsByPool) {
    Object.values(input.workerView.bracketSubmissionsByPool).forEach(byUser => {
      submissions.push(...Object.values(byUser || {}))
    })
  }
  if (Array.isArray(input.events)) {
    input.events
      .filter(event => event && event.type === 'BracketSubmissionLocked' && event.payload)
      .forEach(event => submissions.push(event.payload))
  }
  return submissions
}

function normalizeSubmission ({ submission, matchIds, entrantIds, warnings }) {
  if (!submission || !submission.poolId || !submission.userId) return null
  const picks = normalizeWorldCupPicks(submission.picks || {}, { matchIds, entrantIds, warnings })
  if (Object.keys(picks).length === 0) return null
  return {
    sourceSubmissionId: submission.submissionId || null,
    poolId: submission.poolId,
    entryId: submission.entryId || stableId(`world-cup-entry-${submission.poolId}-${submission.userId}`, picks),
    userId: submission.userId,
    username: submission.username || null,
    picks,
    rulesVersion: submission.rulesVersion || 'bracket-pool-v1',
    submittedAt: submission.submittedAt || null,
    lockedAt: submission.lockedAt || submission.submittedAt || null
  }
}

function addSubmission (submissions, submission) {
  if (!submission) return
  const key = `${submission.poolId}:${submission.userId}`
  const existingIndex = submissions.findIndex(item => `${item.poolId}:${item.userId}` === key)
  if (existingIndex >= 0) submissions[existingIndex] = submission
  else submissions.push(submission)
}

function officialResultsFromWorkerView (workerView = {}) {
  const snapshot = Object.values(workerView && workerView.officialResultsSnapshots || {})[0]
  return snapshot && (snapshot.officialResults || snapshot.results) || null
}

function sourceSlotsForFixture ({ fixtureId, round32, link }) {
  if (round32 && Array.isArray(round32.slots)) {
    return round32.slots.map(entrantId => ({ type: 'entrant', entrantId }))
  }
  if (link && Array.isArray(link.from)) {
    return link.from.map(sourceFixtureId => ({ type: 'winner', fixtureId: sourceFixtureId }))
  }
  return [{ type: 'placeholder', label: fixtureId }]
}

function fixtureStatus (round32) {
  if (!round32) return 'scheduled'
  const status = String(round32.status || '').toLowerCase()
  if (status === 'open') return 'scheduled'
  if (status === 'ft' || status.includes('pen') || status === 'aet') return 'completed'
  return 'scheduled'
}

function resultForRound32Fixture (round32) {
  if (!round32 || !Array.isArray(round32.score)) return null
  if (round32.score.some(score => score == null)) return null
  const [homeScore, awayScore] = round32.score
  return {
    homeScore,
    awayScore
  }
}

function userIdFromUsername (username) {
  return `user-${String(username || 'captain').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'captain'}`
}

function command (type, actorId, payload) {
  return {
    type,
    actorId,
    payload: cloneJson(payload)
  }
}

module.exports = {
  DEFAULT_WORLD_CUP_MATCH_IDS,
  DEFAULT_WORLD_CUP_LINKS,
  createWorldCupCompatibilityPlan,
  normalizeWorldCupTeams,
  normalizeWorldCupPicks,
  normalizeWorldCupOfficialResults,
  extractWorldCupBracketSubmissions,
  createWorldCupFixtures,
  worldCupPoolIdForTier,
  roundNumberForWorldCupMatch,
  roundNameForWorldCupMatch,
  officialBracketWinners
}
