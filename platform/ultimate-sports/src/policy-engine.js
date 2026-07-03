'use strict'

const { RISK_CLASSES, SETTLEMENT_MODES } = require('./constants')
const settlement = require('./settlement-engine')
const { cloneJson } = require('./util')

const DEFAULT_POLICY_CONTEXT = Object.freeze({
  allowSponsorPrize: true,
  allowRealMoney: false,
  requireRealMoneyEvidence: true,
  gates: {}
})

const ALWAYS_CASUAL_COMMANDS = Object.freeze([
  'user:upsert',
  'invite:create',
  'invite:accept',
  'trust:record',
  'dispute:open',
  'dispute:respond',
  'dispute:resolve',
  'audit:export',
  'attestation:create',
  'competition:create',
  'room:create',
  'room:join',
  'room:leave',
  'room:chat',
  'room:voice',
  'room:react',
  'room:moderate',
  'room:challenge',
  'room:acceptChallenge',
  'feed:registerAdapter',
  'feed:recordFrame',
  'result:record',
  'result:recordFromFeed',
  'result:correct',
  'card:create',
  'card:submit',
  'card:resolve',
  'draft:create',
  'draft:submit',
  'draft:resolve'
])

const POOL_BOUND_COMMANDS = Object.freeze([
  'prediction:submit',
  'prediction:lock',
  'pool:resolve',
  'settlement:plan',
  'settlement:receipt'
])

const MARKET_BOUND_COMMANDS = Object.freeze([
  'market:create',
  'market:predict',
  'market:lock',
  'market:resolve',
  'market:resolveStreak'
])

const GAME_BOUND_COMMANDS = Object.freeze([
  'game:create',
  'game:start',
  'game:commit',
  'game:reveal',
  'game:resolve'
])

const WALLET_BOUND_COMMANDS = Object.freeze([
  'wallet:createAccount',
  'wallet:credit',
  'wallet:debit',
  'wallet:hold',
  'wallet:release',
  'wallet:award',
  'wallet:createPayoutRoute',
  'wallet:grantReceiptRewards'
])

function defaultPolicyContext () {
  return {
    ...DEFAULT_POLICY_CONTEXT,
    gates: {}
  }
}

function normalizePolicyContext (context = {}) {
  return {
    ...DEFAULT_POLICY_CONTEXT,
    ...context,
    gates: cloneJson(context.gates || {})
  }
}

function evaluateCommandPolicy ({ command = {}, view = {}, context = {} } = {}) {
  const normalized = normalizePolicyContext(context)
  if (!command || typeof command !== 'object') {
    return blockedDecision({
      commandType: null,
      mode: 'none',
      riskClass: 'casual',
      reasons: ['command must be an object']
    })
  }
  if (typeof command.type !== 'string' || command.type.trim() === '') {
    return blockedDecision({
      commandType: null,
      mode: 'none',
      riskClass: 'casual',
      reasons: ['command.type is required']
    })
  }

  const mode = inferCommandSettlementMode({ command, view })
  const riskClass = riskClassForMode(mode)
  const readiness = readinessForMode({
    command,
    mode,
    context: normalized
  })
  const reasons = artifactGuardReasons({ command, view })

  if (riskClass === 'casual') {
    return allowedDecision({ commandType: command.type, mode, riskClass, readiness })
  }

  if (riskClass === 'prize') {
    if (!normalized.allowSponsorPrize) reasons.push('sponsor-prize commands are disabled by policy')
    if (!readiness.ready) reasons.push('sponsor-prize readiness gates are incomplete')
    return policyDecision({ commandType: command.type, mode, riskClass, readiness, reasons })
  }

  if (!normalized.allowRealMoney) reasons.push('real-money commands are disabled by policy')
  if (!readiness.ready) reasons.push('real-money readiness gates are incomplete')
  return policyDecision({ commandType: command.type, mode, riskClass, readiness, reasons })
}

function assertCommandAllowed (input = {}) {
  const decision = evaluateCommandPolicy(input)
  if (decision.allowed) return decision

  const error = new Error(`command blocked by policy: ${decision.reasons.join('; ')}`)
  error.code = 'policy-blocked'
  error.policy = decision
  throw error
}

function inferCommandSettlementMode ({ command = {}, view = {} } = {}) {
  const payload = command.payload || {}
  const direct = firstAllowedMode([
    payload.mode,
    payload.settlementMode,
    payload.payoutMode,
    payload.prizeMode,
    payload.stakeMode,
    payoutPolicyMode(payload.payoutPolicy),
    payoutPolicyMode(payload.rules && payload.rules.payoutPolicy)
  ])
  if (direct) return direct

  if (ALWAYS_CASUAL_COMMANDS.includes(command.type)) return 'none'
  if (POOL_BOUND_COMMANDS.includes(command.type)) return poolBoundMode({ command, view })
  if (MARKET_BOUND_COMMANDS.includes(command.type)) return marketBoundMode({ command, view })
  if (GAME_BOUND_COMMANDS.includes(command.type)) return gameBoundMode({ command, view })
  if (WALLET_BOUND_COMMANDS.includes(command.type)) return walletBoundMode({ command, view })
  if (command.type === 'sponsor:createFulfillment' || command.type === 'sponsor:updateFulfillment') {
    return sponsorFulfillmentMode({ command, view })
  }

  return 'none'
}

function readinessForMode ({ command = {}, mode, context = {} } = {}) {
  const payload = command.payload || {}
  if (mode === 'none' || mode === 'demo') {
    return settlement.evaluateSettlementReadiness({ mode })
  }

  const gates = {
    ...(context.gates || {}),
    ...(payload.gates || {})
  }
  const requireEvidence = mode === 'real-money'
    ? context.requireRealMoneyEvidence !== false
    : payload.requireEvidence === true

  return settlement.evaluateSettlementReadiness({
    mode,
    gates,
    requireEvidence
  })
}

function poolBoundMode ({ command = {}, view = {} } = {}) {
  const payload = command.payload || {}
  if (command.type === 'settlement:receipt') {
    const plan = payload.settlementPlan || getById(view.settlementPlans, payload.settlementPlanId)
    if (plan && plan.mode) return plan.mode
  }

  const pool = payload.pool || getById(view.pools, payload.poolId)
  if (pool && pool.mode) return pool.mode

  const entry = payload.entry || getById(view.predictionEntries, payload.entryId)
  if (entry) {
    const entryPool = getById(view.pools, entry.poolId)
    if (entryPool && entryPool.mode) return entryPool.mode
  }

  return 'demo'
}

function marketBoundMode ({ command = {}, view = {} } = {}) {
  const payload = command.payload || {}
  const market = payload.market || getById(view.markets, payload.marketId)
  if (!market && Array.isArray(payload.marketIds)) {
    const firstMarket = payload.marketIds.map(marketId => getById(view.markets, marketId)).find(Boolean)
    return firstMarket && (firstMarket.mode || firstMarket.stakeMode || firstMarket.settlementMode) || 'demo'
  }
  return market && (market.mode || market.stakeMode || market.settlementMode) || 'demo'
}

function gameBoundMode ({ command = {}, view = {} } = {}) {
  const payload = command.payload || {}
  const session = payload.session || getById(view.gameSessions, payload.gameId)
  return session && session.stakeMode || payload.stakeMode || 'none'
}

function sponsorFulfillmentMode ({ command = {}, view = {} } = {}) {
  const payload = command.payload || {}
  const fulfillment = payload.fulfillment || getById(view.sponsorFulfillments, payload.fulfillmentId)
  if (fulfillment) return 'sponsor-prize'

  const receipt = payload.receipt || getById(view.settlementReceipts, payload.receiptId)
  return receipt && receipt.body && receipt.body.mode || 'sponsor-prize'
}

function walletBoundMode ({ command = {}, view = {} } = {}) {
  const payload = command.payload || {}
  if (payload.mode === 'real-money-readiness' || payload.routeType === 'external-wallet') return 'real-money'
  if (payload.mode === 'sponsor-prize' || payload.routeType === 'sponsor-prize') return 'sponsor-prize'

  if (command.type === 'wallet:grantReceiptRewards') {
    const receipt = referencedSettlementReceipt({ command, view })
    return receipt && receipt.body && receipt.body.mode || 'demo'
  }

  const account = payload.account || getById(view.walletAccounts, payload.accountId)
  if (account && account.mode === 'real-money-readiness') return 'real-money'
  if (account && account.mode === 'sponsor-prize') return 'sponsor-prize'

  return 'demo'
}

function artifactGuardReasons ({ command = {}, view = {} } = {}) {
  const reasons = []

  if (command.type === 'settlement:receipt') {
    const plan = referencedSettlementPlan({ command, view })
    if (plan && plan.readiness && plan.readiness.ready !== true) {
      reasons.push('settlement plan readiness is incomplete')
    }
  }

  if (command.type === 'sponsor:createFulfillment') {
    const receipt = referencedSettlementReceipt({ command, view })
    if (receipt && receipt.status !== 'complete') {
      reasons.push('settlement receipt must be complete before sponsor fulfillment')
    }
  }

  if (command.type === 'wallet:grantReceiptRewards') {
    const receipt = referencedSettlementReceipt({ command, view })
    if (receipt && receipt.status !== 'complete') {
      reasons.push('settlement receipt must be complete before wallet rewards')
    }
  }

  return reasons
}

function referencedSettlementPlan ({ command = {}, view = {} } = {}) {
  const payload = command.payload || {}
  return payload.settlementPlan || getById(view.settlementPlans, payload.settlementPlanId)
}

function referencedSettlementReceipt ({ command = {}, view = {} } = {}) {
  const payload = command.payload || {}
  return payload.receipt || getById(view.settlementReceipts, payload.receiptId)
}

function payoutPolicyMode (value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return value.mode || value.settlementMode || value.kind
  return null
}

function firstAllowedMode (values) {
  return values.find(value => SETTLEMENT_MODES.includes(value)) || null
}

function riskClassForMode (mode) {
  if (mode === 'real-money') return 'regulated'
  if (mode === 'sponsor-prize') return 'prize'
  return 'casual'
}

function policyDecision ({ commandType, mode, riskClass, readiness, reasons }) {
  return {
    allowed: reasons.length === 0,
    commandType,
    mode,
    riskClass,
    reasons,
    readiness: summarizeReadiness(readiness)
  }
}

function allowedDecision ({ commandType, mode, riskClass, readiness }) {
  return policyDecision({
    commandType,
    mode,
    riskClass,
    readiness,
    reasons: []
  })
}

function blockedDecision ({ commandType, mode, riskClass, reasons }) {
  return policyDecision({
    commandType,
    mode,
    riskClass,
    readiness: {
      ready: false,
      mode,
      requiredGates: [],
      missingGates: [],
      missingGateEvidence: []
    },
    reasons
  })
}

function summarizeReadiness (readiness = {}) {
  return {
    ready: readiness.ready === true,
    mode: readiness.mode || 'none',
    requiredGates: cloneJson(readiness.requiredGates || []),
    missingGates: cloneJson(readiness.missingGates || []),
    missingGateEvidence: cloneJson(readiness.missingGateEvidence || []),
    gateStatuses: cloneJson(readiness.gateStatuses || [])
  }
}

function getById (collection, id) {
  if (!collection || !id) return null
  return collection[id] || null
}

module.exports = {
  DEFAULT_POLICY_CONTEXT,
  RISK_CLASSES,
  defaultPolicyContext,
  normalizePolicyContext,
  evaluateCommandPolicy,
  assertCommandAllowed,
  inferCommandSettlementMode,
  riskClassForMode
}
