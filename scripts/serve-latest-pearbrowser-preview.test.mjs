import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const root = resolve(decodeURIComponent(new URL('..', import.meta.url).pathname))
const script = join(root, 'scripts', 'serve-latest-pearbrowser-preview.mjs')

test('exact preview dry-run verifies receipt bundle and prints strict serve command', () => {
  const receipt = writeFixture()
  const result = run(['--receipt', receipt, '--port', '4191', '--dry-run'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /PearCup exact preview release receipt verified/)
  assert.match(result.stdout, /serve-pearbrowser-hyper\.mjs/)
  assert.match(result.stdout, /"--bundle"/)
  assert.match(result.stdout, /"--strict-port"/)
  assert.match(result.stdout, /preview url - http:\/\/127\.0\.0\.1:4191\//)
})

test('exact preview refuses stale receipt bundle hash', () => {
  const receipt = writeFixture({
    bundleSha256: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  })
  const result = run(['--receipt', receipt, '--dry-run'])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /PearCup exact preview refused/)
  assert.match(result.stderr, /does not match receipt/)
})

test('exact preview rejects browser-blocked port 4190 before serving', () => {
  const receipt = writeFixture()
  const result = run(['--receipt', receipt, '--port', '4190', '--dry-run'])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /--port 4190 is blocked/)
  assert.doesNotMatch(result.stdout, /PearCup exact preview release receipt verified/)
})

function writeFixture (overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-exact-preview-'))
  const bundle = join(dir, 'bundle')
  mkdirSync(bundle)
  writeFileSync(join(bundle, 'index.html'), '<!doctype html><title>PearCup</title>\n')
  writeFileSync(join(bundle, 'manifest.json'), JSON.stringify({
    name: 'PearCup',
    entry: '/index.html',
    permissions: ['swarm.v1']
  }, null, 2) + '\n')

  const receipt = join(dir, 'pearcup-release-receipt.json')
  writeFileSync(receipt, JSON.stringify({
    app: 'PearCup',
    bundle,
    bundleSha256: bundleInventorySha256(bundle),
    sourceGitHead: currentGitHead(),
    sourceDirty: false,
    ...overrides
  }, null, 2) + '\n')
  return receipt
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

function run (args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8'
  })
}

function currentGitHead () {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
