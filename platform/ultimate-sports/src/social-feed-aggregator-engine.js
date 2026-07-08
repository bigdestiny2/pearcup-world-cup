'use strict'

const catalog = require('./catalog-engine')
const providers = require('./social-feed-provider-engine')
const {
  cloneJson,
  hash32,
  stableId,
  ensureArray,
  assertNonEmptyString,
  assertAllowed
} = require('./util')

const SOCIAL_FEED_AGGREGATOR_PLAN_VERSION = 'ultimate-sports-social-feed-aggregator-plan-v1'

const SETTLEMENT_TIER = providers.SETTLEMENT_TIER

const NORMALIZED_ENTITY_TYPES = Object.freeze(['social-post'])

const MODERATION_STATES = Object.freeze(['pending', 'allowed', 'hidden'])
const MEDIA_KINDS = Object.freeze(['image', 'video', 'link'])

const PRIZE_PROXIMITY_GUARDED_ENGINES = Object.freeze([
  'feed-engine',
  'settlement-engine',
  'prediction-engine',
  'qvac-engine',
  'wdk-adapter-engine',
  'wager-engine',
  'pool-engine',
  'scoring-engine',
  'dispute-engine'
])

const SETTLEMENT_COMMAND_PREFIXES = Object.freeze([
  'pool:',
  'settlement:',
  'prediction:',
  'wager:',
  'qvac:',
  'wdk:',
  'dispute:',
  'feed:'
])

const MAX_TEXT_LENGTH = 500
const MAX_MEDIA_REFS = 8
const MAX_TOPIC_TAGS = 24
const MAX_AUTHORS_PER_WINDOW = 6
const RATE_LIMIT_WINDOW_MS = 60_000

const SPAM_PATTERNS = Object.freeze([
  /https?:\/\/\S+\s+(?:https?:\/\/\S+\s*){2,}/i,
  /\b(?:free\s+(?:btc|crypto|giveaway|airdrop|money))\b/i,
  /\b(?:click\s+(?:my\s+)?link|follow\s+me\s+(?:for|to)\s+(?:free|money|btc|crypto))\b/i,
  /\b(?:bet\s+now|deposit\s+(?:now|here)|claim\s+(?:your\s+)?(?:bonus|prize))\b/i,
  /(?:.)\1{10,}/
])

const NSFW_PATTERNS = Object.freeze([
  /\b(?:nsfw|porn|xxx|nude|nudes|onlyfans)\b/i,
  /\b(?:fuck|shit|bitch|cunt|asshole|dick)\b/i
])

const ABUSE_PATTERNS = Object.freeze([
  /\b(?:kill\s+yourself|kys|rape|molest)\b/i,
  /\b(?:racist|nig+er|fag+ot|tranny|retard)\b/i
])

const MISINFO_PATTERNS = Object.freeze([
  /\b(?:match\s+is\s+fixed|referee\s+was\s+paid|results?\s+are?\s+rigged)\b/i,
  /\b(?:this\s+is\s+fake|staged\s+(?:match|event|fight))\b/i
])

const MODERATION_RULES = Object.freeze([
  { id: 'spam', patterns: SPAM_PATTERNS, weight: 1, reason: 'spam-pattern' },
  { id: 'nsfw', patterns: NSFW_PATTERNS, weight: 1, reason: 'nsfw-language' },
  { id: 'abuse', patterns: ABUSE_PATTERNS, weight: 1, reason: 'abuse-language' },
  { id: 'misinfo', patterns: MISINFO_PATTERNS, weight: 1, reason: 'misinfo-claim' }
])

const FIT_TOPIC_SEEDS = Object.freeze({
  'world-cup': {
    tags: ['#worldcup', '#worldcup2026', '#fifa', '#football', '#soccer'],
    authors: [],
    category: 'soccer'
  },
  'euros-copa-america': {
    tags: ['#euro', '#copaamerica', '#football', '#soccer'],
    authors: [],
    category: 'soccer'
  },
  'champions-league-knockout': {
    tags: ['#ucl', '#championsleague', '#football', '#soccer'],
    authors: [],
    category: 'soccer'
  },
  'march-madness': {
    tags: ['#marchmadness', '#ncaab', '#collegebasketball'],
    authors: [],
    category: 'basketball'
  },
  'pro-playoffs': {
    tags: ['#nbaplayoffs', '#nhlplayoffs', '#mlbplayoffs'],
    authors: [],
    category: 'pro-sports'
  },
  'tennis-grand-slams': {
    tags: ['#wimbledon', '#usopen', '#rolandgarros', '#australianopen', '#tennis'],
    authors: [],
    category: 'tennis'
  },
  'esports-major': {
    tags: ['#valorant', '#lol', '#csgo', '#dota2', '#rocketleague', '#esports'],
    authors: [],
    category: 'esports'
  },
  'mma-boxing-fight-card': {
    tags: ['#ufc', '#mma', '#boxing', '#fightnight'],
    authors: [],
    category: 'combat-sports'
  },
  'sailgp-companion': {
    tags: ['#sailgp', '#sailing'],
    authors: [],
    category: 'sailing'
  },
  'creator-reality-brackets': {
    tags: ['#realitytv', '#creator'],
    authors: [],
    category: 'creator'
  },
  'awards-prediction-pools': {
    tags: ['#oscars', '#grammys', '#eurovision', '#awards'],
    authors: [],
    category: 'awards'
  },
  'local-leagues': {
    tags: ['#local', '#rec', '#publeague'],
    authors: [],
    category: 'local'
  }
})

const HASHTAG_PATTERN = /#[\p{L}\p{N}_]+/gu

function createSocialFeedAggregatorPlan (input = {}) {
  providers.assertContextOnlyTier(input.settlementTier || SETTLEMENT_TIER)
  const includeDeferred = Boolean(input.includeDeferred)
  const sources = Object.values(providers.SOURCES)
    .filter(source => includeDeferred || !source.deferred)
    .map(cloneJson)
  const routes = catalog.listEventFits().map(fit => aggregatorRouteForFit(fit))

  return {
    planVersion: SOCIAL_FEED_AGGREGATOR_PLAN_VERSION,
    settlementTier: SETTLEMENT_TIER,
    hardRule: 'Social content is context-only. Every social record is display/engagement decoration. It is walled off from the QVAC/WDK settlement and payout paths.',
    strategy: {
      headline: 'Normalize each protocol payload into the social-post envelope, dedupe by payloadHash, map topicTags to eventTags, and score moderation before anything renders.',
      coreStack: ['nostr-relays', 'native-activity', 'bluesky-atproto', 'mastodon-instances'],
      noSettlement: true,
      moderationRule: 'Only allowed posts render. Pending and hidden never reach the renderer.'
    },
    normalizedEntityTypes: NORMALIZED_ENTITY_TYPES.slice(),
    sources,
    routes,
    ingestionPipeline: createIngestionPipeline(),
    trustAndSafety: createTrustAndSafetyPlan(),
    prizeProximityGuard: createPrizeProximityGuard(),
    envVars: envVarsForSources(sources)
  }
}

function aggregatorRouteForFit (fitOrId) {
  const fit = typeof fitOrId === 'string' ? catalog.getEventFit(fitOrId) : fitOrId
  if (!fit) throw new Error(`unknown fit: ${fitOrId}`)
  const providerPlan = providers.providerPlanForFit(fit.fitId)
  const seed = FIT_TOPIC_SEEDS[fit.fitId] || { tags: [], authors: [], category: fit.category }

  return {
    routeId: stableId(`social-feed-route-${fit.fitId}`, {
      sourceIds: providerPlan.sourceIds,
      tags: seed.tags
    }),
    fitId: fit.fitId,
    title: fit.title,
    category: fit.category,
    settlementTier: SETTLEMENT_TIER,
    sourceIds: providerPlan.sourceIds,
    primarySourceId: providerPlan.primarySourceId,
    seedTags: seed.tags.slice(),
    seedAuthors: seed.authors.slice(),
    topicMapping: {
      sourceTags: seed.tags.slice(),
      mappedCategory: seed.category,
      competitionId: null,
      fixtureId: null
    },
    moderationPolicy: {
      required: true,
      rendererGate: 'only allowed posts render; pending and hidden never reach the renderer',
      userControls: ['mute', 'block', 'hide-source', 'report']
    }
  }
}

function normalizeSocialPost (input = {}) {
  assertNonEmptyString(input.sourceId, 'sourceId')
  assertNonEmptyString(input.externalId, 'externalId')
  const source = Object.values(providers.SOURCES).find(item => item.sourceId === input.sourceId)
  if (!source) throw new Error(`unknown social-feed source: ${input.sourceId}`)

  const rawPayload = cloneJson(input.payload || input.raw || {})
  const payloadHash = hash32(rawPayload)
  const text = sanitizeText(input.text != null ? input.text : rawPayload.text || rawPayload.content || '')
  const topicTags = extractTopicTags(input.topicTags || rawPayload.tags || rawPayload.hashtags || extractHashtagsFromText(text))
  const author = normalizeAuthor(input.author || rawPayload.author)
  const mediaRefs = normalizeMediaRefs(input.mediaRefs || rawPayload.media || [])
  const eventTags = mapTopicTagsToEvents(topicTags, input.eventTags)
  const moderation = input.moderation || scoreModeration({ text, author, mediaRefs })

  const body = {
    sourceId: source.sourceId,
    protocol: source.protocol,
    externalId: input.externalId,
    author,
    text,
    mediaRefs,
    lang: input.lang || rawPayload.lang || detectLang(text),
    createdAt: input.createdAt || rawPayload.createdAt || rawPayload.created_at || null,
    ingestedAt: input.ingestedAt || new Date().toISOString(),
    eventTags,
    topicTags,
    payloadHash,
    moderation,
    settlementTier: SETTLEMENT_TIER
  }

  return {
    postId: input.postId || stableId(`social-post-${source.sourceId}`, {
      externalId: body.externalId,
      payloadHash
    }),
    ...body,
    canRender: moderation.state === 'allowed',
    canSettle: false,
    recordHash: hash32(body)
  }
}

function sanitizeText (text) {
  const trimmed = String(text || '').trim()
  if (trimmed.length <= MAX_TEXT_LENGTH) return trimmed
  return `${trimmed.slice(0, MAX_TEXT_LENGTH - 1)}…`
}

function extractTopicTags (tags) {
  const list = ensureArray(tags, 'topicTags')
    .map(tag => String(tag || '').trim())
    .filter(Boolean)
    .slice(0, MAX_TOPIC_TAGS)
  return list
}

function extractHashtagsFromText (text) {
  const matches = String(text || '').match(HASHTAG_PATTERN)
  return matches ? matches.slice(0, MAX_TOPIC_TAGS) : []
}

function normalizeAuthor (author) {
  if (!author || typeof author !== 'object') {
    return { handle: null, displayName: null, pubkeyOrDid: null, avatarRef: null, verified: false }
  }
  return {
    handle: author.handle || author.username || null,
    displayName: author.displayName || author.name || null,
    pubkeyOrDid: author.pubkeyOrDid || author.pubkey || author.did || author.id || null,
    avatarRef: author.avatarRef || author.avatar || null,
    verified: Boolean(author.verified)
  }
}

function normalizeMediaRefs (media) {
  return ensureArray(media, 'mediaRefs')
    .map(item => {
      if (typeof item === 'string') return { kind: 'link', url: item, previewRef: null }
      if (!item || typeof item !== 'object') return null
      const kind = item.kind || (item.type === 'image' ? 'image' : item.type === 'video' ? 'video' : 'link')
      return {
        kind: MEDIA_KINDS.includes(kind) ? kind : 'link',
        url: item.url || item.src || null,
        previewRef: item.previewRef || item.preview || null
      }
    })
    .filter(item => item && item.url)
    .slice(0, MAX_MEDIA_REFS)
}

function mapTopicTagsToEvents (topicTags, explicitEventTags) {
  const explicit = explicitEventTags && typeof explicitEventTags === 'object' ? explicitEventTags : {}
  const result = {
    competitionId: explicit.competitionId || null,
    fixtureId: explicit.fixtureId || null,
    category: explicit.category || null
  }
  if (result.category) return result
  const lower = topicTags.map(tag => String(tag).toLowerCase())
  const mapped = Object.values(FIT_TOPIC_SEEDS).find(seed =>
    seed.tags.some(tag => lower.includes(tag.toLowerCase()))
  )
  if (mapped) result.category = mapped.category
  return result
}

function detectLang (text) {
  const sample = String(text || '').trim()
  if (!sample) return 'und'
  return /^[A-Za-z\s,.!?;:'"-]+$/.test(sample) ? 'en' : 'other'
}

function scoreModeration (input = {}) {
  const text = String(input.text || '')
  const reasons = []
  let score = 0

  for (const rule of MODERATION_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        reasons.push(rule.reason)
        score += rule.weight
        break
      }
    }
  }

  if (text.length > 0 && text.length < 3) {
    reasons.push('too-short')
    score += 0.2
  }

  const mediaRefs = input.mediaRefs || []
  if (mediaRefs.length > MAX_MEDIA_REFS) {
    reasons.push('too-many-media')
    score += 0.5
  }

  const state = score >= 1 ? 'hidden' : score > 0 ? 'pending' : 'allowed'
  return {
    state,
    reasons,
    score: Number(score.toFixed(2))
  }
}

function dedupeSocialPosts (posts) {
  const seen = new Map()
  const result = []
  for (const post of ensureArray(posts, 'posts')) {
    if (!post || !post.payloadHash) continue
    if (seen.has(post.payloadHash)) continue
    seen.set(post.payloadHash, post)
    result.push(post)
  }
  return result
}

function rateLimitByAuthor (posts, options = {}) {
  const windowMs = options.windowMs || RATE_LIMIT_WINDOW_MS
  const maxPerWindow = options.maxPerWindow || MAX_AUTHORS_PER_WINDOW
  const byAuthor = new Map()
  const result = []
  for (const post of posts) {
    const key = post.author && (post.author.pubkeyOrDid || post.author.handle) || 'unknown'
    const ts = post.createdAt ? Date.parse(post.createdAt) : 0
    if (Number.isNaN(ts)) continue
    const bucket = byAuthor.get(key) || []
    const inWindow = bucket.filter(time => ts - time < windowMs && ts - time >= 0)
    if (inWindow.length >= maxPerWindow) continue
    inWindow.push(ts)
    byAuthor.set(key, inWindow)
    result.push(post)
  }
  return result
}

function filterRenderable (posts) {
  return ensureArray(posts, 'posts').filter(post => post && post.moderation && post.moderation.state === 'allowed')
}

function assertContextOnlyTier (tier) {
  assertAllowed(tier, providers.ALLOWED_SETTLEMENT_TIERS, 'social-feed settlementTier')
}

function assertNoSettlementLeak (command) {
  if (!command || typeof command !== 'object') return { ok: true, leaked: false }
  const type = command.type || command.action || ''
  if (typeof type !== 'string') return { ok: true, leaked: false }
  const isSettlementCommand = SETTLEMENT_COMMAND_PREFIXES.some(prefix => type.startsWith(prefix))
  if (!isSettlementCommand) return { ok: true, leaked: false }
  const serialized = JSON.stringify(command.payload || command)
  const hasSocialField = serialized.includes('social-post') ||
    serialized.includes('socialPost') ||
    serialized.includes('postId') && serialized.includes('payloadHash')
  if (!hasSocialField) return { ok: true, leaked: false }
  return {
    ok: false,
    leaked: true,
    violation: 'social-post field detected in a settlement-adjacent command',
    commandType: type,
    rule: 'No social-post field may flow into feed-engine, settlement-engine, prediction-engine, or any WDK/QVAC command.'
  }
}

function assertNoPrizeProximityLeak (targetEngineId, payload) {
  if (!PRIZE_PROXIMITY_GUARDED_ENGINES.includes(targetEngineId)) {
    return { ok: true, guarded: false }
  }
  const serialized = JSON.stringify(payload || {})
  const hasSocialField = serialized.includes('social-post') ||
    serialized.includes('socialPost') ||
    serialized.includes('"postId"') ||
    serialized.includes('"payloadHash"') ||
    serialized.includes('"eventTags"') ||
    serialized.includes('"topicTags"')
  if (!hasSocialField) return { ok: true, guarded: true }
  return {
    ok: false,
    guarded: true,
    violation: `social-post field detected flowing into guarded engine: ${targetEngineId}`,
    rule: 'Prize proximity guard: no social-post field may flow into feed-engine, settlement-engine, prediction-engine, or any WDK/QVAC command.'
  }
}

function createIngestionPipeline () {
  return [
    { stepId: 'resolve-seeds', owner: 'aggregator', output: 'seed tags and curated authors for active fits (config-driven)' },
    { stepId: 'subscribe-or-fetch', owner: 'worker', output: 'raw protocol payload (nostr event, AT URI, mastodon status, native event)' },
    { stepId: 'normalize', owner: 'aggregator', output: 'social-post envelope with context-only settlementTier asserted' },
    { stepId: 'dedupe', owner: 'aggregator', output: 'unique posts by payloadHash' },
    { stepId: 'map-tags', owner: 'aggregator', output: 'topicTags mapped to eventTags (competitionId, fixtureId, category)' },
    { stepId: 'moderate', owner: 'aggregator', output: 'moderation.state set; only allowed posts proceed' },
    { stepId: 'rate-limit', owner: 'aggregator', output: 'per-author rate-limited stream' },
    { stepId: 'publish-buffer', owner: 'worker', output: 'append-only capped ring buffer of allowed posts to renderer' },
    { stepId: 'renderer-display', owner: 'renderer', output: 'read-only display; mute/hide/report only; no write path to settlement' }
  ]
}

function createTrustAndSafetyPlan () {
  return {
    ingestionFilters: {
      language: true,
      lengthCap: MAX_TEXT_LENGTH,
      mediaAllowlist: MEDIA_KINDS.slice(),
      spamPatternDrop: true,
      rateLimitPerAuthor: { windowMs: RATE_LIMIT_WINDOW_MS, maxPerWindow: MAX_AUTHORS_PER_WINDOW }
    },
    moderationScoring: {
      rules: MODERATION_RULES.map(rule => ({ id: rule.id, weight: rule.weight, reason: rule.reason })),
      states: MODERATION_STATES.slice(),
      renderGate: 'only allowed posts render; pending and hidden never reach the renderer'
    },
    userControls: Object.freeze(['mute', 'block', 'hide-source', 'report']),
    prizeProximityGuard: {
      guardedEngines: PRIZE_PROXIMITY_GUARDED_ENGINES.slice(),
      guardedCommandPrefixes: SETTLEMENT_COMMAND_PREFIXES.slice(),
      rule: 'No social-post field may flow into feed-engine, settlement-engine, prediction-engine, or any WDK/QVAC command.'
    },
    noSettlement: {
      rule: 'settlementTier is asserted context-only in the constructor; passing anything else throws.',
      canSettle: false
    }
  }
}

function createPrizeProximityGuard () {
  return {
    guardedEngines: PRIZE_PROXIMITY_GUARDED_ENGINES.slice(),
    guardedCommandPrefixes: SETTLEMENT_COMMAND_PREFIXES.slice(),
    assertNoSettlementLeak,
    assertNoPrizeProximityLeak
  }
}

function envVarsForSources (sources) {
  const vars = new Set()
  for (const source of sources) {
    if (source.sourceId === 'bluesky-atproto') {
      vars.add('BLUESKY_HANDLE')
      vars.add('BLUESKY_APP_PASSWORD')
    }
    if (source.sourceId === 'mastodon-instances') {
      vars.add('MASTODON_INSTANCE')
      vars.add('MASTODON_ACCESS_TOKEN')
    }
  }
  return [...vars].sort()
}

module.exports = {
  SOCIAL_FEED_AGGREGATOR_PLAN_VERSION,
  SETTLEMENT_TIER,
  NORMALIZED_ENTITY_TYPES,
  MODERATION_STATES,
  MEDIA_KINDS,
  MODERATION_RULES,
  PRIZE_PROXIMITY_GUARDED_ENGINES,
  SETTLEMENT_COMMAND_PREFIXES,
  FIT_TOPIC_SEEDS,
  createSocialFeedAggregatorPlan,
  aggregatorRouteForFit,
  normalizeSocialPost,
  dedupeSocialPosts,
  rateLimitByAuthor,
  filterRenderable,
  scoreModeration,
  mapTopicTagsToEvents,
  sanitizeText,
  extractTopicTags,
  normalizeAuthor,
  normalizeMediaRefs,
  assertContextOnlyTier,
  assertNoSettlementLeak,
  assertNoPrizeProximityLeak,
  createPrizeProximityGuard
}
