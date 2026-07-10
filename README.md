# PearCup 🍐⚽

**A peer‑to‑peer World Cup bracket, watch party, and prediction game — built on the [Pear runtime](https://docs.pears.com/). No servers, no sign‑up.**

Pick the knockout bracket, drop into a live watch room, and play real peer‑to‑peer penalty shootouts against friends — everything settles P2P over Holepunch, with a Tether WDK wallet and a QVAC trusted referee for fair, verifiable results.

## ▶ Run it live on Pear

```sh
pear run pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo
```

**Production link:** `pear://ky9s3jx178s4cdsnkke4cpxmk9jx93eeb99q8aa5dnrjancirdeo` — seeded / HiveRelay‑pinned, shipping the **live 2026 World Cup knockout bracket**, the watch party, and the P2P penalty minigame. No Pear yet? Grab it at [pears.com](https://docs.pears.com/), or run it [locally](#run-locally).

## What's inside

- **🏆 Bracket pools** — rolling round‑by‑round World Cup pools (Round of 32 → Final). Real 2026 knockout data; pick before each kickoff, scored against results.
- **📺 Watch party** — a shared live match room with reactions, multilingual commentary, and a synced feed.
- **🎮 P2P penalty minigame** — real peer‑to‑peer penalty shootouts (Penalty Clash) over the swarm, with matchmaking, invites, and hidden‑guest handshakes.
- **💸 Real settlement rails** — Tether WDK for entries / escrow / payouts and a QVAC trusted referee for game rounds and pool settlement, with receipt hashes surfaced in the UI.
- **🌐 True P2P** — no backend. Presence, rooms, chat, and results converge over Holepunch topics through the Pear runtime.

## 🚀 Forked into Ultimate Sports

PearCup started as a *World Cup* app. It's since been forked and generalized into **Ultimate Sports** — a **bracket‑picker + social prediction app for _any_ sport** — which now lives in its own repository: **[github.com/bigdestiny2/ultimate-sports](https://github.com/bigdestiny2/ultimate-sports)**.

Where PearCup is one tournament, Ultimate Sports is a **multi‑sport P2P client**: an early‑internet‑style server browser where each "server" is a different sport or event —

- ⚽ **Soccer** — World Cup, Euros / Copa América, Champions League
- 🥊 **Combat sports** — UFC / boxing **fight cards** (pick winner + method + round, with arcade fight‑night graphics)
- 🏀 **Basketball & pro leagues** — March Madness, NBA / NHL / MLB playoffs
- 🎾 **Tennis** · 🎮 **Esports** (Valorant / LoL / CS / Dota / Rocket League) · ⛵ **SailGP** · 🎬 **Awards** · plus **creator** tournaments and **local** rec leagues

Twelve servers across ten categories, each with its own bracket / pick format, live watch rooms, a cross‑network **social feed** (Nostr / Bluesky / Mastodon), P2P mini‑games, and the same WDK + QVAC settlement spine. **Same P2P foundation — any sport.**

> The two builds are kept in **separate repositories**: this repo is **PearCup** (`design/kawaii-app/`), the released World Cup entry above. **Ultimate Sports**, the multi‑sport evolution, is developed at **[bigdestiny2/ultimate-sports](https://github.com/bigdestiny2/ultimate-sports)**.

## Folder Map

- **[`design/kawaii-app/`](design/kawaii-app/)** — **PearCup**, the released Pear app (self‑contained: own `package.json`, `index.cjs`, P2P modules). **Start here.**
- `app/` — earlier base prototype; QVAC / WDK hardening was ported from here into the kawaii build.
- `docs/` — technical spec, Pear runtime boundary, and architecture notes.
- `scripts/` — release gates, staging, and publish helpers.

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the module map and dev workflow, and **[`design/kawaii-app/RELEASE.md`](design/kawaii-app/RELEASE.md)** for the full stage → release → seed flow (including the space‑in‑path staging note).

## Run Locally

```sh
cd design/kawaii-app
npm install          # restores git-ignored node_modules (required before pear stage)
pear run --dev .     # Pear desktop window with live local files
```

From the repo root, `npm run dev`, `npm run stage`, `npm run release`, and `npm run seed` all route to this canonical build.

## Test

```sh
npm test                 # unit + P2P + deep-link tests
npm run check            # runtime, boot bundle, and Pear-compat checks
npm run audit:launch     # QVAC / WDK / payout / compliance launch gates
```

## Architecture

No backend. The renderer stays SDK‑free; a Pear **worker bridge** owns the P2P / WDK / QVAC boundary. Presence, rooms, chat, and settlement converge over Holepunch topics with append‑only event logs and replay roots, keeping real‑money rails locked until SDK and compliance gates are ready. See [`docs/pear-runtime-boundary.md`](docs/pear-runtime-boundary.md) for the renderer / worker / WDK / QVAC split.
