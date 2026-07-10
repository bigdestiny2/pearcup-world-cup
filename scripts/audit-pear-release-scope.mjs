#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const errors = []

if (!args.receipt) errors.push('missing --receipt <pearcup-release-receipt.json>')
const receiptPath = args.receipt ? resolve(args.receipt) : ''
const receipt = receiptPath && existsSync(receiptPath) ? readReceipt(receiptPath) : null
if (receiptPath && !receipt) errors.push(`receipt does not exist or is unreadable: ${receiptPath}`)

const dirty = readDirtyPaths()
const report = receipt ? buildReport(receipt, dirty) : null

if (report && args.requireClean && report.totalDirty > 0) {
  errors.push(`git worktree is not clean: ${report.totalDirty} dirty paths`)
}

if (errors.length > 0) {
  console.error('PearCup release scope audit failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

if (args.json) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('PearCup release scope audit passed')
  console.log(`receipt - ${receiptPath}`)
  console.log(`bundle sha256 - ${report.bundleSha256}`)
  console.log(`dirty paths - ${report.totalDirty}`)
  for (const [label, count] of Object.entries(report.counts)) {
    console.log(`${label} - ${count}`)
  }
  if (report.excludedKawaiiDirty.length) {
    console.log(`excluded Kawaii/support dirty paths - ${report.excludedKawaiiDirty.join(', ')}`)
  }
  console.log('note - shipped Kawaii dirty paths are included in the checked PearBrowser bundle inventory')
}

function buildReport (receipt, dirty) {
  const bundleFiles = new Set((receipt.files || []).map(file => String(file.path || '').replace(/^\/+/, '')))
  const shippedKawaiiDirty = []
  const excludedKawaiiDirty = []
  const releaseScriptDirty = []
  const rootDirty = []
  const otherDirty = []

  for (const item of dirty) {
    const path = item.path
    if (path.startsWith('app/')) {
      const relative = path.slice('app/'.length)
      if (bundleFiles.has(relative)) shippedKawaiiDirty.push(path)
      else excludedKawaiiDirty.push(path)
    } else if (path.startsWith('scripts/') || path === 'package.json' || path === 'package-lock.json') {
      releaseScriptDirty.push(path)
    } else if (['README.md', 'CONTRIBUTING.md', 'CLAUDE.md'].includes(path) || path.startsWith('docs/')) {
      rootDirty.push(path)
    } else {
      otherDirty.push(path)
    }
  }

  return {
    receipt: receiptPath,
    bundle: receipt.bundle || '',
    bundleSha256: receipt.bundleSha256 || '',
    totalDirty: dirty.length,
    counts: {
      shippedKawaiiDirty: shippedKawaiiDirty.length,
      excludedKawaiiDirty: excludedKawaiiDirty.length,
      releaseScriptDirty: releaseScriptDirty.length,
      rootDirty: rootDirty.length,
      otherDirty: otherDirty.length
    },
    shippedKawaiiDirty,
    excludedKawaiiDirty,
    releaseScriptDirty,
    rootDirty,
    otherDirty
  }
}

function readDirtyPaths () {
  const result = spawnSync('git', ['status', '--porcelain=v1'], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    errors.push(`git status failed${detail ? `:\n${detail}` : ''}`)
    return []
  }
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      const status = line.slice(0, 2)
      let path = line.slice(3)
      const renameIndex = path.indexOf(' -> ')
      if (renameIndex >= 0) path = path.slice(renameIndex + 4)
      return { status, path }
    })
}

function readReceipt (filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (err) {
    errors.push(`could not read receipt: ${err.message}`)
    return null
  }
}

function parseArgs (argv) {
  const parsed = { json: false, requireClean: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--receipt') parsed.receipt = argv[++i]
    else if (arg.startsWith('--receipt=')) parsed.receipt = arg.slice('--receipt='.length)
    else if (arg === '--json') parsed.json = true
    else if (arg === '--require-clean') parsed.requireClean = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return parsed
}
