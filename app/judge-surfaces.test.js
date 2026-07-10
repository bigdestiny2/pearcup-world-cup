'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')
const canonicalPearLink = 'pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo'
const appHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
const siteHtml = fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8')
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')

test('judge-facing surfaces use the canonical product name and Pear link', () => {
  assert.match(appHtml, /<title>PearCup<\/title>/)
  assert.doesNotMatch(appHtml, /PearCup Prototype/)
  assert.doesNotMatch(siteHtml, /pear:\/\/pearcup-kawaii/)
  assert.doesNotMatch(siteHtml, /550\+ tests/)
  assert.ok(siteHtml.includes(canonicalPearLink))
  assert.ok(readme.includes(canonicalPearLink))
})

test('README judge assets and declared MIT license exist', () => {
  assert.ok(fs.existsSync(path.join(root, 'site', 'assets', 'shots', 'current-home.jpg')))
  assert.ok(fs.existsSync(path.join(root, 'site', 'assets', 'demo.mp4')))
  assert.match(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'), /^MIT License/)
})
