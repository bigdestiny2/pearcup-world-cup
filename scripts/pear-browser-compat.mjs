#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const compat = require('../app/pear-browser-compat.js')

const args = new Set(process.argv.slice(2))
const jsonOutput = args.has('--json')
const requirePass = args.has('--require-pass') || process.env.PEARCUP_REQUIRE_PEAR_BROWSER_COMPAT === '1'
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

  if (jsonOutput) console.log(JSON.stringify(report, null, 2))
  else console.log(compat.formatPearBrowserCompatibilityReport(report))

  if (requirePass && !report.ok) process.exitCode = 1
}

try {
  run()
} catch (err) {
  if (jsonOutput) console.error(JSON.stringify({ error: err.message }, null, 2))
  else console.error(`not ok - ${err.message}`)
  process.exitCode = 1
}
