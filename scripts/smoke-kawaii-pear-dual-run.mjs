#!/usr/bin/env node
// Launch two independent Pear Runtime processes against the same HiveRelay
// room. This deliberately does not use the hidden iframe self-test: each side
// has its own process, Pear store, renderer, identity, and SSE connection.

import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { cpSync, existsSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = join(root, 'app')
const pear = process.env.PEAR_BIN || 'pear'
const relay = process.env.PEARCUP_HIVERELAY_URL || 'https://relay-sg.p2phiverelay.xyz'
const timeoutMs = Number(process.env.PEARCUP_DUAL_TIMEOUT_MS || 45_000)
const room = `dual-${randomBytes(6).toString('hex')}`
const hostPeerId = process.env.PEARCUP_DUAL_HOST_PEER_ID || ''
const guestPeerId = process.env.PEARCUP_DUAL_GUEST_PEER_ID || ''
const tempRoot = mkdtempSync(join(tmpdir(), 'pearcup-kawaii-dual-'))
const launchRoot = join(tempRoot, 'app')
// Do not duplicate the 5+ GB app/node_modules tree for every native smoke.
// The normal Pear dev launcher uses the same durable dependency directory via
// a symlink; keeping the dual-run harness consistent makes cold boot fast and
// prevents a failed run from exhausting the temporary volume before the Pear
// renderer can emit its boot-ready probe.
cpSync(appRoot, launchRoot, {
  recursive: true,
  dereference: true,
  filter: path => !path.endsWith('/node_modules')
})
const nodeModules = join(appRoot, 'node_modules')
if (existsSync(nodeModules)) {
  const destModules = join(launchRoot, 'node_modules')
  // The Pear runtime resolves the project/module paths as file:// URLs, so a
  // space anywhere in the REAL path (e.g. ".../pear sports/...") is encoded to
  // %20 and resolution fails ("ERR_INVALID_PROJECT_DIR"); the renderer then
  // hangs until the boot-ready probe times out. A symlink does NOT help — Pear
  // realpath()s it straight back to the space. So when the app's real path
  // contains a space, materialize node_modules as a REAL directory under the
  // (space-free) tmp launch root instead of symlinking back into the space
  // path. APFS copy-on-write clone (cp -c) makes this ~free on macOS; elsewhere
  // fall back to a recursive copy. A space-free checkout keeps the fast symlink.
  if (/\s/.test(realpathSync(nodeModules))) {
    const cloned = process.platform === 'darwin' &&
      spawnSync('cp', ['-c', '-R', nodeModules, destModules], { stdio: 'ignore' }).status === 0
    if (!cloned) cpSync(nodeModules, destModules, { recursive: true, dereference: true })
  } else {
    symlinkSync(nodeModules, destModules, 'dir')
  }
}

const hostProbe = await createProbe()
const guestProbe = await createProbe()
const host = spawnPear('host', hostProbe.url, {
  PEARCUP_EXTERNAL_PEER_TEST: '1',
  PEARCUP_EXTERNAL_PEER_TEST_ROLE: 'host',
  PEARCUP_EXTERNAL_PEER_TEST_ROOM: room,
  PEARCUP_EXTERNAL_PEER_TEST_AUTOPLAY: '1',
  ...(hostPeerId ? { PEARCUP_EXTERNAL_PEER_TEST_PEER_ID: hostPeerId } : {})
})

let guest = null
let failed = null
try {
  // Cold Pear installs can spend ~15s opening a fresh temporary store before
  // the renderer makes its first probe request. Keep this separate from the
  // match timeout so startup jitter is not misreported as a relay failure.
  await waitFor(() => observedEvents(host, hostProbe).some(event => event && event.event === 'pearcup:boot-ready'), 90_000, 'host boot-ready')
  guest = spawnPear('guest', guestProbe.url, {
    PEARCUP_EXTERNAL_PEER_TEST: '1',
    PEARCUP_EXTERNAL_PEER_TEST_ROLE: 'guest',
    PEARCUP_EXTERNAL_PEER_TEST_JOIN: '1',
    PEARCUP_EXTERNAL_PEER_TEST_ROOM: room,
    PEARCUP_EXTERNAL_PEER_TEST_AUTOPLAY: '1',
    ...(guestPeerId ? { PEARCUP_EXTERNAL_PEER_TEST_PEER_ID: guestPeerId } : {})
  })
  await waitFor(() => observedEvents(host, hostProbe).some(event => isStartedHostEvent(event)) && observedEvents(guest, guestProbe).some(event => isStartedGuestEvent(event)), timeoutMs, 'independent peer handshake')
  await waitFor(() => observedEvents(host, hostProbe).some(event => isOverHostEvent(event)) && observedEvents(guest, guestProbe).some(event => isOverGuestEvent(event)), timeoutMs, 'independent penalty match completion')

  const hostStarted = observedEvents(host, hostProbe).find(event => isStartedHostEvent(event))
  const guestStarted = observedEvents(guest, guestProbe).find(event => isStartedGuestEvent(event))
  const hostOver = observedEvents(host, hostProbe).find(event => isOverHostEvent(event))
  const guestOver = observedEvents(guest, guestProbe).find(event => isOverGuestEvent(event))
  const errors = [
    ...findFatalOutput(host.output(), 'host'),
    ...findFatalOutput(guest.output(), 'guest')
  ]
  if (errors.length) throw new Error(errors.join('; '))
  if (hostStarted.channelBackend !== 'hiverelay-outboxlog-v2') throw new Error(`host backend was ${hostStarted.channelBackend || '(missing)'}`)
  if (guestStarted.channelBackend !== 'hiverelay-outboxlog-v2') throw new Error(`guest backend was ${guestStarted.channelBackend || '(missing)'}`)
  if (hostOver.score.you !== guestOver.score.opp || hostOver.score.opp !== guestOver.score.you) {
    throw new Error(`independent scores diverged: host ${hostOver.score.you}-${hostOver.score.opp}; guest ${guestOver.score.you}-${guestOver.score.opp}`)
  }

  console.log(JSON.stringify({
    ok: true,
    relay,
    room,
    hostPid: host.child.pid,
    guestPid: guest.child.pid,
    hostBackend: hostStarted.channelBackend,
    guestBackend: guestStarted.channelBackend,
    hostStarted: true,
    guestStarted: true,
    hostScore: hostOver.score,
    guestScore: guestOver.score,
    matchCompleted: true
  }))
} catch (error) {
  failed = error
} finally {
  await stop(host.child)
  if (guest) await stop(guest.child)
  // `pear run` can leave its GUI/runtime child detached from the CLI wrapper
  // after a timeout. Reap only processes whose command line contains this
  // run's unique temporary app path, otherwise a failed smoke poisons the
  // relay quota and the next test appears flaky.
  reapLaunchProcesses()
  await hostProbe.close()
  await guestProbe.close()
  rmSync(tempRoot, { recursive: true, force: true })
}

function reapLaunchProcesses () {
  for (const signal of ['TERM', 'KILL']) {
    try { spawnSync('pkill', [`-${signal}`, '-f', launchRoot], { stdio: 'ignore' }) } catch {}
  }
}

if (failed) {
  console.error(`Kawaii independent Pear Runtime smoke failed: ${failed.message}`)
  const hostOutput = host.output().trim()
  const guestOutput = guest && guest.output().trim()
  const hostStates = observedEvents(host, hostProbe).filter(event => event && event.event === 'pearcup:external-peer-state')
  const guestStates = guest ? observedEvents(guest, guestProbe).filter(event => event && event.event === 'pearcup:external-peer-state') : []
  if (hostStates.length) console.error(`\n--- host last states ---\n${JSON.stringify(hostStates.slice(-8))}`)
  if (guestStates.length) console.error(`\n--- guest last states ---\n${JSON.stringify(guestStates.slice(-8))}`)
  if (hostOutput) console.error(`\n--- host output ---\n${hostOutput}`)
  if (guestOutput) console.error(`\n--- guest output ---\n${guestOutput}`)
  process.exitCode = 1
}

function spawnPear (label, probeUrl, extraEnv) {
  const child = spawn(pear, [
    'run', '--dev', '--tmp-store', '--no-ask', '--no-pre', '.'
  ], {
    cwd: launchRoot,
    env: {
      ...process.env,
      PEARCUP_HIVERELAY_URL: relay,
      PEARCUP_BOOT_PROBE_URL: probeUrl,
      PEARCUP_DISABLE_RUNTIME_SELF_TEST: '1',
      ...(process.env.PEARCUP_TRACE_BRIDGE ? { PEARCUP_TRACE_BRIDGE: process.env.PEARCUP_TRACE_BRIDGE } : {}),
      ...extraEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = ''
  child.stdout.on('data', chunk => { output += String(chunk) })
  child.stderr.on('data', chunk => { output += String(chunk) })
  return { label, child, output: () => output }
}

function isStartedHostEvent (event) {
  return event && event.event === 'pearcup:external-peer-state' && event.status === 'started' && event.started === true
}

function isStartedGuestEvent (event) {
  return event && event.event === 'pearcup:deep-link' && event.status === 'started' && event.started === true && event.code === room
}

function isOverHostEvent (event) {
  return event && event.event === 'pearcup:external-peer-state' && event.status === 'over' && event.score && Number.isFinite(event.score.you) && Number.isFinite(event.score.opp)
}

function isOverGuestEvent (event) {
  return isOverHostEvent(event)
}

function observedEvents (processState, probe) {
  return [...probe.events, ...extractBridgeProbeEvents(processState.output())]
}

function extractBridgeProbeEvents (text) {
  const events = []
  const pattern = /\/boot-probe-hit\.gif\?payload=([^\s]+)/g
  let match
  while ((match = pattern.exec(text))) {
    try { events.push(JSON.parse(decodeURIComponent(match[1]))) } catch {}
  }
  return events
}

function findFatalOutput (text, label) {
  const fatal = [
    /PearCup (?:fallback|renderer|boot) error/i,
    /P2P modules missing/i,
    /\[pearcup-world-cup\] fatal/i,
    /Cannot find module/i,
    /ERR_(?:LEGACY|UNKNOWN_FILE_EXTENSION)/i
  ]
  return fatal.filter(pattern => pattern.test(text)).map(pattern => `${label} matched ${pattern}`)
}

function waitFor (predicate, timeout, label) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const poll = () => {
      if (predicate()) return resolve()
      if (Date.now() - started >= timeout) return reject(new Error(`timed out waiting for ${label}`))
      setTimeout(poll, 100)
    }
    poll()
  })
}

function stop (child) {
  if (!child || child.exitCode !== null || child.signalCode) return Promise.resolve()
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      try { child.kill('SIGTERM') } catch {}
      resolve()
    }, 3_000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    try { child.kill('SIGINT') } catch {}
  })
}

async function createProbe () {
  const state = { events: [] }
  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1')
    if (requestUrl.pathname !== '/pearcup-boot-probe') {
      res.statusCode = 404
      res.end('not found')
      return
    }
    const record = body => {
      try {
        const payload = JSON.parse(body || requestUrl.searchParams.get('payload') || '{}')
        state.events.push(payload)
      } catch {}
    }
    if (req.method === 'GET') {
      record('')
      res.statusCode = 204
      res.end()
      return
    }
    let body = ''
    req.setEncoding('utf8')
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      record(body)
      res.statusCode = 204
      res.end()
    })
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  return {
    events: state.events,
    url: `http://127.0.0.1:${address.port}/pearcup-boot-probe`,
    close: () => new Promise(resolve => server.close(() => resolve()))
  }
}
