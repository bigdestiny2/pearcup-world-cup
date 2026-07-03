'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { ops, platform } = require('../src')

function setupOpsApp () {
  const app = platform.createUltimateSportsPlatform({ peerId: 'operator' })
  app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T22:00:00.000Z',
    payload: {
      competitionId: 'ops-cup',
      title: 'Ops Cup',
      templateConfig: { kind: 'single-elimination' },
      entrants: [
        { entrantId: 'alpha', name: 'Alpha' },
        { entrantId: 'beta', name: 'Beta' }
      ]
    }
  })
  const poolEvent = app.dispatch({
    type: 'pool:create',
    actorId: 'host',
    occurredAt: '2026-07-03T22:01:00.000Z',
    payload: {
      poolId: 'ops-pool',
      competitionId: 'ops-cup',
      title: 'Ops Pool',
      variant: 'classic-bracket',
      mode: 'demo'
    }
  })
  const entry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'winner',
    occurredAt: '2026-07-03T22:02:00.000Z',
    payload: {
      poolId: 'ops-pool',
      userId: 'winner',
      entryType: 'bracket',
      picks: { final: 'alpha' }
    }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T22:03:00.000Z',
    payload: { entryId: entry.payload.entryId }
  })
  const result = app.dispatch({
    type: 'result:record',
    actorId: 'feed',
    occurredAt: '2026-07-03T22:04:00.000Z',
    payload: {
      competitionId: 'ops-cup',
      results: {
        final: { winnerEntrantId: 'alpha', roundNumber: 1 }
      }
    }
  })
  app.dispatch({
    type: 'pool:resolve',
    actorId: 'system',
    occurredAt: '2026-07-03T22:05:00.000Z',
    payload: {
      poolId: 'ops-pool',
      resultSnapshotId: result.payload.snapshotId
    }
  })
  const plan = app.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    occurredAt: '2026-07-03T22:06:00.000Z',
    payload: {
      poolId: 'ops-pool',
      rulesVersion: poolEvent.payload.rules.rulesVersion,
      resultSnapshotId: result.payload.snapshotId,
      mode: 'demo'
    }
  })
  const receipt = app.dispatch({
    type: 'settlement:receipt',
    actorId: 'system',
    occurredAt: '2026-07-03T22:07:00.000Z',
    payload: {
      settlementPlanId: plan.payload.settlementPlanId
    }
  })
  app.dispatch({
    type: 'room:create',
    actorId: 'host',
    occurredAt: '2026-07-03T22:08:00.000Z',
    payload: {
      roomId: 'ops-room',
      competitionId: 'ops-cup',
      title: 'Ops Watch',
      hostUserId: 'host',
      status: 'live'
    }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'host',
    occurredAt: '2026-07-03T22:09:00.000Z',
    payload: { roomId: 'ops-room', userId: 'host', username: 'Host', role: 'host' }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'winner',
    occurredAt: '2026-07-03T22:10:00.000Z',
    payload: { roomId: 'ops-room', userId: 'winner', username: 'Winner' }
  })
  app.joinTopic({ kind: 'competition', id: 'ops-cup' })
  app.syncTopic({ kind: 'competition', id: 'ops-cup' })
  const dispute = app.dispatch({
    type: 'dispute:open',
    actorId: 'winner',
    occurredAt: '2026-07-03T22:11:00.000Z',
    payload: {
      targetType: 'receipt',
      targetId: receipt.payload.receiptId,
      reason: 'Need operator review',
      evidenceEventIds: [receipt.eventId]
    }
  })

  return { app, receipt, dispute, result }
}

test('ops workbench exposes health, launch readiness, disputes, and audit commands', () => {
  const { app, receipt, dispute } = setupOpsApp()
  const workbench = app.createOpsWorkbench({ userId: 'operator' })
  const auditEvent = app.dispatch(workbench.disputes[0].commandDrafts.exportAudit)
  app.dispatch(workbench.disputes[0].commandDrafts.respond)
  const responded = app.createOpsWorkbench({ userId: 'operator' })
  const resolvedEvent = app.dispatch(responded.disputes[0].commandDrafts.resolve)
  const afterResolution = app.createOpsWorkbench({ userId: 'operator' })

  assert.equal(workbench.health.ok, true)
  assert.equal(workbench.health.pools[0].settlementReady, true)
  assert.equal(workbench.launchReadiness.ready, true)
  assert.equal(workbench.disputes[0].disputeId, dispute.payload.disputeId)
  assert.equal(workbench.disputes[0].commandDrafts.exportAudit.type, 'audit:export')
  assert.equal(auditEvent.payload.targetId, receipt.payload.receiptId)
  assert.equal(responded.disputes[0].status, 'responded')
  assert.equal(resolvedEvent.payload.status, 'resolved')
  assert.equal(afterResolution.disputes.length, 0)
  assert.equal(afterResolution.auditBundles[0].disputeId, dispute.payload.disputeId)
})

test('ops workbench creates attestations, notifications, and room summaries', () => {
  const { app, receipt, result } = setupOpsApp()
  const workbench = app.createOpsWorkbench({ userId: 'operator' })
  const receiptAttestation = workbench.attestations.queues.find(item => item.targetType === 'receipt')
  const resultAttestation = workbench.attestations.queues.find(item => item.targetType === 'result-snapshot')
  const attestationEvent = app.dispatch(receiptAttestation.commandDraft)
  const notificationBatch = app.dispatch(workbench.notifications.commandDraft)
  const roomSummary = app.dispatch(workbench.roomOps[0].commandDrafts.summarizeRoom)
  const surfaceOps = app.createSurface('ops', { userId: 'operator' })
  const direct = ops.createOpsWorkbench({
    view: app.view(),
    events: app.events(),
    userId: 'operator',
    transportStatus: app.bus.status()
  })

  assert.equal(receiptAttestation.targetId, receipt.payload.receiptId)
  assert.equal(receiptAttestation.status, 'ready')
  assert.equal(resultAttestation.targetId, result.payload.snapshotId)
  assert.equal(attestationEvent.payload.status, 'verified')
  assert.equal(notificationBatch.payload.notifications.length > 0, true)
  assert.equal(roomSummary.payload.targetId, 'ops-room')
  assert.equal(surfaceOps.surfaceId, 'ops')
  assert.equal(surfaceOps.workbench.attestations.existing.length, 1)
  assert.equal(direct.health.transport.topicCount, 1)
})
