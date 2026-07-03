#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const proofDrive = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const args = parseArgs(process.argv.slice(2))
const checks = []
const notes = []
const errors = []

let receiptPath = ''
let bundlePath = ''
let bundleSha256 = ''
let publishedLinkProofCommand = ''

if (args.full) runNpm('Full project check', ['run', 'check'])

if (errors.length === 0) {
  const handoffArgs = args.receipt ? ['--receipt', resolve(args.receipt)] : []
  const handoff = runNode('PearBrowser publish handoff', 'scripts/check-pearbrowser-publish-handoff.mjs', handoffArgs)
  if (handoff.ok) {
    receiptPath = extractLineValue(handoff.output, /^receipt - (.+)$/m)
    bundlePath = extractLineValue(handoff.output, /^bundle - (.+)$/m)
    bundleSha256 = extractLineValue(handoff.output, /^bundle sha256 - ([0-9a-f]{64})$/im)
    if (!receiptPath) errors.push('PearBrowser publish handoff did not print a receipt path')
    if (!bundlePath) errors.push('PearBrowser publish handoff did not print a bundle path')
    if (!bundleSha256) errors.push('PearBrowser publish handoff did not print a bundle SHA-256')
    if (receiptPath) publishedLinkProofCommand = readPublishedLinkProofCommand(receiptPath)
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

if (errors.length === 0) {
  await runExactReceiptPublishedProof()
}

if (errors.length === 0) {
  runNode('Exact bundle Pear runtime proof', 'scripts/smoke-published-pearbrowser-runtime.mjs', [
    '--receipt',
    receiptPath
  ])
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
  if (publishedLinkProofCommand) console.log(`published link proof command - ${publishedLinkProofCommand}`)
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

async function runExactReceiptPublishedProof () {
  const port = String(args.proofPort)
  const server = spawn(process.execPath, [
    join(root, 'scripts', 'serve-pearbrowser-published-local.mjs'),
    '--receipt',
    receiptPath,
    '--port',
    port,
    '--strict-port'
  ], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let output = ''
  let closed = false
  server.stdout.setEncoding('utf8')
  server.stderr.setEncoding('utf8')
  server.stdout.on('data', chunk => { output += chunk })
  server.stderr.on('data', chunk => { output += chunk })
  server.on('error', err => { output += `\n${err.message}` })
  server.on('close', () => { closed = true })

  try {
    await waitForPublishedProofServer(() => /PearBrowser local published URL:/.test(output), () => closed, () => output)
    runNode('Exact receipt published-link proof', 'scripts/smoke-published-pearbrowser.mjs', [
      '--drive',
      proofDrive,
      '--gateway',
      `http://127.0.0.1:${port}/`
    ])
  } catch (err) {
    errors.push(`Exact receipt published-link proof failed: ${err.message}${output.trim() ? `\n${output.trim()}` : ''}`)
  } finally {
    await stopServer(server, () => closed)
  }
}

function waitForPublishedProofServer (predicate, isClosed, getOutput, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (predicate()) return resolve()
      const output = String(getOutput() || '').trim()
      if (isClosed()) return reject(new Error(`published proof server exited before it was ready${output ? `\n${output}` : ''}`))
      if (Date.now() - started > timeoutMs) return reject(new Error('timed out waiting for published proof server'))
      setTimeout(tick, 50)
    }
    tick()
  })
}

function stopServer (server, isClosed) {
  return new Promise(resolve => {
    if (isClosed()) return resolve()
    const timer = setTimeout(resolve, 2000)
    server.once('close', () => {
      clearTimeout(timer)
      resolve()
    })
    server.kill('SIGTERM')
  })
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

function readPublishedLinkProofCommand (filePath) {
  try {
    const receipt = JSON.parse(readFileSync(filePath, 'utf8'))
    const verification = receipt && receipt.verification
    const contract = verification && (verification.localPublishedLinkContract || verification.localPublishedBrowserContract)
    return receipt &&
      contract &&
      contract.exactReceiptCommand
      ? String(contract.exactReceiptCommand)
      : ''
  } catch (err) {
    errors.push(`could not read published link proof command from receipt: ${err.message}`)
    return ''
  }
}

function parseArgs (argv) {
  const parsed = {
    full: false,
    gateway: 'http://127.0.0.1:17208/',
    allowDirty: false,
    proofPort: 4191,
    receipt: '',
    url: ''
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--full') parsed.full = true
    else if (arg === '--require-clean') parsed.allowDirty = false
    else if (arg === '--allow-dirty') parsed.allowDirty = true
    else if (arg === '--gateway') parsed.gateway = argv[++i]
    else if (arg.startsWith('--gateway=')) parsed.gateway = arg.slice('--gateway='.length)
    else if (arg === '--proof-port') parsed.proofPort = readPort(argv[++i])
    else if (arg.startsWith('--proof-port=')) parsed.proofPort = readPort(arg.slice('--proof-port='.length))
    else if (arg === '--receipt') parsed.receipt = argv[++i]
    else if (arg.startsWith('--receipt=')) parsed.receipt = arg.slice('--receipt='.length)
    else if (arg === '--url') parsed.url = argv[++i]
    else if (arg.startsWith('--url=')) parsed.url = arg.slice('--url='.length)
    else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return parsed
}

function readPort (value) {
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid --proof-port: ${value}`)
  }
  if (port === 4190) {
    throw new Error('--proof-port 4190 is blocked by browser/fetch clients; use 4191 or another browser-safe port')
  }
  return port
}
