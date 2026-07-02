const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')
const receipts = require('./settlement-receipts.js')
const settlementService = require('./settlement-service.js')

const gameId = 'pc-settlement-service'
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

function submitRoundEvidence (worker) {
  const shooterCommitment = core.createCommitment({
    gameId,
    roundId,
    playerId: shooter.id,
    input: shooterInput,
    nonce: 'shooter-nonce'
  })
  const keeperCommitment = core.createCommitment({
    gameId,
    roundId,
    playerId: keeper.id,
    input: keeperInput,
    nonce: 'keeper-nonce'
  })

  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, commitment: shooterCommitment }
  })
  worker.dispatch({
    type: 'game:submitCommitment',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, commitment: keeperCommitment }
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

function createFakeSdkRuntime () {
  const seen = { qvac: null, tetherWdk: null }
  return {
    seen,
    sdk: {
      createQvacSdkRefereeAdapter (config) {
        seen.qvac = config
        return {
          id: 'qvac-settlement-service-test',
          mode: 'sdk',
          async attestRound ({ roundResult }) {
            return core.createQvacRefereeAttestation({
              roundResult,
              refereeId: 'qvac-settlement-service-test',
              review: {
                modelId: config.modelId,
                ruling: 'verified',
                confidence: 0.99,
                rationale: 'Settlement service QVAC verified the complete round evidence.'
              }
            })
          },
          async attestPoolSettlement ({ poolResult }) {
            return core.createQvacPoolSettlementAttestation({
              poolResult,
              refereeId: 'qvac-settlement-service-test',
              review: {
                modelId: config.modelId,
                ruling: poolResult.ruling,
                confidence: 0.98,
                rationale: 'Settlement service QVAC verified the pool settlement evidence.'
              }
            })
          }
        }
      },
      createTetherWdkPackageAdapter (config) {
        seen.tetherWdk = config
        return {
          id: 'tether-wdk-settlement-service-test',
          mode: 'sdk',
          async createGameEscrow (input) {
            return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-settlement-service-test' })
          },
          async releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
            return core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
          },
          async createEntryIntent (input) {
            return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-settlement-service-test' })
          },
          async confirmEntryIntent (input) {
            return core.confirmTetherWdkEntryIntent(input)
          },
          async reconcileEntryIntent (input) {
            return core.confirmTetherWdkEntryIntent(input)
          },
          async createPoolPayout (input) {
            return core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-settlement-service-test' })
          },
          disputeGameEscrow ({ gameId, roundId, escrowId, reason }) {
            return {
              disputeId: core.deterministicHash({ gameId, roundId, escrowId, reason }),
              gameId,
              roundId,
              escrowId,
              reason,
              status: 'held'
            }
          }
        }
      }
    }
  }
}

function baseSettings ({ live = false, sdk = false } = {}) {
  return {
    source: {
      path: 'config/pearcup.settlement-service.test.json',
      loaded: true
    },
    sdkPackages: sdk
      ? {
          qvac: {
            modelId: 'qvac-settlement-service-model',
            autoUnload: true
          },
          tetherWdk: {
            seedPhrase: 'valid settlement service seed phrase',
            assets: ['usdt-evm'],
            skipInitialBalanceProbe: true
          }
        }
      : {},
    compliance: {
      realMoneyEnabled: live,
      kycVerified: live,
      jurisdictionAllowed: live,
      responsiblePlayAccepted: live
    }
  }
}

test('guarded settlement service blocks prize commands while runtime is demo locked', async () => {
  const service = settlementService.createGuardedSettlementService({
    settings: baseSettings()
  })
  const status = service.status()

  assert.equal(settlementService.prizeCommandTypes.has('game:submitRoundStateHash'), true)
  assert.equal(settlementService.prizeCommandTypes.has('game:recordForfeit'), true)
  assert.equal(settlementService.prizeCommandTypes.has('wdk:refundGameEscrow'), true)
  assert.equal(settlementService.prizeCommandTypes.has('wdk:refundEntryIntent'), true)
  assert.equal(status.guardMode, 'live-only')
  assert.equal(status.settlementGate.liveReady, false)
  assert.equal(status.settlementGate.status, 'demo-locked')

  await assert.rejects(
    () => service.createEntryIntent({
      poolId: 'pool-locked',
      entryId: 'entry-locked',
      userId: shooter.id,
      username: shooter.username,
      amount: 25,
      asset: 'USDT'
    }),
    (err) => {
      assert.equal(err.code, settlementService.SETTLEMENT_LOCKED_CODE)
      assert.equal(err.action, 'wdk:createEntryIntent')
      assert.ok(err.gate.missing.some(item => item.key === 'qvac'))
      assert.ok(err.gate.missing.some(item => item.key === 'tetherWdk'))
      return true
    }
  )
  await assert.rejects(
    () => service.reconcileEntryIntent({
      intentId: 'intent-locked'
    }),
    (err) => {
      assert.equal(err.code, settlementService.SETTLEMENT_LOCKED_CODE)
      assert.equal(err.action, 'wdk:reconcileEntryIntent')
      return true
    }
  )
  await assert.rejects(
    () => service.refundGameEscrow({
      escrowId: 'escrow-locked',
      reason: 'match-cancelled'
    }),
    (err) => {
      assert.equal(err.code, settlementService.SETTLEMENT_LOCKED_CODE)
      assert.equal(err.action, 'wdk:refundGameEscrow')
      return true
    }
  )
  await assert.rejects(
    () => service.refundEntryIntent({
      paymentId: 'payment-locked',
      reason: 'pool-cancelled'
    }),
    (err) => {
      assert.equal(err.code, settlementService.SETTLEMENT_LOCKED_CODE)
      assert.equal(err.action, 'wdk:refundEntryIntent')
      return true
    }
  )
  await assert.rejects(
    () => service.declarePayoutRecipient({
      poolId: 'pool-locked',
      userId: shooter.id,
      username: shooter.username,
      asset: 'USDT',
      recipient: '0xlockedrecipient0000000000000000000000000000'
    }),
    (err) => {
      assert.equal(err.code, settlementService.SETTLEMENT_LOCKED_CODE)
      assert.equal(err.action, 'payout:declareRecipient')
      return true
    }
  )
  await assert.rejects(
    () => service.recordSettlementReceipt({
      type: 'TrustedGameSettlementCompleted',
      settlementEvent: { eventId: 'evt-locked-receipt' }
    }),
    (err) => {
      assert.equal(err.code, settlementService.SETTLEMENT_LOCKED_CODE)
      assert.equal(err.action, 'settlement:recordReceipt')
      return true
    }
  )
  assert.equal(service.harness.worker.events().length, 0)

  await service.close()
})

test('guarded settlement service can explicitly run demo settlement without live WDK', async () => {
  const service = settlementService.createGuardedSettlementService({
    settings: baseSettings(),
    requireLive: false
  })
  const escrowEvent = await service.createGameEscrow({
    gameId: 'pc-demo-service',
    players: [shooter.id, keeper.id],
    amount: 5,
    asset: 'USDT'
  })

  assert.equal(service.status().guardMode, 'demo-allowed')
  assert.equal(escrowEvent.type, 'TetherWdkEscrowCreated')
  assert.equal(escrowEvent.payload.rail, 'tether-wdk-demo')
  const recipientEvent = await service.declarePayoutRecipient({
    poolId: 'pool-demo-service',
    userId: shooter.id,
    username: shooter.username,
    asset: 'USDT',
    recipient: '0xdemoservicerecipient00000000000000000000000'
  })

  assert.equal(recipientEvent.type, 'PayoutRecipientDeclared')
  assert.equal(service.harness.worker.events().length, 2)

  await service.close()
})

test('guarded settlement service holds receipt recording until QVAC and WDK evidence exist', async () => {
  const service = settlementService.createGuardedSettlementService({
    settings: baseSettings(),
    requireLive: false
  })
  const escrowEvent = await service.createGameEscrow({
    gameId,
    players: [shooter.id, keeper.id],
    amount: 5,
    asset: 'USDT'
  })

  const result = await service.settleGameRoundWithReceipt({
    gameId,
    roundIndex: 0,
    shooter,
    keeper,
    escrowId: escrowEvent.payload.escrowId
  })
  const view = service.harness.worker.view()

  assert.equal(result.summary.type, 'TrustedGameSettlementHeld')
  assert.equal(result.receipt, null)
  assert.equal(result.receiptEvent, null)
  assert.equal(result.receiptHeld, true)
  assert.match(result.receiptReason, /QVAC attestation event/)
  assert.match(result.receiptReason, /WDK settlement event/)
  assert.equal(view.typeCounts.SettlementReceiptCreated || 0, 0)
  assert.equal(view.typeCounts.SettlementReceiptRejected || 0, 0)

  await service.close()
})

test('guarded settlement service records receipts for trusted game escrow refunds', async () => {
  const service = settlementService.createGuardedSettlementService({
    settings: baseSettings(),
    requireLive: false
  })
  const escrowEvent = await service.createGameEscrow({
    gameId,
    players: [shooter.id, keeper.id],
    amount: 5,
    asset: 'USDT'
  })
  submitRoundEvidence(service.harness.worker)

  const result = await service.settleGameRoundWithReceipt({
    gameId,
    roundIndex: 0,
    shooter,
    keeper,
    escrowId: escrowEvent.payload.escrowId,
    winnerUserId: shooter.id,
    refundOnDispute: true,
    refundReason: 'trusted-referee-held'
  })

  assert.equal(result.summary.type, 'TrustedGameSettlementHeld')
  assert.equal(result.summary.status, 'refunded')
  assert.equal(result.summary.settlementEvent.type, 'TetherWdkEscrowRefunded')
  assert.equal(result.receiptHeld, false)
  assert.equal(result.receiptEvent.type, 'SettlementReceiptCreated')
  assert.equal(result.receipt.settlementType, 'game-round')
  assert.equal(result.receipt.status, 'refunded')
  assert.equal(result.receipt.wdk.eventType, 'TetherWdkEscrowRefunded')
  assert.equal(result.receipt.wdk.refundId, result.summary.settlementEvent.payload.refundId)
  assert.equal(result.receipt.wdk.refundUserIdsHash, receipts.listHash([shooter.id, keeper.id]))
  assert.equal(result.receipt.wdk.reason, 'trusted-referee-held')

  await service.close()
})

test('guarded settlement service delegates receipt settlement to native worker bridge methods', async () => {
  const calls = []
  const harness = {
    status () {
      return {
        id: 'native-bridge-harness',
        mode: { qvac: 'sdk', tetherWdk: 'sdk' },
        readiness: {
          qvac: { sdkReady: true },
          tetherWdk: { sdkReady: true },
          compliance: {
            realMoneyEnabled: true,
            kycVerified: true,
            jurisdictionAllowed: true,
            responsiblePlayAccepted: true
          },
          settlement: {
            status: 'live-ready',
            label: 'Live settlement ready',
            tone: 'ready'
          }
        },
        canUseRealMoney: true
      }
    },
    async settleBracketPoolWithReceipt (payload, opts) {
      calls.push({ payload, opts })
      return {
        summary: { type: 'TrustedPoolSettlementCompleted', poolId: payload.poolId },
        receipt: { receiptHash: 'native-receipt-hash' },
        receiptEvent: { type: 'SettlementReceiptCreated', eventId: 'evt-native-receipt' }
      }
    },
    async dispatchAsync () {
      throw new Error('native receipt path should not fall back to dispatchAsync')
    }
  }
  const service = settlementService.createGuardedSettlementService({
    workerRuntime: harness,
    requireLive: true
  })

  const result = await service.settleBracketPoolWithReceipt(
    { poolId: 'pool-native-receipt', winnerUserIds: [shooter.id] },
    { actorId: 'settlement-worker' }
  )

  assert.equal(result.summary.type, 'TrustedPoolSettlementCompleted')
  assert.equal(result.receiptEvent.type, 'SettlementReceiptCreated')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].payload.poolId, 'pool-native-receipt')
  assert.equal(calls[0].opts.actorId, 'settlement-worker')
})

test('guarded settlement service blocks SDK-ready settlement until compliance is live', async () => {
  const fakeSdk = createFakeSdkRuntime()
  const service = settlementService.createGuardedSettlementService({
    settings: baseSettings({ sdk: true, live: false }),
    rootObject: { PearCupSdkRuntime: fakeSdk.sdk }
  })
  const status = service.status()

  assert.equal(status.mode.qvac, 'sdk')
  assert.equal(status.mode.tetherWdk, 'sdk')
  assert.equal(status.settlementGate.status, 'compliance-locked')

  await assert.rejects(
    () => service.createGameEscrow({
      gameId,
      players: [shooter.id, keeper.id],
      amount: 10,
      asset: 'USDT'
    }),
    (err) => {
      assert.equal(err.code, settlementService.SETTLEMENT_LOCKED_CODE)
      assert.match(err.message, /real money mode is not enabled/)
      assert.match(err.message, /KYC is not verified/)
      return true
    }
  )

  await service.close()
})

test('guarded settlement service runs live game settlement through QVAC before WDK', async () => {
  const fakeSdk = createFakeSdkRuntime()
  const service = settlementService.createGuardedSettlementService({
    settings: baseSettings({ sdk: true, live: true }),
    rootObject: { PearCupSdkRuntime: fakeSdk.sdk }
  })
  const status = service.status()

  assert.equal(status.settlementGate.liveReady, true)
  assert.equal(status.settings.sdkPackages.tetherWdk.seedPhrase, '[redacted]')
  assert.equal(JSON.stringify(status).includes('valid settlement service seed phrase'), false)

  const escrowEvent = await service.createGameEscrow({
    gameId,
    players: [shooter.id, keeper.id],
    amount: 10,
    asset: 'USDT'
  })
  submitRoundEvidence(service.harness.worker)

  const result = await service.settleGameRoundWithReceipt({
    gameId,
    roundIndex: 0,
    shooter,
    keeper,
    escrowId: escrowEvent.payload.escrowId
  })
  const { summary } = result

  assert.equal(summary.type, 'TrustedGameSettlementCompleted')
  assert.equal(summary.attestationEvent.type, 'QvacRefereeAttestationCreated')
  assert.equal(summary.settlementEvent.type, 'TetherWdkEscrowReleased')
  assert.ok(summary.roundEvent.sequence < summary.attestationEvent.sequence)
  assert.ok(summary.attestationEvent.sequence < summary.settlementEvent.sequence)
  assert.equal(summary.settlementEvent.payload.winnerUserId, keeper.id)
  const recordedReceipt = result
  const repeatedReceipt = await service.recordSettlementReceipt(summary)
  assert.equal(recordedReceipt.receiptEvent.type, 'SettlementReceiptCreated')
  assert.equal(recordedReceipt.receipt.settlementType, 'game-round')
  assert.equal(recordedReceipt.receipt.gate.status, 'live-ready')
  assert.equal(recordedReceipt.receipt.provenance.qvac.source, 'package:@qvac/sdk')
  assert.equal(recordedReceipt.receipt.provenance.tetherWdk.source, 'package:@tetherto/wdk')
  assert.equal(recordedReceipt.receipt.provenance.settings.tetherWdkSeedRedacted, true)
  assert.equal(recordedReceipt.receipt.provenance.settlement.status, 'live-ready')
  assert.equal(JSON.stringify(recordedReceipt.receipt).includes('valid settlement service seed phrase'), false)
  assert.equal(recordedReceipt.receipt.qvac.attestationId, summary.attestationEvent.payload.attestationId)
  assert.equal(recordedReceipt.receipt.wdk.qvacAttestationId, recordedReceipt.receipt.qvac.attestationId)
  assert.equal(repeatedReceipt.existing, true)
  assert.equal(repeatedReceipt.receiptEvent.eventId, recordedReceipt.receiptEvent.eventId)
  assert.equal(service.harness.worker.view().settlementReceiptsBySettlementEvent[summary.settlementEvent.eventId].receiptId, recordedReceipt.receipt.receiptId)

  await service.close()
})

test('guarded settlement service runs live bracket settlement through QVAC before WDK payout', async () => {
  const fakeSdk = createFakeSdkRuntime()
  const service = settlementService.createGuardedSettlementService({
    settings: baseSettings({ sdk: true, live: true }),
    rootObject: { PearCupSdkRuntime: fakeSdk.sdk }
  })
  const poolId = 'pool-settlement-service'

  const captainIntent = await service.createEntryIntent({
    poolId,
    entryId: 'entry-captain',
    userId: shooter.id,
    username: shooter.username,
    amount: 25,
    asset: 'USDT'
  })
  const veraIntent = await service.createEntryIntent({
    poolId,
    entryId: 'entry-vera',
    userId: keeper.id,
    username: keeper.username,
    amount: 25,
    asset: 'USDT'
  })
  const captainPayment = await service.reconcileEntryIntent({
    intentId: captainIntent.payload.intentId,
    confirmationId: 'captain-confirmed'
  })
  const veraPayment = await service.reconcileEntryIntent({
    intentId: veraIntent.payload.intentId,
    confirmationId: 'vera-confirmed'
  })
  const officialResults = {
    champion: 'Brazil',
    source: 'signed-results-feed'
  }
  await service.recordOfficialResultsSnapshot({
    poolId,
    officialResults,
    source: 'signed-results-feed',
    sourceActorId: 'signed-results-feed',
    rulesVersion: 'bracket-pool-v1'
  }, { actorId: 'signed-results-feed' })

  const result = await service.settleBracketPoolWithReceipt({
    poolId,
    confirmedEntries: [captainPayment.payload, veraPayment.payload],
    winnerUserIds: [shooter.id],
    officialResults,
    officialResultsSourceActorId: 'signed-results-feed',
    asset: 'USDT',
    rulesVersion: 'bracket-pool-v1'
  })
  const { summary } = result

  assert.equal(summary.type, 'TrustedPoolSettlementCompleted')
  assert.equal(summary.attestationEvent.type, 'QvacPoolSettlementAttestationCreated')
  assert.equal(summary.settlementEvent.type, 'TetherWdkPoolPayoutPrepared')
  assert.ok(summary.poolResultEvent.sequence < summary.attestationEvent.sequence)
  assert.ok(summary.attestationEvent.sequence < summary.settlementEvent.sequence)
  assert.equal(summary.settlementEvent.payload.grossPool, 50)
  assert.deepEqual(summary.settlementEvent.payload.winnerUserIds, [shooter.id])
  assert.equal(result.receiptEvent.type, 'SettlementReceiptCreated')
  assert.equal(result.receipt.settlementType, 'bracket-pool')
  assert.equal(result.receipt.pool.poolId, poolId)
  assert.equal(result.receipt.wdk.qvacAttestationId, result.receipt.qvac.attestationId)
  assert.equal(service.harness.worker.view().settlementReceiptsBySettlementEvent[summary.settlementEvent.eventId].receiptId, result.receipt.receiptId)

  await service.close()
})
