const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const app = readFileSync(join(__dirname, 'app.js'), 'utf8')

test('wallet never presents a local balance mutation as a real withdrawal', () => {
  const withdrawStart = app.indexOf('function withdrawWallet ()')
  const withdrawEnd = app.indexOf('\nfunction collectPayouts', withdrawStart)
  const withdraw = app.slice(withdrawStart, withdrawEnd)

  assert.match(withdraw, /worker-backed WDK rail/)
  assert.doesNotMatch(withdraw, /state\.wallet\.balance\s*=/)
  assert.match(app, /Deposit QR unavailable/)
  assert.match(app, /id="withdrawBtn" disabled/)
})
