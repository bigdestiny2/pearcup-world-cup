'use strict'

const aggregator = require('./sports-data-aggregator-engine')
const { cloneJson, stableId } = require('./util')

const SPORTS_DATA_CLIENT_PLAN_VERSION = 'ultimate-sports-data-client-plan-v1'

const CLIENT_DEFINITIONS = Object.freeze({
  'sportradar-official': clientDefinition({
    sourceId: 'sportradar-official',
    title: 'Sportradar official sports APIs client',
    clientKind: 'http-json',
    baseUrl: 'https://api.sportradar.com',
    baseUrlEnv: 'SPORTRADAR_BASE_URL',
    auth: {
      type: 'query',
      queryParam: 'api_key',
      env: ['SPORTRADAR_API_KEY']
    },
    requiredEnv: ['SPORTRADAR_API_KEY', 'SPORTRADAR_PRODUCT_CONFIG'],
    optionalEnv: ['SPORTRADAR_BASE_URL'],
    defaultParams: {
      sport: 'soccer',
      accessLevel: 'trial',
      version: 'v4',
      locale: 'en',
      format: 'json',
      resource: 'schedules'
    },
    operations: {
      'competition:list': requestTemplate('competition', '/{sport}/{accessLevel}/{version}/{locale}/competitions.{format}'),
      'fixture:list': requestTemplate('fixture', '/{sport}/{accessLevel}/{version}/{locale}/{resource}.{format}'),
      'event:list': requestTemplate('event', '/{sport}/{accessLevel}/{version}/{locale}/{resource}.{format}'),
      'result:get': requestTemplate('result', '/{sport}/{accessLevel}/{version}/{locale}/sport_events/{eventId}/summary.{format}'),
      'live-event:list': requestTemplate('live-event', '/{sport}/{accessLevel}/{version}/{locale}/sport_events/{eventId}/timeline.{format}'),
      'stat-line:list': requestTemplate('stat-line', '/{sport}/{accessLevel}/{version}/{locale}/sport_events/{eventId}/statistics.{format}'),
      'standing:list': requestTemplate('standing', '/{sport}/{accessLevel}/{version}/{locale}/seasons/{seasonId}/standings.{format}')
    }
  }),
  'sportsdataio-mma': clientDefinition({
    sourceId: 'sportsdataio-mma',
    title: 'SportsDataIO UFC / MMA client',
    clientKind: 'http-json',
    baseUrl: 'https://api.sportsdata.io/v3/mma',
    baseUrlEnv: 'SPORTSDATAIO_MMA_BASE_URL',
    auth: {
      type: 'header',
      header: 'Ocp-Apim-Subscription-Key',
      env: ['SPORTSDATAIO_MMA_API_KEY']
    },
    requiredEnv: ['SPORTSDATAIO_MMA_API_KEY'],
    optionalEnv: ['SPORTSDATAIO_MMA_BASE_URL'],
    defaultParams: {
      season: 'current'
    },
    operations: {
      'event:list': requestTemplate('event', '/scores/json/Schedule/{season}'),
      'fixture:list': requestTemplate('fixture', '/scores/json/Schedule/{season}'),
      'participant:list': requestTemplate('participant', '/scores/json/Fighters'),
      'result:get': requestTemplate('result', '/scores/json/Event/{eventId}'),
      'stat-line:list': requestTemplate('stat-line', '/stats/json/Fighter/{fighterId}')
    }
  }),
  'sportsdataio-global': clientDefinition({
    sourceId: 'sportsdataio-global',
    title: 'SportsDataIO league/global client',
    clientKind: 'http-json',
    baseUrl: 'https://api.sportsdata.io/v3',
    baseUrlEnv: 'SPORTSDATAIO_GLOBAL_BASE_URL',
    auth: {
      type: 'header',
      header: 'Ocp-Apim-Subscription-Key',
      env: ['SPORTSDATAIO_GLOBAL_API_KEY']
    },
    requiredEnv: ['SPORTSDATAIO_GLOBAL_API_KEY'],
    optionalEnv: ['SPORTSDATAIO_GLOBAL_BASE_URL'],
    defaultParams: {
      league: 'soccer',
      season: 'current'
    },
    operations: {
      'competition:list': requestTemplate('competition', '/{league}/scores/json/Competitions'),
      'fixture:list': requestTemplate('fixture', '/{league}/scores/json/Games/{season}'),
      'event:list': requestTemplate('event', '/{league}/scores/json/Games/{season}'),
      'result:get': requestTemplate('result', '/{league}/scores/json/Game/{eventId}'),
      'standing:list': requestTemplate('standing', '/{league}/scores/json/Standings/{season}'),
      'stat-line:list': requestTemplate('stat-line', '/{league}/stats/json/PlayerGameStatsByGame/{eventId}')
    }
  }),
  'pandascore-esports': clientDefinition({
    sourceId: 'pandascore-esports',
    title: 'PandaScore esports client',
    clientKind: 'http-json',
    baseUrl: 'https://api.pandascore.co',
    baseUrlEnv: 'PANDASCORE_BASE_URL',
    auth: {
      type: 'bearer',
      env: ['PANDASCORE_TOKEN']
    },
    requiredEnv: ['PANDASCORE_TOKEN'],
    optionalEnv: ['PANDASCORE_BASE_URL'],
    defaultParams: {
      gameSlug: 'lol'
    },
    operations: {
      'competition:list': requestTemplate('competition', '/tournaments'),
      'fixture:list': requestTemplate('fixture', '/matches/upcoming'),
      'event:list': requestTemplate('event', '/matches/upcoming'),
      'participant:list': requestTemplate('participant', '/teams'),
      'result:get': requestTemplate('result', '/matches/{matchId}'),
      'live-event:list': requestTemplate('live-event', '/matches/{matchId}/live'),
      'stat-line:list': requestTemplate('stat-line', '/matches/{matchId}/stats')
    }
  }),
  'abios-esports': clientDefinition({
    sourceId: 'abios-esports',
    title: 'Abios esports data client',
    clientKind: 'http-json',
    baseUrl: 'https://api.abiosgaming.com/v3',
    baseUrlEnv: 'ABIOS_BASE_URL',
    auth: {
      type: 'oauth-client-credentials',
      env: ['ABIOS_CLIENT_ID', 'ABIOS_CLIENT_SECRET']
    },
    requiredEnv: ['ABIOS_CLIENT_ID', 'ABIOS_CLIENT_SECRET'],
    optionalEnv: ['ABIOS_BASE_URL', 'ABIOS_ACCESS_TOKEN'],
    defaultParams: {
      game: 'rocket-league'
    },
    operations: {
      'competition:list': requestTemplate('competition', '/tournaments'),
      'fixture:list': requestTemplate('fixture', '/matches'),
      'event:list': requestTemplate('event', '/matches'),
      'participant:list': requestTemplate('participant', '/teams'),
      'result:get': requestTemplate('result', '/matches/{matchId}'),
      'live-event:list': requestTemplate('live-event', '/matches/{matchId}/live'),
      'stat-line:list': requestTemplate('stat-line', '/matches/{matchId}/statistics'),
      'odds-market:list': requestTemplate('odds-market', '/odds')
    }
  }),
  'the-odds-api-context': clientDefinition({
    sourceId: 'the-odds-api-context',
    title: 'The Odds API context client',
    clientKind: 'http-json',
    baseUrl: 'https://api.the-odds-api.com/v4',
    baseUrlEnv: 'ODDS_API_BASE_URL',
    auth: {
      type: 'query',
      queryParam: 'apiKey',
      env: ['ODDS_API_KEY']
    },
    requiredEnv: ['ODDS_API_KEY'],
    optionalEnv: ['ODDS_API_BASE_URL'],
    defaultParams: {
      sportKey: 'soccer_fifa_world_cup',
      regions: 'us',
      markets: 'h2h',
      oddsFormat: 'american'
    },
    operations: {
      'event:list': requestTemplate('event', '/sports/{sportKey}/events'),
      'fixture:list': requestTemplate('fixture', '/sports/{sportKey}/events'),
      'odds-market:list': requestTemplate('odds-market', '/sports/{sportKey}/odds', ['regions', 'markets', 'oddsFormat']),
      'result:get': requestTemplate('result', '/sports/{sportKey}/scores')
    }
  }),
  'sailgp-partner-feed': clientDefinition({
    sourceId: 'sailgp-partner-feed',
    title: 'SailGP partner-feed client',
    clientKind: 'http-json',
    baseUrl: null,
    baseUrlEnv: 'SAILGP_PARTNER_FEED_BASE_URL',
    auth: {
      type: 'header',
      header: 'Authorization',
      prefix: 'Bearer',
      env: ['SAILGP_PARTNER_FEED_KEY']
    },
    requiredEnv: ['SAILGP_PARTNER_FEED_KEY', 'SAILGP_PARTNER_FEED_BASE_URL'],
    optionalEnv: [],
    defaultParams: {
      season: 'current'
    },
    operations: {
      'competition:list': requestTemplate('competition', '/competitions'),
      'event:list': requestTemplate('event', '/events'),
      'fixture:list': requestTemplate('fixture', '/events/{eventId}/races'),
      'result:get': requestTemplate('result', '/events/{eventId}/results'),
      'standing:list': requestTemplate('standing', '/seasons/{season}/standings'),
      'telemetry:list': requestTemplate('telemetry', '/events/{eventId}/telemetry')
    }
  }),
  'stats-perform-opta': clientDefinition({
    sourceId: 'stats-perform-opta',
    title: 'Stats Perform / Opta evaluation client',
    clientKind: 'http-json',
    baseUrl: null,
    baseUrlEnv: 'STATSPERFORM_BASE_URL',
    auth: {
      type: 'header',
      header: 'Authorization',
      prefix: 'Bearer',
      env: ['STATSPERFORM_API_KEY']
    },
    requiredEnv: ['STATSPERFORM_API_KEY', 'STATSPERFORM_BASE_URL'],
    optionalEnv: [],
    defaultParams: {
      sport: 'soccer',
      version: 'v1',
      resource: 'fixtures'
    },
    operations: {
      'competition:list': requestTemplate('competition', '/{sport}/{version}/competitions'),
      'fixture:list': requestTemplate('fixture', '/{sport}/{version}/{resource}'),
      'event:list': requestTemplate('event', '/{sport}/{version}/{resource}'),
      'participant:list': requestTemplate('participant', '/{sport}/{version}/participants'),
      'result:get': requestTemplate('result', '/{sport}/{version}/events/{eventId}/result'),
      'standing:list': requestTemplate('standing', '/{sport}/{version}/standings'),
      'stat-line:list': requestTemplate('stat-line', '/{sport}/{version}/events/{eventId}/statistics')
    }
  }),
  'official-web-evidence': clientDefinition({
    sourceId: 'official-web-evidence',
    title: 'Official web evidence capture client',
    clientKind: 'evidence-packet',
    baseUrl: 'qvac://official-web-evidence',
    auth: { type: 'local-attestation', env: [] },
    requiredEnv: [],
    optionalEnv: [],
    defaultParams: {},
    operations: {
      'evidence:create': requestTemplate('evidence', '/captures'),
      'result:get': requestTemplate('result', '/captures/{evidenceId}')
    }
  }),
  'social-web-evidence': clientDefinition({
    sourceId: 'social-web-evidence',
    title: 'Social + web result evidence client',
    clientKind: 'evidence-packet',
    baseUrl: 'qvac://social-web-evidence',
    auth: { type: 'local-attestation', env: [] },
    requiredEnv: [],
    optionalEnv: [],
    defaultParams: {},
    operations: {
      'evidence:create': requestTemplate('evidence', '/captures'),
      'result:get': requestTemplate('result', '/captures/{evidenceId}')
    }
  }),
  'host-evidence-qvac': clientDefinition({
    sourceId: 'host-evidence-qvac',
    title: 'Host evidence + QVAC referee client',
    clientKind: 'qvac-local',
    baseUrl: 'qvac://host-evidence-qvac',
    auth: { type: 'local-attestation', env: [] },
    requiredEnv: [],
    optionalEnv: [],
    defaultParams: {},
    operations: {
      'evidence:create': requestTemplate('evidence', '/evidence'),
      'result:get': requestTemplate('result', '/results/{evidenceId}')
    }
  })
})

function createSportsDataClientPlan ({ env = defaultEnv() } = {}) {
  const sources = Object.values(aggregator.AGGREGATOR_SOURCES)
  const clients = sources.map(source => {
    const client = sourceClientFor(source.sourceId)
    const readiness = credentialReadinessForClient(client, env)
    return {
      sourceId: source.sourceId,
      providerId: source.providerId,
      title: client.title,
      sourceKind: source.sourceKind,
      clientKind: client.clientKind,
      settlementTier: source.settlementTier,
      serverOnly: true,
      requestBuilderAvailable: true,
      readyForLiveRequests: client.clientKind === 'http-json' && readiness.ready,
      localEvidenceLane: client.clientKind !== 'http-json',
      requiredEnv: client.requiredEnv.slice(),
      optionalEnv: client.optionalEnv.slice(),
      missingEnv: readiness.missingEnv,
      presentEnv: readiness.presentEnv,
      operations: Object.keys(client.operations)
    }
  })
  const apiClients = clients.filter(client => client.clientKind === 'http-json')

  return {
    planVersion: SPORTS_DATA_CLIENT_PLAN_VERSION,
    serverOnly: true,
    noClientSecrets: true,
    coverage: {
      totalSources: clients.length,
      sourcesWithClients: clients.filter(client => client.requestBuilderAvailable).length,
      apiSourceCount: apiClients.length,
      apiClientsWithRequestBuilders: apiClients.filter(client => client.requestBuilderAvailable).length,
      readyApiClients: apiClients.filter(client => client.readyForLiveRequests).length,
      localEvidenceClients: clients.filter(client => client.localEvidenceLane).length
    },
    envVars: unique(clients.flatMap(client => client.requiredEnv.concat(client.optionalEnv))).sort(),
    clients,
    liveReadiness: {
      readySourceIds: apiClients.filter(client => client.readyForLiveRequests).map(client => client.sourceId),
      missingBySource: Object.fromEntries(apiClients
        .filter(client => client.missingEnv.length > 0)
        .map(client => [client.sourceId, client.missingEnv.slice()]))
    },
    requestExamples: clients.map(client => createSportsDataRequestPlan({
      sourceId: client.sourceId,
      entityType: exampleEntityTypeFor(client.operations),
      env,
      params: exampleParamsFor(client.sourceId)
    }))
  }
}

function sourceClientFor (sourceId) {
  const client = CLIENT_DEFINITIONS[sourceId]
  if (!client) throw new Error(`unknown sports data client source: ${sourceId}`)
  return cloneClient(client)
}

function credentialReadinessForSource (sourceId, env = defaultEnv()) {
  return credentialReadinessForClient(sourceClientFor(sourceId), env)
}

function createSportsDataRequestPlan ({
  fitId = null,
  sourceId = null,
  entityType = 'fixture',
  operation = null,
  params = {},
  env = defaultEnv(),
  includeSecretValues = false
} = {}) {
  const route = fitId ? aggregator.aggregatorRouteForFit(fitId) : null
  const resolvedSourceId = sourceId || route && route.primarySourceId
  if (!resolvedSourceId) throw new TypeError('sourceId or fitId is required')
  const source = sourceById(resolvedSourceId)
  const client = sourceClientFor(resolvedSourceId)
  const resolvedOperation = operation || operationForEntityType(client, entityType)
  const template = client.operations[resolvedOperation]
  if (!template) {
    throw new Error(`client ${resolvedSourceId} does not support operation ${resolvedOperation}`)
  }
  const mergedParams = {
    ...client.defaultParams,
    ...params
  }
  const readiness = credentialReadinessForClient(client, env)
  const path = interpolatePath(template.pathTemplate, mergedParams)
  const baseUrl = resolvedBaseUrl(client, env)
  const query = queryFor({ client, template, params: mergedParams, env, includeSecretValues })
  const url = buildUrl({ baseUrl, path, query, clientKind: client.clientKind })
  const headers = headersFor({ client, env, includeSecretValues })
  const missingParams = missingPathParams(template.pathTemplate, mergedParams)

  return {
    requestId: stableId(`sports-data-request-${resolvedSourceId}`, {
      fitId,
      sourceId: resolvedSourceId,
      entityType: template.entityType,
      operation: resolvedOperation,
      path,
      query: Object.keys(query).sort()
    }),
    fitId,
    routeId: route ? route.routeId : null,
    sourceId: resolvedSourceId,
    providerId: source.providerId,
    sourceKind: source.sourceKind,
    settlementTier: source.settlementTier,
    clientKind: client.clientKind,
    serverOnly: true,
    method: template.method,
    operation: resolvedOperation,
    entityType: template.entityType,
    url,
    baseUrl,
    path,
    query,
    headers,
    requiredEnv: client.requiredEnv.slice(),
    missingEnv: readiness.missingEnv,
    missingParams,
    ready: readiness.ready && missingParams.length === 0,
    redacted: !includeSecretValues,
    canAutoSettleCandidate: source.settlementTier === 'source-of-truth' && template.entityType === 'result',
    fallbackOrder: route ? route.fallbackOrder.slice() : [],
    cache: {
      key: `source:${resolvedSourceId}:operation:${resolvedOperation}:fit:${fitId || 'direct'}`,
      freshnessSeconds: freshnessSecondsFor(source, template.entityType)
    }
  }
}

async function executeSportsDataRequest ({
  requestPlan,
  fetchImpl,
  normalize = true
} = {}) {
  if (!requestPlan || typeof requestPlan !== 'object') throw new TypeError('requestPlan is required')
  if (requestPlan.clientKind !== 'http-json') {
    return {
      requestId: requestPlan.requestId,
      sourceId: requestPlan.sourceId,
      status: 'local-evidence-lane',
      ok: true,
      records: [],
      body: null
    }
  }
  if (!requestPlan.ready) {
    throw new Error(`request is not ready: missing ${requestPlan.missingEnv.concat(requestPlan.missingParams).join(', ')}`)
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required for HTTP sports data requests')

  const response = await fetchImpl(requestPlan.url, {
    method: requestPlan.method,
    headers: requestPlan.headers
  })
  const body = response && typeof response.json === 'function' ? await response.json() : null
  const rows = Array.isArray(body) ? body : body && Array.isArray(body.items) ? body.items : body == null ? [] : [body]

  return {
    requestId: requestPlan.requestId,
    sourceId: requestPlan.sourceId,
    status: response && typeof response.status === 'number' ? response.status : 200,
    ok: response && typeof response.ok === 'boolean' ? response.ok : true,
    body,
    records: normalize
      ? rows.map((row, index) => aggregator.normalizeSportsDataRecord({
          sourceId: requestPlan.sourceId,
          entityType: requestPlan.entityType,
          externalId: row.id || row.eventId || row.matchId || `${requestPlan.requestId}:${index}`,
          payload: row
        }))
      : []
  }
}

function credentialReadinessForClient (client, env) {
  const presentEnv = client.requiredEnv.filter(name => hasEnv(env, name))
  const missingEnv = client.requiredEnv.filter(name => !hasEnv(env, name))
  return {
    sourceId: client.sourceId,
    ready: missingEnv.length === 0,
    presentEnv,
    missingEnv,
    authType: client.auth.type,
    clientKind: client.clientKind
  }
}

function operationForEntityType (client, entityType) {
  const preferred = [
    `${entityType}:list`,
    `${entityType}:get`,
    entityType === 'result' ? 'result:get' : null,
    entityType === 'evidence' ? 'evidence:create' : null,
    'fixture:list',
    'event:list'
  ].filter(Boolean)
  return preferred.find(operation => client.operations[operation]) || Object.keys(client.operations)[0]
}

function queryFor ({ client, template, params, env, includeSecretValues }) {
  const query = {}
  ;(template.queryParams || []).forEach(name => {
    if (params[name] != null) query[name] = String(params[name])
  })
  if (client.auth.type === 'query') {
    query[client.auth.queryParam] = secretValue(client.auth.env[0], env, includeSecretValues)
  }
  return query
}

function headersFor ({ client, env, includeSecretValues }) {
  const headers = {
    Accept: 'application/json'
  }
  if (client.auth.type === 'header') {
    const value = secretValue(client.auth.env[0], env, includeSecretValues)
    headers[client.auth.header] = client.auth.prefix ? `${client.auth.prefix} ${value}` : value
  }
  if (client.auth.type === 'bearer') {
    headers.Authorization = `Bearer ${secretValue(client.auth.env[0], env, includeSecretValues)}`
  }
  if (client.auth.type === 'oauth-client-credentials') {
    headers.Authorization = hasEnv(env, 'ABIOS_ACCESS_TOKEN')
      ? `Bearer ${secretValue('ABIOS_ACCESS_TOKEN', env, includeSecretValues)}`
      : 'Bearer <oauth-client-credentials-token>'
  }
  return headers
}

function secretValue (name, env, includeSecretValues) {
  if (includeSecretValues && hasEnv(env, name)) return String(env[name])
  return `<redacted:${name}>`
}

function resolvedBaseUrl (client, env) {
  if (client.baseUrlEnv && hasEnv(env, client.baseUrlEnv)) return stripTrailingSlash(String(env[client.baseUrlEnv]))
  if (client.baseUrl) return stripTrailingSlash(client.baseUrl)
  return `<required:${client.baseUrlEnv}>`
}

function buildUrl ({ baseUrl, path, query, clientKind }) {
  if (clientKind !== 'http-json') return `${baseUrl}${path}`
  const queryString = Object.entries(query)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`
}

function interpolatePath (pathTemplate, params) {
  return pathTemplate.replace(/\{([^}]+)\}/g, (_, key) => {
    if (params[key] == null || params[key] === '') return `{${key}}`
    return encodeURIComponent(String(params[key]))
  })
}

function missingPathParams (pathTemplate, params) {
  const missing = []
  pathTemplate.replace(/\{([^}]+)\}/g, (_, key) => {
    if (params[key] == null || params[key] === '') missing.push(key)
    return ''
  })
  return missing
}

function freshnessSecondsFor (source, entityType) {
  if (entityType === 'live-event') return 10
  if (source.settlementTier === 'source-of-truth') return 30
  if (source.settlementTier === 'context-only') return 180
  return 300
}

function sourceById (sourceId) {
  const source = Object.values(aggregator.AGGREGATOR_SOURCES).find(item => item.sourceId === sourceId)
  if (!source) throw new Error(`unknown sports data source: ${sourceId}`)
  return source
}

function exampleEntityTypeFor (operations) {
  if (operations.includes('fixture:list')) return 'fixture'
  if (operations.includes('evidence:create')) return 'evidence'
  return 'event'
}

function exampleParamsFor (sourceId) {
  if (sourceId === 'sportradar-official') return { eventId: 'demo-event', seasonId: 'demo-season' }
  if (sourceId === 'sportsdataio-mma') return { eventId: 'demo-event', fighterId: 'demo-fighter' }
  if (sourceId === 'sportsdataio-global') return { eventId: 'demo-event', league: 'soccer', season: 'current' }
  if (sourceId === 'pandascore-esports' || sourceId === 'abios-esports') return { matchId: 'demo-match' }
  if (sourceId === 'the-odds-api-context') return { sportKey: 'soccer_fifa_world_cup' }
  if (sourceId === 'sailgp-partner-feed') return { eventId: 'demo-event', season: 'current' }
  if (sourceId === 'stats-perform-opta') return { eventId: 'demo-event', sport: 'soccer', resource: 'fixtures' }
  return { evidenceId: 'demo-evidence' }
}

function hasEnv (env, name) {
  return Object.prototype.hasOwnProperty.call(env || {}, name) && String(env[name] || '').trim() !== ''
}

function stripTrailingSlash (value) {
  return String(value || '').replace(/\/+$/, '')
}

function unique (items) {
  return Array.from(new Set(items.filter(Boolean)))
}

function cloneClient (client) {
  return cloneJson(client)
}

function requestTemplate (entityType, pathTemplate, queryParams = []) {
  return Object.freeze({
    method: 'GET',
    entityType,
    pathTemplate,
    queryParams: Object.freeze(queryParams.slice())
  })
}

function clientDefinition (input) {
  return Object.freeze({
    sourceId: input.sourceId,
    title: input.title,
    clientKind: input.clientKind,
    baseUrl: input.baseUrl,
    baseUrlEnv: input.baseUrlEnv || null,
    auth: Object.freeze(cloneJson(input.auth)),
    requiredEnv: Object.freeze((input.requiredEnv || []).slice()),
    optionalEnv: Object.freeze((input.optionalEnv || []).slice()),
    defaultParams: Object.freeze(cloneJson(input.defaultParams || {})),
    operations: Object.freeze(Object.fromEntries(Object.entries(input.operations || {}).map(([key, value]) => [key, value])))
  })
}

function defaultEnv () {
  return typeof process !== 'undefined' && process && process.env ? process.env : {}
}

module.exports = {
  SPORTS_DATA_CLIENT_PLAN_VERSION,
  CLIENT_DEFINITIONS,
  createSportsDataClientPlan,
  sourceClientFor,
  credentialReadinessForSource,
  createSportsDataRequestPlan,
  executeSportsDataRequest
}
