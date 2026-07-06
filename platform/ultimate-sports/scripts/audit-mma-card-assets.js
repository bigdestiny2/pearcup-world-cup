#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createMmaCardGeneratedAssetAudit } = require('../src/mma-card-asset-engine')

function main (argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const outDir = path.resolve(options.outDir || 'platform/ultimate-sports/generated-reports')
  const jsonPath = path.resolve(options.json || path.join(outDir, 'mma-card-generated-assets.json'))
  const audit = createMmaCardGeneratedAssetAudit({
    generatedAt: options.generatedAt,
    tournamentId: options.tournamentId || 'mma-card',
    title: options.title || 'MMA Fight Card',
    provider: options.provider || 'higgsfield-api',
    outputRoot: options.outputRoot || 'platform/ultimate-sports/generated-assets/mma-card'
  })

  fs.mkdirSync(path.dirname(jsonPath), { recursive: true })
  fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`)

  process.stdout.write(`MMA card generated asset audit: ${audit.overallStatus}\n`)
  process.stdout.write(`JSON: ${jsonPath}\n`)
  process.stdout.write(`Targets: ${audit.summary.presentTargets}/${audit.summary.targetCount}\n`)
  process.stdout.write(`Assets: ${audit.summary.generatedAssets}/${audit.summary.assetCount}\n`)

  if (audit.summary.missingTargets > 0 && options.failOnMissing) {
    process.exitCode = 1
  }

  return audit
}

function parseArgs (argv = process.argv.slice(2)) {
  const options = {
    failOnMissing: false
  }
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--out-dir') options.outDir = argv[++index]
    else if (item === '--json') options.json = argv[++index]
    else if (item === '--generated-at') options.generatedAt = argv[++index]
    else if (item === '--title') options.title = argv[++index]
    else if (item === '--tournament-id') options.tournamentId = argv[++index]
    else if (item === '--provider') options.provider = argv[++index]
    else if (item === '--output-root') options.outputRoot = argv[++index]
    else if (item === '--fail-on-missing') options.failOnMissing = true
  }
  return options
}

if (require.main === module) main()

module.exports = {
  main,
  parseArgs
}
