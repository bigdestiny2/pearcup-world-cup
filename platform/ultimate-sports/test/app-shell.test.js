'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createUltimateSportsAppSnapshot,
  writeUltimateSportsAppSnapshot,
  parseArgs: parseSnapshotArgs
} = require('../scripts/export-app-snapshot')
const {
  DEFAULT_PORT,
  DEMO_VERSION,
  createDemoSession,
  parseArgs: parseServeArgs
} = require('../scripts/serve-app')
const { catalog } = require('../src')

const rootDir = path.resolve(__dirname, '..')

test('ultimate sports app snapshot exercises facade data for the preview shell', () => {
  const snapshot = createUltimateSportsAppSnapshot({
    rootDir,
    generatedAt: '2026-07-04T00:00:00.000Z',
    userId: 'host'
  })

  assert.equal(snapshot.snapshotVersion, 'ultimate-sports-app-snapshot-v1')
  assert.equal(snapshot.audit.summary.coveragePercent >= 80, true)
  assert.equal(snapshot.audit.grindList.find(item => item.title === 'Build the actual ultimate sports app shell').status, 'covered')
  assert.equal(snapshot.audit.grindMatrix.summary.groupCount, 3)
  assert.equal(snapshot.audit.grindMatrix.groups.some(group => group.groupId === 'sailgp-premium-access'), true)
  assert.equal(snapshot.audit.grindBacklog.summary.ticketCount > 0, true)
  assert.equal(snapshot.audit.grindBacklog.tickets.some(ticket => ticket.ticketId === 'US-GRIND-001'), true)
  assert.equal(snapshot.audit.launchReadiness.summary.currentLevelId, 'demo-product-ready')
  assert.equal(snapshot.audit.launchReadiness.summary.nextBlockedGateId, 'provider-live-data-ready')
  assert.equal(snapshot.audit.fitReadiness.summary.fitCount, catalog.listEventFits().length)
  assert.equal(snapshot.audit.fitReadiness.summary.qvacLocalReadyCount >= 3, true)
  assert.equal(snapshot.audit.fitReadiness.rows.some(row => row.fitId === 'mma-boxing-fight-card' && row.combatCardModes.some(mode => mode.modeId === 'qvac-combat-card')), true)
  assert.equal(snapshot.catalog.eventFits.length, catalog.listEventFits().length)
  assert.equal(snapshot.launchMatrix.rows.length, catalog.listEventFits().length)
  assert.equal(snapshot.aggregator.routes.length, catalog.listEventFits().length)
  assert.equal(snapshot.sportsDataClients.coverage.apiClientsWithRequestBuilders, snapshot.sportsDataClients.coverage.apiSourceCount)
  assert.equal(snapshot.sportsDataClients.clients.some(client => client.sourceId === 'sportsdataio-mma'), true)
  assert.equal(snapshot.sportsDataSmoke.summary.apiChecks, snapshot.sportsDataClients.coverage.apiSourceCount)
  assert.equal(snapshot.sportsDataSmoke.latestReport.overallStatus, 'standup-fixture-smoke-passed')
  assert.equal(snapshot.sportsDataSmoke.latestReport.summary.passedChecks, snapshot.sportsDataSmoke.latestReport.summary.totalChecks)
  assert.equal(snapshot.sportsDataSmoke.latestReport.summary.skipped, 0)
  assert.equal(snapshot.sportsDataSmoke.checks.some(check => check.sourceId === 'sailgp-partner-feed'), true)
  assert.equal(snapshot.sportsDataSmoke.checks.every(check => check.nextAction), true)
  assert.deepEqual(snapshot.surfaces.watch.qvacResultEvidence, [])
  assert.equal(snapshot.audit.generatedAssets.mmaCard.summary.targetCount > 0, true)
  assert.equal(snapshot.audit.generatedAssets.mmaCard.generationHandoff.envVars.includes('HIGGSFIELD_API_KEY'), true)
  assert.equal(snapshot.audit.previewJourneySmoke.ok, true)
  assert.equal(snapshot.runtime.scenarioRuns.every(run => run.ok), true)
  assert.equal(snapshot.assets.mma.queueCount > snapshot.assets.mma.assetCount, true)
  assert.ok(snapshot.navigation.some(item => item.surfaceId === 'discover' && item.primaryCount === catalog.listEventFits().length))
})

test('ultimate sports app snapshot writer creates the browser data file', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultimate-sports-app-'))
  const outFile = path.join(tempDir, 'snapshot.json')
  const result = writeUltimateSportsAppSnapshot({
    rootDir,
    outFile,
    generatedAt: '2026-07-04T00:00:00.000Z'
  })
  const saved = JSON.parse(fs.readFileSync(outFile, 'utf8'))

  assert.equal(result.outFile, outFile)
  assert.equal(saved.snapshotVersion, 'ultimate-sports-app-snapshot-v1')
  assert.equal(saved.aggregator.routes.some(route => route.fitId === 'sailgp-companion'), true)
  assert.equal(saved.aggregator.routes.some(route => route.fitId === 'mma-boxing-fight-card'), true)
})

test('ultimate sports app static shell references generated snapshot and visual asset', () => {
  const html = fs.readFileSync(path.join(rootDir, 'app', 'index.html'), 'utf8')
  const js = fs.readFileSync(path.join(rootDir, 'app', 'app.js'), 'utf8')
  const css = fs.readFileSync(path.join(rootDir, 'app', 'styles.css'), 'utf8')

  assert.match(js, /ultimate-sports-snapshot\.json/)
  assert.match(html, /fight-card-board\.svg/)
  assert.match(js, /renderAggregator/)
  assert.match(js, /renderMma/)
  assert.match(js, /Launch Readiness Gates/)
  assert.match(js, /Fit Readiness Matrix/)
  assert.match(js, /Concrete Grind Matrix/)
  assert.match(js, /Actionable Backlog/)
  assert.match(js, /sportsDataSmoke/)
  assert.match(js, /Latest Smoke Report/)
  assert.match(js, /Generated status/)
  assert.match(js, /renderDemo/)
  assert.match(js, /api\/demo\/state/)
  assert.match(js, /run-day-in-life/)
  assert.match(html, /data-surface="demo"/)
  assert.match(html, /demoRuntimePanel/)
  assert.match(html, /readinessPanel/)
  assert.match(html, /fitReadinessPanel/)
  assert.match(html, /clientPanel/)
  assert.match(css, /demo-layout/)
  assert.match(css, /grid-template-columns/)
  ;[
    'demo',
    'dashboard',
    'fits',
    'aggregator',
    'mma',
    'grind'
  ].forEach(surfaceId => {
    assert.match(html, new RegExp(`data-surface="${surfaceId}"`))
  })
})

test('ultimate sports app scripts parse serving and snapshot options', () => {
  assert.deepEqual(parseSnapshotArgs(['--out', '/tmp/snapshot.json', '--user-id', 'host']), {
    outFile: '/tmp/snapshot.json',
    userId: 'host'
  })
  assert.deepEqual(parseServeArgs(['--port', '4123', '--no-refresh']), {
    port: 4123,
    refreshSnapshot: false
  })
  assert.equal(parseServeArgs(['--port', 'bad']).port, DEFAULT_PORT)
})

test('ultimate sports live demo session drives actual facade state', () => {
  const demo = createDemoSession({ userId: 'test-host' })
  const before = demo.state()
  const after = demo.runDayInLife()

  assert.equal(before.demoVersion, DEMO_VERSION)
  assert.equal(before.source, 'live-facade')
  assert.equal(before.runtime.eventCount, 0)
  assert.equal(after.demoVersion, DEMO_VERSION)
  assert.equal(after.source, 'live-facade')
  assert.equal(after.runtime.eventCount > before.runtime.eventCount, true)
  assert.equal(after.viewSummary.competitionCount, 1)
  assert.equal(after.viewSummary.poolCount, 2)
  assert.equal(after.viewSummary.roomCount, 1)
  assert.equal(after.viewSummary.walletCount, 2)
  assert.equal(after.appliedScenarios.some(run => run.scenarioId === 'ultimate-day-in-life' && run.eventCount > 0), true)
  assert.equal(after.workbenches.picks.available, true)
})
