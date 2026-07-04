#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const receiptPath = resolve(args.receipt || join(root, '.pearcup-release', 'latest', 'pearcup-release-receipt.json'))
const errors = []

const receipt = readReceipt(receiptPath)
const bundle = receipt && receipt.bundle ? resolve(receipt.bundle) : ''
const expectedSha = receipt && String(receipt.bundleSha256 || '')

if (receipt) validateReceipt(receipt, bundle, expectedSha)

if (errors.length > 0) {
  console.error('PearCup exact preview refused:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const serveArgs = [
  join(root, 'scripts', 'serve-pearbrowser-hyper.mjs'),
  '--bundle',
  bundle,
  '--port',
  String(args.port),
  '--host',
  args.host,
  '--strict-port'
]

console.log('PearCup exact preview release receipt verified')
console.log(`receipt - ${receiptPath}`)
console.log(`bundle - ${bundle}`)
console.log(`bundle sha256 - ${expectedSha}`)
console.log(`source git head - ${receipt.sourceGitHead || '(missing)'}`)
console.log(`preview url - http://${args.host}:${args.port}/`)

if (args.dryRun) {
  console.log(`command - node ${serveArgs.map(arg => JSON.stringify(arg)).join(' ')}`)
  process.exit(0)
}

const result = spawnSync(process.execPath, serveArgs, {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit'
})
if (result.error) throw result.error
process.exit(result.status == null ? 1 : result.status)

function readReceipt (filePath) {
  if (!existsSync(filePath)) {
    errors.push(`release receipt does not exist: ${filePath}`)
    return null
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (err) {
    errors.push(`could not read release receipt: ${err.message}`)
    return null
  }
}

function validateReceipt (receipt, bundlePath, expected) {
  if (receipt.app !== 'PearCup') errors.push('release receipt app must be PearCup')
  if (!/^[0-9a-f]{64}$/i.test(expected)) errors.push('release receipt is missing a valid bundleSha256')
  if (!bundlePath || !existsSync(bundlePath) || !statSync(bundlePath).isDirectory()) {
    errors.push(`release receipt bundle directory does not exist: ${bundlePath || '(missing)'}`)
    return
  }
  const actual = bundleInventorySha256(bundlePath)
  if (expected && actual !== expected) {
    errors.push(`release bundle sha256 ${actual} does not match receipt ${expected}`)
  }
}

function bundleInventorySha256 (bundlePath) {
  const inventory = listFiles(bundlePath).map(filePath => {
    const data = readFileSync(filePath)
    const hash = createHash('sha256').update(data).digest('hex')
    const relativePath = filePath.slice(bundlePath.length).replace(/\\/g, '/')
    return `${hash}  ${relativePath}\n`
  }).join('')
  return createHash('sha256').update(inventory).digest('hex')
}

function listFiles (dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const filePath = join(dir, entry)
    const stat = statSync(filePath)
    if (stat.isDirectory()) files.push(...listFiles(filePath))
    else if (stat.isFile()) files.push(filePath)
  }
  return files.sort()
}

function parseArgs (argv) {
  const parsed = {
    dryRun: false,
    host: '127.0.0.1',
    port: 4186,
    receipt: ''
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') parsed.dryRun = true
    else if (arg === '--host') parsed.host = argv[++i]
    else if (arg.startsWith('--host=')) parsed.host = arg.slice('--host='.length)
    else if (arg === '--port') parsed.port = readPort(argv[++i])
    else if (arg.startsWith('--port=')) parsed.port = readPort(arg.slice('--port='.length))
    else if (arg === '--receipt') parsed.receipt = argv[++i]
    else if (arg.startsWith('--receipt=')) parsed.receipt = arg.slice('--receipt='.length)
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return parsed
}

function readPort (value) {
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid --port: ${value}`)
  }
  if (port === 4190) {
    throw new Error('--port 4190 is blocked by browser/fetch clients; use 4191 or another browser-safe port')
  }
  return port
}
