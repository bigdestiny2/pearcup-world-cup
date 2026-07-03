'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { runtime, transport } = require('../src')

test('transport topic naming covers platform topic families', () => {
  assert.equal(transport.topicFor('lobby'), 'pearcup:v2:lobby')
  assert.equal(transport.topicFor('competition', 'cup'), 'pearcup:v2:competition:cup')
  assert.equal(transport.topicFor('pool', 'pool-1'), 'pearcup:v2:pool:pool-1')
  assert.equal(transport.topicFor('room', 'final'), 'pearcup:v2:room:final')
  assert.equal(transport.topicFor('game', 'game-1'), 'pearcup:v2:game:game-1')
  assert.equal(transport.topicFor('feed', 'cup'), 'pearcup:v2:feed:cup')
  assert.equal(transport.topicFor('creator', 'host'), 'pearcup:v2:creator:host')
})

test('transport sync converges runtimes across duplicate and out-of-order events', () => {
  const bus = transport.createTransportSim()
  const topic = transport.topicFor('room', 'sync-room')
  const alice = runtime.createPlatformRuntime()
  const bob = runtime.createPlatformRuntime()

  bus.joinTopic({ peerId: 'alice', topic })
  bus.joinTopic({ peerId: 'bob', topic })

  alice.dispatch({
    type: 'room:create',
    actorId: 'alice',
    occurredAt: '2026-07-03T22:00:00.000Z',
    payload: {
      roomId: 'sync-room',
      competitionId: 'sync-cup',
      hostUserId: 'alice'
    }
  })
  alice.dispatch({
    type: 'room:join',
    actorId: 'alice',
    occurredAt: '2026-07-03T22:01:00.000Z',
    payload: { roomId: 'sync-room' }
  })
  bob.merge(alice.events())
  bob.dispatch({
    type: 'room:join',
    actorId: 'bob',
    occurredAt: '2026-07-03T22:02:00.000Z',
    payload: { roomId: 'sync-room', username: 'Bob' }
  })
  bob.dispatch({
    type: 'room:chat',
    actorId: 'bob',
    occurredAt: '2026-07-03T22:03:00.000Z',
    payload: {
      roomId: 'sync-room',
      body: 'Synced from another peer.'
    }
  })

  const shuffledBobEvents = bob.events().slice().reverse().concat(bob.events().slice(0, 2))
  const publishAlice = bus.publish({ peerId: 'alice', topic, events: alice.events() })
  const publishBob = bus.publish({ peerId: 'bob', topic, events: shuffledBobEvents })

  assert.equal(publishAlice.rejected.length, 0)
  assert.equal(publishBob.rejected.length, 0)
  assert.equal(bus.topicEvents(topic).length, 4)

  const aliceSync = bus.syncRuntime({ peerId: 'alice', topic, runtime: alice })
  const bobSync = bus.syncRuntime({ peerId: 'bob', topic, runtime: bob })

  assert.equal(aliceSync.runtimeRoot, bobSync.runtimeRoot)
  assert.equal(alice.root(), bob.root())
  assert.equal(alice.view().roomMessages[Object.keys(alice.view().roomMessages)[0]].body, 'Synced from another peer.')
  assert.equal(bob.view().roomParticipants['sync-room'].alice.role, 'host')
  assert.equal(bus.compareTopicRoots(topic, { alice: alice.root(), bob: bob.root() }).ok, true)
})

test('transport rejects forged events and requires topic membership', () => {
  const bus = transport.createTransportSim()
  const topic = transport.topicFor('pool', 'pool-sync')
  const app = runtime.createPlatformRuntime()
  bus.joinTopic({ peerId: 'peer-a', topic })

  app.dispatch({
    type: 'pool:create',
    actorId: 'host',
    occurredAt: '2026-07-03T23:00:00.000Z',
    payload: {
      poolId: 'pool-sync',
      competitionId: 'cup-sync',
      variant: 'classic-bracket'
    }
  })
  const forged = {
    ...app.events()[0],
    payload: { poolId: 'evil' }
  }

  const published = bus.publish({
    peerId: 'peer-a',
    topic,
    events: [forged, app.events()[0], app.events()[0]]
  })

  assert.equal(published.accepted, 1)
  assert.equal(published.rejected.length, 1)
  assert.equal(bus.topicEvents(topic).length, 1)
  assert.throws(() => bus.publish({
    peerId: 'peer-b',
    topic,
    events: app.events()
  }), /has not joined/)
})

