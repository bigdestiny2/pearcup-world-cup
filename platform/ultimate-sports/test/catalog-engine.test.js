'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { bridge, catalog, platform } = require('../src')

test('catalog covers the target event-fit families from the product plan', () => {
  const fitIds = catalog.listEventFits().map(fit => fit.fitId)

  assert.deepEqual(new Set(fitIds), new Set([
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
  ]))
  assert.equal(catalog.listEventFits({ category: 'soccer' }).length, 3)
  assert.equal(catalog.getEventFit('world-cup').templateKinds.includes('group-plus-knockout'), true)
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
