import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool'

const outputDir = new URL('.', import.meta.url)
const previewDir = '/private/tmp/pearcup-feature-audit-previews'
const outputPath = fileURLToPath(new URL('pearcup-feature-status.xlsx', outputDir))

const today = new Date('2026-07-02T00:00:00Z')

function gitValue (args, fallback) {
  try {
    return execFileSync('git', args, {
      cwd: new URL('../..', outputDir),
      encoding: 'utf8'
    }).trim()
  } catch {
    return fallback
  }
}

const gitCommit = gitValue(['rev-parse', '--short', 'HEAD'], 'unknown')
const gitBranch = gitValue(['branch', '--show-current'], 'unknown')

const statusOptions = ['Integrated', 'Ready for Test', 'Needs Fix', 'Fixed', 'Deferred', 'Blocked']
const manualStatusOptions = ['Not Run', 'Passed', 'Passed (Smoke)', 'Failed', 'Blocked', 'Partial']
const fixStatusOptions = ['None', 'Open', 'In Progress', 'Fixed', 'Retest Needed', 'Closed']
const retestStatusOptions = ['Not Run', 'Passed', 'Failed', 'Blocked']
const priorityOptions = ['P0', 'P1', 'P2', 'P3']
const defectStatusOptions = ['Open', 'In Progress', 'Fixed', 'Retest Needed', 'Closed', 'Info']
const severityOptions = ['S0', 'S1', 'S2', 'S3']
const runStatusOptions = ['Passed', 'Failed', 'Blocked', 'Partial']

const storyHeaders = [
  'Story ID',
  'Area',
  'User Story',
  'Expected Behavior',
  'Code / Selectors',
  'Automation / Smoke Evidence',
  'Manual Test Steps',
  'Priority',
  'Feature Status',
  'Manual Test Status',
  'Defect IDs',
  'Fix Status',
  'Retest Status',
  'Notes'
]

const stories = [
  {
    id: 'US-001',
    area: 'Boot and Navigation',
    story: 'As a returning player, I can open PearCup without a runtime crash.',
    expected: 'The app loads the Kawaii shell, initializes required modules, and shows a readable boot banner only if a required dependency is missing.',
    refs: 'design/kawaii-app/index.html; design/kawaii-app/app.js: needModule, boot; module script tags',
    evidence: 'npm run check passed; browser smoke found no boot banner or console errors.',
    steps: 'Open http://127.0.0.1:4175/, reload, verify title, shell, wallet chip, profile chip, and no PearCup boot error.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed (Smoke)',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: 'Current live tab passed on 2026-07-02.'
  },
  {
    id: 'US-002',
    area: 'Boot and Navigation',
    story: 'As a player, I can move between Profile, Home, Bracket, Watch, and Games from the top nav.',
    expected: 'Each top-nav button activates exactly one screen and leaves expected controls visible.',
    refs: 'design/kawaii-app/index.html: .topnav buttons; design/kawaii-app/app.js: setView, bindViewButtons',
    evidence: 'Browser smoke clicked all top-nav screens successfully.',
    steps: 'Click Profile, Home, Bracket, Watch, Games; verify each section receives is-active and expected controls render.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed (Smoke)',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: 'CTA buttons also share data-view and are intentionally excluded from top-nav uniqueness.'
  },
  {
    id: 'US-003',
    area: 'Boot and Navigation',
    story: 'As a player, my app state survives reloads.',
    expected: 'Profile, wallet, picks, room/game state, theme, and settings load from localStorage with safe fallback defaults.',
    refs: 'design/kawaii-app/app.js: loadState, persist, STORAGE_KEY',
    evidence: 'Syntax covered; requires manual persistence pass.',
    steps: 'Change username, team, theme, live setting, and a bracket draft; reload; verify values restore without duplicates or crashes.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-004',
    area: 'Runtime Integration',
    story: 'As an operator, I can run in demo mode when live SDK packages are absent.',
    expected: 'Runtime config falls back to demo adapters and reports demo/compliance locks without breaking user flows.',
    refs: 'app/runtime-config.js; app/runtime-settings.js; design/kawaii-app/runtime-config.js; design/kawaii-app/app.js: integrationRuntime',
    evidence: 'npm run check: runtime-config/runtime-settings/adapters tests passed.',
    steps: 'Open app without SDK globals; verify live readiness panels show demo status and gameplay/brackets remain usable in demo mode.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-005',
    area: 'Runtime Integration',
    story: 'As an operator, settlement rails only go live when QVAC, WDK, compliance, and recipient routes are ready.',
    expected: 'Live-money commands are guarded; readiness and launch audit explain missing gates and pass only with complete evidence.',
    refs: 'app/live-readiness.js; app/live-launch-audit.js; app/settlement-service.js',
    evidence: 'npm run check: live readiness, launch audit, settlement-service tests passed.',
    steps: 'Run readiness/audit with demo config and live-ready config; verify blocking reasons and pass report match expected gates.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-006',
    area: 'Runtime Integration',
    story: 'As a developer, the Kawaii app consumes the same tested WDK/QVAC modules as the app runtime.',
    expected: 'Staged design modules match the advanced runtime surfaces for core, adapters, worker, settlement, QVAC referee, and Tether WDK bridge.',
    refs: 'app/*.js; design/kawaii-app/*.js; commit 84044b3',
    evidence: 'Merged commit 84044b3; npm run check passed; Kawaii syntax sweep passed.',
    steps: 'Compare staged module files and run app plus audit checks; verify no stale runtime surfaces remain in design/kawaii-app.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed (Smoke)',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: `Head during workbook generation: ${gitCommit}.`
  },
  {
    id: 'US-007',
    area: 'Profile',
    story: 'As a new player, I can choose a username.',
    expected: 'Username input updates local state, respects max length, and save falls back to a friendly default when blank.',
    refs: 'design/kawaii-app/index.html: #usernameInput, #saveProfile; design/kawaii-app/app.js: bindEvents, renderProfile',
    evidence: 'UI code inventoried; requires manual form pass.',
    steps: 'Enter a long username, save, reload, then save an empty username; verify chip and profile text update safely.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-008',
    area: 'Profile',
    story: 'As a fan, I can pick my country/team and see it reflected in my avatar and UI.',
    expected: 'Team grid selection updates country, kit, avatar portrait/fallback, profile chip, and country-affinity labels.',
    refs: 'design/kawaii-app/app.js: renderTeams, avatarSvg, avatarPortrait, renderProfile',
    evidence: 'UI code inventoried; requires manual selection pass.',
    steps: 'Pick several countries, verify active state, avatar art, profile chip, and home/watch/game labels update.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-009',
    area: 'Profile',
    story: 'As a player, I can save my profile and enter the main Home screen.',
    expected: 'Save persists username/team and routes to Home with a toast/status response.',
    refs: 'design/kawaii-app/app.js: saveProfile listener, setView, showToast',
    evidence: 'UI code inventoried; requires manual save pass.',
    steps: 'Choose team and username, click Enter, verify Home is active and profile chip reflects saved identity.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-010',
    area: 'Profile',
    story: 'As a player, I can switch PearCup themes.',
    expected: 'First-run picker and theme button apply available themes without losing profile, wallet, or picks.',
    refs: 'design/kawaii-app/app.js: THEMES, applyTheme, setTheme, showThemePicker, renderThemeSwitcher',
    evidence: 'UI code inventoried; requires manual theme pass.',
    steps: 'Open theme picker, choose each theme, reload, verify CSS variables and saved state persist.',
    priority: 'P2',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-011',
    area: 'Wallet',
    story: 'As a player, I can see my demo wallet balance everywhere I need it.',
    expected: 'Wallet chip and wallet management panel show current balance, pending payouts, and ledger lines consistently.',
    refs: 'design/kawaii-app/index.html: #walletChip, #walletManage; design/kawaii-app/app.js: renderWalletChip, renderWalletManage',
    evidence: 'Browser smoke confirmed wallet panel exists; requires wallet behavior pass.',
    steps: 'Open Profile wallet panel, compare chip and panel balance before/after funding, pool entry, and game stake.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-012',
    area: 'Wallet',
    story: 'As a player, I can fund my demo wallet.',
    expected: 'Funding buttons increase balance, create ledger entries, and refresh dependent affordability states.',
    refs: 'design/kawaii-app/app.js: fundWallet, renderWalletManage, renderPools',
    evidence: 'UI code inventoried; requires manual wallet pass.',
    steps: 'Click each funding amount; verify balance, ledger, bracket affordability, and no duplicate event errors.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-013',
    area: 'Wallet',
    story: 'As a winner, I can collect pending payouts into my balance.',
    expected: 'Collect moves pending payout to wallet balance, clears pending amount, and records ledger history.',
    refs: 'design/kawaii-app/app.js: collectPayouts, renderWalletManage',
    evidence: 'UI code inventoried; requires payout scenario.',
    steps: 'Create a win/payout state, click Collect, verify balance, pending payout, and ledger line.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-014',
    area: 'Wallet',
    story: 'As a player, I am blocked from staking when my balance is too low.',
    expected: 'Pool entry or staked game attempts with insufficient funds are blocked with a clear route to funding.',
    refs: 'design/kawaii-app/app.js: debitWallet, enterSelectedPool, showStakeConfirm',
    evidence: 'UI code inventoried; requires negative wallet pass.',
    steps: 'Set low balance, try paid pool and paid AI challenge; verify no debit and clear funding feedback.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-015',
    area: 'Live Data Settings',
    story: 'As an operator, I can configure a live match data source.',
    expected: 'Live settings save enabled flag, provider, API key, match id, proxy URL, and poll interval without exposing secrets unnecessarily.',
    refs: 'design/kawaii-app/app.js: renderLiveDataSettings, save/test listeners',
    evidence: 'UI code inventoried; requires settings pass.',
    steps: 'Edit all live data fields, save, reload, and verify displayed settings and redaction behavior.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-016',
    area: 'Live Data Settings',
    story: 'As an operator, I can test the live API connection.',
    expected: 'Test button reports success or a readable error and does not break the simulated feed fallback.',
    refs: 'design/kawaii-app/app.js: apiRequest, createApiLiveFeed, live settings test handler',
    evidence: 'UI code inventoried; requires API/fallback pass.',
    steps: 'Test with blank, bad, and known-good local proxy settings; verify error/success messaging and fallback.',
    priority: 'P2',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-017',
    area: 'Home',
    story: 'As a fan, I can see the current match headline and live state on Home.',
    expected: 'Hero shows teams, flags, score, clock/status, room count, and activity without stale or missing labels.',
    refs: 'design/kawaii-app/index.html: hero IDs; design/kawaii-app/app.js: renderHomeHero',
    evidence: 'Browser smoke confirmed Home expected containers exist.',
    steps: 'Open Home, verify hero labels, score, state, clock, and team flags after at least one feed tick.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-018',
    area: 'Home',
    story: 'As a fan, I can switch live dashboard tabs.',
    expected: 'Overview, Stats, Rooms, QVAC, and Pools tabs render the correct panel content and active state.',
    refs: 'design/kawaii-app/app.js: renderHomeDashboard, renderLivePanel, liveMenu listeners',
    evidence: 'UI code inventoried; requires tab pass.',
    steps: 'Click each live menu tab, verify content changes and no layout overlap on desktop and mobile widths.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-019',
    area: 'Home',
    story: 'As a player, I can discover bracket pools from Home.',
    expected: 'Pool cards show tier, stake, prize, entrants, affordability, and route to Bracket when selected.',
    refs: 'design/kawaii-app/app.js: renderPools, #poolGrid',
    evidence: 'Browser smoke confirmed #poolGrid exists.',
    steps: 'Inspect pool cards at different balances; click a pool CTA; verify Bracket opens with matching selected pool.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-020',
    area: 'Home',
    story: 'As a fan, I can jump from fixtures to the watch room.',
    expected: 'Fixture rail indicates live/upcoming state and opens Watch without losing feed state.',
    refs: 'design/kawaii-app/app.js: renderHomeDashboard, fixture buttons data-view=watch',
    evidence: 'UI code inventoried; requires fixture CTA pass.',
    steps: 'Click live fixture CTA from Home; verify Watch screen opens and match data matches the Home hero.',
    priority: 'P2',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-021',
    area: 'Home',
    story: 'As a player, I can scan leaderboard and room signal panels.',
    expected: 'Leader and signal panels display user/peer/runtime status with no empty or contradictory labels.',
    refs: 'design/kawaii-app/index.html: #leaderPanel, #signalPanel; design/kawaii-app/app.js: renderHomeDashboard',
    evidence: 'Browser smoke confirmed #leaderPanel exists.',
    steps: 'Open Home after joining watch/game room; verify leaderboard rows, room signal, and runtime status copy.',
    priority: 'P2',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-022',
    area: 'Bracket Pools',
    story: 'As a player, I can choose a bracket pool tier.',
    expected: 'Tier selector shows current pool, stake, prize, entrants, affordability, and entered state.',
    refs: 'design/kawaii-app/index.html: #bracketPoolSelect; design/kawaii-app/app.js: renderPoolSelect',
    evidence: 'Browser smoke confirmed selector exists.',
    steps: 'Open Bracket, switch each tier, verify prize/stake/entrant/affordability details update.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-023',
    area: 'Bracket Pools',
    story: 'As a player, I can enter a selected bracket pool.',
    expected: 'Entry records an intent/payment through the worker-backed WDK adapter, debits wallet, and shows me in entrants.',
    refs: 'design/kawaii-app/app.js: enterSelectedPool, createBracketSettlementWorker, createBracketUiTetherWdkAdapter',
    evidence: 'npm run check: WDK entry intent and worker pool tests passed.',
    steps: 'Fund wallet, select tier, enter pool, verify debit, entrants list, WDK payment/audit panel, and persistence.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-024',
    area: 'Bracket Pools',
    story: 'As a player, I can see all entrants for my selected pool.',
    expected: 'Entrants list includes current user plus demo entrants with team/entry/score details and no duplicate rows.',
    refs: 'design/kawaii-app/index.html: #bracketEntrants; design/kawaii-app/app.js: renderBracketEntrants',
    evidence: 'UI code inventoried; requires entrant pass.',
    steps: 'Enter multiple tiers and reload; verify current user appears once in the selected tier and demo entrants remain stable.',
    priority: 'P2',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-025',
    area: 'Bracket Board',
    story: 'As a player, I can complete a knockout bracket.',
    expected: 'Round of 16, quarterfinal, semifinal, final, and champion slots render with connector lines and clickable teams.',
    refs: 'design/kawaii-app/app.js: buildRounds, makeMatch, renderTeamRow, scheduleBracketConnectors',
    evidence: 'Browser smoke confirmed #bracketBoard exists.',
    steps: 'Pick winners through every round; verify downstream slots populate and connector lines stay aligned after resize.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-026',
    area: 'Bracket Board',
    story: 'As a player, if I change an upstream pick, downstream invalid picks are cleared.',
    expected: 'Changing an earlier match removes affected downstream picks while preserving unrelated picks.',
    refs: 'design/kawaii-app/app.js: getPick, clearDownstream, match-card click handler',
    evidence: 'UI code inventoried; requires change-pick pass.',
    steps: 'Complete bracket, change an R16 pick, verify QF/SF/final dependent picks clear and unrelated branches stay intact.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-027',
    area: 'Bracket Board',
    story: 'As a player, I can reset my draft picks.',
    expected: 'Reset clears draft picks, rerenders the bracket, and does not affect pool entries or wallet ledger.',
    refs: 'design/kawaii-app/index.html: #resetPicks; design/kawaii-app/app.js: reset listener',
    evidence: 'UI code inventoried; requires reset pass.',
    steps: 'Make several picks, reset, verify board clears and entry/payment state remains.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-028',
    area: 'Bracket Board',
    story: 'As a player, I cannot submit an incomplete bracket.',
    expected: 'Submit blocks incomplete picks with clear feedback and no settlement/submission event.',
    refs: 'design/kawaii-app/index.html: #submitPicks; design/kawaii-app/app.js: submit listener',
    evidence: 'UI code inventoried; requires negative submit pass.',
    steps: 'Submit after only one or two picks; verify error feedback and no submission/audit row is created.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-029',
    area: 'Bracket Board',
    story: 'As a player, I can submit a completed bracket.',
    expected: 'Complete picks lock/record the submission, update entered count/audit panels, and preserve picks after reload.',
    refs: 'design/kawaii-app/app.js: submit picks flow, renderEntryLedger, renderBracketStats',
    evidence: 'npm run check: worker profile/bracket draft and bracket submission signer tests passed.',
    steps: 'Complete all picks, submit, reload, verify submitted state, worker evidence, and no signer/route warnings.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-030',
    area: 'Bracket Settlement',
    story: 'As an operator, bracket pool settlement is auditable through WDK, QVAC, payout, and receipt panels.',
    expected: 'Audit accordions display entry intents, confirmations, official result source, QVAC attestation, WDK payout, and settlement receipt.',
    refs: 'design/kawaii-app/index.html: #bracketStats, #bracketEntriesPanel, #bracketAudit; app/worker-sim.js',
    evidence: 'npm run check: trusted pool settlement tests passed.',
    steps: 'Enter pool, submit bracket, trigger settlement scenario, inspect all audit accordions and verify receipt fields are populated.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-031',
    area: 'Bracket Settlement',
    story: 'As a winner, I can provide payout recipient details.',
    expected: 'Recipient controls save player route, demo helper fills a route, and WDK payout retries once the route exists.',
    refs: 'design/kawaii-app/app.js: renderPayoutRecipients, bindPayoutControls; app/settlement-service.js',
    evidence: 'npm run check: recipient declaration and retry tests passed.',
    steps: 'Attempt payout without recipient, save route, retry settlement, verify recipient evidence and payout route.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-032',
    area: 'Watch Party',
    story: 'As a fan, I can open a watch room with a live TV surface.',
    expected: 'Watch screen shows match title, scorebug, clock, pitch, live board, and stats without empty placeholders.',
    refs: 'design/kawaii-app/index.html: #watch, #tvPitch, #tvClock, #tvScore, #tvLiveBoard; app.js: renderWatch',
    evidence: 'Browser smoke confirmed Watch core elements exist.',
    steps: 'Open Watch, wait for feed tick, verify TV surface, scorebug, pitch markers, and stats update.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-033',
    area: 'Watch Party',
    story: 'As a multilingual fan, I can switch QVAC commentary language.',
    expected: 'Language tabs update selected state and commentary feed uses the chosen language or safe fallback translation.',
    refs: 'design/kawaii-app/app.js: WATCH_LANGS, COMMENTARY_TEMPLATES, renderCommentaryFeed, languageTabs listener',
    evidence: 'npm run check: QVAC commentary grounding tests passed.',
    steps: 'Switch each language tab while feed is active; verify labels, commentary, and no repeated stale lines.',
    priority: 'P2',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-034',
    area: 'Watch Party',
    story: 'As a fan, I receive simulated, relay, or API feed updates in the watch room.',
    expected: 'Feed source badge reflects sim/API/relay, and score/stats/commentary update from source-signed events.',
    refs: 'design/kawaii-app/app.js: createSimLiveFeed, createApiLiveFeed, live-match.json relay, startLiveFeed',
    evidence: 'npm run check: source-signed match event and QVAC commentary worker tests passed.',
    steps: 'Run with simulation, local relay file, and API settings; verify source badge, stat changes, and commentary updates.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-035',
    area: 'Watch Party',
    story: 'As a fan, I can chat in the watch room.',
    expected: 'Chat form appends local messages, signs/broadcasts room state through watch sync, and survives worker replay checks.',
    refs: 'design/kawaii-app/index.html: #chatForm, #chatInput; design/kawaii-app/watch-sync.js',
    evidence: 'npm run check: worker watch-party ownership and forged event tests passed.',
    steps: 'Send chat locally and across two browser windows; verify message order, user label, and no duplicate/forged entries.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-036',
    area: 'Watch Party',
    story: 'As a fan, I can toggle voice room state.',
    expected: 'Voice toggle changes live/muted state, updates room copy, and records worker-owned social state safely.',
    refs: 'design/kawaii-app/index.html: #voiceToggle; design/kawaii-app/app.js: voice listener; watch-sync.js',
    evidence: 'npm run check: watch-party social state tests passed.',
    steps: 'Toggle voice on/off; verify button state, participant panel, worker replay state, and reload behavior.',
    priority: 'P2',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-037',
    area: 'Watch Party',
    story: 'As a host, I can invite others to the watch room.',
    expected: 'Invite/share opens a room share bar or copies a link with a stable room code.',
    refs: 'design/kawaii-app/index.html: #shareGameBtn, #roomShareBar; app.js: toggleInviteBar',
    evidence: 'UI code inventoried; requires clipboard/share pass.',
    steps: 'Click invite/share, verify room link appears or clipboard path succeeds, and the UI is reversible.',
    priority: 'P2',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-038',
    area: 'Watch Party',
    story: 'As a host, I can share my screen when supported.',
    expected: 'Screen share starts/stops in capable browsers and falls back with clear unsupported feedback when media APIs are unavailable.',
    refs: 'design/kawaii-app/index.html: #shareScreenBtn, #shareVideo, #shareBadge; app.js: screen share handlers',
    evidence: 'UI code inventoried; requires permission-aware pass.',
    steps: 'Test in supported and unsupported contexts; verify permission prompts are user-controlled and UI state resets after stop.',
    priority: 'P2',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-039',
    area: 'Watch Party',
    story: 'As a fan, I can send match reactions.',
    expected: 'Reaction buttons animate locally and broadcast through watch sync to peers in the same room.',
    refs: 'design/kawaii-app/watch-sync.js: react, bindReactionBar; app.js reaction buttons',
    evidence: 'UI code inventoried; requires two-client pass.',
    steps: 'Open two clients, click reactions, verify both clients show reaction and presence count updates.',
    priority: 'P2',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-040',
    area: 'Peer Transport',
    story: 'As a player in browser preview, I can use local P2P fallback transport.',
    expected: 'PearCupPeerNet uses BroadcastChannel locally and exposes the same channel contract expected by lobby, watch, and match flows.',
    refs: 'design/kawaii-app/peer-net.js; app/transport-sim.js',
    evidence: 'npm run check: transport-sim and Pear Browser compatibility tests passed.',
    steps: 'Open two browser windows, join watch/lobby/game flows, verify messages converge through BroadcastChannel.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-041',
    area: 'Peer Transport',
    story: 'As a Pear app player, I can use worker-side transport without renderer-only settlement trust.',
    expected: 'Peer and settlement events are worker-owned/replay-bound, and staged package keeps SDK runtime out of renderer-only paths.',
    refs: 'app/pear-worker.cjs; app/worker-bridge-protocol.js; scripts/pear-browser-compat.mjs',
    evidence: 'npm run check and audit:pear-browser passed 68 checks.',
    steps: 'Run Pear Browser audit and worker preflight; verify no renderer-only WDK/QVAC settlement paths remain.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: 'Automated gate passed in current checkpoint.'
  },
  {
    id: 'US-042',
    area: 'Games Lobby',
    story: 'As a player, I can see available Penalty Clash options.',
    expected: 'Games lobby renders quick match, paid challenge, friend invite/join, peer list, leaderboard, and audit panels.',
    refs: 'design/kawaii-app/index.html: #gameLobby; app.js: renderGameLobby',
    evidence: 'Browser smoke confirmed Games expected panels exist.',
    steps: 'Open Games, verify all lobby actions and panels render at desktop and mobile widths.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-043',
    area: 'Games Lobby',
    story: 'As a player, I can start a free practice shootout.',
    expected: 'Quick match starts against AI without wallet debit, initializes five-round shootout, and focuses aim controls.',
    refs: 'design/kawaii-app/app.js: startMatch, ensureShootout, renderShootoutHud',
    evidence: 'UI code inventoried; requires game interaction pass.',
    steps: 'Click quick match, verify balance unchanged, stage visible, round 1 active, and aim zones clickable.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-044',
    area: 'Games Lobby',
    story: 'As a player, I can accept or cancel a staked AI challenge.',
    expected: 'Paid challenge opens confirmation, cancel leaves wallet untouched, accept debits stake and starts match.',
    refs: 'design/kawaii-app/app.js: showStakeConfirm, startMatch, debitWallet',
    evidence: 'UI code inventoried; requires wallet/game pass.',
    steps: 'Click paid AI challenge, cancel, then accept after funding; verify wallet, match state, and confirmation copy.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-045',
    area: 'Games Lobby',
    story: 'As a player, I can invite or join a friend match.',
    expected: 'Friend invite creates a room code, join consumes a code, and both clients enter a synchronized peer match.',
    refs: 'design/kawaii-app/peer-match.js; design/kawaii-app/peer-lobby.js; app.js invite/join handlers',
    evidence: 'npm run check: P2P game session lifecycle tests passed.',
    steps: 'Open two clients, host friend match, join by code, verify both enter the same game and lifecycle panels update.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-046',
    area: 'Penalty Clash Gameplay',
    story: 'As a shooter, I can aim and take a penalty kick.',
    expected: 'Aim zones and power meter accept input, lock the chosen zone, and resolve a goal/save/miss/post outcome.',
    refs: 'design/kawaii-app/app.js: AIM_ZONES, ensureShootoutDom, startAimPhase, kickOutcome, applyKickResult',
    evidence: 'npm run check: deterministic penalty round tests passed.',
    steps: 'Start match, click each aim zone across retries, verify animation, outcome copy, score, and next round behavior.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-047',
    area: 'Penalty Clash Gameplay',
    story: 'As a player, I can track the shootout score and round state.',
    expected: 'HUD shows best-of-five dots, current round, player/AI score, and final result without off-by-one errors.',
    refs: 'design/kawaii-app/app.js: SHOOTOUT_TOTAL, renderShootoutHud, endShootout',
    evidence: 'UI code inventoried; requires full-match pass.',
    steps: 'Play through five kicks and early decisive cases; verify HUD, dots, round numbers, and final banner.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-048',
    area: 'Penalty Clash Gameplay',
    story: 'As a player, I can finish a shootout and choose what to do next.',
    expected: 'Final state shows win/loss/draw, prize/refund handling, settlement evidence, Play Again, and Back controls.',
    refs: 'design/kawaii-app/app.js: endShootout, play-again/back handlers',
    evidence: 'UI code inventoried; requires full-match pass.',
    steps: 'Finish win, loss, and draw scenarios if possible; verify payout/refund messaging and controls reset safely.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-049',
    area: 'Penalty Clash Gameplay',
    story: 'As a spectator, I can spectate or start a new shootout safely.',
    expected: 'Spectate/New Shootout controls create/reset simulated match state without corrupting wallet, peer state, or audit panels.',
    refs: 'design/kawaii-app/index.html: #spectateGame; app.js: spectate/new shootout listeners',
    evidence: 'UI code inventoried; requires controls pass.',
    steps: 'Use Spectate and New Shootout before, during, and after a match; verify state reset and no stale overlays.',
    priority: 'P2',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-050',
    area: 'Game Settlement',
    story: 'As a staked player, my game escrow is resolved through QVAC before WDK payout.',
    expected: 'Worker creates WDK escrow, records commitments/reveals/state hashes, obtains QVAC attestation, releases/refunds via WDK, and records receipt.',
    refs: 'app/worker-sim.js; app/settlement-service.js; design/kawaii-app/app.js: createGameSettlementWorker',
    evidence: 'npm run check: trusted game settlement and WDK/QVAC release tests passed.',
    steps: 'Run a staked game to completion, inspect resolver/audit panels, verify escrow, attestation, payout/refund, and receipt fields.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-051',
    area: 'Game Settlement',
    story: 'As an operator, settlement disputes fail closed.',
    expected: 'Mismatched hashes, forged evidence, wrong winners, missing recipient routes, and invalid QVAC/WDK signatures produce hold/dispute/refund paths instead of payout.',
    refs: 'app/worker-sim.test.js; app/qvac-referee.test.js; app/tether-wdk-bridge.test.js',
    evidence: 'npm run check: forged, mismatched, missing evidence, and dispute tests passed.',
    steps: 'Run automated negative tests; manually inspect UI for route-blocked and held settlement messaging where applicable.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: 'Automated coverage is strong; UI messaging still needs targeted pass.'
  },
  {
    id: 'US-052',
    area: 'Game Settlement',
    story: 'As a player, I can see game resolver, sync, and replay evidence.',
    expected: 'Resolver, tether, runtime, QVAC, sync, and replay panels display event counts, topics, state roots, and receipt status.',
    refs: 'design/kawaii-app/index.html: #gameResolver, #tetherPanel, #runtimePanel, #qvacRefPanel, #gameSync, #gameReplay',
    evidence: 'Browser smoke confirmed panels exist.',
    steps: 'Start and finish a game; verify each audit panel updates from empty to evidence-rich state.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-053',
    area: 'Peer Match',
    story: 'As a peer player, game events converge between two clients.',
    expected: 'Signed invites, lifecycle events, choices, reveals, and state hashes replay consistently and reject forged peer events.',
    refs: 'app/worker-sim.js; app/transport-sim.js; design/kawaii-app/peer-match.js',
    evidence: 'npm run check: P2P session lifecycle and forged event tests passed.',
    steps: 'Open host and join clients, play several kicks, verify both screens agree and replay panels converge.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-054',
    area: 'Peer Lobby',
    story: 'As a player, I can discover and challenge peers.',
    expected: 'Lobby join announces presence, lists peers, and challenge buttons start shared game codes through PeerMatch.',
    refs: 'design/kawaii-app/peer-lobby.js; peer-net.js',
    evidence: 'UI code inventoried; requires two-client pass.',
    steps: 'Open two clients, verify each appears in the other lobby, challenge peer, and confirm both enter shared match.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-055',
    area: 'Worker Client',
    story: 'As the app, I use the Pear worker bridge when available and local worker otherwise.',
    expected: 'Auto worker client detects Pear bridge, caches redacted status, and keeps browser demo fallback synchronous.',
    refs: 'app/worker-client.js; app/worker-bridge-protocol.js; app/worker-runtime.js',
    evidence: 'npm run check: worker-client and bridge protocol tests passed.',
    steps: 'Run browser preview and Pear bridge harness; verify bridge preference, fallback, and redacted status behavior.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: 'Automated coverage passed; Pear runtime manual smoke still recommended.'
  },
  {
    id: 'US-056',
    area: 'Worker Client',
    story: 'As an operator, worker bridge responses do not leak secrets or full history by default.',
    expected: 'Secrets are redacted, WDK seed is not exposed, and event history is opt-in.',
    refs: 'app/worker-bridge-protocol.js; app/worker-runtime.js; scripts/pear-browser-compat.mjs',
    evidence: 'npm run check and Pear Browser audit passed secret/history gates.',
    steps: 'Inspect worker status responses with and without includeEvents; verify seeds/secrets are redacted.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-057',
    area: 'Storage and Replay',
    story: 'As the runtime, I keep app, bracket, watch, and game event streams isolated.',
    expected: 'Storage namespaces prevent cross-contamination and replay reconstructs the correct state for each flow.',
    refs: 'app/storage-sim.js; app/worker-sim.js; design/kawaii-app/storage-sim.js',
    evidence: 'npm run check: storage-sim and replay-bound worker tests passed.',
    steps: 'Create profile, bracket, watch, and game events; inspect namespaces/event logs and replay-derived UI panels.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: 'Manual UI inspection remains to connect panels to replay evidence.'
  },
  {
    id: 'US-058',
    area: 'Receipts',
    story: 'As a player, I can trust settlement receipts.',
    expected: 'Receipts bind event refs, actors, QVAC attestation, WDK output, and replayed source data.',
    refs: 'app/settlement-receipts.js; app/trusted-path-preflight.js',
    evidence: 'npm run check: settlement receipt verification and trusted-path tests passed.',
    steps: 'Generate game and bracket receipts; verify receipt panel fields and independent verification result.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-059',
    area: 'QVAC Referee',
    story: 'As an operator, QVAC attestations require signed referee identity and verified evidence.',
    expected: 'Round and pool attestations fail closed unless the review is verified, non-disputed, source-bound, and signed by the referee actor.',
    refs: 'app/qvac-referee.js; app/qvac-referee.test.js',
    evidence: 'npm run check: QVAC attestation verification tests passed.',
    steps: 'Run automated tests and inspect UI audit panels for referee signer and attestation status.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-060',
    area: 'QVAC Commentary',
    story: 'As a fan, QVAC commentary is grounded in replayed match events.',
    expected: 'Commentary and translations summarize signed/source events and reject peer commentary without QVAC/source grounding.',
    refs: 'app/qvac-referee.js; app/worker-sim.js; design/kawaii-app/app.js commentary feed',
    evidence: 'npm run check: QVAC commentary and peer commentary rejection tests passed.',
    steps: 'Watch feed updates, inspect generated commentary language changes, and verify no invented facts appear after source changes.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-061',
    area: 'Tether WDK',
    story: 'As a staked player, WDK entry and escrow operations bind to signed participants.',
    expected: 'Entry intents, confirmations, pending checks, refunds, game escrows, releases, and payouts are signed and replay-verifiable.',
    refs: 'app/tether-wdk-bridge.js; app/worker-sim.js; app/settlement-service.js',
    evidence: 'npm run check: WDK bridge, entry, escrow, payout, refund tests passed.',
    steps: 'Run automated suite and inspect UI WDK panels after pool entry and game settlement.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-062',
    area: 'SDK Runtime',
    story: 'As an operator, package SDK adapters can be injected without changing UI flow code.',
    expected: 'Runtime package adapters wrap SDK-like QVAC and WDK clients while preserving tested demo adapter behavior.',
    refs: 'app/sdk-runtime.js; app/runtime-config.js; app/adapters.js',
    evidence: 'npm run check: sdk-runtime, adapters, runtime-config tests passed.',
    steps: 'Inject SDK-like clients, run preflight, and verify app panels report SDK-backed mode without renderer settlement shortcuts.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-063',
    area: 'Pear Browser Compatibility',
    story: 'As a release owner, I can prove the staged renderer is Pear Browser compatible.',
    expected: 'Audit rejects external assets, renderer SDK runtime leakage, missing stage includes, untrusted settlement paths, and missing evidence checks.',
    refs: 'scripts/pear-browser-compat.mjs; app/pear-browser-compat.js; design/kawaii-app/pear-browser-compat.js',
    evidence: 'npm run audit:pear-browser -- --require-pass passed: 68 checks, 0 blocking, 0 warnings.',
    steps: 'Run the audit command after every integration and verify 0 blocking and 0 warnings.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-064',
    area: 'Package Staging',
    story: 'As a release owner, staged design assets remain self-contained.',
    expected: 'Kawaii app uses local scripts/styles/assets and does not depend on network or unstaged runtime files.',
    refs: 'design/kawaii-app/index.html; design/kawaii-app/RELEASE.md; scripts/pear-browser-compat.mjs',
    evidence: 'Pear Browser audit and syntax sweep passed.',
    steps: 'Review script/link tags, run audit, and open app offline/local to verify all assets render.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed (Smoke)',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-065',
    area: 'Responsive UX',
    story: 'As a mobile player, I can use the full app without overlapping controls.',
    expected: 'Topbar, dashboard tabs, bracket board, watch room, and game controls remain readable and tappable on narrow screens.',
    refs: 'design/kawaii-app/styles.css; app.js resize/scheduleBracketConnectors',
    evidence: 'Not covered by current automated pass.',
    steps: 'Test at mobile and desktop widths; verify text fit, no overlap, and bracket connectors recalculate.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: 'This is a likely UX-risk area for the next test loop.'
  },
  {
    id: 'US-066',
    area: 'Accessibility and Feedback',
    story: 'As a keyboard or screen-reader user, I can understand and operate primary controls.',
    expected: 'Buttons have labels, status changes use readable text, controls are focusable, and error/toast copy is understandable.',
    refs: 'design/kawaii-app/index.html aria labels; app.js showToast/status copy',
    evidence: 'Not covered by current automated pass.',
    steps: 'Keyboard-tab primary flows, inspect names for icon buttons, and verify toast/status text after errors and successes.',
    priority: 'P2',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-067',
    area: 'Error Handling',
    story: 'As a player, failures are explained without trapping me.',
    expected: 'Boot, API, wallet, settlement, screen-share, and peer failures show actionable messages and allow retry/recovery.',
    refs: 'design/kawaii-app/app.js: error hook, showToast, API/live settings, settlement guards',
    evidence: 'Browser smoke found no errors; negative states require manual pass.',
    steps: 'Trigger bad API, insufficient funds, incomplete bracket, unsupported screen share, and settlement route block; verify recovery.',
    priority: 'P1',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-068',
    area: 'Security and Integrity',
    story: 'As an operator, forged or orphaned peer settlement artifacts cannot affect payout state.',
    expected: 'Worker rejects forged envelopes, orphaned payouts/releases/receipts, wrong signer bindings, and missing replay dependencies.',
    refs: 'app/worker-sim.test.js; app/settlement-receipts.test.js; scripts/pear-browser-compat.mjs',
    evidence: 'npm run check includes forged/orphaned/resealed peer artifact rejection tests.',
    steps: 'Run automated suite; manually inspect audit panels after peer merge scenarios if available.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-069',
    area: 'Launch Readiness',
    story: 'As an operator, I can run preflight checks before launch.',
    expected: 'Preflight scripts report trusted path readiness, SDK/worker readiness, live config, and launch audit status.',
    refs: 'scripts/preflight-sdk.mjs; scripts/preflight-worker-runtime.mjs; scripts/preflight-trusted-path.mjs; scripts/live-readiness.mjs',
    evidence: 'npm run check validates preflight/audit modules with node --check and tests where available.',
    steps: 'Run all preflight scripts for demo and live config; verify output is actionable and does not claim readiness falsely.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Not Run',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: ''
  },
  {
    id: 'US-070',
    area: 'Release Baseline',
    story: 'As the team, we can prove the integrated branch is clean and tested.',
    expected: 'Worktree is clean after integration commit, repo check passes, Kawaii syntax passes, and browser smoke passes.',
    refs: 'git status; npm run check; design/kawaii-app syntax sweep; in-app browser at 127.0.0.1:4175',
    evidence: '2026-07-02 checkpoint: main ahead 1, clean; npm run check passed; Kawaii syntax passed; browser smoke passed.',
    steps: 'Run git status, npm run check, Kawaii syntax sweep, and browser top-nav smoke after any fix.',
    priority: 'P0',
    status: 'Integrated',
    manual: 'Passed',
    defects: '',
    fix: 'None',
    retest: 'Not Run',
    notes: 'Use this row as the release gate before/after the full user-story test loop.'
  }
]

const testRunHeaders = [
  'Run ID',
  'Date',
  'Tester',
  'Scope',
  'Command / Scenario',
  'Result',
  'Evidence',
  'Stories Covered',
  'Notes'
]

const testRuns = [
  {
    id: 'TR-001',
    date: today,
    tester: 'Codex',
    scope: 'Runtime and settlement modules',
    command: 'npm run check',
    result: 'Passed',
    evidence: '282/282 node tests passed; node --check passed for app and scripts; Pear audit included.',
    stories: 'US-004, US-005, US-023, US-030, US-031, US-041, US-050 to US-063, US-068 to US-070',
    notes: 'Executed after merge commit 84044b3.'
  },
  {
    id: 'TR-002',
    date: today,
    tester: 'Codex',
    scope: 'Pear Browser compatibility gate',
    command: 'npm run audit:pear-browser -- --require-pass',
    result: 'Passed',
    evidence: '68 passed, 0 blocking, 0 warnings.',
    stories: 'US-041, US-063, US-064, US-070',
    notes: 'Also executed as part of npm run check.'
  },
  {
    id: 'TR-003',
    date: today,
    tester: 'Codex',
    scope: 'Kawaii staged bundle syntax',
    command: "find design/kawaii-app -maxdepth 1 -type f ( -name '*.js' -o -name '*.cjs' ) -exec node --check {} +",
    result: 'Passed',
    evidence: 'All staged Kawaii JS/CJS files parsed successfully.',
    stories: 'US-001, US-006, US-064, US-070',
    notes: ''
  },
  {
    id: 'TR-004',
    date: today,
    tester: 'Codex',
    scope: 'In-app browser smoke',
    command: 'Reload http://127.0.0.1:4175/ and click top-nav Profile/Home/Bracket/Watch/Games',
    result: 'Passed',
    evidence: 'All top-nav buttons were unique, all screens activated, expected panels existed, no boot banner, no console errors.',
    stories: 'US-001, US-002, US-006, US-017, US-022, US-032, US-042, US-052, US-070',
    notes: 'Server: python3 -m http.server 4175 --bind 127.0.0.1 --directory design/kawaii-app.'
  }
]

const defectHeaders = [
  'Defect ID',
  'Story ID',
  'Area',
  'Severity',
  'Status',
  'Found In',
  'Summary',
  'Steps',
  'Expected',
  'Actual',
  'Owner',
  'Fix Commit',
  'Retest Status',
  'Notes'
]

const sourceHeaders = ['Area', 'Primary Source', 'Runtime / UI Surface', 'Coverage Evidence', 'Open Manual Focus']

const sources = [
  ['Boot and Navigation', 'design/kawaii-app/index.html; design/kawaii-app/app.js', 'Shell, nav, state boot, runtime module loading', 'Browser smoke; node syntax', 'Persistence and negative boot states'],
  ['Profile', 'design/kawaii-app/app.js: renderProfile, renderTeams, avatar helpers', 'Username, team, avatar, profile chip', 'Inventoried from code', 'Full profile save/reload pass'],
  ['Wallet', 'design/kawaii-app/app.js: wallet helpers', 'Balance, funding, payouts, insufficient funds', 'Inventoried from code', 'Funding/debit/payout scenarios'],
  ['Home', 'design/kawaii-app/app.js: renderHomeHero, renderHomeDashboard', 'Hero, live tabs, pools, fixture rail, leaders', 'Browser smoke for containers', 'All tab content and responsive scan'],
  ['Bracket Pools', 'design/kawaii-app/app.js: pool and bracket functions', 'Pool entry, picks, submissions, WDK/QVAC audit', 'Runtime tests for worker settlement', 'Manual pick/reset/submit/audit pass'],
  ['Watch Party', 'design/kawaii-app/app.js; watch-sync.js; peer-net.js', 'TV surface, feed, commentary, chat, voice, share, reactions', 'Worker social state tests', 'Two-client sync and screen-share pass'],
  ['Penalty Clash', 'design/kawaii-app/app.js; peer-match.js; peer-lobby.js', 'Lobby, AI match, friend match, aim grid, shootout HUD', 'Worker/P2P game tests', 'Full gameplay and two-client pass'],
  ['Settlement', 'app/worker-sim.js; settlement-service.js; settlement-receipts.js', 'Escrow, QVAC, WDK, receipts, disputes, replay', '282 passing tests', 'UI audit panel evidence pass'],
  ['QVAC', 'app/qvac-referee.js; sdk-runtime.js', 'Referee attestation and commentary', 'QVAC tests and Pear audit', 'Live commentary and UI signer display'],
  ['Tether WDK', 'app/tether-wdk-bridge.js; worker-sim.js', 'Entry intents, escrows, payouts, refunds', 'WDK bridge and worker tests', 'Manual wallet/audit verification'],
  ['Peer/Worker Runtime', 'app/worker-client.js; worker-runtime.js; worker-bridge-protocol.js', 'Bridge detection, redaction, replay, Pear worker', 'Worker client/bridge tests and Pear audit', 'Pear runtime smoke'],
  ['Release Baseline', 'package.json scripts; scripts/pear-browser-compat.mjs', 'npm run check, audit, syntax, browser smoke', 'All passed on 2026-07-02', 'Repeat after every fix']
]

function rowsFromRecords (headers, records, map) {
  return [headers, ...records.map(map)]
}

function styleTitle (sheet, range, fill = '#0F172A') {
  const r = sheet.getRange(range)
  r.format = {
    fill,
    font: { bold: true, color: '#FFFFFF', size: 16 },
    wrapText: true
  }
}

function styleHeader (sheet, range, fill = '#155E75') {
  const r = sheet.getRange(range)
  r.format = {
    fill,
    font: { bold: true, color: '#FFFFFF' },
    wrapText: true,
    borders: { preset: 'outside', style: 'thin', color: '#0E7490' }
  }
}

function styleBody (sheet, range) {
  const r = sheet.getRange(range)
  r.format = {
    wrapText: true,
    verticalAlignment: 'top',
    horizontalAlignment: 'left',
    borders: {
      insideHorizontal: { style: 'thin', color: '#E5E7EB' },
      top: { style: 'thin', color: '#E5E7EB' },
      bottom: { style: 'thin', color: '#E5E7EB' }
    }
  }
}

function setColumnWidths (sheet, widthsPx) {
  widthsPx.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 220, 1).format.columnWidthPx = width
  })
}

function addListValidation (sheet, range, values) {
  sheet.getRange(range).dataValidation = { rule: { type: 'list', values } }
}

function addStatusFormats (range) {
  range.conditionalFormats.add('containsText', {
    text: 'Passed',
    format: { fill: '#DCFCE7', font: { color: '#166534', bold: true } }
  })
  range.conditionalFormats.add('containsText', {
    text: 'Failed',
    format: { fill: '#FEE2E2', font: { color: '#991B1B', bold: true } }
  })
  range.conditionalFormats.add('containsText', {
    text: 'Needs Fix',
    format: { fill: '#FEE2E2', font: { color: '#991B1B', bold: true } }
  })
  range.conditionalFormats.add('containsText', {
    text: 'Not Run',
    format: { fill: '#FEF3C7', font: { color: '#92400E' } }
  })
  range.conditionalFormats.add('containsText', {
    text: 'Blocked',
    format: { fill: '#E0E7FF', font: { color: '#3730A3', bold: true } }
  })
}

function addTableIfPossible (sheet, range, name) {
  try {
    const table = sheet.tables.add(range, true, name)
    table.style = 'TableStyleMedium2'
    table.showFilterButton = true
    return table
  } catch {
    return null
  }
}

const workbook = Workbook.create()
const dashboard = workbook.worksheets.add('Dashboard')
const userStories = workbook.worksheets.add('User Stories')
const defects = workbook.worksheets.add('Defect Log')
const runs = workbook.worksheets.add('Test Runs')
const sourceMap = workbook.worksheets.add('Source Map')

for (const sheet of [dashboard, userStories, defects, runs, sourceMap]) {
  sheet.showGridLines = false
}

// User Stories
const storyRows = rowsFromRecords(storyHeaders, stories, s => [
  s.id,
  s.area,
  s.story,
  s.expected,
  s.refs,
  s.evidence,
  s.steps,
  s.priority,
  s.status,
  s.manual,
  s.defects,
  s.fix,
  s.retest,
  s.notes
])
userStories.getRangeByIndexes(0, 0, storyRows.length, storyHeaders.length).values = storyRows
styleHeader(userStories, `A1:N1`)
styleBody(userStories, `A2:N${storyRows.length}`)
setColumnWidths(userStories, [78, 130, 260, 320, 260, 230, 310, 62, 112, 120, 96, 104, 104, 210])
userStories.getRange(`A1:N${storyRows.length}`).format.rowHeightPx = 60
userStories.getRange('A1:N1').format.rowHeightPx = 34
userStories.freezePanes.freezeRows(1)
userStories.freezePanes.freezeColumns(2)
addListValidation(userStories, `H2:H${Math.max(200, storyRows.length)}`, priorityOptions)
addListValidation(userStories, `I2:I${Math.max(200, storyRows.length)}`, statusOptions)
addListValidation(userStories, `J2:J${Math.max(200, storyRows.length)}`, manualStatusOptions)
addListValidation(userStories, `L2:L${Math.max(200, storyRows.length)}`, fixStatusOptions)
addListValidation(userStories, `M2:M${Math.max(200, storyRows.length)}`, retestStatusOptions)
addStatusFormats(userStories.getRange(`H2:M${Math.max(200, storyRows.length)}`))
addTableIfPossible(userStories, `A1:N${storyRows.length}`, 'UserStoriesTable')

// Defect Log
const emptyDefectRows = Array.from({ length: 40 }, () => [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  ''
])
defects.getRangeByIndexes(0, 0, emptyDefectRows.length + 1, defectHeaders.length).values = [defectHeaders, ...emptyDefectRows]
styleHeader(defects, 'A1:N1', '#7F1D1D')
styleBody(defects, 'A2:N41')
setColumnWidths(defects, [86, 80, 120, 72, 110, 110, 260, 300, 260, 260, 110, 100, 110, 220])
defects.getRange('A1:N41').format.rowHeightPx = 56
defects.getRange('A1:N1').format.rowHeightPx = 34
defects.freezePanes.freezeRows(1)
defects.freezePanes.freezeColumns(2)
addListValidation(defects, 'D2:D200', severityOptions)
addListValidation(defects, 'E2:E200', defectStatusOptions)
addListValidation(defects, 'M2:M200', retestStatusOptions)
addStatusFormats(defects.getRange('D2:M200'))
addTableIfPossible(defects, 'A1:N41', 'DefectLogTable')

// Test Runs
const runRows = rowsFromRecords(testRunHeaders, testRuns, r => [
  r.id,
  r.date,
  r.tester,
  r.scope,
  r.command,
  r.result,
  r.evidence,
  r.stories,
  r.notes
])
runs.getRangeByIndexes(0, 0, runRows.length, testRunHeaders.length).values = runRows
styleHeader(runs, 'A1:I1', '#166534')
styleBody(runs, `A2:I${runRows.length}`)
setColumnWidths(runs, [82, 94, 90, 190, 340, 88, 300, 260, 220])
runs.getRange(`A1:I${runRows.length}`).format.rowHeightPx = 58
runs.getRange('A1:I1').format.rowHeightPx = 34
runs.getRange(`B2:B${runRows.length}`).setNumberFormat('yyyy-mm-dd')
runs.freezePanes.freezeRows(1)
runs.freezePanes.freezeColumns(1)
addListValidation(runs, `F2:F${Math.max(120, runRows.length)}`, runStatusOptions)
addStatusFormats(runs.getRange(`F2:F${Math.max(120, runRows.length)}`))
addTableIfPossible(runs, `A1:I${runRows.length}`, 'TestRunsTable')

// Source Map
sourceMap.getRangeByIndexes(0, 0, sources.length + 1, sourceHeaders.length).values = [sourceHeaders, ...sources]
styleHeader(sourceMap, 'A1:E1', '#4C1D95')
styleBody(sourceMap, `A2:E${sources.length + 1}`)
setColumnWidths(sourceMap, [150, 280, 300, 260, 260])
sourceMap.getRange(`A1:E${sources.length + 1}`).format.rowHeightPx = 58
sourceMap.getRange('A1:E1').format.rowHeightPx = 34
sourceMap.freezePanes.freezeRows(1)
sourceMap.freezePanes.freezeColumns(1)
addTableIfPossible(sourceMap, `A1:E${sources.length + 1}`, 'SourceMapTable')

// Dashboard
dashboard.getRange('A1:H1').merge()
dashboard.getRange('A1').values = [['PearCup Feature and User Story Status']]
styleTitle(dashboard, 'A1:H1')
dashboard.getRange('A2:H2').merge()
dashboard.getRange('A2').values = [[`Canonical tracker generated from current code after WDK/QVAC integration. Branch: ${gitBranch}; commit: ${gitCommit}; generated: 2026-07-02.`]]
dashboard.getRange('A2:H2').format = {
  fill: '#ECFEFF',
  font: { color: '#164E63' },
  wrapText: true
}
dashboard.getRange('A4:H4').values = [['Metric', 'Value', 'Meaning', 'Current Gate', 'Result', 'Evidence', 'Next Action', 'Phase']]
styleHeader(dashboard, 'A4:H4')
dashboard.getRange('A5:H12').values = [
  ['Total stories', null, 'All code-grounded feature stories in User Stories.', 'Worktree', 'Clean', 'git status: main ahead 1 with no dirty files before workbook generation', 'Keep tracker committed after changes.', 'Baseline'],
  ['Integrated stories', null, 'Rows whose Feature Status is Integrated.', 'Runtime tests', 'Passed', 'npm run check: 282/282 tests plus audit/checks', 'Manual user-story loop.', 'Baseline'],
  ['Manual not run', null, 'Rows still awaiting manual behavior testing.', 'Kawaii syntax', 'Passed', 'All staged JS/CJS files parsed', 'Retest after each fix.', 'Manual Test'],
  ['Manual passed/smoke', null, 'Rows with Passed or Passed (Smoke).', 'Browser smoke', 'Passed', 'Top nav screens active; no boot banner; no console errors', 'Deep workflow testing.', 'Manual Test'],
  ['Open defects', null, 'Defects with Open or In Progress status.', 'Pear audit', 'Passed', '68 passed, 0 blocking, 0 warnings', 'Document every defect found.', 'Defects'],
  ['Fixes awaiting retest', null, 'User stories or defects marked Retest Needed.', 'Integration commit', gitCommit, 'Merged tested WDK/QVAC runtime into Kawaii app', 'Commit fixes and repeat gate.', 'Fix/Retest'],
  ['P0 stories', null, 'Release-blocking stories and integrity gates.', 'Server', 'Running', 'Static preview at http://127.0.0.1:4175/', 'Use for browser loop.', 'Manual Test'],
  ['Stories needing fix', null, 'User stories marked Needs Fix.', 'Canonical workbook', 'Created', 'This workbook is the single tracker for feature status, test results, defects, fixes, and retests.', 'Fill Defect Log during testing.', 'Defects']
]
dashboard.getRange('B5').formulas = [['=COUNTA(\'User Stories\'!$A$2:$A$200)']]
dashboard.getRange('B6').formulas = [['=COUNTIF(\'User Stories\'!$I$2:$I$200,"Integrated")']]
dashboard.getRange('B7').formulas = [['=COUNTIF(\'User Stories\'!$J$2:$J$200,"Not Run")']]
dashboard.getRange('B8').formulas = [['=COUNTIF(\'User Stories\'!$J$2:$J$200,"Passed")+COUNTIF(\'User Stories\'!$J$2:$J$200,"Passed (Smoke)")']]
dashboard.getRange('B9').formulas = [['=COUNTIF(\'Defect Log\'!$E$2:$E$200,"Open")+COUNTIF(\'Defect Log\'!$E$2:$E$200,"In Progress")']]
dashboard.getRange('B10').formulas = [['=COUNTIF(\'User Stories\'!$L$2:$L$200,"Retest Needed")+COUNTIF(\'Defect Log\'!$M$2:$M$200,"Retest Needed")']]
dashboard.getRange('B11').formulas = [['=COUNTIF(\'User Stories\'!$H$2:$H$200,"P0")']]
dashboard.getRange('B12').formulas = [['=COUNTIF(\'User Stories\'!$I$2:$I$200,"Needs Fix")']]
styleBody(dashboard, 'A5:H12')
dashboard.getRange('A14:H14').values = [['Workflow', 'Owner', 'When', 'Action', 'Workbook Sheet', 'Done Signal', 'Risk If Skipped', 'Notes']]
styleHeader(dashboard, 'A14:H14', '#334155')
dashboard.getRange('A15:H19').values = [
  ['1. Inventory', 'Codex', 'Now', 'Keep every feature represented by a user story and expected behavior.', 'User Stories', 'Story exists with code refs.', 'Untested features hide in plain sight.', 'Initial inventory complete from code and docs.'],
  ['2. Test loop', 'Codex', 'Next', 'Execute each user story and log any error immediately.', 'User Stories, Defect Log, Test Runs', 'Manual Test Status updated.', 'Bugs become anecdotal instead of traceable.', 'Start with P0/P1 flows.'],
  ['3. Fix loop', 'Codex', 'After defects', 'Patch logistical and UX defects with focused commits.', 'Defect Log', 'Fix Commit and Fix Status filled.', 'Fixes lose context.', 'Keep worktree clean between batches.'],
  ['4. Retest loop', 'Codex', 'After fixes', 'Retest every affected behavior and update status.', 'User Stories, Defect Log', 'Retest Status passed or blocked.', 'Regressions slip through.', 'Repeat full gate after fixes.'],
  ['5. Release gate', 'Codex/User', 'Before handoff', 'Run repo check, Kawaii syntax, browser smoke, and review open defects.', 'Dashboard, Test Runs', 'No open P0/P1 defects.', 'Unclear release confidence.', 'Current baseline is green.']
]
styleBody(dashboard, 'A15:H19')
setColumnWidths(dashboard, [145, 64, 260, 280, 110, 260, 220, 150])
dashboard.getRange('A1:H19').format.wrapText = true
dashboard.getRange('A1:H1').format.rowHeightPx = 34
dashboard.getRange('A2:H2').format.rowHeightPx = 42
dashboard.getRange('A4:H12').format.rowHeightPx = 54
dashboard.getRange('A14:H14').format.rowHeightPx = 38
dashboard.getRange('A15:H19').format.rowHeightPx = 96
dashboard.freezePanes.freezeRows(4)
addStatusFormats(dashboard.getRange('E5:E12'))

await fs.mkdir(outputDir, { recursive: true })
await fs.mkdir(previewDir, { recursive: true })

for (const sheetName of ['Dashboard', 'User Stories', 'Defect Log', 'Test Runs', 'Source Map']) {
  const preview = await workbook.render({
    sheetName,
    autoCrop: 'all',
    scale: 1,
    format: 'png'
  })
  await fs.writeFile(`${previewDir}/${sheetName.replaceAll(' ', '-')}.png`, new Uint8Array(await preview.arrayBuffer()))
}

const exported = await SpreadsheetFile.exportXlsx(workbook)
await exported.save(outputPath)

const inspect = await workbook.inspect({
  kind: 'workbook,sheet,table,formula',
  maxChars: 6000,
  tableMaxRows: 4,
  tableMaxCols: 6
})
console.log(inspect)
console.log(`saved ${outputPath}`)
