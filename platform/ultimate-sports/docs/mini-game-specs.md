# Mini-Game Specs By Sport And Tournament

This document is the product/spec companion for `src/mini-game-spec-engine.js`.
It maps every tournament fit to buildable mini-game specs: runtime type,
controls, sport-specific prompts, scoring, evidence, API/result source, and
command drafts.

Source of truth:

- Tournament catalog: `src/catalog-engine.js`
- Mini-game spec engine: `src/mini-game-spec-engine.js`
- Runtime resolvers: `src/mini-game-engine.js`
- Live markets: `src/live-prediction-engine.js`
- Tournament shell dock: `src/tournament-experience-engine.js`

## Runtime Families

Peer games:

- `penalty-clash`: aim, power, keeper read, commit/reveal, one point per goal.
- `free-kick-duel`: aim, curve, wall read, keeper read, commit/reveal, three
  points for a goal and one for a clean shot on frame.
- `trivia-duel`: question card, answers, timer, answer key, correctness first
  with response time as tie break.
- `reaction-challenge`: moment feed, tap target, latency window, fastest valid
  tap wins each moment.
- `buzzer-beater-duel`: basketball aim, power, defender read, commit/reveal, two
  points for a basket and one for an on-target shot.
- `ace-serve-duel`: tennis serve placement, power, spin, returner read,
  commit/reveal, two points for an ace and one for an in-bounds serve.
- `home-run-derby`: baseball pitch read, power, timing, commit/reveal, four
  points for a home run and one for a hit.
- `prediction-duel`: structured outcome prediction (method, round, winner, etc.),
  answer-key scoring with response-time tie break.

Live markets:

- `next-event`: one-choice prediction against the next feed or host-marked
  event.
- `scoreline-lock`: exact score before a cutoff, with result-class fallback.
- `momentum-duel`: side or balanced pick over a configured pressure window.
- `player-prop-duel`: player and prop prediction using first scorer or stat
  tolerance.
- `watch-party-streak`: consecutive correct predictions across ordered live
  prompts.

Draft:

- `peer-mini-fantasy`: three-athlete fantasy-lite roster scored from real or
  host-entered stats.

## Tournament Suites

### `world-cup`

- Games: `penalty-clash`, `free-kick-duel`, `next-event`, `scoreline-lock`,
  `watch-party-streak`, `reaction-challenge`.
- Event options: goal, corner, card, shot, save, VAR, penalty, comeback.
- Props: first scorer, shots, assists, cards.
- Trivia: nations, golden boot, group tables, knockout history.
- Reactions: goal, save, penalty, red card, VAR overturn.
- Result source: official feed.

### `euros-copa-america`

- Games: `penalty-clash`, `next-event`, `scoreline-lock`, `player-prop-duel`,
  `watch-party-streak`, `reaction-challenge`.
- Event options: goal, assist, card, save, corner, penalty, scoreline.
- Props: first scorer, shots, assists, cards.
- Trivia: regional champions, star players, derby history, hosts.
- Reactions: goal, save, penalty, late winner.
- Result source: official feed.

### `champions-league-knockout`

- Games: `penalty-clash`, `free-kick-duel`, `next-event`, `momentum-duel`,
  `watch-party-streak`, `reaction-challenge`.
- Event options: goal, free kick, penalty, save, aggregate swing, extra time.
- Props: first scorer, shots, assists, cards.
- Trivia: club history, two-leg ties, finals, star forwards.
- Reactions: goal, free kick, penalty, aggregate change.
- Result source: official feed.

### `march-madness`

- Games: `next-event`, `scoreline-lock`, `trivia-duel`, `peer-mini-fantasy`,
  `player-prop-duel`, `watch-party-streak`, `reaction-challenge`,
  `buzzer-beater-duel`.
- Event options: next basket, three, foul, rebound, assist, lead change, timeout.
- Props: points, assists, rebounds, blocks, steals, fouls.
- Trivia: seeds, regions, upsets, coaches, mascots.
- Reactions: buzzer beater, dunk, three, block, lead change.
- Result source: official feed.

### `pro-playoffs`

- Games: `next-event`, `scoreline-lock`, `player-prop-duel`,
  `peer-mini-fantasy`, `watch-party-streak`, `reaction-challenge`,
  `momentum-duel`, `buzzer-beater-duel`, `home-run-derby`.
- Event options: next goal, next run, next basket, save, strikeout, power play,
  lead change.
- Props: points, goals, runs, assists, saves, strikeouts.
- Trivia: series history, playoff records, star players, venues.
- Reactions: walkoff, overtime goal, poster dunk, big save, home run.
- Result source: official feed.

### `tennis-grand-slams`

- Games: `next-event`, `scoreline-lock`, `player-prop-duel`,
  `reaction-challenge`, `watch-party-streak`, `ace-serve-duel`.
- Event options: next game, break point, ace, double fault, tiebreak, set winner.
- Props: aces, double faults, breaks, sets won.
- Trivia: surfaces, seeds, slam history, head-to-head records.
- Reactions: ace, break point, match point, tiebreak winner.
- Result source: official feed.

### `esports-major`

- Games: `next-event`, `momentum-duel`, `trivia-duel`, `reaction-challenge`,
  `watch-party-streak`, `prediction-duel`.
- Event options: next map, first blood, objective, clutch, ace, overtime,
  economy swing.
- Props: kills, assists, objectives, saves, goals.
- Trivia: maps, agents, champions, patch meta, teams.
- Reactions: clutch, ace, objective steal, overtime, map win.
- Result source: official feed.

### `mma-boxing-fight-card`

- Games: `player-prop-duel`, `next-event`, `trivia-duel`, `reaction-challenge`,
  `watch-party-streak`, `momentum-duel`, `prediction-duel`.
- Format: reusable combat-card flow for MMA, boxing, kickboxing,
  ONE-style cards, bareknuckle, Muay Thai, and similar bout lists.
- Event options: round winner, knockdown, takedown, submission, stoppage,
  decision.
- Props: method, round, knockdowns, takedowns, significant strikes.
- Trivia: fighters, weight classes, prior bouts, methods.
- Reactions: knockdown, submission, stoppage, walkout, decision.
- Result source: covered combat API when available; otherwise QVAC
  `result-evidence` review from official web, social, and search sources.

### `sailgp-companion`

- Games: `next-event`, `momentum-duel`, `player-prop-duel`, `trivia-duel`,
  `reaction-challenge`, `watch-party-streak`, `peer-mini-fantasy`,
  `prediction-duel`.
- Event options: start winner, first mark, lead change, penalty turn, foil drop,
  gate split, race winner.
- Props: race winner, podium, top speed, foil time, mark position, penalty
  count.
- Trivia: teams, drivers, F50 roles, race venues, wind strategy.
- Reactions: start line, mark rounding, lead change, near collision, finish.
- Result source: hybrid official or partner feed with QVAC-reviewed evidence.

### `creator-reality-brackets`

- Games: `trivia-duel`, `reaction-challenge`, `watch-party-streak`,
  `prediction-duel`.
- Event options: reveal, judge choice, fan vote, challenge winner, elimination.
- Props: winner, category score, fan votes, judge pick.
- Trivia: creators, episodes, songs, dishes, challenges.
- Reactions: winner reveal, elimination, performance, twist.
- Result source: host entered.

### `awards-prediction-pools`

- Games: `trivia-duel`, `watch-party-streak`, `reaction-challenge`,
  `prediction-duel`.
- Event options: category winner, upset, speech, performance, jury vote, public
  vote.
- Props: winner, speech length, jury vote, public vote.
- Trivia: nominees, prior winners, songs, films, performers.
- Reactions: winner reveal, upset, performance, standing ovation.
- Result source: host entered.

### `local-leagues`

- Games: `penalty-clash`, `free-kick-duel`, `trivia-duel`, `next-event`,
  `peer-mini-fantasy`, `watch-party-streak`, `reaction-challenge`,
  `momentum-duel`, `player-prop-duel`, `prediction-duel`.
- Event options: next score, player prop, team streak, manual stat, local
  trivia.
- Props: goals, points, assists, saves, custom stat.
- Trivia: office lore, school teams, pub history, rec players.
- Reactions: goal, big play, save, match point, host-marked moment.
- Result source: host entered.

## Build Contract

Every suite produced by `createMiniGameSuite({ fitId })` must include:

- A spec for every mini-game recommended by the catalog for that fit.
- A runtime family: mini-game resolver, live-prediction market, or fantasy-lite
  draft.
- UI controls and event options tuned to the sport or tournament.
- A scoring summary and machine-readable scoring config.
- Evidence requirements for settlement, dispute, or replay.
- A command draft that can be used by launch/watch surfaces.

Every tournament shell produced by `createTournamentShell` must surface:

- A mini-game dock item for each suite spec.
- The command type, controls, runtime mapping, and scoring summary.
- Prompt examples from the tournament shell and event options from the spec.
