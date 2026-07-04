#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { statSync, utimesSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const server = spawn(process.execPath, [
  join(root, 'scripts', 'serve-pearbrowser-hyper.mjs'),
  '--port',
  '0',
  '--strict-port'
], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe']
})

let output = ''
let closed = false
server.stdout.setEncoding('utf8')
server.stderr.setEncoding('utf8')
server.stdout.on('data', chunk => { output += chunk })
server.stderr.on('data', chunk => { output += chunk })
server.on('close', () => { closed = true })

try {
  const url = await waitForMatch(/PearBrowser Hyper preview: (http:\/\/[^\s]+)/, 'preview URL')
  const initialBundle = matchOutput(/PearBrowser Hyper bundle: ([^\n]+)/, 'initial bundle')
  if (!/source auto-refresh enabled/.test(output)) {
    throw new Error('preview server did not report source auto-refresh')
  }

  const firstBoot = await fetchText(new URL('/pearcup-boot.js', url), 'initial boot bundle')
  if (!firstBoot.includes('PearCupPeerNet')) throw new Error('initial boot bundle is missing PearCupPeerNet')
  if (!firstBoot.includes('showOperatorLiveDataSettings')) {
    throw new Error('initial boot bundle is missing the operator live-data gate')
  }
  if (!firstBoot.includes('pearcup:runtime-self-test') || !firstBoot.includes('runBootRuntimeSelfTest')) {
    throw new Error('initial boot bundle is missing the Pear runtime Games/invite self-test')
  }
  await assertServedRuntimeContract(url, 'initial')

  bumpSourceMtime()
  await delay(700)

  const secondBoot = await fetchText(new URL('/pearcup-boot.js', url), 'refreshed boot bundle')
  if (!secondBoot.includes('showOperatorLiveDataSettings')) {
    throw new Error('refreshed boot bundle is missing the operator live-data gate')
  }
  if (!secondBoot.includes('pearcup:runtime-self-test') || !secondBoot.includes('runBootRuntimeSelfTest')) {
    throw new Error('refreshed boot bundle is missing the Pear runtime Games/invite self-test')
  }
  await assertServedRuntimeContract(url, 'refreshed')

  const refreshedBundle = await waitForNewBundle(initialBundle)
  console.log('PearBrowser preview serve smoke passed')
  console.log(`ok - url: ${url}`)
  console.log(`ok - initial bundle: ${initialBundle}`)
  console.log(`ok - refreshed bundle: ${refreshedBundle}`)
} catch (err) {
  console.error('PearBrowser preview serve smoke failed:')
  console.error(err && err.stack ? err.stack : String(err))
  if (output.trim()) console.error(`\nserver output:\n${output.trim()}`)
  process.exitCode = 1
} finally {
  await stopServer()
}

function bumpSourceMtime () {
  const filePath = join(root, 'design', 'kawaii-app', 'styles.css')
  const stat = statSync(filePath)
  const next = new Date(Math.max(Date.now() + 2000, stat.mtimeMs + 2000))
  utimesSync(filePath, stat.atime, next)
}

async function fetchText (url, label) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${label} returned HTTP ${res.status}`)
  return await res.text()
}

async function fetchBytes (url, label, minBytes) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${label} returned HTTP ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer()).length
  if (bytes < minBytes) throw new Error(`${label} looks too small: ${bytes} bytes`)
  return bytes
}

async function assertServedRuntimeContract (url, label) {
  const index = await fetchText(new URL('/index.html', url), `${label} index.html`)
  const app = await fetchText(new URL('/app.js', url), `${label} app.js`)
  const styles = await fetchText(new URL('/styles.css', url), `${label} styles.css`)
  if (!index.includes('pearcupPeerMatchModule') || !index.includes('pearcupWatchSyncModule')) {
    throw new Error(`${label} index fallback does not require every P2P readiness marker`)
  }
  for (const needle of ['runBootRuntimeSelfTest', 'runtimeBracketEvidence', 'Bracket board rendered', 'Bracket route did not render generated avatar images', 'runRuntimeHashRouteSelfTest', 'Same-document hash route changes did not activate Bracket, Games, and Watch', 'runRuntimePeerHandshakeSelfTest', 'pearcupRuntimeSelfTestGuest', 'pearcup:runtime-self-test', 'syncRuntimeScreenDiagnostics', 'pearcupActiveScreen', 'pearcupAppBooted', 'PearCupPeerMatch.host()', 'avatars/p-aria.png', 'avatars/p-tariq.png', 'assets/mascot.png']) {
    if (!app.includes(needle)) throw new Error(`${label} app.js is missing ${needle}`)
  }
  for (const needle of ["url('assets/stadium-bg.png')", "url('assets/ball.png')", "url('assets/confetti.png')"]) {
    if (!styles.includes(needle)) throw new Error(`${label} styles.css is missing ${needle}`)
  }
  await fetchBytes(new URL('/assets/mascot.png', url), `${label} mascot art`, 5_000)
  await fetchBytes(new URL('/assets/stadium-bg.png', url), `${label} stadium art`, 10_000)
  await fetchBytes(new URL('/avatars/p-aria.png', url), `${label} generated avatar p-aria`, 5_000)
  await fetchBytes(new URL('/avatars/p-tariq.png', url), `${label} generated avatar p-tariq`, 5_000)
}

function matchOutput (pattern, label) {
  const match = output.match(pattern)
  if (!match) throw new Error(`timed out waiting for ${label}`)
  return match[1].trim()
}

async function waitForMatch (pattern, label, timeoutMs = 30_000) {
  await waitFor(() => pattern.test(output), label, timeoutMs)
  return matchOutput(pattern, label)
}

async function waitForNewBundle (initialBundle) {
  await waitFor(() => {
    const matches = [...output.matchAll(/PearBrowser Hyper bundle refreshed: ([^\n]+)/g)]
    return matches.some(match => match[1].trim() && match[1].trim() !== initialBundle)
  }, 'source auto-refresh')
  const matches = [...output.matchAll(/PearBrowser Hyper bundle refreshed: ([^\n]+)/g)]
  return matches[matches.length - 1][1].trim()
}

function waitFor (predicate, label, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (predicate()) return resolve()
      if (closed) return reject(new Error(`server exited before ${label}\n${output.trim()}`))
      if (Date.now() - started > timeoutMs) return reject(new Error(`timed out waiting for ${label}`))
      setTimeout(tick, 50)
    }
    tick()
  })
}

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function stopServer () {
  return new Promise(resolve => {
    if (closed) return resolve()
    const timer = setTimeout(resolve, 2000)
    server.once('close', () => {
      clearTimeout(timer)
      resolve()
    })
    server.kill('SIGTERM')
  })
}
