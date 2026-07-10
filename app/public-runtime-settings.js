// Public production settings only. This file is safe to ship in Pear and
// Hyperdrive; it must never contain API keys, wallet seeds, or payout routes.
(function attachPearCupPublicRuntimeSettings (root) {
  root.PearCupPublicRuntimeSettings = {
    liveData: null,
    // Set only after the dedicated PearCup HiveRelay OutboxLog endpoint has
    // passed `npm run test:hiverelay-conformance`. This is a public URL, never
    // an operator token or a wallet credential.
    peerRelay: null,
    // This public endpoint stores passkeys, linked public device keys, and
    // demo balances only. It contains no wallet or payment credentials.
    identity: { enabled: true, apiUrl: 'https://pearcup-kawaii-identity.throbbing-limit-1abb.workers.dev' }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
