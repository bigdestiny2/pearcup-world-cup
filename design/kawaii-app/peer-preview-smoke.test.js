const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')

const peerNetSource = readFileSync(join(__dirname, 'peer-net.js'), 'utf8')
const peerMatchSource = readFileSync(join(__dirname, 'peer-match.js'), 'utf8')
const peerLobbySource = readFileSync(join(__dirname, 'peer-lobby.js'), 'utf8')
const watchSyncSource = readFileSync(join(__dirname, 'watch-sync.js'), 'utf8')

function createBroadcastHub () {
  const rooms = new Map()
  return class FakeBroadcastChannel {
    constructor (topic) {
      this.topic = topic
      this.onmessage = null
      if (!rooms.has(topic)) rooms.set(topic, new Set())
      rooms.get(topic).add(this)
    }

    postMessage (data) {
      for (const peer of rooms.get(this.topic) || []) {
        if (peer !== this && peer.onmessage) {
          setTimeout(() => peer.onmessage({ data: { ...data } }), 0)
        }
      }
    }

    close () {
      rooms.get(this.topic)?.delete(this)
    }
  }
}

function createLossyBroadcastHub (dropMessages = 2) {
  const rooms = new Map()
  let remainingDrops = dropMessages
  return class FakeBroadcastChannel {
    constructor (topic) {
      this.topic = topic
      this.onmessage = null
      if (!rooms.has(topic)) rooms.set(topic, new Set())
      rooms.get(topic).add(this)
    }

    postMessage (data) {
      if (remainingDrops > 0) {
        remainingDrops -= 1
        return
      }
      for (const peer of rooms.get(this.topic) || []) {
        if (peer !== this && peer.onmessage) {
          setTimeout(() => peer.onmessage({ data: { ...data } }), 0)
        }
      }
    }

    close () {
      rooms.get(this.topic)?.delete(this)
    }
  }
}

function createPearBrowserSwarmHub () {
  const rooms = new Map()
  const joins = []
  let nextId = 0

  function connectRoom (subtopic) {
    const endpoints = Array.from(rooms.get(subtopic) || []).filter(endpoint => !endpoint.destroyed)
    for (const endpoint of endpoints) {
      for (const remote of endpoints) {
        if (endpoint === remote) continue
        endpoint.emit('peer', {
          id: remote.id,
          send (data) {
            setTimeout(() => {
              if (!remote.destroyed) remote.emit('message', { id: endpoint.id }, data)
            }, 0)
          }
        })
      }
    }
  }

  function createEndpoint (subtopic) {
    const handlers = new Map()
    return {
      id: `pear-peer-${++nextId}`,
      subtopic,
      destroyed: false,
      on (event, fn) {
        if (!handlers.has(event)) handlers.set(event, new Set())
        handlers.get(event).add(fn)
      },
      emit (event, ...args) {
        for (const fn of handlers.get(event) || []) fn(...args)
      },
      destroy () {
        this.destroyed = true
        rooms.get(subtopic)?.delete(this)
        for (const endpoint of rooms.get(subtopic) || []) endpoint.emit('peer-leave', { id: this.id })
      }
    }
  }

  const pear = {
    swarm: {
      v1: {
        async join (topic, opts = {}) {
          joins.push({ topic, opts })
          const subtopic = opts.subtopic
          const endpoint = createEndpoint(subtopic)
          if (!rooms.has(subtopic)) rooms.set(subtopic, new Set())
          rooms.get(subtopic).add(endpoint)
          setTimeout(() => connectRoom(subtopic), 0)
          return endpoint
        }
      }
    }
  }

  return { pear, joins }
}

function createDocument ({ baseHref } = {}) {
  const ids = new Map()

  class Element {
    constructor (tag) {
      this.tagName = tag.toUpperCase()
      this.children = []
      this.attributes = {}
      this.style = { setProperty (name, value) { this[name] = value } }
      this.parentNode = null
      this._id = ''
      this._innerHTML = ''
      this.onclick = null
      this.hidden = false
      this.className = ''
      this.classList = {
        add: (...names) => {
          const set = new Set(String(this.className || '').split(/\s+/).filter(Boolean))
          for (const name of names) set.add(name)
          this.className = [...set].join(' ')
        },
        remove: (...names) => {
          const remove = new Set(names)
          this.className = String(this.className || '').split(/\s+/).filter(name => !remove.has(name)).join(' ')
        },
        toggle: (name, force) => {
          const set = new Set(String(this.className || '').split(/\s+/).filter(Boolean))
          const enabled = force == null ? !set.has(name) : Boolean(force)
          if (enabled) set.add(name)
          else set.delete(name)
          this.className = [...set].join(' ')
          return enabled
        }
      }
    }

    set id (value) {
      if (this._id) ids.delete(this._id)
      this._id = value
      if (value) ids.set(value, this)
    }

    get id () {
      return this._id
    }

    set innerHTML (value) {
      this._innerHTML = String(value)
      this.children = []
      for (const match of this._innerHTML.matchAll(/\bid=["']([^"']+)["']/g)) {
        const child = new Element('div')
        child.id = match[1]
        child.parentNode = this
        this.children.push(child)
      }
    }

    get innerHTML () {
      return this._innerHTML
    }

    setAttribute (name, value) {
      this.attributes[name] = String(value)
      if (name === 'id') this.id = String(value)
    }

    appendChild (child) {
      child.parentNode = this
      this.children.push(child)
      return child
    }

    remove () {
      const unregister = node => {
        if (node._id) ids.delete(node._id)
        for (const child of node.children) unregister(child)
      }
      unregister(this)
      if (this.parentNode) {
        this.parentNode.children = this.parentNode.children.filter(child => child !== this)
      }
      this.parentNode = null
    }

    contains (needle) {
      if (needle === this) return true
      return this.children.some(child => child.contains(needle))
    }

    querySelector (selector) {
      if (selector.startsWith('#')) return ids.get(selector.slice(1)) || null
      return null
    }

    querySelectorAll () {
      return []
    }

    addEventListener () {
      this._hasListener = true
    }
  }

  const body = new Element('body')
  const base = baseHref ? { href: baseHref } : null
  return {
    body,
    documentElement: { dataset: {}, attributes: {}, setAttribute (name, value) { this.attributes[name] = String(value) } },
    createElement: tag => new Element(tag),
    querySelector: selector => {
      if (selector === 'base[href]') return base
      if (selector.startsWith('#')) return ids.get(selector.slice(1)) || null
      return null
    },
    querySelectorAll () { return [] },
    addEventListener () {},
    removeEventListener () {}
  }
}

function createClient ({ BroadcastChannel, pear, name, team, href = 'http://127.0.0.1:4186/', baseHref = null, fastIntervals = false }) {
  const document = createDocument({ baseHref })
  const toasts = []
  const views = []
  const browserSetTimeout = (fn, ms, ...args) => {
    const delay = ms > 100 && ms < 5000 ? 0 : ms
    const timer = setTimeout(fn, delay, ...args)
    if (timer && typeof timer.unref === 'function') timer.unref()
    return timer
  }
  const browserSetInterval = (fn, ms, ...args) => {
    const delay = fastIntervals && ms > 100 && ms < 5000 ? 0 : Math.max(ms, 1000000)
    const timer = setInterval(fn, delay, ...args)
    if (timer && typeof timer.unref === 'function') timer.unref()
    return timer
  }
  const context = {
    console,
    document,
    location: { href },
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    BroadcastChannel,
    pear,
    CustomEvent: class CustomEvent {
      constructor (type, init) {
        this.type = type
        this.detail = init && init.detail
      }
    },
    dispatchEvent () {},
    navigator: {},
    setTimeout: browserSetTimeout,
    clearTimeout,
    setInterval: browserSetInterval,
    clearInterval,
    requestAnimationFrame: fn => setTimeout(fn, 0),
    state: { username: name, team, chat: [], spectators: 1 },
    showToast: message => { toasts.push(message) },
    setView: view => { views.push(view) },
    ensureShootoutDom () {},
    teamById: id => ({ id, name: id, flag: id.toUpperCase() }),
    setScoreboard () {},
    hideShootBanner () {},
    renderShootoutHud () {},
    showAimGrid () {},
    startPowerMeter () {},
    hideAimGrid () {},
    stopPowerMeter () {},
    showShootBanner () {},
    ensureShootout () {},
    hideOverlay () {},
    renderGames () {},
    readPowerPct: () => 72,
    zonePosition: zone => {
      const [side, height] = String(zone).split('-')
      return {
        x: side === 'left' ? 30 : side === 'right' ? 70 : 50,
        y: height === 'high' ? 22 : 40
      }
    },
    kickEntropy: (aim, dive, nonce) => `${aim}|${dive}|${nonce}`.length,
    kickOutcome: (aim, dive, power) => {
      if (aim !== dive) return 'goal'
      return power >= 86 ? 'goal' : 'save'
    },
    overBarY: () => 4,
    fireConfetti () {},
    avatarSvg: user => `<svg aria-label="${user}"></svg>`,
    escapeHtml: value => String(value),
    closeModal () {},
    feedState: () => ({ home: { name: 'Brazil' }, away: { name: 'Norway' } }),
    renderWatch () { context.renderWatchCalls = (context.renderWatchCalls || 0) + 1 }
  }
  context.window = context
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(peerNetSource, context, { filename: 'peer-net.js' })
  vm.runInContext(peerMatchSource, context, { filename: 'peer-match.js' })
  vm.runInContext(peerLobbySource, context, { filename: 'peer-lobby.js' })
  vm.runInContext(watchSyncSource, context, { filename: 'watch-sync.js' })
  return { context, document, toasts, views }
}

function waitFor (predicate, label) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > 1500) return reject(new Error(`timed out waiting for ${label}`))
      setTimeout(tick, 5)
    }
    tick()
  })
}

async function waitForStartedMatch (host, guest) {
  await waitFor(() => {
    return host.context.PearCupPeerMatch._state.started &&
      guest.context.PearCupPeerMatch._state.started
  }, 'friend match handshake')

  assert.equal(host.context.state.match.peer, true)
  assert.equal(guest.context.state.match.peer, true)
  assert.ok(host.views.includes('games'))
  assert.ok(guest.views.includes('games'))
  assert.equal(host.document.querySelector('#peerModal'), null)
  assert.equal(guest.document.querySelector('#peerModal'), null)
  assert.ok(host.toasts.some(message => /Connected to Guest/.test(message)))
  assert.ok(guest.toasts.some(message => /Connected to Host/.test(message)))
}

async function driveFirstKick (host, guest) {
  const hostShoots = host.context.state.shootout.mode === 'shoot'
  const shooter = hostShoots ? host : guest
  const keeper = hostShoots ? guest : host
  const nextKick = shooter.context.PearCupPeerMatch._state.kIndex + 1

  shooter.context.PearCupPeerMatch.onZone('left-high')
  await waitFor(() => keeper.context.PearCupPeerMatch._state.remoteCommit, 'keeper commit')
  keeper.context.PearCupPeerMatch.onZone('right-high')
  await waitFor(() => {
    return host.context.PearCupPeerMatch._state.kIndex === nextKick &&
      guest.context.PearCupPeerMatch._state.kIndex === nextKick
  }, 'first kick resolution')

  assert.equal(host.context.state.shootout.you + host.context.state.shootout.opp, 1)
  assert.equal(guest.context.state.shootout.you + guest.context.state.shootout.opp, 1)
  assert.equal(host.context.state.shootout.phase, 'aim')
  assert.equal(guest.context.state.shootout.phase, 'aim')
}

function appendId (document, id) {
  const el = document.createElement('div')
  el.id = id
  document.body.appendChild(el)
  return el
}

test('preview PeerNet and PeerMatch integrate across two clients', async () => {
  const BroadcastChannel = createBroadcastHub()
  const host = createClient({ BroadcastChannel, name: 'Host', team: 'br' })
  const guest = createClient({ BroadcastChannel, name: 'Guest', team: 'jp' })

  host.context.PearCupPeerMatch.host('room42')
  const modal = host.document.querySelector('#peerModal')
  assert.ok(modal, 'host invite modal renders')
  assert.match(modal.innerHTML, /http:\/\/127\.0\.0\.1:4186\/\?join=room42/)
  assert.equal(host.document.documentElement.dataset.pearcupPeerNet, 'broadcast-channel')
  assert.equal(host.document.documentElement.dataset.pearcupPeerNetModule, 'ready')
  assert.equal(host.document.documentElement.dataset.pearcupPeerMatchModule, 'ready')

  guest.context.PearCupPeerMatch.join('room42')
  await waitForStartedMatch(host, guest)

  assert.equal(host.context.PearCupPeerMatch._state.channel.backend, 'broadcast-channel')
  assert.equal(guest.context.PearCupPeerMatch._state.channel.backend, 'broadcast-channel')
  await driveFirstKick(host, guest)

  host.context.PearCupPeerMatch.leave(true)
  guest.context.PearCupPeerMatch.leave(true)
})

test('preview PeerMatch re-announces when early browser hellos are dropped', async () => {
  const BroadcastChannel = createLossyBroadcastHub(2)
  const host = createClient({ BroadcastChannel, name: 'Host', team: 'br', fastIntervals: true })
  const guest = createClient({ BroadcastChannel, name: 'Guest', team: 'jp', fastIntervals: true })

  host.context.PearCupPeerMatch.host('lossy1')
  guest.context.PearCupPeerMatch.join('lossy1')

  await waitForStartedMatch(host, guest)
  assert.equal(host.context.PearCupPeerMatch._state.channel.backend, 'broadcast-channel')
  assert.equal(guest.context.PearCupPeerMatch._state.channel.backend, 'broadcast-channel')

  host.context.PearCupPeerMatch.leave(true)
  guest.context.PearCupPeerMatch.leave(true)
})

test('PearBrowser swarm PeerNet and PeerMatch integrate across two clients', async () => {
  const swarm = createPearBrowserSwarmHub()
  const driveKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  const launchUrl = `http://127.0.0.1:17208/app/${driveKey}/`
  const host = createClient({ pear: swarm.pear, name: 'Host', team: 'br', href: launchUrl, baseHref: launchUrl })
  const guest = createClient({ pear: swarm.pear, name: 'Guest', team: 'jp', href: launchUrl, baseHref: launchUrl })

  host.context.PearCupPeerMatch.host('room42')
  const modal = host.document.querySelector('#peerModal')
  assert.ok(modal, 'host invite modal renders')
  assert.match(modal.innerHTML, new RegExp(`hyper://${driveKey}/\\?join=room42`))
  assert.doesNotMatch(modal.innerHTML, /127\.0\.0\.1:17208/)
  assert.equal(host.document.documentElement.dataset.pearcupPeerNet, 'pearbrowser-swarm-v1')
  assert.equal(host.document.documentElement.dataset.pearcupPeerNetModule, 'ready')
  assert.equal(host.document.documentElement.dataset.pearcupPeerMatchModule, 'ready')

  guest.context.PearCupPeerMatch.join('room42')
  await waitForStartedMatch(host, guest)

  assert.equal(host.context.PearCupPeerMatch._state.channel.backend, 'pearbrowser-swarm-v1')
  assert.equal(guest.context.PearCupPeerMatch._state.channel.backend, 'pearbrowser-swarm-v1')
  assert.ok(swarm.joins.length >= 2)
  assert.equal(swarm.joins[0].topic, null)
  assert.equal(swarm.joins[0].opts.subtopic, 'pearcup:v1:game:room42')
  assert.equal(swarm.joins[0].opts.protocol, 'pearcup.peer-net.v1')
  assert.equal(swarm.joins[0].opts.server, true)
  assert.equal(swarm.joins[0].opts.client, true)
  await driveFirstKick(host, guest)

  host.context.PearCupPeerMatch.leave(true)
  guest.context.PearCupPeerMatch.leave(true)
})

test('PearBrowser swarm lobby challenge routes into a peer match', async () => {
  const swarm = createPearBrowserSwarmHub()
  const host = createClient({ pear: swarm.pear, name: 'Host', team: 'br' })
  const guest = createClient({ pear: swarm.pear, name: 'Guest', team: 'jp' })
  appendId(host.document, 'lobbyLivePeers')
  appendId(guest.document, 'lobbyLivePeers')

  host.context.PearCupLobby.join()
  guest.context.PearCupLobby.join()
  host.context.PearCupLobby.join()

  await waitFor(() => {
    return host.context.PearCupLobby.peerCount() === 1 &&
      guest.context.PearCupLobby.peerCount() === 1
  }, 'lobby peer presence')

  assert.equal(host.document.documentElement.dataset.pearcupPeerLobbyModule, 'ready')
  assert.equal(guest.document.documentElement.dataset.pearcupPeerLobbyModule, 'ready')
  assert.equal(host.context.PearCupLobby._state.channel.backend, 'pearbrowser-swarm-v1')
  assert.equal(guest.context.PearCupLobby._state.channel.backend, 'pearbrowser-swarm-v1')
  assert.match(host.document.querySelector('#lobbyLivePeers').innerHTML, /Guest/)
  assert.match(guest.document.querySelector('#lobbyLivePeers').innerHTML, /Host/)

  const guestPeerId = host.context.PearCupLobby._state.peers.values().next().value.peerId
  host.context.PearCupLobby.challenge(guestPeerId)
  await waitForStartedMatch(host, guest)
  assert.ok(guest.toasts.some(message => /challenged you/.test(message)))
  await driveFirstKick(host, guest)

  host.context.PearCupLobby.leave()
  guest.context.PearCupLobby.leave()
  host.context.PearCupPeerMatch.leave(true)
  guest.context.PearCupPeerMatch.leave(true)
})

test('PearBrowser swarm watch sync shares presence and chat', async () => {
  const swarm = createPearBrowserSwarmHub()
  const host = createClient({ pear: swarm.pear, name: 'Host', team: 'br' })
  const guest = createClient({ pear: swarm.pear, name: 'Guest', team: 'jp' })
  appendId(host.document, 'wrPeers')
  appendId(guest.document, 'wrPeers')
  appendId(host.document, 'spectatorCount')
  appendId(guest.document, 'spectatorCount')
  appendId(host.document, 'chatFeed')
  appendId(guest.document, 'chatFeed')

  host.context.PearCupWatchSync.ensureRoom()
  guest.context.PearCupWatchSync.ensureRoom()

  await waitFor(() => {
    return host.context.PearCupWatchSync.peerCount() === 2 &&
      guest.context.PearCupWatchSync.peerCount() === 2
  }, 'watch room presence')

  assert.equal(host.document.documentElement.dataset.pearcupWatchSyncModule, 'ready')
  assert.equal(guest.document.documentElement.dataset.pearcupWatchSyncModule, 'ready')
  assert.ok(swarm.joins.some(join => join.opts.subtopic === 'pearcup:v1:watch:brazil-norway'))
  assert.equal(host.context.state.spectators, 2)
  assert.equal(guest.context.state.spectators, 2)

  host.context.PearCupWatchSync.broadcastChat('Host', 'ready for kickoff', '20:15')
  await waitFor(() => {
    return guest.context.state.chat.some(line => line.user === 'Host' && line.text === 'ready for kickoff')
  }, 'watch chat delivery')
  assert.equal(guest.context.renderWatchCalls, 1)

  host.context.PearCupWatchSync.leave()
  guest.context.PearCupWatchSync.leave()
})

test('PearBrowser swarm watch room challenges wait for a friend response', async () => {
  const swarm = createPearBrowserSwarmHub()
  const host = createClient({ pear: swarm.pear, name: 'Host', team: 'br' })
  const guest = createClient({ pear: swarm.pear, name: 'Guest', team: 'jp' })
  appendId(host.document, 'watchChallengeList')
  appendId(guest.document, 'watchChallengeList')

  host.context.PearCupWatchSync.ensureRoom()
  guest.context.PearCupWatchSync.ensureRoom()

  await waitFor(() => {
    return host.context.PearCupWatchSync.peerCount() === 2 &&
      guest.context.PearCupWatchSync.peerCount() === 2
  }, 'watch room challenge presence')

  assert.match(host.document.querySelector('#watchChallengeList').innerHTML, /Guest/)
  assert.match(guest.document.querySelector('#watchChallengeList').innerHTML, /Host/)

  const guestPeerId = host.context.PearCupWatchSync._state.peers.values().next().value.peerId
  const hostPeerId = guest.context.PearCupWatchSync._state.peers.values().next().value.peerId
  host.context.PearCupWatchSync.challenge(guestPeerId)
  await waitFor(() => {
    return guest.context.PearCupWatchSync._state.incoming.has(hostPeerId) &&
      /Accept/.test(guest.document.querySelector('#watchChallengeList').innerHTML)
  }, 'watch room challenge request')
  assert.match(host.document.querySelector('#watchChallengeList').innerHTML, /waiting for accept/)
  assert.equal(host.context.PearCupPeerMatch._state.active, true)
  assert.equal(host.context.PearCupPeerMatch._state.started, false)

  guest.context.PearCupWatchSync.declineChallenge(hostPeerId)
  await waitFor(() => {
    return host.context.PearCupWatchSync._state.outgoing.size === 0 &&
      host.context.PearCupPeerMatch._state.active === false
  }, 'declined watch challenge reset')
  assert.ok(host.toasts.some(message => /declined/.test(message)))

  host.context.PearCupWatchSync.leave()
  guest.context.PearCupWatchSync.leave()
})

test('PearBrowser swarm watch room challenge requests can be accepted into Penalty Clash', async () => {
  const swarm = createPearBrowserSwarmHub()
  const host = createClient({ pear: swarm.pear, name: 'Host', team: 'br' })
  const guest = createClient({ pear: swarm.pear, name: 'Guest', team: 'jp' })
  appendId(host.document, 'watchChallengeList')
  appendId(guest.document, 'watchChallengeList')

  host.context.PearCupWatchSync.ensureRoom()
  guest.context.PearCupWatchSync.ensureRoom()

  await waitFor(() => {
    return host.context.PearCupWatchSync.peerCount() === 2 &&
      guest.context.PearCupWatchSync.peerCount() === 2
  }, 'watch room challenge presence')

  const guestPeerId = host.context.PearCupWatchSync._state.peers.values().next().value.peerId
  const hostPeerId = guest.context.PearCupWatchSync._state.peers.values().next().value.peerId
  host.context.PearCupWatchSync.challenge(guestPeerId)
  await waitFor(() => guest.context.PearCupWatchSync._state.incoming.has(hostPeerId), 'incoming watch challenge')
  assert.match(guest.document.querySelector('#watchChallengeList').innerHTML, /challenged you to Penalty Clash/)
  assert.match(guest.document.querySelector('#watchChallengeList').innerHTML, /Decline/)
  assert.match(host.document.querySelector('#watchChallengeList').innerHTML, /waiting for accept/)
  guest.context.PearCupWatchSync.acceptChallenge(hostPeerId)

  await waitFor(() => {
    return host.context.PearCupWatchSync._state.outgoing.get(guestPeerId)?.status === 'accepted'
  }, 'accepted watch challenge acknowledgement')
  assert.ok(guest.toasts.some(message => /challenged you/.test(message)))
  assert.ok(host.toasts.some(message => /accepted/.test(message)))
  await waitForStartedMatch(host, guest)
  await driveFirstKick(host, guest)

  host.context.PearCupWatchSync.leave()
  guest.context.PearCupWatchSync.leave()
  host.context.PearCupPeerMatch.leave(true)
  guest.context.PearCupPeerMatch.leave(true)
})

test('PearBrowser swarm watch sync relays screen share state', async () => {
  const swarm = createPearBrowserSwarmHub()
  const host = createClient({ pear: swarm.pear, name: 'Host', team: 'br' })
  const guest = createClient({ pear: swarm.pear, name: 'Guest', team: 'jp' })

  host.context.PearCupWatchSync.ensureRoom()
  guest.context.PearCupWatchSync.ensureRoom()

  await waitFor(() => {
    return host.context.PearCupWatchSync.peerCount() === 2 &&
      guest.context.PearCupWatchSync.peerCount() === 2
  }, 'watch room presence')

  host.context.PearCupWatchSync.broadcastScreen({ t: 'screen:start' })
  await waitFor(() => {
    const st = guest.context.PearCupWatchSync.screenShareState()
    return st.sharing === true && st.sharerName === 'Host'
  }, 'guest learned host is sharing screen')

  host.context.PearCupWatchSync.broadcastScreen({ t: 'screen:stop' })
  await waitFor(() => {
    return guest.context.PearCupWatchSync.screenShareState().sharing === false
  }, 'guest learned host stopped sharing')

  host.context.PearCupWatchSync.leave()
  guest.context.PearCupWatchSync.leave()
})
