'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { runtime } = require('../src')

test('room runtime enforces membership for chat, voice, reactions, and challenges', () => {
  const app = runtime.createPlatformRuntime()
  const roomEvent = app.dispatch({
    type: 'room:create',
    actorId: 'host-user',
    occurredAt: '2026-07-03T16:00:00.000Z',
    payload: {
      roomId: 'room-final',
      competitionId: 'comp-room',
      fixtureId: 'final',
      title: 'Final watch room',
      hostUserId: 'host-user',
      status: 'live'
    }
  })

  assert.throws(() => app.dispatch({
    type: 'room:chat',
    actorId: 'late-user',
    occurredAt: '2026-07-03T16:01:00.000Z',
    payload: {
      roomId: roomEvent.payload.roomId,
      body: 'hello?'
    }
  }), /has not joined/)

  app.dispatch({
    type: 'room:join',
    actorId: 'host-user',
    occurredAt: '2026-07-03T16:01:00.000Z',
    payload: {
      roomId: roomEvent.payload.roomId,
      username: 'Host'
    }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'user-a',
    occurredAt: '2026-07-03T16:02:00.000Z',
    payload: {
      roomId: roomEvent.payload.roomId,
      username: 'Ava'
    }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'user-b',
    occurredAt: '2026-07-03T16:02:30.000Z',
    payload: {
      roomId: roomEvent.payload.roomId,
      username: 'Ben'
    }
  })

  const message = app.dispatch({
    type: 'room:chat',
    actorId: 'user-a',
    occurredAt: '2026-07-03T16:03:00.000Z',
    payload: {
      roomId: roomEvent.payload.roomId,
      body: 'What a start.'
    }
  })
  app.dispatch({
    type: 'room:voice',
    actorId: 'user-a',
    occurredAt: '2026-07-03T16:03:10.000Z',
    payload: {
      roomId: roomEvent.payload.roomId,
      muted: false,
      speaking: true
    }
  })
  app.dispatch({
    type: 'room:react',
    actorId: 'user-b',
    occurredAt: '2026-07-03T16:03:15.000Z',
    payload: {
      roomId: roomEvent.payload.roomId,
      reaction: 'goal'
    }
  })

  assert.throws(() => app.dispatch({
    type: 'room:moderate',
    actorId: 'user-a',
    occurredAt: '2026-07-03T16:04:00.000Z',
    payload: {
      roomId: roomEvent.payload.roomId,
      messageId: message.payload.messageId,
      action: 'hide-message'
    }
  }), /not a room moderator/)

  app.dispatch({
    type: 'room:moderate',
    actorId: 'host-user',
    occurredAt: '2026-07-03T16:04:30.000Z',
    payload: {
      roomId: roomEvent.payload.roomId,
      messageId: message.payload.messageId,
      action: 'hide-message',
      reason: 'spoiler'
    }
  })

  const challenge = app.dispatch({
    type: 'room:challenge',
    actorId: 'user-a',
    occurredAt: '2026-07-03T16:05:00.000Z',
    payload: {
      roomId: roomEvent.payload.roomId,
      targetUserId: 'user-b',
      challengeType: 'peer-game',
      gameType: 'penalty-clash'
    }
  })
  app.dispatch({
    type: 'room:acceptChallenge',
    actorId: 'user-b',
    occurredAt: '2026-07-03T16:05:30.000Z',
    payload: {
      challengeId: challenge.payload.challengeId
    }
  })
  app.dispatch({
    type: 'game:create',
    actorId: 'user-a',
    occurredAt: '2026-07-03T16:06:00.000Z',
    payload: {
      gameId: 'room-game',
      gameType: challenge.payload.gameType,
      roomId: roomEvent.payload.roomId,
      players: ['user-a', 'user-b'],
      stakeMode: 'demo'
    }
  })

  const view = app.view()
  assert.equal(view.roomParticipants['room-final']['host-user'].role, 'host')
  assert.equal(view.roomMessages[message.payload.messageId].moderationState, 'hidden')
  assert.equal(view.roomVoiceStates['room-final']['user-a'].speaking, true)
  assert.equal(view.roomReactions['room-final'][0].reaction, 'goal')
  assert.equal(view.roomChallenges[challenge.payload.challengeId].status, 'accepted')
  assert.equal(view.gameSessions['room-game'].roomId, 'room-final')
})

test('leaving a room prevents later room actions and challenge acceptance requires target', () => {
  const app = runtime.createPlatformRuntime()
  app.dispatch({
    type: 'room:create',
    actorId: 'host',
    occurredAt: '2026-07-03T17:00:00.000Z',
    payload: {
      roomId: 'room-leave',
      competitionId: 'comp-room',
      hostUserId: 'host'
    }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'host',
    occurredAt: '2026-07-03T17:01:00.000Z',
    payload: { roomId: 'room-leave' }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'user-a',
    occurredAt: '2026-07-03T17:02:00.000Z',
    payload: { roomId: 'room-leave' }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'user-b',
    occurredAt: '2026-07-03T17:02:30.000Z',
    payload: { roomId: 'room-leave' }
  })
  const challenge = app.dispatch({
    type: 'room:challenge',
    actorId: 'user-a',
    occurredAt: '2026-07-03T17:03:00.000Z',
    payload: {
      roomId: 'room-leave',
      targetUserId: 'user-b',
      challengeType: 'side-quest',
      sideQuest: { condition: 'semi-finalists-score-more' }
    }
  })

  assert.throws(() => app.dispatch({
    type: 'room:acceptChallenge',
    actorId: 'host',
    occurredAt: '2026-07-03T17:03:30.000Z',
    payload: { challengeId: challenge.payload.challengeId }
  }), /only the target user/)

  app.dispatch({
    type: 'room:leave',
    actorId: 'user-b',
    occurredAt: '2026-07-03T17:04:00.000Z',
    payload: { roomId: 'room-leave' }
  })

  assert.throws(() => app.dispatch({
    type: 'room:chat',
    actorId: 'user-b',
    occurredAt: '2026-07-03T17:05:00.000Z',
    payload: {
      roomId: 'room-leave',
      body: 'I am still here'
    }
  }), /has not joined/)
})

