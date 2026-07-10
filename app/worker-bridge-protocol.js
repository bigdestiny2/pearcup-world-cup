(function attachPearCupWorkerBridgeProtocol (root) {
  const workerRuntimeFactory = root.PearCupWorkerRuntime || (typeof require !== 'undefined' ? require('./worker-runtime.js') : null)
  const settlementServiceFactory = root.PearCupSettlementService || (typeof require !== 'undefined' ? require('./settlement-service.js') : null)

  if (!workerRuntimeFactory) throw new Error('PearCupWorkerRuntime is required before PearCupWorkerBridgeProtocol')
  if (!settlementServiceFactory) throw new Error('PearCupSettlementService is required before PearCupWorkerBridgeProtocol')

  const protocolVersion = 'pearcup-worker-v1'

  function clone (value) {
    return value == null ? value : JSON.parse(JSON.stringify(value))
  }

  function redactMapValues (value = {}) {
    return Object.fromEntries(Object.keys(value).map(key => [key, '[redacted]']))
  }

  function redactWorkerValue (value, key = '') {
    if (value == null) return value
    if (key === 'seed' || key === 'seedPhrase' || key === 'payoutAddress' || key === 'defaultPayoutAddress' || key === 'recipient') {
      return typeof value === 'string' && value ? '[redacted]' : value
    }
    if (key === 'payoutRecipients' && value && typeof value === 'object' && !Array.isArray(value)) {
      return redactMapValues(value)
    }
    if (Array.isArray(value)) return value.map(item => redactWorkerValue(item))
    if (typeof value === 'object') {
      const redacted = {}
      for (const [childKey, childValue] of Object.entries(value)) {
        redacted[childKey] = redactWorkerValue(childValue, childKey)
      }
      return redacted
    }
    return value
  }

  function assertNoSecretLeak ({ response, settings }) {
    const seed = settings &&
      settings.sdkPackages &&
      settings.sdkPackages.tetherWdk &&
      settings.sdkPackages.tetherWdk.seedPhrase
    if (seed && JSON.stringify(response).includes(seed)) {
      throw new Error('Pear worker bridge response leaked the WDK seed phrase')
    }
    return true
  }

  function workerViewFrom (harness) {
    return harness &&
      harness.worker &&
      typeof harness.worker.view === 'function'
      ? harness.worker.view()
      : {}
  }

  function workerEventsFrom (harness) {
    return harness &&
      harness.worker &&
      typeof harness.worker.events === 'function'
      ? harness.worker.events()
      : []
  }

  function workerAdapterModeFrom (harness) {
    return harness &&
      harness.worker &&
      typeof harness.worker.adapterMode === 'function'
      ? harness.worker.adapterMode()
      : null
  }

  function createSnapshot ({ service, harness, includeEvents = false } = {}) {
    const activeHarness = harness || service && service.harness
    const view = clone(workerViewFrom(activeHarness)) || {}
    const adapterMode = workerAdapterModeFrom(activeHarness)
    if (adapterMode) view.adapterMode = adapterMode
    return {
      status: service && typeof service.status === 'function' ? service.status() : null,
      view,
      events: includeEvents ? workerEventsFrom(activeHarness) : []
    }
  }

  function createOkResponse ({ envelope = {}, result, service, harness, settings, includeEvents = false } = {}) {
    const snapshot = createSnapshot({ service, harness, includeEvents })
    const response = {
      protocol: protocolVersion,
      requestId: envelope.requestId || null,
      ok: true,
      result,
      status: snapshot.status,
      view: snapshot.view,
      eventsIncluded: includeEvents === true,
      events: snapshot.events
    }
    const redacted = redactWorkerValue(response)
    assertNoSecretLeak({ response: redacted, settings })
    return redacted
  }

  function createErrorResponse ({ envelope = {}, err, service, harness, settings } = {}) {
    const snapshot = createSnapshot({ service, harness, includeEvents: false })
    const response = {
      protocol: protocolVersion,
      requestId: envelope.requestId || null,
      ok: false,
      error: err && err.message || 'Pear worker bridge request failed',
      code: err && err.code || 'PEARCUP_WORKER_BRIDGE_ERROR',
      action: envelope.action || null,
      status: snapshot.status,
      view: snapshot.view,
      eventsIncluded: false,
      events: []
    }
    const redacted = redactWorkerValue(response)
    assertNoSecretLeak({ response: redacted, settings })
    return redacted
  }

  function assertEnvelope (envelope) {
    if (!envelope || typeof envelope !== 'object') throw new Error('Pear worker bridge envelope is required')
    if (envelope.protocol !== protocolVersion) throw new Error(`Unsupported PearCup worker protocol: ${envelope.protocol || 'missing'}`)
    if (!envelope.action) throw new Error('Pear worker bridge action is required')
  }

  function envelopeWantsEvents (envelope = {}) {
    const payload = envelope.payload || {}
    return envelope.includeEvents === true || payload.includeEvents === true
  }

  function createGuardedDispatcher ({ service, harness }) {
    const prizeCommands = settlementServiceFactory.prizeCommandTypes || new Set()
    return async function dispatchCommand (command) {
      if (!command || typeof command.type !== 'string') throw new Error('Bridge dispatch requires a command type')
      if (prizeCommands.has(command.type) && service && service.requireLive === true) {
        service.assertLive(command.type)
      }
      return harness.dispatchAsync(command)
    }
  }

  function settlementServiceForRequest ({ activeService, harness, opts = {} }) {
    if (typeof opts.requireLive !== 'boolean' || activeService.requireLive === opts.requireLive) {
      return activeService
    }
    return settlementServiceFactory.createGuardedSettlementService({
      workerRuntime: harness,
      requireLive: opts.requireLive
    })
  }

  // Ultimate Sports ships from its own repo, so the bridge must be injected by the host.
  function createUltimateSportsBridgeHandler ({ rootObject = root, handler } = {}) {
    if (handler && typeof handler.handle === 'function') return handler
    const exposed = rootObject && (
      rootObject.PearCupUltimateSportsBridge ||
      rootObject.__PEARCUP_ULTIMATE_SPORTS_BRIDGE__ ||
      rootObject.UltimateSportsBridge
    )
    if (exposed && typeof exposed.handle === 'function') return exposed
    const error = new Error('Ultimate sports bridge unavailable in this runtime')
    error.code = 'PEARCUP_ULTIMATE_SPORTS_BRIDGE_UNAVAILABLE'
    throw error
  }

  function normalizeUltimateSportsRequest (payload = {}) {
    if (payload.request && typeof payload.request === 'object') return payload.request
    if (payload.envelope && typeof payload.envelope === 'object') return payload.envelope
    return payload
  }

  function createPearWorkerBridgeProtocol ({
    settings,
    rootObject = root,
    service,
    workerRuntime,
    storage,
    events = [],
    requireLive = true
  } = {}) {
    const ownsService = !service
    const harness = workerRuntime || (service && service.harness) || workerRuntimeFactory.createPearCupWorkerRuntime({
      settings,
      rootObject,
      storage,
      events
    })
    const activeService = service || settlementServiceFactory.createGuardedSettlementService({
      workerRuntime: harness,
      requireLive
    })
    const activeSettings = settings || (
      typeof activeService.status === 'function' &&
      activeService.status() &&
      activeService.status().settings
    ) || {}
    const dispatchCommand = createGuardedDispatcher({ service: activeService, harness })
    let ultimateSportsHandler = null

    async function handleEnvelope (envelope) {
      try {
        assertEnvelope(envelope)
        const payload = envelope.payload || {}
        const includeEvents = envelopeWantsEvents(envelope)
        let result = null
        let responseService = activeService

        if (envelope.action === 'dispatch') {
          result = await dispatchCommand(payload.command)
        } else if (envelope.action === 'mergeEvents') {
          if (!harness.worker || typeof harness.worker.mergeEvents !== 'function') throw new Error('Worker mergeEvents is unavailable')
          result = harness.worker.mergeEvents(payload.events || [])
        } else if (envelope.action === 'snapshot') {
          result = null
        } else if (envelope.action === 'status') {
          result = activeService.status()
        } else if (envelope.action === 'settleGameRoundWithReceipt') {
          const requestOpts = payload.opts || {}
          responseService = settlementServiceForRequest({ activeService, harness, opts: requestOpts })
          result = await responseService.settleGameRoundWithReceipt(payload.payload || {}, requestOpts)
        } else if (envelope.action === 'settleBracketPoolWithReceipt') {
          const requestOpts = payload.opts || {}
          responseService = settlementServiceForRequest({ activeService, harness, opts: requestOpts })
          result = await responseService.settleBracketPoolWithReceipt(payload.payload || {}, requestOpts)
        } else if (envelope.action === 'ultimateSports') {
          ultimateSportsHandler = createUltimateSportsBridgeHandler({
            rootObject,
            handler: ultimateSportsHandler || payload.handler
          })
          result = ultimateSportsHandler.handle(normalizeUltimateSportsRequest(payload))
        } else {
          throw new Error(`Unsupported Pear worker bridge action: ${envelope.action}`)
        }

        return createOkResponse({
          envelope,
          result,
          service: responseService,
          harness,
          settings: activeSettings,
          includeEvents
        })
      } catch (err) {
        return createErrorResponse({
          envelope,
          err,
          service: activeService,
          harness,
          settings: activeSettings
        })
      }
    }

    async function close () {
      if (ownsService && activeService && typeof activeService.close === 'function') await activeService.close()
    }

    return {
      protocol: protocolVersion,
      service: activeService,
      harness,
      handleEnvelope,
      request: handleEnvelope,
      close
    }
  }

  const api = {
    protocolVersion,
    createPearWorkerBridgeProtocol,
    createUltimateSportsBridgeHandler,
    redactWorkerValue,
    assertNoSecretLeak,
    envelopeWantsEvents
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupWorkerBridgeProtocol = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
