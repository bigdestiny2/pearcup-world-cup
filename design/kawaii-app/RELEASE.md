# PearCup (Kawaii build) — staging & release

This directory is a **self-contained Pear app** (its own `package.json` + `index.cjs`),
kept separate from the repo's live `app/` so parallel work never collides. It bundles
the Kawaii UI, live WC data relay, real P2P penalty matches, and watch-party sync.

## What's verified
- `pear stage` bundles the whole app (UI, all runtime modules, `peer-net.js` /
  `peer-match.js` / `watch-sync.js`, assets, avatars, crests, `live-match.json`).
- Staged link: `pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo` (version 58, UNRELEASED).
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

## Status: bundling FIXED + boots ✅
Staged v1533 (current) to `pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo` with pear-electron,
pear-bridge, hyperswarm and the swarm worker all bundled. `pear run --checkout=1525 <link>`
boots past module resolution (launches the GUI). Two bugs that were blocking it:
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
irreversible-ish (the version is seeded to the network), so it's left for you to run.

> Note: the GUI pre-step (`pear-electron/pre`) timed out in this environment. Re-run
> `pear stage <link> .` (without `--no-pre`) once with network available so the electron
> runtime bundles, before your friend does `pear run`.

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

### P2P deps bundling — RESOLVED ✅ (v1533)
The staged bundle now contains pear-electron, pear-bridge, hyperswarm and `swarm-worker.cjs`
(verified via `pear dump`). Two gotchas to never reintroduce:
1. `node_modules` must be a real directory in this app root, and `stage.ignore` must not
   list `/node_modules` (see "Status" above).
2. **Never put `?v=` query strings on `<script src>` in index.html** — the pear-electron
   pre-step parses them as entrypoint paths and staging fails with
   "Invalid main or stage entrypoint". Cache-bust the dev preview with hard reloads instead.

Ship path (release + seed are the owner's calls):
```
pear release pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo   # publish v1533
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
