#!/usr/bin/env node
import { createReadStream, existsSync, mkdtempSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = join(root, 'design', 'kawaii-app')
const args = parseArgs(process.argv.slice(2))
const host = args.host || '127.0.0.1'
const requestedPort = Number(args.port || 4186)
const strictPort = Boolean(args.strictPort)
const refreshFromSource = !args.bundle && !args.noRefresh
let bundle = args.bundle ? resolve(args.bundle) : buildBundle()
let sourceStamp = refreshFromSource ? currentSourceStamp() : 0
let lastRefreshCheck = 0

runSmoke(bundle)
serve(requestedPort)

function buildBundle () {
  const out = mkdtempSync(join(tmpdir(), 'pearcup-hyper-serve-'))
  runNode('scripts/build-pearbrowser-hyper.mjs', ['--out', out])
  return out
}

function runSmoke (bundlePath) {
  runNode('scripts/smoke-pearbrowser-hyper.mjs', ['--bundle', bundlePath])
}

function runNode (script, scriptArgs) {
  const result = spawnSync(process.execPath, [join(root, script), ...scriptArgs], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`${script} failed${detail ? `:\n${detail}` : ''}`)
  }
}

function serve (port) {
  const server = createServer((req, res) => {
    try {
      refreshBundleIfNeeded()
    } catch (err) {
      const detail = err && err.stack ? err.stack : String(err)
      return send(res, 500, `PearCup preview rebuild failed\n${detail}\n`, 'text/plain; charset=utf-8')
    }

    const filePath = resolveRequestPath(bundle, req.url || '/')
    if (!filePath) return send(res, 403, 'Forbidden\n', 'text/plain; charset=utf-8')
    if (!existsSync(filePath)) return send(res, 404, 'Not found\n', 'text/plain; charset=utf-8')
    const stat = statSync(filePath)
    if (stat.isDirectory()) return send(res, 403, 'Forbidden\n', 'text/plain; charset=utf-8')

    res.writeHead(200, {
      'Content-Type': contentType(filePath),
      'Content-Length': stat.size,
      'Cache-Control': 'no-store'
    })
    if (req.method === 'HEAD') return res.end()
    createReadStream(filePath).pipe(res)
  })

  server.on('error', err => {
    if (err.code === 'EADDRINUSE' && !strictPort && port < requestedPort + 25) {
      server.listen(++port, host)
      return
    }
    throw err
  })

  server.listen(port, host, () => {
    const actual = server.address()
    const actualPort = typeof actual === 'object' && actual ? actual.port : port
    console.log(`PearBrowser Hyper bundle: ${bundle}`)
    if (refreshFromSource) console.log('PearBrowser Hyper preview: source auto-refresh enabled')
    console.log(`PearBrowser Hyper preview: http://${host}:${actualPort}/`)
  })
}

function refreshBundleIfNeeded () {
  if (!refreshFromSource) return
  const now = Date.now()
  if (now - lastRefreshCheck < 500) return
  lastRefreshCheck = now

  const nextStamp = currentSourceStamp()
  if (nextStamp <= sourceStamp) return

  const nextBundle = buildBundle()
  runSmoke(nextBundle)
  bundle = nextBundle
  sourceStamp = currentSourceStamp()
  console.log(`PearBrowser Hyper bundle refreshed: ${bundle}`)
}

function currentSourceStamp () {
  return Math.max(
    newestMtime(appRoot),
    newestMtime(join(root, 'scripts', 'build-kawaii-boot.mjs')),
    newestMtime(join(root, 'scripts', 'build-pearbrowser-hyper.mjs')),
    newestMtime(join(root, 'scripts', 'smoke-pearbrowser-hyper.mjs'))
  )
}

function newestMtime (filePath) {
  if (!existsSync(filePath)) return 0
  const stat = statSync(filePath)
  if (!stat.isDirectory()) return stat.mtimeMs

  let newest = stat.mtimeMs
  for (const entry of readdirSync(filePath)) {
    if (entry === 'node_modules' || entry === '.git') continue
    newest = Math.max(newest, newestMtime(join(filePath, entry)))
  }
  return newest
}

function resolveRequestPath (bundlePath, url) {
  const pathname = String(url).split(/[?#]/)[0] || '/'
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch (err) {
    return null
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  const normalized = normalize(relative)
  if (normalized.startsWith('..') || normalized.includes(`${sep}..${sep}`)) return null
  const filePath = resolve(bundlePath, normalized)
  return filePath.startsWith(bundlePath + sep) || filePath === bundlePath ? filePath : null
}

function send (res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  })
  res.end(body)
}

function contentType (filePath) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.webp': 'image/webp'
  }[extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function parseArgs (argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--bundle') parsed.bundle = argv[++i]
    else if (arg.startsWith('--bundle=')) parsed.bundle = arg.slice('--bundle='.length)
    else if (arg === '--host') parsed.host = argv[++i]
    else if (arg.startsWith('--host=')) parsed.host = arg.slice('--host='.length)
    else if (arg === '--port') parsed.port = argv[++i]
    else if (arg.startsWith('--port=')) parsed.port = arg.slice('--port='.length)
    else if (arg === '--no-refresh') parsed.noRefresh = true
    else if (arg === '--strict-port') parsed.strictPort = true
  }
  return parsed
}
