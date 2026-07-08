'use strict'

const catalog = require('./catalog-engine')
const { cloneJson, assertAllowed } = require('./util')

const SOCIAL_FEED_PROVIDER_PLAN_VERSION = 'ultimate-sports-social-feed-provider-plan-v1'

const SETTLEMENT_TIER = 'context-only'
const ALLOWED_SETTLEMENT_TIERS = Object.freeze([SETTLEMENT_TIER])

const SOURCES = Object.freeze({
  nostrRelays: source({
    sourceId: 'nostr-relays',
    protocol: 'nostr',
    title: 'Nostr relay subscriptions',
    role: 'primary-decentralized-social-feed',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis', 'esports', 'combat-sports', 'sailing', 'creator', 'awards', 'local'],
    auth: 'none',
    keyless: true,
    transport: 'websocket-relay',
    feedModel: 'subscribe-by-hashtag-and-pubkey',
    deferred: false,
    notes: [
      'Fully decentralized; WebSocket relays with no central key.',
      'A Bare worker can subscribe to relays directly.',
      'Most on-brand for a Holepunch app; no relay service of ours required.'
    ]
  }),
  blueskyAtproto: source({
    sourceId: 'bluesky-atproto',
    protocol: 'at-protocol',
    title: 'Bluesky / AT Protocol',
    role: 'secondary-open-api-social-feed',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis', 'esports', 'combat-sports', 'sailing', 'creator', 'awards', 'local'],
    auth: 'app-password-or-token',
    keyless: false,
    transport: 'http-json',
    feedModel: 'feed-generators-and-hashtag-firehose-filtering',
    deferred: false,
    notes: [
      'Open, documented API. Feasible with an app-password/token.',
      'Feed generators and hashtag/firehose filtering available.'
    ]
  }),
  mastodonInstances: source({
    sourceId: 'mastodon-instances',
    protocol: 'activity-pub',
    title: 'Mastodon / ActivityPub instances',
    role: 'secondary-federated-social-feed',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis', 'esports', 'combat-sports', 'sailing', 'creator', 'awards', 'local'],
    auth: 'per-instance-token-or-none',
    keyless: true,
    transport: 'http-json',
    feedModel: 'hashtag-timeline-streaming-per-instance',
    deferred: false,
    notes: [
      'Per-instance open APIs; hashtag timeline streaming per instance.',
      'Mostly keyless; some instances require a token for higher limits.'
    ]
  }),
  nativeActivity: source({
    sourceId: 'native-activity',
    protocol: 'in-app-p2p',
    title: 'Native activity feed (P2P backbone)',
    role: 'zero-dependency-spine',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis', 'esports', 'combat-sports', 'sailing', 'creator', 'awards', 'local'],
    auth: 'n/a',
    keyless: true,
    transport: 'in-app-event-bridge',
    feedModel: 'interleave-share-cards-and-watch-rooms',
    deferred: false,
    notes: [
      'Not an external source; the zero-dependency spine external protocols augment.',
      'Interleaves first-party P2P activity from engagement-engine share cards and live watch rooms.',
      'Tracked separately so the feed model accommodates a native source from day one.'
    ]
  }),
  relayMainstream: source({
    sourceId: 'relay-mainstream',
    protocol: 'x-ig-tiktok-via-relay',
    title: 'Mainstream relay gateway (deferred)',
    role: 'deferred-gateway-social-feed',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis', 'esports', 'combat-sports', 'sailing', 'creator', 'awards', 'local'],
    auth: 'server-side-keys',
    keyless: false,
    transport: 'http-json-via-first-party-relay',
    feedModel: 'route-through-our-backend-only',
    deferred: true,
    notes: [
      'Cannot be reached peer-to-peer.',
      'Would require a first-party relay/gateway holding keys (same model as Sportradar).',
      'Out of scope for this iteration; the source stack leaves room for it.'
    ]
  })
})

const FIT_SOURCE_OVERRIDES = Object.freeze({
  'world-cup': ['nostr-relays', 'native-activity', 'bluesky-atproto', 'mastodon-instances'],
  'champions-league-knockout': ['nostr-relays', 'native-activity', 'bluesky-atproto', 'mastodon-instances'],
  'mma-boxing-fight-card': ['nostr-relays', 'native-activity', 'bluesky-atproto', 'mastodon-instances'],
  'esports-major': ['nostr-relays', 'native-activity', 'bluesky-atproto', 'mastodon-instances'],
  'sailgp-companion': ['nostr-relays', 'native-activity', 'bluesky-atproto', 'mastodon-instances'],
  'creator-reality-brackets': ['native-activity', 'nostr-relays', 'bluesky-atproto'],
  'awards-prediction-pools': ['native-activity', 'nostr-relays', 'bluesky-atproto'],
  'local-leagues': ['native-activity', 'nostr-relays', 'mastodon-instances']
})

const SOURCE_IDS = Object.freeze(Object.values(SOURCES).map(source => source.sourceId))

function assertContextOnlyTier (tier) {
  assertAllowed(tier, ALLOWED_SETTLEMENT_TIERS, 'social-feed settlementTier')
}

function createSocialFeedProviderPlan (input = {}) {
  const includeDeferred = Boolean(input.includeDeferred)
  assertContextOnlyTier(input.settlementTier || SETTLEMENT_TIER)
  const sources = Object.values(SOURCES)
    .filter(source => includeDeferred || !source.deferred)
    .map(cloneJson)
  const fits = catalog.listEventFits().map(fit => providerPlanForFit(fit))

  return {
    planVersion: SOCIAL_FEED_PROVIDER_PLAN_VERSION,
    settlementTier: SETTLEMENT_TIER,
    hardRule: 'Every social record is display/engagement decoration. It is walled off from the QVAC/WDK settlement and payout paths. No social post may become evidence, adjust a market, or influence auto-settle, corroboration, or dispute logic.',
    recommendation: {
      headline: 'Use Nostr as the primary decentralized social feed, with Bluesky and Mastodon as secondary open-API sources, and the native activity feed as the zero-dependency P2P spine.',
      reason: 'Decentralized-protocol-first matches the Pear/Holepunch P2P ethos and avoids B2B API-key/proxy dependencies.',
      primarySourceId: 'nostr-relays',
      backboneSourceId: 'native-activity',
      secondarySourceIds: ['bluesky-atproto', 'mastodon-instances'],
      deferredSourceIds: ['relay-mainstream']
    },
    sources,
    fits,
    coverageGaps: coverageGapsFor(sources)
  }
}

function providerPlanForFit (fitOrId) {
  const fit = typeof fitOrId === 'string' ? catalog.getEventFit(fitOrId) : fitOrId
  if (!fit) throw new Error(`unknown fit: ${fitOrId}`)
  const sourceIds = FIT_SOURCE_OVERRIDES[fit.fitId] || sourceIdsForCategory(fit.category)
  const activeSourceIds = sourceIds.filter(id => {
    const src = sourceById(id)
    return src && !src.deferred
  })
  const primary = activeSourceIds[0]

  return {
    fitId: fit.fitId,
    title: fit.title,
    category: fit.category,
    sourceIds: activeSourceIds,
    primarySourceId: primary,
    settlementTier: SETTLEMENT_TIER,
    sources: activeSourceIds.map(id => {
      const src = sourceById(id)
      return {
        sourceId: id,
        protocol: src.protocol,
        role: src.role,
        keyless: src.keyless,
        deferred: src.deferred
      }
    })
  }
}

function sourceIdsForCategory (category) {
  if (['creator', 'awards', 'local'].includes(category)) {
    return ['native-activity', 'nostr-relays', 'bluesky-atproto', 'mastodon-instances']
  }
  return ['nostr-relays', 'native-activity', 'bluesky-atproto', 'mastodon-instances']
}

function sourceById (sourceId) {
  const entry = Object.values(SOURCES).find(item => item.sourceId === sourceId)
  if (!entry) throw new Error(`unknown social-feed source: ${sourceId}`)
  return entry
}

function coverageGapsFor (sources) {
  return sources
    .filter(source => source.deferred)
    .map(source => ({
      sourceId: source.sourceId,
      gap: 'deferred — requires a first-party gateway and its own moderation/ToS review',
      reason: 'Cannot be reached peer-to-peer; would require server-side keys'
    }))
}

function source (input) {
  return Object.freeze({
    sourceId: input.sourceId,
    protocol: input.protocol,
    title: input.title,
    role: input.role,
    coverage: Object.freeze(input.coverage.slice()),
    auth: input.auth,
    keyless: input.keyless,
    transport: input.transport,
    feedModel: input.feedModel,
    deferred: input.deferred,
    settlementTier: SETTLEMENT_TIER,
    notes: Object.freeze((input.notes || []).slice())
  })
}

module.exports = {
  SOCIAL_FEED_PROVIDER_PLAN_VERSION,
  SETTLEMENT_TIER,
  ALLOWED_SETTLEMENT_TIERS,
  SOURCES,
  SOURCE_IDS,
  createSocialFeedProviderPlan,
  providerPlanForFit,
  assertContextOnlyTier
}
