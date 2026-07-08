'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  catalog,
  platform,
  socialFeedAggregator,
  socialFeedClients
} = require('../src')

test('social feed client plan creates clients for every non-deferred source', () => {
  const plan = socialFeedClients.createSocialFeedClientPlan({ env: {} })
  const sourceIds = socialFeedAggregator.createSocialFeedAggregatorPlan().sources.map(s => s.sourceId)
  const clientIds = new Set(plan.clients.map(client => client.sourceId))

  sourceIds.forEach(sourceId => {
    assert.equal(clientIds.has(sourceId), true, `${sourceId} missing client`)
  })
  assert.equal(plan.serverOnly, true)
  assert.equal(plan.noClientSecrets, true)
  assert.equal(plan.noSettlement, true)
  assert.equal(plan.coverage.sourcesWithClients, plan.clients.length)
  assert.equal(plan.coverage.websocketClients, 1)
  assert.equal(plan.coverage.localActivityClients, 1)
  assert.equal(plan.coverage.readyApiClients, 2)
})

test('credential readiness reports missing env without exposing values', () => {
  const missing = socialFeedClients.credentialReadinessForSource('bluesky-atproto', {})
  const ready = socialFeedClients.credentialReadinessForSource('bluesky-atproto', {
    BLUESKY_HANDLE: 'user.bsky.social',
    BLUESKY_APP_PASSWORD: 'secret-value'
  })
  const nostrReady = socialFeedClients.credentialReadinessForSource('nostr-relays', {})

  assert.equal(missing.ready, false)
  assert.deepEqual(missing.missingEnv, ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'])
  assert.equal(ready.ready, true)
  assert.deepEqual(ready.presentEnv, ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'])
  assert.equal(JSON.stringify(ready).includes('secret-value'), false)
  assert.equal(nostrReady.ready, true)
  assert.deepEqual(nostrReady.missingEnv, [])
})

test('nostr subscription plan uses wsImpl and is keyless-ready', () => {
  const plan = socialFeedClients.createSocialFeedRequestPlan({
    fitId: 'world-cup',
    operation: 'social-post:subscribe',
    env: {}
  })

  assert.equal(plan.sourceId, 'nostr-relays')
  assert.equal(plan.clientKind, 'websocket-relay')
  assert.equal(plan.ready, true)
  assert.ok(plan.relays.length > 0)
  assert.ok(plan.filters.hashtags.includes('#worldcup'))
  assert.equal(plan.canSettleCandidate, false)
  assert.equal(plan.redacted, true)
  assert.ok(plan.subscriptionId.length > 0)
})

test('bluesky request plan is redacted and server-only', () => {
  const plan = socialFeedClients.createSocialFeedRequestPlan({
    sourceId: 'bluesky-atproto',
    operation: 'social-post:list',
    params: { q: 'world cup', limit: 20 },
    env: {
      BLUESKY_HANDLE: 'user.bsky.social',
      BLUESKY_APP_PASSWORD: 'do-not-serialize'
    }
  })

  assert.equal(plan.sourceId, 'bluesky-atproto')
  assert.equal(plan.clientKind, 'http-json')
  assert.equal(plan.ready, true)
  assert.equal(plan.serverOnly, true)
  assert.equal(plan.url.includes('/xrpc/app.bsky.feed.searchPosts'), true)
  assert.equal(plan.url.includes('q=world%20cup'), true)
  assert.equal(plan.headers['Bluesky-Handle'], '<redacted:BLUESKY_HANDLE>')
  assert.equal(plan.headers['Bluesky-App-Password'], '<redacted:BLUESKY_APP_PASSWORD>')
  assert.equal(JSON.stringify(plan).includes('do-not-serialize'), false)
  assert.equal(plan.canSettleCandidate, false)
})

test('mastodon request plan works with or without token', () => {
  const noToken = socialFeedClients.createSocialFeedRequestPlan({
    sourceId: 'mastodon-instances',
    operation: 'social-post:list',
    params: { tag: 'worldcup' },
    env: {}
  })
  const withToken = socialFeedClients.createSocialFeedRequestPlan({
    sourceId: 'mastodon-instances',
    operation: 'social-post:list',
    params: { tag: 'worldcup' },
    env: { MASTODON_ACCESS_TOKEN: 'secret-token' }
  })

  assert.equal(noToken.ready, true)
  assert.equal(noToken.url.includes('/api/v1/timelines/tag/worldcup'), true)
  assert.equal(noToken.headers.Authorization, undefined)

  assert.equal(withToken.ready, true)
  assert.equal(withToken.headers.Authorization, 'Bearer <redacted:MASTODON_ACCESS_TOKEN>')
  assert.equal(JSON.stringify(withToken).includes('secret-token'), false)
})

test('request plans support every catalog fit primary source', () => {
  catalog.listEventFits().forEach(fit => {
    const route = socialFeedAggregator.aggregatorRouteForFit(fit.fitId)
    const plan = socialFeedClients.createSocialFeedRequestPlan({
      fitId: fit.fitId,
      env: fakeEnvFor(route.primarySourceId)
    })

    assert.equal(plan.sourceId, route.primarySourceId)
    assert.equal(plan.serverOnly, route.primarySourceId !== 'native-activity')
    assert.equal(plan.canSettleCandidate, false)
    assert.equal(plan.settlementTier, 'context-only')
  })
})

test('executeSocialFeedRequest uses injected wsImpl for nostr and normalizes posts', async () => {
  const requestPlan = socialFeedClients.createSocialFeedRequestPlan({
    sourceId: 'nostr-relays',
    operation: 'social-post:subscribe',
    params: { hashtags: ['#worldcup'] },
    env: {}
  })
  const executed = await socialFeedClients.executeSocialFeedRequest({
    requestPlan,
    wsImpl: async ({ relays, filters }) => {
      assert.ok(relays.length > 0)
      assert.ok(filters.hashtags.includes('#worldcup'))
      return [
        { id: 'nostr-evt-1', content: 'Great goal! #worldcup', pubkey: 'pk-abc', created_at: 1700000000 },
        { id: 'nostr-evt-2', content: 'Free BTC giveaway! Claim your bonus!', pubkey: 'pk-spam', created_at: 1700000001 }
      ]
    }
  })

  assert.equal(executed.ok, true)
  assert.equal(executed.status, 'subscribed')
  assert.equal(executed.posts.length, 2)
  assert.equal(executed.posts[0].sourceId, 'nostr-relays')
  assert.equal(executed.posts[0].externalId, 'nostr-evt-1')
  assert.equal(executed.posts[0].settlementTier, 'context-only')
  assert.equal(executed.posts[0].canSettle, false)
  assert.equal(executed.posts[1].moderation.state, 'hidden')
})

test('executeSocialFeedRequest uses injected fetchImpl for HTTP clients', async () => {
  const requestPlan = socialFeedClients.createSocialFeedRequestPlan({
    sourceId: 'bluesky-atproto',
    operation: 'social-post:list',
    params: { q: 'world cup' },
    env: {
      BLUESKY_HANDLE: 'user.bsky.social',
      BLUESKY_APP_PASSWORD: 'secret'
    }
  })
  const executed = await socialFeedClients.executeSocialFeedRequest({
    requestPlan,
    fetchImpl: async (url, options) => {
      assert.equal(url.includes('/xrpc/app.bsky.feed.searchPosts'), true)
      assert.equal(options.headers.Accept, 'application/json')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          posts: [
            {
              uri: 'at://post/1',
              author: { handle: 'fan', displayName: 'Soccer Fan' },
              record: { text: 'Amazing goal! #worldcup', createdAt: '2026-07-07T12:00:00Z' }
            }
          ]
        })
      }
    }
  })

  assert.equal(executed.ok, true)
  assert.equal(executed.posts.length, 1)
  assert.equal(executed.posts[0].sourceId, 'bluesky-atproto')
  assert.equal(executed.posts[0].externalId, 'at://post/1')
  assert.equal(executed.posts[0].text, 'Amazing goal! #worldcup')
  assert.equal(executed.posts[0].author.handle, 'fan')
  assert.equal(executed.posts[0].eventTags.category, 'soccer')
  assert.equal(executed.posts[0].canSettle, false)
})

test('executeSocialFeedRequest native-activity returns local lane', async () => {
  const requestPlan = socialFeedClients.createSocialFeedRequestPlan({
    sourceId: 'native-activity',
    env: {}
  })
  const executed = await socialFeedClients.executeSocialFeedRequest({ requestPlan })

  assert.equal(executed.ok, true)
  assert.equal(executed.status, 'local-activity-lane')
  assert.equal(executed.posts.length, 0)
})

test('platform facade exposes social feed client helpers', () => {
  const app = platform.createUltimateSportsPlatform()
  const plan = app.createSocialFeedClientPlan({ env: {} })
  const client = app.socialFeedSourceClientFor('nostr-relays')
  const readiness = app.socialFeedCredentialReadinessForSource('bluesky-atproto', {})
  const request = app.createSocialFeedRequestPlan({
    sourceId: 'nostr-relays',
    env: {}
  })

  assert.equal(plan.coverage.websocketClients, 1)
  assert.equal(client.clientKind, 'websocket-relay')
  assert.equal(readiness.ready, false)
  assert.equal(request.sourceId, 'nostr-relays')
  assert.equal(request.ready, true)
})

test('no client request plan ever exposes canSettleCandidate as true', () => {
  const plan = socialFeedClients.createSocialFeedClientPlan({ env: {} })
  plan.clients.forEach(client => {
    const request = socialFeedClients.createSocialFeedRequestPlan({
      sourceId: client.sourceId,
      env: fakeEnvFor(client.sourceId)
    })
    assert.equal(request.canSettleCandidate, false, `${client.sourceId} has canSettleCandidate=true`)
    assert.equal(request.settlementTier, 'context-only')
  })
})

function fakeEnvFor (sourceId) {
  return {
    'nostr-relays': {},
    'bluesky-atproto': { BLUESKY_HANDLE: 'user', BLUESKY_APP_PASSWORD: 'pass' },
    'mastodon-instances': { MASTODON_ACCESS_TOKEN: 'token' },
    'native-activity': {},
    'relay-mainstream': { MAINSTREAM_RELAY_API_KEY: 'key', MAINSTREAM_RELAY_BASE_URL: 'https://relay.invalid' }
  }[sourceId] || {}
}
