import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'design', 'kawaii-app')
const args = parseArgs(process.argv.slice(2))
const out = args.out
  ? resolve(args.out)
  : mkdtempSync(join(tmpdir(), 'pearcup-hyper-build-'))

if (existsSync(out)) {
  if (!statSync(out).isDirectory()) throw new Error(`--out is not a directory: ${out}`)
  const entries = await import('node:fs').then(fs => fs.readdirSync(out))
  if (entries.length > 0) throw new Error(`--out must be empty: ${out}`)
} else {
  mkdirSync(out, { recursive: true })
}

runBootBundleBuild()

const pkg = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
const include = [
  ...pkg.pear.stage.include,
  '/manifest.json'
]
const exclude = new Set([
  '/index.cjs',
  '/package.json',
  '/pear-worker.cjs',
  '/swarm-worker.cjs'
])

for (const entry of include) {
  const normalized = normalizeEntry(entry)
  if (!normalized || exclude.has(normalized)) continue
  copyEntry(normalized)
}

const manifestPath = join(out, 'manifest.json')
if (!existsSync(manifestPath)) {
  const manifest = {
    name: 'PearCup',
    version: pkg.version,
    description: 'World Cup bracket pools, watch parties, and Penalty Clash mini matches for PearBrowser.',
    author: 'PearCup',
    icon: '/assets/mascot.png',
    entry: '/index.html',
    categories: ['games', 'sports'],
    permissions: []
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

console.log(out)

function copyEntry (entry) {
  const relative = entry.slice(1)
  const from = join(source, relative)
  if (!existsSync(from)) return
  const to = join(out, relative)
  mkdirSync(dirname(to), { recursive: true })
  const stat = statSync(from)
  if (stat.isDirectory()) {
    cpSync(from, to, {
      recursive: true,
      filter: file => !file.split(/[\\/]/).some(part => part === 'node_modules' || part.startsWith('.'))
    })
  } else {
    cpSync(from, to)
  }
}

function normalizeEntry (entry) {
  if (!entry || typeof entry !== 'string') return null
  return '/' + entry.replace(/^\/+/, '').replace(/\\/g, '/')
}

function parseArgs (argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--out') parsed.out = argv[++i]
    else if (arg.startsWith('--out=')) parsed.out = arg.slice('--out='.length)
  }
  return parsed
}

function runBootBundleBuild () {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'build-kawaii-boot.mjs')], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`could not build PearCup boot bundle${detail ? `:\n${detail}` : ''}`)
  }
}
