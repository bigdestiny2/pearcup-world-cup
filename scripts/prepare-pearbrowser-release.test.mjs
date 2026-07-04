import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(new URL('..', import.meta.url).pathname)
const script = join(root, 'scripts', 'prepare-pearbrowser-release.mjs')

test('release prep can locate PearBrowser publisher from environment override', () => {
  const source = readFileSync(script, 'utf8')

  assert.match(source, /function locateBrowserPublishScript/)
  assert.match(source, /PEARCUP_BROWSER_PUBLISH_SCRIPT/)
  assert.match(source, /PEARBROWSER_PUBLISH_SCRIPT/)
  assert.match(source, /01-browser['"], ['"]pearbrowser-desktop['"], ['"]scripts['"], ['"]publish-and-pin\.js/)
})

test('release prep enforces PearBrowser gateway-safe file sizes', () => {
  const source = readFileSync(script, 'utf8')

  assert.match(source, /PEARBROWSER_GATEWAY_SAFE_MAX_BYTES = 500_000/)
  assert.match(source, /function assertGatewaySafeFileSizes/)
  assert.match(source, /assertGatewaySafeFileSizes\(files\)/)
  assert.match(source, /pearBrowserGatewayFileSizeContract/)
})

test('release prep force refuses to delete outside the durable handoff or temp roots', () => {
  const unsafeOut = mkdtempSync(join(root, 'unsafe-release-force-'))
  const marker = join(unsafeOut, 'bundle', 'keep.txt')
  mkdirSync(join(unsafeOut, 'bundle'))
  writeFileSync(marker, 'do not delete\n')

  try {
    const result = spawnSync(process.execPath, [
      script,
      '--out',
      unsafeOut,
      '--force'
    ], {
      cwd: root,
      encoding: 'utf8'
    })

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /--force may only remove outputs inside/)
    assert.equal(existsSync(marker), true)
  } finally {
    rmSync(unsafeOut, { recursive: true, force: true })
  }
})

test('release prep force refuses to delete existing publish or friend evidence', () => {
  const releaseRoot = resolve(root, '.pearcup-release')
  mkdirSync(releaseRoot, { recursive: true })
  const out = mkdtempSync(join(releaseRoot, 'evidence-guard-'))
  const publishResult = join(out, 'pearcup-publish-result.json')
  const friendResult = join(out, 'pearcup-friend-test-result.json')
  writeFileSync(publishResult, '{"status":"published-and-smoked"}\n')
  writeFileSync(friendResult, '{"status":"remote-friend-verified"}\n')

  try {
    const result = spawnSync(process.execPath, [
      script,
      '--out',
      out,
      '--force'
    ], {
      cwd: root,
      encoding: 'utf8'
    })

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /refuses to remove publish\/friend evidence/)
    assert.match(result.stderr, /--force-evidence/)
    assert.equal(existsSync(publishResult), true)
    assert.equal(existsSync(friendResult), true)
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
})
