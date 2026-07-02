const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')
const adapters = require('./adapters.js')
const { createWorkerSim } = require('./worker-sim.js')

const gameId = 'pc-adapter-test'
const roundId = 'pc-1'
const shooter = { id: 'user-captain', username: 'captain', teamId: 'br' }
const keeper = { id: 'user-vera', username: 'vera', teamId: 'no' }
const shooterInput = {
  role: 'shooter',
  aimZone: 'right-high',
  powerBand: 3,
  curveBand: 1,
  releaseTick: 42
}
const keeperInput = {
  role: 'keeper',
  diveZone: 'right-high',
  releaseTick: 43
}

function submitTrustedInputs (worker) {
  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: shooter.id,
    payload: {
      gameId,
      roundId,
      playerId: shooter.id,
      commitment: core.createCommitment({ gameId, roundId, playerId: shooter.id, input: shooterInput, nonce: 'shooter-nonce' })
    }
  })
  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: keeper.id,
    payload: {
      gameId,
      roundId,
      playerId: keeper.id,
      commitment: core.createCommitment({ gameId, roundId, playerId: keeper.id, input: keeperInput, nonce: 'keeper-nonce' })
    }
  })
  worker.dispatch({
    type: 'game:revealInput',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, input: shooterInput, nonce: 'shooter-nonce' }
  })
  worker.dispatch({
    type: 'game:revealInput',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, input: keeperInput, nonce: 'keeper-nonce' }
  })
  const stateHash = core.createPenaltyClashRound({
    gameId,
    roundIndex: 0,
    shooter,
    keeper,
    shooterInput,
    keeperInput,
    shooterNonce: 'shooter-nonce',
    keeperNonce: 'keeper-nonce'
  }).stateHash
  worker.dispatch({
    type: 'game:submitRoundStateHash',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, stateHash }
  })
  worker.dispatch({
    type: 'game:submitRoundStateHash',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, stateHash }
  })
}

test('default integration adapters run in demo mode', () => {
  const runtime = adapters.createIntegrationAdapters()
  assert.equal(runtime.mode.qvac, 'demo')
  assert.equal(runtime.mode.tetherWdk, 'demo')
  assert.equal(runtime.mode.qvacCommentary, 'demo')
})

test('default QVAC commentary adapter creates grounded demo segments', () => {
  const runtime = adapters.createIntegrationAdapters()
  const segment = runtime.qvacCommentary.generateSegment({
    matchId: 'match-brazil-norway',
    language: 'es',
    clock: '64:10',
    recentEvents: [{
      eventId: 'evt-shot',
      matchId: 'match-brazil-norway',
      clock: '64:10',
      type: 'shot',
      teamId: 'br'
    }],
    currentStats: {
      matchId: 'match-brazil-norway',
      clock: '64:10',
      score: { br: 2, no: 1 }
    },
    roomPickDistribution: { br: 2 }
  })

  assert.equal(segment.matchId, 'match-brazil-norway')
  assert.equal(segment.language, 'ES')
  assert.deepEqual(segment.sourceEventIds, ['evt-shot'])
  assert.equal(segment.eventHash, core.deterministicHash(['evt-shot']))
  assert.match(segment.text, /\[ES\]/)
})

test('SDK adapter wrappers delegate to provided SDK-like objects', () => {
  const runtime = adapters.createIntegrationAdapters({
    qvac: {
      attestRound ({ roundResult }) {
        return {
          attestationId: 'sdk-attestation',
          gameId: roundResult.gameId,
          roundId: roundResult.roundId,
          ruling: roundResult.outcome,
          stateHash: roundResult.stateHash,
          signature: 'sdk-qvac-signature'
        }
      },
      attestPoolSettlement ({ poolResult }) {
        return {
          attestationId: 'sdk-pool-attestation',
          poolId: poolResult.poolId,
          ruling: 'verified',
          stateHash: poolResult.stateHash,
          sourcePaymentIds: poolResult.sourcePaymentIds,
          winnerUserIds: poolResult.winnerUserIds,
          signature: 'sdk-qvac-pool-signature'
        }
      }
    },
    tetherWdk: {
      createGameEscrow (input) {
        return {
          escrowId: 'sdk-escrow',
          gameId: input.gameId,
          players: input.players,
          amount: input.amount,
          asset: input.asset,
          status: 'locked'
        }
      },
      releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
        return {
          payoutId: 'sdk-payout',
          escrowId: escrow.escrowId,
          winnerUserId,
          qvacAttestationId: attestation.attestationId,
          status: 'prepared'
        }
      },
      createEntryIntent (input) {
        return {
          intentId: 'sdk-entry-intent',
          poolId: input.poolId,
          entryId: input.entryId,
          userId: input.userId,
          amount: input.amount,
          asset: input.asset,
          status: 'requires-confirmation'
        }
      },
      confirmEntryIntent ({ intent }) {
        return {
          paymentId: 'sdk-entry-payment',
          intentId: intent.intentId,
          poolId: intent.poolId,
          entryId: intent.entryId,
          userId: intent.userId,
          amount: intent.amount,
          asset: intent.asset,
          status: 'confirmed'
        }
      },
      createPoolPayout ({ poolId, confirmedEntries, winnerUserIds }) {
        return {
          payoutId: 'sdk-pool-payout',
          poolId,
          sourcePaymentIds: confirmedEntries.map(entry => entry.paymentId),
          winnerUserIds,
          status: 'prepared'
        }
      },
      disputeGameEscrow ({ gameId, roundId, escrowId, reason }) {
        return {
          disputeId: 'sdk-escrow-dispute',
          gameId,
          roundId,
          escrowId,
          reason,
          status: 'held'
        }
      }
    }
  })

  assert.equal(runtime.mode.qvac, 'sdk')
  assert.equal(runtime.mode.tetherWdk, 'sdk')
  const dispute = runtime.tetherWdk.disputeGameEscrow({
    gameId: 'pc-sdk-game',
    roundId: 'pc-1',
    escrowId: 'sdk-escrow',
    reason: 'sdk dispute test'
  })
  assert.equal(dispute.rail, 'tether-wdk-sdk')
})

test('worker uses injected QVAC and Tether WDK SDK adapters for settlement events', () => {
  const runtime = adapters.createIntegrationAdapters({
    qvac: {
      attestRound ({ roundResult }) {
        return core.createQvacRefereeAttestation({
          roundResult,
          refereeId: 'sdk-qvac-adapter-test'
        })
      },
      attestPoolSettlement ({ poolResult }) {
        return core.createQvacPoolSettlementAttestation({
          poolResult,
          refereeId: 'sdk-qvac-adapter-test'
        })
      }
    },
    tetherWdk: {
      createGameEscrow (input) {
        return {
          escrowId: 'sdk-escrow-1',
          gameId: input.gameId,
          players: input.players,
          amount: input.amount,
          asset: input.asset,
          status: 'locked'
        }
      },
      releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
        if (!attestation.signature) throw new Error('missing sdk attestation')
        const payout = core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
        return { ...payout, sdkPayoutId: 'sdk-payout-1' }
      },
      createEntryIntent (input) {
        return {
          intentId: 'sdk-entry-intent-1',
          poolId: input.poolId,
          entryId: input.entryId,
          userId: input.userId,
          amount: input.amount,
          asset: input.asset,
          status: 'requires-confirmation'
        }
      },
      confirmEntryIntent ({ intent }) {
        return {
          paymentId: 'sdk-entry-payment-1',
          intentId: intent.intentId,
          poolId: intent.poolId,
          entryId: intent.entryId,
          userId: intent.userId,
          amount: intent.amount,
          asset: intent.asset,
          status: 'confirmed'
        }
      },
      createPoolPayout ({ poolId, confirmedEntries, winnerUserIds }) {
        return {
          payoutId: 'sdk-pool-payout-1',
          poolId,
          sourcePaymentIds: confirmedEntries.map(entry => entry.paymentId),
          winnerUserIds,
          status: 'prepared'
        }
      }
    }
  })

  const worker = createWorkerSim({ adapters: runtime })
  const escrow = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'tether-wdk-sdk',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitTrustedInputs(worker)
  worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  const attested = worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-sdk',
    payload: { gameId, roundId }
  })
  const payout = worker.dispatch({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-sdk',
    payload: { gameId, roundId, escrowId: escrow.payload.escrowId, winnerUserId: keeper.id }
  })

  assert.equal(worker.adapterMode().qvac, 'sdk')
  assert.equal(worker.adapterMode().tetherWdk, 'sdk')
  assert.equal(attested.payload.refereeId, 'sdk-qvac-adapter-test')
  assert.equal(payout.type, 'TetherWdkEscrowReleased')
  assert.equal(payout.payload.sdkPayoutId, 'sdk-payout-1')
})

test('worker uses injected Tether WDK SDK adapter for bracket entry and pool payout events', () => {
  const runtime = adapters.createIntegrationAdapters({
    tetherWdk: {
      createGameEscrow (input) {
        return { escrowId: 'sdk-escrow', ...input, status: 'locked' }
      },
      releaseGameEscrow ({ escrow, winnerUserId }) {
        return { payoutId: 'sdk-game-payout', escrowId: escrow.escrowId, winnerUserId, status: 'prepared' }
      },
      createEntryIntent (input) {
        return { intentId: 'sdk-entry-intent', ...input, status: 'requires-confirmation' }
      },
      confirmEntryIntent ({ intent }) {
        return {
          paymentId: 'sdk-entry-payment',
          intentId: intent.intentId,
          poolId: intent.poolId,
          entryId: intent.entryId,
          userId: intent.userId,
          amount: intent.amount,
          asset: intent.asset,
          status: 'confirmed'
        }
      },
      createPoolPayout (input) {
        const payout = core.createTetherWdkPoolPayout(input)
        return { ...payout, sdkPayoutId: 'sdk-pool-payout' }
      }
    }
  })
  const worker = createWorkerSim({ adapters: runtime })
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: shooter.id,
    payload: { poolId: 'pool-25', entryId: 'entry-captain', userId: shooter.id, username: 'captain', amount: 25, asset: 'USDT' }
  })
  const confirmed = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-sdk',
    payload: { intentId: intent.payload.intentId, confirmationId: 'sdk-confirmation' }
  })
  worker.dispatch({
    type: 'results:recordOfficialSnapshot',
    actorId: 'official-results-feed',
    payload: {
      poolId: 'pool-25',
      officialResults: { champion: 'Brazil' },
      rulesVersion: 'bracket-pool-v1'
    }
  })
  worker.dispatch({
    type: 'pool:resolveSettlement',
    actorId: 'bracket-rules',
    payload: { poolId: 'pool-25', winnerUserIds: [shooter.id], rulesVersion: 'bracket-pool-v1' }
  })
  worker.dispatch({
    type: 'qvac:attestPoolSettlement',
    actorId: 'qvac-demo-ref',
    payload: { poolId: 'pool-25' }
  })
  const payout = worker.dispatch({
    type: 'wdk:createPoolPayout',
    actorId: 'tether-wdk-sdk',
    payload: { poolId: 'pool-25', winnerUserIds: [shooter.id], asset: 'USDT' }
  })

  assert.equal(confirmed.payload.paymentId, 'sdk-entry-payment')
  assert.equal(confirmed.actorId, confirmed.payload.rail)
  assert.equal(confirmed.payload.rail, 'tether-wdk-sdk')
  assert.equal(payout.type, 'TetherWdkPoolPayoutPrepared')
  assert.equal(payout.payload.sdkPayoutId, 'sdk-pool-payout')
  assert.equal(worker.view().typeCounts.TetherWdkEntryConfirmed, 1)
  assert.equal(Object.keys(worker.view().poolPayouts).length, 1)
})

test('worker uses injected Tether WDK SDK adapter for rail-signed entry refunds', () => {
  const runtime = adapters.createIntegrationAdapters({
    tetherWdk: {
      createGameEscrow (input) {
        return { escrowId: 'sdk-escrow', ...input, status: 'locked' }
      },
      releaseGameEscrow ({ escrow, winnerUserId }) {
        return { payoutId: 'sdk-game-payout', escrowId: escrow.escrowId, winnerUserId, status: 'prepared' }
      },
      createEntryIntent (input) {
        return { intentId: 'sdk-refund-intent', ...input, status: 'requires-confirmation' }
      },
      confirmEntryIntent ({ intent }) {
        return {
          paymentId: 'sdk-refund-payment',
          intentId: intent.intentId,
          poolId: intent.poolId,
          entryId: intent.entryId,
          userId: intent.userId,
          amount: intent.amount,
          asset: intent.asset,
          status: 'confirmed'
        }
      },
      refundEntryIntent ({ payment, reason }) {
        const refund = core.createTetherWdkEntryRefund({ payment, reason })
        const withoutRail = { ...refund }
        delete withoutRail.rail
        return withoutRail
      },
      createPoolPayout (input) {
        return core.createTetherWdkPoolPayout(input)
      }
    }
  })
  const worker = createWorkerSim({ adapters: runtime })
  const intent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: shooter.id,
    payload: { poolId: 'pool-refund-sdk', entryId: 'entry-captain', userId: shooter.id, username: 'captain', amount: 25, asset: 'USDT' }
  })
  const payment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-sdk',
    payload: { intentId: intent.payload.intentId, confirmationId: 'sdk-refund-confirmation' }
  })
  const refund = worker.dispatch({
    type: 'wdk:refundEntryIntent',
    actorId: 'tether-wdk-sdk',
    payload: { paymentId: payment.payload.paymentId, reason: 'pool-cancelled' }
  })
  const view = worker.view()

  assert.equal(refund.type, 'TetherWdkEntryRefunded')
  assert.equal(refund.actorId, 'tether-wdk-sdk')
  assert.equal(refund.payload.rail, 'tether-wdk-sdk')
  assert.equal(view.entryPayments[payment.payload.paymentId], undefined)
  assert.equal(view.entryRefundsByPayment[payment.payload.paymentId].refundId, refund.payload.refundId)
})
