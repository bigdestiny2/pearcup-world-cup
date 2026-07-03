#!/usr/bin/env node
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
const host = args.host || '127.0.0.1'
const requestedPort = Number(args.port || 4191)
const strictPort = Boolean(args.strictPort)
const drive = (args.drive || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef').toLowerCase()
const bundle = resolveBundle(args)
const blockedBrowserFetchPorts = new Set([4190])

if (!/^[0-9a-f]{64}$/i.test(drive)) throw new Error('--drive must be a 64-hex Hyperdrive key')
if (blockedBrowserFetchPorts.has(requestedPort)) {
  throw new Error('--port 4190 is blocked by browser/fetch clients; use 4191 or another browser-safe port')
}
if (!existsSync(bundle) || !statSync(bundle).isDirectory()) throw new Error(`bundle does not exist: ${bundle}`)

serve(requestedPort)

function serve (port) {
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
    const base = `http://${host}:${actualPort}/app/${drive}/`
    console.log(`PearBrowser local published bundle: ${bundle}`)
    console.log(`PearBrowser local published URL: ${base}`)
    console.log(`PearBrowser local published deep link: ${base}?join=demo123`)
  })
}

function resolveBundle (parsed) {
  if (parsed.bundle) return resolve(parsed.bundle)
  if (parsed.receipt) {
    const receiptPath = resolve(parsed.receipt)
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'))
    if (!receipt.bundle) throw new Error(`receipt is missing bundle path: ${receiptPath}`)
    return resolve(receipt.bundle)
  }
  throw new Error('missing --bundle <path> or --receipt <pearcup-release-receipt.json>')
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
    else if (arg === '--receipt') parsed.receipt = argv[++i]
    else if (arg.startsWith('--receipt=')) parsed.receipt = arg.slice('--receipt='.length)
    else if (arg === '--drive') parsed.drive = argv[++i]
    else if (arg.startsWith('--drive=')) parsed.drive = arg.slice('--drive='.length)
    else if (arg === '--host') parsed.host = argv[++i]
    else if (arg.startsWith('--host=')) parsed.host = arg.slice('--host='.length)
    else if (arg === '--port') parsed.port = argv[++i]
    else if (arg.startsWith('--port=')) parsed.port = arg.slice('--port='.length)
    else if (arg === '--strict-port') parsed.strictPort = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return parsed
}
