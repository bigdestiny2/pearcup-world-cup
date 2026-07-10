#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const jsonOutput = args.has('--json')
const requirePass = args.has('--require-pass') || process.env.PEARCUP_REQUIRE_PEAR_BROWSER_COMPAT === '1'

const checks = [
  run('Canonical Pear package and generated boot bundle', 'scripts/check-kawaii-runtime.mjs'),
  run('Canonical PearBrowser/Hyper bundle contract', 'scripts/smoke-pearbrowser-hyper.mjs')
]
const report = {
  ok: checks.every(check => check.ok),
  appRoot: 'app',
  checks
}

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('PearCup canonical runtime audit')
  console.log('source - app/')
  for (const check of checks) {
    console.log(`${check.ok ? 'ok' : 'not ok'} - ${check.label}`)
    if (!check.ok && check.output) console.log(check.output)
  }
}

if (requirePass && !report.ok) process.exitCode = 1

function run (label, script) {
  const result = spawnSync(process.execPath, [join(root, script)], {
    cwd: root,
    encoding: 'utf8'
  })
  return {
    label,
    ok: result.status === 0,
    status: result.status,
    output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
  }
}
