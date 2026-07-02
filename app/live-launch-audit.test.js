const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')
require('./adapters.js')
require('./qvac-referee.js')
require('./tether-wdk-bridge.js')
require('./sdk-runtime.js')
require('./runtime-config.js')
require('./runtime-settings.js')
require('./worker-runtime.js')
require('./settlement-receipts.js')
require('./settlement-service.js')
require('./live-readiness.js')
require('./trusted-path-preflight.js')
const launchAudit = require('./live-launch-audit.js')

function baseSettings ({
  live = false,
  defaultPayoutAddress = '',
  payoutRecipients = {},
  broadcastPayouts = false,
  qvacModelExport = 'LLAMA_3_2_1B_INST_Q4_0'
} = {}) {
  const qvac = {
    modelId: 'qvac-launch-audit-model'
  }
  if (qvacModelExport) qvac.modelExport = qvacModelExport
  return {
    source: {
      path: 'config/pearcup.launch-audit.test.json',
      loaded: true
    },
    sdkPackages: {
      qvac,
      tetherWdk: {
        seedPhrase: 'valid launch audit seed phrase',
        assets: ['usdt-evm'],
        evmProvider: 'https://rpc.example.invalid',
        defaultPayoutAddress,
        payoutRecipients,
        broadcastPayouts,
        quotePayouts: true,
        skipInitialBalanceProbe: false
      }
    },
    compliance: {
      realMoneyEnabled: live,
      kycVerified: live,
      jurisdictionAllowed: live,
      responsiblePlayAccepted: live
    }
  }
}

function createFakeSdkRuntime ({ onCreatePoolPayout, emptyPoolPayoutTransfers = false, emptyGameReleaseTransfers = false } = {}) {
  return {
    createQvacSdkRefereeAdapter (config) {
      return {
        id: 'qvac-launch-audit-test',
        mode: 'sdk',
        async attestRound ({ roundResult }) {
          return core.createQvacRefereeAttestation({
            roundResult,
            refereeId: 'qvac-launch-audit-test',
            review: {
              modelId: config.modelId,
              ruling: 'verified',
              confidence: 0.99,
              rationale: 'Launch audit QVAC verified round evidence.'
            }
          })
        },
        async attestPoolSettlement ({ poolResult }) {
          return core.createQvacPoolSettlementAttestation({
            poolResult,
            refereeId: 'qvac-launch-audit-test',
            review: {
              modelId: config.modelId,
              ruling: poolResult.ruling,
              confidence: 0.99,
              rationale: 'Launch audit QVAC verified pool evidence.'
            }
          })
        }
      }
    },
    createTetherWdkPackageAdapter () {
      return {
        id: 'tether-wdk-launch-audit-test',
        mode: 'sdk',
        async createGameEscrow (input) {
          return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-launch-audit-test' })
        },
        async releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
          const payout = core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
          return {
            ...payout,
            processorRelease: {
              id: `launch-audit-release-${escrow.escrowId}`,
              status: 'quoted',
              escrowId: escrow.escrowId,
              winnerUserId,
              broadcast: false,
              transfers: emptyGameReleaseTransfers ? [] : [{
                userId: winnerUserId,
                reference: escrow.escrowId,
                asset: 'usdt-evm',
                chain: 'ethereum',
                sourceAccountIndex: 0,
                recipient: '0xlaunchauditgamewinner000000000000000000000',
                amount: payout.amount,
                baseAmount: '1000000',
                token: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                broadcast: false,
                status: 'quoted',
                hash: null,
                fee: '21000'
              }]
            }
          }
        },
        async createEntryIntent (input) {
          return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-launch-audit-test' })
        },
        async confirmEntryIntent (input) {
          return core.confirmTetherWdkEntryIntent(input)
        },
        async createPoolPayout (input) {
          if (onCreatePoolPayout) onCreatePoolPayout(input)
          const payout = core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-launch-audit-test' })
          return {
            ...payout,
            processorPayout: {
              id: 'launch-audit-quote',
              status: 'quoted',
              poolId: input.poolId,
              broadcast: false,
              transfers: emptyPoolPayoutTransfers ? [] : input.winnerUserIds.map(userId => ({
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
    }
  }
}

function checkById (report, id) {
  return report.checks.find(item => item.id === id)
}

test('live launch checks require independent receipt verification', () => {
  const settings = baseSettings({
    live: true,
    defaultPayoutAddress: '0xlaunchauditwinner000000000000000000000000'
  })
  const status = {
    canUseRealMoney: true,
    mode: { qvac: 'sdk', tetherWdk: 'sdk' },
    readiness: {
      qvac: { sdkReady: true, source: 'test' },
      tetherWdk: { sdkReady: true, source: 'test' },
      compliance: settings.compliance,
      settlement: { status: 'live-ready', label: 'Live settlement ready', tone: 'ready' }
    }
  }
  const checks = launchAudit.createLaunchChecks({
    settings,
    status,
    liveReport: { liveReady: true },
    trustedReport: {
      ok: true,
      skipped: false,
      receiptVerification: { ok: false, errors: ['receipt hash mismatch'] },
      receipt: {
        payoutRecipients: { count: 1 },
        processorPayout: {
          status: 'quoted',
          transferCount: 1,
          transferStatuses: { quoted: 1 },
          transfersHash: '0xpooltransferhash'
        }
      },
      summary: { attestationEvent: 'QvacPoolSettlementAttestationCreated', settlementEvent: 'TetherWdkPoolPayoutPrepared' }
    },
    trustedGameReport: {
      ok: true,
      skipped: false,
      receiptVerification: { ok: true, errors: [] },
      receipt: {
        processorRelease: {
          status: 'quoted',
          transferCount: 1,
          transferStatuses: { quoted: 1 },
          transfersHash: '0xgametransferhash'
        }
      },
      summary: {
        attestationEvent: 'QvacRefereeAttestationCreated',
        settlementEvent: 'TetherWdkEscrowReleased',
        winnerRecipientRoute: { available: true, source: 'defaultPayoutAddress' }
      }
    }
  })
  const report = { checks }

  assert.equal(checkById(report, 'trusted-path-preflight').ok, true)
  assert.equal(checkById(report, 'trusted-path-processor-evidence').ok, true)
  assert.equal(checkById(report, 'trusted-path-receipt-verification').ok, false)
  assert.match(checkById(report, 'trusted-path-receipt-verification').detail, /receipt hash mismatch/)
  assert.equal(checkById(report, 'trusted-game-processor-evidence').ok, true)
  assert.equal(checkById(report, 'trusted-game-receipt-verification').ok, true)
})

test('live launch checks require a loadable QVAC model, not only a model label', () => {
  const settings = baseSettings({
    live: true,
    defaultPayoutAddress: '0xlaunchauditwinner000000000000000000000000',
    qvacModelExport: ''
  })
  const status = {
    canUseRealMoney: true,
    mode: { qvac: 'sdk', tetherWdk: 'sdk' },
    readiness: {
      qvac: { sdkReady: true, source: 'test' },
      tetherWdk: { sdkReady: true, source: 'test' },
      compliance: settings.compliance,
      settlement: { status: 'live-ready', label: 'Live settlement ready', tone: 'ready' }
    },
    settlementGate: { liveReady: true, status: 'live-ready' }
  }
  const checks = launchAudit.createLaunchChecks({
    settings,
    status,
    liveReport: { liveReady: false },
    trustedReport: {
      ok: false,
      skipped: true,
      receiptVerification: { ok: false, errors: [] },
      receipt: null,
      summary: null
    },
    trustedGameReport: {
      ok: false,
      skipped: true,
      receiptVerification: { ok: false, errors: [] },
      receipt: null,
      summary: null
    }
  })
  const report = { checks }

  assert.equal(launchAudit.qvacLoadableModelConfigured(settings.sdkPackages.qvac), false)
  assert.equal(checkById(report, 'qvac-configured').ok, false)
  assert.match(checkById(report, 'qvac-configured').detail, /modelSrc, modelExport, or preloadedModelId/)
})

test('live launch checks independently reject empty processor evidence in claimed-ok reports', () => {
  const settings = baseSettings({
    live: true,
    defaultPayoutAddress: '0xlaunchauditwinner000000000000000000000000'
  })
  const status = {
    canUseRealMoney: true,
    mode: { qvac: 'sdk', tetherWdk: 'sdk' },
    readiness: {
      qvac: { sdkReady: true, source: 'test' },
      tetherWdk: { sdkReady: true, source: 'test' },
      compliance: settings.compliance,
      settlement: { status: 'live-ready', label: 'Live settlement ready', tone: 'ready' }
    },
    settlementGate: { liveReady: true, status: 'live-ready' }
  }
  const checks = launchAudit.createLaunchChecks({
    settings,
    status,
    liveReport: { liveReady: true },
    trustedReport: {
      ok: true,
      skipped: false,
      receiptVerification: { ok: true, errors: [] },
      receipt: {
        payoutRecipients: { count: 1 },
        processorPayout: {
          status: 'quoted',
          transferCount: 0,
          transferStatuses: {},
          transfersHash: '0xempty'
        }
      },
      summary: { attestationEvent: 'QvacPoolSettlementAttestationCreated', settlementEvent: 'TetherWdkPoolPayoutPrepared' }
    },
    trustedGameReport: {
      ok: true,
      skipped: false,
      receiptVerification: { ok: true, errors: [] },
      receipt: {
        processorRelease: {
          status: 'quoted',
          transferCount: 0,
          transferStatuses: {},
          transfersHash: '0xempty'
        }
      },
      summary: {
        attestationEvent: 'QvacRefereeAttestationCreated',
        settlementEvent: 'TetherWdkEscrowReleased',
        winnerRecipientRoute: { available: true, source: 'defaultPayoutAddress' }
      }
    }
  })
  const report = { checks }

  assert.equal(checkById(report, 'trusted-path-receipt-verification').ok, true)
  assert.equal(checkById(report, 'trusted-path-preflight').ok, false)
  assert.equal(checkById(report, 'trusted-path-processor-evidence').ok, false)
  assert.equal(checkById(report, 'trusted-game-receipt-verification').ok, true)
  assert.equal(checkById(report, 'trusted-game-preflight').ok, false)
  assert.equal(checkById(report, 'trusted-game-processor-evidence').ok, false)
})

test('live launch audit blocks when compliance and payout recipient route are missing', async () => {
  const report = await launchAudit.runLiveLaunchAudit({
    settings: baseSettings({ live: false }),
    rootObject: { PearCupSdkRuntime: createFakeSdkRuntime() }
  })

  assert.equal(report.readyToLaunch, false)
  assert.equal(report.liveReady, false)
  assert.equal(report.settlementStatus, 'compliance-locked')
  assert.equal(checkById(report, 'qvac-sdk-ready').ok, true)
  assert.equal(checkById(report, 'wdk-sdk-ready').ok, true)
  assert.equal(checkById(report, 'payout-recipient-route').ok, false)
  assert.equal(checkById(report, 'payout-recipient-declarations').ok, false)
  assert.equal(checkById(report, 'game-winner-recipient-route').ok, false)
  assert.equal(checkById(report, 'compliance-real-money').ok, false)
  assert.equal(checkById(report, 'trusted-path-preflight').ok, false)
  assert.equal(checkById(report, 'trusted-game-preflight').ok, false)
  assert.equal(report.trustedPath.skipped, true)
  assert.equal(report.trustedGamePath.skipped, true)
  assert.equal(JSON.stringify(report).includes('valid launch audit seed phrase'), false)
  assert.equal(report.settings.sdkPackages.tetherWdk.seedPhrase, '[redacted]')
})

test('live launch audit passes when QVAC, Tether WDK, compliance, recipients, and receipt path are ready', async () => {
  const report = await launchAudit.runLiveLaunchAudit({
    settings: baseSettings({
      live: true,
      defaultPayoutAddress: '0xlaunchauditwinner000000000000000000000000'
    }),
    rootObject: { PearCupSdkRuntime: createFakeSdkRuntime() }
  })

  assert.equal(report.readyToLaunch, true)
  assert.equal(report.liveReady, true)
  assert.equal(report.summary.blocking, 0)
  assert.equal(report.trustedPath.ok, true)
  assert.equal(report.trustedPath.skipped, false)
  assert.equal(report.trustedPath.receiptVerification.ok, true)
  assert.equal(report.trustedPath.receipt.settlementType, 'bracket-pool')
  assert.deepEqual(report.trustedPath.summary.bracketSubmissionEvents, ['BracketSubmissionLocked', 'BracketSubmissionLocked'])
  assert.equal(report.trustedPath.summary.bracketResolvedBy, 'perfect-bracket')
  assert.equal(typeof report.trustedPath.receipt.pool.sourceBracketSubmissionIdsHash, 'string')
  assert.equal(typeof report.trustedPath.receipt.pool.bracketScoreboardHash, 'string')
  assert.equal(report.trustedPath.receipt.pool.bracketResolvedBy, 'perfect-bracket')
  assert.equal(report.trustedPath.receipt.payoutRecipients.count, 1)
  assert.equal(report.trustedPath.receipt.processorPayout.status, 'quoted')
  assert.equal(report.trustedGamePath.ok, true)
  assert.equal(report.trustedGamePath.skipped, false)
  assert.equal(report.trustedGamePath.receiptVerification.ok, true)
  assert.equal(report.trustedGamePath.receipt.settlementType, 'game-round')
  assert.equal(report.trustedGamePath.receipt.processorRelease.status, 'quoted')
  assert.equal(report.trustedGamePath.receipt.wdkQvacAttestationId, report.trustedGamePath.receipt.qvacAttestationId)
  assert.equal(checkById(report, 'payout-recipient-declarations').ok, true)
  assert.equal(checkById(report, 'game-winner-recipient-route').ok, true)
  assert.equal(checkById(report, 'trusted-path-preflight').ok, true)
  assert.equal(checkById(report, 'trusted-path-processor-evidence').ok, true)
  assert.equal(checkById(report, 'trusted-path-receipt-verification').ok, true)
  assert.equal(checkById(report, 'trusted-game-preflight').ok, true)
  assert.equal(checkById(report, 'trusted-game-processor-evidence').ok, true)
  assert.equal(checkById(report, 'trusted-game-receipt-verification').ok, true)
  assert.equal(report.trustedGamePath.summary.winnerRecipientRoute.available, true)
  assert.equal(report.trustedGamePath.summary.winnerRecipientRoute.source, 'defaultPayoutAddress')
  assert.match(launchAudit.formatLiveLaunchAuditReport(report), /ok - launch readiness: ready/)
  assert.equal(JSON.stringify(report).includes('0xlaunchauditwinner'), false)
  assert.equal(JSON.stringify(report).includes('0xlaunchauditgamewinner'), false)
})

test('live launch audit blocks empty WDK processor transfer evidence', async () => {
  const report = await launchAudit.runLiveLaunchAudit({
    settings: baseSettings({
      live: true,
      defaultPayoutAddress: '0xlaunchauditwinner000000000000000000000000'
    }),
    rootObject: {
      PearCupSdkRuntime: createFakeSdkRuntime({
        emptyPoolPayoutTransfers: true,
        emptyGameReleaseTransfers: true
      })
    }
  })

  assert.equal(report.readyToLaunch, false)
  assert.equal(report.liveReady, true)
  assert.equal(report.trustedPath.ok, false)
  assert.equal(report.trustedGamePath.ok, false)
  assert.equal(report.trustedPath.receiptVerification.ok, true)
  assert.equal(report.trustedGamePath.receiptVerification.ok, true)
  assert.equal(report.trustedPath.receipt.processorPayout.status, 'quoted')
  assert.equal(report.trustedPath.receipt.processorPayout.transferCount, 0)
  assert.equal(report.trustedGamePath.receipt.processorRelease.status, 'quoted')
  assert.equal(report.trustedGamePath.receipt.processorRelease.transferCount, 0)
  assert.equal(checkById(report, 'trusted-path-preflight').ok, false)
  assert.equal(checkById(report, 'trusted-path-processor-evidence').ok, false)
  assert.equal(checkById(report, 'trusted-game-preflight').ok, false)
  assert.equal(checkById(report, 'trusted-game-processor-evidence').ok, false)
  assert.match(checkById(report, 'trusted-path-processor-evidence').detail, /non-empty transfer proof/)
  assert.match(checkById(report, 'trusted-game-processor-evidence').detail, /non-empty transfer proof/)
})

test('live launch audit blocks when the actual game winner has no payout route', async () => {
  const report = await launchAudit.runLiveLaunchAudit({
    settings: baseSettings({
      live: true,
      payoutRecipients: {
        'user-captain': '0xlaunchauditbracketwinner000000000000000000'
      }
    }),
    rootObject: { PearCupSdkRuntime: createFakeSdkRuntime() }
  })

  assert.equal(report.readyToLaunch, false)
  assert.equal(report.liveReady, true)
  assert.equal(checkById(report, 'payout-recipient-route').ok, true)
  assert.equal(checkById(report, 'payout-recipient-declarations').ok, true)
  assert.equal(checkById(report, 'game-winner-recipient-route').ok, false)
  assert.equal(checkById(report, 'trusted-path-preflight').ok, true)
  assert.equal(checkById(report, 'trusted-game-preflight').ok, false)
  assert.equal(report.trustedPath.ok, true)
  assert.equal(report.trustedGamePath.ok, false)
  assert.match(report.trustedGamePath.reason, /winner payout recipient route/)
  assert.equal(report.trustedGamePath.summary.winnerRecipientRoute.available, false)
  assert.equal(report.trustedGamePath.summary.winnerRecipientRoute.source, 'missing')
  assert.equal(report.trustedGamePath.receipt.processorRelease.status, 'quoted')
  assert.equal(JSON.stringify(report).includes('0xlaunchauditbracketwinner'), false)
  assert.equal(JSON.stringify(report).includes('0xlaunchauditgamewinner'), false)
})

test('live launch audit refuses broadcast payout config without explicit operator override', async () => {
  let createPoolPayoutCalled = false
  const report = await launchAudit.runLiveLaunchAudit({
    settings: baseSettings({
      live: true,
      defaultPayoutAddress: '0xlaunchauditwinner000000000000000000000000',
      broadcastPayouts: true
    }),
    rootObject: {
      PearCupSdkRuntime: createFakeSdkRuntime({
        onCreatePoolPayout () {
          createPoolPayoutCalled = true
        }
      })
    }
  })

  assert.equal(report.readyToLaunch, false)
  assert.equal(checkById(report, 'payout-broadcast-policy').ok, false)
  assert.equal(checkById(report, 'trusted-path-preflight').ok, false)
  assert.equal(checkById(report, 'trusted-game-preflight').ok, false)
  assert.match(report.trustedPath.reason, /refuses to broadcast/)
  assert.match(report.trustedGamePath.reason, /refuses to broadcast/)
  assert.equal(createPoolPayoutCalled, false)
})
