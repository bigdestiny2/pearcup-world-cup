# PearCup World Cup

PearCup is the World Cup bracket, watch party, and P2P minigame app being built for the Pear ecosystem.

## Folder Map

- `app/` - current runnable static prototype.
- `docs/` - full technical specification, Pear runtime boundary, and architecture notes.
- `index.cjs` - Pear Runtime entrypoint.
- `package.json` - Pear app manifest, scripts, and launch metadata.
- `scripts/` - local preview helpers.

## Run Locally

From this folder:

```sh
npm run preview
```

Then open:

```txt
http://127.0.0.1:4174/
```

With Pear CLI/runtime installed:

```sh
npm install
npm run dev
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
