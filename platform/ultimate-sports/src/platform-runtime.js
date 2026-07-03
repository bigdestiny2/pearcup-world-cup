'use strict'

const attestation = require('./attestation-engine')
const card = require('./card-engine')
const competition = require('./competition-engine')
const dispute = require('./dispute-engine')
const draft = require('./draft-engine')
const eventLog = require('./event-log')
const feed = require('./feed-engine')
const game = require('./game-engine')
const identity = require('./identity-engine')
const livePrediction = require('./live-prediction-engine')
const miniGame = require('./mini-game-engine')
const pool = require('./pool-engine')
const prediction = require('./prediction-engine')
const room = require('./room-engine')
const settlement = require('./settlement-engine')
const wallet = require('./wallet-engine')

function createPlatformRuntime ({ events = [] } = {}) {
  const log = eventLog.createEventLog(events)

  function dispatch (command = {}) {
    if (!command || typeof command.type !== 'string') throw new TypeError('command.type is required')
    const actorId = command.actorId || 'system'
    const payload = command.payload || {}
    const current = view()

    switch (command.type) {
      case 'user:upsert': {
        const profile = identity.createUserProfile({
          ...payload,
          userId: payload.userId || actorId,
          updatedAt: payload.updatedAt || command.occurredAt
        })
        return append('UserProfileUpserted', profile, actorId, command.occurredAt)
      }
      case 'invite:create': {
        if (payload.scope === 'room') requireRoomModerator(current, payload.scopeId, payload.createdByUserId || actorId)
        const invite = identity.createInvite({
          ...payload,
          createdByUserId: payload.createdByUserId || actorId,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('InviteCreated', invite, actorId, command.occurredAt)
      }
      case 'invite:accept': {
        const invite = payload.invite || current.invites[payload.inviteId] || inviteByCode(current, payload.inviteCode)
        if (!invite) throw new Error(`invite not found: ${payload.inviteId || payload.inviteCode}`)
        if (!identity.inviteAllowsUser({
          invite,
          userId: payload.userId || actorId,
          acceptedInvites: current.inviteAcceptances,
          acceptedAt: payload.acceptedAt || command.occurredAt
        })) {
          throw new Error(`invite does not allow user ${payload.userId || actorId}`)
        }
        const acceptance = identity.acceptInvite({
          invite,
          userId: payload.userId || actorId,
          acceptedAt: payload.acceptedAt || command.occurredAt
        })
        return append('InviteAccepted', acceptance, actorId, command.occurredAt)
      }
      case 'trust:record': {
        if ((payload.action === 'ban' || payload.action === 'unban' || payload.action === 'mute' || payload.action === 'unmute') && payload.scope === 'room') {
          requireRoomModerator(current, payload.scopeId, payload.sourceUserId || actorId)
        }
        const action = identity.createTrustAction({
          ...payload,
          sourceUserId: payload.sourceUserId || actorId,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('TrustActionRecorded', action, actorId, command.occurredAt)
      }
      case 'dispute:open': {
        if (!disputeTargetExists(current, payload.targetType, payload.targetId)) {
          throw new Error(`dispute target not found: ${payload.targetType}:${payload.targetId}`)
        }
        const item = dispute.openDispute({
          ...payload,
          openedByUserId: payload.openedByUserId || actorId,
          openedAt: payload.openedAt || command.occurredAt
        })
        return append('DisputeOpened', item, actorId, command.occurredAt)
      }
      case 'dispute:respond': {
        const targetDispute = payload.dispute || current.disputes[payload.disputeId]
        if (!targetDispute) throw new Error(`dispute not found: ${payload.disputeId}`)
        const item = dispute.respondToDispute({
          dispute: targetDispute,
          responderUserId: payload.responderUserId || actorId,
          response: payload.response,
          evidenceEventIds: payload.evidenceEventIds || [],
          respondedAt: payload.respondedAt || command.occurredAt
        })
        return append('DisputeResponded', item, actorId, command.occurredAt)
      }
      case 'dispute:resolve': {
        const targetDispute = payload.dispute || current.disputes[payload.disputeId]
        if (!targetDispute) throw new Error(`dispute not found: ${payload.disputeId}`)
        const item = dispute.resolveDispute({
          dispute: targetDispute,
          resolvedByUserId: payload.resolvedByUserId || actorId,
          resolution: payload.resolution,
          note: payload.note || null,
          evidenceEventIds: payload.evidenceEventIds || [],
          resolvedAt: payload.resolvedAt || command.occurredAt
        })
        return append('DisputeResolved', item, actorId, command.occurredAt)
      }
      case 'audit:export': {
        const targetEvents = payload.eventIds
          ? log.events().filter(event => payload.eventIds.includes(event.eventId))
          : eventsForAuditTarget(log.events(), payload.targetType, payload.targetId)
        const item = dispute.createAuditBundle({
          targetType: payload.targetType,
          targetId: payload.targetId,
          events: targetEvents,
          dispute: payload.dispute || current.disputes[payload.disputeId] || null,
          label: payload.label || null,
          includePayloads: payload.includePayloads === true,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('AuditBundleCreated', item, actorId, command.occurredAt)
      }
      case 'attestation:create': {
        const evidenceEventIds = payload.evidenceEventIds || payload.sourceEventIds || []
        const evidenceEvents = payload.evidenceEvents || log.events().filter(event => evidenceEventIds.includes(event.eventId))
        const item = attestation.createAttestation({
          lane: payload.lane,
          targetType: payload.targetType,
          targetId: payload.targetId,
          evidenceEvents,
          requiredTypes: payload.requiredTypes || [],
          assertions: payload.assertions || {},
          attestorId: payload.attestorId || actorId,
          summary: payload.summary || null,
          confidence: payload.confidence == null ? 1 : payload.confidence,
          rejectedReason: payload.rejectedReason || null,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('AttestationCreated', item, actorId, command.occurredAt)
      }
      case 'competition:create': {
        const item = competition.createCompetition(payload)
        return append('CompetitionCreated', item, actorId, command.occurredAt)
      }
      case 'pool:create': {
        const item = pool.createPool(payload)
        return append('PoolCreated', item, actorId, command.occurredAt)
      }
      case 'room:create': {
        const item = room.createWatchRoom(payload)
        return append('RoomCreated', item, actorId, command.occurredAt)
      }
      case 'room:join': {
        const targetRoom = payload.room || current.rooms[payload.roomId]
        if (!targetRoom) throw new Error(`room not found: ${payload.roomId}`)
        assertRoomAccess(current, targetRoom, payload.userId || actorId, payload.joinedAt || command.occurredAt)
        const item = room.joinRoom({
          room: targetRoom,
          userId: payload.userId || actorId,
          username: payload.username,
          role: payload.role,
          joinedAt: payload.joinedAt || command.occurredAt
        })
        return append('RoomJoined', item, actorId, command.occurredAt)
      }
      case 'room:leave': {
        requireRoomParticipant(current, payload.roomId, payload.userId || actorId)
        const item = room.leaveRoom({
          roomId: payload.roomId,
          userId: payload.userId || actorId,
          leftAt: payload.leftAt || command.occurredAt
        })
        return append('RoomLeft', item, actorId, command.occurredAt)
      }
      case 'room:chat': {
        const participant = requireRoomParticipant(current, payload.roomId, payload.userId || actorId)
        if (isUserMuted(current, 'room', payload.roomId, payload.userId || actorId)) throw new Error(`user ${payload.userId || actorId} is muted in room ${payload.roomId}`)
        const item = room.createChatMessage({
          roomId: payload.roomId,
          userId: payload.userId || actorId,
          username: payload.username || participant.username,
          body: payload.body,
          replyToId: payload.replyToId || null,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('ChatMessageSent', item, actorId, command.occurredAt)
      }
      case 'room:voice': {
        requireRoomParticipant(current, payload.roomId, payload.userId || actorId)
        const item = room.updateVoiceState({
          roomId: payload.roomId,
          userId: payload.userId || actorId,
          muted: payload.muted,
          speaking: payload.speaking,
          handRaised: payload.handRaised,
          updatedAt: payload.updatedAt || command.occurredAt
        })
        return append('VoiceStateUpdated', item, actorId, command.occurredAt)
      }
      case 'room:react': {
        requireRoomParticipant(current, payload.roomId, payload.userId || actorId)
        const item = room.createReaction({
          roomId: payload.roomId,
          userId: payload.userId || actorId,
          reaction: payload.reaction,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('RoomReactionCreated', item, actorId, command.occurredAt)
      }
      case 'room:moderate': {
        requireRoomModerator(current, payload.roomId, payload.moderatorUserId || actorId)
        const message = current.roomMessages[payload.messageId]
        if (!message || message.roomId !== payload.roomId) throw new Error(`message not found in room: ${payload.messageId}`)
        const item = room.moderateMessage({
          roomId: payload.roomId,
          messageId: payload.messageId,
          moderatorUserId: payload.moderatorUserId || actorId,
          action: payload.action,
          reason: payload.reason,
          moderatedAt: payload.moderatedAt || command.occurredAt
        })
        return append('RoomMessageModerated', item, actorId, command.occurredAt)
      }
      case 'room:challenge': {
        requireRoomParticipant(current, payload.roomId, payload.challengerUserId || actorId)
        requireRoomParticipant(current, payload.roomId, payload.targetUserId)
        const item = room.createRoomChallenge({
          roomId: payload.roomId,
          challengerUserId: payload.challengerUserId || actorId,
          targetUserId: payload.targetUserId,
          challengeType: payload.challengeType,
          gameType: payload.gameType,
          marketType: payload.marketType,
          sideQuest: payload.sideQuest,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('RoomChallengeCreated', item, actorId, command.occurredAt)
      }
      case 'room:acceptChallenge': {
        const challenge = payload.challenge || current.roomChallenges[payload.challengeId]
        if (!challenge) throw new Error(`challenge not found: ${payload.challengeId}`)
        requireRoomParticipant(current, challenge.roomId, payload.acceptedByUserId || actorId)
        const item = room.acceptRoomChallenge({
          challenge,
          acceptedByUserId: payload.acceptedByUserId || actorId,
          acceptedAt: payload.acceptedAt || command.occurredAt
        })
        return append('RoomChallengeAccepted', item, actorId, command.occurredAt)
      }
      case 'prediction:submit': {
        const entry = prediction.createPredictionEntry(payload)
        const submitted = prediction.submitPredictionEntry(entry, payload.submittedAt || command.occurredAt)
        return append('PredictionEntrySubmitted', submitted, actorId, command.occurredAt)
      }
      case 'prediction:lock': {
        const entry = payload.entry || current.predictionEntries[payload.entryId]
        if (!entry) throw new Error(`entry not found: ${payload.entryId}`)
        const locked = prediction.lockPredictionEntry(entry, payload.lockedAt || command.occurredAt)
        return append('PredictionEntryLocked', locked, actorId, command.occurredAt)
      }
      case 'result:record': {
        const snapshot = feed.createResultSnapshot(payload)
        return append('ResultSnapshotRecorded', snapshot, actorId, command.occurredAt)
      }
      case 'result:correct': {
        const snapshot = payload.snapshot || current.resultSnapshots[payload.snapshotId]
        if (!snapshot) throw new Error(`result snapshot not found: ${payload.snapshotId}`)
        const correction = feed.createHostResultCorrection({
          ...payload,
          hostUserId: payload.hostUserId || actorId,
          correctedAt: payload.correctedAt || command.occurredAt
        })
        const corrected = feed.applyResultCorrection(snapshot, correction)
        return append('ResultSnapshotCorrected', corrected, actorId, command.occurredAt)
      }
      case 'feed:registerAdapter': {
        const adapter = feed.createFeedAdapter({
          ...payload,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('FeedAdapterRegistered', adapter, actorId, command.occurredAt)
      }
      case 'feed:recordFrame': {
        const adapter = payload.adapter || current.feedAdapters[payload.adapterId]
        if (!adapter) throw new Error(`feed adapter not found: ${payload.adapterId}`)
        const frame = feed.createFeedFrame({
          ...payload,
          adapter,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('FeedFrameRecorded', frame, actorId, command.occurredAt)
      }
      case 'result:recordFromFeed': {
        const adapter = payload.adapter || current.feedAdapters[payload.adapterId]
        if (!adapter) throw new Error(`feed adapter not found: ${payload.adapterId}`)
        const frames = payload.frames || feedFramesForAdapter(current, adapter.adapterId, payload.frameIds)
        const replay = feed.replayFeedFrames(frames, { adapter })
        const snapshot = feed.createResultSnapshotFromReplay({
          ...payload,
          adapter,
          replay,
          recordedAt: payload.recordedAt || command.occurredAt
        })
        return append('ResultSnapshotRecorded', snapshot, actorId, command.occurredAt)
      }
      case 'pool:resolve': {
        const targetPool = payload.pool || current.pools[payload.poolId]
        const resultSnapshot = payload.resultSnapshot || current.resultSnapshots[payload.resultSnapshotId]
        if (!targetPool) throw new Error(`pool not found: ${payload.poolId}`)
        if (!resultSnapshot) throw new Error(`result snapshot not found: ${payload.resultSnapshotId}`)
        const entries = Object.values(current.predictionEntries)
          .filter(entry => entry.poolId === targetPool.poolId && entry.status === 'locked')
        const resolved = pool.resolvePoolWinners({ pool: targetPool, entries, resultSnapshot })
        return append('PoolSettlementResolved', resolved, actorId, command.occurredAt)
      }
      case 'settlement:plan': {
        const plan = settlement.createSettlementPlan(payload)
        return append('SettlementPlanCreated', plan, actorId, command.occurredAt)
      }
      case 'settlement:receipt': {
        const plan = payload.settlementPlan || current.settlementPlans[payload.settlementPlanId]
        if (!plan) throw new Error(`settlement plan not found: ${payload.settlementPlanId}`)
        const settlementResult = payload.settlementResult || settlementResultForPlan(current, plan)
        if (!settlementResult) throw new Error(`settlement result not found: ${plan.targetType || 'pool'}:${plan.targetId || plan.poolId}`)
        const sourceEvents = payload.sourceEvents || log.events().filter(event => (plan.sourceEventIds || []).includes(event.eventId))
        const receipt = settlement.createSettlementReceipt({
          settlementPlan: plan,
          settlementResult,
          sourceEvents,
          requiredTypes: payload.requiredTypes,
          eventRoot: log.root(),
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('SettlementReceiptCreated', receipt, actorId, command.occurredAt)
      }
      case 'sponsor:createFulfillment': {
        const receipt = payload.receipt || current.settlementReceipts[payload.receiptId]
        if (!receipt) throw new Error(`settlement receipt not found: ${payload.receiptId}`)
        const item = settlement.createSponsorPrizeFulfillment({
          ...payload,
          receiptId: receipt.receiptId,
          updatedAt: payload.updatedAt || command.occurredAt
        })
        return append('SponsorPrizeFulfillmentCreated', item, actorId, command.occurredAt)
      }
      case 'sponsor:updateFulfillment': {
        const fulfillment = payload.fulfillment || current.sponsorFulfillments[payload.fulfillmentId]
        if (!fulfillment) throw new Error(`sponsor fulfillment not found: ${payload.fulfillmentId}`)
        const item = settlement.updateSponsorPrizeFulfillment(fulfillment, {
          status: payload.status,
          trackingRef: payload.trackingRef,
          note: payload.note,
          updatedAt: payload.updatedAt || command.occurredAt
        })
        return append('SponsorPrizeFulfillmentUpdated', item, actorId, command.occurredAt)
      }
      case 'wallet:createAccount': {
        const account = wallet.createWalletAccount({
          ...payload,
          userId: payload.userId || actorId,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('WalletAccountCreated', account, actorId, command.occurredAt)
      }
      case 'wallet:credit':
      case 'wallet:debit':
      case 'wallet:hold':
      case 'wallet:release':
      case 'wallet:award': {
        const account = walletAccountForLedgerCommand(current, payload)
        const entry = wallet.createLedgerEntry({
          ...payload,
          accountId: account.accountId,
          userId: payload.userId || account.userId || actorId,
          type: ledgerTypeForCommand(command.type),
          currency: payload.currency || account.currency,
          createdAt: payload.createdAt || command.occurredAt
        })
        assertLedgerEntryCanApply(current, entry)
        return append('WalletLedgerEntryRecorded', entry, actorId, command.occurredAt)
      }
      case 'wallet:createPayoutRoute': {
        const route = wallet.createPayoutRoute({
          ...payload,
          userId: payload.userId || actorId,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('PayoutRouteCreated', route, actorId, command.occurredAt)
      }
      case 'wallet:grantReceiptRewards': {
        const receipt = payload.receipt || current.settlementReceipts[payload.receiptId]
        if (!receipt) throw new Error(`settlement receipt not found: ${payload.receiptId}`)
        const grant = wallet.createReceiptRewardGrant({
          ...payload,
          receipt,
          accountsByUserId: accountsByUserForReward(current, payload),
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('WalletRewardsGranted', grant, actorId, command.occurredAt)
      }
      case 'market:create': {
        const market = livePrediction.createPredictionMarket(payload)
        return append('PredictionMarketCreated', market, actorId, command.occurredAt)
      }
      case 'market:predict': {
        const market = payload.market || current.markets[payload.marketId]
        if (!market) throw new Error(`market not found: ${payload.marketId}`)
        const item = livePrediction.submitWatchPrediction({
          market,
          userId: payload.userId || actorId,
          outcome: payload.outcome,
          submittedAt: payload.submittedAt || command.occurredAt
        })
        return append('WatchPredictionSubmitted', item, actorId, command.occurredAt)
      }
      case 'market:lock': {
        const market = payload.market || current.markets[payload.marketId]
        if (!market) throw new Error(`market not found: ${payload.marketId}`)
        const item = livePrediction.lockPredictionMarket(market, payload.lockedAt || command.occurredAt)
        return append('PredictionMarketLocked', item, actorId, command.occurredAt)
      }
      case 'market:resolve': {
        const market = payload.market || current.markets[payload.marketId]
        if (!market) throw new Error(`market not found: ${payload.marketId}`)
        const predictions = Object.values(current.watchPredictions)
          .filter(item => item.marketId === market.marketId)
        const resolved = livePrediction.resolvePredictionMarket({
          market,
          predictions,
          result: payload.result,
          resolvedAt: payload.resolvedAt || command.occurredAt
        })
        return append('PredictionMarketResolved', resolved, actorId, command.occurredAt)
      }
      case 'market:resolveStreak': {
        const marketIds = payload.marketIds || Object.keys(current.marketResolutions)
        const marketResolutions = marketIds.map(marketId => current.marketResolutions[marketId]).filter(Boolean)
        const resolved = livePrediction.resolveWatchPredictionStreak({
          roomId: payload.roomId || null,
          marketResolutions,
          userIds: payload.userIds || [],
          streakId: payload.streakId || null,
          resolvedAt: payload.resolvedAt || command.occurredAt
        })
        return append('WatchPredictionStreakResolved', resolved, actorId, command.occurredAt)
      }
      case 'game:create': {
        const session = game.createPeerGameSession(payload)
        return append('PeerGameSessionCreated', session, actorId, command.occurredAt)
      }
      case 'game:start': {
        const session = payload.session || current.gameSessions[payload.gameId]
        if (!session) throw new Error(`game not found: ${payload.gameId}`)
        return append('PeerGameSessionStarted', game.startPeerGameSession(session), actorId, command.occurredAt)
      }
      case 'game:commit': {
        const commitment = game.createGameCommitment(payload)
        return append('PeerGameInputCommitted', commitment, actorId, command.occurredAt)
      }
      case 'game:reveal': {
        const key = gameInputKey(payload)
        const commitment = payload.commitment || current.gameCommitments[key]
        if (!commitment) throw new Error(`commitment not found: ${key}`)
        const reveal = game.revealGameInput({
          commitment,
          input: payload.input,
          nonce: payload.nonce,
          revealedAt: payload.revealedAt || command.occurredAt
        })
        if (!game.verifyGameCommitment({ commitment, reveal })) throw new Error('reveal does not match commitment')
        return append('PeerGameInputRevealed', reveal, actorId, command.occurredAt)
      }
      case 'game:resolve': {
        const session = payload.session || current.gameSessions[payload.gameId]
        if (!session) throw new Error(`game not found: ${payload.gameId}`)
        const reveals = payload.reveals || Object.values(current.gameReveals)
          .filter(reveal => reveal.gameId === session.gameId)
        const resolved = miniGame.resolveMiniGame({
          session,
          reveals,
          result: payload.result || {},
          resolvedAt: payload.resolvedAt || command.occurredAt
        })
        return append('PeerGameSessionResolved', resolved, actorId, command.occurredAt)
      }
      case 'card:create': {
        const item = card.createPredictionCard(payload)
        return append('PredictionCardCreated', item, actorId, command.occurredAt)
      }
      case 'card:submit': {
        const targetCard = payload.card || current.cards[payload.cardId]
        if (!targetCard) throw new Error(`card not found: ${payload.cardId}`)
        const item = card.createCardSubmission({
          card: targetCard,
          userId: payload.userId || actorId,
          answers: payload.answers,
          submittedAt: payload.submittedAt || command.occurredAt
        })
        return append('PredictionCardSubmitted', item, actorId, command.occurredAt)
      }
      case 'card:resolve': {
        const targetCard = payload.card || current.cards[payload.cardId]
        if (!targetCard) throw new Error(`card not found: ${payload.cardId}`)
        const submissions = payload.submissions || Object.values(current.cardSubmissions)
          .filter(submission => submission.cardId === targetCard.cardId)
        const item = card.resolvePredictionCard({
          card: targetCard,
          submissions,
          results: payload.results || {},
          resolvedAt: payload.resolvedAt || command.occurredAt
        })
        return append('PredictionCardResolved', item, actorId, command.occurredAt)
      }
      case 'draft:create': {
        const item = draft.createDraftSlate(payload)
        return append('DraftSlateCreated', item, actorId, command.occurredAt)
      }
      case 'draft:submit': {
        const slate = payload.slate || current.draftSlates[payload.slateId]
        if (!slate) throw new Error(`draft slate not found: ${payload.slateId}`)
        const item = draft.createDraftEntry({
          slate,
          userId: payload.userId || actorId,
          athleteIds: payload.athleteIds || [],
          submittedAt: payload.submittedAt || command.occurredAt
        })
        return append('DraftEntrySubmitted', item, actorId, command.occurredAt)
      }
      case 'draft:resolve': {
        const slate = payload.slate || current.draftSlates[payload.slateId]
        if (!slate) throw new Error(`draft slate not found: ${payload.slateId}`)
        const entries = payload.entries || Object.values(current.draftEntries)
          .filter(entry => entry.slateId === slate.slateId)
        const item = draft.resolveDraftSlate({
          slate,
          entries,
          athleteStats: payload.athleteStats || {},
          resolvedAt: payload.resolvedAt || command.occurredAt
        })
        return append('DraftSlateResolved', item, actorId, command.occurredAt)
      }
      default:
        throw new Error(`unknown command: ${command.type}`)
    }
  }

  function append (type, payload, actorId, occurredAt) {
    return log.append({ type, payload, actorId, occurredAt })
  }

  function view () {
    return derivePlatformView(log.events())
  }

  return {
    dispatch,
    merge: log.merge,
    events: log.events,
    root: log.root,
    view
  }
}

function derivePlatformView (events = []) {
  const view = {
    competitions: {},
    profiles: {},
    invites: {},
    inviteAcceptances: {},
    trustActions: {},
    disputes: {},
    disputesByTarget: {},
    auditBundles: {},
    attestations: {},
    attestationsByTarget: {},
    pools: {},
    rooms: {},
    roomParticipants: {},
    roomMessages: {},
    roomVoiceStates: {},
    roomReactions: {},
    roomChallenges: {},
    predictionEntries: {},
    resultSnapshots: {},
    feedAdapters: {},
    feedFrames: {},
    feedStates: {},
    poolSettlements: {},
    settlementPlans: {},
    settlementReceipts: {},
    sponsorFulfillments: {},
    walletAccounts: {},
    walletLedgerEntries: {},
    walletBalances: {},
    payoutRoutes: {},
    walletRewardGrants: {},
    markets: {},
    watchPredictions: {},
    marketResolutions: {},
    streakResolutions: {},
    gameSessions: {},
    gameCommitments: {},
    gameReveals: {},
    gameResolutions: {},
    cards: {},
    cardSubmissions: {},
    cardResolutions: {},
    draftSlates: {},
    draftEntries: {},
    draftResolutions: {},
    eventRoot: eventLog.eventRoot(events)
  }

  events.forEach(event => {
    const payload = event.payload || {}
    switch (event.type) {
      case 'UserProfileUpserted':
        view.profiles[payload.userId] = payload
        break
      case 'InviteCreated':
        view.invites[payload.inviteId] = payload
        break
      case 'InviteAccepted':
        view.inviteAcceptances[payload.inviteAcceptanceId] = payload
        break
      case 'TrustActionRecorded':
        view.trustActions[payload.trustActionId] = payload
        break
      case 'DisputeOpened':
      case 'DisputeResponded':
      case 'DisputeResolved':
        view.disputes[payload.disputeId] = payload
        if (!view.disputesByTarget[targetKey(payload.targetType, payload.targetId)]) {
          view.disputesByTarget[targetKey(payload.targetType, payload.targetId)] = []
        }
        view.disputesByTarget[targetKey(payload.targetType, payload.targetId)] = view.disputesByTarget[targetKey(payload.targetType, payload.targetId)]
          .filter(disputeId => disputeId !== payload.disputeId)
        view.disputesByTarget[targetKey(payload.targetType, payload.targetId)].push(payload.disputeId)
        break
      case 'AuditBundleCreated':
        view.auditBundles[payload.auditBundleId] = payload
        break
      case 'AttestationCreated':
        view.attestations[payload.attestationId] = payload
        if (!view.attestationsByTarget[targetKey(payload.targetType, payload.targetId)]) {
          view.attestationsByTarget[targetKey(payload.targetType, payload.targetId)] = []
        }
        view.attestationsByTarget[targetKey(payload.targetType, payload.targetId)] = view.attestationsByTarget[targetKey(payload.targetType, payload.targetId)]
          .filter(attestationId => attestationId !== payload.attestationId)
        view.attestationsByTarget[targetKey(payload.targetType, payload.targetId)].push(payload.attestationId)
        break
      case 'CompetitionCreated':
        view.competitions[payload.competitionId] = payload
        break
      case 'PoolCreated':
        view.pools[payload.poolId] = payload
        break
      case 'RoomCreated':
        view.rooms[payload.roomId] = payload
        if (!view.roomParticipants[payload.roomId]) view.roomParticipants[payload.roomId] = {}
        break
      case 'RoomJoined':
        if (!view.roomParticipants[payload.roomId]) view.roomParticipants[payload.roomId] = {}
        view.roomParticipants[payload.roomId][payload.userId] = payload
        break
      case 'RoomLeft':
        if (view.roomParticipants[payload.roomId] && view.roomParticipants[payload.roomId][payload.userId]) {
          view.roomParticipants[payload.roomId][payload.userId] = {
            ...view.roomParticipants[payload.roomId][payload.userId],
            leftAt: payload.leftAt,
            status: 'left'
          }
        }
        break
      case 'ChatMessageSent':
        view.roomMessages[payload.messageId] = payload
        break
      case 'VoiceStateUpdated':
        if (!view.roomVoiceStates[payload.roomId]) view.roomVoiceStates[payload.roomId] = {}
        view.roomVoiceStates[payload.roomId][payload.userId] = payload
        break
      case 'RoomReactionCreated':
        if (!view.roomReactions[payload.roomId]) view.roomReactions[payload.roomId] = []
        view.roomReactions[payload.roomId].push(payload)
        break
      case 'RoomMessageModerated':
        if (view.roomMessages[payload.messageId]) {
          const moderationState = payload.action === 'restore-message'
            ? 'visible'
            : payload.action === 'report-message'
                ? 'reported'
                : 'hidden'
          view.roomMessages[payload.messageId] = {
            ...view.roomMessages[payload.messageId],
            moderationState,
            moderation: payload
          }
        }
        break
      case 'RoomChallengeCreated':
      case 'RoomChallengeAccepted':
        view.roomChallenges[payload.challengeId] = payload
        break
      case 'PredictionEntrySubmitted':
      case 'PredictionEntryLocked':
        view.predictionEntries[payload.entryId] = payload
        break
      case 'ResultSnapshotRecorded':
      case 'ResultSnapshotCorrected':
        view.resultSnapshots[payload.snapshotId] = payload
        break
      case 'FeedAdapterRegistered':
        view.feedAdapters[payload.adapterId] = payload
        break
      case 'FeedFrameRecorded':
        view.feedFrames[payload.frameId] = payload
        break
      case 'PoolSettlementResolved':
        view.poolSettlements[payload.poolId] = payload
        break
      case 'SettlementPlanCreated':
        view.settlementPlans[payload.settlementPlanId] = payload
        break
      case 'SettlementReceiptCreated':
        view.settlementReceipts[payload.receiptId] = payload
        break
      case 'SponsorPrizeFulfillmentCreated':
      case 'SponsorPrizeFulfillmentUpdated':
        view.sponsorFulfillments[payload.fulfillmentId] = payload
        break
      case 'WalletAccountCreated':
        view.walletAccounts[payload.accountId] = payload
        break
      case 'WalletLedgerEntryRecorded':
        view.walletLedgerEntries[payload.entryId] = payload
        break
      case 'WalletRewardsGranted':
        view.walletRewardGrants[payload.grantId] = payload
        ;(payload.entries || []).forEach(entry => {
          view.walletLedgerEntries[entry.entryId] = entry
        })
        break
      case 'PayoutRouteCreated':
        view.payoutRoutes[payload.routeId] = payload
        break
      case 'PredictionMarketCreated':
      case 'PredictionMarketLocked':
        view.markets[payload.marketId] = payload
        break
      case 'WatchPredictionSubmitted':
        view.watchPredictions[payload.predictionId] = payload
        break
      case 'PredictionMarketResolved':
        view.marketResolutions[payload.market.marketId] = payload
        view.markets[payload.market.marketId] = payload.market
        break
      case 'WatchPredictionStreakResolved':
        view.streakResolutions[payload.streakId] = payload
        break
      case 'PeerGameSessionCreated':
      case 'PeerGameSessionStarted':
        view.gameSessions[payload.gameId] = payload
        break
      case 'PeerGameInputCommitted':
        view.gameCommitments[gameInputKey(payload)] = payload
        break
      case 'PeerGameInputRevealed':
        view.gameReveals[gameInputKey(payload)] = payload
        break
      case 'PeerGameSessionResolved':
        view.gameResolutions[payload.gameId] = payload
        if (view.gameSessions[payload.gameId]) {
          view.gameSessions[payload.gameId] = {
            ...view.gameSessions[payload.gameId],
            status: 'resolved',
            resolvedAt: payload.resolvedAt,
            resultId: payload.resultId
          }
        }
        break
      case 'PredictionCardCreated':
        view.cards[payload.cardId] = payload
        break
      case 'PredictionCardSubmitted':
        view.cardSubmissions[payload.submissionId] = payload
        break
      case 'PredictionCardResolved':
        view.cardResolutions[payload.cardId] = payload
        break
      case 'DraftSlateCreated':
        view.draftSlates[payload.slateId] = payload
        break
      case 'DraftEntrySubmitted':
        view.draftEntries[payload.entryId] = payload
        break
      case 'DraftSlateResolved':
        view.draftResolutions[payload.slateId] = payload
        break
    }
  })

  Object.values(view.feedAdapters).forEach(adapter => {
    view.feedStates[adapter.adapterId] = feed.replayFeedFrames(feedFramesForAdapter(view, adapter.adapterId), { adapter })
  })
  view.walletBalances = wallet.deriveLedgerBalances(Object.values(view.walletLedgerEntries), view.walletAccounts)
  return view
}

function gameInputKey (payload = {}) {
  return `${payload.gameId}:${payload.roundId}:${payload.playerId}`
}

function requireRoomParticipant (view, roomId, userId) {
  if (!roomId) throw new Error('roomId is required')
  if (!userId) throw new Error('userId is required')
  const participant = view.roomParticipants[roomId] && view.roomParticipants[roomId][userId]
  if (!participant || participant.status === 'left') {
    throw new Error(`user ${userId} has not joined room ${roomId}`)
  }
  if (isUserBanned(view, 'room', roomId, userId)) {
    throw new Error(`user ${userId} is banned from room ${roomId}`)
  }
  return participant
}

function requireRoomModerator (view, roomId, userId) {
  const participant = requireRoomParticipant(view, roomId, userId)
  if (participant.role !== 'host' && participant.role !== 'moderator') {
    throw new Error(`user ${userId} is not a room moderator`)
  }
  return participant
}

function settlementResultForPlan (view, plan = {}) {
  const targetType = plan.targetType || 'pool'
  const targetId = plan.targetId || plan.poolId
  if (targetType === 'pool') return view.poolSettlements[targetId]
  if (targetType === 'game') return view.gameResolutions[targetId]
  if (targetType === 'card') return view.cardResolutions[targetId]
  if (targetType === 'draft') return view.draftResolutions[targetId]
  if (targetType === 'market') return view.marketResolutions[targetId] || view.streakResolutions[targetId]
  return null
}

function assertRoomAccess (view, room, userId, joinedAt) {
  if (isUserBanned(view, 'room', room.roomId, userId)) throw new Error(`user ${userId} is banned from room ${room.roomId}`)
  if (room.hostUserId === userId || room.access !== 'invite-only') return true

  const accepted = Object.values(view.inviteAcceptances)
    .some(acceptance => acceptance.userId === userId && acceptance.scope === 'room' && acceptance.scopeId === room.roomId)
  if (!accepted) throw new Error(`user ${userId} needs an accepted invite for room ${room.roomId}`)

  const invite = Object.values(view.invites)
    .find(invite => invite.scope === 'room' && invite.scopeId === room.roomId &&
      Object.values(view.inviteAcceptances).some(acceptance => acceptance.inviteId === invite.inviteId && acceptance.userId === userId))
  if (invite && !identity.inviteAllowsUser({
    invite,
    userId,
    acceptedInvites: view.inviteAcceptances,
    acceptedAt: joinedAt
  })) {
    throw new Error(`invite no longer allows user ${userId}`)
  }
  return true
}

function inviteByCode (view, inviteCode) {
  if (!inviteCode) return null
  return Object.values(view.invites).find(invite => invite.inviteCode === inviteCode) || null
}

function latestTrustAction (view, scope, scopeId, targetUserId, actions) {
  return Object.values(view.trustActions)
    .filter(item => item.scope === scope && item.scopeId === scopeId && item.targetUserId === targetUserId && actions.includes(item.action))
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))[0] || null
}

function isUserBanned (view, scope, scopeId, userId) {
  const action = latestTrustAction(view, scope, scopeId, userId, ['ban', 'unban'])
  return Boolean(action && action.action === 'ban')
}

function isUserMuted (view, scope, scopeId, userId) {
  const action = latestTrustAction(view, scope, scopeId, userId, ['mute', 'unmute'])
  return Boolean(action && action.action === 'mute')
}

function ledgerTypeForCommand (commandType) {
  return commandType.replace('wallet:', '')
}

function walletAccountForLedgerCommand (view, payload = {}) {
  const account = payload.account || view.walletAccounts[payload.accountId]
  if (!account) throw new Error(`wallet account not found: ${payload.accountId}`)
  if (account.status && account.status !== 'active') throw new Error(`wallet account is not active: ${account.accountId}`)
  return account
}

function assertLedgerEntryCanApply (view, entry) {
  const balance = view.walletBalances[entry.accountId] || {
    balance: 0,
    holds: 0,
    available: 0
  }
  if ((entry.type === 'debit' || entry.type === 'hold') && entry.amount > balance.available) {
    throw new Error(`wallet account has insufficient available balance: ${entry.accountId}`)
  }
  if (entry.type === 'release' && entry.amount > balance.holds) {
    throw new Error(`wallet account has insufficient held balance: ${entry.accountId}`)
  }
}

function accountsByUserForReward (view, payload = {}) {
  const override = payload.accountsByUserId || payload.accountIdsByUserId || {}
  const accountsByUserId = {}
  Object.values(view.walletAccounts).forEach(account => {
    if (account.status !== 'active') return
    if (!accountsByUserId[account.userId]) accountsByUserId[account.userId] = account
  })
  Object.entries(override).forEach(([userId, accountOrId]) => {
    accountsByUserId[userId] = typeof accountOrId === 'string'
      ? view.walletAccounts[accountOrId] || accountOrId
      : accountOrId
  })
  return accountsByUserId
}

function feedFramesForAdapter (view, adapterId, frameIds = null) {
  const selectedFrameIds = Array.isArray(frameIds) ? new Set(frameIds) : null
  return Object.values(view.feedFrames || {})
    .filter(frame => frame.adapterId === adapterId && (!selectedFrameIds || selectedFrameIds.has(frame.frameId)))
}

function targetKey (targetType, targetId) {
  return `${targetType}:${targetId}`
}

function disputeTargetExists (view, targetType, targetId) {
  if (!targetType || !targetId) return false
  if (targetType === 'receipt') return Boolean(view.settlementReceipts[targetId])
  if (targetType === 'wallet-account') return Boolean(view.walletAccounts[targetId])
  if (targetType === 'wallet-entry') return Boolean(view.walletLedgerEntries[targetId])
  if (targetType === 'payout-route') return Boolean(view.payoutRoutes[targetId])
  if (targetType === 'feed-adapter') return Boolean(view.feedAdapters[targetId])
  if (targetType === 'feed-frame') return Boolean(view.feedFrames[targetId])
  if (targetType === 'result-snapshot') return Boolean(view.resultSnapshots[targetId])
  if (targetType === 'pool') return Boolean(view.pools[targetId] || view.poolSettlements[targetId])
  if (targetType === 'game') return Boolean(view.gameSessions[targetId] || view.gameResolutions[targetId])
  if (targetType === 'card') return Boolean(view.cards[targetId] || view.cardResolutions[targetId])
  if (targetType === 'draft') return Boolean(view.draftSlates[targetId] || view.draftResolutions[targetId])
  if (targetType === 'market') return Boolean(view.markets[targetId] || view.marketResolutions[targetId] || view.streakResolutions[targetId])
  if (targetType === 'room-message') return Boolean(view.roomMessages[targetId])
  return false
}

function eventsForAuditTarget (events = [], targetType, targetId) {
  return events.filter(event => eventTouchesTarget(event, targetType, targetId))
}

function eventTouchesTarget (event = {}, targetType, targetId) {
  const payload = event.payload || {}
  if (targetType === 'receipt') return payload.receiptId === targetId || payload.body && payload.body.receiptId === targetId
  if (targetType === 'wallet-account') return payload.accountId === targetId
  if (targetType === 'wallet-entry') return payload.entryId === targetId || Array.isArray(payload.entries) && payload.entries.some(entry => entry.entryId === targetId)
  if (targetType === 'payout-route') return payload.routeId === targetId
  if (targetType === 'feed-adapter') return payload.adapterId === targetId
  if (targetType === 'feed-frame') return payload.frameId === targetId || Array.isArray(payload.sourceFeedEventIds) && payload.sourceFeedEventIds.includes(targetId)
  if (targetType === 'result-snapshot') return payload.snapshotId === targetId || payload.resultSnapshotId === targetId
  if (targetType === 'pool') return payload.poolId === targetId || payload.body && payload.body.poolId === targetId
  if (targetType === 'game') return payload.gameId === targetId
  if (targetType === 'card') return payload.cardId === targetId
  if (targetType === 'draft') return payload.slateId === targetId
  if (targetType === 'market') return payload.marketId === targetId || payload.market && payload.market.marketId === targetId || payload.streakId === targetId
  if (targetType === 'room-message') return payload.messageId === targetId
  return false
}

module.exports = {
  createPlatformRuntime,
  derivePlatformView,
  gameInputKey,
  feedFramesForAdapter,
  requireRoomParticipant,
  requireRoomModerator,
  settlementResultForPlan,
  assertRoomAccess,
  inviteByCode,
  isUserBanned,
  isUserMuted,
  targetKey,
  disputeTargetExists,
  eventsForAuditTarget,
  eventTouchesTarget
}
