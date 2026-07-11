import assert from 'node:assert/strict'
import test from 'node:test'
import { createLiveDataWorker } from './pearcup-live-data.mjs'

const NOW = new Date('2026-07-10T12:00:00.000Z')

function response (value, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => value }
}

function memoryKv () {
  const values = new Map()
  return {
    async get (key, type) {
      const value = values.get(key)
      return type === 'json' && value ? JSON.parse(value) : value || null
    },
    async put (key, value) { values.set(key, value) }
  }
}

test('Cloudflare live relay serves a fixture-indexed odds registry without exposing the football key', async () => {
  const worker = createLiveDataWorker({
    now: () => NOW,
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes('football-data.org')) {
        assert.equal(options.headers['X-Auth-Token'], 'secret-never-public')
        return response({ matches: [{
          id: 537384, status: 'TIMED', utcDate: '2026-07-10T19:00:00Z',
          homeTeam: { name: 'Spain', shortName: 'Spain' }, awayTeam: { name: 'Belgium', shortName: 'Belgium' }
        }] })
      }
      return response({ markets: [] })
    }
  })
  const env = { FOOTBALL_DATA_KEY: 'secret-never-public', LIVE_DATA: memoryKv(), PUBLIC_CORS_ORIGINS: '*', POLYMARKET_FIXTURE_LIMIT: '6' }
  await worker.refresh(env)

  const all = await worker.fetch(new Request('https://relay.example/v1/polymarket-odds.json'), env, { waitUntil () {} })
  const body = await all.text()
  assert.equal(all.status, 200)
  assert.equal(body.includes('secret-never-public'), false)
  assert.equal(JSON.parse(body).schema, 'pearcup-polymarket-v2')

  const selected = await worker.fetch(new Request('https://relay.example/v1/polymarket-odds.json?matchId=537384'), env, { waitUntil () {} })
  assert.equal(selected.status, 200)
  assert.equal((await selected.json()).match.id, 537384)

  const health = await worker.fetch(new Request('https://relay.example/healthz'), env, { waitUntil () {} })
  assert.equal(health.status, 200)
  assert.equal((await health.json()).fixtureCount, 1)
})

test('a stale KV snapshot self-heals on the next request and stays readable if the provider is down', async () => {
  const kv = memoryKv()
  const old = {
    schema: 'pearcup-live-v2',
    provider: 'football-data.org',
    generatedAt: '2026-07-10T00:00:00.000Z',
    activeMatch: { id: 1, status: 'TIMED', homeTeam: { name: 'Old' }, awayTeam: { name: 'Snapshot' } },
    matches: []
  }
  const oldOdds = {
    schema: 'pearcup-polymarket-v2',
    provider: 'Polymarket',
    generatedAt: old.generatedAt,
    matches: {}
  }
  await kv.put('live-match.json', JSON.stringify(old))
  await kv.put('polymarket-odds.json', JSON.stringify(oldOdds))

  let providerCalls = 0
  const worker = createLiveDataWorker({
    now: () => NOW,
    fetchImpl: async (url) => {
      providerCalls += 1
      if (String(url).includes('football-data.org')) {
        return response({ matches: [{ id: 2, status: 'IN_PLAY', utcDate: '2026-07-10T11:00:00Z', homeTeam: { name: 'Fresh' }, awayTeam: { name: 'Match' } }] })
      }
      return response({ markets: [] })
    }
  })
  const env = { FOOTBALL_DATA_KEY: 'secret-never-public', LIVE_DATA: kv, PUBLIC_CORS_ORIGINS: '*', MAX_STALE_SECONDS: '300' }

  const healed = await worker.fetch(new Request('https://relay.example/v1/live-match.json'), env, { waitUntil () {} })
  assert.equal(healed.status, 200)
  assert.equal((await healed.json()).activeMatch.id, 2)
  assert.equal(providerCalls, 1)

  const staleKv = memoryKv()
  await staleKv.put('live-match.json', JSON.stringify(old))
  await staleKv.put('polymarket-odds.json', JSON.stringify(oldOdds))
  const failing = createLiveDataWorker({
    now: () => NOW,
    fetchImpl: async () => { throw new Error('provider unavailable') }
  })
  const stale = await failing.fetch(new Request('https://relay.example/v1/live-match.json'), { ...env, LIVE_DATA: staleKv }, { waitUntil () {} })
  assert.equal(stale.status, 200)
  assert.equal((await stale.json()).activeMatch.id, 1)
  const health = await failing.fetch(new Request('https://relay.example/healthz'), { ...env, LIVE_DATA: staleKv }, { waitUntil () {} })
  assert.equal(health.status, 503)
  assert.equal((await health.json()).status, 'stale')
})
