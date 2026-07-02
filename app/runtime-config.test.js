const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')
require('./adapters.js')
require('./qvac-referee.js')
require('./tether-wdk-bridge.js')
require('./worker-sim.js')
const runtimeConfig = require('./runtime-config.js')
const storageSim = require('./storage-sim.js')

function qvacSdk () {
  return {
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
  }
}

function tetherWdkSdk () {
  return {
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
    disputeGameEscrow () {
      return { disputeId: 'sdk-dispute', status: 'held' }
    }
  }
}

test('runtime config falls back to locked demo settlement', () => {
  const runtime = runtimeConfig.createRuntimeConfig({ rootObject: {}, forceDemo: true })

  assert.equal(runtime.mode.qvac, 'demo')
  assert.equal(runtime.mode.tetherWdk, 'demo')
  assert.equal(runtime.readiness.settlement.status, 'demo-locked')
  assert.equal(runtime.canUseRealMoney, false)
  assert.deepEqual(runtime.readiness.qvac.missing, ['attestRound', 'attestPoolSettlement'])
})

test('runtime config detects SDK clients from supported globals', () => {
  const runtime = runtimeConfig.createRuntimeConfig({
    rootObject: {
      QVAC: qvacSdk(),
      TetherWDK: tetherWdkSdk()
    }
  })

  assert.equal(runtime.mode.qvac, 'sdk')
  assert.equal(runtime.mode.tetherWdk, 'sdk')
  assert.equal(runtime.readiness.qvac.source, 'global:QVAC')
  assert.equal(runtime.readiness.tetherWdk.source, 'global:TetherWDK')
  assert.equal(runtime.readiness.settlement.status, 'compliance-locked')
})

test('runtime config reports partial globals without crashing boot', () => {
  const runtime = runtimeConfig.createRuntimeConfig({
    rootObject: {
      QVAC: {},
      TetherWDK: { createGameEscrow () {} }
    }
  })

  assert.equal(runtime.mode.qvac, 'demo')
  assert.equal(runtime.mode.tetherWdk, 'demo')
  assert.equal(runtime.readiness.qvac.sdkDetected, true)
  assert.deepEqual(runtime.readiness.qvac.missing, ['attestRound', 'attestPoolSettlement'])
  assert.deepEqual(runtime.readiness.tetherWdk.missing, ['releaseGameEscrow', 'createEntryIntent', 'confirmEntryIntent', 'createPoolPayout'])
  assert.equal(runtime.readiness.settlement.status, 'demo-locked')
})

test('runtime config only enables real money when SDKs and compliance gates are ready', () => {
  const runtime = runtimeConfig.createRuntimeConfig({
    qvac: qvacSdk(),
    tetherWdk: tetherWdkSdk(),
    compliance: {
      realMoneyEnabled: true,
      kycVerified: true,
      jurisdictionAllowed: true,
      responsiblePlayAccepted: true
    }
  })

  assert.equal(runtime.readiness.qvac.sdkReady, true)
  assert.equal(runtime.readiness.tetherWdk.sdkReady, true)
  assert.equal(runtime.readiness.settlement.status, 'live-ready')
  assert.equal(runtime.canUseRealMoney, true)
})

test('runtime worker factory injects configured adapters', () => {
  const runtime = runtimeConfig.createRuntimeConfig({
    qvac: qvacSdk(),
    tetherWdk: tetherWdkSdk(),
    compliance: {
      realMoneyEnabled: true,
      kycVerified: true,
      jurisdictionAllowed: true,
      responsiblePlayAccepted: true
    }
  })
  const worker = runtime.createWorker()

  assert.equal(worker.adapterMode().qvac, 'sdk')
  assert.equal(worker.adapterMode().tetherWdk, 'sdk')
})

test('runtime worker factory passes storage through to the worker', () => {
  const runtime = runtimeConfig.createRuntimeConfig({ forceDemo: true })
  const store = storageSim.createEventStore({
    backend: storageSim.createMemoryBackend(),
    rootId: 'runtime-test',
    namespace: storageSim.gameNamespace('pc-runtime-storage')
  })
  const worker = runtime.createWorker({ storage: store })

  worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'system',
    payload: { gameId: 'pc-runtime-storage', players: ['user-a', 'user-b'], amount: 5, asset: 'USDT' }
  })

  assert.equal(store.snapshot().events, 1)
  assert.equal(store.snapshot().eventRoot, worker.view().eventRoot)
})

test('runtime config wraps QVAC completion and WDK processor globals', async () => {
  const runtime = runtimeConfig.createRuntimeConfig({
    rootObject: {
      PearCupQvacModelId: 'qvac-runtime-test',
      PearCupQVACCompletion: async () => '{"ruling":"verified","confidence":0.9,"rationale":"Runtime QVAC reviewed the evidence."}',
      PearCupTetherWDKProcessor: {
        async createTransaction (input) {
          return { id: `wdk-${input.reference}`, status: 'captured', address: '0xruntime', chain: 'ethereum' }
        },
        async collectPaymentMethod (transaction) {
          return transaction
        },
        async confirmPayment () {
          return { status: 'captured' }
        }
      }
    },
    compliance: {
      realMoneyEnabled: true,
      kycVerified: true,
      jurisdictionAllowed: true,
      responsiblePlayAccepted: true
    }
  })

  assert.equal(runtime.mode.qvac, 'sdk')
  assert.equal(runtime.mode.tetherWdk, 'sdk')
  assert.equal(runtime.mode.qvacCommentary, 'sdk')
  assert.equal(runtime.readiness.qvac.source, 'global:PearCupQVACCompletion')
  assert.equal(runtime.readiness.tetherWdk.source, 'global:PearCupTetherWDKProcessor')
  assert.equal(runtime.canUseRealMoney, true)

  const commentary = await runtime.adapters.qvacCommentary.generateSegment({
    matchId: 'match-runtime',
    language: 'FR',
    clock: '64:10',
    recentEvents: [{
      eventId: 'evt-runtime-shot',
      matchId: 'match-runtime',
      clock: '64:10',
      type: 'shot',
      teamId: 'br'
    }],
    currentStats: { matchId: 'match-runtime', clock: '64:10', score: { br: 2, no: 1 } }
  })
  assert.equal(commentary.language, 'FR')
  assert.equal(commentary.modelId, 'qvac-runtime-test')
  assert.deepEqual(commentary.sourceEventIds, ['evt-runtime-shot'])

  const worker = runtime.createWorker()
  const intent = await worker.dispatchAsync({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-runtime', entryId: 'entry-runtime', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })

  assert.equal(intent.payload.receiveAddress, '0xruntime')
})

test('runtime config creates package-backed QVAC and Tether WDK adapters from sdkPackages', async () => {
  const balances = [0n, 25000000n]
  const account = {
    async getAddress () {
      return '0xpackageconfig'
    },
    async getTokenBalance () {
      const nextBalance = balances.shift()
      return nextBalance === undefined ? 25000000n : nextBalance
    }
  }
  class FakeWDK {
    static isValidSeed (seed) {
      return seed === 'valid seed phrase'
    }

    registerWallet () {
      return this
    }

    async getAccount () {
      return account
    }
  }

  const runtime = runtimeConfig.createRuntimeConfig({
    sdkPackages: {
      qvac: {
        sdk: {
          LLAMA_3_2_1B_INST_Q4_0: 'package-qvac-model',
          async loadModel () {
            return 'package-qvac-runtime'
          },
          completion () {
            return { tokenStream: ['{"ruling":"verified","confidence":0.96,"rationale":"Package QVAC referee verified the state hash."}'] }
          }
        },
        modelId: 'qvac-package-runtime-test'
      },
      tetherWdk: {
        seedPhrase: 'valid seed phrase',
        wdkModules: {
          WDK: FakeWDK,
          WalletManagerEvm: class WalletManagerEvm {},
          WalletManagerBtc: class WalletManagerBtc {}
        },
        assets: ['usdt-evm']
      }
    },
    compliance: {
      realMoneyEnabled: true,
      kycVerified: true,
      jurisdictionAllowed: true,
      responsiblePlayAccepted: true
    }
  })

  assert.equal(runtime.mode.qvac, 'sdk')
  assert.equal(runtime.mode.tetherWdk, 'sdk')
  assert.equal(runtime.mode.qvacCommentary, 'sdk')
  assert.equal(runtime.readiness.qvac.source, 'package:@qvac/sdk')
  assert.equal(runtime.readiness.tetherWdk.source, 'package:@tetherto/wdk')
  assert.equal(runtime.canUseRealMoney, true)

  const roundResult = core.createPenaltyClashRound({
    gameId: 'pc-package-runtime',
    roundIndex: 0,
    shooter: { id: 'user-captain', username: 'captain' },
    keeper: { id: 'user-vera', username: 'vera' },
    shooterInput: { role: 'shooter', aimZone: 'right-high', powerBand: 3, curveBand: 1, releaseTick: 42 },
    keeperInput: { role: 'keeper', diveZone: 'right-high', releaseTick: 43 }
  })
  const attestation = await runtime.adapters.qvac.attestRound({ roundResult })
  assert.equal(attestation.review.modelId, 'qvac-package-runtime-test')
  assert.match(attestation.rationale, /Package QVAC referee/)
  const commentary = await runtime.adapters.qvacCommentary.generateSegment({
    matchId: 'match-package',
    language: 'EN',
    clock: '64:10',
    recentEvents: [{
      eventId: 'evt-package-shot',
      matchId: 'match-package',
      clock: '64:10',
      type: 'shot',
      teamId: 'br'
    }],
    currentStats: { matchId: 'match-package', clock: '64:10', score: { br: 2, no: 1 } }
  })
  assert.equal(commentary.modelId, 'qvac-package-runtime-test')
  assert.deepEqual(commentary.sourceEventIds, ['evt-package-shot'])

  const worker = runtime.createWorker()
  const intent = await worker.dispatchAsync({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-package', entryId: 'entry-package', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  assert.equal(intent.payload.receiveAddress, '0xpackageconfig')
  assert.equal(intent.payload.rail, 'tether-wdk-package')

  await runtime.close()
})
