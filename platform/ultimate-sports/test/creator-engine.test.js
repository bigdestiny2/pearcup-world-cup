'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { creator, platform } = require('../src')

test('creator engine seeds non-power-of-two brackets with byes and publish commands', () => {
  const draft = creator.createCreatorCompetitionDraft({
    draftId: 'draft-cookoff',
    title: 'Creator Cookoff',
    organizerId: 'chef-host',
    entrantShape: 'creator',
    entrants: [
      { entrantId: 'chef-1', name: 'Chef 1', seed: 1 },
      { entrantId: 'chef-2', name: 'Chef 2', seed: 2 },
      { entrantId: 'chef-3', name: 'Chef 3', seed: 3 },
      { entrantId: 'chef-4', name: 'Chef 4', seed: 4 },
      { entrantId: 'chef-5', name: 'Chef 5', seed: 5 },
      { entrantId: 'chef-6', name: 'Chef 6', seed: 6 }
    ]
  })
  const seeded = creator.seedCreatorBracketDraft(draft, {
    competitionId: 'creator-cookoff',
    startsAt: '2026-07-03T20:00:00.000Z'
  })
  const plan = creator.createCreatorPublishPlan(seeded, {
    variantIds: ['classic-bracket', 'watch-party-bingo'],
    roomId: 'creator-cookoff-room',
    settlementMode: 'demo',
    occurredAt: '2026-07-03T20:05:00.000Z'
  })
  const resultPlan = creator.createCreatorResultPlan({
    competitionId: 'creator-cookoff',
    poolIds: plan.poolIds,
    results: {
      'creator-cookoff:r3:m1': { winnerEntrantId: 'chef-1', roundNumber: 3 }
    },
    occurredAt: '2026-07-03T23:00:00.000Z'
  })

  assert.equal(seeded.bracket.bracketSize, 8)
  assert.equal(seeded.bracket.byeCount, 2)
  assert.equal(seeded.fixtures.length, 7)
  assert.deepEqual(seeded.fixtures[0].sourceSlots.map(slot => slot.type), ['entrant', 'bye'])
  assert.equal(seeded.fixtures[0].metadata.autoAdvanceEntrantId, 'chef-1')
  assert.equal(seeded.fixtures[2].metadata.autoAdvanceEntrantId, 'chef-2')
  assert.deepEqual(plan.commands.map(command => command.type), [
    'competition:create',
    'pool:create',
    'pool:create',
    'room:create',
    'room:join',
    'competition:updateStatus'
  ])
  assert.deepEqual(plan.topics.map(topic => topic.kind), ['creator', 'competition', 'pool', 'pool', 'room'])
  assert.equal(resultPlan.snapshot.sourcePolicy, 'host-entered')
  assert.deepEqual(resultPlan.commands.map(command => command.type), ['result:record', 'pool:resolve', 'pool:resolve'])
  assert.equal(resultPlan.commands[1].payload.resultSnapshotId, resultPlan.snapshot.snapshotId)
})

test('facade runs creator draft to published local pool and host result settlement', () => {
  const app = platform.createUltimateSportsPlatform({ peerId: 'organizer' })
  app.draftCreatorCompetition({
    draftId: 'draft-pub-cup',
    title: 'Friday Pub Cup',
    organizerId: 'organizer',
    entrantShape: 'team',
    entrants: [
      { entrantId: 'red', name: 'Red Pub', seed: 1 },
      { entrantId: 'blue', name: 'Blue Pub', seed: 2 }
    ],
    occurredAt: '2026-07-03T18:00:00.000Z'
  })
  app.addCreatorDraftEntrant('draft-pub-cup', { entrantId: 'gold', name: 'Gold Pub', seed: 3 })
  app.addCreatorDraftEntrant('draft-pub-cup', { entrantId: 'green', name: 'Green Pub', seed: 4 })
  app.seedCreatorDraft('draft-pub-cup', {
    competitionId: 'pub-cup',
    startsAt: '2026-07-03T19:00:00.000Z'
  })
  const publishPlanEvent = app.dispatch({
    type: 'creator:createPublishPlan',
    actorId: 'organizer',
    occurredAt: '2026-07-03T18:05:00.000Z',
    payload: {
      draftId: 'draft-pub-cup',
      competitionId: 'pub-cup',
      variantIds: ['classic-bracket'],
      roomId: 'pub-cup-room',
      settlementMode: 'demo'
    }
  })
  const creatorBeforeLaunch = app.createSurface('creator', { userId: 'organizer' })
  const workbenchBeforeLaunch = app.createCreatorWorkbench({ userId: 'organizer' })

  app.dispatchCreatorPublishPlan(publishPlanEvent.payload)
  const entry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'user-a',
    occurredAt: '2026-07-03T18:10:00.000Z',
    payload: {
      poolId: 'pub-cup:pool:classic-bracket',
      userId: 'user-a',
      entryType: 'bracket',
      picks: {
        'pub-cup:r1:m1': 'red',
        'pub-cup:r1:m2': 'blue',
        'pub-cup:r2:m1': 'red'
      }
    }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T18:11:00.000Z',
    payload: { entryId: entry.payload.entryId }
  })
  const settled = app.dispatchCreatorResultPlan({
    competitionId: 'pub-cup',
    poolIds: ['pub-cup:pool:classic-bracket'],
    hostUserId: 'organizer',
    occurredAt: '2026-07-03T21:00:00.000Z',
    results: {
      'pub-cup:r1:m1': { winnerEntrantId: 'red', roundNumber: 1 },
      'pub-cup:r1:m2': { winnerEntrantId: 'blue', roundNumber: 1 },
      'pub-cup:r2:m1': { winnerEntrantId: 'red', roundNumber: 2 }
    }
  })
  const creatorAfterLaunch = app.createSurface('creator', { userId: 'organizer' })
  const workbenchAfterLaunch = app.createCreatorWorkbench({
    userId: 'organizer',
    competitionId: 'pub-cup'
  })

  assert.equal(creatorBeforeLaunch.competitionDrafts[0].readyToPublish, true)
  assert.equal(creatorBeforeLaunch.workbench.selectedDraftId, 'draft-pub-cup')
  assert.equal(creatorBeforeLaunch.publishPlans[0].commandCount, 5)
  assert.equal(workbenchBeforeLaunch.draftEditor.controls.canSeedBracket, true)
  assert.equal(workbenchBeforeLaunch.draftEditor.controls.canPublish, true)
  assert.equal(workbenchBeforeLaunch.draftEditor.entrantRows.length, 4)
  assert.equal(workbenchBeforeLaunch.draftEditor.bracketRounds.length, 2)
  assert.equal(workbenchBeforeLaunch.publish.ready, true)
  assert.equal(workbenchBeforeLaunch.publish.previewPlan.commandCount, 8)
  assert.equal(workbenchBeforeLaunch.publish.savedPlans[0].competitionId, 'pub-cup')
  assert.equal(workbenchBeforeLaunch.publish.commandDraft.type, 'creator:createPublishPlan')
  assert.equal(app.view().competitions['pub-cup'].status, 'open')
  assert.equal(app.view().competitions['pub-cup'].fixtureIds.length, 3)
  assert.equal(app.view().rooms['pub-cup-room'].hostUserId, 'organizer')
  assert.deepEqual(app.view().poolSettlements['pub-cup:pool:classic-bracket'].winnerUserIds, ['user-a'])
  assert.equal(settled.plan.snapshot.sourcePolicy, 'host-entered')
  assert.equal(creatorAfterLaunch.competitions[0].competitionId, 'pub-cup')
  assert.equal(workbenchAfterLaunch.counts.resultQueues, 1)
  assert.equal(workbenchAfterLaunch.results.fixtureRows.length, 3)
  assert.equal(workbenchAfterLaunch.results.fixtureRows.every(row => row.needsResult === false), true)
  assert.deepEqual(workbenchAfterLaunch.results.linkedPools.map(pool => pool.poolId), ['pub-cup:pool:classic-bracket'])
  assert.equal(workbenchAfterLaunch.results.latestSnapshot.resultCount, 3)
  assert.equal(workbenchAfterLaunch.results.review.status, 'settled')
  assert.equal(workbenchAfterLaunch.results.review.canCorrect, true)
  assert.deepEqual(workbenchAfterLaunch.results.review.settledPoolIds, ['pub-cup:pool:classic-bracket'])
  assert.equal(workbenchAfterLaunch.results.commandDraft.planType, 'creator-result-plan')
  assert.deepEqual(workbenchAfterLaunch.results.commandDraft.poolIds, [])

  const corrected = app.dispatch({
    ...workbenchAfterLaunch.results.correctionDraft,
    occurredAt: '2026-07-03T21:05:00.000Z',
    payload: {
      ...workbenchAfterLaunch.results.correctionDraft.payload,
      reason: 'host reviewed the final score',
      results: {
        ...workbenchAfterLaunch.results.correctionDraft.payload.results,
        'pub-cup:r2:m1': { winnerEntrantId: 'blue', roundNumber: 2 }
      }
    }
  })
  const workbenchAfterCorrection = app.createCreatorWorkbench({
    userId: 'organizer',
    competitionId: 'pub-cup'
  })
  app.dispatch(workbenchAfterCorrection.results.settlementCommandDrafts[0])
  const workbenchAfterResettle = app.createCreatorWorkbench({
    userId: 'organizer',
    competitionId: 'pub-cup'
  })

  assert.equal(workbenchAfterCorrection.results.latestSnapshot.corrected, true)
  assert.equal(workbenchAfterCorrection.results.latestSnapshot.correctionReason, 'host reviewed the final score')
  assert.equal(workbenchAfterCorrection.results.review.status, 'ready-to-settle')
  assert.equal(workbenchAfterCorrection.results.linkedPools[0].needsSettlement, true)
  assert.deepEqual(workbenchAfterCorrection.results.review.unsettledPoolIds, ['pub-cup:pool:classic-bracket'])
  assert.equal(workbenchAfterCorrection.results.settlementCommandDrafts[0].payload.resultSnapshotId, corrected.payload.snapshotId)
  assert.equal(app.view().poolSettlements['pub-cup:pool:classic-bracket'].resultSnapshotId, corrected.payload.snapshotId)
  assert.equal(workbenchAfterResettle.results.review.status, 'settled')
  assert.throws(() => app.dispatch({
    type: 'creator:addEntrant',
    actorId: 'intruder',
    payload: {
      draftId: 'draft-pub-cup',
      entrant: { entrantId: 'late', name: 'Late Entry' }
    }
  }), /not the organizer/)
})

test('creator workbench reviews, corrects, and re-resolves host-entered awards cards', () => {
  const app = platform.createUltimateSportsPlatform({ peerId: 'host' })
  app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T20:00:00.000Z',
    payload: {
      competitionId: 'awards-night',
      title: 'Awards Night',
      organizerId: 'host',
      category: 'awards',
      templateConfig: {
        kind: 'awards-card',
        sportOrCategory: 'awards',
        entrantShape: 'nominee',
        resultPolicy: 'host-entered'
      },
      fixturesConfig: {
        categories: [
          { categoryId: 'best-song', name: 'Best Song', nominees: ['song-a', 'song-b'] }
        ]
      }
    }
  })
  app.dispatch({
    type: 'card:create',
    actorId: 'host',
    occurredAt: '2026-07-03T20:01:00.000Z',
    payload: {
      cardId: 'awards-night:card:winners',
      competitionId: 'awards-night',
      cardType: 'awards-card',
      title: 'Winner picks',
      fields: [
        { fieldId: 'winner', fieldType: 'single-choice', label: 'Winner', options: ['song-a', 'song-b'] },
        { fieldId: 'speech-length', fieldType: 'numeric-total', label: 'Speech length', tolerance: 2 }
      ]
    }
  })
  app.dispatch({
    type: 'card:submit',
    actorId: 'alice',
    payload: {
      cardId: 'awards-night:card:winners',
      answers: { winner: 'song-a', 'speech-length': 44 }
    }
  })
  app.dispatch({
    type: 'card:submit',
    actorId: 'bob',
    payload: {
      cardId: 'awards-night:card:winners',
      answers: { winner: 'song-b', 'speech-length': 45 }
    }
  })

  const beforeResults = app.createCreatorWorkbench({
    userId: 'host',
    competitionId: 'awards-night'
  })
  app.dispatchCreatorResultPlan({
    competitionId: 'awards-night',
    hostUserId: 'host',
    occurredAt: '2026-07-03T22:00:00.000Z',
    results: {
      'best-song': { winnerEntrantId: 'song-b', roundNumber: 1 }
    },
    cardResults: {
      winner: 'song-b',
      'speech-length': 45
    }
  })
  const readyToResolve = app.createCreatorWorkbench({
    userId: 'host',
    competitionId: 'awards-night'
  })
  app.dispatch(readyToResolve.results.cardResolveCommandDrafts[0])
  const resolved = app.createCreatorWorkbench({
    userId: 'host',
    competitionId: 'awards-night'
  })
  const initialCardWinnerUserIds = app.view().cardResolutions['awards-night:card:winners'].winnerUserIds.slice()
  const corrected = app.dispatch({
    ...resolved.results.correctionDraft,
    occurredAt: '2026-07-03T22:05:00.000Z',
    payload: {
      ...resolved.results.correctionDraft.payload,
      reason: 'winner announced correction',
      cardResults: {
        winner: 'song-a',
        'speech-length': 44
      }
    }
  })
  const afterCorrection = app.createCreatorWorkbench({
    userId: 'host',
    competitionId: 'awards-night'
  })
  app.dispatch(afterCorrection.results.cardResolveCommandDrafts[0])
  const afterReresolve = app.createCreatorWorkbench({
    userId: 'host',
    competitionId: 'awards-night'
  })

  assert.equal(beforeResults.results.review.status, 'needs-results')
  assert.deepEqual(beforeResults.results.review.missingFixtureIds, ['best-song'])
  assert.deepEqual(beforeResults.results.review.missingCardFieldIds, [
    'awards-night:card:winners:winner',
    'awards-night:card:winners:speech-length'
  ])
  assert.equal(readyToResolve.results.review.status, 'ready-to-settle')
  assert.equal(readyToResolve.results.review.canResolveCards, true)
  assert.deepEqual(readyToResolve.results.review.unresolvedCardIds, ['awards-night:card:winners'])
  assert.deepEqual(initialCardWinnerUserIds, ['bob'])
  assert.equal(afterCorrection.results.latestSnapshot.snapshotId, corrected.payload.snapshotId)
  assert.equal(afterCorrection.results.latestSnapshot.corrected, true)
  assert.equal(afterCorrection.results.review.status, 'ready-to-settle')
  assert.equal(afterCorrection.results.cardRows[0].needsResolution, true)
  assert.equal(afterCorrection.results.cardResolveCommandDrafts[0].payload.results.winner, 'song-a')
  assert.deepEqual(app.view().cardResolutions['awards-night:card:winners'].winnerUserIds, ['alice'])
  assert.equal(afterReresolve.results.review.status, 'settled')
  assert.deepEqual(afterReresolve.results.review.resolvedCardIds, ['awards-night:card:winners'])
})
