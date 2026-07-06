import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const root = resolve(decodeURIComponent(new URL('..', import.meta.url).pathname))
const script = join(root, 'scripts', 'publish-approved-latest-pearcup.mjs')
const sha = '63209b225cc27814520b07a686cb5d7f08176ad4b43cbd2891752757b4de1fd5'

test('latest approved publish supplies receipt and SHA to the approved wrapper command', () => {
  const receipt = writeFixture()
  const result = run(['--latest-receipt', receipt, '--print-resolved'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /publish-approved-pearcup\.mjs/)
  assert.match(result.stdout, new RegExp(`--receipt" "${escapeRegExp(receipt)}`))
  assert.match(result.stdout, new RegExp(`--sha" "${sha}`))
})

test('latest approved publish auto-forwards configured PearBrowser gateway', () => {
  const receipt = writeFixture()
  const result = run(['--latest-receipt', receipt, '--print-resolved'], {
    PEARCUP_PEARBROWSER_GATEWAY: 'http://127.0.0.1:55409'
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /"--gateway" "http:\/\/127\.0\.0\.1:55409\/"/)
})

test('latest approved publish keeps an explicit gateway over configured default', () => {
  const receipt = writeFixture()
  const result = run([
    '--latest-receipt',
    receipt,
    '--print-resolved',
    '--gateway',
    'http://127.0.0.1:55555/'
  ], {
    PEARCUP_PEARBROWSER_GATEWAY: 'http://127.0.0.1:55409/'
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /"--gateway" "http:\/\/127\.0\.0\.1:55555\/"/)
  assert.doesNotMatch(result.stdout, /55409/)
})

test('latest approved publish refuses manual SHA overrides', () => {
  const receipt = writeFixture()
  const result = run(['--latest-receipt', receipt, '--sha', sha, '--dry-run'])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /supplies --sha from the durable handoff receipt/)
  assert.doesNotMatch(result.stdout + result.stderr, /PearCup approved publish dry-run passed/)
})

test('latest approved publish refuses stale source receipts', () => {
  const receipt = writeFixture({
    sourceGitHead: '0000000000000000000000000000000000000000'
  })
  const result = run(['--latest-receipt', receipt, '--print-resolved'])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /does not match current HEAD/)
})

test('latest approved publish refuses dirty source receipts', () => {
  const receipt = writeFixture({
    sourceDirty: true,
    sourceGitStatus: ['M design/kawaii-app/app.js']
  })
  const result = run(['--latest-receipt', receipt, '--print-resolved'])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /generated from a dirty worktree/)
})

test('latest approved publish refusal can point at a clean release checkout', () => {
  const source = readFileSync(script, 'utf8')

  assert.match(source, /findAlternateReadyRelease/)
  assert.match(source, /clean release checkout/)
  assert.match(source, /worktree', 'list', '--porcelain/)
  assert.match(source, /npm run publish:approved:latest -- --publish/)
})

function writeFixture (overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-latest-publish-'))
  const bundle = join(dir, 'bundle')
  mkdirSync(bundle)
  writeFileSync(join(bundle, 'manifest.json'), JSON.stringify({
    name: 'PearCup',
    entry: '/index.html',
    permissions: ['swarm.v1']
  }, null, 2) + '\n')
  writeFileSync(join(bundle, 'index.html'), '<!doctype html><title>PearCup</title>\n')

  const publishScript = join(dir, 'publish-and-pin.js')
  writeFileSync(publishScript, 'console.log("hyper://0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef/")\n')

  const receiptPath = join(dir, 'pearcup-release-receipt.json')
  writeFileSync(receiptPath, JSON.stringify({
    app: 'PearCup',
    sourceGitHead: currentGitHead(),
    sourceGitBranch: 'main',
    sourceDirty: false,
    sourceGitStatus: [],
    bundle,
    bundleSha256: sha,
    files: [
      {
        path: '/index.html',
        bytes: 37,
        sha256: '6f9d93770c36f7c78e47f385f4d8e7b0e0a122f489f4b4a608ee29480a5d6dd4'
      },
      {
        path: '/manifest.json',
        bytes: 77,
        sha256: '6bc3504ee8406f8ddb78943b82991b38c89ea5c7118cb42b063db4de1cb0900c'
      }
    ],
    totals: { files: 2, bytes: 114 },
    publishHandoff: {
      approvalRequired: true,
      appName: 'pearcup',
      args: [publishScript, bundle, '--name', 'pearcup'],
      updatesExistingDrive: false
    },
    postPublishVerification: {
      required: true,
      command: 'npm run smoke:pearbrowser-published -- --url hyper://<drive-key>/',
      enforcedByApprovedWrapper: true,
      resultPath: join(dir, 'pearcup-publish-result.json'),
      resultRequiresRemoteFriend: true
    },
    ...overrides
  }, null, 2) + '\n')
  return receiptPath
}

function run (args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  })
}

function escapeRegExp (value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function currentGitHead () {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
