'use strict'

const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const { EVENT_FITS } = require('../src/catalog-engine')

const rootDir = path.resolve(__dirname, '..')
const fixturesDir = path.join(rootDir, 'shell', 'fits', 'fixtures')

function fixturePath (fitId) {
  return path.join(fixturesDir, `${fitId}.js`)
}

test('every catalog fit has a per-fit fixture module', () => {
  for (const fit of EVENT_FITS) {
    const file = fixturePath(fit.fitId)
    assert.ok(fs.existsSync(file), `missing fixture module for ${fit.fitId}: ${file}`)
  }
})

test('every fixture module is valid JavaScript and exports required sections', () => {
  for (const fit of EVENT_FITS) {
    const file = fixturePath(fit.fitId)
    assert.ok(fs.existsSync(file), `missing fixture module for ${fit.fitId}`)

    const cfg = require(file)

    assert.ok(cfg, `fixture ${fit.fitId} exported null/undefined`)
    assert.equal(cfg.fitId, fit.fitId, `fixture ${fit.fitId} fitId mismatch`)
    assert.ok(cfg.title, `fixture ${fit.fitId} missing title`)
    assert.ok(cfg.category, `fixture ${fit.fitId} missing category`)

    const entrants = cfg.entrants || cfg.teams
    assert.ok(Array.isArray(entrants) && entrants.length > 0, `fixture ${fit.fitId} missing entrants`)

    const fixtures = cfg.fixtures || cfg.homeFixtures || cfg.round32Matches
    assert.ok(Array.isArray(fixtures) && fixtures.length > 0, `fixture ${fit.fitId} missing fixtures`)

    assert.ok(Array.isArray(cfg.bracketLinks) && cfg.bracketLinks.length > 0, `fixture ${fit.fitId} missing bracketLinks`)
    assert.ok(Array.isArray(cfg.bracketMatchIds) && cfg.bracketMatchIds.length > 0, `fixture ${fit.fitId} missing bracketMatchIds`)

    const liveMatch = cfg.liveMatch || fixtures.find(f => f.live)
    assert.ok(liveMatch, `fixture ${fit.fitId} missing liveMatch`)

    assert.ok(Array.isArray(cfg.pools) && cfg.pools.length > 0, `fixture ${fit.fitId} missing pools`)
    assert.ok(cfg.commentary && typeof cfg.commentary === 'object', `fixture ${fit.fitId} missing commentary`)
    assert.ok(Array.isArray(cfg.defaultChat) && cfg.defaultChat.length > 0, `fixture ${fit.fitId} missing defaultChat`)
    assert.ok(Array.isArray(cfg.gameRounds) && cfg.gameRounds.length > 0, `fixture ${fit.fitId} missing gameRounds`)
  }
})

test('fixture entrantShape matches catalog-engine.js for every fit', () => {
  for (const fit of EVENT_FITS) {
    const file = fixturePath(fit.fitId)
    const cfg = require(file)
    assert.equal(cfg.entrantShape, fit.entrantShape, `entrantShape mismatch for ${fit.fitId}: expected ${fit.entrantShape}, got ${cfg.entrantShape}`)
  }
})

test('fit-loader.js consumes window.ULTIMATE_FIT_CONFIG and index.html wires registry, fixtures, and loader', () => {
  const fitLoader = fs.readFileSync(path.join(rootDir, 'shell', 'fit-loader.js'), 'utf8')
  const registry = fs.readFileSync(path.join(rootDir, 'shell', 'fits', '_registry.js'), 'utf8')
  const indexHtml = fs.readFileSync(path.join(rootDir, 'shell', 'index.html'), 'utf8')

  assert.match(fitLoader, /window\.ULTIMATE_FIT_CONFIG/)
  assert.match(registry, /registerFit/)
  assert.match(indexHtml, /fits\/_registry\.js/)
  assert.match(indexHtml, /fit-loader\.js/)
})

test('shell/index.html loads a fixture module for every catalog fit', () => {
  const indexHtml = fs.readFileSync(path.join(rootDir, 'shell', 'index.html'), 'utf8')
  for (const fit of EVENT_FITS) {
    assert.match(indexHtml, new RegExp(`fits/fixtures/${fit.fitId}\\.js`))
  }
})
