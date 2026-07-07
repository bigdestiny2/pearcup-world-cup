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

test('shell variant router agrees with engine on confidence card', () => {
  const picks = [
    { pickId: 'p1', outcome: 'br', confidence: 5 },
    { pickId: 'p2', outcome: 'ar', confidence: 4 },
    { pickId: 'p3', outcome: 'fr', confidence: 3 }
  ]
  const cardResults = { p1: 'br', p2: 'de', p3: 'fr' }
  const shell = shellCore.scoreVariantSubmission({
    submission: { userId: 'u1', entryId: 'e1', picks },
    resultSnapshot: { cardResults },
    variant: 'confidence'
  })
  const engine = scoring.scoreConfidenceCard({ entry: { picks }, resultSnapshot: { cardResults } })
  assert.equal(shell.score, engine.score)
  assert.equal(shell.correctCount, engine.correctCount)
})

test('shell variant router agrees with engine on survivor entry', () => {
  const picks = [
    { roundNumber: 1, fixtureId: 'f1', entrantId: 'br' },
    { roundNumber: 2, fixtureId: 'f2', entrantId: 'ar' },
    { roundNumber: 3, fixtureId: 'f3', entrantId: 'fr' }
  ]
  const results = {
    f1: { winnerEntrantId: 'br' },
    f2: { winnerEntrantId: 'ar' },
    f3: { winnerEntrantId: 'de' }
  }
  const shell = shellCore.scoreVariantSubmission({
    submission: { userId: 'u1', entryId: 'e1', picks },
    resultSnapshot: { results },
    variant: 'survivor'
  })
  const engine = scoring.scoreSurvivorEntry({ entry: { picks }, resultSnapshot: { results } })
  assert.equal(shell.score, engine.score)
  assert.equal(shell.correctCount, engine.correctCount)
})

test('shell variant router agrees with engine on upset-bounty bracket', () => {
  const winners = { 'r32-1': 'br', 'r16-1': 'jp', 'qf-1': 'fr', 'sf-1': 'ar', 'final-1': 'es' }
  const picks = { ...winners }
  const results = {}
  for (const [matchId, winner] of Object.entries(winners)) {
    results[matchId] = {
      winnerEntrantId: winner,
      roundNumber: roundOf(matchId),
      underdogEntrantId: winner,
      upsetBonus: 2
    }
  }
  const shell = shellCore.scoreVariantSubmission({
    submission: { userId: 'u1', entryId: 'e1', picks },
    resultSnapshot: { results },
    variant: 'upset-bounty'
  })
  const engine = scoring.scoreUpsetBountyBracket({ entry: { picks }, resultSnapshot: { results } })
  assert.equal(shell.score, engine.score)
  assert.equal(shell.correctCount, engine.correctCount)
})

test('shell variant router agrees with engine on fight-card player props', () => {
  const picks = {
    'main': 'silva',
    'main-method': 'KO/TKO',
    'main-round': 'Round 1',
    'co-main': 'nunes',
    'co-main-method': 'Submission',
    'co-main-round': 'Round 3'
  }
  const results = {
    main: { winnerEntrantId: 'silva', method: 'ko/tko', round: 'Round 1' },
    'co-main': { winnerEntrantId: 'nunes', method: 'Submission', round: 'Round 2' }
  }
  const shell = shellCore.scoreVariantSubmission({
    submission: { userId: 'u1', entryId: 'e1', picks },
    resultSnapshot: { results },
    variant: 'player-prop'
  })
  const engine = scoring.scorePlayerPropEntry({ entry: { picks }, resultSnapshot: { results } })
  assert.equal(shell.score, engine.score)
  assert.equal(shell.correctCount, engine.correctCount)
  assert.equal(shell.score, 5)
})

test('shell variant router agrees with engine on weighted awards card', () => {
  const categories = [
    { id: 'cat-picture', title: 'Best Picture', weight: 3 },
    { id: 'cat-drama', title: 'Best Drama', weight: 1 }
  ]
  const picks = { 'cat-picture': 'oppen', 'cat-drama': 'kill' }
  const results = { 'cat-picture': 'oppen', 'cat-drama': 'past' }
  const shell = shellCore.scoreVariantSubmission({
    submission: { userId: 'u1', entryId: 'e1', picks },
    resultSnapshot: { results },
    variant: 'group-stage-card',
    config: { categories }
  })
  const engine = scoring.scoreAwardsCard({ entry: { picks }, resultSnapshot: { results }, categories })
  assert.equal(shell.score, engine.score)
  assert.equal(shell.correctCount, engine.correctCount)
  assert.equal(shell.score, 3)
})
