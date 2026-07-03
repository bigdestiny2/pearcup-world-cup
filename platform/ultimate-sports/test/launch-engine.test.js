'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { bridge, launch, platform } = require('../src')

test('launch planner creates an applyable soccer scenario with pools, cards, room, and market', () => {
  const app = platform.createUltimateSportsPlatform()
  const scenario = app.createLaunchScenario({
    fitId: 'world-cup',
    title: 'Launch Cup',
    competitionId: 'launch-cup',
    roomId: 'launch-room',
    variantIds: ['classic-bracket', 'group-stage-card'],
    miniGameTypes: ['next-event', 'penalty-clash'],
    entrants: [
      { entrantId: 'red', name: 'Red FC' },
      { entrantId: 'blue', name: 'Blue FC' },
      { entrantId: 'gold', name: 'Gold FC' },
      { entrantId: 'green', name: 'Green FC' }
    ]
  })
  const applied = app.applyScenario(scenario)
  const view = applied.view

  assert.equal(scenario.launchPlan.activationTasks.length, 1)
  assert.equal(scenario.launchPlan.activationTasks[0].gameType, 'penalty-clash')
  assert.equal(view.competitions['launch-cup'].template.kind, 'group-plus-knockout')
  assert.equal(view.pools['launch-cup:pool:classic-bracket'].mode, 'demo')
  assert.equal(view.pools['launch-cup:pool:group-stage-card'].rules.variant, 'group-stage-card')
  assert.equal(view.cards['launch-cup:card:group-stage-card'].cardType, 'group-stage-card')
  assert.equal(view.rooms['launch-room'].hostUserId, 'host')
  assert.equal(view.roomParticipants['launch-room'].host.role, 'host')
  assert.equal(view.markets['launch-room:market:next-event'].marketType, 'next-event')
})

test('sponsor-prize launch plans include gates and can create peer game sessions after players are known', () => {
  const app = platform.createUltimateSportsPlatform()
  const scenario = launch.createLaunchScenario({
    fitId: 'creator-reality-brackets',
    title: 'Creator Cookoff',
    competitionId: 'creator-cookoff',
    roomId: 'creator-room',
    settlementMode: 'sponsor-prize',
    variantIds: ['classic-bracket'],
    miniGameTypes: ['trivia-duel'],
    players: ['alice', 'bob']
  })
  app.applyScenario(scenario)
  const view = app.view()
  const poolCommand = scenario.commands.find(command => command.type === 'pool:create')
  const gameCommand = scenario.commands.find(command => command.type === 'game:create')

  assert.deepEqual(poolCommand.payload.gates, { poolRulesAccepted: true })
  assert.deepEqual(gameCommand.payload.gates, { poolRulesAccepted: true })
  assert.equal(view.pools['creator-cookoff:pool:classic-bracket'].mode, 'sponsor-prize')
  assert.equal(Object.values(view.gameSessions)[0].gameType, 'trivia-duel')
  assert.equal(scenario.launchPlan.activationTasks.length, 0)
})

test('bridge can request launch plans for future UI flows', () => {
  const handler = bridge.createBridgeHandler()
  const response = handler.handle(bridge.createBridgeRequest({
    action: 'createLaunchPlan',
    requestId: 'launch-plan',
    payload: {
      input: {
        fitId: 'pro-playoffs',
        competitionId: 'playoff-launch',
        variantIds: ['classic-bracket', 'fantasy-lite-draft'],
        miniGameTypes: ['peer-mini-fantasy']
      }
    }
  }))

  assert.equal(response.ok, true)
  assert.equal(response.result.fit.fitId, 'pro-playoffs')
  assert.equal(response.result.commands.some(command => command.type === 'draft:create'), true)
  assert.equal(response.result.topics.some(topic => topic.kind === 'competition' && topic.id === 'playoff-launch'), true)
})

test('launch planner turns momentum duel into a live prediction market', () => {
  const app = platform.createUltimateSportsPlatform()
  const scenario = app.createLaunchScenario({
    fitId: 'champions-league-knockout',
    competitionId: 'momentum-launch',
    roomId: 'momentum-room',
    miniGameTypes: ['momentum-duel'],
    variantIds: ['classic-bracket']
  })
  app.applyScenario(scenario)

  assert.equal(scenario.launchPlan.activationTasks.length, 0)
  assert.equal(app.view().markets['momentum-room:market:momentum-duel'].marketType, 'momentum-duel')
  assert.deepEqual(app.view().markets['momentum-room:market:momentum-duel'].options, ['home-pressure', 'away-pressure', 'balanced'])
})
