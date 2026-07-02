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
const trustedPathPreflight = require('./trusted-path-preflight.js')

function baseSettings ({
  live = false,
  broadcastPayouts = false,
  defaultPayoutAddress = '0xtrustedpathrecipient0000000000000000000000',
  payoutRecipients = {}
} = {}) {
  return {
    source: {
      path: 'config/pearcup.trusted-path-preflight.test.json',
      loaded: true
    },
    sdkPackages: {
      qvac: {
        modelId: 'qvac-trusted-path-model'
      },
      tetherWdk: {
        seedPhrase: 'valid trusted path seed phrase',
        assets: ['usdt-evm'],
        defaultPayoutAddress,
        payoutRecipients,
        broadcastPayouts,
        quotePayouts: true
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
        id: 'qvac-trusted-path-test',
        mode: 'sdk',
        async attestRound ({ roundResult }) {
          return core.createQvacRefereeAttestation({
            roundResult,
            refereeId: 'qvac-trusted-path-test',
            review: {
              modelId: config.modelId,
              ruling: 'verified',
              confidence: 0.99,
              rationale: 'Trusted path preflight QVAC verified round evidence.'
            }
          })
        },
        async attestPoolSettlement ({ poolResult }) {
          return core.createQvacPoolSettlementAttestation({
            poolResult,
            refereeId: 'qvac-trusted-path-test',
            review: {
              modelId: config.modelId,
              ruling: poolResult.ruling,
              confidence: 0.99,
              rationale: 'Trusted path preflight QVAC verified pool evidence.'
            }
          })
        }
      }
    },
    createTetherWdkPackageAdapter (wdkConfig = {}) {
      function recipientFor ({ userId, payoutAddress, payoutRecipients = {} } = {}) {
        return payoutAddress ||
          payoutRecipients[userId] ||
          (wdkConfig.payoutRecipients || {})[userId] ||
          wdkConfig.defaultPayoutAddress ||
          null
      }

      return {
        id: 'tether-wdk-trusted-path-test',
        mode: 'sdk',
        async createGameEscrow (input) {
          return core.createTetherWdkEscrowIntent({ ...input, rail: 'tether-wdk-trusted-path-test' })
        },
        async releaseGameEscrow ({ escrow, attestation, winnerUserId, payoutAddress, payoutRecipients }) {
          const payout = core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
          const recipient = recipientFor({ userId: winnerUserId, payoutAddress, payoutRecipients })
          if (!recipient) {
            return {
              ...payout,
              processorRelease: {
                id: `trusted-path-release-${escrow.escrowId}`,
                status: 'recipient-required',
                escrowId: escrow.escrowId,
                winnerUserId,
                broadcast: false,
                transfers: []
              }
            }
          }
          return {
            ...payout,
            processorRelease: {
              id: `trusted-path-release-${escrow.escrowId}`,
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
                recipient,
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
          return core.createTetherWdkEntryIntent({ ...input, rail: 'tether-wdk-trusted-path-test' })
        },
        async confirmEntryIntent (input) {
          return core.confirmTetherWdkEntryIntent(input)
        },
        async createPoolPayout (input) {
          if (onCreatePoolPayout) onCreatePoolPayout(input)
          const payout = core.createTetherWdkPoolPayout({ ...input, rail: 'tether-wdk-trusted-path-test' })
          return {
            ...payout,
            processorPayout: {
              id: 'trusted-path-quote',
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

test('trusted path preflight skips safely until runtime is live-ready', async () => {
  const report = await trustedPathPreflight.runTrustedPathPreflight({
    settings: baseSettings({ live: false }),
    rootObject: { PearCupSdkRuntime: createFakeSdkRuntime() }
  })

  assert.equal(report.ok, true)
  assert.equal(report.skipped, true)
  assert.equal(report.liveReady, false)
  assert.match(report.reason, /requires SDK-ready QVAC/)
})

test('trusted path preflight records QVAC-to-WDK receipt processor evidence', async () => {
  const recipient = '0xtrustedpathrecipient0000000000000000000000'
  const report = await trustedPathPreflight.runTrustedPathPreflight({
    settings: baseSettings({ live: true }),
    rootObject: { PearCupSdkRuntime: createFakeSdkRuntime() },
    payoutAddress: recipient
  })

  assert.equal(report.ok, true)
  assert.equal(report.skipped, false)
  assert.equal(report.liveReady, true)
  assert.equal(report.summary.poolResultEvent, 'BracketPoolSettlementResolved')
  assert.equal(report.summary.attestationEvent, 'QvacPoolSettlementAttestationCreated')
  assert.equal(report.summary.settlementEvent, 'TetherWdkPoolPayoutPrepared')
  assert.equal(report.summary.receiptEvent, 'SettlementReceiptCreated')
  assert.deepEqual(report.summary.bracketSubmissionEvents, ['BracketSubmissionLocked', 'BracketSubmissionLocked'])
  assert.equal(report.summary.bracketResolvedBy, 'perfect-bracket')
  assert.equal(report.receiptVerification.ok, true)
  assert.deepEqual(report.receiptVerification.errors, [])
  assert.deepEqual(report.summary.recipientDeclarationEvents, ['PayoutRecipientDeclared'])
  assert.equal(report.receipt.settlementType, 'bracket-pool')
  assert.equal(report.receipt.pool.sourceEventMode, 'worker-log')
  assert.equal(typeof report.receipt.pool.sourceEventIdsHash, 'string')
  assert.equal(typeof report.receipt.pool.sourcePaymentIdsHash, 'string')
  assert.equal(typeof report.receipt.pool.sourceBracketSubmissionIdsHash, 'string')
  assert.equal(typeof report.receipt.pool.bracketScoreboardHash, 'string')
  assert.equal(report.receipt.pool.bracketResolvedBy, 'perfect-bracket')
  assert.equal(typeof report.receipt.pool.officialResultsHash, 'string')
  assert.equal(report.receipt.payoutRecipients.count, 1)
  assert.equal(typeof report.receipt.payoutRecipients.declarationsHash, 'string')
  assert.equal(report.receipt.processorPayout.status, 'quoted')
  assert.equal(report.receipt.processorPayout.transferCount, 1)
  assert.equal(report.receipt.processorPayout.transferStatuses.quoted, 1)
  assert.equal(JSON.stringify(report).includes(recipient), false)
  assert.equal(JSON.stringify(report).includes('valid trusted path seed phrase'), false)
})

test('trusted path preflight rejects empty WDK pool payout transfer evidence', async () => {
  const recipient = '0xtrustedpathrecipient0000000000000000000000'
  const report = await trustedPathPreflight.runTrustedPathPreflight({
    settings: baseSettings({ live: true }),
    rootObject: { PearCupSdkRuntime: createFakeSdkRuntime({ emptyPoolPayoutTransfers: true }) },
    payoutAddress: recipient
  })

  assert.equal(report.ok, false)
  assert.equal(report.skipped, false)
  assert.match(report.reason, /missing, empty, or still requires recipients/)
  assert.equal(report.receiptVerification.ok, true)
  assert.equal(report.receipt.processorPayout.status, 'quoted')
  assert.equal(report.receipt.processorPayout.transferCount, 0)
  assert.equal(JSON.stringify(report).includes(recipient), false)
})

test('trusted game preflight records QVAC-to-WDK escrow release receipt evidence', async () => {
  const report = await trustedPathPreflight.runTrustedGamePreflight({
    settings: baseSettings({ live: true }),
    rootObject: { PearCupSdkRuntime: createFakeSdkRuntime() }
  })

  assert.equal(report.ok, true)
  assert.equal(report.skipped, false)
  assert.equal(report.liveReady, true)
  assert.equal(report.summary.escrowEvent, 'TetherWdkEscrowCreated')
  assert.deepEqual(report.summary.evidenceEvents, [
    'GameCommitmentSubmitted',
    'GameCommitmentSubmitted',
    'GameInputRevealed',
    'GameInputRevealed',
    'GameRoundStateHashSubmitted',
    'GameRoundStateHashSubmitted'
  ])
  assert.equal(report.summary.roundEvent, 'GameRoundResolved')
  assert.equal(report.summary.attestationEvent, 'QvacRefereeAttestationCreated')
  assert.equal(report.summary.settlementEvent, 'TetherWdkEscrowReleased')
  assert.equal(report.summary.receiptEvent, 'SettlementReceiptCreated')
  assert.equal(report.receiptVerification.ok, true)
  assert.deepEqual(report.receiptVerification.errors, [])
  assert.equal(report.receipt.settlementType, 'game-round')
  assert.equal(report.receipt.game.gameId, 'pc-trusted-path-preflight')
  assert.equal(report.receipt.wdkQvacAttestationId, report.receipt.qvacAttestationId)
  assert.equal(report.receipt.processorRelease.status, 'quoted')
  assert.equal(report.receipt.processorRelease.transferCount, 1)
  assert.equal(report.receipt.processorRelease.transferStatuses.quoted, 1)
  assert.equal(report.summary.winnerRecipientRoute.available, true)
  assert.equal(report.summary.winnerRecipientRoute.source, 'defaultPayoutAddress')
  assert.equal(typeof report.summary.winnerRecipientRoute.recipientHash, 'string')
  assert.equal(JSON.stringify(report).includes('valid trusted path seed phrase'), false)
  assert.equal(JSON.stringify(report).includes('0xtrustedpathgamewinner'), false)
})

test('trusted game preflight rejects empty WDK release transfer evidence', async () => {
  const report = await trustedPathPreflight.runTrustedGamePreflight({
    settings: baseSettings({ live: true }),
    rootObject: { PearCupSdkRuntime: createFakeSdkRuntime({ emptyGameReleaseTransfers: true }) }
  })

  assert.equal(report.ok, false)
  assert.equal(report.skipped, false)
  assert.match(report.reason, /missing, empty, or still requires recipients/)
  assert.equal(report.receiptVerification.ok, true)
  assert.equal(report.receipt.processorRelease.status, 'quoted')
  assert.equal(report.receipt.processorRelease.transferCount, 0)
})

test('trusted game preflight requires a payout route for the actual game winner', async () => {
  const report = await trustedPathPreflight.runTrustedGamePreflight({
    settings: baseSettings({
      live: true,
      defaultPayoutAddress: '',
      payoutRecipients: {}
    }),
    rootObject: { PearCupSdkRuntime: createFakeSdkRuntime() }
  })

  assert.equal(report.ok, false)
  assert.equal(report.skipped, false)
  assert.equal(report.liveReady, true)
  assert.match(report.reason, /winner payout recipient route/)
  assert.equal(report.summary.winnerRecipientRoute.available, false)
  assert.equal(report.summary.winnerRecipientRoute.source, 'missing')
  assert.equal(report.summary.winnerRecipientRoute.recipientHash, null)
  assert.equal(report.receipt.processorRelease.status, 'recipient-required')
  assert.equal(report.receipt.processorRelease.transferCount, 0)
  assert.equal(JSON.stringify(report).includes('valid trusted path seed phrase'), false)
})

test('trusted path preflight refuses to run when broadcast payouts are enabled', async () => {
  let createPoolPayoutCalled = false
  const report = await trustedPathPreflight.runTrustedPathPreflight({
    settings: baseSettings({ live: true, broadcastPayouts: true }),
    rootObject: {
      PearCupSdkRuntime: createFakeSdkRuntime({
        onCreatePoolPayout () {
          createPoolPayoutCalled = true
        }
      })
    }
  })

  assert.equal(report.ok, false)
  assert.equal(report.skipped, false)
  assert.match(report.reason, /refuses to broadcast/)
  assert.equal(createPoolPayoutCalled, false)
})
