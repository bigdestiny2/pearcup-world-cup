'use strict'

const { createCompetitionTemplate, normalizeEntrants } = require('./competition-engine')
const { createHostResultCorrection } = require('./feed-engine')
const { assertNonEmptyString, cloneJson, stableId } = require('./util')

function createCreatorCompetitionDraft (input = {}) {
  assertNonEmptyString(input.title, 'title')
  assertNonEmptyString(input.organizerId, 'organizerId')

  const template = createCompetitionTemplate({
    kind: input.kind || 'creator-custom',
    sportOrCategory: input.sportOrCategory || 'creator',
    entrantShape: input.entrantShape || 'custom',
    resultPolicy: input.resultPolicy || 'host-entered',
    supportsOfficialFeed: false,
    supportedPoolVariants: input.supportedPoolVariants
  })

  return {
    draftId: input.draftId || stableId(`creator-draft-${input.title}`, {
      title: input.title,
      organizerId: input.organizerId
    }),
    title: input.title,
    organizerId: input.organizerId,
    template,
    entrants: normalizeEntrants(input.entrants || [], template.entrantShape),
    fixtures: cloneJson(input.fixtures || []),
    status: 'draft'
  }
}

function publishCreatorCompetition (draft, publishedAt = new Date().toISOString()) {
  if (!draft || typeof draft !== 'object') throw new TypeError('draft is required')
  return {
    ...draft,
    publishedAt,
    status: 'published'
  }
}

function createCreatorResultCorrection (input = {}) {
  return createHostResultCorrection(input)
}

module.exports = {
  createCreatorCompetitionDraft,
  publishCreatorCompetition,
  createCreatorResultCorrection
}
