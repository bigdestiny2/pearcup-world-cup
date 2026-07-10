const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = __dirname
const html = readFileSync(join(root, 'index.html'), 'utf8')
const app = readFileSync(join(root, 'app.js'), 'utf8')

test('Polymarket odds are rendered from one relay snapshot on Home and Watch Party', () => {
  assert.match(html, /id="polymarketOddsPanel"/)
  assert.match(html, /id="watchPolymarketOddsPanel"/)
  assert.match(app, /function polymarketOddsPanels \(\)/)
  assert.match(app, /\$\('#polymarketOddsPanel'\), \$\('#watchPolymarketOddsPanel'\)/)
  assert.match(app, /renderPolymarketOdds\(\)\n  renderWatchStats/)
  assert.match(app, /Informational only · no wallet or trading connection/)
})
