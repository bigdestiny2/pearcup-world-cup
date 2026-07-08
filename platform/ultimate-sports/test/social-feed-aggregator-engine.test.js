'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  catalog,
  platform,
  socialFeedAggregator,
  socialFeedProviders
} = require('../src')

test('social feed aggregator plan is context-only with no settlement paths', () => {
  const plan = socialFeedAggregator.createSocialFeedAggregatorPlan()

  assert.equal(plan.settlementTier, 'context-only')
  assert.equal(plan.strategy.noSettlement, true)
  assert.equal(plan.trustAndSafety.noSettlement.canSettle, false)
  assert.equal(plan.trustAndSafety.noSettlement.rule.includes('context-only'), true)
  assert.deepEqual(plan.normalizedEntityTypes, ['social-post'])
  assert.equal(plan.sources.length > 0, true)
  plan.sources.forEach(source => {
    assert.equal(source.settlementTier, 'context-only')
  })
})

test('aggregator routes cover every catalog fit with seed tags', () => {
  const plan = socialFeedAggregator.createSocialFeedAggregatorPlan()
  const routeFitIds = new Set(plan.routes.map(route => route.fitId))

  catalog.listEventFits().forEach(fit => {
    assert.equal(routeFitIds.has(fit.fitId), true, `${fit.fitId} missing from social feed routes`)
  })
  plan.routes.forEach(route => {
    assert.equal(route.settlementTier, 'context-only')
    assert.ok(route.seedTags.length > 0, `${route.fitId} has no seed tags`)
    assert.equal(route.moderationPolicy.required, true)
    assert.deepEqual(route.moderationPolicy.userControls, ['mute', 'block', 'hide-source', 'report'])
  })
})

test('passing a non-context-only settlement tier to aggregator throws', () => {
  assert.throws(
    () => socialFeedAggregator.createSocialFeedAggregatorPlan({ settlementTier: 'source-of-truth' }),
    /settlementTier must be one of: context-only/
  )
})

test('normalizeSocialPost produces a correct social-post envelope', () => {
  const post = socialFeedAggregator.normalizeSocialPost({
    sourceId: 'nostr-relays',
    externalId: 'nostr-event-abc123',
    text: 'Great match! #worldcup',
    author: { handle: 'soccerfan', pubkeyOrDid: 'pk-abc', verified: true },
    createdAt: '2026-07-07T12:00:00Z',
    payload: { id: 'nostr-event-abc123', content: 'Great match! #worldcup', pubkey: 'pk-abc' }
  })

  assert.equal(post.sourceId, 'nostr-relays')
  assert.equal(post.protocol, 'nostr')
  assert.equal(post.externalId, 'nostr-event-abc123')
  assert.equal(post.text, 'Great match! #worldcup')
  assert.equal(post.author.handle, 'soccerfan')
  assert.equal(post.author.verified, true)
  assert.equal(post.settlementTier, 'context-only')
  assert.equal(post.canSettle, false)
  assert.ok(post.payloadHash.length > 0)
  assert.ok(post.postId.startsWith('social-post-nostr-relays-'))
  assert.equal(post.moderation.state, 'allowed')
  assert.equal(post.canRender, true)
  assert.equal(post.topicTags.includes('#worldcup'), true)
  assert.equal(post.eventTags.category, 'soccer')
})

test('normalizeSocialPost maps topic tags to event categories', () => {
  const uclPost = socialFeedAggregator.normalizeSocialPost({
    sourceId: 'bluesky-atproto',
    externalId: 'at://post/xyz',
    text: 'What a goal! #ucl #championsleague',
    payload: { text: 'What a goal! #ucl #championsleague' }
  })
  const ufcPost = socialFeedAggregator.normalizeSocialPost({
    sourceId: 'mastodon-instances',
    externalId: 'mastodon-status-1',
    text: 'Incredible knockout! #ufc #mma',
    payload: { content: 'Incredible knockout! #ufc #mma' }
  })
  const untaggedPost = socialFeedAggregator.normalizeSocialPost({
    sourceId: 'nostr-relays',
    externalId: 'nostr-event-2',
    text: 'Hello world',
    payload: { content: 'Hello world' }
  })

  assert.equal(uclPost.eventTags.category, 'soccer')
  assert.equal(ufcPost.eventTags.category, 'combat-sports')
  assert.equal(untaggedPost.eventTags.category, null)
})

test('normalizeSocialPost rejects unknown sources', () => {
  assert.throws(
    () => socialFeedAggregator.normalizeSocialPost({
      sourceId: 'unknown-source',
      externalId: 'test',
      text: 'hello'
    }),
    /unknown social-feed source/
  )
})

test('text is sanitized and length-capped', () => {
  const longText = 'A'.repeat(600)
  const post = socialFeedAggregator.normalizeSocialPost({
    sourceId: 'nostr-relays',
    externalId: 'long-post',
    text: longText,
    payload: { content: longText }
  })
  assert.equal(post.text.length, 500)
  assert.equal(post.text.endsWith('…'), true)
})

test('moderation scoring hides spam, abuse, nsfw, and misinfo', () => {
  const clean = socialFeedAggregator.scoreModeration({ text: 'What a great match!' })
  const spam = socialFeedAggregator.scoreModeration({ text: 'Free BTC giveaway! Claim your bonus now!' })
  const abuse = socialFeedAggregator.scoreModeration({ text: 'kill yourself you trash' })
  const nsfw = socialFeedAggregator.scoreModeration({ text: 'this is NSFW porn content' })
  const misinfo = socialFeedAggregator.scoreModeration({ text: 'the match is fixed, referee was paid' })

  assert.equal(clean.state, 'allowed')
  assert.equal(clean.score, 0)
  assert.equal(spam.state, 'hidden')
  assert.ok(spam.reasons.length > 0)
  assert.equal(abuse.state, 'hidden')
  assert.equal(nsfw.state, 'hidden')
  assert.equal(misinfo.state, 'hidden')
})

test('dedupeSocialPosts removes duplicates by payloadHash', () => {
  const post1 = socialFeedAggregator.normalizeSocialPost({
    sourceId: 'nostr-relays',
    externalId: 'event-1',
    text: 'hello',
    payload: { content: 'hello' }
  })
  const post2 = socialFeedAggregator.normalizeSocialPost({
    sourceId: 'nostr-relays',
    externalId: 'event-2',
    text: 'world',
    payload: { content: 'world' }
  })
  const dup = socialFeedAggregator.normalizeSocialPost({
    sourceId: 'nostr-relays',
    externalId: 'event-1-dup',
    text: 'hello',
    payload: { content: 'hello' }
  })

  const deduped = socialFeedAggregator.dedupeSocialPosts([post1, post2, dup])
  assert.equal(deduped.length, 2)
  assert.equal(deduped[0].payloadHash, post1.payloadHash)
})

test('filterRenderable only returns allowed posts', () => {
  const allowed = socialFeedAggregator.normalizeSocialPost({
    sourceId: 'nostr-relays',
    externalId: 'clean-post',
    text: 'Great game!',
    payload: { content: 'Great game!' }
  })
  const hidden = socialFeedAggregator.normalizeSocialPost({
    sourceId: 'nostr-relays',
    externalId: 'spam-post',
    text: 'Free BTC giveaway! Claim your bonus now!',
    payload: { content: 'Free BTC giveaway! Claim your bonus now!' }
  })

  const renderable = socialFeedAggregator.filterRenderable([allowed, hidden])
  assert.equal(renderable.length, 1)
  assert.equal(renderable[0].externalId, 'clean-post')
})

test('rateLimitByAuthor caps posts per author per window', () => {
  const baseTime = Date.parse('2026-07-07T12:00:00Z')
  const posts = []
  for (let i = 0; i < 10; i++) {
    posts.push(socialFeedAggregator.normalizeSocialPost({
      sourceId: 'nostr-relays',
      externalId: `event-${i}`,
      text: `post ${i}`,
      author: { pubkeyOrDid: 'same-author' },
      createdAt: new Date(baseTime + i * 1000).toISOString(),
      payload: { content: `post ${i}` }
    }))
  }
  const limited = socialFeedAggregator.rateLimitByAuthor(posts, { maxPerWindow: 3, windowMs: 60000 })
  assert.equal(limited.length, 3)
})

test('prize proximity guard flags social-post fields flowing into settlement commands', () => {
  const post = socialFeedAggregator.normalizeSocialPost({
    sourceId: 'nostr-relays',
    externalId: 'event-1',
    text: 'hello',
    payload: { content: 'hello' }
  })

  const leakCheck = socialFeedAggregator.assertNoSettlementLeak({
    type: 'pool:settle',
    payload: { socialPost: post }
  })
  assert.equal(leakCheck.ok, false)
  assert.equal(leakCheck.leaked, true)
  assert.equal(leakCheck.commandType, 'pool:settle')

  const cleanCheck = socialFeedAggregator.assertNoSettlementLeak({
    type: 'pool:settle',
    payload: { resultId: 'result-1' }
  })
  assert.equal(cleanCheck.ok, true)
  assert.equal(cleanCheck.leaked, false)

  const nonSettlementCheck = socialFeedAggregator.assertNoSettlementLeak({
    type: 'social:subscribe',
    payload: { posts: [post] }
  })
  assert.equal(nonSettlementCheck.ok, true)
})

test('prize proximity guard flags social-post fields flowing into guarded engines', () => {
  const post = socialFeedAggregator.normalizeSocialPost({
    sourceId: 'nostr-relays',
    externalId: 'event-1',
    text: 'hello',
    payload: { content: 'hello' }
  })

  const leak = socialFeedAggregator.assertNoPrizeProximityLeak('settlement-engine', { posts: [post] })
  assert.equal(leak.ok, false)
  assert.equal(leak.guarded, true)

  const safe = socialFeedAggregator.assertNoPrizeProximityLeak('surface-engine', { posts: [post] })
  assert.equal(safe.ok, true)
  assert.equal(safe.guarded, false)

  const cleanGuarded = socialFeedAggregator.assertNoPrizeProximityLeak('qvac-engine', { resultId: 'r1' })
  assert.equal(cleanGuarded.ok, true)
  assert.equal(cleanGuarded.guarded, true)
})

test('platform facade exposes aggregator, normalization, and guard helpers', () => {
  const app = platform.createUltimateSportsPlatform()
  const plan = app.createSocialFeedAggregatorPlan()
  const route = app.socialFeedRouteForFit('world-cup')
  const post = app.normalizeSocialPost({
    sourceId: 'nostr-relays',
    externalId: 'facade-post',
    text: 'test',
    payload: { content: 'test' }
  })
  const leak = app.assertNoSocialFeedSettlementLeak({ type: 'pool:settle', payload: { postId: post.postId } })

  assert.equal(plan.settlementTier, 'context-only')
  assert.equal(route.fitId, 'world-cup')
  assert.equal(post.canSettle, false)
  assert.equal(leak.ok, false)
})

test('ingestion pipeline has moderation before renderer publish', () => {
  const plan = socialFeedAggregator.createSocialFeedAggregatorPlan()
  const stepIds = plan.ingestionPipeline.map(step => step.stepId)
  assert.equal(stepIds.includes('moderate'), true)
  assert.equal(stepIds.includes('publish-buffer'), true)
  assert.equal(stepIds.indexOf('moderate') < stepIds.indexOf('publish-buffer'), true)
  assert.equal(stepIds[stepIds.length - 1], 'renderer-display')
  assert.equal(plan.ingestionPipeline[stepIds.length - 1].owner, 'renderer')
})
