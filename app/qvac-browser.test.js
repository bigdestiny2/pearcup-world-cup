const assert = require('node:assert/strict')
const test = require('node:test')

const core = require('./core.js')
const adapters = require('./adapters.js')
const qvacReferee = require('./qvac-referee.js')
const sdkRuntime = require('./sdk-runtime.js')
const runtimeConfig = require('./runtime-config.js')

test('QVAC browser HTTP client uses the local OpenAI-compatible chat route', async () => {
  const requests = []
  const client = sdkRuntime.createQvacBrowserHttpCompletionClient({
    browserHttp: {
      baseUrl: 'http://127.0.0.1:11435/v1',
      model: 'qvac-kawaii-qwen3-1.7b',
      timeoutMs: 5000
    },
    completionOptions: {
      temperature: 0,
      responseFormat: { type: 'json_object' }
    },
    fetchImpl: async (url, init) => {
      requests.push({ url, init })
      return {
        ok: true,
        status: 200,
        async text () {
          return JSON.stringify({
            choices: [{ message: { content: '{"text":"Spain press high","confidence":0.91}' } }]
          })
        }
      }
    }
  })

  const raw = await client.completeJson({
    history: [{ role: 'user', content: 'Give a grounded line.' }]
  })
  assert.equal(raw, '{"text":"Spain press high","confidence":0.91}')
  assert.equal(requests[0].url, 'http://127.0.0.1:11435/v1/chat/completions')
  const body = JSON.parse(requests[0].init.body)
  assert.equal(body.model, 'qvac-kawaii-qwen3-1.7b')
  assert.deepEqual(body.response_format, { type: 'json_object' })
  assert.equal(body.responseFormat, undefined)
  assert.equal(body.stream, false)
})

test('browser runtime config wires QVAC HTTP into referee, trivia, commentary, and analysis adapters', async () => {
  const previousFetch = global.fetch
  global.fetch = async () => ({
    ok: true,
    status: 200,
    async text () {
      return JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          text: 'Norway control the half-spaces.',
          confidence: 0.84,
          homeTeam: 'Norway',
          awayTeam: 'England',
          prediction: { winner: 'Norway', method: 'Win', target: 'Full time', confidence: 52 },
          coverage: { score: 68, sources: ['live snapshot'] },
          parameterMatrix: [],
          tacticalFriction: { homeAdvantages: [], awayAdvantages: [] },
          structuralXFactors: [],
          progression: [],
          explainer: 'Grounded in the verified local snapshot.'
        }) } }]
      })
    }
  })

  try {
    const rootObject = {
      PearCupCore: core,
      PearCupAdapters: adapters,
      PearCupQvacReferee: qvacReferee,
      PearCupSdkRuntime: sdkRuntime,
      document: {},
      window: {}
    }
    const runtime = runtimeConfig.createRuntimeConfig({
      rootObject,
      sdkPackages: {
        qvac: {
          enabled: true,
          modelId: 'qvac-kawaii-qwen3-1.7b',
          browserHttp: {
            enabled: true,
            baseUrl: 'http://127.0.0.1:11435/v1',
            model: 'qvac-kawaii-qwen3-1.7b'
          }
        }
      }
    })
    assert.equal(runtime.mode.qvac, 'sdk')
    assert.equal(runtime.mode.qvacCommentary, 'sdk')
    assert.equal(runtime.readiness.qvac.source, 'qvac:local-http')
    const segment = await runtime.adapters.qvacCommentary.generateSegment({
      matchId: 'test-match',
      language: 'EN',
      recentEvents: [{ eventId: 'event-1', teamId: 'no', type: 'shot', clock: "31'" }],
      currentStats: { minute: 31 }
    })
    assert.equal(segment.text, 'Norway control the half-spaces.')
    assert.equal(segment.modelId, 'qvac-kawaii-qwen3-1.7b')
    assert.equal(typeof runtime.adapters.qvac.attestRound, 'function')
    assert.equal(typeof runtime.adapters.qvacCommentary.generateTriviaRound, 'function')
    assert.equal(typeof runtime.adapters.qvacCommentary.generateFootballAnalysis, 'function')
  } finally {
    global.fetch = previousFetch
  }
})
