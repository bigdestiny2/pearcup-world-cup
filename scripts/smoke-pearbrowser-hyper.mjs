#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const bundle = args.bundle
  ? resolve(args.bundle)
  : buildBundle()

const errors = []

checkRequiredFiles()
checkForbiddenFiles()
checkManifest()
checkRendererReferences()
checkBootContract()
checkAssetPayload()

if (errors.length > 0) {
  console.error('PearBrowser Hyper smoke check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`PearBrowser Hyper smoke check passed: ${bundle}`)
}

function buildBundle () {
  const out = mkdtempSync(join(tmpdir(), 'pearcup-hyper-smoke-'))
  const result = spawnSync(process.execPath, [
    join(root, 'scripts', 'build-pearbrowser-hyper.mjs'),
    '--out',
    out
  ], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`build-pearbrowser-hyper failed${detail ? `:\n${detail}` : ''}`)
  }
  return out
}

function checkRequiredFiles () {
  for (const filePath of [
    'manifest.json',
    'index.html',
    'styles.css',
    'app.js',
    'peer-hiverelay.js',
    'peer-net.js',
    'peer-match.js',
    'peer-lobby.js',
    'watch-sync.js',
    'live-match.json',
    'assets/stadium-bg.png',
    'assets/ball.png',
    'assets/confetti.png',
    'assets/mascot.png',
    'avatars/captain-br.png',
    'avatars/p-aria.png',
    'crests/wm26.png'
  ]) {
    if (!exists(filePath)) errors.push(`missing required payload file: /${filePath}`)
  }
}

function checkForbiddenFiles () {
  for (const filePath of [
    'index.cjs',
    'package.json',
    'pear-worker.cjs',
    'swarm-worker.cjs',
    'package-lock.json'
  ]) {
    if (exists(filePath)) errors.push(`PearBrowser payload must not include /${filePath}`)
  }

  for (const dirPath of ['node_modules', '.git']) {
    if (exists(dirPath)) errors.push(`PearBrowser payload must not include /${dirPath}`)
  }
}

function checkManifest () {
  const manifest = readJson('manifest.json')
  if (!manifest) return
  if (manifest.name !== 'PearCup') errors.push('manifest name must be PearCup')
  if (manifest.entry !== '/index.html') errors.push('manifest entry must be /index.html')
  if (!Array.isArray(manifest.permissions) || !manifest.permissions.includes('swarm.v1')) {
    errors.push('manifest permissions must include swarm.v1')
  }
  if (!manifest.icon || !exists(stripLeadingSlash(manifest.icon))) {
    errors.push(`manifest icon is missing from payload: ${manifest.icon || '(none)'}`)
  }
}

function checkRendererReferences () {
  const html = readText('index.html')
  if (!html) return

  const scriptRefs = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(match => match[1])
  for (const ref of scriptRefs) {
    const filePath = normalizeLocalRef(ref)
    if (!filePath) errors.push(`script ref must be local and relative: ${ref}`)
    else if (!exists(filePath)) errors.push(`script ref is missing from payload: ${ref}`)
  }
  const bootIndex = scriptRefs.indexOf('./pearcup-boot.js')
  const appIndex = scriptRefs.indexOf('./app.js')
  if (bootIndex < 0 && appIndex < 0) errors.push('index.html must load ./pearcup-boot.js or ./app.js')
  if (bootIndex >= 0) {
    const bootLoader = readText('pearcup-boot.js') || ''
    for (const ref of [
      './settlement-receipts.js',
      './worker-sim.js',
      './storage-sim.js',
      './transport-sim.js',
      './worker-runtime.js',
      './settlement-service.js',
      './worker-client.js',
      './peer-hiverelay.js',
      './peer-net.js',
      './peer-match.js',
      './peer-lobby.js',
      './watch-sync.js',
      './app.js'
    ]) {
      if (!bootLoader.includes(ref)) errors.push(`pearcup-boot.js must bundle ${ref}`)
    }
  } else {
    if (!scriptRefs.includes('./peer-hiverelay.js')) errors.push('index.html must load ./peer-hiverelay.js')
    if (!scriptRefs.includes('./peer-net.js')) errors.push('index.html must load ./peer-net.js')
    for (const ref of ['./peer-hiverelay.js', './peer-net.js', './peer-match.js', './peer-lobby.js', './watch-sync.js']) {
      const refIndex = scriptRefs.indexOf(ref)
      if (refIndex < 0) errors.push(`index.html must load ${ref}`)
      else if (appIndex >= 0 && refIndex > appIndex) errors.push(`${ref} must load before ./app.js`)
    }
  }

  const stylesheetRefs = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map(match => match[1])
  for (const ref of stylesheetRefs) {
    const filePath = normalizeLocalRef(ref)
    if (!filePath) errors.push(`stylesheet ref must be local and relative: ${ref}`)
    else if (!exists(filePath)) errors.push(`stylesheet ref is missing from payload: ${ref}`)
  }

  if (/<script\b[^>]*\btype=["']module["']/i.test(html)) {
    errors.push('PearBrowser payload must not rely on module scripts')
  }
  if (/\/index\.cjs(?:\+esm-wrap)?/.test(html)) {
    errors.push('index.html must not reference /index.cjs or /index.cjs+esm-wrap')
  }
}

function checkBootContract () {
  const html = readText('index.html') || ''
  const app = readText('app.js') || ''
  const boot = readText('pearcup-boot.js') || ''
  const peerHiveRelay = readText('peer-hiverelay.js') || ''
  const peerNet = readText('peer-net.js') || ''
  const peerMatch = readText('peer-match.js') || ''
  const peerLobby = readText('peer-lobby.js') || ''
  const watchSync = readText('watch-sync.js') || ''
  const styles = readText('styles.css') || ''

  checkFallbackContract(html)
  assertText(html, './pearcup-boot.js', 'index.html loads the PearCup boot bundle')
  assertText(html, 'p2pModulesReady', 'index.html fallback must check P2P readiness before accepting hydration')
  assertText(html, 'pearcupP2pModules', 'index.html fallback must require app-level P2P readiness')
  assertText(html, 'pearcupPeerMatchModule', 'index.html fallback must require peer match readiness')
  assertText(app, "data-pearcup-booted', 'true", 'app.js marks successful boot')
  assertText(app, 'emitBootReadyMarker', 'app.js emits a positive boot-ready diagnostic')
  assertText(app, 'Penalty Clash · Lobby', 'app.js contains the Penalty Clash lobby')
  assertText(app, 'p2pBackendBadge', 'app.js surfaces the active P2P backend in the Games lobby')
  assertText(app, 'leaveGameToLobby', 'app.js exposes a visible lobby escape from active Penalty Clash matches')
  assertText(app, 'assertP2PModulesReady', 'app.js must assert P2P modules before marking boot success')
  assertText(app, 'pearcupP2pModules', 'app.js must expose P2P module readiness diagnostics')
  assertText(app, 'syncRuntimeScreenDiagnostics', 'app.js must mirror normal route readiness diagnostics')
  assertText(app, 'pearcupActiveScreen', 'app.js must expose active screen diagnostics')
  assertText(app, 'pearcupAppBooted', 'app.js must expose app booted diagnostics')
  assertText(app, 'bootRuntimeDiagnostics', 'app.js must report hydrated UI and P2P controller diagnostics at boot')
  assertText(app, 'profileChipReady', 'app.js boot diagnostics must prove the profile chip hydrated')
  assertText(app, 'URLSearchParams(location.search)', 'app.js reads deep-link query params')
  assertText(app, "get('join')", 'app.js reads ?join= room codes')
  assertText(app, 'window.PearCupPeerMatch', 'app.js probes the friend match controller')
  assertText(app, 'peerMatch.join(code)', 'app.js auto-joins friend invite links')
  assertText(app, 'tryJoinFriendInvite', 'app.js keeps a retryable friend invite auto-join path')
  assertText(app, 'pearcupPendingJoin', 'app.js marks pending friend invite state for first-run diagnostics')
  assertText(app, 'completeProfileOnboarding', 'profile save must preserve pending friend invite deep links')
  assertText(app, 'Round of 32', 'app.js keeps Round of 32 as the current round')
  assertNotText(app, /\bItaly\b/, 'app.js must not include Italy as a current competition team')
  assertText(app, 'preferLocal: !integrationRuntime.canUseRealMoney', 'app.js must keep demo settlements on the local worker client')
  assertText(app, 'requireLive: integrationRuntime.canUseRealMoney', 'app.js must pass demo/live mode to settlement receipt requests')
  assertText(boot, 'PearCupWorkerClient', 'pearcup-boot.js must bundle the worker client for settlement evidence')
  assertText(boot, 'PearCupSettlementService', 'pearcup-boot.js must bundle the settlement service')
  assertText(boot, 'PearCupWorkerSim', 'pearcup-boot.js must bundle the worker simulator')
  assertText(boot, 'PearCupStorageSim', 'pearcup-boot.js must bundle settlement storage replay helpers')
  assertText(boot, 'PearCupTransportSim', 'pearcup-boot.js must bundle P2P settlement replay helpers')
  assertText(boot, 'PearCupHiveRelay', 'pearcup-boot.js must bundle HiveRelay browser transport')
  assertText(peerHiveRelay, 'pearcup-sync-v2', 'peer-hiverelay.js must use the PearCup cross-platform sync protocol')
  assertText(peerHiveRelay, '/api/swarm/events', 'peer-hiverelay.js must use HiveRelay swarm SSE')
  assertText(peerHiveRelay, 'Ed25519', 'peer-hiverelay.js must sign relay frames in the client')
  assertNotText(peerHiveRelay, /\bexport\s+default\b/, 'peer-hiverelay.js must not be an ESM wrapper')
  assertText(peerNet, 'pear.swarm.v1', 'peer-net.js probes PearBrowser swarm.v1')
  assertText(peerNet, 'pearcup.peer-net.v1', 'peer-net.js uses the PearCup peer protocol name')
  assertText(peerNet, 'broadcast-channel', 'peer-net.js keeps plain-browser dev fallback')
  assertText(peerNet, 'pearcupPeerNetModule', 'peer-net.js must mark module readiness')
  assertNotText(peerNet, /\bexport\s+default\b/, 'peer-net.js must not be an ESM wrapper')
  assertText(peerMatch, 'pearcupPeerMatchModule', 'peer-match.js must mark module readiness')
  assertText(peerMatch, 'pearcupPeerMatchState', 'peer-match.js must expose DOM diagnostics for live match state')
  assertText(peerMatch, 'pearcupPeerMatchStarted', 'peer-match.js must expose started state for live friend-proof diagnostics')
  assertText(peerMatch, 'hyperLaunchBase', 'peer-match.js builds friend invites from PearBrowser hyper:// launch URLs')
  assertText(peerMatch, 'hyper://', 'peer-match.js can share hyper:// invite links for remote friends')
  assertNotText(peerMatch, 'location.origin + location.pathname', 'peer-match.js must not share localhost proxy invite URLs')
  assertText(peerLobby, 'pearcupPeerLobbyModule', 'peer-lobby.js must mark module readiness')
  assertText(watchSync, 'pearcupWatchSyncModule', 'watch-sync.js must mark module readiness')
  assertText(styles, "url('assets/stadium-bg.png')", 'styles.css references the Penalty Clash stadium art')
  assertText(styles, "url('assets/ball.png')", 'styles.css references the Penalty Clash ball art')
}

function checkFallbackContract (html) {
  for (const [needle, message] of [
    ['function notice (title, detail)', 'index.html defines the visible boot failure notice renderer'],
    ["bar.id = 'bootErrorBar'", 'index.html renders fallback/boot errors into #bootErrorBar'],
    ["bar.textContent = title + (detail ? '\\n' + detail : '')", 'index.html surfaces fallback error details in #bootErrorBar'],
    ["sendBootProbe({ event: 'pearcup:fallback-notice'", 'index.html reports fallback notices through the boot probe'],
    ["function clearNotice ()", 'index.html defines fallback notice cleanup'],
    ['if (bar) bar.remove()', 'index.html removes stale fallback notices after boot'],
    ["root.addEventListener('pearcup:booted', clearNotice)", 'index.html clears fallback notices when the app boots'],
    ["notice('PearCup fallback loaded the visual shell, but the app did not finish booting.'", 'index.html keeps the visual-shell failure notice'],
    ["notice('PearCup app script loaded, but boot did not complete.'", 'index.html keeps the app-loaded boot failure notice'],
    ["notice('PearCup fallback failed.'", 'index.html keeps the script-load fallback failure notice'],
    ["root.addEventListener('error'", 'index.html surfaces renderer errors through the fallback banner'],
    ["root.addEventListener('unhandledrejection'", 'index.html surfaces renderer promise errors through the fallback banner']
  ]) {
    assertText(html, needle, message)
  }
}

function checkAssetPayload () {
  for (const [filePath, minBytes] of [
    ['assets/stadium-bg.png', 10_000],
    ['assets/ball.png', 5_000],
    ['assets/confetti.png', 5_000],
    ['avatars/captain-br.png', 5_000],
    ['avatars/p-aria.png', 5_000],
    ['crests/wm26.png', 5_000]
  ]) {
    if (!exists(filePath)) continue
    const size = statSync(join(bundle, filePath)).size
    if (size < minBytes) errors.push(`asset looks too small or empty: /${filePath} (${size} bytes)`)
  }
}

function assertText (text, needle, message) {
  if (typeof needle === 'string') {
    if (!text.includes(needle)) errors.push(message)
  } else if (!needle.test(text)) {
    errors.push(message)
  }
}

function assertNotText (text, needle, message) {
  if (typeof needle === 'string') {
    if (text.includes(needle)) errors.push(message)
  } else if (needle.test(text)) {
    errors.push(message)
  }
}

function readText (filePath) {
  try {
    return readFileSync(join(bundle, filePath), 'utf8')
  } catch (err) {
    errors.push(`could not read /${filePath}: ${err.message}`)
    return null
  }
}

function readJson (filePath) {
  const text = readText(filePath)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (err) {
    errors.push(`could not parse /${filePath}: ${err.message}`)
    return null
  }
}

function normalizeLocalRef (ref) {
  if (/^[a-z]+:/i.test(ref) || ref.startsWith('//') || ref.startsWith('/')) return null
  return stripLeadingSlash(ref.split(/[?#]/)[0]).replace(/^\.\//, '')
}

function stripLeadingSlash (filePath) {
  return String(filePath || '').replace(/^\/+/, '')
}

function exists (filePath) {
  return existsSync(join(bundle, filePath))
}

function parseArgs (argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--bundle') parsed.bundle = argv[++i]
    else if (arg.startsWith('--bundle=')) parsed.bundle = arg.slice('--bundle='.length)
  }
  return parsed
}
