const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')

const peerMatchSource = readFileSync(join(__dirname, 'peer-match.js'), 'utf8')

function createHub () {
  const topics = new Map()
  return {
    join (topic) {
      const listeners = new Set()
      const endpoint = {
        topic,
        send (msg) {
          setTimeout(() => {
            for (const peer of topics.get(topic) || []) {
              for (const listener of peer.listeners) listener({ ...msg })
            }
          }, 0)
        },
        onMessage (fn) {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
        close () {
          topics.get(topic)?.delete(endpoint)
        },
        listeners
      }
      if (!topics.has(topic)) topics.set(topic, new Set())
      topics.get(topic).add(endpoint)
      return endpoint
    }
  }
}

function createDocument ({ baseHref } = {}) {
  const ids = new Map()

  class Element {
    constructor (tag) {
      this.tagName = tag.toUpperCase()
      this.children = []
      this.attributes = {}
      this.style = {}
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
      for (const match of this._innerHTML.matchAll(/\bid=["']([^"']+)["']/g)) {
        const child = new Element('button')
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
      if (this.parentNode) {
        this.parentNode.children = this.parentNode.children.filter(child => child !== this)
      }
      if (this._id) ids.delete(this._id)
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
  }

  const body = new Element('body')
  const base = baseHref ? { href: baseHref } : null
  return {
    body,
    documentElement: { dataset: {} },
    createElement: tag => new Element(tag),
    querySelector: selector => {
      if (selector === 'base[href]') return base
      if (selector.startsWith('#')) return ids.get(selector.slice(1)) || null
      return null
    },
    addEventListener () {},
    removeEventListener () {}
  }
}

function createClient ({ hub, peerId, name, team, href = 'http://127.0.0.1:4186/', baseHref = null }) {
  const document = createDocument({ baseHref })
  const toasts = []
  const views = []
  const browserSetTimeout = (fn, ms, ...args) => {
    const delay = ms > 100 && ms < 5000 ? 0 : ms
    const timer = setTimeout(fn, delay, ...args)
    if (timer && typeof timer.unref === 'function') timer.unref()
    return timer
  }
  const context = {
    console,
    document,
    location: { href },
    URL,
    navigator: {},
    setTimeout: browserSetTimeout,
    clearTimeout,
    requestAnimationFrame: fn => setTimeout(fn, 0),
    state: { username: name, team },
    PearCupPeerNet: {
      GAME_TOPIC: id => `pearcup:v1:game:${id}`,
      newRoomCode: () => 'room42',
      newPeerId: () => peerId,
      newNonce: () => `${peerId}-nonce`,
      commitHash: (aim, nonce) => `${aim}|${nonce}`,
      createChannel: topic => hub.join(topic)
    },
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
    escapeHtml: value => String(value)
  }
  context.window = context
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(peerMatchSource, context, { filename: 'peer-match.js' })
  return { context, document, toasts, views }
}

function waitFor (predicate, label) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > 1000) return reject(new Error(`timed out waiting for ${label}`))
      setTimeout(tick, 5)
    }
    tick()
  })
}

async function startPeerMatch () {
  const hub = createHub()
  const host = createClient({ hub, peerId: 'a-host', name: 'Host', team: 'br' })
  const guest = createClient({ hub, peerId: 'b-guest', name: 'Guest', team: 'jp' })

  host.context.PearCupPeerMatch.host('room42')
  guest.context.PearCupPeerMatch.join('room42')

  await waitFor(() => {
    return host.context.PearCupPeerMatch._state.started &&
      guest.context.PearCupPeerMatch._state.started
  }, 'peer match start')

  return { host, guest }
}

async function driveGoalKick ({ shooter, keeper, nextKick, label }) {
  shooter.context.PearCupPeerMatch.onZone('left-high')

  await waitFor(() => {
    return keeper.context.PearCupPeerMatch._state.remoteCommit === 'left-high|' +
      `${shooter.context.PearCupPeerMatch._state.self.peerId}-nonce`
  }, `${label} keeper receives commit`)

  keeper.context.PearCupPeerMatch.onZone('right-high')

  await waitFor(() => {
    return shooter.context.PearCupPeerMatch._state.kIndex === nextKick &&
      keeper.context.PearCupPeerMatch._state.kIndex === nextKick
  }, `${label} resolved`)
}

test('Penalty Clash invite uses hyper URL from PearBrowser launch path', () => {
  const hub = createHub()
  const driveKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  const host = createClient({
    hub,
    peerId: 'a-host',
    name: 'Host',
    team: 'br',
    href: `http://127.0.0.1:17208/app/${driveKey}/`,
    baseHref: `http://127.0.0.1:17208/app/${driveKey}/`
  })

  host.context.PearCupPeerMatch.host('room42')

  const modal = host.document.querySelector('#peerModal')
  assert.ok(modal)
  assert.match(modal.innerHTML, new RegExp(`hyper://${driveKey}/\\?join=room42`))
  assert.doesNotMatch(modal.innerHTML, /127\.0\.0\.1:17208/)
})

test('Penalty Clash invite keeps localhost URL for plain preview fallback', () => {
  const hub = createHub()
  const host = createClient({
    hub,
    peerId: 'a-host',
    name: 'Host',
    team: 'br',
    href: 'http://127.0.0.1:4186/games?debug=1#local'
  })

  host.context.PearCupPeerMatch.host('room42')

  const modal = host.document.querySelector('#peerModal')
  assert.ok(modal)
  assert.match(modal.innerHTML, /http:\/\/127\.0\.0\.1:4186\/games\?join=room42/)
  assert.doesNotMatch(modal.innerHTML, /debug=1|#local/)
})

test('Penalty Clash host and guest handshake into a peer match', async () => {
  const { host, guest } = await startPeerMatch()

  assert.equal(host.context.PearCupPeerMatch._state.code, 'room42')
  assert.equal(guest.context.PearCupPeerMatch._state.code, 'room42')
  assert.equal(host.document.documentElement.dataset.pearcupPeerMatchModule, 'ready')
  assert.equal(guest.document.documentElement.dataset.pearcupPeerMatchModule, 'ready')
  assert.equal(host.document.documentElement.dataset.pearcupPeerMatchState, 'started')
  assert.equal(guest.document.documentElement.dataset.pearcupPeerMatchState, 'started')
  assert.equal(host.document.documentElement.dataset.pearcupPeerMatchActive, 'true')
  assert.equal(guest.document.documentElement.dataset.pearcupPeerMatchActive, 'true')
  assert.equal(host.document.documentElement.dataset.pearcupPeerMatchStarted, 'true')
  assert.equal(guest.document.documentElement.dataset.pearcupPeerMatchStarted, 'true')
  assert.equal(host.document.documentElement.dataset.pearcupPeerMatchCode, 'room42')
  assert.equal(guest.document.documentElement.dataset.pearcupPeerMatchCode, 'room42')
  assert.equal(host.context.PearCupPeerMatch._state.role, 'A')
  assert.equal(guest.context.PearCupPeerMatch._state.role, 'B')
  assert.equal(host.document.documentElement.dataset.pearcupPeerMatchRole, 'A')
  assert.equal(guest.document.documentElement.dataset.pearcupPeerMatchRole, 'B')
  assert.equal(host.context.state.match.peer, true)
  assert.equal(guest.context.state.match.peer, true)
  assert.equal(host.context.state.match.opponent.name, 'Guest')
  assert.equal(guest.context.state.match.opponent.name, 'Host')
  assert.equal(host.context.state.shootout.mode, 'shoot')
  assert.equal(guest.context.state.shootout.mode, 'keep')
  assert.ok(host.views.includes('games'))
  assert.ok(guest.views.includes('games'))
  assert.equal(host.document.querySelector('#peerModal'), null)
  assert.equal(guest.document.querySelector('#peerModal'), null)
  assert.ok(host.toasts.some(message => /Connected to Guest/.test(message)))
  assert.ok(guest.toasts.some(message => /Connected to Host/.test(message)))
})

test('Penalty Clash peers resolve a shot and advance both clients to the next kick', async () => {
  const { host, guest } = await startPeerMatch()

  await driveGoalKick({ shooter: host, keeper: guest, nextKick: 1, label: 'first kick' })

  assert.equal(host.context.state.shootout.you, 1)
  assert.equal(host.context.state.shootout.opp, 0)
  assert.deepEqual(Array.from(host.context.state.shootout.youDots), ['goal'])
  assert.deepEqual(Array.from(host.context.state.shootout.oppDots), [])
  assert.equal(host.context.state.shootout.mode, 'keep')
  assert.equal(host.context.state.shootout.phase, 'aim')

  assert.equal(guest.context.state.shootout.you, 0)
  assert.equal(guest.context.state.shootout.opp, 1)
  assert.deepEqual(Array.from(guest.context.state.shootout.youDots), [])
  assert.deepEqual(Array.from(guest.context.state.shootout.oppDots), ['goal'])
  assert.equal(guest.context.state.shootout.mode, 'shoot')
  assert.equal(guest.context.state.shootout.phase, 'aim')
})

test('Penalty Clash peers complete best of five without turn desync', async () => {
  const { host, guest } = await startPeerMatch()

  for (let kick = 0; kick < 10; kick++) {
    const hostShoots = kick % 2 === 0
    await driveGoalKick({
      shooter: hostShoots ? host : guest,
      keeper: hostShoots ? guest : host,
      nextKick: kick + 1,
      label: `kick ${kick + 1}`
    })
  }

  assert.equal(host.context.PearCupPeerMatch._state.over, true)
  assert.equal(guest.context.PearCupPeerMatch._state.over, true)
  assert.equal(host.context.state.shootout.phase, 'over')
  assert.equal(guest.context.state.shootout.phase, 'over')

  assert.equal(host.context.state.shootout.you, 5)
  assert.equal(host.context.state.shootout.opp, 5)
  assert.deepEqual(Array.from(host.context.state.shootout.youDots), ['goal', 'goal', 'goal', 'goal', 'goal'])
  assert.deepEqual(Array.from(host.context.state.shootout.oppDots), ['goal', 'goal', 'goal', 'goal', 'goal'])

  assert.equal(guest.context.state.shootout.you, 5)
  assert.equal(guest.context.state.shootout.opp, 5)
  assert.deepEqual(Array.from(guest.context.state.shootout.youDots), ['goal', 'goal', 'goal', 'goal', 'goal'])
  assert.deepEqual(Array.from(guest.context.state.shootout.oppDots), ['goal', 'goal', 'goal', 'goal', 'goal'])

  assert.ok(host.toasts.some(message => /Level with Guest 5–5/.test(message)))
  assert.ok(guest.toasts.some(message => /Level with Host 5–5/.test(message)))
})
