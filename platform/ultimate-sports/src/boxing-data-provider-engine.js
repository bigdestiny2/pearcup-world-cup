'use strict'

// Boxing data provider adapter.
//
// The write-up at liblab.com/blog/api-boxing-data points at three sources:
//   - BoxRec        — fighter records + bout history (no public API; scraping
//                     violates its ToS)
//   - CompuBox      — per-fight punch stats (thrown / landed / accuracy)
//   - BoxingData API — a community project that stitches BoxRec + CompuBox into
//                     one OpenAPI endpoint, hosted free on Render
//
// The combined BoxingData API is the only single-call option, but it is
// UNRELIABLE (the free Render dyno sleeps and returns 503) and inherits
// BoxRec's scraping ToS risk. So it is treated here as best-effort ENRICHMENT
// only — never the settlement source of truth. Real winner/method/round
// settlement stays with the fit's contracted providers (SportsDataIO where
// boxing is covered, else host-evidence + QVAC review), exactly as
// sports-data-provider-engine already routes `mma-boxing-fight-card`.
//
// This module is pure and framework-free:
//   normalizeBoxingCard()  raw API payload      -> fight-card shape
//   toResultSnapshot()     fight-card shape     -> resultSnapshot the scoring
//                                                  engine (scorePlayerPropEntry)
//                                                  settles directly
//   overlayFitConfig()     card records/stats   -> enriched fit config copy
//   fetchBoxingCard()      network + cache + graceful fallback to curated card
//
// Fetching never throws and never leaves the room without data: a 503 falls
// back to the last cached card, then to the curated card baked into the fit.

const BOXING_DATA_BASE_URL = 'https://boxingdata.onrender.com'

function requirement (input) {
  return Object.freeze({
    apiId: input.apiId,
    provider: input.provider,
    purpose: input.purpose,
    role: input.role,
    auth: input.auth,
    reliability: input.reliability,
    settlementGrade: Boolean(input.settlementGrade),
    baseUrl: input.baseUrl || null,
    docsUrl: input.docsUrl || null,
    env: Object.freeze((input.env || []).slice()),
    notes: Object.freeze((input.notes || []).slice())
  })
}

const BOXING_DATA_REQUIREMENTS = Object.freeze([
  requirement({
    apiId: 'boxingdata-api',
    provider: 'BoxingData API (community · BoxRec + CompuBox)',
    purpose: 'Enrich the fight card with fighter records (W-L-D-KO) and CompuBox punch stats.',
    role: 'enrichment-only',
    auth: 'Public OpenAPI. Call through a same-origin proxy so no key ships to the client and CSP (default-src \'self\') stays intact.',
    reliability: 'low — free Render dyno sleeps and answers 503; always keep a curated fallback card.',
    settlementGrade: false,
    baseUrl: BOXING_DATA_BASE_URL,
    docsUrl: 'https://boxingdata.onrender.com/docs',
    env: ['BOXING_DATA_BASE_URL', 'BOXING_DATA_PROXY_URL', 'BOXING_DATA_EVENT_ID'],
    notes: [
      'Never settle prizes from this feed — it scrapes BoxRec/CompuBox and has no SLA.',
      'Proxy path is configurable; the client only ever calls the same-origin proxy URL.'
    ]
  }),
  requirement({
    apiId: 'sportsdataio-mma',
    provider: 'SportsDataIO (MMA API)',
    purpose: 'Settlement-grade winner / method / round results where boxing coverage exists.',
    role: 'settlement-supplement',
    auth: 'Ocp-Apim-Subscription-Key server-side header only — never expose to the client.',
    reliability: 'high, but boxing (vs MMA) coverage must be verified per provider contract.',
    settlementGrade: true,
    baseUrl: 'https://api.sportsdata.io/v3/mma',
    docsUrl: null,
    env: ['SPORTSDATAIO_MMA_API_KEY'],
    notes: ['Primary settlement route for mma-boxing-fight-card in sports-data-provider-engine.']
  })
])

// Provider descriptor mirroring sports-data-provider-engine's PROVIDERS shape,
// so the same object can be registered there as a supplement for the fit.
const BOXING_DATA_PROVIDER = Object.freeze({
  providerId: 'boxingdata',
  title: 'BoxingData API (BoxRec + CompuBox)',
  role: 'boxing-enrichment-supplement',
  coverage: Object.freeze(['combat-sports']),
  strengths: Object.freeze(['fighter records (W-L-D-KO)', 'CompuBox punch stats', 'single combined OpenAPI endpoint']),
  gaps: Object.freeze(['community project on free Render tier — 503 when the dyno sleeps', 'scrapes BoxRec/CompuBox (ToS / legal gray area)', 'not settlement-grade — enrichment only']),
  auth: 'public OpenAPI via same-origin proxy',
  recommendation: 'supplement'
})

// --- result vocabulary: raw API values -> the fit's prop option strings ---
// scorePlayerPropEntry compares picks and actuals with normalizePropValue()
// (trim + lowercase), so producing the fit's exact option text matches cleanly.
const METHOD_MAP = Object.freeze({
  ko: 'KO/TKO', tko: 'KO/TKO', 'ko/tko': 'KO/TKO', rtd: 'KO/TKO', stoppage: 'KO/TKO', 'ref stoppage': 'KO/TKO',
  submission: 'Submission', sub: 'Submission', tap: 'Submission', tapout: 'Submission',
  decision: 'Decision', ud: 'Decision', md: 'Decision', sd: 'Decision', points: 'Decision',
  'unanimous decision': 'Decision', 'split decision': 'Decision', 'majority decision': 'Decision', 'technical decision': 'Decision',
  draw: 'Draw/No Contest', 'no contest': 'Draw/No Contest', nc: 'Draw/No Contest', dq: 'Draw/No Contest', disqualification: 'Draw/No Contest'
})

function mapMethod (raw) {
  if (raw == null) return null
  return METHOD_MAP[String(raw).trim().toLowerCase()] || null
}

function mapRound (raw, mappedMethod) {
  if (mappedMethod === 'Decision') return 'Decision'
  const text = String(raw == null ? '' : raw).trim().toLowerCase()
  if (!text) return mappedMethod ? null : null
  if (text.startsWith('dec') || text === 'distance' || text === 'final') return 'Decision'
  const n = parseInt(text.replace(/[^0-9]/g, ''), 10)
  if (Number.isFinite(n) && n >= 1 && n <= 15) return `Round ${n}`
  return null
}

function slugId (name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'fighter'
}

function num (value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function pickFighter (raw, roster) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const name = source.name || source.fullName || source.fighter || source.displayName || ''
  const rosterMatch = matchRoster(name, source.id, roster)
  const record = source.record && typeof source.record === 'object'
    ? { wins: num(source.record.wins), losses: num(source.record.losses), draws: num(source.record.draws), kos: num(source.record.kos != null ? source.record.kos : source.record.knockouts) }
    : parseRecordString(source.record)
  const punches = source.punchStats || source.compubox || source.stats || null
  return {
    id: rosterMatch || (source.id != null ? String(source.id) : slugId(name)),
    name: name || (source.id != null ? String(source.id) : 'Fighter'),
    nickname: source.nickname || source.alias || null,
    country: source.country || source.nationality || null,
    stance: source.stance || null,
    record,
    recordText: formatRecord(record),
    punchStats: punches
      ? { thrown: num(punches.thrown != null ? punches.thrown : punches.total), landed: num(punches.landed), accuracy: num(punches.accuracy != null ? punches.accuracy : punches.pct) }
      : null
  }
}

function matchRoster (name, id, roster) {
  if (!Array.isArray(roster) || !roster.length) return null
  const key = String(name || '').trim().toLowerCase()
  const idKey = id != null ? String(id).trim().toLowerCase() : ''
  const hit = roster.find(entry => {
    const entryName = String(entry.name || '').trim().toLowerCase()
    const entryId = String(entry.id || '').trim().toLowerCase()
    if (idKey && entryId && idKey === entryId) return true
    if (key && entryName && (entryName === key || entryName.includes(key) || key.includes(entryName))) return true
    return false
  })
  return hit ? hit.id : null
}

function parseRecordString (value) {
  if (typeof value !== 'string') return { wins: null, losses: null, draws: null, kos: null }
  const parts = value.split(/[–\-]/).map(part => num(part.trim()))
  return { wins: parts[0] != null ? parts[0] : null, losses: parts[1] != null ? parts[1] : null, draws: parts[2] != null ? parts[2] : null, kos: null }
}

function formatRecord (record) {
  if (!record || record.wins == null) return null
  const base = [record.wins, record.losses, record.draws].filter(part => part != null).join('–')
  return record.kos != null ? `${base} (${record.kos} KO)` : base
}

function resolveEntrantId (winnerRaw, red, blue) {
  if (winnerRaw == null) return null
  if (typeof winnerRaw === 'object') return resolveEntrantId(winnerRaw.id || winnerRaw.name || winnerRaw.fighter, red, blue)
  const key = String(winnerRaw).trim().toLowerCase()
  if (!key) return null
  if (['a', 'red', 'home', '1', 'fightera', 'fighter_a'].includes(key)) return red.id
  if (['b', 'blue', 'away', '2', 'fighterb', 'fighter_b'].includes(key)) return blue.id
  for (const side of [red, blue]) {
    const idKey = String(side.id || '').toLowerCase()
    const nameKey = String(side.name || '').toLowerCase()
    if (key === idKey || (nameKey && (key === nameKey || nameKey.includes(key) || key.includes(nameKey)))) return side.id
  }
  return null
}

function readResult (rawResult, red, blue) {
  const source = rawResult && typeof rawResult === 'object' ? rawResult : {}
  const hasResult = source.winner != null || source.method != null || source.result != null || source.outcome != null
  if (!hasResult) return null
  const method = mapMethod(source.method || source.result || source.outcome)
  const round = mapRound(source.round != null ? source.round : source.endRound, method)
  const winnerEntrantId = resolveEntrantId(source.winner != null ? source.winner : source.winnerId, red, blue)
  return {
    winnerEntrantId,
    method,
    round,
    time: source.time || null,
    final: source.final != null ? Boolean(source.final) : true
  }
}

function normalizeBoxingCard (raw, options = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const roster = options.roster || null
  const rawBouts = source.bouts || source.fights || source.matches || source.card || []
  const fighters = new Map()
  const register = fighter => { if (!fighters.has(fighter.id)) fighters.set(fighter.id, fighter) }

  const bouts = (Array.isArray(rawBouts) ? rawBouts : []).map((bout, index) => {
    const b = bout && typeof bout === 'object' ? bout : {}
    const red = pickFighter(b.fighterA || b.red || b.home || b.a || b.left || {}, roster)
    const blue = pickFighter(b.fighterB || b.blue || b.away || b.b || b.right || {}, roster)
    register(red)
    register(blue)
    return {
      fixtureId: String(b.id || b.boutId || b.fixtureId || `bout-${index + 1}`),
      order: num(b.order) || index + 1,
      title: `${red.name} vs ${blue.name}`,
      billing: b.billing || b.slot || (index === 0 ? 'Main event' : null),
      weightClass: b.weightClass || b.division || b.weight || null,
      scheduledRounds: num(b.rounds != null ? b.rounds : b.scheduledRounds),
      slots: [red.id, blue.id],
      result: readResult(b.result || b, red, blue)
    }
  })

  return {
    event: source.event || source.title || source.name || 'Boxing card',
    date: source.date || source.startTime || null,
    venue: source.venue || source.location || null,
    source: options.source || 'api',
    stale: Boolean(options.stale),
    fetchedAt: options.now != null ? options.now : null,
    fighters: [...fighters.values()],
    bouts
  }
}

// Produce the resultSnapshot shape scorePlayerPropEntry consumes:
//   { results: { [fixtureId]: { winnerEntrantId, method, round } } }
// Only finished bouts (with a resolved winner or method) are included.
function toResultSnapshot (card, options = {}) {
  const results = {}
  const source = card && Array.isArray(card.bouts) ? card.bouts : []
  for (const bout of source) {
    const r = bout.result
    if (!r || !r.final) continue
    if (r.winnerEntrantId == null && r.method == null) continue
    results[bout.fixtureId] = { winnerEntrantId: r.winnerEntrantId, method: r.method, round: r.round }
  }
  return {
    snapshotId: options.snapshotId || `boxing:${card && card.event ? card.event : 'card'}`,
    source: card && card.source ? card.source : 'api',
    stale: Boolean(card && card.stale),
    capturedAt: card ? card.fetchedAt : null,
    results
  }
}

// Build matchStats rows ([label, redValue, blueValue, redSharePercent]) from a
// bout's CompuBox punch stats, matching the fit's matchStats shape.
function punchStatRows (card, fixtureId) {
  const bout = card && Array.isArray(card.bouts)
    ? card.bouts.find(item => item.fixtureId === fixtureId) || card.bouts[0]
    : null
  if (!bout) return []
  const red = findFighter(card, bout.slots[0])
  const blue = findFighter(card, bout.slots[1])
  if (!red || !blue || !red.punchStats || !blue.punchStats) return []
  const rows = []
  const addRow = (label, rVal, bVal) => {
    if (rVal == null && bVal == null) return
    const total = (rVal || 0) + (bVal || 0)
    const share = total > 0 ? Math.round(((rVal || 0) / total) * 100) : 50
    rows.push([label, String(rVal != null ? rVal : '—'), String(bVal != null ? bVal : '—'), share])
  }
  addRow('Punches landed', red.punchStats.landed, blue.punchStats.landed)
  addRow('Punches thrown', red.punchStats.thrown, blue.punchStats.thrown)
  if (red.punchStats.accuracy != null || blue.punchStats.accuracy != null) {
    const rAcc = red.punchStats.accuracy
    const bAcc = blue.punchStats.accuracy
    const total = (rAcc || 0) + (bAcc || 0)
    rows.push(['Accuracy %', rAcc != null ? `${rAcc}%` : '—', bAcc != null ? `${bAcc}%` : '—', total > 0 ? Math.round(((rAcc || 0) / total) * 100) : 50])
  }
  return rows
}

function findFighter (card, id) {
  if (!card || !Array.isArray(card.fighters)) return null
  return card.fighters.find(fighter => fighter.id === id) || null
}

// Non-destructive: returns a shallow copy of the fit with the arcade fighter
// records, team records, and matchStats overlaid from live boxing data. Only
// fields with real data are touched; everything else is left as authored.
function overlayFitConfig (fit, card) {
  if (!fit || !card || !Array.isArray(card.bouts) || !card.bouts.length) return fit
  const mainBout = card.bouts[0]
  const next = { ...fit }

  if (fit.arcade && typeof fit.arcade === 'object') {
    const arcade = { ...fit.arcade }
    for (const side of ['red', 'blue']) {
      const corner = fit.arcade[side]
      if (!corner || typeof corner !== 'object') continue
      const boutId = mainBout.slots.find(id => id === corner.id) || (side === 'red' ? mainBout.slots[0] : mainBout.slots[1])
      const fighter = findFighter(card, boutId)
      if (fighter && fighter.recordText) arcade[side] = { ...corner, record: fighter.recordText }
    }
    next.arcade = arcade
  }

  if (Array.isArray(fit.teams)) {
    next.teams = fit.teams.map(team => {
      const fighter = findFighter(card, team.id)
      return fighter && fighter.recordText ? { ...team, record: fighter.recordText } : team
    })
  }

  const stats = punchStatRows(card, mainBout.fixtureId)
  if (stats.length) next.matchStats = stats

  return next
}

function createMemoryCache () {
  const store = new Map()
  return {
    get (key) { return store.has(key) ? store.get(key) : null },
    set (key, value) { store.set(key, value) },
    clear () { store.clear() }
  }
}

function cacheKeyFor (config) {
  return `${config.baseUrl || BOXING_DATA_BASE_URL}::${config.eventId || 'default'}`
}

function buildRequestUrl (config) {
  if (config.proxy) return config.proxy
  if (!config.eventId) return null
  const base = (config.baseUrl || BOXING_DATA_BASE_URL).replace(/\/$/, '')
  const path = (config.eventPath || '/events/{eventId}').replace('{eventId}', encodeURIComponent(config.eventId))
  return `${base}${path}`
}

// Fetch a boxing card with cache + graceful fallback. Never throws.
// Resolution order on failure: last cached card -> curated card -> null.
// Returns { card, source, stale, reason }.
async function fetchBoxingCard ({ config = {}, fetchImpl, cache = null, now = null } = {}) {
  const roster = config.roster || null
  const curated = config.curatedCard
    ? normalizeBoxingCard(config.curatedCard, { source: 'curated', stale: true, roster, now })
    : null
  const key = cacheKeyFor(config)
  const fallback = reason => {
    const cached = cache && typeof cache.get === 'function' ? cache.get(key) : null
    if (cached && cached.card) return { card: { ...cached.card, stale: true, source: 'cache' }, source: 'cache', stale: true, reason }
    if (curated) return { card: curated, source: 'curated', stale: true, reason }
    return { card: null, source: 'none', stale: true, reason }
  }

  if (!config.enabled) return { card: curated, source: 'curated', stale: true, reason: 'disabled' }

  const url = buildRequestUrl(config)
  const fetcher = fetchImpl || (typeof fetch === 'function' ? fetch : null)
  if (!fetcher || !url) return fallback(!url ? 'no-url' : 'no-fetch')

  try {
    const response = await fetcher(url, { headers: config.headers || {} })
    if (!response || !response.ok) return fallback(`status-${response ? response.status : 'none'}`)
    const raw = await response.json()
    const card = normalizeBoxingCard(raw, { source: 'api', stale: false, roster, now })
    if (cache && typeof cache.set === 'function') cache.set(key, { card, at: now })
    return { card, source: 'api', stale: false, reason: 'ok' }
  } catch (error) {
    return fallback(`error-${error && error.message ? error.message : 'unknown'}`)
  }
}

module.exports = {
  BOXING_DATA_BASE_URL,
  BOXING_DATA_REQUIREMENTS,
  BOXING_DATA_PROVIDER,
  METHOD_MAP,
  mapMethod,
  mapRound,
  normalizeBoxingCard,
  toResultSnapshot,
  punchStatRows,
  overlayFitConfig,
  buildRequestUrl,
  createMemoryCache,
  fetchBoxingCard
}
