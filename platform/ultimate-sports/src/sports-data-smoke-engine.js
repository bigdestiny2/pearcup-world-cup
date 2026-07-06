'use strict'

const aggregator = require('./sports-data-aggregator-engine')
const sportsDataClients = require('./sports-data-client-engine')
const { cloneJson } = require('./util')

const SPORTS_DATA_SMOKE_VERSION = 'ultimate-sports-data-smoke-v1'

const DEFAULT_SMOKE_TARGETS = Object.freeze({
  'sportradar-official': smokeTarget({
    entityType: 'competition',
    operation: 'competition:list',
    params: {}
  }),
  'sportsdataio-mma': smokeTarget({
    entityType: 'event',
    operation: 'event:list',
    params: { season: 'current' }
  }),
  'sportsdataio-global': smokeTarget({
    entityType: 'competition',
    operation: 'competition:list',
    params: { league: 'soccer' }
  }),
  'pandascore-esports': smokeTarget({
    entityType: 'event',
    operation: 'event:list',
    params: {}
  }),
  'abios-esports': smokeTarget({
    entityType: 'event',
    operation: 'event:list',
    params: {}
  }),
  'the-odds-api-context': smokeTarget({
    entityType: 'event',
    operation: 'event:list',
    params: { sportKey: 'soccer_fifa_world_cup' }
  }),
  'sailgp-partner-feed': smokeTarget({
    entityType: 'event',
    operation: 'event:list',
    params: {}
  }),
  'stats-perform-opta': smokeTarget({
    entityType: 'competition',
    operation: 'competition:list',
    params: { sport: 'soccer', version: 'v1' }
  }),
  'official-web-evidence': smokeTarget({
    entityType: 'evidence',
    operation: 'evidence:create',
    params: {}
  }),
  'social-web-evidence': smokeTarget({
    entityType: 'evidence',
    operation: 'evidence:create',
    params: {}
  }),
  'host-evidence-qvac': smokeTarget({
    entityType: 'evidence',
    operation: 'evidence:create',
    params: {}
  })
})

function createSportsDataSmokePlan ({
  env = defaultEnv(),
  sourceIds = null,
  generatedAt = new Date().toISOString(),
  standupFixtures = false
} = {}) {
  const clientPlan = sportsDataClients.createSportsDataClientPlan({ env })
  const selected = selectClients(clientPlan.clients, sourceIds)
  const checks = selected.map(client => createSmokeCheck({ client, env, standupFixtures }))
  const summary = summarizeChecks(checks)

  return {
    planVersion: SPORTS_DATA_SMOKE_VERSION,
    generatedAt,
    serverOnly: true,
    noClientSecrets: true,
    standupFixtures,
    overallStatus: statusForPlanSummary(summary),
    summary,
    envVars: clientPlan.envVars.slice(),
    checks
  }
}

async function runSportsDataSmokeChecks ({
  env = defaultEnv(),
  sourceIds = null,
  generatedAt = new Date().toISOString(),
  fetchImpl = defaultFetch(),
  allowNetwork = true,
  timeoutMs = 10000,
  standupFixtures = false
} = {}) {
  const plan = createSportsDataSmokePlan({ env, sourceIds, generatedAt, standupFixtures })
  const results = []

  for (const check of plan.checks) {
    results.push(await runSmokeCheck({ check, env, fetchImpl, allowNetwork, timeoutMs, standupFixtures }))
  }

  const summary = summarizeResults(plan.summary, results)

  return {
    reportVersion: SPORTS_DATA_SMOKE_VERSION,
    generatedAt,
    serverOnly: true,
    noClientSecrets: true,
    standupFixtures,
    overallStatus: statusForResultSummary(summary),
    planSummary: plan.summary,
    summary,
    checks: plan.checks,
    results
  }
}

function createSmokeCheck ({ client, env, standupFixtures = false }) {
  const sourceClient = sportsDataClients.sourceClientFor(client.sourceId)
  const target = DEFAULT_SMOKE_TARGETS[client.sourceId] || smokeTarget({
    entityType: 'event',
    operation: null,
    params: {}
  })
  const requestPlan = sportsDataClients.createSportsDataRequestPlan({
    sourceId: client.sourceId,
    entityType: target.entityType,
    operation: target.operation,
    params: target.params,
    env
  })
  const blockers = blockersFor({ client, sourceClient, requestPlan, env })
  const status = statusForCheck({ client, blockers, standupFixtures })

  return {
    sourceId: client.sourceId,
    title: client.title,
    providerId: client.providerId,
    clientKind: client.clientKind,
    sourceKind: client.sourceKind,
    settlementTier: client.settlementTier,
    status,
    canCallNetwork: status === 'ready-to-run',
    canUseStandupFixture: status === 'standup-fixture-ready',
    liveBlockers: blockers.map(blocker => cloneJson(blocker)),
    target: cloneJson(target),
    blockers,
    request: {
      requestId: requestPlan.requestId,
      method: requestPlan.method,
      operation: requestPlan.operation,
      entityType: requestPlan.entityType,
      url: requestPlan.url,
      path: requestPlan.path,
      query: cloneJson(requestPlan.query),
      headers: cloneJson(requestPlan.headers),
      missingEnv: requestPlan.missingEnv.slice(),
      missingParams: requestPlan.missingParams.slice(),
      ready: requestPlan.ready,
      redacted: true
    },
    expectedEvidence: expectedEvidenceFor(client),
    nextAction: nextActionFor({ client, status, blockers }),
    acceptanceCriteria: acceptanceCriteriaFor(client),
    readinessChecklist: readinessChecklistFor({ client, sourceClient, requestPlan, status })
  }
}

function blockersFor ({ client, sourceClient, requestPlan, env }) {
  const blockers = []
  if (requestPlan.missingEnv.length > 0) {
    blockers.push({
      blockerType: 'missing-env',
      items: requestPlan.missingEnv.slice(),
      message: `Missing required env: ${requestPlan.missingEnv.join(', ')}`
    })
  }
  if (requestPlan.missingParams.length > 0) {
    blockers.push({
      blockerType: 'missing-params',
      items: requestPlan.missingParams.slice(),
      message: `Missing request params: ${requestPlan.missingParams.join(', ')}`
    })
  }
  if (
    client.clientKind === 'http-json' &&
    sourceClient.auth &&
    sourceClient.auth.type === 'oauth-client-credentials' &&
    requestPlan.missingEnv.length === 0 &&
    !hasEnv(env, 'ABIOS_ACCESS_TOKEN')
  ) {
    blockers.push({
      blockerType: 'oauth-token-exchange',
      items: ['ABIOS_ACCESS_TOKEN'],
      message: 'OAuth client credentials are present, but the smoke runner needs an access token or token-exchange adapter before calling this API.'
    })
  }
  return blockers
}

function statusForCheck ({ client, blockers, standupFixtures = false }) {
  if (client.clientKind !== 'http-json') return 'local-ready'
  if (standupFixtures && !blockers.some(blocker => blocker.blockerType === 'missing-params')) return 'standup-fixture-ready'
  if (blockers.some(blocker => blocker.blockerType === 'missing-env')) return 'missing-env'
  if (blockers.some(blocker => blocker.blockerType === 'missing-params')) return 'missing-params'
  if (blockers.some(blocker => blocker.blockerType === 'oauth-token-exchange')) return 'needs-oauth-token'
  return 'ready-to-run'
}

async function runSmokeCheck ({ check, env, fetchImpl, allowNetwork, timeoutMs, standupFixtures = false }) {
  if (check.status === 'local-ready') {
    return {
      sourceId: check.sourceId,
      status: 'passed-local',
      ok: true,
      networkCalled: false,
      evidence: 'Local evidence/QVAC lane is available without provider credentials.'
    }
  }
  if (check.status === 'standup-fixture-ready') {
    return createStandupFixtureResult({ check, generatedAt: null })
  }
  if (check.status !== 'ready-to-run') {
    return {
      sourceId: check.sourceId,
      status: 'skipped-blocked',
      ok: false,
      networkCalled: false,
      blockers: cloneJson(check.blockers),
      evidence: check.blockers.map(blocker => blocker.message).join('; ')
    }
  }
  if (!allowNetwork) {
    return {
      sourceId: check.sourceId,
      status: 'skipped-network-disabled',
      ok: false,
      networkCalled: false,
      evidence: 'Network calls were disabled for this smoke run.'
    }
  }
  if (typeof fetchImpl !== 'function') {
    return {
      sourceId: check.sourceId,
      status: 'skipped-no-fetch',
      ok: false,
      networkCalled: false,
      evidence: 'No fetch implementation is available for live provider calls.'
    }
  }

  const startedAt = Date.now()
  try {
    const requestPlan = sportsDataClients.createSportsDataRequestPlan({
      sourceId: check.sourceId,
      entityType: check.target.entityType,
      operation: check.target.operation,
      params: check.target.params,
      env,
      includeSecretValues: true
    })
    const response = await fetchWithTimeout(fetchImpl, requestPlan.url, {
      method: requestPlan.method,
      headers: requestPlan.headers
    }, timeoutMs)
    const payload = await payloadSummary(response)
    const durationMs = Date.now() - startedAt

    return {
      sourceId: check.sourceId,
      status: response && response.ok === false ? 'failed-http' : 'passed-live',
      ok: response && typeof response.ok === 'boolean' ? response.ok : true,
      networkCalled: true,
      httpStatus: response && typeof response.status === 'number' ? response.status : 200,
      durationMs,
      payload,
      evidence: response && response.ok === false
        ? `Provider returned HTTP ${response.status}.`
        : 'Provider responded to the sample request.'
    }
  } catch (error) {
    return {
      sourceId: check.sourceId,
      status: 'failed-error',
      ok: false,
      networkCalled: true,
      durationMs: Date.now() - startedAt,
      error: redactSecrets(error.message || String(error), env),
      evidence: 'Provider request failed before a successful response.'
    }
  }
}

function createStandupFixtureResult ({ check }) {
  const rows = createFixtureRowsForCheck(check)
  const records = rows.map((row, index) => aggregator.normalizeSportsDataRecord({
    sourceId: check.sourceId,
    entityType: check.request.entityType,
    externalId: row.id || row.eventId || row.matchId || `${check.sourceId}-fixture-${index}`,
    competitionId: row.competitionId || 'ultimate-sports-standup',
    fixtureId: row.fixtureId || row.eventId || row.matchId || `${check.sourceId}-fixture`,
    participantIds: row.participantIds || [],
    status: row.status || 'fixture',
    payload: row,
    capturedAt: row.capturedAt
  }))

  return {
    sourceId: check.sourceId,
    status: 'passed-fixture',
    ok: true,
    networkCalled: false,
    fixtureMode: true,
    payload: {
      kind: 'standup-fixture',
      itemCount: rows.length
    },
    normalizedRecordCount: records.length,
    recordHashes: records.map(record => record.recordHash),
    evidence: 'Standup fixture response exercised the provider request contract and normalization without live credentials.'
  }
}

function createFixtureRowsForCheck (check) {
  const base = {
    sourceId: check.sourceId,
    providerId: check.providerId,
    entityType: check.request.entityType,
    operation: check.request.operation,
    competitionId: 'ultimate-sports-standup',
    capturedAt: '2026-07-04T00:00:00.000Z',
    status: 'fixture'
  }
  if (check.request.entityType === 'competition') {
    return [
      { ...base, id: `${check.sourceId}-competition-1`, name: `${check.title} Standup Competition` },
      { ...base, id: `${check.sourceId}-competition-2`, name: `${check.title} Fallback Competition` }
    ]
  }
  if (check.request.entityType === 'evidence') {
    return [
      {
        ...base,
        id: `${check.sourceId}-evidence-1`,
        sourceUrl: `qvac://${check.sourceId}/standup-evidence`,
        verdict: 'available'
      }
    ]
  }
  return [
    {
      ...base,
      id: `${check.sourceId}-event-1`,
      eventId: `${check.sourceId}-event-1`,
      fixtureId: `${check.sourceId}-fixture-1`,
      name: `${check.title} Standup Event`,
      participantIds: [`${check.sourceId}-entrant-a`, `${check.sourceId}-entrant-b`]
    },
    {
      ...base,
      id: `${check.sourceId}-event-2`,
      eventId: `${check.sourceId}-event-2`,
      fixtureId: `${check.sourceId}-fixture-2`,
      name: `${check.title} Standup Result`,
      participantIds: [`${check.sourceId}-entrant-c`, `${check.sourceId}-entrant-d`],
      result: { winnerId: `${check.sourceId}-entrant-c`, method: 'fixture' }
    }
  ]
}

async function fetchWithTimeout (fetchImpl, url, options, timeoutMs) {
  let timer = null
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`provider smoke timed out after ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    return await Promise.race([
      fetchImpl(url, options),
      timeout
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function payloadSummary (response) {
  if (!response || typeof response.json !== 'function') {
    return {
      kind: 'unread',
      itemCount: null
    }
  }

  try {
    const body = await response.json()
    if (Array.isArray(body)) {
      return {
        kind: 'array',
        itemCount: body.length
      }
    }
    if (body && Array.isArray(body.items)) {
      return {
        kind: 'object-with-items',
        itemCount: body.items.length
      }
    }
    return {
      kind: body == null ? 'empty' : typeof body,
      itemCount: body == null ? 0 : 1
    }
  } catch (error) {
    return {
      kind: 'unreadable-json',
      itemCount: null
    }
  }
}

function summarizeChecks (checks) {
  return {
    totalChecks: checks.length,
    apiChecks: checks.filter(check => check.clientKind === 'http-json').length,
    localChecks: checks.filter(check => check.clientKind !== 'http-json').length,
    readyToRun: checks.filter(check => check.status === 'ready-to-run').length,
    fixtureReady: checks.filter(check => check.status === 'standup-fixture-ready').length,
    localReady: checks.filter(check => check.status === 'local-ready').length,
    missingCredentials: checks.filter(check => check.status === 'missing-env').length,
    missingParams: checks.filter(check => check.status === 'missing-params').length,
    needsOAuthToken: checks.filter(check => check.status === 'needs-oauth-token').length,
    blocked: checks.filter(check => check.status !== 'ready-to-run' && check.status !== 'local-ready' && check.status !== 'standup-fixture-ready').length
  }
}

function summarizeResults (planSummary, results) {
  return {
    ...cloneJson(planSummary),
    passedChecks: results.filter(result => result.ok).length,
    executed: results.filter(result => result.networkCalled).length,
    passedLive: results.filter(result => result.status === 'passed-live').length,
    passedFixture: results.filter(result => result.status === 'passed-fixture').length,
    passedLocal: results.filter(result => result.status === 'passed-local').length,
    failed: results.filter(result => result.status === 'failed-http' || result.status === 'failed-error').length,
    skipped: results.filter(result => result.status.startsWith('skipped-')).length
  }
}

function statusForPlanSummary (summary) {
  if (summary.fixtureReady === summary.apiChecks && summary.blocked === 0) return 'standup-fixture-ready'
  if (summary.fixtureReady > 0 && summary.blocked === 0) return 'partial-standup-fixture-ready'
  if (summary.readyToRun === summary.apiChecks && summary.blocked === 0) return 'ready-for-live-smoke'
  if (summary.readyToRun > 0) return 'partial-live-smoke-ready'
  if (summary.localReady > 0 && summary.apiChecks === 0) return 'local-only-ready'
  return 'waiting-for-provider-credentials'
}

function statusForResultSummary (summary) {
  if (summary.failed > 0) return 'live-smoke-failed'
  if (summary.skipped === 0 && summary.passedFixture > 0 && summary.passedChecks === summary.totalChecks) return 'standup-fixture-smoke-passed'
  if (summary.passedLive > 0 && summary.passedLive === summary.readyToRun) return 'live-smoke-passed'
  if (summary.passedLive > 0) return 'partial-live-smoke-passed'
  return statusForPlanSummary(summary)
}

function selectClients (clients, sourceIds) {
  if (!sourceIds || sourceIds.length === 0) return clients
  const wanted = new Set(sourceIds)
  return clients.filter(client => wanted.has(client.sourceId))
}

function expectedEvidenceFor (client) {
  if (client.clientKind !== 'http-json') return 'local QVAC/evidence lane available'
  if (client.settlementTier === 'source-of-truth') return 'HTTP 2xx response from source-of-truth provider sample endpoint'
  if (client.settlementTier === 'trusted-secondary') return 'HTTP 2xx response from trusted secondary provider sample endpoint'
  if (client.settlementTier === 'context-only') return 'HTTP 2xx response from context provider sample endpoint'
  return 'provider or partner feed sample response'
}

function nextActionFor ({ client, status, blockers }) {
  if (status === 'local-ready') {
    return 'Use this local QVAC/evidence lane for host-entered results, corrections, and no-API settlement reviews.'
  }
  if (status === 'ready-to-run') {
    return `Run sports-data-smoke for ${client.sourceId} with network enabled and store the redacted passed-live report.`
  }
  if (status === 'standup-fixture-ready') {
    return `Use standup fixtures for ${client.sourceId} locally, then run live smoke when backend credentials are contracted.`
  }
  if (status === 'needs-oauth-token') {
    return `Add the OAuth token-exchange adapter or provide a backend ${blockers.flatMap(blocker => blocker.items).join(', ')} value, then rerun the smoke check.`
  }
  if (status === 'missing-params') {
    return `Fill the smoke target params for ${client.sourceId}: ${blockers.flatMap(blocker => blocker.items).join(', ')}.`
  }
  return `Set backend-only env for ${client.sourceId}: ${blockers.flatMap(blocker => blocker.items).join(', ')}.`
}

function acceptanceCriteriaFor (client) {
  if (client.clientKind !== 'http-json') {
    return [
      'Local evidence packets can be created without provider credentials.',
      'QVAC review records can reference the evidence packet before prize settlement.',
      'No provider credentials are required or serialized.'
    ]
  }
  return [
    'Required provider credentials are present only in the backend runtime.',
    'The smoke check returns passed-live with an HTTP 2xx provider response.',
    'The redacted smoke report stores status, duration, payload shape, and item count without credential values.'
  ]
}

function readinessChecklistFor ({ client, sourceClient, requestPlan, status }) {
  const requiredEnv = (sourceClient.requiredEnv || []).map(name => ({
    item: name,
    status: requestPlan.missingEnv.includes(name) ? 'missing' : 'present',
    sensitive: true
  }))
  const requiredParams = (requestPlan.missingParams || []).map(name => ({
    item: name,
    status: 'missing',
    sensitive: false
  }))
  const checks = [
    {
      item: 'server-only request builder',
      status: client.serverOnly ? 'present' : 'missing',
      sensitive: false
    },
    ...requiredEnv,
    ...requiredParams,
    {
      item: 'redacted smoke acceptance',
      status: status === 'ready-to-run' || status === 'local-ready' || status === 'standup-fixture-ready' ? 'ready' : 'blocked',
      sensitive: false
    }
  ]

  return checks
}

function smokeTarget (input) {
  return Object.freeze({
    entityType: input.entityType,
    operation: input.operation,
    params: Object.freeze(cloneJson(input.params || {}))
  })
}

function redactSecrets (value, env) {
  let text = String(value == null ? '' : value)
  Object.values(env || {}).forEach(rawValue => {
    const secret = String(rawValue || '')
    if (!secret) return
    text = text.split(secret).join('[redacted]')
    text = text.split(encodeURIComponent(secret)).join('[redacted]')
  })
  return text
}

function hasEnv (env, name) {
  return Object.prototype.hasOwnProperty.call(env || {}, name) && String(env[name] || '').trim() !== ''
}

function defaultEnv () {
  return typeof process !== 'undefined' && process && process.env ? process.env : {}
}

function defaultFetch () {
  return typeof fetch === 'function' ? fetch : null
}

module.exports = {
  SPORTS_DATA_SMOKE_VERSION,
  DEFAULT_SMOKE_TARGETS,
  createSportsDataSmokePlan,
  runSportsDataSmokeChecks
}
