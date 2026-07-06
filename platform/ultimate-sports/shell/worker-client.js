(function attachPearCupWorkerClient (root) {
  function clone (value) {
    return value == null ? value : JSON.parse(JSON.stringify(value))
  }

  function emptyView () {
    return {
      eventRoot: null,
      typeCounts: {},
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
      entryPayments: {},
      entryPaymentChecks: {},
      payoutRecipientDeclarations: {},
      payoutRecipientDeclarationsByPool: {},
      poolPayouts: {},
      settlementReceipts: {},
      settlementReceiptsBySettlementEvent: {},
      settlementReceiptEventsBySettlementEvent: {},
      settlementReceiptRejections: [],
      disputes: []
    }
  }

  function createLocalWorkerClient ({ worker, runtime, workerFactory, storage, events = [] } = {}) {
    const localWorker = worker || (
      runtime && typeof runtime.createWorker === 'function'
        ? runtime.createWorker({ workerFactory, storage, events })
        : null
    )
    if (!localWorker) throw new Error('createLocalWorkerClient requires a worker or runtime.createWorker')

    return {
      kind: 'local',
      dispatch: command => localWorker.dispatch(command),
      dispatchAsync: command => localWorker.dispatchAsync(command),
      events: () => localWorker.events(),
      mergeEvents: events => localWorker.mergeEvents(events),
      mergeEventsAsync: async events => localWorker.mergeEvents(events),
      refresh: async () => ({
        view: clone(localWorker.view()),
        events: clone(localWorker.events())
      }),
      view: () => localWorker.view(),
      adapterMode: () => typeof localWorker.adapterMode === 'function' ? localWorker.adapterMode() : null,
      close: async () => {
        if (typeof localWorker.close === 'function') await localWorker.close()
      },
      localWorker
    }
  }

  function responsePayload (response) {
    if (response && response.ok === false) {
      const err = new Error(response.error || response.reason || 'Pear worker bridge request failed')
      err.response = response
      err.code = response.code
      err.gate = response.gate || response.status && response.status.settlementGate
      throw err
    }
    if (response && Object.prototype.hasOwnProperty.call(response, 'result')) return response.result
    if (response && Object.prototype.hasOwnProperty.call(response, 'payload')) return response.payload
    return response
  }

  function bridgeRequestFunction (bridge) {
    if (!bridge) return null
    if (typeof bridge === 'function') return bridge
    for (const name of ['request', 'call', 'invoke', 'send']) {
      if (typeof bridge[name] === 'function') return bridge[name].bind(bridge)
    }
    return null
  }

  function createBridgeWorkerClient ({ bridge, initialView, initialEvents = [] } = {}) {
    const request = bridgeRequestFunction(bridge)
    if (!request) throw new Error('createBridgeWorkerClient requires a request-capable bridge')
    let cachedView = clone(initialView) || emptyView()
    let cachedEvents = clone(initialEvents) || []
    let cachedStatus = null
    let requestIndex = 0

    function updateCache (response) {
      if (response && response.view) cachedView = clone(response.view)
      if (response && response.eventsIncluded === true && Array.isArray(response.events)) {
        cachedEvents = clone(response.events)
      } else if (response && response.eventsIncluded == null && Array.isArray(response.events)) {
        cachedEvents = clone(response.events)
      }
      if (response && response.status) cachedStatus = clone(response.status)
      return response
    }

    async function ask (action, payload = {}, opts = {}) {
      const requestPayload = opts.includeEvents
        ? { ...payload, includeEvents: true }
        : payload
      const envelope = {
        protocol: 'pearcup-worker-v1',
        requestId: `pearcup-worker-${++requestIndex}`,
        action,
        payload: requestPayload
      }
      return updateCache(await request(envelope))
    }

    async function dispatchAsync (command) {
      return responsePayload(await ask('dispatch', { command }))
    }

    async function mergeEventsAsync (events) {
      return responsePayload(await ask('mergeEvents', { events }, { includeEvents: true }))
    }

    async function settleGameRoundWithReceipt (payload, opts = {}) {
      return responsePayload(await ask('settleGameRoundWithReceipt', { payload, opts }))
    }

    async function settleBracketPoolWithReceipt (payload, opts = {}) {
      return responsePayload(await ask('settleBracketPoolWithReceipt', { payload, opts }))
    }

    async function refresh () {
      await ask('snapshot', {}, { includeEvents: true })
      return {
        view: clone(cachedView),
        events: clone(cachedEvents)
      }
    }

    return {
      kind: 'bridge',
      dispatch () {
        throw new Error('Pear bridge worker client requires dispatchAsync')
      },
      dispatchAsync,
      mergeEvents () {
        throw new Error('Pear bridge worker client requires mergeEventsAsync')
      },
      mergeEventsAsync,
      settleGameRoundWithReceipt,
      settleBracketPoolWithReceipt,
      refresh,
      events: () => clone(cachedEvents),
      view: () => clone(cachedView),
      status: () => clone(cachedStatus),
      adapterMode: () => cachedView && cachedView.adapterMode || null,
      close: async () => {
        if (bridge && typeof bridge.close === 'function') await bridge.close()
      }
    }
  }

  function detectBridge (rootObject = root) {
    if (!rootObject) return null
    return rootObject.PearCupWorkerBridge ||
      rootObject.__PEARCUP_WORKER_BRIDGE__ ||
      rootObject.PearCupBridge ||
      (rootObject.Pear && rootObject.Pear.worker) ||
      (rootObject.Pear && rootObject.Pear.bridge) ||
      null
  }

  function createAutoWorkerClient ({ rootObject = root, local, bridge, preferLocal = false } = {}) {
    if (preferLocal && typeof local === 'function') return local()
    const detectedBridge = bridge || detectBridge(rootObject)
    if (detectedBridge) return createBridgeWorkerClient({ bridge: detectedBridge })
    if (typeof local === 'function') return local()
    return createLocalWorkerClient(local)
  }

  const api = {
    createLocalWorkerClient,
    createBridgeWorkerClient,
    createAutoWorkerClient,
    detectBridge,
    emptyView
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupWorkerClient = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupWorkerClient = 'worker-client-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
