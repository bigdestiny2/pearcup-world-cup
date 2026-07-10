#!/usr/bin/env node
// Verify the exact HiveRelay OutboxLog HTTP/SSE swarm contract PearCup uses.
// This is deliberately a local, disposable relay: no production endpoint or
// credentials are touched. Set HIVERELAY_ROOT when the core repo is elsewhere.

import { createServer, get as httpGet } from 'node:http'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const pearCupRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hiverelayRoot = resolve(process.env.HIVERELAY_ROOT || join(pearCupRoot, '..', '..', '..', '00-core', 'hiverelay'))
const servicePath = join(hiverelayRoot, 'packages/services/builtin/outboxlog/index.js')
const adapterPath = join(hiverelayRoot, 'packages/services/builtin/outboxlog/http-adapter.js')

if (!existsSync(servicePath) || !existsSync(adapterPath)) {
  throw new Error(`HiveRelay source not found at ${hiverelayRoot}. Set HIVERELAY_ROOT to a checkout containing OutboxLog.`)
}

const { OutboxLogApp } = await import(pathToFileURL(servicePath).href)
const { createOutboxLogHttpHandler, createOutboxLogTokenAuth } = await import(pathToFileURL(adapterPath).href)
const app = new OutboxLogApp({ verifyAppend: () => true })
const handler = createOutboxLogHttpHandler({
  outboxLogApp: app,
  auth: createOutboxLogTokenAuth(),
  allowOrigin: '*',
  rateLimit: { max: 1000, windowMs: 60_000 }
})

const server = createServer(async (req, res) => {
  const handled = await handler(req, res)
  if (!handled) {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  }
})

try {
  const address = await listen(server)
  const base = `http://127.0.0.1:${address.port}`
  const token = await issueToken(base)
  const status = await request(base, '/api/bridge/status', token)
  assert(status.ready === true && status.service === 'outboxlog', 'bridge status did not identify OutboxLog')

  const topicHex = 'a'.repeat(64)
  const first = await request(base, '/api/swarm/join', token, { topicHex, protocol: 'pearcup-sync-v2', version: 2, server: true, client: true })
  const second = await request(base, '/api/swarm/join', token, { topicHex, protocol: 'pearcup-sync-v2', version: 2, server: true, client: true })
  assert(first.channelId && second.channelId, 'relay did not allocate swarm channels')

  const sse = openSse(`${base}/api/swarm/events?channelId=${encodeURIComponent(second.channelId)}&token=${encodeURIComponent(token)}`)
  await sse.ready
  const message = Buffer.from(JSON.stringify({ v: 2, id: 'conformance-frame', body: { t: 'hello' } })).toString('base64')
  await request(base, '/api/swarm/send', token, { channelId: first.channelId, peerId: second.channelId, data: message })
  const delivered = await sse.next(event => event.type === 'message')
  assert(delivered.peerId === first.channelId && delivered.data === message, 'relay did not deliver the exact swarm frame')

  await request(base, '/api/swarm/leave', token, { channelId: first.channelId })
  await request(base, '/api/swarm/leave', token, { channelId: second.channelId })
  sse.close()
  console.log(JSON.stringify({ ok: true, service: 'outboxlog', contract: 'pearcup-sync-v2', relay: 'local-disposable' }))
} finally {
  try { await app.stop() } catch {}
  await close(server)
}

async function issueToken (base) {
  const response = await fetch(base + '/api/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  })
  const body = await response.json()
  assert(response.ok && body && body.token, 'relay did not issue a token')
  return body.token
}

async function request (base, path, token, body) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'x-pear-token': token,
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  const payload = await response.json()
  assert(response.ok, payload && payload.error ? payload.error : `request failed (${response.status})`)
  return payload
}

function openSse (url) {
  const queued = []
  let buffer = ''
  let readyResolve = null
  let readyReject = null
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject })
  const request = httpGet(url, response => {
    if (response.statusCode !== 200) {
      readyReject(new Error(`relay SSE failed (${response.statusCode})`))
      response.resume()
      return
    }
    response.setEncoding('utf8')
    response.on('data', chunk => {
      buffer += chunk
      let boundary
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const line = block.split('\n').find(value => value.startsWith('data: '))
        if (!line) continue
        try { queued.push(JSON.parse(line.slice('data: '.length))) } catch {}
      }
    })
    readyResolve()
  })
  request.on('error', readyReject)
  return {
    ready,
    async next (predicate = () => true) {
      const deadline = Date.now() + 2000
      while (Date.now() < deadline) {
        const existing = queued.findIndex(predicate)
        if (existing >= 0) return queued.splice(existing, 1)[0]
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      throw new Error('timed out waiting for relay SSE event')
    },
    close () { request.destroy() }
  }
}

function listen (server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve(server.address())
    })
  })
}

function close (server) {
  return new Promise(resolve => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    server.close(done)
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
    setTimeout(done, 250)
  })
}

function assert (condition, message) {
  if (!condition) throw new Error(message)
}
