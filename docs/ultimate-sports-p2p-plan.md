# Ultimate Sports P2P App Plan

Date: 2026-07-02
Status: End-to-end delivery plan for the post-World-Cup PearCup expansion

## 1. North Star

Turn PearCup from a World Cup bracket product into a peer-first social prediction
platform for sports, esports, live events, creator tournaments, and local leagues.

The product should feel like a live sports bar, bracket office pool, arcade, and
settlement engine in one app:

1. Users discover a tournament, match, fight card, awards show, or local event.
2. They join or create a pool with clear rules.
3. They submit picks, draft athletes, or accept a live P2P challenge.
4. They watch together in peer rooms with chat, voice, reactions, stats, and QVAC
   commentary.
5. Outcomes are resolved from replayable event logs and official result snapshots.
6. Winners receive demo points, sponsor prizes, reputation, badges, or real-money
   payouts only when all compliance gates are live-ready.

The durable advantage is not any single bracket format. It is the reusable engine:
event templates, peer rooms, signed picks, deterministic scoring, mini-game sync,
and trusted settlement receipts.

## 2. Existing Foundation

The current repo already has the right skeleton:

- `design/kawaii-app/` is the canonical Pear app and should remain the active UI
  worktree.
- `app/` contains hardened logic that can be ported into the canonical build:
  deterministic game resolution, worker simulation, receipt creation, QVAC
  referee paths, Tether WDK gates, storage simulation, and transport simulation.
- `docs/pearcup-full-technical-spec.md` already defines the World Cup version of
  profile, bracket, watch room, Penalty Clash, QVAC, WDK, and worker boundaries.
- The architecture already treats prize movement as worker-owned, replayable,
  and gated. That should be preserved for every new pool type.

This plan builds on that foundation instead of replacing it.

## 3. Product Pillars

### 3.1 Pools

Pools are rule-bound prediction contests. They can be casual, sponsor-prize, or
real-money.

Core surfaces:

- Classic brackets
- Confidence brackets
- Survivor pools
- Upset bounties
- Head-to-head bracket duels
- Group-stage pick cards
- Fantasy-lite drafts
- Watch-party bingo
- Live prop streaks

### 3.2 Watch Rooms

Watch rooms turn passive pools into live social play.

Core surfaces:

- Match or event room
- Pick board by side, finalist, player, artist, nominee, or outcome
- Chat, reactions, voice state, host controls
- Live stats, clock, and event feed
- QVAC commentary and summaries
- Quick challenge tray for live mini-games

### 3.3 Mini P2P Games

Mini-games are fast, peer-synced contests that can attach to a live event or run
standalone.

The anchor remains Penalty Clash because it proves deterministic P2P game
settlement with clear replay evidence. The platform should then add more games
through a shared session contract.

### 3.4 Creator And Local Events

The app should support events without official global data:

- School tournaments
- Office pools
- Pub leagues
- Rec sports
- Streamer brackets
- Reality-show prediction nights
- Awards and Eurovision-style pools

This makes the app useful year-round even when no major sports tournament is
active.

### 3.5 Settlement Modes

Every contest must declare its mode:

- `demo`: points, trophies, badges, and fake credits.
- `sponsor-prize`: non-cash prizes or externally fulfilled rewards.
- `real-money`: regulated mode gated by KYC, age, region, responsible-play,
  terms, QVAC verification, WDK readiness, and payout recipient readiness.

Real-money is a mode, not the product identity.

## 4. Best-Fit Event Matrix

| Event type | Best formats | Priority | Notes |
| --- | --- | --- | --- |
| World Cup, Euros, Copa America | Classic bracket, confidence, group-stage cards, survivor, live props, Penalty Clash | V0 | Natural successor to current product. |
| Champions League knockout | Classic bracket, head-to-head duels, upset bounty, scoreline lock | V0 | Works with knockout templates and club identities. |
| March Madness | Classic bracket, confidence, upset bounty, survivor | V1 | Huge bracket use case, but needs 64-team scale and regional UI. |
| NBA, NHL, MLB playoffs | Series bracket, confidence, player props, fantasy-lite draft | V1 | Requires best-of series template, not single-match bracket only. |
| Tennis Grand Slams | Quarterfinal bracket, player draft, survivor, prop cards | V1 | Singles and doubles can reuse entrant-based templates. |
| Esports: Valorant, LoL Worlds, CS, Dota, Rocket League | Group cards, knockout bracket, maps/round props, trivia duel | V1 | Great fit for creator/watch-party distribution. |
| MMA and boxing fight cards | Pick card, method/round props, confidence, head-to-head duels | V1 | Not a bracket first; better as event-card predictions. |
| Reality and creator tournaments | Bracket, pick card, bingo, social duels | V2 | Needs creator tooling and flexible result entry. |
| Oscars, Grammys, Eurovision | Pick card, confidence, bingo, head-to-head | V2 | Not sports, but the prediction engine generalizes cleanly. |
| Local leagues | Bracket, round robin, pick cards, manual results, sponsor prizes | V2 | Needs admin/creator result tools and abuse controls. |

## 5. Event Template System

The main architectural move is to replace hardcoded World Cup assumptions with
event templates.

```ts
type EventTemplateKind =
  | 'single-elimination'
  | 'double-elimination'
  | 'group-plus-knockout'
  | 'series-playoff'
  | 'round-robin'
  | 'fight-card'
  | 'awards-card'
  | 'draft-slate'
  | 'bingo-card'
  | 'creator-custom'

type CompetitionTemplate = {
  templateId: string
  kind: EventTemplateKind
  sportOrCategory: string
  stages: StageTemplate[]
  entrantShape: 'team' | 'player' | 'pair' | 'nominee' | 'creator' | 'custom'
  supportsLiveRooms: boolean
  supportsOfficialFeed: boolean
  supportedPoolVariants: string[]
  supportedMiniGames: string[]
  resultPolicy: 'official-feed' | 'host-entered' | 'hybrid'
}
```

Template requirements:

- Every template defines entrants, stages, fixtures, lock times, result fields,
  and settlement rules.
- Every pool references an immutable `rulesVersion`.
- Every result snapshot is replayable and source-labeled.
- Every scoring engine is deterministic from locked entries and result snapshots.

## 6. Pool Variants

### 6.1 Classic Bracket Pick'em

Best for:

- Soccer knockouts
- March Madness
- Esports playoffs
- Tennis quarterfinals onward
- Creator tournaments

Scoring:

- Round weights by depth, configurable per rules version.
- Optional perfect-bracket jackpot.
- Ties split, use tiebreakers, or roll over based on pool config.

MVP scope:

- Generalize current bracket engine from World Cup only to `single-elimination`.
- Support 4, 8, 16, 32, and 64 entrant brackets.
- Keep current receipt and settlement path.

### 6.2 Confidence Scoring

Best for:

- March Madness
- Fight cards
- Awards pools
- Group-stage predictions

Scoring:

- User assigns confidence points or ranks picks.
- Correct picks earn assigned confidence value.
- Incorrect picks earn zero or negative points depending on rules.

Implementation:

- Add `PredictionCardEntry.confidence`.
- Validate unique confidence values when rules require rank uniqueness.
- Show confidence budget before submission.

### 6.3 Survivor Pools

Best for:

- Weekly leagues
- Group stages
- Playoff rounds
- Tennis slates

Scoring:

- User picks one team/player per round.
- If the pick wins, user survives.
- No repeat picks unless rules allow reset.
- Last surviving user wins, or remaining survivors split.

Implementation:

- Add `usedEntrantIds` to scoring state.
- Add scheduled round locks.
- Add elimination state to leaderboard.

### 6.4 Upset Bounty

Best for:

- March Madness
- Domestic cups
- Esports underdogs
- Fight cards

Scoring:

- Correct underdog picks earn bonus points.
- Underdog can be defined by seed, rank, market odds, Elo, or host-entered
  rating.

Implementation:

- Store `entrantRank`, `seed`, or `preEventRating`.
- Add bonus formula to rules version.
- Make the bounty visible on the pick card before lock.

### 6.5 Head-To-Head Bracket Duel

Best for:

- Friends
- Watch rooms
- Creator challenges
- Low-friction viral sharing

Scoring:

- Two users submit brackets or pick cards.
- Winner is higher score under the shared rule set.
- Can be demo, sponsor, or real-money gated.

Implementation:

- Reuse pool engine with `maxEntries: 2`.
- Add challenge invite flow and rematch.
- Support side quests such as "my semi-finalists score more than yours."

### 6.6 Group-Stage Pick Cards

Best for:

- World Cup and Euros group stages
- Champions League league phase
- Esports groups

Pick fields:

- Top two qualifiers
- Group winner
- Goal totals
- Clean sheets
- Golden boot candidate
- Most assists
- Red cards
- Tiebreaker totals

Implementation:

- Build generic `PredictionCard` schema.
- Cards can include single choice, ordered choice, numeric total, range, and
  free-text answer types.
- Scoring is field-by-field with rules-defined weights.

### 6.7 Fantasy-Lite Draft

Best for:

- One match
- One matchday
- Tennis late rounds
- NBA/NHL/MLB playoff slate
- Esports map day

Scoring:

- Users draft teams or players.
- Points come from real outcomes: goals, assists, saves, cards, kills, maps won,
  fantasy points, or host-defined stats.

Implementation:

- Add draft lobby and snake/auction/free-pick modes.
- Add stat adapter by sport.
- Keep it smaller than full fantasy: 3 to 6 picks, one slate, fast settlement.

### 6.8 Watch-Party Bingo

Best for:

- Casual rooms
- Awards shows
- Eurovision
- Reality shows
- Soccer watch parties

Cells:

- Goal
- Corner
- Card
- Save
- VAR check
- Comeback
- Commentator phrase
- Celebrity reaction
- Technical pause

Implementation:

- Bingo card generated from event template.
- Live room events mark cells.
- Host-entered and feed-entered events both supported.
- Prize mode should start demo-only because manual result entry is abuse-prone.

## 7. Mini P2P Wagers And Games

All mini-games should share a common session contract:

```ts
type PeerGameSession = {
  gameId: string
  gameType: string
  roomId: string | null
  players: string[]
  spectators: string[]
  topicHash: string
  stakeMode: 'none' | 'demo' | 'sponsor-prize' | 'real-money'
  resolverVersion: string
  status: 'invited' | 'active' | 'resolving' | 'settled' | 'cancelled' | 'disputed'
}
```

### 7.1 Penalty Clash

Role:

- Anchor game and proof that P2P deterministic settlement works.

Next upgrades:

- Room challenges
- Spectator replay
- Ranked demo ladder
- Bracket tournament mode
- Cosmetic rewards
- Optional prize mode after compliance

### 7.2 Free-Kick Duel

Concept:

- Shooter chooses aim, curve, power, and run-up timing.
- Defender chooses keeper read and wall jump/lean.
- Resolver determines goal, save, wall block, post, or miss.

Why it fits:

- Same deterministic commit/reveal architecture as Penalty Clash.
- Adds skill expression without continuous physics sync.

Priority:

- V1 after Penalty Clash is stable.

### 7.3 Trivia Duel During Halftime

Concept:

- Two players answer live sports/event trivia.
- Faster correct answers score more.
- QVAC can generate demo questions from event facts, but prize mode needs a
  verified question bank.

Anti-cheat:

- Fixed answer windows.
- Signed question ids.
- Reveal answers after both users submit or timer expires.

Priority:

- V1 because it works across sports, esports, awards, and creator events.

### 7.4 Next Event Prediction

Concept:

- Predict the next live event: goal, corner, card, shot, save, substitution,
  round win, map objective, award winner, or performance outcome.

Scoring:

- Correct exact event earns full points.
- Correct category or side earns partial points.
- Lock closes immediately after submission or at a short countdown.

Priority:

- V0/V1 because it turns watch rooms into active play.

### 7.5 Scoreline Lock

Concept:

- Predict final score before minute X, period X, map X, or fight start.

Rules:

- Exact score wins.
- Optional nearest-score fallback.
- Lock time comes from template.

Priority:

- V1.

### 7.6 Momentum Duel

Concept:

- Two users pick who wins the next 10 minutes of pressure.
- Result derived from shots, xG, corners, possession, territory, or sport-specific
  pressure metrics.

Risk:

- Requires reliable stat feeds and transparent formula.

Priority:

- V2 unless the feed quality is excellent.

### 7.7 Player Prop Duel

Concept:

- First scorer, shots, assists, cards, saves, kills, map MVP, or round winner.

Rules:

- Uses prediction cards with live lock and feed-backed results.
- Some props are regulated betting-like surfaces, so default to demo and sponsor.

Priority:

- V1 for demo, later for prize mode.

### 7.8 Reaction Challenge

Concept:

- Users tap fastest when a goal, save, reveal, knockout, winner announcement, or
  hype moment happens.

Anti-cheat:

- Use room event timestamp plus local latency estimate.
- Demo-only at first. It is too latency-sensitive for prize settlement until the
  trust model is stronger.

Priority:

- V2.

### 7.9 Bracket Side Quest

Concept:

- Micro-challenges attached to existing entries:
  "I beat you if my semi-finalists score more", "my upset picks outscore yours",
  or "my finalist lasts longer."

Implementation:

- Side quests reference existing locked entries.
- Settlement is deterministic from the same official result snapshot.

Priority:

- V1 because it reuses bracket data and creates social sharing.

### 7.10 Watch-Party Streak

Concept:

- Consecutive correct live predictions inside a room.

Rules:

- Streak ends on incorrect pick or missed lock.
- Room leaderboard resets by match, day, or tournament.

Priority:

- V1.

### 7.11 Peer Mini Fantasy

Concept:

- Each player drafts 3 athletes for one match, day, or slate.
- Fast scoring, no season-long roster management.

Priority:

- V1/V2 depending on sports data feed readiness.

## 8. Information Architecture

Post-World-Cup navigation should evolve from the current five-view app into:

- Home: live now, upcoming rooms, your pools, active duels, notifications.
- Discover: tournaments, sports, creator events, local leagues, awards.
- Pools: pool lobby, create pool, entries, leaderboards, settlement receipts.
- Picks: brackets, prediction cards, survivor entries, drafts, bingo cards.
- Watch: live room, stream/visualizer, pick board, chat, voice, QVAC, live games.
- Games: Penalty Clash, Free-Kick Duel, Trivia Duel, active challenges, rankings.
- Creator: create tournament, define entrants, choose template, enter results.
- Wallet/Rewards: demo credits, sponsor prizes, receipts, payout readiness.
- Settings: identity, region, privacy, moderation, devices, terms.

The first screen should remain an active product surface, not a landing page.

## 9. Core User Flows

### 9.1 Join A Major Tournament Pool

1. User opens Discover.
2. Picks a tournament such as Champions League Knockout.
3. Chooses a pool variant: classic bracket, confidence, upset bounty, or duel.
4. Reviews rules, lock time, mode, and prize treatment.
5. Submits signed picks.
6. Joins match rooms as fixtures go live.
7. Watches leaderboard update from official result snapshots.
8. Receives settlement receipt if the pool pays out.

### 9.2 Start A Watch-Room Duel

1. User enters a live match room.
2. Opens quick challenge tray.
3. Chooses Penalty Clash, next event, trivia, scoreline lock, or side quest.
4. Opponent accepts.
5. Worker creates a signed game session and P2P topic.
6. Inputs are committed, revealed, resolved, and replayed.
7. Result appears in room chat and player profiles.

### 9.3 Create A Local League Pool

1. Host creates a competition from `creator-custom`, `single-elimination`, or
   `round-robin`.
2. Host adds teams, players, fixtures, and lock times.
3. Host chooses pool variants and scoring rules.
4. Participants join by invite code or topic.
5. Results are host-entered with audit trail.
6. Pool settles in demo or sponsor-prize mode by default.

### 9.4 Run An Awards Pool

1. Host selects `awards-card`.
2. Adds categories and nominees.
3. Participants assign picks and optional confidence.
4. Watch room opens during the show.
5. Bingo and live reactions run during the event.
6. Results are host-entered or feed-backed.
7. Leaderboard settles from category results.

## 10. Technical Architecture

### 10.1 Engine Split

The platform should be organized around engines:

- `competition-engine`: templates, entrants, fixtures, stages, lock windows.
- `prediction-engine`: brackets, cards, survivor picks, drafts, bingo entries.
- `scoring-engine`: deterministic scoring and tie resolution by rules version.
- `room-engine`: membership, chat, voice state, stream rights, reactions.
- `game-engine`: P2P mini-game sessions, commit/reveal, state hashes, replay.
- `feed-engine`: official sports/event adapters and source-signed snapshots.
- `settlement-engine`: QVAC attestation, WDK preparation, receipts, disputes.
- `creator-engine`: manual event creation, result entry, host permissions.

The renderer can be lively and polished, but these engines should remain
worker-owned for any state that affects scores, prizes, reputation, or receipts.

### 10.2 Data Model

Core entities:

```ts
type Competition = {
  competitionId: string
  templateId: string
  title: string
  category: 'sports' | 'esports' | 'awards' | 'creator' | 'local'
  organizerId: string | null
  status: 'draft' | 'open' | 'live' | 'completed' | 'cancelled'
  entrantIds: string[]
  fixtureIds: string[]
  resultPolicy: 'official-feed' | 'host-entered' | 'hybrid'
}

type PoolRules = {
  rulesVersion: string
  variant: string
  scoringVersion: string
  lockPolicy: string
  tiePolicy: 'split' | 'tiebreaker' | 'rollover' | 'host-review'
  payoutPolicy: 'none' | 'demo' | 'sponsor-prize' | 'real-money'
  riskClass: 'casual' | 'prize' | 'regulated'
}

type PredictionEntry = {
  entryId: string
  poolId: string
  userId: string
  entryType: 'bracket' | 'card' | 'survivor' | 'draft' | 'bingo'
  picks: unknown
  submittedAt: string
  lockedAt: string | null
  status: 'draft' | 'submitted' | 'locked' | 'eliminated' | 'scored' | 'settled'
}
```

### 10.3 Event Log Model

Add generic events while keeping current specific events as compatibility
aliases where useful:

- `CompetitionCreated`
- `CompetitionTemplateSelected`
- `EntrantAdded`
- `FixtureScheduled`
- `PoolCreated`
- `PoolRulesPublished`
- `PredictionDraftUpdated`
- `PredictionEntrySubmitted`
- `PredictionEntryLocked`
- `OfficialResultSnapshotRecorded`
- `HostResultSnapshotRecorded`
- `PoolScoreboardComputed`
- `PoolSettlementResolved`
- `PeerGameSessionStarted`
- `PeerGameInputCommitted`
- `PeerGameInputRevealed`
- `PeerGameResolved`
- `WatchPredictionSubmitted`
- `WatchPredictionResolved`
- `SettlementReceiptCreated`

All prize-relevant events must remain signed, replayable, and dependency-checked
before peer merge accepts them.

### 10.4 P2P Topics

Generalize topic names:

```txt
pearcup:v2:lobby
pearcup:v2:competition:{competitionId}
pearcup:v2:pool:{poolId}
pearcup:v2:room:{eventId}
pearcup:v2:game:{gameId}
pearcup:v2:feed:{competitionId}
pearcup:v2:creator:{organizerId}
```

Keep v1 topics for World Cup compatibility until migration is complete.

### 10.5 Result Sources

The app needs three result classes:

- Official feed: source-signed sports/event provider data.
- Host-entered: creator/local events with host signature and visible audit trail.
- Hybrid: official feed plus host corrections or stat overrides.

Prize eligibility should depend on source class:

- Official feed can support demo, sponsor, and real-money.
- Host-entered should start demo and sponsor only.
- Hybrid requires clear override rules and probably no real-money until reviewed.

### 10.6 QVAC Roles

QVAC should be used in four separate lanes:

- Commentary: summarize live rooms, generate multilingual broadcast-style text.
- Referee: verify deterministic game and pool evidence before settlement.
- Assistant: help creators build templates, bingo cards, trivia, and pick cards.
- Moderation helper: classify spam, abuse, and risky content for host review.

QVAC must not invent official results. Any commentary or settlement output must
reference replayed source events.

### 10.7 WDK And Compliance Roles

WDK remains behind the worker and settlement service.

Real-money unlock requires:

- QVAC SDK ready.
- WDK SDK ready.
- KYC/age verified.
- Jurisdiction allowed.
- Responsible-play terms accepted.
- Pool rules accepted.
- Payment captured or escrow locked.
- Payout route declared.
- Official result source available.
- QVAC attestation created from replay evidence.
- WDK payout or release prepared.
- Receipt recorded.

The UI can make real-money readiness visible, but it must not let the renderer
bypass the worker path.

## 11. Delivery Roadmap

### Phase 0: Strategy, Naming, And Repo Alignment

Goal:

- Decide the post-World-Cup product identity and platform boundaries.

Deliverables:

- Keep `design/kawaii-app/` as canonical until a typed app migration is ready.
- Add this plan to docs.
- Decide whether the post-World-Cup brand remains PearCup or becomes a broader
  name with PearCup as the soccer vertical.
- Create a v2 domain glossary: competition, event, pool, entry, fixture, result,
  room, game, settlement.
- Inventory base `app/` hardening modules that still need porting into
  `design/kawaii-app/`.

Acceptance:

- Team can explain the platform in one sentence.
- Engineers know which modules are generic and which are World Cup-specific.

### Phase 1: Generic Competition And Prediction Engine

Goal:

- Convert hardcoded World Cup bracket assumptions into reusable templates.

Deliverables:

- `single-elimination` template for 4, 8, 16, 32, and 64 entrants.
- Generic entrant model for teams, players, nominees, and creators.
- Generic fixtures and lock windows.
- `PredictionEntry` replacing bracket-only entry surfaces internally.
- Compatibility adapter that maps current World Cup bracket state to v2 entries.

Acceptance:

- Current World Cup flow still works.
- A Champions League-style knockout and 8-person creator bracket can be created
  from the same engine.
- Scoring remains deterministic in tests.

### Phase 2: Pool Variant Engine

Goal:

- Ship multiple pool variants on the same competition template.

Deliverables:

- Classic bracket.
- Confidence scoring.
- Head-to-head bracket duel.
- Group-stage pick cards.
- Rules preview and signed `rulesVersion`.
- Scoreboard and tie-policy engine.

Acceptance:

- A user can join two pool variants for one competition.
- Scoreboards compute from locked entries and result snapshots.
- Settlement receipts bind the rules version and source result snapshot.

### Phase 3: Watch-Room Prediction Layer

Goal:

- Make watch rooms playable before, during, and after events.

Deliverables:

- Quick prediction tray.
- Next-event prediction.
- Scoreline lock.
- Watch-party streak.
- Room leaderboard.
- QVAC room summary.

Acceptance:

- Users can make live predictions without leaving the room.
- Predictions lock correctly.
- Results replay from match/event feed snapshots.
- Room chat shows wins and streaks as signed events.

### Phase 4: Mini-Game Arcade

Goal:

- Expand from Penalty Clash into a reusable game platform.

Deliverables:

- Normalize Penalty Clash to `PeerGameSession`.
- Add spectator replay and ranked demo ladder.
- Add Free-Kick Duel using the same commit/reveal model.
- Add Trivia Duel with verified demo question banks.
- Add challenge tray in watch rooms.

Acceptance:

- Two peers can challenge, resolve, replay, and rematch.
- State hashes converge across peers.
- Game results can be watched by spectators.
- Prize-linked games remain locked behind settlement gates.

### Phase 5: Creator And Local League Mode

Goal:

- Let users create year-round pools without waiting for official tournaments.

Deliverables:

- Creator flow for custom tournament, fight card, awards card, and bingo card.
- Manual entrant and fixture management.
- Host-entered result snapshots.
- Invite links and room topics.
- Abuse controls: host permissions, result edit audit, participant reporting.

Acceptance:

- A school, office, pub, streamer, or local league can run a demo/sponsor pool.
- Result changes are visible and replayable.
- Real-money remains disabled for host-entered pools until reviewed.

### Phase 6: Sports And Event Feed Adapters

Goal:

- Support multiple official data domains through adapters.

Deliverables:

- Feed adapter interface by sport/category.
- Soccer feed adapter.
- Basketball tournament adapter.
- Esports adapter stub.
- Awards/manual adapter.
- Feed replay simulator for tests.

Acceptance:

- Same match room can consume fixture, clock, score, stats, and events from a
  feed adapter.
- Official result snapshots include source and hash.
- QVAC commentary references feed event ids only.

### Phase 7: Compliance-Ready Prize Layer

Goal:

- Safely support sponsor prizes and prepare for regulated real-money use.

Deliverables:

- Mode selector per pool.
- Sponsor-prize fulfillment status.
- Real-money readiness panel.
- KYC/age/region/terms gates.
- Responsible-play limits.
- Payout recipient declaration UX.
- Audit export for settlements and disputes.

Acceptance:

- Demo and sponsor pools can launch without pretending to be real-money.
- Real-money pool creation is impossible unless every gate passes.
- Settlement receipts are complete and replayable.

### Phase 8: Scale, Polish, And Distribution

Goal:

- Make the platform feel reliable, fast, and alive.

Deliverables:

- Visual regression tests for bracket, cards, rooms, and games.
- Load simulations for 100+ pool entries and busy watch rooms.
- Peer sync diagnostics.
- Notification system for locks, results, challenges, and payouts.
- Creator templates gallery.
- Share cards for wins, streaks, brackets, and duels.

Acceptance:

- New users can join a pool in under two minutes.
- Busy rooms remain readable.
- Settlements are explainable without reading logs.
- The app has a year-round content calendar.

## 12. Recommended First Public Post-World-Cup Beta

Do not launch every variant at once. The first broad beta should be:

- Competition types:
  - Soccer knockout
  - Generic single-elimination creator bracket
  - March Madness-style 64-team bracket in demo mode
- Pool variants:
  - Classic bracket
  - Confidence scoring
  - Head-to-head bracket duel
  - Next-event prediction in rooms
- Mini-games:
  - Penalty Clash
  - Trivia Duel demo
- Modes:
  - Demo
  - Sponsor-prize pilot
  - Real-money hidden behind internal readiness only
- Creator tools:
  - Custom entrants
  - Manual results
  - Invite-only pools

This gives the app a broad identity without multiplying regulated risk too early.

## 13. Testing Strategy

### Unit Tests

- Template fixture generation.
- Bracket progression at 4, 8, 16, 32, and 64 entrants.
- Prediction card validation.
- Confidence scoring.
- Survivor elimination.
- Upset bounty scoring.
- Head-to-head duel settlement.
- Mini-game resolver determinism.

### Integration Tests

- Create competition, create pool, submit picks, lock, record result, settle.
- Two peers join room, chat, submit live prediction, resolve prediction.
- Two peers play Penalty Clash and Free-Kick Duel.
- Creator enters result correction and scoreboards update from replay.
- Settlement service blocks real-money when any gate is missing.

### Simulation Tests

- 100 users in a bracket pool.
- 50 users in a live room.
- 20 concurrent prediction locks.
- Delayed and out-of-order peer events.
- Feed replay with corrections.
- Duplicate settlement command retries.

### Visual Tests

- Bracket desktop and mobile.
- 64-team bracket navigation.
- Prediction card submission.
- Watch room with quick challenge tray.
- Mini-game active and replay states.
- Creator event builder.
- Settlement receipt view.

## 14. Risk Register

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Product scope explosion | The idea space is huge. | Ship template + two variants first, then expand. |
| Gambling regulation | Props and real-money duels may be regulated. | Keep demo/sponsor modes first and hard-gate real-money. |
| Official data licensing | Sports feeds can be expensive and restricted. | Use adapters, simulators, and manual/creator mode. |
| Result disputes | Pools need trust. | Source-labeled result snapshots, QVAC referee checks, receipts. |
| Cheating in live games | Peer games need fairness. | Commit/reveal, state hashes, replay, timeouts, disputes. |
| Latency-sensitive reactions | Fastest-tap games are hard to settle fairly. | Demo-only until latency model is proven. |
| P2P discoverability | Peers need reliable rooms. | Keep BroadcastChannel fallback, improve swarm diagnostics. |
| UI complexity | Too many variants can overwhelm users. | Template-driven create flow and variant recommendations. |
| Moderation | Live rooms can get noisy or abusive. | Host controls, reporting, rate limits, block/mute. |

## 15. Success Metrics

Activation:

- Time from install to first joined pool.
- Percent of users who submit a complete entry.
- Percent who join a watch room.

Engagement:

- Predictions per live room.
- Mini-games per event.
- Chat/reaction participation.
- Rematches and head-to-head invites.

Retention:

- Users returning for next fixture/event.
- Users joining multiple pool variants.
- Creator-hosted events launched.

Trust:

- Settlement success rate.
- Dispute rate.
- Peer convergence rate.
- Feed correction handling time.

Revenue readiness:

- Sponsor-prize fulfillment completion.
- Real-money gate pass rate in internal environments.
- Payout recipient readiness before settlement.

## 16. Immediate Next Actions

1. Port any remaining hardened base modules from `app/` into `design/kawaii-app/`
   without overwriting the canonical UI files.
2. Create `competition-engine` and `prediction-engine` modules next to the
   current core logic.
3. Build a compatibility adapter for the current World Cup bracket.
4. Add `single-elimination` template tests for 4, 8, 16, 32, and 64 entrants.
5. Implement generic `PredictionEntry` and `PoolRules`.
6. Ship confidence scoring behind a simple UI toggle.
7. Add head-to-head bracket duel as the first social pool variant.
8. Add next-event live prediction to the watch room.
9. Normalize Penalty Clash under `PeerGameSession`.
10. Draft the creator/local-league mode after the generic engine is stable.

## 17. Product Mantra

Every new feature should answer yes to at least one of these:

- Does it make a live event more fun with friends?
- Does it turn a tournament into a reusable pool template?
- Does it produce a replayable, trustworthy result?
- Does it work in demo mode without regulatory complexity?
- Does it strengthen the P2P identity of the app?

If not, it waits.
