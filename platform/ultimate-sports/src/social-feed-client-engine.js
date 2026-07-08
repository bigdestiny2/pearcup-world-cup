'use strict'

const aggregator = require('./social-feed-aggregator-engine')
const providers = require('./social-feed-provider-engine')
const { cloneJson, stableId } = require('./util')

const SOCIAL_FEED_CLIENT_PLAN_VERSION = 'ultimate-sports-social-feed-client-plan-v1'

const SETTLEMENT_TIER = providers.SETTLEMENT_TIER

const CLIENT_DEFINITIONS = Object.freeze({
  'nostr-relays': clientDefinition({
    sourceId: 'nostr-relays',
    title: 'Nostr relay WebSocket client',
    clientKind: 'websocket-relay',
    transport: 'ws',
    auth: { type: 'none', env: [] },
    requiredEnv: [],
    optionalEnv: ['NOSTR_DEFAULT_RELAYS'],
    defaultParams: {
      relays: ['wss://relay.damus.io', 'wss://nostr.wine', 'wss://relay.snort.social'],
      kinds: [1, 6],
      limit: 100
    },
    operations: {
      'social-post:subscribe': subscriptionTemplate('social-post', ['hashtags', 'pubkeys', 'kinds', 'since', 'limit']),
      'social-post:list': subscriptionTemplate('social-post', ['hashtags', 'pubkeys', 'limit'])
    }
  }),
  'bluesky-atproto': clientDefinition({
    sourceId: 'bluesky-atproto',
    title: 'Bluesky / AT Protocol HTTP client',
    clientKind: 'http-json',
    baseUrl: 'https://bsky.social',
    baseUrlEnv: 'BLUESKY_BASE_URL',
    auth: {
      type: 'app-password',
      env: ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD']
    },
    requiredEnv: ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'],
    optionalEnv: ['BLUESKY_BASE_URL', 'BLUESKY_ACCESS_TOKEN'],
    defaultParams: {
      collection: 'app.bsky.feed.post'
    },
    operations: {
      'social-post:list': requestTemplate('social-post', '/xrpc/app.bsky.feed.searchPosts', ['q', 'limit', 'cursor']),
      'social-post:get': requestTemplate('social-post', '/xrpc/com.atproto.repo.getRecord', ['repo', 'collection', 'rkey'])
    }
  }),
  'mastodon-instances': clientDefinition({
    sourceId: 'mastodon-instances',
    title: 'Mastodon / ActivityPub HTTP client',
    clientKind: 'http-json',
    baseUrl: 'https://mastodon.social',
    baseUrlEnv: 'MASTODON_BASE_URL',
    auth: {
      type: 'bearer-optional',
      env: ['MASTODON_ACCESS_TOKEN']
    },
    requiredEnv: [],
    optionalEnv: ['MASTODON_INSTANCE', 'MASTODON_BASE_URL', 'MASTODON_ACCESS_TOKEN'],
    defaultParams: {
      limit: 40
    },
    operations: {
      'social-post:list': requestTemplate('social-post', '/api/v1/timelines/tag/{tag}', ['limit']),
      'social-post:get': requestTemplate('social-post', '/api/v1/statuses/{statusId}', [])
    }
  }),
  'native-activity': clientDefinition({
    sourceId: 'native-activity',
    title: 'Native P2P activity feed client',
    clientKind: 'in-app-bridge',
    auth: { type: 'none', env: [] },
    requiredEnv: [],
    optionalEnv: [],
    defaultParams: {
      shareCardTypes: ['pool-win', 'game-win', 'streak', 'bracket', 'duel', 'room-highlight']
    },
    operations: {
      'social-post:list': requestTemplate('social-post', '/bridge/native-activity', ['limit'])
    }
  }),
  'relay-mainstream': clientDefinition({
    sourceId: 'relay-mainstream',
    title: 'Mainstream relay gateway client (deferred)',
    clientKind: 'http-json',
    baseUrl: null,
    baseUrlEnv: 'MAINSTREAM_RELAY_BASE_URL',
    auth: {
      type: 'server-side-keys',
      env: ['MAINSTREAM_RELAY_API_KEY']
    },
    requiredEnv: ['MAINSTREAM_RELAY_API_KEY', 'MAINSTREAM_RELAY_BASE_URL'],
    optionalEnv: [],
    defaultParams: {},
    operations: {
      'social-post:list': requestTemplate('social-post', '/v1/feed', ['platform', 'limit'])
    }
  })
})

function createSocialFeedClientPlan ({ env = defaultEnv() } = {}) {
  const sources = Object.values(providers.SOURCES)
  const clients = sources.map(source => {
    const client = sourceClientFor(source.sourceId)
    const readiness = credentialReadinessForClient(client, env)
    const isWebsocket = client.clientKind === 'websocket-relay'
    const isHttp = client.clientKind === 'http-json'
    const isLocal = client.clientKind === 'in-app-bridge'
    return {
      sourceId: source.sourceId,
      protocol: source.protocol,
      title: client.title,
      clientKind: client.clientKind,
      settlementTier: source.settlementTier,
      deferred: source.deferred,
      keyless: source.keyless,
      serverOnly: !isLocal,
      noClientSecrets: true,
      requestBuilderAvailable: true,
      readyForLiveRequests: (isHttp || isWebsocket) && readiness.ready,
      localActivityLane: isLocal,
      requiredEnv: client.requiredEnv.slice(),
      optionalEnv: client.optionalEnv.slice(),
      missingEnv: readiness.missingEnv,
      presentEnv: readiness.presentEnv,
      operations: Object.keys(client.operations)
    }
  })
  const apiClients = clients.filter(client => client.clientKind === 'http-json' || client.clientKind === 'websocket-relay')

  return {
    planVersion: SOCIAL_FEED_CLIENT_PLAN_VERSION,
    serverOnly: true,
    noClientSecrets: true,
    noSettlement: true,
    coverage: {
      totalSources: clients.length,
      sourcesWithClients: clients.filter(client => client.requestBuilderAvailable).length,
      apiSourceCount: apiClients.length,
      apiClientsWithRequestBuilders: apiClients.filter(client => client.requestBuilderAvailable).length,
      readyApiClients: apiClients.filter(client => client.readyForLiveRequests).length,
      localActivityClients: clients.filter(client => client.localActivityLane).length,
      websocketClients: clients.filter(client => client.clientKind === 'websocket-relay').length
    },
    envVars: unique(clients.flatMap(client => client.requiredEnv.concat(client.optionalEnv))).sort(),
    clients,
    liveReadiness: {
      readySourceIds: apiClients.filter(client => client.readyForLiveRequests).map(client => client.sourceId),
      missingBySource: Object.fromEntries(apiClients
        .filter(client => client.missingEnv.length > 0)
        .map(client => [client.sourceId, client.missingEnv.slice()]))
    },
    requestExamples: clients.map(client => createSocialFeedRequestPlan({
      sourceId: client.sourceId,
      operation: exampleOperationFor(client.operations),
      env,
      params: exampleParamsFor(client.sourceId)
    }))
  }
}

function sourceClientFor (sourceId) {
  const client = CLIENT_DEFINITIONS[sourceId]
  if (!client) throw new Error(`unknown social-feed client source: ${sourceId}`)
  return cloneJson(client)
}

function credentialReadinessForSource (sourceId, env = defaultEnv()) {
  return credentialReadinessForClient(sourceClientFor(sourceId), env)
}

function createSocialFeedRequestPlan ({
  fitId = null,
  sourceId = null,
  operation = null,
  params = {},
  env = defaultEnv(),
  includeSecretValues = false
} = {}) {
  const route = fitId ? aggregator.aggregatorRouteForFit(fitId) : null
  const resolvedSourceId = sourceId || (route && route.primarySourceId)
  if (!resolvedSourceId) throw new TypeError('sourceId or fitId is required')
  const source = sourceById(resolvedSourceId)
  const client = sourceClientFor(resolvedSourceId)
  const resolvedOperation = operation || operationForClient(client)
  const template = client.operations[resolvedOperation]
  if (!template) {
    throw new Error(`client ${resolvedSourceId} does not support operation ${resolvedOperation}`)
  }
  const mergedParams = { ...client.defaultParams, ...params }
  const readiness = credentialReadinessForClient(client, env)

  if (client.clientKind === 'websocket-relay') {
    return buildSubscriptionPlan({
      sourceId: resolvedSourceId,
      source,
      client,
      template,
      route,
      fitId,
      operation: resolvedOperation,
      params: mergedParams,
      env,
      includeSecretValues,
      readiness
    })
  }

  if (client.clientKind === 'in-app-bridge') {
    return buildBridgePlan({
      sourceId: resolvedSourceId,
      source,
      client,
      template,
      route,
      fitId,
      operation: resolvedOperation,
      params: mergedParams,
      readiness
    })
  }

  return buildHttpPlan({
    sourceId: resolvedSourceId,
    source,
    client,
    template,
    route,
    fitId,
    operation: resolvedOperation,
    params: mergedParams,
    env,
    includeSecretValues,
    readiness
  })
}

function buildSubscriptionPlan ({
  sourceId,
  source,
  client,
  template,
  route,
  fitId,
  operation,
  params,
  env,
  includeSecretValues,
  readiness
}) {
  const relays = resolveRelays(params, env)
  const filters = resolveNostrFilters({ template, params, route })
  const subscriptionId = stableId(`nostr-sub-${sourceId}`, { relays, filters, fitId })

  return {
    requestId: stableId(`social-feed-request-${sourceId}`, {
      fitId,
      sourceId,
      operation,
      relays,
      filterKeys: Object.keys(filters).sort()
    }),
    subscriptionId,
    fitId,
    routeId: route ? route.routeId : null,
    sourceId,
    protocol: source.protocol,
    settlementTier: source.settlementTier,
    clientKind: client.clientKind,
    serverOnly: true,
    operation,
    entityType: template.entityType,
    relays,
    filters,
    requiredEnv: client.requiredEnv.slice(),
    missingEnv: readiness.missingEnv,
    ready: readiness.ready && relays.length > 0,
    redacted: !includeSecretValues,
    canSettleCandidate: false,
    fallbackOrder: route ? [] : [],
    cache: {
      key: `source:${sourceId}:operation:${operation}:fit:${fitId || 'direct'}`,
      freshnessSeconds: 30
    }
  }
}

function buildBridgePlan ({
  sourceId,
  source,
  client,
  template,
  route,
  fitId,
  operation,
  params,
  readiness
}) {
  return {
    requestId: stableId(`social-feed-request-${sourceId}`, {
      fitId,
      sourceId,
      operation
    }),
    fitId,
    routeId: route ? route.routeId : null,
    sourceId,
    protocol: source.protocol,
    settlementTier: source.settlementTier,
    clientKind: client.clientKind,
    serverOnly: false,
    operation,
    entityType: template.entityType,
    bridgeEndpoint: template.pathTemplate,
    params: cloneJson(params),
    requiredEnv: client.requiredEnv.slice(),
    missingEnv: readiness.missingEnv,
    ready: readiness.ready,
    redacted: true,
    canSettleCandidate: false,
    fallbackOrder: [],
    cache: {
      key: `source:${sourceId}:operation:${operation}:fit:${fitId || 'direct'}`,
      freshnessSeconds: 30
    }
  }
}

function buildHttpPlan ({
  sourceId,
  source,
  client,
  template,
  route,
  fitId,
  operation,
  params,
  env,
  includeSecretValues,
  readiness
}) {
  const path = interpolatePath(template.pathTemplate, params)
  const baseUrl = resolvedBaseUrl(client, env)
  const query = queryFor({ client, template, params, env, includeSecretValues })
  const url = buildUrl({ baseUrl, path, query })
  const headers = headersFor({ client, env, includeSecretValues })
  const missingParams = missingPathParams(template.pathTemplate, params)

  return {
    requestId: stableId(`social-feed-request-${sourceId}`, {
      fitId,
      sourceId,
      operation,
      path,
      query: Object.keys(query).sort()
    }),
    fitId,
    routeId: route ? route.routeId : null,
    sourceId,
    protocol: source.protocol,
    settlementTier: source.settlementTier,
    clientKind: client.clientKind,
    serverOnly: true,
    method: template.method,
    operation,
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
    canSettleCandidate: false,
    fallbackOrder: route ? [] : [],
    cache: {
      key: `source:${sourceId}:operation:${operation}:fit:${fitId || 'direct'}`,
      freshnessSeconds: 30
    }
  }
}

async function executeSocialFeedRequest ({
  requestPlan,
  fetchImpl,
  wsImpl,
  normalize = true
} = {}) {
  if (!requestPlan || typeof requestPlan !== 'object') throw new TypeError('requestPlan is required')

  if (requestPlan.clientKind === 'in-app-bridge') {
    return {
      requestId: requestPlan.requestId,
      sourceId: requestPlan.sourceId,
      status: 'local-activity-lane',
      ok: true,
      posts: [],
      body: null
    }
  }

  if (requestPlan.clientKind === 'websocket-relay') {
    if (typeof wsImpl !== 'function') throw new TypeError('wsImpl is required for Nostr relay subscriptions')
    if (!requestPlan.ready) {
      throw new Error(`request is not ready: missing ${requestPlan.missingEnv.join(', ')}`)
    }
    const rawEvents = await wsImpl({
      relays: requestPlan.relays,
      filters: requestPlan.filters,
      subscriptionId: requestPlan.subscriptionId
    })
    const rows = Array.isArray(rawEvents) ? rawEvents : rawEvents && Array.isArray(rawEvents.events) ? rawEvents.events : []
    return {
      requestId: requestPlan.requestId,
      sourceId: requestPlan.sourceId,
      status: 'subscribed',
      ok: true,
      posts: normalize
        ? rows.map(row => aggregator.normalizeSocialPost({
            sourceId: requestPlan.sourceId,
            externalId: row.id || row.eventId || null,
            text: row.content || row.text || '',
            author: row.pubkey ? { pubkeyOrDid: row.pubkey } : (row.author || null),
            createdAt: row.created_at || row.createdAt || null,
            payload: row
          }))
        : []
    }
  }

  if (requestPlan.clientKind === 'http-json') {
    if (!requestPlan.ready) {
      throw new Error(`request is not ready: missing ${requestPlan.missingEnv.concat(requestPlan.missingParams).join(', ')}`)
    }
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required for HTTP social feed requests')

    const response = await fetchImpl(requestPlan.url, {
      method: requestPlan.method,
      headers: requestPlan.headers
    })
    const body = response && typeof response.json === 'function' ? await response.json() : null
    const rows = Array.isArray(body) ? body
      : body && Array.isArray(body.items) ? body.items
      : body && Array.isArray(body.posts) ? body.posts
      : body == null ? []
      : [body]

    return {
      requestId: requestPlan.requestId,
      sourceId: requestPlan.sourceId,
      status: response && typeof response.status === 'number' ? response.status : 200,
      ok: response && typeof response.ok === 'boolean' ? response.ok : true,
      body,
      posts: normalize
        ? rows.map(row => aggregator.normalizeSocialPost(normalizeRowForSource(requestPlan.sourceId, row)))
        : []
    }
  }

  throw new Error(`unsupported client kind: ${requestPlan.clientKind}`)
}

function normalizeRowForSource (sourceId, row) {
  if (sourceId === 'bluesky-atproto') {
    const record = row.record || row.value || row
    return {
      sourceId,
      externalId: row.uri || row.cid || row.id || null,
      text: record.text || row.text || '',
      author: row.author ? {
        handle: row.author.handle,
        displayName: row.author.displayName,
        avatarRef: row.author.avatar,
        verified: Boolean(row.author.verified)
      } : null,
      createdAt: record.createdAt || row.indexedAt || null,
      payload: row
    }
  }
  if (sourceId === 'mastodon-instances') {
    return {
      sourceId,
      externalId: row.id || null,
      text: row.content || '',
      author: row.account ? {
        handle: row.account.acct || row.account.username,
        displayName: row.account.display_name,
        avatarRef: row.account.avatar,
        verified: Boolean(row.account.verified)
      } : null,
      createdAt: row.created_at || null,
      mediaRefs: (row.media_attachments || []).map(att => ({ kind: att.type, url: att.url, previewRef: att.preview_url })),
      payload: row
    }
  }
  return {
    sourceId,
    externalId: row.id || row.postId || null,
    text: row.text || row.content || '',
    author: row.author || null,
    createdAt: row.createdAt || null,
    payload: row
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

function operationForClient (client) {
  const preferred = ['social-post:list', 'social-post:subscribe', 'social-post:get']
  return preferred.find(operation => client.operations[operation]) || Object.keys(client.operations)[0]
}

function resolveRelays (params, env) {
  if (params.relays && params.relays.length) return params.relays.slice()
  if (hasEnv(env, 'NOSTR_DEFAULT_RELAYS')) {
    return String(env.NOSTR_DEFAULT_RELAYS).split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

function resolveNostrFilters ({ template, params, route }) {
  const filterKeys = template.filters || ['hashtags', 'pubkeys', 'kinds', 'limit']
  const filters = {}
  if (filterKeys.includes('hashtags')) {
    const tags = params.hashtags || (route ? route.seedTags : [])
    if (tags.length) filters.hashtags = tags.slice()
  }
  if (filterKeys.includes('pubkeys')) {
    const pubkeys = params.pubkeys || (route ? route.seedAuthors : [])
    if (pubkeys.length) filters.pubkeys = pubkeys.slice()
  }
  if (filterKeys.includes('kinds')) {
    filters.kinds = params.kinds || [1, 6]
  }
  if (filterKeys.includes('since')) {
    if (params.since) filters.since = params.since
  }
  if (filterKeys.includes('limit')) {
    filters.limit = params.limit || 100
  }
  return filters
}

function queryFor ({ client, template, params, env, includeSecretValues }) {
  const query = {}
  ;(template.queryParams || []).forEach(name => {
    if (params[name] != null) query[name] = String(params[name])
  })
  if (client.auth.type === 'bearer-optional' && hasEnv(env, 'MASTODON_ACCESS_TOKEN')) {
    query.access_token = secretValue('MASTODON_ACCESS_TOKEN', env, includeSecretValues)
  }
  return query
}

function headersFor ({ client, env, includeSecretValues }) {
  const headers = { Accept: 'application/json' }
  if (client.auth.type === 'app-password') {
    if (hasEnv(env, 'BLUESKY_ACCESS_TOKEN')) {
      headers.Authorization = `Bearer ${secretValue('BLUESKY_ACCESS_TOKEN', env, includeSecretValues)}`
    } else {
      headers['Bluesky-Handle'] = secretValue('BLUESKY_HANDLE', env, includeSecretValues)
      headers['Bluesky-App-Password'] = secretValue('BLUESKY_APP_PASSWORD', env, includeSecretValues)
    }
  }
  if (client.auth.type === 'bearer-optional' && hasEnv(env, 'MASTODON_ACCESS_TOKEN')) {
    headers.Authorization = `Bearer ${secretValue('MASTODON_ACCESS_TOKEN', env, includeSecretValues)}`
  }
  if (client.auth.type === 'server-side-keys') {
    headers.Authorization = `Bearer ${secretValue(client.auth.env[0], env, includeSecretValues)}`
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

function buildUrl ({ baseUrl, path, query }) {
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

function sourceById (sourceId) {
  const source = Object.values(providers.SOURCES).find(item => item.sourceId === sourceId)
  if (!source) throw new Error(`unknown social-feed source: ${sourceId}`)
  return source
}

function exampleOperationFor (operations) {
  if (operations.includes('social-post:subscribe')) return 'social-post:subscribe'
  if (operations.includes('social-post:list')) return 'social-post:list'
  return operations[0]
}

function exampleParamsFor (sourceId) {
  if (sourceId === 'nostr-relays') return { hashtags: ['#worldcup'], relays: ['wss://relay.damus.io'] }
  if (sourceId === 'bluesky-atproto') return { q: 'world cup', limit: 20 }
  if (sourceId === 'mastodon-instances') return { tag: 'worldcup', limit: 20 }
  if (sourceId === 'relay-mainstream') return { platform: 'x', limit: 20 }
  return { limit: 20 }
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

function requestTemplate (entityType, pathTemplate, queryParams = []) {
  return Object.freeze({
    method: 'GET',
    entityType,
    pathTemplate,
    queryParams: Object.freeze(queryParams.slice())
  })
}

function subscriptionTemplate (entityType, filters = []) {
  return Object.freeze({
    method: 'SUBSCRIBE',
    entityType,
    filters: Object.freeze(filters.slice())
  })
}

function clientDefinition (input) {
  return Object.freeze({
    sourceId: input.sourceId,
    title: input.title,
    clientKind: input.clientKind,
    baseUrl: input.baseUrl || null,
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
  SOCIAL_FEED_CLIENT_PLAN_VERSION,
  CLIENT_DEFINITIONS,
  createSocialFeedClientPlan,
  sourceClientFor,
  credentialReadinessForSource,
  createSocialFeedRequestPlan,
  executeSocialFeedRequest
}
