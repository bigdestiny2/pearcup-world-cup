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

async function pickMatch () {
  if (process.env.MATCH_ID) return get(`https://api.football-data.org/v4/matches/${process.env.MATCH_ID}`)
  const live = await get(`${base}?status=LIVE`)
  if (live.matches && live.matches.length) return live.matches[0]
  const all = await get(base)
  const ms = all.matches || []
  // else: most recent finished, or soonest upcoming
  const sorted = ms.sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || new Date(a.utcDate) - new Date(b.utcDate))
  return sorted[0]
}

const m = await pickMatch()
// Cache crests + competition emblem locally and rewrite to relative paths.
if (m.homeTeam) m.homeTeam.crest = await cacheImg(m.homeTeam.crest)
if (m.awayTeam) m.awayTeam.crest = await cacheImg(m.awayTeam.crest)
if (m.competition) m.competition.emblem = await cacheImg(m.competition.emblem)
await writeFile(new URL('./live-match.json', import.meta.url), JSON.stringify(m, null, 2))
console.log('wrote live-match.json:', m.id, m.status, m.homeTeam?.shortName, JSON.stringify(m.score?.fullTime), m.awayTeam?.shortName)
