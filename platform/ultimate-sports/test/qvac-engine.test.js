'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { bridge, eventLog, feed, platform, qvac } = require('../src')

function soccerFrame () {
  const adapter = feed.createFeedAdapter({
    adapterId: 'qvac-feed',
    kind: 'soccer',
    competitionId: 'qvac-cup',
    sourcePolicy: 'official-feed'
  })
  return feed.createFeedFrame({
    adapter,
    frameId: 'qvac-frame-1',
    fixtureId: 'final',
    frameType: 'event',
    sequence: 1,
    clock: { minute: 12 },
    events: [
      {
        eventId: 'qvac-goal',
        type: 'goal',
        clock: "12'",
        value: { team: 'Red FC' }
      }
    ],
    createdAt: '2026-07-03T18:12:00.000Z'
  })
}

test('QVAC room summaries and commentary bind text to replay evidence', () => {
  const frame = soccerFrame()
  const evidenceEvent = eventLog.createEventEnvelope({
    type: 'FeedFrameRecorded',
    actorId: 'feed',
    occurredAt: '2026-07-03T18:12:00.000Z',
    payload: frame
  })
  const summary = qvac.createRoomSummary({
    room: {
      roomId: 'qvac-room',
      competitionId: 'qvac-cup',
      title: 'Final watch room'
    },
    feedFrames: [frame],
    evidenceEvents: [evidenceEvent],
    createdAt: '2026-07-03T18:13:00.000Z'
  })
  const commentary = qvac.createCommentaryFrame({
    roomId: 'qvac-room',
    feedFrame: frame,
    evidenceEvents: [evidenceEvent],
    createdAt: '2026-07-03T18:13:30.000Z'
  })

  assert.equal(summary.status, 'ready')
  assert.equal(summary.lane, 'room-summary')
  assert.equal(summary.evidenceEventIds[0], evidenceEvent.eventId)
  assert.equal(summary.body.guardrails.officialResultsInvented, false)
  assert.match(summary.text, /Feed goal recorded/)
  assert.equal(qvac.verifyQvacRecord({ record: summary, evidenceEvents: [evidenceEvent] }).ok, true)
  assert.equal(qvac.qvacGate(summary).ok, true)

  assert.equal(commentary.lane, 'commentary')
  assert.deepEqual(commentary.body.sourceFeedEventIds, ['qvac-goal'])
  assert.match(commentary.text, /goal/)
  assert.match(commentary.text, /Red FC/)
})

test('QVAC assistant drafts, trivia banks, and moderation preserve guardrails', () => {
  const draft = qvac.createCreatorAssistantDraft({
    organizerId: 'creator-host',
    templateKind: 'awards-card',
    title: 'Friday Awards Night',
    poolVariants: ['confidence', 'watch-party-bingo'],
    miniGames: ['trivia-duel'],
    sourceFacts: [{ factId: 'category-count', answer: 12 }],
    createdAt: '2026-07-03T19:00:00.000Z'
  })
  const heldBank = qvac.createTriviaQuestionBank({
    targetType: 'competition',
    targetId: 'awards-night',
    mode: 'sponsor-prize',
    questions: [
      { prompt: 'Who won last year?', answer: 'Nominee A' }
    ]
  })
  const readyBank = qvac.createTriviaQuestionBank({
    targetType: 'competition',
    targetId: 'awards-night',
    mode: 'sponsor-prize',
    verified: true,
    sourceFacts: [
      {
        factId: 'winner-2025',
        prompt: 'Who won last year?',
        answer: 'Nominee A'
      }
    ]
  })
  const review = qvac.createModerationReview({
    body: 'FREE money available at http://example.invalid send funds now',
    createdAt: '2026-07-03T19:05:00.000Z'
  })

  assert.equal(draft.status, 'ready')
  assert.equal(draft.body.templateConfig.kind, 'awards-card')
  assert.equal(draft.body.guardrails.officialResultsInvented, false)
  assert.equal(draft.body.checklist.includes('verify-trivia-bank'), true)

  assert.equal(heldBank.status, 'held')
  assert.equal(heldBank.body.prizeEligible, false)
  assert.equal(readyBank.status, 'ready')
  assert.equal(readyBank.body.prizeEligible, true)
  assert.equal(readyBank.body.questions[0].sourceFactId, 'winner-2025')

  assert.equal(review.body.severity, 'high')
  assert.equal(review.body.recommendedAction, 'hide-message')
  assert.equal(review.body.labels.includes('financial-risk'), true)
  assert.equal(review.body.labels.includes('external-link'), true)
})

test('QVAC result evidence referee reviews social and web sources for combat cards', () => {
  const readyReview = qvac.createResultEvidenceReview({
    targetType: 'fixture',
    targetId: 'bareknuckle-main-event',
    title: 'Bareknuckle Main Event',
    claimedWinner: 'Mika Stone',
    evidenceItems: [
      {
        sourceKind: 'verified-social',
        sourceName: 'promotion account',
        sourceUrl: 'https://social.example.invalid/post/1',
        claimedWinner: 'Mika Stone',
        method: 'decision',
        round: 5
      },
      {
        sourceKind: 'web-search',
        sourceName: 'search result',
        sourceUrl: 'https://search.example.invalid/result/2',
        claimedWinner: 'Mika Stone',
        method: 'decision',
        round: 5
      }
    ],
    createdAt: '2026-07-04T00:00:00.000Z'
  })
  const heldReview = qvac.createResultEvidenceReview({
    targetType: 'fixture',
    targetId: 'kickboxing-co-main',
    claimedWinner: 'Blue Corner',
    evidenceItems: [
      {
        sourceKind: 'social',
        sourceUrl: 'https://social.example.invalid/post/2',
        claimedWinner: 'Blue Corner'
      },
      {
        sourceKind: 'web-search',
        sourceUrl: 'https://search.example.invalid/result/3',
        claimedWinner: 'Red Corner'
      }
    ],
    createdAt: '2026-07-04T00:00:00.000Z'
  })

  assert.equal(readyReview.lane, 'result-evidence')
  assert.equal(readyReview.status, 'ready')
  assert.equal(readyReview.body.consensusWinner, 'Mika Stone')
  assert.equal(readyReview.body.method, 'decision')
  assert.equal(readyReview.body.sourceSummary.verifiedSocial, 1)
  assert.equal(readyReview.body.sourceSummary.searchResults, 1)
  assert.equal(readyReview.body.guardrails.socialEvidenceRequiresCorroboration, true)
  assert.equal(qvac.qvacGate(readyReview).ok, true)

  assert.equal(heldReview.status, 'held')
  assert.equal(heldReview.body.blockers.includes('conflicting winner claims require manual review'), true)
  assert.equal(qvac.qvacGate(heldReview).ok, false)
})

test('runtime replays QVAC records into watch, creator, settings, and bridge surfaces', () => {
  const app = platform.createUltimateSportsPlatform({ peerId: 'host' })
  app.applyScenario('soccer-knockout', {
    competitionId: 'qvac-runtime-cup',
    poolId: 'qvac-runtime-pool',
    roomId: 'qvac-runtime-room'
  })
  const adapterEvent = app.dispatch({
    type: 'feed:registerAdapter',
    actorId: 'feed',
    occurredAt: '2026-07-03T20:00:00.000Z',
    payload: {
      adapterId: 'qvac-runtime-feed',
      kind: 'soccer',
      competitionId: 'qvac-runtime-cup',
      sourcePolicy: 'official-feed'
    }
  })
  const frameEvent = app.dispatch({
    type: 'feed:recordFrame',
    actorId: 'feed',
    occurredAt: '2026-07-03T20:01:00.000Z',
    payload: {
      adapterId: adapterEvent.payload.adapterId,
      frameId: 'qvac-runtime-frame',
      fixtureId: 'final',
      frameType: 'event',
      sequence: 1,
      events: [
        {
          eventId: 'qvac-runtime-goal',
          type: 'goal',
          clock: "15'",
          value: { team: 'Red FC' }
        }
      ]
    }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'user-a',
    occurredAt: '2026-07-03T20:02:00.000Z',
    payload: {
      roomId: 'qvac-runtime-room',
      username: 'User A'
    }
  })
  const messageEvent = app.dispatch({
    type: 'room:chat',
    actorId: 'user-a',
    occurredAt: '2026-07-03T20:03:00.000Z',
    payload: {
      roomId: 'qvac-runtime-room',
      body: 'FREE money at http://example.invalid'
    }
  })
  const commentaryEvent = app.dispatch({
    type: 'qvac:createCommentary',
    actorId: 'qvac-commentator',
    occurredAt: '2026-07-03T20:04:00.000Z',
    payload: {
      roomId: 'qvac-runtime-room',
      frameId: frameEvent.payload.frameId
    }
  })
  const summaryEvent = app.dispatch({
    type: 'qvac:summarizeRoom',
    actorId: 'qvac-commentator',
    occurredAt: '2026-07-03T20:05:00.000Z',
    payload: {
      roomId: 'qvac-runtime-room'
    }
  })
  const reviewEvent = app.dispatch({
    type: 'qvac:reviewMessage',
    actorId: 'host',
    occurredAt: '2026-07-03T20:06:00.000Z',
    payload: {
      messageId: messageEvent.payload.messageId
    }
  })
  const draftEvent = app.dispatch({
    type: 'qvac:createCreatorDraft',
    actorId: 'creator-host',
    occurredAt: '2026-07-03T20:07:00.000Z',
    payload: {
      templateKind: 'fight-card',
      title: 'Local Fight Night',
      poolVariants: ['confidence'],
      miniGames: ['trivia-duel']
    }
  })
  const bankEvent = app.dispatch({
    type: 'qvac:createTriviaBank',
    actorId: 'creator-host',
    occurredAt: '2026-07-03T20:08:00.000Z',
    payload: {
      targetType: 'competition',
      targetId: 'qvac-runtime-cup',
      mode: 'sponsor-prize',
      questions: [
        { prompt: 'Who scored first?', answer: 'Red FC' }
      ]
    }
  })
  const resultReviewEvent = app.dispatch({
    type: 'qvac:reviewResultEvidence',
    actorId: 'combat-referee',
    occurredAt: '2026-07-03T20:09:00.000Z',
    payload: {
      targetType: 'fixture',
      targetId: 'qvac-fight-main',
      claimedWinner: 'Mika Stone',
      evidenceItems: [
        {
          sourceKind: 'verified-social',
          sourceUrl: 'https://social.example.invalid/post/1',
          claimedWinner: 'Mika Stone'
        },
        {
          sourceKind: 'web-search',
          sourceUrl: 'https://search.example.invalid/result/2',
          claimedWinner: 'Mika Stone'
        }
      ]
    }
  })
  const handler = bridge.createBridgeHandler({ platform: app })
  const bridgedWatch = handler.handle(bridge.createBridgeRequest({
    action: 'createSurface',
    payload: {
      surfaceId: 'watch',
      input: { userId: 'host' }
    }
  }))

  const view = app.view()
  const watch = app.createSurface('watch', { userId: 'host' })
  const creator = app.createSurface('creator', { userId: 'creator-host' })
  const settings = app.createSurface('settings', { userId: 'user-a' })

  assert.equal(view.qvacRecords[summaryEvent.payload.qvacRecordId].lane, 'room-summary')
  assert.equal(view.qvacCommentaryFrames[commentaryEvent.payload.qvacRecordId].body.sourceFeedEventIds[0], 'qvac-runtime-goal')
  assert.equal(view.qvacModerationReviews[reviewEvent.payload.qvacRecordId].body.recommendedAction, 'hide-message')
  assert.equal(view.qvacCreatorDrafts[draftEvent.payload.qvacRecordId].body.templateConfig.kind, 'fight-card')
  assert.equal(view.qvacTriviaBanks[bankEvent.payload.qvacRecordId].status, 'held')
  assert.equal(view.qvacResultEvidenceReviews[resultReviewEvent.payload.qvacRecordId].status, 'ready')
  assert.deepEqual(view.qvacRoomSummariesByRoom['qvac-runtime-room'], [summaryEvent.payload.qvacRecordId])

  assert.equal(watch.qvacSummaries[0].roomId, 'qvac-runtime-room')
  assert.equal(watch.qvacCommentary[0].sourceFeedEventIds[0], 'qvac-runtime-goal')
  assert.equal(watch.qvacResultEvidence[0].consensusWinner, 'Mika Stone')
  assert.equal(creator.assistantDrafts[0].templateKind, 'fight-card')
  assert.equal(creator.triviaBanks[0].status, 'held')
  assert.equal(settings.moderationReviews[0].recommendedAction, 'hide-message')
  assert.equal(bridgedWatch.ok, true)
  assert.equal(bridgedWatch.result.qvacSummaries[0].qvacRecordId, summaryEvent.payload.qvacRecordId)
})
