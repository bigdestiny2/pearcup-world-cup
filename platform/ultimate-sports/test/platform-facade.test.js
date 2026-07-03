'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { platform, scenarios, transport } = require('../src')

test('facade applies soccer scenario and supports UI-style pool workflow', () => {
  const app = platform.createUltimateSportsPlatform({ peerId: 'host' })
  const applied = app.applyScenario('soccer-knockout', {
    competitionId: 'facade-cup',
    poolId: 'facade-pool',
    roomId: 'facade-room'
  })
  app.joinScenarioTopics(applied.scenario)

  const entry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'user-a',
    occurredAt: '2026-07-03T15:00:00.000Z',
    payload: {
      poolId: 'facade-pool',
      userId: 'user-a',
      entryType: 'bracket',
      picks: { final: 'red' }
    }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T15:01:00.000Z',
    payload: { entryId: entry.payload.entryId }
  })
  const result = app.dispatch({
    type: 'result:record',
    actorId: 'feed',
    occurredAt: '2026-07-03T15:02:00.000Z',
    payload: {
      competitionId: 'facade-cup',
      results: {
        final: { winnerEntrantId: 'red', roundNumber: 1 }
      }
    }
  })
  app.dispatch({
    type: 'pool:resolve',
    actorId: 'system',
    occurredAt: '2026-07-03T15:03:00.000Z',
    payload: {
      poolId: 'facade-pool',
      resultSnapshotId: result.payload.snapshotId
    }
  })

  assert.equal(applied.scenarioRunId.startsWith('scenario-soccer-knockout-'), true)
  assert.equal(app.view().competitions['facade-cup'].title, 'Soccer Knockout Night')
  assert.equal(app.view().rooms['facade-room'].hostUserId, 'host')
  assert.deepEqual(app.view().poolSettlements['facade-pool'].winnerUserIds, ['user-a'])
  assert.ok(app.joinedTopics.has(transport.topicFor('competition', 'facade-cup')))
})

test('facade scenarios cover fight-card, awards, creator, and series setup', () => {
  const app = platform.createUltimateSportsPlatform()
  const fight = app.applyScenario(scenarios.fightCardScenario({ competitionId: 'facade-fight' }))
  const awards = app.applyScenario('awards-card', { competitionId: 'facade-awards' })
  const creator = app.applyScenario('creator-bracket', { competitionId: 'facade-creator', poolId: 'facade-creator-pool' })
  const series = app.applyScenario('series-playoff', { competitionId: 'facade-series', bestOf: 5 })

  assert.equal(fight.view.competitions['facade-fight'].fixtures[0].resultFields.includes('method'), true)
  assert.equal(awards.view.competitions['facade-awards'].fixtures[0].stageId, 'facade-awards:stage:awards-card')
  assert.equal(creator.view.pools['facade-creator-pool'].mode, 'sponsor-prize')
  assert.equal(series.view.competitions['facade-series'].fixtures[0].series.bestOf, 5)
})

test('facade syncs scenario state across peers with shared transport', () => {
  const bus = transport.createTransportSim()
  const alice = platform.createUltimateSportsPlatform({ peerId: 'alice', transport: bus })
  const bob = platform.createUltimateSportsPlatform({ peerId: 'bob', transport: bus })
  const applied = alice.applyScenario('soccer-knockout', {
    competitionId: 'shared-cup',
    poolId: 'shared-pool',
    roomId: 'shared-room'
  })
  const roomTopic = { kind: 'room', id: 'shared-room' }

  alice.joinScenarioTopics(applied.scenario)
  bob.joinTopic(roomTopic)
  bob.joinTopic({ kind: 'competition', id: 'shared-cup' })

  alice.syncTopic(roomTopic)
  bob.pullTopic(roomTopic)
  bob.dispatch({
    type: 'room:join',
    actorId: 'bob',
    occurredAt: '2026-07-03T16:00:00.000Z',
    payload: {
      roomId: 'shared-room',
      username: 'Bob'
    }
  })
  bob.dispatch({
    type: 'room:chat',
    actorId: 'bob',
    occurredAt: '2026-07-03T16:01:00.000Z',
    payload: {
      roomId: 'shared-room',
      body: 'Facade sync works.'
    }
  })
  bob.syncTopic(roomTopic)
  alice.pullTopic(roomTopic)

  assert.equal(alice.view().roomParticipants['shared-room'].bob.username, 'Bob')
  assert.equal(Object.values(alice.view().roomMessages)[0].body, 'Facade sync works.')
  assert.equal(alice.root(), bob.root())
})

