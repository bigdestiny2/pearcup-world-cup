const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')

const voiceSource = readFileSync(join(__dirname, 'watch-voice.js'), 'utf8')

class EventTarget {
  constructor () { this.listeners = new Map() }

  addEventListener (type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(listener)
  }

  emit (type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener({ type, ...event })
  }
}

function classListFor (element) {
  return {
    add (...names) {
      const next = new Set(String(element.className || '').split(/\s+/).filter(Boolean))
      names.forEach(name => next.add(name))
      element.className = [...next].join(' ')
    },
    remove (...names) {
      const remove = new Set(names)
      element.className = String(element.className || '').split(/\s+/).filter(name => !remove.has(name)).join(' ')
    },
    toggle (name, force) {
      const next = new Set(String(element.className || '').split(/\s+/).filter(Boolean))
      const enabled = force == null ? !next.has(name) : Boolean(force)
      if (enabled) next.add(name)
      else next.delete(name)
      element.className = [...next].join(' ')
      return enabled
    },
    contains (name) { return String(element.className || '').split(/\s+/).includes(name) }
  }
}

class FakeElement extends EventTarget {
  constructor (tagName = 'div') {
    super()
    this.tagName = tagName.toUpperCase()
    this.dataset = {}
    this.attributes = {}
    this.children = []
    this.parentNode = null
    this.className = ''
    this.classList = classListFor(this)
    this.textContent = ''
    this.disabled = false
    this.hidden = false
    this.isContentEditable = false
    this.srcObject = null
  }

  appendChild (child) {
    child.parentNode = this
    this.children.push(child)
    return child
  }

  remove () {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this)
    this.parentNode = null
  }

  setAttribute (name, value) { this.attributes[name] = String(value) }
  getAttribute (name) { return this.attributes[name] || null }
  setPointerCapture () {}
  pause () { this.paused = true }
  play () { this.playCalls = (this.playCalls || 0) + 1; return Promise.resolve() }
  closest () { return null }
}

class FakeTrack extends EventTarget {
  constructor (kind = 'audio') {
    super()
    this.kind = kind
    this._enabled = true
    this.enabledHistory = [true]
    this.stopCalls = 0
  }

  get enabled () { return this._enabled }
  set enabled (value) { this._enabled = Boolean(value); this.enabledHistory.push(this._enabled) }
  stop () { this.stopCalls += 1 }
}

class FakeStream {
  constructor (tracks = [new FakeTrack('audio')]) { this.tracks = tracks }
  getAudioTracks () { return this.tracks.filter(track => track.kind === 'audio') }
  getTracks () { return [...this.tracks] }
}

function createFakePeerConnectionClass (instances) {
  return class FakeRTCPeerConnection {
    constructor (config) {
      this.config = config
      this.connectionState = 'new'
      this.signalingState = 'stable'
      this.senders = []
      this.addedCandidates = []
      this.closed = false
      instances.push(this)
    }

    getSenders () { return [...this.senders] }
    addTrack (track, stream) {
      this.senders.push({ track, stream })
      Promise.resolve().then(() => { if (this.onnegotiationneeded) this.onnegotiationneeded() })
    }

    async createOffer () { return { type: 'offer', sdp: 'v=0\r\na=fake-offer\r\n' } }
    async createAnswer () { return { type: 'answer', sdp: 'v=0\r\na=fake-answer\r\n' } }
    async setLocalDescription (description) {
      this.localDescription = description
      this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable'
      if (description.type === 'rollback') this.signalingState = 'stable'
    }

    async setRemoteDescription (description) {
      this.remoteDescription = description
      this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable'
    }

    async addIceCandidate (candidate) { this.addedCandidates.push(candidate) }
    close () { this.closed = true; this.connectionState = 'closed' }
  }
}

function flush () {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function createHarness () {
  const rootEvents = new EventTarget()
  const documentEvents = new EventTarget()
  const elements = new Map()
  const body = new FakeElement('body')
  const create = (id, tag = 'div') => {
    const element = new FakeElement(tag)
    elements.set(id, element)
    return element
  }
  const watch = create('watch')
  watch.classList.add('is-active')
  create('voiceToggle', 'button')
  create('voicePtt', 'button')
  create('watchVoice', 'section')
  create('voiceStatus', 'strong')
  create('voiceHint', 'p')
  const rack = create('voiceAudioRack')

  const document = {
    body,
    documentElement: { dataset: {} },
    visibilityState: 'visible',
    querySelector (selector) { return selector.startsWith('#') ? elements.get(selector.slice(1)) || null : null },
    createElement (tag) { return new FakeElement(tag) },
    addEventListener: documentEvents.addEventListener.bind(documentEvents),
    emit: documentEvents.emit.bind(documentEvents)
  }

  const messages = []
  const voiceListeners = new Set()
  const peerJoinListeners = new Set()
  const peerLeaveListeners = new Set()
  const sync = {
    _state: { self: 'self', peers: new Map([['peer-b', { name: 'Peer B' }]]) },
    ensureRoomCalls: 0,
    ensureRoom () { this.ensureRoomCalls += 1 },
    broadcastVoice (message) { messages.push(message) },
    onVoice (listener) { voiceListeners.add(listener); return () => voiceListeners.delete(listener) },
    onPeerJoined (listener) { peerJoinListeners.add(listener); return () => peerJoinListeners.delete(listener) },
    onPeerLeft (listener) { peerLeaveListeners.add(listener); return () => peerLeaveListeners.delete(listener) },
    emitVoice (message) { voiceListeners.forEach(listener => listener(message)) },
    emitPeerLeft (peerId) { peerLeaveListeners.forEach(listener => listener(peerId)) }
  }

  const track = new FakeTrack('audio')
  const stream = new FakeStream([track])
  const mediaCalls = []
  const pcs = []
  const context = {
    console,
    document,
    navigator: {
      mediaDevices: {
        async getUserMedia (constraints) {
          mediaCalls.push(constraints)
          return stream
        }
      }
    },
    PearCupWatchSync: sync,
    RTCPeerConnection: createFakePeerConnectionClass(pcs),
    setTimeout,
    clearTimeout,
    Promise,
    window: null,
    addEventListener: rootEvents.addEventListener.bind(rootEvents),
    emit: rootEvents.emit.bind(rootEvents)
  }
  context.window = context
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(voiceSource, context, { filename: 'watch-voice.js' })
  return { context, sync, messages, mediaCalls, track, stream, pcs, elements, rack, body }
}

test('watch PTT requests an audio-only mic only after a deliberate hold and releases on Space up', async () => {
  const h = createHarness()
  const voice = h.context.PearCupWatchVoice
  voice.bind()

  assert.equal(voice.getState().enabled, false)
  assert.equal(h.mediaCalls.length, 0)
  voice.setEnabled(true, { silent: true })
  assert.equal(h.mediaCalls.length, 0, 'joining voice does not capture before PTT')

  const input = new FakeElement('input')
  h.context.emit('keydown', { code: 'Space', target: input, preventDefault () { throw new Error('typing shortcut must not be captured') } })
  await flush()
  assert.equal(h.mediaCalls.length, 0, 'Space in a text field does not activate PTT')

  let prevented = false
  h.context.emit('keydown', { code: 'Space', target: h.body, preventDefault () { prevented = true } })
  await flush()
  await flush()
  assert.equal(prevented, true)
  assert.equal(h.mediaCalls.length, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(h.mediaCalls[0])), {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: { ideal: 1 },
      latency: { ideal: 0.02 }
    },
    video: false
  })
  assert.deepEqual(h.track.enabledHistory.slice(1, 3), [false, true], 'the acquired track is muted before PTT opens it')
  assert.equal(h.track.enabled, true)
  assert.equal(voice.getState().transmitting, true)
  assert.ok(h.messages.some(message => message.t === 'voice:state' && message.status === 'speaking'))

  h.context.emit('keyup', { code: 'Space', target: h.body })
  assert.equal(h.track.enabled, false)
  assert.equal(voice.getState().transmitting, false)
  assert.ok(h.messages.some(message => message.t === 'voice:state' && message.status === 'idle'))
})

test('watch PTT signals only to known peers and cleans media on blur or leave', async () => {
  const h = createHarness()
  const voice = h.context.PearCupWatchVoice
  voice.bind()
  voice.setEnabled(true, { silent: true })
  await voice.pressStart('test')
  await flush()
  await flush()

  assert.equal(h.pcs.length, 1)
  const pc = h.pcs[0]
  assert.equal(pc.config.iceServers.length, 2)
  assert.equal(pc.senders.length, 1, 'one audio track is attached per remote peer')
  assert.ok(h.messages.some(message => message.t === 'voice:offer' && message.to === 'peer-b'))

  h.sync.emitVoice({ t: 'voice:ice', from: 'peer-b', to: 'another-peer', candidate: { candidate: 'candidate:ignored' } })
  assert.equal(pc.addedCandidates.length, 0, 'signals for another peer are ignored')
  h.sync.emitVoice({ t: 'voice:ice', from: 'peer-b', to: 'self', candidate: { candidate: 'candidate:queued' } })
  assert.equal(pc.addedCandidates.length, 0, 'ICE waits for a matching remote description')
  // The prior local offer has already been observed above. Return the fake peer to
  // stable before exercising its ordinary remote-offer answer path.
  pc.signalingState = 'stable'
  h.sync.emitVoice({ t: 'voice:offer', from: 'peer-b', to: 'self', description: { type: 'offer', sdp: 'v=0\r\na=remote\r\n' } })
  await flush()
  await flush()
  assert.equal(pc.remoteDescription.type, 'offer')
  assert.deepEqual(pc.addedCandidates.map(candidate => candidate.candidate), ['candidate:queued'])
  assert.ok(h.messages.some(message => message.t === 'voice:answer' && message.to === 'peer-b'))

  const remoteStream = new FakeStream([new FakeTrack('audio')])
  pc.ontrack({ streams: [remoteStream] })
  assert.equal(h.rack.children.length, 1)
  assert.equal(h.rack.children[0].srcObject, remoteStream)
  assert.equal(h.rack.children[0].muted, false)

  h.context.emit('blur')
  assert.equal(h.track.enabled, false, 'losing focus always releases PTT')
  voice.setEnabled(false, { silent: true })
  assert.equal(h.track.stopCalls, 1)
  assert.equal(pc.closed, true)
  assert.equal(h.rack.children.length, 0)
  assert.ok(h.messages.some(message => message.t === 'voice:leave'))
})
