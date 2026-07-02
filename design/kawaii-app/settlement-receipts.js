(function attachPearCupSettlementReceipts (root) {
  const core = root.PearCupCore || (typeof require !== 'undefined' ? require('./core.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupSettlementReceipts')

  const receiptVersion = 'pearcup-settlement-receipt-v1'

  function clone (value) {
    return value == null ? null : JSON.parse(JSON.stringify(value))
  }

  function listHash (value) {
    return core.deterministicHash(Array.isArray(value) ? value.map(item => String(item)).sort() : [])
  }

  function eventRef (event) {
    if (!event) return null
    return {
      eventId: event.eventId,
      type: event.type,
      sequence: event.sequence,
      payloadHash: core.deterministicHash(event.payload || null)
    }
  }

  function serviceReadinessSnapshot (readiness = {}) {
    return {
      key: readiness.key || 'unknown',
      label: readiness.label || 'unknown',
      mode: readiness.mode || 'unknown',
      adapterId: readiness.adapterId || null,
      source: readiness.source || 'unknown',
      sdkDetected: readiness.sdkDetected === true,
      sdkReady: readiness.sdkReady === true,
      missing: Array.isArray(readiness.missing) ? [...readiness.missing] : []
    }
  }

  function settingsSnapshot (settings = {}) {
    return {
      source: settings.source
        ? {
            path: settings.source.path || null,
            loaded: settings.source.loaded === true
          }
        : { path: null, loaded: false },
      redactedHash: core.deterministicHash(settings || {}),
      qvacConfigured: Boolean(settings.sdkPackages && settings.sdkPackages.qvac),
      tetherWdkConfigured: Boolean(settings.sdkPackages && settings.sdkPackages.tetherWdk),
      tetherWdkSeedRedacted: Boolean(
        settings.sdkPackages &&
        settings.sdkPackages.tetherWdk &&
        settings.sdkPackages.tetherWdk.seedPhrase === '[redacted]'
      )
    }
  }

  function createRuntimeProvenance ({ status = {}, settings = status.settings || {} } = {}) {
    const readiness = status.readiness || {}
    return {
      runtimeId: status.id || 'pearcup-worker-runtime',
      mode: clone(status.mode || {}),
      guardMode: status.guardMode || 'unknown',
      canUseRealMoney: status.canUseRealMoney === true,
      settings: settingsSnapshot(settings),
      qvac: serviceReadinessSnapshot(readiness.qvac),
      tetherWdk: serviceReadinessSnapshot(readiness.tetherWdk),
      compliance: clone(readiness.compliance || {}),
      settlement: clone(readiness.settlement || {}),
      secrets: {
        wdkSeedExposed: status.secrets && status.secrets.wdkSeedExposed === true,
        wdkSeedRedacted: Boolean(
          settings &&
          settings.sdkPackages &&
          settings.sdkPackages.tetherWdk &&
          settings.sdkPackages.tetherWdk.seedPhrase === '[redacted]'
        )
      }
    }
  }

  function inferSettlementType (summary = {}) {
    if (summary.roundEvent || summary.type === 'TrustedGameSettlementCompleted' || summary.type === 'TrustedGameSettlementHeld') return 'game-round'
    if (summary.poolResultEvent || summary.type === 'TrustedPoolSettlementCompleted' || summary.type === 'TrustedPoolSettlementHeld') return 'bracket-pool'
    return 'unknown'
  }

  function gateSnapshot (gate = {}) {
    return {
      liveReady: gate.liveReady === true,
      status: gate.status || 'unknown',
      label: gate.label || 'Settlement readiness unknown',
      tone: gate.tone || 'locked',
      mode: clone(gate.mode || {}),
      missing: Array.isArray(gate.missing)
        ? gate.missing.map(item => ({
            key: item.key || 'unknown',
            label: item.label || 'unknown',
            source: item.source || 'unknown'
          }))
        : []
    }
  }

  function qvacSnapshot (attestationEvent) {
    const attestation = attestationEvent && attestationEvent.payload
    if (!attestation) return null
    return {
      eventId: attestationEvent.eventId,
      eventType: attestationEvent.type,
      attestationId: attestation.attestationId,
      refereeId: attestation.refereeId || null,
      ruling: attestation.ruling,
      stateHash: attestation.stateHash,
      officialResultsHash: attestation.officialResultsHash || null,
      confidence: attestation.confidence,
      sourceEventIdsHash: listHash(attestation.sourceEventIds),
      sourcePaymentIdsHash: attestation.sourcePaymentIds ? listHash(attestation.sourcePaymentIds) : null,
      sourceBracketSubmissionIdsHash: attestation.sourceBracketSubmissionIds ? listHash(attestation.sourceBracketSubmissionIds) : null,
      bracketScoreboardHash: attestation.bracketScoreboardHash || null,
      bracketResolvedBy: attestation.bracketResolvedBy || null,
      winnerUserIdHash: attestation.winnerUserId ? core.deterministicHash(String(attestation.winnerUserId)) : null,
      winnerUserIdsHash: attestation.winnerUserIds ? listHash(attestation.winnerUserIds) : null,
      participantUserIdsHash: attestation.participantUserIds ? listHash(attestation.participantUserIds) : null
    }
  }

  function processorTransferSnapshot (transfer = {}) {
    return {
      userIdHash: transfer.userId ? core.deterministicHash(String(transfer.userId)) : null,
      recipientHash: transfer.recipient ? core.deterministicHash(String(transfer.recipient)) : null,
      referenceHash: transfer.reference ? core.deterministicHash(String(transfer.reference)) : null,
      status: transfer.status || null,
      asset: transfer.asset || null,
      chain: transfer.chain || null,
      sourceAccountIndex: transfer.sourceAccountIndex == null ? null : transfer.sourceAccountIndex,
      amount: transfer.amount == null ? null : transfer.amount,
      baseAmount: transfer.baseAmount == null ? null : String(transfer.baseAmount),
      tokenHash: transfer.token ? core.deterministicHash(String(transfer.token)) : null,
      broadcast: transfer.broadcast === true,
      hash: transfer.hash || null,
      fee: transfer.fee == null ? null : String(transfer.fee)
    }
  }

  function transferStatusCounts (transfers = []) {
    return transfers.reduce((counts, transfer) => {
      const status = transfer.status || 'unknown'
      counts[status] = (counts[status] || 0) + 1
      return counts
    }, {})
  }

  function processorEvidenceSnapshot (processor = null) {
    if (!processor) return null
    const transfers = Array.isArray(processor.transfers)
      ? processor.transfers.map(processorTransferSnapshot)
      : []
    return {
      id: processor.id || null,
      status: processor.status || null,
      poolId: processor.poolId || null,
      escrowId: processor.escrowId || null,
      winnerUserIdHash: processor.winnerUserId ? core.deterministicHash(String(processor.winnerUserId)) : null,
      broadcast: processor.broadcast === true,
      missingRecipientUserIdsHash: processor.missingRecipientUserIds ? listHash(processor.missingRecipientUserIds) : null,
      transferCount: transfers.length,
      transferStatuses: transferStatusCounts(transfers),
      transfersHash: core.deterministicHash(transfers),
      transfers
    }
  }

  function wdkSnapshot (settlementEvent) {
    const settlement = settlementEvent && settlementEvent.payload
    if (!settlement) return null
    return {
      eventId: settlementEvent.eventId,
      eventType: settlementEvent.type,
      status: settlement.status || null,
      payoutId: settlement.payoutId || null,
      disputeId: settlement.disputeId || null,
      escrowId: settlement.escrowId || null,
      poolId: settlement.poolId || null,
      qvacAttestationId: settlement.qvacAttestationId || null,
      winnerUserId: settlement.winnerUserId || null,
      winnerUserIds: settlement.winnerUserIds || null,
      sourcePaymentIdsHash: settlement.sourcePaymentIds ? listHash(settlement.sourcePaymentIds) : null,
      grossPool: settlement.grossPool == null ? null : settlement.grossPool,
      amountEach: settlement.amountEach == null ? null : settlement.amountEach,
      asset: settlement.asset || null,
      rail: settlement.rail || null,
      reason: settlement.reason || null,
      processorPayout: processorEvidenceSnapshot(settlement.processorPayout),
      processorRelease: processorEvidenceSnapshot(settlement.processorRelease)
    }
  }

  function gameSnapshot (roundEvent) {
    const round = roundEvent && roundEvent.payload
    if (!round) return null
    return {
      gameId: round.gameId,
      roundId: round.roundId,
      resolverVersion: round.resolverVersion,
      outcome: round.outcome,
      stateHash: round.stateHash,
      sourceEventIdsHash: listHash(round.sourceEventIds),
      shooterId: round.shooter && round.shooter.id,
      keeperId: round.keeper && round.keeper.id
    }
  }

  function poolSnapshot (poolResultEvent) {
    const pool = poolResultEvent && poolResultEvent.payload
    if (!pool) return null
    return {
      poolId: pool.poolId,
      rulesVersion: pool.rulesVersion,
      ruling: pool.ruling,
      stateHash: pool.stateHash,
      officialResultsHash: pool.officialResultsHash || core.deterministicHash(pool.officialResults || {}),
      sourceEventMode: pool.sourceEventMode || null,
      entryCount: pool.entryCount,
      winnerUserIdsHash: listHash(pool.winnerUserIds),
      sourcePaymentIdsHash: listHash(pool.sourcePaymentIds),
      sourceBracketSubmissionIdsHash: pool.sourceBracketSubmissionIds ? listHash(pool.sourceBracketSubmissionIds) : null,
      bracketScoreboardHash: pool.bracketScoreboardHash || null,
      bracketResolvedBy: pool.bracketResolvedBy || null,
      sourceEventIdsHash: listHash(pool.sourceEventIds)
    }
  }

  function payoutRecipientDeclarationSnapshot (events = []) {
    const declarations = events.map(event => {
      const payload = event && event.payload || {}
      return {
        eventId: event.eventId,
        type: event.type,
        sequence: event.sequence,
        poolId: payload.poolId || null,
        userIdHash: payload.userId ? core.deterministicHash(String(payload.userId)) : null,
        recipientHash: payload.recipientHash || (payload.recipient ? core.deterministicHash(String(payload.recipient)) : null),
        asset: payload.asset || null,
        status: payload.status || null
      }
    })
    return {
      count: declarations.length,
      declarationsHash: core.deterministicHash(declarations),
      declarations
    }
  }

  function verifyProcessorEvidence ({ processor, label, errors }) {
    if (!processor) return
    const transfers = Array.isArray(processor.transfers) ? processor.transfers : []
    if (processor.transferCount !== transfers.length) {
      errors.push(`Settlement receipt WDK processor ${label} transfer count does not match transfers`)
    }
    if (processor.transfersHash !== core.deterministicHash(transfers)) {
      errors.push(`Settlement receipt WDK processor ${label} transfer hash does not match transfers`)
    }
    if (core.deterministicHash(processor.transferStatuses || {}) !== core.deterministicHash(transferStatusCounts(transfers))) {
      errors.push(`Settlement receipt WDK processor ${label} transfer status counts do not match transfers`)
    }
  }

  function verifyCompletedEventShape ({ payload, expected, errors }) {
    if (!payload.completed) return
    if (payload.summaryType !== expected.summaryType) {
      errors.push(`Settlement receipt completed path requires ${expected.summaryType}`)
    }
    if (payload.status !== 'prepared') {
      errors.push('Settlement receipt completed path requires prepared settlement status')
    }
    if (!payload.events || !payload.events.result || payload.events.result.type !== expected.resultType) {
      errors.push(`Settlement receipt completed path requires ${expected.resultType} result event`)
    }
    if (!payload.events || !payload.events.attestation || payload.events.attestation.type !== expected.attestationType) {
      errors.push(`Settlement receipt completed path requires ${expected.attestationType} event`)
    }
    if (!payload.events || !payload.events.settlement || payload.events.settlement.type !== expected.settlementType) {
      errors.push(`Settlement receipt completed path requires ${expected.settlementType} event`)
    }
    if (!payload.qvac || payload.qvac.eventType !== expected.attestationType) {
      errors.push(`Settlement receipt QVAC snapshot must reference ${expected.attestationType}`)
    }
    if (!payload.qvac || payload.qvac.ruling === 'disputed') {
      errors.push('Settlement receipt completed path requires non-disputed QVAC ruling')
    }
    if (expected.qvacRuling && (!payload.qvac || payload.qvac.ruling !== expected.qvacRuling)) {
      errors.push(`Settlement receipt completed path requires ${expected.qvacRuling} QVAC ruling`)
    }
    if (!payload.wdk || payload.wdk.eventType !== expected.settlementType) {
      errors.push(`Settlement receipt WDK snapshot must reference ${expected.settlementType}`)
    }
    if (!payload.wdk || payload.wdk.status !== 'prepared') {
      errors.push('Settlement receipt completed path requires prepared WDK settlement status')
    }
  }

  function verifyCompletedTrustedPath ({ payload, errors }) {
    if (!payload || payload.completed !== true) return
    if (!payload.qvac || !payload.qvac.attestationId) {
      errors.push('Settlement receipt completed path requires QVAC attestation id')
    }
    if (!payload.wdk || !payload.wdk.qvacAttestationId) {
      errors.push('Settlement receipt WDK settlement must reference QVAC attestation id')
    }
    if (payload.qvac && payload.wdk && payload.qvac.attestationId !== payload.wdk.qvacAttestationId) {
      errors.push('Settlement receipt QVAC attestation id does not match WDK settlement')
    }

    if (payload.settlementType === 'game-round') {
      verifyCompletedEventShape({
        payload,
        expected: {
          summaryType: 'TrustedGameSettlementCompleted',
          resultType: 'GameRoundResolved',
          attestationType: 'QvacRefereeAttestationCreated',
          settlementType: 'TetherWdkEscrowReleased',
          qvacRuling: null
        },
        errors
      })
      const qvacWinnerHash = payload.qvac && payload.qvac.winnerUserIdHash
      const wdkWinnerHash = payload.wdk && payload.wdk.winnerUserId
        ? core.deterministicHash(String(payload.wdk.winnerUserId))
        : null
      const processorWinnerHash = payload.wdk &&
        payload.wdk.processorRelease &&
        payload.wdk.processorRelease.winnerUserIdHash
      const gameParticipantHash = payload.game && payload.game.shooterId && payload.game.keeperId
        ? listHash([payload.game.shooterId, payload.game.keeperId])
        : null

      if (!qvacWinnerHash) errors.push('Settlement receipt game path requires QVAC winner hash')
      if (!wdkWinnerHash) errors.push('Settlement receipt game path requires WDK winner user id')
      if (qvacWinnerHash && wdkWinnerHash && qvacWinnerHash !== wdkWinnerHash) {
        errors.push('Settlement receipt WDK winner does not match QVAC winner')
      }
      if (processorWinnerHash && qvacWinnerHash && processorWinnerHash !== qvacWinnerHash) {
        errors.push('Settlement receipt WDK processor release winner does not match QVAC winner')
      }
      if (!payload.qvac || !payload.qvac.participantUserIdsHash) {
        errors.push('Settlement receipt game path requires QVAC participant hash')
      } else if (gameParticipantHash && payload.qvac.participantUserIdsHash !== gameParticipantHash) {
        errors.push('Settlement receipt QVAC participants do not match game participants')
      }
      if (payload.qvac && payload.game && payload.qvac.sourceEventIdsHash !== payload.game.sourceEventIdsHash) {
        errors.push('Settlement receipt QVAC source events do not match game result')
      }
    }

    if (payload.settlementType === 'bracket-pool') {
      verifyCompletedEventShape({
        payload,
        expected: {
          summaryType: 'TrustedPoolSettlementCompleted',
          resultType: 'BracketPoolSettlementResolved',
          attestationType: 'QvacPoolSettlementAttestationCreated',
          settlementType: 'TetherWdkPoolPayoutPrepared',
          qvacRuling: 'verified'
        },
        errors
      })
      const wdkWinnerIdsHash = payload.wdk && payload.wdk.winnerUserIds ? listHash(payload.wdk.winnerUserIds) : null
      if (!payload.qvac || !payload.qvac.winnerUserIdsHash) {
        errors.push('Settlement receipt pool path requires QVAC winner ids hash')
      }
      if (!payload.pool || !payload.pool.winnerUserIdsHash) {
        errors.push('Settlement receipt pool path requires pool winner ids hash')
      }
      if (!payload.qvac || !payload.qvac.officialResultsHash) {
        errors.push('Settlement receipt pool path requires QVAC official results hash')
      }
      if (!payload.pool || !payload.pool.officialResultsHash) {
        errors.push('Settlement receipt pool path requires pool official results hash')
      }
      if (payload.qvac && payload.pool && payload.qvac.winnerUserIdsHash !== payload.pool.winnerUserIdsHash) {
        errors.push('Settlement receipt QVAC pool winners do not match pool result')
      }
      if (payload.qvac && payload.pool && payload.qvac.officialResultsHash !== payload.pool.officialResultsHash) {
        errors.push('Settlement receipt QVAC official results do not match pool result')
      }
      if (payload.qvac && wdkWinnerIdsHash && payload.qvac.winnerUserIdsHash !== wdkWinnerIdsHash) {
        errors.push('Settlement receipt WDK pool winners do not match QVAC winners')
      }
      if (payload.qvac && payload.pool && payload.qvac.sourcePaymentIdsHash !== payload.pool.sourcePaymentIdsHash) {
        errors.push('Settlement receipt QVAC payment evidence does not match pool result')
      }
      if (payload.pool && payload.pool.sourceBracketSubmissionIdsHash) {
        if (!payload.qvac || payload.qvac.sourceBracketSubmissionIdsHash !== payload.pool.sourceBracketSubmissionIdsHash) {
          errors.push('Settlement receipt QVAC bracket submission evidence does not match pool result')
        }
        if (payload.qvac && payload.qvac.bracketScoreboardHash !== payload.pool.bracketScoreboardHash) {
          errors.push('Settlement receipt QVAC bracket scoreboard does not match pool result')
        }
      }
      if (payload.qvac && payload.pool && payload.qvac.sourceEventIdsHash !== payload.pool.sourceEventIdsHash) {
        errors.push('Settlement receipt QVAC source events do not match pool result')
      }
      if (payload.wdk && payload.pool && payload.wdk.sourcePaymentIdsHash && payload.wdk.sourcePaymentIdsHash !== payload.pool.sourcePaymentIdsHash) {
        errors.push('Settlement receipt WDK payment evidence does not match pool result')
      }
    }
  }

  function createSettlementReceipt ({
    summary,
    eventRoot = null,
    gate = {},
    mode = null,
    runtimeId = 'pearcup-worker-runtime',
    provenance = null
  } = {}) {
    if (!summary) throw new Error('Settlement summary is required for a receipt')
    const settlementType = inferSettlementType(summary)
    const resultEvent = summary.roundEvent || summary.poolResultEvent || null
    const gateState = gateSnapshot({
      ...gate,
      mode: mode || gate.mode
    })
    const payload = {
      receiptVersion,
      createdAt: '2026-07-01T00:00:00.000Z',
      trustedPath: 'qvac-referee-to-tether-wdk',
      runtimeId,
      settlementType,
      summaryType: summary.type || null,
      status: summary.status || 'unknown',
      completed: summary.type === 'TrustedGameSettlementCompleted' || summary.type === 'TrustedPoolSettlementCompleted',
      eventRoot,
      gate: gateState,
      provenance: provenance ? clone(provenance) : null,
      events: {
        result: eventRef(resultEvent),
        attestation: eventRef(summary.attestationEvent),
        settlement: eventRef(summary.settlementEvent)
      },
      game: settlementType === 'game-round' ? gameSnapshot(summary.roundEvent) : null,
      pool: settlementType === 'bracket-pool' ? poolSnapshot(summary.poolResultEvent) : null,
      payoutRecipients: settlementType === 'bracket-pool'
        ? payoutRecipientDeclarationSnapshot(summary.recipientDeclarationEvents || [])
        : null,
      qvac: qvacSnapshot(summary.attestationEvent),
      wdk: wdkSnapshot(summary.settlementEvent)
    }
    const receiptHash = core.deterministicHash(payload)
    return {
      receiptId: core.deterministicHash({ receiptVersion, receiptHash }),
      receiptHash,
      ...payload
    }
  }

  function verifySettlementReceipt (receipt) {
    const errors = []
    if (!receipt) {
      return { ok: false, errors: ['Settlement receipt is required'] }
    }
    const { receiptId, receiptHash, ...payload } = receipt
    const expectedHash = core.deterministicHash(payload)
    const expectedId = core.deterministicHash({ receiptVersion: payload.receiptVersion, receiptHash: expectedHash })
    if (payload.receiptVersion !== receiptVersion) errors.push('Settlement receipt version is unsupported')
    if (receiptHash !== expectedHash) errors.push('Settlement receipt hash does not match payload')
    if (receiptId !== expectedId) errors.push('Settlement receipt id does not match hash')
    if (!payload.eventRoot) errors.push('Settlement receipt event root is required')
    if (!payload.events || !payload.events.attestation) errors.push('Settlement receipt QVAC attestation event is required')
    if (!payload.events || !payload.events.settlement) errors.push('Settlement receipt WDK settlement event is required')
    if (payload.provenance && payload.provenance.secrets && payload.provenance.secrets.wdkSeedExposed === true) {
      errors.push('Settlement receipt provenance reports exposed WDK seed material')
    }
    verifyCompletedTrustedPath({ payload, errors })
    if (payload.wdk) {
      verifyProcessorEvidence({
        processor: payload.wdk.processorPayout,
        label: 'payout',
        errors
      })
      verifyProcessorEvidence({
        processor: payload.wdk.processorRelease,
        label: 'release',
        errors
      })
    }
    if (
      payload.payoutRecipients &&
      payload.payoutRecipients.count !== payload.payoutRecipients.declarations.length
    ) {
      errors.push('Settlement receipt payout recipient declaration count does not match declarations')
    }
    if (
      payload.payoutRecipients &&
      payload.payoutRecipients.declarationsHash !== core.deterministicHash(payload.payoutRecipients.declarations)
    ) {
      errors.push('Settlement receipt payout recipient declaration hash does not match declarations')
    }
    return { ok: errors.length === 0, errors }
  }

  const api = {
    receiptVersion,
    createSettlementReceipt,
    verifySettlementReceipt,
    createRuntimeProvenance,
    eventRef,
    listHash,
    transferStatusCounts
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupSettlementReceipts = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupSettlementReceipts = receiptVersion
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
