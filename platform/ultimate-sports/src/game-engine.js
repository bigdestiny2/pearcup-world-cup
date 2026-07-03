'use strict'

const { SETTLEMENT_MODES } = require('./constants')
const {
  assertAllowed,
  assertNonEmptyString,
  canonicalJson,
  cloneJson,
  hash32,
  stableId
} = require('./util')

function createPeerGameSession (input = {}) {
  assertNonEmptyString(input.gameType, 'gameType')
  const players = Array.isArray(input.players) ? input.players.slice() : []
  if (players.length < 2) throw new RangeError('peer game sessions require at least two players')

  const stakeMode = input.stakeMode || 'none'
  assertAllowed(stakeMode, SETTLEMENT_MODES, 'stake mode')

  const gameId = input.gameId || stableId(`game-${input.gameType}`, {
    gameType: input.gameType,
    roomId: input.roomId || null,
    players
  })

  return {
    gameId,
    gameType: input.gameType,
    roomId: input.roomId || null,
    players,
    spectators: cloneJson(input.spectators || []),
    topicHash: input.topicHash || `pearcup:v2:game:${gameId}`,
    stakeMode,
    resolverVersion: input.resolverVersion || `${input.gameType}-v1`,
    status: input.status || 'invited'
  }
}

function startPeerGameSession (session) {
  if (!session || typeof session !== 'object') throw new TypeError('session is required')
  if (session.status !== 'invited') throw new Error(`cannot start session with status ${session.status}`)
  return {
    ...session,
    status: 'active'
  }
}

function createGameCommitment ({ gameId, roundId, playerId, input, nonce } = {}) {
  assertNonEmptyString(gameId, 'gameId')
  assertNonEmptyString(roundId, 'roundId')
  assertNonEmptyString(playerId, 'playerId')
  assertNonEmptyString(nonce, 'nonce')
  const commitmentHash = hashGameInput({ gameId, roundId, playerId, input, nonce })
  return {
    commitmentId: stableId(`commitment-${gameId}-${roundId}-${playerId}`, commitmentHash),
    gameId,
    roundId,
    playerId,
    commitmentHash
  }
}

function revealGameInput ({ commitment, input, nonce, revealedAt = new Date().toISOString() } = {}) {
  if (!commitment || typeof commitment !== 'object') throw new TypeError('commitment is required')
  assertNonEmptyString(nonce, 'nonce')
  return {
    revealId: stableId(`reveal-${commitment.gameId}-${commitment.roundId}-${commitment.playerId}`, {
      commitmentHash: commitment.commitmentHash,
      input,
      nonce
    }),
    gameId: commitment.gameId,
    roundId: commitment.roundId,
    playerId: commitment.playerId,
    input: cloneJson(input),
    nonce,
    revealedAt,
    commitmentId: commitment.commitmentId,
    commitmentHash: commitment.commitmentHash
  }
}

function verifyGameCommitment ({ commitment, reveal } = {}) {
  if (!commitment || !reveal) return false
  if (commitment.gameId !== reveal.gameId) return false
  if (commitment.roundId !== reveal.roundId) return false
  if (commitment.playerId !== reveal.playerId) return false
  return commitment.commitmentHash === hashGameInput({
    gameId: reveal.gameId,
    roundId: reveal.roundId,
    playerId: reveal.playerId,
    input: reveal.input,
    nonce: reveal.nonce
  })
}

function hashGameInput ({ gameId, roundId, playerId, input, nonce }) {
  return hash32({
    gameId,
    roundId,
    playerId,
    input: canonicalJson(input),
    nonce
  })
}

function comparePeerStateHashes (reports = []) {
  const counts = new Map()
  reports.forEach(report => {
    if (report && report.stateHash) counts.set(report.stateHash, (counts.get(report.stateHash) || 0) + 1)
  })
  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  const consensusHash = sorted.length ? sorted[0][0] : null
  const mismatchedUserIds = reports
    .filter(report => report && consensusHash && report.stateHash !== consensusHash)
    .map(report => report.userId || report.playerId)
    .filter(Boolean)
  return {
    ok: Boolean(consensusHash) && mismatchedUserIds.length === 0,
    consensusHash,
    mismatchedUserIds,
    counts: Object.fromEntries(sorted)
  }
}

module.exports = {
  createPeerGameSession,
  startPeerGameSession,
  createGameCommitment,
  revealGameInput,
  verifyGameCommitment,
  hashGameInput,
  comparePeerStateHashes
}
