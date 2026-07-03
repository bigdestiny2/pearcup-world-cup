(function attachPearCupWorkerSim (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const core = root.PearCupCore || (canRequireLocal ? require('./core.js') : null)
  const adapterFactory = root.PearCupAdapters || (canRequireLocal ? require('./adapters.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupWorkerSim')
  if (!adapterFactory) throw new Error('PearCupAdapters is required before PearCupWorkerSim')

  function getSettlementReceipts () {
    return root.PearCupSettlementReceipts || (canRequireLocal ? require('./settlement-receipts.js') : null)
  }

  function eventEnvelope ({ type, actorId = 'system', payload, previousEventId = null, sequence }) {
    const createdAt = `2026-07-01T00:00:${String(sequence).padStart(2, '0')}.000Z`
    const unsigned = { type, actorId, payload, previousEventId, sequence, createdAt }
    const eventId = core.deterministicHash(unsigned)
    return {
      eventId,
      type,
      version: 1,
      actorId,
      deviceId: 'local-worker-sim',
      sequence,
      createdAt,
      payload,
      previousEventId,
      signature: core.deterministicHash({ eventId, unsigned, signer: actorId })
    }
  }

  function eventCreatedAtForSequence (sequence) {
    return `2026-07-01T00:00:${String(sequence).padStart(2, '0')}.000Z`
  }

  function validateEventEnvelope (event) {
    const errors = []
    if (!event || typeof event !== 'object') {
      return { ok: false, errors: ['event envelope is required'] }
    }
    if (event.version !== 1) errors.push('event version must be 1')
    if (!event.type || typeof event.type !== 'string') errors.push('event type is required')
    if (!event.actorId || typeof event.actorId !== 'string') errors.push('event actorId is required')
    if (!Number.isInteger(event.sequence) || event.sequence < 1) errors.push('event sequence must be a positive integer')
    if (event.previousEventId !== null && event.previousEventId !== undefined && typeof event.previousEventId !== 'string') {
      errors.push('event previousEventId must be null or a string')
    }
    if (event.payload === undefined) errors.push('event payload is required')

    const expectedCreatedAt = Number.isInteger(event.sequence)
      ? eventCreatedAtForSequence(event.sequence)
      : null
    if (expectedCreatedAt && event.createdAt !== expectedCreatedAt) {
      errors.push('event createdAt does not match sequence')
    }

    if (errors.length) return { ok: false, errors }

    const unsigned = {
      type: event.type,
      actorId: event.actorId,
      payload: event.payload,
      previousEventId: event.previousEventId == null ? null : event.previousEventId,
      sequence: event.sequence,
      createdAt: event.createdAt
    }
    const expectedEventId = core.deterministicHash(unsigned)
    if (event.eventId !== expectedEventId) errors.push('eventId does not match event payload')
    const expectedSignature = core.deterministicHash({
      eventId: expectedEventId,
      unsigned,
      signer: event.actorId
    })
    if (event.signature !== expectedSignature) errors.push('event signature does not match event payload')

    return {
      ok: errors.length === 0,
      errors,
      expectedEventId,
      expectedSignature
    }
  }

  function eventRoot (events) {
    return core.deterministicHash(events
      .map(event => ({
        eventId: event.eventId,
        signature: event.signature,
        type: event.type
      }))
      .sort((a, b) => a.eventId.localeCompare(b.eventId)))
  }

  function typeCounts (events) {
    return events.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] || 0) + 1
      return counts
    }, {})
  }

  function eventIndex (events = []) {
    const byId = new Map()
    const byType = new Map()
    for (const event of events) {
      if (!event || !event.eventId) continue
      byId.set(event.eventId, event)
      if (!byType.has(event.type)) byType.set(event.type, [])
      byType.get(event.type).push(event)
    }
    return { byId, byType }
  }

  function findIndexedEvent (index, type, predicate) {
    const events = index.byType.get(type) || []
    return events.find(event => predicate(event.payload || {}, event))
  }

  function indexedSourceEventsPresent (index, sourceEventIds = []) {
    return Array.isArray(sourceEventIds) && sourceEventIds.every(eventId => index.byId.has(eventId))
  }

  function sortedStrings (value = []) {
    return Array.isArray(value) ? value.map(item => String(item)).sort() : []
  }

  function sameStringList (left, right) {
    const leftItems = sortedStrings(left)
    const rightItems = sortedStrings(right)
    return leftItems.length === rightItems.length && leftItems.every((item, index) => item === rightItems[index])
  }

  function normalizeLanguage (language) {
    const normalized = String(language || 'EN')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16)
    return normalized || 'EN'
  }

  function normalizeMatchEventPayload (payload = {}, actorId = 'sports-feed') {
    const sourceActorId = payload.sourceActorId || actorId
    const normalized = {
      matchId: payload.matchId || null,
      clock: payload.clock || '00:00',
      period: payload.period || '2H',
      type: payload.type || 'commentary_seed',
      teamId: payload.teamId || null,
      playerId: payload.playerId || null,
      value: payload.value === undefined ? null : payload.value,
      x: payload.x === undefined ? null : payload.x,
      y: payload.y === undefined ? null : payload.y,
      createdAt: payload.createdAt || '2026-07-01T00:00:00.000Z',
      sourceActorId
    }
    return {
      eventId: payload.eventId || core.deterministicHash(normalized),
      ...normalized
    }
  }

  function matchEventSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.sourceActorId && event.actorId === payload.sourceActorId)
  }

  function emptyStatSnapshot (matchId) {
    return {
      matchId,
      clock: '00:00',
      score: {},
      possession: {},
      shots: {},
      shotsOnTarget: {},
      xg: {},
      corners: {},
      saves: {},
      threat: {}
    }
  }

  function ensureTeamStats (stats, teamId) {
    if (!teamId) return
    for (const key of ['score', 'possession', 'shots', 'shotsOnTarget', 'xg', 'corners', 'saves']) {
      if (stats[key][teamId] == null) stats[key][teamId] = 0
    }
    if (!stats.threat[teamId]) stats.threat[teamId] = 'low'
  }

  function applyMatchEventToStats (stats, event = {}) {
    const teamId = event.teamId || null
    if (event.clock) stats.clock = event.clock
    if (!teamId) return stats
    ensureTeamStats(stats, teamId)
    const numericValue = Number(event.value)
    if (event.type === 'goal') {
      stats.score[teamId] += 1
      stats.shots[teamId] += 1
      stats.shotsOnTarget[teamId] += 1
      if (Number.isFinite(numericValue)) stats.xg[teamId] = Number((stats.xg[teamId] + numericValue).toFixed(2))
    }
    if (event.type === 'shot') {
      stats.shots[teamId] += 1
      if (event.value === 'on-target' || Number.isFinite(numericValue)) stats.shotsOnTarget[teamId] += 1
      if (Number.isFinite(numericValue)) stats.xg[teamId] = Number((stats.xg[teamId] + numericValue).toFixed(2))
    }
    if (event.type === 'save') stats.saves[teamId] += 1
    if (event.type === 'possession' && Number.isFinite(numericValue)) {
      stats.possession[teamId] = Math.max(0, Math.min(100, numericValue))
    }
    const pressure = stats.shots[teamId] + stats.shotsOnTarget[teamId] + stats.xg[teamId]
    stats.threat[teamId] = pressure >= 6 ? 'high' : pressure >= 3 ? 'medium' : 'low'
    return stats
  }

  function statSnapshotForEvents (matchId, events = []) {
    const stats = emptyStatSnapshot(matchId)
    for (const event of events) applyMatchEventToStats(stats, event)
    stats.statHash = core.deterministicHash({
      matchId,
      sourceEventIds: events.map(event => event.sourceEventId || event.workerEventId || event.eventId),
      score: stats.score,
      possession: stats.possession,
      shots: stats.shots,
      shotsOnTarget: stats.shotsOnTarget,
      xg: stats.xg,
      corners: stats.corners,
      saves: stats.saves,
      threat: stats.threat
    })
    return stats
  }

  function commentarySignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.commentatorId && event.actorId === payload.commentatorId)
  }

  function commentarySegmentMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    if (!commentarySignerMatches(event)) return false
    if (!payload.matchId || !payload.language || !payload.segmentId) return false
    const sourceEventIds = Array.isArray(payload.sourceEventIds) ? payload.sourceEventIds : []
    if (sourceEventIds.length === 0) return false
    if (payload.eventHash !== core.deterministicHash(sourceEventIds)) return false
    const sourceEvents = sourceEventIds.map(eventId => index.byId.get(eventId))
    return sourceEvents.every(sourceEvent => {
      return sourceEvent &&
        sourceEvent.type === 'MatchEventIngested' &&
        sourceEvent.payload &&
        sourceEvent.payload.matchId === payload.matchId &&
        matchEventSignerMatches(sourceEvent)
    })
  }

  function payoutRecipientSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.userId && event.actorId === payload.userId)
  }

  function payoutRecipientSignerMismatchReason ({ actorId, userId }) {
    return `Payout recipient declaration actorId must match userId ${userId || 'unknown-user'} (received ${actorId || 'unknown-actor'})`
  }

  function bracketSubmissionSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.userId && event.actorId === payload.userId)
  }

  function bracketSubmissionSignerMismatchReason ({ actorId, userId }) {
    return `Bracket submission actorId must match userId ${userId || 'unknown-user'} (received ${actorId || 'unknown-actor'})`
  }

  function entryIntentSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.userId && event.actorId === payload.userId)
  }

  function entryIntentSignerMismatchReason ({ actorId, userId }) {
    return `Entry intent actorId must match userId ${userId || 'unknown-user'} (received ${actorId || 'unknown-actor'})`
  }

  function paymentMatchesSignedEntryIntent ({ payment, intentEvent }) {
    const intent = intentEvent && intentEvent.payload || null
    return Boolean(payment && intent && entryIntentSignerMatches(intentEvent) &&
      payment.intentId === intent.intentId &&
      payment.poolId === intent.poolId &&
      payment.entryId === intent.entryId &&
      payment.userId === intent.userId &&
      Number(payment.amount || 0) === Number(intent.amount || 0) &&
      payment.asset === intent.asset &&
      (!payment.rail || !intent.rail || payment.rail === intent.rail))
  }

  function entryPaymentRailFor ({ payment, intent } = {}) {
    return payment && payment.rail || intent && intent.rail || null
  }

  function entryPaymentSignerMatches ({ event, intentEvent }) {
    const payment = event && event.payload || null
    const intent = intentEvent && intentEvent.payload || null
    const rail = entryPaymentRailFor({ payment, intent })
    return Boolean(rail && event.actorId === rail)
  }

  function entryPaymentSignerMismatchReason ({ actorId, rail }) {
    return `Entry payment actorId must match WDK rail ${rail || 'unknown-rail'} (received ${actorId || 'unknown-actor'})`
  }

  function entryPaymentCheckMatchesSignedEntryIntent ({ check, intentEvent }) {
    return paymentMatchesSignedEntryIntent({ payment: check, intentEvent })
  }

  function entryPaymentCheckSignerMatches ({ event, intentEvent }) {
    return entryPaymentSignerMatches({ event, intentEvent })
  }

  function indexedEntryIntentEventForPayment (index, payment = {}) {
    return findIndexedEvent(index, 'TetherWdkEntryIntentCreated', intent => {
      return intent.intentId === payment.intentId
    })
  }

  function entryPaymentCheckMatchesReplay (event, index) {
    const check = event && event.payload || {}
    const intentEvent = indexedEntryIntentEventForPayment(index, check)
    return entryPaymentCheckMatchesSignedEntryIntent({ check, intentEvent }) &&
      entryPaymentCheckSignerMatches({ event, intentEvent })
  }

  function entryRefundMatchesConfirmedPayment ({ refund, paymentEvent }) {
    const payment = paymentEvent && paymentEvent.payload || null
    return Boolean(refund && payment &&
      refund.paymentId === payment.paymentId &&
      refund.intentId === payment.intentId &&
      refund.poolId === payment.poolId &&
      refund.entryId === payment.entryId &&
      refund.userId === payment.userId &&
      Number(refund.amount || 0) === Number(payment.amount || 0) &&
      refund.asset === payment.asset &&
      (!refund.rail || !payment.rail || refund.rail === payment.rail))
  }

  function entryRefundSignerMatches ({ event, paymentEvent }) {
    const refund = event && event.payload || null
    const payment = paymentEvent && paymentEvent.payload || null
    const rail = entryPaymentRailFor({ payment: refund, intent: payment })
    return Boolean(rail && event && event.actorId === rail)
  }

  function entryRefundSignerMismatchReason ({ actorId, rail }) {
    return `Entry refund actorId must match WDK rail ${rail || 'unknown-rail'} (received ${actorId || 'unknown-actor'})`
  }

  function indexedEntryPaymentEventForRefund (index, refund = {}) {
    return findIndexedEvent(index, 'TetherWdkEntryConfirmed', payment => {
      return payment.paymentId === refund.paymentId
    })
  }

  function entryRefundMatchesReplay (event, index) {
    const refund = event && event.payload || {}
    const paymentEvent = indexedEntryPaymentEventForRefund(index, refund)
    const payment = paymentEvent && paymentEvent.payload || {}
    const intentEvent = indexedEntryIntentEventForPayment(index, payment)
    return entryRefundMatchesConfirmedPayment({ refund, paymentEvent }) &&
      paymentMatchesSignedEntryIntent({ payment, intentEvent }) &&
      entryPaymentSignerMatches({ event: paymentEvent, intentEvent }) &&
      entryRefundSignerMatches({ event, paymentEvent })
  }

  function validEntryRefundEventForPayment (index, paymentId, poolId) {
    return findIndexedEvent(index, 'TetherWdkEntryRefunded', (refund, event) => {
      return refund.paymentId === paymentId &&
        (!poolId || refund.poolId === poolId) &&
        entryRefundMatchesReplay(event, index)
    })
  }

  function wdkSettlementRailFor (payload = {}) {
    return payload && payload.rail || null
  }

  function wdkSettlementSignerMatches (event) {
    const payload = event && event.payload || {}
    const rail = wdkSettlementRailFor(payload)
    return Boolean(rail && event.actorId === rail)
  }

  function wdkSettlementSignerMismatchReason ({ actorId, rail }) {
    return `WDK settlement actorId must match rail ${rail || 'unknown-rail'} (received ${actorId || 'unknown-actor'})`
  }

  function wdkDisputeSignerMatches (event) {
    return wdkSettlementSignerMatches(event)
  }

  function indexedEscrowEventForRefund (index, refund = {}) {
    return findIndexedEvent(index, 'TetherWdkEscrowCreated', escrow => {
      return escrow.escrowId === refund.escrowId
    })
  }

  function validEscrowDisputeEventForRefund (index, refund = {}) {
    return findIndexedEvent(index, 'TetherWdkEscrowDisputed', (dispute, event) => {
      return dispute.escrowId === refund.escrowId &&
        wdkDisputeSignerMatches(event)
    })
  }

  function validEscrowReleaseEventForEscrow (index, escrowId) {
    return findIndexedEvent(index, 'TetherWdkEscrowReleased', (payout, event) => {
      return payout.escrowId === escrowId &&
        wdkSettlementSignerMatches(event)
    })
  }

  function wdkEscrowSignerMatches (event) {
    const payload = event && event.payload || {}
    const rail = wdkSettlementRailFor(payload)
    return Boolean(rail && event.actorId === rail)
  }

  function wdkEscrowSignerMismatchReason ({ actorId, rail }) {
    return `WDK escrow actorId must match rail ${rail || 'unknown-rail'} (received ${actorId || 'unknown-actor'})`
  }

  function officialResultsSourceActorIdFor ({ officialResults = {}, source, sourceActorId } = {}) {
    if (sourceActorId) return sourceActorId
    if (officialResults && officialResults.sourceActorId) return officialResults.sourceActorId
    const resultSource = source || officialResults && officialResults.source
    if (resultSource && resultSource !== 'trusted-results-feed') return resultSource
    return 'official-results-feed'
  }

  function officialResultsSnapshotSignerMatches (event) {
    const payload = event && event.payload || {}
    const sourceActorId = officialResultsSourceActorIdFor(payload)
    return Boolean(sourceActorId && event.actorId === sourceActorId)
  }

  function officialResultsSnapshotSignerMismatchReason ({ actorId, sourceActorId }) {
    return `Official results snapshot actorId must match sourceActorId ${sourceActorId || 'unknown-source'} (received ${actorId || 'unknown-actor'})`
  }

  function qvacAttestationSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.refereeId && event.actorId === payload.refereeId)
  }

  function qvacAttestationSignerMismatchReason ({ actorId, refereeId }) {
    return `QVAC attestation actorId must match refereeId ${refereeId || 'unknown-referee'} (received ${actorId || 'unknown-actor'})`
  }

  function cloneValue (value) {
    return value == null ? value : JSON.parse(JSON.stringify(value))
  }

  function normalizeGameMode (mode) {
    const value = String(mode || 'quick').trim().toLowerCase()
    if (value === 'private' || value === 'room-tournament' || value === 'ranked') return value
    return 'quick'
  }

  function normalizeGamePlayer (player = {}, fallbackUserId = null, fallbackRole = 'shooter') {
    const userId = player.userId || player.id || fallbackUserId || null
    return {
      userId,
      username: player.username || (userId ? String(userId) : null),
      teamId: player.teamId || null,
      avatarRecipe: player.avatarRecipe || null,
      role: player.role || fallbackRole,
      connected: player.connected === true
    }
  }

  function normalizeProfilePayload (payload = {}, actorId = 'system') {
    const userId = payload.userId || actorId
    const username = String(payload.username || userId || 'captain').trim().slice(0, 18) || 'captain'
    const teamId = payload.teamId || null
    const avatarRecipe = payload.avatarRecipe || null
    return {
      profileId: core.deterministicHash({
        type: 'ProfileUpdated',
        userId,
        username,
        teamId,
        avatarRecipe
      }),
      userId,
      username,
      teamId,
      avatarRecipe,
      updatedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function profileSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.userId && event.actorId === payload.userId)
  }

  function profileMatchesReplay (event) {
    const payload = event && event.payload || {}
    const expected = normalizeProfilePayload(payload, event && event.actorId)
    return profileSignerMatches(event) &&
      payload.profileId === expected.profileId &&
      payload.userId === expected.userId &&
      payload.username === expected.username &&
      payload.teamId === expected.teamId
  }

  function normalizePicksMap (picks = {}) {
    return Object.keys(picks || {})
      .sort()
      .reduce((copy, key) => {
        const value = picks[key]
        if (value) copy[key] = value
        return copy
      }, {})
  }

  function normalizeBracketDraftPayload (payload = {}, actorId = 'system', previousPicks = {}) {
    const poolId = payload.poolId || null
    const userId = payload.userId || actorId
    let picks = Object.prototype.hasOwnProperty.call(payload, 'picks')
      ? normalizePicksMap(payload.picks)
      : normalizePicksMap(previousPicks)
    if (payload.matchId && payload.winnerTeamId) {
      picks = normalizePicksMap({
        ...picks,
        [payload.matchId]: payload.winnerTeamId
      })
    }
    if (payload.clear === true) picks = {}
    const rulesVersion = payload.rulesVersion || 'bracket-pool-v1'
    return {
      draftId: core.deterministicHash({
        type: 'BracketDraftUpdated',
        poolId,
        userId,
        picks,
        rulesVersion
      }),
      poolId,
      userId,
      username: payload.username || null,
      teamId: payload.teamId || null,
      picks,
      picksHash: core.deterministicHash(picks),
      rulesVersion,
      updatedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function bracketDraftSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.userId && event.actorId === payload.userId)
  }

  function bracketDraftMatchesReplay (event) {
    const payload = event && event.payload || {}
    const expected = normalizeBracketDraftPayload(payload, event && event.actorId)
    return bracketDraftSignerMatches(event) &&
      payload.draftId === expected.draftId &&
      payload.poolId === expected.poolId &&
      payload.userId === expected.userId &&
      payload.picksHash === expected.picksHash
  }

  function gameTopic (gameId) {
    return `pearcup:v1:game:${gameId || 'unknown-game'}`
  }

  function gameTopicHash (gameId) {
    return core.deterministicHash(gameTopic(gameId))
  }

  function roomTopic (matchId, roomId) {
    return `pearcup:v1:room:${matchId || roomId || 'unknown-room'}`
  }

  function roomTopicHash ({ matchId, roomId } = {}) {
    return core.deterministicHash(roomTopic(matchId, roomId))
  }

  function normalizeRoomId (payload = {}) {
    return payload.roomId || core.deterministicHash({
      type: 'WatchRoom',
      matchId: payload.matchId || null
    })
  }

  function normalizeRoomJoinPayload (payload = {}, actorId = 'system') {
    const roomId = normalizeRoomId(payload)
    const matchId = payload.matchId || roomId
    const userId = payload.userId || actorId
    return {
      joinId: core.deterministicHash({
        type: 'RoomJoined',
        roomId,
        matchId,
        userId
      }),
      roomId,
      matchId,
      userId,
      username: payload.username || userId,
      teamId: payload.teamId || null,
      avatarRecipe: payload.avatarRecipe || null,
      role: payload.role || 'viewer',
      topic: roomTopic(matchId, roomId),
      topicHash: roomTopicHash({ matchId, roomId }),
      joinedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function roomJoinSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.userId && event.actorId === payload.userId)
  }

  function roomJoinMatchesReplay (event) {
    const payload = event && event.payload || {}
    const expected = normalizeRoomJoinPayload(payload, event && event.actorId)
    return roomJoinSignerMatches(event) &&
      payload.roomId === expected.roomId &&
      payload.matchId === expected.matchId &&
      payload.joinId === expected.joinId &&
      payload.topic === expected.topic &&
      payload.topicHash === expected.topicHash
  }

  function roomJoinEventForUser (index, roomId, userId) {
    return findIndexedEvent(index, 'RoomJoined', (joined, event) => {
      return joined.roomId === roomId &&
        joined.userId === userId &&
        roomJoinMatchesReplay(event)
    })
  }

  function normalizeRoomLeavePayload (payload = {}, actorId = 'system') {
    const userId = payload.userId || actorId
    return {
      leaveId: core.deterministicHash({
        type: 'RoomLeft',
        roomId: payload.roomId || null,
        userId
      }),
      roomId: payload.roomId || null,
      userId,
      leftAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function roomLeaveMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const expected = normalizeRoomLeavePayload(payload, event && event.actorId)
    return Boolean(payload.roomId && payload.userId && event.actorId === payload.userId) &&
      payload.leaveId === expected.leaveId &&
      Boolean(roomJoinEventForUser(index, payload.roomId, payload.userId))
  }

  function normalizeChatMessagePayload (payload = {}, actorId = 'system') {
    const userId = payload.userId || actorId
    const body = String(payload.body || '').trim().slice(0, 500)
    return {
      messageId: core.deterministicHash({
        type: 'ChatMessageSent',
        roomId: payload.roomId || null,
        userId,
        body,
        clientNonce: payload.clientNonce || null
      }),
      roomId: payload.roomId || null,
      userId,
      username: payload.username || userId,
      teamId: payload.teamId || null,
      clientNonce: payload.clientNonce || null,
      body,
      sentAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function chatMessageMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const expected = normalizeChatMessagePayload(payload, event && event.actorId)
    return Boolean(payload.roomId && payload.userId && payload.body && event.actorId === payload.userId) &&
      payload.messageId === expected.messageId &&
      Boolean(roomJoinEventForUser(index, payload.roomId, payload.userId))
  }

  function normalizeVoiceStatePayload (payload = {}, actorId = 'system') {
    const userId = payload.userId || actorId
    const status = payload.status === 'speaking' || payload.status === 'muted' ? payload.status : 'idle'
    return {
      voiceStateId: core.deterministicHash({
        type: 'VoiceStateUpdated',
        roomId: payload.roomId || null,
        userId,
        status,
        muted: payload.muted === true,
        handRaised: payload.handRaised === true
      }),
      roomId: payload.roomId || null,
      userId,
      status,
      muted: payload.muted === true,
      handRaised: payload.handRaised === true,
      updatedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function voiceStateMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const expected = normalizeVoiceStatePayload(payload, event && event.actorId)
    return Boolean(payload.roomId && payload.userId && event.actorId === payload.userId) &&
      payload.voiceStateId === expected.voiceStateId &&
      Boolean(roomJoinEventForUser(index, payload.roomId, payload.userId))
  }

  function normalizeStreamStartPayload (payload = {}, actorId = 'system') {
    const userId = payload.userId || actorId
    const roomId = payload.roomId || null
    const source = payload.source === 'licensed-feed' || payload.source === 'match-visualization'
      ? payload.source
      : 'user-owned-screen-share'
    const streamId = payload.streamId || core.deterministicHash({
      type: 'StreamStarted',
      roomId,
      userId,
      source,
      clientNonce: payload.clientNonce || null
    })
    return {
      streamId,
      roomId,
      userId,
      username: payload.username || userId,
      source,
      title: payload.title || 'Shared match view',
      rightsConfirmed: payload.rightsConfirmed === true,
      topic: `pearcup:v1:media:${streamId}`,
      topicHash: core.deterministicHash(`pearcup:v1:media:${streamId}`),
      startedAt: '2026-07-01T00:00:00.000Z',
      status: 'live'
    }
  }

  function streamStartMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const expected = normalizeStreamStartPayload(payload, event && event.actorId)
    return Boolean(payload.roomId && payload.userId && event.actorId === payload.userId) &&
      payload.streamId === expected.streamId &&
      payload.topic === expected.topic &&
      payload.topicHash === expected.topicHash &&
      payload.rightsConfirmed === true &&
      Boolean(roomJoinEventForUser(index, payload.roomId, payload.userId))
  }

  function normalizeStreamStopPayload (payload = {}, actorId = 'system') {
    const userId = payload.userId || actorId
    return {
      stopId: core.deterministicHash({
        type: 'StreamStopped',
        streamId: payload.streamId || null,
        roomId: payload.roomId || null,
        userId
      }),
      streamId: payload.streamId || null,
      roomId: payload.roomId || null,
      userId,
      stoppedAt: '2026-07-01T00:00:00.000Z',
      status: 'stopped'
    }
  }

  function streamStopMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const expected = normalizeStreamStopPayload(payload, event && event.actorId)
    const started = findIndexedEvent(index, 'StreamStarted', (stream, streamEvent) => {
      return stream.streamId === payload.streamId && streamStartMatchesReplay(streamEvent, index)
    })
    const streamerId = started && started.payload && started.payload.userId
    return Boolean(started && payload.streamId && payload.roomId && payload.userId) &&
      event.actorId === payload.userId &&
      payload.userId === streamerId &&
      payload.stopId === expected.stopId
  }

  function normalizeGameInvitePayload (payload = {}, actorId = 'system') {
    const mode = normalizeGameMode(payload.mode)
    const roomId = payload.roomId || null
    const inviter = normalizeGamePlayer(
      payload.inviter || payload.inviterPlayer || {
        userId: payload.inviterUserId || actorId,
        username: payload.inviterUsername,
        teamId: payload.inviterTeamId,
        avatarRecipe: payload.inviterAvatarRecipe
      },
      payload.inviterUserId || actorId,
      'shooter'
    )
    const opponent = normalizeGamePlayer(
      payload.opponent || payload.opponentPlayer || {
        userId: payload.opponentUserId,
        username: payload.opponentUsername,
        teamId: payload.opponentTeamId,
        avatarRecipe: payload.opponentAvatarRecipe
      },
      payload.opponentUserId,
      'keeper'
    )
    const rulesVersion = payload.rulesVersion || core.resolverVersion
    const gameType = payload.gameType || 'penalty-clash'
    const clientNonce = payload.clientNonce || payload.inviteNonce || null
    const gameId = payload.gameId || core.deterministicHash({
      type: 'GameInviteCreated',
      roomId,
      mode,
      gameType,
      inviterUserId: inviter.userId,
      opponentUserId: opponent.userId,
      rulesVersion,
      clientNonce
    })
    const inviteCore = {
      gameId,
      roomId,
      mode,
      gameType,
      inviterUserId: inviter.userId,
      opponentUserId: opponent.userId,
      rulesVersion,
      clientNonce
    }
    const players = [
      { ...inviter, role: 'shooter', connected: true },
      { ...opponent, role: 'keeper', connected: false }
    ]
    return {
      inviteId: core.deterministicHash({ type: 'GameInviteCreated', ...inviteCore }),
      ...inviteCore,
      topic: gameTopic(gameId),
      topicHash: gameTopicHash(gameId),
      inviter: players[0],
      opponent: players[1],
      players,
      spectators: [],
      stake: payload.stake || null,
      prizeMode: payload.prizeMode === true,
      status: 'inviting',
      expiresAt: payload.expiresAt || null,
      createdAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function gameInviteSignerMatches (event) {
    const payload = event && event.payload || {}
    const inviter = payload.inviter || {}
    const opponent = payload.opponent || {}
    const expectedInviteId = core.deterministicHash({
      type: 'GameInviteCreated',
      gameId: payload.gameId,
      roomId: payload.roomId || null,
      mode: normalizeGameMode(payload.mode),
      gameType: payload.gameType || 'penalty-clash',
      inviterUserId: inviter.userId || payload.inviterUserId || null,
      opponentUserId: opponent.userId || payload.opponentUserId || null,
      rulesVersion: payload.rulesVersion || core.resolverVersion,
      clientNonce: payload.clientNonce || null
    })
    return Boolean(
      payload.gameId &&
      payload.inviteId === expectedInviteId &&
      payload.topic === gameTopic(payload.gameId) &&
      payload.topicHash === gameTopicHash(payload.gameId) &&
      inviter.userId &&
      opponent.userId &&
      inviter.userId !== opponent.userId &&
      event.actorId === inviter.userId
    )
  }

  function gameInviteSignerMismatchReason ({ actorId, inviterUserId }) {
    return `Game invite actorId must match inviter userId ${inviterUserId || 'unknown-user'} (received ${actorId || 'unknown-actor'})`
  }

  function gameInviteAcceptancePayload ({ inviteEvent, actorId }) {
    const invite = inviteEvent && inviteEvent.payload || {}
    return {
      acceptanceId: core.deterministicHash({
        type: 'GameInviteAccepted',
        gameId: invite.gameId,
        inviteId: invite.inviteId,
        inviteEventId: inviteEvent && inviteEvent.eventId,
        acceptedByUserId: actorId
      }),
      gameId: invite.gameId,
      inviteId: invite.inviteId,
      inviteEventId: inviteEvent && inviteEvent.eventId,
      acceptedByUserId: actorId,
      status: 'accepted',
      acceptedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function gameInviteAcceptanceMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const inviteEvent = index.byId.get(payload.inviteEventId)
    const invite = inviteEvent && inviteEvent.payload || {}
    const opponent = invite.opponent || {}
    const expected = gameInviteAcceptancePayload({ inviteEvent, actorId: event && event.actorId })
    return Boolean(
      inviteEvent &&
      inviteEvent.type === 'GameInviteCreated' &&
      gameInviteSignerMatches(inviteEvent) &&
      payload.gameId === invite.gameId &&
      payload.inviteId === invite.inviteId &&
      payload.acceptedByUserId === opponent.userId &&
      event.actorId === opponent.userId &&
      payload.acceptanceId === expected.acceptanceId
    )
  }

  function gameSessionStartPayload ({ inviteEvent, acceptedEvent }) {
    const invite = inviteEvent && inviteEvent.payload || {}
    const accepted = acceptedEvent && acceptedEvent.payload || {}
    const players = (invite.players || []).map(player => ({
      ...player,
      connected: true
    }))
    const score = players.reduce((next, player) => {
      if (player.userId) next[player.userId] = 0
      return next
    }, {})
    return {
      sessionId: core.deterministicHash({
        type: 'GameSessionStarted',
        gameId: invite.gameId,
        inviteId: invite.inviteId,
        inviteEventId: inviteEvent && inviteEvent.eventId,
        acceptedEventId: acceptedEvent && acceptedEvent.eventId
      }),
      gameId: invite.gameId,
      roomId: invite.roomId || null,
      mode: normalizeGameMode(invite.mode),
      gameType: invite.gameType || 'penalty-clash',
      topic: gameTopic(invite.gameId),
      topicHash: gameTopicHash(invite.gameId),
      stake: invite.stake || null,
      stakeHash: invite.stake ? core.deterministicHash(invite.stake) : null,
      prizeMode: invite.prizeMode === true,
      status: 'playing',
      players,
      spectators: [],
      currentRound: 0,
      score,
      inviteId: invite.inviteId,
      inviteEventId: inviteEvent && inviteEvent.eventId,
      acceptedEventId: acceptedEvent && acceptedEvent.eventId,
      sourceEventIds: [inviteEvent && inviteEvent.eventId, acceptedEvent && acceptedEvent.eventId].filter(Boolean),
      startedByUserId: accepted.acceptedByUserId || null,
      createdAt: invite.createdAt || '2026-07-01T00:00:00.000Z',
      startedAt: '2026-07-01T00:00:00.000Z',
      completedAt: null
    }
  }

  function gameSessionStartedMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const inviteEvent = index.byId.get(payload.inviteEventId)
    const acceptedEvent = index.byId.get(payload.acceptedEventId)
    const expected = gameSessionStartPayload({ inviteEvent, acceptedEvent })
    return Boolean(
      inviteEvent &&
      acceptedEvent &&
      inviteEvent.type === 'GameInviteCreated' &&
      acceptedEvent.type === 'GameInviteAccepted' &&
      gameInviteSignerMatches(inviteEvent) &&
      gameInviteAcceptanceMatchesReplay(acceptedEvent, index) &&
      event.actorId === acceptedEvent.actorId &&
      payload.sessionId === expected.sessionId &&
      payload.gameId === expected.gameId &&
      payload.topicHash === expected.topicHash &&
      sameStringList(payload.sourceEventIds, expected.sourceEventIds)
    )
  }

  function gameSessionPlayerIds (session = {}) {
    return (session.players || []).map(player => player.userId).filter(Boolean)
  }

  function gameSessionJoinPayload ({ session, payload = {}, actorId }) {
    const userId = payload.userId || actorId
    const asSpectator = payload.asSpectator === true
    const players = session && session.players || []
    const participant = players.find(player => player.userId === userId)
    const role = asSpectator ? 'spectator' : participant && participant.role || payload.role || 'spectator'
    return {
      joinId: core.deterministicHash({
        type: 'GameSessionJoined',
        gameId: session && session.gameId || payload.gameId,
        userId,
        asSpectator
      }),
      gameId: session && session.gameId || payload.gameId,
      userId,
      username: payload.username || participant && participant.username || userId,
      teamId: payload.teamId || participant && participant.teamId || null,
      avatarRecipe: payload.avatarRecipe || participant && participant.avatarRecipe || null,
      role,
      asSpectator,
      connected: true,
      joinedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function stakeAmount (stake = {}) {
    if (!stake || stake.amount === undefined || stake.amount === null) return null
    const amount = Number(stake.amount)
    return Number.isFinite(amount) ? amount : null
  }

  function stakeAsset (stake = {}) {
    return stake && stake.asset || null
  }

  function gameEscrowHasSessionBinding (escrow = {}) {
    return Boolean(
      escrow.sessionId ||
      escrow.sessionEventId ||
      escrow.sessionHash ||
      Array.isArray(escrow.sourceEventIds) && escrow.sourceEventIds.length > 0 ||
      escrow.stakeHash ||
      escrow.prizeMode === true
    )
  }

  function gameEscrowSessionMatches ({ escrow = {}, sessionEvent }) {
    const session = sessionEvent && sessionEvent.payload || null
    if (!session) return false
    if (escrow.gameId !== session.gameId) return false
    if (escrow.sessionId !== session.sessionId) return false
    if (escrow.sessionEventId !== sessionEvent.eventId) return false
    if (escrow.sessionHash !== core.deterministicHash(session)) return false
    if (!Array.isArray(escrow.sourceEventIds) || !escrow.sourceEventIds.includes(sessionEvent.eventId)) return false
    if (!sameStringList(escrow.players, gameSessionPlayerIds(session))) return false
    if (session.stake) {
      const expectedAmount = stakeAmount(session.stake)
      const expectedAsset = stakeAsset(session.stake)
      if (expectedAmount !== null && Number(escrow.amount) !== expectedAmount) return false
      if (expectedAsset && escrow.asset !== expectedAsset) return false
      if (escrow.stakeHash !== core.deterministicHash(session.stake)) return false
    }
    if (session.prizeMode === true && escrow.prizeMode !== true) return false
    const expected = core.createTetherWdkEscrowIntent({
      gameId: escrow.gameId,
      players: escrow.players,
      amount: escrow.amount,
      asset: escrow.asset,
      rail: escrow.rail,
      rulesVersion: escrow.rulesVersion,
      sessionId: escrow.sessionId,
      sessionEventId: escrow.sessionEventId,
      sessionHash: escrow.sessionHash,
      sourceEventIds: escrow.sourceEventIds,
      stakeHash: escrow.stakeHash,
      prizeMode: escrow.prizeMode
    })
    return escrow.escrowId === expected.escrowId &&
      escrow.status === 'locked'
  }

  function gameEscrowMatchesReplay (event, index) {
    const escrow = event && event.payload || {}
    if (!wdkEscrowSignerMatches(event)) return false
    if (!gameEscrowHasSessionBinding(escrow)) return true
    const sessionEvent = index.byId.get(escrow.sessionEventId)
    if (!sessionEvent || sessionEvent.type !== 'GameSessionStarted') return false
    if (!gameSessionStartedMatchesReplay(sessionEvent, index)) return false
    return gameEscrowSessionMatches({ escrow, sessionEvent })
  }

  function gameSessionJoinMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const startedEvent = findIndexedEvent(index, 'GameSessionStarted', session => session.gameId === payload.gameId)
    const session = startedEvent && startedEvent.payload || null
    const expected = gameSessionJoinPayload({ session, payload, actorId: event && event.actorId })
    const participantIds = new Set(gameSessionPlayerIds(session))
    return Boolean(
      session &&
      gameSessionStartedMatchesReplay(startedEvent, index) &&
      payload.userId &&
      event.actorId === payload.userId &&
      payload.joinId === expected.joinId &&
      (payload.asSpectator === true || participantIds.has(payload.userId))
    )
  }

  function eventRefMatchesReplay (index, ref) {
    if (!ref || !ref.eventId) return false
    const event = index.byId.get(ref.eventId)
    if (!event) return false
    if (ref.type && event.type !== ref.type) return false
    if (ref.actorId && event.actorId !== ref.actorId) return false
    if (ref.payloadHash && ref.payloadHash !== core.deterministicHash(event.payload || null)) return false
    return true
  }

  function previousEventChain (index, previousEventId) {
    const chain = []
    const seen = new Set()
    let eventId = previousEventId || null
    while (eventId) {
      if (seen.has(eventId)) return null
      seen.add(eventId)
      const event = index.byId.get(eventId)
      if (!event) return null
      chain.push(event)
      eventId = event.previousEventId || null
    }
    return chain.reverse()
  }

  function receiptRefs (receipt = {}) {
    const refs = receipt.events || {}
    return [refs.result, refs.attestation, refs.settlement].filter(Boolean)
  }

  function receiptReferencesMatchReplay (receipt, index) {
    const refs = receiptRefs(receipt)
    if (refs.length === 0 && receipt && receipt.completed !== true) return true
    return refs.length === 3 && refs.every(ref => eventRefMatchesReplay(index, ref))
  }

  function receiptEventRootMatchesReplay (event, index) {
    const receipt = event && event.payload
    if (!receipt || !receipt.eventRoot) return false
    const chain = previousEventChain(index, event.previousEventId)
    if (!chain) return false
    const chainIds = new Set(chain.map(item => item.eventId))
    if (!receiptRefs(receipt).every(ref => chainIds.has(ref.eventId))) return false
    return eventRoot(chain) === receipt.eventRoot
  }

  function settlementReceiptMatchesReplay (event, index) {
    const receipt = event && event.payload
    if (!receiptReferencesMatchReplay(receipt, index)) return false
    if (!receiptEventRootMatchesReplay(event, index)) return false
    const receiptTools = getSettlementReceipts()
    if (receiptTools && typeof receiptTools.verifySettlementReceipt === 'function') {
      return receiptTools.verifySettlementReceipt(receipt).ok
    }
    return true
  }

  function verifiedGameReleaseMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const attestationEvent = findIndexedEvent(index, 'QvacRefereeAttestationCreated', attestation => {
      return attestation.attestationId === payload.qvacAttestationId
    })
    const escrowEvent = findIndexedEvent(index, 'TetherWdkEscrowCreated', escrow => {
      return escrow.escrowId === payload.escrowId
    })
    const attestation = attestationEvent && attestationEvent.payload
    const escrow = escrowEvent && escrowEvent.payload
    const roundEvent = attestation && findIndexedEvent(index, 'GameRoundResolved', round => {
      return round.gameId === attestation.gameId && round.roundId === attestation.roundId
    })
    const roundResult = roundEvent && roundEvent.payload
    if (!attestation || !escrow || !roundResult) return false
    if (!qvacAttestationSignerMatches(attestationEvent)) return false
    if (!gameEscrowMatchesReplay(escrowEvent, index)) return false
    if (!wdkSettlementSignerMatches(event)) return false
    if (validGameEscrowRefundEventForEscrow(index, payload.escrowId)) return false
    if (!indexedSourceEventsPresent(index, attestation.sourceEventIds)) return false
    if (!core.verifyQvacRoundAttestation({ roundResult, attestation }).ok) return false
    const expectedPayoutId = core.deterministicHash({
      escrowId: payload.escrowId,
      attestationId: attestation.attestationId,
      winnerUserId: payload.winnerUserId
    })
    return payload.qvacAttestationId === attestation.attestationId &&
      payload.winnerUserId === attestation.winnerUserId &&
      payload.payoutId === expectedPayoutId &&
      payload.amount === escrow.amount &&
      payload.asset === escrow.asset &&
      payload.rail === escrow.rail &&
      escrow.gameId === attestation.gameId &&
      sameStringList(escrow.players, attestation.participantUserIds)
  }

  function gameEscrowRefundMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const escrowEvent = indexedEscrowEventForRefund(index, payload)
    const disputeEvent = validEscrowDisputeEventForRefund(index, payload)
    const escrow = escrowEvent && escrowEvent.payload
    if (!escrow || !disputeEvent) return false
    if (!gameEscrowMatchesReplay(escrowEvent, index)) return false
    if (!wdkSettlementSignerMatches(event)) return false
    if (validEscrowReleaseEventForEscrow(index, payload.escrowId)) return false
    const expected = core.refundTetherWdkEscrow({
      escrow,
      reason: payload.reason,
      processorStatus: payload.processorStatus,
      refundUserIds: payload.refundUserIds
    })
    return payload.refundId === expected.refundId &&
      payload.gameId === escrow.gameId &&
      payload.amount === escrow.amount &&
      payload.amountEach === expected.amountEach &&
      payload.asset === escrow.asset &&
      payload.rail === escrow.rail &&
      payload.rulesVersion === escrow.rulesVersion &&
      payload.status === 'refunded'
  }

  function validGameEscrowRefundEventForEscrow (index, escrowId) {
    return findIndexedEvent(index, 'TetherWdkEscrowRefunded', (refund, event) => {
      const escrowEvent = indexedEscrowEventForRefund(index, refund)
      const disputeEvent = validEscrowDisputeEventForRefund(index, refund)
      const escrow = escrowEvent && escrowEvent.payload
      if (refund.escrowId !== escrowId || !escrow || !disputeEvent) return false
      if (!gameEscrowMatchesReplay(escrowEvent, index)) return false
      if (!wdkSettlementSignerMatches(event)) return false
      const expected = core.refundTetherWdkEscrow({
        escrow,
        reason: refund.reason,
        processorStatus: refund.processorStatus,
        refundUserIds: refund.refundUserIds
      })
      return refund.refundId === expected.refundId &&
        refund.gameId === escrow.gameId &&
        refund.amount === escrow.amount &&
        refund.amountEach === expected.amountEach &&
        refund.asset === escrow.asset &&
        refund.rail === escrow.rail &&
        refund.rulesVersion === escrow.rulesVersion &&
        refund.status === 'refunded'
    })
  }

  function verifiedPoolPayoutMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const attestationEvent = findIndexedEvent(index, 'QvacPoolSettlementAttestationCreated', attestation => {
      return attestation.attestationId === payload.qvacAttestationId &&
        (!payload.poolId || attestation.poolId === payload.poolId)
    })
    const attestation = attestationEvent && attestationEvent.payload
    const poolResultEvent = findIndexedEvent(index, 'BracketPoolSettlementResolved', result => {
      return result.poolId === payload.poolId &&
        (!attestation || result.stateHash === attestation.stateHash)
    })
    const poolResult = poolResultEvent && poolResultEvent.payload
    if (!attestation || !poolResult) return false
    if (!qvacAttestationSignerMatches(attestationEvent)) return false
    if (!wdkSettlementSignerMatches(event)) return false
    if (!indexedSourceEventsPresent(index, attestation.sourceEventIds)) return false
    if (!core.verifyQvacPoolSettlementAttestation({ poolResult, attestation }).ok) return false

    const sourcePaymentIds = Array.isArray(payload.sourcePaymentIds) ? payload.sourcePaymentIds : []
    const paymentEvents = sourcePaymentIds.map(paymentId => {
      return findIndexedEvent(index, 'TetherWdkEntryConfirmed', payment => {
        return payment.paymentId === paymentId && (!payload.poolId || payment.poolId === payload.poolId)
      })
    })
    if (paymentEvents.some(event => !event)) return false
    const validPaymentEvents = paymentEvents.every(event => {
      const payment = event && event.payload || {}
      const intentEvent = findIndexedEvent(index, 'TetherWdkEntryIntentCreated', intent => {
        return intent.intentId === payment.intentId
      })
      return paymentMatchesSignedEntryIntent({ payment, intentEvent }) &&
        entryPaymentSignerMatches({ event, intentEvent })
    })
    if (!validPaymentEvents) return false
    if (paymentEvents.some(event => validEntryRefundEventForPayment(index, event.payload.paymentId, payload.poolId))) return false
    const confirmedEntries = paymentEvents.map(event => event.payload)
    if (confirmedEntries.some(entry => entry.rail !== payload.rail)) return false
    const grossPool = confirmedEntries.reduce((total, entry) => total + Number(entry.amount || 0), 0)
    const winnerUserIds = Array.isArray(payload.winnerUserIds) ? payload.winnerUserIds : []
    const amountEach = winnerUserIds.length ? Number((grossPool / winnerUserIds.length).toFixed(2)) : 0
    const expectedPayoutId = core.deterministicHash({
      poolId: payload.poolId,
      sourcePaymentIds: [...sourcePaymentIds].sort(),
      winnerUserIds: [...winnerUserIds].sort(),
      grossPool,
      attestationId: attestation.attestationId,
      asset: payload.asset,
      rail: payload.rail,
      rulesVersion: payload.rulesVersion
    })
    return payload.qvacAttestationId === attestation.attestationId &&
      sameStringList(winnerUserIds, attestation.winnerUserIds) &&
      sameStringList(winnerUserIds, poolResult.winnerUserIds) &&
      sameStringList(sourcePaymentIds, attestation.sourcePaymentIds) &&
      sameStringList(sourcePaymentIds, poolResult.sourcePaymentIds) &&
      payload.grossPool === grossPool &&
      payload.amountEach === amountEach &&
      payload.payoutId === expectedPayoutId &&
      payload.status === 'prepared'
  }

  function settlementEventDependenciesSatisfied (event, index) {
    if (!event || !index) return false

    if (event.type === 'MatchEventIngested') {
      return matchEventSignerMatches(event)
    }

    if (event.type === 'CommentaryGenerated') {
      return commentarySegmentMatchesReplay(event, index)
    }

    if (event.type === 'ProfileUpdated') {
      return profileMatchesReplay(event)
    }

    if (event.type === 'BracketDraftUpdated') {
      return bracketDraftMatchesReplay(event)
    }

    if (event.type === 'RoomJoined') {
      return roomJoinMatchesReplay(event)
    }

    if (event.type === 'RoomLeft') {
      return roomLeaveMatchesReplay(event, index)
    }

    if (event.type === 'ChatMessageSent') {
      return chatMessageMatchesReplay(event, index)
    }

    if (event.type === 'VoiceStateUpdated') {
      return voiceStateMatchesReplay(event, index)
    }

    if (event.type === 'StreamStarted') {
      return streamStartMatchesReplay(event, index)
    }

    if (event.type === 'StreamStopped') {
      return streamStopMatchesReplay(event, index)
    }

    if (event.type === 'GameInviteCreated') {
      return gameInviteSignerMatches(event)
    }

    if (event.type === 'GameInviteAccepted') {
      return gameInviteAcceptanceMatchesReplay(event, index)
    }

    if (event.type === 'GameSessionStarted') {
      return gameSessionStartedMatchesReplay(event, index)
    }

    if (event.type === 'GameSessionJoined') {
      return gameSessionJoinMatchesReplay(event, index)
    }

    if (event.type === 'QvacRefereeAttestationCreated' || event.type === 'QvacPoolSettlementAttestationCreated') {
      return qvacAttestationSignerMatches(event)
    }

    if (event.type === 'TetherWdkEscrowCreated') {
      return gameEscrowMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkEntryPaymentPending') {
      return entryPaymentCheckMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkEntryRefunded') {
      return entryRefundMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkEscrowReleased') {
      return verifiedGameReleaseMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkEscrowRefunded') {
      return gameEscrowRefundMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkPoolPayoutPrepared') {
      return verifiedPoolPayoutMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkEscrowDisputed' || event.type === 'TetherWdkPoolPayoutDisputed') {
      return wdkDisputeSignerMatches(event)
    }

    if (event.type === 'SettlementReceiptCreated') {
      return settlementReceiptMatchesReplay(event, index)
    }

    return true
  }

  function createView (events) {
    const view = {
      events,
      profiles: {},
      profilesByTeam: {},
      bracketDrafts: {},
      bracketDraftsByPool: {},
      matchEvents: {},
      matchEventsByMatch: {},
      statSnapshots: {},
      commentarySegments: {},
      commentaryByMatchLanguage: {},
      commentaryLanguages: {},
      commentaryRejections: [],
      rooms: {},
      roomsByMatch: {},
      roomParticipants: {},
      chatMessages: {},
      chatMessagesByRoom: {},
      voiceStates: {},
      voiceStatesByRoom: {},
      streams: {},
      activeStreams: {},
      activeStreamsByRoom: {},
      gameInvites: {},
      openGameInvites: {},
      gameInviteAcceptances: {},
      gameSessions: {},
      gameSessionsByRoom: {},
      gameSessionTopics: {},
      gameParticipants: {},
      gameSpectators: {},
      activeGameSessions: {},
      commitments: {},
      reveals: {},
      roundStateHashes: {},
      roundStateHashEvents: {},
      forfeitRecords: {},
      forfeitRecordEvents: {},
      roundResults: {},
      attestations: {},
      escrows: {},
      escrowsByGame: {},
      escrowsBySession: {},
      payouts: {},
      escrowRefunds: {},
      escrowRefundsByEscrow: {},
      entryIntents: {},
      entryPayments: {},
      entryPaymentsByIntent: {},
      entryPaymentChecks: {},
      entryPaymentChecksByIntent: {},
      entryRefunds: {},
      entryRefundsByPayment: {},
      entryRefundsByIntent: {},
      bracketSubmissions: {},
      bracketSubmissionsByPool: {},
      officialResultsSnapshots: {},
      officialResultsSnapshotEvents: {},
      payoutRecipientDeclarations: {},
      payoutRecipientDeclarationsByPool: {},
      poolResults: {},
      poolAttestations: {},
      poolPayouts: {},
      settlementReceipts: {},
      settlementReceiptEvents: {},
      settlementReceiptsBySettlementEvent: {},
      settlementReceiptEventsBySettlementEvent: {},
      settlementReceiptRejections: [],
      disputes: [],
      eventRoot: eventRoot(events),
      typeCounts: typeCounts(events)
    }

    const replayIndex = eventIndex(events)
    for (const event of events) {
      const payload = event.payload
      if (event.type === 'MatchEventIngested') {
        if (!matchEventSignerMatches(event)) continue
        const matchPayload = {
          ...payload,
          sourceEventId: event.eventId
        }
        view.matchEvents[payload.eventId] = matchPayload
        if (!view.matchEventsByMatch[payload.matchId]) view.matchEventsByMatch[payload.matchId] = []
        view.matchEventsByMatch[payload.matchId].push(matchPayload)
      }
      if (event.type === 'CommentaryLanguageSelected') {
        const language = normalizeLanguage(payload.language)
        view.commentaryLanguages[payload.matchId] = language
      }
      if (event.type === 'CommentaryGenerated') {
        if (!commentarySegmentMatchesReplay(event, replayIndex)) continue
        view.commentarySegments[payload.segmentId] = payload
        const key = `${payload.matchId}:${payload.language}`
        if (!view.commentaryByMatchLanguage[key]) view.commentaryByMatchLanguage[key] = []
        view.commentaryByMatchLanguage[key].push(payload)
      }
      if (event.type === 'CommentaryRejected') {
        view.commentaryRejections.push(payload)
      }
      if (event.type === 'ProfileUpdated') {
        if (!profileMatchesReplay(event)) continue
        view.profiles[payload.userId] = payload
        if (payload.teamId) {
          if (!view.profilesByTeam[payload.teamId]) view.profilesByTeam[payload.teamId] = {}
          view.profilesByTeam[payload.teamId][payload.userId] = payload
        }
      }
      if (event.type === 'BracketDraftUpdated') {
        if (!bracketDraftMatchesReplay(event)) continue
        const key = `${payload.poolId}:${payload.userId}`
        view.bracketDrafts[key] = payload
        if (!view.bracketDraftsByPool[payload.poolId]) view.bracketDraftsByPool[payload.poolId] = {}
        view.bracketDraftsByPool[payload.poolId][payload.userId] = payload
      }
      if (event.type === 'RoomJoined') {
        if (!roomJoinMatchesReplay(event)) continue
        view.rooms[payload.roomId] = {
          roomId: payload.roomId,
          matchId: payload.matchId,
          topic: payload.topic,
          topicHash: payload.topicHash
        }
        if (!view.roomsByMatch[payload.matchId]) view.roomsByMatch[payload.matchId] = {}
        view.roomsByMatch[payload.matchId][payload.roomId] = view.rooms[payload.roomId]
        if (!view.roomParticipants[payload.roomId]) view.roomParticipants[payload.roomId] = {}
        view.roomParticipants[payload.roomId][payload.userId] = payload
      }
      if (event.type === 'RoomLeft') {
        if (!roomLeaveMatchesReplay(event, replayIndex)) continue
        if (view.roomParticipants[payload.roomId]) delete view.roomParticipants[payload.roomId][payload.userId]
        if (view.voiceStatesByRoom[payload.roomId]) delete view.voiceStatesByRoom[payload.roomId][payload.userId]
      }
      if (event.type === 'ChatMessageSent') {
        if (!chatMessageMatchesReplay(event, replayIndex)) continue
        view.chatMessages[payload.messageId] = payload
        if (!view.chatMessagesByRoom[payload.roomId]) view.chatMessagesByRoom[payload.roomId] = []
        view.chatMessagesByRoom[payload.roomId].push(payload)
      }
      if (event.type === 'VoiceStateUpdated') {
        if (!voiceStateMatchesReplay(event, replayIndex)) continue
        const key = `${payload.roomId}:${payload.userId}`
        view.voiceStates[key] = payload
        if (!view.voiceStatesByRoom[payload.roomId]) view.voiceStatesByRoom[payload.roomId] = {}
        view.voiceStatesByRoom[payload.roomId][payload.userId] = payload
      }
      if (event.type === 'StreamStarted') {
        if (!streamStartMatchesReplay(event, replayIndex)) continue
        view.streams[payload.streamId] = payload
        view.activeStreams[payload.streamId] = payload
        view.activeStreamsByRoom[payload.roomId] = payload
      }
      if (event.type === 'StreamStopped') {
        if (!streamStopMatchesReplay(event, replayIndex)) continue
        const stream = view.streams[payload.streamId]
        if (stream) view.streams[payload.streamId] = { ...stream, status: 'stopped', stoppedAt: payload.stoppedAt }
        delete view.activeStreams[payload.streamId]
        if (view.activeStreamsByRoom[payload.roomId] && view.activeStreamsByRoom[payload.roomId].streamId === payload.streamId) {
          delete view.activeStreamsByRoom[payload.roomId]
        }
      }
      if (event.type === 'GameInviteCreated') {
        if (!gameInviteSignerMatches(event)) continue
        view.gameInvites[payload.gameId] = payload
        view.openGameInvites[payload.gameId] = payload
        view.gameSessionTopics[payload.gameId] = payload.topicHash
      }
      if (event.type === 'GameInviteAccepted') {
        if (!gameInviteAcceptanceMatchesReplay(event, replayIndex)) continue
        view.gameInviteAcceptances[payload.gameId] = payload
        delete view.openGameInvites[payload.gameId]
      }
      if (event.type === 'GameSessionStarted') {
        if (!gameSessionStartedMatchesReplay(event, replayIndex)) continue
        const session = cloneValue(payload)
        view.gameSessions[payload.gameId] = session
        view.activeGameSessions[payload.gameId] = session
        view.gameSessionTopics[payload.gameId] = payload.topicHash
        if (payload.roomId) {
          if (!view.gameSessionsByRoom[payload.roomId]) view.gameSessionsByRoom[payload.roomId] = {}
          view.gameSessionsByRoom[payload.roomId][payload.gameId] = session
        }
        view.gameParticipants[payload.gameId] = {}
        for (const player of payload.players || []) {
          if (player.userId) view.gameParticipants[payload.gameId][player.userId] = player
        }
        view.gameSpectators[payload.gameId] = {}
      }
      if (event.type === 'GameSessionJoined') {
        if (!gameSessionJoinMatchesReplay(event, replayIndex)) continue
        const session = view.gameSessions[payload.gameId]
        if (!session) continue
        if (!view.gameParticipants[payload.gameId]) view.gameParticipants[payload.gameId] = {}
        if (!view.gameSpectators[payload.gameId]) view.gameSpectators[payload.gameId] = {}
        if (payload.asSpectator) {
          view.gameSpectators[payload.gameId][payload.userId] = payload
          if (!session.spectators.includes(payload.userId)) session.spectators.push(payload.userId)
        } else {
          view.gameParticipants[payload.gameId][payload.userId] = payload
          session.players = session.players.map(player => {
            return player.userId === payload.userId ? { ...player, ...payload, role: player.role } : player
          })
        }
      }
      if (event.type === 'GameCommitmentSubmitted') {
        const key = `${payload.gameId}:${payload.roundId}:${payload.playerId}`
        view.commitments[key] = payload
      }
      if (event.type === 'GameInputRevealed') {
        const key = `${payload.gameId}:${payload.roundId}:${payload.playerId}`
        view.reveals[key] = payload
      }
      if (event.type === 'GameRoundStateHashSubmitted') {
        const key = `${payload.gameId}:${payload.roundId}:${payload.playerId}`
        view.roundStateHashes[key] = payload
        view.roundStateHashEvents[key] = event
      }
      if (event.type === 'GameRoundForfeitRecorded') {
        const key = `${payload.gameId}:${payload.roundId}`
        view.forfeitRecords[key] = payload
        view.forfeitRecordEvents[key] = event
      }
      if (event.type === 'GameRoundResolved') {
        view.roundResults[`${payload.gameId}:${payload.roundId}`] = payload
      }
      if (event.type === 'QvacRefereeAttestationCreated') {
        if (!qvacAttestationSignerMatches(event)) continue
        view.attestations[`${payload.gameId}:${payload.roundId}`] = payload
      }
      if (event.type === 'TetherWdkEscrowCreated') {
        if (!gameEscrowMatchesReplay(event, replayIndex)) continue
        view.escrows[payload.escrowId] = payload
        if (payload.gameId) view.escrowsByGame[payload.gameId] = payload
        if (payload.sessionId) view.escrowsBySession[payload.sessionId] = payload
      }
      if (event.type === 'TetherWdkEscrowReleased') {
        if (!wdkSettlementSignerMatches(event)) continue
        view.payouts[payload.payoutId] = payload
      }
      if (event.type === 'TetherWdkEscrowRefunded') {
        if (!gameEscrowRefundMatchesReplay(event, replayIndex)) continue
        view.escrowRefunds[payload.refundId] = payload
        view.escrowRefundsByEscrow[payload.escrowId] = payload
      }
      if (event.type === 'TetherWdkEntryIntentCreated') {
        if (!entryIntentSignerMatches(event)) continue
        view.entryIntents[payload.intentId] = payload
      }
      if (event.type === 'TetherWdkEntryConfirmed') {
        const intentEvent = events.find(item =>
          item.type === 'TetherWdkEntryIntentCreated' &&
          item.payload &&
          item.payload.intentId === payload.intentId)
        if (!paymentMatchesSignedEntryIntent({ payment: payload, intentEvent })) continue
        if (!entryPaymentSignerMatches({ event, intentEvent })) continue
        if (validEntryRefundEventForPayment(replayIndex, payload.paymentId, payload.poolId)) continue
        view.entryPayments[payload.paymentId] = payload
        view.entryPaymentsByIntent[payload.intentId] = payload
      }
      if (event.type === 'TetherWdkEntryPaymentPending') {
        const intentEvent = events.find(item =>
          item.type === 'TetherWdkEntryIntentCreated' &&
          item.payload &&
          item.payload.intentId === payload.intentId)
        if (!entryPaymentCheckMatchesSignedEntryIntent({ check: payload, intentEvent })) continue
        if (!entryPaymentCheckSignerMatches({ event, intentEvent })) continue
        view.entryPaymentChecks[payload.checkId] = payload
        if (payload.intentId) view.entryPaymentChecksByIntent[payload.intentId] = payload
      }
      if (event.type === 'TetherWdkEntryRefunded') {
        if (!entryRefundMatchesReplay(event, replayIndex)) continue
        view.entryRefunds[payload.refundId] = payload
        view.entryRefundsByPayment[payload.paymentId] = payload
        if (payload.intentId) view.entryRefundsByIntent[payload.intentId] = payload
        delete view.entryPayments[payload.paymentId]
        if (payload.intentId) delete view.entryPaymentsByIntent[payload.intentId]
      }
      if (event.type === 'BracketSubmissionLocked') {
        if (!bracketSubmissionSignerMatches(event)) continue
        view.bracketSubmissions[payload.submissionId] = payload
        if (!view.bracketSubmissionsByPool[payload.poolId]) view.bracketSubmissionsByPool[payload.poolId] = {}
        view.bracketSubmissionsByPool[payload.poolId][payload.userId] = payload
      }
      if (event.type === 'OfficialResultsSnapshotRecorded') {
        if (!officialResultsSnapshotSignerMatches(event)) continue
        view.officialResultsSnapshots[payload.poolId] = payload
        view.officialResultsSnapshotEvents[payload.poolId] = event
      }
      if (event.type === 'PayoutRecipientDeclared') {
        if (!payoutRecipientSignerMatches(event)) continue
        const key = `${payload.poolId}:${payload.userId}`
        view.payoutRecipientDeclarations[key] = payload
        if (!view.payoutRecipientDeclarationsByPool[payload.poolId]) view.payoutRecipientDeclarationsByPool[payload.poolId] = {}
        view.payoutRecipientDeclarationsByPool[payload.poolId][payload.userId] = payload
      }
      if (event.type === 'BracketPoolSettlementResolved') {
        view.poolResults[payload.poolId] = payload
      }
      if (event.type === 'QvacPoolSettlementAttestationCreated') {
        if (!qvacAttestationSignerMatches(event)) continue
        view.poolAttestations[payload.poolId] = payload
      }
      if (event.type === 'TetherWdkPoolPayoutPrepared') {
        if (!wdkSettlementSignerMatches(event)) continue
        view.poolPayouts[payload.payoutId] = payload
      }
      if (event.type === 'SettlementReceiptCreated') {
        view.settlementReceipts[payload.receiptId] = payload
        view.settlementReceiptEvents[payload.receiptId] = event
        const settlementEventId = payload.events && payload.events.settlement && payload.events.settlement.eventId
        if (settlementEventId) {
          view.settlementReceiptsBySettlementEvent[settlementEventId] = payload
          view.settlementReceiptEventsBySettlementEvent[settlementEventId] = event
        }
      }
      if (event.type === 'SettlementReceiptRejected') {
        view.settlementReceiptRejections.push(payload)
      }
      if (event.type === 'GameSessionDisputed') {
        view.disputes.push(payload)
        if (payload.gameId && view.gameSessions[payload.gameId]) {
          view.gameSessions[payload.gameId].status = 'disputed'
          delete view.activeGameSessions[payload.gameId]
        }
      }
      if (event.type === 'TetherWdkEscrowDisputed' || event.type === 'TetherWdkPoolPayoutDisputed') {
        if (!wdkDisputeSignerMatches(event)) continue
        view.disputes.push(payload)
      }
    }

    for (const [matchId, matchEvents] of Object.entries(view.matchEventsByMatch)) {
      view.statSnapshots[matchId] = statSnapshotForEvents(matchId, matchEvents)
    }

    for (const session of Object.values(view.gameSessions)) {
      session.score = (session.players || []).reduce((score, player) => {
        if (player.userId) score[player.userId] = 0
        return score
      }, {})
      session.currentRound = 0
    }
    const roundResults = Object.values(view.roundResults).sort((left, right) => {
      if (left.gameId !== right.gameId) return String(left.gameId).localeCompare(String(right.gameId))
      return String(left.roundId).localeCompare(String(right.roundId))
    })
    for (const roundResult of roundResults) {
      const session = view.gameSessions[roundResult.gameId]
      if (!session) continue
      const winnerUserId = core.winnerUserIdForRoundResult(roundResult)
      if (winnerUserId) session.score[winnerUserId] = (session.score[winnerUserId] || 0) + 1
      const roundIndex = roundIndexFromRoundId(roundResult.roundId)
      if (roundIndex !== null) session.currentRound = Math.max(session.currentRound, roundIndex + 1)
      if (roundResult.outcome === 'disputed') {
        session.status = 'disputed'
        delete view.activeGameSessions[roundResult.gameId]
      }
    }

    return view
  }

  function mergeUniqueEvents (target, incomingEvents, opts = {}) {
    let merged = 0
    const candidates = []
    const seenEventIds = new Set(target.map(event => event.eventId))
    for (const event of incomingEvents || []) {
      if (!event || !event.eventId || seenEventIds.has(event.eventId)) continue
      if (opts.validate !== false && !validateEventEnvelope(event).ok) continue
      candidates.push(event)
      seenEventIds.add(event.eventId)
    }
    const dependencyIndex = eventIndex([...target, ...candidates])
    for (const event of candidates) {
      if (!settlementEventDependenciesSatisfied(event, dependencyIndex)) continue
      target.push(event)
      if (opts.mergedEvents) opts.mergedEvents.push(event)
      merged++
    }
    return merged
  }

  function roundIdFromIndex (roundIndex) {
    return `pc-${roundIndex + 1}`
  }

  function roundIndexFromRoundId (roundId) {
    const match = /^pc-([1-9]\d*)$/.exec(String(roundId || ''))
    return match ? Number(match[1]) - 1 : null
  }

  function normalizeRoundIdentity (payload = {}) {
    const explicitRoundId = payload.roundId == null ? null : String(payload.roundId)
    const hasRoundIndex = payload.roundIndex !== undefined && payload.roundIndex !== null
    const parsedRoundIndex = explicitRoundId ? roundIndexFromRoundId(explicitRoundId) : null

    if (explicitRoundId && parsedRoundIndex === null) {
      return {
        ok: false,
        roundId: explicitRoundId,
        roundIndex: hasRoundIndex ? payload.roundIndex : null,
        expectedRoundId: null,
        reason: `roundId ${explicitRoundId} must use pc-N format`
      }
    }

    if (hasRoundIndex && (!Number.isInteger(payload.roundIndex) || payload.roundIndex < 0)) {
      return {
        ok: false,
        roundId: explicitRoundId,
        roundIndex: payload.roundIndex,
        expectedRoundId: null,
        reason: 'roundIndex must be a non-negative integer'
      }
    }

    const roundIndex = hasRoundIndex ? payload.roundIndex : parsedRoundIndex
    if (roundIndex === null) {
      return {
        ok: false,
        roundId: explicitRoundId,
        roundIndex: null,
        expectedRoundId: null,
        reason: 'roundIndex or roundId is required'
      }
    }

    const expectedRoundId = roundIdFromIndex(roundIndex)
    if (explicitRoundId && explicitRoundId !== expectedRoundId) {
      return {
        ok: false,
        roundId: explicitRoundId,
        roundIndex,
        expectedRoundId,
        reason: `roundId ${explicitRoundId} does not match roundIndex ${roundIndex} (${expectedRoundId})`
      }
    }

    return {
      ok: true,
      roundId: explicitRoundId || expectedRoundId,
      roundIndex,
      expectedRoundId
    }
  }

  function createWorkerSim ({ events = [], adapters = adapterFactory.createIntegrationAdapters(), storage } = {}) {
    const storedEvents = storage && typeof storage.readEvents === 'function' ? storage.readEvents() : []
    const log = []
    mergeUniqueEvents(log, storedEvents)
    const providedEvents = []
    mergeUniqueEvents(log, events, { mergedEvents: providedEvents })
    if (storage && typeof storage.appendEvents === 'function' && providedEvents.length > 0) storage.appendEvents(providedEvents)

    function hasEvent (eventId) {
      return log.some(event => event.eventId === eventId)
    }

    function mergeEvents (incomingEvents) {
      const mergedEvents = []
      mergeUniqueEvents(log, incomingEvents, { mergedEvents })
      if (storage && typeof storage.appendEvents === 'function' && mergedEvents.length > 0) storage.appendEvents(mergedEvents)
      return mergedEvents.length
    }

    function append (type, payload, actorId = 'system') {
      const event = eventEnvelope({
        type,
        actorId,
        payload,
        previousEventId: log.length ? log[log.length - 1].eventId : null,
        sequence: log.length + 1
      })
      log.push(event)
      if (storage && typeof storage.appendEvents === 'function') storage.appendEvents([event])
      return event
    }

    function isPromiseLike (value) {
      return value && typeof value.then === 'function'
    }

    function completeAdapterResult (value, mapResult, awaitAdapters) {
      if (!isPromiseLike(value)) return mapResult(value)
      if (!awaitAdapters) throw new Error('Async adapter result received; use dispatchAsync')
      return value.then(mapResult)
    }

    function attemptAdapterResult (createValue, mapResult, mapError, awaitAdapters) {
      try {
        const value = createValue()
        if (!isPromiseLike(value)) return mapResult(value)
        if (!awaitAdapters) throw new Error('Async adapter result received; use dispatchAsync')
        return value.then(mapResult, mapError)
      } catch (error) {
        if (mapError) return mapError(error)
        throw error
      }
    }

    function assertAdapterCanRun (adapter, methodName, awaitAdapters) {
      const method = adapter && adapter[methodName]
      const methodIsAsync = method && method.constructor && method.constructor.name === 'AsyncFunction'
      if (!awaitAdapters && (adapter && adapter.async === true || methodIsAsync)) {
        throw new Error('Async adapter configured; use dispatchAsync')
      }
    }

    function adapterActorId (adapter, fallback) {
      return adapter && adapter.id || fallback
    }

    function qvacCommandActorId (payload = {}, fallback = 'qvac-ref') {
      return payload.qvacActorId || adapterActorId(adapters.qvac, fallback)
    }

    function qvacCommentaryCommandActorId (payload = {}, fallback = 'qvac-commentary') {
      return payload.qvacCommentaryActorId || adapterActorId(adapters.qvacCommentary, fallback)
    }

    function tetherWdkCommandActorId (payload = {}, fallback = 'tether-wdk') {
      return payload.wdkActorId || adapterActorId(adapters.tetherWdk, fallback)
    }

    function findEvent (type, predicate) {
      return log.find(event => event.type === type && (!predicate || predicate(event.payload, event)))
    }

    function findLatestEvent (type, predicate) {
      for (let index = log.length - 1; index >= 0; index--) {
        const event = log[index]
        if (event.type === type && (!predicate || predicate(event.payload, event))) return event
      }
      return null
    }

    function processorStatusFor (payload = {}) {
      const processor = payload.processorRelease || payload.processorPayout
      return processor && processor.status || payload.status || null
    }

    function isRecipientRequiredSettlement (event) {
      return Boolean(event && event.payload && processorStatusFor(event.payload) === 'recipient-required')
    }

    function appendCommentaryRejected ({ payload = {}, reason, actorId }) {
      return append('CommentaryRejected', {
        matchId: payload.matchId || null,
        language: normalizeLanguage(payload.language),
        reason,
        status: 'rejected'
      }, actorId)
    }

    function commentaryCacheKeyFor ({ matchId, language, sourceEventIds = [], tone = 'broadcast' }) {
      return core.deterministicHash({
        matchId,
        language: normalizeLanguage(language),
        sourceEventIds,
        tone
      })
    }

    function recentMatchEventsForCommentary ({ matchId, current, windowSize = 6 }) {
      const events = current.matchEventsByMatch[matchId] || []
      return events.slice(Math.max(0, events.length - windowSize))
    }

    function commentaryInputForPayload (payload, current) {
      const matchId = payload.matchId || null
      const language = normalizeLanguage(payload.language || current.commentaryLanguages[matchId] || 'EN')
      const recentEvents = recentMatchEventsForCommentary({
        matchId,
        current,
        windowSize: Number.isInteger(payload.windowSize) ? payload.windowSize : 6
      })
      const currentStats = current.statSnapshots[matchId] || statSnapshotForEvents(matchId, recentEvents)
      return {
        matchId,
        language,
        clock: payload.clock || currentStats.clock,
        score: currentStats.score,
        recentEvents,
        currentStats,
        roomPickDistribution: payload.roomPickDistribution || {},
        tone: payload.tone || 'broadcast'
      }
    }

    function findExistingCommentaryEvent ({ matchId, language, sourceEventIds, tone }) {
      const cacheKey = commentaryCacheKeyFor({ matchId, language, sourceEventIds, tone })
      return findLatestEvent('CommentaryGenerated', segment => segment.cacheKey === cacheKey)
    }

    function appendVerifiedCommentarySegment ({ segment, input, actorId }) {
      const language = normalizeLanguage(input.language)
      const sourceEventIds = input.recentEvents.map(event => event.sourceEventId || event.workerEventId || event.eventId)
      const basePayload = {
        matchId: input.matchId,
        language,
        clock: segment && segment.clock || input.clock || '00:00',
        text: String(segment && segment.text || '').trim().slice(0, 360),
        sourceEventIds,
        eventHash: core.deterministicHash(sourceEventIds),
        statHash: segment && segment.statHash || core.deterministicHash(input.currentStats || null),
        confidence: Math.max(0, Math.min(1, Number(segment && segment.confidence) || 0)),
        modelId: segment && segment.modelId || null,
        commentatorId: actorId,
        cacheKey: commentaryCacheKeyFor({
          matchId: input.matchId,
          language,
          sourceEventIds,
          tone: input.tone
        }),
        createdAt: segment && segment.createdAt || '2026-07-01T00:00:00.000Z'
      }
      const payload = {
        segmentId: core.deterministicHash(basePayload),
        ...basePayload
      }
      const event = { payload, actorId: payload.commentatorId }
      if (!payload.text) {
        return appendCommentaryRejected({
          payload: input,
          reason: 'QVAC commentary text is required',
          actorId
        })
      }
      if (!commentarySegmentMatchesReplay(event, eventIndex(log))) {
        return appendCommentaryRejected({
          payload: input,
          reason: 'QVAC commentary output must reference replayed match events',
          actorId
        })
      }
      return append('CommentaryGenerated', payload, payload.commentatorId)
    }

    function winnerRoutesAvailable ({ winnerUserIds = [], payoutRecipients = {}, payoutAddress } = {}) {
      const winners = Array.isArray(winnerUserIds) ? winnerUserIds.filter(Boolean) : []
      if (winners.length === 0) return false
      if (payoutAddress) return true
      return winners.every(userId => payoutRecipients && payoutRecipients[userId])
    }

    function winnerFromRoundResult (roundResult) {
      if (!roundResult) return null
      if (core.winnerUserIdForRoundResult) return core.winnerUserIdForRoundResult(roundResult)
      if (roundResult.outcome === 'goal') return roundResult.shooter && roundResult.shooter.id
      return roundResult.keeper && roundResult.keeper.id
    }

    function sameStringList (left = [], right = []) {
      if (!Array.isArray(left) || !Array.isArray(right)) return false
      const sortedLeft = left.map(item => String(item)).sort()
      const sortedRight = right.map(item => String(item)).sort()
      return sortedLeft.length === sortedRight.length && sortedLeft.every((item, index) => item === sortedRight[index])
    }

    function participantUserIdsForRoundResult (roundResult) {
      return core.participantUserIdsForRoundResult
        ? core.participantUserIdsForRoundResult(roundResult)
        : [
            roundResult && roundResult.shooter && roundResult.shooter.id,
            roundResult && roundResult.keeper && roundResult.keeper.id
          ].filter(Boolean)
    }

    function playerEvidenceSignerMatches (event) {
      const payload = event && event.payload || {}
      return Boolean(payload.playerId && event.actorId === payload.playerId)
    }

    function playerEvidenceSignerMismatchReason ({ evidenceType, actorId, playerId }) {
      return `${evidenceType} actorId must match playerId ${playerId || 'unknown-player'} (received ${actorId || 'unknown-actor'})`
    }

    function appendPlayerEvidenceSignerDispute ({ payload = {}, actorId, evidenceType }) {
      return append('GameSessionDisputed', {
        gameId: payload.gameId || null,
        roundId: payload.roundId || null,
        playerId: payload.playerId || null,
        reason: playerEvidenceSignerMismatchReason({
          evidenceType,
          actorId,
          playerId: payload.playerId
        }),
        status: 'held'
      }, actorId)
    }

    function forfeitClaimSignerMatches ({ actorId, claimantUserId, winnerUserId, forfeitingPlayerId }) {
      return Boolean(claimantUserId && actorId === claimantUserId && claimantUserId === winnerUserId && claimantUserId !== forfeitingPlayerId)
    }

    function forfeitClaimSignerMismatchReason ({ actorId, claimantUserId }) {
      return `Forfeit claim must be signed by winning claimant ${claimantUserId || 'unknown-claimant'} (received ${actorId || 'unknown-actor'})`
    }

    function verifyEscrowReleaseTarget ({ escrow, roundResult, attestation, winnerUserId }) {
      const errors = []
      if (!escrow) errors.push('Escrow is required before WDK release')
      if (!roundResult) errors.push('Round result is required before WDK release')
      if (!attestation) errors.push('QVAC attestation is required before WDK release')
      if (!escrow || !roundResult) return { ok: errors.length === 0, errors }

      if (escrow.gameId !== roundResult.gameId) errors.push('Escrow gameId does not match round result')
      const expectedWinnerUserId = winnerFromRoundResult(roundResult)
      if (winnerUserId !== expectedWinnerUserId) errors.push('Winner must match QVAC-decided round outcome')
      const expectedParticipants = participantUserIdsForRoundResult(roundResult)
      if (!sameStringList(escrow.players, expectedParticipants)) errors.push('Escrow players do not match round participants')
      if (attestation && attestation.winnerUserId && attestation.winnerUserId !== winnerUserId) {
        errors.push('Winner must match QVAC attestation winner')
      }
      if (attestation && Array.isArray(attestation.participantUserIds) && attestation.participantUserIds.length > 0 && !sameStringList(attestation.participantUserIds, escrow.players)) {
        errors.push('Escrow players must match QVAC attestation participants')
      }

      return { ok: errors.length === 0, errors }
    }

    function samePayloadEvidence (left, right) {
      if (!left || !right) return false
      return core.deterministicHash(left) === core.deterministicHash(right)
    }

    function verifyLoggedRoundAttestation ({ gameId, roundId, attestation }) {
      const errors = []
      if (!attestation) return { ok: false, errors: ['QVAC attestation is required before WDK release'] }
      const event = findEvent('QvacRefereeAttestationCreated', item =>
        item.gameId === gameId &&
        item.roundId === roundId &&
        item.attestationId === attestation.attestationId)
      if (!event) {
        errors.push('QVAC attestation event must be present in the worker log before WDK release')
      } else if (!samePayloadEvidence(event.payload, attestation)) {
        errors.push('WDK release attestation must match the replayed QVAC event payload')
      } else if (!qvacAttestationSignerMatches(event)) {
        errors.push(qvacAttestationSignerMismatchReason({
          actorId: event.actorId,
          refereeId: event.payload && event.payload.refereeId
        }))
      }
      return { ok: errors.length === 0, errors }
    }

    function verifyLoggedPoolAttestation ({ poolId, attestation }) {
      const errors = []
      if (!attestation) return { ok: false, errors: ['QVAC pool attestation is required before WDK payout'] }
      const event = findEvent('QvacPoolSettlementAttestationCreated', item =>
        item.poolId === poolId &&
        item.attestationId === attestation.attestationId)
      if (!event) {
        errors.push('QVAC pool attestation event must be present in the worker log before WDK payout')
      } else if (!samePayloadEvidence(event.payload, attestation)) {
        errors.push('WDK pool payout attestation must match the replayed QVAC event payload')
      } else if (!qvacAttestationSignerMatches(event)) {
        errors.push(qvacAttestationSignerMismatchReason({
          actorId: event.actorId,
          refereeId: event.payload && event.payload.refereeId
        }))
      }
      return { ok: errors.length === 0, errors }
    }

    function roundEvidenceEvents ({ gameId, roundId, shooter, keeper } = {}) {
      const shooterId = shooter && shooter.id
      const keeperId = keeper && keeper.id
      return {
        shooterCommitmentEvent: findEvent('GameCommitmentSubmitted', (item, event) => item.gameId === gameId && item.roundId === roundId && item.playerId === shooterId && playerEvidenceSignerMatches(event)),
        keeperCommitmentEvent: findEvent('GameCommitmentSubmitted', (item, event) => item.gameId === gameId && item.roundId === roundId && item.playerId === keeperId && playerEvidenceSignerMatches(event)),
        shooterRevealEvent: findEvent('GameInputRevealed', (item, event) => item.gameId === gameId && item.roundId === roundId && item.playerId === shooterId && playerEvidenceSignerMatches(event)),
        keeperRevealEvent: findEvent('GameInputRevealed', (item, event) => item.gameId === gameId && item.roundId === roundId && item.playerId === keeperId && playerEvidenceSignerMatches(event))
      }
    }

    function roundStateHashEvents ({ gameId, roundId, participantUserIds = [] } = {}) {
      const participants = new Set((participantUserIds || []).filter(Boolean))
      return log.filter(event => {
        const payload = event.payload || {}
        return event.type === 'GameRoundStateHashSubmitted' &&
          payload.gameId === gameId &&
          payload.roundId === roundId &&
          (!participants.size || participants.has(payload.playerId))
      })
    }

    function verifyRoundStateHashConsensus ({ gameId, roundId, participantUserIds = [], stateHash, resolverVersion }) {
      const errors = []
      const participants = new Set((participantUserIds || []).filter(Boolean))
      const events = roundStateHashEvents({ gameId, roundId })
      const submittedBy = new Set()
      if (participants.size === 0) errors.push('Round participants are required before peer state hash consensus')
      for (const event of events) {
        const payload = event.payload || {}
        if (!participants.has(payload.playerId)) errors.push(`Peer state hash submitted by non-participant ${payload.playerId || 'unknown-player'}`)
        if (payload.playerId && event.actorId !== payload.playerId) {
          errors.push(playerEvidenceSignerMismatchReason({
            evidenceType: 'Peer state hash',
            actorId: event.actorId,
            playerId: payload.playerId
          }))
        }
        if (payload.playerId && event.actorId === payload.playerId) submittedBy.add(payload.playerId)
        if (payload.stateHash !== stateHash) errors.push(`Peer state hash mismatch for ${payload.playerId || 'unknown-player'}`)
        if (payload.resolverVersion && payload.resolverVersion !== resolverVersion) {
          errors.push(`Peer state hash resolverVersion mismatch for ${payload.playerId || 'unknown-player'}`)
        }
      }
      for (const playerId of participants) {
        if (!submittedBy.has(playerId)) errors.push(`Peer state hash missing for ${playerId}`)
      }
      return { ok: errors.length === 0, errors, events }
    }

    function verifyRoundSourceEvents (roundResult) {
      const errors = []
      if (!roundResult) return { ok: false, errors: ['Round result is required before source event verification'] }
      const sourceEventIds = Array.isArray(roundResult.sourceEventIds) ? roundResult.sourceEventIds : []
      const isForfeitRound = roundResult.outcome === 'forfeit'
      if (!isForfeitRound && sourceEventIds.length < 4) errors.push('Round result sourceEventIds must include commitment and reveal events')
      const byId = new Map(log.map(event => [event.eventId, event]))
      for (const eventId of sourceEventIds) {
        if (!byId.has(eventId)) errors.push(`Round source event ${eventId} is missing from the worker log`)
      }

      if (isForfeitRound) {
        const participants = new Set(participantUserIdsForRoundResult(roundResult))
        const forfeitEvents = sourceEventIds
          .map(eventId => byId.get(eventId))
          .filter(event => event && event.type === 'GameRoundForfeitRecorded')
        if (forfeitEvents.length === 0) {
          errors.push('Round source events missing GameRoundForfeitRecorded for forfeit')
        }
        for (const event of forfeitEvents) {
          const payload = event.payload || {}
          if (payload.gameId !== roundResult.gameId || payload.roundId !== roundResult.roundId) {
            errors.push('Forfeit source event does not match round identity')
          }
          if (!participants.has(payload.forfeitingPlayerId)) {
            errors.push(`Forfeit source event forfeiting player is not a participant: ${payload.forfeitingPlayerId || 'unknown-player'}`)
          }
          if (!participants.has(payload.winnerUserId)) {
            errors.push(`Forfeit source event winner is not a participant: ${payload.winnerUserId || 'unknown-player'}`)
          }
          if (payload.forfeitingPlayerId === payload.winnerUserId) {
            errors.push('Forfeit source event winner cannot be the forfeiting player')
          }
          if (payload.forfeitingPlayerId !== roundResult.forfeitingPlayerId) {
            errors.push('Forfeit source event forfeiting player does not match round result')
          }
          if (payload.winnerUserId !== roundResult.winnerUserId) {
            errors.push('Forfeit source event winner does not match round result')
          }
          if (!participants.has(payload.claimantUserId)) {
            errors.push(`Forfeit source event claimant is not a participant: ${payload.claimantUserId || 'unknown-claimant'}`)
          }
          if (payload.claimantUserId !== payload.winnerUserId) {
            errors.push('Forfeit source event claimant must match the winning player')
          }
          if (roundResult.claimantUserId && payload.claimantUserId !== roundResult.claimantUserId) {
            errors.push('Forfeit source event claimant does not match round result')
          }
          if (payload.claimantUserId && event.actorId !== payload.claimantUserId) {
            errors.push(`Forfeit source event signer must match claimantUserId ${payload.claimantUserId}`)
          }
        }
      } else {
        const required = [
          ['GameCommitmentSubmitted', roundResult.shooter && roundResult.shooter.id],
          ['GameCommitmentSubmitted', roundResult.keeper && roundResult.keeper.id],
          ['GameInputRevealed', roundResult.shooter && roundResult.shooter.id],
          ['GameInputRevealed', roundResult.keeper && roundResult.keeper.id]
        ]
        for (const [type, playerId] of required) {
          const matched = sourceEventIds
            .map(eventId => byId.get(eventId))
            .some(event => event &&
              event.type === type &&
              event.payload &&
              event.payload.gameId === roundResult.gameId &&
              event.payload.roundId === roundResult.roundId &&
              event.payload.playerId === playerId &&
              event.actorId === playerId)
          if (!matched) errors.push(`Round source events missing ${type} for ${playerId || 'unknown-player'}`)
        }
      }

      const playerEvidenceSourceEvents = sourceEventIds
        .map(eventId => byId.get(eventId))
        .filter(event => event && (event.type === 'GameCommitmentSubmitted' || event.type === 'GameInputRevealed'))
      for (const event of playerEvidenceSourceEvents) {
        const payload = event.payload || {}
        if (payload.playerId && event.actorId !== payload.playerId) {
          errors.push(`Round source event ${event.type} signer must match playerId ${payload.playerId}`)
        }
      }

      const participants = new Set(participantUserIdsForRoundResult(roundResult))
      const peerStateHashEvents = sourceEventIds
        .map(eventId => byId.get(eventId))
        .filter(event => event && event.type === 'GameRoundStateHashSubmitted')
      for (const event of peerStateHashEvents) {
        const payload = event.payload || {}
        if (payload.gameId !== roundResult.gameId || payload.roundId !== roundResult.roundId) {
          errors.push('Peer state hash source event does not match round identity')
        }
        if (!participants.has(payload.playerId)) {
          errors.push(`Peer state hash source event submitted by non-participant ${payload.playerId || 'unknown-player'}`)
        }
        if (payload.playerId && event.actorId !== payload.playerId) {
          errors.push(`Peer state hash source event signer must match playerId ${payload.playerId}`)
        }
        if (payload.stateHash !== roundResult.stateHash) {
          errors.push(`Peer state hash source event mismatch for ${payload.playerId || 'unknown-player'}`)
        }
        if (payload.resolverVersion && payload.resolverVersion !== roundResult.resolverVersion) {
          errors.push(`Peer state hash source event resolverVersion mismatch for ${payload.playerId || 'unknown-player'}`)
        }
      }
      if (Array.isArray(roundResult.peerStateHashEventIds) && roundResult.peerStateHashEventIds.length > 0) {
        const actualEventIds = peerStateHashEvents.map(event => event.eventId)
        if (!sameStringList(actualEventIds, roundResult.peerStateHashEventIds)) {
          errors.push('Round result peerStateHashEventIds must match replayed peer state hash source events')
        }
      }

      return { ok: errors.length === 0, errors }
    }

    function poolPaymentSourceEvents ({ poolId, confirmedEntries = [] } = {}) {
      return confirmedEntries.map(entry => {
        return findEvent('TetherWdkEntryConfirmed', payment => {
          return payment.poolId === poolId && payment.paymentId === entry.paymentId
        })
      }).filter(Boolean)
    }

    function bracketSubmissionSourceEvents ({ poolId, confirmedEntries = [] } = {}) {
      return confirmedEntries.map(entry => {
        return findEvent('BracketSubmissionLocked', (submission, event) => {
          return submission.poolId === poolId &&
            submission.userId === entry.userId &&
            bracketSubmissionSignerMatches(event) &&
            (!submission.entryId || !entry.entryId || submission.entryId === entry.entryId)
        })
      }).filter(Boolean)
    }

    function officialResultsHash (officialResults = {}) {
      return core.deterministicHash(officialResults || {})
    }

    function officialResultsSnapshotPayload ({ poolId, officialResults = {}, rulesVersion = 'bracket-pool-v1', source = 'trusted-results-feed', sourceActorId } = {}) {
      const results = officialResults || {}
      const resultsHash = officialResultsHash(results)
      const trustedSourceActorId = officialResultsSourceActorIdFor({ officialResults: results, source, sourceActorId })
      return {
        snapshotId: core.deterministicHash({
          type: 'OfficialResultsSnapshotRecorded',
          poolId,
          officialResultsHash: resultsHash,
          rulesVersion,
          source,
          sourceActorId: trustedSourceActorId
        }),
        poolId,
        officialResults: results,
        officialResultsHash: resultsHash,
        rulesVersion,
        source,
        sourceActorId: trustedSourceActorId,
        recordedAt: '2026-07-01T00:00:00.000Z'
      }
    }

    function officialResultsSnapshotEventFor ({ poolId, officialResults = {}, source, sourceActorId } = {}) {
      const expectedHash = officialResultsHash(officialResults)
      const expectedSourceActorId = officialResultsSourceActorIdFor({ officialResults, source, sourceActorId })
      return findEvent('OfficialResultsSnapshotRecorded', (snapshot, event) => {
        return snapshot.poolId === poolId &&
          snapshot.officialResultsHash === expectedHash &&
          snapshot.sourceActorId === expectedSourceActorId &&
          officialResultsSnapshotSignerMatches(event)
      })
    }

    function ensureOfficialResultsSnapshotEvent ({ poolId, officialResults = {}, rulesVersion = 'bracket-pool-v1', source = 'trusted-results-feed', sourceActorId, actorId }) {
      const snapshotPayload = officialResultsSnapshotPayload({
        poolId,
        officialResults,
        rulesVersion,
        source,
        sourceActorId
      })
      const existing = officialResultsSnapshotEventFor({
        poolId,
        officialResults,
        source,
        sourceActorId: snapshotPayload.sourceActorId
      })
      if (existing) return existing
      if (actorId !== snapshotPayload.sourceActorId) {
        return append('OfficialResultsSnapshotRejected', {
          poolId: poolId || null,
          officialResultsHash: snapshotPayload.officialResultsHash,
          source: snapshotPayload.source,
          sourceActorId: snapshotPayload.sourceActorId,
          reason: officialResultsSnapshotSignerMismatchReason({ actorId, sourceActorId: snapshotPayload.sourceActorId }),
          status: 'rejected'
        }, actorId)
      }
      return append('OfficialResultsSnapshotRecorded', snapshotPayload, actorId)
    }

    function verifyPoolSourceEvents (poolResult) {
      const errors = []
      if (!poolResult) return { ok: false, errors: ['Pool settlement result is required before source event verification'] }
      if (poolResult.sourceEventMode !== 'worker-log') {
        return { ok: false, errors: ['Pool settlement must use worker-log source events before QVAC attestation or WDK payout'] }
      }
      const sourceEventIds = Array.isArray(poolResult.sourceEventIds) ? poolResult.sourceEventIds : []
      const sourcePaymentIds = Array.isArray(poolResult.sourcePaymentIds) ? poolResult.sourcePaymentIds : []
      const sourceBracketSubmissionIds = Array.isArray(poolResult.sourceBracketSubmissionIds) ? poolResult.sourceBracketSubmissionIds : []
      if (sourceEventIds.length < sourcePaymentIds.length + sourceBracketSubmissionIds.length + 1) {
        errors.push('Pool result sourceEventIds must include confirmed entry payment events, bracket submissions, and official results snapshot')
      }

      const byId = new Map(log.map(event => [event.eventId, event]))
      const replayIndex = eventIndex(log)
      for (const eventId of sourceEventIds) {
        if (!byId.has(eventId)) errors.push(`Pool source event ${eventId} is missing from the worker log`)
      }

      for (const paymentId of sourcePaymentIds) {
        const matchedPaymentEvent = sourceEventIds
          .map(eventId => byId.get(eventId))
          .find(event => event &&
            event.type === 'TetherWdkEntryConfirmed' &&
            event.payload &&
            event.payload.poolId === poolResult.poolId &&
            event.payload.paymentId === paymentId)
        if (!matchedPaymentEvent) {
          errors.push(`Pool source events missing TetherWdkEntryConfirmed for ${paymentId || 'unknown-payment'}`)
          continue
        }
        const payment = matchedPaymentEvent.payload || {}
        const intentEvent = log.find(event =>
          event.type === 'TetherWdkEntryIntentCreated' &&
          event.payload &&
          event.payload.intentId === payment.intentId)
        if (!intentEvent) {
          errors.push(`Pool payment source event missing entrant-signed TetherWdkEntryIntentCreated for ${payment.intentId || 'unknown-intent'}`)
        } else {
          if (!entryIntentSignerMatches(intentEvent)) errors.push(`Entry intent source event signer must match userId ${intentEvent.payload && intentEvent.payload.userId || 'unknown-user'}`)
          if (!entryPaymentSignerMatches({ event: matchedPaymentEvent, intentEvent })) {
            errors.push(entryPaymentSignerMismatchReason({
              actorId: matchedPaymentEvent.actorId,
              rail: entryPaymentRailFor({ payment, intent: intentEvent.payload })
            }))
          }
          if (!paymentMatchesSignedEntryIntent({ payment, intentEvent })) {
            errors.push(`Pool payment source event does not match signed entry intent ${payment.intentId || 'unknown-intent'}`)
          }
        }
        if (validEntryRefundEventForPayment(replayIndex, paymentId, poolResult.poolId)) {
          errors.push(`Pool source payment ${paymentId || 'unknown-payment'} has been refunded by WDK rail`)
        }
      }

      for (const submissionId of sourceBracketSubmissionIds) {
        const matched = sourceEventIds
          .map(eventId => byId.get(eventId))
          .some(event => event &&
            event.type === 'BracketSubmissionLocked' &&
            event.payload &&
            event.payload.poolId === poolResult.poolId &&
            event.payload.submissionId === submissionId &&
            bracketSubmissionSignerMatches(event))
        if (!matched) errors.push(`Pool source events missing BracketSubmissionLocked for ${submissionId || 'unknown-submission'}`)
      }

      const bracketSourceEvents = sourceEventIds
        .map(eventId => byId.get(eventId))
        .filter(event => event && event.type === 'BracketSubmissionLocked')
      for (const event of bracketSourceEvents) {
        const payload = event.payload || {}
        if (payload.poolId !== poolResult.poolId) {
          errors.push('Bracket submission source event does not match pool identity')
        }
        if (payload.userId && event.actorId !== payload.userId) {
          errors.push(`Bracket submission source event signer must match userId ${payload.userId}`)
        }
      }

      const expectedResultsHash = officialResultsHash(poolResult.officialResults || {})
      const expectedSourceActorId = officialResultsSourceActorIdFor({
        officialResults: poolResult.officialResults || {},
        source: poolResult.officialResults && poolResult.officialResults.source,
        sourceActorId: poolResult.officialResults && poolResult.officialResults.sourceActorId
      })
      const matchedOfficialResults = sourceEventIds
        .map(eventId => byId.get(eventId))
        .some(event => event &&
          event.type === 'OfficialResultsSnapshotRecorded' &&
          event.payload &&
          event.payload.poolId === poolResult.poolId &&
          event.payload.officialResultsHash === expectedResultsHash &&
          event.payload.sourceActorId === expectedSourceActorId &&
          officialResultsSnapshotSignerMatches(event))
      if (!matchedOfficialResults) {
        errors.push(`Pool source events missing signed OfficialResultsSnapshotRecorded for ${poolResult.poolId || 'unknown-pool'}`)
      }

      const officialResultSourceEvents = sourceEventIds
        .map(eventId => byId.get(eventId))
        .filter(event => event && event.type === 'OfficialResultsSnapshotRecorded')
      for (const event of officialResultSourceEvents) {
        const payload = event.payload || {}
        if (payload.poolId !== poolResult.poolId) {
          errors.push('Official results source event does not match pool identity')
        }
        if (payload.officialResultsHash !== expectedResultsHash) {
          errors.push('Official results source event hash does not match settlement officialResultsHash')
        }
        if (payload.sourceActorId !== expectedSourceActorId) {
          errors.push(`Official results source event sourceActorId must match ${expectedSourceActorId}`)
        }
        if (!officialResultsSnapshotSignerMatches(event)) {
          errors.push(`Official results source event signer must match sourceActorId ${payload.sourceActorId || expectedSourceActorId}`)
        }
      }

      return { ok: errors.length === 0, errors }
    }

    function appendRoundIdentityDispute ({ payload = {}, identity, actorId }) {
      return append('GameSessionDisputed', {
        gameId: payload.gameId || null,
        roundId: identity && (identity.roundId || identity.expectedRoundId) || payload.roundId || null,
        roundIndex: identity && identity.roundIndex !== undefined ? identity.roundIndex : payload.roundIndex,
        expectedRoundId: identity && identity.expectedRoundId || null,
        reason: identity && identity.reason || 'Round identity is invalid',
        status: 'held'
      }, actorId)
    }

    function gameSettlementSummary ({ roundEvent, attestationEvent, settlementEvent }) {
      const released = settlementEvent && settlementEvent.type === 'TetherWdkEscrowReleased'
      const refunded = settlementEvent && settlementEvent.type === 'TetherWdkEscrowRefunded'
      const routeBlocked = released && isRecipientRequiredSettlement(settlementEvent)
      return {
        type: released && !routeBlocked
          ? 'TrustedGameSettlementCompleted'
          : 'TrustedGameSettlementHeld',
        status: released
          ? routeBlocked ? 'recipient-required' : 'prepared'
          : refunded ? 'refunded' : 'held',
        roundEvent,
        attestationEvent,
        settlementEvent
      }
    }

    function poolSettlementSummary ({ poolResultEvent, attestationEvent, settlementEvent, recipientDeclarationEvents = [] }) {
      const prepared = settlementEvent && settlementEvent.type === 'TetherWdkPoolPayoutPrepared'
      const routeBlocked = prepared && isRecipientRequiredSettlement(settlementEvent)
      return {
        type: prepared && !routeBlocked
          ? 'TrustedPoolSettlementCompleted'
          : 'TrustedPoolSettlementHeld',
        status: prepared
          ? routeBlocked ? 'recipient-required' : 'prepared'
          : 'held',
        poolResultEvent,
        attestationEvent,
        settlementEvent,
        recipientDeclarationEvents
      }
    }

    function declaredPayoutRecipientsFor ({ poolId, winnerUserIds = [], current = createView(log) }) {
      const byPool = current.payoutRecipientDeclarationsByPool[poolId] || {}
      return winnerUserIds.reduce((recipients, userId) => {
        const declaration = byPool[userId]
        if (declaration && declaration.recipient) recipients[userId] = declaration.recipient
        return recipients
      }, {})
    }

    function payoutRecipientsForSettlementPayload (payload, current = createView(log)) {
      const explicit = payload.payoutRecipients && Object.keys(payload.payoutRecipients).length
        ? payload.payoutRecipients
        : null
      if (explicit) return explicit
      return declaredPayoutRecipientsFor({
        poolId: payload.poolId,
        winnerUserIds: payload.winnerUserIds || [],
        current
      })
    }

    function shouldRetryGameRelease ({ existingRelease, winnerUserId, payload = {} }) {
      return existingRelease &&
        isRecipientRequiredSettlement(existingRelease) &&
        winnerRoutesAvailable({
          winnerUserIds: [winnerUserId],
          payoutRecipients: payload.payoutRecipients || {},
          payoutAddress: payload.payoutAddress
        })
    }

    function existingGameRefundEvent (escrowId) {
      return escrowId
        ? findLatestEvent('TetherWdkEscrowRefunded', refund => refund.escrowId === escrowId)
        : null
    }

    function shouldRefundHeldGameEscrow ({ settlementEvent, payload = {} }) {
      return payload.refundOnDispute === true &&
        settlementEvent &&
        settlementEvent.type === 'TetherWdkEscrowDisputed' &&
        payload.escrowId
    }

    function gameEscrowRefundCommand ({ payload, roundId, settlementEvent, actorId }) {
      const dispute = settlementEvent && settlementEvent.payload || {}
      return {
        type: 'wdk:refundGameEscrow',
        actorId: tetherWdkCommandActorId(payload, actorId),
        payload: {
          gameId: payload.gameId,
          roundId,
          escrowId: payload.escrowId,
          reason: payload.refundReason || dispute.reason || 'game-escrow-refunded',
          refundUserIds: payload.refundUserIds,
          payoutAddress: payload.payoutAddress,
          payoutRecipients: payload.payoutRecipients
        }
      }
    }

    function shouldRetryPoolPayout ({ existingPayout, winnerUserIds = [], payoutRecipients = {}, payoutAddress }) {
      return existingPayout &&
        isRecipientRequiredSettlement(existingPayout) &&
        winnerRoutesAvailable({
          winnerUserIds,
          payoutRecipients,
          payoutAddress
        })
    }

    function recipientDeclarationEventsFor ({ poolId, winnerUserIds = [] }) {
      const wanted = new Set(winnerUserIds)
      const latest = new Map()
      for (const event of log) {
        if (event.type !== 'PayoutRecipientDeclared') continue
        if (!payoutRecipientSignerMatches(event)) continue
        const payload = event.payload || {}
        if (payload.poolId !== poolId) continue
        if (wanted.size > 0 && !wanted.has(payload.userId)) continue
        latest.set(payload.userId, event)
      }
      return Array.from(latest.values())
    }

    function appendEscrowDispute ({ payload, reason, actorId, awaitAdapters }) {
      const rail = adapterActorId(adapters.tetherWdk, actorId)
      const disputeInput = {
        gameId: payload.gameId,
        roundId: payload.roundId,
        escrowId: payload.escrowId,
        reason
      }
      const createDispute = adapters.tetherWdk && typeof adapters.tetherWdk.disputeGameEscrow === 'function'
        ? () => adapters.tetherWdk.disputeGameEscrow(disputeInput)
        : () => ({
            disputeId: core.deterministicHash(disputeInput),
            ...disputeInput,
            status: 'held',
            rail
          })
      return attemptAdapterResult(
        createDispute,
        dispute => {
          const disputeRail = wdkSettlementRailFor(dispute) || rail
          return append('TetherWdkEscrowDisputed', { ...dispute, rail: disputeRail }, disputeRail || actorId)
        },
        null,
        awaitAdapters
      )
    }

    function appendPoolPayoutDispute ({ payload, reason, actorId }) {
      const rail = adapterActorId(adapters.tetherWdk, actorId)
      return append('TetherWdkPoolPayoutDisputed', {
        disputeId: core.deterministicHash({
          poolId: payload.poolId,
          winnerUserIds: payload.winnerUserIds || [],
          reason,
          rail
        }),
        poolId: payload.poolId,
        winnerUserIds: payload.winnerUserIds || [],
        reason,
        status: 'held',
        rail
      }, rail || actorId)
    }

    function sessionEventForEscrowPayload (payload = {}) {
      return findEvent('GameSessionStarted', (session, event) => {
        return (!payload.gameId || session.gameId === payload.gameId) &&
          (!payload.sessionId || session.sessionId === payload.sessionId) &&
          (!payload.sessionEventId || event.eventId === payload.sessionEventId)
      })
    }

    function appendGameEscrowCreationDispute ({ payload = {}, reason, actorId }) {
      const rail = adapterActorId(adapters.tetherWdk, actorId)
      return append('TetherWdkEscrowDisputed', {
        disputeId: core.deterministicHash({
          gameId: payload.gameId || null,
          sessionId: payload.sessionId || null,
          sessionEventId: payload.sessionEventId || null,
          escrowId: payload.escrowId || null,
          reason,
          rail
        }),
        gameId: payload.gameId || null,
        sessionId: payload.sessionId || null,
        sessionEventId: payload.sessionEventId || null,
        escrowId: payload.escrowId || null,
        reason,
        status: 'held',
        rail
      }, rail || actorId)
    }

    function gameEscrowInputForPayload (payload = {}) {
      const sessionEvent = sessionEventForEscrowPayload(payload)
      const requiresSession = payload.prizeMode === true ||
        payload.sessionBound === true ||
        payload.sessionId ||
        payload.sessionEventId
      if (!sessionEvent) {
        return requiresSession
          ? {
              ok: false,
              reason: 'Replayed game session is required before session-bound WDK escrow'
            }
          : { ok: true, input: { ...payload }, sessionEvent: null }
      }
      const session = sessionEvent.payload || {}
      const sessionPlayers = gameSessionPlayerIds(session)
      if (Array.isArray(payload.players) && payload.players.length > 0 && !sameStringList(payload.players, sessionPlayers)) {
        return {
          ok: false,
          reason: 'WDK game escrow players must match replayed game session participants'
        }
      }
      const expectedAmount = stakeAmount(session.stake)
      const expectedAsset = stakeAsset(session.stake)
      if (payload.amount !== undefined && payload.amount !== null && expectedAmount !== null && Number(payload.amount) !== expectedAmount) {
        return {
          ok: false,
          reason: 'WDK game escrow amount must match replayed game session stake'
        }
      }
      if (payload.asset && expectedAsset && payload.asset !== expectedAsset) {
        return {
          ok: false,
          reason: 'WDK game escrow asset must match replayed game session stake'
        }
      }
      const sourceEventIds = [...new Set([...(Array.isArray(payload.sourceEventIds) ? payload.sourceEventIds : []), sessionEvent.eventId])]
      return {
        ok: true,
        sessionEvent,
        input: {
          ...payload,
          gameId: session.gameId,
          players: sessionPlayers,
          amount: payload.amount !== undefined && payload.amount !== null ? payload.amount : expectedAmount,
          asset: payload.asset || expectedAsset || 'USDT',
          rulesVersion: payload.rulesVersion || session.rulesVersion || core.resolverVersion,
          sessionId: session.sessionId,
          sessionEventId: sessionEvent.eventId,
          sessionHash: core.deterministicHash(session),
          sourceEventIds,
          stakeHash: session.stakeHash || (session.stake ? core.deterministicHash(session.stake) : payload.stakeHash || null),
          prizeMode: payload.prizeMode === true || session.prizeMode === true
        }
      }
    }

    function appendVerifiedGameEscrow ({ payload = {}, escrow, actorId }) {
      const rail = wdkSettlementRailFor(escrow)
      if (!rail) {
        return appendGameEscrowCreationDispute({
          payload: { ...payload, escrowId: escrow && escrow.escrowId },
          reason: wdkEscrowSignerMismatchReason({ actorId, rail }),
          actorId
        })
      }
      const inputWasSessionBound = gameEscrowHasSessionBinding(payload)
      if (inputWasSessionBound && !gameEscrowHasSessionBinding(escrow)) {
        return appendGameEscrowCreationDispute({
          payload: { ...payload, escrowId: escrow && escrow.escrowId },
          reason: 'WDK game escrow output must preserve replayed game session evidence',
          actorId
        })
      }
      if (!gameEscrowMatchesReplay({ payload: escrow, actorId: rail }, eventIndex(log))) {
        return appendGameEscrowCreationDispute({
          payload: { ...payload, escrowId: escrow && escrow.escrowId },
          reason: inputWasSessionBound
            ? 'WDK game escrow output did not match replayed game session evidence'
            : 'WDK game escrow output did not match trusted rail evidence',
          actorId
        })
      }
      return append('TetherWdkEscrowCreated', escrow, rail)
    }

    function appendVerifiedRoundAttestation ({ roundResult, attestation, actorId }) {
      const verification = core.verifyQvacRoundAttestation({ roundResult, attestation })
      if (!verification.ok) {
        return append('GameSessionDisputed', {
          gameId: roundResult && roundResult.gameId || null,
          roundId: roundResult && roundResult.roundId || null,
          attestationId: attestation && attestation.attestationId || null,
          reason: `QVAC attestation failed verification: ${verification.errors.join('; ')}`,
          status: 'held'
        }, actorId)
      }
      return append('QvacRefereeAttestationCreated', attestation, attestation.refereeId)
    }

    function appendVerifiedPoolAttestation ({ poolResult, attestation, actorId }) {
      const verification = core.verifyQvacPoolSettlementAttestation({ poolResult, attestation })
      if (!verification.ok) {
        return appendPoolPayoutDispute({
          payload: {
            poolId: poolResult && poolResult.poolId || attestation && attestation.poolId || null,
            winnerUserIds: poolResult && poolResult.winnerUserIds || attestation && attestation.winnerUserIds || []
          },
          reason: `QVAC pool attestation failed verification: ${verification.errors.join('; ')}`,
          actorId
        })
      }
      return append('QvacPoolSettlementAttestationCreated', attestation, attestation.refereeId)
    }

    function appendVerifiedGameRelease ({ payload, payout, actorId, awaitAdapters }) {
      const index = eventIndex(log)
      const rail = wdkSettlementRailFor(payout)
      if (!verifiedGameReleaseMatchesReplay({ payload: payout, actorId: rail }, index)) {
        const reason = !rail
          ? wdkSettlementSignerMismatchReason({ actorId, rail })
          : 'WDK escrow release output did not match replayed QVAC, escrow, and round evidence'
        return appendEscrowDispute({
          payload,
          reason,
          actorId,
          awaitAdapters
        })
      }
      return append('TetherWdkEscrowReleased', payout, rail || actorId)
    }

    function normalizeGameEscrowRefundRail ({ refund, escrow }) {
      if (!refund || typeof refund !== 'object' || refund.rail || !escrow || !escrow.rail) return refund
      return { ...refund, rail: escrow.rail }
    }

    function appendGameEscrowRefundRejected ({ payload, reason, actorId }) {
      return append('TetherWdkEscrowRefundRejected', {
        escrowId: payload.escrowId || (payload.escrow && payload.escrow.escrowId) || null,
        gameId: payload.gameId || (payload.escrow && payload.escrow.gameId) || null,
        reason,
        status: 'rejected'
      }, actorId)
    }

    function appendGameEscrowRefunded ({ refund, escrow, actorId }) {
      const refunded = normalizeGameEscrowRefundRail({ refund, escrow })
      const rail = wdkSettlementRailFor(refunded)
      const index = eventIndex(log)
      if (!gameEscrowRefundMatchesReplay({ payload: refunded, actorId: rail }, index)) {
        const reason = !rail
          ? wdkSettlementSignerMismatchReason({ actorId, rail })
          : 'WDK escrow refund output did not match replayed escrow and dispute evidence'
        return appendGameEscrowRefundRejected({
          payload: { escrowId: escrow && escrow.escrowId, gameId: escrow && escrow.gameId },
          reason,
          actorId
        })
      }
      return append('TetherWdkEscrowRefunded', refunded, rail || actorId)
    }

    function appendVerifiedPoolPayout ({ payload, poolPayout, actorId }) {
      const index = eventIndex(log)
      const rail = wdkSettlementRailFor(poolPayout)
      if (!verifiedPoolPayoutMatchesReplay({ payload: poolPayout, actorId: rail }, index)) {
        const reason = !rail
          ? wdkSettlementSignerMismatchReason({ actorId, rail })
          : 'WDK pool payout output did not match replayed QVAC, payment, and pool evidence'
        return appendPoolPayoutDispute({
          payload,
          reason,
          actorId
        })
      }
      return append('TetherWdkPoolPayoutPrepared', poolPayout, rail || actorId)
    }

    function appendEntryPaymentPending ({ intent, payload, reason, actorId }) {
      const pending = intent
        ? core.createTetherWdkEntryPaymentPending({
            intent,
            confirmationId: payload.confirmationId,
            processorStatus: 'confirmation_failed',
            reason
          })
        : {
            checkId: core.deterministicHash({
              intentId: payload.intentId || null,
              confirmationId: payload.confirmationId || null,
              reason
            }),
            intentId: payload.intentId || null,
            status: 'pending',
            processorStatus: 'missing_intent',
            reason,
            checkedAt: '2026-07-01T00:00:00.000Z'
          }
      const rail = entryPaymentRailFor({ payment: pending, intent })
      return append('TetherWdkEntryPaymentPending', pending, rail || actorId)
    }

    function normalizeEntryPaymentRail ({ payment, intent }) {
      if (!payment || typeof payment !== 'object' || payment.rail || !intent || !intent.rail) return payment
      return { ...payment, rail: intent.rail }
    }

    function appendEntryPaymentConfirmed ({ payment, intent, actorId }) {
      const confirmed = normalizeEntryPaymentRail({ payment, intent })
      const rail = entryPaymentRailFor({ payment: confirmed, intent })
      return append('TetherWdkEntryConfirmed', confirmed, rail || actorId)
    }

    function normalizeEntryRefundRail ({ refund, payment }) {
      if (!refund || typeof refund !== 'object' || refund.rail || !payment || !payment.rail) return refund
      return { ...refund, rail: payment.rail }
    }

    function appendEntryRefundRejected ({ payload, reason, actorId }) {
      return append('TetherWdkEntryRefundRejected', {
        paymentId: payload.paymentId || payload.payment && payload.payment.paymentId || null,
        intentId: payload.intentId || payload.payment && payload.payment.intentId || null,
        poolId: payload.poolId || payload.payment && payload.payment.poolId || null,
        reason,
        status: 'rejected'
      }, actorId)
    }

    function appendEntryRefunded ({ refund, payment, actorId }) {
      const refunded = normalizeEntryRefundRail({ refund, payment })
      const rail = entryPaymentRailFor({ payment: refunded, intent: payment })
      const index = eventIndex(log)
      if (!entryRefundMatchesReplay({ payload: refunded, actorId: rail }, index)) {
        const reason = !rail
          ? entryRefundSignerMismatchReason({ actorId, rail })
          : 'WDK entry refund output did not match replayed payment evidence'
        return appendEntryRefundRejected({
          payload: { paymentId: payment && payment.paymentId, intentId: payment && payment.intentId, poolId: payment && payment.poolId },
          reason,
          actorId
        })
      }
      return append('TetherWdkEntryRefunded', refunded, rail || actorId)
    }

    function mapEntryReconciliation ({ payment, intent, actorId }) {
      if (payment && payment.status === 'confirmed') return appendEntryPaymentConfirmed({ payment, intent, actorId })
      const pending = normalizeEntryPaymentRail({
        payment: payment || (intent
          ? core.createTetherWdkEntryPaymentPending({
              intent,
              processorStatus: 'unknown',
              reason: 'WDK reconciliation returned no payment status'
            })
          : {
              checkId: core.deterministicHash({ reason: 'WDK reconciliation returned no payment status' }),
              status: 'pending',
              processorStatus: 'unknown',
              reason: 'WDK reconciliation returned no payment status',
              checkedAt: '2026-07-01T00:00:00.000Z'
            }),
        intent
      })
      const rail = entryPaymentRailFor({ payment: pending, intent })
      return append('TetherWdkEntryPaymentPending', pending, rail || actorId)
    }

    function confirmedEntriesForPool ({ poolId, confirmedEntries, current }) {
      const entries = Array.isArray(confirmedEntries)
        ? confirmedEntries
        : Object.values(current.entryPayments).filter(payment => payment.poolId === poolId)
      return entries.filter(entry => {
        return entry &&
          entry.status === 'confirmed' &&
          entry.poolId === poolId &&
          !current.entryRefundsByPayment[entry.paymentId]
      })
    }

    function recordSettlementReceipt ({ payload, actorId }) {
      const receipt = payload.receipt || payload
      const current = createView(log)
      const settlementEventId = receipt && receipt.events && receipt.events.settlement && receipt.events.settlement.eventId
      if (settlementEventId && current.settlementReceiptEventsBySettlementEvent[settlementEventId]) {
        return current.settlementReceiptEventsBySettlementEvent[settlementEventId]
      }
      if (receipt && receipt.receiptId && current.settlementReceiptEvents[receipt.receiptId]) {
        return current.settlementReceiptEvents[receipt.receiptId]
      }
      if (!receipt || !receipt.receiptId || !receipt.receiptHash) {
        return append('SettlementReceiptRejected', {
          receiptId: receipt && receipt.receiptId,
          reason: 'Settlement receipt id and hash are required',
          status: 'rejected'
        }, actorId)
      }
      if (receipt.eventRoot !== current.eventRoot) {
        return append('SettlementReceiptRejected', {
          receiptId: receipt.receiptId,
          receiptHash: receipt.receiptHash,
          reason: 'Settlement receipt eventRoot does not match current worker event root',
          expectedEventRoot: current.eventRoot,
          receivedEventRoot: receipt.eventRoot,
          status: 'rejected'
        }, actorId)
      }
      if (!receiptReferencesMatchReplay(receipt, eventIndex(log))) {
        return append('SettlementReceiptRejected', {
          receiptId: receipt.receiptId,
          receiptHash: receipt.receiptHash,
          reason: 'Settlement receipt event references do not match replayed worker events',
          status: 'rejected'
        }, actorId)
      }
      const receiptTools = getSettlementReceipts()
      if (receiptTools && typeof receiptTools.verifySettlementReceipt === 'function') {
        const verification = receiptTools.verifySettlementReceipt(receipt)
        if (!verification.ok) {
          return append('SettlementReceiptRejected', {
            receiptId: receipt.receiptId,
            receiptHash: receipt.receiptHash,
            reason: verification.errors.join('; '),
            status: 'rejected'
          }, actorId)
        }
      }
      return append('SettlementReceiptCreated', receipt, actorId)
    }

    function settleGameRoundSync (payload, actorId) {
      const identity = normalizeRoundIdentity(payload)
      if (!identity.ok) return gameSettlementSummary({ roundEvent: appendRoundIdentityDispute({ payload, identity, actorId }) })
      const { roundId, roundIndex } = identity
      const existingRound = findEvent('GameRoundResolved', result => result.gameId === payload.gameId && result.roundId === roundId)
      const roundEvent = existingRound || dispatchCommand({
        type: 'game:resolveRound',
        actorId,
        payload: {
          gameId: payload.gameId,
          roundIndex,
          roundId,
          shooter: payload.shooter,
          keeper: payload.keeper
        }
      }, false)
      if (roundEvent.type !== 'GameRoundResolved') {
        return gameSettlementSummary({ roundEvent })
      }

      const existingAttestation = findEvent('QvacRefereeAttestationCreated', (attestation, event) =>
        attestation.gameId === payload.gameId &&
        attestation.roundId === roundId &&
        qvacAttestationSignerMatches(event))
      const attestationEvent = existingAttestation || dispatchCommand({
        type: 'qvac:refereeAttest',
        actorId: qvacCommandActorId(payload, actorId),
        payload: { gameId: payload.gameId, roundId }
      }, false)
      const winnerUserId = payload.winnerUserId || winnerFromRoundResult(roundEvent.payload)
      const existingRefund = existingGameRefundEvent(payload.escrowId)
      if (existingRefund) return gameSettlementSummary({ roundEvent, attestationEvent, settlementEvent: existingRefund })
      const existingRelease = findLatestEvent('TetherWdkEscrowReleased', payout => payout.escrowId === payload.escrowId)
      const retryRelease = shouldRetryGameRelease({ existingRelease, winnerUserId, payload })
      const releaseEvent = existingRelease && !retryRelease ? existingRelease : dispatchCommand({
        type: 'wdk:releaseGameEscrow',
        actorId: tetherWdkCommandActorId(payload, actorId),
        payload: {
          gameId: payload.gameId,
          roundId,
          escrowId: payload.escrowId,
          winnerUserId,
          qvacAttestation: attestationEvent.payload,
          payoutAddress: payload.payoutAddress,
          payoutRecipients: payload.payoutRecipients
        }
      }, false)
      const settlementEvent = shouldRefundHeldGameEscrow({ settlementEvent: releaseEvent, payload })
        ? dispatchCommand(gameEscrowRefundCommand({ payload, roundId, settlementEvent: releaseEvent, actorId }), false)
        : releaseEvent
      return gameSettlementSummary({ roundEvent, attestationEvent, settlementEvent })
    }

    async function settleGameRoundAsync (payload, actorId) {
      const identity = normalizeRoundIdentity(payload)
      if (!identity.ok) return gameSettlementSummary({ roundEvent: appendRoundIdentityDispute({ payload, identity, actorId }) })
      const { roundId, roundIndex } = identity
      const existingRound = findEvent('GameRoundResolved', result => result.gameId === payload.gameId && result.roundId === roundId)
      const roundEvent = existingRound || await dispatchCommand({
        type: 'game:resolveRound',
        actorId,
        payload: {
          gameId: payload.gameId,
          roundIndex,
          roundId,
          shooter: payload.shooter,
          keeper: payload.keeper
        }
      }, true)
      if (roundEvent.type !== 'GameRoundResolved') {
        return gameSettlementSummary({ roundEvent })
      }

      const existingAttestation = findEvent('QvacRefereeAttestationCreated', (attestation, event) =>
        attestation.gameId === payload.gameId &&
        attestation.roundId === roundId &&
        qvacAttestationSignerMatches(event))
      const attestationEvent = existingAttestation || await dispatchCommand({
        type: 'qvac:refereeAttest',
        actorId: qvacCommandActorId(payload, actorId),
        payload: { gameId: payload.gameId, roundId }
      }, true)
      const winnerUserId = payload.winnerUserId || winnerFromRoundResult(roundEvent.payload)
      const existingRefund = existingGameRefundEvent(payload.escrowId)
      if (existingRefund) return gameSettlementSummary({ roundEvent, attestationEvent, settlementEvent: existingRefund })
      const existingRelease = findLatestEvent('TetherWdkEscrowReleased', payout => payout.escrowId === payload.escrowId)
      const retryRelease = shouldRetryGameRelease({ existingRelease, winnerUserId, payload })
      const releaseEvent = existingRelease && !retryRelease ? existingRelease : await dispatchCommand({
        type: 'wdk:releaseGameEscrow',
        actorId: tetherWdkCommandActorId(payload, actorId),
        payload: {
          gameId: payload.gameId,
          roundId,
          escrowId: payload.escrowId,
          winnerUserId,
          qvacAttestation: attestationEvent.payload,
          payoutAddress: payload.payoutAddress,
          payoutRecipients: payload.payoutRecipients
        }
      }, true)
      const settlementEvent = shouldRefundHeldGameEscrow({ settlementEvent: releaseEvent, payload })
        ? await dispatchCommand(gameEscrowRefundCommand({ payload, roundId, settlementEvent: releaseEvent, actorId }), true)
        : releaseEvent
      return gameSettlementSummary({ roundEvent, attestationEvent, settlementEvent })
    }

    function settleBracketPoolSync (payload, actorId) {
      const existingPoolResult = findEvent('BracketPoolSettlementResolved', result => result.poolId === payload.poolId)
      const poolResultEvent = existingPoolResult || dispatchCommand({
        type: 'pool:resolveSettlement',
        actorId,
        payload: {
          poolId: payload.poolId,
          confirmedEntries: payload.confirmedEntries,
          winnerUserIds: payload.winnerUserIds,
          bracketSubmissions: payload.bracketSubmissions,
          officialResults: payload.officialResults,
          officialResultsSource: payload.officialResultsSource || payload.source,
          rulesVersion: payload.rulesVersion
        }
      }, false)
      const existingAttestation = findEvent('QvacPoolSettlementAttestationCreated', (attestation, event) =>
        attestation.poolId === payload.poolId &&
        qvacAttestationSignerMatches(event))
      const attestationEvent = existingAttestation || dispatchCommand({
        type: 'qvac:attestPoolSettlement',
        actorId: qvacCommandActorId(payload, actorId),
        payload: { poolId: payload.poolId, poolResult: poolResultEvent.payload }
      }, false)
      const current = createView(log)
      const settlementWinnerUserIds = poolResultEvent && poolResultEvent.payload && poolResultEvent.payload.winnerUserIds || payload.winnerUserIds || []
      const settlementPayload = { ...payload, winnerUserIds: settlementWinnerUserIds }
      const payoutRecipients = payoutRecipientsForSettlementPayload(settlementPayload, current)
      const recipientDeclarationEvents = recipientDeclarationEventsFor({
        poolId: payload.poolId,
        winnerUserIds: settlementWinnerUserIds
      })
      const existingPayout = findLatestEvent('TetherWdkPoolPayoutPrepared', payout => payout.poolId === payload.poolId)
      const retryPayout = shouldRetryPoolPayout({
        existingPayout,
        winnerUserIds: settlementWinnerUserIds,
        payoutRecipients,
        payoutAddress: payload.payoutAddress
      })
      const settlementEvent = existingPayout && !retryPayout ? existingPayout : dispatchCommand({
        type: 'wdk:createPoolPayout',
        actorId: tetherWdkCommandActorId(payload, actorId),
        payload: {
          poolId: payload.poolId,
          confirmedEntries: payload.confirmedEntries,
          winnerUserIds: settlementWinnerUserIds,
          qvacAttestation: attestationEvent.payload,
          asset: payload.asset,
          payoutRecipients,
          payoutAddress: payload.payoutAddress,
          rulesVersion: payload.rulesVersion
        }
      }, false)
      return poolSettlementSummary({ poolResultEvent, attestationEvent, settlementEvent, recipientDeclarationEvents })
    }

    async function settleBracketPoolAsync (payload, actorId) {
      const existingPoolResult = findEvent('BracketPoolSettlementResolved', result => result.poolId === payload.poolId)
      const poolResultEvent = existingPoolResult || await dispatchCommand({
        type: 'pool:resolveSettlement',
        actorId,
        payload: {
          poolId: payload.poolId,
          confirmedEntries: payload.confirmedEntries,
          winnerUserIds: payload.winnerUserIds,
          bracketSubmissions: payload.bracketSubmissions,
          officialResults: payload.officialResults,
          officialResultsSource: payload.officialResultsSource || payload.source,
          rulesVersion: payload.rulesVersion
        }
      }, true)
      const existingAttestation = findEvent('QvacPoolSettlementAttestationCreated', (attestation, event) =>
        attestation.poolId === payload.poolId &&
        qvacAttestationSignerMatches(event))
      const attestationEvent = existingAttestation || await dispatchCommand({
        type: 'qvac:attestPoolSettlement',
        actorId: qvacCommandActorId(payload, actorId),
        payload: { poolId: payload.poolId, poolResult: poolResultEvent.payload }
      }, true)
      const current = createView(log)
      const settlementWinnerUserIds = poolResultEvent && poolResultEvent.payload && poolResultEvent.payload.winnerUserIds || payload.winnerUserIds || []
      const settlementPayload = { ...payload, winnerUserIds: settlementWinnerUserIds }
      const payoutRecipients = payoutRecipientsForSettlementPayload(settlementPayload, current)
      const recipientDeclarationEvents = recipientDeclarationEventsFor({
        poolId: payload.poolId,
        winnerUserIds: settlementWinnerUserIds
      })
      const existingPayout = findLatestEvent('TetherWdkPoolPayoutPrepared', payout => payout.poolId === payload.poolId)
      const retryPayout = shouldRetryPoolPayout({
        existingPayout,
        winnerUserIds: settlementWinnerUserIds,
        payoutRecipients,
        payoutAddress: payload.payoutAddress
      })
      const settlementEvent = existingPayout && !retryPayout ? existingPayout : await dispatchCommand({
        type: 'wdk:createPoolPayout',
        actorId: tetherWdkCommandActorId(payload, actorId),
        payload: {
          poolId: payload.poolId,
          confirmedEntries: payload.confirmedEntries,
          winnerUserIds: settlementWinnerUserIds,
          qvacAttestation: attestationEvent.payload,
          asset: payload.asset,
          payoutRecipients,
          payoutAddress: payload.payoutAddress,
          rulesVersion: payload.rulesVersion
        }
      }, true)
      return poolSettlementSummary({ poolResultEvent, attestationEvent, settlementEvent, recipientDeclarationEvents })
    }

    function dispatchCommand (command, awaitAdapters) {
      const actorId = command.actorId || 'system'
      const payload = command.payload || {}

      if (command.type === 'profile:set' || command.type === 'profile:update') {
        const profile = normalizeProfilePayload(payload, actorId)
        if (!profile.userId || !profile.username || !profile.teamId) {
          return append('ProfileUpdateRejected', {
            userId: profile.userId || null,
            username: profile.username || null,
            teamId: profile.teamId || null,
            reason: 'userId, username, and teamId are required before profile update',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== profile.userId) {
          return append('ProfileUpdateRejected', {
            userId: profile.userId,
            username: profile.username,
            teamId: profile.teamId,
            reason: `Profile update actorId must match userId ${profile.userId}`,
            status: 'rejected'
          }, actorId)
        }
        const existingProfile = findEvent('ProfileUpdated', item => item.profileId === profile.profileId)
        if (existingProfile) return existingProfile
        return append('ProfileUpdated', profile, profile.userId)
      }

      if (command.type === 'bracket:updateDraft' || command.type === 'bracket:resetDraft') {
        const current = createView(log)
        const userId = payload.userId || actorId
        const poolId = payload.poolId || null
        const previousDraft = poolId && userId &&
          current.bracketDraftsByPool[poolId] &&
          current.bracketDraftsByPool[poolId][userId]
        const draft = normalizeBracketDraftPayload({
          ...payload,
          userId,
          clear: command.type === 'bracket:resetDraft' || payload.clear === true,
          picks: command.type === 'bracket:resetDraft' ? {} : payload.picks
        }, actorId, previousDraft && previousDraft.picks || {})
        if (!draft.poolId || !draft.userId) {
          return append('BracketDraftRejected', {
            poolId: draft.poolId || null,
            userId: draft.userId || null,
            reason: 'poolId and userId are required before bracket draft update',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== draft.userId) {
          return append('BracketDraftRejected', {
            poolId: draft.poolId,
            userId: draft.userId,
            reason: `Bracket draft actorId must match userId ${draft.userId}`,
            status: 'rejected'
          }, actorId)
        }
        const existingDraft = findEvent('BracketDraftUpdated', item => item.draftId === draft.draftId)
        if (existingDraft) return existingDraft
        return append('BracketDraftUpdated', draft, draft.userId)
      }

      if (command.type === 'room:join') {
        const joined = normalizeRoomJoinPayload(payload, actorId)
        if (!joined.roomId || !joined.matchId || !joined.userId) {
          return append('RoomJoinRejected', {
            roomId: joined.roomId || null,
            matchId: joined.matchId || null,
            userId: joined.userId || null,
            reason: 'roomId or matchId and userId are required before room join',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== joined.userId) {
          return append('RoomJoinRejected', {
            roomId: joined.roomId,
            matchId: joined.matchId,
            userId: joined.userId,
            reason: `Room join actorId must match userId ${joined.userId}`,
            status: 'rejected'
          }, actorId)
        }
        const existingJoin = findEvent('RoomJoined', item => item.joinId === joined.joinId)
        if (existingJoin) return existingJoin
        return append('RoomJoined', joined, joined.userId)
      }

      if (command.type === 'room:leave') {
        const left = normalizeRoomLeavePayload(payload, actorId)
        const current = createView(log)
        if (!left.roomId || !left.userId) {
          return append('RoomLeaveRejected', {
            roomId: left.roomId || null,
            userId: left.userId || null,
            reason: 'roomId and userId are required before room leave',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== left.userId) {
          return append('RoomLeaveRejected', {
            roomId: left.roomId,
            userId: left.userId,
            reason: `Room leave actorId must match userId ${left.userId}`,
            status: 'rejected'
          }, actorId)
        }
        if (!current.roomParticipants[left.roomId] || !current.roomParticipants[left.roomId][left.userId]) {
          return append('RoomLeaveRejected', {
            roomId: left.roomId,
            userId: left.userId,
            reason: 'Replayed room join is required before room leave',
            status: 'rejected'
          }, actorId)
        }
        const existingLeave = findEvent('RoomLeft', item => item.leaveId === left.leaveId)
        if (existingLeave) return existingLeave
        return append('RoomLeft', left, left.userId)
      }

      if (command.type === 'chat:send') {
        const message = normalizeChatMessagePayload(payload, actorId)
        const current = createView(log)
        if (!message.roomId || !message.userId || !message.body) {
          return append('ChatMessageRejected', {
            roomId: message.roomId || null,
            userId: message.userId || null,
            reason: 'roomId, userId, and body are required before chat send',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== message.userId) {
          return append('ChatMessageRejected', {
            roomId: message.roomId,
            userId: message.userId,
            reason: `Chat message actorId must match userId ${message.userId}`,
            status: 'rejected'
          }, actorId)
        }
        if (!current.roomParticipants[message.roomId] || !current.roomParticipants[message.roomId][message.userId]) {
          return append('ChatMessageRejected', {
            roomId: message.roomId,
            userId: message.userId,
            reason: 'Replayed room join is required before chat send',
            status: 'rejected'
          }, actorId)
        }
        const existingMessage = findEvent('ChatMessageSent', item => item.messageId === message.messageId)
        if (existingMessage) return existingMessage
        return append('ChatMessageSent', message, message.userId)
      }

      if (command.type === 'voice:update' || command.type === 'voice:set-state' || command.type === 'voice:setState') {
        const voice = normalizeVoiceStatePayload(payload, actorId)
        const current = createView(log)
        if (!voice.roomId || !voice.userId) {
          return append('VoiceStateRejected', {
            roomId: voice.roomId || null,
            userId: voice.userId || null,
            reason: 'roomId and userId are required before voice state update',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== voice.userId) {
          return append('VoiceStateRejected', {
            roomId: voice.roomId,
            userId: voice.userId,
            reason: `Voice state actorId must match userId ${voice.userId}`,
            status: 'rejected'
          }, actorId)
        }
        if (!current.roomParticipants[voice.roomId] || !current.roomParticipants[voice.roomId][voice.userId]) {
          return append('VoiceStateRejected', {
            roomId: voice.roomId,
            userId: voice.userId,
            reason: 'Replayed room join is required before voice state update',
            status: 'rejected'
          }, actorId)
        }
        return append('VoiceStateUpdated', voice, voice.userId)
      }

      if (command.type === 'stream:start') {
        const stream = normalizeStreamStartPayload(payload, actorId)
        const current = createView(log)
        if (!stream.roomId || !stream.userId) {
          return append('StreamStartRejected', {
            roomId: stream.roomId || null,
            userId: stream.userId || null,
            reason: 'roomId and userId are required before stream start',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== stream.userId) {
          return append('StreamStartRejected', {
            roomId: stream.roomId,
            userId: stream.userId,
            reason: `Stream actorId must match userId ${stream.userId}`,
            status: 'rejected'
          }, actorId)
        }
        if (!current.roomParticipants[stream.roomId] || !current.roomParticipants[stream.roomId][stream.userId]) {
          return append('StreamStartRejected', {
            roomId: stream.roomId,
            userId: stream.userId,
            reason: 'Replayed room join is required before stream start',
            status: 'rejected'
          }, actorId)
        }
        if (stream.rightsConfirmed !== true) {
          return append('StreamStartRejected', {
            roomId: stream.roomId,
            userId: stream.userId,
            reason: 'Streaming rights must be confirmed before stream start',
            status: 'rejected'
          }, actorId)
        }
        const existingStream = findEvent('StreamStarted', item => item.streamId === stream.streamId)
        if (existingStream) return existingStream
        return append('StreamStarted', stream, stream.userId)
      }

      if (command.type === 'stream:stop') {
        const stopped = normalizeStreamStopPayload(payload, actorId)
        const current = createView(log)
        const active = stopped.streamId && current.activeStreams[stopped.streamId]
        if (!stopped.streamId || !stopped.roomId || !stopped.userId) {
          return append('StreamStopRejected', {
            streamId: stopped.streamId || null,
            roomId: stopped.roomId || null,
            userId: stopped.userId || null,
            reason: 'streamId, roomId, and userId are required before stream stop',
            status: 'rejected'
          }, actorId)
        }
        if (!active) {
          return append('StreamStopRejected', {
            streamId: stopped.streamId,
            roomId: stopped.roomId,
            userId: stopped.userId,
            reason: 'Active stream is required before stream stop',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== stopped.userId || active.userId !== stopped.userId) {
          return append('StreamStopRejected', {
            streamId: stopped.streamId,
            roomId: stopped.roomId,
            userId: stopped.userId,
            reason: `Stream stop actorId must match streamer userId ${active.userId}`,
            status: 'rejected'
          }, actorId)
        }
        const existingStop = findEvent('StreamStopped', item => item.stopId === stopped.stopId)
        if (existingStop) return existingStop
        return append('StreamStopped', stopped, stopped.userId)
      }

      if (command.type === 'game:invite') {
        const invite = normalizeGameInvitePayload(payload, actorId)
        if (!invite.inviter.userId || !invite.opponent.userId) {
          return append('GameInviteRejected', {
            gameId: invite.gameId || null,
            inviterUserId: invite.inviter.userId || null,
            opponentUserId: invite.opponent.userId || null,
            reason: 'inviter and opponent user ids are required before game invite',
            status: 'rejected'
          }, actorId)
        }
        if (invite.inviter.userId === invite.opponent.userId) {
          return append('GameInviteRejected', {
            gameId: invite.gameId,
            inviterUserId: invite.inviter.userId,
            opponentUserId: invite.opponent.userId,
            reason: 'Game invite requires two different players',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== invite.inviter.userId) {
          return append('GameInviteRejected', {
            gameId: invite.gameId,
            inviterUserId: invite.inviter.userId,
            opponentUserId: invite.opponent.userId,
            reason: gameInviteSignerMismatchReason({ actorId, inviterUserId: invite.inviter.userId }),
            status: 'rejected'
          }, actorId)
        }
        const existingInvite = findEvent('GameInviteCreated', item => item.inviteId === invite.inviteId)
        if (existingInvite) return existingInvite
        return append('GameInviteCreated', invite, invite.inviter.userId)
      }

      if (command.type === 'game:acceptInvite') {
        const inviteEvent = findEvent('GameInviteCreated', invite => {
          return (payload.gameId && invite.gameId === payload.gameId) ||
            (payload.inviteId && invite.inviteId === payload.inviteId)
        })
        const invite = inviteEvent && inviteEvent.payload || null
        if (!inviteEvent || !gameInviteSignerMatches(inviteEvent)) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId || null,
            inviteId: payload.inviteId || null,
            reason: 'A valid signed game invite is required before accept',
            status: 'held'
          }, actorId)
        }
        if (actorId !== invite.opponent.userId) {
          return append('GameSessionDisputed', {
            gameId: invite.gameId,
            inviteId: invite.inviteId,
            playerId: actorId,
            reason: `Game invite accept actorId must match opponent userId ${invite.opponent.userId}`,
            status: 'held'
          }, actorId)
        }
        const existingStarted = findEvent('GameSessionStarted', session => session.gameId === invite.gameId)
        if (existingStarted) return existingStarted
        const existingAccepted = findEvent('GameInviteAccepted', accepted => accepted.gameId === invite.gameId)
        const acceptedEvent = existingAccepted || append('GameInviteAccepted', gameInviteAcceptancePayload({
          inviteEvent,
          actorId
        }), actorId)
        return append('GameSessionStarted', gameSessionStartPayload({
          inviteEvent,
          acceptedEvent
        }), actorId)
      }

      if (command.type === 'game:join') {
        const current = createView(log)
        const session = current.gameSessions[payload.gameId]
        const userId = payload.userId || actorId
        if (!session) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId || null,
            playerId: userId,
            reason: 'Game session must be started before join',
            status: 'held'
          }, actorId)
        }
        if (actorId !== userId) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId,
            playerId: userId,
            reason: `Game session join actorId must match userId ${userId}`,
            status: 'held'
          }, actorId)
        }
        const asSpectator = payload.asSpectator === true
        const participantIds = new Set(gameSessionPlayerIds(session))
        if (!asSpectator && !participantIds.has(userId)) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId,
            playerId: userId,
            reason: 'Only invited players can join as participants',
            status: 'held'
          }, actorId)
        }
        const existingJoin = findEvent('GameSessionJoined', joined => {
          return joined.gameId === payload.gameId &&
            joined.userId === userId &&
            joined.asSpectator === asSpectator
        })
        if (existingJoin) return existingJoin
        return append('GameSessionJoined', gameSessionJoinPayload({
          session,
          payload,
          actorId
        }), userId)
      }

      if (command.type === 'match:ingestEvent') {
        const matchEvent = normalizeMatchEventPayload(payload, actorId)
        if (!matchEvent.matchId) {
          return append('MatchEventRejected', {
            matchId: null,
            reason: 'matchId is required before match event ingestion',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== matchEvent.sourceActorId) {
          return append('MatchEventRejected', {
            matchId: matchEvent.matchId,
            eventId: matchEvent.eventId,
            reason: `Match event actorId must match sourceActorId ${matchEvent.sourceActorId}`,
            status: 'rejected'
          }, actorId)
        }
        const existingEvent = findEvent('MatchEventIngested', event => event.eventId === matchEvent.eventId)
        if (existingEvent) return existingEvent
        return append('MatchEventIngested', matchEvent, matchEvent.sourceActorId)
      }

      if (command.type === 'commentary:setLanguage') {
        return append('CommentaryLanguageSelected', {
          matchId: payload.matchId || null,
          language: normalizeLanguage(payload.language),
          selectedAt: '2026-07-01T00:00:00.000Z'
        }, actorId)
      }

      if (command.type === 'commentary:generate') {
        assertAdapterCanRun(adapters.qvacCommentary, 'generateSegment', awaitAdapters)
        const current = createView(log)
        const input = commentaryInputForPayload(payload, current)
        if (!input.matchId) {
          return appendCommentaryRejected({
            payload,
            reason: 'matchId is required before QVAC commentary generation',
            actorId
          })
        }
        if (!input.recentEvents.length) {
          return appendCommentaryRejected({
            payload: input,
            reason: 'Replayed match events are required before QVAC commentary generation',
            actorId
          })
        }
        const sourceEventIds = input.recentEvents.map(event => event.sourceEventId || event.workerEventId || event.eventId)
        const existingCommentary = findExistingCommentaryEvent({
          matchId: input.matchId,
          language: input.language,
          sourceEventIds,
          tone: input.tone
        })
        if (existingCommentary) return existingCommentary
        const commentaryActorId = qvacCommentaryCommandActorId(payload, actorId)
        return attemptAdapterResult(
          () => adapters.qvacCommentary.generateSegment(input),
          segment => appendVerifiedCommentarySegment({ segment, input, actorId: commentaryActorId }),
          error => appendCommentaryRejected({ payload: input, reason: error.message, actorId }),
          awaitAdapters
        )
      }

      if (command.type === 'wdk:createGameEscrow') {
        assertAdapterCanRun(adapters.tetherWdk, 'createGameEscrow', awaitAdapters)
        const escrowInput = gameEscrowInputForPayload(payload)
        if (!escrowInput.ok) {
          return appendGameEscrowCreationDispute({
            payload,
            reason: escrowInput.reason,
            actorId
          })
        }
        return attemptAdapterResult(
          () => adapters.tetherWdk.createGameEscrow(escrowInput.input),
          escrow => appendVerifiedGameEscrow({ payload: escrowInput.input, escrow, actorId }),
          null,
          awaitAdapters
        )
      }

      if (command.type === 'wdk:refundGameEscrow') {
        assertAdapterCanRun(adapters.tetherWdk, 'refundGameEscrow', awaitAdapters)
        const current = createView(log)
        const escrowId = payload.escrowId || (payload.escrow && payload.escrow.escrowId) || null
        const existingRefund = escrowId && current.escrowRefundsByEscrow[escrowId]
        if (existingRefund) return findEvent('TetherWdkEscrowRefunded', refund => refund.refundId === existingRefund.refundId)
        const escrow = payload.escrow || (escrowId && current.escrows[escrowId]) || null
        if (!escrow) {
          return appendGameEscrowRefundRejected({
            payload,
            reason: 'Locked escrow is required before WDK refund',
            actorId
          })
        }
        const existingRelease = Object.values(current.payouts).find(payout => payout.escrowId === escrow.escrowId)
        if (existingRelease) {
          return appendGameEscrowRefundRejected({
            payload: { ...payload, escrow },
            reason: 'Released WDK escrow cannot be refunded',
            actorId
          })
        }
        const disputeEvent = findLatestEvent('TetherWdkEscrowDisputed', dispute => {
          return dispute.escrowId === escrow.escrowId && dispute.rail === escrow.rail
        })
        if (!disputeEvent) {
          return appendGameEscrowRefundRejected({
            payload: { ...payload, escrow },
            reason: 'WDK escrow dispute is required before refund',
            actorId
          })
        }
        return attemptAdapterResult(
          () => adapters.tetherWdk.refundGameEscrow({
            escrow,
            reason: payload.reason || disputeEvent.payload.reason || 'game-escrow-refunded',
            refundUserIds: payload.refundUserIds,
            payoutAddress: payload.payoutAddress,
            payoutRecipients: payload.payoutRecipients
          }),
          refund => appendGameEscrowRefunded({ refund, escrow, actorId }),
          error => appendGameEscrowRefundRejected({ payload: { ...payload, escrow }, reason: error.message, actorId }),
          awaitAdapters
        )
      }

      if (command.type === 'wdk:createEntryIntent') {
        assertAdapterCanRun(adapters.tetherWdk, 'createEntryIntent', awaitAdapters)
        if (payload.userId && actorId !== payload.userId) {
          return append('TetherWdkEntryIntentRejected', {
            poolId: payload.poolId || null,
            entryId: payload.entryId || null,
            userId: payload.userId,
            amount: payload.amount || null,
            asset: payload.asset || 'USDT',
            reason: entryIntentSignerMismatchReason({ actorId, userId: payload.userId }),
            status: 'rejected'
          }, actorId)
        }
        return attemptAdapterResult(
          () => adapters.tetherWdk.createEntryIntent(payload),
          intent => append('TetherWdkEntryIntentCreated', intent, actorId),
          null,
          awaitAdapters
        )
      }

      if (command.type === 'wdk:confirmEntryIntent') {
        assertAdapterCanRun(adapters.tetherWdk, 'confirmEntryIntent', awaitAdapters)
        const current = createView(log)
        const intent = payload.intent || current.entryIntents[payload.intentId]
        const existingPayment = intent && current.entryPaymentsByIntent[intent.intentId]
        if (existingPayment) return findEvent('TetherWdkEntryConfirmed', payment => payment.intentId === intent.intentId)
        return attemptAdapterResult(
          () => adapters.tetherWdk.confirmEntryIntent({
            intent,
            confirmationId: payload.confirmationId
          }),
          payment => appendEntryPaymentConfirmed({ payment, intent, actorId }),
          error => appendEntryPaymentPending({ intent, payload, reason: error.message, actorId }),
          awaitAdapters
        )
      }

      if (command.type === 'wdk:reconcileEntryIntent') {
        const reconcileMethod = adapters.tetherWdk && typeof adapters.tetherWdk.reconcileEntryIntent === 'function'
          ? 'reconcileEntryIntent'
          : 'confirmEntryIntent'
        assertAdapterCanRun(adapters.tetherWdk, reconcileMethod, awaitAdapters)
        const current = createView(log)
        const intent = payload.intent || current.entryIntents[payload.intentId]
        const existingPayment = intent && current.entryPaymentsByIntent[intent.intentId]
        if (existingPayment) return findEvent('TetherWdkEntryConfirmed', payment => payment.intentId === intent.intentId)
        return attemptAdapterResult(
          () => adapters.tetherWdk[reconcileMethod]({
            intent,
            confirmationId: payload.confirmationId
          }),
          payment => mapEntryReconciliation({ payment, intent, actorId }),
          error => appendEntryPaymentPending({ intent, payload, reason: error.message, actorId }),
          awaitAdapters
        )
      }

      if (command.type === 'wdk:refundEntryIntent') {
        assertAdapterCanRun(adapters.tetherWdk, 'refundEntryIntent', awaitAdapters)
        const current = createView(log)
        const paymentId = payload.paymentId || (payload.payment && payload.payment.paymentId) || null
        const existingRefund = (paymentId && current.entryRefundsByPayment[paymentId]) ||
          (payload.intentId && current.entryRefundsByIntent[payload.intentId]) ||
          null
        if (existingRefund) return findEvent('TetherWdkEntryRefunded', refund => refund.refundId === existingRefund.refundId)
        const payment = payload.payment ||
          (paymentId && current.entryPayments[paymentId]) ||
          (payload.intentId && current.entryPaymentsByIntent[payload.intentId]) ||
          null
        if (!payment) {
          return appendEntryRefundRejected({
            payload,
            reason: 'Confirmed entry payment is required before WDK refund',
            actorId
          })
        }
        return attemptAdapterResult(
          () => adapters.tetherWdk.refundEntryIntent({
            payment,
            reason: payload.reason || 'entry-refunded'
          }),
          refund => appendEntryRefunded({ refund, payment, actorId }),
          error => appendEntryRefundRejected({ payload: { ...payload, payment }, reason: error.message, actorId }),
          awaitAdapters
        )
      }

      if (command.type === 'results:recordOfficialSnapshot') {
        return ensureOfficialResultsSnapshotEvent({
          poolId: payload.poolId,
          officialResults: payload.officialResults || {},
          rulesVersion: payload.rulesVersion || 'bracket-pool-v1',
          source: payload.source || payload.officialResultsSource || payload.officialResults && payload.officialResults.source || 'trusted-results-feed',
          sourceActorId: payload.sourceActorId || payload.officialResultsSourceActorId || payload.officialResults && payload.officialResults.sourceActorId,
          actorId
        })
      }

      if (command.type === 'bracket:submit') {
        const current = createView(log)
        const existing = payload.submissionId && current.bracketSubmissions[payload.submissionId]
        if (existing) return findEvent('BracketSubmissionLocked', submission => submission.submissionId === payload.submissionId)
        if (payload.userId && actorId !== payload.userId) {
          return append('BracketSubmissionRejected', {
            poolId: payload.poolId || null,
            entryId: payload.entryId || null,
            userId: payload.userId,
            reason: bracketSubmissionSignerMismatchReason({ actorId, userId: payload.userId }),
            status: 'rejected'
          }, actorId)
        }
        const submission = core.createBracketSubmission({
          poolId: payload.poolId,
          entryId: payload.entryId || null,
          paymentId: payload.paymentId || null,
          userId: payload.userId,
          username: payload.username || null,
          picks: payload.picks || {},
          rulesVersion: payload.rulesVersion || 'bracket-pool-v1'
        })
        const duplicate = findEvent('BracketSubmissionLocked', item => item.submissionId === submission.submissionId)
        if (duplicate) return duplicate
        return append('BracketSubmissionLocked', submission, actorId)
      }

      if (command.type === 'pool:resolveSettlement') {
        const current = createView(log)
        const confirmedEntries = confirmedEntriesForPool({
          poolId: payload.poolId,
          confirmedEntries: payload.confirmedEntries,
          current
        })
        const hasPayloadOfficialResults = Object.prototype.hasOwnProperty.call(payload, 'officialResults') && payload.officialResults !== undefined
        const currentSnapshot = current.officialResultsSnapshots[payload.poolId]
        const officialResults = hasPayloadOfficialResults
          ? payload.officialResults || {}
          : currentSnapshot && currentSnapshot.officialResults || {}
        const officialResultsEvent = ensureOfficialResultsSnapshotEvent({
          poolId: payload.poolId,
          officialResults,
          rulesVersion: payload.rulesVersion || currentSnapshot && currentSnapshot.rulesVersion || 'bracket-pool-v1',
          source: payload.officialResultsSource || payload.source || currentSnapshot && currentSnapshot.source || 'trusted-results-feed',
          sourceActorId: payload.officialResultsSourceActorId || payload.sourceActorId || currentSnapshot && currentSnapshot.sourceActorId,
          actorId
        })
        const officialResultsSourceEvent = officialResultsEvent && officialResultsEvent.type === 'OfficialResultsSnapshotRecorded'
          ? officialResultsEvent
          : null
        const paymentSourceEvents = poolPaymentSourceEvents({
          poolId: payload.poolId,
          confirmedEntries
        })
        const submissionSourceEvents = payload.bracketSubmissions
          ? []
          : bracketSubmissionSourceEvents({
              poolId: payload.poolId,
              confirmedEntries
            })
        const bracketSubmissions = payload.bracketSubmissions || submissionSourceEvents.map(event => event.payload)
        const sourceEvents = [...paymentSourceEvents, ...submissionSourceEvents, officialResultsSourceEvent].filter(Boolean)
        const sourceEventIds = paymentSourceEvents.length === confirmedEntries.length && confirmedEntries.length > 0 && officialResultsSourceEvent
          ? sourceEvents.map(event => event.eventId)
          : null
        const poolResult = core.createBracketPoolSettlementResult({
          poolId: payload.poolId,
          confirmedEntries,
          winnerUserIds: payload.winnerUserIds,
          bracketSubmissions,
          officialResults,
          rulesVersion: payload.rulesVersion,
          sourceEventIds,
          sourceEventMode: sourceEventIds ? 'worker-log' : 'deterministic'
        })
        return append('BracketPoolSettlementResolved', poolResult, actorId)
      }

      if (command.type === 'payout:declareRecipient') {
        if (!payload.poolId || !payload.userId || !payload.recipient) {
          return append('PayoutRecipientDeclarationRejected', {
            poolId: payload.poolId || null,
            userId: payload.userId || null,
            reason: 'poolId, userId, and recipient are required',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== payload.userId) {
          return append('PayoutRecipientDeclarationRejected', {
            poolId: payload.poolId,
            userId: payload.userId,
            reason: payoutRecipientSignerMismatchReason({ actorId, userId: payload.userId }),
            status: 'rejected'
          }, actorId)
        }
        return append('PayoutRecipientDeclared', {
          poolId: payload.poolId,
          userId: payload.userId,
          username: payload.username || null,
          teamId: payload.teamId || null,
          asset: payload.asset || 'USDT',
          recipient: payload.recipient,
          recipientHash: core.deterministicHash(String(payload.recipient)),
          status: 'active',
          declaredAt: '2026-07-01T00:00:00.000Z'
        }, actorId)
      }

      if (command.type === 'qvac:attestPoolSettlement') {
        assertAdapterCanRun(adapters.qvac, 'attestPoolSettlement', awaitAdapters)
        const poolId = payload.poolId || payload.poolResult && payload.poolResult.poolId
        const poolResultEvent = findEvent('BracketPoolSettlementResolved', result => result.poolId === poolId)
        const poolResult = poolResultEvent && poolResultEvent.payload
        if (!poolResult) {
          return appendPoolPayoutDispute({
            payload: {
              poolId: poolId || null,
              winnerUserIds: payload.poolResult && payload.poolResult.winnerUserIds || []
            },
            reason: 'Bracket pool settlement result event must be present in the worker log before QVAC attestation',
            actorId
          })
        }
        if (payload.poolResult && !samePayloadEvidence(payload.poolResult, poolResult)) {
          return appendPoolPayoutDispute({
            payload: {
              poolId,
              winnerUserIds: payload.poolResult.winnerUserIds || []
            },
            reason: 'QVAC pool attestation payload must match the replayed pool settlement event',
            actorId
          })
        }
        const sourceVerification = verifyPoolSourceEvents(poolResult)
        if (!sourceVerification.ok) {
          return appendPoolPayoutDispute({
            payload: {
              poolId: poolId || poolResult && poolResult.poolId,
              winnerUserIds: poolResult && poolResult.winnerUserIds || []
            },
            reason: sourceVerification.errors.join('; '),
            actorId
          })
        }
        return attemptAdapterResult(
          () => adapters.qvac.attestPoolSettlement({ poolResult }),
          attestation => appendVerifiedPoolAttestation({ poolResult, attestation, actorId }),
          null,
          awaitAdapters
        )
      }

      if (command.type === 'wdk:createPoolPayout') {
        assertAdapterCanRun(adapters.tetherWdk, 'createPoolPayout', awaitAdapters)
        const current = createView(log)
        const confirmedEntries = confirmedEntriesForPool({
          poolId: payload.poolId,
          confirmedEntries: payload.confirmedEntries,
          current
        })
        const payoutRecipients = payoutRecipientsForSettlementPayload(payload, current)
        const attestation = payload.qvacAttestation || current.poolAttestations[payload.poolId]
        const poolResult = current.poolResults[payload.poolId]
        if (poolResult) {
          const sourceVerification = verifyPoolSourceEvents(poolResult)
          if (!sourceVerification.ok) {
            return appendPoolPayoutDispute({
              payload,
              reason: sourceVerification.errors.join('; '),
              actorId
            })
          }
        }
        const loggedAttestation = verifyLoggedPoolAttestation({ poolId: payload.poolId, attestation })
        if (!loggedAttestation.ok) {
          return appendPoolPayoutDispute({
            payload,
            reason: loggedAttestation.errors.join('; '),
            actorId
          })
        }
        const verification = core.verifyQvacPoolSettlementAttestation({ poolResult, attestation })
        if (!verification.ok) {
          return appendPoolPayoutDispute({
            payload,
            reason: verification.errors.join('; '),
            actorId
          })
        }
        return attemptAdapterResult(
          () => adapters.tetherWdk.createPoolPayout({
            poolId: payload.poolId,
            confirmedEntries,
            winnerUserIds: payload.winnerUserIds,
            attestation,
            asset: payload.asset,
            payoutRecipients,
            payoutAddress: payload.payoutAddress,
            rulesVersion: payload.rulesVersion
          }),
          poolPayout => appendVerifiedPoolPayout({ payload, poolPayout, actorId }),
          error => appendPoolPayoutDispute({
            payload,
            reason: error.message,
            actorId
          }),
          awaitAdapters
        )
      }

      if (command.type === 'game:submitCommitment') {
        if (payload.playerId && actorId !== payload.playerId) {
          return appendPlayerEvidenceSignerDispute({
            payload,
            actorId,
            evidenceType: 'Commitment'
          })
        }
        return append('GameCommitmentSubmitted', payload, actorId)
      }

      if (command.type === 'game:revealInput') {
        if (payload.playerId && actorId !== payload.playerId) {
          return appendPlayerEvidenceSignerDispute({
            payload,
            actorId,
            evidenceType: 'Reveal'
          })
        }
        const current = createView(log)
        const key = `${payload.gameId}:${payload.roundId}:${payload.playerId}`
        const commitment = current.commitments[key]
        const valid = Boolean(commitment && core.verifyCommitment({
          commitment: commitment.commitment,
          gameId: payload.gameId,
          roundId: payload.roundId,
          playerId: payload.playerId,
          input: payload.input,
          nonce: payload.nonce
        }))

        if (!valid) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId,
            roundId: payload.roundId,
            playerId: payload.playerId,
            reason: 'Reveal did not match prior commitment'
          }, actorId)
        }

        return append('GameInputRevealed', payload, actorId)
      }

      if (command.type === 'game:submitRoundStateHash') {
        const identity = normalizeRoundIdentity(payload)
        if (!identity.ok) return appendRoundIdentityDispute({ payload, identity, actorId })
        if (!payload.gameId || !payload.playerId || !payload.stateHash) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId || null,
            roundId: identity.roundId,
            playerId: payload.playerId || null,
            reason: 'gameId, playerId, and stateHash are required before peer state hash submission',
            status: 'held'
          }, actorId)
        }
        if (actorId !== payload.playerId) {
          return appendPlayerEvidenceSignerDispute({
            payload: { ...payload, roundId: identity.roundId },
            actorId,
            evidenceType: 'Peer state hash'
          })
        }
        return append('GameRoundStateHashSubmitted', {
          gameId: payload.gameId,
          roundId: identity.roundId,
          roundIndex: identity.roundIndex,
          playerId: payload.playerId,
          stateHash: payload.stateHash,
          resolverVersion: payload.resolverVersion || core.resolverVersion,
          submittedAt: '2026-07-01T00:00:00.000Z'
        }, actorId)
      }

      if (command.type === 'game:recordForfeit') {
        const identity = normalizeRoundIdentity(payload)
        if (!identity.ok) return appendRoundIdentityDispute({ payload, identity, actorId })
        const { gameId, shooter, keeper } = payload
        const { roundId, roundIndex } = identity
        const participants = [
          shooter && shooter.id,
          keeper && keeper.id
        ].filter(Boolean)
        const forfeitingPlayerId = payload.forfeitingPlayerId || payload.playerId || null
        const winnerUserId = payload.winnerUserId || participants.find(userId => userId !== forfeitingPlayerId) || null
        const claimantUserId = payload.claimantUserId || winnerUserId
        const existingRound = findEvent('GameRoundResolved', result => result.gameId === gameId && result.roundId === roundId)
        if (existingRound) return existingRound
        if (!gameId || !shooter || !keeper || !forfeitingPlayerId || !winnerUserId) {
          return append('GameSessionDisputed', {
            gameId: gameId || null,
            roundId,
            playerId: forfeitingPlayerId,
            reason: 'gameId, shooter, keeper, forfeitingPlayerId, and winnerUserId are required before forfeit resolution',
            status: 'held'
          }, actorId)
        }
        if (!participants.includes(forfeitingPlayerId) || !participants.includes(winnerUserId) || forfeitingPlayerId === winnerUserId) {
          return append('GameSessionDisputed', {
            gameId,
            roundId,
            playerId: forfeitingPlayerId,
            reason: 'Forfeit winner and forfeiting player must be different round participants',
            status: 'held'
          }, actorId)
        }
        if (!forfeitClaimSignerMatches({ actorId, claimantUserId, winnerUserId, forfeitingPlayerId })) {
          return append('GameSessionDisputed', {
            gameId,
            roundId,
            playerId: claimantUserId,
            reason: forfeitClaimSignerMismatchReason({ actorId, claimantUserId }),
            status: 'held'
          }, actorId)
        }
        const evidence = roundEvidenceEvents({ gameId, roundId, shooter, keeper })
        const priorSourceEventIds = [
          evidence.shooterCommitmentEvent,
          evidence.keeperCommitmentEvent,
          evidence.shooterRevealEvent,
          evidence.keeperRevealEvent
        ].filter(Boolean).map(event => event.eventId)
        const forfeitEvent = append('GameRoundForfeitRecorded', {
          gameId,
          roundId,
          roundIndex,
          forfeitingPlayerId,
          winnerUserId,
          claimantUserId,
          reason: payload.reason || 'timeout',
          evidenceEventIds: priorSourceEventIds,
          recordedAt: '2026-07-01T00:00:00.000Z'
        }, actorId)
        const roundResult = core.createPenaltyClashForfeitRound({
          gameId,
          roundIndex,
          roundId,
          shooter,
          keeper,
          forfeitingPlayerId,
          winnerUserId,
          claimantUserId,
          reason: payload.reason || 'timeout',
          sourceEventIds: [...priorSourceEventIds, forfeitEvent.eventId]
        })
        return append('GameRoundResolved', roundResult, actorId)
      }

      if (command.type === 'game:resolveRound') {
        const current = createView(log)
        const identity = normalizeRoundIdentity(payload)
        if (!identity.ok) return appendRoundIdentityDispute({ payload, identity, actorId })
        const { gameId, shooter, keeper } = payload
        const { roundId, roundIndex } = identity
        const shooterReveal = current.reveals[`${gameId}:${roundId}:${shooter.id}`]
        const keeperReveal = current.reveals[`${gameId}:${roundId}:${keeper.id}`]
        const evidence = roundEvidenceEvents({ gameId, roundId, shooter, keeper })

        if (!shooterReveal || !keeperReveal) {
          return append('GameSessionDisputed', {
            gameId,
            roundId,
            reason: 'Both reveals are required before round resolution'
          }, actorId)
        }

        const baseSourceEventIds = [
          evidence.shooterCommitmentEvent,
          evidence.keeperCommitmentEvent,
          evidence.shooterRevealEvent,
          evidence.keeperRevealEvent
        ].map(event => event && event.eventId)
        if (baseSourceEventIds.some(eventId => !eventId)) {
          return append('GameSessionDisputed', {
            gameId,
            roundId,
            reason: 'Commitment and reveal source events are required before round resolution',
            status: 'held'
          }, actorId)
        }

        const roundResult = core.createPenaltyClashRound({
          gameId,
          roundIndex,
          shooter,
          keeper,
          shooterInput: shooterReveal.input,
          keeperInput: keeperReveal.input,
          shooterNonce: shooterReveal.nonce,
          keeperNonce: keeperReveal.nonce,
          sourceEventIds: baseSourceEventIds
        })
        const stateHashConsensus = verifyRoundStateHashConsensus({
          gameId,
          roundId,
          participantUserIds: [shooter.id, keeper.id],
          stateHash: roundResult.stateHash,
          resolverVersion: roundResult.resolverVersion
        })
        if (!stateHashConsensus.ok) {
          return append('GameSessionDisputed', {
            gameId,
            roundId,
            reason: stateHashConsensus.errors.join('; '),
            status: 'held'
          }, actorId)
        }
        const peerStateHashEventIds = stateHashConsensus.events.map(event => event.eventId)
        if (peerStateHashEventIds.length > 0) {
          roundResult.peerStateHashEventIds = peerStateHashEventIds
          roundResult.peerStateHashes = stateHashConsensus.events.map(event => ({
            eventId: event.eventId,
            playerId: event.payload.playerId,
            stateHash: event.payload.stateHash,
            resolverVersion: event.payload.resolverVersion || null
          }))
          roundResult.sourceEventIds = [...baseSourceEventIds, ...peerStateHashEventIds]
        }

        return append('GameRoundResolved', roundResult, actorId)
      }

      if (command.type === 'qvac:refereeAttest') {
        assertAdapterCanRun(adapters.qvac, 'attestRound', awaitAdapters)
        const identity = normalizeRoundIdentity(payload)
        if (!identity.ok) return appendRoundIdentityDispute({ payload, identity, actorId })
        const current = createView(log)
        const key = `${payload.gameId}:${identity.roundId}`
        const roundResult = current.roundResults[key]
        const sourceVerification = verifyRoundSourceEvents(roundResult)
        if (!sourceVerification.ok) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId,
            roundId: identity.roundId,
            reason: sourceVerification.errors.join('; '),
            status: 'held'
          }, actorId)
        }
        return attemptAdapterResult(
          () => adapters.qvac.attestRound({ roundResult }),
          attestation => appendVerifiedRoundAttestation({ roundResult, attestation, actorId }),
          null,
          awaitAdapters
        )
      }

      if (command.type === 'wdk:releaseGameEscrow') {
        assertAdapterCanRun(adapters.tetherWdk, 'releaseGameEscrow', awaitAdapters)
        const identity = normalizeRoundIdentity(payload)
        if (!identity.ok) {
          return appendEscrowDispute({
            payload,
            reason: identity.reason,
            actorId,
            awaitAdapters
          })
        }
        const current = createView(log)
        const escrow = current.escrows[payload.escrowId]
        if (payload.escrowId && current.escrowRefundsByEscrow[payload.escrowId]) {
          return appendEscrowDispute({
            payload,
            reason: 'Refunded WDK escrow cannot be released',
            actorId,
            awaitAdapters
          })
        }
        const attestation = payload.qvacAttestation || Object.values(current.attestations)
          .find(item => item.gameId === payload.gameId && item.roundId === identity.roundId)
        const roundResult = current.roundResults[`${payload.gameId}:${identity.roundId}`]
        const sourceVerification = verifyRoundSourceEvents(roundResult)
        if (!sourceVerification.ok) {
          return appendEscrowDispute({
            payload,
            reason: sourceVerification.errors.join('; '),
            actorId,
            awaitAdapters
          })
        }
        const targetVerification = verifyEscrowReleaseTarget({
          escrow,
          roundResult,
          attestation,
          winnerUserId: payload.winnerUserId
        })
        if (!targetVerification.ok) {
          return appendEscrowDispute({
            payload,
            reason: targetVerification.errors.join('; '),
            actorId,
            awaitAdapters
          })
        }
        const loggedAttestation = verifyLoggedRoundAttestation({ gameId: payload.gameId, roundId: identity.roundId, attestation })
        if (!loggedAttestation.ok) {
          return appendEscrowDispute({
            payload,
            reason: loggedAttestation.errors.join('; '),
            actorId,
            awaitAdapters
          })
        }
        const verification = core.verifyQvacRoundAttestation({ roundResult, attestation })

        if (!verification.ok) {
          return appendEscrowDispute({
            payload,
            reason: verification.errors.join('; '),
            actorId,
            awaitAdapters
          })
        }

        return attemptAdapterResult(
          () => adapters.tetherWdk.releaseGameEscrow({
            escrow,
            attestation,
            winnerUserId: payload.winnerUserId,
            payoutAddress: payload.payoutAddress,
            payoutRecipients: payload.payoutRecipients
          }),
          payout => appendVerifiedGameRelease({ payload, payout, actorId, awaitAdapters }),
          error => {
            return appendEscrowDispute({
              payload,
              reason: error.message,
              actorId,
              awaitAdapters
            })
          },
          awaitAdapters
        )
      }

      if (command.type === 'settlement:settleGameRound') {
        return awaitAdapters ? settleGameRoundAsync(payload, actorId) : settleGameRoundSync(payload, actorId)
      }

      if (command.type === 'settlement:settleBracketPool') {
        return awaitAdapters ? settleBracketPoolAsync(payload, actorId) : settleBracketPoolSync(payload, actorId)
      }

      if (command.type === 'settlement:recordReceipt') {
        return recordSettlementReceipt({ payload, actorId })
      }

      throw new Error(`Unsupported command: ${command.type}`)
    }

    function dispatch (command) {
      return completeAdapterResult(dispatchCommand(command, false), result => result, false)
    }

    function dispatchAsync (command) {
      return Promise.resolve(dispatchCommand(command, true))
    }

    return {
      dispatch,
      dispatchAsync,
      events: () => [...log],
      mergeEvents,
      adapterMode: () => ({ ...adapters.mode }),
      view: () => createView(log)
    }
  }

  const api = { createWorkerSim, createView, eventEnvelope, validateEventEnvelope, eventRoot, mergeUniqueEvents }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupWorkerSim = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupWorkerSim = 'event-log-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
