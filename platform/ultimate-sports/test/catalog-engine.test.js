'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { bridge, catalog, launch, miniGame, platform } = require('../src')

const PLAN_FIT_IDS = Object.freeze([
  'world-cup',
  'euros-copa-america',
  'champions-league-knockout',
  'march-madness',
  'pro-playoffs',
  'tennis-grand-slams',
  'esports-major',
  'mma-boxing-fight-card',
  'creator-reality-brackets',
  'awards-prediction-pools',
  'local-leagues'
])

const PLAN_VARIANT_IDS = Object.freeze([
  'classic-bracket',
  'confidence',
  'survivor',
  'upset-bounty',
  'head-to-head-duel',
  'group-stage-card',
  'fantasy-lite-draft',
  'watch-party-bingo'
])

const PLAN_MINI_GAME_TYPES = Object.freeze([
  'penalty-clash',
  'free-kick-duel',
  'trivia-duel',
  'next-event',
  'scoreline-lock',
  'momentum-duel',
  'player-prop-duel',
  'reaction-challenge',
  'watch-party-streak',
  'peer-mini-fantasy'
])

const PLAN_SIDE_QUEST_VARIANT_ID = 'side-quest'

test('catalog covers the target event-fit families from the product plan', () => {
  const fitIds = catalog.listEventFits().map(fit => fit.fitId)

  assert.deepEqual(new Set(fitIds), new Set(PLAN_FIT_IDS))
  assert.equal(catalog.listEventFits({ category: 'soccer' }).length, 3)
  assert.equal(catalog.getEventFit('world-cup').templateKinds.includes('group-plus-knockout'), true)
})

test('catalog keeps every product-plan pool variant and mini-game mapped to runtime behavior', () => {
  const variantIds = new Set(catalog.POOL_VARIANT_CATALOG.map(item => item.variantId))
  const gameTypes = new Set(catalog.MINI_GAME_CATALOG.map(item => item.gameType))
  const resolverTypes = new Set(miniGame.MINI_GAME_RESOLVERS)
  const marketTypes = new Set(['next-event', 'scoreline-lock', 'momentum-duel', 'player-prop-duel', 'watch-party-streak'])

  PLAN_VARIANT_IDS.concat(PLAN_SIDE_QUEST_VARIANT_ID).forEach(variantId => {
    assert.equal(variantIds.has(variantId), true, `${variantId} missing from pool variant catalog`)
  })
  PLAN_MINI_GAME_TYPES.forEach(gameType => {
    const entry = catalog.MINI_GAME_CATALOG.find(item => item.gameType === gameType)
    assert.equal(Boolean(entry), true, `${gameType} missing from mini-game catalog`)
    if (entry.commandType === 'game:create') assert.equal(resolverTypes.has(gameType), true, `${gameType} missing resolver`)
    if (entry.commandType === 'market:create') assert.equal(marketTypes.has(gameType), true, `${gameType} missing market launch mapping`)
    if (entry.commandType === 'draft:create') assert.equal(gameType, 'peer-mini-fantasy')
  })
})

test('plan mini-games have recommended fit coverage and launch matrix behavior', () => {
  const matrix = launch.createLaunchMatrix({ maxVariants: 99, maxMiniGames: 99 })

  PLAN_MINI_GAME_TYPES.forEach(gameType => {
    const recommendedFits = catalog.listEventFits()
      .filter(fit => fit.recommendedMiniGames.includes(gameType))
      .filter(fit => catalog.listMiniGames({ fitId: fit.fitId }).some(item => item.gameType === gameType))
      .map(fit => fit.fitId)
    const launchRows = matrix.rows
      .filter(row => row.miniGameCoverage.some(item => item.gameType === gameType && item.coverage !== 'missing'))
      .map(row => row.fitId)

    assert.equal(recommendedFits.length > 0, true, `${gameType} has no compatible recommended fit`)
    assert.equal(launchRows.length > 0, true, `${gameType} has no launch behavior`)
  })

  assert.equal(catalog.listMiniGames({ fitId: 'world-cup' }).some(item => item.gameType === 'reaction-challenge'), true)
  assert.equal(catalog.listMiniGames({ fitId: 'local-leagues' }).some(item => item.gameType === 'free-kick-duel'), true)
  assert.equal(catalog.listMiniGames({ fitId: 'march-madness' }).some(item => item.gameType === 'player-prop-duel'), true)
  assert.equal(catalog.listMiniGames({ fitId: 'esports-major' }).some(item => item.gameType === 'watch-party-streak'), true)
})

test('world cup recommendations combine bracket pools with live soccer games', () => {
  const stack = catalog.recommendProductStack({
    fitId: 'world-cup',
    settlementMode: 'demo'
  })
  const variantIds = stack.poolVariants.map(item => item.variantId)
  const gameTypes = stack.miniGames.map(item => item.gameType)

  assert.equal(stack.templateKind, 'group-plus-knockout')
  assert.equal(variantIds.includes('classic-bracket'), true)
  assert.equal(variantIds.includes('group-stage-card'), true)
  assert.equal(gameTypes.includes('penalty-clash'), true)
  assert.equal(gameTypes.includes('next-event'), true)
  assert.equal(stack.launchChecklist.includes('connect-official-results'), true)
})

test('awards pools recommend prediction cards and reject soccer-only mini games', () => {
  const variants = catalog.listPoolVariants({ fitId: 'awards-prediction-pools' })
  const games = catalog.listMiniGames({ fitId: 'awards-prediction-pools' })
  const compatible = catalog.compatibilityFor({
    fitId: 'awards-prediction-pools',
    variantId: 'group-stage-card',
    gameType: 'trivia-duel',
    settlementMode: 'demo'
  })
  const mismatch = catalog.compatibilityFor({
    fitId: 'awards-prediction-pools',
    gameType: 'penalty-clash',
    settlementMode: 'demo'
  })

  assert.equal(variants.some(item => item.variantId === 'group-stage-card'), true)
  assert.equal(variants.some(item => item.variantId === 'watch-party-bingo'), true)
  assert.equal(games.some(item => item.gameType === 'trivia-duel'), true)
  assert.equal(compatible.compatible, true)
  assert.equal(mismatch.compatible, false)
  assert.match(mismatch.reasons.join(' '), /not recommended/)
})

test('facade and bridge expose catalog recommendations', () => {
  const app = platform.createUltimateSportsPlatform()
  const soccerCatalog = app.catalog({ category: 'soccer' })
  const facadeStack = app.recommendStack({ fitId: 'mma-boxing-fight-card' })
  const facadeMismatch = app.catalogCompatibility({
    fitId: 'mma-boxing-fight-card',
    variantId: 'classic-bracket'
  })
  const handler = bridge.createBridgeHandler({ platform: app })
  const bridgeStack = handler.handle(bridge.createBridgeRequest({
    action: 'recommendStack',
    requestId: 'catalog-stack',
    payload: {
      input: { fitId: 'local-leagues' }
    }
  }))

  assert.equal(soccerCatalog.eventFits.some(item => item.fitId === 'world-cup'), true)
  assert.equal(facadeStack.templateKind, 'fight-card')
  assert.equal(facadeStack.poolVariants.some(item => item.variantId === 'player-prop'), true)
  assert.equal(facadeMismatch.compatible, false)
  assert.equal(bridgeStack.ok, true)
  assert.equal(bridgeStack.result.fit.fitId, 'local-leagues')
  assert.equal(bridgeStack.result.launchChecklist.includes('assign-host-result-review'), true)
})
