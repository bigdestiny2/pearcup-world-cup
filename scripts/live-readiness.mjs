#!/usr/bin/env node
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const core = require('../app/core.js')
const runtimeSettings = require('../app/runtime-settings.js')
const workerRuntime = require('../app/worker-runtime.js')
const settlementService = require('../app/settlement-service.js')
const liveReadiness = require('../app/live-readiness.js')

const args = new Set(process.argv.slice(2))
const jsonOutput = args.has('--json')
const requireLive = args.has('--require-live') || process.env.PEARCUP_REQUIRE_LIVE === '1'
const runSmoke = !args.has('--no-smoke') && process.env.PEARCUP_DOCTOR_SMOKE !== '0'

const gameId = 'pc-live-readiness-doctor'
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
}

async function runTrustedGameSmoke (service) {
  const escrowEvent = await service.createGameEscrow({
    gameId,
    players: [shooter.id, keeper.id],
    amount: 1,
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
  const summary = result.summary
  const receipt = result.receipt
  return {
    ok: summary.type === 'TrustedGameSettlementCompleted',
    label: `${summary.attestationEvent && summary.attestationEvent.type} -> ${summary.settlementEvent && summary.settlementEvent.type}`,
    eventCount: service.harness.worker.events().length,
    escrowId: escrowEvent.payload.escrowId,
    paymentUri: escrowEvent.payload.paymentUri || null,
    qvacAttestationId: summary.attestationEvent && summary.attestationEvent.payload.attestationId,
    settlementEventId: summary.settlementEvent && summary.settlementEvent.eventId,
    receipt: {
      receiptId: receipt.receiptId,
      receiptHash: receipt.receiptHash,
      settlementType: receipt.settlementType,
      eventRoot: receipt.eventRoot,
      eventId: result.receiptEvent.eventId,
      provenance: {
        settingsHash: receipt.provenance && receipt.provenance.settings && receipt.provenance.settings.redactedHash,
        qvacSource: receipt.provenance && receipt.provenance.qvac && receipt.provenance.qvac.source,
        tetherWdkSource: receipt.provenance && receipt.provenance.tetherWdk && receipt.provenance.tetherWdk.source,
        settlementStatus: receipt.provenance && receipt.provenance.settlement && receipt.provenance.settlement.status
      }
    }
  }
}

async function main () {
  const settings = runtimeSettings.loadRuntimeSettings()
  const harness = workerRuntime.createPearCupWorkerRuntime({ settings })
  const service = settlementService.createGuardedSettlementService({ workerRuntime: harness })
  let status = service.status()
  let smoke = null

  try {
    if (status.settlementGate.liveReady && runSmoke) {
      smoke = await runTrustedGameSmoke(service)
      status = service.status()
    } else if (status.settlementGate.liveReady) {
      smoke = { ok: true, label: 'skipped by --no-smoke' }
    } else {
      smoke = { ok: true, label: 'skipped until live-ready' }
    }

    const report = liveReadiness.createLiveReadinessReport({ settings, status, smoke })
    if (jsonOutput) console.log(JSON.stringify(report, null, 2))
    else console.log(liveReadiness.formatLiveReadinessReport(report))

    if (requireLive && !report.liveReady) process.exitCode = 1
    if (report.liveReady && smoke && smoke.ok === false) process.exitCode = 1
  } finally {
    await service.close()
  }
}

main().catch((err) => {
  if (jsonOutput) console.error(JSON.stringify({ error: err.message }, null, 2))
  else console.error(`not ok - ${err.message}`)
  process.exitCode = 1
})
