#!/usr/bin/env node
'use strict'

import { spawn } from 'node:child_process'
import { mkdtemp, rm, symlink, copyFile } from 'node:fs/promises'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

const RUNTIME_CANDIDATES = [
  join(process.env.HOME, 'Library/Application Support/pear/current/by-arch', `${process.platform}-${process.arch}`, 'bin/pear-runtime'),
  '/opt/homebrew/bin/pear',
  '/usr/local/bin/pear'
]

async function findRuntime () {
  const { stat } = await import('node:fs/promises')
  for (const candidate of RUNTIME_CANDIDATES) {
    try {
      const s = await stat(candidate)
      if (s.isFile() || s.isSymbolicLink()) return candidate
    } catch { /* ignore */ }
  }
  return 'pear'
}

function hasSpace (path) {
  return path.includes(' ')
}

async function createTempMirror () {
  const tmpBase = join(tmpdir(), 'ultimate-sports-')
  const tempDir = await mkdtemp(tmpBase)

  const mirrorFiles = ['package.json', 'index.cjs']
  for (const file of mirrorFiles) {
    await copyFile(join(PROJECT_ROOT, file), join(tempDir, file))
  }

  const mirrorDirs = ['lobby-app', 'shell', 'generated-assets', 'node_modules', 'app']
  for (const dir of mirrorDirs) {
    const src = join(PROJECT_ROOT, dir)
    const dest = join(tempDir, dir)
    try {
      await symlink(src, dest, 'dir')
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }

  return tempDir
}

function cleanup (tempDir) {
  if (!tempDir) return
  try {
    rmSync(tempDir, { recursive: true, force: true })
  } catch {}
}

async function main () {
  const runtime = await findRuntime()
  const devtools = process.argv.includes('--devtools')
  const args = ['run', '--dev']
  if (devtools) args.push('--devtools')
  let cwd = PROJECT_ROOT
  let tempDir = null

  if (hasSpace(PROJECT_ROOT)) {
    tempDir = await createTempMirror()
    args.push('--base', tempDir)
    cwd = tempDir
  }

  args.push('.')

  const child = spawn(runtime, args, {
    cwd,
    stdio: 'inherit',
    shell: false
  })

  return new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      cleanup(tempDir)
      if (signal) resolve(0)
      else resolve(code ?? 0)
    })
  })
}

main()
  .then((code) => {
    process.exit(code)
  })
  .catch((err) => {
    console.error('[run-pear-dev] error:', err)
    process.exit(1)
  })

process.on('SIGINT', () => {
  // Let the child inherit the signal and exit naturally; cleanup runs in child.on('exit').
})
process.on('SIGTERM', () => {
  // Let the child inherit the signal and exit naturally; cleanup runs in child.on('exit').
})
