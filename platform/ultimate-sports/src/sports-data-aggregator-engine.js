'use strict'

const catalog = require('./catalog-engine')
const providers = require('./sports-data-provider-engine')
const { cloneJson, hash32, stableId } = require('./util')

const AGGREGATOR_PLAN_VERSION = 'ultimate-sports-data-aggregator-plan-v1'

const NORMALIZED_ENTITY_TYPES = Object.freeze([
  'competition',
  'season',
  'event',
  'fixture',
  'participant',
  'standing',
  'result',
  'live-event',
  'stat-line',
  'odds-market',
  'telemetry',
  'evidence'
])

const AGGREGATOR_SOURCES = Object.freeze({
  sportradarOfficial: source({
    sourceId: 'sportradar-official',
    providerId: 'sportradar',
    title: 'Sportradar official sports APIs',
    role: 'mainstream-official-backbone',
    sourceKind: 'api',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis', 'combat-sports'],
    dataProducts: ['fixtures', 'live-scores', 'play-by-play', 'stats', 'standings', 'results', 'odds-products'],
    normalizedTypes: ['competition', 'season', 'event', 'fixture', 'participant', 'standing', 'result', 'live-event', 'stat-line'],
    env: ['SPORTRADAR_API_KEY', 'SPORTRADAR_PRODUCT_CONFIG'],
    auth: 'server-side contracted API key per product',
    settlementTier: 'source-of-truth',
    usage: 'primary',
    notes: ['B2B provider; route through our backend only.']
  }),
  sportsdataioMma: source({
    sourceId: 'sportsdataio-mma',
    providerId: 'sportsdataio',
    title: 'SportsDataIO UFC / MMA API',
    role: 'combat-sports-primary',
    sourceKind: 'api',
    coverage: ['combat-sports'],
    dataProducts: ['fight-cards', 'fighters', 'event-schedule', 'method-results', 'fighter-stats', 'odds-context'],
    normalizedTypes: ['competition', 'event', 'fixture', 'participant', 'result', 'stat-line'],
    env: ['SPORTSDATAIO_MMA_API_KEY'],
    auth: 'Ocp-Apim-Subscription-Key server-side header',
    settlementTier: 'source-of-truth',
    usage: 'primary'
  }),
  sportsdataioGlobal: source({
    sourceId: 'sportsdataio-global',
    providerId: 'sportsdataio',
    title: 'SportsDataIO league and global APIs',
    role: 'us-sports-and-global-supplement',
    sourceKind: 'api',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis'],
    dataProducts: ['fixtures', 'scores', 'stats', 'standings', 'results', 'fantasy-context'],
    normalizedTypes: ['competition', 'season', 'event', 'fixture', 'participant', 'standing', 'result', 'stat-line'],
    env: ['SPORTSDATAIO_GLOBAL_API_KEY'],
    auth: 'server-side API key or subscription header',
    settlementTier: 'trusted-secondary',
    usage: 'supplement'
  }),
  pandascoreEsports: source({
    sourceId: 'pandascore-esports',
    providerId: 'pandascore',
    title: 'PandaScore esports APIs',
    role: 'esports-match-primary',
    sourceKind: 'api',
    coverage: ['esports'],
    dataProducts: ['fixtures', 'matches', 'tournaments', 'teams', 'players', 'historical-stats', 'live-frames', 'live-events'],
    normalizedTypes: ['competition', 'season', 'event', 'fixture', 'participant', 'result', 'live-event', 'stat-line'],
    env: ['PANDASCORE_TOKEN'],
    auth: 'server-side bearer token',
    settlementTier: 'source-of-truth',
    usage: 'primary',
    notes: ['Primary esports route for Valorant, League of Legends, Counter-Strike, and Dota-style coverage.']
  }),
  abiosEsports: source({
    sourceId: 'abios-esports',
    providerId: 'abios',
    title: 'Abios esports data API',
    role: 'esports-title-breadth-and-odds',
    sourceKind: 'api',
    coverage: ['esports'],
    dataProducts: ['match-calendar', 'brackets', 'results', 'team-stats', 'player-stats', 'live-data', 'esports-odds'],
    normalizedTypes: ['competition', 'season', 'event', 'fixture', 'participant', 'result', 'live-event', 'stat-line', 'odds-market'],
    env: ['ABIOS_CLIENT_ID', 'ABIOS_CLIENT_SECRET'],
    auth: 'server-side OAuth or contract credentials',
    settlementTier: 'trusted-secondary',
    usage: 'supplement',
    notes: ['Use as Rocket League hedge and secondary esports validation source.']
  }),
  oddsApiContext: source({
    sourceId: 'the-odds-api-context',
    providerId: 'the-odds-api',
    title: 'The Odds API',
    role: 'odds-and-market-context',
    sourceKind: 'api',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis', 'combat-sports', 'sailing'],
    dataProducts: ['sports-list', 'events', 'odds', 'scores', 'participants'],
    normalizedTypes: ['event', 'fixture', 'participant', 'odds-market'],
    env: ['ODDS_API_KEY'],
    auth: 'server-side API key',
    settlementTier: 'context-only',
    usage: 'context',
    notes: ['Never use odds alone as a result source.']
  }),
  sailgpPartner: source({
    sourceId: 'sailgp-partner-feed',
    providerId: 'sailgp-official-or-partner',
    title: 'SailGP official or partner feed',
    role: 'sailing-primary-when-licensed',
    sourceKind: 'api-or-partner-drop',
    coverage: ['sailing'],
    dataProducts: ['event-schedule', 'race-results', 'season-standings', 'team-rosters', 'wind-conditions', 'telemetry'],
    normalizedTypes: ['competition', 'season', 'event', 'fixture', 'participant', 'standing', 'result', 'telemetry'],
    env: ['SAILGP_PARTNER_FEED_KEY', 'SAILGP_PARTNER_FEED_BASE_URL'],
    auth: 'partner contract or signed data drop',
    settlementTier: 'source-of-truth',
    usage: 'specialist',
    notes: ['No stable public developer API is assumed; keep manual evidence fallback active.']
  }),
  officialWebEvidence: source({
    sourceId: 'official-web-evidence',
    providerId: 'host-evidence-qvac',
    title: 'Official web evidence capture',
    role: 'public-result-evidence',
    sourceKind: 'evidence',
    coverage: ['creator', 'awards', 'local', 'sailing', 'combat-sports'],
    dataProducts: ['source-links', 'screenshots', 'broadcast-notes', 'public-result-pages'],
    normalizedTypes: ['event', 'result', 'evidence'],
    env: [],
    auth: 'QVAC evidence packet',
    settlementTier: 'evidence-review',
    usage: 'fallback',
    notes: ['Used when an official API does not exist or is unavailable.']
  }),
  socialWebEvidence: source({
    sourceId: 'social-web-evidence',
    providerId: 'host-evidence-qvac',
    title: 'Social + web result evidence',
    role: 'public-social-search-corroboration',
    sourceKind: 'evidence',
    coverage: ['combat-sports', 'creator', 'awards', 'local'],
    dataProducts: ['verified-social-posts', 'web-search-results', 'news-snippets', 'source-links', 'screenshots'],
    normalizedTypes: ['event', 'result', 'evidence'],
    env: [],
    auth: 'QVAC evidence packet with source URLs',
    settlementTier: 'evidence-review',
    usage: 'fallback',
    notes: ['Used for boxing, kickboxing, ONE-style cards, bareknuckle, and local combat cards when no settlement-grade API is available.']
  }),
  hostEvidenceQvac: source({
    sourceId: 'host-evidence-qvac',
    providerId: 'host-evidence-qvac',
    title: 'Host evidence + QVAC referee',
    role: 'manual-result-and-correction-lane',
    sourceKind: 'manual',
    coverage: ['creator', 'awards', 'local', 'sailing', 'combat-sports', 'soccer', 'basketball', 'pro-sports', 'tennis', 'esports'],
    dataProducts: ['host-results', 'corrections', 'evidence-review', 'dispute-packets'],
    normalizedTypes: ['event', 'result', 'evidence'],
    env: [],
    auth: 'local platform attestation',
    settlementTier: 'evidence-review',
    usage: 'fallback',
    notes: ['Always available as correction overlay; prize settlement needs evidence.']
  }),
  statsPerformOpta: source({
    sourceId: 'stats-perform-opta',
    providerId: 'stats-perform',
    title: 'Stats Perform / Opta data feeds',
    role: 'premium-media-and-soccer-evaluation',
    sourceKind: 'api',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis'],
    dataProducts: ['deep-stats', 'editorial-data', 'prediction-market-data', 'graphics-context'],
    normalizedTypes: ['competition', 'fixture', 'participant', 'standing', 'result', 'stat-line'],
    env: ['STATSPERFORM_API_KEY'],
    auth: 'enterprise contract',
    settlementTier: 'trusted-secondary',
    usage: 'evaluate',
    notes: ['Evaluate for premium soccer/media depth, not required for MVP aggregation.']
  })
})

const ESPORTS_TITLE_SOURCE_OVERRIDES = Object.freeze({
  valorant: 'pandascore-esports',
  'league-of-legends': 'pandascore-esports',
  lol: 'pandascore-esports',
  'counter-strike': 'pandascore-esports',
  cs: 'pandascore-esports',
  'dota-2': 'pandascore-esports',
  dota: 'pandascore-esports',
  'rocket-league': 'abios-esports'
})

function createSportsDataAggregatorPlan (input = {}) {
  const includeEvaluationSources = input.includeEvaluationSources !== false
  const sources = Object.values(AGGREGATOR_SOURCES)
    .filter(source => includeEvaluationSources || source.usage !== 'evaluate')
    .map(cloneJson)
  const routes = catalog.listEventFits().map(fit => aggregatorRouteForFit(fit))

  return {
    planVersion: AGGREGATOR_PLAN_VERSION,
    strategy: {
      headline: 'Build one PearCup aggregator that routes each sport to its best official or specialist source, normalizes records, and preserves QVAC fallback for every gap.',
      coreStack: ['sportradar-official', 'sportsdataio-mma', 'pandascore-esports', 'abios-esports', 'sailgp-partner-feed', 'the-odds-api-context', 'official-web-evidence', 'social-web-evidence', 'host-evidence-qvac'],
      noClientSecrets: true,
      settlementRule: 'Only source-of-truth routes can auto-settle; trusted-secondary can corroborate; context-only never settles; evidence-review requires QVAC.'
    },
    normalizedEntityTypes: NORMALIZED_ENTITY_TYPES.slice(),
    sources,
    routes,
    ingestionPipeline: createAggregatorIngestionPipeline(),
    healthChecks: createAggregatorHealthCheckPlan({ sourceIds: routes.flatMap(route => route.sourceIds) }).checks,
    envVars: envVarsForSourceIds(sources.map(source => source.sourceId)),
    coverageGaps: coverageGapsFor(routes)
  }
}

function aggregatorRouteForFit (fitOrInput, options = {}) {
  const input = typeof fitOrInput === 'object' && fitOrInput && fitOrInput.fitId
    ? { ...fitOrInput, ...options }
    : { fitId: fitOrInput, ...options }
  const fit = typeof input.fitId === 'string' ? catalog.getEventFit(input.fitId) : input.fitId
  if (!fit) throw new Error(`unknown fit: ${input.fitId}`)

  const template = routeTemplateForFit(fit, input)
  const primarySource = sourceById(template.primarySourceId)
  const sourceIds = unique([
    template.primarySourceId,
    ...template.supplementSourceIds,
    ...template.contextSourceIds,
    ...template.fallbackSourceIds
  ])
  const sourceChain = sourceIds.map(sourceById)

  return {
    routeId: stableId(`aggregator-route-${fit.fitId}`, {
      primarySourceId: primarySource.sourceId,
      sourceIds,
      esportsTitle: input.esportsTitle || null
    }),
    fitId: fit.fitId,
    title: fit.title,
    category: fit.category,
    resultPolicy: fit.resultPolicy,
    providerPlan: providers.providerPlanForFit(fit.fitId),
    primarySourceId: primarySource.sourceId,
    sourceIds,
    sources: sourceChain.map(routeSourceView),
    dataProducts: unique(sourceChain.flatMap(source => source.dataProducts)),
    normalizedContracts: normalizedContractsForFit(fit),
    settlement: settlementPolicyFor({ fit, sourceChain }),
    fallbackOrder: template.fallbackSourceIds.slice(),
    contextSourceIds: template.contextSourceIds.slice(),
    requestPolicy: requestPolicyFor({ fit, primarySource }),
    envVars: envVarsForSourceIds(sourceIds),
    titleSourceOverrides: fit.fitId === 'esports-major' ? cloneJson(ESPORTS_TITLE_SOURCE_OVERRIDES) : null
  }
}

function createAggregatorHealthCheckPlan ({ sourceIds = null } = {}) {
  const ids = unique(sourceIds || Object.values(AGGREGATOR_SOURCES).map(source => source.sourceId))
  return {
    planVersion: AGGREGATOR_PLAN_VERSION,
    checks: ids.map(sourceId => {
      const source = sourceById(sourceId)
      return {
        sourceId,
        title: source.title,
        sourceKind: source.sourceKind,
        intervalSeconds: source.settlementTier === 'source-of-truth' ? 60 : source.settlementTier === 'context-only' ? 180 : 300,
        checkType: source.sourceKind === 'manual' || source.sourceKind === 'evidence' ? 'qvac-lane-readiness' : 'server-side-auth-and-sample-request',
        blocksAutoSettlement: source.settlementTier === 'source-of-truth',
        requiredEnv: source.env.slice()
      }
    })
  }
}

function normalizeSportsDataRecord (input = {}) {
  const source = sourceById(input.sourceId)
  const entityType = input.entityType || input.type || 'event'
  if (!NORMALIZED_ENTITY_TYPES.includes(entityType)) {
    throw new RangeError(`entityType must be one of: ${NORMALIZED_ENTITY_TYPES.join(', ')}`)
  }
  const payload = cloneJson(input.payload || input.raw || {})
  const body = {
    sourceId: source.sourceId,
    providerId: source.providerId,
    entityType,
    externalId: input.externalId || input.id || payload.id || null,
    competitionId: input.competitionId || payload.competitionId || null,
    fixtureId: input.fixtureId || payload.fixtureId || null,
    participantIds: cloneJson(input.participantIds || payload.participantIds || []),
    occurredAt: input.occurredAt || payload.occurredAt || payload.startTime || null,
    status: input.status || payload.status || null,
    payload,
    evidence: {
      sourceUrl: input.sourceUrl || null,
      feedFrameId: input.feedFrameId || null,
      capturedAt: input.capturedAt || input.recordedAt || null
    },
    settlementTier: source.settlementTier
  }
  const payloadHash = hash32(body.payload)
  const recordHash = hash32({ ...body, payloadHash })

  return {
    recordId: input.recordId || stableId(`agg-${source.sourceId}-${entityType}`, {
      externalId: body.externalId,
      competitionId: body.competitionId,
      fixtureId: body.fixtureId,
      payloadHash
    }),
    ...body,
    payloadHash,
    recordHash,
    canAutoSettle: source.settlementTier === 'source-of-truth' && entityType === 'result',
    requiresQvacReview: source.settlementTier === 'evidence-review' || Boolean(input.requiresQvacReview)
  }
}

function createAggregatorIngestionPipeline () {
  return [
    { stepId: 'source-auth', owner: 'server', output: 'provider-scoped client with no client-exposed secrets' },
    { stepId: 'fetch-or-receive', owner: 'server', output: 'raw provider payload or evidence packet' },
    { stepId: 'normalize', owner: 'aggregator', output: 'normalized competition, fixture, result, event, stat, odds, telemetry, or evidence record' },
    { stepId: 'dedupe-and-map', owner: 'aggregator', output: 'canonical entrant, fixture, and participant IDs across sources' },
    { stepId: 'score-trust', owner: 'aggregator', output: 'source-of-truth, trusted-secondary, context-only, or evidence-review decision' },
    { stepId: 'publish-frame', owner: 'feed', output: 'feed frame, result snapshot, or QVAC evidence packet' },
    { stepId: 'settlement-gate', owner: 'settlement', output: 'auto-settle, wait-for-corroboration, or QVAC review' }
  ]
}

function routeTemplateForFit (fit, input = {}) {
  if (fit.fitId === 'mma-boxing-fight-card') {
    if (input.apiCoverage === false || input.apiCoverage === 'unavailable' || input.noOfficialApi === true) {
      return template('host-evidence-qvac', ['official-web-evidence', 'social-web-evidence'], ['the-odds-api-context'], [])
    }
    return template('sportsdataio-mma', ['sportradar-official'], ['the-odds-api-context'], ['official-web-evidence', 'social-web-evidence', 'host-evidence-qvac'])
  }
  if (fit.fitId === 'esports-major') {
    const titleSourceId = sourceForEsportsTitle(input.esportsTitle)
    const supplementSourceIds = titleSourceId === 'pandascore-esports'
      ? ['abios-esports']
      : ['pandascore-esports']
    return template(titleSourceId, supplementSourceIds, [], ['host-evidence-qvac'])
  }
  if (fit.fitId === 'sailgp-companion') {
    return template('sailgp-partner-feed', [], ['the-odds-api-context'], ['host-evidence-qvac', 'official-web-evidence'])
  }
  if (fit.category === 'creator' || fit.category === 'awards') {
    return template('host-evidence-qvac', ['official-web-evidence'], [], [])
  }
  if (fit.category === 'local') {
    return template('host-evidence-qvac', ['sportsdataio-global', 'official-web-evidence'], [], [])
  }
  if (['soccer', 'basketball', 'pro-sports', 'tennis'].includes(fit.category)) {
    return template('sportradar-official', ['sportsdataio-global', 'stats-perform-opta'], ['the-odds-api-context'], ['host-evidence-qvac'])
  }
  return template('host-evidence-qvac', ['official-web-evidence'], [], [])
}

function sourceForEsportsTitle (title) {
  const key = String(title || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return ESPORTS_TITLE_SOURCE_OVERRIDES[key] || 'pandascore-esports'
}

function template (primarySourceId, supplementSourceIds = [], contextSourceIds = [], fallbackSourceIds = []) {
  return {
    primarySourceId,
    supplementSourceIds,
    contextSourceIds,
    fallbackSourceIds
  }
}

function normalizedContractsForFit (fit) {
  const base = ['competition', 'event', 'fixture', 'participant', 'result']
  if (fit.category === 'sailing') return base.concat(['standing', 'telemetry', 'evidence'])
  if (fit.category === 'esports') return base.concat(['live-event', 'stat-line'])
  if (fit.category === 'combat-sports') return base.concat(['stat-line', 'odds-market', 'evidence'])
  if (fit.category === 'creator' || fit.category === 'awards' || fit.category === 'local') return ['event', 'fixture', 'participant', 'result', 'evidence']
  return base.concat(['standing', 'live-event', 'stat-line', 'odds-market'])
}

function settlementPolicyFor ({ fit, sourceChain }) {
  const sourceOfTruthIds = sourceChain
    .filter(source => source.settlementTier === 'source-of-truth')
    .map(source => source.sourceId)
  const autoSettlementSourceIds = fit.resultPolicy === 'host-entered' ? [] : sourceOfTruthIds
  const corroborationSourceIds = sourceChain
    .filter(source => source.settlementTier === 'trusted-secondary')
    .map(source => source.sourceId)
  const evidenceSourceIds = sourceChain
    .filter(source => source.settlementTier === 'evidence-review')
    .map(source => source.sourceId)
  const contextOnlySourceIds = sourceChain
    .filter(source => source.settlementTier === 'context-only')
    .map(source => source.sourceId)
  const hasQvacEvidenceLane = evidenceSourceIds.length > 0
  const prizeSettlementMode = autoSettlementSourceIds.length > 0
    ? 'auto-source-with-qvac-correction'
    : hasQvacEvidenceLane
      ? 'qvac-result-evidence'
      : 'unsupported'

  return {
    autoSettlementSourceIds,
    corroborationSourceIds,
    contextOnlySourceIds,
    evidenceSourceIds,
    prizeSettlementMode,
    prizeSettlementReady: prizeSettlementMode !== 'unsupported',
    requiresQvacForPrize: fit.resultPolicy !== 'official-feed' || evidenceSourceIds.length > 0,
    correctionLane: 'host-evidence-qvac',
    resultEvidenceContract: {
      lane: 'result-evidence',
      required: prizeSettlementMode === 'qvac-result-evidence',
      sourceIds: evidenceSourceIds,
      minimumCorroboratingSources: evidenceSourceIds.includes('social-web-evidence') ? 2 : 1,
      acceptsOfficialWeb: evidenceSourceIds.includes('official-web-evidence'),
      acceptsVerifiedSocialOrSearch: evidenceSourceIds.includes('social-web-evidence'),
      prizeSettlementRequiresReadyReview: hasQvacEvidenceLane
    },
    rule: fit.resultPolicy === 'official-feed'
      ? 'auto-settle from source-of-truth, with QVAC correction overlay on dispute'
      : fit.resultPolicy === 'hybrid'
        ? 'auto-settle only when partner source is present; otherwise require QVAC evidence'
        : 'host-entered result requires QVAC evidence before prize settlement'
  }
}

function requestPolicyFor ({ fit, primarySource }) {
  return {
    serverOnly: true,
    cacheKey: `fit:${fit.fitId}:source:${primarySource.sourceId}`,
    freshnessSeconds: fit.resultPolicy === 'official-feed' ? 30 : fit.resultPolicy === 'hybrid' ? 60 : 300,
    retry: {
      attempts: primarySource.settlementTier === 'source-of-truth' ? 3 : 1,
      backoff: 'exponential'
    },
    degradedMode: primarySource.settlementTier === 'source-of-truth'
      ? 'switch to supplement, then official web/social evidence with QVAC correction lane'
      : 'route directly to QVAC evidence lane'
  }
}

function coverageGapsFor (routes) {
  return routes
    .filter(route => route.settlement.autoSettlementSourceIds.length === 0 || route.fallbackOrder.length > 0)
    .map(route => ({
      fitId: route.fitId,
      primarySourceId: route.primarySourceId,
      gap: route.settlement.autoSettlementSourceIds.length === 0
        ? 'no automatic source-of-truth settlement'
        : 'has fallback path for unavailable or disputed data',
      fallbackOrder: route.fallbackOrder.slice()
    }))
}

function envVarsForSourceIds (sourceIds) {
  return unique(sourceIds.flatMap(sourceId => sourceById(sourceId).env)).sort()
}

function routeSourceView (source) {
  return {
    sourceId: source.sourceId,
    providerId: source.providerId,
    title: source.title,
    role: source.role,
    settlementTier: source.settlementTier,
    usage: source.usage,
    dataProducts: source.dataProducts.slice()
  }
}

function sourceById (sourceId) {
  const source = Object.values(AGGREGATOR_SOURCES).find(item => item.sourceId === sourceId)
  if (!source) throw new Error(`unknown sports data source: ${sourceId}`)
  return source
}

function unique (items) {
  return Array.from(new Set(items.filter(Boolean)))
}

function source (input) {
  return Object.freeze({
    sourceId: input.sourceId,
    providerId: input.providerId,
    title: input.title,
    role: input.role,
    sourceKind: input.sourceKind,
    coverage: Object.freeze(input.coverage.slice()),
    dataProducts: Object.freeze(input.dataProducts.slice()),
    normalizedTypes: Object.freeze(input.normalizedTypes.slice()),
    env: Object.freeze(input.env.slice()),
    auth: input.auth,
    settlementTier: input.settlementTier,
    usage: input.usage,
    notes: Object.freeze((input.notes || []).slice())
  })
}

module.exports = {
  AGGREGATOR_PLAN_VERSION,
  NORMALIZED_ENTITY_TYPES,
  AGGREGATOR_SOURCES,
  createSportsDataAggregatorPlan,
  aggregatorRouteForFit,
  createAggregatorHealthCheckPlan,
  normalizeSportsDataRecord
}
