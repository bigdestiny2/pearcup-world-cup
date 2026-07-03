'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { competition, creator } = require('../src')

test('single-elimination template creates deterministic fixtures without touching the app', () => {
  const template = competition.createCompetitionTemplate({
    kind: 'single-elimination',
    sportOrCategory: 'soccer',
    entrantShape: 'team'
  })

  const cup = competition.createCompetition({
    title: 'Champions Knockout Demo',
    template,
    entrants: ['Alpha FC', 'Bravo FC', 'Cairo FC', 'Delta FC', 'Essex FC', 'Fuji FC', 'Ghana FC', 'Havana FC']
  })

  assert.equal(cup.template.kind, 'single-elimination')
  assert.equal(cup.entrants.length, 8)
  assert.equal(cup.fixtures.length, 7)
  assert.equal(cup.fixtures[0].roundName, 'Quarterfinals')
  assert.equal(cup.fixtures[4].roundName, 'Semifinals')
  assert.equal(cup.fixtures[6].roundName, 'Final')
  assert.deepEqual(cup.fixtures[0].sourceSlots.map(slot => slot.type), ['entrant', 'entrant'])
  assert.deepEqual(cup.fixtures[4].sourceSlots.map(slot => slot.type), ['winner', 'winner'])
})

test('creator drafts default to host-entered custom events', () => {
  const draft = creator.createCreatorCompetitionDraft({
    title: 'Office Chili Bracket',
    organizerId: 'host-1',
    entrants: ['Smoky Bean', 'Fire Bowl']
  })

  assert.equal(draft.status, 'draft')
  assert.equal(draft.template.kind, 'creator-custom')
  assert.equal(draft.template.resultPolicy, 'host-entered')
  assert.equal(draft.template.supportsOfficialFeed, false)
})

