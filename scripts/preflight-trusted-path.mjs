#!/usr/bin/env node
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const trustedPathPreflight = require('../app/trusted-path-preflight.js')

const args = new Set(process.argv.slice(2))
const jsonOutput = args.has('--json')
const requireLive = args.has('--require-live') || process.env.PEARCUP_REQUIRE_LIVE === '1'
const allowBroadcast = args.has('--allow-broadcast') && process.env.PEARCUP_TRUSTED_PATH_ALLOW_BROADCAST === '1'

async function main () {
  const report = await trustedPathPreflight.runTrustedPathsPreflight({
    requireLive,
    allowBroadcast,
    payoutAddress: process.env.PEARCUP_TRUSTED_PATH_PAYOUT_ADDRESS || undefined
  })

  if (jsonOutput) console.log(JSON.stringify(report, null, 2))
  else console.log(trustedPathPreflight.formatTrustedPathPreflightReport(report))

  if (!report.ok) process.exitCode = 1
}

main().catch((err) => {
  if (jsonOutput) console.error(JSON.stringify({ error: err.message }, null, 2))
  else console.error(`not ok - ${err.message}`)
  process.exitCode = 1
})
