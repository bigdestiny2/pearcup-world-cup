#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const checks = []
const args = parseArgs(process.argv.slice(2))

const appUrl = normalizeAppUrl(args)

if (!appUrl) {
  usage()
  if (errors.length > 0) {
    console.error('Errors:')
    for (const error of errors) console.error(`- ${error}`)
  }
  process.exit(1)
}

await checkPublishedUrl(appUrl)

if (errors.length > 0) {
  console.error('PearBrowser published link smoke failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('PearBrowser published link smoke passed')
  for (const check of checks) console.log(`ok - ${check}`)
  console.log(`app URL - ${appUrl.href}`)
  console.log(`deep link - ${new URL(`?join=smoke-${Date.now().toString(36)}`, appUrl).href}`)
}

async function checkPublishedUrl (appUrl) {
  if (isLocalPreview4186(appUrl)) {
    errors.push('use check:friend-ready:preview for 4186; published smoke must target PearBrowser hyper/gateway URL')
    return
  }
  if (isLocalhost(appUrl) && !/\/(?:app|hyper)\/[0-9a-f]{64}(?:\/|$)/i.test(appUrl.pathname)) {
    errors.push('local PearBrowser smoke URL must look like /app/<64-hex-drive>/ or /hyper/<64-hex-drive>/')
  }

  const rootHtml = await fetchText(new URL('./', appUrl), 'published app root', { gatewayProbe: true })
  if (!rootHtml && isLocalhost(appUrl)) return
  const deepHtml = await fetchText(new URL('?join=smoke-room', appUrl), 'published deep link')
  const manifest = await fetchJson(new URL('./manifest.json', appUrl), 'published manifest.json')
  const bootLoader = await fetchText(new URL('./pearcup-boot.js', appUrl), 'published pearcup-boot.js')
  const styles = await fetchText(new URL('./styles.css', appUrl), 'published styles.css')
  const app = await fetchText(new URL('./app.js', appUrl), 'published app.js')
  const peerNet = await fetchText(new URL('./peer-net.js', appUrl), 'published peer-net.js')
  const peerMatch = await fetchText(new URL('./peer-match.js', appUrl), 'published peer-match.js')
  const peerLobby = await fetchText(new URL('./peer-lobby.js', appUrl), 'published peer-lobby.js')
  const watchSync = await fetchText(new URL('./watch-sync.js', appUrl), 'published watch-sync.js')
  await fetchAsset(new URL('./assets/stadium-bg.png', appUrl), 'published stadium art', 10_000)
  await fetchAsset(new URL('./assets/ball.png', appUrl), 'published ball art', 5_000)
  await fetchAsset(new URL('./assets/confetti.png', appUrl), 'published confetti art', 5_000)
  await fetchAsset(new URL('./assets/mascot.png', appUrl), 'published mascot art', 5_000)
  await fetchAsset(new URL('./avatars/captain-br.png', appUrl), 'published captain avatar', 5_000)
  await fetchAsset(new URL('./avatars/p-aria.png', appUrl), 'published generated avatar p-aria', 5_000)
  await fetchAsset(new URL('./avatars/p-tariq.png', appUrl), 'published generated avatar p-tariq', 5_000)
  await fetchAsset(new URL('./crests/wm26.png', appUrl), 'published tournament crest', 5_000)

  checkIndex(rootHtml, 'published root')
  checkIndex(deepHtml, 'published deep link')
  checkManifest(manifest)
  checkBootLoader(bootLoader)
  checkStyles(styles)
  checkApp(app)
  checkPeerNet(peerNet)
  checkPeerMatch(peerMatch)
  checkPeerLobby(peerLobby)
  checkWatchSync(watchSync)

  if (!errors.some(error => error.startsWith('published'))) checks.push('published PearBrowser asset contract')
}

function checkIndex (html, label) {
  if (!html) return
  if (!html.includes('./pearcup-boot.js')) errors.push(`${label} does not load ./pearcup-boot.js`)
  if (!html.includes('./peer-net.js')) errors.push(`${label} does not load ./peer-net.js`)
  if (!html.includes('./peer-match.js')) errors.push(`${label} does not load ./peer-match.js`)
  if (!html.includes('./peer-lobby.js')) errors.push(`${label} does not load ./peer-lobby.js`)
  if (!html.includes('./watch-sync.js')) errors.push(`${label} does not load ./watch-sync.js`)
  if (!html.includes('./app.js')) errors.push(`${label} does not load ./app.js`)
  if (!html.includes('fallback loaded the visual shell')) {
    errors.push(`${label} does not keep the visible boot failure notice`)
  }
  if (!html.includes('p2pModulesReady') || !html.includes('pearcupP2pModules')) {
    errors.push(`${label} fallback can accept hydration without P2P readiness`)
  }
  for (const marker of ['pearcupPeerNetModule', 'pearcupPeerMatchModule', 'pearcupPeerLobbyModule', 'pearcupWatchSyncModule']) {
    if (!html.includes(marker)) errors.push(`${label} fallback does not require ${marker}`)
  }
  if (/<script\b[^>]*\btype=["']module["']/i.test(html)) errors.push(`${label} must not rely on module scripts`)
  if (/\/index\.cjs(?:\+esm-wrap)?/.test(html)) errors.push(`${label} exposes /index.cjs or /index.cjs+esm-wrap`)
  const appIndex = html.indexOf('src="./app.js"')
  for (const ref of ['src="./peer-net.js"', 'src="./peer-match.js"', 'src="./peer-lobby.js"', 'src="./watch-sync.js"']) {
    const refIndex = html.indexOf(ref)
    if (refIndex >= 0 && appIndex >= 0 && refIndex > appIndex) errors.push(`${label} loads ${ref} after app.js`)
  }
}

function checkBootLoader (bootLoader) {
  if (!bootLoader) return
  for (const ref of ['./peer-net.js', './peer-match.js', './peer-lobby.js', './watch-sync.js', './app.js']) {
    if (!bootLoader.includes(ref)) errors.push(`published pearcup-boot.js does not load ${ref}`)
  }
  if (!bootLoader.includes('pearcup:runtime-self-test') || !bootLoader.includes('runBootRuntimeSelfTest')) {
    errors.push('published pearcup-boot.js does not include the Pear runtime Games/invite self-test')
  }
  if (!bootLoader.includes('runRuntimePeerHandshakeSelfTest') || !bootLoader.includes('pearcupRuntimeSelfTestGuest')) {
    errors.push('published pearcup-boot.js does not include the hidden guest invite handshake self-test')
  }
  checkNoBareP2PControllerCalls(bootLoader, 'published pearcup-boot.js')
}

function checkManifest (manifest) {
  if (!manifest) return
  if (manifest.name !== 'PearCup') errors.push('published manifest name must be PearCup')
  if (manifest.entry !== '/index.html') errors.push('published manifest entry must be /index.html')
  if (!Array.isArray(manifest.permissions) || !manifest.permissions.includes('swarm.v1')) {
    errors.push('published manifest must include swarm.v1 permission')
  }
}

function checkStyles (styles) {
  if (!styles) return
  for (const [needle, message] of [
    ["url('assets/stadium-bg.png')", 'published styles.css does not reference the Penalty Clash stadium art'],
    ["url('assets/ball.png')", 'published styles.css does not reference the Penalty Clash ball art'],
    ["url('assets/confetti.png')", 'published styles.css does not reference the Penalty Clash confetti art']
  ]) {
    if (!styles.includes(needle)) errors.push(message)
  }
}

function checkApp (app) {
  if (!app) return
  for (const [needle, message] of [
    ['p2pBackendBadge', 'published app.js does not surface active P2P backend'],
    ['assertP2PModulesReady', 'published app.js can mark boot success without P2P modules'],
    ['pearcupP2pModules', 'published app.js does not expose P2P module readiness diagnostics'],
    ['syncRuntimeScreenDiagnostics', 'published app.js does not mirror normal route readiness diagnostics'],
    ['pearcupActiveScreen', 'published app.js does not expose the active screen diagnostic'],
    ['pearcupAppBooted', 'published app.js does not expose the app booted diagnostic'],
    ['bootRuntimeDiagnostics', 'published app.js boot probe does not prove hydrated UI and P2P controllers'],
    ['profileChipReady', 'published app.js boot diagnostics do not prove profile hydration'],
    ['emitBootReadyMarker', 'published app.js does not emit a positive boot-ready diagnostic'],
    ['URLSearchParams(location.search)', 'published app.js does not read deep-link query params'],
    ["get('join')", 'published app.js does not read ?join room codes'],
    ['tryJoinFriendInvite', 'published app.js does not keep retryable friend invite path'],
    ['pearcupPendingJoin', 'published app.js does not expose pending join diagnostics'],
    ['completeProfileOnboarding', 'published app.js can drop first-run friend invite flow'],
    ['peerMatch.join(code)', 'published app.js does not auto-join friend invite links'],
    ['Round of 32', 'published app.js does not keep current Round of 32 bracket state'],
    ['AVATAR_PORTRAITS', 'published app.js does not hydrate the generated avatar portrait map'],
    ['avatars/p-aria.png', 'published app.js does not reference generated avatar p-aria'],
    ['avatars/p-tariq.png', 'published app.js does not reference generated avatar p-tariq'],
    ['assets/mascot.png', 'published app.js does not reference the lobby mascot art'],
    ['runBootRuntimeSelfTest', 'published app.js does not include the Pear runtime Games/invite self-test'],
    ['runRuntimePeerHandshakeSelfTest', 'published app.js runtime self-test does not launch a hidden guest invite join'],
    ['pearcupRuntimeSelfTestGuest', 'published app.js runtime self-test does not mark hidden guest instances'],
    ['pearcup:runtime-self-test', 'published app.js does not emit the runtime self-test probe'],
    ['PearCupPeerMatch.host()', 'published app.js runtime self-test does not exercise friend invite hosting']
  ]) {
    if (!app.includes(needle)) errors.push(message)
  }
  for (const [pattern, message] of [
    [/window\.PearCupPeerMatch && PearCupPeerMatch\./, 'published app.js still uses bare PearCupPeerMatch after a window guard'],
    [/window\.PearCupPeerNet && PearCupPeerNet\./, 'published app.js still uses bare PearCupPeerNet after a window guard'],
    [/window\.PearCupLobby\) \{ PearCupLobby\./, 'published app.js still uses bare PearCupLobby after a window guard'],
    [/window\.PearCupWatchSync\) PearCupWatchSync\./, 'published app.js still uses bare PearCupWatchSync after a window guard'],
    [/window\.PearCupWatchSync\) \{ PearCupWatchSync\./, 'published app.js still uses bare PearCupWatchSync after a window guard']
  ]) {
    if (pattern.test(app)) errors.push(message)
  }
  checkNoBareP2PControllerCalls(app, 'published app.js')
  if (/\bItaly\b/.test(app)) errors.push('published app.js must not include Italy as a current competition team')
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

function checkPeerNet (peerNet) {
  if (!peerNet) return
  if (!peerNet.includes('pear.swarm.v1')) errors.push('published peer-net.js is missing PearBrowser swarm.v1 transport')
  if (!peerNet.includes('pearcup.peer-net.v1')) errors.push('published peer-net.js is missing PearCup protocol label')
  if (!peerNet.includes('broadcast-channel')) errors.push('published peer-net.js is missing the plain-browser dev fallback')
  if (!peerNet.includes('pearcupPeerNetModule')) errors.push('published peer-net.js does not mark module readiness')
  if (/\bexport\s+default\b/.test(peerNet)) errors.push('published peer-net.js looks like an ESM wrapper')
}

function checkPeerMatch (peerMatch) {
  if (!peerMatch) return
  if (!peerMatch.includes('pearcupPeerMatchModule')) errors.push('published peer-match.js does not mark module readiness')
  if (!peerMatch.includes('hyperLaunchBase')) errors.push('published peer-match.js cannot reconstruct hyper invite base')
  if (!peerMatch.includes('hyper://')) errors.push('published peer-match.js cannot share hyper:// invite links')
  if (peerMatch.includes('location.origin + location.pathname')) errors.push('published peer-match.js still shares localhost proxy invite links')
}

function checkPeerLobby (peerLobby) {
  if (!peerLobby) return
  if (!peerLobby.includes('PearCupPeerNet')) errors.push('published peer-lobby.js does not use shared PearCup peer transport')
  if (!peerLobby.includes('PearCupPeerMatch')) errors.push('published peer-lobby.js does not route to Penalty Clash peer match')
  if (!peerLobby.includes('pearcupPeerLobbyModule')) errors.push('published peer-lobby.js does not mark module readiness')
}

function checkWatchSync (watchSync) {
  if (!watchSync) return
  if (!watchSync.includes('PearCupPeerNet')) errors.push('published watch-sync.js does not use shared PearCup peer transport')
  if (!watchSync.includes('pearcupWatchSyncModule')) errors.push('published watch-sync.js does not mark module readiness')
}

async function fetchText (url, label, opts = {}) {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      errors.push(`${label} returned HTTP ${res.status}`)
      return null
    }
    checks.push(label)
    return await res.text()
  } catch (err) {
    if (opts.gatewayProbe && isLocalhost(url)) {
      errors.push(`PearBrowser gateway could not serve ${url.href}: ${err.message}. Start PearBrowser's local gateway, or pass --gateway http://127.0.0.1:<port>/ if it is running elsewhere.`)
    } else {
      errors.push(`${label} could not be fetched: ${err.message}`)
    }
    return null
  }
}

async function fetchJson (url, label) {
  const text = await fetchText(url, label)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (err) {
    errors.push(`${label} is not valid JSON: ${err.message}`)
    return null
  }
}

async function fetchAsset (url, label, minBytes) {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      errors.push(`${label} returned HTTP ${res.status}`)
      return
    }
    const bytes = new Uint8Array(await res.arrayBuffer()).length
    if (bytes < minBytes) errors.push(`${label} looks too small: ${bytes} bytes`)
    else checks.push(`${label} (${bytes} bytes)`)
  } catch (err) {
    errors.push(`${label} could not be fetched: ${err.message}`)
  }
}

function normalizeAppUrl (parsed) {
  const gateway = parsed.gateway || 'http://127.0.0.1:17208/'
  if (!validGatewayUrl(gateway)) return null
  let url
  if (parsed.drive) {
    if (!/^[0-9a-f]{64}$/i.test(parsed.drive)) {
      errors.push('--drive must be a 64-hex Hyperdrive key')
      return null
    }
    url = new URL(`/app/${parsed.drive.toLowerCase()}/`, ensureTrailingSlash(gateway))
  } else if (parsed.url) {
    const raw = new URL(parsed.url)
    if (raw.protocol === 'hyper:') {
      if (!/^[0-9a-f]{64}$/i.test(raw.hostname)) {
        errors.push('hyper:// URL must contain a 64-hex Hyperdrive key host')
        return null
      }
      url = new URL(`/app/${raw.hostname.toLowerCase()}/`, ensureTrailingSlash(gateway))
    } else if (raw.protocol === 'http:' || raw.protocol === 'https:') {
      url = raw
    } else {
      errors.push('--url must be hyper://, http://, or https://')
      return null
    }
  } else {
    return null
  }

  if (url.port === '4190') {
    errors.push('--url uses port 4190, which browser/fetch clients block; use 4191 or another browser-safe port')
    return null
  }
  url.hash = ''
  url.search = ''
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url
}

function validGatewayUrl (value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      errors.push('--gateway must be an http:// or https:// URL')
      return false
    }
    if (url.port === '4190') {
      errors.push('--gateway uses port 4190, which browser/fetch clients block; use 4191 or another browser-safe port')
      return false
    }
    return true
  } catch (err) {
    errors.push(`--gateway is not a valid URL: ${value}`)
    return false
  }
}

function ensureTrailingSlash (value) {
  return String(value).endsWith('/') ? value : `${value}/`
}

function isLocalhost (url) {
  return ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
}

function isLocalPreview4186 (url) {
  return isLocalhost(url) && url.port === '4186'
}

function usage () {
  console.error('Usage:')
  console.error('  node scripts/smoke-published-pearbrowser.mjs --url hyper://<64-hex-drive>/')
  console.error('  node scripts/smoke-published-pearbrowser.mjs --url http://127.0.0.1:17208/app/<64-hex-drive>/')
  console.error('  node scripts/smoke-published-pearbrowser.mjs --drive <64-hex-drive> [--gateway http://127.0.0.1:17208/]')
  console.error(`Repo: ${root}`)
}

function parseArgs (argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--url') parsed.url = argv[++i]
    else if (arg.startsWith('--url=')) parsed.url = arg.slice('--url='.length)
    else if (arg === '--drive') parsed.drive = argv[++i]
    else if (arg.startsWith('--drive=')) parsed.drive = arg.slice('--drive='.length)
    else if (arg === '--gateway') parsed.gateway = argv[++i]
    else if (arg.startsWith('--gateway=')) parsed.gateway = arg.slice('--gateway='.length)
    else errors.push(`unknown argument: ${arg}`)
  }
  return parsed
}
