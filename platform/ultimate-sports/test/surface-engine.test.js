'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { platform, surface } = require('../src')

test('surface engine builds discover and navigation models for the information architecture', () => {
  const discover = surface.createSurface('discover', {
    catalogQuery: { category: 'awards' }
  })
  const experience = surface.createExperience({
    userId: 'viewer',
    now: '2026-07-03T18:00:00.000Z',
    view: {},
    catalogQuery: { category: 'awards' }
  })

  assert.equal(discover.surfaceId, 'discover')
  assert.equal(discover.launchCards.some(card => card.fitId === 'awards-prediction-pools'), true)
  assert.deepEqual(experience.navigation.map(item => item.surfaceId), surface.SURFACE_IDS)
  assert.equal(experience.surfaces.home.counts.unreadNotifications, 0)
  assert.throws(() => surface.createSurface('landing'), /surfaceId must be one of/)
})

test('facade experience summarizes home, pools, watch, games, wallet, and settings state', () => {
  const app = platform.createUltimateSportsPlatform({ peerId: 'host' })
  app.applyScenario('soccer-knockout', {
    competitionId: 'surface-cup',
    poolId: 'surface-pool',
    roomId: 'surface-room'
  })
  app.dispatch({
    type: 'user:upsert',
    actorId: 'user-a',
    occurredAt: '2026-07-03T18:00:00.000Z',
    payload: {
      displayName: 'User A',
      region: 'US-CO'
    }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'user-a',
    occurredAt: '2026-07-03T18:01:00.000Z',
    payload: {
      roomId: 'surface-room',
      username: 'User A'
    }
  })
  app.dispatch({
    type: 'room:challenge',
    actorId: 'user-a',
    occurredAt: '2026-07-03T18:02:00.000Z',
    payload: {
      roomId: 'surface-room',
      targetUserId: 'host',
      challengeType: 'peer-game',
      gameType: 'penalty-clash'
    }
  })
  app.dispatch({
    type: 'game:create',
    actorId: 'user-a',
    occurredAt: '2026-07-03T18:03:00.000Z',
    payload: {
      gameId: 'surface-game',
      gameType: 'penalty-clash',
      roomId: 'surface-room',
      players: ['user-a', 'host'],
      stakeMode: 'demo'
    }
  })
  const entry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'user-a',
    occurredAt: '2026-07-03T18:04:00.000Z',
    payload: {
      poolId: 'surface-pool',
      userId: 'user-a',
      entryType: 'bracket',
      picks: { final: 'red' }
    }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T18:05:00.000Z',
    payload: { entryId: entry.payload.entryId }
  })
  const account = app.dispatch({
    type: 'wallet:createAccount',
    actorId: 'user-a',
    occurredAt: '2026-07-03T18:06:00.000Z',
    payload: {
      userId: 'user-a',
      mode: 'demo-credit',
      currency: 'CREDITS'
    }
  })
  app.dispatch({
    type: 'wallet:credit',
    actorId: 'system',
    occurredAt: '2026-07-03T18:07:00.000Z',
    payload: {
      accountId: account.payload.accountId,
      amount: 100,
      reason: 'welcome bonus'
    }
  })
  app.dispatch({
    type: 'notification:create',
    actorId: 'system',
    occurredAt: '2026-07-03T18:08:00.000Z',
    payload: {
      userId: 'user-a',
      type: 'challenge-received',
      targetType: 'room-challenge',
      targetId: 'surface-challenge'
    }
  })
  app.dispatch({
    type: 'compliance:createReadinessPanel',
    actorId: 'user-a',
    occurredAt: '2026-07-03T18:09:00.000Z',
    payload: {
      mode: 'real-money',
      targetType: 'pool',
      targetId: 'surface-pool'
    }
  })

  const experience = app.createExperience({
    userId: 'user-a',
    now: '2026-07-03T18:10:00.000Z',
    catalogQuery: { category: 'soccer' }
  })
  const watch = app.createSurface('watch', { userId: 'user-a' })

  assert.equal(experience.userId, 'user-a')
  assert.equal(experience.surfaces.home.counts.liveRooms, 1)
  assert.equal(experience.surfaces.home.counts.unreadNotifications, 1)
  assert.equal(experience.surfaces.pools.yourPools[0].poolId, 'surface-pool')
  assert.equal(experience.surfaces.picks.predictionEntries[0].status, 'locked')
  assert.equal(experience.surfaces.watch.joinedRooms[0].roomId, 'surface-room')
  assert.equal(experience.surfaces.games.activeDuels.length, 1)
  assert.equal(experience.surfaces.games.activeGames[0].gameId, 'surface-game')
  assert.equal(experience.surfaces.wallet.accounts[0].balance.available, 100)
  assert.equal(experience.surfaces.wallet.readinessPanels[0].ready, false)
  assert.equal(experience.surfaces.settings.profile.displayName, 'User A')
  assert.equal(watch.rooms[0].currentUserJoined, true)
  assert.equal(experience.navigation.find(item => item.surfaceId === 'wallet').badgeCount, 1)
})
