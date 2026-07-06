#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const {
  runSportsDataSmokeChecks
} = require('../src/sports-data-smoke-engine')

async function main (argv = process.argv.slice(2), deps = {}) {
  const options = parseArgs(argv)
  const outDir = path.resolve(options.outDir || 'platform/ultimate-sports/generated-reports')
  const jsonPath = path.resolve(options.json || path.join(outDir, 'sports-data-smoke.json'))
  const fetchImpl = options.network === false
    ? null
    : deps.fetchImpl || (typeof fetch === 'function' ? fetch : null)
  const report = await runSportsDataSmokeChecks({
    env: deps.env,
    sourceIds: options.sourceIds,
    generatedAt: options.generatedAt,
    allowNetwork: options.network !== false,
    timeoutMs: options.timeoutMs,
    standupFixtures: options.standupFixtures,
    fetchImpl
  })

  fs.mkdirSync(path.dirname(jsonPath), { recursive: true })
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)

  process.stdout.write('Sports data smoke report generated\n')
  process.stdout.write(`JSON: ${jsonPath}\n`)
  process.stdout.write(`Status: ${report.overallStatus}\n`)
  process.stdout.write(`Ready API checks: ${report.summary.readyToRun}/${report.summary.apiChecks}\n`)
  process.stdout.write(`Fixture-ready API checks: ${report.summary.fixtureReady}/${report.summary.apiChecks}\n`)
  process.stdout.write(`Executed: ${report.summary.executed}; passed live: ${report.summary.passedLive}; passed fixture: ${report.summary.passedFixture}; failed: ${report.summary.failed}; skipped: ${report.summary.skipped}\n`)
  if (report.summary.missingCredentials > 0) {
    const sources = report.checks
      .filter(check => check.status === 'missing-env')
      .map(check => check.sourceId)
      .join(', ')
    process.stdout.write(`Missing credentials: ${sources}\n`)
  }

  return {
    report,
    jsonPath,
    exitCode: exitCodeFor({ report, options })
  }
}

function parseArgs (argv) {
  const options = {
    sourceIds: [],
    network: true,
    timeoutMs: 10000,
    standupFixtures: false,
    failOnMissing: false,
    failOnFailed: true
  }

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--out-dir') options.outDir = argv[++index]
    else if (item === '--json') options.json = argv[++index]
    else if (item === '--source') options.sourceIds.push(argv[++index])
    else if (item === '--generated-at') options.generatedAt = argv[++index]
    else if (item === '--no-network') options.network = false
    else if (item === '--standup-fixtures' || item === '--fixtures') options.standupFixtures = true
    else if (item === '--timeout-ms') options.timeoutMs = Number(argv[++index])
    else if (item === '--fail-on-missing') options.failOnMissing = true
    else if (item === '--no-fail-on-failed') options.failOnFailed = false
  }

  if (options.sourceIds.length === 0) delete options.sourceIds
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) options.timeoutMs = 10000
  return options
}

function exitCodeFor ({ report, options }) {
  if (options.failOnMissing && report.summary.blocked > 0) return 1
  if (options.failOnFailed !== false && report.summary.failed > 0) return 1
  return 0
}

if (require.main === module) {
  main()
    .then(result => {
      process.exitCode = result.exitCode
    })
    .catch(error => {
      console.error(error.message || error)
      process.exitCode = 1
    })
}

module.exports = {
  main,
  parseArgs,
  exitCodeFor
}
