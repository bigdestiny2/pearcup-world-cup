// Public production settings only. This file is safe to ship in Pear and
// Hyperdrive; it must never contain API keys, wallet seeds, or payout routes.
(function attachPearCupPublicRuntimeSettings (root) {
  root.PearCupPublicRuntimeSettings = {
    liveData: null,
    // Dedicated, verified HTTPS gateway for the PearCup OutboxLog relay. This
    // is public routing metadata only: it never carries an operator token,
    // wallet credential, or passkey assertion.
    peerRelay: {
      enabled: true,
      relayUrl: 'https://pearcup-kawaii-relay.throbbing-limit-1abb.workers.dev',
      service: 'outboxlog',
      protocol: 'pearcup-sync-v2'
    },
    // This public endpoint stores passkeys, linked public device keys, and
    // demo balances only. It contains no wallet or payment credentials.
    identity: { enabled: true, apiUrl: 'https://pearcup-kawaii-identity.throbbing-limit-1abb.workers.dev' }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
