// PearCup live peer transport.
//
// A minimal channel surface — { topic, send(msg), onMessage(fn), close() } — with
// two backends:
//   • BroadcastChannel: works across tabs/windows of the same origin in one browser.
//     This is enough to play a REAL two-client match tonight (two windows, or two
//     tabs), and to verify the protocol end-to-end.
//   • Pear/hyperswarm (production): the same surface is provided by joining a swarm
//     topic through the worker bridge (worker-client.js → pear-worker.cjs). To swap,
//     implement createChannel() to `swarm.join(topicBuffer)` and pipe connection
//     data frames to onMessage / send. Nothing else in peer-match.js changes.
//
// Topic naming matches the settlement transport convention: pearcup:v1:game:<id>.
(function attachPearCupPeerNet (root) {
  const GAME_TOPIC = id => `pearcup:v1:game:${id}`
  const WATCH_TOPIC = id => `pearcup:v1:watch:${id}`

  const hasBroadcast = typeof root.BroadcastChannel === 'function'

  // ---- Hyperswarm backend (cross-device) via the Bare worker, when under Pear ----
  const swarm = { pipe: null, tried: false, ready: false, buf: '', listeners: new Set(), peers: 0 }
  function initSwarm () {
    if (swarm.tried) return swarm.ready
    swarm.tried = true
    try {
      const Pear = root.Pear
      if (Pear && Pear.worker && typeof Pear.worker.run === 'function') {
        swarm.pipe = Pear.worker.run('./swarm-worker.cjs')
        swarm.pipe.on('data', d => {
          swarm.buf += (typeof d === 'string' ? d : d.toString())
          let i
          while ((i = swarm.buf.indexOf('\n')) >= 0) {
            const line = swarm.buf.slice(0, i); swarm.buf = swarm.buf.slice(i + 1)
            if (!line) continue
            try {
              const m = JSON.parse(line)
              if (m.event === 'peers') swarm.peers = m.count
              swarm.listeners.forEach(fn => { try { fn(m) } catch (e) {} })
            } catch (e) {}
          }
        })
        swarm.ready = true
      }
    } catch (e) { swarm.ready = false }
    return swarm.ready
  }
  function swarmSend (obj) { if (swarm.pipe) { try { swarm.pipe.write(JSON.stringify(obj) + '\n') } catch (e) {} } }

  function createChannel (topic) {
    // Prefer hyperswarm (real cross-device) under the Pear runtime.
    if (initSwarm()) {
      const listeners = new Set()
      const onMsg = m => { if (m.event === 'message' && m.topic === topic) listeners.forEach(fn => { try { fn(m.data) } catch (e) {} }) }
      swarm.listeners.add(onMsg)
      swarmSend({ cmd: 'join', topic })
      return {
        topic,
        backend: 'hyperswarm',
        send (msg) { swarmSend({ cmd: 'send', topic, data: msg }) },
        onMessage (fn) { listeners.add(fn); return () => listeners.delete(fn) },
        close () { swarm.listeners.delete(onMsg); swarmSend({ cmd: 'leave', topic }) }
      }
    }
    // Fallback: BroadcastChannel (same-origin windows/tabs — dev + same-browser play).
    const listeners = new Set()
    let bc = null
    if (hasBroadcast) {
      bc = new root.BroadcastChannel(topic)
      bc.onmessage = ev => listeners.forEach(fn => { try { fn(ev.data) } catch (e) { /* listener error */ } })
    }
    return {
      topic,
      backend: hasBroadcast ? 'broadcast-channel' : 'noop',
      send (msg) { if (bc) bc.postMessage(msg) },
      onMessage (fn) { listeners.add(fn); return () => listeners.delete(fn) },
      close () { try { if (bc) bc.close() } catch (e) { /* already closed */ } listeners.clear() }
    }
  }

  // Short, human-shareable room code (invite link fragment).
  function newRoomCode () {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
    let out = ''
    // Deterministic-free randomness is fine for a room code (not security-critical).
    for (let i = 0; i < 6; i++) out += alphabet[(Math.random() * alphabet.length) | 0]
    return out
  }

  function newPeerId () {
    return `${Date.now().toString(36)}-${((Math.random() * 1e9) | 0).toString(36)}`
  }

  // djb2 string hash → hex. Used for commit-reveal (anti-peek in a friendly match).
  function digest (str) {
    let h = 5381
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
    return h.toString(16).padStart(8, '0')
  }
  function commitHash (aim, nonce) { return digest(`${aim}|${nonce}`) }
  function newNonce () { return `${((Math.random() * 1e9) | 0).toString(36)}${((Math.random() * 1e9) | 0).toString(36)}` }

  const api = { GAME_TOPIC, WATCH_TOPIC, createChannel, newRoomCode, newPeerId, commitHash, newNonce, digest }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupPeerNet = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupPeerNet = hasBroadcast ? 'broadcast-channel' : 'noop'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
