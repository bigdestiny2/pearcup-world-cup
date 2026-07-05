#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const REQUIRED_ASSET_TYPES = Object.freeze([
  'lobby-icon',
  'server-card-cover',
  'hero-backdrop',
  'bracket-board-skin',
  'pool-card-accent',
  'mini-game-icon-set',
  'watch-room-stage',
  'result-share-card',
  'empty-state-illustration'
])

function loadEngines () {
  return {
    catalog: require('../src/catalog-engine'),
    experience: require('../src/tournament-experience-engine')
  }
}

function resolveOutputRoot () {
  return path.resolve(__dirname, '..', 'generated-assets')
}

function isValidMagicBytes (filePath) {
  const buffer = fs.readFileSync(filePath).slice(0, 8)
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.svg') {
    const head = buffer.toString('utf8').trimStart()
    return head.startsWith('<?xml') || head.startsWith('<svg')
  }
  if (ext === '.png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  return false
}

function auditFitAssets () {
  const engines = loadEngines()
  const outputRoot = resolveOutputRoot()
  const fits = engines.catalog.listEventFits()
  const manifestPath = path.join(outputRoot, '_asset-manifest.json')
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : { entries: [] }

  const report = {
    fitCount: fits.length,
    requiredAssetTypeCount: REQUIRED_ASSET_TYPES.length,
    expectedAssetCount: fits.length * REQUIRED_ASSET_TYPES.length,
    manifestEntryCount: manifest.entries.length,
    fits: [],
    missing: [],
    invalid: [],
    unmapped: [],
    ok: true
  }

  const manifestByKey = new Map()
  for (const entry of manifest.entries) {
    const key = `${entry.fitId}/${entry.assetType}`
    manifestByKey.set(key, entry)
  }

  const requiredKeys = new Set()
  for (const fit of fits) {
    const fitReport = { fitId: fit.fitId, title: fit.title, assetTypes: {} }
    for (const assetType of REQUIRED_ASSET_TYPES) {
      const key = `${fit.fitId}/${assetType}`
      requiredKeys.add(key)
      const entry = manifestByKey.get(key)
      if (!entry) {
        report.missing.push({ fitId: fit.fitId, assetType })
        fitReport.assetTypes[assetType] = { status: 'missing-manifest' }
        report.ok = false
        continue
      }

      const filePath = path.join(outputRoot, entry.relativePath)
      if (!fs.existsSync(filePath)) {
        report.missing.push({ fitId: fit.fitId, assetType, relativePath: entry.relativePath })
        fitReport.assetTypes[assetType] = { status: 'missing-file', relativePath: entry.relativePath }
        report.ok = false
        continue
      }

      const size = fs.statSync(filePath).size
      if (size === 0) {
        report.invalid.push({ fitId: fit.fitId, assetType, relativePath: entry.relativePath, reason: 'empty' })
        fitReport.assetTypes[assetType] = { status: 'empty', relativePath: entry.relativePath }
        report.ok = false
        continue
      }

      if (!isValidMagicBytes(filePath)) {
        report.invalid.push({ fitId: fit.fitId, assetType, relativePath: entry.relativePath, reason: 'bad-magic' })
        fitReport.assetTypes[assetType] = { status: 'bad-magic', relativePath: entry.relativePath }
        report.ok = false
        continue
      }

      fitReport.assetTypes[assetType] = { status: 'ok', relativePath: entry.relativePath, size }
    }
    report.fits.push(fitReport)
  }

  for (const entry of manifest.entries) {
    const key = `${entry.fitId}/${entry.assetType}`
    if (!requiredKeys.has(key)) {
      report.unmapped.push({ fitId: entry.fitId, assetType: entry.assetType, relativePath: entry.relativePath })
      report.ok = false
    }
  }

  return report
}

function printReport (report) {
  console.log(`Fit asset audit: ${report.fitCount} fits, ${report.requiredAssetTypeCount} required types each`)
  console.log(`Expected assets: ${report.expectedAssetCount}`)
  console.log(`Manifest entries: ${report.manifestEntryCount}`)
  console.log(`Missing: ${report.missing.length}`)
  console.log(`Invalid: ${report.invalid.length}`)
  console.log(`Unmapped: ${report.unmapped.length}`)

  for (const fit of report.fits) {
    const statuses = Object.entries(fit.assetTypes)
    const okCount = statuses.filter(([, v]) => v.status === 'ok').length
    console.log(`  ${fit.fitId}: ${okCount}/${statuses.length} ok`)
  }

  if (!report.ok) {
    console.error('\nAudit failed.')
    process.exitCode = 1
    return
  }
  console.log('\nAudit passed: all fits have complete, valid asset packs.')
}

if (require.main === module) {
  const report = auditFitAssets()
  printReport(report)
}

module.exports = { auditFitAssets, REQUIRED_ASSET_TYPES }
