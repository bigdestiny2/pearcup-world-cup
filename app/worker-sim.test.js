const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')
const receipts = require('./settlement-receipts.js')
const { createWorkerSim, eventEnvelope, validateEventEnvelope } = require('./worker-sim.js')

const gameId = 'pc-worker-test'
const roundId = 'pc-1'
const shooter = { id: 'user-captain', username: 'captain', teamId: 'br' }
const keeper = { id: 'user-vera', username: 'vera', teamId: 'no' }
const shooterInput = {
  role: 'shooter',
  aimZone: 'right-high',
  powerBand: 3,
  curveBand: 1,
  releaseTick: 42
}
const keeperInput = {
  role: 'keeper',
  diveZone: 'right-high',
  releaseTick: 43
}

function submitRoundEvidence (worker, { stateHashes = true } = {}) {
  const shooterCommitment = core.createCommitment({
    gameId,
    roundId,
    playerId: shooter.id,
    input: shooterInput,
    nonce: 'shooter-nonce'
  })
  const keeperCommitment = core.createCommitment({
    gameId,
    roundId,
    playerId: keeper.id,
    input: keeperInput,
    nonce: 'keeper-nonce'
  })

  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, commitment: shooterCommitment }
  })
  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, commitment: keeperCommitment }
  })
  worker.dispatch({
    type: 'game:revealInput',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, input: shooterInput, nonce: 'shooter-nonce' }
  })
  worker.dispatch({
    type: 'game:revealInput',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, input: keeperInput, nonce: 'keeper-nonce' }
  })

  if (stateHashes) {
    const stateHash = expectedRoundStateHash()
    worker.dispatch({
      type: 'game:submitRoundStateHash',
      actorId: shooter.id,
      payload: { gameId, roundId, playerId: shooter.id, stateHash }
    })
    worker.dispatch({
      type: 'game:submitRoundStateHash',
      actorId: keeper.id,
      payload: { gameId, roundId, playerId: keeper.id, stateHash }
    })
  }
}

function submitForfeitEvidence (worker) {
  const shooterCommitment = core.createCommitment({
    gameId,
    roundId,
    playerId: shooter.id,
    input: shooterInput,
    nonce: 'shooter-nonce'
  })
  const keeperCommitment = core.createCommitment({
    gameId,
    roundId,
    playerId: keeper.id,
    input: keeperInput,
    nonce: 'keeper-nonce'
  })

  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, commitment: shooterCommitment }
  })
  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, commitment: keeperCommitment }
  })
  worker.dispatch({
    type: 'game:revealInput',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, input: shooterInput, nonce: 'shooter-nonce' }
  })
}

function externalEvent (worker, type, payload, actorId = 'external-peer') {
  const events = worker.events()
  return eventEnvelope({
    type,
    actorId,
    payload,
    previousEventId: events.length ? events[events.length - 1].eventId : null,
    sequence: events.length + 1
  })
}

function recordOfficialResultsSnapshot (worker, {
  poolId,
  officialResults = { champion: 'Brazil' },
  rulesVersion = 'bracket-pool-v1',
  source = 'trusted-results-feed',
  sourceActorId = 'official-results-feed'
} = {}) {
  return worker.dispatch({
    type: 'results:recordOfficialSnapshot',
    actorId: sourceActorId,
    payload: { poolId, officialResults, rulesVersion, source, sourceActorId }
  })
}

function resealReceipt (receipt) {
  const { receiptId, receiptHash, ...payload } = receipt
  const nextHash = core.deterministicHash(payload)
  return {
    receiptId: core.deterministicHash({ receiptVersion: payload.receiptVersion, receiptHash: nextHash }),
    receiptHash: nextHash,
    ...payload
  }
}

function trustedSdkAdapters ({
  qvacId = 'qvac-sdk-test',
  wdkId = 'tether-wdk-sdk-test',
  qvacOverrides = {},
  tetherWdkOverrides = {}
} = {}) {
  const qvac = {
    id: qvacId,
    mode: 'sdk',
    attestRound ({ roundResult }) {
      return core.createQvacRefereeAttestation({ roundResult, refereeId: qvacId })
    },
    attestPoolSettlement ({ poolResult }) {
      return core.createQvacPoolSettlementAttestation({ poolResult, refereeId: qvacId })
    },
    ...qvacOverrides
  }
  const tetherWdk = {
    id: wdkId,
    mode: 'sdk',
    createGameEscrow (input) {
      return core.createTetherWdkEscrowIntent({ ...input, rail: wdkId })
    },
    releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
      return core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
    },
    disputeGameEscrow ({ gameId, roundId, escrowId, reason }) {
      return {
        disputeId: core.deterministicHash({ gameId, roundId, escrowId, reason }),
        gameId,
        roundId,
        escrowId,
        reason,
        status: 'held'
      }
    },
    createEntryIntent (input) {
      return core.createTetherWdkEntryIntent({ ...input, rail: wdkId })
    },
    confirmEntryIntent (input) {
      return core.confirmTetherWdkEntryIntent(input)
    },
    createPoolPayout (input) {
      return core.createTetherWdkPoolPayout({ ...input, rail: wdkId })
    },
    ...tetherWdkOverrides
  }
  return {
    qvac,
    tetherWdk,
    mode: { qvac: qvac.mode, tetherWdk: tetherWdk.mode }
  }
}

function expectedRoundStateHash () {
  return core.createPenaltyClashRound({
    gameId,
    roundIndex: 0,
    shooter,
    keeper,
    shooterInput,
    keeperInput,
    shooterNonce: 'shooter-nonce',
    keeperNonce: 'keeper-nonce'
  }).stateHash
}

test('worker creates replayable P2P game sessions from signed invites', () => {
  const worker = createWorkerSim()
  const invite = worker.dispatch({
    type: 'game:invite',
    actorId: shooter.id,
    payload: {
      roomId: 'room-br-no',
      mode: 'private',
      inviterUsername: shooter.username,
      inviterTeamId: shooter.teamId,
      opponentUserId: keeper.id,
      opponentUsername: keeper.username,
      opponentTeamId: keeper.teamId
    }
  })
  assert.equal(invite.type, 'GameInviteCreated')
  assert.equal(invite.actorId, shooter.id)
  assert.equal(invite.payload.topic, `pearcup:v1:game:${invite.payload.gameId}`)

  const started = worker.dispatch({
    type: 'game:acceptInvite',
    actorId: keeper.id,
    payload: { gameId: invite.payload.gameId }
  })
  assert.equal(started.type, 'GameSessionStarted')
  assert.deepEqual(started.payload.sourceEventIds, [
    invite.eventId,
    worker.events().find(event => event.type === 'GameInviteAccepted').eventId
  ])

  const spectator = worker.dispatch({
    type: 'game:join',
    actorId: 'user-milo',
    payload: {
      gameId: invite.payload.gameId,
      userId: 'user-milo',
      username: 'milo',
      teamId: 'ar',
      asSpectator: true
    }
  })
  assert.equal(spectator.type, 'GameSessionJoined')

  const view = worker.view()
  assert.equal(view.openGameInvites[invite.payload.gameId], undefined)
  assert.equal(view.gameSessions[invite.payload.gameId].status, 'playing')
  assert.equal(view.gameSessionsByRoom['room-br-no'][invite.payload.gameId].gameId, invite.payload.gameId)
  assert.deepEqual(Object.keys(view.gameParticipants[invite.payload.gameId]).sort(), [shooter.id, keeper.id].sort())
  assert.equal(view.gameSpectators[invite.payload.gameId]['user-milo'].username, 'milo')

  const peer = createWorkerSim()
  assert.equal(peer.mergeEvents(worker.events()), 4)
  assert.equal(peer.view().gameSessions[invite.payload.gameId].topicHash, invite.payload.topicHash)
  assert.equal(peer.view().gameSpectators[invite.payload.gameId]['user-milo'].teamId, 'ar')
})

test('worker rejects forged game session lifecycle events during commands and peer merge', () => {
  const worker = createWorkerSim()
  const rejectedInvite = worker.dispatch({
    type: 'game:invite',
    actorId: 'user-forger',
    payload: {
      inviterUserId: shooter.id,
      opponentUserId: keeper.id
    }
  })
  assert.equal(rejectedInvite.type, 'GameInviteRejected')
  assert.match(rejectedInvite.payload.reason, /actorId must match inviter/)

  const rejectedAccept = worker.dispatch({
    type: 'game:acceptInvite',
    actorId: 'user-other',
    payload: { gameId: 'missing-game' }
  })
  assert.equal(rejectedAccept.type, 'GameSessionDisputed')
  assert.match(rejectedAccept.payload.reason, /valid signed game invite/)

  const source = createWorkerSim()
  const invite = source.dispatch({
    type: 'game:invite',
    actorId: shooter.id,
    payload: {
      gameId: 'pc-forged-session',
      opponentUserId: keeper.id,
      opponentUsername: keeper.username
    }
  })
  source.dispatch({
    type: 'game:acceptInvite',
    actorId: keeper.id,
    payload: { gameId: invite.payload.gameId }
  })
  const accepted = source.events().find(event => event.type === 'GameInviteAccepted')
  const started = source.events().find(event => event.type === 'GameSessionStarted')
  const forgedStart = eventEnvelope({
    type: 'GameSessionStarted',
    actorId: shooter.id,
    payload: started.payload,
    previousEventId: accepted.eventId,
    sequence: started.sequence
  })

  const peer = createWorkerSim()
  assert.equal(peer.mergeEvents([invite, accepted, forgedStart]), 2)
  assert.equal(peer.view().gameSessions[invite.payload.gameId], undefined)
  assert.equal(peer.view().gameInviteAcceptances[invite.payload.gameId].acceptedByUserId, keeper.id)
})

test('worker session view scores deterministic Penalty Clash rounds', () => {
  const worker = createWorkerSim()
  worker.dispatch({
    type: 'game:invite',
    actorId: shooter.id,
    payload: {
      gameId,
      roomId: 'room-scoreboard',
      opponentUserId: keeper.id,
      opponentUsername: keeper.username
    }
  })
  worker.dispatch({
    type: 'game:acceptInvite',
    actorId: keeper.id,
    payload: { gameId }
  })
  submitRoundEvidence(worker)
  const resolved = worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'settlement-worker',
    payload: { gameId, roundId, shooter, keeper }
  })
  assert.equal(resolved.type, 'GameRoundResolved')

  const session = worker.view().gameSessions[gameId]
  assert.equal(session.currentRound, 1)
  assert.equal(session.score[keeper.id], 1)
  assert.equal(session.score[shooter.id], 0)
})

test('worker binds WDK game escrows to replayed game sessions', () => {
  const worker = createWorkerSim()
  const invite = worker.dispatch({
    type: 'game:invite',
    actorId: shooter.id,
    payload: {
      gameId: 'pc-session-escrow',
      mode: 'private',
      opponentUserId: keeper.id,
      opponentUsername: keeper.username,
      stake: { amount: 7, asset: 'USDT' },
      prizeMode: true
    }
  })
  const started = worker.dispatch({
    type: 'game:acceptInvite',
    actorId: keeper.id,
    payload: { gameId: invite.payload.gameId }
  })
  const escrow = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: { gameId: invite.payload.gameId, prizeMode: true }
  })

  assert.equal(escrow.type, 'TetherWdkEscrowCreated')
  assert.equal(escrow.payload.gameId, invite.payload.gameId)
  assert.equal(escrow.payload.sessionId, started.payload.sessionId)
  assert.equal(escrow.payload.sessionEventId, started.eventId)
  assert.deepEqual(escrow.payload.sourceEventIds, [started.eventId])
  assert.deepEqual(escrow.payload.players, [shooter.id, keeper.id])
  assert.equal(escrow.payload.amount, 7)
  assert.equal(escrow.payload.stakeHash, core.deterministicHash({ amount: 7, asset: 'USDT' }))
  assert.equal(escrow.payload.prizeMode, true)

  const view = worker.view()
  assert.equal(view.escrowsByGame[invite.payload.gameId].escrowId, escrow.payload.escrowId)
  assert.equal(view.escrowsBySession[started.payload.sessionId].escrowId, escrow.payload.escrowId)

  const peer = createWorkerSim()
  assert.equal(peer.mergeEvents([escrow]), 0)
  assert.equal(Object.keys(peer.view().escrows).length, 0)
  assert.equal(peer.mergeEvents(worker.events()), 4)
  assert.equal(peer.view().escrowsBySession[started.payload.sessionId].escrowId, escrow.payload.escrowId)
})

test('worker holds session-bound WDK game escrows with mismatched participants', () => {
  const worker = createWorkerSim()
  worker.dispatch({
    type: 'game:invite',
    actorId: shooter.id,
    payload: {
      gameId: 'pc-session-escrow-mismatch',
      opponentUserId: keeper.id,
      stake: { amount: 9, asset: 'USDT' },
      prizeMode: true
    }
  })
  worker.dispatch({
    type: 'game:acceptInvite',
    actorId: keeper.id,
    payload: { gameId: 'pc-session-escrow-mismatch' }
  })

  const disputed = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId: 'pc-session-escrow-mismatch',
      players: [shooter.id, 'user-forger'],
      amount: 9,
      asset: 'USDT',
      prizeMode: true
    }
  })

  assert.equal(disputed.type, 'TetherWdkEscrowDisputed')
  assert.equal(disputed.actorId, disputed.payload.rail)
  assert.match(disputed.payload.reason, /players must match replayed game session/)
  assert.equal(Object.keys(worker.view().escrows).length, 0)
})

test('worker owns watch-party room chat voice and stream state', () => {
  const worker = createWorkerSim()
  const joined = worker.dispatch({
    type: 'room:join',
    actorId: shooter.id,
    payload: {
      matchId: 'match-br-no',
      userId: shooter.id,
      username: shooter.username,
      teamId: shooter.teamId
    }
  })
  const chat = worker.dispatch({
    type: 'chat:send',
    actorId: shooter.id,
    payload: {
      roomId: joined.payload.roomId,
      userId: shooter.id,
      username: shooter.username,
      teamId: shooter.teamId,
      body: 'Brazil press is finally synced.',
      clientNonce: 'chat-nonce-1'
    }
  })
  const voice = worker.dispatch({
    type: 'voice:update',
    actorId: shooter.id,
    payload: {
      roomId: joined.payload.roomId,
      userId: shooter.id,
      status: 'speaking',
      muted: false
    }
  })
  const rejectedStream = worker.dispatch({
    type: 'stream:start',
    actorId: shooter.id,
    payload: {
      roomId: joined.payload.roomId,
      userId: shooter.id,
      rightsConfirmed: false
    }
  })
  const stream = worker.dispatch({
    type: 'stream:start',
    actorId: shooter.id,
    payload: {
      roomId: joined.payload.roomId,
      userId: shooter.id,
      source: 'match-visualization',
      rightsConfirmed: true
    }
  })
  const stopped = worker.dispatch({
    type: 'stream:stop',
    actorId: shooter.id,
    payload: {
      roomId: joined.payload.roomId,
      streamId: stream.payload.streamId,
      userId: shooter.id
    }
  })

  assert.equal(joined.type, 'RoomJoined')
  assert.equal(chat.type, 'ChatMessageSent')
  assert.equal(voice.type, 'VoiceStateUpdated')
  assert.equal(rejectedStream.type, 'StreamStartRejected')
  assert.match(rejectedStream.payload.reason, /rights/)
  assert.equal(stream.type, 'StreamStarted')
  assert.equal(stopped.type, 'StreamStopped')

  const view = worker.view()
  assert.equal(view.roomsByMatch['match-br-no'][joined.payload.roomId].topic, 'pearcup:v1:room:match-br-no')
  assert.equal(view.roomParticipants[joined.payload.roomId][shooter.id].teamId, shooter.teamId)
  assert.equal(view.chatMessagesByRoom[joined.payload.roomId][0].body, 'Brazil press is finally synced.')
  assert.equal(view.chatMessagesByRoom[joined.payload.roomId][0].clientNonce, 'chat-nonce-1')
  assert.equal(view.voiceStatesByRoom[joined.payload.roomId][shooter.id].status, 'speaking')
  assert.equal(view.streams[stream.payload.streamId].status, 'stopped')
  assert.equal(view.activeStreams[stream.payload.streamId], undefined)
})

test('worker owns signed profile and bracket draft state', () => {
  const worker = createWorkerSim()
  const profile = worker.dispatch({
    type: 'profile:set',
    actorId: shooter.id,
    payload: {
      userId: shooter.id,
      username: shooter.username,
      teamId: shooter.teamId
    }
  })
  const draft = worker.dispatch({
    type: 'bracket:updateDraft',
    actorId: shooter.id,
    payload: {
      poolId: 'world-cup-25',
      userId: shooter.id,
      username: shooter.username,
      teamId: shooter.teamId,
      picks: {
        'r16-1': 'br',
        'r16-2': 'no'
      }
    }
  })
  const reset = worker.dispatch({
    type: 'bracket:resetDraft',
    actorId: shooter.id,
    payload: {
      poolId: 'world-cup-25',
      userId: shooter.id
    }
  })

  assert.equal(profile.type, 'ProfileUpdated')
  assert.equal(draft.type, 'BracketDraftUpdated')
  assert.equal(reset.type, 'BracketDraftUpdated')
  assert.equal(worker.view().profiles[shooter.id].teamId, shooter.teamId)
  assert.deepEqual(worker.view().bracketDraftsByPool['world-cup-25'][shooter.id].picks, {})
})

test('worker rejects forged profile and bracket draft peer events', () => {
  const source = createWorkerSim()
  const profile = source.dispatch({
    type: 'profile:set',
    actorId: keeper.id,
    payload: {
      userId: keeper.id,
      username: keeper.username,
      teamId: keeper.teamId
    }
  })
  const draft = source.dispatch({
    type: 'bracket:updateDraft',
    actorId: keeper.id,
    payload: {
      poolId: 'world-cup-50',
      userId: keeper.id,
      picks: { 'r16-1': 'jp' }
    }
  })
  const forgedProfile = eventEnvelope({
    type: 'ProfileUpdated',
    actorId: shooter.id,
    payload: profile.payload,
    previousEventId: null,
    sequence: 1
  })
  const forgedDraft = eventEnvelope({
    type: 'BracketDraftUpdated',
    actorId: shooter.id,
    payload: draft.payload,
    previousEventId: forgedProfile.eventId,
    sequence: 2
  })

  const peer = createWorkerSim()
  assert.equal(peer.mergeEvents([forgedProfile, forgedDraft]), 0)
  assert.equal(Object.keys(peer.view().profiles).length, 0)
  assert.equal(Object.keys(peer.view().bracketDrafts).length, 0)
  assert.equal(peer.mergeEvents([profile, draft]), 2)
  assert.equal(peer.view().profiles[keeper.id].teamId, keeper.teamId)
  assert.equal(peer.view().bracketDraftsByPool['world-cup-50'][keeper.id].picks['r16-1'], 'jp')
})

test('worker rejects peer watch-party events without signed room membership', () => {
  const source = createWorkerSim()
  const joined = source.dispatch({
    type: 'room:join',
    actorId: keeper.id,
    payload: {
      matchId: 'match-br-no-forged',
      userId: keeper.id,
      username: keeper.username,
      teamId: keeper.teamId
    }
  })
  const chat = source.dispatch({
    type: 'chat:send',
    actorId: keeper.id,
    payload: {
      roomId: joined.payload.roomId,
      userId: keeper.id,
      body: 'Norway counter is coming.'
    }
  })
  const stream = source.dispatch({
    type: 'stream:start',
    actorId: keeper.id,
    payload: {
      roomId: joined.payload.roomId,
      userId: keeper.id,
      source: 'match-visualization',
      rightsConfirmed: true
    }
  })
  const forgedChat = eventEnvelope({
    type: 'ChatMessageSent',
    actorId: shooter.id,
    payload: chat.payload,
    previousEventId: joined.eventId,
    sequence: chat.sequence + 20
  })
  const forgedStream = eventEnvelope({
    type: 'StreamStarted',
    actorId: shooter.id,
    payload: stream.payload,
    previousEventId: joined.eventId,
    sequence: stream.sequence + 20
  })

  const peer = createWorkerSim()
  assert.equal(peer.mergeEvents([chat, stream]), 0)
  assert.equal(peer.mergeEvents([joined, forgedChat, forgedStream]), 1)
  assert.equal(Object.keys(peer.view().chatMessages).length, 0)
  assert.equal(Object.keys(peer.view().streams).length, 0)
  assert.equal(peer.mergeEvents([chat, stream]), 2)
  assert.equal(Object.keys(peer.view().chatMessages).length, 1)
  assert.equal(Object.keys(peer.view().activeStreams).length, 1)
})

test('worker ingests source-signed match events and derives live stat snapshots', () => {
  const worker = createWorkerSim()
  const rejected = worker.dispatch({
    type: 'match:ingestEvent',
    actorId: 'user-attacker',
    payload: {
      matchId: 'match-brazil-norway',
      sourceActorId: 'sports-feed',
      clock: '63:12',
      type: 'goal',
      teamId: 'br'
    }
  })
  const goal = worker.dispatch({
    type: 'match:ingestEvent',
    actorId: 'sports-feed',
    payload: {
      matchId: 'match-brazil-norway',
      clock: '63:12',
      period: '2H',
      type: 'goal',
      teamId: 'br',
      value: 0.34
    }
  })
  worker.dispatch({
    type: 'match:ingestEvent',
    actorId: 'sports-feed',
    payload: {
      matchId: 'match-brazil-norway',
      clock: '64:10',
      period: '2H',
      type: 'shot',
      teamId: 'br',
      value: 'on-target'
    }
  })
  worker.dispatch({
    type: 'match:ingestEvent',
    actorId: 'sports-feed',
    payload: {
      matchId: 'match-brazil-norway',
      clock: '64:20',
      period: '2H',
      type: 'save',
      teamId: 'no'
    }
  })
  const view = worker.view()
  const stats = view.statSnapshots['match-brazil-norway']

  assert.equal(rejected.type, 'MatchEventRejected')
  assert.equal(goal.type, 'MatchEventIngested')
  assert.equal(goal.actorId, 'sports-feed')
  assert.equal(stats.clock, '64:20')
  assert.equal(stats.score.br, 1)
  assert.equal(stats.shots.br, 2)
  assert.equal(stats.shotsOnTarget.br, 2)
  assert.equal(stats.xg.br, 0.34)
  assert.equal(stats.saves.no, 1)
  assert.equal(stats.threat.br, 'medium')
})

test('worker generates cached QVAC commentary from replayed match events', () => {
  const worker = createWorkerSim()
  worker.dispatch({
    type: 'match:ingestEvent',
    actorId: 'sports-feed',
    payload: {
      matchId: 'match-brazil-norway',
      clock: '63:12',
      type: 'goal',
      teamId: 'br',
      value: 0.34
    }
  })
  worker.dispatch({
    type: 'match:ingestEvent',
    actorId: 'sports-feed',
    payload: {
      matchId: 'match-brazil-norway',
      clock: '64:10',
      type: 'shot',
      teamId: 'br',
      value: 'on-target'
    }
  })
  worker.dispatch({
    type: 'commentary:setLanguage',
    actorId: 'user-captain',
    payload: { matchId: 'match-brazil-norway', language: 'pt' }
  })
  const generated = worker.dispatch({
    type: 'commentary:generate',
    actorId: 'room-host',
    payload: {
      matchId: 'match-brazil-norway',
      roomPickDistribution: { br: 2, no: 1 },
      tone: 'analyst'
    }
  })
  const eventCount = worker.events().length
  const repeated = worker.dispatch({
    type: 'commentary:generate',
    actorId: 'room-host',
    payload: {
      matchId: 'match-brazil-norway',
      roomPickDistribution: { br: 2, no: 1 },
      tone: 'analyst'
    }
  })
  const view = worker.view()
  const segments = view.commentaryByMatchLanguage['match-brazil-norway:PT']

  assert.equal(generated.type, 'CommentaryGenerated')
  assert.equal(generated.actorId, 'qvac-demo-commentary')
  assert.equal(generated.payload.language, 'PT')
  assert.equal(generated.payload.sourceEventIds.length, 2)
  assert.equal(generated.payload.eventHash, core.deterministicHash(generated.payload.sourceEventIds))
  assert.match(generated.payload.text, /\[PT\]/)
  assert.equal(repeated.eventId, generated.eventId)
  assert.equal(worker.events().length, eventCount)
  assert.equal(segments.length, 1)
  assert.equal(segments[0].segmentId, generated.payload.segmentId)
})

test('worker rejects peer commentary not signed by QVAC or missing source events', () => {
  const source = createWorkerSim()
  const matchEvent = source.dispatch({
    type: 'match:ingestEvent',
    actorId: 'sports-feed',
    payload: {
      matchId: 'match-brazil-norway',
      clock: '64:10',
      type: 'shot',
      teamId: 'br',
      value: 'on-target'
    }
  })
  const commentaryEvent = source.dispatch({
    type: 'commentary:generate',
    actorId: 'room-host',
    payload: { matchId: 'match-brazil-norway', language: 'EN' }
  })
  const forged = eventEnvelope({
    type: 'CommentaryGenerated',
    actorId: 'user-attacker',
    payload: commentaryEvent.payload,
    previousEventId: matchEvent.eventId,
    sequence: commentaryEvent.sequence + 10
  })
  const peer = createWorkerSim()

  assert.equal(peer.mergeEvents([commentaryEvent]), 0)
  assert.equal(peer.mergeEvents([matchEvent, forged]), 1)
  assert.equal(Object.keys(peer.view().commentarySegments).length, 0)
  assert.equal(peer.mergeEvents([commentaryEvent]), 1)
  assert.equal(Object.keys(peer.view().commentarySegments).length, 1)
})

test('worker emits signed chained event envelopes', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  const commitmentEvent = worker.dispatch({
    type: 'game:submitCommitment',
    actorId: shooter.id,
    payload: {
      gameId,
      roundId,
      playerId: shooter.id,
      commitment: core.createCommitment({ gameId, roundId, playerId: shooter.id, input: shooterInput, nonce: 'shooter-nonce' })
    }
  })

  assert.equal(escrowEvent.previousEventId, null)
  assert.equal(commitmentEvent.previousEventId, escrowEvent.eventId)
  assert.ok(commitmentEvent.signature.startsWith('0x'))
})

test('worker completes QVAC-attested Tether WDK game settlement flow', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)

  const resolved = worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  const attested = worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })
  const released = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })
  const view = worker.view()
  const sourceEvents = worker.events().filter(event =>
    event.type === 'GameCommitmentSubmitted' ||
    event.type === 'GameInputRevealed' ||
    event.type === 'GameRoundStateHashSubmitted')
  const sourceEventIds = sourceEvents.map(event => event.eventId)

  assert.equal(resolved.type, 'GameRoundResolved')
  assert.equal(resolved.payload.outcome, 'save')
  assert.deepEqual(resolved.payload.sourceEventIds, sourceEventIds)
  assert.equal(escrowEvent.actorId, escrowEvent.payload.rail)
  assert.equal(attested.type, 'QvacRefereeAttestationCreated')
  assert.equal(attested.actorId, attested.payload.refereeId)
  assert.equal(attested.payload.ruling, 'save')
  assert.deepEqual(attested.payload.sourceEventIds, sourceEventIds)
  assert.equal(released.type, 'TetherWdkEscrowReleased')
  assert.equal(released.actorId, released.payload.rail)
  assert.equal(released.payload.rail, escrowEvent.payload.rail)
  assert.equal(released.payload.winnerUserId, keeper.id)
  assert.equal(Object.keys(view.commitments).length, 2)
  assert.equal(Object.keys(view.reveals).length, 2)
  assert.equal(Object.keys(view.payouts).length, 1)
  assert.equal(view.disputes.length, 0)
})

test('worker binds matching peer state hashes into QVAC round evidence before WDK release', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker, { stateHashes: false })
  const stateHash = expectedRoundStateHash()
  const shooterHash = worker.dispatch({
    type: 'game:submitRoundStateHash',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, stateHash }
  })
  const keeperHash = worker.dispatch({
    type: 'game:submitRoundStateHash',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, stateHash }
  })

  const resolved = worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  const attested = worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })
  const released = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })

  assert.equal(resolved.type, 'GameRoundResolved')
  assert.deepEqual([...resolved.payload.peerStateHashEventIds].sort(), [shooterHash.eventId, keeperHash.eventId].sort())
  assert.ok(resolved.payload.sourceEventIds.includes(shooterHash.eventId))
  assert.ok(resolved.payload.sourceEventIds.includes(keeperHash.eventId))
  assert.deepEqual([...attested.payload.sourceEventIds].sort(), [...resolved.payload.sourceEventIds].sort())
  assert.equal(released.type, 'TetherWdkEscrowReleased')
  assert.equal(worker.view().typeCounts.GameRoundStateHashSubmitted, 2)
})

test('worker disputes mismatched peer state hashes before QVAC can attest the round', () => {
  const worker = createWorkerSim()
  submitRoundEvidence(worker, { stateHashes: false })
  worker.dispatch({
    type: 'game:submitRoundStateHash',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, stateHash: '0xtampered-state-hash' }
  })
  worker.dispatch({
    type: 'game:submitRoundStateHash',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, stateHash: expectedRoundStateHash() }
  })

  const resolved = worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  const attested = worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })

  assert.equal(resolved.type, 'GameSessionDisputed')
  assert.match(resolved.payload.reason, /Peer state hash mismatch/)
  assert.equal(attested.type, 'GameSessionDisputed')
  assert.match(attested.payload.reason, /Round result is required/)
  assert.equal(worker.view().typeCounts.GameRoundResolved || 0, 0)
  assert.equal(worker.view().typeCounts.QvacRefereeAttestationCreated || 0, 0)
})

test('worker requires every participant state hash before QVAC and WDK settlement', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker, { stateHashes: false })
  worker.dispatch({
    type: 'game:submitRoundStateHash',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, stateHash: expectedRoundStateHash() }
  })

  const resolved = worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  const attested = worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })
  const released = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })

  assert.equal(resolved.type, 'GameSessionDisputed')
  assert.match(resolved.payload.reason, /Peer state hash missing for user-vera/)
  assert.equal(attested.type, 'GameSessionDisputed')
  assert.match(attested.payload.reason, /Round result is required/)
  assert.equal(released.type, 'TetherWdkEscrowDisputed')
  assert.match(released.payload.reason, /Round result is required/)
  assert.equal(worker.view().typeCounts.GameRoundResolved || 0, 0)
  assert.equal(worker.view().typeCounts.QvacRefereeAttestationCreated || 0, 0)
  assert.equal(worker.view().typeCounts.TetherWdkEscrowReleased || 0, 0)
})

test('worker rejects local round evidence submitted for another player', () => {
  const worker = createWorkerSim()
  const commitment = core.createCommitment({
    gameId,
    roundId,
    playerId: keeper.id,
    input: keeperInput,
    nonce: 'keeper-nonce'
  })

  const disputedCommitment = worker.dispatch({
    type: 'game:submitCommitment',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: keeper.id, commitment }
  })
  const disputedStateHash = worker.dispatch({
    type: 'game:submitRoundStateHash',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: keeper.id, stateHash: expectedRoundStateHash() }
  })

  assert.equal(disputedCommitment.type, 'GameSessionDisputed')
  assert.match(disputedCommitment.payload.reason, /Commitment actorId must match playerId/)
  assert.equal(disputedStateHash.type, 'GameSessionDisputed')
  assert.match(disputedStateHash.payload.reason, /Peer state hash actorId must match playerId/)
  assert.equal(worker.view().typeCounts.GameCommitmentSubmitted || 0, 0)
  assert.equal(worker.view().typeCounts.GameRoundStateHashSubmitted || 0, 0)
})

test('worker refuses QVAC attestation for replayed round evidence signed by another player', () => {
  const worker = createWorkerSim()
  const mergeExternal = (type, payload, actorId) => {
    const event = externalEvent(worker, type, payload, actorId)
    worker.mergeEvents([event])
    return event
  }
  const shooterCommitment = core.createCommitment({
    gameId,
    roundId,
    playerId: shooter.id,
    input: shooterInput,
    nonce: 'shooter-nonce'
  })
  const keeperCommitment = core.createCommitment({
    gameId,
    roundId,
    playerId: keeper.id,
    input: keeperInput,
    nonce: 'keeper-nonce'
  })
  const shooterCommitmentEvent = mergeExternal('GameCommitmentSubmitted', {
    gameId,
    roundId,
    playerId: shooter.id,
    commitment: shooterCommitment
  }, shooter.id)
  const keeperCommitmentEvent = mergeExternal('GameCommitmentSubmitted', {
    gameId,
    roundId,
    playerId: keeper.id,
    commitment: keeperCommitment
  }, shooter.id)
  const shooterRevealEvent = mergeExternal('GameInputRevealed', {
    gameId,
    roundId,
    playerId: shooter.id,
    input: shooterInput,
    nonce: 'shooter-nonce'
  }, shooter.id)
  const keeperRevealEvent = mergeExternal('GameInputRevealed', {
    gameId,
    roundId,
    playerId: keeper.id,
    input: keeperInput,
    nonce: 'keeper-nonce'
  }, keeper.id)
  const stateHash = expectedRoundStateHash()
  const shooterHashEvent = mergeExternal('GameRoundStateHashSubmitted', {
    gameId,
    roundId,
    roundIndex: 0,
    playerId: shooter.id,
    stateHash,
    resolverVersion: core.resolverVersion,
    submittedAt: '2026-07-01T00:00:00.000Z'
  }, shooter.id)
  const keeperHashEvent = mergeExternal('GameRoundStateHashSubmitted', {
    gameId,
    roundId,
    roundIndex: 0,
    playerId: keeper.id,
    stateHash,
    resolverVersion: core.resolverVersion,
    submittedAt: '2026-07-01T00:00:00.000Z'
  }, keeper.id)
  const roundResult = core.createPenaltyClashRound({
    gameId,
    roundIndex: 0,
    shooter,
    keeper,
    shooterInput,
    keeperInput,
    shooterNonce: 'shooter-nonce',
    keeperNonce: 'keeper-nonce',
    sourceEventIds: [
      shooterCommitmentEvent.eventId,
      keeperCommitmentEvent.eventId,
      shooterRevealEvent.eventId,
      keeperRevealEvent.eventId,
      shooterHashEvent.eventId,
      keeperHashEvent.eventId
    ]
  })
  roundResult.peerStateHashEventIds = [shooterHashEvent.eventId, keeperHashEvent.eventId]
  mergeExternal('GameRoundResolved', roundResult, 'external-peer')

  const attested = worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })

  assert.equal(attested.type, 'GameSessionDisputed')
  assert.match(attested.payload.reason, /signer must match playerId/)
  assert.equal(worker.view().typeCounts.QvacRefereeAttestationCreated || 0, 0)
})

test('worker records timeout forfeit evidence before QVAC-attested WDK release', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitForfeitEvidence(worker)

  const resolved = worker.dispatch({
    type: 'game:recordForfeit',
    actorId: shooter.id,
    payload: {
      gameId,
      roundId,
      shooter,
      keeper,
      forfeitingPlayerId: keeper.id,
      reason: 'reveal-timeout'
    }
  })
  const forfeitEvent = worker.events().find(event => event.type === 'GameRoundForfeitRecorded')
  const attested = worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })
  const released = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: shooter.id
    }
  })
  const wrongWinner = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })

  assert.equal(resolved.type, 'GameRoundResolved')
  assert.equal(resolved.payload.outcome, 'forfeit')
  assert.equal(resolved.payload.winnerUserId, shooter.id)
  assert.equal(resolved.payload.forfeitingPlayerId, keeper.id)
  assert.equal(resolved.payload.claimantUserId, shooter.id)
  assert.equal(forfeitEvent.payload.claimantUserId, shooter.id)
  assert.equal(forfeitEvent.actorId, shooter.id)
  assert.ok(resolved.payload.sourceEventIds.includes(forfeitEvent.eventId))
  assert.equal(attested.type, 'QvacRefereeAttestationCreated')
  assert.equal(attested.payload.ruling, 'forfeit')
  assert.equal(attested.payload.winnerUserId, shooter.id)
  assert.deepEqual([...attested.payload.sourceEventIds].sort(), [...resolved.payload.sourceEventIds].sort())
  assert.equal(released.type, 'TetherWdkEscrowReleased')
  assert.equal(released.payload.winnerUserId, shooter.id)
  assert.equal(wrongWinner.type, 'TetherWdkEscrowDisputed')
  assert.match(wrongWinner.payload.reason, /Winner must match QVAC-decided round outcome/)
})

test('worker rejects timeout forfeit claims not signed by the winning claimant', () => {
  const worker = createWorkerSim()
  submitForfeitEvidence(worker)

  const rejected = worker.dispatch({
    type: 'game:recordForfeit',
    actorId: keeper.id,
    payload: {
      gameId,
      roundId,
      shooter,
      keeper,
      forfeitingPlayerId: keeper.id,
      winnerUserId: shooter.id,
      reason: 'reveal-timeout'
    }
  })

  assert.equal(rejected.type, 'GameSessionDisputed')
  assert.match(rejected.payload.reason, /Forfeit claim must be signed by winning claimant/)
  assert.equal(worker.view().typeCounts.GameRoundForfeitRecorded || 0, 0)
  assert.equal(worker.view().typeCounts.GameRoundResolved || 0, 0)
})

test('worker refuses QVAC attestation for replayed forfeit evidence signed by a non-claimant', () => {
  const worker = createWorkerSim()
  submitForfeitEvidence(worker)
  const priorSourceEventIds = worker.events()
    .filter(event => event.type === 'GameCommitmentSubmitted' || event.type === 'GameInputRevealed')
    .map(event => event.eventId)
  const forfeitEvent = externalEvent(worker, 'GameRoundForfeitRecorded', {
    gameId,
    roundId,
    roundIndex: 0,
    forfeitingPlayerId: keeper.id,
    winnerUserId: shooter.id,
    claimantUserId: shooter.id,
    reason: 'reveal-timeout',
    evidenceEventIds: priorSourceEventIds,
    recordedAt: '2026-07-01T00:00:00.000Z'
  }, keeper.id)
  worker.mergeEvents([forfeitEvent])
  const roundResult = core.createPenaltyClashForfeitRound({
    gameId,
    roundIndex: 0,
    roundId,
    shooter,
    keeper,
    forfeitingPlayerId: keeper.id,
    winnerUserId: shooter.id,
    claimantUserId: shooter.id,
    reason: 'reveal-timeout',
    sourceEventIds: [...priorSourceEventIds, forfeitEvent.eventId]
  })
  worker.mergeEvents([
    externalEvent(worker, 'GameRoundResolved', roundResult, 'external-peer')
  ])

  const attested = worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })

  assert.equal(attested.type, 'GameSessionDisputed')
  assert.match(attested.payload.reason, /Forfeit source event signer must match claimantUserId/)
  assert.equal(worker.view().typeCounts.QvacRefereeAttestationCreated || 0, 0)
})

test('worker refuses WDK release to a player who did not win the QVAC round', () => {
  let releaseCalled = false
  const worker = createWorkerSim({
    adapters: {
      qvac: {
        id: 'qvac-winner-binding-test',
        mode: 'sdk',
        attestRound ({ roundResult }) {
          return core.createQvacRefereeAttestation({ roundResult, refereeId: 'qvac-winner-binding-test' })
        },
        attestPoolSettlement ({ poolResult }) {
          return core.createQvacPoolSettlementAttestation({ poolResult, refereeId: 'qvac-winner-binding-test' })
        }
      },
      tetherWdk: {
        id: 'tether-wdk-winner-binding-test',
        mode: 'sdk',
        createGameEscrow (input) {
          return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-winner-binding-test' })
        },
        releaseGameEscrow () {
          releaseCalled = true
          throw new Error('release should not run when winner does not match QVAC')
        },
        disputeGameEscrow ({ gameId, roundId, escrowId, reason }) {
          return {
            disputeId: core.deterministicHash({ gameId, roundId, escrowId, reason }),
            gameId,
            roundId,
            escrowId,
            reason,
            status: 'held'
          }
        },
        createEntryIntent (input) {
          return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-winner-binding-test' })
        },
        confirmEntryIntent (input) {
          return core.confirmTetherWdkEntryIntent(input)
        },
        createPoolPayout (input) {
          return core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-winner-binding-test' })
        }
      },
      mode: { qvac: 'sdk', tetherWdk: 'sdk' }
    }
  })
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-winner-binding-test',
    payload: { gameId, roundId }
  })

  const release = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-winner-binding-test',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: shooter.id
    }
  })

  assert.equal(release.type, 'TetherWdkEscrowDisputed')
  assert.equal(releaseCalled, false)
  assert.match(release.payload.reason, /Winner must match QVAC-decided round outcome/)
  assert.equal(worker.view().typeCounts.TetherWdkEscrowReleased || 0, 0)
})

test('worker disputes WDK escrow release output that does not match replayed QVAC evidence', () => {
  const worker = createWorkerSim({
    adapters: trustedSdkAdapters({
      qvacId: 'qvac-wdk-output-test',
      wdkId: 'tether-wdk-output-test',
      tetherWdkOverrides: {
        releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
          const payout = core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
          return { ...payout, qvacAttestationId: '0xtampered-attestation' }
        }
      }
    })
  })
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-wdk-output-test',
    payload: { gameId, roundId }
  })

  const release = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-output-test',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })

  assert.equal(release.type, 'TetherWdkEscrowDisputed')
  assert.match(release.payload.reason, /WDK escrow release output did not match replayed QVAC/)
  assert.equal(worker.view().typeCounts.TetherWdkEscrowReleased || 0, 0)
})

test('worker trusted game settlement command resolves, asks QVAC, then releases WDK', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)

  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const eventCount = worker.events().length
  const repeatSummary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })

  assert.equal(summary.type, 'TrustedGameSettlementCompleted')
  assert.equal(summary.status, 'prepared')
  assert.equal(summary.roundEvent.type, 'GameRoundResolved')
  assert.equal(summary.attestationEvent.type, 'QvacRefereeAttestationCreated')
  assert.equal(summary.settlementEvent.type, 'TetherWdkEscrowReleased')
  assert.equal(summary.settlementEvent.payload.winnerUserId, keeper.id)
  assert.ok(summary.roundEvent.sequence < summary.attestationEvent.sequence)
  assert.ok(summary.attestationEvent.sequence < summary.settlementEvent.sequence)
  assert.equal(repeatSummary.settlementEvent.eventId, summary.settlementEvent.eventId)
  assert.equal(worker.events().length, eventCount)
})

test('worker trusted game settlement passes winner recipient route to WDK release', () => {
  let capturedReleaseInput = null
  const tetherWdk = {
    id: 'tether-wdk-game-recipient-route-test',
    mode: 'sdk',
    createGameEscrow (input) {
      return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-game-recipient-route-test' })
    },
    releaseGameEscrow (input) {
      capturedReleaseInput = input
      return core.releaseTetherWdkEscrow(input)
    },
    createEntryIntent (input) {
      return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-game-recipient-route-test' })
    },
    confirmEntryIntent (input) {
      return core.confirmTetherWdkEntryIntent(input)
    },
    createPoolPayout (input) {
      return core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-game-recipient-route-test' })
    }
  }
  const worker = createWorkerSim({
    adapters: {
      qvac: {
        id: 'qvac-game-recipient-route-test',
        mode: 'demo',
        attestRound ({ roundResult }) {
          return core.createQvacRefereeAttestation({ roundResult, refereeId: 'qvac-game-recipient-route-test' })
        },
        attestPoolSettlement ({ poolResult }) {
          return core.createQvacPoolSettlementAttestation({ poolResult, refereeId: 'qvac-game-recipient-route-test' })
        }
      },
      tetherWdk,
      mode: { qvac: 'demo', tetherWdk: 'sdk' }
    }
  })
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  const payoutRecipients = { [keeper.id]: '0xkeeperrecipient' }

  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId,
      payoutRecipients
    }
  })

  assert.equal(summary.settlementEvent.type, 'TetherWdkEscrowReleased')
  assert.deepEqual(capturedReleaseInput.payoutRecipients, payoutRecipients)
  assert.equal(capturedReleaseInput.payoutAddress, undefined)
  assert.equal(capturedReleaseInput.winnerUserId, keeper.id)
})

test('worker retries route-blocked game settlement after recipient route is supplied', () => {
  const tetherWdk = {
    id: 'tether-wdk-game-recipient-retry-test',
    mode: 'sdk',
    createGameEscrow (input) {
      return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-game-recipient-retry-test' })
    },
    releaseGameEscrow (input) {
      const payout = core.releaseTetherWdkEscrow(input)
      const recipient = input.payoutAddress ||
        input.payoutRecipients && input.payoutRecipients[input.winnerUserId]
      return {
        ...payout,
        processorRelease: recipient
          ? {
              id: `game-retry-release-${input.escrow.escrowId}`,
              status: 'quoted',
              escrowId: input.escrow.escrowId,
              winnerUserId: input.winnerUserId,
              broadcast: false,
              transfers: [{
                userId: input.winnerUserId,
                recipient,
                status: 'quoted',
                baseAmount: '5000000'
              }]
            }
          : {
              id: `game-retry-release-${input.escrow.escrowId}`,
              status: 'recipient-required',
              escrowId: input.escrow.escrowId,
              winnerUserId: input.winnerUserId,
              broadcast: false,
              transfers: []
            }
      }
    },
    createEntryIntent (input) {
      return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-game-recipient-retry-test' })
    },
    confirmEntryIntent (input) {
      return core.confirmTetherWdkEntryIntent(input)
    },
    createPoolPayout (input) {
      return core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-game-recipient-retry-test' })
    }
  }
  const worker = createWorkerSim({
    adapters: {
      qvac: {
        id: 'qvac-game-recipient-retry-test',
        mode: 'demo',
        attestRound ({ roundResult }) {
          return core.createQvacRefereeAttestation({ roundResult, refereeId: 'qvac-game-recipient-retry-test' })
        },
        attestPoolSettlement ({ poolResult }) {
          return core.createQvacPoolSettlementAttestation({ poolResult, refereeId: 'qvac-game-recipient-retry-test' })
        }
      },
      tetherWdk,
      mode: { qvac: 'demo', tetherWdk: 'sdk' }
    }
  })
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)

  const blocked = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const blockedRepeat = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const completed = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId,
      payoutRecipients: { [keeper.id]: '0xkeeperretryrecipient' }
    }
  })

  assert.equal(blocked.type, 'TrustedGameSettlementHeld')
  assert.equal(blocked.status, 'recipient-required')
  assert.equal(blocked.settlementEvent.payload.processorRelease.status, 'recipient-required')
  assert.equal(blockedRepeat.settlementEvent.eventId, blocked.settlementEvent.eventId)
  assert.equal(completed.type, 'TrustedGameSettlementCompleted')
  assert.equal(completed.status, 'prepared')
  assert.equal(completed.settlementEvent.payload.processorRelease.status, 'quoted')
  assert.equal(completed.settlementEvent.payload.processorRelease.transfers[0].recipient, '0xkeeperretryrecipient')
  assert.equal(worker.view().typeCounts.TetherWdkEscrowReleased, 2)
})

test('worker trusted game settlement holds when roundId and roundIndex disagree', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)

  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      roundId: 'pc-2',
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const view = worker.view()

  assert.equal(summary.type, 'TrustedGameSettlementHeld')
  assert.equal(summary.roundEvent.type, 'GameSessionDisputed')
  assert.match(summary.roundEvent.payload.reason, /does not match roundIndex/)
  assert.equal(summary.roundEvent.payload.expectedRoundId, 'pc-1')
  assert.equal(summary.attestationEvent, undefined)
  assert.equal(summary.settlementEvent, undefined)
  assert.equal(view.typeCounts.QvacRefereeAttestationCreated || 0, 0)
  assert.equal(view.typeCounts.TetherWdkEscrowReleased || 0, 0)
})

test('worker trusted game settlement holds when round evidence is incomplete', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })

  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const view = worker.view()

  assert.equal(summary.type, 'TrustedGameSettlementHeld')
  assert.equal(summary.roundEvent.type, 'GameSessionDisputed')
  assert.equal(summary.attestationEvent, undefined)
  assert.equal(summary.settlementEvent, undefined)
  assert.equal(view.typeCounts.QvacRefereeAttestationCreated || 0, 0)
  assert.equal(view.typeCounts.TetherWdkEscrowReleased || 0, 0)
  assert.equal(view.disputes.length, 1)
})

test('worker trusted game settlement holds a tampered existing QVAC attestation', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  const roundEvent = worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  const attestation = core.createQvacRefereeAttestation({ roundResult: roundEvent.payload })
  const tamperedAttestationEvent = externalEvent(worker, 'QvacRefereeAttestationCreated', {
    ...attestation,
    stateHash: '0xtampered',
    signature: '0xsigned-tampered'
  }, 'qvac-demo-ref')
  worker.mergeEvents([tamperedAttestationEvent])

  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const view = worker.view()

  assert.equal(summary.type, 'TrustedGameSettlementHeld')
  assert.equal(summary.attestationEvent.eventId, tamperedAttestationEvent.eventId)
  assert.equal(summary.settlementEvent.type, 'TetherWdkEscrowDisputed')
  assert.match(summary.settlementEvent.payload.reason, /stateHash/)
  assert.match(summary.settlementEvent.payload.reason, /signature/)
  assert.equal(view.typeCounts.TetherWdkEscrowReleased || 0, 0)
})

test('worker trusted game settlement can refund a held WDK escrow dispute', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)

  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: shooter.id,
      refundOnDispute: true,
      refundReason: 'trusted-referee-held'
    }
  })
  const view = worker.view()
  const eventCount = worker.events().length
  const repeated = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })

  assert.equal(summary.type, 'TrustedGameSettlementHeld')
  assert.equal(summary.status, 'refunded')
  assert.equal(summary.attestationEvent.type, 'QvacRefereeAttestationCreated')
  assert.equal(summary.settlementEvent.type, 'TetherWdkEscrowRefunded')
  assert.equal(summary.settlementEvent.actorId, summary.settlementEvent.payload.rail)
  assert.equal(summary.settlementEvent.payload.reason, 'trusted-referee-held')
  assert.deepEqual(summary.settlementEvent.payload.refundUserIds, [shooter.id, keeper.id])
  assert.equal(view.typeCounts.TetherWdkEscrowDisputed, 1)
  assert.equal(view.typeCounts.TetherWdkEscrowRefunded, 1)
  assert.equal(view.typeCounts.TetherWdkEscrowReleased || 0, 0)
  assert.equal(repeated.settlementEvent.eventId, summary.settlementEvent.eventId)
  assert.equal(worker.events().length, eventCount)
})

test('worker rejects replayed QVAC round attestations not signed by the referee actor', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  const roundEvent = worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  const attestation = core.createQvacRefereeAttestation({ roundResult: roundEvent.payload })
  const forgedAttestationEvent = externalEvent(worker, 'QvacRefereeAttestationCreated', attestation, 'user-attacker')

  assert.equal(worker.mergeEvents([forgedAttestationEvent]), 0)
  assert.equal(worker.view().typeCounts.QvacRefereeAttestationCreated || 0, 0)

  const release = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id,
      qvacAttestation: attestation
    }
  })

  assert.equal(release.type, 'TetherWdkEscrowDisputed')
  assert.match(release.payload.reason, /QVAC attestation event/)
  assert.equal(worker.view().typeCounts.TetherWdkEscrowReleased || 0, 0)
})

test('worker refuses QVAC attestation when round source events are not in the log', () => {
  const worker = createWorkerSim()
  const roundResult = core.createPenaltyClashRound({
    gameId,
    roundIndex: 0,
    shooter,
    keeper,
    shooterInput,
    keeperInput
  })
  worker.mergeEvents([
    externalEvent(worker, 'GameRoundResolved', roundResult, 'external-peer')
  ])

  const attested = worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })

  assert.equal(attested.type, 'GameSessionDisputed')
  assert.match(attested.payload.reason, /source event/)
  assert.equal(worker.view().typeCounts.QvacRefereeAttestationCreated || 0, 0)
})

test('worker rejects invalid QVAC round adapter output before logging an attestation', () => {
  const worker = createWorkerSim({
    adapters: {
      qvac: {
        id: 'qvac-invalid-round-output-test',
        mode: 'sdk',
        attestRound ({ roundResult }) {
          return {
            attestationId: 'sdk-round-no-referee',
            gameId: roundResult.gameId,
            roundId: roundResult.roundId,
            resolverVersion: roundResult.resolverVersion,
            ruling: roundResult.outcome,
            winnerUserId: core.winnerUserIdForRoundResult(roundResult),
            participantUserIds: core.participantUserIdsForRoundResult(roundResult),
            stateHash: roundResult.stateHash,
            sourceEventIds: roundResult.sourceEventIds,
            signature: 'arbitrary-sdk-signature'
          }
        },
        attestPoolSettlement ({ poolResult }) {
          return core.createQvacPoolSettlementAttestation({
            poolResult,
            refereeId: 'qvac-invalid-round-output-test'
          })
        }
      }
    }
  })
  submitRoundEvidence(worker)
  worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })

  const attested = worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-invalid-round-output-test',
    payload: { gameId, roundId }
  })

  assert.equal(attested.type, 'GameSessionDisputed')
  assert.match(attested.payload.reason, /failed verification/)
  assert.match(attested.payload.reason, /refereeId/)
  assert.equal(worker.view().typeCounts.QvacRefereeAttestationCreated || 0, 0)
})

test('WDK release refuses QVAC evidence whose source events are missing from the log', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  const roundResult = core.createPenaltyClashRound({
    gameId,
    roundIndex: 0,
    shooter,
    keeper,
    shooterInput,
    keeperInput
  })
  const roundEvent = externalEvent(worker, 'GameRoundResolved', roundResult, 'external-peer')
  worker.mergeEvents([roundEvent])
  const attestationEvent = externalEvent(
    worker,
    'QvacRefereeAttestationCreated',
    core.createQvacRefereeAttestation({ roundResult }),
    'qvac-demo-ref'
  )
  worker.mergeEvents([attestationEvent])

  const release = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })

  assert.equal(release.type, 'TetherWdkEscrowDisputed')
  assert.match(release.payload.reason, /source event/)
  assert.equal(worker.view().typeCounts.TetherWdkEscrowReleased || 0, 0)
})

test('two peers converge after exchanging trusted settlement events', () => {
  const peerA = createWorkerSim()
  const escrowEvent = peerA.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(peerA)
  peerA.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  peerA.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })
  peerA.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })

  const peerB = createWorkerSim()
  const merged = peerB.mergeEvents(peerA.events())
  const duplicateMerged = peerB.mergeEvents(peerA.events())

  assert.equal(merged, peerA.events().length)
  assert.equal(duplicateMerged, 0)
  assert.equal(peerB.view().eventRoot, peerA.view().eventRoot)
  assert.equal(Object.keys(peerB.view().payouts).length, 1)
  assert.equal(peerB.view().typeCounts.TetherWdkEscrowReleased, 1)
})

test('worker rejects forged peer event envelopes before they affect payout state', () => {
  const source = createWorkerSim()
  const escrowEvent = source.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(source)
  source.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  source.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })
  source.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })
  const releaseEvent = source.events().find(event => event.type === 'TetherWdkEscrowReleased')
  const forgedRelease = {
    ...releaseEvent,
    payload: {
      ...releaseEvent.payload,
      winnerUserId: shooter.id
    }
  }
  const peer = createWorkerSim()

  const verification = validateEventEnvelope(forgedRelease)
  assert.equal(verification.ok, false)
  assert.match(verification.errors.join('; '), /eventId/)
  assert.match(verification.errors.join('; '), /signature/)
  assert.equal(peer.mergeEvents([forgedRelease]), 0)
  assert.equal(peer.events().length, 0)
  assert.equal(Object.keys(peer.view().payouts).length, 0)
})

test('worker rejects orphan merged game settlement artifacts without replay dependencies', () => {
  const source = createWorkerSim()
  const escrowEvent = source.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(source)
  source.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  source.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })
  source.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })
  const releaseEvent = source.events().find(event => event.type === 'TetherWdkEscrowReleased')
  const receiptEvent = eventEnvelope({
    type: 'SettlementReceiptCreated',
    actorId: 'settlement-auditor',
    payload: {
      receiptId: 'receipt-orphan-game',
      receiptHash: 'receipt-hash-orphan-game',
      events: {
        result: { eventId: 'evt-missing-round', type: 'GameRoundResolved' },
        attestation: { eventId: 'evt-missing-attestation', type: 'QvacRefereeAttestationCreated' },
        settlement: { eventId: releaseEvent.eventId, type: 'TetherWdkEscrowReleased' }
      }
    },
    previousEventId: null,
    sequence: 1
  })
  const peer = createWorkerSim()

  assert.equal(peer.mergeEvents([releaseEvent]), 0)
  assert.equal(peer.mergeEvents([receiptEvent]), 0)
  assert.equal(Object.keys(peer.view().payouts).length, 0)
  assert.equal(Object.keys(peer.view().settlementReceipts).length, 0)

  const fullReplay = [releaseEvent, ...source.events().filter(event => event.eventId !== releaseEvent.eventId)]
  assert.equal(peer.mergeEvents(fullReplay), source.events().length)
  assert.equal(peer.view().eventRoot, source.view().eventRoot)
  assert.equal(Object.keys(peer.view().payouts).length, 1)
})

test('worker rejects orphan merged pool payouts without replay dependencies', () => {
  const source = createWorkerSim()
  const intent = source.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-orphan-merge', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  source.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-orphan-merge' }
  })
  recordOfficialResultsSnapshot(source, { poolId: 'pool-orphan-merge' })
  source.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId: 'pool-orphan-merge',
      winnerUserIds: ['user-captain'],
      officialResults: { champion: 'Brazil' },
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const payoutEvent = source.events().find(event => event.type === 'TetherWdkPoolPayoutPrepared')
  const peer = createWorkerSim()

  assert.equal(peer.mergeEvents([payoutEvent]), 0)
  assert.equal(Object.keys(peer.view().poolPayouts).length, 0)

  const fullReplay = [payoutEvent, ...source.events().filter(event => event.eventId !== payoutEvent.eventId)]
  assert.equal(peer.mergeEvents(fullReplay), source.events().length)
  assert.equal(peer.view().eventRoot, source.view().eventRoot)
  assert.equal(Object.keys(peer.view().poolPayouts).length, 1)
})

test('worker rejects resealed peer game releases that do not match replayed QVAC winner', () => {
  const source = createWorkerSim()
  const escrowEvent = source.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(source)
  const summary = source.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const releaseEvent = summary.settlementEvent
  const badReleaseEvent = eventEnvelope({
    type: 'TetherWdkEscrowReleased',
    actorId: releaseEvent.actorId,
    payload: {
      ...releaseEvent.payload,
      winnerUserId: shooter.id
    },
    previousEventId: releaseEvent.previousEventId,
    sequence: releaseEvent.sequence
  })
  const sourceWithoutRelease = source.events().filter(event => event.eventId !== releaseEvent.eventId)
  const peer = createWorkerSim()

  assert.equal(peer.mergeEvents([...sourceWithoutRelease, badReleaseEvent]), sourceWithoutRelease.length)
  assert.equal(Object.keys(peer.view().payouts).length, 0)
  assert.equal(peer.view().typeCounts.TetherWdkEscrowReleased || 0, 0)

  assert.equal(peer.mergeEvents([releaseEvent]), 1)
  assert.equal(peer.view().typeCounts.TetherWdkEscrowReleased, 1)
})

test('worker rejects peer game releases not signed by the WDK rail', () => {
  const source = createWorkerSim()
  const escrowEvent = source.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(source)
  const summary = source.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const releaseEvent = summary.settlementEvent
  const forgedReleaseEvent = eventEnvelope({
    type: 'TetherWdkEscrowReleased',
    actorId: 'user-attacker',
    payload: releaseEvent.payload,
    previousEventId: releaseEvent.previousEventId,
    sequence: releaseEvent.sequence
  })
  const sourceWithoutRelease = source.events().filter(event => event.eventId !== releaseEvent.eventId)
  const peer = createWorkerSim()

  assert.equal(peer.mergeEvents([...sourceWithoutRelease, forgedReleaseEvent]), sourceWithoutRelease.length)
  assert.equal(Object.keys(peer.view().payouts).length, 0)
  assert.equal(peer.view().typeCounts.TetherWdkEscrowReleased || 0, 0)

  assert.equal(peer.mergeEvents([releaseEvent]), 1)
  assert.equal(peer.view().typeCounts.TetherWdkEscrowReleased, 1)
})

test('worker rejects peer game escrows not signed by the WDK rail', () => {
  const source = createWorkerSim()
  const escrowEvent = source.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(source)
  const summary = source.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const forgedEscrowEvent = eventEnvelope({
    type: 'TetherWdkEscrowCreated',
    actorId: 'user-attacker',
    payload: escrowEvent.payload,
    previousEventId: escrowEvent.previousEventId,
    sequence: escrowEvent.sequence
  })
  const sourceWithoutEscrowAndRelease = source.events().filter(event =>
    event.eventId !== escrowEvent.eventId &&
    event.eventId !== summary.settlementEvent.eventId)
  const peer = createWorkerSim()

  assert.equal(peer.mergeEvents([...sourceWithoutEscrowAndRelease, forgedEscrowEvent, summary.settlementEvent]), sourceWithoutEscrowAndRelease.length)
  assert.equal(Object.keys(peer.view().escrows).length, 0)
  assert.equal(Object.keys(peer.view().payouts).length, 0)
  assert.equal(peer.view().typeCounts.TetherWdkEscrowCreated || 0, 0)
  assert.equal(peer.view().typeCounts.TetherWdkEscrowReleased || 0, 0)

  assert.equal(peer.mergeEvents([escrowEvent, summary.settlementEvent]), 2)
  assert.equal(peer.view().typeCounts.TetherWdkEscrowCreated, 1)
  assert.equal(peer.view().typeCounts.TetherWdkEscrowReleased, 1)
})

test('worker rejects resealed peer pool payouts that do not match replayed QVAC winners', () => {
  const source = createWorkerSim()
  const captainIntent = source.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-resealed-payout', entryId: 'entry-captain', userId: shooter.id, username: 'captain', amount: 25, asset: 'USDT' }
  })
  const veraIntent = source.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-vera',
    payload: { poolId: 'pool-resealed-payout', entryId: 'entry-vera', userId: keeper.id, username: 'vera', amount: 25, asset: 'USDT' }
  })
  source.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: captainIntent.payload.intentId, confirmationId: 'confirm-captain-resealed' }
  })
  source.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: veraIntent.payload.intentId, confirmationId: 'confirm-vera-resealed' }
  })
  recordOfficialResultsSnapshot(source, { poolId: 'pool-resealed-payout' })
  const summary = source.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId: 'pool-resealed-payout',
      winnerUserIds: [shooter.id],
      officialResults: { champion: 'Brazil' },
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const payoutEvent = summary.settlementEvent
  const badPayoutEvent = eventEnvelope({
    type: 'TetherWdkPoolPayoutPrepared',
    actorId: payoutEvent.actorId,
    payload: {
      ...payoutEvent.payload,
      winnerUserIds: [keeper.id]
    },
    previousEventId: payoutEvent.previousEventId,
    sequence: payoutEvent.sequence
  })
  const sourceWithoutPayout = source.events().filter(event => event.eventId !== payoutEvent.eventId)
  const peer = createWorkerSim()

  assert.equal(peer.mergeEvents([...sourceWithoutPayout, badPayoutEvent]), sourceWithoutPayout.length)
  assert.equal(Object.keys(peer.view().poolPayouts).length, 0)
  assert.equal(peer.view().typeCounts.TetherWdkPoolPayoutPrepared || 0, 0)

  assert.equal(peer.mergeEvents([payoutEvent]), 1)
  assert.equal(peer.view().typeCounts.TetherWdkPoolPayoutPrepared, 1)
})

test('worker rejects peer pool payouts not signed by the WDK rail', () => {
  const source = createWorkerSim()
  const captainIntent = source.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-forged-payout-signer', entryId: 'entry-captain', userId: shooter.id, username: 'captain', amount: 25, asset: 'USDT' }
  })
  const veraIntent = source.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-vera',
    payload: { poolId: 'pool-forged-payout-signer', entryId: 'entry-vera', userId: keeper.id, username: 'vera', amount: 25, asset: 'USDT' }
  })
  source.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: captainIntent.payload.intentId, confirmationId: 'confirm-captain-forged-signer' }
  })
  source.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: veraIntent.payload.intentId, confirmationId: 'confirm-vera-forged-signer' }
  })
  recordOfficialResultsSnapshot(source, { poolId: 'pool-forged-payout-signer' })
  const summary = source.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId: 'pool-forged-payout-signer',
      winnerUserIds: [shooter.id],
      officialResults: { champion: 'Brazil' },
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const payoutEvent = summary.settlementEvent
  const forgedPayoutEvent = eventEnvelope({
    type: 'TetherWdkPoolPayoutPrepared',
    actorId: 'user-attacker',
    payload: payoutEvent.payload,
    previousEventId: payoutEvent.previousEventId,
    sequence: payoutEvent.sequence
  })
  const sourceWithoutPayout = source.events().filter(event => event.eventId !== payoutEvent.eventId)
  const peer = createWorkerSim()

  assert.equal(peer.mergeEvents([...sourceWithoutPayout, forgedPayoutEvent]), sourceWithoutPayout.length)
  assert.equal(Object.keys(peer.view().poolPayouts).length, 0)
  assert.equal(peer.view().typeCounts.TetherWdkPoolPayoutPrepared || 0, 0)

  assert.equal(peer.mergeEvents([payoutEvent]), 1)
  assert.equal(peer.view().typeCounts.TetherWdkPoolPayoutPrepared, 1)
})

test('worker rejects peer settlement receipts whose event refs do not match replayed payloads', () => {
  const source = createWorkerSim()
  const escrowEvent = source.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(source)
  const summary = source.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const receipt = receipts.createSettlementReceipt({
    summary,
    eventRoot: source.view().eventRoot
  })
  const receiptEvent = source.dispatch({
    type: 'settlement:recordReceipt',
    actorId: 'settlement-auditor',
    payload: { receipt }
  })
  const badReceipt = resealReceipt({
    ...receipt,
    events: {
      ...receipt.events,
      result: {
        ...receipt.events.result,
        payloadHash: '0xwrongpayloadhash'
      }
    }
  })
  const badReceiptEvent = eventEnvelope({
    type: 'SettlementReceiptCreated',
    actorId: receiptEvent.actorId,
    payload: badReceipt,
    previousEventId: receiptEvent.previousEventId,
    sequence: receiptEvent.sequence
  })
  const sourceWithoutReceipt = source.events().filter(event => event.eventId !== receiptEvent.eventId)
  const peer = createWorkerSim()

  assert.equal(receipts.verifySettlementReceipt(badReceipt).ok, true)
  assert.equal(peer.mergeEvents([...sourceWithoutReceipt, badReceiptEvent]), sourceWithoutReceipt.length)
  assert.equal(Object.keys(peer.view().settlementReceipts).length, 0)
  assert.equal(peer.view().typeCounts.SettlementReceiptCreated || 0, 0)

  assert.equal(peer.mergeEvents([receiptEvent]), 1)
  assert.equal(peer.view().typeCounts.SettlementReceiptCreated, 1)
})

test('worker rejects peer settlement receipts whose event refs do not match replayed actors', () => {
  const source = createWorkerSim()
  const escrowEvent = source.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(source)
  const summary = source.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const receipt = receipts.createSettlementReceipt({
    summary,
    eventRoot: source.view().eventRoot
  })
  const receiptEvent = source.dispatch({
    type: 'settlement:recordReceipt',
    actorId: 'settlement-auditor',
    payload: { receipt }
  })
  const badReceipt = resealReceipt({
    ...receipt,
    events: {
      ...receipt.events,
      settlement: {
        ...receipt.events.settlement,
        actorId: 'forged-wdk-rail'
      }
    },
    wdk: {
      ...receipt.wdk,
      eventActorId: 'forged-wdk-rail',
      rail: 'forged-wdk-rail'
    }
  })
  const badReceiptEvent = eventEnvelope({
    type: 'SettlementReceiptCreated',
    actorId: receiptEvent.actorId,
    payload: badReceipt,
    previousEventId: receiptEvent.previousEventId,
    sequence: receiptEvent.sequence
  })
  const sourceWithoutReceipt = source.events().filter(event => event.eventId !== receiptEvent.eventId)
  const peer = createWorkerSim()

  assert.equal(receipts.verifySettlementReceipt(badReceipt).ok, true)
  assert.equal(peer.mergeEvents([...sourceWithoutReceipt, badReceiptEvent]), sourceWithoutReceipt.length)
  assert.equal(Object.keys(peer.view().settlementReceipts).length, 0)
  assert.equal(peer.view().typeCounts.SettlementReceiptCreated || 0, 0)

  assert.equal(peer.mergeEvents([receiptEvent]), 1)
  assert.equal(peer.view().typeCounts.SettlementReceiptCreated, 1)
})

test('WDK release before QVAC attestation becomes a dispute event', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  const release = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })

  assert.equal(release.type, 'TetherWdkEscrowDisputed')
  assert.equal(release.actorId, release.payload.rail)
  assert.equal(release.payload.rail, 'tether-wdk-demo')
  assert.match(release.payload.reason, /Round result is required/)
  assert.equal(worker.view().typeCounts.TetherWdkEscrowDisputed, 1)
})

test('worker rejects peer WDK escrow disputes not signed by the WDK rail', () => {
  const source = createWorkerSim()
  const escrowEvent = source.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  const disputeEvent = source.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })
  const forgedDisputeEvent = eventEnvelope({
    type: 'TetherWdkEscrowDisputed',
    actorId: 'user-attacker',
    payload: disputeEvent.payload,
    previousEventId: disputeEvent.previousEventId,
    sequence: disputeEvent.sequence
  })
  const sourceWithoutDispute = source.events().filter(event => event.eventId !== disputeEvent.eventId)
  const peer = createWorkerSim()

  assert.equal(disputeEvent.actorId, disputeEvent.payload.rail)
  assert.equal(peer.mergeEvents([...sourceWithoutDispute, forgedDisputeEvent]), sourceWithoutDispute.length)
  assert.equal(peer.view().typeCounts.TetherWdkEscrowDisputed || 0, 0)
  assert.equal(peer.view().disputes.length, 0)

  assert.equal(peer.mergeEvents([disputeEvent]), 1)
  assert.equal(peer.view().typeCounts.TetherWdkEscrowDisputed, 1)
  assert.equal(peer.view().disputes.length, 1)
})

test('worker refunds held game escrows only after a rail-signed WDK dispute', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId: 'pc-refund-held', players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  const rejected = worker.dispatch({
    type: 'wdk:refundGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: { escrowId: escrowEvent.payload.escrowId, reason: 'match-cancelled' }
  })
  const dispute = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId: 'pc-refund-held',
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })
  const refund = worker.dispatch({
    type: 'wdk:refundGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: { escrowId: escrowEvent.payload.escrowId, reason: 'match-cancelled' }
  })
  const view = worker.view()

  assert.equal(rejected.type, 'TetherWdkEscrowRefundRejected')
  assert.match(rejected.payload.reason, /dispute is required/)
  assert.equal(dispute.type, 'TetherWdkEscrowDisputed')
  assert.equal(refund.type, 'TetherWdkEscrowRefunded')
  assert.equal(refund.actorId, refund.payload.rail)
  assert.equal(refund.payload.amountEach, 2.5)
  assert.deepEqual(refund.payload.refundUserIds, [shooter.id, keeper.id])
  assert.equal(view.escrowRefundsByEscrow[escrowEvent.payload.escrowId].refundId, refund.payload.refundId)
})

test('worker rejects peer WDK escrow refunds not signed by the WDK rail', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId: 'pc-forged-refund', players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId: 'pc-forged-refund',
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })
  const refund = core.refundTetherWdkEscrow({
    escrow: escrowEvent.payload,
    reason: 'match-cancelled'
  })
  const forgedRefundEvent = externalEvent(worker, 'TetherWdkEscrowRefunded', refund, 'user-attacker')
  const validRefundEvent = externalEvent(worker, 'TetherWdkEscrowRefunded', refund, refund.rail)

  assert.equal(worker.mergeEvents([forgedRefundEvent]), 0)
  assert.equal(Object.keys(worker.view().escrowRefunds).length, 0)

  assert.equal(worker.mergeEvents([validRefundEvent]), 1)
  assert.equal(worker.view().escrowRefundsByEscrow[escrowEvent.payload.escrowId].refundId, refund.refundId)
})

test('WDK release refuses payload QVAC attestation that is not in the worker log', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  const roundEvent = worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  const unloggedAttestation = core.createQvacRefereeAttestation({
    roundResult: roundEvent.payload,
    refereeId: 'qvac-unlogged-test'
  })

  const release = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: {
      gameId,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id,
      qvacAttestation: unloggedAttestation
    }
  })

  assert.equal(release.type, 'TetherWdkEscrowDisputed')
  assert.match(release.payload.reason, /QVAC attestation event/)
  assert.equal(worker.view().typeCounts.QvacRefereeAttestationCreated || 0, 0)
  assert.equal(worker.view().typeCounts.TetherWdkEscrowReleased || 0, 0)
})

test('WDK release with mismatched round identity becomes a dispute before payout', () => {
  let releaseCalled = false
  const worker = createWorkerSim({
    adapters: {
      qvac: {
        id: 'qvac-round-identity-test',
        mode: 'sdk',
        attestRound ({ roundResult }) {
          return core.createQvacRefereeAttestation({ roundResult, refereeId: 'qvac-round-identity-test' })
        },
        attestPoolSettlement ({ poolResult }) {
          return core.createQvacPoolSettlementAttestation({ poolResult, refereeId: 'qvac-round-identity-test' })
        }
      },
      tetherWdk: {
        id: 'tether-wdk-round-identity-test',
        mode: 'sdk',
        createGameEscrow (input) {
          return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-round-identity-test' })
        },
        releaseGameEscrow () {
          releaseCalled = true
          throw new Error('release should not run for mismatched round identity')
        },
        disputeGameEscrow ({ gameId, roundId, escrowId, reason }) {
          return {
            disputeId: core.deterministicHash({ gameId, roundId, escrowId, reason }),
            gameId,
            roundId,
            escrowId,
            reason,
            status: 'held'
          }
        },
        createEntryIntent (input) {
          return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-round-identity-test' })
        },
        confirmEntryIntent (input) {
          return core.confirmTetherWdkEntryIntent(input)
        },
        createPoolPayout (input) {
          return core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-round-identity-test' })
        }
      },
      mode: { qvac: 'sdk', tetherWdk: 'sdk' }
    }
  })
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-round-identity-test',
    payload: { gameId, roundId }
  })

  const release = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-round-identity-test',
    payload: {
      gameId,
      roundIndex: 1,
      roundId,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: keeper.id
    }
  })

  assert.equal(release.type, 'TetherWdkEscrowDisputed')
  assert.equal(releaseCalled, false)
  assert.match(release.payload.reason, /does not match roundIndex/)
  assert.equal(worker.view().typeCounts.TetherWdkEscrowReleased || 0, 0)
})

test('worker disputes invalid reveal before QVAC and WDK release', () => {
  const worker = createWorkerSim()
  const commitment = core.createCommitment({
    gameId,
    roundId,
    playerId: shooter.id,
    input: shooterInput,
    nonce: 'shooter-nonce'
  })
  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, commitment }
  })
  const disputed = worker.dispatch({
    type: 'game:revealInput',
    actorId: shooter.id,
    payload: {
      gameId,
      roundId,
      playerId: shooter.id,
      input: { ...shooterInput, aimZone: 'left-low' },
      nonce: 'shooter-nonce'
    }
  })

  assert.equal(disputed.type, 'GameSessionDisputed')
  assert.match(disputed.payload.reason, /Reveal did not match/)
  assert.equal(worker.view().disputes.length, 1)
})

test('worker creates WDK bracket entry payments and pool payout events', () => {
  const worker = createWorkerSim()
  const firstIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-25', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const secondIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-lina',
    payload: { poolId: 'pool-25', entryId: 'entry-lina', userId: 'user-lina', username: 'lina', amount: 25, asset: 'USDT' }
  })
  const firstPayment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: firstIntent.payload.intentId, confirmationId: 'confirm-captain' }
  })
  const secondPayment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: secondIntent.payload.intentId, confirmationId: 'confirm-lina' }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-25' })
  const earlyPayout = worker.dispatch({
    type: 'wdk:createPoolPayout',
    actorId: 'tether-wdk-demo',
    payload: { poolId: 'pool-25', winnerUserIds: ['user-captain', 'user-lina'], asset: 'USDT' }
  })
  const poolResult = worker.dispatch({
    type: 'pool:resolveSettlement',
    actorId: 'bracket-rules',
    payload: { poolId: 'pool-25', winnerUserIds: ['user-captain', 'user-lina'], rulesVersion: 'bracket-pool-v1' }
  })
  const attestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: { poolId: 'pool-25' }
  })
  const mismatchedPayout = worker.dispatch({
    type: 'wdk:createPoolPayout',
    actorId: 'tether-wdk-demo',
    payload: { poolId: 'pool-25', winnerUserIds: ['user-captain'], asset: 'USDT' }
  })
  const payout = worker.dispatch({
    type: 'wdk:createPoolPayout',
    actorId: 'tether-wdk-demo',
    payload: { poolId: 'pool-25', winnerUserIds: ['user-captain', 'user-lina'], asset: 'USDT' }
  })
  const view = worker.view()
  const paymentSourceEventIds = worker.events()
    .filter(event => event.type === 'TetherWdkEntryConfirmed')
    .map(event => event.eventId)
  const officialSourceEventIds = worker.events()
    .filter(event => event.type === 'OfficialResultsSnapshotRecorded')
    .map(event => event.eventId)
  const expectedSourceEventIds = [...paymentSourceEventIds, ...officialSourceEventIds]

  assert.equal(earlyPayout.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(earlyPayout.payload.reason, /QVAC pool attestation/)
  assert.equal(poolResult.type, 'BracketPoolSettlementResolved')
  assert.equal(firstPayment.actorId, firstPayment.payload.rail)
  assert.equal(secondPayment.actorId, secondPayment.payload.rail)
  assert.equal(poolResult.payload.sourceEventMode, 'worker-log')
  assert.deepEqual([...poolResult.payload.sourceEventIds].sort(), [...expectedSourceEventIds].sort())
  assert.equal(attestation.type, 'QvacPoolSettlementAttestationCreated')
  assert.equal(attestation.actorId, attestation.payload.refereeId)
  assert.equal(attestation.payload.ruling, 'verified')
  assert.deepEqual([...attestation.payload.sourceEventIds].sort(), [...expectedSourceEventIds].sort())
  assert.equal(mismatchedPayout.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(mismatchedPayout.payload.reason, /Payout winners must match QVAC pool attestation winners/)
  assert.equal(payout.type, 'TetherWdkPoolPayoutPrepared')
  assert.equal(payout.actorId, payout.payload.rail)
  assert.equal(payout.payload.grossPool, 50)
  assert.equal(payout.payload.amountEach, 25)
  assert.equal(payout.payload.qvacAttestationId, attestation.payload.attestationId)
  assert.equal(Object.keys(view.entryIntents).length, 2)
  assert.equal(Object.keys(view.entryPayments).length, 2)
  assert.equal(Object.keys(view.officialResultsSnapshots).length, 1)
  assert.equal(Object.keys(view.poolAttestations).length, 1)
  assert.equal(Object.keys(view.poolPayouts).length, 1)
})

test('worker rejects peer WDK pool payout disputes not signed by the WDK rail', () => {
  const source = createWorkerSim()
  const disputeEvent = source.dispatch({
    type: 'wdk:createPoolPayout',
    actorId: 'tether-wdk-demo',
    payload: {
      poolId: 'pool-forged-dispute',
      winnerUserIds: [shooter.id],
      asset: 'USDT'
    }
  })
  const forgedDisputeEvent = eventEnvelope({
    type: 'TetherWdkPoolPayoutDisputed',
    actorId: 'user-attacker',
    payload: disputeEvent.payload,
    previousEventId: disputeEvent.previousEventId,
    sequence: disputeEvent.sequence
  })
  const peer = createWorkerSim()

  assert.equal(disputeEvent.type, 'TetherWdkPoolPayoutDisputed')
  assert.equal(disputeEvent.actorId, disputeEvent.payload.rail)
  assert.equal(peer.mergeEvents([forgedDisputeEvent]), 0)
  assert.equal(peer.view().typeCounts.TetherWdkPoolPayoutDisputed || 0, 0)
  assert.equal(peer.view().disputes.length, 0)

  assert.equal(peer.mergeEvents([disputeEvent]), 1)
  assert.equal(peer.view().typeCounts.TetherWdkPoolPayoutDisputed, 1)
  assert.equal(peer.view().disputes.length, 1)
})

test('worker rejects WDK entry intents submitted for another user', () => {
  const worker = createWorkerSim()

  const rejected = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-lina',
    payload: {
      poolId: 'pool-entry-reject',
      entryId: 'entry-captain',
      userId: 'user-captain',
      username: 'captain',
      amount: 25,
      asset: 'USDT'
    }
  })

  assert.equal(rejected.type, 'TetherWdkEntryIntentRejected')
  assert.match(rejected.payload.reason, /actorId must match userId/)
  assert.equal(worker.view().typeCounts.TetherWdkEntryIntentCreated || 0, 0)
  assert.deepEqual(worker.view().entryIntents, {})
})

test('worker refuses QVAC pool attestation for payments without entrant-signed entry intents', () => {
  const worker = createWorkerSim()
  const intent = core.createTetherWdkEntryIntent({
    poolId: 'pool-entry-forged',
    entryId: 'entry-captain',
    userId: 'user-captain',
    username: 'captain',
    amount: 25,
    asset: 'USDT'
  })
  const payment = core.confirmTetherWdkEntryIntent({
    intent,
    confirmationId: 'confirm-entry-forged'
  })
  const intentEvent = externalEvent(worker, 'TetherWdkEntryIntentCreated', intent, 'user-attacker')
  worker.mergeEvents([intentEvent])
  const paymentEvent = externalEvent(worker, 'TetherWdkEntryConfirmed', payment, 'tether-wdk-demo')
  worker.mergeEvents([paymentEvent])
  const officialResults = { champion: 'Brazil' }
  const snapshot = worker.dispatch({
    type: 'results:recordOfficialSnapshot',
    actorId: 'official-results-feed',
    payload: {
      poolId: 'pool-entry-forged',
      officialResults,
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-entry-forged',
    confirmedEntries: [payment],
    winnerUserIds: ['user-captain'],
    officialResults,
    rulesVersion: 'bracket-pool-v1',
    sourceEventIds: [paymentEvent.eventId, snapshot.eventId],
    sourceEventMode: 'worker-log'
  })
  worker.mergeEvents([
    externalEvent(worker, 'BracketPoolSettlementResolved', poolResult, 'bracket-rules')
  ])

  const attestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: { poolId: 'pool-entry-forged' }
  })

  assert.equal(attestation.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(attestation.payload.reason, /Entry intent source event signer must match userId/)
  assert.match(attestation.payload.reason, /does not match signed entry intent/)
  assert.equal(worker.view().typeCounts.QvacPoolSettlementAttestationCreated || 0, 0)
  assert.deepEqual(worker.view().entryIntents, {})
  assert.deepEqual(worker.view().entryPayments, {})
})

test('worker refuses QVAC pool attestation for payments not signed by the WDK rail', () => {
  const worker = createWorkerSim()
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: {
      poolId: 'pool-payment-forged',
      entryId: 'entry-captain',
      userId: 'user-captain',
      username: 'captain',
      amount: 25,
      asset: 'USDT'
    }
  })
  const payment = core.confirmTetherWdkEntryIntent({
    intent: intent.payload,
    confirmationId: 'confirm-payment-forged'
  })
  const paymentEvent = externalEvent(worker, 'TetherWdkEntryConfirmed', payment, 'user-attacker')
  worker.mergeEvents([paymentEvent])
  const snapshot = recordOfficialResultsSnapshot(worker, { poolId: 'pool-payment-forged' })
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-payment-forged',
    confirmedEntries: [payment],
    winnerUserIds: ['user-captain'],
    officialResults: { champion: 'Brazil' },
    rulesVersion: 'bracket-pool-v1',
    sourceEventIds: [paymentEvent.eventId, snapshot.eventId],
    sourceEventMode: 'worker-log'
  })
  worker.mergeEvents([
    externalEvent(worker, 'BracketPoolSettlementResolved', poolResult, 'bracket-rules')
  ])

  const attestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: { poolId: 'pool-payment-forged' }
  })

  assert.equal(attestation.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(attestation.payload.reason, /Entry payment actorId must match WDK rail/)
  assert.equal(worker.view().entryPayments[payment.paymentId], undefined)
  assert.equal(worker.view().typeCounts.QvacPoolSettlementAttestationCreated || 0, 0)
})

test('worker rejects peer pending entry checks not signed by the WDK rail', () => {
  const worker = createWorkerSim()
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: {
      poolId: 'pool-pending-forged',
      entryId: 'entry-captain',
      userId: 'user-captain',
      username: 'captain',
      amount: 25,
      asset: 'USDT'
    }
  })
  const pending = core.createTetherWdkEntryPaymentPending({
    intent: intent.payload,
    confirmationId: 'pending-forged',
    processorStatus: 'awaiting_payment',
    reason: 'WDK payment has not been confirmed yet'
  })
  const forgedPendingEvent = externalEvent(worker, 'TetherWdkEntryPaymentPending', pending, 'user-attacker')
  const validPendingEvent = externalEvent(worker, 'TetherWdkEntryPaymentPending', pending, pending.rail)

  assert.equal(worker.mergeEvents([forgedPendingEvent]), 0)
  assert.equal(Object.keys(worker.view().entryPaymentChecks).length, 0)
  assert.equal(worker.view().typeCounts.TetherWdkEntryPaymentPending || 0, 0)

  assert.equal(worker.mergeEvents([validPendingEvent]), 1)
  assert.equal(Object.keys(worker.view().entryPaymentChecks).length, 1)
  assert.equal(worker.view().entryPaymentChecksByIntent[intent.payload.intentId].checkId, pending.checkId)
})

test('worker rejects peer entry refunds not signed by the WDK rail', () => {
  const worker = createWorkerSim()
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: {
      poolId: 'pool-refund-forged',
      entryId: 'entry-captain',
      userId: 'user-captain',
      username: 'captain',
      amount: 25,
      asset: 'USDT'
    }
  })
  const payment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-refund-forged' }
  })
  const refund = core.createTetherWdkEntryRefund({
    payment: payment.payload,
    reason: 'pool-cancelled'
  })
  const forgedRefundEvent = externalEvent(worker, 'TetherWdkEntryRefunded', refund, 'user-attacker')
  const validRefundEvent = externalEvent(worker, 'TetherWdkEntryRefunded', refund, refund.rail)

  assert.equal(worker.mergeEvents([forgedRefundEvent]), 0)
  assert.equal(worker.view().entryPayments[payment.payload.paymentId].paymentId, payment.payload.paymentId)
  assert.equal(Object.keys(worker.view().entryRefunds).length, 0)

  assert.equal(worker.mergeEvents([validRefundEvent]), 1)
  assert.equal(worker.view().entryPayments[payment.payload.paymentId], undefined)
  assert.equal(worker.view().entryRefundsByPayment[payment.payload.paymentId].refundId, refund.refundId)
})

test('worker excludes refunded entry payments from pool settlement and payout', () => {
  const worker = createWorkerSim()
  const firstIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-refund-settlement', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const secondIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-lina',
    payload: { poolId: 'pool-refund-settlement', entryId: 'entry-lina', userId: 'user-lina', username: 'lina', amount: 25, asset: 'USDT' }
  })
  const firstPayment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: firstIntent.payload.intentId, confirmationId: 'confirm-refund-captain' }
  })
  const secondPayment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: secondIntent.payload.intentId, confirmationId: 'confirm-refund-lina' }
  })
  worker.dispatch({
    type: 'wdk:refundEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { paymentId: firstPayment.payload.paymentId, reason: 'pool-cancelled' }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-refund-settlement' })
  const poolResult = worker.dispatch({
    type: 'pool:resolveSettlement',
    actorId: 'bracket-rules',
    payload: {
      poolId: 'pool-refund-settlement',
      confirmedEntries: [firstPayment.payload, secondPayment.payload],
      winnerUserIds: ['user-lina'],
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const attestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: { poolId: 'pool-refund-settlement' }
  })
  const payout = worker.dispatch({
    type: 'wdk:createPoolPayout',
    actorId: 'tether-wdk-demo',
    payload: {
      poolId: 'pool-refund-settlement',
      confirmedEntries: [firstPayment.payload, secondPayment.payload],
      winnerUserIds: ['user-lina'],
      asset: 'USDT'
    }
  })

  assert.equal(poolResult.payload.entryCount, 1)
  assert.deepEqual(poolResult.payload.sourcePaymentIds, [secondPayment.payload.paymentId])
  assert.equal(attestation.type, 'QvacPoolSettlementAttestationCreated')
  assert.equal(payout.type, 'TetherWdkPoolPayoutPrepared')
  assert.equal(payout.payload.grossPool, 25)
  assert.deepEqual(payout.payload.sourcePaymentIds, [secondPayment.payload.paymentId])
})

test('worker refuses QVAC pool attestation when source payment was later refunded', () => {
  const worker = createWorkerSim()
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: {
      poolId: 'pool-refund-source',
      entryId: 'entry-captain',
      userId: 'user-captain',
      username: 'captain',
      amount: 25,
      asset: 'USDT'
    }
  })
  const payment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-refund-source' }
  })
  const paymentEvent = worker.events().find(event => event.type === 'TetherWdkEntryConfirmed' && event.payload.paymentId === payment.payload.paymentId)
  const snapshot = recordOfficialResultsSnapshot(worker, { poolId: 'pool-refund-source' })
  worker.dispatch({
    type: 'wdk:refundEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { paymentId: payment.payload.paymentId, reason: 'pool-cancelled' }
  })
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-refund-source',
    confirmedEntries: [payment.payload],
    winnerUserIds: ['user-captain'],
    officialResults: { champion: 'Brazil' },
    rulesVersion: 'bracket-pool-v1',
    sourceEventIds: [paymentEvent.eventId, snapshot.eventId],
    sourceEventMode: 'worker-log'
  })
  worker.mergeEvents([
    externalEvent(worker, 'BracketPoolSettlementResolved', poolResult, 'bracket-rules')
  ])

  const attestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: { poolId: 'pool-refund-source' }
  })

  assert.equal(attestation.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(attestation.payload.reason, /has been refunded by WDK rail/)
  assert.equal(worker.view().typeCounts.QvacPoolSettlementAttestationCreated || 0, 0)
})

test('worker disputes WDK pool payout output that does not match replayed settlement evidence', () => {
  const worker = createWorkerSim({
    adapters: trustedSdkAdapters({
      qvacId: 'qvac-wdk-pool-output-test',
      wdkId: 'tether-wdk-pool-output-test',
      tetherWdkOverrides: {
        createPoolPayout (input) {
          const payout = core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-pool-output-test' })
          return { ...payout, amountEach: payout.amountEach + 1 }
        }
      }
    })
  })
  const firstIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-wdk-output', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const secondIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-lina',
    payload: { poolId: 'pool-wdk-output', entryId: 'entry-lina', userId: 'user-lina', username: 'lina', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-pool-output-test',
    payload: { intentId: firstIntent.payload.intentId, confirmationId: 'confirm-captain-output' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-pool-output-test',
    payload: { intentId: secondIntent.payload.intentId, confirmationId: 'confirm-lina-output' }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-wdk-output' })
  worker.dispatch({
    type: 'pool:resolveSettlement',
    actorId: 'bracket-rules',
    payload: { poolId: 'pool-wdk-output', winnerUserIds: ['user-captain', 'user-lina'], rulesVersion: 'bracket-pool-v1' }
  })
  worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-wdk-pool-output-test',
    payload: { poolId: 'pool-wdk-output' }
  })

  const payout = worker.dispatch({
    type: 'wdk:createPoolPayout',
    actorId: 'tether-wdk-pool-output-test',
    payload: { poolId: 'pool-wdk-output', winnerUserIds: ['user-captain', 'user-lina'], asset: 'USDT' }
  })

  assert.equal(payout.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(payout.payload.reason, /WDK pool payout output did not match replayed QVAC/)
  assert.equal(worker.view().typeCounts.TetherWdkPoolPayoutPrepared || 0, 0)
})

test('worker refuses pool payout with payload QVAC attestation that is not in the worker log', () => {
  const worker = createWorkerSim()
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-unlogged-attestation', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-unlogged-attestation' }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-unlogged-attestation' })
  const poolResultEvent = worker.dispatch({
    type: 'pool:resolveSettlement',
    actorId: 'bracket-rules',
    payload: {
      poolId: 'pool-unlogged-attestation',
      winnerUserIds: ['user-captain'],
      officialResults: { champion: 'Brazil' },
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const unloggedAttestation = core.createQvacPoolSettlementAttestation({
    poolResult: poolResultEvent.payload,
    refereeId: 'qvac-unlogged-pool-test'
  })

  const payout = worker.dispatch({
    type: 'wdk:createPoolPayout',
    actorId: 'tether-wdk-demo',
    payload: {
      poolId: 'pool-unlogged-attestation',
      winnerUserIds: ['user-captain'],
      asset: 'USDT',
      qvacAttestation: unloggedAttestation
    }
  })

  assert.equal(payout.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(payout.payload.reason, /QVAC pool attestation event/)
  assert.equal(worker.view().typeCounts.QvacPoolSettlementAttestationCreated || 0, 0)
  assert.equal(worker.view().typeCounts.TetherWdkPoolPayoutPrepared || 0, 0)
})

test('worker rejects replayed QVAC pool attestations not signed by the referee actor', () => {
  const worker = createWorkerSim()
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-forged-qvac-signer', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-forged-qvac-signer' }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-forged-qvac-signer' })
  const poolResultEvent = worker.dispatch({
    type: 'pool:resolveSettlement',
    actorId: 'bracket-rules',
    payload: {
      poolId: 'pool-forged-qvac-signer',
      winnerUserIds: ['user-captain'],
      officialResults: { champion: 'Brazil' },
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const attestation = core.createQvacPoolSettlementAttestation({
    poolResult: poolResultEvent.payload,
    refereeId: 'qvac-demo-ref'
  })
  const forgedAttestationEvent = externalEvent(worker, 'QvacPoolSettlementAttestationCreated', attestation, 'user-attacker')

  assert.equal(worker.mergeEvents([forgedAttestationEvent]), 0)
  assert.equal(worker.view().typeCounts.QvacPoolSettlementAttestationCreated || 0, 0)

  const payout = worker.dispatch({
    type: 'wdk:createPoolPayout',
    actorId: 'tether-wdk-demo',
    payload: {
      poolId: 'pool-forged-qvac-signer',
      winnerUserIds: ['user-captain'],
      asset: 'USDT',
      qvacAttestation: attestation
    }
  })

  assert.equal(payout.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(payout.payload.reason, /QVAC pool attestation event/)
  assert.equal(worker.view().typeCounts.TetherWdkPoolPayoutPrepared || 0, 0)
})

test('worker refuses QVAC pool attestation for payload-only settlement results', () => {
  const worker = createWorkerSim()
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-payload-only',
    confirmedEntries: [{
      paymentId: 'payment-payload-only',
      poolId: 'pool-payload-only',
      entryId: 'entry-captain',
      userId: 'user-captain',
      username: 'captain',
      amount: 25,
      asset: 'USDT',
      status: 'confirmed'
    }],
    winnerUserIds: ['user-captain'],
    officialResults: { champion: 'Brazil' }
  })

  const attestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: {
      poolId: 'pool-payload-only',
      poolResult
    }
  })

  assert.equal(attestation.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(attestation.payload.reason, /pool settlement result event/)
  assert.equal(worker.view().typeCounts.QvacPoolSettlementAttestationCreated || 0, 0)
})

test('worker refuses QVAC pool attestation payload that differs from replayed result', () => {
  const worker = createWorkerSim()
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-qvac-mismatch', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-qvac-mismatch' }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-qvac-mismatch' })
  const loggedResult = worker.dispatch({
    type: 'pool:resolveSettlement',
    actorId: 'bracket-rules',
    payload: {
      poolId: 'pool-qvac-mismatch',
      winnerUserIds: ['user-captain'],
      officialResults: { champion: 'Brazil' },
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const mismatchedResult = {
    ...loggedResult.payload,
    winnerUserIds: ['user-lina']
  }

  const attestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: {
      poolId: 'pool-qvac-mismatch',
      poolResult: mismatchedResult
    }
  })

  assert.equal(attestation.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(attestation.payload.reason, /must match the replayed pool settlement event/)
  assert.equal(worker.view().typeCounts.QvacPoolSettlementAttestationCreated || 0, 0)
})

test('worker rejects invalid QVAC pool adapter output before logging an attestation', () => {
  const worker = createWorkerSim({
    adapters: {
      qvac: {
        id: 'qvac-invalid-pool-output-test',
        mode: 'sdk',
        attestRound ({ roundResult }) {
          return core.createQvacRefereeAttestation({
            roundResult,
            refereeId: 'qvac-invalid-pool-output-test'
          })
        },
        attestPoolSettlement ({ poolResult }) {
          return {
            attestationId: 'sdk-pool-no-referee',
            poolId: poolResult.poolId,
            rulesVersion: poolResult.rulesVersion,
            ruling: poolResult.ruling,
            stateHash: poolResult.stateHash,
            officialResultsHash: poolResult.officialResultsHash,
            sourcePaymentIds: poolResult.sourcePaymentIds,
            winnerUserIds: poolResult.winnerUserIds,
            sourceEventIds: poolResult.sourceEventIds,
            signature: 'arbitrary-sdk-pool-signature'
          }
        }
      },
      tetherWdk: {
        id: 'tether-wdk-invalid-pool-output-test',
        mode: 'demo',
        createGameEscrow (input) {
          return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-invalid-pool-output-test' })
        },
        releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
          return core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
        },
        createEntryIntent (input) {
          return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-invalid-pool-output-test' })
        },
        confirmEntryIntent (input) {
          return core.confirmTetherWdkEntryIntent(input)
        },
        createPoolPayout (input) {
          return core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-invalid-pool-output-test' })
        }
      }
    }
  })
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-invalid-qvac-output', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-invalid-qvac-output' }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-invalid-qvac-output' })
  worker.dispatch({
    type: 'pool:resolveSettlement',
    actorId: 'bracket-rules',
    payload: {
      poolId: 'pool-invalid-qvac-output',
      winnerUserIds: ['user-captain'],
      officialResults: { champion: 'Brazil' },
      rulesVersion: 'bracket-pool-v1'
    }
  })

  const attestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-invalid-pool-output-test',
    payload: { poolId: 'pool-invalid-qvac-output' }
  })

  assert.equal(attestation.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(attestation.payload.reason, /failed verification/)
  assert.match(attestation.payload.reason, /refereeId/)
  assert.equal(worker.view().typeCounts.QvacPoolSettlementAttestationCreated || 0, 0)
})

test('worker binds official results snapshots into pool settlement source events', () => {
  const worker = createWorkerSim()
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-results', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-results-captain' }
  })
  const officialResults = {
    champion: 'Brazil',
    runnerUp: 'Norway',
    completedMatches: ['round16-br-mx', 'quarter-br-es', 'semi-br-ar', 'final-br-no']
  }
  const snapshot = worker.dispatch({
    type: 'results:recordOfficialSnapshot',
    actorId: 'official-results-feed',
    payload: {
      poolId: 'pool-results',
      officialResults,
      rulesVersion: 'bracket-pool-v1',
      source: 'trusted-results-feed-v1',
      sourceActorId: 'official-results-feed'
    }
  })
  const poolResult = worker.dispatch({
    type: 'pool:resolveSettlement',
    actorId: 'bracket-rules',
    payload: {
      poolId: 'pool-results',
      winnerUserIds: ['user-captain'],
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const attestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: { poolId: 'pool-results' }
  })

  assert.equal(snapshot.type, 'OfficialResultsSnapshotRecorded')
  assert.equal(snapshot.payload.source, 'trusted-results-feed-v1')
  assert.deepEqual(poolResult.payload.officialResults, officialResults)
  assert.equal(poolResult.payload.sourceEventMode, 'worker-log')
  assert.ok(poolResult.payload.sourceEventIds.includes(snapshot.eventId))
  assert.equal(attestation.type, 'QvacPoolSettlementAttestationCreated')
  assert.ok(attestation.payload.sourceEventIds.includes(snapshot.eventId))
})

test('worker rejects official results snapshots not signed by the source actor', () => {
  const worker = createWorkerSim()
  const rejected = worker.dispatch({
    type: 'results:recordOfficialSnapshot',
    actorId: 'user-attacker',
    payload: {
      poolId: 'pool-results-reject',
      officialResults: { champion: 'Brazil' },
      rulesVersion: 'bracket-pool-v1',
      source: 'trusted-results-feed',
      sourceActorId: 'official-results-feed'
    }
  })

  assert.equal(rejected.type, 'OfficialResultsSnapshotRejected')
  assert.match(rejected.payload.reason, /actorId must match sourceActorId/)
  assert.equal(worker.view().officialResultsSnapshots['pool-results-reject'], undefined)
})

test('worker refuses QVAC pool attestation for official results snapshots signed by another actor', () => {
  const worker = createWorkerSim()
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-results-forged', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const payment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-results-forged' }
  })
  const paymentEvent = worker.events().find(event => event.type === 'TetherWdkEntryConfirmed' && event.payload.paymentId === payment.payload.paymentId)
  const officialResults = { champion: 'Brazil' }
  const forgedSnapshot = externalEvent(worker, 'OfficialResultsSnapshotRecorded', {
    snapshotId: core.deterministicHash({
      type: 'OfficialResultsSnapshotRecorded',
      poolId: 'pool-results-forged',
      officialResultsHash: core.deterministicHash(officialResults),
      rulesVersion: 'bracket-pool-v1',
      source: 'trusted-results-feed',
      sourceActorId: 'official-results-feed'
    }),
    poolId: 'pool-results-forged',
    officialResults,
    officialResultsHash: core.deterministicHash(officialResults),
    rulesVersion: 'bracket-pool-v1',
    source: 'trusted-results-feed',
    sourceActorId: 'official-results-feed',
    recordedAt: '2026-07-01T00:00:00.000Z'
  }, 'user-attacker')
  assert.equal(worker.mergeEvents([forgedSnapshot]), 1)
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-results-forged',
    confirmedEntries: [payment.payload],
    winnerUserIds: ['user-captain'],
    officialResults,
    rulesVersion: 'bracket-pool-v1',
    sourceEventIds: [paymentEvent.eventId, forgedSnapshot.eventId],
    sourceEventMode: 'worker-log'
  })
  worker.mergeEvents([
    externalEvent(worker, 'BracketPoolSettlementResolved', poolResult, 'bracket-rules')
  ])

  const attestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: { poolId: 'pool-results-forged' }
  })

  assert.equal(attestation.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(attestation.payload.reason, /signed OfficialResultsSnapshotRecorded/)
  assert.match(attestation.payload.reason, /signer must match sourceActorId/)
  assert.equal(worker.view().typeCounts.QvacPoolSettlementAttestationCreated || 0, 0)
  assert.equal(worker.view().officialResultsSnapshots['pool-results-forged'], undefined)
})

test('worker derives bracket pool winners from submitted picks before WDK payout', () => {
  const worker = createWorkerSim()
  const firstIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-picks', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const secondIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-lina',
    payload: { poolId: 'pool-picks', entryId: 'entry-lina', userId: 'user-lina', username: 'lina', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: firstIntent.payload.intentId, confirmationId: 'confirm-picks-captain' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: secondIntent.payload.intentId, confirmationId: 'confirm-picks-lina' }
  })
  const captainSubmission = worker.dispatch({
    type: 'bracket:submit',
    actorId: 'user-captain',
    payload: {
      poolId: 'pool-picks',
      entryId: 'entry-captain',
      userId: 'user-captain',
      username: 'captain',
      picks: { 'r16-1': 'br', 'qf-1': 'br', 'semi-1': 'br', final: 'br' }
    }
  })
  const linaSubmission = worker.dispatch({
    type: 'bracket:submit',
    actorId: 'user-lina',
    payload: {
      poolId: 'pool-picks',
      entryId: 'entry-lina',
      userId: 'user-lina',
      username: 'lina',
      picks: { 'r16-1': 'br', 'qf-1': 'no', 'semi-1': 'no', final: 'no' }
    }
  })
  worker.dispatch({
    type: 'results:recordOfficialSnapshot',
    actorId: 'official-results-feed',
    payload: {
      poolId: 'pool-picks',
      officialResults: {
        matchWinners: { 'r16-1': 'br', 'qf-1': 'br', 'semi-1': 'br', final: 'br' }
      },
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const summary = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId: 'pool-picks',
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const submissionEventIds = [captainSubmission.eventId, linaSubmission.eventId]

  assert.equal(summary.type, 'TrustedPoolSettlementCompleted')
  assert.deepEqual(summary.poolResultEvent.payload.winnerUserIds, ['user-captain'])
  assert.equal(summary.poolResultEvent.payload.bracketResolvedBy, 'perfect-bracket')
  assert.equal(summary.poolResultEvent.payload.sourceBracketSubmissionIds.length, 2)
  assert.ok(submissionEventIds.every(eventId => summary.poolResultEvent.payload.sourceEventIds.includes(eventId)))
  assert.deepEqual(summary.attestationEvent.payload.sourceBracketSubmissionIds, summary.poolResultEvent.payload.sourceBracketSubmissionIds)
  assert.equal(summary.attestationEvent.payload.bracketScoreboardHash, summary.poolResultEvent.payload.bracketScoreboardHash)
  assert.deepEqual(summary.settlementEvent.payload.winnerUserIds, ['user-captain'])
  assert.equal(summary.settlementEvent.payload.amountEach, 50)
})

test('worker rejects bracket submissions submitted for another user', () => {
  const worker = createWorkerSim()

  const rejected = worker.dispatch({
    type: 'bracket:submit',
    actorId: 'user-lina',
    payload: {
      poolId: 'pool-picks-reject',
      entryId: 'entry-captain',
      userId: 'user-captain',
      username: 'captain',
      picks: { final: 'br' }
    }
  })

  assert.equal(rejected.type, 'BracketSubmissionRejected')
  assert.match(rejected.payload.reason, /actorId must match userId/)
  assert.equal(worker.view().typeCounts.BracketSubmissionLocked || 0, 0)
  assert.deepEqual(worker.view().bracketSubmissions, {})
})

test('worker refuses QVAC pool attestation for replayed bracket submissions signed by another user', () => {
  const worker = createWorkerSim()
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-picks-forged', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const payment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-picks-forged' }
  })
  const officialResults = {
    matchWinners: { final: 'br' }
  }
  const snapshot = worker.dispatch({
    type: 'results:recordOfficialSnapshot',
    actorId: 'official-results-feed',
    payload: {
      poolId: 'pool-picks-forged',
      officialResults,
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const forgedSubmission = core.createBracketSubmission({
    poolId: 'pool-picks-forged',
    entryId: 'entry-captain',
    userId: 'user-captain',
    username: 'captain',
    picks: { final: 'br' },
    rulesVersion: 'bracket-pool-v1'
  })
  const forgedSubmissionEvent = externalEvent(worker, 'BracketSubmissionLocked', forgedSubmission, 'user-attacker')
  worker.mergeEvents([forgedSubmissionEvent])
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-picks-forged',
    confirmedEntries: [payment.payload],
    bracketSubmissions: [forgedSubmission],
    officialResults,
    rulesVersion: 'bracket-pool-v1',
    sourceEventIds: [payment.eventId, forgedSubmissionEvent.eventId, snapshot.eventId],
    sourceEventMode: 'worker-log'
  })
  worker.mergeEvents([
    externalEvent(worker, 'BracketPoolSettlementResolved', poolResult, 'bracket-rules')
  ])

  const attestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: { poolId: 'pool-picks-forged' }
  })

  assert.equal(attestation.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(attestation.payload.reason, /Bracket submission source event signer must match userId/)
  assert.equal(worker.view().typeCounts.QvacPoolSettlementAttestationCreated || 0, 0)
  assert.equal(worker.view().bracketSubmissions[forgedSubmission.submissionId], undefined)
})

test('worker holds pool attestation and payout when worker-log source events are missing', () => {
  const worker = createWorkerSim()
  const confirmedEntry = {
    paymentId: 'payment-missing-source',
    intentId: 'intent-missing-source',
    poolId: 'pool-source-missing',
    entryId: 'entry-captain',
    userId: 'user-captain',
    username: 'captain',
    amount: 25,
    asset: 'USDT',
    status: 'confirmed'
  }
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-source-missing',
    confirmedEntries: [confirmedEntry],
    winnerUserIds: ['user-captain'],
    officialResults: { champion: 'Brazil' },
    sourceEventIds: ['evt-missing'],
    sourceEventMode: 'worker-log'
  })
  const poolResultEvent = externalEvent(worker, 'BracketPoolSettlementResolved', poolResult, 'bracket-rules')
  worker.mergeEvents([poolResultEvent])

  const rejectedAttestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: { poolId: 'pool-source-missing' }
  })
  const rejectedPayout = worker.dispatch({
    type: 'wdk:createPoolPayout',
    actorId: 'tether-wdk-demo',
    payload: { poolId: 'pool-source-missing', winnerUserIds: ['user-captain'], asset: 'USDT' }
  })

  assert.equal(rejectedAttestation.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(rejectedAttestation.payload.reason, /Pool source event evt-missing is missing/)
  assert.match(rejectedAttestation.payload.reason, /TetherWdkEntryConfirmed/)
  assert.match(rejectedAttestation.payload.reason, /OfficialResultsSnapshotRecorded/)
  assert.equal(rejectedPayout.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(rejectedPayout.payload.reason, /Pool source event evt-missing is missing/)
  assert.match(rejectedPayout.payload.reason, /OfficialResultsSnapshotRecorded/)
  assert.equal(worker.view().typeCounts.QvacPoolSettlementAttestationCreated || 0, 0)
})

test('worker holds pool attestation when official results source event is missing', () => {
  const worker = createWorkerSim()
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-official-missing', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const payment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-official-missing' }
  })
  const paymentEvent = worker.events().find(event => event.type === 'TetherWdkEntryConfirmed' && event.payload.paymentId === payment.payload.paymentId)
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-official-missing',
    confirmedEntries: [payment.payload],
    winnerUserIds: ['user-captain'],
    officialResults: { champion: 'Brazil' },
    sourceEventIds: [paymentEvent.eventId],
    sourceEventMode: 'worker-log'
  })
  worker.mergeEvents([
    externalEvent(worker, 'BracketPoolSettlementResolved', poolResult, 'bracket-rules')
  ])

  const rejectedAttestation = worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: { poolId: 'pool-official-missing' }
  })

  assert.equal(rejectedAttestation.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(rejectedAttestation.payload.reason, /official results snapshot/)
  assert.match(rejectedAttestation.payload.reason, /OfficialResultsSnapshotRecorded/)
  assert.equal(worker.view().typeCounts.QvacPoolSettlementAttestationCreated || 0, 0)
})

test('worker trusted pool settlement command resolves, asks QVAC, then prepares WDK payout', () => {
  const worker = createWorkerSim()
  const firstIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-command', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const secondIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-lina',
    payload: { poolId: 'pool-command', entryId: 'entry-lina', userId: 'user-lina', username: 'lina', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: firstIntent.payload.intentId, confirmationId: 'confirm-captain' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: secondIntent.payload.intentId, confirmationId: 'confirm-lina' }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-command' })

  const summary = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId: 'pool-command',
      winnerUserIds: ['user-captain', 'user-lina'],
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const eventCount = worker.events().length
  const repeatSummary = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId: 'pool-command',
      winnerUserIds: ['user-captain', 'user-lina'],
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })

  assert.equal(summary.type, 'TrustedPoolSettlementCompleted')
  assert.equal(summary.status, 'prepared')
  assert.equal(summary.poolResultEvent.type, 'BracketPoolSettlementResolved')
  assert.equal(summary.attestationEvent.type, 'QvacPoolSettlementAttestationCreated')
  assert.equal(summary.settlementEvent.type, 'TetherWdkPoolPayoutPrepared')
  assert.ok(summary.poolResultEvent.sequence < summary.attestationEvent.sequence)
  assert.ok(summary.attestationEvent.sequence < summary.settlementEvent.sequence)
  assert.equal(summary.settlementEvent.payload.qvacAttestationId, summary.attestationEvent.payload.attestationId)
  assert.equal(repeatSummary.settlementEvent.eventId, summary.settlementEvent.eventId)
  assert.equal(worker.events().length, eventCount)
})

test('worker trusted pool settlement passes payout recipients to WDK after QVAC attestation', () => {
  let capturedPayoutInput = null
  const qvac = {
    id: 'qvac-recipient-test',
    mode: 'sdk',
    attestRound ({ roundResult }) {
      return core.createQvacRefereeAttestation({ roundResult, refereeId: 'qvac-recipient-test' })
    },
    attestPoolSettlement ({ poolResult }) {
      return core.createQvacPoolSettlementAttestation({ poolResult, refereeId: 'qvac-recipient-test' })
    }
  }
  const tetherWdk = {
    id: 'tether-wdk-recipient-test',
    mode: 'sdk',
    createGameEscrow (input) {
      return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-recipient-test' })
    },
    releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
      return core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
    },
    createEntryIntent (input) {
      return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-recipient-test' })
    },
    confirmEntryIntent (input) {
      return core.confirmTetherWdkEntryIntent(input)
    },
    createPoolPayout (input) {
      capturedPayoutInput = input
      const payout = core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-recipient-test' })
      return {
        ...payout,
        processorPayout: {
          id: 'recipient-quote',
          status: 'quoted',
          broadcast: false,
          transfers: input.winnerUserIds.map(userId => ({
            userId,
            recipient: input.payoutRecipients[userId],
            baseAmount: '25000000',
            status: 'quoted'
          }))
        }
      }
    }
  }
  const worker = createWorkerSim({
    adapters: {
      qvac,
      tetherWdk,
      mode: { qvac: 'sdk', tetherWdk: 'sdk' }
    }
  })
  const firstIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-recipient-command', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const secondIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-lina',
    payload: { poolId: 'pool-recipient-command', entryId: 'entry-lina', userId: 'user-lina', username: 'lina', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-recipient-test',
    payload: { intentId: firstIntent.payload.intentId, confirmationId: 'confirm-captain' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-recipient-test',
    payload: { intentId: secondIntent.payload.intentId, confirmationId: 'confirm-lina' }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-recipient-command' })

  const payoutRecipients = {
    'user-captain': '0xcaptainrecipient',
    'user-lina': '0xlinarecipient'
  }
  const summary = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId: 'pool-recipient-command',
      winnerUserIds: ['user-captain', 'user-lina'],
      payoutRecipients,
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })

  assert.equal(summary.type, 'TrustedPoolSettlementCompleted')
  assert.equal(summary.attestationEvent.type, 'QvacPoolSettlementAttestationCreated')
  assert.equal(summary.settlementEvent.type, 'TetherWdkPoolPayoutPrepared')
  assert.deepEqual(capturedPayoutInput.payoutRecipients, payoutRecipients)
  assert.equal(capturedPayoutInput.attestation.attestationId, summary.attestationEvent.payload.attestationId)
  assert.equal(summary.settlementEvent.payload.processorPayout.status, 'quoted')
  assert.deepEqual(summary.settlementEvent.payload.processorPayout.transfers.map(transfer => transfer.recipient), [
    '0xcaptainrecipient',
    '0xlinarecipient'
  ])
})

test('worker rejects payout recipient declarations submitted for another user', () => {
  const worker = createWorkerSim()

  const rejected = worker.dispatch({
    type: 'payout:declareRecipient',
    actorId: 'user-lina',
    payload: {
      poolId: 'pool-recipient-reject',
      userId: 'user-captain',
      username: 'captain',
      recipient: '0xattackerrecipient',
      asset: 'USDT'
    }
  })

  assert.equal(rejected.type, 'PayoutRecipientDeclarationRejected')
  assert.match(rejected.payload.reason, /actorId must match userId/)
  assert.equal(worker.view().typeCounts.PayoutRecipientDeclared || 0, 0)
  assert.equal(worker.view().payoutRecipientDeclarations['pool-recipient-reject:user-captain'], undefined)
})

test('worker retries route-blocked pool payout after recipient declaration is supplied', () => {
  const poolId = 'pool-recipient-retry'
  const winnerId = 'user-captain'
  const qvac = {
    id: 'qvac-recipient-retry-test',
    mode: 'sdk',
    attestRound ({ roundResult }) {
      return core.createQvacRefereeAttestation({ roundResult, refereeId: 'qvac-recipient-retry-test' })
    },
    attestPoolSettlement ({ poolResult }) {
      return core.createQvacPoolSettlementAttestation({ poolResult, refereeId: 'qvac-recipient-retry-test' })
    }
  }
  const tetherWdk = {
    id: 'tether-wdk-recipient-retry-test',
    mode: 'sdk',
    createGameEscrow (input) {
      return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-recipient-retry-test' })
    },
    releaseGameEscrow (input) {
      return core.releaseTetherWdkEscrow(input)
    },
    createEntryIntent (input) {
      return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-recipient-retry-test' })
    },
    confirmEntryIntent (input) {
      return core.confirmTetherWdkEntryIntent(input)
    },
    createPoolPayout (input) {
      const payout = core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-recipient-retry-test' })
      const missingRecipientUserIds = input.winnerUserIds.filter(userId => !input.payoutRecipients[userId])
      return {
        ...payout,
        processorPayout: missingRecipientUserIds.length
          ? {
              id: `pool-retry-${input.poolId}`,
              status: 'recipient-required',
              poolId: input.poolId,
              missingRecipientUserIds,
              broadcast: false,
              transfers: []
            }
          : {
              id: `pool-retry-${input.poolId}`,
              status: 'quoted',
              poolId: input.poolId,
              broadcast: false,
              transfers: input.winnerUserIds.map(userId => ({
                userId,
                recipient: input.payoutRecipients[userId],
                amount: payout.amountEach,
                baseAmount: '50000000',
                status: 'quoted'
              }))
            }
      }
    }
  }
  const worker = createWorkerSim({
    adapters: {
      qvac,
      tetherWdk,
      mode: { qvac: 'sdk', tetherWdk: 'sdk' }
    }
  })
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: winnerId,
    payload: { poolId, entryId: 'entry-captain', userId: winnerId, username: 'captain', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-recipient-retry-test',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-captain' }
  })
  recordOfficialResultsSnapshot(worker, { poolId })

  const blocked = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId,
      winnerUserIds: [winnerId],
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const blockedRepeat = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId,
      winnerUserIds: [winnerId],
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })
  worker.dispatch({
    type: 'payout:declareRecipient',
    actorId: winnerId,
    payload: {
      poolId,
      userId: winnerId,
      username: 'captain',
      recipient: '0xcaptainretryrecipient',
      asset: 'USDT'
    }
  })
  const completed = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId,
      winnerUserIds: [winnerId],
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })

  assert.equal(blocked.type, 'TrustedPoolSettlementHeld')
  assert.equal(blocked.status, 'recipient-required')
  assert.equal(blocked.settlementEvent.payload.processorPayout.status, 'recipient-required')
  assert.equal(blockedRepeat.settlementEvent.eventId, blocked.settlementEvent.eventId)
  assert.equal(completed.type, 'TrustedPoolSettlementCompleted')
  assert.equal(completed.status, 'prepared')
  assert.equal(completed.settlementEvent.payload.processorPayout.status, 'quoted')
  assert.equal(completed.settlementEvent.payload.processorPayout.transfers[0].recipient, '0xcaptainretryrecipient')
  assert.equal(worker.view().typeCounts.TetherWdkPoolPayoutPrepared, 2)
})

test('worker ignores replayed payout recipient declarations signed by another user before WDK payout', () => {
  const poolId = 'pool-recipient-forged'
  const winnerId = 'user-captain'
  const payoutCalls = []
  const qvac = {
    id: 'qvac-recipient-forged-test',
    mode: 'sdk',
    attestRound ({ roundResult }) {
      return core.createQvacRefereeAttestation({ roundResult, refereeId: 'qvac-recipient-forged-test' })
    },
    attestPoolSettlement ({ poolResult }) {
      return core.createQvacPoolSettlementAttestation({ poolResult, refereeId: 'qvac-recipient-forged-test' })
    }
  }
  const tetherWdk = {
    id: 'tether-wdk-recipient-forged-test',
    mode: 'sdk',
    createGameEscrow (input) {
      return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-recipient-forged-test' })
    },
    releaseGameEscrow (input) {
      return core.releaseTetherWdkEscrow(input)
    },
    createEntryIntent (input) {
      return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-recipient-forged-test' })
    },
    confirmEntryIntent (input) {
      return core.confirmTetherWdkEntryIntent(input)
    },
    createPoolPayout (input) {
      payoutCalls.push(input)
      const payout = core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-recipient-forged-test' })
      const missingRecipientUserIds = input.winnerUserIds.filter(userId => !input.payoutRecipients[userId])
      return {
        ...payout,
        processorPayout: missingRecipientUserIds.length
          ? {
              id: `pool-forged-${input.poolId}`,
              status: 'recipient-required',
              poolId: input.poolId,
              missingRecipientUserIds,
              broadcast: false,
              transfers: []
            }
          : {
              id: `pool-forged-${input.poolId}`,
              status: 'quoted',
              poolId: input.poolId,
              broadcast: false,
              transfers: input.winnerUserIds.map(userId => ({
                userId,
                recipient: input.payoutRecipients[userId],
                amount: payout.amountEach,
                baseAmount: '50000000',
                status: 'quoted'
              }))
            }
      }
    }
  }
  const worker = createWorkerSim({
    adapters: {
      qvac,
      tetherWdk,
      mode: { qvac: 'sdk', tetherWdk: 'sdk' }
    }
  })
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: winnerId,
    payload: { poolId, entryId: 'entry-captain', userId: winnerId, username: 'captain', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-recipient-forged-test',
    payload: { intentId: intent.payload.intentId, confirmationId: 'confirm-captain' }
  })
  recordOfficialResultsSnapshot(worker, { poolId })

  const blocked = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId,
      winnerUserIds: [winnerId],
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const forgedDeclaration = externalEvent(worker, 'PayoutRecipientDeclared', {
    poolId,
    userId: winnerId,
    username: 'captain',
    asset: 'USDT',
    recipient: '0xattackerrecipient',
    recipientHash: core.deterministicHash('0xattackerrecipient'),
    status: 'active',
    declaredAt: '2026-07-01T00:00:00.000Z'
  }, 'user-attacker')
  assert.equal(worker.mergeEvents([forgedDeclaration]), 1)
  const blockedAgain = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId,
      winnerUserIds: [winnerId],
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })

  assert.equal(blocked.status, 'recipient-required')
  assert.equal(blockedAgain.status, 'recipient-required')
  assert.equal(blockedAgain.settlementEvent.eventId, blocked.settlementEvent.eventId)
  assert.equal(blockedAgain.recipientDeclarationEvents.length, 0)
  assert.equal(worker.view().payoutRecipientDeclarations[`${poolId}:${winnerId}`], undefined)
  assert.equal(payoutCalls.length, 1)
})

test('worker trusted pool settlement derives payout recipients from declaration events', () => {
  let capturedPayoutInput = null
  const qvac = {
    id: 'qvac-recipient-declaration-test',
    mode: 'sdk',
    attestRound ({ roundResult }) {
      return core.createQvacRefereeAttestation({ roundResult, refereeId: 'qvac-recipient-declaration-test' })
    },
    attestPoolSettlement ({ poolResult }) {
      return core.createQvacPoolSettlementAttestation({ poolResult, refereeId: 'qvac-recipient-declaration-test' })
    }
  }
  const tetherWdk = {
    id: 'tether-wdk-recipient-declaration-test',
    mode: 'sdk',
    createGameEscrow (input) {
      return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-recipient-declaration-test' })
    },
    releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
      return core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
    },
    createEntryIntent (input) {
      return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-recipient-declaration-test' })
    },
    confirmEntryIntent (input) {
      return core.confirmTetherWdkEntryIntent(input)
    },
    createPoolPayout (input) {
      capturedPayoutInput = input
      const payout = core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-recipient-declaration-test' })
      return {
        ...payout,
        processorPayout: {
          id: 'recipient-declaration-quote',
          status: 'quoted',
          broadcast: false,
          transfers: input.winnerUserIds.map(userId => ({
            userId,
            recipient: input.payoutRecipients[userId],
            baseAmount: '25000000',
            status: 'quoted'
          }))
        }
      }
    }
  }
  const worker = createWorkerSim({
    adapters: {
      qvac,
      tetherWdk,
      mode: { qvac: 'sdk', tetherWdk: 'sdk' }
    }
  })
  const firstIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-recipient-declaration', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const secondIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-lina',
    payload: { poolId: 'pool-recipient-declaration', entryId: 'entry-lina', userId: 'user-lina', username: 'lina', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-recipient-declaration-test',
    payload: { intentId: firstIntent.payload.intentId, confirmationId: 'confirm-captain' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-recipient-declaration-test',
    payload: { intentId: secondIntent.payload.intentId, confirmationId: 'confirm-lina' }
  })
  worker.dispatch({
    type: 'payout:declareRecipient',
    actorId: 'user-captain',
    payload: {
      poolId: 'pool-recipient-declaration',
      userId: 'user-captain',
      username: 'captain',
      recipient: '0xcaptainrecipientdeclared',
      asset: 'USDT'
    }
  })
  worker.dispatch({
    type: 'payout:declareRecipient',
    actorId: 'user-lina',
    payload: {
      poolId: 'pool-recipient-declaration',
      userId: 'user-lina',
      username: 'lina',
      recipient: '0xlinarecipientdeclared',
      asset: 'USDT'
    }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-recipient-declaration' })

  const summary = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId: 'pool-recipient-declaration',
      winnerUserIds: ['user-captain', 'user-lina'],
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const view = worker.view()

  assert.equal(summary.type, 'TrustedPoolSettlementCompleted')
  assert.equal(summary.recipientDeclarationEvents.length, 2)
  assert.equal(view.typeCounts.PayoutRecipientDeclared, 2)
  assert.equal(view.payoutRecipientDeclarations['pool-recipient-declaration:user-captain'].recipientHash, core.deterministicHash('0xcaptainrecipientdeclared'))
  assert.deepEqual(capturedPayoutInput.payoutRecipients, {
    'user-captain': '0xcaptainrecipientdeclared',
    'user-lina': '0xlinarecipientdeclared'
  })
})

test('worker trusted pool settlement holds a tampered existing QVAC attestation', () => {
  const worker = createWorkerSim()
  const firstIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-tampered', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const secondIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-lina',
    payload: { poolId: 'pool-tampered', entryId: 'entry-lina', userId: 'user-lina', username: 'lina', amount: 25, asset: 'USDT' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: firstIntent.payload.intentId, confirmationId: 'confirm-captain' }
  })
  worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: secondIntent.payload.intentId, confirmationId: 'confirm-lina' }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-tampered' })
  const poolResultEvent = worker.dispatch({
    type: 'pool:resolveSettlement',
    actorId: 'bracket-rules',
    payload: {
      poolId: 'pool-tampered',
      winnerUserIds: ['user-captain', 'user-lina'],
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const attestation = core.createQvacPoolSettlementAttestation({ poolResult: poolResultEvent.payload })
  const tamperedAttestationEvent = externalEvent(worker, 'QvacPoolSettlementAttestationCreated', {
    ...attestation,
    stateHash: '0xtampered',
    signature: '0xsigned-tampered'
  }, 'qvac-demo-ref')
  worker.mergeEvents([tamperedAttestationEvent])

  const summary = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId: 'pool-tampered',
      winnerUserIds: ['user-captain', 'user-lina'],
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const view = worker.view()

  assert.equal(summary.type, 'TrustedPoolSettlementHeld')
  assert.equal(summary.attestationEvent.eventId, tamperedAttestationEvent.eventId)
  assert.equal(summary.settlementEvent.type, 'TetherWdkPoolPayoutDisputed')
  assert.match(summary.settlementEvent.payload.reason, /stateHash/)
  assert.match(summary.settlementEvent.payload.reason, /signature/)
  assert.equal(view.typeCounts.TetherWdkPoolPayoutPrepared || 0, 0)
})
