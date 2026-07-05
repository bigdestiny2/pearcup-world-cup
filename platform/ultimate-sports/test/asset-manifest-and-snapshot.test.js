'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const { auditFitAssets } = require('../scripts/audit-fit-assets')
const { createUltimateSportsAppSnapshot } = require('../scripts/export-app-snapshot')
const catalog = require('../src/catalog-engine')
const experience = require('../src/tournament-experience-engine')

const rootDir = path.resolve(__dirname, '..')
const requiredAssetTypes = experience.REQUIRED_ASSET_TYPES

describe('asset manifest and snapshot wiring', () => {
  it('VAL-ASSET-003: asset manifest entries exactly match files on disk', () => {
    const report = auditFitAssets()

    assert.strictEqual(report.ok, true, `audit failed: missing=${report.missing.length}, invalid=${report.invalid.length}, unmapped=${report.unmapped.length}`)
    assert.strictEqual(report.fitCount, catalog.listEventFits().length)
    assert.strictEqual(report.requiredAssetTypeCount, requiredAssetTypes.length)
    assert.strictEqual(report.expectedAssetCount, report.fitCount * report.requiredAssetTypeCount)
    assert.strictEqual(report.manifestEntryCount, report.expectedAssetCount)
    assert.strictEqual(report.missing.length, 0)
    assert.strictEqual(report.invalid.length, 0)
    assert.strictEqual(report.unmapped.length, 0)

    for (const fit of report.fits) {
      const statuses = Object.values(fit.assetTypes)
      const okCount = statuses.filter(v => v.status === 'ok').length
      assert.strictEqual(okCount, requiredAssetTypes.length, `${fit.fitId} is missing assets`)
    }
  })

  it('VAL-ASSET-007: exported snapshot includes asset paths for every fit and all asset types', () => {
    const snapshot = createUltimateSportsAppSnapshot({ rootDir, generatedAt: '2026-07-04T00:00:00.000Z' })

    assert.ok(snapshot.assets, 'snapshot has assets section')
    assert.ok(snapshot.assets.fitAssets, 'snapshot has fitAssets map')
    assert.ok(snapshot.assets.fitAssetManifest, 'snapshot has fitAssetManifest metadata')
    assert.strictEqual(snapshot.assets.fitAssetManifest.entryCount, catalog.listEventFits().length * requiredAssetTypes.length)

    for (const fit of catalog.listEventFits()) {
      const fitAssets = snapshot.assets.fitAssets[fit.fitId]
      assert.ok(fitAssets, `snapshot has fitAssets for ${fit.fitId}`)

      const shell = snapshot.tournamentShells.find(s => s.fitId === fit.fitId)
      assert.ok(shell, `snapshot has tournament shell for ${fit.fitId}`)
      assert.ok(shell.assets, `shell has assets for ${fit.fitId}`)
      assert.ok(shell.assets.assetPaths, `shell has assetPaths for ${fit.fitId}`)

      for (const assetType of requiredAssetTypes) {
        assert.ok(fitAssets[assetType], `fitAssets has ${fit.fitId}/${assetType}`)
        assert.ok(fitAssets[assetType].relativePath, `fitAssets ${fit.fitId}/${assetType} has relativePath`)
        assert.ok(fitAssets[assetType].source, `fitAssets ${fit.fitId}/${assetType} has source`)
        assert.ok(fitAssets[assetType].themeId, `fitAssets ${fit.fitId}/${assetType} has themeId`)

        assert.ok(shell.assets.assetPaths[assetType], `shell assetPaths has ${fit.fitId}/${assetType}`)
        assert.ok(shell.assets.assetPaths[assetType].relativePath, `shell assetPaths ${fit.fitId}/${assetType} has relativePath`)
      }
    }
  })

  it('VAL-ASSET-008: every snapshot asset path resolves to an existing non-empty file', () => {
    const snapshot = createUltimateSportsAppSnapshot({ rootDir, generatedAt: '2026-07-04T00:00:00.000Z' })
    let checkedCount = 0

    for (const fit of catalog.listEventFits()) {
      const fitAssets = snapshot.assets.fitAssets[fit.fitId]
      assert.ok(fitAssets, `snapshot has fitAssets for ${fit.fitId}`)

      for (const assetType of requiredAssetTypes) {
        const asset = fitAssets[assetType]
        assert.ok(asset, `snapshot has asset ${fit.fitId}/${assetType}`)

        const filePath = path.resolve(rootDir, asset.relativePath)
        assert.ok(fs.existsSync(filePath), `${fit.fitId}/${assetType} resolves to existing file: ${asset.relativePath}`)

        const stats = fs.statSync(filePath)
        assert.ok(stats.isFile(), `${fit.fitId}/${assetType} is a file`)
        assert.ok(stats.size > 0, `${fit.fitId}/${assetType} is non-empty (${stats.size} bytes)`)

        checkedCount += 1
      }
    }

    assert.strictEqual(checkedCount, catalog.listEventFits().length * requiredAssetTypes.length)
  })
})
