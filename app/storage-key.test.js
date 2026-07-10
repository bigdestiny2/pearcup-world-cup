'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const appSource = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8')
const htmlSource = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')

test('production state key migrates the old prototype key without writing it again', () => {
  for (const source of [appSource, htmlSource]) {
    assert.match(source, /pearcup-state-v2/)
    assert.match(source, /pearcup-prototype/)
    assert.match(source, /removeItem\((?:LEGACY_STORAGE_KEY|legacyStorageKey)\)/)
    assert.doesNotMatch(source, /setItem\(['"]pearcup-prototype['"]/)
  }
})
