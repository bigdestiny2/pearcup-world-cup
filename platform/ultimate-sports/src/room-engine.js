'use strict'

const { assertNonEmptyString, cloneJson, stableId } = require('./util')

const ROOM_ROLES = Object.freeze(['viewer', 'streamer', 'host', 'moderator'])
const CHALLENGE_TYPES = Object.freeze(['peer-game', 'live-prediction', 'side-quest'])
const MODERATION_ACTIONS = Object.freeze(['hide-message', 'restore-message', 'report-message'])

function createWatchRoom (input = {}) {
  assertNonEmptyString(input.competitionId, 'competitionId')
  const roomId = input.roomId || stableId('room', {
    competitionId: input.competitionId,
    fixtureId: input.fixtureId || null,
    eventId: input.eventId || null
  })

  return {
    roomId,
    competitionId: input.competitionId,
    fixtureId: input.fixtureId || null,
    eventId: input.eventId || input.fixtureId || input.competitionId,
    title: input.title || 'Watch room',
    topicHash: input.topicHash || `pearcup:v2:room:${input.eventId || input.fixtureId || roomId}`,
    hostUserId: input.hostUserId || null,
    status: input.status || 'scheduled',
    access: input.access || 'public',
    languages: cloneJson(input.languages || ['en']),
    activeStreamId: input.activeStreamId || null
  }
}

function joinRoom ({ room, userId, username, role, joinedAt = new Date().toISOString() } = {}) {
  if (!room || typeof room !== 'object') throw new TypeError('room is required')
  assertNonEmptyString(userId, 'userId')
  const normalizedRole = role || (room.hostUserId === userId ? 'host' : 'viewer')
  assertAllowedRole(normalizedRole)
  return {
    joinId: stableId(`join-${room.roomId}-${userId}`, { roomId: room.roomId, userId }),
    roomId: room.roomId,
    userId,
    username: username || userId,
    role: normalizedRole,
    joinedAt,
    status: 'joined'
  }
}

function leaveRoom ({ roomId, userId, leftAt = new Date().toISOString() } = {}) {
  assertNonEmptyString(roomId, 'roomId')
  assertNonEmptyString(userId, 'userId')
  return {
    leaveId: stableId(`leave-${roomId}-${userId}`, { roomId, userId, leftAt }),
    roomId,
    userId,
    leftAt,
    status: 'left'
  }
}

function createChatMessage ({ roomId, userId, username, body, replyToId = null, createdAt = new Date().toISOString() } = {}) {
  assertNonEmptyString(roomId, 'roomId')
  assertNonEmptyString(userId, 'userId')
  assertNonEmptyString(body, 'body')
  if (body.length > 500) throw new RangeError('chat message body cannot exceed 500 characters')
  return {
    messageId: stableId(`message-${roomId}-${userId}`, { roomId, userId, body, replyToId, createdAt }),
    roomId,
    userId,
    username: username || userId,
    body,
    replyToId,
    createdAt,
    moderationState: 'visible'
  }
}

function updateVoiceState ({ roomId, userId, muted = false, speaking = false, handRaised = false, updatedAt = new Date().toISOString() } = {}) {
  assertNonEmptyString(roomId, 'roomId')
  assertNonEmptyString(userId, 'userId')
  return {
    voiceId: stableId(`voice-${roomId}-${userId}`, { roomId, userId, updatedAt, muted, speaking, handRaised }),
    roomId,
    userId,
    muted: Boolean(muted),
    speaking: Boolean(speaking),
    handRaised: Boolean(handRaised),
    updatedAt
  }
}

function createReaction ({ roomId, userId, reaction, createdAt = new Date().toISOString() } = {}) {
  assertNonEmptyString(roomId, 'roomId')
  assertNonEmptyString(userId, 'userId')
  assertNonEmptyString(reaction, 'reaction')
  return {
    reactionId: stableId(`reaction-${roomId}-${userId}`, { roomId, userId, reaction, createdAt }),
    roomId,
    userId,
    reaction,
    createdAt
  }
}

function moderateMessage ({ roomId, messageId, moderatorUserId, action, reason = null, moderatedAt = new Date().toISOString() } = {}) {
  assertNonEmptyString(roomId, 'roomId')
  assertNonEmptyString(messageId, 'messageId')
  assertNonEmptyString(moderatorUserId, 'moderatorUserId')
  if (!MODERATION_ACTIONS.includes(action)) {
    throw new RangeError(`moderation action must be one of: ${MODERATION_ACTIONS.join(', ')}`)
  }
  return {
    moderationId: stableId(`moderation-${roomId}-${messageId}`, { action, moderatorUserId, moderatedAt }),
    roomId,
    messageId,
    moderatorUserId,
    action,
    reason,
    moderatedAt
  }
}

function createRoomChallenge ({
  roomId,
  challengerUserId,
  targetUserId,
  challengeType = 'peer-game',
  gameType = null,
  marketType = null,
  sideQuest = null,
  createdAt = new Date().toISOString()
} = {}) {
  assertNonEmptyString(roomId, 'roomId')
  assertNonEmptyString(challengerUserId, 'challengerUserId')
  assertNonEmptyString(targetUserId, 'targetUserId')
  if (!CHALLENGE_TYPES.includes(challengeType)) {
    throw new RangeError(`challengeType must be one of: ${CHALLENGE_TYPES.join(', ')}`)
  }
  return {
    challengeId: stableId(`challenge-${roomId}-${challengerUserId}-${targetUserId}`, {
      roomId,
      challengerUserId,
      targetUserId,
      challengeType,
      gameType,
      marketType,
      sideQuest,
      createdAt
    }),
    roomId,
    challengerUserId,
    targetUserId,
    challengeType,
    gameType,
    marketType,
    sideQuest: cloneJson(sideQuest || null),
    createdAt,
    status: 'pending'
  }
}

function acceptRoomChallenge ({ challenge, acceptedByUserId, acceptedAt = new Date().toISOString() } = {}) {
  if (!challenge || typeof challenge !== 'object') throw new TypeError('challenge is required')
  assertNonEmptyString(acceptedByUserId, 'acceptedByUserId')
  if (challenge.targetUserId !== acceptedByUserId) throw new Error('only the target user can accept a room challenge')
  return {
    ...challenge,
    acceptedAt,
    acceptedByUserId,
    status: 'accepted'
  }
}

function assertAllowedRole (role) {
  if (!ROOM_ROLES.includes(role)) throw new RangeError(`room role must be one of: ${ROOM_ROLES.join(', ')}`)
}

module.exports = {
  ROOM_ROLES,
  CHALLENGE_TYPES,
  MODERATION_ACTIONS,
  createWatchRoom,
  joinRoom,
  leaveRoom,
  createChatMessage,
  updateVoiceState,
  createReaction,
  moderateMessage,
  createRoomChallenge,
  acceptRoomChallenge
}
