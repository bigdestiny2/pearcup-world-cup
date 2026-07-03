#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceAppRoot = join(root, 'design', 'kawaii-app')
const args = parseArgs(process.argv.slice(2))
const bundle = resolveBundle(args)
const duration = String(args.duration || 10_000)
const pear = args.pear || 'pear'
const tmpAppRoot = mkdtempSync(join(tmpdir(), 'pearcup-exact-bundle-pear-'))

try {
  prepareTempPearApp(tmpAppRoot, bundle)
  const result = spawnSync(process.execPath, [
    join(root, 'scripts', 'smoke-kawaii-pear-run.mjs'),
    '--app-root',
    tmpAppRoot,
    '--duration',
    duration,
    '--pear',
    pear,
    '--label',
    'Exact PearBrowser bundle Pear run smoke'
  ], {
    cwd: root,
    encoding: 'utf8'
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) {
    console.error(`Exact PearBrowser bundle Pear run smoke failed to launch: ${result.error.message}`)
    process.exitCode = 1
  } else if (result.status !== 0) {
    process.exitCode = result.status || 1
  } else {
    console.log(`ok - exact bundle renderer: ${bundle}`)
    console.log(`ok - temporary Pear app root: ${tmpAppRoot}`)
  }
} finally {
  if (!args.keep) rmSync(tmpAppRoot, { recursive: true, force: true })
}

function prepareTempPearApp (target, sourceBundle) {
  if (!existsSync(sourceBundle) || !lstatSync(sourceBundle).isDirectory()) {
    throw new Error(`bundle does not exist: ${sourceBundle}`)
  }
  for (const entry of readdirSync(sourceBundle)) {
    cpSync(join(sourceBundle, entry), join(target, entry), { recursive: true })
  }
  for (const file of ['index.cjs', 'package.json', 'pear-worker.cjs', 'swarm-worker.cjs']) {
    const source = join(sourceAppRoot, file)
    if (!existsSync(source)) throw new Error(`source Pear bootstrap file is missing: ${source}`)
    cpSync(source, join(target, file))
  }

  const nodeModules = join(sourceAppRoot, 'node_modules')
  if (!existsSync(nodeModules) || !lstatSync(nodeModules).isDirectory()) {
    throw new Error(`source Pear app node_modules is missing: ${nodeModules}`)
  }
  // The runtime smoke uses --no-pre, so a symlink is sufficient and avoids copying
  // hundreds of MB for every exact-bundle proof.
  symlinkSync(nodeModules, join(target, 'node_modules'), 'dir')
}

function resolveBundle (parsed) {
  if (parsed.bundle) return resolve(parsed.bundle)
  const receiptPath = resolve(parsed.receipt || '.pearcup-release/latest/pearcup-release-receipt.json')
  if (!existsSync(receiptPath)) throw new Error(`receipt does not exist: ${receiptPath}`)
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'))
  if (!receipt.bundle) throw new Error(`receipt is missing bundle path: ${receiptPath}`)
  return resolve(receipt.bundle)
}

function parseArgs (argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--bundle') parsed.bundle = argv[++i]
    else if (arg.startsWith('--bundle=')) parsed.bundle = arg.slice('--bundle='.length)
    else if (arg === '--receipt') parsed.receipt = argv[++i]
    else if (arg.startsWith('--receipt=')) parsed.receipt = arg.slice('--receipt='.length)
    else if (arg === '--duration') parsed.duration = argv[++i]
    else if (arg.startsWith('--duration=')) parsed.duration = arg.slice('--duration='.length)
    else if (arg === '--pear') parsed.pear = argv[++i]
    else if (arg.startsWith('--pear=')) parsed.pear = arg.slice('--pear='.length)
    else if (arg === '--keep') parsed.keep = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return parsed
}
