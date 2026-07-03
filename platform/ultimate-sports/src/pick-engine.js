'use strict'

const cardEngine = require('./card-engine')
const draftEngine = require('./draft-engine')
const prediction = require('./prediction-engine')
const { cloneJson, stableId } = require('./util')

function createPickWorkbench (input = {}) {
  const view = input.view || {}
  const userId = input.userId || 'local-peer'
  const pools = values(view.pools)
    .filter(pool => input.competitionId ? pool.competitionId === input.competitionId : true)
    .sort(compareTitles)
  const selectedPool = input.poolId
    ? pools.find(pool => pool.poolId === input.poolId) || null
    : pools.find(pool => pool.status === 'open') || pools[0] || null
  const selectedCompetition = selectedPool
    ? view.competitions && view.competitions[selectedPool.competitionId] || null
    : input.competitionId && view.competitions && view.competitions[input.competitionId] || null
  const poolBuilders = pools.map(pool => createPoolPickBuilder({
    pool,
    competition: view.competitions && view.competitions[pool.competitionId] || null,
    userId,
    entries: values(view.predictionEntries).filter(entry => entry.poolId === pool.poolId && entry.userId === userId)
  }))
  const openCards = values(view.cards)
    .filter(card => selectedCompetition ? card.competitionId === selectedCompetition.competitionId : true)
    .sort(compareTitles)
    .map(card => createCardPickBuilder({
      card,
      userId,
      submissions: values(view.cardSubmissions).filter(submission => submission.cardId === card.cardId && submission.userId === userId)
    }))
  const openDrafts = values(view.draftSlates)
    .filter(slate => selectedCompetition ? slate.competitionId === selectedCompetition.competitionId : true)
    .sort(compareTitles)
    .map(slate => createDraftPickBuilder({
      slate,
      userId,
      entries: values(view.draftEntries).filter(entry => entry.slateId === slate.slateId && entry.userId === userId)
    }))
  const selectedBuilder = selectedPool
    ? poolBuilders.find(builder => builder.poolId === selectedPool.poolId) || null
    : null

  return {
    workbenchId: stableId(`pick-workbench-${userId}`, {
      poolIds: pools.map(pool => pool.poolId),
      cardIds: openCards.map(card => card.cardId),
      slateIds: openDrafts.map(slate => slate.slateId)
    }),
    userId,
    generatedAt: input.now || new Date().toISOString(),
    counts: {
      openPools: poolBuilders.filter(builder => builder.pool.status === 'open').length,
      lockReadyPools: poolBuilders.filter(builder => builder.lockReady).length,
      openCards: openCards.length,
      cardSubmissions: openCards.filter(builder => builder.currentSubmission).length,
      openDrafts: openDrafts.length,
      draftEntries: openDrafts.filter(builder => builder.currentEntry).length
    },
    selectedPoolId: selectedPool && selectedPool.poolId || null,
    selectedCompetitionId: selectedCompetition && selectedCompetition.competitionId || null,
    pools: poolBuilders.map(poolBuilderSummary),
    selectedPoolBuilder: selectedBuilder,
    cardBuilders: openCards,
    draftBuilders: openDrafts
  }
}

function createPoolPickBuilder ({ pool, competition = null, userId, entries = [] } = {}) {
  if (!pool || typeof pool !== 'object') throw new TypeError('pool is required')
  const variant = pool.rules && pool.rules.variant || 'classic-bracket'
  const entryType = entryTypeForVariant(variant)
  const currentEntry = latestEntry(entries)
  const picks = cloneJson(currentEntry && currentEntry.picks || emptyPicksForVariant({ variant, competition }))
  const validation = validatePoolPicks({ pool, competition, picks })
  const lockReady = validation.ok && (!currentEntry || currentEntry.status !== 'locked')

  return {
    poolId: pool.poolId,
    competitionId: pool.competitionId,
    pool: poolSummary(pool),
    competition: competition ? competitionSummary(competition) : null,
    variant,
    entryType,
    currentEntry: currentEntry ? entrySummary(currentEntry) : null,
    bracket: bracketBuilderFor({ competition, picks, variant }),
    confidence: confidenceBuilderFor({ competition, picks, variant }),
    survivor: survivorBuilderFor({ competition, picks, variant }),
    validation,
    lockReady,
    commandDrafts: {
      submit: {
        type: 'prediction:submit',
        actorId: userId,
        payload: {
          poolId: pool.poolId,
          userId,
          entryType,
          picks
        }
      },
      lock: currentEntry
        ? {
            type: 'prediction:lock',
            actorId: userId,
            payload: {
              entryId: currentEntry.entryId
            }
          }
        : null
    }
  }
}

function createCardPickBuilder ({ card, userId, submissions = [] } = {}) {
  if (!card || typeof card !== 'object') throw new TypeError('card is required')
  const currentSubmission = latestSubmission(submissions)
  const answers = cloneJson(currentSubmission && currentSubmission.answers || emptyAnswersForCard(card))
  const validation = cardEngine.validateCardSubmission({ card, answers })

  return {
    cardId: card.cardId,
    competitionId: card.competitionId,
    title: card.title,
    cardType: card.cardType,
    currentSubmission: currentSubmission
      ? {
          submissionId: currentSubmission.submissionId,
          status: currentSubmission.status,
          submittedAt: currentSubmission.submittedAt || null
        }
      : null,
    fields: (card.fields || []).map(field => ({
      fieldId: field.fieldId,
      fieldType: field.fieldType,
      label: field.label,
      options: cloneJson(field.options || []),
      required: field.required !== false,
      metadata: cloneJson(field.metadata || {}),
      answer: cloneJson(answers[field.fieldId] == null ? null : answers[field.fieldId])
    })),
    validation,
    submitReady: validation.ok,
    commandDraft: {
      type: 'card:submit',
      actorId: userId,
      payload: {
        cardId: card.cardId,
        userId,
        answers
      }
    }
  }
}

function createDraftPickBuilder ({ slate, userId, entries = [] } = {}) {
  if (!slate || typeof slate !== 'object') throw new TypeError('draft slate is required')
  const currentEntry = latestEntry(entries)
  const athleteIds = cloneJson(currentEntry && currentEntry.athleteIds || [])
  const validation = validateDraftSelection({ slate, athleteIds })

  return {
    slateId: slate.slateId,
    competitionId: slate.competitionId,
    title: slate.title,
    rosterSize: slate.rosterSize,
    currentEntry: currentEntry
      ? {
          entryId: currentEntry.entryId,
          status: currentEntry.status,
          submittedAt: currentEntry.submittedAt || null
        }
      : null,
    athletes: (slate.athletes || []).map(athlete => ({
      athleteId: athlete.athleteId,
      name: athlete.name,
      selected: athleteIds.includes(athlete.athleteId),
      metadata: cloneJson(athlete.metadata || {})
    })),
    selectedAthleteIds: athleteIds,
    validation,
    submitReady: validation.ok,
    commandDraft: {
      type: 'draft:submit',
      actorId: userId,
      payload: {
        slateId: slate.slateId,
        userId,
        athleteIds
      }
    }
  }
}

function validatePoolPicks ({ pool, competition = null, picks = {} } = {}) {
  const variant = pool && pool.rules && pool.rules.variant || 'classic-bracket'
  if (variant === 'confidence' || variant === 'group-stage-card' || variant === 'player-prop') {
    return validateConfidencePoolPicks({ competition, picks })
  }
  if (variant === 'survivor') return validateSurvivorPoolPicks({ competition, picks })
  if (variant === 'watch-party-bingo') return validateBingoPoolPicks(picks)
  if (variant === 'fantasy-lite-draft') return validateDraftPoolPicks(picks)
  return validateBracketPoolPicks({ competition, picks })
}

function validateBracketPoolPicks ({ competition = null, picks = {} } = {}) {
  const fixtures = competition && Array.isArray(competition.fixtures) ? competition.fixtures : []
  const requiredFixtures = fixtures.filter(fixture => fixture.status !== 'cancelled')
  const errors = []
  requiredFixtures.forEach(fixture => {
    if (!picks || !picks[fixture.fixtureId]) errors.push(`${fixture.fixtureId} is required`)
  })
  return validationResult(errors)
}

function validateConfidencePoolPicks ({ competition = null, picks = [] } = {}) {
  const list = Array.isArray(picks) ? picks : Object.values(picks || {})
  const base = prediction.validateConfidencePicks(list)
  const errors = base.errors.slice()
  const fixtureIds = new Set((competition && competition.fixtures || []).map(fixture => fixture.fixtureId))
  if (list.length === 0) errors.push('at least one confidence pick is required')
  list.forEach((pick, index) => {
    const fixtureId = pick.fixtureId || pick.pickId
    if (!fixtureId) errors.push(`pick ${index + 1} must target a fixture`)
    if (fixtureIds.size && fixtureId && !fixtureIds.has(fixtureId)) errors.push(`${fixtureId} is not in the competition`)
    if (!pick.outcome) errors.push(`pick ${index + 1} must choose an outcome`)
  })
  return validationResult(errors)
}

function validateSurvivorPoolPicks ({ competition = null, picks = [] } = {}) {
  const list = Array.isArray(picks) ? picks : Object.values(picks || {})
  const fixtureIds = new Set((competition && competition.fixtures || []).map(fixture => fixture.fixtureId))
  const usedEntrants = new Set()
  const errors = []
  if (list.length === 0) errors.push('at least one survivor pick is required')
  list.forEach((pick, index) => {
    if (!pick.fixtureId) errors.push(`pick ${index + 1} must target a fixture`)
    if (fixtureIds.size && pick.fixtureId && !fixtureIds.has(pick.fixtureId)) errors.push(`${pick.fixtureId} is not in the competition`)
    if (!pick.entrantId) errors.push(`pick ${index + 1} must choose an entrant`)
    if (pick.entrantId && usedEntrants.has(pick.entrantId)) errors.push(`${pick.entrantId} is repeated`)
    if (pick.entrantId) usedEntrants.add(pick.entrantId)
  })
  return validationResult(errors)
}

function validateBingoPoolPicks (picks = {}) {
  const values = Array.isArray(picks) ? picks : Object.values(picks || {})
  return validationResult(values.length ? [] : ['at least one bingo cell is required'])
}

function validateDraftPoolPicks (picks = {}) {
  const athleteIds = Array.isArray(picks) ? picks : picks.athleteIds || []
  return validationResult(athleteIds.length ? [] : ['at least one athlete is required'])
}

function validateDraftSelection ({ slate, athleteIds = [] } = {}) {
  const errors = []
  const unique = new Set(athleteIds)
  const eligible = new Set((slate.athletes || []).map(athlete => athlete.athleteId))
  if (unique.size !== athleteIds.length) errors.push('draft entry cannot repeat athletes')
  if (athleteIds.length !== Number(slate.rosterSize || 0)) errors.push(`draft entry must select ${slate.rosterSize} athletes`)
  athleteIds.forEach(athleteId => {
    if (!eligible.has(athleteId)) errors.push(`unknown athlete ${athleteId}`)
  })
  return validationResult(errors)
}

function bracketBuilderFor ({ competition = null, picks = {}, variant } = {}) {
  if (!competition || !['classic-bracket', 'upset-bounty', 'head-to-head-duel', 'side-quest'].includes(variant)) return null
  return {
    rounds: roundsForCompetition(competition, picks),
    pickCount: Object.keys(picks || {}).length
  }
}

function confidenceBuilderFor ({ competition = null, picks = [], variant } = {}) {
  if (!competition || !['confidence', 'group-stage-card', 'player-prop'].includes(variant)) return null
  const pickList = Array.isArray(picks) ? picks : Object.values(picks || {})
  const pickByFixture = new Map(pickList.map(pick => [pick.fixtureId || pick.pickId, pick]))
  return {
    rows: (competition.fixtures || []).map((fixture, index) => {
      const pick = pickByFixture.get(fixture.fixtureId) || {}
      return {
        fixtureId: fixture.fixtureId,
        roundNumber: fixture.roundNumber || 1,
        label: fixture.roundName || fixture.fixtureId,
        outcome: pick.outcome || null,
        confidence: pick.confidence || index + 1,
        options: winnerOptionsForFixture(fixture, competition.entrants || [])
      }
    }),
    pickCount: pickList.length
  }
}

function survivorBuilderFor ({ competition = null, picks = [], variant } = {}) {
  if (!competition || variant !== 'survivor') return null
  const pickList = Array.isArray(picks) ? picks : Object.values(picks || {})
  const pickByFixture = new Map(pickList.map(pick => [pick.fixtureId, pick]))
  return {
    rounds: (competition.fixtures || [])
      .slice()
      .sort(compareFixtures)
      .map(fixture => {
        const pick = pickByFixture.get(fixture.fixtureId) || {}
        return {
          fixtureId: fixture.fixtureId,
          roundNumber: fixture.roundNumber || 1,
          roundName: fixture.roundName || null,
          selectedEntrantId: pick.entrantId || null,
          options: winnerOptionsForFixture(fixture, competition.entrants || [])
        }
      }),
    usedEntrantIds: [...new Set(pickList.map(pick => pick.entrantId).filter(Boolean))]
  }
}

function roundsForCompetition (competition, picks = {}) {
  const rounds = new Map()
  ;(competition.fixtures || [])
    .slice()
    .sort(compareFixtures)
    .forEach(fixture => {
      const roundNumber = fixture.roundNumber || 1
      if (!rounds.has(roundNumber)) {
        rounds.set(roundNumber, {
          roundNumber,
          roundName: fixture.roundName || null,
          fixtures: []
        })
      }
      rounds.get(roundNumber).fixtures.push({
        fixtureId: fixture.fixtureId,
        fixtureIndex: fixture.fixtureIndex || 0,
        roundNumber,
        roundName: fixture.roundName || null,
        status: fixture.status,
        selectedWinnerEntrantId: picks && picks[fixture.fixtureId] || null,
        sourceSlots: sourceSlotSummaries(fixture.sourceSlots || [], competition.entrants || []),
        winnerOptions: winnerOptionsForFixture(fixture, competition.entrants || [])
      })
    })
  return [...rounds.values()]
}

function sourceSlotSummaries (sourceSlots = [], entrants = []) {
  const entrantMap = new Map(entrants.map(entrant => [entrant.entrantId, entrant]))
  return sourceSlots.map(slot => {
    if (slot.type === 'entrant') {
      const entrant = entrantMap.get(slot.entrantId)
      return {
        type: 'entrant',
        entrantId: slot.entrantId,
        seed: slot.seed || entrant && entrant.seed || null,
        label: entrant && entrant.name || slot.entrantId
      }
    }
    if (slot.type === 'winner') {
      return {
        type: 'winner',
        fixtureId: slot.fixtureId,
        label: `Winner of ${slot.fixtureId}`
      }
    }
    if (slot.type === 'bye') {
      return {
        type: 'bye',
        seed: slot.seed || null,
        label: 'Bye'
      }
    }
    return {
      ...cloneJson(slot),
      label: slot.label || slot.entrantId || slot.fixtureId || slot.type || 'Slot'
    }
  })
}

function winnerOptionsForFixture (fixture, entrants = []) {
  return sourceSlotSummaries(fixture.sourceSlots || [], entrants)
    .filter(slot => slot.type === 'entrant')
    .map(slot => ({
      entrantId: slot.entrantId,
      label: slot.label,
      seed: slot.seed || null
    }))
}

function emptyPicksForVariant ({ variant, competition = null }) {
  if (variant === 'confidence' || variant === 'group-stage-card' || variant === 'player-prop') {
    return (competition && competition.fixtures || []).map((fixture, index) => ({
      pickId: fixture.fixtureId,
      fixtureId: fixture.fixtureId,
      outcome: null,
      confidence: index + 1
    }))
  }
  if (variant === 'survivor') return []
  if (variant === 'fantasy-lite-draft') return { athleteIds: [] }
  if (variant === 'watch-party-bingo') return {}
  return {}
}

function emptyAnswersForCard (card) {
  return (card.fields || []).reduce((answers, field) => {
    answers[field.fieldId] = null
    return answers
  }, {})
}

function entryTypeForVariant (variant) {
  if (variant === 'confidence' || variant === 'group-stage-card' || variant === 'player-prop') return 'card'
  if (variant === 'survivor') return 'survivor'
  if (variant === 'fantasy-lite-draft') return 'draft'
  if (variant === 'watch-party-bingo') return 'bingo'
  return 'bracket'
}

function latestEntry (entries = []) {
  return entries.slice().sort(compareSubmitted)[0] || null
}

function latestSubmission (submissions = []) {
  return submissions.slice().sort(compareSubmitted)[0] || null
}

function poolBuilderSummary (builder) {
  return {
    poolId: builder.poolId,
    competitionId: builder.competitionId,
    title: builder.pool.title,
    variant: builder.variant,
    entryType: builder.entryType,
    status: builder.pool.status,
    currentEntryStatus: builder.currentEntry && builder.currentEntry.status || null,
    lockReady: builder.lockReady,
    missingRequirements: cloneJson(builder.validation.errors)
  }
}

function poolSummary (pool) {
  return {
    poolId: pool.poolId,
    competitionId: pool.competitionId,
    title: pool.title,
    status: pool.status,
    mode: pool.mode,
    variant: pool.rules && pool.rules.variant
  }
}

function competitionSummary (competition) {
  return {
    competitionId: competition.competitionId,
    title: competition.title,
    status: competition.status,
    entrantCount: (competition.entrantIds || competition.entrants || []).length,
    fixtureCount: (competition.fixtureIds || competition.fixtures || []).length
  }
}

function entrySummary (entry) {
  return {
    entryId: entry.entryId,
    poolId: entry.poolId,
    entryType: entry.entryType,
    status: entry.status,
    submittedAt: entry.submittedAt || null,
    lockedAt: entry.lockedAt || null
  }
}

function validationResult (errors) {
  return {
    ok: errors.length === 0,
    errors
  }
}

function compareTitles (left, right) {
  return String(left.title || left.poolId || left.cardId || left.slateId).localeCompare(String(right.title || right.poolId || right.cardId || right.slateId))
}

function compareSubmitted (left, right) {
  return String(right.lockedAt || right.submittedAt || '').localeCompare(String(left.lockedAt || left.submittedAt || ''))
}

function compareFixtures (left, right) {
  const leftRound = Number(left.roundNumber || 0)
  const rightRound = Number(right.roundNumber || 0)
  if (leftRound !== rightRound) return leftRound - rightRound
  return Number(left.fixtureIndex || 0) - Number(right.fixtureIndex || 0)
}

function values (collection = {}) {
  return Object.values(collection || {})
}

module.exports = {
  createPickWorkbench,
  createPoolPickBuilder,
  createCardPickBuilder,
  createDraftPickBuilder,
  validatePoolPicks,
  validateBracketPoolPicks,
  validateConfidencePoolPicks,
  validateSurvivorPoolPicks,
  validateDraftSelection,
  roundsForCompetition,
  sourceSlotSummaries,
  winnerOptionsForFixture,
  entryTypeForVariant
}
