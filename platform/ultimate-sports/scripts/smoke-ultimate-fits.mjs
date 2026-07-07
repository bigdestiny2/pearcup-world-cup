#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const require = createRequire(import.meta.toPath ? import.meta.toPath : import.meta.url)

const REPORT_VERSION = 'ultimate-sports-fit-smoke-matrix-v1'

async function main () {
  const args = parseArgs(process.argv.slice(2))
  const report = await runFitSmokeMatrix({ outFile: args.out })
  const failures = report.checks.filter(c => !c.ok)
  if (failures.length) {
    console.error(`Fit smoke matrix failed: ${failures.length} check(s)`)
    process.exitCode = 1
  } else {
    console.log(`Fit smoke matrix passed: ${report.summary.passed}/${report.checks.length} checks`)
  }
}

export async function runFitSmokeMatrix (input = {}) {
  const generatedAt = new Date().toISOString()
  const checks = []

  // 1. Every shell fit file loads and exposes a valid config.
  const fitFiles = listFitFiles()
  const registry = loadFitRegistry(fitFiles)
  for (const fitId of Object.keys(registry)) {
    const cfg = registry[fitId]
    addCheck(checks, {
      checkId: `shell-fit:${fitId}:loads`,
      title: `Shell fit ${fitId} loads`,
      ok: Boolean(cfg && cfg.fitId === fitId && cfg.title && cfg.category && cfg.templateKind),
      evidence: cfg ? `fitId=${cfg.fitId}, title=${cfg.title}, category=${cfg.category}, templateKind=${cfg.templateKind}` : 'missing config'
    })
    addCheck(checks, {
      checkId: `shell-fit:${fitId}:theme`,
      title: `Shell fit ${fitId} has theme tokens`,
      ok: Boolean(cfg && cfg.theme && cfg.theme['--ink'] && cfg.theme['--surface']),
      evidence: cfg && cfg.theme ? 'theme tokens present' : 'theme missing'
    })
    addCheck(checks, {
      checkId: `shell-fit:${fitId}:assets`,
      title: `Shell fit ${fitId} has asset pack layout`,
      ok: Boolean(cfg && cfg.assets && cfg.assets.heroBackdrop && cfg.assets.serverCardCover),
      evidence: cfg && cfg.assets ? 'asset paths present' : 'assets missing'
    })
  }

  // 2. Every catalog fit has a matching shell config.
  const catalog = require('../src/catalog-engine.js')
  const catalogFits = catalog.listEventFits()
  for (const fit of catalogFits) {
    addCheck(checks, {
      checkId: `catalog-fit:${fit.fitId}:shell-registry`,
      title: `Catalog fit ${fit.fitId} is registered in shell`,
      ok: Boolean(registry[fit.fitId]),
      evidence: registry[fit.fitId] ? 'found in shell registry' : 'missing from shell registry'
    })
  }

  // 3. Mini-game suites build for every catalog fit (validates recommendedMiniGames and specs).
  const miniGameSpec = require('../src/mini-game-spec-engine.js')
  const matrix = miniGameSpec.createMiniGameBuildMatrix({ settlementMode: 'demo' })
  addCheck(checks, {
    checkId: 'mini-game-matrix:builds',
    title: 'Mini-game build matrix constructs suites for every fit',
    ok: matrix.suites.length === catalogFits.length && matrix.totalSpecs > 0,
    evidence: `built ${matrix.totalSpecs} specs across ${matrix.suites.length} suites`
  })
  for (const suite of matrix.suites) {
    const fit = catalogFits.find(f => f.fitId === suite.fitId)
    addCheck(checks, {
      checkId: `mini-game-suite:${suite.fitId}:specs`,
      title: `Mini-game specs build for ${suite.fitId}`,
      ok: suite.specs.length > 0 && suite.specs.every(s => s.gameType && s.title && s.commandDraft),
      evidence: `${suite.specs.length} specs built`
    })
    addCheck(checks, {
      checkId: `mini-game-suite:${suite.fitId}:recommended`,
      title: `Mini-game suite matches catalog recommendations for ${suite.fitId}`,
      ok: Boolean(fit) && suite.gameTypes.length === fit.recommendedMiniGames.length &&
          fit.recommendedMiniGames.every(gt => suite.gameTypes.includes(gt)),
      evidence: `suite=${suite.gameTypes.join(',')}, catalog=${(fit && fit.recommendedMiniGames.join(',')) || 'n/a'}`
    })
  }

  const summary = {
    total: checks.length,
    passed: checks.filter(c => c.ok).length,
    failed: checks.filter(c => !c.ok).length
  }
  const report = { reportVersion: REPORT_VERSION, generatedAt, summary, checks }
  if (input.outFile) writeReport(input.outFile, report)
  return report
}

function listFitFiles () {
  const dir = join(ROOT, 'shell', 'fits')
  return readdirSync(dir)
    .filter(name => name.endsWith('.js') && !name.startsWith('_'))
    .map(name => join(dir, name))
}

function loadFitRegistry (files) {
  const context = {
    window: {
      ULTIMATE_FIT_REGISTRY: {},
      document: null,
      location: { search: '' }
    },
    console,
    JSON,
    Math,
    Date,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error
  }
  // Load _registry.js first so registerFit/defaultFitAssets exist.
  const registrySource = readFileSync(join(ROOT, 'shell', 'fits', '_registry.js'), 'utf8')
  runInNewContext(registrySource, context, { filename: '_registry.js' })
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    runInNewContext(source, context, { filename: file })
  }
  return context.window.ULTIMATE_FIT_REGISTRY
}

function addCheck (checks, check) {
  checks.push({
    checkId: check.checkId,
    title: check.title,
    ok: Boolean(check.ok),
    evidence: check.evidence || ''
  })
}

function writeReport (outFile, report) {
  writeFileSync(outFile, JSON.stringify(report, null, 2))
}

function parseArgs (argv) {
  const args = { out: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) args.out = argv[++i]
  }
  return args
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
