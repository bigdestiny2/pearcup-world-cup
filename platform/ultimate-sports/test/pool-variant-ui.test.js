'use strict'

// Phase E2 — pool variants in the shell UI and scoring.
// These tests exercise the pure helper surface and the core.js variant router
// so the bracket UI can switch variants, enforce variant rules, and score
// submissions through the engine bundle.

const test = require('node:test')
const assert = require('node:assert/strict')
const helpers = require('../shell/pool-variant-helpers.js')
const shellCore = require('../shell/core.js')
const scoring = require('../src/scoring-engine.js')

const DEFAULT_POOLS = [
  { tier: 10, prize: '$1,000' },
  { tier: 25, prize: '$2,000' },
  { tier: 50, prize: '$3,000' },
  { tier: 100, prize: '$4,000' }
]

test('assignPoolVariants cycles through recommended variants and preserves tiers', () => {
  const result = helpers.assignPoolVariants(DEFAULT_POOLS, ['classic-bracket', 'confidence', 'survivor'])
  assert.equal(result[0].variant, 'classic-bracket')
  assert.equal(result[1].variant, 'confidence')
  assert.equal(result[2].variant, 'survivor')
  assert.equal(result[3].variant, 'classic-bracket')
  assert.equal(result[0].tier, 10)
  assert.equal(result[3].prize, '$4,000')
})

test('assignPoolVariants keeps explicit pool variant and falls back to defaults', () => {
  const withExplicit = [{ tier: 10, variant: 'upset-bounty' }]
  const result = helpers.assignPoolVariants(withExplicit, ['classic-bracket'])
  assert.equal(result[0].variant, 'upset-bounty')

  const noRecommended = helpers.assignPoolVariants([{ tier: 10 }], null)
  assert.equal(noRecommended[0].variant, 'classic-bracket')
})

test('variant display names are human readable', () => {
  assert.equal(helpers.variantDisplayName('confidence'), 'Confidence card')
  assert.equal(helpers.variantDisplayName('survivor'), 'Survivor')
  assert.equal(helpers.variantDisplayName('unknown'), 'unknown')
})

test('normalizeEnteredPools upgrades booleans to objects', () => {
  const normalized = helpers.normalizeEnteredPools({ 25: true, 50: { variant: 'confidence', enteredAt: '2026-07-01T00:00:00.000Z' } })
  assert.deepEqual(normalized[25], { variant: 'classic-bracket', enteredAt: null })
  assert.equal(normalized[50].variant, 'confidence')
})

test('swapActivePicks swaps the active pick surface by variant', () => {
  const state = {
    selectedPoolVariant: 'classic-bracket',
    picks: { 'r32-1': 'br' },
    variantPicks: {}
  }
  helpers.swapActivePicks(state, 'confidence')
  assert.equal(state.selectedPoolVariant, 'confidence')
  assert.deepEqual(state.variantPicks['classic-bracket'], { 'r32-1': 'br' })
  assert.deepEqual(state.picks, {})

  state.picks = { 'r32-1': 'ar', 'r32-1-confidence': 5 }
  helpers.swapActivePicks(state, 'classic-bracket')
  assert.deepEqual(state.variantPicks['confidence'], { 'r32-1': 'ar', 'r32-1-confidence': 5 })
  assert.deepEqual(state.picks, { 'r32-1': 'br' })
})

test('mirrorActivePicks writes active picks back to the current variant slot', () => {
  const state = {
    selectedPoolVariant: 'survivor',
    picks: { 'survivor-r1': 'br' },
    variantPicks: {}
  }
  helpers.mirrorActivePicks(state)
  assert.deepEqual(state.variantPicks.survivor, { 'survivor-r1': 'br' })
})

test('confidence picks enforce unique values', () => {
  const valid = [
    { pickId: 'r32-1', outcome: 'br', confidence: 5 },
    { pickId: 'r32-2', outcome: 'ar', confidence: 4 },
    { pickId: 'r32-3', outcome: 'fr', confidence: 3 }
  ]
  const invalid = [
    { pickId: 'r32-1', outcome: 'br', confidence: 3 },
    { pickId: 'r32-2', outcome: 'ar', confidence: 3 }
  ]
  assert.equal(helpers.validateConfidencePicks(valid).ok, true)
  const bad = helpers.validateConfidencePicks(invalid)
  assert.equal(bad.ok, false)
  assert.ok(bad.errors.some(e => e.includes('3')))
})

test('survivor submission picks advance rounds', () => {
  const picks = { 'survivor-r1': 'br', 'survivor-r2': 'ar' }
  const result = helpers.buildSurvivorSubmissionPicks(picks)
  assert.equal(result.length, 2)
  assert.deepEqual(result[0], { roundNumber: 1, fixtureId: 'r32-survivor', entrantId: 'br' })
  assert.deepEqual(result[1], { roundNumber: 2, fixtureId: 'r16-survivor', entrantId: 'ar' })
})

test('confidence submission picks collect outcomes and confidence values', () => {
  const picks = {
    'r32-1': 'br',
    'r32-1-confidence': 5,
    'r32-2': 'ar',
    'r32-2-confidence': 4
  }
  const result = helpers.buildConfidenceSubmissionPicks(picks, ['r32-1', 'r32-2'])
  assert.equal(result.length, 2)
  assert.deepEqual(result[0], { pickId: 'r32-1', outcome: 'br', confidence: 5 })
})

test('side-quest submission picks collect unique selected entrant ids', () => {
  const picks = { a: 'br', b: 'ar', c: 'br' }
  const result = helpers.buildSideQuestSubmissionPicks(picks)
  assert.deepEqual(result.selectedEntrantIds.sort(), ['ar', 'br'])
})

test('shell variant router scores a confidence card submission', () => {
  const picks = [
    { pickId: 'r32-1', outcome: 'br', confidence: 5 },
    { pickId: 'r32-2', outcome: 'ar', confidence: 4 }
  ]
  const cardResults = { 'r32-1': 'br', 'r32-2': 'de' }
  const shell = shellCore.scoreVariantSubmission({
    submission: { userId: 'u1', entryId: 'e1', picks },
    resultSnapshot: { cardResults },
    variant: 'confidence'
  })
  const engine = scoring.scoreConfidenceCard({ entry: { picks }, resultSnapshot: { cardResults } })
  assert.equal(shell.score, engine.score)
  assert.equal(shell.correctCount, engine.correctCount)
})

test('shell variant router scores a survivor submission', () => {
  const picks = [
    { roundNumber: 1, fixtureId: 'f1', entrantId: 'br' },
    { roundNumber: 2, fixtureId: 'f2', entrantId: 'ar' }
  ]
  const results = { f1: { winnerEntrantId: 'br' }, f2: { winnerEntrantId: 'de' } }
  const shell = shellCore.scoreVariantSubmission({
    submission: { userId: 'u1', entryId: 'e1', picks },
    resultSnapshot: { results },
    variant: 'survivor'
  })
  const engine = scoring.scoreSurvivorEntry({ entry: { picks }, resultSnapshot: { results } })
  assert.equal(shell.score, engine.score)
  assert.equal(shell.correctCount, engine.correctCount)
})

test('shell variant router scores an upset-bounty submission', () => {
  const winners = { 'r32-1': 'br', 'r16-1': 'jp' }
  const picks = { 'r32-1': 'br', 'r16-1': 'jp' }
  const results = {
    'r32-1': { winnerEntrantId: 'br', roundNumber: 1, underdogEntrantId: 'br', upsetBonus: 2 },
    'r16-1': { winnerEntrantId: 'jp', roundNumber: 2, underdogEntrantId: 'jp', upsetBonus: 2 }
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

test('shell variant router scores a side-quest submission', () => {
  const picks = { selectedEntrantIds: ['br', 'ar'] }
  const results = {
    'r32-1': { winnerEntrantId: 'br', roundNumber: 1, homeEntrantId: 'br', homeScore: 2, awayEntrantId: 'za', awayScore: 1 },
    'r32-2': { winnerEntrantId: 'ma', roundNumber: 1, homeEntrantId: 'ma', homeScore: 1, awayEntrantId: 'nl', awayScore: 1 }
  }
  const shell = shellCore.scoreVariantSubmission({
    submission: { userId: 'u1', entryId: 'e1', picks },
    resultSnapshot: { results },
    variant: 'side-quest'
  })
  const engine = scoring.scoreSideQuestEntry({ entry: { picks }, resultSnapshot: { results } })
  assert.equal(shell.score, engine.score)
  assert.equal(shell.correctCount, engine.correctCount)
})
