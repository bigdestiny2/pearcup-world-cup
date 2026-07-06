'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { platform } = require('../src')

const DEFAULT_SCENARIO_IDS = Object.freeze([
  'soccer-knockout',
  'fight-card',
  'ultimate-day-in-life',
  'awards-card',
  'series-playoff'
])

function createUltimateSportsAppSnapshot (input = {}) {
  const rootDir = input.rootDir || path.resolve(__dirname, '..')
  const userId = input.userId || 'host'
  const generatedAt = input.generatedAt || new Date().toISOString()
  const app = platform.createUltimateSportsPlatform({ peerId: userId })
  const scenarioRuns = DEFAULT_SCENARIO_IDS.map(scenarioId => applyScenario(app, scenarioId))
  const experience = app.createExperience({ userId, now: generatedAt })
  const catalog = app.catalog()
  const launchMatrix = app.createLaunchMatrix({ maxVariants: 99, maxMiniGames: 99 })
  const miniGameRunMatrix = app.createMiniGameRunMatrix({ settlementMode: 'demo' })
  const aggregatorPlan = app.createSportsDataAggregatorPlan()
  const clientPlan = app.createSportsDataClientPlan({ env: input.env || {} })
  const smokePlan = app.createSportsDataSmokePlan({ env: input.env || {}, generatedAt })
  const latestSportsDataSmokeReport = readLatestSportsDataSmokeReport(rootDir)
  const providerPlan = app.createSportsDataProviderPlan()
  const assetPlan = app.createAssetGenerationPlan()
  const audit = app.createStandupAudit({ rootDir, generatedAt, userId })
  const mmaAssetPlan = app.createMmaCardAssetPlan({
    tournamentId: 'mma-card-preview',
    title: 'MMA Fight Card Preview',
    includeVideoLoops: true
  })
  const tournamentLobby = app.createTournamentLobby({})
  const tournamentShells = catalog.eventFits.map(fit => ({
    fitId: fit.fitId,
    title: fit.title,
    shell: app.createTournamentShell({ fitId: fit.fitId })
  }))
  const experienceProfiles = app.modules.tournamentExperience.listExperienceProfiles()
  const miniGameSuites = catalog.eventFits.map(fit => app.createMiniGameSuite({ fitId: fit.fitId, settlementMode: 'demo' }))
  const liveServers = createLiveServers(catalog, experienceProfiles, miniGameSuites)

  return {
    snapshotVersion: 'ultimate-sports-app-snapshot-v1',
    generatedAt,
    userId,
    runtime: {
      eventCount: app.events().length,
      eventRoot: app.root(),
      scenarioRuns
    },
    audit: summarizeAudit(audit),
    navigation: experience.navigation,
    surfaces: summarizeSurfaces(experience.surfaces),
    catalog: {
      eventFits: catalog.eventFits,
      poolVariants: catalog.poolVariants,
      miniGames: catalog.miniGames,
      settlementModes: catalog.settlementModes
    },
    launchMatrix: {
      counts: launchMatrix.counts,
      rows: launchMatrix.rows.map(summarizeLaunchRow)
    },
    miniGameRunMatrix: {
      totalPlans: miniGameRunMatrix.totalPlans,
      suites: miniGameRunMatrix.suites.map(suite => ({
        fitId: suite.fitId,
        title: suite.title,
        planCount: suite.plans.length,
        refereeLanes: unique(suite.plans.map(plan => plan.refereePlan && plan.refereePlan.lane)),
        settlementModes: unique(suite.plans.map(plan => plan.settlementMode)),
        runModes: unique(suite.plans.map(plan => plan.mode))
      }))
    },
    aggregator: {
      strategy: aggregatorPlan.strategy,
      envVars: aggregatorPlan.envVars,
      coverageGaps: aggregatorPlan.coverageGaps,
      routes: aggregatorPlan.routes.map(route => ({
        routeId: route.routeId,
        fitId: route.fitId,
        title: route.title,
        category: route.category,
        primarySourceId: route.primarySourceId,
        sourceIds: route.sourceIds,
        autoSettlementSourceIds: route.settlement.autoSettlementSourceIds,
        evidenceSourceIds: route.settlement.evidenceSourceIds,
        prizeSettlementMode: route.settlement.prizeSettlementMode,
        prizeSettlementReady: route.settlement.prizeSettlementReady,
        requiresQvacForPrize: route.settlement.requiresQvacForPrize,
        resultEvidenceContract: route.settlement.resultEvidenceContract,
        envVars: route.envVars,
        fallbackOrder: route.fallbackOrder,
        titleSourceOverrides: route.titleSourceOverrides
      })),
      sources: aggregatorPlan.sources.map(source => ({
        sourceId: source.sourceId,
        providerId: source.providerId,
        title: source.title,
        role: source.role,
        usage: source.usage,
        settlementTier: source.settlementTier,
        env: source.env
      }))
    },
    sportsDataClients: {
      coverage: clientPlan.coverage,
      envVars: clientPlan.envVars,
      liveReadiness: clientPlan.liveReadiness,
      clients: clientPlan.clients.map(client => ({
        sourceId: client.sourceId,
        title: client.title,
        clientKind: client.clientKind,
        sourceKind: client.sourceKind,
        settlementTier: client.settlementTier,
        readyForLiveRequests: client.readyForLiveRequests,
        localEvidenceLane: client.localEvidenceLane,
        missingEnv: client.missingEnv,
        operationCount: client.operations.length
      })),
      requestExamples: clientPlan.requestExamples.map(example => ({
        requestId: example.requestId,
        sourceId: example.sourceId,
        clientKind: example.clientKind,
        operation: example.operation,
        entityType: example.entityType,
        ready: example.ready,
        missingEnv: example.missingEnv,
        missingParams: example.missingParams,
        url: example.url
      }))
    },
    sportsDataSmoke: {
      overallStatus: smokePlan.overallStatus,
      summary: smokePlan.summary,
      latestReport: summarizeSportsDataSmokeReport(latestSportsDataSmokeReport),
      checks: smokePlan.checks.map(check => ({
        sourceId: check.sourceId,
        title: check.title,
        clientKind: check.clientKind,
        settlementTier: check.settlementTier,
        status: check.status,
        canCallNetwork: check.canCallNetwork,
        blockerTypes: check.blockers.map(blocker => blocker.blockerType),
        nextAction: check.nextAction,
        expectedEvidence: check.expectedEvidence,
        acceptanceCriteria: check.acceptanceCriteria,
        readinessChecklist: check.readinessChecklist,
        operation: check.request.operation,
        entityType: check.request.entityType
      }))
    },
    providers: {
      recommendation: providerPlan.recommendation,
      providers: providerPlan.providers.map(provider => ({
        providerId: provider.providerId,
        title: provider.title,
        role: provider.role,
        coverage: provider.coverage,
        strengths: provider.strengths,
        limitations: provider.limitations,
        auth: provider.auth
      }))
    },
    tournamentLobby,
    tournamentShells,
    experienceProfiles,
    miniGameSuites,
    liveServers,
    assetPacks: assetPlan.packs,
    assets: {
      packCount: assetPlan.packs.length,
      packs: assetPlan.packs.map(pack => ({
        fitId: pack.fitId,
        themeId: pack.themeId,
        requiredAssetCount: pack.requiredAssets.length,
        promptCount: pack.requiredAssets.filter(asset => asset.prompt).length
      })),
      mma: {
        planVersion: mmaAssetPlan.planVersion,
        fitId: mmaAssetPlan.fitId,
        title: mmaAssetPlan.title,
        provider: mmaAssetPlan.provider,
        style: mmaAssetPlan.style,
        assetCount: mmaAssetPlan.assets.length,
        queueCount: mmaAssetPlan.queue.jobs.length,
        assets: mmaAssetPlan.assets.map(asset => ({
          assetType: asset.assetType,
          title: asset.title,
          aspectRatios: asset.aspectRatios,
          variants: asset.variants,
          resolution: asset.resolution
        }))
      }
    }
  }
}

function writeUltimateSportsAppSnapshot (input = {}) {
  const rootDir = input.rootDir || path.resolve(__dirname, '..')
  const outFile = input.outFile || path.join(rootDir, 'app', 'data', 'ultimate-sports-snapshot.json')
  const snapshot = createUltimateSportsAppSnapshot({ ...input, rootDir })
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, `${JSON.stringify(snapshot, null, 2)}\n`)
  return { outFile, snapshot }
}

function summarizeAudit (audit) {
  return {
    auditVersion: audit.auditVersion,
    generatedAt: audit.generatedAt,
    status: audit.status,
    summary: audit.summary,
    coverage: audit.coverage,
    fitReadiness: audit.fitReadiness,
    providerStack: audit.providerStack,
    providerSmoke: audit.providerSmoke,
    generatedAssets: audit.generatedAssets,
    previewJourneySmoke: audit.previewJourneySmoke,
    appSurfaceSnapshot: audit.appSurfaceSnapshot,
    launchReadiness: audit.launchReadiness,
    grindList: audit.grindList,
    grindMatrix: audit.grindMatrix,
    grindBacklog: audit.grindBacklog,
    fitRows: audit.fitRows
  }
}

function summarizeSurfaces (surfaces = {}) {
  return Object.fromEntries(Object.entries(surfaces).map(([surfaceId, surface]) => [
    surfaceId,
    {
      surfaceId,
      title: surface.title,
      counts: surface.counts || {},
      liveNow: surface.liveNow || [],
      eventFits: surface.eventFits || [],
      openPools: surface.openPools || [],
      yourPools: surface.yourPools || [],
      rooms: surface.rooms || [],
      liveRooms: surface.liveRooms || [],
      upcomingRooms: surface.upcomingRooms || [],
      activeDuels: surface.activeDuels || [],
      activeGames: surface.activeGames || [],
      competitionDrafts: surface.competitionDrafts || [],
      publishPlans: surface.publishPlans || [],
      competitions: surface.competitions || [],
      accounts: surface.accounts || [],
      payoutRoutes: surface.payoutRoutes || [],
      readinessPanels: surface.readinessPanels || [],
      qvacResultEvidence: surface.qvacResultEvidence || [],
      workbench: surface.workbench || null
    }
  ]))
}

function readLatestSportsDataSmokeReport (rootDir) {
  const reportPath = path.join(rootDir, 'generated-reports', 'sports-data-smoke.json')
  if (!fs.existsSync(reportPath)) return null
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  } catch (_) {
    return null
  }
}

function summarizeSportsDataSmokeReport (report) {
  if (!report || !report.summary) return null
  return {
    reportVersion: report.reportVersion,
    generatedAt: report.generatedAt,
    overallStatus: report.overallStatus,
    standupFixtures: Boolean(report.standupFixtures),
    summary: {
      totalChecks: report.summary.totalChecks,
      passedChecks: report.summary.passedChecks || 0,
      apiChecks: report.summary.apiChecks,
      localChecks: report.summary.localChecks,
      passedFixture: report.summary.passedFixture || 0,
      passedLocal: report.summary.passedLocal || 0,
      passedLive: report.summary.passedLive || 0,
      failed: report.summary.failed || 0,
      skipped: report.summary.skipped || 0
    },
    resultStatuses: Array.isArray(report.results)
      ? report.results.map(result => ({
          sourceId: result.sourceId,
          status: result.status,
          ok: result.ok,
          itemCount: result.payload && result.payload.itemCount || null,
          normalizedRecordCount: result.normalizedRecordCount || 0
        }))
      : []
  }
}

function summarizeLaunchRow (row) {
  return {
    fitId: row.fitId,
    title: row.title,
    category: row.category,
    primary: row.primary,
    checklist: row.checklist,
    variantCoverage: row.variantCoverage.map(item => ({
      variantId: item.variantId,
      title: item.title,
      coverage: item.coverage,
      templateKind: item.templateKind
    })),
    miniGameCoverage: row.miniGameCoverage.map(item => ({
      gameType: item.gameType,
      title: item.title,
      commandType: item.commandType,
      coverage: item.coverage
    })),
    allVariantsCovered: row.allVariantsCovered,
    allMiniGamesCovered: row.allMiniGamesCovered
  }
}

function createLiveServers (catalog, experienceProfiles, miniGameSuites) {
  const playerNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Quinn', 'Avery', 'Skyler', 'Dakota', 'Reese', 'Peyton', 'Sage', 'Rowan']
  const activities = ['watching final', 'in pool lobby', 'picking bracket', 'in mini-game', 'idle in room', 'reviewing stats']
  const liveServers = {}

  catalog.eventFits.forEach((fit, fitIndex) => {
    const profile = experienceProfiles.find(p => p.fitId === fit.fitId) || {}
    const suite = miniGameSuites.find(s => s.fitId === fit.fitId)
    const playerCount = 3 + (fitIndex % 6)
    const roomCount = 1 + (fitIndex % 3)
    const isLive = fitIndex < 6
    const fixtures = mockFixturesForFit(fit, profile, isLive)
    const pools = mockPoolsForFit(fit, playerNames)

    liveServers[fit.fitId] = {
      fitId: fit.fitId,
      title: fit.title,
      category: fit.category,
      status: isLive ? 'live' : 'template',
      serverLabel: profile.serverLabel || `${fit.title} Server`,
      serverSkin: profile.serverSkin || 'catalog-lobby',
      playerCount,
      roomCount,
      recommendedVariantCount: fit.recommendedVariants.length,
      recommendedMiniGameCount: fit.recommendedMiniGames.length,
      fixtures,
      pools,
      players: playerNames.slice(0, playerCount).map((name, index) => ({
        userId: `player-${fit.fitId}-${index}`,
        username: `${name}${index + 1}`,
        status: index < Math.ceil(playerCount / 2) ? 'online' : 'away',
        activity: activities[(fitIndex + index) % activities.length]
      })),
      miniGames: suite ? suite.specs.map(spec => ({
        title: spec.title,
        mode: spec.mode,
        commandType: spec.commandType,
        headline: spec.headline,
        controls: spec.ui.controls.slice()
      })) : []
    }
  })

  return liveServers
}

function mockFixturesForFit (fit, profile, isLive) {
  const entrantShape = fit.entrantShape
  const bracketStyle = profile.bracketStyle || 'single-elimination'
  const fixtureCount = fit.category === 'combat-sports' ? 5 : (bracketStyle === 'group-plus-knockout' ? 4 : 3)
  const fixtures = []

  for (let index = 0; index < fixtureCount; index += 1) {
    const status = isLive
      ? (index === 0 ? 'live' : index === 1 ? 'finished' : 'scheduled')
      : 'scheduled'
    const home = entrantLabel(entrantShape, index * 2)
    const away = entrantLabel(entrantShape, index * 2 + 1)
    const homeScore = status === 'live' ? deterministicScore(fit.fitId, index, 'home', 3) : (status === 'finished' ? deterministicScore(fit.fitId, index, 'home', 4) : null)
    const awayScore = status === 'live' ? deterministicScore(fit.fitId, index, 'away', 3) : (status === 'finished' ? deterministicScore(fit.fitId, index, 'away', 4) : null)

    fixtures.push({
      fixtureId: `fixture-${fit.fitId}-${index}`,
      home,
      away,
      status,
      timeLabel: status === 'live' ? `${60 + index * 3}'` : (status === 'finished' ? 'FT' : `Today ${18 + index}:00`),
      homeScore,
      awayScore
    })
  }

  return fixtures
}

function entrantLabel (shape, index) {
  if (shape === 'player') return `Fighter ${String.fromCharCode(65 + (index % 26))}`
  if (shape === 'nominee') return `Nominee ${String.fromCharCode(65 + (index % 26))}`
  if (shape === 'creator') return `Creator ${String.fromCharCode(65 + (index % 26))}`
  return `Team ${String.fromCharCode(65 + (index % 26))}`
}

function mockPoolsForFit (fit, playerNames) {
  const variants = fit.recommendedVariants.slice(0, 2)
  return variants.map((variantId, index) => ({
    poolId: `pool-${fit.fitId}-${index}`,
    title: `${capitalize(variantId.replace(/-/g, ' '))} Pool`,
    variant: variantId,
    mode: 'demo',
    entryCount: 4 + index * 2,
    leaderboard: playerNames.slice(0, 5).map((name, rank) => ({
      name: `${name}${rank + 1}`,
      score: 100 - rank * 12 + (index * 5)
    })).sort((a, b) => b.score - a.score)
  }))
}

function capitalize (value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1)
}

function deterministicScore (fitId, index, side, max) {
  const hash = String(fitId).split('').reduce((h, ch) => {
    h = ((h << 5) - h) + ch.charCodeAt(0)
    return h & h
  }, 0)
  const sideOffset = side === 'home' ? 1 : 3
  return Math.abs(hash + index * 7 + sideOffset) % max
}

function applyScenario (app, scenarioId) {
  try {
    const run = app.applyScenario(scenarioId)
    return {
      scenarioId,
      ok: true,
      title: run.scenario.title,
      commandCount: run.scenario.commands.length,
      eventCount: run.events.length,
      topicCount: run.scenario.topics.length
    }
  } catch (error) {
    return {
      scenarioId,
      ok: false,
      error: error.message
    }
  }
}

function unique (items) {
  return [...new Set(items.filter(Boolean))]
}

function parseArgs (argv = process.argv.slice(2)) {
  const parsed = {}
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--out') parsed.outFile = argv[++index]
    else if (arg === '--generated-at') parsed.generatedAt = argv[++index]
    else if (arg === '--user-id') parsed.userId = argv[++index]
  }
  return parsed
}

if (require.main === module) {
  const result = writeUltimateSportsAppSnapshot(parseArgs())
  console.log(`Ultimate sports app snapshot: ${result.outFile}`)
  console.log(`Coverage: ${result.snapshot.audit.summary.coveragePercent}% (${result.snapshot.audit.status})`)
  console.log(`Runtime events: ${result.snapshot.runtime.eventCount}`)
}

module.exports = {
  DEFAULT_SCENARIO_IDS,
  createUltimateSportsAppSnapshot,
  writeUltimateSportsAppSnapshot,
  parseArgs
}
