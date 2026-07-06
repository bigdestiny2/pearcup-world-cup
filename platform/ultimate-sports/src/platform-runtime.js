'use strict'

const attestation = require('./attestation-engine')
const card = require('./card-engine')
const compliance = require('./compliance-engine')
const competition = require('./competition-engine')
const creator = require('./creator-engine')
const dispute = require('./dispute-engine')
const draft = require('./draft-engine')
const engagement = require('./engagement-engine')
const eventLog = require('./event-log')
const feed = require('./feed-engine')
const game = require('./game-engine')
const identity = require('./identity-engine')
const livePrediction = require('./live-prediction-engine')
const miniGame = require('./mini-game-engine')
const notification = require('./notification-engine')
const pool = require('./pool-engine')
const prediction = require('./prediction-engine')
const qvac = require('./qvac-engine')
const room = require('./room-engine')
const settlement = require('./settlement-engine')
const wallet = require('./wallet-engine')
const wdk = require('./wdk-adapter-engine')
const miniGameRunner = require('./mini-game-runner-engine')

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
      case 'qvac:summarizeRoom': {
        const targetRoom = payload.room || current.rooms[payload.roomId]
        if (!targetRoom) throw new Error(`room not found: ${payload.roomId}`)
        const evidenceEvents = qvacEvidenceEvents({
          log,
          payload,
          fallbackEvents: eventsForRoom(log.events(), targetRoom.roomId)
        })
        const item = qvac.createRoomSummary({
          ...payload,
          room: targetRoom,
          competition: current.competitions[targetRoom.competitionId] || null,
          evidenceEvents,
          feedFrames: payload.feedFrames || feedFramesForCompetition(current, targetRoom.competitionId, targetRoom.fixtureId),
          resultSnapshots: payload.resultSnapshots || resultSnapshotsForCompetition(current, targetRoom.competitionId),
          marketResolutions: payload.marketResolutions || marketResolutionsForRoom(current, targetRoom.roomId),
          gameResolutions: payload.gameResolutions || gameResolutionsForRoom(current, targetRoom.roomId),
          challenges: payload.challenges || roomChallengesForRoom(current, targetRoom.roomId),
          messages: payload.messages || roomMessagesForRoom(current, targetRoom.roomId),
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('QvacRoomSummaryCreated', item, actorId, command.occurredAt)
      }
      case 'qvac:createCommentary': {
        const feedFrame = payload.feedFrame || current.feedFrames[payload.frameId]
        if (!feedFrame && !payload.feedEvent) throw new Error(`feed frame not found: ${payload.frameId}`)
        const evidenceEvents = qvacEvidenceEvents({
          log,
          payload,
          fallbackEvents: feedFrame
            ? log.events().filter(event => event.payload && event.payload.frameId === feedFrame.frameId)
            : []
        })
        const item = qvac.createCommentaryFrame({
          ...payload,
          feedFrame,
          evidenceEvents,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('QvacCommentaryCreated', item, actorId, command.occurredAt)
      }
      case 'qvac:createCreatorDraft': {
        const item = qvac.createCreatorAssistantDraft({
          ...payload,
          organizerId: payload.organizerId || actorId,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('QvacCreatorDraftCreated', item, actorId, command.occurredAt)
      }
      case 'qvac:createTriviaBank': {
        const item = qvac.createTriviaQuestionBank({
          ...payload,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('QvacTriviaBankCreated', item, actorId, command.occurredAt)
      }
      case 'qvac:reviewResultEvidence': {
        const evidenceEvents = qvacEvidenceEvents({
          log,
          payload,
          fallbackEvents: payload.fixtureId
            ? log.events().filter(event => event.payload && event.payload.fixtureId === payload.fixtureId)
            : []
        })
        const item = qvac.createResultEvidenceReview({
          ...payload,
          evidenceEvents,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('QvacResultEvidenceReviewCreated', item, actorId, command.occurredAt)
      }
      case 'creator:draftCompetition': {
        const item = creator.createCreatorCompetitionDraft({
          ...payload,
          organizerId: payload.organizerId || actorId
        })
        return append('CreatorCompetitionDraftCreated', item, actorId, command.occurredAt)
      }
      case 'creator:addEntrant': {
        const targetDraft = payload.draft || current.creatorCompetitionDrafts[payload.draftId]
        if (!targetDraft) throw new Error(`creator draft not found: ${payload.draftId}`)
        requireCreatorDraftOrganizer(targetDraft, payload.organizerId || actorId)
        const next = creator.addEntrantToCreatorDraft(targetDraft, payload.entrant || payload)
        const entrant = next.entrants[next.entrants.length - 1]
        return append('CreatorCompetitionDraftEntrantAdded', {
          draftId: targetDraft.draftId,
          entrant,
          draft: next
        }, actorId, command.occurredAt)
      }
      case 'creator:seedBracket': {
        const targetDraft = payload.draft || current.creatorCompetitionDrafts[payload.draftId]
        if (!targetDraft) throw new Error(`creator draft not found: ${payload.draftId}`)
        requireCreatorDraftOrganizer(targetDraft, payload.organizerId || actorId)
        const next = creator.seedCreatorBracketDraft(targetDraft, {
          ...payload,
          startsAt: payload.startsAt || command.occurredAt
        })
        return append('CreatorCompetitionDraftSeeded', {
          draftId: targetDraft.draftId,
          draft: next,
          bracket: next.bracket
        }, actorId, command.occurredAt)
      }
      case 'creator:createPublishPlan': {
        const targetDraft = payload.draft || current.creatorCompetitionDrafts[payload.draftId]
        if (!targetDraft) throw new Error(`creator draft not found: ${payload.draftId}`)
        requireCreatorDraftOrganizer(targetDraft, payload.organizerId || actorId)
        const plan = creator.createCreatorPublishPlan(targetDraft, {
          ...payload,
          hostUserId: payload.hostUserId || actorId,
          occurredAt: payload.occurredAt || command.occurredAt
        })
        return append('CreatorCompetitionPublishPlanCreated', plan, actorId, command.occurredAt)
      }
      case 'qvac:reviewMessage': {
        const message = payload.message || current.roomMessages[payload.messageId]
        if (!message && !payload.body) throw new Error(`message not found: ${payload.messageId}`)
        if (message && message.roomId) requireRoomModerator(current, message.roomId, payload.moderatorUserId || actorId)
        const evidenceEvents = qvacEvidenceEvents({
          log,
          payload,
          fallbackEvents: message
            ? log.events().filter(event => event.payload && event.payload.messageId === message.messageId)
            : []
        })
        const item = qvac.createModerationReview({
          ...payload,
          message,
          userId: payload.userId || message && message.userId || null,
          roomId: payload.roomId || message && message.roomId || null,
          evidenceEvents,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('QvacModerationReviewCreated', item, actorId, command.occurredAt)
      }
      case 'engagement:createReplay': {
        const session = payload.session || current.gameSessions[payload.gameId]
        if (!session) throw new Error(`game not found: ${payload.gameId}`)
        const item = engagement.createSpectatorReplay({
          ...payload,
          session,
          resolution: payload.resolution || current.gameResolutions[session.gameId] || null,
          commitments: payload.commitments || Object.values(current.gameCommitments).filter(commitment => commitment.gameId === session.gameId),
          reveals: payload.reveals || Object.values(current.gameReveals).filter(reveal => reveal.gameId === session.gameId),
          evidenceEvents: payload.evidenceEvents || log.events().filter(event => eventTouchesTarget(event, 'game', session.gameId)),
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('SpectatorReplayCreated', item, actorId, command.occurredAt)
      }
      case 'engagement:createLadder': {
        const item = engagement.createDemoLadderSnapshot({
          ...payload,
          sessions: payload.sessions || Object.values(current.gameSessions),
          gameResolutions: payload.gameResolutions || Object.values(current.gameResolutions),
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('DemoLadderSnapshotCreated', item, actorId, command.occurredAt)
      }
      case 'engagement:createRematch': {
        const sourceGame = payload.sourceGame || payload.session || current.gameSessions[payload.gameId || payload.sourceGameId]
        if (!sourceGame) throw new Error(`game not found: ${payload.gameId || payload.sourceGameId}`)
        const item = engagement.createRematchProposal({
          ...payload,
          sourceGame,
          sourceResult: payload.sourceResult || current.gameResolutions[sourceGame.gameId] || null,
          requestedByUserId: payload.requestedByUserId || actorId,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('RematchProposalCreated', item, actorId, command.occurredAt)
      }
      case 'engagement:createShareCard': {
        const subject = payload.subject || shareSubjectFor(current, payload)
        const item = engagement.createShareCard({
          ...payload,
          subject,
          userId: payload.userId || actorId,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('ShareCardCreated', item, actorId, command.occurredAt)
      }
      case 'engagement:createCreatorGallery': {
        const item = engagement.createCreatorTemplateGallery({
          ...payload,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('CreatorTemplateGalleryCreated', item, actorId, command.occurredAt)
      }
      case 'engagement:createContentCalendar': {
        const item = engagement.createContentCalendar({
          ...payload,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('ContentCalendarCreated', item, actorId, command.occurredAt)
      }
      case 'notification:create': {
        const item = notification.createNotification({
          ...payload,
          userId: payload.userId || actorId,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('NotificationCreated', item, actorId, command.occurredAt)
      }
      case 'notification:generate': {
        const batch = notification.createNotificationBatch({
          events: log.events(),
          view: current,
          existingNotifications: current.notifications,
          eventRoot: log.root(),
          audienceUserIds: payload.audienceUserIds || [],
          horizonMinutes: payload.horizonMinutes,
          now: payload.now || command.occurredAt,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('NotificationBatchCreated', batch, actorId, command.occurredAt)
      }
      case 'notification:markRead':
      case 'notification:dismiss':
      case 'notification:archive': {
        const item = current.notifications[payload.notificationId]
        if (!item) throw new Error(`notification not found: ${payload.notificationId}`)
        if (item.userId !== (payload.userId || actorId)) throw new Error(`notification does not belong to user ${payload.userId || actorId}`)
        const update = notification.updateNotificationStatus(item, {
          status: notificationStatusForCommand(command.type),
          updatedAt: payload.updatedAt || command.occurredAt
        })
        return append('NotificationStatusUpdated', update, actorId, command.occurredAt)
      }
      case 'compliance:upsertProfile': {
        const profile = compliance.createComplianceProfile({
          ...payload,
          userId: payload.userId || actorId,
          updatedAt: payload.updatedAt || command.occurredAt
        })
        return append('ComplianceProfileUpserted', profile, actorId, command.occurredAt)
      }
      case 'compliance:setLimit': {
        const limit = compliance.createResponsiblePlayLimit({
          ...payload,
          userId: payload.userId || actorId,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('ResponsiblePlayLimitSet', limit, actorId, command.occurredAt)
      }
      case 'compliance:recordExposure': {
        const exposure = compliance.createPlayExposure({
          ...payload,
          userId: payload.userId || actorId,
          occurredAt: payload.occurredAt || command.occurredAt
        })
        return append('ResponsiblePlayExposureRecorded', exposure, actorId, command.occurredAt)
      }
      case 'compliance:declarePayoutRecipient': {
        const declaration = compliance.createPayoutRecipientDeclaration({
          ...payload,
          userId: payload.userId || actorId,
          declaredAt: payload.declaredAt || command.occurredAt
        })
        return append('PayoutRecipientDeclared', declaration, actorId, command.occurredAt)
      }
      case 'compliance:createReadinessPanel': {
        const userId = payload.userId || actorId
        const proposedExposure = payload.proposedExposure
          ? compliance.createPlayExposure({
              ...payload.proposedExposure,
              userId: payload.proposedExposure.userId || userId,
              occurredAt: payload.proposedExposure.occurredAt || command.occurredAt
            })
          : null
        const panel = compliance.createReadinessPanel({
          ...payload,
          userId,
          profile: payload.profile || current.complianceProfiles[userId] || null,
          payoutDeclarations: payload.payoutDeclarations || itemsByIds(
            current.payoutRecipientDeclarations,
            current.payoutRecipientDeclarationsByUser[userId]
          ),
          limits: payload.limits || itemsByIds(
            current.responsiblePlayLimits,
            current.responsiblePlayLimitsByUser[userId]
          ),
          exposures: payload.exposures || itemsByIds(
            current.responsiblePlayExposures,
            current.responsiblePlayExposuresByUser[userId]
          ),
          proposedExposure,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('ReadinessPanelCreated', panel, actorId, command.occurredAt)
      }
      case 'competition:create': {
        const item = competition.createCompetition(payload)
        return append('CompetitionCreated', item, actorId, command.occurredAt)
      }
      case 'competition:addEntrant': {
        const targetCompetition = payload.competition || current.competitions[payload.competitionId]
        if (!targetCompetition) throw new Error(`competition not found: ${payload.competitionId}`)
        requireCompetitionHost(current, targetCompetition, payload.organizerId || actorId)
        const next = competition.addEntrantToCompetition(targetCompetition, payload.entrant || payload)
        const entrant = next.entrants[next.entrants.length - 1]
        return append('CompetitionEntrantAdded', {
          competitionId: targetCompetition.competitionId,
          entrant,
          competition: next
        }, actorId, command.occurredAt)
      }
      case 'competition:scheduleFixture': {
        const targetCompetition = payload.competition || current.competitions[payload.competitionId]
        if (!targetCompetition) throw new Error(`competition not found: ${payload.competitionId}`)
        requireCompetitionHost(current, targetCompetition, payload.organizerId || actorId)
        const next = competition.scheduleFixtureForCompetition(targetCompetition, payload.fixture || payload)
        const fixture = next.fixtures[next.fixtures.length - 1]
        return append('FixtureScheduled', {
          competitionId: targetCompetition.competitionId,
          fixture,
          competition: next
        }, actorId, command.occurredAt)
      }
      case 'competition:updateStatus': {
        const targetCompetition = payload.competition || current.competitions[payload.competitionId]
        if (!targetCompetition) throw new Error(`competition not found: ${payload.competitionId}`)
        requireCompetitionHost(current, targetCompetition, payload.organizerId || actorId)
        const next = competition.updateCompetitionStatus(targetCompetition, {
          status: payload.status,
          updatedAt: payload.updatedAt || command.occurredAt
        })
        return append('CompetitionStatusUpdated', {
          competitionId: targetCompetition.competitionId,
          status: next.status,
          statusUpdatedAt: next.statusUpdatedAt,
          competition: next
        }, actorId, command.occurredAt)
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
          duel: payload.duel,
          sideQuest: payload.sideQuest,
          stake: payload.stake,
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
        const requiredTypes = payload.requiredTypes || requiredEvidenceTypesForPlan(current, plan)
        const receipt = settlement.createSettlementReceipt({
          settlementPlan: plan,
          settlementResult,
          sourceEvents,
          requiredTypes,
          eventRoot: log.root(),
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('SettlementReceiptCreated', receipt, actorId, command.occurredAt)
      }
      case 'settlement:preparePayout': {
        const receipt = payload.receipt || current.settlementReceipts[payload.receiptId]
        if (!receipt) throw new Error(`settlement receipt not found: ${payload.receiptId}`)
        if (receipt.status !== 'complete') throw new Error(`settlement receipt is not complete: ${receipt.receiptId}`)
        const record = wdk.createPoolPayout({
          poolId: payload.poolId || receipt.body.poolId || receipt.body.targetId,
          receiptId: receipt.receiptId,
          winnerUserIds: payload.winnerUserIds || receipt.body.winnerUserIds,
          amountPerWinner: payload.amountPerWinner,
          currency: payload.currency,
          mode: payload.mode || 'demo',
          ledgerEntries: payload.ledgerEntries || ledgerEntriesForWdkAction(current, {
            userIds: payload.winnerUserIds || receipt.body.winnerUserIds,
            currency: payload.currency,
            mode: payload.mode || 'demo',
            amount: payload.amountPerWinner,
            type: 'award',
            reason: 'pool payout',
            sourceType: 'pool',
            sourceId: payload.poolId || receipt.body.poolId || receipt.body.targetId
          })
        })
        return append('TetherWdkPoolPayoutPrepared', record, actorId, command.occurredAt)
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
      case 'wdk:createGameEscrow': {
        const record = wdk.createGameEscrow({
          ...payload,
          ledgerEntries: payload.ledgerEntries || ledgerEntriesForWdkAction(current, {
            userIds: payload.userIds,
            currency: payload.currency,
            mode: payload.mode,
            amount: payload.amountPerPlayer,
            type: 'debit',
            reason: 'mini-game escrow',
            sourceType: 'game',
            sourceId: payload.gameId
          })
        })
        return append('TetherWdkGameEscrowLocked', record, actorId, command.occurredAt)
      }
      case 'wdk:releaseGameEscrow': {
        const escrow = payload.escrow || current.wdkGameEscrows[payload.escrowId]
        if (!escrow) throw new Error(`game escrow not found: ${payload.escrowId}`)
        const record = wdk.releaseGameEscrow({
          ...payload,
          escrow,
          releasedAmount: payload.releasedAmount != null ? payload.releasedAmount : escrow.totalAmount,
          ledgerEntries: payload.ledgerEntries || ledgerEntriesForWdkAction(current, {
            userIds: payload.winnerUserIds,
            currency: escrow.currency,
            mode: escrow.mode,
            amount: payload.amountPerWinner || escrow.amountPerPlayer,
            type: 'award',
            reason: 'mini-game payout',
            sourceType: 'game',
            sourceId: escrow.gameId
          })
        })
        return append('TetherWdkEscrowReleased', record, actorId, command.occurredAt)
      }
      case 'wdk:refundGameEscrow': {
        const escrow = payload.escrow || current.wdkGameEscrows[payload.escrowId]
        if (!escrow) throw new Error(`game escrow not found: ${payload.escrowId}`)
        const record = wdk.refundGameEscrow({
          ...payload,
          escrow,
          refundedAmount: payload.refundedAmount != null ? payload.refundedAmount : escrow.totalAmount,
          ledgerEntries: payload.ledgerEntries || ledgerEntriesForWdkAction(current, {
            userIds: payload.userIds || escrow.userIds,
            currency: escrow.currency,
            mode: escrow.mode,
            amount: payload.amountPerUser || escrow.amountPerPlayer,
            type: 'credit',
            reason: 'mini-game refund',
            sourceType: 'game',
            sourceId: escrow.gameId
          })
        })
        return append('TetherWdkEscrowRefunded', record, actorId, command.occurredAt)
      }
      case 'wdk:createEntryIntent': {
        const record = wdk.createEntryIntent({
          ...payload,
          ledgerEntries: payload.ledgerEntries || ledgerEntriesForWdkAction(current, {
            userIds: [payload.userId],
            currency: payload.currency,
            mode: payload.mode,
            amount: payload.amount,
            type: 'debit',
            reason: 'pool entry',
            sourceType: 'pool',
            sourceId: payload.poolId
          })
        })
        return append('TetherWdkEntryIntentCreated', record, actorId, command.occurredAt)
      }
      case 'wdk:confirmEntryIntent': {
        const intent = payload.intent || current.wdkEntryIntents[payload.intentId]
        if (!intent) throw new Error(`entry intent not found: ${payload.intentId}`)
        const record = wdk.confirmEntryIntent({ ...payload, intent })
        return append('TetherWdkEntryConfirmed', record, actorId, command.occurredAt)
      }
      case 'wdk:reconcileEntryIntent': {
        const intent = payload.intent || current.wdkEntryIntents[payload.intentId]
        if (!intent) throw new Error(`entry intent not found: ${payload.intentId}`)
        const record = wdk.reconcileEntryIntent({ ...payload, intent })
        return append('TetherWdkEntryReconciled', record, actorId, command.occurredAt)
      }
      case 'wdk:refundEntryIntent': {
        const intent = payload.intent || current.wdkEntryIntents[payload.intentId]
        if (!intent) throw new Error(`entry intent not found: ${payload.intentId}`)
        const record = wdk.refundEntryIntent({
          ...payload,
          intent,
          ledgerEntries: payload.ledgerEntries || ledgerEntriesForWdkAction(current, {
            userIds: [intent.userId],
            currency: intent.currency,
            mode: intent.mode,
            amount: intent.amount,
            type: 'credit',
            reason: 'pool entry refund',
            sourceType: 'pool',
            sourceId: intent.poolId
          })
        })
        return append('TetherWdkEntryRefunded', record, actorId, command.occurredAt)
      }
      case 'wdk:createPoolPayout': {
        const receipt = payload.receiptId ? (current.settlementReceipts[payload.receiptId] || null) : null
        if (payload.receiptId && !receipt) throw new Error(`settlement receipt not found: ${payload.receiptId}`)
        const record = wdk.createPoolPayout({
          ...payload,
          receiptId: receipt ? receipt.receiptId : (payload.receiptId || null),
          winnerUserIds: payload.winnerUserIds || (receipt && receipt.body.winnerUserIds) || [],
          amountPerWinner: payload.amountPerWinner,
          currency: payload.currency,
          mode: payload.mode,
          ledgerEntries: payload.ledgerEntries || ledgerEntriesForWdkAction(current, {
            userIds: payload.winnerUserIds || (receipt && receipt.body.winnerUserIds) || [],
            currency: payload.currency,
            mode: payload.mode,
            amount: payload.amountPerWinner,
            type: 'award',
            reason: 'pool payout',
            sourceType: 'pool',
            sourceId: payload.poolId || (receipt && (receipt.body.poolId || receipt.body.targetId)) || null
          })
        })
        return append('TetherWdkPoolPayoutPrepared', record, actorId, command.occurredAt)
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
      case 'mini-game:createRun': {
        const plan = miniGameRunner.createMiniGameRunPlan({
          fitId: payload.fitId,
          gameType: payload.gameType,
          settlementMode: payload.settlementMode || 'demo',
          roomId: payload.roomId,
          competitionId: payload.competitionId,
          fixtureId: payload.fixtureId || null,
          players: payload.players,
          userIds: payload.userIds,
          createdAt: payload.createdAt || command.occurredAt
        })
        return append('MiniGameRunCreated', plan, actorId, command.occurredAt)
      }
      case 'mini-game:resolveRun': {
        const run = payload.run || current.miniGameRuns[payload.runId]
        if (!run) throw new Error(`mini-game run not found: ${payload.runId}`)
        const resolved = miniGameRunner.resolveMiniGameRun({
          plan: run,
          reveals: payload.reveals || [],
          result: payload.result || {},
          predictions: payload.predictions || [],
          entries: payload.entries || [],
          athleteStats: payload.athleteStats || {},
          marketResolutions: payload.marketResolutions || [],
          userIds: payload.userIds || [],
          evidenceEvents: payload.evidenceEvents || [],
          qvacInput: payload.qvacInput || {},
          resolvedAt: payload.resolvedAt || command.occurredAt
        })
        return append('MiniGameRunResolved', resolved, actorId, command.occurredAt)
      }
      case 'mini-game:attest': {
        const resolution = payload.resolution || current.miniGameRunResolutions[payload.runId]
        if (!resolution) throw new Error(`mini-game run resolution not found: ${payload.runId}`)
        const packet = resolution.refereePacket || null
        return append('MiniGameAttestationCreated', {
          runId: resolution.runId,
          fitId: resolution.fitId,
          gameType: resolution.gameType,
          refereePacket: packet,
          createdAt: payload.createdAt || command.occurredAt
        }, actorId, command.occurredAt)
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
    qvacRecords: {},
    qvacRecordsByTarget: {},
    qvacRoomSummaries: {},
    qvacRoomSummariesByRoom: {},
    qvacCommentaryFrames: {},
    qvacCommentaryByRoom: {},
    qvacCreatorDrafts: {},
    creatorCompetitionDrafts: {},
    creatorPublishPlans: {},
    qvacTriviaBanks: {},
    qvacResultEvidenceReviews: {},
    qvacResultEvidenceReviewsByTarget: {},
    qvacModerationReviews: {},
    qvacModerationReviewsByMessage: {},
    spectatorReplays: {},
    spectatorReplaysByGame: {},
    demoLadders: {},
    rematchProposals: {},
    rematchProposalsByGame: {},
    shareCards: {},
    shareCardsByTarget: {},
    creatorTemplateGalleries: {},
    contentCalendars: {},
    notifications: {},
    notificationBatches: {},
    notificationsByUser: {},
    notificationInboxSummaries: {},
    complianceProfiles: {},
    responsiblePlayLimits: {},
    responsiblePlayLimitsByUser: {},
    responsiblePlayExposures: {},
    responsiblePlayExposuresByUser: {},
    payoutRecipientDeclarations: {},
    payoutRecipientDeclarationsByUser: {},
    readinessPanels: {},
    readinessPanelsByTarget: {},
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
    wdkGameEscrows: {},
    wdkEscrowReleases: {},
    wdkEscrowRefunds: {},
    wdkEntryIntents: {},
    wdkEntryConfirmations: {},
    wdkEntryReconciliations: {},
    wdkEntryRefunds: {},
    wdkPoolPayouts: {},
    miniGameRuns: {},
    miniGameRunResolutions: {},
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
      case 'QvacRoomSummaryCreated':
        indexQvacRecord(view, payload)
        view.qvacRoomSummaries[payload.qvacRecordId] = payload
        appendIndexedId(view.qvacRoomSummariesByRoom, payload.targetId, payload.qvacRecordId)
        break
      case 'QvacCommentaryCreated':
        indexQvacRecord(view, payload)
        view.qvacCommentaryFrames[payload.qvacRecordId] = payload
        appendIndexedId(view.qvacCommentaryByRoom, payload.body && payload.body.roomId || payload.targetId, payload.qvacRecordId)
        break
      case 'QvacCreatorDraftCreated':
        indexQvacRecord(view, payload)
        view.qvacCreatorDrafts[payload.qvacRecordId] = payload
        break
      case 'CreatorCompetitionDraftCreated':
        view.creatorCompetitionDrafts[payload.draftId] = payload
        break
      case 'CreatorCompetitionDraftEntrantAdded':
      case 'CreatorCompetitionDraftSeeded':
        view.creatorCompetitionDrafts[payload.draftId] = payload.draft
        break
      case 'CreatorCompetitionPublishPlanCreated':
        view.creatorPublishPlans[payload.creatorPublishPlanId] = payload
        break
      case 'QvacTriviaBankCreated':
        indexQvacRecord(view, payload)
        view.qvacTriviaBanks[payload.qvacRecordId] = payload
        break
      case 'QvacResultEvidenceReviewCreated':
        indexQvacRecord(view, payload)
        view.qvacResultEvidenceReviews[payload.qvacRecordId] = payload
        appendIndexedId(view.qvacResultEvidenceReviewsByTarget, targetKey(payload.targetType, payload.targetId), payload.qvacRecordId)
        break
      case 'QvacModerationReviewCreated':
        indexQvacRecord(view, payload)
        view.qvacModerationReviews[payload.qvacRecordId] = payload
        appendIndexedId(view.qvacModerationReviewsByMessage, payload.targetId, payload.qvacRecordId)
        break
      case 'SpectatorReplayCreated':
        view.spectatorReplays[payload.replayId] = payload
        appendIndexedId(view.spectatorReplaysByGame, payload.gameId, payload.replayId)
        break
      case 'DemoLadderSnapshotCreated':
        view.demoLadders[payload.ladderId] = payload
        break
      case 'RematchProposalCreated':
        view.rematchProposals[payload.rematchId] = payload
        appendIndexedId(view.rematchProposalsByGame, payload.sourceGameId, payload.rematchId)
        break
      case 'ShareCardCreated':
        view.shareCards[payload.shareCardId] = payload
        appendIndexedId(view.shareCardsByTarget, targetKey(payload.targetType, payload.targetId), payload.shareCardId)
        break
      case 'CreatorTemplateGalleryCreated':
        view.creatorTemplateGalleries[payload.galleryId] = payload
        break
      case 'ContentCalendarCreated':
        view.contentCalendars[payload.calendarId] = payload
        break
      case 'NotificationCreated':
        view.notifications[payload.notificationId] = payload
        break
      case 'NotificationBatchCreated':
        view.notificationBatches[payload.notificationBatchId] = payload
        ;(payload.notifications || []).forEach(item => {
          view.notifications[item.notificationId] = item
        })
        break
      case 'NotificationStatusUpdated':
        if (view.notifications[payload.notificationId]) {
          view.notifications[payload.notificationId] = notification.applyNotificationStatusUpdate(view.notifications[payload.notificationId], payload)
        }
        break
      case 'ComplianceProfileUpserted':
        view.complianceProfiles[payload.userId] = payload
        break
      case 'ResponsiblePlayLimitSet':
        view.responsiblePlayLimits[payload.limitId] = payload
        appendIndexedId(view.responsiblePlayLimitsByUser, payload.userId, payload.limitId)
        break
      case 'ResponsiblePlayExposureRecorded':
        view.responsiblePlayExposures[payload.exposureId] = payload
        appendIndexedId(view.responsiblePlayExposuresByUser, payload.userId, payload.exposureId)
        break
      case 'PayoutRecipientDeclared':
        view.payoutRecipientDeclarations[payload.declarationId] = payload
        appendIndexedId(view.payoutRecipientDeclarationsByUser, payload.userId, payload.declarationId)
        break
      case 'ReadinessPanelCreated':
        view.readinessPanels[payload.readinessPanelId] = payload
        appendIndexedId(
          view.readinessPanelsByTarget,
          targetKey(payload.targetType || 'user', payload.targetId || payload.userId),
          payload.readinessPanelId
        )
        break
      case 'CompetitionCreated':
        view.competitions[payload.competitionId] = payload
        break
      case 'CompetitionEntrantAdded':
      case 'FixtureScheduled':
      case 'CompetitionStatusUpdated':
        view.competitions[payload.competitionId] = payload.competition
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
      case 'TetherWdkGameEscrowLocked':
        view.wdkGameEscrows[payload.escrowId] = payload
        ;(payload.ledgerEntries || []).forEach(entry => {
          view.walletLedgerEntries[entry.entryId] = entry
        })
        break
      case 'TetherWdkEscrowReleased':
        view.wdkEscrowReleases[payload.releaseId] = payload
        ;(payload.ledgerEntries || []).forEach(entry => {
          view.walletLedgerEntries[entry.entryId] = entry
        })
        break
      case 'TetherWdkEscrowRefunded':
        view.wdkEscrowRefunds[payload.refundId] = payload
        ;(payload.ledgerEntries || []).forEach(entry => {
          view.walletLedgerEntries[entry.entryId] = entry
        })
        break
      case 'TetherWdkEntryIntentCreated':
        view.wdkEntryIntents[payload.intentId] = payload
        ;(payload.ledgerEntries || []).forEach(entry => {
          view.walletLedgerEntries[entry.entryId] = entry
        })
        break
      case 'TetherWdkEntryConfirmed':
        view.wdkEntryConfirmations[payload.confirmationId] = payload
        break
      case 'TetherWdkEntryReconciled':
        view.wdkEntryReconciliations[payload.reconciliationId] = payload
        break
      case 'TetherWdkEntryRefunded':
        view.wdkEntryRefunds[payload.refundId] = payload
        ;(payload.ledgerEntries || []).forEach(entry => {
          view.walletLedgerEntries[entry.entryId] = entry
        })
        break
      case 'TetherWdkPoolPayoutPrepared':
        view.wdkPoolPayouts[payload.payoutId] = payload
        ;(payload.ledgerEntries || []).forEach(entry => {
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
      case 'MiniGameRunCreated':
        view.miniGameRuns[payload.runId] = payload
        break
      case 'MiniGameRunResolved':
        view.miniGameRunResolutions[payload.runId] = payload
        if (payload.refereePacket && payload.refereePacket.attestation) {
          view.attestations[payload.refereePacket.attestation.attestationId] = payload.refereePacket.attestation
          appendIndexedId(view.attestationsByTarget, targetKey(payload.refereePacket.attestation.targetType, payload.refereePacket.attestation.targetId), payload.refereePacket.attestation.attestationId)
        }
        break
      case 'MiniGameAttestationCreated':
        if (payload.refereePacket && payload.refereePacket.attestation) {
          view.attestations[payload.refereePacket.attestation.attestationId] = payload.refereePacket.attestation
          appendIndexedId(view.attestationsByTarget, targetKey(payload.refereePacket.attestation.targetType, payload.refereePacket.attestation.targetId), payload.refereePacket.attestation.attestationId)
          if (payload.refereePacket.questionBank) {
            view.qvacRecords[payload.refereePacket.questionBank.qvacRecordId] = payload.refereePacket.questionBank
            view.qvacTriviaBanks[payload.refereePacket.questionBank.qvacRecordId] = payload.refereePacket.questionBank
          }
        }
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
  view.notificationsByUser = notification.indexNotificationsByUser(view.notifications)
  Object.keys(view.notificationsByUser).forEach(userId => {
    view.notificationInboxSummaries[userId] = notification.summarizeNotificationInbox(view.notifications, userId)
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

function requireCompetitionHost (view, competition, userId) {
  if (!competition || typeof competition !== 'object') throw new TypeError('competition is required')
  if (!userId) throw new Error('userId is required')
  if (competition.organizerId && competition.organizerId === userId) return true
  const hostedRoom = Object.values(view.rooms || {})
    .find(room => room.competitionId === competition.competitionId && room.hostUserId === userId)
  if (hostedRoom) return true
  if (!competition.organizerId && userId === 'host') return true
  throw new Error(`user ${userId} is not a competition host for ${competition.competitionId}`)
}

function requireCreatorDraftOrganizer (draft, userId) {
  if (!draft || typeof draft !== 'object') throw new TypeError('creator draft is required')
  if (!userId) throw new Error('userId is required')
  if (draft.organizerId === userId) return true
  throw new Error(`user ${userId} is not the organizer for creator draft ${draft.draftId}`)
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

function notificationStatusForCommand (commandType) {
  if (commandType === 'notification:markRead') return 'read'
  if (commandType === 'notification:dismiss') return 'dismissed'
  return 'archived'
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

function accountForUser (view, userId, currency = 'CREDITS', mode = 'demo-credit') {
  const account = Object.values(view.walletAccounts).find(a =>
    a.userId === userId && a.currency === currency && a.status === 'active'
  )
  if (account) return account
  const fallback = Object.values(view.walletAccounts).find(a =>
    a.userId === userId && a.status === 'active'
  )
  if (fallback) return fallback
  throw new Error(`wallet account not found for user: ${userId}`)
}

function ledgerEntriesForWdkAction (view, { userIds, currency, mode, amount, type, reason, sourceType, sourceId } = {}) {
  if (!Array.isArray(userIds) || userIds.length === 0) return []
  const entries = []
  for (const userId of userIds) {
    const account = accountForUser(view, userId, currency || 'CREDITS', mode || 'demo-credit')
    entries.push(wallet.createLedgerEntry({
      accountId: account.accountId,
      userId,
      type,
      amount,
      currency: currency || account.currency || 'CREDITS',
      reason: reason || 'WDK action',
      sourceType: sourceType || null,
      sourceId: sourceId || null
    }))
  }
  return entries
}

function feedFramesForAdapter (view, adapterId, frameIds = null) {
  const selectedFrameIds = Array.isArray(frameIds) ? new Set(frameIds) : null
  return Object.values(view.feedFrames || {})
    .filter(frame => frame.adapterId === adapterId && (!selectedFrameIds || selectedFrameIds.has(frame.frameId)))
}

function requiredEvidenceTypesForPlan (view, plan = {}) {
  if (plan.mode !== 'real-money' && plan.mode !== 'sponsor-prize') return []
  if (plan.targetType !== 'pool') return []
  const pool = view.pools[plan.poolId || plan.targetId]
  const competition = pool && view.competitions[pool.competitionId]
  const resultSource = competition && (competition.resultPolicy || (competition.metadata && competition.metadata.resultSource))
  if (resultSource && resultSource !== 'official-feed') {
    return ['QvacResultEvidenceReviewCreated']
  }
  return []
}

function feedFramesForCompetition (view, competitionId, fixtureId = null) {
  return Object.values(view.feedFrames || {})
    .filter(frame => frame.competitionId === competitionId && (!fixtureId || frame.fixtureId === fixtureId))
}

function resultSnapshotsForCompetition (view, competitionId) {
  return Object.values(view.resultSnapshots || {})
    .filter(snapshot => snapshot.competitionId === competitionId)
}

function marketResolutionsForRoom (view, roomId) {
  return Object.values(view.marketResolutions || {})
    .filter(resolution => resolution.market && resolution.market.roomId === roomId)
    .concat(Object.values(view.streakResolutions || {}).filter(resolution => resolution.roomId === roomId))
}

function gameResolutionsForRoom (view, roomId) {
  return Object.values(view.gameResolutions || {})
    .filter(result => {
      const session = view.gameSessions && view.gameSessions[result.gameId]
      return session && session.roomId === roomId
    })
}

function roomChallengesForRoom (view, roomId) {
  return Object.values(view.roomChallenges || {}).filter(challenge => challenge.roomId === roomId)
}

function roomMessagesForRoom (view, roomId) {
  return Object.values(view.roomMessages || {}).filter(message => message.roomId === roomId)
}

function eventsForRoom (events = [], roomId) {
  return events.filter(event => {
    const payload = event.payload || {}
    return payload.roomId === roomId || payload.body && payload.body.roomId === roomId || payload.room && payload.room.roomId === roomId
  })
}

function qvacEvidenceEvents ({ log, payload = {}, fallbackEvents = [] }) {
  const evidenceEventIds = payload.evidenceEventIds || payload.sourceEventIds || []
  if (payload.evidenceEvents) return payload.evidenceEvents
  if (evidenceEventIds.length) return log.events().filter(event => evidenceEventIds.includes(event.eventId))
  return fallbackEvents
}

function shareSubjectFor (view, payload = {}) {
  const targetType = payload.targetType || payload.subjectType
  const targetId = payload.targetId || payload.subjectId
  if (targetType === 'pool') return view.poolSettlements[targetId] || view.pools[targetId]
  if (targetType === 'game') return view.gameResolutions[targetId] || view.gameSessions[targetId]
  if (targetType === 'market') return view.marketResolutions[targetId] || view.streakResolutions[targetId] || view.markets[targetId]
  if (targetType === 'receipt') return view.settlementReceipts[targetId]
  if (targetType === 'replay') return view.spectatorReplays[targetId]
  if (targetType === 'ladder') return view.demoLadders[targetId]
  if (targetType === 'room') return view.rooms[targetId]
  return payload.subject || {}
}

function targetKey (targetType, targetId) {
  return `${targetType}:${targetId}`
}

function indexQvacRecord (view, payload) {
  view.qvacRecords[payload.qvacRecordId] = payload
  appendIndexedId(view.qvacRecordsByTarget, targetKey(payload.targetType, payload.targetId), payload.qvacRecordId)
}

function appendIndexedId (index, key, id) {
  if (!key || !id) return
  if (!index[key]) index[key] = []
  index[key] = index[key].filter(existing => existing !== id)
  index[key].push(id)
}

function itemsByIds (collection = {}, ids = []) {
  return (ids || []).map(id => collection[id]).filter(Boolean)
}

function disputeTargetExists (view, targetType, targetId) {
  if (!targetType || !targetId) return false
  if (targetType === 'spectator-replay') return Boolean(view.spectatorReplays[targetId])
  if (targetType === 'demo-ladder') return Boolean(view.demoLadders[targetId])
  if (targetType === 'rematch') return Boolean(view.rematchProposals[targetId])
  if (targetType === 'share-card') return Boolean(view.shareCards[targetId])
  if (targetType === 'creator-template-gallery') return Boolean(view.creatorTemplateGalleries[targetId])
  if (targetType === 'content-calendar') return Boolean(view.contentCalendars[targetId])
  if (targetType === 'qvac-record') return Boolean(view.qvacRecords[targetId])
  if (targetType === 'qvac-room-summary') return Boolean(view.qvacRoomSummaries[targetId])
  if (targetType === 'qvac-commentary') return Boolean(view.qvacCommentaryFrames[targetId])
  if (targetType === 'qvac-creator-draft') return Boolean(view.qvacCreatorDrafts[targetId])
  if (targetType === 'qvac-trivia-bank') return Boolean(view.qvacTriviaBanks[targetId])
  if (targetType === 'qvac-result-evidence') return Boolean(view.qvacResultEvidenceReviews[targetId])
  if (targetType === 'qvac-moderation-review') return Boolean(view.qvacModerationReviews[targetId])
  if (targetType === 'compliance-profile') {
    return Boolean(view.complianceProfiles[targetId] || Object.values(view.complianceProfiles).some(item => item.complianceProfileId === targetId))
  }
  if (targetType === 'responsible-limit') return Boolean(view.responsiblePlayLimits[targetId])
  if (targetType === 'play-exposure') return Boolean(view.responsiblePlayExposures[targetId])
  if (targetType === 'payout-recipient') return Boolean(view.payoutRecipientDeclarations[targetId])
  if (targetType === 'readiness-panel') return Boolean(view.readinessPanels[targetId])
  if (targetType === 'receipt') return Boolean(view.settlementReceipts[targetId])
  if (targetType === 'wallet-account') return Boolean(view.walletAccounts[targetId])
  if (targetType === 'wallet-entry') return Boolean(view.walletLedgerEntries[targetId])
  if (targetType === 'payout-route') return Boolean(view.payoutRoutes[targetId])
  if (targetType === 'feed-adapter') return Boolean(view.feedAdapters[targetId])
  if (targetType === 'feed-frame') return Boolean(view.feedFrames[targetId])
  if (targetType === 'notification') return Boolean(view.notifications[targetId])
  if (targetType === 'result-snapshot') return Boolean(view.resultSnapshots[targetId])
  if (targetType === 'pool') return Boolean(view.pools[targetId] || view.poolSettlements[targetId])
  if (targetType === 'game') return Boolean(view.gameSessions[targetId] || view.gameResolutions[targetId])
  if (targetType === 'card') return Boolean(view.cards[targetId] || view.cardResolutions[targetId])
  if (targetType === 'draft') return Boolean(view.draftSlates[targetId] || view.draftResolutions[targetId])
  if (targetType === 'market') return Boolean(view.markets[targetId] || view.marketResolutions[targetId] || view.streakResolutions[targetId])
  if (targetType === 'room') return Boolean(view.rooms[targetId])
  if (targetType === 'room-message') return Boolean(view.roomMessages[targetId])
  return false
}

function eventsForAuditTarget (events = [], targetType, targetId) {
  return events.filter(event => eventTouchesTarget(event, targetType, targetId))
}

function eventTouchesTarget (event = {}, targetType, targetId) {
  const payload = event.payload || {}
  if (targetType === 'spectator-replay') return payload.replayId === targetId
  if (targetType === 'demo-ladder') return payload.ladderId === targetId
  if (targetType === 'rematch') return payload.rematchId === targetId
  if (targetType === 'share-card') return payload.shareCardId === targetId
  if (targetType === 'creator-template-gallery') return payload.galleryId === targetId
  if (targetType === 'content-calendar') return payload.calendarId === targetId
  if (targetType === 'qvac-record') return payload.qvacRecordId === targetId
  if (targetType === 'qvac-room-summary') return payload.qvacRecordId === targetId && payload.lane === 'room-summary'
  if (targetType === 'qvac-commentary') return payload.qvacRecordId === targetId && payload.lane === 'commentary'
  if (targetType === 'qvac-creator-draft') return payload.qvacRecordId === targetId && payload.lane === 'creator-assistant'
  if (targetType === 'qvac-trivia-bank') return payload.qvacRecordId === targetId && payload.lane === 'trivia-bank'
  if (targetType === 'qvac-result-evidence') return payload.qvacRecordId === targetId && payload.lane === 'result-evidence'
  if (targetType === 'qvac-moderation-review') return payload.qvacRecordId === targetId && payload.lane === 'moderation-helper'
  if (targetType === 'compliance-profile') return payload.userId === targetId || payload.complianceProfileId === targetId
  if (targetType === 'responsible-limit') return payload.limitId === targetId
  if (targetType === 'play-exposure') return payload.exposureId === targetId
  if (targetType === 'payout-recipient') return payload.declarationId === targetId
  if (targetType === 'readiness-panel') return payload.readinessPanelId === targetId
  if (targetType === 'receipt') return payload.receiptId === targetId || payload.body && payload.body.receiptId === targetId
  if (targetType === 'wallet-account') return payload.accountId === targetId
  if (targetType === 'wallet-entry') return payload.entryId === targetId || Array.isArray(payload.entries) && payload.entries.some(entry => entry.entryId === targetId)
  if (targetType === 'payout-route') return payload.routeId === targetId
  if (targetType === 'feed-adapter') return payload.adapterId === targetId
  if (targetType === 'feed-frame') return payload.frameId === targetId || Array.isArray(payload.sourceFeedEventIds) && payload.sourceFeedEventIds.includes(targetId)
  if (targetType === 'notification') return payload.notificationId === targetId || Array.isArray(payload.notifications) && payload.notifications.some(item => item.notificationId === targetId)
  if (targetType === 'result-snapshot') return payload.snapshotId === targetId || payload.resultSnapshotId === targetId
  if (targetType === 'pool') return payload.poolId === targetId || payload.body && payload.body.poolId === targetId
  if (targetType === 'game') return payload.gameId === targetId
  if (targetType === 'card') return payload.cardId === targetId
  if (targetType === 'draft') return payload.slateId === targetId
  if (targetType === 'market') return payload.marketId === targetId || payload.market && payload.market.marketId === targetId || payload.streakId === targetId
  if (targetType === 'room') return payload.roomId === targetId || payload.body && payload.body.roomId === targetId
  if (targetType === 'room-message') return payload.messageId === targetId
  return false
}

module.exports = {
  createPlatformRuntime,
  derivePlatformView,
  gameInputKey,
  feedFramesForAdapter,
  feedFramesForCompetition,
  resultSnapshotsForCompetition,
  marketResolutionsForRoom,
  gameResolutionsForRoom,
  roomChallengesForRoom,
  roomMessagesForRoom,
  eventsForRoom,
  shareSubjectFor,
  notificationStatusForCommand,
  requireRoomParticipant,
  requireRoomModerator,
  requireCompetitionHost,
  requireCreatorDraftOrganizer,
  settlementResultForPlan,
  assertRoomAccess,
  inviteByCode,
  isUserBanned,
  isUserMuted,
  targetKey,
  indexQvacRecord,
  appendIndexedId,
  itemsByIds,
  disputeTargetExists,
  eventsForAuditTarget,
  eventTouchesTarget
}
