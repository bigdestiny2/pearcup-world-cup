# Social Feed Plan

This is the design contract for a **social feed surface** on the lobby landing
page and on each event/sport surface. It is the companion for a new engine trio
(`social-feed-provider-engine`, `social-feed-aggregator-engine`,
`social-feed-client-engine`) that mirrors the existing
`sports-data-provider/aggregator/client` stack.

The goal: pull live, relevant social chatter and clips for whatever is happening
now — a match, a fight card, a tournament — and render it in the lobby and per
event, **without ever letting that content touch a prize outcome**.

## The One Hard Rule

Social content is **`context-only`** in the settlement tier vocabulary already
used by `sports-data-aggregator-engine`:

> Context-only: used for odds display, responsible-play copy, and upset context.
> Never settles a result.

Every social record is display/engagement decoration. It is **walled off from
the QVAC/WDK settlement and payout paths** described in
`docs/pear-runtime-boundary.md`. No social post may become evidence, adjust a
market, or influence auto-settle, corroboration, or dispute logic.

### Do not confuse this with `social-web-evidence`

The aggregator already has a `social-web-evidence` source. That is a
**settlement-adjacent, QVAC-reviewed corroboration lane** for niche combat cards
and no-API events (`evidence-review` tier). It is deliberately slow, verified,
and host-gated.

The **social feed** in this document is the opposite: fast, high-volume,
display-only, and never verified for settlement. They share the word "social"
and nothing else. Keep them in separate engines so the boundary is structural,
not a matter of discipline.

## Scope and Priority

Decentralized-protocol-first, matching the Pear/Holepunch P2P ethos and avoiding
B2B API-key/proxy dependencies.

1. **Nostr — primary.** Fully decentralized, WebSocket relays, no central key.
   A Bare worker can subscribe to relays directly and filter by event hashtags
   and curated author pubkeys. Most on-brand for a Holepunch app; no relay
   service of ours required.
2. **Bluesky / AT Protocol — secondary.** Open, documented API. Feasible with an
   app-password/token; feed generators and hashtag/firehose filtering available.
3. **Mastodon / ActivityPub — secondary.** Per-instance open APIs; hashtag
   timeline streaming per instance.
4. **Native activity feed — backbone reference.** Not an external source, but the
   lobby feed should interleave first-party P2P activity from
   `engagement-engine` (`SHARE_CARD_TYPES`: pool-win, game-win, streak, bracket,
   duel, room-highlight) and live watch rooms. This is the zero-dependency spine
   the external protocols augment. Tracked in a separate note; listed here so the
   feed model accommodates a `native` source from day one.
5. **Mainstream (X / Instagram / TikTok) — deferred.** Cannot be reached
   peer-to-peer. Would require a first-party relay/gateway holding keys (same
   "route through our backend only" model as Sportradar). Out of scope for this
   iteration; the source stack leaves room for it.

## Source Stack

| Source ID | Protocol | Auth | Keyless? | Tier |
| --- | --- | --- | --- | --- |
| `nostr-relays` | Nostr | none | yes | context-only |
| `bluesky-atproto` | AT Protocol | app-password/token | no (light) | context-only |
| `mastodon-instances` | ActivityPub | per-instance token/none | mostly | context-only |
| `native-activity` | in-app P2P | n/a | yes | context-only |
| `relay-mainstream` (deferred) | X/IG/TikTok via our relay | server-side keys | no | context-only |

Every source is `context-only`. There is no source-of-truth or evidence tier in
this engine by construction.

## Normalized Record: `social-post`

Add `social-post` as a normalized entity type (new engine; do **not** widen the
sports-data aggregator's `NORMALIZED_ENTITY_TYPES`). One envelope per post:

- `postId` — `stableId(source, externalId)` via `util.js`
- `sourceId` and protocol
- `externalId` — Nostr event id, AT URI, Mastodon status id, or native event id
- `author` — `{ handle, displayName, pubkeyOrDid, avatarRef, verified }`
- `text` — sanitized, length-capped
- `mediaRefs` — array of `{ kind: image|video|link, url, previewRef }`
- `lang`
- `createdAt`, `ingestedAt`
- `eventTags` — mapped `competitionId` / `fixtureId` / sport `category`
- `topicTags` — raw hashtags/keywords before mapping
- `payloadHash` — `hash32` of raw payload for dedupe
- `moderation` — `{ state: pending|allowed|hidden, reasons[], score }`
- `settlementTier` — always `context-only` (asserted, not passed in)

Reuse `hash32`, `stableId`, `cloneJson`, `ensureArray` from `src/util.js`, same
as every existing engine.

## Engines to Add

Mirror the sports-data trio so the pattern is instantly familiar:

- **`social-feed-provider-engine.js`** — source strategy: which protocols,
  their coverage, auth model, keyless flag, and the invariant that every source
  is `context-only`. Analogous to `sports-data-provider-engine`.
- **`social-feed-aggregator-engine.js`** — normalize each protocol payload into
  the `social-post` envelope, dedupe by `payloadHash`, map `topicTags` →
  `eventTags`, and score moderation. Analogous to `sports-data-aggregator-engine`.
- **`social-feed-client-engine.js`** — protocol clients. Nostr relay subscribe
  (WebSocket), Bluesky/Mastodon HTTP. Never exposes credentials to the renderer;
  builds redacted request/subscription plans and reports missing env per source,
  exactly like `sports-data-client-engine` with its injected `fetchImpl`
  (add an injected `wsImpl` for Nostr).

Each engine gets a co-located `*.test.js` following the repo convention, and is
added to `src/index.js`.

## Event / Sport Routing

Per-fit routing table, in the shape of the aggregator's Fit Routes, mapping each
catalog category/fit to the hashtags, keywords, and curated authors that seed its
feed. Categories from `catalog-engine`: `soccer`, `basketball`, `pro-sports`,
`tennis`, `esports`, `combat-sports`, `sailing`, `creator`, `awards`, `local`.

| Fit | Seed tags / handles (illustrative) |
| --- | --- |
| `world-cup` | `#WorldCup`, team+match hashtags, curated soccer authors |
| `champions-league-knockout` | `#UCL`, tie-specific tags |
| `mma-boxing-fight-card` | `#UFC<n>`, fighter handles, card hashtags |
| `esports-major` | title + tournament tags (Valorant/LoL/CS/Dota) |
| `sailgp-companion` | `#SailGP`, event/leg tags |
| `march-madness` / `pro-playoffs` / `tennis-grand-slams` | league + round tags |
| `creator-reality-brackets` / `awards-prediction-pools` | show + season tags |
| `local-leagues` | host-supplied tags/handles |

Seed lists live in config, not code, so a host can tune an event's feed without a
release. Unmapped posts stay in the lobby-wide feed only; they never attach to an
event surface without an explicit tag match.

## Trust and Safety Model

Because this is high-volume public content rendered next to prize markets,
moderation is mandatory **before** anything renders:

- **Ingestion filters** — language, length cap, media allowlist, drop
  known-spam patterns, rate-limit per author.
- **Moderation scoring** — NSFW/abuse/misinfo heuristics set `moderation.state`;
  only `allowed` posts render. `pending` and `hidden` never reach the renderer.
- **User controls** — mute/block author, hide source, report. Blocks are local
  and P2P-shareable but never settlement-signals.
- **Prize proximity guard** — a lint/assertion that no `social-post` field flows
  into `feed-engine`, `settlement-engine`, `prediction-engine`, or any
  WDK/QVAC command. This is the structural enforcement of the One Hard Rule.
- **No settlement, ever** — `settlementTier` is asserted `context-only` in the
  constructor; passing anything else throws.

## Ingestion Pipeline

1. Resolve seed tags/authors for the active fits (config-driven).
2. Subscribe/fetch per protocol in the **Bare worker**, never the renderer:
   - Nostr: open relay WebSocket subscriptions filtered by tags/pubkeys.
   - Bluesky/Mastodon: authenticated HTTP polling or streaming per instance.
3. Normalize into the `social-post` envelope.
4. Dedupe by `payloadHash`; map `topicTags` → `eventTags`.
5. Moderation score; drop or hide anything not `allowed`.
6. Publish an append-only, capped ring buffer of allowed posts to the renderer
   over the existing worker→renderer bridge (new read-only command, e.g.
   `social:subscribe` / `social:list`).
7. Renderer displays; no write path back into any settlement command.

## Renderer Surfaces

- **Landing / lobby:** a new `renderSocialFeed()` panel in `lobby-app/app.js`
  alongside `renderActiveCompetitions`, `renderTicker`, `renderPrivateRooms`.
  Interleaves `native-activity` posts with allowed external posts, newest first,
  capped, auto-refreshing.
- **Per event/sport:** the event surface filters the same store by its
  `competitionId`/`fixtureId`/`category` to show only that event's chatter and
  clips. Empty state falls back to native activity + "no live posts yet."
- Both surfaces are read-only, cite the source protocol per post, and expose
  mute/hide/report inline.

## Runtime Boundary

Consistent with `docs/pear-runtime-boundary.md` (thin renderer, worker owns
services):

- **Worker owns:** protocol subscriptions/clients, credentials, normalization,
  moderation, dedupe, the capped post buffer. Add a Corestore namespace for
  cached social posts and local mute/block lists.
- **Renderer owns:** display only. It receives already-moderated, already-typed
  posts and can issue mute/hide/report and refresh — nothing that writes to a
  prize path.

## Phased Build

1. **Model + guardrail.** `social-feed-provider-engine` + `social-post` envelope
   + the `context-only` assertion and prize-proximity lint. Tests first.
2. **Native backbone.** Wire `native-activity` from `engagement-engine` share
   cards + watch rooms into the aggregator; ship the lobby panel with in-app
   content only (zero external dependency, fully P2P).
3. **Nostr.** Add the Nostr relay client (`wsImpl` injectable), seed tags per
   fit, moderation pipeline, per-event filtering.
4. **Bluesky + Mastodon.** Add AT Protocol and ActivityPub clients behind the
   same aggregator contract.
5. **(Deferred) Mainstream relay.** Only if reach demands it; requires a
   first-party gateway and its own moderation/ToS review.

## Open Questions

- Curated author/pubkey lists per fit: who maintains them, and how are they
  distributed (config bundle vs. host-editable vs. P2P-shared)?
- Moderation depth for MVP: heuristic-only, or a QVAC-assisted pass for content
  rendered near active prize markets?
- Nostr relay set: ship a default relay list or let hosts configure per event?
- Caching/retention window and buffer cap per surface.
- Do native-activity and external posts share one ranked feed, or two tabs?
