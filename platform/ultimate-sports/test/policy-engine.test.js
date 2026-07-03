'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { bridge, constants, platform, policy, runtime } = require('../src')

function evidencedRealMoneyGates () {
  return Object.fromEntries(constants.REAL_MONEY_GATES.map(gate => [
    gate,
    { ok: true, evidenceId: `${gate}-evidence` }
  ]))
}

function booleanRealMoneyGates () {
  return Object.fromEntries(constants.REAL_MONEY_GATES.map(gate => [gate, true]))
}

function assertPolicyBlocked (fn, pattern) {
  assert.throws(fn, error => {
    assert.equal(error.code, 'policy-blocked')
    assert.equal(error.policy.allowed, false)
    if (pattern) assert.match(error.message, pattern)
    return true
  })
}

test('facade allows demo commands and exposes policy context', () => {
  const app = platform.createUltimateSportsPlatform()
  const command = {
    type: 'pool:create',
    actorId: 'host',
    payload: {
      poolId: 'policy-demo-pool',
      competitionId: 'policy-demo-comp',
      title: 'Demo Pool',
      mode: 'demo'
    }
  }

  const decision = app.evaluateCommand(command)
  const event = app.dispatch(command)

  assert.equal(decision.allowed, true)
  assert.equal(decision.riskClass, 'casual')
  assert.equal(event.type, 'PoolCreated')
  assert.equal(app.view().pools['policy-demo-pool'].mode, 'demo')
  assert.equal(app.policyContext().allowRealMoney, false)
})

test('sponsor-prize commands can be disabled or enabled explicitly', () => {
  const app = platform.createUltimateSportsPlatform({
    policyContext: { allowSponsorPrize: false }
  })
  const command = {
    type: 'pool:create',
    actorId: 'host',
    payload: {
      poolId: 'policy-sponsor-pool',
      competitionId: 'policy-sponsor-comp',
      title: 'Sponsor Pool',
      mode: 'sponsor-prize',
      gates: {
        poolRulesAccepted: true
      }
    }
  }

  const blocked = app.evaluateCommand(command)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.mode, 'sponsor-prize')
  assert.match(blocked.reasons.join(' '), /disabled/)
  assertPolicyBlocked(() => app.dispatch(command), /sponsor-prize/)

  const nextContext = app.setPolicyContext({ allowSponsorPrize: true })
  const allowed = app.evaluateCommand(command)
  const event = app.dispatch(command)

  assert.equal(nextContext.allowSponsorPrize, true)
  assert.equal(allowed.allowed, true)
  assert.equal(allowed.readiness.ready, true)
  assert.equal(event.payload.mode, 'sponsor-prize')
})

test('real-money commands require opt-in and evidence-backed gates', () => {
  const command = {
    type: 'pool:create',
    actorId: 'host',
    payload: {
      poolId: 'policy-cash-pool',
      competitionId: 'policy-cash-comp',
      title: 'Cash Pool',
      mode: 'real-money'
    }
  }
  const disabled = platform.createUltimateSportsPlatform({
    policyContext: {
      gates: evidencedRealMoneyGates()
    }
  })
  const weak = platform.createUltimateSportsPlatform({
    policyContext: {
      allowRealMoney: true,
      gates: booleanRealMoneyGates()
    }
  })
  const ready = platform.createUltimateSportsPlatform({
    policyContext: {
      allowRealMoney: true,
      gates: evidencedRealMoneyGates()
    }
  })

  assert.equal(disabled.evaluateCommand(command).allowed, false)
  assert.match(disabled.evaluateCommand(command).reasons.join(' '), /disabled/)
  assert.equal(weak.evaluateCommand(command).allowed, false)
  assert.equal(weak.evaluateCommand(command).readiness.missingGateEvidence.length, constants.REAL_MONEY_GATES.length)

  const decision = ready.evaluateCommand(command)
  const event = ready.dispatch(command)

  assert.equal(decision.allowed, true)
  assert.equal(decision.riskClass, 'regulated')
  assert.equal(event.payload.mode, 'real-money')
})

test('held settlement artifacts cannot bypass facade policy', () => {
  const raw = runtime.createPlatformRuntime()
  const heldPlan = raw.dispatch({
    type: 'settlement:plan',
    actorId: 'system',
    payload: {
      poolId: 'held-policy-pool',
      rulesVersion: 'rules-held-v1',
      mode: 'real-money',
      requireEvidence: true
    }
  })
  const app = platform.createUltimateSportsPlatform({
    events: raw.events(),
    policyContext: {
      allowRealMoney: true,
      gates: evidencedRealMoneyGates()
    }
  })
  const receiptCommand = {
    type: 'settlement:receipt',
    actorId: 'system',
    payload: {
      settlementPlanId: heldPlan.payload.settlementPlanId
    }
  }
  const sponsorDecision = policy.evaluateCommandPolicy({
    command: {
      type: 'sponsor:createFulfillment',
      payload: {
        receipt: {
          receiptId: 'held-receipt',
          status: 'held',
          body: {
            mode: 'sponsor-prize'
          }
        },
        winnerUserId: 'winner'
      }
    },
    context: {
      allowSponsorPrize: true,
      gates: {
        poolRulesAccepted: true
      }
    }
  })

  const decision = app.evaluateCommand(receiptCommand)
  assert.equal(decision.allowed, false)
  assert.match(decision.reasons.join(' '), /settlement plan readiness/)
  assertPolicyBlocked(() => app.dispatch(receiptCommand), /settlement plan readiness/)
  assert.equal(sponsorDecision.allowed, false)
  assert.match(sponsorDecision.reasons.join(' '), /receipt must be complete/)
})

test('bridge returns policy decisions for blocked commands and can update policy context', () => {
  const handler = bridge.createBridgeHandler({
    platformOptions: { peerId: 'policy-bridge' }
  })
  const command = {
    type: 'pool:create',
    actorId: 'host',
    payload: {
      poolId: 'bridge-cash-pool',
      competitionId: 'bridge-cash-comp',
      title: 'Bridge Cash Pool',
      mode: 'real-money'
    }
  }
  const preflight = handler.handle(bridge.createBridgeRequest({
    action: 'evaluateCommand',
    requestId: 'policy-preflight',
    payload: { command }
  }))
  const blocked = handler.handle(bridge.createBridgeRequest({
    action: 'dispatch',
    requestId: 'policy-dispatch-blocked',
    payload: { command }
  }))
  const context = handler.handle(bridge.createBridgeRequest({
    action: 'setPolicyContext',
    requestId: 'policy-context',
    payload: {
      context: {
        allowRealMoney: true,
        gates: evidencedRealMoneyGates()
      }
    }
  }))
  const allowed = handler.handle(bridge.createBridgeRequest({
    action: 'dispatch',
    requestId: 'policy-dispatch-allowed',
    payload: { command }
  }))

  assert.equal(preflight.ok, true)
  assert.equal(preflight.result.allowed, false)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.error.policy.mode, 'real-money')
  assert.equal(context.ok, true)
  assert.equal(context.result.allowRealMoney, true)
  assert.equal(allowed.ok, true)
  assert.equal(allowed.result.payload.mode, 'real-money')
})
