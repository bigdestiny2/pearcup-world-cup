'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { engagement, game, platform } = require('../src')

function demoSession (gameId = 'engagement-game') {
  return game.createPeerGameSession({
    gameId,
    gameType: 'trivia-duel',
    roomId: 'engagement-room',
    players: ['alice', 'bob'],
    spectators: ['viewer'],
    stakeMode: 'demo'
  })
}

function demoResolution (gameId = 'engagement-game', winner = 'alice') {
  return {
    resultId: `${gameId}:result`,
    gameId,
    gameType: 'trivia-duel',
    winnerUserIds: [winner],
    tied: false,
    rows: [
      { userId: winner, score: 2, tieBreak: 800, detail: [] },
      { userId: winner === 'alice' ? 'bob' : 'alice', score: 1, tieBreak: 1200, detail: [] }
    ],
    resultHash: `${gameId}:hash`,
    resolvedAt: '2026-07-03T21:00:00.000Z'
  }
}

test('engagement engine creates spectator replay, ladder, rematch, share cards, gallery, and calendar', () => {
  const session = demoSession()
  const resolution = demoResolution()
  const replay = engagement.createSpectatorReplay({
    session,
    commitments: [
      {
        commitmentId: 'commit-alice',
        gameId: session.gameId,
        roundId: 'main',
        playerId: 'alice',
        commitmentHash: 'hash-alice'
      }
    ],
    reveals: [
      {
        revealId: 'reveal-alice',
        gameId: session.gameId,
        roundId: 'main',
        playerId: 'alice',
        input: { answers: { q1: 'red' } },
        nonce: 'hidden-from-replay'
      }
    ],
    resolution,
    createdAt: '2026-07-03T21:01:00.000Z'
  })
  const ladder = engagement.createDemoLadderSnapshot({
    sessions: [session, demoSession('engagement-game-2')],
    gameResolutions: [resolution, demoResolution('engagement-game-2', 'bob')],
    createdAt: '2026-07-03T21:02:00.000Z'
  })
  const rematch = engagement.createRematchProposal({
    sourceGame: session,
    sourceResult: resolution,
    requestedByUserId: 'alice',
    createdAt: '2026-07-03T21:03:00.000Z'
  })
  const shareCard = engagement.createShareCard({
    subject: resolution,
    targetType: 'game',
    targetId: session.gameId,
    userId: 'alice',
    createdAt: '2026-07-03T21:04:00.000Z'
  })
  const gallery = engagement.createCreatorTemplateGallery({
    createdAt: '2026-07-03T21:05:00.000Z'
  })
  const calendar = engagement.createContentCalendar({
    startDate: '2026-07-03',
    weeks: 6,
    createdAt: '2026-07-03T21:06:00.000Z'
  })

  assert.equal(replay.status, 'ready')
  assert.equal(replay.steps.some(step => step.stepType === 'result'), true)
  assert.equal(replay.steps.some(step => Object.prototype.hasOwnProperty.call(step, 'nonce')), false)
  assert.equal(ladder.leaderboard.length, 2)
  assert.equal(ladder.leaderboard[0].played, 2)
  assert.equal(rematch.commandDraft.type, 'room:challenge')
  assert.equal(rematch.commandDraft.payload.gameType, 'trivia-duel')
  assert.equal(shareCard.shareType, 'game-win')
  assert.equal(shareCard.privacy.includePayoutRoute, false)
  assert.equal(gallery.templates.some(template => template.category === 'local'), true)
  assert.equal(calendar.items.length, 6)
  assert.equal(calendar.items.some(item => item.itemType === 'local-league'), true)
})

test('runtime replays engagement artifacts into game, discover, and creator surfaces', () => {
  const app = platform.createUltimateSportsPlatform({ peerId: 'host' })
  app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T22:00:00.000Z',
    payload: {
      competitionId: 'engagement-cup',
      title: 'Engagement Cup',
      templateConfig: { kind: 'single-elimination', sportOrCategory: 'soccer' },
      entrants: [
        { entrantId: 'red', name: 'Red' },
        { entrantId: 'blue', name: 'Blue' }
      ]
    }
  })
  app.dispatch({
    type: 'room:create',
    actorId: 'host',
    occurredAt: '2026-07-03T22:01:00.000Z',
    payload: {
      roomId: 'engagement-room',
      competitionId: 'engagement-cup',
      title: 'Engagement Room',
      hostUserId: 'host',
      status: 'live'
    }
  })
  const gameEvent = app.dispatch({
    type: 'game:create',
    actorId: 'alice',
    occurredAt: '2026-07-03T22:02:00.000Z',
    payload: {
      gameId: 'engagement-runtime-game',
      gameType: 'trivia-duel',
      roomId: 'engagement-room',
      players: ['alice', 'bob'],
      spectators: ['viewer'],
      stakeMode: 'demo'
    }
  })
  app.dispatch({
    type: 'game:start',
    actorId: 'host',
    occurredAt: '2026-07-03T22:03:00.000Z',
    payload: { gameId: gameEvent.payload.gameId }
  })
  const aliceInput = { answers: { q1: { answer: 'red', responseMs: 500 } } }
  const bobInput = { answers: { q1: { answer: 'blue', responseMs: 700 } } }
  app.dispatch({
    type: 'game:commit',
    actorId: 'alice',
    occurredAt: '2026-07-03T22:04:00.000Z',
    payload: {
      gameId: gameEvent.payload.gameId,
      roundId: 'main',
      playerId: 'alice',
      input: aliceInput,
      nonce: 'alice-nonce'
    }
  })
  app.dispatch({
    type: 'game:commit',
    actorId: 'bob',
    occurredAt: '2026-07-03T22:04:01.000Z',
    payload: {
      gameId: gameEvent.payload.gameId,
      roundId: 'main',
      playerId: 'bob',
      input: bobInput,
      nonce: 'bob-nonce'
    }
  })
  app.dispatch({
    type: 'game:reveal',
    actorId: 'alice',
    occurredAt: '2026-07-03T22:05:00.000Z',
    payload: {
      gameId: gameEvent.payload.gameId,
      roundId: 'main',
      playerId: 'alice',
      input: aliceInput,
      nonce: 'alice-nonce'
    }
  })
  app.dispatch({
    type: 'game:reveal',
    actorId: 'bob',
    occurredAt: '2026-07-03T22:05:01.000Z',
    payload: {
      gameId: gameEvent.payload.gameId,
      roundId: 'main',
      playerId: 'bob',
      input: bobInput,
      nonce: 'bob-nonce'
    }
  })
  app.dispatch({
    type: 'game:resolve',
    actorId: 'host',
    occurredAt: '2026-07-03T22:06:00.000Z',
    payload: {
      gameId: gameEvent.payload.gameId,
      result: {
        correctAnswers: { q1: 'red' }
      }
    }
  })
  const replayEvent = app.dispatch({
    type: 'engagement:createReplay',
    actorId: 'host',
    occurredAt: '2026-07-03T22:07:00.000Z',
    payload: { gameId: gameEvent.payload.gameId }
  })
  const ladderEvent = app.dispatch({
    type: 'engagement:createLadder',
    actorId: 'system',
    occurredAt: '2026-07-03T22:08:00.000Z',
    payload: { scope: 'global' }
  })
  const rematchEvent = app.dispatch({
    type: 'engagement:createRematch',
    actorId: 'alice',
    occurredAt: '2026-07-03T22:09:00.000Z',
    payload: { gameId: gameEvent.payload.gameId }
  })
  const shareEvent = app.dispatch({
    type: 'engagement:createShareCard',
    actorId: 'alice',
    occurredAt: '2026-07-03T22:10:00.000Z',
    payload: {
      targetType: 'game',
      targetId: gameEvent.payload.gameId
    }
  })
  const galleryEvent = app.dispatch({
    type: 'engagement:createCreatorGallery',
    actorId: 'system',
    occurredAt: '2026-07-03T22:11:00.000Z',
    payload: {}
  })
  const calendarEvent = app.dispatch({
    type: 'engagement:createContentCalendar',
    actorId: 'system',
    occurredAt: '2026-07-03T22:12:00.000Z',
    payload: {
      startDate: '2026-07-03',
      weeks: 4
    }
  })

  const view = app.view()
  const games = app.createSurface('games', { userId: 'alice' })
  const discover = app.createSurface('discover', { userId: 'alice' })
  const creator = app.createSurface('creator', { userId: 'host' })

  assert.equal(view.spectatorReplays[replayEvent.payload.replayId].status, 'ready')
  assert.deepEqual(view.spectatorReplaysByGame[gameEvent.payload.gameId], [replayEvent.payload.replayId])
  assert.equal(view.demoLadders[ladderEvent.payload.ladderId].leaderboard[0].userId, 'alice')
  assert.equal(view.rematchProposals[rematchEvent.payload.rematchId].commandDraft.payload.targetUserId, 'bob')
  assert.equal(view.shareCards[shareEvent.payload.shareCardId].shareType, 'game-win')
  assert.equal(view.creatorTemplateGalleries[galleryEvent.payload.galleryId].templates.length > 0, true)
  assert.equal(view.contentCalendars[calendarEvent.payload.calendarId].items.length, 4)

  assert.equal(games.spectatorReplays[0].replayId, replayEvent.payload.replayId)
  assert.equal(games.ladders[0].topRows[0].userId, 'alice')
  assert.equal(games.rematches[0].rematchId, rematchEvent.payload.rematchId)
  assert.equal(games.shareCards[0].shareCardId, shareEvent.payload.shareCardId)
  assert.equal(discover.contentCalendars[0].calendarId, calendarEvent.payload.calendarId)
  assert.equal(creator.templateGalleries[0].galleryId, galleryEvent.payload.galleryId)
})
