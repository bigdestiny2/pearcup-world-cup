'use strict'

const livePrediction = require('./live-prediction-engine')
const { cloneJson, stableId } = require('./util')

function materializeAcceptedChallenge ({
  challenge,
  room,
  competition = null,
  settlementMode = 'demo',
  stakeMode = null,
  gates = {},
  occurredAt = null
} = {}) {
  if (!challenge || typeof challenge !== 'object') throw new TypeError('challenge is required')
  if (!room || typeof room !== 'object') throw new TypeError('room is required')
  if (challenge.status !== 'accepted') throw new Error('challenge must be accepted before materialization')
  if (challenge.roomId !== room.roomId) throw new Error('challenge room does not match room')

  if (challenge.challengeType === 'peer-game') {
    return materializePeerGameChallenge({ challenge, room, settlementMode, stakeMode, gates, occurredAt })
  }
  if (challenge.challengeType === 'live-prediction') {
    return materializeLivePredictionChallenge({ challenge, room, competition, settlementMode, gates, occurredAt })
  }
  if (challenge.challengeType === 'side-quest') {
    return materializeSideQuestChallenge({ challenge, room, competition, settlementMode, gates, occurredAt })
  }
  throw new Error(`unsupported challenge type: ${challenge.challengeType}`)
}

function materializePeerGameChallenge ({ challenge, room, settlementMode, stakeMode, gates, occurredAt }) {
  const gameType = challenge.gameType || 'trivia-duel'
  const normalizedStakeMode = stakeMode || (settlementMode === 'sponsor-prize' ? 'sponsor-prize' : 'demo')
  const command = {
    type: 'game:create',
    actorId: challenge.challengerUserId,
    occurredAt,
    payload: {
      gameId: stableId(`challenge-game-${challenge.challengeId}`, {
        challengeId: challenge.challengeId,
        gameType
      }),
      gameType,
      roomId: room.roomId,
      players: [challenge.challengerUserId, challenge.targetUserId],
      stakeMode: normalizedStakeMode,
      gates: cloneJson(gates),
      challengeId: challenge.challengeId
    }
  }
  return materialization({
    challenge,
    command,
    topics: [{ kind: 'room', id: room.roomId }, { kind: 'game', id: command.payload.gameId }]
  })
}

function materializeLivePredictionChallenge ({ challenge, room, competition, settlementMode, gates, occurredAt }) {
  const marketType = challenge.marketType || 'next-event'
  const command = {
    type: 'market:create',
    actorId: challenge.challengerUserId,
    occurredAt,
    payload: {
      marketId: stableId(`challenge-market-${challenge.challengeId}`, {
        challengeId: challenge.challengeId,
        marketType
      }),
      roomId: room.roomId,
      competitionId: room.competitionId || competition && competition.competitionId,
      fixtureId: room.fixtureId || null,
      marketType,
      options: marketOptionsFor(marketType),
      mode: settlementMode,
      gates: cloneJson(gates),
      challengeId: challenge.challengeId
    }
  }
  return materialization({
    challenge,
    command,
    topics: [{ kind: 'room', id: room.roomId }, { kind: 'market', id: command.payload.marketId }]
  })
}

function materializeSideQuestChallenge ({ challenge, room, competition, settlementMode, gates, occurredAt }) {
  const sideQuest = challenge.sideQuest || {}
  const command = {
    type: 'pool:create',
    actorId: challenge.challengerUserId,
    occurredAt,
    payload: {
      poolId: stableId(`challenge-side-quest-${challenge.challengeId}`, {
        challengeId: challenge.challengeId,
        sideQuest
      }),
      competitionId: room.competitionId || competition && competition.competitionId,
      title: sideQuest.title || 'Bracket side quest',
      variant: 'side-quest',
      mode: settlementMode,
      gates: cloneJson(gates),
      metadata: {
        challengeId: challenge.challengeId,
        roomId: room.roomId,
        challengerUserId: challenge.challengerUserId,
        targetUserId: challenge.targetUserId,
        sideQuest: cloneJson(sideQuest)
      }
    }
  }
  return materialization({
    challenge,
    command,
    topics: [{ kind: 'room', id: room.roomId }, { kind: 'pool', id: command.payload.poolId }]
  })
}

function materialization ({ challenge, command, topics }) {
  return {
    materializationId: stableId(`materialization-${challenge.challengeId}`, {
      challengeId: challenge.challengeId,
      command
    }),
    challengeId: challenge.challengeId,
    challengeType: challenge.challengeType,
    command,
    topics,
    status: 'ready'
  }
}

function marketOptionsFor (marketType) {
  return livePrediction.marketOptionsFor(marketType)
}

module.exports = {
  materializeAcceptedChallenge,
  materializePeerGameChallenge,
  materializeLivePredictionChallenge,
  materializeSideQuestChallenge,
  marketOptionsFor
}
