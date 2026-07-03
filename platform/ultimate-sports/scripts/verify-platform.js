'use strict'

const fs = require('node:fs')
const path = require('node:path')

function verifyPlatform (options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..')
  const manifestPath = options.manifestPath || path.join(rootDir, 'platform.manifest.json')
  const manifest = options.manifest || readJson(manifestPath)
  const errors = []

  checkRequiredFiles({ rootDir, manifest, errors })
  const entrypoint = loadModule(path.join(rootDir, manifest.entrypoint), errors, 'entrypoint')
  checkRequiredExports({ entrypoint, manifest, errors })
  checkFacade({ rootDir, manifest, errors })
  checkScenarios({ rootDir, manifest, errors })
  checkCommands({ rootDir, manifest, errors })

  return {
    ok: errors.length === 0,
    errors,
    manifest,
    checked: {
      sourceFiles: manifest.requiredSourceFiles.length,
      exports: manifest.requiredExports.length,
      scenarios: manifest.scenarioIds.length,
      tests: manifest.testFiles.length
    }
  }
}

function checkRequiredFiles ({ rootDir, manifest, errors }) {
  const files = [
    manifest.entrypoint,
    manifest.facade && manifest.facade.module,
    ...manifest.requiredSourceFiles,
    ...manifest.testFiles
  ].filter(Boolean)
  files.forEach(relativePath => {
    if (!fs.existsSync(path.join(rootDir, relativePath))) errors.push(`missing file: ${relativePath}`)
  })
}

function checkRequiredExports ({ entrypoint, manifest, errors }) {
  if (!entrypoint) return
  manifest.requiredExports.forEach(exportName => {
    if (!Object.prototype.hasOwnProperty.call(entrypoint, exportName)) {
      errors.push(`missing entrypoint export: ${exportName}`)
    }
  })
}

function checkFacade ({ rootDir, manifest, errors }) {
  const facadeModule = loadModule(path.join(rootDir, manifest.facade.module), errors, 'facade')
  if (!facadeModule) return
  const factory = facadeModule[manifest.facade.factory]
  if (typeof factory !== 'function') {
    errors.push(`missing facade factory: ${manifest.facade.factory}`)
    return
  }

  let facade
  try {
    facade = factory({ peerId: 'verify-peer' })
  } catch (error) {
    errors.push(`facade factory threw: ${error.message}`)
    return
  }

  manifest.facade.methods.forEach(methodName => {
    if (typeof facade[methodName] !== 'function') errors.push(`missing facade method: ${methodName}`)
  })
  if (!facade.modules || typeof facade.modules !== 'object') errors.push('facade missing modules object')
}

function checkScenarios ({ rootDir, manifest, errors }) {
  const scenarios = loadModule(path.join(rootDir, 'src/scenarios.js'), errors, 'scenarios')
  if (!scenarios || typeof scenarios.scenarioById !== 'function') {
    errors.push('missing scenarios.scenarioById')
    return
  }

  manifest.scenarioIds.forEach(scenarioId => {
    let scenario
    try {
      scenario = scenarios.scenarioById(scenarioId)
    } catch (error) {
      errors.push(`scenario ${scenarioId} failed: ${error.message}`)
      return
    }
    if (!scenario || scenario.scenarioId !== scenarioId) errors.push(`scenario ${scenarioId} returned wrong id`)
    if (!Array.isArray(scenario.commands) || scenario.commands.length === 0) errors.push(`scenario ${scenarioId} has no commands`)
    if (!Array.isArray(scenario.topics)) errors.push(`scenario ${scenarioId} has no topics array`)
  })
}

function checkCommands ({ rootDir, manifest, errors }) {
  const commandSet = new Set(manifest.testCommand || [])
  manifest.testFiles.forEach(testFile => {
    const fullPath = path.join(rootDir, testFile)
    if (!commandSet.has(fullPath) && !commandSet.has(`platform/ultimate-sports/${testFile}`)) {
      errors.push(`test command does not include: ${testFile}`)
    }
  })
  if (!Array.isArray(manifest.checkCommand) || manifest.checkCommand.join(' ') !== 'node platform/ultimate-sports/scripts/verify-platform.js') {
    errors.push('checkCommand must run node platform/ultimate-sports/scripts/verify-platform.js')
  }
}

function loadModule (modulePath, errors, label) {
  try {
    delete require.cache[require.resolve(modulePath)]
    return require(modulePath)
  } catch (error) {
    errors.push(`failed to load ${label}: ${error.message}`)
    return null
  }
}

function readJson (filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

if (require.main === module) {
  const report = verifyPlatform()
  if (!report.ok) {
    console.error('Ultimate sports platform verification failed:')
    report.errors.forEach(error => console.error(`- ${error}`))
    process.exit(1)
  }
  console.log(`Ultimate sports platform verification passed: ${report.checked.sourceFiles} source files, ${report.checked.scenarios} scenarios, ${report.checked.tests} tests.`)
}

module.exports = {
  verifyPlatform
}

