const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')
require('./qvac-referee.js')
require('./tether-wdk-bridge.js')
const sdkRuntime = require('./sdk-runtime.js')
const { createWorkerSim } = require('./worker-sim.js')
const { createDemoQvacAdapter } = require('./adapters.js')

const gameId = 'pc-sdk-runtime'
const shooter = { id: 'user-captain', username: 'captain' }
const keeper = { id: 'user-vera', username: 'vera' }
const roundResult = core.createPenaltyClashRound({
  gameId,
  roundIndex: 0,
  shooter,
  keeper,
  shooterInput: { role: 'shooter', aimZone: 'right-high', powerBand: 3, curveBand: 1, releaseTick: 42 },
  keeperInput: { role: 'keeper', diveZone: 'right-high', releaseTick: 43 }
})

test('QVAC SDK completion client loads a model and streams JSON', async () => {
  const calls = []
  const client = sdkRuntime.createQvacSdkCompletionClient({
    sdk: {
      LLAMA_3_2_1B_INST_Q4_0: 'llama-test-model',
      async loadModel (input) {
        calls.push(['loadModel', input.modelSrc])
        return 'model-runtime-1'
      },
      completion (input) {
        calls.push(['completion', input.modelId, input.stream])
        return { tokenStream: ['{"ruling":"verified",', '"confidence":0.93,', '"rationale":"ok"}'] }
      },
      async unloadModel (input) {
        calls.push(['unloadModel', input.modelId])
      }
    }
  })

  const text = await client.completeJson({ history: [{ role: 'user', content: 'verify' }] })
  await client.close()

  assert.match(text, /verified/)
  assert.deepEqual(calls, [
    ['loadModel', 'llama-test-model'],
    ['completion', 'model-runtime-1', true],
    ['unloadModel', 'model-runtime-1']
  ])
})

test('QVAC SDK completion client resolves configured model exports', async () => {
  const calls = []
  const client = sdkRuntime.createQvacSdkCompletionClient({
    sdk: {
      CUSTOM_REFEREE_MODEL: 'custom-qvac-model',
      async loadModel (input) {
        calls.push(['loadModel', input.modelSrc])
        return 'model-runtime-export'
      },
      completion () {
        return '{"ruling":"verified","confidence":0.9,"rationale":"custom export"}'
      }
    },
    modelExport: 'CUSTOM_REFEREE_MODEL'
  })

  const text = await client.completeJson({ history: [{ role: 'user', content: 'verify' }] })

  assert.match(text, /custom export/)
  assert.deepEqual(calls, [['loadModel', 'custom-qvac-model']])
})

test('QVAC SDK completion client auto-unloads owned models after each referee call', async () => {
  const calls = []
  const client = sdkRuntime.createQvacSdkCompletionClient({
    sdk: {
      LLAMA_3_2_1B_INST_Q4_0: 'llama-test-model',
      async loadModel (input) {
        calls.push(['loadModel', input.modelSrc])
        return `model-runtime-${calls.filter(item => item[0] === 'loadModel').length}`
      },
      completion (input) {
        calls.push(['completion', input.modelId])
        return '{"ruling":"verified","confidence":0.9,"rationale":"auto unload"}'
      },
      async unloadModel (input) {
        calls.push(['unloadModel', input.modelId])
      }
    },
    autoUnload: true
  })

  const first = await client.completeJson({ history: [{ role: 'user', content: 'verify first' }] })
  const firstStatus = await client.status()
  const second = await client.completeJson({ history: [{ role: 'user', content: 'verify second' }] })
  const secondStatus = await client.status()

  assert.match(first, /auto unload/)
  assert.match(second, /auto unload/)
  assert.equal(firstStatus.modelLoaded, false)
  assert.equal(firstStatus.ownsLoadedModel, false)
  assert.equal(secondStatus.modelLoaded, false)
  assert.equal(secondStatus.ownsLoadedModel, false)
  assert.deepEqual(calls, [
    ['loadModel', 'llama-test-model'],
    ['completion', 'model-runtime-1'],
    ['unloadModel', 'model-runtime-1'],
    ['loadModel', 'llama-test-model'],
    ['completion', 'model-runtime-2'],
    ['unloadModel', 'model-runtime-2']
  ])
})

test('QVAC SDK completion client waits for stream teardown before auto-unload', async () => {
  let rpcSettled = false
  const client = sdkRuntime.createQvacSdkCompletionClient({
    sdk: {
      LLAMA_3_2_1B_INST_Q4_0: 'llama-test-model',
      async loadModel () { return 'model-runtime-stream' },
      completion () {
        return {
          tokenStream: (async function * () {
            yield '{"ruling":"verified"}'
            setTimeout(() => { rpcSettled = true }, 0)
          })(),
          final: Promise.resolve({ contentText: '{"ruling":"verified"}' })
        }
      },
      async unloadModel () {
        assert.equal(rpcSettled, true)
      }
    },
    autoUnload: true
  })

  assert.match(await client.completeJson({ history: [] }), /verified/)
})

test('QVAC SDK completion client does not auto-unload externally preloaded models', async () => {
  const calls = []
  const client = sdkRuntime.createQvacSdkCompletionClient({
    sdk: {
      async loadModel () {
        calls.push(['loadModel'])
        throw new Error('preloaded model should not be loaded again')
      },
      completion (input) {
        calls.push(['completion', input.modelId])
        return '{"ruling":"verified","confidence":0.9,"rationale":"preloaded"}'
      },
      async unloadModel (input) {
        calls.push(['unloadModel', input.modelId])
      }
    },
    preloadedModelId: 'qvac-preloaded-model',
    autoUnload: true
  })

  const text = await client.completeJson({ history: [{ role: 'user', content: 'verify' }] })
  const status = await client.status()
  await client.close()

  assert.match(text, /preloaded/)
  assert.equal(status.modelLoaded, true)
  assert.equal(status.ownsLoadedModel, false)
  assert.deepEqual(calls, [
    ['completion', 'qvac-preloaded-model']
  ])
})

test('QVAC SDK referee adapter produces trusted attestation from package client', async () => {
  const adapter = sdkRuntime.createQvacSdkRefereeAdapter({
    sdk: {
      LLAMA_3_2_1B_INST_Q4_0: 'llama-test-model',
      async loadModel () {
        return 'model-runtime-2'
      },
      completion () {
        return { tokenStream: ['{"ruling":"verified","confidence":0.94,"rationale":"Package-backed QVAC verified."}'] }
      }
    },
    modelId: 'qvac-sdk-test-referee'
  })

  const attestation = await adapter.attestRound({ roundResult })

  assert.equal(attestation.ruling, 'save')
  assert.equal(attestation.review.modelId, 'qvac-sdk-test-referee')
  assert.match(attestation.rationale, /Package-backed QVAC/)
})

test('QVAC SDK commentary adapter produces grounded match commentary', async () => {
  const adapter = sdkRuntime.createQvacSdkCommentaryAdapter({
    sdk: {
      LLAMA_3_2_1B_INST_Q4_0: 'llama-commentary-model',
      async loadModel () {
        return 'model-runtime-commentary'
      },
      completion () {
        return { tokenStream: ['{"text":"Brazil pressure is rising from the synced shot event.","confidence":0.82}'] }
      }
    },
    modelId: 'qvac-sdk-test-commentary',
    commentatorId: 'qvac-sdk-commentator'
  })

  const segment = await adapter.generateSegment({
    matchId: 'match-sdk-commentary',
    language: 'EN',
    clock: '64:10',
    recentEvents: [{
      eventId: 'evt-sdk-shot',
      matchId: 'match-sdk-commentary',
      clock: '64:10',
      type: 'shot',
      teamId: 'br'
    }],
    currentStats: { matchId: 'match-sdk-commentary', clock: '64:10', score: { br: 2, no: 1 } }
  })

  assert.equal(segment.matchId, 'match-sdk-commentary')
  assert.equal(segment.commentatorId, 'qvac-sdk-commentator')
  assert.equal(segment.modelId, 'qvac-sdk-test-commentary')
  assert.equal(segment.confidence, 0.82)
  assert.deepEqual(segment.sourceEventIds, ['evt-sdk-shot'])
  assert.match(segment.text, /synced shot/)
})

test('Tether WDK package processor derives receive transaction and confirms payment', async () => {
  const balances = [0n, 25000000n]
  const account = {
    async getAddress () {
      return '0xwdkpackage'
    },
    async getTokenBalance () {
      const nextBalance = balances.shift()
      return nextBalance === undefined ? 25000000n : nextBalance
    }
  }
  class FakeWDK {
    constructor (seed) {
      this.seed = seed
    }

    static isValidSeed (seed) {
      return seed === 'valid seed phrase'
    }

    registerWallet () {
      return this
    }

    async getAccount () {
      return account
    }
  }

  const processor = sdkRuntime.createTetherWdkPackageProcessor({
    seedPhrase: 'valid seed phrase',
    wdkModules: {
      WDK: FakeWDK,
      WalletManagerEvm: class WalletManagerEvm {},
      WalletManagerBtc: class WalletManagerBtc {}
    },
    assets: ['usdt-evm']
  })

  const transaction = await processor.createTransaction({
    amountCents: 2500,
    asset: 'usdt-evm',
    reference: 'entry-25'
  })
  const confirmation = await processor.confirmPayment(transaction, { timeoutMs: 0 })

  assert.equal(transaction.address, '0xwdkpackage')
  assert.match(transaction.qrData, /ethereum:/)
  assert.equal(transaction.expected.toString(), '25000000')
  assert.equal(confirmation.status, 'captured')
})

test('Tether WDK package processor can prepare receive intent without initial balance probe', async () => {
  let balanceRead = false
  const account = {
    async getAddress () {
      return '0xofflinewdk'
    },
    async getTokenBalance () {
      balanceRead = true
      throw new Error('offline preflight should not read chain balance')
    }
  }
  class FakeWDK {
    static isValidSeed () {
      return true
    }

    registerWallet () {
      return this
    }

    async getAccount () {
      return account
    }
  }

  const processor = sdkRuntime.createTetherWdkPackageProcessor({
    seedPhrase: 'valid seed phrase',
    wdkModules: {
      WDK: FakeWDK,
      WalletManagerEvm: class WalletManagerEvm {},
      WalletManagerBtc: class WalletManagerBtc {}
    },
    assets: ['usdt-evm'],
    skipInitialBalanceProbe: true
  })

  const transaction = await processor.createTransaction({
    amountCents: 100,
    asset: 'usdt-evm',
    reference: 'offline-preflight'
  })
  const status = await processor.status()

  assert.equal(transaction.address, '0xofflinewdk')
  assert.equal(transaction.baseline, 0n)
  assert.equal(balanceRead, false)
  assert.equal(status.skipInitialBalanceProbe, true)
})

test('Tether WDK package processor quotes pool payout transfers without broadcasting', async () => {
  let transferCalled = false
  let quoteInput = null
  const accountRequests = []
  const account = {
    async quoteTransfer (input) {
      quoteInput = input
      return { hash: '0xquote', fee: 21000n }
    },
    async transfer () {
      transferCalled = true
      throw new Error('transfer should not broadcast during quote-only payout preparation')
    }
  }
  class FakeWDK {
    static isValidSeed () {
      return true
    }

    registerWallet () {
      return this
    }

    async getAccount (chain, index) {
      accountRequests.push([chain, index])
      return account
    }
  }

  const processor = sdkRuntime.createTetherWdkPackageProcessor({
    seedPhrase: 'valid seed phrase',
    wdkModules: {
      WDK: FakeWDK,
      WalletManagerEvm: class WalletManagerEvm {},
      WalletManagerBtc: class WalletManagerBtc {}
    },
    assets: ['usdt-evm'],
    payoutAccountIndex: 2,
    payoutRecipients: {
      'user-captain': '0xwinner'
    }
  })

  const payout = await processor.preparePoolPayout({
    poolId: 'pool-payout-sdk',
    winnerUserIds: ['user-captain'],
    payout: { amountEach: 12.5, asset: 'USDT' }
  })

  assert.equal(payout.status, 'quoted')
  assert.equal(payout.broadcast, false)
  assert.equal(payout.transfers.length, 1)
  assert.equal(payout.transfers[0].status, 'quoted')
  assert.equal(payout.transfers[0].recipient, '0xwinner')
  assert.equal(payout.transfers[0].baseAmount, '12500000')
  assert.equal(payout.transfers[0].fee, '21000')
  assert.equal(quoteInput.amount, 12500000n)
  assert.equal(quoteInput.recipient, '0xwinner')
  assert.equal(transferCalled, false)
  assert.deepEqual(accountRequests, [['ethereum', 2]])
})

test('Tether WDK package processor can broadcast payout transfers only when explicitly enabled', async () => {
  let transferInput = null
  const account = {
    async quoteTransfer () {
      throw new Error('quote should not run when broadcast payouts are enabled')
    },
    async transfer (input) {
      transferInput = input
      return { hash: '0xbroadcast', fee: 12n }
    }
  }
  class FakeWDK {
    static isValidSeed () {
      return true
    }

    registerWallet () {
      return this
    }

    async getAccount () {
      return account
    }
  }

  const processor = sdkRuntime.createTetherWdkPackageProcessor({
    seedPhrase: 'valid seed phrase',
    wdkModules: {
      WDK: FakeWDK,
      WalletManagerEvm: class WalletManagerEvm {},
      WalletManagerBtc: class WalletManagerBtc {}
    },
    assets: ['usdt-evm'],
    broadcastPayouts: true,
    payoutRecipients: {
      'user-captain': '0xwinner'
    }
  })

  const payout = await processor.preparePoolPayout({
    poolId: 'pool-broadcast-sdk',
    winnerUserIds: ['user-captain'],
    payout: { amountEach: 10, asset: 'USDT' }
  })

  assert.equal(payout.status, 'broadcast')
  assert.equal(payout.broadcast, true)
  assert.equal(payout.transfers[0].status, 'broadcast')
  assert.equal(payout.transfers[0].hash, '0xbroadcast')
  assert.equal(payout.transfers[0].fee, '12')
  assert.equal(transferInput.amount, 10000000n)
  assert.equal(transferInput.recipient, '0xwinner')
})

test('Tether WDK package processor requires a payout recipient before releasing escrow', async () => {
  const processor = sdkRuntime.createTetherWdkPackageProcessor({
    seedPhrase: 'valid seed phrase'
  })

  const release = await processor.releaseEscrow({
    escrow: { escrowId: 'escrow-no-recipient', amount: 5, asset: 'USDT' },
    winnerUserId: 'user-captain'
  })

  assert.equal(release.status, 'recipient-required')
  assert.equal(release.escrowId, 'escrow-no-recipient')
  assert.deepEqual(release.transfers, [])
})

test('Tether WDK package adapter works through async worker settlement commands', async () => {
  const account = {
    async getAddress () {
      return '0xworkerwdk'
    },
    async getTokenBalance () {
      return 0n
    }
  }
  class FakeWDK {
    static isValidSeed () {
      return true
    }

    registerWallet () {
      return this
    }

    async getAccount () {
      return account
    }
  }
  const tetherWdk = sdkRuntime.createTetherWdkPackageAdapter({
    seedPhrase: 'valid seed phrase',
    wdkModules: {
      WDK: FakeWDK,
      WalletManagerEvm: class WalletManagerEvm {},
      WalletManagerBtc: class WalletManagerBtc {}
    },
    assets: ['usdt-evm']
  })
  const worker = createWorkerSim({
    adapters: {
      qvac: createDemoQvacAdapter(),
      tetherWdk,
      mode: { qvac: 'demo', tetherWdk: 'sdk' }
    }
  })

  const escrow = await worker.dispatchAsync({
    type: 'wdk:createGameEscrow',
    actorId: 'tether-wdk-package',
    payload: { gameId, players: [shooter.id, keeper.id], amount: 5, asset: 'USDT' }
  })

  assert.equal(escrow.type, 'TetherWdkEscrowCreated')
  assert.equal(escrow.payload.receiveAddress, '0xworkerwdk')
  assert.equal(escrow.payload.rail, 'tether-wdk-package')
})
