(function attachPearCupRuntimeConfig (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const adapterFactory = root.PearCupAdapters || (canRequireLocal ? require('./adapters.js') : null)
  if (!adapterFactory) throw new Error('PearCupAdapters is required before PearCupRuntimeConfig')
  const qvacRefereeFactory = root.PearCupQvacReferee || (canRequireLocal ? safeRequire('./qvac-referee.js') : null)
  const tetherWdkBridgeFactory = root.PearCupTetherWdkBridge || (canRequireLocal ? safeRequire('./tether-wdk-bridge.js') : null)
  const packageSdkFactory = root.PearCupSdkRuntime || (canRequireLocal ? safeRequire('./sdk-runtime.js') : null)

  const qvacRequiredMethods = ['attestRound', 'attestPoolSettlement']
  const qvacCommentaryRequiredMethods = ['generateSegment']
  const tetherWdkRequiredMethods = ['createGameEscrow', 'releaseGameEscrow', 'createEntryIntent', 'confirmEntryIntent', 'createPoolPayout']
  const tetherWdkOptionalMethods = ['reconcileEntryIntent', 'disputeGameEscrow', 'refundEntryIntent', 'refundGameEscrow']

  function safeRequire (path) {
    try {
      return canRequireLocal ? require(path) : null
    } catch {
      return null
    }
  }

  function pickClient (rootObject, names) {
    for (const name of names) {
      if (rootObject && rootObject[name]) return { name, client: rootObject[name] }
    }
    return null
  }

  function methodStatus (client, requiredMethods, optionalMethods = []) {
    return {
      required: requiredMethods.map(name => ({
        name,
        present: Boolean(client && typeof client[name] === 'function')
      })),
      optional: optionalMethods.map(name => ({
        name,
        present: Boolean(client && typeof client[name] === 'function')
      }))
    }
  }

  function missingRequiredMethods (status) {
    return status.required.filter(method => !method.present).map(method => method.name)
  }

  function hasRequiredMethods (client, requiredMethods) {
    return Boolean(client && requiredMethods.every(name => typeof client[name] === 'function'))
  }

  function detectSdkGlobals (rootObject = root) {
    return {
      qvac: pickClient(rootObject, ['PearCupQVAC', 'QVAC', 'qvac']),
      qvacCompletion: pickClient(rootObject, ['PearCupQVACCompletion', 'QVACCompletion', 'qvacCompletion']),
      tetherWdk: pickClient(rootObject, ['PearCupTetherWDK', 'TetherWDK', 'TetherWdk', 'tetherWdk']),
      tetherWdkProcessor: pickClient(rootObject, ['PearCupTetherWDKProcessor', 'TetherWDKProcessor', 'TetherWdkProcessor', 'tetherWdkProcessor'])
    }
  }

  function normalizePackageConfig (value) {
    if (value === true) return {}
    if (value && typeof value === 'object') return value
    return null
  }

  function runtimeOptionsFor (rootObject, explicitSdkPackages) {
    const options = rootObject.PearCupRuntimeOptions || root.PearCupRuntimeOptions || {}
    const settings = rootObject.PearCupRuntimeSettingsValue || root.PearCupRuntimeSettingsValue || {}
    return {
      sdkPackages: explicitSdkPackages || options.sdkPackages || settings.sdkPackages || null,
      compliance: options.compliance || settings.compliance || null
    }
  }

  function sdkFactoryFor (rootObject) {
    return rootObject.PearCupSdkRuntime || root.PearCupSdkRuntime || packageSdkFactory
  }

  function createPackageAdapters (rootObject, sdkPackages) {
    const sdkFactory = sdkFactoryFor(rootObject)
    const qvacConfig = normalizePackageConfig(sdkPackages && sdkPackages.qvac)
    const tetherConfig = normalizePackageConfig(sdkPackages && (sdkPackages.tetherWdk || sdkPackages.tetherWDK))
    const adapters = {}

    if (
      qvacConfig &&
      sdkFactory &&
      typeof sdkFactory.createQvacSdkRefereeAdapter === 'function'
    ) {
      adapters.qvac = {
        client: sdkFactory.createQvacSdkRefereeAdapter(qvacConfig),
        detected: { name: '@qvac/sdk', source: 'package:@qvac/sdk' }
      }
    }

    if (
      qvacConfig &&
      sdkFactory &&
      typeof sdkFactory.createQvacSdkCommentaryAdapter === 'function'
    ) {
      adapters.qvacCommentary = {
        client: sdkFactory.createQvacSdkCommentaryAdapter(qvacConfig),
        detected: { name: '@qvac/sdk', source: 'package:@qvac/sdk' }
      }
    }

    if (
      tetherConfig &&
      tetherConfig.seedPhrase &&
      sdkFactory &&
      typeof sdkFactory.createTetherWdkPackageAdapter === 'function'
    ) {
      adapters.tetherWdk = {
        client: sdkFactory.createTetherWdkPackageAdapter(tetherConfig),
        detected: { name: '@tetherto/wdk', source: 'package:@tetherto/wdk' }
      }
    }

    return adapters
  }

  function normalizeCompliance (compliance = {}) {
    return {
      realMoneyEnabled: compliance.realMoneyEnabled === true,
      kycVerified: compliance.kycVerified === true,
      jurisdictionAllowed: compliance.jurisdictionAllowed === true,
      responsiblePlayAccepted: compliance.responsiblePlayAccepted === true
    }
  }

  function createServiceReadiness ({ key, label, adapter, detected, explicitClient, requiredMethods, optionalMethods = [] }) {
    const client = explicitClient || (detected && detected.client) || null
    const methodClient = adapter.mode === 'sdk' ? adapter : client
    const methods = methodStatus(methodClient, requiredMethods, optionalMethods)
    const missing = missingRequiredMethods(methods)
    const source = explicitClient ? 'injected' : detected && detected.source ? detected.source : detected ? `global:${detected.name}` : 'demo'

    return {
      key,
      label,
      mode: adapter.mode,
      adapterId: adapter.id,
      source,
      sdkDetected: Boolean(client || adapter.mode === 'sdk'),
      sdkReady: adapter.mode === 'sdk' && missing.length === 0,
      methods,
      missing
    }
  }

  function readinessSummary ({ qvac, tetherWdk, compliance }) {
    const sdkReady = qvac.sdkReady && tetherWdk.sdkReady
    const complianceReady = compliance.realMoneyEnabled &&
      compliance.kycVerified &&
      compliance.jurisdictionAllowed &&
      compliance.responsiblePlayAccepted

    if (sdkReady && complianceReady) {
      return {
        status: 'live-ready',
        label: 'Live settlement ready',
        tone: 'ready',
        realMoneyEnabled: true
      }
    }

    if (sdkReady) {
      return {
        status: 'compliance-locked',
        label: 'SDK ready, prizes locked',
        tone: 'warn',
        realMoneyEnabled: false
      }
    }

    return {
      status: 'demo-locked',
      label: 'Demo settlement locked',
      tone: 'locked',
      realMoneyEnabled: false
    }
  }

  function createRuntimeConfig ({
    rootObject = root,
    qvac,
    qvacCommentary,
    tetherWdk,
    sdkPackages,
    compliance,
    forceDemo = false
  } = {}) {
    const detected = forceDemo ? { qvac: null, tetherWdk: null } : detectSdkGlobals(rootObject)
    const runtimeOptions = forceDemo ? { sdkPackages: null } : runtimeOptionsFor(rootObject, sdkPackages)
    const packageAdapters = runtimeOptions.sdkPackages ? createPackageAdapters(rootObject, runtimeOptions.sdkPackages) : {}
    let selectedQvac = forceDemo ? null : (qvac || (detected.qvac && detected.qvac.client))
    let selectedQvacDetected = detected.qvac
    if (
      !forceDemo &&
      !selectedQvac &&
      detected.qvacCompletion &&
      qvacRefereeFactory &&
      typeof qvacRefereeFactory.createQvacCompletionRefereeAdapter === 'function'
    ) {
      selectedQvac = qvacRefereeFactory.createQvacCompletionRefereeAdapter({
        client: detected.qvacCompletion.client,
        modelId: rootObject.PearCupQvacModelId || root.PearCupQvacModelId
      })
      selectedQvacDetected = detected.qvacCompletion
    }
    if (!forceDemo && !selectedQvac && packageAdapters.qvac) {
      selectedQvac = packageAdapters.qvac.client
      selectedQvacDetected = packageAdapters.qvac.detected
    }

    let selectedQvacCommentary = forceDemo ? null : qvacCommentary
    if (
      !forceDemo &&
      !selectedQvacCommentary &&
      detected.qvacCompletion &&
      qvacRefereeFactory &&
      typeof qvacRefereeFactory.createQvacCompletionCommentaryAdapter === 'function'
    ) {
      selectedQvacCommentary = qvacRefereeFactory.createQvacCompletionCommentaryAdapter({
        client: detected.qvacCompletion.client,
        modelId: rootObject.PearCupQvacCommentaryModelId || rootObject.PearCupQvacModelId || root.PearCupQvacCommentaryModelId || root.PearCupQvacModelId
      })
    }
    if (!forceDemo && !selectedQvacCommentary && packageAdapters.qvacCommentary) {
      selectedQvacCommentary = packageAdapters.qvacCommentary.client
    }

    let selectedTetherWdk = forceDemo ? null : (tetherWdk || (detected.tetherWdk && detected.tetherWdk.client))
    let selectedTetherWdkDetected = detected.tetherWdk
    if (
      !forceDemo &&
      !selectedTetherWdk &&
      detected.tetherWdkProcessor &&
      tetherWdkBridgeFactory &&
      typeof tetherWdkBridgeFactory.createTetherWdkProcessorAdapter === 'function'
    ) {
      selectedTetherWdk = tetherWdkBridgeFactory.createTetherWdkProcessorAdapter({
        processor: detected.tetherWdkProcessor.client
      })
      selectedTetherWdkDetected = detected.tetherWdkProcessor
    }
    if (!forceDemo && !selectedTetherWdk && packageAdapters.tetherWdk) {
      selectedTetherWdk = packageAdapters.tetherWdk.client
      selectedTetherWdkDetected = packageAdapters.tetherWdk.detected
    }

    const runtimeAdapters = adapterFactory.createIntegrationAdapters({
      qvac: hasRequiredMethods(selectedQvac, qvacRequiredMethods) ? selectedQvac : null,
      tetherWdk: hasRequiredMethods(selectedTetherWdk, tetherWdkRequiredMethods) ? selectedTetherWdk : null,
      qvacCommentary: hasRequiredMethods(selectedQvacCommentary, qvacCommentaryRequiredMethods) ? selectedQvacCommentary : null
    })
    const normalizedCompliance = normalizeCompliance(compliance || runtimeOptions.compliance || rootObject.PearCupCompliance || root.PearCupCompliance || {})
    const qvacReadiness = createServiceReadiness({
      key: 'qvac',
      label: 'QVAC referee',
      adapter: runtimeAdapters.qvac,
      detected: selectedQvacDetected,
      explicitClient: qvac,
      requiredMethods: qvacRequiredMethods
    })
    const tetherReadiness = createServiceReadiness({
      key: 'tetherWdk',
      label: 'Tether WDK rail',
      adapter: runtimeAdapters.tetherWdk,
      detected: selectedTetherWdkDetected,
      explicitClient: tetherWdk,
      requiredMethods: tetherWdkRequiredMethods,
      optionalMethods: tetherWdkOptionalMethods
    })
    const settlement = readinessSummary({
      qvac: qvacReadiness,
      tetherWdk: tetherReadiness,
      compliance: normalizedCompliance
    })

    function createWorker ({ workerFactory = root.PearCupWorkerSim, events = [], storage } = {}) {
      if (!workerFactory || typeof workerFactory.createWorkerSim !== 'function') {
        throw new Error('createWorker requires PearCupWorkerSim.createWorkerSim')
      }
      return workerFactory.createWorkerSim({ events, adapters: runtimeAdapters, storage })
    }

    async function close () {
      await Promise.all([
        runtimeAdapters.qvac && typeof runtimeAdapters.qvac.close === 'function' ? runtimeAdapters.qvac.close() : null,
        runtimeAdapters.tetherWdk && typeof runtimeAdapters.tetherWdk.close === 'function' ? runtimeAdapters.tetherWdk.close() : null,
        runtimeAdapters.qvacCommentary && typeof runtimeAdapters.qvacCommentary.close === 'function' ? runtimeAdapters.qvacCommentary.close() : null
      ])
    }

    return {
      adapters: runtimeAdapters,
      mode: { ...runtimeAdapters.mode },
      readiness: {
        qvac: qvacReadiness,
        tetherWdk: tetherReadiness,
        compliance: normalizedCompliance,
        settlement
      },
      canUseRealMoney: settlement.realMoneyEnabled,
      createWorker,
      close
    }
  }

  const api = {
    qvacRequiredMethods,
    tetherWdkRequiredMethods,
    tetherWdkOptionalMethods,
    detectSdkGlobals,
    hasRequiredMethods,
    createPackageAdapters,
    createRuntimeConfig
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupRuntimeConfig = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupRuntimeConfig = 'runtime-config-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
