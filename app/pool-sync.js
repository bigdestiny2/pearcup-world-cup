// PearCup pool entry ledger.
//
// Pool numbers are derived from actual peer submissions, never seeded fixtures.
// The ledger intentionally carries no wallet secret, payment authorization, or
// payout instruction: every entry is a client-signed DEMO_USDT participation
// record. A client can only debit its own local demo wallet before publishing.
(function attachPearCupPoolSync (root) {
  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.pearcupPoolSyncModule = status
    }
  }

  const Net = root.PearCupPeerNet
  if (!Net) { markModule('missing-peer-net'); console.warn('PearCupPeerNet missing — pool sync disabled'); return }

  const TOPIC = 'pearcup:v1:pools'
  const PROTOCOL = 'pearcup.pool-ledger.v1'
  const SNAPSHOT_CHUNK = 20
  const MAX_ENTRIES = 512
  const VALID_TIERS = new Set([5, 10, 25, 50, 100])
  const ID_PATTERN = /^[a-f0-9]{32,128}$/i
  const TEAM_PATTERN = /^[a-z0-9-]{1,32}$/i
  const POOL_PATTERN = /^(bracket|match):[a-z0-9:$-]{1,140}$/i

  const S = {
    channel: null,
    playerId: '',
    entries: new Map(),
    onChange: null,
    started: false
  }

  function safeText (value, max) {
    return String(value == null ? '' : value).trim().slice(0, max)
  }

  function normalizeEntry (input) {
    if (!input || typeof input !== 'object') return null
    const entry = {
      v: 1,
      entryId: safeText(input.entryId, 128),
      playerId: safeText(input.playerId, 128),
      username: safeText(input.username, 48),
      teamId: safeText(input.teamId, 32),
      poolKey: safeText(input.poolKey, 160),
      kind: safeText(input.kind, 12),
      tier: Number(input.tier),
      pick: safeText(input.pick, 32),
      pickName: safeText(input.pickName, 64),
      currency: safeText(input.currency, 16),
      createdAt: Number(input.createdAt)
    }
    if (!ID_PATTERN.test(entry.entryId) || !ID_PATTERN.test(entry.playerId)) return null
    if (!entry.username || !TEAM_PATTERN.test(entry.teamId) || !POOL_PATTERN.test(entry.poolKey)) return null
    if ((entry.kind !== 'bracket' && entry.kind !== 'match') || !VALID_TIERS.has(entry.tier)) return null
    if (entry.kind === 'bracket' && (!/^bracket:\$(?:10|25|50|100)$/.test(entry.poolKey) || entry.pick || entry.pickName)) return null
    if (entry.kind === 'match' && (!entry.pick || !entry.pickName || !/^match:[a-z0-9:$-]+$/i.test(entry.poolKey))) return null
    if (entry.currency !== 'DEMO_USDT' || !Number.isSafeInteger(entry.createdAt) || entry.createdAt < 1700000000000) return null
    return entry
  }

  function listEntries () {
    return [...S.entries.values()].sort((a, b) => a.createdAt - b.createdAt || a.entryId.localeCompare(b.entryId))
  }

  function samePlayerPool (entry) {
    return `${entry.playerId}:${entry.poolKey}`
  }

  function existingForPlayerPool (entry) {
    const key = samePlayerPool(entry)
    return listEntries().find(candidate => samePlayerPool(candidate) === key) || null
  }

  function isEarlier (next, current) {
    return next.createdAt < current.createdAt || (next.createdAt === current.createdAt && next.entryId.localeCompare(current.entryId) < 0)
  }

  function notify () {
    if (typeof S.onChange === 'function') {
      try { S.onChange(listEntries()) } catch (err) {}
    }
  }

  function remember (input) {
    const entry = normalizeEntry(input)
    if (!entry) return null
    const existingById = S.entries.get(entry.entryId)
    if (existingById) return existingById
    const existing = existingForPlayerPool(entry)
    if (existing && !isEarlier(entry, existing)) return existing
    if (existing) S.entries.delete(existing.entryId)
    if (!existing && S.entries.size >= MAX_ENTRIES) return null
    S.entries.set(entry.entryId, entry)
    notify()
    return entry
  }

  function send (message) {
    if (!S.channel) return
    try { S.channel.send({ ...message, protocol: PROTOCOL, from: S.playerId }) } catch (err) {}
  }

  function sendSnapshot (to) {
    const entries = listEntries()
    if (!entries.length) {
      send({ t: 'pool:snapshot', to, entries: [] })
      return
    }
    for (let index = 0; index < entries.length; index += SNAPSHOT_CHUNK) {
      send({ t: 'pool:snapshot', to, entries: entries.slice(index, index + SNAPSHOT_CHUNK) })
    }
  }

  function onMessage (message) {
    if (!message || message.protocol !== PROTOCOL || message.from === S.playerId) return
    if (!ID_PATTERN.test(String(message.from || ''))) return
    if (message.t === 'pool:hello') {
      sendSnapshot(message.from)
      return
    }
    if (message.t === 'pool:entry') {
      remember(message.entry)
      return
    }
    if (message.t === 'pool:snapshot' && message.to === S.playerId && Array.isArray(message.entries)) {
      message.entries.slice(0, SNAPSHOT_CHUNK).forEach(remember)
    }
  }

  function start ({ playerId, entries = [], onChange } = {}) {
    if (!ID_PATTERN.test(String(playerId || ''))) throw new Error('Pool sync requires a persistent player id')
    S.playerId = String(playerId)
    S.onChange = typeof onChange === 'function' ? onChange : null
    Array.isArray(entries) && entries.slice(0, MAX_ENTRIES).forEach(remember)
    if (!S.channel) {
      S.channel = Net.createChannel(TOPIC)
      S.channel.onMessage(onMessage)
    }
    S.started = true
    send({ t: 'pool:hello' })
    // Re-announce this device's own persisted submissions. This preserves a
    // legitimate entry after a reload without inventing any roster records.
    listEntries().filter(entry => entry.playerId === S.playerId).forEach(entry => send({ t: 'pool:entry', entry }))
    notify()
    return S.channel
  }

  function submit (input) {
    if (!S.started || !S.playerId) throw new Error('Pool sync is not ready')
    const entry = normalizeEntry({
      ...input,
      v: 1,
      entryId: Net.newPeerId(),
      playerId: S.playerId,
      currency: 'DEMO_USDT',
      createdAt: Date.now()
    })
    if (!entry) throw new Error('Invalid pool entry')
    const existing = existingForPlayerPool(entry)
    if (existing) return existing
    const remembered = remember(entry)
    if (!remembered) throw new Error('Pool ledger is full')
    send({ t: 'pool:entry', entry: remembered })
    return remembered
  }

  function entriesFor (poolKey) {
    return listEntries().filter(entry => entry.poolKey === poolKey)
  }

  const api = {
    TOPIC,
    PROTOCOL,
    start,
    submit,
    entries: listEntries,
    entriesFor,
    normalizeEntry,
    get backend () { return S.channel ? S.channel.backend : 'inactive' },
    _state: S
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupPoolSync = api
  markModule('ready')
})(typeof globalThis !== 'undefined' ? globalThis : window)
