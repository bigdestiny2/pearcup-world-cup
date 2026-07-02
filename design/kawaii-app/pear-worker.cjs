'use strict'

require('./core.js')
require('./adapters.js')
require('./qvac-referee.js')
require('./tether-wdk-bridge.js')
require('./sdk-runtime.js')
require('./runtime-settings.js')
require('./runtime-config.js')
require('./worker-sim.js')
require('./worker-runtime.js')
require('./settlement-receipts.js')
require('./settlement-service.js')

const workerBridgeProtocol = require('./worker-bridge-protocol.js')

const protocolVersion = workerBridgeProtocol.protocolVersion

function clone (value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function isBufferLike (value) {
  return typeof Buffer !== 'undefined' &&
    Buffer &&
    typeof Buffer.isBuffer === 'function' &&
    Buffer.isBuffer(value)
}

function dataFromMessage (message) {
  if (
    message &&
    typeof message === 'object' &&
    Object.prototype.hasOwnProperty.call(message, 'data') &&
    !Object.prototype.hasOwnProperty.call(message, 'protocol')
  ) {
    return message.data
  }
  return message
}

function normalizeEnvelopeMessage (message) {
  const input = dataFromMessage(message)
  const value = isBufferLike(input) ? input.toString('utf8') : input
  const parsed = typeof value === 'string' ? JSON.parse(value) : value

  if (parsed && typeof parsed === 'object' && parsed.envelope) return parsed.envelope
  if (parsed && typeof parsed === 'object' && parsed.request && parsed.request.protocol) return parsed.request
  return parsed
}

function postPortMessage (port, response) {
  if (!port) return response
  if (typeof port.postMessage === 'function') return port.postMessage(response)
  if (typeof port.send === 'function') return port.send(response)
  if (typeof port.write === 'function') return port.write(`${JSON.stringify(response)}\n`)
  if (typeof port.emit === 'function') return port.emit('response', response)
  return response
}

function createTransportErrorResponse ({ err, server } = {}) {
  const status = server && server.bridge && server.bridge.service && typeof server.bridge.service.status === 'function'
    ? server.bridge.service.status()
    : null
  const view = server && server.bridge && server.bridge.harness && server.bridge.harness.worker && typeof server.bridge.harness.worker.view === 'function'
    ? server.bridge.harness.worker.view()
    : {}
  const response = {
    protocol: protocolVersion,
    requestId: null,
    ok: false,
    error: err && err.message || 'Pear worker message failed',
    code: 'PEARCUP_WORKER_MESSAGE_ERROR',
    action: null,
    status,
    view,
    events: []
  }
  return workerBridgeProtocol.redactWorkerValue(response)
}

function createPearCupWorkerBridgeServer (opts = {}) {
  const bridge = opts.bridge || workerBridgeProtocol.createPearWorkerBridgeProtocol(opts)

  const server = {
    protocol: protocolVersion,
    bridge,
    async request (message) {
      try {
        return await bridge.request(normalizeEnvelopeMessage(message))
      } catch (err) {
        return createTransportErrorResponse({ err, server })
      }
    },
    async handleMessage (message, reply) {
      const response = await server.request(message)
      if (typeof reply === 'function') await reply(response, message)
      return response
    },
    status () {
      return bridge && bridge.service && typeof bridge.service.status === 'function'
        ? clone(bridge.service.status())
        : null
    },
    async close () {
      if (typeof server.unbind === 'function') server.unbind()
      if (bridge && typeof bridge.close === 'function') await bridge.close()
    },
    unbind: null
  }

  return server
}

function bindPearCupWorkerPort (port, server = createPearCupWorkerBridgeServer()) {
  if (!port) return () => {}

  const onMessage = message => {
    server.handleMessage(message, response => postPortMessage(port, response))
  }
  const onEvent = event => onMessage(dataFromMessage(event))
  const previousOnMessage = port.onmessage

  if (typeof port.on === 'function') port.on('message', onMessage)
  if (typeof port.addEventListener === 'function') port.addEventListener('message', onEvent)
  if ('onmessage' in port) port.onmessage = onEvent

  const unbind = () => {
    if (typeof port.off === 'function') port.off('message', onMessage)
    else if (typeof port.removeListener === 'function') port.removeListener('message', onMessage)
    if (typeof port.removeEventListener === 'function') port.removeEventListener('message', onEvent)
    if ('onmessage' in port && port.onmessage === onEvent) port.onmessage = previousOnMessage || null
  }
  server.unbind = unbind
  return unbind
}

function detectPearCupWorkerPort (rootObject = globalThis) {
  if (!rootObject) return null
  return rootObject.PearCupWorkerPort ||
    rootObject.__PEARCUP_WORKER_PORT__ ||
    rootObject.PearCupWorkerBridgePort ||
    (rootObject.Pear && rootObject.Pear.worker) ||
    (rootObject.Pear && rootObject.Pear.bridgeWorker) ||
    (rootObject.Bare && rootObject.Bare.worker) ||
    null
}

function exposePearCupWorkerBridge (rootObject, server) {
  if (!rootObject || !server) return server
  rootObject.PearCupWorkerBridgeServer = server
  rootObject.PearCupWorkerBridge = {
    protocol: protocolVersion,
    request: message => server.request(message),
    status: () => server.status(),
    close: () => server.close()
  }
  return server
}

function startPearCupWorkerBridge (opts = {}) {
  const rootObject = opts.rootObject || globalThis
  const server = createPearCupWorkerBridgeServer(opts)
  const port = opts.port || detectPearCupWorkerPort(rootObject)
  if (port) bindPearCupWorkerPort(port, server)
  if (opts.expose !== false) exposePearCupWorkerBridge(rootObject, server)
  return server
}

const api = {
  protocolVersion,
  normalizeEnvelopeMessage,
  createPearCupWorkerBridgeServer,
  bindPearCupWorkerPort,
  detectPearCupWorkerPort,
  exposePearCupWorkerBridge,
  startPearCupWorkerBridge
}

module.exports = api

if (require.main === module) {
  startPearCupWorkerBridge()
}
