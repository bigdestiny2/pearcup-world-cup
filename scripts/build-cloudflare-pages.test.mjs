import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const root = resolve(decodeURIComponent(new URL('..', import.meta.url).pathname))
const builderPath = join(root, 'scripts', 'build-cloudflare-pages.mjs')
const dist = join(root, 'cloudflare', 'pages-dist')

test('Cloudflare Pages builder has production-safe defaults and an explicit offline escape hatch', () => {
  const source = readFileSync(builderPath, 'utf8')

  assert.match(source, /DEFAULT_IDENTITY_API\s*=\s*['"]https:\/\/pearcup-kawaii-identity\./)
  assert.ok(source.includes("DEFAULT_HIVERELAY_URL = 'https://relay-sg.p2phiverelay.xyz'"))
  assert.match(source, /DEFAULT_LIVE_DATA_URL\s*=\s*['"]https:\/\/pearcup-live-data\./)
  assert.match(source, /PEARCUP_ALLOW_EMPTY_PUBLIC_SETTINGS/)
  assert.match(source, /assertLivePublicSettings\(settings\)/)
})

test('the Pages index loads a live, content-addressed settings file', () => {
  const env = { ...process.env }
  delete env.PEARCUP_IDENTITY_API_URL
  delete env.PEARCUP_HIVERELAY_URL
  delete env.PEARCUP_LIVE_DATA_RELAY_URL
  delete env.PEARCUP_ALLOW_EMPTY_PUBLIC_SETTINGS
  const build = spawnSync(process.execPath, [builderPath], { cwd: root, env, encoding: 'utf8' })
  assert.equal(build.status, 0, build.stderr)

  const page = readFileSync(join(dist, 'play', 'index.html'), 'utf8')
  const match = page.match(/\.\/(public-runtime-settings\.[a-f0-9]{12}\.js)/)
  assert.ok(match, 'index.html must load the hashed runtime settings file')

  const settingsPath = join(dist, 'play', match[1])
  assert.equal(existsSync(settingsPath), true)
  const settings = readFileSync(settingsPath, 'utf8')
  assert.match(settings, /liveData:\s*\{\s*relayUrl:\s*["']https:\/\/[^"']+\.json["']/)
  assert.match(settings, /oddsRelayUrl:\s*["']https:\/\/[^"']+\.json["']/)
  assert.match(settings, /peerRelay:\s*\{\s*enabled:\s*true,\s*relayUrl:\s*["']https:\/\//)
  assert.match(settings, /identity:\s*\{\s*enabled:\s*true,\s*apiUrl:\s*["']https:\/\//)
  assert.doesNotMatch(settings, /liveData:\s*null/)
  assert.doesNotMatch(settings, /peerRelay:\s*null/)
})
