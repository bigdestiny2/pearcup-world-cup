// Generated PearCup renderer boot loader.
// Regenerate with: npm run build:kawaii-boot
// Sources: ./core.js, ./adapters.js, ./qvac-referee.js, ./tether-wdk-bridge.js, ./sdk-runtime.js, ./runtime-settings.js, ./runtime-config.js, ./settlement-receipts.js, ./worker-sim.js, ./storage-sim.js, ./transport-sim.js, ./worker-runtime.js, ./settlement-service.js, ./worker-client.js, ./peer-net.js, ./peer-match.js, ./peer-lobby.js, ./watch-sync.js, ./watch-voice.js, ./app.js
// Evidence markers live in loaded scripts: PearCupPeerNet, PearCupWorkerClient, PearCupSettlementService, PearCupWorkerSim, PearCupStorageSim, PearCupTransportSim, showOperatorLiveDataSettings, runBootRuntimeSelfTest, pearcup:runtime-self-test, runRuntimePeerHandshakeSelfTest, pearcupRuntimeSelfTestGuest
(function bootPearCupRenderer (root) {
  if (root.__pearcupBootLoaderStarted) return
  root.__pearcupBootLoaderStarted = true
  var scripts = [
    "./core.js",
    "./adapters.js",
    "./qvac-referee.js",
    "./tether-wdk-bridge.js",
    "./sdk-runtime.js",
    "./runtime-settings.js",
    "./runtime-config.js",
    "./settlement-receipts.js",
    "./worker-sim.js",
    "./storage-sim.js",
    "./transport-sim.js",
    "./worker-runtime.js",
    "./settlement-service.js",
    "./worker-client.js",
    "./peer-net.js",
    "./peer-match.js",
    "./peer-lobby.js",
    "./watch-sync.js",
    "./watch-voice.js",
    "./app.js"
  ]

  function loadScript (src) {
    return new Promise(function (resolve, reject) {
      if (root.document && root.document.querySelector('script[data-pearcup-loaded-src="' + src + '"]')) {
        resolve()
        return
      }
      var script = root.document.createElement('script')
      script.src = src
      script.async = false
      script.dataset.pearcupLoadedSrc = src
      script.onload = function () { resolve() }
      script.onerror = function () { reject(new Error(src + ' failed to load')) }
      root.document.body.appendChild(script)
    })
  }

  function loadRendererRuntimeOptions () {
    if (typeof root.fetch !== 'function') return Promise.resolve()
    return root.fetch('./pearcup-runtime-options.json', { cache: 'no-store' })
      .then(function (response) { return response && response.ok ? response.json() : null })
      .then(function (settings) {
        var runtimeSettings = root.PearCupRuntimeSettings
        if (!settings || !runtimeSettings || typeof runtimeSettings.applyRendererRuntimeSettingsToRoot !== 'function') return
        runtimeSettings.applyRendererRuntimeSettingsToRoot(root, settings)
      })
      .catch(function () {})
  }

  scripts.reduce(function (chain, src) {
    return chain.then(function () {
      return loadScript(src).then(function () {
        return src === './runtime-settings.js' ? loadRendererRuntimeOptions() : null
      })
    })
  }, Promise.resolve()).catch(function (err) {
    var detail = err && err.stack ? err.stack : String(err)
    try {
      var bar = root.document.getElementById('bootErrorBar') || root.document.createElement('pre')
      bar.id = 'bootErrorBar'
      bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:45vh;overflow:auto;margin:0;padding:12px 16px;background:#3a1030;color:#ffd9ec;font:12px/1.5 ui-monospace,monospace;z-index:99999;white-space:pre-wrap;border-top:3px solid #ff8fc0'
      bar.textContent = 'PearCup boot error:\n' + detail
      if (!bar.parentNode && root.document.body) root.document.body.appendChild(bar)
    } catch (e) {}
    if (root.console && root.console.error) root.console.error('PearCup boot loader failed', err)
  })
})(typeof window !== 'undefined' ? window : globalThis)
