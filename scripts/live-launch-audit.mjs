#!/usr/bin/env node
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
require('../app/core.js')
require('../app/adapters.js')
require('../app/qvac-referee.js')
require('../app/tether-wdk-bridge.js')
require('../app/sdk-runtime.js')
require('../app/runtime-config.js')
require('../app/runtime-settings.js')
require('../app/worker-runtime.js')
require('../app/settlement-receipts.js')
require('../app/settlement-service.js')
require('../app/live-readiness.js')
require('../app/trusted-path-preflight.js')
const launchAudit = require('../app/live-launch-audit.js')

const args = new Set(process.argv.slice(2))
const jsonOutput = args.has('--json')
const requireLive = args.has('--require-live') || process.env.PEARCUP_REQUIRE_LIVE === '1'
const runTrustedPath = !args.has('--no-trusted-path')
const allowBroadcast = args.has('--allow-broadcast') && process.env.PEARCUP_TRUSTED_PATH_ALLOW_BROADCAST === '1'

async function main () {
  const report = await launchAudit.runLiveLaunchAudit({
    requireLive,
    runTrustedPath,
    allowBroadcast,
    payoutAddress: process.env.PEARCUP_TRUSTED_PATH_PAYOUT_ADDRESS || undefined
  })

  if (jsonOutput) console.log(JSON.stringify(report, null, 2))
  else console.log(launchAudit.formatLiveLaunchAuditReport(report))

  if (requireLive && !report.readyToLaunch) process.exitCode = 1
}

main().catch((err) => {
  if (jsonOutput) console.error(JSON.stringify({ error: err.message }, null, 2))
  else console.error(`not ok - ${err.message}`)
  process.exitCode = 1
})
