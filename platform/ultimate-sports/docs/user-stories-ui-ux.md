# Ultimate Sports User Stories and UI/UX Map

This document maps the isolated `platform/ultimate-sports` catalog into user
stories and screen behavior for the post-World-Cup PearCup product. It is a
planning artifact for the v2 sports platform and is intentionally not wired into
the current PearCup app start path.

Source of truth: `src/catalog-engine.js`.

## Product Shape

The platform has four recurring jobs:

- Help a host launch the right pool, live room, card, mini-game, or wager format
  for a specific event.
- Help a player make picks quickly, understand what is locked, and challenge
  friends without reading rules text.
- Help a watch-party group create lightweight P2P moments around live action.
- Help a host or ops user resolve results, correct mistakes, and keep settlement
  evidence visible.

The primary surfaces are:

- Home: live rooms, open pools, active duels, unread results, and wallet status.
- Discover: event-fit launcher cards, tournament templates, and recommended
  stack previews.
- Creator: host setup, entrant editing, fixture creation, publish checklist,
  result workbench, and corrections.
- Pools: pool list, standings, locks, settlement receipts, and history.
- Picks: bracket builders, confidence assignment, survivor choices, prediction
  cards, bingo grids, and fantasy-lite drafts.
- Watch: room state, live markets, chat, reactions, voice, challenge tray, and
  QVAC summaries.
- Games: active P2P game sessions, reveals, spectator replays, rematches, and
  share cards.
- Wallet: demo credits, sponsor prize claims, holds, releases, receipt status,
  and readiness panels.
- Ops: event health, disputes, audit bundles, feed status, notification batches,
  and real-money readiness evidence.
- Settings: identity, invites, trust controls, limits, cooldowns, privacy, and
  room moderation preferences.

## Core Personas

Host or creator:

- As a host, I want to choose an event type and get a prebuilt tournament stack
  so I can launch a good pool without designing rules from scratch.
- As a host, I want to see compatibility warnings before publishing so I do not
  offer a broken variant or mini-game.
- As a host, I want result entry and correction tools for manual events so I can
  settle local, creator, and awards pools with confidence.

Player:

- As a player, I want one screen that shows my open picks, locked picks, active
  challenges, and expected rewards so I know what needs attention.
- As a player, I want fast mobile-first pick controls for brackets, cards,
  survivor choices, props, and drafts so I can join during a commute or watch
  party.
- As a player, I want the app to show why a result won or lost so P2P settlement
  feels fair.

Watch-party participant:

- As a participant, I want to challenge one friend or the whole room during live
  play so the watch party has constant low-friction moments.
- As a participant, I want live markets and games to use sport-specific language
  so a soccer room does not feel like a generic prediction form.
- As a participant, I want reaction, trivia, and streak games to settle quickly
  so the room can move on to the next moment.

Spectator or replay viewer:

- As a spectator, I want a compact replay and share card after a duel or pool
  result so the outcome is easy to understand and pass around.
- As a spectator, I want to see the evidence trail behind a result when there is
  a dispute so the product feels trustworthy.

Ops and trust steward:

- As ops, I want diagnostics for feed lag, peer sync, disputes, settlement holds,
  and room moderation so I can keep busy events healthy.
- As ops, I want real-money readiness to be gated by explicit evidence so demo
  and sponsor-prize modes can move fast while higher-risk flows stay controlled.

## Universal Flow

1. Discover: user picks an event-fit card such as `world-cup`,
   `march-madness`, or `awards-prediction-pools`.
2. Configure: host chooses template kind, entrants, pool variants, mini-games,
   settlement mode, lock time, invite rules, and result source.
3. Preview: launch plan shows commands, compatibility warnings, and unresolved
   setup tasks.
4. Publish: competition, pools, cards, draft slates, rooms, and games are
   created as replayable commands.
5. Join: players enter by invite, join a room, fund demo stakes if needed, and
   see open actions.
6. Pick: players submit brackets, confidence weights, survivor choices, cards,
   bingo marks, props, drafts, or side quests.
7. Watch: room participants chat, react, join live markets, issue head-to-head
   challenges, and play mini-games.
8. Resolve: official feed, host-entered result, or game reveal produces
   deterministic winners.
9. Settle: wallet, sponsor-prize, or demo receipt moves from held to completed
   only when evidence is present.
10. Review: result explanations, disputes, corrections, re-settlement commands,
    replays, rematches, and share cards keep the loop alive.

## UI Component System

Launcher card:

- Used on Discover and Creator.
- Shows event title, sport category, entrant shape, result policy, primary
  template, recommended variants, recommended games, and settlement modes.
- Primary action opens setup. Secondary actions preview stack, duplicate as
  template, or compare variants.

Tournament setup wizard:

- Steps: event type, entrants, format, pool variants, mini-games, settlement,
  room, preview.
- Dense screens are split with tabs instead of long scrollers.
- Entrant import, manual entry, and host corrections use tables with validation
  status per row.

Pick workbench:

- Bracket: fixture grid, projected path, lock badges, changed-pick summary.
- Confidence: draggable or stepper-based point assignment with duplicate
  warnings.
- Survivor: round selector, used-team strip, invalid-repeat blocking.
- Prediction card: field rows, winner selectors, totals, prop inputs, and card
  completion meter.
- Fantasy-lite draft: compact roster slots, available athletes, stat scoring
  preview.
- Bingo: fixed 3x3 grid, marked events, line count, and audit detail.

Watch room:

- Center lane: score/clock/feed state, room feed, live prompts, and challenges.
- Right lane on desktop: active participants, challenge tray, game queue, and
  wallet holds.
- Bottom sheet on mobile: live prompt, challenge accept/decline, and quick
  reactions.
- Challenge cards use icons for game type, stake mode, lock time, and target
  peer.

Results and settlement:

- Result sheet explains source, winner logic, tied users, receipt status, and
  evidence references.
- Host-entered result workbench shows missing fields, stale settlements, draft
  correction commands, and re-resolve actions.
- Dispute panels summarize claim, response, evidence, status, and next action.

## Event-Fit UX Maps

### `world-cup`: World Cup

Sport type: soccer. Entrants are teams. Results prefer official feeds.

User stories:

- As a host, I want group-stage cards plus a knockout bracket so the pool covers
  the full tournament arc.
- As a player, I want top-two, goal totals, golden boot style fields, and a
  bracket path in one pick flow.
- As a watch participant, I want penalty clash, free-kick duel, next-event,
  scoreline lock, streaks, and reaction games during live matches.
- As ops, I want feed-backed results and correction evidence for high-traffic
  match days.

UI/UX:

- Discover card emphasizes "group plus knockout", national teams, and match-day
  watch parties.
- Create flow defaults to `group-plus-knockout`, `classic-bracket`,
  `confidence`, `group-stage-card`, `upset-bounty`, and `side-quest`.
- Picks screen starts with group cards, then transitions to bracket path once
  knockout fixtures are known.
- Watch room uses soccer-specific quick prompts: goal, corner, card, shot, save,
  VAR, comeback, first scorer, and final score before minute X.
- Results screen separates group-card scoring from knockout bracket scoring so
  players can see why their rank changed.

Primary P2P hooks:

- Penalty Clash for shootout energy.
- Free-kick Duel for aim/curve/keeper-read moments.
- Scoreline Lock before a configured minute.
- Bracket Side Quest for semi-finalist or finalist scoring comparisons.

### `euros-copa-america`: Euros / Copa America

Sport type: soccer. Entrants are teams. Results prefer official feeds.

User stories:

- As a host, I want the World Cup style flow scaled down for a shorter regional
  international tournament.
- As a player, I want fast bracket picks, confidence weights, and upset bonuses
  without too many setup decisions.
- As a watch participant, I want player-prop duels and reaction challenges for
  high-profile knockout games.

UI/UX:

- Discover card positions this as "international tournament night" with fewer
  defaults than World Cup.
- Create flow defaults to bracket, confidence, group-stage card, and upset
  bounty, with side quests available as an advanced option.
- Picks screen uses compact group cards and a knockout bracket preview.
- Watch room favors scoreline lock, next event, player props, streaks, and
  reaction games.
- Settlement view highlights official match feed and tie-break rules.

Primary P2P hooks:

- Player Prop Duel for first scorer, shots, assists, and cards.
- Reaction Challenge for goals, saves, penalties, and red cards.
- Watch-party Streak for consecutive correct live predictions.

### `champions-league-knockout`: Champions League Knockout

Sport type: soccer. Entrants are clubs. Results prefer official feeds.

User stories:

- As a host, I want a pure knockout bracket that feels premium and compact.
- As a player, I want head-to-head bracket duels against friends because the
  tournament has fewer fixtures but higher stakes.
- As a watch participant, I want momentum duel prompts for pressure swings over
  the next 10 minutes.

UI/UX:

- Discover card emphasizes two-leg or single-match knockout setup depending on
  host configuration.
- Create flow defaults to `single-elimination`, `classic-bracket`,
  `confidence`, `upset-bounty`, and `head-to-head-duel`.
- Picks screen shows aggregate notes where needed and keeps the bracket dense.
- Watch room keeps the live prompt tray high priority: next event, momentum,
  free kick, penalty, and reaction.
- Results screen explains aggregate, extra time, and penalties as result notes
  when supplied by the feed.

Primary P2P hooks:

- Head-to-head Bracket Duel.
- Momentum Duel for home-pressure, away-pressure, or balanced windows.
- Free-kick Duel and Penalty Clash.

### `march-madness`: March Madness

Sport type: basketball. Entrants are teams. Results prefer official feeds.

User stories:

- As a host, I want a large single-elimination bracket with upset bonuses and
  office-pool friendly defaults.
- As a player, I want quick region-by-region picking, confidence scoring, and
  head-to-head bracket comparisons.
- As a watch participant, I want next-event, scoreline lock, trivia, player
  props, mini fantasy, and streaks during game windows.

UI/UX:

- Discover card emphasizes large bracket size, regions, seed-based upset
  scoring, and office/group sharing.
- Create flow should support import or manual seed entry, then preview bracket
  density before publishing.
- Picks screen uses region tabs, pick-progress counters, upset markers, and a
  final-four summary.
- Watch room uses basketball prompts: next basket, three, foul, rebound swing,
  timeout, lead change, player points, and final score.
- Results screen needs strong rank-change animation because a single upset can
  move many players.

Primary P2P hooks:

- Trivia Duel during halftime.
- Player Prop Duel for points, assists, rebounds, blocks, steals, and fouls.
- Peer Mini Fantasy for a match day or round slate.

### `pro-playoffs`: NBA / NHL / MLB Playoffs

Sport type: pro-sports. Entrants are teams. Results prefer official feeds.

User stories:

- As a host, I want series-based playoff templates with best-of configuration.
- As a player, I want survivor, fantasy-lite draft, confidence, and bracket
  paths that understand series length.
- As a watch participant, I want daily or match-level P2P prompts that work even
  when multiple games are live.

UI/UX:

- Discover card asks for league flavor first: NBA, NHL, MLB, or custom series.
- Create flow defaults to `series-playoff`, then asks series length and
  conference/side labels.
- Picks screen shows series winners, games count, confidence, and survivor
  availability.
- Watch room adapts prompt language by league: next run, next goal, next three,
  save, strikeout, power play, run line, or lead change.
- Results screen should show series state and clinch scenarios, not only final
  bracket winners.

Primary P2P hooks:

- Peer Mini Fantasy for each match day.
- Player Prop Duel for sport-specific stats.
- Momentum Duel for next pressure window.
- Watch-party Streak across games in the same night.

### `tennis-grand-slams`: Tennis Grand Slams

Sport type: tennis. Entrants are players. Results prefer official feeds.

User stories:

- As a host, I want quarterfinal onward brackets that are quick to launch.
- As a player, I want player-centric bracket picks and confidence scoring.
- As a watch participant, I want set/game based predictions and fast reaction
  prompts around break points and match points.

UI/UX:

- Discover card defaults to QF, SF, and Final setup but allows larger draws.
- Create flow should support player seeding, draw side, surface, and start
  round.
- Picks screen shows player names, seed, country, projected semi/final path, and
  confidence controls.
- Watch room uses tennis prompts: next game winner, next break, set score,
  tiebreak winner, ace, double fault, and match point reaction.
- Results screen explains walkovers or retirements as source notes when present.

Primary P2P hooks:

- Scoreline Lock as set score.
- Player Prop Duel for aces, double faults, breaks, or sets won.
- Reaction Challenge for break points, aces, and match point.

### `esports-major`: Valorant / LoL Worlds / CS / Dota / Rocket League

Sport type: esports. Entrants are teams. Results prefer official feeds where
available and host-entered corrections where needed.

User stories:

- As a host, I want formats that can handle groups, knockouts, and best-of
  series for different games.
- As a player, I want fantasy-lite and survivor styles that match team-based
  esports.
- As a watch participant, I want momentum, trivia, reaction, and streak games
  tuned to map wins and objective swings.

UI/UX:

- Discover card lets the host choose game flavor before setup: Valorant, LoL,
  CS, Dota, Rocket League, or custom.
- Create flow branches by template: group-plus-knockout, single-elimination, or
  series-playoff.
- Picks screen shows map/series context and avoids sport-specific language from
  traditional sports.
- Watch room uses objective prompts: next map, next round, first blood, clutch,
  ace, tower, dragon, Roshan, goal, economy swing, or overtime.
- Results screen should show map score, series score, and source reliability.

Primary P2P hooks:

- Momentum Duel for objective pressure.
- Trivia Duel for teams, maps, players, and meta knowledge.
- Reaction Challenge for clutch or objective moments.
- Side Quest for bracket/team scoring comparisons.

### `mma-boxing-fight-card`: MMA / Boxing Fight Cards

Sport type: combat-sports. Entrants are fighters. Results prefer official feeds
with host corrections for local cards.

User stories:

- As a host, I want a fight-card prediction flow instead of a bracket.
- As a player, I want confidence picks, method/round props, and head-to-head
  comparisons against friends.
- As a watch participant, I want between-fight trivia, method predictions, and
  reaction challenges around knockdowns or finishes.

UI/UX:

- Discover card shows card depth, main event, co-main, and number of bouts.
- Create flow defaults to `fight-card`, confidence, prediction card fields,
  watch-party bingo, and head-to-head duel.
- Picks screen is a bout list with fighter selector, confidence, method, round,
  and optional prop fields.
- Watch room uses combat prompts: next round winner, knockdown, takedown, finish
  method, decision, significant strike surge, and card score.
- Results screen must make corrections very clear because host-entered method or
  round values can alter payouts.

Primary P2P hooks:

- Player Prop Duel as fighter props.
- Trivia Duel between fights.
- Reaction Challenge for knockdowns, submissions, and stoppages.
- Watch-party Bingo for cards, finishes, decisions, and upsets.

### `creator-reality-brackets`: Reality / Creator Tournaments

Sport type: creator. Entrants are creators, contestants, songs, dishes, or
custom objects. Results are host-entered.

User stories:

- As a creator, I want to launch a custom bracket for cooking, music, survival,
  streamer, or fan-vote formats.
- As a player, I want the pick flow to feel like the show or creator event, not
  a sports template with renamed teams.
- As a host, I want result review, correction, and re-settlement tools because
  outcomes are manual.

UI/UX:

- Discover card emphasizes custom entrant labels and show-style templates.
- Create flow starts with naming the entrant type and result fields before
  choosing bracket or custom rounds.
- Picks screen uses creator imagery/name slots, match-up cards, confidence, and
  optional side quests.
- Watch room uses trivia, reactions, and streaks rather than official-feed
  prompts.
- Result workbench is first-class: missing fields, stale settlements,
  correction draft, and re-resolve actions are visible to the host.

Primary P2P hooks:

- Trivia Duel tied to creators, episodes, songs, dishes, or challenges.
- Reaction Challenge for reveal moments.
- Watch-party Streak for consecutive correct episode predictions.
- Bracket Side Quest for custom finalist or category totals.

### `awards-prediction-pools`: Oscars / Grammys / Eurovision

Sport type: awards. Entrants are nominees, artists, songs, or categories.
Results are host-entered.

User stories:

- As a host, I want a prediction-card flow with categories, nominees, and
  optional confidence weights.
- As a player, I want to pick winners by category, create a head-to-head duel,
  and play watch-party bingo during the broadcast.
- As a host, I want safe correction and re-resolve tools for category mistakes.

UI/UX:

- Discover card emphasizes ceremony night, category cards, and room play.
- Create flow defaults to `awards-card`, group-stage style prediction cards,
  confidence, watch-party bingo, and head-to-head duel.
- Picks screen is category-first with nominee selectors, confidence controls,
  completion status, and locked broadcast time.
- Watch room uses prompts: next category, speech length, upset, performance,
  commercial break, wardrobe moment, jury/public vote swing, or camera reaction.
- Results screen shows category rows, winning nominee, stale card resolutions,
  and correction history.

Primary P2P hooks:

- Trivia Duel for nominees, prior winners, and ceremony facts.
- Watch-party Bingo for broadcast moments.
- Head-to-head Duel across prediction cards.
- Reaction Challenge for winner reveals and performances.

### `local-leagues`: School / Office / Pub / Rec Sports

Sport type: local. Entrants are teams or custom participants. Results are
host-entered.

User stories:

- As a local organizer, I want round-robin, bracket, or custom formats without
  needing an official data feed.
- As a player, I want simple picks and watch-room games that can work for small
  crowds in person.
- As a host, I want manual result entry, corrections, and clear settlement
  evidence because trust is social.

UI/UX:

- Discover card emphasizes flexible format, manual results, and low setup.
- Create flow starts with format: round robin, single elimination, or custom,
  then supports manual entrant entry and simple invite links.
- Picks screen keeps labels editable and avoids professional-stat assumptions.
- Watch room can enable soccer-style games for pub football, trivia for office
  pools, peer mini fantasy for rec leagues, and streaks for any live event.
- Results screen prioritizes host attribution, timestamps, correction notes, and
  dispute links.

Primary P2P hooks:

- Penalty Clash and Free-kick Duel for soccer-like local events.
- Trivia Duel for office/pub participation.
- Peer Mini Fantasy for small slates.
- Momentum Duel and Player Prop Duel when manual stat entry is available.

## Sport-Type Adaptations

Soccer:

- Event fits: `world-cup`, `euros-copa-america`,
  `champions-league-knockout`.
- UI language: goals, cards, corners, shots, saves, VAR, penalties, free kicks,
  first scorer, final score, pressure window.
- Best controls: bracket path, group cards, scoreline lock, penalty clash,
  free-kick duel, momentum duel, watch-party streak.

Basketball:

- Event fit: `march-madness`.
- UI language: region, seed, upset, next basket, three, foul, rebound, assist,
  block, lead change, timeout, final score.
- Best controls: large bracket picker, region tabs, upset markers, confidence,
  player prop duel, mini fantasy, halftime trivia.

Pro sports:

- Event fit: `pro-playoffs`.
- UI language varies by league but must support series score, game count,
  clinch state, player props, and daily slates.
- Best controls: series bracket, survivor, fantasy-lite draft, player props,
  momentum duel, watch-party streak.

Tennis:

- Event fit: `tennis-grand-slams`.
- UI language: player seed, draw side, sets, games, tiebreak, break point,
  match point, aces, double faults.
- Best controls: start-round selector, player bracket, set score lock, player
  props, reaction challenge.

Esports:

- Event fit: `esports-major`.
- UI language: maps, rounds, objectives, first blood, clutch, economy, overtime,
  series score, meta trivia.
- Best controls: format selector, map/series cards, momentum duel, trivia,
  reaction challenge, side quests.

Combat sports:

- Event fit: `mma-boxing-fight-card`.
- UI language: bout, fighter, round, method, knockdown, takedown, submission,
  stoppage, decision, scorecard.
- Best controls: bout list, method/round props, confidence, watch-party bingo,
  head-to-head card duel.

Creator and reality:

- Event fit: `creator-reality-brackets`.
- UI language must be host-defined: contestant, creator, dish, song, challenge,
  episode, category, fan vote, reveal.
- Best controls: custom labels, custom rounds, creator assets, manual result
  workbench, trivia, reactions, side quests.

Awards:

- Event fit: `awards-prediction-pools`.
- UI language: category, nominee, winner, performance, jury vote, public vote,
  speech, upset.
- Best controls: category card, confidence, bingo, head-to-head card duel,
  manual result review.

Local:

- Event fit: `local-leagues`.
- UI language is host-defined and should default to simple team/player labels.
- Best controls: entrant table, invite links, manual results, flexible templates,
  trivia, peer mini fantasy, simple prop entry.

## Variant-Specific Stories and UX

Classic bracket (`classic-bracket`):

- Player story: I can fill the tournament path quickly and revise until lock.
- UX: fixture grid, path summary, changed-pick badge, locked fixture state.

Confidence scoring (`confidence`):

- Player story: I can assign more points to stronger picks and see duplicate
  point errors before submitting.
- UX: point steppers, drag ranking, duplicate warnings, total confidence meter.

Survivor pool (`survivor`):

- Player story: I can pick one team per round and never accidentally reuse a
  prior pick.
- UX: round tabs, used-pick strip, blocked repeats, active/eliminated badge.

Upset bounty (`upset-bounty`):

- Player story: I can see which underdogs carry bonus value without doing math.
- UX: seed/odds badge, bonus chip, projected upside summary.

Head-to-head bracket duel (`head-to-head-duel`):

- Player story: I can challenge one friend and compare only our two brackets or
  cards.
- UX: target peer selector, challenge preview, accept/decline sheet, duel
  standings.

Group-stage or prediction card (`group-stage-card`):

- Player story: I can answer top-two, totals, props, categories, or fight-card
  fields in one compact card.
- UX: field rows, completion meter, validation state, lock banner.

Fantasy-lite draft (`fantasy-lite-draft`):

- Player story: I can draft a tiny roster for a match day or slate and score
  from real outcomes.
- UX: roster slots, athlete list, scoring preview, duplicate prevention.

Watch-party bingo (`watch-party-bingo`):

- Player story: I can mark broadcast moments and see lines complete during the
  event.
- UX: fixed 3x3 grid, event chips, line counter, result evidence sheet.

Bracket side quest (`side-quest`):

- Player story: I can create a small bet like "my semi-finalists score more"
  without changing the main bracket pool.
- UX: side-quest builder, entrant picker, comparison rule, mini leaderboard.

## Mini-Game and Live-Wager UX

Penalty Clash (`penalty-clash`):

- Controls: aim lane, power, keeper read, reveal state, shot-by-shot scoreboard.

Free-kick Duel (`free-kick-duel`):

- Controls: aim, curve, wall read, keeper read, replay result, rematch action.

Trivia Duel (`trivia-duel`):

- Controls: question card, answer choices, timer, correctness, response-time
  tie break, QVAC trivia-bank provenance.

Next Event (`next-event`):

- Controls: event chips such as goal, corner, card, shot, save, next basket,
  next map, knockdown, category upset, and custom host labels.

Scoreline Lock (`scoreline-lock`):

- Controls: score inputs, lock-before minute or phase, exact-score payout,
  result-class fallback where configured.

Momentum Duel (`momentum-duel`):

- Controls: side selector, window length, pressure evidence, balanced threshold,
  result explanation.

Player Prop Duel (`player-prop-duel`):

- Controls: prop type, player selector, target stat, tolerance, first-scorer or
  stat-total result view.

Reaction Challenge (`reaction-challenge`):

- Controls: moment feed, tap capture, latency window, fastest valid tap winner,
  tie handling.

Watch-party Streak (`watch-party-streak`):

- Controls: consecutive prompt rail, current streak, miss reset, room leaderboard.

Peer Mini Fantasy (`peer-mini-fantasy`):

- Controls: roster slots, three-athlete default, slate filter, stat scoring
  summary, draft lock.

## Acceptance Criteria For Future UI Build

- Every event-fit card in Discover links to a setup flow with compatible default
  variants and mini-games.
- Every mapped event fit has at least one player pick story, one host story, one
  watch-room story, and one result or settlement story.
- Manual-result event fits expose review, correction, stale-settlement, and
  re-resolve affordances.
- Official-feed event fits show source status and correction notes where
  supplied.
- P2P challenge flows support peer-game, live-prediction, head-to-head bracket,
  and side-quest challenges.
- Demo and sponsor-prize settlement can be shown in Wallet without exposing
  real-money payout movement.
- Real-money readiness remains an ops/compliance gate, not a default consumer
  action.
- Mobile watch rooms keep the active live prompt and accept/decline challenge
  sheet reachable without leaving video/chat context.
