import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { test } from 'node:test'

const root = resolve(new URL('..', import.meta.url).pathname)
const script = join(root, 'scripts', 'publish-approved-pearcup.mjs')
const sha = '184244c9078de2892f9413fc33c1abd92ebd0edcb909cac3161c09ed0e4ddc1e'

test('approved publish wrapper rejects browser-blocked gateway port 4190 before publish', () => {
  const result = run([
    '--receipt', '/tmp/missing-pearcup-release-receipt.json',
    '--sha', sha,
    '--gateway', 'http://127.0.0.1:4190/',
    '--dry-run'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /--gateway uses port 4190/)
  assert.doesNotMatch(result.stdout + result.stderr, /PearCup approved publish dry-run passed/)
  assert.doesNotMatch(result.stdout + result.stderr, /PearCup approved publish starting/)
})

test('approved publish wrapper rejects non-http gateways before publish', () => {
  const result = run([
    '--receipt', '/tmp/missing-pearcup-release-receipt.json',
    '--sha', sha,
    '--gateway', 'hyper://0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef/',
    '--dry-run'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /--gateway must be an http:\/\/ or https:\/\/ URL/)
  assert.doesNotMatch(result.stdout + result.stderr, /PearCup approved publish starting/)
})

function run (args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8'
  })
}
