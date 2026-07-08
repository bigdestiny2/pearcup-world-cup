'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { boxingData, scoring, sportsDataProviders } = require('../src')

const roster = [
  { id: 'silva', name: 'M. Holloway' },
  { id: 'jones', name: 'C. McGregor' }
]

function sampleCard () {
  return {
    event: 'Holloway vs McGregor',
    date: '2026-07-08',
    venue: 'T-Mobile Arena',
    bouts: [
      {
        id: 'r32-1',
        rounds: 5,
        weightClass: 'Featherweight',
        fighterA: { name: 'M. Holloway', record: { wins: 26, losses: 8, draws: 0, kos: 12 }, punchStats: { thrown: 640, landed: 210, accuracy: 33 } },
        fighterB: { name: 'C. McGregor', record: '22-6-0', punchStats: { thrown: 410, landed: 150, accuracy: 37 } },
        result: { winner: 'M. Holloway', method: 'KO', round: 3 }
      },
      {
        id: 'r32-2',
        fighterA: { name: 'A. Nunes' },
        fighterB: { name: 'V. Shevchenko' },
        result: { winner: 'B', method: 'UD', round: null }
      },
      {
        id: 'r32-3',
        fighterA: { name: 'X One' },
        fighterB: { name: 'Y Two' }
      }
    ]
  }
}

test('normalizeBoxingCard maps bouts, aligns roster ids, and maps result vocabulary', () => {
  const card = boxingData.normalizeBoxingCard(sampleCard(), { roster })
  assert.equal(card.event, 'Holloway vs McGregor')
  assert.equal(card.bouts.length, 3)

  const main = card.bouts[0]
  assert.deepEqual(main.slots, ['silva', 'jones'])
  assert.equal(main.billing, 'Main event')
  assert.deepEqual(main.result, { winnerEntrantId: 'silva', method: 'KO/TKO', round: 'Round 3', time: null, final: true })

  const co = card.bouts[1]
  // winner 'B' -> blue corner; UD -> Decision; decision round collapses to 'Decision'
  assert.equal(co.result.winnerEntrantId, co.slots[1])
  assert.equal(co.result.method, 'Decision')
  assert.equal(co.result.round, 'Decision')

  // no result payload -> not settled
  assert.equal(card.bouts[2].result, null)
})

test('method and round mapping covers the fit vocabulary', () => {
  assert.equal(boxingData.mapMethod('TKO'), 'KO/TKO')
  assert.equal(boxingData.mapMethod('submission'), 'Submission')
  assert.equal(boxingData.mapMethod('Split Decision'), 'Decision')
  assert.equal(boxingData.mapMethod('DQ'), 'Draw/No Contest')
  assert.equal(boxingData.mapMethod('mystery'), null)
  assert.equal(boxingData.mapRound(7, 'KO/TKO'), 'Round 7')
  assert.equal(boxingData.mapRound(3, 'Decision'), 'Decision')
  assert.equal(boxingData.mapRound(null, 'Decision'), 'Decision')
  assert.equal(boxingData.mapRound(99, 'KO/TKO'), null)
})

test('toResultSnapshot settles picks through scorePlayerPropEntry', () => {
  const card = boxingData.normalizeBoxingCard(sampleCard(), { roster })
  const snapshot = boxingData.toResultSnapshot(card)

  // only finished bouts appear
  assert.deepEqual(Object.keys(snapshot.results).sort(), ['r32-1', 'r32-2'])
  assert.deepEqual(snapshot.results['r32-1'], { winnerEntrantId: 'silva', method: 'KO/TKO', round: 'Round 3' })

  const perfect = scoring.scorePlayerPropEntry({
    entry: { entryId: 'e1', userId: 'u1', picks: { 'r32-1': 'silva', 'r32-1-method': 'KO/TKO', 'r32-1-round': 'Round 3' } },
    resultSnapshot: snapshot
  })
  // winner + method + round on the main bout
  assert.equal(perfect.score, 3)

  const wrongMethod = scoring.scorePlayerPropEntry({
    entry: { entryId: 'e2', userId: 'u2', picks: { 'r32-1': 'silva', 'r32-1-method': 'Submission', 'r32-1-round': 'Round 3' } },
    resultSnapshot: snapshot
  })
  // winner + round correct, method wrong
  assert.equal(wrongMethod.score, 2)
})

test('overlayFitConfig enriches records + matchStats without mutating the fit', () => {
  const fit = {
    arcade: { red: { id: 'silva', record: '0–0–0' }, blue: { id: 'jones', record: '0–0–0' } },
    teams: [{ id: 'silva', name: 'Holloway' }, { id: 'jones', name: 'McGregor' }],
    matchStats: [['Placeholder', '1', '1', 50]]
  }
  const card = boxingData.normalizeBoxingCard(sampleCard(), { roster })
  const next = boxingData.overlayFitConfig(fit, card)

  assert.equal(next.arcade.red.record, '26–8–0 (12 KO)')
  assert.equal(next.arcade.blue.record, '22–6–0')
  assert.equal(next.teams[0].record, '26–8–0 (12 KO)')
  assert.equal(next.matchStats[0][0], 'Punches landed')
  assert.deepEqual(next.matchStats[0].slice(1, 3), ['210', '150'])

  // original fit is untouched
  assert.equal(fit.arcade.red.record, '0–0–0')
  assert.equal(fit.matchStats[0][0], 'Placeholder')
})

test('fetchBoxingCard returns live data on success and caches it', async () => {
  const cache = boxingData.createMemoryCache()
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => sampleCard() })
  const config = { enabled: true, eventId: 'evt1', roster, curatedCard: sampleCard() }

  const live = await boxingData.fetchBoxingCard({ config, fetchImpl, cache, now: 1000 })
  assert.equal(live.source, 'api')
  assert.equal(live.stale, false)
  assert.equal(live.card.event, 'Holloway vs McGregor')
  assert.ok(cache.get(`${boxingData.BOXING_DATA_BASE_URL}::evt1`))
})

test('fetchBoxingCard falls back to cache on 503, then curated, and never throws', async () => {
  const cache = boxingData.createMemoryCache()
  const config = { enabled: true, eventId: 'evt1', roster, curatedCard: sampleCard() }

  // prime the cache with one good fetch
  await boxingData.fetchBoxingCard({ config, fetchImpl: async () => ({ ok: true, status: 200, json: async () => sampleCard() }), cache, now: 1 })

  // dyno asleep -> 503 -> serve the cached card, marked stale
  const cached = await boxingData.fetchBoxingCard({ config, fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }), cache, now: 2 })
  assert.equal(cached.source, 'cache')
  assert.equal(cached.stale, true)
  assert.equal(cached.reason, 'status-503')
  assert.ok(cached.card)

  // no cache + thrown error -> curated fallback, still no throw
  const curated = await boxingData.fetchBoxingCard({
    config: { enabled: true, eventId: 'other', roster, curatedCard: sampleCard() },
    fetchImpl: async () => { throw new Error('network down') },
    cache: boxingData.createMemoryCache(),
    now: 3
  })
  assert.equal(curated.source, 'curated')
  assert.equal(curated.stale, true)
  assert.ok(curated.card)
})

test('fetchBoxingCard honours the disabled flag and same-origin proxy url', async () => {
  const off = await boxingData.fetchBoxingCard({ config: { enabled: false, curatedCard: sampleCard() } })
  assert.equal(off.source, 'curated')

  assert.equal(boxingData.buildRequestUrl({ proxy: '/api/boxing-feed' }), '/api/boxing-feed')
  assert.equal(boxingData.buildRequestUrl({ baseUrl: 'https://x.test', eventId: 'e 1' }), 'https://x.test/events/e%201')
})

test('boxingdata registers as a supplement provider for the fight card', () => {
  const plan = sportsDataProviders.providerPlanForFit('mma-boxing-fight-card')
  assert.equal(plan.primaryProviderId, 'sportsdataio')
  assert.equal(plan.providerIds.includes('boxingdata'), true)
  assert.equal(sportsDataProviders.PROVIDERS.boxingData.recommendation, 'supplement')
})
