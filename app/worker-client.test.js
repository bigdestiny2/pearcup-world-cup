const assert = require('node:assert/strict')
const test = require('node:test')
require('./core.js')
require('./adapters.js')
const { createWorkerSim } = require('./worker-sim.js')
const workerClient = require('./worker-client.js')

test('local worker client preserves synchronous worker shape', async () => {
  const worker = createWorkerSim()
  const client = workerClient.createLocalWorkerClient({ worker })
  const event = client.dispatch({
    type: 'game:submitCommitment',
    actorId: 'user-a',
    payload: {
      gameId: 'pc-client-local',
      roundId: 'round-1',
      playerId: 'user-a',
      commitment: 'commitment-a'
    }
  })
  const asyncEvent = await client.dispatchAsync({
    type: 'game:submitCommitment',
    actorId: 'user-b',
    payload: {
      gameId: 'pc-client-local',
      roundId: 'round-1',
      playerId: 'user-b',
      commitment: 'commitment-b'
    }
  })
  const refresh = await client.refresh()
  const merged = await client.mergeEventsAsync([])

  assert.equal(client.kind, 'local')
  assert.equal(event.type, 'GameCommitmentSubmitted')
  assert.equal(asyncEvent.type, 'GameCommitmentSubmitted')
  assert.equal(merged, 0)
  assert.equal(client.events().length, 2)
  assert.equal(client.view().typeCounts.GameCommitmentSubmitted, 2)
  assert.equal(refresh.events.length, 2)
})

test('bridge worker client sends protocol envelopes and caches redacted snapshots', async () => {
  const calls = []
  const bridge = {
    async request (envelope) {
      calls.push(envelope)
      assert.equal(envelope.protocol, 'pearcup-worker-v1')
      if (envelope.action === 'dispatch') {
        return {
          ok: true,
          result: {
            type: 'GameCommitmentSubmitted',
            eventId: 'evt-bridge-1'
          },
          view: {
            eventRoot: 'root-bridge-1',
            typeCounts: { GameCommitmentSubmitted: 1 },
            adapterMode: { qvac: 'sdk', tetherWdk: 'sdk' }
          },
          status: {
            id: 'pearcup-worker-runtime',
            settlementGate: { status: 'live-ready' },
            guardMode: 'live-only'
          },
          events: [{ eventId: 'evt-bridge-1', type: 'GameCommitmentSubmitted' }]
        }
      }
      if (envelope.action === 'snapshot') {
        return {
          ok: true,
          view: {
            eventRoot: 'root-bridge-1',
            typeCounts: { GameCommitmentSubmitted: 1 }
          },
          events: [{ eventId: 'evt-bridge-1', type: 'GameCommitmentSubmitted' }]
        }
      }
      throw new Error(`Unexpected action ${envelope.action}`)
    }
  }
  const client = workerClient.createBridgeWorkerClient({ bridge })
  const result = await client.dispatchAsync({
    type: 'game:submitCommitment',
    actorId: 'user-a',
    payload: { gameId: 'pc-client-bridge' }
  })
  const snapshot = await client.refresh()

  assert.equal(client.kind, 'bridge')
  assert.equal(result.eventId, 'evt-bridge-1')
  assert.equal(client.view().eventRoot, 'root-bridge-1')
  assert.equal(client.status().settlementGate.status, 'live-ready')
  assert.equal(client.events().length, 1)
  assert.equal(snapshot.view.eventRoot, 'root-bridge-1')
  assert.equal(calls[0].action, 'dispatch')
  assert.equal(calls[0].payload.command.type, 'game:submitCommitment')
  assert.equal(calls[0].payload.includeEvents, undefined)
  assert.equal(calls[1].action, 'snapshot')
  assert.equal(calls[1].payload.includeEvents, true)
})

test('auto worker client prefers detected Pear bridge over local fallback', () => {
  const bridge = async () => ({ ok: true, result: null })
  const client = workerClient.createAutoWorkerClient({
    rootObject: { PearCupWorkerBridge: bridge },
    local: () => {
      throw new Error('local fallback should not be used')
    }
  })

  assert.equal(client.kind, 'bridge')
  assert.equal(workerClient.detectBridge({ Pear: { bridge } }), bridge)
})

test('bridge worker client can call receipt-oriented settlement actions', async () => {
  const calls = []
  const client = workerClient.createBridgeWorkerClient({
    bridge: async envelope => {
      calls.push(envelope)
      return {
        ok: true,
        result: {
          summary: { type: 'TrustedPoolSettlementCompleted' },
          receipt: { receiptHash: 'receipt-hash-bridge' },
          receiptEvent: { type: 'SettlementReceiptCreated', eventId: 'evt-receipt-bridge' }
        },
        view: {
          eventRoot: 'root-receipt-bridge',
          typeCounts: { SettlementReceiptCreated: 1 }
        },
        events: [{ type: 'SettlementReceiptCreated', eventId: 'evt-receipt-bridge' }]
      }
    }
  })

  const result = await client.settleBracketPoolWithReceipt(
    { poolId: 'pool-client-bridge', winnerUserIds: ['user-a'] },
    { actorId: 'settlement-worker' }
  )

  assert.equal(result.summary.type, 'TrustedPoolSettlementCompleted')
  assert.equal(result.receiptEvent.type, 'SettlementReceiptCreated')
  assert.equal(client.view().typeCounts.SettlementReceiptCreated, 1)
  assert.equal(calls[0].action, 'settleBracketPoolWithReceipt')
  assert.equal(calls[0].payload.payload.poolId, 'pool-client-bridge')
  assert.equal(calls[0].payload.opts.actorId, 'settlement-worker')
})

test('bridge worker client exposes settlement gate details on blocked commands', async () => {
  const client = workerClient.createBridgeWorkerClient({
    bridge: async () => ({
      ok: false,
      code: 'PEARCUP_SETTLEMENT_LOCKED',
      error: 'Live settlement is locked',
      status: {
        settlementGate: {
          status: 'demo-locked',
          missing: [{ key: 'qvac', label: 'QVAC referee SDK is not ready' }]
        }
      }
    })
  })

  await assert.rejects(
    client.dispatchAsync({ type: 'wdk:createEntryIntent', payload: {} }),
    err => {
      assert.equal(err.code, 'PEARCUP_SETTLEMENT_LOCKED')
      assert.equal(err.gate.status, 'demo-locked')
      assert.equal(err.response.status.settlementGate.missing[0].key, 'qvac')
      return true
    }
  )
})
