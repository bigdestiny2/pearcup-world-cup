#!/usr/bin/env node
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const args = parseArgs(process.argv.slice(2))
const postPublishSmokeScript = resolve(root, 'scripts', 'smoke-published-pearbrowser.mjs')
const exactBundleSmokeScript = resolve(root, 'scripts', 'smoke-pearbrowser-published-local.mjs')

if (!args.receipt) errors.push('missing --receipt <pearcup-release-receipt.json>')
if (!args.sha) errors.push('missing --sha <expected bundleSha256>')
if (args.sha && !/^[0-9a-f]{64}$/i.test(args.sha)) errors.push('--sha must be a 64-character hex bundle SHA')
if (args.gateway) validateGateway(args.gateway)

const receiptPath = args.receipt ? resolve(args.receipt) : ''
const receipt = receiptPath && existsSync(receiptPath) ? readReceipt(receiptPath) : null
if (receiptPath && !receipt) errors.push(`receipt does not exist or is unreadable: ${receiptPath}`)
if (receipt) validateReceipt(receipt, receiptPath)

if (errors.length === 0) runExactBundlePublishedSmoke(receipt)
if (errors.length === 0) runPostPublishSmokePreflight()

if (errors.length > 0) {
  console.error('PearCup approved publish refused:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const publishArgs = receipt.publishHandoff.args
const publishCommand = `node ${publishArgs.map(arg => JSON.stringify(arg)).join(' ')}`
const postPublishSmokeCommand = `npm ${postPublishSmokeArgs('hyper://<drive-key>/').map(arg => JSON.stringify(arg)).join(' ')}`
const localPublishedLinkProofCommand = publishedLinkProofCommand(receipt)
const publishResultPath = publishResultReceiptPath(receipt, receiptPath)

if (!args.publish) {
  console.log('PearCup approved publish dry-run passed')
  console.log(`receipt - ${receiptPath}`)
  console.log(`bundle - ${resolve(receipt.bundle)}`)
  console.log(`bundle sha256 - ${receipt.bundleSha256}`)
  console.log('publish command, add --publish to run after explicit approval:')
  console.log(publishCommand)
  console.log('exact bundle published-gateway preflight - passed')
  if (localPublishedLinkProofCommand) {
    console.log('local published-link proof command:')
    console.log(localPublishedLinkProofCommand)
  }
  console.log('post-publish smoke command that will run after publish:')
  console.log(postPublishSmokeCommand)
  console.log('post-publish smoke preflight - passed')
  console.log(`publish result receipt will be written to: ${publishResultPath}`)
  process.exit(0)
}

console.log('PearCup approved publish starting')
console.log(`receipt - ${receiptPath}`)
console.log(`bundle sha256 - ${receipt.bundleSha256}`)
console.log('exact bundle published-gateway preflight - passed')
if (localPublishedLinkProofCommand) {
  console.log('local published-link proof command:')
  console.log(localPublishedLinkProofCommand)
}
console.log('post-publish smoke preflight - passed')
console.log(`publish result receipt will be written to: ${publishResultPath}`)
console.log(publishCommand)

const result = spawnSync(process.execPath, publishArgs, {
  cwd: root,
  encoding: 'utf8'
})

if (result.error) throw result.error
if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.status !== 0) process.exit(result.status == null ? 1 : result.status)

const publishOutput = [result.stdout, result.stderr].filter(Boolean).join('\n')
const publishedUrl = extractPublishedUrl(publishOutput)
if (!publishedUrl) {
  console.error('PearCup approved publish could not find a hyper://<drive-key>/ URL in publish output; refusing to mark publish verified.')
  process.exit(1)
}

console.log('PearCup approved publish post-smoke starting')
console.log(`published url - ${publishedUrl}`)

const smokeResult = spawnSync('npm', postPublishSmokeArgs(publishedUrl), {
  cwd: root,
  encoding: 'utf8'
})
if (smokeResult.stdout) process.stdout.write(smokeResult.stdout)
if (smokeResult.stderr) process.stderr.write(smokeResult.stderr)
if (smokeResult.error) throw smokeResult.error
if (smokeResult.status !== 0) process.exit(smokeResult.status == null ? 1 : smokeResult.status)

writePublishResultReceipt({
  receipt,
  receiptPath,
  publishResultPath,
  publishedUrl,
  publishOutput,
  smokeOutput: [smokeResult.stdout, smokeResult.stderr].filter(Boolean).join('\n'),
  localPublishedLinkProofCommand
})

console.log('PearCup approved publish verified')
console.log(`publish result receipt - ${publishResultPath}`)
process.exit(0)

function validateReceipt (receipt, receiptPath) {
  const handoff = receipt.publishHandoff || {}
  const publishArgs = Array.isArray(handoff.args) ? handoff.args : []
  const bundle = receipt.bundle ? resolve(receipt.bundle) : ''

  runHandoffCheck(receiptPath)

  if (receipt.app !== 'PearCup') errors.push('receipt app must be PearCup')
  if (String(receipt.bundleSha256 || '').toLowerCase() !== String(args.sha || '').toLowerCase()) {
    errors.push(`receipt bundleSha256 ${receipt.bundleSha256 || '(missing)'} does not match --sha ${args.sha}`)
  }
  if (!handoff.approvalRequired) errors.push('receipt publishHandoff must require approval')
  if (handoff.appName !== 'pearcup') errors.push('receipt publishHandoff appName must be pearcup')
  if (handoff.updatesExistingDrive !== false) errors.push('receipt publishHandoff must be a fresh publish handoff')
  if (publishArgs.length !== 4) errors.push('receipt publishHandoff args must have exactly 4 entries')
  if (publishArgs[1] !== bundle) errors.push('receipt publishHandoff bundle arg must match receipt.bundle')
  if (publishArgs[2] !== '--name' || publishArgs[3] !== 'pearcup') {
    errors.push('receipt publishHandoff args must target --name pearcup')
  }
  if (publishArgs.some(arg => arg === '--key' || arg === '--storage')) {
    errors.push('approved publish wrapper refuses existing-drive update args')
  }
  if (!bundle || !existsSync(bundle) || !statSync(bundle).isDirectory()) {
    errors.push(`receipt bundle directory does not exist: ${bundle || '(missing)'}`)
  }
  if (!publishArgs[0] || !existsSync(resolve(publishArgs[0]))) {
    errors.push(`publish script does not exist: ${publishArgs[0] || '(missing)'}`)
  }
}

function runHandoffCheck (receiptPath) {
  const result = spawnSync(process.execPath, [
    resolve(root, 'scripts', 'check-pearbrowser-publish-handoff.mjs'),
    '--receipt',
    receiptPath
  ], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    errors.push(`handoff receipt validation failed${detail ? `:\n${detail}` : ''}`)
  }
}

function runPostPublishSmokePreflight () {
  if (!existsSync(postPublishSmokeScript)) {
    errors.push(`post-publish smoke script does not exist: ${postPublishSmokeScript}`)
    return
  }
  const result = spawnSync(process.execPath, ['--check', postPublishSmokeScript], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    errors.push(`post-publish smoke syntax preflight failed${detail ? `:\n${detail}` : ''}`)
  }
}

function runExactBundlePublishedSmoke (receipt) {
  if (!existsSync(exactBundleSmokeScript)) {
    errors.push(`exact bundle published-gateway smoke script does not exist: ${exactBundleSmokeScript}`)
    return
  }
  const bundle = receipt && receipt.bundle ? resolve(receipt.bundle) : ''
  const result = spawnSync(process.execPath, [
    '--check',
    exactBundleSmokeScript
  ], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    errors.push(`exact bundle published-gateway smoke syntax preflight failed${detail ? `:\n${detail}` : ''}`)
    return
  }
  const smokeResult = spawnSync(process.execPath, [
    exactBundleSmokeScript,
    '--bundle',
    bundle
  ], {
    cwd: root,
    encoding: 'utf8'
  })
  if (smokeResult.status !== 0) {
    const detail = [smokeResult.stdout, smokeResult.stderr].filter(Boolean).join('\n').trim()
    errors.push(`exact bundle published-gateway smoke failed${detail ? `:\n${detail}` : ''}`)
  }
}

function readReceipt (filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (err) {
    errors.push(`could not read receipt: ${err.message}`)
    return null
  }
}

function publishResultReceiptPath (receipt, receiptPath) {
  const configured = receipt &&
    receipt.postPublishVerification &&
    receipt.postPublishVerification.resultPath
  return configured ? resolve(configured) : join(dirname(receiptPath), 'pearcup-publish-result.json')
}

function writePublishResultReceipt ({
  receipt,
  receiptPath,
  publishResultPath,
  publishedUrl,
  publishOutput,
  smokeOutput,
  localPublishedLinkProofCommand
}) {
  const driveKey = (String(publishedUrl).match(/^hyper:\/\/([0-9a-f]{64})\//i) || [])[1] || ''
  const postPublishCommand = `npm ${postPublishSmokeArgs(publishedUrl).map(arg => JSON.stringify(arg)).join(' ')}`
  const result = {
    app: 'PearCup',
    status: 'published-and-smoked',
    publishedAt: new Date().toISOString(),
    receipt: receiptPath,
    bundle: receipt.bundle || '',
    bundleSha256: receipt.bundleSha256 || '',
    publishedUrl,
    driveKey,
    publishCommand,
    postPublishSmokeCommand: postPublishCommand,
    localPublishedLinkProofCommand,
    friendTest: {
      status: 'pending-remote-friend',
      recordCommand: `npm run record:friend-test -- --publish-result ${publishResultPath} --sha ${receipt.bundleSha256 || '<bundle-sha256>'} --friend "<friend-name>" --room-code "<observed-room-code>" --friend-opened --reached-games --joined-p2p --started-penalty-clash --notes "<what you observed>"`,
      requires: [
        'remote friend opens the final PearBrowser link',
        'remote friend reaches Games without fallback or boot error',
        'host and friend complete a live P2P invite join',
        'host and friend can start Penalty Clash from the joined room',
        'record the observed Penalty Clash room code'
      ]
    },
    evidence: {
      exactBundlePublishedGatewayPreflight: true,
      postPublishSmokePassed: true,
      publishOutputSnippet: trimForReceipt(publishOutput),
      smokeOutputSnippet: trimForReceipt(smokeOutput)
    }
  }
  writeFileSync(publishResultPath, JSON.stringify(result, null, 2) + '\n')
}

function trimForReceipt (text) {
  return String(text || '').trim().slice(-4000)
}

function publishedLinkProofCommand (receipt) {
  const contract = receipt &&
    receipt.verification &&
    (receipt.verification.localPublishedLinkContract || receipt.verification.localPublishedBrowserContract)
  return contract && contract.exactReceiptCommand
    ? String(contract.exactReceiptCommand)
    : ''
}

function extractPublishedUrl (text) {
  const match = String(text || '').match(/hyper:\/\/([0-9a-f]{64})\//i)
  return match ? `hyper://${match[1].toLowerCase()}/` : ''
}

function postPublishSmokeArgs (publishedUrl) {
  const smokeArgs = ['run', 'smoke:pearbrowser-published', '--', '--url', publishedUrl]
  if (args.gateway) smokeArgs.push('--gateway', args.gateway)
  return smokeArgs
}

function validateGateway (value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      errors.push('--gateway must be an http:// or https:// URL')
    }
    if (url.port === '4190') {
      errors.push('--gateway uses port 4190, which browser/fetch clients block; use 4191 or another browser-safe port')
    }
  } catch (err) {
    errors.push(`--gateway is not a valid URL: ${value}`)
  }
}

function parseArgs (argv) {
  const parsed = { publish: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--receipt') parsed.receipt = argv[++i]
    else if (arg.startsWith('--receipt=')) parsed.receipt = arg.slice('--receipt='.length)
    else if (arg === '--sha') parsed.sha = argv[++i]
    else if (arg.startsWith('--sha=')) parsed.sha = arg.slice('--sha='.length)
    else if (arg === '--gateway') parsed.gateway = argv[++i]
    else if (arg.startsWith('--gateway=')) parsed.gateway = arg.slice('--gateway='.length)
    else if (arg === '--publish') parsed.publish = true
    else if (arg === '--dry-run') parsed.publish = false
    else {
      errors.push(`unknown argument: ${arg}`)
    }
  }
  return parsed
}
