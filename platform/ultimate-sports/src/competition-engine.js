'use strict'

const {
  EVENT_TEMPLATE_KINDS,
  ENTRANT_SHAPES,
  RESULT_POLICIES,
  POOL_VARIANTS
} = require('./constants')
const {
  assertAllowed,
  assertNonEmptyString,
  cloneJson,
  ensureArray,
  slugify,
  stableId
} = require('./util')

function createCompetitionTemplate (input = {}) {
  const kind = input.kind || 'single-elimination'
  const entrantShape = input.entrantShape || 'team'
  const resultPolicy = input.resultPolicy || 'official-feed'
  assertAllowed(kind, EVENT_TEMPLATE_KINDS, 'template kind')
  assertAllowed(entrantShape, ENTRANT_SHAPES, 'entrant shape')
  assertAllowed(resultPolicy, RESULT_POLICIES, 'result policy')

  const templateId = input.templateId || stableId(`template-${kind}`, {
    kind,
    sportOrCategory: input.sportOrCategory || 'sports',
    entrantShape,
    resultPolicy
  })

  const supportedPoolVariants = input.supportedPoolVariants || defaultPoolVariantsForTemplate(kind)
  supportedPoolVariants.forEach(variant => assertAllowed(variant, POOL_VARIANTS, 'pool variant'))

  return {
    templateId,
    kind,
    sportOrCategory: input.sportOrCategory || 'sports',
    stages: cloneJson(input.stages || []),
    entrantShape,
    supportsLiveRooms: input.supportsLiveRooms !== false,
    supportsOfficialFeed: input.supportsOfficialFeed !== false && resultPolicy !== 'host-entered',
    supportedPoolVariants,
    supportedMiniGames: cloneJson(input.supportedMiniGames || []),
    resultPolicy
  }
}

function createCompetition (input = {}) {
  assertNonEmptyString(input.title, 'competition title')
  const template = input.template || createCompetitionTemplate(input.templateConfig || {})
  const entrants = normalizeEntrants(input.entrants || [], template.entrantShape)
  const competitionId = input.competitionId || stableId(`competition-${slugify(input.title)}`, {
    title: input.title,
    templateId: template.templateId,
    entrants: entrants.map(entrant => entrant.entrantId)
  })

  const fixtures = input.fixtures
    ? cloneJson(input.fixtures)
    : generateFixturesForTemplate({
        competitionId,
        template,
        entrants,
        startsAt: input.startsAt,
        fixturesConfig: input.fixturesConfig || {}
      })

  return {
    competitionId,
    templateId: template.templateId,
    template,
    title: input.title,
    category: input.category || 'sports',
    organizerId: input.organizerId || null,
    status: input.status || 'draft',
    entrants,
    entrantIds: entrants.map(entrant => entrant.entrantId),
    fixtures,
    fixtureIds: fixtures.map(fixture => fixture.fixtureId),
    resultPolicy: template.resultPolicy
  }
}

function createCompetitionEntrant (input = {}, entrantShape = 'team') {
  return normalizeEntrants([input], input.shape || entrantShape)[0]
}

function addEntrantToCompetition (competition, entrantInput = {}) {
  if (!competition || typeof competition !== 'object') throw new TypeError('competition is required')
  const entrant = createCompetitionEntrant(entrantInput, competition.template && competition.template.entrantShape || 'team')
  if ((competition.entrantIds || []).includes(entrant.entrantId)) {
    throw new Error(`entrant already exists: ${entrant.entrantId}`)
  }
  const entrants = cloneJson(competition.entrants || []).concat(entrant)
  return {
    ...competition,
    entrants,
    entrantIds: entrants.map(item => item.entrantId)
  }
}

function createFixture (input = {}) {
  assertNonEmptyString(input.competitionId, 'competitionId')
  const sourceSlots = input.sourceSlots || (input.entrantIds || []).map(entrantId => ({
    type: 'entrant',
    entrantId
  }))
  if (!Array.isArray(sourceSlots) || sourceSlots.length === 0) throw new TypeError('sourceSlots or entrantIds are required')
  const fixtureIndex = Number.isFinite(Number(input.fixtureIndex)) ? Number(input.fixtureIndex) : 0

  return {
    fixtureId: input.fixtureId || stableId(`fixture-${input.competitionId}`, {
      stageId: input.stageId || `${input.competitionId}:stage:manual`,
      sourceSlots,
      startsAt: input.startsAt || null
    }),
    competitionId: input.competitionId,
    stageId: input.stageId || `${input.competitionId}:stage:manual`,
    roundNumber: Number.isFinite(Number(input.roundNumber)) ? Number(input.roundNumber) : 1,
    roundName: input.roundName || 'Manual Fixture',
    fixtureIndex,
    startsAt: input.startsAt || null,
    status: input.status || 'scheduled',
    sourceSlots: cloneJson(sourceSlots),
    resultFields: cloneJson(input.resultFields || ['winnerEntrantId']),
    metadata: cloneJson(input.metadata || {}),
    result: cloneJson(input.result || null)
  }
}

function scheduleFixtureForCompetition (competition, fixtureInput = {}) {
  if (!competition || typeof competition !== 'object') throw new TypeError('competition is required')
  const fixture = createFixture({
    ...fixtureInput,
    competitionId: fixtureInput.competitionId || competition.competitionId,
    fixtureIndex: fixtureInput.fixtureIndex == null ? (competition.fixtures || []).length : fixtureInput.fixtureIndex
  })
  if ((competition.fixtureIds || []).includes(fixture.fixtureId)) {
    throw new Error(`fixture already exists: ${fixture.fixtureId}`)
  }
  const fixtures = cloneJson(competition.fixtures || []).concat(fixture)
  return {
    ...competition,
    fixtures,
    fixtureIds: fixtures.map(item => item.fixtureId)
  }
}

function updateCompetitionStatus (competition, update = {}) {
  if (!competition || typeof competition !== 'object') throw new TypeError('competition is required')
  assertNonEmptyString(update.status, 'status')
  return {
    ...competition,
    status: update.status,
    statusUpdatedAt: update.updatedAt || new Date().toISOString()
  }
}

function normalizeEntrants (entrants, entrantShape = 'team') {
  return ensureArray(entrants, 'entrants').map((entrant, index) => {
    if (typeof entrant === 'string') {
      return {
        entrantId: stableId(`entrant-${slugify(entrant) || index + 1}`, { name: entrant, index }),
        name: entrant,
        seed: index + 1,
        shape: entrantShape,
        metadata: {}
      }
    }

    if (!entrant || typeof entrant !== 'object') {
      throw new TypeError('entrant must be a string or object')
    }

    const name = entrant.name || entrant.title || entrant.label
    assertNonEmptyString(name, 'entrant name')
    return {
      entrantId: entrant.entrantId || entrant.id || stableId(`entrant-${slugify(name) || index + 1}`, { name, index }),
      name,
      seed: entrant.seed || index + 1,
      shape: entrant.shape || entrantShape,
      metadata: cloneJson(entrant.metadata || {})
    }
  })
}

function generateSingleEliminationFixtures ({ competitionId, entrants, startsAt = null } = {}) {
  assertNonEmptyString(competitionId, 'competitionId')
  const normalizedEntrants = normalizeEntrants(entrants || [])
  if (!isPowerOfTwo(normalizedEntrants.length) || normalizedEntrants.length < 2) {
    throw new RangeError('single-elimination entrants must be a power of two and at least 2')
  }

  const roundCount = Math.log2(normalizedEntrants.length)
  const fixtures = []

  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber += 1) {
    const matchCount = normalizedEntrants.length / Math.pow(2, roundNumber)
    for (let fixtureIndex = 0; fixtureIndex < matchCount; fixtureIndex += 1) {
      fixtures.push({
        fixtureId: fixtureIdFor(competitionId, roundNumber, fixtureIndex),
        competitionId,
        stageId: `${competitionId}:stage:knockout`,
        roundNumber,
        roundName: defaultRoundName(matchCount),
        fixtureIndex,
        startsAt,
        status: 'scheduled',
        sourceSlots: sourceSlotsForRound({
          competitionId,
          entrants: normalizedEntrants,
          roundNumber,
          fixtureIndex
        }),
        result: null
      })
    }
  }

  return fixtures
}

function generateFixturesForTemplate ({ competitionId, template, entrants, startsAt = null, fixturesConfig = {} } = {}) {
  if (!template || typeof template !== 'object') throw new TypeError('template is required')
  if (template.kind === 'single-elimination' || template.kind === 'group-plus-knockout') {
    return generateSingleEliminationFixtures({ competitionId, entrants, startsAt })
  }
  if (template.kind === 'round-robin') {
    return generateRoundRobinFixtures({ competitionId, entrants, startsAt })
  }
  if (template.kind === 'series-playoff') {
    return generateSeriesPlayoffFixtures({
      competitionId,
      entrants,
      startsAt,
      bestOf: fixturesConfig.bestOf || template.bestOf || 7
    })
  }
  if (template.kind === 'fight-card') {
    return generateFightCardFixtures({ competitionId, bouts: fixturesConfig.bouts || entrants, startsAt })
  }
  if (template.kind === 'awards-card') {
    return generateAwardsFixtures({ competitionId, categories: fixturesConfig.categories || entrants, startsAt })
  }
  return []
}

function generateRoundRobinFixtures ({ competitionId, entrants, startsAt = null } = {}) {
  assertNonEmptyString(competitionId, 'competitionId')
  const normalizedEntrants = normalizeEntrants(entrants || [])
  const fixtures = []

  for (let leftIndex = 0; leftIndex < normalizedEntrants.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < normalizedEntrants.length; rightIndex += 1) {
      const fixtureIndex = fixtures.length
      fixtures.push({
        fixtureId: `${competitionId}:rr:m${fixtureIndex + 1}`,
        competitionId,
        stageId: `${competitionId}:stage:round-robin`,
        roundNumber: fixtureIndex + 1,
        roundName: 'Round Robin',
        fixtureIndex,
        startsAt,
        status: 'scheduled',
        sourceSlots: [
          { type: 'entrant', entrantId: normalizedEntrants[leftIndex].entrantId },
          { type: 'entrant', entrantId: normalizedEntrants[rightIndex].entrantId }
        ],
        result: null
      })
    }
  }

  return fixtures
}

function generateSeriesPlayoffFixtures ({ competitionId, entrants, startsAt = null, bestOf = 7 } = {}) {
  assertNonEmptyString(competitionId, 'competitionId')
  const normalizedEntrants = normalizeEntrants(entrants || [])
  if (!isPowerOfTwo(normalizedEntrants.length) || normalizedEntrants.length < 2) {
    throw new RangeError('series-playoff entrants must be a power of two and at least 2')
  }
  if (!Number.isInteger(bestOf) || bestOf < 1 || bestOf % 2 === 0) {
    throw new RangeError('bestOf must be an odd positive integer')
  }

  const seriesFixtures = generateSingleEliminationFixtures({ competitionId, entrants: normalizedEntrants, startsAt })
  return seriesFixtures.map(fixture => ({
    ...fixture,
    fixtureId: fixture.fixtureId.replace(':r', ':series:r'),
    stageId: `${competitionId}:stage:series-playoff`,
    roundName: `${fixture.roundName} Series`,
    series: {
      bestOf,
      winsRequired: Math.floor(bestOf / 2) + 1,
      games: Array.from({ length: bestOf }, (_, index) => ({
        gameNumber: index + 1,
        status: 'scheduled',
        winnerEntrantId: null
      }))
    }
  }))
}

function generateFightCardFixtures ({ competitionId, bouts, startsAt = null } = {}) {
  assertNonEmptyString(competitionId, 'competitionId')
  return ensureArray(bouts || [], 'bouts').map((bout, index) => {
    const fighterA = bout.fighterA || bout.left || bout.entrants && bout.entrants[0] || `fighter-a-${index + 1}`
    const fighterB = bout.fighterB || bout.right || bout.entrants && bout.entrants[1] || `fighter-b-${index + 1}`
    const boutId = bout.boutId || bout.fixtureId || `${competitionId}:bout:${index + 1}`
    return {
      fixtureId: boutId,
      competitionId,
      stageId: `${competitionId}:stage:fight-card`,
      roundNumber: index + 1,
      roundName: bout.mainEvent ? 'Main Event' : 'Fight Card',
      fixtureIndex: index,
      startsAt: bout.startsAt || startsAt,
      status: 'scheduled',
      sourceSlots: [
        { type: 'entrant', entrantId: entrantIdFromValue(fighterA, `fighter-a-${index + 1}`) },
        { type: 'entrant', entrantId: entrantIdFromValue(fighterB, `fighter-b-${index + 1}`) }
      ],
      resultFields: ['winnerEntrantId', 'method', 'round', 'time'],
      metadata: cloneJson({
        weightClass: bout.weightClass || null,
        mainEvent: Boolean(bout.mainEvent)
      }),
      result: null
    }
  })
}

function generateAwardsFixtures ({ competitionId, categories, startsAt = null } = {}) {
  assertNonEmptyString(competitionId, 'competitionId')
  return ensureArray(categories || [], 'categories').map((category, index) => {
    const name = category.name || category.title || category.label || `Category ${index + 1}`
    const nominees = ensureArray(category.nominees || category.entrants || [], 'category nominees')
    return {
      fixtureId: category.categoryId || category.fixtureId || `${competitionId}:category:${slugify(name) || index + 1}`,
      competitionId,
      stageId: `${competitionId}:stage:awards-card`,
      roundNumber: index + 1,
      roundName: 'Awards Category',
      fixtureIndex: index,
      startsAt: category.startsAt || startsAt,
      status: 'scheduled',
      sourceSlots: nominees.map((nominee, nomineeIndex) => ({
        type: 'entrant',
        entrantId: entrantIdFromValue(nominee, `nominee-${index + 1}-${nomineeIndex + 1}`)
      })),
      resultFields: ['winnerEntrantId'],
      metadata: cloneJson({ name }),
      result: null
    }
  })
}

function sourceSlotsForRound ({ competitionId, entrants, roundNumber, fixtureIndex }) {
  if (roundNumber === 1) {
    return [
      { type: 'entrant', entrantId: entrants[fixtureIndex * 2].entrantId },
      { type: 'entrant', entrantId: entrants[fixtureIndex * 2 + 1].entrantId }
    ]
  }

  return [
    { type: 'winner', fixtureId: fixtureIdFor(competitionId, roundNumber - 1, fixtureIndex * 2) },
    { type: 'winner', fixtureId: fixtureIdFor(competitionId, roundNumber - 1, fixtureIndex * 2 + 1) }
  ]
}

function fixtureIdFor (competitionId, roundNumber, fixtureIndex) {
  return `${competitionId}:r${roundNumber}:m${fixtureIndex + 1}`
}

function defaultRoundName (matchCount) {
  if (matchCount === 1) return 'Final'
  if (matchCount === 2) return 'Semifinals'
  if (matchCount === 4) return 'Quarterfinals'
  return `Round of ${matchCount * 2}`
}

function defaultPoolVariantsForTemplate (kind) {
  if (kind === 'single-elimination') {
    return ['classic-bracket', 'confidence', 'head-to-head-duel', 'upset-bounty']
  }
  if (kind === 'series-playoff') {
    return ['classic-bracket', 'confidence', 'head-to-head-duel', 'fantasy-lite-draft', 'player-prop']
  }
  if (kind === 'round-robin') {
    return ['confidence', 'survivor', 'fantasy-lite-draft']
  }
  if (kind === 'group-plus-knockout') {
    return ['group-stage-card', 'classic-bracket', 'confidence', 'survivor']
  }
  if (kind === 'fight-card' || kind === 'awards-card') {
    return ['confidence', 'head-to-head-duel', 'watch-party-bingo']
  }
  return ['confidence']
}

function isPowerOfTwo (value) {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0
}

function entrantIdFromValue (value, fallback) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return value.entrantId || value.id || stableId(`entrant-${slugify(value.name || value.title || fallback)}`, value)
  return fallback
}

module.exports = {
  createCompetitionTemplate,
  createCompetition,
  createCompetitionEntrant,
  addEntrantToCompetition,
  createFixture,
  scheduleFixtureForCompetition,
  updateCompetitionStatus,
  normalizeEntrants,
  generateFixturesForTemplate,
  generateSingleEliminationFixtures,
  generateRoundRobinFixtures,
  generateSeriesPlayoffFixtures,
  generateFightCardFixtures,
  generateAwardsFixtures,
  fixtureIdFor,
  defaultRoundName,
  defaultPoolVariantsForTemplate,
  isPowerOfTwo,
  entrantIdFromValue
}
