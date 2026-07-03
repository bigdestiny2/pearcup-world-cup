'use strict'

const wager = require('./wager-engine')
const wallet = require('./wallet-engine')
const { cloneJson, stableId } = require('./util')

const DEFAULT_REWARD_AMOUNT = 100

function createWalletOpsWorkbench (input = {}) {
  const view = input.view || {}
  const userId = input.userId || 'local-peer'
  const now = input.now || new Date().toISOString()
  const accounts = values(view.walletAccounts)
    .filter(account => account.userId === userId)
    .sort(compareAccounts)
  const routes = values(view.payoutRoutes)
    .filter(route => route.userId === userId)
    .sort(compareCreated)
  const declarations = values(view.payoutRecipientDeclarations)
    .filter(declaration => declaration.userId === userId)
    .sort(compareDeclared)
  const readinessPanels = values(view.readinessPanels)
    .filter(panel => panel.userId === userId)
    .sort(compareCreated)
  const receipts = values(view.settlementReceipts)
    .filter(receipt => receiptTouchesUser(receipt, userId) || input.includeOperatorQueues === true)
    .sort(compareCreated)
  const sponsorFulfillments = values(view.sponsorFulfillments)
    .filter(item => item.winnerUserId === userId || input.includeOperatorQueues === true)
    .sort(compareFulfillments)
  const rewardGrants = values(view.walletRewardGrants)
    .filter(grant => (grant.winnerUserIds || []).includes(userId) || input.includeOperatorQueues === true)
    .sort(compareCreated)
  const challengeWagers = values(view.roomChallenges)
    .filter(challenge => challenge.stake)
    .filter(challenge => challenge.challengerUserId === userId || challenge.targetUserId === userId || input.includeOperatorQueues === true)
    .sort(compareCreated)
    .map(challenge => wager.createChallengeWagerPlanFromView({ challenge, view }))

  return {
    workbenchId: stableId(`wallet-ops-${userId}`, {
      accountIds: accounts.map(account => account.accountId),
      receiptIds: receipts.map(receipt => receipt.receiptId),
      routeIds: routes.map(route => route.routeId)
    }),
    userId,
    generatedAt: now,
    counts: {
      accounts: accounts.length,
      activeAccounts: accounts.filter(account => account.status === 'active').length,
      receipts: receipts.length,
      completeReceipts: receipts.filter(receipt => receipt.status === 'complete').length,
      heldReceipts: receipts.filter(receipt => receipt.status === 'held').length,
      sponsorFulfillments: sponsorFulfillments.length,
      pendingSponsorFulfillments: sponsorFulfillments.filter(item => item.status === 'pending' || item.status === 'claimed').length,
      rewardGrants: rewardGrants.length,
      challengeWagers: challengeWagers.length,
      readyStakeHolds: challengeWagers.filter(plan => plan.status === 'ready-to-hold').length,
      readyStakeSettlements: challengeWagers.filter(plan => plan.status === 'ready').length,
      payoutRoutes: routes.length,
      readinessPanels: readinessPanels.length,
      readyPanels: readinessPanels.filter(panel => panel.ready === true).length
    },
    accountSetup: createAccountSetupModel({ userId }),
    accounts: accounts.map(account => accountModel({ account, balance: view.walletBalances && view.walletBalances[account.accountId] || null, userId })),
    receipts: receipts.map(receipt => receiptModel({ receipt, view, userId })),
    rewardGrants: rewardGrants.map(rewardGrantModel),
    challengeWagers: challengeWagers.map(challengeWagerModel),
    sponsorFulfillments: sponsorFulfillments.map(item => sponsorFulfillmentModel({ fulfillment: item, userId })),
    payoutRoutes: routes.map(routeModel),
    payoutSetup: createPayoutSetupModel({ userId, declarations, routes }),
    readinessPanels: readinessPanels.map(readinessPanelModel),
    readiness: createReadinessActionModel({ userId, panels: readinessPanels, declarations, input })
  }
}

function createAccountSetupModel ({ userId }) {
  return {
    commands: [
      {
        mode: 'demo-credit',
        label: 'Demo credits',
        command: {
          type: 'wallet:createAccount',
          actorId: userId,
          payload: {
            userId,
            mode: 'demo-credit',
            currency: wallet.defaultCurrencyForMode('demo-credit')
          }
        }
      },
      {
        mode: 'sponsor-prize',
        label: 'Sponsor prize wallet',
        command: {
          type: 'wallet:createAccount',
          actorId: userId,
          payload: {
            userId,
            mode: 'sponsor-prize',
            currency: wallet.defaultCurrencyForMode('sponsor-prize'),
            gates: sponsorPrizeGates('account-setup')
          }
        }
      },
      {
        mode: 'real-money-readiness',
        label: 'Real-money readiness route',
        command: {
          type: 'wallet:createAccount',
          actorId: userId,
          payload: {
            userId,
            mode: 'real-money-readiness',
            currency: wallet.defaultCurrencyForMode('real-money-readiness')
          }
        }
      }
    ]
  }
}

function accountModel ({ account, balance = null, userId }) {
  const normalizedBalance = balance || {
    accountId: account.accountId,
    userId: account.userId,
    currency: account.currency,
    balance: 0,
    holds: 0,
    available: 0,
    entries: []
  }
  return {
    accountId: account.accountId,
    mode: account.mode,
    currency: account.currency,
    status: account.status,
    label: account.label || null,
    balance: cloneJson(normalizedBalance),
    canDebit: normalizedBalance.available > 0,
    canHold: normalizedBalance.available > 0,
    canRelease: normalizedBalance.holds > 0,
    commandDrafts: {
      credit: ledgerCommand({ account, userId, type: 'credit', amount: DEFAULT_REWARD_AMOUNT, reason: 'manual credit' }),
      debit: ledgerCommand({ account, userId, type: 'debit', amount: Math.min(DEFAULT_REWARD_AMOUNT, normalizedBalance.available), reason: 'manual debit' }),
      hold: ledgerCommand({ account, userId, type: 'hold', amount: Math.min(DEFAULT_REWARD_AMOUNT, normalizedBalance.available), reason: 'stake hold' }),
      release: ledgerCommand({ account, userId, type: 'release', amount: Math.min(DEFAULT_REWARD_AMOUNT, normalizedBalance.holds), reason: 'hold release' }),
      award: ledgerCommand({ account, userId, type: 'award', amount: DEFAULT_REWARD_AMOUNT, reason: 'reward award' })
    }
  }
}

function ledgerCommand ({ account, userId, type, amount, reason }) {
  return {
    type: `wallet:${type}`,
    actorId: userId,
    payload: {
      accountId: account.accountId,
      userId: account.userId,
      amount,
      currency: account.currency,
      reason
    }
  }
}

function receiptModel ({ receipt, view, userId }) {
  const mode = receipt.body && receipt.body.mode || 'demo'
  const winnerUserIds = cloneJson(receipt.body && receipt.body.winnerUserIds || [])
  const grant = values(view.walletRewardGrants)
    .find(item => item.receiptId === receipt.receiptId)
  const sponsorFulfillment = values(view.sponsorFulfillments)
    .find(item => item.receiptId === receipt.receiptId && item.winnerUserId === userId)
  const userIsWinner = winnerUserIds.includes(userId)
  const missingAccounts = winnerUserIds.filter(winnerUserId => !activeAccountForUser(view, winnerUserId))
  const rewardCommandReady = receipt.status === 'complete' && mode === 'demo' && missingAccounts.length === 0 && !grant
  const sponsorCommandReady = receipt.status === 'complete' && mode === 'sponsor-prize' && userIsWinner && !sponsorFulfillment

  return {
    receiptId: receipt.receiptId,
    status: receipt.status,
    heldReason: receipt.heldReason || null,
    mode,
    targetType: receipt.body && receipt.body.targetType,
    targetId: receipt.body && receipt.body.targetId,
    winnerUserIds,
    userIsWinner,
    rewardGrantStatus: grant ? grant.status : null,
    sponsorFulfillmentStatus: sponsorFulfillment ? sponsorFulfillment.status : null,
    missingRewardAccountUserIds: missingAccounts,
    commandDrafts: {
      grantRewards: rewardCommandReady
        ? {
            type: 'wallet:grantReceiptRewards',
            actorId: 'system',
            payload: {
              receiptId: receipt.receiptId,
              amountPerWinner: DEFAULT_REWARD_AMOUNT,
              currency: 'CREDITS'
            }
          }
        : null,
      createSponsorFulfillment: sponsorCommandReady
        ? {
            type: 'sponsor:createFulfillment',
            actorId: userId,
            payload: {
              receiptId: receipt.receiptId,
              winnerUserId: userId,
              gates: sponsorPrizeGates(receipt.receiptId),
              prize: {
                type: 'sponsor-prize',
                label: 'Sponsor prize'
              }
            }
          }
        : null
    }
  }
}

function sponsorFulfillmentModel ({ fulfillment, userId }) {
  return {
    fulfillmentId: fulfillment.fulfillmentId,
    receiptId: fulfillment.receiptId,
    winnerUserId: fulfillment.winnerUserId,
    prize: cloneJson(fulfillment.prize || null),
    status: fulfillment.status,
    sponsorId: fulfillment.sponsorId || null,
    trackingRef: fulfillment.trackingRef || null,
    history: cloneJson(fulfillment.history || []),
    commandDrafts: {
      claim: fulfillment.status === 'pending'
        ? {
            type: 'sponsor:updateFulfillment',
            actorId: userId,
            payload: {
              fulfillmentId: fulfillment.fulfillmentId,
              status: 'claimed',
              gates: sponsorPrizeGates(fulfillment.receiptId)
            }
          }
        : null,
      fulfill: fulfillment.status === 'pending' || fulfillment.status === 'claimed'
        ? {
            type: 'sponsor:updateFulfillment',
            actorId: userId,
            payload: {
              fulfillmentId: fulfillment.fulfillmentId,
              status: 'fulfilled',
              trackingRef: fulfillment.trackingRef || 'tracking-ref',
              gates: sponsorPrizeGates(fulfillment.receiptId)
            }
          }
        : null,
      dispute: fulfillment.status !== 'fulfilled' && fulfillment.status !== 'cancelled'
        ? {
            type: 'sponsor:updateFulfillment',
            actorId: userId,
            payload: {
              fulfillmentId: fulfillment.fulfillmentId,
              status: 'disputed',
              note: 'fulfillment disputed',
              gates: sponsorPrizeGates(fulfillment.receiptId)
            }
          }
        : null
    }
  }
}

function rewardGrantModel (grant) {
  return {
    grantId: grant.grantId,
    receiptId: grant.receiptId,
    mode: grant.mode,
    targetType: grant.targetType,
    targetId: grant.targetId,
    winnerUserIds: cloneJson(grant.winnerUserIds || []),
    amountPerWinner: grant.amountPerWinner,
    currency: grant.currency,
    status: grant.status,
    entryCount: (grant.entries || []).length
  }
}

function challengeWagerModel (plan) {
  return {
    wagerPlanId: plan.wagerPlanId,
    challengeId: plan.challengeId,
    roomId: plan.roomId,
    challengeType: plan.challengeType,
    status: plan.status,
    participantUserIds: cloneJson(plan.participantUserIds || []),
    stake: cloneJson(plan.stake || null),
    missingAccountUserIds: cloneJson(plan.missingAccountUserIds || []),
    holdRows: cloneJson(plan.holdRows || []),
    settlement: plan.settlement
      ? {
          status: plan.settlement.status,
          targetType: plan.settlement.resolution && plan.settlement.resolution.targetType || null,
          targetId: plan.settlement.resolution && plan.settlement.resolution.targetId || null,
          winnerUserIds: cloneJson(plan.settlement.winnerUserIds || []),
          loserUserIds: cloneJson(plan.settlement.loserUserIds || []),
          tied: plan.settlement.tied === true,
          awardAmountPerWinner: plan.settlement.awardAmountPerWinner || 0
        }
      : null,
    commandDrafts: {
      holdStake: cloneJson(plan.holdCommands || []),
      settleStake: cloneJson(plan.settlementCommands || [])
    }
  }
}

function routeModel (route) {
  return {
    routeId: route.routeId,
    userId: route.userId,
    routeType: route.routeType,
    status: route.status,
    label: route.label,
    providerRef: route.providerRef || null,
    readiness: cloneJson(route.readiness || {})
  }
}

function createPayoutSetupModel ({ userId, declarations = [], routes = [] }) {
  const latestDeclaration = declarations[0] || null
  const externalRoute = routes.find(route => route.routeType === 'external-wallet') || null
  const sponsorRoute = routes.find(route => route.routeType === 'sponsor-prize') || null
  return {
    latestDeclaration: latestDeclaration
      ? {
          declarationId: latestDeclaration.declarationId,
          asset: latestDeclaration.asset,
          routeType: latestDeclaration.routeType,
          status: latestDeclaration.status,
          recipientHash: latestDeclaration.recipientHash,
          declaredAt: latestDeclaration.declaredAt
        }
      : null,
    routes: {
      externalWalletRouteId: externalRoute && externalRoute.routeId || null,
      sponsorPrizeRouteId: sponsorRoute && sponsorRoute.routeId || null
    },
    commandDrafts: {
      declareExternalWallet: {
        type: 'compliance:declarePayoutRecipient',
        actorId: userId,
        payload: {
          userId,
          asset: 'USDT',
          routeType: 'external-wallet',
          recipient: 'recipient-placeholder',
          evidenceId: 'recipient-evidence'
        }
      },
      createExternalWalletRoute: {
        type: 'wallet:createPayoutRoute',
        actorId: userId,
        payload: {
          userId,
          routeType: 'external-wallet',
          mode: 'real-money-readiness',
          label: 'External payout route'
        }
      },
      createSponsorPrizeRoute: {
        type: 'wallet:createPayoutRoute',
        actorId: userId,
        payload: {
          userId,
          routeType: 'sponsor-prize',
          mode: 'sponsor-prize',
          label: 'Sponsor prize claim',
          gates: sponsorPrizeGates('payout-route')
        }
      }
    }
  }
}

function readinessPanelModel (panel) {
  return {
    readinessPanelId: panel.readinessPanelId,
    userId: panel.userId,
    targetType: panel.targetType,
    targetId: panel.targetId,
    mode: panel.mode,
    ready: panel.ready,
    missingGates: cloneJson(panel.readiness && panel.readiness.missingGates || []),
    missingGateEvidence: cloneJson(panel.readiness && panel.readiness.missingGateEvidence || []),
    sections: cloneJson(panel.sections || []),
    createdAt: panel.createdAt || null
  }
}

function createReadinessActionModel ({ userId, panels = [], declarations = [], input = {} }) {
  const latestPanel = panels[0] || null
  const latestDeclaration = declarations[0] || null
  const targetType = input.targetType || 'user'
  const targetId = input.targetId || userId
  return {
    latestPanel: latestPanel ? readinessPanelModel(latestPanel) : null,
    routeDeclared: Boolean(latestDeclaration && latestDeclaration.status !== 'revoked'),
    commandDrafts: {
      createRealMoneyPanel: {
        type: 'compliance:createReadinessPanel',
        actorId: userId,
        payload: {
          userId,
          targetType,
          targetId,
          mode: 'real-money',
          proposedExposure: input.proposedExposure || null,
          evidence: cloneJson(input.evidence || {})
        }
      },
      setDailyStakeLimit: {
        type: 'compliance:setLimit',
        actorId: userId,
        payload: {
          userId,
          limitType: 'daily-stake',
          amount: 100,
          currency: 'USDT'
        }
      },
      recordStakeExposure: {
        type: 'compliance:recordExposure',
        actorId: userId,
        payload: {
          userId,
          exposureType: 'stake',
          amount: 0,
          currency: 'USDT',
          sourceType: targetType,
          sourceId: targetId
        }
      }
    }
  }
}

function sponsorPrizeGates (evidenceId) {
  return {
    poolRulesAccepted: {
      ok: true,
      evidenceId
    }
  }
}

function receiptTouchesUser (receipt, userId) {
  return (receipt.body && receipt.body.winnerUserIds || []).includes(userId)
}

function activeAccountForUser (view, userId) {
  return values(view.walletAccounts)
    .find(account => account.userId === userId && account.status === 'active')
}

function compareAccounts (left, right) {
  if (left.mode !== right.mode) return String(left.mode).localeCompare(String(right.mode))
  return String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
}

function compareCreated (left, right) {
  return String(right.createdAt || '').localeCompare(String(left.createdAt || ''))
}

function compareDeclared (left, right) {
  return String(right.declaredAt || '').localeCompare(String(left.declaredAt || ''))
}

function compareFulfillments (left, right) {
  const leftAt = lastHistoryAt(left)
  const rightAt = lastHistoryAt(right)
  return String(rightAt).localeCompare(String(leftAt))
}

function lastHistoryAt (fulfillment) {
  const history = fulfillment.history || []
  return history.length ? history[history.length - 1].at : ''
}

function values (collection = {}) {
  return Object.values(collection || {})
}

module.exports = {
  DEFAULT_REWARD_AMOUNT,
  createWalletOpsWorkbench,
  createAccountSetupModel,
  accountModel,
  receiptModel,
  challengeWagerModel,
  sponsorFulfillmentModel,
  createPayoutSetupModel,
  createReadinessActionModel,
  sponsorPrizeGates
}
