'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { createPlatformRuntime } = require('../src/platform-runtime')

function runtime () {
  return createPlatformRuntime()
}

test('runtime creates, resolves and attests a mini-game run', () => {
  const rt = runtime()
  const created = rt.dispatch({
    type: 'mini-game:createRun',
    payload: {
      fitId: 'world-cup',
      gameType: 'penalty-clash',
      players: ['alice', 'bob'],
      roomId: 'room-1',
      competitionId: 'comp-1'
    }
  })
  assert.equal(created.type, 'MiniGameRunCreated')
  assert.equal(created.payload.fitId, 'world-cup')

  const resolved = rt.dispatch({
    type: 'mini-game:resolveRun',
    payload: {
      runId: created.payload.runId,
      reveals: [
        { playerId: 'alice', input: { shots: [{ aim: 'left', power: 80 }] }, nonce: 'n1' },
        { playerId: 'bob', input: { shots: [{ aim: 'right', power: 70 }] }, nonce: 'n2' }
      ],
      result: { roundCount: 1 }
    }
  })
  assert.equal(resolved.type, 'MiniGameRunResolved')
  assert.ok(resolved.payload.resolution)

  const attested = rt.dispatch({
    type: 'mini-game:attest',
    payload: { runId: created.payload.runId }
  })
  assert.equal(attested.type, 'MiniGameAttestationCreated')

  const view = rt.view()
  assert.ok(view.miniGameRuns[created.payload.runId])
  assert.ok(view.miniGameRunResolutions[created.payload.runId])
})

test('runtime resolves sport-specific mini-games', () => {
  const rt = runtime()
  const run = rt.dispatch({
    type: 'mini-game:createRun',
    payload: { fitId: 'march-madness', gameType: 'buzzer-beater-duel', players: ['alice', 'bob'] }
  })
  const resolved = rt.dispatch({
    type: 'mini-game:resolveRun',
    payload: {
      runId: run.payload.runId,
      reveals: [
        { playerId: 'alice', input: { attempts: [{ aim: 'center', power: 80 }] }, nonce: 'n1' },
        { playerId: 'bob', input: { attempts: [{ aim: 'center', power: 60 }] }, nonce: 'n2' }
      ],
      result: { attemptCount: 1 }
    }
  })
  assert.equal(resolved.payload.gameType, 'buzzer-beater-duel')
  assert.ok(resolved.payload.resolution.rows.length > 0)
})

test('runtime resolves prediction-duel for host-entered sports', () => {
  const rt = runtime()
  const run = rt.dispatch({
    type: 'mini-game:createRun',
    payload: { fitId: 'awards-prediction-pools', gameType: 'prediction-duel', players: ['alice', 'bob', 'carol'] }
  })
  const resolved = rt.dispatch({
    type: 'mini-game:resolveRun',
    payload: {
      runId: run.payload.runId,
      reveals: [
        { playerId: 'alice', input: { prediction: { winner: 'oppenheimer', speech: 'short' }, responseMs: 1200 }, nonce: 'n1' },
        { playerId: 'bob', input: { prediction: { winner: 'oppenheimer', speech: 'long' }, responseMs: 900 }, nonce: 'n2' },
        { playerId: 'carol', input: { prediction: { winner: 'barbie', speech: 'short' }, responseMs: 1100 }, nonce: 'n3' }
      ],
      result: { outcome: { winner: 'oppenheimer', speech: 'short' }, fields: ['winner', 'speech'] }
    }
  })
  assert.equal(resolved.payload.resolution.winnerUserIds.includes('alice'), true)
})
