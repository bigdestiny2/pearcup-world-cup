#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = join(root, 'design', 'kawaii-app')
const errors = []

const pkg = readJson('package.json')
if (pkg) {
  checkPackage(pkg)
  checkStageIncludes(pkg)
  checkDependencies(pkg)
}
const rootPkg = readRootJson('package.json')
if (rootPkg) {
  checkRootLaunchScripts(rootPkg)
  checkRootReleaseHandoffScripts(rootPkg)
}
checkRootLegacyPearGuard()
checkBootBundleFresh()
checkRendererHtml()

if (errors.length > 0) {
  console.error('Kawaii Pear runtime check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('Kawaii Pear runtime check passed')
}

function checkPackage (pkg) {
  if (pkg.type !== 'commonjs') errors.push('design/kawaii-app package must stay commonjs')
  if (pkg.main !== 'index.cjs') errors.push('design/kawaii-app package main must be index.cjs')
  if (!pkg.pear) errors.push('design/kawaii-app package is missing pear config')
  if (pkg.pear && pkg.pear.gui && pkg.pear.gui.main !== 'index.html') {
    errors.push('Pear GUI main must stay index.html')
  }

  const routes = pkg.pear && pkg.pear.routes
  if (!routes || routes[''] !== '.' || routes['/'] !== '.') {
    errors.push('Pear routes must map "" and "/" to "." so the bridge serves index.html without exposing /index.cjs')
  }
  if (routes) {
    for (const [route, target] of Object.entries(routes)) {
      if (target === '/index.html' || target === 'index.html') {
        errors.push(`Pear route ${route || '(empty)'} must not point directly to index.html`)
      }
      if (target === '/index.cjs' || target === 'index.cjs') {
        errors.push(`Pear route ${route || '(empty)'} must not point directly to index.cjs`)
      }
    }
  }

  const ignore = pkg.pear && pkg.pear.stage && pkg.pear.stage.ignore
  if (Array.isArray(ignore) && ignore.some(entry => normalizeEntry(entry) === '/node_modules')) {
    errors.push('Pear stage.ignore must not exclude /node_modules')
  }
}

function checkStageIncludes (pkg) {
  const include = pkg.pear && pkg.pear.stage && pkg.pear.stage.include
  if (!Array.isArray(include)) {
    errors.push('Pear stage.include must be an array')
    return
  }

  const includes = new Set(include.map(normalizeEntry))
  for (const entry of [
    '/index.cjs',
    '/package.json',
    '/index.html',
    '/styles.css',
    '/pearcup-boot.js',
    '/app.js',
    '/peer-net.js',
    '/peer-match.js',
    '/peer-lobby.js',
    '/watch-sync.js',
    '/swarm-worker.cjs',
    '/assets',
    '/avatars',
    '/crests',
    '/live-match.json'
  ]) {
    if (!includes.has(entry)) errors.push(`Pear stage.include is missing ${entry}`)
  }

  for (const entry of includes) {
    if (!entry || entry === '/') continue
    if (!existsSync(join(appRoot, entry.slice(1)))) errors.push(`Pear stage.include references missing file: ${entry}`)
  }
}

function checkDependencies (pkg) {
  const deps = pkg.dependencies || {}
  for (const dep of ['pear-electron', 'pear-bridge', 'hyperswarm', 'hypercore-crypto', 'b4a']) {
    if (!deps[dep]) errors.push(`design/kawaii-app dependencies missing ${dep}`)
  }

  const modulesPath = join(appRoot, 'node_modules')
  if (!existsSync(modulesPath)) {
    errors.push('design/kawaii-app/node_modules must exist for Pear staging')
    return
  }

  const stat = lstatSync(modulesPath)
  if (stat.isSymbolicLink()) errors.push('design/kawaii-app/node_modules must be a real directory, not a symlink')

  for (const dep of ['pear-electron', 'pear-bridge', 'hyperswarm', 'hypercore-crypto', 'b4a']) {
    if (!existsSync(join(modulesPath, dep))) {
      errors.push(`design/kawaii-app/node_modules is missing ${dep}`)
    }
  }
}

function checkRootLaunchScripts (pkg) {
  const scripts = pkg.scripts || {}
  for (const [name, expected] of Object.entries({
    dev: 'cd design/kawaii-app && pear run --dev .',
    'dev:devtools': 'cd design/kawaii-app && pear run --dev --devtools .',
    'link:new': 'cd design/kawaii-app && pear touch',
    stage: 'cd design/kawaii-app && pear stage "$PEAR_LINK" .',
    release: 'cd design/kawaii-app && pear release "$PEAR_LINK"',
    seed: 'cd design/kawaii-app && pear seed "$PEAR_LINK"'
  })) {
    if (scripts[name] !== expected) {
      errors.push(`root package script "${name}" must route to the canonical design/kawaii-app Pear build`)
    }
  }
}

function checkRootReleaseHandoffScripts (pkg) {
  const scripts = pkg.scripts || {}
  const expected = {
    'prepare:pearbrowser-release:handoff': 'node --check scripts/prepare-pearbrowser-release.mjs && node scripts/prepare-pearbrowser-release.mjs --out .pearcup-release/latest --force',
    'check:publish-handoff:latest': 'node --check scripts/check-pearbrowser-publish-handoff.mjs && node scripts/check-pearbrowser-publish-handoff.mjs --receipt .pearcup-release/latest/pearcup-release-receipt.json',
    'record:friend-test:latest': 'node --check scripts/record-latest-friend-test-result.mjs && node scripts/record-latest-friend-test-result.mjs'
  }
  for (const [name, command] of Object.entries(expected)) {
    if (scripts[name] !== command) {
      errors.push(`root package script "${name}" must keep the durable .pearcup-release/latest handoff path`)
    }
  }
}

function checkRootLegacyPearGuard () {
  const index = readRootText('index.cjs')
  if (!index) return
  if (!index.includes('PEARCUP_ALLOW_LEGACY_ROOT')) {
    errors.push('root Pear entrypoint must require PEARCUP_ALLOW_LEGACY_ROOT before launching the legacy base app')
  }
  if (!index.includes('root Pear package is legacy and intentionally disabled')) {
    errors.push('root Pear entrypoint must clearly refuse accidental legacy launches')
  }
  if (!index.includes('cd design/kawaii-app && pear run --dev .')) {
    errors.push('root Pear entrypoint must point operators to the canonical design/kawaii-app launch command')
  }
}

function checkRendererHtml () {
  let html = ''
  try {
    html = readFileSync(join(appRoot, 'index.html'), 'utf8')
  } catch (err) {
    errors.push(`could not read index.html: ${err.message}`)
    return
  }

  const scriptRefs = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(match => match[1])
  const bootIndex = scriptRefs.indexOf('./pearcup-boot.js')
  const appIndex = scriptRefs.indexOf('./app.js')
  if (bootIndex < 0 && appIndex < 0) errors.push('index.html must load ./pearcup-boot.js or ./app.js')

  if (bootIndex >= 0) {
    const bootLoader = readTextFile('pearcup-boot.js')
    for (const ref of ['./peer-net.js', './peer-match.js', './peer-lobby.js', './watch-sync.js', './app.js']) {
      if (!bootLoader.includes(ref)) errors.push(`pearcup-boot.js must load ${ref}`)
    }
  } else {
    for (const ref of ['./peer-net.js', './peer-match.js', './peer-lobby.js', './watch-sync.js']) {
      const refIndex = scriptRefs.indexOf(ref)
      if (refIndex < 0) errors.push(`index.html must load ${ref}`)
      else if (appIndex >= 0 && refIndex > appIndex) {
        errors.push(`${ref} must load before ./app.js so Pear boots with P2P modules available`)
      }
    }
  }

  for (const ref of scriptRefs) {
    if (/[?#]/.test(ref)) errors.push(`index.html script ref must not use query/hash cache busters: ${ref}`)
    if (/^https?:\/\//i.test(ref)) errors.push(`index.html script ref must stay packaged/local: ${ref}`)
    if (/\/index\.cjs(?:\+esm-wrap)?/.test(ref)) errors.push(`index.html must not load Pear entrypoint as renderer script: ${ref}`)
  }
}

function checkBootBundleFresh () {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'build-kawaii-boot.mjs'), '--check'], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    errors.push(`PearCup boot bundle freshness check failed${detail ? `:\n${detail}` : ''}`)
  }
}

function readTextFile (filePath) {
  try {
    return readFileSync(join(appRoot, filePath), 'utf8')
  } catch (err) {
    errors.push(`could not read ${filePath}: ${err.message}`)
    return ''
  }
}

function readJson (filePath) {
  try {
    return JSON.parse(readFileSync(join(appRoot, filePath), 'utf8'))
  } catch (err) {
    errors.push(`could not read ${filePath}: ${err.message}`)
    return null
  }
}

function readRootJson (filePath) {
  try {
    return JSON.parse(readFileSync(join(root, filePath), 'utf8'))
  } catch (err) {
    errors.push(`could not read root ${filePath}: ${err.message}`)
    return null
  }
}

function readRootText (filePath) {
  try {
    return readFileSync(join(root, filePath), 'utf8')
  } catch (err) {
    errors.push(`could not read root ${filePath}: ${err.message}`)
    return ''
  }
}

function normalizeEntry (entry) {
  return '/' + String(entry || '').replace(/^\/+/, '').replace(/\\/g, '/')
}
