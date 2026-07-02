const assert = require('node:assert/strict')
const test = require('node:test')
const runtimeSettings = require('./runtime-settings.js')
require('./core.js')
require('./adapters.js')
require('./qvac-referee.js')
require('./tether-wdk-bridge.js')
require('./sdk-runtime.js')
const runtimeConfig = require('./runtime-config.js')

test('runtime settings merge config file with env overrides and redact WDK seed', () => {
  const settings = runtimeSettings.loadRuntimeSettings({
    env: {
      PEARCUP_WDK_SEED: 'env seed phrase',
      PEARCUP_WDK_ASSETS: 'usdt-evm,btc',
      PEARCUP_WDK_PAYOUT_ACCOUNT_INDEX: '4',
      PEARCUP_WDK_DEFAULT_PAYOUT_ADDRESS: '0xdefaultwinner',
      PEARCUP_WDK_BROADCAST_PAYOUTS: 'true',
      PEARCUP_QVAC_PRELOADED_MODEL_ID: 'env-preloaded-referee-model',
      PEARCUP_QVAC_PREFLIGHT_LOAD_MODEL: 'true',
      PEARCUP_REAL_MONEY_ENABLED: 'true',
      PEARCUP_KYC_VERIFIED: 'false'
    },
    config: {
      sdkPackages: {
        qvac: {
          enabled: true,
          modelId: 'qvac-config-ref',
          modelExport: 'LLAMA_3_2_1B_INST_Q4_0',
          preloadedModelId: 'config-preloaded-referee-model'
        },
        tetherWdk: {
          enabled: true,
          seedPhrase: 'config seed phrase',
          assets: ['usdt-evm'],
          payoutRecipients: {
            'user-captain': '0xcaptain'
          },
          quotePayouts: false
        }
      },
      compliance: {
        kycVerified: true,
        jurisdictionAllowed: true,
        responsiblePlayAccepted: true
      }
    }
  })
  const redacted = runtimeSettings.redactRuntimeSettings(settings)

  assert.equal(settings.sdkPackages.qvac.modelId, 'qvac-config-ref')
  assert.equal(settings.sdkPackages.qvac.preloadedModelId, 'env-preloaded-referee-model')
  assert.equal(settings.sdkPackages.qvac.preflightLoadModel, true)
  assert.equal(settings.sdkPackages.tetherWdk.seedPhrase, 'env seed phrase')
  assert.deepEqual(settings.sdkPackages.tetherWdk.assets, ['usdt-evm', 'btc'])
  assert.equal(settings.sdkPackages.tetherWdk.payoutAccountIndex, 4)
  assert.equal(settings.sdkPackages.tetherWdk.defaultPayoutAddress, '0xdefaultwinner')
  assert.equal(settings.sdkPackages.tetherWdk.broadcastPayouts, true)
  assert.equal(settings.sdkPackages.tetherWdk.quotePayouts, false)
  assert.deepEqual(settings.sdkPackages.tetherWdk.payoutRecipients, {
    'user-captain': '0xcaptain'
  })
  assert.equal(settings.compliance.realMoneyEnabled, true)
  assert.equal(settings.compliance.kycVerified, false)
  assert.equal(settings.compliance.jurisdictionAllowed, true)
  assert.equal(redacted.sdkPackages.tetherWdk.seedPhrase, '[redacted]')
  assert.equal(redacted.sdkPackages.tetherWdk.defaultPayoutAddress, '[redacted]')
  assert.deepEqual(redacted.sdkPackages.tetherWdk.payoutRecipients, {
    'user-captain': '[redacted]'
  })
})

test('runtime settings can load explicit JSON config path', () => {
  const settings = runtimeSettings.loadRuntimeSettings({
    env: {},
    configPath: '/tmp/pearcup-runtime.json',
    readFile (path) {
      assert.equal(path, '/tmp/pearcup-runtime.json')
      return JSON.stringify({
        sdkPackages: {
          qvac: { enabled: true, modelSrc: 'qvac-src' },
          tetherWdk: { enabled: true, seedPhrase: 'file seed phrase' }
        }
      })
    },
    resolvePath: path => path
  })

  assert.equal(settings.source.loaded, true)
  assert.equal(settings.sdkPackages.qvac.modelSrc, 'qvac-src')
  assert.equal(settings.sdkPackages.tetherWdk.seedPhrase, 'file seed phrase')
})

test('runtime config consumes PearCupRuntimeSettingsValue for package adapters and compliance', () => {
  const calls = []
  const rootObject = {
    PearCupSdkRuntime: {
      createQvacSdkRefereeAdapter (config) {
        calls.push(['qvac', config.modelId])
        return {
          mode: 'sdk',
          attestRound () {},
          attestPoolSettlement () {}
        }
      },
      createTetherWdkPackageAdapter (config) {
        calls.push(['wdk', config.seedPhrase, config.payoutAccountIndex, config.defaultPayoutAddress])
        return {
          mode: 'sdk',
          createGameEscrow () {},
          releaseGameEscrow () {},
          createEntryIntent () {},
          confirmEntryIntent () {},
          createPoolPayout () {}
        }
      }
    },
    PearCupRuntimeSettingsValue: runtimeSettings.loadRuntimeSettings({
      config: {
        sdkPackages: {
          qvac: { enabled: true, modelId: 'settings-qvac-ref' },
          tetherWdk: {
            enabled: true,
            seedPhrase: 'settings seed phrase',
            payoutAccountIndex: 3,
            defaultPayoutAddress: '0xsettingswinner'
          }
        },
        compliance: {
          realMoneyEnabled: true,
          kycVerified: true,
          jurisdictionAllowed: true,
          responsiblePlayAccepted: true
        }
      },
      env: {}
    })
  }

  const runtime = runtimeConfig.createRuntimeConfig({ rootObject })

  assert.equal(runtime.mode.qvac, 'sdk')
  assert.equal(runtime.mode.tetherWdk, 'sdk')
  assert.equal(runtime.canUseRealMoney, true)
  assert.deepEqual(calls, [
    ['qvac', 'settings-qvac-ref'],
    ['wdk', 'settings seed phrase', 3, '0xsettingswinner']
  ])
})

test('runtime settings validate complete live config without leaking the WDK seed', () => {
  const settings = runtimeSettings.loadRuntimeSettings({
    env: {},
    config: {
      sdkPackages: {
        qvac: {
          enabled: true,
          modelExport: 'LLAMA_3_2_1B_INST_Q4_0'
        },
        tetherWdk: {
          enabled: true,
          seedPhrase: 'valid live config seed phrase',
          assets: ['usdt-evm'],
          evmProvider: 'https://rpc.example.invalid',
          defaultPayoutAddress: '0xlivewinner000000000000000000000000000000',
          skipInitialBalanceProbe: false
        }
      },
      compliance: {
        realMoneyEnabled: true,
        kycVerified: true,
        jurisdictionAllowed: true,
        responsiblePlayAccepted: true
      }
    }
  })
  const validation = runtimeSettings.validateRuntimeSettings(settings, { requireLive: true })

  assert.equal(validation.ok, true)
  assert.deepEqual(validation.errors, [])
  assert.equal(validation.redactedSettings.sdkPackages.tetherWdk.seedPhrase, '[redacted]')
  assert.equal(validation.redactedSettings.sdkPackages.tetherWdk.defaultPayoutAddress, '[redacted]')
  assert.equal(JSON.stringify(validation).includes('valid live config seed phrase'), false)
  assert.equal(JSON.stringify(validation).includes('0xlivewinner'), false)
})

test('runtime settings validation blocks unsafe live settlement config', () => {
  const settings = runtimeSettings.loadRuntimeSettings({
    env: {},
    config: {
      sdkPackages: {
        qvac: {
          enabled: true,
          modelExport: 'LLAMA_3_2_1B_INST_Q4_0'
        },
        tetherWdk: {
          enabled: true,
          seedPhrase: 'seed without provider',
          assets: ['usdt-evm'],
          skipInitialBalanceProbe: true
        }
      },
      compliance: {
        realMoneyEnabled: true,
        kycVerified: false,
        jurisdictionAllowed: true,
        responsiblePlayAccepted: false
      }
    }
  })
  const validation = runtimeSettings.validateRuntimeSettings(settings, { requireLive: true })
  const labels = validation.errors.map(error => error.label).join('\n')

  assert.equal(validation.ok, false)
  assert.match(labels, /evmProvider/)
  assert.match(labels, /Disable skipInitialBalanceProbe/)
  assert.match(labels, /defaultPayoutAddress or payoutRecipients/)
  assert.match(labels, /KYC/)
  assert.match(labels, /responsible-play/)
})

test('runtime settings validation treats QVAC modelId as a label, not a loadable model source', () => {
  const settings = runtimeSettings.loadRuntimeSettings({
    env: {},
    config: {
      sdkPackages: {
        qvac: {
          enabled: true,
          modelId: 'qvac-label-only'
        },
        tetherWdk: {
          enabled: true,
          seedPhrase: 'valid live config seed phrase',
          assets: ['usdt-evm'],
          evmProvider: 'https://rpc.example.invalid',
          defaultPayoutAddress: '0xlivewinner000000000000000000000000000000',
          skipInitialBalanceProbe: false
        }
      },
      compliance: {
        realMoneyEnabled: true,
        kycVerified: true,
        jurisdictionAllowed: true,
        responsiblePlayAccepted: true
      }
    }
  })
  const validation = runtimeSettings.validateRuntimeSettings(settings, { requireLive: true })

  assert.equal(settings.sdkPackages.qvac.modelId, 'qvac-label-only')
  assert.equal(validation.ok, false)
  assert.match(validation.errors.map(error => error.label).join('\n'), /modelSrc, modelExport, or preloadedModelId/)
})

test('runtime settings validation accepts a preloaded QVAC model id as the loadable model source', () => {
  const settings = runtimeSettings.loadRuntimeSettings({
    env: {},
    config: {
      sdkPackages: {
        qvac: {
          enabled: true,
          modelId: 'qvac-label',
          preloadedModelId: 'qvac-runtime-preloaded-model'
        },
        tetherWdk: {
          enabled: true,
          seedPhrase: 'valid live config seed phrase',
          assets: ['usdt-evm'],
          evmProvider: 'https://rpc.example.invalid',
          defaultPayoutAddress: '0xlivewinner000000000000000000000000000000',
          skipInitialBalanceProbe: false
        }
      },
      compliance: {
        realMoneyEnabled: true,
        kycVerified: true,
        jurisdictionAllowed: true,
        responsiblePlayAccepted: true
      }
    }
  })
  const validation = runtimeSettings.validateRuntimeSettings(settings, { requireLive: true })

  assert.equal(settings.sdkPackages.qvac.modelId, 'qvac-label')
  assert.equal(settings.sdkPackages.qvac.preloadedModelId, 'qvac-runtime-preloaded-model')
  assert.equal(validation.ok, true)
})

test('runtime settings do not enable QVAC from a label-only modelId unless explicitly requested', () => {
  const settings = runtimeSettings.loadRuntimeSettings({
    env: {},
    config: {
      sdkPackages: {
        qvac: {
          modelId: 'qvac-label-only'
        }
      }
    }
  })

  assert.equal(settings.sdkPackages.qvac, undefined)
})

test('live runtime config template can be generated from env and redacted for output', () => {
  const template = runtimeSettings.createLiveRuntimeConfigTemplate({
    env: {
      PEARCUP_QVAC_MODEL_EXPORT: 'LLAMA_3_2_1B_INST_Q4_0',
      PEARCUP_QVAC_PRELOADED_MODEL_ID: 'template-preloaded-qvac-model',
      PEARCUP_WDK_SEED: 'template seed phrase',
      PEARCUP_EVM_PROVIDER: 'https://rpc.example.invalid',
      PEARCUP_REAL_MONEY_ENABLED: 'true'
    }
  })
  const redacted = runtimeSettings.redactRuntimeSettings(template)

  assert.equal(template.sdkPackages.qvac.enabled, true)
  assert.equal(template.sdkPackages.qvac.preloadedModelId, 'template-preloaded-qvac-model')
  assert.equal(template.sdkPackages.tetherWdk.enabled, true)
  assert.equal(template.sdkPackages.tetherWdk.payoutAccountIndex, 0)
  assert.equal(template.sdkPackages.tetherWdk.defaultPayoutAddress, '')
  assert.deepEqual(template.sdkPackages.tetherWdk.payoutRecipients, {})
  assert.equal(template.sdkPackages.tetherWdk.broadcastPayouts, false)
  assert.equal(template.sdkPackages.tetherWdk.quotePayouts, true)
  assert.equal(template.sdkPackages.tetherWdk.skipInitialBalanceProbe, false)
  assert.equal(redacted.sdkPackages.tetherWdk.seedPhrase, '[redacted]')
})
