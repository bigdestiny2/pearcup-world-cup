// Public production settings only. This file is safe to ship in Pear and
// Hyperdrive; it must never contain API keys, wallet seeds, or payout routes.
(function attachPearCupPublicRuntimeSettings (root) {
  const settings = {
    liveData: {
      relayUrl: 'https://pearcup-live-data.throbbing-limit-1abb.workers.dev/v1/live-match.json',
      oddsRelayUrl: 'https://pearcup-live-data.throbbing-limit-1abb.workers.dev/v1/polymarket-odds.json',
      pollMs: 30000
    },
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
  root.PearCupPublicRuntimeSettings = settings
  // Pear's renderer bridge can expose a distinct window proxy from the
  // JavaScript global. Keep the public settings visible to app.js in both.
  if (typeof window !== 'undefined' && window !== root) window.PearCupPublicRuntimeSettings = settings
})(typeof globalThis !== 'undefined' ? globalThis : window)
