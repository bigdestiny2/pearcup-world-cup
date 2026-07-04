#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const receiptPath = resolve(args.receipt || join(root, '.pearcup-release', 'latest', 'pearcup-release-receipt.json'))
const errors = []
let currentGitState = null

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
  const alternate = findAlternateReadyRelease(currentGitState || readCurrentGitState({ quiet: true }))
  if (alternate) {
    console.error(`clean release checkout - ${alternate.worktree}`)
    console.error(`clean release receipt - ${alternate.receipt}`)
    if (alternate.publishResultExists) {
      const forwarded = args.forwarded.map(arg => JSON.stringify(arg)).join(' ')
      console.error(`next - cd ${JSON.stringify(alternate.worktree)} && npm run record:friend-test:latest --${forwarded ? ` ${forwarded}` : ''}`)
    } else {
      console.error(`next - publish from the clean checkout first: cd ${JSON.stringify(alternate.worktree)} && npm run publish:approved:latest -- --publish`)
    }
  }
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
  const current = readCurrentGitState()
  currentGitState = current
  if (!current) return
  const normalizedCurrent = current.head.toLowerCase()
  if (normalizedCurrent && normalizedCurrent !== sourceGitHead.toLowerCase()) {
    errors.push(`latest release receipt sourceGitHead ${sourceGitHead} does not match current HEAD ${current.head}`)
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

function readCurrentGitState (opts = {}) {
  return readGitState(root, opts)
}

function readGitState (cwd, opts = {}) {
  const head = runGit(['rev-parse', 'HEAD'], cwd, opts)
  const status = runGit(['status', '--short'], cwd, opts)
  if (head == null || status == null) return null
  return {
    head: head.trim(),
    status: status.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  }
}

function runGit (gitArgs, cwd = root, opts = {}) {
  const result = spawnSync('git', gitArgs, {
    cwd,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    if (!opts.quiet) errors.push(`git ${gitArgs.join(' ')} failed${detail ? `: ${detail}` : ''}`)
    return null
  }
  return result.stdout
}

function findAlternateReadyRelease (current) {
  if (!current || !current.head) return null
  const worktrees = readGitWorktrees()
  for (const worktree of worktrees) {
    const worktreePath = resolve(worktree.path || '')
    if (!worktreePath || worktreePath === root) continue
    if (worktree.head && worktree.head.toLowerCase() !== current.head.toLowerCase()) continue
    const alternateReceiptPath = join(worktreePath, '.pearcup-release', 'latest', 'pearcup-release-receipt.json')
    const alternateReceipt = readJsonOptional(alternateReceiptPath)
    if (!alternateReceipt) continue
    const alternateGitState = readGitState(worktreePath, { quiet: true })
    if (!alternateGitState) continue
    const issue = releaseIssueFor(alternateReceipt, alternateGitState)
    if (issue) continue
    const alternatePublishResultPath = alternateReceipt.postPublishVerification && alternateReceipt.postPublishVerification.resultPath
      ? resolve(alternateReceipt.postPublishVerification.resultPath)
      : ''
    return {
      worktree: worktreePath,
      receipt: alternateReceiptPath,
      bundleSha256: alternateReceipt.bundleSha256,
      sourceGitHead: alternateReceipt.sourceGitHead,
      publishResultExists: Boolean(alternatePublishResultPath && existsSync(alternatePublishResultPath))
    }
  }
  return null
}

function releaseIssueFor (receipt, gitState) {
  if (receipt.app !== 'PearCup') return 'release receipt app is not PearCup'
  if (!/^[0-9a-f]{40}$/i.test(String(receipt.sourceGitHead || ''))) return 'release receipt is missing sourceGitHead'
  if (receipt.sourceDirty !== false) return 'release receipt was generated from a dirty worktree'
  if (!/^[0-9a-f]{64}$/i.test(String(receipt.bundleSha256 || ''))) return 'release receipt is missing bundleSha256'
  if (gitState.head && gitState.head.toLowerCase() !== String(receipt.sourceGitHead).toLowerCase()) return `current HEAD ${gitState.head} does not match receipt ${receipt.sourceGitHead}`
  if (gitState.status.length > 0) return `current worktree has ${gitState.status.length} dirty path${gitState.status.length === 1 ? '' : 's'}`
  if (!receipt.postPublishVerification || !receipt.postPublishVerification.resultPath) return 'release receipt is missing postPublishVerification.resultPath'
  return ''
}

function readGitWorktrees () {
  const raw = runGit(['worktree', 'list', '--porcelain'], root, { quiet: true })
  if (raw == null) return []
  const worktrees = []
  let currentEntry = null
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue
    if (line.startsWith('worktree ')) {
      if (currentEntry) worktrees.push(currentEntry)
      currentEntry = { path: line.slice('worktree '.length), head: '' }
    } else if (currentEntry && line.startsWith('HEAD ')) {
      currentEntry.head = line.slice('HEAD '.length)
    }
  }
  if (currentEntry) worktrees.push(currentEntry)
  return worktrees
}

function readJsonOptional (filePath) {
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (err) {
    return null
  }
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
