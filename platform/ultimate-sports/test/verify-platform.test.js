'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { verifyPlatform } = require('../scripts/verify-platform')

const rootDir = path.resolve(__dirname, '..')

test('platform manifest verifier passes current scaffold contract', () => {
  const report = verifyPlatform({ rootDir })

  assert.equal(report.ok, true)
  assert.equal(report.errors.length, 0)
  assert.ok(report.checked.sourceFiles >= 20)
  assert.ok(report.checked.tests >= 10)
  assert.ok(report.manifest.requiredExports.includes('platform'))
})

test('platform manifest verifier catches missing exports and scenarios', () => {
  const manifest = require('../platform.manifest.json')
  const broken = {
    ...manifest,
    requiredExports: manifest.requiredExports.concat('missingExport'),
    scenarioIds: manifest.scenarioIds.concat('missing-scenario')
  }
  const report = verifyPlatform({ rootDir, manifest: broken })

  assert.equal(report.ok, false)
  assert.ok(report.errors.some(error => error.includes('missing entrypoint export: missingExport')))
  assert.ok(report.errors.some(error => error.includes('scenario missing-scenario failed')))
})

