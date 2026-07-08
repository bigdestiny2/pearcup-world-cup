'use strict'

const STORAGE_KEY = 'pearcup-prototype'

// fitId → tournament format shown in the server browser (mirrors shell templateKinds)
const FIT_FORMATS = {
  'world-cup': 'Group + KO',
  'euros-copa-america': 'Group + KO',
  'champions-league-knockout': 'Single elim',
  'march-madness': 'Single elim',
  'pro-playoffs': 'Series',
  'tennis-grand-slams': 'Single elim',
  'esports-major': 'Single elim',
  'mma-boxing-fight-card': 'Fight card',
  'sailgp-companion': 'Round robin',
  'creator-reality-brackets': 'Creator',
  'awards-prediction-pools': 'Awards card',
  'local-leagues': 'Round robin'
}

const CATEGORY_ICONS = {
  all: '◈',
  soccer: '⚽',
  basketball: '🏀',
  'pro-sports': '🏆',
  tennis: '🎾',
  esports: '🎮',
  'combat-sports': '🥊',
  sailing: '⛵',
  creator: '◆',
  awards: '🏅',
  local: '◇'
}

const PRESENCE_TOPIC = 'ultimate-sports:presence:v1'
const PRESENCE_HEARTBEAT_MS = 4000
const PRESENCE_STALE_MS = 12000

const state = {
  servers: [],
  filter: 'all',
  selectedServerId: null,
  profile: loadProfile(),
  wallet: loadWallet(),
  prefs: loadPrefs(),
  identity: loadIdentity(),
  signer: null,
  crypto: false,
  friends: loadFriends(),
  privateRooms: loadPrivateRooms(),
  presence: { channel: null, online: new Map(), heartbeat: null, sweeper: null },
  socialFeed: loadSocialFeed()
}

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

// boot() is invoked at the END of this file: it synchronously renders panels
// that read consts (kawaiiTeams) declared below, which are TDZ until the whole
// script has executed.
async function boot () {
  bindChrome()
  bindWalletActions()
  bindSettings()
  bindFriends()
  bindRoomModal()
  await ensureSigner()
  renderIdentity()
  renderFriends()
  initPresence()
  renderWallet()
  renderSettings()
  renderActiveCompetitions()
  renderPrivateRooms()
  renderSocialFeed()
  bindSocialFeedControls()
  try {
    const response = await fetch('./data/servers.json', { cache: 'no-store' })
    if (!response.ok) throw new Error(`servers fetch failed: ${response.status}`)
    state.servers = await response.json()
    state.selectedServerId = (state.servers.find(s => s.isFeatured) || state.servers[0] || {}).serverId || null
    renderFilters()
    renderFightHero()
    renderServerTable()
    renderStatus()
    renderTicker()
    renderSocialFeed()
  } catch (error) {
    renderError(error)
  }
}

/* ==================== storage ==================== */

function loadStored () {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}
  } catch {
    return {}
  }
}

function saveStored (patch) {
  try {
    const stored = loadStored()
    Object.assign(stored, patch)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {}
}

function loadProfile () {
  const saved = loadStored()
  return { username: saved.username || 'captain', team: saved.team || 'br', avatar: saved.avatar || null }
}

function saveProfile () {
  saveStored({ username: state.profile.username, team: state.profile.team, avatar: state.profile.avatar })
}

function loadWallet () {
  const saved = loadStored()
  return {
    balance: saved.wallet && typeof saved.wallet.balance === 'number' ? saved.wallet.balance : 500,
    currency: saved.wallet && saved.wallet.currency ? saved.wallet.currency : 'USDT',
    pendingPayout: saved.wallet && typeof saved.wallet.pendingPayout === 'number' ? saved.wallet.pendingPayout : 120,
    ledger: saved.wallet && Array.isArray(saved.wallet.ledger) ? saved.wallet.ledger : [{ label: 'Welcome bonus', amount: 500, kind: 'credit' }]
  }
}

function saveWallet () {
  saveStored({ wallet: state.wallet })
}

function loadPrefs () {
  const saved = loadStored()
  const langs = ['EN', 'PT', 'ES', 'FR']
  return {
    language: langs.includes(saved.language) ? saved.language : 'EN',
    settlementMode: saved.settlementMode === 'real' ? 'real' : 'demo'
  }
}

function savePrefs () {
  saveStored({ language: state.prefs.language, settlementMode: state.prefs.settlementMode })
}

// Peer identity: an Ed25519 signing keypair. The public key (64 hex) is the
// shareable peer ID and the add-friend handle; the private key stays local and
// signs room invites + join proofs. ensureSigner() (async, in boot) finalizes
// it; loadIdentity() just surfaces any stored public key for first paint.
function loadIdentity () {
  const saved = loadStored()
  if (saved.identity && /^[0-9a-f]{64}$/.test(saved.identity.key || '')) {
    return { key: saved.identity.key, created: saved.identity.created || 0 }
  }
  return { key: null, created: 0 }
}

async function ensureSigner () {
  state.crypto = false
  state.signer = null
  const stored = loadStored().identity || {}
  const hasCrypto = !!window.UltimateID && await window.UltimateID.supported()

  if (hasCrypto) {
    state.crypto = true
    if (stored.jwk && /^[0-9a-f]{64}$/.test(stored.key || '')) {
      try {
        state.signer = await window.UltimateID.importPrivate(stored.jwk)
        state.identity = { key: stored.key, created: stored.created }
        return
      } catch { /* stored key unusable — mint a fresh one below */ }
    }
    const kp = await window.UltimateID.generate()
    state.identity = { key: kp.pub, created: Date.now() }
    state.signer = kp.privKey
    saveStored({ identity: { key: kp.pub, jwk: kp.jwk, created: state.identity.created } })
    return
  }

  // No WebCrypto Ed25519 → allowlist-only (unsigned) mode; keep/mint a plain id.
  if (/^[0-9a-f]{64}$/.test(stored.key || '')) {
    state.identity = { key: stored.key, created: stored.created || 0 }
  } else {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    state.identity = { key: [...bytes].map(b => b.toString(16).padStart(2, '0')).join(''), created: Date.now() }
    saveStored({ identity: { key: state.identity.key, created: state.identity.created } })
  }
}

function loadFriends () {
  const saved = loadStored()
  return Array.isArray(saved.friends) ? saved.friends : []
}

function saveFriends () {
  saveStored({ friends: state.friends })
}

function loadPrivateRooms () {
  const saved = loadStored()
  return Array.isArray(saved.privateRooms) ? saved.privateRooms : []
}

function savePrivateRooms () {
  saveStored({ privateRooms: state.privateRooms })
}

function fmtMoney (n) {
  return `${Number(n).toLocaleString('en-US')} ${state.wallet.currency}`
}

/* ==================== window chrome ==================== */

function bindChrome () {
  $('#closeLoader').addEventListener('click', closeLoader)
  window.addEventListener('message', onFrameMessage)
  $('#joinSelectedBtn').addEventListener('click', () => {
    const server = state.servers.find(s => s.serverId === state.selectedServerId)
    if (server) loadApp(server)
  })
  $('#newRoomBtn').addEventListener('click', openRoomModal)
  $('#walletChip').addEventListener('click', () => {
    const panel = $('#walletBalance')
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

/* ==================== host bridge (lobby = identity/wallet authority) ==================== */

function onFrameMessage (event) {
  const data = event.data
  if (!data) return
  if (data.type === 'close-app') { closeLoader(); return }
  if (data.type === 'ultimate:ready') {
    injectHostState($('#appFrame'))
    return
  }
  if (data.type === 'ultimate:state') {
    if (data.wallet) { state.wallet = { ...state.wallet, ...data.wallet }; saveWallet(); renderWallet() }
    if (data.profile) { state.profile = { ...state.profile, ...data.profile }; saveProfile(); renderSettings(); renderIdentity() }
    renderActiveCompetitions()
  }
}

function injectHostState (frame) {
  if (!frame || !frame.contentWindow) return
  try {
    frame.contentWindow.postMessage({
      type: 'ultimate:init',
      profile: state.profile,
      wallet: state.wallet
    }, '*')
  } catch {}
}

function syncOpenFit () {
  const loader = $('#appLoader')
  if (loader && !loader.classList.contains('is-hidden')) injectHostState($('#appFrame'))
}

/* ==================== wallet ==================== */

function bindWalletActions () {
  $('#fundWalletBtn').addEventListener('click', () => {
    state.wallet.balance += 100
    walletLog('Deposit via Tether WDK', 100, 'credit')
    saveWallet(); renderWallet(); renderActiveCompetitions(); syncOpenFit()
  })
  $('#collectPayoutBtn').addEventListener('click', () => {
    const amount = state.wallet.pendingPayout || 0
    if (amount <= 0) return
    state.wallet.balance += amount
    state.wallet.pendingPayout = 0
    walletLog('Collected payouts', amount, 'credit')
    saveWallet(); renderWallet(); syncOpenFit()
  })
  $('#withdrawWalletBtn').addEventListener('click', () => {
    const amount = state.wallet.balance
    if (amount <= 0) return
    state.wallet.balance = 0
    walletLog('Withdraw to payout address', amount, 'debit')
    saveWallet(); renderWallet(); syncOpenFit()
  })
}

function walletLog (label, amount, kind) {
  state.wallet.ledger = state.wallet.ledger || []
  state.wallet.ledger.unshift({ label, amount, kind })
  state.wallet.ledger = state.wallet.ledger.slice(0, 8)
}

function renderWallet () {
  const w = state.wallet
  $('#walletChip .wallet-amt').textContent = fmtMoney(w.balance)
  $('#walletBalance').textContent = fmtMoney(w.balance)
  $('#walletPayout').textContent = w.pendingPayout > 0 ? `${fmtMoney(w.pendingPayout)} to collect` : 'no payouts'
  $('#collectPayoutBtn').disabled = w.pendingPayout <= 0
  $('#withdrawWalletBtn').disabled = w.balance <= 0
  const ledger = $('#walletLedger')
  const rows = (w.ledger || []).slice(0, 5)
  ledger.innerHTML = rows.length
    ? rows.map(entry => `
        <div class="lrow">
          <span class="l">${escapeHtml(entry.label)}</span>
          <span class="a ${entry.kind === 'debit' ? 'neg' : 'pos'}">${entry.kind === 'debit' ? '−' : '+'}${escapeHtml(String(entry.amount))}</span>
        </div>`).join('')
    : '<p class="ledger-empty">No transactions yet.</p>'
}

/* ==================== identity + friends ==================== */

function shortKey (key) {
  return `${key.slice(0, 8)}…${key.slice(-6)}`
}

function renderIdentity () {
  $('#myPeerId').textContent = state.identity.key || '…'
  $('#myPeerId').title = state.identity.key || ''
  const idNote = $('#idCrypto')
  if (idNote) idNote.textContent = state.crypto ? '🔑 Ed25519 signing key' : '○ unsigned (allowlist only)'
  $('#statusIdentity').textContent = `${state.profile.username} · ${shortKey(state.identity.key || '')}`
}

function bindFriends () {
  $('#copyPeerId').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.identity.key)
      $('#copyPeerId').textContent = 'Copied'
      setTimeout(() => { $('#copyPeerId').textContent = 'Copy' }, 1400)
    } catch {
      // Clipboard can be unavailable (permissions/iframe) — select the key instead.
      const range = document.createRange()
      range.selectNodeContents($('#myPeerId'))
      const sel = window.getSelection()
      sel.removeAllRanges(); sel.addRange(range)
    }
  })

  $('#friendAddForm').addEventListener('submit', event => {
    event.preventDefault()
    const keyInput = $('#friendKeyInput')
    const nameInput = $('#friendNameInput')
    const key = (keyInput.value || '').trim().toLowerCase()
    const name = (nameInput.value || '').trim() || `peer-${key.slice(0, 4)}`
    if (!/^[0-9a-f]{64}$/.test(key)) {
      keyInput.setCustomValidity('Peer ID is 64 hex characters')
      keyInput.reportValidity()
      setTimeout(() => keyInput.setCustomValidity(''), 1800)
      return
    }
    if (key === state.identity.key) {
      keyInput.setCustomValidity("That's your own peer ID")
      keyInput.reportValidity()
      setTimeout(() => keyInput.setCustomValidity(''), 1800)
      return
    }
    if (!state.friends.some(f => f.key === key)) {
      state.friends.push({ key, name, added: Date.now() })
      saveFriends()
    }
    keyInput.value = ''; nameInput.value = ''
    renderFriends()
    renderStatus()
  })

  $('#friendList').addEventListener('click', event => {
    const del = event.target.closest('[data-del-friend]')
    if (!del) return
    state.friends = state.friends.filter(f => f.key !== del.dataset.delFriend)
    saveFriends()
    renderFriends()
    renderStatus()
  })
}

function isFriendOnline (key) {
  const peer = state.presence.online.get(key)
  return !!peer && (Date.now() - peer.last) < PRESENCE_STALE_MS
}

function renderFriends () {
  const list = $('#friendList')
  list.innerHTML = state.friends.length
    ? state.friends.map(friend => {
        const online = isFriendOnline(friend.key)
        return `
        <div class="friend-row">
          <span class="f-dot${online ? ' on' : ''}" title="${online ? 'online' : 'offline'}"></span>
          <span class="f-name">${escapeHtml(friend.name)}</span>
          <span class="f-key">${online ? 'online' : escapeHtml(shortKey(friend.key))}</span>
          <button class="f-del" type="button" data-del-friend="${escapeAttr(friend.key)}" aria-label="Remove ${escapeAttr(friend.name)}">×</button>
        </div>`
      }).join('')
    : '<p class="friend-empty">No friends yet — swap peer IDs to connect.</p>'
}

/* ==================== swarm presence ====================
   Announce our identity on a shared presence topic and listen for friends
   doing the same, so the friends list shows real online/offline status.
   Transport is PearCupPeerNet: hyperswarm under the Pear runtime, PearBrowser
   swarm.v1 for a published drive, BroadcastChannel between local windows.
   (A global topic is fine for the demo; pairwise topics per friendship are the
   privacy-preserving upgrade.) */

function initPresence () {
  const Net = window.PearCupPeerNet
  if (!Net || typeof Net.createChannel !== 'function') {
    $('#statusNet').innerHTML = '<span class="ok">○</span> peer net unavailable'
    return
  }
  try {
    state.presence.channel = Net.createChannel(PRESENCE_TOPIC)
    state.presence.channel.onMessage(onPresenceMessage)
  } catch (error) {
    return
  }
  announcePresence()
  state.presence.heartbeat = setInterval(announcePresence, PRESENCE_HEARTBEAT_MS)
  state.presence.sweeper = setInterval(sweepPresence, PRESENCE_HEARTBEAT_MS)
  window.addEventListener('beforeunload', () => {
    try { state.presence.channel.send({ type: 'us:bye', key: state.identity.key }) } catch {}
  })
  const backend = (state.presence.channel && state.presence.channel.backend) || 'peer net'
  $('#statusNet').innerHTML = `<span class="ok">◉</span> presence · ${escapeHtml(backend)}`
}

function announcePresence () {
  if (!state.presence.channel) return
  try {
    state.presence.channel.send({ type: 'us:hello', key: state.identity.key, name: state.profile.username })
  } catch {}
}

function onPresenceMessage (msg) {
  if (!msg || typeof msg !== 'object') return
  if (msg.type === 'us:bye' && msg.key) {
    if (state.presence.online.delete(msg.key)) refreshPresenceViews()
    return
  }
  if (msg.type !== 'us:hello' || !msg.key || msg.key === state.identity.key) return
  const known = state.presence.online.has(msg.key)
  state.presence.online.set(msg.key, { name: msg.name || 'peer', last: Date.now() })
  // A hello from someone we don't know yet is a peer online; re-render if it is a
  // friend (or if this is a newly-seen peer, to keep the count fresh).
  if (!known || state.friends.some(f => f.key === msg.key)) refreshPresenceViews()
}

function sweepPresence () {
  const cut = Date.now() - PRESENCE_STALE_MS
  let changed = false
  for (const [key, peer] of state.presence.online) {
    if (peer.last < cut) { state.presence.online.delete(key); changed = true }
  }
  if (changed) refreshPresenceViews()
}

function refreshPresenceViews () {
  renderFriends()
  renderStatus()
}

/* ==================== private rooms ==================== */

function roomCode () {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return [...bytes].map(b => (b % 36).toString(36)).join('').toUpperCase()
}

/* ---- cryptographic access control ----
   A room is owned by the creator's key. The host signs an invite per member
   (a capability over roomCode|memberKey). To be admitted a peer must either be
   the owner, or present a host-signed invite for their own key (+ prove key
   ownership with a fresh signature). Without WebCrypto, this degrades to a plain
   allowlist check. */

function inviteMessage (code, memberKey) { return `us-invite:v1|${code}|${memberKey}` }
function proofMessage (code, nonce) { return `us-join:v1|${code}|${nonce}` }

async function verifyRoomAccess (room, joinerKey, opts = {}) {
  if (!room || !joinerKey) return { ok: false, reason: 'invalid request' }
  if (joinerKey === room.owner) return { ok: true, role: 'owner' }
  if (!room.crypto) {
    return (room.members || []).includes(joinerKey)
      ? { ok: true, role: 'member', proven: false }
      : { ok: false, reason: 'not on the allowlist' }
  }
  const invite = opts.invite || (room.invites && room.invites[joinerKey])
  if (!invite) return { ok: false, reason: 'no invite for your key' }
  const inviteOk = await window.UltimateID.verify(room.owner, inviteMessage(room.code, joinerKey), invite)
  if (!inviteOk) return { ok: false, reason: 'invite signature invalid' }
  if (opts.proof && opts.challenge) {
    const proofOk = await window.UltimateID.verify(joinerKey, proofMessage(room.code, opts.challenge), opts.proof)
    return proofOk ? { ok: true, role: 'member', proven: true } : { ok: false, reason: 'ownership proof failed' }
  }
  return { ok: true, role: 'member', proven: false }
}

// Shareable "room ticket" — the host hands this to invited friends. It carries
// the signed invites; a friend's client redeems it only if it holds an invite
// for their key.
function encodeTicket (room) {
  const payload = { name: room.name, fitId: room.fitId, code: room.code, owner: room.owner, invites: room.invites || {}, crypto: !!room.crypto, members: room.members || [] }
  return 'us-room:v1:' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
}
function decodeTicket (text) {
  const raw = String(text || '').trim()
  if (!raw.startsWith('us-room:v1:')) return null
  try { return JSON.parse(decodeURIComponent(escape(atob(raw.slice('us-room:v1:'.length))))) } catch { return null }
}

function openRoomModal () {
  const select = $('#roomFitSelect')
  select.innerHTML = state.servers.map(server =>
    `<option value="${escapeAttr(server.fitId)}">${escapeHtml(server.title)}</option>`).join('')
  const pick = $('#roomFriendPick')
  pick.innerHTML = state.friends.length
    ? state.friends.map(friend => `
        <label class="room-friend">
          <input type="checkbox" value="${escapeAttr(friend.key)}">
          <span class="f-name">${escapeHtml(friend.name)}</span>
          <span class="f-key">${escapeHtml(shortKey(friend.key))}</span>
        </label>`).join('')
    : '<p class="room-none">No friends added yet — the room still gets a shareable code.</p>'
  $('#roomNameInput').value = ''
  $('#roomModal').classList.remove('is-hidden')
  $('#roomNameInput').focus()
}

function bindRoomModal () {
  $('#roomCancelBtn').addEventListener('click', () => $('#roomModal').classList.add('is-hidden'))
  $('#roomModal').addEventListener('click', event => {
    if (event.target === $('#roomModal')) $('#roomModal').classList.add('is-hidden')
  })
  $('#roomCreateBtn').addEventListener('click', async () => {
    const fitId = $('#roomFitSelect').value
    if (!fitId) return
    const server = state.servers.find(s => s.fitId === fitId)
    const name = ($('#roomNameInput').value || '').trim() || `${(server && server.title) || fitId} room`
    const members = $$('#roomFriendPick input:checked').map(input => input.value)
    const code = roomCode()
    const room = {
      id: `room-${Date.now().toString(36)}`,
      name,
      fitId,
      code,
      owner: state.identity.key,
      members,
      invites: {},
      crypto: state.crypto,
      created: Date.now()
    }
    // Host signs a capability invite for each member key.
    if (state.crypto && state.signer) {
      for (const memberKey of members) {
        try { room.invites[memberKey] = await window.UltimateID.sign(state.signer, inviteMessage(code, memberKey)) } catch { /* skip unsignable */ }
      }
    }
    state.privateRooms.unshift(room)
    savePrivateRooms()
    renderPrivateRooms()
    $('#roomModal').classList.add('is-hidden')
  })

  $('#privateRows').addEventListener('click', async event => {
    const del = event.target.closest('[data-del-room]')
    if (del) {
      state.privateRooms = state.privateRooms.filter(room => room.id !== del.dataset.delRoom)
      savePrivateRooms()
      renderPrivateRooms()
      return
    }
    const copy = event.target.closest('[data-copy-room]')
    if (copy) {
      const room = state.privateRooms.find(r => r.id === copy.dataset.copyRoom)
      if (room) {
        try { await navigator.clipboard.writeText(encodeTicket(room)); flashRoomNote(`Invite copied — send it to your members`) } catch { flashRoomNote('Could not copy invite') }
      }
      return
    }
    const row = event.target.closest('[data-room-id]')
    if (!row) return
    const room = state.privateRooms.find(r => r.id === row.dataset.roomId)
    if (room) loadPrivateRoom(room)
  })

  const redeemForm = $('#redeemForm')
  if (redeemForm) redeemForm.addEventListener('submit', redeemTicket)
}

async function loadPrivateRoom (room) {
  // Gate the join on this identity's access to the room.
  const access = await verifyRoomAccess(room, state.identity.key)
  if (!access.ok) {
    flashRoomNote(`Access denied — ${access.reason}`)
    return
  }
  const server = state.servers.find(s => s.fitId === room.fitId)
  // Members carry their host-signed capability + a fresh ownership proof so the
  // host/peers can verify them on the swarm handshake (owners need neither).
  let cap = ''
  if (access.role === 'member' && room.crypto && state.signer && room.invites && room.invites[state.identity.key]) {
    try {
      const nonce = roomCode()
      const proof = await window.UltimateID.sign(state.signer, proofMessage(room.code, nonce))
      cap = `&host=${encodeURIComponent(room.owner)}&cap=${encodeURIComponent(room.invites[state.identity.key])}&px=${encodeURIComponent(proof)}&pn=${encodeURIComponent(nonce)}`
    } catch { /* proof optional */ }
  }
  loadApp({
    title: `${room.name} · ${(server && server.title) || room.fitId}`,
    // ?join=<code> drops members with the code into the same P2P room via the
    // shell's friend-invite deep link; ?fit themes it as the chosen server.
    appUrl: `/shell/index.html?fit=${encodeURIComponent(room.fitId)}&join=${encodeURIComponent(room.code)}&owner=${encodeURIComponent(access.role)}${cap}`
  })
}

async function redeemTicket (event) {
  event.preventDefault()
  const input = $('#redeemInput')
  const room = decodeTicket(input.value)
  if (!room) { flashRoomNote('That is not a valid room invite'); return }
  if (room.owner === state.identity.key) { flashRoomNote("That's your own room"); return }
  const access = await verifyRoomAccess(room, state.identity.key)
  if (!access.ok) { flashRoomNote(`Access denied — ${access.reason}`); return }
  if (!state.privateRooms.some(r => r.code === room.code && r.owner === room.owner)) {
    state.privateRooms.unshift({ id: `room-${Date.now().toString(36)}`, ...room, mine: false, created: Date.now() })
    savePrivateRooms()
    renderPrivateRooms()
  }
  input.value = ''
  flashRoomNote(`Joined "${room.name}" — verified invite`)
}

function flashRoomNote (text) {
  const note = $('#roomNote')
  if (!note) return
  note.textContent = text
  note.classList.add('show')
  clearTimeout(flashRoomNote._t)
  flashRoomNote._t = setTimeout(() => note.classList.remove('show'), 3200)
}

function renderPrivateRooms () {
  const rows = $('#privateRows')
  const empty = $('#privateEmpty')
  $('#privateCount').textContent = `${state.privateRooms.length} room${state.privateRooms.length === 1 ? '' : 's'}`
  empty.classList.toggle('is-hidden', state.privateRooms.length > 0)
  rows.innerHTML = state.privateRooms.map(room => {
    const server = state.servers.find(s => s.fitId === room.fitId)
    const isOwner = room.owner === state.identity.key
    const memberCount = (room.members ? room.members.length : 0) + 1
    const lock = room.crypto ? '🔒' : '○'
    return `
      <tr data-room-id="${escapeAttr(room.id)}">
        <td><span class="st priv"><span class="d"></span>${lock} ${isOwner ? 'Owner' : 'Member'}</span></td>
        <td class="srv">${escapeHtml(room.name)}</td>
        <td class="hide"><span class="kind">${escapeHtml((server && server.title) || room.fitId)}</span></td>
        <td class="dim">${memberCount} member${memberCount === 1 ? '' : 's'}</td>
        <td class="num"><span class="kind">${escapeHtml(room.code)}</span></td>
        <td class="num">
          ${isOwner ? `<button class="linkbtn" type="button" data-copy-room="${escapeAttr(room.id)}">invite</button>` : ''}
          <button class="f-del" type="button" data-del-room="${escapeAttr(room.id)}" aria-label="Delete room">×</button>
        </td>
      </tr>`
  }).join('')
}

/* ==================== server browser ==================== */

function renderFilters () {
  const categories = ['all', ...new Set(state.servers.map(server => server.category))]
  $('#lobbyFilters').innerHTML = categories.map(category => {
    const count = category === 'all' ? state.servers.length : state.servers.filter(s => s.category === category).length
    return `
      <button class="tnode${category === state.filter ? ' on' : ''}" type="button" data-category="${escapeAttr(category)}">
        <span aria-hidden="true">${CATEGORY_ICONS[category] || '◈'}</span>
        ${escapeHtml(categoryName(category))}
        <span class="c">${count}</span>
      </button>`
  }).join('')
  $$('#lobbyFilters [data-category]').forEach(button => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.category
      renderFilters()
      renderServerTable()
    })
  })
}

function renderServerTable () {
  const filtered = state.filter === 'all'
    ? state.servers
    : state.servers.filter(server => server.category === state.filter)
  $('#serverGrid').innerHTML = filtered.map(server => {
    const status = server.isLive ? 'live' : 'open'
    return `
      <tr data-server-id="${escapeAttr(server.serverId)}" class="${server.serverId === state.selectedServerId ? 'sel' : ''}">
        <td><span class="st ${status}"><span class="d"></span>${server.isLive ? 'Live' : 'Open'}</span></td>
        <td class="srv">
          <img class="srv-cover" src="${escapeAttr(server.coverUrl)}" alt="" loading="lazy">
          <span class="fl" aria-hidden="true">${CATEGORY_ICONS[server.category] || '◈'}</span>
          ${escapeHtml(server.title)}
        </td>
        <td class="hide dim">${escapeHtml(categoryName(server.category))}</td>
        <td><span class="kind">${escapeHtml(FIT_FORMATS[server.fitId] || '—')}</span></td>
        <td class="num dim">${escapeHtml(String(server.recommendedVariantCount))}</td>
        <td class="num dim hide">${escapeHtml(String(server.recommendedMiniGameCount))}</td>
      </tr>`
  }).join('')
  $$('#serverGrid [data-server-id]').forEach(row => {
    row.addEventListener('click', () => {
      state.selectedServerId = row.dataset.serverId
      renderServerTable()
    })
    row.addEventListener('dblclick', () => {
      const server = state.servers.find(s => s.serverId === row.dataset.serverId)
      if (server) loadApp(server)
    })
  })
}

function renderFightHero () {
  const host = $('#fightHero')
  if (!host) return
  const server = state.servers.find(s => s.feature) || null
  const f = server && server.feature
  if (!f) { host.innerHTML = ''; return }
  const corner = (side, c) => `
    <div class="fh-corner fh-${side}" data-corner="${escapeAttr(c.corner)}">
      <div class="fh-portrait"><img src="${escapeAttr(c.img)}" alt="${escapeAttr(c.name)}" loading="lazy"></div>
      <div class="fh-name">${escapeHtml(c.flag)} ${escapeHtml(c.name)}</div>
      <div class="fh-nick">"${escapeHtml(c.nick)}"</div>
      <div class="fh-rec tnum">${escapeHtml(c.record)}</div>
    </div>`
  host.innerHTML = `
    <div class="fight-hero">
      <div class="fh-bar">
        <span class="fh-live"><span class="d"></span>LIVE</span>
        <span class="fh-eyebrow">${escapeHtml(f.eyebrow)}</span>
        <span class="fh-server">${escapeHtml(server.title)}</span>
      </div>
      <div class="fh-stage">
        ${corner('red', f.red)}
        <div class="fh-mid">
          <div class="fh-vs">VS</div>
          <div class="fh-class">${escapeHtml(f.weightClass)}</div>
        </div>
        ${corner('blue', f.blue)}
      </div>
      <div class="fh-foot">
        <span class="fh-meta">${escapeHtml(f.venue)} · ${escapeHtml(f.prop)}</span>
        <button class="fh-join" id="fightHeroJoin" type="button">▶ ${escapeHtml(f.cta)}</button>
      </div>
    </div>`
  host.querySelectorAll('[data-corner]').forEach(el => {
    el.style.setProperty('--corner', el.dataset.corner)
  })
  const join = $('#fightHeroJoin')
  if (join) join.addEventListener('click', () => loadApp(server))
}

function renderStatus () {
  const liveCount = state.servers.filter(server => server.isLive).length
  $('#lobbyStatus').textContent = `${state.servers.length} servers · ${liveCount} live`
  $('#statusServers').textContent = `${state.servers.length} servers · ${liveCount} live`
  const friendsOnline = state.friends.filter(f => isFriendOnline(f.key)).length
  $('#peersLabel').textContent = state.friends.length
    ? `${friendsOnline}/${state.friends.length} friends online`
    : `${state.presence.online.size + 1} peers`
}

/* ==================== social feed ==================== */

const SOCIAL_FEED_MAX_POSTS = 30
const SOCIAL_FEED_PROTOCOL_LABELS = {
  nostr: 'Nostr',
  'at-protocol': 'Bluesky',
  'activity-pub': 'Mastodon',
  'in-app-p2p': 'Native'
}

function loadSocialFeed () {
  const stored = loadStored()
  return {
    posts: generateDemoSocialPosts(),
    mutedAuthors: stored.mutedAuthors || [],
    hiddenSources: stored.hiddenSources || [],
    activeCategory: null,
    refreshing: false
  }
}

function saveSocialFeed () {
  const stored = loadStored()
  stored.mutedAuthors = state.socialFeed.mutedAuthors
  stored.hiddenSources = state.socialFeed.hiddenSources
  saveStored(stored)
}

function generateDemoSocialPosts () {
  const now = Date.now()
  return [
    { postId: 'sf-native-1', sourceId: 'native-activity', protocol: 'in-app-p2p', externalId: 'share-1',
      author: { handle: 'PoolChamp', displayName: 'Pool Champion', verified: false },
      text: 'Just won the World Cup bracket pool! 🏆 #worldcup', lang: 'en',
      createdAt: new Date(now - 120000).toISOString(), ingestedAt: new Date(now - 110000).toISOString(),
      eventTags: { competitionId: 'wc-2026', fixtureId: null, category: 'soccer' },
      topicTags: ['#worldcup'], moderation: { state: 'allowed', reasons: [], score: 0 }, settlementTier: 'context-only' },
    { postId: 'sf-nostr-1', sourceId: 'nostr-relays', protocol: 'nostr', externalId: 'nostr-evt-001',
      author: { handle: 'soccerfan@nostr', displayName: 'Soccer Fan', pubkeyOrDid: 'pk-abc', verified: false },
      text: 'What a goal from the wing! Absolutely clinical finish. #worldcup #football',
      mediaRefs: [], lang: 'en',
      createdAt: new Date(now - 300000).toISOString(), ingestedAt: new Date(now - 290000).toISOString(),
      eventTags: { competitionId: null, fixtureId: null, category: 'soccer' },
      topicTags: ['#worldcup', '#football'], moderation: { state: 'allowed', reasons: [], score: 0 }, settlementTier: 'context-only' },
    { postId: 'sf-bsky-1', sourceId: 'bluesky-atproto', protocol: 'at-protocol', externalId: 'at://post/xyz1',
      author: { handle: 'ufcfan.bsky.social', displayName: 'MMA Insider', verified: true },
      text: 'Main event is about to start. This card is stacked! #ufc #mma',
      mediaRefs: [{ kind: 'image', url: '#', previewRef: null }], lang: 'en',
      createdAt: new Date(now - 600000).toISOString(), ingestedAt: new Date(now - 590000).toISOString(),
      eventTags: { competitionId: null, fixtureId: null, category: 'combat-sports' },
      topicTags: ['#ufc', '#mma'], moderation: { state: 'allowed', reasons: [], score: 0 }, settlementTier: 'context-only' },
    { postId: 'sf-native-2', sourceId: 'native-activity', protocol: 'in-app-p2p', externalId: 'share-2',
      author: { handle: 'GameWizard', displayName: 'Game Wizard', verified: false },
      text: '5-game prediction streak! Who can beat that? #esports',
      lang: 'en',
      createdAt: new Date(now - 900000).toISOString(), ingestedAt: new Date(now - 890000).toISOString(),
      eventTags: { competitionId: null, fixtureId: null, category: 'esports' },
      topicTags: ['#esports'], moderation: { state: 'allowed', reasons: [], score: 0 }, settlementTier: 'context-only' },
    { postId: 'sf-mast-1', sourceId: 'mastodon-instances', protocol: 'activity-pub', externalId: 'mast-001',
      author: { handle: 'sailgp@mastodon.social', displayName: 'SailGP Follower', verified: false },
      text: 'Incredible racing in Dubai today! The speeds are unreal. #sailgp #sailing',
      mediaRefs: [], lang: 'en',
      createdAt: new Date(now - 1200000).toISOString(), ingestedAt: new Date(now - 1190000).toISOString(),
      eventTags: { competitionId: null, fixtureId: null, category: 'sailing' },
      topicTags: ['#sailgp', '#sailing'], moderation: { state: 'allowed', reasons: [], score: 0 }, settlementTier: 'context-only' }
  ]
}

function filterSocialFeedPosts (category) {
  const muted = new Set(state.socialFeed.mutedAuthors)
  const hiddenSources = new Set(state.socialFeed.hiddenSources)
  return state.socialFeed.posts
    .filter(post => post.moderation && post.moderation.state === 'allowed')
    .filter(post => !hiddenSources.has(post.sourceId))
    .filter(post => {
      if (!post.author) return true
      const authorKey = post.author.pubkeyOrDid || post.author.handle
      return !muted.has(authorKey)
    })
    .filter(post => !category || !post.eventTags || post.eventTags.category === category)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, SOCIAL_FEED_MAX_POSTS)
}

function renderSocialFeed () {
  const panel = $('#socialFeedPanel')
  if (!panel) return
  const category = state.socialFeed.activeCategory
  const posts = filterSocialFeedPosts(category)
  const empty = $('#socialFeedEmpty')
  const status = $('#socialFeedStatus')
  const mutedCount = $('#socialMutedCount')

  if (mutedCount) mutedCount.textContent = String(state.socialFeed.mutedAuthors.length)
  if (status) status.textContent = posts.length ? `${posts.length} live post${posts.length === 1 ? '' : 's'}` : 'no posts yet'
  if (empty) empty.classList.toggle('is-hidden', posts.length > 0)

  panel.innerHTML = posts.length
    ? posts.map(post => renderSocialPostCard(post)).join('')
    : (empty ? '' : '<p class="empty-note">No live posts yet for this event.</p>')

  $$('#socialFeedPanel [data-mute-author]').forEach(btn => {
    btn.addEventListener('click', () => {
      const author = btn.dataset.muteAuthor
      if (!state.socialFeed.mutedAuthors.includes(author)) {
        state.socialFeed.mutedAuthors.push(author)
        saveSocialFeed()
        renderSocialFeed()
      }
    })
  })
  $$('#socialFeedPanel [data-hide-source]').forEach(btn => {
    btn.addEventListener('click', () => {
      const source = btn.dataset.hideSource
      if (!state.socialFeed.hiddenSources.includes(source)) {
        state.socialFeed.hiddenSources.push(source)
        saveSocialFeed()
        renderSocialFeed()
      }
    })
  })
  $$('#socialFeedPanel [data-report-post]').forEach(btn => {
    btn.addEventListener('click', () => {
      const postId = btn.dataset.reportPost
      const post = state.socialFeed.posts.find(p => p.postId === postId)
      if (post) {
        post.moderation = { state: 'hidden', reasons: ['user-report'], score: 1 }
        renderSocialFeed()
      }
    })
  })
}

function renderSocialPostCard (post) {
  const author = post.author || {}
  const authorKey = author.pubkeyOrDid || author.handle || 'unknown'
  const displayName = escapeHtml(author.displayName || author.handle || 'Anonymous')
  const protocolLabel = SOCIAL_FEED_PROTOCOL_LABELS[post.protocol] || post.protocol
  const timeAgo = formatTimeAgo(post.createdAt)
  const mediaBadge = post.mediaRefs && post.mediaRefs.length ? `<span class="sf-media">${post.mediaRefs.length} media</span>` : ''
  const verifiedBadge = author.verified ? '<span class="sf-verified" title="Verified">✓</span>' : ''
  const categoryTag = post.eventTags && post.eventTags.category
    ? `<span class="sf-cat">${escapeHtml(post.eventTags.category)}</span>` : ''

  return `
    <div class="sf-post" data-post-id="${escapeAttr(post.postId)}">
      <div class="sf-head">
        <span class="sf-author">${displayName}${verifiedBadge}</span>
        <span class="sf-source">${escapeHtml(protocolLabel)}</span>
        <span class="sf-time">${escapeHtml(timeAgo)}</span>
      </div>
      <p class="sf-text">${escapeHtml(post.text)}</p>
      <div class="sf-meta">
        ${categoryTag}
        ${mediaBadge}
        <span class="sf-actions">
          <button class="sf-btn" type="button" data-mute-author="${escapeAttr(authorKey)}" title="Mute author">mute</button>
          <button class="sf-btn" type="button" data-hide-source="${escapeAttr(post.sourceId)}" title="Hide source">hide</button>
          <button class="sf-btn" type="button" data-report-post="${escapeAttr(post.postId)}" title="Report post">report</button>
        </span>
      </div>
    </div>`
}

function formatTimeAgo (isoString) {
  if (!isoString) return ''
  const diff = Date.now() - new Date(isoString).getTime()
  if (diff < 0) return 'now'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function setSocialFeedCategory (category) {
  state.socialFeed.activeCategory = category || null
  renderSocialFeed()
}

function bindSocialFeedControls () {
  const refreshBtn = $('#socialRefreshBtn')
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      state.socialFeed.refreshing = true
      renderSocialFeed()
      setTimeout(() => {
        state.socialFeed.posts = generateDemoSocialPosts().concat(state.socialFeed.posts.filter(p => p.moderation.state !== 'hidden'))
        state.socialFeed.refreshing = false
        renderSocialFeed()
      }, 600)
    })
  }
  const mutedBtn = $('#socialMutedBtn')
  if (mutedBtn) {
    mutedBtn.addEventListener('click', () => {
      if (state.socialFeed.mutedAuthors.length === 0) return
      state.socialFeed.mutedAuthors = []
      saveSocialFeed()
      renderSocialFeed()
    })
  }
}

function renderTicker () {
  const live = state.servers.filter(server => server.isLive)
  const text = live.length
    ? live.map(server => `${server.title.toUpperCase()} — ${server.tagline}`).join('  ···  ')
    : 'no live servers right now — open a server to start a pool'
  $('#tickerText').textContent = text
}

/* ==================== settings ==================== */

function realMoneyReadiness () {
  const RT = window.PearCupRuntimeSettings
  if (!RT || typeof RT.loadRuntimeSettings !== 'function' || typeof RT.validateRuntimeSettings !== 'function') {
    return { ok: false, missing: ['Runtime settings loader is not available.'] }
  }
  const settings = RT.loadRuntimeSettings()
  const validation = RT.validateRuntimeSettings(settings, { requireLive: true })
  const missing = [
    ...validation.errors.map(issue => issue.label),
    ...validation.warnings.map(issue => issue.label)
  ]
  return { ok: validation.ok, missing }
}

function renderRealMoneyGate (readiness) {
  const gate = $('#realMoneyGate')
  if (!gate) return
  const list = readiness && readiness.missing && readiness.missing.length
    ? readiness.missing.map(label => `<li>${escapeHtml(label)}</li>`).join('')
    : '<li>Real money is not enabled.</li>'
  gate.innerHTML = `
    <p class="gate-title">Real money is locked — complete the remaining readiness items:</p>
    <ul class="gate-list">${list}</ul>
  `
  gate.hidden = false
}

function renderSettings () {
  const nameInput = $('#settingsName')
  if (nameInput && document.activeElement !== nameInput) nameInput.value = state.profile.username
  const countries = $('#settingsCountries')
  if (countries) {
    countries.innerHTML = Object.entries(kawaiiTeams).map(([id, team]) => `
      <button type="button" class="country-chip${id === state.profile.team ? ' is-active' : ''}" data-country="${escapeAttr(id)}" aria-pressed="${id === state.profile.team}" title="${escapeAttr(team.name)}">
        <span>${team.flag}</span>
      </button>`).join('')
  }
  const lang = $('#settingsLanguage')
  if (lang) lang.value = state.prefs.language

  const readiness = realMoneyReadiness()
  const realBtn = $('#settingsMoney [data-money="real"]')
  if (realBtn) {
    realBtn.disabled = !readiness.ok
    realBtn.title = readiness.ok ? 'Real-money mode is ready' : 'Real-money mode is locked'
  }
  if (state.prefs.settlementMode === 'real' && !readiness.ok) {
    state.prefs.settlementMode = 'demo'
    savePrefs()
  }
  $$('#settingsMoney [data-money]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.money === state.prefs.settlementMode)
  })
}

function bindSettings () {
  const nameInput = $('#settingsName')
  nameInput.addEventListener('input', () => {
    state.profile.username = nameInput.value.trim() || 'captain'
    saveProfile(); renderIdentity(); syncOpenFit()
  })
  $('#settingsCountries').addEventListener('click', event => {
    const btn = event.target.closest('[data-country]')
    if (!btn) return
    state.profile.team = btn.dataset.country
    saveProfile(); renderSettings(); syncOpenFit()
  })
  $('#settingsLanguage').addEventListener('change', () => {
    state.prefs.language = $('#settingsLanguage').value
    savePrefs()
  })
  $('#settingsMoney').addEventListener('click', event => {
    const btn = event.target.closest('[data-money]')
    if (!btn) return
    const mode = btn.dataset.money
    if (mode === 'real') {
      const readiness = realMoneyReadiness()
      if (!readiness.ok) {
        state.prefs.settlementMode = 'demo'
        renderRealMoneyGate(readiness)
        savePrefs(); renderSettings()
        return
      }
    }
    $('#realMoneyGate').hidden = true
    state.prefs.settlementMode = mode
    savePrefs(); renderSettings()
  })
}

/* ==================== active pools ==================== */

function renderActiveCompetitions () {
  const stored = loadStored()
  const entered = stored.enteredPools || {}
  const tiers = Object.keys(entered)
  const container = $('#activeList')
  container.innerHTML = tiers.length
    ? tiers.map(tier => `
        <div class="lrow">
          <span class="l">$${escapeHtml(String(tier))} bracket pool</span>
          <span class="a pos">entered</span>
        </div>`).join('')
    : '<p class="ledger-empty">No pools entered yet — join a live server.</p>'
}

/* ==================== fit loader ==================== */

function loadApp (server) {
  const loader = $('#appLoader')
  const frame = $('#appFrame')
  $('#loaderTitle').textContent = server.title
  frame.onload = () => injectHostState(frame)
  frame.src = server.appUrl
  loader.classList.remove('is-hidden')
}

function closeLoader () {
  $('#appLoader').classList.add('is-hidden')
  $('#appFrame').src = 'about:blank'
  // Refresh wallet/active data in case the fit changed state.
  state.wallet = loadWallet()
  renderWallet()
  renderActiveCompetitions()
}

/* ==================== misc ==================== */

function categoryName (category) {
  if (category === 'all') return 'All servers'
  if (category === 'pro-sports') return 'Pro sports'
  if (category === 'combat-sports') return 'Combat'
  return category.charAt(0).toUpperCase() + category.slice(1)
}

function renderError (error) {
  document.body.innerHTML = `
    <main class="fatal-error">
      <p class="fatal-error-label">Client error</p>
      <h1 class="fatal-error-title">Ultimate Sports could not connect</h1>
      <p class="fatal-error-msg">${escapeHtml(error.message || error)}</p>
    </main>
  `
}

function escapeHtml (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr (value) {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

const kawaiiTeams = {
  br: { name: 'Brazil', flag: '🇧🇷', colors: ['#139b49', '#ffd447', '#1b55a5'] },
  jp: { name: 'Japan', flag: '🇯🇵', colors: ['#f6f6f6', '#d91f3c', '#0a2f68'] },
  us: { name: 'United States', flag: '🇺🇸', colors: ['#ffffff', '#b31942', '#0a3161'] },
  gb: { name: 'Great Britain', flag: '🇬🇧', colors: ['#ffffff', '#d41f35', '#1c3764'] },
  au: { name: 'Australia', flag: '🇦🇺', colors: ['#012169', '#ffcd00', '#00843d'] },
  ng: { name: 'Nigeria', flag: '🇳🇬', colors: ['#008751', '#ffffff', '#000000'] },
  ir: { name: 'Iran', flag: '🇮🇷', colors: ['#239f40', '#ffffff', '#da0000'] },
  kg: { name: 'Kyrgyzstan', flag: '🇰🇬', colors: ['#e4002b', '#ffef00', '#ffffff'] },
  jm: { name: 'Jamaica', flag: '🇯🇲', colors: ['#009b3a', '#ffd320', '#000000'] },
  ru: { name: 'Russia', flag: '🇷🇺', colors: ['#ffffff', '#0039a6', '#d52b1e'] },
  cz: { name: 'Czech Republic', flag: '🇨🇿', colors: ['#ffffff', '#d7141a', '#11457e'] }
}

boot().catch(renderError)
