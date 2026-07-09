# PearCup World Cup

PearCup is the World Cup bracket, watch party, and P2P minigame app being built for the Pear ecosystem.

> **👉 Active development lives in [`design/kawaii-app/`](design/kawaii-app/)** — the
> canonical Kawaii build (themed UI, AI avatars, real P2P penalty matches, matchmaking,
> shared watch party). Start there. See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the
> module map, dev workflow, and Pear packaging gotchas, and
> [`design/kawaii-app/RELEASE.md`](design/kawaii-app/RELEASE.md) for stage/release.

## ▶ Run it live on Pear (production)

The published PearCup app runs peer-to-peer over the [Pear runtime](https://docs.pears.com/) —
no server, no download beyond Pear itself:

```sh
pear run pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo
```

**Production link:** `pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo`
(kept fetchable via `pear seed` / HiveRelay pin). Ships the live World Cup bracket
(real 2026 knockout data), watch party, and P2P penalty minigame.

## Folder Map

- `design/kawaii-app/` - **canonical build** (self-contained Pear app: own `package.json`, `index.cjs`, P2P modules).
- `app/` - earlier base prototype; QVAC/WDK hardening ports FROM here INTO the kawaii build.
- `docs/` - full technical specification, Pear runtime boundary, and architecture notes.
- `index.cjs` / `package.json` / `scripts/` - repo-level helpers, release gates, and legacy base-app entrypoint.

## Run Locally (canonical build)

```sh
cd design/kawaii-app
npm install          # restores git-ignored node_modules (required before pear stage)
pear run --dev .     # Pear desktop window with live local files
```

From the repo root, `npm run dev`, `npm run dev:devtools`, `npm run stage`,
`npm run release`, and `npm run seed` all route to this canonical Kawaii app.

Current friend-test preview path from the repo root:

```sh
npm run serve:pearbrowser              # serves the checked Hyper payload on http://127.0.0.1:4186/
npm run smoke:kawaii-p2p-preview       # proves preview + PearBrowser P2P match/lobby/watch paths
npm run check:friend-ready:preview     # verifies the live preview plus the publish bundle contract
npm run smoke:kawaii-pear-run          # launches Pear and proves Games + invite + hidden guest handshake
npm run smoke:pearbrowser-published-local # simulates /app/<drive>/ before publishing
npm run smoke:pearbrowser-published -- --url hyper://<drive-key>/  # after publish/pin only
```

The SHA-gated `npm run publish:approved -- --receipt <receipt> --sha <sha> --publish`
path also runs the published-link smoke automatically after it extracts the new
`hyper://` URL from the publish output. Add `--gateway http://127.0.0.1:<port>/`
to that command if PearBrowser's local gateway is not on the default `17208`.

Avoid ad-hoc `python3 -m http.server` previews for friend testing. They serve the raw
folder, bypass the Hyper payload checks, and can make an old app look like the current
candidate.

### Base app (`app/`)

```sh
npm run preview   # http://127.0.0.1:4174/
PEARCUP_ALLOW_LEGACY_ROOT=1 pear run --dev .  # legacy root Pear package only
```

The legacy root Pear entrypoint is disabled unless `PEARCUP_ALLOW_LEGACY_ROOT=1` is
set, so accidental root launches cannot be mistaken for the canonical friend-test
app.

## Test

From this folder:

```sh
npm test
npm run check
npm run audit:pear-browser
npm run preflight:trusted-path
npm run audit:launch
```

## Integration Direction

This project folder is the working home for the Pear app migration. The current static prototype already models:

- Tether WDK adapter gates for bracket entries, game escrows, confirmations, and payout preparation.
- QVAC trusted referee paths for game rounds and pool settlement.
- Trusted-path preflight for QVAC pool attestation, WDK payout prep, and receipt evidence.
- Launch audit for the final QVAC, WDK, payout-recipient, receipt, and compliance gates.
- Receipt-producing bracket and Penalty Clash settlements that surface receipt hashes in the UI.
- Replayable payout recipient declarations that feed WDK pool payout routing and receipt hashes.
- Renderer worker-client boundary ready for a real Pear worker bridge.
- Worker-side Pear bridge protocol with guarded dispatch, redacted snapshots, and opt-in event history.
- Staged Pear worker bootstrap for message-port bridge requests without loading SDK code in the renderer.
- Append-only event logs, replay roots, and P2P topic convergence.
- Async bridge-backed game sync for Penalty Clash settlement events.
- Runtime readiness checks that keep real-money rails locked until SDK and compliance gates are ready.
- Pear Browser compatibility audit for local-only renderer assets, CSP, staging includes, and SDK-free renderer startup.

See `docs/pear-runtime-boundary.md` for the renderer, worker, WDK, and QVAC split.
