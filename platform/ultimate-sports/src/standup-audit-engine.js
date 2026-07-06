'use strict'

const fs = require('node:fs')
const path = require('node:path')
const catalog = require('./catalog-engine')
const { cloneJson } = require('./util')

const STANDUP_AUDIT_VERSION = 'ultimate-sports-standup-audit-v1'

const REQUIRED_SURFACES = Object.freeze([
  'home',
  'discover',
  'pools',
  'picks',
  'watch',
  'games',
  'creator',
  'wallet',
  'ops',
  'settings'
])

function createUltimateSportsStandupAudit (input = {}) {
  const platform = getPlatform()
  const verifyPlatform = getVerifyPlatform()
  const rootDir = input.rootDir || path.resolve(__dirname, '..')
  const app = platform.createUltimateSportsPlatform({ peerId: input.userId || 'standup-host' })
  const manifestReport = verifyPlatform({ rootDir })
  const launchMatrix = app.createLaunchMatrix({ maxVariants: 99, maxMiniGames: 99 })
  const miniGameRunMatrix = app.createMiniGameRunMatrix({ settlementMode: input.settlementMode || 'demo' })
  const aggregatorPlan = app.createSportsDataAggregatorPlan()
  const clientPlan = app.createSportsDataClientPlan({ env: input.env || {} })
  const smokePlan = app.createSportsDataSmokePlan({ env: input.env || {}, generatedAt: input.generatedAt })
  const providerPlan = app.createSportsDataProviderPlan()
  const assetPlan = app.createAssetGenerationPlan()
  const mmaGeneratedAssetAudit = app.createMmaCardGeneratedAssetAudit({
    rootDir: path.resolve(rootDir, '..', '..'),
    generatedAt: input.generatedAt
  })
  const experience = app.createExperience({ userId: input.userId || 'standup-host' })
  const scenarioRuns = runScenarioAudit({ manifest: manifestReport.manifest })
  const pearWorkerBridge = createPearWorkerBridgeProof({ rootDir })
  const previewJourneySmoke = createPreviewJourneySmokeProof({ rootDir, manifestReport })
  const fitRows = createFitRows({
    fits: catalog.listEventFits(),
    launchMatrix,
    miniGameRunMatrix,
    aggregatorPlan,
    assetPlan,
    app
  })
  const coverage = createCoverageSummary({
    rootDir,
    manifestReport,
    launchMatrix,
    miniGameRunMatrix,
    aggregatorPlan,
    clientPlan,
    smokePlan,
    providerPlan,
    assetPlan,
    mmaGeneratedAssetAudit,
    experience,
    scenarioRuns,
    fitRows,
    pearWorkerBridge,
    previewJourneySmoke
  })
  const grindList = createGrindList({ rootDir, fitRows, aggregatorPlan, clientPlan, smokePlan, mmaGeneratedAssetAudit, manifestReport, pearWorkerBridge, previewJourneySmoke })
  const grindMatrix = createGrindMatrix({ aggregatorPlan, smokePlan, mmaGeneratedAssetAudit })
  const grindBacklog = createGrindBacklog({ grindList, grindMatrix })
  const fitReadiness = createFitReadinessMatrix({ fitRows, smokePlan, mmaGeneratedAssetAudit })
  const launchReadiness = createLaunchReadinessGates({
    coverage,
    manifestReport,
    fitRows,
    scenarioRuns,
    experience,
    smokePlan,
    mmaGeneratedAssetAudit,
    pearWorkerBridge,
    previewJourneySmoke,
    grindBacklog
  })

  return {
    auditVersion: STANDUP_AUDIT_VERSION,
    generatedAt: input.generatedAt || new Date().toISOString(),
    status: coverage.overallStatus,
    summary: {
      coveragePercent: coverage.coveragePercent,
      fitCount: fitRows.length,
      launchableFits: fitRows.filter(row => row.launch.launchable).length,
      miniGameRunPlans: miniGameRunMatrix.totalPlans,
      aggregatorRoutes: aggregatorPlan.routes.length,
      scenarioPasses: scenarioRuns.filter(run => run.ok).length,
      scenarioCount: scenarioRuns.length,
      openGrindTasks: grindMatrix.summary.openTaskCount,
      backlogTicketCount: grindBacklog.summary.ticketCount,
      launchReadinessLevel: launchReadiness.summary.currentLevelId,
      fitReadinessBlockedFits: fitReadiness.summary.blockedFitCount,
      qvacLocalReadyFits: fitReadiness.summary.qvacLocalReadyCount,
      topGapCount: grindList.filter(item => item.status !== 'covered').length
    },
    coverage,
    fitRows,
    fitReadiness,
    scenarioRuns,
    sourceRoutes: aggregatorPlan.routes.map(route => ({
      fitId: route.fitId,
      primarySourceId: route.primarySourceId,
      sourceIds: route.sourceIds.slice(),
      autoSettlementSourceIds: route.settlement.autoSettlementSourceIds.slice(),
      requiresQvacForPrize: route.settlement.requiresQvacForPrize,
      fallbackOrder: route.fallbackOrder.slice()
    })),
    providerStack: {
      primaryProviderId: providerPlan.recommendation.primaryProviderId,
      requiredSpecialists: providerPlan.recommendation.requiredSpecialists.slice(),
      optionalProviders: providerPlan.recommendation.optionalProviders.slice()
    },
    providerClients: {
      coverage: cloneJson(clientPlan.coverage),
      readySourceIds: clientPlan.liveReadiness.readySourceIds.slice(),
      missingBySource: cloneJson(clientPlan.liveReadiness.missingBySource)
    },
    providerSmoke: {
      overallStatus: smokePlan.overallStatus,
      summary: cloneJson(smokePlan.summary),
      readySourceIds: smokePlan.checks.filter(check => check.status === 'ready-to-run').map(check => check.sourceId),
      readinessBySource: Object.fromEntries(smokePlan.checks.map(check => [check.sourceId, {
        status: check.status,
        nextAction: check.nextAction,
        expectedEvidence: check.expectedEvidence,
        acceptanceCriteria: check.acceptanceCriteria.slice(),
        missingEnv: check.request.missingEnv.slice()
      }])),
      blockedBySource: Object.fromEntries(smokePlan.checks
          .filter(check => check.blockers.length > 0)
          .map(check => [check.sourceId, check.blockers.map(blocker => blocker.blockerType)]))
    },
    generatedAssets: {
      mmaCard: {
        overallStatus: mmaGeneratedAssetAudit.overallStatus,
        summary: cloneJson(mmaGeneratedAssetAudit.summary),
        generationHandoff: cloneJson(mmaGeneratedAssetAudit.generationHandoff),
        nextSteps: mmaGeneratedAssetAudit.nextSteps.slice(),
        reportPath: 'platform/ultimate-sports/generated-reports/mma-card-generated-assets.json'
      }
    },
    previewJourneySmoke: cloneJson(previewJourneySmoke),
    pearWorkerBridge: cloneJson(pearWorkerBridge),
    appSurfaceSnapshot: summarizeSurfaces(experience.surfaces || {}),
    grindList,
    grindMatrix,
    grindBacklog,
    launchReadiness,
    commands: {
      verify: 'node platform/ultimate-sports/scripts/verify-platform.js',
      fullTests: 'node -e "const { spawnSync } = require(\'node:child_process\'); const manifest = require(\'./platform/ultimate-sports/platform.manifest.json\'); const result = spawnSync(manifest.testCommand[0], manifest.testCommand.slice(1), { stdio: \'inherit\' }); process.exit(result.status || 0)"',
      previewJourneySmoke: 'node platform/ultimate-sports/scripts/preview-journey-smoke.js',
      mmaAssetAudit: 'node platform/ultimate-sports/scripts/audit-mma-card-assets.js',
      sportsDataSmoke: 'node platform/ultimate-sports/scripts/sports-data-smoke.js',
      grindBacklog: 'node platform/ultimate-sports/scripts/standup-audit.js',
      standupAudit: 'node platform/ultimate-sports/scripts/standup-audit.js'
    }
  }
}

function renderStandupAuditHtml (audit) {
  const score = Number(audit.summary.coveragePercent || 0)
  const gapRows = audit.grindList.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.title)}</strong><br><span>${escapeHtml(item.area)}</span></td>
      <td>${escapeHtml(item.priority)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.evidence)}</td>
      <td>${escapeHtml(item.nextStep)}</td>
    </tr>`).join('')
  const grindMatrixRows = (audit.grindMatrix && audit.grindMatrix.groups || []).flatMap(group => {
    return group.tasks.map(task => `
    <tr>
      <td><strong>${escapeHtml(group.title)}</strong><br><span>${escapeHtml(task.taskId)}</span></td>
      <td>${escapeHtml(task.title)}</td>
      <td>${escapeHtml(task.status)}</td>
      <td>${escapeHtml(task.nextAction)}</td>
      <td><code>${escapeHtml(task.command || group.command || '')}</code></td>
    </tr>`)
  }).join('')
  const backlogRows = (audit.grindBacklog && audit.grindBacklog.tickets || []).map(ticket => `
    <tr>
      <td><strong>${escapeHtml(ticket.ticketId)}</strong><br><span>${escapeHtml(ticket.ownerLane)}</span></td>
      <td><strong>${escapeHtml(ticket.title)}</strong><br><span>${escapeHtml(ticket.workstream)}</span></td>
      <td>${escapeHtml(ticket.priority)}</td>
      <td>${escapeHtml(ticket.status)}</td>
      <td>${escapeHtml(ticket.nextAction)}<br><span>${escapeHtml(ticket.expectedEvidence)}</span></td>
      <td><code>${escapeHtml(ticket.command || '')}</code></td>
    </tr>`).join('')
  const readinessRows = (audit.launchReadiness && audit.launchReadiness.gates || []).map(gate => `
    <tr>
      <td><strong>${escapeHtml(gate.title)}</strong><br><span>${escapeHtml(gate.gateId)}</span></td>
      <td>${escapeHtml(gate.status)}</td>
      <td>${escapeHtml(gate.evidence)}</td>
      <td>${gate.blockers.length ? gate.blockers.map(blocker => escapeHtml(blocker)).join('<br>') : '<span>none</span>'}</td>
      <td><code>${escapeHtml(gate.command || '')}</code></td>
    </tr>`).join('')
  const fitReadinessRows = (audit.fitReadiness && audit.fitReadiness.rows || []).map(row => `
    <tr>
      <td><strong>${escapeHtml(row.title)}</strong><br><span>${escapeHtml(row.fitId)}</span></td>
      <td>${escapeHtml(row.sourceMode)}</td>
      <td>${escapeHtml(row.statuses.demo)}</td>
      <td>${escapeHtml(row.statuses.liveData)}<br><span>${escapeHtml(row.providerSourceIds.join(', ') || 'no provider required')}</span></td>
      <td>${escapeHtml(row.statuses.settlement)}<br><span>${escapeHtml(row.settlementMode)}</span></td>
      <td>${escapeHtml(row.statuses.assets)}</td>
      <td>${row.qvacRefereeLane.active ? 'yes' : 'no'}<br><span>${escapeHtml(row.qvacRefereeLane.evidenceSourceIds.join(', ') || 'none')}</span></td>
      <td>${escapeHtml(row.nextAction)}</td>
    </tr>`).join('')
  const fitRows = audit.fitRows.map(row => `
    <tr>
      <td><strong>${escapeHtml(row.title)}</strong><br><span>${escapeHtml(row.fitId)}</span></td>
      <td>${escapeHtml(row.category)}</td>
      <td>${row.launch.launchable ? 'yes' : 'no'}</td>
      <td>${row.launch.variantCoverage.covered}/${row.launch.variantCoverage.total}</td>
      <td>${row.miniGames.covered}/${row.miniGames.total}</td>
      <td>${escapeHtml(row.data.primarySourceId)}<br><span>${escapeHtml(row.data.settlement)}</span></td>
      <td>${row.shell.hasShell ? 'yes' : 'no'}</td>
      <td>${row.assets.requiredAssets}</td>
    </tr>`).join('')
  const coverageCards = audit.coverage.areas.map(area => `
    <section class="metric">
      <div class="metric-value">${escapeHtml(String(area.covered))}/${escapeHtml(String(area.total))}</div>
      <div class="metric-label">${escapeHtml(area.title)}</div>
      <p>${escapeHtml(area.evidence)}</p>
    </section>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ultimate Sports Standup Audit</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17211c;
      --muted: #637068;
      --line: #d9e0dc;
      --panel: #ffffff;
      --wash: #f5f7f2;
      --accent: #0f766e;
      --warn: #b45309;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--wash);
    }
    header {
      padding: 28px clamp(18px, 5vw, 56px) 18px;
      border-bottom: 1px solid var(--line);
      background: #ffffff;
    }
    h1 { margin: 0 0 6px; font-size: clamp(28px, 5vw, 48px); letter-spacing: 0; }
    h2 { margin: 0 0 14px; font-size: 20px; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); max-width: 860px; }
    main { padding: 24px clamp(18px, 5vw, 56px) 44px; }
    .scoreline {
      display: grid;
      grid-template-columns: minmax(180px, 260px) 1fr;
      gap: 18px;
      align-items: stretch;
      margin-bottom: 24px;
    }
    .score, .metric, .section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .score { padding: 20px; }
    .score strong { display: block; font-size: 44px; color: var(--accent); letter-spacing: 0; }
    .score span { color: var(--muted); }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
    }
    .metric { padding: 16px; min-height: 116px; }
    .metric-value { font-size: 24px; font-weight: 700; color: var(--ink); }
    .metric-label { font-weight: 700; margin-bottom: 6px; }
    .metric p { font-size: 12px; }
    .section { margin-top: 18px; overflow: hidden; }
    .section > h2 { padding: 18px 18px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 11px 12px; text-align: left; vertical-align: top; border-top: 1px solid var(--line); }
    th { font-size: 12px; color: var(--muted); background: #fafbf8; }
    td span { color: var(--muted); font-size: 12px; }
    code { background: #edf2ee; border: 1px solid var(--line); border-radius: 4px; padding: 1px 4px; }
    .commands { display: grid; gap: 8px; padding: 0 18px 18px; }
    .commands code { display: block; overflow-wrap: anywhere; padding: 10px; }
    @media (max-width: 760px) {
      .scoreline { grid-template-columns: 1fr; }
      table { font-size: 12px; }
      th, td { padding: 9px 8px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Ultimate Sports Standup Audit</h1>
    <p>Generated ${escapeHtml(audit.generatedAt)}. This report boots the isolated v2 facade, walks every event fit, checks launch and mini-game coverage, confirms data aggregator routes, and lists the remaining grind.</p>
  </header>
  <main>
    <div class="scoreline">
      <section class="score">
        <strong>${score}%</strong>
        <span>${escapeHtml(audit.status)} coverage score</span>
      </section>
      <div class="metrics">${coverageCards}</div>
    </div>
    <section class="section">
      <h2>Launch Readiness Gates</h2>
      <table>
        <thead><tr><th>Gate</th><th>Status</th><th>Evidence</th><th>Blockers</th><th>Proof command</th></tr></thead>
        <tbody>${readinessRows}</tbody>
      </table>
    </section>
    <section class="section">
      <h2>Fit Readiness Matrix</h2>
      <table>
        <thead><tr><th>Fit</th><th>Mode</th><th>Demo</th><th>Live data</th><th>Settlement</th><th>Assets</th><th>QVAC referee</th><th>Next step</th></tr></thead>
        <tbody>${fitReadinessRows}</tbody>
      </table>
    </section>
    <section class="section">
      <h2>Event Fit Coverage</h2>
      <table>
        <thead><tr><th>Fit</th><th>Category</th><th>Launch</th><th>Variants</th><th>Mini-games</th><th>Data route</th><th>Shell</th><th>Assets</th></tr></thead>
        <tbody>${fitRows}</tbody>
      </table>
    </section>
    <section class="section">
      <h2>Grind List</h2>
      <table>
        <thead><tr><th>Work</th><th>Priority</th><th>Status</th><th>Evidence</th><th>Next step</th></tr></thead>
        <tbody>${gapRows}</tbody>
      </table>
    </section>
    <section class="section">
      <h2>Grind Matrix</h2>
      <table>
        <thead><tr><th>Group</th><th>Task</th><th>Status</th><th>Next action</th><th>Command</th></tr></thead>
        <tbody>${grindMatrixRows}</tbody>
      </table>
    </section>
    <section class="section">
      <h2>Actionable Backlog</h2>
      <table>
        <thead><tr><th>Ticket</th><th>Work</th><th>Priority</th><th>Status</th><th>Evidence needed</th><th>Command</th></tr></thead>
        <tbody>${backlogRows}</tbody>
      </table>
    </section>
    <section class="section">
      <h2>Commands</h2>
      <div class="commands">
        <code>${escapeHtml(audit.commands.standupAudit)}</code>
        <code>${escapeHtml(audit.commands.previewJourneySmoke)}</code>
        <code>${escapeHtml(audit.commands.mmaAssetAudit)}</code>
        <code>${escapeHtml(audit.commands.sportsDataSmoke)}</code>
        <code>${escapeHtml(audit.commands.verify)}</code>
        <code>${escapeHtml(audit.commands.fullTests)}</code>
      </div>
    </section>
  </main>
</body>
</html>`
}

function createLaunchReadinessGates ({ coverage, manifestReport, fitRows, scenarioRuns, experience, smokePlan, mmaGeneratedAssetAudit, pearWorkerBridge, previewJourneySmoke, grindBacklog }) {
  const surfaces = Object.keys(experience.surfaces || {})
  const allSurfacesPresent = REQUIRED_SURFACES.every(surfaceId => surfaces.includes(surfaceId))
  const allFitsLaunchable = fitRows.every(row => row.launch.launchable)
  const allSettlementPathsReady = fitRows.every(row => row.data.prizeSettlementReady)
  const allScenariosReplay = scenarioRuns.every(run => run.ok)
  const localPreviewReady = manifestReport.ok && previewJourneySmoke.ok && coverage.coveragePercent >= 90
  const demoReady = localPreviewReady && allSurfacesPresent && allFitsLaunchable && allScenariosReplay && allSettlementPathsReady
  const providerBlocked = smokePlan.summary.blocked > 0 || smokePlan.summary.readyToRun < smokePlan.summary.apiChecks
  const providerStatus = providerBlocked ? 'blocked' : 'ready'
  const combatStatus = mmaGeneratedAssetAudit.summary.missingTargets === 0 ? 'ready' : 'blocked'
  const pearStatus = pearWorkerBridge.ok && previewJourneySmoke.ok ? 'ready' : 'blocked'
  const prizeStatus = 'blocked'
  const gates = [
    readinessGate({
      gateId: 'local-preview-ready',
      title: 'Local Preview Standup',
      status: localPreviewReady ? 'passed' : 'blocked',
      evidence: localPreviewReady
        ? `Preview smoke passes and coverage is ${coverage.coveragePercent}%.`
        : `Manifest ok: ${manifestReport.ok}; preview ok: ${previewJourneySmoke.ok}; coverage: ${coverage.coveragePercent}%.`,
      blockers: localPreviewReady ? [] : [
        !manifestReport.ok ? 'Platform manifest verification is failing.' : null,
        !previewJourneySmoke.ok ? 'Preview journey smoke is not passing.' : null,
        coverage.coveragePercent < 90 ? 'Coverage is below product standup threshold.' : null
      ].filter(Boolean),
      command: 'node platform/ultimate-sports/scripts/preview-journey-smoke.js',
      acceptanceCriteria: [
        'Static preview shell loads generated snapshot data.',
        'Preview journey smoke passes every dashboard, fit, aggregator, MMA, SailGP, and grind check.',
        'Standup coverage remains at or above 90%.'
      ]
    }),
    readinessGate({
      gateId: 'demo-product-ready',
      title: 'Replayable Demo Product',
      status: demoReady ? 'passed' : 'blocked',
      evidence: demoReady
        ? `${fitRows.length} event fits launch, ${scenarioRuns.length}/${scenarioRuns.length} scenarios replay, and all required surfaces are present.`
        : `${fitRows.filter(row => row.launch.launchable).length}/${fitRows.length} fits launch; ${scenarioRuns.filter(run => run.ok).length}/${scenarioRuns.length} scenarios replay; surfaces present: ${REQUIRED_SURFACES.filter(surfaceId => surfaces.includes(surfaceId)).length}/${REQUIRED_SURFACES.length}.`,
      blockers: demoReady ? [] : [
        !allSurfacesPresent ? 'One or more required product surfaces are missing from the facade experience.' : null,
        !allFitsLaunchable ? 'One or more event fits does not have a launchable plan.' : null,
        !allScenariosReplay ? 'One or more manifest scenarios does not replay through the facade.' : null,
        !allSettlementPathsReady ? 'One or more event fits lacks a settlement path.' : null
      ].filter(Boolean),
      command: 'node platform/ultimate-sports/scripts/standup-audit.js',
      acceptanceCriteria: [
        'Every catalog fit has launch, pool, mini-game, shell, data, and settlement coverage.',
        'Every manifest scenario replays through the facade.',
        'Home, Discover, Pools, Picks, Watch, Games, Creator, Wallet, Ops, and Settings surfaces are derivable from replay state.'
      ]
    }),
    readinessGate({
      gateId: 'provider-live-data-ready',
      title: 'Live Provider Data',
      status: providerStatus,
      evidence: `${smokePlan.summary.readyToRun}/${smokePlan.summary.apiChecks} API smoke checks are ready; ${smokePlan.summary.blocked} checks blocked; ${smokePlan.summary.localReady} local evidence lanes ready.`,
      blockers: providerBlocked
        ? [
            `${smokePlan.summary.missingCredentials} API checks are missing credentials or provider config.`,
            `${smokePlan.summary.needsOAuthToken} API checks need OAuth/token exchange.`,
            'A redacted passed-live smoke report has not been produced for every API-backed provider.'
          ].filter(blocker => !blocker.startsWith('0 '))
        : ['Run live network smoke and archive the redacted passed-live report before calling this passed.'],
      command: 'node platform/ultimate-sports/scripts/sports-data-smoke.js',
      acceptanceCriteria: [
        'Every API-backed provider has backend-only credentials or a recorded MVP defer decision.',
        'Every required smoke check returns passed-live or has an explicit QVAC/manual fallback policy.',
        'The redacted smoke report stores provider status without credential values.'
      ]
    }),
    readinessGate({
      gateId: 'combat-asset-pack-ready',
      title: 'Combat Generated Asset Pack',
      status: combatStatus,
      evidence: `${mmaGeneratedAssetAudit.summary.presentTargets}/${mmaGeneratedAssetAudit.summary.targetCount} MMA/combat generated outputs are present.`,
      blockers: combatStatus === 'blocked'
        ? [
            `${mmaGeneratedAssetAudit.summary.missingTargets} generated image/video targets are missing.`,
            `${mmaGeneratedAssetAudit.generationHandoff.queueJobCount} Higgsfield jobs still need generation/download/QA.`
          ]
        : ['Visual QA and QVAC/human review evidence must be attached before prize-mode promotion.'],
      command: 'node platform/ultimate-sports/scripts/audit-mma-card-assets.js',
      acceptanceCriteria: mmaGeneratedAssetAudit.generationHandoff.acceptanceCriteria.slice()
    }),
    readinessGate({
      gateId: 'pear-production-integration-ready',
      title: 'Pear Production Integration',
      status: pearStatus,
      evidence: pearWorkerBridge.ok
        ? 'Optional ultimateSports bridge action exists and preview smoke passes; production topic mapping remains a graduation task.'
        : pearWorkerBridge.evidence,
      blockers: pearStatus === 'blocked'
        ? [pearWorkerBridge.evidence]
        : [
            'Final Pear UI routing is still isolated from the current PearCup start flow.',
            'Production Pear topic/storage mapping for v2 rooms is not yet deployed.'
          ],
      command: 'node platform/ultimate-sports/scripts/verify-platform.js',
      acceptanceCriteria: [
        'Existing PearCup start/test flow remains unchanged.',
        'V2 bridge actions remain optional and isolated until migration.',
        'Final production UI and topic mappings are explicitly promoted when the preview graduates.'
      ]
    }),
    readinessGate({
      gateId: 'real-money-prize-mode-ready',
      title: 'Real-money / Prize-mode Readiness',
      status: prizeStatus,
      evidence: 'Real-money remains policy-gated; demo and sponsor-prize models exist, but regulated mode is intentionally disabled.',
      blockers: [
        'Real-money policy flag is disabled by default.',
        'Compliance, payout recipient, processor evidence, live provider smoke, and asset QA evidence must be complete before live prize mode.',
        `${grindBacklog.summary.externalDependencyTicketCount} backlog tickets still depend on external credentials, contracts, or generated assets.`
      ],
      command: 'npm test',
      acceptanceCriteria: [
        'Real-money commands stay blocked until explicit policy opt-in.',
        'Compliance, responsible-play, payout route, provider data, and QVAC evidence gates are complete.',
        'No payout or prize route bypasses replay-bound settlement evidence.'
      ]
    })
  ]
  const firstBlocked = gates.find(gate => gate.status === 'blocked') || null
  const currentGate = gates.slice(0, firstBlocked ? gates.indexOf(firstBlocked) : gates.length).at(-1) || null

  return {
    readinessVersion: 'ultimate-sports-launch-readiness-v1',
    summary: {
      gateCount: gates.length,
      passedGateCount: gates.filter(gate => gate.status === 'passed').length,
      readyGateCount: gates.filter(gate => gate.status === 'ready').length,
      blockedGateCount: gates.filter(gate => gate.status === 'blocked').length,
      currentLevelId: currentGate ? currentGate.gateId : 'not-ready',
      nextBlockedGateId: firstBlocked ? firstBlocked.gateId : null
    },
    gates
  }
}

function readinessGate (input) {
  return {
    gateId: input.gateId,
    title: input.title,
    status: input.status,
    evidence: input.evidence,
    blockers: (input.blockers || []).filter(Boolean),
    command: input.command,
    acceptanceCriteria: (input.acceptanceCriteria || []).slice()
  }
}

function renderGrindBacklogMarkdown (audit) {
  const backlog = audit.grindBacklog || { summary: {}, tickets: [] }
  const lines = [
    '# Ultimate Sports Grind Backlog',
    '',
    `Generated: ${audit.generatedAt}`,
    `Audit status: ${audit.status}`,
    `Coverage: ${audit.summary.coveragePercent}%`,
    `Tickets: ${backlog.summary.ticketCount || 0}`,
    `Blocked: ${backlog.summary.blockedTicketCount || 0}`,
    `Ready: ${backlog.summary.readyTicketCount || 0}`,
    '',
    'This backlog is derived from `grindList` and `grindMatrix` in `standup-audit.json`. It is the operator-facing punch list for standing up the ultimate sports app.',
    ''
  ]
  ;(backlog.workstreams || []).forEach(workstream => {
    lines.push(`## ${markdownText(workstream.title)}`)
    lines.push('')
    lines.push(`- Priority: ${workstream.priority}`)
    lines.push(`- Status: ${workstream.status}`)
    lines.push(`- Tickets: ${workstream.ticketCount}`)
    lines.push(`- Summary: ${markdownText(workstream.summary)}`)
    if (workstream.command) lines.push(`- Command: \`${workstream.command}\``)
    lines.push('')
    backlog.tickets
      .filter(ticket => ticket.workstreamId === workstream.workstreamId)
      .forEach(ticket => {
        lines.push(`### ${ticket.ticketId}: ${markdownText(ticket.title)}`)
        lines.push('')
        lines.push(`- Owner lane: ${ticket.ownerLane}`)
        lines.push(`- Priority: ${ticket.priority}`)
        lines.push(`- Status: ${ticket.status}`)
        if (ticket.sourceId) lines.push(`- Source: \`${ticket.sourceId}\``)
        if (ticket.assetType) lines.push(`- Asset type: \`${ticket.assetType}\``)
        if (ticket.requiredEnv.length) lines.push(`- Required env/config: ${ticket.requiredEnv.map(item => `\`${item}\``).join(', ')}`)
        if (ticket.blockerTypes.length) lines.push(`- Blockers: ${ticket.blockerTypes.map(item => `\`${item}\``).join(', ')}`)
        lines.push(`- Next action: ${markdownText(ticket.nextAction)}`)
        lines.push(`- Expected evidence: ${markdownText(ticket.expectedEvidence)}`)
        if (ticket.command) lines.push(`- Command: \`${ticket.command}\``)
        lines.push('- Acceptance:')
        ticket.acceptanceCriteria.forEach(item => lines.push(`  - ${markdownText(item)}`))
        lines.push('')
      })
  })
  return `${lines.join('\n')}\n`
}

function createFitRows ({ fits, launchMatrix, miniGameRunMatrix, aggregatorPlan, assetPlan, app }) {
  return fits.map(fit => {
    const launchRow = launchMatrix.rows.find(row => row.fitId === fit.fitId)
    const suite = miniGameRunMatrix.suites.find(suite => suite.fitId === fit.fitId)
    const route = aggregatorPlan.routes.find(route => route.fitId === fit.fitId)
    const assetPack = assetPlan.packs.find(pack => pack.fitId === fit.fitId)
    const experience = app.createTournamentExperience({ fitId: fit.fitId })
    const variantTotal = launchRow ? launchRow.variantCoverage.length : 0
    const variantCovered = launchRow ? launchRow.variantCoverage.filter(item => item.coverage !== 'missing').length : 0
    const miniTotal = launchRow ? launchRow.miniGameCoverage.length : 0
    const miniCovered = launchRow ? launchRow.miniGameCoverage.filter(item => item.coverage !== 'missing').length : 0

    return {
      fitId: fit.fitId,
      title: fit.title,
      category: fit.category,
      resultPolicy: fit.resultPolicy,
      launch: {
        launchable: Boolean(launchRow && launchRow.primary.launchable),
        commandCount: launchRow ? launchRow.primary.commandCount : 0,
        activationTaskCount: launchRow ? launchRow.primary.activationTaskCount : 0,
        checklist: launchRow ? launchRow.checklist.slice() : [],
        variantCoverage: {
          covered: variantCovered,
          total: variantTotal,
          percent: percent(variantCovered, variantTotal)
        }
      },
      miniGames: {
        covered: miniCovered,
        total: miniTotal,
        runPlans: suite ? suite.plans.length : 0,
        percent: percent(miniCovered, miniTotal)
      },
      data: {
        primarySourceId: route ? route.primarySourceId : null,
        sourceIds: route ? route.sourceIds.slice() : [],
        autoSettlementSourceIds: route ? route.settlement.autoSettlementSourceIds.slice() : [],
        evidenceSourceIds: route ? route.settlement.evidenceSourceIds.slice() : [],
        prizeSettlementMode: route ? route.settlement.prizeSettlementMode : 'unsupported',
        prizeSettlementReady: Boolean(route && route.settlement.prizeSettlementReady),
        requiresQvacForPrize: Boolean(route && route.settlement.requiresQvacForPrize),
        qvacResultEvidenceRequired: Boolean(route && route.settlement.resultEvidenceContract.required),
        settlement: route && route.settlement.prizeSettlementReady
          ? route.settlement.prizeSettlementMode
          : 'unsupported'
      },
      shell: {
        hasShell: Boolean(experience.gui && experience.server && experience.apiPlan),
        shellId: experience.gui && experience.gui.shellId,
        panels: experience.gui && experience.gui.customPanels ? experience.gui.customPanels.length : 0,
        apiAdapters: experience.apiPlan && experience.apiPlan.adapters ? experience.apiPlan.adapters.length : 0
      },
      assets: {
        requiredAssets: assetPack && assetPack.requiredAssets ? assetPack.requiredAssets.length : 0,
        themeId: assetPack && assetPack.themeId
      }
    }
  })
}

function createFitReadinessMatrix ({ fitRows, smokePlan, mmaGeneratedAssetAudit }) {
  const smokeBySource = new Map((smokePlan.checks || []).map(check => [check.sourceId, check]))
  const rows = fitRows.map(row => createFitReadinessRow({ row, smokeBySource, mmaGeneratedAssetAudit }))

  return {
    matrixVersion: 'ultimate-sports-fit-readiness-v1',
    summary: {
      fitCount: rows.length,
      demoReadyCount: rows.filter(row => row.statuses.demo === 'passed').length,
      settlementReadyCount: rows.filter(row => row.statuses.settlement === 'passed').length,
      liveProviderReadyCount: rows.filter(row => row.statuses.liveData === 'ready-to-smoke').length,
      providerBlockedFitCount: rows.filter(row => row.blockers.some(blocker => blocker.blockerId === 'provider-live-data')).length,
      qvacLocalReadyCount: rows.filter(row => row.statuses.liveData === 'qvac-local-ready').length,
      qvacRefereeLaneCount: rows.filter(row => row.qvacRefereeLane.active).length,
      combatQvacModeCount: rows.flatMap(row => row.combatCardModes).filter(mode => mode.status === 'qvac-local-ready').length,
      assetBlockedFitCount: rows.filter(row => row.blockers.some(blocker => blocker.blockerId === 'generated-assets')).length,
      blockedFitCount: rows.filter(row => row.blockers.length > 0).length,
      fullyReadyFitCount: rows.filter(row => row.blockers.length === 0).length,
      nextBlockedFitId: rows.find(row => row.blockers.length > 0) ? rows.find(row => row.blockers.length > 0).fitId : null
    },
    rows
  }
}

function createFitReadinessRow ({ row, smokeBySource, mmaGeneratedAssetAudit }) {
  const demoPassed = row.launch.launchable &&
    row.shell.hasShell &&
    row.launch.variantCoverage.covered === row.launch.variantCoverage.total &&
    row.miniGames.covered === row.miniGames.total
  const liveData = liveDataReadinessFor({ row, smokeBySource })
  const assets = assetReadinessFor({ row, mmaGeneratedAssetAudit })
  const blockers = [
    !demoPassed
      ? readinessBlocker('demo-plan', 'Demo launch coverage is incomplete.', 'Fill the missing launch, shell, variant, or mini-game coverage.')
      : null,
    !row.data.prizeSettlementReady
      ? readinessBlocker('settlement-path', 'Prize settlement is unsupported.', 'Add source-of-truth auto settlement or a QVAC result-evidence lane.')
      : null,
    liveData.blocker,
    assets.blocker
  ].filter(Boolean)
  const qvacRefereeLane = qvacRefereeLaneFor(row)

  return {
    fitId: row.fitId,
    title: row.title,
    category: row.category,
    sourceMode: liveData.sourceMode,
    statuses: {
      demo: demoPassed ? 'passed' : 'blocked',
      liveData: liveData.status,
      settlement: row.data.prizeSettlementReady ? 'passed' : 'blocked',
      assets: assets.status
    },
    settlementMode: row.data.prizeSettlementMode,
    providerSourceIds: liveData.providerSourceIds.slice(),
    blockedSourceIds: liveData.blockedSourceIds.slice(),
    qvacRefereeLane,
    blockers,
    primaryBlocker: blockers.length ? blockers[0].blockerId : 'none',
    nextAction: nextActionForFitReadiness({ row, liveData, assets, blockers, qvacRefereeLane }),
    evidence: [
      liveData.evidence,
      assets.evidence,
      qvacRefereeLane.active ? qvacRefereeLane.evidence : 'No QVAC referee lane is required for normal settlement.'
    ].join(' '),
    combatCardModes: row.fitId === 'mma-boxing-fight-card'
      ? createCombatCardReadinessModes({ row, liveData })
      : []
  }
}

function liveDataReadinessFor ({ row, smokeBySource }) {
  const autoSourceIds = row.data.autoSettlementSourceIds.slice()
  const evidenceSourceIds = row.data.evidenceSourceIds.slice()
  const autoChecks = autoSourceIds.map(sourceId => sourceCheckView(sourceId, smokeBySource))

  if (autoSourceIds.length === 0 && row.data.prizeSettlementMode === 'qvac-result-evidence') {
    return {
      status: 'qvac-local-ready',
      sourceMode: 'qvac-referee-local',
      providerSourceIds: [],
      blockedSourceIds: [],
      blocker: null,
      evidence: `QVAC result-evidence settlement is local-ready through ${evidenceSourceIds.join(', ') || 'host evidence'}.`
    }
  }

  const blockedChecks = autoChecks.filter(check => isBlockedSourceStatus(check.status))
  if (blockedChecks.length > 0) {
    const status = blockedChecks.some(check => check.status === 'needs-oauth-token')
      ? 'blocked-oauth-token'
      : 'blocked-provider-credentials'
    return {
      status,
      sourceMode: evidenceSourceIds.length > 0 ? 'api-with-qvac-fallback' : 'api-provider',
      providerSourceIds: autoSourceIds,
      blockedSourceIds: blockedChecks.map(check => check.sourceId),
      blocker: readinessBlocker(
        'provider-live-data',
        `${blockedChecks.length}/${autoChecks.length} source-of-truth provider checks are blocked.`,
        `Configure backend credentials for ${blockedChecks.map(check => check.sourceId).join(', ')} and run the sports data smoke.`
      ),
      evidence: `${autoChecks.filter(check => check.status === 'ready-to-run').length}/${autoChecks.length} source-of-truth checks are ready to smoke; QVAC fallback ${evidenceSourceIds.length ? 'is active' : 'is missing'}.`
    }
  }

  if (autoChecks.length > 0 && autoChecks.every(check => check.status === 'ready-to-run')) {
    return {
      status: 'ready-to-smoke',
      sourceMode: evidenceSourceIds.length > 0 ? 'api-with-qvac-fallback' : 'api-provider',
      providerSourceIds: autoSourceIds,
      blockedSourceIds: [],
      blocker: null,
      evidence: `${autoChecks.length}/${autoChecks.length} source-of-truth checks have enough config for a live smoke.`
    }
  }

  if (autoChecks.length > 0) {
    return {
      status: 'unknown-provider-state',
      sourceMode: evidenceSourceIds.length > 0 ? 'api-with-qvac-fallback' : 'api-provider',
      providerSourceIds: autoSourceIds,
      blockedSourceIds: autoChecks.filter(check => check.status !== 'ready-to-run').map(check => check.sourceId),
      blocker: readinessBlocker(
        'provider-live-data',
        'Source-of-truth provider readiness is unknown.',
        'Run the sports data smoke and inspect the redacted provider report.'
      ),
      evidence: `Provider statuses: ${autoChecks.map(check => `${check.sourceId}:${check.status}`).join(', ')}.`
    }
  }

  return {
    status: row.data.prizeSettlementReady ? 'qvac-local-ready' : 'blocked',
    sourceMode: 'qvac-referee-local',
    providerSourceIds: [],
    blockedSourceIds: [],
    blocker: row.data.prizeSettlementReady
      ? null
      : readinessBlocker('settlement-path', 'No provider or evidence settlement path exists.', 'Add a settlement path before prize mode.'),
    evidence: row.data.prizeSettlementReady
      ? 'Local QVAC settlement is ready without provider credentials.'
      : 'No live-data settlement path is ready.'
  }
}

function sourceCheckView (sourceId, smokeBySource) {
  const check = smokeBySource.get(sourceId)
  if (!check) {
    return {
      sourceId,
      status: 'missing-smoke-check',
      blockerTypes: ['missing-smoke-check'],
      missingEnv: []
    }
  }
  return {
    sourceId,
    status: check.status,
    blockerTypes: check.blockers.map(blocker => blocker.blockerType),
    missingEnv: check.request.missingEnv.slice()
  }
}

function isBlockedSourceStatus (status) {
  return status === 'missing-env' ||
    status === 'missing-params' ||
    status === 'needs-oauth-token' ||
    status === 'missing-smoke-check'
}

function assetReadinessFor ({ row, mmaGeneratedAssetAudit }) {
  if (row.fitId !== 'mma-boxing-fight-card') {
    return {
      status: row.assets.requiredAssets > 0 ? 'prompt-ready' : 'not-required',
      blocker: null,
      evidence: `${row.assets.requiredAssets} sport asset prompt targets are in the asset plan.`
    }
  }

  if (mmaGeneratedAssetAudit.summary.missingTargets > 0) {
    return {
      status: 'blocked-generated-assets',
      blocker: readinessBlocker(
        'generated-assets',
        `${mmaGeneratedAssetAudit.summary.missingTargets} combat generated asset targets are missing.`,
        'Run the Higgsfield generation handoff, download outputs, and rerun the MMA asset audit.'
      ),
      evidence: `${mmaGeneratedAssetAudit.summary.presentTargets}/${mmaGeneratedAssetAudit.summary.targetCount} combat generated outputs are present.`
    }
  }

  return {
    status: 'ready-for-qa',
    blocker: null,
    evidence: `${mmaGeneratedAssetAudit.summary.presentTargets}/${mmaGeneratedAssetAudit.summary.targetCount} combat generated outputs are present and ready for visual QA.`
  }
}

function qvacRefereeLaneFor (row) {
  const active = row.data.requiresQvacForPrize || row.data.qvacResultEvidenceRequired || row.data.evidenceSourceIds.length > 0
  const mode = row.data.qvacResultEvidenceRequired
    ? 'settlement-referee'
    : active
      ? 'correction-referee'
      : 'not-required'
  return {
    active,
    mode,
    evidenceSourceIds: row.data.evidenceSourceIds.slice(),
    evidence: active
      ? `${mode} lane uses ${row.data.evidenceSourceIds.join(', ') || 'host evidence'} for result review, disputes, or no-API settlement.`
      : 'Automatic source-of-truth settlement does not need QVAC evidence unless disputed.'
  }
}

function createCombatCardReadinessModes ({ row, liveData }) {
  const noApiSports = (catalog.getEventFit(row.fitId).combatCardSports || [])
    .filter(sport => sport !== 'mma')
  return [
    {
      modeId: 'api-backed-mma-card',
      title: 'MMA official-feed card',
      status: liveData.status,
      sourceIds: liveData.providerSourceIds.slice(),
      evidence: 'Use the same fight-card tournament shell with SportsDataIO MMA and Sportradar when the card is covered by contracted APIs.'
    },
    {
      modeId: 'qvac-combat-card',
      title: 'No-API combat card',
      status: 'qvac-local-ready',
      sports: noApiSports,
      sourceIds: ['official-web-evidence', 'social-web-evidence', 'host-evidence-qvac'],
      evidence: 'Boxing, kickboxing, ONE-style, bareknuckle, Muay Thai, and grappling cards use the same shell, then QVAC referee determines winners from official pages, social posts, web search, and host evidence.'
    }
  ]
}

function nextActionForFitReadiness ({ row, liveData, assets, blockers, qvacRefereeLane }) {
  if (blockers.some(blocker => blocker.blockerId === 'provider-live-data')) {
    return `Add backend credentials for ${liveData.blockedSourceIds.join(', ')} and run node platform/ultimate-sports/scripts/sports-data-smoke.js.`
  }
  if (blockers.some(blocker => blocker.blockerId === 'generated-assets')) {
    return assets.blocker.nextAction
  }
  if (blockers.length > 0) {
    return blockers[0].nextAction
  }
  if (qvacRefereeLane.mode === 'settlement-referee') {
    return 'Keep the QVAC result-evidence packet visible in result, dispute, and prize-settlement states.'
  }
  return `Keep ${row.fitId} covered in the preview journey and rerun the standup audit after provider or asset changes.`
}

function readinessBlocker (blockerId, title, nextAction) {
  return { blockerId, title, nextAction }
}

function createCoverageSummary ({ rootDir, manifestReport, launchMatrix, miniGameRunMatrix, aggregatorPlan, clientPlan, smokePlan, providerPlan, assetPlan, mmaGeneratedAssetAudit, experience, scenarioRuns, fitRows, pearWorkerBridge, previewJourneySmoke }) {
  const surfaceIds = Object.keys(experience.surfaces || {})
  const hasDedicatedUi = fs.existsSync(path.join(rootDir, 'app')) || fs.existsSync(path.join(rootDir, 'ui'))
  const areas = [
    area('Manifest contract', manifestReport.ok ? 1 : 0, 1, manifestReport.ok ? 'Verifier passes the isolated scaffold contract.' : manifestReport.errors.join('; ')),
    area('Event fits', fitRows.length, catalog.listEventFits().length, 'Catalog, launch, shell, and data rows are present per event fit.'),
    area('Launch plans', launchMatrix.counts.primaryLaunchable, launchMatrix.counts.fits, 'Primary launch plans are generated for each event fit.'),
    area('Pool variants', launchMatrix.counts.variantsInPrimaryPlan + launchMatrix.counts.variantsInAlternatePlans, launchMatrix.counts.variants, 'Recommended variants are present in primary or alternate launch plans.'),
    area('Mini-game launch coverage', launchMatrix.counts.coveredMiniGames, launchMatrix.counts.miniGames, 'Recommended mini-games map to commands or activation tasks.'),
    area('Mini-game run plans', miniGameRunMatrix.totalPlans, launchMatrix.counts.miniGames, 'Executable run plans exist for recommended mini-game specs.'),
    area('Aggregator routes', aggregatorPlan.routes.length, fitRows.length, 'Every fit has a normalized sports data route.'),
    area('Result settlement paths', fitRows.filter(row => row.data.prizeSettlementReady).length, fitRows.length, 'Every fit must have either source-of-truth auto settlement or a QVAC result-evidence settlement lane.'),
    area('Provider stack', providerPlan.providers.length, providerPlan.providers.length, 'Provider matrix is available for route decisions.'),
    area('Tournament asset packs', assetPlan.packs.length, fitRows.length, 'Each fit has required generated/licensed asset prompts.'),
    area('App surfaces', REQUIRED_SURFACES.filter(surfaceId => surfaceIds.includes(surfaceId)).length, REQUIRED_SURFACES.length, 'The facade can derive home, discover, pool, pick, watch, game, creator, wallet, ops, and settings surfaces.'),
    area('Scenarios', scenarioRuns.filter(run => run.ok).length, scenarioRuns.length, 'Manifest scenarios replay through the facade.'),
    area('User-facing v2 UI', hasDedicatedUi ? 1 : 0, 1, hasDedicatedUi ? 'A dedicated ultimate sports UI folder exists.' : 'No dedicated ultimate sports UI is wired yet.'),
    area('Live provider clients', clientPlan.coverage.apiClientsWithRequestBuilders, clientPlan.coverage.apiSourceCount, 'Server-side HTTP client request builders exist for API-backed aggregator sources; live credentials still need smoke verification.'),
    area('Provider smoke runner', smokePlan.summary.totalChecks > 0 ? 1 : 0, 1, `Redacted smoke-check plan covers ${smokePlan.summary.totalChecks} sources; ${smokePlan.summary.readyToRun}/${smokePlan.summary.apiChecks} API checks are ready to call with current env.`),
    area('Preview journey smoke runner', previewJourneySmoke.ok ? 1 : 0, 1, previewJourneySmoke.evidence),
    area('Generated visual assets', mmaGeneratedAssetAudit.summary.presentTargets, mmaGeneratedAssetAudit.summary.targetCount, `${mmaGeneratedAssetAudit.summary.presentTargets}/${mmaGeneratedAssetAudit.summary.targetCount} MMA generated asset outputs are present on disk.`),
    area('Pear worker bridge wiring', pearWorkerBridge.ok ? 1 : 0, 1, pearWorkerBridge.evidence)
  ]
  const coveragePercent = Math.round(areas.reduce((sum, item) => sum + item.percent, 0) / areas.length)

  return {
    coveragePercent,
    overallStatus: coveragePercent >= 90 ? 'product-standup-ready' : coveragePercent >= 70 ? 'strong-engine-scaffold-needs-integration' : 'early-product-standup',
    areas
  }
}

function createGrindList ({ rootDir, fitRows, aggregatorPlan, clientPlan, smokePlan, mmaGeneratedAssetAudit, manifestReport, pearWorkerBridge, previewJourneySmoke }) {
  const hasDedicatedUi = fs.existsSync(path.join(rootDir, 'app')) || fs.existsSync(path.join(rootDir, 'ui'))
  const unsupportedSettlementFits = fitRows.filter(row => !row.data.prizeSettlementReady).map(row => row.fitId)
  const qvacEvidenceSettlementFits = fitRows
    .filter(row => row.data.autoSettlementSourceIds.length === 0 && row.data.prizeSettlementMode === 'qvac-result-evidence')
    .map(row => row.fitId)
  const autoSettlementFits = fitRows
    .filter(row => row.data.autoSettlementSourceIds.length > 0)
    .map(row => row.fitId)
  const qvacFallbackFits = aggregatorPlan.coverageGaps.map(gap => gap.fitId)
  const clientLayerCovered = clientPlan.coverage.apiClientsWithRequestBuilders === clientPlan.coverage.apiSourceCount
  return [
    grind({
      area: 'Product UI',
      title: 'Build the actual ultimate sports app shell',
      priority: 'P0',
      status: hasDedicatedUi ? 'covered' : 'open',
      evidence: hasDedicatedUi ? 'Dedicated platform UI folder exists.' : 'The v2 platform is still a pure-engine scaffold behind the facade.',
      nextStep: 'Create the Pear/Web renderer that consumes createTournamentShell, createExperience, and the standup audit data.'
    }),
    grind({
      area: 'Live data',
      title: 'Implement real provider API clients behind the aggregator routes',
      priority: 'P0',
      status: clientLayerCovered ? 'covered' : 'open',
      evidence: clientLayerCovered
        ? 'Server-only request builders exist for every API-backed aggregator source, with redacted auth and credential readiness checks.'
        : 'Aggregator routes and normalized contracts exist, but not every API-backed source has a server-side request builder.',
      nextStep: clientLayerCovered
        ? 'Keep credentials server-side and run provider smoke checks as contracts are secured.'
        : 'Add server-only clients for Sportradar, SportsDataIO, PandaScore, Abios, The Odds API, and SailGP partner drops.'
    }),
    grind({
      area: 'Live data',
      title: 'Verify provider credentials and contracts with live smoke checks',
      priority: 'P0',
      status: 'open',
      evidence: smokePlan.summary.readyToRun > 0
        ? `${smokePlan.summary.readyToRun}/${smokePlan.summary.apiChecks} API smoke checks are ready to call with current env; live provider responses are not recorded in this audit.`
        : `Smoke runner exists, but ${smokePlan.summary.missingCredentials}/${smokePlan.summary.apiChecks} API checks are missing required env in the current process.`,
      nextStep: 'Run node platform/ultimate-sports/scripts/sports-data-smoke.js from the backend once contracted provider env vars are present, then store the redacted JSON report.'
    }),
    grind({
      area: 'Settlement',
      title: 'Prove no-API result settlement lanes',
      priority: unsupportedSettlementFits.length > 0 ? 'P1' : 'P2',
      status: unsupportedSettlementFits.length > 0 ? 'open' : 'covered',
      evidence: unsupportedSettlementFits.length > 0
        ? `${unsupportedSettlementFits.length} fits still lack a source-of-truth or QVAC result-evidence settlement path.`
        : `${autoSettlementFits.length} fits have source-of-truth auto settlement and ${qvacEvidenceSettlementFits.length} fits use QVAC result-evidence settlement.`,
      nextStep: unsupportedSettlementFits.length > 0
        ? `Add settlement evidence contracts for ${unsupportedSettlementFits.join(', ')}.`
        : 'Expose QVAC result-evidence status in result, dispute, and prize-settlement UI states while provider contracts are finalized.'
    }),
    grind({
      area: 'Provider contracts',
      title: 'Secure SailGP and premium sports data access',
      priority: 'P1',
      status: 'open',
      evidence: qvacFallbackFits.includes('sailgp-companion') ? 'SailGP route is hybrid and keeps official web/QVAC fallback active.' : 'SailGP fallback not detected.',
      nextStep: 'Confirm SailGP partner-feed availability and decide whether Stats Perform/Opta is worth licensing for soccer depth.'
    }),
    grind({
      area: 'Assets',
      title: 'Generate and QA sport-specific asset packs',
      priority: 'P1',
      status: mmaGeneratedAssetAudit.summary.missingTargets === 0 ? 'covered' : 'open',
      evidence: `${mmaGeneratedAssetAudit.summary.presentTargets}/${mmaGeneratedAssetAudit.summary.targetCount} MMA asset output targets are present. Status: ${mmaGeneratedAssetAudit.overallStatus}.`,
      nextStep: mmaGeneratedAssetAudit.summary.missingTargets === 0
        ? 'Run visual QA, attach QVAC review evidence, and upload approved finals to the asset store/CDN.'
        : 'Run the Higgsfield API generation flow, store outputs under platform/ultimate-sports/generated-assets/mma-card, then run node platform/ultimate-sports/scripts/audit-mma-card-assets.js.'
    }),
    grind({
      area: 'Worker bridge',
      title: 'Wire v2 commands through the existing Pear worker boundary',
      priority: 'P1',
      status: pearWorkerBridge.ok ? 'covered' : 'open',
      evidence: pearWorkerBridge.evidence,
      nextStep: pearWorkerBridge.ok
        ? 'Keep the optional ultimateSports action isolated from v1 startup, then add production Pear topic mapping when the v2 UI graduates from preview.'
        : 'Add an ultimate-sports bridge action set and replay storage topic mapping.'
    }),
    grind({
      area: 'Quality',
      title: 'Add automated preview journey tests for the UI shell',
      priority: 'P2',
      status: previewJourneySmoke.ok ? 'covered' : 'open',
      evidence: previewJourneySmoke.evidence,
      nextStep: previewJourneySmoke.ok
        ? 'Keep running npm run smoke:ultimate-preview for the isolated shell, then add screenshot/click automation when the preview graduates into a production Pear UI.'
        : hasDedicatedUi
          ? 'Add a served preview journey smoke for dashboard, event fits, aggregator, MMA card, and grind-list surfaces.'
          : 'Use the standup dashboard as the first smoke target, then add full browser flows for creation, picks, watch, games, settlement, and wallet.'
    })
  ]
}

function createGrindMatrix ({ aggregatorPlan, smokePlan, mmaGeneratedAssetAudit }) {
  const providerTasks = smokePlan.checks.map(check => ({
    taskId: `provider:${check.sourceId}`,
    title: check.title,
    status: check.status === 'local-ready'
      ? 'covered'
      : check.status === 'ready-to-run'
        ? 'ready-to-run'
        : 'blocked',
    sourceId: check.sourceId,
    blockerTypes: check.blockers.map(blocker => blocker.blockerType),
    requiredEnv: check.request.missingEnv.slice(),
    nextAction: check.nextAction,
    expectedEvidence: check.expectedEvidence,
    acceptanceCriteria: check.acceptanceCriteria.slice(),
    command: check.status === 'ready-to-run'
      ? `node platform/ultimate-sports/scripts/sports-data-smoke.js --source ${check.sourceId}`
      : 'node platform/ultimate-sports/scripts/sports-data-smoke.js'
  }))
  const sailgpRoute = aggregatorPlan.routes.find(route => route.fitId === 'sailgp-companion')
  const sailgpSmoke = smokePlan.checks.find(check => check.sourceId === 'sailgp-partner-feed')
  const optaSmoke = smokePlan.checks.find(check => check.sourceId === 'stats-perform-opta')
  const sailgpTasks = [
    {
      taskId: 'sailgp:partner-feed-contract',
      title: 'Secure SailGP official or partner feed',
      status: sailgpSmoke && sailgpSmoke.status === 'ready-to-run' ? 'ready-to-run' : 'blocked',
      sourceId: 'sailgp-partner-feed',
      blockerTypes: sailgpSmoke ? sailgpSmoke.blockers.map(blocker => blocker.blockerType) : ['missing-source'],
      requiredEnv: sailgpSmoke ? sailgpSmoke.request.missingEnv.slice() : ['SAILGP_PARTNER_FEED_KEY', 'SAILGP_PARTNER_FEED_BASE_URL'],
      fallbackSourceIds: sailgpRoute ? sailgpRoute.fallbackOrder.slice() : [],
      nextAction: sailgpSmoke ? sailgpSmoke.nextAction : 'Confirm SailGP partner-feed access and configure backend feed credentials.',
      expectedEvidence: sailgpSmoke ? sailgpSmoke.expectedEvidence : 'Redacted passed-live SailGP partner-feed smoke report.',
      acceptanceCriteria: [
        'SailGP partner or official feed credentials are present only in the backend runtime.',
        'The SailGP smoke check returns passed-live against a schedule or event endpoint.',
        'Fallback official web/QVAC evidence remains active for disputes or partner-feed outages.'
      ],
      command: 'node platform/ultimate-sports/scripts/sports-data-smoke.js --source sailgp-partner-feed'
    },
    {
      taskId: 'premium:stats-perform-decision',
      title: 'Decide whether Stats Perform / Opta is worth licensing',
      status: optaSmoke && optaSmoke.status === 'ready-to-run' ? 'ready-to-run' : 'blocked',
      sourceId: 'stats-perform-opta',
      blockerTypes: optaSmoke ? optaSmoke.blockers.map(blocker => blocker.blockerType) : ['missing-source'],
      requiredEnv: optaSmoke ? optaSmoke.request.missingEnv.slice() : ['STATSPERFORM_API_KEY', 'STATSPERFORM_BASE_URL'],
      fallbackSourceIds: ['sportradar-official', 'sportsdataio-global', 'host-evidence-qvac'],
      nextAction: optaSmoke ? optaSmoke.nextAction : 'Confirm whether premium soccer/media depth justifies the Stats Perform contract.',
      expectedEvidence: optaSmoke ? optaSmoke.expectedEvidence : 'Licensing decision and redacted smoke report if purchased.',
      acceptanceCriteria: [
        'Decision is recorded as licensed, deferred, or rejected for MVP.',
        'If licensed, the smoke check returns passed-live from the backend.',
        'If deferred or rejected, aggregator routes continue to work through Sportradar/SportsDataIO/QVAC.'
      ],
      command: 'node platform/ultimate-sports/scripts/sports-data-smoke.js --source stats-perform-opta'
    }
  ]
  const assetTasks = mmaGeneratedAssetAudit.assets.map(asset => ({
    taskId: `combat-assets:${asset.assetType}`,
    title: asset.title,
    status: asset.status === 'generated'
      ? 'ready-for-qa'
      : asset.status === 'partial'
        ? 'partial'
        : 'blocked',
    assetType: asset.assetType,
    missingTargets: asset.missingTargetCount,
    presentTargets: asset.presentTargetCount,
    nextAction: asset.missingTargetCount === 0
      ? 'Run visual QA, rights review, crop review, and attach QVAC/human review evidence.'
      : `Generate ${asset.missingTargetCount} missing output target(s) and rerun the MMA asset audit.`,
    expectedEvidence: 'Generated PNG/MP4 output files plus prompt metadata and visual QA evidence.',
    acceptanceCriteria: mmaGeneratedAssetAudit.generationHandoff.acceptanceCriteria.slice(),
    command: 'node platform/ultimate-sports/scripts/audit-mma-card-assets.js'
  }))
  const groups = [
    grindGroup({
      groupId: 'provider-live-smoke',
      title: 'Provider Credentials And Live Smoke',
      priority: 'P0',
      status: smokePlan.summary.blocked > 0 ? 'blocked' : 'ready-to-smoke',
      summary: `${smokePlan.summary.readyToRun}/${smokePlan.summary.apiChecks} API checks ready; ${smokePlan.summary.localReady} local lanes ready.`,
      command: 'node platform/ultimate-sports/scripts/sports-data-smoke.js',
      tasks: providerTasks
    }),
    grindGroup({
      groupId: 'sailgp-premium-access',
      title: 'SailGP And Premium Data Access',
      priority: 'P1',
      status: sailgpTasks.some(task => task.status === 'blocked') ? 'blocked' : 'ready-to-smoke',
      summary: 'SailGP has a partner-feed route plus official web/QVAC fallback; Stats Perform remains an explicit licensing decision.',
      command: 'node platform/ultimate-sports/scripts/sports-data-smoke.js --source sailgp-partner-feed',
      tasks: sailgpTasks
    }),
    grindGroup({
      groupId: 'combat-generated-assets',
      title: 'Combat Generated Assets',
      priority: 'P1',
      status: mmaGeneratedAssetAudit.summary.missingTargets > 0 ? 'blocked' : 'ready-for-qa',
      summary: `${mmaGeneratedAssetAudit.summary.presentTargets}/${mmaGeneratedAssetAudit.summary.targetCount} generated asset outputs present; ${mmaGeneratedAssetAudit.generationHandoff.queueJobCount} Higgsfield jobs in the handoff.`,
      command: 'node platform/ultimate-sports/scripts/audit-mma-card-assets.js',
      tasks: assetTasks
    })
  ]
  const flatTasks = groups.flatMap(group => group.tasks)

  return {
    matrixVersion: 'ultimate-sports-grind-matrix-v1',
    summary: {
      groupCount: groups.length,
      taskCount: flatTasks.length,
      openTaskCount: flatTasks.filter(task => task.status !== 'covered' && task.status !== 'ready-for-qa').length,
      blockedTaskCount: flatTasks.filter(task => task.status === 'blocked').length,
      readyTaskCount: flatTasks.filter(task => task.status === 'ready-to-run' || task.status === 'ready-for-qa').length,
      coveredTaskCount: flatTasks.filter(task => task.status === 'covered').length
    },
    groups
  }
}

function createGrindBacklog ({ grindList, grindMatrix }) {
  const groups = grindMatrix && Array.isArray(grindMatrix.groups) ? grindMatrix.groups : []
  const tickets = []
  groups.forEach(group => {
    group.tasks
      .filter(task => task.status !== 'covered')
      .forEach(task => {
        tickets.push(grindTicketFor({
          index: tickets.length + 1,
          group,
          task
        }))
      })
  })
  const openGaps = grindList.filter(item => item.status !== 'covered')
  const workstreams = groups.map(group => ({
    workstreamId: group.groupId,
    title: group.title,
    priority: group.priority,
    status: group.status,
    summary: group.summary,
    command: group.command,
    ticketCount: tickets.filter(ticket => ticket.workstreamId === group.groupId).length,
    blockedTicketCount: tickets.filter(ticket => ticket.workstreamId === group.groupId && ticket.status === 'blocked').length,
    readyTicketCount: tickets.filter(ticket => ticket.workstreamId === group.groupId && ticket.status !== 'blocked').length
  }))

  return {
    backlogVersion: 'ultimate-sports-grind-backlog-v1',
    summary: {
      ticketCount: tickets.length,
      blockedTicketCount: tickets.filter(ticket => ticket.status === 'blocked').length,
      readyTicketCount: tickets.filter(ticket => ticket.status !== 'blocked').length,
      p0TicketCount: tickets.filter(ticket => ticket.priority === 'P0').length,
      p1TicketCount: tickets.filter(ticket => ticket.priority === 'P1').length,
      openGapCount: openGaps.length,
      externalDependencyTicketCount: tickets.filter(ticket => ticket.externalDependency).length
    },
    workstreams,
    tickets
  }
}

function grindTicketFor ({ index, group, task }) {
  const blockerTypes = Array.isArray(task.blockerTypes) ? task.blockerTypes.slice() : []
  const requiredEnv = Array.isArray(task.requiredEnv) ? task.requiredEnv.slice() : []
  const ticketId = `US-GRIND-${String(index).padStart(3, '0')}`
  return {
    ticketId,
    sourceTaskId: task.taskId,
    title: task.title,
    workstreamId: group.groupId,
    workstream: group.title,
    ownerLane: ownerLaneForGroup(group.groupId),
    priority: group.priority,
    status: normalizeTicketStatus(task.status),
    sourceId: task.sourceId || null,
    assetType: task.assetType || null,
    blockerTypes,
    requiredEnv,
    externalDependency: externalDependencyFor({ groupId: group.groupId, blockerTypes, requiredEnv }),
    nextAction: task.nextAction,
    expectedEvidence: task.expectedEvidence || 'Evidence must be attached to the generated standup report.',
    acceptanceCriteria: Array.isArray(task.acceptanceCriteria) && task.acceptanceCriteria.length > 0
      ? task.acceptanceCriteria.slice()
      : ['Evidence is attached to the standup report.', 'The related smoke/audit check passes.'],
    command: task.command || group.command || null
  }
}

function normalizeTicketStatus (status) {
  if (status === 'ready-to-run' || status === 'ready-for-qa') return 'ready'
  if (status === 'partial') return 'in-progress'
  if (status === 'blocked') return 'blocked'
  return status || 'open'
}

function ownerLaneForGroup (groupId) {
  if (groupId === 'provider-live-smoke') return 'backend-data'
  if (groupId === 'sailgp-premium-access') return 'partnerships-and-licensing'
  if (groupId === 'combat-generated-assets') return 'creative-ops'
  return 'product-ops'
}

function externalDependencyFor ({ groupId, blockerTypes, requiredEnv }) {
  if (groupId === 'sailgp-premium-access') return true
  if (groupId === 'provider-live-smoke' && requiredEnv.length > 0) return true
  return blockerTypes.includes('missing-credentials') ||
    blockerTypes.includes('missing-env') ||
    blockerTypes.includes('missing-contract')
}

function grindGroup (input) {
  return {
    groupId: input.groupId,
    title: input.title,
    priority: input.priority,
    status: input.status,
    summary: input.summary,
    command: input.command,
    tasks: input.tasks.map(task => cloneJson(task))
  }
}

function createPearWorkerBridgeProof ({ rootDir }) {
  const repoRoot = path.resolve(rootDir, '..', '..')
  const appBridgePath = path.join(repoRoot, 'app', 'worker-bridge-protocol.js')
  const platformBridgePath = path.join(rootDir, 'src', 'bridge-protocol.js')
  const missing = []

  if (!fs.existsSync(appBridgePath)) missing.push('app/worker-bridge-protocol.js is missing')
  if (!fs.existsSync(platformBridgePath)) missing.push('platform v2 bridge protocol is missing')

  const appBridgeSource = fs.existsSync(appBridgePath) ? fs.readFileSync(appBridgePath, 'utf8') : ''
  const platformBridgeSource = fs.existsSync(platformBridgePath) ? fs.readFileSync(platformBridgePath, 'utf8') : ''
  const requiredV2Actions = [
    'createStandupAudit',
    'createSportsDataAggregatorPlan',
    'createSportsDataClientPlan',
    'createSportsDataRequestPlan',
    'createSportsDataSmokePlan',
    'createSportsDataProviderPlan'
  ]

  if (!appBridgeSource.includes("envelope.action === 'ultimateSports'")) {
    missing.push('Pear worker bridge does not expose the optional ultimateSports action')
  }
  if (!appBridgeSource.includes('createUltimateSportsBridgeHandler')) {
    missing.push('Pear worker bridge does not include an ultimate sports bridge handler factory')
  }
  if (!appBridgeSource.includes('../platform/ultimate-sports/src/bridge-protocol.js')) {
    missing.push('Pear worker bridge does not load the isolated v2 bridge protocol')
  }
  requiredV2Actions.forEach(action => {
    if (!platformBridgeSource.includes(`'${action}'`)) missing.push(`v2 bridge action ${action} is not exposed`)
  })

  return {
    ok: missing.length === 0,
    action: 'ultimateSports',
    appBridgePath: relativePath(repoRoot, appBridgePath),
    platformBridgePath: relativePath(repoRoot, platformBridgePath),
    requiredV2Actions,
    evidence: missing.length === 0
      ? 'Existing Pear worker bridge delegates optional nested ultimateSports requests into the isolated v2 bridge while preserving v1 actions.'
      : missing.join('; ')
  }
}

function createPreviewJourneySmokeProof ({ rootDir, manifestReport }) {
  const manifest = manifestReport.manifest || {}
  const script = 'scripts/preview-journey-smoke.js'
  const test = 'test/preview-journey-smoke.test.js'
  const report = 'generated-reports/preview-journey-smoke.json'
  const missing = []
  const scriptPath = path.join(rootDir, script)
  const testPath = path.join(rootDir, test)
  const reportPath = path.join(rootDir, report)
  let latestReport = null
  let latestReportStatus = 'missing'

  if (!fs.existsSync(scriptPath)) missing.push(`${script} is missing`)
  if (!fs.existsSync(testPath)) missing.push(`${test} is missing`)
  if (!Array.isArray(manifest.requiredScripts) || !manifest.requiredScripts.includes(script)) {
    missing.push(`${script} is not part of requiredScripts`)
  }
  if (!Array.isArray(manifest.testFiles) || !manifest.testFiles.includes(test)) {
    missing.push(`${test} is not part of testFiles`)
  }

  if (fs.existsSync(reportPath)) {
    try {
      latestReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
      latestReportStatus = latestReport.overallStatus || 'unknown'
    } catch (error) {
      latestReportStatus = `invalid: ${error.message}`
    }
  }

  const ok = missing.length === 0
  const latestEvidence = latestReport && latestReport.summary
    ? ` Latest report: ${latestReportStatus}, ${latestReport.summary.passedChecks}/${latestReport.summary.totalChecks} checks, ${latestReport.summary.coveragePercent}% coverage.`
    : ` Latest report: ${latestReportStatus}.`

  return {
    ok,
    command: 'npm run smoke:ultimate-preview',
    script,
    test,
    report,
    latestReportStatus,
    latestReportSummary: latestReport && latestReport.summary ? cloneJson(latestReport.summary) : null,
    evidence: ok
      ? `Served preview journey smoke script and regression test are in the manifest.${latestEvidence}`
      : missing.join('; ')
  }
}

function runScenarioAudit ({ manifest }) {
  const platform = getPlatform()
  return manifest.scenarioIds.map(scenarioId => {
    const app = platform.createUltimateSportsPlatform({ peerId: `scenario-${scenarioId}` })
    try {
      const applied = app.applyScenario(scenarioId)
      return {
        scenarioId,
        ok: true,
        commandCount: applied.scenario.commands.length,
        eventCount: applied.events.length,
        topicCount: applied.scenario.topics.length,
        root: app.root()
      }
    } catch (error) {
      return {
        scenarioId,
        ok: false,
        error: error.message
      }
    }
  })
}

function summarizeSurfaces (surfaces) {
  return REQUIRED_SURFACES.map(surfaceId => {
    const surface = surfaces[surfaceId]
    return {
      surfaceId,
      present: Boolean(surface),
      title: surface && surface.title,
      counts: cloneJson(surface && surface.counts || {})
    }
  })
}

function area (title, covered, total, evidence) {
  return {
    title,
    covered,
    total,
    percent: percent(covered, total),
    evidence
  }
}

function grind (input) {
  return {
    area: input.area,
    title: input.title,
    priority: input.priority,
    status: input.status,
    evidence: input.evidence,
    nextStep: input.nextStep
  }
}

function percent (covered, total) {
  if (total === 0) return 100
  return Math.round((covered / total) * 100)
}

function escapeHtml (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function relativePath (rootDir, filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/')
}

function markdownText (value) {
  return String(value == null ? '' : value)
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getPlatform () {
  return require('./platform')
}

function getVerifyPlatform () {
  return require('../scripts/verify-platform').verifyPlatform
}

module.exports = {
  STANDUP_AUDIT_VERSION,
  REQUIRED_SURFACES,
  createUltimateSportsStandupAudit,
  renderStandupAuditHtml,
  renderGrindBacklogMarkdown
}
