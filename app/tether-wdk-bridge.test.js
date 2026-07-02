const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')
const { createWorkerSim } = require('./worker-sim.js')
const { createDemoQvacAdapter } = require('./adapters.js')
const { createTetherWdkProcessorAdapter, normalizeAsset, paymentMethodForAsset } = require('./tether-wdk-bridge.js')

test('Tether WDK bridge maps PearCup assets to processor methods', () => {
  assert.equal(normalizeAsset('USDT'), 'usdt-evm')
  assert.equal(normalizeAsset('btc'), 'btc')
  assert.equal(paymentMethodForAsset('USDT'), 'crypto_usdt')
  assert.equal(paymentMethodForAsset('btc'), 'crypto_btc')
})

test('Tether WDK bridge sends a USDT processor method for USDT-EVM receive intents', async () => {
  let transactionInput = null
  const tetherWdk = createTetherWdkProcessorAdapter({
    processor: {
      async createTransaction (input) {
        transactionInput = input
        return {
          id: `wdk-${input.reference}`,
          status: 'awaiting_payment',
          address: '0xusdtmethod',
          chain: 'ethereum'
        }
      }
    },
    rail: 'tether-wdk-usdt-method-test'
  })

  const intent = await tetherWdk.createEntryIntent({
    poolId: 'pool-usdt-method',
    entryId: 'entry-usdt-method',
    userId: 'user-captain',
    username: 'captain',
    amount: 25,
    asset: 'USDT'
  })

  assert.equal(transactionInput.asset, 'usdt-evm')
  assert.equal(transactionInput.method, 'crypto_usdt')
  assert.equal(intent.receiveAddress, '0xusdtmethod')
})

test('Tether WDK processor bridge passes game release recipient routing', async () => {
  let releaseInput = null
  const tetherWdk = createTetherWdkProcessorAdapter({
    processor: {
      async releaseEscrow (input) {
        releaseInput = input
        return {
          id: `processor-${input.payout.payoutId}`,
          status: 'quoted',
          transfers: [{
            userId: input.winnerUserId,
            recipient: input.payoutRecipients[input.winnerUserId],
            baseAmount: '5000000'
          }]
        }
      }
    },
    rail: 'tether-wdk-game-recipient-test'
  })
  const gameId = 'pc-game-recipient-route'
  const roundId = 'pc-1'
  const shooter = { id: 'user-captain', username: 'captain' }
  const keeper = { id: 'user-vera', username: 'vera' }
  const shooterInput = { role: 'shooter', aimZone: 'right-high', powerBand: 3, curveBand: 1, releaseTick: 42 }
  const keeperInput = { role: 'keeper', diveZone: 'right-high', releaseTick: 43 }
  const roundResult = core.createPenaltyClashRound({
    gameId,
    roundId,
    roundIndex: 0,
    shooter,
    keeper,
    shooterInput,
    keeperInput
  })
  const attestation = core.createQvacRefereeAttestation({ roundResult })
  const escrow = core.createTetherWdkEscrowIntent({
    gameId,
    players: [shooter.id, keeper.id],
    amount: 5,
    asset: 'USDT',
    rail: 'tether-wdk-game-recipient-test'
  })
  const payoutRecipients = { [keeper.id]: '0xkeeperrecipient' }
  const payout = await tetherWdk.releaseGameEscrow({
    escrow,
    attestation,
    winnerUserId: keeper.id,
    payoutRecipients
  })

  assert.equal(releaseInput.payoutRecipients[keeper.id], payoutRecipients[keeper.id])
  assert.equal(releaseInput.payout.payoutId, payout.payoutId)
  assert.equal(payout.processorRelease.transfers[0].recipient, payoutRecipients[keeper.id])
})

test('Tether WDK processor bridge refunds locked game escrows with processor evidence', async () => {
  const calls = []
  const refundPlayers = ['user-captain', 'user-vera']
  const tetherWdk = createTetherWdkProcessorAdapter({
    processor: {
      async createTransaction (input) {
        calls.push(['createTransaction', input.reference])
        return {
          id: `wdk-${input.reference}`,
          status: 'awaiting_payment',
          address: '0xescrowrefund',
          chain: 'ethereum'
        }
      },
      async refundEscrow (transaction, opts) {
        calls.push(['refundEscrow', transaction.id, opts.reason])
        return {
          status: 'refunded',
          refundId: `refund-${transaction.id}`
        }
      }
    },
    rail: 'tether-wdk-game-refund-test'
  })
  const escrow = await tetherWdk.createGameEscrow({
    gameId: 'pc-bridge-refund',
    players: refundPlayers,
    amount: 5,
    asset: 'USDT'
  })
  const refund = await tetherWdk.refundGameEscrow({
    escrow,
    reason: 'match-cancelled'
  })

  assert.equal(escrow.wdkTransactionId, `wdk-${escrow.escrowId}`)
  assert.equal(refund.status, 'refunded')
  assert.equal(refund.processorRefund.status, 'refunded')
  assert.equal(refund.escrowId, escrow.escrowId)
  assert.equal(refund.rail, 'tether-wdk-game-refund-test')
  assert.deepEqual(calls.map(call => call[0]), ['createTransaction', 'refundEscrow'])
})

test('async Tether WDK processor bridge creates and confirms bracket entry payments', async () => {
  const calls = []
  const processor = {
    async createTransaction (input) {
      calls.push(['createTransaction', input])
      return {
        id: `wdk-${input.reference}`,
        status: 'awaiting_payment',
        address: '0xabc',
        chain: 'ethereum',
        qrData: `ethereum:0xabc?amount=${input.amountCents}`
      }
    },
    async collectPaymentMethod (transaction) {
      calls.push(['collectPaymentMethod', transaction.id])
      return transaction
    },
    async confirmPayment (transaction) {
      calls.push(['confirmPayment', transaction.id])
      return { status: 'captured', received: '25000000' }
    }
  }
  const tetherWdk = createTetherWdkProcessorAdapter({ processor, rail: 'tether-wdk-test' })
  const worker = createWorkerSim({
    adapters: {
      qvac: createDemoQvacAdapter(),
      tetherWdk,
      mode: { qvac: 'demo', tetherWdk: 'sdk' }
    }
  })

  assert.throws(() => worker.dispatch({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-25', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  }), /dispatchAsync/)

  const intent = await worker.dispatchAsync({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-25', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const payment = await worker.dispatchAsync({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-test',
    payload: { intentId: intent.payload.intentId, confirmationId: 'chain-confirm-1' }
  })

  assert.equal(intent.type, 'TetherWdkEntryIntentCreated')
  assert.equal(intent.payload.receiveAddress, '0xabc')
  assert.equal(payment.type, 'TetherWdkEntryConfirmed')
  assert.equal(payment.payload.processorConfirmation.status, 'captured')
  assert.deepEqual(calls.map(call => call[0]), ['createTransaction', 'collectPaymentMethod', 'confirmPayment'])
})

test('async Tether WDK processor bridge refunds confirmed bracket entry payments', async () => {
  const calls = []
  const processor = {
    async createTransaction (input) {
      calls.push(['createTransaction', input.reference])
      return {
        id: `wdk-${input.reference}`,
        status: 'awaiting_payment',
        address: '0xrefund',
        chain: 'ethereum'
      }
    },
    async confirmPayment (transaction) {
      calls.push(['confirmPayment', transaction.id])
      return { status: 'captured', received: '25000000' }
    },
    async refundPayment (transaction, opts) {
      calls.push(['refundPayment', transaction.id, opts.reason])
      return { status: 'refunded', refundId: `refund-${transaction.id}` }
    }
  }
  const tetherWdk = createTetherWdkProcessorAdapter({ processor, rail: 'tether-wdk-refund-test' })
  const worker = createWorkerSim({
    adapters: {
      qvac: createDemoQvacAdapter(),
      tetherWdk,
      mode: { qvac: 'demo', tetherWdk: 'sdk' }
    }
  })
  const intent = await worker.dispatchAsync({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-refund', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const payment = await worker.dispatchAsync({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-refund-test',
    payload: { intentId: intent.payload.intentId, confirmationId: 'chain-confirm-refund' }
  })
  const refund = await worker.dispatchAsync({
    type: 'wdk:refundEntryIntent',
    actorId: 'tether-wdk-refund-test',
    payload: { paymentId: payment.payload.paymentId, reason: 'pool-cancelled' }
  })
  const view = worker.view()

  assert.equal(payment.payload.wdkTransactionId, intent.payload.wdkTransactionId)
  assert.equal(refund.type, 'TetherWdkEntryRefunded')
  assert.equal(refund.actorId, 'tether-wdk-refund-test')
  assert.equal(refund.payload.processorRefund.status, 'refunded')
  assert.equal(view.entryPayments[payment.payload.paymentId], undefined)
  assert.equal(view.entryRefundsByPayment[payment.payload.paymentId].refundId, refund.payload.refundId)
  assert.deepEqual(calls.map(call => call[0]), ['createTransaction', 'confirmPayment', 'refundPayment'])
})

test('Tether WDK processor bridge keeps entries pending without processor confirmation support', async () => {
  const tetherWdk = createTetherWdkProcessorAdapter({
    processor: {
      async createTransaction (input) {
        return {
          id: `wdk-${input.reference}`,
          status: 'awaiting_payment',
          address: '0xpending',
          chain: 'ethereum'
        }
      }
    },
    rail: 'tether-wdk-confirmation-required-test'
  })
  const worker = createWorkerSim({
    adapters: {
      qvac: createDemoQvacAdapter(),
      tetherWdk,
      mode: { qvac: 'demo', tetherWdk: 'sdk' }
    }
  })
  const intent = await worker.dispatchAsync({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-confirm-required', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const pending = await worker.dispatchAsync({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-confirmation-required-test',
    payload: { intentId: intent.payload.intentId, confirmationId: 'manual-confirm-without-processor' }
  })
  const view = worker.view()

  assert.equal(pending.type, 'TetherWdkEntryPaymentPending')
  assert.equal(pending.actorId, pending.payload.rail)
  assert.equal(pending.payload.rail, 'tether-wdk-confirmation-required-test')
  assert.equal(pending.payload.status, 'pending')
  assert.equal(pending.payload.processorStatus, 'confirmation_failed')
  assert.match(pending.payload.reason, /confirmPayment is required/)
  assert.equal(Object.keys(view.entryPayments).length, 0)
  assert.equal(Object.keys(view.entryPaymentChecks).length, 1)
})

test('Tether WDK processor bridge keeps entries pending until confirmation is paid', async () => {
  const calls = []
  const tetherWdk = createTetherWdkProcessorAdapter({
    processor: {
      async createTransaction (input) {
        calls.push(['createTransaction', input.reference])
        return {
          id: `wdk-${input.reference}`,
          status: 'awaiting_payment',
          address: '0xnotpaidyet',
          chain: 'ethereum'
        }
      },
      async confirmPayment (transaction) {
        calls.push(['confirmPayment', transaction.id])
        return { status: 'awaiting_payment', paid: false, received: '0' }
      }
    },
    rail: 'tether-wdk-unpaid-confirmation-test'
  })
  const worker = createWorkerSim({
    adapters: {
      qvac: createDemoQvacAdapter(),
      tetherWdk,
      mode: { qvac: 'demo', tetherWdk: 'sdk' }
    }
  })
  const intent = await worker.dispatchAsync({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-unpaid-confirmation', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const pending = await worker.dispatchAsync({
    type: 'wdk:confirmEntryIntent',
    actorId: 'tether-wdk-unpaid-confirmation-test',
    payload: { intentId: intent.payload.intentId }
  })

  assert.equal(pending.type, 'TetherWdkEntryPaymentPending')
  assert.equal(pending.actorId, pending.payload.rail)
  assert.equal(pending.payload.rail, 'tether-wdk-unpaid-confirmation-test')
  assert.equal(pending.payload.status, 'pending')
  assert.match(pending.payload.reason, /not been confirmed/)
  assert.deepEqual(calls, [
    ['createTransaction', intent.payload.intentId],
    ['confirmPayment', intent.payload.wdkTransactionId]
  ])
})

test('async Tether WDK processor bridge reconciles pending and captured entry payments', async () => {
  const calls = []
  const statuses = [
    { id: 'wdk-pending', status: 'awaiting_payment', paid: false, received: '0', expected: '25000000' },
    { id: 'wdk-captured', status: 'captured', paid: true, received: '25000000', expected: '25000000' }
  ]
  const processor = {
    async createTransaction (input) {
      calls.push(['createTransaction', input.reference])
      return {
        id: `wdk-${input.reference}`,
        status: 'awaiting_payment',
        address: '0xabc',
        chain: 'ethereum',
        qrData: `ethereum:0xabc?amount=${input.amountCents}`
      }
    },
    async checkStatus (transactionId) {
      calls.push(['checkStatus', transactionId])
      return statuses.shift()
    }
  }
  const tetherWdk = createTetherWdkProcessorAdapter({ processor, rail: 'tether-wdk-reconcile-test' })
  const worker = createWorkerSim({
    adapters: {
      qvac: createDemoQvacAdapter(),
      tetherWdk,
      mode: { qvac: 'demo', tetherWdk: 'sdk' }
    }
  })
  const intent = await worker.dispatchAsync({
    type: 'wdk:createEntryIntent',
    actorId: 'user-captain',
    payload: { poolId: 'pool-reconcile', entryId: 'entry-captain', userId: 'user-captain', username: 'captain', amount: 25, asset: 'USDT' }
  })
  const pending = await worker.dispatchAsync({
    type: 'wdk:reconcileEntryIntent',
    actorId: 'tether-wdk-reconcile-test',
    payload: { intentId: intent.payload.intentId }
  })
  const payment = await worker.dispatchAsync({
    type: 'wdk:reconcileEntryIntent',
    actorId: 'tether-wdk-reconcile-test',
    payload: { intentId: intent.payload.intentId }
  })
  const repeat = await worker.dispatchAsync({
    type: 'wdk:reconcileEntryIntent',
    actorId: 'tether-wdk-reconcile-test',
    payload: { intentId: intent.payload.intentId }
  })
  const view = worker.view()

  assert.equal(pending.type, 'TetherWdkEntryPaymentPending')
  assert.equal(pending.actorId, pending.payload.rail)
  assert.equal(pending.payload.rail, 'tether-wdk-reconcile-test')
  assert.equal(pending.payload.status, 'pending')
  assert.equal(payment.type, 'TetherWdkEntryConfirmed')
  assert.equal(payment.payload.status, 'confirmed')
  assert.equal(payment.payload.processorConfirmation.status, 'captured')
  assert.equal(repeat.eventId, payment.eventId)
  assert.equal(Object.keys(view.entryPaymentChecks).length, 1)
  assert.equal(Object.keys(view.entryPayments).length, 1)
  assert.equal(view.entryPaymentChecksByIntent[intent.payload.intentId].checkId, pending.payload.checkId)
  assert.equal(view.entryPaymentsByIntent[intent.payload.intentId].paymentId, payment.payload.paymentId)
  assert.deepEqual(calls, [
    ['createTransaction', intent.payload.intentId],
    ['checkStatus', intent.payload.wdkTransactionId],
    ['checkStatus', intent.payload.wdkTransactionId]
  ])
})

test('Tether WDK processor bridge attaches package payout preparation evidence', async () => {
  let processorInput = null
  const tetherWdk = createTetherWdkProcessorAdapter({
    processor: {
      async preparePoolPayout (input) {
        processorInput = input
        return {
          id: 'processor-payout-quote',
          status: 'quoted',
          transfers: [{
            userId: 'user-captain',
            recipient: '0xwinner',
            baseAmount: '25000000'
          }]
        }
      }
    },
    rail: 'tether-wdk-payout-bridge-test'
  })

  const confirmedEntries = [{
      paymentId: 'pay-captain',
      poolId: 'pool-payout-bridge',
      userId: 'user-captain',
      amount: 25,
      status: 'confirmed'
  }]
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-payout-bridge',
    confirmedEntries,
    winnerUserIds: ['user-captain'],
    officialResults: { champion: 'Brazil' }
  })
  const attestation = core.createQvacPoolSettlementAttestation({ poolResult })

  const payout = await tetherWdk.createPoolPayout({
    poolId: 'pool-payout-bridge',
    confirmedEntries,
    winnerUserIds: ['user-captain'],
    attestation,
    asset: 'USDT'
  })

  assert.equal(payout.status, 'prepared')
  assert.equal(payout.amountEach, 25)
  assert.equal(payout.processorPayout.status, 'quoted')
  assert.equal(payout.processorPayout.transfers[0].baseAmount, '25000000')
  assert.equal(processorInput.payout.payoutId, payout.payoutId)
  assert.equal(processorInput.payout.amountEach, 25)
})

test('async WDK and QVAC adapters complete trusted game escrow release', async () => {
  const tetherWdk = createTetherWdkProcessorAdapter({
    processor: {
      async createTransaction (input) {
        return { id: `wdk-${input.reference}`, status: 'captured', address: '0xgame', chain: 'ethereum' }
      },
      async releaseEscrow ({ payout }) {
        return { id: `release-${payout.payoutId}`, status: 'prepared' }
      }
    },
    rail: 'tether-wdk-game-test'
  })
  const worker = createWorkerSim({
    adapters: {
      qvac: createDemoQvacAdapter(),
      tetherWdk,
      mode: { qvac: 'demo', tetherWdk: 'sdk' }
    }
  })
  const gameId = 'pc-wdk-game'
  const roundId = 'pc-1'
  const shooter = { id: 'user-captain', username: 'captain' }
  const keeper = { id: 'user-vera', username: 'vera' }
  const shooterInput = { role: 'shooter', aimZone: 'right-high', powerBand: 3, curveBand: 1, releaseTick: 42 }
  const keeperInput = { role: 'keeper', diveZone: 'right-high', releaseTick: 43 }

  const escrow = await worker.dispatchAsync({
    type: 'wdk:createGameEscrow',
    actorId: 'tether-wdk-game-test',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })
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
  worker.dispatch({
    type: 'game:resolveRound',
    actorId: 'system',
    payload: { gameId, roundIndex: 0, shooter, keeper }
  })
  worker.dispatch({
    type: 'qvac:refereeAttest',
    actorId: 'qvac-demo-ref',
    payload: { gameId, roundId }
  })
  const release = await worker.dispatchAsync({
    type: 'wdk:releaseGameEscrow',
    actorId: 'tether-wdk-game-test',
    payload: { gameId, roundId, escrowId: escrow.payload.escrowId, winnerUserId: keeper.id }
  })

  assert.equal(escrow.payload.receiveAddress, '0xgame')
  assert.equal(release.type, 'TetherWdkEscrowReleased')
  assert.equal(release.payload.processorRelease.status, 'prepared')
})
