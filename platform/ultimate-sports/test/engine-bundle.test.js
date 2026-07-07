'use strict'

// Phase 1B — prove the browser bundle of the pure engines loads and behaves
// identically to the Node modules and the shell's cloned scoring.

const test = require('node:test')
const assert = require('node:assert/strict')
const { readFile } = require('node:fs/promises')
const { join } = require('node:path')
const vm = require('node:vm')
const shellCore = require('../shell/core.js')

function roundOf (matchId) {
  const id = String(matchId).toLowerCase()
  if (id.includes('final')) return 5
  if (id.startsWith('sf') || id.includes('semi')) return 4
  if (id.startsWith('qf') || id.includes('quarter')) return 3
  if (id.startsWith('r16')) return 2
  return 1
}

async function loadBundle () {
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

test('engine bundle exposes the pure engines', async () => {
  const engines = await loadBundle()
  assert.ok(engines.constants, 'constants exposed')
  assert.ok(engines.util, 'util exposed')
  assert.ok(engines.eventLog, 'eventLog exposed')
  assert.ok(engines.scoring, 'scoring exposed')
  assert.ok(engines.prediction, 'prediction exposed')
  assert.ok(engines.pool, 'pool exposed')
  assert.ok(engines.competition, 'competition exposed')
  assert.equal(typeof engines.scoring.scoreClassicBracket, 'function')
})

test('bundled scoring matches shell/core scoring parity', async () => {
  const engines = await loadBundle()
  const winners = { 'r32-1': 'br', 'r32-2': 'jp', 'r16-1': 'br', 'qf-1': 'fr', 'sf-1': 'ar', 'final-1': 'ar' }
  const picks = { 'r32-1': 'br', 'r32-2': 'ci', 'r16-1': 'br', 'qf-1': 'fr', 'sf-1': 'br', 'final-1': 'ar' }

  const shell = shellCore.scoreBracketSubmission({
    submission: { picks },
    officialResults: { matchWinners: winners }
  })

  const results = {}
  for (const [matchId, winner] of Object.entries(winners)) {
    results[matchId] = { winnerEntrantId: winner, roundNumber: roundOf(matchId) }
  }
  const engine = engines.scoring.scoreClassicBracket({ entry: { picks }, resultSnapshot: { results } })

  assert.equal(shell.score, engine.score)
  assert.equal(shell.correctCount, engine.correctCount)
  assert.equal(shell.perfect, engine.perfect)
})
