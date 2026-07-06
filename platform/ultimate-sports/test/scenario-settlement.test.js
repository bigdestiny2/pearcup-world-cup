'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { createPlatformRuntime } = require('../src/platform-runtime')
const scenarios = require('../src/scenarios')
const catalog = require('../src/catalog-engine')

function runtime () {
  return createPlatformRuntime()
}

function seedAccount (rt, userId, amount = 200, currency = 'USDT') {
  const created = rt.dispatch({ type: 'wallet:createAccount', payload: { userId, currency, mode: 'real-money-readiness' } })
  rt.dispatch({ type: 'wallet:credit', payload: { accountId: created.payload.accountId, amount, currency, reason: 'seed' } })
}

function replayScenario (rt, scenario) {
  for (const command of scenario.commands) {
    rt.dispatch(command)
  }
}

function createResultSnapshot (rt, competitionId, results) {
  return rt.dispatch({
    type: 'result:record',
    payload: { competitionId, sourcePolicy: 'official-feed', results }
  })
}

function settlePool (rt, poolId, rulesVersion, snapshotEventId, resultPolicy) {
  let evidenceEventId = null
  if (resultPolicy && resultPolicy !== 'official-feed') {
    const ev = rt.dispatch({
      type: 'qvac:reviewResultEvidence',
      payload: { targetType: 'pool', targetId: poolId, summary: 'Host confirmed', verified: true }
    })
    evidenceEventId = ev.eventId
  }
  const plan = rt.dispatch({
    type: 'settlement:plan',
    payload: {
      poolId,
      rulesVersion,
      mode: 'sponsor-prize',
      gates: { poolRulesAccepted: true },
      sourceEventIds: evidenceEventId ? [snapshotEventId, evidenceEventId] : [snapshotEventId]
    }
  })
  const receipt = rt.dispatch({ type: 'settlement:receipt', payload: { settlementPlanId: plan.payload.settlementPlanId } })
  if (receipt.payload.status !== 'complete') {
    throw new Error(`receipt not complete: ${receipt.payload.heldReason}`)
  }
  rt.dispatch({
    type: 'settlement:preparePayout',
    payload: { receiptId: receipt.payload.receiptId, amountPerWinner: 20, currency: 'USDT', mode: 'demo' }
  })
}

test('soccer knockout scenario settles bracket pool and mini-game', () => {
  const rt = runtime()
  seedAccount(rt, 'alice')
  seedAccount(rt, 'bob')
  const scenario = scenarios.soccerKnockoutScenario()
  replayScenario(rt, scenario)
  const competitionId = scenario.topics.find(t => t.kind === 'competition').id
  const poolId = scenario.topics.find(t => t.kind === 'pool').id

  const pool = rt.view().pools[poolId]
  rt.dispatch({ type: 'prediction:submit', payload: { poolId, userId: 'alice', picks: { 'r32-1': 'red', 'r32-2': 'gold' } } })
  rt.dispatch({ type: 'prediction:submit', payload: { poolId, userId: 'bob', picks: { 'r32-1': 'blue', 'r32-2': 'green' } } })
  const entries = Object.values(rt.view().predictionEntries).filter(e => e.poolId === poolId)
  entries.forEach(entry => rt.dispatch({ type: 'prediction:lock', payload: { entryId: entry.entryId } }))

  rt.dispatch({ type: 'wdk:createEntryIntent', payload: { poolId, entryId: 'entry-alice', userId: 'alice', amount: 10, currency: 'USDT', mode: 'demo' } })
  rt.dispatch({ type: 'wdk:createEntryIntent', payload: { poolId, entryId: 'entry-bob', userId: 'bob', amount: 10, currency: 'USDT', mode: 'demo' } })

  const resultPolicy = rt.view().competitions[competitionId].resultPolicy
  const snap = createResultSnapshot(rt, competitionId, { 'r32-1': 'red', 'r32-2': 'gold' })
  rt.dispatch({ type: 'pool:resolve', payload: { poolId, resultSnapshotId: snap.payload.snapshotId } })
  settlePool(rt, poolId, pool.rules.rulesVersion, snap.eventId, resultPolicy)

  const run = rt.dispatch({ type: 'mini-game:createRun', payload: { fitId: 'world-cup', gameType: 'penalty-clash', players: ['alice', 'bob'] } })
  rt.dispatch({
    type: 'mini-game:resolveRun',
    payload: {
      runId: run.payload.runId,
      reveals: [
        { playerId: 'alice', input: { shots: [{ aim: 'left', power: 80 }] }, nonce: 'n1' },
        { playerId: 'bob', input: { shots: [{ aim: 'right', power: 70 }] }, nonce: 'n2' }
      ],
      result: { roundCount: 1 }
    }
  })

  const view = rt.view()
  assert.ok(view.wdkPoolPayouts[Object.keys(view.wdkPoolPayouts)[0]])
  assert.ok(view.miniGameRunResolutions[run.payload.runId])
})

test('fight card scenario settles with prediction-duel mini-game', () => {
  const rt = runtime()
  seedAccount(rt, 'alice')
  seedAccount(rt, 'bob')
  const scenario = scenarios.fightCardScenario()
  replayScenario(rt, scenario)
  const competitionId = scenario.topics.find(t => t.kind === 'competition').id

  const pool = rt.dispatch({ type: 'pool:create', payload: { competitionId, title: 'Fight method pool', variant: 'classic-bracket', mode: 'demo' } })
  const poolId = pool.payload.poolId
  rt.dispatch({ type: 'prediction:submit', payload: { poolId, userId: 'alice', picks: { 'r32-1': 'fighter-a' } } })
  rt.dispatch({ type: 'prediction:submit', payload: { poolId, userId: 'bob', picks: { 'r32-1': 'fighter-b' } } })
  Object.values(rt.view().predictionEntries).filter(e => e.poolId === poolId).forEach(entry => rt.dispatch({ type: 'prediction:lock', payload: { entryId: entry.entryId } }))

  const resultPolicy = rt.view().competitions[competitionId].resultPolicy
  const snap = createResultSnapshot(rt, competitionId, { 'r32-1': 'fighter-a' })
  rt.dispatch({ type: 'pool:resolve', payload: { poolId, resultSnapshotId: snap.payload.snapshotId } })
  settlePool(rt, poolId, pool.payload.rules.rulesVersion, snap.eventId, resultPolicy)

  const run = rt.dispatch({ type: 'mini-game:createRun', payload: { fitId: 'mma-boxing-fight-card', gameType: 'prediction-duel', players: ['alice', 'bob'] } })
  rt.dispatch({
    type: 'mini-game:resolveRun',
    payload: {
      runId: run.payload.runId,
      reveals: [
        { playerId: 'alice', input: { prediction: { winner: 'fighter-a', method: 'ko' }, responseMs: 800 }, nonce: 'n1' },
        { playerId: 'bob', input: { prediction: { winner: 'fighter-b', method: 'ko' }, responseMs: 900 }, nonce: 'n2' }
      ],
      result: { outcome: { winner: 'fighter-a', method: 'ko' }, fields: ['winner', 'method'] }
    }
  })

  assert.equal(rt.view().miniGameRunResolutions[run.payload.runId].resolution.winnerUserIds.includes('alice'), true)
})

test('awards scenario settles with prediction-duel mini-game', () => {
  const rt = runtime()
  seedAccount(rt, 'alice')
  seedAccount(rt, 'bob')
  const scenario = scenarios.awardsScenario()
  replayScenario(rt, scenario)
  const competitionId = scenario.topics.find(t => t.kind === 'competition').id

  const pool = rt.dispatch({ type: 'pool:create', payload: { competitionId, title: 'Awards pool', variant: 'group-stage-card', mode: 'demo' } })
  const poolId = pool.payload.poolId
  rt.dispatch({ type: 'prediction:submit', payload: { poolId, userId: 'alice', picks: { 'best-song': 'song-a' } } })
  rt.dispatch({ type: 'prediction:submit', payload: { poolId, userId: 'bob', picks: { 'best-song': 'song-b' } } })
  Object.values(rt.view().predictionEntries).filter(e => e.poolId === poolId).forEach(entry => rt.dispatch({ type: 'prediction:lock', payload: { entryId: entry.entryId } }))

  const resultPolicy = rt.view().competitions[competitionId].resultPolicy
  const snap = createResultSnapshot(rt, competitionId, { 'best-song': 'song-a' })
  rt.dispatch({ type: 'pool:resolve', payload: { poolId, resultSnapshotId: snap.payload.snapshotId } })
  settlePool(rt, poolId, pool.payload.rules.rulesVersion, snap.eventId, resultPolicy)

  const run = rt.dispatch({ type: 'mini-game:createRun', payload: { fitId: 'awards-prediction-pools', gameType: 'prediction-duel', players: ['alice', 'bob'] } })
  rt.dispatch({
    type: 'mini-game:resolveRun',
    payload: {
      runId: run.payload.runId,
      reveals: [
        { playerId: 'alice', input: { prediction: { winner: 'song-a' }, responseMs: 700 }, nonce: 'n1' },
        { playerId: 'bob', input: { prediction: { winner: 'song-b' }, responseMs: 800 }, nonce: 'n2' }
      ],
      result: { outcome: { winner: 'song-a' }, fields: ['winner'] }
    }
  })

  assert.equal(rt.view().miniGameRunResolutions[run.payload.runId].resolution.winnerUserIds.includes('alice'), true)
})

test('series playoff scenario settles with sport-specific mini-game', () => {
  const rt = runtime()
  seedAccount(rt, 'alice')
  seedAccount(rt, 'bob')
  const scenario = scenarios.seriesPlayoffScenario()
  replayScenario(rt, scenario)
  const competitionId = scenario.topics.find(t => t.kind === 'competition').id

  const pool = rt.dispatch({ type: 'pool:create', payload: { competitionId, title: 'Playoff bracket', variant: 'classic-bracket', mode: 'demo' } })
  const poolId = pool.payload.poolId
  rt.dispatch({ type: 'prediction:submit', payload: { poolId, userId: 'alice', picks: { 'r32-1': 'One' } } })
  rt.dispatch({ type: 'prediction:submit', payload: { poolId, userId: 'bob', picks: { 'r32-1': 'Two' } } })
  Object.values(rt.view().predictionEntries).filter(e => e.poolId === poolId).forEach(entry => rt.dispatch({ type: 'prediction:lock', payload: { entryId: entry.entryId } }))

  const resultPolicy = rt.view().competitions[competitionId].resultPolicy
  const snap = createResultSnapshot(rt, competitionId, { 'r32-1': 'One' })
  rt.dispatch({ type: 'pool:resolve', payload: { poolId, resultSnapshotId: snap.payload.snapshotId } })
  settlePool(rt, poolId, pool.payload.rules.rulesVersion, snap.eventId, resultPolicy)

  const run = rt.dispatch({ type: 'mini-game:createRun', payload: { fitId: 'pro-playoffs', gameType: 'buzzer-beater-duel', players: ['alice', 'bob'] } })
  rt.dispatch({
    type: 'mini-game:resolveRun',
    payload: {
      runId: run.payload.runId,
      reveals: [
        { playerId: 'alice', input: { attempts: [{ aim: 'center', power: 85 }] }, nonce: 'n1' },
        { playerId: 'bob', input: { attempts: [{ aim: 'left', power: 60 }] }, nonce: 'n2' }
      ],
      result: { attemptCount: 1 }
    }
  })

  assert.ok(rt.view().miniGameRunResolutions[run.payload.runId])
})

test('all catalog fits have a buildable mini-game spec', () => {
  const fits = catalog.listEventFits()
  assert.ok(fits.length >= 10)
  for (const fit of fits) {
    const app = require('../src/platform')
    const suite = app.createUltimateSportsPlatform().createMiniGameSuite({ fitId: fit.fitId })
    assert.ok(suite.specs.length > 0, `${fit.fitId} has no specs`)
  }
})
