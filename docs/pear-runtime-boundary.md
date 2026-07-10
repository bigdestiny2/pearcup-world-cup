# Pear Runtime Boundary

PearCup product code lives exclusively in `app/`.

The current build is intentionally split between a polished browser/Pear
renderer and deterministic local modules that can move into a Bare worker. Real
money remains disabled unless the QVAC, Tether WDK, and compliance readiness
checks all pass.

## Current Launch Shape

- `app/package.json` is the repository's only Pear manifest and points
  `pear.gui.main` at `index.html`.
- `app/index.cjs` boots `pear-electron` with `pear-bridge`.
- `app/` contains the current renderer, deterministic domain logic, adapter
  gates, local event store, transport simulator, and tests.
- Root `package.json` contains private development and release commands only.
- `scripts/serve.mjs` serves the same renderer locally for browser checks.
- `app/worker-runtime.js` is the Node/Pear-worker bootstrap for loading
  runtime settings, creating package-backed QVAC/WDK adapters, and exposing
  redacted readiness without leaking wallet seed phrases to the renderer.

## Runtime Services

The renderer should stay thin. The production worker should own:

- Corestore namespaces for profiles, pool entries, bracket submissions, watch
  rooms, chat, game sessions, WDK intents, QVAC attestations, and commentary.
- Hyperswarm topics for each bracket pool, watch room, and P2P minigame.
- Signed append-only events with deterministic replay roots.
- Tether WDK calls for entry intents, entry payment reconciliation, entry
  confirmations, game escrows, escrow releases, and bracket-pool payout
  preparation.
- QVAC calls for trusted referee attestation, pool settlement attestation, and
  multilingual commentary over normalized match events.

## Renderer-to-Worker Commands

The worker API should expose these commands first:

- `profile:set`
- `pool:join`
- `bracket:submit`
- `room:join`
- `room:leave`
- `chat:send`
- `voice:update`
- `stream:start`
- `stream:stop`
- `commentary:setLanguage`
- `game:invite`
- `game:acceptInvite`
- `game:join`
- `game:submitCommitment`
- `game:revealInput`
- `game:submitRoundStateHash`
- `game:resolveRound`
- `qvac:refereeAttest`
- `qvac:attestPoolSettlement`
- `wdk:createEntryIntent`
- `wdk:confirmEntryIntent`
- `payout:declareRecipient`
- `wdk:createGameEscrow`
- `wdk:releaseGameEscrow`
- `wdk:createPoolPayout`
- `settlement:settleGameRound`
- `settlement:settleBracketPool`
- `settlement:recordReceipt`

The trusted settlement commands are the preferred production path. They keep
the order inside the worker: deterministic evidence resolution first, QVAC
attestation second, and Tether WDK release or payout preparation last. If
evidence is incomplete or QVAC disputes the result, the worker records a hold
or dispute event signed by the WDK rail instead of asking WDK to move funds.
Direct `qvac:referee-attest` and `qvac:attest-pool-settlement` bridge dispatches
are guarded as prize-sensitive commands; renderer prize flows should call
`settleGameRoundWithReceipt` or `settleBracketPoolWithReceipt` so QVAC
attestation, WDK evidence, and receipt recording remain one ordered worker path.
Those two trusted helper actions may carry an explicit request-scoped
`requireLive` guard mode from the renderer. That keeps Pear Browser demo
previews working through the bridge while raw prize dispatch remains locked
unless the live settlement gate is ready.
For the renderer preview, bracket and Penalty Clash settlement workers use the
local worker fallback while `integrationRuntime.canUseRealMoney` is false; once
the runtime is live-ready, the same helpers can prefer the Pear bridge.
Direct `settlement:record-receipt` dispatch is also guarded; receipt writes are
allowed through the settlement service only after the same live/demo gate used
for QVAC and Tether WDK prize commands, and only after the summary has
replayable result, QVAC, and WDK evidence.
Direct `game:resolve-round`, `results:record-official-snapshot`, and
`pool:resolve-settlement` dispatches are guarded for the same reason: they write
the replayed evidence that QVAC and WDK later bind to, so production renderer
flows must use the receipt-producing settlement helpers instead.
WDK release and payout commands also require the matching QVAC attestation event
to already be present in the replayed worker log; a payload-only attestation is
treated as untrusted even when its deterministic signature verifies.
QVAC pool settlement attestation also reads the replayed
`BracketPoolSettlementResolved` event and disputes payload-only or mismatched
`poolResult` objects before QVAC can sign.
Watch-party social state follows the same replay boundary. `room:join` creates
a signer-bound room membership event with a stable room topic, `chat:send` and
`voice:update` require that replayed membership, `stream:start` requires both
membership and explicit rights confirmation, and `stream:stop` must be signed
by the original streamer. The renderer may display chat, voice, and TV state,
but trusted room state is derived from worker events.
The current renderer uses `PearCupWorkerClient.createAutoWorkerClient()` for the
watch page as well as settlement flows: local preview writes room events to
`rooms/{roomId}/events`, while Pear Browser can provide a bridge-backed worker
without giving the renderer direct ownership of room membership, chat, voice, or
stream state.
Profile and bracket draft state now follow that same renderer contract. Local
preview writes signed `ProfileUpdated`, `BracketDraftUpdated`, and
`BracketSubmissionLocked` events to `app-state/profile-brackets/events`; the
renderer may keep localStorage for optimistic inputs, but saved profile and
submitted bracket state must be read from replayed worker events when present.

`createPearCupWorkerRuntime()` is the current wrapper for this path. It accepts
runtime settings from `config/pearcup.runtime.json`, environment variables, or a
Pear-provided settings object, builds the selected adapters once, and exposes
`settleGameRound()` and `settleBracketPool()` helpers that always use
`dispatchAsync`. Its `status()` output redacts Tether WDK seed phrases and is
safe to show in diagnostics.

`createGuardedSettlementService()` is the production-facing settlement entry.
It wraps the worker runtime and refuses prize-bearing WDK commands unless the
runtime gate is `live-ready`: QVAC SDK ready, Tether WDK SDK ready, real-money
mode enabled, KYC verified, jurisdiction allowed, and responsible-play terms
accepted. Demo settlement is still available for prototypes only when
`requireLive: false` is passed explicitly.

Bracket entries now have an explicit reconciliation step. `wdk:createEntryIntent`
creates the payment request, `wdk:reconcileEntryIntent` records
`TetherWdkEntryPaymentPending` while the WDK processor reports unpaid status,
and only a captured processor status creates `TetherWdkEntryConfirmed`. Pool
settlement derives payout evidence from confirmed, non-refunded entries only
before asking QVAC for a pool attestation and WDK for payout preparation.
`wdk:refundEntryIntent` appends a rail-signed `TetherWdkEntryRefunded` event
only when it replays against a confirmed payment, removes that payment from the
eligible settlement view, and makes QVAC reject later source evidence that still
references the refunded payment. When locked bracket
submissions exist, settlement derives winner IDs from `BracketSubmissionLocked`
events and official results instead of trusting renderer-provided winners. The worker preserves
`payoutRecipients` and `payoutAddress` on the trusted settlement command, but
only forwards them to WDK after the QVAC pool attestation verifies. The WDK pool
payout primitive also requires payout winner IDs and source payment IDs to match
the QVAC pool attestation before preparing a release.
When the worker resolves a bracket pool, the QVAC pool `sourceEventIds` are the
actual replayed `TetherWdkEntryConfirmed` event IDs, any
`BracketSubmissionLocked` event IDs used for scoring, and an
`OfficialResultsSnapshotRecorded` event for the pool's match results. QVAC
attestation signs the pool `officialResultsHash`, source submission IDs, and
`bracketScoreboardHash`; WDK payout preparation re-checks those IDs and hashes
against the worker log before funds can move. Deterministic source IDs are
reserved for pure core tests and offline spec examples where no worker log
exists.
When winners provide payout routes through `payout:declareRecipient`, the guarded
settlement service authorizes the command, the worker records
`PayoutRecipientDeclared` events, and WDK payout recipients can be derived from
the replayed event log. The renderer may collect recipient addresses, but it
must call the settlement service instead of dispatching declaration events
directly. Settlement receipts snapshot declaration hashes so recipient routing
is auditable without copying raw recipient addresses into the receipt body.
`npm run preflight:trusted-path` and `npm run audit:launch` now
require bracket-payout declaration evidence, locked bracket submission evidence,
scoreboard evidence, and a prize-linked game escrow receipt where QVAC referee
attestation matches WDK release evidence. The game preflight also verifies that
the actual QVAC-decided winner has a
`defaultPayoutAddress`, explicit `payoutAddress`, or per-user `payoutRecipients`
route before the QVAC-to-WDK path is treated as launch-ready. `npm run config:live` and the
live-readiness doctor also require an operator-configured `defaultPayoutAddress`
or `payoutRecipients` map before prize mode can be reported as ready.

The current renderer routes bracket-pool and Penalty Clash settlement through
this guarded service with demo mode explicitly allowed when the runtime is not
live-ready. When the runtime becomes live-ready, the same UI path switches to
live-only guarded settlement without changing the event flow. Penalty Clash
commands now normalize `roundIndex` and `roundId` at the worker boundary; if a
synced peer or renderer submits mismatched round identity, the worker records a
`GameSessionDisputed` or `TetherWdkEscrowDisputed` event before QVAC attestation
or WDK payout release can proceed.
The renderer preview stores Penalty Clash settlement evidence in
`games/{gameId}/events` through a localStorage-backed event store when available.
Repeated renders read existing escrow, commitment, and reveal evidence from the
worker view before dispatching new commands, so the demo exercises restart
replay without growing duplicate settlement logs.
Penalty Clash sessions are also worker-owned. `game:invite` records a signed
`GameInviteCreated` event with both players and a stable
`pearcup:v1:game:{gameId}` topic hash, `game:acceptInvite` must be signed by
the invited opponent before `GameInviteAccepted` and `GameSessionStarted` are
accepted, and `game:join` accepts only signer-matched users, with participant
joins limited to invited players. The derived view reconstructs open invites,
active sessions, participants, spectators, topics, current round, and score from
the replayed log, so the renderer cannot invent a game session for QVAC or WDK
settlement.
When the worker creates a WDK escrow for a replayed game session, it binds the
escrow to that `GameSessionStarted` event with `sessionId`, `sessionEventId`,
`sessionHash`, source event IDs, stake hash, amount, asset, and participant
IDs. Peer replay accepts a session-bound escrow only when the WDK rail signer,
session event, players, stake, and deterministic escrow id all match.
Held game escrows may be refunded only through `wdk:refundGameEscrow`: the
worker requires a replayed rail-signed `TetherWdkEscrowDisputed` event for the
same escrow, then verifies that the resulting `TetherWdkEscrowRefunded` payload
matches the original locked escrow and WDK rail before peer replay accepts it.
`settlement:settleGameRound` accepts `refundOnDispute: true` so the trusted
QVAC-to-WDK path can turn a held dispute into a replayable refund without
letting the renderer dispatch low-level refund evidence directly.

`app/worker-client.js` is the renderer contract for the eventual Pear worker.
The local prototype wraps `worker-sim.js`, while a real Pear Browser session can
provide `window.PearCupWorkerBridge`, `window.PearCupBridge`, `Pear.worker`, or
`Pear.bridge`. Bridge calls use `pearcup-worker-v1` envelopes with `dispatch`,
`mergeEvents`, and `snapshot` actions. Commands are async-only in bridge mode,
and the renderer reads cached redacted `view()`/`events()`/`status()` snapshots
instead of loading QVAC, Tether WDK, Hyperswarm, or Corestore code directly.
Worker bridge responses omit event history by default; `eventsIncluded` is true
only when the renderer explicitly asks for `includeEvents: true`, which the
bridge client reserves for refresh and merge/sync calls.
Live stats and commentary follow the same boundary. The renderer may request
`match:ingestEvent`, `commentary:setLanguage`, and `commentary:generate`, but
the worker owns the replayed `MatchEventIngested` events, derives stat snapshots
from that event log, and accepts `CommentaryGenerated` only when the QVAC
commentary adapter signs a segment whose source event ids are present in replay.
Demo mode uses deterministic template commentary; SDK mode can reuse a QVAC
completion client through the runtime-config `qvacCommentary` adapter.
The current renderer uses this same worker client for Home and Watch live
panels: local preview writes match/commentary events to
`matches/{matchId}/events`, while Pear Browser bridge mode can replace that
namespace without making renderer text or stat fixtures authoritative.
The transport layer also exposes async publish/sync helpers so Penalty Clash can
merge duplicate and out-of-order events through the same worker bridge used for
QVAC-before-WDK settlement. Incoming peer and stored events are envelope-verified
against their deterministic event id and signature before they can enter the
worker log, so forged payout or referee events are dropped before they affect
views, receipts, QVAC, or WDK release state.
Final settlement artifacts have an additional replay dependency check during
merge: WDK game releases require the referenced escrow, QVAC attestation, and
QVAC source events; WDK pool payouts require the referenced pool attestation,
pool result, confirmed entry payments, and source events; settlement receipts
require the result, attestation, and WDK settlement events they reference.
Those artifacts must also semantically match the replayed evidence: release
winners, escrow participants, pool winners, payment totals, QVAC signatures,
receipt event-reference payload hashes, and the receipt event root are checked
against the previous-event chain before peer merge accepts them. Orphan or
resealed mismatched artifacts are ignored until the full trusted replay chain is
present and internally consistent.
The trusted preflight and launch audit also require WDK processor release or
payout evidence to include non-empty transfer proof: `transferCount` must be
positive, the reported quoted/planned/broadcast status must appear in the
transfer status counts, and the hashed transfer list must be present. A status
string alone is not enough to unlock prize launch.
Worker-resolved Penalty Clash
rounds now pass the actual commitment and reveal event IDs into the round result
as QVAC `sourceEventIds`; both QVAC attestation and WDK escrow release verify
those source IDs still exist in the replayed worker log. QVAC attestations also
bind the referee-decided winner and round participants, and the worker rejects
any WDK release whose `winnerUserId` or escrow participants do not match that
attestation.
Bracket-pool settlements follow the same replay rule: in `worker-log` mode,
every source payment ID must have a matching `TetherWdkEntryConfirmed` event ID
already present in the log, and the official results hash must match a replayed
`OfficialResultsSnapshotRecorded` event, before QVAC or WDK accepts the
settlement.

`app/worker-bridge-protocol.js` is the matching worker-side handler. It accepts
the same `pearcup-worker-v1` envelopes, owns the `worker-runtime.js` harness,
guards prize-bearing commands with `settlement-service.js`, and redacts WDK seed
phrases plus raw payout and game-release recipient fields before returning
results, events, views, or status to the Pear Browser renderer. It also exposes
receipt-oriented actions for trusted QVAC-to-WDK settlement flows.

`app/pear-worker.cjs` is the staged worker process bootstrap. It loads the
worker-only runtime graph, creates a `pearcup-worker-v1` bridge server, and can
bind direct requests or common Pear/Bare-style message ports without requiring
the renderer to import QVAC, Tether WDK, or seed-bearing configuration code.

`app/settlement-receipts.js` turns a trusted settlement summary into a compact
audit receipt. The receipt binds the replay event root, result event, QVAC
attestation, WDK settlement event, QVAC-decided game winner/participant hashes,
pool winner/payment hashes, runtime gate, and deterministic receipt hash. For
pool payouts and game escrow releases it also snapshots WDK processor status,
broadcast state, transfer counts, transfer status counts, transfer hashes, and
hashed recipient/user evidence so raw recipient addresses are not copied into
the receipt body. Receipt verification rejects completed receipts whose QVAC
winner, participant, payment, or attestation evidence no longer matches the WDK
settlement, along with tampered transfer counts, status counts, and transfer
hashes for both evidence types. It also rejects any completed receipt whose
summary type, QVAC event type, WDK event type, QVAC ruling, or WDK status no
longer represents the completed QVAC-to-WDK path.
It also stores non-secret runtime provenance: redacted settings hash, adapter
sources, readiness state, compliance flags, and secret-redaction indicators.
`createGuardedSettlementService().createSettlementReceipt(summary)` is the
read-only service-level entry point. `recordSettlementReceipt(summary)` records
the receipt as a `SettlementReceiptCreated` worker event, making the audit
artifact part of the replayable P2P log. Production callers should prefer
`settleGameRoundWithReceipt(payload)` and `settleBracketPoolWithReceipt(payload)`;
each returns the trusted settlement summary plus the persisted receipt event in
one guarded call. Game-round receipts accept `TetherWdkEscrowReleased`,
`TetherWdkEscrowDisputed`, or `TetherWdkEscrowRefunded` WDK evidence; refunded
receipts snapshot the refund id, hashed refund user ids, and any WDK processor
refund proof. The renderer's bracket pool and Penalty Clash flows use those
receipt-producing helpers, delegating to the worker-native bridge action when a
Pear worker is present. `npm run doctor:live` records receipt metadata in its
live-ready smoke output so CI and release checks can retain the exact
QVAC-to-WDK evidence reference. Trusted-path preflights and the launch audit
also run receipt verification and block launch readiness when the persisted
receipt does not independently verify.

## SDK Gating Contract

`app/runtime-config.js` currently requires these methods before SDK mode is
enabled:

- QVAC: `attestRound`, `attestPoolSettlement`
- Tether WDK: `createGameEscrow`, `releaseGameEscrow`, `createEntryIntent`,
  `confirmEntryIntent`, `createPoolPayout`

The runtime can also wrap lower-level clients:

- `PearCupQVACCompletion`: a QVAC SDK/OpenAI-compatible completion client that
  receives strict referee prompts and returns JSON review decisions.
- `PearCupTetherWDKProcessor`: a WDK payment processor that can create receive
  transactions, collect payment details, confirm entry payments, and prepare
  prize-pool payout transfers.
- `PearCupSdkRuntime`: optional package-backed factories for `@qvac/sdk` and
  `@tetherto/wdk` modules when those packages are installed in the Pear worker.
- `PearCupRuntimeOptions.sdkPackages`: explicit package-backed runtime config.
  Set `sdkPackages.qvac` to `true` or a QVAC SDK config object, and set
  `sdkPackages.tetherWdk` to a WDK config object with at least `seedPhrase`.
  The runtime then creates `@qvac/sdk` and `@tetherto/wdk` adapters without
  requiring hand-built browser globals. WDK pool payouts are quoted by default
  through `quoteTransfer` or `quoteSendTransaction`; `broadcastPayouts: true`
  is required before the package processor calls `transfer` or
  `sendTransaction`.
- `PearCupRuntimeSettingsValue`: sanitized settings produced by
  `app/runtime-settings.js`. The helper reads `config/pearcup.runtime.json` or
  `PEARCUP_RUNTIME_CONFIG`, merges env overrides, and redacts seed phrases for
  logging. A Pear worker/preload can set this value before `runtime-config.js`
  creates the adapters.
- `npm run config:live`: validates the loaded runtime config for live
  settlement. It requires a QVAC model source/export, a WDK seed, a provider for
  live USDT-EVM confirmation, balance probing enabled for settlement, and every
  compliance flag.
- `npm run config:live -- --write`: writes a local
  `config/pearcup.runtime.json` from `PEARCUP_*` environment variables. The
  command reports only redacted settings, so WDK seed phrases are not echoed.

The app also requires explicit compliance flags before real prizes are enabled:

- `realMoneyEnabled`
- `kycVerified`
- `jurisdictionAllowed`
- `responsiblePlayAccepted`

Until all of those are true, the UI may show demo escrow and settlement state,
but must not claim or execute real prize movement.

Run `npm run preflight:sdk` after `npm install` to validate the installed
package exports. The preflight reads the same runtime settings file/env values
as the app. With `PEARCUP_WDK_SEED` or `sdkPackages.tetherWdk.seedPhrase` set,
it derives an offline WDK receive intent through the same package-backed
processor; it deliberately skips the initial balance probe so RPC access is not
required for startup validation.

Run `npm run audit:pear-browser` before staging to verify the renderer stays
Pear Browser friendly. The audit checks that `app/index.html` uses local
relative assets, classic scripts, a local-only CSP, no inline scripts, no direct
renderer load of package-backed QVAC/Tether WDK SDK runtime code, explicit
`pear.stage.include` entries for browser assets, and ignores for local-only
scripts, docs, tests, design files, and live secrets. Use
`npm run audit:pear-browser -- --require-pass` in release checks.

Run `npm run preflight:worker` to validate the PearCup worker-runtime boundary.
It loads the same settings, creates the worker runtime, wraps it in the guarded
settlement service, prints redacted readiness, and runs a trusted
game-settlement smoke only when QVAC, Tether WDK, and compliance gates are all
live-ready.

Run `npm run preflight:trusted-path` to validate the live bracket-payout and
game-escrow paths. It skips while demo-locked, then in live-ready mode runs
synthetic confirmed entry evidence plus locked bracket submissions through QVAC
pool attestation, WDK payout preparation, and receipt recording; it also runs a
commit/reveal Penalty Clash round through QVAC referee attestation, WDK escrow
release, and receipt recording. The preflight refuses `broadcastPayouts` by default so it cannot
accidentally move funds while checking the trusted path.

Run `npm run doctor:live` for the production-readiness audit. It emits the
current settlement gate, QVAC/WDK modes, compliance flags, required live actions,
and a secret-redaction check. Use `npm run doctor:live -- --json` for
machine-readable output, and `npm run doctor:live -- --require-live` in CI or
release scripts that must fail until the app is truly live-ready.

Run `npm run audit:launch` as the final launch gate. It reuses the live doctor,
runs the trusted bracket-payout and game-escrow paths when possible, and adds
explicit checks for payout-recipient routing, WDK provider configuration, WDK
balance probing, broadcast-payout override policy, QVAC attestation readiness,
receipt evidence, and compliance. `npm run audit:launch -- --require-live`
exits non-zero until the complete QVAC-to-WDK path is proven.

Current official SDK signals checked on July 1, 2026:

- WDK docs list `@tetherto/wdk`, Node.js/Bare quickstart pages, wallet modules,
  and Pear Worklet WDK tooling: https://docs.wdk.tether.io/llms.txt
- QVAC docs list `@qvac/sdk` v0.14.0, Node.js/Bare/Expo support, text
  generation, translation, and OpenAI-compatible HTTP server support:
  https://docs.qvac.tether.io/llms.txt

Current npm package probes from July 1, 2026:

- `@qvac/sdk`: `0.14.0`
- `@tetherto/wdk`: `1.0.0-beta.12`
- `@tetherto/wdk-wallet-evm`: `1.0.0-beta.14`
- `@tetherto/wdk-wallet-btc`: `1.0.0-beta.10`
