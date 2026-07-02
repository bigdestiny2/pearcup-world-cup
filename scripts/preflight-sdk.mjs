#!/usr/bin/env node
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sdkRuntime = require('../app/sdk-runtime.js')
const runtimeSettings = require('../app/runtime-settings.js')

let failures = 0

function pass (label, detail) {
  console.log(`ok - ${label}${detail ? `: ${detail}` : ''}`)
}

function fail (label, err) {
  failures += 1
  const message = err && err.message ? err.message : String(err)
  console.error(`not ok - ${label}: ${message}`)
}

async function importPackage (specifier) {
  try {
    const moduleValue = await import(specifier)
    pass(`import ${specifier}`)
    return moduleValue
  } catch (err) {
    fail(`import ${specifier}`, err)
    return null
  }
}

function expectFunction (moduleValue, name, label) {
  if (moduleValue && typeof moduleValue[name] === 'function') {
    pass(`${label}.${name}`)
    return true
  }
  fail(`${label}.${name}`, 'missing function export')
  return false
}

function expectConstructor (value, label) {
  if (typeof value === 'function') {
    pass(label)
    return true
  }
  fail(label, 'missing constructor export')
  return false
}

function pickDefault (moduleValue) {
  return moduleValue && (moduleValue.default || moduleValue.WDK || moduleValue)
}

async function runWdkReceiveIntentCheck ({ WDK, WalletManagerEvm, WalletManagerBtc, settings }) {
  const wdkSettings = (settings.sdkPackages && settings.sdkPackages.tetherWdk) || {}
  const seedPhrase = process.env.PEARCUP_WDK_SEED || wdkSettings.seedPhrase
  if (!seedPhrase) {
    pass('wdk receive intent check skipped', 'set PEARCUP_WDK_SEED or config sdkPackages.tetherWdk.seedPhrase')
    return
  }
  if (typeof WDK.isValidSeed === 'function' && !WDK.isValidSeed(seedPhrase)) {
    fail('wdk seed validation', 'PEARCUP_WDK_SEED is not a valid WDK seed phrase')
    return
  }

  const assets = (process.env.PEARCUP_WDK_ASSETS
    ? process.env.PEARCUP_WDK_ASSETS.split(',').map(asset => asset.trim()).filter(Boolean)
    : wdkSettings.assets) || ['usdt-evm']
  const asset = assets.includes('btc') && !assets.includes('usdt-evm') ? 'btc' : 'usdt-evm'
  const amountCents = Number(process.env.PEARCUP_PREFLIGHT_AMOUNT_CENTS || 100)
  const processor = sdkRuntime.createTetherWdkPackageProcessor({
    seedPhrase,
    wdkModules: { WDK, WalletManagerEvm, WalletManagerBtc },
    assets,
    evmProvider: process.env.PEARCUP_EVM_PROVIDER || wdkSettings.evmProvider,
    evmChainId: wdkSettings.evmChainId,
    btcNetwork: process.env.PEARCUP_BTC_NETWORK || wdkSettings.btcNetwork || 'bitcoin',
    btcClient: wdkSettings.btcClient,
    skipInitialBalanceProbe: true
  })

  try {
    const transaction = await processor.createTransaction({
      amountCents,
      asset,
      reference: 'sdk-preflight'
    })
    pass('wdk receive intent', `${transaction.chain}:${transaction.address}`)
    pass('wdk payment uri', transaction.qrData)
  } catch (err) {
    fail('wdk receive intent', err)
  } finally {
    await processor.teardown()
  }
}

async function runQvacModelCheck (qvac, settings) {
  const qvacSettings = (settings.sdkPackages && settings.sdkPackages.qvac) || {}
  if (process.env.PEARCUP_QVAC_LOAD_MODEL !== '1' && qvacSettings.preflightLoadModel !== true) {
    pass('qvac model load skipped', 'set PEARCUP_QVAC_LOAD_MODEL=1 for a local model probe')
    return
  }
  const modelExportName = process.env.PEARCUP_QVAC_MODEL_EXPORT || qvacSettings.modelExport || 'LLAMA_3_2_1B_INST_Q4_0'
  const preloadedModelId = process.env.PEARCUP_QVAC_PRELOADED_MODEL_ID || qvacSettings.preloadedModelId
  const modelSrc = process.env.PEARCUP_QVAC_MODEL_SRC || qvacSettings.modelSrc || qvac[modelExportName]
  const client = sdkRuntime.createQvacSdkCompletionClient({
    sdk: qvac,
    modelSrc,
    preloadedModelId,
    loadModelOptions: qvacSettings.loadModelOptions || {},
    completionOptions: qvacSettings.completionOptions || {},
    autoUnload: true
  })
  try {
    const statusBefore = await client.status()
    if (statusBefore.modelLoaded && !preloadedModelId) fail('qvac model initial state', 'model loaded before preflight request')
    const text = await client.completeJson({
      history: [
        { role: 'system', content: 'Return compact JSON only.' },
        { role: 'user', content: 'Return {"ruling":"verified","confidence":0.5,"rationale":"preflight"}' }
      ]
    })
    pass('qvac completion', String(text).slice(0, 120))
    const statusAfter = await client.status()
    if (preloadedModelId) {
      if (statusAfter.modelLoaded && statusAfter.ownsLoadedModel !== true) pass('qvac preloaded model retained', preloadedModelId)
      else fail('qvac preloaded model retained', 'externally preloaded model was not retained correctly')
    } else if (statusAfter.modelLoaded) fail('qvac auto unload', 'model remained loaded after preflight completion')
    else pass('qvac auto unload')
  } catch (err) {
    fail('qvac completion', err)
  } finally {
    await client.close()
  }
}

async function main () {
  console.log('PearCup SDK preflight')
  const settings = runtimeSettings.loadRuntimeSettings()
  if (settings.source.loaded) pass('runtime settings loaded', settings.source.path)
  else pass('runtime settings file skipped', settings.source.path)
  const redactedSettings = runtimeSettings.redactRuntimeSettings(settings)
  if (Object.keys(redactedSettings.sdkPackages || {}).length > 0) {
    pass('runtime sdk config', JSON.stringify(redactedSettings.sdkPackages))
  }
  const qvac = await importPackage('@qvac/sdk')
  const wdkCore = await importPackage('@tetherto/wdk')
  const evm = await importPackage('@tetherto/wdk-wallet-evm')
  const btc = await importPackage('@tetherto/wdk-wallet-btc')

  if (qvac) {
    expectFunction(qvac, 'loadModel', '@qvac/sdk')
    expectFunction(qvac, 'completion', '@qvac/sdk')
    expectFunction(qvac, 'unloadModel', '@qvac/sdk')
    if (qvac.LLAMA_3_2_1B_INST_Q4_0) pass('@qvac/sdk.LLAMA_3_2_1B_INST_Q4_0')
    else fail('@qvac/sdk.LLAMA_3_2_1B_INST_Q4_0', 'missing default referee model source')
    await runQvacModelCheck(qvac, settings)
  }

  const WDK = pickDefault(wdkCore)
  const WalletManagerEvm = pickDefault(evm)
  const WalletManagerBtc = pickDefault(btc)
  const hasWdk = expectConstructor(WDK, '@tetherto/wdk default')
  const hasEvm = expectConstructor(WalletManagerEvm, '@tetherto/wdk-wallet-evm default')
  const hasBtc = expectConstructor(WalletManagerBtc, '@tetherto/wdk-wallet-btc default')
  if (hasWdk && hasEvm && hasBtc) await runWdkReceiveIntentCheck({ WDK, WalletManagerEvm, WalletManagerBtc, settings })

  if (failures > 0) {
    console.error(`PearCup SDK preflight failed with ${failures} issue${failures === 1 ? '' : 's'}.`)
    process.exitCode = 1
    return
  }
  console.log('PearCup SDK preflight passed.')
}

main().catch((err) => {
  fail('preflight fatal', err)
  process.exitCode = 1
})
