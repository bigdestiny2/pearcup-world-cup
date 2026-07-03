'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { attestation, platform } = require('../src')

function buildResolvedPool () {
  const app = platform.createUltimateSportsPlatform()
  const competition = app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-04T04:00:00.000Z',
    payload: {
      competitionId: 'attest-comp',
      title: 'Attestation Cup',
      templateConfig: { kind: 'single-elimination' },
      entrants: [
        { entrantId: 'red', name: 'Red' },
        { entrantId: 'blue', name: 'Blue' }
      ]
    }
  })
  const pool = app.dispatch({
    type: 'pool:create',
    actorId: 'host',
    occurredAt: '2026-07-04T04:01:00.000Z',
    payload: {
      poolId: 'attest-pool',
      competitionId: 'attest-comp',
      variant: 'classic-bracket',
      mode: 'demo'
    }
  })
  const entry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'alice',
    occurredAt: '2026-07-04T04:02:00.000Z',
    payload: {
      poolId: 'attest-pool',
      userId: 'alice',
      entryType: 'bracket',
      picks: { final: 'red' }
    }
  })
  const lock = app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-04T04:03:00.000Z',
    payload: { entryId: entry.payload.entryId }
  })
  const result = app.dispatch({
    type: 'result:record',
    actorId: 'feed',
    occurredAt: '2026-07-04T04:04:00.000Z',
    payload: {
      competitionId: 'attest-comp',
      results: {
        final: { winnerEntrantId: 'red' }
      }
    }
  })
  const settlement = app.dispatch({
    type: 'pool:resolve',
    actorId: 'system',
    occurredAt: '2026-07-04T04:05:00.000Z',
    payload: {
      poolId: 'attest-pool',
      resultSnapshotId: result.payload.snapshotId
    }
  })
  return { app, competition, pool, lock, result, settlement }
}

test('attestation engine verifies evidence-bound referee records', () => {
  const { result, settlement } = buildResolvedPool()
  const evidenceEvents = [result, settlement]
  const record = attestation.createAttestation({
    lane: 'settlement-referee',
    targetType: 'pool',
    targetId: 'attest-pool',
    evidenceEvents,
    requiredTypes: ['ResultSnapshotRecorded', 'PoolSettlementResolved'],
    assertions: {
      winnerUserIds: ['alice']
    },
    attestorId: 'qvac-demo'
  })
  const verified = attestation.verifyAttestation({
    attestation: record,
    evidenceEvents
  })
  const held = attestation.createAttestation({
    lane: 'settlement-referee',
    targetType: 'pool',
    targetId: 'attest-pool',
    evidenceEvents: [result],
    requiredTypes: ['ResultSnapshotRecorded', 'PoolSettlementResolved']
  })

  assert.equal(record.status, 'verified')
  assert.equal(verified.ok, true)
  assert.equal(held.status, 'held')
  assert.deepEqual(held.missingSourceTypes, ['PoolSettlementResolved'])
})

test('runtime replays QVAC-style attestations and indexes them by target', () => {
  const { app, pool, lock, result, settlement } = buildResolvedPool()
  const event = app.dispatch({
    type: 'attestation:create',
    actorId: 'qvac-referee',
    occurredAt: '2026-07-04T04:06:00.000Z',
    payload: {
      lane: 'settlement-referee',
      targetType: 'pool',
      targetId: 'attest-pool',
      evidenceEventIds: [pool.eventId, lock.eventId, result.eventId, settlement.eventId],
      requiredTypes: ['PoolCreated', 'PredictionEntryLocked', 'ResultSnapshotRecorded', 'PoolSettlementResolved'],
      assertions: {
        winnerUserIds: ['alice'],
        rulesVersion: pool.payload.rules.rulesVersion
      },
      summary: 'Replay evidence supports the demo settlement.'
    }
  })
  const gate = attestation.attestationGate(event.payload)

  assert.equal(event.payload.status, 'verified')
  assert.equal(app.view().attestations[event.payload.attestationId].attestationHash, event.payload.attestationHash)
  assert.deepEqual(app.view().attestationsByTarget['pool:attest-pool'], [event.payload.attestationId])
  assert.equal(gate.ok, true)
  assert.equal(gate.evidenceId, event.payload.attestationId)
})

test('attestation gates can satisfy real-money readiness evidence when attached to policy context', () => {
  const { app, pool, lock, result, settlement } = buildResolvedPool()
  const event = app.dispatch({
    type: 'attestation:create',
    actorId: 'qvac-referee',
    payload: {
      lane: 'settlement-referee',
      targetType: 'pool',
      targetId: 'attest-pool',
      evidenceEventIds: [pool.eventId, lock.eventId, result.eventId, settlement.eventId],
      requiredTypes: ['PoolCreated', 'PredictionEntryLocked', 'ResultSnapshotRecorded', 'PoolSettlementResolved'],
      assertions: { winnerUserIds: ['alice'] }
    }
  })
  const gates = {
    qvacReady: attestation.attestationGate(event.payload),
    wdkReady: { ok: true, evidenceId: 'wdk-ready' },
    kycVerified: { ok: true, evidenceId: 'kyc' },
    ageVerified: { ok: true, evidenceId: 'age' },
    jurisdictionAllowed: { ok: true, evidenceId: 'jurisdiction' },
    responsiblePlayAccepted: { ok: true, evidenceId: 'responsible-play' },
    poolRulesAccepted: { ok: true, evidenceId: pool.eventId },
    paymentCapturedOrEscrowLocked: { ok: true, evidenceId: 'escrow' },
    payoutRouteDeclared: { ok: true, evidenceId: 'payout-route' },
    officialResultSourceReady: { ok: true, evidenceId: result.eventId }
  }
  const cashPlatform = platform.createUltimateSportsPlatform({
    policyContext: {
      allowRealMoney: true,
      gates
    }
  })
  const decision = cashPlatform.evaluateCommand({
    type: 'pool:create',
    actorId: 'host',
    payload: {
      poolId: 'cash-attested',
      competitionId: 'cash-comp',
      title: 'Attested cash pool',
      mode: 'real-money'
    }
  })

  assert.equal(decision.allowed, true)
  assert.equal(decision.readiness.ready, true)
})
