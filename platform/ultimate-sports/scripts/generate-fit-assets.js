#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const BIGMODEL_API_URL = 'https://open.bigmodel.cn/api/paas/v4/images/generations'
const BIGMODEL_MODEL = 'cogView-4-250304'
const BIGMODEL_IMAGE_SIZE = '1024x1024'
const BIGMODEL_IMAGE_N = 1
const GENERATION_PLAN_VERSION = 'ultimate-sports-fit-asset-generation-plan-v1'
const ASSET_MANIFEST_VERSION = 'ultimate-sports-fit-asset-manifest-v1'

const NEGATIVE_CONSTRAINTS = Object.freeze([
  'no official marks',
  'no logos',
  'no real people',
  'no copyrighted venues'
])

const RASTER_ASSET_TYPES = Object.freeze([
  'server-card-cover',
  'hero-backdrop',
  'bracket-board-skin',
  'watch-room-stage',
  'result-share-card',
  'empty-state-illustration'
])

const LOCAL_ASSET_TYPES = Object.freeze([
  'lobby-icon',
  'pool-card-accent',
  'mini-game-icon-set'
])

const REQUIRED_ASSET_TYPES = Object.freeze([
  ...RASTER_ASSET_TYPES,
  ...LOCAL_ASSET_TYPES
])

const FIT_THEME = Object.freeze({
  'world-cup': { icon: '🏆', primary: '#139b49', secondary: '#ffd447', accent: '#1b55a5' },
  'euros-copa-america': { icon: '🌍', primary: '#3b82f6', secondary: '#ef4444', accent: '#1d4ed8' },
  'champions-league-knockout': { icon: '⭐', primary: '#0ea5e9', secondary: '#f59e0b', accent: '#0369a1' },
  'march-madness': { icon: '🏀', primary: '#f97316', secondary: '#3b82f6', accent: '#c2410c' },
  'pro-playoffs': { icon: '🏆', primary: '#8b5cf6', secondary: '#f43f5e', accent: '#6d28d9' },
  'tennis-grand-slams': { icon: '🎾', primary: '#10b981', secondary: '#f59e0b', accent: '#047857' },
  'esports-major': { icon: '🎮', primary: '#ec4899', secondary: '#6366f1', accent: '#be185d' },
  'mma-boxing-fight-card': { icon: '🥊', primary: '#ef4444', secondary: '#3b82f6', accent: '#b91c1c' },
  'sailgp-companion': { icon: '⛵', primary: '#06b6d4', secondary: '#f43f5e', accent: '#0e7490' },
  'creator-reality-brackets': { icon: '⭐', primary: '#d946ef', secondary: '#22c55e', accent: '#a21caf' },
  'awards-prediction-pools': { icon: '🎬', primary: '#f59e0b', secondary: '#ec4899', accent: '#b45309' },
  'local-leagues': { icon: '⚽', primary: '#22c55e', secondary: '#3b82f6', accent: '#15803d' }
})

const RASTER_FILE_NAMES = Object.freeze({
  'server-card-cover': 'cover',
  'hero-backdrop': 'hero',
  'bracket-board-skin': 'board',
  'watch-room-stage': 'stage',
  'result-share-card': 'share',
  'empty-state-illustration': 'empty'
})

const LOCAL_FILE_NAMES = Object.freeze({
  'lobby-icon': 'icon',
  'pool-card-accent': 'accent',
  'mini-game-icon-set': 'icons'
})

function loadEngines () {
  return {
    catalog: require('../src/catalog-engine'),
    experience: require('../src/tournament-experience-engine')
  }
}

function parseArgs (argv = process.argv.slice(2)) {
  const options = {
    fitId: null,
    all: false,
    force: false,
    dryRun: false,
    outputRoot: null,
    concurrency: 3,
    retries: 3
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--fit') options.fitId = argv[++index]
    else if (arg === '--all') options.all = true
    else if (arg === '--force') options.force = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--out') options.outputRoot = argv[++index]
    else if (arg === '--concurrency') options.concurrency = Number(argv[++index]) || 3
    else if (arg === '--retries') options.retries = Number(argv[++index]) || 3
  }

  return options
}

function resolveOutputRoot (options) {
  if (options.outputRoot) return path.resolve(options.outputRoot)
  return path.resolve(__dirname, '..', 'generated-assets')
}

function selectFits (options, engines) {
  if (options.fitId) {
    const fit = engines.catalog.getEventFit(options.fitId)
    if (!fit) throw new Error(`unknown fit: ${options.fitId}`)
    return [fit]
  }
  if (options.all) return engines.catalog.listEventFits()
  return []
}

function buildGenerationPlan (fit, engines) {
  const profile = engines.experience.getExperienceProfile(fit.fitId)
  const theme = FIT_THEME[fit.fitId] || FIT_THEME['world-cup']
  const negativePrompt = NEGATIVE_CONSTRAINTS.join(', ')

  const assets = engines.experience.REQUIRED_ASSET_TYPES.map(assetType => {
    const isRaster = RASTER_ASSET_TYPES.includes(assetType)
    if (isRaster) {
      const prompt = buildRasterPrompt({ assetType, fit, profile, negativePrompt })
      return {
        assetType,
        source: 'bigmodel',
        model: BIGMODEL_MODEL,
        size: BIGMODEL_IMAGE_SIZE,
        prompt,
        negativePrompt,
        themeId: profile.serverSkin,
        palette: profile.palette.slice(),
        fileName: RASTER_FILE_NAMES[assetType]
      }
    }

    return {
      assetType,
      source: 'local',
      model: null,
      size: null,
      prompt: null,
      negativePrompt: null,
      themeId: profile.serverSkin,
      palette: profile.palette.slice(),
      fileName: LOCAL_FILE_NAMES[assetType]
    }
  })

  return {
    planVersion: GENERATION_PLAN_VERSION,
    fitId: fit.fitId,
    title: fit.title,
    category: fit.category,
    themeId: profile.serverSkin,
    visualTone: profile.visualTone,
    palette: profile.palette.slice(),
    theme: { ...theme },
    generatedAt: null,
    assets
  }
}

function buildRasterPrompt ({ assetType, fit, profile, negativePrompt }) {
  const assetName = assetType.replace(/-/g, ' ')
  const base = `${fit.title} ${assetName} for a P2P sports tournament app, ${profile.visualTone}, palette: ${profile.palette.join(', ')}, mobile-safe UI, high contrast, polished broadcast finish`
  const acceptance = 'usable across light, dark, and event-themed shells, readable mobile UI safe areas'
  return `${base}. Rights-safe constraints: ${negativePrompt}. ${acceptance}.`
}

async function generateFitAssets (fit, plan, options) {
  const fitDir = path.join(options.outputRoot, fit.fitId)
  fs.mkdirSync(fitDir, { recursive: true })

  const manifestEntries = []
  const results = []

  for (const asset of plan.assets) {
    const assetDir = path.join(fitDir, asset.assetType)
    fs.mkdirSync(assetDir, { recursive: true })

    if (asset.source === 'local') {
      const relativePath = await generateLocalAsset({ fit, asset, assetDir, options })
      manifestEntries.push({
        fitId: fit.fitId,
        assetType: asset.assetType,
        relativePath,
        source: asset.source,
        themeId: asset.themeId,
        fileName: asset.fileName
      })
      results.push({ assetType: asset.assetType, status: 'generated-local', relativePath })
      continue
    }

    results.push({ assetType: asset.assetType, status: 'queued', relativePath: null })
  }

  const rasterTasks = plan.assets
    .filter(asset => asset.source === 'bigmodel')
    .map(asset => {
      const assetDir = path.join(fitDir, asset.assetType)
      return async () => {
        const existing = findExistingRasterFile(assetDir, asset.fileName)
        if (!options.force && existing) {
          const relativePath = path.relative(options.outputRoot, existing)
          manifestEntries.push({
            fitId: fit.fitId,
            assetType: asset.assetType,
            relativePath,
            source: asset.source,
            themeId: asset.themeId,
            fileName: asset.fileName
          })
          const result = results.find(r => r.assetType === asset.assetType)
          if (result) {
            result.status = 'skipped-existing'
            result.relativePath = relativePath
          }
          return relativePath
        }

        if (options.dryRun) {
          const result = results.find(r => r.assetType === asset.assetType)
          if (result) {
            result.status = 'dry-run-skipped'
            result.relativePath = null
          }
          return null
        }

        const relativePath = await generateRasterAsset({ fit, asset, assetDir, options })
        manifestEntries.push({
          fitId: fit.fitId,
          assetType: asset.assetType,
          relativePath,
          source: asset.source,
          themeId: asset.themeId,
          fileName: asset.fileName
        })
        const result = results.find(r => r.assetType === asset.assetType)
        if (result) {
          result.status = relativePath ? 'generated-raster' : 'failed'
          result.relativePath = relativePath
        }
        return relativePath
      }
    })

  await withConcurrency(rasterTasks, options.concurrency)

  return { plan, manifestEntries, results }
}

async function generateLocalAsset ({ fit, asset, assetDir, options }) {
  const fileName = `${asset.fileName}.svg`
  const filePath = path.join(assetDir, fileName)
  const relativePath = path.relative(options.outputRoot, filePath)

  if (!options.force && fs.existsSync(filePath)) {
    return relativePath
  }

  const profile = loadEngines().experience.getExperienceProfile(fit.fitId)
  const svg = LOCAL_SVG_GENERATORS[asset.assetType]({ fit, asset, profile })
  fs.writeFileSync(filePath, svg)
  return relativePath
}

async function generateRasterAsset ({ fit, asset, assetDir, options }) {
  const filePath = path.join(assetDir, `${asset.fileName}.tmp`)
  const relativePath = path.relative(options.outputRoot, filePath)

  const existing = findExistingRasterFile(assetDir, asset.fileName)
  if (!options.force && existing) {
    if (options.verbose) console.error(`  [skip] ${fit.fitId}/${asset.assetType} exists: ${existing}`)
    return path.relative(options.outputRoot, existing)
  }

  if (options.dryRun) {
    console.error(`  [dry-run] ${fit.fitId}/${asset.assetType}: would request ${BIGMODEL_MODEL}`)
    return null
  }

  const apiKey = options.apiKey || process.env.BIGMODEL_API_KEY
  if (!apiKey) throw new Error('BIGMODEL_API_KEY is not set')

  const imageUrl = await callBigModel({ prompt: asset.prompt, apiKey, retries: options.retries })
  const { buffer, ext } = await downloadImage(imageUrl, options.retries)
  const finalFileName = `${asset.fileName}.${ext}`
  const finalFilePath = path.join(assetDir, finalFileName)

  fs.writeFileSync(finalFilePath, buffer)

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  return path.relative(options.outputRoot, finalFilePath)
}

function findExistingRasterFile (assetDir, fileName) {
  for (const ext of ['png', 'jpg', 'jpeg']) {
    const candidate = path.join(assetDir, `${fileName}.${ext}`)
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

async function callBigModel ({ prompt, apiKey, retries }) {
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(BIGMODEL_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: BIGMODEL_MODEL,
          prompt,
          size: BIGMODEL_IMAGE_SIZE,
          n: BIGMODEL_IMAGE_N
        })
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`BigModel HTTP ${response.status}: ${text.slice(0, 200)}`)
      }

      const json = await response.json()
      const url = json && json.data && json.data[0] && json.data[0].url
      if (!url) throw new Error('BigModel response did not contain an image URL')
      return url
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 16000)
        console.error(`  [retry] BigModel attempt ${attempt + 1} failed (${error.message || error}), waiting ${delay}ms`)
        await sleep(delay)
        continue
      }
      throw lastError
    }
  }
  throw lastError
}

async function downloadImage (url, retries = 3) {
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Download failed: HTTP ${response.status} for ${url}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const ext = extensionFromMagic(buffer)
      return { buffer, ext }
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        const delay = 500 * Math.pow(2, attempt)
        console.error(`  [retry] download attempt ${attempt + 1} failed, waiting ${delay}ms`)
        await sleep(delay)
        continue
      }
      throw lastError
    }
  }
  throw lastError
}

function extensionFromMagic (buffer) {
  if (buffer.length < 8) return 'bin'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg'
  return 'bin'
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withConcurrency (tasks, concurrency) {
  const results = new Array(tasks.length)
  let index = 0

  async function worker () {
    while (index < tasks.length) {
      const currentIndex = index++
      results[currentIndex] = await tasks[currentIndex]()
    }
  }

  const workers = []
  for (let i = 0; i < Math.min(concurrency, tasks.length); i += 1) {
    workers.push(worker())
  }
  await Promise.all(workers)
  return results
}

function writeMetadata ({ outputRoot, generationPlans, manifestEntries, generatedAt }) {
  const planPath = path.join(outputRoot, '_generation-plan.json')
  const manifestPath = path.join(outputRoot, '_asset-manifest.json')

  const plansWithTimestamp = generationPlans.map(plan => ({ ...plan, generatedAt }))

  fs.writeFileSync(planPath, JSON.stringify({
    planVersion: GENERATION_PLAN_VERSION,
    generatedAt,
    model: BIGMODEL_MODEL,
    imageSize: BIGMODEL_IMAGE_SIZE,
    negativeConstraints: NEGATIVE_CONSTRAINTS.slice(),
    fits: plansWithTimestamp
  }, null, 2))

  fs.writeFileSync(manifestPath, JSON.stringify({
    manifestVersion: ASSET_MANIFEST_VERSION,
    generatedAt,
    entryCount: manifestEntries.length,
    entries: manifestEntries
  }, null, 2))

  return { planPath, manifestPath }
}

function printUsage () {
  console.error(`Usage: node scripts/generate-fit-assets.js [--fit <fitId> | --all] [options]

Options:
  --fit <fitId>       Generate assets for a single fit.
  --all               Generate assets for all catalog fits.
  --force             Regenerate assets even if they already exist.
  --dry-run           Build plans and local assets without calling BigModel.
  --out <dir>         Write outputs to a custom directory.
  --concurrency <n>   BigModel request concurrency (default: 3).
  --retries <n>       Retry count for BigModel requests (default: 3).`)
}

async function main (argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  options.outputRoot = resolveOutputRoot(options)

  if (!options.fitId && !options.all) {
    printUsage()
    process.exitCode = 1
    return
  }

  if (!process.env.BIGMODEL_API_KEY && !options.dryRun) {
    console.error('Error: BIGMODEL_API_KEY environment variable is required. Use --dry-run to skip BigModel calls.')
    process.exitCode = 1
    return
  }

  const engines = loadEngines()
  const fits = selectFits(options, engines)
  if (fits.length === 0) {
    console.error('Error: no fits selected.')
    process.exitCode = 1
    return
  }

  fs.mkdirSync(options.outputRoot, { recursive: true })

  const generationPlans = []
  const allManifestEntries = []
  const generatedAt = new Date().toISOString()

  console.error(`Generating assets for ${fits.length} fit(s) -> ${options.outputRoot}`)
  console.error(`Mode: ${options.dryRun ? 'dry-run' : 'live'}${options.force ? ', force' : ''}, concurrency: ${options.concurrency}`)

  for (const fit of fits) {
    const plan = buildGenerationPlan(fit, engines)
    console.error(`\n[${fit.fitId}] ${fit.title}`)
    const { manifestEntries, results } = await generateFitAssets(fit, plan, options)
    generationPlans.push(plan)
    allManifestEntries.push(...manifestEntries)

    for (const result of results) {
      const label = result.status === 'generated-raster'
        ? '[raster]'
        : result.status === 'generated-local'
          ? '[local]'
          : result.status === 'skipped-existing'
            ? '[exists]'
            : result.status === 'dry-run-skipped'
              ? '[dry-run]'
              : `[${result.status}]`
      console.error(`  ${label} ${result.assetType}${result.relativePath ? ' -> ' + result.relativePath : ''}`)
    }
  }

  const { planPath, manifestPath } = writeMetadata({
    outputRoot: options.outputRoot,
    generationPlans,
    manifestEntries: allManifestEntries,
    generatedAt
  })

  console.error(`\nWrote generation plan: ${planPath}`)
  console.error(`Wrote asset manifest: ${manifestPath}`)
  console.error(`Total manifest entries: ${allManifestEntries.length}`)

  return {
    generatedAt,
    outputRoot: options.outputRoot,
    fitCount: fits.length,
    assetCount: allManifestEntries.length,
    planPath,
    manifestPath
  }
}

const LOCAL_SVG_GENERATORS = {
  'lobby-icon': generateLobbyIconSvg,
  'pool-card-accent': generatePoolCardAccentSvg,
  'mini-game-icon-set': generateMiniGameIconSetSvg
}

function generateLobbyIconSvg ({ fit, asset, profile }) {
  const theme = FIT_THEME[fit.fitId] || FIT_THEME['world-cup']
  const palette = profile.palette.slice()
  const cssVars = buildPaletteCssVars(palette, theme)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" data-fit-id="${escapeXml(fit.fitId)}" data-asset-type="${asset.assetType}" data-palette="${escapeXml(palette.join(', '))}" data-theme-primary="${theme.primary}">
  <defs>
    <style>
      :root {
${cssVars}
      }
    </style>
    <linearGradient id="lobbyGrad-${fit.fitId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="var(--fit-palette-0, ${theme.primary})" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="var(--fit-palette-2, ${theme.accent})" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="var(--fit-palette-1, ${theme.secondary})" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#lobbyGrad-${fit.fitId})"/>
  <circle cx="384" cy="128" r="96" fill="#ffffff" opacity="0.10"/>
  <circle cx="128" cy="384" r="72" fill="#ffffff" opacity="0.08"/>
  <text x="256" y="340" font-size="220" text-anchor="middle" font-family="Arial, sans-serif" dominant-baseline="middle">${theme.icon}</text>
</svg>`
}

function generatePoolCardAccentSvg ({ fit, asset, profile }) {
  const theme = FIT_THEME[fit.fitId] || FIT_THEME['world-cup']
  const palette = profile.palette.slice()
  const cssVars = buildPaletteCssVars(palette, theme)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 600" width="1800" height="600" data-fit-id="${escapeXml(fit.fitId)}" data-asset-type="${asset.assetType}" data-palette="${escapeXml(palette.join(', '))}" data-theme-primary="${theme.primary}">
  <defs>
    <style>
      :root {
${cssVars}
      }
    </style>
    <linearGradient id="accentGrad-${fit.fitId}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="var(--fit-palette-0, ${theme.primary})" stop-opacity="0.95"/>
      <stop offset="50%" stop-color="var(--fit-palette-2, ${theme.accent})" stop-opacity="0.90"/>
      <stop offset="100%" stop-color="var(--fit-palette-1, ${theme.secondary})" stop-opacity="0.85"/>
    </linearGradient>
    <clipPath id="accentClip-${fit.fitId}">
      <rect width="1800" height="600" rx="48"/>
    </clipPath>
  </defs>
  <g clip-path="url(#accentClip-${fit.fitId})">
    <rect width="1800" height="600" fill="url(#accentGrad-${fit.fitId})"/>
    <circle cx="1600" cy="100" r="240" fill="#ffffff" opacity="0.08"/>
    <circle cx="160" cy="520" r="180" fill="#ffffff" opacity="0.06"/>
    <rect x="1400" y="120" width="120" height="120" rx="24" fill="#ffffff" opacity="0.14"/>
    <rect x="1580" y="360" width="80" height="80" rx="16" fill="#ffffff" opacity="0.12"/>
  </g>
</svg>`
}

function generateMiniGameIconSetSvg ({ fit, asset, profile }) {
  const theme = FIT_THEME[fit.fitId] || FIT_THEME['world-cup']
  const palette = profile.palette.slice()
  const cssVars = buildPaletteCssVars(palette, theme)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" data-fit-id="${escapeXml(fit.fitId)}" data-asset-type="${asset.assetType}" data-palette="${escapeXml(palette.join(', '))}" data-theme-primary="${theme.primary}">
  <defs>
    <style>
      :root {
${cssVars}
      }
    </style>
    <linearGradient id="iconSetGrad-${fit.fitId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="var(--fit-palette-0, ${theme.primary})" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="var(--fit-palette-2, ${theme.accent})" stop-opacity="0.12"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="160" fill="url(#iconSetGrad-${fit.fitId})"/>
  <g fill="none" stroke-width="48" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="288" cy="288" r="96" stroke="var(--fit-palette-0, ${theme.primary})" opacity="0.95"/>
    <rect x="672" y="192" width="192" height="192" rx="48" stroke="var(--fit-palette-2, ${theme.accent})" opacity="0.95"/>
    <path d="M192 736 L288 640 L384 736 L288 832 Z" stroke="var(--fit-palette-1, ${theme.secondary})" opacity="0.95"/>
    <path d="M672 672 L864 864 M864 672 L672 864" stroke="var(--fit-palette-0, ${theme.primary})" opacity="0.95"/>
  </g>
</svg>`
}

function buildPaletteCssVars (palette, theme) {
  const colors = [theme.primary, theme.secondary, theme.accent]
  return palette.map((token, index) => {
    const color = colors[index % colors.length]
    return `        --fit-palette-${index}: ${color}; /* ${escapeXml(token)} */`
  }).join('\n')
}

function escapeXml (text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

module.exports = {
  parseArgs,
  buildGenerationPlan,
  generateLocalAsset,
  generateRasterAsset,
  RASTER_ASSET_TYPES,
  LOCAL_ASSET_TYPES,
  REQUIRED_ASSET_TYPES,
  NEGATIVE_CONSTRAINTS,
  FIT_THEME,
  main
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message || error)
    process.exitCode = 1
  })
}
