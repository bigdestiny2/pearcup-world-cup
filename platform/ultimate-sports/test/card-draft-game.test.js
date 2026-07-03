'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { card, draft, game, platform } = require('../src')

test('prediction cards validate and score group-stage and awards style answers', () => {
  const pickCard = card.createPredictionCard({
    competitionId: 'group-a',
    cardType: 'group-stage-card',
    title: 'Group A Picks',
    fields: [
      { fieldId: 'top-two', fieldType: 'ordered-choice', label: 'Top two', weight: 4 },
      { fieldId: 'goals', fieldType: 'numeric-total', label: 'Group goals', weight: 2, tolerance: 1 },
      { fieldId: 'golden-boot', fieldType: 'single-choice', label: 'Golden boot', options: ['a', 'b'], weight: 3 }
    ]
  })

  const submission = card.createCardSubmission({
    card: pickCard,
    userId: 'user-card',
    answers: {
      'top-two': ['a', 'b'],
      goals: 11,
      'golden-boot': 'a'
    }
  })

  const row = card.scorePredictionCard({
    card: pickCard,
    submission,
    results: {
      'top-two': ['a', 'b'],
      goals: 10,
      'golden-boot': 'b'
    }
  })

  assert.equal(row.score, 6)
  assert.equal(row.possibleScore, 9)
  assert.equal(row.correctCount, 2)

  const winner = card.createCardSubmission({
    card: pickCard,
    userId: 'perfect-card',
    answers: {
      'top-two': ['a', 'b'],
      goals: 10,
      'golden-boot': 'b'
    }
  })
  const resolution = card.resolvePredictionCard({
    card: pickCard,
    submissions: [submission, winner],
    results: {
      'top-two': ['a', 'b'],
      goals: 10,
      'golden-boot': 'b'
    }
  })
  assert.deepEqual(resolution.winnerUserIds, ['perfect-card'])
  assert.equal(resolution.rows[0].score, 9)
  assert.equal(typeof resolution.resultHash, 'string')
})

test('fantasy-lite draft scores small rosters from athlete stats', () => {
  const slate = draft.createDraftSlate({
    competitionId: 'matchday-1',
    rosterSize: 3,
    athletes: [
      { athleteId: 'p1', name: 'Player One' },
      { athleteId: 'p2', name: 'Player Two' },
      { athleteId: 'p3', name: 'Player Three' }
    ],
    scoringRules: {
      goals: 5,
      assists: 3,
      saves: 1
    }
  })
  const entry = draft.createDraftEntry({
    slate,
    userId: 'drafter',
    athleteIds: ['p1', 'p2', 'p3']
  })

  const row = draft.scoreDraftEntry({
    slate,
    entry,
    athleteStats: {
      p1: { goals: 1, assists: 1 },
      p2: { saves: 4 },
      p3: { goals: 0, assists: 2 }
    }
  })

  assert.equal(row.score, 18)
  const rival = draft.createDraftEntry({
    slate,
    userId: 'rival',
    athleteIds: ['p2', 'p3']
  })
  const resolution = draft.resolveDraftSlate({
    slate,
    entries: [entry, rival],
    athleteStats: {
      p1: { goals: 1, assists: 1 },
      p2: { saves: 4 },
      p3: { goals: 0, assists: 2 }
    }
  })
  assert.deepEqual(resolution.winnerUserIds, ['drafter'])
  assert.equal(resolution.winningScore, 18)
  assert.throws(() => draft.createDraftEntry({
    slate,
    userId: 'bad-drafter',
    athleteIds: ['p1', 'p1']
  }), /cannot repeat/)
})

test('runtime replays prediction card and draft entry lifecycles', () => {
  const app = platform.createUltimateSportsPlatform()
  app.dispatch({
    type: 'card:create',
    actorId: 'host',
    occurredAt: '2026-07-04T00:00:00.000Z',
    payload: {
      cardId: 'runtime-card',
      competitionId: 'runtime-comp',
      cardType: 'watch-party-bingo',
      fields: [
        { fieldId: 'goal', fieldType: 'bingo-cell', label: 'Goal', options: ['yes', 'no'] },
        { fieldId: 'var', fieldType: 'bingo-cell', label: 'VAR', options: ['yes', 'no'] }
      ]
    }
  })
  app.dispatch({
    type: 'card:submit',
    actorId: 'alice',
    occurredAt: '2026-07-04T00:01:00.000Z',
    payload: {
      cardId: 'runtime-card',
      answers: {
        goal: 'yes',
        var: 'no'
      }
    }
  })
  app.dispatch({
    type: 'card:submit',
    actorId: 'bob',
    occurredAt: '2026-07-04T00:01:30.000Z',
    payload: {
      cardId: 'runtime-card',
      answers: {
        goal: 'yes',
        var: 'yes'
      }
    }
  })
  const cardResolved = app.dispatch({
    type: 'card:resolve',
    actorId: 'host',
    occurredAt: '2026-07-04T00:02:00.000Z',
    payload: {
      cardId: 'runtime-card',
      results: {
        goal: 'yes',
        var: 'yes'
      }
    }
  })

  app.dispatch({
    type: 'draft:create',
    actorId: 'host',
    occurredAt: '2026-07-04T00:03:00.000Z',
    payload: {
      slateId: 'runtime-draft',
      competitionId: 'runtime-comp',
      rosterSize: 2,
      athletes: [
        { athleteId: 'p1', name: 'Player One' },
        { athleteId: 'p2', name: 'Player Two' },
        { athleteId: 'p3', name: 'Player Three' }
      ],
      scoringRules: {
        goals: 5,
        assists: 3
      }
    }
  })
  app.dispatch({
    type: 'draft:submit',
    actorId: 'alice',
    payload: {
      slateId: 'runtime-draft',
      athleteIds: ['p1', 'p2']
    }
  })
  app.dispatch({
    type: 'draft:submit',
    actorId: 'bob',
    payload: {
      slateId: 'runtime-draft',
      athleteIds: ['p2', 'p3']
    }
  })
  const draftResolved = app.dispatch({
    type: 'draft:resolve',
    actorId: 'host',
    payload: {
      slateId: 'runtime-draft',
      athleteStats: {
        p1: { goals: 1 },
        p2: { assists: 1 },
        p3: { goals: 1 }
      }
    }
  })

  const view = app.view()
  assert.deepEqual(cardResolved.payload.winnerUserIds, ['bob'])
  assert.equal(Object.keys(view.cardSubmissions).length, 2)
  assert.equal(view.cardResolutions['runtime-card'].winningScore, 2)
  assert.deepEqual(draftResolved.payload.winnerUserIds, ['alice', 'bob'])
  assert.equal(Object.keys(view.draftEntries).length, 2)
  assert.equal(view.draftResolutions['runtime-draft'].tied, true)
})

test('generic P2P game commitments verify reveals and detect state hash disagreement', () => {
  const session = game.startPeerGameSession(game.createPeerGameSession({
    gameType: 'free-kick-duel',
    roomId: 'room-1',
    players: ['user-a', 'user-b'],
    stakeMode: 'demo'
  }))

  const commitment = game.createGameCommitment({
    gameId: session.gameId,
    roundId: 'round-1',
    playerId: 'user-a',
    input: { aim: 'top-left', curve: 2, power: 80 },
    nonce: 'nonce-a'
  })
  const reveal = game.revealGameInput({
    commitment,
    input: { aim: 'top-left', curve: 2, power: 80 },
    nonce: 'nonce-a'
  })

  assert.equal(game.verifyGameCommitment({ commitment, reveal }), true)
  assert.equal(game.verifyGameCommitment({
    commitment,
    reveal: { ...reveal, input: { aim: 'center', curve: 0, power: 20 } }
  }), false)

  const consensus = game.comparePeerStateHashes([
    { userId: 'user-a', stateHash: 'abc' },
    { userId: 'user-b', stateHash: 'abc' }
  ])
  const disputed = game.comparePeerStateHashes([
    { userId: 'user-a', stateHash: 'abc' },
    { userId: 'user-b', stateHash: 'def' }
  ])

  assert.equal(consensus.ok, true)
  assert.equal(disputed.ok, false)
  assert.deepEqual(disputed.mismatchedUserIds, ['user-b'])
})
