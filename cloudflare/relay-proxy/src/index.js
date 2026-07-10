// HTTPS edge gateway for PearCup's dedicated HiveRelay OutboxLog node.
//
// This Worker is intentionally a very small allow-list proxy. It does not
// authenticate players, inspect frames, create tokens, or expose a general
// HTTP proxy. HiveRelay remains the authority for its token/rate-limit rules;
// the browser gets a stable HTTPS origin for the HTTP/SSE transport.

const ROUTES = new Map([
  ['/api/token', new Set(['POST'])],
  ['/api/bridge/status', new Set(['GET'])],
  ['/api/swarm/join', new Set(['POST'])],
  ['/api/swarm/send', new Set(['POST'])],
  ['/api/swarm/leave', new Set(['POST'])],
  ['/api/swarm/events', new Set(['GET'])]
])

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-pear-token',
  'access-control-max-age': '86400',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
}

export function routeAllowed (method, pathname) {
  return ROUTES.get(pathname)?.has(method.toUpperCase()) === true
}

export function relayTarget (origin, requestUrl) {
  const base = new URL(origin)
  if (base.protocol !== 'http:' && base.protocol !== 'https:') throw new Error('RELAY_ORIGIN must use HTTP(S)')
  if (base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('RELAY_ORIGIN must be a bare origin')
  const request = new URL(requestUrl)
  base.pathname = request.pathname
  base.search = request.search
  return base
}

function corsResponse (status = 204) {
  return new Response(null, { status, headers: CORS_HEADERS })
}

function errorResponse (status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8' }
  })
}

function proxyHeaders (incoming) {
  const headers = new Headers(incoming)
  // Cloudflare supplies the origin host from the target URL. Do not forward
  // browser credentials or a client-controlled hop-by-hop connection header.
  headers.delete('host')
  headers.delete('cookie')
  headers.delete('connection')
  headers.delete('content-length')
  return headers
}

export default {
  async fetch (request, env) {
    const requestUrl = new URL(request.url)
    if (request.method === 'OPTIONS') {
      if (!ROUTES.has(requestUrl.pathname)) return errorResponse(404, 'relay route not found')
      return corsResponse()
    }
    if (!routeAllowed(request.method, requestUrl.pathname)) return errorResponse(404, 'relay route not found')
    if (!env.RELAY_ORIGIN) return errorResponse(503, 'relay origin is not configured')

    let target
    try {
      target = relayTarget(env.RELAY_ORIGIN, request.url)
    } catch {
      return errorResponse(503, 'relay origin is invalid')
    }

    try {
      const upstream = await fetch(target, {
        method: request.method,
        headers: proxyHeaders(request.headers),
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body
      })
      const headers = new Headers(upstream.headers)
      for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value)
      // Never cache a short-lived relay token, an SSE stream, or a room frame.
      headers.set('cache-control', 'no-store')
      return new Response(upstream.body, { status: upstream.status, headers })
    } catch {
      return errorResponse(502, 'relay upstream is unavailable')
    }
  }
}
