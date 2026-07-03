'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { bridge, catalog, launch, platform } = require('../src')

test('launch planner creates an applyable soccer scenario with pools, cards, room, and market', () => {
  const app = platform.createUltimateSportsPlatform()
  const scenario = app.createLaunchScenario({
    fitId: 'world-cup',
    title: 'Launch Cup',
    competitionId: 'launch-cup',
    roomId: 'launch-room',
    variantIds: ['classic-bracket', 'group-stage-card'],
    miniGameTypes: ['next-event', 'penalty-clash'],
    entrants: [
      { entrantId: 'red', name: 'Red FC' },
      { entrantId: 'blue', name: 'Blue FC' },
      { entrantId: 'gold', name: 'Gold FC' },
      { entrantId: 'green', name: 'Green FC' }
    ]
  })
  const applied = app.applyScenario(scenario)
  const view = applied.view

  assert.equal(scenario.launchPlan.activationTasks.length, 1)
  assert.equal(scenario.launchPlan.activationTasks[0].gameType, 'penalty-clash')
  assert.equal(view.competitions['launch-cup'].template.kind, 'group-plus-knockout')
  assert.equal(view.pools['launch-cup:pool:classic-bracket'].mode, 'demo')
  assert.equal(view.pools['launch-cup:pool:group-stage-card'].rules.variant, 'group-stage-card')
  assert.equal(view.cards['launch-cup:card:group-stage-card'].cardType, 'group-stage-card')
  assert.equal(view.rooms['launch-room'].hostUserId, 'host')
  assert.equal(view.roomParticipants['launch-room'].host.role, 'host')
  assert.equal(view.markets['launch-room:market:next-event'].marketType, 'next-event')
})

test('sponsor-prize launch plans include gates and can create peer game sessions after players are known', () => {
  const app = platform.createUltimateSportsPlatform()
  const scenario = launch.createLaunchScenario({
    fitId: 'creator-reality-brackets',
    title: 'Creator Cookoff',
    competitionId: 'creator-cookoff',
    roomId: 'creator-room',
    settlementMode: 'sponsor-prize',
    variantIds: ['classic-bracket'],
    miniGameTypes: ['trivia-duel'],
    players: ['alice', 'bob']
  })
  app.applyScenario(scenario)
  const view = app.view()
  const poolCommand = scenario.commands.find(command => command.type === 'pool:create')
  const gameCommand = scenario.commands.find(command => command.type === 'game:create')

  assert.deepEqual(poolCommand.payload.gates, { poolRulesAccepted: true })
  assert.deepEqual(gameCommand.payload.gates, { poolRulesAccepted: true })
  assert.equal(view.pools['creator-cookoff:pool:classic-bracket'].mode, 'sponsor-prize')
  assert.equal(Object.values(view.gameSessions)[0].gameType, 'trivia-duel')
  assert.equal(scenario.launchPlan.activationTasks.length, 0)
})

test('bridge can request launch plans for future UI flows', () => {
  const handler = bridge.createBridgeHandler()
  const response = handler.handle(bridge.createBridgeRequest({
    action: 'createLaunchPlan',
    requestId: 'launch-plan',
    payload: {
      input: {
        fitId: 'pro-playoffs',
        competitionId: 'playoff-launch',
        variantIds: ['classic-bracket', 'fantasy-lite-draft'],
        miniGameTypes: ['peer-mini-fantasy']
      }
    }
  }))

  assert.equal(response.ok, true)
  assert.equal(response.result.fit.fitId, 'pro-playoffs')
  assert.equal(response.result.commands.some(command => command.type === 'draft:create'), true)
  assert.equal(response.result.topics.some(topic => topic.kind === 'competition' && topic.id === 'playoff-launch'), true)
})

test('launch planner turns momentum duel into a live prediction market', () => {
  const app = platform.createUltimateSportsPlatform()
  const scenario = app.createLaunchScenario({
    fitId: 'champions-league-knockout',
    competitionId: 'momentum-launch',
    roomId: 'momentum-room',
    miniGameTypes: ['momentum-duel'],
    variantIds: ['classic-bracket']
  })
  app.applyScenario(scenario)

  assert.equal(scenario.launchPlan.activationTasks.length, 0)
  assert.equal(app.view().markets['momentum-room:market:momentum-duel'].marketType, 'momentum-duel')
  assert.deepEqual(app.view().markets['momentum-room:market:momentum-duel'].options, ['home-pressure', 'away-pressure', 'balanced'])
  assert.equal(app.view().markets['momentum-room:market:momentum-duel'].predictionShape, 'momentum-window')
  assert.deepEqual(app.view().markets['momentum-room:market:momentum-duel'].inputTemplate, { side: 'home-pressure', windowMinutes: 10 })
  assert.equal(app.view().markets['momentum-room:market:momentum-duel'].scoringConfig.balancedThreshold, 2)
})

test('launch planner creates scoreline lock as an exact-score market', () => {
  const app = platform.createUltimateSportsPlatform()
  const scenario = app.createLaunchScenario({
    fitId: 'world-cup',
    competitionId: 'scoreline-launch',
    roomId: 'scoreline-room',
    variantIds: ['classic-bracket'],
    miniGameTypes: ['scoreline-lock']
  })
  app.applyScenario(scenario)
  const market = app.view().markets['scoreline-room:market:scoreline-lock']

  assert.equal(market.marketType, 'scoreline-lock')
  assert.deepEqual(market.options, ['home-win', 'draw', 'away-win'])
  assert.equal(market.predictionShape, 'exact-scoreline')
  assert.deepEqual(market.inputTemplate, { homeScore: 0, awayScore: 0, lockBeforeMinute: 60 })
  assert.equal(market.scoringConfig.exactScorePoints, 3)
})

test('launch planner creates player props for first scorer, shots, assists, and cards', () => {
  const app = platform.createUltimateSportsPlatform()
  const scenario = app.createLaunchScenario({
    fitId: 'mma-boxing-fight-card',
    competitionId: 'props-launch',
    roomId: 'props-room',
    variantIds: ['player-prop'],
    miniGameTypes: ['player-prop-duel']
  })
  app.applyScenario(scenario)
  const card = app.view().cards['props-launch:card:player-prop']
  const market = app.view().markets['props-room:market:player-prop-duel']

  assert.deepEqual(card.fields.map(field => field.fieldId), ['first-scorer', 'shots', 'assists', 'cards'])
  assert.equal(card.fields.find(field => field.fieldId === 'shots').tolerance, 1)
  assert.equal(market.marketType, 'player-prop')
  assert.equal(market.predictionShape, 'player-prop')
  assert.deepEqual(market.options, ['first-scorer', 'shots', 'assists', 'cards'])
  assert.deepEqual(market.inputTemplate, { playerId: null, prop: 'first-scorer', value: true })
  assert.equal(market.scoringConfig.firstScorerPoints, 3)
  assert.equal(market.scoringConfig.propTolerances.shots, 1)
})

test('launch matrix applies every event fit and accounts for incompatible variant templates', () => {
  const app = platform.createUltimateSportsPlatform()
  const matrix = app.createLaunchMatrix()
  const fitIds = catalog.listEventFits().map(fit => fit.fitId)
  const variantCatalog = new Map(catalog.POOL_VARIANT_CATALOG.map(variant => [variant.variantId, variant]))

  matrix.rows.forEach(row => {
    const scenario = app.createLaunchScenario({
      fitId: row.fitId,
      competitionId: `matrix-apply-${row.fitId}`,
      roomId: `matrix-apply-${row.fitId}:room`,
      maxVariants: 99,
      maxMiniGames: 99
    })
    const applied = app.applyScenario(scenario)

    assert.equal(applied.view.competitions[`matrix-apply-${row.fitId}`].template.kind, row.primary.templateKind)
    assert.equal(row.allVariantsCovered, true)
    assert.equal(row.allMiniGamesCovered, true)
    scenario.launchPlan.poolVariantIds.forEach(variantId => {
      assert.equal(variantCatalog.get(variantId).templateKinds.includes(scenario.launchPlan.templateKind), true)
    })
  })

  const local = matrix.rows.find(row => row.fitId === 'local-leagues')
  const localSurvivor = local.variantCoverage.find(item => item.variantId === 'survivor')
  const bridgeMatrix = bridge.createBridgeHandler({ platform: app }).handle(bridge.createBridgeRequest({
    action: 'createLaunchMatrix',
    requestId: 'launch-matrix',
    payload: { input: { category: 'soccer' } }
  }))

  assert.deepEqual(matrix.fitIds, fitIds)
  assert.equal(matrix.counts.fits, fitIds.length)
  assert.equal(matrix.counts.coveredMiniGames, matrix.counts.miniGames)
  assert.equal(local.primary.templateKind, 'single-elimination')
  assert.deepEqual(local.primary.droppedVariantIds, ['survivor'])
  assert.equal(localSurvivor.coverage, 'alternate')
  assert.equal(localSurvivor.templateKind, 'round-robin')
  assert.equal(bridgeMatrix.ok, true)
  assert.equal(bridgeMatrix.result.rows.length, 3)
})

test('launch planner creates watch-party bingo as a 3x3 event grid', () => {
  const app = platform.createUltimateSportsPlatform()
  const scenario = app.createLaunchScenario({
    fitId: 'local-leagues',
    competitionId: 'bingo-launch',
    roomId: 'bingo-room',
    variantIds: ['watch-party-bingo'],
    miniGameTypes: []
  })
  app.applyScenario(scenario)
  const bingo = app.view().cards['bingo-launch:card:watch-party-bingo']

  assert.equal(bingo.cardType, 'watch-party-bingo')
  assert.equal(bingo.fields.length, 9)
  assert.equal(bingo.scoringConfig.lineBonus, 2)
  assert.deepEqual(bingo.fields.map(field => field.metadata), [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
    { row: 1, col: 2 },
    { row: 2, col: 0 },
    { row: 2, col: 1 },
    { row: 2, col: 2 }
  ])
})
