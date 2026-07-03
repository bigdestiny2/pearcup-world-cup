'use strict'

const { assertNonEmptyString, cloneJson, stableId } = require('./util')

const TRUST_ACTIONS = Object.freeze([
  'trust',
  'mute',
  'unmute',
  'ban',
  'unban',
  'report'
])

const INVITE_SCOPES = Object.freeze([
  'room',
  'pool',
  'competition'
])

function createUserProfile (input = {}) {
  assertNonEmptyString(input.userId, 'userId')
  return {
    userId: input.userId,
    displayName: input.displayName || input.username || input.userId,
    avatarUrl: input.avatarUrl || null,
    region: input.region || null,
    language: input.language || 'en',
    publicKey: input.publicKey || null,
    privacy: cloneJson(input.privacy || {}),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || input.createdAt || new Date().toISOString()
  }
}

function createInvite (input = {}) {
  assertNonEmptyString(input.scope, 'scope')
  assertAllowedInviteScope(input.scope)
  assertNonEmptyString(input.scopeId, 'scopeId')
  assertNonEmptyString(input.createdByUserId, 'createdByUserId')
  const inviteCode = input.inviteCode || stableId(`invite-${input.scope}-${input.scopeId}`, {
    createdByUserId: input.createdByUserId,
    createdAt: input.createdAt || null,
    maxUses: input.maxUses || null
  })

  return {
    inviteId: input.inviteId || inviteCode,
    inviteCode,
    scope: input.scope,
    scopeId: input.scopeId,
    createdByUserId: input.createdByUserId,
    maxUses: input.maxUses || null,
    expiresAt: input.expiresAt || null,
    allowedUserIds: cloneJson(input.allowedUserIds || []),
    createdAt: input.createdAt || new Date().toISOString(),
    status: input.status || 'open'
  }
}

function acceptInvite ({ invite, userId, acceptedAt = new Date().toISOString() } = {}) {
  if (!invite || typeof invite !== 'object') throw new TypeError('invite is required')
  assertNonEmptyString(userId, 'userId')
  if (invite.status !== 'open') throw new Error(`invite is not open: ${invite.status}`)
  if (invite.expiresAt && acceptedAt > invite.expiresAt) throw new Error('invite has expired')
  if (invite.allowedUserIds && invite.allowedUserIds.length && !invite.allowedUserIds.includes(userId)) {
    throw new Error(`invite is not valid for user ${userId}`)
  }
  return {
    inviteAcceptanceId: stableId(`invite-acceptance-${invite.inviteId}-${userId}`, {
      inviteId: invite.inviteId,
      userId,
      acceptedAt
    }),
    inviteId: invite.inviteId,
    inviteCode: invite.inviteCode,
    scope: invite.scope,
    scopeId: invite.scopeId,
    userId,
    acceptedAt,
    status: 'accepted'
  }
}

function createTrustAction ({
  sourceUserId,
  targetUserId,
  scope = 'global',
  scopeId = 'global',
  action,
  reason = null,
  createdAt = new Date().toISOString()
} = {}) {
  assertNonEmptyString(sourceUserId, 'sourceUserId')
  assertNonEmptyString(targetUserId, 'targetUserId')
  assertNonEmptyString(scope, 'scope')
  assertNonEmptyString(scopeId, 'scopeId')
  if (!TRUST_ACTIONS.includes(action)) {
    throw new RangeError(`trust action must be one of: ${TRUST_ACTIONS.join(', ')}`)
  }

  return {
    trustActionId: stableId(`trust-${scope}-${scopeId}-${sourceUserId}-${targetUserId}`, {
      action,
      reason,
      createdAt
    }),
    sourceUserId,
    targetUserId,
    scope,
    scopeId,
    action,
    reason,
    createdAt
  }
}

function inviteAllowsUser ({ invite, userId, acceptedInvites = {}, acceptedAt = new Date().toISOString() } = {}) {
  if (!invite) return true
  if (invite.status !== 'open') return false
  if (invite.expiresAt && acceptedAt > invite.expiresAt) return false
  if (invite.allowedUserIds && invite.allowedUserIds.length && !invite.allowedUserIds.includes(userId)) return false
  const acceptances = Object.values(acceptedInvites)
    .filter(item => item && item.inviteId === invite.inviteId)
  if (invite.maxUses && acceptances.length >= invite.maxUses && !acceptances.some(item => item.userId === userId)) {
    return false
  }
  return acceptances.some(item => item.userId === userId) || invite.allowedUserIds.length === 0 || invite.allowedUserIds.includes(userId)
}

function assertAllowedInviteScope (scope) {
  if (!INVITE_SCOPES.includes(scope)) throw new RangeError(`invite scope must be one of: ${INVITE_SCOPES.join(', ')}`)
}

module.exports = {
  TRUST_ACTIONS,
  INVITE_SCOPES,
  createUserProfile,
  createInvite,
  acceptInvite,
  createTrustAction,
  inviteAllowsUser,
  assertAllowedInviteScope
}
