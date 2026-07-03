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
if (publishResultPath && !publishResult) errors.push(`publish result does not exist or is unreadable: ${publishResultPath}`)

if (publishResult) validatePublishResult(publishResult)
const passed = args.friendOpened && args.reachedGames && args.joinedP2p && args.startedPenaltyClash
if (!passed && !args.failed) {
  errors.push('recording a passed friend test requires --friend-opened --reached-games --joined-p2p --started-penalty-clash, or use --failed with --notes')
}
if (args.failed && !args.notes) errors.push('--failed requires --notes')

if (errors.length > 0) {
  console.error('PearCup friend test result refused:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const resultPath = args.out
  ? resolve(args.out)
  : join(dirname(publishResultPath), 'pearcup-friend-test-result.json')
const result = {
  app: 'PearCup',
  status: passed ? 'remote-friend-verified' : 'remote-friend-failed',
  recordedAt: new Date().toISOString(),
  publishResult: publishResultPath,
  publishedUrl: publishResult.publishedUrl || '',
  driveKey: publishResult.driveKey || '',
  bundleSha256: publishResult.bundleSha256 || '',
  friend: args.friend || 'friend',
  evidence: {
    friendOpenedFinalPearBrowserLink: args.friendOpened,
    friendReachedGamesWithoutFallbackOrBootError: args.reachedGames,
    hostAndFriendCompletedLiveP2PJoin: args.joinedP2p,
    hostAndFriendStartedPenaltyClash: args.startedPenaltyClash,
    notes: args.notes || ''
  },
  remaining: passed ? [] : ['repeat remote friend PearBrowser test after fixing noted issue']
}

writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n')
console.log('PearCup friend test result recorded')
console.log(`status - ${result.status}`)
console.log(`result - ${resultPath}`)
console.log(`published url - ${result.publishedUrl}`)

function validatePublishResult (result) {
  if (result.app !== 'PearCup') errors.push('publish result app must be PearCup')
  if (result.status !== 'published-and-smoked') errors.push('publish result status must be published-and-smoked')
  if (!/^hyper:\/\/[0-9a-f]{64}\//i.test(String(result.publishedUrl || ''))) {
    errors.push('publish result must include a hyper://<drive-key>/ publishedUrl')
  }
  if (!/^[0-9a-f]{64}$/i.test(String(result.driveKey || ''))) errors.push('publish result must include a 64-hex driveKey')
  if (!/^[0-9a-f]{64}$/i.test(String(result.bundleSha256 || ''))) errors.push('publish result must include a 64-hex bundleSha256')
  if (!result.friendTest || result.friendTest.status !== 'pending-remote-friend') {
    errors.push('publish result must still be pending remote friend verification')
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
    friendOpened: false,
    reachedGames: false,
    joinedP2p: false,
    startedPenaltyClash: false,
    notes: '',
    friend: '',
    out: '',
    publishResult: ''
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--publish-result') parsed.publishResult = argv[++i]
    else if (arg.startsWith('--publish-result=')) parsed.publishResult = arg.slice('--publish-result='.length)
    else if (arg === '--out') parsed.out = argv[++i]
    else if (arg.startsWith('--out=')) parsed.out = arg.slice('--out='.length)
    else if (arg === '--friend') parsed.friend = argv[++i]
    else if (arg.startsWith('--friend=')) parsed.friend = arg.slice('--friend='.length)
    else if (arg === '--notes') parsed.notes = argv[++i]
    else if (arg.startsWith('--notes=')) parsed.notes = arg.slice('--notes='.length)
    else if (arg === '--friend-opened') parsed.friendOpened = true
    else if (arg === '--reached-games') parsed.reachedGames = true
    else if (arg === '--joined-p2p') parsed.joinedP2p = true
    else if (arg === '--started-penalty-clash') parsed.startedPenaltyClash = true
    else if (arg === '--failed') parsed.failed = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return parsed
}
