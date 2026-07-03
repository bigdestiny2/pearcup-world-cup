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

test('momentum duel markets and watch-party streaks resolve deterministically', () => {
  const momentum = livePrediction.createPredictionMarket({
    roomId: 'room-momentum',
    competitionId: 'cup-live',
    marketType: 'momentum-duel',
    options: livePrediction.marketOptionsFor('momentum-duel')
  })
  assert.equal(momentum.marketType, 'momentum-duel')
  assert.deepEqual(momentum.options, ['home-pressure', 'away-pressure', 'balanced'])

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
