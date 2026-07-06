#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createMmaCardAssetPlan } = require('../src/mma-card-asset-engine')

function main (argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const plan = createMmaCardAssetPlan({
    tournamentId: options.tournamentId || 'mma-card',
    title: options.title || 'MMA Fight Card',
    provider: options.provider || 'higgsfield-api',
    outputRoot: options.outputRoot || 'platform/ultimate-sports/generated-assets/mma-card'
  })
  const output = JSON.stringify(plan, null, 2)

  if (options.out) {
    const outPath = path.resolve(options.out)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, `${output}\n`)
    process.stdout.write(`${outPath}\n`)
    return
  }
  process.stdout.write(`${output}\n`)
}

function parseArgs (argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--out') options.out = argv[++index]
    else if (item === '--title') options.title = argv[++index]
    else if (item === '--tournament-id') options.tournamentId = argv[++index]
    else if (item === '--provider') options.provider = argv[++index]
    else if (item === '--output-root') options.outputRoot = argv[++index]
  }
  return options
}

if (require.main === module) main()

module.exports = {
  main,
  parseArgs
}
