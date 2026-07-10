const assert = require('node:assert/strict')
const EventEmitter = require('node:events')
const test = require('node:test')
const pearWorker = require('./pear-worker.cjs')

test('Pear worker bridge server handles direct protocol requests', async () => {
  const server = pearWorker.createPearCupWorkerBridgeServer()
  const response = await server.request({
    protocol: pearWorker.protocolVersion,
    requestId: 'worker-direct-1',
    action: 'dispatch',
    payload: {
      command: {
        type: 'game:submitCommitment',
        actorId: 'user-a',
        payload: {
          gameId: 'pc-pear-worker',
          roundId: 'round-1',
          playerId: 'user-a',
          commitment: 'commitment-a'
        }
      }
    }
  })

  assert.equal(response.ok, true)
  assert.equal(response.requestId, 'worker-direct-1')
  assert.equal(response.result.type, 'GameCommitmentSubmitted')
  assert.equal(response.view.typeCounts.GameCommitmentSubmitted, 1)
  assert.equal(response.eventsIncluded, false)
  assert.equal(response.events.length, 0)

  const snapshot = await server.request({
    protocol: pearWorker.protocolVersion,
    requestId: 'worker-direct-2',
    action: 'snapshot',
    payload: {
      includeEvents: true
    }
  })

  assert.equal(snapshot.ok, true)
  assert.equal(snapshot.eventsIncluded, true)
  assert.equal(snapshot.events.length, 1)
  await server.close()
})

test('Pear worker bridge server parses string and wrapped envelope messages', async () => {
  const server = pearWorker.createPearCupWorkerBridgeServer()
  const response = await server.request(JSON.stringify({
    envelope: {
      protocol: pearWorker.protocolVersion,
      requestId: 'worker-string-1',
      action: 'snapshot',
      payload: {}
    }
  }))

  assert.equal(response.ok, true)
  assert.equal(response.requestId, 'worker-string-1')
  assert.equal(response.protocol, pearWorker.protocolVersion)
  await server.close()
})

test('Pear worker bridge port binding replies through send-compatible ports', async () => {
  const port = new EventEmitter()
  const replies = []
  port.send = response => replies.push(response)

  const server = pearWorker.createPearCupWorkerBridgeServer()
  const unbind = pearWorker.bindPearCupWorkerPort(port, server)
  port.emit('message', {
    protocol: pearWorker.protocolVersion,
    requestId: 'worker-port-1',
    action: 'dispatch',
    payload: {
      command: {
        type: 'wdk:createEntryIntent',
        actorId: 'user-a',
        payload: {
          poolId: 'pool-locked',
          entryId: 'entry-locked',
          userId: 'user-a',
          username: 'a',
          amount: 10,
          asset: 'USDT'
        }
      }
    }
  })
  await new Promise(resolve => setImmediate(resolve))

  assert.equal(replies.length, 1)
  assert.equal(replies[0].ok, false)
  assert.equal(replies[0].code, 'PEARCUP_SETTLEMENT_LOCKED')
  assert.equal(replies[0].status.settlementGate.status, 'demo-locked')

  unbind()
  await server.close()
})

test('Pear worker bridge transport errors return redacted protocol errors', async () => {
  const rawSeed = 'valid pear worker seed phrase'
  const server = pearWorker.createPearCupWorkerBridgeServer({
    settings: {
      sdkPackages: {
        tetherWdk: {
          enabled: true,
          seedPhrase: rawSeed
        }
      }
    }
  })
  const response = await server.request('{not-json')
  const json = JSON.stringify(response)

  assert.equal(response.ok, false)
  assert.equal(response.code, 'PEARCUP_WORKER_MESSAGE_ERROR')
  assert.equal(json.includes(rawSeed), false)
  await server.close()
})

test('Pear worker bridge detects known Pear and Bare worker port globals', () => {
  const pearPort = {}
  const barePort = {}

  assert.equal(pearWorker.detectPearCupWorkerPort({ PearCupWorkerPort: pearPort }), pearPort)
  assert.equal(pearWorker.detectPearCupWorkerPort({ Pear: { worker: pearPort } }), pearPort)
  assert.equal(pearWorker.detectPearCupWorkerPort({ Bare: { worker: barePort } }), barePort)
  assert.equal(pearWorker.detectPearCupWorkerPort({}), null)
})

test('Pear worker bridge server can serve optional ultimate sports data-client requests', async () => {
  const delegated = []
  globalThis.PearCupUltimateSportsBridge = {
    handle (request) {
      delegated.push(request)
      return {
        ok: true,
        result: {
          coverage: { apiClientsWithRequestBuilders: 4, apiSourceCount: 4 },
          noClientSecrets: true
        }
      }
    }
  }

  try {
    const server = pearWorker.createPearCupWorkerBridgeServer({ requireLive: false })
    const response = await server.request({
      protocol: pearWorker.protocolVersion,
      requestId: 'worker-ultimate-1',
      action: 'ultimateSports',
      payload: {
        request: {
          protocol: 'ultimate-sports-platform-v1',
          requestId: 'ultimate-client-plan',
          action: 'createSportsDataClientPlan',
          payload: {
            input: {
              env: {}
            }
          }
        }
      }
    })

    assert.equal(response.ok, true)
    assert.equal(response.result.ok, true)
    assert.equal(response.result.result.coverage.apiClientsWithRequestBuilders, response.result.result.coverage.apiSourceCount)
    assert.equal(response.result.result.noClientSecrets, true)

    assert.equal(delegated.length, 1)
    assert.equal(delegated[0].action, 'createSportsDataClientPlan')
    await server.close()
  } finally {
    delete globalThis.PearCupUltimateSportsBridge
  }
})
