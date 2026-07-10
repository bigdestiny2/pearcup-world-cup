import assert from 'node:assert/strict'
import test from 'node:test'
import { createLiveDataRelay, fetchFootballSnapshot, relayConfig } from './live-data-relay.mjs'

const SECRET = 'not-for-public-output'
const NOW = new Date('2026-07-10T12:00:00.000Z')

function response (value, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => value }
}

function quietLog () {
  return { info () {}, warn () {} }
}

test('football snapshots select the live match and never include the provider key', async () => {
  const snapshot = await fetchFootballSnapshot({
    footballDataKey: SECRET,
    now: () => NOW,
    fetchImpl: async () => response({
      matches: [
        { id: 2, status: 'TIMED', utcDate: '2026-07-11T15:00:00Z' },
        { id: 1, status: 'IN_PLAY', utcDate: '2026-07-10T11:00:00Z' }
      ]
    })
  })
  assert.equal(snapshot.activeMatch.id, 1)
  assert.equal(snapshot.generatedAt, NOW.toISOString())
  assert.equal(JSON.stringify(snapshot).includes(SECRET), false)
})

test('the public relay serves cacheable snapshots, odds, health, and CORS without leaking credentials', async (t) => {
  const config = relayConfig({
    FOOTBALL_DATA_KEY: SECRET,
    HOST: '127.0.0.1',
    PORT: '8787',
    PUBLIC_CORS_ORIGINS: '*',
    POLYMARKET_ENABLED: 'true'
  })
  const relay = createLiveDataRelay({
    config,
    now: () => NOW,
    log: quietLog(),
    fetchImpl: async () => response({ matches: [{
      id: 537384,
      status: 'TIMED',
      utcDate: '2026-07-10T22:00:00Z',
      homeTeam: { shortName: 'Spain' },
      awayTeam: { shortName: 'Belgium' },
      score: { fullTime: { home: null, away: null } }
    }] }),
    createOddsSnapshot: async () => ({
      schema: 'pearcup-polymarket-v2', provider: 'Polymarket', status: 'ok', generatedAt: NOW.toISOString(),
      matches: {
        537384: {
          schema: 'pearcup-polymarket-v1', provider: 'Polymarket', status: 'ok', fetchedAt: NOW.toISOString(),
          match: { id: 537384, home: 'Spain', away: 'Belgium' }, odds: []
        }
      }
    })
  })
  t.after(() => relay.close())
  await relay.refresh()
  await new Promise(resolveListen => relay.server.listen(0, '127.0.0.1', resolveListen))
  const { port } = relay.server.address()

  const live = await fetch(`http://127.0.0.1:${port}/v1/live-match.json`, { headers: { Origin: 'pear://pearcup' } })
  const liveBody = await live.text()
  assert.equal(live.status, 200)
  assert.equal(live.headers.get('access-control-allow-origin'), '*')
  assert.match(live.headers.get('cache-control'), /stale-while-revalidate/)
  assert.equal(liveBody.includes(SECRET), false)
  assert.equal(JSON.parse(liveBody).activeMatch.id, 537384)

  const health = await fetch(`http://127.0.0.1:${port}/healthz`)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).status, 'ready')
  const odds = await fetch(`http://127.0.0.1:${port}/v1/polymarket-odds.json`)
  assert.equal(odds.status, 200)
  assert.equal((await odds.json()).schema, 'pearcup-polymarket-v2')
  const selectedOdds = await fetch(`http://127.0.0.1:${port}/v1/polymarket-odds.json?matchId=537384`)
  assert.equal(selectedOdds.status, 200)
  assert.equal((await selectedOdds.json()).match.id, 537384)
  const missingOdds = await fetch(`http://127.0.0.1:${port}/v1/polymarket-odds.json?matchId=missing`)
  assert.equal(missingOdds.status, 404)
})

test('relay config requires a deployment secret and clamps unsafe refresh intervals', () => {
  assert.throws(() => relayConfig({}), /FOOTBALL_DATA_KEY/)
  const config = relayConfig({ FOOTBALL_DATA_KEY: 'key', REFRESH_SECONDS: '1', MAX_STALE_SECONDS: '999999' })
  assert.equal(config.refreshMs, 15_000)
  assert.equal(config.maxStaleMs, 86_400_000)
})
