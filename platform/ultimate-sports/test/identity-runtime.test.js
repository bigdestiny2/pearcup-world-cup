'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { identity, platform } = require('../src')

test('identity engine creates profiles, invites, acceptances, and trust actions', () => {
  const profile = identity.createUserProfile({
    userId: 'alice',
    displayName: 'Alice',
    region: 'US'
  })
  const invite = identity.createInvite({
    scope: 'room',
    scopeId: 'room-1',
    createdByUserId: 'host',
    allowedUserIds: ['alice']
  })
  const acceptance = identity.acceptInvite({
    invite,
    userId: 'alice'
  })
  const trust = identity.createTrustAction({
    sourceUserId: 'host',
    targetUserId: 'alice',
    scope: 'room',
    scopeId: 'room-1',
    action: 'trust'
  })

  assert.equal(profile.displayName, 'Alice')
  assert.equal(invite.scope, 'room')
  assert.equal(acceptance.status, 'accepted')
  assert.equal(trust.action, 'trust')
  assert.throws(() => identity.acceptInvite({ invite, userId: 'bob' }), /not valid/)
})

test('runtime enforces invite-only room access and max invite usage', () => {
  const app = platform.createUltimateSportsPlatform()
  app.dispatch({
    type: 'user:upsert',
    actorId: 'alice',
    payload: {
      displayName: 'Alice'
    }
  })
  app.dispatch({
    type: 'room:create',
    actorId: 'host',
    occurredAt: '2026-07-04T01:00:00.000Z',
    payload: {
      roomId: 'invite-room',
      competitionId: 'invite-comp',
      hostUserId: 'host',
      access: 'invite-only'
    }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'host',
    occurredAt: '2026-07-04T01:01:00.000Z',
    payload: { roomId: 'invite-room' }
  })
  const invite = app.dispatch({
    type: 'invite:create',
    actorId: 'host',
    occurredAt: '2026-07-04T01:02:00.000Z',
    payload: {
      scope: 'room',
      scopeId: 'invite-room',
      inviteCode: 'ROOM-CODE',
      maxUses: 1
    }
  })

  assert.throws(() => app.dispatch({
    type: 'room:join',
    actorId: 'alice',
    payload: { roomId: 'invite-room' }
  }), /needs an accepted invite/)

  app.dispatch({
    type: 'invite:accept',
    actorId: 'alice',
    occurredAt: '2026-07-04T01:03:00.000Z',
    payload: {
      inviteCode: invite.payload.inviteCode
    }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'alice',
    occurredAt: '2026-07-04T01:04:00.000Z',
    payload: {
      roomId: 'invite-room',
      username: 'Alice'
    }
  })

  assert.throws(() => app.dispatch({
    type: 'invite:accept',
    actorId: 'bob',
    payload: {
      inviteCode: invite.payload.inviteCode
    }
  }), /does not allow/)
  assert.equal(app.view().profiles.alice.displayName, 'Alice')
  assert.equal(app.view().roomParticipants['invite-room'].alice.status, 'joined')
})

test('runtime enforces room-scoped bans, mutes, and unmute recovery', () => {
  const app = platform.createUltimateSportsPlatform()
  app.dispatch({
    type: 'room:create',
    actorId: 'host',
    payload: {
      roomId: 'trust-room',
      competitionId: 'trust-comp',
      hostUserId: 'host'
    }
  })
  ;['host', 'alice', 'bob'].forEach(userId => {
    app.dispatch({
      type: 'room:join',
      actorId: userId,
      payload: { roomId: 'trust-room' }
    })
  })

  app.dispatch({
    type: 'trust:record',
    actorId: 'host',
    occurredAt: '2026-07-04T02:00:00.000Z',
    payload: {
      scope: 'room',
      scopeId: 'trust-room',
      targetUserId: 'alice',
      action: 'mute',
      reason: 'spoilers'
    }
  })
  assert.throws(() => app.dispatch({
    type: 'room:chat',
    actorId: 'alice',
    payload: {
      roomId: 'trust-room',
      body: 'Can I talk?'
    }
  }), /muted/)

  app.dispatch({
    type: 'trust:record',
    actorId: 'host',
    occurredAt: '2026-07-04T02:01:00.000Z',
    payload: {
      scope: 'room',
      scopeId: 'trust-room',
      targetUserId: 'alice',
      action: 'unmute'
    }
  })
  const message = app.dispatch({
    type: 'room:chat',
    actorId: 'alice',
    payload: {
      roomId: 'trust-room',
      body: 'Back in.'
    }
  })

  app.dispatch({
    type: 'trust:record',
    actorId: 'host',
    occurredAt: '2026-07-04T02:02:00.000Z',
    payload: {
      scope: 'room',
      scopeId: 'trust-room',
      targetUserId: 'bob',
      action: 'ban',
      reason: 'abuse'
    }
  })
  assert.throws(() => app.dispatch({
    type: 'room:chat',
    actorId: 'bob',
    payload: {
      roomId: 'trust-room',
      body: 'Nope'
    }
  }), /banned/)
  assert.equal(app.view().roomMessages[message.payload.messageId].body, 'Back in.')
  assert.equal(Object.values(app.view().trustActions).length, 3)
})
