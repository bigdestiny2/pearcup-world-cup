'use strict'

// Phase C — prove shell/core.js deriveBracketPoolWinners delegates to the bundled
// Ultimate Sports pool engine without changing its public output shape.

const test = require('node:test')
const assert = require('node:assert/strict')
const { readFile } = require('node:fs/promises')
const { join } = require('node:path')
const vm = require('node:vm')
const shellCore = require('../shell/core.js')

async function loadEngines () {
  const bundle = await readFile(join(__dirname, '..', 'shell', 'engines.bundle.js'), 'utf8')
  const context = {
    window: {},
    console,
    Math, JSON, Date, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error,
    Uint8Array, Buffer: {}
  }
  vm.createContext(context)
  vm.runInContext(bundle, context, { filename: 'engines.bundle.js' })
  return context.window.UltimateEngines
}

function withEngines (engines, fn) {
  const previous = globalThis.UltimateEngines
  globalThis.UltimateEngines = engines
  try {
    return fn()
  } finally {
    globalThis.UltimateEngines = previous
  }
}

function withoutEngines (fn) {
  return withEngines(undefined, fn)
}

function makeSubmissions () {
  const official = { 'r32-1': 'br', 'r16-1': 'jp', 'qf-1': 'fr', 'sf-1': 'ar', 'final-1': 'es' }
  return [
    shellCore.createBracketSubmission({
      poolId: 'pool-a',
      entryId: 'entry-alice',
      userId: 'alice',
      picks: { ...official },
      rulesVersion: 'bracket-pool-v1'
    }),
    shellCore.createBracketSubmission({
      poolId: 'pool-a',
      entryId: 'entry-bob',
      userId: 'bob',
      picks: { 'r32-1': 'br', 'r16-1': 'jp', 'qf-1': 'fr', 'sf-1': 'br', 'final-1': 'es' },
      rulesVersion: 'bracket-pool-v1'
    }),
    shellCore.createBracketSubmission({
      poolId: 'pool-a',
      entryId: 'entry-carol',
      userId: 'carol',
      picks: { 'r32-1': 'br', 'r16-1': 'jp', 'qf-1': 'fr', 'sf-1': 'ar', 'final-1': 'es' },
      rulesVersion: 'bracket-pool-v1'
    })
  ]
}

test('engine-backed leaderboard matches cloned shell fallback', async () => {
  const engines = await loadEngines()
  const submissions = makeSubmissions()
  const officialResults = {
    matchWinners: { 'r32-1': 'br', 'r16-1': 'jp', 'qf-1': 'fr', 'sf-1': 'ar', 'final-1': 'es' }
  }

  const engineResult = withEngines(engines, () => shellCore.deriveBracketPoolWinners({
    bracketSubmissions: submissions,
    officialResults
  }))

  const fallbackResult = withoutEngines(() => shellCore.deriveBracketPoolWinners({
    bracketSubmissions: submissions,
    officialResults
  }))

  assert.deepEqual(engineResult, fallbackResult)
  assert.deepEqual(engineResult.winnerUserIds, ['alice', 'carol'])
  assert.equal(engineResult.resolvedBy, 'perfect-bracket')
})

test('engine-backed fallback-score tie matches cloned shell fallback', async () => {
  const engines = await loadEngines()
  const officialResults = {
    matchWinners: { 'r32-1': 'br', 'r16-1': 'jp', 'qf-1': 'fr', 'sf-1': 'ar', 'final-1': 'es' }
  }
  const submissions = [
    shellCore.createBracketSubmission({
      poolId: 'pool-b',
      entryId: 'entry-dave',
      userId: 'dave',
      picks: { 'r32-1': 'br', 'r16-1': 'jp', 'qf-1': 'fr', 'sf-1': 'br', 'final-1': 'es' },
      rulesVersion: 'bracket-pool-v1'
    }),
    shellCore.createBracketSubmission({
      poolId: 'pool-b',
      entryId: 'entry-eve',
      userId: 'eve',
      picks: { 'r32-1': 'br', 'r16-1': 'jp', 'qf-1': 'fr', 'sf-1': 'br', 'final-1': 'es' },
      rulesVersion: 'bracket-pool-v1'
    })
  ]

  const engineResult = withEngines(engines, () => shellCore.deriveBracketPoolWinners({
    bracketSubmissions: submissions,
    officialResults
  }))
  const fallbackResult = withoutEngines(() => shellCore.deriveBracketPoolWinners({
    bracketSubmissions: submissions,
    officialResults
  }))

  assert.deepEqual(engineResult, fallbackResult)
  assert.deepEqual(engineResult.winnerUserIds, ['dave', 'eve'])
  assert.equal(engineResult.resolvedBy, 'fallback-score')
})

test('engine-backed no-results case matches cloned shell fallback', async () => {
  const engines = await loadEngines()
  const submissions = makeSubmissions()

  const engineResult = withEngines(engines, () => shellCore.deriveBracketPoolWinners({
    bracketSubmissions: submissions,
    officialResults: {}
  }))
  const fallbackResult = withoutEngines(() => shellCore.deriveBracketPoolWinners({
    bracketSubmissions: submissions,
    officialResults: {}
  }))

  assert.deepEqual(engineResult, fallbackResult)
  assert.deepEqual(engineResult.winnerUserIds, [])
  assert.equal(engineResult.resolvedBy, 'no-qualified-bracket')
})

test('engine-backed eligibility filter matches cloned shell fallback', async () => {
  const engines = await loadEngines()
  const submissions = makeSubmissions()
  const officialResults = {
    matchWinners: { 'r32-1': 'br', 'r16-1': 'jp', 'qf-1': 'fr', 'sf-1': 'ar', 'final-1': 'es' }
  }

  const engineResult = withEngines(engines, () => shellCore.deriveBracketPoolWinners({
    bracketSubmissions: submissions,
    officialResults,
    eligibleUserIds: ['bob']
  }))
  const fallbackResult = withoutEngines(() => shellCore.deriveBracketPoolWinners({
    bracketSubmissions: submissions,
    officialResults,
    eligibleUserIds: ['bob']
  }))

  assert.deepEqual(engineResult, fallbackResult)
  assert.deepEqual(engineResult.winnerUserIds, ['bob'])
})
