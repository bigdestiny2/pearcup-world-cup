'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { bridge, platform, transport } = require('../src')

test('bridge handler applies scenarios and returns replay views through envelopes', () => {
  const handler = bridge.createBridgeHandler({
    platformOptions: { peerId: 'bridge-host' }
  })

  const scenarioResponse = handler.handle(bridge.createBridgeRequest({
    action: 'applyScenario',
    requestId: 'req-scenario',
    payload: {
      scenarioId: 'soccer-knockout',
      input: {
        competitionId: 'bridge-cup',
        poolId: 'bridge-pool',
        roomId: 'bridge-room'
      }
    }
  }))
  const viewResponse = handler.handle(bridge.createBridgeRequest({
    action: 'view',
    requestId: 'req-view'
  }))
  const eventsResponse = handler.handle(bridge.createBridgeRequest({
    action: 'events',
    requestId: 'req-events'
  }))

  assert.equal(scenarioResponse.ok, true)
  assert.equal(scenarioResponse.requestId, 'req-scenario')
  assert.equal(viewResponse.result.competitions['bridge-cup'].title, 'Soccer Knockout Night')
  assert.equal(eventsResponse.result.events.length, 4)
  assert.equal(typeof eventsResponse.result.eventRoot, 'string')
})

test('bridge handler dispatches commands and reports action errors without throwing', () => {
  const handler = bridge.createBridgeHandler({
    platformOptions: { peerId: 'bridge-user' }
  })
  handler.handle(bridge.createBridgeRequest({
    action: 'applyScenario',
    payload: {
      scenarioId: 'soccer-knockout',
      input: { roomId: 'bridge-error-room' }
    }
  }))

  const ok = handler.handle(bridge.createBridgeRequest({
    action: 'dispatch',
    requestId: 'req-chat',
    payload: {
      command: {
        type: 'room:chat',
        actorId: 'host',
        occurredAt: '2026-07-03T18:00:00.000Z',
        payload: {
          roomId: 'bridge-error-room',
          body: 'through the bridge'
        }
      }
    }
  }))
  const failed = handler.handle(bridge.createBridgeRequest({
    action: 'dispatch',
    requestId: 'req-fail',
    payload: {
      command: {
        type: 'room:chat',
        actorId: 'not-joined',
        payload: {
          roomId: 'bridge-error-room',
          body: 'nope'
        }
      }
    }
  }))

  assert.equal(ok.ok, true)
  assert.equal(ok.result.payload.body, 'through the bridge')
  assert.equal(failed.ok, false)
  assert.equal(failed.error.code, 'handler-error')
  assert.match(failed.error.message, /has not joined/)
})

test('bridge handler syncs two platforms across shared transport topics', () => {
  const bus = transport.createTransportSim()
  const alicePlatform = platform.createUltimateSportsPlatform({ peerId: 'alice-bridge', transport: bus })
  const bobPlatform = platform.createUltimateSportsPlatform({ peerId: 'bob-bridge', transport: bus })
  const alice = bridge.createBridgeHandler({ platform: alicePlatform })
  const bob = bridge.createBridgeHandler({ platform: bobPlatform })
  const roomTopic = { kind: 'room', id: 'bridge-sync-room' }

  alice.handle(bridge.createBridgeRequest({
    action: 'applyScenario',
    payload: {
      scenarioId: 'soccer-knockout',
      input: {
        competitionId: 'bridge-sync-cup',
        roomId: 'bridge-sync-room'
      }
    }
  }))
  alice.handle(bridge.createBridgeRequest({ action: 'joinTopic', payload: { topic: roomTopic } }))
  bob.handle(bridge.createBridgeRequest({ action: 'joinTopic', payload: { topic: roomTopic } }))
  alice.handle(bridge.createBridgeRequest({ action: 'syncTopic', payload: { topic: roomTopic } }))
  bob.handle(bridge.createBridgeRequest({ action: 'pullTopic', payload: { topic: roomTopic } }))
  bob.handle(bridge.createBridgeRequest({
    action: 'dispatch',
    payload: {
      command: {
        type: 'room:join',
        actorId: 'bob',
        occurredAt: '2026-07-03T19:00:00.000Z',
        payload: {
          roomId: 'bridge-sync-room',
          username: 'Bob'
        }
      }
    }
  }))
  bob.handle(bridge.createBridgeRequest({ action: 'syncTopic', payload: { topic: roomTopic } }))
  alice.handle(bridge.createBridgeRequest({ action: 'pullTopic', payload: { topic: roomTopic } }))

  const status = alice.handle(bridge.createBridgeRequest({ action: 'status', requestId: 'req-status' }))
  assert.equal(alicePlatform.root(), bobPlatform.root())
  assert.equal(alicePlatform.view().roomParticipants['bridge-sync-room'].bob.username, 'Bob')
  assert.equal(status.ok, true)
  assert.ok(status.result.joinedTopics.includes(transport.topicFor('room', 'bridge-sync-room')))
})

test('bridge validation rejects unsupported protocol or actions', () => {
  const handler = bridge.createBridgeHandler()
  const badProtocol = handler.handle({
    protocol: 'wrong',
    requestId: 'bad-protocol',
    action: 'view',
    payload: {}
  })
  const badAction = handler.handle({
    protocol: bridge.BRIDGE_PROTOCOL_VERSION,
    requestId: 'bad-action',
    action: 'explode',
    payload: {}
  })

  assert.equal(badProtocol.ok, false)
  assert.equal(badProtocol.error.code, 'invalid-request')
  assert.match(badProtocol.error.message, /protocol/)
  assert.equal(badAction.ok, false)
  assert.match(badAction.error.message, /unsupported action/)
})

test('bridge handler exposes standup audit and sports data aggregator actions', () => {
  const handler = bridge.createBridgeHandler({
    platformOptions: { peerId: 'bridge-aggregator' }
  })
  const clientPlan = handler.handle(bridge.createBridgeRequest({
    action: 'createSportsDataClientPlan',
    requestId: 'req-client-plan',
    payload: {
      input: {
        env: {}
      }
    }
  }))
  const requestPlan = handler.handle(bridge.createBridgeRequest({
    action: 'createSportsDataRequestPlan',
    requestId: 'req-mma-data',
    payload: {
      input: {
        sourceId: 'sportsdataio-mma',
        entityType: 'event',
        params: {
          season: 'current'
        },
        env: {}
      }
    }
  }))
  const audit = handler.handle(bridge.createBridgeRequest({
    action: 'createStandupAudit',
    requestId: 'req-standup-audit',
    payload: {
      input: {
        generatedAt: '2026-07-04T00:00:00.000Z'
      }
    }
  }))
  const smokePlan = handler.handle(bridge.createBridgeRequest({
    action: 'createSportsDataSmokePlan',
    requestId: 'req-smoke-plan',
    payload: {
      input: {
        sourceIds: ['sportsdataio-mma'],
        env: {}
      }
    }
  }))

  assert.equal(clientPlan.ok, true)
  assert.equal(clientPlan.result.coverage.apiClientsWithRequestBuilders, clientPlan.result.coverage.apiSourceCount)
  assert.equal(clientPlan.result.serverOnly, true)
  assert.equal(requestPlan.ok, true)
  assert.equal(requestPlan.result.sourceId, 'sportsdataio-mma')
  assert.equal(requestPlan.result.serverOnly, true)
  assert.equal(requestPlan.result.headers['Ocp-Apim-Subscription-Key'], '<redacted:SPORTSDATAIO_MMA_API_KEY>')
  assert.deepEqual(requestPlan.result.missingEnv, ['SPORTSDATAIO_MMA_API_KEY'])
  assert.equal(audit.ok, true)
  assert.equal(audit.result.pearWorkerBridge.ok, true)
  assert.equal(audit.result.coverage.areas.some(area => area.title === 'Pear worker bridge wiring' && area.covered === 1), true)
  assert.equal(smokePlan.ok, true)
  assert.equal(smokePlan.result.checks[0].status, 'missing-env')
})
