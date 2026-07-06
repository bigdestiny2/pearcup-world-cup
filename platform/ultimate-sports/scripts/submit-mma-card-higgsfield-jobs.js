#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const {
  submitMmaCardHiggsfieldJobs
} = require('../src/mma-card-asset-engine')

async function main (argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv)
  const dryRun = options.live !== true
  const result = await submitMmaCardHiggsfieldJobs({
    fetchImpl: dependencies.fetchImpl || globalThis.fetch,
    dryRun,
    generatedAt: options.generatedAt,
    tournamentId: options.tournamentId || 'mma-card',
    title: options.title || 'MMA Fight Card',
    provider: 'higgsfield-api',
    outputRoot: options.outputRoot || 'platform/ultimate-sports/generated-assets/mma-card',
    apiBaseUrl: options.apiBaseUrl,
    createPath: options.createPath,
    limit: options.limit,
    env: dependencies.env || process.env
  })
  const output = JSON.stringify(result, null, 2)

  if (options.json) {
    const outPath = path.resolve(options.json)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, `${output}\n`)
    process.stdout.write(`${outPath}\n`)
    return result
  }

  process.stdout.write(`${output}\n`)
  return result
}

function parseArgs (argv) {
  const options = {
    live: false,
    generatedAt: new Date().toISOString(),
    limit: null
  }
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--json') options.json = argv[++index]
    else if (item === '--title') options.title = argv[++index]
    else if (item === '--tournament-id') options.tournamentId = argv[++index]
    else if (item === '--output-root') options.outputRoot = argv[++index]
    else if (item === '--api-base-url') options.apiBaseUrl = argv[++index]
    else if (item === '--create-path') options.createPath = argv[++index]
    else if (item === '--generated-at') options.generatedAt = argv[++index]
    else if (item === '--limit') options.limit = Number.parseInt(argv[++index], 10)
    else if (item === '--live') options.live = true
    else if (item === '--dry-run') options.live = false
  }
  return options
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message)
    process.exit(1)
  })
}

module.exports = {
  main,
  parseArgs
}
