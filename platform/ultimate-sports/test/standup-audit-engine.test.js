'use strict'

const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  catalog,
  platform,
  standupAudit
} = require('../src')
const standupScript = require('../scripts/standup-audit')

const docPath = path.join(__dirname, '..', 'docs', 'standup-audit.md')
const doc = fs.readFileSync(docPath, 'utf8')

test('standup audit boots the facade and summarizes every event fit', () => {
  const audit = standupAudit.createUltimateSportsStandupAudit({
    generatedAt: '2026-07-04T00:00:00.000Z'
  })
  const fitIds = new Set(audit.fitRows.map(row => row.fitId))

  catalog.listEventFits().forEach(fit => {
    assert.equal(fitIds.has(fit.fitId), true, `${fit.fitId} missing from standup audit`)
  })
  assert.equal(audit.summary.fitCount, catalog.listEventFits().length)
  assert.equal(audit.summary.launchableFits, catalog.listEventFits().length)
  assert.equal(audit.summary.aggregatorRoutes, catalog.listEventFits().length)
  assert.equal(audit.coverage.areas.every(area => Number.isFinite(area.percent)), true)
  assert.equal(audit.scenarioRuns.every(run => run.ok), true)
  assert.equal(audit.appSurfaceSnapshot.filter(surface => surface.present).length, standupAudit.REQUIRED_SURFACES.length)
  assert.equal(audit.pearWorkerBridge.ok, true)
  assert.equal(audit.providerSmoke.summary.apiChecks, audit.providerClients.coverage.apiSourceCount)
  assert.equal(audit.generatedAssets.mmaCard.summary.targetCount > 0, true)
  assert.equal(audit.previewJourneySmoke.ok, true)
  assert.equal(audit.grindMatrix.summary.groupCount, 3)
  assert.equal(audit.grindMatrix.groups.some(group => group.groupId === 'provider-live-smoke'), true)
  assert.equal(audit.grindMatrix.groups.some(group => group.groupId === 'combat-generated-assets'), true)
  assert.equal(audit.grindBacklog.summary.ticketCount, audit.summary.backlogTicketCount)
  assert.equal(audit.grindBacklog.tickets.some(ticket => ticket.ticketId === 'US-GRIND-001'), true)
  assert.equal(audit.grindBacklog.tickets.every(ticket => ticket.acceptanceCriteria.length > 0), true)
  assert.equal(audit.launchReadiness.summary.gateCount, 6)
  assert.equal(audit.launchReadiness.summary.currentLevelId, 'demo-product-ready')
  assert.equal(audit.launchReadiness.summary.nextBlockedGateId, 'provider-live-data-ready')
  assert.equal(audit.launchReadiness.gates.find(gate => gate.gateId === 'local-preview-ready').status, 'passed')
  assert.equal(audit.launchReadiness.gates.find(gate => gate.gateId === 'demo-product-ready').status, 'passed')
  assert.equal(audit.launchReadiness.gates.find(gate => gate.gateId === 'provider-live-data-ready').status, 'blocked')
  assert.equal(audit.fitReadiness.summary.fitCount, catalog.listEventFits().length)
  assert.equal(audit.fitReadiness.summary.demoReadyCount, catalog.listEventFits().length)
  assert.equal(audit.fitReadiness.summary.settlementReadyCount, catalog.listEventFits().length)
  assert.equal(audit.fitReadiness.summary.providerBlockedFitCount > 0, true)
  assert.equal(audit.fitReadiness.summary.qvacLocalReadyCount >= 3, true)
  assert.equal(audit.fitReadiness.summary.assetBlockedFitCount, 0)
})

test('standup audit calls out actual grind items instead of declaring the app finished', () => {
  const audit = standupAudit.createUltimateSportsStandupAudit({
    generatedAt: '2026-07-04T00:00:00.000Z'
  })
  const gaps = new Map(audit.grindList.map(item => [item.title, item]))

  assert.equal(gaps.get('Build the actual ultimate sports app shell').status, 'covered')
  assert.equal(gaps.get('Implement real provider API clients behind the aggregator routes').status, 'covered')
  assert.equal(gaps.get('Verify provider credentials and contracts with live smoke checks').status, 'open')
  assert.equal(gaps.get('Prove no-API result settlement lanes').status, 'covered')
  assert.equal(gaps.get('Generate and QA sport-specific asset packs').status, 'covered')
  assert.equal(gaps.get('Wire v2 commands through the existing Pear worker boundary').status, 'covered')
  assert.equal(gaps.get('Add automated preview journey tests for the UI shell').status, 'covered')
  assert.equal(audit.summary.topGapCount > 0, true)
  assert.equal(audit.summary.openGrindTasks, audit.grindMatrix.summary.openTaskCount)
  assert.equal(audit.grindBacklog.summary.blockedTicketCount > 0, true)
  assert.equal(audit.grindBacklog.summary.externalDependencyTicketCount > 0, true)
  assert.equal(audit.launchReadiness.gates.find(gate => gate.gateId === 'combat-asset-pack-ready').status, 'ready')
  assert.equal(audit.launchReadiness.gates.find(gate => gate.gateId === 'real-money-prize-mode-ready').blockers.some(blocker => blocker.includes('policy')), true)
  assert.equal(audit.grindMatrix.groups.find(group => group.groupId === 'provider-live-smoke').tasks.some(task => task.sourceId === 'sportsdataio-mma'), true)
  assert.equal(audit.grindMatrix.groups.find(group => group.groupId === 'combat-generated-assets').tasks.every(task => task.status === 'ready-for-qa'), true)
  assert.equal(audit.fitReadiness.rows.find(row => row.fitId === 'creator-reality-brackets').statuses.liveData, 'qvac-local-ready')
  assert.equal(audit.fitReadiness.rows.find(row => row.fitId === 'mma-boxing-fight-card').combatCardModes.some(mode => mode.modeId === 'qvac-combat-card' && mode.status === 'qvac-local-ready'), true)
  assert.equal(audit.fitReadiness.rows.find(row => row.fitId === 'mma-boxing-fight-card').blockers.some(blocker => blocker.blockerId === 'generated-assets'), false)
})

test('standup audit renders a static HTML report', () => {
  const audit = standupAudit.createUltimateSportsStandupAudit({
    generatedAt: '2026-07-04T00:00:00.000Z'
  })
  const html = standupAudit.renderStandupAuditHtml(audit)

  assert.match(html, /Ultimate Sports Standup Audit/)
  assert.match(html, /Event Fit Coverage/)
  assert.match(html, /Grind List/)
  assert.match(html, /Grind Matrix/)
  assert.match(html, /Actionable Backlog/)
  assert.match(html, /Launch Readiness Gates/)
  assert.match(html, /Fit Readiness Matrix/)
  assert.equal(html.includes('world-cup'), true)
  assert.equal(html.includes('sailgp-companion'), true)

  const markdown = standupAudit.renderGrindBacklogMarkdown(audit)
  assert.match(markdown, /Ultimate Sports Grind Backlog/)
  assert.match(markdown, /US-GRIND-001/)
  assert.match(markdown, /Expected evidence/)
})

test('platform facade exposes the standup audit', () => {
  const app = platform.createUltimateSportsPlatform()
  const audit = app.createStandupAudit({
    generatedAt: '2026-07-04T00:00:00.000Z'
  })

  assert.equal(audit.auditVersion, standupAudit.STANDUP_AUDIT_VERSION)
  assert.equal(audit.summary.fitCount, catalog.listEventFits().length)
})

test('standup CLI parser and docs name the generated report contract', () => {
  const parsed = standupScript.parseArgs([
    '--out-dir',
    '/tmp/ultimate-sports',
    '--backlog',
    '/tmp/backlog.md',
    '--generated-at',
    '2026-07-04T00:00:00.000Z',
    '--no-html'
  ])

  assert.equal(parsed.outDir, '/tmp/ultimate-sports')
  assert.equal(parsed.backlog, '/tmp/backlog.md')
  assert.equal(parsed.generatedAt, '2026-07-04T00:00:00.000Z')
  assert.equal(parsed.html, false)
  ;[
    'standup-audit.json',
    'standup-audit.html',
    'standup-grind-backlog.md',
    'audit-mma-card-assets.js',
    'generate-mma-card-standup-assets.js',
    'preview-journey-smoke.js',
    'audit:mma-assets',
    'generate:mma-assets',
    'smoke:ultimate-preview',
    'sports-data-smoke.js',
    'grindMatrix',
    'grindBacklog',
    'Launch Readiness Gates',
    'Fit Readiness Matrix',
    'fitReadiness',
    'createUltimateSportsStandupAudit',
    'renderStandupAuditHtml',
    'renderGrindBacklogMarkdown'
  ].forEach(term => {
    assert.equal(doc.includes(term), true, `${term} missing from standup audit doc`)
  })
})
