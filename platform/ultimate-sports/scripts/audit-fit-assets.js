#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const ENGINES = {
  catalog: require('../src/catalog-engine'),
  experience: require('../src/tournament-experience-engine')
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

function auditFitAssets (input = {}) {
  const outputRoot = input.outputRoot || resolveOutputRoot()
  const fits = ENGINES.catalog.listEventFits()
  const requiredAssetTypes = ENGINES.experience.REQUIRED_ASSET_TYPES
  const manifestPath = input.manifestPath || path.join(outputRoot, '_asset-manifest.json')
  const manifest = input.manifest
    ? input.manifest
    : (fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { entries: [] })

  const report = {
    auditVersion: 'ultimate-sports-fit-asset-audit-v1',
    generatedAt: input.generatedAt || new Date().toISOString(),
    outputRoot,
    fitCount: fits.length,
    requiredAssetTypeCount: requiredAssetTypes.length,
    expectedAssetCount: fits.length * requiredAssetTypes.length,
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
    for (const assetType of requiredAssetTypes) {
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

function writeReport (outFile, report) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`)
  return outFile
}

function printReport (report, outFile) {
  console.log(`Fit asset audit: ${report.fitCount} fits, ${report.requiredAssetTypeCount} required types each`)
  console.log(`Expected assets: ${report.expectedAssetCount}`)
  console.log(`Manifest entries: ${report.manifestEntryCount}`)
  console.log(`Missing: ${report.missing.length}`)
  console.log(`Invalid: ${report.invalid.length}`)
  console.log(`Unmapped: ${report.unmapped.length}`)
  console.log(`Report: ${outFile}`)

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

function parseArgs (argv = process.argv.slice(2)) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--out-dir') options.outDir = argv[++index]
    else if (item === '--json') options.json = argv[++index]
    else if (item === '--generated-at') options.generatedAt = argv[++index]
  }
  return options
}

if (require.main === module) {
  const options = parseArgs()
  const report = auditFitAssets({
    outputRoot: options.outDir ? path.resolve(options.outDir) : undefined,
    generatedAt: options.generatedAt
  })
  const outDir = path.resolve(options.outDir || 'platform/ultimate-sports/generated-reports')
  const outFile = path.resolve(options.json || path.join(outDir, 'fit-assets-audit.json'))
  writeReport(outFile, report)
  printReport(report, outFile)
}

module.exports = { auditFitAssets }
