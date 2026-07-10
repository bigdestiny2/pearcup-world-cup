# Demo pool ledger

PearCup pools currently accept real player submissions while using mock currency.
They do not accept money, create a WDK intent, escrow a balance, or prepare a
payout.

`app/pool-sync.js` is the single source of truth for pool participation. It
uses `PearCupPeerNet` on the shared `pearcup:v1:pools` topic:

- An entry contains a generated entry ID, a persistent local player ID, display
  name, chosen team, pool key, stake tier, optional match pick, timestamp, and
  `DEMO_USDT` currency marker.
- A submission first debits only the submitting device's local demo wallet.
  Remote entries never change another player's wallet.
- New peers announce themselves and receive chunked snapshots of observed
  entries. Entries are deduplicated by ID and limited to one entry per player
  ID and pool key.
- The UI derives entry totals and demo pool size directly from that ledger.
  There are no seeded entrant counts, prizes, leaderboards, or AI challengers
  in the playable pool flow.

The normal transport selection still applies: configured HiveRelay connects a
browser, PearBrowser, and Pear Runtime; PearBrowser swarm, Pear Runtime
Hyperswarm, and same-origin BroadcastChannel remain the appropriate fallbacks.
The relay sees only signed collaboration frames; it never receives a wallet
secret, seed phrase, payout address, or payment authorization.

This is deliberately not a cash game. A future real-money release must use a
new, separately reviewed protocol that proves payment confirmation and
settlement authorization in the worker boundary. It must not promote the demo
ledger by changing the currency label alone.
