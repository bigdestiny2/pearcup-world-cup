'use strict'

const fs = require('node:fs')
const path = require('node:path')
const tournamentExperience = require('./tournament-experience-engine')
const { cloneJson, stableId } = require('./util')

const MMA_ASSET_PLAN_VERSION = 'ultimate-sports-mma-card-asset-plan-v1'
const MMA_GENERATED_ASSET_AUDIT_VERSION = 'ultimate-sports-mma-card-generated-asset-audit-v1'
const MMA_HIGGSFIELD_API_REQUEST_PLAN_VERSION = 'ultimate-sports-mma-card-higgsfield-api-request-plan-v1'
const MMA_HIGGSFIELD_API_SUBMISSION_VERSION = 'ultimate-sports-mma-card-higgsfield-submission-v1'
const HIGGSFIELD_MCP_URL = 'https://mcp.higgsfield.ai/mcp'
const HIGGSFIELD_API_BASE_URL = 'https://api.higgsfield.ai'
const DEFAULT_FIT_ID = 'mma-boxing-fight-card'
const DEFAULT_OUTPUT_ROOT = 'platform/ultimate-sports/generated-assets/mma-card'

const MMA_STYLE_TOKENS = Object.freeze([
  'premium mixed martial arts broadcast',
  'octagon-inspired cage geometry',
  'red corner and blue corner tension',
  'matte black arena darkness',
  'canvas white fight surface',
  'championship gold accent sparks',
  'dramatic walkout light beams',
  'mobile-safe interface negative space',
  'no official league logos',
  'no real fighter likenesses'
])

const HIGGSFIELD_MODEL_HINTS = Object.freeze({
  stills: ['Nano Banana Pro', 'GPT Image 2', 'Seedream 4.5'],
  cinematicVideo: ['Seedance 2.0', 'Veo 3.1', 'Cinema Studio 3.0'],
  edit: ['Background Image Remover', 'Expand Image', 'Upscale Image']
})

const MMA_API_REQUIREMENTS = Object.freeze([
  apiRequirement({
    apiId: 'higgsfield-api',
    category: 'creative-generation',
    provider: 'Higgsfield',
    purpose: 'Generate non-branded MMA UI art, social cards, icons, and short motion loops.',
    auth: 'Server-side API key only; do not store API keys in the repo or expose them to clients.',
    status: 'required-for-generation',
    docsUrl: null,
    env: ['HIGGSFIELD_API_KEY', 'HIGGSFIELD_API_BASE_URL', 'HIGGSFIELD_API_CREATE_PATH'],
    notes: ['Use a configurable enterprise/private endpoint until Higgsfield publishes stable raw API docs.']
  }),
  apiRequirement({
    apiId: 'higgsfield-mcp',
    category: 'creative-generation-fallback',
    provider: 'Higgsfield',
    purpose: 'Fallback generation path when raw API access is not enabled for the account.',
    auth: 'MCP account login or Higgsfield CLI auth login.',
    status: 'fallback-for-generation',
    docsUrl: HIGGSFIELD_MCP_URL,
    env: ['HIGGSFIELD_MCP_URL']
  }),
  apiRequirement({
    apiId: 'sportsdataio-mma',
    category: 'fight-data',
    provider: 'SportsDataIO UFC / MMA API',
    purpose: 'Bout cards, fighters, event schedule, method results, fighter stats, and settlement evidence.',
    auth: 'Ocp-Apim-Subscription-Key header from a server-side secret manager.',
    status: 'recommended-for-official-feed',
    docsUrl: 'https://sportsdata.io/developers/api-documentation/mma',
    env: ['SPORTSDATAIO_MMA_API_KEY']
  }),
  apiRequirement({
    apiId: 'odds-api-mma',
    category: 'odds-and-markets',
    provider: 'The Odds API',
    purpose: 'Optional moneyline and prop odds for odds display, market context, and responsible-play copy.',
    auth: 'Server-side API key; never expose to clients.',
    status: 'optional-until-real-money',
    docsUrl: 'https://the-odds-api.com/liveapi/guides/v4/',
    env: ['ODDS_API_KEY'],
    notes: ['MMA sport key: mma_mixed_martial_arts']
  }),
  apiRequirement({
    apiId: 'asset-storage-cdn',
    category: 'asset-delivery',
    provider: 'App asset storage',
    purpose: 'Store generated originals, crops, thumbnails, attribution, prompt metadata, and moderation state.',
    auth: 'Server-side upload credentials only.',
    status: 'required-for-production',
    docsUrl: null,
    env: ['ASSET_BUCKET', 'ASSET_CDN_BASE_URL']
  }),
  apiRequirement({
    apiId: 'qvac-referee',
    category: 'evidence-and-review',
    provider: 'QVAC referee',
    purpose: 'Attest host-entered fight results, disputed scorecards, trivia banks, and generated asset review states.',
    auth: 'Local platform attestation lane.',
    status: 'required-for-prize-settlement',
    docsUrl: null,
    env: []
  })
])

const MMA_ASSET_BLUEPRINTS = Object.freeze({
  'lobby-icon': assetBlueprint({
    title: 'Fight Card Lobby Icon',
    aspectRatios: ['1:1'],
    resolution: '1024x1024',
    variants: ['full-color', 'single-color-mask'],
    prompt: 'square app icon, abstract octagon cage outline, red and blue corner glow, matte black canvas, subtle gold edge sparks, crisp silhouette readable at 24px, transparent-safe border',
    negativePrompt: 'letters, words, official promotion logos, real fighter faces, blood, gore, brand marks'
  }),
  'server-card-cover': assetBlueprint({
    title: 'Fight Card Server Cover',
    aspectRatios: ['4:3', '16:9'],
    resolution: '1600x1200',
    variants: ['desktop-cover', 'mobile-crop'],
    prompt: 'premium fight-night server card cover, empty cage under arena lights, red corner and blue corner towels, cinematic haze, center-safe subject, open top-left title space',
    negativePrompt: 'UFC logo, real sponsor boards, readable venue names, real fighter likenesses, excessive violence'
  }),
  'hero-backdrop': assetBlueprint({
    title: 'Fight Night Hero Backdrop',
    aspectRatios: ['16:9', '9:16', '4:3'],
    resolution: '3840x2160',
    variants: ['wide', 'vertical', 'tablet'],
    prompt: 'wide cinematic hero backdrop for a mixed martial arts card, walkout tunnel lights leading toward an empty cage, canvas white center, matte black crowd falloff, red and blue corner rim lights, broad negative space for UI',
    negativePrompt: 'official logos, text, close-up injuries, identifiable athletes, copyrighted marks'
  }),
  'bracket-board-skin': assetBlueprint({
    title: 'Bout List Board Skin',
    aspectRatios: ['16:9'],
    resolution: '2400x1350',
    variants: ['bout-list-board', 'scorecard-board'],
    prompt: 'UI skin for a fight-card bout list, judge scorecard paper texture, round-number chips, method-result slots, subtle cage mesh pattern, strong contrast but calm enough for dense data',
    negativePrompt: 'busy posters, official logos, unreadable texture, embedded text, fighter photos'
  }),
  'pool-card-accent': assetBlueprint({
    title: 'Fight Pool Card Accent',
    aspectRatios: ['3:1', '1:1'],
    resolution: '1800x600',
    variants: ['horizontal-strip', 'badge-accent'],
    prompt: 'small UI accent for confidence picks and method props, glove tape wraps, red blue split corner motif, gold tick mark energy, clean transparent edges',
    negativePrompt: 'blood splatter, official brand marks, text, real athletes'
  }),
  'mini-game-icon-set': assetBlueprint({
    title: 'Fight Mini-game Icon Set',
    aspectRatios: ['1:1'],
    resolution: '1024x1024',
    variants: ['round-winner', 'knockdown', 'takedown', 'submission', 'stoppage', 'decision', 'trivia', 'reaction'],
    prompt: 'consistent icon set for fight-night mini games, flat-but-premium broadcast glyphs, cage geometry, red and blue corner accents, one-color compatible silhouettes, no letters',
    negativePrompt: 'detailed faces, official logos, violent injuries, tiny unreadable detail, text'
  }),
  'watch-room-stage': assetBlueprint({
    title: 'Watch Room Fight Stage',
    aspectRatios: ['16:9', '9:16'],
    resolution: '2560x1440',
    variants: ['live-stage', 'between-fights-stage'],
    prompt: 'watch-room stage backdrop for live fight card, camera angle outside cage fence, arena LEDs, neutral canvas, open lower third for chat and predictions, dramatic but not cluttered',
    negativePrompt: 'broadcast logos, real event branding, blood, named fighters, text overlays'
  }),
  'result-share-card': assetBlueprint({
    title: 'Fight Result Share Card',
    aspectRatios: ['1200x630', '9:16'],
    resolution: '1200x630',
    variants: ['winner-card', 'method-card', 'upset-card'],
    prompt: 'social share card background for fight result, split red blue corners, blank fighter-name panels, method and round badge placeholders, evidence seal area, premium sports graphic design',
    negativePrompt: 'pre-rendered text, official logos, real fighter photos, cluttered UI, gore'
  }),
  'empty-state-illustration': assetBlueprint({
    title: 'Empty Fight Arena Illustration',
    aspectRatios: ['4:3', '1:1'],
    resolution: '1600x1200',
    variants: ['no-live-card', 'waiting-room'],
    prompt: 'empty fight arena illustration for no active tournament, folded stools in red and blue corners, spotlight on quiet canvas, inviting app UI mood, no specific event implied',
    negativePrompt: 'sad tone, logos, text, injuries, recognizable athletes'
  })
})

function createMmaCardAssetPlan ({
  tournamentId = 'mma-card',
  title = 'MMA Fight Card',
  provider = 'higgsfield-api',
  outputRoot = DEFAULT_OUTPUT_ROOT,
  includeVideoLoops = true
} = {}) {
  const basePack = tournamentExperience.createAssetGenerationPlan({ fitId: DEFAULT_FIT_ID }).packs[0]
  const assets = basePack.requiredAssets.map((asset, index) => assetJobFor({
    asset,
    index,
    tournamentId,
    title,
    provider,
    outputRoot,
    includeVideoLoops
  }))

  return {
    planVersion: MMA_ASSET_PLAN_VERSION,
    fitId: DEFAULT_FIT_ID,
    tournamentId,
    title,
    provider,
    supportedCombatSports: ['mma', 'boxing', 'kickboxing', 'muay-thai', 'one-championship', 'bareknuckle', 'submission-grappling'],
    generator: generatorForProvider(provider),
    style: {
      aesthetic: 'UFC-like premium MMA broadcast, intentionally non-branded',
      tokens: MMA_STYLE_TOKENS.slice(),
      palette: ['matte-black', 'canvas-white', 'corner-red', 'corner-blue', 'championship-gold'],
      rightsPolicy: 'Generated assets must not include official promotion logos, sponsor marks, broadcaster marks, venue marks, or real fighter likenesses unless licensed.'
    },
    apis: listMmaCardApiRequirements(),
    assets,
    queue: createMmaCardHiggsfieldQueue({
      assets,
      tournamentId,
      title,
      provider
    }),
    acceptanceChecklist: [
      'all nine required tournament asset types are present',
      'desktop and mobile crops preserve safe UI space',
      'no official marks or real fighter likenesses',
      'mini-game icons remain readable at 24px',
      'share card has blank space for winner, method, round, and QVAC evidence badge',
      'source metadata and prompt history are stored with each final asset'
    ]
  }
}

function createMmaCardHiggsfieldQueue ({
  assets = null,
  tournamentId = 'mma-card',
  title = 'MMA Fight Card',
  provider = 'higgsfield-api'
} = {}) {
  const jobs = (assets || createMmaCardAssetPlan({ tournamentId, title, provider }).assets).flatMap(asset => {
    const stillJob = {
      jobId: stableId(`higgsfield-${asset.assetType}`, {
        tournamentId,
        prompt: asset.prompt,
        variants: asset.variants
      }),
      kind: 'image',
      provider,
      assetType: asset.assetType,
      title: asset.title,
      prompt: asset.prompt,
      negativePrompt: asset.negativePrompt,
      aspectRatios: asset.aspectRatios.slice(),
      resolution: asset.resolution,
      variants: asset.variants.slice(),
      outputTargets: asset.outputTargets.map(target => cloneJson(target)),
      modelHints: HIGGSFIELD_MODEL_HINTS.stills.slice()
    }
    if (!asset.motionPrompt) return [stillJob]
    return [
      stillJob,
      {
        jobId: stableId(`higgsfield-motion-${asset.assetType}`, {
          tournamentId,
          prompt: asset.motionPrompt
        }),
        kind: 'video-loop',
        provider,
        assetType: asset.assetType,
        title: `${asset.title} Motion Loop`,
        prompt: asset.motionPrompt,
        negativePrompt: asset.negativePrompt,
        aspectRatios: asset.aspectRatios.filter(ratio => ratio !== '1200x630'),
        durationSeconds: 6,
        outputTargets: asset.motionOutputTargets.map(target => cloneJson(target)),
        modelHints: HIGGSFIELD_MODEL_HINTS.cinematicVideo.slice()
      }
    ]
  })

  return {
    queueVersion: 'higgsfield-mma-card-generation-queue-v1',
    provider,
    apiBaseUrl: HIGGSFIELD_API_BASE_URL,
    mcpUrl: HIGGSFIELD_MCP_URL,
    auth: {
      method: provider === 'higgsfield-api' ? 'server-side API key' : 'MCP or CLI account login',
      secretPolicy: 'Do not paste or commit API secrets; use server-side secret manager only.'
    },
    jobs,
    agentPrompt: agentPromptFor({ title, jobs })
  }
}

function createMmaCardHiggsfieldApiRequestPlan ({
  env = defaultEnv(),
  tournamentId = 'mma-card',
  title = 'MMA Fight Card',
  provider = 'higgsfield-api',
  outputRoot = DEFAULT_OUTPUT_ROOT,
  apiBaseUrl = env.HIGGSFIELD_API_BASE_URL || HIGGSFIELD_API_BASE_URL,
  createPath = env.HIGGSFIELD_API_CREATE_PATH || null,
  includeVideoLoops = true,
  limit = null
} = {}) {
  const plan = createMmaCardAssetPlan({
    tournamentId,
    title,
    provider,
    outputRoot,
    includeVideoLoops
  })
  const jobs = Number.isInteger(limit) && limit >= 0 ? plan.queue.jobs.slice(0, limit) : plan.queue.jobs
  const readiness = higgsfieldApiReadiness({ env, createPath })
  const url = createPath ? joinUrl(apiBaseUrl, createPath) : null
  const requests = jobs.map(job => createHiggsfieldRequestForJob({ job, url, tournamentId, title }))

  return {
    requestPlanVersion: MMA_HIGGSFIELD_API_REQUEST_PLAN_VERSION,
    provider: 'higgsfield-api',
    surface: 'raw-api',
    serverOnly: true,
    noClientSecrets: true,
    readyForSubmission: readiness.ready,
    apiBaseUrl,
    createPath,
    auth: {
      type: 'bearer',
      header: 'Authorization',
      env: 'HIGGSFIELD_API_KEY',
      redactedValue: env.HIGGSFIELD_API_KEY ? 'Bearer [redacted]' : null
    },
    requiredEnv: ['HIGGSFIELD_API_KEY'],
    requiredConfig: ['HIGGSFIELD_API_CREATE_PATH'],
    missingEnv: readiness.missingEnv,
    missingConfig: readiness.missingConfig,
    blockers: readiness.blockers,
    queueJobCount: plan.queue.jobs.length,
    requestCount: requests.length,
    requests,
    outputTargets: jobs.flatMap(job => job.outputTargets.map(target => cloneJson(target))),
    note: 'This is a redacted server-side submission plan. Live calls require --live and a contracted Higgsfield raw API create path.'
  }
}

async function submitMmaCardHiggsfieldJobs ({
  fetchImpl = globalThis.fetch,
  env = defaultEnv(),
  dryRun = true,
  generatedAt = new Date().toISOString(),
  ...requestPlanInput
} = {}) {
  const requestPlan = createMmaCardHiggsfieldApiRequestPlan({
    env,
    ...requestPlanInput
  })

  if (dryRun) {
    return {
      submissionVersion: MMA_HIGGSFIELD_API_SUBMISSION_VERSION,
      generatedAt,
      provider: requestPlan.provider,
      dryRun: true,
      overallStatus: requestPlan.readyForSubmission ? 'dry-run-ready' : 'dry-run-blocked',
      readyForSubmission: requestPlan.readyForSubmission,
      requestCount: requestPlan.requestCount,
      submittedCount: 0,
      failedCount: 0,
      blockers: requestPlan.blockers.slice(),
      requestPlan
    }
  }

  if (!requestPlan.readyForSubmission) {
    return {
      submissionVersion: MMA_HIGGSFIELD_API_SUBMISSION_VERSION,
      generatedAt,
      provider: requestPlan.provider,
      dryRun: false,
      overallStatus: 'blocked-before-submission',
      readyForSubmission: false,
      requestCount: requestPlan.requestCount,
      submittedCount: 0,
      failedCount: 0,
      blockers: requestPlan.blockers.slice(),
      requestPlan
    }
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required for live Higgsfield submission')

  const submissions = []
  for (const request of requestPlan.requests) {
    const startedAt = new Date().toISOString()
    try {
      const response = await fetchImpl(request.url, {
        method: request.method,
        headers: liveHiggsfieldHeaders(env),
        body: JSON.stringify(request.body)
      })
      const responseText = await response.text()
      const responseJson = parseMaybeJson(responseText)
      submissions.push({
        requestId: request.requestId,
        jobId: request.jobId,
        status: response.ok ? 'submitted' : 'failed',
        httpStatus: response.status,
        providerJobId: responseJson && (responseJson.id || responseJson.jobId || responseJson.job_id) || null,
        outputTargets: request.outputTargets.map(target => cloneJson(target)),
        startedAt,
        completedAt: new Date().toISOString(),
        responseSummary: summarizeProviderResponse(responseJson, responseText)
      })
    } catch (error) {
      submissions.push({
        requestId: request.requestId,
        jobId: request.jobId,
        status: 'failed',
        httpStatus: null,
        providerJobId: null,
        outputTargets: request.outputTargets.map(target => cloneJson(target)),
        startedAt,
        completedAt: new Date().toISOString(),
        error: error.message
      })
    }
  }

  const submittedCount = submissions.filter(item => item.status === 'submitted').length
  const failedCount = submissions.length - submittedCount
  return {
    submissionVersion: MMA_HIGGSFIELD_API_SUBMISSION_VERSION,
    generatedAt,
    provider: requestPlan.provider,
    dryRun: false,
    overallStatus: failedCount === 0 ? 'submitted' : submittedCount > 0 ? 'partially-submitted' : 'submission-failed',
    readyForSubmission: true,
    requestCount: requestPlan.requestCount,
    submittedCount,
    failedCount,
    blockers: failedCount === 0 ? [] : [`${failedCount} Higgsfield API submissions failed`],
    requestPlan,
    submissions
  }
}

function listMmaCardApiRequirements () {
  return MMA_API_REQUIREMENTS.map(item => cloneJson(item))
}

function validateMmaCardAssetPlan (plan = {}) {
  const errors = []
  const required = new Set(tournamentExperience.REQUIRED_ASSET_TYPES)
  const assets = Array.isArray(plan.assets) ? plan.assets : []
  const present = new Set(assets.map(asset => asset.assetType))

  required.forEach(assetType => {
    if (!present.has(assetType)) errors.push(`missing asset type: ${assetType}`)
  })
  assets.forEach(asset => {
    if (!asset.prompt) errors.push(`${asset.assetType} missing prompt`)
    if (!asset.negativePrompt) errors.push(`${asset.assetType} missing negative prompt`)
    if (!asset.acceptance || asset.acceptance.length === 0) errors.push(`${asset.assetType} missing acceptance checks`)
    if (!asset.rights || !asset.rights.disallowed.includes('official promotion logos')) {
      errors.push(`${asset.assetType} missing rights guardrail`)
    }
  })
  if (!plan.apis || !plan.apis.some(api => api.apiId === 'higgsfield-api')) errors.push('missing Higgsfield API requirement')

  return {
    ok: errors.length === 0,
    errors
  }
}

function createMmaCardGeneratedAssetAudit ({
  rootDir = path.resolve(__dirname, '..', '..', '..'),
  tournamentId = 'mma-card',
  title = 'MMA Fight Card',
  provider = 'higgsfield-api',
  outputRoot = DEFAULT_OUTPUT_ROOT,
  generatedAt = new Date().toISOString()
} = {}) {
  const plan = createMmaCardAssetPlan({ tournamentId, title, provider, outputRoot })
  const targets = plan.assets.flatMap(asset => [
    ...asset.outputTargets.map(target => targetAuditFor({ rootDir, asset, target, kind: 'image' })),
    ...asset.motionOutputTargets.map(target => targetAuditFor({ rootDir, asset, target, kind: 'video-loop' }))
  ])
  const assets = plan.assets.map(asset => {
    const assetTargets = targets.filter(target => target.assetType === asset.assetType)
    const presentTargets = assetTargets.filter(target => target.file.present)
    const qaTargets = assetTargets.filter(target => target.qa.readyForReview)
    return {
      assetType: asset.assetType,
      title: asset.title,
      requiredTargetCount: assetTargets.length,
      presentTargetCount: presentTargets.length,
      missingTargetCount: assetTargets.length - presentTargets.length,
      readyForQaCount: qaTargets.length,
      status: presentTargets.length === assetTargets.length
        ? 'generated'
        : presentTargets.length > 0
          ? 'partial'
          : 'missing',
      blockers: assetTargets
        .filter(target => !target.file.present)
        .map(target => `missing ${target.kind} output ${target.relativePath}`)
    }
  })
  const presentTargets = targets.filter(target => target.file.present)
  const missingTargets = targets.filter(target => !target.file.present)
  const readyForQaTargets = targets.filter(target => target.qa.readyForReview)
  const rightsBlockedTargets = targets.filter(target => target.qa.rightsReviewRequired)
  const summary = {
    assetCount: assets.length,
    generatedAssets: assets.filter(asset => asset.status === 'generated').length,
    partialAssets: assets.filter(asset => asset.status === 'partial').length,
    missingAssets: assets.filter(asset => asset.status === 'missing').length,
    targetCount: targets.length,
    presentTargets: presentTargets.length,
    missingTargets: missingTargets.length,
    readyForQaTargets: readyForQaTargets.length,
    rightsReviewRequiredTargets: rightsBlockedTargets.length,
    coveragePercent: percent(presentTargets.length, targets.length)
  }
  const overallStatus = summary.missingTargets === 0
    ? 'generated-assets-ready-for-qa'
    : summary.presentTargets > 0
      ? 'partial-generated-assets'
      : 'waiting-for-generated-assets'

  return {
    auditVersion: MMA_GENERATED_ASSET_AUDIT_VERSION,
    generatedAt,
    fitId: DEFAULT_FIT_ID,
    tournamentId,
    title,
    provider,
    outputRoot,
    overallStatus,
    summary,
    assets,
    targets,
    acceptanceChecklist: plan.acceptanceChecklist.slice(),
    generationHandoff: createGenerationHandoff({ plan, summary, overallStatus }),
    nextSteps: generatedAssetNextSteps({ overallStatus, summary })
  }
}

function createGenerationHandoff ({ plan, summary, overallStatus }) {
  const readyForQa = overallStatus === 'generated-assets-ready-for-qa'
  return {
    provider: plan.provider,
    surface: plan.generator.surface,
    apiBaseUrl: plan.generator.baseUrl || null,
    outputRoot: plan.queue.jobs[0] && plan.queue.jobs[0].outputTargets[0]
      ? plan.queue.jobs[0].outputTargets[0].path.split('/').slice(0, -2).join('/')
      : DEFAULT_OUTPUT_ROOT,
    envVars: ['HIGGSFIELD_API_KEY', 'HIGGSFIELD_API_BASE_URL'],
    queueJobCount: plan.queue.jobs.length,
    targetCount: summary.targetCount,
    readyForQa,
    blockers: readyForQa
      ? []
      : [
          `${summary.missingTargets} generated asset outputs are still missing`,
          'Higgsfield API generation must run from a backend or generation workstation with server-side secrets',
          'Generated files must be downloaded into the output target paths before visual QA'
        ],
    nextActions: readyForQa
      ? [
          'Run visual QA on every generated image and video target.',
          'Attach prompt metadata, rights review notes, and QVAC asset review evidence.',
          'Promote approved finals to app asset storage or CDN.'
        ]
      : [
          'Export the Higgsfield queue with scripts/export-mma-card-higgsfield-prompts.js.',
          'Dry-run the raw API request plan with scripts/submit-mma-card-higgsfield-jobs.js.',
          'Run the queue through the Higgsfield API using backend-only HIGGSFIELD_API_KEY and HIGGSFIELD_API_CREATE_PATH.',
          'Download each PNG/MP4 to platform/ultimate-sports/generated-assets/mma-card, then rerun the asset audit.'
        ],
    acceptanceCriteria: [
      'Every required PNG and MP4 output target exists and is non-empty.',
      'No official promotion logos, sponsor marks, broadcaster marks, venue marks, or real fighter likenesses are present.',
      'Mobile crops preserve UI title, button, and card safe areas.',
      'QVAC or human review evidence is attached before prize-mode promotion.'
    ]
  }
}

function assetJobFor ({ asset, index, tournamentId, title, provider, outputRoot, includeVideoLoops }) {
  const blueprint = MMA_ASSET_BLUEPRINTS[asset.assetType]
  if (!blueprint) throw new Error(`missing MMA asset blueprint for ${asset.assetType}`)
  const prompt = [
    `${title} ${blueprint.prompt}`,
    MMA_STYLE_TOKENS.join(', '),
    'production-ready mobile app asset',
    'leave clean negative space for dynamic UI text',
    'high contrast, polished sports broadcast finish'
  ].join(', ')
  const outputBase = `${outputRoot}/${asset.assetType}`
  const motionEligible = includeVideoLoops && ['hero-backdrop', 'server-card-cover', 'watch-room-stage', 'result-share-card'].includes(asset.assetType)

  return {
    assetId: stableId(`mma-asset-${asset.assetType}`, { tournamentId, prompt }),
    assetType: asset.assetType,
    title: blueprint.title,
    provider,
    order: index + 1,
    prompt,
    negativePrompt: blueprint.negativePrompt,
    aspectRatios: blueprint.aspectRatios.slice(),
    resolution: blueprint.resolution,
    variants: blueprint.variants.slice(),
    modelHints: HIGGSFIELD_MODEL_HINTS.stills.slice(),
    acceptance: [
      asset.acceptance,
      'no official league, promotion, sponsor, broadcaster, or fighter likeness rights are implied',
      'safe area supports mobile header, card title, and action buttons',
      'visual mood reads as premium MMA fight night without using protected marks'
    ],
    rights: {
      sourceType: 'generated-unlicensed',
      allowed: ['generic cage geometry', 'abstract gloves', 'red and blue corner colors', 'unbranded arena lighting'],
      disallowed: ['official promotion logos', 'sponsor logos', 'broadcaster marks', 'real fighter likenesses', 'readable venue names']
    },
    outputTargets: blueprint.variants.map(variant => ({
      variant,
      path: `${outputBase}/${variant}.png`,
      status: 'pending-generation'
    })),
    motionPrompt: motionEligible
      ? `6 second cinematic loop from the ${blueprint.title}: subtle arena light movement, drifting haze, slow broadcast camera push, no text, no logos, no identifiable people`
      : null,
    motionOutputTargets: motionEligible
      ? [{ variant: 'motion-loop', path: `${outputBase}/motion-loop.mp4`, status: 'pending-generation' }]
      : []
  }
}

function targetAuditFor ({ rootDir, asset, target, kind }) {
  const absolutePath = resolveTargetPath({ rootDir, targetPath: target.path })
  const exists = fs.existsSync(absolutePath)
  const stat = exists ? fs.statSync(absolutePath) : null
  const extension = path.extname(absolutePath).toLowerCase()
  const expectedExtension = kind === 'video-loop' ? '.mp4' : '.png'
  const file = {
    present: exists && stat.isFile(),
    sizeBytes: exists && stat.isFile() ? stat.size : 0,
    extension,
    expectedExtension,
    extensionOk: extension === expectedExtension
  }

  return {
    assetType: asset.assetType,
    title: asset.title,
    kind,
    variant: target.variant,
    relativePath: target.path,
    absolutePath,
    file,
    qa: {
      readyForReview: file.present && file.sizeBytes > 0 && file.extensionOk,
      rightsReviewRequired: file.present,
      cropReviewRequired: file.present && asset.aspectRatios.length > 1,
      mobileSafeAreaRequired: file.present,
      metadataRequired: file.present
    },
    blockers: [
      !file.present ? 'output file is missing' : null,
      file.present && file.sizeBytes <= 0 ? 'output file is empty' : null,
      file.present && !file.extensionOk ? `expected ${expectedExtension} output` : null
    ].filter(Boolean)
  }
}

function resolveTargetPath ({ rootDir, targetPath }) {
  if (path.isAbsolute(targetPath)) return targetPath
  return path.resolve(rootDir, targetPath)
}

function generatedAssetNextSteps ({ overallStatus, summary }) {
  if (overallStatus === 'generated-assets-ready-for-qa') {
    return [
      'Run visual QA for mobile crops, title safe areas, icon legibility, and rights guardrails.',
      'Attach prompt metadata and QVAC review evidence to each approved asset.',
      'Upload approved finals to the app asset store or CDN.'
    ]
  }
  if (overallStatus === 'partial-generated-assets') {
    return [
      `Generate the remaining ${summary.missingTargets} MMA asset outputs listed in this audit.`,
      'Re-run the audit after every Higgsfield batch download.',
      'Do not mark the asset pack ready until all missing targets are present and QA-reviewed.'
    ]
  }
  return [
    'Run the Higgsfield API generation queue and download every PNG/MP4 output target.',
    'Store generated files under platform/ultimate-sports/generated-assets/mma-card.',
    'Re-run this audit before promoting the MMA card shell beyond preview.'
  ]
}

function percent (covered, total) {
  if (total === 0) return 100
  return Math.round((covered / total) * 100)
}

function generatorForProvider (provider) {
  if (provider === 'higgsfield-api') {
    return {
      provider,
      surface: 'API',
      baseUrl: HIGGSFIELD_API_BASE_URL,
      auth: 'HIGGSFIELD_API_KEY from server-side secret manager',
      setup: [
        'Store the Higgsfield API key in the server secret manager.',
        'Set HIGGSFIELD_API_BASE_URL to the contracted raw API endpoint.',
        'Submit each queue job as an image or video generation request.',
        'Poll job status and download outputs into the listed outputTargets.'
      ]
    }
  }
  if (provider === 'higgsfield-mcp') {
    return {
      provider,
      surface: 'MCP',
      mcpUrl: HIGGSFIELD_MCP_URL,
      setup: [
        'Add the Higgsfield MCP connector URL to an MCP-compatible client.',
        'Authenticate with the Higgsfield account in the browser flow.',
        'Submit each queue job as an image or video generation request.',
        'Download outputs into the listed outputTargets.'
      ]
    }
  }
  if (provider === 'higgsfield-cli') {
    return {
      provider,
      surface: 'CLI',
      install: 'npm install -g @higgsfield/cli',
      auth: 'higgsfield auth login',
      setup: [
        'Install the CLI on the generation workstation.',
        'Run browser-based auth login.',
        'Use the generated queue prompts from this plan.',
        'Download outputs into the listed outputTargets.'
      ]
    }
  }
  return {
    provider,
    surface: 'manual',
    setup: ['Use the prompts and output targets with the selected creative tool.']
  }
}

function agentPromptFor ({ title, jobs }) {
  const lines = [
    `Generate the ${title} MMA asset pack with Higgsfield.`,
    'Use a premium non-branded MMA broadcast aesthetic: octagon-inspired cage geometry, red and blue corners, matte black arena, canvas white, gold accents.',
    'Do not include official promotion logos, sponsor marks, broadcaster marks, readable event names, or real fighter likenesses.',
    'Create every job below, preserve mobile-safe negative space, and return downloadable PNG or MP4 assets named by outputTargets.'
  ]
  jobs.forEach((job, index) => {
    lines.push(`${index + 1}. ${job.kind} ${job.assetType}: ${job.prompt}`)
  })
  return lines.join('\n')
}

function assetBlueprint (input) {
  return Object.freeze({
    title: input.title,
    aspectRatios: Object.freeze(input.aspectRatios.slice()),
    resolution: input.resolution,
    variants: Object.freeze(input.variants.slice()),
    prompt: input.prompt,
    negativePrompt: input.negativePrompt
  })
}

function apiRequirement (input) {
  return Object.freeze({
    apiId: input.apiId,
    category: input.category,
    provider: input.provider,
    purpose: input.purpose,
    auth: input.auth,
    status: input.status,
    docsUrl: input.docsUrl || null,
    env: Object.freeze((input.env || []).slice()),
    notes: Object.freeze((input.notes || []).slice())
  })
}

function createHiggsfieldRequestForJob ({ job, url, tournamentId, title }) {
  const body = {
    metadata: {
      tournamentId,
      title,
      jobId: job.jobId,
      assetType: job.assetType,
      outputTargets: job.outputTargets.map(target => cloneJson(target))
    },
    generationType: job.kind,
    prompt: job.prompt,
    negativePrompt: job.negativePrompt,
    aspectRatios: job.aspectRatios.slice(),
    modelHints: job.modelHints.slice()
  }
  if (job.kind === 'image') {
    body.resolution = job.resolution
    body.variants = job.variants.slice()
  }
  if (job.kind === 'video-loop') {
    body.durationSeconds = job.durationSeconds
  }

  return {
    requestId: stableId(`higgsfield-request-${job.jobId}`, { body }),
    jobId: job.jobId,
    assetType: job.assetType,
    kind: job.kind,
    method: 'POST',
    url,
    headers: {
      Authorization: 'Bearer [redacted]',
      'Content-Type': 'application/json'
    },
    body,
    outputTargets: job.outputTargets.map(target => cloneJson(target))
  }
}

function higgsfieldApiReadiness ({ env, createPath }) {
  const missingEnv = []
  const missingConfig = []
  if (!env.HIGGSFIELD_API_KEY) missingEnv.push('HIGGSFIELD_API_KEY')
  if (!createPath) missingConfig.push('HIGGSFIELD_API_CREATE_PATH')
  const blockers = [
    ...missingEnv.map(name => `${name} is not configured in the backend runtime`),
    ...missingConfig.map(name => `${name} is required because Higgsfield raw API endpoints are account/contract specific`)
  ]
  return {
    ready: blockers.length === 0,
    missingEnv,
    missingConfig,
    blockers
  }
}

function liveHiggsfieldHeaders (env) {
  return {
    Authorization: `Bearer ${env.HIGGSFIELD_API_KEY}`,
    'Content-Type': 'application/json'
  }
}

function joinUrl (baseUrl, pathPart) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}/${String(pathPart || '').replace(/^\/+/, '')}`
}

function parseMaybeJson (text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (_) {
    return null
  }
}

function summarizeProviderResponse (json, text) {
  if (json && typeof json === 'object') {
    return {
      keys: Object.keys(json).slice(0, 12),
      status: json.status || json.state || null,
      message: json.message || json.error || null
    }
  }
  return {
    textPreview: text ? text.slice(0, 160) : ''
  }
}

function defaultEnv () {
  return process.env
}

module.exports = {
  MMA_ASSET_PLAN_VERSION,
  MMA_GENERATED_ASSET_AUDIT_VERSION,
  MMA_HIGGSFIELD_API_REQUEST_PLAN_VERSION,
  MMA_HIGGSFIELD_API_SUBMISSION_VERSION,
  HIGGSFIELD_MCP_URL,
  HIGGSFIELD_API_BASE_URL,
  DEFAULT_OUTPUT_ROOT,
  MMA_STYLE_TOKENS,
  HIGGSFIELD_MODEL_HINTS,
  MMA_API_REQUIREMENTS,
  createMmaCardAssetPlan,
  createMmaCardHiggsfieldQueue,
  createMmaCardHiggsfieldApiRequestPlan,
  submitMmaCardHiggsfieldJobs,
  createMmaCardGeneratedAssetAudit,
  listMmaCardApiRequirements,
  validateMmaCardAssetPlan
}
