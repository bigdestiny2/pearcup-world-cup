#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const receiptPath = resolve(args.receipt || join(root, '.pearcup-release', 'latest', 'pearcup-release-receipt.json'))
const publishGateway = normalizeGateway(args.gateway || process.env.PEARCUP_PEARBROWSER_GATEWAY || detectPearBrowserGateway())
const errors = []
const warnings = []

const receipt = readJsonIfExists(receiptPath, 'latest release receipt')
const current = readCurrentGitState()
const release = inspectRelease(receipt, receiptPath, current)
const alternateReadyRelease = release.ready ? null : findAlternateReadyRelease(current)
const publishResultPath = release.publishResultPath || join(dirname(receiptPath), 'pearcup-publish-result.json')
const pearReleaseResultPath = resolve(args.pearReleaseResult || join(dirname(publishResultPath), 'pearcup-pear-release-result.json'))
const friendResultPath = join(dirname(publishResultPath), 'pearcup-friend-test-result.json')
const publish = inspectPublishResult(readJsonIfExists(publishResultPath, 'latest publish result', { optional: true }), publishResultPath, receipt, receiptPath)
const pearRelease = inspectPearReleaseResult(readJsonIfExists(pearReleaseResultPath, 'latest Pear runtime release result', { optional: true }), pearReleaseResultPath, receipt)
const friend = inspectFriendResult(readJsonIfExists(friendResultPath, 'latest friend-test result', { optional: true }), friendResultPath, publish, receipt)

const status = {
  app: 'PearCup',
  receipt: receiptPath,
  sourceGitHead: receipt && receipt.sourceGitHead || '',
  currentGitHead: current.head || '',
  sourceDirty: receipt ? receipt.sourceDirty : null,
  currentDirty: current.status.length > 0,
  bundleSha256: receipt && receipt.bundleSha256 || '',
  release,
  alternateReadyRelease,
  publish,
  pearRelease,
  friend,
  complete: release.ready && publish.ready && pearRelease.ready && friend.ready,
  exactPreviewCommand: exactPreviewCommandFor(receipt, receiptPath),
  publishGateway,
  next: nextStep(release, publish, pearRelease, friend, receipt, alternateReadyRelease, publishGateway)
}

if (args.json) {
  console.log(JSON.stringify(status, null, 2))
} else {
  printHuman(status)
}

if (args.requireComplete && !status.complete) process.exitCode = 1
else if (args.requirePublished && !publish.ready) process.exitCode = 1
else if (errors.length > 0) process.exitCode = 1

function inspectRelease (receipt, filePath, gitState) {
  const result = {
    ready: false,
    exists: Boolean(receipt),
    path: filePath,
    issue: '',
    publishResultPath: ''
  }
  if (!receipt) {
    result.issue = `missing release receipt: ${filePath}`
    errors.push(result.issue)
    return result
  }
  result.publishResultPath = receipt.postPublishVerification && receipt.postPublishVerification.resultPath
    ? resolve(receipt.postPublishVerification.resultPath)
    : ''
  if (receipt.app !== 'PearCup') result.issue = 'release receipt app is not PearCup'
  else if (!/^[0-9a-f]{40}$/i.test(String(receipt.sourceGitHead || ''))) result.issue = 'release receipt is missing sourceGitHead'
  else if (receipt.sourceDirty !== false) result.issue = 'release receipt was generated from a dirty worktree'
  else if (!/^[0-9a-f]{64}$/i.test(String(receipt.bundleSha256 || ''))) result.issue = 'release receipt is missing bundleSha256'
  else if (gitState.head && gitState.head.toLowerCase() !== String(receipt.sourceGitHead).toLowerCase()) result.issue = `current HEAD ${gitState.head} does not match receipt ${receipt.sourceGitHead}`
  else if (gitState.status.length > 0) result.issue = `current worktree has ${gitState.status.length} dirty path${gitState.status.length === 1 ? '' : 's'}`
  else if (!result.publishResultPath) result.issue = 'release receipt is missing postPublishVerification.resultPath'

  result.ready = !result.issue
  if (result.issue) errors.push(result.issue)
  return result
}

function inspectPublishResult (result, filePath, receipt, receiptPath) {
  const status = {
    ready: false,
    exists: Boolean(result),
    path: filePath,
    publishedUrl: result && result.publishedUrl || '',
    driveKey: result && result.driveKey || '',
    issue: '',
    result
  }
  if (!result) {
    status.issue = `publish result missing: ${filePath}`
    return status
  }
  const publishedDrive = (String(result.publishedUrl || '').match(/^hyper:\/\/([0-9a-f]{64})\//i) || [])[1] || ''
  const expectedReceipt = receiptPath ? resolve(receiptPath) : ''
  const actualReceipt = result.receipt ? resolve(result.receipt) : ''
  if (result.app !== 'PearCup') status.issue = 'publish result app is not PearCup'
  else if (result.status !== 'published-and-smoked') status.issue = 'publish result status is not published-and-smoked'
  else if (receipt && String(result.bundleSha256 || '').toLowerCase() !== String(receipt.bundleSha256 || '').toLowerCase()) status.issue = 'publish result bundle SHA does not match latest receipt'
  else if (receipt && String(result.sourceGitHead || '').toLowerCase() !== String(receipt.sourceGitHead || '').toLowerCase()) status.issue = 'publish result source commit does not match latest receipt'
  else if (result.sourceDirty !== false) status.issue = 'publish result was not generated from a clean release receipt'
  else if (expectedReceipt && actualReceipt !== expectedReceipt) status.issue = 'publish result receipt path does not match latest receipt'
  else if (!publishedDrive) status.issue = 'publish result is missing a hyper:// publishedUrl'
  else if (String(result.driveKey || '').toLowerCase() !== publishedDrive.toLowerCase()) status.issue = 'publish result driveKey does not match publishedUrl'
  else if (!String(result.approvedPublishCommand || '').includes('publish-approved-pearcup.mjs')) status.issue = 'publish result was not created through the approved wrapper'
  else if (!result.evidence || result.evidence.exactBundlePublishedGatewayPreflight !== true) status.issue = 'publish result is missing exact-bundle gateway proof'
  else if (result.evidence.exactBundlePearRuntimePreflight !== true) status.issue = 'publish result is missing exact-bundle Pear runtime proof'
  else if (result.evidence.postPublishSmokePassed !== true) status.issue = 'publish result is missing post-publish smoke proof'

  status.ready = !status.issue
  if (status.issue) warnings.push(status.issue)
  return status
}

function inspectPearReleaseResult (result, filePath, receipt) {
  const status = {
    ready: false,
    exists: Boolean(result),
    path: filePath,
    pearUrl: result && result.pearUrl || '',
    release: result && result.release || null,
    issue: '',
    result
  }
  if (!result) {
    status.issue = `Pear runtime release result missing: ${filePath}`
    return status
  }
  const evidence = result.evidence || {}
  if (result.app !== 'PearCup') status.issue = 'Pear runtime release result app is not PearCup'
  else if (result.status !== 'pear-runtime-released-and-smoked') status.issue = 'Pear runtime release status is not pear-runtime-released-and-smoked'
  else if (receipt && String(result.sourceGitHead || '').toLowerCase() !== String(receipt.sourceGitHead || '').toLowerCase()) status.issue = 'Pear runtime release source commit does not match latest receipt'
  else if (result.sourceDirty !== false) status.issue = 'Pear runtime release was not generated from a clean source'
  else if (!/^pear:\/\/[a-z0-9]+$/i.test(String(result.pearUrl || ''))) status.issue = 'Pear runtime release is missing a pear:// URL'
  else if (!Number.isInteger(Number(result.release)) || Number(result.release) < 0) status.issue = 'Pear runtime release is missing a release checkout'
  else if (evidence.releasePassed !== true) status.issue = 'Pear runtime release is missing release proof'
  else if (evidence.seedAnnounced !== true) status.issue = 'Pear runtime release is missing seed proof'
  else if (evidence.publicPearRunSmokePassed !== true) status.issue = 'Pear runtime release is missing public pear run smoke proof'

  status.ready = !status.issue
  if (status.issue) warnings.push(status.issue)
  return status
}

function inspectFriendResult (result, filePath, publishResult, receipt) {
  const status = {
    ready: false,
    exists: Boolean(result),
    path: filePath,
    friend: result && result.friend || '',
    roomCode: result && result.evidence && result.evidence.observedRoomCode || '',
    issue: ''
  }
  if (!result) {
    status.issue = `friend-test result missing: ${filePath}`
    return status
  }
  const evidence = result.evidence || {}
  const expectedPublishPath = publishResult ? resolve(publishResult.path || '') : ''
  const actualPublishPath = result.publishResult ? resolve(result.publishResult) : ''
  if (result.app !== 'PearCup') status.issue = 'friend-test result app is not PearCup'
  else if (result.status !== 'remote-friend-verified') status.issue = 'friend-test result is not remote-friend-verified'
  else if (receipt && String(result.bundleSha256 || '').toLowerCase() !== String(receipt.bundleSha256 || '').toLowerCase()) status.issue = 'friend-test result bundle SHA does not match latest receipt'
  else if (expectedPublishPath && actualPublishPath !== expectedPublishPath) status.issue = 'friend-test result publish-result path does not match latest publish result'
  else if (evidence.friendOpenedFinalPublicLink !== true && evidence.friendOpenedFinalPearBrowserLink !== true) status.issue = 'friend did not record opening the final public link'
  else if (evidence.friendReachedGamesWithoutFallbackOrBootError !== true) status.issue = 'friend did not record reaching Games without boot/fallback error'
  else if (evidence.hostAndFriendCompletedLiveP2PJoin !== true) status.issue = 'friend did not record a completed live P2P join'
  else if (evidence.hostAndFriendStartedPenaltyClash !== true) status.issue = 'friend did not record starting Penalty Clash'
  else if (!String(evidence.observedRoomCode || '')) status.issue = 'friend-test result is missing observed room code'

  status.ready = !status.issue
  if (status.issue) warnings.push(status.issue)
  return status
}

function nextStep (release, publish, pearRelease, friend, receipt, alternateReadyRelease, gateway) {
  if (!release.ready) {
    if (alternateReadyRelease) {
      return `Use clean release checkout ${alternateReadyRelease.worktree}; after explicit approval of SHA ${alternateReadyRelease.bundleSha256}, run: cd ${JSON.stringify(alternateReadyRelease.worktree)} && ${approvedLatestPublishCommand(gateway)}`
    }
    return 'Regenerate the latest release handoff from a clean commit.'
  }
  if (!publish.ready) return `After explicit approval of SHA ${receipt.bundleSha256}, run: ${approvedLatestPublishCommand(gateway)}`
  if (!pearRelease.ready) return 'Release the same clean checkout to the Pear runtime lane, keep pear seed running, smoke the public pear:// link, then write .pearcup-release/latest/pearcup-pear-release-result.json.'
  if (!friend.ready) return 'Have the remote friend open the final public link, join P2P, start Penalty Clash, then run: npm run record:friend-test:latest -- --friend "<friend-name>" --room-code "<observed-room-code>" --friend-opened --reached-games --joined-p2p --started-penalty-clash --notes "<what both sides observed>"'
  return 'Launch complete: latest bundle is published and remote-friend verified.'
}

function approvedLatestPublishCommand (gateway) {
  const command = 'npm run publish:approved:latest -- --publish'
  return gateway ? `${command} --gateway ${gateway}` : `${command} --gateway http://127.0.0.1:<PearBrowser-gateway-port>/`
}

function printHuman (status) {
  console.log('PearCup launch status')
  console.log(`release - ${status.release.ready ? 'ready' : 'not ready'}${status.release.issue ? ` (${status.release.issue})` : ''}`)
  console.log(`publish - ${status.publish.ready ? 'published and smoked' : 'not published'}${status.publish.issue ? ` (${status.publish.issue})` : ''}`)
  console.log(`pear runtime - ${status.pearRelease.ready ? 'released and smoked' : 'not released'}${status.pearRelease.issue ? ` (${status.pearRelease.issue})` : ''}`)
  console.log(`friend - ${status.friend.ready ? 'remote verified' : 'not verified'}${status.friend.issue ? ` (${status.friend.issue})` : ''}`)
  console.log(`bundle sha256 - ${status.bundleSha256 || '(missing)'}`)
  console.log(`source git head - ${status.sourceGitHead || '(missing)'}`)
  if (status.alternateReadyRelease) {
    console.log(`clean release checkout - ${status.alternateReadyRelease.worktree}`)
    console.log(`clean release receipt - ${status.alternateReadyRelease.receipt}`)
    if (status.alternateReadyRelease.exactPreviewCommand) {
      console.log(`exact preview - cd ${JSON.stringify(status.alternateReadyRelease.worktree)} && ${status.alternateReadyRelease.exactPreviewCommand}`)
    }
  }
  if (!status.alternateReadyRelease && status.exactPreviewCommand) console.log(`exact preview - ${status.exactPreviewCommand}`)
  if (status.publish.publishedUrl) console.log(`published url - ${status.publish.publishedUrl}`)
  if (status.pearRelease.pearUrl) console.log(`pear url - ${status.pearRelease.pearUrl}`)
  if (status.pearRelease.release != null) console.log(`pear release - ${status.pearRelease.release}`)
  if (status.friend.roomCode) console.log(`friend room code - ${status.friend.roomCode}`)
  if (warnings.length > 0) for (const warning of warnings) console.log(`warning - ${warning}`)
  console.log(`next - ${status.next}`)
}

function readJsonIfExists (filePath, label, opts = {}) {
  if (!existsSync(filePath)) {
    if (!opts.optional) errors.push(`${label} does not exist: ${filePath}`)
    return null
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (err) {
    errors.push(`could not read ${label}: ${err.message}`)
    return null
  }
}

function readCurrentGitState () {
  if (process.env.PEARCUP_LAUNCH_STATUS_CURRENT_HEAD || process.env.PEARCUP_LAUNCH_STATUS_CURRENT_STATUS != null) {
    return {
      head: process.env.PEARCUP_LAUNCH_STATUS_CURRENT_HEAD || runGit(['rev-parse', 'HEAD']).trim(),
      status: parseGitStatus(process.env.PEARCUP_LAUNCH_STATUS_CURRENT_STATUS || '')
    }
  }
  return readGitState(root)
}

function readGitState (cwd) {
  const head = runGit(['rev-parse', 'HEAD'], cwd).trim()
  const status = parseGitStatus(runGit(['status', '--short'], cwd))
  return { head, status }
}

function parseGitStatus (text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

function runGit (gitArgs, cwd = root) {
  const result = spawnSync('git', gitArgs, {
    cwd,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    errors.push(`git ${gitArgs.join(' ')} failed${detail ? `: ${detail}` : ''}`)
    return ''
  }
  return result.stdout
}

function findAlternateReadyRelease (current) {
  if (!current.head) return null
  const worktrees = readGitWorktrees()
  for (const worktree of worktrees) {
    const worktreePath = resolve(worktree.path || '')
    if (!worktreePath || worktreePath === root) continue
    if (worktree.head && worktree.head.toLowerCase() !== current.head.toLowerCase()) continue
    const alternateReceiptPath = join(worktreePath, '.pearcup-release', 'latest', 'pearcup-release-receipt.json')
    const alternateReceipt = readJsonOptional(alternateReceiptPath)
    if (!alternateReceipt) continue
    const alternateGitState = readGitState(worktreePath)
    const issue = releaseIssueFor(alternateReceipt, alternateGitState)
    if (issue) continue
    return {
      worktree: worktreePath,
      receipt: alternateReceiptPath,
      exactPreviewCommand: exactPreviewCommandFor(alternateReceipt, alternateReceiptPath),
      bundleSha256: alternateReceipt.bundleSha256,
      sourceGitHead: alternateReceipt.sourceGitHead
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
  const raw = runGit(['worktree', 'list', '--porcelain'])
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

function exactPreviewCommandFor (receipt, filePath) {
  const command = receipt &&
    receipt.verification &&
    receipt.verification.exactReleasePreviewContract &&
    receipt.verification.exactReleasePreviewContract.exactReceiptCommand
  if (command) return String(command)
  if (!receipt || !receipt.bundleSha256) return ''
  return `node scripts/serve-latest-pearbrowser-preview.mjs --receipt ${JSON.stringify(resolve(filePath))} --port 4186`
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
  const parsed = {
    gateway: '',
    json: false,
    receipt: '',
    requireComplete: false,
    requirePublished: false,
    pearReleaseResult: ''
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--json') parsed.json = true
    else if (arg === '--gateway') parsed.gateway = argv[++i]
    else if (arg.startsWith('--gateway=')) parsed.gateway = arg.slice('--gateway='.length)
    else if (arg === '--receipt') parsed.receipt = argv[++i]
    else if (arg.startsWith('--receipt=')) parsed.receipt = arg.slice('--receipt='.length)
    else if (arg === '--pear-release-result') parsed.pearReleaseResult = argv[++i]
    else if (arg.startsWith('--pear-release-result=')) parsed.pearReleaseResult = arg.slice('--pear-release-result='.length)
    else if (arg === '--require-complete') parsed.requireComplete = true
    else if (arg === '--require-published') parsed.requirePublished = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return parsed
}
