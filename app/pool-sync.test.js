const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')

const peerNetSource = readFileSync(join(__dirname, 'peer-net.js'), 'utf8')
const poolSyncSource = readFileSync(join(__dirname, 'pool-sync.js'), 'utf8')
const appSource = readFileSync(join(__dirname, 'app.js'), 'utf8')

function waitFor (predicate, label = 'condition') {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > 1500) return reject(new Error(`timed out waiting for ${label}`))
      setTimeout(tick, 10)
    }
    tick()
  })
}

function createBroadcastHub () {
  const rooms = new Map()
  return class FakeBroadcastChannel {
    constructor (topic) {
      this.topic = topic
      this.onmessage = null
      if (!rooms.has(topic)) rooms.set(topic, new Set())
      rooms.get(topic).add(this)
    }

    postMessage (data) {
      for (const peer of rooms.get(this.topic) || []) {
        if (peer !== this && peer.onmessage) setTimeout(() => peer.onmessage({ data }), 0)
      }
    }

    close () { rooms.get(this.topic)?.delete(this) }
  }
}

function createClient (BroadcastChannel) {
  const document = { documentElement: { dataset: {} } }
  const context = {
    console,
    Uint8Array,
    TextEncoder,
    TextDecoder,
    crypto: globalThis.crypto,
    BroadcastChannel,
    document,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  }
  context.window = context
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(peerNetSource, context, { filename: 'peer-net.js' })
  vm.runInContext(poolSyncSource, context, { filename: 'pool-sync.js' })
  return { context, document }
}

function entry (id, playerId, poolKey = 'bracket:$25') {
  return {
    entryId: id,
    playerId,
    username: playerId === 'a'.repeat(32) ? 'alpha' : 'bravo',
    teamId: playerId === 'a'.repeat(32) ? 'br' : 'jp',
    poolKey,
    kind: poolKey.startsWith('bracket:') ? 'bracket' : 'match',
    tier: poolKey.endsWith('$25') ? 25 : 10,
    pick: poolKey.startsWith('match:') ? 'br' : '',
    pickName: poolKey.startsWith('match:') ? 'Brazil' : '',
    currency: 'DEMO_USDT',
    createdAt: 1760000000000
  }
}

test('pool ledger starts empty and never injects seeded entrants', () => {
  const client = createClient(createBroadcastHub())
  const changes = []
  client.context.PearCupPoolSync.start({
    playerId: 'a'.repeat(32),
    entries: [],
    onChange: entries => changes.push(entries)
  })
  assert.equal(client.document.documentElement.dataset.pearcupPoolSyncModule, 'ready')
  assert.deepEqual(JSON.parse(JSON.stringify(client.context.PearCupPoolSync.entries())), [])
  assert.deepEqual(JSON.parse(JSON.stringify(changes.at(-1))), [])
})

test('two real clients converge on submitted demo-USDT entries without wallet data', async () => {
  const BroadcastChannel = createBroadcastHub()
  const alpha = createClient(BroadcastChannel)
  const bravo = createClient(BroadcastChannel)
  const alphaChanges = []
  const bravoChanges = []
  alpha.context.PearCupPoolSync.start({ playerId: 'a'.repeat(32), entries: [], onChange: entries => alphaChanges.push(entries) })
  bravo.context.PearCupPoolSync.start({ playerId: 'b'.repeat(32), entries: [], onChange: entries => bravoChanges.push(entries) })

  const submitted = alpha.context.PearCupPoolSync.submit({
    username: 'alpha', teamId: 'br', poolKey: 'bracket:$25', kind: 'bracket', tier: 25, pick: '', pickName: ''
  })
  assert.equal(submitted.currency, 'DEMO_USDT')
  assert.equal('wallet' in submitted, false)
  assert.equal('payoutAddress' in submitted, false)
  await waitFor(() => bravo.context.PearCupPoolSync.entriesFor('bracket:$25').length === 1, 'remote pool entry')
  assert.equal(alpha.context.PearCupPoolSync.entriesFor('bracket:$25').length, 1)
  assert.equal(bravo.context.PearCupPoolSync.entriesFor('bracket:$25')[0].username, 'alpha')
  assert.ok(alphaChanges.length > 0)
  assert.ok(bravoChanges.length > 0)
})

test('ledger rejects malformed entries and keeps one entry per player and pool', () => {
  const client = createClient(createBroadcastHub())
  const api = client.context.PearCupPoolSync
  api.start({ playerId: 'a'.repeat(32), entries: [] })
  assert.equal(api.normalizeEntry({ ...entry('not-a-valid-id', 'a'.repeat(32)), currency: 'USDT' }), null)
  assert.equal(api.normalizeEntry({ ...entry('c'.repeat(32), 'a'.repeat(32)), createdAt: 12 }), null)
  const first = api.submit({ username: 'alpha', teamId: 'br', poolKey: 'bracket:$25', kind: 'bracket', tier: 25, pick: '', pickName: '' })
  const duplicate = api.submit({ username: 'alpha', teamId: 'br', poolKey: 'bracket:$25', kind: 'bracket', tier: 25, pick: '', pickName: '' })
  assert.equal(first.entryId, duplicate.entryId)
  assert.equal(api.entriesFor('bracket:$25').length, 1)
})

test('playable pool UI derives its numbers from the ledger and has no seeded player fixtures', () => {
  for (const retiredFixture of ['LOBBY_PLAYERS', 'gameLeaderboardRows', 'demoBracketEntrants', 'sample: {']) {
    assert.equal(appSource.includes(retiredFixture), false, `${retiredFixture} must not remain in the playable app`)
  }
  for (const requiredLedgerPath of ['poolLedgerEntries', 'bracketPoolMetrics', 'matchPoolMetrics', 'startPoolSync', 'DEMO_USDT']) {
    assert.ok(appSource.includes(requiredLedgerPath), `app must use ${requiredLedgerPath}`)
  }
  assert.match(appSource, /Demo USDT · no cash payout/)
  assert.match(appSource, /cash settlement and payouts are disabled/)
})
