#!/usr/bin/env node
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const core = require('../app/core.js')
const runtimeSettings = require('../app/runtime-settings.js')
const workerRuntime = require('../app/worker-runtime.js')
const settlementService = require('../app/settlement-service.js')

const gameId = 'pc-worker-runtime-preflight'
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

function ok (message, detail) {
  console.log(`ok - ${message}${detail ? `: ${detail}` : ''}`)
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
}

async function runTrustedGameSmoke (service) {
  const escrowEvent = await service.createGameEscrow({
    gameId,
    players: [shooter.id, keeper.id],
    amount: 1,
    asset: 'USDT'
  })
  submitRoundEvidence(service.harness.worker)

  const summary = await service.settleGameRound({
    gameId,
    roundIndex: 0,
    shooter,
    keeper,
    escrowId: escrowEvent.payload.escrowId
  })

  if (summary.type !== 'TrustedGameSettlementCompleted') {
    throw new Error(`trusted settlement smoke did not complete: ${summary.type}`)
  }
  ok('trusted worker settlement smoke', `${summary.attestationEvent.type} -> ${summary.settlementEvent.type}`)
  if (escrowEvent.payload.paymentUri) ok('wdk escrow payment uri', escrowEvent.payload.paymentUri)
}

async function main () {
  console.log('PearCup worker runtime preflight')
  const settings = runtimeSettings.loadRuntimeSettings()
  ok(
    settings.source.loaded ? 'runtime settings loaded' : 'runtime settings file skipped',
    settings.source.path
  )

  const harness = workerRuntime.createPearCupWorkerRuntime({ settings })
  const service = settlementService.createGuardedSettlementService({ workerRuntime: harness })
  const status = service.status()
  const statusText = JSON.stringify(status)
  const seed = settings.sdkPackages &&
    settings.sdkPackages.tetherWdk &&
    settings.sdkPackages.tetherWdk.seedPhrase

  if (seed && statusText.includes(seed)) {
    throw new Error('worker runtime status leaked the WDK seed phrase')
  }

  ok('worker runtime mode', JSON.stringify(status.mode))
  ok('worker runtime settlement readiness', status.readiness.settlement.status)
  ok('worker settlement guard', status.guardMode)
  if (seed) ok('worker runtime status redacts WDK seed')

  if (status.settlementGate.liveReady) {
    await runTrustedGameSmoke(service)
  } else {
    ok('trusted settlement smoke skipped', 'requires SDK-ready QVAC, SDK-ready WDK, and all compliance flags')
  }

  await service.close()
  console.log('PearCup worker runtime preflight passed.')
}

main().catch((err) => {
  console.error(`not ok - ${err.message}`)
  process.exitCode = 1
})
