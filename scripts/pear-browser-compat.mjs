#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const compat = require('../app/pear-browser-compat.js')

const args = new Set(process.argv.slice(2))
const jsonOutput = args.has('--json')
const requirePass = args.has('--require-pass') || process.env.PEARCUP_REQUIRE_PEAR_BROWSER_COMPAT === '1'
const canonicalGate = args.has('--canonical') || requirePass || process.env.PEARCUP_AUDIT_CANONICAL === '1'
const rootDir = process.cwd()

function readJson (filePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, filePath), 'utf8'))
}

function readText (filePath) {
  return fs.readFileSync(path.join(rootDir, filePath), 'utf8')
}

function listFiles (dir, acc = {}) {
  for (const entry of fs.readdirSync(path.join(rootDir, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name).replace(/\\/g, '/')
    if (entry.isDirectory()) listFiles(relative, acc)
    else acc[`/${relative}`] = true
  }
  return acc
}

function sourceMapFor (files) {
  const sources = {}
  for (const filePath of Object.keys(files)) {
    if (!filePath.startsWith('/app/') || !filePath.endsWith('.js')) continue
    sources[filePath] = readText(filePath.slice(1))
  }
  return sources
}

function run () {
  const files = {
    '/index.cjs': fs.existsSync(path.join(rootDir, 'index.cjs')),
    '/package.json': fs.existsSync(path.join(rootDir, 'package.json')),
    ...listFiles('app'),
    ...listFiles('config')
  }
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources: sourceMapFor(files)
  })
  const canonical = canonicalGate ? runCanonicalKawaiiChecks() : null

  if (jsonOutput) {
    console.log(JSON.stringify({
      ok: report.ok && (!canonical || canonical.ok),
      legacyRootApp: report,
      canonicalKawaiiApp: canonical
    }, null, 2))
  } else {
    console.log(compat.formatPearBrowserCompatibilityReport(report))
    console.log('note - legacy root app audit only; canonical Pear/PearBrowser app is design/kawaii-app')
    if (canonical) {
      console.log('Canonical Kawaii Pear/PearBrowser audit')
      for (const check of canonical.checks) {
        console.log(`${check.ok ? 'ok' : 'not ok'} - ${check.label}`)
      }
    } else {
      console.log('next - use --canonical or --require-pass to include the canonical design/kawaii-app gates')
    }
  }

  if (requirePass && (!report.ok || (canonical && !canonical.ok))) process.exitCode = 1
}

function runCanonicalKawaiiChecks () {
  const checks = [
    runNodeCheck('Kawaii Pear runtime package and boot bundle', 'scripts/check-kawaii-runtime.mjs'),
    runNodeCheck('Kawaii PearBrowser Hyper bundle contract', 'scripts/smoke-pearbrowser-hyper.mjs')
  ]
  return {
    ok: checks.every(check => check.ok),
    checks
  }
}

function runNodeCheck (label, script) {
  const result = spawnSync(process.execPath, [path.join(rootDir, script)], {
    cwd: rootDir,
    encoding: 'utf8'
  })
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
  return {
    label,
    ok: result.status === 0,
    status: result.status,
    output
  }
}

try {
  run()
} catch (err) {
  if (jsonOutput) console.error(JSON.stringify({ error: err.message }, null, 2))
  else console.error(`not ok - ${err.message}`)
  process.exitCode = 1
}
