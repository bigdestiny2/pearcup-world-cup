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
