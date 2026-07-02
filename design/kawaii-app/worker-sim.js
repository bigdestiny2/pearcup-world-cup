(function attachPearCupWorkerSim (root) {
  const core = root.PearCupCore || (typeof require !== 'undefined' ? require('./core.js') : null)
  const adapterFactory = root.PearCupAdapters || (typeof require !== 'undefined' ? require('./adapters.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupWorkerSim')
  if (!adapterFactory) throw new Error('PearCupAdapters is required before PearCupWorkerSim')

  function getSettlementReceipts () {
    return root.PearCupSettlementReceipts || (typeof require !== 'undefined' ? require('./settlement-receipts.js') : null)
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

  function eventRefMatchesReplay (index, ref) {
    if (!ref || !ref.eventId) return false
    const event = index.byId.get(ref.eventId)
    if (!event) return false
    if (ref.type && event.type !== ref.type) return false
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
      escrow.gameId === attestation.gameId &&
      sameStringList(escrow.players, attestation.participantUserIds)
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
    if (!indexedSourceEventsPresent(index, attestation.sourceEventIds)) return false
    if (!core.verifyQvacPoolSettlementAttestation({ poolResult, attestation }).ok) return false

    const sourcePaymentIds = Array.isArray(payload.sourcePaymentIds) ? payload.sourcePaymentIds : []
    const paymentEvents = sourcePaymentIds.map(paymentId => {
      return findIndexedEvent(index, 'TetherWdkEntryConfirmed', payment => {
        return payment.paymentId === paymentId && (!payload.poolId || payment.poolId === payload.poolId)
      })
    })
    if (paymentEvents.some(event => !event)) return false
    const confirmedEntries = paymentEvents.map(event => event.payload)
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

    if (event.type === 'TetherWdkEscrowReleased') {
      return verifiedGameReleaseMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkPoolPayoutPrepared') {
      return verifiedPoolPayoutMatchesReplay(event, index)
    }

    if (event.type === 'SettlementReceiptCreated') {
      return settlementReceiptMatchesReplay(event, index)
    }

    return true
  }

  function createView (events) {
    const view = {
      events,
      commitments: {},
      reveals: {},
      roundResults: {},
      attestations: {},
      escrows: {},
      payouts: {},
      entryIntents: {},
      entryPayments: {},
      entryPaymentsByIntent: {},
      entryPaymentChecks: {},
      entryPaymentChecksByIntent: {},
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

    for (const event of events) {
      const payload = event.payload
      if (event.type === 'GameCommitmentSubmitted') {
        const key = `${payload.gameId}:${payload.roundId}:${payload.playerId}`
        view.commitments[key] = payload
      }
      if (event.type === 'GameInputRevealed') {
        const key = `${payload.gameId}:${payload.roundId}:${payload.playerId}`
        view.reveals[key] = payload
      }
      if (event.type === 'GameRoundResolved') {
        view.roundResults[`${payload.gameId}:${payload.roundId}`] = payload
      }
      if (event.type === 'QvacRefereeAttestationCreated') {
        view.attestations[`${payload.gameId}:${payload.roundId}`] = payload
      }
      if (event.type === 'TetherWdkEscrowCreated') {
        view.escrows[payload.escrowId] = payload
      }
      if (event.type === 'TetherWdkEscrowReleased') {
        view.payouts[payload.payoutId] = payload
      }
      if (event.type === 'TetherWdkEntryIntentCreated') {
        view.entryIntents[payload.intentId] = payload
      }
      if (event.type === 'TetherWdkEntryConfirmed') {
        view.entryPayments[payload.paymentId] = payload
        view.entryPaymentsByIntent[payload.intentId] = payload
      }
      if (event.type === 'TetherWdkEntryPaymentPending') {
        view.entryPaymentChecks[payload.checkId] = payload
        if (payload.intentId) view.entryPaymentChecksByIntent[payload.intentId] = payload
      }
      if (event.type === 'BracketSubmissionLocked') {
        view.bracketSubmissions[payload.submissionId] = payload
        if (!view.bracketSubmissionsByPool[payload.poolId]) view.bracketSubmissionsByPool[payload.poolId] = {}
        view.bracketSubmissionsByPool[payload.poolId][payload.userId] = payload
      }
      if (event.type === 'OfficialResultsSnapshotRecorded') {
        view.officialResultsSnapshots[payload.poolId] = payload
        view.officialResultsSnapshotEvents[payload.poolId] = event
      }
      if (event.type === 'PayoutRecipientDeclared') {
        const key = `${payload.poolId}:${payload.userId}`
        view.payoutRecipientDeclarations[key] = payload
        if (!view.payoutRecipientDeclarationsByPool[payload.poolId]) view.payoutRecipientDeclarationsByPool[payload.poolId] = {}
        view.payoutRecipientDeclarationsByPool[payload.poolId][payload.userId] = payload
      }
      if (event.type === 'BracketPoolSettlementResolved') {
        view.poolResults[payload.poolId] = payload
      }
      if (event.type === 'QvacPoolSettlementAttestationCreated') {
        view.poolAttestations[payload.poolId] = payload
      }
      if (event.type === 'TetherWdkPoolPayoutPrepared') {
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
      if (event.type === 'GameSessionDisputed' || event.type === 'TetherWdkEscrowDisputed' || event.type === 'TetherWdkPoolPayoutDisputed') {
        view.disputes.push(payload)
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
      }
      return { ok: errors.length === 0, errors }
    }

    function roundEvidenceEvents ({ gameId, roundId, shooter, keeper } = {}) {
      const shooterId = shooter && shooter.id
      const keeperId = keeper && keeper.id
      return {
        shooterCommitmentEvent: findEvent('GameCommitmentSubmitted', item => item.gameId === gameId && item.roundId === roundId && item.playerId === shooterId),
        keeperCommitmentEvent: findEvent('GameCommitmentSubmitted', item => item.gameId === gameId && item.roundId === roundId && item.playerId === keeperId),
        shooterRevealEvent: findEvent('GameInputRevealed', item => item.gameId === gameId && item.roundId === roundId && item.playerId === shooterId),
        keeperRevealEvent: findEvent('GameInputRevealed', item => item.gameId === gameId && item.roundId === roundId && item.playerId === keeperId)
      }
    }

    function verifyRoundSourceEvents (roundResult) {
      const errors = []
      if (!roundResult) return { ok: false, errors: ['Round result is required before source event verification'] }
      const sourceEventIds = Array.isArray(roundResult.sourceEventIds) ? roundResult.sourceEventIds : []
      if (sourceEventIds.length < 4) errors.push('Round result sourceEventIds must include commitment and reveal events')
      const byId = new Map(log.map(event => [event.eventId, event]))
      for (const eventId of sourceEventIds) {
        if (!byId.has(eventId)) errors.push(`Round source event ${eventId} is missing from the worker log`)
      }

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
            event.payload.playerId === playerId)
        if (!matched) errors.push(`Round source events missing ${type} for ${playerId || 'unknown-player'}`)
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
        return findEvent('BracketSubmissionLocked', submission => {
          return submission.poolId === poolId &&
            submission.userId === entry.userId &&
            (!submission.entryId || !entry.entryId || submission.entryId === entry.entryId)
        })
      }).filter(Boolean)
    }

    function officialResultsHash (officialResults = {}) {
      return core.deterministicHash(officialResults || {})
    }

    function officialResultsSnapshotPayload ({ poolId, officialResults = {}, rulesVersion = 'bracket-pool-v1', source = 'trusted-results-feed' } = {}) {
      const results = officialResults || {}
      const resultsHash = officialResultsHash(results)
      return {
        snapshotId: core.deterministicHash({
          type: 'OfficialResultsSnapshotRecorded',
          poolId,
          officialResultsHash: resultsHash,
          rulesVersion,
          source
        }),
        poolId,
        officialResults: results,
        officialResultsHash: resultsHash,
        rulesVersion,
        source,
        recordedAt: '2026-07-01T00:00:00.000Z'
      }
    }

    function officialResultsSnapshotEventFor ({ poolId, officialResults = {} } = {}) {
      const expectedHash = officialResultsHash(officialResults)
      return findEvent('OfficialResultsSnapshotRecorded', snapshot => {
        return snapshot.poolId === poolId && snapshot.officialResultsHash === expectedHash
      })
    }

    function ensureOfficialResultsSnapshotEvent ({ poolId, officialResults = {}, rulesVersion = 'bracket-pool-v1', source = 'trusted-results-feed', actorId }) {
      const existing = officialResultsSnapshotEventFor({ poolId, officialResults })
      if (existing) return existing
      return append('OfficialResultsSnapshotRecorded', officialResultsSnapshotPayload({
        poolId,
        officialResults,
        rulesVersion,
        source
      }), actorId)
    }

    function verifyPoolSourceEvents (poolResult) {
      const errors = []
      if (!poolResult) return { ok: false, errors: ['Pool settlement result is required before source event verification'] }
      if (poolResult.sourceEventMode !== 'worker-log') return { ok: true, errors }
      const sourceEventIds = Array.isArray(poolResult.sourceEventIds) ? poolResult.sourceEventIds : []
      const sourcePaymentIds = Array.isArray(poolResult.sourcePaymentIds) ? poolResult.sourcePaymentIds : []
      const sourceBracketSubmissionIds = Array.isArray(poolResult.sourceBracketSubmissionIds) ? poolResult.sourceBracketSubmissionIds : []
      if (sourceEventIds.length < sourcePaymentIds.length + sourceBracketSubmissionIds.length + 1) {
        errors.push('Pool result sourceEventIds must include confirmed entry payment events, bracket submissions, and official results snapshot')
      }

      const byId = new Map(log.map(event => [event.eventId, event]))
      for (const eventId of sourceEventIds) {
        if (!byId.has(eventId)) errors.push(`Pool source event ${eventId} is missing from the worker log`)
      }

      for (const paymentId of sourcePaymentIds) {
        const matched = sourceEventIds
          .map(eventId => byId.get(eventId))
          .some(event => event &&
            event.type === 'TetherWdkEntryConfirmed' &&
            event.payload &&
            event.payload.poolId === poolResult.poolId &&
            event.payload.paymentId === paymentId)
        if (!matched) errors.push(`Pool source events missing TetherWdkEntryConfirmed for ${paymentId || 'unknown-payment'}`)
      }

      for (const submissionId of sourceBracketSubmissionIds) {
        const matched = sourceEventIds
          .map(eventId => byId.get(eventId))
          .some(event => event &&
            event.type === 'BracketSubmissionLocked' &&
            event.payload &&
            event.payload.poolId === poolResult.poolId &&
            event.payload.submissionId === submissionId)
        if (!matched) errors.push(`Pool source events missing BracketSubmissionLocked for ${submissionId || 'unknown-submission'}`)
      }

      const expectedResultsHash = officialResultsHash(poolResult.officialResults || {})
      const matchedOfficialResults = sourceEventIds
        .map(eventId => byId.get(eventId))
        .some(event => event &&
          event.type === 'OfficialResultsSnapshotRecorded' &&
          event.payload &&
          event.payload.poolId === poolResult.poolId &&
          event.payload.officialResultsHash === expectedResultsHash)
      if (!matchedOfficialResults) {
        errors.push(`Pool source events missing OfficialResultsSnapshotRecorded for ${poolResult.poolId || 'unknown-pool'}`)
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
      const routeBlocked = released && isRecipientRequiredSettlement(settlementEvent)
      return {
        type: released && !routeBlocked
          ? 'TrustedGameSettlementCompleted'
          : 'TrustedGameSettlementHeld',
        status: released
          ? routeBlocked ? 'recipient-required' : 'prepared'
          : 'held',
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
        const payload = event.payload || {}
        if (payload.poolId !== poolId) continue
        if (wanted.size > 0 && !wanted.has(payload.userId)) continue
        latest.set(payload.userId, event)
      }
      return Array.from(latest.values())
    }

    function appendEscrowDispute ({ payload, reason, actorId, awaitAdapters }) {
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
            status: 'held'
          })
      return attemptAdapterResult(
        createDispute,
        dispute => append('TetherWdkEscrowDisputed', dispute, actorId),
        null,
        awaitAdapters
      )
    }

    function appendPoolPayoutDispute ({ payload, reason, actorId }) {
      return append('TetherWdkPoolPayoutDisputed', {
        disputeId: core.deterministicHash({
          poolId: payload.poolId,
          winnerUserIds: payload.winnerUserIds || [],
          reason
        }),
        poolId: payload.poolId,
        winnerUserIds: payload.winnerUserIds || [],
        reason,
        status: 'held'
      }, actorId)
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
      return append('TetherWdkEntryPaymentPending', pending, actorId)
    }

    function mapEntryReconciliation ({ payment, actorId }) {
      if (payment && payment.status === 'confirmed') return append('TetherWdkEntryConfirmed', payment, actorId)
      return append('TetherWdkEntryPaymentPending', payment || {
        checkId: core.deterministicHash({ reason: 'WDK reconciliation returned no payment status' }),
        status: 'pending',
        processorStatus: 'unknown',
        reason: 'WDK reconciliation returned no payment status',
        checkedAt: '2026-07-01T00:00:00.000Z'
      }, actorId)
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

      const existingAttestation = findEvent('QvacRefereeAttestationCreated', attestation => attestation.gameId === payload.gameId && attestation.roundId === roundId)
      const attestationEvent = existingAttestation || dispatchCommand({
        type: 'qvac:refereeAttest',
        actorId: payload.qvacActorId || actorId,
        payload: { gameId: payload.gameId, roundId }
      }, false)
      const winnerUserId = payload.winnerUserId || winnerFromRoundResult(roundEvent.payload)
      const existingRelease = findLatestEvent('TetherWdkEscrowReleased', payout => payout.escrowId === payload.escrowId)
      const retryRelease = shouldRetryGameRelease({ existingRelease, winnerUserId, payload })
      const settlementEvent = existingRelease && !retryRelease ? existingRelease : dispatchCommand({
        type: 'wdk:releaseGameEscrow',
        actorId: payload.wdkActorId || actorId,
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

      const existingAttestation = findEvent('QvacRefereeAttestationCreated', attestation => attestation.gameId === payload.gameId && attestation.roundId === roundId)
      const attestationEvent = existingAttestation || await dispatchCommand({
        type: 'qvac:refereeAttest',
        actorId: payload.qvacActorId || actorId,
        payload: { gameId: payload.gameId, roundId }
      }, true)
      const winnerUserId = payload.winnerUserId || winnerFromRoundResult(roundEvent.payload)
      const existingRelease = findLatestEvent('TetherWdkEscrowReleased', payout => payout.escrowId === payload.escrowId)
      const retryRelease = shouldRetryGameRelease({ existingRelease, winnerUserId, payload })
      const settlementEvent = existingRelease && !retryRelease ? existingRelease : await dispatchCommand({
        type: 'wdk:releaseGameEscrow',
        actorId: payload.wdkActorId || actorId,
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
      const existingAttestation = findEvent('QvacPoolSettlementAttestationCreated', attestation => attestation.poolId === payload.poolId)
      const attestationEvent = existingAttestation || dispatchCommand({
        type: 'qvac:attestPoolSettlement',
        actorId: payload.qvacActorId || actorId,
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
        actorId: payload.wdkActorId || actorId,
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
      const existingAttestation = findEvent('QvacPoolSettlementAttestationCreated', attestation => attestation.poolId === payload.poolId)
      const attestationEvent = existingAttestation || await dispatchCommand({
        type: 'qvac:attestPoolSettlement',
        actorId: payload.qvacActorId || actorId,
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
        actorId: payload.wdkActorId || actorId,
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

      if (command.type === 'wdk:createGameEscrow') {
        assertAdapterCanRun(adapters.tetherWdk, 'createGameEscrow', awaitAdapters)
        return attemptAdapterResult(
          () => adapters.tetherWdk.createGameEscrow(payload),
          escrow => append('TetherWdkEscrowCreated', escrow, actorId),
          null,
          awaitAdapters
        )
      }

      if (command.type === 'wdk:createEntryIntent') {
        assertAdapterCanRun(adapters.tetherWdk, 'createEntryIntent', awaitAdapters)
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
          payment => append('TetherWdkEntryConfirmed', payment, actorId),
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
          payment => mapEntryReconciliation({ payment, actorId }),
          error => appendEntryPaymentPending({ intent, payload, reason: error.message, actorId }),
          awaitAdapters
        )
      }

      if (command.type === 'results:recordOfficialSnapshot') {
        return ensureOfficialResultsSnapshotEvent({
          poolId: payload.poolId,
          officialResults: payload.officialResults || {},
          rulesVersion: payload.rulesVersion || 'bracket-pool-v1',
          source: payload.source || payload.officialResultsSource || 'trusted-results-feed',
          actorId
        })
      }

      if (command.type === 'bracket:submit') {
        const current = createView(log)
        const existing = payload.submissionId && current.bracketSubmissions[payload.submissionId]
        if (existing) return findEvent('BracketSubmissionLocked', submission => submission.submissionId === payload.submissionId)
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
        const confirmedEntries = payload.confirmedEntries || Object.values(current.entryPayments)
          .filter(payment => payment.poolId === payload.poolId)
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
          actorId
        })
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
        const sourceEvents = [...paymentSourceEvents, ...submissionSourceEvents, officialResultsEvent].filter(Boolean)
        const sourceEventIds = paymentSourceEvents.length === confirmedEntries.length && confirmedEntries.length > 0 && officialResultsEvent
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
          attestation => append('QvacPoolSettlementAttestationCreated', attestation, actorId),
          null,
          awaitAdapters
        )
      }

      if (command.type === 'wdk:createPoolPayout') {
        assertAdapterCanRun(adapters.tetherWdk, 'createPoolPayout', awaitAdapters)
        const current = createView(log)
        const confirmedEntries = payload.confirmedEntries || Object.values(current.entryPayments)
          .filter(payment => payment.poolId === payload.poolId)
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
          poolPayout => append('TetherWdkPoolPayoutPrepared', poolPayout, actorId),
          error => append('TetherWdkPoolPayoutDisputed', {
            poolId: payload.poolId,
            winnerUserIds: payload.winnerUserIds || [],
            reason: error.message,
            status: 'held'
          }, actorId),
          awaitAdapters
        )
      }

      if (command.type === 'game:submitCommitment') {
        return append('GameCommitmentSubmitted', payload, actorId)
      }

      if (command.type === 'game:revealInput') {
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

        const sourceEventIds = [
          evidence.shooterCommitmentEvent,
          evidence.keeperCommitmentEvent,
          evidence.shooterRevealEvent,
          evidence.keeperRevealEvent
        ].map(event => event && event.eventId)
        if (sourceEventIds.some(eventId => !eventId)) {
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
          sourceEventIds
        })

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
          attestation => append('QvacRefereeAttestationCreated', attestation, actorId),
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
          payout => append('TetherWdkEscrowReleased', payout, actorId),
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
