'use strict'
/** @typedef {import('pear-interface')} */ /* global Pear */

patchPearBridgeRootRequests()
patchPearIpcRootFileLookups()

const Runtime = require('pear-electron')
const Bridge = require('pear-bridge')
patchPearBridgeRootLookups(Bridge)

function patchPearBridgeRootRequests () {
  const http = require('bare-http1')
  if (http.__pearcupRootRequestPatch) return

  const createServer = http.createServer
  http.createServer = function createServerWithPearcupRootFix (handler, ...args) {
    if (typeof handler !== 'function') return createServer.call(this, handler, ...args)

    return createServer.call(this, (req, res) => {
      if (req && typeof req.url === 'string') {
        const originalUrl = req.url
        req.url = normalizeRootRendererUrl(req.url)
        if (shouldServeBootProbe(req.url)) {
          tracePearBridge('probe', originalUrl, req.url)
          return writeResponse(res, 204, {
            'cache-control': 'no-store',
            'content-length': '0'
          }, '')
        }
        if (shouldServeRendererRuntimeOptions(req.url)) {
          tracePearBridge('runtime-options', originalUrl, req.url)
          return writeJsonResponse(res, rendererRuntimeOptions())
        }
        if (shouldProxyHiveRelay(req.url)) {
          tracePearBridge('hiverelay-proxy', originalUrl, req.url)
          proxyHiveRelayRequest(req, res).catch(err => {
            tracePearBridge('hiverelay-proxy-error', req.url, err && err.message ? err.message : String(err))
            if (!res.headersSent) writeJsonError(res, 502, 'HiveRelay proxy request failed')
            else { try { res.end() } catch (endErr) {} }
          })
          return
        }
        tracePearBridge('http', originalUrl, req.url)
      }
      return handler(req, res)
    }, ...args)
  }

  http.__pearcupRootRequestPatch = true
}

function patchPearBridgeRootLookups (Bridge) {
  const proto = Bridge && Bridge.prototype
  if (!proto || proto.__pearcupRootLookupPatch || typeof proto.lookup !== 'function') return

  const lookup = proto.lookup
  proto.lookup = function lookupWithPearcupRootFix (id, protocol, type, req, res) {
    let nextProtocol = protocol
    let nextType = type
    if (req && typeof req.url === 'string') {
      const originalUrl = req.url
      const url = normalizeRootRendererUrl(req.url)
      if (url !== req.url) req = { __proto__: req, url }

      if (shouldServeRawClassicScript(nextProtocol, nextType, url)) {
        nextType = 'raw'
      }

      tracePearBridge('lookup', `${protocol}:${type}:${originalUrl}`, `${nextProtocol}:${nextType}:${url}`)
    }
    return lookup.call(this, id, nextProtocol, nextType, req, res)
  }

  proto.__pearcupRootLookupPatch = true
}

function patchPearIpcRootFileLookups () {
  if (typeof Pear === 'undefined' || !Pear.constructor) return

  const ipc = Pear[Pear.constructor.IPC]
  if (!ipc || ipc.__pearcupRootFileLookupPatch) return

  for (const method of ['exists', 'get']) {
    if (typeof ipc[method] !== 'function') continue

    const original = ipc[method]
    ipc[method] = function pearcupRootFileLookupFix (opts, ...args) {
      if (opts && typeof opts === 'object' && opts.key === '/') {
        opts = { ...opts, key: '/index.html' }
      }
      return original.call(this, opts, ...args)
    }
  }

  ipc.__pearcupRootFileLookupPatch = true
}

function normalizeRootRendererUrl (url) {
  if (url === '' || url === '/' || url === '//') return '/index.html'
  if (url[0] === '?') return '/index.html' + url
  if (url[0] === '#') return '/index.html' + url
  if (url.startsWith('/?')) return '/index.html' + url.slice(1)
  if (url.startsWith('//?')) return '/index.html' + url.slice(2)
  if (url.startsWith('/#')) return '/index.html' + url.slice(1)
  if (url.startsWith('//#')) return '/index.html' + url.slice(2)
  if (url[0] !== '/' && url[0] !== '+') return url

  const plus = url.indexOf('+')
  if (plus === -1) return url

  const base = url.slice(0, plus)
  if (base === '' || base === '/' || base === '//') return '/index.html' + url.slice(plus)
  return url
}

function shouldServeRawClassicScript (protocol, type, url) {
  if (protocol !== 'app' || type !== 'app' || typeof url !== 'string') return false

  const path = url.split('?')[0].split('#')[0]
  return path.endsWith('.js') && !path.endsWith('.mjs') && !path.endsWith('.cjs')
}

function shouldServeBootProbe (url) {
  const path = String(url || '').split('?')[0].split('#')[0]
  return path === '/boot-probe-hit.gif'
}

function shouldServeRendererRuntimeOptions (url) {
  const path = String(url || '').split('?')[0].split('#')[0]
  return path === '/pearcup-runtime-options.json'
}

const HIVERELAY_PROXY_PREFIX = '/pearcup-hiverelay'
const HIVERELAY_ALLOWED_PATHS = new Set([
  '/api/token',
  '/api/bridge/status',
  '/api/swarm/join',
  '/api/swarm/send',
  '/api/swarm/leave',
  '/api/swarm/events'
])

function shouldProxyHiveRelay (url) {
  const parsed = new URL(String(url || ''), 'http://pearcup.local')
  if (!parsed.pathname.startsWith(HIVERELAY_PROXY_PREFIX + '/')) return false
  return HIVERELAY_ALLOWED_PATHS.has(parsed.pathname.slice(HIVERELAY_PROXY_PREFIX.length))
}

function hiveRelayOrigin () {
  const env =
    (typeof process !== 'undefined' && process.env) ||
    (typeof Pear !== 'undefined' && Pear.config && Pear.config.env) ||
    {}
  const configured = env.PEARCUP_HIVERELAY_URL || 'https://pearcup-kawaii-relay.throbbing-limit-1abb.workers.dev'
  const url = new URL(configured)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid HiveRelay proxy origin')
  return url.href.replace(/\/+$/, '')
}

async function proxyHiveRelayRequest (req, res) {
  const fetch = require('bare-fetch')
  const parsed = new URL(String(req.url || ''), 'http://pearcup.local')
  const remotePath = parsed.pathname.slice(HIVERELAY_PROXY_PREFIX.length)
  if (!HIVERELAY_ALLOWED_PATHS.has(remotePath)) return writeJsonError(res, 404, 'Relay route not found')

  const method = String(req.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'POST') return writeJsonError(res, 405, 'Method not allowed')
  const headers = { accept: remotePath === '/api/swarm/events' ? 'text/event-stream' : 'application/json' }
  const contentType = req.headers && req.headers['content-type']
  const token = req.headers && req.headers['x-pear-token']
  if (contentType) headers['content-type'] = String(contentType)
  if (token) headers['x-pear-token'] = String(token)
  const body = method === 'POST' ? await readRequestBody(req) : undefined
  const target = hiveRelayOrigin() + remotePath + parsed.search
  const response = await fetch(target, { method, headers, body })
  const responseHeaders = {
    'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
  const retryAfter = response.headers.get('retry-after')
  if (retryAfter) responseHeaders['retry-after'] = retryAfter
  if (typeof res.writeHead === 'function') res.writeHead(response.status, responseHeaders)
  else {
    res.statusCode = response.status
    if (typeof res.setHeader === 'function') for (const [key, value] of Object.entries(responseHeaders)) res.setHeader(key, value)
  }

  if (remotePath === '/api/swarm/events' && response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader()
    try {
      while (true) {
        const chunk = await reader.read()
        if (!chunk || chunk.done) break
        if (chunk.value && chunk.value.byteLength) {
          res.write(Buffer.from(chunk.value))
        }
      }
    } finally {
      try { await reader.cancel() } catch (err) {}
      res.end()
    }
    return
  }

  const bytes = response.body ? Buffer.from(await response.arrayBuffer()) : Buffer.alloc(0)
  res.end(bytes)
}

function readRequestBody (req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', chunk => {
      const value = Buffer.from(chunk)
      size += value.length
      if (size > 64 * 1024) {
        reject(new Error('HiveRelay proxy request body is too large'))
        try { req.destroy() } catch (err) {}
        return
      }
      chunks.push(value)
    })
    req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined))
    req.on('error', reject)
  })
}

function writeJsonError (res, statusCode, message) {
  const body = JSON.stringify({ error: message })
  return writeResponse(res, statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(Buffer.byteLength(body))
  }, body)
}

function rendererRuntimeOptions () {
  const fallback = {
    source: { path: null, loaded: false, rendererSafe: true },
    sdkPackages: {},
    compliance: {
      realMoneyEnabled: false,
      kycVerified: false,
      jurisdictionAllowed: false,
      responsiblePlayAccepted: false
    }
  }
  try {
    const runtimeSettings = require('./runtime-settings.js')
    if (!runtimeSettings || typeof runtimeSettings.loadRuntimeSettings !== 'function' || typeof runtimeSettings.toRendererRuntimeSettings !== 'function') {
      return fallback
    }
    // This code runs in the Pear host process. The returned object is explicitly
    // QVAC-only; the WDK seed and all payout information stay in this process.
    const settings = runtimeSettings.toRendererRuntimeSettings(runtimeSettings.loadRuntimeSettings())
    tracePearBridge('runtime-options-state', '', settings.sdkPackages && settings.sdkPackages.qvac ? 'qvac-configured' : 'qvac-unconfigured')
    return settings
  } catch (err) {
    return fallback
  }
}

function writeJsonResponse (res, value) {
  const body = JSON.stringify(value)
  return writeResponse(res, 200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(Buffer.byteLength(body))
  }, body)
}

function writeResponse (res, statusCode, headers, body) {
  if (typeof res.writeHead === 'function') res.writeHead(statusCode, headers)
  else {
    res.statusCode = statusCode
    if (typeof res.setHeader === 'function') {
      for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
    }
  }
  res.end(body)
}

function tracePearBridge (stage, from, to) {
  const env =
    (typeof process !== 'undefined' && process.env) ||
    (typeof Pear !== 'undefined' && Pear.config && Pear.config.env) ||
    {}
  if (!env.PEARCUP_TRACE_BRIDGE) return
  if (from === to) console.log(`[pearcup:bridge] ${stage} ${from}`)
  else console.log(`[pearcup:bridge] ${stage} ${from} -> ${to}`)
}

async function main () {
  const runtime = new Runtime()
  const bridge = new Bridge()
  await bridge.ready()

  const pipe = runtime.start({ bridge })
  if (typeof Pear !== 'undefined' && Pear.teardown) {
    Pear.teardown(() => pipe.end())
  }
}

main().catch((err) => {
  console.error('[pearcup-world-cup] fatal', err)
  if (typeof Pear !== 'undefined' && typeof Pear.exit === 'function') Pear.exit(1)
  else process.exitCode = 1
})
