const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

const appSource = readFileSync(join(__dirname, 'app.js'), 'utf8')
const peerMatchSource = readFileSync(join(__dirname, 'peer-match.js'), 'utf8')
const htmlSource = readFileSync(join(__dirname, 'index.html'), 'utf8')

function sourceBetween (startMarker, endMarker) {
  const start = appSource.indexOf(startMarker)
  const end = appSource.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(start, -1, `missing ${startMarker}`)
  assert.notEqual(end, -1, `missing ${endMarker}`)
  return appSource.slice(start, end)
}

const runtimeRelaySource = sourceBetween('function runtimeLiveDataRelay', 'const productionLiveData')
const detectRelaySource = sourceBetween('async function detectLiveRelay', 'function startLiveFeed')

test('only HTTPS or loopback live relay URLs can reach the renderer', () => {
  const context = {
    URL,
    Number,
    window: {
      PearCupRuntimeSettingsValue: {
        liveData: { relayUrl: 'https://data.example.test/v1/live-match.json', pollMs: 20_000 }
      }
    }
  }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(runtimeRelaySource, context)
  assert.deepEqual({ ...context.runtimeLiveDataRelay() }, {
    relayUrl: 'https://data.example.test/v1/live-match.json',
    oddsRelayUrl: 'https://data.example.test/v1/polymarket-odds.json',
    pollMs: 20_000
  })

  context.window.PearCupRuntimeSettingsValue.liveData.relayUrl = 'http://data.example.test/v1/live-match.json'
  assert.equal(context.runtimeLiveDataRelay(), null)
})

test('production relay selection overrides any locally saved provider key', async () => {
  const calls = { fetch: [], start: 0, render: 0 }
  const context = {
    Date,
    state: { liveConfig: { enabled: true, apiKey: 'must-not-be-used', proxy: 'https://wrong.example/live-match.json' } },
    productionLiveData: { relayUrl: 'https://data.example.test/v1/live-match.json', pollMs: 30_000 },
    RELAY_FILE: 'live-match.json',
    withRelayCacheBust: value => value,
    fetch: async url => {
      calls.fetch.push(url)
      return {
        ok: true,
        json: async () => ({
          schema: 'pearcup-live-v2',
          generatedAt: new Date().toISOString(),
          activeMatch: { id: 537384, status: 'TIMED', utcDate: '2026-07-10T22:00:00Z' },
          matches: []
        })
      }
    },
    startLiveFeed: () => { calls.start += 1 },
    setBracketFixturesFromSnapshot: () => true,
    renderBracket: () => {},
    document: { querySelector: () => null }
  }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(detectRelaySource, context)
  await context.detectLiveRelay()

  assert.deepEqual(calls.fetch, ['https://data.example.test/v1/live-match.json'])
  assert.equal(calls.start, 1)
  assert.equal(context.state.liveConfig.apiKey, '')
  assert.equal(context.state.liveConfig.proxy, 'https://data.example.test/v1/live-match.json')
  assert.equal(context.state.liveConfig.pollSec, 30)
})

test('a stale bundled fixture remains truthful schedule data instead of falling back to fake pitch data', async () => {
  const calls = { start: 0 }
  const context = {
    Date,
    state: { liveConfig: { enabled: false, apiKey: '', proxy: '' } },
    productionLiveData: null,
    RELAY_FILE: 'live-match.json',
    withRelayCacheBust: value => value,
    fetch: async () => ({
      ok: true,
      json: async () => ({
        schema: 'pearcup-live-v2',
        generatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        activeMatch: { id: 537384, status: 'TIMED', utcDate: '2026-07-10T22:00:00Z' },
        matches: []
      })
    }),
    startLiveFeed: () => { calls.start += 1 },
    setBracketFixturesFromSnapshot: () => true,
    renderBracket: () => {},
    document: { querySelector: () => null }
  }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(detectRelaySource, context)
  await context.detectLiveRelay()

  assert.equal(calls.start, 1)
  assert.equal(context.state.liveConfig.enabled, true)
  assert.equal(context.state.liveConfig.proxy, 'live-match.json')
  assert.equal(context.state.liveConfig.relayFresh, false)
})

test('watch UI uses the responsive data centre, team-matched Higgsfield portraits, and QVAC-powered product wording', () => {
  assert.doesNotMatch(htmlSource, /class="pitch"/)
  assert.match(htmlSource, /class="tv-liveboard is-loading"/)
  assert.match(htmlSource, /id="watchQvacAnalysis"/)
  assert.match(htmlSource, /QVAC expert football analysis/)
  assert.match(appSource, /const TEAM_AVATAR_PORTRAITS = \{/)
  assert.match(appSource, /br: 'p-rafa', jp: 'p-omar'/)
  assert.match(appSource, /<img src="\.\/\$\{escapeHtml\(portrait\)\}"/)
  assert.match(appSource, /QVAC-powered trivia/)
  assert.match(appSource, /function queueQvacCommentary/)
  assert.match(appSource, /qvacCommentaryByEvent/)
  assert.match(appSource, /function queueQvacExpertAnalysis/)
  assert.match(appSource, /Chronological progression matrix/)
  assert.match(appSource, /PEARCUP_EXTERNAL_PEER_TEST_ROLE/)
  assert.match(peerMatchSource, /PEARCUP_EXTERNAL_PEER_TEST_AUTOPLAY/)
  assert.doesNotMatch(appSource, /Start QVAC round|Next QVAC round|QVAC watch trivia/)
})

test('football relay fixtures are mapped into live bracket matches', () => {
  const teamsSource = sourceBetween('const teams = [', '// Runtime modules attach')
  const helpersSource = sourceBetween('function makeMatch', '// Rolling round-by-round pools')
  const context = { Date, Number, Set, JSON }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(teamsSource + helpersSource, context)

  const match = context.providerBracketMatch({
    id: 537384,
    utcDate: '2026-07-10T19:00:00Z',
    status: 'FINISHED',
    stage: 'QUARTER_FINALS',
    homeTeam: { name: 'Spain', tla: 'ESP' },
    awayTeam: { name: 'Belgium', tla: 'BEL' },
    score: { winner: 'AWAY_TEAM', duration: 'REGULAR', fullTime: { home: 1, away: 2 } }
  }, 'qf-2')

  assert.equal(match.id, 'qf-2')
  assert.deepEqual([...match.slots], ['es', 'be'])
  assert.deepEqual([...match.score], [1, 2])
  assert.equal(match.status, 'FT')
  assert.equal(match.winner, 'be')
})

test('relay polling refreshes the visible bracket when fixture data changes', async () => {
  const calls = { bracketSnapshot: 0, bracketRender: 0 }
  const context = {
    Date,
    state: { liveConfig: {} },
    productionLiveData: { relayUrl: 'https://data.example.test/v1/live-match.json', pollMs: 30_000 },
    RELAY_FILE: 'live-match.json',
    withRelayCacheBust: value => value,
    fetch: async () => ({
      ok: true,
      json: async () => ({
        schema: 'pearcup-live-v2',
        generatedAt: new Date().toISOString(),
        activeMatch: { id: 1, status: 'FINISHED' },
        matches: [{ id: 1, stage: 'QUARTER_FINALS', status: 'FINISHED' }]
      })
    }),
    setBracketFixturesFromSnapshot: () => { calls.bracketSnapshot += 1; return true },
    startLiveFeed: () => {},
    renderBracket: () => { calls.bracketRender += 1 },
    renderWatch: () => {},
    document: { querySelector: selector => selector === '#bracket' ? { classList: { contains: () => true } } : null }
  }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(detectRelaySource, context)
  await context.detectLiveRelay()

  assert.equal(calls.bracketSnapshot, 1)
  assert.equal(calls.bracketRender, 1)
  // The first API tick must also repaint the Watch shell: its couches and
  // odds picker are derived from the same authoritative fixture as the title.
  assert.match(appSource, /if \(ev\) renderWatch\(\)/)
})

test('CSP permits the keyless HTTPS relay and approved Football-Data crests only', () => {
  assert.match(htmlSource, /connect-src 'self' https: http:\/\/127\.0\.0\.1:\* http:\/\/localhost:\* pear:/)
  assert.match(htmlSource, /img-src 'self' data: blob: https:\/\/crests\.football-data\.org/)
  assert.match(htmlSource, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/)
})
