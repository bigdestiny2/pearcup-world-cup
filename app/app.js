if (typeof window !== 'undefined') window.__pearcupAppScriptSeen = true

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

const PearCupCore = window.PearCupCore
if (!PearCupCore) throw new Error('PearCupCore failed to load')
const PearCupAdapters = window.PearCupAdapters
if (!PearCupAdapters) throw new Error('PearCupAdapters failed to load')
const PearCupRuntimeConfig = window.PearCupRuntimeConfig
if (!PearCupRuntimeConfig) throw new Error('PearCupRuntimeConfig failed to load')
const PearCupWorkerSim = window.PearCupWorkerSim
if (!PearCupWorkerSim) throw new Error('PearCupWorkerSim failed to load')
const PearCupWorkerClient = window.PearCupWorkerClient
if (!PearCupWorkerClient) throw new Error('PearCupWorkerClient failed to load')
const PearCupTransportSim = window.PearCupTransportSim
if (!PearCupTransportSim) throw new Error('PearCupTransportSim failed to load')
const PearCupStorageSim = window.PearCupStorageSim
if (!PearCupStorageSim) throw new Error('PearCupStorageSim failed to load')
const PearCupSettlementService = window.PearCupSettlementService
if (!PearCupSettlementService) throw new Error('PearCupSettlementService failed to load')
const integrationRuntime = PearCupRuntimeConfig.createRuntimeConfig()
const appStateEventStore = createAppStateEventStore()
const appStateClient = PearCupWorkerClient.createAutoWorkerClient({
  rootObject: window,
  local: () => PearCupWorkerClient.createLocalWorkerClient({
    runtime: integrationRuntime,
    workerFactory: PearCupWorkerSim,
    storage: appStateEventStore
  })
})
const LIVE_MATCH_ID = 'match-spain-austria'
const LIVE_HOME_TEAM_ID = 'es'
const LIVE_AWAY_TEAM_ID = 'at'
const LIVE_MATCH_SOURCE_ACTOR = 'sports-feed'
const liveMatchEventStore = createLiveMatchEventStore()
const liveMatchClient = PearCupWorkerClient.createAutoWorkerClient({
  rootObject: window,
  local: () => PearCupWorkerClient.createLocalWorkerClient({
    runtime: integrationRuntime,
    workerFactory: PearCupWorkerSim,
    storage: liveMatchEventStore
  })
})
const WATCH_MATCH_ID = 'match-es-at-r32'
const WATCH_ROOM_ID = 'room-es-at-r32'
const WATCH_STREAM_ID = 'room-es-at-r32-lina-stream'
const watchRoomEventStore = createWatchRoomEventStore()
const watchRoomClient = PearCupWorkerClient.createAutoWorkerClient({
  rootObject: window,
  local: () => PearCupWorkerClient.createLocalWorkerClient({
    runtime: integrationRuntime,
    workerFactory: PearCupWorkerSim,
    storage: watchRoomEventStore
  })
})
const GAME_SETTLEMENT_ID = 'pc-brazil-norway-room'
let bracketRenderSequence = 0
let gameRenderSequence = 0
let appStateSeedPromise = null
let liveMatchSeedPromise = null
let watchRoomSeedPromise = null

const pools = [
  { tier: 10, entrants: 124, closes: '12h', max: 256, prize: '$1,240', heat: 'Open', rail: 'USDT demo' },
  { tier: 25, entrants: 82, closes: '9h', max: 160, prize: '$2,050', heat: 'Hot', rail: 'USDT demo' },
  { tier: 50, entrants: 38, closes: '7h', max: 96, prize: '$1,900', heat: 'Sharp', rail: 'USDT demo' },
  { tier: 100, entrants: 19, closes: '5h', max: 64, prize: '$1,900', heat: 'Elite', rail: 'USDT demo' }
]

const eventTemplates = [
  {
    id: 'world-cup',
    title: 'World Cup',
    category: 'Soccer',
    entrant: 'National teams',
    template: 'Group + knockout',
    policy: 'Official feed',
    variants: ['Bracket', 'Confidence', 'Group card', 'Upset bounty'],
    games: ['Penalty Clash', 'Free-kick Duel', 'Scoreline Lock'],
    settlement: ['Demo', 'Sponsor prize'],
    priority: 'V0'
  },
  {
    id: 'champions-league',
    title: 'Champions League Knockout',
    category: 'Soccer',
    entrant: 'Clubs',
    template: 'Single elimination',
    policy: 'Official feed',
    variants: ['Bracket', 'Head-to-head', 'Confidence', 'Upset bounty'],
    games: ['Momentum Duel', 'Free-kick Duel', 'Reaction Challenge'],
    settlement: ['Demo', 'Sponsor prize'],
    priority: 'V0'
  },
  {
    id: 'march-madness',
    title: 'March Madness',
    category: 'Basketball',
    entrant: 'Seeded teams',
    template: '64-team bracket',
    policy: 'Official feed',
    variants: ['Region bracket', 'Confidence', 'Survivor', 'Upset bounty'],
    games: ['Trivia Duel', 'Player Props', 'Watch Streak'],
    settlement: ['Demo', 'Sponsor prize'],
    priority: 'V1'
  },
  {
    id: 'pro-playoffs',
    title: 'NBA / NHL / MLB Playoffs',
    category: 'Pro sports',
    entrant: 'Series teams',
    template: 'Best-of series',
    policy: 'Official feed',
    variants: ['Series bracket', 'Survivor', 'Fantasy-lite', 'Props'],
    games: ['Peer Fantasy', 'Momentum Duel', 'Live Streak'],
    settlement: ['Demo', 'Sponsor prize'],
    priority: 'V1'
  },
  {
    id: 'tennis',
    title: 'Tennis Grand Slam',
    category: 'Tennis',
    entrant: 'Seeded players',
    template: 'Draw bracket',
    policy: 'Official feed',
    variants: ['Player bracket', 'Confidence', 'Set lock', 'Props'],
    games: ['Next Game', 'Break Point', 'Reaction Challenge'],
    settlement: ['Demo', 'Sponsor prize'],
    priority: 'V1'
  },
  {
    id: 'esports',
    title: 'Esports Major',
    category: 'Esports',
    entrant: 'Teams',
    template: 'Groups + series',
    policy: 'Hybrid feed',
    variants: ['Map cards', 'Bracket', 'Survivor', 'Fantasy-lite'],
    games: ['Momentum Duel', 'Trivia Duel', 'Reaction Challenge'],
    settlement: ['Demo', 'Sponsor prize'],
    priority: 'V1'
  },
  {
    id: 'fight-card',
    title: 'MMA / Boxing Fight Card',
    category: 'Combat sports',
    entrant: 'Fighters',
    template: 'Fight card',
    policy: 'Official + host correction',
    variants: ['Method pick', 'Round prop', 'Confidence', 'Card duel'],
    games: ['Trivia Duel', 'Reaction Challenge', 'Method Lock'],
    settlement: ['Demo', 'Sponsor prize'],
    priority: 'V1'
  },
  {
    id: 'sailgp',
    title: 'SailGP Companion',
    category: 'Sailing',
    entrant: 'Fleet teams',
    template: 'Race series',
    policy: 'Hybrid evidence',
    variants: ['Race card', 'Survivor', 'Podium props', 'Fantasy-lite'],
    games: ['Next Mark', 'Pressure Window', 'Peer Fantasy'],
    settlement: ['Demo', 'Sponsor prize'],
    priority: 'V1'
  },
  {
    id: 'creator',
    title: 'Reality / Creator Tournament',
    category: 'Creator',
    entrant: 'Custom creators',
    template: 'Creator custom',
    policy: 'Host-entered',
    variants: ['Custom bracket', 'Bingo', 'Side quest', 'Confidence'],
    games: ['Trivia Duel', 'Reaction Challenge', 'Watch Streak'],
    settlement: ['Demo', 'Sponsor prize'],
    priority: 'V2'
  },
  {
    id: 'awards',
    title: 'Awards Prediction Night',
    category: 'Awards',
    entrant: 'Nominees',
    template: 'Awards card',
    policy: 'Host-entered',
    variants: ['Category card', 'Confidence', 'Bingo', 'Head-to-head'],
    games: ['Trivia Duel', 'Bingo', 'Reaction Challenge'],
    settlement: ['Demo', 'Sponsor prize'],
    priority: 'V2'
  },
  {
    id: 'local',
    title: 'School / Office / Pub League',
    category: 'Local',
    entrant: 'Custom teams',
    template: 'Round robin / bracket',
    policy: 'Host-entered',
    variants: ['Bracket', 'Round robin', 'Survivor', 'Manual results'],
    games: ['Penalty Clash', 'Trivia Duel', 'Peer Fantasy'],
    settlement: ['Demo', 'Sponsor prize'],
    priority: 'V2'
  }
]

const sportLanguageMap = [
  { sport: 'Soccer', prompts: 'goal, corner, card, VAR, first scorer', controls: 'bracket path, scoreline lock, penalty clash' },
  { sport: 'Basketball', prompts: 'next basket, three, foul, rebound swing', controls: 'region tabs, upset markers, fantasy slate' },
  { sport: 'Combat', prompts: 'round winner, takedown, knockdown, method', controls: 'bout cards, method selector, correction trail' },
  { sport: 'Sailing', prompts: 'start, mark, gate split, penalty turn', controls: 'race cards, wind panel, podium props' },
  { sport: 'Creator', prompts: 'reveal, vote swing, episode moment, finale', controls: 'custom labels, bingo, host result workbench' }
]

const creatorSteps = [
  { id: 'fit', label: 'Event fit', status: 'complete', detail: 'World Cup stack selected' },
  { id: 'entrants', label: 'Entrants', status: 'complete', detail: '32 teams seeded' },
  { id: 'format', label: 'Format', status: 'complete', detail: 'Group + knockout' },
  { id: 'pools', label: 'Pools', status: 'active', detail: '4 pool variants enabled' },
  { id: 'room', label: 'Room', status: 'active', detail: 'Watch room and prompt tray ready' },
  { id: 'settlement', label: 'Settlement', status: 'warn', detail: 'Sponsor prize gate pending' },
  { id: 'publish', label: 'Preview', status: 'next', detail: 'Command plan generated' }
]

const creatorEntrants = [
  { seed: 1, name: 'Spain', meta: 'Official feed id matched', status: 'complete' },
  { seed: 2, name: 'Austria', meta: 'Official feed id matched', status: 'complete' },
  { seed: 3, name: 'Portugal', meta: 'Kickoff lock imported', status: 'complete' },
  { seed: 4, name: 'Croatia', meta: 'Kit colors verified', status: 'complete' },
  { seed: 5, name: 'Switzerland', meta: 'Venue time pending', status: 'warn' },
  { seed: 6, name: 'Algeria', meta: 'Manual correction allowed', status: 'warn' }
]

const launchChecklistItems = [
  { label: 'Template compatibility', detail: 'Pools, games, rooms, and result policy align', status: 'complete' },
  { label: 'Entrant validation', detail: 'Seeds, display names, flags, and fixture slots ready', status: 'complete' },
  { label: 'Pick locks', detail: 'Kickoff and stale-entry behavior visible before publish', status: 'complete' },
  { label: 'QVAC lane', detail: 'Commentary and result summary can run in demo mode', status: 'complete' },
  { label: 'Sponsor prize gate', detail: 'Prize terms and fulfillment owner need approval', status: 'warn' },
  { label: 'Real-money mode', detail: 'KYC, region, WDK, and responsible-play gates stay locked', status: 'locked' }
]

const pickModes = [
  {
    id: 'bracket',
    title: 'Bracket Builder',
    status: '18 picks left',
    detail: 'Fixture columns, projected path, lock badges, owner chips, and changed-pick summary.',
    stats: ['32 teams', '5 rounds', 'Official locks'],
    elements: ['Round columns', 'Pick chips', 'Settlement receipt']
  },
  {
    id: 'confidence',
    title: 'Confidence Card',
    status: 'Budget ready',
    detail: 'Ranked point assignment with duplicate warnings and pick confidence totals.',
    stats: ['16 weights', 'No duplicates', 'Mobile steppers'],
    elements: ['Point steppers', 'Duplicate warning', 'Completion meter']
  },
  {
    id: 'survivor',
    title: 'Survivor Pool',
    status: 'Round 3 open',
    detail: 'Used-team rail, invalid-repeat blocking, and next-round availability.',
    stats: ['2 used', '1 pick due', 'Auto-lock at kickoff'],
    elements: ['Used strip', 'Round selector', 'Invalid repeat state']
  },
  {
    id: 'prediction',
    title: 'Prediction Card',
    status: '7 of 10 fields',
    detail: 'Winner, totals, method, round, category, and custom prop rows for non-bracket events.',
    stats: ['10 fields', '3 required', 'Host labels'],
    elements: ['Field rows', 'Nominee/fighter selector', 'Required markers']
  },
  {
    id: 'draft',
    title: 'Fantasy-lite Draft',
    status: '3 roster slots',
    detail: 'Compact athlete table, roster slots, stat preview, and slate lock state.',
    stats: ['8 athletes', '3 slots', 'Stat preview'],
    elements: ['Roster slots', 'Athlete table', 'Scoring preview']
  },
  {
    id: 'bingo',
    title: 'Watch-party Bingo',
    status: '2 lines possible',
    detail: 'Fixed event grid with marked moments, evidence links, and line-count resolution.',
    stats: ['3x3 grid', '4 marked', 'QVAC evidence'],
    elements: ['Bingo cells', 'Line counter', 'Moment evidence']
  }
]

const walletAccounts = [
  { label: 'Demo credits', value: '2,480', status: 'Active', tone: 'complete' },
  { label: 'Sponsor claims', value: '$190', status: 'Needs route', tone: 'warn' },
  { label: 'Real-money rail', value: 'Locked', status: 'KYC + region', tone: 'locked' }
]

const walletHolds = [
  { title: '$25 bracket pool', detail: 'Held until Spain vs Austria resolves', amount: '$25', status: 'Held' },
  { title: 'Penalty Clash', detail: 'QVAC round receipt sealed', amount: '5 USDT demo', status: 'Ready' },
  { title: 'Sponsor jersey claim', detail: 'Fulfillment address missing', amount: 'Prize', status: 'Needs route' }
]

const walletReceipts = [
  { id: 'bracket-25-r32', title: 'Bracket submission locked', hash: '0x9cf1a28b', status: 'Sealed' },
  { id: 'pc-round-3', title: 'Penalty Clash result', hash: '0x46de19a0', status: 'QVAC signed' },
  { id: 'room-watch-streak', title: 'Watch streak payout', hash: '0x7b13f0ac', status: 'Pending result' }
]

const walletReadiness = [
  { label: 'Age and region', status: 'Pending', tone: 'warn' },
  { label: 'Responsible-play limits', status: 'Configured', tone: 'complete' },
  { label: 'Tether WDK SDK', status: serviceModeLabel(integrationRuntime.readiness.tetherWdk), tone: integrationRuntime.readiness.tetherWdk.sdkReady ? 'complete' : 'warn' },
  { label: 'QVAC verifier', status: serviceModeLabel(integrationRuntime.readiness.qvac), tone: integrationRuntime.readiness.qvac.sdkReady ? 'complete' : 'warn' }
]

const opsHealthItems = [
  { label: 'Official feed lag', value: '0.4s', status: 'complete' },
  { label: 'Peer topics', value: '38 peers', status: 'complete' },
  { label: 'QVAC summaries', value: '4 languages', status: 'complete' },
  { label: 'Prize gates', value: '1 blocked', status: 'warn' }
]

const opsDisputes = [
  { title: 'Method prop correction', target: 'Fight card demo', status: 'Responded', detail: 'Host changed R2 submission to R3 decision.' },
  { title: 'Late bracket lock', target: '$50 World Cup pool', status: 'Open', detail: 'One entry arrived after feed lock timestamp.' },
  { title: 'Sponsor route missing', target: 'Jersey claim', status: 'Needs evidence', detail: 'Winner payout route is not confirmed.' }
]

const resultWorkbenchRows = [
  { event: 'Spain vs Austria', source: 'Official feed', state: 'Scheduled', action: 'Await kickoff' },
  { event: 'Creator finale', source: 'Host-entered', state: 'Missing winner', action: 'Record result' },
  { event: 'SailGP race 2', source: 'Hybrid evidence', state: 'QVAC review', action: 'Attach telemetry' }
]

const notificationBatches = [
  { title: 'Pick locks', count: 418, status: 'Queued' },
  { title: 'Room invites', count: 92, status: 'Ready' },
  { title: 'Dispute updates', count: 3, status: 'Needs review' }
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
  ['Possession', '50%', '50%', 50],
  ['Shots', '0', '0', 50],
  ['xG', '0.00', '0.00', 50],
  ['Pass accuracy', '-', '-', 50],
  ['Corners', '0', '0', 50],
  ['Saves', '0', '0', 50]
]

const leaders = [
  { user: 'lina', team: 'br', score: '12/15', prize: '$812' },
  { user: 'vera', team: 'no', score: '11/15', prize: '$410' },
  { user: 'milo', team: 'mx', score: '10/15', prize: '$190' }
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
  { user: 'vera', team: 'no', record: '3-2', trust: '98.7%' },
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

const demoOfficialMatchWinners = {
  'r32-1': 'ca',
  'r32-2': 'ma',
  'r32-3': 'br',
  'r32-4': 'no',
  'r32-5': 'py',
  'r32-6': 'fr',
  'r32-7': 'mx',
  'r32-8': 'eng',
  'r32-9': 'be',
  'r32-10': 'us',
  'r32-11': 'es',
  'r32-12': 'pt',
  'r32-13': 'ch',
  'r32-14': 'au',
  'r32-15': 'ar',
  'r32-16': 'co',
  'r16-1': 'ca',
  'r16-2': 'br',
  'r16-3': 'fr',
  'r16-4': 'eng',
  'r16-5': 'us',
  'r16-6': 'pt',
  'r16-7': 'ch',
  'r16-8': 'ar',
  'qf-1': 'br',
  'qf-2': 'fr',
  'qf-3': 'us',
  'qf-4': 'ar',
  'sf-1': 'br',
  'sf-2': 'ar',
  'final-1': 'br'
}

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
    submittedPicksByTier: {},
    language: 'EN',
    liveTab: 'overview',
    selectedEventTemplate: 'world-cup',
    creatorStep: 'pools',
    pickMode: 'bracket',
    gameRound: 0,
    gameSpectating: false,
    voice: false,
    payoutAddresses: {},
    chat: defaultChat
  }

  try {
    const saved = JSON.parse(localStorage.getItem('pearcup-prototype') || 'null')
    if (!saved) return fallback
    const merged = {
      ...fallback,
      ...saved,
      chat: saved.chat || defaultChat,
      submittedPicksByTier: normalizeSubmittedPicksByTier({ ...fallback.submittedPicksByTier, ...(saved.submittedPicksByTier || {}) }),
      payoutAddresses: { ...fallback.payoutAddresses, ...(saved.payoutAddresses || {}) }
    }
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

function normalizeSubmittedPicksByTier (submitted = {}) {
  const next = {}
  for (const [tier, picks] of Object.entries(submitted || {})) {
    next[tier] = normalizeBracketPicks(picks)
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
    workerRuntime.settleGameRoundWithReceipt = (payload, opts = {}) => worker.settleGameRoundWithReceipt(payload, {
      ...opts,
      requireLive: integrationRuntime.canUseRealMoney
    })
  }
  if (worker && typeof worker.settleBracketPoolWithReceipt === 'function') {
    workerRuntime.settleBracketPoolWithReceipt = (payload, opts = {}) => worker.settleBracketPoolWithReceipt(payload, {
      ...opts,
      requireLive: integrationRuntime.canUseRealMoney
    })
  }

  return PearCupSettlementService.createGuardedSettlementService({
    workerRuntime,
    requireLive: integrationRuntime.canUseRealMoney
  })
}

function renderSettlementError (target, err, title = 'Settlement blocked') {
  const gate = err && err.gate
  const message = err && err.message ? err.message : 'Settlement could not be prepared.'
  const missing = gate && Array.isArray(gate.missing) && gate.missing.length
    ? gate.missing.map(item => `<li>${escapeHtml(item.label)}</li>`).join('')
    : '<li>Runtime readiness is incomplete.</li>'
  target.innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header">
        <p class="eyebrow">Settlement</p>
        <strong>${escapeHtml(title)}</strong>
      </div>
      <p class="live-copy">${escapeHtml(message)}</p>
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
      <strong>38</strong>
    </div>
    <div class="signal-row">
      <span>Core lag</span>
      <strong>0.4s</strong>
    </div>
    <div class="signal-row">
      <span>QVAC lane</span>
      <strong>${serviceModeLabel(readiness.qvac)}</strong>
    </div>
    <div class="signal-row">
      <span>WDK rail</span>
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

function avatarSvg (name, team, compact = false) {
  const [primary, secondary, accent] = team.colors
  const seed = hashString(`${name}-${team.id}`)
  const skinTones = ['#f3c7a6', '#dfaa82', '#b97855', '#8d563e', '#f0c09b']
  const hairColors = ['#1f1714', '#3b2419', '#6a3d22', '#b46b2a', '#111827']
  const skin = skinTones[seed % skinTones.length]
  const skinShade = mixHex(skin, '#6f3c2c', 0.18)
  const hair = hairColors[Math.floor(seed / 3) % hairColors.length]
  const primaryDark = mixHex(primary, '#101820', 0.25)
  const primaryLight = mixHex(primary, '#ffffff', 0.22)
  const secondarySoft = mixHex(secondary, '#ffffff', 0.25)
  const accentDark = mixHex(accent, '#111827', 0.22)
  const label = escapeHtml(initials(name))
  const jerseyNumber = String((team.name.length * 7) % 90 + 10)
  const scaleClass = compact ? 'compact-avatar' : 'showcase-avatar'
  const prefix = `av-${compact ? 'sm' : 'lg'}-${team.id}-${seed}`.replace(/[^a-z0-9-]/gi, '')
  const viewBox = compact ? '42 20 136 216' : '0 0 220 260'
  const hairStyles = [
    `<path d="M68 79c2-33 21-52 45-52 23 0 40 15 44 43-15-12-33-14-51-9-15 4-27 10-38 18Z" fill="${hair}"/>`,
    `<path d="M67 75c8-32 27-48 53-43 18 4 31 17 36 38-18-10-35-12-51-7-13 4-25 8-38 12Z" fill="${hair}"/><path d="M77 50c10-12 26-18 45-15" stroke="${mixHex(hair, '#ffffff', 0.18)}" stroke-width="6" stroke-linecap="round"/>`,
    `<path d="M67 80c4-36 24-54 50-53 23 1 37 16 39 44-12-14-27-19-44-18-21 1-34 9-45 27Z" fill="${hair}"/><path d="M97 31c-8 11-10 23-5 37" stroke="${mixHex(hair, '#ffffff', 0.14)}" stroke-width="7" stroke-linecap="round"/>`,
    `<path d="M65 76c5-26 21-43 43-47 25-5 47 11 52 39-16-6-29-7-41-4-20 4-38 10-54 12Z" fill="${hair}"/><path d="M73 64c18-18 39-25 65-19" stroke="${mixHex(hair, '#ffffff', 0.16)}" stroke-width="5" stroke-linecap="round"/>`
  ]
  const stripeVariant = seed % 2 === 0
    ? `<path d="M92 120h12v72H92zM116 120h12v72h-12z" fill="${secondarySoft}" opacity="0.88"/><path d="M82 130h56" stroke="${accent}" stroke-width="5" opacity="0.78"/>`
    : `<path d="M78 190 139 118h15l-60 74Z" fill="${secondarySoft}" opacity="0.88"/><path d="M71 178 132 114" stroke="${accent}" stroke-width="6" opacity="0.78"/>`
  const figureFilter = compact ? '' : ` filter="url(#${prefix}-shadow)"`

  return `
    <svg class="avatar-art ${scaleClass}" viewBox="${viewBox}" role="img" aria-label="${escapeHtml(name)} avatar wearing ${escapeHtml(team.name)} jersey">
      <defs>
        <linearGradient id="${prefix}-card" x1="32" y1="24" x2="190" y2="236" gradientUnits="userSpaceOnUse">
          <stop stop-color="${primaryLight}"/>
          <stop offset="0.58" stop-color="${secondarySoft}"/>
          <stop offset="1" stop-color="${mixHex(accent, '#ffffff', 0.3)}"/>
        </linearGradient>
        <linearGradient id="${prefix}-kit" x1="70" y1="108" x2="154" y2="202" gradientUnits="userSpaceOnUse">
          <stop stop-color="${primaryLight}"/>
          <stop offset="0.5" stop-color="${primary}"/>
          <stop offset="1" stop-color="${primaryDark}"/>
        </linearGradient>
        <linearGradient id="${prefix}-skin" x1="78" y1="56" x2="141" y2="117" gradientUnits="userSpaceOnUse">
          <stop stop-color="${mixHex(skin, '#ffffff', 0.25)}"/>
          <stop offset="1" stop-color="${skinShade}"/>
        </linearGradient>
        <clipPath id="${prefix}-torso">
          <path d="M66 114c12-12 28-18 45-18 18 0 34 6 46 18l-13 88H79L66 114Z"/>
        </clipPath>
        <filter id="${prefix}-shadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#111827" flood-opacity="0.22"/>
        </filter>
      </defs>
      <rect x="23" y="18" width="174" height="218" rx="39" fill="url(#${prefix}-card)" opacity="0.34"/>
      <path d="M43 70c30-25 72-34 120-25 13 27 15 79 4 139-36 22-76 28-119 18C35 154 33 111 43 70Z" fill="#ffffff" opacity="0.22"/>
      <ellipse cx="110" cy="224" rx="61" ry="12" fill="#0f172a" opacity="0.18"/>
      <g class="avatar-figure"${figureFilter}>
        <path d="M80 183h23v36H80zM117 183h23v36h-23z" fill="${primaryDark}"/>
        <path d="M78 214h29v12H73c0-6 2-9 5-12ZM116 214h29c4 3 6 6 6 12h-35Z" fill="#15191f"/>
        <path d="M79 183h24v13H79zM117 183h23v13h-23z" fill="${secondarySoft}"/>
        <path d="M77 161h66l-4 31H82Z" fill="${accentDark}"/>
        <path d="M48 124c6-14 16-24 31-31l9 22c-11 6-18 14-22 25l-9 24-23-7 14-33Z" fill="${skin}"/>
        <path d="M172 124c-6-14-16-24-31-31l-9 22c11 6 18 14 22 25l9 24 23-7-14-33Z" fill="${skin}"/>
        <path d="M55 118c10-12 23-19 38-23l9 26c-15 3-25 10-31 20Z" fill="url(#${prefix}-kit)"/>
        <path d="M165 118c-10-12-23-19-38-23l-9 26c15 3 25 10 31 20Z" fill="url(#${prefix}-kit)"/>
        <path d="M66 114c12-12 28-18 45-18 18 0 34 6 46 18l-13 88H79L66 114Z" fill="url(#${prefix}-kit)" stroke="${mixHex(primaryDark, '#ffffff', 0.12)}" stroke-width="1.5"/>
        <g clip-path="url(#${prefix}-torso)">
          ${stripeVariant}
          <path d="M66 114c15 10 30 15 45 15s30-5 46-15v18c-15 11-30 16-46 16s-31-5-45-16Z" fill="#ffffff" opacity="0.13"/>
          <path d="M70 116h80" stroke="#ffffff" stroke-width="2" opacity="0.28"/>
        </g>
        <path d="M92 99h38l-8 17h-22Z" fill="${accent}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>
        <path d="M97 97c2 10 7 16 14 16 8 0 13-6 15-16" fill="none" stroke="${secondarySoft}" stroke-width="5" stroke-linecap="round"/>
        <path d="M129 130l13 4v16l-13-3Z" fill="#ffffff" opacity="0.9"/>
        <text x="135.5" y="144.5" text-anchor="middle" font-size="13" font-weight="800" font-family="Arial, sans-serif">${team.flag}</text>
        <text x="110" y="162" text-anchor="middle" font-size="31" font-weight="900" fill="#ffffff" stroke="${mixHex(primaryDark, '#000000', 0.18)}" stroke-width="1.4" paint-order="stroke" font-family="Arial, sans-serif">${label}</text>
        <text x="110" y="184" text-anchor="middle" font-size="18" font-weight="900" fill="#ffffff" font-family="Arial, sans-serif">${jerseyNumber}</text>
        <path d="M100 87h22v22c-4 4-8 6-12 6-4 0-7-2-10-6Z" fill="${skinShade}"/>
        <circle cx="77" cy="85" r="11" fill="url(#${prefix}-skin)"/>
        <circle cx="143" cy="85" r="11" fill="url(#${prefix}-skin)"/>
        <circle cx="110" cy="77" r="39" fill="url(#${prefix}-skin)"/>
        ${hairStyles[seed % hairStyles.length]}
        <path d="M70 81c5-7 12-11 20-13 9-2 15-5 19-10 11 8 26 11 45 10-3-25-20-40-44-40-25 0-42 18-40 53Z" fill="${hair}" opacity="0.92"/>
        <path d="M92 82c4-4 9-4 14 0M118 82c4-4 9-4 14 0" stroke="${mixHex(hair, '#000000', 0.25)}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="98" cy="91" r="4" fill="#151515"/>
        <circle cx="124" cy="91" r="4" fill="#151515"/>
        <circle cx="99.5" cy="89.5" r="1.2" fill="#ffffff"/>
        <circle cx="125.5" cy="89.5" r="1.2" fill="#ffffff"/>
        <path d="M109 91l-4 15h9" stroke="${mixHex(skinShade, '#542c24', 0.22)}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M96 113c9 8 21 8 30 0" stroke="#7a342e" stroke-width="5" stroke-linecap="round" fill="none"/>
        <circle cx="86" cy="105" r="6" fill="${mixHex(skin, '#f06374', 0.24)}" opacity="0.55"/>
        <circle cx="135" cy="105" r="6" fill="${mixHex(skin, '#f06374', 0.24)}" opacity="0.55"/>
      </g>
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

function setView (view, { focus = true } = {}) {
  if (!document.getElementById(view)) view = 'home'
  state.view = view
  persist()
  $$('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === view))
  $$('.topnav button').forEach(button => {
    button.classList.toggle('is-active', button.dataset.view === view)
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  })
  if (view === 'bracket') scheduleBracketConnectors()
  if (view === 'games') renderGames()
  resetScrollPosition()
  if (focus) {
    requestAnimationFrame(() => {
      const activeScreen = document.getElementById(view)
      const heading = activeScreen && activeScreen.querySelector('h1, h2')
      if (!heading) return
      heading.setAttribute('tabindex', '-1')
      heading.focus({ preventScroll: true })
    })
  }
}

function renderProfile () {
  const profile = currentProfilePayload()
  const team = teamById(profile.teamId)
  const name = profile.username || 'captain'

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

function renderHomeDashboard () {
  ensureLiveMatchSeeded()
  const activeTab = liveTabs.some(tab => tab.id === state.liveTab) ? state.liveTab : 'overview'
  state.liveTab = activeTab

  $('#liveMenu').innerHTML = liveTabs.map(tab => `
    <button type="button" role="tab" class="${tab.id === activeTab ? 'is-active' : ''}" data-live-tab="${tab.id}" aria-selected="${tab.id === activeTab ? 'true' : 'false'}">
      ${tab.label}
    </button>
  `).join('')

  $('#liveDetail').innerHTML = renderLivePanel(activeTab)

  $('#homeFixtures').innerHTML = homeFixtures.map(fixture => `
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

function renderLivePanel (tab) {
  if (tab === 'stats') {
    return `
      <div class="live-stat-grid">
        ${liveMatchStatRows().map(([label, home, away, share]) => `
          <article class="live-stat-card">
            <span>${label}</span>
            <div class="split-stat">
              <strong>${home}</strong>
              <em>${away}</em>
            </div>
            <div class="meter"><i style="width:${share}%"></i></div>
          </article>
        `).join('')}
      </div>
    `
  }

  if (tab === 'rooms') {
    return `
      <div class="room-dashboard">
        <article class="live-card room-card">
          <div class="rail-header">
            <p class="eyebrow">Main room</p>
            <strong>38 peers</strong>
          </div>
          <div class="room-preview-avatars">
            ${['captain', 'lina', 'vera', 'milo'].map((name, index) => avatarSvg(name, teamById(['es', 'es', 'at', 'pt'][index]), true)).join('')}
          </div>
          <button class="primary-button" type="button" data-view="watch">
            <span class="button-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7Z"/></svg>
            </span>
            Join live
          </button>
        </article>
        <article class="live-card">
          <div class="metric-list">
            <div><span>Voice</span><strong>12 live</strong></div>
            <div><span>Stream host</span><strong>lina</strong></div>
            <div><span>Chat/min</span><strong>42</strong></div>
          </div>
        </article>
      </div>
    `
  }

  if (tab === 'qvac') {
    const lines = liveCommentaryLines(state.language)
    const stats = liveMatchStats()
    const liveView = liveMatchView()
    const matchEventCount = (liveView.matchEventsByMatch && liveView.matchEventsByMatch[LIVE_MATCH_ID] || []).length
    const languageCount = Object.keys(liveView.commentaryByMatchLanguage || {}).length || 1
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
          <p class="live-copy">${escapeHtml(lines[lines.length - 1] && lines[lines.length - 1][1] || 'Live event stream is being summarized into commentary, pool impact, and match momentum.')}</p>
        </article>
        <article class="live-card">
          <div class="metric-list">
            <div><span>Stat root</span><strong>${stats ? stats.statHash.slice(0, 8) : 'pending'}</strong></div>
            <div><span>Events parsed</span><strong>${matchEventCount}</strong></div>
            <div><span>Languages</span><strong>${languageCount}</strong></div>
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

  return `
    <div class="overview-dashboard">
      <article class="live-card momentum-card">
        <div class="rail-header">
          <p class="eyebrow">Momentum</p>
          <strong>Spain vs Austria</strong>
        </div>
        <div class="momentum-track">
          <i style="left:18%;height:42%"></i>
          <i style="left:34%;height:66%"></i>
          <i style="left:51%;height:52%"></i>
          <i style="left:69%;height:78%"></i>
          <i style="left:84%;height:38%"></i>
        </div>
      </article>
      <article class="live-card timeline-card">
        <div class="rail-header">
          <p class="eyebrow">Timeline</p>
          <strong>Latest</strong>
        </div>
        <div class="timeline-list">
          ${(liveMatchTimelineItems().length ? liveMatchTimelineItems() : [
            { clock: 'Today', text: 'Spain vs Austria room is open.' },
            { clock: '19:00Z', text: 'Kickoff at SoFi Stadium.' },
            { clock: 'R32', text: 'Portugal vs Croatia and Switzerland vs Algeria follow later today.' }
          ]).map(item => `<div><time>${escapeHtml(item.clock)}</time><span>${escapeHtml(item.text)}</span></div>`).join('')}
        </div>
      </article>
      <article class="live-card impact-card">
        <div class="rail-header">
          <p class="eyebrow">Pool impact</p>
          <strong>3 open</strong>
        </div>
        <p class="live-copy">Today's Round of 32 rooms are Spain/Austria, Portugal/Croatia, and Switzerland/Algeria. Scores stay blank until the feed or host relay updates them.</p>
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
      renderAll()
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
      state.picks = clonePicks(displayedPicksForTier(state.selectedTier))
      persist()
      renderBracket()
      setView('bracket')
    })
  })
}

function selectedEventTemplate () {
  const selected = eventTemplates.find(template => template.id === state.selectedEventTemplate)
  return selected || eventTemplates[0]
}

function selectedPickMode () {
  const selected = pickModes.find(mode => mode.id === state.pickMode)
  return selected || pickModes[0]
}

function statusClass (status) {
  if (status === 'complete' || status === 'Active' || status === 'Ready' || status === 'Sealed' || status === 'QVAC signed') return 'is-complete'
  if (status === 'locked' || status === 'Locked') return 'is-locked'
  return 'is-warn'
}

function renderTagList (items, className = 'surface-tags') {
  return `
    <div class="${className}">
      ${items.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
    </div>
  `
}

function renderDiscover () {
  const selected = selectedEventTemplate()
  state.selectedEventTemplate = selected.id

  $('#eventTemplateGrid').innerHTML = eventTemplates.map(template => `
    <article class="template-card ${template.id === selected.id ? 'is-selected' : ''}">
      <div class="template-card-top">
        <div>
          <span class="surface-badge">${escapeHtml(template.priority)}</span>
          <h2>${escapeHtml(template.title)}</h2>
        </div>
        <button class="icon-button" type="button" data-template="${escapeHtml(template.id)}" aria-label="Inspect ${escapeHtml(template.title)}">
          <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </div>
      <div class="template-facts">
        <div><span>Category</span><strong>${escapeHtml(template.category)}</strong></div>
        <div><span>Template</span><strong>${escapeHtml(template.template)}</strong></div>
        <div><span>Results</span><strong>${escapeHtml(template.policy)}</strong></div>
      </div>
      ${renderTagList(template.variants.slice(0, 4))}
    </article>
  `).join('')

  $('#templateStackPanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Stack preview</p>
      <strong>${escapeHtml(selected.category)}</strong>
    </div>
    <div class="stack-hero">
      <span>${escapeHtml(selected.priority)}</span>
      <h2>${escapeHtml(selected.title)}</h2>
      <p>${escapeHtml(selected.template)} for ${escapeHtml(selected.entrant.toLowerCase())}, with ${escapeHtml(selected.policy.toLowerCase())} result handling.</p>
    </div>
    <div class="surface-block">
      <span>Pool variants</span>
      ${renderTagList(selected.variants)}
    </div>
    <div class="surface-block">
      <span>Live games</span>
      ${renderTagList(selected.games)}
    </div>
    <div class="surface-block">
      <span>Settlement modes</span>
      ${renderTagList(selected.settlement)}
    </div>
    <button class="primary-button inline-action" type="button" data-view="creator">
      <span class="button-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
      </span>
      Configure ${escapeHtml(selected.category)}
    </button>
  `

  $('#sportLanguagePanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">UX language</p>
      <strong>Sport-specific controls</strong>
    </div>
    <div class="language-map">
      ${sportLanguageMap.map(row => `
        <div>
          <strong>${escapeHtml(row.sport)}</strong>
          <span>${escapeHtml(row.prompts)}</span>
          <em>${escapeHtml(row.controls)}</em>
        </div>
      `).join('')}
    </div>
  `

  $$('#eventTemplateGrid [data-template]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedEventTemplate = button.dataset.template
      persist()
      renderDiscover()
    })
  })
  bindViewButtons($('#discover'))
}

function renderCreator () {
  const selected = selectedEventTemplate()
  const activeStep = creatorSteps.some(step => step.id === state.creatorStep) ? state.creatorStep : 'pools'
  state.creatorStep = activeStep

  $('#creatorSteps').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Wizard</p>
      <strong>Launch flow</strong>
    </div>
    <div class="step-list">
      ${creatorSteps.map((step, index) => `
        <button class="${step.id === activeStep ? 'is-active' : ''} ${statusClass(step.status)}" type="button" data-creator-step="${escapeHtml(step.id)}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(step.label)}</strong>
          <em>${escapeHtml(step.detail)}</em>
        </button>
      `).join('')}
    </div>
  `

  $('#creatorStackPreview').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Launch preview</p>
      <strong>${escapeHtml(selected.title)}</strong>
    </div>
    <div class="creator-stack-grid">
      <div>
        <span>Event fit</span>
        <strong>${escapeHtml(selected.template)}</strong>
        <em>${escapeHtml(selected.policy)}</em>
      </div>
      <div>
        <span>Pools</span>
        <strong>${selected.variants.length} variants</strong>
        <em>${escapeHtml(selected.variants.slice(0, 3).join(', '))}</em>
      </div>
      <div>
        <span>Live room</span>
        <strong>${selected.games.length} prompts</strong>
        <em>${escapeHtml(selected.games.slice(0, 3).join(', '))}</em>
      </div>
      <div>
        <span>Settlement</span>
        <strong>${escapeHtml(selected.settlement.join(' / '))}</strong>
        <em>Real-money remains gated</em>
      </div>
    </div>
  `

  $('#entrantWorkbench').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Entrants</p>
      <strong>Validation table</strong>
    </div>
    <div class="entrant-table">
      ${creatorEntrants.map(row => `
        <div class="${statusClass(row.status)}">
          <span>${row.seed}</span>
          <strong>${escapeHtml(row.name)}</strong>
          <em>${escapeHtml(row.meta)}</em>
        </div>
      `).join('')}
    </div>
  `

  $('#launchChecklist').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Publish checklist</p>
      <strong>Replayable commands</strong>
    </div>
    <div class="checklist-grid">
      ${launchChecklistItems.map(item => `
        <div class="${statusClass(item.status)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.status)}</strong>
          <em>${escapeHtml(item.detail)}</em>
        </div>
      `).join('')}
    </div>
    <button class="secondary-button inline-action" type="button" id="publishDraftPreview">
      <span class="button-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M5 12l4 4L19 6"/></svg>
      </span>
      Seal preview
    </button>
  `

  $$('#creatorSteps [data-creator-step]').forEach(button => {
    button.addEventListener('click', () => {
      state.creatorStep = button.dataset.creatorStep
      persist()
      renderCreator()
    })
  })
  const previewButton = $('#publishDraftPreview')
  if (previewButton) previewButton.addEventListener('click', () => showToast('Launch preview sealed as a demo command plan'))
  bindViewButtons($('#creator'))
}

function renderPickPreview (mode) {
  if (mode.id === 'confidence') {
    return `
      <div class="confidence-preview">
        ${[16, 15, 14, 13, 12, 11].map((points, index) => `
          <div>
            <span>${points}</span>
            <strong>${escapeHtml(['Spain', 'Portugal', 'Brazil', 'France', 'Argentina', 'Japan'][index])}</strong>
            <em>${index === 2 ? 'Duplicate blocked' : 'Ready'}</em>
          </div>
        `).join('')}
      </div>
    `
  }

  if (mode.id === 'survivor') {
    return `
      <div class="survivor-preview">
        ${['Brazil', 'France', 'Spain', 'Portugal', 'Japan'].map((team, index) => `
          <button type="button" class="${index < 2 ? 'is-used' : index === 2 ? 'is-picked' : ''}">
            <span>${index < 2 ? 'Used' : index === 2 ? 'Pick' : 'Available'}</span>
            <strong>${escapeHtml(team)}</strong>
          </button>
        `).join('')}
      </div>
    `
  }

  if (mode.id === 'prediction') {
    return `
      <div class="card-preview">
        ${['Winner', 'Method / margin', 'Round / period', 'Total score', 'Upset call'].map((field, index) => `
          <label>
            <span>${escapeHtml(field)}</span>
            <input value="${escapeHtml(['Spain', '2-1', '90 min', '3 goals', 'No'][index])}" readonly>
          </label>
        `).join('')}
      </div>
    `
  }

  if (mode.id === 'draft') {
    return `
      <div class="draft-preview">
        <div class="roster-slots"><span>FWD</span><span>MID</span><span>GK</span></div>
        ${['Lina Torres', 'Vera Holm', 'Milo Costa', 'Amina Diallo'].map((player, index) => `
          <div>
            <strong>${escapeHtml(player)}</strong>
            <span>${['xG + shots', 'saves', 'assists', 'tackles'][index]}</span>
            <em>${[42, 36, 31, 28][index]} pts</em>
          </div>
        `).join('')}
      </div>
    `
  }

  if (mode.id === 'bingo') {
    return `
      <div class="bingo-preview">
        ${['Goal', 'VAR', 'Corner', 'Save', 'Upset', 'Card', 'Sub', 'Streak', 'Penalty'].map((cell, index) => `
          <span class="${[0, 2, 4, 8].includes(index) ? 'is-marked' : ''}">${escapeHtml(cell)}</span>
        `).join('')}
      </div>
    `
  }

  return `
    <div class="bracket-preview-mini">
      ${['R32', 'R16', 'QF', 'SF', 'Final'].map((round, roundIndex) => `
        <div>
          <strong>${round}</strong>
          ${Array.from({ length: Math.max(1, 4 - roundIndex) }).map((_, index) => `<span>${escapeHtml(['Spain', 'Brazil', 'France', 'Japan'][index] || 'TBD')}</span>`).join('')}
        </div>
      `).join('')}
    </div>
  `
}

function renderPicksWorkbench () {
  const selected = selectedPickMode()
  state.pickMode = selected.id

  $('#pickModeGrid').innerHTML = pickModes.map(mode => `
    <button class="pick-mode-card ${mode.id === selected.id ? 'is-selected' : ''}" type="button" data-pick-mode="${escapeHtml(mode.id)}">
      <span>${escapeHtml(mode.status)}</span>
      <strong>${escapeHtml(mode.title)}</strong>
      <em>${escapeHtml(mode.detail)}</em>
    </button>
  `).join('')

  $('#pickDetailPanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Workbench</p>
      <strong>${escapeHtml(selected.title)}</strong>
    </div>
    <div class="pick-detail-grid">
      <div>
        <span>Status</span>
        <strong>${escapeHtml(selected.status)}</strong>
        <em>${escapeHtml(selected.detail)}</em>
      </div>
      ${selected.stats.map(stat => `
        <div>
          <span>Signal</span>
          <strong>${escapeHtml(stat)}</strong>
          <em>Visible before lock</em>
        </div>
      `).join('')}
    </div>
    ${renderPickPreview(selected)}
    <div class="surface-block">
      <span>Required UI elements</span>
      ${renderTagList(selected.elements)}
    </div>
  `

  $$('#pickModeGrid [data-pick-mode]').forEach(button => {
    button.addEventListener('click', () => {
      state.pickMode = button.dataset.pickMode
      persist()
      renderPicksWorkbench()
    })
  })
  bindViewButtons($('#picks'))
}

function renderWallet () {
  $('#walletSummary').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Accounts</p>
      <strong>${integrationRuntime.canUseRealMoney ? 'Live-ready' : 'Demo safe'}</strong>
    </div>
    <div class="wallet-account-grid">
      ${walletAccounts.map(account => `
        <div class="${statusClass(account.tone)}">
          <span>${escapeHtml(account.label)}</span>
          <strong>${escapeHtml(account.value)}</strong>
          <em>${escapeHtml(account.status)}</em>
        </div>
      `).join('')}
    </div>
  `

  $('#walletHolds').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Holds</p>
      <strong>Claims and releases</strong>
    </div>
    <div class="wallet-list">
      ${walletHolds.map(item => `
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.detail)}</span>
          <em>${escapeHtml(item.amount)} - ${escapeHtml(item.status)}</em>
        </div>
      `).join('')}
    </div>
  `

  $('#walletReceipts').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Receipts</p>
      <strong>Evidence trail</strong>
    </div>
    <div class="wallet-list">
      ${walletReceipts.map(item => `
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.id)}</span>
          <code>${escapeHtml(item.hash)}</code>
          <em>${escapeHtml(item.status)}</em>
        </div>
      `).join('')}
    </div>
  `

  $('#walletReadiness').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Readiness</p>
      <strong>Real-money gates</strong>
    </div>
    <div class="status-list">
      ${walletReadiness.map(item => `
        <div class="${statusClass(item.tone)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.status)}</strong>
        </div>
      `).join('')}
    </div>
  `
}

function renderOps () {
  $('#opsHealth').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Health</p>
      <strong>Live event system</strong>
    </div>
    <div class="ops-health-grid">
      ${opsHealthItems.map(item => `
        <div class="${statusClass(item.status)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `).join('')}
    </div>
  `

  $('#opsDisputes').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Disputes</p>
      <strong>Review queue</strong>
    </div>
    <div class="ops-list">
      ${opsDisputes.map(item => `
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.target)}</span>
          <em>${escapeHtml(item.status)} - ${escapeHtml(item.detail)}</em>
        </div>
      `).join('')}
    </div>
  `

  $('#opsResults').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Results</p>
      <strong>Workbench</strong>
    </div>
    <div class="result-table">
      ${resultWorkbenchRows.map(row => `
        <div>
          <strong>${escapeHtml(row.event)}</strong>
          <span>${escapeHtml(row.source)}</span>
          <em>${escapeHtml(row.state)}</em>
          <button class="secondary-button compact-action" type="button">${escapeHtml(row.action)}</button>
        </div>
      `).join('')}
    </div>
  `

  $('#opsNotifications').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Notifications</p>
      <strong>Batch ops</strong>
    </div>
    <div class="notification-grid">
      ${notificationBatches.map(batch => `
        <div>
          <span>${escapeHtml(batch.title)}</span>
          <strong>${batch.count}</strong>
          <em>${escapeHtml(batch.status)}</em>
        </div>
      `).join('')}
    </div>
  `
}

function appStateNamespace () {
  return 'app-state/profile-brackets/events'
}

function createAppStateEventStore () {
  let backend = null
  try {
    const probeKey = 'pearcup-app-state-probe'
    localStorage.setItem(probeKey, '1')
    localStorage.removeItem(probeKey)
    backend = PearCupStorageSim.createLocalStorageBackend({ prefix: 'pearcup-app-state-storage' })
  } catch {
    backend = PearCupStorageSim.createMemoryBackend()
  }
  return PearCupStorageSim.createEventStore({
    backend,
    rootId: 'pearcup-demo',
    namespace: appStateNamespace()
  })
}

function liveMatchNamespace (matchId = LIVE_MATCH_ID) {
  return `matches/${matchId}/events`
}

function createLiveMatchEventStore () {
  let backend = null
  try {
    const probeKey = 'pearcup-live-match-probe'
    localStorage.setItem(probeKey, '1')
    localStorage.removeItem(probeKey)
    backend = PearCupStorageSim.createLocalStorageBackend({ prefix: 'pearcup-live-match-storage' })
  } catch {
    backend = PearCupStorageSim.createMemoryBackend()
  }
  return PearCupStorageSim.createEventStore({
    backend,
    rootId: 'pearcup-demo',
    namespace: liveMatchNamespace()
  })
}

function watchRoomNamespace (roomId = WATCH_ROOM_ID) {
  return `rooms/${roomId}/events`
}

function createWatchRoomEventStore () {
  let backend = null
  try {
    const probeKey = 'pearcup-watch-room-probe'
    localStorage.setItem(probeKey, '1')
    localStorage.removeItem(probeKey)
    backend = PearCupStorageSim.createLocalStorageBackend({ prefix: 'pearcup-watch-room-storage' })
  } catch {
    backend = PearCupStorageSim.createMemoryBackend()
  }
  return PearCupStorageSim.createEventStore({
    backend,
    rootId: 'pearcup-demo',
    namespace: watchRoomNamespace()
  })
}

function gameSettlementNamespace (gameId = GAME_SETTLEMENT_ID) {
  return PearCupStorageSim.gameNamespace(gameId)
}

function createGameSettlementEventStore (gameId = GAME_SETTLEMENT_ID) {
  let backend = null
  try {
    const probeKey = `pearcup-game-settlement-${gameId}-probe`
    localStorage.setItem(probeKey, '1')
    localStorage.removeItem(probeKey)
    backend = PearCupStorageSim.createLocalStorageBackend({ prefix: 'pearcup-game-settlement-storage' })
  } catch {
    backend = PearCupStorageSim.createMemoryBackend()
  }
  return PearCupStorageSim.createEventStore({
    backend,
    rootId: 'pearcup-demo',
    namespace: gameSettlementNamespace(gameId)
  })
}

function poolNamespace (poolId) {
  return `pools/${poolId}/wdk-events`
}

function bracketPoolId (tier = state.selectedTier) {
  return `world-cup-${tier}`
}

function currentUserId () {
  return gameUserId(state.username || 'captain')
}

function appStateView () {
  return appStateClient.view() || PearCupWorkerClient.emptyView()
}

function profileForUser (userId = currentUserId()) {
  const view = appStateView()
  return view.profiles && view.profiles[userId] || null
}

function currentProfilePayload () {
  const userId = currentUserId()
  const profile = profileForUser(userId)
  return {
    userId,
    username: state.username || profile && profile.username || 'captain',
    teamId: state.team || profile && profile.teamId || 'br'
  }
}

async function dispatchAppStateCommand (command, { rerender = false, toastError = true } = {}) {
  try {
    const event = await appStateClient.dispatchAsync(command)
    if (typeof appStateClient.refresh === 'function') await appStateClient.refresh()
    if (rerender) renderAll()
    return event
  } catch (err) {
    if (toastError) showToast(err.message || 'App state sync failed')
    return null
  }
}

function profileUpdateCommand () {
  const profile = currentProfilePayload()
  return {
    type: 'profile:set',
    actorId: profile.userId,
    payload: profile
  }
}

function bracketDraftForTier (tier = state.selectedTier) {
  const view = appStateView()
  const poolId = bracketPoolId(tier)
  return view.bracketDraftsByPool &&
    view.bracketDraftsByPool[poolId] &&
    view.bracketDraftsByPool[poolId][currentUserId()] ||
    null
}

function bracketSubmissionForTier (tier = state.selectedTier) {
  const view = appStateView()
  const poolId = bracketPoolId(tier)
  return view.bracketSubmissionsByPool &&
    view.bracketSubmissionsByPool[poolId] &&
    view.bracketSubmissionsByPool[poolId][currentUserId()] ||
    null
}

function bracketDraftCommand ({ tier = state.selectedTier, picks = state.picks } = {}) {
  const profile = currentProfilePayload()
  return {
    type: 'bracket:updateDraft',
    actorId: profile.userId,
    payload: {
      poolId: bracketPoolId(tier),
      userId: profile.userId,
      username: profile.username,
      teamId: profile.teamId,
      picks: clonePicks(picks),
      rulesVersion: 'bracket-pool-v1'
    }
  }
}

function bracketResetDraftCommand (tier = state.selectedTier) {
  const profile = currentProfilePayload()
  return {
    type: 'bracket:resetDraft',
    actorId: profile.userId,
    payload: {
      poolId: bracketPoolId(tier),
      userId: profile.userId,
      username: profile.username,
      teamId: profile.teamId,
      picks: {},
      rulesVersion: 'bracket-pool-v1'
    }
  }
}

function bracketSubmitCommand ({ tier = state.selectedTier, picks = displayedPicksForTier(tier) } = {}) {
  const profile = currentProfilePayload()
  const poolId = bracketPoolId(tier)
  return {
    type: 'bracket:submit',
    actorId: profile.userId,
    payload: {
      poolId,
      entryId: `${poolId}-${profile.userId}`,
      userId: profile.userId,
      username: profile.username,
      picks: clonePicks(picks),
      rulesVersion: 'bracket-pool-v1'
    }
  }
}

function appStateNeedsSeed () {
  const profile = currentProfilePayload()
  return !profileForUser(profile.userId) ||
    Object.keys(state.picks || {}).length > 0 && !bracketDraftForTier(state.selectedTier) ||
    Object.keys(state.submittedPicksByTier || {}).some(tier => !bracketSubmissionForTier(Number(tier)))
}

function ensureAppStateSeeded () {
  if (appStateSeedPromise || !appStateNeedsSeed()) return appStateSeedPromise
  appStateSeedPromise = (async () => {
    await dispatchAppStateCommand(profileUpdateCommand(), { toastError: false })
    if (Object.keys(state.picks || {}).length > 0) {
      await dispatchAppStateCommand(bracketDraftCommand({ picks: state.picks }), { toastError: false })
    }
    for (const [tierKey, picks] of Object.entries(state.submittedPicksByTier || {})) {
      const tier = Number(tierKey)
      if (!tier || bracketSubmissionForTier(tier)) continue
      await dispatchAppStateCommand(bracketSubmitCommand({ tier, picks }), { toastError: false })
    }
  })().finally(() => {
    appStateSeedPromise = null
    renderProfile()
    if (state.view === 'bracket') renderBracket()
  })
  return appStateSeedPromise
}

function liveMatchView () {
  return liveMatchClient.view() || PearCupWorkerClient.emptyView()
}

async function dispatchLiveMatchCommand (command, { rerender = false, toastError = false } = {}) {
  try {
    const event = await liveMatchClient.dispatchAsync(command)
    if (typeof liveMatchClient.refresh === 'function') await liveMatchClient.refresh()
    if (rerender) {
      renderHomeDashboard()
      if (state.view === 'watch') renderWatch()
    }
    return event
  } catch (err) {
    if (toastError) showToast(err.message || 'Live match sync failed')
    return null
  }
}

function liveMatchSeedEvents () {
  return [
    { clock: 'Today', period: 'Pre', type: 'possession', teamId: LIVE_HOME_TEAM_ID, value: 50 },
    { clock: 'Today', period: 'Pre', type: 'possession', teamId: LIVE_AWAY_TEAM_ID, value: 50 }
  ].map(event => ({
    type: 'match:ingestEvent',
    actorId: LIVE_MATCH_SOURCE_ACTOR,
    payload: {
      matchId: LIVE_MATCH_ID,
      sourceActorId: LIVE_MATCH_SOURCE_ACTOR,
      ...event
    }
  }))
}

function liveMatchNeedsSeed () {
  const view = liveMatchView()
  const matchEvents = view.matchEventsByMatch && view.matchEventsByMatch[LIVE_MATCH_ID] || []
  const commentaryKey = `${LIVE_MATCH_ID}:${normalizeUiLanguage(state.language)}`
  const commentarySegments = view.commentaryByMatchLanguage && view.commentaryByMatchLanguage[commentaryKey] || []
  return matchEvents.length < liveMatchSeedEvents().length || commentarySegments.length === 0
}

function normalizeUiLanguage (language) {
  return String(language || 'EN').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16) || 'EN'
}

function ensureLiveMatchSeeded (language = state.language) {
  if (liveMatchSeedPromise || !liveMatchNeedsSeed()) return liveMatchSeedPromise
  liveMatchSeedPromise = (async () => {
    for (const command of liveMatchSeedEvents()) {
      await dispatchLiveMatchCommand(command, { toastError: false })
    }
    await ensureLiveMatchCommentary(language, { rerender: false })
  })().finally(() => {
    liveMatchSeedPromise = null
    renderHomeDashboard()
    if (state.view === 'watch') renderWatch()
  })
  return liveMatchSeedPromise
}

function ensureLiveMatchCommentary (language = state.language, { rerender = true } = {}) {
  const normalized = normalizeUiLanguage(language)
  const view = liveMatchView()
  const key = `${LIVE_MATCH_ID}:${normalized}`
  const existing = view.commentaryByMatchLanguage && view.commentaryByMatchLanguage[key] || []
  const matchEvents = view.matchEventsByMatch && view.matchEventsByMatch[LIVE_MATCH_ID] || []
  if (existing.length || !matchEvents.length) return Promise.resolve(existing[existing.length - 1] || null)
  return dispatchLiveMatchCommand({
    type: 'commentary:setLanguage',
    actorId: currentUserId(),
    payload: {
      matchId: LIVE_MATCH_ID,
      language: normalized
    }
  }, { rerender: false }).then(() => dispatchLiveMatchCommand({
    type: 'commentary:generate',
    actorId: 'room-host',
    payload: {
      matchId: LIVE_MATCH_ID,
      language: normalized,
      roomPickDistribution: liveRoomPickDistribution(),
      tone: 'analyst'
    }
  }, { rerender }))
}

function liveRoomPickDistribution () {
  return watchParticipants().reduce((distribution, person) => {
    distribution[person.pick] = (distribution[person.pick] || 0) + 1
    return distribution
  }, {})
}

function liveMatchStats () {
  const view = liveMatchView()
  return view.statSnapshots && view.statSnapshots[LIVE_MATCH_ID] || null
}

function liveMatchStatRows () {
  const stats = liveMatchStats()
  if (!stats) return matchStats
  const homeId = LIVE_HOME_TEAM_ID
  const awayId = LIVE_AWAY_TEAM_ID
  const possessionHome = Math.round(stats.possession[homeId] || 50)
  const possessionAway = Math.round(stats.possession[awayId] || Math.max(0, 100 - possessionHome))
  const shotsHome = stats.shots[homeId] || 0
  const shotsAway = stats.shots[awayId] || 0
  const totalShots = Math.max(1, shotsHome + shotsAway)
  const xgHome = Number(stats.xg[homeId] || 0)
  const xgAway = Number(stats.xg[awayId] || 0)
  const totalXg = Math.max(0.1, xgHome + xgAway)
  const savesHome = stats.saves[homeId] || 0
  const savesAway = stats.saves[awayId] || 0
  const totalSaves = Math.max(1, savesHome + savesAway)
  const onTargetHome = stats.shotsOnTarget[homeId] || 0
  const onTargetAway = stats.shotsOnTarget[awayId] || 0
  return [
    ['Possession', `${possessionHome}%`, `${possessionAway}%`, possessionHome],
    ['Shots', String(shotsHome), String(shotsAway), Math.round((shotsHome / totalShots) * 100)],
    ['xG', xgHome.toFixed(2), xgAway.toFixed(2), Math.round((xgHome / totalXg) * 100)],
    ['On target', String(onTargetHome), String(onTargetAway), Math.round((onTargetHome / Math.max(1, onTargetHome + onTargetAway)) * 100)],
    ['Saves', String(savesHome), String(savesAway), Math.round((savesHome / totalSaves) * 100)]
  ]
}

function liveMatchTimelineItems () {
  const view = liveMatchView()
  const events = view.matchEventsByMatch && view.matchEventsByMatch[LIVE_MATCH_ID] || []
  const labels = {
    goal: 'goal',
    shot: 'shot',
    save: 'save',
    possession: 'possession swing'
  }
  return events
    .slice(-4)
    .reverse()
    .map(event => ({
      clock: event.clock || 'live',
      text: `${teamById(event.teamId).name} ${labels[event.type] || event.type}`
    }))
}

function liveCommentaryLines (language = state.language) {
  const view = liveMatchView()
  const key = `${LIVE_MATCH_ID}:${normalizeUiLanguage(language)}`
  const segments = view.commentaryByMatchLanguage && view.commentaryByMatchLanguage[key] || []
  if (!segments.length) return commentary[normalizeUiLanguage(language)] || commentary.EN
  return segments.slice(-4).map(segment => [segment.clock || 'live', segment.text])
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

function payoutRecipientsForGamePlayers (players = []) {
  return players.reduce((recipients, player) => {
    if (!player || !player.id) return recipients
    const address = payoutAddressForEntrant({
      userId: player.id,
      username: player.username,
      teamId: player.teamId
    })
    if (address) recipients[player.id] = address
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
  const local = () => {
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
  if (!integrationRuntime.canUseRealMoney) return local()
  return PearCupWorkerClient.createAutoWorkerClient({
    rootObject,
    local
  })
}

function createPenaltySettlementWorker (eventStore) {
  const rootObject = typeof window !== 'undefined' ? window : globalThis
  const local = () => PearCupWorkerClient.createLocalWorkerClient({
    runtime: integrationRuntime,
    workerFactory: PearCupWorkerSim,
    storage: eventStore
  })
  if (!integrationRuntime.canUseRealMoney) return local()
  return PearCupWorkerClient.createAutoWorkerClient({
    rootObject,
    local
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
              ${entry.submission ? `
                <span class="entry-status is-confirmed">Bracket sealed</span>
                <code>${escapeHtml(entry.submission.submissionId)}</code>
              ` : ''}
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
  $$('#bracketSettlementPanel [data-payout-user]').forEach(input => {
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
  $$('#bracketSettlementPanel [data-demo-payout-user]').forEach(button => {
    button.addEventListener('click', () => {
      const userId = button.dataset.demoPayoutUser
      state.payoutAddresses = state.payoutAddresses || {}
      state.payoutAddresses[userId] = demoPayoutAddress(userId)
      persist()
      renderBracket()
    })
  })
}

function clonePicks (picks = {}) {
  return bracketMatchIds.reduce((copy, matchId) => {
    if (picks[matchId]) copy[matchId] = picks[matchId]
    return copy
  }, {})
}

function lockedPicksForTier (tier = state.selectedTier) {
  const workerSubmission = bracketSubmissionForTier(tier)
  if (workerSubmission && workerSubmission.picks) return clonePicks(workerSubmission.picks)
  const tierKey = String(tier)
  const locked = state.submittedPicksByTier && state.submittedPicksByTier[tierKey]
  return locked && typeof locked === 'object' && !Array.isArray(locked) ? clonePicks(locked) : null
}

function displayedPicksForTier (tier = state.selectedTier) {
  const draft = bracketDraftForTier(tier)
  return lockedPicksForTier(tier) || draft && clonePicks(draft.picks) || state.picks || {}
}

function createOfficialResultsSnapshot () {
  return {
    matchWinners: { ...demoOfficialMatchWinners },
    source: 'pearcup-demo-match-feed',
    rule: 'perfect-bracket-split',
    capturedAt: '2026-07-01T00:00:00.000Z'
  }
}

function demoBracketPicksForEntrant (entrant, tier) {
  const locked = entrant.userId === currentUserId() ? lockedPicksForTier(tier) : null
  if (locked) return locked
  if (entrant.userId === 'user-lina') return { ...demoOfficialMatchWinners }
  if (entrant.userId === 'user-vera') {
    return {
      ...demoOfficialMatchWinners,
      'r16-2': 'no',
      'qf-1': 'ca',
      'sf-1': 'fr',
      'final-1': 'ar'
    }
  }
  return null
}

async function resolveBracketSettlement (selectedPool) {
  const poolId = bracketPoolId(selectedPool.tier)
  const amount = selectedPool.tier
  const profile = currentProfilePayload()
  const entrants = [
    { username: profile.username, userId: profile.userId, teamId: profile.teamId },
    { username: 'lina', userId: 'user-lina', teamId: 'br' },
    { username: 'vera', userId: 'user-vera', teamId: 'no' }
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
  const officialResults = createOfficialResultsSnapshot()

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

  const bracketSubmissions = []
  for (const entry of entryLedger) {
    const picks = demoBracketPicksForEntrant(entry.entrant, selectedPool.tier)
    if (!picks || !entry.payment) continue
    const submissionEvent = await worker.dispatchAsync({
      type: 'bracket:submit',
      actorId: entry.entrant.userId,
      payload: {
        poolId,
        entryId: entry.intent.entryId,
        paymentId: entry.payment.paymentId,
        userId: entry.entrant.userId,
        username: entry.entrant.username,
        picks,
        rulesVersion: 'bracket-pool-v1'
      }
    })
    entry.submission = submissionEvent.payload
    entry.eventIds.submission = submissionEvent.eventId
    bracketSubmissions.push(submissionEvent.payload)
  }

  const bracketResolution = PearCupCore.deriveBracketPoolWinners({
    bracketSubmissions,
    officialResults,
    eligibleUserIds: entrants.map(entrant => entrant.userId)
  })
  const winnerUserIds = bracketResolution.winnerUserIds
  const payoutRecipients = payoutRecipientsForEntrants(entrants, winnerUserIds)
  const winnerEntrants = entrants.filter(entrant => winnerUserIds.includes(entrant.userId))
  await settlementService.recordOfficialResultsSnapshot({
    poolId,
    officialResults,
    source: officialResults.source,
    sourceActorId: officialResults.source,
    rulesVersion: 'bracket-pool-v1'
  }, {
    actorId: officialResults.source
  })
  for (const entrant of winnerEntrants) {
    const recipient = payoutRecipients[entrant.userId]
    if (!recipient) continue
    await settlementService.declarePayoutRecipient({
      poolId,
      userId: entrant.userId,
      username: entrant.username,
      teamId: entrant.teamId,
      asset: 'USDT',
      recipient
    }, {
      actorId: entrant.userId
    })
  }
  const settlementResult = await settlementService.settleBracketPoolWithReceipt({
    poolId,
    officialResults,
    officialResultsSource: officialResults.source,
    officialResultsSourceActorId: officialResults.source,
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
    winnerUserIds: settlementSummary.poolResultEvent.payload.winnerUserIds || winnerUserIds,
    payoutRecipients,
    entryLedger,
    bracketSubmissions,
    bracketResolution,
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
  return displayedPicksForTier()[matchId] || null
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

async function renderBracket () {
  const renderId = ++bracketRenderSequence
  const selectedPool = pools.find(pool => pool.tier === state.selectedTier) || pools[1]
  const wdk = integrationRuntime.readiness.tetherWdk
  $('#bracketTierLabel').textContent = `$${selectedPool.tier} Pool`
  $('#bracketSettlementPanel').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header">
        <p class="eyebrow">Settlement</p>
        <strong>Building audit trail</strong>
      </div>
      <p class="live-copy">Preparing WDK entry intents, QVAC attestation, and replayable event roots.</p>
    </article>
  `

  let settlement
  try {
    settlement = await resolveBracketSettlement(selectedPool)
  } catch (err) {
    if (renderId !== bracketRenderSequence) return
    renderSettlementError($('#bracketSettlementPanel'), err, 'Bracket settlement blocked')
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
  const poolResult = settlement.poolResult || {}
  const sourceBracketSubmissionIds = Array.isArray(poolResult.sourceBracketSubmissionIds)
    ? poolResult.sourceBracketSubmissionIds
    : []

  $('#bracketSettlementPanel').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header">
        <p class="eyebrow">Tether WDK</p>
        <strong>${serviceModeLabel(wdk)} bracket rail</strong>
      </div>
      <div class="settlement-kpis">
        <div>
          <span>Confirmed entries</span>
          <strong>${settlement.entryCount}</strong>
        </div>
        <div>
          <span>Pending checks</span>
          <strong>${settlement.pendingEntryChecks}</strong>
        </div>
        <div>
          <span>Payout</span>
          <strong>${payoutStatus.label}</strong>
        </div>
      </div>
    </article>
    <article class="settlement-rail-card">
      <div class="rail-header">
        <p class="eyebrow">Pool</p>
        <strong>${grossPool}</strong>
      </div>
      <div class="settlement-kpis single-row">
        <div>
          <span>Split</span>
          <strong>${splitAmount}</strong>
        </div>
        <div>
          <span>Events</span>
          <strong>${settlement.storage.events}</strong>
        </div>
        <div>
          <span>Replay</span>
          <strong>${settlement.storage.replayMatched ? 'Matched' : 'Mismatch'}</strong>
        </div>
      </div>
    </article>
    <article class="settlement-rail-card entry-ledger-card">
      <div class="rail-header">
        <p class="eyebrow">WDK entries</p>
        <strong>Intent → reconcile → confirm</strong>
      </div>
      ${renderEntryLedger(settlement)}
    </article>
    <article class="settlement-rail-card payout-recipient-card">
      <div class="rail-header">
        <p class="eyebrow">WDK payout</p>
        <strong>${payoutPrepared ? 'Recipient quoted' : payoutStatus.label}</strong>
      </div>
      ${renderPayoutRecipients(settlement)}
    </article>
    <article class="settlement-rail-card">
      <div class="rail-header">
        <p class="eyebrow">Audit</p>
        <strong>${settlement.qvacAttestation.ruling === 'verified' ? 'QVAC verified' : 'QVAC disputed'}</strong>
      </div>
      <div class="hash-list compact-hash">
        <div><span>Guard mode</span><code>${settlement.guardMode}</code></div>
        <div><span>Prize gate</span><code>${settlement.settlementGate.status}</code></div>
        <div><span>QVAC attestation</span><code>${settlement.qvacAttestation.attestationId}</code></div>
        <div><span>Bracket result</span><code>${escapeHtml(poolResult.bracketResolvedBy || 'pending')}</code></div>
        <div><span>Locked submissions</span><code>${sourceBracketSubmissionIds.length}</code></div>
        <div><span>Scoreboard hash</span><code>${escapeHtml(poolResult.bracketScoreboardHash || 'pending')}</code></div>
        <div><span>Official results</span><code>${escapeHtml(poolResult.officialResultsHash || 'pending')}</code></div>
        <div><span>Recipient declarations</span><code>${settlement.recipientDeclarationCount}</code></div>
        <div><span>Receipt hash</span><code>${escapeHtml(settlement.settlementReceipt && settlement.settlementReceipt.receiptHash || 'pending')}</code></div>
        <div><span>Receipt event</span><code>${escapeHtml(settlement.settlementReceiptEvent && settlement.settlementReceiptEvent.eventId || 'pending')}</code></div>
        <div><span>Pool namespace</span><code>${settlement.storage.namespace}</code></div>
        <div><span>Event root</span><code>${settlement.storage.eventRoot}</code></div>
        <div><span>Replay root</span><code>${settlement.storage.replayRoot}</code></div>
      </div>
    </article>
  `
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
      if (lockedPicksForTier()) {
        showToast(`$${state.selectedTier} bracket is already sealed`)
        return
      }
      const nextPicks = clonePicks(displayedPicksForTier())
      nextPicks[button.dataset.match] = button.dataset.pick
      clearDownstream(button.dataset.match, nextPicks)
      state.picks = nextPicks
      persist()
      dispatchAppStateCommand(bracketDraftCommand({ picks: nextPicks }), { rerender: false })
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

function clearDownstream (matchId, picks = state.picks) {
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
  for (const id of seen) delete picks[id]
  return picks
}

function currentWatchPickTeamId () {
  const picks = displayedPicksForTier()
  const livePick = [LIVE_HOME_TEAM_ID, LIVE_AWAY_TEAM_ID].includes(picks['r32-11']) ? picks['r32-11'] : LIVE_HOME_TEAM_ID
  return livePick
}

function currentWatchParticipant () {
  return {
    userId: currentUserId(),
    username: state.username || 'captain',
    teamId: currentWatchPickTeamId(),
    role: 'you'
  }
}

function demoWatchParticipants () {
  return [
    { userId: 'user-lina', username: 'lina', teamId: 'es', role: 'stream host' },
    { userId: 'user-vera', username: 'vera', teamId: 'at', role: 'voice' },
    { userId: 'user-milo', username: 'milo', teamId: 'es', role: 'chat' },
    { userId: 'user-samir', username: 'samir', teamId: 'at', role: 'voice' },
    { userId: 'user-ash', username: 'ash', teamId: 'es', role: 'chat' }
  ]
}

function watchRoomView () {
  return watchRoomClient.view() || PearCupWorkerClient.emptyView()
}

function watchRoomParticipantsById () {
  const view = watchRoomView()
  return view.roomParticipants && view.roomParticipants[WATCH_ROOM_ID] || {}
}

function watchChatMessages () {
  const view = watchRoomView()
  const messages = view.chatMessagesByRoom && view.chatMessagesByRoom[WATCH_ROOM_ID] || []
  if (!messages.length) return defaultChat
  return messages.slice(-8).map(message => ({
    user: message.username || message.userId,
    text: message.body,
    time: formatChatTime(message.sentAt)
  }))
}

function watchVoiceStateForCurrentUser () {
  const view = watchRoomView()
  return view.voiceStatesByRoom &&
    view.voiceStatesByRoom[WATCH_ROOM_ID] &&
    view.voiceStatesByRoom[WATCH_ROOM_ID][currentUserId()]
}

function watchVoiceIsLive () {
  const voice = watchVoiceStateForCurrentUser()
  return Boolean(voice && voice.status === 'speaking' && voice.muted !== true)
}

function watchActiveStream () {
  const view = watchRoomView()
  return view.activeStreamsByRoom && view.activeStreamsByRoom[WATCH_ROOM_ID] || null
}

function formatChatTime (value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'live'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function watchParticipants () {
  const current = currentWatchParticipant()
  const participants = Object.values(watchRoomParticipantsById())
    .filter(person => !(person.role === 'you' && person.userId !== current.userId))
  const seeded = participants.length ? participants : [current, ...demoWatchParticipants()]
  const order = new Map([[current.userId, 0], ['user-lina', 1], ['user-vera', 2], ['user-milo', 3], ['user-samir', 4], ['user-ash', 5]])
  return seeded
    .map(person => {
      const isCurrentUser = person.userId === current.userId
      const teamId = isCurrentUser ? current.teamId : ([LIVE_HOME_TEAM_ID, LIVE_AWAY_TEAM_ID].includes(person.teamId) ? person.teamId : LIVE_HOME_TEAM_ID)
      return {
        userId: person.userId,
        name: isCurrentUser ? current.username : (person.username || person.userId),
        pick: teamId,
        role: person.role || 'viewer'
      }
    })
    .sort((left, right) => (order.get(left.userId) ?? 99) - (order.get(right.userId) ?? 99))
}

async function dispatchWatchRoomCommand (command, { rerender = true, toastError = true } = {}) {
  try {
    const event = await watchRoomClient.dispatchAsync(command)
    if (typeof watchRoomClient.refresh === 'function') await watchRoomClient.refresh()
    if (rerender && state.view === 'watch') renderWatch()
    return event
  } catch (err) {
    if (toastError) showToast(err.message || 'Watch room sync failed')
    return null
  }
}

function watchRoomJoinCommand (participant) {
  return {
    type: 'room:join',
    actorId: participant.userId,
    payload: {
      roomId: WATCH_ROOM_ID,
      matchId: WATCH_MATCH_ID,
      userId: participant.userId,
      username: participant.username,
      teamId: participant.teamId,
      role: participant.role
    }
  }
}

function watchRoomNeedsSeed () {
  const view = watchRoomView()
  const participants = watchRoomParticipantsById()
  const messages = view.chatMessagesByRoom && view.chatMessagesByRoom[WATCH_ROOM_ID] || []
  const seededStreamExists = Boolean(view.streams && view.streams[WATCH_STREAM_ID])
  return !participants[currentUserId()] ||
    !participants['user-lina'] ||
    messages.length === 0 ||
    !seededStreamExists
}

function ensureWatchRoomSeeded () {
  if (watchRoomSeedPromise || !watchRoomNeedsSeed()) return watchRoomSeedPromise
  const current = currentWatchParticipant()
  const seedParticipants = [current, ...demoWatchParticipants()]
  watchRoomSeedPromise = (async () => {
    for (const participant of seedParticipants) {
      await dispatchWatchRoomCommand(watchRoomJoinCommand(participant), { rerender: false, toastError: false })
    }
    const demoChatUsers = {
      lina: seedParticipants.find(person => person.username === 'lina'),
      vera: seedParticipants.find(person => person.username === 'vera'),
      ash: seedParticipants.find(person => person.username === 'ash')
    }
    for (const message of defaultChat) {
      const participant = demoChatUsers[message.user]
      if (!participant) continue
      await dispatchWatchRoomCommand({
        type: 'chat:send',
        actorId: participant.userId,
        payload: {
          roomId: WATCH_ROOM_ID,
          userId: participant.userId,
          username: participant.username,
          teamId: participant.teamId,
          body: message.text,
          clientNonce: `seed-${participant.userId}-${message.time}`
        }
      }, { rerender: false, toastError: false })
    }
    await dispatchWatchRoomCommand({
      type: 'voice:update',
      actorId: 'user-vera',
      payload: {
        roomId: WATCH_ROOM_ID,
        userId: 'user-vera',
        status: 'speaking',
        muted: false
      }
    }, { rerender: false, toastError: false })
    await dispatchWatchRoomCommand({
      type: 'voice:update',
      actorId: 'user-samir',
      payload: {
        roomId: WATCH_ROOM_ID,
        userId: 'user-samir',
        status: 'muted',
        muted: true
      }
    }, { rerender: false, toastError: false })
    await dispatchWatchRoomCommand({
      type: 'stream:start',
      actorId: 'user-lina',
      payload: {
        roomId: WATCH_ROOM_ID,
        streamId: WATCH_STREAM_ID,
        userId: 'user-lina',
        username: 'lina',
        source: 'match-visualization',
        title: 'Spain vs Austria room TV',
        rightsConfirmed: true
      }
    }, { rerender: false, toastError: false })
  })().finally(() => {
    watchRoomSeedPromise = null
    if (state.view === 'watch') renderWatch()
    renderHomeDashboard()
  })
  return watchRoomSeedPromise
}

function renderWatch () {
  ensureWatchRoomSeeded()
  ensureLiveMatchSeeded()
  const room = watchParticipants()
  const grouped = [LIVE_HOME_TEAM_ID, LIVE_AWAY_TEAM_ID].map(teamId => {
    const picked = room.filter(person => person.pick === teamId)
    return { team: teamById(teamId), picked }
  })

  $('#watchPickBoard').innerHTML = grouped.map(group => `
    <article class="watch-pick-card">
      <div class="watch-pick-team">
        <span class="score-flag">${group.team.flag}</span>
        <div>
          <strong>${escapeHtml(group.team.name)}</strong>
          <span>${group.picked.length} picked</span>
        </div>
      </div>
      <div class="pick-avatars" aria-label="${escapeHtml(group.team.name)} picks">
        ${group.picked.map(person => `
          <span>
            ${avatarSvg(person.name, group.team, true)}
            <em>${escapeHtml(person.name)}</em>
          </span>
        `).join('')}
      </div>
    </article>
  `).join('')

  $('#languageTabs').innerHTML = Object.keys(commentary).map(language => `
    <button type="button" role="tab" class="${language === state.language ? 'is-active' : ''}" data-language="${language}" aria-selected="${language === state.language ? 'true' : 'false'}">
      ${language}
    </button>
  `).join('')

  $$('#languageTabs button').forEach(button => {
    button.addEventListener('click', () => {
      state.language = button.dataset.language
      persist()
      ensureLiveMatchCommentary(state.language)
      renderWatch()
    })
  })

  $('#commentaryFeed').innerHTML = liveCommentaryLines(state.language).map(([time, text]) => `
    <div class="commentary-line">
      <time>${time}</time>
      <p>${escapeHtml(text)}</p>
    </div>
  `).join('')

  $('#chatFeed').innerHTML = watchChatMessages().map(message => `
    <div class="chat-message">
      <time>${message.time}</time>
      <strong>${escapeHtml(message.user)}</strong>
      <p>${escapeHtml(message.text)}</p>
    </div>
  `).join('')

  const activeStream = watchActiveStream()
  $('#voiceToggle').classList.toggle('is-live', watchVoiceIsLive())
  $('#voiceToggle').setAttribute('aria-pressed', watchVoiceIsLive() ? 'true' : 'false')
  $('#streamToggle').classList.toggle('is-live', Boolean(activeStream))
  $('#streamToggle').setAttribute('aria-label', activeStream ? 'Streaming to room TV' : 'Start streaming to room TV')
  $('#streamToggle').setAttribute('title', activeStream ? `${activeStream.username || activeStream.userId} streaming` : 'Start room stream')
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

function sameStringSet (left = [], right = []) {
  const a = Array.isArray(left) ? left.map(String).sort() : []
  const b = Array.isArray(right) ? right.map(String).sort() : []
  return a.length === b.length && a.every((item, index) => item === b[index])
}

function latestWorkerEvent (worker, type, predicate = () => true) {
  const events = worker && typeof worker.events === 'function' ? worker.events() : []
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event && event.type === type && predicate(event.payload || {}, event)) return event
  }
  return null
}

function existingGameEscrowEvent (worker, input) {
  const view = worker && typeof worker.view === 'function' ? worker.view() : {}
  const escrow = view.escrowsByGame && view.escrowsByGame[input.gameId]
  if (!escrow) return null
  if (!sameStringSet(escrow.players, input.players)) return null
  if (Number(escrow.amount) !== Number(input.amount)) return null
  if (String(escrow.asset || 'USDT') !== String(input.asset || 'USDT')) return null
  return latestWorkerEvent(worker, 'TetherWdkEscrowCreated', payload => payload.escrowId === escrow.escrowId) || {
    type: 'TetherWdkEscrowCreated',
    actorId: escrow.rail || 'tether-wdk',
    payload: escrow,
    eventId: escrow.escrowId
  }
}

function payloadFieldsMatch (current = {}, expected = {}, fields = []) {
  return fields.every(field => PearCupCore.deterministicHash(current[field]) === PearCupCore.deterministicHash(expected[field]))
}

async function dispatchGameEvidenceIfNeeded (worker, collection, key, expected, fields, command) {
  const view = worker && typeof worker.view === 'function' ? worker.view() : {}
  const current = view[collection] && view[collection][key]
  if (current && payloadFieldsMatch(current, expected, fields)) return current
  return worker.dispatchAsync(command)
}

async function resolvePenaltyRound () {
  const round = currentGameRound()
  const gameId = GAME_SETTLEMENT_ID
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
  const eventStore = createGameSettlementEventStore(gameId)
  const worker = createPenaltySettlementWorker(eventStore)
  const settlementService = createUiSettlementService(worker)
  const tetherActor = integrationRuntime.readiness.tetherWdk.adapterId || 'tether-wdk'
  const qvacActor = integrationRuntime.readiness.qvac.adapterId || 'qvac-ref'
  const payoutRecipients = payoutRecipientsForGamePlayers([shooter, keeper])
  const escrowInput = {
    gameId,
    players: [shooter.id, keeper.id],
    amount: 5,
    asset: 'USDT',
    rulesVersion: PearCupCore.resolverVersion
  }
  let escrowEvent = existingGameEscrowEvent(worker, escrowInput)
  if (!escrowEvent) {
    escrowEvent = await settlementService.createGameEscrow(escrowInput, {
      actorId: tetherActor
    })
  }
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
  await dispatchGameEvidenceIfNeeded(worker, 'commitments', `${gameId}:${roundId}:${shooter.id}`, {
    gameId,
    roundId,
    playerId: shooter.id,
    commitment: shooterCommitment
  }, ['gameId', 'roundId', 'playerId', 'commitment'], {
    type: 'game:submitCommitment',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, commitment: shooterCommitment }
  })
  await dispatchGameEvidenceIfNeeded(worker, 'commitments', `${gameId}:${roundId}:${keeper.id}`, {
    gameId,
    roundId,
    playerId: keeper.id,
    commitment: keeperCommitment
  }, ['gameId', 'roundId', 'playerId', 'commitment'], {
    type: 'game:submitCommitment',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, commitment: keeperCommitment }
  })
  await dispatchGameEvidenceIfNeeded(worker, 'reveals', `${gameId}:${roundId}:${shooter.id}`, {
    gameId,
    roundId,
    playerId: shooter.id,
    input: shooterInput,
    nonce: 'shooter-nonce'
  }, ['gameId', 'roundId', 'playerId', 'input', 'nonce'], {
    type: 'game:revealInput',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, input: shooterInput, nonce: 'shooter-nonce' }
  })
  await dispatchGameEvidenceIfNeeded(worker, 'reveals', `${gameId}:${roundId}:${keeper.id}`, {
    gameId,
    roundId,
    playerId: keeper.id,
    input: keeperInput,
    nonce: 'keeper-nonce'
  }, ['gameId', 'roundId', 'playerId', 'input', 'nonce'], {
    type: 'game:revealInput',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, input: keeperInput, nonce: 'keeper-nonce' }
  })
  const expectedRound = PearCupCore.createPenaltyClashRound({
    gameId,
    roundIndex,
    shooter,
    keeper,
    shooterInput,
    keeperInput
  })
  await dispatchGameEvidenceIfNeeded(worker, 'roundStateHashes', `${gameId}:${roundId}:${shooter.id}`, {
    gameId,
    roundId,
    roundIndex,
    playerId: shooter.id,
    stateHash: expectedRound.stateHash,
    resolverVersion: PearCupCore.resolverVersion
  }, ['gameId', 'roundId', 'roundIndex', 'playerId', 'stateHash', 'resolverVersion'], {
    type: 'game:submitRoundStateHash',
    actorId: shooter.id,
    payload: {
      gameId,
      roundIndex,
      roundId,
      playerId: shooter.id,
      stateHash: expectedRound.stateHash,
      resolverVersion: PearCupCore.resolverVersion
    }
  })
  await dispatchGameEvidenceIfNeeded(worker, 'roundStateHashes', `${gameId}:${roundId}:${keeper.id}`, {
    gameId,
    roundId,
    roundIndex,
    playerId: keeper.id,
    stateHash: expectedRound.stateHash,
    resolverVersion: PearCupCore.resolverVersion
  }, ['gameId', 'roundId', 'roundIndex', 'playerId', 'stateHash', 'resolverVersion'], {
    type: 'game:submitRoundStateHash',
    actorId: keeper.id,
    payload: {
      gameId,
      roundIndex,
      roundId,
      playerId: keeper.id,
      stateHash: expectedRound.stateHash,
      resolverVersion: PearCupCore.resolverVersion
    }
  })
  const settlementResult = await settlementService.settleGameRoundWithReceipt({
    gameId,
    roundIndex,
    roundId,
    shooter,
    keeper,
    escrowId: escrowEvent.payload.escrowId,
    payoutRecipients,
    qvacActorId: qvacActor,
    wdkActorId: tetherActor
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
    qvacAttestation: settlementSummary.attestationEvent.payload,
    tetherEscrow: escrowEvent.payload,
    tetherPayout: settlementSummary.settlementEvent.payload,
    payoutRecipients,
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

function zonePosition (zone) {
  const [side, height] = zone.split('-')
  const x = side === 'left' ? 25 : side === 'right' ? 75 : 50
  const y = height === 'high' ? 28 : 62
  return { x, y }
}

async function renderGames () {
  const renderId = ++gameRenderSequence
  $('#runtimePanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Runtime</p>
      <strong>Building settlement</strong>
    </div>
    <p class="live-copy">Preparing deterministic evidence, QVAC review, and WDK escrow release.</p>
  `

  let result
  try {
    result = await resolvePenaltyRound()
  } catch (err) {
    if (renderId !== gameRenderSequence) return null
    renderSettlementError($('#runtimePanel'), err, 'Game settlement blocked')
    return null
  }
  if (renderId !== gameRenderSequence) return null

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
  const processorRelease = result.tetherPayout.processorRelease || null
  const payoutStatus = processorRelease && processorRelease.status || result.tetherPayout.status || 'prepared'
  const winnerRouteReady = Boolean(result.payoutRecipients && result.payoutRecipients[result.tetherPayout.winnerUserId])

  $('#gameScoreboard').innerHTML = `
    <div class="game-player-card">
      ${avatarSvg(result.shooter, shooterTeam, true)}
      <div>
        <span>Shooter</span>
        <strong>${escapeHtml(result.shooter)}</strong>
        <em>${shooterTeam.flag} ${escapeHtml(shooterTeam.name)}</em>
      </div>
    </div>
    <div class="game-score-core">
      <span>Round ${state.gameRound + 1}</span>
      <strong>${result.outcomeLabel}</strong>
      <em>${state.gameSpectating ? 'Spectating' : 'Quick challenge'}</em>
    </div>
    <div class="game-player-card is-away">
      ${avatarSvg(result.keeper, keeperTeam, true)}
      <div>
        <span>Keeper</span>
        <strong>${escapeHtml(result.keeper)}</strong>
        <em>${keeperTeam.flag} ${escapeHtml(keeperTeam.name)}</em>
      </div>
    </div>
  `

  $('#gameShooter').innerHTML = avatarSvg(result.shooter, shooterTeam)
  $('#gameKeeper').innerHTML = avatarSvg(result.keeper, keeperTeam)
  $('#gameBall').style.left = `${ball.x}%`
  $('#gameBall').style.top = `${ball.y}%`
  $('#gameKeeper').style.left = `${keeper.x}%`

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
      <li>${escapeHtml(result.workerEvents[7].type)} recorded WDK release status ${escapeHtml(payoutStatus)}.</li>
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
      <div class="${payoutStatus === 'recipient-required' ? 'is-warn' : 'is-complete'}">
        <span>Settlement</span>
        <strong>${payoutStatus}</strong>
      </div>
      <div class="${winnerRouteReady ? 'is-complete' : 'is-warn'}">
        <span>Winner route</span>
        <strong>${winnerRouteReady ? 'Ready' : 'Missing'}</strong>
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
      <strong>Trusted results</strong>
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
  if (lockedPicksForTier()) return 0
  const picks = displayedPicksForTier()
  return bracketMatchIds.filter(id => !picks[id]).length
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
      renderAll()
      return
    }

    const saveButton = event.target.closest('#saveProfile')
    if (saveButton) {
      event.preventDefault()
      event.stopPropagation()
      const name = $('#usernameInput').value.trim()
      state.username = name || 'captain'
      persist()
      renderAll()
      setView('home')
      showToast(`${state.username} joined as ${teamById(state.team).name}`)
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
  bindViewButtons()

  $('#usernameInput').addEventListener('input', event => {
    state.username = event.target.value.trim() || 'captain'
    persist()
    renderProfile()
  })

  $('#saveProfile').addEventListener('click', () => {
    const name = $('#usernameInput').value.trim()
    state.username = name || 'captain'
    persist()
    dispatchAppStateCommand(profileUpdateCommand()).then(event => {
      renderAll()
      setView('home')
      showToast(event && event.type === 'ProfileUpdated'
        ? `${state.username} joined as ${teamById(state.team).name}`
        : 'Profile sync is pending')
    })
  })

  $('#resetPicks').addEventListener('click', () => {
    state.picks = {}
    persist()
    dispatchAppStateCommand(bracketResetDraftCommand(), { rerender: false })
    renderBracket()
    showToast(lockedPicksForTier() ? 'Draft cleared; sealed bracket remains locked' : 'Bracket picks cleared')
  })

  $('#submitPicks').addEventListener('click', () => {
    if (lockedPicksForTier()) {
      showToast(`$${state.selectedTier} bracket already sealed`)
      return
    }
    const remaining = remainingPicks()
    if (remaining > 0) {
      showToast(`${remaining} picks left before this bracket is sealed`)
      return
    }
    const submittedPicks = clonePicks(displayedPicksForTier())
    state.submittedPicksByTier = state.submittedPicksByTier || {}
    state.submittedPicksByTier[String(state.selectedTier)] = submittedPicks
    persist()
    dispatchAppStateCommand(bracketSubmitCommand({ picks: submittedPicks })).then(event => {
      renderBracket()
      showToast(event && event.type === 'BracketSubmissionLocked'
        ? `$${state.selectedTier} bracket submitted for ${state.username}`
        : 'Bracket submission sync is pending')
    })
  })

  $('#voiceToggle').addEventListener('click', () => {
    const participant = currentWatchParticipant()
    const nextLive = !watchVoiceIsLive()
    dispatchWatchRoomCommand(watchRoomJoinCommand(participant), { rerender: false }).then(() => {
      return dispatchWatchRoomCommand({
        type: 'voice:update',
        actorId: participant.userId,
        payload: {
          roomId: WATCH_ROOM_ID,
          userId: participant.userId,
          status: nextLive ? 'speaking' : 'muted',
          muted: !nextLive
        }
      })
    }).then(event => {
      if (!event) return
      showToast(nextLive ? 'Voice chat unmuted' : 'Voice chat muted')
    })
  })

  $('#streamToggle').addEventListener('click', () => {
    const participant = currentWatchParticipant()
    const activeStream = watchActiveStream()
    if (activeStream && activeStream.userId === participant.userId) {
      dispatchWatchRoomCommand({
        type: 'stream:stop',
        actorId: participant.userId,
        payload: {
          roomId: WATCH_ROOM_ID,
          streamId: activeStream.streamId,
          userId: participant.userId
        }
      }).then(event => {
        if (event) showToast('Room stream stopped')
      })
      return
    }

    const streamId = PearCupCore.deterministicHash({
      type: 'UiRoomStream',
      roomId: WATCH_ROOM_ID,
      userId: participant.userId,
      startedAt: Date.now()
    })
    dispatchWatchRoomCommand(watchRoomJoinCommand(participant), { rerender: false }).then(() => {
      return dispatchWatchRoomCommand({
        type: 'stream:start',
        actorId: participant.userId,
        payload: {
          roomId: WATCH_ROOM_ID,
          streamId,
          userId: participant.userId,
          username: participant.username,
          source: 'match-visualization',
          title: `${participant.username}'s match view`,
          rightsConfirmed: true
        }
      })
    }).then(event => {
      if (event) showToast('Streaming to the room TV')
    })
  })

  $('#advanceGameRound').addEventListener('click', () => {
    state.gameRound = (state.gameRound + 1) % gameRounds.length
    persist()
    renderGames().then(result => {
      if (!result) return
      showToast(`QVAC ref sealed ${result.outcome} with ${result.stateHash.slice(0, 12)}`)
    })
  })

  $('#spectateGame').addEventListener('click', () => {
    state.gameSpectating = !state.gameSpectating
    persist()
    renderGames()
    showToast(state.gameSpectating ? 'Spectator replay enabled' : 'Quick challenge mode enabled')
  })

  $('#chatForm').addEventListener('submit', event => {
    event.preventDefault()
    const input = $('#chatInput')
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    const participant = currentWatchParticipant()
    dispatchWatchRoomCommand(watchRoomJoinCommand(participant), { rerender: false }).then(() => {
      return dispatchWatchRoomCommand({
        type: 'chat:send',
        actorId: participant.userId,
        payload: {
          roomId: WATCH_ROOM_ID,
          userId: participant.userId,
          username: participant.username,
          teamId: participant.teamId,
          body: text,
          clientNonce: PearCupCore.deterministicHash({
            type: 'UiChatNonce',
            roomId: WATCH_ROOM_ID,
            userId: participant.userId,
            body: text,
            sentAt: Date.now()
          })
        }
      })
    })
  })
}

function renderAll () {
  ensureAppStateSeeded()
  renderTeams()
  renderProfile()
  renderHomeDashboard()
  renderPools()
  renderDiscover()
  renderCreator()
  renderPicksWorkbench()
  renderBracket()
  renderWatch()
  renderGames()
  renderWallet()
  renderOps()
}

bindCoreFallbackEvents()
renderAll()
setView(state.view, { focus: false })
bindEvents()
window.addEventListener('load', resetScrollPosition)
window.addEventListener('pageshow', resetScrollPosition)
window.addEventListener('resize', scheduleBracketConnectors)
if (typeof window !== 'undefined') {
  window.__pearcupAppBooted = true
  document.documentElement.setAttribute('data-pearcup-booted', 'true')
  const bar = document.getElementById('bootErrorBar')
  if (bar && !/^PearCup boot error:/.test(bar.textContent || '')) bar.remove()
  try { window.dispatchEvent(new Event('pearcup:booted')) } catch (e) {}
}
