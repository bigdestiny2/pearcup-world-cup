'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const { auditFitAssets } = require('../scripts/audit-fit-assets')
const catalog = require('../src/catalog-engine')
const experience = require('../src/tournament-experience-engine')

const REQUIRED_ASSET_TYPES = experience.REQUIRED_ASSET_TYPES
const SVG_BYTES = Buffer.from('<?xml version="1.0"?><svg/>')

function makeManifest (overrides = {}) {
  const entries = []
  for (const fit of catalog.listEventFits()) {
    for (const assetType of REQUIRED_ASSET_TYPES) {
      entries.push({
        fitId: fit.fitId,
        assetType,
        relativePath: `${fit.fitId}/${assetType}/asset.svg`,
        source: 'local',
        themeId: 'test-theme'
      })
    }
  }
  if (overrides.extra) entries.push(...overrides.extra)
  if (overrides.omit) {
    const omitKeys = new Set(overrides.omit.map(o => `${o.fitId}/${o.assetType}`))
    return { entries: entries.filter(e => !omitKeys.has(`${e.fitId}/${e.assetType}`)) }
  }
  return { entries }
}

function writeAssets (outputRoot, manifest, mutate = () => {}) {
  for (const entry of manifest.entries) {
    const filePath = path.join(outputRoot, entry.relativePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    let content = SVG_BYTES
    content = mutate(entry, content) || content
    fs.writeFileSync(filePath, content)
  }
}

describe('audit-fit-assets', () => {
  it('passes with the complete generated-assets tree', () => {
    const report = auditFitAssets()

    assert.strictEqual(report.fitCount, 12)
    assert.strictEqual(report.requiredAssetTypeCount, 9)
    assert.strictEqual(report.expectedAssetCount, 108)
    assert.strictEqual(report.ok, true)
    assert.strictEqual(report.missing.length, 0)
    assert.strictEqual(report.invalid.length, 0)
    assert.strictEqual(report.unmapped.length, 0)

    for (const fit of report.fits) {
      const okCount = Object.values(fit.assetTypes).filter(v => v.status === 'ok').length
      assert.strictEqual(okCount, REQUIRED_ASSET_TYPES.length, `${fit.fitId} missing assets`)
    }
  })

  it('reports missing manifest entries', () => {
    const report = auditFitAssets({
      manifest: makeManifest({ omit: [{ fitId: 'world-cup', assetType: 'hero-backdrop' }] })
    })

    assert.strictEqual(report.ok, false)
    assert.ok(report.missing.some(item => item.fitId === 'world-cup' && item.assetType === 'hero-backdrop'))
  })

  it('reports missing files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-asset-audit-missing-'))
    const manifest = makeManifest()
    try {
      // Create every asset except the target.
      for (const entry of manifest.entries) {
        if (entry.fitId === 'world-cup' && entry.assetType === 'hero-backdrop') continue
        const filePath = path.join(tmpDir, entry.relativePath)
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, SVG_BYTES)
      }

      const report = auditFitAssets({ outputRoot: tmpDir, manifest })
      assert.strictEqual(report.ok, false)
      assert.ok(report.missing.some(item => item.fitId === 'world-cup' && item.assetType === 'hero-backdrop' && item.relativePath))
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('reports empty files as invalid', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-asset-audit-empty-'))
    const manifest = makeManifest()
    try {
      writeAssets(tmpDir, manifest, (entry, content) => {
        if (entry.fitId === 'march-madness' && entry.assetType === 'lobby-icon') {
          return Buffer.alloc(0)
        }
        return content
      })

      const report = auditFitAssets({ outputRoot: tmpDir, manifest })
      assert.strictEqual(report.ok, false)
      assert.ok(report.invalid.some(item => item.fitId === 'march-madness' && item.assetType === 'lobby-icon' && item.reason === 'empty'))
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('reports bad magic bytes as invalid', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-asset-audit-bad-magic-'))
    const manifest = makeManifest()
    try {
      writeAssets(tmpDir, manifest, (entry, content) => {
        if (entry.fitId === 'mma-boxing-fight-card' && entry.assetType === 'server-card-cover') {
          return Buffer.from('this is not an image')
        }
        return content
      })

      const report = auditFitAssets({ outputRoot: tmpDir, manifest })
      assert.strictEqual(report.ok, false)
      assert.ok(report.invalid.some(item => item.fitId === 'mma-boxing-fight-card' && item.assetType === 'server-card-cover' && item.reason === 'bad-magic'))
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('reports unmapped manifest entries', () => {
    const report = auditFitAssets({
      manifest: makeManifest({
        extra: [{
          fitId: 'unknown-fit',
          assetType: 'lobby-icon',
          relativePath: 'unknown-fit/lobby-icon/icon.svg',
          source: 'local',
          themeId: 'test-theme'
        }]
      })
    })

    assert.strictEqual(report.ok, false)
    assert.ok(report.unmapped.some(item => item.fitId === 'unknown-fit' && item.assetType === 'lobby-icon'))
  })
})
