# PearCup — World Cup

**This repo contains exactly one app: PearCup, in `design/kawaii-app/`.** It is the
released, publicly judged Pear entry. Treat it as shipped code.

## Do not develop Ultimate Sports here

Ultimate Sports lives in its own repository and its own checkout:

```
github.com/bigdestiny2/ultimate-sports
~/Projects/pear-ecosystem/02-apps/ultimate-sports/platform/ultimate-sports/
```

It used to be vendored here at `platform/ultimate-sports/`. It was removed
because work kept landing in whichever copy happened to be open, and the two
copies silently diverged — repeatedly, in both directions. If you find yourself
about to create `platform/` in this repo, stop: you are in the wrong tree.

The only remaining seam is the worker bridge's `ultimateSports` action
(`app/worker-bridge-protocol.js`). The handler is **injected** by the host —
as a constructor argument, or as `PearCupUltimateSportsBridge` on the root
object. It is never required from a sibling directory. With nothing injected it
fails cleanly with `PEARCUP_ULTIMATE_SPORTS_BRIDGE_UNAVAILABLE`.

## Layout

- `design/kawaii-app/` — the app. Self-contained: own `package.json`, `index.cjs`,
  P2P modules, and its own boot bundle. **Start here.**
- `app/` — earlier base prototype. The QVAC/WDK hardening was ported from here
  into the kawaii build.
- `scripts/` — release gates, staging, publish helpers.

## Gotchas

- **The repo path contains a space** (`pear sports/`). `pear stage` fails on it
  with `ERR_INVALID_CONFIG` because `pear.pre` can't resolve the escaped path.
  Stage from a space-free copy — see `design/kawaii-app/RELEASE.md`.
- `design/kawaii-app/pearcup-boot.js` is **generated**. After touching any
  renderer module, run `npm run build:kawaii-boot`.
- `config/pearcup.runtime.json` holds live API credentials. It is gitignored in
  both repos and must never be committed or copied between them by tooling.
- The renderer persists chat/feed/profile to `localStorage`. New default copy
  won't appear until you `localStorage.clear()`.

## Checks

```
npm test                     # 288 pass
npm run test:kawaii-peer     # 61 pass
npm run check:kawaii-runtime # boot bundle currency + runtime gate
```
