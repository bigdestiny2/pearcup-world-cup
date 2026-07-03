'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { platform, watch } = require('../src')

function setupWatchApp () {
  const app = platform.createUltimateSportsPlatform({ peerId: 'host' })
  app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T18:00:00.000Z',
    payload: {
      competitionId: 'watch-cup',
      title: 'Watch Cup',
      templateConfig: {
        kind: 'single-elimination',
        sportOrCategory: 'soccer',
        entrantShape: 'team'
      },
      entrants: ['Red FC', 'Blue FC']
    }
  })
  app.dispatch({
    type: 'room:create',
    actorId: 'host',
    occurredAt: '2026-07-03T18:01:00.000Z',
    payload: {
      roomId: 'watch-room',
      competitionId: 'watch-cup',
      fixtureId: 'watch-cup:r1:m1',
      title: 'Watch room',
      hostUserId: 'host',
      status: 'live'
    }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'host',
    occurredAt: '2026-07-03T18:02:00.000Z',
    payload: {
      roomId: 'watch-room',
      userId: 'host',
      username: 'Host',
      role: 'host'
    }
  })
  app.dispatch({
    type: 'room:join',
    actorId: 'fan',
    occurredAt: '2026-07-03T18:03:00.000Z',
    payload: {
      roomId: 'watch-room',
      userId: 'fan',
      username: 'Fan'
    }
  })
  return app
}

test('watch workbench drives live market prediction and streak commands', () => {
  const app = setupWatchApp()
  const initial = app.createWatchPartyWorkbench({
    userId: 'host',
    roomId: 'watch-room'
  })
  const nextEvent = initial.marketLauncher.marketTypes.find(item => item.marketType === 'next-event')
  const scorelineLock = initial.marketLauncher.marketTypes.find(item => item.marketType === 'scoreline-lock')
  const playerProp = initial.marketLauncher.marketTypes.find(item => item.marketType === 'player-prop')
  const momentumDuel = initial.marketLauncher.marketTypes.find(item => item.marketType === 'momentum-duel')
  app.dispatch({
    ...nextEvent.commandDraft,
    payload: {
      ...nextEvent.commandDraft.payload,
      marketId: 'next-event-1'
    }
  })

  const fanWorkbench = app.createWatchPartyWorkbench({
    userId: 'fan',
    roomId: 'watch-room'
  })
  app.dispatch({
    ...fanWorkbench.markets[0].commandDrafts.predict,
    occurredAt: '2026-07-03T18:04:00.000Z',
    payload: {
      ...fanWorkbench.markets[0].commandDrafts.predict.payload,
      outcome: 'goal'
    }
  })
  const hostWithPrediction = app.createWatchPartyWorkbench({
    userId: 'host',
    roomId: 'watch-room'
  })
  app.dispatch(hostWithPrediction.markets[0].commandDrafts.lock)
  const locked = app.createWatchPartyWorkbench({
    userId: 'host',
    roomId: 'watch-room'
  })
  app.dispatch({
    ...locked.markets[0].commandDrafts.resolve,
    payload: {
      ...locked.markets[0].commandDrafts.resolve.payload,
      result: 'goal'
    }
  })
  const resolved = app.createWatchPartyWorkbench({
    userId: 'host',
    roomId: 'watch-room'
  })
  app.dispatch(resolved.streakBuilder.commandDraft)
  const afterStreak = app.createSurface('watch', { userId: 'host' }).workbench

  assert.equal(initial.selectedRoom.currentUserJoined, true)
  assert.equal(initial.participants.length, 2)
  assert.equal(scorelineLock.predictionShape, 'exact-scoreline')
  assert.deepEqual(scorelineLock.inputTemplate, { homeScore: 0, awayScore: 0, lockBeforeMinute: 60 })
  assert.equal(playerProp.predictionShape, 'player-prop')
  assert.deepEqual(playerProp.inputTemplate, { playerId: null, prop: 'first-scorer', value: true })
  assert.equal(momentumDuel.predictionShape, 'momentum-window')
  assert.deepEqual(momentumDuel.inputTemplate, { side: 'home-pressure', windowMinutes: 10 })
  assert.deepEqual(nextEvent.options, ['goal', 'corner', 'card', 'shot', 'save'])
  assert.equal(fanWorkbench.markets[0].canPredict, true)
  assert.equal(hostWithPrediction.markets[0].predictionCount, 1)
  assert.equal(locked.markets[0].status, 'locked')
  assert.equal(resolved.markets[0].resolution.winnerUserIds[0], 'fan')
  assert.equal(resolved.streakBuilder.ready, true)
  assert.equal(afterStreak.counts.streaks, 1)
})

test('watch workbench materializes peer challenges and game command drafts', () => {
  const app = setupWatchApp()
  const fanWorkbench = app.createWatchPartyWorkbench({
    userId: 'fan',
    roomId: 'watch-room'
  })
  const triviaChallenge = fanWorkbench.challengeLauncher.challengeTypes.find(item => item.gameType === 'trivia-duel')
  const bracketDuelChallenge = fanWorkbench.challengeLauncher.challengeTypes.find(item => item.challengeType === 'head-to-head-duel')
  app.dispatch({
    ...triviaChallenge.commandDraft,
    occurredAt: '2026-07-03T18:05:00.000Z'
  })

  const hostChallengeView = app.createWatchPartyWorkbench({
    userId: 'host',
    roomId: 'watch-room'
  })
  app.dispatch(hostChallengeView.challenges[0].acceptCommand)
  const accepted = app.createWatchPartyWorkbench({
    userId: 'host',
    roomId: 'watch-room'
  })
  app.dispatch(accepted.materializations[0].commandDraft)
  let hostGame = app.createWatchPartyWorkbench({
    userId: 'host',
    roomId: 'watch-room'
  })
  app.dispatch(hostGame.games[0].commandDrafts.start)

  hostGame = app.createWatchPartyWorkbench({
    userId: 'host',
    roomId: 'watch-room'
  })
  const fanGame = app.createWatchPartyWorkbench({
    userId: 'fan',
    roomId: 'watch-room'
  })
  app.dispatch(hostGame.games[0].commandDrafts.commit)
  app.dispatch(fanGame.games[0].commandDrafts.commit)
  const hostCommitted = app.createWatchPartyWorkbench({
    userId: 'host',
    roomId: 'watch-room'
  })
  const fanCommitted = app.createWatchPartyWorkbench({
    userId: 'fan',
    roomId: 'watch-room'
  })
  app.dispatch(hostCommitted.games[0].commandDrafts.reveal)
  app.dispatch(fanCommitted.games[0].commandDrafts.reveal)
  const revealed = app.createWatchPartyWorkbench({
    userId: 'host',
    roomId: 'watch-room'
  })
  app.dispatch(revealed.games[0].commandDrafts.resolve)
  const resolved = app.createWatchPartyWorkbench({
    userId: 'host',
    roomId: 'watch-room'
  })

  assert.equal(hostChallengeView.challenges[0].acceptCommand.type, 'room:acceptChallenge')
  assert.equal(bracketDuelChallenge.commandDraft.payload.duel.title, 'Head-to-head bracket duel')
  assert.equal(accepted.materializations[0].commandDraft.type, 'game:create')
  assert.equal(hostGame.games[0].status, 'active')
  assert.equal(hostGame.games[0].commandDrafts.commit.payload.roundId, 'trivia-main')
  assert.equal(hostCommitted.games[0].playerCommitment.playerId, 'host')
  assert.equal(fanCommitted.games[0].playerCommitment.playerId, 'fan')
  assert.equal(revealed.games[0].revealCount, 2)
  assert.equal(resolved.games[0].resolution.rowCount, 2)
  assert.equal(watch.inputTemplateForGame('reaction-challenge').taps[0].momentId, 'moment-1')
})
