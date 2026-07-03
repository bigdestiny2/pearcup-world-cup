'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { game, miniGame, platform } = require('../src')

test('penalty clash resolves shots against opponent keeper reads', () => {
  const session = game.createPeerGameSession({
    gameId: 'penalty-game',
    gameType: 'penalty-clash',
    players: ['alice', 'bob'],
    stakeMode: 'demo'
  })
  const resolved = miniGame.resolveMiniGame({
    session,
    reveals: [
      {
        gameId: 'penalty-game',
        playerId: 'alice',
        input: {
          shots: [
            { shot: 'left', power: 80 },
            { shot: 'right', power: 85 },
            { shot: 'center', keeperRead: 'right', power: 75 }
          ]
        }
      },
      {
        gameId: 'penalty-game',
        playerId: 'bob',
        input: {
          shots: [
            { shot: 'left', keeperRead: 'left', power: 75 },
            { shot: 'right', keeperRead: 'left', power: 20 },
            { shot: 'right', keeperRead: 'right', power: 90 }
          ]
        }
      }
    ],
    result: { roundCount: 3 }
  })

  assert.deepEqual(resolved.winnerUserIds, ['alice'])
  assert.equal(resolved.rows[0].userId, 'alice')
  assert.equal(resolved.rows[0].score, 2)
  assert.equal(resolved.rows[1].score, 1)
  assert.equal(typeof resolved.resultHash, 'string')
})

test('free-kick duel resolves aim, curve, wall reads, and keeper reads', () => {
  const session = game.createPeerGameSession({
    gameId: 'free-kick-game',
    gameType: 'free-kick-duel',
    players: ['alice', 'bob'],
    stakeMode: 'demo'
  })
  const resolved = miniGame.resolveMiniGame({
    session,
    reveals: [
      {
        gameId: 'free-kick-game',
        playerId: 'alice',
        input: {
          attempts: [
            { aim: 'top-left', curve: 9, power: 82, keeperRead: 'top-right' },
            { aim: 'near-post', curve: 4, power: 76, wallRead: 'near-post' },
            { aim: 'wide', curve: 6, power: 70, keeperRead: 'center' }
          ]
        }
      },
      {
        gameId: 'free-kick-game',
        playerId: 'bob',
        input: {
          attempts: [
            { aim: 'top-right', curve: 1, power: 84, keeperRead: 'top-left' },
            { aim: 'near-post', curve: 2, power: 72, wallRead: 'near-post' },
            { aim: 'center', curve: 0, power: 80, keeperRead: 'center' }
          ]
        }
      }
    ],
    result: { attemptCount: 3 }
  })

  assert.deepEqual(resolved.winnerUserIds, ['alice'])
  assert.equal(resolved.rows[0].userId, 'alice')
  assert.equal(resolved.rows[0].score, 6)
  assert.equal(resolved.rows[0].detail[0].goal, true)
  assert.equal(resolved.rows[0].detail[1].points, 3)
  assert.equal(resolved.rows[0].detail[2].points, 0)
  assert.equal(resolved.rows[1].detail[1].wallRead, 'near-post')
  assert.equal(resolved.rows[1].detail[1].goal, false)
})

test('trivia duel uses correctness first and response time as tie break', () => {
  const session = game.createPeerGameSession({
    gameId: 'trivia-game',
    gameType: 'trivia-duel',
    players: ['alice', 'bob'],
    stakeMode: 'demo'
  })
  const resolved = miniGame.resolveMiniGame({
    session,
    reveals: [
      {
        gameId: 'trivia-game',
        playerId: 'alice',
        input: {
          answers: {
            q1: { answer: 'Brazil', responseMs: 900 },
            q2: { answer: 'Marta', responseMs: 1200 }
          }
        }
      },
      {
        gameId: 'trivia-game',
        playerId: 'bob',
        input: {
          answers: {
            q1: { answer: 'brazil', responseMs: 700 },
            q2: { answer: 'Marta', responseMs: 800 }
          }
        }
      }
    ],
    result: {
      correctAnswers: {
        q1: 'Brazil',
        q2: 'Marta'
      }
    }
  })

  assert.deepEqual(resolved.winnerUserIds, ['bob'])
  assert.equal(resolved.tied, false)
  assert.equal(resolved.rows[0].tieBreak, 1500)
  assert.equal(resolved.rows[1].tieBreak, 2100)
})

test('reaction challenge awards each moment to the fastest valid tap', () => {
  const session = game.createPeerGameSession({
    gameId: 'reaction-game',
    gameType: 'reaction-challenge',
    players: ['alice', 'bob'],
    stakeMode: 'none'
  })
  const resolved = miniGame.resolveMiniGame({
    session,
    reveals: [
      {
        gameId: 'reaction-game',
        playerId: 'alice',
        input: {
          taps: [
            { momentId: 'goal', reactionMs: 240 },
            { momentId: 'save', reactionMs: 300 }
          ]
        }
      },
      {
        gameId: 'reaction-game',
        playerId: 'bob',
        input: {
          taps: [
            { momentId: 'goal', reactionMs: 180 },
            { momentId: 'save', reactionMs: 420 }
          ]
        }
      }
    ],
    result: {
      moments: ['goal', 'save']
    }
  })

  assert.deepEqual(resolved.winnerUserIds, ['alice'])
  assert.equal(resolved.rows[0].score, 1)
  assert.equal(resolved.rows[0].tieBreak, 540)
})

test('runtime replays game resolution after commit and reveal evidence', () => {
  const app = platform.createUltimateSportsPlatform()
  const sessionEvent = app.dispatch({
    type: 'game:create',
    actorId: 'host',
    occurredAt: '2026-07-03T22:00:00.000Z',
    payload: {
      gameId: 'runtime-trivia',
      gameType: 'trivia-duel',
      players: ['alice', 'bob'],
      stakeMode: 'demo'
    }
  })
  app.dispatch({
    type: 'game:start',
    actorId: 'host',
    occurredAt: '2026-07-03T22:01:00.000Z',
    payload: { gameId: sessionEvent.payload.gameId }
  })

  const aliceInput = {
    answers: {
      q1: { answer: 'left', responseMs: 500 },
      q2: { answer: 'blue', responseMs: 900 }
    }
  }
  const bobInput = {
    answers: {
      q1: { answer: 'right', responseMs: 300 },
      q2: { answer: 'blue', responseMs: 700 }
    }
  }
  app.dispatch({
    type: 'game:commit',
    actorId: 'alice',
    payload: {
      gameId: 'runtime-trivia',
      roundId: 'main',
      playerId: 'alice',
      input: aliceInput,
      nonce: 'alice-nonce'
    }
  })
  app.dispatch({
    type: 'game:commit',
    actorId: 'bob',
    payload: {
      gameId: 'runtime-trivia',
      roundId: 'main',
      playerId: 'bob',
      input: bobInput,
      nonce: 'bob-nonce'
    }
  })
  app.dispatch({
    type: 'game:reveal',
    actorId: 'alice',
    payload: {
      gameId: 'runtime-trivia',
      roundId: 'main',
      playerId: 'alice',
      input: aliceInput,
      nonce: 'alice-nonce'
    }
  })
  app.dispatch({
    type: 'game:reveal',
    actorId: 'bob',
    payload: {
      gameId: 'runtime-trivia',
      roundId: 'main',
      playerId: 'bob',
      input: bobInput,
      nonce: 'bob-nonce'
    }
  })
  const resolved = app.dispatch({
    type: 'game:resolve',
    actorId: 'host',
    occurredAt: '2026-07-03T22:02:00.000Z',
    payload: {
      gameId: 'runtime-trivia',
      result: {
        correctAnswers: {
          q1: 'left',
          q2: 'blue'
        }
      }
    }
  })

  assert.deepEqual(resolved.payload.winnerUserIds, ['alice'])
  assert.equal(app.view().gameResolutions['runtime-trivia'].resultId, resolved.payload.resultId)
  assert.equal(app.view().gameSessions['runtime-trivia'].status, 'resolved')
})
