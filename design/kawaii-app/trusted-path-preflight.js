(function attachPearCupTrustedPathPreflight (root) {
  const core = root.PearCupCore || (typeof require !== 'undefined' ? require('./core.js') : null)
  const runtimeSettings = root.PearCupRuntimeSettings || (typeof require !== 'undefined' ? require('./runtime-settings.js') : null)
  const workerRuntime = root.PearCupWorkerRuntime || (typeof require !== 'undefined' ? require('./worker-runtime.js') : null)
  const settlementService = root.PearCupSettlementService || (typeof require !== 'undefined' ? require('./settlement-service.js') : null)
  const settlementReceipts = root.PearCupSettlementReceipts || (typeof require !== 'undefined' ? require('./settlement-receipts.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupTrustedPathPreflight')
  if (!runtimeSettings) throw new Error('PearCupRuntimeSettings is required before PearCupTrustedPathPreflight')
  if (!workerRuntime) throw new Error('PearCupWorkerRuntime is required before PearCupTrustedPathPreflight')
  if (!settlementService) throw new Error('PearCupSettlementService is required before PearCupTrustedPathPreflight')
  if (!settlementReceipts) throw new Error('PearCupSettlementReceipts is required before PearCupTrustedPathPreflight')

  const defaultPoolId = 'pool-trusted-path-preflight'
  const defaultGameId = 'pc-trusted-path-preflight'
  const defaultRoundId = 'pc-1'
  const preflightWinner = { id: 'user-captain', username: 'captain', teamId: 'br' }
  const preflightRunner = { id: 'user-vera', username: 'vera', teamId: 'no' }
  const preflightShooterInput = {
    role: 'shooter',
    aimZone: 'right-high',
    powerBand: 3,
    curveBand: 1,
    releaseTick: 42
  }
  const preflightKeeperInput = {
    role: 'keeper',
    diveZone: 'right-high',
    releaseTick: 43
  }

  function clone (value) {
    return value == null ? null : JSON.parse(JSON.stringify(value))
  }

  function confirmedEntry ({ poolId, user, amount, index }) {
    return {
      paymentId: core.deterministicHash({
        type: 'TrustedPathPreflightPayment',
        poolId,
        userId: user.id,
        index
      }),
      poolId,
      entryId: `${poolId}-${user.id}`,
      userId: user.id,
      username: user.username,
      amount,
      asset: 'USDT',
      status: 'confirmed',
      rail: 'trusted-path-preflight'
    }
  }

  function createConfirmedEntries ({ poolId = defaultPoolId, amount = 25 } = {}) {
    return [
      confirmedEntry({ poolId, user: preflightWinner, amount, index: 0 }),
      confirmedEntry({ poolId, user: preflightRunner, amount, index: 1 })
    ]
  }

  function preflightWinningPicks () {
    return {
      'r16-1': 'br',
      'qf-1': 'br',
      'semi-1': 'br',
      final: 'br'
    }
  }

  function preflightRunnerPicks () {
    return {
      'r16-1': 'br',
      'qf-1': 'no',
      'semi-1': 'no',
      final: 'no'
    }
  }

  async function createWorkerConfirmedEntries ({
    service,
    poolId = defaultPoolId,
    amount = 25,
    users = [preflightWinner, preflightRunner]
  } = {}) {
    if (
      !service ||
      typeof service.createEntryIntent !== 'function' ||
      typeof service.confirmEntryIntent !== 'function'
    ) {
      return createConfirmedEntries({ poolId, amount })
    }

    const confirmedEntries = []
    for (const [index, user] of users.entries()) {
      const intentEvent = await service.createEntryIntent({
        poolId,
        entryId: `${poolId}-${user.id}`,
        userId: user.id,
        username: user.username,
        amount,
        asset: 'USDT'
      }, { actorId: user.id })
      const paymentEvent = await service.confirmEntryIntent({
        intentId: intentEvent.payload.intentId,
        confirmationId: `trusted-path-${user.id}-${index}`
      }, { actorId: 'tether-wdk-trusted-path' })
      confirmedEntries.push(paymentEvent.payload)
    }
    return confirmedEntries
  }

  async function createWorkerBracketSubmissions ({
    service,
    poolId = defaultPoolId,
    confirmedEntries = [],
    rulesVersion = 'bracket-pool-v1'
  } = {}) {
    const harness = service && service.harness
    if (!harness || typeof harness.dispatchAsync !== 'function') return []

    const events = []
    for (const entry of confirmedEntries) {
      const picks = entry.userId === preflightWinner.id
        ? preflightWinningPicks()
        : preflightRunnerPicks()
      events.push(await harness.dispatchAsync({
        type: 'bracket:submit',
        actorId: entry.userId,
        payload: {
          poolId,
          entryId: entry.entryId,
          paymentId: entry.paymentId,
          userId: entry.userId,
          username: entry.username,
          picks,
          rulesVersion
        }
      }))
    }
    return events
  }

  function wdkSettingsFrom (settings = {}) {
    return settings.sdkPackages && (settings.sdkPackages.tetherWdk || settings.sdkPackages.tetherWDK) || {}
  }

  function payoutRecipientsFrom ({ settings = {}, payoutRecipients, payoutAddress, winnerUserIds = [preflightWinner.id] } = {}) {
    if (payoutRecipients) return clone(payoutRecipients)
    const wdk = wdkSettingsFrom(settings)
    const configured = wdk.payoutRecipients || {}
    const recipients = {}
    for (const userId of winnerUserIds) {
      if (configured[userId]) recipients[userId] = configured[userId]
      else if (payoutAddress || wdk.defaultPayoutAddress) recipients[userId] = payoutAddress || wdk.defaultPayoutAddress
    }
    return recipients
  }

  function payoutRouteForUser ({ settings = {}, userId, payoutAddress } = {}) {
    const wdk = wdkSettingsFrom(settings)
    const configured = wdk.payoutRecipients || {}
    const recipient = userId && configured[userId]
      ? configured[userId]
      : payoutAddress || wdk.defaultPayoutAddress || null
    return {
      available: Boolean(recipient),
      source: recipient
        ? userId && configured[userId]
            ? 'payoutRecipients'
            : payoutAddress
                ? 'payoutAddress'
                : 'defaultPayoutAddress'
        : 'missing',
      recipientHash: recipient ? core.deterministicHash(String(recipient)) : null
    }
  }

  function compactStatus (status = {}) {
    return {
      mode: clone(status.mode || {}),
      guardMode: status.guardMode,
      liveReady: Boolean(status.settlementGate && status.settlementGate.liveReady),
      settlementStatus: status.settlementGate && status.settlementGate.status,
      missing: status.settlementGate && Array.isArray(status.settlementGate.missing)
        ? status.settlementGate.missing.map(item => ({
            key: item.key,
            label: item.label,
            source: item.source
          }))
        : []
    }
  }

  function compactProcessorEvidence (processor) {
    return processor
      ? {
          id: processor.id,
          status: processor.status,
          broadcast: processor.broadcast,
          transferCount: processor.transferCount,
          transferStatuses: processor.transferStatuses,
          transfersHash: processor.transfersHash,
          missingRecipientUserIdsHash: processor.missingRecipientUserIdsHash
        }
      : null
  }

  function compactReceipt (receipt = {}) {
    const wdk = receipt.wdk || {}
    const processor = wdk.processorPayout
    const release = wdk.processorRelease
    const declarations = receipt.payoutRecipients
    return {
      receiptId: receipt.receiptId,
      receiptHash: receipt.receiptHash,
      settlementType: receipt.settlementType,
      eventRoot: receipt.eventRoot,
      qvacAttestationId: receipt.qvac && receipt.qvac.attestationId,
      wdkPayoutId: wdk.payoutId,
      wdkEscrowId: wdk.escrowId,
      wdkStatus: wdk.status,
      wdkEventType: wdk.eventType,
      wdkQvacAttestationId: wdk.qvacAttestationId,
      game: receipt.game
        ? {
            gameId: receipt.game.gameId,
            roundId: receipt.game.roundId,
            outcome: receipt.game.outcome,
            stateHash: receipt.game.stateHash,
            sourceEventIdsHash: receipt.game.sourceEventIdsHash
          }
        : null,
      pool: receipt.pool
        ? {
            poolId: receipt.pool.poolId,
            rulesVersion: receipt.pool.rulesVersion,
            sourceEventMode: receipt.pool.sourceEventMode,
            sourcePaymentIdsHash: receipt.pool.sourcePaymentIdsHash,
            sourceBracketSubmissionIdsHash: receipt.pool.sourceBracketSubmissionIdsHash,
            bracketScoreboardHash: receipt.pool.bracketScoreboardHash,
            bracketResolvedBy: receipt.pool.bracketResolvedBy,
            officialResultsHash: receipt.pool.officialResultsHash,
            sourceEventIdsHash: receipt.pool.sourceEventIdsHash
          }
        : null,
      payoutRecipients: declarations
        ? {
            count: declarations.count,
            declarationsHash: declarations.declarationsHash
          }
        : null,
      processorPayout: compactProcessorEvidence(processor),
      processorRelease: compactProcessorEvidence(release)
    }
  }

  function verifyReceiptEvidence (receipt) {
    if (!receipt || typeof settlementReceipts.verifySettlementReceipt !== 'function') {
      return {
        ok: false,
        errors: ['Settlement receipt verifier is unavailable']
      }
    }
    const verification = settlementReceipts.verifySettlementReceipt(receipt)
    return {
      ok: verification.ok === true,
      errors: Array.isArray(verification.errors) ? [...verification.errors] : []
    }
  }

  function processorEvidenceReady (processor) {
    const status = processor && processor.status
    const transferCount = processor && processor.transferCount
    const transferStatuses = processor && processor.transferStatuses || {}
    return Boolean(
      processor &&
      ['quoted', 'planned', 'broadcast'].includes(status) &&
      status !== 'recipient-required' &&
      Number.isInteger(transferCount) &&
      transferCount > 0 &&
      transferStatuses[status] > 0 &&
      typeof processor.transfersHash === 'string'
    )
  }

  async function declarePayoutRecipients ({ service, poolId, winnerUserIds = [], recipients = {}, entries = [], asset = 'USDT' } = {}) {
    if (!service || typeof service.declarePayoutRecipient !== 'function') return []
    const entryByUserId = new Map(entries.map(entry => [entry.userId, entry]))
    const events = []
    for (const userId of winnerUserIds) {
      const recipient = recipients[userId]
      if (!recipient) continue
      const entry = entryByUserId.get(userId) || {}
      const event = await service.declarePayoutRecipient({
        poolId,
        userId,
        username: entry.username || null,
        asset,
        recipient
      }, {
        actorId: userId
      })
      events.push(event)
    }
    return events
  }

  async function submitGameRoundEvidence ({
    service,
    gameId = defaultGameId,
    roundId = defaultRoundId,
    shooter = preflightWinner,
    keeper = preflightRunner,
    shooterInput = preflightShooterInput,
    keeperInput = preflightKeeperInput
  } = {}) {
    const harness = service && service.harness
    if (!harness || typeof harness.dispatchAsync !== 'function') return []
    const shooterCommitment = core.createCommitment({
      gameId,
      roundId,
      playerId: shooter.id,
      input: shooterInput,
      nonce: 'trusted-path-shooter-nonce'
    })
    const keeperCommitment = core.createCommitment({
      gameId,
      roundId,
      playerId: keeper.id,
      input: keeperInput,
      nonce: 'trusted-path-keeper-nonce'
    })
    const commands = [
      {
        type: 'game:submitCommitment',
        actorId: shooter.id,
        payload: { gameId, roundId, playerId: shooter.id, commitment: shooterCommitment }
      },
      {
        type: 'game:submitCommitment',
        actorId: keeper.id,
        payload: { gameId, roundId, playerId: keeper.id, commitment: keeperCommitment }
      },
      {
        type: 'game:revealInput',
        actorId: shooter.id,
        payload: {
          gameId,
          roundId,
          playerId: shooter.id,
          input: shooterInput,
          nonce: 'trusted-path-shooter-nonce'
        }
      },
      {
        type: 'game:revealInput',
        actorId: keeper.id,
        payload: {
          gameId,
          roundId,
          playerId: keeper.id,
          input: keeperInput,
          nonce: 'trusted-path-keeper-nonce'
        }
      }
    ]
    const events = []
    for (const command of commands) events.push(await harness.dispatchAsync(command))
    return events
  }

  async function runTrustedPathPreflight ({
    settings,
    env,
    rootObject = root,
    service,
    requireLive = false,
    allowBroadcast = false,
    poolId = defaultPoolId,
    amount = 25,
    payoutAddress,
    payoutRecipients,
    officialResults = {
      matchWinners: preflightWinningPicks(),
      source: 'trusted-path-preflight'
    }
  } = {}) {
    const loadedSettings = settings || runtimeSettings.loadRuntimeSettings({ env: env || (typeof process !== 'undefined' ? process.env : {}) })
    const wdk = wdkSettingsFrom(loadedSettings)
    const ownsService = !service
    const activeService = service || settlementService.createGuardedSettlementService({
      workerRuntime: workerRuntime.createPearCupWorkerRuntime({
        settings: loadedSettings,
        rootObject
      })
    })

    try {
      const status = activeService.status()
      const compact = compactStatus(status)
      const seed = wdk.seedPhrase
      if (seed && JSON.stringify(status).includes(seed)) {
        throw new Error('trusted path preflight status leaked the WDK seed phrase')
      }

      const report = {
        id: 'pearcup-trusted-path-preflight',
        ok: true,
        skipped: false,
        liveReady: compact.liveReady,
        status: compact,
        receipt: null,
        summary: null,
        reason: null
      }

      if (!compact.liveReady) {
        report.skipped = true
        report.reason = 'requires SDK-ready QVAC, SDK-ready Tether WDK, and all compliance flags'
        if (requireLive) report.ok = false
        return report
      }

      if (wdk.broadcastPayouts === true && allowBroadcast !== true) {
        return {
          ...report,
          ok: false,
          reason: 'broadcastPayouts is enabled; trusted path preflight refuses to broadcast funds'
        }
      }

      const confirmedEntries = await createWorkerConfirmedEntries({
        service: activeService,
        poolId,
        amount
      })
      const bracketSubmissionEvents = await createWorkerBracketSubmissions({
        service: activeService,
        poolId,
        confirmedEntries,
        rulesVersion: 'bracket-pool-v1'
      })
      const bracketSubmissions = bracketSubmissionEvents.map(event => event.payload).filter(Boolean)
      const bracketResolution = core.deriveBracketPoolWinners({
        bracketSubmissions,
        officialResults,
        eligibleUserIds: confirmedEntries.map(entry => entry.userId)
      })
      const winnerUserIds = bracketResolution.winnerUserIds.length
        ? bracketResolution.winnerUserIds
        : [preflightWinner.id]
      const recipients = payoutRecipientsFrom({
        settings: loadedSettings,
        payoutRecipients,
        payoutAddress,
        winnerUserIds
      })
      const declarationEvents = await declarePayoutRecipients({
        service: activeService,
        poolId,
        winnerUserIds,
        recipients,
        entries: confirmedEntries,
        asset: 'USDT'
      })
      const settlementPayload = {
        poolId,
        confirmedEntries,
        officialResults,
        asset: 'USDT',
        rulesVersion: 'bracket-pool-v1'
      }
      if (bracketSubmissionEvents.length === 0) settlementPayload.winnerUserIds = winnerUserIds
      const result = await activeService.settleBracketPoolWithReceipt(settlementPayload)
      const processor = result.receipt && result.receipt.wdk && result.receipt.wdk.processorPayout
      const receiptVerification = verifyReceiptEvidence(result.receipt)
      const declarationCount = result.receipt && result.receipt.payoutRecipients
        ? result.receipt.payoutRecipients.count
        : declarationEvents.length
      const declarationsOk = declarationCount >= winnerUserIds.length
      const processorReady = processorEvidenceReady(processor)
      const ok = processorReady && declarationsOk && receiptVerification.ok
      return {
        ...report,
        ok,
        reason: ok
          ? null
          : !receiptVerification.ok
              ? `settlement receipt verification failed: ${receiptVerification.errors.join('; ')}`
              : declarationsOk
                  ? 'WDK processor payout evidence was missing, empty, or still requires recipients'
                  : 'payout recipient declaration evidence was missing',
        summary: {
          type: result.summary.type,
          settlementStatus: result.summary.status,
          poolResultEvent: result.summary.poolResultEvent && result.summary.poolResultEvent.type,
          attestationEvent: result.summary.attestationEvent && result.summary.attestationEvent.type,
          settlementEvent: result.summary.settlementEvent && result.summary.settlementEvent.type,
          receiptEvent: result.receiptEvent && result.receiptEvent.type,
          bracketSubmissionEvents: bracketSubmissionEvents.map(event => event.type),
          bracketResolvedBy: result.summary.poolResultEvent && result.summary.poolResultEvent.payload && result.summary.poolResultEvent.payload.bracketResolvedBy,
          recipientDeclarationEvents: declarationEvents.map(event => event.type)
        },
        receiptVerification,
        receipt: compactReceipt(result.receipt),
        eventCount: activeService.harness && activeService.harness.worker && activeService.harness.worker.events
          ? activeService.harness.worker.events().length
          : null
      }
    } finally {
      if (ownsService && activeService && typeof activeService.close === 'function') await activeService.close()
    }
  }

  async function runTrustedGamePreflight ({
    settings,
    env,
    rootObject = root,
    service,
    requireLive = false,
    allowBroadcast = false,
    gameId = defaultGameId,
    amount = 1,
    asset = 'USDT',
    payoutAddress,
    payoutRecipients
  } = {}) {
    const loadedSettings = settings || runtimeSettings.loadRuntimeSettings({ env: env || (typeof process !== 'undefined' ? process.env : {}) })
    const wdk = wdkSettingsFrom(loadedSettings)
    const ownsService = !service
    const activeService = service || settlementService.createGuardedSettlementService({
      workerRuntime: workerRuntime.createPearCupWorkerRuntime({
        settings: loadedSettings,
        rootObject
      })
    })

    try {
      const status = activeService.status()
      const compact = compactStatus(status)
      const seed = wdk.seedPhrase
      if (seed && JSON.stringify(status).includes(seed)) {
        throw new Error('trusted game preflight status leaked the WDK seed phrase')
      }

      const report = {
        id: 'pearcup-trusted-game-preflight',
        ok: true,
        skipped: false,
        liveReady: compact.liveReady,
        status: compact,
        receipt: null,
        summary: null,
        reason: null
      }

      if (!compact.liveReady) {
        report.skipped = true
        report.reason = 'requires SDK-ready QVAC, SDK-ready Tether WDK, and all compliance flags'
        if (requireLive) report.ok = false
        return report
      }

      if (wdk.broadcastPayouts === true && allowBroadcast !== true) {
        return {
          ...report,
          ok: false,
          reason: 'broadcastPayouts is enabled; trusted game preflight refuses to broadcast funds'
        }
      }

      const escrowEvent = await activeService.createGameEscrow({
        gameId,
        players: [preflightWinner.id, preflightRunner.id],
        amount,
        asset
      })
      const evidenceEvents = await submitGameRoundEvidence({
        service: activeService,
        gameId,
        shooter: preflightWinner,
        keeper: preflightRunner
      })
      const gamePayoutRecipients = payoutRecipientsFrom({
        settings: loadedSettings,
        payoutRecipients,
        payoutAddress,
        winnerUserIds: [preflightWinner.id, preflightRunner.id]
      })
      const result = await activeService.settleGameRoundWithReceipt({
        gameId,
        roundIndex: 0,
        shooter: preflightWinner,
        keeper: preflightRunner,
        escrowId: escrowEvent.payload.escrowId,
        payoutAddress,
        payoutRecipients: gamePayoutRecipients
      })
      const receipt = compactReceipt(result.receipt)
      const receiptVerification = verifyReceiptEvidence(result.receipt)
      const release = result.receipt && result.receipt.wdk && result.receipt.wdk.processorRelease
      const winnerUserId = result.summary &&
        result.summary.settlementEvent &&
        result.summary.settlementEvent.payload &&
        result.summary.settlementEvent.payload.winnerUserId
      const recipientRoute = payoutRouteForUser({
        settings: loadedSettings,
        userId: winnerUserId,
        payoutAddress
      })
      const qvacLinked = Boolean(
        result.receipt &&
        result.receipt.qvac &&
        result.receipt.wdk &&
        result.receipt.qvac.attestationId === result.receipt.wdk.qvacAttestationId
      )
      const releaseOk = processorEvidenceReady(release)
      const settlementOk = result.summary &&
        result.summary.type === 'TrustedGameSettlementCompleted' &&
        result.summary.settlementEvent &&
        result.summary.settlementEvent.type === 'TetherWdkEscrowReleased'
      const ok = settlementOk && qvacLinked && releaseOk && recipientRoute.available && receiptVerification.ok
      return {
        ...report,
        ok,
        reason: ok
          ? null
          : !receiptVerification.ok
              ? `settlement receipt verification failed: ${receiptVerification.errors.join('; ')}`
              : !recipientRoute.available
                  ? 'game winner payout recipient route was missing'
                  : !settlementOk
                      ? 'trusted game settlement did not complete through WDK escrow release'
                      : !qvacLinked
                          ? 'game receipt QVAC attestation did not match WDK release'
                          : 'WDK processor release evidence was missing, empty, or still requires recipients',
        summary: {
          type: result.summary.type,
          settlementStatus: result.summary.status,
          escrowEvent: escrowEvent.type,
          evidenceEvents: evidenceEvents.map(event => event.type),
          roundEvent: result.summary.roundEvent && result.summary.roundEvent.type,
          attestationEvent: result.summary.attestationEvent && result.summary.attestationEvent.type,
          settlementEvent: result.summary.settlementEvent && result.summary.settlementEvent.type,
          receiptEvent: result.receiptEvent && result.receiptEvent.type,
          winnerUserIdHash: winnerUserId ? core.deterministicHash(String(winnerUserId)) : null,
          winnerRecipientRoute: recipientRoute
        },
        receiptVerification,
        receipt,
        eventCount: activeService.harness && activeService.harness.worker && activeService.harness.worker.events
          ? activeService.harness.worker.events().length
          : null
      }
    } finally {
      if (ownsService && activeService && typeof activeService.close === 'function') await activeService.close()
    }
  }

  async function runTrustedPathsPreflight (opts = {}) {
    const loadedSettings = opts.settings || runtimeSettings.loadRuntimeSettings({ env: opts.env || (typeof process !== 'undefined' ? process.env : {}) })
    const activeService = opts.service || settlementService.createGuardedSettlementService({
      workerRuntime: workerRuntime.createPearCupWorkerRuntime({
        settings: loadedSettings,
        rootObject: opts.rootObject || root
      })
    })
    const ownsService = !opts.service

    try {
      const pool = await runTrustedPathPreflight({
        ...opts,
        settings: loadedSettings,
        service: activeService
      })
      const game = await runTrustedGamePreflight({
        ...opts,
        settings: loadedSettings,
        service: activeService,
        payoutAddress: opts.gamePayoutAddress || opts.payoutAddress,
        payoutRecipients: opts.gamePayoutRecipients || opts.payoutRecipients
      })
      return {
        id: 'pearcup-trusted-paths-preflight',
        ok: pool.ok === true && game.ok === true,
        liveReady: pool.liveReady === true && game.liveReady === true,
        skipped: pool.skipped === true && game.skipped === true,
        pool,
        game,
        summary: {
          pool: pool.summary,
          game: game.summary
        }
      }
    } finally {
      if (ownsService && activeService && typeof activeService.close === 'function') await activeService.close()
    }
  }

  function formatTrustedPathPreflightReport (report) {
    if (report && report.pool && report.game) {
      const lines = ['PearCup trusted paths preflight']
      lines.push(`${report.ok ? 'ok' : 'not ok'} - trusted paths: ${report.ok ? 'passed' : 'blocked'}`)
      lines.push(report.pool.ok
        ? 'ok - bracket payout trusted path passed'
        : `not ok - bracket payout trusted path: ${report.pool.reason || 'unknown'}`)
      lines.push(report.game.ok
        ? 'ok - game escrow trusted path passed'
        : `not ok - game escrow trusted path: ${report.game.reason || 'unknown'}`)
      if (report.pool.receipt) lines.push(`ok - bracket receipt: ${report.pool.receipt.receiptId}`)
      if (report.game.receipt) lines.push(`ok - game receipt: ${report.game.receipt.receiptId}`)
      return lines.join('\n')
    }
    const lines = ['PearCup trusted path preflight']
    lines.push(`${report.ok ? 'ok' : 'not ok'} - settlement gate: ${report.status.settlementStatus}`)
    if (report.skipped) {
      lines.push(`ok - trusted path skipped: ${report.reason}`)
      return lines.join('\n')
    }
    if (report.reason) lines.push(`not ok - ${report.reason}`)
    if (report.summary) {
      lines.push(`ok - trusted path events: ${report.summary.poolResultEvent} -> ${report.summary.attestationEvent} -> ${report.summary.settlementEvent}`)
      lines.push(`ok - receipt event: ${report.summary.receiptEvent}`)
      if (report.summary.recipientDeclarationEvents) {
        lines.push(`ok - recipient declarations: ${report.summary.recipientDeclarationEvents.length}`)
      }
      if (report.summary.bracketSubmissionEvents) {
        lines.push(`ok - bracket submissions: ${report.summary.bracketSubmissionEvents.length}`)
      }
    }
    if (report.receipt) {
      lines.push(`ok - receipt: ${report.receipt.receiptId}`)
      if (report.receipt.pool) {
        lines.push(`ok - pool source events: ${report.receipt.pool.sourceEventMode || 'unknown'} ${report.receipt.pool.sourceEventIdsHash}`)
        if (report.receipt.pool.sourceBracketSubmissionIdsHash) {
          lines.push(`ok - bracket scoreboard: ${report.receipt.pool.bracketResolvedBy || 'unknown'} ${report.receipt.pool.bracketScoreboardHash}`)
        }
      }
      if (report.receipt.processorRelease) {
        lines.push(`ok - processor release: ${report.receipt.processorRelease.status}, transfers=${report.receipt.processorRelease.transferCount}`)
      }
      if (report.receipt.payoutRecipients) {
        lines.push(`ok - payout recipient declarations hash: ${report.receipt.payoutRecipients.declarationsHash}`)
      }
      if (report.receipt.processorPayout) {
        lines.push(`ok - processor payout: ${report.receipt.processorPayout.status}, transfers=${report.receipt.processorPayout.transferCount}`)
      }
    }
    return lines.join('\n')
  }

  const api = {
    runTrustedPathPreflight,
    runTrustedGamePreflight,
    runTrustedPathsPreflight,
    formatTrustedPathPreflightReport,
    createConfirmedEntries,
    payoutRecipientsFrom,
    declarePayoutRecipients,
    payoutRouteForUser,
    verifyReceiptEvidence,
    processorEvidenceReady,
    submitGameRoundEvidence
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupTrustedPathPreflight = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
