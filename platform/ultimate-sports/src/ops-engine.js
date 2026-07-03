'use strict'

const diagnostics = require('./diagnostics-engine')
const { cloneJson, stableId } = require('./util')

const ATTESTATION_TARGETS = Object.freeze([
  {
    targetType: 'receipt',
    lane: 'settlement-referee',
    requiredTypes: ['SettlementReceiptCreated']
  },
  {
    targetType: 'result-snapshot',
    lane: 'result-verification',
    requiredTypes: ['ResultSnapshotRecorded']
  },
  {
    targetType: 'game',
    lane: 'game-fairness',
    requiredTypes: ['PeerGameSessionResolved']
  },
  {
    targetType: 'market',
    lane: 'result-verification',
    requiredTypes: ['PredictionMarketResolved']
  }
])

function createOpsWorkbench (input = {}) {
  const view = input.view || {}
  const events = input.events || []
  const userId = input.userId || 'operator'
  const transportStatus = input.transportStatus || null
  const loadReport = diagnostics.createPlatformLoadReport({
    view,
    transportStatus,
    checkedAt: input.now || new Date().toISOString()
  })
  const disputes = values(view.disputes).sort(compareUpdated)
  const openDisputes = disputes.filter(dispute => dispute.status !== 'resolved' && dispute.status !== 'cancelled')
  const attestationTargets = createAttestationQueue({ view, events, userId })
  const notificationModel = createNotificationOpsModel({ view, events, userId, now: input.now })

  return {
    opsWorkbenchId: stableId(`ops-workbench-${userId}`, {
      eventRoot: view.eventRoot || null,
      disputeIds: disputes.map(dispute => dispute.disputeId),
      attestationTargets: attestationTargets.map(item => `${item.targetType}:${item.targetId}`),
      notificationCount: Object.keys(view.notifications || {}).length
    }),
    userId,
    generatedAt: input.now || new Date().toISOString(),
    eventRoot: view.eventRoot || null,
    health: createHealthModel({ view, loadReport, transportStatus }),
    launchReadiness: createLaunchReadinessModel({ view }),
    disputes: openDisputes.map(dispute => disputeQueueItem({ dispute, userId })),
    auditBundles: values(view.auditBundles).sort(compareCreated).map(auditBundleSummary),
    attestations: {
      queues: attestationTargets,
      existing: values(view.attestations).sort(compareCreated).map(attestationSummary)
    },
    notifications: notificationModel,
    roomOps: createRoomOpsModel({ view, userId }),
    commandDrafts: {
      generateNotifications: notificationModel.commandDraft,
      exportPlatformAudit: {
        type: 'audit:export',
        actorId: userId,
        payload: {
          targetType: 'platform',
          targetId: view.eventRoot || 'current-root',
          eventIds: events.map(event => event.eventId).filter(Boolean),
          label: 'Platform audit bundle'
        }
      }
    }
  }
}

function createHealthModel ({ view, loadReport, transportStatus }) {
  const transportReport = transportStatus
    ? diagnostics.summarizeTransportStatus(transportStatus)
    : loadReport.transportReport || null
  return {
    level: loadReport.level,
    ok: loadReport.ok,
    eventRoot: view.eventRoot || null,
    pools: loadReport.poolReports.map(report => ({
      poolId: report.poolId,
      level: report.level,
      entryCount: report.entryCount,
      lockedCount: report.lockedCount,
      settlementReady: report.settlementReady
    })),
    rooms: loadReport.roomReports.map(report => ({
      roomId: report.roomId,
      level: report.level,
      activeParticipantCount: report.activeParticipantCount,
      messageCount: report.messageCount,
      marketCount: report.marketCount,
      readabilityScore: report.readabilityScore
    })),
    transport: transportReport
      ? {
          level: transportReport.level,
          topicCount: transportReport.topicCount,
          peerCount: transportReport.peerCount,
          orphanTopics: cloneJson(transportReport.orphanTopics || [])
        }
      : null
  }
}

function createLaunchReadinessModel ({ view }) {
  const creatorDrafts = values(view.creatorCompetitionDrafts)
  const publishPlans = values(view.creatorPublishPlans)
  const competitions = values(view.competitions)
  const pools = values(view.pools)
  const rooms = values(view.rooms)
  const readinessPanels = values(view.readinessPanels)
  const missing = []
  if (competitions.length === 0) missing.push('create-competition')
  if (pools.length === 0) missing.push('create-pools')
  if (rooms.length === 0) missing.push('create-watch-room')
  if (creatorDrafts.some(draft => (draft.entrants || []).length >= 2 && (draft.fixtures || []).length === 0)) {
    missing.push('seed-ready-creator-drafts')
  }
  if (pools.some(pool => pool.mode === 'real-money') && readinessPanels.every(panel => panel.ready !== true)) {
    missing.push('complete-real-money-readiness')
  }

  return {
    ready: missing.length === 0,
    missing,
    counts: {
      creatorDrafts: creatorDrafts.length,
      publishPlans: publishPlans.length,
      competitions: competitions.length,
      openCompetitions: competitions.filter(competition => competition.status === 'open').length,
      pools: pools.length,
      rooms: rooms.length,
      readinessPanels: readinessPanels.length,
      readyReadinessPanels: readinessPanels.filter(panel => panel.ready === true).length
    },
    riskyPools: pools
      .filter(pool => pool.mode === 'real-money' || pool.mode === 'sponsor-prize')
      .map(pool => ({
        poolId: pool.poolId,
        mode: pool.mode,
        title: pool.title
      }))
  }
}

function disputeQueueItem ({ dispute, userId }) {
  return {
    disputeId: dispute.disputeId,
    targetType: dispute.targetType,
    targetId: dispute.targetId,
    status: dispute.status,
    openedByUserId: dispute.openedByUserId,
    reason: dispute.reason,
    evidenceEventIds: cloneJson(dispute.evidenceEventIds || []),
    historyCount: (dispute.history || []).length,
    commandDrafts: {
      respond: dispute.status === 'open'
        ? {
            type: 'dispute:respond',
            actorId: userId,
            payload: {
              disputeId: dispute.disputeId,
              response: 'Operator response',
              evidenceEventIds: cloneJson(dispute.evidenceEventIds || [])
            }
          }
        : null,
      resolve: dispute.status === 'open' || dispute.status === 'responded'
        ? {
            type: 'dispute:resolve',
            actorId: userId,
            payload: {
              disputeId: dispute.disputeId,
              resolution: 'upheld',
              note: 'Operator resolution',
              evidenceEventIds: cloneJson(dispute.evidenceEventIds || [])
            }
          }
        : null,
      exportAudit: {
        type: 'audit:export',
        actorId: userId,
        payload: {
          targetType: dispute.targetType,
          targetId: dispute.targetId,
          disputeId: dispute.disputeId,
          label: `Audit for dispute ${dispute.disputeId}`,
          includePayloads: false
        }
      }
    }
  }
}

function createAttestationQueue ({ view, events, userId }) {
  return ATTESTATION_TARGETS.flatMap(config => {
    return targetsForAttestation(view, config.targetType).map(target => {
      const targetKey = `${config.targetType}:${target.targetId}`
      const existingIds = view.attestationsByTarget && view.attestationsByTarget[targetKey] || []
      const existing = existingIds.map(attestationId => view.attestations[attestationId]).filter(Boolean)
      const verified = existing.some(attestation => attestation.status === 'verified')
      const evidenceEventIds = eventsForTarget(events, config.targetType, target.targetId)
        .map(event => event.eventId)
        .filter(Boolean)
      return {
        targetType: config.targetType,
        targetId: target.targetId,
        lane: config.lane,
        title: target.title || target.targetId,
        status: verified ? 'verified' : evidenceEventIds.length ? 'ready' : 'needs-evidence',
        existingAttestationIds: existing.map(attestation => attestation.attestationId),
        evidenceEventIds,
        requiredTypes: cloneJson(config.requiredTypes),
        commandDraft: verified
          ? null
          : {
              type: 'attestation:create',
              actorId: userId,
              payload: {
                lane: config.lane,
                targetType: config.targetType,
                targetId: target.targetId,
                evidenceEventIds,
                requiredTypes: cloneJson(config.requiredTypes),
                assertions: {
                  platformRoot: view.eventRoot || null
                },
                summary: `Attest ${config.targetType} ${target.targetId}`
              }
            }
      }
    })
  })
}

function targetsForAttestation (view, targetType) {
  if (targetType === 'receipt') {
    return values(view.settlementReceipts)
      .filter(receipt => receipt.status === 'complete')
      .map(receipt => ({
        targetId: receipt.receiptId,
        title: `Receipt ${receipt.receiptId}`
      }))
  }
  if (targetType === 'result-snapshot') {
    return values(view.resultSnapshots).map(snapshot => ({
      targetId: snapshot.snapshotId,
      title: `Result ${snapshot.competitionId}`
    }))
  }
  if (targetType === 'game') {
    return values(view.gameResolutions).map(result => ({
      targetId: result.gameId,
      title: `Game ${result.gameId}`
    }))
  }
  if (targetType === 'market') {
    return values(view.marketResolutions).map(result => ({
      targetId: result.market && result.market.marketId || result.marketId,
      title: `Market ${result.market && result.market.marketId || result.marketId}`
    }))
  }
  return []
}

function createNotificationOpsModel ({ view, events, userId, now }) {
  const inboxSummaries = Object.values(view.notificationInboxSummaries || {})
    .sort((left, right) => String(left.userId || '').localeCompare(String(right.userId || '')))
  const unreadTotal = inboxSummaries.reduce((sum, inbox) => sum + Number(inbox.unread || 0), 0)
  const recent = values(view.notifications)
    .sort(compareCreated)
    .slice(0, 10)
    .map(notification => ({
      notificationId: notification.notificationId,
      userId: notification.userId,
      type: notification.type,
      status: notification.status,
      targetType: notification.targetType,
      targetId: notification.targetId,
      createdAt: notification.createdAt || null
    }))
  return {
    total: Object.keys(view.notifications || {}).length,
    unreadTotal,
    inboxSummaries: inboxSummaries.map(inbox => ({
      userId: inbox.userId,
      total: inbox.total,
      unread: inbox.unread,
      byType: cloneJson(inbox.byType || {})
    })),
    recent,
    commandDraft: {
      type: 'notification:generate',
      actorId: userId,
      payload: {
        audienceUserIds: audienceFromView(view),
        horizonMinutes: 60,
        now: now || new Date().toISOString(),
        sourceEventCount: events.length
      }
    }
  }
}

function createRoomOpsModel ({ view, userId }) {
  return values(view.rooms)
    .sort((left, right) => String(left.title || left.roomId).localeCompare(String(right.title || right.roomId)))
    .map(room => {
      const participantCount = Object.values(view.roomParticipants && view.roomParticipants[room.roomId] || {})
        .filter(participant => participant.status !== 'left').length
      const latestSummary = values(view.qvacRoomSummaries)
        .filter(record => record.targetId === room.roomId)
        .sort(compareCreated)[0] || null
      return {
        roomId: room.roomId,
        title: room.title,
        status: room.status,
        participantCount,
        latestSummaryId: latestSummary && latestSummary.qvacRecordId || null,
        commandDrafts: {
          summarizeRoom: {
            type: 'qvac:summarizeRoom',
            actorId: userId,
            payload: {
              roomId: room.roomId
            }
          },
          generateLockReminders: {
            type: 'notification:generate',
            actorId: userId,
            payload: {
              audienceUserIds: audienceFromRoom(view, room.roomId),
              horizonMinutes: 60
            }
          }
        }
      }
    })
}

function auditBundleSummary (bundle) {
  return {
    auditBundleId: bundle.auditBundleId,
    targetType: bundle.targetType,
    targetId: bundle.targetId,
    disputeId: bundle.disputeId || null,
    eventCount: bundle.eventCount,
    eventRoot: bundle.eventRoot,
    auditHash: bundle.auditHash,
    createdAt: bundle.createdAt || null
  }
}

function attestationSummary (attestation) {
  return {
    attestationId: attestation.attestationId,
    lane: attestation.lane,
    targetType: attestation.targetType,
    targetId: attestation.targetId,
    status: attestation.status,
    confidence: attestation.confidence,
    evidenceEventIds: cloneJson(attestation.evidenceEventIds || []),
    missingSourceTypes: cloneJson(attestation.missingSourceTypes || []),
    createdAt: attestation.createdAt || null
  }
}

function audienceFromView (view) {
  return [...new Set([
    ...Object.keys(view.profiles || {}),
    ...Object.values(view.predictionEntries || {}).map(entry => entry.userId),
    ...Object.values(view.roomParticipants || {}).flatMap(participants => Object.keys(participants || {})),
    ...Object.values(view.walletAccounts || {}).map(account => account.userId)
  ].filter(Boolean))].sort()
}

function audienceFromRoom (view, roomId) {
  return Object.values(view.roomParticipants && view.roomParticipants[roomId] || {})
    .filter(participant => participant.status !== 'left')
    .map(participant => participant.userId)
    .filter(Boolean)
    .sort()
}

function eventsForTarget (events = [], targetType, targetId) {
  return events.filter(event => eventTouchesTarget(event, targetType, targetId))
}

function eventTouchesTarget (event = {}, targetType, targetId) {
  const payload = event.payload || {}
  if (targetType === 'receipt') return payload.receiptId === targetId
  if (targetType === 'result-snapshot') return payload.snapshotId === targetId || payload.resultSnapshotId === targetId
  if (targetType === 'game') return payload.gameId === targetId
  if (targetType === 'market') {
    return payload.marketId === targetId ||
      payload.market && payload.market.marketId === targetId ||
      Array.isArray(payload.marketIds) && payload.marketIds.includes(targetId)
  }
  if (targetType === 'pool') return payload.poolId === targetId
  if (targetType === 'room-message') return payload.messageId === targetId
  return false
}

function compareUpdated (left, right) {
  return String(lastHistoryAt(right) || right.openedAt || '').localeCompare(String(lastHistoryAt(left) || left.openedAt || ''))
}

function compareCreated (left, right) {
  return String(right.createdAt || right.generatedAt || '').localeCompare(String(left.createdAt || left.generatedAt || ''))
}

function lastHistoryAt (item = {}) {
  const history = item.history || []
  return history.length ? history[history.length - 1].at : null
}

function values (collection = {}) {
  return Object.values(collection || {})
}

module.exports = {
  ATTESTATION_TARGETS,
  createOpsWorkbench,
  createHealthModel,
  createLaunchReadinessModel,
  createAttestationQueue,
  createNotificationOpsModel,
  createRoomOpsModel,
  eventsForTarget,
  eventTouchesTarget
}
