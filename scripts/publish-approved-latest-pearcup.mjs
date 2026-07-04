#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const receiptPath = resolve(args.receipt || join(root, '.pearcup-release', 'latest', 'pearcup-release-receipt.json'))
const publishGateway = gatewayFromForwarded(args.forwarded) || normalizeGateway(process.env.PEARCUP_PEARBROWSER_GATEWAY || detectPearBrowserGateway())
const forwardedArgs = withDefaultGateway(args.forwarded, publishGateway)
const errors = []
let currentGitState = null

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
  const alternate = findAlternateReadyRelease(currentGitState || readCurrentGitState({ quiet: true }))
  if (alternate) {
    console.error(`clean release checkout - ${alternate.worktree}`)
    console.error(`clean release receipt - ${alternate.receipt}`)
    console.error(`next - cd ${JSON.stringify(alternate.worktree)} && ${approvedLatestPublishCommand(publishGateway)}`)
  }
  process.exit(1)
}

const resolvedArgs = [
  join(root, 'scripts', 'publish-approved-pearcup.mjs'),
  '--receipt',
  receiptPath,
  '--sha',
  bundleSha256,
  ...forwardedArgs
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
  currentGitState = current
  if (!current) return
  if (current.head && current.head.toLowerCase() !== sourceGitHead.toLowerCase()) {
    errors.push(`latest release receipt sourceGitHead ${sourceGitHead} does not match current HEAD ${current.head}`)
  }
  if (opts.requireCleanCurrent && current.status.length > 0) {
    errors.push(`current git worktree is dirty; commit changes and regenerate the latest handoff before publishing (${current.status.length} path${current.status.length === 1 ? '' : 's'})`)
  }
}

function readCurrentGitState (opts = {}) {
  const head = runGit(['rev-parse', 'HEAD'], root, opts)
  const status = runGit(['status', '--short'], root, opts)
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
    const alternateGitState = readGitState(worktreePath)
    if (!alternateGitState) continue
    const issue = releaseIssueFor(alternateReceipt, alternateGitState)
    if (issue) continue
    return {
      worktree: worktreePath,
      receipt: alternateReceiptPath,
      bundleSha256: alternateReceipt.bundleSha256,
      sourceGitHead: alternateReceipt.sourceGitHead
    }
  }
  return null
}

function readGitState (cwd) {
  const head = runGit(['rev-parse', 'HEAD'], cwd, { quiet: true })
  const status = runGit(['status', '--short'], cwd, { quiet: true })
  if (head == null || status == null) return null
  return {
    head: head.trim(),
    status: status.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  }
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

function approvedLatestPublishCommand (gateway) {
  const command = 'npm run publish:approved:latest -- --publish'
  return gateway ? `${command} --gateway ${gateway}` : `${command} --gateway http://127.0.0.1:<PearBrowser-gateway-port>/`
}

function withDefaultGateway (forwarded, gateway) {
  if (!gateway || gatewayFromForwarded(forwarded)) return forwarded
  return [...forwarded, '--gateway', gateway]
}

function gatewayFromForwarded (forwarded) {
  for (let i = 0; i < forwarded.length; i++) {
    const arg = forwarded[i]
    if (arg === '--gateway') return normalizeGateway(forwarded[i + 1])
    if (arg.startsWith('--gateway=')) return normalizeGateway(arg.slice('--gateway='.length))
  }
  return ''
}

function detectPearBrowserGateway () {
  const result = spawnSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], {
    encoding: 'utf8'
  })
  if (result.status !== 0) return ''
  const lines = String(result.stdout || '').split(/\r?\n/)
  for (const line of lines) {
    if (!/\bPearBrows\b/.test(line)) continue
    const match = line.match(/TCP\s+127\.0\.0\.1:(\d+)\s+\(LISTEN\)/)
    if (match && match[1] !== '4190') return `http://127.0.0.1:${match[1]}/`
  }
  return ''
}

function normalizeGateway (value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    if (url.port === '4190') return ''
    if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`
    return url.href
  } catch (err) {
    return ''
  }
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
