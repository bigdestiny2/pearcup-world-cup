# PearCup (Kawaii build) — staging & release

This directory is the repository's **only self-contained Pear app** (its own
`package.json` + `index.cjs`). It bundles the Kawaii UI, live World Cup data
relay, real P2P penalty matches, and watch-party sync.

## Current readiness snapshot
- Local checked preview: `http://127.0.0.1:4186/` from `npm run serve:pearbrowser`.
- Actual Pear runtime smoke: `npm run smoke:kawaii-pear-run` launches
  `app` with a temp store and fails on the prior fallback/script-wrapper
  boot errors. Its boot probe also requires the real renderer to report hydrated UI,
  32 country cards, generated avatar images, a hydrated profile chip, and visible
  P2P controllers for net/match/lobby/watch. A smoke-only runtime self-test then
  routes the actual Pear renderer to Games, renders generated game avatars and the
  mascot, opens the real friend-invite modal, verifies the hosted match state plus
  `?join=` invite link, then launches a hidden same-origin guest app that opens the
  invite and proves the peer match reaches `started` on both host and guest.
- Friend/publish candidate check: `npm run check:publish-handoff` creates a fresh
  non-published bundle, verifies every hashed file, reruns the Hyper payload smoke,
  and prints the exact publish command. Do not ask friends to use a local
  `127.0.0.1` link; cross-device testing requires publishing/pinning that checked
  bundle after explicit approval.
- Two-client P2P smoke: `npm run smoke:kawaii-p2p-preview` executes the real
  `peer-net.js` plus `peer-match.js` in paired clients. It covers both the local
  BroadcastChannel preview backend and the PearBrowser `window.pear.swarm.v1` backend,
  then proves one client can host, the other can join, both enter Games, and the first
  kick resolves. It also covers the PearBrowser lobby presence/challenge flow and the
  watch-room presence/chat flow over the same shared transport.

## What's verified
- `pear stage` bundles the whole app (UI, all runtime modules, `peer-net.js` /
  `peer-match.js` / `watch-sync.js`, assets, avatars, crests, `live-match.json`).
- Last public Pear runtime link:
  `pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo` (native release `10132`).
  The current PearBrowser/Hyperdrive payload is
  `hyper://0b3eb6272b00ab58f17844bd6cb3452145ffa7da6bd2283aa2590033ae83af0e/`.
  Treat that as the last released pointer, not as evidence that the latest checked
  PearBrowser/Hyper candidate has been published. Re-run the handoff check and use
  its printed bundle path before any new public test.
- Real two-client Penalty Clash + watch chat/reactions now use the shared
  `PearCupPeerNet` channel contract. PearBrowser prefers `window.pear.swarm.v1`;
  Pear Runtime prefers the Bare worker; plain browser preview falls back to
  BroadcastChannel.
- `npm run test:kawaii-peer` covers the transport backends plus app-level first-run
  invite handoff and a two-client Penalty Clash host/join handshake:
  PearBrowser-style invites render as
  `hyper://<drive>/?join=<room>` instead of localhost proxy links; the host creates a
  room, the guest joins it, hello frames cross, both clients enter a peer match, and
  their shooter/keeper roles diverge correctly. It also drives shot/dive/reveal cycles
  through a full best-of-five match and confirms both clients finish with mirrored score
  state and no turn desync. The integrated smoke runs the real PeerNet BroadcastChannel
  fallback and the PearBrowser `swarm.v1` backend with the real PeerMatch, PeerLobby,
  and WatchSync controllers, so a break between those layers fails before a friend-test
  handoff.
- The Hyper payload smoke and live preview readiness checks guard the `?join=` deep-link
  auto-join path. A browser-level smoke on `http://127.0.0.1:4186/?join=<room>` confirms
  the real app boots into Games and opens the friend-join handshake modal without
  renderer errors.

## Run locally (dev)
```
cd app
pear run --dev .
```
`node_modules` must be a REAL directory inside this app root (run `npm install` here) — a
symlink pointing outside the root breaks the `pear-electron` pre-step (mangles the module
path). `stage.ignore` must NOT include `/node_modules` or the runtime deps never bundle.

## PearBrowser preview bundle
From the repo root:

```
npm run serve:pearbrowser
```

That command builds the clean `hyper://` payload, runs the PearBrowser Hyper smoke
check, then serves the exact checked bundle locally. It uses `127.0.0.1:4186` when
available and automatically steps to the next open port if an older preview is still
running.

The same repo-level `npm run check` now also reaches the Pear launch path through the
publish handoff gate: it verifies the self-contained Pear runtime package, launches
the actual Kawaii Pear GUI smoke with a temp store, and only then builds the checked
PearBrowser payload.

To smoke-test the actual local Pear GUI path without publishing or touching persistent
app state:

```
npm run smoke:kawaii-pear-run
```

That launches `app` with `pear run --tmp-store --no-ask --no-pre .`,
watches for the previous failure signatures (`Unexpected token 'export'`,
`/index.cjs+esm-wrap`, `Invalid filename: /`, fallback boot errors, missing modules),
requires the boot-ready probe to prove P2P readiness plus hydrated UI/controller
readiness, then runs a smoke-only runtime self-test that navigates to Games, opens the
real friend invite, launches a hidden guest app on the generated `?join=` link, and
verifies modal/code/link/host state plus a completed host/guest peer handshake before
shutting the app down. Current Pear emits `Pear.worker` deprecation
warnings; those are expected for this build and allowed by the smoke.

Before inviting a remote tester, run:

```
npm run check:friend-ready:preview
```

That combines the Pear runtime package check, actual Pear GUI launch smoke, clean
Hyper payload build/smoke, the integrated two-client preview P2P smoke, and the
currently served preview URL check. It also
verifies that the served app exposes the active P2P backend, no longer shares
localhost proxy URLs as friend invites, preserves the Pear runtime Games/invite
self-test hook, requires every P2P boot marker, and serves the generated avatar,
mascot, stadium, confetti, ball, and crest assets. It still does not publish;
release/pin remains an explicit outward-facing step.

To create a non-published release candidate with file hashes:

```
npm run prepare:pearbrowser-release
```

This runs the Kawaii runtime check, `npm run test:kawaii-peer`,
`npm run smoke:kawaii-pear-run`, `npm run smoke:pearbrowser-serve`, and
`npm run smoke:pearbrowser-published-local`, then writes a clean `bundle/` plus
`pearcup-release-receipt.json` under a temp release-candidate directory. The receipt
records those source checks, the explicit boot-probe contract, the served-preview
contract, the local published-gateway contract, and the bundle smoke so the exact
payload can be confirmed before publishing/pinning it.

When a remote friend is actually queued up, prefer the durable local handoff path:

```
npm run prepare:pearbrowser-release:handoff
npm run check:publish-handoff:latest
```

That writes the exact bundle and `pearcup-release-receipt.json` to the ignored
`.pearcup-release/latest/` directory, then rechecks that exact receipt. The handoff
path is safe to rerun because the script only uses `--force` inside
`.pearcup-release/` or the system temp directory; it refuses arbitrary delete paths.
It also refuses to remove existing `pearcup-publish-result.json` or
`pearcup-friend-test-result.json` evidence unless `--force-evidence` is supplied, so
do not regenerate the latest handoff over a completed publish/friend session by
accident.
Use the printed SHA and approved command from `check:publish-handoff:latest` for the
explicit publish approval.

Before any publish/pin handoff, run:

```
npm run check:pear-seamless:preview
npm run check:pear-seamless:latest
# lower-level receipt-only check:
npm run check:publish-handoff
# stable friend-test handoff:
npm run check:publish-handoff:latest
# or, for an already-prepared candidate:
node scripts/check-pearbrowser-publish-handoff.mjs --receipt /path/to/pearcup-release-receipt.json
```

`check:pear-seamless:preview` is the top-level fresh-candidate release gate: it
prepares a fresh candidate, validates the approved publish dry-run, runs the
release-scope audit, checks the live `4186` preview, starts the exact receipt-backed local
`/app/<drive>/` published proof server, smokes that published-link fetch/static
contract plus the worker/settlement stack, then builds a temporary Pear app from the
exact generated renderer bundle and runs the Pear runtime Games/invite/hidden-guest
smoke against it. It hard-fails on a dirty worktree unless `--allow-dirty` is passed
for an exploratory run. The exact PearBrowser bundle is still a manifest renderer
payload; final remote proof still comes from the post-publish friend test.

`check:pear-seamless:latest` runs the same top-level proof against the durable
`.pearcup-release/latest/pearcup-release-receipt.json` handoff that would actually be
published for friends, plus the live `4186` preview. Run it after regenerating the
durable handoff and before approving a publish.

The lower-level handoff check recomputes every file hash from the receipt, reruns the Hyper payload smoke,
checks the manifest/asset/P2P contract, verifies that the receipt includes the
deep-link/P2P source coverage, the actual Pear launch smoke, the served-preview
contract, the local `/app/<drive>/` gateway smoke, the worker/settlement stack, the
exact-bundle Pear runtime smoke, and the hydrated UI/controller boot-probe contract,
then validates and prints the structured publish command without
running it. The preferred command goes through
`npm run publish:approved` / `scripts/publish-approved-pearcup.mjs`, which refuses to
publish unless the receipt path and expected bundle SHA match. The command remains
gated on explicit approval for that exact bundle and fresh `pearcup` app name. When
run with `--publish`, the wrapper captures the published `hyper://` URL and runs the
published PearBrowser smoke before reporting the publish verified.

To dry-run that final approval wrapper without publishing:

```
npm run publish:approved -- --receipt /path/to/pearcup-release-receipt.json --sha <bundle-sha> --dry-run
# or, for the durable handoff:
npm run publish:approved:latest -- --dry-run
```

The dry-run also runs the exact-bundle published-gateway preflight and the
exact-bundle Pear runtime preflight before printing the source git head, clean/dirty
state, bundle SHA, the approved wrapper publish command, the internal raw
PearBrowser publish command, post-publish smoke command, and remote friend-test
recording command for the latest handoff, so keep that output with the release notes
for the friend-test session. Use the approved wrapper command for publishing; the raw
PearBrowser publish command is printed only as the internal command the wrapper will
run after its checks pass.

If PearBrowser's local gateway is not on the default `http://127.0.0.1:17208/`,
append `--gateway http://127.0.0.1:<port>/` to the approved publish command; the
wrapper passes it through to the post-publish smoke.

When the exact durable handoff SHA has been explicitly approved, use the latest helper
to avoid copying the receipt path or SHA by hand:

```
npm run publish:approved:latest -- --publish
```

It reads `.pearcup-release/latest/pearcup-release-receipt.json`, supplies the exact
receipt and bundle SHA to the approved wrapper, and still will not publish unless
`--publish` is present. The receipt also records the git commit that produced the
bundle; the latest helper refuses stale or dirty handoffs. The approved wrapper also
refuses to overwrite an existing `pearcup-publish-result.json` unless
`--force-result` is supplied, so use that flag only when intentionally replacing stale
or incorrect publish evidence.

The approved wrapper runs this after publish/pin. You can also smoke the actual
PearBrowser-served link manually before inviting friends:

```
npm run smoke:pearbrowser-published -- --url hyper://<drive-key>/
# or, if PearBrowser exposes the local gateway:
npm run smoke:pearbrowser-published -- --url http://127.0.0.1:17208/app/<drive-key>/
# or with a non-default gateway:
npm run smoke:pearbrowser-published -- --drive <drive-key> --gateway http://127.0.0.1:<port>/
```

That check refuses the local `4186` preview, fetches the PearBrowser-served renderer
files, verifies the `?join=` deep-link payload path, confirms `swarm.v1`/`hyper://`
invite support, requires every P2P boot-readiness marker, and checks that the
published stadium, ball, confetti, mascot, crest, and generated avatar assets are
non-empty.

After the friend completes the real PearBrowser test, record the result against the
same durable handoff. The helper reads `.pearcup-release/latest/pearcup-release-receipt.json`
and supplies the exact `pearcup-publish-result.json` path plus bundle SHA for you.
The publish result must also carry the source release receipt path, clean
`sourceGitHead`, exact-bundle published-gateway preflight, exact-bundle Pear runtime
preflight, and post-publish smoke evidence before the friend result can be recorded:
the latest helper refuses stale publish results whose receipt path, bundle SHA, or
source commit do not match `.pearcup-release/latest/pearcup-release-receipt.json`.
The lower-level recorder also opens the source release receipt named by the publish
result and refuses to record a pass if the source commit, clean source state, bundle
SHA, expected `postPublishVerification.resultPath`, or `approvedPublishCommand`
receipt/SHA do not match. The final friend-test result copies the approved publish
command, local published-link proof command, post-publish smoke command, and publish
preflight booleans, plus the remote friend checklist from the publish result, so the
recorded remote result remains auditable on its own.

```
npm run record:friend-test:latest -- \
  --friend "<friend-name>" \
  --room-code "<observed-room-code>" \
  --friend-opened \
  --reached-games \
  --joined-p2p \
  --started-penalty-clash \
  --notes "<what both sides observed>"
```

Use `--failed --notes "<what failed>"` with the same command if the remote test does
not pass; the recorder keeps the result pending for a retry. The recorder refuses to
overwrite an existing `pearcup-friend-test-result.json` unless `--force` is supplied,
so use `--force` only when intentionally replacing stale or incorrect evidence.

## Status: bundling fixed + boots
The latest local candidate is verified by the repo scripts above. The last released
Pear runtime pointer is still
`pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo` with pear-electron,
pear-bridge, hyperswarm and the swarm worker all bundled. Native release `10132` is
the current public release pointer; `pear run <link>` uses whatever has been released there,
so do not use it as a freshness check for a new PearBrowser bundle unless a new
release/pin has just been approved and run. Earlier bugs that blocked the original
bundle:
1. `node_modules` was a symlink to `../../node_modules` (outside the app root) → pre-step
   failed with `Cannot find module '/-electron/pre.js'`. Fix: real local `npm install`.
2. `stage.ignore` listed `/node_modules` → deps were never bundled → runtime
   `Cannot find module 'pear-electron'`. Fix: removed `/node_modules` from ignore.

## Stage a new version
```
cd app
pear stage <link> .          # <link> from `pear touch`; we used the one above
# add --no-pre to skip the electron GUI pre-bundle (that step needs network + a few min)
```

## Release (publish) - YOUR call, it's outward-facing
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
- **In PearBrowser (`hyper://`)** -> **`window.pear.swarm.v1`** using drive-scoped
  Tier A subtopics. This is the seamless phone/friend path once the clean
  Hyperdrive build is published and pinned. The first invite/hello frame is queued
  until a peer connects, so rooms do not miss their opening handshake. Friend
  invites reconstruct `hyper://<drive-key>/?join=<room>` from PearBrowser's injected
  base URL instead of copying the local proxy origin.
- **Under the Pear runtime** → **hyperswarm** via the Bare worker (`swarm-worker.cjs`,
  spawned with `Pear.worker.run`). Real cross-device P2P. **Built + unit-verified** (two
  swarm bridges connect over the live DHT and route a topic-tagged message end-to-end —
  see the bridge test in the session; and a raw two-instance hyperswarm connectivity test).
- **In a plain browser** (dev/preview) → **BroadcastChannel** fallback (same-origin
  windows/tabs). This is only a local preview/smoke-test path.

`peer-match.js`, `peer-lobby.js`, and `watch-sync.js` are transport-agnostic — topics
(`pearcup:v1:game:<code>`, `pearcup:v1:watch:<match>`, `pearcup:v1:lobby`) match the
settlement convention. The Games lobby shows a small backend badge: `P2P PearBrowser
swarm` in PearBrowser, `P2P Pear runtime` under Pear, and `Local preview P2P` in the
plain browser fallback.

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
After that publish/seed step succeeds, testers can run
`pear run pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo`. Until then,
use the checked `4186` preview locally and the handoff receipt/publish command for the
fresh PearBrowser candidate.

**Seeding / hiverelay:** `pear seed <link>` on a machine that stays online keeps the app
(and its swarm) reachable. For always-on availability, run `pear seed` under a process
manager on a VPS, or point it at your relay node.

## Live match data
A worker (or `FOOTBALL_DATA_KEY=… node fetch-live.mjs`) writes `live-match.json`; the app
auto-detects it (`detectLiveRelay`) and shows the real scoreline with no settings. In
production a Pear worker runs `fetch-live` on a timer and relays over the room topic.
