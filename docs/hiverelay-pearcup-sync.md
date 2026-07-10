# PearCup browser sync on HiveRelay

`pearcup-sync-v2` gives the normal web browser, PearBrowser, and the Pear
runtime one common realtime transport. It uses HiveRelay's OutboxLog HTTP/SSE
swarm contract instead of a PearCup-specific relay.

This is collaboration transport only. It never receives WDK seeds, wallet
private keys, payout routes, football API keys, audio, or settlement authority.

## Client contract

The shipped adapter is [`app/peer-hiverelay.js`](../app/peer-hiverelay.js).
When `peerRelay` is configured, it is selected before direct Hyperswarm:

```text
POST /api/token
GET  /api/bridge/status                 -> { ready: true, service: "outboxlog" }
POST /api/swarm/join
GET  /api/swarm/events?...&token=...    -> SSE
POST /api/swarm/send
POST /api/swarm/leave
```

Frames have the `pearcup-sync-v2` envelope. Each browser tab creates an
ephemeral Ed25519 key, signs each frame, rejects invalid/expired frames,
deduplicates IDs, acknowledges delivery, and retries unacknowledged data for a
short bounded window. The relay remains untrusted for content integrity.

The direct PearBrowser swarm and the optional native Hyperswarm worker remain
fallbacks when no relay is configured or its initial handshake fails. They are
not the correctness path for browser-to-native play. Every client must be on a
release containing `pearcup-sync-v2` to use the common transport.

## Enable a dedicated endpoint

Do not point PearCup at `outbox.peerit.site`; it is Peerit's endpoint and is
currently read-only. Ask the HiveRelay operator for a dedicated HTTPS hostname,
for example `https://outbox.pearcup.example`.

Enable the OutboxLog plugin on that relay, persist its data, allow the
application's browser origins through CORS, and expose the public `/api/*`
routes. A representative HiveRelay configuration is:

```json
{
  "plugins": ["outboxlog"],
  "outboxlog": {
    "namespaces": { "pearcup": { "blind": false } },
    "journal": "hypercore-outboxes",
    "sweep": { "enabled": true, "ttlMs": 86400000, "intervalMs": 3600000 }
  }
}
```

The namespace is reserved for any future durable PearCup records. The current
realtime path uses the generic swarm surface, but keeping persistent OutboxLog
enabled makes service behaviour and future upgrades auditable.

Before publishing, the operator must verify:

- `POST /api/token` issues a session token without a user credential.
- Token-gated `GET /api/bridge/status` returns exactly
  `{ "ready": true, "service": "outboxlog" }`.
- CORS permits the public website and PearBrowser gateway origins.
- `GET /api/swarm/events` is permitted to remain open, is TLS-terminated, and
  has bounded connection/rate limits.
- The relay has persistent storage, monitoring, a documented incident owner,
  and a second independently operated endpoint before a high-availability
  launch. OutboxLog is still marked experimental by HiveRelay, so a single
  relay is not sufficient evidence for money-critical use.

## Configure PearCup

Set only the public URL; never put an operator key in PearCup:

```json
{
  "peerRelay": {
    "enabled": true,
    "relayUrl": "https://outbox.pearcup.example",
    "service": "outboxlog",
    "protocol": "pearcup-sync-v2"
  }
}
```

The same value can be supplied in the host environment with
`PEARCUP_HIVERELAY_URL` and `PEARCUP_HIVERELAY_ENABLED=true`. It is renderer
safe because the relay issues a short-lived token at connection time. The
template is in [`config/pearcup.runtime.example.json`](../config/pearcup.runtime.example.json).

For a static web release, place the same public object under `peerRelay` in
[`app/public-runtime-settings.js`](../app/public-runtime-settings.js) only
after the endpoint has passed the verification below.

## Verification gates

```sh
npm run test:hiverelay-conformance   # disposable real OutboxLog HTTP/SSE server
node --test app/peer-hiverelay.test.js
npm run test:kawaii-peer
npm run check:kawaii-runtime
```

Then perform the human matrix against the dedicated endpoint:

| Host A | Host B | Required proof |
| --- | --- | --- |
| Brave/Chrome | Brave/Chrome | watch presence, chat, challenge, first kick |
| Brave/Chrome | PearBrowser | same room reaches `hiverelay-outboxlog-v2` on both sides |
| PearBrowser | `pear run` native | invitation, full five-round match, reconnect once |
| Any host | Any host after network drop | SSE reconnects; duplicate frames do not duplicate chat or match state |

Record the endpoint hostname, release SHA, timestamp, and both visible backend
labels with the friend-test release evidence. A browser that cannot negotiate
WebRTC may still play and watch; only voice/screen-share need TURN-backed
WebRTC.

## Security boundary

- Friend-match room capabilities are now 128-bit random values. Do not shorten
  them for display or replace them with a guessable lobby code.
- The relay may carry watch chat and encrypted WebRTC signalling metadata, so
  messages expire rapidly and recipients ignore stale targeted frames.
- Treat the HiveRelay endpoint as an availability layer. Payments remain in
  the existing KeyVault-backed worker and retain their QVAC/WDK/compliance
  gates.
- A release with no `peerRelay` configuration remains runnable through the
  existing local/direct fallbacks, but it is not browser-to-native multiplayer.
