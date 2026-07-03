'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { bridge, persistence, platform, transport } = require('../src')

test('platform snapshots round-trip events and joined topics through facade import', () => {
  const app = platform.createUltimateSportsPlatform({ peerId: 'snapshot-peer' })
  const applied = app.applyScenario('soccer-knockout', {
    competitionId: 'snapshot-cup',
    poolId: 'snapshot-pool',
    roomId: 'snapshot-room'
  })
  app.joinScenarioTopics(applied.scenario)

  const snapshot = app.exportSnapshot({
    label: 'before-restart',
    createdAt: '2026-07-03T20:00:00.000Z'
  })
  const restored = platform.createUltimateSportsPlatform({ peerId: 'restored-peer' })
  const imported = restored.importSnapshot(snapshot)

  assert.equal(persistence.verifyPlatformSnapshot(snapshot).ok, true)
  assert.equal(imported.eventRoot, app.root())
  assert.equal(restored.view().competitions['snapshot-cup'].title, 'Soccer Knockout Night')
  assert.ok(restored.joinedTopics.has(transport.topicFor('room', 'snapshot-room')))
})

test('snapshot serialization parses into a restored platform', () => {
  const app = platform.createUltimateSportsPlatform({ peerId: 'serialize-peer' })
  app.applyScenario('creator-bracket', {
    competitionId: 'serialize-creator',
    poolId: 'serialize-pool'
  })
  const text = app.serializeSnapshot({
    label: 'serialized',
    createdAt: '2026-07-03T20:30:00.000Z'
  })
  const restored = platform.createUltimateSportsPlatform({ peerId: 'parse-peer' })
  const imported = restored.parseSnapshot(text)

  assert.equal(typeof text, 'string')
  assert.equal(imported.eventRoot, app.root())
  assert.equal(restored.view().pools['serialize-pool'].mode, 'sponsor-prize')
})

test('snapshot verification rejects tampered payloads and root mismatches', () => {
  const app = platform.createUltimateSportsPlatform()
  app.applyScenario('soccer-knockout', { competitionId: 'tamper-cup' })
  const snapshot = app.exportSnapshot()
  const tamperedPayload = {
    ...snapshot,
    events: snapshot.events.map((event, index) => index === 0
      ? { ...event, payload: { ...event.payload, title: 'Tampered' } }
      : event)
  }
  const tamperedRoot = {
    ...snapshot,
    eventRoot: 'bad-root'
  }

  assert.equal(persistence.verifyPlatformSnapshot(tamperedPayload).ok, false)
  assert.throws(() => persistence.importPlatformSnapshot(tamperedPayload), /invalid platform snapshot/)
  assert.equal(persistence.verifyPlatformSnapshot(tamperedRoot).ok, false)
})

test('bridge exports and imports snapshots through request envelopes', () => {
  const source = bridge.createBridgeHandler({
    platformOptions: { peerId: 'bridge-source' }
  })
  source.handle(bridge.createBridgeRequest({
    action: 'applyScenario',
    payload: {
      scenarioId: 'soccer-knockout',
      input: {
        competitionId: 'bridge-snapshot-cup',
        roomId: 'bridge-snapshot-room'
      }
    }
  }))
  source.handle(bridge.createBridgeRequest({
    action: 'joinTopic',
    payload: {
      topic: { kind: 'room', id: 'bridge-snapshot-room' }
    }
  }))
  const exported = source.handle(bridge.createBridgeRequest({
    action: 'exportSnapshot',
    requestId: 'export',
    payload: {
      options: {
        label: 'bridge-export',
        createdAt: '2026-07-03T21:00:00.000Z'
      }
    }
  }))

  const target = bridge.createBridgeHandler({
    platformOptions: { peerId: 'bridge-target' }
  })
  const imported = target.handle(bridge.createBridgeRequest({
    action: 'importSnapshot',
    requestId: 'import',
    payload: {
      snapshot: exported.result
    }
  }))
  const view = target.handle(bridge.createBridgeRequest({
    action: 'view',
    requestId: 'view'
  }))
  const serialized = source.handle(bridge.createBridgeRequest({
    action: 'serializeSnapshot',
    requestId: 'serialize',
    payload: {
      options: { createdAt: '2026-07-03T21:01:00.000Z' }
    }
  }))
  const parsed = target.handle(bridge.createBridgeRequest({
    action: 'parseSnapshot',
    requestId: 'parse',
    payload: {
      snapshotText: serialized.result.snapshotText
    }
  }))

  assert.equal(exported.ok, true)
  assert.equal(imported.ok, true)
  assert.equal(imported.result.eventRoot, source.platform.root())
  assert.equal(view.result.competitions['bridge-snapshot-cup'].title, 'Soccer Knockout Night')
  assert.equal(parsed.ok, true)
  assert.equal(parsed.result.eventRoot, source.platform.root())
})

