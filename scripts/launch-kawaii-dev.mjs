#!/usr/bin/env node
// Launch PearCup from a path Pear can parse. Pear currently URL-encodes spaces
// in a project directory before looking for package.json, so the normal app
// checkout at `pear sports/...` cannot be launched directly. Development still
// runs the real app; only the launch directory is a temporary copy.
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'app')
const pearArgs = ['run', '--dev', '--no-ask', '--no-pre']
const wantsDevtools = process.argv.slice(2).includes('--devtools')

if (!existsSync(join(source, 'package.json'))) throw new Error(`PearCup app package is missing: ${source}`)

const launch = prepareLaunchRoot(source)
const child = spawn('pear', [...pearArgs, ...(wantsDevtools ? ['--devtools'] : []), '.'], {
  cwd: launch.path,
  stdio: 'inherit',
  env: { ...process.env }
})

child.once('error', error => {
  launch.cleanup()
  console.error(`Could not launch Pear Runtime: ${error.message}`)
  process.exitCode = 1
})
child.once('exit', (code, signal) => {
  launch.cleanup()
  if (signal) process.exitCode = 1
  else process.exitCode = code || 0
})

function prepareLaunchRoot (appRoot) {
  if (!/\s/.test(appRoot)) return { path: appRoot, cleanup: () => {} }
  const temp = mkdtempSync(join(tmpdir(), 'pearcup-kawaii-dev-'))
  const target = join(temp, 'app')
  cpSync(appRoot, target, {
    recursive: true,
    dereference: true,
    filter: path => !path.endsWith('/node_modules')
  })
  const nodeModules = join(appRoot, 'node_modules')
  if (!existsSync(nodeModules)) {
    rmSync(temp, { recursive: true, force: true })
    throw new Error('PearCup app dependencies are missing; run npm install in app/')
  }
  symlinkSync(nodeModules, join(target, 'node_modules'), 'dir')
  console.log(`PearCup: using temporary launch path ${target}`)
  return { path: target, cleanup: () => rmSync(temp, { recursive: true, force: true }) }
}
