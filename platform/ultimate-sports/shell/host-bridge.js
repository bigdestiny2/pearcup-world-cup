// Ultimate Sports host bridge.
//
// Connects a fit (this shell, running inside an <iframe>) to the Ultimate
// Sports lobby that hosts it. The lobby is the single AUTHORITY for identity +
// wallet; the fit adopts whatever the lobby injects on load and reports its own
// wallet/profile mutations back so the lobby stays live and persists them. This
// is also the seam where the real Tether WDK wallet plugs in later — fits never
// own the balance, they request/report against the host's wallet.
//
// Standalone-safe: when the shell is NOT embedded in a host (opened directly or
// staged as its own Pear app), isHosted() is false, every method is inert, and
// the shell keeps using its own local wallet/profile exactly as before.
(function () {
  'use strict'

  var PROTOCOL = 'ultimate:v1'

  // Build a bridge over an injected environment so the same logic runs in the
  // browser (window) and under node tests (a fake env).
  function createHostBridge (env) {
    env = env || {}
    var selfWin = env.self
    var topWin = env.top
    var parentWin = env.parent
    var addEventListener = env.addEventListener

    var hosted
    try {
      hosted = selfWin !== topWin
    } catch (e) {
      // Reading top across an origin boundary throws — that only happens when
      // we are embedded, so treat it as hosted.
      hosted = true
    }

    var injected = null // latest { profile, wallet } handed down by the host
    var initListeners = []

    function isHosted () { return !!hosted }
    function getInjected () { return injected }

    function onInit (cb) {
      if (typeof cb !== 'function') return
      initListeners.push(cb)
      if (injected) { try { cb(injected) } catch (e) {} }
    }

    function emitInit () {
      var snapshot = injected
      for (var i = 0; i < initListeners.length; i++) {
        try { initListeners[i](snapshot) } catch (e) {}
      }
    }

    function reportState (payload) {
      if (!hosted || !payload || !parentWin || typeof parentWin.postMessage !== 'function') return
      try {
        parentWin.postMessage({
          type: 'ultimate:state',
          protocol: PROTOCOL,
          profile: payload.profile || null,
          wallet: payload.wallet || null
        }, '*')
      } catch (e) {}
    }

    function handleMessage (event) {
      var data = event && event.data
      if (!data || data.type !== 'ultimate:init') return
      injected = { profile: data.profile || null, wallet: data.wallet || null }
      emitInit()
    }

    if (hosted && typeof addEventListener === 'function') {
      addEventListener('message', handleMessage)
      // Announce readiness so the host injects even if its frame.onload fired
      // before this listener attached.
      if (parentWin && typeof parentWin.postMessage === 'function') {
        try { parentWin.postMessage({ type: 'ultimate:ready', protocol: PROTOCOL }, '*') } catch (e) {}
      }
    }

    return {
      protocol: PROTOCOL,
      isHosted: isHosted,
      getInjected: getInjected,
      onInit: onInit,
      reportState: reportState,
      _handleMessage: handleMessage // exposed for tests
    }
  }

  // Auto-install in the browser.
  if (typeof window !== 'undefined' && !window.ULTIMATE_HOST) {
    window.ULTIMATE_HOST = createHostBridge({
      self: window.self,
      top: window.top,
      parent: window.parent,
      addEventListener: window.addEventListener.bind(window)
    })
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createHostBridge: createHostBridge, PROTOCOL: PROTOCOL }
  }
})()
