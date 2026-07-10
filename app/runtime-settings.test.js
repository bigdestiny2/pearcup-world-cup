const assert = require('node:assert/strict')
const test = require('node:test')
const runtimeSettings = require('./runtime-settings.js')
require('./core.js')
require('./adapters.js')
require('./qvac-referee.js')
require('./tether-wdk-bridge.js')
require('./sdk-runtime.js')
const runtimeConfig = require('./runtime-config.js')

test('QVAC settings use strict referee output separately from commentary output', () => {
  const refereeCompletionOptions = {
    temperature: 0,
    responseFormat: {
      type: 'json_schema',
      json_schema: {
        name: 'pearcup_referee_review',
        strict: true,
        schema: { type: 'object', additionalProperties: false }
      }
    }
  }
  const commentaryCompletionOptions = {
    temperature: 0.2,
    responseFormat: { type: 'json_object' }
  }
  const settings = runtimeSettings.loadRuntimeSettings({
    env: {},
    config: {
      sdkPackages: {
        qvac: {
          enabled: true,
          modelSrc: '/models/qwen.gguf',
          refereeCompletionOptions,
          commentaryCompletionOptions
        }
      }
    }
  })
  const calls = []
  const rootObject = {
    PearCupRuntimeSettingsValue: settings,
    PearCupSdkRuntime: {
      createQvacSdkRefereeAdapter (config) {
        calls.push(['referee', config.completionOptions])
        return { mode: 'sdk', attestRound () {}, attestPoolSettlement () {} }
      },
      createQvacSdkCommentaryAdapter (config) {
        calls.push(['commentary', config.completionOptions])
        return { mode: 'sdk', generateSegment () {} }
      }
    }
  }

  const runtime = runtimeConfig.createRuntimeConfig({ rootObject })

  assert.equal(runtime.mode.qvac, 'sdk')
  assert.equal(runtime.mode.qvacCommentary, 'sdk')
  assert.deepEqual(calls, [
    ['referee', refereeCompletionOptions],
    ['commentary', commentaryCompletionOptions]
  ])
})

test('renderer runtime settings accept local QVAC options but never expose WDK custody data', () => {
  const rendererSettings = runtimeSettings.loadRendererRuntimeSettings({
    env: {
      PEARCUP_QVAC_ENABLED: 'true',
      PEARCUP_QVAC_MODEL_SRC: '/models/local-qwen.gguf',
      PEARCUP_QVAC_MODEL_TYPE: 'llamacpp-completion',
      PEARCUP_QVAC_CONTEXT_SIZE: '2048',
      PEARCUP_WDK_SEED: 'renderer-must-not-see-this',
      PEARCUP_REAL_MONEY_ENABLED: 'true'
    }
  })

  assert.deepEqual(rendererSettings.sdkPackages.qvac.loadModelOptions, {
    modelType: 'llamacpp-completion',
    modelConfig: { ctx_size: 2048 }
  })
  assert.equal(rendererSettings.sdkPackages.tetherWdk, undefined)
  assert.equal(rendererSettings.compliance.realMoneyEnabled, false)
  assert.equal(JSON.stringify(rendererSettings).includes('renderer-must-not-see-this'), false)

  const hostSettings = runtimeSettings.loadRuntimeSettings({
    env: {},
    config: {
      sdkPackages: {
        qvac: { enabled: true, modelSrc: '/models/local-qwen.gguf' },
        tetherWdk: { enabled: true, seedPhrase: 'host-only-seed' }
      },
      compliance: { realMoneyEnabled: true }
    }
  })
  const bridgedSettings = runtimeSettings.toRendererRuntimeSettings(hostSettings)

  assert.equal(bridgedSettings.sdkPackages.qvac.modelSrc, '/models/local-qwen.gguf')
  assert.equal(bridgedSettings.sdkPackages.tetherWdk, undefined)
  assert.equal(bridgedSettings.compliance.realMoneyEnabled, false)
  assert.equal(JSON.stringify(bridgedSettings).includes('host-only-seed'), false)
})

test('renderer settings application preserves a host-provided safe QVAC configuration', () => {
  const hostSettings = runtimeSettings.toRendererRuntimeSettings({
    sdkPackages: { qvac: { modelId: 'host-qvac' } }
  })
  const rootObject = { PearCupRuntimeSettingsValue: hostSettings }

  assert.equal(rootObject.PearCupRuntimeSettingsValue.sdkPackages.qvac.modelId, 'host-qvac')
  assert.equal(rootObject.PearCupRuntimeSettingsValue.sdkPackages.tetherWdk, undefined)
})

test('renderer settings expose only public HTTPS live-data relay locations', () => {
  const hostSettings = runtimeSettings.loadRuntimeSettings({
    env: { PEARCUP_LIVE_DATA_RELAY_URL: 'https://data.example.test/v1/live-match.json' },
    config: {
      sdkPackages: { tetherWdk: { enabled: true, seedPhrase: 'worker-only-seed' } },
      liveData: { relayUrl: 'https://ignored.example/live-match.json', pollMs: 20_000 }
    }
  })
  const rendererSettings = runtimeSettings.toRendererRuntimeSettings(hostSettings)

  assert.deepEqual(rendererSettings.liveData, {
    relayUrl: 'https://data.example.test/v1/live-match.json',
    oddsRelayUrl: 'https://data.example.test/v1/polymarket-odds.json',
    pollMs: 20_000
  })
  assert.equal(JSON.stringify(rendererSettings).includes('worker-only-seed'), false)
  assert.equal(runtimeSettings.liveDataSettingsFrom({
    env: { PEARCUP_LIVE_DATA_RELAY_URL: 'http://data.example.test/v1/live-match.json' }
  }), null)
})
