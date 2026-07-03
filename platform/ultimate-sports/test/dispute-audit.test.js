'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { dispute, platform } = require('../src')

function buildReceiptPlatform () {
  const app = platform.createUltimateSportsPlatform()
  app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-04T03:00:00.000Z',
    payload: {
      competitionId: 'dispute-comp',
      title: 'Dispute Cup',
      templateConfig: { kind: 'single-elimination' },
      entrants: [
        { entrantId: 'red', name: 'Red' },
        { entrantId: 'blue', name: 'Blue' }
      ]
    }
  })
  const poolEvent = app.dispatch({
    type: 'pool:create',
    actorId: 'host',
    occurredAt: '2026-07-04T03:01:00.000Z',
    payload: {
      poolId: 'dispute-pool',
      competitionId: 'dispute-comp',
      variant: 'classic-bracket',
      mode: 'demo'
    }
  })
  const entry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'alice',
    occurredAt: '2026-07-04T03:02:00.000Z',
    payload: {
      poolId: 'dispute-pool',
      userId: 'alice',
      entryType: 'bracket',
      picks: { final: 'red' }
    }
  })
  const locked = app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-04T03:03:00.000Z',
    payload: { entryId: entry.payload.entryId }
  })
  const result = app.dispatch({
    type: 'result:record',
    actorId: 'feed',
    occurredAt: '2026-07-04T03:04:00.000Z',
    payload: {
      competitionId: 'dispute-comp',
      results: {
        final: { winnerEntrantId: 'red' }
      }
    }
  })
  const settlement = app.dispatch({
    type: 'pool:resolve',
    actorId: 'system',
    occurredAt: '2026-07-04T03:05:00.000Z',
    payload: {
      poolId: 'dispute-pool',
      resultSnapshotId: result.payload.snapshotId
    }
  })
  const plan = app.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    occurredAt: '2026-07-04T03:06:00.000Z',
    payload: {
      poolId: 'dispute-pool',
      rulesVersion: poolEvent.payload.rules.rulesVersion,
      resultSnapshotId: result.payload.snapshotId,
      mode: 'demo',
      sourceEventIds: [poolEvent.eventId, locked.eventId, result.eventId, settlement.eventId]
    }
  })
  const receipt = app.dispatch({
    type: 'settlement:receipt',
    actorId: 'system',
    occurredAt: '2026-07-04T03:07:00.000Z',
    payload: {
      settlementPlanId: plan.payload.settlementPlanId,
      requiredTypes: ['PoolCreated', 'PredictionEntryLocked', 'ResultSnapshotRecorded', 'PoolSettlementResolved']
    }
  })

  return { app, receipt, result }
}

test('dispute engine creates open, responded, resolved, and audit records', () => {
  const opened = dispute.openDispute({
    targetType: 'receipt',
    targetId: 'receipt-1',
    openedByUserId: 'alice',
    reason: 'winner looks wrong',
    evidenceEventIds: ['event-1']
  })
  const responded = dispute.respondToDispute({
    dispute: opened,
    responderUserId: 'host',
    response: 'checked feed source',
    evidenceEventIds: ['event-2']
  })
  const resolved = dispute.resolveDispute({
    dispute: responded,
    resolvedByUserId: 'moderator',
    resolution: 'rejected',
    note: 'receipt evidence is complete'
  })
  const audit = dispute.createAuditBundle({
    targetType: 'receipt',
    targetId: 'receipt-1',
    events: [
      { eventId: 'event-1', type: 'A', actorId: 'alice', occurredAt: 't1', payloadHash: 'h1', previousHash: '0', eventHash: 'e1' }
    ],
    dispute: resolved
  })

  assert.equal(opened.status, 'open')
  assert.equal(responded.status, 'responded')
  assert.equal(resolved.status, 'resolved')
  assert.equal(resolved.resolution, 'rejected')
  assert.equal(audit.dispute.disputeId, opened.disputeId)
  assert.equal(typeof audit.auditHash, 'string')
})

test('runtime replays settlement receipt disputes and compact audit exports', () => {
  const { app, receipt, result } = buildReceiptPlatform()

  assert.throws(() => app.dispatch({
    type: 'dispute:open',
    actorId: 'alice',
    payload: {
      targetType: 'receipt',
      targetId: 'missing-receipt',
      reason: 'no target'
    }
  }), /dispute target not found/)

  const opened = app.dispatch({
    type: 'dispute:open',
    actorId: 'alice',
    occurredAt: '2026-07-04T03:08:00.000Z',
    payload: {
      targetType: 'receipt',
      targetId: receipt.payload.receiptId,
      reason: 'I want source proof',
      evidenceEventIds: [receipt.eventId, result.eventId]
    }
  })
  app.dispatch({
    type: 'dispute:respond',
    actorId: 'host',
    occurredAt: '2026-07-04T03:09:00.000Z',
    payload: {
      disputeId: opened.payload.disputeId,
      response: 'Source events are bound in the receipt.',
      evidenceEventIds: [receipt.eventId]
    }
  })
  const resolved = app.dispatch({
    type: 'dispute:resolve',
    actorId: 'moderator',
    occurredAt: '2026-07-04T03:10:00.000Z',
    payload: {
      disputeId: opened.payload.disputeId,
      resolution: 'rejected',
      note: 'Receipt has required replay evidence.'
    }
  })
  const audit = app.dispatch({
    type: 'audit:export',
    actorId: 'moderator',
    occurredAt: '2026-07-04T03:11:00.000Z',
    payload: {
      targetType: 'receipt',
      targetId: receipt.payload.receiptId,
      disputeId: opened.payload.disputeId,
      label: 'Receipt dispute audit'
    }
  })

  const view = app.view()
  assert.equal(resolved.payload.status, 'resolved')
  assert.equal(view.disputes[opened.payload.disputeId].resolution, 'rejected')
  assert.deepEqual(view.disputesByTarget[`receipt:${receipt.payload.receiptId}`], [opened.payload.disputeId])
  assert.equal(audit.payload.disputeId, opened.payload.disputeId)
  assert.equal(audit.payload.events.some(event => event.type === 'SettlementReceiptCreated'), true)
  assert.equal(view.auditBundles[audit.payload.auditBundleId].targetId, receipt.payload.receiptId)
})
