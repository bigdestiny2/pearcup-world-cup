'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  catalog,
  platform,
  socialFeedProviders
} = require('../src')

test('social feed provider plan declares every source as context-only', () => {
  const plan = socialFeedProviders.createSocialFeedProviderPlan()

  const sourceIds = new Set(plan.sources.map(source => source.sourceId))
  ;['nostr-relays', 'bluesky-atproto', 'mastodon-instances', 'native-activity'].forEach(sourceId => {
    assert.equal(sourceIds.has(sourceId), true, `${sourceId} missing from provider plan`)
  })
  assert.equal(plan.sources.some(s => s.sourceId === 'relay-mainstream'), false)
  plan.sources.forEach(source => {
    assert.equal(source.settlementTier, 'context-only', `${source.sourceId} is not context-only`)
    assert.equal(source.deferred, false, `${source.sourceId} should not be deferred by default`)
  })
  assert.equal(plan.recommendation.primarySourceId, 'nostr-relays')
  assert.equal(plan.recommendation.backboneSourceId, 'native-activity')
  assert.deepEqual(plan.recommendation.secondarySourceIds, ['bluesky-atproto', 'mastodon-instances'])
  assert.deepEqual(plan.recommendation.deferredSourceIds, ['relay-mainstream'])
})

test('includeDeferred surfaces the mainstream relay source', () => {
  const plan = socialFeedProviders.createSocialFeedProviderPlan({ includeDeferred: true })
  const sourceIds = plan.sources.map(source => source.sourceId)
  assert.equal(sourceIds.includes('relay-mainstream'), true)
  const relay = plan.sources.find(source => source.sourceId === 'relay-mainstream')
  assert.equal(relay.deferred, true)
  assert.equal(relay.keyless, false)
  assert.equal(relay.auth, 'server-side-keys')
})

test('passing a non-context-only settlement tier throws', () => {
  assert.throws(
    () => socialFeedProviders.createSocialFeedProviderPlan({ settlementTier: 'source-of-truth' }),
    /settlementTier must be one of: context-only/
  )
  assert.throws(
    () => socialFeedProviders.createSocialFeedProviderPlan({ settlementTier: 'evidence-review' }),
    /settlementTier must be one of: context-only/
  )
})

test('provider plan covers every catalog fit with at least one source', () => {
  const plan = socialFeedProviders.createSocialFeedProviderPlan()
  const fitIds = new Set(plan.fits.map(fit => fit.fitId))

  catalog.listEventFits().forEach(fit => {
    assert.equal(fitIds.has(fit.fitId), true, `${fit.fitId} missing from social feed provider plan`)
  })
  plan.fits.forEach(fit => {
    assert.equal(fit.settlementTier, 'context-only', `${fit.fitId} is not context-only`)
    assert.ok(fit.sourceIds.length > 0, `${fit.fitId} has no sources`)
    assert.equal(fit.sourceIds.includes(fit.primarySourceId), true)
  })
})

test('specialized source mappings route decentralized and native-first correctly', () => {
  const worldCup = socialFeedProviders.providerPlanForFit('world-cup')
  const mma = socialFeedProviders.providerPlanForFit('mma-boxing-fight-card')
  const creator = socialFeedProviders.providerPlanForFit('creator-reality-brackets')
  const awards = socialFeedProviders.providerPlanForFit('awards-prediction-pools')
  const local = socialFeedProviders.providerPlanForFit('local-leagues')

  assert.equal(worldCup.primarySourceId, 'nostr-relays')
  assert.equal(worldCup.sourceIds.includes('native-activity'), true)
  assert.equal(worldCup.sourceIds.includes('bluesky-atproto'), true)

  assert.equal(mma.primarySourceId, 'nostr-relays')
  assert.equal(mma.sourceIds.includes('native-activity'), true)

  assert.equal(creator.primarySourceId, 'native-activity')
  assert.equal(awards.primarySourceId, 'native-activity')
  assert.equal(local.primarySourceId, 'native-activity')
  assert.equal(local.sourceIds.includes('mastodon-instances'), true)
})

test('deferred mainstream source never appears in default fit plans', () => {
  catalog.listEventFits().forEach(fit => {
    const fitPlan = socialFeedProviders.providerPlanForFit(fit.fitId)
    assert.equal(fitPlan.sourceIds.includes('relay-mainstream'), false, `${fit.fitId} includes deferred relay-mainstream`)
  })
})

test('platform facade exposes social feed provider helpers', () => {
  const app = platform.createUltimateSportsPlatform()
  const plan = app.createSocialFeedProviderPlan()
  const fitPlan = app.socialFeedProviderPlanForFit('world-cup')

  assert.equal(plan.recommendation.primarySourceId, 'nostr-relays')
  assert.equal(fitPlan.primarySourceId, 'nostr-relays')
  assert.equal(fitPlan.settlementTier, 'context-only')
})

test('nostr is keyless and native-activity requires no auth', () => {
  const sources = Object.values(socialFeedProviders.SOURCES)
  const nostr = sources.find(s => s.sourceId === 'nostr-relays')
  const native = sources.find(s => s.sourceId === 'native-activity')

  assert.equal(nostr.keyless, true)
  assert.equal(nostr.auth, 'none')
  assert.equal(nostr.transport, 'websocket-relay')

  assert.equal(native.keyless, true)
  assert.equal(native.auth, 'n/a')
  assert.equal(native.transport, 'in-app-event-bridge')
})
