#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const http = require('node:http')
const https = require('node:https')
const path = require('node:path')
const { createUltimateSportsAppServer } = require('./serve-app')
const { writeUltimateSportsAppSnapshot } = require('./export-app-snapshot')

const REPORT_VERSION = 'ultimate-sports-preview-journey-smoke-v1'
const DEFAULT_OUT_DIR = 'platform/ultimate-sports/generated-reports'
const DEFAULT_TIMEOUT_MS = 5_000
const PREVIEW_SURFACES = Object.freeze(['landing', 'server', 'demo', 'dashboard', 'fits', 'tournaments', 'surfaces', 'design', 'aggregator', 'mma', 'grind'])

async function runUltimateSportsPreviewJourneySmoke (input = {}) {
  const rootDir = input.rootDir || path.resolve(__dirname, '..')
  const generatedAt = input.generatedAt || new Date().toISOString()
  const timeoutMs = Number.isInteger(input.timeoutMs) ? input.timeoutMs : DEFAULT_TIMEOUT_MS
  const checks = []
  let server = null
  let baseUrl = input.url ? normalizeBaseUrl(input.url) : null

  try {
    if (!baseUrl) {
      writeUltimateSportsAppSnapshot({ rootDir, generatedAt })
      server = createUltimateSportsAppServer({ rootDir, refreshSnapshot: false })
      baseUrl = await listenOnEphemeralPort(server)
    }

    const resources = await fetchPreviewResources({ baseUrl, timeoutMs })
    addResourceChecks(checks, resources)

    const snapshot = parseSnapshot(resources.snapshot && resources.snapshot.text, checks)
    addStaticContractChecks(checks, resources)
    if (snapshot) addJourneyChecks(checks, snapshot)
    addDemoJourneyChecks(checks, resources)

    const report = createReport({
      generatedAt,
      baseUrl,
      mode: input.url ? 'served-url' : 'ephemeral-server',
      checks,
      snapshot
    })

    if (input.outFile) writeReport(input.outFile, report)
    return report
  } finally {
    if (server) await closeServer(server)
  }
}

async function fetchPreviewResources ({ baseUrl, timeoutMs }) {
  return {
    index: await fetchText(new URL('./', baseUrl), timeoutMs),
    styles: await fetchText(new URL('./styles.css', baseUrl), timeoutMs),
    app: await fetchText(new URL('./app.js', baseUrl), timeoutMs),
    snapshot: await fetchText(new URL('./data/ultimate-sports-snapshot.json', baseUrl), timeoutMs),
    fightCardBoard: await fetchText(new URL('./assets/fight-card-board.svg', baseUrl), timeoutMs),
    demoState: await fetchJson(new URL('./api/demo/state', baseUrl), timeoutMs),
    demoRun: await fetchJson(new URL('./api/demo/run-day-in-life', baseUrl), timeoutMs, {
      method: 'POST',
      body: '{}',
      headers: {
        'content-type': 'application/json'
      }
    })
  }
}

function addResourceChecks (checks, resources) {
  addCheck(checks, {
    checkId: 'files:index',
    title: 'Preview index loads',
    ok: isOkResource(resources.index) && resources.index.text.includes('./app.js') && resources.index.text.includes('./styles.css'),
    evidence: isOkResource(resources.index)
      ? 'Preview index returned HTTP 200 and references the app and stylesheet.'
      : resourceFailure(resources.index, 'Preview index did not load.')
  })
  addCheck(checks, {
    checkId: 'files:styles',
    title: 'Preview stylesheet loads',
    ok: isOkResource(resources.styles) && resources.styles.text.includes('.app-shell'),
    evidence: isOkResource(resources.styles)
      ? 'Preview stylesheet returned HTTP 200 and contains the shell styles.'
      : resourceFailure(resources.styles, 'Preview stylesheet did not load.')
  })
  addCheck(checks, {
    checkId: 'files:app-js',
    title: 'Preview app script loads',
    ok: isOkResource(resources.app) && resources.app.text.includes('renderAggregator') && resources.app.text.includes('renderMma') && resources.app.text.includes('renderTournaments'),
    evidence: isOkResource(resources.app)
      ? 'Preview app script returned HTTP 200 and includes aggregator/MMA/tournament render paths.'
      : resourceFailure(resources.app, 'Preview app script did not load.')
  })
  addCheck(checks, {
    checkId: 'files:snapshot',
    title: 'Generated snapshot loads',
    ok: isOkResource(resources.snapshot) && resources.snapshot.text.includes('ultimate-sports-app-snapshot-v1'),
    evidence: isOkResource(resources.snapshot)
      ? 'Generated snapshot returned HTTP 200 and includes the expected snapshot version.'
      : resourceFailure(resources.snapshot, 'Generated snapshot did not load.')
  })
  addCheck(checks, {
    checkId: 'files:fight-card-asset',
    title: 'MMA board asset loads',
    ok: isOkResource(resources.fightCardBoard) && /<svg\b/i.test(resources.fightCardBoard.text),
    evidence: isOkResource(resources.fightCardBoard)
      ? 'Fight-card board SVG returned HTTP 200.'
      : resourceFailure(resources.fightCardBoard, 'Fight-card board SVG did not load.')
  })
  addCheck(checks, {
    checkId: 'api:live-demo-state',
    title: 'Live demo API returns facade state',
    ok: isOkJsonResource(resources.demoState) && resources.demoState.json.source === 'live-facade',
    evidence: isOkJsonResource(resources.demoState)
      ? `Live demo API returned ${resources.demoState.json.runtime.eventCount} runtime events before scenario execution.`
      : resourceFailure(resources.demoState, 'Live demo state API did not return valid JSON.')
  })
}

function addStaticContractChecks (checks, resources) {
  const index = resources.index && resources.index.text || ''
  const app = resources.app && resources.app.text || ''
  const styles = resources.styles && resources.styles.text || ''
  const board = resources.fightCardBoard && resources.fightCardBoard.text || ''

  addCheck(checks, {
    checkId: 'shell:surfaces',
    title: 'Preview navigation exposes every standup surface',
    ok: PREVIEW_SURFACES.every(surfaceId => index.includes(`data-surface="${surfaceId}"`) && index.includes(`id="${surfaceId}"`)),
    evidence: `Checked ${PREVIEW_SURFACES.length} preview surfaces in the served HTML.`
  })
  addCheck(checks, {
    checkId: 'shell:csp',
    title: 'Preview shell keeps a local-only CSP',
    ok: index.includes('Content-Security-Policy') && index.includes("default-src 'self'") && index.includes("connect-src 'self'"),
    evidence: 'Preview HTML declares a self-scoped content security policy for local standup.'
  })
  addCheck(checks, {
    checkId: 'shell:render-paths',
    title: 'Preview script contains all journey render paths',
    ok: ['renderLanding', 'renderServer', 'renderDemo', 'renderDashboard', 'renderFits', 'renderTournaments', 'renderSurfaces', 'renderDesignSystem', 'renderAggregator', 'renderMma', 'renderGrind', 'setSurface'].every(name => app.includes(name)),
    evidence: 'The app script contains play, server, live demo, dashboard, fit, tournament, surface, design, aggregator, MMA, grind, and navigation render paths.'
  })
  addCheck(checks, {
    checkId: 'shell:responsive-layout',
    title: 'Preview stylesheet includes responsive layout rules',
    ok: styles.includes('@media') && styles.includes('grid-template-columns') && styles.includes('.surface.is-active'),
    evidence: 'The stylesheet contains grid layout, active-surface, and responsive media rules.'
  })
  addCheck(checks, {
    checkId: 'shell:non-branded-combat-art',
    title: 'Combat artwork avoids unlicensed promotion marks',
    ok: !/\b(UFC|ESPN|Dana White|Octagon)\b/i.test(board),
    evidence: 'The generated SVG board contract does not include UFC, broadcaster, promoter, or venue marks.'
  })
}

function addJourneyChecks (checks, snapshot) {
  const audit = snapshot.audit || {}
  const catalog = snapshot.catalog || {}
  const routes = snapshot.aggregator && snapshot.aggregator.routes || []
  const sources = snapshot.aggregator && snapshot.aggregator.sources || []
  const clients = snapshot.sportsDataClients && snapshot.sportsDataClients.clients || []
  const smoke = snapshot.sportsDataSmoke || null
  const mma = snapshot.assets && snapshot.assets.mma || {}
  const fitRows = audit.fitRows || []
  const fitReadiness = audit.fitReadiness || null
  const grind = audit.grindList || []
  const grindMatrix = audit.grindMatrix || null
  const grindBacklog = audit.grindBacklog || null

  addCheck(checks, {
    checkId: 'journey:dashboard',
    title: 'Dashboard journey has a product-readiness picture',
    ok: Number(audit.summary && audit.summary.coveragePercent) >= 90 &&
      audit.launchReadiness &&
      audit.launchReadiness.summary &&
      audit.launchReadiness.summary.currentLevelId === 'demo-product-ready' &&
      audit.launchReadiness.summary.nextBlockedGateId === 'provider-live-data-ready' &&
      fitReadiness &&
      fitReadiness.summary &&
      fitReadiness.summary.fitCount === (catalog.eventFits || []).length &&
      Array.isArray(snapshot.runtime && snapshot.runtime.scenarioRuns) &&
      snapshot.runtime.scenarioRuns.every(run => run.ok),
    evidence: `${audit.summary && audit.summary.coveragePercent}% coverage with ${snapshot.runtime && snapshot.runtime.scenarioRuns ? snapshot.runtime.scenarioRuns.length : 0} scenario replays. Current readiness: ${audit.launchReadiness && audit.launchReadiness.summary ? audit.launchReadiness.summary.currentLevelId : 'missing'}. Fit readiness rows: ${fitReadiness && fitReadiness.summary ? fitReadiness.summary.fitCount : 0}.`
  })
  addCheck(checks, {
    checkId: 'journey:event-fits',
    title: 'Event-fit journey covers the designated sports catalog',
    ok: Array.isArray(catalog.eventFits) &&
      catalog.eventFits.length > 0 &&
      catalog.eventFits.every(fit => fitRows.some(row => row.fitId === fit.fitId && row.launch.launchable)),
    evidence: `${catalog.eventFits ? catalog.eventFits.length : 0} catalog fits have launchable audit rows.`
  })
  addCheck(checks, {
    checkId: 'journey:tournament-lobby',
    title: 'Tournament lobby journey exposes every event-fit shell',
    ok: Array.isArray(snapshot.tournamentShells) &&
      snapshot.tournamentShells.length === catalog.eventFits.length &&
      Array.isArray(snapshot.experienceProfiles) &&
      snapshot.experienceProfiles.length === catalog.eventFits.length &&
      Array.isArray(snapshot.miniGameSuites) &&
      snapshot.miniGameSuites.length === catalog.eventFits.length &&
      Array.isArray(snapshot.assetPacks) &&
      snapshot.assetPacks.length === catalog.eventFits.length,
    evidence: `${snapshot.tournamentShells ? snapshot.tournamentShells.length : 0} tournament shells, ${snapshot.experienceProfiles ? snapshot.experienceProfiles.length : 0} experience profiles, ${snapshot.miniGameSuites ? snapshot.miniGameSuites.length : 0} mini-game suites, ${snapshot.assetPacks ? snapshot.assetPacks.length : 0} asset packs.`
  })
  addCheck(checks, {
    checkId: 'journey:surface-browser',
    title: 'Surface browser journey exposes all product surfaces',
    ok: Array.isArray(snapshot.navigation) &&
      snapshot.navigation.length > 0 &&
      snapshot.navigation.every(item => snapshot.surfaces && snapshot.surfaces[item.surfaceId]),
    evidence: `${snapshot.navigation ? snapshot.navigation.length : 0} product surfaces available in the snapshot.`
  })
  addCheck(checks, {
    checkId: 'journey:fit-readiness',
    title: 'Fit readiness journey separates API blockers from QVAC lanes',
    ok: fitReadiness &&
      fitReadiness.summary &&
      fitReadiness.summary.demoReadyCount === (catalog.eventFits || []).length &&
      fitReadiness.summary.settlementReadyCount === (catalog.eventFits || []).length &&
      fitReadiness.summary.providerBlockedFitCount > 0 &&
      fitReadiness.summary.qvacLocalReadyCount >= 3 &&
      fitReadiness.rows.some(row => row.fitId === 'mma-boxing-fight-card' &&
        row.combatCardModes.some(mode => mode.modeId === 'qvac-combat-card' && mode.status === 'qvac-local-ready')) &&
      fitReadiness.rows.some(row => row.fitId === 'creator-reality-brackets' && row.statuses.liveData === 'qvac-local-ready'),
    evidence: fitReadiness && fitReadiness.summary
      ? `${fitReadiness.summary.providerBlockedFitCount} provider-blocked fits, ${fitReadiness.summary.qvacLocalReadyCount} QVAC-local fits, ${fitReadiness.summary.assetBlockedFitCount} asset-blocked fits.`
      : 'Fit readiness matrix is missing from the snapshot.'
  })
  addCheck(checks, {
    checkId: 'journey:aggregator',
    title: 'Aggregator journey exposes routes, clients, and smoke status',
    ok: routes.length === (catalog.eventFits || []).length &&
      clients.some(client => client.sourceId === 'sportsdataio-mma') &&
      clients.some(client => client.sourceId === 'sailgp-partner-feed') &&
      smoke &&
      smoke.summary &&
      smoke.summary.apiChecks > 0 &&
      smoke.latestReport &&
      smoke.latestReport.summary &&
      smoke.latestReport.summary.passedChecks === smoke.latestReport.summary.totalChecks &&
      smoke.latestReport.summary.skipped === 0,
    evidence: `${routes.length} routes, ${clients.length} clients, smoke status ${smoke ? smoke.overallStatus : 'missing'}, latest report ${smoke && smoke.latestReport ? smoke.latestReport.overallStatus : 'missing'}.`
  })
  addCheck(checks, {
    checkId: 'journey:sailgp',
    title: 'SailGP companion remains represented in data coverage',
    ok: routes.some(route => route.fitId === 'sailgp-companion' && route.sourceIds.includes('sailgp-partner-feed')) &&
      sources.some(source => source.sourceId === 'sailgp-partner-feed'),
    evidence: 'SailGP route uses the partner-feed source with fallback coverage in the aggregator snapshot.'
  })
  addCheck(checks, {
    checkId: 'journey:mma-card',
    title: 'MMA card journey has assets and combat data route',
    ok: mma.assetCount >= 9 &&
      mma.queueCount > mma.assetCount &&
      audit.generatedAssets &&
      audit.generatedAssets.mmaCard &&
      audit.generatedAssets.mmaCard.generationHandoff &&
      audit.generatedAssets.mmaCard.generationHandoff.queueJobCount === mma.queueCount &&
      routes.some(route => route.fitId === 'mma-boxing-fight-card' && route.primarySourceId === 'sportsdataio-mma'),
    evidence: `${mma.assetCount || 0} MMA assets, ${mma.queueCount || 0} Higgsfield image/video jobs, SportsDataIO MMA primary route.`
  })
  addCheck(checks, {
    checkId: 'journey:grind-list',
    title: 'Grind journey keeps real blockers visible',
    ok: grind.some(item => item.title === 'Verify provider credentials and contracts with live smoke checks' && item.status === 'open') &&
      grind.some(item => item.title === 'Generate and QA sport-specific asset packs' && item.status === 'covered') &&
      grind.some(item => item.title === 'Secure SailGP and premium sports data access' && item.status === 'open') &&
      grindMatrix &&
      grindMatrix.groups &&
      grindMatrix.groups.some(group => group.groupId === 'provider-live-smoke') &&
      grindMatrix.groups.some(group => group.groupId === 'combat-generated-assets') &&
      grindMatrix.groups.find(group => group.groupId === 'combat-generated-assets').tasks.every(task => task.status === 'ready-for-qa') &&
      grindBacklog &&
      grindBacklog.summary &&
      grindBacklog.summary.ticketCount >= grindMatrix.summary.openTaskCount &&
      grindBacklog.tickets.some(ticket => ticket.ticketId === 'US-GRIND-001'),
    evidence: `${grind.filter(item => item.status !== 'covered').length} open grind items, ${grindMatrix && grindMatrix.summary ? grindMatrix.summary.openTaskCount : 0} concrete grind tasks, and ${grindBacklog && grindBacklog.summary ? grindBacklog.summary.ticketCount : 0} backlog tickets remain visible in the preview snapshot.`
  })
}

function addDemoJourneyChecks (checks, resources) {
  const before = isOkJsonResource(resources.demoState) ? resources.demoState.json : null
  const after = isOkJsonResource(resources.demoRun) ? resources.demoRun.json : null
  addCheck(checks, {
    checkId: 'journey:live-demo',
    title: 'Live demo journey mutates actual app runtime',
    ok: before &&
      after &&
      before.source === 'live-facade' &&
      after.source === 'live-facade' &&
      after.runtime.eventCount > before.runtime.eventCount &&
      after.viewSummary.competitionCount >= 1 &&
      after.viewSummary.poolCount >= 2 &&
      after.viewSummary.roomCount >= 1 &&
      after.viewSummary.walletCount >= 2 &&
      after.appliedScenarios.some(run => run.scenarioId === 'ultimate-day-in-life' && run.eventCount > 0),
    evidence: after
      ? `Live demo moved from ${before ? before.runtime.eventCount : 'unknown'} to ${after.runtime.eventCount} events with ${after.viewSummary.competitionCount} competitions, ${after.viewSummary.poolCount} pools, ${after.viewSummary.roomCount} rooms, and ${after.viewSummary.walletCount} wallets.`
      : resourceFailure(resources.demoRun, 'Live demo day-in-life API did not return valid JSON.')
  })
}

function createReport ({ generatedAt, baseUrl, mode, checks, snapshot }) {
  const failed = checks.filter(check => check.status !== 'passed')
  const summary = {
    totalChecks: checks.length,
    passedChecks: checks.length - failed.length,
    failedChecks: failed.length,
    fileChecks: checks.filter(check => check.checkId.startsWith('files:')).length,
    shellChecks: checks.filter(check => check.checkId.startsWith('shell:')).length,
    journeyChecks: checks.filter(check => check.checkId.startsWith('journey:')).length,
    coveragePercent: snapshot && snapshot.audit && snapshot.audit.summary
      ? snapshot.audit.summary.coveragePercent
      : 0,
    openGapCount: snapshot && snapshot.audit && snapshot.audit.summary
      ? snapshot.audit.summary.topGapCount
      : 0
  }

  return {
    reportVersion: REPORT_VERSION,
    generatedAt,
    mode,
    url: baseUrl.href,
    overallStatus: failed.length === 0 ? 'passed' : 'failed',
    summary,
    checks
  }
}

function addCheck (checks, input) {
  checks.push({
    checkId: input.checkId,
    title: input.title,
    status: input.ok ? 'passed' : 'failed',
    evidence: input.evidence
  })
}

function parseSnapshot (text, checks) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (error) {
    addCheck(checks, {
      checkId: 'files:snapshot-json',
      title: 'Generated snapshot is valid JSON',
      ok: false,
      evidence: `Snapshot JSON parse failed: ${error.message}`
    })
    return null
  }
}

function isOkResource (resource) {
  return resource && resource.ok && resource.statusCode === 200
}

function isOkJsonResource (resource) {
  return isOkResource(resource) && resource.json && !resource.parseError
}

function resourceFailure (resource, fallback) {
  if (!resource) return fallback
  if (resource.error) return `${fallback} ${resource.error}`
  if (resource.parseError) return `${fallback} JSON parse failed: ${resource.parseError}`
  return `${fallback} HTTP ${resource.statusCode || 'unknown'}.`
}

function writeReport (outFile, report) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`)
}

function listenOnEphemeralPort (server) {
  return new Promise((resolve, reject) => {
    const onError = error => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      const address = server.address()
      resolve(new URL(`http://127.0.0.1:${address.port}/`))
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(0, '127.0.0.1')
  })
}

function closeServer (server) {
  return new Promise(resolve => {
    server.close(() => resolve())
  })
}

function fetchText (url, timeoutMs, input = {}) {
  return new Promise(resolve => {
    const client = url.protocol === 'https:' ? https : http
    const req = client.request(url, {
      method: input.method || 'GET',
      timeout: timeoutMs,
      headers: input.headers || {}
    }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          headers: res.headers,
          text: body.toString('utf8')
        })
      })
    })
    if (input.body) req.write(input.body)
    req.on('timeout', () => {
      req.destroy(new Error(`timed out after ${timeoutMs}ms`))
    })
    req.on('error', error => {
      resolve({
        ok: false,
        statusCode: 0,
        headers: {},
        text: '',
        error: error.message
      })
    })
    req.end()
  })
}

async function fetchJson (url, timeoutMs, input = {}) {
  const resource = await fetchText(url, timeoutMs, input)
  if (!resource.text) return resource
  try {
    return {
      ...resource,
      json: JSON.parse(resource.text)
    }
  } catch (error) {
    return {
      ...resource,
      parseError: error.message
    }
  }
}

function normalizeBaseUrl (value) {
  const url = value instanceof URL ? new URL(value.href) : new URL(String(value))
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  url.search = ''
  url.hash = ''
  return url
}

function parseArgs (argv = process.argv.slice(2)) {
  const options = {
    fail: true
  }
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--url') options.url = argv[++index]
    else if (item === '--out-dir') options.outDir = argv[++index]
    else if (item === '--json') options.json = argv[++index]
    else if (item === '--generated-at') options.generatedAt = argv[++index]
    else if (item === '--timeout-ms') options.timeoutMs = Number(argv[++index])
    else if (item === '--no-fail') options.fail = false
  }
  return options
}

async function main (argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const outDir = path.resolve(options.outDir || DEFAULT_OUT_DIR)
  const outFile = path.resolve(options.json || path.join(outDir, 'preview-journey-smoke.json'))
  const report = await runUltimateSportsPreviewJourneySmoke({
    url: options.url,
    generatedAt: options.generatedAt,
    timeoutMs: options.timeoutMs,
    outFile
  })

  process.stdout.write(`Ultimate sports preview journey smoke: ${report.overallStatus}\n`)
  process.stdout.write(`JSON: ${outFile}\n`)
  process.stdout.write(`URL: ${report.url}\n`)
  process.stdout.write(`Checks: ${report.summary.passedChecks}/${report.summary.totalChecks}\n`)
  process.stdout.write(`Coverage: ${report.summary.coveragePercent}%\n`)

  if (report.overallStatus !== 'passed' && options.fail) {
    process.exitCode = 1
  }

  return report
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Ultimate sports preview journey smoke failed: ${error.message}`)
    process.exit(1)
  })
}

module.exports = {
  REPORT_VERSION,
  PREVIEW_SURFACES,
  runUltimateSportsPreviewJourneySmoke,
  parseArgs,
  main
}
