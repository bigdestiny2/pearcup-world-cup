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
- `src/compliance-engine.js`: responsible-play limits, redacted payout
  declarations, and evidence-backed readiness panels for real-money gates.
- `src/compatibility-engine.js`: maps current World Cup teams, pools, bracket
  picks, worker submissions, and official results into v2 runtime commands.
- `src/diagnostics-engine.js`: peer sync diagnostics, transport summaries, and
  load/readability simulations for busy pools and watch rooms.
- `src/launch-engine.js`: launch planner and fit matrix that compose catalog
  choices into compatible runtime command drafts and scenarios.
- `src/bridge-protocol.js`: request/response envelope and handler for a future
  Pear worker bridge.
- `src/event-log.js`: deterministic event envelopes, merge, and event roots.
- `src/transport-engine.js`: deterministic P2P topic naming, publish, pull,
  sync, and topic-root comparison for replay logs.
- `src/tournament-experience-engine.js`: server-lobby style tournament
  selection, renderable custom GUI shells, API plans, and asset-pack briefs per
  event fit.
- `src/platform.js`: stable product-facing facade for runtime, transport, and
  scenario workflows.
- `src/policy-engine.js`: facade command policy for demo, sponsor-prize, and
  real-money gates.
- `src/qvac-engine.js`: deterministic QVAC commentary, room summaries, creator
  assists, trivia-bank checks, and moderation helper records bound to evidence.
- `src/scenarios.js`: canned competition/pool/room fixtures for UI and worker
  integration tests.
- `platform.manifest.json`: integration contract for exports, facade methods,
  scenario coverage, and test files.
- `docs/user-stories-ui-ux.md`: user stories, surface behavior, and per-event
  UI/UX mapping for the mapped tournament and sport types.
- `docs/tournament-lobby-asset-plan.md`: asset generation pipeline and
  tournament-as-server lobby model for custom GUI management.
- `scripts/verify-platform.js`: manifest verifier for the isolated platform
  contract.
- `src/platform-runtime.js`: isolated command dispatcher and replay-derived
  views over the v2 engines.
- `src/persistence-engine.js`: snapshot export/import validation for replay
  logs and joined topic state.
- `src/prediction-engine.js`: pool rules and generic prediction entries.
- `src/card-engine.js`: group-stage, awards, prop, and watch-party bingo
  prediction cards, including grid line scoring, submissions, and resolution.
- `src/dispute-engine.js`: replayable disputes and compact audit bundles for
  receipts, results, games, cards, drafts, markets, and room messages.
- `src/draft-engine.js`: fantasy-lite draft slates, roster entries, scoring,
  and resolution.
- `src/engagement-engine.js`: spectator replays, demo ladders, rematch
  proposals, share cards, creator template galleries, and content calendars.
- `src/pool-engine.js`: pool creation, leaderboard derivation, and winner
  resolution.
- `src/scoring-engine.js`: deterministic scoring and scoreboard ranking.
- `src/live-prediction-engine.js`: watch-room prediction markets, exact-score
  scoreline locks, structured player props, momentum duels, and
  consecutive-pick streak resolution.
- `src/room-engine.js`: peer watch-room membership, chat, voice, reactions,
  moderation, and challenge tray records.
- `src/game-engine.js`: reusable P2P mini-game session contracts.
- `src/identity-engine.js`: user profiles, invite codes, invite acceptance,
  and room-scoped trust actions.
- `src/mini-game-engine.js`: deterministic resolvers for penalty clash,
  free-kick duel, trivia duel, reaction challenge, and generic score games.
- `src/notification-engine.js`: replayable in-app notification batches for
  locks, challenges, results, receipts, reward grants, payouts, and disputes.
- `src/surface-engine.js`: product-facing Home, Discover, Pools, Picks, Watch,
  Games, Creator, Wallet, and Settings surface models derived from replay state.
- `src/feed-engine.js`: feed adapter presets, replayable fixture/clock/score
  frames, source-labeled result snapshots, and host corrections.
- `src/settlement-engine.js`: prize mode, readiness gates, and receipts for
  pool, game, card, draft, and market results.
- `src/wallet-engine.js`: replayable demo-credit ledger, sponsor-prize reward
  grants, and payout-route readiness records.
- `src/wager-engine.js`: deterministic challenge stake plans for demo P2P
  holds, releases, losses, and awards.
- `src/creator-engine.js`: creator/local-event draft helpers.
- `test/`: standalone Node tests for the scaffold.

## Ground Rules

- Do not import these modules from the live app until a migration task explicitly
  wires a feature through the worker boundary.
- Keep the modules pure and deterministic where possible.
- Keep real-money behavior modeled as readiness gates only; prize movement stays
  in the existing guarded settlement path exposed by the facade policy.
- Prefer compatibility adapters over rewriting the current PearCup World Cup UI.

## Product Plan Coverage

The product-plan contract is enforced in `test/catalog-engine.test.js`.

- Event fits: World Cup, Euros / Copa America, Champions League Knockout,
  March Madness, NBA / NHL / MLB Playoffs, Tennis Grand Slams, esports majors,
  MMA / Boxing fight cards, Reality / Creator tournaments, Awards prediction
  pools, and Local leagues.
- Pool variants: classic bracket, confidence, survivor, upset bounty,
  head-to-head duel, group-stage cards, fantasy-lite drafts, watch-party bingo,
  and bracket side quests.
- P2P games and live wagers: penalty clash, free-kick duel, trivia duel,
  next-event prediction, scoreline lock, momentum duel, player-prop duel,
  reaction challenge, watch-party streak, and peer mini fantasy.

## Local Checks

Run the scaffold tests directly:

```sh
node platform/ultimate-sports/scripts/verify-platform.js
node -e "const { spawnSync } = require('node:child_process'); const manifest = require('./platform/ultimate-sports/platform.manifest.json'); const result = spawnSync(manifest.testCommand[0], manifest.testCommand.slice(1), { stdio: 'inherit' }); process.exit(result.status || 0)"
```
