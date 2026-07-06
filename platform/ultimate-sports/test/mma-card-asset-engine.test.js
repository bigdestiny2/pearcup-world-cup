'use strict'

const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  mmaCardAssets,
  platform,
  tournamentExperience
} = require('../src')
const auditScript = require('../scripts/audit-mma-card-assets')
const exportScript = require('../scripts/export-mma-card-higgsfield-prompts')
const generateStandupScript = require('../scripts/generate-mma-card-standup-assets')
const submitScript = require('../scripts/submit-mma-card-higgsfield-jobs')

const docPath = path.join(__dirname, '..', 'docs', 'mma-card-assets-api-plan.md')
const apiDoc = fs.readFileSync(docPath, 'utf8')

test('MMA card asset plan covers every required tournament asset with Higgsfield jobs', () => {
  const plan = mmaCardAssets.createMmaCardAssetPlan({
    tournamentId: 'fight-night-test',
    title: 'Fight Night Test'
  })
  const assetTypes = new Set(plan.assets.map(asset => asset.assetType))
  const imageJobs = plan.queue.jobs.filter(job => job.kind === 'image')
  const motionJobs = plan.queue.jobs.filter(job => job.kind === 'video-loop')

  assert.equal(plan.fitId, 'mma-boxing-fight-card')
  assert.equal(plan.provider, 'higgsfield-api')
  assert.equal(plan.supportedCombatSports.includes('boxing'), true)
  assert.equal(plan.supportedCombatSports.includes('kickboxing'), true)
  assert.equal(plan.supportedCombatSports.includes('bareknuckle'), true)
  assert.equal(plan.generator.baseUrl, mmaCardAssets.HIGGSFIELD_API_BASE_URL)
  tournamentExperience.REQUIRED_ASSET_TYPES.forEach(assetType => {
    assert.equal(assetTypes.has(assetType), true, `${assetType} missing from MMA asset plan`)
  })
  assert.equal(imageJobs.length, tournamentExperience.REQUIRED_ASSET_TYPES.length)
  assert.equal(motionJobs.some(job => job.assetType === 'hero-backdrop'), true)
  assert.equal(motionJobs.some(job => job.assetType === 'watch-room-stage'), true)
})

test('MMA prompts preserve UFC-like energy without official marks or fighter likenesses', () => {
  const plan = mmaCardAssets.createMmaCardAssetPlan()
  const serialized = JSON.stringify(plan)

  assert.match(plan.style.aesthetic, /UFC-like/)
  assert.equal(plan.style.rightsPolicy.includes('official promotion logos'), true)
  plan.assets.forEach(asset => {
    assert.equal(asset.rights.disallowed.includes('official promotion logos'), true)
    assert.equal(asset.rights.disallowed.includes('real fighter likenesses'), true)
    assert.match(asset.negativePrompt, /logo|logos|marks/)
    assert.equal(asset.prompt.includes('mobile app asset'), true)
  })
  assert.equal(serialized.includes('API Key Secret'), false)
})

test('MMA API requirements include generation, fight data, odds, storage, and QVAC', () => {
  const apis = mmaCardAssets.listMmaCardApiRequirements()
  const apiIds = new Set(apis.map(api => api.apiId))

  assert.equal(apiIds.has('higgsfield-api'), true)
  assert.equal(apiIds.has('higgsfield-mcp'), true)
  assert.equal(apiIds.has('sportsdataio-mma'), true)
  assert.equal(apiIds.has('odds-api-mma'), true)
  assert.equal(apiIds.has('asset-storage-cdn'), true)
  assert.equal(apiIds.has('qvac-referee'), true)
  assert.equal(apis.find(api => api.apiId === 'higgsfield-api').auth.includes('API key'), true)
  assert.equal(apis.find(api => api.apiId === 'higgsfield-mcp').status, 'fallback-for-generation')
  assert.equal(apis.find(api => api.apiId === 'sportsdataio-mma').auth.includes('Ocp-Apim-Subscription-Key'), true)
  assert.equal(apis.find(api => api.apiId === 'odds-api-mma').notes.includes('MMA sport key: mma_mixed_martial_arts'), true)
})

test('MMA asset plan validates and exports a Higgsfield generation payload', () => {
  const plan = mmaCardAssets.createMmaCardAssetPlan({ provider: 'higgsfield-cli' })
  const validation = mmaCardAssets.validateMmaCardAssetPlan(plan)
  const queue = mmaCardAssets.createMmaCardHiggsfieldQueue({
    assets: plan.assets,
    title: plan.title,
    provider: 'higgsfield-cli'
  })

  assert.equal(validation.ok, true)
  assert.equal(validation.errors.length, 0)
  assert.equal(queue.provider, 'higgsfield-cli')
  assert.equal(queue.agentPrompt.includes('Generate the MMA Fight Card MMA asset pack with Higgsfield.'), true)
  assert.equal(queue.jobs.every(job => job.outputTargets.length > 0), true)
})

test('MMA Higgsfield API request plan stays server-only and redacts secrets', () => {
  const env = {
    HIGGSFIELD_API_KEY: 'unit-token-redacted-a',
    HIGGSFIELD_API_BASE_URL: 'https://private.higgsfield.example',
    HIGGSFIELD_API_CREATE_PATH: '/v1/generations'
  }
  const requestPlan = mmaCardAssets.createMmaCardHiggsfieldApiRequestPlan({
    env,
    limit: 2
  })
  const serialized = JSON.stringify(requestPlan)

  assert.equal(requestPlan.requestPlanVersion, mmaCardAssets.MMA_HIGGSFIELD_API_REQUEST_PLAN_VERSION)
  assert.equal(requestPlan.serverOnly, true)
  assert.equal(requestPlan.noClientSecrets, true)
  assert.equal(requestPlan.readyForSubmission, true)
  assert.equal(requestPlan.requestCount, 2)
  assert.equal(requestPlan.requests.every(request => request.headers.Authorization === 'Bearer [redacted]'), true)
  assert.equal(requestPlan.requests.every(request => request.url === 'https://private.higgsfield.example/v1/generations'), true)
  assert.equal(serialized.includes(env.HIGGSFIELD_API_KEY), false)
})

test('MMA Higgsfield API dry-run blocks safely until raw API config is present', async () => {
  const result = await mmaCardAssets.submitMmaCardHiggsfieldJobs({
    env: {},
    dryRun: true,
    generatedAt: '2026-07-04T00:00:00.000Z',
    limit: 1
  })

  assert.equal(result.submissionVersion, mmaCardAssets.MMA_HIGGSFIELD_API_SUBMISSION_VERSION)
  assert.equal(result.dryRun, true)
  assert.equal(result.overallStatus, 'dry-run-blocked')
  assert.equal(result.submittedCount, 0)
  assert.equal(result.requestPlan.missingEnv.includes('HIGGSFIELD_API_KEY'), true)
  assert.equal(result.requestPlan.missingConfig.includes('HIGGSFIELD_API_CREATE_PATH'), true)
})

test('MMA Higgsfield API live submission uses injected fetch without leaking keys', async () => {
  const calls = []
  const env = {
    HIGGSFIELD_API_KEY: 'unit-token-redacted-b',
    HIGGSFIELD_API_CREATE_PATH: '/v1/generations'
  }
  const result = await mmaCardAssets.submitMmaCardHiggsfieldJobs({
    env,
    dryRun: false,
    generatedAt: '2026-07-04T00:00:00.000Z',
    limit: 1,
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return {
        ok: true,
        status: 202,
        text: async () => JSON.stringify({ id: 'hf-job-1', status: 'queued' })
      }
    }
  })

  assert.equal(result.overallStatus, 'submitted')
  assert.equal(result.submittedCount, 1)
  assert.equal(result.submissions[0].providerJobId, 'hf-job-1')
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${env.HIGGSFIELD_API_KEY}`)
  assert.equal(JSON.stringify(result).includes(env.HIGGSFIELD_API_KEY), false)
})

test('MMA generated asset audit reports missing and downloaded output targets', () => {
  const outputRoot = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mma-card-assets-'))
  const missingAudit = mmaCardAssets.createMmaCardGeneratedAssetAudit({
    outputRoot,
    generatedAt: '2026-07-04T00:00:00.000Z'
  })
  const firstTarget = missingAudit.targets[0]

  assert.equal(missingAudit.auditVersion, mmaCardAssets.MMA_GENERATED_ASSET_AUDIT_VERSION)
  assert.equal(missingAudit.overallStatus, 'waiting-for-generated-assets')
  assert.equal(missingAudit.summary.presentTargets, 0)
  assert.equal(missingAudit.summary.missingTargets, missingAudit.summary.targetCount)
  assert.equal(firstTarget.file.present, false)
  assert.equal(missingAudit.generationHandoff.queueJobCount > 0, true)
  assert.equal(missingAudit.generationHandoff.envVars.includes('HIGGSFIELD_API_KEY'), true)
  assert.equal(missingAudit.generationHandoff.readyForQa, false)

  fs.mkdirSync(path.dirname(firstTarget.absolutePath), { recursive: true })
  fs.writeFileSync(firstTarget.absolutePath, 'fake png bytes')

  const partialAudit = mmaCardAssets.createMmaCardGeneratedAssetAudit({
    outputRoot,
    generatedAt: '2026-07-04T00:00:00.000Z'
  })
  const downloadedTarget = partialAudit.targets.find(target => target.relativePath === firstTarget.relativePath)

  assert.equal(partialAudit.overallStatus, 'partial-generated-assets')
  assert.equal(partialAudit.summary.presentTargets, 1)
  assert.equal(partialAudit.summary.readyForQaTargets, 1)
  assert.equal(downloadedTarget.file.present, true)
  assert.equal(downloadedTarget.qa.rightsReviewRequired, true)
})

test('MMA standup asset generator materializes every PNG and MP4 target', () => {
  const outputRoot = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mma-card-standup-assets-'))
  const result = generateStandupScript.generateMmaCardStandupAssets({
    outputRoot,
    generatedAt: '2026-07-04T00:00:00.000Z',
    force: true
  })
  const parsed = generateStandupScript.parseArgs([
    '--output-root',
    outputRoot,
    '--generated-at',
    '2026-07-04T00:00:00.000Z',
    '--force'
  ])
  const pngTarget = result.audit.targets.find(target => target.kind === 'image')
  const mp4Target = result.audit.targets.find(target => target.kind === 'video-loop')

  assert.equal(parsed.outputRoot, outputRoot)
  assert.equal(parsed.force, true)
  assert.equal(result.audit.overallStatus, 'generated-assets-ready-for-qa')
  assert.equal(result.audit.summary.presentTargets, result.audit.summary.targetCount)
  assert.equal(result.audit.summary.readyForQaTargets, result.audit.summary.targetCount)
  assert.equal(result.writtenCount, result.targetCount)
  assert.equal(fs.existsSync(result.metadataPath), true)
  assert.deepEqual(fs.readFileSync(pngTarget.absolutePath).subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  assert.equal(fs.readFileSync(mp4Target.absolutePath, 'utf8').includes('ftyp'), true)
})

test('platform facade exposes MMA asset and API helpers', () => {
  const app = platform.createUltimateSportsPlatform()
  const plan = app.createMmaCardAssetPlan({ tournamentId: 'facade-fight-card' })
  const queue = app.createMmaCardHiggsfieldQueue({
    assets: plan.assets,
    tournamentId: plan.tournamentId
  })
  const requestPlan = app.createMmaCardHiggsfieldApiRequestPlan({
    env: {
      HIGGSFIELD_API_KEY: 'unit-token-redacted-c',
      HIGGSFIELD_API_CREATE_PATH: '/v1/generations'
    },
    limit: 1
  })
  const apis = app.listMmaCardApiRequirements()

  assert.equal(plan.tournamentId, 'facade-fight-card')
  assert.equal(queue.jobs.length > plan.assets.length, true)
  assert.equal(requestPlan.readyForSubmission, true)
  assert.equal(app.createMmaCardGeneratedAssetAudit({ outputRoot: '/tmp/mma-card-missing' }).summary.targetCount > 0, true)
  assert.equal(apis.some(api => api.apiId === 'higgsfield-api'), true)
})

test('MMA generated asset audit CLI writes a report without credentials', () => {
  const tempDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mma-card-audit-'))
  const outFile = path.join(tempDir, 'asset-audit.json')
  const parsed = auditScript.parseArgs([
    '--json',
    outFile,
    '--output-root',
    path.join(tempDir, 'outputs'),
    '--generated-at',
    '2026-07-04T00:00:00.000Z'
  ])
  const audit = auditScript.main([
    '--json',
    outFile,
    '--output-root',
    path.join(tempDir, 'outputs'),
    '--generated-at',
    '2026-07-04T00:00:00.000Z'
  ])
  const saved = JSON.parse(fs.readFileSync(outFile, 'utf8'))

  assert.equal(parsed.json, outFile)
  assert.equal(audit.overallStatus, 'waiting-for-generated-assets')
  assert.equal(saved.summary.missingTargets, saved.summary.targetCount)
  assert.equal(JSON.stringify(saved).includes('API Key Secret'), false)
})

test('export script parses arguments for prompt handoff without requiring credentials', () => {
  const parsed = exportScript.parseArgs([
    '--out',
    '/tmp/mma-card.json',
    '--title',
    'Saturday Fight Card',
    '--provider',
    'higgsfield-mcp'
  ])

  assert.equal(parsed.out, '/tmp/mma-card.json')
  assert.equal(parsed.title, 'Saturday Fight Card')
  assert.equal(parsed.provider, 'higgsfield-mcp')
})

test('submit script parses dry-run and live raw API options', () => {
  const parsed = submitScript.parseArgs([
    '--json',
    '/tmp/higgsfield-submit.json',
    '--title',
    'Saturday Fight Card',
    '--create-path',
    '/v1/generations',
    '--limit',
    '3',
    '--live'
  ])

  assert.equal(parsed.json, '/tmp/higgsfield-submit.json')
  assert.equal(parsed.title, 'Saturday Fight Card')
  assert.equal(parsed.createPath, '/v1/generations')
  assert.equal(parsed.limit, 3)
  assert.equal(parsed.live, true)
})

test('MMA asset API doc names every asset type and public helper', () => {
  tournamentExperience.REQUIRED_ASSET_TYPES.forEach(assetType => {
    assert.equal(apiDoc.includes(`\`${assetType}\``), true, `${assetType} missing from MMA API doc`)
  })
  ;[
    'createMmaCardAssetPlan',
    'createMmaCardHiggsfieldQueue',
    'createMmaCardHiggsfieldApiRequestPlan',
    'submit-mma-card-higgsfield-jobs',
    'generate-mma-card-standup-assets',
    'SportsDataIO',
    'The Odds API',
    'Higgsfield',
    'generationHandoff',
    'rotate'
  ].forEach(term => {
    assert.equal(apiDoc.includes(term), true, `${term} missing from MMA API doc`)
  })
})
