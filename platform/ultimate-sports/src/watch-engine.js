'use strict'

const challengeEngine = require('./challenge-engine')
const gameEngine = require('./game-engine')
const livePrediction = require('./live-prediction-engine')
const { cloneJson, stableId } = require('./util')

const DEFAULT_MARKET_TYPES = Object.freeze([
  'next-event',
  'scoreline-lock',
  'momentum-duel',
  'player-prop',
  'watch-party-streak'
])

const DEFAULT_GAME_TYPES = Object.freeze([
  'penalty-clash',
  'free-kick-duel',
  'trivia-duel',
  'reaction-challenge'
])

function createWatchPartyWorkbench (input = {}) {
  const view = input.view || {}
  const userId = input.userId || 'local-peer'
  const rooms = values(view.rooms)
    .sort(compareTitles)
  const selectedRoom = input.roomId
    ? rooms.find(room => room.roomId === input.roomId) || null
    : rooms.find(room => isJoined(view, room.roomId, userId)) || rooms[0] || null
  const roomId = selectedRoom && selectedRoom.roomId || null
  const markets = roomId
    ? values(view.markets).filter(market => market.roomId === roomId).sort(compareMarketOrder)
    : []
  const challenges = roomId
    ? values(view.roomChallenges).filter(challenge => challenge.roomId === roomId).sort(compareCreated)
    : []
  const games = roomId
    ? values(view.gameSessions).filter(game => game.roomId === roomId).sort(compareTitles)
    : []
  const participants = roomId ? roomParticipants(view, roomId) : []
  const marketBuilders = markets.map(market => createMarketActionModel({
    market,
    userId,
    predictions: values(view.watchPredictions).filter(prediction => prediction.marketId === market.marketId),
    resolution: view.marketResolutions && view.marketResolutions[market.marketId] || null,
    isHost: selectedRoom && selectedRoom.hostUserId === userId
  }))
  const acceptedMaterializations = challenges
    .filter(challenge => challenge.status === 'accepted')
    .map(challenge => createChallengeMaterializationModel({
      challenge,
      room: selectedRoom,
      competition: selectedRoom && view.competitions && view.competitions[selectedRoom.competitionId] || null
    }))

  return {
    workbenchId: stableId(`watch-workbench-${userId}`, {
      roomIds: rooms.map(room => room.roomId),
      selectedRoomId: roomId,
      marketIds: markets.map(market => market.marketId),
      challengeIds: challenges.map(challenge => challenge.challengeId),
      gameIds: games.map(game => game.gameId)
    }),
    userId,
    generatedAt: input.now || new Date().toISOString(),
    selectedRoomId: roomId,
    counts: {
      rooms: rooms.length,
      joinedRooms: rooms.filter(room => isJoined(view, room.roomId, userId)).length,
      openMarkets: marketBuilders.filter(market => market.status === 'open').length,
      activeChallenges: challenges.filter(challenge => challenge.status === 'pending' || challenge.status === 'accepted').length,
      activeGames: games.filter(game => game.status === 'invited' || game.status === 'active').length,
      streaks: roomId ? values(view.streakResolutions).filter(streak => streak.roomId === roomId).length : 0
    },
    rooms: rooms.map(room => roomSummary({ view, room, userId })),
    selectedRoom: selectedRoom ? roomSummary({ view, room: selectedRoom, userId }) : null,
    participants,
    marketLauncher: selectedRoom ? createMarketLauncher({ room: selectedRoom, userId }) : null,
    markets: marketBuilders,
    streakBuilder: selectedRoom ? createStreakBuilder({
      room: selectedRoom,
      userId,
      resolutions: values(view.marketResolutions).filter(resolution => resolution.market && resolution.market.roomId === roomId)
    }) : null,
    challengeLauncher: selectedRoom ? createChallengeLauncher({
      room: selectedRoom,
      userId,
      participants,
      stake: input.defaultStake || input.stake || null
    }) : null,
    challenges: challenges.map(challenge => challengeSummary({ challenge, userId })),
    materializations: acceptedMaterializations,
    gameLauncher: selectedRoom ? createGameLauncher({
      room: selectedRoom,
      userId,
      participants
    }) : null,
    games: games.map(game => createGameActionModel({
      game,
      userId,
      commitments: values(view.gameCommitments).filter(commitment => commitment.gameId === game.gameId),
      reveals: values(view.gameReveals).filter(reveal => reveal.gameId === game.gameId),
      resolution: view.gameResolutions && view.gameResolutions[game.gameId] || null
    })),
    triviaBanks: values(view.qvacTriviaBanks)
      .filter(record => {
        if (!selectedRoom) return false
        return record.targetId === selectedRoom.roomId || record.targetId === selectedRoom.competitionId
      })
      .sort(compareCreated)
      .map(record => ({
        qvacRecordId: record.qvacRecordId,
        targetType: record.targetType,
        targetId: record.targetId,
        title: record.title,
        status: record.status,
        verified: record.body && record.body.verified === true,
        questionCount: (record.body && record.body.questions || []).length
      }))
  }
}

function createMarketLauncher ({ room, userId, settlementMode = 'demo' } = {}) {
  if (!room || typeof room !== 'object') throw new TypeError('room is required')
  return {
    roomId: room.roomId,
    marketTypes: DEFAULT_MARKET_TYPES.map(marketType => ({
      marketType,
      options: livePrediction.marketOptionsFor(marketType),
      predictionShape: livePrediction.predictionShapeForMarket(marketType),
      inputTemplate: livePrediction.inputTemplateForMarket(marketType),
      commandDraft: {
        type: 'market:create',
        actorId: userId,
        payload: {
          roomId: room.roomId,
          competitionId: room.competitionId,
          fixtureId: room.fixtureId || null,
          marketType,
          options: livePrediction.marketOptionsFor(marketType),
          predictionShape: livePrediction.predictionShapeForMarket(marketType),
          inputTemplate: livePrediction.inputTemplateForMarket(marketType),
          scoringConfig: livePrediction.scoringConfigForMarket(marketType),
          mode: settlementMode
        }
      }
    }))
  }
}

function createMarketActionModel ({ market, userId, predictions = [], resolution = null, isHost = false } = {}) {
  if (!market || typeof market !== 'object') throw new TypeError('market is required')
  const userPrediction = predictions
    .filter(prediction => prediction.userId === userId)
    .sort(compareSubmitted)[0] || null
  const options = market.options && market.options.length
    ? cloneJson(market.options)
    : livePrediction.marketOptionsFor(market.marketType)

  return {
    marketId: market.marketId,
    roomId: market.roomId,
    competitionId: market.competitionId,
    fixtureId: market.fixtureId || null,
    marketType: market.marketType,
    mode: market.mode,
    status: market.status,
    options,
    predictionShape: market.predictionShape || livePrediction.predictionShapeForMarket(market.marketType),
    inputTemplate: cloneJson(market.inputTemplate || livePrediction.inputTemplateForMarket(market.marketType)),
    scoringConfig: cloneJson(market.scoringConfig || {}),
    predictionCount: predictions.length,
    userPrediction: userPrediction
      ? {
          predictionId: userPrediction.predictionId,
          outcome: cloneJson(userPrediction.outcome),
          status: userPrediction.status,
          submittedAt: userPrediction.submittedAt || null
        }
      : null,
    resolution: resolution
      ? {
          winnerUserIds: cloneJson(resolution.winnerUserIds || []),
          result: cloneJson(resolution.market && resolution.market.result || null),
          rowCount: (resolution.rows || []).length
        }
      : null,
    canPredict: market.status === 'open',
    canLock: isHost && market.status === 'open',
    canResolve: isHost && market.status === 'locked',
    commandDrafts: {
      predict: {
        type: 'market:predict',
        actorId: userId,
        payload: {
          marketId: market.marketId,
          outcome: cloneJson(market.inputTemplate || options[0] || null)
        }
      },
      lock: isHost
        ? {
            type: 'market:lock',
            actorId: userId,
            payload: {
              marketId: market.marketId
            }
          }
        : null,
      resolve: isHost
        ? {
            type: 'market:resolve',
            actorId: userId,
            payload: {
              marketId: market.marketId,
              result: options[0] || null
            }
          }
        : null
    }
  }
}

function createStreakBuilder ({ room, userId, resolutions = [] } = {}) {
  const resolvedMarketIds = resolutions
    .filter(resolution => resolution && resolution.market)
    .sort(compareMarketResolutionOrder)
    .map(resolution => resolution.market.marketId)
  return {
    roomId: room.roomId,
    resolvedMarketIds,
    ready: resolvedMarketIds.length > 0,
    commandDraft: {
      type: 'market:resolveStreak',
      actorId: userId,
      payload: {
        roomId: room.roomId,
        marketIds: resolvedMarketIds
      }
    }
  }
}

function createChallengeLauncher ({ room, userId, participants = [], stake = null } = {}) {
  const opponents = participants.filter(participant => participant.userId !== userId)
  const targetUserId = opponents[0] && opponents[0].userId || null
  const stakePayload = stake ? { stake: cloneJson(stake) } : {}
  return {
    roomId: room.roomId,
    opponents,
    challengeTypes: [
      ...DEFAULT_GAME_TYPES.map(gameType => ({
        challengeType: 'peer-game',
        gameType,
        label: titleize(gameType),
        commandDraft: {
          type: 'room:challenge',
          actorId: userId,
          payload: {
            roomId: room.roomId,
            targetUserId,
            challengeType: 'peer-game',
            gameType,
            ...stakePayload
          }
        }
      })),
      ...['next-event', 'momentum-duel', 'scoreline-lock', 'player-prop'].map(marketType => ({
        challengeType: 'live-prediction',
        marketType,
        label: titleize(marketType),
        commandDraft: {
          type: 'room:challenge',
          actorId: userId,
          payload: {
            roomId: room.roomId,
            targetUserId,
            challengeType: 'live-prediction',
            marketType,
            ...stakePayload
          }
        }
      })),
      {
        challengeType: 'head-to-head-duel',
        label: 'Head-to-head Bracket Duel',
        commandDraft: {
          type: 'room:challenge',
          actorId: userId,
          payload: {
            roomId: room.roomId,
            targetUserId,
            challengeType: 'head-to-head-duel',
            ...stakePayload,
            duel: {
              title: 'Head-to-head bracket duel'
            }
          }
        }
      },
      {
        challengeType: 'side-quest',
        label: 'Bracket Side Quest',
        commandDraft: {
          type: 'room:challenge',
          actorId: userId,
          payload: {
            roomId: room.roomId,
            targetUserId,
            challengeType: 'side-quest',
            ...stakePayload,
            sideQuest: {
              title: 'Bracket side quest',
              condition: 'semi-finalists-score-more'
            }
          }
        }
      }
    ]
  }
}

function createChallengeMaterializationModel ({ challenge, room, competition = null } = {}) {
  try {
    const materialization = challengeEngine.materializeAcceptedChallenge({
      challenge,
      room,
      competition,
      settlementMode: 'demo'
    })
    return {
      challengeId: challenge.challengeId,
      challengeType: challenge.challengeType,
      status: materialization.status,
      commandDraft: materialization.command,
      topics: cloneJson(materialization.topics || [])
    }
  } catch (error) {
    return {
      challengeId: challenge && challenge.challengeId || null,
      challengeType: challenge && challenge.challengeType || null,
      status: 'blocked',
      error: error.message
    }
  }
}

function createGameLauncher ({ room, userId, participants = [], settlementMode = 'demo' } = {}) {
  const players = [userId, ...participants.map(participant => participant.userId).filter(id => id !== userId)].slice(0, 2)
  return {
    roomId: room.roomId,
    gameTypes: DEFAULT_GAME_TYPES.map(gameType => ({
      gameType,
      label: titleize(gameType),
      commandDraft: {
        type: 'game:create',
        actorId: userId,
        payload: {
          roomId: room.roomId,
          gameType,
          players,
          stakeMode: settlementMode
        }
      }
    }))
  }
}

function createGameActionModel ({ game, userId, commitments = [], reveals = [], resolution = null } = {}) {
  if (!game || typeof game !== 'object') throw new TypeError('game is required')
  const playerCommitment = commitments.find(commitment => commitment.playerId === userId) || null
  const playerReveal = reveals.find(reveal => reveal.playerId === userId) || null
  const roundId = playerCommitment && playerCommitment.roundId || defaultRoundIdForGame(game.gameType)
  const inputTemplate = inputTemplateForGame(game.gameType)
  const nonce = `nonce-${userId}-${roundId}`

  return {
    gameId: game.gameId,
    roomId: game.roomId,
    gameType: game.gameType,
    status: game.status,
    players: cloneJson(game.players || []),
    currentUserRole: (game.players || []).includes(userId) ? 'player' : 'spectator',
    commitmentCount: commitments.length,
    revealCount: reveals.length,
    playerCommitment: playerCommitment ? cloneJson(playerCommitment) : null,
    playerReveal: playerReveal ? cloneJson(playerReveal) : null,
    resolution: resolution
      ? {
          winnerUserIds: cloneJson(resolution.winnerUserIds || []),
          tied: resolution.tied,
          rowCount: (resolution.rows || []).length
        }
      : null,
    commandDrafts: {
      start: game.status === 'invited'
        ? {
            type: 'game:start',
            actorId: userId,
            payload: {
              gameId: game.gameId
            }
          }
        : null,
      commit: {
        type: 'game:commit',
        actorId: userId,
        payload: {
          gameId: game.gameId,
          roundId,
          playerId: userId,
          input: inputTemplate,
          nonce
        }
      },
      reveal: playerCommitment
        ? {
            type: 'game:reveal',
            actorId: userId,
            payload: {
              gameId: game.gameId,
              roundId: playerCommitment.roundId,
              playerId: userId,
              input: inputTemplate,
              nonce
            }
          }
        : null,
      resolve: {
        type: 'game:resolve',
        actorId: userId,
        payload: {
          gameId: game.gameId,
          result: defaultResultForGame(game.gameType)
        }
      }
    }
  }
}

function roomSummary ({ view, room, userId }) {
  const participants = roomParticipants(view, room.roomId)
  const markets = values(view.markets).filter(market => market.roomId === room.roomId)
  const challenges = values(view.roomChallenges).filter(challenge => challenge.roomId === room.roomId)
  const games = values(view.gameSessions).filter(game => game.roomId === room.roomId)
  return {
    roomId: room.roomId,
    competitionId: room.competitionId,
    fixtureId: room.fixtureId || null,
    title: room.title,
    status: room.status,
    access: room.access,
    hostUserId: room.hostUserId || null,
    currentUserJoined: isJoined(view, room.roomId, userId),
    participantCount: participants.length,
    openMarketCount: markets.filter(market => market.status === 'open').length,
    activeChallengeCount: challenges.filter(challenge => challenge.status === 'pending' || challenge.status === 'accepted').length,
    activeGameCount: games.filter(game => game.status === 'invited' || game.status === 'active').length
  }
}

function challengeSummary ({ challenge, userId }) {
  return {
    challengeId: challenge.challengeId,
    roomId: challenge.roomId,
    challengeType: challenge.challengeType,
    gameType: challenge.gameType || null,
    marketType: challenge.marketType || null,
    duel: cloneJson(challenge.duel || null),
    sideQuest: cloneJson(challenge.sideQuest || null),
    stake: cloneJson(challenge.stake || null),
    status: challenge.status,
    challengerUserId: challenge.challengerUserId,
    targetUserId: challenge.targetUserId,
    opponentUserId: challenge.challengerUserId === userId ? challenge.targetUserId : challenge.challengerUserId,
    acceptCommand: challenge.targetUserId === userId && challenge.status === 'pending'
      ? {
          type: 'room:acceptChallenge',
          actorId: userId,
          payload: {
            challengeId: challenge.challengeId
          }
        }
      : null
  }
}

function roomParticipants (view, roomId) {
  return Object.values(view.roomParticipants && view.roomParticipants[roomId] || {})
    .filter(participant => participant.status !== 'left')
    .sort(compareParticipants)
    .map(participant => ({
      userId: participant.userId,
      username: participant.username,
      role: participant.role,
      joinedAt: participant.joinedAt || null
    }))
}

function isJoined (view, roomId, userId) {
  const participant = view.roomParticipants && view.roomParticipants[roomId] && view.roomParticipants[roomId][userId]
  return Boolean(participant && participant.status !== 'left')
}

function inputTemplateForGame (gameType) {
  if (gameType === 'penalty-clash') {
    return {
      shots: [
        { roundId: 'penalty-1', shot: 'left', power: 75 },
        { roundId: 'penalty-2', shot: 'right', power: 75 },
        { roundId: 'penalty-3', shot: 'center', power: 75 }
      ]
    }
  }
  if (gameType === 'free-kick-duel') {
    return {
      attempts: [
        { roundId: 'free-kick-1', aim: 'top-left', power: 78, curve: 6 },
        { roundId: 'free-kick-2', aim: 'top-right', power: 82, curve: -5 }
      ]
    }
  }
  if (gameType === 'trivia-duel') {
    return {
      answers: {
        q1: { answer: '', responseMs: 0 },
        q2: { answer: '', responseMs: 0 }
      }
    }
  }
  if (gameType === 'reaction-challenge') {
    return {
      taps: [
        { momentId: 'moment-1', reactionMs: 0 }
      ]
    }
  }
  return { score: 0 }
}

function defaultResultForGame (gameType) {
  if (gameType === 'trivia-duel') {
    return {
      correctAnswers: {
        q1: '',
        q2: ''
      }
    }
  }
  if (gameType === 'reaction-challenge') {
    return {
      moments: ['moment-1'],
      maxReactionMs: 2000
    }
  }
  if (gameType === 'free-kick-duel') return { attemptCount: 2 }
  if (gameType === 'penalty-clash') return { roundCount: 3 }
  return {}
}

function defaultRoundIdForGame (gameType) {
  if (gameType === 'trivia-duel') return 'trivia-main'
  if (gameType === 'reaction-challenge') return 'reaction-main'
  if (gameType === 'free-kick-duel') return 'free-kick-main'
  if (gameType === 'penalty-clash') return 'penalty-main'
  return 'round-1'
}

function titleize (value) {
  return String(value || '')
    .split('-')
    .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function compareTitles (left, right) {
  return String(left.title || left.roomId || left.gameId).localeCompare(String(right.title || right.roomId || right.gameId))
}

function compareParticipants (left, right) {
  if (left.role !== right.role) {
    if (left.role === 'host') return -1
    if (right.role === 'host') return 1
  }
  return String(left.username || left.userId).localeCompare(String(right.username || right.userId))
}

function compareMarketOrder (left, right) {
  const leftAt = left.opensAt || left.locksAt || left.marketId
  const rightAt = right.opensAt || right.locksAt || right.marketId
  return String(leftAt).localeCompare(String(rightAt))
}

function compareMarketResolutionOrder (left, right) {
  const leftAt = left.market && (left.market.resolvedAt || left.market.lockedAt || left.market.locksAt) || ''
  const rightAt = right.market && (right.market.resolvedAt || right.market.lockedAt || right.market.locksAt) || ''
  if (leftAt !== rightAt) return String(leftAt).localeCompare(String(rightAt))
  return String(left.market && left.market.marketId || '').localeCompare(String(right.market && right.market.marketId || ''))
}

function compareCreated (left, right) {
  return String(right.createdAt || '').localeCompare(String(left.createdAt || ''))
}

function compareSubmitted (left, right) {
  return String(right.submittedAt || '').localeCompare(String(left.submittedAt || ''))
}

function values (collection = {}) {
  return Object.values(collection || {})
}

module.exports = {
  DEFAULT_MARKET_TYPES,
  DEFAULT_GAME_TYPES,
  createWatchPartyWorkbench,
  createMarketLauncher,
  createMarketActionModel,
  createStreakBuilder,
  createChallengeLauncher,
  createChallengeMaterializationModel,
  createGameLauncher,
  createGameActionModel,
  roomSummary,
  inputTemplateForGame,
  defaultResultForGame,
  defaultRoundIdForGame
}
