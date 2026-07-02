#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const runtimeSettings = require('../app/runtime-settings.js')

const args = process.argv.slice(2)
const flags = new Set(args)

function argValue (name, fallback) {
  const index = args.indexOf(name)
  if (index === -1 || index + 1 >= args.length) return fallback
  return args[index + 1]
}

function outputJson () {
  return flags.has('--json')
}

function targetPath () {
  return path.resolve(process.cwd(), argValue('--path', runtimeSettings.DEFAULT_CONFIG_PATH))
}

function printHumanValidation (validation, settings) {
  const source = settings.source || {}
  console.log('PearCup live runtime config')
  if (source.loaded) console.log(`ok - runtime settings loaded: ${source.path}`)
  else console.log(`warn - runtime settings file not loaded: ${source.path || runtimeSettings.DEFAULT_CONFIG_PATH}`)
  console.log(`${validation.ok ? 'ok' : 'not ok'} - live config validation`)
  for (const error of validation.errors) console.log(`not ok - ${error.label}`)
  for (const warning of validation.warnings) console.log(`warn - ${warning.label}`)
  if (validation.redactedSettings && validation.redactedSettings.sdkPackages) {
    console.log(`ok - redacted sdk config: ${JSON.stringify(validation.redactedSettings.sdkPackages)}`)
  }
}

function printValidation (validation, settings) {
  if (outputJson()) {
    console.log(JSON.stringify({
      ok: validation.ok,
      source: settings.source,
      errors: validation.errors,
      warnings: validation.warnings,
      redactedSettings: validation.redactedSettings
    }, null, 2))
    return
  }
  printHumanValidation(validation, settings)
}

function templateFromEnv () {
  return runtimeSettings.createLiveRuntimeConfigTemplate({ env: process.env })
}

function printTemplate () {
  const template = flags.has('--from-env')
    ? templateFromEnv()
    : runtimeSettings.createLiveRuntimeConfigTemplate({ env: {} })
  console.log(JSON.stringify(runtimeSettings.redactRuntimeSettings(template), null, 2))
}

function writeTemplate () {
  const configPath = targetPath()
  const force = flags.has('--force')
  if (fs.existsSync(configPath) && !force) {
    throw new Error(`${configPath} already exists; pass --force to overwrite it`)
  }
  const template = templateFromEnv()
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, `${JSON.stringify(template, null, 2)}\n`, 'utf8')

  const settings = runtimeSettings.loadRuntimeSettings({
    env: {},
    config: template,
    configPath
  })
  const validation = runtimeSettings.validateRuntimeSettings(settings, { requireLive: true })
  if (outputJson()) {
    console.log(JSON.stringify({
      wrote: configPath,
      ok: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings,
      redactedSettings: validation.redactedSettings
    }, null, 2))
  } else {
    console.log(`ok - wrote ${configPath}`)
    printHumanValidation(validation, settings)
  }
  if (!validation.ok) process.exitCode = 1
}

function checkConfig () {
  const settings = runtimeSettings.loadRuntimeSettings()
  const validation = runtimeSettings.validateRuntimeSettings(settings, { requireLive: true })
  printValidation(validation, settings)
  if (!validation.ok) process.exitCode = 1
}

try {
  if (flags.has('--print')) {
    printTemplate()
  } else if (flags.has('--write')) {
    writeTemplate()
  } else {
    checkConfig()
  }
} catch (err) {
  if (outputJson()) console.error(JSON.stringify({ error: err.message }, null, 2))
  else console.error(`not ok - ${err.message}`)
  process.exitCode = 1
}
