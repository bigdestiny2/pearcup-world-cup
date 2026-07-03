'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { constants, eventLog, prediction, runtime, settlement } = require('../src')

function buildSettledPoolRuntime () {
  const app = runtime.createPlatformRuntime()
  const competitionEvent = app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T19:00:00.000Z',
    payload: {
      competitionId: 'settlement-comp',
      title: 'Settlement Cup',
      templateConfig: { kind: 'single-elimination' },
      entrants: [
        { entrantId: 'alpha', name: 'Alpha' },
        { entrantId: 'beta', name: 'Beta' }
      ]
    }
  })
  const rules = prediction.createPoolRules({ variant: 'classic-bracket', payoutPolicy: 'sponsor-prize' })
  const poolEvent = app.dispatch({
    type: 'pool:create',
    actorId: 'host',
    occurredAt: '2026-07-03T19:01:00.000Z',
    payload: {
      poolId: 'settlement-pool',
      competitionId: 'settlement-comp',
      rules,
      mode: 'sponsor-prize'
    }
  })
  const entryEvent = app.dispatch({
    type: 'prediction:submit',
    actorId: 'winner',
    occurredAt: '2026-07-03T19:02:00.000Z',
    payload: {
      poolId: 'settlement-pool',
      userId: 'winner',
      entryType: 'bracket',
      picks: { final: 'alpha' }
    }
  })
  const lockEvent = app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T19:03:00.000Z',
    payload: { entryId: entryEvent.payload.entryId }
  })
  const resultEvent = app.dispatch({
    type: 'result:record',
    actorId: 'feed',
    occurredAt: '2026-07-03T19:04:00.000Z',
    payload: {
      competitionId: 'settlement-comp',
      sourcePolicy: 'official-feed',
      results: {
        final: { winnerEntrantId: 'alpha', roundNumber: 1 }
      }
    }
  })
  const settlementEvent = app.dispatch({
    type: 'pool:resolve',
    actorId: 'system',
    occurredAt: '2026-07-03T19:05:00.000Z',
    payload: {
      poolId: 'settlement-pool',
      resultSnapshotId: resultEvent.payload.snapshotId
    }
  })

  return {
    app,
    competitionEvent,
    poolEvent,
    lockEvent,
    resultEvent,
    settlementEvent
  }
}

test('settlement receipts bind replayed source events and event roots', () => {
  const ctx = buildSettledPoolRuntime()
  const planEvent = ctx.app.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    occurredAt: '2026-07-03T19:06:00.000Z',
    payload: {
      poolId: 'settlement-pool',
      rulesVersion: ctx.poolEvent.payload.rules.rulesVersion,
      resultSnapshotId: ctx.resultEvent.payload.snapshotId,
      mode: 'sponsor-prize',
      gates: {
        poolRulesAccepted: { ok: true, evidenceId: ctx.poolEvent.eventId }
      },
      requireEvidence: true,
      sourceEventIds: [
        ctx.competitionEvent.eventId,
        ctx.poolEvent.eventId,
        ctx.lockEvent.eventId,
        ctx.resultEvent.eventId,
        ctx.settlementEvent.eventId
      ]
    }
  })
  const receiptEvent = ctx.app.dispatch({
    type: 'settlement:receipt',
    actorId: 'system',
    occurredAt: '2026-07-03T19:07:00.000Z',
    payload: {
      settlementPlanId: planEvent.payload.settlementPlanId,
      requiredTypes: ['PoolCreated', 'PredictionEntryLocked', 'ResultSnapshotRecorded', 'PoolSettlementResolved']
    }
  })

  const receipt = receiptEvent.payload
  assert.equal(receipt.status, 'complete')
  assert.equal(receipt.heldReason, null)
  assert.equal(receipt.body.winnerUserIds[0], 'winner')
  assert.equal(receipt.body.eventRoot, eventLog.eventRoot(ctx.app.events().slice(0, -1)))
  assert.equal(ctx.app.view().settlementReceipts[receipt.receiptId].receiptHash, receipt.receiptHash)
})

test('settlement receipt stays held when replay evidence is missing', () => {
  const ctx = buildSettledPoolRuntime()
  const planEvent = ctx.app.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    occurredAt: '2026-07-03T20:06:00.000Z',
    payload: {
      poolId: 'settlement-pool',
      rulesVersion: ctx.poolEvent.payload.rules.rulesVersion,
      resultSnapshotId: ctx.resultEvent.payload.snapshotId,
      mode: 'demo',
      sourceEventIds: [ctx.poolEvent.eventId, 'missing-source-event']
    }
  })
  const receiptEvent = ctx.app.dispatch({
    type: 'settlement:receipt',
    actorId: 'system',
    occurredAt: '2026-07-03T20:07:00.000Z',
    payload: {
      settlementPlanId: planEvent.payload.settlementPlanId,
      requiredTypes: ['PoolCreated', 'PoolSettlementResolved']
    }
  })

  assert.equal(receiptEvent.payload.status, 'held')
  assert.equal(receiptEvent.payload.heldReason, 'source-evidence-incomplete')
  assert.deepEqual(receiptEvent.payload.missingSourceEventIds, ['missing-source-event'])
  assert.deepEqual(receiptEvent.payload.missingSourceTypes, ['PoolSettlementResolved'])
})

test('sponsor prize fulfillment transitions are replayable', () => {
  const ctx = buildSettledPoolRuntime()
  const planEvent = ctx.app.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    occurredAt: '2026-07-03T21:06:00.000Z',
    payload: {
      poolId: 'settlement-pool',
      rulesVersion: ctx.poolEvent.payload.rules.rulesVersion,
      resultSnapshotId: ctx.resultEvent.payload.snapshotId,
      mode: 'sponsor-prize',
      gates: {
        poolRulesAccepted: { ok: true, evidenceId: ctx.poolEvent.eventId }
      },
      requireEvidence: true,
      sourceEventIds: [ctx.poolEvent.eventId, ctx.resultEvent.eventId, ctx.settlementEvent.eventId]
    }
  })
  const receiptEvent = ctx.app.dispatch({
    type: 'settlement:receipt',
    actorId: 'system',
    occurredAt: '2026-07-03T21:07:00.000Z',
    payload: {
      settlementPlanId: planEvent.payload.settlementPlanId,
      requiredTypes: ['PoolCreated', 'ResultSnapshotRecorded', 'PoolSettlementResolved']
    }
  })
  const created = ctx.app.dispatch({
    type: 'sponsor:createFulfillment',
    actorId: 'sponsor',
    occurredAt: '2026-07-03T21:08:00.000Z',
    payload: {
      receiptId: receiptEvent.payload.receiptId,
      winnerUserId: 'winner',
      sponsorId: 'sponsor-1',
      prize: { type: 'gift-card', valueUsd: 100 }
    }
  })
  const fulfilled = ctx.app.dispatch({
    type: 'sponsor:updateFulfillment',
    actorId: 'sponsor',
    occurredAt: '2026-07-03T21:09:00.000Z',
    payload: {
      fulfillmentId: created.payload.fulfillmentId,
      status: 'fulfilled',
      trackingRef: 'gift-card-code-hash',
      note: 'sent by email'
    }
  })

  assert.equal(created.payload.status, 'pending')
  assert.equal(fulfilled.payload.status, 'fulfilled')
  assert.equal(fulfilled.payload.history.length, 2)
  assert.equal(ctx.app.view().sponsorFulfillments[created.payload.fulfillmentId].trackingRef, 'gift-card-code-hash')
})

test('settlement receipts can target resolved peer mini-games', () => {
  const app = runtime.createPlatformRuntime()
  const gameEvent = app.dispatch({
    type: 'game:create',
    actorId: 'host',
    occurredAt: '2026-07-03T22:00:00.000Z',
    payload: {
      gameId: 'settlement-game',
      gameType: 'trivia-duel',
      players: ['alice', 'bob'],
      stakeMode: 'demo'
    }
  })
  const resolvedEvent = app.dispatch({
    type: 'game:resolve',
    actorId: 'host',
    occurredAt: '2026-07-03T22:01:00.000Z',
    payload: {
      gameId: 'settlement-game',
      reveals: [
        {
          playerId: 'alice',
          input: {
            answers: {
              q1: { answer: 'red', responseMs: 900 }
            }
          }
        },
        {
          playerId: 'bob',
          input: {
            answers: {
              q1: { answer: 'blue', responseMs: 500 }
            }
          }
        }
      ],
      result: {
        correctAnswers: { q1: 'blue' }
      }
    }
  })
  const planEvent = app.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    occurredAt: '2026-07-03T22:02:00.000Z',
    payload: {
      targetType: 'game',
      targetId: 'settlement-game',
      rulesVersion: 'trivia-duel-v1',
      mode: 'demo',
      sourceEventIds: [gameEvent.eventId, resolvedEvent.eventId]
    }
  })
  const receiptEvent = app.dispatch({
    type: 'settlement:receipt',
    actorId: 'system',
    occurredAt: '2026-07-03T22:03:00.000Z',
    payload: {
      settlementPlanId: planEvent.payload.settlementPlanId,
      requiredTypes: ['PeerGameSessionResolved']
    }
  })

  assert.equal(receiptEvent.payload.status, 'complete')
  assert.equal(receiptEvent.payload.body.targetType, 'game')
  assert.equal(receiptEvent.payload.body.targetId, 'settlement-game')
  assert.deepEqual(receiptEvent.payload.body.winnerUserIds, ['bob'])
  assert.equal(receiptEvent.payload.body.resultHash, resolvedEvent.payload.resultHash)
})

test('settlement receipts can target prediction cards and fantasy drafts', () => {
  const app = runtime.createPlatformRuntime()
  const cardEvent = app.dispatch({
    type: 'card:create',
    actorId: 'host',
    occurredAt: '2026-07-03T23:00:00.000Z',
    payload: {
      cardId: 'settlement-card',
      competitionId: 'settlement-card-comp',
      cardType: 'group-stage-card',
      fields: [
        { fieldId: 'winner', fieldType: 'single-choice', label: 'Winner', options: ['a', 'b'] }
      ]
    }
  })
  app.dispatch({
    type: 'card:submit',
    actorId: 'alice',
    payload: {
      cardId: 'settlement-card',
      answers: { winner: 'a' }
    }
  })
  app.dispatch({
    type: 'card:submit',
    actorId: 'bob',
    payload: {
      cardId: 'settlement-card',
      answers: { winner: 'b' }
    }
  })
  const cardResolved = app.dispatch({
    type: 'card:resolve',
    actorId: 'host',
    occurredAt: '2026-07-03T23:01:00.000Z',
    payload: {
      cardId: 'settlement-card',
      results: { winner: 'b' }
    }
  })
  const cardPlan = app.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    payload: {
      targetType: 'card',
      targetId: 'settlement-card',
      rulesVersion: 'card-v1',
      mode: 'demo',
      sourceEventIds: [cardEvent.eventId, cardResolved.eventId]
    }
  })
  const cardReceipt = app.dispatch({
    type: 'settlement:receipt',
    actorId: 'system',
    payload: {
      settlementPlanId: cardPlan.payload.settlementPlanId,
      requiredTypes: ['PredictionCardResolved']
    }
  })

  const draftEvent = app.dispatch({
    type: 'draft:create',
    actorId: 'host',
    occurredAt: '2026-07-03T23:02:00.000Z',
    payload: {
      slateId: 'settlement-draft',
      competitionId: 'settlement-draft-comp',
      rosterSize: 1,
      athletes: [
        { athleteId: 'p1', name: 'Player One' },
        { athleteId: 'p2', name: 'Player Two' }
      ],
      scoringRules: { goals: 5 }
    }
  })
  app.dispatch({
    type: 'draft:submit',
    actorId: 'alice',
    payload: {
      slateId: 'settlement-draft',
      athleteIds: ['p1']
    }
  })
  app.dispatch({
    type: 'draft:submit',
    actorId: 'bob',
    payload: {
      slateId: 'settlement-draft',
      athleteIds: ['p2']
    }
  })
  const draftResolved = app.dispatch({
    type: 'draft:resolve',
    actorId: 'host',
    occurredAt: '2026-07-03T23:03:00.000Z',
    payload: {
      slateId: 'settlement-draft',
      athleteStats: {
        p1: { goals: 0 },
        p2: { goals: 1 }
      }
    }
  })
  const draftPlan = app.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    payload: {
      targetType: 'draft',
      targetId: 'settlement-draft',
      rulesVersion: 'draft-v1',
      mode: 'demo',
      sourceEventIds: [draftEvent.eventId, draftResolved.eventId]
    }
  })
  const draftReceipt = app.dispatch({
    type: 'settlement:receipt',
    actorId: 'system',
    payload: {
      settlementPlanId: draftPlan.payload.settlementPlanId,
      requiredTypes: ['DraftSlateResolved']
    }
  })

  assert.equal(cardReceipt.payload.status, 'complete')
  assert.equal(cardReceipt.payload.body.targetType, 'card')
  assert.deepEqual(cardReceipt.payload.body.winnerUserIds, ['bob'])
  assert.equal(draftReceipt.payload.status, 'complete')
  assert.equal(draftReceipt.payload.body.targetType, 'draft')
  assert.deepEqual(draftReceipt.payload.body.winnerUserIds, ['bob'])
})

test('real-money readiness can require explicit gate evidence', () => {
  const booleanOnlyGates = Object.fromEntries(constants.REAL_MONEY_GATES.map(gate => [gate, true]))
  const weak = settlement.evaluateSettlementReadiness({
    mode: 'real-money',
    gates: booleanOnlyGates,
    requireEvidence: true
  })
  const evidencedGates = Object.fromEntries(constants.REAL_MONEY_GATES.map(gate => [
    gate,
    { ok: true, evidenceId: `${gate}-event` }
  ]))
  const strong = settlement.evaluateSettlementReadiness({
    mode: 'real-money',
    gates: evidencedGates,
    requireEvidence: true
  })

  assert.equal(weak.ready, false)
  assert.deepEqual(weak.missingGates, [])
  assert.equal(weak.missingGateEvidence.length, constants.REAL_MONEY_GATES.length)
  assert.equal(strong.ready, true)
  assert.deepEqual(strong.missingGateEvidence, [])
})
