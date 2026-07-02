# Contributing to PearCup

## ⭐ Canonical worktree: `design/kawaii-app/`

**All active development happens in `design/kawaii-app/`.** It is a self-contained Pear
app (its own `package.json` + `index.cjs`) and is the build that gets staged/released.

`app/` is the earlier base prototype. The QVAC/WDK hardening still landing from the codex
workstream should be **ported into `design/kawaii-app/`** (copy the logic modules only —
`core.js`, `adapters.js`, `qvac-referee.js`, `tether-wdk-bridge.js`, `runtime-*.js`,
`worker-*.js`, `settlement-*.js`, `sdk-runtime.js`, `storage-sim.js`, `transport-sim.js`).
**Never** overwrite the Kawaii `app.js`, `styles.css`, `index.html`, or the `peer-*` /
`swarm-worker` modules — those are the design build and have diverged intentionally.

Deep reference (from the base app, still largely accurate): `docs/pearcup-full-technical-spec.md`
and `docs/pear-runtime-boundary.md`.

## Dev quickstart

```sh
cd design/kawaii-app
npm install                 # restores node_modules (git-ignored); REQUIRED before pear stage
pear run --dev .            # launches the Pear (electron) desktop window with live local files
```

Fast UI iteration without the Pear runtime (plain browser, no P2P/hyperswarm — falls back to
BroadcastChannel + sim data):

```sh
python3 -m http.server 4180 --directory design/kawaii-app   # then open http://localhost:4180
```

## Architecture (Kawaii build)

Loaded as classic `<script>`s in `index.html`, in order:

1. **Runtime/logic layer** (shared with base app): `core.js` (deterministic penalty
   resolver + hashing) → `adapters.js` → `qvac-referee.js`, `tether-wdk-bridge.js`,
   `sdk-runtime.js`, `runtime-settings.js`, `runtime-config.js` → `worker-sim.js`,
   `worker-client.js`, `worker-runtime.js` → `settlement-receipts.js`,
   `settlement-service.js` → `transport-sim.js`, `storage-sim.js`. Each attaches a
   `window.PearCupX` global.
2. **`app.js`** (~3600 lines) — the whole UI: 5 views (Profile/onboarding, Home, Bracket,
   Watch, Games), rendering, wallet, themes, the interactive shootout, live-data feed.
3. **P2P layer** (Kawaii-build additions, load after app.js):
   - `peer-net.js` — `PearCupPeerNet`: transport abstraction. `createChannel(topic)` →
     `{send, onMessage, close}`. **Prefers hyperswarm** (via the Bare worker) under Pear,
     **falls back to BroadcastChannel** in a plain browser. Also commit-reveal helpers.
   - `swarm-worker.cjs` — Bare worker spawned by `Pear.worker.run`; runs hyperswarm and
     bridges topics to the renderer over the worker pipe. `createSwarmBridge()` is exported
     for the Node unit test.
   - `peer-match.js` — `PearCupPeerMatch`: real 2-player penalty shootout (commit-reveal).
   - `peer-lobby.js` — `PearCupLobby`: live matchmaking on `pearcup:v1:lobby`.
   - `watch-sync.js` — `PearCupWatchSync`: shared chat/reactions/presence per match.

   Topic convention: `pearcup:v1:game:<code>`, `pearcup:v1:watch:<match>`, `pearcup:v1:lobby`.

### Game outcome model (peer-deterministic)
`kickOutcome(aim, dive, powerPct, entropy)` in `app.js` is the single source of truth for
AI **and** peer matches. In peer matches `entropy = hash(aim|dive|nonce)` using the
shooter's revealed commit-nonce, so **both clients compute the identical result** — do not
introduce any per-client randomness into outcome resolution. Verify determinism with the
two-window/iframe test before shipping any mechanics change.

### Themes
Token-driven. `:root` holds Kawaii tokens; `[data-theme="shonen"]` / `[data-theme="neo"]`
override them. **Never hardcode a color that a themed component uses** — read from a CSS
var so all three themes recolor. New tokens must be added to all three blocks.

## Pear packaging gotchas (learned the hard way — don't reintroduce)

- **`node_modules` must be a real directory inside `design/kawaii-app/`** (run `npm install`
  there). A symlink pointing outside the app root breaks the `pear-electron` pre-step.
- **`stage.ignore` must NOT list `/node_modules`** or the runtime deps never bundle and the
  app fails with `Cannot find module 'pear-electron'`.
- **Never put `?v=` query strings on `<script src>` in `index.html`** — the pre-step parses
  them as entrypoint paths and staging fails ("Invalid main or stage entrypoint"). For dev
  cache-busting use a hard reload, not query params.
- **Any uncaught throw at `app.js` top level (before `boot()`) blanks the app** with no
  visible console in the Pear renderer. Keep module init defensive; a top-level
  `window.addEventListener('error', …)` paints errors into an on-screen bar as a safety net.

## Stage & release
See `design/kawaii-app/RELEASE.md`. Short version (from `design/kawaii-app/`):
```sh
pear stage  <link> .        # full warmup bundles hyperswarm etc.
pear release <link>         # publish (outward-facing — the maintainer runs this)
pear seed   <link>          # keep it fetchable (a "hiverelay" pin on an always-on node)
```

## Security
- No secrets in the repo. API keys (Higgsfield, Football-Data) come from **env vars only**
  (`gen-avatars.mjs`, `gen-assets.mjs`, `fetch-live.mjs`). Never commit a key or a real
  `config/pearcup.runtime.json`.
- Real-money settlement is gated off (`readiness.settlement.realMoneyEnabled === false`);
  the UI honestly shows "Demo results" until WDK leaves demo mode.

## Verifying changes
- UI/logic: the browser preview + a scripted `eval` harness (see session notes) — render
  each view, cycle all 3 themes, play a shootout.
- P2P: open a second window/iframe with `?join=<code>` and drive both — every HUD dot must
  mirror across clients (proves determinism).
- Packaging: `pear stage` then `pear dump <link> /tmp/x` and confirm `pear-electron` +
  `hyperswarm` are present in the bundle.
