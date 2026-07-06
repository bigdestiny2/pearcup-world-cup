# Sports Data Provider Plan

This is the provider decision companion for
`src/sports-data-provider-engine.js`. It keeps PearCup v2 honest about which
feeds can settle results automatically, which feeds add context, and which
events must remain host-entered with QVAC-reviewed evidence.

## Recommendation

Use Sportradar as the primary contracted official-sports feed for mainstream
sport coverage, then add specialists:

- SportsDataIO for covered UFC/MMA cards and a pragmatic US-sports supplement.
- PandaScore plus Abios for esports. PandaScore is the clean primary for
  Valorant, League of Legends, Counter-Strike, and Dota-style match data; Abios
  adds broader title/odds coverage and is our Rocket League hedge.
- SailGP official or partner feed for race schedules, results, standings, and
  telemetry when we can license it.
- The Odds API as optional odds and market context, not the settlement source
  of truth.
- Host evidence plus QVAC for awards, creator tournaments, local leagues,
  manual corrections, combat cards without a covered API, and any SailGP data
  gap.

No single public provider cleanly covers mainstream sports, combat sports,
esports, awards, creator events, local leagues, and SailGP with
settlement-grade data.

## Provider Stack

Sportradar:

- Role: primary official sports feed.
- Best fit: World Cup, Euros / Copa America, Champions League knockout,
  March Madness, NBA/NHL/MLB playoffs, Tennis Grand Slams.
- Strengths: broad sports catalog, league-specific and general sport APIs, odds
  and media products, B2B delivery.
- Env shape: `SPORTRADAR_API_KEY`, sport-specific product config.

SportsDataIO:

- Role: MMA and US-sports supplement.
- Best fit: UFC/MMA cards when covered, plus fallback coverage for US sports,
  soccer, tennis, and global products when contract terms fit better.
- Strengths: UFC/MMA API docs, HTTP GET endpoints, `Ocp-Apim-Subscription-Key`
  header support.
- Gap: boxing, kickboxing, ONE-style cards, bareknuckle, and regional combat
  promotions must be checked per contract; if not covered, use QVAC result
  evidence from official web, social, and search sources.
- Env shape: `SPORTSDATAIO_MMA_API_KEY`, optional per-sport keys.

PandaScore or equivalent esports specialist:

- Role: esports specialist.
- Best fit: Valorant / LoL Worlds / CS / Dota.
- Strengths: esports matches, teams, tournaments, historical stats, and live
  game data where available.
- Env shape: `PANDASCORE_TOKEN`.

Abios:

- Role: esports breadth and odds supplement.
- Best fit: esports majors, especially title coverage gaps and Rocket League
  style events.
- Strengths: major-title match calendars, results, live stats, normalized data,
  and esports odds products.
- Env shape: `ABIOS_CLIENT_ID`, `ABIOS_CLIENT_SECRET`.

SailGP official or partner feed:

- Role: sailing specialist.
- Best fit: SailGP Companion.
- Strengths: official race calendar, event results, standings, and telemetry if
  licensed.
- Gap: no stable public developer API is assumed for MVP, so the companion must
  support partner-feed snapshots or host-entered evidence.
- Env shape: `SAILGP_PARTNER_FEED_KEY`, `SAILGP_PARTNER_FEED_BASE_URL`.

The Odds API:

- Role: odds context.
- Best fit: market context, pre-match/live odds display, responsible-play copy,
  upset signals, and optional MMA odds.
- Gap: odds are not enough to settle official results.
- Env shape: `ODDS_API_KEY`.

Host evidence + QVAC:

- Role: manual and niche fallback.
- Best fit: creator events, awards, local leagues, manual corrections, and
  SailGP when no licensed feed is available, plus combat cards without a
  settlement-grade API.
- Strengths: source links, screenshots, signed host result entries, correction
  history, and prize-mode review.
- Env shape: local platform attestation only.

## Fit Mapping

| Fit | Primary | Supplements | Settlement source |
| --- | --- | --- | --- |
| `world-cup` | Sportradar | SportsDataIO, The Odds API | Official feed with host correction overlay |
| `euros-copa-america` | Sportradar | SportsDataIO, The Odds API | Official feed with host correction overlay |
| `champions-league-knockout` | Sportradar | SportsDataIO, The Odds API | Official feed with host correction overlay |
| `march-madness` | Sportradar | SportsDataIO, The Odds API | Official feed with host correction overlay |
| `pro-playoffs` | Sportradar | SportsDataIO, The Odds API | Official feed with host correction overlay |
| `tennis-grand-slams` | Sportradar | SportsDataIO, The Odds API | Official feed with host correction overlay |
| `esports-major` | PandaScore | Abios, Sportradar, QVAC | Esports specialist feed with QVAC fallback |
| `mma-boxing-fight-card` | SportsDataIO when covered, otherwise QVAC | The Odds API, Sportradar, official web/social evidence | Combat-card API when available; otherwise QVAC-reviewed result evidence |
| `sailgp-companion` | SailGP official or partner feed | QVAC, The Odds API if markets exist | Hybrid partner feed or QVAC evidence |
| `creator-reality-brackets` | QVAC | Host uploads | Host-entered evidence |
| `awards-prediction-pools` | QVAC | Host uploads | Host-entered evidence |
| `local-leagues` | QVAC | SportsDataIO if the league is covered | Host-entered evidence |

## Integration Rules

- Server only: never call paid sports APIs or Higgsfield generation APIs from a
  client.
- Store provider keys in a server secret manager. The repo only names env vars.
- Build provider requests through `createSportsDataRequestPlan(input)` so
  headers and query auth are redacted by default.
- Treat `createSportsDataClientPlan(input)` readiness as a backend smoke input,
  not as proof that contracts or quotas are active.
- Treat odds as context until the legal/compliance gate explicitly approves a
  market use.
- Prize settlement must record provider, timestamp, source URL or payload hash,
  and any host correction event.
- When data is unavailable, uncovered by API, or disputed, route to QVAC
  evidence review before final prize-mode settlement.

## Client Helpers

The provider decision matrix is paired with `src/sports-data-client-engine.js`:

- `createSportsDataClientPlan(input)` returns the source/client matrix,
  operation coverage, required env, missing env, and redacted request examples.
- `sourceClientFor(sourceId)` returns a single source client definition.
- `credentialReadinessForSource(sourceId, env)` reports whether required env
  names are present without returning secret values.
- `createSportsDataRequestPlan(input)` creates a server-only request plan for a
  fit/source/entity type.
- `executeSportsDataRequest(input)` executes a request through an injected
  backend fetch function and can normalize the response payload.

Provider credentials and contracts are verified with
`src/sports-data-smoke-engine.js`:

- `createSportsDataSmokePlan(input)` reports ready, missing-env, missing-param,
  OAuth-token, and local evidence lanes without network calls.
- `runSportsDataSmokeChecks({ standupFixtures: true })` passes every route
  locally with deterministic provider fixtures and normalized record hashes.
- `runSportsDataSmokeChecks(input)` without fixture mode executes live sample
  calls only in backend contexts and returns redacted status/payload-shape
  summaries.
- `npm run smoke:sports-data` writes the all-passed standup fixture report.
- `npm run smoke:sports-data:live` fails until required backend provider
  credentials and contracts are present.
- `node platform/ultimate-sports/scripts/sports-data-smoke.js` is the underlying
  script used by both commands.

Abios currently needs either an `ABIOS_ACCESS_TOKEN` or a token-exchange adapter
before live smoke calls, even when `ABIOS_CLIENT_ID` and
`ABIOS_CLIENT_SECRET` are present.

## Source Notes

- Sportradar developer docs: `https://developer.sportradar.com/`
  - Current docs list league-specific and general sport APIs across soccer,
    NBA, NFL, MLB, NHL, basketball, tennis, racing, MMA, and more. They also
    state Sportradar's APIs are B2B and not for direct client calls, so this is
    a contracted backend feed only.
- SportsDataIO MMA API docs: `https://sportsdata.io/developers/api-documentation/mma`
  - Current docs list UFC/MMA API documentation, broader league APIs, global API
    options, and `Ocp-Apim-Subscription-Key` request header support. This makes
    SportsDataIO the clean MMA card candidate.
- PandaScore developer docs: `https://developers.pandascore.co/docs/introduction`
  - Current docs describe fixtures, historical data, and live API coverage for
    major esports titles, with explicit docs for Dota 2, League of Legends,
    Counter-Strike, and Valorant.
- Abios esports data API: `https://abiosgaming.com/esports-data-api/`
  - Current public material highlights major-title esports data, match
    calendars/results, bracket information, live stats, normalized data, and
    esports odds products. Use it as the second esports pillar and Rocket League
    hedge.
- The Odds API sports and v4 docs:
  `https://the-odds-api.com/sports-odds-data/sports-apis.html` and
  `https://the-odds-api.com/liveapi/guides/v4/`
  - Current docs list broad sports and v4 sports/events/odds/scores endpoints,
    including soccer, NBA/NCAAB/NHL/MLB, MMA, boxing, and tennis. Keep it as
    market context, not result settlement.
- SailGP official site: `https://sailgp.com/`
  - No stable public developer API is assumed for production settlement. The
    companion should be built around a licensed official/partner feed, signed
    data drops, or QVAC-reviewed official web evidence.
- Stats Perform Opta: `https://www.statsperform.com/opta/`
  - Current public material positions Opta as premium live/deep sports data
    across 20+ sports and 3,900+ competitions. Evaluate it for premium soccer
    and media depth after the MVP provider stack is contracted.
