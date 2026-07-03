# Ultimate Sports Platform Scaffold

This folder is the isolated workspace for building the post-World-Cup PearCup
platform described in `docs/ultimate-sports-p2p-plan.md`.

It is intentionally not wired into the current PearCup app, root `package.json`,
Pear staging config, or `design/kawaii-app/`. You can keep testing the existing
PearCup build exactly as-is while these v2 engines evolve beside it.

## Folder Contract

- `src/attestation-engine.js`: evidence-bound QVAC/referee attestations for
  results, settlements, disputes, games, room summaries, and payout readiness.
- `src/competition-engine.js`: competition templates, entrants, stages, and
  reusable fixture generation.
- `src/catalog-engine.js`: product catalog and compatibility recommendations
  for event fits, pool variants, and mini-games.
- `src/challenge-engine.js`: materializes accepted watch-room challenges into
  game, market, or side-quest pool command drafts.
- `src/launch-engine.js`: launch planner that composes catalog choices into
  runtime command drafts and scenarios.
- `src/bridge-protocol.js`: request/response envelope and handler for a future
  Pear worker bridge.
- `src/event-log.js`: deterministic event envelopes, merge, and event roots.
- `src/transport-engine.js`: deterministic P2P topic naming, publish, pull,
  sync, and topic-root comparison for replay logs.
- `src/platform.js`: stable product-facing facade for runtime, transport, and
  scenario workflows.
- `src/policy-engine.js`: facade command policy for demo, sponsor-prize, and
  real-money gates.
- `src/scenarios.js`: canned competition/pool/room fixtures for UI and worker
  integration tests.
- `platform.manifest.json`: integration contract for exports, facade methods,
  scenario coverage, and test files.
- `scripts/verify-platform.js`: manifest verifier for the isolated platform
  contract.
- `src/platform-runtime.js`: isolated command dispatcher and replay-derived
  views over the v2 engines.
- `src/persistence-engine.js`: snapshot export/import validation for replay
  logs and joined topic state.
- `src/prediction-engine.js`: pool rules and generic prediction entries.
- `src/card-engine.js`: group-stage, awards, prop, and bingo prediction cards,
  submissions, and resolution.
- `src/dispute-engine.js`: replayable disputes and compact audit bundles for
  receipts, results, games, cards, drafts, markets, and room messages.
- `src/draft-engine.js`: fantasy-lite draft slates, roster entries, scoring,
  and resolution.
- `src/pool-engine.js`: pool creation, leaderboard derivation, and winner
  resolution.
- `src/scoring-engine.js`: deterministic scoring and scoreboard ranking.
- `src/live-prediction-engine.js`: watch-room prediction markets, momentum
  duels, and consecutive-pick streak resolution.
- `src/room-engine.js`: peer watch-room membership, chat, voice, reactions,
  moderation, and challenge tray records.
- `src/game-engine.js`: reusable P2P mini-game session contracts.
- `src/identity-engine.js`: user profiles, invite codes, invite acceptance,
  and room-scoped trust actions.
- `src/mini-game-engine.js`: deterministic resolvers for penalty clash,
  free-kick duel, trivia duel, reaction challenge, and generic score games.
- `src/feed-engine.js`: feed adapter presets, replayable fixture/clock/score
  frames, source-labeled result snapshots, and host corrections.
- `src/settlement-engine.js`: prize mode, readiness gates, and receipts for
  pool, game, card, draft, and market results.
- `src/wallet-engine.js`: replayable demo-credit ledger, sponsor-prize reward
  grants, and payout-route readiness records.
- `src/creator-engine.js`: creator/local-event draft helpers.
- `test/`: standalone Node tests for the scaffold.

## Ground Rules

- Do not import these modules from the live app until a migration task explicitly
  wires a feature through the worker boundary.
- Keep the modules pure and deterministic where possible.
- Keep real-money behavior modeled as readiness gates only; prize movement stays
  in the existing guarded settlement path exposed by the facade policy.
- Prefer compatibility adapters over rewriting the current PearCup World Cup UI.

## Local Checks

Run the scaffold tests directly:

```sh
node platform/ultimate-sports/scripts/verify-platform.js
node --test platform/ultimate-sports/test/competition-engine.test.js platform/ultimate-sports/test/challenge-engine.test.js platform/ultimate-sports/test/feed-adapters.test.js platform/ultimate-sports/test/prediction-scoring.test.js platform/ultimate-sports/test/pool-live.test.js platform/ultimate-sports/test/card-draft-game.test.js platform/ultimate-sports/test/mini-game-engine.test.js platform/ultimate-sports/test/identity-runtime.test.js platform/ultimate-sports/test/dispute-audit.test.js platform/ultimate-sports/test/attestation-engine.test.js platform/ultimate-sports/test/runtime-replay.test.js platform/ultimate-sports/test/room-runtime.test.js platform/ultimate-sports/test/template-breadth.test.js platform/ultimate-sports/test/settlement-depth.test.js platform/ultimate-sports/test/transport-sync.test.js platform/ultimate-sports/test/platform-facade.test.js platform/ultimate-sports/test/bridge-protocol.test.js platform/ultimate-sports/test/persistence.test.js platform/ultimate-sports/test/policy-engine.test.js platform/ultimate-sports/test/catalog-engine.test.js platform/ultimate-sports/test/launch-engine.test.js platform/ultimate-sports/test/wallet-engine.test.js platform/ultimate-sports/test/verify-platform.test.js
```
