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
const PearCupRuntimeConfig = needModule('PearCupRuntimeConfig')
const PearCupWorkerSim = optionalModule('PearCupWorkerSim')
const PearCupWorkerClient = optionalModule('PearCupWorkerClient')
const PearCupTransportSim = optionalModule('PearCupTransportSim')
const PearCupStorageSim = optionalModule('PearCupStorageSim')
const PearCupSettlementService = optionalModule('PearCupSettlementService')

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
  { tier: 10, entrants: 124, closes: '12h', max: 256, prize: '$1,240', heat: 'Open', rail: 'USDT demo' },
  { tier: 25, entrants: 82, closes: '9h', max: 160, prize: '$2,050', heat: 'Hot', rail: 'USDT demo' },
  { tier: 50, entrants: 38, closes: '7h', max: 96, prize: '$1,900', heat: 'Sharp', rail: 'USDT demo' },
  { tier: 100, entrants: 19, closes: '5h', max: 64, prize: '$1,900', heat: 'Elite', rail: 'USDT demo' }
]

const round32Matches = [
  { id: 'r32-1', time: 'Sat, 06/28', status: 'FT', slots: ['ca', 'za'], score: [1, 0], sample: { ca: ['noah'], za: ['zola'] } },
  { id: 'r32-2', time: 'Sun, 06/29', status: 'PEN 3-2', slots: ['ma', 'nl'], score: [1, 1], sample: { ma: ['youssef'], nl: ['daan'] } },
  { id: 'r32-3', time: 'Sun, 06/29', status: 'FT', slots: ['br', 'jp'], score: [2, 1], sample: { br: ['lina', 'ash'], jp: ['ken'] } },
  { id: 'r32-4', time: 'Mon, 06/30', status: 'FT', slots: ['no', 'ci'], score: [2, 1], sample: { no: ['vera', 'jo'], ci: ['paz'] } },
  { id: 'r32-5', time: 'Sun, 06/29', status: 'PEN 4-3', slots: ['py', 'de'], score: [1, 1], sample: { py: ['santi'], de: ['fritz'] } },
  { id: 'r32-6', time: 'Mon, 06/30', status: 'FT', slots: ['fr', 'se'], score: [3, 0], sample: { fr: ['cam'], se: ['ingrid'] } },
  { id: 'r32-7', time: 'Mon, 06/30', status: 'FT', slots: ['mx', 'ec'], score: [2, 0], sample: { mx: ['milo'], ec: ['rio'] } },
  { id: 'r32-8', time: 'Tue, 07/01', status: 'FT', slots: ['eng', 'cd'], score: [2, 1], sample: { eng: ['sasha'], cd: ['kito'] } },
  { id: 'r32-9', time: 'Tue, 07/01', status: 'AET', slots: ['be', 'sn'], score: [3, 2], sample: { be: ['eline'], sn: ['amina'] } },
  { id: 'r32-10', time: 'Tue, 07/01', status: 'FT', slots: ['us', 'ba'], score: [2, 0], sample: { us: ['maya'], ba: ['dado'] } },
  { id: 'r32-11', time: 'Today, 15:00', status: 'Open', slots: ['es', 'at'], score: [null, null], sample: { es: ['sol'], at: ['finn'] } },
  { id: 'r32-12', time: 'Today, 19:00', status: 'Open', slots: ['pt', 'hr'], score: [null, null], sample: { pt: ['ines'], hr: ['marko'] } },
  { id: 'r32-13', time: 'Today, 23:00', status: 'Open', slots: ['ch', 'dz'], score: [null, null], sample: { ch: ['noa'], dz: ['samir'] } },
  { id: 'r32-14', time: 'Fri, 07/03, 14:00', status: 'Open', slots: ['au', 'eg'], score: [null, null], sample: { au: ['matilda'], eg: ['omar'] } },
  { id: 'r32-15', time: 'Fri, 07/03, 18:00', status: 'Open', slots: ['ar', 'cv'], score: [null, null], sample: { ar: ['leo'], cv: ['sofia'] } },
  { id: 'r32-16', time: 'Fri, 07/03, 21:30', status: 'Open', slots: ['co', 'gh'], score: [null, null], sample: { co: ['vale'], gh: ['kwame'] } }
]

const commentary = {
  EN: [
    ['Today', 'Spain vs Austria is the next Round of 32 room. Picks are open until kickoff.'],
    ['19:00Z', 'Portugal vs Croatia follows later today, then Switzerland vs Algeria closes the slate.'],
    ['R32', 'Pool impact is live, but the fallback feed will not invent scores before kickoff.']
  ],
  PT: [
    ['Today', 'Espanha vs Austria e a proxima sala do Round of 32. Palpites abertos ate o inicio.'],
    ['19:00Z', 'Portugal vs Croacia vem depois, e Suica vs Argelia fecha o dia.'],
    ['R32', 'O impacto do bolao esta ativo, mas o fallback nao inventa placares antes do jogo.']
  ],
  ES: [
    ['Today', 'Espana vs Austria es la proxima sala de Round of 32. Picks abiertos hasta el inicio.'],
    ['19:00Z', 'Portugal vs Croacia sigue mas tarde, y Suiza vs Argelia cierra el dia.'],
    ['R32', 'El impacto del pool esta activo, pero el fallback no inventa marcadores antes del partido.']
  ],
  FR: [
    ['Today', 'Espagne vs Autriche est la prochaine salle du Round of 32. Picks ouverts jusqu au coup d envoi.'],
    ['19:00Z', 'Portugal vs Croatie suit ensuite, puis Suisse vs Algerie ferme la journee.'],
    ['R32', 'L impact du pool est actif, mais le fallback ne fabrique pas de score avant le match.']
  ]
}

const defaultChat = [
  { user: 'lina', text: 'Spain/Austria room is up. No fake score until the feed lands.', time: 'Today' },
  { user: 'vera', text: 'Portugal/Croatia pool is next on my list.', time: '19:00Z' },
  { user: 'ash', text: 'Good, bracket is still Round of 32.', time: 'R32' }
]

const liveTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'stats', label: 'Stats' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'games', label: 'Games' },
  { id: 'qvac', label: 'QVAC' }
]

const homeFixtures = [
  { status: 'Today, 15:00', title: 'Spain vs Austria', detail: 'Round of 32 match room', live: false },
  { status: 'Today, 19:00', title: 'Portugal vs Croatia', detail: '$50 pool closing', live: false },
  { status: 'Today, 23:00', title: 'Switzerland vs Algeria', detail: 'Late room opening', live: false }
]

const matchStats = [
  ['Possession', '58%', '42%', 58],
  ['Shots', '12', '6', 67],
  ['xG', '1.82', '0.74', 71],
  ['Pass accuracy', '89%', '81%', 62],
  ['Corners', '5', '2', 71],
  ['Saves', '1', '4', 20]
]

const leaders = [
  { user: 'lina', team: 'br', score: '12/15', prize: '$812' },
  { user: 'amara', team: 'ci', score: '12/15', prize: '$540' },
  { user: 'vera', team: 'no', score: '11/15', prize: '$410' },
  { user: 'diego', team: 'ar', score: '11/15', prize: '$305' },
  { user: 'milo', team: 'mx', score: '10/15', prize: '$190' },
  { user: 'kenji', team: 'jp', score: '10/15', prize: '$120' }
]

const gameRounds = [
  {
    shooter: 'captain',
    shooterTeam: 'br',
    keeper: 'vera',
    keeperTeam: 'no',
    aim: 'right-high',
    dive: 'right-high',
    power: 3,
    curve: 1,
    releaseTick: 42,
    keeperTick: 43
  },
  {
    shooter: 'vera',
    shooterTeam: 'no',
    keeper: 'captain',
    keeperTeam: 'br',
    aim: 'left-low',
    dive: 'center-low',
    power: 4,
    curve: -1,
    releaseTick: 39,
    keeperTick: 41
  },
  {
    shooter: 'captain',
    shooterTeam: 'br',
    keeper: 'milo',
    keeperTeam: 'mx',
    aim: 'center-high',
    dive: 'left-high',
    power: 4,
    curve: 2,
    releaseTick: 45,
    keeperTick: 44
  }
]

const gameLeaderboardRows = [
  { user: 'captain', team: 'br', record: '4-1', trust: '99.2%' },
  { user: 'freya', team: 'hr', record: '4-1', trust: '98.9%' },
  { user: 'vera', team: 'no', record: '3-2', trust: '98.7%' },
  { user: 'kwame', team: 'ci', record: '3-2', trust: '98.1%' },
  { user: 'milo', team: 'mx', record: '3-2', trust: '97.9%' }
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
    enteredPools: {},
    liveConfig: { enabled: false, provider: 'football-data', apiKey: '', matchId: '', proxy: '', pollSec: 30 },
    theme: 'kawaii',
    themeChosen: false,
    chat: defaultChat
  }

  try {
    const saved = JSON.parse(localStorage.getItem('pearcup-prototype') || 'null')
    if (!saved) return fallback
    const merged = {
      ...fallback,
      ...saved,
      chat: saved.chat || defaultChat,
      payoutAddresses: { ...fallback.payoutAddresses, ...(saved.payoutAddresses || {}) },
      wallet: { ...fallback.wallet, ...(saved.wallet || {}) },
      enteredPools: saved.enteredPools || {},
      liveConfig: { ...fallback.liveConfig, ...(saved.liveConfig || {}) }
    }
    // A live peer match can't survive a reload (the connection is gone) — start in the lobby.
    if (merged.match && merged.match.peer) merged.match = null
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
  return next
}

function persist () {
  try {
    localStorage.setItem('pearcup-prototype', JSON.stringify(state))
  } catch {}
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
      <strong>${state.spectators || 38}</strong>
    </div>
    <div class="signal-row">
      <span>Core lag</span>
      <strong>0.4s</strong>
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

const AVATAR_POOL = [
  'p-aria', 'p-rico', 'p-kenji', 'p-amara', 'p-luca', 'p-sofia', 'p-omar', 'p-nina',
  'p-diego', 'p-yuki', 'p-kwame', 'p-ingrid', 'p-rafa', 'p-mei', 'p-tariq', 'p-freya',
  'p-santi', 'p-kofi'
]

function pooledPortrait (name, team) {
  const h = hashString(`${name}-${team && team.id ? team.id : ''}`)
  return `avatars/${AVATAR_POOL[h % AVATAR_POOL.length]}.png`
}

function avatarPortrait (name, team) {
  if (!team || !team.id) return AVATAR_PORTRAITS[String(name).toLowerCase()] || null
  return AVATAR_PORTRAITS[`${name}-${team.id}`] ||
    AVATAR_PORTRAITS[String(name).toLowerCase()] ||
    pooledPortrait(name, team)
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

const KAWAII_HAIR = ['#ff8fc0', '#b79bff', '#7cc4ff', '#ffd76b', '#8a5a3c', '#5a4a6b']
const KAWAII_SKIN = ['#ffe6d3', '#ffd9c0', '#f0c09b', '#d9a17a', '#b97e58']

function avatarSvg (name, team, compact = false) {
  const seed = hashString(`${name}-${team.id}`)
  const scaleClass = compact ? 'compact-avatar' : 'showcase-avatar'
  const prefix = `av-${compact ? 'sm' : 'lg'}-${team.id}-${seed}`.replace(/[^a-z0-9-]/gi, '')
  const jersey = pickJerseyColor(team.colors)
  const jerseyLight = mixHex(jersey, '#ffffff', 0.32)
  const jerseyDeep = mixHex(jersey, '#3a1030', 0.28)
  const accent = team.colors.find(c => c !== jersey) || '#ff8fc0'
  const label = escapeHtml(initials(name))
  const shoe = mixHex(accent, '#ff8fc0', 0.15)
  const skin = KAWAII_SKIN[seed % KAWAII_SKIN.length]
  const skinShade = mixHex(skin, '#e08a6a', 0.45)
  const ariaLabel = `${escapeHtml(name)} anime avatar wearing ${escapeHtml(team.name)} kit`

  const portrait = avatarPortrait(name, team)
  if (portrait) {
    const pv = compact ? '10 10 180 180' : '0 0 200 200'
    return `
    <svg class="avatar-art ${scaleClass}" viewBox="${pv}" role="img" aria-label="${ariaLabel}">
      <defs><clipPath id="${prefix}-pc"><rect x="14" y="14" width="172" height="172" rx="46"/></clipPath></defs>
      <rect x="10" y="10" width="180" height="180" rx="50" fill="${jerseyLight}"/>
      <text x="100" y="113" text-anchor="middle" font-size="44" font-weight="900" fill="${jerseyDeep}" opacity="0.72" font-family="Arial, sans-serif">${label}</text>
      <image href="${escapeHtml(portrait)}" x="14" y="14" width="172" height="172" clip-path="url(#${prefix}-pc)" preserveAspectRatio="xMidYMid slice"/>
      <rect x="14" y="14" width="172" height="172" rx="46" fill="none" stroke="#ffffff" stroke-width="6"/>
      <rect x="14" y="14" width="172" height="172" rx="46" fill="none" stroke="${jersey}" stroke-width="3" opacity="0.6"/>
    </svg>`
  }

  // ---- Seeded cosmetic traits (decorrelated so each user/team reads as a distinct character) ----
  const hair = KAWAII_HAIR[Math.floor(seed / 3) % KAWAII_HAIR.length]
  const hairDeep = mixHex(hair, '#5a2a4a', 0.35)
  const hairLite = mixHex(hair, '#ffffff', 0.28)
  const eyeColors = ['#6b4a2f', '#7a5aa0', '#3f7fbf', '#3fa07f', '#a0567f', '#c06a3a']
  const eyeCol = eyeColors[Math.floor(seed / 19) % eyeColors.length]
  const eyeDeep = mixHex(eyeCol, '#160b0c', 0.5)
  const styleId = Math.floor(seed / 7) % 7
  const eyeId = Math.floor(seed / 11) % 4
  const mouthId = Math.floor(seed / 13) % 4
  const accId = Math.floor(seed / 17) % 5
  const jerseyNumber = String((seed % 89) + 10)
  const hf = `url(#${prefix}-hair)`

  const crown = `<path d="M44 76c-4-36 22-60 56-60s60 24 56 60c-6-16-16-22-24-18 2-8-3-14-10-14 1 7-4 12-10 12 2-9-6-16-12-16s-14 7-12 16c-6 0-11-5-10-12-7 0-12 6-10 14-8-4-18 2-24 18Z" fill="${hf}"/>`

  // Hair drawn BEHIND the head (tails, length).
  const hairBack = [
    '',
    `<path d="M42 78c-18 10-24 40-16 74 12-6 20-8 28-4-8-24-10-48-4-70Z" fill="${hairDeep}"/><path d="M158 78c18 10 24 40 16 74-12-6-20-8-28-4 8-24 10-48 4-70Z" fill="${hairDeep}"/>`,
    `<path d="M150 66c34 6 42 44 26 82-8 20-22 26-30 18 16-30 16-70 4-100Z" fill="${hairDeep}"/>`,
    '',
    `<path d="M38 74c-8 42-6 78 4 100 8-2 14-2 20 2-2-42-2-82-4-108Z" fill="${hairDeep}"/><path d="M162 74c8 42 6 78-4 100-8-2-14-2-20 2 2-42 2-82 4-108Z" fill="${hairDeep}"/>`,
    '',
    ''
  ][styleId]

  // Hair drawn OVER the head (crown, bangs, buns).
  const hairFront = [
    `${crown}<circle cx="46" cy="66" r="16" fill="${hf}"/><circle cx="154" cy="66" r="16" fill="${hf}"/>`,
    `${crown}<circle cx="40" cy="80" r="7" fill="${accent}"/><circle cx="160" cy="80" r="7" fill="${accent}"/>`,
    `${crown}<circle cx="150" cy="64" r="7" fill="${accent}"/>`,
    `<path d="M40 82c-6-26 6-38 14-30-2-16 8-24 16-14 0-16 12-22 20-10 4-16 16-18 22-4 2-16 16-18 22-4 8-12 20-6 20 10 8-8 20 0 14 18-12-8-28-10-44-10s-32 2-44 10Z" fill="${hf}"/>`,
    `<path d="M46 74c0-34 24-56 54-56s54 22 54 56c-6-14-16-20-26-16-6-6-14-6-20 0-6-4-14-4-20 2-8-6-30-2-42 14Z" fill="${hf}"/><path d="M100 20v22" stroke="${hairDeep}" stroke-width="2.5" opacity="0.55" fill="none"/>`,
    `${crown}<circle cx="70" cy="22" r="14" fill="${hf}"/><circle cx="130" cy="22" r="14" fill="${hf}"/><circle cx="70" cy="22" r="6" fill="${hairDeep}" opacity="0.4"/><circle cx="130" cy="22" r="6" fill="${hairDeep}" opacity="0.4"/>`,
    `${crown}<circle cx="52" cy="52" r="12" fill="${hf}"/><circle cx="148" cy="52" r="12" fill="${hf}"/><circle cx="70" cy="34" r="12" fill="${hf}"/><circle cx="130" cy="34" r="12" fill="${hf}"/><circle cx="100" cy="27" r="13" fill="${hf}"/>`
  ][styleId]

  const shine = `<path d="M66 40q34-22 68 2" stroke="${hairLite}" stroke-width="4" opacity="0.5" fill="none" stroke-linecap="round"/>`

  // Eyes.
  const eyes = [
    `<ellipse cx="76" cy="74" rx="13" ry="16" fill="#fff"/><ellipse cx="124" cy="74" rx="13" ry="16" fill="#fff"/>
     <circle cx="77" cy="76" r="11" fill="${eyeCol}"/><circle cx="125" cy="76" r="11" fill="${eyeCol}"/>
     <circle cx="77" cy="77" r="6" fill="${eyeDeep}"/><circle cx="125" cy="77" r="6" fill="${eyeDeep}"/>
     <circle cx="81" cy="71" r="4" fill="#fff"/><circle cx="129" cy="71" r="4" fill="#fff"/>
     <circle cx="73" cy="81" r="2" fill="#fff"/><circle cx="121" cy="81" r="2" fill="#fff"/>`,
    `<path d="M66 79q10-13 20 0" stroke="${eyeDeep}" stroke-width="4" fill="none" stroke-linecap="round"/>
     <path d="M114 79q10-13 20 0" stroke="${eyeDeep}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    `<ellipse cx="76" cy="74" rx="13" ry="16" fill="#fff"/><circle cx="77" cy="76" r="11" fill="${eyeCol}"/><circle cx="77" cy="77" r="6" fill="${eyeDeep}"/><circle cx="81" cy="71" r="4" fill="#fff"/>
     <path d="M114 80q10-13 20 0" stroke="${eyeDeep}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    `<ellipse cx="76" cy="74" rx="14" ry="18" fill="#fff"/><ellipse cx="124" cy="74" rx="14" ry="18" fill="#fff"/>
     <ellipse cx="77" cy="76" rx="11" ry="13" fill="${eyeCol}"/><ellipse cx="125" cy="76" rx="11" ry="13" fill="${eyeCol}"/>
     <circle cx="77" cy="78" r="6" fill="${eyeDeep}"/><circle cx="125" cy="78" r="6" fill="${eyeDeep}"/>
     <circle cx="80" cy="70" r="5" fill="#fff"/><circle cx="128" cy="70" r="5" fill="#fff"/>`
  ][eyeId]

  const brows = (eyeId === 0 || eyeId === 3)
    ? `<path d="M64 58q12-6 22 0" stroke="${hairDeep}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M114 58q12-6 22 0" stroke="${hairDeep}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : ''

  // Mouth.
  const mouth = [
    `<path d="M92 96q8 7 16 0" stroke="${skinShade}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    `<path d="M93 94q7 11 14 0Z" fill="#d16a7a"/><path d="M94 95q6 3 12 0" stroke="#fff" stroke-width="2" fill="none"/>`,
    `<path d="M92 95q4 4 8 0 4 4 8 0" stroke="${skinShade}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    `<ellipse cx="100" cy="97" rx="4" ry="5" fill="#d16a7a"/>`
  ][mouthId]

  // Accessory (headband / clip / cap / bow).
  const accessory = [
    '',
    `<path d="M52 52q48-32 96 0" stroke="${accent}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
    `<g transform="translate(60 50)"><path d="M0 -8 2.4 -2.4 8 -2.4 3.4 1.4 5 7 0 3.4 -5 7 -3.4 1.4 -8 -2.4 -2.4 -2.4Z" fill="${mixHex(accent, '#ffffff', 0.12)}" stroke="#fff" stroke-width="0.8"/></g>`,
    `<path d="M46 54c2-30 22-46 54-46s52 16 54 46c-30-12-78-12-108 0Z" fill="${jersey}"/><path d="M150 54c14-2 24 2 24 8 0 4-8 6-18 4Z" fill="${jerseyDeep}"/><path d="M46 54q54-16 108 0" stroke="${jerseyDeep}" stroke-width="2" opacity="0.5" fill="none"/>`,
    `<g transform="translate(66 30)"><path d="M0 0 -12 -7 -12 7Z" fill="${accent}"/><path d="M0 0 12 -7 12 7Z" fill="${accent}"/><circle r="4" fill="${mixHex(accent, '#ffffff', 0.2)}"/></g>`
  ][accId]

  const viewBox = compact ? '24 4 152 168' : '0 0 200 250'

  return `
    <svg class="avatar-art ${scaleClass}" viewBox="${viewBox}" role="img" aria-label="${ariaLabel}">
      <defs>
        <linearGradient id="${prefix}-kit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${jerseyLight}"/><stop offset="1" stop-color="${jersey}"/>
        </linearGradient>
        <radialGradient id="${prefix}-hair" cx="0.4" cy="0.25" r="0.95">
          <stop offset="0" stop-color="${hairLite}"/><stop offset="1" stop-color="${hair}"/>
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="240" rx="50" ry="8" fill="#e56fa6" opacity="0.2"/>
      <rect x="76" y="178" width="18" height="42" rx="9" fill="${jerseyDeep}"/>
      <rect x="106" y="178" width="18" height="42" rx="9" fill="${jerseyDeep}"/>
      <ellipse cx="82" cy="224" rx="15" ry="8" fill="${shoe}"/>
      <ellipse cx="118" cy="224" rx="15" ry="8" fill="${shoe}"/>
      <path d="M64 158c0-22 16-34 36-34s36 12 36 34l3 26c0 7-5 12-13 12H74c-8 0-13-5-13-12Z" fill="url(#${prefix}-kit)"/>
      <circle cx="100" cy="150" r="15" fill="#ffffff" opacity="0.85"/>
      <text x="100" y="188" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="800" font-size="26" fill="#ffffff">${jerseyNumber}</text>
      <rect x="48" y="152" width="17" height="38" rx="8.5" fill="url(#${prefix}-kit)"/>
      <rect x="135" y="152" width="17" height="38" rx="8.5" fill="url(#${prefix}-kit)"/>
      <circle cx="56" cy="192" r="10" fill="${skin}"/>
      <circle cx="144" cy="192" r="10" fill="${skin}"/>
      ${hairBack}
      <rect x="90" y="106" width="20" height="18" rx="8" fill="${skinShade}"/>
      <circle cx="100" cy="74" r="56" fill="${skin}"/>
      <circle cx="44" cy="80" r="9" fill="${skinShade}"/>
      <circle cx="156" cy="80" r="9" fill="${skinShade}"/>
      ${hairFront}
      ${shine}
      ${accessory}
      <ellipse cx="72" cy="86" rx="12" ry="8" fill="#ff9ec4" opacity="0.6"/>
      <ellipse cx="128" cy="86" rx="12" ry="8" fill="#ff9ec4" opacity="0.6"/>
      ${brows}
      ${eyes}
      ${mouth}
      <path d="M132 132l12 4v14l-12-3Z" fill="#ffffff" opacity="0.9"/>
      <text x="138" y="145" text-anchor="middle" font-size="11" font-family="Arial, sans-serif">${team.flag}</text>
    </svg>
  `
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

function setView (view) {
  state.view = view
  persist()
  renderView(view)
  $$('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === view))
  $$('.topnav button').forEach(button => {
    button.classList.toggle('is-active', button.dataset.view === view)
  })
  if (view === 'bracket') scheduleBracketConnectors()
  if (view === 'games') renderGames()
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
  const amount = state.wallet.balance
  if (amount <= 0) { showToast('Nothing to withdraw'); return }
  state.wallet.balance = 0
  walletLog('Withdraw to payout address', amount, 'debit')
  persist(); refreshWallet(); showToast(`Withdrawing ${fmtMoney(amount)} to your address`)
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
        <button class="primary-button" type="button" data-fund="50">+ Fund 50</button>
        <button class="secondary-button" type="button" data-fund="100">+ 100</button>
        <button class="secondary-button" type="button" data-fund="250">+ 250</button>
        <button class="primary-button wallet-collect" type="button" id="collectPayoutBtn"${w.pendingPayout > 0 ? '' : ' disabled'}>Collect payouts</button>
        <button class="secondary-button" type="button" id="withdrawBtn">Withdraw</button>
      </div>
      <div class="wallet-ledger">
        ${(w.ledger || []).map(row => `
          <div class="wallet-row">
            <span>${escapeHtml(row.label)}</span>
            <strong class="${row.kind}">${row.kind === 'credit' ? '+' : '−'}${escapeHtml(fmtMoney(row.amount))}</strong>
          </div>`).join('')}
      </div>
      <p class="wallet-note">Demo balance. Real funding/withdrawal routes through the Tether WDK deposit &amp; payout rails. Shared across brackets, games, and payouts.</p>
    </div>`
  $$('#walletManage [data-fund]').forEach(b => b.addEventListener('click', () => fundWallet(Number(b.dataset.fund))))
  const collect = $('#collectPayoutBtn'); if (collect) collect.addEventListener('click', collectPayouts)
  const withdraw = $('#withdrawBtn'); if (withdraw) withdraw.addEventListener('click', withdrawWallet)
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

function renderHomeDashboard () {
  const activeTab = liveTabs.some(tab => tab.id === state.liveTab) ? state.liveTab : 'overview'
  state.liveTab = activeTab
  renderHomeHero()

  $('#liveMenu').innerHTML = liveTabs.map(tab => `
    <button type="button" class="${tab.id === activeTab ? 'is-active' : ''}" data-live-tab="${tab.id}">
      ${tab.label}
    </button>
  `).join('')

  $('#liveDetail').innerHTML = renderLivePanel(activeTab)

  // First fixture card mirrors the live feed; the rest are the upcoming schedule.
  const snap = livePanelSnapshot()
  const liveFixture = {
    status: snap.status,
    title: snap.st && snap.st.hasScore === false
      ? `${snap.home.name} vs ${snap.away.name}`
      : `${snap.home.name} ${snap.home.goals} - ${snap.away.goals} ${snap.away.name}`,
    detail: `${state.spectators || 38} peers watching`,
    live: true
  }
  const fixtureList = [liveFixture, ...homeFixtures.filter(f => !f.live)]
  $('#homeFixtures').innerHTML = fixtureList.map(fixture => `
    <div class="mini-fixture ${fixture.live ? 'is-current' : ''}">
      <div>
        <span class="fixture-time">${fixture.status}</span>
        <strong>${fixture.title}</strong>
        <small>${fixture.detail}</small>
      </div>
      <button class="icon-button ${fixture.live ? 'is-live' : ''}" type="button" data-view="watch" aria-label="Open watch room">
        <svg viewBox="0 0 24 24"><path d="${fixture.live ? 'M8 5v14l11-7Z' : 'M4 12h16M12 4v16'}"/></svg>
      </button>
    </div>
  `).join('')

  $('#leaderPanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Bracket</p>
      <strong>Leaders</strong>
    </div>
    <div class="leader-list">
      ${leaders.map((leader, index) => `
        <div class="leader-row">
          <span class="leader-rank">${index + 1}</span>
          ${avatarSvg(leader.user, teamById(leader.team), true)}
          <div>
            <strong>${escapeHtml(leader.user)}</strong>
            <span>${leader.score} correct</span>
          </div>
          <em>${leader.prize}</em>
        </div>
      `).join('')}
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
  const away = st ? st.away : { name: 'Austria', flag: '🇦🇹', goals: 0, teamId: 'at' }
  const status = st ? matchStateLabel(st).txt : 'Kicks off 15:00 ET'
  const events = (state.feedEvents || [])
  return { st, live, home, away, status, events }
}

function renderMomentumChart (snap, lead, momentum) {
  const clamp = value => Math.max(10, Math.min(96, value))
  const diff = Math.abs(snap.home.goals - snap.away.goals)
  const possession = snap.st && Number.isFinite(Number(snap.st.possession)) ? Number(snap.st.possession) : 55 + diff * 4
  const leadBias = lead === snap.home ? possession - 50 : 50 - possession
  const eventBoost = snap.events.slice(0, 6).reduce((boost, ev) => {
    const weight = ev.type === 'goal' ? 12 : ev.type === 'shot' ? 7 : ev.type === 'corner' ? 5 : 3
    return boost + (ev.team === lead.name ? weight : -weight / 2)
  }, 0)
  const base = [32, 38, 46, 43, 54, 61, 58, 69, 74, 71, 82, 78, 88, 92]
  const values = base.map((value, index) => {
    const progress = index / Math.max(1, base.length - 1)
    return clamp(value + leadBias * 0.45 + eventBoost * 0.16 + momentum * 0.24 * progress)
  })
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
  const bars = points.map((point, index) => index % 2 === 0
    ? `<rect class="momentum-band" x="${Number((point.x - 4).toFixed(1))}" y="${point.y}" width="8" height="${Number((bottom - point.y).toFixed(1))}" rx="4"></rect>`
    : '').join('')
  const aria = `${lead.name} momentum plus ${momentum}, ${snap.home.name} ${snap.home.goals} to ${snap.away.goals} ${snap.away.name}`

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
        <text class="momentum-axis is-right" x="${width - left}" y="16">${escapeHtml(lead.name)}</text>
      </svg>
    </div>
    <div class="momentum-meta">
      <span>${escapeHtml(snap.home.name)}</span>
      <strong>+${momentum}</strong>
      <span>${escapeHtml(snap.away.name)}</span>
    </div>
  `
}

function renderLivePanel (tab) {
  const snap = livePanelSnapshot()

  if (tab === 'stats') {
    const st = snap.st
    // Live football-data feed carries score but not possession/shots — fall back to a projection so the card isn't empty.
    const poss = (st && st.possession && st.possession !== 50) ? st.possession : 54
    const shots = (st && st.shots && (st.shots[0] || st.shots[1])) ? st.shots : [7, 4]
    const shotShare = Math.round((shots[0] / Math.max(1, shots[0] + shots[1])) * 100)
    const threat = (st && st.threat && st.threat !== 50) ? st.threat : 61
    const rows = [
      ['Score', String(snap.home.goals), String(snap.away.goals), snap.home.goals + snap.away.goals ? Math.round((snap.home.goals / Math.max(1, snap.home.goals + snap.away.goals)) * 100) : 50],
      ['Possession', `${poss}%`, `${100 - poss}%`, poss],
      ['Shots', String(shots[0]), String(shots[1]), shotShare],
      ['Attacking threat', threat > 66 ? 'High' : threat > 45 ? 'Medium' : 'Low', '', threat]
    ]
    return `
      <div class="live-stat-head">
        <strong>${escapeHtml(snap.home.name)} vs ${escapeHtml(snap.away.name)}</strong>
        <span class="live-pill ${snap.live ? 'is-live' : ''}">${snap.live ? '<i></i>' : ''}${escapeHtml(snap.status)}</span>
      </div>
      <div class="live-stat-grid">
        ${rows.map(([label, home, away, share]) => `
          <article class="live-stat-card">
            <span>${label}</span>
            <div class="split-stat">
              <strong>${escapeHtml(home)}</strong>
              ${away ? `<em>${escapeHtml(away)}</em>` : ''}
            </div>
            <div class="meter"><i style="width:${share}%"></i></div>
          </article>
        `).join('')}
      </div>
    `
  }

  if (tab === 'rooms') {
    const peers = state.spectators || 38
    const roster = ['captain', 'amara', 'diego', 'kenji']
    const rteams = ['br', 'ci', 'ar', 'jp']
    return `
      <div class="room-dashboard">
        <article class="live-card room-card">
          <div class="rail-header">
            <p class="eyebrow">Watch room</p>
            <strong>${peers} peers</strong>
          </div>
          <p class="live-copy">${escapeHtml(snap.home.name)} vs ${escapeHtml(snap.away.name)} · ${escapeHtml(snap.status)}</p>
          <div class="room-preview-avatars">
            ${roster.map((name, index) => avatarSvg(name === 'captain' ? (state.username || 'captain') : name, teamById(rteams[index]), true)).join('')}
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
            <div><span>On the couch</span><strong>5 seated</strong></div>
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
  const diff = Math.abs(snap.home.goals - snap.away.goals)
  const momentum = 6 + diff * 8
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
          <strong>${escapeHtml(lead.name)} +${momentum}</strong>
        </div>
        ${renderMomentumChart(snap, lead, momentum)}
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

function renderPools () {
  const sampleTeams = ['es', 'at', 'pt']
  const railMode = serviceModeLabel(integrationRuntime.readiness.tetherWdk)
  const railState = integrationRuntime.canUseRealMoney ? 'Live USDT' : `${railMode} locked`
  $('#poolGrid').innerHTML = pools.map(pool => `
    <article class="pool-card">
      <div class="pool-top">
        <div>
          <p class="stake">$${pool.tier} <span>entry</span></p>
          <span class="rail-chip ${integrationRuntime.canUseRealMoney ? 'is-live' : 'is-locked'}">Tether WDK ${railState}</span>
        </div>
        <span class="pool-badge">${pool.heat}</span>
      </div>
      <div class="pool-meta">
        <div><span>Prize pool</span><strong>${pool.prize}</strong></div>
        <div><span>Entrants</span><strong>${pool.entrants}/${pool.max}</strong></div>
        <div><span>Closes</span><strong>${pool.closes}</strong></div>
      </div>
      <div class="pool-footer">
        <div class="avatar-stack" aria-hidden="true">
          ${sampleTeams.map((id, index) => avatarSvg(['lina', 'vera', 'milo'][index], teamById(id), true)).join('')}
        </div>
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
  const poolId = `world-cup-${selectedPool.tier}`
  const amount = selectedPool.tier
  const entrants = [
    { username: state.username || 'captain', userId: gameUserId(state.username || 'captain'), teamId: state.team },
    { username: 'lina', userId: 'user-lina', teamId: 'br' },
    { username: 'amara', userId: 'user-amara', teamId: 'ci' },
    { username: 'diego', userId: 'user-diego', teamId: 'ar' },
    { username: 'vera', userId: 'user-vera', teamId: 'no' },
    { username: 'kenji', userId: 'user-kenji', teamId: 'jp' }
  ]
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
    actorId: 'settlement-worker'
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

function makeMatch (id, time, status, slots, score = [null, null], sample = {}) {
  return { id, time, status, slots, score, sample }
}

function buildRounds () {
  const round32 = round32Matches.map(match => makeMatch(match.id, match.time, match.status, match.slots, match.score, match.sample))
  const round16 = [
    makeMatch('r16-1', 'Sat, 07/04, 00:00', 'Next', [getPick('r32-1'), getPick('r32-2')], [null, null], {}),
    makeMatch('r16-2', 'Sat, 07/04, 04:00', 'Next', [getPick('r32-3'), getPick('r32-4')], [null, null], {}),
    makeMatch('r16-3', 'Sun, 07/05, 00:00', 'Next', [getPick('r32-5'), getPick('r32-6')], [null, null], {}),
    makeMatch('r16-4', 'Sun, 07/05, 04:00', 'Next', [getPick('r32-7'), getPick('r32-8')], [null, null], {}),
    makeMatch('r16-5', 'Mon, 07/06, 00:00', 'Next', [getPick('r32-9'), getPick('r32-10')], [null, null], {}),
    makeMatch('r16-6', 'Mon, 07/06, 04:00', 'Next', [getPick('r32-11'), getPick('r32-12')], [null, null], {}),
    makeMatch('r16-7', 'Tue, 07/07, 00:00', 'Next', [getPick('r32-13'), getPick('r32-14')], [null, null], {}),
    makeMatch('r16-8', 'Tue, 07/07, 04:00', 'Next', [getPick('r32-15'), getPick('r32-16')], [null, null], {})
  ]
  const qf = [
    makeMatch('qf-1', 'Thu, 07/09, 00:00', 'Open', [getPick('r16-1'), getPick('r16-2')], [null, null], {}),
    makeMatch('qf-2', 'Fri, 07/10, 00:00', 'Open', [getPick('r16-3'), getPick('r16-4')], [null, null], {}),
    makeMatch('qf-3', 'Fri, 07/10, 04:00', 'Open', [getPick('r16-5'), getPick('r16-6')], [null, null], {}),
    makeMatch('qf-4', 'Sat, 07/11, 00:00', 'Open', [getPick('r16-7'), getPick('r16-8')], [null, null], {})
  ]
  const semi = [
    makeMatch('sf-1', 'Tue, 07/14, 00:00', 'Open', [getPick('qf-1'), getPick('qf-2')], [null, null], {}),
    makeMatch('sf-2', 'Wed, 07/15, 00:00', 'Open', [getPick('qf-3'), getPick('qf-4')], [null, null], {})
  ]
  const final = [
    makeMatch('final-1', 'Sun, 07/19, 01:00', 'Open', [getPick('sf-1'), getPick('sf-2')], [null, null], {})
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
  const owners = [...(match.sample[teamId] || [])]
  if (getPick(match.id) === teamId) owners.unshift(state.username || 'you')
  return owners.slice(0, 2)
}

function renderTeamRow (match, teamId, index) {
  const team = teamId ? teamById(teamId) : null
  const picked = team && getPick(match.id) === team.id
  const score = match.score[index]

  if (!team) {
    return `
      <button class="team-row" type="button" disabled>
        <span class="team-flag" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z" fill="#717982"/></svg>
        </span>
        <span class="team-title">A determ.</span>
        <span class="score"></span>
      </button>
    `
  }

  const chips = ownersFor(match, team.id).map(owner => `<span class="pick-chip">${escapeHtml(owner)}</span>`).join('')

  return `
    <button class="team-row ${picked ? 'is-picked' : ''}" type="button" data-match="${match.id}" data-pick="${team.id}" aria-pressed="${picked}">
      <span class="team-flag">${team.flag}</span>
      <span class="team-title">${escapeHtml(team.name)}</span>
      <span class="pick-side">
        ${chips}
        <span class="score">${score === null ? '' : score}</span>
      </span>
    </button>
  `
}

function renderPoolSelect () {
  const el = $('#bracketPoolSelect')
  if (!el) return
  el.innerHTML = pools.map(pool => {
    const entered = !!state.enteredPools[pool.tier]
    const selected = pool.tier === state.selectedTier
    const affordable = state.wallet.balance >= pool.tier
    const cta = entered ? '✓ Entered' : selected ? (affordable ? `Enter · $${pool.tier}` : 'Fund to enter') : 'Select'
    const badge = pool.tier >= 100 ? 'pool-elite' : pool.tier >= 50 ? 'pool-gold' : pool.tier >= 25 ? 'pool-silver' : 'pool-bronze'
    return `
      <button class="pool-pick${selected ? ' is-selected' : ''}${entered ? ' is-entered' : ''}" type="button" data-pool="${pool.tier}">
        <img class="pool-pick-badge" src="assets/${badge}.png" alt="">
        <span class="pool-pick-heat">${pool.heat}</span>
        <span class="pool-pick-fee">$${pool.tier}</span>
        <span class="pool-pick-meta">${pool.prize} prize · ${pool.entrants} in</span>
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
  if (state.enteredPools[tier]) { showToast(`You're already in the $${tier} bracket`); return }
  if (!debitWallet(tier, `$${tier} bracket entry`)) {
    showToast('Not enough balance — fund your wallet first')
    setView('onboarding')
    return
  }
  state.enteredPools[tier] = true
  persist()
  renderBracket()
  showToast(`Entered the $${tier} bracket · ${fmtMoney(tier)} escrowed via WDK`)
}

function renderBracketEntrants (settlement) {
  const el = $('#bracketEntrants')
  if (!el) return
  const ledger = settlement.entryLedger || []
  const youIn = !!state.enteredPools[state.selectedTier]
  const you = youIn
    ? [{ username: state.username || 'captain', teamId: state.team, you: true }]
    : []
  const others = ledger.map(entry => ({ username: entry.entrant.username, teamId: entry.entrant.teamId }))
  const everyone = [...you, ...others].slice(0, 14)
  const count = $('#enteredCount')
  if (count) count.textContent = `· ${(settlement.entryCount || others.length) + (youIn ? 1 : 0)} in this pool`
  el.innerHTML = everyone.length
    ? everyone.map(person => `
        <span class="entered-chip${person.you ? ' is-you' : ''}">
          ${avatarSvg(person.username, teamById(person.teamId), true)}
          <em>${escapeHtml(person.you ? 'You' : person.username)}</em>
        </span>`).join('')
    : '<p class="live-copy">No entries yet — be the first to enter this bracket.</p>'
}

function settlementStackAvailable () {
  return Boolean(
    PearCupWorkerSim &&
    PearCupWorkerClient &&
    PearCupStorageSim &&
    PearCupTransportSim &&
    PearCupSettlementService
  )
}

function demoBracketEntrants () {
  return [
    { entrant: { username: 'lina', userId: 'user-lina', teamId: 'br' } },
    { entrant: { username: 'amara', userId: 'user-amara', teamId: 'ci' } },
    { entrant: { username: 'diego', userId: 'user-diego', teamId: 'ar' } },
    { entrant: { username: 'vera', userId: 'user-vera', teamId: 'no' } },
    { entrant: { username: 'kenji', userId: 'user-kenji', teamId: 'jp' } }
  ]
}

function renderBracketDemoStats (selectedPool) {
  const entered = !!state.enteredPools[selectedPool.tier]
  const remaining = remainingPicks()
  const status = integrationRuntime.readiness.settlement
  if ($('#bracketStats')) $('#bracketStats').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Pool</p><strong>${selectedPool.prize}</strong></div>
      <div class="settlement-kpis">
        <div><span>Entrants</span><strong>${selectedPool.entrants}/${selectedPool.max}</strong></div>
        <div><span>Your entry</span><strong>${entered ? 'Entered' : 'Open'}</strong></div>
        <div><span>Picks</span><strong>${remaining > 0 ? `${remaining} left` : 'Complete'}</strong></div>
      </div>
    </article>
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Settlement</p><strong>${status.label}</strong></div>
      <p class="live-copy">Demo entries are ready for tonight; real payouts stay locked until the worker settlement stack is explicitly enabled.</p>
    </article>`

  if ($('#bracketEntriesPanel')) $('#bracketEntriesPanel').innerHTML = `
    <article class="settlement-rail-card entry-ledger-card">
      <div class="rail-header"><p class="eyebrow">Entries</p><strong>Pick'em pool</strong></div>
      <div class="entry-ledger">
        ${demoBracketEntrants().map(row => {
          const team = teamById(row.entrant.teamId)
          return `
            <div class="entry-ledger-row is-confirmed">
              <div class="entry-person">
                ${avatarSvg(row.entrant.username, team, true)}
                <div>
                  <strong>${escapeHtml(row.entrant.username)}</strong>
                  <span>${team.flag} ${escapeHtml(team.name)}</span>
                </div>
              </div>
              <span class="rail-state is-confirmed">Ready</span>
            </div>`
        }).join('')}
      </div>
    </article>`

  if ($('#bracketAudit')) $('#bracketAudit').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Audit</p><strong>P2P game mode ready</strong></div>
      <div class="hash-list compact-hash">
        <div><span>Prize gate</span><code>${status.status}</code></div>
        <div><span>Payouts</span><code>disabled</code></div>
        <div><span>P2P modules</span><code>${document.documentElement.dataset.pearcupP2pModules || 'checking'}</code></div>
        <div><span>Backend</span><code>${document.documentElement.dataset.pearcupPeerNet || 'detecting'}</code></div>
      </div>
    </article>`

  renderBracketEntrants({
    entryLedger: demoBracketEntrants(),
    entryCount: selectedPool.entrants
  })
}

function renderBracketBoard () {
  const placements = {
    round32: index => ({ column: 1, row: index + 2, span: 1 }),
    round16: index => ({ column: 2, row: 2 + (index * 2), span: 2 }),
    quarter: index => ({ column: 3, row: 3 + (index * 4), span: 4 }),
    semi: index => ({ column: 4, row: 5 + (index * 8), span: 8 }),
    final: () => ({ column: 5, row: 9, span: 8 })
  }
  const rounds = buildRounds()

  $('#bracketBoard').innerHTML = `
    <svg class="bracket-lines" id="bracketLines" aria-hidden="true"></svg>
    ${rounds.map((round, roundIndex) => `
    <p class="round-title" style="grid-column:${roundIndex + 1};grid-row:1">${round.label}</p>
    ${round.matches.map((match, index) => {
      const place = placements[round.key](index)
      return `
        <article class="match-card bracket-match" data-round="${round.key}" data-match-card="${match.id}" style="grid-column:${place.column};grid-row:${place.row} / span ${place.span}">
          <div class="match-meta">
            <span>${match.time}</span>
            <span class="match-status">${match.status}</span>
          </div>
          ${renderTeamRow(match, match.slots[0], 0)}
          ${renderTeamRow(match, match.slots[1], 1)}
        </article>
      `
    }).join('')}
    `).join('')}
  `

  $$('#bracketBoard [data-pick]').forEach(button => {
    button.addEventListener('click', () => {
      state.picks[button.dataset.match] = button.dataset.pick
      clearDownstream(button.dataset.match)
      persist()
      renderBracket()
    })
  })
  scheduleBracketConnectors()
}

async function renderBracket () {
  const renderId = ++bracketRenderSequence
  const selectedPool = pools.find(pool => pool.tier === state.selectedTier) || pools[1]
  const wdk = integrationRuntime.readiness.tetherWdk
  const entered = !!state.enteredPools[selectedPool.tier]
  $('#bracketTierLabel').textContent = `$${selectedPool.tier} pool${entered ? ' · entered' : ''}`
  renderPoolSelect()
  const remaining = remainingPicks()
  const pr = $('#picksRemaining')
  if (pr) pr.textContent = remaining > 0 ? `${remaining} left` : 'complete ✓'
  // Signpost the flow: highlight the step the user should act on next.
  const steps = $$('#bracket .bracket-step')
  if (steps.length >= 3) {
    steps.forEach(s => s.classList.remove('step-active'))
    steps[!entered ? 0 : remaining > 0 ? 2 : 2].classList.add('step-active')
    if (entered && remaining === 0) steps[2].classList.remove('step-active')
  }
  const statsEl = $('#bracketStats')
  if (statsEl) statsEl.innerHTML = '<p class="live-copy">Building WDK entry intents, QVAC attestation, and replay roots…</p>'
  renderBracketBoard()

  if (!settlementStackAvailable()) {
    renderBracketDemoStats(selectedPool)
    return
  }

  let settlement
  try {
    settlement = await resolveBracketSettlement(selectedPool)
  } catch (err) {
    if (renderId !== bracketRenderSequence) return
    renderSettlementError($('#bracketStats'), err, 'Bracket settlement blocked')
    return
  }
  if (renderId !== bracketRenderSequence) return

  const processorPayout = settlement.payout && settlement.payout.processorPayout
  const processorStatus = processorPayout
    ? processorPayout.status
    : settlement.payout && settlement.payout.status === 'prepared' ? 'prepared' : 'held'
  const payoutPrepared = settlement.payout &&
    settlement.payout.status === 'prepared' &&
    processorStatus !== 'recipient-required'
  const payoutStatus = payoutStatusMeta(processorStatus)
  const grossPool = settlement.payout && settlement.payout.grossPool != null
    ? `${settlement.payout.grossPool} ${settlement.payout.asset}`
    : 'Held'
  const splitAmount = settlement.payout && settlement.payout.amountEach != null
    ? `${settlement.payout.amountEach} each`
    : settlement.payout && settlement.payout.reason
    ? 'Disputed'
    : 'Pending'

  if ($('#bracketStats')) $('#bracketStats').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Tether WDK</p><strong>${serviceModeLabel(wdk)} bracket rail</strong></div>
      <div class="settlement-kpis">
        <div><span>Confirmed entries</span><strong>${settlement.entryCount}</strong></div>
        <div><span>Pending checks</span><strong>${settlement.pendingEntryChecks}</strong></div>
        <div><span>Payout</span><strong>${payoutStatus.label}</strong></div>
      </div>
    </article>
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Pool</p><strong>${grossPool}</strong></div>
      <div class="settlement-kpis single-row">
        <div><span>Split</span><strong>${splitAmount}</strong></div>
        <div><span>Events</span><strong>${settlement.storage.events}</strong></div>
        <div><span>Replay</span><strong>${settlement.storage.replayMatched ? 'Matched' : 'Mismatch'}</strong></div>
      </div>
    </article>`

  if ($('#bracketEntriesPanel')) $('#bracketEntriesPanel').innerHTML = `
    <article class="settlement-rail-card entry-ledger-card">
      <div class="rail-header"><p class="eyebrow">WDK entries</p><strong>Intent → reconcile → confirm</strong></div>
      ${renderEntryLedger(settlement)}
    </article>
    <article class="settlement-rail-card payout-recipient-card">
      <div class="rail-header"><p class="eyebrow">WDK payout</p><strong>${payoutPrepared ? 'Recipient quoted' : payoutStatus.label}</strong></div>
      ${renderPayoutRecipients(settlement)}
    </article>`

  if ($('#bracketAudit')) $('#bracketAudit').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Audit</p><strong>${settlement.qvacAttestation.ruling === 'verified' ? 'QVAC verified' : 'QVAC disputed'}</strong></div>
      <div class="hash-list compact-hash">
        <div><span>Guard mode</span><code>${settlement.guardMode}</code></div>
        <div><span>Prize gate</span><code>${settlement.settlementGate.status}</code></div>
        <div><span>QVAC attestation</span><code>${settlement.qvacAttestation.attestationId}</code></div>
        <div><span>Recipient declarations</span><code>${settlement.recipientDeclarationCount}</code></div>
        <div><span>Receipt hash</span><code>${escapeHtml(settlement.settlementReceipt && settlement.settlementReceipt.receiptHash || 'pending')}</code></div>
        <div><span>Receipt event</span><code>${escapeHtml(settlement.settlementReceiptEvent && settlement.settlementReceiptEvent.eventId || 'pending')}</code></div>
        <div><span>Pool namespace</span><code>${settlement.storage.namespace}</code></div>
        <div><span>Event root</span><code>${settlement.storage.eventRoot}</code></div>
        <div><span>Replay root</span><code>${settlement.storage.replayRoot}</code></div>
      </div>
    </article>`

  renderBracketEntrants(settlement)
  bindPayoutControls()
  const placements = {
    round32: index => ({ column: 1, row: index + 2, span: 1 }),
    round16: index => ({ column: 2, row: 2 + (index * 2), span: 2 }),
    quarter: index => ({ column: 3, row: 3 + (index * 4), span: 4 }),
    semi: index => ({ column: 4, row: 5 + (index * 8), span: 8 }),
    final: () => ({ column: 5, row: 9, span: 8 })
  }
  const rounds = buildRounds()

  $('#bracketBoard').innerHTML = `
    <svg class="bracket-lines" id="bracketLines" aria-hidden="true"></svg>
    ${rounds.map((round, roundIndex) => `
    <p class="round-title" style="grid-column:${roundIndex + 1};grid-row:1">${round.label}</p>
    ${round.matches.map((match, index) => {
      const place = placements[round.key](index)
      return `
        <article class="match-card bracket-match" data-round="${round.key}" data-match-card="${match.id}" style="grid-column:${place.column};grid-row:${place.row} / span ${place.span}">
          <div class="match-meta">
            <span>${match.time}</span>
            <span class="match-status">${match.status}</span>
          </div>
          ${renderTeamRow(match, match.slots[0], 0)}
          ${renderTeamRow(match, match.slots[1], 1)}
        </article>
      `
    }).join('')}
    `).join('')}
  `

  $$('#bracketBoard [data-pick]').forEach(button => {
    button.addEventListener('click', () => {
      state.picks[button.dataset.match] = button.dataset.pick
      clearDownstream(button.dataset.match)
      persist()
      renderBracket()
    })
  })
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

function watchParticipants () {
  const livePick = ['es', 'at'].includes(state.picks['r32-11']) ? state.picks['r32-11'] : 'es'
  return [
    { name: state.username || 'captain', pick: livePick, role: 'you' },
    { name: 'lina', pick: 'es', role: 'stream host' },
    { name: 'amara', pick: 'at', role: 'voice' },
    { name: 'vera', pick: 'at', role: 'voice' },
    { name: 'diego', pick: 'es', role: 'chat' },
    { name: 'kwame', pick: 'at', role: 'chat' }
  ]
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
    minute: 0,
    home: { name: 'Spain', flag: '🇪🇸', teamId: 'es', goals: 0 },
    away: { name: 'Austria', flag: '🇦🇹', teamId: 'at', goals: 0 },
    possession: 50,
    shots: [0, 0],
    threat: 50,
    hasScore: false,
    matchStatus: 'TIMED',
    utcDate: '2026-07-02T19:00:00Z',
    stage: 'LAST_32',
    competition: { name: 'FIFA World Cup' }
  }
  const emit = ev => listeners.forEach(fn => fn(ev, st))
  function tick () {
    if (st.matchStatus === 'TIMED' || st.matchStatus === 'SCHEDULED') {
      emit({ type: 'preview', team: 'Spain vs Austria room is open. Kickoff is 15:00 ET.', clock: 'Soon', minute: 0 })
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
    const m = Array.isArray(data.matches) ? data.matches[0] : data
    if (!m) throw new Error('No live match found')
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
    possession: 50, shots: [0, 0], threat: 50, matchStatus: 'connecting'
  }
  const emit = ev => listeners.forEach(fn => fn(ev, st))
  async function poll () {
    try {
      const data = await apiRequest(config)
      const first = st._total === undefined
      const prevHome = st.home.goals
      const prevTotal = st._total
      mapFeed(st, config.provider, data)
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
    state.feedEvents = [
      { clock: 'Today', type: 'preview', team: 'Spain vs Austria room is open.' },
      { clock: '19:00Z', type: 'preview', team: 'Kickoff at SoFi Stadium.' },
      { clock: 'R32', type: 'preview', team: 'Portugal vs Croatia and Switzerland vs Algeria follow later today.' }
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
  const crest = url => url
    ? `<span class="lb-crestwrap"><img class="lb-crest" src="${escapeHtml(url)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="lb-crest lb-crest-blank" style="display:none">⚽</span></span>`
    : '<div class="lb-crest lb-crest-blank">⚽</div>'
  el.innerHTML = `
    <div class="lb-comp">
      ${st.competition && st.competition.emblem ? `<img class="lb-emblem" src="${escapeHtml(st.competition.emblem)}" alt="">` : ''}
      <span>${escapeHtml((st.competition && st.competition.name) || 'FIFA World Cup')}${stageLabel(st) ? ' · ' + stageLabel(st) : ''}</span>
    </div>
    <div class="lb-teams">
      <div class="lb-team">${crest(st.home.crest)}<strong>${escapeHtml(st.home.name)}</strong></div>
      <div class="lb-score">${scoreMid}</div>
      <div class="lb-team">${crest(st.away.crest)}<strong>${escapeHtml(st.away.name)}</strong></div>
    </div>
    <div class="lb-state ${info.cls}">${info.dot ? '<i></i>' : ''}${escapeHtml(info.txt)}</div>`
}

function renderLiveSource (st) {
  const el = $('#liveSource')
  if (!el) return
  el.innerHTML = `
    <span class="ls-badge"><i></i>LIVE DATA</span>
    <span class="ls-src">Football-Data.org${st.lastUpdated ? ` · updated ${fmtTime(st.lastUpdated)}` : ''}</span>
    <button class="ls-refresh" id="liveRefresh" type="button">↻ Refresh</button>`
  const r = $('#liveRefresh')
  if (r) r.onclick = () => { if (activeFeed && activeFeed.poll) { activeFeed.poll(); showToast('Refreshing live data…') } }
}

function renderWatchStats (st) {
  const el = $('#watchStats')
  if (!el) return
  if (isLiveApi()) {
    el.className = 'stats-strip is-live-meta'
    const chip = (label, val) => `<div class="live-meta"><span>${label}</span><strong>${escapeHtml(val || '—')}</strong></div>`
    el.innerHTML =
      chip('Status', matchStateLabel(st).txt) +
      chip('Kickoff', fmtTime(st.utcDate)) +
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
  const clockTxt = st.matchStatus === 'FINISHED' || st.minute >= 90
    ? 'FT'
    : st.minute ? `${st.minute}'`
    : (st.matchStatus === 'IN_PLAY' || st.matchStatus === 'PAUSED' || st.matchStatus === 'LIVE') ? 'LIVE'
    : st.matchStatus === 'TIMED' || st.matchStatus === 'SCHEDULED' ? 'Soon'
    : `${st.minute || 0}'`
  const clock = $('#tvClock'); if (clock) clock.textContent = clockTxt
  const score = $('#tvScore'); if (score) score.textContent = st.hasScore === false
    ? `${st.home.name} vs ${st.away.name}`
    : `${st.home.name} ${st.home.goals} - ${st.away.goals} ${st.away.name}`
  const title = $('#watchTitle'); if (title) title.textContent = `${st.home.name} vs ${st.away.name}`
  // Live vs simulated presentation: real API → rich scoreboard + source badge.
  const tv = document.querySelector('#watch .stadium-tv')
  const board = $('#tvLiveBoard'); const src = $('#liveSource')
  if (isLiveApi()) {
    if (tv) tv.classList.add('is-live')
    if (board) { board.hidden = false; renderLiveBoard(st) }
    if (src) { src.hidden = false; renderLiveSource(st) }
  } else {
    if (tv) tv.classList.remove('is-live')
    if (board) board.hidden = true
    if (src) src.hidden = true
  }
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
  }
  // Watch room key follows the current match — re-join if it changed (e.g. sim → live).
  if (window.PearCupWatchSync && document.querySelector('#watch')?.classList.contains('is-active')) {
    window.PearCupWatchSync.ensureRoom()
  }
}

// Same-origin relay file a Pear worker / fetch-live.mjs writes. When present it
// IS the production live path (no CORS, no key in the browser).
const RELAY_FILE = 'live-match.json'
function isRelay (proxy) { return /\.json(\?|$)/.test(proxy || '') }

// Auto-detect the relay: if live-match.json is being written (real match data),
// switch the Watch feed to it automatically — no manual settings needed.
async function detectLiveRelay () {
  const cfg = state.liveConfig || {}
  if (cfg.apiKey && cfg.enabled) return           // an explicit API/proxy config wins
  try {
    const res = await fetch(`${RELAY_FILE}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const m = await res.json()                     // ensure it parses
    // Staleness guard: the packaged app ships whatever snapshot was staged. A finished
    // match whose data is >12h old is yesterday's news — don't present it as live.
    const stamp = Date.parse(m.lastUpdated || m.utcDate || 0) || 0
    const finished = (m.status || '') === 'FINISHED'
    if (finished && Date.now() - stamp > 12 * 3600 * 1000) {
      // Also unwind a previously auto-enabled relay so persisted configs go stale-safe.
      if (cfg.enabled && isRelay(cfg.proxy)) {
        state.liveConfig = { ...cfg, enabled: false, proxy: '' }
        persist()
        startLiveFeed()
      }
      return
    }
    state.liveConfig = { ...cfg, enabled: true, proxy: RELAY_FILE }
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

// ---- Screen share (real getDisplayMedia capture; P2P relay to peers is the Pear/WebRTC seam) ----
let shareStream = null
async function startScreenShare () {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showToast('Screen share needs the Pear runtime / a supported browser')
    return
  }
  try {
    shareStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false })
  } catch (err) { showToast('Screen share cancelled'); return }
  const video = $('#shareVideo')
  if (video) { video.srcObject = shareStream; video.hidden = false; video.play().catch(() => {}) }
  const pitch = $('#tvPitch'); if (pitch) pitch.style.opacity = '0'
  const badge = $('#shareBadge'); if (badge) { badge.hidden = false; badge.innerHTML = `<i></i>You are sharing your screen · relaying to ${Math.max(1, (state.spectators || 2) - 1)} peer${(state.spectators || 2) - 1 === 1 ? '' : 's'}` }
  const btn = $('#shareScreenBtn'); if (btn) btn.classList.add('is-live')
  showToast('Sharing your screen to the room')
  const track = shareStream.getVideoTracks()[0]
  if (track) track.addEventListener('ended', stopScreenShare)
}
function stopScreenShare () {
  if (shareStream) { shareStream.getTracks().forEach(t => t.stop()); shareStream = null }
  const video = $('#shareVideo'); if (video) { video.hidden = true; video.srcObject = null }
  const pitch = $('#tvPitch'); if (pitch) pitch.style.opacity = ''
  const badge = $('#shareBadge'); if (badge) badge.hidden = true
  const btn = $('#shareScreenBtn'); if (btn) btn.classList.remove('is-live')
}
function toggleScreenShare () { shareStream ? stopScreenShare() : startScreenShare() }

// ---- Share the room / spectate (surfaces the existing P2P topic; sim peers join now) ----
let spectatorTimer = null
function roomCode () {
  const st = feedState()
  const seed = hashString(`${st.home.teamId}-${st.away.teamId}-${state.username || 'host'}`)
  return `pear://pearcup/watch/${st.home.teamId}-${st.away.teamId}-${(seed % 100000).toString(36)}`
}
function toggleInviteBar () {
  const bar = $('#roomShareBar')
  if (!bar) return
  if (!bar.hidden) { bar.hidden = true; stopSpectatorSim(); return }
  const code = roomCode()
  state.spectators = state.spectators || 38
  bar.hidden = false
  bar.innerHTML = `
    <div class="share-room-head"><strong>Watching together</strong><span id="spectatorCount">${state.spectators} peers watching</span></div>
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
  startSpectatorSim()
}
function startSpectatorSim () {
  stopSpectatorSim()
  spectatorTimer = setInterval(() => {
    state.spectators = Math.max(12, (state.spectators || 38) + (Math.random() > 0.4 ? 1 : -1))
    const el = $('#spectatorCount')
    if (el) el.textContent = `${state.spectators} peers watching`
    else stopSpectatorSim()
  }, 2600)
}
function stopSpectatorSim () { if (spectatorTimer) { clearInterval(spectatorTimer); spectatorTimer = null } }

function renderWatch () {
  startLiveFeed()
  seedFeedEvents()
  renderWatchStats(feedState())
  applyFeedTick(null, feedState())
  const room = watchParticipants()
  const grouped = ['es', 'at'].map(teamId => {
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

  $('#voiceToggle').classList.toggle('is-live', state.voice)

  // Join the shared watch room for this match (chat + reactions + presence sync).
  if (window.PearCupWatchSync) { window.PearCupWatchSync.ensureRoom(); window.PearCupWatchSync.bindReactionBar(); window.PearCupWatchSync.updatePresence() }
}

function currentGameRound () {
  const round = gameRounds[state.gameRound % gameRounds.length]
  const username = state.username || 'captain'
  if (round.shooter === 'captain') return { ...round, shooter: username, shooterTeam: state.team }
  if (round.keeper === 'captain') return { ...round, keeper: username, keeperTeam: state.team }
  return round
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
    actorId: 'settlement-worker'
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
const KEEPER_ROSTER = [
  { name: 'vera', team: 'no' },
  { name: 'milo', team: 'mx' },
  { name: 'lina', team: 'no' },
  { name: 'saki', team: 'jp' },
  { name: 'dado', team: 'ci' }
]

// Players waiting in the lobby (sim now; real = peers announcing on the
// `pearcup-penalty-lobby` hyperswarm topic).
const LOBBY_PLAYERS = [
  { name: 'Kaito', team: 'jp', record: '7-2', stake: 25, wait: '0:12' },
  { name: 'Mateo', team: 'ar', record: '5-4', stake: 10, wait: '0:31' },
  { name: 'Emre', team: 'ch', record: '9-1', stake: 50, wait: '0:04' },
  { name: 'Zola', team: 'ci', record: '4-3', stake: 10, wait: '1:02' }
]

// The keeper for the whole shootout is the matched opponent (falls back to the roster).
function currentOpponent () {
  if (state.match && state.match.opponent) return state.match.opponent
  const pick = KEEPER_ROSTER[(state.shootout ? state.shootout.round : 0) % KEEPER_ROSTER.length]
  return { name: pick.name, team: pick.team }
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

// AI keeper skill from the opponent's lobby record (e.g. '9-1' → hard to beat).
function opponentDifficulty (pick) {
  const rec = (pick && pick.record) || ((LOBBY_PLAYERS.find(p => p.name === (pick && pick.name)) || {}).record)
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

function renderGameLeaderboard () {
  $('#gameLeaderboard').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Games</p>
      <strong>${integrationRuntime.readiness.settlement.realMoneyEnabled ? 'Trusted results' : 'Demo results'}</strong>
    </div>
    <div class="leader-list">
      ${gameLeaderboardRows.map((row, index) => `
        <div class="game-leader-row">
          <span class="leader-rank">${index + 1}</span>
          ${avatarSvg(row.user === 'captain' ? (state.username || 'captain') : row.user, teamById(row.team), true)}
          <div>
            <strong>${escapeHtml(row.user === 'captain' ? (state.username || 'captain') : row.user)}</strong>
            <span>${row.record} record</span>
          </div>
          <em>${row.trust}</em>
        </div>
      `).join('')}
    </div>`
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
  try {
    const raw = new URLSearchParams(location.search).get('join') || ''
    return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
  } catch (e) {
    return ''
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
      <button class="lobby-quick" id="quickMatchBtn" type="button">⚡ Practice vs AI</button>
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

    <p class="lobby-label lobby-label-muted">AI opponents · practice free or stake up</p>
    <div class="lobby-list">
      ${LOBBY_PLAYERS.map((p, i) => `
        <div class="lobby-card">
          ${avatarSvg(p.name, teamById(p.team), true)}
          <div class="lobby-info">
            <strong>${escapeHtml(p.name)}</strong>
            <span>${teamById(p.team).flag} ${p.record} record · ${opponentDifficulty(p) > 0.5 ? 'sharp' : 'steady'} keeper</span>
          </div>
          <div class="lobby-stake">$${p.stake}</div>
          <button class="secondary-button compact-action lobby-challenge" data-lobby="${i}" type="button">Challenge</button>
        </div>`).join('')}
    </div>`
  const practice = p => ({ ...p, stake: 0 })
  const quick = $('#quickMatchBtn')
  if (quick) quick.addEventListener('click', () => startMatch(practice(LOBBY_PLAYERS[Math.floor(Math.random() * LOBBY_PLAYERS.length)])))
  $$('#gameLobby .lobby-challenge').forEach(btn => btn.addEventListener('click', () => showStakeConfirm(LOBBY_PLAYERS[Number(btn.dataset.lobby)])))
  const invite = $('#inviteFriendBtn')
  if (invite) invite.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.host())
  const joinFriend = $('#joinFriendBtn')
  if (joinFriend) joinFriend.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.promptJoin())
  renderPeerBackendBadge()
  // Live matchmaking: announce on the lobby topic + render online peers.
  if (window.PearCupLobby) { window.PearCupLobby.join(); window.PearCupLobby.renderList() }
}

// Staked AI challenge: explicit consent before any wallet debit (practice stays free).
function showStakeConfirm (player) {
  const old = $('#stakeConfirm'); if (old) old.remove()
  const stake = player.stake || 0
  const ov = document.createElement('div')
  ov.id = 'stakeConfirm'
  ov.className = 'peer-modal'
  ov.setAttribute('role', 'dialog')
  ov.setAttribute('aria-modal', 'true')
  ov.innerHTML = `
    <div class="peer-modal-card">
      <p class="eyebrow">Penalty Clash · Challenge</p>
      <h2 class="peer-title">${escapeHtml(player.name)} puts up ${fmtMoney(stake)}</h2>
      <p class="peer-sub">Match the stake and the winner takes ${fmtMoney(stake * 2)} — a draw refunds both. Or warm up for free.</p>
      <div class="peer-actions">
        <button class="secondary-button" id="stakePractice" type="button">Practice free</button>
        <button class="primary-button" id="stakeAccept" type="button">Stake ${fmtMoney(stake)}</button>
      </div>
    </div>`
  document.body.appendChild(ov)
  requestAnimationFrame(() => ov.classList.add('is-open'))
  const close = () => { document.removeEventListener('keydown', onKey); ov.classList.remove('is-open'); setTimeout(() => ov.remove(), 250) }
  const onKey = e => { if (e.key === 'Escape') close() }
  document.addEventListener('keydown', onKey)
  ov.addEventListener('click', e => {
    if (e.target === ov) { close(); return }
    if (e.target.closest('#stakePractice')) { close(); startMatch({ ...player, stake: 0 }) }
    if (e.target.closest('#stakeAccept')) { close(); startMatch(player) }
  })
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

  $('#gameLeaderboard').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Games</p>
      <strong>${integrationRuntime.readiness.settlement.realMoneyEnabled ? 'Trusted results' : 'Demo results'}</strong>
    </div>
    <div class="leader-list">
      ${gameLeaderboardRows.map((row, index) => `
        <div class="game-leader-row">
          <span class="leader-rank">${index + 1}</span>
          ${avatarSvg(row.user === 'captain' ? (state.username || 'captain') : row.user, teamById(row.team), true)}
          <div>
            <strong>${escapeHtml(row.user === 'captain' ? (state.username || 'captain') : row.user)}</strong>
            <span>${row.record} record</span>
          </div>
          <em>${row.trust}</em>
        </div>
      `).join('')}
    </div>
  `
  return result
}

function remainingPicks () {
  return bracketMatchIds.filter(id => !state.picks[id]).length
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
      showToast(`${remaining} picks left before this bracket is sealed`)
      return
    }
    showToast(`$${state.selectedTier} bracket submitted for ${state.username}`)
  })
  sendBootCheckpoint('bindEvents:bracket')

  $('#voiceToggle').addEventListener('click', () => {
    state.voice = !state.voice
    persist()
    $('#voiceToggle').classList.toggle('is-live', state.voice)
    showToast(state.voice ? 'Voice chat unmuted' : 'Voice chat muted')
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
    ['PearCupPeerMatch', 'pearcupPeerMatchModule'],
    ['PearCupLobby', 'pearcupPeerLobbyModule'],
    ['PearCupWatchSync', 'pearcupWatchSyncModule']
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
  const avatarImages = Array.from(document.querySelectorAll('svg.avatar-art image'))
    .map(el => el.getAttribute('href') || '')
    .filter(Boolean)
  const activeScreens = Array.from(document.querySelectorAll('.screen.is-active')).map(el => el.id)

  return {
    uiHydrated: document.documentElement.dataset.pearcupUiHydrated || null,
    activeScreens,
    routeButtons: Array.from(document.querySelectorAll('[data-view]')).map(el => el.getAttribute('data-view')).filter(Boolean),
    teamCards: document.querySelectorAll('#teamGrid .team-card').length,
    avatarImages: avatarImages.slice(0, 4),
    profileChipReady: Boolean(document.querySelector('#profileChip svg.avatar-art')),
    controllers: {
      peerNet: controllerReady(window.PearCupPeerNet, ['createChannel', 'newRoomCode', 'newPeerId']),
      peerMatch: controllerReady(window.PearCupPeerMatch, ['host', 'join', 'promptJoin', 'onZone']),
      peerLobby: controllerReady(window.PearCupLobby, ['join', 'renderList']),
      watchSync: controllerReady(window.PearCupWatchSync, ['ensureRoom', 'broadcastChat', 'react'])
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
    modules: {
      net: ds.pearcupPeerNetModule || null,
      match: ds.pearcupPeerMatchModule || null,
      lobby: ds.pearcupPeerLobbyModule || null,
      watch: ds.pearcupWatchSyncModule || null
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
    if (typeof fetch === 'function') {
      try {
        const res = await fetch('./boot-probe.json', { cache: 'no-store' })
        if (res && res.ok) {
          const fileConfig = await res.json()
          if (fileConfig && typeof fileConfig === 'object') Object.assign(config, fileConfig)
        }
      } catch (e) {}
    }
    config.url = normalizeBootProbeUrl(config.url) || ''
    return config
  })()
  return bootProbeConfigPromise
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

function runtimeSelfTestSnapshot (status, errors = [], extra = {}) {
  const active = document.querySelector('.screen.is-active')
  const modal = document.querySelector('#peerModal')
  const link = modal ? modal.querySelector('.peer-link code') : null
  const modalCode = modal && modal.querySelector('.peer-code')
  const peerState = window.PearCupPeerMatch && window.PearCupPeerMatch._state
  const activeAvatarImages = active
    ? Array.from(active.querySelectorAll('svg.avatar-art image')).map(el => el.getAttribute('href') || '').filter(Boolean).slice(0, 6)
    : []
  return {
    event: 'pearcup:runtime-self-test',
    status,
    errors,
    bootReady: document.documentElement.dataset.pearcupBootReady || null,
    p2pModules: document.documentElement.dataset.pearcupP2pModules || null,
    backend: document.documentElement.dataset.pearcupPeerNet || null,
    activeScreen: active ? active.id : null,
    activeNav: Array.from(document.querySelectorAll('.topnav button.is-active')).map(el => el.textContent.trim()),
    hasGamesLobby: Boolean(document.querySelector('#gameLobby')),
    hasLobbyMascot: Boolean(active && active.querySelector('img.lobby-mascot[src="assets/mascot.png"]')),
    p2pBackendBadge: (document.querySelector('#p2pBackendBadge') && document.querySelector('#p2pBackendBadge').textContent.trim()) || '',
    generatedAvatarImages: activeAvatarImages,
    inviteModalOpen: Boolean(modal) || extra.inviteModalOpen === true,
    inviteCode: (modalCode && modalCode.textContent.trim()) || extra.inviteCode || '',
    inviteLink: (link && link.textContent.trim()) || extra.inviteLink || '',
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
    joinState: ds.pearcupJoinState || null,
    activeScreen: doc && doc.querySelector('.screen.is-active') ? doc.querySelector('.screen.is-active').id : null,
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

async function runBootRuntimeSelfTest () {
  const errors = []
  const evidence = {}
  try {
    if (document.documentElement.dataset.pearcupBootReady !== 'p2p') errors.push('bootReady was not p2p')
    if (document.documentElement.dataset.pearcupP2pModules !== 'ready') errors.push('P2P modules were not ready')
    if (!window.PearCupPeerMatch || typeof window.PearCupPeerMatch.host !== 'function') errors.push('PearCupPeerMatch.host missing')
    setView('games')
    const active = document.querySelector('.screen.is-active')
    if (!active || active.id !== 'games') errors.push('Games route did not become active')
    if (!document.querySelector('#inviteFriendBtn')) errors.push('Invite button did not render')
    if (!document.querySelector('img.lobby-mascot[src="assets/mascot.png"]')) errors.push('Lobby mascot did not render')
    const avatarImages = Array.from(document.querySelectorAll('#games svg.avatar-art image')).map(el => el.getAttribute('href') || '')
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
    if (!code || !/^[a-z0-9]{6}$/i.test(evidence.inviteCode)) errors.push('Invite modal did not show a room code')
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
  sendBootCheckpoint('boot:p2p-ready')
  bindEvents()
  sendBootCheckpoint('boot:events-bound')
  hydrateStaticShell()
  // If any runtime module was missing or the runtime config degraded to demo, say so
  // (non-blocking) — tells us the real cause without a console.
  if (bootIssues.length) { try { console.warn('PearCup boot issues:', bootIssues); showToast('Runtime note: ' + bootIssues.join(' · ')) } catch (e) {} }
  if (!state.themeChosen) {
    state.themeChosen = true
    persist()
  }
  // Deep link: ?join=<code> auto-joins a friend's peer match, including first-run users.
  tryJoinFriendInvite()
  window.addEventListener('load', resetScrollPosition)
  window.addEventListener('pageshow', resetScrollPosition)
  window.addEventListener('resize', scheduleBracketConnectors)
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
