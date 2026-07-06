# MMA Card Asset and API Plan

This plan specializes `mma-boxing-fight-card` into a premium combat-card asset
pack. The same UI shell can cover MMA, boxing, kickboxing, ONE-style cards,
bareknuckle, Muay Thai, submission grappling, and similar bout-list formats. The
aesthetic can feel UFC-like in energy, pacing, contrast, and broadcast language,
but generated assets must stay non-branded.

## Asset Pack

Source module: `src/mma-card-asset-engine.js`

The full pack includes:

- `lobby-icon`
- `server-card-cover`
- `hero-backdrop`
- `bracket-board-skin`
- `pool-card-accent`
- `mini-game-icon-set`
- `watch-room-stage`
- `result-share-card`
- `empty-state-illustration`

The pack also prepares Higgsfield jobs for short motion loops on the high-impact
surfaces:

- `hero-backdrop`
- `server-card-cover`
- `watch-room-stage`
- `result-share-card`

Style direction:

- premium mixed martial arts broadcast
- octagon-inspired cage geometry
- red and blue corner tension
- matte black arena darkness
- canvas white fight surface
- championship gold accents
- dramatic walkout light beams
- no official league, promotion, sponsor, broadcaster, venue, or fighter
  likeness rights unless licensed

## Higgsfield Setup

Use Higgsfield as an API-key-backed server integration for production
generation.

- `HIGGSFIELD_API_KEY`: stored only in the server secret manager.
- `HIGGSFIELD_API_BASE_URL`: configurable raw API base URL for the contracted
  Higgsfield API surface.
- `HIGGSFIELD_API_CREATE_PATH`: contracted raw API path for creating image or
  video generation jobs.

Do not commit API secrets or expose them to clients. The public Higgsfield docs
currently emphasize MCP/CLI account auth, so keep MCP/CLI as a fallback
generation path only when raw API access is not enabled for the account.

Fallbacks:

- MCP URL: `https://mcp.higgsfield.ai/mcp`
- CLI install: `npm install -g @higgsfield/cli`
- CLI auth: `higgsfield auth login`

Generated jobs are available through:

- `createMmaCardAssetPlan`
- `createMmaCardHiggsfieldQueue`
- `createMmaCardHiggsfieldApiRequestPlan`
- `submitMmaCardHiggsfieldJobs`
- `createMmaCardGeneratedAssetAudit`
- `generate-mma-card-standup-assets`

For local standup before Higgsfield finals are ready, generate deterministic
non-branded fixture PNG/MP4 files into the same output target paths:

```sh
node platform/ultimate-sports/scripts/generate-mma-card-standup-assets.js
```

The fixture generator skips existing files unless `--force` is passed and writes
`platform/ultimate-sports/generated-assets/mma-card/_standup-fixture-metadata.json`.
Replace these fixtures with Higgsfield-generated finals before production
prize-mode promotion.

Generate a redacted raw-API request plan before live submission:

```sh
node platform/ultimate-sports/scripts/submit-mma-card-higgsfield-jobs.js \
  --json platform/ultimate-sports/generated-reports/mma-card-higgsfield-submit-dry-run.json \
  --dry-run
```

When the contracted raw endpoint is known and the key is available only in the
backend runtime, submit jobs explicitly:

```sh
node platform/ultimate-sports/scripts/submit-mma-card-higgsfield-jobs.js \
  --json platform/ultimate-sports/generated-reports/mma-card-higgsfield-submit.json \
  --create-path "$HIGGSFIELD_API_CREATE_PATH" \
  --live
```

The submission output stores request ids, provider job ids, redacted request
metadata, and output targets. It never writes `HIGGSFIELD_API_KEY`.

After downloading generated outputs, run:

```sh
node platform/ultimate-sports/scripts/audit-mma-card-assets.js
```

Default report:

- `platform/ultimate-sports/generated-reports/mma-card-generated-assets.json`

The generated-asset audit also emits `generationHandoff`, the operator contract
for the next asset batch. It includes the provider surface, output root, env var
names, queue job count, blockers, next actions, and QA acceptance criteria. It
names `HIGGSFIELD_API_KEY` but never stores the key value.

## Required APIs

Creative generation:

- Higgsfield API for images, video loops, upscales, background removal, and
  creative iteration.
- Higgsfield MCP/CLI only as a fallback when raw API access is unavailable.

Fight data:

- SportsDataIO UFC / MMA API for bout card data, fighter metadata, event
  schedules, method results, fighter stats, and settlement evidence.
- Store the key server-side and pass it as an `Ocp-Apim-Subscription-Key`
  request header.

Odds and market context:

- The Odds API is optional until real-money mode, but useful for market context,
  odds display, and responsible-play copy.
- MMA sport key: `mma_mixed_martial_arts`.
- Store the key server-side only.

Internal services:

- Asset storage/CDN for generated originals, crops, thumbnails, attribution,
  prompts, and moderation status.
- QVAC referee attestations for host-entered fight results, disputed scorecards,
  trivia-bank review, and asset approval state.

## Production Flow

1. Build the plan with `createMmaCardAssetPlan`.
2. Review every prompt and negative prompt.
3. For preview standup, run `generate-mma-card-standup-assets.js` so the app can
   render with local non-branded fixtures.
4. Dry-run `submit-mma-card-higgsfield-jobs.js` and confirm the request count,
   output targets, and redacted headers.
5. Generate via the Higgsfield API with `--live`; use MCP/CLI only as fallback.
6. Download outputs into the listed `outputTargets`, replacing standup fixtures.
7. Run `audit-mma-card-assets.js` to confirm every expected PNG/MP4 output is
   present before visual review.
8. Run visual QA for mobile safe areas, text space, icon legibility, and rights
   guardrails.
8. Upload finals to the asset store/CDN.
9. Bind generated asset URLs to the `fight-card-shell`.
10. Attach prompt metadata and QVAC review evidence to the asset record.

## Environment Variables

Use placeholders in local config and real values only in a secret manager:

- `HIGGSFIELD_MCP_URL`
- `HIGGSFIELD_API_KEY`
- `HIGGSFIELD_API_BASE_URL`
- `HIGGSFIELD_API_CREATE_PATH`
- `SPORTSDATAIO_MMA_API_KEY`
- `ODDS_API_KEY`
- `ASSET_BUCKET`
- `ASSET_CDN_BASE_URL`

The key pasted in chat should be rotated before production use.
