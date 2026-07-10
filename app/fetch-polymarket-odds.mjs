// Same-origin Polymarket odds relay for the Kawaii app.
//
// Uses Polymarket's public Gamma API for discovery and its public CLOB midpoint
// endpoint for fresher prices when token IDs are available. It never reads a wallet,
// creates an order, or exposes the renderer to a third-party origin.
const GAMMA_SEARCH = 'https://gamma-api.polymarket.com/public-search'
const CLOB_MIDPOINTS = 'https://clob.polymarket.com/midpoints'
const REQUEST_TIMEOUT_MS = Math.max(2_000, Math.min(30_000, Number(
  typeof process !== 'undefined' && process.env
    ? process.env.POLYMARKET_REQUEST_TIMEOUT_MS
    : ''
) || 8_000))

export function parseJsonList (value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function text (value) {
  return String(value || '').trim()
}

function includesTeam (value, team) {
  return text(value).toLowerCase().includes(text(team).toLowerCase())
}

export function matchFromSnapshot (snapshot) {
  const match = snapshot || {}
  const home = text(match.homeTeam && (match.homeTeam.shortName || match.homeTeam.name) || match.home && match.home.name)
  const away = text(match.awayTeam && (match.awayTeam.shortName || match.awayTeam.name) || match.away && match.away.name)
  if (!home || !away) throw new Error('Live match snapshot is missing home or away team')
  return { id: match.id || null, home, away, stage: match.stage || null, utcDate: match.utcDate || null }
}

export function activeMatchFromSnapshot (snapshot) {
  return matchFromSnapshot(snapshot && snapshot.activeMatch || snapshot || {})
}

function fixtureRank (match) {
  const status = text(match && match.status).toUpperCase()
  if (['IN_PLAY', 'LIVE', 'PAUSED'].includes(status)) return 0
  if (['TIMED', 'SCHEDULED'].includes(status)) return 1
  if (status === 'FINISHED') return 3
  return 2
}

// The active fixture always comes first, followed by the next fixtures that have
// both sides confirmed. This keeps public provider traffic bounded while letting
// Home, Watch and Games switch among the same canonical fixture IDs.
export function fixtureMatchesFromSnapshot (snapshot, { limit = 6 } = {}) {
  const seen = new Set()
  const active = snapshot && snapshot.activeMatch || null
  const candidates = Array.isArray(snapshot && snapshot.matches) ? snapshot.matches : []
  const normalizedActive = (() => { try { return active ? matchFromSnapshot(active) : null } catch { return null } })()
  const activeKickoff = Date.parse(normalizedActive && normalizedActive.utcDate || '')
  if (normalizedActive && normalizedActive.id != null) seen.add(String(normalizedActive.id))
  const remaining = candidates
    .filter(match => {
      if (!match) return false
      const kickoff = Date.parse(match.utcDate || '')
      // Never backfill a future selector with historical fixtures merely because
      // the upstream schedule still labels them TIMED. A currently live match is
      // kept even if its kickoff precedes the selected active fixture.
      return !Number.isFinite(activeKickoff) || !Number.isFinite(kickoff) || kickoff >= activeKickoff || fixtureRank(match) === 0
    })
    .sort((left, right) => {
      const rank = fixtureRank(left) - fixtureRank(right)
      return rank || Date.parse(left.utcDate || '') - Date.parse(right.utcDate || '')
    })
    .map(match => {
      try { return matchFromSnapshot(match) } catch { return null }
    })
    .filter(match => {
      const id = String(match && match.id || '')
      if (!match || !id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  const limitCount = Math.max(1, Math.min(12, Number(limit) || 6))
  return [...(normalizedActive ? [normalizedActive] : []), ...remaining].slice(0, limitCount)
}

export function marketsFromSearch (payload = {}) {
  const markets = Array.isArray(payload.markets) ? payload.markets : []
  const eventMarkets = Array.isArray(payload.events)
    ? payload.events.flatMap(event => (event && Array.isArray(event.markets) ? event.markets.map(market => ({ ...market, eventSlug: event.slug || market.eventSlug })) : []))
    : []
  const byId = new Map()
  for (const market of [...markets, ...eventMarkets]) {
    if (!market) continue
    const key = String(market.id || market.conditionId || market.slug || Math.random())
    if (!byId.has(key)) byId.set(key, market)
  }
  return [...byId.values()]
}

function marketScore (market, match) {
  if (!market || market.closed || market.active === false) return -Infinity
  const title = `${market.question || ''} ${market.title || ''} ${market.description || ''}`
  const outcomes = parseJsonList(market.outcomes)
  const hasHome = includesTeam(title, match.home) || outcomes.some(outcome => includesTeam(outcome, match.home))
  const hasAway = includesTeam(title, match.away) || outcomes.some(outcome => includesTeam(outcome, match.away))
  if (!hasHome || !hasAway) return -Infinity
  const directOutcomes = outcomes.some(outcome => includesTeam(outcome, match.home)) && outcomes.some(outcome => includesTeam(outcome, match.away))
  // Prefer a three-way/direct match market over a one-sided Yes/No proposition.
  return (directOutcomes ? 100 : 30) + Math.min(20, Number(market.liquidityNum || market.liquidity || 0) / 1000)
}

export function selectMatchMarket (markets, match) {
  return [...markets]
    .map(market => ({ market, score: marketScore(market, match) }))
    .filter(candidate => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score)[0]?.market || null
}

function boundedProbability (value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null
}

async function fetchJson (url, options) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null
  try {
    const response = await fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function findMarket (match) {
  const url = new URL(GAMMA_SEARCH)
  url.searchParams.set('q', `${match.home} ${match.away}`)
  const payload = await fetchJson(url)
  return selectMatchMarket(marketsFromSearch(payload), match)
}

async function midpointPrices (tokenIds) {
  if (!tokenIds.length) return {}
  try {
    return await fetchJson(CLOB_MIDPOINTS, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(tokenIds.map(tokenId => ({ token_id: tokenId })))
    })
  } catch {
    // Gamma prices remain a valid public implied-probability fallback.
    return {}
  }
}

export function buildOddsSnapshot ({ match, market, midpointMap = {}, fetchedAt = new Date().toISOString() } = {}) {
  if (!market) {
    return {
      schema: 'pearcup-polymarket-v1',
      provider: 'Polymarket',
      status: 'unavailable',
      fetchedAt,
      match,
      reason: 'No active Polymarket match market was found for this fixture.'
    }
  }
  const outcomes = parseJsonList(market.outcomes)
  const gammaPrices = parseJsonList(market.outcomePrices)
  const tokenIds = parseJsonList(market.clobTokenIds)
  const odds = outcomes.map((outcome, index) => {
    const tokenId = tokenIds[index] || null
    const midpoint = tokenId ? boundedProbability(midpointMap[tokenId]) : null
    const probability = midpoint == null ? boundedProbability(gammaPrices[index]) : midpoint
    return { outcome: text(outcome), probability, tokenId, source: midpoint == null ? 'gamma' : 'clob-midpoint' }
  }).filter(odd => odd.outcome && odd.probability != null)
  if (odds.length < 2) {
    return {
      schema: 'pearcup-polymarket-v1',
      provider: 'Polymarket',
      status: 'unavailable',
      fetchedAt,
      match,
      reason: 'The matching market did not expose a complete public odds set.'
    }
  }
  const slug = text(market.eventSlug || market.slug)
  return {
    schema: 'pearcup-polymarket-v1',
    provider: 'Polymarket',
    status: 'ok',
    fetchedAt,
    match,
    market: {
      id: market.id || market.conditionId || null,
      question: text(market.question || market.title),
      slug,
      url: slug ? `https://polymarket.com/event/${encodeURIComponent(slug)}` : 'https://polymarket.com',
      volume: Number(market.volumeNum || market.volume || 0) || null,
      liquidity: Number(market.liquidityNum || market.liquidity || 0) || null
    },
    odds
  }
}

function unavailableSnapshot (match, fetchedAt, reason) {
  return {
    schema: 'pearcup-polymarket-v1',
    provider: 'Polymarket',
    status: 'unavailable',
    fetchedAt,
    match,
    reason: reason || 'The public Polymarket relay could not refresh this fixture.'
  }
}

async function createMatchSnapshot ({ match, fetchedAt }) {
  const market = await findMarket(match)
  const tokenIds = market ? parseJsonList(market.clobTokenIds).filter(Boolean) : []
  const midpointMap = await midpointPrices(tokenIds)
  return buildOddsSnapshot({ match, market, midpointMap, fetchedAt })
}

export function oddsEntries (snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return {}
  if (snapshot.schema === 'pearcup-polymarket-v2' && snapshot.matches && typeof snapshot.matches === 'object') return snapshot.matches
  const id = snapshot.match && snapshot.match.id
  return id == null ? {} : { [String(id)]: snapshot }
}

// Preserve the previous successful price for a fixture if the newest provider
// attempt fails. Its original fetchedAt stays intact so clients show it as stale
// rather than falsely presenting it as a fresh price.
export function mergeLastKnownGoodOdds (previous, next) {
  const previousEntries = oddsEntries(previous)
  const nextEntries = oddsEntries(next)
  const matches = {}
  for (const [id, snapshot] of Object.entries(nextEntries)) {
    const prior = previousEntries[id]
    matches[id] = snapshot && snapshot.status === 'ok'
      ? snapshot
      : prior && prior.status === 'ok'
        ? prior
        : snapshot
  }
  return {
    ...next,
    status: Object.values(matches).some(snapshot => snapshot && snapshot.status === 'ok') ? 'ok' : 'unavailable',
    matches
  }
}

export async function createFixtureOddsSnapshot ({ liveSnapshot, now, limit } = {}) {
  const fetchedAt = now || new Date().toISOString()
  const matches = fixtureMatchesFromSnapshot(liveSnapshot, { limit })
  const entries = await Promise.all(matches.map(async match => {
    try {
      return [String(match.id), await createMatchSnapshot({ match, fetchedAt })]
    } catch (error) {
      return [String(match.id), unavailableSnapshot(match, fetchedAt)]
    }
  }))
  const snapshots = Object.fromEntries(entries)
  return {
    schema: 'pearcup-polymarket-v2',
    provider: 'Polymarket',
    status: Object.values(snapshots).some(snapshot => snapshot.status === 'ok') ? 'ok' : 'unavailable',
    generatedAt: fetchedAt,
    matches: snapshots
  }
}

export async function createSnapshot ({ liveSnapshot, now } = {}) {
  const match = activeMatchFromSnapshot(liveSnapshot)
  return createMatchSnapshot({ match, fetchedAt: now || new Date().toISOString() })
}

async function main () {
  const { readFile, writeFile } = await import('node:fs/promises')
  const liveFile = new URL('./live-match.json', import.meta.url)
  const outputFile = new URL('./polymarket-odds.json', import.meta.url)
  const liveSnapshot = JSON.parse(await readFile(liveFile, 'utf8'))
  const next = await createFixtureOddsSnapshot({ liveSnapshot })
  let previous = null
  try { previous = JSON.parse(await readFile(outputFile, 'utf8')) } catch {}
  const snapshot = mergeLastKnownGoodOdds(previous, next)
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`wrote polymarket-odds.json: ${snapshot.status} · ${Object.keys(snapshot.matches || {}).length} fixtures`)
}

async function writeFailureSnapshot (error) {
  const { writeFile } = await import('node:fs/promises')
  const outputFile = new URL('./polymarket-odds.json', import.meta.url)
  const snapshot = {
    schema: 'pearcup-polymarket-v2',
    provider: 'Polymarket',
    status: 'unavailable',
    generatedAt: new Date().toISOString(),
    matches: {},
    reason: 'The public Polymarket relay could not refresh this fixture.'
  }
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`).catch(() => {})
  console.error('Polymarket odds relay failed:', error && error.message || error)
}

async function isNodeMain () {
  if (typeof process === 'undefined' || !process.argv || !process.argv[1]) return false
  const { pathToFileURL } = await import('node:url')
  return pathToFileURL(process.argv[1]).href === import.meta.url
}

if (await isNodeMain()) {
  main().catch(async error => {
    await writeFailureSnapshot(error)
    process.exitCode = 1
  })
}
