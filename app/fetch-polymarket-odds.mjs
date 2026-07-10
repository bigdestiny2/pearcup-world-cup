// Same-origin Polymarket odds relay for the Kawaii app.
//
// Uses Polymarket's public Gamma API for discovery and its public CLOB midpoint
// endpoint for fresher prices when token IDs are available. It never reads a wallet,
// creates an order, or exposes the renderer to a third-party origin.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const LIVE_FILE = new URL('./live-match.json', import.meta.url)
const OUTPUT_FILE = new URL('./polymarket-odds.json', import.meta.url)
const GAMMA_SEARCH = 'https://gamma-api.polymarket.com/public-search'
const CLOB_MIDPOINTS = 'https://clob.polymarket.com/midpoints'
const REQUEST_TIMEOUT_MS = Math.max(2_000, Math.min(30_000, Number(process.env.POLYMARKET_REQUEST_TIMEOUT_MS) || 8_000))

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

function activeMatchFromSnapshot (snapshot) {
  const match = snapshot && snapshot.activeMatch || snapshot || {}
  const home = text(match.homeTeam && (match.homeTeam.shortName || match.homeTeam.name) || match.home && match.home.name)
  const away = text(match.awayTeam && (match.awayTeam.shortName || match.awayTeam.name) || match.away && match.away.name)
  if (!home || !away) throw new Error('Live match snapshot is missing home or away team')
  return { id: match.id || null, home, away, stage: match.stage || null, utcDate: match.utcDate || null }
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

export async function createSnapshot ({ liveSnapshot, now } = {}) {
  const match = activeMatchFromSnapshot(liveSnapshot)
  const market = await findMarket(match)
  const tokenIds = market ? parseJsonList(market.clobTokenIds).filter(Boolean) : []
  const midpointMap = await midpointPrices(tokenIds)
  return buildOddsSnapshot({ match, market, midpointMap, fetchedAt: now || new Date().toISOString() })
}

async function main () {
  const liveSnapshot = JSON.parse(await readFile(LIVE_FILE, 'utf8'))
  const snapshot = await createSnapshot({ liveSnapshot })
  await writeFile(OUTPUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`wrote polymarket-odds.json: ${snapshot.status}${snapshot.market ? ` · ${snapshot.market.question}` : ''}`)
}

async function writeFailureSnapshot (error) {
  const snapshot = {
    schema: 'pearcup-polymarket-v1',
    provider: 'Polymarket',
    status: 'unavailable',
    fetchedAt: new Date().toISOString(),
    reason: 'The public Polymarket relay could not refresh this fixture.'
  }
  await writeFile(OUTPUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`).catch(() => {})
  console.error('Polymarket odds relay failed:', error && error.message || error)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch(async error => {
    await writeFailureSnapshot(error)
    process.exitCode = 1
  })
}
