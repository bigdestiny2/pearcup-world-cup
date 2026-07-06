'use strict'

const STORAGE_KEY = 'pearcup-prototype'

const state = {
  servers: [],
  filter: 'all',
  featured: null,
  profile: loadProfile(),
  wallet: loadWallet()
}

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

boot()

async function boot () {
  bindSplash()
  bindWalletActions()
  try {
    const response = await fetch('./data/servers.json', { cache: 'no-store' })
    if (!response.ok) throw new Error(`servers fetch failed: ${response.status}`)
    state.servers = await response.json()
    state.featured = state.servers.find(server => server.isFeatured) || state.servers[0] || null
    renderLobby()
    renderWallet()
    renderActiveCompetitions()
    renderProfile()
  } catch (error) {
    renderError(error)
  }
}

function loadProfile () {
  const saved = loadStored()
  return {
    username: saved.username || 'captain',
    team: saved.team || 'br'
  }
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

function loadStored () {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}
  } catch {
    return {}
  }
}

function saveWallet () {
  try {
    const stored = loadStored()
    stored.wallet = state.wallet
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {}
}

function fmtMoney (n) {
  return `${Number(n).toLocaleString('en-US')} ${state.wallet.currency}`
}

function bindSplash () {
  $('#enterLobby').addEventListener('click', () => {
    $('#splash').classList.add('is-hidden')
    $('#lobbyShell').classList.remove('is-hidden')
  })
  $('#backToSplash').addEventListener('click', () => {
    $('#lobbyShell').classList.add('is-hidden')
    $('#splash').classList.remove('is-hidden')
  })
  $('#closeLoader').addEventListener('click', closeLoader)
  window.addEventListener('message', event => {
    if (event.data && event.data.type === 'close-app') closeLoader()
  })
}

function bindWalletActions () {
  $('#walletChip').addEventListener('click', () => {
    $('#lobbyShell').classList.remove('is-hidden')
    $('#splash').classList.add('is-hidden')
    document.getElementById('walletPanel').scrollIntoView({ behavior: 'smooth' })
  })
  $('#fundWalletBtn').addEventListener('click', () => {
    state.wallet.balance += 100
    state.wallet.ledger.unshift({ label: 'Funded from lobby', amount: 100, kind: 'credit' })
    state.wallet.ledger = state.wallet.ledger.slice(0, 8)
    saveWallet()
    renderWallet()
    renderActiveCompetitions()
  })
  $('#collectPayoutBtn').addEventListener('click', () => {
    const amount = state.wallet.pendingPayout || 0
    if (amount <= 0) return
    state.wallet.balance += amount
    state.wallet.ledger.unshift({ label: 'Collected payouts', amount, kind: 'credit' })
    state.wallet.ledger = state.wallet.ledger.slice(0, 8)
    state.wallet.pendingPayout = 0
    saveWallet()
    renderWallet()
  })
}

function renderLobby () {
  renderFilters()
  renderHero()
  renderServerGrid()
  renderStatus()
}

function renderFilters () {
  const categories = ['all', ...new Set(state.servers.map(server => server.category))]
  $('#lobbyFilters').innerHTML = categories.map(category => `
    <button type="button" data-category="${escapeAttr(category)}" ${category === state.filter ? 'class="is-active"' : ''}>
      ${escapeHtml(categoryName(category))}
    </button>
  `).join('')
  $$('#lobbyFilters [data-category]').forEach(button => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.category
      renderFilters()
      renderServerGrid()
    })
  })
}

function renderHero () {
  const server = state.featured
  if (!server) {
    $('#heroPanel').classList.add('is-hidden')
    return
  }
  $('#heroPanel').classList.remove('is-hidden')
  $('#heroEyebrow').textContent = server.isLive ? 'Live now' : 'Featured'
  $('#heroTitle').textContent = server.title
  $('#heroBody').textContent = server.tagline
  $('#heroBackdrop').innerHTML = server.coverUrl
    ? `<img src="${escapeAttr(server.coverUrl)}" alt="">`
    : ''
  $('#heroJoin').onclick = () => loadApp(server)
}

function renderServerGrid () {
  const filtered = state.filter === 'all'
    ? state.servers
    : state.servers.filter(server => server.category === state.filter)
  $('#serverGrid').innerHTML = filtered.map(server => `
    <button class="server-card" type="button" data-server-id="${escapeAttr(server.serverId)}">
      <div class="server-cover">
        ${server.coverUrl ? `<img src="${escapeAttr(server.coverUrl)}" alt="${escapeAttr(server.title)}">` : ''}
      </div>
      <div class="meta">
        ${server.isLive ? '<span class="pill is-live">LIVE</span>' : ''}
        <span>${escapeHtml(server.category)}</span>
        <span>•</span>
        <span>${escapeHtml(server.entrantShape)} entrants</span>
      </div>
      <h3>${escapeHtml(server.title)}</h3>
      <div class="chips">
        <span>${escapeHtml(server.recommendedVariantCount)} variants</span>
        <span>${escapeHtml(server.recommendedMiniGameCount)} games</span>
        ${server.isLive ? '<span class="live-dot">live room</span>' : ''}
      </div>
    </button>
  `).join('')
  $$('#serverGrid [data-server-id]').forEach(button => {
    button.addEventListener('click', () => {
      const server = state.servers.find(s => s.serverId === button.dataset.serverId)
      if (server) loadApp(server)
    })
  })
}

function renderStatus () {
  const liveCount = state.servers.filter(server => server.isLive).length
  $('#lobbyStatus').innerHTML = `
    <span class="pill is-live">${liveCount} live</span>
    <span class="pill">${state.servers.length} servers</span>
  `
  $('#liveCount').textContent = `${liveCount} live`
}

function renderWallet () {
  const w = state.wallet
  $('#walletChip .wallet-amt').textContent = fmtMoney(w.balance)
  $('#walletBalance').textContent = fmtMoney(w.balance)
  $('#walletPayout').textContent = w.pendingPayout > 0
    ? `${fmtMoney(w.pendingPayout)} to collect`
    : 'No payouts'
  $('#collectPayoutBtn').disabled = w.pendingPayout <= 0
}

function renderActiveCompetitions () {
  const stored = loadStored()
  const entered = stored.enteredPools || {}
  const tiers = Object.keys(entered)
  const container = $('#activeList')
  if (tiers.length === 0) {
    container.innerHTML = `<p class="active-empty">You haven't entered any pools yet. Pick a live server to join a bracket.</p>`
    return
  }
  container.innerHTML = tiers.map(tier => {
    const server = state.servers.find(s => s.serverId === `server:${tier}`) ||
                   state.servers.find(s => s.fitId === tier) ||
                   { title: 'Tournament server', isLive: false }
    return `
      <div class="active-item">
        <strong>${escapeHtml(server.title || 'Tournament server')}</strong>
        <span>$${escapeHtml(String(tier))} pool · ${server.isLive ? '<em>Live</em>' : 'Entered'}</span>
      </div>
    `
  }).join('')
}

function renderProfile () {
  const p = state.profile
  const team = kawaiiTeams[p.team] || kawaiiTeams.br
  $('#profileChip').innerHTML = avatarSvg(team, p.username) + `
    <span>${escapeHtml(p.username)}</span>
  `
}

function avatarSvg (team, name) {
  const primary = team.colors[0] === '#ffffff' ? team.colors[1] : team.colors[0]
  const secondary = team.colors[1] === '#ffffff' ? team.colors[2] : team.colors[1]
  const initials = String(name || 'you').trim().split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'YO'
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${escapeAttr(name)} avatar">
    <defs><clipPath id="lobbyAvatarClip"><rect x="4" y="4" width="92" height="92" rx="28"/></clipPath></defs>
    <rect x="2" y="2" width="96" height="96" rx="30" fill="${escapeAttr(secondary)}" opacity=".35"/>
    <rect x="4" y="4" width="92" height="92" rx="28" fill="${escapeAttr(primary)}" opacity=".92"/>
    <text x="50" y="58" text-anchor="middle" font-size="34" font-weight="900" fill="#fff" font-family="Arial, sans-serif">${escapeHtml(initials)}</text>
    <rect x="4" y="4" width="92" height="92" rx="28" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/>
  </svg>`
}

function loadApp (server) {
  const loader = $('#appLoader')
  const frame = $('#appFrame')
  const title = $('#loaderTitle')
  title.textContent = server.title
  frame.src = server.appUrl
  loader.classList.remove('is-hidden')
}

function closeLoader () {
  $('#appLoader').classList.add('is-hidden')
  $('#appFrame').src = 'about:blank'
  // Refresh wallet/active data in case the shell changed state.
  state.wallet = loadWallet()
  renderWallet()
  renderActiveCompetitions()
}

function categoryName (category) {
  return category === 'all' ? 'All sports' : category.charAt(0).toUpperCase() + category.slice(1)
}

function renderError (error) {
  document.body.innerHTML = `
    <main style="padding:24px">
      <p class="eyebrow">Lobby error</p>
      <h1>Ultimate Sports lobby could not load</h1>
      <p style="color:var(--muted)">${escapeHtml(error.message || error)}</p>
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
