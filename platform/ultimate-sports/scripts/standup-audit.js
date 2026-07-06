#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const {
  createUltimateSportsStandupAudit,
  renderStandupAuditHtml,
  renderGrindBacklogMarkdown
} = require('../src/standup-audit-engine')

function main (argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const outDir = path.resolve(options.outDir || 'platform/ultimate-sports/generated-reports')
  const audit = createUltimateSportsStandupAudit({
    generatedAt: options.generatedAt
  })
  const jsonPath = path.resolve(options.json || path.join(outDir, 'standup-audit.json'))
  const htmlPath = path.resolve(options.html || path.join(outDir, 'standup-audit.html'))
  const backlogPath = path.resolve(options.backlog || path.join(outDir, 'standup-grind-backlog.md'))

  fs.mkdirSync(path.dirname(jsonPath), { recursive: true })
  fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`)

  if (options.html !== false) {
    fs.mkdirSync(path.dirname(htmlPath), { recursive: true })
    fs.writeFileSync(htmlPath, `${renderStandupAuditHtml(audit)}\n`)
  }
  if (options.backlog !== false) {
    fs.mkdirSync(path.dirname(backlogPath), { recursive: true })
    fs.writeFileSync(backlogPath, renderGrindBacklogMarkdown(audit))
  }

  process.stdout.write(`Ultimate sports standup audit generated\n`)
  process.stdout.write(`JSON: ${jsonPath}\n`)
  if (options.html !== false) process.stdout.write(`HTML: ${htmlPath}\n`)
  if (options.backlog !== false) process.stdout.write(`Backlog: ${backlogPath}\n`)
  process.stdout.write(`Coverage: ${audit.summary.coveragePercent}% (${audit.status})\n`)
  process.stdout.write(`Launch readiness: ${audit.launchReadiness.summary.currentLevelId}`)
  if (audit.launchReadiness.summary.nextBlockedGateId) {
    process.stdout.write(`; next blocked: ${audit.launchReadiness.summary.nextBlockedGateId}`)
  }
  process.stdout.write(`\n`)
  process.stdout.write(`Fit readiness: ${audit.fitReadiness.summary.fullyReadyFitCount} no-blocker; ${audit.fitReadiness.summary.providerBlockedFitCount} provider-blocked; ${audit.fitReadiness.summary.qvacLocalReadyCount} QVAC-local\n`)
  process.stdout.write(`Open grind items: ${audit.summary.topGapCount}\n`)
  process.stdout.write(`Backlog tickets: ${audit.summary.backlogTicketCount}\n`)
}

function parseArgs (argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--out-dir') options.outDir = argv[++index]
    else if (item === '--json') options.json = argv[++index]
    else if (item === '--html') options.html = argv[++index]
    else if (item === '--backlog') options.backlog = argv[++index]
    else if (item === '--generated-at') options.generatedAt = argv[++index]
    else if (item === '--no-html') options.html = false
    else if (item === '--no-backlog') options.backlog = false
  }
  return options
}

if (require.main === module) main()

module.exports = {
  main,
  parseArgs
}
