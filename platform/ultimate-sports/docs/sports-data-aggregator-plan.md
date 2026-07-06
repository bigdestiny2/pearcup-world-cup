# Sports Data Aggregator Plan

This is the implementation companion for
`src/sports-data-aggregator-engine.js`. The goal is a PearCup-owned aggregator:
one backend service that combines the best available APIs, normalizes records,
and exposes one settlement-aware data contract to pools, cards, mini-games,
watch rooms, and QVAC.

## Source Stack

Primary and specialist sources:

- `sportradar-official`: mainstream official sports backbone for soccer,
  basketball, pro playoffs, tennis, and general live sports.
- `sportsdataio-mma`: UFC/MMA fight-card primary source when the card is
  covered by contract.
- `pandascore-esports`: esports match/tournament primary source for Valorant,
  League of Legends, Counter-Strike, and Dota-style coverage.
- `abios-esports`: esports breadth, Rocket League hedge, live stats, and odds
  supplement.
- `sailgp-partner-feed`: official or partner SailGP data if licensed.
- `the-odds-api-context`: odds and market context only.
- `official-web-evidence`: public result page, screenshot, and broadcast-note
  evidence when no API exists.
- `social-web-evidence`: verified social posts, search results, news snippets,
  and public links used as QVAC-reviewed corroboration for combat cards and
  other niche events without settlement-grade APIs.
- `host-evidence-qvac`: manual result and correction lane for every sport.
- `stats-perform-opta`: premium evaluation source for deeper soccer/media
  data, not required for MVP aggregation.

## Normalized Records

The aggregator converts every source payload into one normalized envelope:

- `competition`
- `season`
- `event`
- `fixture`
- `participant`
- `standing`
- `result`
- `live-event`
- `stat-line`
- `odds-market`
- `telemetry`
- `evidence`

Every normalized record carries:

- source ID and provider ID
- external ID
- competition ID and optional fixture ID
- participant IDs
- occurred/status fields
- raw payload hash
- source URL or feed-frame evidence when available
- settlement tier: source-of-truth, trusted-secondary, context-only, or
  evidence-review

## Fit Routes

| Fit | Primary source | Supplements | Context | Fallback |
| --- | --- | --- | --- | --- |
| `world-cup` | `sportradar-official` | `sportsdataio-global`, `stats-perform-opta` | `the-odds-api-context` | `host-evidence-qvac` |
| `euros-copa-america` | `sportradar-official` | `sportsdataio-global`, `stats-perform-opta` | `the-odds-api-context` | `host-evidence-qvac` |
| `champions-league-knockout` | `sportradar-official` | `sportsdataio-global`, `stats-perform-opta` | `the-odds-api-context` | `host-evidence-qvac` |
| `march-madness` | `sportradar-official` | `sportsdataio-global`, `stats-perform-opta` | `the-odds-api-context` | `host-evidence-qvac` |
| `pro-playoffs` | `sportradar-official` | `sportsdataio-global`, `stats-perform-opta` | `the-odds-api-context` | `host-evidence-qvac` |
| `tennis-grand-slams` | `sportradar-official` | `sportsdataio-global`, `stats-perform-opta` | `the-odds-api-context` | `host-evidence-qvac` |
| `esports-major` | `pandascore-esports` | `abios-esports` | none by default | `host-evidence-qvac` |
| `mma-boxing-fight-card` | `sportsdataio-mma` when covered, otherwise `host-evidence-qvac` | `sportradar-official`, `official-web-evidence`, `social-web-evidence` | `the-odds-api-context` | `official-web-evidence`, `social-web-evidence`, `host-evidence-qvac` |
| `sailgp-companion` | `sailgp-partner-feed` | none | `the-odds-api-context` | `host-evidence-qvac`, `official-web-evidence` |
| `creator-reality-brackets` | `host-evidence-qvac` | `official-web-evidence` | none | none |
| `awards-prediction-pools` | `host-evidence-qvac` | `official-web-evidence` | none | none |
| `local-leagues` | `host-evidence-qvac` | `sportsdataio-global`, `official-web-evidence` | none | none |

Esports title overrides:

- Valorant, League of Legends, Counter-Strike, and Dota route to
  `pandascore-esports`.
- Rocket League routes to `abios-esports` first, then `pandascore-esports` as
  secondary if available.

## Trust Model

Source-of-truth:

- Can auto-settle result records for official-feed fits.
- Requires backend health check and source payload hash.

Trusted-secondary:

- Corroborates or fills non-settlement stats.
- Does not override source-of-truth result records without QVAC review.

Context-only:

- Used for odds display, responsible-play copy, and upset context.
- Never settles a result.

Evidence-review:

- Requires QVAC review before prize-mode settlement.
- Always stores host, timestamp, source URL, screenshot, or signed data packet.
- For combat cards without a covered API, QVAC result evidence needs
  corroborating official web, verified social, or web-search evidence before
  settlement can proceed.

Each route exposes its settlement path in `route.settlement`:

- `auto-source-with-qvac-correction`: a source-of-truth API can settle result
  records, with QVAC kept as a correction or dispute overlay.
- `qvac-result-evidence`: no settlement-grade API is assumed, so prize
  settlement waits for a QVAC `result-evidence` review.
- `unsupported`: neither an official source nor a QVAC evidence lane is wired;
  this should remain a standup-audit blocker.

The `resultEvidenceContract` field records the QVAC lane, accepted evidence
sources, minimum corroborating source count, and whether verified social/search
evidence can be used. This is the contract for creator brackets, awards pools,
local leagues, SailGP fallbacks, and no-API combat cards.

## Ingestion Pipeline

1. Authenticate server side.
2. Fetch API payload or receive partner/manual evidence.
3. Normalize into the aggregator envelope.
4. Dedupe and map external IDs to PearCup competition, fixture, entrant, and
   participant IDs.
5. Score trust by source tier.
6. Publish feed frames, result snapshots, or QVAC evidence packets.
7. Let settlement decide auto-settle, wait for corroboration, or require QVAC.

## Server-side Client Layer

`src/sports-data-client-engine.js` is the first executable backend client layer
behind these routes. It does not expose credentials to the browser; it creates
redacted request plans, reports missing env per source, and can execute HTTP
requests only through an injected server-side `fetchImpl`.

Current client coverage:

- `sportradar-official`: query-key HTTP request builder.
- `sportsdataio-mma`: `Ocp-Apim-Subscription-Key` request builder.
- `sportsdataio-global`: league/global SportsDataIO request builder.
- `pandascore-esports`: bearer-token request builder.
- `abios-esports`: OAuth/client-credential request builder.
- `the-odds-api-context`: query-key odds/context request builder.
- `sailgp-partner-feed`: partner-feed bearer request builder.
- `stats-perform-opta`: evaluation request builder.
- `official-web-evidence` and `host-evidence-qvac`: local evidence/QVAC lanes.
- `social-web-evidence`: local evidence/QVAC lane for social and web-search
  result corroboration.

Credential readiness is intentionally separate from route coverage. A source
can have a request builder while still reporting missing env or missing partner
contract access.

## Smoke Checks

`src/sports-data-smoke-engine.js` turns the client matrix into a repeatable
provider smoke workflow:

- `createSportsDataSmokePlan(input)` creates a redacted no-network plan showing
  which checks are ready, missing env, missing params, OAuth-token blocked, or
  local-only.
- `createSportsDataSmokePlan({ standupFixtures: true })` marks API-backed
  checks fixture-ready so local standup can exercise every route without
  provider credentials.
- `runSportsDataSmokeChecks(input)` can execute live provider calls only from a
  backend context with a supplied `fetchImpl` or Node `fetch`, or pass every
  route in fixture mode with `standupFixtures: true`.
- `scripts/sports-data-smoke.js` writes
  `platform/ultimate-sports/generated-reports/sports-data-smoke.json`.

The smoke report stores provider response status, duration, payload shape, and
item count. In fixture mode it stores `passed-fixture` results and normalized
record hashes; in live mode it stores `passed-live` results. It does not store
API keys or raw provider payloads.

Each smoke check also carries operator-facing readiness fields:

- `nextAction`: the exact provider, OAuth, or local-lane step needed next.
- `expectedEvidence`: what proof the check is expected to produce.
- `acceptanceCriteria`: pass conditions for treating the source as usable.
- `readinessChecklist`: redacted env/param/request-builder status, with
  sensitive items flagged but never populated with values.

## Environment Variables

Required for the active route stack:

- `SPORTRADAR_API_KEY`
- `SPORTRADAR_PRODUCT_CONFIG`
- `SPORTSDATAIO_MMA_API_KEY`
- `SPORTSDATAIO_GLOBAL_API_KEY`
- `PANDASCORE_TOKEN`
- `ABIOS_CLIENT_ID`
- `ABIOS_CLIENT_SECRET`
- `SAILGP_PARTNER_FEED_KEY`
- `SAILGP_PARTNER_FEED_BASE_URL`
- `ODDS_API_KEY`

Evaluation only:

- `STATSPERFORM_API_KEY`

No provider secret should ever be sent to a client or stored in the repo.

## Public Helpers

- `createSportsDataAggregatorPlan()`
- `aggregatorRouteForFit(fitIdOrInput)`
- `normalizeSportsDataRecord(input)`
- `createSportsDataAggregatorHealthPlan(input)`
- `createSportsDataClientPlan(input)`
- `sourceClientFor(sourceId)`
- `credentialReadinessForSource(sourceId, env)`
- `createSportsDataRequestPlan(input)`
- `executeSportsDataRequest(input)`
- `createSportsDataSmokePlan(input)`
- `runSportsDataSmokeChecks(input)`

These helpers are exposed through `src/platform.js` so the future UI, worker
bridge, and API server can read the same routing contract.

## Source Notes

- Sportradar developer docs: `https://developer.sportradar.com/`
  - Current docs list soccer, NBA, NFL, MLB, NHL, tennis, MMA, racing, and many
    general sports APIs, and explicitly say B2B APIs should not be called
    directly from client applications. That matches the server-only aggregator.
- SportsDataIO MMA API docs: `https://sportsdata.io/developers/api-documentation/mma`
  - Current docs list UFC/MMA alongside NFL, MLB, NBA, NHL, soccer, tennis, F1,
    and global products. MMA endpoints use HTTP GET and can accept
    `Ocp-Apim-Subscription-Key`.
- Social/web result evidence:
  - No provider API is assumed. Store source URLs, snippets/screenshots, capture
    time, claimed winner, method, and round, then route through QVAC
    `result-evidence` review before prize settlement.
- PandaScore developer docs: `https://developers.pandascore.co/docs/introduction`
  - Current docs cover real-time esports statistics, fixtures/historical/live
    data, and explicit pages for Dota 2, League of Legends, Counter-Strike, and
    Valorant.
- Abios esports data API: `https://abiosgaming.com/esports-data-api/`
  - Current public material positions Abios as one integration for major
    esports titles with match calendars, results, bracket information, match
    scores, team statistics, live data, and odds products.
- The Odds API sports and v4 docs:
  `https://the-odds-api.com/sports-odds-data/sports-apis.html` and
  `https://the-odds-api.com/liveapi/guides/v4/`
  - Current docs list broad in-season sports, including soccer competitions,
    NBA/NCAAB/NHL/MLB, MMA, boxing, and tennis, plus v4 sports/events/odds/scores
    endpoints. This remains context-only for settlement.
- SailGP official site: `https://sailgp.com/`
  - No stable public developer API is assumed. Treat SailGP as an official or
    partner feed integration plus `official-web-evidence` and QVAC fallback.
- Stats Perform Opta: `https://www.statsperform.com/opta/`
  - Current public material emphasizes Opta live data, deep metrics, predictions,
    and 20+ sports/3,900+ competitions. Keep it as premium evaluation rather
    than required MVP coverage.
