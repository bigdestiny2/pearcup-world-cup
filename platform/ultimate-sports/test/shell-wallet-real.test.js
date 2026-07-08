'use strict'

const { test } = require('node:test')
const assert = require('node:assert')

// These modules attach to `globalThis` when required in Node.
require('../shell/core.js')
require('../shell/qvac-referee.js')
require('../shell/tether-wdk-bridge.js')
require('../shell/adapters.js')
const sdkRuntime = require('../shell/sdk-runtime.js')

function mockProcessor () {
  const transactions = []
  return {
    type: 'mock-wdk-processor',
    async getWalletDetails ({ asset, accountIndex } = {}) {
      return {
        asset: asset || 'usdt-evm',
        chain: 'ethereum',
        token: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
        address: `0xADDR_${accountIndex || 0}`,
        balance: '1000000',
        qrData: 'ethereum:0xADDR/transfer?address=0xADDR'
      }
    },
    async prepareWithdrawal ({ asset, amount, recipient, reference }) {
      const tx = {
        id: `withdrawal_${reference || Date.now()}`,
        status: 'quoted',
        asset: asset || 'usdt-evm',
        chain: 'ethereum',
        amount,
        recipient,
        hash: null,
        fee: null
      }
      transactions.push(tx)
      return tx
    },
    async listTransactions () {
      return transactions
    },
    async createTransaction () {
      return { id: 'deposit_1', status: 'awaiting_payment' }
    }
  }
}

test('sdk-runtime package processor exposes wallet methods', async () => {
  const processor = sdkRuntime.createTetherWdkPackageProcessor({
    seedPhrase: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    evmProvider: 'https://ethereum-rpc.publicnode.com',
    assets: ['usdt-evm'],
    skipInitialBalanceProbe: true
  })
  assert.equal(typeof processor.getWalletDetails, 'function')
  assert.equal(typeof processor.prepareWithdrawal, 'function')
  assert.equal(typeof processor.listTransactions, 'function')

  const details = await processor.getWalletDetails({ asset: 'usdt-evm', accountIndex: 0 })
  assert.equal(details.chain, 'ethereum')
  assert.equal(details.asset, 'usdt-evm')
  assert.ok(details.address.startsWith('0x'))
  assert.ok(typeof details.balance === 'string')
  assert.ok(details.qrData.includes(details.address))
})

test('tether-wdk-bridge processor adapter passes through wallet methods', async () => {
  const bridge = globalThis.PearCupTetherWdkBridge
  const adapter = bridge.createTetherWdkProcessorAdapter({ processor: mockProcessor(), rail: 'mock' })
  assert.equal(typeof adapter.getWalletDetails, 'function')
  assert.equal(typeof adapter.prepareWithdrawal, 'function')
  assert.equal(typeof adapter.listWalletTransactions, 'function')

  const details = await adapter.getWalletDetails({ asset: 'usdt-evm' })
  assert.equal(details.address, '0xADDR_0')

  const withdrawal = await adapter.prepareWithdrawal({ asset: 'usdt-evm', amount: 5, recipient: '0xRECIPIENT' })
  assert.equal(withdrawal.status, 'quoted')
  assert.equal(withdrawal.recipient, '0xRECIPIENT')

  const txs = await adapter.listWalletTransactions()
  assert.equal(txs.length, 1)
})

test('adapters normalizes sdk tether wallet methods', async () => {
  const adapters = globalThis.PearCupAdapters
  const sdk = {
    ...mockProcessor(),
    async createGameEscrow () { return { escrowId: 'e1' } },
    async releaseGameEscrow () { return { released: true } },
    async createEntryIntent () { return { intentId: 'i1' } },
    async confirmEntryIntent () { return { confirmed: true } },
    async createPoolPayout () { return { poolId: 'p1' } }
  }
  const adapter = adapters.createSdkTetherWdkAdapter(sdk)
  const details = await adapter.getWalletDetails({ asset: 'usdt-evm' })
  assert.equal(details.address, '0xADDR_0')
  const withdrawal = await adapter.prepareWithdrawal({ amount: 5, recipient: '0xR' })
  assert.equal(withdrawal.recipient, '0xR')
  const txs = await adapter.listWalletTransactions()
  assert.equal(txs.length, 1)
})
