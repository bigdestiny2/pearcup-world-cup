#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const receiptPath = resolve(args.receipt || join(root, '.pearcup-release', 'latest', 'pearcup-release-receipt.json'))
const errors = []

if (args.forwarded.some(arg => arg === '--publish-result' || arg.startsWith('--publish-result='))) {
  errors.push('latest friend-test recorder supplies --publish-result from the release receipt')
}
if (args.forwarded.some(arg => arg === '--sha' || arg.startsWith('--sha='))) {
  errors.push('latest friend-test recorder supplies --sha from the release receipt')
}
if (!existsSync(receiptPath)) errors.push(`latest release receipt does not exist: ${receiptPath}`)

const receipt = errors.length === 0 ? readReceipt(receiptPath) : null
const bundleSha256 = receipt && String(receipt.bundleSha256 || '')
const publishResultPath = receipt &&
  receipt.postPublishVerification &&
  receipt.postPublishVerification.resultPath
  ? resolve(receipt.postPublishVerification.resultPath)
  : ''
const publishResult = errors.length === 0 && publishResultPath && existsSync(publishResultPath)
  ? readJson(publishResultPath, 'latest publish result')
  : null

if (receipt && !/^[0-9a-f]{64}$/i.test(bundleSha256)) {
  errors.push('latest release receipt is missing a valid bundleSha256')
}
if (receipt) validateSourceGitReceipt(receipt)
if (receipt && !publishResultPath) {
  errors.push('latest release receipt is missing postPublishVerification.resultPath')
}
if (receipt && publishResultPath && !existsSync(publishResultPath)) {
  errors.push(`latest publish result does not exist: ${publishResultPath}`)
}
if (receipt && publishResult) validatePublishResultBinding(receipt, publishResult, publishResultPath)

if (errors.length > 0) {
  console.error('PearCup latest friend-test recorder refused:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const result = spawnSync(process.execPath, [
  join(root, 'scripts', 'record-friend-test-result.mjs'),
  '--publish-result',
  publishResultPath,
  '--sha',
  bundleSha256,
  ...args.forwarded
], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit'
})

if (result.error) throw result.error
process.exit(result.status == null ? 1 : result.status)

function readReceipt (filePath) {
  return readJson(filePath, 'latest release receipt')
}

function readJson (filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (err) {
    errors.push(`could not read ${label}: ${err.message}`)
    return null
  }
}

function validateSourceGitReceipt (receipt) {
  const sourceGitHead = String(receipt.sourceGitHead || '')
  if (!/^[0-9a-f]{40}$/i.test(sourceGitHead)) {
    errors.push('latest release receipt is missing sourceGitHead; regenerate the durable handoff')
    return
  }
  if (receipt.sourceDirty !== false) {
    errors.push('latest release receipt was generated from a dirty worktree; regenerate from a clean commit')
  }
  const currentHead = runGit(['rev-parse', 'HEAD'])
  if (!currentHead) return
  const normalizedCurrent = currentHead.trim().toLowerCase()
  if (normalizedCurrent && normalizedCurrent !== sourceGitHead.toLowerCase()) {
    errors.push(`latest release receipt sourceGitHead ${sourceGitHead} does not match current HEAD ${currentHead.trim()}`)
  }
}

function validatePublishResultBinding (receipt, publishResult, publishResultPath) {
  const publishReceiptPath = publishResult.receipt ? resolve(publishResult.receipt) : ''
  if (publishReceiptPath !== receiptPath) {
    errors.push(`latest publish result receipt ${publishResult.receipt || '(missing)'} does not match latest release receipt ${receiptPath}`)
  }
  if (String(publishResult.bundleSha256 || '').toLowerCase() !== String(receipt.bundleSha256 || '').toLowerCase()) {
    errors.push(`latest publish result bundleSha256 ${publishResult.bundleSha256 || '(missing)'} does not match latest release receipt bundleSha256 ${receipt.bundleSha256 || '(missing)'}`)
  }
  if (String(publishResult.sourceGitHead || '').toLowerCase() !== String(receipt.sourceGitHead || '').toLowerCase()) {
    errors.push(`latest publish result sourceGitHead ${publishResult.sourceGitHead || '(missing)'} does not match release receipt sourceGitHead ${receipt.sourceGitHead || '(missing)'}`)
  }
  if (publishResult.sourceDirty !== false) {
    errors.push('latest publish result was not created from a clean source release receipt')
  }
  const expectedResultPath = receipt &&
    receipt.postPublishVerification &&
    receipt.postPublishVerification.resultPath
    ? resolve(receipt.postPublishVerification.resultPath)
    : ''
  if (expectedResultPath && expectedResultPath !== publishResultPath) {
    errors.push('latest publish result path does not match latest release receipt postPublishVerification.resultPath')
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
    return ''
  }
  return result.stdout
}

function parseArgs (argv) {
  const parsed = { receipt: '', forwarded: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--receipt') parsed.receipt = argv[++i]
    else if (arg.startsWith('--receipt=')) parsed.receipt = arg.slice('--receipt='.length)
    else parsed.forwarded.push(arg)
  }
  return parsed
}
