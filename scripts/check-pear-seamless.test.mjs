import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(new URL('..', import.meta.url).pathname)
const script = join(root, 'scripts', 'check-pear-seamless.mjs')

test('seamless gate rejects browser-blocked proof port 4190 before running heavy checks', () => {
  const result = run(['--proof-port', '4190', '--allow-dirty'])
  const output = result.stdout + result.stderr

  assert.notEqual(result.status, 0)
  assert.match(output, /--proof-port 4190 is blocked/)
  assert.doesNotMatch(output, /PearBrowser publish handoff/)
  assert.doesNotMatch(output, /Exact receipt published-link proof/)
})

test('seamless gate rejects invalid proof ports before running heavy checks', () => {
  const result = run(['--proof-port', '70000', '--allow-dirty'])
  const output = result.stdout + result.stderr

  assert.notEqual(result.status, 0)
  assert.match(output, /Invalid --proof-port: 70000/)
  assert.doesNotMatch(output, /PearBrowser publish handoff/)
  assert.doesNotMatch(output, /Exact receipt published-link proof/)
})

function run (args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8'
  })
}
