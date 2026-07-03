#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const checks = []
const notes = []
const errors = []

let receiptPath = ''
let bundlePath = ''
let bundleSha256 = ''
let publishedBrowserCommand = ''

if (args.full) runNpm('Full project check', ['run', 'check'])

if (errors.length === 0) {
  const handoff = runNode('PearBrowser publish handoff', 'scripts/check-pearbrowser-publish-handoff.mjs')
  if (handoff.ok) {
    receiptPath = extractLineValue(handoff.output, /^receipt - (.+)$/m)
    bundlePath = extractLineValue(handoff.output, /^bundle - (.+)$/m)
    bundleSha256 = extractLineValue(handoff.output, /^bundle sha256 - ([0-9a-f]{64})$/im)
    if (!receiptPath) errors.push('PearBrowser publish handoff did not print a receipt path')
    if (!bundlePath) errors.push('PearBrowser publish handoff did not print a bundle path')
    if (!bundleSha256) errors.push('PearBrowser publish handoff did not print a bundle SHA-256')
    if (receiptPath) publishedBrowserCommand = readPublishedBrowserCommand(receiptPath)
  }
}

if (errors.length === 0) {
  runNode('Approved publish dry-run for exact bundle', 'scripts/publish-approved-pearcup.mjs', [
    '--receipt',
    receiptPath,
    '--sha',
    bundleSha256,
    '--gateway',
    args.gateway,
    '--dry-run'
  ])
}

if (errors.length === 0) {
  runNode('Release scope audit', 'scripts/audit-pear-release-scope.mjs', ['--receipt', receiptPath])
}

if (errors.length === 0 && args.url) {
  runNode('Live preview URL readiness', 'scripts/check-friend-ready.mjs', ['--url', args.url])
}

checkWorktree()

if (errors.length > 0) {
  console.error('PearCup seamless readiness failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('PearCup seamless readiness passed')
  for (const check of checks) console.log(`ok - ${check}`)
  if (receiptPath) console.log(`receipt - ${receiptPath}`)
  if (bundlePath) console.log(`bundle - ${bundlePath}`)
  if (bundleSha256) console.log(`bundle sha256 - ${bundleSha256}`)
  if (publishedBrowserCommand) console.log(`published browser proof command - ${publishedBrowserCommand}`)
  if (args.url) console.log(`checked preview URL - ${args.url}`)
  for (const note of notes) console.log(`note - ${note}`)
  console.log('manual gate - publish/pin only after explicit approval of this exact bundle SHA')
  console.log('manual gate - remote friend opens the final PearBrowser link and completes a live P2P join')
}

function runNpm (label, npmArgs) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  return run(label, npm, npmArgs)
}

function runNode (label, script, scriptArgs = []) {
  return run(label, process.execPath, [join(root, script), ...scriptArgs])
}

function run (label, command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8'
  })
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
  if (result.error) {
    errors.push(`${label} failed: ${result.error.message}`)
    return { ok: false, output }
  }
  if (result.status !== 0) {
    errors.push(`${label} failed${output ? `:\n${output}` : ''}`)
    return { ok: false, output }
  }
  checks.push(label)
  return { ok: true, output }
}

function checkWorktree () {
  const result = spawnSync('git', ['status', '--short'], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.error || result.status !== 0) {
    notes.push('could not inspect git worktree status')
    return
  }
  const lines = result.stdout.trim().split('\n').filter(Boolean)
  if (lines.length === 0) {
    checks.push('Git worktree clean')
    return
  }
  const message = `git worktree has ${lines.length} uncommitted path${lines.length === 1 ? '' : 's'}`
  if (!args.allowDirty) errors.push(message)
  else notes.push(`${message}; --allow-dirty was used, so this is not a publish-ready proof`)
}

function extractLineValue (text, pattern) {
  const match = String(text || '').match(pattern)
  return match ? match[1].trim() : ''
}

function readPublishedBrowserCommand (filePath) {
  try {
    const receipt = JSON.parse(readFileSync(filePath, 'utf8'))
    return receipt &&
      receipt.verification &&
      receipt.verification.localPublishedBrowserContract &&
      receipt.verification.localPublishedBrowserContract.exactReceiptCommand
      ? String(receipt.verification.localPublishedBrowserContract.exactReceiptCommand)
      : ''
  } catch (err) {
    errors.push(`could not read published browser proof command from receipt: ${err.message}`)
    return ''
  }
}

function parseArgs (argv) {
  const parsed = {
    full: false,
    gateway: 'http://127.0.0.1:17208/',
    allowDirty: false,
    url: ''
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--full') parsed.full = true
    else if (arg === '--require-clean') parsed.allowDirty = false
    else if (arg === '--allow-dirty') parsed.allowDirty = true
    else if (arg === '--gateway') parsed.gateway = argv[++i]
    else if (arg.startsWith('--gateway=')) parsed.gateway = arg.slice('--gateway='.length)
    else if (arg === '--url') parsed.url = argv[++i]
    else if (arg.startsWith('--url=')) parsed.url = arg.slice('--url='.length)
    else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return parsed
}
