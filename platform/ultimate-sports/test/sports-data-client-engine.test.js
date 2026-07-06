'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  catalog,
  platform,
  sportsDataAggregator,
  sportsDataClients
} = require('../src')

test('sports data client plan creates server-only clients for every aggregator source', () => {
  const plan = sportsDataClients.createSportsDataClientPlan({ env: {} })
  const sourceIds = new Set(Object.values(sportsDataAggregator.AGGREGATOR_SOURCES).map(source => source.sourceId))
  const clientIds = new Set(plan.clients.map(client => client.sourceId))

  sourceIds.forEach(sourceId => {
    assert.equal(clientIds.has(sourceId), true, `${sourceId} missing client`)
  })
  assert.equal(plan.serverOnly, true)
  assert.equal(plan.noClientSecrets, true)
  assert.equal(plan.coverage.totalSources, sourceIds.size)
  assert.equal(plan.coverage.sourcesWithClients, sourceIds.size)
  assert.equal(plan.coverage.apiClientsWithRequestBuilders, plan.coverage.apiSourceCount)
  assert.equal(plan.coverage.readyApiClients, 0)
  assert.equal(plan.coverage.localEvidenceClients >= 3, true)
})

test('credential readiness reports missing env without exposing values', () => {
  const missing = sportsDataClients.credentialReadinessForSource('sportsdataio-mma', {})
  const ready = sportsDataClients.credentialReadinessForSource('sportsdataio-mma', {
    SPORTSDATAIO_MMA_API_KEY: 'secret-value'
  })

  assert.equal(missing.ready, false)
  assert.deepEqual(missing.missingEnv, ['SPORTSDATAIO_MMA_API_KEY'])
  assert.equal(ready.ready, true)
  assert.deepEqual(ready.presentEnv, ['SPORTSDATAIO_MMA_API_KEY'])
  assert.equal(JSON.stringify(ready).includes('secret-value'), false)
})

test('request plans build redacted server-side HTTP requests for primary routes', () => {
  const mma = sportsDataClients.createSportsDataRequestPlan({
    fitId: 'mma-boxing-fight-card',
    entityType: 'result',
    params: { eventId: 'ufc-300' },
    env: { SPORTSDATAIO_MMA_API_KEY: 'do-not-serialize' }
  })
  const sailgp = sportsDataClients.createSportsDataRequestPlan({
    fitId: 'sailgp-companion',
    entityType: 'telemetry',
    params: { eventId: 'dubai-gp' },
    env: {
      SAILGP_PARTNER_FEED_KEY: 'sailgp-secret',
      SAILGP_PARTNER_FEED_BASE_URL: 'https://partner.sailgp.invalid'
    }
  })

  assert.equal(mma.sourceId, 'sportsdataio-mma')
  assert.equal(mma.ready, true)
  assert.equal(mma.url.includes('/scores/json/Event/ufc-300'), true)
  assert.equal(mma.headers['Ocp-Apim-Subscription-Key'], '<redacted:SPORTSDATAIO_MMA_API_KEY>')
  assert.equal(JSON.stringify(mma).includes('do-not-serialize'), false)

  assert.equal(sailgp.sourceId, 'sailgp-partner-feed')
  assert.equal(sailgp.ready, true)
  assert.equal(sailgp.url, 'https://partner.sailgp.invalid/events/dubai-gp/telemetry')
  assert.equal(sailgp.headers.Authorization, 'Bearer <redacted:SAILGP_PARTNER_FEED_KEY>')
  assert.equal(JSON.stringify(sailgp).includes('sailgp-secret'), false)
})

test('request plans support every catalog fit primary source', () => {
  catalog.listEventFits().forEach(fit => {
    const route = sportsDataAggregator.aggregatorRouteForFit(fit.fitId)
    const plan = sportsDataClients.createSportsDataRequestPlan({
      fitId: fit.fitId,
      entityType: route.primarySourceId === 'host-evidence-qvac' ? 'evidence' : 'fixture',
      params: {
        eventId: `${fit.fitId}-event`,
        matchId: `${fit.fitId}-match`,
        evidenceId: `${fit.fitId}-evidence`
      },
      env: fakeEnvFor(route.primarySourceId)
    })

    assert.equal(plan.sourceId, route.primarySourceId)
    assert.equal(plan.serverOnly, true)
    assert.equal(plan.url.length > 0, true)
  })
})

test('execute sports data request uses injected fetch and normalizes payloads', async () => {
  const requestPlan = sportsDataClients.createSportsDataRequestPlan({
    sourceId: 'sportsdataio-mma',
    entityType: 'result',
    params: { eventId: 'fight-night-1' },
    env: { SPORTSDATAIO_MMA_API_KEY: 'secret' }
  })
  const executed = await sportsDataClients.executeSportsDataRequest({
    requestPlan,
    fetchImpl: async (url, options) => {
      assert.equal(url.includes('/scores/json/Event/fight-night-1'), true)
      assert.equal(options.headers.Accept, 'application/json')
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'fight-night-1', status: 'Final', method: 'Decision' })
      }
    }
  })

  assert.equal(executed.ok, true)
  assert.equal(executed.records.length, 1)
  assert.equal(executed.records[0].sourceId, 'sportsdataio-mma')
  assert.equal(executed.records[0].canAutoSettle, true)
})

test('platform facade exposes sports data client helpers', () => {
  const app = platform.createUltimateSportsPlatform()
  const plan = app.createSportsDataClientPlan({ env: {} })
  const client = app.sourceClientFor('the-odds-api-context')
  const readiness = app.credentialReadinessForSource('the-odds-api-context', {})
  const request = app.createSportsDataRequestPlan({
    sourceId: 'the-odds-api-context',
    entityType: 'odds-market',
    env: { ODDS_API_KEY: 'secret' }
  })

  assert.equal(plan.coverage.apiClientsWithRequestBuilders, plan.coverage.apiSourceCount)
  assert.equal(client.sourceId, 'the-odds-api-context')
  assert.equal(readiness.ready, false)
  assert.equal(request.query.apiKey, '<redacted:ODDS_API_KEY>')
})

function fakeEnvFor (sourceId) {
  return {
    'sportradar-official': {
      SPORTRADAR_API_KEY: 'secret',
      SPORTRADAR_PRODUCT_CONFIG: 'soccer'
    },
    'sportsdataio-mma': {
      SPORTSDATAIO_MMA_API_KEY: 'secret'
    },
    'sportsdataio-global': {
      SPORTSDATAIO_GLOBAL_API_KEY: 'secret'
    },
    'pandascore-esports': {
      PANDASCORE_TOKEN: 'secret'
    },
    'abios-esports': {
      ABIOS_CLIENT_ID: 'client',
      ABIOS_CLIENT_SECRET: 'secret'
    },
    'the-odds-api-context': {
      ODDS_API_KEY: 'secret'
    },
    'sailgp-partner-feed': {
      SAILGP_PARTNER_FEED_KEY: 'secret',
      SAILGP_PARTNER_FEED_BASE_URL: 'https://partner.sailgp.invalid'
    },
    'stats-perform-opta': {
      STATSPERFORM_API_KEY: 'secret',
      STATSPERFORM_BASE_URL: 'https://statsperform.invalid'
    },
    'host-evidence-qvac': {},
    'official-web-evidence': {},
    'social-web-evidence': {}
  }[sourceId] || {}
}
