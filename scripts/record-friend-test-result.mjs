#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const errors = []

if (!args.publishResult) errors.push('missing --publish-result <pearcup-publish-result.json>')
const publishResultPath = args.publishResult ? resolve(args.publishResult) : ''
const publishResult = publishResultPath && existsSync(publishResultPath) ? readJson(publishResultPath, 'publish result') : null
const testedSurface = normalizeSurface(args.surface)
const publicLink = args.publicLink || (publishResult && publishResult.publishedUrl) || ''
const pearReleaseResultPath = args.pearReleaseResult ? resolve(args.pearReleaseResult) : ''
const pearReleaseResult = pearReleaseResultPath && existsSync(pearReleaseResultPath)
  ? readJson(pearReleaseResultPath, 'Pear runtime release result')
  : null
const resultPath = args.out
  ? resolve(args.out)
  : publishResultPath
    ? join(dirname(publishResultPath), 'pearcup-friend-test-result.json')
    : ''
if (publishResultPath && !publishResult) errors.push(`publish result does not exist or is unreadable: ${publishResultPath}`)

if (publishResult) validatePublishResult(publishResult, publishResultPath)
validateFriendSurface()
const passed = args.friendOpened && args.reachedGames && args.joinedP2p && args.startedPenaltyClash
if (!passed && !args.failed) {
  errors.push('recording a passed friend test requires --friend-opened --reached-games --joined-p2p --started-penalty-clash, or use --failed with --notes')
}
if (args.failed && !args.notes) errors.push('--failed requires --notes')
if (passed && !args.friend) errors.push('recording a passed friend test requires --friend <name-or-handle>')
if (passed && !args.notes) errors.push('recording a passed friend test requires --notes with observed remote behavior')
if (passed && !args.roomCode) errors.push('recording a passed friend test requires --room-code <observed invite room code>')
if (passed && !args.sha) errors.push('recording a passed friend test requires --sha <expected bundleSha256>')
if (args.sha && !/^[0-9a-f]{64}$/i.test(args.sha)) errors.push('--sha must be a 64-character hex bundle SHA')
if (args.roomCode && !/^[a-z0-9-]{3,32}$/i.test(args.roomCode)) errors.push('--room-code must be 3-32 letters, numbers, or dashes')
if (args.sha && publishResult && String(args.sha).toLowerCase() !== String(publishResult.bundleSha256 || '').toLowerCase()) {
  errors.push(`--sha ${args.sha} does not match publish result bundleSha256 ${publishResult.bundleSha256 || '(missing)'}`)
}
if (resultPath && existsSync(resultPath) && !args.force) {
  errors.push(`friend test result already exists: ${resultPath}; use --force to replace it intentionally`)
}

if (errors.length > 0) {
  console.error('PearCup friend test result refused:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const result = {
  app: 'PearCup',
  status: passed ? 'remote-friend-verified' : 'remote-friend-failed',
  recordedAt: new Date().toISOString(),
  publishResult: publishResultPath,
  releaseReceipt: publishResult.receipt || '',
  sourceGitHead: publishResult.sourceGitHead || '',
  sourceGitBranch: publishResult.sourceGitBranch || '',
  sourceDirty: publishResult.sourceDirty,
  publishedUrl: publishResult.publishedUrl || '',
  driveKey: publishResult.driveKey || '',
  testedSurface,
  publicLink,
  pearReleaseResult: pearReleaseResultPath,
  pearUrl: pearReleaseResult && pearReleaseResult.pearUrl || '',
  bundleSha256: publishResult.bundleSha256 || '',
  approvedPublishCommand: publishResult.approvedPublishCommand || '',
  postPublishSmokeCommand: publishResult.postPublishSmokeCommand || '',
  localPublishedLinkProofCommand: publishResult.localPublishedLinkProofCommand || '',
  publishEvidence: {
    exactBundlePublishedGatewayPreflight: publishResult.evidence && publishResult.evidence.exactBundlePublishedGatewayPreflight === true,
    exactBundlePearRuntimePreflight: publishResult.evidence && publishResult.evidence.exactBundlePearRuntimePreflight === true,
    postPublishSmokePassed: publishResult.evidence && publishResult.evidence.postPublishSmokePassed === true
  },
  pearReleaseEvidence: pearReleaseResult
    ? {
        release: pearReleaseResult.release,
        length: pearReleaseResult.length,
        seedAnnounced: pearReleaseResult.evidence && pearReleaseResult.evidence.seedAnnounced === true,
        publicPearRunSmokePassed: pearReleaseResult.evidence && pearReleaseResult.evidence.publicPearRunSmokePassed === true
      }
    : null,
  remoteFriendChecklist: friendChecklistForSurface()
    ? friendChecklistForSurface()
    : [],
  friend: args.friend || 'friend',
  evidence: {
    expectedBundleSha256: args.sha || '',
    testedSurface,
    publicLink,
    friendOpenedFinalPublicLink: args.friendOpened,
    friendOpenedFinalPearBrowserLink: args.friendOpened,
    friendReachedGamesWithoutFallbackOrBootError: args.reachedGames,
    hostAndFriendCompletedLiveP2PJoin: args.joinedP2p,
    hostAndFriendStartedPenaltyClash: args.startedPenaltyClash,
    observedRoomCode: args.roomCode || '',
    notes: args.notes || ''
  },
  remaining: passed ? [] : [`repeat remote friend ${surfaceLabel(testedSurface)} test after fixing noted issue`]
}

writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n')
console.log('PearCup friend test result recorded')
console.log(`status - ${result.status}`)
console.log(`result - ${resultPath}`)
console.log(`published url - ${result.publishedUrl}`)

function validatePublishResult (result, resultPath) {
  if (result.app !== 'PearCup') errors.push('publish result app must be PearCup')
  if (result.status !== 'published-and-smoked') errors.push('publish result status must be published-and-smoked')
  const publishedDrive = (String(result.publishedUrl || '').match(/^hyper:\/\/([0-9a-f]{64})\//i) || [])[1] || ''
  if (!publishedDrive) {
    errors.push('publish result must include a hyper://<drive-key>/ publishedUrl')
  }
  if (!/^[0-9a-f]{64}$/i.test(String(result.driveKey || ''))) errors.push('publish result must include a 64-hex driveKey')
  if (publishedDrive && String(result.driveKey || '').toLowerCase() !== publishedDrive.toLowerCase()) {
    errors.push('publish result driveKey must match the publishedUrl drive key')
  }
  if (!/^[0-9a-f]{64}$/i.test(String(result.bundleSha256 || ''))) errors.push('publish result must include a 64-hex bundleSha256')
  if (!String(result.approvedPublishCommand || '').includes('publish-approved-pearcup.mjs') ||
    !String(result.approvedPublishCommand || '').includes('--publish')) {
    errors.push('publish result must include the approvedPublishCommand wrapper used for publish')
  }
  const releaseReceiptPath = result.receipt ? resolve(result.receipt) : ''
  const releaseReceipt = releaseReceiptPath && existsSync(releaseReceiptPath)
    ? readJson(releaseReceiptPath, 'source release receipt')
    : null
  if (!String(result.receipt || '')) {
    errors.push('publish result must include the source release receipt path')
  } else if (!releaseReceipt) {
    errors.push(`publish result source release receipt does not exist or is unreadable: ${releaseReceiptPath}`)
  }
  if (!/^[0-9a-f]{40}$/i.test(String(result.sourceGitHead || ''))) {
    errors.push('publish result must include the source release receipt sourceGitHead')
  }
  if (result.sourceDirty !== false) {
    errors.push('publish result must come from a clean source release receipt')
  }
  if (!result.friendTest || result.friendTest.status !== 'pending-remote-friend') {
    errors.push('publish result must still be pending remote friend verification')
  }
  if (!String(result.localPublishedLinkProofCommand || '').includes('serve:pearbrowser-published')) {
    errors.push('publish result must include the local published-link proof command')
  }
  if (result.localPublishedBrowserCommand) {
    errors.push('publish result must use localPublishedLinkProofCommand, not deprecated localPublishedBrowserCommand')
  }
  const friendRequires = result.friendTest && Array.isArray(result.friendTest.requires)
    ? result.friendTest.requires
    : []
  for (const required of [
    'remote friend opens the final PearBrowser link',
    'remote friend reaches Games without fallback or boot error',
    'host and friend complete a live P2P invite join',
    'host and friend can start Penalty Clash from the joined room',
    'record the observed Penalty Clash room code'
  ]) {
    if (!friendRequires.includes(required)) {
      errors.push(`publish result friendTest must require: ${required}`)
    }
  }
  const evidence = result.evidence || {}
  if (evidence.exactBundlePublishedGatewayPreflight !== true) {
    errors.push('publish result must prove exact bundle published-gateway preflight passed')
  }
  if (evidence.exactBundlePearRuntimePreflight !== true) {
    errors.push('publish result must prove exact bundle Pear runtime preflight passed')
  }
  if (evidence.postPublishSmokePassed !== true) {
    errors.push('publish result must prove post-publish smoke passed')
  }
  if (releaseReceipt) validateSourceReleaseReceiptBinding(result, resultPath, releaseReceipt, releaseReceiptPath)
}

function validateFriendSurface () {
  if (!testedSurface) errors.push('--surface must be one of hyper, pearbrowser, or pear')
  if (publicLink) {
    if (testedSurface === 'pear' && !String(publicLink).startsWith('pear://')) {
      errors.push('--public-link must be a pear:// URL when --surface pear is used')
    }
    if ((testedSurface === 'hyper' || testedSurface === 'pearbrowser') && !String(publicLink).startsWith('hyper://')) {
      errors.push('--public-link must be a hyper:// URL when --surface hyper is used')
    }
  } else if (testedSurface) {
    errors.push('recording a friend test requires a final public link')
  }
  if (testedSurface === 'pear') {
    if (!pearReleaseResultPath) errors.push('--surface pear requires --pear-release-result <pearcup-pear-release-result.json>')
    else if (!pearReleaseResult) errors.push(`Pear runtime release result does not exist or is unreadable: ${pearReleaseResultPath}`)
    else validatePearReleaseResult(pearReleaseResult)
  }
}

function validatePearReleaseResult (result) {
  if (result.app !== 'PearCup') errors.push('Pear runtime release result app must be PearCup')
  if (result.status !== 'pear-runtime-released-and-smoked') errors.push('Pear runtime release result status must be pear-runtime-released-and-smoked')
  if (!String(result.pearUrl || '').startsWith('pear://')) errors.push('Pear runtime release result must include a pear:// URL')
  if (publicLink && result.pearUrl !== publicLink) errors.push('Pear runtime release result pearUrl must match --public-link')
  if (publishResult && String(result.sourceGitHead || '').toLowerCase() !== String(publishResult.sourceGitHead || '').toLowerCase()) {
    errors.push('Pear runtime release result sourceGitHead must match the publish result sourceGitHead')
  }
  if (result.sourceDirty !== false) errors.push('Pear runtime release result must come from a clean source')
  const evidence = result.evidence || {}
  if (evidence.releasePassed !== true) errors.push('Pear runtime release result must prove release passed')
  if (evidence.seedAnnounced !== true) errors.push('Pear runtime release result must prove seed was announced')
  if (evidence.publicPearRunSmokePassed !== true) errors.push('Pear runtime release result must prove the public pear:// run smoke passed')
}

function friendChecklistForSurface () {
  if (testedSurface === 'pear' && pearReleaseResult && pearReleaseResult.friendTest && Array.isArray(pearReleaseResult.friendTest.requires)) {
    return [...pearReleaseResult.friendTest.requires]
  }
  if (publishResult.friendTest && Array.isArray(publishResult.friendTest.requires)) {
    return [...publishResult.friendTest.requires]
  }
  return []
}

function normalizeSurface (value) {
  const surface = String(value || 'hyper').toLowerCase()
  if (surface === 'pearbrowser') return 'hyper'
  if (surface === 'hyper' || surface === 'pear') return surface
  return ''
}

function surfaceLabel (surface) {
  if (surface === 'pear') return 'Pear runtime'
  return 'PearBrowser'
}

function validateSourceReleaseReceiptBinding (result, resultPath, receipt, receiptPath) {
  if (receipt.app !== 'PearCup') errors.push('source release receipt app must be PearCup')
  if (String(receipt.bundleSha256 || '').toLowerCase() !== String(result.bundleSha256 || '').toLowerCase()) {
    errors.push(`publish result bundleSha256 ${result.bundleSha256 || '(missing)'} does not match source release receipt bundleSha256 ${receipt.bundleSha256 || '(missing)'}`)
  }
  if (String(receipt.sourceGitHead || '').toLowerCase() !== String(result.sourceGitHead || '').toLowerCase()) {
    errors.push(`publish result sourceGitHead ${result.sourceGitHead || '(missing)'} does not match source release receipt sourceGitHead ${receipt.sourceGitHead || '(missing)'}`)
  }
  if (receipt.sourceDirty !== false || result.sourceDirty !== false) {
    errors.push('publish result and source release receipt must both come from clean source')
  }
  const expectedResultPath = receipt &&
    receipt.postPublishVerification &&
    receipt.postPublishVerification.resultPath
    ? resolve(receipt.postPublishVerification.resultPath)
    : ''
  if (!expectedResultPath) {
    errors.push('source release receipt must include postPublishVerification.resultPath')
  } else if (expectedResultPath !== resolve(resultPath)) {
    errors.push(`publish result path ${resolve(resultPath)} does not match source release receipt postPublishVerification.resultPath ${expectedResultPath}`)
  }
  if (resolve(result.receipt || '') !== receiptPath) {
    errors.push('publish result receipt path must resolve to the loaded source release receipt')
  }
  validateApprovedPublishCommandBinding(result, receiptPath)
}

function validateApprovedPublishCommandBinding (result, receiptPath) {
  const command = String(result.approvedPublishCommand || '')
  if (!command.includes(receiptPath)) {
    errors.push('approvedPublishCommand must target the source release receipt path')
  }
  if (!command.includes(String(result.bundleSha256 || ''))) {
    errors.push('approvedPublishCommand must target the publish result bundle SHA')
  }
  if (command.includes('publish-and-pin.js')) {
    errors.push('approvedPublishCommand must route through the approved wrapper, not the raw PearBrowser publish script')
  }
}

function readJson (filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (err) {
    errors.push(`could not read ${label}: ${err.message}`)
    return null
  }
}

function parseArgs (argv) {
  const parsed = {
    failed: false,
    surface: 'hyper',
    publicLink: '',
    pearReleaseResult: '',
    friendOpened: false,
    reachedGames: false,
    joinedP2p: false,
    startedPenaltyClash: false,
    notes: '',
    friend: '',
    roomCode: '',
    out: '',
    publishResult: '',
    sha: '',
    force: false
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--publish-result') parsed.publishResult = argv[++i]
    else if (arg.startsWith('--publish-result=')) parsed.publishResult = arg.slice('--publish-result='.length)
    else if (arg === '--surface') parsed.surface = argv[++i]
    else if (arg.startsWith('--surface=')) parsed.surface = arg.slice('--surface='.length)
    else if (arg === '--public-link') parsed.publicLink = argv[++i]
    else if (arg.startsWith('--public-link=')) parsed.publicLink = arg.slice('--public-link='.length)
    else if (arg === '--pear-release-result') parsed.pearReleaseResult = argv[++i]
    else if (arg.startsWith('--pear-release-result=')) parsed.pearReleaseResult = arg.slice('--pear-release-result='.length)
    else if (arg === '--out') parsed.out = argv[++i]
    else if (arg.startsWith('--out=')) parsed.out = arg.slice('--out='.length)
    else if (arg === '--friend') parsed.friend = argv[++i]
    else if (arg.startsWith('--friend=')) parsed.friend = arg.slice('--friend='.length)
    else if (arg === '--notes') parsed.notes = argv[++i]
    else if (arg.startsWith('--notes=')) parsed.notes = arg.slice('--notes='.length)
    else if (arg === '--room-code') parsed.roomCode = argv[++i]
    else if (arg.startsWith('--room-code=')) parsed.roomCode = arg.slice('--room-code='.length)
    else if (arg === '--sha') parsed.sha = argv[++i]
    else if (arg.startsWith('--sha=')) parsed.sha = arg.slice('--sha='.length)
    else if (arg === '--friend-opened') parsed.friendOpened = true
    else if (arg === '--reached-games') parsed.reachedGames = true
    else if (arg === '--joined-p2p') parsed.joinedP2p = true
    else if (arg === '--started-penalty-clash') parsed.startedPenaltyClash = true
    else if (arg === '--failed') parsed.failed = true
    else if (arg === '--force') parsed.force = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return parsed
}
