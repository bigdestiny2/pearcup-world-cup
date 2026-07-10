// Server-side live-match relay for the Kawaii app.
// Mirrors the Pear-worker production pattern: a process WITH network access
// fetches the football API (no browser CORS) and writes a same-origin JSON
// file that the renderer polls. Key comes from the env — never hard-coded.
//
//   FOOTBALL_DATA_KEY=xxxx node fetch-live.mjs
//
// In production a Pear worker runs this on a timer and relays over the room topic.
import { writeFile, mkdir } from 'node:fs/promises'

const KEY = process.env.FOOTBALL_DATA_KEY
if (!KEY) { console.error('Set FOOTBALL_DATA_KEY'); process.exit(1) }

// Cache a crest/emblem locally so the renderer loads it same-origin (no external
// image blocks / CORS). Returns a relative path, or the original URL on failure.
async function cacheImg (url) {
  if (!url) return url
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const buf = Buffer.from(await res.arrayBuffer())
    const name = url.split('/').pop().split('?')[0]
    await mkdir(new URL('./crests/', import.meta.url), { recursive: true })
    await writeFile(new URL(`./crests/${name}`, import.meta.url), buf)
    return `crests/${name}`
  } catch { return url }
}

const headers = { 'X-Auth-Token': KEY }
const base = 'https://api.football-data.org/v4/competitions/WC/matches'

async function get (url) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const rank = { IN_PLAY: 0, PAUSED: 0, LIVE: 0, TIMED: 1, SCHEDULED: 1, FINISHED: 2 }

function pickMatch (matches) {
  const sorted = [...matches].sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || new Date(a.utcDate) - new Date(b.utcDate))
  return sorted[0]
}

const all = await get(base)
const matches = Array.isArray(all.matches) ? all.matches : []
const forced = process.env.MATCH_ID
  ? await get(`https://api.football-data.org/v4/matches/${process.env.MATCH_ID}`)
  : null
const m = forced || pickMatch(matches)
if (!m) throw new Error('No World Cup match found')
if (forced && !matches.some(match => String(match.id) === String(m.id))) matches.unshift(m)

// Cache only the nearby fixtures' art so the browser stays fully same-origin while
// retaining the complete score/schedule feed for fixture and match-pool cards.
const cacheTargets = matches
  .sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || new Date(a.utcDate) - new Date(b.utcDate))
  .slice(0, 12)
await Promise.all(cacheTargets.map(async match => {
  if (match.homeTeam) match.homeTeam.crest = await cacheImg(match.homeTeam.crest)
  if (match.awayTeam) match.awayTeam.crest = await cacheImg(match.awayTeam.crest)
  if (match.competition) match.competition.emblem = await cacheImg(match.competition.emblem)
}))

const snapshot = {
  schema: 'pearcup-live-v2',
  provider: 'football-data.org',
  generatedAt: new Date().toISOString(),
  activeMatch: m,
  matches
}
await writeFile(new URL('./live-match.json', import.meta.url), JSON.stringify(snapshot, null, 2))
console.log('wrote live-match.json:', m.id, m.status, m.homeTeam?.shortName, JSON.stringify(m.score?.fullTime), m.awayTeam?.shortName, `(${matches.length} fixtures)`)
