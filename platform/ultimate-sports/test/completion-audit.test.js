'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  catalog,
  challenge,
  livePrediction,
  miniGame,
  platform
} = require('../src')

const REQUIRED_EVENT_FITS = Object.freeze([
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

const REQUIRED_POOL_VARIANTS = Object.freeze([
  'classic-bracket',
  'confidence',
  'survivor',
  'upset-bounty',
  'head-to-head-duel',
  'group-stage-card',
  'fantasy-lite-draft',
  'watch-party-bingo',
  'side-quest'
])

const REQUIRED_MINI_GAMES = Object.freeze([
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

const BEHAVIOR_TEST_FILES = Object.freeze([
  'test/catalog-engine.test.js',
  'test/launch-engine.test.js',
  'test/pool-live.test.js',
  'test/card-draft-game.test.js',
  'test/mini-game-engine.test.js',
  'test/watch-engine.test.js',
  'test/challenge-engine.test.js',
  'test/wager-engine.test.js',
  'test/creator-engine.test.js',
  'test/day-in-life.test.js'
])

test('completion audit covers every original event fit, variant, and mini-game', () => {
  const fitIds = catalog.listEventFits().map(fit => fit.fitId)
  const variantIds = catalog.POOL_VARIANT_CATALOG.map(variant => variant.variantId)
  const miniGameTypes = catalog.MINI_GAME_CATALOG.map(game => game.gameType)
  const matrix = platform.createUltimateSportsPlatform().createLaunchMatrix({
    maxVariants: 99,
    maxMiniGames: 99
  })

  assert.deepEqual(new Set(fitIds), new Set(REQUIRED_EVENT_FITS))
  REQUIRED_POOL_VARIANTS.forEach(variantId => {
    assert.equal(variantIds.includes(variantId), true, `${variantId} missing from catalog`)
    assert.equal(matrix.rows.some(row => row.variantCoverage.some(item => item.variantId === variantId && item.coverage !== 'missing')), true, `${variantId} missing launch coverage`)
  })
  REQUIRED_MINI_GAMES.forEach(gameType => {
    assert.equal(miniGameTypes.includes(gameType), true, `${gameType} missing from catalog`)
    assert.equal(matrix.rows.some(row => row.miniGameCoverage.some(item => item.gameType === gameType && item.coverage !== 'missing')), true, `${gameType} missing launch coverage`)
  })
  assert.equal(matrix.rows.every(row => row.primary.launchable && row.allVariantsCovered && row.allMiniGamesCovered), true)
})

test('completion audit maps mini-games to concrete runtime mechanisms', () => {
  const gameResolvers = new Set(miniGame.MINI_GAME_RESOLVERS)
  const marketTypes = new Set(livePrediction.MARKET_TYPES)
  const catalogByGame = new Map(catalog.MINI_GAME_CATALOG.map(game => [game.gameType, game]))

  ;['penalty-clash', 'free-kick-duel', 'trivia-duel', 'reaction-challenge'].forEach(gameType => {
    assert.equal(catalogByGame.get(gameType).commandType, 'game:create')
    assert.equal(gameResolvers.has(gameType), true, `${gameType} has no mini-game resolver`)
  })
  ;[
    ['next-event', 'next-event'],
    ['scoreline-lock', 'scoreline-lock'],
    ['momentum-duel', 'momentum-duel'],
    ['player-prop-duel', 'player-prop'],
    ['watch-party-streak', 'watch-party-streak']
  ].forEach(([gameType, marketType]) => {
    assert.equal(catalogByGame.get(gameType).commandType, 'market:create')
    assert.equal(marketTypes.has(marketType), true, `${gameType} has no market type`)
    assert.equal(livePrediction.marketOptionsFor(marketType).length > 0, true)
  })
  assert.equal(catalogByGame.get('peer-mini-fantasy').commandType, 'draft:create')
})

test('completion audit proves room challenge launchers and materializers cover P2P wager types', () => {
  const app = platform.createUltimateSportsPlatform()
  app.dispatch({
    type: 'room:create',
    actorId: 'alice',
    payload: {
      roomId: 'audit-room',
      competitionId: 'audit-comp',
      hostUserId: 'alice',
      status: 'live'
    }
  })
  ;['alice', 'bob'].forEach(userId => {
    app.dispatch({
      type: 'room:join',
      actorId: userId,
      payload: {
        roomId: 'audit-room',
        userId,
        username: userId
      }
    })
  })

  const launcher = app.createWatchPartyWorkbench({
    userId: 'alice',
    roomId: 'audit-room',
    defaultStake: {
      amount: 5,
      currency: 'CREDITS',
      termsAccepted: true
    }
  }).challengeLauncher
  const challengeTypes = new Set(launcher.challengeTypes.map(item => item.challengeType))
  const liveTypes = new Set(launcher.challengeTypes.filter(item => item.challengeType === 'live-prediction').map(item => item.marketType))
  const gameTypes = new Set(launcher.challengeTypes.filter(item => item.challengeType === 'peer-game').map(item => item.gameType))

  assert.deepEqual(challengeTypes, new Set(['peer-game', 'live-prediction', 'head-to-head-duel', 'side-quest']))
  ;['penalty-clash', 'free-kick-duel', 'trivia-duel', 'reaction-challenge'].forEach(gameType => {
    assert.equal(gameTypes.has(gameType), true)
  })
  ;['next-event', 'momentum-duel', 'scoreline-lock', 'player-prop'].forEach(marketType => {
    assert.equal(liveTypes.has(marketType), true)
  })

  const accepted = {
    challengeId: 'audit-challenge',
    roomId: 'audit-room',
    challengerUserId: 'alice',
    targetUserId: 'bob',
    status: 'accepted'
  }
  const room = app.view().rooms['audit-room']
  assert.equal(challenge.materializeAcceptedChallenge({
    challenge: { ...accepted, challengeType: 'head-to-head-duel' },
    room
  }).command.payload.variant, 'head-to-head-duel')
  assert.equal(challenge.materializeAcceptedChallenge({
    challenge: { ...accepted, challengeType: 'side-quest' },
    room
  }).command.payload.variant, 'side-quest')
  assert.equal(challenge.materializeAcceptedChallenge({
    challenge: { ...accepted, challengeType: 'live-prediction', marketType: 'scoreline-lock' },
    room
  }).command.payload.marketType, 'scoreline-lock')
  assert.equal(challenge.materializeAcceptedChallenge({
    challenge: { ...accepted, challengeType: 'peer-game', gameType: 'free-kick-duel' },
    room
  }).command.payload.gameType, 'free-kick-duel')
})

test('completion audit keeps proof files wired into the manifest', () => {
  const manifest = require('../platform.manifest.json')
  BEHAVIOR_TEST_FILES.concat('test/completion-audit.test.js').forEach(testFile => {
    assert.equal(manifest.testFiles.includes(testFile), true, `${testFile} missing from manifest`)
    assert.equal(manifest.testCommand.includes(`platform/ultimate-sports/${testFile}`), true, `${testFile} missing from test command`)
  })
})
