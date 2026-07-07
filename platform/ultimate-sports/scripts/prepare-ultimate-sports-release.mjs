#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runFitSmokeMatrix } from './smoke-ultimate-fits.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REPORT_VERSION = 'ultimate-sports-release-pipeline-v1'

async function main () {
  const args = parseArgs(process.argv.slice(2))
  const out = args.out || mkTmpDir()
  mkdirSync(out, { recursive: true })

  const steps = []
  const run = async (label, fn) => {
    console.log(`[release] ${label}…`)
    try {
      const result = await fn()
      steps.push({ label, ok: true, evidence: result })
      return result
    } catch (err) {
      const evidence = err && err.message ? err.message : String(err)
      steps.push({ label, ok: false, evidence })
      writeReceipt({ out, args, steps })
      console.error(`[release] FAILED: ${label}\n${evidence}`)
      process.exit(1)
    }
  }

  await run('Run Ultimate Sports test suite', () => runTests(args))
  await run('Build engine bundle', () => runBuildEngines(args))
  await run('Run per-fit smoke matrix', () => runFitSmoke(args))

  const pearUrl = args.pearUrl || readExistingPearUrl()
  if ((args.stage || args.release) && !pearUrl) {
    throw new Error('No --pear-url provided and no existing publish receipt found')
  }

  let stageResult = null
  let releaseResult = null
  if (args.stage) {
    stageResult = await run('Stage Pear drive', () => runPear('stage', pearUrl, ROOT))
  }
  if (args.release) {
    releaseResult = await run('Release Pear drive', () => runPear('release', pearUrl, ROOT))
  }

  const manifest = readPlatformManifest()
  const git = readGitState()
  const receipt = {
    reportVersion: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    app: 'Ultimate Sports',
    sourceGitHead: git.head,
    sourceGitBranch: git.branch,
    sourceDirty: git.dirty,
    steps,
    manifest,
    pear: {
      name: args.pearName || 'ultimate-sports-dev',
      staged: Boolean(stageResult),
      released: Boolean(releaseResult),
      stageResult,
      releaseResult
    }
  }

  writeReceipt({ out, args, steps, stageResult, releaseResult })
}

function writeReceipt ({ out, args, steps, stageResult = null, releaseResult = null }) {
  const manifest = readPlatformManifest()
  const git = readGitState()
  const pearUrl = args.pearUrl || readExistingPearUrl()
  const receipt = {
    reportVersion: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    app: 'Ultimate Sports',
    sourceGitHead: git.head,
    sourceGitBranch: git.branch,
    sourceDirty: git.dirty,
    steps,
    manifest,
    pear: {
      name: args.pearName || 'ultimate-sports-dev',
      url: pearUrl,
      staged: Boolean(stageResult),
      released: Boolean(releaseResult),
      stageResult,
      releaseResult
    }
  }

  const receiptPath = join(out, 'ultimate-sports-release-receipt.json')
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2))
  console.log(`[release] Receipt written to ${receiptPath}`)
}

function runTests (args) {
  if (args.skipTests) return 'skipped'
  const result = spawnSync('node', ['--test', 'test/*.test.js'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  if (result.status !== 0) {
    throw new Error(`Test suite failed (exit ${result.status}):\n${result.stderr || result.stdout}`)
  }
  const tail = result.stdout.trim().split('\n').slice(-6).join('\n')
  return tail
}

function runBuildEngines (args) {
  if (args.skipBuild) return 'skipped'
  const result = spawnSync('node', ['scripts/build-engines.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  if (result.status !== 0) {
    throw new Error(`Engine bundle build failed (exit ${result.status}):\n${result.stderr || result.stdout}`)
  }
  const bundlePath = join(ROOT, 'shell', 'engines.bundle.js')
  if (!existsSync(bundlePath)) throw new Error('Engine bundle did not write shell/engines.bundle.js')
  const stats = statSync(bundlePath)
  return `wrote shell/engines.bundle.js (${stats.size} bytes)`
}

async function runFitSmoke (args) {
  if (args.skipSmoke) return 'skipped'
  const report = await runFitSmokeMatrix()
  if (report.summary.failed > 0) {
    throw new Error(`Fit smoke matrix failed: ${report.summary.failed}/${report.summary.total} checks`)
  }
  return `${report.summary.passed}/${report.summary.total} checks passed`
}

function runPear (command, name, cwd) {
  return new Promise((resolve, reject) => {
    const result = spawnSync('pear', [command, name, '.'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000
    })
    if (result.status !== 0) {
      reject(new Error(`pear ${command} failed (exit ${result.status}):\n${result.stderr || result.stdout}`))
      return
    }
    resolve((result.stdout || '').trim())
  })
}

function readPlatformManifest () {
  const path = join(ROOT, 'platform.manifest.json')
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function readExistingPearUrl () {
  const path = join(ROOT, 'generated-reports', 'ultimate-sports-publish-receipt.json')
  try {
    const receipt = JSON.parse(readFileSync(path, 'utf8'))
    return receipt.pearUrl || null
  } catch {
    return null
  }
}

function readGitState () {
  const head = gitOutput(['rev-parse', 'HEAD'])
  const branch = gitOutput(['rev-parse', '--abbrev-ref', 'HEAD'])
  const dirty = gitOutput(['status', '--porcelain']) !== ''
  return { head, branch, dirty }
}

function gitOutput (args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
  return result.status === 0 ? (result.stdout || '').trim() : ''
}

function mkTmpDir () {
  return mkdtempSync(join(tmpdir(), 'ultimate-sports-release-'))
}

function parseArgs (argv) {
  const args = { out: null, stage: false, release: false, pearName: null, pearUrl: null, skipTests: false, skipBuild: false, skipSmoke: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out' && argv[i + 1]) args.out = resolve(argv[++i])
    else if (a === '--stage') args.stage = true
    else if (a === '--release') args.release = true
    else if (a === '--pear-name' && argv[i + 1]) args.pearName = argv[++i]
    else if (a === '--pear-url' && argv[i + 1]) args.pearUrl = argv[++i]
    else if (a === '--skip-tests') args.skipTests = true
    else if (a === '--skip-build') args.skipBuild = true
    else if (a === '--skip-smoke') args.skipSmoke = true
  }
  return args
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
