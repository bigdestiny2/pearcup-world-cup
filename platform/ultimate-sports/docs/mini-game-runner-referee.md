# Mini-game Runner and QVAC Referee Contract

`src/mini-game-runner-engine.js` turns the mini-game specs into concrete runtime
artifacts without wiring them into the current PearCup app.

## Runtime Flow

`createMiniGameRunPlan` accepts a `fitId`, `gameType`, room, competition, users,
and settlement mode. It returns:

- a peer-game session for `game:create` specs such as `penalty-clash`,
  `free-kick-duel`, `trivia-duel`, and `reaction-challenge`;
- a live prediction market for `market:create` specs such as `next-event`,
  `scoreline-lock`, `momentum-duel`, `player-prop-duel`, and
  `watch-party-streak`;
- a fantasy-lite draft slate for `draft:create` specs such as
  `peer-mini-fantasy`.

`resolveMiniGameRun` routes the run to the correct resolver:

- `miniGame.resolveMiniGame` for peer games;
- `livePrediction.resolvePredictionMarket` for live markets;
- `livePrediction.resolveWatchPredictionStreak` when a watch-party streak is
  supplied with ordered market resolutions;
- `draft.resolveDraftSlate` for peer mini fantasy.

`createMiniGameRunMatrix` builds executable run plans for every catalog fit and
every recommended mini-game in the spec matrix.

## QVAC Referee Policy

QVAC referee packets are modeled as `game-fairness` attestations from
`attestation-engine.js`. A run requires the QVAC referee when any of these
conditions apply:

- the result source is `host-entered`;
- the game is `trivia-duel`, because the answer key and question bank need an
  auditable source;
- the game is `reaction-challenge`, because latency windows and tap moments need
  fairness review;
- the game is `peer-mini-fantasy`, because athlete stats must be checked before
  settlement;
- the settlement mode is `sponsor-prize` or `real-money`;
- the caller explicitly passes `forceQvac`.

When evidence events are present, the referee attestation can verify before
settlement. Without evidence, the attestation is held, which gives the UI a clear
state for games that are waiting on host review, feed snapshots, or source facts.

`trivia-duel` also creates a QVAC `trivia-bank` record. In prize modes, the bank
is held until questions include verified source facts.

Combat cards and other no-API result paths use QVAC `result-evidence` records.
Those reviews gather official web pages, verified social posts, web-search
snippets, screenshots, source URLs, claimed winner, method, and round. A prize
settlement should only proceed when the review is `ready`; conflicting or
single-source claims remain `held`.

## Facade Methods

The platform facade exposes:

- `createMiniGameRunPlan`
- `resolveMiniGameRun`
- `createQvacMiniGameReferee`
- `createMiniGameRunMatrix`

These methods let the future sports app build and test the full mini-game suite
while the current PearCup version remains isolated.
