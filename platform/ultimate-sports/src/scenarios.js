'use strict'

const { stableId } = require('./util')

function soccerKnockoutScenario (input = {}) {
  const competitionId = input.competitionId || 'scenario-soccer-knockout'
  const poolId = input.poolId || `${competitionId}:pool:classic`
  const roomId = input.roomId || `${competitionId}:room:final`
  return {
    scenarioId: 'soccer-knockout',
    title: input.title || 'Soccer Knockout Night',
    topics: [
      { kind: 'competition', id: competitionId },
      { kind: 'pool', id: poolId },
      { kind: 'room', id: roomId }
    ],
    commands: [
      {
        type: 'competition:create',
        actorId: 'host',
        occurredAt: '2026-07-03T10:00:00.000Z',
        payload: {
          competitionId,
          title: input.title || 'Soccer Knockout Night',
          category: 'sports',
          templateConfig: { kind: 'single-elimination', sportOrCategory: 'soccer', entrantShape: 'team' },
          entrants: input.entrants || [
            { entrantId: 'red', name: 'Red FC' },
            { entrantId: 'blue', name: 'Blue FC' },
            { entrantId: 'gold', name: 'Gold FC' },
            { entrantId: 'green', name: 'Green FC' }
          ]
        }
      },
      {
        type: 'pool:create',
        actorId: 'host',
        occurredAt: '2026-07-03T10:01:00.000Z',
        payload: {
          poolId,
          competitionId,
          title: 'Classic bracket',
          variant: 'classic-bracket',
          mode: 'demo'
        }
      },
      {
        type: 'room:create',
        actorId: 'host',
        occurredAt: '2026-07-03T10:02:00.000Z',
        payload: {
          roomId,
          competitionId,
          fixtureId: 'final',
          title: 'Final watch room',
          hostUserId: 'host',
          status: 'live'
        }
      },
      {
        type: 'room:join',
        actorId: 'host',
        occurredAt: '2026-07-03T10:03:00.000Z',
        payload: { roomId }
      }
    ]
  }
}

function creatorBracketScenario (input = {}) {
  const competitionId = input.competitionId || 'scenario-creator-bracket'
  const poolId = input.poolId || `${competitionId}:pool:creator`
  return {
    scenarioId: 'creator-bracket',
    title: input.title || 'Creator Bracket',
    topics: [
      { kind: 'creator', id: input.organizerId || 'creator-host' },
      { kind: 'competition', id: competitionId },
      { kind: 'pool', id: poolId }
    ],
    commands: [
      {
        type: 'competition:create',
        actorId: input.organizerId || 'creator-host',
        occurredAt: '2026-07-03T11:00:00.000Z',
        payload: {
          competitionId,
          title: input.title || 'Creator Bracket',
          category: 'creator',
          templateConfig: {
            kind: 'single-elimination',
            sportOrCategory: 'creator',
            entrantShape: 'creator',
            resultPolicy: 'host-entered'
          },
          entrants: input.entrants || [
            { entrantId: 'chef-a', name: 'Chef A' },
            { entrantId: 'chef-b', name: 'Chef B' }
          ]
        }
      },
      {
        type: 'pool:create',
        actorId: input.organizerId || 'creator-host',
        occurredAt: '2026-07-03T11:01:00.000Z',
        payload: {
          poolId,
          competitionId,
          title: 'Creator bracket picks',
          variant: 'classic-bracket',
          mode: 'sponsor-prize',
          gates: {
            poolRulesAccepted: true
          }
        }
      }
    ]
  }
}

function fightCardScenario (input = {}) {
  const competitionId = input.competitionId || 'scenario-fight-card'
  return {
    scenarioId: 'fight-card',
    title: input.title || 'Fight Card Night',
    topics: [
      { kind: 'competition', id: competitionId },
      { kind: 'feed', id: competitionId }
    ],
    commands: [
      {
        type: 'competition:create',
        actorId: 'host',
        occurredAt: '2026-07-03T12:00:00.000Z',
        payload: {
          competitionId,
          title: input.title || 'Fight Card Night',
          category: 'sports',
          templateConfig: { kind: 'fight-card', sportOrCategory: 'mma', entrantShape: 'player' },
          fixturesConfig: {
            bouts: input.bouts || [
              { boutId: 'main', fighterA: 'fighter-a', fighterB: 'fighter-b', mainEvent: true, weightClass: 'lightweight' }
            ]
          }
        }
      }
    ]
  }
}

function awardsScenario (input = {}) {
  const competitionId = input.competitionId || 'scenario-awards'
  return {
    scenarioId: 'awards-card',
    title: input.title || 'Awards Pool',
    topics: [
      { kind: 'competition', id: competitionId },
      { kind: 'room', id: `${competitionId}:room` }
    ],
    commands: [
      {
        type: 'competition:create',
        actorId: 'host',
        occurredAt: '2026-07-03T13:00:00.000Z',
        payload: {
          competitionId,
          title: input.title || 'Awards Pool',
          category: 'awards',
          templateConfig: { kind: 'awards-card', sportOrCategory: 'awards', entrantShape: 'nominee', resultPolicy: 'host-entered' },
          fixturesConfig: {
            categories: input.categories || [
              { categoryId: 'best-song', name: 'Best Song', nominees: ['song-a', 'song-b'] },
              { categoryId: 'best-film', name: 'Best Film', nominees: ['film-a', 'film-b'] }
            ]
          }
        }
      }
    ]
  }
}

function seriesPlayoffScenario (input = {}) {
  const competitionId = input.competitionId || 'scenario-series-playoff'
  return {
    scenarioId: 'series-playoff',
    title: input.title || 'Series Playoff',
    topics: [{ kind: 'competition', id: competitionId }],
    commands: [
      {
        type: 'competition:create',
        actorId: 'host',
        occurredAt: '2026-07-03T14:00:00.000Z',
        payload: {
          competitionId,
          title: input.title || 'Series Playoff',
          category: 'sports',
          templateConfig: { kind: 'series-playoff', sportOrCategory: 'basketball', entrantShape: 'team' },
          entrants: input.entrants || ['One', 'Two', 'Three', 'Four'],
          fixturesConfig: { bestOf: input.bestOf || 7 }
        }
      }
    ]
  }
}

function scenarioById (scenarioId, input = {}) {
  if (scenarioId === 'soccer-knockout') return soccerKnockoutScenario(input)
  if (scenarioId === 'creator-bracket') return creatorBracketScenario(input)
  if (scenarioId === 'fight-card') return fightCardScenario(input)
  if (scenarioId === 'awards-card') return awardsScenario(input)
  if (scenarioId === 'series-playoff') return seriesPlayoffScenario(input)
  throw new Error(`unknown scenario: ${scenarioId}`)
}

function scenarioRunId (scenario) {
  return stableId(`scenario-${scenario.scenarioId}`, {
    title: scenario.title,
    commands: scenario.commands.map(command => command.type)
  })
}

module.exports = {
  soccerKnockoutScenario,
  creatorBracketScenario,
  fightCardScenario,
  awardsScenario,
  seriesPlayoffScenario,
  scenarioById,
  scenarioRunId
}
