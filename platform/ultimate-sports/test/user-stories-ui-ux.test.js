'use strict'

const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const catalog = require('../src/catalog-engine')

const docPath = path.join(__dirname, '..', 'docs', 'user-stories-ui-ux.md')
const doc = fs.readFileSync(docPath, 'utf8')

const REQUIRED_PLAN_VARIANTS = Object.freeze([
  'classic-bracket',
  'confidence',
  'survivor',
  'upset-bounty',
  'head-to-head-duel',
  'group-stage-card',
  'fantasy-lite-draft',
  'watch-party-bingo',
  'side-quest'
])

const REQUIRED_MINI_GAMES = Object.freeze([
  'penalty-clash',
  'free-kick-duel',
  'trivia-duel',
  'next-event',
  'scoreline-lock',
  'momentum-duel',
  'player-prop-duel',
  'reaction-challenge',
  'watch-party-streak',
  'peer-mini-fantasy'
])

test('user stories and UX map includes every catalog event fit', () => {
  catalog.listEventFits().forEach(fit => {
    const section = sectionFor(`### \`${fit.fitId}\`: ${fit.title}`)
    assert.notEqual(section, null, `${fit.fitId} is missing a UX section`)
    assert.match(section, new RegExp(`Sport type: ${escapeRegExp(fit.category)}`))
    ;['User stories:', 'UI/UX:', 'Primary P2P hooks:'].forEach(label => {
      assert.equal(section.includes(label), true, `${fit.fitId} missing ${label}`)
    })
  })
})

test('user stories and UX map names every sport category represented by the catalog', () => {
  const normalizedDoc = normalize(doc)
  const categoryLabels = new Map([
    ['soccer', 'Soccer:'],
    ['basketball', 'Basketball:'],
    ['pro-sports', 'Pro sports:'],
    ['tennis', 'Tennis:'],
    ['esports', 'Esports:'],
    ['combat-sports', 'Combat sports:'],
    ['sailing', 'Sailing:'],
    ['creator', 'Creator and reality:'],
    ['awards', 'Awards:'],
    ['local', 'Local:']
  ])

  new Set(catalog.listEventFits().map(fit => fit.category)).forEach(category => {
    assert.equal(normalizedDoc.includes(normalize(categoryLabels.get(category))), true, `${category} sport adaptation missing`)
  })
})

test('user stories and UX map references every product-plan variant and mini-game', () => {
  REQUIRED_PLAN_VARIANTS.forEach(variantId => {
    assert.equal(doc.includes(`\`${variantId}\``), true, `${variantId} missing from UX map`)
  })
  REQUIRED_MINI_GAMES.forEach(gameType => {
    assert.equal(doc.includes(`\`${gameType}\``), true, `${gameType} missing from UX map`)
  })
})

function sectionFor (heading) {
  const start = doc.indexOf(heading)
  if (start === -1) return null
  const next = doc.indexOf('\n### `', start + heading.length)
  return next === -1 ? doc.slice(start) : doc.slice(start, next)
}

function normalize (value) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function escapeRegExp (value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
