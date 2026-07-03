'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { notification, runtime } = require('../src')

test('notification engine derives challenge, result, receipt, reward, and payout notifications', () => {
  const events = [
    {
      eventId: 'evt-challenge',
      type: 'RoomChallengeCreated',
      payload: {
        challengeId: 'challenge-1',
        roomId: 'room-1',
        challengerUserId: 'alice',
        targetUserId: 'bob',
        challengeType: 'peer-game'
      }
    },
    {
      eventId: 'evt-accepted',
      type: 'RoomChallengeAccepted',
      payload: {
        challengeId: 'challenge-1',
        roomId: 'room-1',
        challengerUserId: 'alice',
        acceptedByUserId: 'bob',
        challengeType: 'peer-game'
      }
    },
    {
      eventId: 'evt-settlement',
      type: 'PoolSettlementResolved',
      payload: {
        poolId: 'pool-1',
        winnerUserIds: ['alice'],
        winningScore: 12
      }
    },
    {
      eventId: 'evt-receipt',
      type: 'SettlementReceiptCreated',
      payload: {
        receiptId: 'receipt-1',
        receiptHash: 'hash-1',
        status: 'complete',
        body: {
          targetType: 'pool',
          targetId: 'pool-1',
          winnerUserIds: ['alice']
        }
      }
    },
    {
      eventId: 'evt-wallet',
      type: 'WalletRewardsGranted',
      payload: {
        grantId: 'grant-1',
        receiptId: 'receipt-1',
        entries: [
          { accountId: 'acct-alice', userId: 'alice', amount: 250, currency: 'CREDITS' }
        ]
      }
    },
    {
      eventId: 'evt-prize',
      type: 'SponsorPrizeFulfillmentUpdated',
      payload: {
        fulfillmentId: 'fulfillment-1',
        receiptId: 'receipt-1',
        winnerUserId: 'alice',
        status: 'fulfilled'
      }
    }
  ]

  const derived = notification.deriveEventNotifications({ events, createdAt: '2026-07-03T20:00:00.000Z' })
  const aliceTypes = derived.filter(item => item.userId === 'alice').map(item => item.type).sort()
  const bobTypes = derived.filter(item => item.userId === 'bob').map(item => item.type)

  assert.deepEqual(aliceTypes, ['challenge-accepted', 'payout-update', 'result-ready', 'reward-granted', 'settlement-receipt'])
  assert.deepEqual(bobTypes, ['challenge-received'])
  assert.equal(new Set(derived.map(item => item.dedupeKey)).size, derived.length)
})

test('lock reminder notifications target pool entrants and room participants', () => {
  const reminders = notification.createLockReminderNotifications({
    now: '2026-07-03T20:00:00.000Z',
    horizonMinutes: 30,
    view: {
      pools: {
        poolSoon: {
          poolId: 'poolSoon',
          title: 'Soon Pool',
          competitionId: 'comp',
          entryCloseAt: '2026-07-03T20:20:00.000Z'
        },
        poolLater: {
          poolId: 'poolLater',
          title: 'Later Pool',
          competitionId: 'comp',
          entryCloseAt: '2026-07-03T21:20:00.000Z'
        }
      },
      predictionEntries: {
        entryA: { poolId: 'poolSoon', userId: 'alice' }
      },
      markets: {
        marketSoon: {
          marketId: 'marketSoon',
          roomId: 'room-1',
          competitionId: 'comp',
          marketType: 'next-event',
          locksAt: '2026-07-03T20:10:00.000Z'
        }
      },
      roomParticipants: {
        'room-1': {
          bob: { userId: 'bob', status: 'joined' },
          carol: { userId: 'carol', status: 'left' }
        }
      },
      watchPredictions: {
        pickA: { marketId: 'marketSoon', userId: 'dina' }
      }
    }
  })

  assert.equal(reminders.some(item => item.userId === 'alice' && item.targetId === 'poolSoon'), true)
  assert.equal(reminders.some(item => item.userId === 'bob' && item.targetId === 'marketSoon'), true)
  assert.equal(reminders.some(item => item.userId === 'dina' && item.targetId === 'marketSoon'), true)
  assert.equal(reminders.some(item => item.userId === 'carol'), false)
  assert.equal(reminders.some(item => item.targetId === 'poolLater'), false)
})

test('runtime generates replayable inbox notifications and status updates', () => {
  const app = runtime.createPlatformRuntime()
  app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T21:00:00.000Z',
    payload: {
      competitionId: 'notify-comp',
      title: 'Notify Cup',
      templateConfig: { kind: 'single-elimination' },
      entrants: [
        { entrantId: 'alpha', name: 'Alpha' },
        { entrantId: 'beta', name: 'Beta' }
      ]
    }
  })
  app.dispatch({
    type: 'room:create',
    actorId: 'alice',
    occurredAt: '2026-07-03T21:01:00.000Z',
    payload: {
      roomId: 'notify-room',
      competitionId: 'notify-comp',
      hostUserId: 'alice'
    }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'alice',
    occurredAt: '2026-07-03T21:02:00.000Z',
    payload: { roomId: 'notify-room', userId: 'alice', username: 'Alice', role: 'host' }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'bob',
    occurredAt: '2026-07-03T21:03:00.000Z',
    payload: { roomId: 'notify-room', userId: 'bob', username: 'Bob' }
  })
  const challenge = app.dispatch({
    type: 'room:challenge',
    actorId: 'alice',
    occurredAt: '2026-07-03T21:04:00.000Z',
    payload: {
      roomId: 'notify-room',
      challengerUserId: 'alice',
      targetUserId: 'bob',
      challengeType: 'peer-game',
      gameType: 'trivia-duel'
    }
  })
  app.dispatch({
    type: 'room:acceptChallenge',
    actorId: 'bob',
    occurredAt: '2026-07-03T21:05:00.000Z',
    payload: { challengeId: challenge.payload.challengeId }
  })
  app.dispatch({
    type: 'market:create',
    actorId: 'host',
    occurredAt: '2026-07-03T21:06:00.000Z',
    payload: {
      marketId: 'notify-market',
      roomId: 'notify-room',
      competitionId: 'notify-comp',
      marketType: 'next-event',
      locksAt: '2026-07-03T21:20:00.000Z'
    }
  })
  const batch = app.dispatch({
    type: 'notification:generate',
    actorId: 'system',
    occurredAt: '2026-07-03T21:10:00.000Z',
    payload: {
      now: '2026-07-03T21:10:00.000Z',
      horizonMinutes: 20
    }
  })
  const view = app.view()
  const bobInboxIds = view.notificationsByUser.bob || []
  const aliceInbox = bobInboxIds.map(id => view.notifications[id])
  const readTarget = aliceInbox.find(item => item.type === 'challenge-received')

  assert.equal(batch.payload.notifications.length >= 4, true)
  assert.equal(aliceInbox.some(item => item.targetId === 'notify-market'), true)
  assert.equal(view.notificationInboxSummaries.bob.unread >= 2, true)

  app.dispatch({
    type: 'notification:markRead',
    actorId: 'bob',
    occurredAt: '2026-07-03T21:11:00.000Z',
    payload: {
      notificationId: readTarget.notificationId
    }
  })

  const updated = app.view().notifications[readTarget.notificationId]
  assert.equal(updated.status, 'read')
  assert.equal(updated.readAt, '2026-07-03T21:11:00.000Z')

  const duplicateBatch = app.dispatch({
    type: 'notification:generate',
    actorId: 'system',
    occurredAt: '2026-07-03T21:12:00.000Z',
    payload: {
      now: '2026-07-03T21:12:00.000Z',
      horizonMinutes: 20
    }
  })

  assert.equal(duplicateBatch.payload.notifications.length, 0)
})
