const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const { join } = require('node:path')
const test = require('node:test')

let oddsModulePromise
function oddsModule () {
  if (!oddsModulePromise) oddsModulePromise = import(pathToFileURL(join(__dirname, 'fetch-polymarket-odds.mjs')).href)
  return oddsModulePromise
}

test('Polymarket relay selects the direct active match market and preserves outcome mapping', async () => {
  const { selectMatchMarket, buildOddsSnapshot } = await oddsModule()
  const match = { id: 'fixture-9', home: 'Spain', away: 'Belgium' }
  const markets = [
    {
      id: 'one-sided',
      active: true,
      closed: false,
      question: 'Will Spain win the World Cup?',
      outcomes: JSON.stringify(['Yes', 'No']),
      outcomePrices: JSON.stringify(['0.15', '0.85'])
    },
    {
      id: 'match-winner',
      active: true,
      closed: false,
      question: 'Spain vs Belgium: who wins?',
      outcomes: JSON.stringify(['Spain', 'Belgium', 'Draw']),
      outcomePrices: JSON.stringify(['0.51', '0.28', '0.21']),
      clobTokenIds: JSON.stringify(['token-spain', 'token-belgium', 'token-draw']),
      slug: 'spain-vs-belgium'
    }
  ]

  const market = selectMatchMarket(markets, match)
  assert.equal(market.id, 'match-winner')
  const snapshot = buildOddsSnapshot({
    match,
    market,
    midpointMap: { 'token-spain': '0.54', 'token-belgium': '0.26' },
    fetchedAt: '2026-07-09T10:00:00.000Z'
  })

  assert.equal(snapshot.status, 'ok')
  assert.equal(snapshot.market.url, 'https://polymarket.com/event/spain-vs-belgium')
  assert.deepEqual(snapshot.odds.map(odd => [odd.outcome, odd.probability, odd.source]), [
    ['Spain', 0.54, 'clob-midpoint'],
    ['Belgium', 0.26, 'clob-midpoint'],
    ['Draw', 0.21, 'gamma']
  ])
})

test('Polymarket relay reports unavailable rather than inventing odds for an unmatched fixture', async () => {
  const { selectMatchMarket, buildOddsSnapshot } = await oddsModule()
  const match = { id: 'fixture-10', home: 'France', away: 'Morocco' }
  const market = selectMatchMarket([{
    active: true,
    closed: false,
    question: 'Will France win the World Cup?',
    outcomes: JSON.stringify(['Yes', 'No'])
  }], match)

  assert.equal(market, null)
  const snapshot = buildOddsSnapshot({ match, market, fetchedAt: '2026-07-09T10:00:00.000Z' })
  assert.equal(snapshot.status, 'unavailable')
  assert.match(snapshot.reason, /No active Polymarket match market/)
})

test('Polymarket fixture registry indexes switchable official fixtures and retains last known good odds', async () => {
  const { fixtureMatchesFromSnapshot, mergeLastKnownGoodOdds } = await oddsModule()
  const fixtures = fixtureMatchesFromSnapshot({
    activeMatch: { id: 1, status: 'TIMED', utcDate: '2026-07-10T19:00:00Z', homeTeam: { name: 'Spain' }, awayTeam: { name: 'Belgium' } },
    matches: [
      { id: 2, status: 'IN_PLAY', utcDate: '2026-07-10T17:00:00Z', homeTeam: { name: 'Norway' }, awayTeam: { name: 'England' } },
      { id: 1, status: 'TIMED', utcDate: '2026-07-10T19:00:00Z', homeTeam: { name: 'Spain' }, awayTeam: { name: 'Belgium' } },
      { id: 3, status: 'TIMED', utcDate: '2026-07-11T21:00:00Z', homeTeam: { name: 'Argentina' }, awayTeam: { name: 'Switzerland' } },
      { id: 0, status: 'TIMED', utcDate: '2026-07-09T21:00:00Z', homeTeam: { name: 'Mexico' }, awayTeam: { name: 'Canada' } },
      { id: 4, status: 'TIMED', utcDate: '2026-07-12T21:00:00Z', homeTeam: { name: 'France' }, awayTeam: { name: '' } }
    ]
  })
  assert.deepEqual(fixtures.map(match => match.id), [1, 2, 3])

  const previous = {
    schema: 'pearcup-polymarket-v2', provider: 'Polymarket', generatedAt: '2026-07-10T10:00:00.000Z', status: 'ok',
    matches: { 1: { schema: 'pearcup-polymarket-v1', status: 'ok', fetchedAt: '2026-07-10T10:00:00.000Z', match: { id: 1 }, odds: [{ outcome: 'Spain', probability: 0.5 }, { outcome: 'Belgium', probability: 0.3 }] } }
  }
  const next = {
    schema: 'pearcup-polymarket-v2', provider: 'Polymarket', generatedAt: '2026-07-10T10:00:30.000Z', status: 'unavailable',
    matches: { 1: { schema: 'pearcup-polymarket-v1', status: 'unavailable', fetchedAt: '2026-07-10T10:00:30.000Z', match: { id: 1 }, reason: 'provider timeout' } }
  }
  const merged = mergeLastKnownGoodOdds(previous, next)
  assert.equal(merged.matches[1].status, 'ok')
  assert.equal(merged.matches[1].fetchedAt, '2026-07-10T10:00:00.000Z')
})
