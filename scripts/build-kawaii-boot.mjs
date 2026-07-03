#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = join(root, 'design', 'kawaii-app')
const outPath = join(appRoot, 'pearcup-boot.js')
const args = new Set(process.argv.slice(2))

const sourceFiles = [
  'core.js',
  'adapters.js',
  'qvac-referee.js',
  'tether-wdk-bridge.js',
  'runtime-settings.js',
  'runtime-config.js',
  'settlement-receipts.js',
  'worker-sim.js',
  'storage-sim.js',
  'transport-sim.js',
  'worker-runtime.js',
  'settlement-service.js',
  'worker-client.js',
  'peer-net.js',
  'peer-match.js',
  'peer-lobby.js',
  'watch-sync.js',
  'app.js'
]

const bundle = buildBundle()

if (args.has('--check')) {
  let current = ''
  try {
    current = readFileSync(outPath, 'utf8')
  } catch (err) {
    console.error(`PearCup boot bundle check failed: ${err.message}`)
    process.exit(1)
  }
  if (current !== bundle) {
    console.error('PearCup boot bundle is stale; run `npm run build:kawaii-boot`.')
    process.exit(1)
  }
  console.log('PearCup boot bundle is current')
} else {
  writeFileSync(outPath, bundle)
  console.log(`PearCup boot bundle wrote ${outPath}`)
}

function buildBundle () {
  const header = [
    '// Generated PearCup renderer boot bundle.',
    `// Regenerate with: npm run build:kawaii-boot`,
    `// Sources: ${sourceFiles.map(file => `./${file}`).join(', ')}`,
    ''
  ].join('\n')

  return header + sourceFiles
    .map(file => {
      const source = readFileSync(join(appRoot, file), 'utf8')
      return `\n;/* source: ./${file} */\n${source}\n`
    })
    .join('\n')
}
