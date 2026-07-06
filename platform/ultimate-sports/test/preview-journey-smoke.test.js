'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const previewSmoke = require('../scripts/preview-journey-smoke')

const rootDir = path.resolve(__dirname, '..')

test('preview journey smoke starts the isolated app and validates every standup surface', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultimate-preview-smoke-'))
  const outFile = path.join(tempDir, 'preview-journey-smoke.json')
  const report = await previewSmoke.runUltimateSportsPreviewJourneySmoke({
    rootDir,
    generatedAt: '2026-07-04T00:00:00.000Z',
    outFile
  })
  const saved = JSON.parse(fs.readFileSync(outFile, 'utf8'))
  const checks = new Map(report.checks.map(check => [check.checkId, check]))

  assert.equal(report.reportVersion, previewSmoke.REPORT_VERSION)
  assert.equal(report.overallStatus, 'passed')
  assert.equal(saved.overallStatus, 'passed')
  assert.equal(report.summary.failedChecks, 0)
  assert.equal(report.summary.fileChecks, 5)
  assert.equal(report.summary.journeyChecks, 10)
  assert.equal(report.summary.coveragePercent >= 90, true)
  assert.equal(checks.get('api:live-demo-state').status, 'passed')
  assert.equal(checks.get('journey:live-demo').status, 'passed')
  assert.equal(checks.get('journey:fit-readiness').status, 'passed')
  assert.equal(checks.get('journey:aggregator').status, 'passed')
  assert.equal(checks.get('journey:mma-card').status, 'passed')
  assert.equal(checks.get('journey:sailgp').status, 'passed')
  assert.equal(checks.get('journey:grind-list').status, 'passed')
  assert.equal(checks.get('journey:tournament-lobby').status, 'passed')
  assert.equal(checks.get('journey:surface-browser').status, 'passed')
})

test('preview journey smoke parser supports served URLs and deterministic output', () => {
  assert.deepEqual(previewSmoke.parseArgs([
    '--url',
    'http://127.0.0.1:4197',
    '--out-dir',
    '/tmp/ultimate-preview',
    '--json',
    '/tmp/ultimate-preview/report.json',
    '--generated-at',
    '2026-07-04T00:00:00.000Z',
    '--timeout-ms',
    '1234',
    '--no-fail'
  ]), {
    url: 'http://127.0.0.1:4197',
    outDir: '/tmp/ultimate-preview',
    json: '/tmp/ultimate-preview/report.json',
    generatedAt: '2026-07-04T00:00:00.000Z',
    timeoutMs: 1234,
    fail: false
  })
})
