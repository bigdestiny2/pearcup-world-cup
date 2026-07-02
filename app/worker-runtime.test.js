const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')
const workerRuntime = require('./worker-runtime.js')

const gameId = 'pc-worker-runtime'
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
          id: 'qvac-worker-runtime-test',
          mode: 'sdk',
          async attestRound ({ roundResult }) {
            return core.createQvacRefereeAttestation({
              roundResult,
              refereeId: 'qvac-worker-runtime-test',
              review: {
                modelId: config.modelId,
                ruling: 'verified',
                confidence: 0.99,
                rationale: 'Worker runtime QVAC verified the complete round evidence.'
              }
            })
          },
          async attestPoolSettlement ({ poolResult }) {
            return core.createQvacPoolSettlementAttestation({
              poolResult,
              refereeId: 'qvac-worker-runtime-test',
              review: {
                modelId: config.modelId,
                ruling: poolResult.ruling,
                confidence: 0.98,
                rationale: 'Worker runtime QVAC verified the pool settlement evidence.'
              }
            })
          }
        }
      },
      createTetherWdkPackageAdapter (config) {
        seen.tetherWdk = config
        return {
          id: 'tether-wdk-worker-runtime-test',
          mode: 'sdk',
          async createGameEscrow (input) {
            return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-worker-runtime-test' })
          },
          async releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
            return core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
          },
          async createEntryIntent (input) {
            return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-worker-runtime-test' })
          },
          async confirmEntryIntent (input) {
            return core.confirmTetherWdkEntryIntent(input)
          },
          async createPoolPayout (input) {
            return core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-worker-runtime-test' })
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

function liveSettings () {
  return {
    source: {
      path: 'config/pearcup.runtime.test.json',
      loaded: true
    },
    sdkPackages: {
      qvac: {
        modelId: 'qvac-worker-runtime-model',
        autoUnload: true
      },
      tetherWdk: {
        seedPhrase: 'valid worker runtime seed phrase',
        assets: ['usdt-evm'],
        skipInitialBalanceProbe: true
      }
    },
    compliance: {
      realMoneyEnabled: true,
      kycVerified: true,
      jurisdictionAllowed: true,
      responsiblePlayAccepted: true
    }
  }
}

test('worker runtime creates SDK-backed trusted game settlements without exposing the WDK seed in status', async () => {
  const fakeSdk = createFakeSdkRuntime()
  const rootObject = { PearCupSdkRuntime: fakeSdk.sdk }
  const harness = workerRuntime.createPearCupWorkerRuntime({
    settings: liveSettings(),
    rootObject
  })
  const status = harness.status()

  assert.equal(rootObject.PearCupRuntimeSettingsValue, undefined)
  assert.equal(status.mode.qvac, 'sdk')
  assert.equal(status.mode.tetherWdk, 'sdk')
  assert.equal(status.readiness.settlement.status, 'live-ready')
  assert.equal(status.canUseRealMoney, true)
  assert.equal(status.settings.sdkPackages.tetherWdk.seedPhrase, '[redacted]')
  assert.equal(JSON.stringify(status).includes('valid worker runtime seed phrase'), false)
  assert.equal(fakeSdk.seen.tetherWdk.seedPhrase, 'valid worker runtime seed phrase')

  const escrowEvent = await harness.dispatchAsync({
    type: 'wdk:createGameEscrow',
    actorId: 'settlement-worker',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 10, asset: 'USDT' }
  })
  submitRoundEvidence(harness.worker)

  const summary = await harness.settleGameRound({
    gameId,
    roundIndex: 0,
    shooter,
    keeper,
    escrowId: escrowEvent.payload.escrowId
  })

  assert.equal(summary.type, 'TrustedGameSettlementCompleted')
  assert.equal(summary.status, 'prepared')
  assert.equal(summary.attestationEvent.payload.review.modelId, 'qvac-worker-runtime-model')
  assert.equal(summary.settlementEvent.payload.winnerUserId, keeper.id)
  assert.equal(summary.settlementEvent.payload.asset, 'USDT')

  await harness.close()
})

test('worker runtime settles bracket pools through QVAC attestation before WDK payout', async () => {
  const fakeSdk = createFakeSdkRuntime()
  const harness = workerRuntime.createPearCupWorkerRuntime({
    settings: liveSettings(),
    rootObject: { PearCupSdkRuntime: fakeSdk.sdk }
  })
  const poolId = 'pool-worker-runtime'
  const captainIntent = await harness.dispatchAsync({
    type: 'wdk:createEntryIntent',
    actorId: shooter.id,
    payload: { poolId, entryId: 'entry-captain', userId: shooter.id, username: shooter.username, amount: 25, asset: 'USDT' }
  })
  const veraIntent = await harness.dispatchAsync({
    type: 'wdk:createEntryIntent',
    actorId: keeper.id,
    payload: { poolId, entryId: 'entry-vera', userId: keeper.id, username: keeper.username, amount: 25, asset: 'USDT' }
  })
  const captainPayment = await harness.dispatchAsync({
    type: 'wdk:confirmEntryIntent',
    actorId: shooter.id,
    payload: { intentId: captainIntent.payload.intentId, confirmationId: 'captain-confirmed' }
  })
  const veraPayment = await harness.dispatchAsync({
    type: 'wdk:confirmEntryIntent',
    actorId: keeper.id,
    payload: { intentId: veraIntent.payload.intentId, confirmationId: 'vera-confirmed' }
  })
  const officialResults = {
    champion: 'Brazil',
    source: 'signed-results-feed'
  }
  await harness.dispatchAsync({
    type: 'results:recordOfficialSnapshot',
    actorId: 'signed-results-feed',
    payload: {
      poolId,
      officialResults,
      source: 'signed-results-feed',
      sourceActorId: 'signed-results-feed',
      rulesVersion: 'bracket-pool-v1'
    }
  })

  const summary = await harness.settleBracketPool({
    poolId,
    confirmedEntries: [captainPayment.payload, veraPayment.payload],
    winnerUserIds: [shooter.id],
    officialResults,
    officialResultsSourceActorId: 'signed-results-feed',
    asset: 'USDT',
    rulesVersion: 'bracket-pool-v1'
  })

  assert.equal(summary.type, 'TrustedPoolSettlementCompleted')
  assert.equal(summary.poolResultEvent.payload.ruling, 'verified')
  assert.equal(summary.attestationEvent.payload.ruling, 'verified')
  assert.equal(summary.settlementEvent.payload.grossPool, 50)
  assert.deepEqual(summary.settlementEvent.payload.winnerUserIds, [shooter.id])
  assert.equal(summary.settlementEvent.payload.rail, 'tether-wdk-worker-runtime-test')

  await harness.close()
})
