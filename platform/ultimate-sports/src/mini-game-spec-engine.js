'use strict'

const catalog = require('./catalog-engine')
const livePrediction = require('./live-prediction-engine')
const miniGame = require('./mini-game-engine')
const { cloneJson } = require('./util')

const SPEC_VERSION = 'ultimate-sports-mini-game-spec-v1'
const SUITE_VERSION = 'ultimate-sports-mini-game-suite-v1'

const GAME_BLUEPRINTS = Object.freeze({
  'penalty-clash': blueprint({
    title: 'Penalty Clash',
    mode: 'peer-game',
    commandType: 'game:create',
    resolver: 'penalty-clash',
    playerCount: 'two-peer',
    controls: ['aim-lane', 'shot-power', 'keeper-read', 'round-reveal'],
    evidence: ['commit', 'reveal', 'result-hash'],
    scoring: 'one point per converted penalty',
    defaultRounds: 5
  }),
  'free-kick-duel': blueprint({
    title: 'Free-kick Duel',
    mode: 'peer-game',
    commandType: 'game:create',
    resolver: 'free-kick-duel',
    playerCount: 'two-peer',
    controls: ['aim-target', 'curve-slider', 'power-meter', 'wall-read', 'keeper-read'],
    evidence: ['commit', 'reveal', 'result-hash'],
    scoring: 'three points for a goal, one point for a clean shot on frame',
    defaultRounds: 3
  }),
  'trivia-duel': blueprint({
    title: 'Trivia Duel',
    mode: 'peer-game',
    commandType: 'game:create',
    resolver: 'trivia-duel',
    playerCount: 'two-peer-or-room',
    controls: ['question-card', 'answer-choice', 'timer', 'response-time'],
    evidence: ['question-bank', 'answer-key', 'response-time'],
    scoring: 'correct answers first, fastest total response time breaks ties',
    defaultRounds: 5
  }),
  'reaction-challenge': blueprint({
    title: 'Reaction Challenge',
    mode: 'peer-game',
    commandType: 'game:create',
    resolver: 'reaction-challenge',
    playerCount: 'room',
    controls: ['moment-feed', 'tap-target', 'latency-window', 'fastest-tap-result'],
    evidence: ['moment-id', 'tap-timestamp', 'latency-window'],
    scoring: 'one point for each fastest valid reaction moment',
    defaultRounds: 5
  }),
  'next-event': blueprint({
    title: 'Next Event Prediction',
    mode: 'live-market',
    commandType: 'market:create',
    marketType: 'next-event',
    playerCount: 'room',
    controls: ['event-chip', 'lock-window', 'single-choice-submit'],
    evidence: ['feed-event', 'market-lock', 'result-snapshot'],
    scoring: 'one point for matching the next resolved event',
    defaultRounds: 1
  }),
  'scoreline-lock': blueprint({
    title: 'Scoreline Lock',
    mode: 'live-market',
    commandType: 'market:create',
    marketType: 'scoreline-lock',
    playerCount: 'room',
    controls: ['home-score-stepper', 'away-score-stepper', 'lock-before-phase'],
    evidence: ['market-lock', 'final-score', 'result-snapshot'],
    scoring: 'exact score beats result-class hit',
    defaultRounds: 1
  }),
  'momentum-duel': blueprint({
    title: 'Momentum Duel',
    mode: 'live-market',
    commandType: 'market:create',
    marketType: 'momentum-duel',
    playerCount: 'two-peer-or-room',
    controls: ['side-selector', 'window-length', 'pressure-meter'],
    evidence: ['feed-window', 'pressure-metrics', 'market-lock'],
    scoring: 'one point for matching the next pressure-window winner',
    defaultRounds: 1
  }),
  'player-prop-duel': blueprint({
    title: 'Player Prop Duel',
    mode: 'live-market',
    commandType: 'market:create',
    marketType: 'player-prop',
    playerCount: 'two-peer-or-room',
    controls: ['player-selector', 'prop-selector', 'value-input', 'tolerance-preview'],
    evidence: ['player-stat-feed', 'market-lock', 'result-snapshot'],
    scoring: 'first-scorer and stat-total props use configured points and tolerance',
    defaultRounds: 1
  }),
  'watch-party-streak': blueprint({
    title: 'Watch-party Streak',
    mode: 'live-market',
    commandType: 'market:create',
    marketType: 'watch-party-streak',
    playerCount: 'room',
    controls: ['prompt-rail', 'yes-no-choice', 'streak-counter', 'room-leaderboard'],
    evidence: ['ordered-market-results', 'market-locks', 'streak-resolution'],
    scoring: 'longest consecutive correct streak wins',
    defaultRounds: 5
  }),
  'peer-mini-fantasy': blueprint({
    title: 'Peer Mini Fantasy',
    mode: 'draft',
    commandType: 'draft:create',
    draftType: 'fantasy-lite',
    playerCount: 'two-peer-or-room',
    controls: ['roster-slots', 'athlete-list', 'stat-category-preview', 'draft-lock'],
    evidence: ['draft-entry', 'athlete-stats', 'result-snapshot'],
    scoring: 'sum selected athlete stat points for a match or slate',
    defaultRounds: 1
  })
})

const FIT_CONTEXTS = Object.freeze({
  'world-cup': context({
    headline: 'Global matchday live games',
    eventOptions: ['goal', 'corner', 'card', 'shot', 'save', 'VAR', 'penalty', 'comeback'],
    propOptions: ['first-scorer', 'shots', 'assists', 'cards'],
    triviaTopics: ['nations', 'golden boot', 'group tables', 'knockout history'],
    reactionMoments: ['goal', 'save', 'penalty', 'red-card', 'VAR-overturn'],
    fantasyStats: ['goals', 'assists', 'shots', 'saves', 'cleanSheet'],
    scorelineLabel: 'final score before minute X',
    resultSource: 'official-feed'
  }),
  'euros-copa-america': context({
    headline: 'International cup watch-party games',
    eventOptions: ['goal', 'assist', 'card', 'save', 'corner', 'penalty', 'scoreline'],
    propOptions: ['first-scorer', 'shots', 'assists', 'cards'],
    triviaTopics: ['regional champions', 'star players', 'derby history', 'hosts'],
    reactionMoments: ['goal', 'save', 'penalty', 'late-winner'],
    fantasyStats: ['goals', 'assists', 'shots', 'cards'],
    scorelineLabel: 'regional cup final score',
    resultSource: 'official-feed'
  }),
  'champions-league-knockout': context({
    headline: 'Club knockout pressure games',
    eventOptions: ['goal', 'free-kick', 'penalty', 'save', 'aggregate-swing', 'extra-time'],
    propOptions: ['first-scorer', 'shots', 'assists', 'cards'],
    triviaTopics: ['club history', 'two-leg ties', 'finals', 'star forwards'],
    reactionMoments: ['goal', 'free-kick', 'penalty', 'aggregate-change'],
    fantasyStats: ['goals', 'assists', 'shots', 'saves'],
    scorelineLabel: 'match or aggregate scoreline',
    resultSource: 'official-feed'
  }),
  'march-madness': context({
    headline: 'Bracket-night basketball games',
    eventOptions: ['next-basket', 'three', 'foul', 'rebound', 'assist', 'lead-change', 'timeout'],
    propOptions: ['points', 'assists', 'rebounds', 'blocks', 'steals', 'fouls'],
    triviaTopics: ['seeds', 'regions', 'upsets', 'coaches', 'mascots'],
    reactionMoments: ['buzzer-beater', 'dunk', 'three', 'block', 'lead-change'],
    fantasyStats: ['points', 'rebounds', 'assists', 'steals', 'blocks'],
    scorelineLabel: 'basketball final score',
    resultSource: 'official-feed'
  }),
  'pro-playoffs': context({
    headline: 'Series and daily slate games',
    eventOptions: ['next-goal', 'next-run', 'next-basket', 'save', 'strikeout', 'power-play', 'lead-change'],
    propOptions: ['points', 'goals', 'runs', 'assists', 'saves', 'strikeouts'],
    triviaTopics: ['series history', 'playoff records', 'star players', 'venues'],
    reactionMoments: ['walkoff', 'overtime-goal', 'poster-dunk', 'big-save', 'home-run'],
    fantasyStats: ['points', 'goals', 'runs', 'assists', 'saves', 'strikeouts'],
    scorelineLabel: 'game score or series clincher',
    resultSource: 'official-feed'
  }),
  'tennis-grand-slams': context({
    headline: 'Draw and set-by-set games',
    eventOptions: ['next-game', 'break-point', 'ace', 'double-fault', 'tiebreak', 'set-winner'],
    propOptions: ['aces', 'double-faults', 'breaks', 'sets-won'],
    triviaTopics: ['surfaces', 'seeds', 'slam history', 'head-to-head records'],
    reactionMoments: ['ace', 'break-point', 'match-point', 'tiebreak-winner'],
    fantasyStats: ['aces', 'breaks', 'setsWon', 'winners'],
    scorelineLabel: 'set score or match score',
    resultSource: 'official-feed'
  }),
  'esports-major': context({
    headline: 'Map, objective, and clutch games',
    eventOptions: ['next-map', 'first-blood', 'objective', 'clutch', 'ace', 'overtime', 'economy-swing'],
    propOptions: ['kills', 'assists', 'objectives', 'saves', 'goals'],
    triviaTopics: ['maps', 'agents', 'champions', 'patch meta', 'teams'],
    reactionMoments: ['clutch', 'ace', 'objective-steal', 'overtime', 'map-win'],
    fantasyStats: ['kills', 'assists', 'objectives', 'saves'],
    scorelineLabel: 'map score or series score',
    resultSource: 'official-feed'
  }),
  'mma-boxing-fight-card': context({
    headline: 'Fight-night card games',
    eventOptions: ['round-winner', 'knockdown', 'takedown', 'submission', 'stoppage', 'decision'],
    propOptions: ['method', 'round', 'knockdowns', 'takedowns', 'significant-strikes'],
    triviaTopics: ['fighters', 'weight classes', 'prior bouts', 'methods'],
    reactionMoments: ['knockdown', 'submission', 'stoppage', 'walkout', 'decision'],
    fantasyStats: ['strikes', 'takedowns', 'knockdowns', 'roundsWon'],
    scorelineLabel: 'method and round result',
    resultSource: 'official-feed'
  }),
  'creator-reality-brackets': context({
    headline: 'Creator reveal and episode games',
    eventOptions: ['reveal', 'judge-choice', 'fan-vote', 'challenge-winner', 'elimination'],
    propOptions: ['winner', 'category-score', 'fan-votes', 'judge-pick'],
    triviaTopics: ['creators', 'episodes', 'songs', 'dishes', 'challenges'],
    reactionMoments: ['winner-reveal', 'elimination', 'performance', 'twist'],
    fantasyStats: ['wins', 'fanVotes', 'judgeScores', 'challengePoints'],
    scorelineLabel: 'host-defined score or category result',
    resultSource: 'host-entered'
  }),
  'awards-prediction-pools': context({
    headline: 'Ceremony-night prediction games',
    eventOptions: ['category-winner', 'upset', 'speech', 'performance', 'jury-vote', 'public-vote'],
    propOptions: ['winner', 'speech-length', 'jury-vote', 'public-vote'],
    triviaTopics: ['nominees', 'prior winners', 'songs', 'films', 'performers'],
    reactionMoments: ['winner-reveal', 'upset', 'performance', 'standing-ovation'],
    fantasyStats: ['categoryWins', 'publicVotes', 'juryVotes', 'performancePoints'],
    scorelineLabel: 'category winner card',
    resultSource: 'host-entered'
  }),
  'local-leagues': context({
    headline: 'Local and rec-room games',
    eventOptions: ['next-score', 'player-prop', 'team-streak', 'manual-stat', 'local-trivia'],
    propOptions: ['goals', 'points', 'assists', 'saves', 'custom-stat'],
    triviaTopics: ['office lore', 'school teams', 'pub history', 'rec players'],
    reactionMoments: ['goal', 'big-play', 'save', 'match-point', 'host-marked-moment'],
    fantasyStats: ['goals', 'points', 'assists', 'saves', 'customStat'],
    scorelineLabel: 'manual scoreline',
    resultSource: 'host-entered'
  })
})

function createMiniGameSpec ({ fitId, gameType, settlementMode = 'demo' } = {}) {
  const fit = fitFor(fitId)
  const blueprint = blueprintFor(gameType)
  const context = contextFor(fit.fitId)
  const marketType = blueprint.marketType || null

  return {
    specVersion: SPEC_VERSION,
    fitId: fit.fitId,
    fitTitle: fit.title,
    category: fit.category,
    gameType,
    title: `${blueprint.title} for ${fit.title}`,
    headline: context.headline,
    mode: blueprint.mode,
    commandType: blueprint.commandType,
    runtime: runtimeFor(blueprint),
    resultSource: context.resultSource,
    playerCount: blueprint.playerCount,
    defaultRounds: blueprint.defaultRounds,
    ui: {
      placement: placementFor(blueprint),
      controls: blueprint.controls.slice(),
      eventOptions: optionsForGame({ gameType, context, marketType }),
      promptCopy: promptCopyFor({ gameType, fit, context }),
      accessibility: ['large-tap-targets', 'timer-state-text', 'result-explanation']
    },
    scoring: scoringFor({ blueprint, marketType }),
    evidence: blueprint.evidence.slice(),
    sportTuning: {
      scorelineLabel: context.scorelineLabel,
      triviaTopics: context.triviaTopics.slice(),
      reactionMoments: context.reactionMoments.slice(),
      propOptions: context.propOptions.slice(),
      fantasyStats: context.fantasyStats.slice()
    },
    commandDraft: commandDraftFor({
      fit,
      gameType,
      blueprint,
      context,
      settlementMode
    })
  }
}

function createMiniGameSuite ({ fitId, settlementMode = 'demo' } = {}) {
  const fit = fitFor(fitId)
  const specs = fit.recommendedMiniGames.map(gameType => createMiniGameSpec({
    fitId: fit.fitId,
    gameType,
    settlementMode
  }))
  return {
    suiteVersion: SUITE_VERSION,
    fitId: fit.fitId,
    title: `${fit.title} Mini-game Suite`,
    category: fit.category,
    resultPolicy: fit.resultPolicy,
    settlementMode,
    gameTypes: specs.map(spec => spec.gameType),
    specs
  }
}

function createMiniGameBuildMatrix ({ settlementMode = 'demo' } = {}) {
  const suites = catalog.listEventFits().map(fit => createMiniGameSuite({
    fitId: fit.fitId,
    settlementMode
  }))
  return {
    matrixVersion: 'ultimate-sports-mini-game-build-matrix-v1',
    fitIds: suites.map(suite => suite.fitId),
    totalSpecs: suites.reduce((sum, suite) => sum + suite.specs.length, 0),
    suites,
    resolverCoverage: resolverCoverage(),
    marketCoverage: livePrediction.MARKET_TYPES.slice()
  }
}

function resolverCoverage () {
  return miniGame.MINI_GAME_RESOLVERS.slice()
}

function runtimeFor (blueprint) {
  if (blueprint.resolver) {
    return {
      kind: 'mini-game-resolver',
      resolver: blueprint.resolver
    }
  }
  if (blueprint.marketType) {
    return {
      kind: 'live-prediction-market',
      marketType: blueprint.marketType,
      predictionShape: livePrediction.predictionShapeForMarket(blueprint.marketType)
    }
  }
  return {
    kind: 'fantasy-lite-draft',
    draftType: blueprint.draftType
  }
}

function placementFor (blueprint) {
  if (blueprint.mode === 'peer-game') return 'challenge-tray'
  if (blueprint.mode === 'draft') return 'picks-and-watch'
  return 'watch-room-live-rail'
}

function optionsForGame ({ gameType, context, marketType }) {
  if (gameType === 'trivia-duel') return context.triviaTopics.slice()
  if (gameType === 'reaction-challenge') return context.reactionMoments.slice()
  if (gameType === 'player-prop-duel') return context.propOptions.slice()
  if (gameType === 'peer-mini-fantasy') return context.fantasyStats.slice()
  if (gameType === 'scoreline-lock') return [context.scorelineLabel]
  if (marketType) return context.eventOptions.slice()
  return context.eventOptions.slice(0, 6)
}

function promptCopyFor ({ gameType, fit, context }) {
  if (gameType === 'scoreline-lock') return `Lock the ${context.scorelineLabel} before the room cutoff.`
  if (gameType === 'player-prop-duel') return `Pick the player prop that decides ${fit.title}.`
  if (gameType === 'peer-mini-fantasy') return `Draft a tiny roster for this ${fit.category} slate.`
  if (gameType === 'watch-party-streak') return 'Keep the streak alive across consecutive live prompts.'
  return `Play ${GAME_BLUEPRINTS[gameType].title} during ${fit.title}.`
}

function scoringFor ({ blueprint, marketType }) {
  if (marketType) {
    return {
      summary: blueprint.scoring,
      config: livePrediction.scoringConfigForMarket(marketType)
    }
  }
  return {
    summary: blueprint.scoring,
    config: {
      resolver: blueprint.resolver || blueprint.draftType,
      defaultRounds: blueprint.defaultRounds
    }
  }
}

function commandDraftFor ({ fit, gameType, blueprint, context, settlementMode }) {
  if (blueprint.commandType === 'game:create') {
    return {
      type: 'game:create',
      payload: {
        gameType,
        title: `${blueprint.title} - ${fit.title}`,
        stakeMode: settlementMode,
        players: ['peer-a', 'peer-b'],
        resolverVersion: `${gameType}-v1`,
        inputSchema: {
          controls: blueprint.controls.slice(),
          eventOptions: context.eventOptions.slice(),
          roundCount: blueprint.defaultRounds
        }
      }
    }
  }
  if (blueprint.commandType === 'market:create') {
    return {
      type: 'market:create',
      payload: {
        marketType: blueprint.marketType,
        title: `${blueprint.title} - ${fit.title}`,
        mode: settlementMode,
        options: optionsForGame({ gameType, context, marketType: blueprint.marketType }),
        inputTemplate: livePrediction.inputTemplateForMarket(blueprint.marketType),
        scoringConfig: livePrediction.scoringConfigForMarket(blueprint.marketType)
      }
    }
  }
  return {
    type: 'draft:create',
    payload: {
      draftType: blueprint.draftType,
      title: `${blueprint.title} - ${fit.title}`,
      rosterSize: 3,
      statCategories: context.fantasyStats.slice(),
      mode: settlementMode
    }
  }
}

function fitFor (fitId) {
  const fit = catalog.getEventFit(fitId)
  if (!fit) throw new Error(`unknown fit: ${fitId}`)
  return fit
}

function blueprintFor (gameType) {
  const blueprint = GAME_BLUEPRINTS[gameType]
  if (!blueprint) throw new Error(`unknown mini-game type: ${gameType}`)
  return blueprint
}

function contextFor (fitId) {
  const context = FIT_CONTEXTS[fitId]
  if (!context) throw new Error(`missing mini-game context for fit: ${fitId}`)
  return context
}

function blueprint (input) {
  return Object.freeze({
    title: input.title,
    mode: input.mode,
    commandType: input.commandType,
    resolver: input.resolver || null,
    marketType: input.marketType || null,
    draftType: input.draftType || null,
    playerCount: input.playerCount,
    controls: Object.freeze(input.controls.slice()),
    evidence: Object.freeze(input.evidence.slice()),
    scoring: input.scoring,
    defaultRounds: input.defaultRounds
  })
}

function context (input) {
  return Object.freeze({
    headline: input.headline,
    eventOptions: Object.freeze(input.eventOptions.slice()),
    propOptions: Object.freeze(input.propOptions.slice()),
    triviaTopics: Object.freeze(input.triviaTopics.slice()),
    reactionMoments: Object.freeze(input.reactionMoments.slice()),
    fantasyStats: Object.freeze(input.fantasyStats.slice()),
    scorelineLabel: input.scorelineLabel,
    resultSource: input.resultSource
  })
}

module.exports = {
  SPEC_VERSION,
  SUITE_VERSION,
  GAME_BLUEPRINTS,
  FIT_CONTEXTS,
  createMiniGameSpec,
  createMiniGameSuite,
  createMiniGameBuildMatrix,
  resolverCoverage
}
