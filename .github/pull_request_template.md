<!-- All changes target design/kawaii-app/ (the canonical build). See CONTRIBUTING.md. -->

## What & why


## Verification
- [ ] Rendered the affected view(s) in the browser preview
- [ ] Cycled all 3 themes (kawaii / shonen / neo) — everything recolors
- [ ] If it touches game outcomes: two-window/iframe P2P test passes (HUD dots mirror = determinism preserved)
- [ ] If it touches packaging: `pear stage` succeeds and `pear dump` shows deps bundled
- [ ] No secrets added; no `?v=` query strings on `<script src>`; no top-level throws before `boot()`
