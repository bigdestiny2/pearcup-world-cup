const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')
const { createWorkerSim } = require('./worker-sim.js')
const receipts = require('./settlement-receipts.js')

const gameId = 'pc-receipt-game'
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

function recordOfficialResultsSnapshot (worker, {
  poolId,
  officialResults = { champion: 'Brazil' },
  rulesVersion = 'bracket-pool-v1',
  source = 'trusted-results-feed',
  sourceActorId = 'official-results-feed'
} = {}) {
  return worker.dispatch({
    type: 'results:recordOfficialSnapshot',
    actorId: sourceActorId,
    payload: { poolId, officialResults, rulesVersion, source, sourceActorId }
  })
}

function resealReceipt (receipt) {
  const { receiptId, receiptHash, ...payload } = receipt
  const nextHash = core.deterministicHash(payload)
  return {
    receiptId: core.deterministicHash({ receiptVersion: payload.receiptVersion, receiptHash: nextHash }),
    receiptHash: nextHash,
    ...payload
  }
}

test('settlement receipt binds QVAC attestation and WDK release to the event root', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const receipt = receipts.createSettlementReceipt({
    summary,
    eventRoot: worker.view().eventRoot,
    gate: {
      liveReady: false,
      status: 'demo-locked',
      label: 'Demo settlement locked',
      tone: 'locked',
      mode: { qvac: 'demo', tetherWdk: 'demo' },
      missing: []
    }
  })
  const repeat = receipts.createSettlementReceipt({
    summary,
    eventRoot: worker.view().eventRoot,
    gate: {
      liveReady: false,
      status: 'demo-locked',
      label: 'Demo settlement locked',
      tone: 'locked',
      mode: { qvac: 'demo', tetherWdk: 'demo' },
      missing: []
    }
  })

  assert.equal(receipt.settlementType, 'game-round')
  assert.equal(receipt.completed, true)
  assert.equal(receipt.eventRoot, worker.view().eventRoot)
  assert.equal(receipt.events.attestation.actorId, summary.attestationEvent.actorId)
  assert.equal(receipt.events.settlement.actorId, summary.settlementEvent.actorId)
  assert.equal(receipt.qvac.eventActorId, summary.attestationEvent.actorId)
  assert.equal(receipt.qvac.eventActorId, receipt.qvac.refereeId)
  assert.equal(receipt.qvac.attestationId, summary.attestationEvent.payload.attestationId)
  assert.equal(receipt.qvac.stateHash, summary.roundEvent.payload.stateHash)
  assert.equal(receipt.qvac.winnerUserIdHash, core.deterministicHash(keeper.id))
  assert.equal(receipt.qvac.participantUserIdsHash, receipts.listHash([shooter.id, keeper.id]))
  assert.equal(receipt.wdk.eventActorId, summary.settlementEvent.actorId)
  assert.equal(receipt.wdk.eventActorId, receipt.wdk.rail)
  assert.equal(receipt.wdk.qvacAttestationId, receipt.qvac.attestationId)
  assert.equal(receipt.wdk.escrowId, escrowEvent.payload.escrowId)
  assert.equal(receipt.receiptId, repeat.receiptId)
  assert.deepEqual(receipts.verifySettlementReceipt(receipt), { ok: true, errors: [] })

  const receiptEvent = worker.dispatch({
    type: 'settlement:recordReceipt',
    actorId: 'settlement-auditor',
    payload: { receipt }
  })
  const eventCount = worker.events().length
  const duplicateReceiptEvent = worker.dispatch({
    type: 'settlement:recordReceipt',
    actorId: 'settlement-auditor',
    payload: { receipt }
  })
  const view = worker.view()

  assert.equal(receiptEvent.type, 'SettlementReceiptCreated')
  assert.equal(receiptEvent.payload.receiptId, receipt.receiptId)
  assert.equal(duplicateReceiptEvent.eventId, receiptEvent.eventId)
  assert.equal(worker.events().length, eventCount)
  assert.equal(view.settlementReceipts[receipt.receiptId].receiptHash, receipt.receiptHash)
  assert.equal(view.settlementReceiptsBySettlementEvent[summary.settlementEvent.eventId].receiptId, receipt.receiptId)
})

test('settlement receipt verification rejects resealed QVAC to WDK game mismatches', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const receipt = receipts.createSettlementReceipt({
    summary,
    eventRoot: worker.view().eventRoot
  })

  const wrongWinner = resealReceipt({
    ...receipt,
    wdk: {
      ...receipt.wdk,
      winnerUserId: shooter.id
    }
  })
  const winnerVerification = receipts.verifySettlementReceipt(wrongWinner)
  assert.equal(winnerVerification.ok, false)
  assert.match(winnerVerification.errors.join('; '), /WDK winner does not match QVAC winner/)

  const missingLink = resealReceipt({
    ...receipt,
    wdk: {
      ...receipt.wdk,
      qvacAttestationId: null
    }
  })
  const linkVerification = receipts.verifySettlementReceipt(missingLink)
  assert.equal(linkVerification.ok, false)
  assert.match(linkVerification.errors.join('; '), /WDK settlement must reference QVAC attestation id/)

  const wrongParticipants = resealReceipt({
    ...receipt,
    qvac: {
      ...receipt.qvac,
      participantUserIdsHash: receipts.listHash([shooter.id, 'user-not-in-round'])
    }
  })
  const participantVerification = receipts.verifySettlementReceipt(wrongParticipants)
  assert.equal(participantVerification.ok, false)
  assert.match(participantVerification.errors.join('; '), /QVAC participants do not match game participants/)

  const disputedSettlement = resealReceipt({
    ...receipt,
    events: {
      ...receipt.events,
      settlement: {
        ...receipt.events.settlement,
        type: 'TetherWdkEscrowDisputed'
      }
    },
    wdk: {
      ...receipt.wdk,
      eventType: 'TetherWdkEscrowDisputed',
      status: 'held'
    }
  })
  const eventShapeVerification = receipts.verifySettlementReceipt(disputedSettlement)
  assert.equal(eventShapeVerification.ok, false)
  assert.match(eventShapeVerification.errors.join('; '), /TetherWdkEscrowReleased/)
  assert.match(eventShapeVerification.errors.join('; '), /prepared WDK settlement status/)

  const wrongQvacActor = resealReceipt({
    ...receipt,
    events: {
      ...receipt.events,
      attestation: {
        ...receipt.events.attestation,
        actorId: 'forged-qvac-ref'
      }
    },
    qvac: {
      ...receipt.qvac,
      eventActorId: 'forged-qvac-ref'
    }
  })
  const qvacActorVerification = receipts.verifySettlementReceipt(wrongQvacActor)
  assert.equal(qvacActorVerification.ok, false)
  assert.match(qvacActorVerification.errors.join('; '), /QVAC event actorId must match referee id/)

  const wrongWdkActor = resealReceipt({
    ...receipt,
    events: {
      ...receipt.events,
      settlement: {
        ...receipt.events.settlement,
        actorId: 'forged-wdk-rail'
      }
    },
    wdk: {
      ...receipt.wdk,
      eventActorId: 'forged-wdk-rail'
    }
  })
  const wdkActorVerification = receipts.verifySettlementReceipt(wrongWdkActor)
  assert.equal(wdkActorVerification.ok, false)
  assert.match(wdkActorVerification.errors.join('; '), /WDK event actorId must match rail/)
})

test('settlement receipt verification rejects tampered receipt payloads', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const receipt = receipts.createSettlementReceipt({
    summary,
    eventRoot: worker.view().eventRoot
  })
  const verification = receipts.verifySettlementReceipt({
    ...receipt,
    qvac: {
      ...receipt.qvac,
      stateHash: '0xtampered'
    }
  })

  assert.equal(verification.ok, false)
  assert.match(verification.errors.join('; '), /hash/)
})

test('worker rejects settlement receipts for stale event roots', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const receipt = receipts.createSettlementReceipt({
    summary,
    eventRoot: '0xstale'
  })
  const rejected = worker.dispatch({
    type: 'settlement:recordReceipt',
    actorId: 'settlement-auditor',
    payload: { receipt }
  })

  assert.equal(rejected.type, 'SettlementReceiptRejected')
  assert.match(rejected.payload.reason, /eventRoot/)
  assert.equal(worker.view().settlementReceiptRejections.length, 1)
  assert.equal(Object.keys(worker.view().settlementReceipts).length, 0)
})

test('runtime provenance snapshots redacted SDK and compliance readiness', () => {
  const provenance = receipts.createRuntimeProvenance({
    status: {
      id: 'pearcup-worker-runtime',
      mode: { qvac: 'sdk', tetherWdk: 'sdk' },
      guardMode: 'live-only',
      canUseRealMoney: true,
      settings: {
        source: { path: 'config/pearcup.runtime.json', loaded: true },
        sdkPackages: {
          qvac: { modelId: 'qvac-ref' },
          tetherWdk: { seedPhrase: '[redacted]', assets: ['usdt-evm'] }
        },
        compliance: {
          realMoneyEnabled: true,
          kycVerified: true,
          jurisdictionAllowed: true,
          responsiblePlayAccepted: true
        }
      },
      readiness: {
        qvac: {
          key: 'qvac',
          label: 'QVAC referee',
          mode: 'sdk',
          adapterId: 'qvac-sdk',
          source: 'package:@qvac/sdk',
          sdkDetected: true,
          sdkReady: true,
          missing: []
        },
        tetherWdk: {
          key: 'tetherWdk',
          label: 'Tether WDK rail',
          mode: 'sdk',
          adapterId: 'tether-wdk-sdk',
          source: 'package:@tetherto/wdk',
          sdkDetected: true,
          sdkReady: true,
          missing: []
        },
        compliance: {
          realMoneyEnabled: true,
          kycVerified: true,
          jurisdictionAllowed: true,
          responsiblePlayAccepted: true
        },
        settlement: {
          status: 'live-ready',
          label: 'Live settlement ready',
          tone: 'ready',
          realMoneyEnabled: true
        }
      },
      secrets: { wdkSeedExposed: false }
    }
  })

  assert.equal(provenance.settings.source.loaded, true)
  assert.equal(provenance.settings.tetherWdkSeedRedacted, true)
  assert.equal(provenance.qvac.source, 'package:@qvac/sdk')
  assert.equal(provenance.tetherWdk.source, 'package:@tetherto/wdk')
  assert.equal(provenance.settlement.status, 'live-ready')
  assert.equal(provenance.secrets.wdkSeedExposed, false)
  assert.equal(JSON.stringify(provenance).includes('valid seed'), false)
})

test('settlement receipt verification rejects provenance that exposes WDK seed state', () => {
  const worker = createWorkerSim()
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'tether-wdk-demo',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const receipt = receipts.createSettlementReceipt({
    summary,
    eventRoot: worker.view().eventRoot,
    provenance: {
      secrets: { wdkSeedExposed: true }
    }
  })
  const verification = receipts.verifySettlementReceipt(receipt)

  assert.equal(verification.ok, false)
  assert.match(verification.errors.join('; '), /WDK seed/)
})

test('game settlement receipt records WDK processor release evidence without raw recipients', () => {
  const recipient = '0xgamereleasewinner000000000000000000000000'
  const qvac = {
    id: 'qvac-game-release-receipt-test',
    mode: 'sdk',
    attestRound ({ roundResult }) {
      return core.createQvacRefereeAttestation({ roundResult, refereeId: 'qvac-game-release-receipt-test' })
    },
    attestPoolSettlement ({ poolResult }) {
      return core.createQvacPoolSettlementAttestation({ poolResult, refereeId: 'qvac-game-release-receipt-test' })
    }
  }
  const tetherWdk = {
    id: 'tether-wdk-game-release-receipt-test',
    mode: 'sdk',
    createGameEscrow (input) {
      return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-game-release-receipt-test' })
    },
    releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
      const payout = core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
      return {
        ...payout,
        processorRelease: {
          id: 'wdk-processor-release-receipt',
          status: 'quoted',
          escrowId: escrow.escrowId,
          winnerUserId,
          broadcast: false,
          transfers: [{
            userId: winnerUserId,
            reference: escrow.escrowId,
            asset: 'usdt-evm',
            chain: 'ethereum',
            sourceAccountIndex: 0,
            recipient,
            amount: payout.amount,
            baseAmount: '5000000',
            token: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            broadcast: false,
            status: 'quoted',
            hash: null,
            fee: '21000'
          }]
        }
      }
    },
    createEntryIntent (input) {
      return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-game-release-receipt-test' })
    },
    confirmEntryIntent (input) {
      return core.confirmTetherWdkEntryIntent(input)
    },
    createPoolPayout (input) {
      return core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-game-release-receipt-test' })
    }
  }
  const worker = createWorkerSim({
    adapters: {
      qvac,
      tetherWdk,
      mode: { qvac: 'sdk', tetherWdk: 'sdk' }
    }
  })
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'tether-wdk-game-release-receipt-test',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId
    }
  })
  const receipt = receipts.createSettlementReceipt({
    summary,
    eventRoot: worker.view().eventRoot
  })

  assert.equal(receipt.wdk.processorRelease.status, 'quoted')
  assert.equal(receipt.wdk.processorRelease.broadcast, false)
  assert.equal(receipt.wdk.processorRelease.transferCount, 1)
  assert.equal(receipt.wdk.processorRelease.transferStatuses.quoted, 1)
  assert.equal(receipt.wdk.processorRelease.winnerUserIdHash, core.deterministicHash(keeper.id))
  assert.equal(receipt.wdk.processorRelease.transfers[0].recipientHash, core.deterministicHash(recipient))
  assert.equal(receipt.wdk.processorRelease.transfers[0].userIdHash, core.deterministicHash(keeper.id))
  assert.equal(receipt.wdk.processorRelease.transfers[0].baseAmount, '5000000')
  assert.equal(receipt.wdk.processorRelease.transfersHash, core.deterministicHash(receipt.wdk.processorRelease.transfers))
  assert.equal(JSON.stringify(receipt).includes(recipient), false)
  assert.deepEqual(receipts.verifySettlementReceipt(receipt), { ok: true, errors: [] })

  const tampered = {
    ...receipt,
    wdk: {
      ...receipt.wdk,
      processorRelease: {
        ...receipt.wdk.processorRelease,
        transfers: [{
          ...receipt.wdk.processorRelease.transfers[0],
          baseAmount: '1'
        }]
      }
    }
  }
  const verification = receipts.verifySettlementReceipt(tampered)
  assert.equal(verification.ok, false)
  assert.match(verification.errors.join('; '), /processor release transfer hash/)
})

test('game settlement receipt records WDK processor refund evidence without raw recipients', () => {
  const firstRecipient = '0xrefundcaptain00000000000000000000000000'
  const secondRecipient = '0xrefundvera000000000000000000000000000'
  const qvac = {
    id: 'qvac-game-refund-receipt-test',
    mode: 'sdk',
    attestRound ({ roundResult }) {
      return core.createQvacRefereeAttestation({ roundResult, refereeId: 'qvac-game-refund-receipt-test' })
    },
    attestPoolSettlement ({ poolResult }) {
      return core.createQvacPoolSettlementAttestation({ poolResult, refereeId: 'qvac-game-refund-receipt-test' })
    }
  }
  const tetherWdk = {
    id: 'tether-wdk-game-refund-receipt-test',
    mode: 'sdk',
    createGameEscrow (input) {
      return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-game-refund-receipt-test' })
    },
    releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
      return core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
    },
    refundGameEscrow ({ escrow, reason, refundUserIds }) {
      const refund = core.refundTetherWdkEscrow({ escrow, reason, refundUserIds })
      return {
        ...refund,
        processorRefund: {
          id: 'wdk-processor-refund-receipt',
          status: 'refunded',
          escrowId: escrow.escrowId,
          broadcast: false,
          transfers: [{
            userId: shooter.id,
            reference: escrow.escrowId,
            asset: 'usdt-evm',
            chain: 'ethereum',
            sourceAccountIndex: 0,
            recipient: firstRecipient,
            amount: refund.amountEach,
            baseAmount: '2500000',
            token: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            broadcast: false,
            status: 'refunded',
            hash: null,
            fee: '21000'
          }, {
            userId: keeper.id,
            reference: escrow.escrowId,
            asset: 'usdt-evm',
            chain: 'ethereum',
            sourceAccountIndex: 0,
            recipient: secondRecipient,
            amount: refund.amountEach,
            baseAmount: '2500000',
            token: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            broadcast: false,
            status: 'refunded',
            hash: null,
            fee: '21000'
          }]
        }
      }
    },
    createEntryIntent (input) {
      return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-game-refund-receipt-test' })
    },
    confirmEntryIntent (input) {
      return core.confirmTetherWdkEntryIntent(input)
    },
    createPoolPayout (input) {
      return core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-game-refund-receipt-test' })
    }
  }
  const worker = createWorkerSim({
    adapters: {
      qvac,
      tetherWdk,
      mode: { qvac: 'sdk', tetherWdk: 'sdk' }
    }
  })
  const escrowEvent = worker.dispatch({
    type: 'wdk:createGameEscrow',
    actorId: 'tether-wdk-game-refund-receipt-test',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
  submitRoundEvidence(worker)
  const summary = worker.dispatch({
    type: 'settlement:settleGameRound',
    actorId: 'settlement-worker',
    payload: {
      gameId,
      roundIndex: 0,
      shooter,
      keeper,
      escrowId: escrowEvent.payload.escrowId,
      winnerUserId: shooter.id,
      refundOnDispute: true,
      refundReason: 'trusted-referee-held'
    }
  })
  const receipt = receipts.createSettlementReceipt({
    summary,
    eventRoot: worker.view().eventRoot
  })

  assert.equal(summary.status, 'refunded')
  assert.equal(receipt.wdk.eventType, 'TetherWdkEscrowRefunded')
  assert.equal(receipt.wdk.refundId, summary.settlementEvent.payload.refundId)
  assert.equal(receipt.wdk.refundUserIdsHash, receipts.listHash([shooter.id, keeper.id]))
  assert.equal(receipt.wdk.processorRefund.status, 'refunded')
  assert.equal(receipt.wdk.processorRefund.broadcast, false)
  assert.equal(receipt.wdk.processorRefund.transferCount, 2)
  assert.equal(receipt.wdk.processorRefund.transferStatuses.refunded, 2)
  assert.equal(receipt.wdk.processorRefund.transfers[0].recipientHash, core.deterministicHash(firstRecipient))
  assert.equal(receipt.wdk.processorRefund.transfers[1].recipientHash, core.deterministicHash(secondRecipient))
  assert.equal(receipt.wdk.processorRefund.transfersHash, core.deterministicHash(receipt.wdk.processorRefund.transfers))
  assert.equal(JSON.stringify(receipt).includes(firstRecipient), false)
  assert.equal(JSON.stringify(receipt).includes(secondRecipient), false)
  assert.deepEqual(receipts.verifySettlementReceipt(receipt), { ok: true, errors: [] })

  const tampered = {
    ...receipt,
    wdk: {
      ...receipt.wdk,
      processorRefund: {
        ...receipt.wdk.processorRefund,
        transfers: [{
          ...receipt.wdk.processorRefund.transfers[0],
          baseAmount: '1'
        }, receipt.wdk.processorRefund.transfers[1]]
      }
    }
  }
  const verification = receipts.verifySettlementReceipt(tampered)
  assert.equal(verification.ok, false)
  assert.match(verification.errors.join('; '), /processor refund transfer hash/)
})

test('pool settlement receipt records winner and payment evidence hashes', () => {
  const worker = createWorkerSim()
  const firstIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: shooter.id,
    payload: { poolId: 'pool-receipt', entryId: 'entry-captain', userId: shooter.id, username: shooter.username, amount: 25, asset: 'USDT' }
  })
  const secondIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: keeper.id,
    payload: { poolId: 'pool-receipt', entryId: 'entry-vera', userId: keeper.id, username: keeper.username, amount: 25, asset: 'USDT' }
  })
  const firstPayment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: firstIntent.payload.intentId, confirmationId: 'captain-confirmed' }
  })
  const secondPayment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-demo',
    payload: { intentId: secondIntent.payload.intentId, confirmationId: 'vera-confirmed' }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-receipt' })
  const summary = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId: 'pool-receipt',
      confirmedEntries: [firstPayment.payload, secondPayment.payload],
      winnerUserIds: [shooter.id],
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const receipt = receipts.createSettlementReceipt({
    summary,
    eventRoot: worker.view().eventRoot
  })

  assert.equal(receipt.settlementType, 'bracket-pool')
  assert.equal(receipt.pool.poolId, 'pool-receipt')
  assert.equal(receipt.pool.sourceEventMode, 'worker-log')
  assert.equal(receipt.pool.winnerUserIdsHash, receipts.listHash([shooter.id]))
  assert.equal(receipt.pool.officialResultsHash, summary.poolResultEvent.payload.officialResultsHash)
  assert.equal(receipt.qvac.officialResultsHash, receipt.pool.officialResultsHash)
  assert.equal(receipt.qvac.sourcePaymentIdsHash, receipts.listHash([firstPayment.payload.paymentId, secondPayment.payload.paymentId]))
  assert.equal(receipt.qvac.sourceEventIdsHash, receipt.pool.sourceEventIdsHash)
  assert.equal(receipt.wdk.grossPool, 50)
  assert.deepEqual(receipts.verifySettlementReceipt(receipt), { ok: true, errors: [] })

  const wrongWinners = resealReceipt({
    ...receipt,
    wdk: {
      ...receipt.wdk,
      winnerUserIds: [keeper.id]
    }
  })
  const winnerVerification = receipts.verifySettlementReceipt(wrongWinners)
  assert.equal(winnerVerification.ok, false)
  assert.match(winnerVerification.errors.join('; '), /WDK pool winners do not match QVAC winners/)

  const wrongSourceEvents = resealReceipt({
    ...receipt,
    qvac: {
      ...receipt.qvac,
      sourceEventIdsHash: receipts.listHash(['evt-not-from-worker-log'])
    }
  })
  const sourceVerification = receipts.verifySettlementReceipt(wrongSourceEvents)
  assert.equal(sourceVerification.ok, false)
  assert.match(sourceVerification.errors.join('; '), /QVAC source events do not match pool result/)

  const wrongOfficialResults = resealReceipt({
    ...receipt,
    qvac: {
      ...receipt.qvac,
      officialResultsHash: core.deterministicHash({ champion: 'Norway' })
    }
  })
  const officialResultsVerification = receipts.verifySettlementReceipt(wrongOfficialResults)
  assert.equal(officialResultsVerification.ok, false)
  assert.match(officialResultsVerification.errors.join('; '), /QVAC official results do not match pool result/)

  const disputedPayout = resealReceipt({
    ...receipt,
    events: {
      ...receipt.events,
      settlement: {
        ...receipt.events.settlement,
        type: 'TetherWdkPoolPayoutDisputed'
      }
    },
    qvac: {
      ...receipt.qvac,
      ruling: 'disputed'
    },
    wdk: {
      ...receipt.wdk,
      eventType: 'TetherWdkPoolPayoutDisputed',
      status: 'held'
    }
  })
  const payoutShapeVerification = receipts.verifySettlementReceipt(disputedPayout)
  assert.equal(payoutShapeVerification.ok, false)
  assert.match(payoutShapeVerification.errors.join('; '), /TetherWdkPoolPayoutPrepared/)
  assert.match(payoutShapeVerification.errors.join('; '), /verified QVAC ruling/)
  assert.match(payoutShapeVerification.errors.join('; '), /prepared WDK settlement status/)
})

test('pool settlement receipt records WDK processor payout evidence without raw recipients', () => {
  const recipient = '0xwinnerrecipient0000000000000000000000000000'
  const qvac = {
    id: 'qvac-receipt-processor-test',
    mode: 'sdk',
    attestRound ({ roundResult }) {
      return core.createQvacRefereeAttestation({ roundResult, refereeId: 'qvac-receipt-processor-test' })
    },
    attestPoolSettlement ({ poolResult }) {
      return core.createQvacPoolSettlementAttestation({ poolResult, refereeId: 'qvac-receipt-processor-test' })
    }
  }
  const tetherWdk = {
    id: 'tether-wdk-receipt-processor-test',
    mode: 'sdk',
    createGameEscrow (input) {
      return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-receipt-processor-test' })
    },
    releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
      return core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
    },
    createEntryIntent (input) {
      return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-receipt-processor-test' })
    },
    confirmEntryIntent (input) {
      return core.confirmTetherWdkEntryIntent(input)
    },
    createPoolPayout (input) {
      const payout = core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-receipt-processor-test' })
      return {
        ...payout,
        processorPayout: {
          id: 'wdk-processor-quote-receipt',
          status: 'quoted',
          poolId: input.poolId,
          broadcast: false,
          transfers: input.winnerUserIds.map(userId => ({
            userId,
            reference: `${input.poolId}:${userId}`,
            asset: 'usdt-evm',
            chain: 'ethereum',
            sourceAccountIndex: 0,
            recipient: input.payoutRecipients[userId],
            amount: payout.amountEach,
            baseAmount: '50000000',
            token: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            broadcast: false,
            status: 'quoted',
            hash: null,
            fee: '21000'
          }))
        }
      }
    }
  }
  const worker = createWorkerSim({
    adapters: {
      qvac,
      tetherWdk,
      mode: { qvac: 'sdk', tetherWdk: 'sdk' }
    }
  })
  const firstIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: shooter.id,
    payload: { poolId: 'pool-receipt-processor', entryId: 'entry-captain', userId: shooter.id, username: shooter.username, amount: 25, asset: 'USDT' }
  })
  const secondIntent = worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: keeper.id,
    payload: { poolId: 'pool-receipt-processor', entryId: 'entry-vera', userId: keeper.id, username: keeper.username, amount: 25, asset: 'USDT' }
  })
  const firstPayment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-receipt-processor-test',
    payload: { intentId: firstIntent.payload.intentId, confirmationId: 'captain-confirmed' }
  })
  const secondPayment = worker.dispatch({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-receipt-processor-test',
    payload: { intentId: secondIntent.payload.intentId, confirmationId: 'vera-confirmed' }
  })
  worker.dispatch({
    type: 'payout:declareRecipient',
    actorId: shooter.id,
    payload: {
      poolId: 'pool-receipt-processor',
      userId: shooter.id,
      username: shooter.username,
      recipient,
      asset: 'USDT'
    }
  })
  recordOfficialResultsSnapshot(worker, { poolId: 'pool-receipt-processor' })
  const summary = worker.dispatch({
    type: 'settlement:settleBracketPool',
    actorId: 'settlement-worker',
    payload: {
      poolId: 'pool-receipt-processor',
      confirmedEntries: [firstPayment.payload, secondPayment.payload],
      winnerUserIds: [shooter.id],
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }
  })
  const receipt = receipts.createSettlementReceipt({
    summary,
    eventRoot: worker.view().eventRoot
  })

  assert.equal(receipt.wdk.processorPayout.status, 'quoted')
  assert.equal(receipt.wdk.processorPayout.broadcast, false)
  assert.equal(receipt.wdk.processorPayout.transferCount, 1)
  assert.equal(receipt.wdk.processorPayout.transferStatuses.quoted, 1)
  assert.equal(receipt.wdk.processorPayout.transfers[0].recipientHash, core.deterministicHash(recipient))
  assert.equal(receipt.payoutRecipients.count, 1)
  assert.equal(receipt.payoutRecipients.declarations[0].recipientHash, core.deterministicHash(recipient))
  assert.equal(receipt.payoutRecipients.declarations[0].userIdHash, core.deterministicHash(shooter.id))
  assert.equal(receipt.payoutRecipients.declarationsHash, core.deterministicHash(receipt.payoutRecipients.declarations))
  assert.equal(receipt.wdk.processorPayout.transfers[0].userIdHash, core.deterministicHash(shooter.id))
  assert.equal(receipt.wdk.processorPayout.transfers[0].baseAmount, '50000000')
  assert.equal(receipt.wdk.processorPayout.transfersHash, core.deterministicHash(receipt.wdk.processorPayout.transfers))
  assert.equal(JSON.stringify(receipt).includes(recipient), false)
  assert.deepEqual(receipts.verifySettlementReceipt(receipt), { ok: true, errors: [] })

  const tampered = {
    ...receipt,
    wdk: {
      ...receipt.wdk,
      processorPayout: {
        ...receipt.wdk.processorPayout,
        transfers: [{
          ...receipt.wdk.processorPayout.transfers[0],
          baseAmount: '1'
        }]
      }
    }
  }
  const verification = receipts.verifySettlementReceipt(tampered)
  assert.equal(verification.ok, false)
  assert.match(verification.errors.join('; '), /hash/)

  const badStatusCounts = {
    ...receipt,
    wdk: {
      ...receipt.wdk,
      processorPayout: {
        ...receipt.wdk.processorPayout,
        transferStatuses: { broadcast: 1 }
      }
    }
  }
  const statusVerification = receipts.verifySettlementReceipt(badStatusCounts)
  assert.equal(statusVerification.ok, false)
  assert.match(statusVerification.errors.join('; '), /transfer status counts/)
})
