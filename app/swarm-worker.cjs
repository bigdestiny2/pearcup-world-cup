'use strict'
// Bare worker: hyperswarm ↔ renderer bridge.
//
// The renderer (peer-net.js) can't run hyperswarm (UDP), so this Bare worker joins
// swarm topics on its behalf and relays messages over the Pear worker pipe. One worker
// multiplexes every app topic (game code, watch key, lobby); messages are tagged with
// their topic so the renderer's createChannel(topic) delivers only its own.
//
// Wire protocol (newline-delimited JSON both directions):
//   renderer → worker:  {cmd:'join'|'send'|'leave', topic, data?}
//   worker → renderer:  {event:'message'|'peers'|'joined', topic?, data?, count?}
//
// createSwarmBridge(pipe, {Hyperswarm, crypto, b4a}) is exported so the same logic is
// unit-tested in Node with two in-process swarms; under Pear it auto-starts on the pipe.

function createSwarmBridge (pipe, deps) {
  const Hyperswarm = deps.Hyperswarm
  const crypto = deps.crypto
  const b4a = deps.b4a
  const swarm = new Hyperswarm()
  const conns = new Set()
  const joined = new Set()

  const topicKey = name => crypto.data(b4a.from(String(name)))
  const toRenderer = obj => { try { pipe.write(b4a.from(JSON.stringify(obj) + '\n')) } catch (e) {} }
  const peersUpdate = () => toRenderer({ event: 'peers', count: conns.size })

  function framed (chunkEmitter, onLine) {
    let buf = ''
    chunkEmitter.on('data', d => {
      buf += b4a.toString(d)
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1)
        if (line) { try { onLine(JSON.parse(line)) } catch (e) {} }
      }
    })
  }

  swarm.on('connection', conn => {
    conns.add(conn)
    peersUpdate()
    conn.on('error', () => {})
    conn.on('close', () => { conns.delete(conn); peersUpdate() })
    framed(conn, m => toRenderer({ event: 'message', topic: m.topic, data: m.data }))
  })

  framed(pipe, m => {
    if (m.cmd === 'join') {
      if (joined.has(m.topic)) return
      joined.add(m.topic)
      const disc = swarm.join(topicKey(m.topic), { server: true, client: true })
      if (disc && disc.flushed) disc.flushed().then(() => toRenderer({ event: 'joined', topic: m.topic })).catch(() => {})
    } else if (m.cmd === 'send') {
      const frame = b4a.from(JSON.stringify({ topic: m.topic, data: m.data }) + '\n')
      for (const c of conns) { try { c.write(frame) } catch (e) {} }
    } else if (m.cmd === 'leave') {
      // Topics are cheap to keep for the session; explicit leave is a no-op for now.
    }
  })

  return { swarm, conns, destroy: () => swarm.destroy() }
}

module.exports = { createSwarmBridge }

// Auto-start under the Pear runtime (Bare) with the worker pipe.
if (typeof Pear !== 'undefined' && Pear.worker && typeof Pear.worker.pipe === 'function') {
  const Hyperswarm = require('hyperswarm')
  const crypto = require('hypercore-crypto')
  const b4a = require('b4a')
  createSwarmBridge(Pear.worker.pipe(), { Hyperswarm, crypto, b4a })
}
