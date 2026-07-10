// Public production settings only. This file is safe to ship in Pear and
// Hyperdrive; it must never contain API keys, wallet seeds, or payout routes.
(function attachPearCupPublicRuntimeSettings (root) {
  root.PearCupPublicRuntimeSettings = {
    liveData: null
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
