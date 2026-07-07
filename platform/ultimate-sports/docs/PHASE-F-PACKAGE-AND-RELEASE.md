# Ultimate Sports — Phase F: Package & Release (for kimi)

Goal: publish **Ultimate Sports** as its own Pear app on a `hyper://` drive, with
the same release rigor the kawaii build already has — verified, gated, friend-
tested, reproducible — without ever coupling to or destabilizing the kawaii
hackathon app.

Read `docs/BUILD-OUT-PLAN.md §1` first (conventions + landmines). Anchor: `main`
@ `e69b1ec`; suites green; fit smoke 73/73.

**Two independent publish targets, one repo:**
- `design/kawaii-app/` → its own drive (PearCup World Cup, hackathon). **Do not
  touch.** Its pipeline is the reference to mirror, not to modify.
- `platform/ultimate-sports/` → its own drive (Ultimate Sports). This is Phase F.

---

## 0. What already exists (don't rebuild)

- **Pear app**: `platform/ultimate-sports/index.cjs` (bridge entry serving lobby +
  shell + assets), `package.json` `pear` block (gui/routes/stage/assets),
  `scripts/run-pear-dev.mjs` (dev via a temp mirror because of the space-in-path).
- **Release prep**: `scripts/prepare-ultimate-sports-release.mjs` — runs the test
  suite → `build-engines.mjs` → per-fit smoke → optional `pear stage`/`release` →
  writes `ultimate-sports-release-receipt.json`. npm: `release:prepare`,
  `release:stage`, `release:publish`.
- **Fit smoke**: `scripts/smoke-ultimate-fits.mjs` (`npm run smoke:fits`) — 73/73
  filesystem+vm checks over every fit (config/theme/assets/catalog/mini-games).
- **Reference (kawaii, read-only)**: `scripts/prepare-pearbrowser-release.mjs`,
  `publish-approved*.mjs`, `check-friend-ready.mjs`, `check-pear-seamless.mjs`,
  `check-pearbrowser-publish-handoff.mjs`, `smoke-pearbrowser-*.mjs`,
  `record-friend-test-result.mjs`, `launch-status-latest.mjs`, and the root
  `package.json` scripts (`prepare:pearbrowser-release`, `publish:approved`,
  `check:friend-ready`, `check:pear-seamless`, `record:friend-test`, …). Mirror
  their *shape* for Ultimate Sports.

## The gap to close
Ultimate Sports can boot and stage, but the release path is thin vs kawaii's:
no published-link smoke, no served-preview proof, no publish-approval gate, no
friend-test record, no launch status, no CI, and a couple of manifest issues.

---

## F1 — Fix the manifest to the proven pattern (do first)

- **F1.1 Restore the `pre` hook, drop hand-rolled entrypoints/assets.** Files:
  `platform/ultimate-sports/package.json`. Today the `pear` block hand-rolls
  `stage.entrypoints` and the `assets.ui` runtime block (pinned to
  pear-electron@1.7.28). Kawaii uses `"pear": { "pre": "pear-electron/pre", ... }`
  and lets the pre-hook derive entrypoints from the GUI HTML `<script src>` tags
  and inject the UI assets. Do: add `"pre": "pear-electron/pre"`, remove the
  hand-rolled `entrypoints` and `assets` (compare against
  `design/kawaii-app/package.json`). This avoids silent drift on pear-electron
  upgrade and auto-covers classic scripts like `/shell/runtime-settings.js`.
  Done-when: `pear stage --dry-run` (or a stage into a scratch drive) lists all
  needed entrypoints without the hand-rolled list.
- **F1.2 Confirm the assets fix holds.** `/generated-assets` is now in
  `stage.include` (only `_asset-manifest.json`/`_generation-plan.json` ignored) and
  in `run-pear-dev.mjs mirrorDirs`. Verify a staged build actually contains the fit
  images (see F3). Done-when: staged drive serves `/generated-assets/world-cup/
  server-card-cover/cover.jpg` (200, non-empty).
- **F1.3 Version + metadata.** Set a real `version` and `description` in
  `package.json`; decide the drive name (currently `ultimate-sports-dev` — pick the
  production name). Done-when: manifest carries a versioned, named app.

---

## F2 — Bring the release pipeline to parity (mirror kawaii)

Extend `prepare-ultimate-sports-release.mjs` (and add sibling scripts) so the
release is *proven*, not just staged. Each is a gate that must pass before
publish. Mirror the kawaii script of the same name for structure.

- **F2.1 Served-preview smoke.** New: `scripts/serve-ultimate.mjs` (serve the
  packaged app over local HTTP, like `serve-pearbrowser-hyper.mjs`) +
  `scripts/smoke-ultimate-served.mjs`. Prove the lobby boots, 12 servers render
  with covers (no 404), and opening a fit boots the engine bundle + P2P modules —
  headless (fetch + a tiny DOM assert), the way the kawaii served-smoke works.
  Done-when: `npm run smoke:ultimate-served` passes on the packaged bundle.
- **F2.2 Published-link smoke.** New: `scripts/smoke-ultimate-published.mjs` —
  after publish, fetch from `hyper://<drive-key>/` (or the PearBrowser gateway) and
  assert the same contract (lobby + a fit + assets). Mirror
  `smoke-published-pearbrowser.mjs`. Done-when: it passes against a real published
  drive and rejects a stale/preview path.
- **F2.3 Pear-runtime smoke.** New: `scripts/smoke-ultimate-pear-run.mjs` —
  launch the app under Pear and assert boot-ready markers (lobby rendered, server
  table populated, a fit opens, P2P modules ready). Mirror
  `smoke-kawaii-pear-run.mjs`. (Needs a display; document it as the human/CI-GUI
  step.) Done-when: launching proves the app boots for real.
- **F2.4 Publish-approval gate.** New: `scripts/publish-approved-ultimate.mjs` —
  validate the receipt + a SHA of the staged bundle, run preflights, then execute
  the publish only with an explicit `--publish` flag, capture the `hyper://` URL,
  and run the published-link smoke automatically. Mirror
  `publish-approved-pearcup.mjs`. Done-when: publishing requires explicit approval
  and self-verifies afterward.
- **F2.5 Friend-test record + launch status.** New:
  `scripts/record-ultimate-friend-test.mjs` + `scripts/launch-status-ultimate.mjs` —
  record a cross-device friend test (friend opened, reached a server, joined P2P,
  private-room invite verified, played a mini-game) bound to the publish SHA, and
  report launch readiness. Mirror `record-friend-test-result.mjs` /
  `launch-status-latest.mjs`. Done-when: a friend test is recorded against the
  published SHA and launch status reflects it.
- **F2.6 Release-scope audit.** New: `scripts/audit-ultimate-release-scope.mjs` —
  fail if the working tree is dirty vs the staged bundle inventory (mirror
  `audit-pear-release-scope.mjs`). Done-when: a dirty tree blocks release.
- **F2.7 Wire the gates into `prepare-ultimate-sports-release.mjs`** as sequential
  steps with a receipt: tests → build-engines → fit smoke → served smoke → scope
  audit → (stage) → published smoke → (record friend test). Done-when:
  `npm run release:prepare` produces a receipt with every gate green, and refuses
  to proceed on any failure.

---

## F3 — Per-fit release matrix

The demo's value is "every sport works." Gate on it.

- **F3.1 Extend the fit smoke to a journey smoke.** Files:
  `scripts/smoke-ultimate-fits.mjs` (or a new `smoke-ultimate-fit-journeys.mjs`).
  Today it validates config/assets statically; add a per-fit *runtime* journey
  (load `shell/index.html?fit=<id>`, assert it boots, the correct template kind
  renders, picks work, assets resolve) — headless via a served instance +
  lightweight DOM assertions, one row per fit. Done-when: a matrix report shows
  12/12 fits pass the journey before publish.
- **F3.2 Private-room + mini-game smoke.** Add a check that an enforced room admits
  a valid invite and rejects a code-only peer (the Phase A/D gate), and that at
  least one mini-game resolves P2P. Done-when: the security + play paths are gated,
  not just rendered.

---

## F4 — CI (there is none today)

- **F4.1 GitHub Actions.** Files: `.github/workflows/ci.yml` (repo root). Do: on
  push/PR, run all three suites (`npm test`, `npm run test:kawaii-peer`,
  `node --test platform/ultimate-sports/test/*.test.js`), `npm run smoke:fits`, and
  `node platform/ultimate-sports/scripts/build-engines.mjs --check` (assert the
  bundle is up to date). **Watch the space-in-path** — the repo dir is `pear
  sports`; quote it, and use the test globs. Done-when: CI is green on `main` and
  blocks a PR that reddens a suite or leaves the engine bundle stale.
- **F4.2 Snapshot-churn guard.** The ultimate suite rewrites
  `app/data/ultimate-sports-snapshot.json`. Either make the snapshot write
  deterministic / go to a temp path, or have CI `git diff --exit-code` after tests
  and fail on unexpected churn (forcing the deterministic fix). Done-when: CI stays
  clean after running the suite.

---

## F5 — Publish & operate

- **F5.1 First real publish.** Do: `npm run release:prepare` (all gates green) →
  `npm run release:stage` → `publish-approved-ultimate --publish` → capture the
  `hyper://<drive>` URL → published-link smoke auto-runs. Requires explicit
  approval (real network action). Done-when: Ultimate Sports is fetchable at a
  `hyper://` link and the published smoke passes.
- **F5.2 Cross-device friend test.** Send the link to a friend on another machine;
  they open it in PearBrowser / Pear, add you by peer ID, you create a private room
  and invite them, they redeem + join, you play a mini-game. Record it (F2.5).
  Done-when: a real second device joins an access-controlled room and plays.
- **F5.3 Seed/keep-alive.** Mirror kawaii's `seed`/pin so the drive stays
  fetchable on the DHT. Done-when: the link resolves from a cold peer.
- **F5.4 Launch checklist doc.** A short `docs/ultimate-release-runbook.md`: the
  exact command sequence, the approval gate, the friend-test script, and rollback.

---

## F6 — Coordination with the kawaii app

- Two apps, two drives, one repo. **Never** import across them. The kawaii release
  scripts and Ultimate Sports release scripts are parallel, independent pipelines.
- Shared low-level modules the shell copied from kawaii (peer-net, crypto-identity,
  etc.) are **copies by design** — the shell is self-contained. Don't "dedupe" them
  into a shared path that would couple the two apps.
- If you touch `.pearcup-release/` (kawaii's receipts) — don't; that's the kawaii
  pipeline. Ultimate Sports writes its own receipts under its own out dir.

---

## Definition of done for Phase F
1. Manifest matches the proven pear-electron pattern (`pre` hook, no drift);
   staged builds contain all fit assets (no 404).
2. `npm run release:prepare` runs a full gate chain (tests → build-engines → fit +
   journey smoke → served smoke → scope audit) and writes a green receipt.
3. Publish is approval-gated and self-verifies via a published-link smoke.
4. CI runs all suites + smokes + engine-bundle freshness on every PR.
5. Ultimate Sports is published to a `hyper://` drive, seeded, and passed a real
   cross-device friend test that exercised an access-controlled private room and a
   mini-game — recorded against the publish SHA.

## Gotchas (Phase-F specific)
- The repo path has a space (`pear sports`): staging/serving/CI must quote it;
  `run-pear-dev.mjs` already works around it with a temp mirror + `--base` — reuse
  that approach for any new serve/stage helper, and remember to mirror
  `generated-assets` (fixed) plus any new top-level dir you add.
- `pear stage`/`release` are real network actions — always behind an explicit
  `--publish`/approval flag; never in CI without a gate.
- Keep the engine bundle current: any `src/` engine change must be followed by
  `build-engines.mjs`; CI's `--check` enforces it.
- Don't publish with real-money enabled — Phase D is credential-gated and needs
  legal review; ship demo rails.
