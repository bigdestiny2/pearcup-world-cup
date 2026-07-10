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
