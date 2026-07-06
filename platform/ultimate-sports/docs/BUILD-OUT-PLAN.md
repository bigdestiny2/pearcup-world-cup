# Ultimate Sports — Build-Out Plan (for kimi2.7)

An execution plan to take Ultimate Sports from its current state (a working P2P
tournament client with four template kinds, friends, private rooms, and crypto
access control) to a fully built-out product. Read **§0–§2 before touching code**.

Anchor commit: `291ec6d` on `main` (118 commits ahead of `origin/main` — nothing
pushed; do not force-push).

---

## 0. Orientation — what this is

A **Pear (Holepunch) peer-to-peer** sports-prediction app. Two product lines share
one repo:

- **PearCup World Cup** — `design/kawaii-app/`. A self-contained, shippable Pear app
  (the kawaii build). **⚠️ HARD RULE: never make `design/kawaii-app/` depend on
  anything outside itself.** It is a hackathon submission and must always stage/
  release standalone. Do your work in `platform/ultimate-sports/`, never here.
- **Ultimate Sports** — `platform/ultimate-sports/`. The multi-sport platform. This
  is where all build-out happens.

Ultimate Sports has three parts:

| Part | Path | What it is |
|---|---|---|
| **Lobby** | `platform/ultimate-sports/lobby-app/` | The "P2P client" — server browser, wallet, friends, private rooms. The front door. |
| **Shell** | `platform/ultimate-sports/shell/` | A fit-parameterized clone of the kawaii app. Opens per-sport ("server") experiences. |
| **Engines** | `platform/ultimate-sports/src/` | 53 deterministic domain engines (competition/pool/scoring/settlement/catalog…), node CJS, 239 tests. **Not yet wired to the shell** (see §5.4). |

A **fit** = an event-template preset (`world-cup`, `mma-boxing-fight-card`, …). The
lobby launches `shell/index.html?fit=<id>`; `shell/fit-loader.js` applies the fit's
theme + data; `shell/app.js` renders it.

---

## 1. How to work in this repo (read this)

- **The path has a space**: `…/02-apps/pear sports/…`. Quote all paths. Some tools
  choke on it — e.g. `node --test <dir>/` mis-parses; always use the **glob**:
  `node --test platform/ultimate-sports/test/*.test.js`.
- **Tests** (must stay green): app suite `npm test` (287), kawaii `npm run
  test:kawaii-peer` (42), ultimate `node --test platform/ultimate-sports/test/*.test.js`
  (239).
- **Snapshot churn**: running the ultimate suite rewrites
  `platform/ultimate-sports/app/data/ultimate-sports-snapshot.json` with a new
  timestamp. `git checkout --` it before committing. (A background task to fix this
  properly exists; until then, revert it.)
- **Browser preview**: static-serve the platform root and drive it with the preview
  tools. `python3 -m http.server <port> --directory pearcup-world-cup/platform/ultimate-sports`
  (`.claude/launch.json` "ultimate"). **Bump the port on every re-verify** — Python's
  server sends no cache headers, so a same-port reload serves stale JS. New port =
  fresh origin = fresh fetch.
- **Verify in the browser** for anything the shell/lobby renders (the shell's UI and
  P2P are browser-verified, not node-tested). Simulate remote peers with a
  same-origin `BroadcastChannel` on the right topic (`PearCupPeerNet.GAME_TOPIC(code)`,
  presence `ultimate-sports:presence:v1`).
- **Gotcha — lobby `const state` is not on `window`.** Top-level `function`
  declarations are global (callable via `preview_eval`); `const state` is not.
- **Commits**: small, focused, imperative subject; end with the Co-Authored-By
  trailer. Only commit when a step is verified. Don't push unless asked.
- **Two preserved WIP branches** (do not delete): `wip/fit-asset-packs` (`2aa3ad3`)
  = full 12-fit asset packs to integrate (§5.3); `codex/seamless-pear-runtime-gate`
  (`e9a2f30`) = release-pipeline hardening to evaluate.

---

## 2. Current state (what's done — don't rebuild it)

Template kinds (the shell renders by structure, each fit keeps its color theme):
`single-elimination` (default), **fight-card** (MMA — independent bouts),
**awards-card** (Oscars/Grammys — category→nominee), **group-plus-knockout** (Euros —
predict winner/runner-up). Dispatch is in `shell/app.js renderBracketBoard()`.

- **Lobby = P2P client** design (window chrome, LCD network layer, server-browser
  table). `shell/client-skin.css` carries that language into the shell (sharp
  geometry, Tahoma/mono, LCD data) while fits keep their palette.
- **Shared spine**: lobby is the identity/wallet authority; `shell/host-bridge.js`
  bridges wallet+profile into each fit (postMessage `ultimate:v1`).
- **Friends + presence**: Ed25519 identity keypair; add-by-key; live online/offline
  over `PearCupPeerNet` presence (`lobby-app/app.js` presence module).
- **Private rooms + crypto access control**: host signs per-member invites
  (capabilities); `verifyRoomAccess` decides admission; shareable `us-room:v1:` tickets;
  **and the swarm handshake enforces it** — `shell/room-access.js` + `peer-match.js
  onHello` reject unverified joiners. (`lobby-app/crypto-identity.js`,
  `shell/crypto-identity.js` = `window.UltimateID`.)
- **Wallet**: demo USDT, ledger, deposit/withdraw/collect, Tether-WDK framing, real-
  money requirements gate. Settings: name/country/language.
- **Docs already written**: `docs/going-live.md` (credentials to turn on real data/
  money), `docs/engine-unification.md` (Phase 1B path).

---

## 3. The end state we're building toward

Open Ultimate Sports → see wallet, settings, friends (live presence), and the
tournament servers that are actually live → open any server → a Kawaii-quality,
per-sport experience, powered by the real engines, with pools that settle for real
under compliance, playable P2P with friends in access-controlled private rooms —
all running natively under the Pear runtime.

---

## 4. Sequencing overview

1. **Phase A — Run under Pear** (unlocks real swarm; validates everything shipped).
2. **Phase B — Per-fit content depth + asset packs** (the visible "every sport at
   Kawaii quality" grind; highest product value).
3. **Phase C — Engine unification** (one source of truth; prerequisite for real
   settlement at scale).
4. **Phase D — Real data + real money** (credential-gated; the compliance layer).
5. **Phase E — Breadth & polish** (more mini-games, gating on watch/lobby, freshness
   hardening, design polish).
6. **Phase F — Package & release** the Ultimate Sports drive.

Do them roughly in order; B and C can interleave. Each task below has **files**,
**do**, and **done-when**.

---

## 5. The work

### Phase A — Run natively under Pear
The P2P seams (presence, swarm room gate) are wired for `PearCupPeerNet`'s
hyperswarm/PearBrowser backends but only *browser-verified over BroadcastChannel*.
Prove them cross-device under Pear.

- **A1. Boot the lobby+shell as a Pear app.** Files: `platform/ultimate-sports/`
  (needs a Pear entry — mirror `design/kawaii-app/index.cjs`/`package.json` `pear`
  block; there's `design/ultimate-sports/index.cjs` as a starting loader). Do: make
  `pear run --dev .` open the lobby, which loads the shell per fit. Done-when: the
  client opens in a Pear window; opening a server renders the fit.
- **A2. Cross-device presence.** Do: run two Pear instances (two machines/profiles),
  add each other by peer ID. Done-when: friends show live online/offline over
  hyperswarm (not BroadcastChannel).
- **A3. Cross-device private-room gate.** Do: host creates a room, sends the
  `us-room:v1:` ticket to a friend; friend redeems + joins; a third peer with only
  the code is rejected on the handshake. Done-when: `peer-match onHello` admits the
  invited friend and rejects the gate-crasher across the real swarm.
- **A4.** Extend the same capability gate to **`watch-sync.js`** (watch room) and
  **`peer-lobby.js`** (presence in a private room), which currently accept any peer.
  Reuse `PearCupRoomAccess.verify`. Done-when: all three P2P surfaces reject
  unverified peers in a private room.

### Phase B — Per-fit content depth + asset packs (the grind)
Most fits beyond `world-cup`/`mma` are thin. Bring each to Kawaii quality with a
repeatable **production kit** per fit.

- **B1. Integrate the asset packs.** Branch `wip/fit-asset-packs` (`2aa3ad3`) has 9
  asset types × 12 fits (hero, lobby-icon, mini-game-icons, pool-accent, result-share,
  server-card-cover, watch-room-stage, bracket-board-skin, empty-state) + a generation
  plan. Do: reconcile it with `main` (main deleted the old `_asset-manifest.json` it
  re-adds), wire the covers into the lobby server rows and the fit hero backdrops.
  Done-when: every server row + fit hero shows its themed art.
- **B2. Per-fit data kit** (repeat for each fit in `shell/fits/`): real entrants,
  structure (bracket/bouts/categories/groups), pools, home fixtures, stat schema,
  leaders, commentary, chat. Pattern: dedicated file that `registerFit` overrides
  (see `mma-boxing-fight-card.js`, `awards-prediction-pools.js`), or extend the
  generator `scripts/generate-generic-fit-data.js`. Done-when: opening the fit shows
  real, sport-appropriate content on home/bracket/watch.
- **B3. Per-fit theme** — some fits still reuse the generic pink palette (e.g.
  `world-cup` is intentionally pink; others may want their own). Give each a distinct,
  tasteful palette (fits set color tokens only; geometry/type come from
  `client-skin.css`).
- **B4. Home/watch per fit.** The home hero + watch room still show World-Cup default
  live data for non-soccer fits. Do: drive them from the fit config (`homeFixtures`,
  a fit `liveMatch`). Done-when: an MMA fit's home shows a fight, not Spain vs Austria.

### Phase C — Engine unification (Phase 1B)
Route the shell onto `src/` engines instead of its cloned demo logic. Plan +
scoring parity already proven — see `docs/engine-unification.md` and
`test/scoring-parity.test.js`.

- **C1. Browser-bundle the pure engines** (scoring, pool, prediction, competition,
  util, constants, event-log — relative requires only, no node builtins; exclude
  `mma-card-asset-engine`, `standup-audit-engine`). Emit `shell/engines.bundle.js`
  exposing `window.UltimateEngines`. Mirror the `scripts/build-*.mjs` concat pattern.
- **C2. Adapter**: map shell UI state (`state.picks`, `enteredPools`, fit config) to
  engine inputs (entries, result snapshots, pools). Extend the parity approach
  (`test/scoring-parity.test.js`) to pool settlement + payouts before swapping.
- **C3. Swap behind the UI**, one path at a time (scoring → leaderboards →
  settlement), each verified against current output, then delete the shell's
  duplicate (`shell/core.js`/settlement). Done-when: the shell computes scores/pools/
  settlement via `src/` with no behavior change and the clone is gone.

### Phase D — Real data + real money (credential-gated)
Everything is documented in `docs/going-live.md`. This is mostly wiring + credentials.

- **D1. Live sports data**: supply provider keys (`SPORTRADAR_API_KEY`,
  `SPORTSDATAIO_*`, `PANDASCORE_API_KEY`, `ODDS_API_KEY`, `STATSPERFORM_API_KEY`,
  `FOOTBALL_DATA_KEY`); route each sport through `src/sports-data-*.js`. Done-when:
  `npm run smoke:sports-data:live` passes and a live event scores in-app.
- **D2. Real settlement**: configure `PEARCUP_WDK_*` + `PEARCUP_QVAC_*` + compliance
  flags; `npm run doctor:live` ready, `npm run audit:launch` passes. Done-when: a real
  event settles a pool end-to-end in demo-money, then (behind legal review) real.
- **D3. Wire the lobby real-money toggle** to the actual readiness signals so it
  unlocks only when D1/D2 are satisfied (today it's an informational gate).

### Phase E — Breadth & polish
- **E1. Mini-games beyond Penalty Clash** — per-sport P2P duels on the shared session
  contract (`peer-match.js` + the mini-game engines in `src/`). Fight prediction duel,
  esports pick'em, trivia. Filter by fit (`recommendedMiniGames`).
- **E2. Freshness/replay hardening** for the room gate: today the join proof signs a
  self-chosen nonce. Add challenge–response (verifier issues the nonce) in
  `peer-match onHello` ↔ `room-access`. Done-when: a captured hello can't be replayed
  by a non-holder.
- **E3. Design polish**: finish the client language on watch/games surfaces; the
  known cosmetic — `.match-card` has a hardcoded light background so cards look light
  on dark fit themes; make it theme-driven.
- **E4. Deeper template kinds**: fight-card method/round props; awards weighting;
  group→knockout advancement feeding the bracket.

### Phase F — Package & release
- **F1.** Extend the kawaii release pipeline (`scripts/prepare-pearbrowser-release.mjs`
  etc., already gated) to publish the **Ultimate Sports** drive (its own `hyper://`).
- **F2.** Add a per-fit smoke matrix (each fit passes the journey/P2P gates World Cup
  passes) before publish.
- **F3.** Evaluate/merge `codex/seamless-pear-runtime-gate` (`e9a2f30`) release
  hardening.

---

## 6. Test & quality gates
- Keep all three suites green (287 / 42 / 239). Add node coverage where you can (the
  crypto/access primitives are pure and testable: mirror `test/scoring-parity.test.js`
  and add a `verifyRoomAccess`/`room-access` test).
- Browser-verify every shell/lobby-rendered change (screenshot + console-error check).
- Fix the snapshot-churn test hygiene (make the snapshot write deterministic or go to
  a temp path) so the suite stops dirtying the tree.

## 7. Landmines (accumulated)
- Never touch `design/kawaii-app/` (hackathon build). Work only in `platform/ultimate-sports/`.
- Quote the space-in-path; use the test glob, not the dir.
- Bump the preview port to bust cache; revert snapshot churn before committing.
- Join codes are **lowercased** by the shell for the P2P topic (`PM.code`), but the
  invite/capability is signed over the **URL `join` value** (`RoomAccess.code`,
  uppercase). Keep those two uses separate — don't "normalize" one into the other.
- Fits set **color** tokens only; radius/fonts come from the skin. Don't put geometry
  in fit configs.
- `boot()` in `lobby-app/app.js` runs at end-of-file (TDZ on `const` data); keep it
  there, with `.catch(renderError)`.
