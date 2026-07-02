(function attachPearCupWorkerRuntime (root) {
  const runtimeSettings = root.PearCupRuntimeSettings || (typeof require !== 'undefined' ? require('./runtime-settings.js') : null)
  const runtimeConfigFactory = root.PearCupRuntimeConfig || (typeof require !== 'undefined' ? require('./runtime-config.js') : null)
  const workerFactory = root.PearCupWorkerSim || (typeof require !== 'undefined' ? require('./worker-sim.js') : null)
  const sdkRuntime = root.PearCupSdkRuntime || (typeof require !== 'undefined' ? require('./sdk-runtime.js') : null)

  if (!runtimeSettings) throw new Error('PearCupRuntimeSettings is required before PearCupWorkerRuntime')
  if (!runtimeConfigFactory) throw new Error('PearCupRuntimeConfig is required before PearCupWorkerRuntime')
  if (!workerFactory) throw new Error('PearCupWorkerSim is required before PearCupWorkerRuntime')

  function runtimeRootFor ({ rootObject, settings, sdkPackages, compliance } = {}) {
    const parentRoot = rootObject || root || {}
    const runtimeRoot = Object.create(parentRoot)
    runtimeRoot.PearCupRuntimeSettingsValue = {
      ...settings,
      sdkPackages: sdkPackages || settings.sdkPackages || {},
      compliance: compliance || settings.compliance || {}
    }
    runtimeRoot.PearCupCompliance = runtimeRoot.PearCupRuntimeSettingsValue.compliance
    if (sdkRuntime && !runtimeRoot.PearCupSdkRuntime) runtimeRoot.PearCupSdkRuntime = sdkRuntime
    return runtimeRoot
  }

  function statusFor ({ settings, runtime }) {
    return {
      id: 'pearcup-worker-runtime',
      settings: runtimeSettings.redactRuntimeSettings(settings),
      mode: { ...runtime.mode },
      readiness: runtime.readiness,
      canUseRealMoney: runtime.canUseRealMoney,
      secrets: {
        wdkSeedExposed: false
      }
    }
  }

  function createPearCupWorkerRuntime ({
    settings,
    rootObject = root,
    sdkPackages,
    compliance,
    storage,
    events = [],
    forceDemo = false,
    createWorkerFactory = workerFactory
  } = {}) {
    const resolvedSettings = settings || runtimeSettings.loadRuntimeSettings()
    const runtimeRoot = runtimeRootFor({
      rootObject,
      settings: resolvedSettings,
      sdkPackages,
      compliance
    })
    const runtime = runtimeConfigFactory.createRuntimeConfig({
      rootObject: runtimeRoot,
      sdkPackages: sdkPackages || runtimeRoot.PearCupRuntimeSettingsValue.sdkPackages,
      compliance: compliance || runtimeRoot.PearCupRuntimeSettingsValue.compliance,
      forceDemo
    })
    const worker = runtime.createWorker({
      workerFactory: createWorkerFactory,
      storage,
      events
    })

    function dispatch (command) {
      return worker.dispatch(command)
    }

    function dispatchAsync (command) {
      return worker.dispatchAsync(command)
    }

    function settleGameRound (payload, { actorId = 'settlement-worker' } = {}) {
      return dispatchAsync({
        type: 'settlement:settleGameRound',
        actorId,
        payload
      })
    }

    function settleBracketPool (payload, { actorId = 'settlement-worker' } = {}) {
      return dispatchAsync({
        type: 'settlement:settleBracketPool',
        actorId,
        payload
      })
    }

    async function close () {
      if (runtime && typeof runtime.close === 'function') await runtime.close()
    }

    return {
      runtime,
      worker,
      dispatch,
      dispatchAsync,
      settleGameRound,
      settleBracketPool,
      status: () => statusFor({ settings: resolvedSettings, runtime }),
      close
    }
  }

  const api = {
    createPearCupWorkerRuntime,
    runtimeRootFor,
    statusFor
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupWorkerRuntime = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupWorkerRuntime = 'worker-runtime-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
