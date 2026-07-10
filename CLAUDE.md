# PearCup — World Cup

**This repository contains exactly one product application: PearCup in `app/`.**
It is the released, publicly judged Pear entry. Treat it as shipped code.

## Scope boundary

Ultimate Sports is a different product in
`github.com/bigdestiny2/ultimate-sports`. Do not add its code, bridge actions,
assets, documentation, or tests here.

Do not create alternate product trees such as `design/`, `platform/`,
`prototype/`, `archive/`, or a second app directory. Git history is the archive.

## Layout

- `app/` — the only Pear app and only product source. It owns the Pear manifest,
  renderer, worker boundary, P2P modules, assets, tests, and generated boot bundle.
- `scripts/` — release gates, staging, publish helpers.
- `docs/` — current architecture and operations documentation only.
- `site/` — marketing website only; never copy runtime code or app assets from it.
- Root `package.json` — private development/release tooling; it is not a Pear app.

## Gotchas

- **The repo path contains a space** (`pear sports/`). `pear stage` fails on it
  with `ERR_INVALID_CONFIG` because `pear.pre` can't resolve the escaped path.
  Stage from a space-free copy — see `app/RELEASE.md`.
- `app/pearcup-boot.js` is **generated**. After touching any
  renderer module, run `npm run build:kawaii-boot`.
- `config/pearcup.runtime.json` is worker/operator-only and may contain custody
  or provider secrets. `app/config/pearcup.runtime.json` is the renderer-safe
  local QVAC configuration. Both are gitignored; never copy the worker file into
  `app/`, stage it, log it, or expose it to the renderer.
- The renderer persists chat/feed/profile to `localStorage`. New default copy
  won't appear until you `localStorage.clear()`.

## Checks

```
npm test
npm run test:kawaii-peer
npm run check:kawaii-runtime
```
