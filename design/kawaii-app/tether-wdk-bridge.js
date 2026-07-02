(function attachPearCupTetherWdkBridge (root) {
  const core = root.PearCupCore || (typeof require !== 'undefined' ? require('./core.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupTetherWdkBridge')

  function toAmountCents (amount) {
    return Math.round(Number(amount || 0) * 100)
  }

  function normalizeAsset (asset) {
    const value = String(asset || 'USDT').toLowerCase()
    if (value === 'btc' || value === 'bitcoin') return 'btc'
    return 'usdt-evm'
  }

  function paymentMethodForAsset (asset) {
    return normalizeAsset(asset) === 'btc' ? 'crypto_btc' : 'crypto_usdc'
  }

  async function createProcessorTransaction (processor, input, reference) {
    if (!processor || typeof processor.createTransaction !== 'function') return null
    const transaction = await processor.createTransaction({
      amountCents: toAmountCents(input.amount),
      asset: normalizeAsset(input.asset),
      method: paymentMethodForAsset(input.asset),
      reference
    })
    if (processor && typeof processor.collectPaymentMethod === 'function') {
      await processor.collectPaymentMethod(transaction)
    }
    return transaction
  }

  function attachTransactionFields (value, transaction) {
    if (!transaction) return value
    return {
      ...value,
      wdkTransactionId: transaction.id || transaction.processorId || null,
      receiveAddress: transaction.address || null,
      paymentUri: transaction.qrData || null,
      chain: transaction.chain || null,
      token: transaction.token || null,
      processorStatus: transaction.status || null
    }
  }

  function isProcessorPaid (status = {}) {
    return status.paid === true ||
      status.status === 'captured' ||
      status.status === 'confirmed' ||
      status.status === 'paid'
  }

  function confirmationIdFor ({ confirmationId, confirmation, status, intent } = {}) {
    return confirmationId ||
      confirmation && (confirmation.id || confirmation.confirmationId || confirmation.transactionId) ||
      status && (status.confirmationId || status.transactionId || status.id) ||
      intent && intent.wdkTransactionId
  }

  function pendingEntryPayment ({ intent, confirmationId, processorStatus, reason }) {
    if (!intent) {
      return {
        checkId: core.deterministicHash({
          intentId: null,
          confirmationId: confirmationId || null,
          processorStatus,
          reason
        }),
        intentId: null,
        status: 'pending',
        processorStatus,
        reason,
        checkedAt: '2026-07-01T00:00:00.000Z'
      }
    }
    return core.createTetherWdkEntryPaymentPending({
      intent,
      confirmationId,
      processorStatus,
      reason
    })
  }

  function createTetherWdkProcessorAdapter ({ processor, rail = 'tether-wdk-processor' } = {}) {
    return {
      id: rail,
      mode: 'sdk',
      async: true,

      async createGameEscrow (input) {
        const escrow = core.createTetherWdkEscrowIntent({ ...input, rail })
        const transaction = await createProcessorTransaction(processor, input, escrow.escrowId)
        return attachTransactionFields(escrow, transaction)
      },

      async releaseGameEscrow ({ escrow, attestation, winnerUserId, payoutAddress, payoutRecipients }) {
        const payout = core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
        if (processor && typeof processor.releaseEscrow === 'function') {
          const processorRelease = await processor.releaseEscrow({
            escrow,
            attestation,
            winnerUserId,
            payout,
            payoutAddress,
            payoutRecipients
          })
          return { ...payout, processorRelease }
        }
        return payout
      },

      async createEntryIntent (input) {
        const intent = core.createTetherWdkEntryIntent({ ...input, rail })
        const transaction = await createProcessorTransaction(processor, input, intent.intentId)
        return attachTransactionFields(intent, transaction)
      },

      async confirmEntryIntent ({ intent, confirmationId }) {
        let confirmation = null
        if (processor && typeof processor.confirmPayment === 'function' && intent && intent.wdkTransactionId) {
          confirmation = await processor.confirmPayment({ id: intent.wdkTransactionId }, {
            confirmationId,
            timeoutMs: 0,
            pollMs: 0
          })
        }
        return {
          ...core.confirmTetherWdkEntryIntent({
            intent,
            confirmationId: confirmationIdFor({ confirmationId, confirmation, intent })
          }),
          processorConfirmation: confirmation
        }
      },

      async reconcileEntryIntent ({ intent, confirmationId }) {
        if (!intent) {
          return pendingEntryPayment({
            intent,
            confirmationId,
            processorStatus: 'missing_intent',
            reason: 'Entry intent is required before payment reconciliation'
          })
        }
        if (processor && typeof processor.checkStatus === 'function' && intent.wdkTransactionId) {
          try {
            const status = await processor.checkStatus(intent.wdkTransactionId)
            if (!isProcessorPaid(status)) {
              return pendingEntryPayment({
                intent,
                confirmationId,
                processorStatus: status && status.status ? status.status : 'awaiting_payment',
                reason: 'WDK payment has not been confirmed yet'
              })
            }
            return {
              ...core.confirmTetherWdkEntryIntent({
                intent,
                confirmationId: confirmationIdFor({ confirmationId, status, intent })
              }),
              processorConfirmation: status
            }
          } catch (error) {
            return pendingEntryPayment({
              intent,
              confirmationId,
              processorStatus: 'check_failed',
              reason: error.message
            })
          }
        }
        try {
          return await this.confirmEntryIntent({ intent, confirmationId })
        } catch (error) {
          return pendingEntryPayment({
            intent,
            confirmationId,
            processorStatus: 'confirmation_failed',
            reason: error.message
          })
        }
      },

      async createPoolPayout (input) {
        const payout = core.createTetherWdkPoolPayout({ ...input, rail })
        if (processor && typeof processor.preparePoolPayout === 'function') {
          const processorPayout = await processor.preparePoolPayout({ ...input, payout })
          return { ...payout, processorPayout }
        }
        return payout
      },

      disputeGameEscrow ({ gameId, roundId, escrowId, reason }) {
        return {
          disputeId: core.deterministicHash({ gameId, roundId, escrowId, reason, rail }),
          gameId,
          roundId,
          escrowId,
          reason,
          status: 'held',
          rail
        }
      }
    }
  }

  const api = {
    createTetherWdkProcessorAdapter,
    normalizeAsset,
    paymentMethodForAsset
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupTetherWdkBridge = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
