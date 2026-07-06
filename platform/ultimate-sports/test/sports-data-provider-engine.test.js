'use strict'

const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  catalog,
  platform,
  sportsDataProviders
} = require('../src')

const docPath = path.join(__dirname, '..', 'docs', 'sports-data-provider-plan.md')
const providerDoc = fs.readFileSync(docPath, 'utf8')

test('sports data provider plan covers every catalog fit and core provider', () => {
  const plan = sportsDataProviders.createSportsDataProviderPlan()
  const fitIds = new Set(plan.fits.map(fit => fit.fitId))
  const providerIds = new Set(plan.providers.map(provider => provider.providerId))

  catalog.listEventFits().forEach(fit => {
    assert.equal(fitIds.has(fit.fitId), true, `${fit.fitId} missing from provider plan`)
  })
  ;[
    'sportradar',
    'sportsdataio',
    'pandascore',
    'abios',
    'sailgp-official-or-partner',
    'the-odds-api',
    'host-evidence-qvac'
  ].forEach(providerId => {
    assert.equal(providerIds.has(providerId), true, `${providerId} missing from provider plan`)
  })
  assert.equal(plan.recommendation.primaryProviderId, 'sportradar')
  assert.deepEqual(plan.recommendation.requiredSpecialists, [
    'sportsdataio',
    'pandascore',
    'abios',
    'sailgp-official-or-partner',
    'host-evidence-qvac'
  ])
})

test('specialized provider mappings route MMA, esports, SailGP, and manual events', () => {
  const mma = sportsDataProviders.providerPlanForFit('mma-boxing-fight-card')
  const esports = sportsDataProviders.providerPlanForFit('esports-major')
  const sailgp = sportsDataProviders.providerPlanForFit('sailgp-companion')
  const awards = sportsDataProviders.providerPlanForFit('awards-prediction-pools')

  assert.equal(mma.primaryProviderId, 'sportsdataio')
  assert.equal(mma.providerIds.includes('the-odds-api'), true)
  assert.equal(mma.providerIds.includes('host-evidence-qvac'), true)
  assert.equal(esports.primaryProviderId, 'pandascore')
  assert.equal(esports.providerIds.includes('abios'), true)
  assert.equal(sailgp.primaryProviderId, 'sailgp-official-or-partner')
  assert.equal(sailgp.settlementSource, 'sailgp-official-or-partner-or-qvac-reviewed-evidence')
  assert.equal(sailgp.providerIds.includes('host-evidence-qvac'), true)
  assert.equal(awards.primaryProviderId, 'host-evidence-qvac')
  assert.equal(awards.settlementSource, 'qvac-reviewed-host-evidence')
})

test('platform facade exposes provider recommendation helpers', () => {
  const app = platform.createUltimateSportsPlatform()
  const plan = app.createSportsDataProviderPlan()
  const fitPlan = app.providerPlanForFit('sailgp-companion')
  const recommendation = app.recommendSportsDataProviderStack()

  assert.equal(plan.recommendation.primaryProviderId, 'sportradar')
  assert.equal(fitPlan.primaryProviderId, 'sailgp-official-or-partner')
  assert.equal(recommendation.requiredSpecialists.includes('sportsdataio'), true)
})

test('sports data provider doc names every catalog fit and provider decision', () => {
  catalog.listEventFits().forEach(fit => {
    assert.equal(providerDoc.includes(`\`${fit.fitId}\``), true, `${fit.fitId} missing from provider doc`)
  })
  ;[
    'Sportradar',
    'SportsDataIO',
    'PandaScore',
    'Abios',
    'SailGP official or partner feed',
    'The Odds API',
    'Host evidence + QVAC',
    'combat cards without a covered API',
    'SPORTRADAR_API_KEY',
    'SPORTSDATAIO_MMA_API_KEY',
    'PANDASCORE_TOKEN',
    'ABIOS_CLIENT_ID',
    'SAILGP_PARTNER_FEED_KEY',
    'ODDS_API_KEY',
    'sports-data-smoke.js'
  ].forEach(term => {
    assert.equal(providerDoc.includes(term), true, `${term} missing from provider doc`)
  })
})
