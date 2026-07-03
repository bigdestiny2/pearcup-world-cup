'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { feed, prediction, scoring, settlement } = require('../src')

test('classic bracket entries score deterministically from a result snapshot', () => {
  const entry = prediction.lockPredictionEntry(prediction.submitPredictionEntry(prediction.createPredictionEntry({
    poolId: 'pool-1',
    userId: 'user-1',
    entryType: 'bracket',
    picks: {
      'fixture-1': 'alpha',
      'fixture-2': 'delta',
      'fixture-3': 'alpha'
    }
  }), '2026-07-02T10:00:00.000Z'), '2026-07-02T10:05:00.000Z')

  const snapshot = feed.createResultSnapshot({
    competitionId: 'competition-1',
    recordedAt: '2026-07-02T12:00:00.000Z',
    results: {
      'fixture-1': { winnerEntrantId: 'alpha', roundNumber: 1 },
      'fixture-2': { winnerEntrantId: 'bravo', roundNumber: 1 },
      'fixture-3': { winnerEntrantId: 'alpha', roundNumber: 2 }
    }
  })

  const row = scoring.scoreClassicBracket({ entry, resultSnapshot: snapshot })

  assert.equal(entry.status, 'locked')
  assert.equal(row.score, 3)
  assert.equal(row.possibleScore, 4)
  assert.equal(row.correctCount, 2)
  assert.equal(row.perfect, false)
})

test('confidence validation and scoring catch duplicate confidence values', () => {
  const picks = [
    { pickId: 'best-picture', outcome: 'nominee-a', confidence: 2 },
    { pickId: 'best-song', outcome: 'song-b', confidence: 2 }
  ]

  const validation = prediction.validateConfidencePicks(picks)
  assert.equal(validation.ok, false)
  assert.match(validation.errors[0], /used more than once/)

  const row = scoring.scoreConfidenceCard({
    entry: prediction.createPredictionEntry({
      poolId: 'pool-2',
      userId: 'user-2',
      entryType: 'card',
      picks
    }),
    resultSnapshot: feed.createResultSnapshot({
      competitionId: 'awards-1',
      cardResults: {
        'best-picture': 'nominee-a',
        'best-song': 'song-c'
      }
    })
  })

  assert.equal(row.score, 2)
  assert.equal(row.possibleScore, 4)
})

test('real-money settlement mode stays gated while demo mode is ready', () => {
  assert.equal(settlement.evaluateSettlementReadiness({ mode: 'demo' }).ready, true)

  const realMoney = settlement.evaluateSettlementReadiness({
    mode: 'real-money',
    gates: {
      qvacReady: true,
      wdkReady: true
    }
  })

  assert.equal(realMoney.ready, false)
  assert.ok(realMoney.missingGates.includes('kycVerified'))
  assert.ok(realMoney.missingGates.includes('officialResultSourceReady'))
})

