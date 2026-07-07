'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

test('UI string table loads and supports all four languages', () => {
  delete require.cache[require.resolve('../shell/ui-strings.js')]
  global.document = undefined
  require('../shell/ui-strings.js')
  const strings = global.ULTIMATE_UI_STRINGS
  const t = global.ULTIMATE_UI_T

  assert.ok(strings)
  assert.ok(strings.EN)
  assert.ok(strings.PT)
  assert.ok(strings.ES)
  assert.ok(strings.FR)

  assert.equal(t('home', 'EN'), 'Home')
  assert.equal(t('home', 'PT'), 'Início')
  assert.equal(t('home', 'ES'), 'Inicio')
  assert.equal(t('home', 'FR'), 'Accueil')

  assert.equal(t('wallet', 'pt'), 'Carteira')
  assert.equal(t('leaderboard', 'fr'), 'Classement')
})

test('t() falls back to EN for unknown keys and languages', () => {
  delete require.cache[require.resolve('../shell/ui-strings.js')]
  global.document = undefined
  require('../shell/ui-strings.js')
  const t = global.ULTIMATE_UI_T

  assert.equal(t('unknownKey', 'DE'), 'unknownKey')
  assert.equal(t('home', 'XX'), 'Home')
})
