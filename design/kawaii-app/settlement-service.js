(function attachPearCupSettlementService (root) {
  const workerRuntimeFactory = root.PearCupWorkerRuntime || (typeof require !== 'undefined' ? require('./worker-runtime.js') : null)
  const settlementReceipts = root.PearCupSettlementReceipts || (typeof require !== 'undefined' ? require('./settlement-receipts.js') : null)
  if (!workerRuntimeFactory) throw new Error('PearCupWorkerRuntime is required before PearCupSettlementService')

  const SETTLEMENT_LOCKED_CODE = 'PEARCUP_SETTLEMENT_LOCKED'
  const prizeCommandTypes = new Set([
    'wdk:createGameEscrow',
    'wdk:createEntryIntent',
    'wdk:confirmEntryIntent',
    'wdk:reconcileEntryIntent',
    'payout:declareRecipient',
    'game:resolveRound',
    'results:recordOfficialSnapshot',
    'pool:resolveSettlement',
    'qvac:refereeAttest',
    'qvac:attestPoolSettlement',
    'wdk:releaseGameEscrow',
    'wdk:createPoolPayout',
    'settlement:settleGameRound',
    'settlement:settleBracketPool',
    'settlement:recordReceipt'
  ])

  function complianceRequirements (compliance = {}) {
    return {
      realMoneyEnabled: compliance.realMoneyEnabled === true,
      kycVerified: compliance.kycVerified === true,
      jurisdictionAllowed: compliance.jurisdictionAllowed === true,
      responsiblePlayAccepted: compliance.responsiblePlayAccepted === true
    }
  }

  function missingComplianceLabels (requirements) {
    const labels = []
    if (!requirements.realMoneyEnabled) labels.push('real money mode is not enabled')
    if (!requirements.kycVerified) labels.push('KYC is not verified')
    if (!requirements.jurisdictionAllowed) labels.push('jurisdiction is not allowed')
    if (!requirements.responsiblePlayAccepted) labels.push('responsible play terms are not accepted')
    return labels
  }

  function settlementGateFor (status = {}) {
    const readiness = status.readiness || {}
    const qvac = readiness.qvac || {}
    const tetherWdk = readiness.tetherWdk || {}
    const compliance = readiness.compliance || {}
    const settlement = readiness.settlement || {}
    const complianceFlags = complianceRequirements(compliance)
    const complianceReady = Object.values(complianceFlags).every(Boolean)
    const requirements = {
      qvacSdkReady: qvac.sdkReady === true,
      tetherWdkSdkReady: tetherWdk.sdkReady === true,
      complianceReady,
      compliance: complianceFlags
    }
    const missing = []

    if (!requirements.qvacSdkReady) {
      missing.push({
        key: 'qvac',
        label: 'QVAC referee SDK is not ready',
        source: qvac.source || 'unknown',
        mode: qvac.mode || (status.mode && status.mode.qvac) || 'unknown',
        missingMethods: qvac.missing || []
      })
    }
    if (!requirements.tetherWdkSdkReady) {
      missing.push({
        key: 'tetherWdk',
        label: 'Tether WDK rail is not ready',
        source: tetherWdk.source || 'unknown',
        mode: tetherWdk.mode || (status.mode && status.mode.tetherWdk) || 'unknown',
        missingMethods: tetherWdk.missing || []
      })
    }
    for (const label of missingComplianceLabels(complianceFlags)) {
      missing.push({
        key: 'compliance',
        label,
        source: 'runtime-compliance'
      })
    }

    const liveReady = settlement.status === 'live-ready' &&
      status.canUseRealMoney === true &&
      requirements.qvacSdkReady &&
      requirements.tetherWdkSdkReady &&
      complianceReady

    return {
      liveReady,
      status: settlement.status || 'unknown',
      label: settlement.label || 'Settlement readiness unknown',
      tone: settlement.tone || 'locked',
      requirements,
      missing,
      mode: status.mode || {}
    }
  }

  function createSettlementLockedError ({ gate, action }) {
    const detail = gate.missing.length
      ? gate.missing.map(item => item.label).join('; ')
      : 'settlement readiness is incomplete'
    const err = new Error(`Live settlement is locked for ${action}: ${detail}`)
    err.code = SETTLEMENT_LOCKED_CODE
    err.action = action
    err.gate = gate
    return err
  }

  function assertLiveSettlementReady (status, action = 'settlement') {
    const gate = settlementGateFor(status)
    if (!gate.liveReady) throw createSettlementLockedError({ gate, action })
    return gate
  }

  function commandActor (opts = {}, fallback = 'settlement-worker') {
    return opts.actorId || fallback
  }

  function createGuardedSettlementService ({
    workerRuntime,
    settings,
    rootObject = root,
    sdkPackages,
    compliance,
    storage,
    events,
    requireLive = true
  } = {}) {
    const harness = workerRuntime || workerRuntimeFactory.createPearCupWorkerRuntime({
      settings,
      rootObject,
      sdkPackages,
      compliance,
      storage,
      events
    })

    function status () {
      const current = typeof harness.status === 'function'
        ? harness.status()
        : {
            mode: harness.runtime && harness.runtime.mode,
            readiness: harness.runtime && harness.runtime.readiness,
            canUseRealMoney: harness.runtime && harness.runtime.canUseRealMoney
          }
      return {
        ...current,
        settlementGate: settlementGateFor(current),
        guardMode: requireLive ? 'live-only' : 'demo-allowed'
      }
    }

    function guardPrizeCommand (action) {
      const current = status()
      if (requireLive) assertLiveSettlementReady(current, action)
      return current.settlementGate
    }

    async function dispatchPrizeCommand ({ type, actorId, payload }) {
      if (!prizeCommandTypes.has(type)) throw new Error(`Unsupported prize command: ${type}`)
      guardPrizeCommand(type)
      return harness.dispatchAsync({ type, actorId, payload })
    }

    function createGameEscrow (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'wdk:createGameEscrow',
        actorId: commandActor(opts, 'tether-wdk'),
        payload
      })
    }

    function createEntryIntent (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'wdk:createEntryIntent',
        actorId: commandActor(opts, payload && payload.userId ? payload.userId : 'tether-wdk'),
        payload
      })
    }

    function confirmEntryIntent (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'wdk:confirmEntryIntent',
        actorId: commandActor(opts, 'tether-wdk'),
        payload
      })
    }

    function reconcileEntryIntent (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'wdk:reconcileEntryIntent',
        actorId: commandActor(opts, 'tether-wdk'),
        payload
      })
    }

    function declarePayoutRecipient (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'payout:declareRecipient',
        actorId: commandActor(opts, payload && payload.userId ? payload.userId : 'settlement-recipient'),
        payload
      })
    }

    function settleGameRound (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'settlement:settleGameRound',
        actorId: commandActor(opts),
        payload
      })
    }

    function settleBracketPool (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'settlement:settleBracketPool',
        actorId: commandActor(opts),
        payload
      })
    }

    function createSettlementReceipt (summary, opts = {}) {
      if (!settlementReceipts || typeof settlementReceipts.createSettlementReceipt !== 'function') {
        throw new Error('PearCupSettlementReceipts is required to create settlement receipts')
      }
      const current = status()
      const workerView = harness &&
        harness.worker &&
        typeof harness.worker.view === 'function'
        ? harness.worker.view()
        : null
      const provenance = opts.provenance || (
        typeof settlementReceipts.createRuntimeProvenance === 'function'
          ? settlementReceipts.createRuntimeProvenance({
              status: current,
              settings: current.settings
            })
          : null
      )
      return settlementReceipts.createSettlementReceipt({
        summary,
        eventRoot: opts.eventRoot || (workerView && workerView.eventRoot) || null,
        gate: opts.gate || current.settlementGate,
        mode: opts.mode || current.mode,
        runtimeId: current.id || 'pearcup-worker-runtime',
        provenance
      })
    }

    async function recordSettlementReceipt (summary, opts = {}) {
      guardPrizeCommand('settlement:recordReceipt')
      const workerView = harness &&
        harness.worker &&
        typeof harness.worker.view === 'function'
        ? harness.worker.view()
        : null
      const settlementEventId = summary &&
        summary.settlementEvent &&
        summary.settlementEvent.eventId
      if (
        settlementEventId &&
        workerView &&
        workerView.settlementReceiptEventsBySettlementEvent &&
        workerView.settlementReceiptEventsBySettlementEvent[settlementEventId]
      ) {
        const receiptEvent = workerView.settlementReceiptEventsBySettlementEvent[settlementEventId]
        return {
          receipt: receiptEvent.payload,
          receiptEvent,
          existing: true
        }
      }
      const receipt = createSettlementReceipt(summary, {
        ...opts,
        eventRoot: opts.eventRoot || (workerView && workerView.eventRoot) || null
      })
      const receiptEvent = await harness.dispatchAsync({
        type: 'settlement:recordReceipt',
        actorId: commandActor(opts, 'settlement-auditor'),
        payload: { receipt }
      })
      return {
        receipt: receiptEvent.payload,
        receiptEvent,
        existing: false
      }
    }

    async function settleGameRoundWithReceipt (payload, opts = {}) {
      if (harness && typeof harness.settleGameRoundWithReceipt === 'function') {
        if (requireLive) guardPrizeCommand('settlement:settleGameRound')
        return harness.settleGameRoundWithReceipt(payload, opts)
      }
      const summary = await settleGameRound(payload, opts)
      const recorded = await recordSettlementReceipt(summary, opts)
      return {
        summary,
        receipt: recorded.receipt,
        receiptEvent: recorded.receiptEvent,
        existingReceipt: recorded.existing
      }
    }

    async function settleBracketPoolWithReceipt (payload, opts = {}) {
      if (harness && typeof harness.settleBracketPoolWithReceipt === 'function') {
        if (requireLive) guardPrizeCommand('settlement:settleBracketPool')
        return harness.settleBracketPoolWithReceipt(payload, opts)
      }
      const summary = await settleBracketPool(payload, opts)
      const recorded = await recordSettlementReceipt(summary, opts)
      return {
        summary,
        receipt: recorded.receipt,
        receiptEvent: recorded.receiptEvent,
        existingReceipt: recorded.existing
      }
    }

    async function close () {
      if (harness && typeof harness.close === 'function') await harness.close()
    }

    return {
      harness,
      requireLive,
      status,
      assertLive: (action) => assertLiveSettlementReady(status(), action),
      createGameEscrow,
      createEntryIntent,
      confirmEntryIntent,
      reconcileEntryIntent,
      declarePayoutRecipient,
      settleGameRound,
      settleBracketPool,
      createSettlementReceipt,
      recordSettlementReceipt,
      settleGameRoundWithReceipt,
      settleBracketPoolWithReceipt,
      close
    }
  }

  const api = {
    SETTLEMENT_LOCKED_CODE,
    prizeCommandTypes,
    settlementGateFor,
    assertLiveSettlementReady,
    createSettlementLockedError,
    createGuardedSettlementService
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupSettlementService = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupSettlementService = 'settlement-service-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
