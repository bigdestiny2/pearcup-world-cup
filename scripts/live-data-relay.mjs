// Production relay for Kawaii Cup's public sports data.
//
// The worker is the only process that receives FOOTBALL_DATA_KEY. It publishes
// sanitized, cacheable snapshots for the Pear renderer, which never receives
// the provider credential. Deploy it behind HTTPS; KeyVault is only useful for
// local operator runs, not for released-app refreshes.
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FOOTBALL_MATCHES_URL = 'https://api.football-data.org/v4/competitions/WC/matches'
const LIVE_SCHEMA = 'pearcup-live-v2'
const ODDS_SCHEMA = 'pearcup-polymarket-v1'
const MATCH_RANK = { IN_PLAY: 0, PAUSED: 0, LIVE: 0, TIMED: 1, SCHEDULED: 1, FINISHED: 2 }

function integerInRange (value, fallback, minimum, maximum) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(minimum, Math.min(maximum, Math.round(parsed)))
}

function safeMessage (error) {
  const message = String(error && error.message || error || 'unknown failure')
  // Provider errors can be safely reported as operational state, but never allow
  // a token or request URL to reach public health output/logs.
  return message.replace(/(X-Auth-Token|token|key)=?[^\s,;]*/gi, '$1=[redacted]').slice(0, 180)
}

function cacheFile (cacheDir, name) {
  return cacheDir ? resolve(cacheDir, name) : null
}

async function readCachedJson (file) {
  if (!file) return null
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return null
  }
}

async function writeCachedJson (file, value) {
  if (!file) return
  await mkdir(resolve(file, '..'), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 })
  await rename(temporary, file)
}

function selectMatch (matches) {
  return [...matches].sort((left, right) => {
    const rank = (MATCH_RANK[left.status] ?? 3) - (MATCH_RANK[right.status] ?? 3)
    return rank || new Date(left.utcDate).getTime() - new Date(right.utcDate).getTime()
  })[0] || null
}

async function responseJson (fetchImpl, url, options, timeoutMs) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const response = await fetchImpl(url, { ...options, ...(controller ? { signal: controller.signal } : {}) })
    if (!response || !response.ok) throw new Error(`football-data HTTP ${response && response.status || 'network'}`)
    return response.json()
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function fetchFootballSnapshot ({ footballDataKey, matchId = '', fetchImpl = globalThis.fetch, now = () => new Date(), requestTimeoutMs = 10_000 } = {}) {
  if (!footballDataKey) throw new Error('FOOTBALL_DATA_KEY is required')
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required')

  const headers = { 'X-Auth-Token': footballDataKey }
  const payload = await responseJson(fetchImpl, FOOTBALL_MATCHES_URL, { headers }, requestTimeoutMs)
  const matches = Array.isArray(payload.matches) ? payload.matches : []
  const forcedMatch = matchId
    ? await responseJson(fetchImpl, `https://api.football-data.org/v4/matches/${encodeURIComponent(matchId)}`, { headers }, requestTimeoutMs)
    : null
  const activeMatch = forcedMatch || selectMatch(matches)
  if (!activeMatch) throw new Error('football-data returned no World Cup matches')
  if (forcedMatch && !matches.some(match => String(match.id) === String(forcedMatch.id))) matches.unshift(forcedMatch)

  return {
    schema: LIVE_SCHEMA,
    provider: 'football-data.org',
    generatedAt: now().toISOString(),
    activeMatch,
    matches
  }
}

export function relayConfig (env = process.env) {
  const footballDataKey = String(env.FOOTBALL_DATA_KEY || '').trim()
  if (!footballDataKey) throw new Error('FOOTBALL_DATA_KEY must be supplied by the deployment secret manager')
  const refreshSeconds = integerInRange(env.REFRESH_SECONDS, 60, 15, 900)
  return {
    footballDataKey,
    matchId: String(env.MATCH_ID || '').trim(),
    host: String(env.HOST || '0.0.0.0'),
    port: integerInRange(env.PORT, 8787, 1, 65535),
    refreshMs: refreshSeconds * 1000,
    requestTimeoutMs: integerInRange(env.REQUEST_TIMEOUT_SECONDS, 10, 2, 30) * 1000,
    maxStaleMs: integerInRange(env.MAX_STALE_SECONDS, Math.max(refreshSeconds * 4, 300), 60, 86_400) * 1000,
    corsOrigins: String(env.PUBLIC_CORS_ORIGINS || '*').split(',').map(value => value.trim()).filter(Boolean),
    cacheDir: String(env.CACHE_DIR || '').trim() || null,
    polymarketEnabled: String(env.POLYMARKET_ENABLED || 'true').trim().toLowerCase() !== 'false'
  }
}

function accessControlOrigin (requestOrigin, configuredOrigins) {
  if (configuredOrigins.includes('*')) return '*'
  return requestOrigin && configuredOrigins.includes(requestOrigin) ? requestOrigin : ''
}

function jsonResponse (request, response, status, value, { cacheControl = 'no-store', corsOrigins = [] } = {}) {
  const body = JSON.stringify(value)
  const etag = `"${createHash('sha256').update(body).digest('base64url')}"`
  const allowedOrigin = accessControlOrigin(request.headers.origin, corsOrigins)
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cacheControl,
    etag,
    'x-content-type-options': 'nosniff',
    'cross-origin-resource-policy': 'cross-origin'
  }
  if (allowedOrigin) headers['access-control-allow-origin'] = allowedOrigin
  if (allowedOrigin !== '*') headers.vary = 'Origin'
  if (request.headers['if-none-match'] === etag) {
    response.writeHead(304, headers)
    response.end()
    return
  }
  response.writeHead(status, headers)
  response.end(body)
}

function unavailableOddsSnapshot (now) {
  return {
    schema: ODDS_SCHEMA,
    provider: 'Polymarket',
    status: 'unavailable',
    fetchedAt: now().toISOString(),
    reason: 'The public Polymarket relay could not refresh this fixture.'
  }
}

export function createLiveDataRelay ({ config = relayConfig(), fetchImpl = globalThis.fetch, createOddsSnapshot, now = () => new Date(), log = console } = {}) {
  let liveSnapshot = null
  let oddsSnapshot = null
  let lastSuccessAt = null
  let lastError = null
  let refreshInFlight = null
  let timer = null

  const liveCache = cacheFile(config.cacheDir, 'live-match.json')
  const oddsCache = cacheFile(config.cacheDir, 'polymarket-odds.json')

  async function loadCache () {
    const [cachedLive, cachedOdds] = await Promise.all([readCachedJson(liveCache), readCachedJson(oddsCache)])
    if (cachedLive && cachedLive.schema === LIVE_SCHEMA) {
      liveSnapshot = cachedLive
      lastSuccessAt = cachedLive.generatedAt || null
    }
    if (cachedOdds && cachedOdds.schema === ODDS_SCHEMA) oddsSnapshot = cachedOdds
  }

  async function refresh () {
    if (refreshInFlight) return refreshInFlight
    refreshInFlight = (async () => {
      try {
        const nextLive = await fetchFootballSnapshot({
          footballDataKey: config.footballDataKey,
          matchId: config.matchId,
          fetchImpl,
          now,
          requestTimeoutMs: config.requestTimeoutMs
        })
        let nextOdds = oddsSnapshot
        if (config.polymarketEnabled && typeof createOddsSnapshot === 'function') {
          try {
            nextOdds = await createOddsSnapshot(nextLive)
          } catch (error) {
            nextOdds = oddsSnapshot || unavailableOddsSnapshot(now)
            log.warn(JSON.stringify({ event: 'polymarket-refresh-failed', message: safeMessage(error) }))
          }
        }
        liveSnapshot = nextLive
        oddsSnapshot = nextOdds
        lastSuccessAt = nextLive.generatedAt
        lastError = null
        await Promise.all([writeCachedJson(liveCache, liveSnapshot), writeCachedJson(oddsCache, oddsSnapshot)])
        log.info(JSON.stringify({
          event: 'live-refresh-ok',
          generatedAt: nextLive.generatedAt,
          activeMatchId: nextLive.activeMatch && nextLive.activeMatch.id || null,
          fixtureCount: nextLive.matches.length
        }))
        return true
      } catch (error) {
        lastError = safeMessage(error)
        log.warn(JSON.stringify({ event: 'live-refresh-failed', message: lastError }))
        return false
      } finally {
        refreshInFlight = null
      }
    })()
    return refreshInFlight
  }

  function isFresh () {
    if (!liveSnapshot || !lastSuccessAt) return false
    const age = now().getTime() - Date.parse(lastSuccessAt)
    return Number.isFinite(age) && age >= 0 && age <= config.maxStaleMs
  }

  function health () {
    const generatedAt = liveSnapshot && liveSnapshot.generatedAt || null
    const ageMs = generatedAt ? Math.max(0, now().getTime() - Date.parse(generatedAt)) : null
    return {
      ok: isFresh(),
      status: isFresh() ? 'ready' : liveSnapshot ? 'stale' : 'starting',
      generatedAt,
      ageMs: Number.isFinite(ageMs) ? ageMs : null,
      refreshSeconds: Math.round(config.refreshMs / 1000),
      lastError
    }
  }

  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://relay.local')
    if (request.method === 'OPTIONS') {
      const allowedOrigin = accessControlOrigin(request.headers.origin, config.corsOrigins)
      response.writeHead(204, {
        ...(allowedOrigin ? { 'access-control-allow-origin': allowedOrigin } : {}),
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'If-None-Match',
        'access-control-max-age': '600',
        ...(allowedOrigin !== '*' ? { vary: 'Origin' } : {})
      })
      response.end()
      return
    }
    if (request.method !== 'GET') {
      jsonResponse(request, response, 405, { error: 'method_not_allowed' }, { corsOrigins: config.corsOrigins })
      return
    }
    if (url.pathname === '/healthz') {
      jsonResponse(request, response, isFresh() ? 200 : 503, health(), { corsOrigins: config.corsOrigins })
      return
    }
    if (url.pathname === '/v1/live-match.json') {
      if (!liveSnapshot) {
        jsonResponse(request, response, 503, { error: 'snapshot_unavailable' }, { corsOrigins: config.corsOrigins })
        return
      }
      jsonResponse(request, response, 200, liveSnapshot, { cacheControl: 'public, max-age=5, stale-while-revalidate=55', corsOrigins: config.corsOrigins })
      return
    }
    if (url.pathname === '/v1/polymarket-odds.json') {
      if (!oddsSnapshot) {
        jsonResponse(request, response, 503, { error: 'snapshot_unavailable' }, { corsOrigins: config.corsOrigins })
        return
      }
      jsonResponse(request, response, 200, oddsSnapshot, { cacheControl: 'public, max-age=5, stale-while-revalidate=55', corsOrigins: config.corsOrigins })
      return
    }
    jsonResponse(request, response, 404, { error: 'not_found' }, { corsOrigins: config.corsOrigins })
  })

  async function listen () {
    await loadCache()
    await new Promise((resolveListen, rejectListen) => {
      server.once('error', rejectListen)
      server.listen(config.port, config.host, () => {
        server.off('error', rejectListen)
        resolveListen()
      })
    })
    timer = setInterval(() => { void refresh() }, config.refreshMs)
    timer.unref()
    void refresh()
    return server.address()
  }

  async function close () {
    if (timer) clearInterval(timer)
    if (!server.listening) return
    await new Promise((resolveClose, rejectClose) => server.close(error => error ? rejectClose(error) : resolveClose()))
  }

  return {
    server,
    refresh,
    loadCache,
    listen,
    close,
    health,
    snapshots: () => ({ live: liveSnapshot, odds: oddsSnapshot })
  }
}

async function defaultOddsSnapshot (liveSnapshot) {
  const { createSnapshot } = await import('../design/kawaii-app/fetch-polymarket-odds.mjs')
  return createSnapshot({ liveSnapshot })
}

async function main () {
  const relay = createLiveDataRelay({ createOddsSnapshot: defaultOddsSnapshot })
  const address = await relay.listen()
  console.info(JSON.stringify({ event: 'relay-listening', address: typeof address === 'object' ? address.address : address, port: typeof address === 'object' ? address.port : null }))
  const stop = () => relay.close().catch(error => console.error(JSON.stringify({ event: 'relay-close-failed', message: safeMessage(error) })))
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch(error => {
    console.error(JSON.stringify({ event: 'relay-start-failed', message: safeMessage(error) }))
    process.exitCode = 1
  })
}
