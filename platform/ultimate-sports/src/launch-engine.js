'use strict'

const catalog = require('./catalog-engine')
const livePrediction = require('./live-prediction-engine')
const { cloneJson, slugify, stableId } = require('./util')

const DEFAULT_LAUNCH_AT = '2026-07-03T00:00:00.000Z'

function createLaunchPlan (input = {}) {
  const fitId = input.fitId || input.fit && input.fit.fitId
  if (!fitId) throw new TypeError('fitId is required')

  const settlementMode = input.settlementMode || 'demo'
  const stack = input.stack || catalog.recommendProductStack({
    fitId,
    settlementMode,
    maxVariants: input.maxVariants || 3,
    maxMiniGames: input.maxMiniGames || 4
  })
  const fit = stack.fit
  const title = input.title || fit.title
  const competitionId = input.competitionId || stableId(`launch-${fit.fitId}`, { title })
  const roomId = input.roomId || `${competitionId}:room:main`
  const hostUserId = input.hostUserId || input.actorId || 'host'
  const variants = selectedVariants({ stack, input })
  const miniGames = selectedMiniGames({ stack, input })
  const gates = gatesForMode(settlementMode, input.gates)
  const baseAt = input.occurredAt || DEFAULT_LAUNCH_AT
  const commands = []
  const activationTasks = []

  commands.push(commandAt({
    type: 'competition:create',
    actorId: hostUserId,
    occurredAt: baseAt,
    index: commands.length,
    payload: {
      competitionId,
      title,
      category: fit.category,
      organizerId: input.organizerId || hostUserId,
      startsAt: input.startsAt || null,
      status: input.status || 'draft',
      templateConfig: {
        kind: input.templateKind || stack.templateKind,
        sportOrCategory: fit.category,
        entrantShape: fit.entrantShape,
        resultPolicy: fit.resultPolicy,
        supportedPoolVariants: variants.map(item => item.variantId),
        supportedMiniGames: miniGames.map(item => item.gameType)
      },
      entrants: cloneJson(input.entrants || defaultEntrantsForFit(fit)),
      fixturesConfig: cloneJson(input.fixturesConfig || defaultFixturesConfigForFit(fit))
    }
  }))

  variants.forEach(variant => {
    commands.push(commandAt({
      type: 'pool:create',
      actorId: hostUserId,
      occurredAt: baseAt,
      index: commands.length,
      payload: {
        poolId: poolIdFor({ input, competitionId, variantId: variant.variantId }),
        competitionId,
        title: variant.title,
        variant: variant.variantId,
        mode: settlementMode,
        gates
      }
    }))
  })

  commands.push(commandAt({
    type: 'room:create',
    actorId: hostUserId,
    occurredAt: baseAt,
    index: commands.length,
    payload: {
      roomId,
      competitionId,
      fixtureId: input.fixtureId || null,
      title: input.roomTitle || `${title} watch room`,
      hostUserId,
      status: input.roomStatus || 'scheduled'
    }
  }))
  commands.push(commandAt({
    type: 'room:join',
    actorId: hostUserId,
    occurredAt: baseAt,
    index: commands.length,
    payload: {
      roomId,
      userId: hostUserId,
      username: input.hostName || hostUserId,
      role: 'host'
    }
  }))

  cardCommandsFor({ variants, fit, competitionId, hostUserId, baseAt, commands })
    .forEach(item => commands.push(item))
  draftCommandsFor({ variants, miniGames, competitionId, hostUserId, baseAt, commands, input })
    .forEach(item => commands.push(item))
  miniGameCommandsFor({ miniGames, competitionId, roomId, hostUserId, baseAt, commands, input, settlementMode, gates })
    .forEach(item => {
      if (item.command) commands.push(item.command)
      if (item.task) activationTasks.push(item.task)
    })

  return {
    launchPlanId: input.launchPlanId || stableId(`launch-plan-${fit.fitId}`, {
      competitionId,
      settlementMode,
      variants: variants.map(item => item.variantId),
      miniGames: miniGames.map(item => item.gameType)
    }),
    fit,
    title,
    competitionId,
    roomId,
    settlementMode,
    poolVariants: variants,
    miniGames,
    gates,
    commands,
    activationTasks,
    topics: [
      { kind: 'competition', id: competitionId },
      ...variants.map(variant => ({ kind: 'pool', id: poolIdFor({ input, competitionId, variantId: variant.variantId }) })),
      { kind: 'room', id: roomId }
    ],
    checklist: stack.launchChecklist
  }
}

function createLaunchScenario (input = {}) {
  const plan = createLaunchPlan(input)
  return {
    scenarioId: input.scenarioId || `launch-${plan.fit.fitId}`,
    title: plan.title,
    topics: plan.topics,
    commands: plan.commands,
    launchPlan: {
      launchPlanId: plan.launchPlanId,
      fitId: plan.fit.fitId,
      settlementMode: plan.settlementMode,
      activationTasks: plan.activationTasks,
      checklist: plan.checklist
    }
  }
}

function selectedVariants ({ stack, input }) {
  const requested = input.variantIds || input.selectedVariantIds
  if (!requested) return stack.poolVariants
  const allowed = new Map(catalog.listPoolVariants({ fitId: stack.fit.fitId }).map(item => [item.variantId, item]))
  return requested.map(variantId => {
    const variant = allowed.get(variantId)
    if (!variant) throw new Error(`variant ${variantId} is not compatible with ${stack.fit.fitId}`)
    return variant
  })
}

function selectedMiniGames ({ stack, input }) {
  const requested = input.miniGameTypes || input.selectedMiniGameTypes
  if (!requested) return stack.miniGames
  const allowed = new Map(catalog.listMiniGames({ fitId: stack.fit.fitId }).map(item => [item.gameType, item]))
  return requested.map(gameType => {
    const miniGame = allowed.get(gameType)
    if (!miniGame) throw new Error(`mini-game ${gameType} is not compatible with ${stack.fit.fitId}`)
    return miniGame
  })
}

function cardCommandsFor ({ variants, fit, competitionId, hostUserId, baseAt, commands }) {
  return variants
    .filter(variant => ['group-stage-card', 'watch-party-bingo', 'player-prop'].includes(variant.variantId))
    .map(variant => commandAt({
      type: 'card:create',
      actorId: hostUserId,
      occurredAt: baseAt,
      index: commands.length + variant.variantId.length,
      payload: {
        cardId: `${competitionId}:card:${variant.variantId}`,
        competitionId,
        cardType: cardTypeForVariant(variant.variantId, fit),
        title: variant.title,
        fields: defaultCardFieldsForVariant(variant.variantId, fit)
      }
    }))
}

function draftCommandsFor ({ variants, miniGames, competitionId, hostUserId, baseAt, commands, input }) {
  const needsDraft = variants.some(variant => variant.variantId === 'fantasy-lite-draft') ||
    miniGames.some(game => game.gameType === 'peer-mini-fantasy')
  if (!needsDraft) return []

  return [commandAt({
    type: 'draft:create',
    actorId: hostUserId,
    occurredAt: baseAt,
    index: commands.length + 30,
    payload: {
      slateId: `${competitionId}:draft:main`,
      competitionId,
      title: input.draftTitle || 'Fantasy-lite draft',
      rosterSize: input.rosterSize || 3,
      athletes: cloneJson(input.athletes || athletesFromEntrants(input.entrants || defaultEntrantsForFit({ entrantShape: 'player' }))),
      scoringRules: cloneJson(input.scoringRules || {
        goals: 5,
        assists: 3,
        saves: 1
      })
    }
  })]
}

function miniGameCommandsFor ({ miniGames, competitionId, roomId, hostUserId, baseAt, commands, input, settlementMode, gates }) {
  return miniGames.map((miniGame, index) => {
    const marketType = marketTypeForMiniGame(miniGame.gameType)
    if (marketType) {
      return {
        command: commandAt({
          type: 'market:create',
          actorId: hostUserId,
          occurredAt: baseAt,
          index: commands.length + index + 60,
          payload: {
            marketId: `${roomId}:market:${miniGame.gameType}`,
            roomId,
            competitionId,
            fixtureId: input.fixtureId || null,
            marketType,
            options: defaultMarketOptions(marketType),
            mode: settlementMode,
            gates
          }
        })
      }
    }

    const players = input.players || []
    if (miniGame.commandType === 'game:create' && players.length >= 2) {
      return {
        command: commandAt({
          type: 'game:create',
          actorId: hostUserId,
          occurredAt: baseAt,
          index: commands.length + index + 60,
          payload: {
            gameType: miniGame.gameType,
            roomId,
            players: players.slice(0, 2),
            stakeMode: settlementMode === 'sponsor-prize' ? 'sponsor-prize' : 'demo',
            gates
          }
        })
      }
    }

    return {
      task: {
        taskId: stableId(`activation-${roomId}-${miniGame.gameType}`, { miniGame, players }),
        type: miniGame.commandType === 'draft:create' ? 'open-draft-from-slate' : 'wait-for-peer-challenge',
        gameType: miniGame.gameType,
        commandType: miniGame.commandType,
        roomId,
        requiredPlayers: miniGame.commandType === 'game:create' ? 2 : 0
      }
    }
  })
}

function commandAt ({ type, actorId, payload, occurredAt, index }) {
  return {
    type,
    actorId,
    occurredAt: addMinutes(occurredAt, index),
    payload
  }
}

function addMinutes (iso, minutes) {
  const date = new Date(iso)
  date.setUTCMinutes(date.getUTCMinutes() + minutes)
  return date.toISOString()
}

function poolIdFor ({ input, competitionId, variantId }) {
  if (input.poolIds && input.poolIds[variantId]) return input.poolIds[variantId]
  if (input.poolId && (!input.variantIds || input.variantIds[0] === variantId)) return input.poolId
  return `${competitionId}:pool:${variantId}`
}

function gatesForMode (settlementMode, gates = {}) {
  if (settlementMode === 'sponsor-prize') {
    return {
      poolRulesAccepted: true,
      ...cloneJson(gates)
    }
  }
  return cloneJson(gates)
}

function defaultEntrantsForFit (fit = {}) {
  if (fit.templateKinds && fit.templateKinds[0] === 'awards-card') {
    return [
      { categoryId: 'best-moment', name: 'Best Moment', nominees: ['Nominee A', 'Nominee B'] },
      { categoryId: 'fan-favorite', name: 'Fan Favorite', nominees: ['Nominee C', 'Nominee D'] }
    ]
  }
  if (fit.templateKinds && fit.templateKinds[0] === 'fight-card') {
    return [
      { boutId: 'main', fighterA: 'fighter-a', fighterB: 'fighter-b', mainEvent: true }
    ]
  }

  const label = fit.entrantShape === 'player' ? 'Player' : fit.entrantShape === 'creator' ? 'Creator' : 'Team'
  return ['A', 'B', 'C', 'D'].map((suffix, index) => ({
    entrantId: `${slugify(label)}-${suffix.toLowerCase()}`,
    name: `${label} ${suffix}`,
    seed: index + 1
  }))
}

function defaultFixturesConfigForFit (fit = {}) {
  if (fit.templateKinds && fit.templateKinds[0] === 'awards-card') {
    return { categories: defaultEntrantsForFit(fit) }
  }
  if (fit.templateKinds && fit.templateKinds[0] === 'fight-card') {
    return { bouts: defaultEntrantsForFit(fit) }
  }
  return {}
}

function athletesFromEntrants (entrants = []) {
  return entrants.map((entrant, index) => {
    if (typeof entrant === 'string') return { athleteId: `athlete-${index + 1}`, name: entrant }
    return {
      athleteId: entrant.entrantId || entrant.id || `athlete-${index + 1}`,
      name: entrant.name || entrant.title || entrant.label || `Athlete ${index + 1}`
    }
  })
}

function cardTypeForVariant (variantId, fit) {
  if (variantId === 'watch-party-bingo') return 'watch-party-bingo'
  if (variantId === 'player-prop') return 'player-prop-card'
  if (fit.templateKinds[0] === 'awards-card') return 'awards-card'
  if (fit.templateKinds[0] === 'fight-card') return 'fight-card'
  return 'group-stage-card'
}

function defaultCardFieldsForVariant (variantId, fit) {
  if (variantId === 'watch-party-bingo') {
    return ['Goal', 'Save', 'Card', 'Comeback', 'Review'].map(label => ({
      fieldId: slugify(label),
      fieldType: 'bingo-cell',
      label,
      options: ['yes', 'no']
    }))
  }
  if (variantId === 'player-prop') {
    return [
      { fieldId: 'first-scorer', fieldType: 'single-choice', label: 'First scorer' },
      { fieldId: 'shots', fieldType: 'numeric-total', label: 'Shots', tolerance: 1 }
    ]
  }
  if (fit.templateKinds[0] === 'awards-card') {
    return [
      { fieldId: 'winner', fieldType: 'single-choice', label: 'Winner' },
      { fieldId: 'speech-length', fieldType: 'numeric-total', label: 'Speech length', tolerance: 15 }
    ]
  }
  return [
    { fieldId: 'top-two', fieldType: 'ordered-choice', label: 'Top two' },
    { fieldId: 'total-goals', fieldType: 'numeric-total', label: 'Total goals', tolerance: 1 },
    { fieldId: 'golden-boot', fieldType: 'single-choice', label: 'Golden boot' }
  ]
}

function marketTypeForMiniGame (gameType) {
  if (gameType === 'next-event') return 'next-event'
  if (gameType === 'scoreline-lock') return 'scoreline-lock'
  if (gameType === 'momentum-duel') return 'momentum-duel'
  if (gameType === 'player-prop-duel') return 'player-prop'
  if (gameType === 'watch-party-streak') return 'watch-party-streak'
  return null
}

function defaultMarketOptions (marketType) {
  return livePrediction.marketOptionsFor(marketType)
}

module.exports = {
  DEFAULT_LAUNCH_AT,
  createLaunchPlan,
  createLaunchScenario
}
