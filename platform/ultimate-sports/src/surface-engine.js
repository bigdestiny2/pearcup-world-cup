'use strict'

const catalog = require('./catalog-engine')
const creator = require('./creator-engine')
const ops = require('./ops-engine')
const pick = require('./pick-engine')
const watch = require('./watch-engine')
const walletOps = require('./wallet-ops-engine')
const { cloneJson } = require('./util')

const SURFACE_IDS = Object.freeze([
  'home',
  'discover',
  'pools',
  'picks',
  'watch',
  'games',
  'creator',
  'wallet',
  'ops',
  'settings'
])

const SURFACE_TITLES = Object.freeze({
  home: 'Home',
  discover: 'Discover',
  pools: 'Pools',
  picks: 'Picks',
  watch: 'Watch',
  games: 'Games',
  creator: 'Creator',
  wallet: 'Wallet',
  ops: 'Ops',
  settings: 'Settings'
})

function createExperience (input = {}) {
  const userId = input.userId || 'local-peer'
  const now = input.now || new Date().toISOString()
  const surfaceInput = {
    ...input,
    userId,
    now
  }
  const surfaces = Object.fromEntries(SURFACE_IDS.map(surfaceId => [
    surfaceId,
    createSurface(surfaceId, surfaceInput)
  ]))

  return {
    experienceVersion: 'ultimate-sports-surfaces-v1',
    userId,
    generatedAt: now,
    navigation: createNavigation(surfaces),
    surfaces
  }
}

function createSurface (surfaceId, input = {}) {
  if (!SURFACE_IDS.includes(surfaceId)) {
    throw new RangeError(`surfaceId must be one of: ${SURFACE_IDS.join(', ')}`)
  }
  const view = input.view || {}
  const userId = input.userId || 'local-peer'

  if (surfaceId === 'home') return homeSurface({ view, userId })
  if (surfaceId === 'discover') return discoverSurface(input)
  if (surfaceId === 'pools') return poolsSurface({ view, userId })
  if (surfaceId === 'picks') return picksSurface({ view, userId })
  if (surfaceId === 'watch') return watchSurface({ view, userId })
  if (surfaceId === 'games') return gamesSurface({ view, userId })
  if (surfaceId === 'creator') return creatorSurface({ view, userId })
  if (surfaceId === 'wallet') return walletSurface({ view, userId })
  if (surfaceId === 'ops') return opsSurface(input)
  return settingsSurface({ view, userId })
}

function createNavigation (surfaces = {}) {
  return SURFACE_IDS.map(surfaceId => ({
    surfaceId,
    title: SURFACE_TITLES[surfaceId],
    badgeCount: badgeCountFor(surfaceId, surfaces[surfaceId] || {}),
    primaryCount: primaryCountFor(surfaceId, surfaces[surfaceId] || {})
  }))
}

function homeSurface ({ view, userId }) {
  const watch = watchSurface({ view, userId })
  const pools = poolsSurface({ view, userId })
  const games = gamesSurface({ view, userId })
  const wallet = walletSurface({ view, userId })
  const notifications = userNotifications(view, userId)
  const unreadNotifications = notifications.filter(item => item.status === 'unread')

  return baseSurface('home', {
    counts: {
      liveRooms: watch.liveRooms.length,
      openPools: pools.openPools.length,
      activeGames: games.activeGames.length,
      replayCount: games.spectatorReplays.length,
      shareCardCount: games.shareCards.length,
      unreadNotifications: unreadNotifications.length,
      readyWalletAccounts: wallet.accounts.filter(account => account.status === 'active').length,
      incompleteReadinessPanels: wallet.readinessPanels.filter(panel => panel.ready !== true).length
    },
    liveNow: watch.liveRooms.slice(0, 4),
    upcomingRooms: watch.upcomingRooms.slice(0, 4),
    yourPools: pools.yourPools.slice(0, 4),
    activeDuels: games.activeDuels.slice(0, 4),
    notifications: unreadNotifications.slice(0, 6).map(notificationSummary)
  })
}

function discoverSurface (input = {}) {
  const built = catalog.buildCatalog(input.catalogQuery || {})
  const view = input.view || {}
  const eventFits = built.eventFits.map(fit => ({
    fitId: fit.fitId,
    title: fit.title,
    category: fit.category,
    templateKinds: fit.templateKinds.slice(),
    recommendedVariantCount: fit.recommendedVariants.length,
    recommendedMiniGameCount: fit.recommendedMiniGames.length,
    defaultSettlementModes: fit.defaultSettlementModes.slice()
  }))

  return baseSurface('discover', {
    eventFits,
    poolVariants: built.poolVariants.map(item => ({
      variantId: item.variantId,
      title: item.title,
      settlementModes: item.settlementModes.slice()
    })),
    miniGames: built.miniGames.map(item => ({
      gameType: item.gameType,
      title: item.title,
      settlementModes: item.settlementModes.slice(),
      commandType: item.commandType
    })),
    launchCards: eventFits.map(fit => ({
      fitId: fit.fitId,
      title: fit.title,
      category: fit.category,
      primaryTemplateKind: fit.templateKinds[0],
      recommendedVariantCount: fit.recommendedVariantCount,
      recommendedMiniGameCount: fit.recommendedMiniGameCount
    })),
    templateGalleries: values(view.creatorTemplateGalleries)
      .sort(compareNewest)
      .map(gallery => ({
        galleryId: gallery.galleryId,
        title: gallery.title,
        templateCount: (gallery.templates || []).length,
        featuredTemplateIds: cloneJson(gallery.featuredTemplateIds || []),
        createdAt: gallery.createdAt || null
      })),
    contentCalendars: values(view.contentCalendars)
      .sort(compareNewest)
      .map(calendar => ({
        calendarId: calendar.calendarId,
        title: calendar.title,
        startDate: calendar.startDate,
        weeks: calendar.weeks,
        itemCount: (calendar.items || []).length,
        nextItems: cloneJson((calendar.items || []).slice(0, 6)),
        createdAt: calendar.createdAt || null
      }))
  })
}

function poolsSurface ({ view, userId }) {
  const entries = values(view.predictionEntries)
  const pools = values(view.pools).map(pool => {
    const poolEntries = entries.filter(entry => entry.poolId === pool.poolId)
    const userEntries = poolEntries.filter(entry => entry.userId === userId)
    const settlement = view.poolSettlements && view.poolSettlements[pool.poolId]
    return {
      poolId: pool.poolId,
      competitionId: pool.competitionId,
      title: pool.title,
      variant: pool.rules && pool.rules.variant,
      mode: pool.mode,
      status: pool.status,
      entryCount: poolEntries.length,
      lockedEntryCount: poolEntries.filter(entry => entry.status === 'locked').length,
      userEntryIds: userEntries.map(entry => entry.entryId),
      userEntryStatus: userEntries.length ? userEntries[userEntries.length - 1].status : null,
      settled: Boolean(settlement),
      winnerUserIds: settlement ? cloneJson(settlement.winnerUserIds || []) : []
    }
  })

  return baseSurface('pools', {
    pools,
    openPools: pools.filter(pool => pool.status === 'open'),
    yourPools: pools.filter(pool => pool.userEntryIds.length > 0),
    settledPools: pools.filter(pool => pool.settled),
    receipts: values(view.settlementReceipts).map(receiptSummary)
  })
}

function picksSurface ({ view, userId }) {
  return baseSurface('picks', {
    workbench: pick.createPickWorkbench({ view, userId }),
    predictionEntries: values(view.predictionEntries)
      .filter(entry => entry.userId === userId)
      .map(entry => ({
        entryId: entry.entryId,
        poolId: entry.poolId,
        entryType: entry.entryType,
        status: entry.status,
        submittedAt: entry.submittedAt || null,
        lockedAt: entry.lockedAt || null
      })),
    cardSubmissions: values(view.cardSubmissions)
      .filter(submission => submission.userId === userId)
      .map(submission => ({
        submissionId: submission.submissionId,
        cardId: submission.cardId,
        status: submission.status || 'submitted',
        submittedAt: submission.submittedAt || null
      })),
    draftEntries: values(view.draftEntries)
      .filter(entry => entry.userId === userId)
      .map(entry => ({
        entryId: entry.entryId,
        slateId: entry.slateId,
        athleteIds: cloneJson(entry.athleteIds || []),
        submittedAt: entry.submittedAt || null
      })),
    openCards: values(view.cards).map(card => ({
      cardId: card.cardId,
      competitionId: card.competitionId,
      title: card.title,
      cardType: card.cardType,
      fieldCount: (card.fields || []).length
    })),
    openDrafts: values(view.draftSlates).map(slate => ({
      slateId: slate.slateId,
      competitionId: slate.competitionId,
      title: slate.title,
      rosterSize: slate.rosterSize,
      athleteCount: (slate.athletes || []).length
    }))
  })
}

function watchSurface ({ view, userId }) {
  const rooms = values(view.rooms).map(room => roomSummary(view, room, userId))
  return baseSurface('watch', {
    workbench: watch.createWatchPartyWorkbench({ view, userId }),
    rooms,
    liveRooms: rooms.filter(room => room.status === 'live' || room.status === 'active'),
    upcomingRooms: rooms.filter(room => room.status === 'scheduled'),
    joinedRooms: rooms.filter(room => room.currentUserJoined),
    qvacSummaries: values(view.qvacRoomSummaries)
      .sort(compareNewest)
      .map(record => ({
        qvacRecordId: record.qvacRecordId,
        roomId: record.targetId,
        status: record.status,
        title: record.title,
        text: record.text,
        evidenceEventIds: cloneJson(record.evidenceEventIds || []),
        createdAt: record.createdAt || null
      })),
    qvacCommentary: values(view.qvacCommentaryFrames)
      .sort(compareNewest)
      .map(record => ({
        qvacRecordId: record.qvacRecordId,
        roomId: record.body && record.body.roomId || null,
        targetType: record.targetType,
        targetId: record.targetId,
        text: record.text,
        sourceFeedEventIds: cloneJson(record.body && record.body.sourceFeedEventIds || []),
        createdAt: record.createdAt || null
      })),
    qvacResultEvidence: values(view.qvacResultEvidenceReviews)
      .sort(compareNewest)
      .map(record => ({
        qvacRecordId: record.qvacRecordId,
        status: record.status,
        targetType: record.targetType,
        targetId: record.targetId,
        consensusWinner: record.body && record.body.consensusWinner || null,
        blockers: cloneJson(record.body && record.body.blockers || []),
        sourceSummary: cloneJson(record.body && record.body.sourceSummary || {}),
        webSearchQuery: record.body && record.body.webSearchQuery || null,
        createdAt: record.createdAt || null
      })),
    recentMessages: values(view.roomMessages)
      .filter(message => message.moderationState !== 'hidden')
      .sort(compareNewest)
      .slice(0, 12)
      .map(message => ({
        messageId: message.messageId,
        roomId: message.roomId,
        userId: message.userId,
        body: message.body,
        createdAt: message.createdAt || null
      }))
  })
}

function gamesSurface ({ view, userId }) {
  const challenges = values(view.roomChallenges)
    .filter(challenge => challenge.challengerUserId === userId || challenge.targetUserId === userId)
    .map(challenge => ({
      challengeId: challenge.challengeId,
      roomId: challenge.roomId,
      challengeType: challenge.challengeType,
      gameType: challenge.gameType || null,
      marketType: challenge.marketType || null,
      stake: cloneJson(challenge.stake || null),
      status: challenge.status,
      opponentUserId: challenge.challengerUserId === userId ? challenge.targetUserId : challenge.challengerUserId,
      createdAt: challenge.createdAt || null
    }))
  const gameSessions = values(view.gameSessions)
    .filter(game => (game.players || []).includes(userId) || (game.spectators || []).includes(userId))
    .map(game => ({
      gameId: game.gameId,
      gameType: game.gameType,
      roomId: game.roomId,
      stakeMode: game.stakeMode,
      status: game.status,
      players: cloneJson(game.players || []),
      currentUserRole: (game.players || []).includes(userId) ? 'player' : 'spectator'
    }))

  return baseSurface('games', {
    activeDuels: challenges.filter(challenge => challenge.status === 'pending' || challenge.status === 'accepted'),
    challenges,
    gameSessions,
    activeGames: gameSessions.filter(game => game.status === 'invited' || game.status === 'active'),
    spectatorReplays: values(view.spectatorReplays)
      .filter(replay => {
        const session = view.gameSessions && view.gameSessions[replay.gameId]
        return (replay.players || []).includes(userId) || (replay.spectators || []).includes(userId) || session && (session.players || []).includes(userId)
      })
      .sort(compareNewest)
      .map(replay => ({
        replayId: replay.replayId,
        gameId: replay.gameId,
        gameType: replay.gameType,
        status: replay.status,
        winnerUserIds: cloneJson(replay.winnerUserIds || []),
        stepCount: (replay.steps || []).length,
        createdAt: replay.createdAt || null
      })),
    ladders: values(view.demoLadders)
      .sort(compareNewest)
      .map(ladder => ({
        ladderId: ladder.ladderId,
        scope: ladder.scope,
        gameType: ladder.gameType,
        resultCount: ladder.resultCount,
        topRows: cloneJson((ladder.leaderboard || []).slice(0, 10)),
        currentUserRank: currentUserRank(ladder, userId),
        createdAt: ladder.createdAt || null
      })),
    rematches: values(view.rematchProposals)
      .filter(rematch => rematch.requestedByUserId === userId || (rematch.targetUserIds || []).includes(userId) || (rematch.players || []).includes(userId))
      .sort(compareNewest)
      .map(rematch => ({
        rematchId: rematch.rematchId,
        sourceGameId: rematch.sourceGameId,
        roomId: rematch.roomId,
        gameType: rematch.gameType,
        status: rematch.status,
        requestedByUserId: rematch.requestedByUserId,
        targetUserIds: cloneJson(rematch.targetUserIds || []),
        commandDraft: cloneJson(rematch.commandDraft || null),
        createdAt: rematch.createdAt || null
      })),
    shareCards: values(view.shareCards)
      .filter(card => card.userId === userId || (card.metrics && card.metrics.winnerUserIds || []).includes(userId))
      .sort(compareNewest)
      .map(card => ({
        shareCardId: card.shareCardId,
        shareType: card.shareType,
        targetType: card.targetType,
        targetId: card.targetId,
        headline: card.headline,
        cta: card.cta,
        createdAt: card.createdAt || null
      })),
    liveMarkets: values(view.markets).map(market => ({
      marketId: market.marketId,
      roomId: market.roomId,
      competitionId: market.competitionId,
      marketType: market.marketType,
      status: market.status,
      optionCount: (market.options || []).length
    })),
    streaks: values(view.streakResolutions).map(streak => ({
      streakId: streak.streakId,
      roomId: streak.roomId,
      winnerUserIds: cloneJson(streak.winnerUserIds || [])
    }))
  })
}

function creatorSurface ({ view, userId }) {
  const hostedCompetitionIds = new Set(values(view.rooms)
    .filter(room => room.hostUserId === userId)
    .map(room => room.competitionId))
  const competitions = values(view.competitions)
    .filter(competition => competition.organizerId === userId || hostedCompetitionIds.has(competition.competitionId))
    .map(competition => ({
      competitionId: competition.competitionId,
      title: competition.title,
      category: competition.category,
      templateKind: competition.template && competition.template.kind,
      status: competition.status,
      resultPolicy: competition.resultPolicy,
      entrantCount: (competition.entrantIds || []).length,
      fixtureCount: (competition.fixtureIds || []).length,
      needsResultReview: competition.resultPolicy === 'host-entered'
    }))

  return baseSurface('creator', {
    workbench: creator.createCreatorWorkbench({ view, userId }),
    competitionDrafts: values(view.creatorCompetitionDrafts)
      .filter(draft => draft.organizerId === userId)
      .sort(compareNewest)
      .map(draft => ({
        draftId: draft.draftId,
        competitionId: draft.competitionId || null,
        title: draft.title,
        category: draft.category,
        status: draft.status,
        templateKind: draft.template && draft.template.kind,
        resultPolicy: draft.template && draft.template.resultPolicy,
        entrantCount: (draft.entrants || []).length,
        fixtureCount: (draft.fixtures || []).length,
        bracketSize: draft.bracket && draft.bracket.bracketSize || null,
        byeCount: draft.bracket && draft.bracket.byeCount || 0,
        readyToPublish: (draft.entrants || []).length >= 2 && (draft.fixtures || []).length > 0
      })),
    publishPlans: values(view.creatorPublishPlans)
      .filter(plan => plan.organizerId === userId)
      .sort(compareNewest)
      .map(plan => ({
        creatorPublishPlanId: plan.creatorPublishPlanId,
        draftId: plan.draftId,
        competitionId: plan.competitionId,
        roomId: plan.roomId,
        settlementMode: plan.settlementMode,
        poolIds: cloneJson(plan.poolIds || []),
        commandCount: (plan.commands || []).length,
        checklist: cloneJson(plan.checklist || [])
      })),
    competitions,
    hostEnteredCompetitions: competitions.filter(competition => competition.resultPolicy === 'host-entered'),
    roomsYouHost: values(view.rooms)
      .filter(room => room.hostUserId === userId)
      .map(room => ({
        roomId: room.roomId,
        competitionId: room.competitionId,
        title: room.title,
        status: room.status,
        access: room.access
      })),
    resultSnapshots: values(view.resultSnapshots).map(snapshot => ({
      snapshotId: snapshot.snapshotId,
      competitionId: snapshot.competitionId,
      sourcePolicy: snapshot.sourcePolicy || null,
      correctedFromSnapshotId: snapshot.correctedFromSnapshotId || null
    })),
    assistantDrafts: values(view.qvacCreatorDrafts)
      .filter(record => record.targetId === userId)
      .sort(compareNewest)
      .map(record => ({
        qvacRecordId: record.qvacRecordId,
        title: record.body && record.body.title || record.title,
        templateKind: record.body && record.body.templateConfig && record.body.templateConfig.kind,
        poolVariants: cloneJson(record.body && record.body.poolVariants || []),
        miniGames: cloneJson(record.body && record.body.miniGames || []),
        checklist: cloneJson(record.body && record.body.checklist || []),
        createdAt: record.createdAt || null
      })),
    triviaBanks: values(view.qvacTriviaBanks)
      .sort(compareNewest)
      .map(record => ({
        qvacRecordId: record.qvacRecordId,
        targetType: record.targetType,
        targetId: record.targetId,
        status: record.status,
        mode: record.body && record.body.mode,
        verified: record.body && record.body.verified === true,
        questionCount: (record.body && record.body.questions || []).length,
        createdAt: record.createdAt || null
      })),
    templateGalleries: values(view.creatorTemplateGalleries)
      .sort(compareNewest)
      .map(gallery => ({
        galleryId: gallery.galleryId,
        title: gallery.title,
        templateCount: (gallery.templates || []).length,
        featuredTemplates: cloneJson((gallery.templates || []).filter(template => (gallery.featuredTemplateIds || []).includes(template.templateCardId))),
        createdAt: gallery.createdAt || null
      })),
    contentCalendars: values(view.contentCalendars)
      .sort(compareNewest)
      .map(calendar => ({
        calendarId: calendar.calendarId,
        title: calendar.title,
        startDate: calendar.startDate,
        weeks: calendar.weeks,
        itemCount: (calendar.items || []).length,
        createdAt: calendar.createdAt || null
      }))
  })
}

function walletSurface ({ view, userId }) {
  const accounts = values(view.walletAccounts)
    .filter(account => account.userId === userId)
    .map(account => ({
      accountId: account.accountId,
      mode: account.mode,
      currency: account.currency,
      status: account.status,
      balance: cloneJson(view.walletBalances && view.walletBalances[account.accountId] || null)
    }))

  return baseSurface('wallet', {
    workbench: walletOps.createWalletOpsWorkbench({ view, userId }),
    accounts,
    payoutRoutes: values(view.payoutRoutes)
      .filter(route => route.userId === userId)
      .map(route => ({
        routeId: route.routeId,
        routeType: route.routeType,
        status: route.status,
        label: route.label
      })),
    payoutDeclarations: values(view.payoutRecipientDeclarations)
      .filter(declaration => declaration.userId === userId)
      .map(declaration => ({
        declarationId: declaration.declarationId,
        asset: declaration.asset,
        routeType: declaration.routeType,
        status: declaration.status,
        recipientHash: declaration.recipientHash,
        declaredAt: declaration.declaredAt
      })),
    readinessPanels: values(view.readinessPanels)
      .filter(panel => panel.userId === userId)
      .map(panel => ({
        readinessPanelId: panel.readinessPanelId,
        targetType: panel.targetType,
        targetId: panel.targetId,
        mode: panel.mode,
        ready: panel.ready,
        missingGates: cloneJson(panel.readiness && panel.readiness.missingGates || []),
        missingGateEvidence: cloneJson(panel.readiness && panel.readiness.missingGateEvidence || [])
      })),
    sponsorFulfillments: values(view.sponsorFulfillments)
      .filter(item => item.winnerUserId === userId)
      .map(item => ({
        fulfillmentId: item.fulfillmentId,
        receiptId: item.receiptId,
        status: item.status,
        sponsorId: item.sponsorId || null
      })),
    rewardGrants: values(view.walletRewardGrants)
      .filter(grant => (grant.winnerUserIds || []).includes(userId))
      .map(grant => ({
        grantId: grant.grantId,
        receiptId: grant.receiptId,
        amountPerWinner: grant.amountPerWinner,
        currency: grant.currency,
        status: grant.status
      }))
  })
}

function opsSurface (input = {}) {
  const userId = input.userId || 'operator'
  return baseSurface('ops', {
    workbench: ops.createOpsWorkbench({
      view: input.view || {},
      events: input.events || [],
      transportStatus: input.transportStatus || null,
      userId,
      now: input.now
    })
  })
}

function settingsSurface ({ view, userId }) {
  const profile = view.profiles && view.profiles[userId] || null
  const complianceProfile = view.complianceProfiles && view.complianceProfiles[userId] || null
  return baseSurface('settings', {
    profile: profile
      ? {
          userId: profile.userId,
          username: profile.username || null,
          displayName: profile.displayName || null,
          locale: profile.locale || null,
          updatedAt: profile.updatedAt || null
        }
      : null,
    complianceProfile: complianceProfile
      ? {
          complianceProfileId: complianceProfile.complianceProfileId,
          jurisdiction: complianceProfile.jurisdiction,
          status: complianceProfile.status,
          kycVerified: complianceProfile.kycVerified,
          ageVerified: complianceProfile.ageVerified,
          jurisdictionAllowed: complianceProfile.jurisdictionAllowed,
          responsiblePlayAccepted: complianceProfile.responsiblePlayAccepted,
          updatedAt: complianceProfile.updatedAt
        }
      : null,
    trustActions: values(view.trustActions)
      .filter(action => action.targetUserId === userId || action.sourceUserId === userId)
      .map(action => ({
        trustActionId: action.trustActionId,
        scope: action.scope,
        scopeId: action.scopeId,
        action: action.action,
        sourceUserId: action.sourceUserId,
        targetUserId: action.targetUserId,
        createdAt: action.createdAt
      })),
    moderationReviews: values(view.qvacModerationReviews)
      .filter(record => record.body && record.body.userId === userId)
      .sort(compareNewest)
      .map(record => ({
        qvacRecordId: record.qvacRecordId,
        targetType: record.targetType,
        targetId: record.targetId,
        labels: cloneJson(record.body && record.body.labels || []),
        severity: record.body && record.body.severity,
        recommendedAction: record.body && record.body.recommendedAction,
        createdAt: record.createdAt || null
      }))
  })
}

function baseSurface (surfaceId, body) {
  return {
    surfaceId,
    title: SURFACE_TITLES[surfaceId],
    ...body
  }
}

function roomSummary (view, room, userId) {
  const participants = Object.values(view.roomParticipants && view.roomParticipants[room.roomId] || {})
    .filter(participant => participant.status !== 'left')
  const messages = values(view.roomMessages).filter(message => message.roomId === room.roomId)
  const challenges = values(view.roomChallenges).filter(challenge => challenge.roomId === room.roomId)
  const markets = values(view.markets).filter(market => market.roomId === room.roomId)
  return {
    roomId: room.roomId,
    competitionId: room.competitionId,
    fixtureId: room.fixtureId,
    title: room.title,
    status: room.status,
    access: room.access,
    hostUserId: room.hostUserId,
    currentUserJoined: participants.some(participant => participant.userId === userId),
    participantCount: participants.length,
    visibleMessageCount: messages.filter(message => message.moderationState !== 'hidden').length,
    activeChallengeCount: challenges.filter(challenge => challenge.status === 'pending' || challenge.status === 'accepted').length,
    liveMarketCount: markets.filter(market => market.status !== 'resolved').length
  }
}

function userNotifications (view, userId) {
  return values(view.notifications).filter(notification => notification.userId === userId)
}

function notificationSummary (notification) {
  return {
    notificationId: notification.notificationId,
    type: notification.type,
    title: notification.title,
    status: notification.status,
    targetType: notification.targetType,
    targetId: notification.targetId,
    createdAt: notification.createdAt || null
  }
}

function receiptSummary (receipt) {
  return {
    receiptId: receipt.receiptId,
    status: receipt.status,
    targetType: receipt.body && receipt.body.targetType,
    targetId: receipt.body && receipt.body.targetId,
    mode: receipt.body && receipt.body.mode,
    winnerUserIds: cloneJson(receipt.body && receipt.body.winnerUserIds || []),
    receiptHash: receipt.receiptHash || null
  }
}

function currentUserRank (ladder, userId) {
  const row = (ladder.leaderboard || []).find(row => row.userId === userId)
  return row ? row.rank : null
}

function badgeCountFor (surfaceId, surface = {}) {
  if (surfaceId === 'home') return surface.counts && surface.counts.unreadNotifications || 0
  if (surfaceId === 'pools') return (surface.yourPools || []).length
  if (surfaceId === 'picks') return (surface.predictionEntries || []).filter(entry => entry.status === 'submitted').length
  if (surfaceId === 'watch') return (surface.liveRooms || []).length
  if (surfaceId === 'games') return (surface.activeDuels || []).length + (surface.activeGames || []).length + (surface.rematches || []).filter(rematch => rematch.status === 'proposed').length
  if (surfaceId === 'creator') return (surface.competitionDrafts || []).filter(draft => draft.readyToPublish).length + (surface.hostEnteredCompetitions || []).length + (surface.templateGalleries || []).length
  if (surfaceId === 'settings') return (surface.moderationReviews || []).filter(review => review.severity === 'high').length
  if (surfaceId === 'wallet') return (surface.readinessPanels || []).filter(panel => panel.ready !== true).length
  if (surfaceId === 'ops') return surface.workbench && (surface.workbench.disputes || []).length || 0
  return 0
}

function primaryCountFor (surfaceId, surface = {}) {
  if (surfaceId === 'discover') return (surface.launchCards || []).length
  if (surfaceId === 'pools') return (surface.pools || []).length
  if (surfaceId === 'picks') return (surface.predictionEntries || []).length + (surface.cardSubmissions || []).length + (surface.draftEntries || []).length
  if (surfaceId === 'watch') return (surface.rooms || []).length
  if (surfaceId === 'games') return (surface.gameSessions || []).length + (surface.challenges || []).length + (surface.spectatorReplays || []).length
  if (surfaceId === 'creator') return (surface.competitionDrafts || []).length + (surface.publishPlans || []).length + (surface.competitions || []).length + (surface.assistantDrafts || []).length + (surface.templateGalleries || []).length
  if (surfaceId === 'wallet') return (surface.accounts || []).length + (surface.payoutRoutes || []).length
  if (surfaceId === 'ops') return surface.workbench && ((surface.workbench.attestations && surface.workbench.attestations.queues || []).length + (surface.workbench.disputes || []).length) || 0
  return 0
}

function values (collection = {}) {
  return Object.values(collection || {})
}

function compareNewest (left, right) {
  return String(right.createdAt || right.updatedAt || '').localeCompare(String(left.createdAt || left.updatedAt || ''))
}

module.exports = {
  SURFACE_IDS,
  SURFACE_TITLES,
  createExperience,
  createSurface,
  createNavigation,
  homeSurface,
  discoverSurface,
  poolsSurface,
  picksSurface,
  watchSurface,
  gamesSurface,
  creatorSurface,
  walletSurface,
  opsSurface,
  settingsSurface
}
