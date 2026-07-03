'use strict'

const {
  EVENT_TEMPLATE_KINDS,
  POOL_VARIANTS,
  SETTLEMENT_MODES
} = require('./constants')
const { cloneJson } = require('./util')

const EVENT_FITS = Object.freeze([
  {
    fitId: 'world-cup',
    title: 'World Cup',
    category: 'soccer',
    templateKinds: ['group-plus-knockout', 'single-elimination'],
    entrantShape: 'team',
    resultPolicy: 'official-feed',
    recommendedVariants: ['classic-bracket', 'confidence', 'group-stage-card', 'upset-bounty', 'side-quest'],
    recommendedMiniGames: ['penalty-clash', 'free-kick-duel', 'next-event', 'scoreline-lock', 'watch-party-streak'],
    defaultSettlementModes: ['demo', 'sponsor-prize']
  },
  {
    fitId: 'euros-copa-america',
    title: 'Euros / Copa America',
    category: 'soccer',
    templateKinds: ['group-plus-knockout', 'single-elimination'],
    entrantShape: 'team',
    resultPolicy: 'official-feed',
    recommendedVariants: ['classic-bracket', 'confidence', 'group-stage-card', 'upset-bounty'],
    recommendedMiniGames: ['penalty-clash', 'next-event', 'scoreline-lock', 'player-prop-duel'],
    defaultSettlementModes: ['demo', 'sponsor-prize']
  },
  {
    fitId: 'champions-league-knockout',
    title: 'Champions League Knockout',
    category: 'soccer',
    templateKinds: ['single-elimination'],
    entrantShape: 'team',
    resultPolicy: 'official-feed',
    recommendedVariants: ['classic-bracket', 'confidence', 'upset-bounty', 'head-to-head-duel'],
    recommendedMiniGames: ['penalty-clash', 'free-kick-duel', 'next-event', 'momentum-duel'],
    defaultSettlementModes: ['demo', 'sponsor-prize']
  },
  {
    fitId: 'march-madness',
    title: 'March Madness',
    category: 'basketball',
    templateKinds: ['single-elimination'],
    entrantShape: 'team',
    resultPolicy: 'official-feed',
    recommendedVariants: ['classic-bracket', 'confidence', 'upset-bounty', 'head-to-head-duel'],
    recommendedMiniGames: ['next-event', 'scoreline-lock', 'trivia-duel', 'peer-mini-fantasy'],
    defaultSettlementModes: ['demo', 'sponsor-prize']
  },
  {
    fitId: 'pro-playoffs',
    title: 'NBA / NHL / MLB Playoffs',
    category: 'pro-sports',
    templateKinds: ['series-playoff'],
    entrantShape: 'team',
    resultPolicy: 'official-feed',
    recommendedVariants: ['classic-bracket', 'confidence', 'survivor', 'fantasy-lite-draft'],
    recommendedMiniGames: ['next-event', 'scoreline-lock', 'player-prop-duel', 'peer-mini-fantasy'],
    defaultSettlementModes: ['demo', 'sponsor-prize']
  },
  {
    fitId: 'tennis-grand-slams',
    title: 'Tennis Grand Slams',
    category: 'tennis',
    templateKinds: ['single-elimination'],
    entrantShape: 'player',
    resultPolicy: 'official-feed',
    recommendedVariants: ['classic-bracket', 'confidence', 'head-to-head-duel', 'fantasy-lite-draft'],
    recommendedMiniGames: ['next-event', 'scoreline-lock', 'player-prop-duel', 'reaction-challenge'],
    defaultSettlementModes: ['demo', 'sponsor-prize']
  },
  {
    fitId: 'esports-major',
    title: 'Valorant / LoL Worlds / CS / Dota / Rocket League',
    category: 'esports',
    templateKinds: ['group-plus-knockout', 'single-elimination', 'series-playoff'],
    entrantShape: 'team',
    resultPolicy: 'official-feed',
    recommendedVariants: ['classic-bracket', 'confidence', 'survivor', 'fantasy-lite-draft', 'side-quest'],
    recommendedMiniGames: ['next-event', 'momentum-duel', 'trivia-duel', 'reaction-challenge'],
    defaultSettlementModes: ['demo', 'sponsor-prize']
  },
  {
    fitId: 'mma-boxing-fight-card',
    title: 'MMA / Boxing Fight Cards',
    category: 'combat-sports',
    templateKinds: ['fight-card'],
    entrantShape: 'player',
    resultPolicy: 'official-feed',
    recommendedVariants: ['confidence', 'player-prop', 'watch-party-bingo', 'head-to-head-duel'],
    recommendedMiniGames: ['player-prop-duel', 'next-event', 'trivia-duel', 'reaction-challenge'],
    defaultSettlementModes: ['demo', 'sponsor-prize']
  },
  {
    fitId: 'creator-reality-brackets',
    title: 'Reality / Creator Tournaments',
    category: 'creator',
    templateKinds: ['single-elimination', 'creator-custom'],
    entrantShape: 'creator',
    resultPolicy: 'host-entered',
    recommendedVariants: ['classic-bracket', 'confidence', 'watch-party-bingo', 'side-quest'],
    recommendedMiniGames: ['trivia-duel', 'reaction-challenge', 'watch-party-streak'],
    defaultSettlementModes: ['demo', 'sponsor-prize']
  },
  {
    fitId: 'awards-prediction-pools',
    title: 'Oscars / Grammys / Eurovision',
    category: 'awards',
    templateKinds: ['awards-card'],
    entrantShape: 'nominee',
    resultPolicy: 'host-entered',
    recommendedVariants: ['group-stage-card', 'confidence', 'watch-party-bingo', 'head-to-head-duel'],
    recommendedMiniGames: ['trivia-duel', 'watch-party-streak', 'reaction-challenge'],
    defaultSettlementModes: ['demo', 'sponsor-prize']
  },
  {
    fitId: 'local-leagues',
    title: 'School / Office / Pub / Rec Sports',
    category: 'local',
    templateKinds: ['round-robin', 'single-elimination', 'creator-custom'],
    entrantShape: 'team',
    resultPolicy: 'host-entered',
    recommendedVariants: ['classic-bracket', 'confidence', 'survivor', 'watch-party-bingo', 'side-quest'],
    recommendedMiniGames: ['penalty-clash', 'trivia-duel', 'next-event', 'peer-mini-fantasy'],
    defaultSettlementModes: ['demo', 'sponsor-prize']
  }
])

const POOL_VARIANT_CATALOG = Object.freeze([
  variant('classic-bracket', 'Classic Bracket Pick Em', ['single-elimination', 'group-plus-knockout', 'series-playoff', 'creator-custom']),
  variant('confidence', 'Confidence Scoring', EVENT_TEMPLATE_KINDS),
  variant('survivor', 'Survivor Pool', ['round-robin', 'series-playoff', 'group-plus-knockout']),
  variant('upset-bounty', 'Upset Bounty', ['single-elimination', 'group-plus-knockout']),
  variant('head-to-head-duel', 'Head-to-head Bracket Duel', ['single-elimination', 'series-playoff', 'fight-card', 'awards-card']),
  variant('group-stage-card', 'Prediction Pick Card', ['group-plus-knockout', 'awards-card', 'fight-card']),
  variant('fantasy-lite-draft', 'Fantasy-lite Draft', ['series-playoff', 'single-elimination', 'group-plus-knockout']),
  variant('watch-party-bingo', 'Watch-party Bingo', EVENT_TEMPLATE_KINDS),
  variant('next-event', 'Next Event Prediction', ['single-elimination', 'group-plus-knockout', 'series-playoff', 'fight-card']),
  variant('scoreline-lock', 'Scoreline Lock', ['single-elimination', 'group-plus-knockout', 'series-playoff']),
  variant('player-prop', 'Player Prop Duel', ['series-playoff', 'single-elimination', 'fight-card']),
  variant('side-quest', 'Bracket Side Quest', ['single-elimination', 'group-plus-knockout', 'series-playoff', 'creator-custom'])
])

const MINI_GAME_CATALOG = Object.freeze([
  miniGame('penalty-clash', 'Penalty Clash', ['soccer', 'local'], ['none', 'demo', 'sponsor-prize'], 'game:create'),
  miniGame('free-kick-duel', 'Free-kick Duel', ['soccer'], ['none', 'demo', 'sponsor-prize'], 'game:create'),
  miniGame('trivia-duel', 'Trivia Duel', ['soccer', 'basketball', 'pro-sports', 'esports', 'combat-sports', 'creator', 'awards', 'local'], ['none', 'demo', 'sponsor-prize'], 'game:create'),
  miniGame('next-event', 'Next Event Prediction', ['soccer', 'basketball', 'pro-sports', 'tennis', 'esports', 'combat-sports', 'local'], ['demo', 'sponsor-prize'], 'market:create'),
  miniGame('scoreline-lock', 'Scoreline Lock', ['soccer', 'basketball', 'pro-sports', 'tennis'], ['demo', 'sponsor-prize'], 'market:create'),
  miniGame('momentum-duel', 'Momentum Duel', ['soccer', 'esports'], ['demo', 'sponsor-prize'], 'market:create'),
  miniGame('player-prop-duel', 'Player Prop Duel', ['soccer', 'pro-sports', 'tennis', 'combat-sports'], ['demo', 'sponsor-prize'], 'market:create'),
  miniGame('reaction-challenge', 'Reaction Challenge', ['tennis', 'esports', 'combat-sports', 'creator', 'awards'], ['none', 'demo'], 'game:create'),
  miniGame('watch-party-streak', 'Watch-party Streak', ['soccer', 'creator', 'awards'], ['demo', 'sponsor-prize'], 'market:create'),
  miniGame('peer-mini-fantasy', 'Peer Mini Fantasy', ['basketball', 'pro-sports', 'local'], ['demo', 'sponsor-prize'], 'draft:create')
])

function buildCatalog (query = {}) {
  const fits = listEventFits(query)
  return {
    eventFits: fits,
    poolVariants: listPoolVariants(query),
    miniGames: listMiniGames(query),
    settlementModes: SETTLEMENT_MODES.slice()
  }
}

function listEventFits (filter = {}) {
  return EVENT_FITS
    .filter(fit => matchesFitFilter(fit, filter))
    .map(cloneJson)
}

function getEventFit (fitId) {
  const fit = EVENT_FITS.find(item => item.fitId === fitId)
  return fit ? cloneJson(fit) : null
}

function listPoolVariants (filter = {}) {
  const fit = filter.fitId ? getEventFit(filter.fitId) : null
  const templateKinds = fit
    ? fit.templateKinds
    : filter.templateKind
        ? [filter.templateKind]
        : null
  const variantIds = fit ? new Set(fit.recommendedVariants) : null

  return POOL_VARIANT_CATALOG
    .filter(item => !variantIds || variantIds.has(item.variantId))
    .filter(item => !templateKinds || intersects(item.templateKinds, templateKinds))
    .map(cloneJson)
}

function listMiniGames (filter = {}) {
  const fit = filter.fitId ? getEventFit(filter.fitId) : null
  const category = fit ? fit.category : filter.category
  const gameIds = fit ? new Set(fit.recommendedMiniGames) : null

  return MINI_GAME_CATALOG
    .filter(item => !gameIds || gameIds.has(item.gameType))
    .filter(item => !category || item.categories.includes(category))
    .map(cloneJson)
}

function recommendProductStack ({ fitId, settlementMode = 'demo', maxVariants = 4, maxMiniGames = 4 } = {}) {
  const fit = getEventFit(fitId)
  if (!fit) throw new Error(`unknown fit: ${fitId}`)
  if (!SETTLEMENT_MODES.includes(settlementMode)) {
    throw new RangeError(`settlement mode must be one of: ${SETTLEMENT_MODES.join(', ')}`)
  }

  const poolVariants = listPoolVariants({ fitId })
    .filter(item => item.settlementModes.includes(settlementMode))
    .slice(0, maxVariants)
  const miniGames = listMiniGames({ fitId })
    .filter(item => item.settlementModes.includes(settlementMode))
    .slice(0, maxMiniGames)

  return {
    fit,
    settlementMode,
    templateKind: fit.templateKinds[0],
    poolVariants,
    miniGames,
    launchChecklist: launchChecklistFor({ fit, settlementMode, poolVariants, miniGames })
  }
}

function compatibilityFor ({ fitId, variantId = null, gameType = null, settlementMode = 'demo' } = {}) {
  const fit = getEventFit(fitId)
  if (!fit) throw new Error(`unknown fit: ${fitId}`)

  const variant = variantId
    ? POOL_VARIANT_CATALOG.find(item => item.variantId === variantId)
    : null
  const mini = gameType
    ? MINI_GAME_CATALOG.find(item => item.gameType === gameType)
    : null
  const reasons = []

  if (variant && !fit.recommendedVariants.includes(variant.variantId)) reasons.push('variant is not recommended for this event fit')
  if (variant && !intersects(variant.templateKinds, fit.templateKinds)) reasons.push('variant does not support the fit template kind')
  if (variant && !variant.settlementModes.includes(settlementMode)) reasons.push('variant does not support the settlement mode')
  if (mini && !fit.recommendedMiniGames.includes(mini.gameType)) reasons.push('mini-game is not recommended for this event fit')
  if (mini && !mini.categories.includes(fit.category)) reasons.push('mini-game does not support the fit category')
  if (mini && !mini.settlementModes.includes(settlementMode)) reasons.push('mini-game does not support the settlement mode')

  return {
    fitId,
    variantId,
    gameType,
    settlementMode,
    compatible: reasons.length === 0,
    reasons
  }
}

function launchChecklistFor ({ fit, settlementMode, poolVariants, miniGames }) {
  const checklist = [
    'choose-template',
    'seed-entrants',
    'create-pool',
    'open-watch-room'
  ]
  if (fit.resultPolicy === 'official-feed') checklist.push('connect-official-results')
  if (fit.resultPolicy === 'host-entered') checklist.push('assign-host-result-review')
  if (poolVariants.some(item => item.variantId === 'fantasy-lite-draft') || miniGames.some(item => item.gameType === 'peer-mini-fantasy')) {
    checklist.push('publish-draft-slate')
  }
  if (settlementMode === 'sponsor-prize') checklist.push('collect-sponsor-prize-gate')
  if (settlementMode === 'real-money') checklist.push('complete-real-money-gates')
  return checklist
}

function matchesFitFilter (fit, filter) {
  if (filter.category && fit.category !== filter.category) return false
  if (filter.templateKind && !fit.templateKinds.includes(filter.templateKind)) return false
  if (filter.settlementMode && !fit.defaultSettlementModes.includes(filter.settlementMode)) return false
  return true
}

function variant (variantId, title, templateKinds, settlementModes = ['demo', 'sponsor-prize']) {
  if (!POOL_VARIANTS.includes(variantId)) throw new Error(`unknown pool variant: ${variantId}`)
  return {
    variantId,
    title,
    templateKinds: templateKinds.slice(),
    settlementModes: settlementModes.slice()
  }
}

function miniGame (gameType, title, categories, settlementModes, commandType) {
  return {
    gameType,
    title,
    categories: categories.slice(),
    settlementModes: settlementModes.slice(),
    commandType
  }
}

function intersects (left, right) {
  return left.some(item => right.includes(item))
}

module.exports = {
  EVENT_FITS,
  POOL_VARIANT_CATALOG,
  MINI_GAME_CATALOG,
  buildCatalog,
  listEventFits,
  getEventFit,
  listPoolVariants,
  listMiniGames,
  recommendProductStack,
  compatibilityFor
}
