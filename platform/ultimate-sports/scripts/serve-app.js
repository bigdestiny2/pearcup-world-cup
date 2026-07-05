'use strict'

const { createReadStream } = require('node:fs')
const { stat } = require('node:fs/promises')
const { createServer } = require('node:http')
const path = require('node:path')
const { writeUltimateSportsAppSnapshot } = require('./export-app-snapshot')
const { platform } = require('../src')
const manifest = require('../platform.manifest.json')

const DEFAULT_PORT = 4197
const DEMO_VERSION = 'ultimate-sports-live-demo-v1'
const DEMO_USER_ID = 'demo-host'
const DEMO_SCENARIO_TITLES = new Map([
  ['soccer-knockout', 'World Cup Bracket Night'],
  ['fight-card', 'Combat Card Tournament'],
  ['ultimate-day-in-life', 'Ultimate Sports Day'],
  ['awards-card', 'Awards Prediction Party'],
  ['series-playoff', 'Playoff Series Pool']
])
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.mp4', 'video/mp4']
])

function createUltimateSportsAppServer (input = {}) {
  const rootDir = input.rootDir || path.resolve(__dirname, '..')
  const appRoot = input.appRoot || path.join(rootDir, 'app')
  const assetsRoot = input.assetsRoot || path.join(rootDir, 'generated-assets')
  const shellRoot = input.shellRoot || path.join(rootDir, 'shell')
  const refreshSnapshot = input.refreshSnapshot !== false
  const demoSession = input.demoSession || createDemoSession({ userId: input.userId || DEMO_USER_ID })
  if (refreshSnapshot) writeUltimateSportsAppSnapshot({ rootDir })

  return createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname
      if (pathname.startsWith('/api/demo')) {
        await handleDemoApi({ req, res, pathname, demoSession })
        return
      }

      if (pathname.startsWith('/generated-assets/')) {
        await serveStaticFile({ res, assetsRoot, urlPath: pathname.slice('/generated-assets/'.length) })
        return
      }

      if (pathname.startsWith('/shell/')) {
        await serveStaticFile({ res, assetsRoot: shellRoot, urlPath: pathname.slice('/shell/'.length) })
        return
      }

      const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1))
      await serveStaticFile({ res, assetsRoot: appRoot, urlPath: relativePath })
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        writeText(res, 404, 'Not found')
        return
      }
      writeText(res, 500, 'Internal server error')
    }
  })
}

async function serveStaticFile ({ res, assetsRoot, urlPath }) {
  const normalizedPath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
  const filePath = path.resolve(path.join(assetsRoot, normalizedPath))

  if (!filePath.startsWith(assetsRoot)) {
    writeText(res, 403, 'Forbidden')
    return
  }

  const fileStat = await stat(filePath)
  if (!fileStat.isFile()) {
    writeText(res, 404, 'Not found')
    return
  }

  res.writeHead(200, {
    'content-type': MIME_TYPES.get(path.extname(filePath)) || 'application/octet-stream',
    'cache-control': 'no-store'
  })
  createReadStream(filePath).pipe(res)
}

function createDemoSession (input = {}) {
  const userId = input.userId || DEMO_USER_ID
  let app = platform.createUltimateSportsPlatform({ peerId: userId })
  let appliedScenarios = []

  function reset () {
    app = platform.createUltimateSportsPlatform({ peerId: userId })
    appliedScenarios = []
    return state({ lastAction: 'reset' })
  }

  function applyScenario (scenarioId) {
    if (!scenarioId || !manifest.scenarioIds.includes(scenarioId)) {
      throw new Error(`Unknown demo scenario: ${scenarioId || 'missing'}`)
    }
    const before = app.events().length
    const run = app.applyScenario(scenarioId)
    app.joinScenarioTopics(run.scenario)
    const after = app.events().length
    appliedScenarios.push({
      scenarioId,
      title: scenarioTitle(scenarioId),
      commandCount: count(run.scenario && run.scenario.commands),
      eventCount: after - before,
      topicCount: count(run.scenario && run.scenario.topics),
      eventRoot: app.root()
    })
    return state({ lastAction: `applied:${scenarioId}` })
  }

  function runDayInLife () {
    reset()
    return applyScenario('ultimate-day-in-life')
  }

  function state (extra = {}) {
    return createDemoState({ app, appliedScenarios, userId, extra })
  }

  return {
    reset,
    applyScenario,
    runDayInLife,
    state
  }
}

function createDemoState ({ app, appliedScenarios, userId, extra }) {
  const view = app.view()
  const events = app.events()
  const experience = app.createExperience({ userId })
  const surfaceSummary = (experience.navigation || []).map(item => ({
    surfaceId: item.surfaceId,
    title: item.title,
    primaryCount: item.primaryCount,
    badgeCount: item.badgeCount
  }))
  const competitions = summarizeCollection(view.competitions, competition => ({
    competitionId: competition.competitionId,
    title: competition.title,
    templateKind: competition.templateKind,
    status: competition.status,
    entrantCount: count(competition.entrants),
    fixtureCount: count(competition.fixtures)
  }))
  const pools = summarizeCollection(view.pools, pool => ({
    poolId: pool.poolId,
    title: pool.title,
    competitionId: pool.competitionId,
    variant: pool.variant,
    status: pool.status
  }))
  const rooms = summarizeCollection(view.rooms, room => ({
    roomId: room.roomId,
    title: room.title,
    competitionId: room.competitionId,
    status: room.status,
    participantCount: count(view.roomParticipants && view.roomParticipants[room.roomId])
  }))
  const wallets = summarizeCollection(view.walletBalances, wallet => ({
    walletId: wallet.walletId || wallet.accountId,
    userId: wallet.userId,
    currency: wallet.currency,
    balance: wallet.balance,
    mode: wallet.mode,
    status: wallet.status
  }))

  return {
    demoVersion: DEMO_VERSION,
    source: 'live-facade',
    generatedAt: new Date().toISOString(),
    userId,
    lastAction: extra.lastAction || 'state',
    availableScenarios: manifest.scenarioIds.map(scenarioId => ({
      scenarioId,
      title: scenarioTitle(scenarioId)
    })),
    appliedScenarios: appliedScenarios.slice(),
    runtime: {
      eventCount: events.length,
      eventRoot: app.root()
    },
    viewSummary: {
      competitionCount: competitions.length,
      poolCount: pools.length,
      roomCount: rooms.length,
      walletCount: wallets.length,
      surfaceCount: surfaceSummary.length
    },
    surfaceSummary,
    competitions,
    pools,
    rooms,
    wallets,
    workbenches: createDemoWorkbenches(app, userId),
    recentEvents: events.slice(-6).map(event => ({
      type: event.type,
      eventId: event.eventId,
      aggregateId: event.aggregateId
    })),
    transport: summarizeTransport(app)
  }
}

function createDemoWorkbenches (app, userId) {
  return {
    picks: summarizeWorkbench(() => app.createPickWorkbench({ userId })),
    watch: summarizeWorkbench(() => app.createWatchPartyWorkbench({ userId })),
    wallet: summarizeWorkbench(() => app.createWalletOpsWorkbench({ userId })),
    ops: summarizeWorkbench(() => app.createOpsWorkbench({ userId }))
  }
}

function summarizeWorkbench (createWorkbench) {
  try {
    const workbench = createWorkbench()
    return {
      available: true,
      title: workbench.title || workbench.workbenchId || workbench.surfaceId || 'Workbench',
      counts: countArrayFields(workbench)
    }
  } catch (error) {
    return {
      available: false,
      title: 'Unavailable',
      error: error.message
    }
  }
}

function countArrayFields (value, prefix = '', depth = 0, output = {}) {
  if (!value || typeof value !== 'object' || depth > 2) return output
  Object.entries(value).forEach(([key, item]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(item)) output[nextKey] = item.length
    else if (item && typeof item === 'object') countArrayFields(item, nextKey, depth + 1, output)
  })
  return output
}

function summarizeTransport (app) {
  try {
    const diagnosis = app.diagnoseTransport()
    return {
      ok: diagnosis.ok,
      topicCount: diagnosis.topicCount,
      peerCount: diagnosis.peerCount,
      evidence: diagnosis.evidence
    }
  } catch (error) {
    return {
      ok: false,
      topicCount: 0,
      peerCount: 0,
      evidence: error.message
    }
  }
}

function summarizeCollection (collection, mapper) {
  return Object.values(collection || {}).map(mapper)
}

function count (value) {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return Object.keys(value).length
  return 0
}

function scenarioTitle (scenarioId) {
  return DEMO_SCENARIO_TITLES.get(scenarioId) || scenarioId.replaceAll('-', ' ')
}

async function handleDemoApi ({ req, res, pathname, demoSession }) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store'
    })
    res.end()
    return
  }

  try {
    if (req.method === 'GET' && pathname === '/api/demo/state') {
      writeJson(res, 200, demoSession.state())
      return
    }
    if (req.method === 'POST' && pathname === '/api/demo/reset') {
      await readJsonBody(req)
      writeJson(res, 200, demoSession.reset())
      return
    }
    if (req.method === 'POST' && pathname === '/api/demo/apply-scenario') {
      const body = await readJsonBody(req)
      writeJson(res, 200, demoSession.applyScenario(body.scenarioId))
      return
    }
    if (req.method === 'POST' && pathname === '/api/demo/run-day-in-life') {
      await readJsonBody(req)
      writeJson(res, 200, demoSession.runDayInLife())
      return
    }

    writeJson(res, 404, { error: 'Demo API route not found' })
  } catch (error) {
    writeJson(res, 400, { error: error.message })
  }
}

function readJsonBody (req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', chunk => {
      size += chunk.length
      if (size > 1_000_000) {
        reject(new Error('Demo request body is too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim()
      if (!text) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`))
      }
    })
    req.on('error', reject)
  })
}

function listen (input = {}) {
  const port = input.port || DEFAULT_PORT
  const server = createUltimateSportsAppServer(input)
  server.listen(port, '127.0.0.1', () => {
    console.log(`Ultimate Sports preview: http://127.0.0.1:${port}/`)
  })
  return server
}

function parseArgs (argv = process.argv.slice(2)) {
  const parsed = { port: DEFAULT_PORT, refreshSnapshot: true }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--port') parsed.port = Number(argv[++index])
    else if (arg === '--no-refresh') parsed.refreshSnapshot = false
  }
  if (!Number.isInteger(parsed.port) || parsed.port < 1 || parsed.port > 65535) parsed.port = DEFAULT_PORT
  return parsed
}

function writeText (res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(body)
}

function writeJson (res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  res.end(`${JSON.stringify(body, null, 2)}\n`)
}

if (require.main === module) {
  listen(parseArgs())
}

module.exports = {
  DEFAULT_PORT,
  DEMO_VERSION,
  createDemoSession,
  createUltimateSportsAppServer,
  listen,
  parseArgs
}
