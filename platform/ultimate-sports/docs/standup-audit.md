# Standup Audit

The standup audit is the current bridge between the isolated v2 engines and a
real product-readiness view. It boots the `src/platform.js` facade, walks every
catalog fit, checks launch and mini-game coverage, confirms sports data
aggregator routes, replays every manifest scenario, and produces a grind list.

Run it from the PearCup app root:

```sh
node platform/ultimate-sports/scripts/standup-audit.js
```

Default outputs:

- `platform/ultimate-sports/generated-reports/standup-audit.json`
- `platform/ultimate-sports/generated-reports/standup-audit.html`
- `platform/ultimate-sports/generated-reports/standup-grind-backlog.md`

The HTML file is static and can be opened directly in a browser. The Markdown
backlog is the operator-facing ticket list generated from the same audit data.

## What It Proves

- Manifest contract loads and verifies.
- Every event fit has a launch plan.
- Every recommended pool variant is in a primary or alternate launch plan.
- Every recommended mini-game maps to a command, activation task, and run plan.
- Every event fit has a tournament shell, API plan, and asset pack prompt set.
- Every event fit has a sports data aggregator route.
- Every event fit has a result settlement path: either source-of-truth auto
  settlement with QVAC correction, or QVAC `result-evidence` settlement for
  no-API/manual events.
- Server-side provider clients have redacted request builders and smoke-check
  plans.
- MMA card generated asset outputs are checked target-by-target against the
  Higgsfield output paths.
- `generate-mma-card-standup-assets.js` can create deterministic local
  non-branded standup fixtures for every MMA/combat PNG/MP4 target. These make
  the preview standup-complete while Higgsfield finals are still pending.
- Launch Readiness Gates show the highest currently stand-up-ready product
  level and the next blocked gate across preview, demo, live data, combat
  assets, Pear production integration, and prize mode.
- `fitReadiness` and the Fit Readiness Matrix show every catalog fit as
  demo-ready, provider-blocked, QVAC-local-ready, or asset-blocked. This keeps
  API work, no-API referee lanes, and generated-asset work separated.
- Combat Sport Fight Cards support the same format for MMA, boxing,
  kickboxing, ONE-style cards, bareknuckle, Muay Thai, and grappling. API-backed
  MMA cards use official provider routes when available; no-API combat cards use
  official web evidence, social/web search evidence, host evidence, and QVAC
  referee review to determine the winner.
- The isolated preview shell has a served journey smoke covering dashboard,
  event fits, aggregator, MMA card, and grind-list surfaces.
- Every manifest scenario replays through the facade.
- Product surfaces can be derived from replay state.
- The isolated user-facing preview shell exists when `platform/ultimate-sports/app`
  is present and part of the manifest contract.
- `grindMatrix` breaks the remaining work into provider live-smoke tasks,
  SailGP/premium-data decisions, and combat asset generation/QA tasks.
- `grindBacklog` converts open matrix tasks into actionable tickets with owner
  lane, required env/config, command, expected evidence, and acceptance checks.
- The existing Pear worker bridge exposes an optional `ultimateSports` action
  that delegates nested requests to the isolated v2 bridge protocol.

## What It Does Not Prove Yet

- It does not prove the isolated preview shell is the final Pear-integrated UI.
- It does not prove screenshot-level browser automation for the final Pear UI;
  `npm run smoke:ultimate-preview` is the CI-friendly served preview gate.
- It does not call live provider APIs.
- It does not prove provider credentials, contracts, or SailGP partner access
  until `node platform/ultimate-sports/scripts/sports-data-smoke.js` is run with
  backend env vars and a redacted `passed-live` report is reviewed. The local
  `npm run smoke:sports-data` fixture report proves route/request/normalization
  coverage only.
- It does not mean every event can auto-settle from an API. Creator/reality
  brackets, awards pools, local leagues, and no-API combat cards intentionally
  settle through QVAC `result-evidence` records.
- It does not prove generated Higgsfield finals have been downloaded unless the
  standup fixture metadata has been replaced by provider output metadata. The
  local fixture pack is only for standing up the preview; visual/QVAC review
  evidence is still required before production prize-mode promotion.
- It does not prove the optional v2 bridge action has been deployed in a
  production Pear worker topology or mapped to final storage topics.
- It does not prove real-money settlement is live; real-money remains a gated
  readiness model.

These limitations are intentional. The standup audit should be the first screen
we use to decide what needs grinding out before wiring the current PearCup app
to the ultimate sports platform.

## Public Helpers

- `createUltimateSportsStandupAudit(input)`
- `renderStandupAuditHtml(audit)`
- `renderGrindBacklogMarkdown(audit)`

The platform facade exposes `createStandupAudit(input)` so future UI and bridge
layers can render the same audit data without shelling out to the CLI.

## Preview Shell

The preview shell is generated from the same facade data:

```sh
node platform/ultimate-sports/scripts/generate-mma-card-standup-assets.js
node platform/ultimate-sports/scripts/export-app-snapshot.js
npm run generate:mma-assets
npm run audit:mma-assets
node platform/ultimate-sports/scripts/audit-mma-card-assets.js
node platform/ultimate-sports/scripts/preview-journey-smoke.js
npm run smoke:sports-data
npm run smoke:sports-data:live
npm run preview:ultimate
```

Default preview URL:

- `http://127.0.0.1:4197/`

Default preview smoke report:

- `platform/ultimate-sports/generated-reports/preview-journey-smoke.json`

Default MMA generated-asset audit report:

- `platform/ultimate-sports/generated-reports/mma-card-generated-assets.json`

Default MMA standup fixture metadata:

- `platform/ultimate-sports/generated-assets/mma-card/_standup-fixture-metadata.json`

Default grind backlog report:

- `platform/ultimate-sports/generated-reports/standup-grind-backlog.md`
