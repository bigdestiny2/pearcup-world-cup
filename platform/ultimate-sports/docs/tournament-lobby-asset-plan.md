# Tournament Lobby, Custom GUI, and Asset Generation Plan

This plan turns the sports catalog into a game-lobby style experience. The user
does not start from a generic app dashboard. They start from a tournament lobby:
maybe no tournament is live, maybe one is live, maybe several are live across
different sports. Selecting a tournament server loads that tournament's custom
GUI, API plan, mini-games, competition format, bracket/pool controls, and asset
pack.

Source of truth:

- Catalog and compatibility: `src/catalog-engine.js`
- Lobby and GUI registry: `src/tournament-experience-engine.js`
- Surface models: `src/surface-engine.js`
- User stories: `docs/user-stories-ui-ux.md`

## Product Mental Model

The tournament lobby behaves like a server browser.

- Empty state: no live tournament servers. The lobby shows catalog servers for
  World Cup, March Madness, awards, local leagues, and the other mapped event
  fits. The primary actions are browse catalog and create tournament.
- Active state: one or more tournament servers are live. The lobby prioritizes
  active servers, shows sport/category filters, and lets the user jump into the
  selected tournament shell.
- Mixed state: active servers exist, but the user has selected a catalog
  template to preview or create a new event.

Each server card has:

- Tournament title and event fit.
- Sport category, entrant shape, result policy, and primary template kind.
- Active player count, room count, and status when live.
- Recommended pool count and mini-game count when shown as a catalog template.
- Server skin and label from the tournament experience registry.

Selecting a server loads a tournament experience bundle:

- `server`: lobby identity, status, badges, skin, and routing key.
- `gui`: shell ID, layout mode, surface bindings, and custom panels.
- `apiPlan`: result source mode, adapters, topics, and fallback behavior.
- `competition`: template kinds, bracket style, pool variants, and setup panels.
- `miniGameDock`: enabled mini-games, live prompt language, and placement.
- `assetPack`: required generated or licensed assets for the tournament shell.
- `management`: route, cache namespace, personalization scopes, and registry key.

## UX Management Architecture

The UX should be managed in layers:

1. Catalog layer: defines event fits, sports categories, templates, variants,
   mini-games, settlement modes, and compatibility.
2. Tournament instance layer: represents a live or scheduled event server with a
   tournament ID, selected fit ID, status, player count, room count, and title.
3. Experience registry layer: maps each fit ID to its custom GUI shell, API
   adapters, live prompt lexicon, asset pack, and setup panels.
4. Surface layer: renders shared surfaces such as Picks, Pools, Watch, Games,
   Wallet, Ops, and Settings using the selected experience bundle.
5. Asset layer: binds generated art, licensed marks, host uploads, and icon sets
   to the selected GUI shell.
6. Personalization layer: lets users reorder rooms, favorite teams, adjust
   themes, and remember selected servers without changing core rules.

This gives us custom-feeling tournament UIs without forking the whole app for
each sport. The shell changes, but the data contracts stay stable.

## Asset Generation Pipeline

Generated assets should be treated as themed interface material, not as official
rights-bearing content.

Pipeline:

1. Select fit profile from `tournament-experience-engine`.
2. Generate a style board from the profile tone, palette, server skin, and GUI
   shell.
3. Generate required pack assets:
   - `lobby-icon`
   - `server-card-cover`
   - `hero-backdrop`
   - `bracket-board-skin`
   - `pool-card-accent`
   - `mini-game-icon-set`
   - `watch-room-stage`
   - `result-share-card`
   - `empty-state-illustration`
4. Run review against mobile safe areas, text contrast, crop resilience, and
   non-overlap.
5. Bind assets to the selected GUI shell.
6. Cache the pack by fit ID and tournament ID.
7. Allow host overrides for local, creator, awards, and custom events.

Rights policy:

- Generated assets: backgrounds, mood art, generic icons, UI accents, empty
  states, and share-card art.
- Licensed or user-provided assets: official team logos, player photos, league
  marks, trophy marks, broadcaster marks, sponsor marks, and creator likenesses.
- Host uploads: local league logos, creator photos, entrant images, and event
  posters. These must retain attribution and moderation state.

Quality gates:

- Hero and watch-room art must survive 16:9, 4:3, and 9:16 crops.
- Lobby icons must work at small sizes and in one-color mode.
- Share cards must reserve space for winner, score, tournament title, and
  evidence badge.
- Mini-game icon sets must have consistent silhouettes across all games enabled
  in the selected tournament.
- Assets must not include official logos unless the asset source marks them as
  licensed or user-provided.

## Tournament GUI Bundles

### `world-cup`

- Lobby skin: stadium flags.
- GUI shell: soccer group-plus-knockout shell.
- APIs: fixtures, score clock, group table, knockout bracket, player stats,
  result feed.
- Competition: group cards into knockout bracket.
- Pools: classic bracket, confidence, group-stage card, upset bounty, side
  quest.
- Mini-games: penalty clash, free-kick duel, next event, scoreline lock,
  watch-party streak, reaction challenge.
- Asset direction: global festival, bright stadium lights, national color
  accents.

### `euros-copa-america`

- Lobby skin: continental flags.
- GUI shell: regional soccer cup shell.
- APIs: fixtures, score clock, group table, knockout bracket, player stats,
  result feed.
- Competition: compact group-plus-knockout.
- Pools: classic bracket, confidence, group-stage card, upset bounty.
- Mini-games: penalty clash, next event, scoreline lock, player prop duel,
  watch-party streak, reaction challenge.
- Asset direction: summer tournament, flags, clean broadcast match cards.

### `champions-league-knockout`

- Lobby skin: floodlit club night.
- GUI shell: premium soccer knockout shell.
- APIs: fixtures, score clock, aggregate score, knockout bracket, result feed.
- Competition: single-elimination knockout.
- Pools: classic bracket, confidence, upset bounty, head-to-head duel.
- Mini-games: penalty clash, free-kick duel, next event, momentum duel,
  watch-party streak, reaction challenge.
- Asset direction: premium night match, floodlights, club-neutral geometry.

### `march-madness`

- Lobby skin: arena regions.
- GUI shell: large basketball bracket shell.
- APIs: fixtures, score clock, seed lines, team stats, player stats, result
  feed.
- Competition: seeded region bracket.
- Pools: classic bracket, confidence, upset bounty, head-to-head duel.
- Mini-games: next event, scoreline lock, trivia duel, peer mini fantasy,
  player prop duel, watch-party streak, reaction challenge.
- Asset direction: college arena energy, hardwood, region colors, upset
  callouts.

### `pro-playoffs`

- Lobby skin: series scoreboard.
- GUI shell: series playoff shell.
- APIs: fixtures, score clock, series state, team stats, player stats, result
  feed.
- Competition: best-of series.
- Pools: classic bracket, confidence, survivor, fantasy-lite draft.
- Mini-games: next event, scoreline lock, player prop duel, peer mini fantasy,
  watch-party streak, reaction challenge, momentum duel.
- Asset direction: pro broadcast desk, series grids, daily slate cards.

### `tennis-grand-slams`

- Lobby skin: court draw.
- GUI shell: tennis draw shell.
- APIs: fixtures, score clock, set score, player stats, draw feed, result feed.
- Competition: draw from selected round.
- Pools: classic bracket, confidence, head-to-head duel, fantasy-lite draft.
- Mini-games: next event, scoreline lock, player prop duel, reaction challenge,
  watch-party streak.
- Asset direction: sunlit court, crisp draw board, seed and country accents.

### `esports-major`

- Lobby skin: neon arena.
- GUI shell: esports series shell.
- APIs: fixtures, series state, map score, objective events, player stats,
  result feed.
- Competition: groups, knockout, or best-of series.
- Pools: classic bracket, confidence, survivor, fantasy-lite draft, side quest.
- Mini-games: next event, momentum duel, trivia duel, reaction challenge,
  watch-party streak.
- Asset direction: neon stage, tactical maps, objective timers, team-neutral
  esports UI.

### `mma-boxing-fight-card`

- Lobby skin: arena card.
- GUI shell: fight-card shell.
- APIs: bout card, round clock, method result, fighter stats, judges score,
  result feed.
- Competition: fight card.
- Pools: confidence, player prop, watch-party bingo, head-to-head duel.
- Mini-games: player prop duel, next event, trivia duel, reaction challenge,
  watch-party streak, momentum duel.
- Asset direction: fight-night walkout, neutral gloves, round cards, strong
  contrast.

### `creator-reality-brackets`

- Lobby skin: creator stage.
- GUI shell: creator custom event shell.
- APIs: manual fixtures, host results, corrections, evidence upload, room
  events.
- Competition: custom bracket, creator-custom, or episode-style rounds.
- Pools: classic bracket, confidence, watch-party bingo, side quest.
- Mini-games: trivia duel, reaction challenge, watch-party streak.
- Asset direction: creator stage, customizable slots, episode reveal energy.

### `awards-prediction-pools`

- Lobby skin: ceremony card.
- GUI shell: awards card shell.
- APIs: category list, nominee list, host results, corrections, broadcast
  events.
- Competition: awards-card prediction categories.
- Pools: group-stage card, confidence, watch-party bingo, head-to-head duel.
- Mini-games: trivia duel, watch-party streak, reaction challenge.
- Asset direction: ceremony stage, category cards, elegant broadcast moments.

### `local-leagues`

- Lobby skin: community scoreboard.
- GUI shell: local flex league shell.
- APIs: manual fixtures, host results, corrections, simple stats, room events.
- Competition: round robin, bracket, or custom.
- Pools: classic bracket, confidence, survivor, watch-party bingo, side quest.
- Mini-games: penalty clash, free-kick duel, trivia duel, next event, peer mini
  fantasy, watch-party streak, reaction challenge, momentum duel, player prop
  duel.
- Asset direction: community scoreboard, editable labels, friendly match cards.

## Implementation Contract

The future UI should use these product-facing methods:

- `createTournamentLobby({ activeTournaments, selectedTournamentId,
  selectedFitId })`
- `createTournamentExperience({ fitId, tournamentId, title, status })`
- `createAssetGenerationPlan({ fitId })`

The app shell should not hard-code tournament screens. It should:

1. Render the lobby from `createTournamentLobby`.
2. Route selected server cards to `selectedExperience.management.route`.
3. Load `selectedExperience.gui.shellId`.
4. Bind surface modules from `selectedExperience.gui.surfaceBindings`.
5. Show pools from `selectedExperience.competition.poolVariants`.
6. Show mini-games from `selectedExperience.miniGameDock.gameTypes`.
7. Configure API clients from `selectedExperience.apiPlan.adapters`.
8. Load generated or licensed art from `selectedExperience.assetPack`.

## Acceptance Criteria

- The lobby can represent no active tournaments without hiding the catalog.
- The lobby can represent multiple active tournaments across different sports.
- A selected tournament returns a custom GUI shell and not only a generic
  Discover card.
- Every mapped fit has API adapters, mini-games, pool variants, competition
  format, and asset pack requirements.
- The asset plan distinguishes generated interface art from licensed or
  user-provided official assets.
- The future UI can add a new event fit by updating the catalog and the
  tournament experience registry, then proving coverage in tests.
