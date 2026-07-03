#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, mkdtempSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const drive = (args.drive || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef').toLowerCase()
const bundle = args.bundle ? resolve(args.bundle) : buildBundle()

if (!/^[0-9a-f]{64}$/i.test(drive)) throw new Error('--drive must be a 64-hex Hyperdrive key')
if (!existsSync(bundle) || !statSync(bundle).isDirectory()) throw new Error(`bundle does not exist: ${bundle}`)

runNode('scripts/smoke-pearbrowser-hyper.mjs', ['--bundle', bundle])

const server = createServer((req, res) => {
  const filePath = resolveGatewayRequest(bundle, req.url || '/', drive)
  if (!filePath) return send(res, 404, 'Not found\n', 'text/plain; charset=utf-8')
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

await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})

try {
  const address = server.address()
  const gateway = `http://127.0.0.1:${address.port}/`
  const result = await runNodeAsync([
    join(root, 'scripts', 'smoke-published-pearbrowser.mjs'),
    '--drive',
    drive,
    '--gateway',
    gateway
  ])
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) {
    process.exitCode = result.status == null ? 1 : result.status
  } else {
    console.log('PearBrowser local published-gateway smoke passed')
    console.log(`ok - gateway: ${gateway}app/${drive}/`)
    console.log(`ok - bundle: ${bundle}`)
  }
} finally {
  await new Promise(resolve => server.close(() => resolve()))
}

function buildBundle () {
  const out = mkdtempSync(join(tmpdir(), 'pearcup-local-published-'))
  runNode('scripts/build-pearbrowser-hyper.mjs', ['--out', out])
  return out
}

function runNode (script, scriptArgs = []) {
  const result = spawnSync(process.execPath, [join(root, script), ...scriptArgs], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`${script} failed${detail ? `:\n${detail}` : ''}`)
  }
}

function runNodeAsync (argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argv, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('exit', (status, signal) => {
      resolve({
        status: status == null && signal ? 1 : status,
        stdout,
        stderr
      })
    })
  })
}

function resolveGatewayRequest (bundlePath, url, expectedDrive) {
  const pathname = String(url).split(/[?#]/)[0] || '/'
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch (err) {
    return null
  }
  const match = decoded.match(/^\/(?:app|hyper)\/([0-9a-f]{64})(?:\/(.*))?$/i)
  if (!match || match[1].toLowerCase() !== expectedDrive) return null
  const requestPath = match[2] || 'index.html'
  const normalized = normalize(requestPath)
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
    '.json': 'application/json',
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
    else if (arg === '--drive') parsed.drive = argv[++i]
    else if (arg.startsWith('--drive=')) parsed.drive = arg.slice('--drive='.length)
    else throw new Error(`unknown argument: ${arg}`)
  }
  return parsed
}
