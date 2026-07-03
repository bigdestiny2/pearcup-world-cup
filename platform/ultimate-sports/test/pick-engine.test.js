'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { pick, platform } = require('../src')

function setupPickApp () {
  const app = platform.createUltimateSportsPlatform({ peerId: 'player-a' })
  app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T15:00:00.000Z',
    payload: {
      competitionId: 'pick-cup',
      title: 'Pick Cup',
      templateConfig: {
        kind: 'single-elimination',
        sportOrCategory: 'soccer',
        entrantShape: 'team',
        supportedPoolVariants: ['classic-bracket', 'confidence', 'survivor']
      },
      entrants: [
        { entrantId: 'red', name: 'Red FC', seed: 1 },
        { entrantId: 'blue', name: 'Blue FC', seed: 2 },
        { entrantId: 'gold', name: 'Gold FC', seed: 3 },
        { entrantId: 'green', name: 'Green FC', seed: 4 }
      ]
    }
  })
  ;[
    ['classic-pool', 'classic-bracket', 'Classic bracket'],
    ['confidence-pool', 'confidence', 'Confidence card'],
    ['survivor-pool', 'survivor', 'Survivor picks']
  ].forEach(([poolId, variant, title]) => {
    app.dispatch({
      type: 'pool:create',
      actorId: 'host',
      occurredAt: '2026-07-03T15:01:00.000Z',
      payload: {
        poolId,
        competitionId: 'pick-cup',
        title,
        variant,
        mode: 'demo'
      }
    })
  })
  app.dispatch({
    type: 'card:create',
    actorId: 'host',
    occurredAt: '2026-07-03T15:02:00.000Z',
    payload: {
      cardId: 'bingo-card',
      competitionId: 'pick-cup',
      cardType: 'watch-party-bingo',
      title: 'Watch bingo',
      fields: [
        { fieldId: 'goal', label: 'Goal', fieldType: 'bingo-cell', options: ['yes', 'no'] },
        { fieldId: 'card', label: 'Card', fieldType: 'bingo-cell', options: ['yes', 'no'] }
      ]
    }
  })
  app.dispatch({
    type: 'draft:create',
    actorId: 'host',
    occurredAt: '2026-07-03T15:03:00.000Z',
    payload: {
      slateId: 'mini-draft',
      competitionId: 'pick-cup',
      title: 'Mini fantasy',
      rosterSize: 2,
      athletes: [
        { athleteId: 'red-9', name: 'Red 9' },
        { athleteId: 'blue-10', name: 'Blue 10' },
        { athleteId: 'gold-1', name: 'Gold 1' }
      ],
      scoringRules: { goals: 5, assists: 3 }
    }
  })
  return app
}

test('pick workbench exposes participant builders and command drafts', () => {
  const app = setupPickApp()
  const initial = app.createPickWorkbench({
    userId: 'player-a',
    poolId: 'classic-pool'
  })

  assert.equal(initial.counts.openPools, 3)
  assert.equal(initial.selectedPoolBuilder.poolId, 'classic-pool')
  assert.equal(initial.selectedPoolBuilder.entryType, 'bracket')
  assert.equal(initial.selectedPoolBuilder.bracket.rounds.length, 2)
  assert.equal(initial.selectedPoolBuilder.lockReady, false)
  assert.match(initial.selectedPoolBuilder.validation.errors[0], /pick-cup:r1:m1/)
  assert.equal(initial.cardBuilders[0].submitReady, false)
  assert.equal(initial.draftBuilders[0].submitReady, false)
  assert.equal(initial.selectedPoolBuilder.commandDrafts.submit.type, 'prediction:submit')

  app.dispatch({
    type: 'prediction:submit',
    actorId: 'player-a',
    occurredAt: '2026-07-03T15:05:00.000Z',
    payload: {
      poolId: 'classic-pool',
      userId: 'player-a',
      entryType: 'bracket',
      picks: {
        'pick-cup:r1:m1': 'red',
        'pick-cup:r1:m2': 'gold',
        'pick-cup:r2:m1': 'red'
      }
    }
  })

  const submitted = app.createPickWorkbench({
    userId: 'player-a',
    poolId: 'classic-pool'
  })
  app.dispatch(submitted.selectedPoolBuilder.commandDrafts.lock)
  const locked = app.createPickWorkbench({
    userId: 'player-a',
    poolId: 'classic-pool'
  })

  assert.equal(submitted.selectedPoolBuilder.validation.ok, true)
  assert.equal(submitted.selectedPoolBuilder.lockReady, true)
  assert.equal(locked.selectedPoolBuilder.currentEntry.status, 'locked')
  assert.equal(locked.selectedPoolBuilder.lockReady, false)
  assert.equal(app.createSurface('picks', { userId: 'player-a' }).workbench.selectedPoolId, 'classic-pool')
})

test('pick workbench validates confidence, survivor, card, and fantasy-lite draft flows', () => {
  const app = setupPickApp()

  app.dispatch({
    type: 'prediction:submit',
    actorId: 'player-a',
    occurredAt: '2026-07-03T15:06:00.000Z',
    payload: {
      poolId: 'confidence-pool',
      userId: 'player-a',
      entryType: 'card',
      picks: [
        { pickId: 'pick-cup:r1:m1', fixtureId: 'pick-cup:r1:m1', outcome: 'red', confidence: 3 },
        { pickId: 'pick-cup:r1:m2', fixtureId: 'pick-cup:r1:m2', outcome: 'gold', confidence: 2 },
        { pickId: 'pick-cup:r2:m1', fixtureId: 'pick-cup:r2:m1', outcome: 'red', confidence: 1 }
      ]
    }
  })
  app.dispatch({
    type: 'prediction:submit',
    actorId: 'player-a',
    occurredAt: '2026-07-03T15:07:00.000Z',
    payload: {
      poolId: 'survivor-pool',
      userId: 'player-a',
      entryType: 'survivor',
      picks: [
        { roundNumber: 1, fixtureId: 'pick-cup:r1:m1', entrantId: 'red' },
        { roundNumber: 1, fixtureId: 'pick-cup:r1:m2', entrantId: 'gold' }
      ]
    }
  })
  app.dispatch({
    type: 'card:submit',
    actorId: 'player-a',
    occurredAt: '2026-07-03T15:08:00.000Z',
    payload: {
      cardId: 'bingo-card',
      userId: 'player-a',
      answers: {
        goal: 'yes',
        card: 'no'
      }
    }
  })
  app.dispatch({
    type: 'draft:submit',
    actorId: 'player-a',
    occurredAt: '2026-07-03T15:09:00.000Z',
    payload: {
      slateId: 'mini-draft',
      userId: 'player-a',
      athleteIds: ['red-9', 'blue-10']
    }
  })

  const confidence = app.createPickWorkbench({ userId: 'player-a', poolId: 'confidence-pool' })
  const survivor = app.createPickWorkbench({ userId: 'player-a', poolId: 'survivor-pool' })
  const duplicateSurvivor = pick.validateSurvivorPoolPicks({
    competition: app.view().competitions['pick-cup'],
    picks: [
      { fixtureId: 'pick-cup:r1:m1', entrantId: 'red' },
      { fixtureId: 'pick-cup:r1:m2', entrantId: 'red' }
    ]
  })

  assert.equal(confidence.selectedPoolBuilder.confidence.rows.length, 3)
  assert.equal(confidence.selectedPoolBuilder.validation.ok, true)
  assert.equal(confidence.selectedPoolBuilder.lockReady, true)
  assert.equal(survivor.selectedPoolBuilder.survivor.usedEntrantIds.length, 2)
  assert.equal(survivor.selectedPoolBuilder.validation.ok, true)
  assert.equal(duplicateSurvivor.ok, false)
  assert.match(duplicateSurvivor.errors[0], /red is repeated/)
  assert.equal(confidence.cardBuilders[0].submitReady, true)
  assert.equal(confidence.cardBuilders[0].fields[0].answer, 'yes')
  assert.equal(confidence.draftBuilders[0].submitReady, true)
  assert.deepEqual(confidence.draftBuilders[0].selectedAthleteIds, ['red-9', 'blue-10'])
  assert.equal(confidence.draftBuilders[0].commandDraft.type, 'draft:submit')
})
