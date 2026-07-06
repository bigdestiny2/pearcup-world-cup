'use strict'

// Phase 1B — one source of truth. The shell carries its own cloned demo scoring
// (shell/core.js scoreBracketSubmission); the platform has the real deterministic
// engine (src/scoring-engine.js scoreClassicBracket). This test proves they agree
// on classic-bracket scoring for identical inputs, so the shell can be routed to
// the engine without changing behavior — and guards against the two drifting.

const test = require('node:test')
const assert = require('node:assert/strict')
const shellCore = require('../shell/core.js')
const scoring = require('../src/scoring-engine.js')

// Map a shell matchId to the round number the engine's result snapshot expects.
function roundOf (matchId) {
  const id = String(matchId).toLowerCase()
  if (id.includes('final')) return 5
  if (id.startsWith('sf') || id.includes('semi')) return 4
  if (id.startsWith('qf') || id.includes('quarter')) return 3
  if (id.startsWith('r16')) return 2
  return 1
}

function scoreBoth (winners, picks) {
  const shell = shellCore.scoreBracketSubmission({
    submission: { picks },
    officialResults: { matchWinners: winners }
  })
  const results = {}
  for (const [matchId, winner] of Object.entries(winners)) {
    results[matchId] = { winnerEntrantId: winner, roundNumber: roundOf(matchId) }
  }
  const engine = scoring.scoreClassicBracket({ entry: { picks }, resultSnapshot: { results } })
  return { shell, engine }
}

test('shell and engine agree on a mixed bracket score', () => {
  const winners = { 'r32-1': 'br', 'r32-2': 'jp', 'r16-1': 'br', 'qf-1': 'fr', 'sf-1': 'ar', 'final-1': 'ar' }
  const picks = { 'r32-1': 'br', 'r32-2': 'ci', 'r16-1': 'br', 'qf-1': 'fr', 'sf-1': 'br', 'final-1': 'ar' }
  const { shell, engine } = scoreBoth(winners, picks)
  assert.equal(shell.score, engine.score)
  assert.equal(shell.correctCount, engine.correctCount)
  assert.equal(shell.perfect, engine.perfect)
})

test('agree on a perfect bracket', () => {
  const winners = { 'r32-1': 'br', 'r16-1': 'jp', 'qf-1': 'fr', 'sf-1': 'ar', 'final-1': 'es' }
  const { shell, engine } = scoreBoth(winners, { ...winners })
  assert.equal(shell.score, engine.score)
  assert.equal(shell.perfect, true)
  assert.equal(engine.perfect, true)
})

test('agree on an all-wrong bracket (score 0)', () => {
  const winners = { 'r32-1': 'br', 'final-1': 'es' }
  const picks = { 'r32-1': 'jp', 'final-1': 'fr' }
  const { shell, engine } = scoreBoth(winners, picks)
  assert.equal(shell.score, 0)
  assert.equal(engine.score, 0)
  assert.equal(shell.correctCount, engine.correctCount)
})

test('round weights match the 2^(round-1) ladder on both implementations', () => {
  const rounds = [['r32-1', 1], ['r16-1', 2], ['qf-1', 4], ['sf-1', 8], ['final-1', 16]]
  for (const [matchId, expectedWeight] of rounds) {
    const winners = { [matchId]: 'br' }
    const { shell, engine } = scoreBoth(winners, { [matchId]: 'br' })
    assert.equal(shell.score, expectedWeight, `shell weight for ${matchId}`)
    assert.equal(engine.score, expectedWeight, `engine weight for ${matchId}`)
  }
})
