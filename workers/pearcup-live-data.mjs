// Cloudflare Worker for PearCup's mutable public data lane.
//
// Pear/Hyperdrive publishes an immutable app bundle. This Worker is deliberately
// separate: it polls Football-Data and Polymarket, stores last-known-good JSON in
// KV, and serves only public, credential-free snapshots to every renderer.
import { createFixtureOddsSnapshot, mergeLastKnownGoodOdds } from '../app/fetch-polymarket-odds.mjs'

const FOOTBALL_MATCHES_URL = 'https://api.football-data.org/v4/competitions/WC/matches'
const LIVE_KEY = 'live-match.json'
const ODDS_KEY = 'polymarket-odds.json'
const LIVE_SCHEMA = 'pearcup-live-v2'
const DEFAULT_MAX_STALE_MS = 5 * 60 * 1000

function integerInRange (value, fallback, minimum, maximum) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(minimum, Math.min(maximum, Math.round(parsed)))
}

function matchRank (match) {
  const status = String(match && match.status || '').toUpperCase()
  if (['IN_PLAY', 'LIVE', 'PAUSED'].includes(status)) return 0
  if (['TIMED', 'SCHEDULED'].includes(status)) return 1
  if (status === 'FINISHED') return 3
  return 2
}

function selectMatch (matches) {
  return [...matches].sort((left, right) => {
    const rank = matchRank(left) - matchRank(right)
    return rank || Date.parse(left.utcDate || '') - Date.parse(right.utcDate || '')
  })[0] || null
}

async function fetchJson (fetchImpl, url, options = {}, timeoutMs = 10_000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal })
    if (!response || !response.ok) throw new Error(`provider HTTP ${response && response.status || 'network'}`)
    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchFootballSnapshot ({ footballDataKey, matchId = '', fetchImpl = fetch, now = () => new Date() } = {}) {
  if (!footballDataKey) throw new Error('FOOTBALL_DATA_KEY is not configured')
  const headers = { 'X-Auth-Token': footballDataKey }
  const payload = await fetchJson(fetchImpl, FOOTBALL_MATCHES_URL, { headers })
  const matches = Array.isArray(payload.matches) ? payload.matches : []
  const forcedMatch = matchId
    ? await fetchJson(fetchImpl, `https://api.football-data.org/v4/matches/${encodeURIComponent(matchId)}`, { headers })
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

function publicCorsHeaders (request, env) {
  const configured = String(env.PUBLIC_CORS_ORIGINS || '*').split(',').map(value => value.trim()).filter(Boolean)
  const origin = request.headers.get('origin') || ''
  const allowed = configured.includes('*') ? '*' : configured.includes(origin) ? origin : ''
  return {
    ...(allowed ? { 'access-control-allow-origin': allowed } : {}),
    ...(allowed && allowed !== '*' ? { vary: 'Origin' } : {})
  }
}

function json (request, env, value, { status = 200, cacheControl = 'no-store' } = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      'x-content-type-options': 'nosniff',
      'cross-origin-resource-policy': 'cross-origin',
      ...publicCorsHeaders(request, env)
    }
  })
}

function oddsEntries (snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return {}
  if (snapshot.schema === 'pearcup-polymarket-v2' && snapshot.matches && typeof snapshot.matches === 'object') return snapshot.matches
  const id = snapshot.match && snapshot.match.id
  return id == null ? {} : { [String(id)]: snapshot }
}

function snapshotFresh (snapshot, now, maxStaleMs) {
  const timestamp = Date.parse(snapshot && (snapshot.generatedAt || snapshot.fetchedAt) || '')
  const age = now.getTime() - timestamp
  return Number.isFinite(age) && age >= 0 && age <= maxStaleMs
}

export function createLiveDataWorker ({ fetchImpl = fetch, now = () => new Date() } = {}) {
  async function getJson (env, key) {
    return env.LIVE_DATA && typeof env.LIVE_DATA.get === 'function' ? env.LIVE_DATA.get(key, 'json') : null
  }

  async function putJson (env, key, value) {
    if (!env.LIVE_DATA || typeof env.LIVE_DATA.put !== 'function') throw new Error('LIVE_DATA KV binding is not configured')
    await env.LIVE_DATA.put(key, JSON.stringify(value))
  }

  async function refresh (env) {
    const live = await fetchFootballSnapshot({
      footballDataKey: String(env.FOOTBALL_DATA_KEY || ''),
      matchId: String(env.MATCH_ID || ''),
      fetchImpl,
      now
    })
    const previousOdds = await getJson(env, ODDS_KEY)
    let odds
    try {
      odds = mergeLastKnownGoodOdds(previousOdds, await createFixtureOddsSnapshot({
        liveSnapshot: live,
        now: live.generatedAt,
        limit: integerInRange(env.POLYMARKET_FIXTURE_LIMIT, 6, 1, 12)
      }))
    } catch {
      odds = previousOdds || {
        schema: 'pearcup-polymarket-v2', provider: 'Polymarket', status: 'unavailable', generatedAt: live.generatedAt, matches: {},
        reason: 'The public Polymarket relay could not refresh this fixture.'
      }
    }
    await Promise.all([putJson(env, LIVE_KEY, live), putJson(env, ODDS_KEY, odds)])
    return { live, odds }
  }

  async function ensureSnapshots (env) {
    const [live, odds] = await Promise.all([getJson(env, LIVE_KEY), getJson(env, ODDS_KEY)])
    if (live && odds) return { live, odds }
    return refresh(env)
  }

  return {
    async fetch (request, env, ctx) {
      const url = new URL(request.url)
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { ...publicCorsHeaders(request, env), 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'If-None-Match', 'access-control-max-age': '600' } })
      }
      if (request.method !== 'GET') return json(request, env, { error: 'method_not_allowed' }, { status: 405 })
      let snapshots
      try {
        snapshots = await ensureSnapshots(env)
      } catch {
        return json(request, env, { error: 'snapshot_unavailable' }, { status: 503 })
      }
      const maxStaleMs = integerInRange(env.MAX_STALE_SECONDS, 300, 60, 86_400) * 1000
      const fresh = snapshotFresh(snapshots.live, now(), maxStaleMs)
      if (url.pathname === '/healthz') {
        return json(request, env, {
          ok: fresh,
          status: fresh ? 'ready' : 'stale',
          generatedAt: snapshots.live.generatedAt || null,
          oddsGeneratedAt: snapshots.odds.generatedAt || null,
          fixtureCount: Object.keys(oddsEntries(snapshots.odds)).length
        }, { status: fresh ? 200 : 503 })
      }
      if (url.pathname === '/v1/live-match.json') {
        return json(request, env, snapshots.live, { cacheControl: 'public, max-age=5, stale-while-revalidate=55' })
      }
      if (url.pathname === '/v1/polymarket-odds.json') {
        const matchId = String(url.searchParams.get('matchId') || '')
        if (matchId) {
          const snapshot = oddsEntries(snapshots.odds)[matchId]
          return snapshot
            ? json(request, env, snapshot, { cacheControl: 'public, max-age=5, stale-while-revalidate=55' })
            : json(request, env, { error: 'match_not_found', matchId }, { status: 404 })
        }
        return json(request, env, snapshots.odds, { cacheControl: 'public, max-age=5, stale-while-revalidate=55' })
      }
      return json(request, env, { error: 'not_found' }, { status: 404 })
    },
    async scheduled (_event, env, ctx) {
      ctx.waitUntil(refresh(env))
    },
    refresh
  }
}

export default createLiveDataWorker()
