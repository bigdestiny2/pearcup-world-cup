'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  platform,
  sportsDataClients,
  sportsDataSmoke
} = require('../src')
const smokeScript = require('../scripts/sports-data-smoke')

test('sports data smoke plan classifies missing env without exposing values', () => {
  const plan = sportsDataSmoke.createSportsDataSmokePlan({
    env: {},
    generatedAt: '2026-07-04T00:00:00.000Z'
  })

  assert.equal(plan.planVersion, sportsDataSmoke.SPORTS_DATA_SMOKE_VERSION)
  assert.equal(plan.serverOnly, true)
  assert.equal(plan.noClientSecrets, true)
  assert.equal(plan.summary.apiChecks, sportsDataClients.createSportsDataClientPlan({ env: {} }).coverage.apiSourceCount)
  assert.equal(plan.summary.localReady, 3)
  assert.equal(plan.summary.readyToRun, 0)
  assert.equal(plan.summary.missingCredentials > 0, true)
  assert.equal(plan.checks.some(check => check.sourceId === 'sportsdataio-mma' && check.status === 'missing-env'), true)
  assert.match(plan.checks.find(check => check.sourceId === 'sportsdataio-mma').nextAction, /Set backend-only env/)
  assert.equal(plan.checks.find(check => check.sourceId === 'host-evidence-qvac').acceptanceCriteria.length, 3)
})

test('sports data smoke plan marks credentialed sources ready and Abios token blocked', () => {
  const plan = sportsDataSmoke.createSportsDataSmokePlan({
    env: {
      ...fullProviderEnv(),
      ABIOS_ACCESS_TOKEN: ''
    }
  })
  const abios = plan.checks.find(check => check.sourceId === 'abios-esports')

  assert.equal(plan.summary.readyToRun, plan.summary.apiChecks - 1)
  assert.equal(plan.summary.needsOAuthToken, 1)
  assert.equal(abios.status, 'needs-oauth-token')
  assert.equal(abios.blockers[0].blockerType, 'oauth-token-exchange')
  assert.match(abios.nextAction, /token-exchange/)
  assert.equal(JSON.stringify(plan).includes('secret'), false)
})

test('sports data smoke fixture plan makes API checks runnable without credentials', () => {
  const plan = sportsDataSmoke.createSportsDataSmokePlan({
    env: {},
    generatedAt: '2026-07-04T00:00:00.000Z',
    standupFixtures: true
  })

  assert.equal(plan.overallStatus, 'standup-fixture-ready')
  assert.equal(plan.summary.fixtureReady, plan.summary.apiChecks)
  assert.equal(plan.summary.blocked, 0)
  assert.equal(plan.checks.find(check => check.sourceId === 'sportsdataio-mma').status, 'standup-fixture-ready')
  assert.equal(plan.checks.find(check => check.sourceId === 'sportsdataio-mma').canUseStandupFixture, true)
  assert.equal(plan.checks.find(check => check.sourceId === 'sportsdataio-mma').liveBlockers.some(blocker => blocker.blockerType === 'missing-env'), true)
})

test('sports data smoke runner executes ready checks through injected fetch', async () => {
  const report = await sportsDataSmoke.runSportsDataSmokeChecks({
    sourceIds: ['sportsdataio-mma', 'host-evidence-qvac'],
    env: {
      SPORTSDATAIO_MMA_API_KEY: 'secret-mma-key'
    },
    generatedAt: '2026-07-04T00:00:00.000Z',
    fetchImpl: async (url, options) => {
      assert.equal(url.includes('/scores/json/Schedule/current'), true)
      assert.equal(options.headers['Ocp-Apim-Subscription-Key'], 'secret-mma-key')
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: 'fight-night' }]
      }
    }
  })
  const mma = report.results.find(result => result.sourceId === 'sportsdataio-mma')
  const local = report.results.find(result => result.sourceId === 'host-evidence-qvac')
  const serialized = JSON.stringify(report)

  assert.equal(report.overallStatus, 'live-smoke-passed')
  assert.equal(report.summary.executed, 1)
  assert.equal(report.summary.passedLive, 1)
  assert.equal(mma.status, 'passed-live')
  assert.equal(mma.payload.itemCount, 1)
  assert.equal(local.status, 'passed-local')
  assert.equal(serialized.includes('secret-mma-key'), false)
})

test('sports data smoke runner passes every source with standup fixtures', async () => {
  const report = await sportsDataSmoke.runSportsDataSmokeChecks({
    env: {},
    generatedAt: '2026-07-04T00:00:00.000Z',
    standupFixtures: true,
    fetchImpl: async () => {
      throw new Error('fixture smoke should not call network')
    }
  })

  assert.equal(report.overallStatus, 'standup-fixture-smoke-passed')
  assert.equal(report.summary.passedChecks, report.summary.totalChecks)
  assert.equal(report.summary.passedFixture, report.summary.apiChecks)
  assert.equal(report.summary.passedLocal, report.summary.localChecks)
  assert.equal(report.summary.skipped, 0)
  assert.equal(report.summary.failed, 0)
  assert.equal(report.results.some(result => result.status === 'passed-fixture' && result.normalizedRecordCount > 0), true)
  assert.equal(JSON.stringify(report).includes('secret'), false)
})

test('platform facade and bridge-safe smoke plan expose provider readiness', () => {
  const app = platform.createUltimateSportsPlatform()
  const plan = app.createSportsDataSmokePlan({
    sourceIds: ['the-odds-api-context'],
    env: {
      ODDS_API_KEY: 'secret-odds-key'
    }
  })

  assert.equal(plan.summary.totalChecks, 1)
  assert.equal(plan.checks[0].status, 'ready-to-run')
  assert.equal(JSON.stringify(plan).includes('secret-odds-key'), false)
})

test('sports data smoke CLI writes a redacted report without network when asked', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sports-data-smoke-'))
  const parsed = smokeScript.parseArgs([
    '--source',
    'sportsdataio-mma',
    '--generated-at',
    '2026-07-04T00:00:00.000Z',
    '--no-network',
    '--out-dir',
    tempDir,
    '--timeout-ms',
    '50'
  ])
  const result = await smokeScript.main([
    '--source',
    'sportsdataio-mma',
    '--generated-at',
    '2026-07-04T00:00:00.000Z',
    '--no-network',
    '--out-dir',
    tempDir,
    '--timeout-ms',
    '50'
  ], {
    env: {},
    fetchImpl: async () => {
      throw new Error('should not call network')
    }
  })
  const saved = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'))

  assert.deepEqual(parsed.sourceIds, ['sportsdataio-mma'])
  assert.equal(parsed.generatedAt, '2026-07-04T00:00:00.000Z')
  assert.equal(parsed.network, false)
  assert.equal(parsed.timeoutMs, 50)
  assert.equal(saved.reportVersion, sportsDataSmoke.SPORTS_DATA_SMOKE_VERSION)
  assert.equal(saved.results[0].status, 'skipped-blocked')
  assert.equal(result.exitCode, 0)
})

test('sports data smoke CLI can write all-passed standup fixture report', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sports-data-fixture-smoke-'))
  const parsed = smokeScript.parseArgs([
    '--standup-fixtures',
    '--generated-at',
    '2026-07-04T00:00:00.000Z',
    '--out-dir',
    tempDir
  ])
  const result = await smokeScript.main([
    '--standup-fixtures',
    '--generated-at',
    '2026-07-04T00:00:00.000Z',
    '--out-dir',
    tempDir
  ], {
    env: {},
    fetchImpl: async () => {
      throw new Error('fixture smoke should not call network')
    }
  })
  const saved = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'))

  assert.equal(parsed.standupFixtures, true)
  assert.equal(saved.overallStatus, 'standup-fixture-smoke-passed')
  assert.equal(saved.summary.passedChecks, saved.summary.totalChecks)
  assert.equal(saved.summary.skipped, 0)
  assert.equal(result.exitCode, 0)
})

function fullProviderEnv () {
  return {
    SPORTRADAR_API_KEY: 'secret',
    SPORTRADAR_PRODUCT_CONFIG: 'soccer',
    SPORTSDATAIO_MMA_API_KEY: 'secret',
    SPORTSDATAIO_GLOBAL_API_KEY: 'secret',
    PANDASCORE_TOKEN: 'secret',
    ABIOS_CLIENT_ID: 'secret',
    ABIOS_CLIENT_SECRET: 'secret',
    ODDS_API_KEY: 'secret',
    SAILGP_PARTNER_FEED_KEY: 'secret',
    SAILGP_PARTNER_FEED_BASE_URL: 'https://partner.sailgp.invalid',
    STATSPERFORM_API_KEY: 'secret',
    STATSPERFORM_BASE_URL: 'https://statsperform.invalid'
  }
}
