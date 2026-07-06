'use strict'

const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  catalog,
  platform,
  sportsDataAggregator
} = require('../src')

const docPath = path.join(__dirname, '..', 'docs', 'sports-data-aggregator-plan.md')
const aggregatorDoc = fs.readFileSync(docPath, 'utf8')

test('sports data aggregator plan creates source routes for every catalog fit', () => {
  const plan = sportsDataAggregator.createSportsDataAggregatorPlan()
  const routeIds = new Set(plan.routes.map(route => route.fitId))
  const sourceIds = new Set(plan.sources.map(source => source.sourceId))

  catalog.listEventFits().forEach(fit => {
    assert.equal(routeIds.has(fit.fitId), true, `${fit.fitId} missing aggregator route`)
  })
  ;[
    'sportradar-official',
    'sportsdataio-mma',
    'sportsdataio-global',
    'pandascore-esports',
    'abios-esports',
    'sailgp-partner-feed',
    'the-odds-api-context',
    'official-web-evidence',
    'social-web-evidence',
    'host-evidence-qvac'
  ].forEach(sourceId => {
    assert.equal(sourceIds.has(sourceId), true, `${sourceId} missing from aggregator sources`)
  })
  assert.equal(plan.strategy.noClientSecrets, true)
  assert.equal(plan.envVars.includes('SPORTRADAR_API_KEY'), true)
  assert.equal(plan.envVars.includes('ABIOS_CLIENT_SECRET'), true)
})

test('aggregator routes mainstream, MMA, esports, SailGP, and manual fits correctly', () => {
  const worldCup = sportsDataAggregator.aggregatorRouteForFit('world-cup')
  const mma = sportsDataAggregator.aggregatorRouteForFit('mma-boxing-fight-card')
  const bareknuckle = sportsDataAggregator.aggregatorRouteForFit({
    fitId: 'mma-boxing-fight-card',
    combatDiscipline: 'bareknuckle',
    apiCoverage: 'unavailable'
  })
  const esports = sportsDataAggregator.aggregatorRouteForFit('esports-major')
  const rocketLeague = sportsDataAggregator.aggregatorRouteForFit({
    fitId: 'esports-major',
    esportsTitle: 'rocket-league'
  })
  const sailgp = sportsDataAggregator.aggregatorRouteForFit('sailgp-companion')
  const awards = sportsDataAggregator.aggregatorRouteForFit('awards-prediction-pools')

  assert.equal(worldCup.primarySourceId, 'sportradar-official')
  assert.equal(worldCup.contextSourceIds.includes('the-odds-api-context'), true)
  assert.equal(mma.primarySourceId, 'sportsdataio-mma')
  assert.equal(mma.settlement.autoSettlementSourceIds.includes('sportsdataio-mma'), true)
  assert.equal(mma.settlement.prizeSettlementMode, 'auto-source-with-qvac-correction')
  assert.equal(mma.settlement.prizeSettlementReady, true)
  assert.equal(mma.fallbackOrder.includes('social-web-evidence'), true)
  assert.equal(bareknuckle.primarySourceId, 'host-evidence-qvac')
  assert.equal(bareknuckle.sourceIds.includes('official-web-evidence'), true)
  assert.equal(bareknuckle.sourceIds.includes('social-web-evidence'), true)
  assert.deepEqual(bareknuckle.settlement.autoSettlementSourceIds, [])
  assert.equal(bareknuckle.settlement.prizeSettlementMode, 'qvac-result-evidence')
  assert.equal(bareknuckle.settlement.resultEvidenceContract.minimumCorroboratingSources, 2)
  assert.equal(bareknuckle.settlement.requiresQvacForPrize, true)
  assert.equal(esports.primarySourceId, 'pandascore-esports')
  assert.equal(esports.sourceIds.includes('abios-esports'), true)
  assert.equal(rocketLeague.primarySourceId, 'abios-esports')
  assert.equal(rocketLeague.sourceIds.includes('pandascore-esports'), true)
  assert.equal(sailgp.primarySourceId, 'sailgp-partner-feed')
  assert.equal(sailgp.fallbackOrder.includes('official-web-evidence'), true)
  assert.equal(sailgp.settlement.requiresQvacForPrize, true)
  assert.equal(awards.primarySourceId, 'host-evidence-qvac')
  assert.deepEqual(awards.settlement.autoSettlementSourceIds, [])
  assert.equal(awards.settlement.prizeSettlementReady, true)
  assert.equal(awards.settlement.resultEvidenceContract.required, true)
})

test('normalized records preserve source trust, hashes, and QVAC review state', () => {
  const officialResult = sportsDataAggregator.normalizeSportsDataRecord({
    sourceId: 'sportradar-official',
    entityType: 'result',
    externalId: 'match-1',
    competitionId: 'wc',
    fixtureId: 'wc-final',
    payload: {
      id: 'match-1',
      status: 'closed',
      homeScore: 2,
      awayScore: 1
    }
  })
  const oddsMarket = sportsDataAggregator.normalizeSportsDataRecord({
    sourceId: 'the-odds-api-context',
    entityType: 'odds-market',
    externalId: 'odds-1',
    payload: { market: 'h2h' }
  })
  const evidence = sportsDataAggregator.normalizeSportsDataRecord({
    sourceId: 'host-evidence-qvac',
    entityType: 'result',
    externalId: 'manual-awards-card',
    sourceUrl: 'https://example.invalid/result',
    payload: { winner: 'nominee-a' }
  })
  const socialEvidence = sportsDataAggregator.normalizeSportsDataRecord({
    sourceId: 'social-web-evidence',
    entityType: 'result',
    externalId: 'bareknuckle-main-event',
    sourceUrl: 'https://example.invalid/social-post',
    payload: { winner: 'fighter-a', method: 'decision' }
  })

  assert.equal(officialResult.settlementTier, 'source-of-truth')
  assert.equal(officialResult.canAutoSettle, true)
  assert.equal(Boolean(officialResult.payloadHash), true)
  assert.equal(Boolean(officialResult.recordHash), true)
  assert.equal(oddsMarket.canAutoSettle, false)
  assert.equal(oddsMarket.settlementTier, 'context-only')
  assert.equal(evidence.requiresQvacReview, true)
  assert.equal(evidence.canAutoSettle, false)
  assert.equal(socialEvidence.requiresQvacReview, true)
  assert.equal(socialEvidence.canAutoSettle, false)
})

test('platform facade exposes aggregator plan, route, health, and normalization helpers', () => {
  const app = platform.createUltimateSportsPlatform()
  const plan = app.createSportsDataAggregatorPlan()
  const route = app.aggregatorRouteForFit('sailgp-companion')
  const health = app.createSportsDataAggregatorHealthPlan({
    sourceIds: ['sportsdataio-mma', 'host-evidence-qvac']
  })
  const record = app.normalizeSportsDataRecord({
    sourceId: 'sportsdataio-mma',
    entityType: 'result',
    externalId: 'fight-1',
    payload: { method: 'decision' }
  })

  assert.equal(plan.routes.some(item => item.fitId === 'sailgp-companion'), true)
  assert.equal(route.primarySourceId, 'sailgp-partner-feed')
  assert.equal(health.checks.length, 2)
  assert.equal(health.checks[0].sourceId, 'sportsdataio-mma')
  assert.equal(record.canAutoSettle, true)
})

test('aggregator docs name every fit, core source, and public helper', () => {
  catalog.listEventFits().forEach(fit => {
    assert.equal(aggregatorDoc.includes(`\`${fit.fitId}\``), true, `${fit.fitId} missing from aggregator doc`)
  })
  ;[
    'sportradar-official',
    'sportsdataio-mma',
    'pandascore-esports',
    'abios-esports',
    'sailgp-partner-feed',
    'the-odds-api-context',
    'social-web-evidence',
    'host-evidence-qvac',
    'createSportsDataAggregatorPlan',
    'aggregatorRouteForFit',
    'normalizeSportsDataRecord',
    'createSportsDataAggregatorHealthPlan',
    'createSportsDataSmokePlan',
    'runSportsDataSmokeChecks',
    'nextAction',
    'readinessChecklist'
  ].forEach(term => {
    assert.equal(aggregatorDoc.includes(term), true, `${term} missing from aggregator doc`)
  })
})
