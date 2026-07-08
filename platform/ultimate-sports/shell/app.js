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

let teams = [
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

let pools = [
  { tier: 10, entrants: 124, closes: '12h', max: 256, prize: '$1,240', heat: 'Open', rail: 'USDT demo', variant: 'confidence' },
  { tier: 25, entrants: 82, closes: '9h', max: 160, prize: '$2,050', heat: 'Hot', rail: 'USDT demo', variant: 'classic-bracket' },
  { tier: 50, entrants: 38, closes: '7h', max: 96, prize: '$1,900', heat: 'Sharp', rail: 'USDT demo', variant: 'survivor' },
  { tier: 100, entrants: 19, closes: '5h', max: 64, prize: '$1,900', heat: 'Elite', rail: 'USDT demo', variant: 'upset-bounty' }
]

let round32Matches = [
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

let commentary = {
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

let defaultChat = [
  { user: 'lina', text: 'Spain/Austria room is up. No fake score until the feed lands.', time: 'Today' },
  { user: 'vera', text: 'Portugal/Croatia pool is next on my list.', time: '19:00Z' },
  { user: 'ash', text: 'Good, bracket is still Round of 32.', time: 'R32' }
]

let liveTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'stats', label: 'Stats' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'games', label: 'Games' },
  { id: 'qvac', label: 'QVAC' }
]

let homeFixtures = [
  { status: 'Today, 15:00', title: 'Spain vs Austria', detail: 'Round of 32 match room', live: false },
  { status: 'Today, 19:00', title: 'Portugal vs Croatia', detail: '$50 pool closing', live: false },
  { status: 'Today, 23:00', title: 'Switzerland vs Algeria', detail: 'Late room opening', live: false }
]

let matchStats = [
  ['Possession', '58%', '42%', 58],
  ['Shots', '12', '6', 67],
  ['xG', '1.82', '0.74', 71],
  ['Pass accuracy', '89%', '81%', 62],
  ['Corners', '5', '2', 71],
  ['Saves', '1', '4', 20]
]

let leaders = [
  { user: 'lina', team: 'br', score: '12/15', prize: '$812' },
  { user: 'amara', team: 'ci', score: '12/15', prize: '$540' },
  { user: 'vera', team: 'no', score: '11/15', prize: '$410' },
  { user: 'diego', team: 'ar', score: '11/15', prize: '$305' },
  { user: 'milo', team: 'mx', score: '10/15', prize: '$190' },
  { user: 'kenji', team: 'jp', score: '10/15', prize: '$120' }
]

let gameRounds = [
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

let gameLeaderboardRows = [
  { user: 'captain', team: 'br', record: '4-1', trust: '99.2%' },
  { user: 'freya', team: 'hr', record: '4-1', trust: '98.9%' },
  { user: 'vera', team: 'no', record: '3-2', trust: '98.7%' },
  { user: 'kwame', team: 'ci', record: '3-2', trust: '98.1%' },
  { user: 'milo', team: 'mx', record: '3-2', trust: '97.9%' }
]

let bracketLinks = [
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

let bracketMatchIds = [
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

// Ultimate Sports fit injection: a fit config loaded before this script can
// override the default World Cup data/theme. Only override arrays that were
// actually supplied so a partial fit config stays safe.
// Template kind decides the STRUCTURE the bracket surface renders. Tree kinds
// (single-elimination / group-plus-knockout / series-playoff / round-robin)
// use the knockout board; 'fight-card' renders independent bouts; 'awards-card'
// renders category pick cards. Defaults to the World Cup knockout tree.
let templateKind = 'single-elimination'
let awardsCategories = []
let groupStages = []

if (typeof window !== 'undefined' && window.ULTIMATE_FIT_CONFIG) {
  const cfg = window.ULTIMATE_FIT_CONFIG
  if (cfg.templateKind) templateKind = cfg.templateKind
  if (cfg.categories) awardsCategories = cfg.categories
  if (cfg.groups) groupStages = cfg.groups
  if (cfg.teams) teams = cfg.teams
  if (cfg.pools) pools = cfg.pools
  if (cfg.round32Matches) round32Matches = cfg.round32Matches
  if (cfg.bracketLinks) bracketLinks = cfg.bracketLinks
  if (cfg.bracketMatchIds) bracketMatchIds = cfg.bracketMatchIds
  if (cfg.commentary) commentary = cfg.commentary
  if (cfg.defaultChat) defaultChat = cfg.defaultChat
  if (cfg.liveTabs) liveTabs = cfg.liveTabs
  if (cfg.homeFixtures) homeFixtures = cfg.homeFixtures
  if (cfg.matchStats) matchStats = cfg.matchStats
  if (cfg.leaders) leaders = cfg.leaders
  if (cfg.gameRounds) gameRounds = cfg.gameRounds
  if (cfg.gameLeaderboardRows) gameLeaderboardRows = cfg.gameLeaderboardRows
}

// Pool variants: if the fit supplies recommendedVariants, rotate them across the
// pool list; otherwise fall back to the default breadth set. Existing pool tiers,
// prizes, and caps are preserved.
const PoolVariantHelpers = (typeof window !== 'undefined' && window.PearCupPoolVariantHelpers) || null
if (PoolVariantHelpers) {
  const cfg = (typeof window !== 'undefined' && window.ULTIMATE_FIT_CONFIG) || {}
  pools = PoolVariantHelpers.assignPoolVariants(pools, cfg.recommendedVariants)
}

// Fit-aware mini-game list. fit-loader.js enriches ULTIMATE_FIT_CONFIG with
// recommendedMiniGames and exposes ULTIMATE_MINI_GAME_TITLES.
let fitMiniGames = ['penalty-clash']
let miniGameTitles = {}
let fitPredictionOptions = ['Option A', 'Option B', 'Option C', 'Option D']
let fitTriviaQuestions = []
let selectedMiniGame = 'penalty-clash'
if (typeof window !== 'undefined' && window.ULTIMATE_FIT_CONFIG) {
  const cfg = window.ULTIMATE_FIT_CONFIG
  fitMiniGames = cfg.recommendedMiniGames || fitMiniGames
  miniGameTitles = window.ULTIMATE_MINI_GAME_TITLES || miniGameTitles
  fitPredictionOptions = cfg.predictionOptions || fitPredictionOptions
  fitTriviaQuestions = cfg.triviaQuestions || fitTriviaQuestions
  selectedMiniGame = fitMiniGames[0] || 'penalty-clash'
}

// Reaction Challenge transient render state (not persisted — a live P2P session
// can't survive a reload and the AI timer loop is recreated per match).
let reactionChallengeUnsub = null
let reactionChallengeSnapshot = null

// Live Market Game transient render state (next-event / scoreline-lock / streak).
let liveMarketUnsub = null
let liveMarketSnapshot = null

// Ranked competitive duels: commit/reveal + QVAC referee. Shown in the Games lobby.
const SHELL_COMPETITIVE_MINI_GAMES = new Set([
  'penalty-clash',
  'prediction-duel',
  'trivia-duel',
  'free-kick-duel',
  'buzzer-beater-duel',
  'ace-serve-duel',
  'home-run-derby',
  'reaction-challenge'
])

// Social / watch-party side bets: no ranked duel, low-stakes, shown in the Watch tray.
const SHELL_SOCIAL_MINI_GAMES = new Set([
  'next-event',
  'scoreline-lock',
  'watch-party-streak',
  'momentum-duel',
  'player-prop-duel'
])

// Backward-compatible alias for surfaces that still check "implemented".
const SHELL_IMPLEMENTED_MINI_GAMES = new Set([
  ...SHELL_COMPETITIVE_MINI_GAMES,
  ...SHELL_SOCIAL_MINI_GAMES
])

function playableMiniGames () {
  return fitMiniGames.filter(gt => SHELL_COMPETITIVE_MINI_GAMES.has(gt))
}

function isPlayableMiniGame (gameType) {
  return SHELL_COMPETITIVE_MINI_GAMES.has(gameType)
}

function isSocialMiniGame (gameType) {
  return SHELL_SOCIAL_MINI_GAMES.has(gameType)
}

function selectedMiniGameTitle () {
  return miniGameTitles[selectedMiniGame] || selectedMiniGame
}

const state = loadState()

// ==================== Ultimate Sports host spine ====================
// When this fit runs inside the Ultimate Sports lobby, the lobby is the
// authority for identity + wallet. Adopt what it injects and report our own
// wallet/profile changes back so the lobby stays live and persists them.
// Standalone (not hosted) => HOST is null/inert and the shell keeps its own
// local wallet, exactly as before.
const HOST = (typeof window !== 'undefined' && window.ULTIMATE_HOST) || null
let adoptingHostState = false

function reportHostState () {
  if (adoptingHostState || !HOST || !HOST.isHosted()) return
  HOST.reportState({
    profile: { username: state.username, team: state.team, avatar: state.avatar },
    wallet: state.wallet
  })
}

function adoptHostState (data) {
  if (!data) return
  adoptingHostState = true
  try {
    if (data.wallet) state.wallet = { ...state.wallet, ...data.wallet }
    if (data.profile) {
      if (data.profile.username) state.username = data.profile.username
      if (data.profile.team) state.team = data.profile.team
      if ('avatar' in data.profile) state.avatar = data.profile.avatar
    }
    persist()
  } finally {
    adoptingHostState = false
  }
  // Re-render only once the app has booted; pre-boot injection is picked up by
  // boot()'s first render.
  if (typeof window !== 'undefined' && window.__pearcupAppBooted) {
    try { refreshWallet(); renderProfile(); renderView(state.view) } catch (e) {}
  }
}

if (HOST && HOST.isHosted()) HOST.onInit(adoptHostState)

if (typeof history !== 'undefined' && 'scrollRestoration' in history) history.scrollRestoration = 'manual'

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
const uiT = (key) => (window.ULTIMATE_UI_T ? window.ULTIMATE_UI_T(key) : key)

function loadState () {
  const fitDefaultTeam = (typeof window !== 'undefined' && window.ULTIMATE_FIT_CONFIG && window.ULTIMATE_FIT_CONFIG.defaultTeam) || 'br'
  const selectedPool = pools.find(pool => pool.tier === 25) || pools[0] || { variant: 'classic-bracket' }
  const fallback = {
    view: 'onboarding',
    username: 'captain',
    team: fitDefaultTeam,
    avatar: null,
    selectedTier: 25,
    selectedPoolVariant: selectedPool.variant || 'classic-bracket',
    picks: {},
    variantPicks: {},
    survivorRound: 1,
    survivorUsedTeams: [],
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
      enteredPools: PoolVariantHelpers
        ? PoolVariantHelpers.normalizeEnteredPools(saved.enteredPools || {})
        : (saved.enteredPools || {}),
      variantPicks: saved.variantPicks || {},
      survivorRound: saved.survivorRound || 1,
      survivorUsedTeams: saved.survivorUsedTeams || [],
      liveConfig: { ...fallback.liveConfig, ...(saved.liveConfig || {}) }
    }
    // A live peer match can't survive a reload (the connection is gone) — start in the lobby.
    if (merged.match && merged.match.peer) merged.match = null
    const activeVariant = merged.selectedPoolVariant || selectedPool.variant || 'classic-bracket'
    merged.selectedPoolVariant = activeVariant
    // Restore the active pick surface for the current variant.
    merged.picks = normalizeVariantPicks(
      merged.variantPicks[activeVariant] || merged.picks || {},
      activeVariant
    )
    return merged
  } catch {
    return fallback
  }
}

function normalizeBracketPicks (picks = {}) {
  const source = picks && typeof picks === 'object' && !Array.isArray(picks) ? picks : {}
  // Non-bracket template kinds key picks by category/bout id, not tree match id —
  // validate against their own structure so reload doesn't drop them.
  if (templateKind === 'awards-card') {
    const kept = {}
    for (const category of awardsCategories) {
      const value = source[category.id]
      if (value && (category.nominees || []).some(nominee => nominee.id === value)) kept[category.id] = value
    }
    return kept
  }
  if (templateKind === 'fight-card') {
    const kept = {}
    for (const bout of round32Matches) {
      const value = source[bout.id]
      if (value && bout.slots.includes(value)) kept[bout.id] = value
      if (bout.props) {
        if (bout.props.method && bout.props.method.includes(source[`${bout.id}-method`])) kept[`${bout.id}-method`] = source[`${bout.id}-method`]
        if (bout.props.round && bout.props.round.includes(source[`${bout.id}-round`])) kept[`${bout.id}-round`] = source[`${bout.id}-round`]
      }
    }
    return kept
  }
  if (templateKind === 'group-plus-knockout' && groupStages.length) {
    const kept = {}
    for (const group of groupStages) {
      for (const place of ['1', '2']) {
        const key = groupPickKey(group.id, place)
        const value = source[key]
        if (value && (group.teams || []).includes(value)) kept[key] = value
      }
    }
    // Bracket slots are derived from group picks so they stay in sync on reload.
    for (const entry of GROUP_ADVANCE_MAP) {
      const groupPick = kept[groupPickKey(entry.groupId, entry.place)]
      if (groupPick) kept[bracketSlotKey(entry.matchId, entry.slot)] = groupPick
    }
    return kept
  }
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

function normalizeVariantPicks (picks, variant) {
  if (variant === 'side-quest') {
    // Side-quest keeps any string selections (entrant ids) alive.
    const kept = {}
    for (const [key, value] of Object.entries(picks || {})) {
      if (typeof value === 'string') kept[key] = value
    }
    return kept
  }
  if (variant === 'survivor') {
    // Survivor picks are keyed `survivor-rN` and mirrored used-teams are
    // tracked separately in state.survivorUsedTeams.
    const kept = {}
    for (const [key, value] of Object.entries(picks || {})) {
      if (key.startsWith('survivor-r') && typeof value === 'string') kept[key] = value
    }
    return kept
  }
  if (variant === 'confidence') {
    // Confidence keeps bracket winner picks plus per-match confidence values.
    const next = normalizeBracketPicks(picks)
    for (const [key, value] of Object.entries(picks || {})) {
      if (key.endsWith('-confidence')) {
        const num = Number(value)
        if (Number.isFinite(num) && num > 0) next[key] = num
      }
    }
    return next
  }
  if (variant === 'upset-bounty') {
    return normalizeBracketPicks(picks)
  }
  return normalizeBracketPicks(picks)
}

function currentPoolVariant () {
  return state.selectedPoolVariant || 'classic-bracket'
}

function poolForTier (tier) {
  return pools.find(pool => pool.tier === tier) || pools[0]
}

function setPick (key, value) {
  state.picks[key] = value
  if (PoolVariantHelpers) PoolVariantHelpers.mirrorActivePicks(state)
}

function deletePick (key) {
  delete state.picks[key]
  if (PoolVariantHelpers) PoolVariantHelpers.mirrorActivePicks(state)
}

function swapVariantPicks (newVariant) {
  if (!PoolVariantHelpers) {
    state.selectedPoolVariant = newVariant
    return
  }
  PoolVariantHelpers.swapActivePicks(state, newVariant)
}

function resetActivePicks () {
  state.picks = {}
  if (state.selectedPoolVariant === 'survivor') {
    state.survivorRound = 1
    state.survivorUsedTeams = []
  }
  if (PoolVariantHelpers) PoolVariantHelpers.mirrorActivePicks(state)
}

function persist () {
  try {
    localStorage.setItem('pearcup-prototype', JSON.stringify(state))
  } catch {}
  reportHostState()
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

// Old kawaii portrait PNGs + anime-avatar generator retired. Avatars are now
// retro monogram tiles (see avatarSvg); only the local user's own uploaded pic
// renders as a photo.
function isCurrentUser (name) {
  return String(name || '').toLowerCase() === String((state && state.username) || 'captain').toLowerCase()
}

function avatarPortrait (name, team) {
  // Old-school P2P-client look: the kawaii portrait PNGs are retired. Only the
  // local user's own uploaded/chosen pic renders as a photo; everyone else gets
  // a retro monogram tile (see avatarSvg). Keeps the app image-light and on-theme.
  if (state && state.avatar && isCurrentUser(name)) return state.avatar
  return null
}

// Uploaded photo → square center-crop → ~256px JPEG data URL (small enough for
// localStorage + a postMessage handshake). Center-crop so portraits aren't
// stretched; re-encode / abort if the result is pathologically large.
async function downscaleAvatar (file, size = 256, quality = 0.74) {
  if (!file || !file.type || !file.type.startsWith('image/')) return null
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej
    r.readAsDataURL(file)
  })
  const img = await new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl
  })
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  if (!side) return null
  const sx = (img.naturalWidth - side) / 2
  const sy = (img.naturalHeight - side) / 2
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
  let out = canvas.toDataURL('image/jpeg', quality)
  if (out.length > 60000) out = canvas.toDataURL('image/jpeg', 0.6)
  return out.length > 90000 ? null : out
}

// Example avatars: procedural symmetric pixel "identicons" on a dark tile —
// on-theme (8-bit/retro), self-contained, no external assets or credits needed.
function presetAvatarDataUrl (seed, hue) {
  const cells = 5, size = 100, pad = 12, grid = (size - pad * 2) / cells
  let h = 0
  for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h + seed.charCodeAt(i)) | 0 }
  const rand = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff }
  const fg = `hsl(${hue} 72% 58%)`
  let rects = ''
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < Math.ceil(cells / 2); x++) {
      if (rand() > 0.5) {
        const rx = pad + x * grid, ry = pad + y * grid
        rects += `<rect x="${rx}" y="${ry}" width="${grid}" height="${grid}" fill="${fg}"/>`
        const mx = pad + (cells - 1 - x) * grid
        if (mx !== rx) rects += `<rect x="${mx}" y="${ry}" width="${grid}" height="${grid}" fill="${fg}"/>`
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#0b0f14"/>${rects}</svg>`
  return 'data:image/svg+xml;base64,' + btoa(svg)
}
const EXAMPLE_AVATARS = [['blaze', 8], ['viper', 145], ['neon', 285], ['ghost', 205], ['ember', 32], ['frost', 190], ['gold', 46], ['jade', 160]]
  .map(([seed, hue]) => presetAvatarDataUrl(seed, hue))

function avatarSvg (name, team, compact = false) {
  const seed = hashString(`${name}-${team && team.id ? team.id : ''}`)
  const scaleClass = compact ? 'compact-avatar' : 'showcase-avatar'
  const prefix = `av-${compact ? 'sm' : 'lg'}-${team && team.id ? team.id : ''}-${seed}`.replace(/[^a-z0-9-]/gi, '')
  const label = escapeHtml(initials(name))
  const ariaLabel = `${escapeHtml(name)} avatar`

  const portrait = avatarPortrait(name, team)
  if (portrait) {
    // Uploaded/chosen photo → sharp square client tile (no kawaii rounding).
    return `
    <svg class="avatar-art ${scaleClass} retro-av" viewBox="0 0 100 100" role="img" aria-label="${ariaLabel}">
      <defs><clipPath id="${prefix}-pc"><rect x="3" y="3" width="94" height="94" rx="2"/></clipPath></defs>
      <rect x="1.5" y="1.5" width="97" height="97" rx="3" fill="#0b0f14"/>
      <image href="${escapeHtml(portrait)}" x="3" y="3" width="94" height="94" clip-path="url(#${prefix}-pc)" preserveAspectRatio="xMidYMid slice"/>
      <rect x="2" y="2" width="96" height="96" rx="3" fill="none" stroke="#05130b" stroke-width="2"/>
    </svg>`
  }

  // No photo → minimal retro monogram tile: phosphor-mono initials on a tinted
  // LCD square. Retires the kawaii anime-avatar generator below (now unreached).
  const monoHue = seed % 360
  return `
    <svg class="avatar-art ${scaleClass} retro-av" viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(name)} avatar">
      <rect x="1.5" y="1.5" width="97" height="97" rx="3" fill="#0b0f14"/>
      <rect x="1.5" y="1.5" width="97" height="97" rx="3" fill="hsl(${monoHue} 55% 48% / 0.20)"/>
      <rect x="2" y="2" width="96" height="96" rx="3" fill="none" stroke="#05130b" stroke-width="2"/>
      <text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-size="40" font-weight="700" fill="#34f08a" font-family="ui-monospace, Consolas, monospace">${label}</text>
    </svg>`

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
  return ['profile', 'onboarding', 'home', 'bracket', 'watch', 'games'].includes(clean) ? clean : ''
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
  $$('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === nextView || (nextView === 'profile' && screen.id === 'onboarding')))
  $$('.topnav button').forEach(button => {
    const target = button.dataset.view
    button.classList.toggle('is-active', target === nextView || (nextView === 'profile' && target === 'onboarding') || (nextView === 'onboarding' && target === 'profile'))
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
  persist(); refreshWallet(); flashWalletChip(); showToast(`Added ${fmtMoney(amount)} to your wallet`)
}
function withdrawWallet () {
  const amount = state.wallet.balance
  if (amount <= 0) { showToast('Nothing to withdraw'); return }
  state.wallet.balance = 0
  walletLog('Withdraw to payout address', amount, 'debit')
  persist(); refreshWallet(); flashWalletChip(); showToast(`Withdrawing ${fmtMoney(amount)} to your address`)
}
function collectPayouts () {
  const amount = state.wallet.pendingPayout || 0
  if (amount <= 0) { showToast('No payouts to collect yet'); return }
  state.wallet.balance += amount
  state.wallet.pendingPayout = 0
  walletLog('Collected pool payout', amount, 'credit')
  persist(); refreshWallet(); flashWalletChip(); showToast(`Collected ${fmtMoney(amount)} in payouts 🎉`)
}
function debitWallet (amount, memo) {
  if (state.wallet.balance < amount) return false
  state.wallet.balance -= amount
  walletLog(memo || 'Entry', amount, 'debit')
  persist(); refreshWallet(); flashWalletChip(); return true
}
function refreshWallet () {
  renderWalletChip()
  if ($('#walletManage')) renderWalletManage()
  if (state.view === 'bracket' && $('#bracketPoolSelect')) renderPoolSelect()
}

function flashWalletChip () {
  const chip = $('#walletChip')
  if (!chip) return
  chip.classList.remove('is-flash')
  void chip.offsetWidth
  chip.classList.add('is-flash')
  setTimeout(() => chip.classList.remove('is-flash'), 500)
}

function creditWallet (amount, memo) {
  state.wallet.balance += amount
  walletLog(memo || 'Payout', amount, 'credit')
  persist(); refreshWallet(); flashWalletChip()
}

function postSettlementReceipt (receipt) {
  if (!receipt || typeof receipt !== 'object') return
  const stake = (state.match && state.match.stake) || 0
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const selfId = receipt.you || null
  const winner = receipt.winner === selfId ? 'you' : (receipt.winner ? 'opp' : null)
  const youScore = selfId && receipt.scores && typeof receipt.scores[selfId] === 'number'
    ? receipt.scores[selfId]
    : 0
  let oppScore = 0
  if (receipt.scores && typeof receipt.scores === 'object') {
    const entry = Object.entries(receipt.scores).find(([k]) => k !== selfId)
    if (entry) oppScore = entry[1]
  }
  const title = miniGameTitles[receipt.gameType] || receipt.gameType || 'Mini-game'
  if (stake > 0) {
    if (winner === 'you') {
      creditWallet(stake * 2, `${title} win vs ${opponent.name}`)
      showToast(`You beat ${opponent.name} and won ${fmtMoney(stake)}`)
    } else if (winner === null) {
      creditWallet(stake, `${title} draw vs ${opponent.name}`)
      showToast(`Draw — your ${fmtMoney(stake)} stake was refunded`)
    } else {
      showToast(`${opponent.name} wins — ${fmtMoney(stake)} stake lost`)
    }
  } else {
    showToast(winner === 'you'
      ? `You win ${youScore}–${oppScore}!`
      : winner === null
        ? `Draw ${youScore}–${oppScore}`
        : `${opponent.name} wins ${oppScore}–${youScore}`)
  }
}

if (typeof window !== 'undefined') window.postSettlementReceipt = postSettlementReceipt

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

  const examplesEl = $('#avatarExamples')
  if (examplesEl && !examplesEl.dataset.filled) {
    examplesEl.innerHTML = EXAMPLE_AVATARS.map(src =>
      `<button type="button" class="avatar-example" data-src="${escapeHtml(src)}" aria-label="Use this example avatar" style="background-image:url(${src})"></button>`).join('')
    examplesEl.dataset.filled = '1'
  }
  if (examplesEl) {
    $$('#avatarExamples .avatar-example').forEach(btn => btn.classList.toggle('is-active', btn.dataset.src === state.avatar))
  }
  const clearBtn = $('#avatarClearBtn')
  if (clearBtn) clearBtn.hidden = !state.avatar
}

// The big hero scoreline mirrors whatever the Watch feed is showing (live relay or sim).
function renderHomeHero () {
  const snap = livePanelSnapshot()
  const st = snap.st
  const cfg = window.ULTIMATE_FIT_CONFIG || {}
  const backdrop = $('#heroBackdrop')
  if (backdrop && cfg.assets && cfg.assets.heroBackdrop) {
    backdrop.style.backgroundImage = `url('${escapeHtml(cfg.assets.heroBackdrop)}')`
  }
  const flag = t => (t && t.flag && t.flag !== '⚽') ? t.flag : '⚽'
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

// Parse a fit homeFixture title like "Brazil vs South Korea" into team objects.
function fixtureTeams (fixture) {
  const title = (fixture && fixture.title) || ''
  const parts = title.split(/\s+vs\s+/i)
  if (parts.length !== 2) return null
  const find = name => teams.find(t => t.name.toLowerCase() === name.toLowerCase().trim())
  const home = find(parts[0])
  const away = find(parts[1])
  if (!home || !away) return null
  return {
    home: { name: home.name, flag: home.flag, goals: 0, teamId: home.id },
    away: { name: away.name, flag: away.flag, goals: 0, teamId: away.id }
  }
}

// Snapshot of whatever the live/sim feed currently holds, for the Home dashboard.
// Falls back to the fit's configured live homeFixture so every sport shows its own match.
function livePanelSnapshot () {
  const live = isLiveApi()
  let st = null
  try { st = feedState() } catch { st = null }
  const liveFixture = homeFixtures.find(f => f.live)
  const fallback = liveFixture ? fixtureTeams(liveFixture) : null
  let home = st ? st.home : (fallback ? fallback.home : { name: 'Spain', flag: '🇪🇸', goals: 0, teamId: 'es' })
  let away = st ? st.away : (fallback ? fallback.away : { name: 'Austria', flag: '🇦🇹', goals: 0, teamId: 'at' })
  // If the feed's match is for a different sport than THIS fit (its teams aren't in
  // the fit roster — e.g. the world-cup demo live feed showing on the MMA server),
  // display the fit's own main event instead. Preserves any live score.
  let foreignFeed = false
  if (!(home && home.teamId && teams.some(t => t.id === home.teamId))) {
    foreignFeed = true
    const me = mainEventTeams()
    home = { ...home, name: me.home.name, flag: me.home.flag, teamId: me.home.id }
    away = { ...away, name: me.away.name, flag: me.away.flag, teamId: me.away.id }
  }
  const status = st ? matchStateLabel(st).txt : (liveFixture ? liveFixture.status : 'Kicks off 15:00 ET')
  // A feed for another sport carries the wrong events (world-cup goals) — drop
  // them so the timeline shows the clean "waiting" state, not "Spain vs Austria".
  const events = foreignFeed ? [] : (state.feedEvents || [])
  return { st, live, home, away, status, events }
}

// Winamp spectrum-analyzer widget — ONE rAF loop draws into whatever
// .winamp-viz canvas is on screen. Peaks rise instantly + fall slowly.
function startWinampViz () {
  if (startWinampViz._on) return
  startWinampViz._on = true
  const N = 22
  const peaks = new Array(N).fill(999)
  const phase = new Array(N).fill(0).map((_, i) => i * 0.7)
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  let t = 0
  function frame () {
    const canvas = document.querySelector('.winamp-viz')
    if (canvas && canvas.getContext && canvas.offsetParent) {
      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height
      const mom = Math.max(0, Math.min(30, Number(canvas.dataset.momentum || 6)))
      ctx.fillStyle = '#05130b'; ctx.fillRect(0, 0, W, H)
      const barW = W / N, seg = 4, gap = 2
      for (let i = 0; i < N; i++) {
        const wave = Math.sin(t * 0.09 + phase[i]) * 0.5 + 0.5
        const noise = reduce ? 0.5 : (Math.sin(t * 0.23 + i * 1.7) * 0.5 + 0.5)
        let h = 0.26 + 0.56 * wave * noise + mom * 0.012
        h = Math.max(0.06, Math.min(1, h))
        const barH = h * (H - 6)
        const x = Math.floor(i * barW) + 1
        const w = Math.max(2, Math.floor(barW) - 2)
        for (let y = H - 3; y > H - 3 - barH; y -= (seg + gap)) {
          const frac = (H - 3 - y) / (H - 6)
          ctx.fillStyle = frac < 0.55 ? '#2ee06a' : frac < 0.82 ? '#e8d020' : '#ff4d4d'
          ctx.fillRect(x, y - seg, w, seg)
        }
        const peakY = H - 3 - barH
        if (peakY < peaks[i]) peaks[i] = peakY
        else peaks[i] = Math.min(H - 4, peaks[i] + 0.8)
        ctx.fillStyle = '#d8ffe8'
        ctx.fillRect(x, Math.max(2, peaks[i]), w, 2)
      }
    }
    t++
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

function renderMomentumChart (snap, lead, momentum) {
  // Winamp-style spectrum analyzer (a real pixel widget). Drawn on <canvas> by
  // startWinampViz(); intensity is driven by the current momentum.
  const bias = lead === snap.home ? 1 : -1
  const aria = `${lead.name} momentum plus ${momentum}, ${snap.home.name} vs ${snap.away.name}`
  return `
    <div class="momentum-viz" role="img" aria-label="${escapeHtml(aria)}">
      <canvas class="winamp-viz" width="320" height="104" data-momentum="${momentum}" data-bias="${bias}"></canvas>
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
  const grid = $('#poolGrid')
  if (!grid) return
  if (!pools.length) {
    grid.innerHTML = `<div class="empty-state"><strong>${uiT('emptyPools')}</strong></div>`
    return
  }
  const sampleTeams = ['es', 'at', 'pt']
  const railMode = serviceModeLabel(integrationRuntime.readiness.tetherWdk)
  const railState = integrationRuntime.canUseRealMoney ? 'Live USDT' : `${railMode} locked`
  grid.innerHTML = pools.map(pool => `
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
    const variantName = PoolVariantHelpers ? PoolVariantHelpers.variantDisplayName(pool.variant) : (pool.variant || 'Classic bracket')
    return `
      <button class="pool-pick${selected ? ' is-selected' : ''}${entered ? ' is-entered' : ''}" type="button" data-pool="${pool.tier}">
        <span class="pool-pick-heat">${pool.heat}</span>
        <span class="pool-pick-fee">$${pool.tier}</span>
        <span class="pool-pick-meta">${variantName} · ${pool.prize} prize · ${pool.entrants} in</span>
        <span class="pool-pick-cta${entered ? ' is-entered' : affordable ? '' : ' is-locked'}">${cta}</span>
      </button>`
  }).join('')
  $$('#bracketPoolSelect .pool-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = Number(btn.dataset.pool)
      const pool = poolForTier(tier)
      if (state.selectedTier !== tier) {
        swapVariantPicks(pool.variant || 'classic-bracket')
        state.selectedTier = tier
        persist()
        renderBracket()
        return
      }
      enterSelectedPool()
    })
  })
}

function enterSelectedPool () {
  const tier = state.selectedTier
  if (state.enteredPools[tier]) { showToast(`You're already in the $${tier} pool`); return }
  if (!debitWallet(tier, `$${tier} pool entry`)) {
    showToast('Not enough balance — fund your wallet first')
    setView('onboarding')
    return
  }
  state.enteredPools[tier] = {
    variant: currentPoolVariant(),
    enteredAt: new Date().toISOString()
  }
  persist()
  renderBracket()
  showToast(`Entered the $${tier} ${PoolVariantHelpers ? PoolVariantHelpers.variantDisplayName(currentPoolVariant()) : 'pool'} · ${fmtMoney(tier)} escrowed via WDK`)
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
    : `<div class="empty-state"><strong>${uiT('emptyLeaderboard')}</strong></div>`
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

function deriveDemoOfficialResults () {
  const winners = {}
  for (const match of round32Matches) {
    if (!match.score || match.score[0] == null || match.score[1] == null) continue
    const [a, b] = match.score
    if (a > b) winners[match.id] = match.slots[0]
    else if (b > a) winners[match.id] = match.slots[1]
    else if (match.status && match.status.toLowerCase().includes('pen')) {
      // For penalty results, infer the winner from the status text if possible.
      const text = match.status
      const parts = text.match(/\d+/g)
      if (parts && parts.length >= 2) {
        const penA = Number(parts[0]); const penB = Number(parts[1])
        if (penA > penB) winners[match.id] = match.slots[0]
        else if (penB > penA) winners[match.id] = match.slots[1]
      }
    }
  }
  return winners
}

function demoVariantScoreboard (selectedPool) {
  if (!PearCupCore || typeof PearCupCore.scoreVariantSubmission !== 'function') return null
  const variant = currentPoolVariant()
  const officialResults = deriveDemoOfficialResults()
  const matchIds = Object.keys(officialResults)
  if (matchIds.length === 0) return null
  const picks = PoolVariantHelpers
    ? PoolVariantHelpers.buildSubmissionPicks(variant, state.picks, bracketMatchIds)
    : state.picks
  const resultSnapshot = buildVariantResultSnapshot(variant, officialResults)
  return PearCupCore.scoreVariantSubmission({
    submission: {
      userId: state.username || 'captain',
      entryId: `demo-${selectedPool.tier}`,
      picks
    },
    officialResults: variant === 'classic-bracket' || variant === 'upset-bounty' ? officialResults : null,
    resultSnapshot,
    variant
  })
}

function buildVariantResultSnapshot (variant, officialResults) {
  if (variant === 'confidence') {
    const cardResults = {}
    for (const [matchId, winner] of Object.entries(officialResults)) cardResults[matchId] = winner
    return { cardResults }
  }
  if (variant === 'survivor') {
    const results = {}
    for (const [matchId, winner] of Object.entries(officialResults)) {
      results[matchId] = { winnerEntrantId: winner }
    }
    return { results }
  }
  if (variant === 'side-quest') {
    const results = {}
    for (const [matchId, winner] of Object.entries(officialResults)) {
      results[matchId] = { winnerEntrantId: winner, roundNumber: bracketRoundForMatchId(matchId) }
    }
    return { results }
  }
  if (variant === 'upset-bounty') {
    const results = {}
    for (const [matchId, winner] of Object.entries(officialResults)) {
      const roundNumber = bracketRoundForMatchId(matchId)
      const underdog = seedForTeamId(winner, teams) > 16 ? winner : null
      results[matchId] = {
        winnerEntrantId: winner,
        roundNumber,
        underdogEntrantId: underdog,
        upsetBonus: underdog ? 2 : 0
      }
    }
    return { results }
  }
  // classic-bracket and head-to-head-duel use the engine's classic bracket scorer.
  const results = {}
  for (const [matchId, winner] of Object.entries(officialResults)) {
    results[matchId] = { winnerEntrantId: winner, roundNumber: bracketRoundForMatchId(matchId) }
  }
  return { results }
}

function bracketRoundForMatchId (matchId) {
  const id = String(matchId || '').toLowerCase()
  if (id.startsWith('r32')) return 1
  if (id.startsWith('r16')) return 2
  if (id.startsWith('qf')) return 3
  if (id.startsWith('sf')) return 4
  if (id.includes('final')) return 5
  return 1
}

function seedForTeamId (teamId) {
  const index = teams.findIndex(team => team && team.id === teamId)
  return index < 0 ? null : index + 1
}

function renderBracketDemoStats (selectedPool) {
  const entered = !!state.enteredPools[selectedPool.tier]
  const remaining = remainingPicks()
  const status = integrationRuntime.readiness.settlement
  const variantName = PoolVariantHelpers ? PoolVariantHelpers.variantDisplayName(currentPoolVariant()) : 'Classic bracket'
  const demoScore = demoVariantScoreboard(selectedPool)
  const scoreHtml = demoScore
    ? `<div><span>Demo score</span><strong>${demoScore.score}${demoScore.totalMatches ? `/${demoScore.totalMatches}` : ''}</strong></div>`
    : ''
  if ($('#bracketStats')) $('#bracketStats').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Pool</p><strong>${selectedPool.prize}</strong></div>
      <div class="settlement-kpis">
        <div><span>Entrants</span><strong>${selectedPool.entrants}/${selectedPool.max}</strong></div>
        <div><span>Your entry</span><strong>${entered ? 'Entered' : 'Open'}</strong></div>
        <div><span>Picks</span><strong>${remaining > 0 ? `${remaining} left` : 'Complete'}</strong></div>
        ${scoreHtml}
      </div>
      <p class="live-copy">Variant: ${escapeHtml(variantName)} · demo entries are ready for tonight; real payouts stay locked until the worker settlement stack is explicitly enabled.</p>
    </article>
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Settlement</p><strong>${status.label}</strong></div>
      <p class="live-copy">Demo entries are ready for tonight; real payouts stay locked until the worker settlement stack is explicitly enabled.</p>
    </article>`

  if ($('#bracketEntriesPanel')) $('#bracketEntriesPanel').innerHTML = `
    <article class="settlement-rail-card entry-ledger-card">
      <div class="rail-header"><p class="eyebrow">Entries</p><strong>${escapeHtml(variantName)} pool</strong></div>
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
        <div><span>Variant</span><code>${escapeHtml(variantName)}</code></div>
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

// A fight card is a set of INDEPENDENT bouts (main event, co-main, prelims) —
// no advancement tree and no connectors. The fit's `round32Matches` already
// carry the real bouts (slots = the two fighters, `time` = the card position),
// so each bout renders as a standalone match card and reuses the pick machinery.
function boutLabel (position) {
  const map = { Main: 'Main event', 'Co-main': 'Co-main event', Card: 'Preliminary card' }
  return map[position] || position || 'Bout'
}

function renderPropRow (bout, prop, options) {
  const matchKey = `${bout.id}-${prop}`
  const picked = getPick(matchKey)
  return `
    <div class="prop-row team-row" data-prop-row="${escapeHtml(matchKey)}">
      <span class="prop-label">${escapeHtml(prop === 'method' ? 'Method' : 'Round')}</span>
      <span class="prop-options">
        ${options.map(option => {
          const isPicked = picked === option
          return `<button class="prop-option${isPicked ? ' is-picked' : ''}" type="button" data-match="${escapeHtml(matchKey)}" data-pick="${escapeHtml(option)}" aria-pressed="${isPicked}">${escapeHtml(option)}</button>`
        }).join('')}
      </span>
    </div>`
}

function renderFightCardBoard () {
  const board = $('#bracketBoard')
  if (!board) return
  board.classList.add('is-fight-card')
  board.innerHTML = round32Matches.map(raw => {
    // Normalize through makeMatch so score/sample defaults exist (renderTeamRow
    // reads match.sample) — the raw fit bout only carries id/time/status/slots.
    const bout = makeMatch(raw.id, raw.time, raw.status, raw.slots, raw.score, raw.sample)
    const props = raw.props || {}
    return `
      <article class="fight-bout match-card" data-match-card="${bout.id}">
        <div class="match-meta">
          <span class="fight-bout-slot">${escapeHtml(boutLabel(bout.time))}</span>
          <span class="match-status">${escapeHtml(bout.status || 'Open')}</span>
        </div>
        ${renderTeamRow(bout, bout.slots[0], 0)}
        ${renderTeamRow(bout, bout.slots[1], 1)}
        ${props.method ? renderPropRow(bout, 'method', props.method) : ''}
        ${props.round ? renderPropRow(bout, 'round', props.round) : ''}
      </article>
    `
  }).join('')

  $$('#bracketBoard [data-pick]').forEach(button => {
    button.addEventListener('click', () => {
      // Each bout is independent — pick a winner, no downstream to clear.
      setPick(button.dataset.match, button.dataset.pick)
      persist()
      renderBracket()
    })
  })
}

function defaultSideQuestCategories () {
  // When the fit does not supply categories, side-quest falls back to a small
  // set of entrant-race picks over the bracket field.
  const options = teams.slice(0, 16).map(team => ({ id: team.id, name: `${team.flag} ${team.name}` }))
  return [
    { id: 'sidequest-top-scorer', title: 'Top scorer race', nominees: options },
    { id: 'sidequest-dark-horse', title: 'Dark horse', nominees: options },
    { id: 'sidequest-finalist', title: 'Reaches the final', nominees: options }
  ]
}

// An awards card is a set of INDEPENDENT categories; each is a "pick one
// nominee" choice. No teams, no bracket — the fit supplies `categories`.
function renderAwardsBoard () {
  const board = $('#bracketBoard')
  if (!board) return
  board.classList.remove('is-fight-card')
  board.classList.add('is-awards-card')
  board.innerHTML = awardsCategories.map(category => `
    <article class="awards-category match-card" data-match-card="${escapeHtml(category.id)}">
      <div class="match-meta">
        <span class="fight-bout-slot">${escapeHtml(category.title)}<span class="award-weight">×${Number(category.weight || 1)}</span></span>
        <span class="match-status">${getPick(category.id) ? 'Picked' : 'Open'}</span>
      </div>
      <div class="awards-nominees">
        ${(category.nominees || []).map(nominee => {
          const picked = getPick(category.id) === nominee.id
          return `
            <button class="nominee-row team-row${picked ? ' is-picked' : ''}" type="button" data-match="${escapeHtml(category.id)}" data-pick="${escapeHtml(nominee.id)}" aria-pressed="${picked}">
              <span class="nominee-name">${escapeHtml(nominee.name)}</span>
              ${nominee.detail ? `<span class="nominee-detail">${escapeHtml(nominee.detail)}</span>` : ''}
            </button>`
        }).join('')}
      </div>
    </article>
  `).join('')

  $$('#bracketBoard [data-pick]').forEach(button => {
    button.addEventListener('click', () => {
      // Each category is independent — pick one nominee.
      setPick(button.dataset.match, button.dataset.pick)
      persist()
      renderBracket()
    })
  })
}

// Group-plus-knockout: predict each group's winner and runner-up. Two picks per
// group, keyed `<groupId>-1` (winner) and `<groupId>-2` (runner-up).
function groupPickKey (groupId, place) { return `${groupId}-${place}` }

// Deterministic seeding: group winner/runner-up auto-advance into the knockout
// bracket slots so group stage picks feed the bracket without extra UI.
// Supports up to 8 groups (A–H) feeding a Round of 16 knockout tree.
const GROUP_ADVANCE_MAP = [
  { groupId: 'grp-A', place: '1', matchId: 'r32-1', slot: 0 },
  { groupId: 'grp-A', place: '2', matchId: 'r32-2', slot: 1 },
  { groupId: 'grp-B', place: '1', matchId: 'r32-2', slot: 0 },
  { groupId: 'grp-B', place: '2', matchId: 'r32-1', slot: 1 },
  { groupId: 'grp-C', place: '1', matchId: 'r32-3', slot: 0 },
  { groupId: 'grp-C', place: '2', matchId: 'r32-4', slot: 1 },
  { groupId: 'grp-D', place: '1', matchId: 'r32-4', slot: 0 },
  { groupId: 'grp-D', place: '2', matchId: 'r32-3', slot: 1 },
  { groupId: 'grp-E', place: '1', matchId: 'r32-5', slot: 0 },
  { groupId: 'grp-E', place: '2', matchId: 'r32-6', slot: 1 },
  { groupId: 'grp-F', place: '1', matchId: 'r32-6', slot: 0 },
  { groupId: 'grp-F', place: '2', matchId: 'r32-5', slot: 1 },
  { groupId: 'grp-G', place: '1', matchId: 'r32-7', slot: 0 },
  { groupId: 'grp-G', place: '2', matchId: 'r32-8', slot: 1 },
  { groupId: 'grp-H', place: '1', matchId: 'r32-8', slot: 0 },
  { groupId: 'grp-H', place: '2', matchId: 'r32-7', slot: 1 }
]

function bracketSlotKey (matchId, slot) { return `${matchId}-slot-${slot}` }

function advancementForGroupPlace (groupId, place) {
  return GROUP_ADVANCE_MAP.find(entry => entry.groupId === groupId && entry.place === place) || null
}

function clearGroupAdvancement (groupId, place) {
  const entry = advancementForGroupPlace(groupId, place)
  if (!entry) return
  deletePick(bracketSlotKey(entry.matchId, entry.slot))
}

function applyGroupAdvancement (groupId, place, teamId) {
  const entry = advancementForGroupPlace(groupId, place)
  if (!entry) return
  setPick(bracketSlotKey(entry.matchId, entry.slot), teamId)
}

function groupAdvancementForSlot (matchId, slot) {
  return GROUP_ADVANCE_MAP.find(entry => entry.matchId === matchId && entry.slot === slot) || null
}

function groupSlotPlaceholder (matchId, slot) {
  const entry = groupAdvancementForSlot(matchId, slot)
  if (!entry) return 'TBD'
  const placeLabel = entry.place === '1' ? '1st' : '2nd'
  const groupLetter = entry.groupId.replace('grp-', '')
  return `${placeLabel} · Grp ${groupLetter}`
}

function renderGroupKnockoutSlot (matchId, slot) {
  const teamId = state.picks[bracketSlotKey(matchId, slot)]
  const team = teamId ? teamById(teamId) : null
  const picked = team && getPick(matchId) === team.id
  if (!team) {
    return `
      <button class="team-row" type="button" disabled>
        <span class="team-flag" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z" fill="#717982"/></svg>
        </span>
        <span class="team-title">${escapeHtml(groupSlotPlaceholder(matchId, slot))}</span>
        <span class="score"></span>
      </button>`
  }
  return `
    <button class="team-row ${picked ? 'is-picked' : ''}" type="button" data-match="${escapeHtml(matchId)}" data-pick="${escapeHtml(team.id)}" aria-pressed="${picked}">
      <span class="team-flag">${team.flag}</span>
      <span class="team-title">${escapeHtml(team.name)}</span>
      <span class="score"></span>
    </button>`
}

function renderGroupKnockoutBracket () {
  const knockoutMatches = round32Matches.filter(match => match.id && match.id.startsWith('r32-'))
  if (!knockoutMatches.length) return ''
  return `
    <div class="group-knockout-header">Knockout bracket</div>
    <div class="group-knockout-grid">
      ${knockoutMatches.map(match => `
        <article class="match-card knockout-match" data-match-card="${escapeHtml(match.id)}">
          <div class="match-meta">
            <span>${escapeHtml(match.time || 'Round of 16')}</span>
            <span class="match-status">${escapeHtml(match.status || 'Open')}</span>
          </div>
          ${renderGroupKnockoutSlot(match.id, 0)}
          ${renderGroupKnockoutSlot(match.id, 1)}
        </article>
      `).join('')}
    </div>
  `
}

function renderGroupsBoard () {
  const board = $('#bracketBoard')
  if (!board) return
  board.classList.remove('is-fight-card', 'is-awards-card')
  board.classList.add('is-groups')
  const groupCards = groupStages.map(group => {
    const places = [['1', '1st · Winner'], ['2', '2nd · Runner-up']].map(([place, label]) => {
      const key = groupPickKey(group.id, place)
      const options = (group.teams || []).map(teamId => {
        const team = teamById(teamId)
        const picked = getPick(key) === teamId
        return `
          <button class="group-pick team-row${picked ? ' is-picked' : ''}" type="button" data-match="${escapeHtml(key)}" data-pick="${escapeHtml(teamId)}" aria-pressed="${picked}">
            <span class="team-flag">${team.flag}</span><span class="team-title">${escapeHtml(team.name)}</span>
          </button>`
      }).join('')
      return `<div class="group-place"><span class="group-place-label">${label}</span><div class="group-place-options">${options}</div></div>`
    }).join('')
    return `
      <article class="group-card match-card" data-match-card="${escapeHtml(group.id)}">
        <div class="match-meta"><span class="fight-bout-slot">${escapeHtml(group.name)}</span></div>
        ${places}
      </article>`
  }).join('')

  board.innerHTML = `<div class="groups-grid">${groupCards}</div>${renderGroupKnockoutBracket()}`

  $$('#bracketBoard .group-card [data-pick]').forEach(button => {
    button.addEventListener('click', () => {
      const groupId = button.dataset.match.split('-').slice(0, 2).join('-')
      const place = button.dataset.match.split('-').slice(2).join('-')
      clearGroupAdvancement(groupId, place)
      setPick(button.dataset.match, button.dataset.pick)
      applyGroupAdvancement(groupId, place, button.dataset.pick)
      persist()
      renderBracket()
    })
  })

  $$('#bracketBoard .knockout-match [data-pick]').forEach(button => {
    button.addEventListener('click', () => {
      setPick(button.dataset.match, button.dataset.pick)
      persist()
      renderBracket()
    })
  })
}

function renderBracketBoard () {
  if (templateKind === 'fight-card') return renderFightCardBoard()
  if (templateKind === 'awards-card') return renderAwardsBoard()
  if (templateKind === 'group-plus-knockout' && groupStages.length) return renderGroupsBoard()
  if (templateKind === 'round-robin') return renderRoundRobinBoard()
  if (templateKind === 'series-playoff') return renderSeriesPlayoffBoard()
  if (templateKind === 'creator-custom') return renderCreatorCustomBoard()
  const variant = currentPoolVariant()
  if (variant === 'side-quest') return renderSideQuestBoard()
  if (variant === 'survivor') return renderSurvivorBoard()
  if (variant === 'confidence') return renderConfidenceBoard()
  renderClassicOrUpsetBoard(variant === 'upset-bounty')
}

// Round-robin template kind: a simple standings table where each team is a row.
function renderRoundRobinBoard () {
  const board = $('#bracketBoard')
  if (!board) return
  board.classList.remove('is-fight-card', 'is-awards-card', 'is-groups')
  board.classList.add('is-round-robin')
  board.innerHTML = `
    <table class="round-robin-table">
      <thead>
        <tr>
          <th>Team</th>
          <th>P</th>
          <th>W</th>
          <th>D</th>
          <th>L</th>
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>
        ${teams.map((team, index) => `
          <tr>
            <td><span class="team-flag">${team.flag}</span> ${escapeHtml(team.name)}</td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

// Series-playoff template kind: best-of-7 series cards. Reuse the bracket data
// structure but render each matchup as an independent series pick.
function renderSeriesPlayoffBoard () {
  const board = $('#bracketBoard')
  if (!board) return
  board.classList.remove('is-fight-card', 'is-awards-card', 'is-groups', 'is-round-robin')
  board.innerHTML = `
    <div class="series-playoff-grid">
      ${round32Matches.map(raw => {
        const match = makeMatch(raw.id, raw.time, raw.status, raw.slots, raw.score, raw.sample)
        return `
          <article class="match-card series-match" data-match-card="${match.id}">
            <div class="match-meta">
              <span>${escapeHtml(match.time || 'Series')}</span>
              <span class="match-status">${escapeHtml(match.status || 'Open')}</span>
            </div>
            ${renderTeamRow(match, match.slots[0], 0)}
            ${renderTeamRow(match, match.slots[1], 1)}
          </article>
        `
      }).join('')}
    </div>
  `
  $$('#bracketBoard [data-pick]').forEach(button => {
    button.addEventListener('click', () => {
      setPick(button.dataset.match, button.dataset.pick)
      persist()
      renderBracket()
    })
  })
}

// Creator-custom template kind: host-entered results; the shell surface is the
// same bracket picker, but the result authority is the host instead of a feed.
function renderCreatorCustomBoard () {
  const variant = currentPoolVariant()
  renderClassicOrUpsetBoard(variant === 'upset-bounty')
}

function renderClassicOrUpsetBoard (showUpsetBadges) {
  const board = $('#bracketBoard')
  if (board) board.classList.remove('is-fight-card', 'is-awards-card', 'is-groups')
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
        <article class="match-card bracket-match${showUpsetBadges ? ' is-upset-bounty' : ''}" data-round="${round.key}" data-match-card="${match.id}" style="grid-column:${place.column};grid-row:${place.row} / span ${place.span}">
          <div class="match-meta">
            <span>${match.time}</span>
            <span class="match-status">${match.status}</span>
            ${showUpsetBadges ? `<span class="upset-badge" title="Seed gap bonus">${upsetBadgeForMatch(match)}</span>` : ''}
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
      setPick(button.dataset.match, button.dataset.pick)
      clearDownstream(button.dataset.match)
      persist()
      renderBracket()
    })
  })
  scheduleBracketConnectors()
}

function upsetBadgeForMatch (match) {
  const seedA = seedForTeamId(match.slots[0])
  const seedB = seedForTeamId(match.slots[1])
  if (seedA == null || seedB == null) return ''
  const gap = Math.abs(seedA - seedB)
  return gap >= 8 ? `+${gap}` : ''
}

function renderConfidenceBoard () {
  const board = $('#bracketBoard')
  if (board) board.classList.remove('is-fight-card', 'is-awards-card', 'is-groups')
  const rounds = buildRounds()
  const maxConfidence = bracketMatchIds.length
  const usedConfidence = new Set()
  for (const id of bracketMatchIds) {
    const c = state.picks[`${id}-confidence`]
    if (c) usedConfidence.add(Number(c))
  }

  $('#bracketBoard').innerHTML = `
    <div class="confidence-instructions">
      <p class="live-copy">Assign each winner a unique confidence 1–${maxConfidence}. Higher = more sure.</p>
      ${confidenceValidationErrors().map(e => `<p class="validation-error">${escapeHtml(e)}</p>`).join('')}
    </div>
    ${rounds.map((round, roundIndex) => `
      <section class="confidence-round">
        <p class="round-title">${round.label}</p>
        <div class="confidence-round-matches">
          ${round.matches.map(match => `
            <article class="match-card bracket-match" data-match-card="${match.id}">
              <div class="match-meta">
                <span>${match.time}</span>
                <span class="match-status">${match.status}</span>
              </div>
              ${renderTeamRow(match, match.slots[0], 0)}
              ${renderTeamRow(match, match.slots[1], 1)}
              <div class="confidence-row">
                <label for="conf-${match.id}">Confidence</label>
                <select id="conf-${match.id}" class="confidence-select" data-confidence="${match.id}">
                  <option value="">—</option>
                  ${Array.from({ length: maxConfidence }, (_, i) => {
                    const n = i + 1
                    const selected = Number(state.picks[`${match.id}-confidence`]) === n
                    const disabled = !selected && usedConfidence.has(n)
                    return `<option value="${n}"${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}>${n}</option>`
                  }).join('')}
                </select>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `).join('')}
  `

  $$('#bracketBoard [data-pick]').forEach(button => {
    button.addEventListener('click', () => {
      setPick(button.dataset.match, button.dataset.pick)
      clearDownstream(button.dataset.match)
      persist()
      renderBracket()
    })
  })
  $$('#bracketBoard .confidence-select').forEach(select => {
    select.addEventListener('change', () => {
      const matchId = select.dataset.confidence
      const value = select.value
      if (value) setPick(`${matchId}-confidence`, Number(value))
      else deletePick(`${matchId}-confidence`)
      persist()
      renderBracket()
    })
  })
}

function confidenceValidationErrors () {
  const picks = []
  for (const id of bracketMatchIds) {
    const outcome = state.picks[id]
    const confidence = state.picks[`${id}-confidence`]
    if (outcome && confidence) picks.push({ confidence: Number(confidence) })
  }
  if (!PoolVariantHelpers) return []
  const validation = PoolVariantHelpers.validateConfidencePicks(picks)
  return validation.errors
}

function renderSurvivorBoard () {
  const board = $('#bracketBoard')
  if (board) board.classList.remove('is-fight-card', 'is-awards-card', 'is-groups')
  const round = state.survivorRound || 1
  const roundName = PoolVariantHelpers ? PoolVariantHelpers.survivorRoundName(round) : `Round ${round}`
  const rounds = buildRounds()
  const roundKeyMap = { 1: 'round32', 2: 'round16', 3: 'quarter', 4: 'semi', 5: 'final' }
  const currentRound = rounds.find(r => r.key === roundKeyMap[round]) || rounds[0]
  const used = new Set(state.survivorUsedTeams || [])
  const alreadyPicked = state.picks[`survivor-r${round}`]

  $('#bracketBoard').innerHTML = `
    <div class="survivor-instructions">
      <p class="live-copy">Survivor: pick exactly one team for ${roundName}. You cannot reuse a team.</p>
      ${alreadyPicked ? `<p class="live-copy">Locked ${roundName}: ${teamById(alreadyPicked).flag} ${escapeHtml(teamById(alreadyPicked).name)} · <button type="button" class="text-btn" id="advanceSurvivorRound">Advance</button></p>` : ''}
    </div>
    <section class="survivor-round">
      <p class="round-title">${roundName}</p>
      <div class="survivor-round-matches">
        ${currentRound.matches.map(match => `
          <article class="match-card bracket-match" data-match-card="${match.id}">
            <div class="match-meta">
              <span>${match.time}</span>
              <span class="match-status">${match.status}</span>
            </div>
            ${renderSurvivorTeamRow(match, match.slots[0], 0, used, alreadyPicked)}
            ${renderSurvivorTeamRow(match, match.slots[1], 1, used, alreadyPicked)}
          </article>
        `).join('')}
      </div>
    </section>
  `

  $$('#bracketBoard [data-survivor-pick]').forEach(button => {
    button.addEventListener('click', () => {
      if (state.picks[`survivor-r${round}`]) return
      const teamId = button.dataset.survivorPick
      setPick(`survivor-r${round}`, teamId)
      if (!state.survivorUsedTeams) state.survivorUsedTeams = []
      state.survivorUsedTeams.push(teamId)
      if (round < 5) state.survivorRound = round + 1
      persist()
      renderBracket()
    })
  })
  const advanceBtn = $('#advanceSurvivorRound')
  if (advanceBtn) advanceBtn.addEventListener('click', () => {
    if (round < 5) state.survivorRound = round + 1
    persist()
    renderBracket()
  })
}

function renderSurvivorTeamRow (match, teamId, index, used, alreadyPicked) {
  const team = teamId ? teamById(teamId) : null
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
  const disabled = used.has(team.id) || alreadyPicked
  return `
    <button class="team-row ${used.has(team.id) ? 'is-used' : ''}" type="button" data-survivor-pick="${team.id}" ${disabled ? 'disabled' : ''}>
      <span class="team-flag">${team.flag}</span>
      <span class="team-title">${escapeHtml(team.name)}</span>
      <span class="pick-side">
        ${used.has(team.id) ? '<span class="pick-chip">Used</span>' : ''}
        <span class="score">${match.score[index] === null ? '' : match.score[index]}</span>
      </span>
    </button>
  `
}

function renderSideQuestBoard () {
  const board = $('#bracketBoard')
  if (!board) return
  board.classList.remove('is-fight-card', 'is-groups')
  board.classList.add('is-awards-card')
  const categories = awardsCategories.length ? awardsCategories : defaultSideQuestCategories()
  board.innerHTML = categories.map(category => `
    <article class="awards-category match-card" data-match-card="${escapeHtml(category.id)}">
      <div class="match-meta">
        <span class="fight-bout-slot">${escapeHtml(category.title)}</span>
        <span class="match-status">${getPick(category.id) ? 'Picked' : 'Open'}</span>
      </div>
      <div class="awards-nominees">
        ${(category.nominees || []).map(nominee => {
          const picked = getPick(category.id) === nominee.id
          return `
            <button class="nominee-row team-row${picked ? ' is-picked' : ''}" type="button" data-match="${escapeHtml(category.id)}" data-pick="${escapeHtml(nominee.id)}" aria-pressed="${picked}">
              <span class="nominee-name">${escapeHtml(nominee.name)}</span>
              ${nominee.detail ? `<span class="nominee-detail">${escapeHtml(nominee.detail)}</span>` : ''}
            </button>`
        }).join('')}
      </div>
    </article>
  `).join('')

  $$('#bracketBoard [data-pick]').forEach(button => {
    button.addEventListener('click', () => {
      setPick(button.dataset.match, button.dataset.pick)
      persist()
      renderBracket()
    })
  })
}

async function renderBracket () {
  const renderId = ++bracketRenderSequence
  const selectedPool = pools.find(pool => pool.tier === state.selectedTier) || pools[1]
  const wdk = integrationRuntime.readiness.tetherWdk
  const entered = !!state.enteredPools[selectedPool.tier]
  const variantName = PoolVariantHelpers ? PoolVariantHelpers.variantDisplayName(currentPoolVariant()) : 'Classic bracket'
  $('#bracketTierLabel').textContent = `$${selectedPool.tier} ${variantName}${entered ? ' · entered' : ''}`
  const bracketTitleEl = $('#bracketTitle')
  if (bracketTitleEl && templateKind === 'fight-card') bracketTitleEl.textContent = 'Pick the fight card'
  if (bracketTitleEl && templateKind === 'awards-card') bracketTitleEl.textContent = 'Make your award picks'
  if (bracketTitleEl && templateKind === 'group-plus-knockout' && groupStages.length) bracketTitleEl.textContent = 'Predict the group stage'
  if (bracketTitleEl && templateKind === 'round-robin') bracketTitleEl.textContent = 'Predict the standings'
  if (bracketTitleEl && templateKind === 'series-playoff') bracketTitleEl.textContent = 'Pick the series'
  if (bracketTitleEl && templateKind === 'creator-custom') bracketTitleEl.textContent = 'Host bracket'
  if (bracketTitleEl && (templateKind === 'single-elimination' || templateKind === 'creator-custom' || templateKind === 'series-playoff')) {
    const titles = {
      'classic-bracket': 'Fill your bracket',
      'confidence': 'Confidence card',
      'survivor': 'Survivor picks',
      'upset-bounty': 'Upset bounty bracket',
      'side-quest': 'Side quest picks'
    }
    bracketTitleEl.textContent = titles[currentPoolVariant()] || 'Fill your bracket'
  }
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
  for (const id of seen) deletePick(id)
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

// The live match's fighters/teams come from THIS fit's main event (first bout),
// so the momentum card, hero, watch, and rail show the real matchup on every
// server — not the world-cup default.
function mainEventTeams () {
  const fitCfg = (typeof window !== 'undefined' && window.ULTIMATE_FIT_CONFIG) || {}
  const fitTeams = Array.isArray(fitCfg.teams) ? fitCfg.teams : []
  const mainBout = (Array.isArray(fitCfg.round32Matches) && fitCfg.round32Matches[0]) || null
  const pick = (id, fb) => fitTeams.find(t => t.id === id) || fb
  const home = pick(mainBout && mainBout.slots && mainBout.slots[0], fitTeams[0]) || { id: 'es', name: 'Spain', flag: '🇪🇸' }
  const away = pick(mainBout && mainBout.slots && mainBout.slots[1], fitTeams[1]) || { id: 'at', name: 'Austria', flag: '🇦🇹' }
  const comp = (fitCfg.arcade && fitCfg.arcade.promotion) || fitCfg.title || 'FIFA World Cup'
  return { home, away, comp }
}

// Re-apply the main-event teams to the live sim once the fit config is
// guaranteed loaded (called from boot()); the sim is constructed early.
function reseedLiveMatch () {
  try {
    const me = mainEventTeams()
    const s = feedState()
    if (s && s.home) { s.home.name = me.home.name; s.home.flag = me.home.flag; s.home.teamId = me.home.id }
    if (s && s.away) { s.away.name = me.away.name; s.away.flag = me.away.flag; s.away.teamId = me.away.id }
    if (s && s.competition) s.competition.name = me.comp
  } catch (e) {}
}

// Given a feed's home/away, return the names to DISPLAY: the feed's own if its
// teams belong to this fit, otherwise this fit's main event (so the world-cup
// demo live feed doesn't show Spain vs Austria on the fight server).
function displayMatchTeams (home, away) {
  if (home && home.teamId && teams.some(t => t.id === home.teamId)) return { home, away }
  const me = mainEventTeams()
  return {
    home: Object.assign({}, home || {}, { name: me.home.name, flag: me.home.flag, teamId: me.home.id }),
    away: Object.assign({}, away || {}, { name: me.away.name, flag: me.away.flag, teamId: me.away.id })
  }
}

function createSimLiveFeed () {
  const listeners = new Set()
  let timer = null
  const me = mainEventTeams()
  const homeTeam = me.home, awayTeam = me.away, compName = me.comp
  const st = {
    minute: 0,
    home: { name: homeTeam.name, flag: homeTeam.flag, teamId: homeTeam.id, goals: 0 },
    away: { name: awayTeam.name, flag: awayTeam.flag, teamId: awayTeam.id, goals: 0 },
    possession: 50,
    shots: [0, 0],
    threat: 50,
    hasScore: false,
    matchStatus: 'TIMED',
    utcDate: '2026-07-02T19:00:00Z',
    stage: 'LAST_32',
    competition: { name: compName }
  }
  const emit = ev => listeners.forEach(fn => fn(ev, st))
  function tick () {
    if (st.matchStatus === 'TIMED' || st.matchStatus === 'SCHEDULED') {
      emit({ type: 'preview', team: st.home.name + ' vs ' + st.away.name + ' room is open.', clock: 'Soon', minute: 0 })
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
    const dt = displayMatchTeams(st.home, st.away)
    const foreign = dt.home.name !== st.home.name
    const goals = foreign ? [] : (state.feedEvents || []).filter(e => e.type === 'goal')
    const intro = `<div class="commentary-line"><time>LIVE</time><p>Following ${escapeHtml(dt.home.name)} vs ${escapeHtml(dt.away.name)} — QVAC commentary updates as goals go in.</p></div>`
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
  const crest = () => '<div class="lb-crest lb-crest-blank">⚽</div>'
  el.innerHTML = `
    <div class="lb-comp">
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
  const dt = displayMatchTeams(st.home, st.away)
  const score = $('#tvScore'); if (score) score.textContent = st.hasScore === false
    ? `${dt.home.name} vs ${dt.away.name}`
    : `${dt.home.name} ${st.home.goals} - ${st.away.goals} ${dt.away.name}`
  const title = $('#watchTitle'); if (title) title.textContent = `${dt.home.name} vs ${dt.away.name}`
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

// ---- Screen share (real getDisplayMedia capture + WebRTC relay over the watch topic) ----
let shareStream = null
let screenShareRtc = null
const RTC_CONFIG = {
  iceServers: [
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
      video.hidden = false
      video.play().catch(() => {})
    }
    const pitch = $('#tvPitch'); if (pitch) pitch.style.opacity = '0'
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
    badge.hidden = false
    badge.innerHTML = `<i></i>You are sharing your screen · ${n} peer${n === 1 ? '' : 's'} in room${rtcCount ? ` · ${rtcCount} relay connected` : ''}`
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
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showToast('Screen share needs the Pear runtime / a supported browser')
    return
  }
  bindScreenShareSignaling()
  try {
    shareStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false })
  } catch (err) { showToast('Screen share cancelled'); return }
  const video = $('#shareVideo')
  if (video) { video.srcObject = shareStream; video.hidden = false; video.play().catch(() => {}) }
  const pitch = $('#tvPitch'); if (pitch) pitch.style.opacity = '0'
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
  if (shareStream) { shareStream.getTracks().forEach(t => t.stop()); shareStream = null }
  const video = $('#shareVideo'); if (video) { video.hidden = true; video.srcObject = null }
  const pitch = $('#tvPitch'); if (pitch) pitch.style.opacity = ''
  const btn = $('#shareScreenBtn'); if (btn) btn.classList.remove('is-live')
  if (window.PearCupWatchSync) window.PearCupWatchSync.broadcastScreen({ t: 'screen:stop' })
  closeScreenShareRtc()
  updateScreenShareBadge()
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
          </div>
        </div>`).join('')}
    </div>
    <div class="watch-challenge-panel">
      <div class="watch-challenge-head">
        <p class="eyebrow">Mini-games</p>
        <strong>Challenge watchers</strong>
      </div>
      <div class="watch-challenge-list" id="watchChallengeList">
        ${fitMiniGames.map(gt => {
          const social = isSocialMiniGame(gt)
          const playable = isPlayableMiniGame(gt)
          const label = social ? ' · watch party' : (playable ? '' : ' · soon')
          return `
          <button class="secondary-button compact-action watch-challenge-game ${playable || social ? '' : 'is-coming-soon'}" data-game-type="${escapeHtml(gt)}" type="button">
            ${escapeHtml(miniGameTitles[gt] || gt)}${label}
          </button>`
        }).join('')}
      </div>
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

  $$('#watchChallengeList .watch-challenge-game').forEach(button => {
    button.addEventListener('click', () => {
      const gt = button.dataset.gameType
      if (!isPlayableMiniGame(gt) && !isSocialMiniGame(gt)) {
        showToast(`${miniGameTitles[gt] || gt} is coming soon — picking a winner with commit/reveal is next.`)
        return
      }
      selectedMiniGame = gt
      hostPeerGame(selectedMiniGame)
      setView('games')
    })
  })

  renderCommentaryFeed()

  $('#chatFeed').innerHTML = state.chat.length
    ? state.chat.map(message => `
    <div class="chat-message">
      <div class="chat-meta">
        <strong>${escapeHtml(message.user)}</strong>
        <time>${escapeHtml(message.time)}</time>
      </div>
      <p>${escapeHtml(message.text)}</p>
    </div>
  `).join('')
    : `<div class="empty-state"><strong>${uiT('emptyChat')}</strong></div>`

  $('#voiceToggle').classList.toggle('is-live', state.voice)

  // Join the shared watch room for this match (chat + reactions + presence sync).
  if (window.PearCupWatchSync) {
    window.PearCupWatchSync.ensureRoom()
    window.PearCupWatchSync.bindReactionBar()
    window.PearCupWatchSync.updatePresence()
    if (typeof window.PearCupWatchSync.renderChallengeList === 'function') window.PearCupWatchSync.renderChallengeList()
  }
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

// Tennis serve zones for the Ace Serve Duel mini-game.
function aceZonePosition (zone) {
  if (zone === 'wide-left') return { x: 25, y: 30 }
  if (zone === 'body') return { x: 50, y: 30 }
  if (zone === 'wide-right') return { x: 75, y: 30 }
  if (zone === 'fault') return { x: 50, y: 92 }
  return zonePosition(zone)
}

// ---------------- Interactive Penalty Shootout ----------------
const SHOOTOUT_TOTAL = 5
const AIM_ZONES = ['left-high', 'center-high', 'right-high', 'left-low', 'center-low', 'right-low']
const BB_ZONES = ['left', 'center', 'right']
const AS_ZONES = ['fault', 'wide-left', 'body', 'wide-right']
const HR_PITCH_TYPES = ['fastball', 'curve', 'slider']
const HR_TIMINGS = ['good', 'late', 'early']
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
          <p class="over-win" id="overTrophy" hidden>★ WINNER ★</p>
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
  const powerDock = $('#powerDock')
  if (grid) grid.hidden = false
  if (powerDock) powerDock.hidden = false
  if (stage) {
    const oldPanel = stage.querySelector('.fk-panel')
    if (oldPanel) oldPanel.remove()
  }
  if (actions) actions.hidden = false
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

function renderGameLeaderboard () {
  const el = $('#gameLeaderboard')
  if (!el) return
  if (!gameLeaderboardRows.length) {
    el.innerHTML = `
      <div class="rail-header"><p class="eyebrow">Games</p><strong>${integrationRuntime.readiness.settlement.realMoneyEnabled ? 'Trusted results' : 'Demo results'}</strong></div>
      <div class="empty-state"><strong>${uiT('emptyLeaderboard')}</strong></div>`
    return
  }
  el.innerHTML = `
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

function pendingFriendJoinGameType () {
  try {
    return (new URLSearchParams(location.search).get('game') || '').trim().toLowerCase()
  } catch (e) {
    return ''
  }
}

function reactionChallengeActiveCode () {
  const rc = window.ReactionChallenge
  if (!rc) return null
  const snap = rc._testHelpers && rc._testHelpers.getState ? rc._testHelpers.getState() : null
  return snap && snap.active ? snap.code : null
}

function isLiveMarketGame (gameType) {
  return gameType === 'next-event' || gameType === 'scoreline-lock' || gameType === 'watch-party-streak'
}

function hostPeerGame (gameType) {
  if (gameType === 'reaction-challenge' && window.ReactionChallenge) {
    const code = window.ReactionChallenge.host(undefined, { name: state.username || 'captain' })
    startReactionChallengePeer(code)
    return
  }
  if (isLiveMarketGame(gameType) && window.LiveMarketGame) {
    const code = window.LiveMarketGame.host(undefined, { gameType, name: state.username || 'captain' })
    startLiveMarketPeer(code, gameType)
    return
  }
  if (window.PearCupPeerMatch && typeof window.PearCupPeerMatch.host === 'function') {
    window.PearCupPeerMatch.host(undefined, undefined, gameType)
  }
}

function promptJoinPeerGame (gameType) {
  if (gameType === 'reaction-challenge' && window.ReactionChallenge) {
    const raw = window.prompt('Enter the room code your friend shared:') || ''
    const code = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
    if (code) {
      selectedMiniGame = 'reaction-challenge'
      startReactionChallengePeerJoin(code)
    }
    return
  }
  if (isLiveMarketGame(gameType) && window.LiveMarketGame) {
    const raw = window.prompt('Enter the room code your friend shared:') || ''
    const code = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
    if (code) {
      selectedMiniGame = gameType
      startLiveMarketPeerJoin(code, gameType)
    }
    return
  }
  if (window.PearCupPeerMatch && typeof window.PearCupPeerMatch.promptJoin === 'function') {
    window.PearCupPeerMatch.promptJoin(gameType)
  }
}

function tryJoinFriendInvite (attempt = 0) {
  const code = pendingFriendJoinCode()
  const gameType = pendingFriendJoinGameType() || selectedMiniGame
  if (!code) return false
  document.documentElement.dataset.pearcupPendingJoin = code
  if (gameType === 'reaction-challenge' && window.ReactionChallenge) {
    if (reactionChallengeActiveCode() === code) {
      document.documentElement.dataset.pearcupJoinState = 'started'
      setView('games')
      return true
    }
    selectedMiniGame = 'reaction-challenge'
    document.documentElement.dataset.pearcupJoinState = 'joining'
    setView('games')
    startReactionChallengePeerJoin(code)
    return true
  }
  if (isLiveMarketGame(gameType) && window.LiveMarketGame) {
    const lm = window.LiveMarketGame
    const snap = lm._testHelpers && lm._testHelpers.getState ? lm._testHelpers.getState() : null
    if (snap && snap.active && snap.code === code) {
      document.documentElement.dataset.pearcupJoinState = snap.started ? 'started' : 'joining'
      setView('games')
      return true
    }
    selectedMiniGame = gameType
    document.documentElement.dataset.pearcupJoinState = 'joining'
    setView('games')
    startLiveMarketPeerJoin(code, gameType)
    return true
  }
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
    peerMatch.join(code, gameType)
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

function miniGameDescription (gameType) {
  if (gameType === 'penalty-clash') return 'Best-of-five Penalty Clash — you take 5 penalties and keep their 5. Outscore them for the win.'
  if (gameType === 'prediction-duel') return 'Predict a live fixture outcome — your pick is committed and scored against a bound event snapshot.'
  if (gameType === 'trivia-duel') return 'Race to answer — the verified question bank is attested by QVAC so the answer key cannot change mid-match.'
  if (gameType === 'free-kick-duel') return 'Bend it around the wall — out-think the keeper from set pieces.'
  if (gameType === 'buzzer-beater-duel') return 'Beat the buzzer — shoot from downtown and read your defender.'
  if (gameType === 'ace-serve-duel') return 'Serve for aces — place it, power it, spin it past the returner.'
  if (gameType === 'home-run-derby') return 'Read the pitch, time your swing, and launch it — 3 cuts to out-slug your rival.'
  if (gameType === 'reaction-challenge') return 'Fastest tap wins — wait for the moment, then beat your opponent to the buzzer.'
  if (gameType === 'next-event') return 'Watch-party side bet — predict the next live event with the room.'
  if (gameType === 'scoreline-lock') return 'Watch-party side bet — lock a scoreline before kickoff for bragging rights.'
  if (gameType === 'watch-party-streak') return 'Watch-party side bet — yes-or-no prompts; longest streak wins.'
  return `${escapeHtml(miniGameTitles[gameType] || gameType)} is coming soon.`
}

function renderGameLobby () {
  const el = $('#gameLobby')
  if (!el) return
  // Restore the penalty stage and panels when returning to the lobby.
  const stage = $('#penaltyStage')
  if (stage) { stage.hidden = false; stage.classList.remove('is-placeholder') }
  const hud = $('#shootoutHud')
  if (hud) hud.hidden = false
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = false
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = false
  const title = selectedMiniGameTitle()
  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title
  const gameTypeLabel = escapeHtml(title)
  const playable = playableMiniGames()
  if (!playable.includes(selectedMiniGame)) selectedMiniGame = playable[0] || 'penalty-clash'
  el.innerHTML = `
    <div class="mini-game-tabs" id="miniGameTabs" style="display:flex;gap:8px;overflow:auto;padding:4px 0 12px;">
      ${fitMiniGames.map((gt, i) => `
        <button class="${gt === selectedMiniGame ? 'primary-button' : 'secondary-button'} compact-action mini-game-tab ${isPlayableMiniGame(gt) ? '' : 'is-coming-soon'}" data-game-type="${escapeHtml(gt)}" type="button" ${isPlayableMiniGame(gt) ? '' : 'disabled'}>
          ${escapeHtml(miniGameTitles[gt] || gt)}${isPlayableMiniGame(gt) ? '' : ' · soon'}
        </button>`).join('')}
    </div>

    <div class="lobby-hero">
      <div class="lobby-hero-copy">
        <p class="eyebrow">${gameTypeLabel} · Lobby</p>
        <h2 class="lobby-title">Find a match</h2>
        <p class="lobby-sub">${miniGameDescription(selectedMiniGame)}</p>
      </div>
      <button class="lobby-quick" id="quickMatchBtn" type="button">⚡ Practice vs AI</button>
    </div>

    <div class="lobby-friend">
      <div class="lobby-friend-copy">
        <strong>Play a real friend</strong>
        <span>Peer-to-peer over the room topic — you both play live.</span>
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
  $$('#gameLobby .mini-game-tab').forEach(btn => btn.addEventListener('click', () => {
    selectedMiniGame = btn.dataset.gameType
    renderGameLobby()
  }))
  const invite = $('#inviteFriendBtn')
  if (invite) invite.addEventListener('click', () => hostPeerGame(selectedMiniGame))
  const joinFriend = $('#joinFriendBtn')
  if (joinFriend) joinFriend.addEventListener('click', () => promptJoinPeerGame(selectedMiniGame))
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
      <p class="eyebrow">${escapeHtml(selectedMiniGameTitle())} · Challenge</p>
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
  if (!isPlayableMiniGame(selectedMiniGame)) {
    showToast(`${selectedMiniGameTitle()} is coming soon — picking a winner with commit/reveal is next.`)
    return
  }
  const stake = player.stake || 0
  if (stake > 0 && !debitWallet(stake, `${selectedMiniGameTitle()} stake vs ${player.name}`)) {
    showToast(`Need ${fmtMoney(stake)} to stake — fund your wallet`)
    setView('onboarding')
    return
  }
  if (selectedMiniGame === 'prediction-duel') {
    state.match = { opponent: { name: player.name, team: player.team, record: player.record }, stake, gameType: 'prediction-duel' }
    state.predictionDuel = {
      round: 0,
      score: { you: 0, opp: 0 },
      choices: { you: null, opp: null },
      correct: null,
      revealed: false,
      over: false
    }
    persist()
    showToast(`${joined ? 'Opponent found' : 'Matched'} · ${player.name} — predict the outcome`)
    renderGames()
    return
  }
  if (selectedMiniGame === 'trivia-duel') {
    state.match = { opponent: { name: player.name, team: player.team, record: player.record }, stake, gameType: 'trivia-duel' }
    state.triviaDuel = {
      round: 0,
      score: { you: 0, opp: 0 },
      choices: { you: null, opp: null },
      correct: null,
      revealed: false,
      over: false
    }
    persist()
    showToast(`${joined ? 'Opponent found' : 'Matched'} · ${player.name} — answer fast!`)
    renderGames()
    return
  }
  if (selectedMiniGame === 'free-kick-duel') {
    state.match = { opponent: { name: player.name, team: player.team, record: player.record }, stake, gameType: 'free-kick-duel' }
    state.freeKickDuel = {
      round: 0,
      score: { you: 0, opp: 0 },
      mode: 'shoot',
      busy: false,
      phase: 'aim',
      kickCount: 0,
      lastResult: null,
      over: false
    }
    persist()
    showToast(`${joined ? 'Opponent found' : 'Matched'} · ${player.name} — bend it around the wall!`)
    renderGames()
    return
  }
  if (selectedMiniGame === 'buzzer-beater-duel') {
    state.match = { opponent: { name: player.name, team: player.team, record: player.record }, stake, gameType: 'buzzer-beater-duel' }
    state.buzzerBeaterDuel = {
      round: 0,
      score: { you: 0, opp: 0 },
      mode: 'shoot',
      busy: false,
      phase: 'aim',
      shotCount: 0,
      lastResult: null,
      over: false
    }
    persist()
    showToast(`${joined ? 'Opponent found' : 'Matched'} · ${player.name} — beat the buzzer!`)
    renderGames()
    return
  }
  if (selectedMiniGame === 'ace-serve-duel') {
    state.match = { opponent: { name: player.name, team: player.team, record: player.record }, stake, gameType: 'ace-serve-duel' }
    state.aceServeDuel = {
      round: 0,
      score: { you: 0, opp: 0 },
      mode: 'serve',
      busy: false,
      phase: 'aim',
      serveCount: 0,
      lastResult: null,
      over: false
    }
    persist()
    showToast(`${joined ? 'Opponent found' : 'Matched'} · ${player.name} — serve for aces!`)
    renderGames()
    return
  }
  if (selectedMiniGame === 'home-run-derby') {
    state.match = { opponent: { name: player.name, team: player.team, record: player.record }, stake, gameType: 'home-run-derby' }
    state.homeRunDerby = {
      round: 0,
      score: { you: 0, opp: 0 },
      mode: 'batter',
      busy: false,
      phase: 'aim',
      swingCount: 0,
      lastResult: null,
      over: false
    }
    persist()
    showToast(`${joined ? 'Opponent found' : 'Matched'} · ${player.name} — step up to the plate!`)
    renderGames()
    return
  }
  if (selectedMiniGame === 'reaction-challenge') {
    state.match = { opponent: { name: player.name, team: player.team, record: player.record }, stake, gameType: 'reaction-challenge' }
    if (!joined) startReactionChallengeAI(player)
    persist()
    showToast(`${joined ? 'Opponent found' : 'Matched'} · ${player.name} — fastest tap wins!`)
    renderGames()
    return
  }
  if (isLiveMarketGame(selectedMiniGame)) {
    state.match = { opponent: { name: player.name, team: player.team, record: player.record }, stake, gameType: selectedMiniGame }
    if (!joined) startLiveMarketAI(player, selectedMiniGame)
    persist()
    showToast(`${joined ? 'Opponent found' : 'Matched'} · ${player.name} — ${miniGameTitles[selectedMiniGame] || selectedMiniGame}`)
    renderGames()
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
  if (state.match && state.match.peer) {
    if (state.match.gameType === 'reaction-challenge' && window.ReactionChallenge) window.ReactionChallenge.leave()
    else if (isLiveMarketGame(state.match.gameType) && window.LiveMarketGame) window.LiveMarketGame.leave()
    else if (window.PearCupPeerMatch) window.PearCupPeerMatch.leave()
    return
  }
  clearReactionChallengeAI()
  clearLiveMarketAI()
  state.match = null
  state.reactionChallenge = null
  state.liveMarketGame = null
  state.predictionDuel = null
  state.triviaDuel = null
  state.freeKickDuel = null
  state.buzzerBeaterDuel = null
  state.aceServeDuel = null
  state.homeRunDerby = null
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

function renderPeerPredictionDuel () {
  const PM = window.PearCupPeerMatch && window.PearCupPeerMatch._state
  if (!PM) return
  const title = miniGameTitles['prediction-duel'] || 'Prediction Duel'
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const options = fitPredictionOptions || ['Option A', 'Option B', 'Option C', 'Option D']
  const round = PM.predictionRound + 1
  const picked = PM.predictionChoices.you != null
  const oppPicked = PM.predictionRemoteCommit != null
  const revealed = PM.predictionRevealed.you
  const oppRevealed = PM.predictionRevealed.opp
  const roundResolved = PM.predictionCorrect != null
  const event = PM.predictionEvent
  const eventLabel = event ? `${escapeHtml(event.title)} · ${escapeHtml(event.status)}` : 'Binding event…'
  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title
  const scoreboard = $('#gameScoreboard')
  if (scoreboard) scoreboard.innerHTML = `
    <div class="game-player-card">
      ${avatarSvg(state.username || 'captain', teamById(state.team), true)}
      <div><span>You</span><strong>${escapeHtml(state.username || 'captain')}</strong><em>${teamById(state.team).flag} ${escapeHtml(teamById(state.team).name)}</em></div>
    </div>
    <div class="game-score-core">
      <span class="prediction-round">Round ${Math.min(round, 3)} of 3</span>
      <strong class="prediction-score">${PM.predictionScore.you} — ${PM.predictionScore.opp}</strong>
      <em>${PM.predictionOver ? 'Match over' : eventLabel}</em>
    </div>
    <div class="game-player-card is-away">
      ${avatarSvg(opponent.name, teamById(opponent.team || state.team), true)}
      <div><span>Opponent</span><strong>${escapeHtml(opponent.name)}</strong><em>${teamById(opponent.team || state.team).flag} ${escapeHtml(teamById(opponent.team || state.team).name)}</em></div>
    </div>`
  const stage = $('#penaltyStage')
  if (stage) {
    stage.classList.add('is-placeholder')
    let body = ''
    if (PM.predictionOver) {
      const win = PM.predictionScore.you > PM.predictionScore.opp
      const draw = PM.predictionScore.you === PM.predictionScore.opp
      body = `
        <div class="prediction-result">
          <p class="eyebrow">Final score</p>
          <strong class="prediction-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
          <p class="prediction-result-score">You ${PM.predictionScore.you} — ${PM.predictionScore.opp} ${escapeHtml(opponent.name)}</p>
          <button class="primary-button inline-action" id="predictionBackToLobby" type="button">Back to lobby</button>
        </div>`
    } else if (roundResolved) {
      const localCorrect = PM.predictionChoices.you === PM.predictionCorrect
      const oppCorrect = PM.predictionChoices.opp === PM.predictionCorrect
      body = `
        <div class="prediction-result">
          <p class="eyebrow">Round ${Math.min(round, 3)} result</p>
          <strong class="prediction-result-title">Correct answer: ${escapeHtml(PM.predictionCorrect)}</strong>
          <p class="prediction-result-score">You ${localCorrect ? '+1' : '0'} — ${oppCorrect ? '+1' : '0'} ${escapeHtml(opponent.name)}</p>
          <button class="primary-button inline-action" id="predictionNextRound" type="button">Next round</button>
        </div>`
    } else if (!PM.predictionEventReceived) {
      body = `
        <div class="prediction-waiting">
          <p class="eyebrow">Event binding</p>
          <strong>Locking to live fixture…</strong>
          <p class="live-copy">Waiting for the event snapshot from your opponent.</p>
        </div>`
    } else if (revealed) {
      body = `
        <div class="prediction-waiting">
          <p class="eyebrow">Locked in</p>
          <strong>You picked ${escapeHtml(PM.predictionChoices.you)}</strong>
          <p class="live-copy">Waiting for ${escapeHtml(opponent.name)} to reveal…</p>
        </div>`
    } else if (picked && oppPicked) {
      body = `
        <div class="prediction-reveal">
          <p class="eyebrow">Both locked in</p>
          <strong>Reveal your pick</strong>
          <p class="live-copy">You picked ${escapeHtml(PM.predictionChoices.you)}. Tap reveal when you're ready.</p>
          <button class="primary-button inline-action" id="predictionRevealBtn" type="button">Reveal</button>
        </div>`
    } else {
      body = `
        <div class="prediction-pick">
          <p class="eyebrow">Round ${round} of 3 · ${eventLabel}</p>
          <strong>${picked ? 'Locked in' : 'Pick an outcome'}</strong>
          <p class="live-copy">${picked ? `You picked ${escapeHtml(PM.predictionChoices.you)}. Waiting for ${escapeHtml(opponent.name)}…` : 'Choose one option. Your pick is hidden until both players lock in.'}</p>
          <div class="prediction-grid">
            ${options.map(opt => `
              <button class="prediction-option ${PM.predictionChoices.you === opt ? 'is-picked' : ''}" type="button" data-prediction="${escapeHtml(opt)}" ${picked ? 'disabled' : ''}>
                ${escapeHtml(opt)}
              </button>`).join('')}
          </div>
          ${oppPicked ? '<p class="prediction-status is-ready">Opponent picked</p>' : '<p class="prediction-status">Waiting for opponent…</p>'}
        </div>`
    }
    stage.innerHTML = `<div class="prediction-duel-stage">${body}</div>`
  }
  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true

  // Bind interactions once.
  const grid = stage && stage.querySelector('.prediction-grid')
  if (grid && !grid.dataset.bound) {
    grid.dataset.bound = '1'
    grid.addEventListener('click', event => {
      const btn = event.target.closest('.prediction-option')
      if (!btn || btn.disabled) return
      window.PearCupPeerMatch && window.PearCupPeerMatch.predictionPick(btn.dataset.prediction)
    })
  }
  const revealBtn = $('#predictionRevealBtn')
  if (revealBtn && !revealBtn.dataset.bound) {
    revealBtn.dataset.bound = '1'
    revealBtn.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.predictionReveal())
  }
  const nextBtn = $('#predictionNextRound')
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = '1'
    nextBtn.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.predictionNextRound())
  }
  const backBtn = $('#predictionBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }
}

function predictionDuelEntropy (a, na, b, nb) {
  const s = `${a}|${na}|${b}|${nb}`
  return (window.PearCupPeerNet && window.PearCupPeerNet.digest) ? window.PearCupPeerNet.digest(s) : String(hashString(s))
}

function aiPredictionDuelPick (choice) {
  const pd = state.predictionDuel
  if (!pd || pd.over || pd.choices.you != null) return
  const options = fitPredictionOptions || ['Option A', 'Option B', 'Option C', 'Option D']
  const localNonce = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  const aiChoice = options[Math.floor(Math.random() * options.length)]
  const aiNonce = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  pd.choices.you = choice
  pd.choices.opp = aiChoice
  const entropy = predictionDuelEntropy(choice, localNonce, aiChoice, aiNonce)
  const correctIndex = Math.abs(parseInt(entropy.slice(2), 16)) % options.length
  pd.correct = options[correctIndex]
  if (choice === pd.correct) pd.score.you += 1
  if (aiChoice === pd.correct) pd.score.opp += 1
  pd.revealed = true
  if (pd.round + 1 >= 3) {
    pd.over = true
    const opp = state.match.opponent
    const win = pd.score.you > pd.score.opp
    const draw = pd.score.you === pd.score.opp
    showToast(win ? `You win ${pd.score.you}–${pd.score.opp}!` : draw ? `Draw ${pd.score.you}–${pd.score.opp}` : `${opp.name} wins ${pd.score.opp}–${pd.score.you}`)
  }
  renderGames()
}

function aiPredictionDuelNextRound () {
  const pd = state.predictionDuel
  if (!pd || pd.over) return
  pd.round += 1
  pd.choices = { you: null, opp: null }
  pd.correct = null
  pd.revealed = false
  renderGames()
}

function renderAIPredictionDuel () {
  const pd = state.predictionDuel
  if (!pd) return
  const title = miniGameTitles['prediction-duel'] || 'Prediction Duel'
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const options = fitPredictionOptions || ['Option A', 'Option B', 'Option C', 'Option D']
  const round = pd.round + 1
  const picked = pd.choices.you != null
  const roundResolved = pd.correct != null
  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title
  const scoreboard = $('#gameScoreboard')
  if (scoreboard) scoreboard.innerHTML = `
    <div class="game-player-card">
      ${avatarSvg(state.username || 'captain', teamById(state.team), true)}
      <div><span>You</span><strong>${escapeHtml(state.username || 'captain')}</strong><em>${teamById(state.team).flag} ${escapeHtml(teamById(state.team).name)}</em></div>
    </div>
    <div class="game-score-core">
      <span class="prediction-round">Round ${Math.min(round, 3)} of 3</span>
      <strong class="prediction-score">${pd.score.you} — ${pd.score.opp}</strong>
      <em>${pd.over ? 'Match over' : 'Predict the outcome'}</em>
    </div>
    <div class="game-player-card is-away">
      ${avatarSvg(opponent.name, teamById(opponent.team || state.team), true)}
      <div><span>Opponent</span><strong>${escapeHtml(opponent.name)}</strong><em>${teamById(opponent.team || state.team).flag} ${escapeHtml(teamById(opponent.team || state.team).name)}</em></div>
    </div>`
  const stage = $('#penaltyStage')
  if (stage) {
    stage.classList.add('is-placeholder')
    let body = ''
    if (pd.over) {
      const win = pd.score.you > pd.score.opp
      const draw = pd.score.you === pd.score.opp
      body = `
        <div class="prediction-result">
          <p class="eyebrow">Final score</p>
          <strong class="prediction-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
          <p class="prediction-result-score">You ${pd.score.you} — ${pd.score.opp} ${escapeHtml(opponent.name)}</p>
          <button class="primary-button inline-action" id="predictionAIBackToLobby" type="button">Back to lobby</button>
        </div>`
    } else if (roundResolved) {
      const localCorrect = pd.choices.you === pd.correct
      const oppCorrect = pd.choices.opp === pd.correct
      body = `
        <div class="prediction-result">
          <p class="eyebrow">Round ${Math.min(round, 3)} result</p>
          <strong class="prediction-result-title">Correct answer: ${escapeHtml(pd.correct)}</strong>
          <p class="prediction-result-score">You ${localCorrect ? '+1' : '0'} — ${oppCorrect ? '+1' : '0'} ${escapeHtml(opponent.name)}</p>
          <button class="primary-button inline-action" id="predictionAINextRound" type="button">Next round</button>
        </div>`
    } else {
      body = `
        <div class="prediction-pick">
          <p class="eyebrow">Round ${round} of 3</p>
          <strong>${picked ? 'Locked in' : 'Pick an outcome'}</strong>
          <p class="live-copy">${picked ? `You picked ${escapeHtml(pd.choices.you)}. The AI is deciding…` : 'Choose one option. The AI will lock in a random pick.'}</p>
          <div class="prediction-grid">
            ${options.map(opt => `
              <button class="prediction-option ${pd.choices.you === opt ? 'is-picked' : ''}" type="button" data-prediction="${escapeHtml(opt)}" ${picked ? 'disabled' : ''}>
                ${escapeHtml(opt)}
              </button>`).join('')}
          </div>
        </div>`
    }
    stage.innerHTML = `<div class="prediction-duel-stage">${body}</div>`
  }
  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true

  const grid = stage && stage.querySelector('.prediction-grid')
  if (grid && !grid.dataset.bound) {
    grid.dataset.bound = '1'
    grid.addEventListener('click', event => {
      const btn = event.target.closest('.prediction-option')
      if (!btn || btn.disabled) return
      aiPredictionDuelPick(btn.dataset.prediction)
    })
  }
  const nextBtn = $('#predictionAINextRound')
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = '1'
    nextBtn.addEventListener('click', aiPredictionDuelNextRound)
  }
  const backBtn = $('#predictionAIBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }
}

function renderPeerTriviaDuel () {
  const PM = window.PearCupPeerMatch && window.PearCupPeerMatch._state
  if (!PM) return
  const title = miniGameTitles['trivia-duel'] || 'Trivia Duel'
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const questions = PM.triviaVerifiedBank || fitTriviaQuestions || []
  const q = questions[PM.triviaRound]
  const round = PM.triviaRound + 1
  const picked = PM.triviaAnswers.you != null
  const oppPicked = PM.triviaRemoteCommit != null
  const revealed = PM.triviaRevealed.you
  const oppRevealed = PM.triviaRevealed.opp
  const roundResolved = revealed && oppRevealed
  const correct = q ? q.answer : null
  const options = ['A', 'B', 'C', 'D']
  const bankStatus = PM.triviaBankReceived ? 'Verified bank' : 'Loading question bank…'

  const optionClass = opt => {
    if (roundResolved) {
      if (opt === correct) return 'trivia-option is-correct'
      if (PM.triviaAnswers.you === opt && opt !== correct) return 'trivia-option is-wrong'
      return 'trivia-option'
    }
    if (PM.triviaAnswers.you === opt) return 'trivia-option is-picked'
    return 'trivia-option'
  }

  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title
  const scoreboard = $('#gameScoreboard')
  if (scoreboard) scoreboard.innerHTML = `
    <div class="game-player-card">
      ${avatarSvg(state.username || 'captain', teamById(state.team), true)}
      <div><span>You</span><strong>${escapeHtml(state.username || 'captain')}</strong><em>${teamById(state.team).flag} ${escapeHtml(teamById(state.team).name)}</em></div>
    </div>
    <div class="game-score-core">
      <span class="trivia-round">Round ${Math.min(round, 3)} of 3</span>
      <strong class="trivia-score">${PM.triviaScore.you} — ${PM.triviaScore.opp}</strong>
      <em>${PM.triviaOver ? 'Match over' : bankStatus}</em>
    </div>
    <div class="game-player-card is-away">
      ${avatarSvg(opponent.name, teamById(opponent.team || state.team), true)}
      <div><span>Opponent</span><strong>${escapeHtml(opponent.name)}</strong><em>${teamById(opponent.team || state.team).flag} ${escapeHtml(teamById(opponent.team || state.team).name)}</em></div>
    </div>`

  const stage = $('#penaltyStage')
  if (stage) {
    stage.classList.add('is-placeholder')
    let body = ''
    if (!q) {
      body = `
        <div class="trivia-stage">
          <p class="eyebrow">Trivia</p>
          <strong>No trivia loaded for this fit</strong>
          <p class="live-copy">Check back once the question bank is available.</p>
        </div>`
    } else if (PM.triviaOver) {
      const win = PM.triviaScore.you > PM.triviaScore.opp
      const draw = PM.triviaScore.you === PM.triviaScore.opp
      body = `
        <div class="trivia-result">
          <p class="eyebrow">Final score</p>
          <strong class="trivia-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
          <p class="trivia-result-score">You ${PM.triviaScore.you} — ${PM.triviaScore.opp} ${escapeHtml(opponent.name)}</p>
          <button class="primary-button inline-action" id="triviaBackToLobby" type="button">Back to lobby</button>
        </div>`
    } else if (roundResolved) {
      const localCorrect = PM.triviaAnswers.you === correct
      const oppCorrect = PM.triviaAnswers.opp === correct
      body = `
        <div class="trivia-result">
          <p class="eyebrow">Round ${Math.min(round, 3)} result</p>
          <strong class="trivia-result-title">Correct answer: ${escapeHtml(correct)}</strong>
          <p class="trivia-result-score">You ${localCorrect ? '+1' : '0'} — ${oppCorrect ? '+1' : '0'} ${escapeHtml(opponent.name)}</p>
          <button class="primary-button inline-action" id="triviaNextQuestion" type="button">Next question</button>
        </div>`
    } else if (!PM.triviaBankReceived) {
      body = `
        <div class="trivia-waiting">
          <p class="eyebrow">Verified bank</p>
          <strong>Loading question bank…</strong>
          <p class="live-copy">Waiting for the QVAC-bound answer key from your opponent.</p>
        </div>`
    } else if (revealed) {
      body = `
        <div class="trivia-waiting">
          <p class="eyebrow">Locked in</p>
          <strong>You picked ${escapeHtml(PM.triviaAnswers.you)}</strong>
          <p class="live-copy">Waiting for ${escapeHtml(opponent.name)} to reveal…</p>
        </div>`
    } else if (picked && oppPicked) {
      body = `
        <div class="trivia-reveal">
          <p class="eyebrow">Both locked in</p>
          <strong>Reveal your pick</strong>
          <p class="live-copy">You picked ${escapeHtml(PM.triviaAnswers.you)}. Tap reveal when you're ready.</p>
          <button class="primary-button inline-action" id="triviaRevealBtn" type="button">Reveal</button>
        </div>`
    } else {
      body = `
        <div class="trivia-pick">
          <p class="eyebrow">Round ${round} of 3</p>
          <strong class="trivia-question">${escapeHtml(q.question)}</strong>
          <p class="live-copy">${picked ? `You picked ${escapeHtml(PM.triviaAnswers.you)}. Waiting for ${escapeHtml(opponent.name)}…` : 'Choose A, B, C or D. Your pick is hidden until both players lock in.'}</p>
          <div class="trivia-options">
            ${options.map(opt => `
              <button class="${optionClass(opt)}" type="button" data-choice="${opt}" ${picked || roundResolved ? 'disabled' : ''}>
                ${opt}
              </button>`).join('')}
          </div>
          ${oppPicked ? '<p class="trivia-status is-ready">Opponent picked</p>' : '<p class="trivia-status">Waiting for opponent…</p>'}
        </div>`
    }
    stage.innerHTML = `<div class="trivia-stage">${body}</div>`
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true

  const grid = stage && stage.querySelector('.trivia-options')
  if (grid && !grid.dataset.bound) {
    grid.dataset.bound = '1'
    grid.addEventListener('click', event => {
      const btn = event.target.closest('.trivia-option')
      if (!btn || btn.disabled) return
      window.PearCupPeerMatch && window.PearCupPeerMatch.triviaPick(btn.dataset.choice)
    })
  }
  const revealBtn = $('#triviaRevealBtn')
  if (revealBtn && !revealBtn.dataset.bound) {
    revealBtn.dataset.bound = '1'
    revealBtn.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.triviaReveal())
  }
  const nextBtn = $('#triviaNextQuestion')
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = '1'
    nextBtn.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.triviaNextQuestion())
  }
  const backBtn = $('#triviaBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }
}

function aiTriviaDuelPick (choice) {
  const td = state.triviaDuel
  if (!td || td.over || td.choices.you != null) return
  const questions = fitTriviaQuestions || []
  const q = questions[td.round]
  const options = ['A', 'B', 'C', 'D']
  const aiChoice = options[Math.floor(Math.random() * options.length)]
  td.choices.you = choice
  td.choices.opp = aiChoice
  td.correct = q ? q.answer : options[0]
  if (choice === td.correct) td.score.you += 1
  if (aiChoice === td.correct) td.score.opp += 1
  td.revealed = true
  if (td.round + 1 >= 3) {
    td.over = true
    const opp = state.match.opponent
    const win = td.score.you > td.score.opp
    const draw = td.score.you === td.score.opp
    showToast(win ? `You win ${td.score.you}–${td.score.opp}!` : draw ? `Draw ${td.score.you}–${td.score.opp}` : `${opp.name} wins ${td.score.opp}–${td.score.you}`)
  }
  renderGames()
}

function aiTriviaDuelNextQuestion () {
  const td = state.triviaDuel
  if (!td || td.over) return
  td.round += 1
  td.choices = { you: null, opp: null }
  td.correct = null
  td.revealed = false
  renderGames()
}

function renderAITriviaDuel () {
  const td = state.triviaDuel
  if (!td) return
  const title = miniGameTitles['trivia-duel'] || 'Trivia Duel'
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const questions = fitTriviaQuestions || []
  const q = questions[td.round]
  const round = td.round + 1
  const picked = td.choices.you != null
  const roundResolved = td.revealed
  const correct = td.correct
  const options = ['A', 'B', 'C', 'D']

  const optionClass = opt => {
    if (roundResolved) {
      if (opt === correct) return 'trivia-option is-correct'
      if (td.choices.you === opt && opt !== correct) return 'trivia-option is-wrong'
      return 'trivia-option'
    }
    if (td.choices.you === opt) return 'trivia-option is-picked'
    return 'trivia-option'
  }

  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title
  const scoreboard = $('#gameScoreboard')
  if (scoreboard) scoreboard.innerHTML = `
    <div class="game-player-card">
      ${avatarSvg(state.username || 'captain', teamById(state.team), true)}
      <div><span>You</span><strong>${escapeHtml(state.username || 'captain')}</strong><em>${teamById(state.team).flag} ${escapeHtml(teamById(state.team).name)}</em></div>
    </div>
    <div class="game-score-core">
      <span class="trivia-round">Round ${Math.min(round, 3)} of 3</span>
      <strong class="trivia-score">${td.score.you} — ${td.score.opp}</strong>
      <em>${td.over ? 'Match over' : 'Answer fast'}</em>
    </div>
    <div class="game-player-card is-away">
      ${avatarSvg(opponent.name, teamById(opponent.team || state.team), true)}
      <div><span>Opponent</span><strong>${escapeHtml(opponent.name)}</strong><em>${teamById(opponent.team || state.team).flag} ${escapeHtml(teamById(opponent.team || state.team).name)}</em></div>
    </div>`

  const stage = $('#penaltyStage')
  if (stage) {
    stage.classList.add('is-placeholder')
    let body = ''
    if (!q) {
      body = `
        <div class="trivia-stage">
          <p class="eyebrow">Trivia</p>
          <strong>No trivia loaded for this fit</strong>
          <p class="live-copy">Check back once the question bank is available.</p>
        </div>`
    } else if (td.over) {
      const win = td.score.you > td.score.opp
      const draw = td.score.you === td.score.opp
      body = `
        <div class="trivia-result">
          <p class="eyebrow">Final score</p>
          <strong class="trivia-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
          <p class="trivia-result-score">You ${td.score.you} — ${td.score.opp} ${escapeHtml(opponent.name)}</p>
          <button class="primary-button inline-action" id="triviaAIBackToLobby" type="button">Back to lobby</button>
        </div>`
    } else if (roundResolved) {
      const localCorrect = td.choices.you === correct
      const oppCorrect = td.choices.opp === correct
      body = `
        <div class="trivia-result">
          <p class="eyebrow">Round ${Math.min(round, 3)} result</p>
          <strong class="trivia-result-title">Correct answer: ${escapeHtml(correct)}</strong>
          <p class="trivia-result-score">You ${localCorrect ? '+1' : '0'} — ${oppCorrect ? '+1' : '0'} ${escapeHtml(opponent.name)}</p>
          <button class="primary-button inline-action" id="triviaAINextQuestion" type="button">Next question</button>
        </div>`
    } else {
      body = `
        <div class="trivia-pick">
          <p class="eyebrow">Round ${round} of 3</p>
          <strong class="trivia-question">${escapeHtml(q.question)}</strong>
          <p class="live-copy">${picked ? `You picked ${escapeHtml(td.choices.you)}. The AI is deciding…` : 'Choose A, B, C or D. The AI will lock in a random pick.'}</p>
          <div class="trivia-options">
            ${options.map(opt => `
              <button class="${optionClass(opt)}" type="button" data-choice="${opt}" ${picked ? 'disabled' : ''}>
                ${opt}
              </button>`).join('')}
          </div>
        </div>`
    }
    stage.innerHTML = `<div class="trivia-stage">${body}</div>`
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true

  const grid = stage && stage.querySelector('.trivia-options')
  if (grid && !grid.dataset.bound) {
    grid.dataset.bound = '1'
    grid.addEventListener('click', event => {
      const btn = event.target.closest('.trivia-option')
      if (!btn || btn.disabled) return
      aiTriviaDuelPick(btn.dataset.choice)
    })
  }
  const nextBtn = $('#triviaAINextQuestion')
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = '1'
    nextBtn.addEventListener('click', aiTriviaDuelNextQuestion)
  }
  const backBtn = $('#triviaAIBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }
}

function renderPeerFreeKickDuel () {
  const PM = window.PearCupPeerMatch && window.PearCupPeerMatch._state
  if (!PM) return
  const title = miniGameTitles['free-kick-duel'] || 'Free-kick Duel'
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const round = PM.fkRound + 1
  const iShoot = iAmShooterPeer()
  const committed = PM.fkCommit != null
  const remoteCommitted = PM.fkRemoteCommit != null
  const revealed = PM.fkRevealed.you
  const remoteRevealed = PM.fkRevealed.opp
  const bothRevealed = revealed && remoteRevealed
  const resolved = PM.fkResolved

  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title

  const me = { name: PM.self.name, team: PM.self.team }
  const opp = { name: PM.opp.name, team: PM.opp.team }
  const shooterP = iShoot ? me : opp
  const keeperP = iShoot ? opp : me
  const sTeam = teamById(shooterP.team)
  const kTeam = teamById(keeperP.team)

  const scoreboard = $('#gameScoreboard')
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="game-player-card">
        ${avatarSvg(shooterP.name, sTeam, true)}
        <div><span>Shooter</span><strong>${escapeHtml(shooterP.name)}</strong><em>${sTeam.flag} ${escapeHtml(sTeam.name)}</em></div>
      </div>
      <div class="game-score-core">
        <span class="fk-round">Round ${Math.min(round, 3)} of 3</span>
        <strong class="fk-score">${PM.fkScore.you} — ${PM.fkScore.opp}</strong>
        <em>${PM.fkOver ? 'Match over' : (iShoot ? 'Your shot' : `${escapeHtml(opp.name)} shoots`)}</em>
      </div>
      <div class="game-player-card is-away">
        ${avatarSvg(keeperP.name, kTeam, true)}
        <div><span>Keeper</span><strong>${escapeHtml(keeperP.name)}</strong><em>${kTeam.flag} ${escapeHtml(kTeam.name)}</em></div>
      </div>`
  }

  const stage = $('#penaltyStage')
  if (!stage) return
  stage.classList.remove('is-placeholder')
  stage.hidden = false

  // Re-use the existing pitch actors.
  const shooterEl = $('#gameShooter')
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  if (shooterEl) { shooterEl.innerHTML = avatarSvg(shooterP.name, sTeam); shooterEl.style.left = '50%'; shooterEl.classList.remove('lean-left', 'lean-right', 'lean-center') }
  if (keeperEl) { keeperEl.innerHTML = avatarSvg(keeperP.name, kTeam); keeperEl.style.left = '50%'; keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid') }
  if (ballEl) { ballEl.classList.remove('is-kicking', 'fk-curved-left', 'fk-curved-right'); ballEl.style.left = '50%'; ballEl.style.top = '80%'; ballEl.style.transform = '' }

  // Hide the default penalty controls; the free-kick UI is rendered inside the stage.
  const aimGrid = $('#aimGrid')
  const powerDock = $('#powerDock')
  if (aimGrid) aimGrid.hidden = true
  if (powerDock) powerDock.hidden = true

  // Build the stage UI.
  let body = ''
  if (PM.fkOver) {
    const win = PM.fkScore.you > PM.fkScore.opp
    const draw = PM.fkScore.you === PM.fkScore.opp
    body = `
      <div class="fk-result">
        <p class="eyebrow">Final score</p>
        <strong class="fk-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
        <p class="fk-result-score">You ${PM.fkScore.you} — ${PM.fkScore.opp} ${escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="fkPeerBackToLobby" type="button">Back to lobby</button>
      </div>`
  } else if (bothRevealed && resolved) {
    const label = resolved.goal ? 'GOAL!' : resolved.wallBlocks ? 'BLOCKED BY THE WALL!' : resolved.saved ? 'SAVED!' : 'WIDE!'
    const good = iShoot ? resolved.goal : !resolved.goal
    body = `
      <div class="fk-result">
        <p class="eyebrow">Round ${Math.min(round, 3)} result</p>
        <strong class="fk-result-title ${good ? 'is-goal' : 'is-stop'}">${label}</strong>
        <p class="fk-result-score">${resolved.goal ? '+3' : resolved.onFrame && !resolved.wallBlocks ? '+1' : '+0'} ${iShoot ? 'you' : escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="fkPeerNextRound" type="button">Next kick</button>
      </div>`
    animateFreeKick(resolved.aim, resolved.dive, resolved.power, resolved.curve, resolved.wall)
  } else if (revealed && !remoteRevealed) {
    body = `
      <div class="fk-waiting">
        <p class="eyebrow">Locked in</p>
        <strong>${iShoot ? 'Struck!' : 'Dive called!'}</strong>
        <p class="live-copy">Waiting for ${escapeHtml(opponent.name)} to reveal…</p>
      </div>`
  } else if (committed && remoteCommitted && !revealed) {
    body = `
      <div class="fk-reveal">
        <p class="eyebrow">Both locked in</p>
        <strong>Reveal your ${iShoot ? 'shot' : 'dive'}</strong>
        <p class="live-copy">The wall and keeper are set — reveal when you're ready.</p>
        <button class="primary-button inline-action" id="fkPeerRevealBtn" type="button">Reveal</button>
      </div>`
  } else if (iShoot) {
    if (!committed) {
      body = `
        <div class="fk-shoot">
          <p class="eyebrow">Round ${round} · Your shot</p>
          <strong>Pick a corner, set power, bend it</strong>
          <div class="fk-aim-grid" id="fkPeerAimGrid" aria-label="Pick where to shoot">
            ${AIM_ZONES.map(zone => `<button class="aim-zone ${state.fkPeerAim === zone ? 'is-selected' : ''}" type="button" data-zone="${zone}" aria-label="Aim ${zone.replace('-', ' ')}"><span></span></button>`).join('')}
          </div>
          <div class="fk-power-wrap">
            <span class="fk-power-label">Power — sweet spot keeps it on frame</span>
            <div class="power-track" id="fkPeerPowerTrack"><i class="power-fill is-live" id="fkPeerPowerFill"></i><b class="power-sweet"></b></div>
          </div>
          <div class="curve-selector" id="fkPeerCurve" role="group" aria-label="Curve">
            <button class="secondary-button compact-action ${state.fkPeerCurve === -1 ? 'is-active' : ''}" type="button" data-curve="-1">Curve left</button>
            <button class="secondary-button compact-action ${state.fkPeerCurve === 0 ? 'is-active' : ''}" type="button" data-curve="0">Straight</button>
            <button class="secondary-button compact-action ${state.fkPeerCurve === 1 ? 'is-active' : ''}" type="button" data-curve="1">Curve right</button>
          </div>
          <button class="primary-button inline-action" id="fkPeerShootBtn" type="button">Shoot</button>
        </div>`
    } else {
      body = `
        <div class="fk-waiting">
          <p class="eyebrow">Committed</p>
          <strong>Shot locked in</strong>
          <p class="live-copy">Waiting for ${escapeHtml(opponent.name)} to set wall &amp; dive…</p>
        </div>`
    }
  } else {
    if (remoteCommitted && !committed) {
      body = `
        <div class="fk-keep">
          <p class="eyebrow">Round ${round} · You're the keeper</p>
          <strong>Pick your dive and wall position</strong>
          <div class="fk-aim-grid" id="fkPeerDiveGrid" aria-label="Pick your dive">
            ${AIM_ZONES.map(zone => `<button class="aim-zone ${state.fkPeerDive === zone ? 'is-selected' : ''}" type="button" data-zone="${zone}" aria-label="Dive ${zone.replace('-', ' ')}"><span></span></button>`).join('')}
          </div>
          <div class="wall-selector" id="fkPeerWall" role="group" aria-label="Wall position">
            <button class="secondary-button compact-action ${state.fkPeerWall === 'left' ? 'is-active' : ''}" type="button" data-wall="left">Wall left</button>
            <button class="secondary-button compact-action ${state.fkPeerWall === 'center' ? 'is-active' : ''}" type="button" data-wall="center">Wall center</button>
            <button class="secondary-button compact-action ${state.fkPeerWall === 'right' ? 'is-active' : ''}" type="button" data-wall="right">Wall right</button>
          </div>
          <button class="primary-button inline-action" id="fkPeerDiveBtn" type="button">Dive</button>
        </div>`
    } else {
      body = `
        <div class="fk-waiting">
          <p class="eyebrow">Get ready</p>
          <strong>${escapeHtml(opponent.name)} is lining up…</strong>
          <p class="live-copy">Wait for the strike, then pick your wall and dive.</p>
        </div>`
    }
  }

  // Only replace the injected panel, not the whole stage, so the ball/keeper elements stay in place.
  let panel = stage.querySelector('.fk-panel')
  if (!panel) {
    panel = document.createElement('div')
    panel.className = 'fk-panel'
    stage.appendChild(panel)
  }
  panel.innerHTML = body

  // Bind interactions.
  const aimGridEl = $('#fkPeerAimGrid')
  if (aimGridEl && !aimGridEl.dataset.bound) {
    aimGridEl.dataset.bound = '1'
    aimGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.aim-zone')
      if (!btn) return
      state.fkPeerAim = btn.dataset.zone
      renderPeerFreeKickDuel()
    })
  }
  const diveGridEl = $('#fkPeerDiveGrid')
  if (diveGridEl && !diveGridEl.dataset.bound) {
    diveGridEl.dataset.bound = '1'
    diveGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.aim-zone')
      if (!btn) return
      state.fkPeerDive = btn.dataset.zone
      renderPeerFreeKickDuel()
    })
  }
  const curveEl = $('#fkPeerCurve')
  if (curveEl && !curveEl.dataset.bound) {
    curveEl.dataset.bound = '1'
    curveEl.addEventListener('click', event => {
      const btn = event.target.closest('[data-curve]')
      if (!btn) return
      state.fkPeerCurve = Number(btn.dataset.curve)
      renderPeerFreeKickDuel()
    })
  }
  const wallEl = $('#fkPeerWall')
  if (wallEl && !wallEl.dataset.bound) {
    wallEl.dataset.bound = '1'
    wallEl.addEventListener('click', event => {
      const btn = event.target.closest('[data-wall]')
      if (!btn) return
      state.fkPeerWall = btn.dataset.wall
      renderPeerFreeKickDuel()
    })
  }
  const shootBtn = $('#fkPeerShootBtn')
  if (shootBtn && !shootBtn.dataset.bound) {
    shootBtn.dataset.bound = '1'
    shootBtn.addEventListener('click', () => {
      const aim = state.fkPeerAim || 'center-high'
      const power = readFkPowerPct('fkPeerPowerFill', 'fkPeerPowerTrack')
      const curve = state.fkPeerCurve != null ? state.fkPeerCurve : 0
      window.PearCupPeerMatch && window.PearCupPeerMatch.freeKickPick(aim, power, curve)
    })
  }
  const diveBtn = $('#fkPeerDiveBtn')
  if (diveBtn && !diveBtn.dataset.bound) {
    diveBtn.dataset.bound = '1'
    diveBtn.addEventListener('click', () => {
      const dive = state.fkPeerDive || 'center-high'
      const wall = state.fkPeerWall || 'center'
      window.PearCupPeerMatch && window.PearCupPeerMatch.freeKickDive(dive, wall)
    })
  }
  const revealBtn = $('#fkPeerRevealBtn')
  if (revealBtn && !revealBtn.dataset.bound) {
    revealBtn.dataset.bound = '1'
    revealBtn.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.freeKickReveal())
  }
  const nextBtn = $('#fkPeerNextRound')
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = '1'
    nextBtn.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.freeKickNextRound())
  }
  const backBtn = $('#fkPeerBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true
  const actions = $('#games .game-actions')
  if (actions) actions.hidden = true
}

function iAmShooterPeer () {
  const PM = window.PearCupPeerMatch && window.PearCupPeerMatch._state
  if (!PM) return true
  return (PM.kIndex % 2 === 0 ? 'A' : 'B') === PM.role
}

function readFkPowerPct (fillId, trackId) {
  const fill = $(`#${fillId}`)
  const track = $(`#${trackId}`)
  if (!fill || !track) return 60
  const w = fill.getBoundingClientRect().width
  const t = track.getBoundingClientRect().width || 1
  return Math.max(4, Math.min(100, Math.round((w / t) * 100)))
}

function animateFreeKick (aim, dive, power, curve, wall) {
  const stage = $('#penaltyStage')
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  if (!stage || !ballEl) return
  const aimPos = zonePosition(aim)
  const divePos = zonePosition(dive)
  if (keeperEl) {
    keeperEl.style.left = `${divePos.x}%`
    keeperEl.classList.add(divePos.x < 50 ? 'dive-left' : divePos.x > 50 ? 'dive-right' : 'dive-mid')
  }
  const onFrame = aim !== 'wall' && aim !== 'wide' && power >= 30 && power <= 95
  const wallBlocks = wall && wall === aimZoneToWallApp(aim) && Math.abs(curve) < 3
  const saved = dive === aim && Math.abs(curve) < 7
  const goal = onFrame && !wallBlocks && !saved
  let bx = aimPos.x
  let by = aimPos.y
  if (!goal) {
    if (!onFrame) by = overBarY()
    else if (wallBlocks) { bx = 50; by = 55 }
    else if (saved) { bx = divePos.x; by = Math.min(aimPos.y, divePos.y) }
  }
  ballEl.classList.add('is-kicking')
  if (curve < 0) ballEl.classList.add('fk-curved-left')
  if (curve > 0) ballEl.classList.add('fk-curved-right')
  requestAnimationFrame(() => {
    ballEl.style.left = `${bx}%`
    ballEl.style.top = `${by}%`
  })
}

function aimZoneToWallApp (aim) {
  if (!aim) return 'center'
  if (aim.indexOf('left') !== -1) return 'left'
  if (aim.indexOf('right') !== -1) return 'right'
  return 'center'
}

function resolveAIFreeKick (aim, dive, power, curve, wall) {
  const fkd = state.freeKickDuel
  if (!fkd) return null
  const onFrame = aim !== 'wall' && aim !== 'wide' && power >= 30 && power <= 95
  const wallBlocks = wall && wall === aimZoneToWallApp(aim) && Math.abs(curve) < 3
  const saved = dive === aim && Math.abs(curve) < 7
  const goal = onFrame && !wallBlocks && !saved
  let points = 0
  if (goal) points = 3
  else if (onFrame && !wallBlocks) points = 1
  const shooter = fkd.mode === 'shoot'
  if (shooter) fkd.score.you += points
  else fkd.score.opp += points
  fkd.kickCount += 1
  fkd.lastResult = { aim, dive, power, curve, wall, onFrame, wallBlocks, saved, goal, points }
  fkd.phase = 'result'
  if (fkd.kickCount >= 6) {
    fkd.over = true
    const opp = state.match.opponent
    const win = fkd.score.you > fkd.score.opp
    const draw = fkd.score.you === fkd.score.opp
    showToast(win ? `You win ${fkd.score.you}–${fkd.score.opp}!` : draw ? `Draw ${fkd.score.you}–${fkd.score.opp}` : `${opp.name} wins ${fkd.score.opp}–${fkd.score.you}`)
  }
  return fkd.lastResult
}

function aiFreeKickKeeperPick (aim) {
  const pick = currentOpponent()
  const diff = opponentDifficulty(pick)
  const wallOptions = ['left', 'center', 'right']
  const wall = wallOptions[Math.floor(Math.random() * wallOptions.length)]
  const dive = aiKeeperDive(aim, diff)
  return { dive, wall }
}

function aiFreeKickShooterPick () {
  const pick = currentOpponent()
  const diff = opponentDifficulty(pick)
  const aim = AIM_ZONES[Math.floor(Math.random() * AIM_ZONES.length)]
  const power = Math.round(45 + diff * 45)
  const curveOptions = [-1, 0, 1]
  const curve = curveOptions[Math.floor(Math.random() * curveOptions.length)]
  return { aim, power, curve }
}

function animateBuzzerBeater (aim, defenderRead, power) {
  const stage = $('#penaltyStage')
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  if (!stage || !ballEl) return
  const aimPos = zonePosition(aim)
  const defenderPos = zonePosition(defenderRead)
  if (keeperEl) {
    keeperEl.style.left = `${defenderPos.x}%`
    keeperEl.classList.add(defenderPos.x < 50 ? 'dive-left' : defenderPos.x > 50 ? 'dive-right' : 'dive-mid')
  }
  const onTarget = aim !== 'miss' && power >= 35 && power <= 95
  const blocked = defenderRead === aim
  const basket = onTarget && !blocked
  let bx = aimPos.x
  let by = aimPos.y
  if (!basket) {
    if (!onTarget) by = overBarY()
    else if (blocked) { bx = defenderPos.x; by = Math.min(aimPos.y, defenderPos.y) }
  }
  ballEl.classList.add('is-kicking')
  ballEl.classList.add('bb-shot')
  requestAnimationFrame(() => {
    ballEl.style.left = `${bx}%`
    ballEl.style.top = `${by}%`
  })
}

function resolveAIBuzzerBeater (aim, defenderRead, power) {
  const bbd = state.buzzerBeaterDuel
  if (!bbd) return null
  const onTarget = aim !== 'miss' && power >= 35 && power <= 95
  const blocked = defenderRead === aim
  const basket = onTarget && !blocked
  let points = 0
  if (basket) points = 2
  else if (onTarget) points = 1
  const shooter = bbd.mode === 'shoot'
  if (shooter) bbd.score.you += points
  else bbd.score.opp += points
  bbd.shotCount += 1
  bbd.lastResult = { aim, defenderRead, power, onTarget, blocked, basket, points }
  bbd.phase = 'result'
  if (bbd.shotCount >= 6) {
    bbd.over = true
    const opp = state.match.opponent
    const win = bbd.score.you > bbd.score.opp
    const draw = bbd.score.you === bbd.score.opp
    showToast(win ? `You win ${bbd.score.you}–${bbd.score.opp}!` : draw ? `Draw ${bbd.score.you}–${bbd.score.opp}` : `${opp.name} wins ${bbd.score.opp}–${bbd.score.you}`)
  }
  return bbd.lastResult
}

function aiBuzzerDefenderPick (aim) {
  const pick = currentOpponent()
  const diff = opponentDifficulty(pick)
  if (Math.random() < diff) return { defenderRead: aim }
  const options = BB_ZONES.filter(zone => zone !== aim)
  return { defenderRead: options[Math.floor(Math.random() * options.length)] }
}

function aiBuzzerShooterPick () {
  const pick = currentOpponent()
  const diff = opponentDifficulty(pick)
  const aim = BB_ZONES[Math.floor(Math.random() * BB_ZONES.length)]
  const power = Math.round(45 + diff * 45)
  return { aim, power }
}

function resolveAIAceServe (placement, returnerRead, power, spin) {
  const asd = state.aceServeDuel
  if (!asd) return null
  const inBounds = placement !== 'fault' && power >= 40 && power <= 100
  const ace = inBounds && placement !== returnerRead && Math.abs(spin) >= 1 && power >= 60
  let points = 0
  if (ace) points = 2
  else if (inBounds) points = 1
  const server = asd.mode === 'serve'
  if (server) asd.score.you += points
  else asd.score.opp += points
  asd.serveCount += 1
  asd.lastResult = { placement, returnerRead, power, spin, inBounds, ace, points }
  asd.phase = 'result'
  if (asd.serveCount >= 6) {
    asd.over = true
    const opp = state.match.opponent
    const win = asd.score.you > asd.score.opp
    const draw = asd.score.you === asd.score.opp
    showToast(win ? `You win ${asd.score.you}–${asd.score.opp}!` : draw ? `Draw ${asd.score.you}–${asd.score.opp}` : `${opp.name} wins ${asd.score.opp}–${asd.score.you}`)
  }
  return asd.lastResult
}

function aiAceReturnerPick (placement) {
  const pick = currentOpponent()
  const diff = opponentDifficulty(pick)
  if (Math.random() < diff) return { returnerRead: placement }
  const options = AS_ZONES.filter(zone => zone !== 'fault' && zone !== placement)
  return { returnerRead: options[Math.floor(Math.random() * options.length)] }
}

function aiAceServerPick () {
  const pick = currentOpponent()
  const diff = opponentDifficulty(pick)
  const placement = AS_ZONES[Math.floor(Math.random() * AS_ZONES.length)]
  const power = Math.round(55 + diff * 40)
  const spinOptions = [-1, 0, 1]
  const spin = spinOptions[Math.floor(Math.random() * spinOptions.length)]
  return { placement, power, spin }
}

function animateAceServe (placement, returnerRead, power, spin) {
  const stage = $('#penaltyStage')
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  if (!stage || !ballEl) return
  const servePos = aceZonePosition(placement)
  const returnerPos = aceZonePosition(returnerRead)
  if (keeperEl) {
    keeperEl.style.left = `${returnerPos.x}%`
    keeperEl.classList.add(returnerPos.x < 50 ? 'dive-left' : returnerPos.x > 50 ? 'dive-right' : 'dive-mid')
  }
  const inBounds = placement !== 'fault' && power >= 40 && power <= 100
  const ace = inBounds && placement !== returnerRead && Math.abs(spin) >= 1 && power >= 60
  let bx = servePos.x
  let by = servePos.y
  if (!inBounds) {
    bx = servePos.x
    by = 92
  } else if (!ace) {
    bx = returnerPos.x
    by = Math.min(servePos.y, returnerPos.y)
  }
  ballEl.classList.add('is-kicking')
  ballEl.classList.add('as-serve')
  requestAnimationFrame(() => {
    ballEl.style.left = `${bx}%`
    ballEl.style.top = `${by}%`
  })
}

function renderAIFreeKickDuel () {
  const fkd = state.freeKickDuel
  if (!fkd) return
  const title = miniGameTitles['free-kick-duel'] || 'Free-kick Duel'
  const opponent = (state.match && state.match.opponent) || { name: 'Rival' }
  const round = fkd.round + 1
  const iShoot = fkd.mode === 'shoot'
  const resolved = fkd.lastResult
  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title

  const you = { name: state.username || 'captain', team: state.team }
  const opp = { name: opponent.name, team: opponent.team }
  const shooterP = iShoot ? you : opp
  const keeperP = iShoot ? opp : you
  const sTeam = teamById(shooterP.team)
  const kTeam = teamById(keeperP.team)

  const scoreboard = $('#gameScoreboard')
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="game-player-card">
        ${avatarSvg(shooterP.name, sTeam, true)}
        <div><span>Shooter</span><strong>${escapeHtml(shooterP.name)}</strong><em>${sTeam.flag} ${escapeHtml(sTeam.name)}</em></div>
      </div>
      <div class="game-score-core">
        <span class="fk-round">Round ${Math.min(round, 3)} of 3</span>
        <strong class="fk-score">${fkd.score.you} — ${fkd.score.opp}</strong>
        <em>${fkd.over ? 'Match over' : (iShoot ? 'Your shot' : `${escapeHtml(opponent.name)} shoots`)}</em>
      </div>
      <div class="game-player-card is-away">
        ${avatarSvg(keeperP.name, kTeam, true)}
        <div><span>Keeper</span><strong>${escapeHtml(keeperP.name)}</strong><em>${kTeam.flag} ${escapeHtml(kTeam.name)}</em></div>
      </div>`
  }

  const stage = $('#penaltyStage')
  if (!stage) return
  stage.classList.remove('is-placeholder')
  stage.hidden = false

  const shooterEl = $('#gameShooter')
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  if (shooterEl) { shooterEl.innerHTML = avatarSvg(shooterP.name, sTeam); shooterEl.style.left = '50%'; shooterEl.classList.remove('lean-left', 'lean-right', 'lean-center') }
  if (keeperEl) { keeperEl.innerHTML = avatarSvg(keeperP.name, kTeam); keeperEl.style.left = '50%'; keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid') }
  if (ballEl) { ballEl.classList.remove('is-kicking', 'fk-curved-left', 'fk-curved-right'); ballEl.style.left = '50%'; ballEl.style.top = '80%'; ballEl.style.transform = '' }

  const aimGrid = $('#aimGrid')
  const powerDock = $('#powerDock')
  if (aimGrid) aimGrid.hidden = true
  if (powerDock) powerDock.hidden = true

  let body = ''
  if (fkd.over) {
    const win = fkd.score.you > fkd.score.opp
    const draw = fkd.score.you === fkd.score.opp
    body = `
      <div class="fk-result">
        <p class="eyebrow">Final score</p>
        <strong class="fk-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
        <p class="fk-result-score">You ${fkd.score.you} — ${fkd.score.opp} ${escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="fkAIBackToLobby" type="button">Back to lobby</button>
      </div>`
  } else if (fkd.phase === 'result' && resolved) {
    const label = resolved.goal ? 'GOAL!' : resolved.wallBlocks ? 'BLOCKED BY THE WALL!' : resolved.saved ? 'SAVED!' : 'WIDE!'
    const good = iShoot ? resolved.goal : !resolved.goal
    body = `
      <div class="fk-result">
        <p class="eyebrow">Round ${Math.min(round, 3)} result</p>
        <strong class="fk-result-title ${good ? 'is-goal' : 'is-stop'}">${label}</strong>
        <p class="fk-result-score">${resolved.goal ? '+3' : resolved.onFrame && !resolved.wallBlocks ? '+1' : '+0'} ${iShoot ? 'you' : escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="fkAINextRound" type="button">Next kick</button>
      </div>`
    animateFreeKick(resolved.aim, resolved.dive, resolved.power, resolved.curve, resolved.wall)
  } else if (iShoot) {
    body = `
      <div class="fk-shoot">
        <p class="eyebrow">Round ${round} · Your shot</p>
        <strong>Pick a corner, set power, bend it</strong>
        <div class="fk-aim-grid" id="fkAIAimGrid" aria-label="Pick where to shoot">
          ${AIM_ZONES.map(zone => `<button class="aim-zone ${state.fkAIAim === zone ? 'is-selected' : ''}" type="button" data-zone="${zone}" aria-label="Aim ${zone.replace('-', ' ')}"><span></span></button>`).join('')}
        </div>
        <div class="fk-power-wrap">
          <span class="fk-power-label">Power — sweet spot keeps it on frame</span>
          <div class="power-track" id="fkAIPowerTrack"><i class="power-fill is-live" id="fkAIPowerFill"></i><b class="power-sweet"></b></div>
        </div>
        <div class="curve-selector" id="fkAICurve" role="group" aria-label="Curve">
          <button class="secondary-button compact-action ${state.fkAICurve === -1 ? 'is-active' : ''}" type="button" data-curve="-1">Curve left</button>
          <button class="secondary-button compact-action ${state.fkAICurve === 0 ? 'is-active' : ''}" type="button" data-curve="0">Straight</button>
          <button class="secondary-button compact-action ${state.fkAICurve === 1 ? 'is-active' : ''}" type="button" data-curve="1">Curve right</button>
        </div>
        <button class="primary-button inline-action" id="fkAIShootBtn" type="button">Shoot</button>
      </div>`
  } else {
    body = `
      <div class="fk-keep">
        <p class="eyebrow">Round ${round} · You're the keeper</p>
        <strong>Pick your dive and wall position</strong>
        <div class="fk-aim-grid" id="fkAIDiveGrid" aria-label="Pick your dive">
          ${AIM_ZONES.map(zone => `<button class="aim-zone ${state.fkAIDive === zone ? 'is-selected' : ''}" type="button" data-zone="${zone}" aria-label="Dive ${zone.replace('-', ' ')}"><span></span></button>`).join('')}
        </div>
        <div class="wall-selector" id="fkAIWall" role="group" aria-label="Wall position">
          <button class="secondary-button compact-action ${state.fkAIWall === 'left' ? 'is-active' : ''}" type="button" data-wall="left">Wall left</button>
          <button class="secondary-button compact-action ${state.fkAIWall === 'center' ? 'is-active' : ''}" type="button" data-wall="center">Wall center</button>
          <button class="secondary-button compact-action ${state.fkAIWall === 'right' ? 'is-active' : ''}" type="button" data-wall="right">Wall right</button>
        </div>
        <button class="primary-button inline-action" id="fkAIDiveBtn" type="button">Dive</button>
      </div>`
  }

  let panel = stage.querySelector('.fk-panel')
  if (!panel) {
    panel = document.createElement('div')
    panel.className = 'fk-panel'
    stage.appendChild(panel)
  }
  panel.innerHTML = body

  const aimGridEl = $('#fkAIAimGrid')
  if (aimGridEl && !aimGridEl.dataset.bound) {
    aimGridEl.dataset.bound = '1'
    aimGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.aim-zone')
      if (!btn) return
      state.fkAIAim = btn.dataset.zone
      renderAIFreeKickDuel()
    })
  }
  const diveGridEl = $('#fkAIDiveGrid')
  if (diveGridEl && !diveGridEl.dataset.bound) {
    diveGridEl.dataset.bound = '1'
    diveGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.aim-zone')
      if (!btn) return
      state.fkAIDive = btn.dataset.zone
      renderAIFreeKickDuel()
    })
  }
  const curveEl = $('#fkAICurve')
  if (curveEl && !curveEl.dataset.bound) {
    curveEl.dataset.bound = '1'
    curveEl.addEventListener('click', event => {
      const btn = event.target.closest('[data-curve]')
      if (!btn) return
      state.fkAICurve = Number(btn.dataset.curve)
      renderAIFreeKickDuel()
    })
  }
  const wallEl = $('#fkAIWall')
  if (wallEl && !wallEl.dataset.bound) {
    wallEl.dataset.bound = '1'
    wallEl.addEventListener('click', event => {
      const btn = event.target.closest('[data-wall]')
      if (!btn) return
      state.fkAIWall = btn.dataset.wall
      renderAIFreeKickDuel()
    })
  }
  const shootBtn = $('#fkAIShootBtn')
  if (shootBtn && !shootBtn.dataset.bound) {
    shootBtn.dataset.bound = '1'
    shootBtn.addEventListener('click', () => {
      if (fkd.busy || fkd.phase !== 'aim') return
      fkd.busy = true
      const aim = state.fkAIAim || 'center-high'
      const power = readFkPowerPct('fkAIPowerFill', 'fkAIPowerTrack')
      const curve = state.fkAICurve != null ? state.fkAICurve : 0
      const { dive, wall } = aiFreeKickKeeperPick(aim)
      resolveAIFreeKick(aim, dive, power, curve, wall)
      renderAIFreeKickDuel()
    })
  }
  const diveBtn = $('#fkAIDiveBtn')
  if (diveBtn && !diveBtn.dataset.bound) {
    diveBtn.dataset.bound = '1'
    diveBtn.addEventListener('click', () => {
      if (fkd.busy || fkd.phase !== 'aim') return
      fkd.busy = true
      const { aim, power, curve } = aiFreeKickShooterPick()
      const dive = state.fkAIDive || 'center-high'
      const wall = state.fkAIWall || 'center'
      resolveAIFreeKick(aim, dive, power, curve, wall)
      renderAIFreeKickDuel()
    })
  }
  const nextBtn = $('#fkAINextRound')
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = '1'
    nextBtn.addEventListener('click', () => {
      if (fkd.over) return
      fkd.mode = fkd.mode === 'shoot' ? 'keep' : 'shoot'
      if (fkd.mode === 'shoot') fkd.round += 1
      fkd.phase = 'aim'
      fkd.lastResult = null
      fkd.busy = false
      state.fkAIAim = null
      state.fkAICurve = 0
      state.fkAIDive = null
      state.fkAIWall = 'center'
      renderAIFreeKickDuel()
    })
  }
  const backBtn = $('#fkAIBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true
  const actions = $('#games .game-actions')
  if (actions) actions.hidden = true
}

function renderPeerBuzzerBeaterDuel () {
  const PM = window.PearCupPeerMatch && window.PearCupPeerMatch._state
  if (!PM) return
  const title = miniGameTitles['buzzer-beater-duel'] || 'Buzzer Beater Duel'
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const round = PM.bbRound + 1
  const iShoot = iAmShooterPeer()
  const committed = PM.bbCommit != null
  const remoteCommitted = PM.bbRemoteCommit != null
  const revealed = PM.bbRevealed.you
  const remoteRevealed = PM.bbRevealed.opp
  const bothRevealed = revealed && remoteRevealed
  const resolved = PM.bbResolved

  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title

  const me = { name: PM.self.name, team: PM.self.team }
  const opp = { name: PM.opp.name, team: PM.opp.team }
  const shooterP = iShoot ? me : opp
  const defenderP = iShoot ? opp : me
  const sTeam = teamById(shooterP.team)
  const dTeam = teamById(defenderP.team)

  const scoreboard = $('#gameScoreboard')
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="game-player-card">
        ${avatarSvg(shooterP.name, sTeam, true)}
        <div><span>Shooter</span><strong>${escapeHtml(shooterP.name)}</strong><em>${sTeam.flag} ${escapeHtml(sTeam.name)}</em></div>
      </div>
      <div class="game-score-core">
        <span class="bb-round">Round ${Math.min(round, 3)} of 3</span>
        <strong class="bb-score">${PM.bbScore.you} — ${PM.bbScore.opp}</strong>
        <em>${PM.bbOver ? 'Match over' : (iShoot ? 'Your shot' : `${escapeHtml(opp.name)} shoots`)}</em>
      </div>
      <div class="game-player-card is-away">
        ${avatarSvg(defenderP.name, dTeam, true)}
        <div><span>Defender</span><strong>${escapeHtml(defenderP.name)}</strong><em>${dTeam.flag} ${escapeHtml(dTeam.name)}</em></div>
      </div>`
  }

  const stage = $('#penaltyStage')
  if (!stage) return
  stage.classList.remove('is-placeholder')
  stage.hidden = false

  const shooterEl = $('#gameShooter')
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  if (shooterEl) { shooterEl.innerHTML = avatarSvg(shooterP.name, sTeam); shooterEl.style.left = '50%'; shooterEl.classList.remove('lean-left', 'lean-right', 'lean-center') }
  if (keeperEl) { keeperEl.innerHTML = avatarSvg(defenderP.name, dTeam); keeperEl.style.left = '50%'; keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid') }
  if (ballEl) { ballEl.classList.remove('is-kicking', 'bb-shot'); ballEl.style.left = '50%'; ballEl.style.top = '80%'; ballEl.style.transform = '' }

  const aimGrid = $('#aimGrid')
  const powerDock = $('#powerDock')
  if (aimGrid) aimGrid.hidden = true
  if (powerDock) powerDock.hidden = true

  let body = ''
  if (PM.bbOver) {
    const win = PM.bbScore.you > PM.bbScore.opp
    const draw = PM.bbScore.you === PM.bbScore.opp
    body = `
      <div class="bb-result">
        <p class="eyebrow">Final score</p>
        <strong class="bb-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
        <p class="bb-result-score">You ${PM.bbScore.you} — ${PM.bbScore.opp} ${escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="bbPeerBackToLobby" type="button">Back to lobby</button>
      </div>`
  } else if (bothRevealed && resolved) {
    const label = resolved.basket ? 'BASKET!' : resolved.blocked ? 'BLOCKED!' : 'OFF THE RIM!'
    const good = iShoot ? resolved.basket : !resolved.basket
    body = `
      <div class="bb-result">
        <p class="eyebrow">Round ${Math.min(round, 3)} result</p>
        <strong class="bb-result-title ${good ? 'is-goal' : 'is-stop'}">${label}</strong>
        <p class="bb-result-score">${resolved.basket ? '+2' : resolved.onTarget ? '+1' : '+0'} ${iShoot ? 'you' : escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="bbPeerNextRound" type="button">Next shot</button>
      </div>`
    animateBuzzerBeater(resolved.aim, resolved.defenderRead, resolved.power)
  } else if (revealed && !remoteRevealed) {
    body = `
      <div class="bb-waiting">
        <p class="eyebrow">Locked in</p>
        <strong>${iShoot ? 'Shot!' : 'Read called!'}</strong>
        <p class="live-copy">Waiting for ${escapeHtml(opponent.name)} to reveal…</p>
      </div>`
  } else if (committed && remoteCommitted && !revealed) {
    body = `
      <div class="bb-reveal">
        <p class="eyebrow">Both locked in</p>
        <strong>Reveal your ${iShoot ? 'shot' : 'read'}</strong>
        <p class="live-copy">The defender has picked a zone — reveal when you're ready.</p>
        <button class="primary-button inline-action" id="bbPeerRevealBtn" type="button">Reveal</button>
      </div>`
  } else if (iShoot) {
    if (!committed) {
      body = `
        <div class="bb-shoot">
          <p class="eyebrow">Round ${round} · Your shot</p>
          <strong>Pick a zone and set power</strong>
          <div class="bb-aim-grid" id="bbPeerAimGrid" aria-label="Pick where to shoot">
            ${BB_ZONES.map(zone => `<button class="aim-zone ${state.bbPeerAim === zone ? 'is-selected' : ''}" type="button" data-zone="${zone}" aria-label="Aim ${zone}"><span></span></button>`).join('')}
          </div>
          <div class="bb-power-wrap">
            <span class="bb-power-label">Power — sweet spot keeps it on target</span>
            <div class="power-track" id="bbPeerPowerTrack"><i class="power-fill is-live" id="bbPeerPowerFill"></i><b class="power-sweet"></b></div>
          </div>
          <button class="primary-button inline-action" id="bbPeerShootBtn" type="button">Shoot</button>
        </div>`
    } else {
      body = `
        <div class="bb-waiting">
          <p class="eyebrow">Committed</p>
          <strong>Shot locked in</strong>
          <p class="live-copy">Waiting for ${escapeHtml(opponent.name)} to pick a read…</p>
        </div>`
    }
  } else {
    if (remoteCommitted && !committed) {
      body = `
        <div class="bb-defend">
          <p class="eyebrow">Round ${round} · You're the defender</p>
          <strong>Pick your read</strong>
          <div class="bb-aim-grid" id="bbPeerDefendGrid" aria-label="Pick your read">
            ${BB_ZONES.map(zone => `<button class="aim-zone ${state.bbPeerDefenderRead === zone ? 'is-selected' : ''}" type="button" data-zone="${zone}" aria-label="Read ${zone}"><span></span></button>`).join('')}
          </div>
          <button class="primary-button inline-action" id="bbPeerDefendBtn" type="button">Contest</button>
        </div>`
    } else {
      body = `
        <div class="bb-waiting">
          <p class="eyebrow">Get ready</p>
          <strong>${escapeHtml(opponent.name)} is lining up…</strong>
          <p class="live-copy">Wait for the shot, then pick your read.</p>
        </div>`
    }
  }

  let panel = stage.querySelector('.bb-panel')
  if (!panel) {
    panel = document.createElement('div')
    panel.className = 'bb-panel'
    stage.appendChild(panel)
  }
  panel.innerHTML = body

  const aimGridEl = $('#bbPeerAimGrid')
  if (aimGridEl && !aimGridEl.dataset.bound) {
    aimGridEl.dataset.bound = '1'
    aimGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.aim-zone')
      if (!btn) return
      state.bbPeerAim = btn.dataset.zone
      renderPeerBuzzerBeaterDuel()
    })
  }
  const defendGridEl = $('#bbPeerDefendGrid')
  if (defendGridEl && !defendGridEl.dataset.bound) {
    defendGridEl.dataset.bound = '1'
    defendGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.aim-zone')
      if (!btn) return
      state.bbPeerDefenderRead = btn.dataset.zone
      renderPeerBuzzerBeaterDuel()
    })
  }
  const shootBtn = $('#bbPeerShootBtn')
  if (shootBtn && !shootBtn.dataset.bound) {
    shootBtn.dataset.bound = '1'
    shootBtn.addEventListener('click', () => {
      const aim = state.bbPeerAim || 'center'
      const power = readFkPowerPct('bbPeerPowerFill', 'bbPeerPowerTrack')
      window.PearCupPeerMatch && window.PearCupPeerMatch.buzzerPick(aim, power)
    })
  }
  const defendBtn = $('#bbPeerDefendBtn')
  if (defendBtn && !defendBtn.dataset.bound) {
    defendBtn.dataset.bound = '1'
    defendBtn.addEventListener('click', () => {
      const defenderRead = state.bbPeerDefenderRead || 'center'
      window.PearCupPeerMatch && window.PearCupPeerMatch.buzzerDefend(defenderRead)
    })
  }
  const revealBtn = $('#bbPeerRevealBtn')
  if (revealBtn && !revealBtn.dataset.bound) {
    revealBtn.dataset.bound = '1'
    revealBtn.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.buzzerReveal())
  }
  const nextBtn = $('#bbPeerNextRound')
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = '1'
    nextBtn.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.buzzerNextRound())
  }
  const backBtn = $('#bbPeerBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true
  const actions = $('#games .game-actions')
  if (actions) actions.hidden = true
}

function renderAIBuzzerBeaterDuel () {
  const bbd = state.buzzerBeaterDuel
  if (!bbd) return
  const title = miniGameTitles['buzzer-beater-duel'] || 'Buzzer Beater Duel'
  const opponent = (state.match && state.match.opponent) || { name: 'Rival' }
  const round = bbd.round + 1
  const iShoot = bbd.mode === 'shoot'
  const resolved = bbd.lastResult
  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title

  const you = { name: state.username || 'captain', team: state.team }
  const opp = { name: opponent.name, team: opponent.team }
  const shooterP = iShoot ? you : opp
  const defenderP = iShoot ? opp : you
  const sTeam = teamById(shooterP.team)
  const dTeam = teamById(defenderP.team)

  const scoreboard = $('#gameScoreboard')
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="game-player-card">
        ${avatarSvg(shooterP.name, sTeam, true)}
        <div><span>Shooter</span><strong>${escapeHtml(shooterP.name)}</strong><em>${sTeam.flag} ${escapeHtml(sTeam.name)}</em></div>
      </div>
      <div class="game-score-core">
        <span class="bb-round">Round ${Math.min(round, 3)} of 3</span>
        <strong class="bb-score">${bbd.score.you} — ${bbd.score.opp}</strong>
        <em>${bbd.over ? 'Match over' : (iShoot ? 'Your shot' : `${escapeHtml(opponent.name)} shoots`)}</em>
      </div>
      <div class="game-player-card is-away">
        ${avatarSvg(defenderP.name, dTeam, true)}
        <div><span>Defender</span><strong>${escapeHtml(defenderP.name)}</strong><em>${dTeam.flag} ${escapeHtml(dTeam.name)}</em></div>
      </div>`
  }

  const stage = $('#penaltyStage')
  if (!stage) return
  stage.classList.remove('is-placeholder')
  stage.hidden = false

  const shooterEl = $('#gameShooter')
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  if (shooterEl) { shooterEl.innerHTML = avatarSvg(shooterP.name, sTeam); shooterEl.style.left = '50%'; shooterEl.classList.remove('lean-left', 'lean-right', 'lean-center') }
  if (keeperEl) { keeperEl.innerHTML = avatarSvg(defenderP.name, dTeam); keeperEl.style.left = '50%'; keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid') }
  if (ballEl) { ballEl.classList.remove('is-kicking', 'bb-shot'); ballEl.style.left = '50%'; ballEl.style.top = '80%'; ballEl.style.transform = '' }

  const aimGrid = $('#aimGrid')
  const powerDock = $('#powerDock')
  if (aimGrid) aimGrid.hidden = true
  if (powerDock) powerDock.hidden = true

  let body = ''
  if (bbd.over) {
    const win = bbd.score.you > bbd.score.opp
    const draw = bbd.score.you === bbd.score.opp
    body = `
      <div class="bb-result">
        <p class="eyebrow">Final score</p>
        <strong class="bb-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
        <p class="bb-result-score">You ${bbd.score.you} — ${bbd.score.opp} ${escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="bbAIBackToLobby" type="button">Back to lobby</button>
      </div>`
  } else if (bbd.phase === 'result' && resolved) {
    const label = resolved.basket ? 'BASKET!' : resolved.blocked ? 'BLOCKED!' : 'OFF THE RIM!'
    const good = iShoot ? resolved.basket : !resolved.basket
    body = `
      <div class="bb-result">
        <p class="eyebrow">Round ${Math.min(round, 3)} result</p>
        <strong class="bb-result-title ${good ? 'is-goal' : 'is-stop'}">${label}</strong>
        <p class="bb-result-score">${resolved.basket ? '+2' : resolved.onTarget ? '+1' : '+0'} ${iShoot ? 'you' : escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="bbAINextRound" type="button">Next shot</button>
      </div>`
    animateBuzzerBeater(resolved.aim, resolved.defenderRead, resolved.power)
  } else if (iShoot) {
    body = `
      <div class="bb-shoot">
        <p class="eyebrow">Round ${round} · Your shot</p>
        <strong>Pick a zone and set power</strong>
        <div class="bb-aim-grid" id="bbAIAimGrid" aria-label="Pick where to shoot">
          ${BB_ZONES.map(zone => `<button class="aim-zone ${state.bbAIAim === zone ? 'is-selected' : ''}" type="button" data-zone="${zone}" aria-label="Aim ${zone}"><span></span></button>`).join('')}
        </div>
        <div class="bb-power-wrap">
          <span class="bb-power-label">Power — sweet spot keeps it on target</span>
          <div class="power-track" id="bbAIPowerTrack"><i class="power-fill is-live" id="bbAIPowerFill"></i><b class="power-sweet"></b></div>
        </div>
        <button class="primary-button inline-action" id="bbAIShootBtn" type="button">Shoot</button>
      </div>`
  } else {
    body = `
      <div class="bb-defend">
        <p class="eyebrow">Round ${round} · You're the defender</p>
        <strong>Pick your read</strong>
        <div class="bb-aim-grid" id="bbAIDefendGrid" aria-label="Pick your read">
          ${BB_ZONES.map(zone => `<button class="aim-zone ${state.bbAIDefenderRead === zone ? 'is-selected' : ''}" type="button" data-zone="${zone}" aria-label="Read ${zone}"><span></span></button>`).join('')}
        </div>
        <button class="primary-button inline-action" id="bbAIDefendBtn" type="button">Contest</button>
      </div>`
  }

  let panel = stage.querySelector('.bb-panel')
  if (!panel) {
    panel = document.createElement('div')
    panel.className = 'bb-panel'
    stage.appendChild(panel)
  }
  panel.innerHTML = body

  const aimGridEl = $('#bbAIAimGrid')
  if (aimGridEl && !aimGridEl.dataset.bound) {
    aimGridEl.dataset.bound = '1'
    aimGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.aim-zone')
      if (!btn) return
      state.bbAIAim = btn.dataset.zone
      renderAIBuzzerBeaterDuel()
    })
  }
  const defendGridEl = $('#bbAIDefendGrid')
  if (defendGridEl && !defendGridEl.dataset.bound) {
    defendGridEl.dataset.bound = '1'
    defendGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.aim-zone')
      if (!btn) return
      state.bbAIDefenderRead = btn.dataset.zone
      renderAIBuzzerBeaterDuel()
    })
  }
  const shootBtn = $('#bbAIShootBtn')
  if (shootBtn && !shootBtn.dataset.bound) {
    shootBtn.dataset.bound = '1'
    shootBtn.addEventListener('click', () => {
      if (bbd.busy || bbd.phase !== 'aim') return
      bbd.busy = true
      const aim = state.bbAIAim || 'center'
      const power = readFkPowerPct('bbAIPowerFill', 'bbAIPowerTrack')
      const { defenderRead } = aiBuzzerDefenderPick(aim)
      resolveAIBuzzerBeater(aim, defenderRead, power)
      renderAIBuzzerBeaterDuel()
    })
  }
  const defendBtn = $('#bbAIDefendBtn')
  if (defendBtn && !defendBtn.dataset.bound) {
    defendBtn.dataset.bound = '1'
    defendBtn.addEventListener('click', () => {
      if (bbd.busy || bbd.phase !== 'aim') return
      bbd.busy = true
      const { aim, power } = aiBuzzerShooterPick()
      const defenderRead = state.bbAIDefenderRead || 'center'
      resolveAIBuzzerBeater(aim, defenderRead, power)
      renderAIBuzzerBeaterDuel()
    })
  }
  const nextBtn = $('#bbAINextRound')
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = '1'
    nextBtn.addEventListener('click', () => {
      if (bbd.over) return
      bbd.mode = bbd.mode === 'shoot' ? 'keep' : 'shoot'
      if (bbd.mode === 'shoot') bbd.round += 1
      bbd.phase = 'aim'
      bbd.lastResult = null
      bbd.busy = false
      state.bbAIAim = null
      state.bbAIDefenderRead = null
      renderAIBuzzerBeaterDuel()
    })
  }
  const backBtn = $('#bbAIBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true
  const actions = $('#games .game-actions')
  if (actions) actions.hidden = true
}

function renderPeerAceServeDuel () {
  const PM = window.PearCupPeerMatch && window.PearCupPeerMatch._state
  if (!PM) return
  const title = miniGameTitles['ace-serve-duel'] || 'Ace Serve Duel'
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const round = PM.asRound + 1
  const iServe = iAmShooterPeer()
  const committed = PM.asCommit != null
  const remoteCommitted = PM.asRemoteCommit != null
  const revealed = PM.asRevealed.you
  const remoteRevealed = PM.asRevealed.opp
  const bothRevealed = revealed && remoteRevealed
  const resolved = PM.asResolved

  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title

  const me = { name: PM.self.name, team: PM.self.team }
  const opp = { name: PM.opp.name, team: PM.opp.team }
  const serverP = iServe ? me : opp
  const returnerP = iServe ? opp : me
  const sTeam = teamById(serverP.team)
  const rTeam = teamById(returnerP.team)

  const scoreboard = $('#gameScoreboard')
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="game-player-card">
        ${avatarSvg(serverP.name, sTeam, true)}
        <div><span>Server</span><strong>${escapeHtml(serverP.name)}</strong><em>${sTeam.flag} ${escapeHtml(sTeam.name)}</em></div>
      </div>
      <div class="game-score-core">
        <span class="as-round">Round ${Math.min(round, 3)} of 3</span>
        <strong class="as-score">${PM.asScore.you} — ${PM.asScore.opp}</strong>
        <em>${PM.asOver ? 'Match over' : (iServe ? 'Your serve' : `${escapeHtml(opp.name)} serves`)}</em>
      </div>
      <div class="game-player-card is-away">
        ${avatarSvg(returnerP.name, rTeam, true)}
        <div><span>Returner</span><strong>${escapeHtml(returnerP.name)}</strong><em>${rTeam.flag} ${escapeHtml(rTeam.name)}</em></div>
      </div>`
  }

  const stage = $('#penaltyStage')
  if (!stage) return
  stage.classList.remove('is-placeholder')
  stage.hidden = false

  const shooterEl = $('#gameShooter')
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  if (shooterEl) { shooterEl.innerHTML = avatarSvg(serverP.name, sTeam); shooterEl.style.left = '50%'; shooterEl.classList.remove('lean-left', 'lean-right', 'lean-center') }
  if (keeperEl) { keeperEl.innerHTML = avatarSvg(returnerP.name, rTeam); keeperEl.style.left = '50%'; keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid') }
  if (ballEl) { ballEl.classList.remove('is-kicking', 'as-serve'); ballEl.style.left = '50%'; ballEl.style.top = '80%'; ballEl.style.transform = '' }

  const aimGrid = $('#aimGrid')
  const powerDock = $('#powerDock')
  if (aimGrid) aimGrid.hidden = true
  if (powerDock) powerDock.hidden = true

  let body = ''
  if (PM.asOver) {
    const win = PM.asScore.you > PM.asScore.opp
    const draw = PM.asScore.you === PM.asScore.opp
    body = `
      <div class="as-result">
        <p class="eyebrow">Final score</p>
        <strong class="as-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
        <p class="as-result-score">You ${PM.asScore.you} — ${PM.asScore.opp} ${escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="asPeerBackToLobby" type="button">Back to lobby</button>
      </div>`
  } else if (bothRevealed && resolved) {
    const label = resolved.ace ? 'ACE!' : resolved.inBounds ? 'IN PLAY' : 'FAULT!'
    const good = iServe ? resolved.ace : !resolved.ace
    body = `
      <div class="as-result">
        <p class="eyebrow">Round ${Math.min(round, 3)} result</p>
        <strong class="as-result-title ${good ? 'is-goal' : 'is-stop'}">${label}</strong>
        <p class="as-result-score">${resolved.ace ? '+2' : resolved.inBounds ? '+1' : '+0'} ${iServe ? 'you' : escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="asPeerNextRound" type="button">Next serve</button>
      </div>`
    animateAceServe(resolved.placement, resolved.returnerRead, resolved.power, resolved.spin)
  } else if (revealed && !remoteRevealed) {
    body = `
      <div class="as-waiting">
        <p class="eyebrow">Locked in</p>
        <strong>${iServe ? 'Served!' : 'Read called!'}</strong>
        <p class="live-copy">Waiting for ${escapeHtml(opponent.name)} to reveal…</p>
      </div>`
  } else if (committed && remoteCommitted && !revealed) {
    body = `
      <div class="as-reveal">
        <p class="eyebrow">Both locked in</p>
        <strong>Reveal your ${iServe ? 'serve' : 'read'}</strong>
        <p class="live-copy">The returner has picked a zone — reveal when you're ready.</p>
        <button class="primary-button inline-action" id="asPeerRevealBtn" type="button">Reveal</button>
      </div>`
  } else if (iServe) {
    if (!committed) {
      body = `
        <div class="as-serve">
          <p class="eyebrow">Round ${round} · Your serve</p>
          <strong>Pick placement, power, and spin</strong>
          <div class="as-aim-grid" id="asPeerAimGrid" aria-label="Pick serve placement">
            ${AS_ZONES.map(zone => `<button class="aim-zone ${state.asPeerPlacement === zone ? 'is-selected' : ''}" type="button" data-zone="${zone}" aria-label="Serve ${zone}"><span></span></button>`).join('')}
          </div>
          <div class="as-power-wrap">
            <span class="as-power-label">Power — sweet spot is on frame</span>
            <div class="power-track" id="asPeerPowerTrack"><i class="power-fill is-live" id="asPeerPowerFill"></i><b class="power-sweet"></b></div>
          </div>
          <div class="as-spin-selector" id="asPeerSpin" role="group" aria-label="Spin">
            <button class="secondary-button compact-action ${state.asPeerSpin === -1 ? 'is-active' : ''}" type="button" data-spin="-1">Slice</button>
            <button class="secondary-button compact-action ${state.asPeerSpin === 0 ? 'is-active' : ''}" type="button" data-spin="0">Flat</button>
            <button class="secondary-button compact-action ${state.asPeerSpin === 1 ? 'is-active' : ''}" type="button" data-spin="1">Topspin</button>
          </div>
          <button class="primary-button inline-action" id="asPeerServeBtn" type="button">Serve</button>
        </div>`
    } else {
      body = `
        <div class="as-waiting">
          <p class="eyebrow">Committed</p>
          <strong>Serve locked in</strong>
          <p class="live-copy">Waiting for ${escapeHtml(opponent.name)} to pick a read…</p>
        </div>`
    }
  } else {
    if (remoteCommitted && !committed) {
      body = `
        <div class="as-return">
          <p class="eyebrow">Round ${round} · You're the returner</p>
          <strong>Pick your read</strong>
          <div class="as-aim-grid" id="asPeerReturnGrid" aria-label="Pick your read">
            ${AS_ZONES.map(zone => `<button class="aim-zone ${state.asPeerReturnerRead === zone ? 'is-selected' : ''}" type="button" data-zone="${zone}" aria-label="Read ${zone}"><span></span></button>`).join('')}
          </div>
          <button class="primary-button inline-action" id="asPeerReturnBtn" type="button">Call read</button>
        </div>`
    } else {
      body = `
        <div class="as-waiting">
          <p class="eyebrow">Get ready</p>
          <strong>${escapeHtml(opponent.name)} is serving…</strong>
          <p class="live-copy">Wait for the serve, then pick your read.</p>
        </div>`
    }
  }

  let panel = stage.querySelector('.as-panel')
  if (!panel) {
    panel = document.createElement('div')
    panel.className = 'as-panel'
    stage.appendChild(panel)
  }
  panel.innerHTML = body

  const aimGridEl = $('#asPeerAimGrid')
  if (aimGridEl && !aimGridEl.dataset.bound) {
    aimGridEl.dataset.bound = '1'
    aimGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.aim-zone')
      if (!btn) return
      state.asPeerPlacement = btn.dataset.zone
      renderPeerAceServeDuel()
    })
  }
  const returnGridEl = $('#asPeerReturnGrid')
  if (returnGridEl && !returnGridEl.dataset.bound) {
    returnGridEl.dataset.bound = '1'
    returnGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.aim-zone')
      if (!btn) return
      state.asPeerReturnerRead = btn.dataset.zone
      renderPeerAceServeDuel()
    })
  }
  const spinEl = $('#asPeerSpin')
  if (spinEl && !spinEl.dataset.bound) {
    spinEl.dataset.bound = '1'
    spinEl.addEventListener('click', event => {
      const btn = event.target.closest('[data-spin]')
      if (!btn) return
      state.asPeerSpin = Number(btn.dataset.spin)
      renderPeerAceServeDuel()
    })
  }
  const serveBtn = $('#asPeerServeBtn')
  if (serveBtn && !serveBtn.dataset.bound) {
    serveBtn.dataset.bound = '1'
    serveBtn.addEventListener('click', () => {
      const placement = state.asPeerPlacement || 'body'
      const power = readFkPowerPct('asPeerPowerFill', 'asPeerPowerTrack')
      const spin = state.asPeerSpin != null ? state.asPeerSpin : 0
      window.PearCupPeerMatch && window.PearCupPeerMatch.aceServePick(placement, power, spin)
    })
  }
  const returnBtn = $('#asPeerReturnBtn')
  if (returnBtn && !returnBtn.dataset.bound) {
    returnBtn.dataset.bound = '1'
    returnBtn.addEventListener('click', () => {
      const returnerRead = state.asPeerReturnerRead || 'body'
      window.PearCupPeerMatch && window.PearCupPeerMatch.aceServeReturn(returnerRead)
    })
  }
  const revealBtn = $('#asPeerRevealBtn')
  if (revealBtn && !revealBtn.dataset.bound) {
    revealBtn.dataset.bound = '1'
    revealBtn.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.aceServeReveal())
  }
  const nextBtn = $('#asPeerNextRound')
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = '1'
    nextBtn.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.aceServeNextRound())
  }
  const backBtn = $('#asPeerBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true
  const actions = $('#games .game-actions')
  if (actions) actions.hidden = true
}

function renderAIAceServeDuel () {
  const asd = state.aceServeDuel
  if (!asd) return
  const title = miniGameTitles['ace-serve-duel'] || 'Ace Serve Duel'
  const opponent = (state.match && state.match.opponent) || { name: 'Rival' }
  const round = asd.round + 1
  const iServe = asd.mode === 'serve'
  const resolved = asd.lastResult
  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title

  const you = { name: state.username || 'captain', team: state.team }
  const opp = { name: opponent.name, team: opponent.team }
  const serverP = iServe ? you : opp
  const returnerP = iServe ? opp : you
  const sTeam = teamById(serverP.team)
  const rTeam = teamById(returnerP.team)

  const scoreboard = $('#gameScoreboard')
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="game-player-card">
        ${avatarSvg(serverP.name, sTeam, true)}
        <div><span>Server</span><strong>${escapeHtml(serverP.name)}</strong><em>${sTeam.flag} ${escapeHtml(sTeam.name)}</em></div>
      </div>
      <div class="game-score-core">
        <span class="as-round">Round ${Math.min(round, 3)} of 3</span>
        <strong class="as-score">${asd.score.you} — ${asd.score.opp}</strong>
        <em>${asd.over ? 'Match over' : (iServe ? 'Your serve' : `${escapeHtml(opponent.name)} serves`)}</em>
      </div>
      <div class="game-player-card is-away">
        ${avatarSvg(returnerP.name, rTeam, true)}
        <div><span>Returner</span><strong>${escapeHtml(returnerP.name)}</strong><em>${rTeam.flag} ${escapeHtml(rTeam.name)}</em></div>
      </div>`
  }

  const stage = $('#penaltyStage')
  if (!stage) return
  stage.classList.remove('is-placeholder')
  stage.hidden = false

  const shooterEl = $('#gameShooter')
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  if (shooterEl) { shooterEl.innerHTML = avatarSvg(serverP.name, sTeam); shooterEl.style.left = '50%'; shooterEl.classList.remove('lean-left', 'lean-right', 'lean-center') }
  if (keeperEl) { keeperEl.innerHTML = avatarSvg(returnerP.name, rTeam); keeperEl.style.left = '50%'; keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid') }
  if (ballEl) { ballEl.classList.remove('is-kicking', 'as-serve'); ballEl.style.left = '50%'; ballEl.style.top = '80%'; ballEl.style.transform = '' }

  const aimGrid = $('#aimGrid')
  const powerDock = $('#powerDock')
  if (aimGrid) aimGrid.hidden = true
  if (powerDock) powerDock.hidden = true

  let body = ''
  if (asd.over) {
    const win = asd.score.you > asd.score.opp
    const draw = asd.score.you === asd.score.opp
    body = `
      <div class="as-result">
        <p class="eyebrow">Final score</p>
        <strong class="as-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
        <p class="as-result-score">You ${asd.score.you} — ${asd.score.opp} ${escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="asAIBackToLobby" type="button">Back to lobby</button>
      </div>`
  } else if (asd.phase === 'result' && resolved) {
    const label = resolved.ace ? 'ACE!' : resolved.inBounds ? 'IN PLAY' : 'FAULT!'
    const good = iServe ? resolved.ace : !resolved.ace
    body = `
      <div class="as-result">
        <p class="eyebrow">Round ${Math.min(round, 3)} result</p>
        <strong class="as-result-title ${good ? 'is-goal' : 'is-stop'}">${label}</strong>
        <p class="as-result-score">${resolved.ace ? '+2' : resolved.inBounds ? '+1' : '+0'} ${iServe ? 'you' : escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="asAINextRound" type="button">Next serve</button>
      </div>`
    animateAceServe(resolved.placement, resolved.returnerRead, resolved.power, resolved.spin)
  } else if (iServe) {
    body = `
      <div class="as-serve">
        <p class="eyebrow">Round ${round} · Your serve</p>
        <strong>Pick placement, power, and spin</strong>
        <div class="as-aim-grid" id="asAIAimGrid" aria-label="Pick serve placement">
          ${AS_ZONES.map(zone => `<button class="aim-zone ${state.asAIPlacement === zone ? 'is-selected' : ''}" type="button" data-zone="${zone}" aria-label="Serve ${zone}"><span></span></button>`).join('')}
        </div>
        <div class="as-power-wrap">
          <span class="as-power-label">Power — sweet spot is on frame</span>
          <div class="power-track" id="asAIPowerTrack"><i class="power-fill is-live" id="asAIPowerFill"></i><b class="power-sweet"></b></div>
        </div>
        <div class="as-spin-selector" id="asAISpin" role="group" aria-label="Spin">
          <button class="secondary-button compact-action ${state.asAISpin === -1 ? 'is-active' : ''}" type="button" data-spin="-1">Slice</button>
          <button class="secondary-button compact-action ${state.asAISpin === 0 ? 'is-active' : ''}" type="button" data-spin="0">Flat</button>
          <button class="secondary-button compact-action ${state.asAISpin === 1 ? 'is-active' : ''}" type="button" data-spin="1">Topspin</button>
        </div>
        <button class="primary-button inline-action" id="asAIServeBtn" type="button">Serve</button>
      </div>`
  } else {
    body = `
      <div class="as-return">
        <p class="eyebrow">Round ${round} · You're the returner</p>
        <strong>Pick your read</strong>
        <div class="as-aim-grid" id="asAIReturnGrid" aria-label="Pick your read">
          ${AS_ZONES.map(zone => `<button class="aim-zone ${state.asAIReturnerRead === zone ? 'is-selected' : ''}" type="button" data-zone="${zone}" aria-label="Read ${zone}"><span></span></button>`).join('')}
        </div>
        <button class="primary-button inline-action" id="asAIReturnBtn" type="button">Call read</button>
      </div>`
  }

  let panel = stage.querySelector('.as-panel')
  if (!panel) {
    panel = document.createElement('div')
    panel.className = 'as-panel'
    stage.appendChild(panel)
  }
  panel.innerHTML = body

  const aimGridEl = $('#asAIAimGrid')
  if (aimGridEl && !aimGridEl.dataset.bound) {
    aimGridEl.dataset.bound = '1'
    aimGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.aim-zone')
      if (!btn) return
      state.asAIPlacement = btn.dataset.zone
      renderAIAceServeDuel()
    })
  }
  const returnGridEl = $('#asAIReturnGrid')
  if (returnGridEl && !returnGridEl.dataset.bound) {
    returnGridEl.dataset.bound = '1'
    returnGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.aim-zone')
      if (!btn) return
      state.asAIReturnerRead = btn.dataset.zone
      renderAIAceServeDuel()
    })
  }
  const spinEl = $('#asAISpin')
  if (spinEl && !spinEl.dataset.bound) {
    spinEl.dataset.bound = '1'
    spinEl.addEventListener('click', event => {
      const btn = event.target.closest('[data-spin]')
      if (!btn) return
      state.asAISpin = Number(btn.dataset.spin)
      renderAIAceServeDuel()
    })
  }
  const serveBtn = $('#asAIServeBtn')
  if (serveBtn && !serveBtn.dataset.bound) {
    serveBtn.dataset.bound = '1'
    serveBtn.addEventListener('click', () => {
      if (asd.busy || asd.phase !== 'aim') return
      asd.busy = true
      const placement = state.asAIPlacement || 'body'
      const power = readFkPowerPct('asAIPowerFill', 'asAIPowerTrack')
      const spin = state.asAISpin != null ? state.asAISpin : 0
      const { returnerRead } = aiAceReturnerPick(placement)
      resolveAIAceServe(placement, returnerRead, power, spin)
      renderAIAceServeDuel()
    })
  }
  const returnBtn = $('#asAIReturnBtn')
  if (returnBtn && !returnBtn.dataset.bound) {
    returnBtn.dataset.bound = '1'
    returnBtn.addEventListener('click', () => {
      if (asd.busy || asd.phase !== 'aim') return
      asd.busy = true
      const { placement, power, spin } = aiAceServerPick()
      const returnerRead = state.asAIReturnerRead || 'body'
      resolveAIAceServe(placement, returnerRead, power, spin)
      renderAIAceServeDuel()
    })
  }
  const nextBtn = $('#asAINextRound')
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = '1'
    nextBtn.addEventListener('click', () => {
      if (asd.over) return
      asd.mode = asd.mode === 'serve' ? 'return' : 'serve'
      if (asd.mode === 'serve') asd.round += 1
      asd.phase = 'aim'
      asd.lastResult = null
      asd.busy = false
      state.asAIPlacement = null
      state.asAISpin = 0
      state.asAIReturnerRead = null
      renderAIAceServeDuel()
    })
  }
  const backBtn = $('#asAIBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true
  const actions = $('#games .game-actions')
  if (actions) actions.hidden = true
}

// ---- Home Run Derby helpers ----
function iAmPitcherPeer () {
  const PM = window.PearCupPeerMatch && window.PearCupPeerMatch._state
  if (!PM) return true
  return (PM.kIndex % 2 === 0 ? 'A' : 'B') === PM.role
}
function iAmBatterPeer () { return !iAmPitcherPeer() }

function animateHomeRun (pitchRead, pitchType, power, timing) {
  const stage = $('#penaltyStage')
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  if (!stage || !ballEl) return
  const readCorrect = pitchRead === pitchType
  const homeRun = readCorrect && power >= 70 && timing === 'good'
  const hit = readCorrect && power >= 50
  if (keeperEl) {
    keeperEl.style.left = '50%'
    keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid')
  }
  let bx = 50
  let by = 80
  if (homeRun) { bx = 50; by = 5 }
  else if (hit) { bx = 70; by = 35 }
  else { bx = 90; by = 60 }
  ballEl.classList.add('is-kicking')
  ballEl.classList.add('hr-shot')
  requestAnimationFrame(() => {
    ballEl.style.left = `${bx}%`
    ballEl.style.top = `${by}%`
  })
}

function resolveAIHomeRun (pitchRead, pitchType, power, timing) {
  const hrd = state.homeRunDerby
  if (!hrd) return null
  const readCorrect = pitchRead === pitchType
  const homeRun = readCorrect && power >= 70 && timing === 'good'
  const hit = readCorrect && power >= 50
  let points = 0
  if (homeRun) points = 4
  else if (hit) points = 1
  const batter = hrd.mode === 'batter'
  if (batter) hrd.score.you += points
  else hrd.score.opp += points
  hrd.swingCount += 1
  hrd.lastResult = { pitchRead, pitchType, power, timing, readCorrect, homeRun, hit, points }
  hrd.phase = 'result'
  if (hrd.swingCount >= 6) {
    hrd.over = true
    const opp = state.match.opponent
    const win = hrd.score.you > hrd.score.opp
    const draw = hrd.score.you === hrd.score.opp
    showToast(win ? `You win ${hrd.score.you}–${hrd.score.opp}!` : draw ? `Draw ${hrd.score.you}–${hrd.score.opp}` : `${opp.name} wins ${hrd.score.opp}–${hrd.score.you}`)
  }
  return hrd.lastResult
}

function aiHomeRunPitcherPick () {
  return { pitchType: HR_PITCH_TYPES[Math.floor(Math.random() * HR_PITCH_TYPES.length)] }
}

function aiHomeRunBatterPick (pitchType) {
  const pick = currentOpponent()
  const diff = opponentDifficulty(pick)
  const pitchRead = Math.random() < diff ? pitchType : HR_PITCH_TYPES[Math.floor(Math.random() * HR_PITCH_TYPES.length)]
  const power = Math.round(45 + diff * 50)
  const timing = Math.random() < diff ? 'good' : (Math.random() < 0.5 ? 'late' : 'early')
  return { pitchRead, power, timing }
}

function renderPeerHomeRunDerby () {
  const PM = window.PearCupPeerMatch && window.PearCupPeerMatch._state
  if (!PM) return
  const title = miniGameTitles['home-run-derby'] || 'Home Run Derby'
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const round = PM.hrRound + 1
  const iPitch = iAmPitcherPeer()
  const committed = PM.hrCommit != null
  const remoteCommitted = PM.hrRemoteCommit != null
  const revealed = PM.hrRevealed.you
  const remoteRevealed = PM.hrRevealed.opp
  const bothRevealed = revealed && remoteRevealed
  const resolved = PM.hrResolved

  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title

  const me = { name: PM.self.name, team: PM.self.team }
  const opp = { name: PM.opp.name, team: PM.opp.team }
  const pitcherP = iPitch ? me : opp
  const batterP = iPitch ? opp : me
  const pTeam = teamById(pitcherP.team)
  const bTeam = teamById(batterP.team)

  const scoreboard = $('#gameScoreboard')
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="game-player-card">
        ${avatarSvg(pitcherP.name, pTeam, true)}
        <div><span>Pitcher</span><strong>${escapeHtml(pitcherP.name)}</strong><em>${pTeam.flag} ${escapeHtml(pTeam.name)}</em></div>
      </div>
      <div class="game-score-core">
        <span class="hr-round">Round ${Math.min(round, 3)} of 3</span>
        <strong class="hr-score">${PM.hrScore.you} — ${PM.hrScore.opp}</strong>
        <em>${PM.hrOver ? 'Match over' : (iPitch ? 'You pitch' : `${escapeHtml(opp.name)} pitches`)}</em>
      </div>
      <div class="game-player-card is-away">
        ${avatarSvg(batterP.name, bTeam, true)}
        <div><span>Batter</span><strong>${escapeHtml(batterP.name)}</strong><em>${bTeam.flag} ${escapeHtml(bTeam.name)}</em></div>
      </div>`
  }

  const stage = $('#penaltyStage')
  if (!stage) return
  stage.classList.remove('is-placeholder')
  stage.hidden = false

  const shooterEl = $('#gameShooter')
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  if (shooterEl) { shooterEl.innerHTML = avatarSvg(batterP.name, bTeam); shooterEl.style.left = '50%'; shooterEl.classList.remove('lean-left', 'lean-right', 'lean-center') }
  if (keeperEl) { keeperEl.innerHTML = avatarSvg(pitcherP.name, pTeam); keeperEl.style.left = '50%'; keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid') }
  if (ballEl) { ballEl.classList.remove('is-kicking', 'hr-shot'); ballEl.style.left = '50%'; ballEl.style.top = '80%'; ballEl.style.transform = '' }

  const aimGrid = $('#aimGrid')
  const powerDock = $('#powerDock')
  if (aimGrid) aimGrid.hidden = true
  if (powerDock) powerDock.hidden = true

  let body = ''
  if (PM.hrOver) {
    const win = PM.hrScore.you > PM.hrScore.opp
    const draw = PM.hrScore.you === PM.hrScore.opp
    body = `
      <div class="hr-result">
        <p class="eyebrow">Final score</p>
        <strong class="hr-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
        <p class="hr-result-score">You ${PM.hrScore.you} — ${PM.hrScore.opp} ${escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="hrPeerBackToLobby" type="button">Back to lobby</button>
      </div>`
  } else if (bothRevealed && resolved) {
    const label = resolved.homeRun ? 'HOME RUN!' : resolved.hit ? 'BASE HIT!' : 'OUT!'
    const good = iPitch ? !resolved.homeRun : (resolved.homeRun || resolved.hit)
    body = `
      <div class="hr-result">
        <p class="eyebrow">Round ${Math.min(round, 3)} result</p>
        <strong class="hr-result-title ${good ? 'is-goal' : 'is-stop'}">${label}</strong>
        <p class="hr-result-score">${resolved.homeRun ? '+4' : resolved.hit ? '+1' : '+0'} ${iPitch ? escapeHtml(opponent.name) : 'you'}</p>
        <button class="primary-button inline-action" id="hrPeerNextRound" type="button">Next swing</button>
      </div>`
    animateHomeRun(resolved.pitchRead, resolved.pitchType, resolved.power, resolved.timing)
  } else if (revealed && !remoteRevealed) {
    body = `
      <div class="hr-waiting">
        <p class="eyebrow">Locked in</p>
        <strong>${iPitch ? 'Pitch thrown!' : 'Swing taken!'}</strong>
        <p class="live-copy">Waiting for ${escapeHtml(opponent.name)} to reveal…</p>
      </div>`
  } else if (committed && remoteCommitted && !revealed) {
    body = `
      <div class="hr-reveal">
        <p class="eyebrow">Both locked in</p>
        <strong>Reveal your ${iPitch ? 'pitch' : 'swing'}</strong>
        <p class="live-copy">The ${iPitch ? 'batter' : 'pitcher'} has locked in — reveal when you're ready.</p>
        <button class="primary-button inline-action" id="hrPeerRevealBtn" type="button">Reveal</button>
      </div>`
  } else if (iPitch) {
    if (!committed) {
      body = `
        <div class="hr-pitch">
          <p class="eyebrow">Round ${round} · You pitch</p>
          <strong>Pick a pitch type</strong>
          <div class="hr-pitch-grid" id="hrPeerPitchGrid" aria-label="Pick pitch type">
            ${HR_PITCH_TYPES.map(type => `<button class="hr-pitch-type ${state.hrPeerPitchType === type ? 'is-selected' : ''}" type="button" data-pitch="${type}" aria-label="Pitch ${type}">${escapeHtml(type)}</button>`).join('')}
          </div>
          <button class="primary-button inline-action" id="hrPeerPitchBtn" type="button">Throw</button>
        </div>`
    } else {
      body = `
        <div class="hr-waiting">
          <p class="eyebrow">Committed</p>
          <strong>Pitch locked in</strong>
          <p class="live-copy">Waiting for ${escapeHtml(opponent.name)} to swing…</p>
        </div>`
    }
  } else {
    if (remoteCommitted && !committed) {
      body = `
        <div class="hr-bat">
          <p class="eyebrow">Round ${round} · You're batting</p>
          <strong>Read the pitch, set power, time it</strong>
          <div class="hr-pitch-grid" id="hrPeerReadGrid" aria-label="Pick pitch read">
            ${HR_PITCH_TYPES.map(type => `<button class="hr-pitch-type ${state.hrPeerPitchRead === type ? 'is-selected' : ''}" type="button" data-pitch="${type}" aria-label="Read ${type}">${escapeHtml(type)}</button>`).join('')}
          </div>
          <div class="hr-power-wrap">
            <span class="hr-power-label">Power — 70+ and good timing sends it out</span>
            <div class="power-track" id="hrPeerPowerTrack"><i class="power-fill is-live" id="hrPeerPowerFill"></i><b class="power-sweet"></b></div>
          </div>
          <div class="hr-timing-selector" id="hrPeerTiming" role="group" aria-label="Timing">
            <button class="secondary-button compact-action ${state.hrPeerTiming === 'good' ? 'is-active' : ''}" type="button" data-timing="good">Good</button>
            <button class="secondary-button compact-action ${state.hrPeerTiming === 'late' ? 'is-active' : ''}" type="button" data-timing="late">Late</button>
            <button class="secondary-button compact-action ${state.hrPeerTiming === 'early' ? 'is-active' : ''}" type="button" data-timing="early">Early</button>
          </div>
          <button class="primary-button inline-action" id="hrPeerSwingBtn" type="button">Swing</button>
        </div>`
    } else {
      body = `
        <div class="hr-waiting">
          <p class="eyebrow">Get ready</p>
          <strong>${escapeHtml(opponent.name)} is choosing a pitch…</strong>
          <p class="live-copy">Wait for the pitch, then read it and swing.</p>
        </div>`
    }
  }

  let panel = stage.querySelector('.hr-panel')
  if (!panel) {
    panel = document.createElement('div')
    panel.className = 'hr-panel'
    stage.appendChild(panel)
  }
  panel.innerHTML = body

  const pitchGridEl = $('#hrPeerPitchGrid')
  if (pitchGridEl && !pitchGridEl.dataset.bound) {
    pitchGridEl.dataset.bound = '1'
    pitchGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.hr-pitch-type')
      if (!btn) return
      state.hrPeerPitchType = btn.dataset.pitch
      renderPeerHomeRunDerby()
    })
  }
  const readGridEl = $('#hrPeerReadGrid')
  if (readGridEl && !readGridEl.dataset.bound) {
    readGridEl.dataset.bound = '1'
    readGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.hr-pitch-type')
      if (!btn) return
      state.hrPeerPitchRead = btn.dataset.pitch
      renderPeerHomeRunDerby()
    })
  }
  const timingEl = $('#hrPeerTiming')
  if (timingEl && !timingEl.dataset.bound) {
    timingEl.dataset.bound = '1'
    timingEl.addEventListener('click', event => {
      const btn = event.target.closest('[data-timing]')
      if (!btn) return
      state.hrPeerTiming = btn.dataset.timing
      renderPeerHomeRunDerby()
    })
  }
  const pitchBtn = $('#hrPeerPitchBtn')
  if (pitchBtn && !pitchBtn.dataset.bound) {
    pitchBtn.dataset.bound = '1'
    pitchBtn.addEventListener('click', () => {
      const pitchType = state.hrPeerPitchType || HR_PITCH_TYPES[0]
      window.PearCupPeerMatch && window.PearCupPeerMatch.homeRunPitch(pitchType)
    })
  }
  const swingBtn = $('#hrPeerSwingBtn')
  if (swingBtn && !swingBtn.dataset.bound) {
    swingBtn.dataset.bound = '1'
    swingBtn.addEventListener('click', () => {
      const pitchRead = state.hrPeerPitchRead || HR_PITCH_TYPES[0]
      const power = readFkPowerPct('hrPeerPowerFill', 'hrPeerPowerTrack')
      const timing = state.hrPeerTiming || 'good'
      window.PearCupPeerMatch && window.PearCupPeerMatch.homeRunSwing(pitchRead, power, timing)
    })
  }
  const revealBtn = $('#hrPeerRevealBtn')
  if (revealBtn && !revealBtn.dataset.bound) {
    revealBtn.dataset.bound = '1'
    revealBtn.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.homeRunReveal())
  }
  const nextBtn = $('#hrPeerNextRound')
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = '1'
    nextBtn.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.homeRunNextRound())
  }
  const backBtn = $('#hrPeerBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true
  const actions = $('#games .game-actions')
  if (actions) actions.hidden = true
}

function renderAIHomeRunDerby () {
  const hrd = state.homeRunDerby
  if (!hrd) return
  const title = miniGameTitles['home-run-derby'] || 'Home Run Derby'
  const opponent = (state.match && state.match.opponent) || { name: 'Rival' }
  const round = hrd.round + 1
  const iPitch = hrd.mode === 'pitcher'
  const resolved = hrd.lastResult
  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title

  const you = { name: state.username || 'captain', team: state.team }
  const opp = { name: opponent.name, team: opponent.team }
  const pitcherP = iPitch ? you : opp
  const batterP = iPitch ? opp : you
  const pTeam = teamById(pitcherP.team)
  const bTeam = teamById(batterP.team)

  const scoreboard = $('#gameScoreboard')
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="game-player-card">
        ${avatarSvg(pitcherP.name, pTeam, true)}
        <div><span>Pitcher</span><strong>${escapeHtml(pitcherP.name)}</strong><em>${pTeam.flag} ${escapeHtml(pTeam.name)}</em></div>
      </div>
      <div class="game-score-core">
        <span class="hr-round">Round ${Math.min(round, 3)} of 3</span>
        <strong class="hr-score">${hrd.score.you} — ${hrd.score.opp}</strong>
        <em>${hrd.over ? 'Match over' : (iPitch ? 'You pitch' : `${escapeHtml(opponent.name)} pitches`)}</em>
      </div>
      <div class="game-player-card is-away">
        ${avatarSvg(batterP.name, bTeam, true)}
        <div><span>Batter</span><strong>${escapeHtml(batterP.name)}</strong><em>${bTeam.flag} ${escapeHtml(bTeam.name)}</em></div>
      </div>`
  }

  const stage = $('#penaltyStage')
  if (!stage) return
  stage.classList.remove('is-placeholder')
  stage.hidden = false

  const shooterEl = $('#gameShooter')
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  if (shooterEl) { shooterEl.innerHTML = avatarSvg(batterP.name, bTeam); shooterEl.style.left = '50%'; shooterEl.classList.remove('lean-left', 'lean-right', 'lean-center') }
  if (keeperEl) { keeperEl.innerHTML = avatarSvg(pitcherP.name, pTeam); keeperEl.style.left = '50%'; keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid') }
  if (ballEl) { ballEl.classList.remove('is-kicking', 'hr-shot'); ballEl.style.left = '50%'; ballEl.style.top = '80%'; ballEl.style.transform = '' }

  const aimGrid = $('#aimGrid')
  const powerDock = $('#powerDock')
  if (aimGrid) aimGrid.hidden = true
  if (powerDock) powerDock.hidden = true

  let body = ''
  if (hrd.over) {
    const win = hrd.score.you > hrd.score.opp
    const draw = hrd.score.you === hrd.score.opp
    body = `
      <div class="hr-result">
        <p class="eyebrow">Final score</p>
        <strong class="hr-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
        <p class="hr-result-score">You ${hrd.score.you} — ${hrd.score.opp} ${escapeHtml(opponent.name)}</p>
        <button class="primary-button inline-action" id="hrAIBackToLobby" type="button">Back to lobby</button>
      </div>`
  } else if (hrd.phase === 'result' && resolved) {
    const label = resolved.homeRun ? 'HOME RUN!' : resolved.hit ? 'BASE HIT!' : 'OUT!'
    const good = iPitch ? !resolved.homeRun : (resolved.homeRun || resolved.hit)
    body = `
      <div class="hr-result">
        <p class="eyebrow">Round ${Math.min(round, 3)} result</p>
        <strong class="hr-result-title ${good ? 'is-goal' : 'is-stop'}">${label}</strong>
        <p class="hr-result-score">${resolved.homeRun ? '+4' : resolved.hit ? '+1' : '+0'} ${iPitch ? escapeHtml(opponent.name) : 'you'}</p>
        <button class="primary-button inline-action" id="hrAINextRound" type="button">Next swing</button>
      </div>`
    animateHomeRun(resolved.pitchRead, resolved.pitchType, resolved.power, resolved.timing)
  } else if (iPitch) {
    body = `
      <div class="hr-pitch">
        <p class="eyebrow">Round ${round} · You pitch</p>
        <strong>Pick a pitch type</strong>
        <div class="hr-pitch-grid" id="hrAIPitchGrid" aria-label="Pick pitch type">
          ${HR_PITCH_TYPES.map(type => `<button class="hr-pitch-type ${state.hrAIPitchType === type ? 'is-selected' : ''}" type="button" data-pitch="${type}" aria-label="Pitch ${type}">${escapeHtml(type)}</button>`).join('')}
        </div>
        <button class="primary-button inline-action" id="hrAIPitchBtn" type="button">Throw</button>
      </div>`
  } else {
    body = `
      <div class="hr-bat">
        <p class="eyebrow">Round ${round} · You're batting</p>
        <strong>Read the pitch, set power, time it</strong>
        <div class="hr-pitch-grid" id="hrAIReadGrid" aria-label="Pick pitch read">
          ${HR_PITCH_TYPES.map(type => `<button class="hr-pitch-type ${state.hrAIPitchRead === type ? 'is-selected' : ''}" type="button" data-pitch="${type}" aria-label="Read ${type}">${escapeHtml(type)}</button>`).join('')}
        </div>
        <div class="hr-power-wrap">
          <span class="hr-power-label">Power — 70+ and good timing sends it out</span>
          <div class="power-track" id="hrAIPowerTrack"><i class="power-fill is-live" id="hrAIPowerFill"></i><b class="power-sweet"></b></div>
        </div>
        <div class="hr-timing-selector" id="hrAITiming" role="group" aria-label="Timing">
          <button class="secondary-button compact-action ${state.hrAITiming === 'good' ? 'is-active' : ''}" type="button" data-timing="good">Good</button>
          <button class="secondary-button compact-action ${state.hrAITiming === 'late' ? 'is-active' : ''}" type="button" data-timing="late">Late</button>
          <button class="secondary-button compact-action ${state.hrAITiming === 'early' ? 'is-active' : ''}" type="button" data-timing="early">Early</button>
        </div>
        <button class="primary-button inline-action" id="hrAISwingBtn" type="button">Swing</button>
      </div>`
  }

  let panel = stage.querySelector('.hr-panel')
  if (!panel) {
    panel = document.createElement('div')
    panel.className = 'hr-panel'
    stage.appendChild(panel)
  }
  panel.innerHTML = body

  const pitchGridEl = $('#hrAIPitchGrid')
  if (pitchGridEl && !pitchGridEl.dataset.bound) {
    pitchGridEl.dataset.bound = '1'
    pitchGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.hr-pitch-type')
      if (!btn) return
      state.hrAIPitchType = btn.dataset.pitch
      renderAIHomeRunDerby()
    })
  }
  const readGridEl = $('#hrAIReadGrid')
  if (readGridEl && !readGridEl.dataset.bound) {
    readGridEl.dataset.bound = '1'
    readGridEl.addEventListener('click', event => {
      const btn = event.target.closest('.hr-pitch-type')
      if (!btn) return
      state.hrAIPitchRead = btn.dataset.pitch
      renderAIHomeRunDerby()
    })
  }
  const timingEl = $('#hrAITiming')
  if (timingEl && !timingEl.dataset.bound) {
    timingEl.dataset.bound = '1'
    timingEl.addEventListener('click', event => {
      const btn = event.target.closest('[data-timing]')
      if (!btn) return
      state.hrAITiming = btn.dataset.timing
      renderAIHomeRunDerby()
    })
  }
  const pitchBtn = $('#hrAIPitchBtn')
  if (pitchBtn && !pitchBtn.dataset.bound) {
    pitchBtn.dataset.bound = '1'
    pitchBtn.addEventListener('click', () => {
      if (hrd.busy || hrd.phase !== 'aim') return
      hrd.busy = true
      const pitchType = state.hrAIPitchType || HR_PITCH_TYPES[0]
      const { pitchRead, power, timing } = aiHomeRunBatterPick(pitchType)
      resolveAIHomeRun(pitchRead, pitchType, power, timing)
      renderAIHomeRunDerby()
    })
  }
  const swingBtn = $('#hrAISwingBtn')
  if (swingBtn && !swingBtn.dataset.bound) {
    swingBtn.dataset.bound = '1'
    swingBtn.addEventListener('click', () => {
      if (hrd.busy || hrd.phase !== 'aim') return
      hrd.busy = true
      const pitchRead = state.hrAIPitchRead || HR_PITCH_TYPES[0]
      const power = readFkPowerPct('hrAIPowerFill', 'hrAIPowerTrack')
      const timing = state.hrAITiming || 'good'
      const { pitchType } = aiHomeRunPitcherPick()
      resolveAIHomeRun(pitchRead, pitchType, power, timing)
      renderAIHomeRunDerby()
    })
  }
  const nextBtn = $('#hrAINextRound')
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = '1'
    nextBtn.addEventListener('click', () => {
      if (hrd.over) return
      hrd.mode = hrd.mode === 'batter' ? 'pitcher' : 'batter'
      if (hrd.mode === 'batter') hrd.round += 1
      hrd.phase = 'aim'
      hrd.lastResult = null
      hrd.busy = false
      state.hrAIPitchRead = null
      state.hrAIPitchType = null
      state.hrAITiming = 'good'
      renderAIHomeRunDerby()
    })
  }
  const backBtn = $('#hrAIBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true
  const actions = $('#games .game-actions')
  if (actions) actions.hidden = true
}

// ---- Live Market Game integration -------------------------------------------

function liveMarketHelpers () {
  return window.LiveMarketGame && window.LiveMarketGame._testHelpers
}

function liveMarketDefaultOptions (gameType) {
  const cfg = window.ULTIMATE_FIT_CONFIG || {}
  if (gameType === 'next-event') return cfg.eventOptions || ['goal', 'corner', 'card', 'save']
  if (gameType === 'scoreline-lock') return cfg.scorelineLabel ? [cfg.scorelineLabel] : ['final score']
  if (gameType === 'watch-party-streak') return ['yes', 'no']
  return []
}

function liveMarketRounds (gameType) {
  if (gameType === 'watch-party-streak') return 5
  return 1
}

function buildLMSchedule (gameType, options, rounds, seed) {
  const helpers = liveMarketHelpers()
  if (helpers && helpers.buildSchedule) return helpers.buildSchedule(gameType, options, rounds, seed)
  const out = []
  for (let i = 0; i < rounds; i++) {
    const h = hashString(`${seed}|${gameType}|${i}`)
    let correct = null
    if (gameType === 'scoreline-lock') {
      const home = Math.abs(h) % 5
      const away = Math.abs(h >> 8) % 5
      correct = `${home}-${away}`
    } else if (gameType === 'watch-party-streak') {
      correct = Math.abs(h) % 2 === 0 ? 'yes' : 'no'
    } else {
      const pool = options && options.length ? options : ['goal']
      correct = pool[Math.abs(h) % pool.length]
    }
    out.push({ id: `r${i + 1}`, round: i, correct })
  }
  return out
}

function scoreLMPick (gameType, pick, correct) {
  const helpers = liveMarketHelpers()
  if (helpers && helpers.scorePick) return helpers.scorePick(gameType, pick, correct)
  if (gameType === 'scoreline-lock') {
    if (pick === correct) return { points: 3, reason: 'exact' }
    const [home, away] = String(pick).split('-').map(n => parseInt(n, 10))
    const [cHome, cAway] = String(correct).split('-').map(n => parseInt(n, 10))
    const resultClass = home > away ? 'home' : home < away ? 'away' : 'draw'
    const correctClass = cHome > cAway ? 'home' : cHome < cAway ? 'away' : 'draw'
    if (resultClass === correctClass) return { points: 1, reason: 'result-class' }
    return { points: 0, reason: 'miss' }
  }
  if (pick === correct) return { points: 1, reason: 'correct' }
  return { points: 0, reason: 'miss' }
}

function startLiveMarketPeer (code, gameType) {
  if (liveMarketUnsub) { liveMarketUnsub(); liveMarketUnsub = null }
  state.match = { peer: true, opponent: null, stake: 0, gameType }
  if (window.LiveMarketGame) {
    liveMarketUnsub = window.LiveMarketGame.onState(onLiveMarketState)
  }
  persist()
  renderGames()
}

function startLiveMarketPeerJoin (code, gameType) {
  if (liveMarketUnsub) { liveMarketUnsub(); liveMarketUnsub = null }
  state.match = { peer: true, opponent: null, stake: 0, gameType }
  if (window.LiveMarketGame) {
    window.LiveMarketGame.join(code, { gameType })
    liveMarketUnsub = window.LiveMarketGame.onState(onLiveMarketState)
  }
  persist()
  renderGames()
}

function onLiveMarketState (snapshot) {
  liveMarketSnapshot = snapshot
  if (snapshot.opp && state.match && isLiveMarketGame(state.match.gameType)) {
    state.match.opponent = { name: snapshot.opp.name || 'Opponent', team: state.team || 'br' }
  }
  if (snapshot.over && state.match) {
    state.match.over = true
  }
  if (state.view === 'games') renderGames()
}

function clearLiveMarketAI () {
  const lm = state.liveMarketGame
  if (lm && Array.isArray(lm.timers)) {
    lm.timers.forEach(t => { try { clearTimeout(t) } catch (e) {} })
  }
  state.liveMarketGame = null
}

function startLiveMarketAI (opponent, gameType) {
  clearLiveMarketAI()
  const options = liveMarketDefaultOptions(gameType)
  const rounds = liveMarketRounds(gameType)
  const seed = `ai-${hashString(opponent.name)}-${Date.now()}`
  const schedule = buildLMSchedule(gameType, options, rounds, seed)
  state.liveMarketGame = {
    ai: true,
    gameType,
    options,
    schedule,
    currentRound: 0,
    scores: { you: 0, opp: 0 },
    localPicks: {},
    aiPicks: {},
    resolved: new Set(),
    over: false,
    timers: []
  }
}

function scheduleLMAIPick (delay) {
  const lm = state.liveMarketGame
  if (!lm || lm.over) return
  const round = lm.schedule[lm.currentRound]
  if (!round) return
  const timer = setTimeout(() => {
    if (lm.over || lm.resolved.has(round.id) || lm.aiPicks[round.id] != null) return
    const correct = round.correct
    let pick = correct
    if (lm.gameType === 'scoreline-lock') {
      // Pick a same-class alternative when possible, otherwise exact.
      const [home, away] = correct.split('-').map(n => parseInt(n, 10))
      pick = home > away ? `${home + 1}-${away}` : away > home ? `${home}-${away + 1}` : '1-1'
      if (pick === correct) pick = '0-0'
    } else if (lm.gameType === 'watch-party-streak') {
      // AI occasionally disagrees to make streaks interesting.
      pick = Math.random() < 0.65 ? correct : (correct === 'yes' ? 'no' : 'yes')
    } else {
      // next-event: AI usually picks correct, sometimes a neighbor option.
      const pool = lm.options.length ? lm.options : [correct]
      pick = Math.random() < 0.6 ? correct : pool[(pool.indexOf(correct) + 1) % pool.length]
    }
    lm.aiPicks[round.id] = pick
    resolveLMAIRound(round)
  }, delay)
  lm.timers.push(timer)
}

function resolveLMAIRound (round) {
  const lm = state.liveMarketGame
  if (!lm || lm.over || lm.resolved.has(round.id)) return
  const local = lm.localPicks[round.id]
  const ai = lm.aiPicks[round.id]
  if (local == null || ai == null) return
  lm.resolved.add(round.id)
  const localResult = scoreLMPick(lm.gameType, local, round.correct)
  const aiResult = scoreLMPick(lm.gameType, ai, round.correct)
  lm.scores.you += localResult.points
  lm.scores.opp += aiResult.points
  if (lm.currentRound + 1 >= lm.schedule.length) {
    lm.over = true
    const winner = lm.scores.you > lm.scores.opp ? 'you' : lm.scores.opp > lm.scores.you ? 'opp' : null
    postSettlementReceipt({
      gameType: lm.gameType,
      you: 'you',
      scores: { you: lm.scores.you, opp: lm.scores.opp },
      winner,
      settledAt: new Date().toISOString()
    })
  } else {
    lm.currentRound += 1
  }
  if (state.view === 'games') renderGames()
}

function pickLiveMarketAI (value) {
  const lm = state.liveMarketGame
  if (!lm || lm.over) return false
  const round = lm.schedule[lm.currentRound]
  if (!round || lm.resolved.has(round.id) || lm.localPicks[round.id] != null) return false
  lm.localPicks[round.id] = value
  scheduleLMAIPick(500 + Math.floor(Math.random() * 900))
  if (state.view === 'games') renderGames()
  return true
}

function renderPeerLiveMarketGame () {
  const snap = liveMarketSnapshot
  const gameType = (state.match && state.match.gameType) || 'next-event'
  const title = miniGameTitles[gameType] || gameType
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title
  const scoreboard = $('#gameScoreboard')
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="game-player-card">
        ${avatarSvg(state.username || 'captain', teamById(state.team), true)}
        <div><span>You</span><strong>${escapeHtml(state.username || 'captain')}</strong><em>${teamById(state.team).flag} ${escapeHtml(teamById(state.team).name)}</em></div>
      </div>
      <div class="game-score-core">
        <span class="prediction-round">${snap ? `Round ${Math.min(snap.round, snap.totalRounds)} of ${snap.totalRounds}` : 'Waiting'}</span>
        <strong class="prediction-score">${snap ? snap.scores.you : 0} — ${snap ? snap.scores.opp : 0}</strong>
        <em>${snap ? snap.statusText : 'Connecting…'}</em>
      </div>
      <div class="game-player-card is-away">
        ${avatarSvg(opponent.name, teamById(opponent.team || state.team), true)}
        <div><span>Opponent</span><strong>${escapeHtml(opponent.name)}</strong></div>
      </div>`
  }

  const stage = $('#penaltyStage')
  if (stage) {
    stage.classList.add('is-placeholder')
    let body = ''
    if (!snap || !snap.started) {
      body = `
        <div class="reaction-stage is-waiting">
          <p class="eyebrow">${escapeHtml(title)}</p>
          <strong>Waiting for opponent…</strong>
          <p class="live-copy">Share the invite code so they can join.</p>
        </div>`
    } else if (snap.over) {
      const win = snap.scores.you > snap.scores.opp
      const draw = snap.scores.you === snap.scores.opp
      body = `
        <div class="reaction-stage is-over">
          <p class="eyebrow">Final score</p>
          <strong class="reaction-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
          <p class="reaction-result-score">You ${snap.scores.you} — ${snap.scores.opp} ${escapeHtml(opponent.name)}</p>
          <button class="primary-button inline-action" id="lmPeerBackToLobby" type="button">Back to lobby</button>
        </div>`
    } else {
      const round = snap.currentRound
      const roundId = round && round.id
      const localPicked = roundId != null && snap.localPicks[roundId] != null
      const remotePicked = roundId != null && snap.remotePicks[roundId] != null
      const resolved = roundId != null && snap.resolved.includes(roundId)
      body = `
        <div class="reaction-stage is-active">
          <p class="eyebrow">Round ${snap.round} of ${snap.totalRounds}</p>
          ${renderLiveMarketRoundBody(gameType, round, localPicked, remotePicked, resolved, snap.localPicks[roundId])}
        </div>`
    }
    stage.innerHTML = `<div class="reaction-challenge-stage">${body}</div>`
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true

  const backBtn = $('#lmPeerBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }
  bindLiveMarketRoundControls(gameType, 'lmPeer', false)
}

function renderAILiveMarketGame () {
  const lm = state.liveMarketGame
  if (!lm) return
  const gameType = lm.gameType
  const title = miniGameTitles[gameType] || gameType
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title
  const scoreboard = $('#gameScoreboard')
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="game-player-card">
        ${avatarSvg(state.username || 'captain', teamById(state.team), true)}
        <div><span>You</span><strong>${escapeHtml(state.username || 'captain')}</strong><em>${teamById(state.team).flag} ${escapeHtml(teamById(state.team).name)}</em></div>
      </div>
      <div class="game-score-core">
        <span class="prediction-round">Round ${Math.min(lm.currentRound + 1, lm.schedule.length)} of ${lm.schedule.length}</span>
        <strong class="prediction-score">${lm.scores.you} — ${lm.scores.opp}</strong>
        <em>${lm.over ? 'Match over' : 'Lock in your pick'}</em>
      </div>
      <div class="game-player-card is-away">
        ${avatarSvg(opponent.name, teamById(opponent.team || state.team), true)}
        <div><span>Opponent</span><strong>${escapeHtml(opponent.name)}</strong></div>
      </div>`
  }

  const stage = $('#penaltyStage')
  if (stage) {
    stage.classList.add('is-placeholder')
    let body = ''
    if (lm.over) {
      const win = lm.scores.you > lm.scores.opp
      const draw = lm.scores.you === lm.scores.opp
      body = `
        <div class="reaction-stage is-over">
          <p class="eyebrow">Final score</p>
          <strong class="reaction-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
          <p class="reaction-result-score">You ${lm.scores.you} — ${lm.scores.opp} ${escapeHtml(opponent.name)}</p>
          <button class="primary-button inline-action" id="lmAIBackToLobby" type="button">Back to lobby</button>
        </div>`
    } else {
      const round = lm.schedule[lm.currentRound]
      const localPicked = lm.localPicks[round.id] != null
      const aiPicked = lm.aiPicks[round.id] != null
      const resolved = lm.resolved.has(round.id)
      body = `
        <div class="reaction-stage is-active">
          <p class="eyebrow">Round ${lm.currentRound + 1} of ${lm.schedule.length}</p>
          ${renderLiveMarketRoundBody(gameType, round, localPicked, aiPicked, resolved, lm.localPicks[round.id])}
        </div>`
    }
    stage.innerHTML = `<div class="reaction-challenge-stage">${body}</div>`
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true

  const backBtn = $('#lmAIBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }
  bindLiveMarketRoundControls(gameType, 'lmAI', true)
}

function renderLiveMarketRoundBody (gameType, round, localPicked, opponentPicked, resolved, localValue) {
  if (!round) return '<strong>Get ready…</strong>'
  if (resolved) {
    return `<strong>Result: ${escapeHtml(String(round.correct))}</strong><p class="live-copy">${opponentPicked ? 'Opponent locked in.' : ''}</p>`
  }
  if (localPicked) {
    return `<strong>Locked: ${escapeHtml(String(localValue))}</strong><p class="live-copy">${opponentPicked ? 'Both locked — resolving…' : 'Waiting for opponent…'}</p>`
  }
  if (gameType === 'scoreline-lock') {
    return `
      <strong>Lock the scoreline</strong>
      <div class="lm-scoreline" style="display:flex;gap:12px;justify-content:center;align-items:center;margin:14px 0;">
        <input class="peer-input lm-home" id="lmHomeScore" type="number" min="0" max="9" value="0" style="width:70px;text-align:center;">
        <span>—</span>
        <input class="peer-input lm-away" id="lmAwayScore" type="number" min="0" max="9" value="0" style="width:70px;text-align:center;">
      </div>
      <button class="primary-button" id="lmLockScore" type="button">Lock scoreline</button>`
  }
  if (gameType === 'watch-party-streak') {
    return `
      <strong>${escapeHtml(String(round.correct).startsWith('Prompt') ? round.correct : 'Will it happen?')}</strong>
      <div class="lm-binary" style="display:flex;gap:12px;justify-content:center;margin:14px 0;">
        <button class="secondary-button lm-option" data-value="yes" type="button">Yes</button>
        <button class="secondary-button lm-option" data-value="no" type="button">No</button>
      </div>`
  }
  // next-event and fallback
  const options = (window.ULTIMATE_FIT_CONFIG && window.ULTIMATE_FIT_CONFIG.eventOptions) || ['goal', 'corner', 'card', 'save']
  return `
    <strong>What happens next?</strong>
    <div class="lm-options" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin:14px 0;">
      ${options.map(opt => `<button class="secondary-button lm-option" data-value="${escapeHtml(opt)}" type="button">${escapeHtml(opt)}</button>`).join('')}
    </div>`
}

function bindLiveMarketRoundControls (gameType, prefix, isAI) {
  if (gameType === 'scoreline-lock') {
    const lockBtn = $(`#${prefix}LockScore`)
    if (lockBtn && !lockBtn.dataset.bound) {
      lockBtn.dataset.bound = '1'
      lockBtn.addEventListener('click', () => {
        const home = ($(`#${prefix}HomeScore`) && $(`#${prefix}HomeScore`).value) || '0'
        const away = ($(`#${prefix}AwayScore`) && $(`#${prefix}AwayScore`).value) || '0'
        const value = `${home}-${away}`
        if (isAI) pickLiveMarketAI(value)
        else if (window.LiveMarketGame) window.LiveMarketGame.pick(value)
      })
    }
    return
  }
  const buttons = document.querySelectorAll(`.lm-option`)
  buttons.forEach(btn => {
    if (btn.dataset.bound) return
    btn.dataset.bound = '1'
    btn.addEventListener('click', () => {
      const value = btn.dataset.value
      if (isAI) pickLiveMarketAI(value)
      else if (window.LiveMarketGame) window.LiveMarketGame.pick(value)
    })
  })
}

// ---- Reaction Challenge integration -----------------------------------------

const REACTION_DEFAULT_MOMENTS = ['goal', 'save', 'penalty', 'red-card', 'VAR-overturn']
const REACTION_WINDOW_MS = 800

function reactionChallengeHelpers () {
  const rc = window.ReactionChallenge
  return rc && rc._testHelpers ? rc._testHelpers : null
}

function reactionChallengeDigest (str) {
  const Net = window.PearCupPeerNet
  if (Net && typeof Net.digest === 'function') return Net.digest(str)
  return String(hashString(str))
}

function reactionChallengeBuildSeed (peerA, peerB, nonceA, nonceB) {
  const ids = [peerA, peerB].sort()
  const nonces = [nonceA || '', nonceB || ''].sort()
  return reactionChallengeDigest(`reaction-challenge|${ids[0]}|${ids[1]}|${nonces[0]}|${nonces[1]}`)
}

function reactionChallengeBuildSchedule (seed, kinds, rounds) {
  const helpers = reactionChallengeHelpers()
  if (helpers && helpers.buildSchedule) return helpers.buildSchedule(seed, kinds, rounds)
  const pool = kinds && kinds.length ? kinds : REACTION_DEFAULT_MOMENTS
  const base = 1500
  const interval = 2000
  const out = []
  let h = seed
  for (let i = 0; i < rounds; i++) {
    h = reactionChallengeDigest(`${h}|${i}`)
    const kind = pool[parseInt(h.slice(0, 4), 16) % pool.length]
    const appearAt = base + i * interval + (parseInt(h.slice(4, 8), 16) % 500)
    out.push({ id: `r${i + 1}-${kind}`, round: i, kind, appearAt, windowMs: REACTION_WINDOW_MS })
  }
  return out
}

function reactionChallengeScoreMoment (moment, localTapTs, remoteTapTs) {
  const helpers = reactionChallengeHelpers()
  if (helpers && helpers.scoreMoment) return helpers.scoreMoment(moment, localTapTs, remoteTapTs)
  const localValid = localTapTs != null && localTapTs >= moment.appearAt && localTapTs <= moment.appearAt + moment.windowMs
  const remoteValid = remoteTapTs != null && remoteTapTs >= moment.appearAt && remoteTapTs <= moment.appearAt + moment.windowMs
  if (!localValid && !remoteValid) return { winner: null, reason: 'no-valid-tap' }
  if (localValid && !remoteValid) return { winner: 'you', reason: 'opponent-missed' }
  if (!localValid && remoteValid) return { winner: 'opp', reason: 'you-missed' }
  if (localTapTs === remoteTapTs) return { winner: null, reason: 'tie' }
  return localTapTs < remoteTapTs ? { winner: 'you', reason: 'faster' } : { winner: 'opp', reason: 'faster' }
}

function reactionChallengeInviteLink (code) {
  const hyperBase = (() => {
    try {
      const baseEl = document.querySelector('base[href]')
      const candidates = []
      if (baseEl && baseEl.href) candidates.push(baseEl.href)
      candidates.push(location.href)
      for (const href of candidates) {
        const url = new URL(href, location.href)
        if (url.protocol === 'hyper:' && url.hostname) return `hyper://${url.hostname}/`
        const match = url.pathname.match(/\/(?:app|hyper)\/([0-9a-f]{64})(?:\/|$)/i)
        if (match) return `hyper://${match[1].toLowerCase()}/`
      }
    } catch (e) {}
    return null
  })()
  if (hyperBase) return `${hyperBase}?join=${encodeURIComponent(code)}&game=reaction-challenge`
  try {
    const url = new URL(location.href)
    url.search = ''
    url.hash = ''
    url.searchParams.set('join', code)
    url.searchParams.set('game', 'reaction-challenge')
    return url.toString()
  } catch (e) {
    return `?join=${encodeURIComponent(code)}&game=reaction-challenge`
  }
}

function showReactionInviteModal (code) {
  const old = document.getElementById('peerModal')
  if (old) old.remove()
  const title = miniGameTitles['reaction-challenge'] || 'Reaction Challenge'
  const link = reactionChallengeInviteLink(code)
  const el = document.createElement('div')
  el.id = 'peerModal'
  el.className = 'peer-modal'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.innerHTML = `
    <div class="peer-modal-card">
      <p class="eyebrow">${escapeHtml(title)} · Friends</p>
      <h2 class="peer-title">Invite a friend</h2>
      <p class="peer-sub">Open the link in another window/tab, or send it to a friend. Cross-device runs on the Pear swarm.</p>
      <div class="peer-code">${escapeHtml(code)}</div>
      <div class="peer-link"><code>${escapeHtml(link)}</code></div>
      <div class="peer-actions">
        <button class="secondary-button" id="rcInviteCancel" type="button">Cancel</button>
        <button class="primary-button" id="rcInviteCopy" type="button">Copy invite link</button>
      </div>
      <p class="peer-wait"><i></i> Waiting for your friend…</p>
    </div>`
  document.body.appendChild(el)
  const close = () => { document.removeEventListener('keydown', onKey); el.remove() }
  const onKey = e => { if (e.key === 'Escape') close() }
  document.addEventListener('keydown', onKey)
  el.querySelector('#rcInviteCancel').addEventListener('click', () => { close(); leaveMatch() })
  el.querySelector('#rcInviteCopy').addEventListener('click', () => {
    if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {})
    showToast('Invite link copied')
  })
  requestAnimationFrame(() => el.classList.add('is-open'))
}

function onReactionState (snapshot) {
  reactionChallengeSnapshot = snapshot
  if (snapshot.opp && state.match && state.match.gameType === 'reaction-challenge') {
    state.match.opponent = { name: snapshot.opp.name || 'Opponent', team: state.team || 'br' }
  }
  if (!snapshot.active && state.match && state.match.gameType === 'reaction-challenge' && state.match.peer && !snapshot.over) {
    showToast('Opponent left the match')
    state.match = null
    reactionChallengeSnapshot = null
    hideOverlay()
    renderGames()
    return
  }
  if (state.view === 'games') renderGames()
}

function startReactionChallengePeer (code) {
  if (reactionChallengeUnsub) { reactionChallengeUnsub(); reactionChallengeUnsub = null }
  state.match = { peer: true, opponent: null, stake: 0, gameType: 'reaction-challenge' }
  showReactionInviteModal(code)
  if (window.ReactionChallenge) {
    reactionChallengeUnsub = window.ReactionChallenge.onState(onReactionState)
  }
  persist()
  renderGames()
}

function startReactionChallengePeerJoin (code) {
  if (reactionChallengeUnsub) { reactionChallengeUnsub(); reactionChallengeUnsub = null }
  state.match = { peer: true, opponent: null, stake: 0, gameType: 'reaction-challenge' }
  if (window.ReactionChallenge) {
    window.ReactionChallenge.join(code)
    reactionChallengeUnsub = window.ReactionChallenge.onState(onReactionState)
  }
  persist()
  renderGames()
}

function clearReactionChallengeAI () {
  const rc = state.reactionChallenge
  if (rc && Array.isArray(rc.timers)) {
    rc.timers.forEach(t => { try { clearTimeout(t) } catch (e) {} })
  }
  state.reactionChallenge = null
}

function startReactionChallengeAI (opponent) {
  clearReactionChallengeAI()
  const base = Date.now()
  const selfId = `you-${base.toString(36)}`
  const oppId = `ai-${hashString(opponent.name)}-${base.toString(36)}`
  const nonceA = `nonce-a-${base}`
  const nonceB = `nonce-b-${base}`
  const seed = reactionChallengeBuildSeed(selfId, oppId, nonceA, nonceB)
  const moments = window.ULTIMATE_FIT_CONFIG && window.ULTIMATE_FIT_CONFIG.reactionMoments
    ? window.ULTIMATE_FIT_CONFIG.reactionMoments
    : REACTION_DEFAULT_MOMENTS
  const schedule = reactionChallengeBuildSchedule(seed, moments, 5).map(m => ({ ...m, appearAt: base + m.appearAt }))
  state.reactionChallenge = {
    ai: true,
    base,
    schedule,
    currentRound: 0,
    scores: { you: 0, opp: 0 },
    localTaps: {},
    aiTaps: {},
    resolved: new Set(),
    over: false,
    timers: []
  }
  scheduleReactionChallengeAIRound(0)
}

function scheduleReactionChallengeAIRound (i) {
  const rc = state.reactionChallenge
  if (!rc || rc.over || i >= rc.schedule.length) return
  rc.currentRound = i
  const moment = rc.schedule[i]
  const now = Date.now()
  const appearDelay = Math.max(0, moment.appearAt - now)
  const resolveDelay = Math.max(0, moment.appearAt + moment.windowMs - now)
  const aiDelay = appearDelay + 150 + Math.floor(Math.random() * 400)
  rc.timers.push(setTimeout(() => { if (state.view === 'games') renderGames() }, appearDelay))
  rc.timers.push(setTimeout(() => {
    if (!rc.resolved.has(moment.id) && rc.aiTaps[moment.id] == null) {
      rc.aiTaps[moment.id] = moment.appearAt + Math.min(aiDelay - appearDelay, moment.windowMs - 10)
    }
    resolveReactionChallengeAIMoment(moment)
  }, resolveDelay))
}

function resolveReactionChallengeAIMoment (moment) {
  const rc = state.reactionChallenge
  if (!rc || rc.resolved.has(moment.id) || rc.over) return
  rc.resolved.add(moment.id)
  const result = reactionChallengeScoreMoment(moment, rc.localTaps[moment.id], rc.aiTaps[moment.id])
  if (result.winner === 'you') rc.scores.you += 1
  else if (result.winner === 'opp') rc.scores.opp += 1
  if (moment.round + 1 >= rc.schedule.length) {
    rc.over = true
    const winner = rc.scores.you > rc.scores.opp ? 'you' : rc.scores.opp > rc.scores.you ? 'opp' : null
    postSettlementReceipt({
      gameType: 'reaction-challenge',
      you: 'you',
      scores: { you: rc.scores.you, opp: rc.scores.opp },
      winner,
      settledAt: new Date().toISOString()
    })
  }
  if (state.view === 'games') renderGames()
}

function tapReactionChallengeAI (momentId) {
  const rc = state.reactionChallenge
  if (!rc || rc.over) return false
  const moment = rc.schedule.find(m => m.id === momentId)
  if (!moment || rc.resolved.has(momentId) || rc.localTaps[momentId] != null) return false
  const now = Date.now()
  if (now < moment.appearAt) return false
  rc.localTaps[momentId] = now
  if (state.view === 'games') renderGames()
  return true
}

function reactionChallengeMomentKindLabel (kind) {
  const labels = {
    goal: '⚽ Goal',
    save: '🧤 Save',
    penalty: '🥅 Penalty',
    'red-card': '🟥 Red card',
    'VAR-overturn': '📺 VAR overturn',
    buzzer: '⏰ Buzzer',
    ace: '🎾 Ace',
    homerun: '⚾ Home run'
  }
  return labels[kind] || kind
}

function renderPeerReactionChallenge () {
  const snap = reactionChallengeSnapshot
  const title = miniGameTitles['reaction-challenge'] || 'Reaction Challenge'
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title
  const scoreboard = $('#gameScoreboard')
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="game-player-card">
        ${avatarSvg(state.username || 'captain', teamById(state.team), true)}
        <div><span>You</span><strong>${escapeHtml(state.username || 'captain')}</strong><em>${teamById(state.team).flag} ${escapeHtml(teamById(state.team).name)}</em></div>
      </div>
      <div class="game-score-core">
        <span class="prediction-round">${snap ? `Round ${Math.min(snap.round, snap.totalRounds)} of ${snap.totalRounds}` : 'Waiting'}</span>
        <strong class="prediction-score">${snap ? snap.scores.you : 0} — ${snap ? snap.scores.opp : 0}</strong>
        <em>${snap ? snap.statusText : 'Connecting…'}</em>
      </div>
      <div class="game-player-card is-away">
        ${avatarSvg(opponent.name, teamById(opponent.team || state.team), true)}
        <div><span>Opponent</span><strong>${escapeHtml(opponent.name)}</strong></div>
      </div>`
  }

  const stage = $('#penaltyStage')
  if (stage) {
    stage.classList.add('is-placeholder')
    let body = ''
    if (!snap || !snap.started) {
      body = `
        <div class="reaction-stage is-waiting">
          <p class="eyebrow">${escapeHtml(title)}</p>
          <strong>Waiting for opponent…</strong>
          <p class="live-copy">Share the invite code so they can join.</p>
        </div>`
    } else if (snap.over) {
      const win = snap.scores.you > snap.scores.opp
      const draw = snap.scores.you === snap.scores.opp
      body = `
        <div class="reaction-stage is-over">
          <p class="eyebrow">Final score</p>
          <strong class="reaction-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
          <p class="reaction-result-score">You ${snap.scores.you} — ${snap.scores.opp} ${escapeHtml(opponent.name)}</p>
          <button class="primary-button inline-action" id="rcPeerBackToLobby" type="button">Back to lobby</button>
        </div>`
    } else {
      const moment = snap.currentMoment
      const now = Date.now()
      const visible = moment && now >= moment.appearAt && !snap.resolved.includes(moment.id)
      const tapped = moment && snap.localTaps[moment.id] != null
      body = `
        <div class="reaction-stage is-active">
          <p class="eyebrow">Round ${snap.round} of ${snap.totalRounds}</p>
          <strong class="reaction-moment ${visible ? 'is-visible' : ''}">${moment ? reactionChallengeMomentKindLabel(moment.kind) : 'Get ready…'}</strong>
          <p class="live-copy">${visible ? (tapped ? 'Locked in — waiting for opponent' : 'Tap the moment first!') : 'Wait for the moment…'}</p>
          <button class="primary-button reaction-tap-button ${visible && !tapped ? '' : 'is-disabled'}" id="rcPeerTap" type="button" ${visible && !tapped ? '' : 'disabled'}>
            ${tapped ? 'Locked' : 'TAP!'}
          </button>
        </div>`
    }
    stage.innerHTML = `<div class="reaction-challenge-stage">${body}</div>`
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true

  const backBtn = $('#rcPeerBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }
  const tapBtn = $('#rcPeerTap')
  if (tapBtn && !tapBtn.dataset.bound) {
    tapBtn.dataset.bound = '1'
    tapBtn.addEventListener('click', () => {
      const m = reactionChallengeSnapshot && reactionChallengeSnapshot.currentMoment
      if (m && window.ReactionChallenge) window.ReactionChallenge.tap(m.id)
    })
  }
}

function renderAIReactionChallenge () {
  const rc = state.reactionChallenge
  if (!rc) return
  const title = miniGameTitles['reaction-challenge'] || 'Reaction Challenge'
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title
  const scoreboard = $('#gameScoreboard')
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="game-player-card">
        ${avatarSvg(state.username || 'captain', teamById(state.team), true)}
        <div><span>You</span><strong>${escapeHtml(state.username || 'captain')}</strong><em>${teamById(state.team).flag} ${escapeHtml(teamById(state.team).name)}</em></div>
      </div>
      <div class="game-score-core">
        <span class="prediction-round">Round ${Math.min(rc.currentRound + 1, rc.schedule.length)} of ${rc.schedule.length}</span>
        <strong class="prediction-score">${rc.scores.you} — ${rc.scores.opp}</strong>
        <em>${rc.over ? 'Match over' : 'Fastest tap wins'}</em>
      </div>
      <div class="game-player-card is-away">
        ${avatarSvg(opponent.name, teamById(opponent.team || state.team), true)}
        <div><span>Opponent</span><strong>${escapeHtml(opponent.name)}</strong></div>
      </div>`
  }

  const stage = $('#penaltyStage')
  const moment = rc.schedule[rc.currentRound]
  const now = Date.now()
  const visible = moment && !rc.over && !rc.resolved.has(moment.id) && now >= moment.appearAt
  const tapped = moment && rc.localTaps[moment.id] != null
  if (stage) {
    stage.classList.add('is-placeholder')
    let body = ''
    if (rc.over) {
      const win = rc.scores.you > rc.scores.opp
      const draw = rc.scores.you === rc.scores.opp
      body = `
        <div class="reaction-stage is-over">
          <p class="eyebrow">Final score</p>
          <strong class="reaction-result-title">${win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'}</strong>
          <p class="reaction-result-score">You ${rc.scores.you} — ${rc.scores.opp} ${escapeHtml(opponent.name)}</p>
          <button class="primary-button inline-action" id="rcAIBackToLobby" type="button">Back to lobby</button>
        </div>`
    } else {
      body = `
        <div class="reaction-stage is-active">
          <p class="eyebrow">Round ${rc.currentRound + 1} of ${rc.schedule.length}</p>
          <strong class="reaction-moment ${visible ? 'is-visible' : ''}">${moment ? reactionChallengeMomentKindLabel(moment.kind) : 'Get ready…'}</strong>
          <p class="live-copy">${visible ? (tapped ? 'Locked in — AI is reacting' : 'Tap before the AI does!') : 'Wait for the moment…'}</p>
          <button class="primary-button reaction-tap-button ${visible && !tapped ? '' : 'is-disabled'}" id="rcAITap" type="button" ${visible && !tapped ? '' : 'disabled'}>
            ${tapped ? 'Locked' : 'TAP!'}
          </button>
        </div>`
    }
    stage.innerHTML = `<div class="reaction-challenge-stage">${body}</div>`
  }

  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true

  const backBtn = $('#rcAIBackToLobby')
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1'
    backBtn.addEventListener('click', leaveMatch)
  }
  const tapBtn = $('#rcAITap')
  if (tapBtn && !tapBtn.dataset.bound) {
    tapBtn.dataset.bound = '1'
    tapBtn.addEventListener('click', () => {
      const m = state.reactionChallenge && state.reactionChallenge.schedule[state.reactionChallenge.currentRound]
      if (m) tapReactionChallengeAI(m.id)
    })
  }
}

function renderPeerMiniGamePlaceholder (gameType) {
  if (isPlayableMiniGame(gameType)) return
  const title = miniGameTitles[gameType] || gameType
  const opponent = (state.match && state.match.opponent) || { name: 'Opponent' }
  const gamesTitle = $('#gamesTitle')
  if (gamesTitle) gamesTitle.textContent = title
  const scoreboard = $('#gameScoreboard')
  if (scoreboard) scoreboard.innerHTML = ''
  const stage = $('#penaltyStage')
  if (stage) {
    stage.classList.add('is-placeholder')
    stage.innerHTML = `
      <div class="mini-game-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:260px;text-align:center;gap:12px;">
        <p class="eyebrow">${escapeHtml(title)}</p>
        <strong style="font-size:22px;">Coming soon</strong>
        <p class="live-copy">You and ${escapeHtml(opponent.name)} are paired for <strong>${escapeHtml(title)}</strong>.<br>The commit/reveal flow is next on the roadmap.</p>
      </div>`
  }
  const hud = $('#shootoutHud')
  if (hud) hud.hidden = true
  const lower = $('#games .game-lower')
  if (lower) lower.hidden = true
  const audit = $('#games .audit-accordion')
  if (audit) audit.hidden = true
}

async function renderGames () {
  const so = ensureShootout()
  ensureShootoutDom()
  // A live peer match owns its own turn loop.
  if (state.match && state.match.peer) {
    const arena0 = document.querySelector('#games .game-arena')
    if (arena0) arena0.classList.remove('is-lobby')
    const peerGameType = state.match.gameType || 'penalty-clash'
    if (peerGameType === 'reaction-challenge') {
      renderPeerReactionChallenge()
      return null
    }
    if (peerGameType === 'trivia-duel') {
      renderPeerTriviaDuel()
      return null
    }
    if (peerGameType === 'prediction-duel') {
      renderPeerPredictionDuel()
      return null
    }
    if (peerGameType === 'free-kick-duel') {
      renderPeerFreeKickDuel()
      return null
    }
    if (peerGameType === 'buzzer-beater-duel') {
      renderPeerBuzzerBeaterDuel()
      return null
    }
    if (peerGameType === 'ace-serve-duel') {
      renderPeerAceServeDuel()
      return null
    }
    if (peerGameType === 'home-run-derby') {
      renderPeerHomeRunDerby()
      return null
    }
    if (isLiveMarketGame(peerGameType)) {
      renderPeerLiveMarketGame()
      return null
    }
    if (peerGameType !== 'penalty-clash') {
      renderPeerMiniGamePlaceholder(peerGameType)
      return null
    }
    if (window.PearCupPeerMatch && so.phase !== 'over') window.PearCupPeerMatch.render()
    return null
  }
  const arena = document.querySelector('#games .game-arena')
  if (!state.match) {
    if (arena) arena.classList.add('is-lobby')
    renderGameLobby()
    return null
  }
  if (arena) arena.classList.remove('is-lobby')
  if (state.match.gameType === 'trivia-duel') {
    renderAITriviaDuel()
    return null
  }
  if (state.match.gameType === 'prediction-duel') {
    renderAIPredictionDuel()
    return null
  }
  if (state.match.gameType === 'free-kick-duel') {
    renderAIFreeKickDuel()
    return null
  }
  if (state.match.gameType === 'buzzer-beater-duel') {
    renderAIBuzzerBeaterDuel()
    return null
  }
  if (state.match.gameType === 'ace-serve-duel') {
    renderAIAceServeDuel()
    return null
  }
  if (state.match.gameType === 'home-run-derby') {
    renderAIHomeRunDerby()
    return null
  }
  if (state.match.gameType === 'reaction-challenge') {
    renderAIReactionChallenge()
    return null
  }
  if (isLiveMarketGame(state.match.gameType)) {
    renderAILiveMarketGame()
    return null
  }
  const stage2 = $('#penaltyStage')
  if (stage2) { stage2.hidden = false; stage2.classList.remove('is-placeholder') }
  const hud2 = $('#shootoutHud')
  if (hud2) hud2.hidden = false
  const lower2 = $('#games .game-lower')
  if (lower2) lower2.hidden = false
  const audit2 = $('#games .audit-accordion')
  if (audit2) audit2.hidden = false
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

  const gl = $('#gameLeaderboard')
  if (gl) {
    if (!gameLeaderboardRows.length) {
      gl.innerHTML = `
        <div class="rail-header"><p class="eyebrow">Games</p><strong>${integrationRuntime.readiness.settlement.realMoneyEnabled ? 'Trusted results' : 'Demo results'}</strong></div>
        <div class="empty-state"><strong>${uiT('emptyLeaderboard')}</strong></div>`
    } else {
      gl.innerHTML = `
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
    }
  }
  return result
}

function remainingPicks () {
  const variant = currentPoolVariant()
  if (variant === 'side-quest') {
    const categories = awardsCategories.length ? awardsCategories : defaultSideQuestCategories()
    return categories.filter(category => !state.picks[category.id]).length
  }
  if (variant === 'confidence') {
    return bracketMatchIds.reduce((total, id) => {
      const hasWinner = !!state.picks[id]
      const hasConfidence = !!state.picks[`${id}-confidence`]
      return total + (hasWinner && hasConfidence ? 0 : 1)
    }, 0)
  }
  if (variant === 'survivor') {
    const totalRounds = 5
    const currentRound = state.survivorRound || 1
    const currentPicked = !!state.picks[`survivor-r${currentRound}`]
    return totalRounds - currentRound + (currentPicked ? 0 : 1)
  }
  if (templateKind === 'fight-card') {
    return round32Matches.reduce((total, bout) => {
      const winnerPicked = state.picks[bout.id]
      const methodPicked = state.picks[`${bout.id}-method`]
      const roundPicked = state.picks[`${bout.id}-round`]
      return total + (winnerPicked && methodPicked && roundPicked ? 0 : 1)
    }, 0)
  }
  if (templateKind === 'awards-card') return awardsCategories.filter(category => !state.picks[category.id]).length
  if (templateKind === 'round-robin') return 0
  if (templateKind === 'group-plus-knockout' && groupStages.length) {
    const groupRemaining = groupStages.reduce((total, group) =>
      total + (state.picks[groupPickKey(group.id, '1')] ? 0 : 1) + (state.picks[groupPickKey(group.id, '2')] ? 0 : 1), 0)
    const bracketRemaining = GROUP_ADVANCE_MAP.reduce((total, entry) =>
      total + (state.picks[bracketSlotKey(entry.matchId, entry.slot)] ? 0 : 1), 0)
    return groupRemaining + bracketRemaining
  }
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

  const closeShellBtn = $('#closeShellBtn')
  if (closeShellBtn) {
    closeShellBtn.addEventListener('click', () => {
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        try { window.parent.postMessage({ type: 'close-app' }, '*') } catch (e) {}
      }
    })
  }

  $('#usernameInput').addEventListener('input', event => {
    state.username = event.target.value.trim() || 'captain'
    persist()
    renderProfile()
  })

  $('#saveProfile').addEventListener('click', () => {
    completeProfileOnboarding()
  })

  const avatarInput = $('#avatarInput')
  if (avatarInput) {
    avatarInput.addEventListener('change', async event => {
      const file = event.target.files && event.target.files[0]
      event.target.value = ''
      if (!file) return
      const url = await downscaleAvatar(file)
      if (!url) { showToast('Could not read that image'); return }
      state.avatar = url
      persist()
      renderProfile()
      renderView(state.view)
      showToast('Profile photo updated')
    })
  }
  const avatarClear = $('#avatarClearBtn')
  if (avatarClear) {
    avatarClear.addEventListener('click', () => {
      state.avatar = null
      persist(); renderProfile(); renderView(state.view)
      showToast('Photo removed')
    })
  }
  const avatarExamples = $('#avatarExamples')
  if (avatarExamples) {
    avatarExamples.addEventListener('click', event => {
      const btn = event.target.closest('.avatar-example')
      if (!btn) return
      state.avatar = btn.dataset.src
      persist(); renderProfile(); renderView(state.view)
      showToast('Avatar set')
    })
  }
  sendBootCheckpoint('bindEvents:profile')

  $('#resetPicks').addEventListener('click', () => {
    resetActivePicks()
    persist()
    renderBracket()
    showToast(`${PoolVariantHelpers ? PoolVariantHelpers.variantDisplayName(currentPoolVariant()) : 'Pool'} picks cleared`)
  })

  $('#submitPicks').addEventListener('click', () => {
    const remaining = remainingPicks()
    if (remaining > 0) {
      showToast(`${remaining} picks left before this ${PoolVariantHelpers ? PoolVariantHelpers.variantDisplayName(currentPoolVariant()) : 'bracket'} is sealed`)
      return
    }
    showToast(`$${state.selectedTier} ${PoolVariantHelpers ? PoolVariantHelpers.variantDisplayName(currentPoolVariant()) : 'bracket'} submitted for ${state.username}`)
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
  const ds = document.documentElement.dataset

  return {
    uiHydrated: ds.pearcupUiHydrated || null,
    activeScreens,
    routeButtons: Array.from(document.querySelectorAll('[data-view]')).map(el => el.getAttribute('data-view')).filter(Boolean),
    teamCards: document.querySelectorAll('#teamGrid .team-card').length,
    avatarImages: avatarImages.slice(0, 4),
    profileChipReady: Boolean(document.querySelector('#profileChip svg.avatar-art')),
    peerMatchDataset: {
      state: ds.pearcupPeerMatchState || null,
      active: ds.pearcupPeerMatchActive || null,
      started: ds.pearcupPeerMatchStarted || null,
      code: ds.pearcupPeerMatchCode || null,
      role: ds.pearcupPeerMatchRole || null
    },
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
    appBootedDataset: ds.pearcupAppBooted || null,
    activeScreen: ds.pearcupActiveScreen || null,
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
    if (truthyEnv(env && env.PEARCUP_BOOT_PROBE_RUNTIME_SELF_TEST)) config.runtimeSelfTest = true
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
    ? Array.from(active.querySelectorAll('svg.avatar-art image')).map(el => el.getAttribute('href') || '').filter(Boolean).slice(0, 6)
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
    hasGamesHero: Boolean(active && active.querySelector('.lobby-hero')),
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
    generatedAvatarImages: Array.from(document.querySelectorAll('#bracket svg.avatar-art image')).map(el => el.getAttribute('href') || '').filter(Boolean).slice(0, 8)
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
    profileChipReady: Boolean(document.querySelector('#profileChip svg.avatar-art')),
    avatarPreviewReady: Boolean(avatarPreview && avatarPreview.querySelector('svg.avatar-art')),
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
      const bracketAvatars = Array.from(document.querySelectorAll('#bracket svg.avatar-art image'))
      return document.documentElement.dataset.pearcupActiveScreen === 'bracket' &&
        document.querySelectorAll('#bracketBoard .bracket-match').length >= 31 &&
        bracketAvatars.some(el => /avatars\//.test(el.getAttribute('href') || ''))
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
    if (!document.querySelector('#games .lobby-hero')) errors.push('Games lobby hero did not render')
    const gamesTiles = document.querySelectorAll('#games svg.avatar-art.retro-av')
    if (!gamesTiles.length) errors.push('Games view did not render avatar tiles')
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
  reseedLiveMatch()
  try { startWinampViz() } catch (e) {}
  bindCoreFallbackEvents()
  window.addEventListener('pearcup:p2p-backend', renderPeerBackendBadge)
  assertP2PModulesReady()
  sendBootCheckpoint('boot:p2p-ready')
  bindEvents()
  sendBootCheckpoint('boot:events-bound')
  hydrateStaticShell()
  // Defer heavy raster fit assets until they are near the viewport.
  try { if (window.LazyFitAssets) window.LazyFitAssets.observe() } catch (e) { bootIssues.push('lazy assets threw: ' + (e && e.message)) }
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
  setInterval(detectLiveRelay, 60_000)
}

function localizeChrome () {
  const map = { Profile: 'profile', Home: 'home', Bracket: 'bracket', Watch: 'watch', Games: 'games' }
  $$('.topnav button').forEach(btn => {
    const key = map[btn.textContent.trim()]
    if (key) btn.textContent = uiT(key)
  })
}

function localizeOnboardingTitle () {
  const el = $('#onboardingTitle')
  if (!el) return
  const fitId = window.CURRENT_FIT_ID || 'world-cup'
  const labels = {
    'mma-boxing-fight-card': 'Choose your fighter',
    'creator-reality-brackets': 'Choose your creator',
    'awards-prediction-pools': 'Choose your nominee'
  }
  el.textContent = labels[fitId] || 'Choose your country'
}

function hydrateStaticShell () {
  try {
    localizeOnboardingTitle()
    if ($('#teamGrid')) renderTeams()
    if ($('#profileChip') || $('#avatarPreview')) renderProfile()
    localizeChrome()
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
