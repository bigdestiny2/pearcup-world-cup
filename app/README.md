# PearCup Prototype

Open `index.html` in a browser. The prototype is static, but it models the core flow:

- Pick a World Cup country and username.
- Generate a small jersey avatar from the country kit colors.
- Join $10, $25, $50, or $100 bracket pools.
- Pick every knockout winner from round of 16 through the final.
- See a bracket layout with usernames beside picked teams.
- Join a watch room with avatars, shared TV, room chat, voice state, live stats, and language-switched commentary.
- Open the Games screen for Penalty Clash, a P2P soccer minigame with deterministic commit/reveal sync.
- See Tether WDK escrow states and QVAC AI referee attestation modeled for game settlement.

## Local Adapter Layer

`core.js` is the current SDK-ready seam for the hard parts:

- Penalty Clash deterministic resolver.
- Commit/reveal creation and verification.
- QVAC referee attestation creation.
- Tether WDK demo escrow intent and payout release gating.
- Tether WDK bracket entry intents, confirmations, and pool payout preparation.

`adapters.js` is the replaceable SDK boundary:

- Demo QVAC adapter.
- Demo Tether WDK adapter.
- SDK wrapper for `attestRound` and `attestPoolSettlement`.
- SDK wrapper for game escrow methods: `createGameEscrow` and `releaseGameEscrow`.
- SDK wrapper for bracket pool methods: `createEntryIntent`, `confirmEntryIntent`, and `createPoolPayout`.
- `createIntegrationAdapters({ qvac, tetherWdk })` for injecting real hackathon SDK clients.

`qvac-referee.js` adapts QVAC text-generation style clients into the trusted referee contract:

- Builds strict JSON review prompts from deterministic round or pool evidence.
- Accepts QVAC SDK-style completion functions, QVAC wrappers, or OpenAI-compatible chat clients.
- Fails closed: malformed output or missing `verified|disputed` ruling becomes
  a disputed attestation.
- Seals QVAC reviews into signed deterministic attestations so WDK release logic can verify them.

`tether-wdk-bridge.js` adapts a WDK payment processor into PearCup's settlement contract:

- Creates WDK-backed receive/payment transactions for bracket entries and game escrows.
- Confirms bracket entry payments before pool settlement.
- Refunds confirmed bracket entry payments only after the WDK processor reports a completed refund.
- Refunds held game escrows only after a rail-signed WDK dispute/hold event is
  replayed for the escrow.
- Keeps payout preparation behind a signed QVAC attestation.

`sdk-runtime.js` is the optional package-backed runtime loader:

- Loads `@qvac/sdk` only when a Pear worker asks for a QVAC SDK client.
- Loads `@tetherto/wdk`, `@tetherto/wdk-wallet-evm`, and `@tetherto/wdk-wallet-btc` only when package-backed WDK payments are configured.
- Exposes package-backed QVAC referee and WDK processor adapters while keeping preview and tests runnable without installed SDK packages.
- Honors `autoUnload` by releasing QVAC models loaded by the worker after each referee completion, while leaving externally preloaded models under their owner's lifecycle.
- Quotes WDK payout transfers by default. `broadcastPayouts` must be explicitly enabled before `transfer` or `sendTransaction` can be used for prize release.

`runtime-config.js` chooses the active integration mode:

- Detects supported browser globals: `window.QVAC`, `window.PearCupQVAC`, `window.TetherWDK`, and `window.PearCupTetherWDK`.
- Also detects `window.PearCupQVACCompletion` for QVAC SDK/OpenAI-compatible completion clients and `window.PearCupTetherWDKProcessor` for WDK processor bridges.
- Can create package-backed adapters from `window.PearCupRuntimeOptions.sdkPackages` or `createRuntimeConfig({ sdkPackages })`:
  `sdkPackages.qvac` routes through `@qvac/sdk`, and `sdkPackages.tetherWdk` routes through `@tetherto/wdk`.
- Can consume `window.PearCupRuntimeSettingsValue`, which is the sanitized settings shape produced by `runtime-settings.js`.
- Requires `attestRound` and `attestPoolSettlement` for QVAC. Requires `createGameEscrow`, `releaseGameEscrow`, `createEntryIntent`, `confirmEntryIntent`, and `createPoolPayout` for Tether WDK before SDK mode is enabled.
- Falls back to locked demo adapters when SDK clients are missing or partial.
- Keeps real-money pools locked unless both SDK adapters are ready and the compliance flags are explicitly true.
- Creates the worker with the selected adapters so QVAC and WDK events flow through the same event log.

`runtime-settings.js` centralizes package/compliance configuration:

- Reads `config/pearcup.runtime.json` when present, or the path in `PEARCUP_RUNTIME_CONFIG`.
- Merges environment overrides such as `PEARCUP_WDK_SEED`, `PEARCUP_QVAC_MODEL_SRC`, `PEARCUP_QVAC_PRELOADED_MODEL_ID`, and the compliance flags.
- Treats `modelId` as a display/provenance label; live QVAC setup still needs `modelSrc`, `modelExport`, or `preloadedModelId`.
- Preserves payout controls such as `PEARCUP_WDK_PAYOUT_ACCOUNT_INDEX`, `PEARCUP_WDK_DEFAULT_PAYOUT_ADDRESS`, `PEARCUP_WDK_BROADCAST_PAYOUTS`, and `PEARCUP_WDK_QUOTE_PAYOUTS`.
- Redacts WDK seed phrases for logs and preflight output.
- Leaves the checked-in `config/pearcup.runtime.example.json` as a template; local configs with real seed phrases should stay untracked.

`worker-sim.js` models the Pear Bare worker boundary:

- Command dispatch for game, QVAC, and WDK actions.
- `dispatchAsync` for real SDK adapters that return promises, while `dispatch` stays sync for demo and deterministic tests.
- Trusted settlement orchestration commands: `settlement:settleGameRound` resolves signed game evidence, asks QVAC, then releases or rail-signs a held WDK escrow dispute. If `refundOnDispute` is true, the same trusted path refunds the held escrow and receipts the `TetherWdkEscrowRefunded` evidence. `settlement:settleBracketPool` resolves the pool, asks QVAC, then prepares or rail-signs a held WDK payout dispute.
- Direct QVAC referee dispatch is treated as prize-sensitive at the bridge; renderer prize flows use the receipt-producing settlement helpers.
- WDK release and payout commands require the matching QVAC attestation event in the replayed worker log, not just a valid-looking payload attestation.
- Live match events and QVAC commentary are worker-owned replay artifacts:
  `match:ingestEvent` records source-signed `MatchEventIngested` events,
  deterministic stat snapshots are derived from replay, and
  `commentary:generate` records `CommentaryGenerated` only when the segment
  points at replayed match event ids.
- WDK dispute events are rail-signed before replay can treat them as trusted
  escrow or payout holds.
- WDK game escrow refunds: `wdk:refundGameEscrow` records rail-signed
  `TetherWdkEscrowRefunded` events only after a replayed
  `TetherWdkEscrowDisputed` hold exists for the escrow. Peer replay rejects
  refunds that do not match the original locked escrow or WDK rail.
- QVAC pool settlement attestation reads the replayed `BracketPoolSettlementResolved` event and disputes payload-only or mismatched pool results before signing.
- WDK entry reconciliation: `wdk:reconcileEntryIntent` records rail-signed
  pending transaction checks that match the entrant-signed intent and upgrades
  an entry to `TetherWdkEntryConfirmed` only after the processor reports
  captured funds.
- WDK entry refunds: `wdk:refundEntryIntent` records rail-signed
  `TetherWdkEntryRefunded` events that must replay against a confirmed entry
  payment. Refunded payments are removed from the eligible pool-settlement view
  and QVAC refuses settlement source events that reference them.
- Payout recipient declarations: `payout:declareRecipient` records signed
  `PayoutRecipientDeclared` events before pool settlement so the worker can
  derive WDK payout routes from replayable state; renderer flows call this
  through the guarded settlement service.
- Append-only signed event envelopes.
- Derived views for game invites, active game sessions, game topics,
  participants, spectators, commitments, reveals, round results, attestations,
  escrows, game payouts, game escrow refunds, bracket entry intents, pending
  entry checks, entry confirmations, entry refunds, recipient declarations,
  pool payouts, and disputes.
- End-to-end trusted settlement flow from P2P commitments through QVAC attestation to Tether WDK escrow release.
- Bracket-pool WDK flow from entry intent through reconciliation and
  confirmation to prepared pool payout.
- Peer-merge dependency checks reject orphan WDK escrow, release, pool payout,
  and settlement receipt artifacts until their referenced replay evidence is
  present and semantically matches the replayed QVAC, WDK rail signer,
  payload-hash, and event-root proofs.
- Settlement receipts bind QVAC attestations, WDK settlement events, event
  actor IDs, event roots, runtime provenance, QVAC-decided game
  winner/participant hashes, pool winner/payment hashes, and hashed processor
  payout transfer evidence.
- Trusted preflight and launch audit require WDK processor release/payout
  evidence to include at least one hashed transfer for the reported quoted,
  planned, or broadcast status before prize launch can pass.
- Event-log merge and event-root comparison so two peers can prove they converged on the same trusted result.
- Optional storage injection so local commands and merged P2P events persist into an append-only event store.

`worker-client.js` is the renderer-facing worker boundary:

- Wraps the current local worker simulation without changing the UI contract.
- Defines the `pearcup-worker-v1` bridge envelope for a real Pear worker.
- Keeps bridge mode async-only for commands, with cached redacted `view()` and
  `events()` snapshots for the renderer.
- Requests event history only for explicit refresh and merge/sync calls, so
  normal dispatch and settlement responses stay compact in Pear Browser.
- Exposes async merge and refresh methods so P2P game event convergence can run
  through a Pear worker bridge instead of assuming in-renderer worker state.
- Carries worker-side settlement gate details back to the renderer when QVAC,
  Tether WDK, or compliance readiness blocks a prize command.
- Lets future Bare worker code own QVAC, Tether WDK, Hyperswarm, and Corestore
  while the Pear Browser renderer remains a normal webview.

`worker-bridge-protocol.js` is the worker-side bridge handler:

- Validates `pearcup-worker-v1` envelopes from the renderer bridge client.
- Handles `dispatch`, `mergeEvents`, `snapshot`, `status`,
  `settleGameRoundWithReceipt`, and `settleBracketPoolWithReceipt` actions.
- Routes prize-bearing dispatches through the live settlement guard by default.
- Lets bridge-backed UI flows ask the worker to settle and record the receipt
  in one QVAC-before-WDK action.
- Allows only those trusted receipt-producing actions to carry the renderer's
  explicit demo/live guard mode, so Pear Browser previews can run demo
  settlement while raw prize dispatch stays live-guarded.
- Demo bracket and Penalty Clash settlement workers explicitly use local worker
  fallback until `integrationRuntime.canUseRealMoney` is true; live-ready mode
  can then prefer the Pear bridge for the same QVAC-before-WDK flow.
- Keeps direct settlement receipt recording behind the same live/demo guard as
  QVAC and Tether WDK prize commands.
- Keeps raw round, official-results, and pool-settlement evidence commands
  guarded so production bridge flows cannot bypass the trusted settlement path.
- Returns `eventsIncluded: false` with an empty event list unless the request
  includes `includeEvents: true`.
- Redacts WDK seed phrases, payout addresses, and raw payout/game-release
  recipient fields before sending results, events, views, or status back to the
  renderer.

`pear-worker.cjs` is the staged Pear/Bare worker bootstrap:

- Loads the worker-only runtime graph, including package-backed QVAC and Tether
  WDK adapter factories, outside the renderer script graph.
- Creates a `pearcup-worker-v1` server around `worker-bridge-protocol.js`.
- Accepts direct request calls plus common message-port shapes such as
  `postMessage`, `send`, `write`, `on('message')`, and `onmessage`.
- Exposes only the bridge request/status/close surface; SDK seeds and
  payout/game-release recipient fields remain redacted before responses leave
  the worker.

`worker-runtime.js` is the worker bootstrap boundary for real SDK wiring:

- Loads `runtime-settings.js` settings or accepts explicit settings from a Pear worker.
- Creates SDK-backed runtime adapters through `runtime-config.js` without mutating renderer globals.
- Keeps WDK seed phrases inside the worker runtime closure and exposes only redacted status diagnostics.
- Provides async helpers for trusted game and bracket settlement commands.

`settlement-service.js` is the live-money command guard:

- Wraps `worker-runtime.js` with one service for prize-bearing commands.
- Blocks WDK entry, escrow, and settlement commands unless QVAC SDK, Tether WDK SDK, and every compliance flag are live-ready.
- Keeps explicit demo settlement available only when `requireLive: false` is passed.
- Adds a redacted `settlementGate` status that explains which SDK or compliance requirement is missing.
- The renderer uses this service for bracket pool settlement and Penalty Clash settlement, so UI flows exercise the same QVAC-before-WDK path as the worker preflight.
- User-facing bracket pools and Penalty Clash call the receipt-producing
  settlement helpers, so each resolved prize flow surfaces the receipt hash and
  `SettlementReceiptCreated` event alongside QVAC and WDK evidence.
- Receipt-producing helpers wait for replayable result, QVAC, and WDK events
  before recording; incomplete holds report `receiptHeld` and the missing
  evidence instead of creating a rejected receipt artifact.
- Bracket payouts record payout recipient declarations before QVAC attestation
  and WDK payout preparation. Settlement receipts include declaration hashes
  without copying raw recipient addresses into the receipt body.
- Watch-party UI controls now use the renderer worker client for `room:join`,
  `chat:send`, `voice:update`, `stream:start`, and `stream:stop`, with local
  fallback events stored under `rooms/{roomId}/events` and Pear bridge sessions
  able to replace that store without changing the UI contract.
- Profile save and bracket draft/submit actions now use the renderer worker
  client as well: `profile:set`, `bracket:updateDraft`, `bracket:resetDraft`,
  and `bracket:submit` are replayed under `app-state/profile-brackets/events`
  in local preview, while the renderer keeps localStorage only as an optimistic
  UI fallback.
- Home and Watch live stats/commentary also use the renderer worker client:
  `match:ingestEvent`, `commentary:setLanguage`, and `commentary:generate`
  are replayed under `matches/{matchId}/events`, so QVAC commentary references
  source-signed match events instead of renderer-only text fixtures.
- The Games screen uses the same durable storage boundary for Penalty Clash:
  game escrow, commitment, reveal, QVAC, WDK, and receipt events replay under
  `games/{gameId}/events`; repeated renders reuse existing evidence instead of
  appending duplicate settlement facts.

`storage-sim.js` models the Corestore namespace boundary:

- Memory and browser `localStorage` backends.
- Stable namespaces such as `games/{gameId}/events`.
- Idempotent event append and event-root snapshots.
- Restart/replay support for QVAC attestations, Tether WDK escrows, payouts, and disputes.

`transport-sim.js` models the game topic transport:

- Stable `pearcup:v1:game:{gameId}` topics.
- Peer join and publish/sync rounds.
- Duplicate and out-of-order delivery.
- Event-root comparison after topic sync.

The UI loads `core.js`, `worker-sim.js`, `transport-sim.js`, and `storage-sim.js` before `app.js` and will fail loudly if any layer is missing. Replace the demo methods in these files with real Tether WDK, QVAC, Corestore, and Hyperswarm wiring when hackathon credentials/docs are available.

Run the core, adapter, runtime, worker, and transport tests with:

```sh
cd /Users/localllm/Projects/pear-ecosystem/02-apps/pearcup-world-cup
npm test
```

Check installed QVAC and Tether WDK package wiring with:

```sh
npm run preflight:sdk
```

Check Pear Browser compatibility with:

```sh
npm run audit:pear-browser
npm run audit:pear-browser -- --json
npm run audit:pear-browser -- --require-pass
```

The Pear Browser audit verifies local-only HTML assets, classic script loading,
the renderer Content Security Policy, explicit `pear.stage.include` entries,
HTML asset coverage inside the stage manifest, dev-file stage ignores, and that
worker-only QVAC, Tether WDK, launch, and bridge runtime code is not loaded
directly by the renderer. The renderer should stay a normal webview;
prize-bearing QVAC and WDK work belongs behind the worker/service boundary.

Check the worker-side runtime composition with redacted status output:

```sh
npm run preflight:worker
```

Check the full trusted path with live config: bracket payout plus prize-linked
game escrow release. This stays skipped until the live gate is ready, refuses
broadcast payouts unless explicitly overridden for an operator-only run, records
`PayoutRecipientDeclared` evidence for pool winners, and stores receipt metadata
with pool payment hashes, locked bracket submission hashes, scoreboard hashes,
source-event hashes, and no raw recipient addresses. The game escrow preflight
also proves the
QVAC-decided winner has a configured WDK recipient route before launch readiness
can pass. Both trusted preflights verify the persisted settlement receipt before
the launch audit can pass:

```sh
npm run preflight:trusted-path
npm run preflight:trusted-path -- --json
npm run preflight:trusted-path -- --require-live
```

Run the live-readiness doctor when deciding whether the app is allowed to move
from demo settlement to prize-bearing mode:

```sh
npm run config:live
npm run config:live:print
npm run doctor:live
npm run doctor:live -- --json
npm run doctor:live -- --require-live
npm run audit:launch
npm run audit:launch -- --json
npm run audit:launch -- --require-live
```

`--require-live` exits non-zero until QVAC SDK, Tether WDK, and every compliance
gate are ready. The doctor redacts WDK seed phrases and runs a guarded
QVAC-before-WDK smoke only after the runtime is live-ready.

`npm run audit:launch` is the final operator checklist. It combines the live
doctor, payout-recipient strategy, recipient declaration proof,
broadcast-payout policy, trusted bracket-payout preflight, trusted game escrow
preflight, and actual game-winner recipient routing into one redacted report. It
remains blocked until QVAC attestation, Tether WDK payout/release evidence,
settlement receipt recording, recipient declaration hashes, and all compliance
flags are proven together.

Use `config/pearcup.runtime.example.json` as the template for a local
`config/pearcup.runtime.json`, or point `PEARCUP_RUNTIME_CONFIG` at another
JSON file. Environment variables win over JSON values. `npm run config:live`
validates the current setup for live settlement, and
`npm run config:live -- --write` writes a local config from environment
variables without printing the WDK seed.

WDK payout preparation uses `payoutRecipients` or `defaultPayoutAddress` to map
winners to recipient addresses. Live config validation blocks prize mode until
one of those recipient routes is configured. Package-backed payouts are
quote-only by default; set `broadcastPayouts` only after recipient mapping,
custody, legal release, and live operator controls are ready.

For a deeper WDK receive-address check, set `PEARCUP_WDK_SEED` before running the
preflight. The preflight uses `skipInitialBalanceProbe` so it can derive a
receive intent without chain/RPC access; payment confirmation still requires a
real balance provider. Live settlement config should set `evmProvider` and leave
`skipInitialBalanceProbe` disabled.

## Product Shape

The first screen is the identity moment: country, username, generated avatar. After that, the app moves into a pool lobby where every stake tier feels like a fast decision instead of a betting spreadsheet. The bracket view borrows the compact card structure from the reference image: flags, team names, status, scores, nearby pick ownership, and a WDK audit rail for entry confirmations, winner payout recipients, and payout preparation. The watch room keeps the social surface visible while still leaving space for the match itself. The Games screen introduces Penalty Clash as the first sync-heavy minigame, with QVAC modeled as the trusted AI referee and Tether WDK modeled as the settlement rail.

## Pear Architecture Map

Pear should stay split into a thin UI shell and a portable Pear-end worker.

- Renderer: profile setup, bracket picking, watch-room UI, games UI, chat input, stats panels.
- Main/Electron shell: window lifecycle and IPC bridge only.
- Bare worker: Hyperswarm topics, Corestore namespaces, Hypercore or Autobase logs, room membership, bracket submissions, chat replication, stream coordination, game sessions, and escrow/referee events.
- Storage: one local Corestore root, with separate namespaces for profile, brackets, rooms, chat, games, Tether WDK intents, QVAC referee attestations, and commentary.
- Room discovery: one Hyperswarm instance joins room, bracket, and game topics, so watch parties, pools, and minigames are peer-discoverable without central infrastructure.
- Bracket integrity: each submitted bracket is represented by an append-only
  `BracketSubmissionLocked` event. Pool settlement derives winners from those
  locked picks and the replayed official results before QVAC signs the payout
  path.
- Bracket payment lane: each pool entry creates a WDK entry intent, reconciles
  pending WDK transaction status in the worker log, and prepares pool payouts
  only from confirmed entries whose payment IDs and winner IDs match the QVAC
  pool attestation. Worker-created pool settlements bind QVAC source evidence
  to replayed `TetherWdkEntryConfirmed` event IDs, `BracketSubmissionLocked`
  event IDs, and an `OfficialResultsSnapshotRecorded` event. QVAC signs the
  pool `officialResultsHash` and `bracketScoreboardHash`, so Pear Browser stays
  a thin renderer and cannot invent confirmed payment, bracket-pick, or
  match-results evidence.
  Package-backed WDK quotes payout transfers by default, requires winner
  recipient addresses, and records broadcast evidence only when explicitly
  configured.
- Commentary lane: ingest live match events, normalize them into a compact event stream, then route that stream to QVAC for multilingual commentary and summaries. In this prototype, QVAC is represented as the language commentary panel.
- Watch-party lane: `room:join`, `room:leave`, `chat:send`,
  `voice:update`, `stream:start`, and `stream:stop` are worker-owned replay
  events. Chat, voice, and stream events require a signed room join, and stream
  start requires explicit rights confirmation before the TV state is trusted.
- Minigame sync: Penalty Clash creates signed `game:invite`,
  `game:acceptInvite`, and `game:join` session events with stable
  `pearcup:v1:game:{gameId}` topics, then sends signed commitments and
  reveals, normalizes `roundIndex`/`roundId`, computes a deterministic result,
  binds QVAC source IDs to the actual commitment/reveal event envelopes,
  compares state hashes, updates the session scoreboard, then routes the result
  to QVAC for referee attestation.
- Runtime gate: the renderer reads one runtime config for QVAC, Tether WDK, and compliance readiness. Demo mode is visible and real prizes remain locked until complete SDK clients are present.
- Tether WDK lane: bracket entries and game escrows should use WDK payment intents. In this static prototype, WDK is represented by demo USDT escrow state and settlement status; package-backed runtime mode can quote or explicitly broadcast prize releases through WDK.
- Session escrow lane: when a replayed Penalty Clash session exists, WDK game
  escrows bind `sessionId`, `sessionEventId`, `sessionHash`, source event IDs,
  players, stake hash, amount, and asset to that `GameSessionStarted` event
  before the worker accepts the escrow as trusted.
- QVAC referee lane: prize-linked minigames require normalized round identity, replayable source event IDs, a QVAC-decided winner, and a signed QVAC attestation before Tether WDK releases escrow.
- Sync lane: peers exchange append-only event logs, verify event envelopes,
  submit matching `game:submitRoundStateHash` evidence, merge unseen valid
  events, and compare event roots before trusting leaderboard or payout state.
- Storage lane: game settlement events persist under a game namespace and are
  envelope-verified during restart replay before trusting QVAC or WDK payout
  state; the renderer demo reuses existing escrow, commitment, and reveal
  evidence from `games/{gameId}/events` before dispatching new commands.
- Transport lane: game sessions publish over stable Pear-style topics and converge despite duplicate or out-of-order event delivery.
- Bridge transport lane: Penalty Clash can now use the same async topic sync
  against a bridge-backed Pear worker, so QVAC and Tether WDK settlement events
  can stay worker-owned while the renderer reads compact redacted snapshots and
  asks for event history only during refresh or merge/sync operations.

Useful Pear docs:

- Pear overview: https://docs.pears.com/
- Pear stack: https://docs.pears.com/explanation/the-pears-stack/
- Desktop architecture: https://docs.pears.com/explanation/pear-desktop-architecture/
- Hyperswarm peer rooms: https://docs.pears.com/how-to/connect-to-peers/connect-to-many-peers-by-topic-with-hyperswarm/
- Multi-room chat model: https://docs.pears.com/how-to/connect-to-peers/host-multiple-rooms-in-one-chat-app/
- Hypercore persistence: https://docs.pears.com/how-to/store-and-replicate/replicate-and-persist-with-hypercore/

## Next Build Steps

1. Start from the Pear Electron template.
2. Move this static renderer into the template's renderer folder.
3. Wire the remaining renderer actions to the worker surface for `profile:set`,
   `pool:join`, `bracket:submit`, and the existing worker-owned room, game, and
   commentary commands.
4. Persist bracket, chat, game, WDK, and QVAC referee data in append-only logs.
5. Add a fixture adapter for live match stats and commentary events.
6. Route prize-bearing UI and worker actions through `settlement-service.js`, then move package-backed QVAC and Tether WDK work into the real Pear worker, expose only redacted readiness to the renderer, and flip the explicit compliance flags only after legal review.
7. Gate real-money pools behind jurisdiction, age, KYC, and payout compliance.
