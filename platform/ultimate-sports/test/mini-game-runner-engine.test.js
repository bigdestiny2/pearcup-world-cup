'use strict'

const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  catalog,
  draft,
  livePrediction,
  miniGameSpec,
  miniGameRunner,
  platform
} = require('../src')

const refereeDocPath = path.join(__dirname, '..', 'docs', 'mini-game-runner-referee.md')
const refereeDoc = fs.readFileSync(refereeDocPath, 'utf8')

test('runner creates and resolves deterministic peer games without QVAC by default', () => {
  const plan = miniGameRunner.createMiniGameRunPlan({
    fitId: 'world-cup',
    gameType: 'penalty-clash',
    roomId: 'runner-room',
    competitionId: 'runner-cup',
    players: ['alice', 'bob']
  })

  assert.equal(plan.artifactType, 'session')
  assert.equal(plan.setupCommand.type, 'game:create')
  assert.equal(plan.artifact.gameType, 'penalty-clash')
  assert.equal(plan.qvacNeeded, false)
  assert.equal(plan.refereePlan.required, false)

  const run = miniGameRunner.resolveMiniGameRun({
    plan,
    result: { roundCount: 3 },
    reveals: [
      {
        playerId: 'alice',
        input: {
          shots: [
            { shot: 'left', keeperRead: 'left', power: 80 },
            { shot: 'right', keeperRead: 'right', power: 82 },
            { shot: 'center', keeperRead: 'center', power: 78 }
          ]
        }
      },
      {
        playerId: 'bob',
        input: {
          shots: [
            { shot: 'left', keeperRead: 'right', power: 80 },
            { shot: 'right', keeperRead: 'left', power: 80 },
            { shot: 'miss', keeperRead: 'right', power: 80 }
          ]
        }
      }
    ],
    resolvedAt: '2026-07-04T12:00:00.000Z'
  })

  assert.equal(run.resultKind, 'game-resolution')
  assert.deepEqual(run.resolution.winnerUserIds, ['alice'])
  assert.equal(run.resolution.rows[0].score, 3)
  assert.equal(run.refereePacket, null)
})

test('trivia duel resolution creates verified QVAC referee and trivia-bank records', () => {
  const plan = miniGameRunner.createMiniGameRunPlan({
    fitId: 'awards-prediction-pools',
    gameType: 'trivia-duel',
    roomId: 'awards-room',
    competitionId: 'awards-night',
    players: ['alice', 'bob'],
    settlementMode: 'sponsor-prize'
  })
  const evidenceEvents = [
    { eventId: 'event:qbank', type: 'qvac:source-facts', payload: { factIds: ['fact:q1', 'fact:q2'] } },
    { eventId: 'event:answers', type: 'game:answer-key', payload: { questionIds: ['q1', 'q2'] } }
  ]

  const run = miniGameRunner.resolveMiniGameRun({
    plan,
    result: {
      questionIds: ['q1', 'q2'],
      correctAnswers: {
        q1: 'Moonlight Sonata',
        q2: 'Best Picture'
      }
    },
    reveals: [
      {
        playerId: 'alice',
        input: {
          answers: {
            q1: { answer: 'Moonlight Sonata', responseMs: 800 },
            q2: { answer: 'Best Picture', responseMs: 950 }
          }
        }
      },
      {
        playerId: 'bob',
        input: {
          answers: {
            q1: { answer: 'Moonlight Sonata', responseMs: 900 },
            q2: { answer: 'Song of the Year', responseMs: 700 }
          }
        }
      }
    ],
    evidenceEvents,
    qvacInput: {
      verified: true,
      sourceFacts: [
        { factId: 'fact:q1', prompt: 'Which performance opened?', answer: 'Moonlight Sonata' },
        { factId: 'fact:q2', prompt: 'Which category closed?', answer: 'Best Picture' }
      ],
      questions: [
        {
          questionId: 'q1',
          prompt: 'Which performance opened?',
          answer: 'Moonlight Sonata',
          sourceFactId: 'fact:q1'
        },
        {
          questionId: 'q2',
          prompt: 'Which category closed?',
          answer: 'Best Picture',
          sourceFactId: 'fact:q2'
        }
      ]
    },
    resolvedAt: '2026-07-04T12:05:00.000Z'
  })

  assert.deepEqual(run.resolution.winnerUserIds, ['alice'])
  assert.equal(run.refereePacket.attestation.lane, 'game-fairness')
  assert.equal(run.refereePacket.attestation.status, 'verified')
  assert.equal(run.refereePacket.gate.ok, true)
  assert.equal(run.refereePacket.questionBank.status, 'ready')
  assert.equal(run.refereePacket.qvacGate.ok, true)
  assert.equal(run.refereePacket.reasonCodes.includes('question-bank-answer-key'), true)
  assert.equal(run.refereePacket.reasonCodes.includes('prize-mode-settlement'), true)
})

test('host-entered live markets require QVAC referee evidence before settlement', () => {
  const plan = miniGameRunner.createMiniGameRunPlan({
    fitId: 'local-leagues',
    gameType: 'next-event',
    roomId: 'pub-room',
    competitionId: 'pub-league',
    userIds: ['alice', 'bob']
  })
  const predictions = [
    livePrediction.submitWatchPrediction({
      market: plan.artifact,
      userId: 'alice',
      outcome: 'next-score',
      submittedAt: '2026-07-04T12:10:00.000Z'
    }),
    livePrediction.submitWatchPrediction({
      market: plan.artifact,
      userId: 'bob',
      outcome: 'manual-stat',
      submittedAt: '2026-07-04T12:10:01.000Z'
    })
  ]

  const run = miniGameRunner.resolveMiniGameRun({
    plan,
    predictions,
    result: 'next-score',
    evidenceEvents: [
      { eventId: 'event:host-score', type: 'host:result-entry', payload: { result: 'next-score' } }
    ],
    resolvedAt: '2026-07-04T12:20:00.000Z'
  })

  assert.equal(plan.artifactType, 'market')
  assert.equal(plan.qvacNeeded, true)
  assert.equal(plan.refereePlan.reasonCodes.includes('non-official-result-source'), true)
  assert.deepEqual(run.resolution.winnerUserIds, ['alice'])
  assert.equal(run.refereePacket.attestation.status, 'verified')
  assert.equal(run.refereePacket.attestation.assertions.resultKind, 'market-resolution')
})

test('peer mini fantasy creates draft slates and QVAC-reviewed resolutions', () => {
  const plan = miniGameRunner.createMiniGameRunPlan({
    fitId: 'march-madness',
    gameType: 'peer-mini-fantasy',
    competitionId: 'madness-slate',
    userIds: ['alice', 'bob']
  })
  const athleteIds = plan.artifact.athletes.map(athlete => athlete.athleteId)
  const entries = [
    draft.createDraftEntry({
      slate: plan.artifact,
      userId: 'alice',
      athleteIds: athleteIds.slice(0, 3)
    }),
    draft.createDraftEntry({
      slate: plan.artifact,
      userId: 'bob',
      athleteIds: athleteIds.slice(2, 5)
    })
  ]
  const athleteStats = {
    [athleteIds[0]]: { points: 18, rebounds: 4, assists: 3 },
    [athleteIds[1]]: { points: 20, rebounds: 8, assists: 2 },
    [athleteIds[2]]: { points: 10, rebounds: 4, assists: 2 },
    [athleteIds[3]]: { points: 8, rebounds: 2, assists: 1 },
    [athleteIds[4]]: { points: 7, rebounds: 2, assists: 1 }
  }

  const run = miniGameRunner.resolveMiniGameRun({
    plan,
    entries,
    athleteStats,
    evidenceEvents: [
      { eventId: 'event:box-score', type: 'feed:athlete-stats', payload: { athleteIds } }
    ],
    resolvedAt: '2026-07-04T12:30:00.000Z'
  })

  assert.equal(plan.artifactType, 'draft-slate')
  assert.equal(plan.setupCommand.type, 'draft:create')
  assert.equal(plan.qvacNeeded, true)
  assert.equal(run.resultKind, 'draft-resolution')
  assert.deepEqual(run.resolution.winnerUserIds, ['alice'])
  assert.equal(run.refereePacket.attestation.status, 'verified')
  assert.equal(run.refereePacket.reasonCodes.includes('athlete-stat-verification'), true)
})

test('run matrix builds executable artifacts for every mini-game spec', () => {
  const specMatrix = miniGameSpec.createMiniGameBuildMatrix()
  const runMatrix = miniGameRunner.createMiniGameRunMatrix()
  const plans = runMatrix.suites.flatMap(suite => suite.plans)

  assert.equal(runMatrix.fitIds.length, catalog.listEventFits().length)
  assert.equal(runMatrix.totalPlans, specMatrix.totalSpecs)
  assert.equal(plans.length, specMatrix.totalSpecs)
  plans.forEach(plan => {
    assert.equal(plan.runVersion, miniGameRunner.RUN_VERSION)
    assert.equal(typeof plan.qvacNeeded, 'boolean')
    assert.ok(plan.setupCommand.type.endsWith(':create'))
    assert.ok(plan.artifact.gameId || plan.artifact.marketId || plan.artifact.slateId)
    assert.equal(plan.refereePlan.lane, 'game-fairness')
  })
})

test('platform facade exposes executable run and QVAC referee helpers', () => {
  const app = platform.createUltimateSportsPlatform()
  const plan = app.createMiniGameRunPlan({
    fitId: 'tennis-grand-slams',
    gameType: 'scoreline-lock',
    roomId: 'tennis-room',
    competitionId: 'tennis-slam'
  })
  const predictions = [
    livePrediction.submitWatchPrediction({
      market: plan.artifact,
      userId: 'alice',
      outcome: { homeScore: 6, awayScore: 4 }
    })
  ]
  const run = app.resolveMiniGameRun({
    plan,
    predictions,
    result: { homeScore: 6, awayScore: 4 }
  })
  const matrix = app.createMiniGameRunMatrix()

  assert.equal(plan.setupCommand.type, 'market:create')
  assert.deepEqual(run.resolution.winnerUserIds, ['alice'])
  assert.equal(run.refereePacket, null)
  assert.equal(matrix.fitIds.includes('tennis-grand-slams'), true)
  assert.equal(typeof app.createQvacMiniGameReferee, 'function')
})

test('runner referee docs name the public facade and QVAC policy', () => {
  ;[
    'createMiniGameRunPlan',
    'resolveMiniGameRun',
    'createQvacMiniGameReferee',
    'createMiniGameRunMatrix',
    'game-fairness',
    'host-entered',
    'trivia-duel',
    'peer-mini-fantasy'
  ].forEach(term => {
    assert.equal(refereeDoc.includes(term), true, `${term} missing from runner docs`)
  })
})
