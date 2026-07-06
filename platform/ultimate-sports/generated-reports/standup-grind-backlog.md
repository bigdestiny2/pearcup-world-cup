# Ultimate Sports Grind Backlog

Generated: 2026-07-04T14:00:43.291Z
Audit status: product-standup-ready
Coverage: 100%
Tickets: 19
Blocked: 10
Ready: 9

This backlog is derived from `grindList` and `grindMatrix` in `standup-audit.json`. It is the operator-facing punch list for standing up the ultimate sports app.

## Provider Credentials And Live Smoke

- Priority: P0
- Status: blocked
- Tickets: 8
- Summary: 0/8 API checks ready; 3 local lanes ready.
- Command: `node platform/ultimate-sports/scripts/sports-data-smoke.js`

### US-GRIND-001: Sportradar official sports APIs client

- Owner lane: backend-data
- Priority: P0
- Status: blocked
- Source: `sportradar-official`
- Required env/config: `SPORTRADAR_API_KEY`, `SPORTRADAR_PRODUCT_CONFIG`
- Blockers: `missing-env`
- Next action: Set backend-only env for sportradar-official: SPORTRADAR_API_KEY, SPORTRADAR_PRODUCT_CONFIG.
- Expected evidence: HTTP 2xx response from source-of-truth provider sample endpoint
- Command: `node platform/ultimate-sports/scripts/sports-data-smoke.js`
- Acceptance:
  - Required provider credentials are present only in the backend runtime.
  - The smoke check returns passed-live with an HTTP 2xx provider response.
  - The redacted smoke report stores status, duration, payload shape, and item count without credential values.

### US-GRIND-002: SportsDataIO UFC / MMA client

- Owner lane: backend-data
- Priority: P0
- Status: blocked
- Source: `sportsdataio-mma`
- Required env/config: `SPORTSDATAIO_MMA_API_KEY`
- Blockers: `missing-env`
- Next action: Set backend-only env for sportsdataio-mma: SPORTSDATAIO_MMA_API_KEY.
- Expected evidence: HTTP 2xx response from source-of-truth provider sample endpoint
- Command: `node platform/ultimate-sports/scripts/sports-data-smoke.js`
- Acceptance:
  - Required provider credentials are present only in the backend runtime.
  - The smoke check returns passed-live with an HTTP 2xx provider response.
  - The redacted smoke report stores status, duration, payload shape, and item count without credential values.

### US-GRIND-003: SportsDataIO league/global client

- Owner lane: backend-data
- Priority: P0
- Status: blocked
- Source: `sportsdataio-global`
- Required env/config: `SPORTSDATAIO_GLOBAL_API_KEY`
- Blockers: `missing-env`
- Next action: Set backend-only env for sportsdataio-global: SPORTSDATAIO_GLOBAL_API_KEY.
- Expected evidence: HTTP 2xx response from trusted secondary provider sample endpoint
- Command: `node platform/ultimate-sports/scripts/sports-data-smoke.js`
- Acceptance:
  - Required provider credentials are present only in the backend runtime.
  - The smoke check returns passed-live with an HTTP 2xx provider response.
  - The redacted smoke report stores status, duration, payload shape, and item count without credential values.

### US-GRIND-004: PandaScore esports client

- Owner lane: backend-data
- Priority: P0
- Status: blocked
- Source: `pandascore-esports`
- Required env/config: `PANDASCORE_TOKEN`
- Blockers: `missing-env`
- Next action: Set backend-only env for pandascore-esports: PANDASCORE_TOKEN.
- Expected evidence: HTTP 2xx response from source-of-truth provider sample endpoint
- Command: `node platform/ultimate-sports/scripts/sports-data-smoke.js`
- Acceptance:
  - Required provider credentials are present only in the backend runtime.
  - The smoke check returns passed-live with an HTTP 2xx provider response.
  - The redacted smoke report stores status, duration, payload shape, and item count without credential values.

### US-GRIND-005: Abios esports data client

- Owner lane: backend-data
- Priority: P0
- Status: blocked
- Source: `abios-esports`
- Required env/config: `ABIOS_CLIENT_ID`, `ABIOS_CLIENT_SECRET`
- Blockers: `missing-env`
- Next action: Set backend-only env for abios-esports: ABIOS_CLIENT_ID, ABIOS_CLIENT_SECRET.
- Expected evidence: HTTP 2xx response from trusted secondary provider sample endpoint
- Command: `node platform/ultimate-sports/scripts/sports-data-smoke.js`
- Acceptance:
  - Required provider credentials are present only in the backend runtime.
  - The smoke check returns passed-live with an HTTP 2xx provider response.
  - The redacted smoke report stores status, duration, payload shape, and item count without credential values.

### US-GRIND-006: The Odds API context client

- Owner lane: backend-data
- Priority: P0
- Status: blocked
- Source: `the-odds-api-context`
- Required env/config: `ODDS_API_KEY`
- Blockers: `missing-env`
- Next action: Set backend-only env for the-odds-api-context: ODDS_API_KEY.
- Expected evidence: HTTP 2xx response from context provider sample endpoint
- Command: `node platform/ultimate-sports/scripts/sports-data-smoke.js`
- Acceptance:
  - Required provider credentials are present only in the backend runtime.
  - The smoke check returns passed-live with an HTTP 2xx provider response.
  - The redacted smoke report stores status, duration, payload shape, and item count without credential values.

### US-GRIND-007: SailGP partner-feed client

- Owner lane: backend-data
- Priority: P0
- Status: blocked
- Source: `sailgp-partner-feed`
- Required env/config: `SAILGP_PARTNER_FEED_KEY`, `SAILGP_PARTNER_FEED_BASE_URL`
- Blockers: `missing-env`
- Next action: Set backend-only env for sailgp-partner-feed: SAILGP_PARTNER_FEED_KEY, SAILGP_PARTNER_FEED_BASE_URL.
- Expected evidence: HTTP 2xx response from source-of-truth provider sample endpoint
- Command: `node platform/ultimate-sports/scripts/sports-data-smoke.js`
- Acceptance:
  - Required provider credentials are present only in the backend runtime.
  - The smoke check returns passed-live with an HTTP 2xx provider response.
  - The redacted smoke report stores status, duration, payload shape, and item count without credential values.

### US-GRIND-008: Stats Perform / Opta evaluation client

- Owner lane: backend-data
- Priority: P0
- Status: blocked
- Source: `stats-perform-opta`
- Required env/config: `STATSPERFORM_API_KEY`, `STATSPERFORM_BASE_URL`
- Blockers: `missing-env`
- Next action: Set backend-only env for stats-perform-opta: STATSPERFORM_API_KEY, STATSPERFORM_BASE_URL.
- Expected evidence: HTTP 2xx response from trusted secondary provider sample endpoint
- Command: `node platform/ultimate-sports/scripts/sports-data-smoke.js`
- Acceptance:
  - Required provider credentials are present only in the backend runtime.
  - The smoke check returns passed-live with an HTTP 2xx provider response.
  - The redacted smoke report stores status, duration, payload shape, and item count without credential values.

## SailGP And Premium Data Access

- Priority: P1
- Status: blocked
- Tickets: 2
- Summary: SailGP has a partner-feed route plus official web/QVAC fallback; Stats Perform remains an explicit licensing decision.
- Command: `node platform/ultimate-sports/scripts/sports-data-smoke.js --source sailgp-partner-feed`

### US-GRIND-009: Secure SailGP official or partner feed

- Owner lane: partnerships-and-licensing
- Priority: P1
- Status: blocked
- Source: `sailgp-partner-feed`
- Required env/config: `SAILGP_PARTNER_FEED_KEY`, `SAILGP_PARTNER_FEED_BASE_URL`
- Blockers: `missing-env`
- Next action: Set backend-only env for sailgp-partner-feed: SAILGP_PARTNER_FEED_KEY, SAILGP_PARTNER_FEED_BASE_URL.
- Expected evidence: HTTP 2xx response from source-of-truth provider sample endpoint
- Command: `node platform/ultimate-sports/scripts/sports-data-smoke.js --source sailgp-partner-feed`
- Acceptance:
  - SailGP partner or official feed credentials are present only in the backend runtime.
  - The SailGP smoke check returns passed-live against a schedule or event endpoint.
  - Fallback official web/QVAC evidence remains active for disputes or partner-feed outages.

### US-GRIND-010: Decide whether Stats Perform / Opta is worth licensing

- Owner lane: partnerships-and-licensing
- Priority: P1
- Status: blocked
- Source: `stats-perform-opta`
- Required env/config: `STATSPERFORM_API_KEY`, `STATSPERFORM_BASE_URL`
- Blockers: `missing-env`
- Next action: Set backend-only env for stats-perform-opta: STATSPERFORM_API_KEY, STATSPERFORM_BASE_URL.
- Expected evidence: HTTP 2xx response from trusted secondary provider sample endpoint
- Command: `node platform/ultimate-sports/scripts/sports-data-smoke.js --source stats-perform-opta`
- Acceptance:
  - Decision is recorded as licensed, deferred, or rejected for MVP.
  - If licensed, the smoke check returns passed-live from the backend.
  - If deferred or rejected, aggregator routes continue to work through Sportradar/SportsDataIO/QVAC.

## Combat Generated Assets

- Priority: P1
- Status: ready-for-qa
- Tickets: 9
- Summary: 30/30 generated asset outputs present; 13 Higgsfield jobs in the handoff.
- Command: `node platform/ultimate-sports/scripts/audit-mma-card-assets.js`

### US-GRIND-011: Fight Card Lobby Icon

- Owner lane: creative-ops
- Priority: P1
- Status: ready
- Asset type: `lobby-icon`
- Next action: Run visual QA, rights review, crop review, and attach QVAC/human review evidence.
- Expected evidence: Generated PNG/MP4 output files plus prompt metadata and visual QA evidence.
- Command: `node platform/ultimate-sports/scripts/audit-mma-card-assets.js`
- Acceptance:
  - Every required PNG and MP4 output target exists and is non-empty.
  - No official promotion logos, sponsor marks, broadcaster marks, venue marks, or real fighter likenesses are present.
  - Mobile crops preserve UI title, button, and card safe areas.
  - QVAC or human review evidence is attached before prize-mode promotion.

### US-GRIND-012: Fight Card Server Cover

- Owner lane: creative-ops
- Priority: P1
- Status: ready
- Asset type: `server-card-cover`
- Next action: Run visual QA, rights review, crop review, and attach QVAC/human review evidence.
- Expected evidence: Generated PNG/MP4 output files plus prompt metadata and visual QA evidence.
- Command: `node platform/ultimate-sports/scripts/audit-mma-card-assets.js`
- Acceptance:
  - Every required PNG and MP4 output target exists and is non-empty.
  - No official promotion logos, sponsor marks, broadcaster marks, venue marks, or real fighter likenesses are present.
  - Mobile crops preserve UI title, button, and card safe areas.
  - QVAC or human review evidence is attached before prize-mode promotion.

### US-GRIND-013: Fight Night Hero Backdrop

- Owner lane: creative-ops
- Priority: P1
- Status: ready
- Asset type: `hero-backdrop`
- Next action: Run visual QA, rights review, crop review, and attach QVAC/human review evidence.
- Expected evidence: Generated PNG/MP4 output files plus prompt metadata and visual QA evidence.
- Command: `node platform/ultimate-sports/scripts/audit-mma-card-assets.js`
- Acceptance:
  - Every required PNG and MP4 output target exists and is non-empty.
  - No official promotion logos, sponsor marks, broadcaster marks, venue marks, or real fighter likenesses are present.
  - Mobile crops preserve UI title, button, and card safe areas.
  - QVAC or human review evidence is attached before prize-mode promotion.

### US-GRIND-014: Bout List Board Skin

- Owner lane: creative-ops
- Priority: P1
- Status: ready
- Asset type: `bracket-board-skin`
- Next action: Run visual QA, rights review, crop review, and attach QVAC/human review evidence.
- Expected evidence: Generated PNG/MP4 output files plus prompt metadata and visual QA evidence.
- Command: `node platform/ultimate-sports/scripts/audit-mma-card-assets.js`
- Acceptance:
  - Every required PNG and MP4 output target exists and is non-empty.
  - No official promotion logos, sponsor marks, broadcaster marks, venue marks, or real fighter likenesses are present.
  - Mobile crops preserve UI title, button, and card safe areas.
  - QVAC or human review evidence is attached before prize-mode promotion.

### US-GRIND-015: Fight Pool Card Accent

- Owner lane: creative-ops
- Priority: P1
- Status: ready
- Asset type: `pool-card-accent`
- Next action: Run visual QA, rights review, crop review, and attach QVAC/human review evidence.
- Expected evidence: Generated PNG/MP4 output files plus prompt metadata and visual QA evidence.
- Command: `node platform/ultimate-sports/scripts/audit-mma-card-assets.js`
- Acceptance:
  - Every required PNG and MP4 output target exists and is non-empty.
  - No official promotion logos, sponsor marks, broadcaster marks, venue marks, or real fighter likenesses are present.
  - Mobile crops preserve UI title, button, and card safe areas.
  - QVAC or human review evidence is attached before prize-mode promotion.

### US-GRIND-016: Fight Mini-game Icon Set

- Owner lane: creative-ops
- Priority: P1
- Status: ready
- Asset type: `mini-game-icon-set`
- Next action: Run visual QA, rights review, crop review, and attach QVAC/human review evidence.
- Expected evidence: Generated PNG/MP4 output files plus prompt metadata and visual QA evidence.
- Command: `node platform/ultimate-sports/scripts/audit-mma-card-assets.js`
- Acceptance:
  - Every required PNG and MP4 output target exists and is non-empty.
  - No official promotion logos, sponsor marks, broadcaster marks, venue marks, or real fighter likenesses are present.
  - Mobile crops preserve UI title, button, and card safe areas.
  - QVAC or human review evidence is attached before prize-mode promotion.

### US-GRIND-017: Watch Room Fight Stage

- Owner lane: creative-ops
- Priority: P1
- Status: ready
- Asset type: `watch-room-stage`
- Next action: Run visual QA, rights review, crop review, and attach QVAC/human review evidence.
- Expected evidence: Generated PNG/MP4 output files plus prompt metadata and visual QA evidence.
- Command: `node platform/ultimate-sports/scripts/audit-mma-card-assets.js`
- Acceptance:
  - Every required PNG and MP4 output target exists and is non-empty.
  - No official promotion logos, sponsor marks, broadcaster marks, venue marks, or real fighter likenesses are present.
  - Mobile crops preserve UI title, button, and card safe areas.
  - QVAC or human review evidence is attached before prize-mode promotion.

### US-GRIND-018: Fight Result Share Card

- Owner lane: creative-ops
- Priority: P1
- Status: ready
- Asset type: `result-share-card`
- Next action: Run visual QA, rights review, crop review, and attach QVAC/human review evidence.
- Expected evidence: Generated PNG/MP4 output files plus prompt metadata and visual QA evidence.
- Command: `node platform/ultimate-sports/scripts/audit-mma-card-assets.js`
- Acceptance:
  - Every required PNG and MP4 output target exists and is non-empty.
  - No official promotion logos, sponsor marks, broadcaster marks, venue marks, or real fighter likenesses are present.
  - Mobile crops preserve UI title, button, and card safe areas.
  - QVAC or human review evidence is attached before prize-mode promotion.

### US-GRIND-019: Empty Fight Arena Illustration

- Owner lane: creative-ops
- Priority: P1
- Status: ready
- Asset type: `empty-state-illustration`
- Next action: Run visual QA, rights review, crop review, and attach QVAC/human review evidence.
- Expected evidence: Generated PNG/MP4 output files plus prompt metadata and visual QA evidence.
- Command: `node platform/ultimate-sports/scripts/audit-mma-card-assets.js`
- Acceptance:
  - Every required PNG and MP4 output target exists and is non-empty.
  - No official promotion logos, sponsor marks, broadcaster marks, venue marks, or real fighter likenesses are present.
  - Mobile crops preserve UI title, button, and card safe areas.
  - QVAC or human review evidence is attached before prize-mode promotion.

