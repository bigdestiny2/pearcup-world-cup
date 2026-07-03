# PearCup (Kawaii build) — staging & release

This directory is a **self-contained Pear app** (its own `package.json` + `index.cjs`),
kept separate from the repo's live `app/` so parallel work never collides. It bundles
the Kawaii UI, live WC data relay, real P2P penalty matches, and watch-party sync.

## What's verified
- `pear stage` bundles the whole app (UI, all runtime modules, `peer-net.js` /
  `peer-match.js` / `watch-sync.js`, assets, avatars, crests, `live-match.json`).
- Public link: `pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo`
  (release `1734`). This release keeps the Round of 32 bracket as the active round,
  restores the generated avatar/art assets, and patches the Pear bridge so classic
  renderer scripts load as raw browser JavaScript instead of script-linker ESM
  wrappers.
- Real two-client P2P penalty match + watch chat/reactions verified in-browser
  (BroadcastChannel transport, two windows/tabs).

## Run locally (dev)
```
cd design/kawaii-app
pear run --dev .
```
`node_modules` must be a REAL directory inside this app root (run `npm install` here) — a
symlink pointing outside the root breaks the `pear-electron` pre-step (mangles the module
path). `stage.ignore` must NOT include `/node_modules` or the runtime deps never bundle.

## Status: bundling fixed + boots
Staged/released to `pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo` with pear-electron,
pear-bridge, hyperswarm and the swarm worker all bundled. Release `1734` is the current
public release; `pear run <link>` uses that release pointer. Earlier bugs that blocked
the original bundle:
1. `node_modules` was a symlink to `../../node_modules` (outside the app root) → pre-step
   failed with `Cannot find module '/-electron/pre.js'`. Fix: real local `npm install`.
2. `stage.ignore` listed `/node_modules` → deps were never bundled → runtime
   `Cannot find module 'pear-electron'`. Fix: removed `/node_modules` from ignore.

## Stage a new version
```
cd design/kawaii-app
pear stage <link> .          # <link> from `pear touch`; we used the one above
# add --no-pre to skip the electron GUI pre-bundle (that step needs network + a few min)
```

## Release (publish) — YOUR call, it's outward-facing
```
pear release pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo
```
`release` points the link's "release" version at the latest stage; peers then get it via
`pear run pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo`. Publishing is
irreversible-ish (the version is seeded to the network), so use it intentionally when the
staged checkout is the one you want friends to fetch.

> Note: this app can be staged with `--no-pre` after the runtime bundle has already been
> warmed and verified. Re-run `pear stage <link> .` without `--no-pre` when changing the
> Pear/Electron runtime itself.

## Two peers actually playing each other

The transport auto-selects in `peer-net.js`:
- **Under the Pear runtime** → **hyperswarm** via the Bare worker (`swarm-worker.cjs`,
  spawned with `Pear.worker.run`). Real cross-device P2P. **Built + unit-verified** (two
  swarm bridges connect over the live DHT and route a topic-tagged message end-to-end —
  see the bridge test in the session; and a raw two-instance hyperswarm connectivity test).
- **In a plain browser** (dev/preview) → **BroadcastChannel** fallback (same-origin
  windows/tabs). This is what the in-browser P2P/lobby/watch tests exercised.

`peer-match.js`, `peer-lobby.js`, and `watch-sync.js` are transport-agnostic — topics
(`pearcup:v1:game:<code>`, `pearcup:v1:watch:<match>`, `pearcup:v1:lobby`) match the
settlement convention.

### P2P deps bundling resolved
The staged bundle now contains pear-electron, pear-bridge, hyperswarm and `swarm-worker.cjs`
(verified via `pear dump`). Two gotchas to never reintroduce:
1. `node_modules` must be a real directory in this app root, and `stage.ignore` must not
   list `/node_modules` (see "Status" above).
2. **Never put `?v=` query strings on `<script src>` in index.html** — the pear-electron
   pre-step parses them as entrypoint paths and staging fails with
   "Invalid main or stage entrypoint". Cache-bust the dev preview with hard reloads instead.
3. Do not map `pear.routes` to `/index.html` for this app. Pear rejects HTML app
   entrypoints with `ERR_LEGACY`; map bare roots (`""` and `/`) to `.` so Pear keeps
   the app entry as `main` (`/index.cjs`) without making `/index.cjs` the visible
   renderer document. `index.cjs` also keeps a defensive bridge-root shim that maps
   root renderer requests and root IPC file lookups to `/index.html`. Do not rewrite
   `Pear.config.link` or `Pear.argv` to `/index.cjs`; that makes Pear Browser display
   the script-linker ESM wrapper instead of the UI.
4. Keep renderer styling self-contained. External font imports can work in the local
   preview and still be blocked or unavailable in Pear, so use packaged assets and
   system font stacks only.
5. Keep classic renderer `.js` requests on the raw bridge path. Pear's bridge transforms
   `app:app` JavaScript into ESM wrappers by default, which breaks this app's classic
   `<script>` graph and can surface as `Unexpected token 'export'` or visible
   `/index.cjs+esm-wrap` source. The bridge shim in `index.cjs` rewrites normal
   renderer `.js` lookups from `app:app` to `app:raw`; leave explicit module/import
   requests alone.

Ship path (release + seed are the owner's calls):
```
pear release pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo   # publish latest staged checkout
pear seed    pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo   # keep it fetchable (hiverelay pin)
```
Then Zeek runs `pear run pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo`.

**Seeding / hiverelay:** `pear seed <link>` on a machine that stays online keeps the app
(and its swarm) reachable. For always-on availability, run `pear seed` under a process
manager on a VPS, or point it at your relay node.

## Live match data
A worker (or `FOOTBALL_DATA_KEY=… node fetch-live.mjs`) writes `live-match.json`; the app
auto-detects it (`detectLiveRelay`) and shows the real scoreline with no settings. In
production a Pear worker runs `fetch-live` on a timer and relays over the room topic.
