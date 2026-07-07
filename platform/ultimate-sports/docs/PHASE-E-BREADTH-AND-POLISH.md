# Ultimate Sports — Phase E: Breadth & Polish (for kimi)

The app is feature-complete for a demo and architecturally sound. Phase E turns
"works and looks good" into "deep and finished": more ways to play (mini-games,
pool variants), richer per-sport structure, a fully polished client, and the last
security/robustness residuals closed.

Read the repo conventions in `docs/BUILD-OUT-PLAN.md §1` before starting (the
space-in-path, test globs, snapshot churn, cache-bust-by-port, the
**kawaii-untouched** rule, and the lowercased-join-code gotcha). Everything here
is inside `platform/ultimate-sports/` — never touch `design/kawaii-app/`.

Anchor: `main` @ `e69b1ec`. Suites green (ultimate 261 / app 287 / kawaii 42),
fit smoke 73/73.

Each task lists **Files**, **Do**, **Done-when**. Priorities are ordered; E1–E3
are the highest product value.

---

## E1 — Mini-games beyond Penalty Clash (biggest breadth win)

The engine layer already *specifies* a full mini-game system per fit; the shell
only implements one game (Penalty Clash). Bring the other games to life on the
P2P session contract.

**What exists**
- `src/mini-game-spec-engine.js` — `createMiniGameSpec({fitId, gameType})`,
  `createMiniGameSuite({fitId})`, `createMiniGameBuildMatrix()`, `blueprintFor`,
  `resolverCoverage`. It defines, per fit, which games apply, their prompts,
  options, scoring, and settlement command drafts.
- `src/catalog-engine.js` — each fit's `recommendedMiniGames`, e.g. soccer:
  `['penalty-clash','free-kick-duel','next-event','scoreline-lock','watch-party-streak','reaction-challenge']`;
  combat: `[...,'player-prop-duel',...]`; basketball: `[...,'momentum-duel',...]`.
- `shell/peer-match.js` — the WORKING reference: a P2P game over
  `PearCupPeerNet.createChannel(GAME_TOPIC(code))` with commit-reveal
  (`commit`→`dive`→`reveal`), deterministic resolution, the challenge-response
  admission gate, and settlement receipts. Use it as the template for new games.

**The pattern each new mini-game follows**
1. A deterministic, fairness-preserving session contract (commit-reveal where a
   player's choice must be hidden until both are locked; plain reveal where order
   doesn't matter).
2. Both clients resolve the same outcome from the same revealed inputs (no
   authority).
3. Settlement goes through the existing `settlement-service`/receipts path so
   escrow/payout stays trusted (demo rails today).
4. The room access gate (Phase A) already protects who can be your opponent.

**Tasks**

- **E1.1 Extract a generic P2P mini-game runtime.** Files:
  `shell/peer-match.js` (the source pattern), new `shell/mini-game-runtime.js`.
  Do: factor the reusable bits of peer-match (channel setup, hello/challenge
  admission, commit-reveal helpers, round state sync, receipt emission) into a
  runtime that a per-game module plugs into with `{ prompt, options, resolve,
  score }` from `mini-game-spec-engine`. Keep Penalty Clash working through it.
  Done-when: Penalty Clash runs unchanged on the new runtime; adding a game =
  writing a small resolver, not a new transport.

- **E1.2 Implement the low-lift games first** (no hidden-choice needed →
  plain-reveal): **next-event** (predict the next scoring event), **scoreline-lock**
  (lock a final score), **reaction-challenge** (timed tap), **watch-party-streak**
  (chain of live props). Files: `shell/mini-game-runtime.js`, per-game modules,
  `shell/app.js` Games surface (game picker filtered by fit
  `recommendedMiniGames`). Do: wire each game's spec (from
  `createMiniGameSpec({fitId, gameType})`) into the runtime; render its UI on the
  Games screen; resolve + settle P2P. Done-when: for a soccer fit you can pick and
  play next-event/scoreline-lock against a peer to a settled result.

- **E1.3 Implement the hidden-choice duels** (need commit-reveal like Penalty
  Clash): **free-kick-duel**, **player-prop-duel**, **momentum-duel**,
  **trivia-duel**. Done-when: each plays a best-of-N with commit-reveal, both
  clients agree on the outcome, and the result posts a settlement receipt.

- **E1.4 Filter Games + Pools surfaces by fit fit.** Files: `shell/app.js`. Do:
  the Games lobby shows only `recommendedMiniGames` for the current fit; the game
  header/mascot/art come from the fit. Done-when: MMA shows fight-flavored games,
  not penalty kicks.

- **E1.5 Tests.** Files: `test/mini-game-*.test.js`. Do: unit-test each resolver
  for determinism + commit-reveal integrity (two clients, same inputs → same
  outcome; a peek/cheat attempt fails). Mirror the app's peer-match test style.
  Done-when: each game has a determinism + fairness test.

---

## E2 — Pool variants (deep replayability)

The catalog defines 12 pool variants and the **scoring engine already implements
most of them** — but the shell UI only exposes classic bracket. Expose the
variants so a pool isn't just "pick the bracket."

**What exists**
- `src/constants.js POOL_VARIANTS`: `classic-bracket, confidence, survivor,
  upset-bounty, head-to-head-duel, group-stage-card, fantasy-lite-draft,
  watch-party-bingo, next-event, scoreline-lock, player-prop, side-quest`.
- `src/scoring-engine.js` already has `scoreClassicBracket`, `scoreConfidenceCard`,
  `scoreSurvivorEntry`, `scoreUpsetBountyBracket`, `scoreHeadToHeadDuel`,
  `scoreSideQuestEntry`. The engine bundle (`shell/engines.bundle.js`) exposes
  scoring to the shell (Phase C).
- `src/catalog-engine.js` — each fit's `recommendedVariants`.

**Tasks**

- **E2.1 Pool = template kind × variant.** Files: `shell/app.js` (pool select +
  pick flow), `shell/core.js` (route to the right engine scorer). Do: let a pool
  carry a `variant`; the pick UI adapts (confidence = assign points per pick;
  survivor = one pick per round, no repeats; bingo = mark a card); scoring routes
  to the matching `scoring-engine` function via the bundle. Done-when: entering a
  "confidence" pool assigns confidence points and scores via
  `scoreConfidenceCard`, verified against the engine.
- **E2.2 Implement the UI for each variant** on the bracket/awards/group surfaces:
  confidence sliders, survivor lifecycle, upset-bounty seed markers, watch-party
  bingo card, head-to-head duel pairing. Done-when: each `recommendedVariant` per
  fit renders a coherent pick experience.
- **E2.3 Variant-aware leaderboards + settlement.** Files: `shell/app.js`,
  `shell/settlement-service.js`. Do: leaderboards + payouts use the variant's
  scoreboard (via `deriveBracketPoolWinners`-style routing already unified in
  Phase C). Done-when: a survivor pool pays the last survivor; a confidence pool
  pays by confidence total.
- **E2.4 Parity tests** (extend `test/scoring-parity.test.js`) for confidence,
  survivor, upset-bounty so shell↔engine agreement is guarded for every variant.

---

## E3 — Template-kind depth

The four kinds render; make them faithful to their sports.

- **E3.1 Fight-card props.** Files: `shell/fits/mma-boxing-fight-card.js`,
  `shell/app.js renderFightCardBoard`. Do: per bout, add method (KO/Sub/Dec) and
  round props as sub-picks; score via the player-prop path. Done-when: an MMA bout
  scores winner + method + round.
- **E3.2 Awards weighting.** Files: `shell/fits/awards-prediction-pools.js` (each
  category now has a `weight`), `shell/app.js remainingPicks/scoring`. Do: wire the
  `weight` into scoring so Best Picture (weight 3) outscores a minor category.
  Done-when: awards scoreboard reflects category weights.
- **E3.3 Group → knockout advancement.** Files: `shell/fits/group-stage-fits.js`,
  `shell/app.js`. Do: predicted group winners/runners-up seed a knockout bracket
  below the groups (the "+knockout" half of group-plus-knockout). Done-when: Euros
  shows groups AND the bracket they feed.
- **E3.4 New kinds** (from `EVENT_TEMPLATE_KINDS`): **series-playoff** (best-of-7
  series picks), **round-robin** (standings table), **creator-custom** (host-entered
  results). Wire the fits that the catalog marks with those kinds.

---

## E4 — Design polish (finish the client language)

- **E4.1 Fix the `.match-card` light background on dark themes.** Files:
  `shell/styles.css` / `shell/client-skin.css`. Symptom: bout/category/pool cards
  render light-on-dark in MMA/awards fits because `.match-card` hardcodes a light
  background. Do: make card surfaces theme-driven (`var(--surface)`), not hardcoded.
  Done-when: MMA/awards cards read dark, world-cup stays light.
- **E4.2 Carry the client skin fully into Watch + Games.** Files:
  `shell/client-skin.css`. The topbar/home/bracket are skinned; watch and games
  surfaces still have kawaii-era rounded/soft bits. Do: sharpen, mono-ify data
  (scores, timers, sync hashes), LCD the live/network chrome. Done-when: watch +
  games match the client language.
- **E4.3 Empty / loading / error states.** Files: lobby + shell. Do: every list
  (servers, friends, rooms, pools, leaderboards, chat) has a designed empty state;
  every async surface has a loading state; failures show a real message, not a
  blank. Done-when: no blank panels anywhere; disconnect/rejoin shows status.
- **E4.4 Responsive + mobile.** Files: `lobby-app/styles.css`,
  `shell/styles.css`, `shell/client-skin.css`. The lobby already stacks under
  880px; audit the server table, private rooms, and shell surfaces on a narrow
  viewport (the Pear window can be resized to `minWidth 1024`, but design down to
  ~700 for safety). Done-when: no horizontal body scroll, tables scroll in their
  own container, controls stay tappable.
- **E4.5 Accessibility.** Do: visible keyboard focus everywhere, correct roles/
  aria on the server table + dialogs + toggles, `prefers-reduced-motion` respected
  (the LCD ticker/EQ/pulse animations must stop), sufficient contrast on the LCD
  greens. Done-when: tab-through works, reduced-motion kills the animations.
- **E4.6 Per-fit palette refinement.** Each fit sets only color tokens (geometry/
  type come from the skin). Give the fits that still reuse the generic pink a
  distinct, tasteful palette (esports neon, tennis clay/grass, basketball hardwood,
  sailing navy). Done-when: opening two servers feels like two different worlds.
- **E4.7 Micro-interactions.** Tasteful, not noisy: pick confirmation, wallet
  debit/credit motion, peer join/leave, live-goal flash. Respect reduced-motion.

---

## E5 — Security & robustness residuals

- **E5.1 Require owner proof in `peer-match`.** Files: `shell/peer-match.js`.
  Today `onHello` admits the room owner on `cred.key === ownerKey` with no proof —
  a smaller version of the replay class we closed in watch/lobby. Do: make the
  owner answer the same challenge-response (they hold the private key, so
  `signChallenge` works). Done-when: an owner-key claim without a fresh signed
  nonce is not admitted. (watch-sync/peer-lobby already require it.)
- **E5.2 Drop the legacy self-chosen-proof path.** Files: `shell/room-access.js`
  `verifyAgainst` (the `cred.proof && cred.nonce` self-chosen branch) and
  `peer-match.js` (the legacy-proof branch in `onHello`). It provides zero replay
  protection. Once challenge-response is universal (E5.1), remove it so the only
  path to admission is a verifier-issued nonce. Done-when: no admission path
  accepts a self-chosen nonce; `test/room-access.test.js` updated to assert it.
- **E5.3 Nonce lifecycle.** Files: watch-sync/peer-lobby/peer-match. Add a bound/
  TTL on stored `authNonces` (clear on leave; expire unanswered challenges) so a
  never-answered challenge can't wedge a peerId. Done-when: a challenged-but-silent
  peer can be re-challenged after a timeout.
- **E5.4 Test the wiring, not just the crypto.** The room-access tests cover the
  pure functions; add a two-peer handshake test (or a documented browser-eval
  procedure) that a captured cred replayed under a new peerId is rejected on
  peer-match/watch/lobby (I verified this by hand for watch — automate it).

---

## E6 — Internationalization & content

- **E6.1 UI i18n.** Commentary already ships EN/PT/ES/FR; extend to the UI chrome
  (labels, buttons, empty states) with a small string table keyed by the settings
  language. Done-when: switching language translates the client, not just
  commentary.
- **E6.2 Real per-fit content.** Replace remaining placeholder entrants/fixtures
  with real, current rosters per fit (kept demo/simulated until Phase D live data).
  Done-when: each fit's home/bracket/watch shows sport-appropriate, non-stale
  content.

---

## E7 — Performance

- Audit `shell/engines.bundle.js` size and the fit asset payload; lazy-load the
  heavy raster assets (hero/board/stage JPGs) so first paint isn't blocked.
- Verify the server table + leaderboards render fast with 100+ rows (virtualize if
  needed).
- Done-when: lobby first paint < 1s on the preview; opening a fit < 1.5s; no jank
  scrolling the server browser.

---

## Quality bar for every Phase-E change
- Keep all three suites green (ultimate/app/kawaii) and fit smoke 73/73.
- Browser-verify anything rendered (screenshot + console-error check), on a **new
  preview port** each time (cache).
- Revert the `app/data/ultimate-sports-snapshot.json` timestamp churn before
  committing.
- Small, focused commits; never touch `design/kawaii-app/`.

## Gotchas (Phase-E specific)
- New P2P messages must use distinct `t` types — don't collide with existing ones
  (`hello`/`challenge`/`here`/`auth-req`/`commit`/`dive`/`reveal`/`bye`). Note
  `challenge` in watch/lobby is the *game-invite*, separate from `auth-req`.
- Scoring must go through the engine bundle (Phase C), not new cloned logic — add
  a parity test whenever you touch scoring.
- Fits set **color** tokens only; put geometry/type in the skin.
- The Games surface's mini-game set must come from the fit's `recommendedMiniGames`,
  not a hardcoded list.
