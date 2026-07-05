'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')

const {
  parseArgs,
  buildGenerationPlan,
  generateLocalAsset,
  RASTER_ASSET_TYPES,
  LOCAL_ASSET_TYPES,
  REQUIRED_ASSET_TYPES,
  NEGATIVE_CONSTRAINTS
} = require('../scripts/generate-fit-assets')

const catalog = require('../src/catalog-engine')
const experience = require('../src/tournament-experience-engine')

const engines = { catalog, experience }

describe('generate-fit-assets', () => {
  it('parseArgs handles --fit, --all, --force, --dry-run, --out, --concurrency, --retries', () => {
    const options = parseArgs([
      '--fit', 'world-cup',
      '--all',
      '--force',
      '--dry-run',
      '--out', '/tmp/fit-assets',
      '--concurrency', '5',
      '--retries', '7'
    ])
    assert.strictEqual(options.fitId, 'world-cup')
    assert.strictEqual(options.all, true)
    assert.strictEqual(options.force, true)
    assert.strictEqual(options.dryRun, true)
    assert.strictEqual(options.outputRoot, '/tmp/fit-assets')
    assert.strictEqual(options.concurrency, 5)
    assert.strictEqual(options.retries, 7)
  })

  it('parseArgs returns defaults when no flags are passed', () => {
    const options = parseArgs([])
    assert.strictEqual(options.fitId, null)
    assert.strictEqual(options.all, false)
    assert.strictEqual(options.force, false)
    assert.strictEqual(options.dryRun, false)
    assert.strictEqual(options.outputRoot, null)
    assert.strictEqual(options.concurrency, 3)
    assert.strictEqual(options.retries, 3)
  })

  it('buildGenerationPlan covers all 9 required asset types for every catalog fit', () => {
    const fits = catalog.listEventFits()
    assert.strictEqual(fits.length, 12)

    for (const fit of fits) {
      const plan = buildGenerationPlan(fit, engines)
      assert.strictEqual(plan.fitId, fit.fitId)
      assert.ok(plan.themeId)
      assert.ok(Array.isArray(plan.palette))
      assert.strictEqual(plan.assets.length, REQUIRED_ASSET_TYPES.length)

      const assetTypes = new Set(plan.assets.map(a => a.assetType))
      for (const requiredType of REQUIRED_ASSET_TYPES) {
        assert.ok(assetTypes.has(requiredType), `${fit.fitId} missing ${requiredType}`)
      }
    }
  })

  it('raster asset prompts include all rights-safety negative constraints', () => {
    const fits = catalog.listEventFits()
    for (const fit of fits) {
      const plan = buildGenerationPlan(fit, engines)
      const rasterAssets = plan.assets.filter(a => RASTER_ASSET_TYPES.includes(a.assetType))
      assert.strictEqual(rasterAssets.length, RASTER_ASSET_TYPES.length)

      for (const asset of rasterAssets) {
        const prompt = asset.prompt || ''
        const negativePrompt = asset.negativePrompt || ''
        for (const phrase of NEGATIVE_CONSTRAINTS) {
          assert.ok(
            prompt.includes(phrase),
            `${fit.fitId}/${asset.assetType} prompt missing "${phrase}"`
          )
          assert.ok(
            negativePrompt.includes(phrase),
            `${fit.fitId}/${asset.assetType} negativePrompt missing "${phrase}"`
          )
        }
      }
    }
  })

  it('local icon assets are deterministic across regeneration and reference the fit theme palette', async () => {
    const fits = catalog.listEventFits()
    assert.strictEqual(fits.length, 12)

    const tmpOne = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-assets-one-'))
    const tmpTwo = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-assets-two-'))

    try {
      for (const fit of fits) {
        const plan = buildGenerationPlan(fit, engines)
        const profile = experience.getExperienceProfile(fit.fitId)

        for (const assetType of LOCAL_ASSET_TYPES) {
          const asset = plan.assets.find(a => a.assetType === assetType)
          assert.ok(asset, `missing local asset plan for ${fit.fitId}/${assetType}`)

          const assetDirOne = path.join(tmpOne, fit.fitId, assetType)
          const assetDirTwo = path.join(tmpTwo, fit.fitId, assetType)
          fs.mkdirSync(assetDirOne, { recursive: true })
          fs.mkdirSync(assetDirTwo, { recursive: true })

          const relOne = await generateLocalAsset({
            fit,
            asset,
            assetDir: assetDirOne,
            options: { outputRoot: tmpOne, force: true }
          })
          const relTwo = await generateLocalAsset({
            fit,
            asset,
            assetDir: assetDirTwo,
            options: { outputRoot: tmpTwo, force: true }
          })

          const fileOne = path.join(tmpOne, relOne)
          const fileTwo = path.join(tmpTwo, relTwo)
          const bufOne = fs.readFileSync(fileOne)
          const bufTwo = fs.readFileSync(fileTwo)

          assert.strictEqual(bufOne.length, bufTwo.length, `${fit.fitId}/${assetType} length differs`)
          assert.strictEqual(
            crypto.createHash('sha256').update(bufOne).digest('hex'),
            crypto.createHash('sha256').update(bufTwo).digest('hex'),
            `${fit.fitId}/${assetType} checksum differs across regeneration`
          )

          const text = bufOne.toString('utf8')
          assert.ok(text.startsWith('<?xml') || text.startsWith('<svg'), `${fit.fitId}/${assetType} is not SVG`)
          assert.ok(text.includes(`data-fit-id="${fit.fitId}"`), `${fit.fitId}/${assetType} missing fit id`)
          assert.ok(text.includes('data-palette='), `${fit.fitId}/${assetType} missing palette attribute`)

          for (const token of profile.palette) {
            assert.ok(
              text.includes(token) || text.includes('--fit-palette-'),
              `${fit.fitId}/${assetType} does not reference palette token ${token}`
            )
          }
        }
      }
    } finally {
      fs.rmSync(tmpOne, { recursive: true, force: true })
      fs.rmSync(tmpTwo, { recursive: true, force: true })
    }
  })

  it('buildGenerationPlan marks raster assets as bigmodel and local assets as local', () => {
    const fits = catalog.listEventFits()
    for (const fit of fits) {
      const plan = buildGenerationPlan(fit, engines)
      for (const asset of plan.assets) {
        if (RASTER_ASSET_TYPES.includes(asset.assetType)) {
          assert.strictEqual(asset.source, 'bigmodel')
          assert.strictEqual(asset.model, 'cogView-4-250304')
        } else if (LOCAL_ASSET_TYPES.includes(asset.assetType)) {
          assert.strictEqual(asset.source, 'local')
          assert.strictEqual(asset.model, null)
        } else {
          assert.fail(`unexpected asset type ${asset.assetType}`)
        }
      }
    }
  })
})
