// The Pear renderer has no visible console — surface ANY uncaught error on-screen so a
// pre-boot throw can't leave a blank shell with no explanation.
if (typeof window !== 'undefined') window.__pearcupAppScriptSeen = true
if (typeof window !== 'undefined' && !window.__pearcupErrHook) {
  window.__pearcupErrHook = true
  window.addEventListener('error', e => {
    if (document.getElementById('bootErrorBar')) return
    const bar = document.createElement('pre')
    bar.id = 'bootErrorBar'
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:45vh;overflow:auto;margin:0;padding:12px 16px;background:#3a1030;color:#ffd9ec;font:12px/1.5 ui-monospace,monospace;z-index:99999;white-space:pre-wrap;border-top:3px solid #ff8fc0'
    bar.textContent = 'PearCup error:\n' + (e.error && e.error.stack ? e.error.stack : (e.message || String(e)))
    if (document.body) document.body.appendChild(bar)
  })
}

const STORAGE_KEY = 'pearcup-state-v2'
const LEGACY_STORAGE_KEY = 'pearcup-prototype'

const teams = [
  { id: 'br', name: 'Brazil', flag: '🇧🇷', colors: ['#139b49', '#ffd447', '#1b55a5'] },
  { id: 'jp', name: 'Japan', flag: '🇯🇵', colors: ['#f6f6f6', '#d91f3c', '#0a2f68'] },
  { id: 'ci', name: 'Ivory Coast', flag: '🇨🇮', colors: ['#f27b22', '#ffffff', '#159759'] },
  { id: 'no', name: 'Norway', flag: '🇳🇴', colors: ['#d91f3c', '#ffffff', '#143d8d'] },
  { id: 'mx', name: 'Mexico', flag: '🇲🇽', colors: ['#0c8c57', '#ffffff', '#d43f3a'] },
  { id: 'ec', name: 'Ecuador', flag: '🇪🇨', colors: ['#f9d33a', '#1f5aa6', '#d13d32'] },
  { id: 'eng', name: 'England', flag: '🏴', colors: ['#ffffff', '#d41f35', '#1c3764'] },
  { id: 'cd', name: 'DR Congo', flag: '🇨🇩', colors: ['#2a9bd8', '#f3d13d', '#d84a3a'] },
  { id: 'ch', name: 'Switzerland', flag: '🇨🇭', colors: ['#d71920', '#ffffff', '#901019'] },
  { id: 'dz', name: 'Algeria', flag: '🇩🇿', colors: ['#ffffff', '#00843d', '#d21034'] },
  { id: 'pt', name: 'Portugal', flag: '🇵🇹', colors: ['#d71920', '#006b3f', '#f6c343'] },
  { id: 'hr', name: 'Croatia', flag: '🇭🇷', colors: ['#ffffff', '#d7272f', '#1f5aa6'] },
  { id: 'es', name: 'Spain', flag: '🇪🇸', colors: ['#c60b1e', '#ffc400', '#75131a'] },
  { id: 'at', name: 'Austria', flag: '🇦🇹', colors: ['#ed2939', '#ffffff', '#8f1d27'] },
  { id: 'fr', name: 'France', flag: '🇫🇷', colors: ['#1d3d8f', '#ffffff', '#d84a3a'] },
  { id: 'ar', name: 'Argentina', flag: '🇦🇷', colors: ['#75aadb', '#ffffff', '#f6b33f'] },
  { id: 'us', name: 'United States', flag: '🇺🇸', colors: ['#ffffff', '#b31942', '#0a3161'] },
  { id: 'ca', name: 'Canada', flag: '🇨🇦', colors: ['#ff0000', '#ffffff', '#8a1538'] },
  { id: 'de', name: 'Germany', flag: '🇩🇪', colors: ['#000000', '#dd0000', '#ffce00'] },
  { id: 'ma', name: 'Morocco', flag: '🇲🇦', colors: ['#c1272d', '#006233', '#ffffff'] },
  { id: 'nl', name: 'Netherlands', flag: '🇳🇱', colors: ['#ae1c28', '#ffffff', '#21468b'] },
  { id: 'sn', name: 'Senegal', flag: '🇸🇳', colors: ['#00853f', '#fdef42', '#e31b23'] },
  { id: 'za', name: 'South Africa', flag: '🇿🇦', colors: ['#007749', '#ffb81c', '#de3831'] },
  { id: 'py', name: 'Paraguay', flag: '🇵🇾', colors: ['#d52b1e', '#ffffff', '#0038a8'] },
  { id: 'co', name: 'Colombia', flag: '🇨🇴', colors: ['#fcd116', '#003893', '#ce1126'] },
  { id: 'gh', name: 'Ghana', flag: '🇬🇭', colors: ['#ce1126', '#fcd116', '#006b3f'] },
  { id: 'se', name: 'Sweden', flag: '🇸🇪', colors: ['#006aa7', '#fecc00', '#0b4f7a'] },
  { id: 'au', name: 'Australia', flag: '🇦🇺', colors: ['#012169', '#ffcd00', '#00843d'] },
  { id: 'be', name: 'Belgium', flag: '🇧🇪', colors: ['#000000', '#fae042', '#ed2939'] },
  { id: 'ba', name: 'Bosnia and Herzegovina', flag: '🇧🇦', colors: ['#002395', '#fecb00', '#ffffff'] },
  { id: 'eg', name: 'Egypt', flag: '🇪🇬', colors: ['#ce1126', '#ffffff', '#000000'] },
  { id: 'cv', name: 'Cabo Verde', flag: '🇨🇻', colors: ['#003893', '#f7d116', '#cf2027'] }
]

// Runtime modules attach via <script> before app.js. In some runtimes (notably the Pear
// renderer, where injected SDK globals can throw during adaptation) a module can be missing
// or its runtime config can throw — never let that blank the whole app. Record issues,
// surface them, and boot the core UI (teams / avatars / game / watch) with safe fallbacks.
const bootIssues = []
function needModule (name) {
  const v = window[name]
  if (!v) bootIssues.push(name + ' missing')
  return v
}
function optionalModule (name) {
  return window[name] || null
}
const PearCupCore = needModule('PearCupCore')
const PearCupAdapters = needModule('PearCupAdapters')
const PearCupRuntimeSettings = optionalModule('PearCupRuntimeSettings')
const PearCupRuntimeConfig = needModule('PearCupRuntimeConfig')
const PearCupWorkerSim = optionalModule('PearCupWorkerSim')
const PearCupWorkerClient = optionalModule('PearCupWorkerClient')
const PearCupTransportSim = optionalModule('PearCupTransportSim')
const PearCupStorageSim = optionalModule('PearCupStorageSim')
const PearCupSettlementService = optionalModule('PearCupSettlementService')

// The renderer may use a local QVAC model, but it must never receive Tether WDK
// custody data. Runtime settings therefore expose only the safe QVAC lane here;
// payments stay exclusively in the KeyVault-backed Pear worker.
try {
  if (!window.PearCupRuntimeSettingsValue && PearCupRuntimeSettings && typeof PearCupRuntimeSettings.applyRendererRuntimeSettingsToRoot === 'function') {
    PearCupRuntimeSettings.applyRendererRuntimeSettingsToRoot(window)
  }
} catch (error) {
  bootIssues.push('renderer runtime settings failed: ' + (error && error.message ? error.message : String(error)))
}

// This is deliberately a public, keyless configuration. The football provider
// credential stays in the deployed relay worker; invalid or non-HTTPS values are
// ignored so a staged app cannot be tricked into fetching a credentialed origin.
function runtimeLiveDataRelay () {
  const configured = window.PearCupRuntimeSettingsValue && window.PearCupRuntimeSettingsValue.liveData
  if (!configured || typeof configured.relayUrl !== 'string') return null
  try {
    const relay = new URL(configured.relayUrl)
    const localHttp = relay.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(relay.hostname)
    if ((relay.protocol !== 'https:' && !localHttp) || relay.username || relay.password || !/\.json$/i.test(relay.pathname)) return null
    const candidateOdds = configured.oddsRelayUrl || new URL('polymarket-odds.json', relay).href
    const odds = new URL(candidateOdds)
    if ((odds.protocol !== 'https:' && !localHttp) || odds.username || odds.password || !/\.json$/i.test(odds.pathname)) return null
    const pollMs = Math.max(15_000, Math.min(120_000, Number(configured.pollMs) || 30_000))
    return { relayUrl: relay.href, oddsRelayUrl: odds.href, pollMs }
  } catch {
    return null
  }
}
const productionLiveData = runtimeLiveDataRelay()

// Correctly-shaped demo runtime used when the real runtime config can't initialize.
const DEMO_RUNTIME = {
  adapters: { qvac: { mode: 'demo' }, tetherWdk: { mode: 'demo' }, mode: 'demo' },
  mode: 'demo',
  readiness: {
    qvac: { mode: 'demo', adapterId: 'qvac-demo', label: 'QVAC referee' },
    tetherWdk: { mode: 'demo', adapterId: 'tether-wdk-demo', label: 'Tether WDK rail' },
    compliance: {},
    settlement: { realMoneyEnabled: false }
  },
  canUseRealMoney: false,
  createWorker: (o = {}) => (PearCupWorkerSim && PearCupWorkerSim.createWorkerSim)
    ? PearCupWorkerSim.createWorkerSim({ events: o.events || [], adapters: { mode: 'demo' }, storage: o.storage })
    : null,
  close: async () => {}
}
let integrationRuntime = DEMO_RUNTIME
try {
  if (PearCupRuntimeConfig) integrationRuntime = PearCupRuntimeConfig.createRuntimeConfig()
} catch (e1) {
  bootIssues.push('runtimeConfig threw: ' + (e1 && e1.message))
  try { if (PearCupRuntimeConfig) integrationRuntime = PearCupRuntimeConfig.createRuntimeConfig({ forceDemo: true }) } catch (e2) { integrationRuntime = DEMO_RUNTIME }
}
let bracketRenderSequence = 0
let gameRenderSequence = 0

const pools = [
  { tier: 10, max: 256, heat: 'Open' },
  { tier: 25, max: 160, heat: 'Hot' },
  { tier: 50, max: 96, heat: 'Sharp' },
  { tier: 100, max: 64, heat: 'Elite' }
]

const round32Matches = [
  { id: 'r32-1', time: 'Sat, 06/28', status: 'FT', slots: ['ca', 'za'], score: [1, 0] },
  { id: 'r32-2', time: 'Sun, 06/29', status: 'PEN 3-2', slots: ['ma', 'nl'], score: [1, 1] },
  { id: 'r32-3', time: 'Sun, 06/29', status: 'FT', slots: ['br', 'jp'], score: [2, 1] },
  { id: 'r32-4', time: 'Mon, 06/30', status: 'FT', slots: ['no', 'ci'], score: [2, 1] },
  { id: 'r32-5', time: 'Sun, 06/29', status: 'PEN 4-3', slots: ['py', 'de'], score: [1, 1] },
  { id: 'r32-6', time: 'Mon, 06/30', status: 'FT', slots: ['fr', 'se'], score: [3, 0] },
  { id: 'r32-7', time: 'Mon, 06/30', status: 'FT', slots: ['mx', 'ec'], score: [2, 0] },
  { id: 'r32-8', time: 'Tue, 07/01', status: 'FT', slots: ['eng', 'cd'], score: [2, 1] },
  { id: 'r32-9', time: 'Tue, 07/01', status: 'AET', slots: ['be', 'sn'], score: [3, 2] },
  { id: 'r32-10', time: 'Tue, 07/01', status: 'FT', slots: ['us', 'ba'], score: [2, 0] },
  { id: 'r32-11', time: 'Tue, 07/01', status: 'FT', slots: ['es', 'at'], score: [3, 0] },
  { id: 'r32-12', time: 'Tue, 07/01', status: 'FT', slots: ['pt', 'hr'], score: [2, 1] },
  { id: 'r32-13', time: 'Wed, 07/02', status: 'FT', slots: ['ch', 'dz'], score: [2, 0] },
  { id: 'r32-14', time: 'Wed, 07/02', status: 'PEN 2-4', slots: ['au', 'eg'], score: [1, 1] },
  { id: 'r32-15', time: 'Thu, 07/03', status: 'AET', slots: ['ar', 'cv'], score: [3, 2] },
  { id: 'r32-16', time: 'Thu, 07/03', status: 'FT', slots: ['co', 'gh'], score: [1, 0] }
]

const commentary = {
  EN: [
    ['Today', 'Spain vs Belgium is the next quarter-final room. Picks are open until kickoff.'],
    ['22:00Z', 'France vs Morocco opens the quarters, then Norway vs England and Argentina vs Switzerland.'],
    ['QF', 'Pool impact is live, but the fallback feed will not invent scores before kickoff.']
  ],
  PT: [
    ['Today', 'Espanha vs Belgica e a proxima sala das quartas. Palpites abertos ate o inicio.'],
    ['22:00Z', 'Franca vs Marrocos abre as quartas, depois Noruega vs Inglaterra e Argentina vs Suica.'],
    ['QF', 'O impacto do bolao esta ativo, mas o fallback nao inventa placares antes do jogo.']
  ],
  ES: [
    ['Today', 'Espana vs Belgica es la proxima sala de cuartos. Picks abiertos hasta el inicio.'],
    ['22:00Z', 'Francia vs Marruecos abre los cuartos, luego Noruega vs Inglaterra y Argentina vs Suiza.'],
    ['QF', 'El impacto del pool esta activo, pero el fallback no inventa marcadores antes del partido.']
  ],
  FR: [
    ['Today', 'Espagne vs Belgique est la prochaine salle des quarts. Picks ouverts jusqu au coup d envoi.'],
    ['22:00Z', 'France vs Maroc ouvre les quarts, puis Norvege vs Angleterre et Argentine vs Suisse.'],
    ['QF', 'L impact du pool est actif, mais le fallback ne fabrique pas de score avant le match.']
  ]
}

const defaultChat = []

const DEMO_CHAT_MESSAGES = new Set([
  'Spain/Austria room is up. No fake score until the feed lands.',
  'Portugal/Croatia pool is next on my list.',
  'Good, bracket is still Round of 32.',
  'Spain/Belgium quarter-final room is up. No fake score until the feed lands.',
  'France/Morocco pool is next on my list.',
  'Good, we are into the quarter-finals now.'
])

const liveTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'stats', label: 'Stats' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'games', label: 'Games' },
  { id: 'qvac', label: 'QVAC' }
]

const homeFixtures = [
  { status: 'Fri, 07/10', title: 'Spain vs Belgium', detail: 'Quarter-final match room', live: false },
  { status: 'Thu, 07/09', title: 'France vs Morocco', detail: 'Match pool opens with real entries', live: false },
  { status: 'Sat, 07/11', title: 'Norway vs England', detail: 'Late room opening', live: false }
]

const bracketLinks = [
  { from: ['r32-1', 'r32-2'], to: 'r16-1' },
  { from: ['r32-3', 'r32-4'], to: 'r16-2' },
  { from: ['r32-5', 'r32-6'], to: 'r16-3' },
  { from: ['r32-7', 'r32-8'], to: 'r16-4' },
  { from: ['r32-9', 'r32-10'], to: 'r16-5' },
  { from: ['r32-11', 'r32-12'], to: 'r16-6' },
  { from: ['r32-13', 'r32-14'], to: 'r16-7' },
  { from: ['r32-15', 'r32-16'], to: 'r16-8' },
  { from: ['r16-1', 'r16-2'], to: 'qf-1' },
  { from: ['r16-3', 'r16-4'], to: 'qf-2' },
  { from: ['r16-5', 'r16-6'], to: 'qf-3' },
  { from: ['r16-7', 'r16-8'], to: 'qf-4' },
  { from: ['qf-1', 'qf-2'], to: 'sf-1' },
  { from: ['qf-3', 'qf-4'], to: 'sf-2' },
  { from: ['sf-1', 'sf-2'], to: 'final-1' }
]

const bracketMatchIds = [
  'r32-1', 'r32-2', 'r32-3', 'r32-4',
  'r32-5', 'r32-6', 'r32-7', 'r32-8',
  'r32-9', 'r32-10', 'r32-11', 'r32-12',
  'r32-13', 'r32-14', 'r32-15', 'r32-16',
  'r16-1', 'r16-2', 'r16-3', 'r16-4',
  'r16-5', 'r16-6', 'r16-7', 'r16-8',
  'qf-1', 'qf-2', 'qf-3', 'qf-4',
  'sf-1', 'sf-2',
  'final-1'
]

const state = loadState()

if (typeof history !== 'undefined' && 'scrollRestoration' in history) history.scrollRestoration = 'manual'

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

function newPersistentPlayerId () {
  try {
    const bytes = new Uint8Array(16)
    const crypto = window.crypto || globalThis.crypto
    if (crypto && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes)
      return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    }
  } catch (e) {}
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

function validPersistentPlayerId (value) {
  return /^[a-f0-9]{32,128}$/i.test(String(value || ''))
}

function loadState () {
  const fallback = {
    view: 'onboarding',
    username: 'captain',
    team: 'br',
    selectedTier: 25,
    picks: {},
    language: 'EN',
    liveTab: 'overview',
    gameRound: 0,
    gameSpectating: false,
    voice: false,
    payoutAddresses: {},
    wallet: {
      balance: 500,
      currency: 'USDT',
      pendingPayout: 120,
      ledger: [{ label: 'Welcome bonus', amount: 500, kind: 'credit' }]
    },
    playerId: '',
    poolLedger: [],
    enteredPools: {},
    enteredGamePools: {},
    selectedGamePool: '',
    selectedOddsMatchId: '',
    gamePoolDraft: { matchId: '', pick: '', tier: 10 },
    triviaScore: 0,
    liveConfig: { enabled: false, provider: 'football-data', apiKey: '', matchId: '', proxy: '', pollSec: 30 },
    theme: 'kawaii',
    themeChosen: false,
    chat: defaultChat
  }

  try {
    const currentState = localStorage.getItem(STORAGE_KEY)
    const legacyState = currentState ? null : localStorage.getItem(LEGACY_STORAGE_KEY)
    const saved = JSON.parse(currentState || legacyState || 'null')
    if (!saved) return fallback
    if (!currentState && legacyState) {
      localStorage.setItem(STORAGE_KEY, legacyState)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
    const merged = {
      ...fallback,
      ...saved,
      chat: saved.chat || defaultChat,
      payoutAddresses: { ...fallback.payoutAddresses, ...(saved.payoutAddresses || {}) },
      wallet: { ...fallback.wallet, ...(saved.wallet || {}) },
      playerId: validPersistentPlayerId(saved.playerId) ? saved.playerId : newPersistentPlayerId(),
      poolLedger: Array.isArray(saved.poolLedger) ? saved.poolLedger.slice(0, 512) : [],
      enteredPools: saved.enteredPools || {},
      enteredGamePools: saved.enteredGamePools || {},
      gamePoolDraft: { ...fallback.gamePoolDraft, ...(saved.gamePoolDraft || {}) },
      triviaScore: Number.isFinite(Number(saved.triviaScore)) ? Number(saved.triviaScore) : 0,
      liveConfig: { ...fallback.liveConfig, ...(saved.liveConfig || {}) }
    }
    if (merged.chat.length && merged.chat.every(message => DEMO_CHAT_MESSAGES.has(String(message && message.text || '')))) {
      merged.chat = []
    }
    // A live peer match can't survive a reload (the connection is gone) — start in the lobby.
    if (merged.match && merged.match.peer) merged.match = null
    // Voice capture and room presence are deliberately never resumed from storage.
    // A fresh page needs a new explicit user gesture before it can touch a mic.
    merged.voice = false
    merged.picks = normalizeBracketPicks(merged.picks)
    return merged
  } catch {
    return fallback
  }
}

function normalizeBracketPicks (picks = {}) {
  const source = picks && typeof picks === 'object' && !Array.isArray(picks) ? picks : {}
  const next = { ...source }
  const hasRound32 = Object.keys(next).some(id => id.startsWith('r32-'))
  if (!hasRound32) {
    for (let i = 1; i <= 8; i++) {
      if (next[`r16-${i}`] && !next[`r32-${i}`]) next[`r32-${i}`] = next[`r16-${i}`]
      if (next[`qf-${i}`] && !next[`r16-${i}`]) next[`r16-${i}`] = next[`qf-${i}`]
    }
    for (let i = 1; i <= 4; i++) {
      if (next[`sf-${i}`] && !next[`qf-${i}`]) next[`qf-${i}`] = next[`sf-${i}`]
    }
    if (next['final-1'] && !next['sf-1']) next['sf-1'] = next['final-1']
  }
  const knownTeamIds = new Set(teams.map(team => team.id))
  const round32ById = new Map(round32Matches.map(match => [match.id, match]))
  for (const id of Object.keys(next)) {
    const teamId = next[id]
    if (!bracketMatchIds.includes(id) || !knownTeamIds.has(teamId)) {
      delete next[id]
      continue
    }
    const round32Match = round32ById.get(id)
    if (round32Match && !round32Match.slots.includes(teamId)) delete next[id]
  }
  // Rolling pools: later-round slots resolve from actual results, so drop any
  // saved pick that names a team no longer reachable in that match (keeps
  // picks on decided matches so the scorecard can mark them right/wrong).
  try {
    for (const round of buildRounds()) {
      for (const match of round.matches) {
        if (round32ById.has(match.id)) continue
        const pick = next[match.id]
        if (!pick) continue
        if (!match.slots[0] || !match.slots[1] || !match.slots.includes(pick)) delete next[match.id]
      }
    }
  } catch (e) {}
  return next
}

function persist () {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

if (!validPersistentPlayerId(state.playerId)) {
  state.playerId = newPersistentPlayerId()
  persist()
}

function teamById (id) {
  return teams.find(team => team.id === id) || teams[0]
}

function escapeHtml (value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function serviceModeLabel (service) {
  return service.mode === 'sdk' ? 'SDK' : 'Demo'
}

function serviceStatusText (service) {
  if (service.sdkReady) return `${serviceModeLabel(service)} connected`
  if (service.sdkDetected) return `SDK missing ${service.missing.join(', ')}`
  return 'Demo adapter'
}

function settlementStatusClass (settlement) {
  if (settlement.tone === 'ready') return 'is-ready'
  if (settlement.tone === 'warn') return 'is-warn'
  return 'is-locked'
}

function createUiSettlementService (worker) {
  function workerStatusOrRendererStatus () {
    const workerStatus = worker && typeof worker.status === 'function' ? worker.status() : null
    if (workerStatus) return workerStatus
    return {
      id: 'pearcup-renderer-settlement',
      mode: { ...integrationRuntime.mode },
      readiness: integrationRuntime.readiness,
      canUseRealMoney: integrationRuntime.canUseRealMoney,
      secrets: {
        wdkSeedExposed: false
      }
    }
  }

  const workerRuntime = {
    runtime: integrationRuntime,
    worker,
    dispatchAsync: command => worker.dispatchAsync(command),
    status: workerStatusOrRendererStatus,
    close: async () => {}
  }
  if (worker && typeof worker.settleGameRoundWithReceipt === 'function') {
    workerRuntime.settleGameRoundWithReceipt = (payload, opts) => worker.settleGameRoundWithReceipt(payload, opts)
  }
  if (worker && typeof worker.settleBracketPoolWithReceipt === 'function') {
    workerRuntime.settleBracketPoolWithReceipt = (payload, opts) => worker.settleBracketPoolWithReceipt(payload, opts)
  }

  return PearCupSettlementService.createGuardedSettlementService({
    workerRuntime,
    requireLive: integrationRuntime.canUseRealMoney
  })
}

function renderSettlementError (target, err, title = 'Settlement blocked') {
  const gate = err && err.gate
  const missing = gate && Array.isArray(gate.missing) && gate.missing.length
    ? gate.missing.map(item => `<li>${escapeHtml(item.label)}</li>`).join('')
    : '<li>Runtime readiness is incomplete.</li>'
  target.innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header">
        <p class="eyebrow">Settlement</p>
        <strong>${escapeHtml(title)}</strong>
      </div>
      <ul class="runtime-missing-list">${missing}</ul>
    </article>
  `
}

function renderSignalPanel () {
  const readiness = integrationRuntime.readiness
  return `
    <div class="rail-header">
      <p class="eyebrow">Pear</p>
      <strong>Room signal</strong>
    </div>
    <div class="signal-row">
      <span>Peers</span>
      <strong>${Math.max(1, Number(state.spectators || 1))}</strong>
    </div>
    <div class="signal-row">
      <span>Room link</span>
      <strong>${window.PearCupWatchSync ? 'Ready' : 'Local'}</strong>
    </div>
    <div class="signal-row">
      <span>Ref status</span>
      <strong>${serviceModeLabel(readiness.qvac)}</strong>
    </div>
    <div class="signal-row">
      <span>Payments</span>
      <strong>${serviceModeLabel(readiness.tetherWdk)}</strong>
    </div>
    <div class="signal-row">
      <span>Prize gate</span>
      <strong>${readiness.settlement.realMoneyEnabled ? 'Live' : 'Locked'}</strong>
    </div>
  `
}

function initials (name) {
  const clean = String(name || 'you').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return clean.slice(0, 2).toUpperCase()
}

function hashString (value) {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function mixHex (hex, target, amount) {
  const normalize = value => {
    const clean = value.replace('#', '')
    const full = clean.length === 3 ? clean.split('').map(char => char + char).join('') : clean
    return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16))
  }
  const from = normalize(hex)
  const to = normalize(target)
  const mixed = from.map((channel, index) => {
    const value = Math.round(channel + (to[index] - channel) * amount)
    return value.toString(16).padStart(2, '0')
  })
  return `#${mixed.join('')}`
}

// Registry for AI-generated Higgsfield portraits, keyed by `${name}-${team.id}`.
// The static SVG shell remains a pre-boot fallback; hydrated avatars use these assets.
const AVATAR_PORTRAITS = (typeof window !== 'undefined' && (window.__pearcupPortraits = window.__pearcupPortraits || {})) || {}
Object.assign(AVATAR_PORTRAITS, {
  'captain-br': 'avatars/captain-br.png',
  captain: 'avatars/captain-br.png',
  vera: 'avatars/vera-no.png',
  milo: 'avatars/milo-mx.png',
  lina: 'avatars/lina-no.png',
  kaito: 'avatars/kaito-jp.png',
  mateo: 'avatars/mateo-ar.png',
  emre: 'avatars/emre-ch.png',
  zola: 'avatars/zola-ci.png',
  samir: 'avatars/samir.png',
  saki: 'avatars/saki.png',
  dado: 'avatars/dado.png',
  ash: 'avatars/ash.png'
})
Object.assign(AVATAR_PORTRAITS, {
  aria: 'avatars/p-aria.png', rico: 'avatars/p-rico.png', kenji: 'avatars/p-kenji.png',
  amara: 'avatars/p-amara.png', luca: 'avatars/p-luca.png', sofia: 'avatars/p-sofia.png',
  omar: 'avatars/p-omar.png', nina: 'avatars/p-nina.png', diego: 'avatars/p-diego.png',
  yuki: 'avatars/p-yuki.png', kwame: 'avatars/p-kwame.png', ingrid: 'avatars/p-ingrid.png',
  rafa: 'avatars/p-rafa.png', mei: 'avatars/p-mei.png', tariq: 'avatars/p-tariq.png',
  freya: 'avatars/p-freya.png', santi: 'avatars/p-santi.png', kofi: 'avatars/p-kofi.png'
})

// Higgsfield portraits are the production avatar art. Each team is mapped to a
// portrait whose authored jersey colour family matches that team's kit. The
// visible team badge and colour frame provide the exact national identity.
const AVATAR_POOL = [
  'p-aria', 'p-rico', 'p-kenji', 'p-amara', 'p-luca', 'p-sofia', 'p-omar', 'p-nina',
  'p-diego', 'p-yuki', 'p-kwame', 'p-ingrid', 'p-rafa', 'p-mei', 'p-tariq', 'p-freya',
  'p-santi', 'p-kofi'
]

const TEAM_AVATAR_PORTRAITS = {
  br: 'p-rafa', jp: 'p-omar', ci: 'p-kwame', no: 'p-aria',
  mx: 'p-amara', ec: 'p-rico', eng: 'p-luca', cd: 'p-santi',
  ch: 'p-omar', dz: 'p-amara', pt: 'p-mei', hr: 'p-omar',
  es: 'p-mei', at: 'p-omar', fr: 'p-kenji', ar: 'p-diego',
  us: 'p-ingrid', ca: 'p-aria', de: 'p-kofi', ma: 'p-tariq',
  nl: 'p-kwame', sn: 'p-rafa', za: 'p-rafa', py: 'p-omar',
  co: 'p-rico', gh: 'p-kofi', se: 'p-kenji', au: 'p-freya',
  be: 'p-kofi', ba: 'p-ingrid', eg: 'p-omar', cv: 'p-kenji'
}

const NAMED_AVATAR_TEAMS = {
  captain: 'br', vera: 'no', milo: 'mx', lina: 'no',
  kaito: 'jp', mateo: 'ar', emre: 'ch', zola: 'ci'
}

function pooledPortrait (name, team) {
  const h = hashString(`${name}-${team && team.id ? team.id : ''}`)
  return `avatars/${AVATAR_POOL[h % AVATAR_POOL.length]}.png`
}

function avatarPortrait (name, team) {
  if (!team || !team.id) return AVATAR_PORTRAITS[String(name).toLowerCase()] || null
  const key = String(name || '').toLowerCase()
  const teamSpecific = AVATAR_PORTRAITS[`${key}-${team.id}`]
  if (teamSpecific) return teamSpecific
  if (NAMED_AVATAR_TEAMS[key] === team.id && AVATAR_PORTRAITS[key]) return AVATAR_PORTRAITS[key]
  const teamPortrait = TEAM_AVATAR_PORTRAITS[team.id]
  if (teamPortrait) return `avatars/${teamPortrait}.png`
  return AVATAR_PORTRAITS[key] || pooledPortrait(name, team)
}

// Pick a jersey base color that stays visible on light backgrounds:
// prefer the iconic primary, but skip past any near-white team color.
function pickJerseyColor (colors) {
  const isNearWhite = hex => {
    const clean = hex.replace('#', '')
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
    const rgb = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16))
    return Math.min(...rgb) > 214
  }
  return colors.find(c => !isNearWhite(c)) || colors[0]
}

function avatarSvg (name, team, compact = false) {
  const scaleClass = compact ? 'compact-avatar' : 'showcase-avatar'
  const jersey = pickJerseyColor(team.colors)
  const jerseyLight = mixHex(jersey, '#ffffff', 0.32)
  const accent = team.colors.find(c => c !== jersey) || '#ff8fc0'
  const label = escapeHtml(initials(name))
  const ariaLabel = `${escapeHtml(name)} anime avatar wearing ${escapeHtml(team.name)} kit`

  const portrait = avatarPortrait(name, team)
  if (portrait) {
    return `
    <span class="avatar-art avatar-portrait ${scaleClass}" role="img" aria-label="${ariaLabel}" style="--avatar-primary:${escapeHtml(jersey)};--avatar-secondary:${escapeHtml(accent)};--avatar-soft:${escapeHtml(jerseyLight)}">
      <img src="./${escapeHtml(portrait)}" alt="" decoding="async">
      <span class="avatar-team-mark" aria-hidden="true">${team.flag}</span>
    </span>`
  }

  return `
    <span class="avatar-art avatar-fallback ${scaleClass}" role="img" aria-label="${ariaLabel}" style="--avatar-primary:${escapeHtml(jersey)};--avatar-secondary:${escapeHtml(accent)};--avatar-soft:${escapeHtml(jerseyLight)}">
      <span class="avatar-fallback-initials">${label}</span>
      <span class="avatar-team-mark" aria-hidden="true">${team.flag}</span>
    </span>`
}

function showToast (message) {
  const toast = $('#toast')
  toast.textContent = message
  toast.classList.add('is-visible')
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2200)
}

function resetScrollPosition () {
  window.scrollTo(0, 0)
  requestAnimationFrame(() => window.scrollTo(0, 0))
  setTimeout(() => window.scrollTo(0, 0), 80)
  setTimeout(() => window.scrollTo(0, 0), 320)
  setTimeout(() => window.scrollTo(0, 0), 640)
}

function normalizeStartupView (value) {
  const clean = String(value || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/^\/+/, '')
    .toLowerCase()
  if (clean === 'profile') return 'onboarding'
  return ['onboarding', 'home', 'bracket', 'watch', 'games'].includes(clean) ? clean : ''
}

function startupViewFromHash () {
  try {
    return normalizeStartupView(location && location.hash)
  } catch (e) {
    return ''
  }
}

function resolveStartupView () {
  return startupViewFromHash() || normalizeStartupView(state.view) || 'onboarding'
}

function applyStartupView () {
  setView(resolveStartupView())
}

function handleStartupHashChange () {
  const nextView = startupViewFromHash()
  if (!nextView || nextView === state.view) return
  setView(nextView)
}

function syncLocationHashForView (view) {
  const nextView = normalizeStartupView(view)
  if (!nextView || typeof location === 'undefined') return
  try {
    if (startupViewFromHash() === nextView) return
    location.hash = `#${nextView}`
  } catch (e) {}
}

function bindStartupRouteEvents () {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
  window.addEventListener('hashchange', handleStartupHashChange)
}

function syncRuntimeScreenDiagnostics (view) {
  if (typeof document === 'undefined' || !document.documentElement) return
  const active = view || (document.querySelector('.screen.is-active') && document.querySelector('.screen.is-active').id) || ''
  if (active) document.documentElement.dataset.pearcupActiveScreen = active
  if (typeof window !== 'undefined' && window.__pearcupAppBooted) {
    document.documentElement.dataset.pearcupAppBooted = 'true'
  }
}

function setView (view) {
  const nextView = normalizeStartupView(view)
  if (!nextView) return
  state.view = nextView
  syncLocationHashForView(nextView)
  persist()
  renderView(nextView)
  $$('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === nextView))
  $$('.topnav button').forEach(button => {
    button.classList.toggle('is-active', button.dataset.view === nextView)
  })
  syncRuntimeScreenDiagnostics(nextView)
  if (nextView === 'bracket') scheduleBracketConnectors()
  if (nextView === 'games') renderGames()
  resetScrollPosition()
}

function renderView (view) {
  if (view === 'onboarding') {
    renderTeams()
    renderProfile()
    return
  }
  if (view === 'profile') {
    renderTeams()
    renderProfile()
    return
  }
  if (view === 'home') {
    renderHomeDashboard()
    renderPools()
    renderGamePools()
    return
  }
  if (view === 'bracket') {
    renderBracket()
    return
  }
  if (view === 'watch') {
    renderWatch()
    return
  }
  if (view === 'games') {
    renderGames()
  }
}

// ==================== Shared Wallet ====================
// One wallet used everywhere: header chip (all pages), profile management,
// bracket entry debits, game escrow, payout credits. Demo balance now; real
// funding/withdrawal is the Tether WDK deposit/withdraw seam.
function fmtMoney (n) { return `${Number(n).toLocaleString('en-US')} ${state.wallet.currency}` }
function walletLog (label, amount, kind) {
  state.wallet.ledger = state.wallet.ledger || []
  state.wallet.ledger.unshift({ label, amount, kind })
  state.wallet.ledger = state.wallet.ledger.slice(0, 8)
}
function fundWallet (amount) {
  state.wallet.balance += amount
  walletLog('Funded wallet', amount, 'credit')
  persist(); refreshWallet(); showToast(`Added ${fmtMoney(amount)} to your wallet`)
}
function withdrawWallet () {
  // Never mutate the visible balance to imitate a withdrawal. A real request must
  // be created by the KeyVault-backed WDK worker, quote/broadcast only after the
  // recipient route and live-compliance gates have been verified.
  showToast('Withdrawals are locked until the worker-backed WDK rail is configured')
}
function collectPayouts () {
  const amount = state.wallet.pendingPayout || 0
  if (amount <= 0) { showToast('No payouts to collect yet'); return }
  state.wallet.balance += amount
  state.wallet.pendingPayout = 0
  walletLog('Collected pool payout', amount, 'credit')
  persist(); refreshWallet(); showToast(`Collected ${fmtMoney(amount)} in payouts 🎉`)
}
function debitWallet (amount, memo) {
  if (state.wallet.balance < amount) return false
  state.wallet.balance -= amount
  walletLog(memo || 'Entry', amount, 'debit')
  persist(); refreshWallet(); return true
}
function refreshWallet () {
  renderWalletChip()
  if ($('#walletManage')) renderWalletManage()
  if (state.view === 'bracket' && $('#bracketPoolSelect')) renderPoolSelect()
}

function renderWalletChip () {
  const chip = $('#walletChip')
  if (!chip) return
  chip.innerHTML = `<span class="wallet-ico">💰</span><span class="wallet-amt">${escapeHtml(fmtMoney(state.wallet.balance))}</span>`
}

function renderWalletManage () {
  const el = $('#walletManage')
  if (!el) return
  const w = state.wallet
  el.innerHTML = `
    <div class="wallet-card">
      <div class="wallet-top">
        <div>
          <p class="eyebrow">Wallet · Tether WDK</p>
          <p class="wallet-balance">${escapeHtml(fmtMoney(w.balance))}</p>
        </div>
        <span class="wallet-badge ${w.pendingPayout > 0 ? 'is-live' : ''}">${w.pendingPayout > 0 ? `${fmtMoney(w.pendingPayout)} to collect` : 'All collected'}</span>
      </div>
      <div class="wallet-actions">
        <button class="primary-button" type="button" data-fund="50">+ Demo 50</button>
        <button class="secondary-button" type="button" data-fund="100">+ Demo 100</button>
        <button class="secondary-button" type="button" data-fund="250">+ Demo 250</button>
        <button class="primary-button wallet-collect" type="button" id="collectPayoutBtn"${w.pendingPayout > 0 ? '' : ' disabled'}>Collect payouts</button>
        <button class="secondary-button" type="button" id="withdrawBtn" disabled>Withdraw · locked</button>
      </div>
      <div class="wallet-rail-status" role="status">
        <span class="rail-chip is-locked">Tether WDK locked</span>
        <p><strong>Deposit QR unavailable.</strong> A fresh USDT receive address and QR are created only by the KeyVault-backed worker after the WDK rail, recipient routing, and compliance checks are live.</p>
      </div>
      <div class="wallet-ledger">
        ${(w.ledger || []).map(row => `
          <div class="wallet-row">
            <span>${escapeHtml(row.label)}</span>
            <strong class="${row.kind}">${row.kind === 'credit' ? '+' : '−'}${escapeHtml(fmtMoney(row.amount))}</strong>
          </div>`).join('')}
      </div>
      <p class="wallet-note">Demo balance shared across brackets, games, and payouts. It is not a deposit balance and cannot be withdrawn.</p>
    </div>`
  $$('#walletManage [data-fund]').forEach(b => b.addEventListener('click', () => fundWallet(Number(b.dataset.fund))))
  const collect = $('#collectPayoutBtn'); if (collect) collect.addEventListener('click', collectPayouts)
  const withdraw = $('#withdrawBtn'); if (withdraw) withdraw.addEventListener('click', withdrawWallet)
}

// Portable account identity is deliberately separate from Tether/WDK. It
// synchronizes a player profile and demo balance between a browser and Pear
// hosts; it never sends a wallet seed, deposit address, or payment authority.
function portableIdentity () {
  const identity = window.PearCupIdentity
  return identity && typeof identity.status === 'function' ? identity : null
}

function applyPortableIdentity (account) {
  if (!account || !validPersistentPlayerId(account.id)) return
  const changed = state.playerId !== account.id
  state.playerId = account.id
  state.username = String(account.displayName || state.username || 'captain').slice(0, 18)
  state.team = teams.some(team => team.id === account.team) ? account.team : state.team
  persist()
  if (changed) startPoolSync()
  renderTeams()
  renderProfile()
  showToast('PearCup account linked on this device')
}

function renderIdentityManage () {
  const el = $('#identityManage')
  const identity = portableIdentity()
  if (!el) return
  if (!identity) { el.innerHTML = ''; return }
  const info = identity.status()
  if (!info.configured) { el.innerHTML = ''; return }
  const pair = new URLSearchParams(location.search).get('pair')
  const isPearHost = Boolean(window.Pear || (window.pear && window.pear.identity))
  const linked = info.account
  const deviceLink = info.pending
  const safePair = pair && /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/i.test(pair) ? pair.toUpperCase() : ''
  el.innerHTML = `
    <div class="wallet-card identity-card">
      <div class="wallet-top">
        <div>
          <p class="eyebrow">Portable profile</p>
          <p class="identity-status ${linked ? 'is-linked' : ''}">${linked ? '● Linked across devices' : '○ This device is not linked'}</p>
        </div>
        <span class="wallet-badge ${linked ? 'is-live' : ''}">${linked ? 'Passkey protected' : 'Optional'}</span>
      </div>
      ${linked
        ? `<p class="wallet-note">This install is playing as <strong>${escapeHtml(linked.displayName)}</strong>. Its account id and demo balance can follow you after a passkey approval; no Pear root identity or wallet credential is copied.</p>`
        : `<p class="wallet-note">Use a passkey in the browser, then explicitly approve this Pear or browser install. This replaces anonymous local player ids without creating a wallet login.</p>`}
      <div class="wallet-actions">
        ${!linked && !isPearHost ? '<button class="primary-button" type="button" id="identityCreate">Create passkey</button><button class="secondary-button" type="button" id="identitySignIn">Use existing passkey</button>' : ''}
        ${isPearHost && !linked ? '<button class="primary-button" type="button" id="identityStartLink">Link this Pear device</button>' : ''}
        ${deviceLink ? `<a class="secondary-button identity-pair-link" href="${escapeHtml(deviceLink.pairUrl)}" target="_blank" rel="noopener">Open approval page</a><button class="primary-button" type="button" id="identityClaimLink">I approved it</button>` : ''}
        ${safePair && linked ? '<button class="primary-button" type="button" id="identityApproveLink">Approve this device</button>' : ''}
        ${linked ? '<button class="secondary-button" type="button" id="identityRefresh">Refresh profile</button>' : ''}
      </div>
      ${deviceLink ? `<p class="identity-pair-code">Link code: <strong>${escapeHtml(deviceLink.code)}</strong> · expires soon. Confirm the shown device name and fingerprint before approving.</p>` : ''}
      ${info.error ? `<p class="livedata-result is-err">${escapeHtml(info.error)}</p>` : ''}
    </div>`
  const action = async (work) => {
    try { const account = await work(); if (account && account.id) applyPortableIdentity(account); else renderIdentityManage() } catch (error) { showToast(error && error.message ? error.message : 'Identity action could not finish'); renderIdentityManage() }
  }
  const create = $('#identityCreate'); if (create) create.addEventListener('click', () => action(() => identity.enroll({ displayName: state.username, team: state.team })))
  const signIn = $('#identitySignIn'); if (signIn) signIn.addEventListener('click', () => action(() => identity.signIn()))
  const startLink = $('#identityStartLink'); if (startLink) startLink.addEventListener('click', () => action(() => identity.startDevicePairing()))
  const claimLink = $('#identityClaimLink'); if (claimLink) claimLink.addEventListener('click', () => action(() => identity.claimDevicePairing()))
  const approveLink = $('#identityApproveLink'); if (approveLink) approveLink.addEventListener('click', () => action(() => identity.approvePairing(safePair)))
  const refresh = $('#identityRefresh'); if (refresh) refresh.addEventListener('click', () => action(async () => { const result = await identity.restore(); return result.account }))
}

function showOperatorLiveDataSettings () {
  try {
    const params = new URLSearchParams(location.search)
    if (params.has('operator') || params.has('debug') || params.get('liveData') === '1') return true
    return window.localStorage && window.localStorage.getItem('pearcupOperatorMode') === 'true'
  } catch (e) {
    return false
  }
}

function renderLiveDataSettings () {
  const el = $('#liveDataSettings')
  if (!el) return
  if (!showOperatorLiveDataSettings()) {
    el.innerHTML = ''
    return
  }
  if (productionLiveData) {
    el.innerHTML = `
      <div class="wallet-card livedata-card">
        <div class="wallet-top">
          <div>
            <p class="eyebrow">Live match data</p>
            <p class="livedata-status is-on">● Production relay connected</p>
          </div>
        </div>
        <p class="wallet-note">This release reads public cached snapshots from ${escapeHtml(new URL(productionLiveData.relayUrl).host)}. The Football-Data credential is held only by the relay worker and cannot be entered or stored in this app.</p>
      </div>`
    return
  }
  const c = state.liveConfig
  el.innerHTML = `
    <div class="wallet-card livedata-card">
      <div class="wallet-top">
        <div>
          <p class="eyebrow">Live match data</p>
          <p class="livedata-status ${c.enabled ? 'is-on' : ''}">${c.enabled ? '● Live API feed' : 'Simulated feed'}</p>
        </div>
        <label class="livedata-switch"><input type="checkbox" id="liveEnabled" ${c.enabled ? 'checked' : ''}><span></span></label>
      </div>
      <div class="livedata-fields">
        <label>Provider
          <select id="liveProvider">
            <option value="football-data" ${c.provider === 'football-data' ? 'selected' : ''}>Football-Data.org</option>
            <option value="api-football" ${c.provider === 'api-football' ? 'selected' : ''}>API-Football</option>
          </select>
        </label>
        <label>API key
          <input type="password" id="liveKey" value="${escapeHtml(c.apiKey)}" placeholder="paste your key" autocomplete="off" spellcheck="false">
        </label>
        <label>Match / fixture ID <em>(blank = auto-pick a live match)</em>
          <input type="text" id="liveMatch" value="${escapeHtml(c.matchId)}" placeholder="e.g. 497501" spellcheck="false">
        </label>
        <label>CORS proxy <em>(browser testing only)</em>
          <input type="text" id="liveProxy" value="${escapeHtml(c.proxy)}" placeholder="https://your-proxy/?url=" spellcheck="false">
        </label>
      </div>
      <div class="wallet-actions">
        <button class="primary-button" id="liveSaveBtn" type="button">Save &amp; apply</button>
        <button class="secondary-button" id="liveTestBtn" type="button">Test connection</button>
      </div>
      <p class="livedata-result" id="liveTestResult"></p>
      <p class="wallet-note">Browsers can't call these APIs directly (CORS). In the Pear runtime a worker fetches (no CORS) and relays over the room topic; for browser testing add a CORS proxy. Free keys: football-data.org or dashboard.api-football.com. World Cup 2026 is live now.</p>
    </div>`
  $('#liveSaveBtn').addEventListener('click', () => {
    state.liveConfig = {
      enabled: $('#liveEnabled').checked,
      provider: $('#liveProvider').value,
      apiKey: $('#liveKey').value.trim(),
      matchId: $('#liveMatch').value.trim(),
      proxy: $('#liveProxy').value.trim(),
      pollSec: 30
    }
    persist()
    startLiveFeed()
    renderLiveDataSettings()
    showToast(state.liveConfig.enabled && state.liveConfig.apiKey ? 'Live data feed enabled' : 'Using the simulated feed')
  })
  $('#liveTestBtn').addEventListener('click', async () => {
    const res = $('#liveTestResult')
    res.textContent = 'Testing connection…'
    res.className = 'livedata-result'
    const cfg = {
      provider: $('#liveProvider').value,
      apiKey: $('#liveKey').value.trim(),
      matchId: $('#liveMatch').value.trim(),
      proxy: $('#liveProxy').value.trim()
    }
    if (!cfg.apiKey) { res.textContent = 'Add your API key first.'; res.className = 'livedata-result is-err'; return }
    try {
      const data = await apiRequest(cfg)
      const st = { home: {}, away: {}, minute: 0 }
      mapFeed(st, cfg.provider, data)
      res.textContent = `✓ Connected · ${st.home.name} ${st.home.goals}–${st.away.goals} ${st.away.name} (${st.minute}')`
      res.className = 'livedata-result is-ok'
    } catch (err) {
      res.textContent = `✕ ${err.message} — usually CORS in a browser. Use a proxy, or fetch from the Pear worker.`
      res.className = 'livedata-result is-err'
    }
  })
}

// ==================== Themes (shared avatars, swappable GUI) ====================
const THEMES = [
  { id: 'kawaii', name: 'Kawaii Cup', tag: 'Soft & cute', swatch: ['#ff8fc0', '#6fe0c8', '#ffd76b'] },
  { id: 'shonen', name: 'Shonen Blitz', tag: 'Bold & electric', swatch: ['#ff2e63', '#ffd23f', '#12e6d0'] },
  { id: 'neo', name: 'Neo-Tokyo', tag: 'Dark & neon', swatch: ['#28f0ff', '#ff2fb0', '#b6ff3c'] }
]

function applyTheme (id) {
  document.documentElement.dataset.theme = THEMES.some(t => t.id === id) ? id : 'kawaii'
}

function setTheme (id) {
  state.theme = id
  state.themeChosen = true
  persist()
  applyTheme(id)
  renderThemeSwitcher()
  const t = THEMES.find(x => x.id === id)
  if (t) showToast(`${t.name} theme applied`)
}

function themePreview (t) {
  return `<span class="theme-preview theme-preview-${t.id}">${t.swatch.map(c => `<i style="background:${c}"></i>`).join('')}</span>`
}

function showThemePicker (firstRun) {
  if ($('#themePicker')) return
  const ov = document.createElement('div')
  ov.id = 'themePicker'
  ov.className = 'theme-picker'
  ov.innerHTML = `
    <div class="theme-picker-card">
      ${firstRun === false ? '<button class="theme-close" type="button" aria-label="Close">✕</button>' : ''}
      <p class="eyebrow">${firstRun === false ? 'Appearance' : 'Welcome to PearCup'}</p>
      <h2 class="theme-picker-title">Pick your look</h2>
      <p class="theme-picker-sub">${firstRun === false ? 'Switch your style — everything else stays the same.' : 'Choose a style to start — you can switch it anytime.'}</p>
      <div class="theme-options">
        ${THEMES.map(t => `
          <button class="theme-opt" data-theme-pick="${t.id}" type="button">
            ${themePreview(t)}
            <strong>${t.name}</strong>
            <span class="theme-tag">${t.tag}</span>
          </button>`).join('')}
      </div>
    </div>`
  ov.setAttribute('role', 'dialog')
  ov.setAttribute('aria-modal', 'true')
  ov.setAttribute('aria-label', 'Choose a theme')
  document.body.appendChild(ov)
  setTimeout(() => ov.classList.add('is-open'), 30)
  const close = () => {
    document.removeEventListener('keydown', onKey)
    ov.classList.remove('is-open')
    setTimeout(() => ov.remove(), 300)
  }
  // Escape closes (re-open picker only: first-run must pick a theme to continue)
  const onKey = e => { if (e.key === 'Escape' && firstRun === false) close() }
  document.addEventListener('keydown', onKey)
  ov.addEventListener('click', event => {
    if (event.target.closest('.theme-close') || event.target === ov) { close(); return }
    const btn = event.target.closest('[data-theme-pick]')
    if (!btn) return
    setTheme(btn.dataset.themePick)
    close()
  })
}

function renderThemeSwitcher () {
  const el = $('#themeSwitcher')
  if (!el) return
  el.innerHTML = `
    <div class="wallet-card">
      <p class="eyebrow">Appearance · Theme</p>
      <div class="theme-switch">
        ${THEMES.map(t => `
          <button class="theme-chip ${state.theme === t.id ? 'is-active' : ''}" data-theme-pick="${t.id}" type="button">
            ${themePreview(t)}
            <strong>${t.name}</strong>
            <span class="theme-tag">${t.tag}</span>
          </button>`).join('')}
      </div>
      <p class="wallet-note">Your avatars, wallet, and progress stay the same across every theme.</p>
    </div>`
  $$('#themeSwitcher [data-theme-pick]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themePick)))
}

function renderProfile () {
  const team = teamById(state.team)
  const name = state.username || 'captain'
  renderWalletChip()
  renderWalletManage()
  renderIdentityManage()
  renderLiveDataSettings()
  renderThemeSwitcher()

  $('#profileChip').innerHTML = `
    ${avatarSvg(name, team, true)}
    <div>
      <span class="chip-name">${escapeHtml(name)}</span>
      <span class="chip-team">${team.flag} ${escapeHtml(team.name)}</span>
    </div>
  `

  $('#avatarPreview').innerHTML = avatarSvg(name, team)
  $('#kitCountry').textContent = `${team.flag} ${team.name}`
  $('#kitSubtitle').textContent = `${name}'s jersey is ready`
  $('#primarySwatch').style.background = team.colors[0]
  $('#secondarySwatch').style.background = team.colors[1]
  $('#accentSwatch').style.background = team.colors[2]
}

// The big hero scoreline mirrors whatever the Watch feed is showing (live relay or sim).
function renderHomeHero () {
  const snap = livePanelSnapshot()
  const st = snap.st
  const flag = t => t && t.flag && t.flag !== '⚽'
    ? t.flag
    : (t && t.crest ? `<img class="score-crest" src="${escapeHtml(t.crest)}" alt="" onerror="this.replaceWith(document.createTextNode('⚽'))">` : '⚽')
  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html }
  set('#heroHomeFlag', flag(snap.home)); set('#heroAwayFlag', flag(snap.away))
  set('#heroHomeName', escapeHtml(snap.home.name)); set('#heroAwayName', escapeHtml(snap.away.name))
  set('#heroScore', snap.st && snap.st.hasScore === false ? 'vs' : `${snap.home.goals} - ${snap.away.goals}`)
  const poss = (st && st.possession && st.possession !== 50) ? `${st.possession}% possession` : (snap.live ? 'World Cup' : 'Pre-match room')
  set('#heroHomeSub', escapeHtml(poss))
  set('#heroAwaySub', escapeHtml(st ? stageLabel(st) || 'World Cup' : 'Round of 32'))
  const clockEl = $('#heroClock')
  if (clockEl) clockEl.textContent = st ? (st.matchStatus === 'FINISHED' ? 'FT' : st.minute ? `${st.minute}'` : snap.status) : '15:00 ET'
  const stateEl = $('#heroState')
  if (stateEl) { stateEl.textContent = snap.status; stateEl.className = snap.live && st && /IN_PLAY|LIVE|PAUSED/.test(st.matchStatus) ? 'is-live' : '' }
}

// Polymarket stays behind the same-origin worker relay as match data. The renderer
// never contacts a prediction-market API directly and this card is informational:
// implied probabilities only, with no trade or wallet action attached.
const POLYMARKET_RELAY_FILE = 'polymarket-odds.json'
const POLYMARKET_REGISTRY_SCHEMA = 'pearcup-polymarket-v2'
let polymarketOddsRegistry = null
const polymarketOddsFetchInFlight = new Map()
const polymarketOddsPending = new Set()

function withRelayCacheBust (url) {
  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
}

function polymarketRelayUrl (matchId = '') {
  const base = productionLiveData ? productionLiveData.oddsRelayUrl : POLYMARKET_RELAY_FILE
  if (!matchId) return base
  try {
    const url = new URL(base, window.location.href)
    url.searchParams.set('matchId', String(matchId))
    return url.href
  } catch {
    return base
  }
}

function polymarketOddsAreStale (snapshot) {
  if (!snapshot || snapshot.status !== 'ok' || !snapshot.fetchedAt) return false
  const timestamp = Date.parse(snapshot.fetchedAt)
  return !timestamp || Date.now() - timestamp > 2 * 60 * 1000
}

function polymarketMarketUrl (value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'polymarket.com' ? url.href : ''
  } catch {
    return ''
  }
}

function compactUsdc (value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return ''
  if (number >= 1000000) return `$${(number / 1000000).toFixed(1)}m`
  if (number >= 1000) return `$${Math.round(number / 1000)}k`
  return `$${Math.round(number)}`
}

function polymarketRegistryEntries (registry = polymarketOddsRegistry) {
  if (!registry || typeof registry !== 'object') return {}
  if (registry.schema === POLYMARKET_REGISTRY_SCHEMA && registry.matches && typeof registry.matches === 'object') return registry.matches
  const id = registry.match && registry.match.id
  return id == null ? {} : { [String(id)]: registry }
}

function polymarketRegistryFromPayload (payload) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.schema === POLYMARKET_REGISTRY_SCHEMA && payload.matches && typeof payload.matches === 'object') return payload
  const id = payload.match && payload.match.id
  if (payload.schema !== 'pearcup-polymarket-v1' || id == null) return null
  return {
    schema: POLYMARKET_REGISTRY_SCHEMA,
    provider: payload.provider || 'Polymarket',
    status: payload.status || 'unavailable',
    generatedAt: payload.fetchedAt || new Date().toISOString(),
    matches: { [String(id)]: payload }
  }
}

function mergePolymarketRegistry (current, incoming) {
  const matches = { ...polymarketRegistryEntries(current), ...polymarketRegistryEntries(incoming) }
  return {
    ...(incoming || {}),
    schema: POLYMARKET_REGISTRY_SCHEMA,
    provider: incoming && incoming.provider || current && current.provider || 'Polymarket',
    status: Object.values(matches).some(snapshot => snapshot && snapshot.status === 'ok') ? 'ok' : 'unavailable',
    generatedAt: incoming && (incoming.generatedAt || incoming.fetchedAt) || current && current.generatedAt || new Date().toISOString(),
    matches
  }
}

function polymarketFixtureFromMatch (match) {
  if (!match || match.id == null) return null
  const home = match.homeTeam || match.home || {}
  const away = match.awayTeam || match.away || {}
  const homeName = home.shortName || home.name || ''
  const awayName = away.shortName || away.name || ''
  if (!homeName || !awayName) return null
  return { id: String(match.id), label: `${homeName} vs ${awayName}`, status: match.status || '', utcDate: match.utcDate || '' }
}

function polymarketFixtures () {
  const fixtures = new Map()
  const add = fixture => { if (fixture && !fixtures.has(fixture.id)) fixtures.set(fixture.id, fixture) }
  let activeId = ''
  let activeKickoff = 0
  const indexedFixtureIds = new Set(Object.keys(polymarketRegistryEntries()))
  try {
    const st = feedState()
    if (st && st.matchId && st.home && st.away) {
      activeId = String(st.matchId)
      activeKickoff = Date.parse(st.utcDate || '') || 0
      add({ id: activeId, label: `${st.home.name} vs ${st.away.name}`, status: st.matchStatus || '', utcDate: st.utcDate || '' })
    }
    ;(Array.isArray(st && st.fixtures) ? st.fixtures : []).forEach(match => {
      const fixture = polymarketFixtureFromMatch(match)
      if (!fixture) return
      const kickoff = Date.parse(fixture.utcDate || '') || 0
      const isUpcoming = !activeKickoff || !kickoff || kickoff >= activeKickoff || /IN_PLAY|LIVE|PAUSED/.test(String(fixture.status || ''))
      const shouldInclude = fixture.id === activeId || (indexedFixtureIds.size === 0 ? isUpcoming : indexedFixtureIds.has(fixture.id))
      if (shouldInclude) add(fixture)
    })
  } catch {}
  Object.entries(polymarketRegistryEntries()).forEach(([id, snapshot]) => {
    const match = snapshot && snapshot.match || {}
    if (match.home && match.away) add({ id: String(id), label: `${match.home} vs ${match.away}`, status: '', utcDate: match.utcDate || '' })
  })
  const ranked = [...fixtures.values()].sort((left, right) => {
    const active = value => value.id === activeId ? 0 : 1
    const live = value => /IN_PLAY|LIVE|PAUSED/.test(String(value.status || '')) ? 0 : 1
    return active(left) - active(right) || live(left) - live(right) || Date.parse(left.utcDate || '') - Date.parse(right.utcDate || '')
  })
  const selected = String(state.selectedOddsMatchId || '')
  const current = ranked.find(fixture => fixture.id === selected)
  const bounded = ranked.slice(0, 6)
  if (current && !bounded.some(fixture => fixture.id === current.id)) bounded.push(current)
  return bounded
}

function selectedPolymarketMatchId () {
  const fixtures = polymarketFixtures()
  const configured = String(state.selectedOddsMatchId || '')
  if (configured && fixtures.some(fixture => fixture.id === configured)) return configured
  try {
    const active = feedState()
    if (active && active.matchId != null && fixtures.some(fixture => fixture.id === String(active.matchId))) return String(active.matchId)
  } catch {}
  return fixtures[0] && fixtures[0].id || ''
}

function selectPolymarketMatch (matchId, { refresh = true } = {}) {
  const id = String(matchId || '')
  if (!id) return
  if (state.selectedOddsMatchId !== id) {
    state.selectedOddsMatchId = id
    persist()
  }
  renderPolymarketOdds()
  if (refresh) void detectPolymarketOdds(id)
}

function polymarketOddsPanels () {
  return [$('#polymarketOddsPanel'), $('#watchPolymarketOddsPanel'), $('#gamesPolymarketOddsPanel')].filter(Boolean)
}

function polymarketFixturePicker (selectedId) {
  const fixtures = polymarketFixtures()
  if (!fixtures.length) return ''
  return `<label class="polymarket-picker"><span>Fixture</span><select data-polymarket-match aria-label="Choose fixture odds">
    ${fixtures.map(fixture => `<option value="${escapeHtml(fixture.id)}"${fixture.id === selectedId ? ' selected' : ''}>${escapeHtml(fixture.label)}</option>`).join('')}
  </select></label>`
}

function unavailablePolymarketFixture (matchId) {
  const fixture = polymarketFixtures().find(item => item.id === String(matchId))
  const [home = 'Home', away = 'Away'] = String(fixture && fixture.label || '').split(' vs ')
  return {
    schema: 'pearcup-polymarket-v1',
    provider: 'Polymarket',
    status: 'unavailable',
    fetchedAt: new Date().toISOString(),
    match: { id: String(matchId), home, away, utcDate: fixture && fixture.utcDate || null },
    reason: 'No public Polymarket market is available for this fixture yet.'
  }
}

function renderPolymarketOdds () {
  const panels = polymarketOddsPanels()
  if (!panels.length) return
  const render = markup => panels.forEach(panel => { panel.innerHTML = markup })
  const selectedId = selectedPolymarketMatchId()
  const snapshot = polymarketRegistryEntries()[selectedId] || null
  const picker = polymarketFixturePicker(selectedId)
  const bindPicker = () => panels.forEach(panel => {
    const pickerEl = $('[data-polymarket-match]', panel)
    if (pickerEl) pickerEl.addEventListener('change', () => selectPolymarketMatch(pickerEl.value))
  })
  if (!snapshot) {
    render(`
      <div class="rail-header"><p class="eyebrow">Polymarket</p><strong>Implied odds</strong></div>
      ${picker}
      <p class="polymarket-note">Connecting to the public odds relay…</p>`)
    bindPicker()
    return
  }
  if (snapshot.status !== 'ok' || !Array.isArray(snapshot.odds) || snapshot.odds.length < 2) {
    render(`
      <div class="rail-header"><p class="eyebrow">Polymarket</p><strong>Implied odds</strong></div>
      ${picker}
      <p class="polymarket-note">${escapeHtml(snapshot.reason || 'No active public market is available for this fixture yet.')}</p>
      <small class="polymarket-disclaimer">Informational only · no wallet or trading connection</small>`)
    bindPicker()
    return
  }
  const stale = polymarketOddsAreStale(snapshot)
  const pending = polymarketOddsPending.has(selectedId)
  const freshness = pending ? 'Updating' : stale ? 'Stale' : 'Live'
  const updated = snapshot.fetchedAt ? fmtTime(snapshot.fetchedAt) : ''
  const odds = snapshot.odds.slice(0, 3).map(odd => ({
    label: String(odd.outcome || 'Outcome'),
    probability: Math.max(0, Math.min(1, Number(odd.probability) || 0))
  }))
  const destination = polymarketMarketUrl(snapshot.market && snapshot.market.url)
  const marketMeta = compactUsdc(snapshot.market && snapshot.market.volume)
  render(`
    <div class="rail-header">
      <p class="eyebrow">Polymarket</p>
      <strong>Implied odds <span class="polymarket-live ${stale || pending ? 'is-stale' : ''}"><i></i>${freshness}</span></strong>
    </div>
    ${picker}
    <p class="polymarket-question">${escapeHtml(snapshot.market && snapshot.market.question || 'Match winner')}</p>
    <div class="polymarket-rows">
      ${odds.map((odd, index) => `
        <div class="polymarket-row ${index === 0 ? 'is-leading' : ''}">
          <div><span>${escapeHtml(odd.label)}</span><strong>${Math.round(odd.probability * 100)}%</strong></div>
          <i><b style="width:${Math.round(odd.probability * 100)}%"></b></i>
        </div>`).join('')}
    </div>
    <div class="polymarket-foot">
      <span>${updated ? `Updated ${escapeHtml(updated)}` : 'Public market data'}${marketMeta ? ` · ${marketMeta} volume` : ''}</span>
      ${destination ? `<a href="${escapeHtml(destination)}" target="_blank" rel="noreferrer">Market ↗</a>` : ''}
    </div>
    <small class="polymarket-disclaimer">Prices are market-implied probabilities, not advice.</small>`)
  bindPicker()
}

async function detectPolymarketOdds (matchId = selectedPolymarketMatchId()) {
  const id = String(matchId || '')
  const key = id || '__registry__'
  if (polymarketOddsFetchInFlight.has(key)) return polymarketOddsFetchInFlight.get(key)
  polymarketOddsPending.add(id)
  renderPolymarketOdds()
  const request = fetch(withRelayCacheBust(polymarketRelayUrl(id)), { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    })
    .then(payload => {
      const incoming = polymarketRegistryFromPayload(payload)
      if (!incoming) throw new Error('Unsupported Polymarket odds snapshot')
      polymarketOddsRegistry = mergePolymarketRegistry(polymarketOddsRegistry, incoming)
      renderPolymarketOdds()
      return incoming
    })
    .catch(() => {
      // Leave the prior snapshot on screen; it will be clearly labelled stale.
      // A fixture outside the relay's bounded registry is an honest unavailable
      // state, not an endless “connecting” spinner.
      if (id && !polymarketRegistryEntries()[id]) {
        polymarketOddsRegistry = mergePolymarketRegistry(polymarketOddsRegistry, polymarketRegistryFromPayload(unavailablePolymarketFixture(id)))
      }
      renderPolymarketOdds()
      return null
    })
    .finally(() => {
      polymarketOddsFetchInFlight.delete(key)
      polymarketOddsPending.delete(id)
      renderPolymarketOdds()
    })
  polymarketOddsFetchInFlight.set(key, request)
  return request
}

function renderHomeDashboard () {
  const activeTab = liveTabs.some(tab => tab.id === state.liveTab) ? state.liveTab : 'overview'
  state.liveTab = activeTab
  renderHomeHero()
  renderPolymarketOdds()

  $('#liveMenu').innerHTML = liveTabs.map(tab => `
    <button type="button" class="${tab.id === activeTab ? 'is-active' : ''}" data-live-tab="${tab.id}">
      ${tab.label}
    </button>
  `).join('')

  $('#liveDetail').innerHTML = renderLivePanel(activeTab)

  // First fixture card mirrors the live feed; the rest are the upcoming schedule.
  const snap = livePanelSnapshot()
  const liveFixture = {
    oddsMatchId: snap.st && snap.st.matchId != null ? String(snap.st.matchId) : '',
    status: snap.status,
    title: snap.st && snap.st.hasScore === false
      ? `${snap.home.name} vs ${snap.away.name}`
      : `${snap.home.name} ${snap.home.goals} - ${snap.away.goals} ${snap.away.name}`,
    detail: `${Math.max(1, Number(state.spectators || 1))} peer${Number(state.spectators || 1) === 1 ? '' : 's'} in room`,
    live: true
  }
  // A v2 worker relay includes the surrounding schedule, so the home rail is live
  // beyond the one match currently open in the watch room. Keep the curated fixtures
  // only as an offline fallback.
  const relayedFixtures = Array.isArray(snap.st && snap.st.fixtures)
    ? snap.st.fixtures
      .filter(match => String(match.id || '') !== String(snap.st && snap.st.matchId || ''))
      .slice(0, 3)
      .map(match => {
        const home = match.homeTeam || match.home || {}
        const away = match.awayTeam || match.away || {}
        const score = match.score && (match.score.fullTime || match.score.regularTime) || {}
        const hasScore = score.home != null || score.away != null
        const status = match.status === 'IN_PLAY' || match.status === 'LIVE'
          ? 'LIVE'
          : match.status === 'FINISHED'
            ? 'FT'
            : fmtTime(match.utcDate) || 'Upcoming'
        return {
          oddsMatchId: match.id != null ? String(match.id) : '',
          status,
          title: hasScore
            ? `${home.shortName || home.name || 'Home'} ${score.home ?? 0} - ${score.away ?? 0} ${away.shortName || away.name || 'Away'}`
            : `${home.shortName || home.name || 'Home'} vs ${away.shortName || away.name || 'Away'}`,
          detail: stageLabel(match) || 'World Cup fixture',
          live: status === 'LIVE'
        }
      })
      .filter(fixture => !/^Home vs Away$/.test(fixture.title))
    : []
  const fixtureList = [liveFixture, ...(relayedFixtures.length ? relayedFixtures : homeFixtures.filter(f => !f.live))]
  $('#homeFixtures').innerHTML = fixtureList.map(fixture => `
    <div class="mini-fixture ${fixture.live ? 'is-current' : ''}">
      <div>
        <span class="fixture-time">${fixture.status}</span>
        <strong>${fixture.title}</strong>
        <small>${fixture.detail}</small>
      </div>
      <button class="icon-button ${fixture.live ? 'is-live' : ''}" type="button" data-view="watch"${fixture.oddsMatchId ? ` data-polymarket-fixture="${escapeHtml(fixture.oddsMatchId)}"` : ''} aria-label="Open watch room">
        <svg viewBox="0 0 24 24"><path d="${fixture.live ? 'M8 5v14l11-7Z' : 'M4 12h16M12 4v16'}"/></svg>
      </button>
    </div>
  `).join('')

  $$('#homeFixtures [data-polymarket-fixture]').forEach(button => {
    button.addEventListener('click', () => selectPolymarketMatch(button.dataset.polymarketFixture))
  })

  const activePlayers = poolLedgerEntries().filter(entry => entry.kind === 'bracket').slice(0, 6)
  $('#leaderPanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Bracket</p>
      <strong>Real entries</strong>
    </div>
    <div class="leader-list">
      ${activePlayers.length ? activePlayers.map((entry, index) => `
        <div class="leader-row">
          <span class="leader-rank">${index + 1}</span>
          ${avatarSvg(entry.username, teamById(entry.teamId), true)}
          <div>
            <strong>${escapeHtml(entry.playerId === state.playerId ? 'You' : entry.username)}</strong>
            <span>${escapeHtml(teamById(entry.teamId).name)} · $${entry.tier} demo entry</span>
          </div>
          <em>synced</em>
        </div>
      `).join('') : '<p class="live-copy">No bracket entries yet. The first player who enters appears here.</p>'}
    </div>
  `
  $('#signalPanel').innerHTML = renderSignalPanel()

  $$('#liveMenu [data-live-tab]').forEach(button => {
    button.addEventListener('click', () => {
      state.liveTab = button.dataset.liveTab
      persist()
      renderHomeDashboard()
    })
  })
  bindViewButtons($('#home'))
}

// Snapshot of whatever the live/sim feed currently holds, for the Home dashboard.
function livePanelSnapshot () {
  let st = null
  try { st = feedState() } catch { st = null }
  const live = isLiveApi()
  const home = st ? st.home : { name: 'Spain', flag: '🇪🇸', goals: 0, teamId: 'es' }
  const away = st ? st.away : { name: 'Belgium', flag: '🇧🇪', goals: 0, teamId: 'be' }
  const status = st ? matchStateLabel(st).txt : 'Kicks off 15:00 ET'
  const events = (state.feedEvents || [])
  return { st, live, home, away, status, events }
}

function renderMomentumChart (snap) {
  const events = snap.events
    .filter(event => event && event.team && !['preview', 'tick'].includes(event.type))
    .slice(0, 12)
    .reverse()
  if (!events.length) {
    return `<div class="momentum-empty"><span>◌</span><strong>No invented pressure curve</strong><p>This chart will build from verified goals, shots, saves, chances, and corners after kickoff.</p></div>`
  }
  const clamp = value => Math.max(8, Math.min(92, value))
  const weights = { goal: 16, shot: 9, chance: 7, corner: 5, save: 4, poss: 2 }
  let pressure = 50
  const values = [pressure]
  for (const event of events) {
    const direction = String(event.team).toLowerCase() === String(snap.home.name).toLowerCase() ? 1 : -1
    pressure = clamp(pressure + direction * (weights[event.type] || 3))
    values.push(pressure)
  }
  const width = 360
  const top = 22
  const bottom = 126
  const chartHeight = bottom - top
  const left = 18
  const step = (width - left * 2) / Math.max(1, values.length - 1)
  const points = values.map((value, index) => {
    const x = left + step * index
    const y = bottom - (value / 100) * chartHeight
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) }
  })
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const area = `${line} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`
  const grid = [25, 50, 75].map(tick => {
    const y = Number((bottom - (tick / 100) * chartHeight).toFixed(1))
    return `<line x1="${left}" y1="${y}" x2="${width - left}" y2="${y}"></line>`
  }).join('')
  const bars = points.map((point, index) => index > 0
    ? `<rect class="momentum-band" x="${Number((point.x - 4).toFixed(1))}" y="${point.y}" width="8" height="${Number((bottom - point.y).toFixed(1))}" rx="4"></rect>`
    : '').join('')
  const finalPressure = values[values.length - 1]
  const pressureTeam = finalPressure >= 50 ? snap.home : snap.away
  const aria = `Event pressure from ${events.length} verified match events currently favours ${pressureTeam.name}`

  return `
    <div class="momentum-chart" role="img" aria-label="${escapeHtml(aria)}">
      <svg viewBox="0 0 ${width} 150" aria-hidden="true" focusable="false">
        <g class="momentum-grid">${grid}</g>
        <path class="momentum-area" d="${area}"></path>
        <g>${bars}</g>
        <path class="momentum-line" d="${line}"></path>
        <g class="momentum-points">
          ${points.filter((_, index) => index % 3 === 1 || index === points.length - 1).map(point => `<circle cx="${point.x}" cy="${point.y}" r="4"></circle>`).join('')}
        </g>
        <text class="momentum-axis" x="${left}" y="16">Pressure</text>
        <text class="momentum-axis is-right" x="${width - left}" y="16">Verified events</text>
      </svg>
    </div>
    <div class="momentum-meta">
      <span>${escapeHtml(snap.home.name)}</span>
      <strong>${events.length} event${events.length === 1 ? '' : 's'}</strong>
      <span>${escapeHtml(snap.away.name)}</span>
    </div>
  `
}

function renderLivePanel (tab) {
  const snap = livePanelSnapshot()

  if (tab === 'stats') {
    const st = snap.st
    const score = st && st.hasScore ? `${snap.home.goals}–${snap.away.goals}` : 'Not started'
    const kickoff = st && st.utcDate ? `${new Date(st.utcDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${fmtTime(st.utcDate)}` : 'To be confirmed'
    const source = snap.live ? (st && st.dataFresh === false ? 'Saved provider snapshot' : 'Football-Data.org') : 'Preview only'
    const rows = [
      ['Score', score],
      ['Kickoff', kickoff],
      ['Round', stageLabel(st || {}) || 'World Cup'],
      ['Source', source]
    ]
    return `
      <div class="live-stat-head">
        <strong>${escapeHtml(snap.home.name)} vs ${escapeHtml(snap.away.name)}</strong>
        <span class="live-pill ${snap.live ? 'is-live' : ''}">${snap.live ? '<i></i>' : ''}${escapeHtml(snap.status)}</span>
      </div>
      <div class="live-stat-grid">
        ${rows.map(([label, value]) => `
          <article class="live-stat-card is-metadata">
            <span>${label}</span>
            <strong>${escapeHtml(value)}</strong>
          </article>
        `).join('')}
      </div>
      ${st && !st.statsAvailable ? '<p class="data-availability-note">Possession, shots, and pressure appear only when the provider supplies them. PearCup does not fabricate missing match statistics.</p>' : ''}
    `
  }

  if (tab === 'rooms') {
    const room = watchParticipants()
    const peers = room.length
    return `
      <div class="room-dashboard">
        <article class="live-card room-card">
          <div class="rail-header">
            <p class="eyebrow">Watch room</p>
            <strong>${peers} peers</strong>
          </div>
          <p class="live-copy">${escapeHtml(snap.home.name)} vs ${escapeHtml(snap.away.name)} · ${escapeHtml(snap.status)}</p>
          <div class="room-preview-avatars">
            ${room.map(person => avatarSvg(person.name, teamById(person.team), true)).join('')}
          </div>
          <button class="primary-button" type="button" data-view="watch">
            <span class="button-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7Z"/></svg>
            </span>
            Join the couch
          </button>
        </article>
        <article class="live-card">
          <div class="metric-list">
            <div><span>On the couch</span><strong>${peers} real watcher${peers === 1 ? '' : 's'}</strong></div>
            <div><span>Peers watching</span><strong>${peers}</strong></div>
            <div><span>Chat lines</span><strong>${(state.chat || []).length}</strong></div>
          </div>
        </article>
      </div>
    `
  }

  if (tab === 'qvac') {
    const parsed = snap.events.length
    return `
      <div class="qvac-dashboard">
        <article class="live-card">
          <div class="rail-header">
            <p class="eyebrow">QVAC</p>
            <strong>Multilingual</strong>
          </div>
          <div class="language-pills">
            <span>EN</span><span>PT</span><span>ES</span><span>FR</span><span>AR</span><span>JA</span>
          </div>
          <p class="live-copy">Following ${escapeHtml(snap.home.name)} vs ${escapeHtml(snap.away.name)} — the ${snap.live ? 'live' : 'match'} event stream is summarized into commentary and pool impact on device.</p>
        </article>
        <article class="live-card">
          <div class="metric-list">
            <div><span>Feed</span><strong>${snap.live ? 'Live data' : 'Simulated'}</strong></div>
            <div><span>Events parsed</span><strong>${parsed}</strong></div>
            <div><span>Languages</span><strong>6</strong></div>
          </div>
        </article>
      </div>
    `
  }

  if (tab === 'games') {
    const round = currentGameRound()
    const previewHash = PearCupCore.deterministicHash({ preview: 'PenaltyClash', roundIndex: state.gameRound, round })
    const settlement = integrationRuntime.readiness.settlement
    return `
      <div class="game-live-preview">
        <article class="live-card">
          <div class="rail-header">
            <p class="eyebrow">Penalty Clash</p>
            <strong>${round.aim === round.dive ? 'Save' : 'Goal'}</strong>
          </div>
          <p class="live-copy">QVAC referee verified both reveals and matched the deterministic state hash for round ${state.gameRound + 1}.</p>
          <button class="primary-button inline-action" type="button" data-view="games">
            <span class="button-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
            Open games
          </button>
        </article>
        <article class="live-card">
          <div class="metric-list">
            <div><span>Sync</span><strong>${previewHash.slice(0, 12)}</strong></div>
            <div><span>Escrow</span><strong>${serviceModeLabel(integrationRuntime.readiness.tetherWdk)} WDK</strong></div>
            <div><span>Prize gate</span><strong>${settlement.realMoneyEnabled ? 'Live' : 'Locked'}</strong></div>
          </div>
        </article>
      </div>
    `
  }

  // Overview
  const lead = snap.home.goals >= snap.away.goals ? snap.home : snap.away
  const verifiedEvents = snap.events.filter(event => event && event.team && !['preview', 'tick'].includes(event.type))
  const evText = ev => {
    const t = ev.type
    const verb = t === 'goal' ? 'find the net' : t === 'save' ? 'are denied by a save' : t === 'shot' ? 'threaten with a shot' : t === 'corner' ? 'win a corner' : `see a ${t}`
    return `${ev.team} ${verb}.`
  }
  const timeline = snap.events.length
    ? snap.events.slice(0, 4).map(ev => `<div><time>${escapeHtml(ev.clock || '·')}</time><span>${escapeHtml(evText(ev))}</span></div>`).join('')
    : `<div><time>—</time><span>Waiting for the next event…</span></div>`
  const pools = Object.keys(state.enteredPools || {}).length
  return `
    <div class="overview-dashboard">
      <article class="live-card momentum-card">
        <div class="rail-header">
          <p class="eyebrow">Momentum</p>
          <strong>${verifiedEvents.length ? `${verifiedEvents.length} verified event${verifiedEvents.length === 1 ? '' : 's'}` : 'Awaiting kickoff'}</strong>
        </div>
        ${renderMomentumChart(snap)}
      </article>
      <article class="live-card timeline-card">
        <div class="rail-header">
          <p class="eyebrow">Timeline</p>
          <strong>${snap.live ? 'Live' : 'Latest'}</strong>
        </div>
        <div class="timeline-list">${timeline}</div>
      </article>
      <article class="live-card impact-card">
        <div class="rail-header">
          <p class="eyebrow">Pool impact</p>
          <strong>${pools ? `${pools} entered` : `${snap.home.goals}–${snap.away.goals}`}</strong>
        </div>
        <p class="live-copy">${pools
          ? `Your bracket outcome swings on ${escapeHtml(lead.name)} holding ${escapeHtml(snap.home.name)} ${snap.home.goals}–${snap.away.goals} ${escapeHtml(snap.away.name)}.`
          : `Enter a bracket pool to track how ${escapeHtml(snap.home.name)} vs ${escapeHtml(snap.away.name)} moves your payout.`}</p>
      </article>
    </div>
  `
}

function renderTeams () {
  $('#usernameInput').value = state.username
  $('#teamGrid').innerHTML = teams.map(team => `
    <button class="team-card ${team.id === state.team ? 'is-selected' : ''}" type="button" data-team="${team.id}" aria-pressed="${team.id === state.team}">
      <span class="flag-tile">${team.flag}</span>
      <span>
        <span class="team-name">${escapeHtml(team.name)}</span>
        <span class="team-colors" aria-hidden="true">
          <i style="background:${team.colors[0]}"></i>
          <i style="background:${team.colors[1]}"></i>
          <i style="background:${team.colors[2]}"></i>
        </span>
      </span>
      <span class="check-dot" aria-hidden="true"></span>
    </button>
  `).join('')

  $$('#teamGrid .team-card').forEach(button => {
    button.addEventListener('click', () => {
      state.team = button.dataset.team
      persist()
      renderTeams()
      renderProfile()
    })
  })
}

function bracketPoolKey (tier) {
  return `bracket:$${Number(tier)}`
}

function matchPoolKey (fixtureId, tier) {
  return `match:${String(fixtureId)}:$${Number(tier)}`
}

function poolLedgerEntries () {
  const sync = window.PearCupPoolSync
  if (sync && typeof sync.entries === 'function') return sync.entries()
  return Array.isArray(state.poolLedger) ? state.poolLedger : []
}

function entriesForPool (poolKey) {
  return poolLedgerEntries().filter(entry => entry && entry.poolKey === poolKey)
}

function ownPoolEntry (poolKey) {
  return entriesForPool(poolKey).find(entry => entry.playerId === state.playerId) || null
}

function bracketPoolMetrics (tier) {
  const entries = entriesForPool(bracketPoolKey(tier))
  return { entries, entrants: entries.length, prize: entries.length * Number(tier) }
}

function matchPoolMetrics (fixtureId, tier) {
  const entries = entriesForPool(matchPoolKey(fixtureId, tier))
  return { entries, entrants: entries.length, prize: entries.length * Number(tier) }
}

function restoreLegacyPoolEntries () {
  const legacy = []
  const existing = Array.isArray(state.poolLedger) ? state.poolLedger : []
  const already = new Set(existing.map(entry => entry && entry.poolKey).filter(Boolean))
  for (const tier of [10, 25, 50, 100]) {
    if (!state.enteredPools || !state.enteredPools[tier]) continue
    const poolKey = bracketPoolKey(tier)
    if (already.has(poolKey)) continue
    legacy.push({
      v: 1,
      entryId: newPersistentPlayerId(),
      playerId: state.playerId,
      username: state.username || 'captain',
      teamId: state.team,
      poolKey,
      kind: 'bracket',
      tier,
      pick: '',
      pickName: '',
      currency: 'DEMO_USDT',
      createdAt: Date.now()
    })
  }
  for (const value of Object.values(state.enteredGamePools || {})) {
    if (!value || !value.fixtureId || !value.tier || !value.pick || !value.pickName) continue
    const poolKey = matchPoolKey(value.fixtureId, value.tier)
    if (already.has(poolKey)) continue
    legacy.push({
      v: 1,
      entryId: newPersistentPlayerId(),
      playerId: state.playerId,
      username: state.username || 'captain',
      teamId: state.team,
      poolKey,
      kind: 'match',
      tier: Number(value.tier),
      pick: value.pick,
      pickName: value.pickName,
      currency: 'DEMO_USDT',
      createdAt: Number(value.enteredAt) || Date.now()
    })
  }
  if (legacy.length) {
    state.poolLedger = [...existing, ...legacy]
    persist()
  }
}

let poolSyncRenderTimer = null
function schedulePoolSyncRender () {
  if (poolSyncRenderTimer) return
  poolSyncRenderTimer = setTimeout(() => {
    poolSyncRenderTimer = null
    if (!document.documentElement.dataset.pearcupUiHydrated) return
    if ($('#poolGrid')) renderPools()
    if ($('#gamePoolGrid')) renderGamePools()
    if (state.view === 'bracket') renderBracket()
    if (state.view === 'home') renderHomeDashboard()
  }, 60)
}

function startPoolSync () {
  const sync = window.PearCupPoolSync
  if (!sync || typeof sync.start !== 'function') return false
  restoreLegacyPoolEntries()
  sync.start({
    playerId: state.playerId,
    entries: state.poolLedger,
    onChange: entries => {
      state.poolLedger = entries
      persist()
      schedulePoolSyncRender()
    }
  })
  return true
}

function renderPools () {
  $('#poolGrid').innerHTML = pools.map(pool => `
    <article class="pool-card">
      <div class="pool-top">
        <div>
          <p class="stake">$${pool.tier} <span>entry</span></p>
          <span class="rail-chip is-locked">Demo USDT · no cash payout</span>
        </div>
        <span class="pool-badge">${pool.heat}</span>
      </div>
      <div class="pool-meta">
        <div><span>Demo pool</span><strong>${fmtMoney(bracketPoolMetrics(pool.tier).prize)}</strong></div>
        <div><span>Real entries</span><strong>${bracketPoolMetrics(pool.tier).entrants}/${pool.max}</strong></div>
        <div><span>Locks</span><strong>At kickoff</strong></div>
      </div>
      <div class="pool-footer">
        <span class="live-copy">${bracketPoolMetrics(pool.tier).entrants ? 'Peer ledger synced' : 'No entries yet'}</span>
        <button class="primary-button" type="button" data-pool="${pool.tier}">
          <span class="button-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
          Enter
        </button>
      </div>
    </article>
  `).join('')

  $$('#poolGrid [data-pool]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedTier = Number(button.dataset.pool)
      persist()
      renderBracket()
      setView('bracket')
    })
  })
}

// A bracket entry follows the whole tournament. A match pool is intentionally much
// smaller: choose one side of one fixture, lock at kickoff, and let the official live
// result settle that one pick. Keeping these entries in a separate namespace avoids
// accidentally treating a single-game selection as a full-bracket entry.
const GAME_POOL_TIERS = [5, 10, 25]

function liveTeamForPool (side, fallbackId) {
  const name = String(side && side.name || '')
  const known = teams.find(team => team.name.toLowerCase() === name.toLowerCase())
  if (known) return known
  return {
    id: fallbackId || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team',
    name: name || 'TBD',
    flag: side && side.flag || '⚽',
    colors: ['#3fc4a8', '#ffffff', '#3564ba']
  }
}

function matchPoolFixtureId (home, away, hint) {
  if (hint != null && String(hint)) return `match-${String(hint)}`
  return `match-${String(home && home.name || 'home').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(away && away.name || 'away').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function gamePoolFixtures () {
  let st = null
  try { st = feedState() } catch (e) {}
  const primary = st && st.home && st.away
    ? [{
        id: matchPoolFixtureId(st.home, st.away, st.matchId || st.id),
        oddsMatchId: st.matchId == null ? '' : String(st.matchId),
        home: liveTeamForPool(st.home, 'home'),
        away: liveTeamForPool(st.away, 'away'),
        status: matchStateLabel(st).txt,
        live: Boolean(st.matchStatus && /IN_PLAY|LIVE|PAUSED/.test(st.matchStatus)),
        locked: st.matchStatus === 'FINISHED',
        stage: stageLabel(st) || 'World Cup'
      }]
    : []
  const relayed = Array.isArray(st && st.fixtures) ? st.fixtures : []
  const fromRelay = relayed.map(match => {
    const home = liveTeamForPool(match.homeTeam || match.home || {}, 'home')
    const away = liveTeamForPool(match.awayTeam || match.away || {}, 'away')
    const status = match.status || 'Scheduled'
    return {
      id: matchPoolFixtureId(home, away, match.id),
      oddsMatchId: match.id == null ? '' : String(match.id),
      home,
      away,
      status: status === 'IN_PLAY' || status === 'LIVE' ? 'LIVE' : status === 'TIMED' ? 'Upcoming' : status,
      live: /IN_PLAY|LIVE|PAUSED/.test(status),
      locked: status === 'FINISHED',
      stage: stageLabel(match) || 'World Cup'
    }
  })
  const fallback = [
    { id: 'match-fr-ma', oddsMatchId: '', home: teamById('fr'), away: teamById('ma'), status: 'Upcoming', live: false, locked: false, stage: 'Quarter-final' },
    { id: 'match-no-eng', oddsMatchId: '', home: teamById('no'), away: teamById('eng'), status: 'Upcoming', live: false, locked: false, stage: 'Quarter-final' }
  ]
  const seen = new Set()
  return [...primary, ...fromRelay, ...fallback].filter(fixture => {
    if (!fixture.home || !fixture.away || seen.has(fixture.id)) return false
    seen.add(fixture.id)
    return true
  }).slice(0, 3)
}

function gamePoolEntryKey (fixtureId, tier) {
  return `${fixtureId}:$${tier}`
}

function gamePoolPrize (fixture, tier) {
  const metrics = matchPoolMetrics(fixture.id, tier)
  return { entrants: metrics.entrants, prize: fmtMoney(metrics.prize) }
}

function renderGamePools () {
  const el = $('#gamePoolGrid')
  if (!el) return
  const fixtures = gamePoolFixtures()
  if (!fixtures.some(fixture => fixture.id === state.selectedGamePool)) state.selectedGamePool = fixtures[0] && fixtures[0].id || ''
  const selected = state.selectedGamePool
  const liveLabel = $('#gamePoolLiveLabel')
  if (liveLabel) liveLabel.textContent = fixtures.some(fixture => fixture.live) ? '● Live data' : 'Official fixture feed'
  el.innerHTML = fixtures.map(fixture => {
    const isSelected = fixture.id === selected
    const draft = state.gamePoolDraft || {}
    const pick = draft.matchId === fixture.id ? draft.pick : fixture.home.id
    const tier = draft.matchId === fixture.id && GAME_POOL_TIERS.includes(Number(draft.tier)) ? Number(draft.tier) : GAME_POOL_TIERS[1]
    const pool = gamePoolPrize(fixture, tier)
    const entry = ownPoolEntry(matchPoolKey(fixture.id, tier))
    return `
      <article class="game-pool-card${isSelected ? ' is-selected' : ''}${fixture.live ? ' is-live' : ''}">
        <div class="game-pool-card-head">
          <span class="game-pool-state${fixture.live ? ' is-live' : ''}">${fixture.live ? '<i></i>LIVE' : escapeHtml(fixture.status)}</span>
          <span>${escapeHtml(fixture.stage)}</span>
        </div>
        <div class="game-pool-teams">
          <strong>${fixture.home.flag} ${escapeHtml(fixture.home.name)}</strong><span>vs</span><strong>${fixture.away.flag} ${escapeHtml(fixture.away.name)}</strong>
        </div>
        <div class="game-pool-meta"><span>${pool.entrants} player${pool.entrants === 1 ? '' : 's'}</span><strong>${pool.prize} pool</strong></div>
        <button class="secondary-button compact-action game-pool-open" type="button" data-game-pool-open="${escapeHtml(fixture.id)}">${isSelected ? 'Pool options' : 'Open pool'}</button>
        ${isSelected ? `
          <div class="game-pool-expander">
            <p>Pick a winner, then choose your stake.</p>
            <div class="game-pool-picks" role="group" aria-label="Pick winner">
              <button class="game-pool-team${pick === fixture.home.id ? ' is-picked' : ''}" type="button" data-game-pool-team="${escapeHtml(fixture.home.id)}" data-game-pool-match="${escapeHtml(fixture.id)}">${fixture.home.flag} ${escapeHtml(fixture.home.name)}</button>
              <button class="game-pool-team${pick === fixture.away.id ? ' is-picked' : ''}" type="button" data-game-pool-team="${escapeHtml(fixture.away.id)}" data-game-pool-match="${escapeHtml(fixture.id)}">${fixture.away.flag} ${escapeHtml(fixture.away.name)}</button>
            </div>
            <div class="game-pool-stakes" role="group" aria-label="Choose stake">
              ${GAME_POOL_TIERS.map(value => `<button class="game-pool-stake${tier === value ? ' is-picked' : ''}" type="button" data-game-pool-tier="${value}" data-game-pool-match="${escapeHtml(fixture.id)}">$${value}</button>`).join('')}
            </div>
            <div class="game-pool-actions">
              <button class="primary-button compact-action" type="button" data-enter-game-pool="${escapeHtml(fixture.id)}"${fixture.locked || entry ? ' disabled' : ''}>${entry ? `✓ Picked ${escapeHtml(entry.pickName)}` : fixture.locked ? 'Final score locked' : `Enter $${tier} pool`}</button>
              <button class="secondary-button compact-action" type="button" data-watch-game-pool="${escapeHtml(fixture.id)}">Watch + trivia</button>
            </div>
            <small>Your demo-USDT entry is shared with connected peers. It never creates a cash payout or sends wallet data over P2P.</small>
          </div>` : ''}
      </article>`
  }).join('')

  $$('#gamePoolGrid [data-game-pool-open]').forEach(button => button.addEventListener('click', () => {
    const matchId = button.dataset.gamePoolOpen
    const fixture = fixtures.find(item => item.id === matchId)
    if (!fixture) return
    state.selectedGamePool = matchId
    state.gamePoolDraft = { matchId, pick: fixture.home.id, tier: 10 }
    persist()
    if (fixture.oddsMatchId) selectPolymarketMatch(fixture.oddsMatchId)
    renderGamePools()
  }))
  $$('#gamePoolGrid [data-game-pool-team]').forEach(button => button.addEventListener('click', () => {
    state.gamePoolDraft = { ...(state.gamePoolDraft || {}), matchId: button.dataset.gamePoolMatch, pick: button.dataset.gamePoolTeam }
    persist()
    renderGamePools()
  }))
  $$('#gamePoolGrid [data-game-pool-tier]').forEach(button => button.addEventListener('click', () => {
    state.gamePoolDraft = { ...(state.gamePoolDraft || {}), matchId: button.dataset.gamePoolMatch, tier: Number(button.dataset.gamePoolTier) }
    persist()
    renderGamePools()
  }))
  $$('#gamePoolGrid [data-enter-game-pool]').forEach(button => button.addEventListener('click', () => {
    const fixture = fixtures.find(item => item.id === button.dataset.enterGamePool)
    if (fixture) enterGamePool(fixture)
  }))
  $$('#gamePoolGrid [data-watch-game-pool]').forEach(button => button.addEventListener('click', () => {
    state.selectedGamePool = button.dataset.watchGamePool
    const fixture = fixtures.find(item => item.id === state.selectedGamePool)
    if (fixture && fixture.oddsMatchId) selectPolymarketMatch(fixture.oddsMatchId)
    persist()
    setView('watch')
  }))
}

function enterGamePool (fixture) {
  const draft = state.gamePoolDraft || {}
  const tier = draft.matchId === fixture.id && GAME_POOL_TIERS.includes(Number(draft.tier)) ? Number(draft.tier) : 10
  const pick = draft.matchId === fixture.id && draft.pick ? draft.pick : fixture.home.id
  if (!GAME_POOL_TIERS.includes(tier) || !pick) { showToast('Choose a winner and stake first'); return }
  const choice = [fixture.home, fixture.away].find(team => team.id === pick)
  if (!choice) { showToast('Choose a team in this match'); return }
  const key = gamePoolEntryKey(fixture.id, tier)
  const poolKey = matchPoolKey(fixture.id, tier)
  if (ownPoolEntry(poolKey)) { showToast(`You're already in the $${tier} ${fixture.home.name} vs ${fixture.away.name} pool`); return }
  const sync = window.PearCupPoolSync
  if (!sync || typeof sync.submit !== 'function') { showToast('Pool sync is still starting — try again in a moment'); return }
  if (!debitWallet(tier, `$${tier} ${fixture.home.name} vs ${fixture.away.name} pool`)) {
    showToast('Not enough balance — fund your wallet first')
    setView('onboarding')
    return
  }
  let entry
  try {
    entry = sync.submit({
      username: state.username || 'captain',
      teamId: state.team,
      poolKey,
      kind: 'match',
      tier,
      pick,
      pickName: choice.name
    })
  } catch (error) {
    state.wallet.balance += tier
    walletLog(`Pool entry refund — sync unavailable`, tier, 'credit')
    persist()
    refreshWallet()
    showToast('Pool sync could not confirm that entry — your demo USDT was returned')
    return
  }
  state.enteredGamePools[key] = { ...entry, fixtureId: fixture.id, tier, pick, pickName: choice.name, enteredAt: entry.createdAt }
  persist()
  renderGamePools()
  showToast(`Picked ${choice.name} in the $${tier} match pool · shared with real peers`)
}

function poolNamespace (poolId) {
  return `pools/${poolId}/wdk-events`
}

function currentUserId () {
  return gameUserId(state.username || 'captain')
}

function normalizePayoutAddress (value) {
  return String(value || '').trim()
}

function demoPayoutAddress (userId) {
  const seed = PearCupCore.deterministicHash({ scope: 'demo-payout-address', userId }).replace(/^0x/, '')
  return `0x${seed.repeat(3).slice(0, 40)}`
}

function savedPayoutAddressFor (userId) {
  return normalizePayoutAddress(state.payoutAddresses && state.payoutAddresses[userId])
}

function payoutAddressForEntrant (entrant) {
  const savedAddress = savedPayoutAddressFor(entrant.userId)
  if (savedAddress) return savedAddress
  if (!integrationRuntime.canUseRealMoney && entrant.userId !== currentUserId()) return demoPayoutAddress(entrant.userId)
  return ''
}

function payoutRecipientsForEntrants (entrants, winnerUserIds) {
  const winners = new Set(winnerUserIds || [])
  return entrants.reduce((recipients, entrant) => {
    if (!winners.has(entrant.userId)) return recipients
    const address = payoutAddressForEntrant(entrant)
    if (address) recipients[entrant.userId] = address
    return recipients
  }, {})
}

function createDemoProcessorPayout ({ input = {}, payout = {} }) {
  const winnerUserIds = Array.isArray(input.winnerUserIds) ? input.winnerUserIds : []
  const payoutRecipients = input.payoutRecipients || {}
  const recipientFor = userId => normalizePayoutAddress(input.payoutAddress || payoutRecipients[userId])
  const missingRecipientUserIds = winnerUserIds.filter(userId => !recipientFor(userId))
  if (missingRecipientUserIds.length > 0) {
    return {
      id: PearCupCore.deterministicHash({
        type: 'DemoWdkPoolPayoutRecipientRequired',
        poolId: input.poolId,
        winnerUserIds,
        missingRecipientUserIds
      }),
      status: 'recipient-required',
      poolId: input.poolId,
      missingRecipientUserIds,
      broadcast: false,
      transfers: []
    }
  }
  const amountEach = Number(payout.amountEach || 0)
  const baseAmount = String(Math.round(amountEach * 1000000))
  return {
    id: PearCupCore.deterministicHash({
      type: 'DemoWdkPoolPayoutQuote',
      poolId: input.poolId,
      winnerUserIds,
      amountEach,
      payoutRecipients
    }),
    status: 'quoted',
    poolId: input.poolId,
    broadcast: false,
    transfers: winnerUserIds.map(userId => ({
      userId,
      reference: `${input.poolId || 'pool'}:${userId}`,
      asset: 'usdt-evm',
      chain: 'ethereum',
      sourceAccountIndex: 0,
      recipient: recipientFor(userId),
      amount: amountEach,
      baseAmount,
      token: null,
      broadcast: false,
      status: 'quoted',
      hash: null,
      fee: 'demo'
    }))
  }
}

function createBracketUiTetherWdkAdapter () {
  const base = integrationRuntime.adapters.tetherWdk
  if (!base || typeof base.reconcileEntryIntent === 'function' || integrationRuntime.canUseRealMoney) return base
  const pendingIntentIds = new Set()

  return {
    ...base,
    reconcileEntryIntent ({ intent, confirmationId }) {
      if (!intent || !intent.intentId) {
        return {
          checkId: PearCupCore.deterministicHash({ intentId: null, confirmationId, reason: 'Entry intent missing' }),
          intentId: null,
          status: 'pending',
          processorStatus: 'missing_intent',
          reason: 'Entry intent is required before payment reconciliation',
          checkedAt: '2026-07-01T00:00:00.000Z'
        }
      }
      if (!pendingIntentIds.has(intent.intentId)) {
        pendingIntentIds.add(intent.intentId)
        return PearCupCore.createTetherWdkEntryPaymentPending({
          intent,
          confirmationId,
          processorStatus: 'demo-awaiting-payment',
          reason: 'Demo WDK rail records a pending check before confirmation.'
        })
      }
      return base.confirmEntryIntent({ intent, confirmationId })
    },

    createPoolPayout (input) {
      const payout = base.createPoolPayout(input)
      return {
        ...payout,
        processorPayout: createDemoProcessorPayout({ input, payout })
      }
    }
  }
}

function createBracketSettlementWorker (eventStore) {
  const rootObject = typeof window !== 'undefined' ? window : globalThis
  return PearCupWorkerClient.createAutoWorkerClient({
    rootObject,
    preferLocal: !integrationRuntime.canUseRealMoney,
    local: () => {
      const tetherWdk = createBracketUiTetherWdkAdapter()
      const worker = PearCupWorkerSim.createWorkerSim({
        storage: eventStore,
        adapters: {
          qvac: integrationRuntime.adapters.qvac,
          tetherWdk,
          mode: {
            qvac: integrationRuntime.adapters.qvac.mode,
            tetherWdk: tetherWdk.mode
          }
        }
      })
      return PearCupWorkerClient.createLocalWorkerClient({ worker })
    }
  })
}

function createPenaltySettlementWorker (eventStore) {
  const rootObject = typeof window !== 'undefined' ? window : globalThis
  return PearCupWorkerClient.createAutoWorkerClient({
    rootObject,
    preferLocal: !integrationRuntime.canUseRealMoney,
    local: () => PearCupWorkerClient.createLocalWorkerClient({
      runtime: integrationRuntime,
      workerFactory: PearCupWorkerSim,
      storage: eventStore
    })
  })
}

function entryRailState (entry) {
  if (entry.payment) return { label: 'Confirmed', className: 'is-confirmed' }
  if (entry.pendingChecks.length > 0) return { label: 'Pending', className: 'is-pending' }
  return { label: 'Intent', className: 'is-intent' }
}

function renderEntryLedger (settlement) {
  return `
    <div class="entry-ledger">
      ${settlement.entryLedger.map(entry => {
        const team = teamById(entry.entrant.teamId)
        const status = entryRailState(entry)
        const latestPending = entry.pendingChecks[entry.pendingChecks.length - 1]
        const proofId = entry.payment
          ? entry.payment.paymentId
          : latestPending
          ? latestPending.checkId
          : entry.intent.intentId
        return `
          <div class="entry-ledger-row ${status.className}">
            <div class="entry-person">
              ${avatarSvg(entry.entrant.username, team, true)}
              <div>
                <strong>${escapeHtml(entry.entrant.username)}</strong>
                <span>${team.flag} ${escapeHtml(team.name)} · ${entry.intent.amount} ${entry.intent.asset}</span>
              </div>
            </div>
            <div class="entry-status-stack">
              <span class="entry-status ${status.className}">${status.label}</span>
              <code>${escapeHtml(proofId)}</code>
            </div>
          </div>
        `
      }).join('')}
    </div>
  `
}

function payoutStatusMeta (status) {
  if (status === 'quoted') return { label: 'Quoted', className: 'is-confirmed' }
  if (status === 'broadcast') return { label: 'Broadcast', className: 'is-confirmed' }
  if (status === 'planned') return { label: 'Planned', className: 'is-pending' }
  if (status === 'recipient-ready') return { label: 'Ready', className: 'is-confirmed' }
  if (status === 'recipient-required') return { label: 'Needs address', className: 'is-pending' }
  if (status === 'prepared') return { label: 'Prepared', className: 'is-confirmed' }
  return { label: 'Held', className: 'is-pending' }
}

function transferForUser (processorPayout, userId) {
  const transfers = processorPayout && Array.isArray(processorPayout.transfers)
    ? processorPayout.transfers
    : []
  return transfers.find(transfer => transfer.userId === userId) || null
}

function renderPayoutRecipients (settlement) {
  const processorPayout = settlement.payout && settlement.payout.processorPayout
  const missing = new Set(processorPayout && processorPayout.missingRecipientUserIds || [])
  const winners = new Set(settlement.winnerUserIds || [])
  const rows = settlement.entrants
    .filter(entrant => winners.has(entrant.userId))
    .map(entrant => {
      const team = teamById(entrant.teamId)
      const transfer = transferForUser(processorPayout, entrant.userId)
      const address = transfer && transfer.recipient
        ? transfer.recipient
        : (settlement.payoutRecipients || {})[entrant.userId] || savedPayoutAddressFor(entrant.userId)
      const status = payoutStatusMeta(transfer
        ? transfer.status
        : missing.has(entrant.userId)
          ? 'recipient-required'
          : address
            ? 'recipient-ready'
            : processorPayout && processorPayout.status)
      const proof = transfer && (transfer.hash || transfer.baseAmount || transfer.reference) || processorPayout && processorPayout.id || 'recipient-pending'
      const canUseDemoFill = !integrationRuntime.canUseRealMoney && !address

      return `
        <div class="payout-recipient-row ${status.className}">
          <div class="entry-person">
            ${avatarSvg(entrant.username, team, true)}
            <div>
              <strong>${escapeHtml(entrant.username)}</strong>
              <span>${team.flag} ${escapeHtml(team.name)} · ${settlement.payout.amountEach || 0} ${settlement.payout.asset || 'USDT'}</span>
            </div>
          </div>
          <label class="payout-address-field">
            <span>Recipient</span>
            <input type="text" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeHtml(address)}" placeholder="0x..." data-payout-user="${escapeHtml(entrant.userId)}">
          </label>
          <div class="entry-status-stack">
            <span class="entry-status ${status.className}">${status.label}</span>
            <code>${escapeHtml(proof)}</code>
          </div>
          ${canUseDemoFill ? `
            <button class="icon-button payout-demo-button" type="button" title="Use demo recipient" aria-label="Use demo recipient for ${escapeHtml(entrant.username)}" data-demo-payout-user="${escapeHtml(entrant.userId)}">
              <svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M3 12h4M17 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            </button>
          ` : ''}
        </div>
      `
    })

  return `<div class="payout-recipient-list">${rows.join('')}</div>`
}

function bindPayoutControls () {
  $$('#bracketEntriesPanel [data-payout-user]').forEach(input => {
    input.addEventListener('change', () => {
      const userId = input.dataset.payoutUser
      const address = normalizePayoutAddress(input.value)
      state.payoutAddresses = state.payoutAddresses || {}
      if (address) state.payoutAddresses[userId] = address
      else delete state.payoutAddresses[userId]
      persist()
      renderBracket()
    })
  })
  $$('#bracketEntriesPanel [data-demo-payout-user]').forEach(button => {
    button.addEventListener('click', () => {
      const userId = button.dataset.demoPayoutUser
      state.payoutAddresses = state.payoutAddresses || {}
      state.payoutAddresses[userId] = demoPayoutAddress(userId)
      persist()
      renderBracket()
    })
  })
}

async function resolveBracketSettlement (selectedPool) {
  // Kept as a compatibility seam for old integrations. Bracket pools now use
  // the peer ledger above; this path is deliberately unavailable so it can
  // never manufacture entrants or trigger a simulated WDK payout.
  throw new Error('Bracket settlement is disabled in demo-entry mode')
  /* c8 ignore next */
  const poolId = ''
  const amount = 0
  const entrants = []
  const eventStore = PearCupStorageSim.createEventStore({
    backend: PearCupStorageSim.createMemoryBackend(),
    rootId: 'pearcup-demo',
    namespace: poolNamespace(poolId)
  })
  const worker = createBracketSettlementWorker(eventStore)
  const settlementService = createUiSettlementService(worker)
  const tetherActor = integrationRuntime.readiness.tetherWdk.adapterId || 'tether-wdk'
  const qvacActor = integrationRuntime.readiness.qvac.adapterId || 'qvac-ref'
  const entryLedger = []

  for (const [index, entrant] of entrants.entries()) {
    const entryId = `${poolId}-${entrant.userId}`
    const intent = await settlementService.createEntryIntent({
      poolId,
      entryId,
      userId: entrant.userId,
      username: entrant.username,
      amount,
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }, {
      actorId: entrant.userId
    })
    const firstCheck = await settlementService.reconcileEntryIntent({
      intentId: intent.payload.intentId,
      confirmationId: `demo-check-${index + 1}`
    }, {
      actorId: tetherActor
    })
    const finalCheck = firstCheck.type === 'TetherWdkEntryConfirmed'
      ? firstCheck
      : await settlementService.reconcileEntryIntent({
          intentId: intent.payload.intentId,
          confirmationId: `demo-confirmation-${index + 1}`
        }, {
          actorId: tetherActor
        })
    entryLedger.push({
      entrant,
      intent: intent.payload,
      pendingChecks: [firstCheck, finalCheck]
        .filter(event => event && event.type === 'TetherWdkEntryPaymentPending')
        .map(event => event.payload),
      payment: finalCheck && finalCheck.type === 'TetherWdkEntryConfirmed' ? finalCheck.payload : null,
      eventIds: {
        intent: intent.eventId,
        firstCheck: firstCheck.eventId,
        finalCheck: finalCheck.eventId
      }
    })
  }

  const winnerUserIds = [entrants[0].userId, entrants[1].userId]
  const payoutRecipients = payoutRecipientsForEntrants(entrants, winnerUserIds)
  const winnerEntrants = entrants.filter(entrant => winnerUserIds.includes(entrant.userId))
  for (const entrant of winnerEntrants) {
    const recipient = payoutRecipients[entrant.userId]
    if (!recipient) continue
    await worker.dispatchAsync({
      type: 'payout:declareRecipient',
      actorId: entrant.userId,
      payload: {
        poolId,
        userId: entrant.userId,
        username: entrant.username,
        teamId: entrant.teamId,
        asset: 'USDT',
        recipient
      }
    })
  }
  const settlementResult = await settlementService.settleBracketPoolWithReceipt({
    poolId,
    winnerUserIds,
    officialResults: {
      final: 'Brazil',
      rule: 'perfect-bracket-split'
    },
    asset: 'USDT',
    rulesVersion: 'bracket-pool-v1',
    qvacActorId: qvacActor,
    wdkActorId: tetherActor
  }, {
    actorId: 'settlement-worker',
    requireLive: integrationRuntime.canUseRealMoney
  })
  const settlementSummary = settlementResult.summary
  const serviceStatus = settlementService.status()
  await settlementService.close()
  if (typeof worker.refresh === 'function') await worker.refresh()
  const view = worker.view()
  const snapshot = eventStore.snapshot()
  const externalWorkerStorage = worker.kind === 'bridge'
  let replayView = { eventRoot: view.eventRoot }
  let replayMatched = true
  if (!externalWorkerStorage) {
    const replayWorker = createBracketSettlementWorker(eventStore)
    replayView = replayWorker.view()
    replayMatched = replayView.eventRoot === view.eventRoot
  }

  return {
    poolId,
    entrants,
    winnerUserIds,
    payoutRecipients,
    entryLedger,
    events: worker.events(),
    entryCount: Object.keys(view.entryPayments).length,
    pendingEntryChecks: Object.keys(view.entryPaymentChecks).length,
    poolResult: settlementSummary.poolResultEvent.payload,
    qvacAttestation: settlementSummary.attestationEvent.payload,
    payout: settlementSummary.settlementEvent.payload,
    settlementSummary,
    settlementReceipt: settlementResult.receipt,
    settlementReceiptEvent: settlementResult.receiptEvent,
    existingReceipt: settlementResult.existingReceipt,
    recipientDeclarationCount: settlementSummary.recipientDeclarationEvents
      ? settlementSummary.recipientDeclarationEvents.length
      : 0,
    settlementGate: serviceStatus.settlementGate,
    guardMode: serviceStatus.guardMode,
    storage: {
      namespace: externalWorkerStorage ? 'pearcup-worker-bridge' : snapshot.namespace,
      events: externalWorkerStorage ? worker.events().length : snapshot.events,
      eventRoot: externalWorkerStorage ? view.eventRoot : snapshot.eventRoot,
      replayRoot: replayView.eventRoot,
      replayMatched,
      external: externalWorkerStorage
    }
  }
}

function getPick (matchId) {
  return state.picks[matchId] || null
}

function makeMatch (id, time, status, slots, score = [null, null]) {
  return { id, time, status, slots, score }
}

// Rolling round-by-round pools: the tree advances on ACTUAL results, not the
// user's predictions — so anyone can join mid-tournament and pick whatever
// matches haven't kicked off yet. A match is pickable while both teams are
// known and no final result is in.
function matchDecided (status) {
  return /^(FT|AET|PEN)/i.test(String(status || ''))
}

function actualWinner (match) {
  if (!match || !matchDecided(match.status)) return null
  const [home, away] = match.slots
  if (!home || !away) return null
  const [sa, sb] = match.score
  if (sa != null && sb != null && sa !== sb) return sa > sb ? home : away
  const pens = String(match.status).match(/PEN\s*(\d+)\s*-\s*(\d+)/i)
  if (pens) return Number(pens[1]) > Number(pens[2]) ? home : away
  return null
}

function feedersOf (matchId) {
  const link = bracketLinks.find(l => l.to === matchId)
  return link ? link.from : []
}

function canPickMatch (match) {
  return Boolean(match && match.slots[0] && match.slots[1] && !matchDecided(match.status))
}

function buildRounds () {
  const round32 = round32Matches.map(match => makeMatch(match.id, match.time, match.status, match.slots, match.score))
  const byId = new Map(round32.map(m => [m.id, m]))
  const winOf = id => actualWinner(byId.get(id))
  const synth = (id, time) => {
    const from = feedersOf(id)
    const slots = [winOf(from[0]) || null, winOf(from[1]) || null]
    const match = makeMatch(id, time, slots[0] && slots[1] ? 'Picks open' : 'TBD', slots, [null, null])
    byId.set(id, match)
    return match
  }
  const round16 = [
    synth('r16-1', 'Sat, 07/04, 00:00'),
    synth('r16-2', 'Sat, 07/04, 04:00'),
    synth('r16-3', 'Sun, 07/05, 00:00'),
    synth('r16-4', 'Sun, 07/05, 04:00'),
    synth('r16-5', 'Mon, 07/06, 00:00'),
    synth('r16-6', 'Mon, 07/06, 04:00'),
    synth('r16-7', 'Tue, 07/07, 00:00'),
    synth('r16-8', 'Tue, 07/07, 04:00')
  ]
  const qf = [
    synth('qf-1', 'Thu, 07/09, 00:00'),
    synth('qf-2', 'Fri, 07/10, 00:00'),
    synth('qf-3', 'Fri, 07/10, 04:00'),
    synth('qf-4', 'Sat, 07/11, 00:00')
  ]
  const semi = [
    synth('sf-1', 'Tue, 07/14, 00:00'),
    synth('sf-2', 'Wed, 07/15, 00:00')
  ]
  const final = [
    synth('final-1', 'Sun, 07/19, 01:00')
  ]

  return [
    { key: 'round32', label: 'Round of 32', matches: round32 },
    { key: 'round16', label: 'Round of 16', matches: round16 },
    { key: 'quarter', label: 'Quarterfinals', matches: qf },
    { key: 'semi', label: 'Semifinals', matches: semi },
    { key: 'final', label: 'Final', matches: final }
  ]
}

function ownersFor (match, teamId) {
  return getPick(match.id) === teamId ? ['You'] : []
}

function slotHint (match, index, roundsById) {
  const feederId = feedersOf(match.id)[index]
  const feeder = feederId && roundsById ? roundsById.get(feederId) : null
  if (feeder && feeder.slots[0] && feeder.slots[1]) {
    return `${teamById(feeder.slots[0]).name} / ${teamById(feeder.slots[1]).name}`
  }
  return 'Winner TBD'
}

function renderTeamRow (match, teamId, index, roundsById) {
  const team = teamId ? teamById(teamId) : null
  const picked = team && getPick(match.id) === team.id
  const score = match.score[index]
  const decided = matchDecided(match.status)
  const winner = decided ? actualWinner(match) : null

  if (!team) {
    return `
      <button class="team-row is-tbd" type="button" disabled>
        <span class="team-flag" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z" fill="#c9b3d6"/></svg>
        </span>
        <span class="team-title slot-hint">${escapeHtml(slotHint(match, index, roundsById))}</span>
        <span class="score"></span>
      </button>
    `
  }

  const chips = ownersFor(match, team.id).map(owner => `<span class="pick-chip">${escapeHtml(owner)}</span>`).join('')
  const won = winner && winner === team.id
  const lost = winner && winner !== team.id
  const verdict = decided && picked
    ? (won ? '<span class="pick-verdict is-hit" title="Your pick won">✓</span>' : '<span class="pick-verdict is-miss" title="Your pick lost">✕</span>')
    : ''
  const rowState = `${picked ? ' is-picked' : ''}${won ? ' is-winner' : ''}${lost ? ' is-eliminated' : ''}`

  return `
    <button class="team-row${rowState}" type="button" data-match="${match.id}" data-pick="${team.id}" aria-pressed="${picked}"${decided ? ' disabled' : ''}>
      <span class="team-flag">${team.flag}</span>
      <span class="team-title">${escapeHtml(team.name)}</span>
      <span class="pick-side">
        ${verdict}${chips}
        <span class="score">${score === null ? '' : score}</span>
      </span>
    </button>
  `
}

function renderPoolSelect () {
  const el = $('#bracketPoolSelect')
  if (!el) return
  el.innerHTML = pools.map(pool => {
    const metrics = bracketPoolMetrics(pool.tier)
    const entered = !!ownPoolEntry(bracketPoolKey(pool.tier))
    const selected = pool.tier === state.selectedTier
    const affordable = state.wallet.balance >= pool.tier
    const cta = entered ? '✓ Entered' : selected ? (affordable ? `Enter · $${pool.tier}` : 'Fund to enter') : 'Select'
    const badge = pool.tier >= 100 ? 'pool-elite' : pool.tier >= 50 ? 'pool-gold' : pool.tier >= 25 ? 'pool-silver' : 'pool-bronze'
    return `
      <button class="pool-pick${selected ? ' is-selected' : ''}${entered ? ' is-entered' : ''}" type="button" data-pool="${pool.tier}">
        <img class="pool-pick-badge" src="assets/${badge}.png" alt="">
        <span class="pool-pick-heat">${pool.heat}</span>
        <span class="pool-pick-fee">$${pool.tier}</span>
        <span class="pool-pick-meta">${fmtMoney(metrics.prize)} demo pool · ${metrics.entrants} real entries</span>
        <span class="pool-pick-cta${entered ? ' is-entered' : affordable ? '' : ' is-locked'}">${cta}</span>
      </button>`
  }).join('')
  $$('#bracketPoolSelect .pool-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = Number(btn.dataset.pool)
      if (state.selectedTier !== tier) { state.selectedTier = tier; persist(); renderBracket(); return }
      enterSelectedPool()
    })
  })
}

function enterSelectedPool () {
  const tier = state.selectedTier
  const poolKey = bracketPoolKey(tier)
  if (ownPoolEntry(poolKey)) { showToast(`You're already in the $${tier} bracket`); return }
  const definition = pools.find(pool => pool.tier === tier)
  if (definition && bracketPoolMetrics(tier).entrants >= definition.max) {
    showToast(`The $${tier} bracket is full`)
    return
  }
  const sync = window.PearCupPoolSync
  if (!sync || typeof sync.submit !== 'function') { showToast('Pool sync is still starting — try again in a moment'); return }
  if (!debitWallet(tier, `$${tier} bracket entry`)) {
    showToast('Not enough balance — fund your wallet first')
    setView('onboarding')
    return
  }
  let entry
  try {
    entry = sync.submit({
      username: state.username || 'captain',
      teamId: state.team,
      poolKey,
      kind: 'bracket',
      tier,
      pick: '',
      pickName: ''
    })
  } catch (error) {
    state.wallet.balance += tier
    walletLog('Bracket entry refund — sync unavailable', tier, 'credit')
    persist()
    refreshWallet()
    showToast('Pool sync could not confirm that entry — your demo USDT was returned')
    return
  }
  state.enteredPools[tier] = entry
  persist()
  renderBracket()
  showToast(`Entered the $${tier} pool · shared with real peers using demo USDT`)
}

function renderBracketEntrants () {
  const el = $('#bracketEntrants')
  if (!el) return
  const entries = entriesForPool(bracketPoolKey(state.selectedTier))
  const everyone = entries.slice(0, 14)
  const count = $('#enteredCount')
  if (count) count.textContent = `· ${entries.length} real entr${entries.length === 1 ? 'y' : 'ies'} in this pool`
  el.innerHTML = everyone.length
    ? everyone.map(entry => `
        <span class="entered-chip${entry.playerId === state.playerId ? ' is-you' : ''}">
          ${avatarSvg(entry.username, teamById(entry.teamId), true)}
          <em>${escapeHtml(entry.playerId === state.playerId ? 'You' : entry.username)}</em>
        </span>`).join('')
    : `<div class="entered-empty-state">
        ${avatarSvg(state.username || 'captain', teamById(state.team), true)}
        <p><strong>Your profile is ready.</strong> Choose a pool to make the first real entry.</p>
      </div>`
}

function renderBracketPoolStats (selectedPool) {
  const metrics = bracketPoolMetrics(selectedPool.tier)
  const entered = !!ownPoolEntry(bracketPoolKey(selectedPool.tier))
  const remaining = remainingPicks()
  if ($('#bracketStats')) $('#bracketStats').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Demo pool</p><strong>${fmtMoney(metrics.prize)}</strong></div>
      <div class="settlement-kpis">
        <div><span>Real entries</span><strong>${metrics.entrants}/${selectedPool.max}</strong></div>
        <div><span>Your entry</span><strong>${entered ? 'Entered' : 'Open'}</strong></div>
        <div><span>Picks</span><strong>${remaining > 0 ? `${remaining} left` : 'Complete'}</strong></div>
      </div>
    </article>
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Entry ledger</p><strong>Peer synced</strong></div>
      <p class="live-copy">Every count comes from an actual submitted entry. Demo USDT stays local to each player; cash settlement and payouts are disabled.</p>
    </article>`

  if ($('#bracketEntriesPanel')) $('#bracketEntriesPanel').innerHTML = `
    <article class="settlement-rail-card entry-ledger-card">
      <div class="rail-header"><p class="eyebrow">Real entries</p><strong>Pick'em pool</strong></div>
      <div class="entry-ledger">
        ${metrics.entries.length ? metrics.entries.map(entry => {
          const team = teamById(entry.teamId)
          return `
            <div class="entry-ledger-row is-confirmed">
              <div class="entry-person">
                ${avatarSvg(entry.username, team, true)}
                <div>
                  <strong>${escapeHtml(entry.playerId === state.playerId ? 'You' : entry.username)}</strong>
                  <span>${team.flag} ${escapeHtml(team.name)} · ${entry.tier} demo USDT</span>
                </div>
              </div>
              <span class="rail-state is-confirmed">Synced</span>
            </div>`
        }).join('') : '<p class="live-copy">No real entries yet.</p>'}
      </div>
    </article>`

  if ($('#bracketAudit')) $('#bracketAudit').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Audit</p><strong>Demo-entry mode</strong></div>
      <div class="hash-list compact-hash">
        <div><span>Currency</span><code>DEMO_USDT</code></div>
        <div><span>Payouts</span><code>disabled by design</code></div>
        <div><span>P2P modules</span><code>${document.documentElement.dataset.pearcupP2pModules || 'checking'}</code></div>
        <div><span>Pool transport</span><code>${window.PearCupPoolSync && window.PearCupPoolSync.backend || 'detecting'}</code></div>
      </div>
    </article>`

  renderBracketEntrants()
}

function matchStateClass (match) {
  if (matchDecided(match.status)) return 'is-decided'
  if (canPickMatch(match)) return 'is-open'
  return 'is-tbd'
}

function renderBracketBoard (rounds = buildRounds()) {
  // Balanced-tree placement: each match spans 2^round content rows and is
  // vertically centred on its two feeders. All rounds fit inside 16 content
  // rows (2–17), so nothing overflows the grid or overlaps a neighbour.
  const placements = {
    round32: index => ({ column: 1, row: index + 2, span: 1 }),
    round16: index => ({ column: 2, row: 2 + (index * 2), span: 2 }),
    quarter: index => ({ column: 3, row: 2 + (index * 4), span: 4 }),
    semi: index => ({ column: 4, row: 2 + (index * 8), span: 8 }),
    final: () => ({ column: 5, row: 2, span: 16 })
  }
  const roundsById = new Map()
  rounds.forEach(round => round.matches.forEach(match => roundsById.set(match.id, match)))
  const pickableIds = new Set([...roundsById.values()].filter(canPickMatch).map(m => m.id))

  $('#bracketBoard').innerHTML = `
    <svg class="bracket-lines" id="bracketLines" aria-hidden="true"></svg>
    ${rounds.map((round, roundIndex) => `
    <p class="round-title" style="grid-column:${roundIndex + 1};grid-row:1" data-round-col="${round.key}">${round.label}</p>
    ${round.matches.map((match, index) => {
      const place = placements[round.key](index)
      const stateClass = matchStateClass(match)
      const statusLabel = stateClass === 'is-open' ? (getPick(match.id) ? 'Picked ✓' : 'Pick now') : match.status
      return `
        <article class="match-card bracket-match ${stateClass}" data-round="${round.key}" data-match-card="${match.id}" style="grid-column:${place.column};grid-row:${place.row} / span ${place.span}">
          <div class="match-meta">
            <span>${match.time}</span>
            <span class="match-status">${statusLabel}</span>
          </div>
          ${renderTeamRow(match, match.slots[0], 0, roundsById)}
          ${renderTeamRow(match, match.slots[1], 1, roundsById)}
        </article>
      `
    }).join('')}
    `).join('')}
  `

  $$('#bracketBoard [data-pick]').forEach(button => {
    button.addEventListener('click', () => {
      if (!pickableIds.has(button.dataset.match)) return
      state.picks[button.dataset.match] = button.dataset.pick
      persist()
      renderBracket()
    })
  })
  scheduleBracketConnectors()
}

function renderRoundStrip (rounds) {
  const el = $('#roundStrip')
  if (!el) return
  el.innerHTML = rounds.map(round => {
    const decided = round.matches.filter(m => matchDecided(m.status))
    const open = round.matches.filter(canPickMatch)
    const openUnpicked = open.filter(m => !getPick(m.id))
    const hits = decided.filter(m => getPick(m.id) && getPick(m.id) === actualWinner(m)).length
    const yourScore = decided.some(m => getPick(m.id)) ? ` · you ${hits}/${decided.length}` : ''
    let stateClass, label
    if (open.length > 0) {
      stateClass = 'is-live'
      label = openUnpicked.length > 0 ? `${openUnpicked.length} open — pick now` : `picked ✓ · locks at kickoff`
    } else if (decided.length === round.matches.length) {
      stateClass = 'is-done'
      label = `decided${yourScore}`
    } else {
      stateClass = 'is-locked'
      label = 'opens when results land'
    }
    return `
      <button class="round-pill ${stateClass}" type="button" data-round-jump="${round.key}">
        <b>${round.label}</b><span>${label}</span>
      </button>`
  }).join('')
  $$('#roundStrip [data-round-jump]').forEach(pill => {
    pill.addEventListener('click', () => {
      const title = document.querySelector(`.round-title[data-round-col="${pill.dataset.roundJump}"]`)
      if (title) title.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    })
  })
}

async function renderBracket () {
  ++bracketRenderSequence
  const selectedPool = pools.find(pool => pool.tier === state.selectedTier) || pools[1]
  const entered = !!ownPoolEntry(bracketPoolKey(selectedPool.tier))
  $('#bracketTierLabel').textContent = `$${selectedPool.tier} pool${entered ? ' · entered' : ''}`
  renderPoolSelect()
  const rounds = buildRounds()
  const remaining = remainingPicks()
  const pr = $('#picksRemaining')
  if (pr) pr.textContent = remaining > 0 ? `${remaining} open now — lock at kickoff` : 'all open picks in ✓'
  // Signpost the flow: highlight the step the user should act on next.
  const steps = $$('#bracket .bracket-step')
  if (steps.length >= 3) {
    steps.forEach(s => s.classList.remove('step-active'))
    steps[!entered ? 0 : remaining > 0 ? 2 : 2].classList.add('step-active')
    if (entered && remaining === 0) steps[2].classList.remove('step-active')
  }
  renderRoundStrip(rounds)
  renderBracketBoard(rounds)
  renderBracketPoolStats(selectedPool)
  scheduleBracketConnectors()
}

function scheduleBracketConnectors () {
  requestAnimationFrame(() => {
    updateBracketConnectors()
    requestAnimationFrame(updateBracketConnectors)
  })
}

function updateBracketConnectors () {
  const board = $('#bracketBoard')
  const svg = $('#bracketLines')
  if (!board || !svg || !board.offsetWidth) return

  if (window.matchMedia('(max-width: 720px)').matches) {
    svg.replaceChildren()
    svg.setAttribute('width', 0)
    svg.setAttribute('height', 0)
    return
  }

  const boardRect = board.getBoundingClientRect()
  const width = board.scrollWidth
  const height = board.scrollHeight
  const pointFor = (id, side = 'right') => {
    const card = board.querySelector(`[data-match-card="${id}"]`)
    if (!card) return null
    const rect = card.getBoundingClientRect()
    return {
      x: (side === 'right' ? rect.right : rect.left) - boardRect.left + board.scrollLeft,
      y: rect.top + (rect.height / 2) - boardRect.top + board.scrollTop
    }
  }

  const paths = []
  for (const link of bracketLinks) {
    const sourceA = pointFor(link.from[0], 'right')
    const sourceB = pointFor(link.from[1], 'right')
    const target = pointFor(link.to, 'left')
    if (!sourceA || !sourceB || !target) continue
    const joinX = Math.round((Math.max(sourceA.x, sourceB.x) + target.x) / 2)
    const y1 = Math.round(sourceA.y)
    const y2 = Math.round(sourceB.y)
    const yt = Math.round(target.y)
    paths.push(`M${Math.round(sourceA.x)} ${y1}H${joinX}`)
    paths.push(`M${Math.round(sourceB.x)} ${y2}H${joinX}`)
    paths.push(`M${joinX} ${Math.min(y1, y2, yt)}V${Math.max(y1, y2, yt)}`)
    paths.push(`M${joinX} ${yt}H${Math.round(target.x)}`)
  }

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('width', width)
  svg.setAttribute('height', height)
  svg.replaceChildren()
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', paths.join(' '))
  path.setAttribute('pathLength', '1')
  svg.append(path)
}

function clearDownstream (matchId) {
  const queue = bracketLinks
    .filter(link => link.from.includes(matchId))
    .map(link => link.to)
  const seen = new Set()
  while (queue.length) {
    const id = queue.shift()
    if (seen.has(id)) continue
    seen.add(id)
    bracketLinks
      .filter(link => link.from.includes(id))
      .forEach(link => queue.push(link.to))
  }
  for (const id of seen) delete state.picks[id]
}

function watchTeamId (liveTeam, fallback) {
  const name = String(liveTeam && liveTeam.name || '').trim().toLowerCase()
  const match = teams.find(team => team.name.toLowerCase() === name)
  return match ? match.id : fallback
}

function watchParticipants () {
  const live = feedState()
  const homeTeamId = watchTeamId(live && live.home, 'es')
  const awayTeamId = watchTeamId(live && live.away, 'be')
  const savedPick = Object.values(state.picks || {}).find(teamId => teamId === homeTeamId || teamId === awayTeamId)
  const livePick = savedPick || ''
  const peers = typeof window !== 'undefined' && window.PearCupWatchSync && window.PearCupWatchSync._state && window.PearCupWatchSync._state.peers
  const remote = peers && typeof peers.values === 'function' ? [...peers.values()] : []
  return [
    { name: state.username || 'captain', team: state.team, pick: livePick, role: 'you' },
    ...remote.map(peer => ({
      name: peer.name || 'guest',
      team: peer.team || 'br',
      pick: peer.pick === homeTeamId || peer.pick === awayTeamId ? peer.pick : '',
      role: 'watcher'
    }))
  ]
}

function currentWatchPick () {
  const live = feedState()
  const sides = [watchTeamId(live && live.home, 'es'), watchTeamId(live && live.away, 'be')]
  return Object.values(state.picks || {}).find(teamId => sides.includes(teamId)) || ''
}

// ==================== Live Watch Party ====================
// Live match feed. `createSimLiveFeed` drives a believable match now; a real feed
// (a host peer polls API-Football / Football-Data.org and rebroadcasts events over
// the Pear room topic so peers don't each hit the API) drops in behind this same
// interface — see createApiLiveFeed seam below.
const WATCH_LANGS = ['EN', 'PT', 'ES', 'FR']
const COMMENTARY_TEMPLATES = {
  goal:   { EN: '⚽ GOAL! {t} score — the room erupts!', PT: '⚽ GOL! {t} marca — a sala explode!', ES: '⚽ ¡GOL de {t}! La sala estalla.', FR: '⚽ BUT de {t} ! La salle explose.' },
  shot:   { EN: '{t} force a sharp save — pressure rising.', PT: '{t} obriga a boa defesa — pressao subindo.', ES: '{t} obliga a una gran atajada — sube la presion.', FR: '{t} obligent a un arret — la pression monte.' },
  chance: { EN: 'Big chance for {t}! Inches wide.', PT: 'Grande chance do {t}! Passou perto.', ES: '¡Ocasion clara de {t}! Rozo el palo.', FR: 'Grosse occasion pour {t} ! Tout pres.' },
  corner: { EN: 'Corner to {t} — bodies in the box.', PT: 'Escanteio para o {t} — area lotada.', ES: 'Corner para {t} — todos al area.', FR: 'Corner pour {t} — la surface se remplit.' },
  save:   { EN: 'Huge save denies {t}! What a moment.', PT: 'Que defesa nega o {t}! Momento enorme.', ES: '¡Paradon que niega a {t}! Momentazo.', FR: 'Quel arret face a {t} ! Moment enorme.' },
  poss:   { EN: '{t} keep the ball and probe for openings.', PT: '{t} tocam a bola buscando espacos.', ES: '{t} manejan el balon buscando espacios.', FR: '{t} gardent le ballon et cherchent la faille.' },
  preview: { EN: '{t}', PT: '{t}', ES: '{t}', FR: '{t}' }
}
// Real seam: replace with a QVAC completion call { event, language } -> line.
function commentaryLine (type, teamName, lang) {
  const row = COMMENTARY_TEMPLATES[type] || COMMENTARY_TEMPLATES.poss
  return (row[lang] || row.EN).replace('{t}', teamName)
}

function createSimLiveFeed () {
  const listeners = new Set()
  let timer = null
  const st = {
    matchId: 'world-cup-spain-belgium',
    minute: 0,
    home: { name: 'Spain', flag: '🇪🇸', teamId: 'es', goals: 0 },
    away: { name: 'Belgium', flag: '🇧🇪', teamId: 'be', goals: 0 },
    possession: 50,
    shots: [0, 0],
    threat: 50,
    hasScore: false,
    matchStatus: 'TIMED',
    utcDate: '2026-07-10T22:00:00Z',
    stage: 'QUARTER_FINALS',
    fixtures: [],
    competition: { name: 'FIFA World Cup' }
  }
  st.dataSource = 'preview'
  st.dataFresh = false
  st.statsAvailable = false
  const emit = ev => listeners.forEach(fn => fn(ev, st))
  function tick () {
    if (st.matchStatus === 'TIMED' || st.matchStatus === 'SCHEDULED') {
      emit({ type: 'preview', team: 'Spain vs Belgium room is open. Kickoff is 15:00 ET.', clock: 'Soon', minute: 0 })
      return
    }
    st.minute += 1
    st.possession = Math.max(35, Math.min(72, st.possession + Math.round((Math.random() - 0.5) * 8)))
    st.threat = Math.max(20, Math.min(96, st.threat + Math.round((Math.random() - 0.5) * 22)))
    const attackingHome = st.possession >= 50
    const team = attackingHome ? st.home : st.away
    const idx = attackingHome ? 0 : 1
    const roll = Math.random()
    let type = 'poss'
    if (roll > 0.9) { type = 'goal'; team.goals += 1; st.shots[idx] += 1 }
    else if (roll > 0.72) { type = 'shot'; st.shots[idx] += 1 }
    else if (roll > 0.58) { type = 'save' }
    else if (roll > 0.44) { type = 'chance'; st.shots[idx] += 1 }
    else if (roll > 0.3) { type = 'corner' }
    emit({ type, team: team.name, teamId: team.teamId, clock: `${st.minute}'`, minute: st.minute })
    if (st.minute >= 90) { stop(); emit({ type: 'ft', team: '', clock: 'FT', minute: 90 }) }
  }
  function start () { if (!timer) timer = setInterval(tick, 3400) }
  function stop () { if (timer) { clearInterval(timer); timer = null } }
  return { start, stop, subscribe (fn) { listeners.add(fn); return () => listeners.delete(fn) }, state () { return st }, source: 'sim' }
}
// Real live feed — fetches a football data API and maps it to the same interface.
// NOTE: browsers can't call these APIs directly (no CORS). In the Pear runtime a
// worker fetches (no CORS) and relays over the room topic; for browser testing set
// a CORS `proxy` prefix in the Live-data settings.
function mapFeed (st, provider, data) {
  if (provider === 'football-data') {
    // The worker relay ships a v2 snapshot (`activeMatch` plus the full fixture
    // list). Direct Football-Data responses remain supported for operator testing.
    const snapshot = data && data.activeMatch ? data : null
    const m = snapshot ? snapshot.activeMatch : (Array.isArray(data.matches) ? data.matches[0] : data)
    if (!m) throw new Error('No live match found')
    st.matchId = m.id || null
    st.fixtures = snapshot && Array.isArray(snapshot.matches) ? snapshot.matches : (Array.isArray(data.matches) ? data.matches : [])
    st.generatedAt = snapshot && snapshot.generatedAt || null
    st.home.name = m.homeTeam.shortName || m.homeTeam.name || 'Home'
    st.away.name = m.awayTeam.shortName || m.awayTeam.name || 'Away'
    st.home.tla = m.homeTeam.tla || ''
    st.away.tla = m.awayTeam.tla || ''
    st.home.crest = m.homeTeam.crest || ''
    st.away.crest = m.awayTeam.crest || ''
    const ft = m.score && (m.score.fullTime || m.score.regularTime) || {}
    const hasScore = ft.home != null || ft.away != null
    st.home.goals = ft.home ?? 0
    st.away.goals = ft.away ?? 0
    st.hasScore = hasScore
    st.minute = m.minute ?? st.minute
    st.matchStatus = m.status || 'IN_PLAY'
    st.competition = { name: (m.competition && m.competition.name) || 'FIFA World Cup', emblem: (m.competition && m.competition.emblem) || '' }
    st.utcDate = m.utcDate || ''
    st.stage = m.stage || ''
    st.matchday = m.matchday || null
    st.venue = m.venue || ''
    st.lastUpdated = m.lastUpdated || ''
  } else {
    const r = (data.response || [])[0]
    if (!r) throw new Error('No fixture found')
    st.home.name = r.teams.home.name
    st.away.name = r.teams.away.name
    st.home.goals = r.goals.home ?? 0
    st.away.goals = r.goals.away ?? 0
    st.minute = (r.fixture.status && r.fixture.status.elapsed) ?? st.minute
    st.matchStatus = r.fixture.status && r.fixture.status.short || 'LIVE'
    st.matchId = r.fixture && r.fixture.id || null
    st.fixtures = data.response || []
  }
  st.home.flag = st.home.flag || '⚽'
  st.away.flag = st.away.flag || '⚽'
}

function apiRequest (config) {
  const provider = config.provider || 'football-data'
  const proxy = config.proxy || ''
  // Same-origin relay: a Pear worker (or fetch-live.mjs) writes a JSON file the
  // renderer polls — no CORS, no key in the browser. This IS the production path.
  if (proxy && /\.json(\?|$)/.test(proxy)) {
    return fetch(proxy, { cache: 'no-store' }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
  }
  let url, headers
  if (provider === 'football-data') {
    url = config.matchId
      ? `https://api.football-data.org/v4/matches/${config.matchId}`
      : 'https://api.football-data.org/v4/matches?status=LIVE'
    headers = { 'X-Auth-Token': config.apiKey }
  } else {
    url = `https://v3.football.api-sports.io/fixtures?id=${config.matchId}`
    headers = { 'x-apisports-key': config.apiKey }
  }
  return fetch(proxy + url, { headers }).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  })
}

function createApiLiveFeed (config) {
  const listeners = new Set()
  let timer = null
  const st = {
    minute: 0,
    home: { name: 'Home', flag: '⚽', teamId: 'es', goals: 0 },
    away: { name: 'Away', flag: '⚽', teamId: 'at', goals: 0 },
    possession: 50, shots: [0, 0], threat: 50, matchStatus: 'connecting',
    dataSource: 'relay', dataFresh: config.relayFresh !== false, statsAvailable: false
  }
  const emit = ev => listeners.forEach(fn => fn(ev, st))
  async function poll () {
    try {
      const data = await apiRequest(config)
      const first = st._total === undefined
      const prevHome = st.home.goals
      const prevTotal = st._total
      mapFeed(st, config.provider, data)
      st.dataFresh = config.relayFresh !== false
      st.relayGeneratedAt = config.relayGeneratedAt || st.generatedAt || null
      const total = st.home.goals + st.away.goals
      const clk = st.minute ? `${st.minute}'` : ''
      // First poll seeds the baseline (don't announce the existing score as new goals).
      let ev = { type: 'tick', clock: clk, minute: st.minute }
      if (!first && total > prevTotal) ev = { type: 'goal', team: st.home.goals > prevHome ? st.home.name : st.away.name, clock: clk, minute: st.minute }
      st._total = total
      emit(ev)
    } catch (err) {
      st.matchStatus = 'error'
      emit({ type: 'error', message: String(err.message || err) })
    }
  }
  return {
    start () { if (!timer) { poll(); timer = setInterval(poll, (config.pollSec || 30) * 1000) } },
    stop () { if (timer) { clearInterval(timer); timer = null } },
    subscribe (fn) { listeners.add(fn); return () => listeners.delete(fn) },
    state () { return st },
    poll,
    source: 'api'
  }
}

const simFeed = createSimLiveFeed()
let apiFeed = null
let activeFeed = simFeed
let feedUnsub = null
function feedState () { return activeFeed.state() }

function seedFeedEvents () {
  if (!state.feedEvents || !state.feedEvents.length) {
    const st = feedState()
    const kickoff = st.utcDate ? fmtTime(st.utcDate) : 'TBC'
    const round = stageLabel(st) || 'World Cup'
    state.feedEvents = [
      { clock: 'Today', type: 'preview', team: `${st.home.name} vs ${st.away.name} room is open.` },
      { clock: kickoff, type: 'preview', team: `Kickoff ${kickoff}. Live events will appear here from the provider relay.` },
      { clock: round, type: 'preview', team: `${round} fixture data is loaded from the active match snapshot.` }
    ]
  }
}

function renderCommentaryFeed () {
  const feed = $('#commentaryFeed')
  if (!feed) return
  // Live API: show only real goals for this match (+ an intro), not the sim lines.
  if (isLiveApi()) {
    const st = feedState()
    const goals = (state.feedEvents || []).filter(e => e.type === 'goal')
    const intro = `<div class="commentary-line"><time>LIVE</time><p>Following ${escapeHtml(st.home.name)} vs ${escapeHtml(st.away.name)} — QVAC commentary updates as goals go in.</p></div>`
    feed.innerHTML = intro + goals.map(ev => `
      <div class="commentary-line is-goal">
        <time>${escapeHtml(ev.clock || 'LIVE')}</time>
        <p>${escapeHtml(commentaryLine(ev.type, ev.team, state.language))}</p>
      </div>`).join('')
    return
  }
  seedFeedEvents()
  feed.innerHTML = state.feedEvents.map(ev => `
    <div class="commentary-line${ev.type === 'goal' ? ' is-goal' : ''}">
      <time>${escapeHtml(ev.clock)}</time>
      <p>${escapeHtml(commentaryLine(ev.type, ev.team, state.language))}</p>
    </div>
  `).join('')
}

function isLiveApi () { return activeFeed && activeFeed.source === 'api' }

function fmtTime (iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

function matchStateLabel (st) {
  const s = st.matchStatus
  if (s === 'FINISHED') return { txt: 'Full time', cls: 'is-ft', dot: false }
  if (s === 'PAUSED') return { txt: 'Half time', cls: 'is-live', dot: true }
  if (s === 'IN_PLAY' || s === 'LIVE') return { txt: st.minute ? `${st.minute}'` : 'LIVE', cls: 'is-live', dot: true }
  if (s === 'TIMED' || s === 'SCHEDULED') return { txt: `Kicks off ${fmtTime(st.utcDate) || 'soon'}`, cls: 'is-soon', dot: false }
  return { txt: s || 'Scheduled', cls: 'is-soon', dot: false }
}

function stageLabel (st) {
  const map = { LAST_32: 'Round of 32', LAST_16: 'Round of 16', ROUND_OF_16: 'Round of 16', QUARTER_FINALS: 'Quarter-final', SEMI_FINALS: 'Semi-final', FINAL: 'Final', GROUP_STAGE: 'Group stage', THIRD_PLACE: 'Third place' }
  return map[st.stage] || (st.stage ? String(st.stage).replace(/_/g, ' ').toLowerCase() : '')
}

function renderLiveBoard (st) {
  const el = $('#tvLiveBoard')
  if (!el) return
  const info = matchStateLabel(st)
  const scoreMid = st.hasScore ? `${st.home.goals}<span>–</span>${st.away.goals}` : '<span class="lb-vs">vs</span>'
  const homeTeam = teamById(watchTeamId(st.home, 'es'))
  const awayTeam = teamById(watchTeamId(st.away, 'be'))
  const crest = (url, flag) => url
    ? `<span class="lb-crestwrap"><img class="lb-crest" src="${escapeHtml(url)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="lb-crest lb-crest-blank" style="display:none">${flag}</span></span>`
    : `<div class="lb-crest lb-crest-blank">${flag}</div>`
  const kickoff = st.utcDate ? `${new Date(st.utcDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${fmtTime(st.utcDate)}` : 'To be confirmed'
  const round = stageLabel(st) || 'FIFA World Cup'
  const isNow = ['IN_PLAY', 'LIVE', 'PAUSED'].includes(st.matchStatus)
  const sourceLabel = isLiveApi()
    ? st.dataFresh === false ? 'Saved fixture snapshot' : isNow ? 'Live provider feed' : 'Fixture feed connected'
    : 'Preview mode'
  const latestEvent = (state.feedEvents || []).find(event => event && event.type && !['preview', 'tick'].includes(event.type))
  const eventText = latestEvent
    ? `${latestEvent.clock || 'Now'} · ${commentaryLine(latestEvent.type, latestEvent.team, state.language || 'EN')}`
    : isNow ? 'Waiting for the next verified match event…' : `Live event tracking starts when ${st.home.name} vs ${st.away.name} kicks off.`
  el.className = `tv-liveboard ${isNow ? 'is-now' : 'is-scheduled'}`
  el.innerHTML = `
    <div class="match-stage-shell">
      <div class="lb-comp">
        ${st.competition && st.competition.emblem ? `<img class="lb-emblem" src="${escapeHtml(st.competition.emblem)}" alt="">` : ''}
        <span>${escapeHtml((st.competition && st.competition.name) || 'FIFA World Cup')} · ${escapeHtml(round)}</span>
      </div>
      <div class="lb-teams">
        <div class="lb-team">${crest(st.home.crest, homeTeam.flag)}<strong>${escapeHtml(st.home.name)}</strong><small>Home</small></div>
        <div class="lb-score"><span class="lb-state ${info.cls}">${info.dot ? '<i></i>' : ''}${escapeHtml(info.txt)}</span><strong>${scoreMid}</strong></div>
        <div class="lb-team">${crest(st.away.crest, awayTeam.flag)}<strong>${escapeHtml(st.away.name)}</strong><small>Away</small></div>
      </div>
      <div class="lb-data-grid" aria-label="Match details">
        <div><span>Kickoff</span><strong>${escapeHtml(kickoff)}</strong></div>
        <div><span>Round</span><strong>${escapeHtml(round)}</strong></div>
        <div><span>Source</span><strong>${escapeHtml(sourceLabel)}</strong></div>
      </div>
      <p class="lb-event">${escapeHtml(eventText)}</p>
    </div>`
}

function renderLiveSource (st) {
  const el = $('#liveSource')
  if (!el) return
  const isNow = ['IN_PLAY', 'LIVE', 'PAUSED'].includes(st.matchStatus)
  const isProvider = isLiveApi()
  const label = isProvider ? (st.dataFresh === false ? 'FIXTURE SNAPSHOT' : isNow ? 'LIVE DATA' : 'FIXTURE DATA') : 'PREVIEW MODE'
  const source = isProvider
    ? `Football-Data.org${st.relayGeneratedAt || st.lastUpdated ? ` · updated ${fmtTime(st.relayGeneratedAt || st.lastUpdated)}` : ''}`
    : 'Waiting for the KeyVault-backed relay'
  el.innerHTML = `
    <span class="ls-badge ${st.dataFresh === false ? 'is-stale' : ''}">${isProvider && st.dataFresh !== false ? '<i></i>' : ''}${label}</span>
    <span class="ls-src">${escapeHtml(source)}</span>
    ${isProvider ? '<button class="ls-refresh" id="liveRefresh" type="button">↻ Refresh</button>' : ''}`
  const r = $('#liveRefresh')
  if (r) r.onclick = () => { if (activeFeed && activeFeed.poll) { activeFeed.poll(); showToast('Refreshing live data…') } }
}

function renderWatchStats (st) {
  const el = $('#watchStats')
  if (!el) return
  const scheduled = ['TIMED', 'SCHEDULED', 'connecting'].includes(st.matchStatus)
  if (isLiveApi() || scheduled || !st.statsAvailable) {
    el.className = 'stats-strip is-live-meta'
    const chip = (label, val) => `<div class="live-meta"><span>${label}</span><strong>${escapeHtml(val || '—')}</strong></div>`
    el.innerHTML =
      chip('Status', matchStateLabel(st).txt) +
      chip('Kickoff', st.utcDate ? `${new Date(st.utcDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${fmtTime(st.utcDate)}` : 'TBC') +
      chip('Round', stageLabel(st))
    return
  }
  el.className = 'stats-strip'
  const poss = st.possession
  const shotsPct = Math.round((st.shots[0] / Math.max(1, st.shots[0] + st.shots[1])) * 100)
  const threatLabel = st.threat > 78 ? 'High' : st.threat > 50 ? 'Medium' : 'Low'
  const meter = (label, pct, value) => `
    <div class="stat-meter">
      <span>${label}</span>
      <div class="meter"><i style="width:${pct}%"></i></div>
      <strong>${value}</strong>
    </div>`
  el.innerHTML =
    meter('Possession', poss, `${poss} / ${100 - poss}`) +
    meter('Shots', shotsPct, `${st.shots[0]} / ${st.shots[1]}`) +
    meter('Threat', st.threat, threatLabel)
}

function flashTv () {
  const flash = $('#tvFlash')
  if (!flash) return
  flash.classList.remove('is-on')
  void flash.offsetWidth
  flash.classList.add('is-on')
}

let lastLiveMatchKey = ''
function applyFeedTick (ev, st) {
  // Clear commentary when the live match changes (or on entering live mode).
  if (isLiveApi()) {
    const key = `${st.home.name}|${st.away.name}`
    if (key !== lastLiveMatchKey) { lastLiveMatchKey = key; state.feedEvents = [] }
  }
  const title = $('#watchTitle'); if (title) title.textContent = `${st.home.name} vs ${st.away.name}`
  // The match centre always renders from feed state; it never substitutes a
  // decorative fake pitch when provider data is stale or pre-match.
  const tv = document.querySelector('#watch .stadium-tv')
  const board = $('#tvLiveBoard'); const src = $('#liveSource')
  if (tv) tv.classList.toggle('is-live', isLiveApi())
  if (board) { board.hidden = false; renderLiveBoard(st) }
  if (src) { src.hidden = false; renderLiveSource(st) }
  renderWatchStats(st)
  if (isLiveApi()) renderCommentaryFeed()
  // Only log real events with a team (skip API poll 'tick' refreshes).
  if (ev && ev.type && ev.type !== 'ft' && ev.type !== 'tick' && ev.team) {
    seedFeedEvents()
    state.feedEvents.unshift({ clock: ev.clock, type: ev.type, team: ev.team })
    state.feedEvents = state.feedEvents.slice(0, 24)
    renderCommentaryFeed()
  }
  if (ev && ev.type === 'goal') { flashTv(); showToast(`⚽ GOAL! ${ev.team} — ${st.home.goals}-${st.away.goals}`) }
  // Keep the Home dashboard live too (hero/fixtures/timeline/stats reflect the same feed).
  if (document.querySelector('#home')?.classList.contains('is-active') && $('#liveDetail')) {
    renderHomeDashboard()
    renderGamePools()
  }
  // Watch room key follows the current match — re-join if it changed (e.g. sim → live).
  if (window.PearCupWatchSync && document.querySelector('#watch')?.classList.contains('is-active')) {
    window.PearCupWatchSync.ensureRoom()
  }
}

// A release can receive an HTTPS relay URL from the Pear host's renderer-safe
// settings. During local development, the staged same-origin fixture remains a
// fallback. Neither path sends a provider key to the browser.
const RELAY_FILE = 'live-match.json'
function isRelay (proxy) { return /\.json(\?|$)/.test(proxy || '') }

// Auto-detect the relay and switch the Watch feed without any per-user API-key
// settings. A configured production relay always wins over local storage.
async function detectLiveRelay () {
  const cfg = state.liveConfig || {}
  const relayUrl = productionLiveData ? productionLiveData.relayUrl : RELAY_FILE
  if (!productionLiveData && cfg.apiKey && cfg.enabled) return
  try {
    const res = await fetch(withRelayCacheBust(relayUrl), { cache: 'no-store' })
    if (!res.ok) return
    const snapshot = await res.json()
    if (!snapshot || snapshot.schema !== 'pearcup-live-v2') throw new Error('Unsupported live relay snapshot')
    const match = snapshot.activeMatch || snapshot
    const stamp = Date.parse(snapshot.generatedAt || match.lastUpdated || match.utcDate || 0) || 0
    const maximumAge = productionLiveData ? Math.max(120_000, productionLiveData.pollMs * 4) : 5 * 60 * 1000
    const relayFresh = !stamp || Date.now() - stamp <= maximumAge
    state.liveConfig = {
      ...cfg,
      enabled: true,
      provider: 'football-data',
      apiKey: '',
      proxy: relayUrl,
      pollSec: productionLiveData ? Math.max(15, Math.round(productionLiveData.pollMs / 1000)) : 30,
      relayFresh,
      relayGeneratedAt: snapshot.generatedAt || match.lastUpdated || null
    }
    startLiveFeed()
    if (document.querySelector('#watch')?.classList.contains('is-active')) renderWatch()
  } catch { /* no relay yet — stay on the simulated feed */ }
}

function startLiveFeed () {
  const cfg = state.liveConfig
  const useApi = cfg && cfg.enabled && (cfg.apiKey || isRelay(cfg.proxy))
  const cfgKey = JSON.stringify(cfg || {})
  if (useApi) {
    // Reuse the same feed instance across re-renders so the goal baseline isn't reset.
    if (!apiFeed || apiFeed._cfgKey !== cfgKey) {
      if (apiFeed) apiFeed.stop()
      apiFeed = createApiLiveFeed(cfg)
      apiFeed._cfgKey = cfgKey
    }
    simFeed.stop()
    activeFeed = apiFeed
  } else {
    if (apiFeed) apiFeed.stop()
    activeFeed = simFeed
  }
  if (feedUnsub) feedUnsub()
  feedUnsub = activeFeed.subscribe(applyFeedTick)
  activeFeed.start()
}

// ---- QVAC watch-party trivia -------------------------------------------------
// The host keeps the answer locally until reveal. Peers receive only the question
// and options, then a signed-in-the-room reveal event; this makes the mini-game work
// over the existing watch topic without leaking the answer in the initial broadcast.
let watchTrivia = null
let watchTriviaTimer = null
let watchTriviaGenerating = false
let watchTriviaRoundOrdinal = 0
const watchTriviaPrefetch = new Map()
const watchTriviaPrefetching = new Set()

function clearWatchTriviaTimer () {
  if (watchTriviaTimer) clearTimeout(watchTriviaTimer)
  watchTriviaTimer = null
}

function triviaMatchEvidence () {
  const st = feedState()
  return {
    id: st.matchId || `${st.home && st.home.name || 'home'}-${st.away && st.away.name || 'away'}`,
    home: { name: st.home && st.home.name, goals: st.home && st.home.goals },
    away: { name: st.away && st.away.name, goals: st.away && st.away.goals },
    stage: stageLabel(st) || '',
    status: matchStateLabel(st).txt,
    score: { home: st.home && st.home.goals, away: st.away && st.away.goals }
  }
}

function fallbackTriviaRound (input) {
  if (window.PearCupQvacReferee && typeof window.PearCupQvacReferee.createTriviaRound === 'function') {
    return window.PearCupQvacReferee.createTriviaRound({ input, hostId: 'qvac-local-fallback' })
  }
  const match = input.match || {}
  const home = match.home && match.home.name || 'Home'
  const away = match.away && match.away.name || 'Away'
  const payload = {
    matchId: input.matchId,
    language: input.language,
    question: `Which team is listed first for ${home} vs ${away}?`,
    options: [home, away, 'Both teams', 'No team'],
    answerIndex: 0,
    explanation: `${home} is the home side in the active match snapshot.`,
    modelId: 'local-fallback',
    hostId: 'qvac-local-fallback'
  }
  return { triviaId: PearCupCore.deterministicHash(payload), ...payload }
}

function triviaInput () {
  const match = triviaMatchEvidence()
  return {
    matchId: match.id,
    language: state.language || 'EN',
    roundOrdinal: watchTriviaRoundOrdinal++,
    match,
    recentEvents: (state.feedEvents || []).slice(0, 6).map((event, index) => ({
      eventId: `watch-${index}-${event.clock || 'now'}`,
      type: event.type,
      team: event.team,
      clock: event.clock
    }))
  }
}

function publicTriviaRound (round) {
  return {
    triviaId: round.triviaId,
    matchId: round.matchId,
    language: round.language,
    question: round.question,
    options: round.options,
    category: round.category || null,
    modelId: round.modelId || null,
    hostId: round.hostId || null
  }
}

function triviaPrefetchKey (input) {
  return `${input.matchId || 'unknown-match'}:${Math.max(0, Number(input.roundOrdinal) || 0)}`
}

function queueQvacTriviaSelection (input, commentary) {
  if (!commentary || typeof commentary.generateTriviaRound !== 'function') return
  const nextInput = { ...input, roundOrdinal: Math.max(0, Number(input.roundOrdinal) || 0) + 1 }
  const key = triviaPrefetchKey(nextInput)
  if (watchTriviaPrefetch.has(key) || watchTriviaPrefetching.has(key)) return
  watchTriviaPrefetching.add(key)
  // A local model is a refinement, never a dependency for the room. Start it after
  // the verified round is visible; a slow or unavailable model cannot freeze trivia.
  setTimeout(() => {
    Promise.resolve(commentary.generateTriviaRound(nextInput))
      .then(candidate => {
        if (candidate && candidate.questionId) {
          watchTriviaPrefetch.set(key, candidate)
          if (watchTriviaPrefetch.size > 8) watchTriviaPrefetch.delete(watchTriviaPrefetch.keys().next().value)
        }
      })
      .catch(err => console.warn('QVAC next-trivia selection unavailable; keeping verified local rotation', err))
      .finally(() => watchTriviaPrefetching.delete(key))
  }, 0)
}

function armWatchTriviaReveal () {
  clearWatchTriviaTimer()
  if (!watchTrivia || watchTrivia.hostId !== selfPeerId() || watchTrivia.revealed) return
  watchTriviaTimer = setTimeout(revealWatchTrivia, 25000)
}

async function startWatchTrivia () {
  if (watchTriviaGenerating) return
  watchTriviaGenerating = true
  renderWatchTrivia()
  const input = triviaInput()
  const commentary = integrationRuntime.adapters && integrationRuntime.adapters.qvacCommentary
  const prefetchKey = triviaPrefetchKey(input)
  const prefetchedRound = watchTriviaPrefetch.get(prefetchKey)
  if (prefetchedRound) watchTriviaPrefetch.delete(prefetchKey)
  const verifiedFallback = fallbackTriviaRound(input)
  const round = prefetchedRound || verifiedFallback
  const usedQvacSelection = Boolean(prefetchedRound && prefetchedRound.questionId)
  const roundCategory = round && round.category || verifiedFallback.category || 'football knowledge'
  const normalized = {
    ...verifiedFallback,
    ...(round || {}),
    category: roundCategory,
    options: Array.isArray(round && round.options) && round.options.length === 4 ? round.options : verifiedFallback.options,
    answerIndex: Number.isInteger(Number(round && round.answerIndex)) ? Number(round.answerIndex) : 0,
    hostId: selfPeerId(),
    answers: {},
    revealed: false,
    source: `${usedQvacSelection ? 'QVAC-selected' : 'Verified World Cup trivia'} · ${roundCategory}`
  }
  if (normalized.answerIndex < 0 || normalized.answerIndex > 3) normalized.answerIndex = 0
  watchTrivia = normalized
  watchTriviaGenerating = false
  queueQvacTriviaSelection(input, commentary)
  armWatchTriviaReveal()
  if (window.PearCupWatchSync && typeof window.PearCupWatchSync.broadcastTrivia === 'function') {
    window.PearCupWatchSync.broadcastTrivia({ t: 'trivia:round', round: publicTriviaRound(watchTrivia) })
  }
  renderWatchTrivia()
}

function answerWatchTrivia (answerIndex) {
  if (!watchTrivia || watchTrivia.revealed || watchTrivia.answer != null) return
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) return
  watchTrivia.answer = answerIndex
  const self = selfPeerId()
  watchTrivia.answers = { ...(watchTrivia.answers || {}), [self]: answerIndex }
  if (window.PearCupWatchSync && typeof window.PearCupWatchSync.broadcastTrivia === 'function') {
    window.PearCupWatchSync.broadcastTrivia({ t: 'trivia:answer', triviaId: watchTrivia.triviaId, answerIndex })
  }
  renderWatchTrivia()
}

function applyTriviaReveal (correctIndex, explanation) {
  if (!watchTrivia || watchTrivia.revealed) return
  watchTrivia.revealed = true
  watchTrivia.correctIndex = correctIndex
  if (explanation) watchTrivia.explanation = explanation
  clearWatchTriviaTimer()
  if (watchTrivia.answer === correctIndex && !watchTrivia.scored) {
    watchTrivia.scored = true
    state.triviaScore = Number(state.triviaScore || 0) + 1
    persist()
    showToast('Correct! +1 watch-party trivia point')
  }
  renderWatchTrivia()
}

function revealWatchTrivia () {
  if (!watchTrivia || watchTrivia.revealed || watchTrivia.hostId !== selfPeerId()) return
  applyTriviaReveal(watchTrivia.answerIndex, watchTrivia.explanation)
  if (window.PearCupWatchSync && typeof window.PearCupWatchSync.broadcastTrivia === 'function') {
    window.PearCupWatchSync.broadcastTrivia({
      t: 'trivia:reveal',
      triviaId: watchTrivia.triviaId,
      correctIndex: watchTrivia.answerIndex,
      explanation: watchTrivia.explanation
    })
  }
}

function bindTriviaSync () {
  if (!window.PearCupWatchSync || window.PearCupWatchSync._triviaBound || typeof window.PearCupWatchSync.onTrivia !== 'function') return
  window.PearCupWatchSync._triviaBound = true
  window.PearCupWatchSync.onTrivia(message => {
    if (!message || !message.t) return
    if (message.t === 'trivia:round' && message.round && Array.isArray(message.round.options)) {
      clearWatchTriviaTimer()
      watchTrivia = {
        ...message.round,
        hostId: message.from,
        answers: {},
        revealed: false,
        source: `QVAC-powered trivia · ${message.round.category || 'football knowledge'}`
      }
      renderWatchTrivia()
      return
    }
    if (!watchTrivia || message.triviaId !== watchTrivia.triviaId) return
    if (message.t === 'trivia:answer') {
      watchTrivia.answers = { ...(watchTrivia.answers || {}), [message.from]: message.answerIndex }
      renderWatchTrivia()
    }
    if (message.t === 'trivia:reveal') applyTriviaReveal(message.correctIndex, message.explanation)
  })
}

function renderWatchTrivia () {
  const el = $('#watchTrivia')
  if (!el) return
  const score = Number(state.triviaScore || 0)
  if (watchTriviaGenerating) {
    el.innerHTML = `<div class="trivia-head"><div><p class="eyebrow">QVAC-powered trivia</p><strong>Choosing a verified football question…</strong></div><span class="trivia-score">${score} pts</span></div><p class="trivia-wait">Mixing this fixture’s World Cup history with general football knowledge.</p>`
    return
  }
  if (!watchTrivia) {
    el.innerHTML = `<div class="trivia-head"><div><p class="eyebrow">QVAC-powered trivia</p><strong>World Cup history, made for this fixture</strong></div><span class="trivia-score">${score} pts</span></div><p class="trivia-wait">Relevant team history and general football knowledge — verified facts, never odds.</p><button class="primary-button compact-action" id="startWatchTrivia" type="button">Start trivia</button>`
    const start = $('#startWatchTrivia')
    if (start) start.addEventListener('click', startWatchTrivia)
    return
  }
  const isHost = watchTrivia.hostId === selfPeerId()
  const answerCount = Object.keys(watchTrivia.answers || {}).length
  const options = watchTrivia.options.map((option, index) => {
    const isAnswer = watchTrivia.answer === index
    const isCorrect = watchTrivia.revealed && watchTrivia.correctIndex === index
    const isWrong = watchTrivia.revealed && isAnswer && !isCorrect
    return `<button class="trivia-option${isAnswer ? ' is-answer' : ''}${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}" type="button" data-trivia-answer="${index}"${watchTrivia.revealed || watchTrivia.answer != null ? ' disabled' : ''}><b>${String.fromCharCode(65 + index)}</b><span>${escapeHtml(option)}</span>${isCorrect ? '<i>✓</i>' : ''}</button>`
  }).join('')
  el.innerHTML = `
    <div class="trivia-head"><div><p class="eyebrow">QVAC-powered trivia</p><strong>${escapeHtml(watchTrivia.source || 'QVAC-powered room trivia')}</strong></div><span class="trivia-score">${score} pts</span></div>
    <p class="trivia-question">${escapeHtml(watchTrivia.question)}</p>
    <div class="trivia-options">${options}</div>
    ${watchTrivia.revealed ? `<p class="trivia-explanation">${escapeHtml(watchTrivia.explanation || 'Answer verified from the active match snapshot.')}</p>` : `<div class="trivia-foot"><span>${answerCount} answer${answerCount === 1 ? '' : 's'} in · reveal in 25s</span>${isHost ? '<button class="secondary-button compact-action" id="revealWatchTrivia" type="button">Reveal now</button>' : ''}</div>`}
    ${watchTrivia.revealed && isHost ? '<button class="secondary-button compact-action" id="nextWatchTrivia" type="button">Next question</button>' : ''}`
  $$('#watchTrivia [data-trivia-answer]').forEach(button => button.addEventListener('click', () => answerWatchTrivia(Number(button.dataset.triviaAnswer))))
  const reveal = $('#revealWatchTrivia'); if (reveal) reveal.addEventListener('click', revealWatchTrivia)
  const next = $('#nextWatchTrivia'); if (next) next.addEventListener('click', startWatchTrivia)
}

// ---- Screen share (real getDisplayMedia capture + WebRTC relay over the watch topic) ----
let shareStream = null
let screenShareRtc = null
let stoppingScreenShare = false
const RTC_CONFIG = {
  // A deployment can inject authenticated TURN servers as `PearCupIceServers`.
  // Public STUN keeps local/Pear peers working without ever shipping credentials.
  iceServers: Array.isArray(window.PearCupIceServers) && window.PearCupIceServers.length ? window.PearCupIceServers : [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
}
function ensureScreenShareRtc () {
  if (screenShareRtc) return screenShareRtc
  screenShareRtc = { peers: new Map(), polite: new Map() }
  return screenShareRtc
}
function closeScreenShareRtc () {
  if (!screenShareRtc) return
  screenShareRtc.peers.forEach(pc => { try { pc.close() } catch (e) {} })
  screenShareRtc.peers.clear()
  screenShareRtc.polite.clear()
  screenShareRtc = null
}
function selfPeerId () {
  return window.PearCupWatchSync && window.PearCupWatchSync._state && window.PearCupWatchSync._state.self
    ? window.PearCupWatchSync._state.self
    : state.username || 'me'
}
function isPolite (peerId) { return String(selfPeerId()) < String(peerId) }
function createPeerConnection (peerId, polite) {
  const pc = new RTCPeerConnection(RTC_CONFIG)
  const rtc = ensureScreenShareRtc()
  rtc.peers.set(peerId, pc)
  rtc.polite.set(peerId, polite)
  pc.onicecandidate = ev => {
    if (ev.candidate) {
      window.PearCupWatchSync.broadcastScreen({ t: 'screen:ice', to: peerId, candidate: ev.candidate.toJSON() })
    }
  }
  pc.ontrack = ev => {
    const video = $('#shareVideo')
    if (video && ev.streams && ev.streams[0]) {
      video.srcObject = ev.streams[0]
      // Local previews must be muted to prevent feedback; remote viewers must not.
      video.muted = false
      video.hidden = false
      video.play().catch(() => {})
    }
    const board = $('#tvLiveBoard'); if (board) board.style.opacity = '0'
    updateScreenShareBadge()
  }
  pc.onconnectionstatechange = () => {
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
      pc.close()
      rtc.peers.delete(peerId)
      updateScreenShareBadge()
    }
  }
  return pc
}
async function ensureLocalStreamTracksOnPc (pc) {
  if (!shareStream) return
  for (const track of shareStream.getTracks()) {
    const senders = pc.getSenders().filter(s => s.track && s.track.kind === track.kind)
    if (senders.length === 0) pc.addTrack(track, shareStream)
  }
}
async function startScreenShareToPeer (peerId) {
  if (!shareStream || !window.PearCupWatchSync) return
  const rtc = ensureScreenShareRtc()
  if (rtc.peers.has(peerId)) return
  const pc = createPeerConnection(peerId, isPolite(peerId))
  await ensureLocalStreamTracksOnPc(pc)
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  window.PearCupWatchSync.broadcastScreen({ t: 'screen:offer', to: peerId, sdp: pc.localDescription })
}
async function handleScreenOffer (m) {
  if (!window.PearCupWatchSync) return
  const rtc = ensureScreenShareRtc()
  const peerId = m.from
  const polite = isPolite(peerId)
  let pc = rtc.peers.get(peerId)
  if (!pc) pc = createPeerConnection(peerId, polite)
  const offerCollision = pc.signalingState !== 'stable'
  if (offerCollision && !polite) return
  if (offerCollision) await pc.setLocalDescription({ type: 'rollback' })
  await pc.setRemoteDescription(new RTCSessionDescription(m.sdp))
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  window.PearCupWatchSync.broadcastScreen({ t: 'screen:answer', to: peerId, sdp: pc.localDescription })
}
async function handleScreenAnswer (m) {
  const pc = screenShareRtc && screenShareRtc.peers.get(m.from)
  if (!pc) return
  await pc.setRemoteDescription(new RTCSessionDescription(m.sdp))
}
async function handleScreenIce (m) {
  const pc = screenShareRtc && screenShareRtc.peers.get(m.from)
  if (!pc) return
  try { await pc.addIceCandidate(new RTCIceCandidate(m.candidate)) } catch (e) {}
}
function updateScreenShareBadge () {
  const badge = $('#shareBadge')
  if (!badge) return
  const sharer = window.PearCupWatchSync && typeof window.PearCupWatchSync.screenShareState === 'function'
    ? window.PearCupWatchSync.screenShareState()
    : null
  const n = Math.max(0, realSpectatorCount() - 1)
  const rtcCount = screenShareRtc ? screenShareRtc.peers.size : 0
  if (shareStream) {
    const audio = shareStream.getAudioTracks().length ? ' · audio on' : ''
    badge.hidden = false
    badge.innerHTML = `<i></i>You are sharing your screen${audio} · ${n} peer${n === 1 ? '' : 's'} in room${rtcCount ? ` · ${rtcCount} relay connected` : ''}`
  } else if (sharer && sharer.sharing) {
    badge.hidden = false
    badge.innerHTML = `<i></i>${escapeHtml(sharer.sharerName || 'A watcher')} is sharing their screen`
  } else {
    badge.hidden = true
  }
}
function bindScreenShareSignaling () {
  if (!window.PearCupWatchSync || window.PearCupWatchSync._screenShareBound) return
  window.PearCupWatchSync._screenShareBound = true
  window.PearCupWatchSync.onScreenShare(m => {
    if (!m || !m.t) return
    if (m.to && m.to !== selfPeerId()) return
    switch (m.t) {
      case 'screen:start': updateScreenShareBadge(); break
      case 'screen:stop': closeScreenShareRtc(); updateScreenShareBadge(); break
      case 'screen:offer': handleScreenOffer(m); break
      case 'screen:answer': handleScreenAnswer(m); break
      case 'screen:ice': handleScreenIce(m); break
    }
  })
  window.PearCupWatchSync.onPeerJoined((peerId) => {
    if (shareStream) startScreenShareToPeer(peerId)
  })
}
async function startScreenShare () {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || typeof window.RTCPeerConnection !== 'function') {
    showToast('Screen share needs the Pear runtime / a supported browser')
    return
  }
  bindScreenShareSignaling()
  try {
    shareStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 30 } },
      audio: true,
      systemAudio: 'include',
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include'
    })
  } catch (err) {
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
    showToast(denied ? 'Screen share permission was not granted' : 'Screen share cancelled')
    return
  }
  const video = $('#shareVideo')
  if (video) { video.muted = true; video.srcObject = shareStream; video.hidden = false; video.play().catch(() => {}) }
  const board = $('#tvLiveBoard'); if (board) board.style.opacity = '0'
  const btn = $('#shareScreenBtn'); if (btn) btn.classList.add('is-live')
  showToast('Sharing your screen to the room')
  const track = shareStream.getVideoTracks()[0]
  if (track) track.addEventListener('ended', stopScreenShare)
  if (window.PearCupWatchSync) {
    window.PearCupWatchSync.broadcastScreen({ t: 'screen:start' })
    if (window.PearCupWatchSync._state && window.PearCupWatchSync._state.peers) {
      for (const peerId of window.PearCupWatchSync._state.peers.keys()) startScreenShareToPeer(peerId)
    }
  }
  updateScreenShareBadge()
}
function stopScreenShare () {
  if (stoppingScreenShare) return
  stoppingScreenShare = true
  if (shareStream) { shareStream.getTracks().forEach(t => t.stop()); shareStream = null }
  const video = $('#shareVideo'); if (video) { video.muted = true; video.hidden = true; video.srcObject = null }
  const board = $('#tvLiveBoard'); if (board) board.style.opacity = ''
  const btn = $('#shareScreenBtn'); if (btn) btn.classList.remove('is-live')
  if (window.PearCupWatchSync) window.PearCupWatchSync.broadcastScreen({ t: 'screen:stop' })
  closeScreenShareRtc()
  updateScreenShareBadge()
  stoppingScreenShare = false
}
function toggleScreenShare () { shareStream ? stopScreenShare() : startScreenShare() }

// ---- Share the room / spectate (real peer count from the watch room) ----
let spectatorTimer = null
function roomCode () {
  const st = feedState()
  const seed = hashString(`${st.home.teamId}-${st.away.teamId}-${state.username || 'host'}`)
  return `pear://pearcup/watch/${st.home.teamId}-${st.away.teamId}-${(seed % 100000).toString(36)}`
}
function realSpectatorCount () {
  if (window.PearCupWatchSync && typeof window.PearCupWatchSync.peerCount === 'function') {
    return window.PearCupWatchSync.peerCount()
  }
  return 1
}
function updateSpectatorCount () {
  const n = realSpectatorCount()
  state.spectators = n
  const el = $('#spectatorCount')
  if (el) el.textContent = `${n} peer${n === 1 ? '' : 's'} watching`
}
function toggleInviteBar () {
  const bar = $('#roomShareBar')
  if (!bar) return
  if (!bar.hidden) { bar.hidden = true; stopSpectatorSim(); return }
  const code = roomCode()
  state.spectators = realSpectatorCount()
  bar.hidden = false
  bar.innerHTML = `
    <div class="share-room-head"><strong>Watching together</strong><span id="spectatorCount">${state.spectators} peer${state.spectators === 1 ? '' : 's'} watching</span></div>
    <div class="share-room-link">
      <code id="roomLink">${escapeHtml(code)}</code>
      <button class="secondary-button compact-action" type="button" id="copyRoomLink">Copy invite</button>
    </div>
    <p class="share-room-note">Peers join over the Pear room topic — no server. Your Penalty Clash already broadcasts to spectators on the same swarm.</p>`
  const copy = $('#copyRoomLink')
  if (copy) copy.addEventListener('click', () => {
    if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {})
    showToast('Invite link copied')
  })
  // Real peers update via watch-sync heartbeat; keep the invite bar in sync.
  stopSpectatorSim()
  spectatorTimer = setInterval(updateSpectatorCount, 5000)
  updateSpectatorCount()
}
function startSpectatorSim () {
  stopSpectatorSim()
  spectatorTimer = setInterval(updateSpectatorCount, 5000)
  updateSpectatorCount()
}
function stopSpectatorSim () { if (spectatorTimer) { clearInterval(spectatorTimer); spectatorTimer = null } }

function bindWatchVoice () {
  const voice = window.PearCupWatchVoice
  if (!voice) {
    const button = $('#voiceToggle')
    if (button) button.classList.toggle('is-live', state.voice)
    return
  }
  if (!voice._appStateBound && typeof voice.onStateChange === 'function') {
    voice._appStateBound = true
    voice.onStateChange(next => {
      const enabled = Boolean(next && next.enabled)
      if (state.voice !== enabled) {
        state.voice = enabled
        persist()
      }
    })
  }
  if (typeof voice.bind === 'function') voice.bind()
  if (typeof voice.setEnabled === 'function') voice.setEnabled(Boolean(state.voice), { silent: true })
  if (typeof voice.render === 'function') voice.render()
}

function renderWatch () {
  startLiveFeed()
  seedFeedEvents()
  if (window.PearCupWatchSync) window.PearCupWatchSync.ensureRoom()
  renderPolymarketOdds()
  renderWatchStats(feedState())
  applyFeedTick(null, feedState())
  const room = watchParticipants()
  const live = feedState()
  const watchTeamIds = [
    watchTeamId(live && live.home, 'es'),
    watchTeamId(live && live.away, 'be')
  ]
  const grouped = watchTeamIds.map(teamId => {
    const picked = room.filter(person => person.pick === teamId)
    return { team: teamById(teamId), picked }
  })

  $('#watchPickBoard').innerHTML = `
    <p class="party-label"><span class="party-dot"></span>Watch party · ${room.length} on the couch</p>
    <div class="couches">
      ${grouped.map((group, gi) => `
        <div class="couch-group">
          <div class="couch-team">
            <span class="score-flag">${group.team.flag}</span>
            <strong>${escapeHtml(group.team.name)}</strong>
            <span>${group.picked.length} watching</span>
          </div>
          <div class="couch-scene">
            <div class="couch-seated">
              ${group.picked.map(person => `
                <span class="seated">
                  <span class="seated-av">${avatarSvg(person.name, group.team, true)}</span>
                  <em>${escapeHtml(person.name)}</em>
                </span>`).join('')}
            </div>
            <img class="couch-img" src="assets/${gi === 0 ? 'couch' : 'couch2'}.png" alt="">
          </div>
        </div>`).join('')}
    </div>
    <div class="watch-challenge-panel">
      <div class="watch-challenge-head">
        <p class="eyebrow">Penalty Clash</p>
        <strong>Challenge watchers</strong>
      </div>
      <div class="watch-challenge-list" id="watchChallengeList"></div>
    </div>`

  $('#languageTabs').innerHTML = WATCH_LANGS.map(language => `
    <button type="button" class="${language === state.language ? 'is-active' : ''}" data-language="${language}">
      ${language}
    </button>
  `).join('')

  $$('#languageTabs button').forEach(button => {
    button.addEventListener('click', () => {
      state.language = button.dataset.language
      persist()
      $$('#languageTabs button').forEach(b => b.classList.toggle('is-active', b === button))
      renderCommentaryFeed()
    })
  })

  renderCommentaryFeed()

  $('#chatFeed').innerHTML = state.chat.length
    ? state.chat.map(message => `
    <div class="chat-message">
      <time>${message.time}</time>
      <strong>${escapeHtml(message.user)}</strong>
      <p>${escapeHtml(message.text)}</p>
    </div>
  `).join('')
    : '<p class="chat-empty">Quiet in here — say something to the room! 💬</p>'

  // Join the shared watch room for this match (chat + reactions + presence sync).
  if (window.PearCupWatchSync) {
    window.PearCupWatchSync.ensureRoom()
    window.PearCupWatchSync.bindReactionBar()
    window.PearCupWatchSync.updatePresence()
    if (typeof window.PearCupWatchSync.renderChallengeList === 'function') window.PearCupWatchSync.renderChallengeList()
    bindTriviaSync()
  }
  bindWatchVoice()
  renderWatchTrivia()
}

function currentGameRound () {
  const opponent = currentOpponent()
  const zone = AIM_ZONES[state.gameRound % AIM_ZONES.length]
  return {
    shooter: state.username || 'captain',
    shooterTeam: state.team,
    keeper: opponent.name,
    keeperTeam: opponent.team,
    aim: zone,
    dive: AIM_ZONES[(state.gameRound + 2) % AIM_ZONES.length],
    power: 3,
    curve: 0,
    releaseTick: 42,
    keeperTick: 44
  }
}

function gameUserId (name) {
  return `user-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

async function resolvePenaltyRound (roundOverride) {
  const round = roundOverride || currentGameRound()
  const gameId = 'pc-brazil-norway-room'
  const roundIndex = state.gameRound
  const roundId = `pc-${roundIndex + 1}`
  const shooter = { id: gameUserId(round.shooter), username: round.shooter, teamId: round.shooterTeam }
  const keeper = { id: gameUserId(round.keeper), username: round.keeper, teamId: round.keeperTeam }
  const shooterInput = {
    role: 'shooter',
    aimZone: round.aim,
    powerBand: round.power,
    curveBand: round.curve,
    releaseTick: round.releaseTick
  }
  const keeperInput = {
    role: 'keeper',
    diveZone: round.dive,
    releaseTick: round.keeperTick
  }
  const expectedRound = PearCupCore.createPenaltyClashRound({
    gameId,
    roundIndex,
    shooter,
    keeper,
    shooterInput,
    keeperInput
  })
  const payoutRecipients = payoutRecipientForResolvedRound(round, expectedRound)
  const eventStore = PearCupStorageSim.createEventStore({
    backend: PearCupStorageSim.createMemoryBackend(),
    rootId: 'pearcup-demo',
    namespace: PearCupStorageSim.gameNamespace(gameId)
  })
  const worker = createPenaltySettlementWorker(eventStore)
  const settlementService = createUiSettlementService(worker)
  const tetherActor = integrationRuntime.readiness.tetherWdk.adapterId || 'tether-wdk'
  const qvacActor = integrationRuntime.readiness.qvac.adapterId || 'qvac-ref'
  const escrowEvent = await settlementService.createGameEscrow({
    gameId,
    players: [shooter.id, keeper.id],
    amount: 5,
    asset: 'USDT',
    rulesVersion: PearCupCore.resolverVersion
  }, {
    actorId: tetherActor
  })
  const shooterCommitment = PearCupCore.createCommitment({
    gameId,
    roundId,
    playerId: shooter.id,
    input: shooterInput,
    nonce: 'shooter-nonce'
  })
  const keeperCommitment = PearCupCore.createCommitment({
    gameId,
    roundId,
    playerId: keeper.id,
    input: keeperInput,
    nonce: 'keeper-nonce'
  })
  await worker.dispatchAsync({
    type: 'game:submitCommitment',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, commitment: shooterCommitment }
  })
  await worker.dispatchAsync({
    type: 'game:submitCommitment',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, commitment: keeperCommitment }
  })
  await worker.dispatchAsync({
    type: 'game:revealInput',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, input: shooterInput, nonce: 'shooter-nonce' }
  })
  await worker.dispatchAsync({
    type: 'game:revealInput',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, input: keeperInput, nonce: 'keeper-nonce' }
  })
  await worker.dispatchAsync({
    type: 'game:submitRoundStateHash',
    actorId: shooter.id,
    payload: {
      gameId,
      roundId,
      roundIndex,
      playerId: shooter.id,
      stateHash: expectedRound.stateHash,
      resolverVersion: expectedRound.resolverVersion
    }
  })
  await worker.dispatchAsync({
    type: 'game:submitRoundStateHash',
    actorId: keeper.id,
    payload: {
      gameId,
      roundId,
      roundIndex,
      playerId: keeper.id,
      stateHash: expectedRound.stateHash,
      resolverVersion: expectedRound.resolverVersion
    }
  })
  const settlementResult = await settlementService.settleGameRoundWithReceipt({
    gameId,
    roundIndex,
    roundId,
    shooter,
    keeper,
    escrowId: escrowEvent.payload.escrowId,
    qvacActorId: qvacActor,
    wdkActorId: tetherActor,
    payoutRecipients
  }, {
    actorId: 'settlement-worker',
    requireLive: integrationRuntime.canUseRealMoney
  })
  const settlementSummary = settlementResult.summary
  const serviceStatus = settlementService.status()
  await settlementService.close()
  if (typeof worker.refresh === 'function') await worker.refresh()
  const resolved = settlementSummary.roundEvent.payload
  const workerEvents = worker.events()
  const localView = worker.view()
  const storageSnapshot = eventStore.snapshot()
  let replayView = { eventRoot: localView.eventRoot }
  let replayEvents = workerEvents.length
  let replayMatched = true
  let externalWorkerStorage = worker.kind === 'bridge'
  if (!externalWorkerStorage) {
    const replayWorker = createPenaltySettlementWorker(eventStore)
    replayView = replayWorker.view()
    replayEvents = replayWorker.events().length
    replayMatched = replayView.eventRoot === localView.eventRoot
  }
  const heldReason = settlementSummary.settlementEvent && settlementSummary.settlementEvent.payload && settlementSummary.settlementEvent.payload.reason ||
    settlementSummary.roundEvent && settlementSummary.roundEvent.payload && settlementSummary.roundEvent.payload.reason ||
    settlementResult.receiptReason ||
    'Settlement held pending trusted evidence'
  const qvacAttestation = settlementSummary.attestationEvent && settlementSummary.attestationEvent.payload
    ? settlementSummary.attestationEvent.payload
    : {
        attestationId: 'pending-qvac-attestation',
        ruling: settlementSummary.status || 'held',
        rationale: heldReason,
        gameId,
        roundId,
        winnerUserId: null,
        participantUserIds: [shooter.id, keeper.id]
      }
  const tetherPayout = settlementSummary.settlementEvent && settlementSummary.settlementEvent.payload
    ? settlementSummary.settlementEvent.payload
    : {
        status: settlementSummary.status || 'held',
        reason: heldReason,
        gameId,
        roundId,
        escrowId: escrowEvent.payload.escrowId,
        disputeId: 'held-settlement',
        amount: escrowEvent.payload.amount,
        asset: escrowEvent.payload.asset
      }
  const topic = PearCupTransportSim.gameTopic(gameId)
  const topicBus = PearCupTransportSim.createTopicBus({ topic })
  topicBus.joinPeer('host', worker)
  topicBus.joinPeer('away')
  topicBus.joinPeer('spectator')
  const syncReport = await topicBus.syncAllAsync({ duplicates: true, outOfOrder: true })
  const syncRoots = syncReport.roots
  const spectatorRoot = syncRoots.find(peer => peer.peerId === 'spectator').root
  const spectatorEvents = syncRoots.find(peer => peer.peerId === 'spectator').events
  const mergedToSpectator = syncReport.reports
    .filter(report => report.to === 'spectator')
    .reduce((total, report) => total + report.merged, 0)

  return {
    ...resolved,
    ...round,
    aim: round.aim,
    dive: round.dive,
    power: round.power,
    curve: round.curve,
    qvacAttestation,
    tetherEscrow: escrowEvent.payload,
    tetherPayout,
    settlementSummary,
    settlementReceipt: settlementResult.receipt,
    settlementReceiptEvent: settlementResult.receiptEvent,
    existingReceipt: settlementResult.existingReceipt,
    settlementGate: serviceStatus.settlementGate,
    guardMode: serviceStatus.guardMode,
    runtime: integrationRuntime.readiness,
    canUseRealMoney: integrationRuntime.canUseRealMoney,
    workerEvents,
    sync: {
      topic,
      localRoot: localView.eventRoot,
      spectatorRoot,
      spectatorMerged: mergedToSpectator,
      spectatorEvents,
      matched: syncReport.converged,
      typeCounts: localView.typeCounts
    },
    storage: {
      namespace: externalWorkerStorage ? 'pearcup-worker-bridge' : storageSnapshot.namespace,
      key: externalWorkerStorage ? 'pearcup-worker-v1' : storageSnapshot.key,
      backend: externalWorkerStorage ? 'pear-worker-bridge' : storageSnapshot.backend,
      external: externalWorkerStorage,
      persistedEvents: externalWorkerStorage ? workerEvents.length : storageSnapshot.events,
      eventRoot: externalWorkerStorage ? localView.eventRoot : storageSnapshot.eventRoot,
      replayRoot: replayView.eventRoot,
      replayEvents,
      replayMatched
    }
  }
}

// Ball/keeper target for an aim zone, as a % of the penalty stage. Derived from the
// actual aim-grid cell so the ball always lands INSIDE the goal mouth (the grid and
// goal frame share the same rect) — fixes "goal" balls flying wide/under the net.
function zonePosition (zone) {
  const stage = document.querySelector('#penaltyStage')
  const cell = document.querySelector(`.aim-zone[data-zone="${zone}"]`)
  if (stage && cell) {
    const s = stage.getBoundingClientRect()
    const c = cell.getBoundingClientRect()
    if (s.width > 0 && s.height > 0 && c.width > 0) {
      return {
        x: Math.round(((c.left + c.width / 2 - s.left) / s.width) * 1000) / 10,
        y: Math.round(((c.top + c.height / 2 - s.top) / s.height) * 1000) / 10
      }
    }
  }
  // Fallback before the grid is laid out — tuned to sit inside the goal frame.
  const [side, height] = zone.split('-')
  const x = side === 'left' ? 30 : side === 'right' ? 70 : 50
  const y = height === 'high' ? 22 : 40
  return { x, y }
}

// Just above the crossbar — where an over-hit ball should sail.
function overBarY () {
  const stage = document.querySelector('#penaltyStage')
  const frame = document.querySelector('#penaltyStage .goal-frame')
  if (stage && frame) {
    const s = stage.getBoundingClientRect(), f = frame.getBoundingClientRect()
    if (s.height > 0) return Math.max(1, Math.round(((f.top - s.top) / s.height) * 1000) / 10 - 4)
  }
  return 4
}

// ---------------- Interactive Penalty Shootout ----------------
const SHOOTOUT_TOTAL = 5
const AIM_ZONES = ['left-high', 'center-high', 'right-high', 'left-low', 'center-low', 'right-low']
// Solo practice is explicitly a system trainer, never a fabricated player or wager.
function trainingOpponent () {
  const team = teams.find(candidate => candidate.id !== state.team) || teams[0]
  return { name: 'QVAC training keeper', team: team.id, record: '0-0', stake: 0, system: true }
}

// The keeper for the whole shootout is a real matched peer, or the named training system.
function currentOpponent () {
  if (state.match && state.match.opponent) return state.match.opponent
  return trainingOpponent()
}

function sleep (ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

function ensureShootout (reset) {
  if (reset || !state.shootout || state.shootout.you === undefined) {
    // Alternating shootout: each round you SHOOT then you KEEP the opponent's shot.
    state.shootout = { round: 0, mode: 'shoot', you: 0, opp: 0, youDots: [], oppDots: [], phase: 'aim', busy: false, lastResult: null }
  }
  return state.shootout
}

function powerToBand (pct) { return pct < 40 ? 1 : pct < 62 ? 2 : pct < 85 ? 3 : 4 }

// ---- Kick outcome model (shared by AI matches and peer matches) ----
// Deterministic: outcome is a pure function of (aim, dive, power, entropy). In peer
// matches the entropy comes from hash(aim|dive|nonce) with the shooter's revealed
// nonce, so BOTH clients derive the identical result — no trust, no desync.
// Feel: aim is the core read (wrong-way keeper = goal), power is risk/reward —
//   soft  (<66)   safe but an easy save if the keeper guesses right
//   sweet (66-86) matches the striped meter zone; corners still sneak through
//   blast (>=86)  can burst through a matched dive… but >=92 on a HIGH aim
//                 risks ballooning it over the bar.
function kickOutcome (aim, dive, powerPct, entropy) {
  const e = entropy % 100                     // over-the-bar roll
  const e2 = Math.floor(entropy / 100) % 100  // independent burst/sneak roll
  const high = aim.indexOf('high') !== -1
  const matched = dive === aim
  if (powerPct >= 92 && high && e < 45) return 'post'
  if (!matched) return 'goal'
  if (powerPct >= 86) return e2 < 45 ? 'goal' : 'save'
  if (powerPct >= 66) return e2 < 18 ? 'goal' : 'save'
  return 'save'
}

function kickEntropy (aim, dive, nonce) {
  const s = `${aim}|${dive}|${nonce}`
  const h = (window.PearCupPeerNet && window.PearCupPeerNet.digest) ? parseInt(window.PearCupPeerNet.digest(s), 16) : hashString(s)
  return h >>> 0
}

// The system trainer has a fixed, modest difficulty; real peers never use this model.
function opponentDifficulty (pick) {
  const rec = pick && pick.record
  if (!rec) return 0.34
  const parts = String(rec).split('-').map(Number)
  const w = parts[0]; const l = parts[1]
  if (!(w >= 0) || !(l >= 0) || w + l === 0) return 0.34
  return 0.25 + 0.35 * (w / (w + l))
}

function aiKeeperDive (aim, matchP = 0.34) {
  if (Math.random() < matchP) return aim
  const options = AIM_ZONES.filter(zone => zone !== aim)
  return options[Math.floor(Math.random() * options.length)]
}

function buildKickRound (aim, powerPct) {
  const pick = currentOpponent()
  const dive = aiKeeperDive(aim, opponentDifficulty(pick))
  const nonce = `${(Math.random() * 1e9 | 0).toString(36)}${(Math.random() * 1e9 | 0).toString(36)}`
  const outcome = kickOutcome(aim, dive, powerPct, kickEntropy(aim, dive, nonce))
  // Shape the commit-reveal resolver inputs so the QVAC settlement reproduces this
  // exact outcome (resolver: save if matched && gap<=2, post if band4+curve2+high):
  //   save         → matched dive, on time (gap 1)
  //   matched goal → keeper got a hand but was late (gap 3)
  //   post         → overcooked (band 4, curve 2) — only reachable on high aims
  const over = outcome === 'post'
  return {
    shooter: state.username || 'captain',
    shooterTeam: state.team,
    keeper: pick.name,
    keeperTeam: pick.team,
    aim,
    dive,
    power: over ? 4 : powerToBand(powerPct),
    curve: over ? 2 : 0,
    releaseTick: 42,
    keeperTick: outcome === 'save' ? 43 : dive === aim ? 45 : 47,
    plannedOutcome: outcome
  }
}

function payoutRecipientForResolvedRound (round, resolved) {
  if (!round) return {}
  const resolvedWinner = resolved && PearCupCore.winnerUserIdForRoundResult
    ? PearCupCore.winnerUserIdForRoundResult(resolved)
    : null
  const outcome = resolved && resolved.outcome || round.plannedOutcome
  const winnerId = resolvedWinner || (outcome === 'goal'
    ? gameUserId(round.shooter)
    : gameUserId(round.keeper))
  if (!winnerId) return {}
  return { [winnerId]: demoPayoutAddress(winnerId) }
}

function readPowerPct () {
  const fill = $('#shootPowerFill')
  const track = $('#shootPowerTrack')
  if (!fill || !track) return 60
  const w = fill.getBoundingClientRect().width
  const t = track.getBoundingClientRect().width || 1
  return Math.max(4, Math.min(100, Math.round((w / t) * 100)))
}

function setScoreboard (sName, sTeam, kName, kTeam, top, mid, sub) {
  $('#gameScoreboard').innerHTML = `
    <div class="game-player-card">
      ${avatarSvg(sName, sTeam, true)}
      <div><span>Shooter</span><strong>${escapeHtml(sName)}</strong><em>${sTeam.flag} ${escapeHtml(sTeam.name)}</em></div>
    </div>
    <div class="game-score-core">
      <span>${escapeHtml(top)}</span><strong>${escapeHtml(mid)}</strong><em>${escapeHtml(sub)}</em>
    </div>
    <div class="game-player-card is-away">
      ${avatarSvg(kName, kTeam, true)}
      <div><span>Keeper</span><strong>${escapeHtml(kName)}</strong><em>${kTeam.flag} ${escapeHtml(kTeam.name)}</em></div>
    </div>`
}

function ensureShootoutDom () {
  const stage = $('#penaltyStage')
  if (!stage) return
  if (!$('#shootoutHud')) {
    stage.insertAdjacentHTML('beforebegin', `
      <div class="shootout-hud" id="shootoutHud">
        <div class="hud-side">
          <span class="hud-side-name">You</span>
          <div class="hud-dots" id="hudDotsYou"></div>
        </div>
        <div class="hud-core">
          <strong class="hud-score-num" id="hudYou">0</strong>
          <span class="hud-round" id="hudKick">Round 1 of ${SHOOTOUT_TOTAL}</span>
          <strong class="hud-score-num is-opp" id="hudOpp">0</strong>
        </div>
        <div class="hud-side is-away">
          <span class="hud-side-name" id="hudOppName">Rival</span>
          <div class="hud-dots" id="hudDotsOpp"></div>
        </div>
      </div>`)
  }
  if (!$('#aimGrid')) {
    stage.insertAdjacentHTML('beforeend', `
      <div class="aim-grid" id="aimGrid" aria-label="Pick where to shoot">
        ${AIM_ZONES.map(zone => `<button class="aim-zone" type="button" data-zone="${zone}" aria-label="Aim ${zone.replace('-', ' ')}"><span></span></button>`).join('')}
      </div>
      <div class="power-dock" id="powerDock">
        <span class="power-label">Power &amp; timing — click a corner to shoot</span>
        <div class="power-track" id="shootPowerTrack"><i class="power-fill" id="shootPowerFill"></i><b class="power-sweet"></b></div>
      </div>
      <div class="confetti-burst" id="confettiBurst" aria-hidden="true"></div>
      <div class="shoot-banner" id="shootBanner" aria-live="polite"></div>
      <div class="shootout-over" id="shootoutOver" hidden>
        <div class="shootout-over-card">
          <img class="over-trophy" id="overTrophy" src="assets/trophy.png" alt="" hidden>
          <p class="over-title" id="overTitle"></p>
          <p class="over-score" id="overScore"></p>
          <p class="over-prize" id="overPrize"></p>
          <div class="over-actions">
            <button class="secondary-button" id="backToLobby" type="button">Back to lobby</button>
            <button class="primary-button" id="playAgain" type="button">Rematch</button>
          </div>
        </div>
      </div>`)
  }
  const actions = $('.game-actions')
  if (actions && !$('#leaveGameToLobby')) {
    const lobby = document.createElement('button')
    lobby.className = 'secondary-button'
    lobby.id = 'leaveGameToLobby'
    lobby.type = 'button'
    lobby.innerHTML = `
      <span class="button-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-5h-4v5H5a1 1 0 0 1-1-1Z"/></svg>
      </span>
      Lobby`
    actions.insertBefore(lobby, actions.firstChild)
  }
  const grid = $('#aimGrid')
  if (grid && !grid.dataset.bound) {
    grid.dataset.bound = '1'
    grid.addEventListener('click', event => {
      const zone = event.target.closest('.aim-zone')
      if (!zone) return
      if (window.PearCupPeerMatch && window.PearCupPeerMatch.isActive()) window.PearCupPeerMatch.onZone(zone.dataset.zone)
      else takeKick(zone.dataset.zone)
    })
  }
  const again = $('#playAgain')
  if (again && !again.dataset.bound) {
    again.dataset.bound = '1'
    again.addEventListener('click', () => {
      restartShootout({ message: '' })
    })
  }
  const back = $('#backToLobby')
  if (back && !back.dataset.bound) { back.dataset.bound = '1'; back.addEventListener('click', leaveMatch) }
  const lobby = $('#leaveGameToLobby')
  if (lobby && !lobby.dataset.bound) { lobby.dataset.bound = '1'; lobby.addEventListener('click', leaveMatch) }
  ;[['#advanceGameRound', 'Random kick'], ['#spectateGame', 'Rematch']].forEach(([sel, label]) => {
    const btn = $(sel)
    if (btn && !btn.dataset.relabel) {
      btn.dataset.relabel = '1'
      const textNode = Array.from(btn.childNodes).find(node => node.nodeType === 3 && node.textContent.trim())
      if (textNode) textNode.textContent = label
      else btn.append(label)
    }
  })
}

function renderShootoutHud () {
  const so = state.shootout
  const over = so.round >= SHOOTOUT_TOTAL
  if ($('#hudKick')) $('#hudKick').textContent = over ? 'Full time' : `Round ${Math.min(so.round + 1, SHOOTOUT_TOTAL)} of ${SHOOTOUT_TOTAL}`
  if ($('#hudYou')) $('#hudYou').textContent = String(so.you)
  if ($('#hudOpp')) $('#hudOpp').textContent = String(so.opp)
  if ($('#hudOppName')) $('#hudOppName').textContent = currentOpponent().name
  // Your shots: goal = green, miss = pink. Active if it's your turn to shoot this round.
  if ($('#hudDotsYou')) {
    $('#hudDotsYou').innerHTML = Array.from({ length: SHOOTOUT_TOTAL }, (_, i) => {
      const r = so.youDots[i]
      const cls = r === 'goal' ? 'is-goal' : r === 'miss' ? 'is-miss' : (!over && i === so.round && so.mode === 'shoot' ? 'is-next' : '')
      return `<i class="hud-dot ${cls}"></i>`
    }).join('')
  }
  // Their shots from your keeper POV: save (you stopped it) = green, goal (they scored) = pink.
  if ($('#hudDotsOpp')) {
    $('#hudDotsOpp').innerHTML = Array.from({ length: SHOOTOUT_TOTAL }, (_, i) => {
      const r = so.oppDots[i]
      const cls = r === 'save' ? 'is-goal' : r === 'goal' ? 'is-miss' : (!over && i === so.round && so.mode === 'keep' ? 'is-next' : '')
      return `<i class="hud-dot ${cls}"></i>`
    }).join('')
  }
}

function showAimGrid () { const g = $('#aimGrid'); if (g) g.classList.add('is-live') }
function hideAimGrid () { const g = $('#aimGrid'); if (g) g.classList.remove('is-live') }
function startPowerMeter () { const f = $('#shootPowerFill'); if (f) f.classList.add('is-live') }
function stopPowerMeter () { const f = $('#shootPowerFill'); if (f) f.classList.remove('is-live') }
function hideOverlay () { const o = $('#shootoutOver'); if (o) o.hidden = true }
function showShootBanner (label, tone) {
  const b = $('#shootBanner')
  if (!b) return
  b.textContent = label
  b.className = `shoot-banner is-show ${tone}`
}
function hideShootBanner () { const b = $('#shootBanner'); if (b) b.className = 'shoot-banner' }
function fireConfetti () {
  const el = $('#confettiBurst')
  if (!el) return
  el.classList.remove('is-on')
  void el.offsetWidth
  el.classList.add('is-on')
}

function startAimPhase () {
  const so = ensureShootout()
  if (so.round >= SHOOTOUT_TOTAL) return
  so.phase = 'aim'
  const opp = currentOpponent()
  const you = { name: state.username || 'captain', team: state.team }
  const isShoot = so.mode === 'shoot'
  // In shoot mode you are the shooter (bottom) and the rival keeps (top).
  // In keep mode the rival shoots (bottom) and YOU are the keeper (top).
  const shooterP = isShoot ? you : { name: opp.name, team: opp.team }
  const keeperP = isShoot ? { name: opp.name, team: opp.team } : you
  const sTeam = teamById(shooterP.team)
  const kTeam = teamById(keeperP.team)
  const ball = $('#gameBall')
  const keeper = $('#gameKeeper')
  const shooter = $('#gameShooter')
  if (shooter) shooter.innerHTML = avatarSvg(shooterP.name, sTeam)
  if (shooter) shooter.classList.remove('lean-left', 'lean-right', 'lean-center')
  if (keeper) { keeper.innerHTML = avatarSvg(keeperP.name, kTeam); keeper.style.left = '50%'; keeper.classList.remove('dive-left', 'dive-right', 'dive-mid') }
  if (ball) { ball.classList.remove('is-kicking'); ball.style.left = '50%'; ball.style.top = '80%' }
  if (!isShoot) {
    // Keeper turn vs AI: the striker decides NOW and telegraphs it in the run-up.
    // Better strikers disguise the lean more often (a feint points the wrong way).
    const diff = opponentDifficulty(opp)
    so.aiAim = AIM_ZONES[Math.floor(Math.random() * AIM_ZONES.length)]
    so.aiPower = Math.round(55 + diff * 45)
    const feint = Math.random() < (0.12 + 0.35 * diff)
    const side = z => z.indexOf('left') !== -1 ? 'left' : z.indexOf('right') !== -1 ? 'right' : 'center'
    const flip = { left: 'right', right: 'left', center: Math.random() < 0.5 ? 'left' : 'right' }
    const tell = feint ? flip[side(so.aiAim)] : side(so.aiAim)
    if (shooter) setTimeout(() => shooter.classList.add(`lean-${tell}`), 650)
  }
  setScoreboard(shooterP.name, sTeam, keeperP.name, kTeam,
    `Round ${so.round + 1} of ${SHOOTOUT_TOTAL}`,
    isShoot ? 'Your shot' : `${opp.name} shoots`,
    isShoot ? 'Pick a corner' : 'Dive to save!')
  const dock = $('#powerDock')
  if (dock) {
    dock.classList.toggle('is-keep', !isShoot)
    const label = dock.querySelector('.power-label')
    if (label) label.innerHTML = isShoot ? 'Power — sweet spot is safe, full blast can burst through… or balloon over' : 'Watch the run-up — the striker leans before the strike (don\'t trust every lean)'
  }
  hideShootBanner()
  showAimGrid()
  if (isShoot) startPowerMeter(); else stopPowerMeter()
  renderShootoutHud()
}

async function takeKick (zone) {
  const so = state.shootout
  if (!so || so.busy || so.phase !== 'aim') return
  so.busy = true
  so.phase = 'shooting'
  hideAimGrid()
  const isShoot = so.mode === 'shoot'
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  let good = false
  let label = ''
  let tone = 'is-stop'
  let result = null

  if (isShoot) {
    // You shoot; the rival keeper (top) dives.
    const powerPct = readPowerPct()
    stopPowerMeter()
    const round = buildKickRound(zone, powerPct)
    const aimPos = zonePosition(zone)
    const divePos = zonePosition(round.dive)
    requestAnimationFrame(() => {
      if (keeperEl) {
        keeperEl.style.left = `${divePos.x}%`
        keeperEl.classList.add(divePos.x < 50 ? 'dive-left' : divePos.x > 50 ? 'dive-right' : 'dive-mid')
      }
    })
    try {
      result = await resolvePenaltyRound(round)
    } catch (err) {
      console.warn('penalty settlement failed', err)
      renderSettlementError($('#gameResolver'), err, 'Penalty settlement blocked')
      showToast('Settlement evidence blocked — check resolver panel')
      result = null
    }
    const outcome = result ? result.outcome : round.plannedOutcome
    // The resolver inputs were shaped to reproduce plannedOutcome — flag drift loudly.
    if (result && result.outcome !== round.plannedOutcome) console.warn('kick outcome drift', { planned: round.plannedOutcome, settled: result.outcome, round })
    let bx = aimPos.x, by = aimPos.y
    if (outcome === 'post') by = overBarY()
    if (outcome === 'save') { bx = divePos.x; by = Math.min(aimPos.y, divePos.y) }
    if (ballEl) { ballEl.classList.add('is-kicking'); requestAnimationFrame(() => { ballEl.style.left = `${bx}%`; ballEl.style.top = `${by}%` }) }
    await sleep(720)
    good = outcome === 'goal'
    label = good ? 'GOAL!' : outcome === 'save' ? 'SAVED!' : 'OVER!'
    if (good) so.you += 1
    so.youDots.push(good ? 'goal' : 'miss')
    so.lastResult = result
    if (result) applyKickResult(result)
  } else {
    // Rival shoots; YOU are the keeper (top) — `zone` is where you dive. The AI's aim
    // and power were decided at the start of the run-up (see startAimPhase telegraph),
    // and the SAME kickOutcome model applies: your correct read can still be burst
    // through by a blast, and blasted high shots can balloon over.
    const aiAim = so.aiAim || AIM_ZONES[Math.floor(Math.random() * AIM_ZONES.length)]
    const aiPower = so.aiPower || 70
    const nonce = `${(Math.random() * 1e9 | 0).toString(36)}`
    const outcome = kickOutcome(aiAim, zone, aiPower, kickEntropy(aiAim, zone, nonce))
    const aimPos = zonePosition(aiAim)
    const divePos = zonePosition(zone)
    requestAnimationFrame(() => {
      if (keeperEl) {
        keeperEl.style.left = `${divePos.x}%`
        keeperEl.classList.add(divePos.x < 50 ? 'dive-left' : divePos.x > 50 ? 'dive-right' : 'dive-mid')
      }
    })
    let bx = aimPos.x, by = aimPos.y
    if (outcome === 'post') by = overBarY()
    if (outcome === 'save') { bx = divePos.x; by = Math.min(aimPos.y, divePos.y) }
    if (ballEl) { ballEl.classList.add('is-kicking'); requestAnimationFrame(() => { ballEl.style.left = `${bx}%`; ballEl.style.top = `${by}%` }) }
    await sleep(720)
    good = outcome !== 'goal' // save or over-the-bar both go your way
    label = outcome === 'save' ? 'SAVED!' : outcome === 'post' ? 'OVER THE BAR!' : 'GOAL!'
    if (outcome === 'goal') so.opp += 1
    so.oppDots.push(outcome === 'goal' ? 'goal' : 'save')
  }

  showShootBanner(label, good ? 'is-goal' : 'is-stop')
  if (good) fireConfetti()
  renderShootoutHud()
  showToast(result ? `QVAC ref sealed ${result.outcome} · ${String(result.stateHash).slice(0, 10)}` : label)
  await sleep(1150)
  hideShootBanner()
  if (ballEl) ballEl.classList.remove('is-kicking')
  if (keeperEl) keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid')
  so.busy = false
  // Advance: shoot -> keep (same round); keep -> next round, back to shoot.
  if (so.mode === 'shoot') so.mode = 'keep'
  else { so.mode = 'shoot'; so.round += 1 }
  if (so.round >= SHOOTOUT_TOTAL && so.mode === 'shoot') endShootout()
  else startAimPhase()
}

function endShootout () {
  const so = state.shootout
  so.phase = 'over'
  hideAimGrid()
  stopPowerMeter()
  const pick = currentOpponent()
  const win = so.you > so.opp
  const draw = so.you === so.opp
  const title = $('#overTitle')
  const score = $('#overScore')
  const overlay = $('#shootoutOver')
  const stake = state.match && state.match.stake || 0
  const prizeEl = $('#overPrize')
  if (win && stake > 0) {
    const prize = stake * 2
    state.wallet.balance += prize
    walletLog(`Won penalty match vs ${pick.name}`, prize, 'credit')
    persist(); refreshWallet()
    if (prizeEl) { prizeEl.textContent = `+ ${fmtMoney(prize)} won 💰`; prizeEl.className = 'over-prize is-win' }
  } else if (draw && stake > 0) {
    state.wallet.balance += stake
    walletLog(`Penalty match drawn vs ${pick.name} — stake refunded`, stake, 'credit')
    persist(); refreshWallet()
    if (prizeEl) { prizeEl.textContent = `${fmtMoney(stake)} stake refunded`; prizeEl.className = 'over-prize' }
  } else if (prizeEl) {
    prizeEl.textContent = stake > 0 ? `− ${fmtMoney(stake)} staked` : ''
    prizeEl.className = 'over-prize'
  }
  if (title) { title.textContent = win ? 'You win! 🎉' : draw ? 'Dead level!' : 'So close!'; title.className = 'over-title ' + (win ? 'is-win' : 'is-lose') }
  if (score) score.textContent = `You ${so.you} – ${so.opp} ${pick.name}`
  const trophy = $('#overTrophy'); if (trophy) trophy.hidden = !win
  if (win) fireConfetti()
  if (overlay) overlay.hidden = false
  setScoreboard(state.username || 'captain', teamById(state.team), pick.name, teamById(pick.team), 'Shootout', win ? 'WINNER' : draw ? 'DRAW' : 'DEFEAT', `You ${so.you} – ${so.opp}`)
  showToast(win ? `You beat ${pick.name} ${so.you}–${so.opp}!` : draw ? `Level with ${pick.name} ${so.you}–${so.opp}` : `${pick.name} won ${so.opp}–${so.you}`)
}

function liveGamePlayers () {
  const peers = window.PearCupLobby && window.PearCupLobby._state && window.PearCupLobby._state.peers
  const remote = peers && typeof peers.values === 'function' ? [...peers.values()] : []
  const self = { peerId: state.playerId, name: state.username || 'captain', team: state.team, you: true }
  const matchPeer = state.match && state.match.peer && state.match.opponent
    ? [{ peerId: 'current-match', name: state.match.opponent.name, team: state.match.opponent.team }]
    : []
  const all = [self, ...matchPeer, ...remote]
  return all.filter((player, index) => all.findIndex(candidate => candidate.peerId === player.peerId || (candidate.name === player.name && candidate.team === player.team)) === index).slice(0, 6)
}

function gameLeaderboardMarkup () {
  const players = liveGamePlayers()
  return `
    <div class="rail-header">
      <p class="eyebrow">Games</p>
      <strong>Live players</strong>
    </div>
    <div class="leader-list">
      ${players.length ? players.map((player, index) => `
        <div class="game-leader-row">
          <span class="leader-rank">${index + 1}</span>
          ${avatarSvg(player.name, teamById(player.team), true)}
          <div>
            <strong>${escapeHtml(player.you ? 'You' : player.name)}</strong>
            <span>${teamById(player.team).flag} ${escapeHtml(teamById(player.team).name)}</span>
          </div>
          <em>${player.you ? 'ready' : 'live'}</em>
        </div>
      `).join('') : '<p class="live-copy">No live players yet — invite a friend to play.</p>'}
    </div>`
}

function renderGameLeaderboard () {
  $('#gameLeaderboard').innerHTML = gameLeaderboardMarkup()
}

function renderGamePlaceholders () {
  const ph = (title, sub) => `<div class="rail-header"><p class="eyebrow">${title}</p><strong>${sub}</strong></div><p class="live-copy">Take a kick to generate a QVAC-signed, WDK-escrowed settlement.</p>`
  $('#gameResolver').innerHTML = ph('Resolver', 'Awaiting kick')
  $('#gameSync').innerHTML = ph('P2P sync', 'Idle')
  $('#gameReplay').innerHTML = ph('Replay log', '0 events')
  $('#runtimePanel').innerHTML = ph('Runtime', 'Ready')
  $('#tetherPanel').innerHTML = ph('Tether WDK', 'Escrow ready')
  $('#qvacRefPanel').innerHTML = ph('QVAC', 'Referee standby')
  renderGameLeaderboard()
}

function peerBackendInfo () {
  const backend = document.documentElement.dataset.pearcupPeerNet || ''
  if (backend === 'hiverelay-outboxlog-v2') return { label: 'HiveRelay live sync', tone: 'is-online' }
  if (backend === 'pearbrowser-swarm-v1') return { label: 'P2P PearBrowser swarm', tone: 'is-online' }
  if (backend === 'hyperswarm') return { label: 'P2P Pear runtime', tone: 'is-online' }
  if (backend === 'broadcast-channel') return { label: 'Local preview P2P', tone: 'is-preview' }
  if (backend === 'noop') return { label: 'P2P unavailable', tone: 'is-offline' }
  return { label: 'P2P starting', tone: 'is-preview' }
}

function renderPeerBackendBadge () {
  const el = $('#p2pBackendBadge')
  if (!el) return
  const info = peerBackendInfo()
  el.textContent = info.label
  el.className = `p2p-backend-pill ${info.tone}`
}

function pendingFriendJoinCode () {
  const override = typeof window !== 'undefined' && window.__pearcupPendingJoinOverride
  if (override) return String(override).trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
  try {
    const raw = new URLSearchParams(location.search).get('join') || ''
    return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
  } catch (e) {
    return ''
  }
}

function friendJoinCodeFromLink (value, depth = 0) {
  if (!value) return ''
  if (depth > 5) return ''
  if (Array.isArray(value)) {
    for (const item of value) {
      const fromItem = friendJoinCodeFromLink(item, depth + 1)
      if (fromItem) return fromItem
    }
    return ''
  }
  if (typeof value === 'object') {
    for (const key of ['link', 'url', 'href', 'query', 'linkData', 'data', 'payload', 'args']) {
      if (value[key] == null) continue
      if (key === 'query' && typeof value.query === 'object') {
        const queryValue = value.query.join || value.query.get && value.query.get('join')
        if (queryValue) return String(queryValue).trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
      }
      const nested = friendJoinCodeFromLink(value[key], depth + 1)
      if (nested) return nested
    }
    return ''
  }
  const raw = String(value).trim()
  if (!raw) return ''
  try {
    const parsed = raw.startsWith('?')
      ? new URL(`pear://pearcup/${raw}`)
      : new URL(raw, typeof location !== 'undefined' ? location.href : 'pear://pearcup/')
    return (parsed.searchParams.get('join') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
  } catch (e) {
    const match = raw.match(/(?:^|[?&])join=([^&#]+)/i)
    return match ? decodeURIComponent(match[1]).trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) : ''
  }
}

function reportPearWakeup (code, status, detail = '') {
  if (typeof sendBootProbeEvent !== 'function' || !code) return
  const peerState = window.PearCupPeerMatch && window.PearCupPeerMatch._state
  sendBootProbeEvent({
    event: 'pearcup:deep-link',
    status,
    code,
    detail,
    backend: document.documentElement.dataset.pearcupPeerNet || null,
    backendStatus: document.documentElement.dataset.pearcupPeerNetStatus || null,
    backendDetail: document.documentElement.dataset.pearcupPeerNetDetail || null,
    active: Boolean(peerState && peerState.active),
    started: Boolean(peerState && peerState.started),
    peerMatchState: document.documentElement.dataset.pearcupPeerMatchState || null,
    channelBackend: document.documentElement.dataset.pearcupPeerMatchChannelBackend || null
  })
}

if (typeof window !== 'undefined') {
  window.PearCupOnPeerMatchState = snapshot => {
    const code = String(snapshot && snapshot.code || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
    if (!code || !snapshot.started || snapshot.state !== 'started') return
    const pending = String(document.documentElement.dataset.pearcupPendingJoin || pendingFriendJoinCode() || '').trim().toLowerCase()
    if (pending !== code || window.__pearcupReportedStartedCode === code) return
    window.__pearcupReportedStartedCode = code
    reportPearWakeup(code, 'started')
  }
}

function applyPearFriendWakeup (code) {
  const safeCode = String(code || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
  if (!safeCode) return false
  try {
    const url = new URL(location.href)
    url.searchParams.set('join', safeCode)
    if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }
  } catch (e) {}
  window.__pearcupPendingJoinOverride = safeCode
  document.documentElement.dataset.pearcupPendingJoin = safeCode
  const joined = tryJoinFriendInvite()
  reportPearWakeup(safeCode, joined ? 'joining' : 'queued')
  if (joined && typeof setTimeout === 'function') {
    const startedAt = Date.now()
    const poll = () => {
      const peerState = window.PearCupPeerMatch && window.PearCupPeerMatch._state
      if (peerState && peerState.code === safeCode && peerState.started) {
        reportPearWakeup(safeCode, 'started')
        return
      }
      if (Date.now() - startedAt < 8_000) setTimeout(poll, 120)
    }
    setTimeout(poll, 120)
  }
  return joined
}

function bindPearWakeups () {
  const pearApi = typeof window !== 'undefined' && window.Pear
  if (!pearApi || typeof pearApi.wakeups !== 'function' || window.__pearcupWakeupsBound) {
    if (typeof sendBootProbeEvent === 'function') sendBootProbeEvent({
      event: 'pearcup:wakeup-listener',
      status: pearApi && typeof pearApi.wakeups === 'function' ? 'already-bound' : 'unavailable'
    })
    return
  }
  window.__pearcupWakeupsBound = true
  try {
    const stream = pearApi.wakeups(wakeup => {
      const code = friendJoinCodeFromLink(wakeup)
      if (typeof sendBootProbeEvent === 'function') sendBootProbeEvent({
        event: 'pearcup:wakeup-received',
        status: code ? 'parsed' : 'ignored',
        code: code || null,
        keys: wakeup && typeof wakeup === 'object' ? Object.keys(wakeup).slice(0, 12) : []
      })
      if (code) applyPearFriendWakeup(code)
    })
    window.__pearcupWakeupStream = stream || null
    sendBootProbeEvent({ event: 'pearcup:wakeup-listener', status: 'bound' })

    // Pear's migration path exposes launch arguments on Pear.app.args. Some
    // desktop shells deliver a protocol click there instead of through the
    // wakeup message stream, so consume both surfaces during first boot.
    const initialCode = friendJoinCodeFromLink(pearApi.app && pearApi.app.args)
    if (initialCode && typeof setTimeout === 'function') {
      setTimeout(() => applyPearFriendWakeup(initialCode), 0)
    }
  } catch (e) {
    window.__pearcupWakeupsBound = false
    sendBootProbeEvent({ event: 'pearcup:wakeup-listener', status: 'error', detail: e && e.message ? e.message : String(e) })
  }
}

function tryJoinFriendInvite (attempt = 0) {
  const code = pendingFriendJoinCode()
  if (!code) return false
  document.documentElement.dataset.pearcupPendingJoin = code
  const peerMatch = window.PearCupPeerMatch
  const matchState = peerMatch && peerMatch._state
  if (matchState && matchState.active && matchState.code === code) {
    document.documentElement.dataset.pearcupJoinState = matchState.started ? 'started' : 'joining'
    setView('games')
    return true
  }
  if (peerMatch && typeof peerMatch.join === 'function') {
    document.documentElement.dataset.pearcupJoinState = 'joining'
    setView('games')
    peerMatch.join(code)
    return true
  }
  if (attempt < 6) {
    const retryMs = [0, 80, 180, 360, 720, 1200, 1800][attempt] ?? 1800
    setTimeout(() => tryJoinFriendInvite(attempt + 1), retryMs)
  } else {
    document.documentElement.dataset.pearcupJoinState = 'missing-peer-match'
  }
  return false
}

function completeProfileOnboarding () {
  const name = $('#usernameInput').value.trim()
  state.username = name || 'captain'
  persist()
  if (typeof renderProfile === 'function') renderProfile()
  else if (typeof renderAll === 'function') renderAll()
  if (pendingFriendJoinCode()) {
    setView('games')
    tryJoinFriendInvite()
    showToast(`${state.username} joined as ${teamById(state.team).name}`)
    return
  }
  setView('home')
  showToast(`${state.username} joined as ${teamById(state.team).name}`)
}

function renderGameLobby () {
  const el = $('#gameLobby')
  if (!el) return
  el.innerHTML = `
    <div class="lobby-hero">
      <img class="lobby-mascot" src="assets/mascot.png" alt="">
      <div class="lobby-hero-copy">
        <p class="eyebrow">Penalty Clash · Lobby</p>
        <h2 class="lobby-title">Find a match</h2>
        <p class="lobby-sub">Best-of-five Penalty Clash — you take 5 penalties and keep their 5. Outscore them for the win.</p>
      </div>
      <div class="lobby-you-ready" aria-label="Your player profile">
        ${avatarSvg(state.username || 'captain', teamById(state.team), true)}
        <span><strong>You’re ready</strong><small>${teamById(state.team).flag} ${escapeHtml(teamById(state.team).name)}</small></span>
      </div>
      <button class="lobby-quick" id="quickMatchBtn" type="button">⚡ Solo practice</button>
    </div>

    <div class="lobby-friend">
      <div class="lobby-friend-copy">
        <strong>Play a real friend</strong>
        <span>Peer-to-peer over the room topic — you both take penalties, live.</span>
        <span class="p2p-backend-pill" id="p2pBackendBadge">P2P starting</span>
      </div>
      <div class="lobby-friend-actions">
        <button class="secondary-button compact-action" id="joinFriendBtn" type="button">Join with code</button>
        <button class="primary-button compact-action" id="inviteFriendBtn" type="button">Invite a friend</button>
      </div>
    </div>

    <p class="lobby-label">Players online <span class="lobby-live-badge"><i></i>live</span></p>
    <div class="lobby-list" id="lobbyLivePeers"></div>

    <p class="lobby-label lobby-label-muted">Solo practice is free · all listed opponents above are live peers</p>`
  const quick = $('#quickMatchBtn')
  if (quick) quick.addEventListener('click', () => startMatch(trainingOpponent()))
  const invite = $('#inviteFriendBtn')
  if (invite) invite.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.host())
  const joinFriend = $('#joinFriendBtn')
  if (joinFriend) joinFriend.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.promptJoin())
  renderPeerBackendBadge()
  // Live matchmaking: announce on the lobby topic + render online peers.
  // The packaged runtime self-test embeds a second same-process guest solely
  // to prove the friend-match channel. Do not open its unrelated global lobby
  // stream through the host's finite native HTTP connection pool.
  if (window.PearCupLobby && !isRuntimeSelfTestGuest()) { window.PearCupLobby.join(); window.PearCupLobby.renderList() }
}

function startMatch (player, joined) {
  const stake = player.stake || 0
  if (stake > 0 && !debitWallet(stake, `Penalty match stake vs ${player.name}`)) {
    showToast(`Need ${fmtMoney(stake)} to stake — fund your wallet`)
    setView('onboarding')
    return
  }
  // Carry the record so the AI keeper difficulty matches the lobby card.
  state.match = { opponent: { name: player.name, team: player.team, record: player.record }, stake }
  ensureShootout(true)
  persist()
  showToast(stake > 0
    ? `${joined ? 'Opponent found' : 'Matched'} · ${player.name} — beat them to win ${fmtMoney(stake * 2)}`
    : `${joined ? 'Opponent found' : 'Matched'} · ${player.name} — practice match, bragging rights only`)
  renderGames()
}

function leaveMatch () {
  if (state.match && state.match.peer && window.PearCupPeerMatch) { window.PearCupPeerMatch.leave(); return }
  state.match = null
  ensureShootout(true)
  persist()
  hideOverlay()
  renderGames()
}

function restartShootout ({ blockActiveStake = false, message = 'New penalty shootout — pick your corners!' } = {}) {
  // Peer match: starting over mid-room would desync the two clients, so leave cleanly.
  if (state.match && state.match.peer && window.PearCupPeerMatch) { window.PearCupPeerMatch.leave(); return false }
  const stake = state.match && state.match.stake || 0
  const so = ensureShootout()
  if (stake > 0 && blockActiveStake && so.phase !== 'over') {
    showToast('Finish this staked match before starting a rematch')
    return false
  }
  if (stake > 0 && !debitWallet(stake, `Rematch stake vs ${state.match.opponent.name}`)) {
    showToast('Not enough balance to rematch')
    leaveMatch()
    return false
  }
  ensureShootout(true)
  hideOverlay()
  renderGames()
  if (message) showToast(message)
  return true
}

async function renderGames () {
  const so = ensureShootout()
  ensureShootoutDom()
  renderPolymarketOdds()
  // A live peer match owns its own turn loop.
  if (state.match && state.match.peer && window.PearCupPeerMatch) {
    const arena0 = document.querySelector('#games .game-arena')
    if (arena0) arena0.classList.remove('is-lobby')
    if (so.phase !== 'over') window.PearCupPeerMatch.render()
    return null
  }
  const arena = document.querySelector('#games .game-arena')
  if (!state.match) {
    if (arena) arena.classList.add('is-lobby')
    renderGameLobby()
    return null
  }
  if (arena) arena.classList.remove('is-lobby')
  if (so.phase === 'over') { renderShootoutHud(); if (so.lastResult) applyKickResult(so.lastResult); return so.lastResult }
  startAimPhase()
  if (so.lastResult) applyKickResult(so.lastResult)
  else renderGamePlaceholders()
  return so.lastResult
}

function applyKickResult (result) {
  const shooterTeam = teamById(result.shooterTeam)
  const keeperTeam = teamById(result.keeperTeam)
  const ball = zonePosition(result.aim)
  const keeper = zonePosition(result.dive)
  const settlement = result.runtime.settlement
  const qvac = result.runtime.qvac
  const tetherWdk = result.runtime.tetherWdk
  const compliance = result.runtime.compliance
  const escrowAmount = result.tetherEscrow.amount ?? 5
  const escrowAsset = result.tetherEscrow.asset || 'USDT'
  const payoutId = result.tetherPayout.payoutId || result.tetherPayout.disputeId || 'pending'
  const payoutStatus = result.tetherPayout.status || 'prepared'

  $('#gameResolver').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Resolver</p>
      <strong>Deterministic</strong>
    </div>
    <div class="metric-list">
      <div><span>Aim</span><strong>${result.aim}</strong></div>
      <div><span>Dive</span><strong>${result.dive}</strong></div>
      <div><span>Timing gap</span><strong>${result.timingGap} ticks</strong></div>
    </div>
  `

  $('#gameSync').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">P2P sync</p>
      <strong>${result.sync.matched ? 'Roots matched' : 'Mismatch'}</strong>
    </div>
    <div class="hash-list">
      <div><span>Shooter commit</span><code>${result.shooterCommitment}</code></div>
      <div><span>Keeper commit</span><code>${result.keeperCommitment}</code></div>
      <div><span>State hash</span><code>${result.stateHash}</code></div>
      <div><span>Game topic</span><code>${result.sync.topic}</code></div>
      <div><span>Local root</span><code>${result.sync.localRoot}</code></div>
      <div><span>Spectator root</span><code>${result.sync.spectatorRoot}</code></div>
      <div><span>Receipt hash</span><code>${escapeHtml(result.settlementReceipt && result.settlementReceipt.receiptHash || 'pending')}</code></div>
      <div><span>Storage namespace</span><code>${result.storage.namespace}</code></div>
      <div><span>Replay root</span><code>${result.storage.replayRoot}</code></div>
    </div>
  `

  $('#gameReplay').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Replay log</p>
      <strong>${result.workerEvents.length} events</strong>
    </div>
    <ol class="game-steps">
      <li>${escapeHtml(result.workerEvents[1].type)} and ${escapeHtml(result.workerEvents[2].type)} over Pear game topic.</li>
      <li>${escapeHtml(result.workerEvents[3].type)} events verified against nonces.</li>
      <li>${escapeHtml(result.workerEvents[6].type)} signed ${result.outcome} ruling.</li>
      <li>${escapeHtml(result.workerEvents[7].type)} prepared WDK payout.</li>
      <li>${escapeHtml(result.settlementReceiptEvent && result.settlementReceiptEvent.type || 'SettlementReceiptCreated')} sealed ${escapeHtml(result.settlementReceipt && result.settlementReceipt.receiptHash || 'pending')}.</li>
      <li>Spectator peer merged ${result.sync.spectatorMerged} events on ${result.sync.topic} and matched the event root.</li>
      <li>${result.storage.external
        ? `Pear worker bridge retained ${result.storage.persistedEvents} redacted events at ${escapeHtml(result.storage.eventRoot)}.`
        : `Stored ${result.storage.persistedEvents} events and replayed ${result.storage.replayEvents} after restart with ${result.storage.replayMatched ? 'the same root' : 'a root mismatch'}.`}
      </li>
    </ol>
  `

  $('#runtimePanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Runtime</p>
      <strong class="runtime-pill ${settlementStatusClass(settlement)}">${settlement.realMoneyEnabled ? 'Live' : 'Locked'}</strong>
    </div>
    <div class="runtime-summary ${settlementStatusClass(settlement)}">
      <span>Prize gate</span>
      <strong>${settlement.label}</strong>
      <em>${qvac.sdkReady && tetherWdk.sdkReady ? `Guard ${result.guardMode}; QVAC and WDK adapters are in SDK mode.` : `Guard ${result.guardMode}; demo adapters keep real payouts disabled.`}</em>
    </div>
    <div class="status-list compact-status">
      <div class="${result.settlementGate.liveReady ? 'is-complete' : 'is-warn'}">
        <span>Settlement guard</span>
        <strong>${result.settlementGate.status}</strong>
      </div>
      <div class="${qvac.sdkReady ? 'is-complete' : 'is-warn'}">
        <span>QVAC referee</span>
        <strong>${serviceStatusText(qvac)}</strong>
      </div>
      <div class="${tetherWdk.sdkReady ? 'is-complete' : 'is-warn'}">
        <span>Tether WDK rail</span>
        <strong>${serviceStatusText(tetherWdk)}</strong>
      </div>
      <div class="${compliance.kycVerified && compliance.jurisdictionAllowed ? 'is-complete' : 'is-warn'}">
        <span>Compliance</span>
        <strong>${settlement.realMoneyEnabled ? 'Cleared' : 'Pending'}</strong>
      </div>
    </div>
  `

  $('#tetherPanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Tether WDK</p>
      <strong>${serviceModeLabel(tetherWdk)} rail</strong>
    </div>
    <div class="settlement-card">
      <span>Prize intent</span>
      <strong>${escrowAmount} ${escrowAsset}${result.canUseRealMoney ? '' : ' demo'}</strong>
      <em>${settlement.label}; QVAC signature required</em>
    </div>
    <div class="status-list">
      <div class="${tetherWdk.sdkReady ? 'is-complete' : 'is-warn'}">
        <span>Wallet</span>
        <strong>${serviceStatusText(tetherWdk)}</strong>
      </div>
      <div class="is-complete">
        <span>Escrow</span>
        <strong>${result.tetherEscrow.status || 'locked'}</strong>
      </div>
      <div class="${qvac.sdkReady ? 'is-complete' : 'is-warn'}">
        <span>Referee</span>
        <strong>${serviceStatusText(qvac)}</strong>
      </div>
      <div class="${payoutStatus === 'prepared' ? 'is-complete' : 'is-warn'}">
        <span>Settlement</span>
        <strong>${payoutStatus}</strong>
      </div>
      <div class="is-complete">
        <span>Escrow ID</span>
        <code>${result.tetherEscrow.escrowId}</code>
      </div>
      <div>
        <span>Payout ID</span>
        <code>${payoutId}</code>
      </div>
    </div>
  `

  $('#qvacRefPanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">QVAC</p>
      <strong>${serviceModeLabel(qvac)} AI referee</strong>
    </div>
    <div class="referee-verdict">
      <span>${result.outcomeLabel}</span>
      <p>${escapeHtml(result.qvacAttestation.rationale)} The deterministic resolver produced ${result.outcome}; QVAC signs the result hash for settlement.</p>
      <code>${result.qvacAttestation.attestationId}</code>
      <code>${result.stateHash}</code>
    </div>
  `

  $('#gameLeaderboard').innerHTML = gameLeaderboardMarkup()
  return result
}

function pickableMatchIds () {
  const out = []
  for (const round of buildRounds()) {
    for (const match of round.matches) {
      if (canPickMatch(match)) out.push(match.id)
    }
  }
  return out
}

function remainingPicks () {
  return pickableMatchIds().filter(id => !state.picks[id]).length
}

function bindViewButtons (root = document) {
  $$('[data-view]', root).forEach(button => {
    if (button.dataset.viewBound) return
    button.dataset.viewBound = 'true'
    button.addEventListener('click', () => setView(button.dataset.view))
  })
}

function bindCoreFallbackEvents () {
  if (document.documentElement.dataset.coreFallbackBound) return
  document.documentElement.dataset.coreFallbackBound = 'true'

  document.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view]')
    if (viewButton && viewButton.dataset.view) {
      event.preventDefault()
      event.stopPropagation()
      setView(viewButton.dataset.view)
      return
    }

    const teamButton = event.target.closest('#teamGrid .team-card[data-team]')
    if (teamButton) {
      event.preventDefault()
      event.stopPropagation()
      state.team = teamButton.dataset.team
      persist()
      $$('#teamGrid .team-card').forEach(button => {
        const selected = button.dataset.team === state.team
        button.classList.toggle('is-selected', selected)
        button.setAttribute('aria-pressed', String(selected))
      })
      renderProfile()
      return
    }

    const saveButton = event.target.closest('#saveProfile')
    if (saveButton) {
      event.preventDefault()
      event.stopPropagation()
      completeProfileOnboarding()
    }
  }, true)

  document.addEventListener('input', event => {
    if (event.target && event.target.id === 'usernameInput') {
      state.username = event.target.value.trim() || 'captain'
      persist()
      renderProfile()
    }
  }, true)
}

function bindEvents () {
  sendBootCheckpoint('bindEvents:start')
  bindViewButtons()
  sendBootCheckpoint('bindEvents:view-buttons')

  $('#usernameInput').addEventListener('input', event => {
    state.username = event.target.value.trim() || 'captain'
    persist()
    renderProfile()
  })

  $('#saveProfile').addEventListener('click', () => {
    completeProfileOnboarding()
  })
  sendBootCheckpoint('bindEvents:profile')

  $('#resetPicks').addEventListener('click', () => {
    state.picks = {}
    persist()
    renderBracket()
    showToast('Bracket picks cleared')
  })

  $('#submitPicks').addEventListener('click', () => {
    const remaining = remainingPicks()
    if (remaining > 0) {
      showToast(`${remaining} open ${remaining === 1 ? 'match' : 'matches'} still unpicked — they lock at kickoff`)
      return
    }
    showToast(`Picks in for this round, ${state.username} — next round opens when results land 🎉`)
  })
  sendBootCheckpoint('bindEvents:bracket')

  $('#voiceToggle').addEventListener('click', () => {
    if (window.PearCupWatchVoice && typeof window.PearCupWatchVoice.toggle === 'function') {
      window.PearCupWatchVoice.toggle()
      return
    }
    state.voice = !state.voice
    persist()
    $('#voiceToggle').classList.toggle('is-live', state.voice)
    showToast(state.voice ? 'Voice chat ready' : 'Voice chat off')
  })

  $('#shareScreenBtn').addEventListener('click', toggleScreenShare)
  $('#shareGameBtn').addEventListener('click', toggleInviteBar)
  const themeBtn = $('#themeBtn'); if (themeBtn) themeBtn.addEventListener('click', () => showThemePicker(false))
  sendBootCheckpoint('bindEvents:watch')

  $('#advanceGameRound').addEventListener('click', () => {
    const zone = AIM_ZONES[Math.floor(Math.random() * AIM_ZONES.length)]
    // Peer match: route through the peer controller so both clients stay in lockstep.
    if (window.PearCupPeerMatch && window.PearCupPeerMatch.isActive()) { window.PearCupPeerMatch.onZone(zone); return }
    const so = ensureShootout()
    if (so.phase === 'over') { ensureShootout(true); hideOverlay(); renderGames(); return }
    if (so.phase === 'aim' && !so.busy) takeKick(zone)
  })

  $('#spectateGame').addEventListener('click', () => {
    restartShootout({ blockActiveStake: true })
  })
  sendBootCheckpoint('bindEvents:games')

  $('#chatForm').addEventListener('submit', event => {
    event.preventDefault()
    const input = $('#chatInput')
    const text = input.value.trim()
    if (!text) return
    state.chat.push({
      user: state.username || 'you',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    })
    state.chat = state.chat.slice(-8)
    const last = state.chat[state.chat.length - 1]
    if (window.PearCupWatchSync) window.PearCupWatchSync.broadcastChat(last.user, last.text, last.time)
    input.value = ''
    persist()
    renderWatch()
  })
  sendBootCheckpoint('bindEvents:chat')
}

function renderAll () {
  sendBootCheckpoint('renderAll:start')
  renderTeams()
  renderProfile()
  sendBootCheckpoint('renderAll:shell')
  renderView(state.view || 'onboarding')
  sendBootCheckpoint('renderAll:active-view', state.view || 'onboarding')
}

function assertP2PModulesReady () {
  if (typeof window === 'undefined' || !document.documentElement) return
  const required = [
    ['PearCupPeerNet', 'pearcupPeerNetModule'],
    ['PearCupPoolSync', 'pearcupPoolSyncModule'],
    ['PearCupPeerMatch', 'pearcupPeerMatchModule'],
    ['PearCupLobby', 'pearcupPeerLobbyModule'],
    ['PearCupWatchSync', 'pearcupWatchSyncModule'],
    ['PearCupWatchVoice', 'pearcupWatchVoiceModule']
  ]
  const missing = []
  for (const [globalName, datasetName] of required) {
    if (!window[globalName]) missing.push(globalName)
    else if (document.documentElement.dataset[datasetName] !== 'ready') {
      missing.push(`${globalName}:${document.documentElement.dataset[datasetName] || 'unmarked'}`)
    }
  }
  if (missing.length) {
    document.documentElement.dataset.pearcupP2pModules = 'missing'
    throw new Error(`PearCup P2P modules missing: ${missing.join(', ')}`)
  }
  document.documentElement.dataset.pearcupP2pModules = 'ready'
}

function emitBootReadyMarker () {
  if (typeof window === 'undefined' || !document.documentElement) return
  const backend = document.documentElement.dataset.pearcupPeerNet || 'unknown'
  document.documentElement.dataset.pearcupBootReady = 'p2p'
  sendBootReadyProbe(backend)
  if (typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log(`[pearcup:boot-ready] p2p=ready backend=${backend}`)
  }
}

function sendBootCheckpoint (status, detail = '') {
  if (typeof window === 'undefined' || window.__pearcupBootCheckpointDebug !== true) return
  if (typeof window === 'undefined' || !document.documentElement) return
  const payload = {
    event: 'pearcup:boot-checkpoint',
    status,
    detail,
    appScriptSeen: Boolean(window.__pearcupAppScriptSeen),
    appBooted: Boolean(window.__pearcupAppBooted),
    p2pModules: document.documentElement.dataset.pearcupP2pModules || null,
    backend: document.documentElement.dataset.pearcupPeerNet || null,
    screens: Array.from(document.querySelectorAll('.screen.is-active')).map(el => el.id)
  }
  sendBootProbePayload('./boot-probe-hit.gif', payload)
  resolveBootProbeUrl().then(url => {
    if (!url || url === './boot-probe-hit.gif') return
    sendBootProbePayload(url, payload)
  }).catch(() => {})
}

function controllerReady (controller, methods) {
  return Boolean(controller && methods.every(method => typeof controller[method] === 'function'))
}

function bootRuntimeDiagnostics () {
  const avatarImages = Array.from(document.querySelectorAll('.avatar-art img'))
    .map(el => el.getAttribute('src') || '')
    .filter(Boolean)
  const activeScreens = Array.from(document.querySelectorAll('.screen.is-active')).map(el => el.id)
  const ds = document.documentElement.dataset

  return {
    uiHydrated: ds.pearcupUiHydrated || null,
    activeScreens,
    routeButtons: Array.from(document.querySelectorAll('[data-view]')).map(el => el.getAttribute('data-view')).filter(Boolean),
    teamCards: document.querySelectorAll('#teamGrid .team-card').length,
    avatarImages: avatarImages.slice(0, 4),
    profileChipReady: Boolean(document.querySelector('#profileChip .avatar-art img')),
    integration: {
      qvacMode: integrationRuntime && integrationRuntime.mode && (integrationRuntime.mode.qvac || integrationRuntime.mode) || 'unknown',
      qvacCommentaryMode: integrationRuntime && integrationRuntime.mode && integrationRuntime.mode.qvacCommentary || 'unknown',
      tetherWdkMode: integrationRuntime && integrationRuntime.mode && (integrationRuntime.mode.tetherWdk || integrationRuntime.mode) || 'unknown',
      settlementStatus: integrationRuntime && integrationRuntime.readiness && integrationRuntime.readiness.settlement && integrationRuntime.readiness.settlement.status || 'unknown',
      realMoneyEnabled: Boolean(integrationRuntime && integrationRuntime.canUseRealMoney)
    },
    peerMatchDataset: {
      state: ds.pearcupPeerMatchState || null,
      active: ds.pearcupPeerMatchActive || null,
      started: ds.pearcupPeerMatchStarted || null,
      code: ds.pearcupPeerMatchCode || null,
      role: ds.pearcupPeerMatchRole || null,
      channelBackend: ds.pearcupPeerMatchChannelBackend || null
    },
    peerNetDataset: {
      backend: ds.pearcupPeerNet || null,
      status: ds.pearcupPeerNetStatus || null,
      detail: ds.pearcupPeerNetDetail || null
    },
    controllers: {
      peerNet: controllerReady(window.PearCupPeerNet, ['createChannel', 'newRoomCode', 'newPeerId']),
      poolSync: controllerReady(window.PearCupPoolSync, ['start', 'submit', 'entriesFor']),
      peerMatch: controllerReady(window.PearCupPeerMatch, ['host', 'join', 'promptJoin', 'onZone']),
      peerLobby: controllerReady(window.PearCupLobby, ['join', 'renderList']),
      watchSync: controllerReady(window.PearCupWatchSync, ['ensureRoom', 'broadcastChat', 'react']),
      watchVoice: controllerReady(window.PearCupWatchVoice, ['bind', 'toggle', 'pressStart', 'pressEnd'])
    }
  }
}

function sendBootProbeEvent (payload) {
  sendBootProbePayload('./boot-probe-hit.gif', payload)
  resolveBootProbeUrl().then(url => {
    if (!url || url === './boot-probe-hit.gif') return
    sendBootProbePayload(url, payload)
  }).catch(() => {})
}

function sendBootReadyProbe (backend) {
  const ds = document.documentElement.dataset
  const payload = {
    event: 'pearcup:boot-ready',
    status: 'ready',
    bootReady: ds.pearcupBootReady || null,
    p2pModules: ds.pearcupP2pModules || null,
    backend,
    appBooted: Boolean(window.__pearcupAppBooted),
    appBootedDataset: ds.pearcupAppBooted || null,
    activeScreen: ds.pearcupActiveScreen || null,
    modules: {
      net: ds.pearcupPeerNetModule || null,
      match: ds.pearcupPeerMatchModule || null,
      lobby: ds.pearcupPeerLobbyModule || null,
      watch: ds.pearcupWatchSyncModule || null,
      voice: ds.pearcupWatchVoiceModule || null
    },
    screens: Array.from(document.querySelectorAll('.screen.is-active')).map(el => el.id),
    runtime: bootRuntimeDiagnostics()
  }
  sendBootProbeEvent(payload)
}

function sendBootProbePayload (url, payload) {
  const body = JSON.stringify(payload)
  if (typeof Image === 'function') {
    window.__pearcupBootProbeImages = window.__pearcupBootProbeImages || []
    const image = new Image()
    const sep = url.indexOf('?') === -1 ? '?' : '&'
    image.src = url + sep + 'payload=' + encodeURIComponent(body)
    window.__pearcupBootProbeImages.push(image)
    setTimeout(() => {
      const list = window.__pearcupBootProbeImages || []
      const index = list.indexOf(image)
      if (index >= 0) list.splice(index, 1)
    }, 5000)
    return
  }
  if (typeof fetch === 'function') {
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body
    }).catch(() => {})
  }
}

async function resolveBootProbeUrl () {
  try {
    const config = await loadBootProbeConfig()
    return config.url || ''
  } catch (e) {
    return ''
  }
}

let bootProbeConfigPromise = null
function loadBootProbeConfig () {
  if (bootProbeConfigPromise) return bootProbeConfigPromise
  bootProbeConfigPromise = (async () => {
    const env = (typeof process !== 'undefined' && process && process.env) || null
    const config = {}
    const direct = normalizeBootProbeUrl(env && env.PEARCUP_BOOT_PROBE_URL)
    if (direct) config.url = direct
    if (truthyEnv(env && env.PEARCUP_BOOT_PROBE_RUNTIME_SELF_TEST)) config.runtimeSelfTest = true
    if (truthyEnv(env && env.PEARCUP_DISABLE_RUNTIME_SELF_TEST)) config.runtimeSelfTest = false
    const delay = Number(env && env.PEARCUP_BOOT_PROBE_RUNTIME_SELF_TEST_DELAY_MS)
    if (Number.isFinite(delay) && delay >= 0) config.runtimeSelfTestDelayMs = delay
    if (typeof fetch === 'function') {
      try {
        const res = await fetch('./boot-probe.json', { cache: 'no-store' })
        if (res && res.ok) {
          const fileConfig = await res.json()
          if (fileConfig && typeof fileConfig === 'object') Object.assign(config, fileConfig)
        }
      } catch (e) {}
    }
    Object.assign(config, bootProbeQueryConfig())
    config.url = normalizeBootProbeUrl(config.url) || ''
    return config
  })()
  return bootProbeConfigPromise
}

function truthyEnv (value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

function normalizeBootProbeUrl (raw) {
  if (!raw) return ''
  if (raw === './boot-probe-hit.gif' || raw.indexOf('./boot-probe-hit.gif?') === 0) return raw
  if (raw === '/boot-probe-hit.gif' || raw.indexOf('/boot-probe-hit.gif?') === 0) return raw
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:') return ''
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) return ''
    return parsed.href
  } catch (e) {
    return ''
  }
}

function bootProbeQueryConfig () {
  const config = {}
  try {
    const params = new URLSearchParams(location.search || '')
    const direct = normalizeBootProbeUrl(params.get('pearcupBootProbeUrl') || '')
    if (direct) config.url = direct
    if (truthyEnv(params.get('pearcupRuntimeSelfTest'))) config.runtimeSelfTest = true
    const delay = Number(params.get('pearcupRuntimeSelfTestDelayMs'))
    if (Number.isFinite(delay) && delay >= 0) config.runtimeSelfTestDelayMs = delay
  } catch (e) {}
  return config
}

function runtimeSelfTestSnapshot (status, errors = [], extra = {}) {
  const active = document.querySelector('.screen.is-active')
  const modal = document.querySelector('#peerModal')
  const link = modal ? modal.querySelector('.peer-link code') : null
  const modalCode = modal && modal.querySelector('.peer-code')
  const peerState = window.PearCupPeerMatch && window.PearCupPeerMatch._state
  const activeAvatarImages = active
    ? Array.from(active.querySelectorAll('.avatar-art img')).map(el => el.getAttribute('src') || '').filter(Boolean).slice(0, 6)
    : []
  return {
    event: 'pearcup:runtime-self-test',
    status,
    errors,
    bootReady: document.documentElement.dataset.pearcupBootReady || null,
    p2pModules: document.documentElement.dataset.pearcupP2pModules || null,
    appBootedDataset: document.documentElement.dataset.pearcupAppBooted || null,
    backend: document.documentElement.dataset.pearcupPeerNet || null,
    activeScreen: active ? active.id : null,
    activeScreenDataset: document.documentElement.dataset.pearcupActiveScreen || null,
    activeNav: Array.from(document.querySelectorAll('.topnav button.is-active')).map(el => el.textContent.trim()),
    hasGamesLobby: Boolean(document.querySelector('#gameLobby')),
    hasLobbyMascot: Boolean(active && active.querySelector('img.lobby-mascot[src="assets/mascot.png"]')),
    p2pBackendBadge: (document.querySelector('#p2pBackendBadge') && document.querySelector('#p2pBackendBadge').textContent.trim()) || '',
    generatedAvatarImages: activeAvatarImages,
    inviteModalOpen: Boolean(modal) || extra.inviteModalOpen === true,
    inviteCode: (modalCode && modalCode.textContent.trim()) || extra.inviteCode || '',
    inviteLink: (link && link.textContent.trim()) || extra.inviteLink || '',
    bracket: extra.bracket || null,
    hashRoutes: extra.hashRoutes || null,
    peerMatch: peerState
      ? {
          active: Boolean(peerState.active),
          started: Boolean(peerState.started),
          code: peerState.code || '',
          role: peerState.role || ''
        }
      : null,
    peerHandshake: extra.peerHandshake || null,
    runtime: bootRuntimeDiagnostics()
  }
}

function runtimeSelfTestGuestUrl (code) {
  const url = new URL(location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('join', code)
  url.searchParams.set('pearcupRuntimeSelfTestGuest', '1')
  return url.toString()
}

function runtimeSelfTestGuestSnapshot (iframe) {
  const win = iframe && iframe.contentWindow
  const doc = iframe && iframe.contentDocument
  const peerState = win && win.PearCupPeerMatch && win.PearCupPeerMatch._state
  const ds = doc && doc.documentElement && doc.documentElement.dataset || {}
  return {
    url: win && win.location ? win.location.href : '',
    booted: ds.pearcupBooted || null,
    bootReady: ds.pearcupBootReady || null,
    p2pModules: ds.pearcupP2pModules || null,
    appBootedDataset: ds.pearcupAppBooted || null,
    joinState: ds.pearcupJoinState || null,
    activeScreen: doc && doc.querySelector('.screen.is-active') ? doc.querySelector('.screen.is-active').id : null,
    activeScreenDataset: ds.pearcupActiveScreen || null,
    bootError: doc && doc.querySelector('#bootErrorBar') ? doc.querySelector('#bootErrorBar').textContent : null,
    peerMatch: peerState
      ? {
          active: Boolean(peerState.active),
          started: Boolean(peerState.started),
          code: peerState.code || '',
          role: peerState.role || ''
        }
      : null
  }
}

function runRuntimePeerHandshakeSelfTest (code) {
  return new Promise(resolve => {
    if (!code || !document.body || typeof document.createElement !== 'function') {
      resolve({ started: false, reason: 'iframe unavailable', guest: null })
      return
    }
    const iframe = document.createElement('iframe')
    iframe.title = 'PearCup runtime peer self-test guest'
    iframe.setAttribute('aria-hidden', 'true')
    iframe.tabIndex = -1
    iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-10000px;top:-10000px;border:0;opacity:0;pointer-events:none'
    iframe.src = runtimeSelfTestGuestUrl(code)
    document.body.appendChild(iframe)

    const startedAt = Date.now()
    let last = { started: false, reason: 'waiting for guest', guest: null }
    const finish = result => {
      try { iframe.remove() } catch (e) {}
      resolve(result)
    }
    const poll = () => {
      let guest = null
      try {
        guest = runtimeSelfTestGuestSnapshot(iframe)
      } catch (err) {
        last = { started: false, reason: err && err.message ? err.message : String(err), guest: null }
      }
      const hostState = window.PearCupPeerMatch && window.PearCupPeerMatch._state
      const hostStarted = Boolean(hostState && hostState.started && hostState.code === code)
      const guestStarted = Boolean(guest && guest.peerMatch && guest.peerMatch.started && guest.peerMatch.code === code)
      if (hostStarted && guestStarted) {
        finish({
          started: true,
          host: {
            active: Boolean(hostState.active),
            started: Boolean(hostState.started),
            code: hostState.code || '',
            role: hostState.role || ''
          },
          guest
        })
        return
      }
      if (guest) last = { started: false, reason: 'waiting for peer handshake', guest }
      if (Date.now() - startedAt > 8000) {
        finish(last)
        return
      }
      setTimeout(poll, 120)
    }
    setTimeout(poll, 120)
  })
}

function isRuntimeSelfTestGuest () {
  try {
    return new URLSearchParams(location.search).get('pearcupRuntimeSelfTestGuest') === '1'
  } catch (e) {
    return false
  }
}

function waitForRuntimeCondition (predicate, timeoutMs = 3000, intervalMs = 80) {
  return new Promise(resolve => {
    const startedAt = Date.now()
    const poll = () => {
      let passed = false
      try { passed = Boolean(predicate()) } catch (e) {}
      if (passed) {
        resolve(true)
        return
      }
      if (Date.now() - startedAt > timeoutMs) {
        resolve(false)
        return
      }
      setTimeout(poll, intervalMs)
    }
    poll()
  })
}

function runtimeBracketEvidence () {
  const board = document.querySelector('#bracketBoard')
  const rect = board && typeof board.getBoundingClientRect === 'function' ? board.getBoundingClientRect() : null
  return {
    activeScreen: document.querySelector('.screen.is-active') ? document.querySelector('.screen.is-active').id : null,
    activeScreenDataset: document.documentElement.dataset.pearcupActiveScreen || null,
    boardVisible: Boolean(board && rect && rect.width > 0 && rect.height > 0),
    matchCards: document.querySelectorAll('#bracketBoard .bracket-match').length,
    pickButtons: document.querySelectorAll('#bracketBoard [data-pick]').length,
    roundTitles: Array.from(document.querySelectorAll('#bracketBoard .round-title')).map(el => el.textContent.trim()),
    connectorPathLength: (document.querySelector('#bracketLines path') && document.querySelector('#bracketLines path').getAttribute('d') || '').length,
    generatedAvatarImages: Array.from(document.querySelectorAll('#bracket .avatar-art img')).map(el => el.getAttribute('src') || '').filter(Boolean).slice(0, 8)
  }
}

function runtimeHashRouteEvidence (view) {
  const active = document.querySelector('.screen.is-active')
  const board = document.querySelector('#bracketBoard')
  const boardRect = board && typeof board.getBoundingClientRect === 'function' ? board.getBoundingClientRect() : null
  const watchChallengeList = document.querySelector('#watchChallengeList')
  const avatarPreview = document.querySelector('#avatarPreview')
  return {
    view,
    hash: location.hash || '',
    activeScreen: active ? active.id : null,
    activeScreenDataset: document.documentElement.dataset.pearcupActiveScreen || null,
    activeNav: Array.from(document.querySelectorAll('.topnav button.is-active')).map(el => el.textContent.trim()),
    teamCards: document.querySelectorAll('#teamGrid .team-card').length,
    profileChipReady: Boolean(document.querySelector('#profileChip .avatar-art img')),
    avatarPreviewReady: Boolean(avatarPreview && avatarPreview.querySelector('.avatar-art img')),
    liveMenuButtons: document.querySelectorAll('#liveMenu button').length,
    liveDetailReady: Boolean(document.querySelector('#liveDetail') && document.querySelector('#liveDetail').textContent.trim()),
    poolCards: document.querySelectorAll('#poolGrid .pool-card').length,
    fixtureCards: document.querySelectorAll('#homeFixtures .mini-fixture').length,
    boardVisible: Boolean(board && boardRect && boardRect.width > 0 && boardRect.height > 0),
    matchCards: document.querySelectorAll('#bracketBoard .bracket-match').length,
    inviteButton: Boolean(document.querySelector('#inviteFriendBtn')),
    watchActive: Boolean(document.querySelector('#watch.screen.is-active')),
    watchChallengePanel: Boolean(document.querySelector('.watch-challenge-panel')),
    watchChallengeList: Boolean(watchChallengeList),
    watchChallengeText: watchChallengeList ? watchChallengeList.textContent.trim() : ''
  }
}

async function runRuntimeHashRouteSelfTest () {
  const routes = ['onboarding', 'home', 'bracket', 'games', 'watch']
  const results = []
  for (const view of routes) {
    try {
      location.hash = view
    } catch (err) {
      results.push({
        view,
        passed: false,
        error: err && err.message ? err.message : String(err)
      })
      continue
    }
    const passed = await waitForRuntimeCondition(() => {
      const active = document.querySelector('.screen.is-active')
      return active && active.id === view && document.documentElement.dataset.pearcupActiveScreen === view
    }, 2500)
    results.push({
      ...runtimeHashRouteEvidence(view),
      passed
    })
  }
  return {
    passed: results.length === routes.length && results.every(item =>
      item.passed === true &&
      item.activeScreen === item.view &&
      item.activeScreenDataset === item.view
    ),
    results
  }
}

async function runBootRuntimeSelfTest () {
  const errors = []
  const evidence = {}
  try {
    if (document.documentElement.dataset.pearcupBootReady !== 'p2p') errors.push('bootReady was not p2p')
    if (document.documentElement.dataset.pearcupP2pModules !== 'ready') errors.push('P2P modules were not ready')
    if (!window.PearCupPeerMatch || typeof window.PearCupPeerMatch.host !== 'function') errors.push('PearCupPeerMatch.host missing')
    setView('bracket')
    await waitForRuntimeCondition(() => {
      const bracketAvatars = Array.from(document.querySelectorAll('#bracket .avatar-art img'))
      return document.documentElement.dataset.pearcupActiveScreen === 'bracket' &&
        document.querySelectorAll('#bracketBoard .bracket-match').length >= 31 &&
        bracketAvatars.some(el => /avatars\//.test(el.getAttribute('src') || ''))
    }, 5000)
    evidence.bracket = runtimeBracketEvidence()
    if (evidence.bracket.activeScreen !== 'bracket') errors.push('Bracket route did not become active')
    if (evidence.bracket.activeScreenDataset !== 'bracket') errors.push('Bracket route did not update active screen diagnostics')
    if (evidence.bracket.boardVisible !== true) errors.push('Bracket board did not become visible')
    if (evidence.bracket.matchCards < 31) errors.push(`Bracket board rendered ${evidence.bracket.matchCards} match cards`)
    if (evidence.bracket.pickButtons < 32) errors.push(`Bracket board rendered ${evidence.bracket.pickButtons} pick buttons`)
    for (const title of ['Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Final']) {
      if (!evidence.bracket.roundTitles.includes(title)) errors.push(`Bracket board missing ${title}`)
    }
    if (!evidence.bracket.generatedAvatarImages.some(src => /avatars\//.test(src))) errors.push('Bracket route did not render generated avatar images')
    evidence.hashRoutes = await runRuntimeHashRouteSelfTest()
    if (!evidence.hashRoutes || evidence.hashRoutes.passed !== true) {
      errors.push('Same-document hash route changes did not activate Bracket, Games, and Watch')
    }
    for (const view of ['onboarding', 'home', 'bracket', 'games', 'watch']) {
      const route = evidence.hashRoutes && Array.isArray(evidence.hashRoutes.results)
        ? evidence.hashRoutes.results.find(item => item.view === view)
        : null
      if (!route) {
        errors.push(`Hash route ${view} did not report evidence`)
      } else {
        if (route.activeScreen !== view) errors.push(`Hash route ${view} activeScreen was ${route.activeScreen || '(missing)'}`)
        if (route.activeScreenDataset !== view) errors.push(`Hash route ${view} activeScreenDataset was ${route.activeScreenDataset || '(missing)'}`)
        if (route.passed !== true) errors.push(`Hash route ${view} did not pass`)
        if (view === 'onboarding') {
          if (route.teamCards < 32) errors.push(`Profile route rendered ${route.teamCards || 0} team cards`)
          if (route.profileChipReady !== true) errors.push('Profile route did not hydrate the profile chip avatar')
          if (route.avatarPreviewReady !== true) errors.push('Profile route did not hydrate the avatar preview')
        }
        if (view === 'home') {
          if (route.liveMenuButtons < 5) errors.push(`Home route rendered ${route.liveMenuButtons || 0} live menu buttons`)
          if (route.liveDetailReady !== true) errors.push('Home route did not hydrate live detail')
          if (route.poolCards < 3) errors.push(`Home route rendered ${route.poolCards || 0} pool cards`)
          if (route.fixtureCards < 2) errors.push(`Home route rendered ${route.fixtureCards || 0} fixture cards`)
        }
        if (view === 'watch') {
          if (route.watchChallengePanel !== true) errors.push('Watch route did not render the challenge panel')
          if (route.watchChallengeList !== true) errors.push('Watch route did not render the challenge list')
        }
      }
    }
    setView('games')
    await waitForRuntimeCondition(() =>
      document.documentElement.dataset.pearcupActiveScreen === 'games' &&
      document.querySelector('#gameLobby')
    )
    const active = document.querySelector('.screen.is-active')
    if (!active || active.id !== 'games') errors.push('Games route did not become active')
    if (!document.querySelector('#inviteFriendBtn')) errors.push('Invite button did not render')
    if (!document.querySelector('img.lobby-mascot[src="assets/mascot.png"]')) errors.push('Lobby mascot did not render')
    const avatarImages = Array.from(document.querySelectorAll('#games .avatar-art img')).map(el => el.getAttribute('src') || '')
    if (!avatarImages.some(src => /avatars\//.test(src))) errors.push('Games view did not render generated avatar images')
    if (window.PearCupPeerMatch && typeof window.PearCupPeerMatch.host === 'function') {
      window.PearCupPeerMatch.host()
    }
    const modal = document.querySelector('#peerModal')
    const code = modal && modal.querySelector('.peer-code')
    const link = modal && modal.querySelector('.peer-link code')
    const peerState = window.PearCupPeerMatch && window.PearCupPeerMatch._state
    evidence.inviteModalOpen = Boolean(modal)
    evidence.inviteCode = code ? code.textContent.trim() : ''
    evidence.inviteLink = link ? link.textContent.trim() : ''
    if (!modal) errors.push('Invite modal did not open')
    if (!code || !/^[a-z0-9-]{6,32}$/i.test(evidence.inviteCode)) errors.push('Invite modal did not show a valid room code')
    if (!link || !/\?join=/.test(evidence.inviteLink)) errors.push('Invite link did not include ?join=')
    if (!peerState || peerState.active !== true || !peerState.code) errors.push('Peer match host state was not active')
    if (evidence.inviteCode && !errors.length) {
      const handshake = await runRuntimePeerHandshakeSelfTest(evidence.inviteCode)
      evidence.peerHandshake = handshake
      if (!handshake.started) errors.push(`Runtime peer guest did not complete invite handshake: ${handshake.reason || 'not started'}`)
    }
    sendBootProbeEvent(runtimeSelfTestSnapshot(errors.length ? 'error' : 'ready', errors, evidence))
  } catch (err) {
    errors.push(err && err.message ? err.message : String(err))
    sendBootProbeEvent(runtimeSelfTestSnapshot('error', errors, evidence))
  }
}

function scheduleBootRuntimeSelfTest () {
  if (typeof window === 'undefined' || typeof setTimeout !== 'function') return
  if (isRuntimeSelfTestGuest()) return
  loadBootProbeConfig().then(config => {
    if (!config || config.runtimeSelfTest !== true) return
    const delay = Number(config.runtimeSelfTestDelayMs || 350)
    setTimeout(runBootRuntimeSelfTest, Number.isFinite(delay) ? delay : 350)
  }).catch(() => {})
}

function scheduleBootReadyProbe () {
  if (typeof window === 'undefined' || typeof setTimeout !== 'function') return
  setTimeout(() => {
    if (!document.documentElement) return
    const ds = document.documentElement.dataset
    if (ds.pearcupBootReady !== 'p2p' || ds.pearcupP2pModules !== 'ready') return
    sendBootReadyProbe(ds.pearcupPeerNet || 'unknown')
  }, 500)
}

function boot () {
  sendBootCheckpoint('boot:start')
  applyTheme(state.theme)
  bindCoreFallbackEvents()
  window.addEventListener('pearcup:p2p-backend', renderPeerBackendBadge)
  assertP2PModulesReady()
  // A real app instance always joins pool sync. The hidden same-process
  // readiness guest isolates the match transport so two embedded clients do
  // not consume every long-lived SSE slot before their handshake begins.
  if (!isRuntimeSelfTestGuest()) startPoolSync()
  sendBootCheckpoint('boot:p2p-ready')
  bindEvents()
  sendBootCheckpoint('boot:events-bound')
  hydrateStaticShell()
  const identity = portableIdentity()
  if (identity) identity.restore().then(result => {
    if (result && result.account) applyPortableIdentity(result.account)
    else renderIdentityManage()
  }).catch(() => {})
  // If any runtime module was missing or the runtime config degraded to demo, say so
  // (non-blocking) — tells us the real cause without a console.
  if (bootIssues.length) { try { console.warn('PearCup boot issues:', bootIssues); showToast('Runtime note: ' + bootIssues.join(' · ')) } catch (e) {} }
  if (!state.themeChosen) {
    state.themeChosen = true
    persist()
  }
  // Deep link: ?join=<code> auto-joins a friend's peer match, including first-run users.
  if (!tryJoinFriendInvite()) applyStartupView()
  bindStartupRouteEvents()
  window.addEventListener('load', resetScrollPosition)
  window.addEventListener('pageshow', resetScrollPosition)
  window.addEventListener('resize', scheduleBracketConnectors)
  // Auto-detect a worker-relayed live-match.json feed (no browser CORS).
  detectLiveRelay()
  setInterval(detectLiveRelay, productionLiveData ? productionLiveData.pollMs : 60_000)
  // Public Polymarket prices arrive through the same keyless relay boundary as
  // match data; the renderer never contacts Polymarket's trading APIs directly.
  detectPolymarketOdds()
  setInterval(detectPolymarketOdds, productionLiveData ? productionLiveData.pollMs : 30_000)
  bindPearWakeups()
}

function hydrateStaticShell () {
  try {
    if ($('#teamGrid')) renderTeams()
    if ($('#profileChip') || $('#avatarPreview')) renderProfile()
    document.documentElement.dataset.pearcupUiHydrated = 'true'
    sendBootCheckpoint('boot:ui-hydrated')
  } catch (err) {
    document.documentElement.dataset.pearcupUiHydrated = 'partial'
    bootIssues.push('ui hydrate threw: ' + (err && err.message ? err.message : String(err)))
  }
}

scheduleBootReadyProbe()
scheduleBootRuntimeSelfTest()

try {
  boot()
  if (typeof window !== 'undefined') {
    window.__pearcupAppBooted = true
    document.documentElement.setAttribute('data-pearcup-booted', 'true')
    document.documentElement.dataset.pearcupAppBooted = 'true'
    syncRuntimeScreenDiagnostics()
    try { window.sessionStorage && window.sessionStorage.removeItem('pearcupBootRetryVisualShell') } catch (e) {}
    const bar = document.getElementById('bootErrorBar')
    if (bar && !/^PearCup boot error:/.test(bar.textContent || '')) bar.remove()
    emitBootReadyMarker()
    try { window.dispatchEvent(new Event('pearcup:booted')) } catch (e) {}
  }
} catch (err) {
  // The Pear renderer has no visible console — surface the real boot error ON SCREEN so a
  // single early throw can't leave a blank, dead app (and tells us exactly what failed).
  try {
    const banner = document.createElement('pre')
    banner.id = 'bootErrorBar'
    banner.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:45vh;overflow:auto;margin:0;padding:12px 16px;background:#3a1030;color:#ffd9ec;font:12px/1.5 ui-monospace,monospace;z-index:99999;white-space:pre-wrap;border-top:3px solid #ff8fc0'
    banner.textContent = 'PearCup boot error:\n' + (err && err.stack ? err.stack : String(err))
    document.body.appendChild(banner)
  } catch (e2) { /* DOM unavailable */ }
  if (typeof console !== 'undefined') console.error('PearCup boot error', err)
}
