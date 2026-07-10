#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const appRoot = args.appRoot ? resolve(args.appRoot) : join(root, 'app')
const smokeLabel = args.label || 'Kawaii Pear run smoke'
const durationMs = Number(args.duration || 10_000)
const pear = args.pear || 'pear'

if (!existsSync(appRoot)) throw new Error(`Pear app root does not exist: ${appRoot}`)

const pearLaunchRoot = preparePearLaunchRoot(appRoot)
const bootProbe = await createBootProbe()

const fatalPatterns = [
  /PearCup fallback failed/i,
  /PearCup renderer error/i,
  /PearCup renderer promise error/i,
  /PearCup boot error/i,
  /PearCup P2P modules missing/i,
  /pearcupP2pModules.*missing/i,
  /Unexpected token 'export'/i,
  /Invalid filename:\s*\//i,
  /\/index\.cjs\+esm-wrap/i,
  /Cannot find module/i,
  /\[pearcup-world-cup\] fatal/i,
  /\bERR_LEGACY\b/i,
  /\bERR_UNKNOWN_FILE_EXTENSION\b/i
]

const allowedWarnings = [
  /Pear.worker is deprecated/i,
  /Pear.worker\.pipe\(\) is deprecated/i,
  /pear run is deprecated/i,
  /To complete Pear installation/i,
  /Until then, this executable spawns the `pear` binary/i,
  /Fix automatically with: pear run pear:\/\/runtime/i
]

const child = spawn(pear, ['run', '--dev', '--tmp-store', '--no-ask', '--no-pre', '.'], {
  cwd: pearLaunchRoot.path,
  env: {
    ...process.env,
    PEARCUP_TRACE_BRIDGE: '1',
    PEARCUP_BOOT_PROBE_URL: bootProbe.url,
    PEARCUP_BOOT_PROBE_RUNTIME_SELF_TEST: '1',
    PEARCUP_BOOT_PROBE_RUNTIME_SELF_TEST_DELAY_MS: '350'
  },
  stdio: ['ignore', 'pipe', 'pipe']
})

let output = ''
let fatal = null
let exited = false
let earlyExit = null

child.stdout.on('data', onData)
child.stderr.on('data', onData)
child.on('error', err => {
  fatal = `failed to spawn pear: ${err.message}`
})
child.on('exit', (code, signal) => {
  exited = true
  if (!fatal && code !== 0 && signal !== 'SIGINT' && signal !== 'SIGTERM') {
    earlyExit = `pear run exited early with code ${code == null ? '(none)' : code}${signal ? ` signal ${signal}` : ''}`
  }
})

await sleep(durationMs)

if (!exited) {
  child.kill('SIGINT')
  await waitForExit(child, 3_000)
}
await bootProbe.close()
pearLaunchRoot.cleanup()

const bridgeProbeEvents = extractBridgeProbeEvents(output)
const bootProbeErrors = validateBootProbe(bootProbe.received, bridgeProbeEvents)

const unexpectedWarnings = output
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
  .filter(line => /\bWARNING\b|\bDEPRECATED\b|\berror\b|\bfatal\b/i.test(line))
  .filter(line => !allowedWarnings.some(pattern => pattern.test(line)))

if (fatal || earlyExit || bootProbeErrors.length > 0 || unexpectedWarnings.length > 0) {
  console.error(`${smokeLabel} failed:`)
  if (fatal) console.error(`- ${fatal}`)
  if (earlyExit) console.error(`- ${earlyExit}`)
  for (const error of bootProbeErrors) console.error(`- ${error}`)
  for (const line of unexpectedWarnings) console.error(`- unexpected runtime output: ${line}`)
  if (output.trim()) {
    console.error('\n--- pear output ---')
    console.error(output.trim())
  }
  process.exitCode = 1
} else {
  console.log(`${smokeLabel} passed (${durationMs}ms)`)
  console.log(`ok - launched ${appRoot} with temp store`)
  console.log('ok - renderer reported P2P boot-ready through Pear bridge probe')
  console.log('ok - renderer hydrated Profile, Home, Bracket, Games, and Watch routes in the actual Pear app')
  console.log('ok - renderer opened a friend invite from Games in the actual Pear app')
  console.log('ok - hidden guest app joined the invite and completed the peer handshake')
  console.log('ok - no fallback/script-wrapper/P2P-module/fatal renderer errors observed')
  if (output.trim()) {
    const warnings = output
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .filter(line => allowedWarnings.some(pattern => pattern.test(line)))
    if (warnings.length > 0) console.log(`note - allowed Pear warnings observed: ${dedupe(warnings).join(' | ')}`)
  }
}

async function createBootProbe () {
  const state = { received: null, events: [], error: null }
  const server = createServer((req, res) => {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
    res.setHeader('access-control-allow-headers', 'content-type')
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    const requestUrl = new URL(req.url, 'http://127.0.0.1')
    if (req.method === 'GET' && requestUrl.pathname === '/pearcup-boot-probe') {
      recordProbePayload(requestUrl.searchParams.get('payload') || '{}', res)
      return
    }
    if (req.method !== 'POST' || requestUrl.pathname !== '/pearcup-boot-probe') {
      res.statusCode = 404
      res.end('not found')
      return
    }
    let body = ''
    req.setEncoding('utf8')
    req.on('data', chunk => {
      body += chunk
      if (body.length > 32_000) req.destroy(new Error('probe payload too large'))
    })
    req.on('error', err => { state.error = err })
    req.on('end', () => {
      recordProbePayload(body || '{}', res)
    })
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  return {
    get received () { return state.received },
    get events () { return state.events.slice() },
    get error () { return state.error },
    url: `http://127.0.0.1:${address.port}/pearcup-boot-probe`,
    close: () => new Promise(resolve => server.close(() => resolve()))
  }

  function recordProbePayload (body, res) {
    try {
      state.received = JSON.parse(body || '{}')
      state.events.push(state.received)
      res.statusCode = 204
      res.end()
    } catch (err) {
      state.error = err
      res.statusCode = 400
      res.end('bad json')
    }
  }
}

function extractBridgeProbeEvents (text) {
  const events = []
  const pattern = /\/boot-probe-hit\.gif\?payload=([^\s]+)/g
  let match
  while ((match = pattern.exec(text))) {
    try {
      events.push(JSON.parse(decodeURIComponent(match[1])))
    } catch (err) {
      events.push({ event: 'pearcup:probe-parse-error', status: 'error', detail: err.message })
    }
  }
  return events
}

function validateBootProbe (payload, bridgeEvents = []) {
  const errors = []
  if (bootProbe.error) errors.push(`boot probe receiver failed: ${bootProbe.error.message}`)
  const events = [...(bootProbe.events || []), ...bridgeEvents]
  const readyPayload = events.filter(event => event && event.event === 'pearcup:boot-ready' && event.status === 'ready').pop()
  if (!readyPayload) {
    const summary = events.length
      ? events.map(event => {
        const label = `${event.event || '(event missing)'}:${event.status || '(status missing)'}`
        const detail = event.title || event.detail ? ` (${event.title || event.detail})` : ''
        return label + detail
      }).join(' | ')
      : 'none'
    errors.push(`Pear renderer did not report boot-ready through the Pear bridge probe; observed probe events: ${summary}`)
    return errors
  }
  payload = readyPayload
  if (payload.event !== 'pearcup:boot-ready') errors.push(`boot probe event mismatch: ${payload.event || '(missing)'}`)
  if (payload.status !== 'ready') errors.push(`boot probe status mismatch: ${payload.status || '(missing)'}`)
  if (payload.bootReady !== 'p2p') errors.push(`boot probe bootReady mismatch: ${payload.bootReady || '(missing)'}`)
  if (payload.p2pModules !== 'ready') errors.push(`boot probe p2pModules mismatch: ${payload.p2pModules || '(missing)'}`)
  if (payload.appBooted !== true) errors.push('boot probe appBooted was not true')
  if (payload.appBootedDataset !== 'true') errors.push(`boot probe appBootedDataset was ${payload.appBootedDataset || '(missing)'}`)
  if (!payload.activeScreen) errors.push('boot probe activeScreen dataset was missing')
  const modules = payload.modules || {}
  for (const name of ['net', 'match', 'lobby', 'watch']) {
    if (modules[name] !== 'ready') errors.push(`boot probe module ${name} was ${modules[name] || '(missing)'}`)
  }
  const runtime = payload.runtime || {}
  if (runtime.uiHydrated !== 'true') errors.push(`boot probe uiHydrated was ${runtime.uiHydrated || '(missing)'}`)
  if (Number(runtime.teamCards || 0) < 32) errors.push(`boot probe teamCards was ${runtime.teamCards || '(missing)'}`)
  if (!Array.isArray(runtime.avatarImages) || !runtime.avatarImages.some(src => /avatars\//.test(String(src)))) {
    errors.push('boot probe did not report generated avatar images')
  }
  if (runtime.profileChipReady !== true) errors.push('boot probe profile chip was not hydrated')
  const controllers = runtime.controllers || {}
  for (const name of ['peerNet', 'peerMatch', 'peerLobby', 'watchSync']) {
    if (controllers[name] !== true) errors.push(`boot probe controller ${name} was not ready`)
  }
  const routeButtons = Array.isArray(runtime.routeButtons) ? runtime.routeButtons : []
  for (const view of ['onboarding', 'home', 'bracket', 'watch', 'games']) {
    if (!routeButtons.includes(view)) errors.push(`boot probe did not report the ${view} route button`)
  }
  const expectedQvacMode = process.env.PEARCUP_EXPECT_QVAC_MODE
  if (expectedQvacMode) {
    const integration = runtime.integration || {}
    if (integration.qvacMode !== expectedQvacMode) {
      errors.push(`boot probe QVAC mode was ${integration.qvacMode || '(missing)'}, expected ${expectedQvacMode}`)
    }
    if (integration.realMoneyEnabled !== false) {
      errors.push('boot probe enabled real-money settlement while checking QVAC')
    }
  }

  const selfTestPayload = events.filter(event => event && event.event === 'pearcup:runtime-self-test').pop()
  if (!selfTestPayload) {
    errors.push('Pear renderer did not report the runtime Bracket/Games/invite self-test')
    return errors
  }
  if (selfTestPayload.status !== 'ready') {
    const details = Array.isArray(selfTestPayload.errors) && selfTestPayload.errors.length
      ? `: ${selfTestPayload.errors.join('; ')}`
      : ''
    errors.push(`runtime self-test status was ${selfTestPayload.status || '(missing)'}${details}`)
  }
  if (selfTestPayload.bootReady !== 'p2p') errors.push(`runtime self-test bootReady was ${selfTestPayload.bootReady || '(missing)'}`)
  if (selfTestPayload.p2pModules !== 'ready') errors.push(`runtime self-test p2pModules was ${selfTestPayload.p2pModules || '(missing)'}`)
  const bracket = selfTestPayload.bracket || {}
  if (bracket.activeScreen !== 'bracket') errors.push(`runtime self-test bracket activeScreen was ${bracket.activeScreen || '(missing)'}`)
  if (bracket.activeScreenDataset !== 'bracket') errors.push(`runtime self-test bracket activeScreenDataset was ${bracket.activeScreenDataset || '(missing)'}`)
  if (bracket.boardVisible !== true) errors.push('runtime self-test did not show a visible Bracket board')
  if (Number(bracket.matchCards || 0) < 31) errors.push(`runtime self-test Bracket match cards was ${bracket.matchCards || '(missing)'}`)
  if (Number(bracket.pickButtons || 0) < 32) errors.push(`runtime self-test Bracket pick buttons was ${bracket.pickButtons || '(missing)'}`)
  const roundTitles = Array.isArray(bracket.roundTitles) ? bracket.roundTitles : []
  for (const title of ['Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Final']) {
    if (!roundTitles.includes(title)) errors.push(`runtime self-test Bracket missing ${title}`)
  }
  if (!Array.isArray(bracket.generatedAvatarImages) || !bracket.generatedAvatarImages.some(src => /avatars\//.test(String(src)))) {
    errors.push('runtime self-test did not render generated avatar images in Bracket')
  }
  const hashRoutes = selfTestPayload.hashRoutes || {}
  if (hashRoutes.passed !== true) errors.push('runtime self-test did not pass same-document hash route changes')
  const hashRouteResults = Array.isArray(hashRoutes.results) ? hashRoutes.results : []
  for (const view of ['onboarding', 'home', 'bracket', 'games', 'watch']) {
    const route = hashRouteResults.find(item => item && item.view === view)
    if (!route) {
      errors.push(`runtime self-test did not report hash route ${view}`)
      continue
    }
    if (route.passed !== true) errors.push(`runtime self-test hash route ${view} did not pass`)
    if (route.activeScreen !== view) errors.push(`runtime self-test hash route ${view} activeScreen was ${route.activeScreen || '(missing)'}`)
    if (route.activeScreenDataset !== view) errors.push(`runtime self-test hash route ${view} activeScreenDataset was ${route.activeScreenDataset || '(missing)'}`)
    if (view === 'onboarding') {
      if (Number(route.teamCards || 0) < 32) errors.push(`runtime self-test Profile route team cards was ${route.teamCards || '(missing)'}`)
      if (route.profileChipReady !== true) errors.push('runtime self-test Profile route did not hydrate the profile chip avatar')
      if (route.avatarPreviewReady !== true) errors.push('runtime self-test Profile route did not hydrate the avatar preview')
    }
    if (view === 'home') {
      if (Number(route.liveMenuButtons || 0) < 5) errors.push(`runtime self-test Home route live menu buttons was ${route.liveMenuButtons || '(missing)'}`)
      if (route.liveDetailReady !== true) errors.push('runtime self-test Home route did not hydrate live detail')
      if (Number(route.poolCards || 0) < 3) errors.push(`runtime self-test Home route pool cards was ${route.poolCards || '(missing)'}`)
      if (Number(route.fixtureCards || 0) < 2) errors.push(`runtime self-test Home route fixture cards was ${route.fixtureCards || '(missing)'}`)
    }
    if (view === 'watch') {
      if (route.watchChallengePanel !== true) errors.push('runtime self-test Watch route did not render the challenge panel')
      if (route.watchChallengeList !== true) errors.push('runtime self-test Watch route did not render the challenge list')
    }
  }
  if (selfTestPayload.appBootedDataset !== 'true') errors.push(`runtime self-test appBootedDataset was ${selfTestPayload.appBootedDataset || '(missing)'}`)
  if (selfTestPayload.activeScreen !== 'games') errors.push(`runtime self-test activeScreen was ${selfTestPayload.activeScreen || '(missing)'}`)
  if (selfTestPayload.activeScreenDataset !== 'games') errors.push(`runtime self-test activeScreenDataset was ${selfTestPayload.activeScreenDataset || '(missing)'}`)
  if (!Array.isArray(selfTestPayload.activeNav) || !selfTestPayload.activeNav.includes('Games')) {
    errors.push('runtime self-test did not mark Games as active in the top nav')
  }
  if (selfTestPayload.hasLobbyMascot !== true) errors.push('runtime self-test did not render the lobby mascot')
  if (!selfTestPayload.p2pBackendBadge) errors.push('runtime self-test did not render the P2P backend badge')
  if (!Array.isArray(selfTestPayload.generatedAvatarImages) || !selfTestPayload.generatedAvatarImages.some(src => /avatars\//.test(String(src)))) {
    errors.push('runtime self-test did not render generated avatar images in Games')
  }
  if (selfTestPayload.inviteModalOpen !== true) errors.push('runtime self-test did not open the invite modal')
  if (!/^[a-z0-9]{6}$/i.test(String(selfTestPayload.inviteCode || ''))) {
    errors.push(`runtime self-test invite code was invalid: ${selfTestPayload.inviteCode || '(missing)'}`)
  }
  if (!/\?join=/.test(String(selfTestPayload.inviteLink || ''))) {
    errors.push('runtime self-test invite link did not include ?join=')
  }
  const peerMatch = selfTestPayload.peerMatch || {}
  if (peerMatch.active !== true || !peerMatch.code) errors.push('runtime self-test did not leave a hosted peer match active')
  const peerHandshake = selfTestPayload.peerHandshake || {}
  if (peerHandshake.started !== true) {
    const reason = peerHandshake.reason ? `: ${peerHandshake.reason}` : ''
    errors.push(`runtime self-test did not complete hidden guest invite handshake${reason}`)
  }
  const guest = peerHandshake.guest || {}
  if (guest.booted !== 'true') errors.push(`runtime self-test guest booted was ${guest.booted || '(missing)'}`)
  if (guest.appBootedDataset !== 'true') errors.push(`runtime self-test guest appBootedDataset was ${guest.appBootedDataset || '(missing)'}`)
  if (guest.p2pModules !== 'ready') errors.push(`runtime self-test guest p2pModules was ${guest.p2pModules || '(missing)'}`)
  if (guest.activeScreen !== 'games') errors.push(`runtime self-test guest activeScreen was ${guest.activeScreen || '(missing)'}`)
  if (guest.activeScreenDataset !== 'games') errors.push(`runtime self-test guest activeScreenDataset was ${guest.activeScreenDataset || '(missing)'}`)
  if (guest.bootError) errors.push(`runtime self-test guest showed boot error: ${guest.bootError}`)
  const guestPeerMatch = guest.peerMatch || {}
  if (guestPeerMatch.started !== true || guestPeerMatch.code !== selfTestPayload.inviteCode) {
    errors.push('runtime self-test guest did not join the hosted peer match')
  }
  return errors
}

function onData (chunk) {
  const text = String(chunk)
  output += text
  if (!fatal) {
    const found = fatalPatterns.find(pattern => pattern.test(output))
    if (found) fatal = `matched fatal pattern ${found}`
  }
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function waitForExit (proc, ms) {
  if (exited) return Promise.resolve()
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      if (!exited) proc.kill('SIGTERM')
      resolve()
    }, ms)
    proc.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function dedupe (items) {
  return [...new Set(items)]
}

function preparePearLaunchRoot (sourceRoot) {
  // Pear currently treats a space in the project path as a URL-encoded filename
  // (`pear%20sports`), then fails its package-root check before the renderer starts.
  // The smoke must validate the app rather than the checkout's directory spelling.
  if (!/\s/.test(sourceRoot)) {
    return { path: sourceRoot, cleanup: () => {} }
  }

  const tempRoot = mkdtempSync(join(tmpdir(), 'pearcup-kawaii-pear-smoke-'))
  const copiedAppRoot = join(tempRoot, 'app')
  cpSync(sourceRoot, copiedAppRoot, { recursive: true, dereference: true })
  return {
    path: copiedAppRoot,
    cleanup: () => rmSync(tempRoot, { recursive: true, force: true })
  }
}

function parseArgs (argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--duration') parsed.duration = argv[++i]
    else if (arg.startsWith('--duration=')) parsed.duration = arg.slice('--duration='.length)
    else if (arg === '--app-root') parsed.appRoot = argv[++i]
    else if (arg.startsWith('--app-root=')) parsed.appRoot = arg.slice('--app-root='.length)
    else if (arg === '--label') parsed.label = argv[++i]
    else if (arg.startsWith('--label=')) parsed.label = arg.slice('--label='.length)
    else if (arg === '--pear') parsed.pear = argv[++i]
    else if (arg.startsWith('--pear=')) parsed.pear = arg.slice('--pear='.length)
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return parsed
}
