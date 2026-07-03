'use strict'

const catalog = require('./catalog-engine')
const { cloneJson } = require('./util')

const LOBBY_VERSION = 'ultimate-sports-tournament-lobby-v1'
const EXPERIENCE_VERSION = 'ultimate-sports-tournament-experience-v1'
const ASSET_PLAN_VERSION = 'ultimate-sports-asset-plan-v1'

const REQUIRED_ASSET_TYPES = Object.freeze([
  'lobby-icon',
  'server-card-cover',
  'hero-backdrop',
  'bracket-board-skin',
  'pool-card-accent',
  'mini-game-icon-set',
  'watch-room-stage',
  'result-share-card',
  'empty-state-illustration'
])

const LOBBY_STATES = Object.freeze([
  'empty',
  'active',
  'mixed'
])

const EXPERIENCE_PROFILES = Object.freeze({
  'world-cup': profile({
    serverLabel: 'Global Cup Server',
    serverSkin: 'stadium-flags',
    shellId: 'soccer-group-knockout-shell',
    layoutMode: 'group-table-to-knockout',
    bracketStyle: 'group-plus-knockout',
    visualTone: 'global festival, bright stadium lights, national color accents',
    palette: ['pitch-green', 'trophy-gold', 'signal-red', 'night-navy'],
    apiAdapters: ['fixtures', 'score-clock', 'group-table', 'knockout-bracket', 'player-stats', 'result-feed'],
    livePromptLexicon: ['goal', 'corner', 'card', 'shot', 'save', 'VAR', 'penalty', 'first scorer'],
    customPanels: ['group-card-builder', 'knockout-path', 'side-quest-builder', 'matchday-watch-room']
  }),
  'euros-copa-america': profile({
    serverLabel: 'International Cup Server',
    serverSkin: 'continental-flags',
    shellId: 'regional-soccer-cup-shell',
    layoutMode: 'compact-group-knockout',
    bracketStyle: 'regional-knockout',
    visualTone: 'summer tournament, flags, clean broadcast match cards',
    palette: ['grass-green', 'sunlit-blue', 'cup-silver', 'alert-red'],
    apiAdapters: ['fixtures', 'score-clock', 'group-table', 'knockout-bracket', 'player-stats', 'result-feed'],
    livePromptLexicon: ['goal', 'assist', 'card', 'save', 'scoreline', 'first scorer', 'penalty'],
    customPanels: ['compact-group-card', 'knockout-preview', 'player-prop-tray', 'reaction-rail']
  }),
  'champions-league-knockout': profile({
    serverLabel: 'Club Knockout Server',
    serverSkin: 'floodlit-club-night',
    shellId: 'premium-soccer-knockout-shell',
    layoutMode: 'single-elimination-focus',
    bracketStyle: 'club-knockout',
    visualTone: 'premium night match, floodlights, sharp club-neutral geometry',
    palette: ['midnight', 'electric-cyan', 'silver', 'pitch-green'],
    apiAdapters: ['fixtures', 'score-clock', 'aggregate-score', 'knockout-bracket', 'result-feed'],
    livePromptLexicon: ['aggregate', 'extra time', 'penalty', 'free kick', 'pressure', 'save', 'goal'],
    customPanels: ['aggregate-score-strip', 'head-to-head-duel-card', 'momentum-window', 'set-piece-games']
  }),
  'march-madness': profile({
    serverLabel: 'Madness Bracket Server',
    serverSkin: 'arena-regions',
    shellId: 'large-basketball-bracket-shell',
    layoutMode: 'region-tabs',
    bracketStyle: 'seeded-region-bracket',
    visualTone: 'college arena energy, hardwood, region colors, upset callouts',
    palette: ['hardwood', 'court-blue', 'rim-orange', 'chalk-white'],
    apiAdapters: ['fixtures', 'score-clock', 'seed-lines', 'team-stats', 'player-stats', 'result-feed'],
    livePromptLexicon: ['next basket', 'three', 'foul', 'rebound', 'assist', 'lead change', 'timeout'],
    customPanels: ['region-bracket-tabs', 'upset-bounty-map', 'halftime-trivia', 'mini-fantasy-slate']
  }),
  'pro-playoffs': profile({
    serverLabel: 'Pro Playoff Server',
    serverSkin: 'series-scoreboard',
    shellId: 'series-playoff-shell',
    layoutMode: 'series-board',
    bracketStyle: 'best-of-series',
    visualTone: 'pro broadcast desk, clean series grids, daily slate cards',
    palette: ['scoreboard-black', 'ice-white', 'court-blue', 'basepath-clay'],
    apiAdapters: ['fixtures', 'score-clock', 'series-state', 'team-stats', 'player-stats', 'result-feed'],
    livePromptLexicon: ['next goal', 'next run', 'next basket', 'save', 'strikeout', 'power play', 'lead change'],
    customPanels: ['series-score-grid', 'survivor-strip', 'daily-fantasy-slate', 'multi-game-watch-rail']
  }),
  'tennis-grand-slams': profile({
    serverLabel: 'Grand Slam Draw Server',
    serverSkin: 'court-draw',
    shellId: 'tennis-draw-shell',
    layoutMode: 'player-draw',
    bracketStyle: 'draw-from-selected-round',
    visualTone: 'sunlit court, crisp draw board, seed and country accents',
    palette: ['court-green', 'clay-red', 'line-white', 'champion-gold'],
    apiAdapters: ['fixtures', 'score-clock', 'set-score', 'player-stats', 'draw-feed', 'result-feed'],
    livePromptLexicon: ['ace', 'double fault', 'break point', 'tiebreak', 'set score', 'match point'],
    customPanels: ['start-round-selector', 'player-draw-board', 'set-score-lock', 'break-point-reaction']
  }),
  'esports-major': profile({
    serverLabel: 'Esports Major Server',
    serverSkin: 'neon-arena',
    shellId: 'esports-series-shell',
    layoutMode: 'map-series',
    bracketStyle: 'groups-knockout-series',
    visualTone: 'neon stage, tactical maps, objective timers, team-neutral esports UI',
    palette: ['obsidian', 'neon-teal', 'hot-pink', 'hud-green'],
    apiAdapters: ['fixtures', 'series-state', 'map-score', 'objective-events', 'player-stats', 'result-feed'],
    livePromptLexicon: ['next map', 'first blood', 'clutch', 'objective', 'overtime', 'economy swing'],
    customPanels: ['map-series-card', 'objective-momentum', 'meta-trivia', 'clutch-reaction-rail']
  }),
  'mma-boxing-fight-card': profile({
    serverLabel: 'Fight Card Server',
    serverSkin: 'arena-card',
    shellId: 'fight-card-shell',
    layoutMode: 'bout-list',
    bracketStyle: 'fight-card',
    visualTone: 'fight-night walkout, neutral gloves, round cards, strong contrast',
    palette: ['canvas-white', 'corner-red', 'corner-blue', 'matte-black'],
    apiAdapters: ['bout-card', 'round-clock', 'method-result', 'fighter-stats', 'judges-score', 'result-feed'],
    livePromptLexicon: ['round winner', 'knockdown', 'takedown', 'submission', 'stoppage', 'decision'],
    customPanels: ['bout-pick-card', 'method-round-props', 'between-fight-trivia', 'fight-bingo-grid']
  }),
  'creator-reality-brackets': profile({
    serverLabel: 'Creator Show Server',
    serverSkin: 'creator-stage',
    shellId: 'creator-custom-event-shell',
    layoutMode: 'custom-bracket-stage',
    bracketStyle: 'host-defined-bracket',
    visualTone: 'creator stage, customizable slots, episode reveal energy',
    palette: ['studio-black', 'spotlight-gold', 'creator-pink', 'paper-white'],
    apiAdapters: ['manual-fixtures', 'host-results', 'corrections', 'evidence-upload', 'room-events'],
    livePromptLexicon: ['reveal', 'fan vote', 'episode result', 'judge choice', 'challenge winner'],
    customPanels: ['custom-entrant-labels', 'creator-asset-slots', 'manual-result-workbench', 'episode-streaks']
  }),
  'awards-prediction-pools': profile({
    serverLabel: 'Awards Night Server',
    serverSkin: 'ceremony-card',
    shellId: 'awards-card-shell',
    layoutMode: 'category-card',
    bracketStyle: 'prediction-card',
    visualTone: 'ceremony stage, category cards, elegant broadcast moments',
    palette: ['velvet-black', 'award-gold', 'stage-red', 'spotlight-white'],
    apiAdapters: ['category-list', 'nominee-list', 'host-results', 'corrections', 'broadcast-events'],
    livePromptLexicon: ['category winner', 'upset', 'speech', 'performance', 'jury vote', 'public vote'],
    customPanels: ['category-pick-card', 'confidence-row', 'broadcast-bingo', 'card-duel-comparison']
  }),
  'local-leagues': profile({
    serverLabel: 'Local League Server',
    serverSkin: 'community-scoreboard',
    shellId: 'local-flex-league-shell',
    layoutMode: 'flex-format',
    bracketStyle: 'round-robin-or-bracket',
    visualTone: 'community scoreboard, editable labels, friendly match cards',
    palette: ['chalkboard', 'rec-green', 'paper-white', 'signal-orange'],
    apiAdapters: ['manual-fixtures', 'host-results', 'corrections', 'simple-stats', 'room-events'],
    livePromptLexicon: ['next score', 'player prop', 'team streak', 'manual stat', 'local trivia'],
    customPanels: ['format-selector', 'manual-entrant-table', 'invite-link-panel', 'simple-stat-entry']
  })
})

function createTournamentLobby (input = {}) {
  const activeTournaments = normalizeActiveTournaments(input.activeTournaments || tournamentsFromView(input.view))
  const activeServers = activeTournaments.map(tournament => {
    const experience = createTournamentExperience(tournament)
    return {
      ...experience.server,
      mode: 'active',
      active: true,
      playerCount: Number.isFinite(Number(tournament.playerCount)) ? Number(tournament.playerCount) : 0,
      roomCount: Number.isFinite(Number(tournament.roomCount)) ? Number(tournament.roomCount) : 0
    }
  })
  const catalogServers = catalog.listEventFits().map(fit => templateServerCard(fit))
  const selectedServer = selectServer({
    activeServers,
    catalogServers,
    selectedTournamentId: input.selectedTournamentId,
    selectedFitId: input.selectedFitId
  })
  const selectedExperience = selectedServer
    ? createTournamentExperience({
        fitId: selectedServer.fitId,
        tournamentId: selectedServer.tournamentId === selectedServer.fitId ? null : selectedServer.tournamentId,
        title: selectedServer.title,
        status: selectedServer.status
      })
    : null

  return {
    lobbyVersion: LOBBY_VERSION,
    state: lobbyState(activeServers, selectedServer),
    activeServerCount: activeServers.length,
    selectedServerId: selectedServer ? selectedServer.serverId : null,
    selectedExperience,
    filters: lobbyFilters(catalogServers, activeServers),
    emptyState: activeServers.length
      ? null
      : {
          title: 'No live tournament servers',
          body: 'Browse the catalog, create a tournament, or wait for a room invite.',
          primaryAction: 'browse-catalog',
          secondaryAction: 'create-tournament'
        },
    activeServers,
    catalogServers
  }
}

function createTournamentExperience (input = {}) {
  const fit = fitFor(input.fitId)
  const profile = rawProfileFor(fit.fitId)
  const title = input.title || fit.title
  const tournamentId = input.tournamentId || fit.fitId
  const status = input.status || 'template'

  return {
    experienceVersion: EXPERIENCE_VERSION,
    tournamentId,
    fitId: fit.fitId,
    title,
    category: fit.category,
    status,
    server: {
      serverId: `tournament:${tournamentId}`,
      tournamentId,
      fitId: fit.fitId,
      title,
      category: fit.category,
      status,
      serverLabel: profile.serverLabel,
      serverSkin: profile.serverSkin,
      entrantShape: fit.entrantShape,
      resultPolicy: fit.resultPolicy,
      primaryTemplateKind: fit.templateKinds[0],
      badges: [fit.category, fit.entrantShape, fit.resultPolicy]
    },
    gui: {
      shellId: profile.shellId,
      layoutMode: profile.layoutMode,
      primaryNavigation: ['lobby', 'overview', 'picks', 'pools', 'watch', 'games', 'results', 'wallet'],
      customPanels: profile.customPanels.slice(),
      surfaceBindings: {
        overview: 'discover',
        setup: 'creator',
        picks: 'picks',
        pools: 'pools',
        watch: 'watch',
        games: 'games',
        results: fit.resultPolicy === 'host-entered' ? 'creator' : 'ops',
        wallet: 'wallet'
      }
    },
    apiPlan: apiPlanFor({ fit, profile }),
    competition: {
      templateKinds: fit.templateKinds.slice(),
      bracketStyle: profile.bracketStyle,
      entrantShape: fit.entrantShape,
      resultPolicy: fit.resultPolicy,
      poolVariants: fit.recommendedVariants.slice(),
      setupPanels: setupPanelsFor({ fit, profile })
    },
    miniGameDock: {
      gameTypes: fit.recommendedMiniGames.slice(),
      promptLexicon: profile.livePromptLexicon.slice(),
      defaultPlacement: 'watch-room-tray'
    },
    assetPack: assetPackFor({ fit, profile }),
    management: {
      registryKey: fit.fitId,
      route: `/tournaments/${tournamentId}`,
      cacheNamespace: `ux:${fit.fitId}`,
      canRunWithNoActiveServer: true,
      personalizationScopes: ['theme', 'entrant-labels', 'favorite-teams', 'room-order']
    }
  }
}

function createAssetGenerationPlan (input = {}) {
  const fits = input.fitId
    ? [fitFor(input.fitId)]
    : catalog.listEventFits()
  const packs = fits.map(fit => assetPackFor({ fit, profile: rawProfileFor(fit.fitId) }))

  return {
    planVersion: ASSET_PLAN_VERSION,
    sourcePolicy: {
      generated: 'Use generated non-branded art for mood, backgrounds, empty states, and generic icons.',
      licensed: 'Use licensed or user-provided assets for official logos, player photos, team marks, and broadcaster marks.',
      local: 'Allow hosts to upload entrant images for creator and local events, then store attribution with the asset.'
    },
    pipeline: [
      'select-fit-profile',
      'generate-style-board',
      'generate-required-pack',
      'review-safe-area-and-legibility',
      'bind-assets-to-gui-shell',
      'cache-pack-by-fit-and-tournament',
      'allow-host-overrides'
    ],
    outputSpecs: {
      heroBackdrop: '16:9 and 9:16 crops',
      serverCardCover: '4:3 cover with center-safe subject',
      lobbyIcon: 'square icon, transparent-safe edges',
      shareCard: '1200x630 social card',
      miniGameIcons: 'single-color and full-color variants'
    },
    packs
  }
}

function listExperienceProfiles () {
  return catalog.listEventFits().map(fit => getExperienceProfile(fit.fitId))
}

function getExperienceProfile (fitId) {
  const fit = fitFor(fitId)
  const profile = rawProfileFor(fit.fitId)
  return cloneJson({
    fitId: fit.fitId,
    title: fit.title,
    category: fit.category,
    ...profile
  })
}

function normalizeActiveTournaments (activeTournaments = []) {
  if (!Array.isArray(activeTournaments)) throw new TypeError('activeTournaments must be an array')
  return activeTournaments.map((tournament, index) => {
    if (!tournament || typeof tournament !== 'object') throw new TypeError('active tournament must be an object')
    const fit = fitFor(tournament.fitId || inferFitIdFromCompetition(tournament))
    return {
      tournamentId: tournament.tournamentId || tournament.competitionId || `${fit.fitId}:active:${index + 1}`,
      fitId: fit.fitId,
      title: tournament.title || fit.title,
      status: tournament.status || 'active',
      playerCount: tournament.playerCount,
      roomCount: tournament.roomCount
    }
  })
}

function tournamentsFromView (view = {}) {
  return Object.values(view.competitions || {})
    .map(competition => {
      const fitId = inferFitIdFromCompetition(competition)
      return fitId
        ? {
            tournamentId: competition.competitionId,
            competitionId: competition.competitionId,
            fitId,
            title: competition.title,
            status: competition.status || 'active'
          }
        : null
    })
    .filter(Boolean)
}

function inferFitIdFromCompetition (competition = {}) {
  if (competition.fitId) return competition.fitId
  if (competition.metadata && competition.metadata.fitId) return competition.metadata.fitId
  const category = competition.category
  const templateKind = competition.template && competition.template.kind
  const resultPolicy = competition.resultPolicy || competition.template && competition.template.resultPolicy
  if (!category || !templateKind) return null

  const matches = catalog.listEventFits()
    .filter(fit => fit.category === category)
    .filter(fit => fit.templateKinds.includes(templateKind))
    .filter(fit => !resultPolicy || fit.resultPolicy === resultPolicy)

  return matches.length === 1 ? matches[0].fitId : null
}

function templateServerCard (fit) {
  const profile = rawProfileFor(fit.fitId)
  return {
    serverId: `catalog:${fit.fitId}`,
    tournamentId: fit.fitId,
    fitId: fit.fitId,
    title: fit.title,
    category: fit.category,
    status: 'template',
    mode: 'template',
    active: false,
    serverLabel: profile.serverLabel,
    serverSkin: profile.serverSkin,
    primaryTemplateKind: fit.templateKinds[0],
    recommendedVariantCount: fit.recommendedVariants.length,
    recommendedMiniGameCount: fit.recommendedMiniGames.length
  }
}

function selectServer ({ activeServers, catalogServers, selectedTournamentId, selectedFitId }) {
  if (selectedTournamentId) {
    return activeServers.find(server => server.tournamentId === selectedTournamentId || server.serverId === selectedTournamentId) || null
  }
  if (selectedFitId) {
    return activeServers.find(server => server.fitId === selectedFitId) ||
      catalogServers.find(server => server.fitId === selectedFitId) ||
      null
  }
  return activeServers[0] || null
}

function lobbyState (activeServers, selectedServer) {
  if (!activeServers.length) return LOBBY_STATES[0]
  if (selectedServer && selectedServer.mode === 'template') return LOBBY_STATES[2]
  return LOBBY_STATES[1]
}

function lobbyFilters (catalogServers, activeServers) {
  const activeCategories = new Set(activeServers.map(server => server.category))
  return [...new Set(catalogServers.map(server => server.category))]
    .sort()
    .map(category => ({
      category,
      activeCount: activeServers.filter(server => server.category === category).length,
      catalogCount: catalogServers.filter(server => server.category === category).length,
      active: activeCategories.has(category)
    }))
}

function apiPlanFor ({ fit, profile }) {
  const mode = fit.resultPolicy === 'host-entered' ? 'manual' : 'official-feed'
  return {
    mode,
    adapters: profile.apiAdapters.slice(),
    requiredTopics: [
      `competition:${fit.fitId}`,
      `room:${fit.fitId}`,
      `results:${fit.fitId}`
    ],
    fallback: mode === 'manual'
      ? 'host-entered result workbench with corrections and evidence'
      : 'host correction overlay when official feed is delayed or disputed'
  }
}

function setupPanelsFor ({ fit, profile }) {
  return [
    'server-settings',
    'entrant-source',
    profile.layoutMode,
    ...fit.recommendedVariants.map(variantId => `pool:${variantId}`),
    ...fit.recommendedMiniGames.map(gameType => `mini-game:${gameType}`),
    fit.resultPolicy === 'host-entered' ? 'manual-result-workbench' : 'feed-status'
  ]
}

function assetPackFor ({ fit, profile }) {
  return {
    packId: `asset-pack:${fit.fitId}`,
    fitId: fit.fitId,
    themeId: profile.serverSkin,
    visualTone: profile.visualTone,
    palette: profile.palette.slice(),
    requiredAssets: REQUIRED_ASSET_TYPES.map(assetType => ({
      assetType,
      prompt: assetPromptFor({ assetType, fit, profile }),
      acceptance: assetAcceptanceFor(assetType)
    }))
  }
}

function assetPromptFor ({ assetType, fit, profile }) {
  return `${fit.title} ${assetType.replace(/-/g, ' ')} for a P2P sports tournament app, ${profile.visualTone}, ${profile.palette.join(', ')} palette, readable mobile UI safe areas, no official logos unless licensed`
}

function assetAcceptanceFor (assetType) {
  if (assetType === 'mini-game-icon-set') return 'icons remain legible at 24px and support one-color treatment'
  if (assetType === 'result-share-card') return 'supports winner, score, tournament title, and evidence badge without text overlap'
  if (assetType === 'hero-backdrop') return 'center subject survives desktop, tablet, and mobile crops'
  if (assetType === 'empty-state-illustration') return 'works for no active tournaments and does not imply a specific live event'
  return 'usable across light, dark, and event-themed shells'
}

function fitFor (fitId) {
  const fit = catalog.getEventFit(fitId)
  if (!fit) throw new Error(`unknown fit: ${fitId}`)
  return fit
}

function rawProfileFor (fitId) {
  const profile = EXPERIENCE_PROFILES[fitId]
  if (!profile) throw new Error(`missing tournament experience profile: ${fitId}`)
  return profile
}

function profile (input) {
  return Object.freeze({
    serverLabel: input.serverLabel,
    serverSkin: input.serverSkin,
    shellId: input.shellId,
    layoutMode: input.layoutMode,
    bracketStyle: input.bracketStyle,
    visualTone: input.visualTone,
    palette: Object.freeze(input.palette.slice()),
    apiAdapters: Object.freeze(input.apiAdapters.slice()),
    livePromptLexicon: Object.freeze(input.livePromptLexicon.slice()),
    customPanels: Object.freeze(input.customPanels.slice())
  })
}

module.exports = {
  LOBBY_VERSION,
  EXPERIENCE_VERSION,
  ASSET_PLAN_VERSION,
  REQUIRED_ASSET_TYPES,
  createTournamentLobby,
  createTournamentExperience,
  createAssetGenerationPlan,
  listExperienceProfiles,
  getExperienceProfile,
  tournamentsFromView,
  inferFitIdFromCompetition
}
