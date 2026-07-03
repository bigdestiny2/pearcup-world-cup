#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const receiptPath = resolve(args.receipt || join(root, '.pearcup-release', 'latest', 'pearcup-release-receipt.json'))
const errors = []

if (args.forwarded.some(arg => arg === '--receipt' || arg.startsWith('--receipt='))) {
  errors.push('latest approved publish supplies --receipt from the durable handoff')
}
if (args.forwarded.some(arg => arg === '--sha' || arg.startsWith('--sha='))) {
  errors.push('latest approved publish supplies --sha from the durable handoff receipt')
}
if (!existsSync(receiptPath)) errors.push(`latest release receipt does not exist: ${receiptPath}`)

const receipt = errors.length === 0 ? readReceipt(receiptPath) : null
const bundleSha256 = receipt && String(receipt.bundleSha256 || '')
if (receipt && !/^[0-9a-f]{64}$/i.test(bundleSha256)) {
  errors.push('latest release receipt is missing a valid bundleSha256')
}
if (receipt) validateSourceGitReceipt(receipt, { requireCleanCurrent: !args.printResolved })

if (errors.length > 0) {
  console.error('PearCup latest approved publish refused:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const resolvedArgs = [
  join(root, 'scripts', 'publish-approved-pearcup.mjs'),
  '--receipt',
  receiptPath,
  '--sha',
  bundleSha256,
  ...args.forwarded
]

if (args.printResolved) {
  console.log(`node ${resolvedArgs.map(arg => JSON.stringify(arg)).join(' ')}`)
  process.exit(0)
}

const result = spawnSync(process.execPath, resolvedArgs, {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit'
})

if (result.error) throw result.error
process.exit(result.status == null ? 1 : result.status)

function readReceipt (filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (err) {
    errors.push(`could not read latest release receipt: ${err.message}`)
    return null
  }
}

function validateSourceGitReceipt (receipt, opts = {}) {
  const sourceGitHead = String(receipt.sourceGitHead || '')
  if (!/^[0-9a-f]{40}$/i.test(sourceGitHead)) {
    errors.push('latest release receipt is missing sourceGitHead; regenerate the durable handoff')
    return
  }
  if (receipt.sourceDirty !== false) {
    errors.push('latest release receipt was generated from a dirty worktree; regenerate from a clean commit')
  }
  const current = readCurrentGitState()
  if (!current) return
  if (current.head && current.head.toLowerCase() !== sourceGitHead.toLowerCase()) {
    errors.push(`latest release receipt sourceGitHead ${sourceGitHead} does not match current HEAD ${current.head}`)
  }
  if (opts.requireCleanCurrent && current.status.length > 0) {
    errors.push(`current git worktree is dirty; commit changes and regenerate the latest handoff before publishing (${current.status.length} path${current.status.length === 1 ? '' : 's'})`)
  }
}

function readCurrentGitState () {
  const head = runGit(['rev-parse', 'HEAD'])
  const status = runGit(['status', '--short'])
  if (head == null || status == null) return null
  return {
    head: head.trim(),
    status: status.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  }
}

function runGit (gitArgs) {
  const result = spawnSync('git', gitArgs, {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    errors.push(`git ${gitArgs.join(' ')} failed${detail ? `: ${detail}` : ''}`)
    return null
  }
  return result.stdout
}

function parseArgs (argv) {
  const parsed = { receipt: '', forwarded: [], printResolved: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--latest-receipt') parsed.receipt = argv[++i]
    else if (arg.startsWith('--latest-receipt=')) parsed.receipt = arg.slice('--latest-receipt='.length)
    else if (arg === '--print-resolved') parsed.printResolved = true
    else parsed.forwarded.push(arg)
  }
  return parsed
}
