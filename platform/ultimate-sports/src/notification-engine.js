'use strict'

const { assertAllowed, assertNonEmptyString, cloneJson, stableId } = require('./util')

const NOTIFICATION_TYPES = Object.freeze([
  'lock-reminder',
  'challenge-received',
  'challenge-accepted',
  'result-ready',
  'live-result',
  'settlement-receipt',
  'reward-granted',
  'payout-update',
  'dispute-update',
  'system'
])

const NOTIFICATION_STATUSES = Object.freeze([
  'unread',
  'read',
  'dismissed',
  'archived'
])

const NOTIFICATION_CHANNELS = Object.freeze([
  'in-app',
  'push',
  'email',
  'share-card'
])

function createNotification (input = {}) {
  assertNonEmptyString(input.userId, 'userId')
  const type = input.type || 'system'
  assertAllowed(type, NOTIFICATION_TYPES, 'notification type')
  const status = input.status || 'unread'
  assertAllowed(status, NOTIFICATION_STATUSES, 'notification status')
  const channels = (input.channels && input.channels.length ? input.channels : ['in-app'])
    .map(channel => {
      assertAllowed(channel, NOTIFICATION_CHANNELS, 'notification channel')
      return channel
    })
  const createdAt = input.createdAt || new Date().toISOString()
  const dedupeKey = input.dedupeKey || notificationDedupeKey({
    userId: input.userId,
    type,
    sourceEventId: input.sourceEventId || null,
    targetType: input.targetType || null,
    targetId: input.targetId || null,
    scheduleKey: input.scheduleKey || null
  })
  const body = {
    userId: input.userId,
    type,
    title: input.title || defaultTitleForType(type),
    body: input.body || null,
    status,
    severity: input.severity || 'info',
    channels,
    targetType: input.targetType || null,
    targetId: input.targetId || null,
    sourceEventId: input.sourceEventId || null,
    dedupeKey,
    metadata: cloneJson(input.metadata || {}),
    createdAt,
    readAt: input.readAt || null,
    dismissedAt: input.dismissedAt || null
  }

  return {
    notificationId: input.notificationId || stableId(`notification-${dedupeKey}`, body),
    ...body
  }
}

function updateNotificationStatus (notification, update = {}) {
  if (!notification || typeof notification !== 'object') throw new TypeError('notification is required')
  const status = update.status || notification.status
  assertAllowed(status, NOTIFICATION_STATUSES, 'notification status')
  const updatedAt = update.updatedAt || new Date().toISOString()
  return {
    notificationId: notification.notificationId,
    userId: notification.userId,
    previousStatus: notification.status,
    status,
    readAt: status === 'read' ? update.readAt || updatedAt : notification.readAt || null,
    dismissedAt: status === 'dismissed' ? update.dismissedAt || updatedAt : notification.dismissedAt || null,
    archivedAt: status === 'archived' ? update.archivedAt || updatedAt : notification.archivedAt || null,
    updatedAt
  }
}

function applyNotificationStatusUpdate (notification, update = {}) {
  if (!notification || typeof notification !== 'object') throw new TypeError('notification is required')
  return {
    ...notification,
    status: update.status || notification.status,
    readAt: Object.prototype.hasOwnProperty.call(update, 'readAt') ? update.readAt : notification.readAt,
    dismissedAt: Object.prototype.hasOwnProperty.call(update, 'dismissedAt') ? update.dismissedAt : notification.dismissedAt,
    archivedAt: Object.prototype.hasOwnProperty.call(update, 'archivedAt') ? update.archivedAt : notification.archivedAt,
    updatedAt: update.updatedAt || notification.updatedAt || null
  }
}

function createNotificationBatch (input = {}) {
  const now = input.now || input.createdAt || new Date().toISOString()
  const eventNotifications = deriveEventNotifications({
    events: input.events || [],
    createdAt: now
  })
  const scheduleNotifications = createLockReminderNotifications({
    view: input.view || {},
    now,
    horizonMinutes: input.horizonMinutes == null ? 60 : input.horizonMinutes,
    audienceUserIds: input.audienceUserIds || []
  })
  const existingKeys = new Set(Object.values(input.existingNotifications || {})
    .map(notification => notification.dedupeKey)
    .filter(Boolean))
  const seen = new Set(existingKeys)
  const notifications = []

  eventNotifications.concat(scheduleNotifications).forEach(item => {
    if (seen.has(item.dedupeKey)) return
    seen.add(item.dedupeKey)
    notifications.push(item)
  })

  return {
    notificationBatchId: input.notificationBatchId || stableId('notification-batch', {
      eventRoot: input.eventRoot || null,
      now,
      horizonMinutes: input.horizonMinutes == null ? 60 : input.horizonMinutes,
      notificationKeys: notifications.map(notification => notification.dedupeKey)
    }),
    generatedAt: now,
    eventRoot: input.eventRoot || null,
    horizonMinutes: input.horizonMinutes == null ? 60 : input.horizonMinutes,
    notifications
  }
}

function deriveEventNotifications ({ events = [], createdAt = new Date().toISOString() } = {}) {
  const notifications = []
  events.forEach(event => {
    if (!event || !event.type || event.type.startsWith('Notification')) return
    const payload = event.payload || {}
    if (event.type === 'RoomChallengeCreated') {
      pushNotification(notifications, {
        userId: payload.targetUserId,
        type: 'challenge-received',
        title: 'New challenge',
        body: `${payload.challengerUserId || 'A peer'} challenged you`,
        targetType: 'room-challenge',
        targetId: payload.challengeId,
        sourceEventId: event.eventId,
        metadata: {
          roomId: payload.roomId,
          challengeType: payload.challengeType,
          challengerUserId: payload.challengerUserId
        },
        createdAt
      })
    }
    if (event.type === 'RoomChallengeAccepted') {
      pushNotification(notifications, {
        userId: payload.challengerUserId,
        type: 'challenge-accepted',
        title: 'Challenge accepted',
        body: `${payload.acceptedByUserId || 'Your opponent'} accepted`,
        targetType: 'room-challenge',
        targetId: payload.challengeId,
        sourceEventId: event.eventId,
        metadata: {
          roomId: payload.roomId,
          challengeType: payload.challengeType,
          acceptedByUserId: payload.acceptedByUserId
        },
        createdAt
      })
    }
    if (event.type === 'PoolSettlementResolved') {
      ;(payload.winnerUserIds || []).forEach(userId => pushNotification(notifications, {
        userId,
        type: 'result-ready',
        title: 'Pool result ready',
        body: `You won ${payload.poolId || 'a pool'}`,
        targetType: 'pool',
        targetId: payload.poolId,
        sourceEventId: event.eventId,
        metadata: {
          winningScore: payload.winningScore,
          tied: payload.tied === true
        },
        createdAt
      }))
    }
    if (event.type === 'PredictionMarketResolved') {
      ;(payload.winnerUserIds || []).forEach(userId => pushNotification(notifications, {
        userId,
        type: 'live-result',
        title: 'Live prediction hit',
        body: 'Your live prediction resolved as a winner',
        targetType: 'market',
        targetId: payload.market && payload.market.marketId || payload.marketId,
        sourceEventId: event.eventId,
        metadata: {
          result: payload.result
        },
        createdAt
      }))
    }
    if (event.type === 'SettlementReceiptCreated' && payload.status === 'complete') {
      ;(payload.body && payload.body.winnerUserIds || []).forEach(userId => pushNotification(notifications, {
        userId,
        type: 'settlement-receipt',
        title: 'Settlement receipt ready',
        body: 'Your result has a replayable receipt',
        targetType: 'receipt',
        targetId: payload.receiptId,
        sourceEventId: event.eventId,
        metadata: {
          receiptHash: payload.receiptHash,
          targetType: payload.body && payload.body.targetType,
          targetId: payload.body && payload.body.targetId
        },
        createdAt
      }))
    }
    if (event.type === 'WalletRewardsGranted') {
      ;(payload.entries || []).forEach(entry => pushNotification(notifications, {
        userId: entry.userId,
        type: 'reward-granted',
        title: 'Reward granted',
        body: `${entry.amount || 0} ${entry.currency || 'credits'} added`,
        targetType: 'wallet-grant',
        targetId: payload.grantId,
        sourceEventId: event.eventId,
        metadata: {
          accountId: entry.accountId,
          receiptId: payload.receiptId,
          amount: entry.amount,
          currency: entry.currency
        },
        createdAt
      }))
    }
    if (event.type === 'SponsorPrizeFulfillmentCreated' || event.type === 'SponsorPrizeFulfillmentUpdated') {
      pushNotification(notifications, {
        userId: payload.winnerUserId,
        type: 'payout-update',
        title: 'Prize update',
        body: `Sponsor prize is ${payload.status || 'updated'}`,
        targetType: 'sponsor-fulfillment',
        targetId: payload.fulfillmentId,
        sourceEventId: event.eventId,
        metadata: {
          receiptId: payload.receiptId,
          sponsorId: payload.sponsorId,
          status: payload.status
        },
        createdAt
      })
    }
    if (event.type === 'DisputeOpened' || event.type === 'DisputeResponded' || event.type === 'DisputeResolved') {
      pushNotification(notifications, {
        userId: payload.openedByUserId || payload.responderUserId || payload.resolvedByUserId,
        type: 'dispute-update',
        title: 'Dispute update',
        body: `Dispute ${payload.status || 'updated'}`,
        targetType: 'dispute',
        targetId: payload.disputeId,
        sourceEventId: event.eventId,
        metadata: {
          targetType: payload.targetType,
          targetId: payload.targetId
        },
        createdAt
      })
    }
  })
  return notifications
}

function createLockReminderNotifications ({ view = {}, now = new Date().toISOString(), horizonMinutes = 60, audienceUserIds = [] } = {}) {
  const notifications = []
  const nowMs = Date.parse(now)
  const horizonMs = nowMs + Number(horizonMinutes) * 60 * 1000
  if (!Number.isFinite(nowMs) || !Number.isFinite(horizonMs)) return notifications

  Object.values(view.pools || {}).forEach(pool => {
    if (!pool.entryCloseAt || !withinWindow(pool.entryCloseAt, nowMs, horizonMs)) return
    audienceForPool(view, pool, audienceUserIds).forEach(userId => pushNotification(notifications, {
      userId,
      type: 'lock-reminder',
      title: 'Pool locks soon',
      body: `${pool.title || pool.poolId} locks soon`,
      targetType: 'pool',
      targetId: pool.poolId,
      scheduleKey: `pool-lock:${pool.poolId}:${pool.entryCloseAt}`,
      metadata: {
        locksAt: pool.entryCloseAt,
        competitionId: pool.competitionId
      },
      createdAt: now
    }))
  })

  Object.values(view.markets || {}).forEach(market => {
    if (!market.locksAt || !withinWindow(market.locksAt, nowMs, horizonMs)) return
    audienceForMarket(view, market, audienceUserIds).forEach(userId => pushNotification(notifications, {
      userId,
      type: 'lock-reminder',
      title: 'Live prediction locks soon',
      body: `${market.marketType || 'Market'} locks soon`,
      targetType: 'market',
      targetId: market.marketId,
      scheduleKey: `market-lock:${market.marketId}:${market.locksAt}`,
      metadata: {
        locksAt: market.locksAt,
        roomId: market.roomId,
        competitionId: market.competitionId
      },
      createdAt: now
    }))
  })

  return notifications
}

function summarizeNotificationInbox (notifications = {}, userId) {
  const list = Object.values(notifications || {})
    .filter(notification => !userId || notification.userId === userId)
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
  const byType = {}
  list.forEach(notification => {
    byType[notification.type] = (byType[notification.type] || 0) + 1
  })
  return {
    userId: userId || null,
    total: list.length,
    unread: list.filter(notification => notification.status === 'unread').length,
    byType,
    latest: list[0] || null
  }
}

function indexNotificationsByUser (notifications = {}) {
  const byUser = {}
  Object.values(notifications || {}).forEach(notification => {
    if (!byUser[notification.userId]) byUser[notification.userId] = []
    byUser[notification.userId].push(notification.notificationId)
  })
  Object.keys(byUser).forEach(userId => {
    byUser[userId].sort()
  })
  return byUser
}

function notificationDedupeKey ({ userId, type, sourceEventId = null, targetType = null, targetId = null, scheduleKey = null } = {}) {
  return [
    userId,
    type,
    sourceEventId || scheduleKey || `${targetType || 'target'}:${targetId || 'none'}`
  ].join(':')
}

function pushNotification (notifications, input) {
  if (!input.userId) return
  notifications.push(createNotification(input))
}

function audienceForPool (view, pool, fallbackUserIds = []) {
  const userIds = new Set(fallbackUserIds)
  Object.values(view.predictionEntries || {})
    .filter(entry => entry.poolId === pool.poolId)
    .forEach(entry => userIds.add(entry.userId))
  return [...userIds].filter(Boolean).sort()
}

function audienceForMarket (view, market, fallbackUserIds = []) {
  const userIds = new Set(fallbackUserIds)
  Object.values(view.watchPredictions || {})
    .filter(prediction => prediction.marketId === market.marketId)
    .forEach(prediction => userIds.add(prediction.userId))
  const participants = market.roomId && view.roomParticipants && view.roomParticipants[market.roomId] || {}
  Object.values(participants)
    .filter(participant => participant.status !== 'left')
    .forEach(participant => userIds.add(participant.userId))
  return [...userIds].filter(Boolean).sort()
}

function withinWindow (isoDate, startMs, endMs) {
  const value = Date.parse(isoDate)
  return Number.isFinite(value) && value >= startMs && value <= endMs
}

function defaultTitleForType (type) {
  if (type === 'lock-reminder') return 'Lock reminder'
  if (type === 'challenge-received') return 'New challenge'
  if (type === 'challenge-accepted') return 'Challenge accepted'
  if (type === 'result-ready') return 'Result ready'
  if (type === 'live-result') return 'Live result'
  if (type === 'settlement-receipt') return 'Receipt ready'
  if (type === 'reward-granted') return 'Reward granted'
  if (type === 'payout-update') return 'Payout update'
  if (type === 'dispute-update') return 'Dispute update'
  return 'Notification'
}

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUSES,
  NOTIFICATION_CHANNELS,
  createNotification,
  updateNotificationStatus,
  applyNotificationStatusUpdate,
  createNotificationBatch,
  deriveEventNotifications,
  createLockReminderNotifications,
  summarizeNotificationInbox,
  indexNotificationsByUser,
  notificationDedupeKey
}
