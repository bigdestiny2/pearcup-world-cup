'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { constants, platform, walletOps } = require('../src')

function allRealMoneyEvidence () {
  return Object.fromEntries(constants.REAL_MONEY_GATES.map(gate => [
    gate,
    { ok: true, evidenceId: `${gate}-evidence` }
  ]))
}

function verifiedProfile (userId) {
  return {
    userId,
    jurisdiction: 'US-CO',
    kycVerified: true,
    ageVerified: true,
    jurisdictionAllowed: true,
    responsiblePlayAccepted: true,
    evidence: {
      kycVerified: 'kyc-evidence',
      ageVerified: 'age-evidence',
      jurisdictionAllowed: 'jurisdiction-evidence',
      responsiblePlayAccepted: 'responsible-play-evidence'
    }
  }
}

function createSettledPool ({ mode = 'demo', gates = {} } = {}) {
  const app = platform.createUltimateSportsPlatform({
    policyContext: mode === 'sponsor-prize'
      ? { gates }
      : {}
  })
  app.dispatch({
    type: 'competition:create',
    actorId: 'host',
    occurredAt: '2026-07-03T20:00:00.000Z',
    payload: {
      competitionId: `${mode}-ops-comp`,
      title: `${mode} Ops Cup`,
      templateConfig: { kind: 'single-elimination' },
      entrants: [
        { entrantId: 'alpha', name: 'Alpha' },
        { entrantId: 'beta', name: 'Beta' }
      ]
    }
  })
  const poolEvent = app.dispatch({
    type: 'pool:create',
    actorId: 'host',
    occurredAt: '2026-07-03T20:01:00.000Z',
    payload: {
      poolId: `${mode}-ops-pool`,
      competitionId: `${mode}-ops-comp`,
      title: `${mode} Ops Pool`,
      variant: 'classic-bracket',
      mode,
      gates
    }
  })
  const entry = app.dispatch({
    type: 'prediction:submit',
    actorId: 'winner',
    occurredAt: '2026-07-03T20:02:00.000Z',
    payload: {
      poolId: `${mode}-ops-pool`,
      userId: 'winner',
      entryType: 'bracket',
      picks: { final: 'alpha' },
      gates
    }
  })
  app.dispatch({
    type: 'prediction:lock',
    actorId: 'system',
    occurredAt: '2026-07-03T20:03:00.000Z',
    payload: {
      entryId: entry.payload.entryId,
      gates
    }
  })
  const result = app.dispatch({
    type: 'result:record',
    actorId: 'feed',
    occurredAt: '2026-07-03T20:04:00.000Z',
    payload: {
      competitionId: `${mode}-ops-comp`,
      results: {
        final: { winnerEntrantId: 'alpha', roundNumber: 1 }
      }
    }
  })
  app.dispatch({
    type: 'pool:resolve',
    actorId: 'system',
    occurredAt: '2026-07-03T20:05:00.000Z',
    payload: {
      poolId: `${mode}-ops-pool`,
      resultSnapshotId: result.payload.snapshotId,
      gates
    }
  })
  const plan = app.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    occurredAt: '2026-07-03T20:06:00.000Z',
    payload: {
      poolId: `${mode}-ops-pool`,
      rulesVersion: poolEvent.payload.rules.rulesVersion,
      resultSnapshotId: result.payload.snapshotId,
      mode,
      gates
    }
  })
  const receipt = app.dispatch({
    type: 'settlement:receipt',
    actorId: 'system',
    occurredAt: '2026-07-03T20:07:00.000Z',
    payload: {
      settlementPlanId: plan.payload.settlementPlanId,
      gates
    }
  })
  return { app, receipt }
}

test('wallet ops workbench grants complete demo receipts into accounts', () => {
  const { app, receipt } = createSettledPool()
  app.dispatch({
    type: 'wallet:createAccount',
    actorId: 'winner',
    occurredAt: '2026-07-03T20:08:00.000Z',
    payload: {
      accountId: 'winner-demo-account',
      userId: 'winner',
      mode: 'demo-credit',
      currency: 'CREDITS'
    }
  })

  const workbench = app.createWalletOpsWorkbench({ userId: 'winner' })
  const rewardCommand = workbench.receipts[0].commandDrafts.grantRewards
  const grant = app.dispatch(rewardCommand)
  const afterGrant = app.createSurface('wallet', { userId: 'winner' }).workbench

  assert.equal(workbench.counts.completeReceipts, 1)
  assert.equal(workbench.accounts[0].balance.available, 0)
  assert.equal(rewardCommand.type, 'wallet:grantReceiptRewards')
  assert.equal(grant.payload.receiptId, receipt.payload.receiptId)
  assert.equal(afterGrant.accounts[0].balance.available, walletOps.DEFAULT_REWARD_AMOUNT)
  assert.equal(afterGrant.receipts[0].rewardGrantStatus, 'granted')
  assert.equal(afterGrant.rewardGrants[0].entryCount, 1)
})

test('wallet ops workbench creates and fulfills sponsor prize claims', () => {
  const gates = walletOps.sponsorPrizeGates('pool-rules-evidence')
  const { app } = createSettledPool({ mode: 'sponsor-prize', gates })
  const workbench = app.createWalletOpsWorkbench({ userId: 'winner' })
  const fulfillmentEvent = app.dispatch(workbench.receipts[0].commandDrafts.createSponsorFulfillment)
  const pending = app.createWalletOpsWorkbench({ userId: 'winner' })
  const fulfilledEvent = app.dispatch({
    ...pending.sponsorFulfillments[0].commandDrafts.fulfill,
    payload: {
      ...pending.sponsorFulfillments[0].commandDrafts.fulfill.payload,
      trackingRef: 'gift-card-code-hash'
    }
  })

  assert.equal(workbench.receipts[0].mode, 'sponsor-prize')
  assert.equal(workbench.receipts[0].commandDrafts.createSponsorFulfillment.type, 'sponsor:createFulfillment')
  assert.equal(fulfillmentEvent.payload.status, 'pending')
  assert.equal(pending.sponsorFulfillments[0].commandDrafts.claim.type, 'sponsor:updateFulfillment')
  assert.equal(fulfilledEvent.payload.status, 'fulfilled')
  assert.equal(app.view().sponsorFulfillments[fulfillmentEvent.payload.fulfillmentId].trackingRef, 'gift-card-code-hash')
})

test('wallet ops workbench prepares real-money readiness and payout routes', () => {
  const app = platform.createUltimateSportsPlatform({
    peerId: 'winner',
    policyContext: { allowRealMoney: true }
  })
  app.dispatch({
    type: 'compliance:upsertProfile',
    actorId: 'winner',
    occurredAt: '2026-07-03T21:00:00.000Z',
    payload: verifiedProfile('winner')
  })
  const setup = app.createWalletOpsWorkbench({
    userId: 'winner',
    targetType: 'pool',
    targetId: 'cash-pool',
    evidence: allRealMoneyEvidence(),
    proposedExposure: {
      exposureType: 'stake',
      amount: 25,
      currency: 'USDT',
      sourceType: 'pool',
      sourceId: 'cash-pool'
    }
  })
  const declaration = app.dispatch(setup.payoutSetup.commandDrafts.declareExternalWallet)
  const withDeclaration = app.createWalletOpsWorkbench({
    userId: 'winner',
    targetType: 'pool',
    targetId: 'cash-pool',
    evidence: allRealMoneyEvidence(),
    proposedExposure: {
      exposureType: 'stake',
      amount: 25,
      currency: 'USDT',
      sourceType: 'pool',
      sourceId: 'cash-pool'
    }
  })
  const panel = app.dispatch(withDeclaration.readiness.commandDrafts.createRealMoneyPanel)
  app.setPolicyContext({
    allowRealMoney: true,
    gates: panel.payload.gates
  })
  const route = app.dispatch(withDeclaration.payoutSetup.commandDrafts.createExternalWalletRoute)
  const finalWorkbench = app.createWalletOpsWorkbench({ userId: 'winner' })

  assert.equal(declaration.payload.status, 'declared')
  assert.equal(Object.prototype.hasOwnProperty.call(declaration.payload, 'recipient'), false)
  assert.equal(panel.payload.ready, true)
  assert.equal(route.payload.routeType, 'external-wallet')
  assert.equal(finalWorkbench.payoutRoutes[0].routeId, route.payload.routeId)
  assert.equal(finalWorkbench.readiness.latestPanel.ready, true)
})
