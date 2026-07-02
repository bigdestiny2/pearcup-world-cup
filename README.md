# PearCup World Cup

PearCup is the World Cup bracket, watch party, and P2P minigame app being built for the Pear ecosystem.

> **👉 Active development lives in [`design/kawaii-app/`](design/kawaii-app/)** — the
> canonical Kawaii build (themed UI, AI avatars, real P2P penalty matches, matchmaking,
> shared watch party). Start there. See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the
> module map, dev workflow, and Pear packaging gotchas, and
> [`design/kawaii-app/RELEASE.md`](design/kawaii-app/RELEASE.md) for stage/release.

## Folder Map

- `design/kawaii-app/` - **canonical build** (self-contained Pear app: own `package.json`, `index.cjs`, P2P modules).
- `app/` - earlier base prototype; QVAC/WDK hardening ports FROM here INTO the kawaii build.
- `docs/` - full technical specification, Pear runtime boundary, and architecture notes.
- `index.cjs` / `package.json` / `scripts/` - base-app Pear entrypoint, manifest, preview helpers.

## Run Locally (canonical build)

```sh
cd design/kawaii-app
npm install          # restores git-ignored node_modules (required before pear stage)
pear run --dev .     # Pear desktop window with live local files
```

Plain-browser UI preview (no P2P/hyperswarm):

```sh
python3 -m http.server 4180 --directory design/kawaii-app   # http://localhost:4180
```

### Base app (`app/`)

```sh
npm run preview   # http://127.0.0.1:4174/
npm install && npm run dev   # with Pear CLI/runtime
```

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
