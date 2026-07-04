'use strict'

const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  catalog,
  livePrediction,
  miniGame,
  miniGameSpec,
  platform,
  tournamentExperience
} = require('../src')

const specDocPath = path.join(__dirname, '..', 'docs', 'mini-game-specs.md')
const specDoc = fs.readFileSync(specDocPath, 'utf8')

test('mini-game suites cover every catalog-recommended game for every event fit', () => {
  catalog.listEventFits().forEach(fit => {
    const suite = miniGameSpec.createMiniGameSuite({ fitId: fit.fitId })

    assert.equal(suite.fitId, fit.fitId)
    assert.deepEqual(suite.gameTypes, fit.recommendedMiniGames)
    assert.equal(suite.specs.length, fit.recommendedMiniGames.length)
    suite.specs.forEach(spec => {
      assert.equal(spec.fitId, fit.fitId)
      assert.equal(spec.title.includes(fit.title), true)
      assert.equal(spec.ui.controls.length > 0, true, `${fit.fitId}:${spec.gameType} missing controls`)
      assert.equal(spec.ui.eventOptions.length > 0, true, `${fit.fitId}:${spec.gameType} missing event options`)
      assert.equal(spec.evidence.length > 0, true, `${fit.fitId}:${spec.gameType} missing evidence`)
      assert.equal(typeof spec.scoring.summary, 'string')
      assert.equal(spec.commandDraft.payload.title.includes(fit.title), true)
    })
  })
})

test('mini-game specs map to real resolvers, live markets, or fantasy draft commands', () => {
  const resolverSet = new Set(miniGame.MINI_GAME_RESOLVERS)
  const marketSet = new Set(livePrediction.MARKET_TYPES)
  const matrix = miniGameSpec.createMiniGameBuildMatrix()

  assert.equal(matrix.fitIds.length, catalog.listEventFits().length)
  assert.equal(matrix.totalSpecs, matrix.suites.reduce((sum, suite) => sum + suite.specs.length, 0))

  matrix.suites.flatMap(suite => suite.specs).forEach(spec => {
    if (spec.mode === 'peer-game') {
      assert.equal(spec.commandDraft.type, 'game:create')
      assert.equal(resolverSet.has(spec.runtime.resolver), true, `${spec.gameType} missing resolver`)
    } else if (spec.mode === 'live-market') {
      assert.equal(spec.commandDraft.type, 'market:create')
      assert.equal(marketSet.has(spec.runtime.marketType), true, `${spec.gameType} missing market type`)
      assert.equal(spec.runtime.predictionShape, livePrediction.predictionShapeForMarket(spec.runtime.marketType))
    } else {
      assert.equal(spec.mode, 'draft')
      assert.equal(spec.commandDraft.type, 'draft:create')
      assert.equal(spec.commandDraft.payload.rosterSize, 3)
    }
  })
})

test('sport-specific mini-game specs tune prompts and result sources by tournament', () => {
  const soccer = miniGameSpec.createMiniGameSpec({ fitId: 'world-cup', gameType: 'next-event' })
  const basketball = miniGameSpec.createMiniGameSpec({ fitId: 'march-madness', gameType: 'player-prop-duel' })
  const esports = miniGameSpec.createMiniGameSpec({ fitId: 'esports-major', gameType: 'momentum-duel' })
  const awards = miniGameSpec.createMiniGameSpec({ fitId: 'awards-prediction-pools', gameType: 'trivia-duel' })
  const local = miniGameSpec.createMiniGameSpec({ fitId: 'local-leagues', gameType: 'peer-mini-fantasy' })

  assert.equal(soccer.ui.eventOptions.includes('goal'), true)
  assert.equal(soccer.commandDraft.payload.options.includes('VAR'), true)
  assert.equal(basketball.sportTuning.propOptions.includes('rebounds'), true)
  assert.equal(basketball.ui.controls.includes('player-selector'), true)
  assert.equal(esports.ui.eventOptions.includes('objective'), true)
  assert.equal(esports.runtime.marketType, 'momentum-duel')
  assert.equal(awards.resultSource, 'host-entered')
  assert.equal(awards.sportTuning.triviaTopics.includes('nominees'), true)
  assert.equal(local.commandDraft.payload.statCategories.includes('customStat'), true)
  assert.equal(local.resultSource, 'host-entered')
})

test('tournament shell mini-game dock is backed by full specs', () => {
  catalog.listEventFits().forEach(fit => {
    const shellState = tournamentExperience.createTournamentShell({ selectedFitId: fit.fitId })
    const suite = miniGameSpec.createMiniGameSuite({ fitId: fit.fitId })

    assert.equal(shellState.shell.miniGameDock.length, suite.specs.length)
    shellState.shell.miniGameDock.forEach(item => {
      const spec = suite.specs.find(candidate => candidate.gameType === item.gameType)
      assert.ok(spec, `${fit.fitId}:${item.gameType} missing suite spec`)
      assert.equal(item.commandType, spec.commandType)
      assert.deepEqual(item.runtime, spec.runtime)
      assert.equal(item.controls.length, spec.ui.controls.length)
      assert.equal(item.scoringSummary, spec.scoring.summary)
      assert.equal(item.commandDraft.type, spec.commandDraft.type)
    })
  })
})

test('platform facade exposes mini-game specs, suites, and build matrix', () => {
  const app = platform.createUltimateSportsPlatform()
  const spec = app.createMiniGameSpec({ fitId: 'tennis-grand-slams', gameType: 'scoreline-lock' })
  const suite = app.createMiniGameSuite({ fitId: 'tennis-grand-slams' })
  const matrix = app.createMiniGameBuildMatrix()

  assert.equal(spec.sportTuning.scorelineLabel, 'set score or match score')
  assert.equal(spec.commandDraft.type, 'market:create')
  assert.equal(suite.gameTypes.includes('scoreline-lock'), true)
  assert.equal(matrix.fitIds.includes('tennis-grand-slams'), true)
})

test('mini-game spec doc names every event fit and every supported mini-game type', () => {
  catalog.listEventFits().forEach(fit => {
    assert.equal(specDoc.includes(`### \`${fit.fitId}\``), true, `${fit.fitId} missing from docs`)
  })
  Object.keys(miniGameSpec.GAME_BLUEPRINTS).forEach(gameType => {
    assert.equal(specDoc.includes(`\`${gameType}\``), true, `${gameType} missing from docs`)
  })
  ;['createMiniGameSuite', 'createTournamentShell'].forEach(methodName => {
    assert.equal(specDoc.includes(methodName), true, `${methodName} missing build contract`)
  })
})
