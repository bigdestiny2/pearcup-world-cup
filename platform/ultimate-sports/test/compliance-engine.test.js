'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { compliance, platform } = require('../src')

function operationalEvidence () {
  return {
    qvacReady: { ok: true, evidenceId: 'qvac-ready-evidence' },
    wdkReady: { ok: true, evidenceId: 'wdk-ready-evidence' },
    poolRulesAccepted: { ok: true, evidenceId: 'pool-rules-evidence' },
    paymentCapturedOrEscrowLocked: { ok: true, evidenceId: 'escrow-evidence' },
    officialResultSourceReady: { ok: true, evidenceId: 'official-feed-evidence' }
  }
}

function verifiedProfile (userId = 'winner') {
  return compliance.createComplianceProfile({
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
    },
    updatedAt: '2026-07-03T09:00:00.000Z'
  })
}

test('compliance readiness panel gathers evidence without storing payout recipients', () => {
  const profile = verifiedProfile()
  const declaration = compliance.createPayoutRecipientDeclaration({
    userId: 'winner',
    asset: 'USDT',
    routeType: 'external-wallet',
    recipient: '0xwinner-wallet-address',
    evidenceId: 'recipient-evidence',
    declaredAt: '2026-07-03T09:01:00.000Z'
  })
  const limit = compliance.createResponsiblePlayLimit({
    userId: 'winner',
    limitType: 'daily-stake',
    amount: 100,
    currency: 'USDT',
    startsAt: '2026-07-03T00:00:00.000Z',
    createdAt: '2026-07-03T09:02:00.000Z'
  })
  const exposure = compliance.createPlayExposure({
    userId: 'winner',
    exposureType: 'stake',
    amount: 25,
    currency: 'USDT',
    sourceType: 'pool',
    sourceId: 'cash-final',
    occurredAt: '2026-07-03T09:03:00.000Z'
  })
  const proposedExposure = compliance.createPlayExposure({
    userId: 'winner',
    exposureType: 'stake',
    amount: 50,
    currency: 'USDT',
    sourceType: 'pool',
    sourceId: 'cash-final',
    occurredAt: '2026-07-03T09:04:00.000Z'
  })

  const panel = compliance.createReadinessPanel({
    userId: 'winner',
    targetType: 'pool',
    targetId: 'cash-final',
    mode: 'real-money',
    profile,
    payoutDeclarations: [declaration],
    limits: [limit],
    exposures: [exposure],
    proposedExposure,
    evidence: operationalEvidence(),
    now: '2026-07-03T09:04:00.000Z'
  })

  assert.equal(panel.ready, true)
  assert.equal(panel.readiness.ready, true)
  assert.equal(panel.responsiblePlay.ready, true)
  assert.equal(panel.gates.kycVerified.evidenceId, 'kyc-evidence')
  assert.equal(panel.gates.payoutRouteDeclared.evidenceId, 'recipient-evidence')
  assert.equal(panel.sections.length, compliance.REAL_MONEY_GATES.length)
  assert.equal(declaration.recipientHash.length > 0, true)
  assert.equal(Object.prototype.hasOwnProperty.call(declaration, 'recipient'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(declaration, 'address'), false)
})

test('responsible play blocks stake overages and active cooldowns', () => {
  const dailyLimit = compliance.createResponsiblePlayLimit({
    userId: 'winner',
    limitType: 'daily-stake',
    amount: 100,
    currency: 'USDT',
    startsAt: '2026-07-03T00:00:00.000Z'
  })
  const existingStake = compliance.createPlayExposure({
    userId: 'winner',
    exposureType: 'stake',
    amount: 80,
    currency: 'USDT',
    occurredAt: '2026-07-03T08:00:00.000Z'
  })
  const proposedStake = compliance.createPlayExposure({
    userId: 'winner',
    exposureType: 'stake',
    amount: 30,
    currency: 'USDT',
    occurredAt: '2026-07-03T09:00:00.000Z'
  })
  const cooldown = compliance.createResponsiblePlayLimit({
    userId: 'winner',
    limitType: 'cooldown',
    startsAt: '2026-07-03T08:30:00.000Z',
    endsAt: '2026-07-03T10:30:00.000Z'
  })

  const stakeResult = compliance.evaluateResponsiblePlay({
    limits: [dailyLimit],
    exposures: [existingStake],
    proposedExposure: proposedStake,
    now: '2026-07-03T09:00:00.000Z'
  })
  const cooldownResult = compliance.evaluateResponsiblePlay({
    limits: [cooldown],
    exposures: [],
    now: '2026-07-03T09:00:00.000Z'
  })

  assert.equal(stakeResult.ready, false)
  assert.equal(stakeResult.violations[0].limitType, 'daily-stake')
  assert.equal(stakeResult.violations[0].projected, 110)
  assert.equal(cooldownResult.ready, false)
  assert.equal(cooldownResult.violations[0].limitType, 'cooldown')
})

test('facade can build evidence-backed compliance gates before real-money commands', () => {
  const app = platform.createUltimateSportsPlatform({
    policyContext: { allowRealMoney: true }
  })
  const cashPoolCommand = {
    type: 'pool:create',
    actorId: 'host',
    payload: {
      poolId: 'compliance-cash-pool',
      competitionId: 'compliance-comp',
      title: 'Compliance Cash Pool',
      mode: 'real-money'
    }
  }

  assert.equal(app.evaluateCommand(cashPoolCommand).allowed, false)

  app.dispatch({
    type: 'compliance:upsertProfile',
    actorId: 'winner',
    occurredAt: '2026-07-03T09:00:00.000Z',
    payload: verifiedProfile('winner')
  })
  app.dispatch({
    type: 'compliance:setLimit',
    actorId: 'winner',
    occurredAt: '2026-07-03T09:01:00.000Z',
    payload: {
      limitType: 'daily-stake',
      amount: 100,
      currency: 'USDT',
      startsAt: '2026-07-03T00:00:00.000Z'
    }
  })
  app.dispatch({
    type: 'compliance:recordExposure',
    actorId: 'winner',
    occurredAt: '2026-07-03T09:02:00.000Z',
    payload: {
      exposureType: 'stake',
      amount: 10,
      currency: 'USDT',
      sourceType: 'pool',
      sourceId: 'warmup-pool'
    }
  })
  const declarationEvent = app.dispatch({
    type: 'compliance:declarePayoutRecipient',
    actorId: 'winner',
    occurredAt: '2026-07-03T09:03:00.000Z',
    payload: {
      asset: 'USDT',
      routeType: 'external-wallet',
      recipient: '0xwinner-wallet-address',
      evidenceId: 'recipient-evidence'
    }
  })
  const panelEvent = app.dispatch({
    type: 'compliance:createReadinessPanel',
    actorId: 'winner',
    occurredAt: '2026-07-03T09:04:00.000Z',
    payload: {
      mode: 'real-money',
      targetType: 'pool',
      targetId: cashPoolCommand.payload.poolId,
      proposedExposure: {
        exposureType: 'stake',
        amount: 25,
        currency: 'USDT',
        sourceType: 'pool',
        sourceId: cashPoolCommand.payload.poolId
      },
      evidence: operationalEvidence()
    }
  })

  app.setPolicyContext({
    allowRealMoney: true,
    gates: panelEvent.payload.gates
  })
  const poolEvent = app.dispatch(cashPoolCommand)
  const view = app.view()

  assert.equal(panelEvent.payload.ready, true)
  assert.equal(poolEvent.type, 'PoolCreated')
  assert.equal(view.pools['compliance-cash-pool'].mode, 'real-money')
  assert.equal(view.readinessPanels[panelEvent.payload.readinessPanelId].ready, true)
  assert.deepEqual(view.payoutRecipientDeclarationsByUser.winner, [declarationEvent.payload.declarationId])
  assert.equal(Object.prototype.hasOwnProperty.call(declarationEvent.payload, 'recipient'), false)
})
