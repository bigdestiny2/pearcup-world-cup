(function attachPearCupSdkRuntime (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const core = root.PearCupCore || (canRequireLocal ? require('./core.js') : null)
  const qvacRefereeFactory = root.PearCupQvacReferee || (canRequireLocal ? require('./qvac-referee.js') : null)
  const tetherWdkBridgeFactory = root.PearCupTetherWdkBridge || (canRequireLocal ? require('./tether-wdk-bridge.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupSdkRuntime')

  function defaultImportModule (specifier) {
    return import(specifier)
  }

  function pickExport (moduleValue, exportName) {
    if (!moduleValue) return null
    if (moduleValue[exportName]) return moduleValue[exportName]
    if (moduleValue.default && moduleValue.default[exportName]) return moduleValue.default[exportName]
    if (exportName === 'default' && moduleValue.default) return moduleValue.default
    return moduleValue.default || moduleValue
  }

  async function collectTokenStream (tokenStream) {
    let text = ''
    for await (const token of tokenStream) text += token
    return text
  }

  function createQvacSdkCompletionClient ({
    sdk,
    importModule = defaultImportModule,
    modelSrc,
    modelExport,
    preloadedModelId,
    loadModelOptions = {},
    completionOptions = {},
    autoUnload = false
  } = {}) {
    let sdkModule = sdk || null
    let loadedModelId = preloadedModelId || null
    let ownsLoadedModel = false

    async function loadSdk () {
      if (!sdkModule) sdkModule = await importModule('@qvac/sdk')
      return sdkModule
    }

    async function ensureModel () {
      const qvac = await loadSdk()
      if (loadedModelId) return loadedModelId
      if (typeof qvac.loadModel !== 'function') throw new Error('QVAC SDK loadModel is required')
      if (typeof qvac.completion !== 'function') throw new Error('QVAC SDK completion is required')
      const selectedModelSrc = modelSrc || (modelExport && qvac[modelExport]) || qvac.LLAMA_3_2_1B_INST_Q4_0
      if (!selectedModelSrc) throw new Error('QVAC modelSrc is required')
      loadedModelId = await qvac.loadModel({ modelSrc: selectedModelSrc, ...loadModelOptions })
      ownsLoadedModel = true
      return loadedModelId
    }

    async function unloadOwnedModel () {
      if (!loadedModelId || !ownsLoadedModel) return
      const qvac = await loadSdk()
      if (typeof qvac.unloadModel === 'function') await qvac.unloadModel({ modelId: loadedModelId, autoClose: true })
      loadedModelId = preloadedModelId || null
      ownsLoadedModel = false
    }

    async function completeJson ({ history }) {
      try {
        const qvac = await loadSdk()
        const activeModelId = await ensureModel()
        const result = await qvac.completion({
          modelId: activeModelId,
          history,
          stream: true,
          ...completionOptions
        })
        if (result && result.tokenStream) return collectTokenStream(result.tokenStream)
        if (typeof result === 'string') return result
        if (result && typeof result.text === 'string') return result.text
        return result
      } finally {
        if (autoUnload === true) await unloadOwnedModel()
      }
    }

    async function close () {
      await unloadOwnedModel()
    }

    return {
      type: 'qvac-sdk-completion-client',
      completeJson,
      close,
      async status () {
        return {
          sdkLoaded: Boolean(sdkModule),
          modelLoaded: Boolean(loadedModelId),
          ownsLoadedModel,
          autoUnload
        }
      }
    }
  }

  function createQvacSdkRefereeAdapter (opts = {}) {
    if (!qvacRefereeFactory || typeof qvacRefereeFactory.createQvacCompletionRefereeAdapter !== 'function') {
      throw new Error('PearCupQvacReferee is required for QVAC SDK adapter creation')
    }
    const client = createQvacSdkCompletionClient(opts)
    const adapter = qvacRefereeFactory.createQvacCompletionRefereeAdapter({
      client,
      modelId: opts.modelId || 'qvac-sdk-local-referee',
      refereeId: opts.refereeId || 'qvac-sdk-referee'
    })
    return {
      ...adapter,
      async close () {
        if (typeof client.close === 'function') await client.close()
      }
    }
  }

  function createQvacSdkCommentaryAdapter (opts = {}) {
    if (!qvacRefereeFactory || typeof qvacRefereeFactory.createQvacCompletionCommentaryAdapter !== 'function') {
      throw new Error('PearCupQvacReferee is required for QVAC commentary adapter creation')
    }
    const client = createQvacSdkCompletionClient(opts)
    const adapter = qvacRefereeFactory.createQvacCompletionCommentaryAdapter({
      client,
      modelId: opts.modelId || 'qvac-sdk-local-commentary',
      commentatorId: opts.commentatorId || 'qvac-sdk-commentary'
    })
    return {
      ...adapter,
      async close () {
        if (typeof client.close === 'function') await client.close()
      }
    }
  }

  function toBaseUnits (amount, decimals) {
    const [whole, frac = ''] = String(amount).split('.')
    const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals)
    return BigInt(whole || '0') * (10n ** BigInt(decimals)) + BigInt(fracPadded || '0')
  }

  function createTetherWdkPackageProcessor ({
    seedPhrase,
    importModule = defaultImportModule,
    wdkModules,
    assets = ['usdt-evm'],
    usdtEvmAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    usdtDecimals = 6,
    evmProvider,
    evmChainId = 1,
    btcNetwork = 'bitcoin',
    btcClient = { type: 'electrum', clientConfig: { host: 'electrum.blockstream.info', port: 50002, ssl: true } },
    skipInitialBalanceProbe = false,
    payoutAccountIndex = 0,
    defaultPayoutAddress,
    payoutRecipients = {},
    broadcastPayouts = false,
    quotePayouts = true
  } = {}) {
    let modules = wdkModules || null
    let wdk = null
    let nextIndex = 0
    const transactions = new Map()

    async function loadModules () {
      if (modules) return modules
      const [coreModule, evmModule, btcModule] = await Promise.all([
        importModule('@tetherto/wdk'),
        importModule('@tetherto/wdk-wallet-evm'),
        importModule('@tetherto/wdk-wallet-btc')
      ])
      modules = {
        WDK: pickExport(coreModule, 'default'),
        WalletManagerEvm: pickExport(evmModule, 'default'),
        WalletManagerBtc: pickExport(btcModule, 'default')
      }
      return modules
    }

    async function initialize () {
      if (wdk) return wdk
      if (!seedPhrase) throw new Error('seedPhrase is required for package-backed Tether WDK')
      const loaded = await loadModules()
      const WDK = loaded.WDK
      if (!WDK) throw new Error('@tetherto/wdk default export is required')
      if (typeof WDK.isValidSeed === 'function' && !WDK.isValidSeed(seedPhrase)) throw new Error('Invalid WDK seed phrase')

      let instance = new WDK(seedPhrase)
      if (assets.includes('usdt-evm')) {
        if (!loaded.WalletManagerEvm) throw new Error('@tetherto/wdk-wallet-evm is required for USDT EVM')
        instance = instance.registerWallet('ethereum', loaded.WalletManagerEvm, { provider: evmProvider, chainId: evmChainId })
      }
      if (assets.includes('btc')) {
        if (!loaded.WalletManagerBtc) throw new Error('@tetherto/wdk-wallet-btc is required for BTC')
        instance = instance.registerWallet('bitcoin', loaded.WalletManagerBtc, { client: btcClient, network: btcNetwork })
      }
      wdk = instance
      return wdk
    }

    async function accountFor (chain, index) {
      const activeWdk = await initialize()
      if (typeof activeWdk.getAccount !== 'function') throw new Error('WDK getAccount is required')
      return activeWdk.getAccount(chain, index)
    }

    function assetDetails (params = {}) {
      const asset = tetherWdkBridgeFactory && typeof tetherWdkBridgeFactory.normalizeAsset === 'function'
        ? tetherWdkBridgeFactory.normalizeAsset(params.asset)
        : String(params.asset || 'USDT').toLowerCase() === 'btc' ? 'btc' : 'usdt-evm'
      const isBtc = asset === 'btc'
      return {
        asset,
        chain: isBtc ? 'bitcoin' : 'ethereum',
        token: isBtc ? null : usdtEvmAddress,
        decimals: isBtc ? 8 : usdtDecimals,
        cryptoAmount: params.cryptoAmount != null ? params.cryptoAmount : isBtc ? null : Number(params.amountCents || 0) / 100
      }
    }

    async function readBalance (account, token) {
      if (token && typeof account.getTokenBalance === 'function') return BigInt(await account.getTokenBalance(token))
      if (typeof account.getBalance === 'function') return BigInt(await account.getBalance())
      return 0n
    }

    async function createTransaction (params = {}) {
      const details = assetDetails(params)
      if (details.cryptoAmount == null) throw new Error('cryptoAmount is required for BTC WDK transactions')
      const index = nextIndex++
      const account = await accountFor(details.chain, index)
      const address = typeof account.getAddress === 'function' ? await account.getAddress() : account.address
      if (!address) throw new Error('WDK account address is required')
      const baseline = skipInitialBalanceProbe ? 0n : await readBalance(account, details.token)
      const expected = toBaseUnits(details.cryptoAmount, details.decimals)
      const id = `wdk_${params.reference || index}_${index}`
      const qrData = details.asset === 'btc'
        ? `bitcoin:${address}?amount=${details.cryptoAmount}`
        : `ethereum:${details.token}/transfer?address=${address}&uint256=${expected.toString()}`
      const transaction = {
        id,
        processorId: id,
        status: 'awaiting_payment',
        asset: details.asset,
        chain: details.chain,
        index,
        address,
        token: details.token,
        decimals: details.decimals,
        amount: details.cryptoAmount,
        expected,
        baseline,
        qrData,
        createdAt: new Date().toISOString()
      }
      transactions.set(id, transaction)
      return transaction
    }

    async function collectPaymentMethod (transaction) {
      return transaction
    }

    async function checkStatus (transactionId) {
      const transaction = transactions.get(transactionId)
      if (!transaction) throw new Error(`Unknown WDK transaction: ${transactionId}`)
      const account = await accountFor(transaction.chain, transaction.index)
      const current = await readBalance(account, transaction.token)
      const received = current - transaction.baseline
      const paid = received >= transaction.expected
      if (paid) transaction.status = 'captured'
      return {
        id: transactionId,
        status: transaction.status,
        paid,
        received: received.toString(),
        expected: transaction.expected.toString()
      }
    }

    async function confirmPayment (transaction, opts = {}) {
      const transactionId = typeof transaction === 'string' ? transaction : transaction.id
      const timeoutMs = opts.timeoutMs == null ? 10 * 60 * 1000 : opts.timeoutMs
      const pollMs = opts.pollMs == null ? 8000 : opts.pollMs
      const deadline = Date.now() + timeoutMs
      do {
        const status = await checkStatus(transactionId)
        if (status.paid) return { status: 'captured', received: status.received, expected: status.expected }
        if (timeoutMs === 0 || Date.now() >= deadline) break
        await new Promise(resolve => setTimeout(resolve, pollMs))
      } while (true)
      throw new Error('WDK payment not received before timeout')
    }

    function normalizePayoutRecipients (inputRecipients = {}) {
      return {
        ...(payoutRecipients || {}),
        ...(inputRecipients || {})
      }
    }

    function payoutAddressFor ({ userId, inputRecipients, payoutAddress }) {
      const recipients = normalizePayoutRecipients(inputRecipients)
      return payoutAddress || recipients[userId] || defaultPayoutAddress || null
    }

    function normalizeTransferResult (result = {}, fallbackStatus) {
      return {
        status: fallbackStatus,
        hash: result.hash || null,
        fee: result.fee != null ? result.fee.toString() : null
      }
    }

    async function preparePayoutTransfer ({ userId, amount, asset, recipient, reference }) {
      const details = assetDetails({ asset, cryptoAmount: amount })
      const account = await accountFor(details.chain, payoutAccountIndex)
      const baseAmount = toBaseUnits(amount, details.decimals)
      const transfer = {
        userId,
        reference,
        asset: details.asset,
        chain: details.chain,
        sourceAccountIndex: payoutAccountIndex,
        recipient,
        amount,
        baseAmount: baseAmount.toString(),
        token: details.token,
        broadcast: broadcastPayouts === true
      }

      if (details.asset === 'btc') {
        const tx = { to: recipient, value: baseAmount }
        if (broadcastPayouts === true) {
          if (typeof account.sendTransaction !== 'function') throw new Error('WDK BTC sendTransaction is required for broadcast payouts')
          return { ...transfer, ...normalizeTransferResult(await account.sendTransaction(tx), 'broadcast') }
        }
        if (quotePayouts !== false && typeof account.quoteSendTransaction === 'function') {
          return { ...transfer, ...normalizeTransferResult(await account.quoteSendTransaction(tx), 'quoted') }
        }
        return { ...transfer, status: 'planned', hash: null, fee: null }
      }

      const options = { token: details.token, recipient, amount: baseAmount }
      if (broadcastPayouts === true) {
        if (typeof account.transfer !== 'function') throw new Error('WDK transfer is required for broadcast payouts')
        return { ...transfer, ...normalizeTransferResult(await account.transfer(options), 'broadcast') }
      }
      if (quotePayouts !== false && typeof account.quoteTransfer === 'function') {
        return { ...transfer, ...normalizeTransferResult(await account.quoteTransfer(options), 'quoted') }
      }
      return { ...transfer, status: 'planned', hash: null, fee: null }
    }

    async function preparePoolPayout ({
      poolId,
      winnerUserIds = [],
      payout,
      asset,
      payoutRecipients: inputRecipients,
      payoutAddress
    } = {}) {
      const winners = Array.isArray(winnerUserIds) ? winnerUserIds : []
      const amountEach = payout && payout.amountEach != null ? payout.amountEach : 0
      const missingRecipientUserIds = winners.filter(userId => !payoutAddressFor({
        userId,
        inputRecipients,
        payoutAddress
      }))
      if (missingRecipientUserIds.length > 0) {
        return {
          id: `wdk_pool_${poolId || 'unknown'}`,
          status: 'recipient-required',
          poolId,
          missingRecipientUserIds,
          broadcast: broadcastPayouts === true,
          transfers: []
        }
      }

      const transfers = []
      for (const userId of winners) {
        transfers.push(await preparePayoutTransfer({
          userId,
          amount: amountEach,
          asset: asset || payout && payout.asset,
          recipient: payoutAddressFor({ userId, inputRecipients, payoutAddress }),
          reference: `${poolId || 'pool'}:${userId}`
        }))
      }
      return {
        id: `wdk_pool_${poolId || 'unknown'}`,
        status: broadcastPayouts === true ? 'broadcast' : transfers.some(item => item.status === 'quoted') ? 'quoted' : 'planned',
        poolId,
        broadcast: broadcastPayouts === true,
        transfers
      }
    }

    async function releaseEscrow ({ escrow, winnerUserId, payoutAddress, payoutRecipients: inputRecipients, payout }) {
      const recipient = payoutAddressFor({
        userId: winnerUserId,
        inputRecipients,
        payoutAddress
      })
      if (!recipient) {
        return {
          id: `wdk_release_${escrow && escrow.escrowId || 'unknown'}`,
          status: 'recipient-required',
          escrowId: escrow && escrow.escrowId,
          winnerUserId,
          broadcast: broadcastPayouts === true,
          transfers: []
        }
      }
      const transfer = await preparePayoutTransfer({
        userId: winnerUserId,
        amount: payout && payout.amount != null ? payout.amount : escrow && escrow.amount,
        asset: payout && payout.asset || escrow && escrow.asset,
        recipient,
        reference: escrow && escrow.escrowId || `game:${winnerUserId}`
      })
      return {
        id: `wdk_release_${escrow && escrow.escrowId || 'unknown'}`,
        status: transfer.status,
        escrowId: escrow && escrow.escrowId,
        winnerUserId,
        broadcast: broadcastPayouts === true,
        transfers: [transfer]
      }
    }

    async function teardown () {
      if (wdk && typeof wdk.dispose === 'function') wdk.dispose()
      wdk = null
      transactions.clear()
    }

    async function getWalletDetails ({ asset, accountIndex = 0 } = {}) {
      const details = assetDetails({ asset })
      const account = await accountFor(details.chain, accountIndex)
      const address = typeof account.getAddress === 'function' ? await account.getAddress() : account.address
      if (!address) throw new Error('WDK account address is required')
      const balance = await readBalance(account, details.token)
      const qrData = details.asset === 'btc'
        ? `bitcoin:${address}`
        : `ethereum:${details.token}/transfer?address=${address}`
      return {
        asset: details.asset,
        chain: details.chain,
        token: details.token,
        decimals: details.decimals,
        address,
        balance: balance.toString(),
        qrData
      }
    }

    async function prepareWithdrawal ({ asset, amount, recipient, reference, accountIndex = 0 } = {}) {
      if (!recipient) throw new Error('recipient is required for withdrawal')
      if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) throw new Error('amount is required for withdrawal')
      return preparePayoutTransfer({
        userId: reference || 'wallet-user',
        amount: Number(amount),
        asset,
        recipient,
        reference: reference || 'wallet-withdrawal'
      })
    }

    function listTransactions () {
      return Array.from(transactions.values()).map(tx => ({
        id: tx.id,
        status: tx.status,
        asset: tx.asset,
        chain: tx.chain,
        address: tx.address,
        token: tx.token,
        amount: tx.amount,
        expected: tx.expected ? tx.expected.toString() : null,
        baseline: tx.baseline ? tx.baseline.toString() : null,
        qrData: tx.qrData || null,
        createdAt: tx.createdAt || null
      }))
    }

    return {
      type: 'tether-wdk-package-processor',
      createTransaction,
      collectPaymentMethod,
      confirmPayment,
      checkStatus,
      preparePoolPayout,
      releaseEscrow,
      getWalletDetails,
      prepareWithdrawal,
      listTransactions,
      teardown,
      async status () {
        return {
          sdkLoaded: Boolean(modules),
          initialized: Boolean(wdk),
          transactions: transactions.size,
          skipInitialBalanceProbe,
          payoutAccountIndex,
          broadcastPayouts: broadcastPayouts === true
        }
      }
    }
  }

  function createTetherWdkPackageAdapter (opts = {}) {
    if (!tetherWdkBridgeFactory || typeof tetherWdkBridgeFactory.createTetherWdkProcessorAdapter !== 'function') {
      throw new Error('PearCupTetherWdkBridge is required for Tether WDK package adapter creation')
    }
    const processor = createTetherWdkPackageProcessor(opts)
    const adapter = tetherWdkBridgeFactory.createTetherWdkProcessorAdapter({
      processor,
      rail: opts.rail || 'tether-wdk-package'
    })
    return {
      ...adapter,
      async getWalletDetails (opts = {}) {
        if (typeof processor.getWalletDetails !== 'function') throw new Error('WDK processor does not support wallet details')
        const details = await processor.getWalletDetails(opts)
        return { ...details, kind: 'wallet-details' }
      },
      async prepareWithdrawal (opts = {}) {
        if (typeof processor.prepareWithdrawal !== 'function') throw new Error('WDK processor does not support withdrawals')
        const transfer = await processor.prepareWithdrawal(opts)
        return { ...transfer, kind: 'withdrawal' }
      },
      async listWalletTransactions (opts = {}) {
        if (typeof processor.listTransactions !== 'function') throw new Error('WDK processor does not support transaction listing')
        const txs = await processor.listTransactions(opts)
        return txs.map(tx => ({ ...tx, kind: tx.kind || 'deposit' }))
      },
      async close () {
        if (typeof processor.teardown === 'function') await processor.teardown()
      }
    }
  }

  const api = {
    createQvacSdkCompletionClient,
    createQvacSdkRefereeAdapter,
    createQvacSdkCommentaryAdapter,
    createTetherWdkPackageProcessor,
    createTetherWdkPackageAdapter,
    toBaseUnits
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupSdkRuntime = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
