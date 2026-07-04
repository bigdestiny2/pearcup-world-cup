#!/usr/bin/env node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const bundle = args.bundle ? resolve(args.bundle) : mkdtempSync(join(tmpdir(), 'pearcup-friend-ready-'))
const builtBundle = !args.bundle
const checks = []
const errors = []

runCheck('Kawaii Pear runtime package', 'scripts/check-kawaii-runtime.mjs')
runCheck('Kawaii Pear runtime launch smoke', 'scripts/smoke-kawaii-pear-run.mjs')
runNodeTest('Kawaii P2P preview and PearBrowser smoke', 'design/kawaii-app/peer-preview-smoke.test.js')
if (builtBundle) runCheck('PearBrowser Hyper build', 'scripts/build-pearbrowser-hyper.mjs', ['--out', bundle])
runCheck('PearBrowser Hyper smoke', 'scripts/smoke-pearbrowser-hyper.mjs', ['--bundle', bundle])

if (args.url) await checkPreviewUrl(args.url)

if (errors.length > 0) {
  console.error('PearCup friend-test readiness failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('PearCup friend-test readiness passed')
  for (const check of checks) console.log(`ok - ${check}`)
  console.log(`ok - checked bundle: ${bundle}`)
  if (args.url) console.log(`ok - checked preview URL: ${args.url}`)
  console.log('next - publish/pin the Hyperdrive build only after explicit approval')
}

function runCheck (label, script, scriptArgs = []) {
  const result = spawnSync(process.execPath, [join(root, script), ...scriptArgs], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    errors.push(`${label} failed${detail ? `:\n${detail}` : ''}`)
  } else {
    checks.push(label)
  }
}

function runNodeTest (label, script) {
  const result = spawnSync(process.execPath, ['--test', join(root, script)], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    errors.push(`${label} failed${detail ? `:\n${detail}` : ''}`)
  } else {
    checks.push(label)
  }
}

async function checkPreviewUrl (url) {
  const base = new URL(url)
  const index = await fetchText(new URL('/', base), 'index.html')
  const manifest = await fetchJson(new URL('/manifest.json', base), 'manifest.json')
  const bootLoader = await fetchText(new URL('/pearcup-boot.js', base), 'pearcup-boot.js')
  const styles = await fetchText(new URL('/styles.css', base), 'styles.css')
  const app = await fetchText(new URL('/app.js', base), 'app.js')
  const peerNet = await fetchText(new URL('/peer-net.js', base), 'peer-net.js')
  const peerMatch = await fetchText(new URL('/peer-match.js', base), 'peer-match.js')
  const peerLobby = await fetchText(new URL('/peer-lobby.js', base), 'peer-lobby.js')
  const watchSync = await fetchText(new URL('/watch-sync.js', base), 'watch-sync.js')
  await fetchHead(new URL('/assets/stadium-bg.png', base), 'stadium art')
  await fetchHead(new URL('/assets/ball.png', base), 'ball art')
  await fetchHead(new URL('/assets/confetti.png', base), 'confetti art')
  await fetchHead(new URL('/assets/mascot.png', base), 'mascot art')
  await fetchHead(new URL('/avatars/captain-br.png', base), 'captain avatar')
  await fetchHead(new URL('/avatars/p-aria.png', base), 'generated avatar p-aria')
  await fetchHead(new URL('/avatars/p-tariq.png', base), 'generated avatar p-tariq')
  await fetchHead(new URL('/crests/wm26.png', base), 'tournament crest')

  if (index && !index.includes('./pearcup-boot.js')) {
    errors.push('preview index.html does not load ./pearcup-boot.js')
  }
  if (index) {
    if (!index.includes('p2pModulesReady') || !index.includes('pearcupP2pModules')) {
      errors.push('preview index.html fallback can accept hydration without P2P readiness')
    }
    for (const marker of ['pearcupPeerNetModule', 'pearcupPeerMatchModule', 'pearcupPeerLobbyModule', 'pearcupWatchSyncModule']) {
      if (!index.includes(marker)) errors.push(`preview index.html fallback does not require ${marker}`)
    }
    if (/<script\b[^>]*\btype=["']module["']/i.test(index)) errors.push('preview index.html must not rely on module scripts')
  }
  if (bootLoader) {
    for (const ref of ['./peer-net.js', './peer-match.js', './peer-lobby.js', './watch-sync.js', './app.js']) {
      if (!bootLoader.includes(ref)) errors.push(`preview pearcup-boot.js does not load ${ref}`)
    }
    if (!bootLoader.includes('pearcup:runtime-self-test') || !bootLoader.includes('runBootRuntimeSelfTest')) {
      errors.push('preview pearcup-boot.js does not include the Pear runtime Games/invite self-test')
    }
    if (!bootLoader.includes('runRuntimePeerHandshakeSelfTest') || !bootLoader.includes('pearcupRuntimeSelfTestGuest')) {
      errors.push('preview pearcup-boot.js does not include the hidden guest invite handshake self-test')
    }
    checkNoBareP2PControllerCalls(bootLoader, 'preview pearcup-boot.js')
  }
  if (index && /\/index\.cjs(?:\+esm-wrap)?/.test(index)) {
    errors.push('preview index.html exposes /index.cjs or /index.cjs+esm-wrap')
  }
  if (manifest) {
    if (manifest.entry !== '/index.html') errors.push('preview manifest entry must be /index.html')
    if (!Array.isArray(manifest.permissions) || !manifest.permissions.includes('swarm.v1')) {
      errors.push('preview manifest must include swarm.v1 permission')
    }
  }
  if (styles) {
    for (const [needle, message] of [
      ["url('assets/stadium-bg.png')", 'preview styles.css does not reference the Penalty Clash stadium art'],
      ["url('assets/ball.png')", 'preview styles.css does not reference the Penalty Clash ball art'],
      ["url('assets/confetti.png')", 'preview styles.css does not reference the Penalty Clash confetti art']
    ]) {
      if (!styles.includes(needle)) errors.push(message)
    }
  }
  if (peerNet) {
    if (!peerNet.includes('pear.swarm.v1')) errors.push('preview peer-net.js is missing PearBrowser swarm.v1 transport')
    if (!peerNet.includes('pearcup.peer-net.v1')) errors.push('preview peer-net.js is missing PearCup protocol label')
    if (!peerNet.includes('broadcast-channel')) errors.push('preview peer-net.js is missing the plain-browser dev fallback')
    if (!peerNet.includes('pearcupPeerNetModule')) errors.push('preview peer-net.js does not mark module readiness')
    if (/\bexport\s+default\b/.test(peerNet)) errors.push('preview peer-net.js looks like an ESM wrapper')
  }
  if (app && !app.includes('p2pBackendBadge')) {
    errors.push('preview app.js does not surface the active P2P backend')
  }
  if (app) {
    if (!app.includes('URLSearchParams(location.search)') || !app.includes("get('join')")) {
      errors.push('preview app.js does not read ?join= deep-link room codes')
    }
    if (!app.includes('window.PearCupPeerMatch') || !app.includes('peerMatch.join(code)')) {
      errors.push('preview app.js does not auto-join friend invite links')
    }
    if (!app.includes('tryJoinFriendInvite') || !app.includes('pearcupPendingJoin')) {
      errors.push('preview app.js does not keep a retryable pending friend invite path')
    }
    if (!app.includes('completeProfileOnboarding')) {
      errors.push('preview profile save can drop pending friend invite deep links')
    }
    if (!app.includes('assertP2PModulesReady') || !app.includes('pearcupP2pModules')) {
      errors.push('preview app.js can mark boot success without P2P module readiness')
    }
    if (!app.includes('syncRuntimeScreenDiagnostics') || !app.includes('pearcupActiveScreen') || !app.includes('pearcupAppBooted')) {
      errors.push('preview app.js does not expose normal route/app boot diagnostics')
    }
    if (!app.includes('bootRuntimeDiagnostics') || !app.includes('profileChipReady')) {
      errors.push('preview app.js boot probe does not prove hydrated UI and P2P controllers')
    }
    if (!app.includes('emitBootReadyMarker')) {
      errors.push('preview app.js does not emit a positive boot-ready diagnostic')
    }
    for (const [needle, message] of [
      ['runBootRuntimeSelfTest', 'preview app.js does not include the Pear runtime Games/invite self-test'],
      ['runtimeBracketEvidence', 'preview app.js runtime self-test does not collect Bracket render evidence'],
      ['Bracket board rendered', 'preview app.js runtime self-test does not fail blank Bracket boards'],
      ['Bracket route did not render generated avatar images', 'preview app.js runtime self-test does not prove Bracket generated avatars'],
      ['runRuntimePeerHandshakeSelfTest', 'preview app.js runtime self-test does not launch a hidden guest invite join'],
      ['pearcupRuntimeSelfTestGuest', 'preview app.js runtime self-test does not mark hidden guest instances'],
      ['pearcup:runtime-self-test', 'preview app.js does not emit the runtime self-test probe'],
      ['PearCupPeerMatch.host()', 'preview app.js runtime self-test does not exercise friend invite hosting'],
      ['leaveGameToLobby', 'preview app.js does not expose a visible lobby escape from active Penalty Clash matches'],
      ['AVATAR_PORTRAITS', 'preview app.js does not hydrate the generated avatar portrait map'],
      ['avatars/p-aria.png', 'preview app.js does not reference generated avatar p-aria'],
      ['avatars/p-tariq.png', 'preview app.js does not reference generated avatar p-tariq'],
      ['assets/mascot.png', 'preview app.js does not reference the lobby mascot art'],
      ['Round of 32', 'preview app.js does not keep current Round of 32 bracket state']
    ]) {
      if (!app.includes(needle)) errors.push(message)
    }
    checkNoBareP2PControllerCalls(app, 'preview app.js')
    if (/\bItaly\b/.test(app)) errors.push('preview app.js must not include Italy as a current competition team')
  }
  if (peerMatch) {
    if (!peerMatch.includes('pearcupPeerMatchModule')) {
      errors.push('preview peer-match.js does not mark module readiness')
    }
    if (!peerMatch.includes('pearcupPeerMatchState') || !peerMatch.includes('pearcupPeerMatchStarted')) {
      errors.push('preview peer-match.js does not expose DOM diagnostics for live match state')
    }
    if (!peerMatch.includes('hyperLaunchBase') || !peerMatch.includes('hyper://')) {
      errors.push('preview peer-match.js does not build shareable hyper:// invite links')
    }
    if (peerMatch.includes('location.origin + location.pathname')) {
      errors.push('preview peer-match.js still shares localhost proxy invite links')
    }
  }
  if (peerLobby) {
    if (!peerLobby.includes('PearCupPeerNet')) errors.push('preview peer-lobby.js does not use shared PearCup peer transport')
    if (!peerLobby.includes('PearCupPeerMatch')) errors.push('preview peer-lobby.js does not route to Penalty Clash peer match')
    if (!peerLobby.includes('pearcupPeerLobbyModule')) errors.push('preview peer-lobby.js does not mark module readiness')
  }
  if (watchSync) {
    if (!watchSync.includes('PearCupPeerNet')) errors.push('preview watch-sync.js does not use shared PearCup peer transport')
    if (!watchSync.includes('pearcupWatchSyncModule')) errors.push('preview watch-sync.js does not mark module readiness')
  }
  if (!errors.some(error => error.startsWith('preview'))) checks.push('Live preview URL')
}

function checkNoBareP2PControllerCalls (source, label) {
  for (const [globalName, methods] of [
    ['PearCupPeerMatch', ['host', 'join', 'promptJoin', 'onZone', 'isActive', 'leave', 'render', 'reset']],
    ['PearCupPeerNet', ['digest', 'createChannel', 'newPeerId', 'topicFor']],
    ['PearCupLobby', ['join', 'renderList']],
    ['PearCupWatchSync', ['ensureRoom', 'bindReactionBar', 'updatePresence', 'broadcastChat']]
  ]) {
    for (const leak of bareControllerCallLines(source, globalName, methods)) {
      errors.push(`${label} makes an executable bare ${globalName} call at line ${leak.line}: ${leak.source.trim()}`)
    }
  }
}

function bareControllerCallLines (source, globalName, methods) {
  const methodPattern = methods.map(method => method.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const callPattern = new RegExp(`(^|[^\\w.])${globalName}\\.(${methodPattern})\\s*\\(`)
  return source.split('\n').map((line, index) => {
    const withoutStrings = line
      .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')
      .replace(/\/\/.*$/, '')
    return { line: index + 1, source: line, withoutStrings }
  }).filter(entry => callPattern.test(entry.withoutStrings) && !entry.withoutStrings.includes(`window.${globalName}.`))
}

async function fetchText (url, label) {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      errors.push(`preview ${label} returned HTTP ${res.status}`)
      return null
    }
    return await res.text()
  } catch (err) {
    errors.push(`preview ${label} could not be fetched: ${err.message}`)
    return null
  }
}

async function fetchJson (url, label) {
  const text = await fetchText(url, label)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (err) {
    errors.push(`preview ${label} is not valid JSON: ${err.message}`)
    return null
  }
}

async function fetchHead (url, label) {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    if (!res.ok) errors.push(`preview ${label} returned HTTP ${res.status}`)
    else if (Number(res.headers.get('content-length') || 0) <= 0) errors.push(`preview ${label} has empty content-length`)
  } catch (err) {
    errors.push(`preview ${label} could not be fetched: ${err.message}`)
  }
}

function parseArgs (argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--bundle') parsed.bundle = argv[++i]
    else if (arg.startsWith('--bundle=')) parsed.bundle = arg.slice('--bundle='.length)
    else if (arg === '--url') parsed.url = argv[++i]
    else if (arg.startsWith('--url=')) parsed.url = arg.slice('--url='.length)
  }
  return parsed
}
