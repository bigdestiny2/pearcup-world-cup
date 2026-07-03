import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(new URL('..', import.meta.url).pathname)
const script = join(root, 'scripts', 'prepare-pearbrowser-release.mjs')

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
