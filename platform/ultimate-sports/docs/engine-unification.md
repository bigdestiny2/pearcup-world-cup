# Engine unification (Phase 1B) — one source of truth

Today there are two implementations of the domain logic:

- **Shell (browser):** `shell/core.js`, `shell/settlement-*.js` etc. — a clone of the
  Kawaii/base app's hardened demo logic, loaded as classic `<script>`s.
- **Platform (`src/`):** 53 deterministic engines behind `src/platform.js`, node
  CommonJS, tested (235 tests).

The goal is to route the shell's scoring/settlement/pools through the `src/` engines
so there is a single source of truth. This is a multi-step change; this doc tracks it.

## Done: scoring parity proof

`test/scoring-parity.test.js` proves `shell/core.js scoreBracketSubmission` and
`src/scoring-engine.js scoreClassicBracket` produce **identical** score / correctCount /
perfect for the same bracket + results, and that both use the same `2^(round-1)` weight
ladder (r32=1, r16=2, qf=4, sf=8, final=16).

Why it matters: it shows the shell can be routed to the engine **without changing
behavior**, and it guards the two from drifting while unification proceeds.

## Remaining path

1. **Browser-bundle the pure engines.** The core engines (scoring, pool, prediction,
   competition, `util`, `constants`, `event-log`) use only relative `require('./…')`
   with no node builtins, so they are browser-safe once bundled. Add a build step (mirror
   the existing `scripts/build-*.mjs` / `pearcup-boot.js` concatenation pattern) that
   emits a `shell/engines.bundle.js` exposing `window.UltimateEngines`.
   (Exclude `mma-card-asset-engine` and `standup-audit-engine` — those use fs/path.)
2. **Adapter layer.** Map the shell's UI state (`state.picks`, `enteredPools`, fit config)
   to engine inputs (entries, result snapshots, pools). Extend the parity approach to
   pool settlement and payouts before swapping.
3. **Swap incrementally, behind the UI.** Route scoring first (parity-proven), then pool
   leaderboards, then settlement — each behind a flag, verified against the shell's
   current output, then remove the shell's duplicate.
4. **Retire the clone.** Once all paths route through the engines, delete the duplicated
   `shell/core.js` / settlement logic.

## Sequencing

Best folded in alongside Phase 4 (real data/money): the engines already model WDK/QVAC
settlement and compliance, so unifying there avoids doing settlement wiring twice.
