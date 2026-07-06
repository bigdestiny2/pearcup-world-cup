'use strict'

const catalog = require('./catalog-engine')
const miniGameSpec = require('./mini-game-spec-engine')
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
    visualTone: 'premium MMA fight-night broadcast, octagon-inspired cage walkout, neutral gloves, round cards, red and blue corners, strong contrast, no official marks',
    palette: ['matte-black', 'canvas-white', 'corner-red', 'corner-blue', 'championship-gold'],
    apiAdapters: ['bout-card', 'round-clock', 'method-result', 'fighter-stats', 'judges-score', 'result-feed'],
    livePromptLexicon: ['round winner', 'knockdown', 'takedown', 'submission', 'stoppage', 'decision'],
    customPanels: ['bout-pick-card', 'method-round-props', 'between-fight-trivia', 'fight-bingo-grid']
  }),
  'sailgp-companion': profile({
    serverLabel: 'SailGP Companion Server',
    serverSkin: 'foiling-race-waterline',
    shellId: 'sailgp-companion-shell',
    layoutMode: 'fleet-race-companion',
    bracketStyle: 'fleet-race-leaderboard',
    visualTone: 'high-speed foiling catamarans, water spray, wind map overlays, national team color accents, clean telemetry dashboard',
    palette: ['deep-water-blue', 'wake-white', 'wind-cyan', 'buoy-orange', 'carbon-black'],
    apiAdapters: ['event-schedule', 'race-results', 'season-standings', 'team-rosters', 'wind-conditions', 'telemetry-or-manual-evidence'],
    livePromptLexicon: ['start winner', 'first mark', 'lead change', 'penalty turn', 'foil drop', 'gate split', 'race winner'],
    customPanels: ['fleet-race-leaderboard', 'wind-shift-map', 'foil-time-props', 'event-final-watch-room']
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

function createTournamentShell (input = {}) {
  const lobby = createTournamentLobby(input)
  const selectedExperience = input.experience || lobby.selectedExperience || (input.fitId
    ? createTournamentExperience(input)
    : null)
  const shell = selectedExperience
    ? shellForExperience({
        lobby,
        experience: selectedExperience,
        userId: input.userId || 'local-peer'
      })
    : emptyLobbyShell(lobby)

  return {
    shellVersion: 'ultimate-sports-tournament-shell-v1',
    lobby,
    selectedExperience,
    shell
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

function shellForExperience ({ lobby, experience, userId }) {
  return {
    route: experience.management.route,
    shellId: experience.gui.shellId,
    userId,
    theme: themeTokensForExperience(experience),
    serverRail: serverRailForLobby(lobby),
    header: {
      title: experience.title,
      subtitle: experience.server.serverLabel,
      status: experience.status,
      badges: experience.server.badges.slice(),
      primaryAction: experience.status === 'template' ? 'create-tournament' : 'enter-watch-room',
      secondaryActions: ['open-picks', 'view-pools', 'invite-peers']
    },
    routeMap: routeMapForExperience(experience),
    screenSlots: screenSlotsForExperience(experience),
    apiConnections: apiConnectionsForExperience(experience),
    competitionFormat: {
      bracketStyle: experience.competition.bracketStyle,
      templateKinds: experience.competition.templateKinds.slice(),
      setupPanels: experience.competition.setupPanels.slice()
    },
    poolTabs: experience.competition.poolVariants.map((variantId, index) => ({
      tabId: `pool:${variantId}`,
      variantId,
      selected: index === 0,
      action: 'open-pool-workbench'
    })),
    miniGameDock: miniGameDockForExperience(experience),
    assetQueue: assetQueueForExperience(experience),
    personalization: experience.management.personalizationScopes.map(scope => ({
      scope,
      storageKey: `${experience.management.cacheNamespace}:${scope}`,
      editable: true
    }))
  }
}

function emptyLobbyShell (lobby) {
  return {
    route: '/tournaments',
    shellId: 'tournament-lobby-empty-shell',
    userId: 'local-peer',
    theme: {
      themeId: 'catalog-lobby',
      palette: ['lobby-charcoal', 'field-green', 'scoreboard-white', 'action-gold'],
      density: 'browse',
      motion: 'soft'
    },
    serverRail: serverRailForLobby(lobby),
    header: {
      title: 'Tournament Lobby',
      subtitle: 'Choose a live tournament server or browse a template.',
      status: lobby.state,
      badges: ['catalog', 'no-active-server'],
      primaryAction: 'browse-catalog',
      secondaryActions: ['create-tournament', 'join-invite']
    },
    routeMap: [
      routeItem('lobby', '/tournaments', 'Tournament Lobby', true),
      routeItem('catalog', '/tournaments/catalog', 'Catalog', false)
    ],
    screenSlots: [
      slot('server-browser', 'lobby', 'server-grid', ['serverRail', 'filters', 'emptyState']),
      slot('catalog-preview', 'catalog', 'template-grid', ['catalogServers'])
    ],
    apiConnections: [],
    competitionFormat: null,
    poolTabs: [],
    miniGameDock: [],
    assetQueue: [],
    personalization: []
  }
}

function themeTokensForExperience (experience) {
  return {
    themeId: experience.assetPack.themeId,
    palette: experience.assetPack.palette.slice(),
    density: densityForLayout(experience.gui.layoutMode),
    motion: experience.category === 'esports' ? 'snappy' : 'broadcast',
    surfaceTreatment: experience.server.resultPolicy === 'host-entered' ? 'manual-review' : 'feed-backed',
    assetPackId: experience.assetPack.packId
  }
}

function densityForLayout (layoutMode) {
  if (['region-tabs', 'series-board', 'map-series'].includes(layoutMode)) return 'dense'
  if (['category-card', 'bout-list', 'flex-format'].includes(layoutMode)) return 'table'
  return 'balanced'
}

function serverRailForLobby (lobby) {
  const selectedServerId = lobby.selectedServerId
  return lobby.activeServers.concat(lobby.catalogServers).map(server => ({
    serverId: server.serverId,
    tournamentId: server.tournamentId,
    fitId: server.fitId,
    title: server.title,
    category: server.category,
    mode: server.mode,
    status: server.status,
    selected: server.serverId === selectedServerId,
    serverSkin: server.serverSkin,
    action: server.active ? 'enter-server' : 'preview-template'
  }))
}

function routeMapForExperience (experience) {
  return experience.gui.primaryNavigation.map((surfaceId, index) => routeItem(
    surfaceId,
    `${experience.management.route}/${surfaceId === 'lobby' ? '' : surfaceId}`.replace(/\/$/, ''),
    titleForRoute(surfaceId),
    index === 1
  ))
}

function routeItem (surfaceId, route, title, selected) {
  return {
    surfaceId,
    route,
    title,
    selected
  }
}

function titleForRoute (surfaceId) {
  return surfaceId.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function screenSlotsForExperience (experience) {
  return [
    slot('tournament-overview', 'overview', experience.gui.layoutMode, ['header', 'apiConnections', 'competitionFormat']),
    slot('setup-workbench', 'setup', 'setup-tabs', experience.competition.setupPanels),
    slot('pick-workbench', 'picks', pickSlotType(experience), ['poolTabs', 'bracketBoard', 'predictionCards']),
    slot('pool-hub', 'pools', 'pool-tabs', experience.competition.poolVariants.map(variantId => `pool:${variantId}`)),
    slot('watch-room', 'watch', 'live-room-stage', ['scoreboard', 'chat', 'challengeTray', 'miniGameDock']),
    slot('games-dock', 'games', 'p2p-game-list', experience.miniGameDock.gameTypes.map(gameType => `mini-game:${gameType}`)),
    slot('results-review', 'results', experience.server.resultPolicy === 'host-entered' ? 'manual-result-review' : 'feed-result-review', ['resultSource', 'settlementReceipts', 'disputes']),
    slot('wallet-status', 'wallet', 'wallet-holds-receipts', ['holds', 'rewards', 'readiness'])
  ]
}

function miniGameDockForExperience (experience) {
  const suite = miniGameSpec.createMiniGameSuite({ fitId: experience.fitId })
  return suite.specs.map((spec, index) => ({
    dockItemId: `mini-game:${spec.gameType}`,
    gameType: spec.gameType,
    title: spec.title,
    mode: spec.mode,
    commandType: spec.commandType,
    runtime: cloneJson(spec.runtime),
    controls: spec.ui.controls.slice(),
    eventOptions: spec.ui.eventOptions.slice(0, 6),
    scoringSummary: spec.scoring.summary,
    commandDraft: cloneJson(spec.commandDraft),
    promptExamples: experience.miniGameDock.promptLexicon.slice(0, 4),
    placement: spec.ui.placement,
    priority: index + 1,
    action: 'launch-or-challenge'
  }))
}

function slot (slotId, surfaceId, component, bindings) {
  return {
    slotId,
    surfaceId,
    component,
    bindings: bindings.slice()
  }
}

function pickSlotType (experience) {
  if (experience.fitId === 'awards-prediction-pools') return 'category-card-picker'
  if (experience.fitId === 'mma-boxing-fight-card') return 'bout-card-picker'
  if (experience.fitId === 'march-madness') return 'region-bracket-picker'
  if (experience.fitId === 'pro-playoffs') return 'series-picker'
  if (experience.fitId === 'tennis-grand-slams') return 'player-draw-picker'
  return 'bracket-and-card-picker'
}

function apiConnectionsForExperience (experience) {
  return experience.apiPlan.adapters.map(adapterId => ({
    adapterId,
    mode: experience.apiPlan.mode,
    status: experience.status === 'template' ? 'not-configured' : 'ready',
    fallback: experience.apiPlan.fallback,
    requiredTopics: experience.apiPlan.requiredTopics.slice()
  }))
}

function assetQueueForExperience (experience) {
  return experience.assetPack.requiredAssets.map((asset, index) => ({
    assetId: `${experience.assetPack.packId}:${asset.assetType}`,
    assetType: asset.assetType,
    fitId: experience.fitId,
    themeId: experience.assetPack.themeId,
    sourceType: sourceTypeForAsset({ assetType: asset.assetType, experience }),
    status: 'needed',
    bindingTarget: bindingTargetForAsset(asset.assetType),
    prompt: asset.prompt,
    acceptance: asset.acceptance,
    order: index + 1
  }))
}

function sourceTypeForAsset ({ assetType, experience }) {
  if (assetType === 'lobby-icon' || assetType === 'server-card-cover' || assetType === 'hero-backdrop') return 'generated'
  if (assetType === 'mini-game-icon-set' || assetType === 'pool-card-accent' || assetType === 'empty-state-illustration') return 'generated-ui'
  if (experience.category === 'creator' || experience.category === 'local') return 'host-upload-or-generated'
  return 'generated-unlicensed'
}

function bindingTargetForAsset (assetType) {
  return {
    'lobby-icon': 'serverRail.icon',
    'server-card-cover': 'serverRail.cover',
    'hero-backdrop': 'header.backdrop',
    'bracket-board-skin': 'picks.bracketBoard.skin',
    'pool-card-accent': 'pools.cardAccent',
    'mini-game-icon-set': 'watch.miniGameDock.icons',
    'watch-room-stage': 'watch.stageBackdrop',
    'result-share-card': 'results.shareCard',
    'empty-state-illustration': 'lobby.emptyState'
  }[assetType] || 'shell.asset'
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
  createTournamentShell,
  createAssetGenerationPlan,
  listExperienceProfiles,
  getExperienceProfile,
  tournamentsFromView,
  inferFitIdFromCompetition
}
