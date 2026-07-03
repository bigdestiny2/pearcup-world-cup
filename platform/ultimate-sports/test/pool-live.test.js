'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { feed, livePrediction, platform, pool, prediction, scoring } = require('../src')

function lockedEntry (userId, variant, picks) {
  const entryType = variant === 'survivor' ? 'survivor' : variant === 'confidence' ? 'card' : 'bracket'
  return prediction.lockPredictionEntry(prediction.submitPredictionEntry(prediction.createPredictionEntry({
    poolId: `pool-${variant}`,
    userId,
    entryType,
    picks
  }), '2026-07-03T10:00:00.000Z'), '2026-07-03T10:05:00.000Z')
}

test('pool engine resolves classic bracket winners with ties', () => {
  const rules = prediction.createPoolRules({ variant: 'classic-bracket', payoutPolicy: 'demo' })
  const bracketPool = pool.createPool({ poolId: 'pool-classic-bracket', competitionId: 'cup-1', rules })
  const snapshot = feed.createResultSnapshot({
    competitionId: 'cup-1',
    results: {
      a: { winnerEntrantId: 'red', roundNumber: 1 },
      b: { winnerEntrantId: 'blue', roundNumber: 1 }
    }
  })

  const result = pool.resolvePoolWinners({
    pool: bracketPool,
    resultSnapshot: snapshot,
    entries: [
      lockedEntry('user-a', 'classic-bracket', { a: 'red', b: 'green' }),
      lockedEntry('user-b', 'classic-bracket', { a: 'red', b: 'yellow' }),
      lockedEntry('user-c', 'classic-bracket', { a: 'purple', b: 'blue' })
    ]
  })

  assert.equal(result.winningScore, 1)
  assert.deepEqual(result.winnerUserIds, ['user-a', 'user-b', 'user-c'])
  assert.equal(result.tied, true)
})

test('survivor scoring eliminates repeated or incorrect picks', () => {
  const survivor = lockedEntry('user-survivor', 'survivor', [
    { roundNumber: 1, fixtureId: 'm1', entrantId: 'alpha' },
    { roundNumber: 2, fixtureId: 'm2', entrantId: 'alpha' },
    { roundNumber: 3, fixtureId: 'm3', entrantId: 'gamma' }
  ])
  const snapshot = feed.createResultSnapshot({
    competitionId: 'cup-survivor',
    results: {
      m1: { winnerEntrantId: 'alpha', roundNumber: 1 },
      m2: { winnerEntrantId: 'alpha', roundNumber: 2 },
      m3: { winnerEntrantId: 'delta', roundNumber: 3 }
    }
  })

  const row = scoring.scoreSurvivorEntry({ entry: survivor, resultSnapshot: snapshot })

  assert.equal(row.score, 1)
  assert.equal(row.alive, false)
  assert.equal(row.eliminatedAt, 2)
  assert.equal(row.detail[1].repeated, true)
})

test('upset bounty scoring adds deterministic underdog bonuses', () => {
  const entry = lockedEntry('user-upset', 'upset-bounty', {
    qf1: 'seed-12',
    qf2: 'seed-1'
  })
  const snapshot = feed.createResultSnapshot({
    competitionId: 'cup-upsets',
    results: {
      qf1: { winnerEntrantId: 'seed-12', underdogEntrantId: 'seed-12', upsetBonus: 5, roundNumber: 1 },
      qf2: { winnerEntrantId: 'seed-1', underdogEntrantId: 'seed-16', upsetBonus: 8, roundNumber: 1 }
    }
  })

  const row = scoring.scoreUpsetBountyBracket({ entry, resultSnapshot: snapshot })

  assert.equal(row.score, 7)
  assert.equal(row.upsetHits, 1)
  assert.equal(row.detail[0].points, 6)
})

test('head-to-head duel returns the winning user from shared results', () => {
  const left = lockedEntry('left-user', 'classic-bracket', { final: 'alpha' })
  const right = lockedEntry('right-user', 'classic-bracket', { final: 'beta' })
  const snapshot = feed.createResultSnapshot({
    competitionId: 'duel-1',
    results: {
      final: { winnerEntrantId: 'alpha', roundNumber: 3 }
    }
  })

  const duel = scoring.scoreHeadToHeadDuel({ leftEntry: left, rightEntry: right, resultSnapshot: snapshot })

  assert.deepEqual(duel.winnerUserIds, ['left-user'])
  assert.equal(duel.tied, false)
  assert.equal(duel.rows[0].userId, 'left-user')
})

test('head-to-head duel pools resolve only the challenged player pair', () => {
  const duelPool = pool.createPool({
    poolId: 'pool-duel',
    competitionId: 'duel-competition',
    variant: 'head-to-head-duel',
    metadata: {
      challengeId: 'duel-challenge',
      challengerUserId: 'alice',
      targetUserId: 'bob',
      participantUserIds: ['alice', 'bob']
    }
  })
  const snapshot = feed.createResultSnapshot({
    competitionId: 'duel-competition',
    results: {
      semi1: { winnerEntrantId: 'red', roundNumber: 1 },
      semi2: { winnerEntrantId: 'gold', roundNumber: 1 },
      final: { winnerEntrantId: 'red', roundNumber: 2 }
    }
  })
  const alice = lockedEntry('alice', 'head-to-head-duel', { semi1: 'red', semi2: 'gold', final: 'red' })
  const bob = lockedEntry('bob', 'head-to-head-duel', { semi1: 'blue', semi2: 'gold', final: 'gold' })
  const spectator = lockedEntry('spectator', 'head-to-head-duel', { semi1: 'red', semi2: 'gold', final: 'red' })
  const resolved = pool.resolvePoolWinners({
    pool: duelPool,
    entries: [spectator, bob, alice],
    resultSnapshot: snapshot
  })

  assert.equal(resolved.variant, 'head-to-head-duel')
  assert.equal(resolved.ready, true)
  assert.deepEqual(resolved.participantUserIds, ['alice', 'bob'])
  assert.deepEqual(resolved.winnerUserIds, ['alice'])
  assert.deepEqual(resolved.leaderboard.map(row => row.userId), ['alice', 'bob'])
  assert.equal(resolved.leaderboard[0].score, 4)
  assert.equal(resolved.leaderboard[1].score, 1)
})

test('side quest pools rank users by selected semi-finalist scoring totals', () => {
  const rules = prediction.createPoolRules({
    variant: 'side-quest',
    config: {
      condition: 'my-semi-finalists-score-more',
      targetRoundNames: ['semi-final']
    }
  })
  const sideQuestPool = pool.createPool({
    poolId: 'pool-side-quest',
    competitionId: 'cup-side-quest',
    title: 'Semi-final scorers',
    rules,
    metadata: {
      sideQuest: {
        condition: 'my-semi-finalists-score-more'
      }
    }
  })
  const snapshot = feed.createResultSnapshot({
    competitionId: 'cup-side-quest',
    results: {
      semi1: {
        roundName: 'Semi-final',
        homeEntrantId: 'red',
        awayEntrantId: 'blue',
        homeScore: 2,
        awayScore: 1
      },
      semi2: {
        roundName: 'Semi-final',
        homeEntrantId: 'gold',
        awayEntrantId: 'green',
        homeScore: 0,
        awayScore: 3
      },
      final: {
        roundName: 'Final',
        homeEntrantId: 'red',
        awayEntrantId: 'green',
        homeScore: 1,
        awayScore: 0
      }
    }
  })
  const alice = lockedEntry('alice', 'side-quest', { semiFinalistIds: ['red', 'gold'] })
  const bob = lockedEntry('bob', 'side-quest', {
    semi1: { entrantId: 'blue' },
    semi2: { entrantId: 'green' }
  })
  const aliceRow = scoring.scoreSideQuestEntry({
    entry: alice,
    resultSnapshot: snapshot,
    config: rules.config
  })
  const resolved = pool.resolvePoolWinners({
    pool: sideQuestPool,
    entries: [alice, bob],
    resultSnapshot: snapshot
  })

  assert.deepEqual(aliceRow.selectedEntrantIds, ['red', 'gold'])
  assert.equal(aliceRow.score, 2)
  assert.equal(aliceRow.detail.length, 4)
  assert.deepEqual(resolved.winnerUserIds, ['bob'])
  assert.equal(resolved.leaderboard[0].score, 4)
  assert.equal(resolved.leaderboard[0].variant, 'side-quest')
})

test('live prediction markets lock submissions and resolve room winners', () => {
  const market = livePrediction.createPredictionMarket({
    roomId: 'room-final',
    competitionId: 'cup-live',
    fixtureId: 'final',
    marketType: 'next-event',
    locksAt: '2026-07-03T18:10:00.000Z',
    options: ['goal', 'corner', 'card', 'shot']
  })

  const locked = livePrediction.lockPredictionMarket(market, '2026-07-03T18:10:00.000Z')
  const predictions = [
    livePrediction.submitWatchPrediction({
      market,
      userId: 'user-goal',
      outcome: 'goal',
      submittedAt: '2026-07-03T18:09:00.000Z'
    }),
    livePrediction.submitWatchPrediction({
      market,
      userId: 'user-card',
      outcome: 'card',
      submittedAt: '2026-07-03T18:09:30.000Z'
    })
  ]

  assert.throws(() => livePrediction.submitWatchPrediction({
    market: locked,
    userId: 'late-user',
    outcome: 'goal',
    submittedAt: '2026-07-03T18:11:00.000Z'
  }), /status locked/)

  const resolved = livePrediction.resolvePredictionMarket({
    market: locked,
    predictions,
    result: 'goal',
    resolvedAt: '2026-07-03T18:12:00.000Z'
  })

  assert.equal(resolved.market.status, 'resolved')
  assert.deepEqual(resolved.winnerUserIds, ['user-goal'])
  assert.equal(resolved.rows[1].score, 0)
})

test('scoreline lock rewards exact final scores ahead of result-class picks', () => {
  const market = livePrediction.lockPredictionMarket(livePrediction.createPredictionMarket({
    roomId: 'room-scoreline',
    competitionId: 'cup-live',
    fixtureId: 'final',
    marketType: 'scoreline-lock'
  }))
  const resolved = livePrediction.resolvePredictionMarket({
    market,
    predictions: [
      livePrediction.submitWatchPrediction({
        market: { ...market, status: 'open' },
        userId: 'exact',
        outcome: { homeScore: 2, awayScore: 1, lockBeforeMinute: 60 }
      }),
      livePrediction.submitWatchPrediction({
        market: { ...market, status: 'open' },
        userId: 'result-class',
        outcome: { homeScore: 1, awayScore: 0, lockBeforeMinute: 60 }
      }),
      livePrediction.submitWatchPrediction({
        market: { ...market, status: 'open' },
        userId: 'miss',
        outcome: { homeScore: 0, awayScore: 2, lockBeforeMinute: 60 }
      })
    ],
    result: { homeScore: 2, awayScore: 1 }
  })

  assert.equal(market.predictionShape, 'exact-scoreline')
  assert.deepEqual(market.inputTemplate, { homeScore: 0, awayScore: 0, lockBeforeMinute: 60 })
  assert.deepEqual(resolved.winnerUserIds, ['exact'])
  assert.equal(resolved.rows[0].score, 3)
  assert.equal(resolved.rows[0].exact, true)
  assert.equal(resolved.rows[1].score, 1)
  assert.equal(resolved.rows[1].resultClassHit, true)
  assert.equal(livePrediction.scorelineResultClass({ homeScore: 1, awayScore: 1 }), 'draw')
})

test('player prop markets score first scorer and stat totals', () => {
  const market = livePrediction.lockPredictionMarket(livePrediction.createPredictionMarket({
    roomId: 'room-props',
    competitionId: 'cup-live',
    fixtureId: 'final',
    marketType: 'player-prop'
  }))
  const openMarket = { ...market, status: 'open' }
  const resolved = livePrediction.resolvePredictionMarket({
    market,
    predictions: [
      livePrediction.submitWatchPrediction({
        market: openMarket,
        userId: 'first-scorer',
        outcome: { playerId: 'p9', prop: 'first-scorer' }
      }),
      livePrediction.submitWatchPrediction({
        market: openMarket,
        userId: 'shots-near',
        outcome: { playerId: 'p10', prop: 'shots', value: 4 }
      }),
      livePrediction.submitWatchPrediction({
        market: openMarket,
        userId: 'miss',
        outcome: { playerId: 'p11', prop: 'cards', value: 1 }
      })
    ],
    result: {
      firstScorerId: 'p9',
      players: {
        p10: { shots: 5, assists: 1, cards: 0 },
        p11: { cards: 0 }
      }
    }
  })

  assert.equal(market.predictionShape, 'player-prop')
  assert.deepEqual(market.inputTemplate, { playerId: null, prop: 'first-scorer', value: true })
  assert.deepEqual(market.options, ['first-scorer', 'shots', 'assists', 'cards'])
  assert.deepEqual(livePrediction.marketOptionsFor('player-prop'), ['first-scorer', 'shots', 'assists', 'cards'])
  assert.deepEqual(resolved.winnerUserIds, ['first-scorer'])
  assert.equal(resolved.rows[0].score, 3)
  assert.equal(resolved.rows[0].prop, 'first-scorer')
  assert.equal(resolved.rows[1].score, 2)
  assert.equal(resolved.rows[1].prop, 'shots')
  assert.equal(resolved.rows[1].valueHit, true)
  assert.equal(resolved.rows[2].score, 0)
  assert.equal(livePrediction.normalizePlayerProp('assist'), 'assists')
})

test('momentum duel markets and watch-party streaks resolve deterministically', () => {
  const momentum = livePrediction.createPredictionMarket({
    roomId: 'room-momentum',
    competitionId: 'cup-live',
    marketType: 'momentum-duel',
    options: livePrediction.marketOptionsFor('momentum-duel')
  })
  const openMomentum = { ...momentum, status: 'open' }
  const momentumResolved = livePrediction.resolvePredictionMarket({
    market: livePrediction.lockPredictionMarket(momentum),
    predictions: [
      livePrediction.submitWatchPrediction({
        market: openMomentum,
        userId: 'home-fan',
        outcome: { side: 'home-pressure', windowMinutes: 10 }
      }),
      livePrediction.submitWatchPrediction({
        market: openMomentum,
        userId: 'away-fan',
        outcome: { side: 'away-pressure', windowMinutes: 10 }
      }),
      livePrediction.submitWatchPrediction({
        market: openMomentum,
        userId: 'balanced-fan',
        outcome: { side: 'balanced', windowMinutes: 10 }
      })
    ],
    result: {
      windowMinutes: 10,
      homePressure: 8,
      awayPressure: 5
    }
  })

  assert.equal(momentum.marketType, 'momentum-duel')
  assert.equal(momentum.predictionShape, 'momentum-window')
  assert.deepEqual(momentum.inputTemplate, { side: 'home-pressure', windowMinutes: 10 })
  assert.equal(momentum.scoringConfig.windowMinutes, 10)
  assert.equal(momentum.scoringConfig.balancedThreshold, 2)
  assert.deepEqual(momentum.options, ['home-pressure', 'away-pressure', 'balanced'])
  assert.deepEqual(momentumResolved.winnerUserIds, ['home-fan'])
  assert.equal(momentumResolved.rows[0].actualSide, 'home-pressure')
  assert.equal(momentumResolved.rows[0].pressureDelta, 3)
  assert.equal(livePrediction.actualForMomentumDuel({
    result: { pressure: { home: 4, away: 3 } },
    scoringConfig: { balancedThreshold: 2 }
  }).side, 'balanced')

  const marketA = livePrediction.lockPredictionMarket(livePrediction.createPredictionMarket({
    marketId: 'streak-a',
    roomId: 'room-streak',
    competitionId: 'cup-live'
  }))
  const marketB = livePrediction.lockPredictionMarket(livePrediction.createPredictionMarket({
    marketId: 'streak-b',
    roomId: 'room-streak',
    competitionId: 'cup-live'
  }))
  const marketC = livePrediction.lockPredictionMarket(livePrediction.createPredictionMarket({
    marketId: 'streak-c',
    roomId: 'room-streak',
    competitionId: 'cup-live'
  }))
  const resolutions = [
    livePrediction.resolvePredictionMarket({
      market: marketA,
      predictions: [
        { predictionId: 'a1', marketId: 'streak-a', userId: 'alice', outcome: 'goal' },
        { predictionId: 'a2', marketId: 'streak-a', userId: 'bob', outcome: 'card' }
      ],
      result: 'goal'
    }),
    livePrediction.resolvePredictionMarket({
      market: marketB,
      predictions: [
        { predictionId: 'b1', marketId: 'streak-b', userId: 'alice', outcome: 'card' },
        { predictionId: 'b2', marketId: 'streak-b', userId: 'bob', outcome: 'save' }
      ],
      result: 'save'
    }),
    livePrediction.resolvePredictionMarket({
      market: marketC,
      predictions: [
        { predictionId: 'c1', marketId: 'streak-c', userId: 'alice', outcome: 'corner' },
        { predictionId: 'c2', marketId: 'streak-c', userId: 'bob', outcome: 'shot' }
      ],
      result: 'shot'
    })
  ]
  const streak = livePrediction.resolveWatchPredictionStreak({
    roomId: 'room-streak',
    marketResolutions: resolutions
  })

  assert.deepEqual(streak.winnerUserIds, ['bob'])
  assert.equal(streak.rows[0].longestStreak, 2)
  assert.equal(streak.rows[1].longestStreak, 1)
  assert.equal(streak.rows[0].correctCount, 2)
  assert.equal(streak.tied, false)
})

test('runtime replays room watch-party streak resolution', () => {
  const app = platform.createUltimateSportsPlatform()
  ;['m1', 'm2', 'm3'].forEach(marketId => {
    app.dispatch({
      type: 'market:create',
      actorId: 'host',
      payload: {
        marketId,
        roomId: 'runtime-streak-room',
        competitionId: 'runtime-streak-comp',
        marketType: 'next-event'
      }
    })
  })

  const submissions = [
    ['m1', 'alice', 'goal'], ['m1', 'bob', 'card'],
    ['m2', 'alice', 'card'], ['m2', 'bob', 'save'],
    ['m3', 'alice', 'corner'], ['m3', 'bob', 'shot']
  ]
  submissions.forEach(([marketId, userId, outcome]) => {
    app.dispatch({
      type: 'market:predict',
      actorId: userId,
      payload: { marketId, outcome }
    })
  })
  ;[
    ['m1', 'goal'],
    ['m2', 'save'],
    ['m3', 'shot']
  ].forEach(([marketId, result]) => {
    app.dispatch({ type: 'market:lock', actorId: 'host', payload: { marketId } })
    app.dispatch({ type: 'market:resolve', actorId: 'host', payload: { marketId, result } })
  })

  const event = app.dispatch({
    type: 'market:resolveStreak',
    actorId: 'host',
    payload: {
      streakId: 'runtime-streak',
      roomId: 'runtime-streak-room',
      marketIds: ['m1', 'm2', 'm3']
    }
  })

  assert.deepEqual(event.payload.winnerUserIds, ['bob'])
  assert.equal(app.view().streakResolutions['runtime-streak'].winningStreak, 2)
})
