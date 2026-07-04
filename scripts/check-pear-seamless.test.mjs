import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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

test('seamless gate supports binding checks to a provided release receipt', () => {
  const source = readFileSync(script, 'utf8')
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

  assert.match(source, /args\.receipt/)
  assert.match(source, /check-pearbrowser-publish-handoff\.mjs/)
  assert.match(source, /'--receipt'/)
  assert.match(packageJson.scripts['check:pear-seamless:latest'], /--receipt \.pearcup-release\/latest\/pearcup-release-receipt\.json/)
  assert.match(packageJson.scripts['check:pear-seamless:latest'], /--url http:\/\/127\.0\.0\.1:4186\//)
})

test('seamless published proof uses the server-advertised browser-safe URL', () => {
  const source = readFileSync(script, 'utf8')

  assert.match(source, /extractPublishedProofUrl/)
  assert.match(source, /new URL\('\/', proofUrl\)\.href/)
  assert.match(source, /published proof server used port/)
  assert.doesNotMatch(source, /'--strict-port'/)
})

function run (args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8'
  })
}
