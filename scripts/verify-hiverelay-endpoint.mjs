#!/usr/bin/env node
// Exercise the production-facing HiveRelay HTTP/SSE swarm contract without
// exposing the issued token or persisting a room. The two temporary channels
// are always left before the process exits.

import { randomBytes } from 'node:crypto'

const base = normalizeBase(process.env.PEARCUP_HIVERELAY_URL || process.argv[2] || '')
if (!base) throw new Error('Set PEARCUP_HIVERELAY_URL to the public HTTPS HiveRelay endpoint')

const token = await issueToken()
const status = await request('/api/bridge/status')
assert(status.ready === true && status.service === 'outboxlog', 'bridge status did not identify ready OutboxLog')

let first = null
let second = null
let stream = null
try {
  // The live node can be checked concurrently by CI or another operator.
  // A random topic prevents a just-closing prior probe from being mistaken
  // for this invocation's own exact-delivery assertion.
  const topicHex = randomBytes(32).toString('hex')
  first = await request('/api/swarm/join', { topicHex, protocol: 'pearcup-sync-v2', version: 2, server: true, client: true })
  second = await request('/api/swarm/join', { topicHex, protocol: 'pearcup-sync-v2', version: 2, server: true, client: true })
  assert(first.channelId && second.channelId, 'relay did not allocate test channels')
  stream = await openSse(`/api/swarm/events?channelId=${encodeURIComponent(second.channelId)}&token=${encodeURIComponent(token)}`)
  const data = Buffer.from(JSON.stringify({ v: 2, id: 'pearcup-public-contract', body: { kind: 'probe' } })).toString('base64')
  await request('/api/swarm/send', { channelId: first.channelId, peerId: second.channelId, data })
  const message = await stream.next(event => event.type === 'message')
  assert(message.peerId === first.channelId && message.data === data, 'relay did not deliver the exact frame')
  console.log(JSON.stringify({ ok: true, relay: base, service: 'outboxlog', contract: 'pearcup-sync-v2', sse: true }))
} finally {
  stream?.close()
  if (first?.channelId) await request('/api/swarm/leave', { channelId: first.channelId }).catch(() => {})
  if (second?.channelId) await request('/api/swarm/leave', { channelId: second.channelId }).catch(() => {})
}

function normalizeBase (value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return ''
    return url.href.slice(0, -1)
  } catch {
    return ''
  }
}

async function issueToken () {
  const response = await fetch(base + '/api/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  const body = await response.json().catch(() => null)
  assert(
    response.ok && body?.token,
    body?.error || `relay did not issue a token (${response.status}${response.headers.get('retry-after') ? `; retry-after ${response.headers.get('retry-after')}s` : ''})`
  )
  return body.token
}

async function request (path, body) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-pear-token': token, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  const payload = await response.json().catch(() => null)
  assert(response.ok, payload?.error || `relay request failed (${response.status})`)
  return payload
}

async function openSse (path) {
  const abort = new AbortController()
  const response = await fetch(base + path, { signal: abort.signal, headers: { accept: 'text/event-stream' } })
  assert(response.ok && response.body, `relay SSE failed (${response.status})`)
  const decoder = new TextDecoder()
  const queue = []
  let buffer = ''
  const reader = response.body.getReader()
  const pump = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let boundary
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const line = block.split('\n').find(value => value.startsWith('data: '))
          if (!line) continue
          try { queue.push(JSON.parse(line.slice('data: '.length))) } catch {}
        }
      }
    } catch (error) {
      if (!abort.signal.aborted) throw error
    }
  })()
  return {
    async next (predicate = () => true) {
      const deadline = Date.now() + 6000
      while (Date.now() < deadline) {
        const index = queue.findIndex(predicate)
        if (index >= 0) return queue.splice(index, 1)[0]
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      throw new Error('timed out waiting for HiveRelay SSE event')
    },
    close () {
      abort.abort()
      reader.cancel().catch(() => {})
      pump.catch(() => {})
    }
  }
}

function assert (condition, message) {
  if (!condition) throw new Error(message)
}
