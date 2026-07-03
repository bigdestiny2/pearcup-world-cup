'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { competition, creator, feed, prediction, runtime } = require('../src')

test('series playoff templates create best-of fixtures with game slots', () => {
  const template = competition.createCompetitionTemplate({
    kind: 'series-playoff',
    sportOrCategory: 'basketball',
    entrantShape: 'team'
  })
  const playoff = competition.createCompetition({
    competitionId: 'nba-demo',
    title: 'NBA Demo Playoffs',
    template,
    entrants: ['One', 'Two', 'Three', 'Four'],
    fixturesConfig: { bestOf: 7 }
  })

  assert.equal(playoff.fixtures.length, 3)
  assert.equal(playoff.fixtures[0].roundName, 'Semifinals Series')
  assert.equal(playoff.fixtures[0].series.bestOf, 7)
  assert.equal(playoff.fixtures[0].series.winsRequired, 4)
  assert.equal(playoff.fixtures[0].series.games.length, 7)
})

test('round robin templates generate every entrant pairing once', () => {
  const template = competition.createCompetitionTemplate({
    kind: 'round-robin',
    sportOrCategory: 'local',
    entrantShape: 'team',
    resultPolicy: 'host-entered'
  })
  const league = competition.createCompetition({
    competitionId: 'pub-league',
    title: 'Pub League',
    template,
    entrants: ['Red', 'Blue', 'Green', 'Gold']
  })

  assert.equal(league.fixtures.length, 6)
  assert.equal(league.fixtures[0].stageId, 'pub-league:stage:round-robin')
  assert.deepEqual(league.fixtures[0].sourceSlots.map(slot => slot.entrantId), [
    league.entrants[0].entrantId,
    league.entrants[1].entrantId
  ])
})

test('single-elimination templates scale across 4, 8, 16, 32, and 64 entrants', () => {
  ;[4, 8, 16, 32, 64].forEach(size => {
    const tournament = competition.createCompetition({
      competitionId: `bracket-${size}`,
      title: `Bracket ${size}`,
      templateConfig: {
        kind: 'single-elimination',
        sportOrCategory: size === 64 ? 'basketball' : 'soccer',
        entrantShape: 'team'
      },
      entrants: Array.from({ length: size }, (_, index) => ({
        entrantId: `seed-${index + 1}`,
        name: `Seed ${index + 1}`,
        seed: index + 1
      }))
    })
    const firstRound = tournament.fixtures.filter(fixture => fixture.roundNumber === 1)
    const final = tournament.fixtures.filter(fixture => fixture.roundName === 'Final')

    assert.equal(tournament.fixtures.length, size - 1)
    assert.equal(firstRound.length, size / 2)
    assert.equal(final.length, 1)
    assert.equal(tournament.fixtures[tournament.fixtures.length - 1].sourceSlots.every(slot => slot.type === 'winner'), true)
  })
})

test('fight-card and awards templates expose result fields for card predictions', () => {
  const fightTemplate = competition.createCompetitionTemplate({
    kind: 'fight-card',
    sportOrCategory: 'mma',
    entrantShape: 'player'
  })
  const fightCard = competition.createCompetition({
    competitionId: 'mma-night',
    title: 'MMA Night',
    template: fightTemplate,
    fixturesConfig: {
      bouts: [
        { boutId: 'main', fighterA: 'fighter-a', fighterB: 'fighter-b', weightClass: 'lightweight', mainEvent: true },
        { boutId: 'co-main', fighterA: 'fighter-c', fighterB: 'fighter-d' }
      ]
    }
  })

  const awardsTemplate = competition.createCompetitionTemplate({
    kind: 'awards-card',
    sportOrCategory: 'awards',
    entrantShape: 'nominee',
    resultPolicy: 'host-entered'
  })
  const awards = competition.createCompetition({
    competitionId: 'awards-demo',
    title: 'Awards Demo',
    template: awardsTemplate,
    fixturesConfig: {
      categories: [
        { categoryId: 'best-song', name: 'Best Song', nominees: ['song-a', 'song-b'] }
      ]
    }
  })

  assert.equal(fightCard.fixtures.length, 2)
  assert.equal(fightCard.fixtures[0].roundName, 'Main Event')
  assert.deepEqual(fightCard.fixtures[0].resultFields, ['winnerEntrantId', 'method', 'round', 'time'])
  assert.equal(awards.fixtures[0].fixtureId, 'best-song')
  assert.equal(awards.fixtures[0].sourceSlots.length, 2)
  assert.deepEqual(awards.fixtures[0].resultFields, ['winnerEntrantId'])
})

test('creator result corrections create corrected snapshots for replayed settlement', () => {
  const app = runtime.createPlatformRuntime()
  const draft = creator.createCreatorCompetitionDraft({
    title: 'Office Bracket',
    organizerId: 'host',
    kind: 'single-elimination',
    entrantShape: 'team',
    entrants: [
      { entrantId: 'alpha', name: 'Alpha' },
      { entrantId: 'beta', name: 'Beta' }
    ]
  })
  const published = creator.publishCreatorCompetition(draft, '2026-07-03T18:00:00.000Z')

  app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T18:01:00.000Z',
    payload: {
      competitionId: 'creator-comp',
      title: published.title,
      template: published.template,
      entrants: published.entrants
    }
  })
  const rules = prediction.createPoolRules({ variant: 'classic-bracket', payoutPolicy: 'demo' })
  app.dispatch({
    type: 'pool:create',
    actorId: 'host',
    occurredAt: '2026-07-03T18:02:00.000Z',
    payload: {
      poolId: 'creator-pool',
      competitionId: 'creator-comp',
      rules
    }
  })
  const entry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'user-a',
    occurredAt: '2026-07-03T18:03:00.000Z',
    payload: {
      poolId: 'creator-pool',
      userId: 'user-a',
      entryType: 'bracket',
      picks: { final: 'alpha' }
    }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T18:04:00.000Z',
    payload: { entryId: entry.payload.entryId }
  })
  const original = app.dispatch({
    type: 'result:record',
    actorId: 'host',
    occurredAt: '2026-07-03T18:05:00.000Z',
    payload: {
      competitionId: 'creator-comp',
      sourcePolicy: 'host-entered',
      sourceActorId: 'host',
      results: {
        final: { winnerEntrantId: 'beta', roundNumber: 1 }
      }
    }
  })
  const corrected = app.dispatch({
    type: 'result:correct',
    actorId: 'host',
    occurredAt: '2026-07-03T18:06:00.000Z',
    payload: {
      snapshotId: original.payload.snapshotId,
      reason: 'scoreboard typo',
      results: {
        final: { winnerEntrantId: 'alpha', roundNumber: 1 }
      }
    }
  })
  const settlement = app.dispatch({
    type: 'pool:resolve',
    actorId: 'system',
    occurredAt: '2026-07-03T18:07:00.000Z',
    payload: {
      poolId: 'creator-pool',
      resultSnapshotId: corrected.payload.snapshotId
    }
  })

  assert.equal(feed.applyResultCorrection(original.payload, corrected.payload.correction).results.final.winnerEntrantId, 'alpha')
  assert.equal(settlement.payload.winnerUserIds[0], 'user-a')
  assert.equal(app.view().resultSnapshots[corrected.payload.snapshotId].correction.reason, 'scoreboard typo')
})

test('runtime replays creator entrant and fixture management before local settlement', () => {
  const app = runtime.createPlatformRuntime()
  app.dispatch({
    type: 'competition:create',
    actorId: 'organizer',
    occurredAt: '2026-07-03T17:00:00.000Z',
    payload: {
      competitionId: 'local-managed',
      title: 'Local Managed League',
      organizerId: 'organizer',
      status: 'draft',
      templateConfig: {
        kind: 'creator-custom',
        sportOrCategory: 'local',
        entrantShape: 'team',
        resultPolicy: 'host-entered'
      },
      entrants: []
    }
  })
  app.dispatch({
    type: 'competition:addEntrant',
    actorId: 'organizer',
    occurredAt: '2026-07-03T17:01:00.000Z',
    payload: {
      competitionId: 'local-managed',
      entrant: { entrantId: 'pub-red', name: 'Pub Red' }
    }
  })
  app.dispatch({
    type: 'competition:addEntrant',
    actorId: 'organizer',
    occurredAt: '2026-07-03T17:02:00.000Z',
    payload: {
      competitionId: 'local-managed',
      entrant: { entrantId: 'pub-blue', name: 'Pub Blue' }
    }
  })
  app.dispatch({
    type: 'competition:scheduleFixture',
    actorId: 'organizer',
    occurredAt: '2026-07-03T17:03:00.000Z',
    payload: {
      competitionId: 'local-managed',
      fixture: {
        fixtureId: 'local-final',
        roundName: 'Pub Final',
        entrantIds: ['pub-red', 'pub-blue'],
        startsAt: '2026-07-03T19:00:00.000Z'
      }
    }
  })
  app.dispatch({
    type: 'competition:updateStatus',
    actorId: 'organizer',
    occurredAt: '2026-07-03T17:04:00.000Z',
    payload: {
      competitionId: 'local-managed',
      status: 'open'
    }
  })
  app.dispatch({
    type: 'pool:create',
    actorId: 'organizer',
    occurredAt: '2026-07-03T17:05:00.000Z',
    payload: {
      poolId: 'local-managed-pool',
      competitionId: 'local-managed',
      variant: 'classic-bracket',
      mode: 'demo'
    }
  })
  const entry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'player',
    occurredAt: '2026-07-03T17:06:00.000Z',
    payload: {
      poolId: 'local-managed-pool',
      userId: 'player',
      entryType: 'bracket',
      picks: { 'local-final': 'pub-red' }
    }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T17:07:00.000Z',
    payload: { entryId: entry.payload.entryId }
  })
  const result = app.dispatch({
    type: 'result:record',
    actorId: 'organizer',
    occurredAt: '2026-07-03T20:00:00.000Z',
    payload: {
      competitionId: 'local-managed',
      sourcePolicy: 'host-entered',
      sourceActorId: 'organizer',
      results: {
        'local-final': { winnerEntrantId: 'pub-red', roundNumber: 1 }
      }
    }
  })
  const settlement = app.dispatch({
    type: 'pool:resolve',
    actorId: 'system',
    occurredAt: '2026-07-03T20:01:00.000Z',
    payload: {
      poolId: 'local-managed-pool',
      resultSnapshotId: result.payload.snapshotId
    }
  })
  const view = app.view()

  assert.equal(view.competitions['local-managed'].entrantIds.length, 2)
  assert.equal(view.competitions['local-managed'].fixtureIds[0], 'local-final')
  assert.equal(view.competitions['local-managed'].status, 'open')
  assert.deepEqual(settlement.payload.winnerUserIds, ['player'])
  assert.throws(() => app.dispatch({
    type: 'competition:addEntrant',
    actorId: 'intruder',
    payload: {
      competitionId: 'local-managed',
      entrant: { entrantId: 'pub-green', name: 'Pub Green' }
    }
  }), /not a competition host/)
})
