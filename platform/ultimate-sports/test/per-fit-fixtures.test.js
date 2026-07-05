'use strict'

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const assert = require('node:assert/strict')
const { EVENT_FITS } = require('../src/catalog-engine')

const rootDir = path.resolve(__dirname, '..')
const fixturesDir = path.join(rootDir, 'shell', 'fits', 'fixtures')

function fixturePath (fitId) {
  return path.join(fixturesDir, `${fitId}.js`)
}

function loadFixtureConfigs () {
  const configs = {}
  for (const fit of EVENT_FITS) {
    configs[fit.fitId] = require(fixturePath(fit.fitId))
  }
  return configs
}

function runFitLoader (options = {}) {
  const { search = '', ultimateSportsFit = null, registry = loadFixtureConfigs() } = options
  const fitLoaderSource = fs.readFileSync(path.join(rootDir, 'shell', 'fit-loader.js'), 'utf8')

  const htmlEl = {
    style: {
      setProperty: () => {}
    }
  }

  const body = {
    classList: { add: () => {} },
    style: {},
    querySelector: () => null
  }

  const doc = {
    title: '',
    readyState: 'complete',
    documentElement: htmlEl,
    body,
    querySelector: () => null,
    addEventListener: () => {},
    createElement: () => ({
      setAttribute: () => {},
      addEventListener: () => {}
    })
  }

  const mockWindow = {
    ULTIMATE_FIT_REGISTRY: registry,
    ULTIMATE_SPORTS_FIT: ultimateSportsFit,
    location: { search },
    document: doc,
    URLSearchParams: URLSearchParams,
    Event: function Event (type) { this.type = type },
    dispatchEvent: () => true,
    self: {},
    top: {},
    parent: { postMessage: () => {} }
  }

  const context = vm.createContext({ window: mockWindow, console })
  vm.runInContext(fitLoaderSource, context)
  return mockWindow
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

test('fit-loader resolves valid ?fit=<fitId> for every catalog fit', () => {
  for (const fit of EVENT_FITS) {
    const win = runFitLoader({ search: `?fit=${fit.fitId}` })
    assert.equal(win.CURRENT_FIT_ID, fit.fitId, `CURRENT_FIT_ID should match requested ${fit.fitId}`)
    assert.ok(win.ULTIMATE_FIT_CONFIG, `ULTIMATE_FIT_CONFIG should be set for ${fit.fitId}`)
    assert.equal(win.ULTIMATE_FIT_CONFIG.fitId, fit.fitId, `ULTIMATE_FIT_CONFIG.fitId should match requested ${fit.fitId}`)
    assert.equal(win.__ULTIMATE_FIT_LOADER_READY, true, `loader ready flag should be set for ${fit.fitId}`)
  }
})

test('fit-loader falls back to world-cup for unknown fit parameter', () => {
  const win = runFitLoader({ search: '?fit=unknown-fit' })
  assert.equal(win.CURRENT_FIT_ID, 'world-cup')
  assert.equal(win.ULTIMATE_FIT_CONFIG.fitId, 'world-cup')
  assert.equal(win.__ULTIMATE_FIT_LOADER_READY, true)
})

test('fit-loader falls back to world-cup when fit parameter is missing', () => {
  const win = runFitLoader({ search: '' })
  assert.equal(win.CURRENT_FIT_ID, 'world-cup')
  assert.equal(win.ULTIMATE_FIT_CONFIG.fitId, 'world-cup')
  assert.equal(win.__ULTIMATE_FIT_LOADER_READY, true)
})

test('fit-loader falls back to world-cup when fit parameter is empty', () => {
  const win = runFitLoader({ search: '?fit=' })
  assert.equal(win.CURRENT_FIT_ID, 'world-cup')
  assert.equal(win.ULTIMATE_FIT_CONFIG.fitId, 'world-cup')
  assert.equal(win.__ULTIMATE_FIT_LOADER_READY, true)
})

test('fit-loader respects window.ULTIMATE_SPORTS_FIT override', () => {
  const win = runFitLoader({ ultimateSportsFit: 'march-madness', search: '?fit=world-cup' })
  assert.equal(win.CURRENT_FIT_ID, 'march-madness')
  assert.equal(win.ULTIMATE_FIT_CONFIG.fitId, 'march-madness')
})

test('fit-loader does not throw when registry and document are minimal', () => {
  assert.doesNotThrow(() => {
    runFitLoader({ search: '?fit=bad-fit', registry: {} })
  })
})
