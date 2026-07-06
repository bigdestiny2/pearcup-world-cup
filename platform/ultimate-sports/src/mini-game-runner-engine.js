'use strict'

const attestation = require('./attestation-engine')
const draft = require('./draft-engine')
const game = require('./game-engine')
const livePrediction = require('./live-prediction-engine')
const miniGame = require('./mini-game-engine')
const miniGameSpec = require('./mini-game-spec-engine')
const qvac = require('./qvac-engine')
const { cloneJson, hash32, stableId } = require('./util')

const RUN_VERSION = 'ultimate-sports-mini-game-runner-v1'
const REFEREE_VERSION = 'qvac-mini-game-referee-v1'

function createMiniGameRunPlan ({
  fitId,
  gameType,
  spec = null,
  roomId = 'room:test',
  competitionId = 'competition:test',
  fixtureId = null,
  players = ['peer-a', 'peer-b'],
  userIds = players,
  settlementMode = 'demo',
  stakeMode = settlementMode,
  gameId = null,
  marketId = null,
  slateId = null,
  athletes = null,
  createdAt = new Date().toISOString()
} = {}) {
  const resolvedSpec = spec || miniGameSpec.createMiniGameSpec({ fitId, gameType, settlementMode })
  const participantIds = uniqueStrings(userIds.length ? userIds : players)
  const artifact = artifactForSpec({
    spec: resolvedSpec,
    roomId,
    competitionId,
    fixtureId,
    players: uniqueStrings(players),
    settlementMode,
    stakeMode,
    gameId,
    marketId,
    slateId,
    athletes
  })
  const body = {
    fitId: resolvedSpec.fitId,
    gameType: resolvedSpec.gameType,
    roomId,
    competitionId,
    artifactId: artifactIdFor(artifact)
  }

  return {
    runVersion: RUN_VERSION,
    runId: stableId(`mini-game-run-${resolvedSpec.fitId}-${resolvedSpec.gameType}`, body),
    fitId: resolvedSpec.fitId,
    gameType: resolvedSpec.gameType,
    mode: resolvedSpec.mode,
    roomId,
    competitionId,
    fixtureId,
    settlementMode,
    participants: participantIds,
    spec: cloneJson(resolvedSpec),
    artifactType: artifactTypeFor(resolvedSpec),
    artifact,
    setupCommand: {
      type: resolvedSpec.commandDraft.type,
      payload: cloneJson(artifact)
    },
    refereePlan: createRefereePlan({ spec: resolvedSpec, settlementMode }),
    qvacNeeded: needsQvacReferee(resolvedSpec, { settlementMode }),
    createdAt
  }
}

function resolveMiniGameRun ({
  plan,
  fitId,
  gameType,
  settlementMode = 'demo',
  roomId,
  competitionId,
  reveals = [],
  result = null,
  predictions = [],
  entries = [],
  athleteStats = {},
  marketResolutions = [],
  userIds = [],
  evidenceEvents = [],
  qvacInput = {},
  resolvedAt = new Date().toISOString()
} = {}) {
  const runPlan = plan || createMiniGameRunPlan({
    fitId,
    gameType,
    settlementMode,
    roomId: roomId || undefined,
    competitionId: competitionId || undefined,
    userIds
  })
  const resolutionBundle = resolveArtifact({
    plan: runPlan,
    reveals,
    result,
    predictions,
    entries,
    athleteStats,
    marketResolutions,
    userIds,
    resolvedAt
  })
  const shouldReferee = needsQvacReferee(runPlan, qvacInput)
  const refereePacket = shouldReferee || qvacInput.forceQvac
    ? createQvacRefereePacket({
        plan: runPlan,
        resolution: resolutionBundle.resolution,
        resultKind: resolutionBundle.resultKind,
        evidenceEvents,
        ...qvacInput
      })
    : null

  return {
    runVersion: RUN_VERSION,
    runId: runPlan.runId,
    fitId: runPlan.fitId,
    gameType: runPlan.gameType,
    mode: runPlan.mode,
    artifactType: runPlan.artifactType,
    artifact: cloneJson(runPlan.artifact),
    resultKind: resolutionBundle.resultKind,
    resolution: resolutionBundle.resolution,
    refereePacket
  }
}

function createQvacRefereePacket ({
  plan,
  resolution,
  resultKind = null,
  evidenceEvents = [],
  requiredTypes = [],
  questions = [],
  sourceFacts = [],
  verified = false,
  confidence = 1,
  rejectedReason = null,
  summary = null,
  createdAt = new Date().toISOString(),
  assertions = {},
  forceQvac = false
} = {}) {
  if (!plan || typeof plan !== 'object') throw new TypeError('plan is required')
  if (!resolution || typeof resolution !== 'object') throw new TypeError('resolution is required')
  const reasons = qvacRefereeReasons(plan, { forceQvac })
  const targetType = targetTypeFor({ plan, resultKind })
  const targetId = targetIdFor({ plan, resolution })
  const defaultAssertions = {
    runId: plan.runId,
    fitId: plan.fitId,
    gameType: plan.gameType,
    mode: plan.mode,
    resultKind,
    resultSource: plan.spec && plan.spec.resultSource || null,
    refereeReasons: reasons,
    winnerUserIds: winnerUserIdsFor(resolution),
    resultHash: resultHashFor(resolution)
  }
  const record = attestation.createAttestation({
    lane: 'game-fairness',
    targetType,
    targetId,
    evidenceEvents,
    requiredTypes,
    assertions: {
      ...defaultAssertions,
      ...cloneJson(assertions)
    },
    attestorId: 'qvac-referee',
    summary: summary || refereeSummary({ plan, resolution, reasons }),
    confidence,
    rejectedReason,
    createdAt
  })
  const triviaBank = plan.gameType === 'trivia-duel'
    ? qvac.createTriviaQuestionBank({
        targetType: 'mini-game',
        targetId: plan.runId,
        mode: plan.settlementMode,
        questions,
        sourceFacts,
        verified,
        evidenceEvents,
        createdAt
      })
    : null

  return {
    refereeVersion: REFEREE_VERSION,
    needed: reasons.length > 0,
    reasonCodes: reasons,
    attestation: record,
    gate: attestation.attestationGate(record),
    questionBank: triviaBank,
    qvacGate: triviaBank ? qvac.qvacGate(triviaBank) : null
  }
}

function needsQvacReferee (specOrPlan, options = {}) {
  return qvacRefereeReasons(specOrPlan, options).length > 0
}

function createMiniGameRunMatrix ({ settlementMode = 'demo', roomIdPrefix = 'room', competitionIdPrefix = 'competition' } = {}) {
  const matrix = miniGameSpec.createMiniGameBuildMatrix({ settlementMode })
  const suites = matrix.suites.map(suite => {
    const plans = suite.specs.map(spec => createMiniGameRunPlan({
      spec,
      fitId: spec.fitId,
      gameType: spec.gameType,
      roomId: `${roomIdPrefix}:${spec.fitId}`,
      competitionId: `${competitionIdPrefix}:${spec.fitId}`,
      settlementMode
    }))
    return {
      fitId: suite.fitId,
      title: suite.title,
      category: suite.category,
      settlementMode,
      gameTypes: plans.map(plan => plan.gameType),
      plans
    }
  })

  return {
    matrixVersion: 'ultimate-sports-mini-game-run-matrix-v1',
    runVersion: RUN_VERSION,
    settlementMode,
    fitIds: suites.map(suite => suite.fitId),
    totalPlans: suites.reduce((sum, suite) => sum + suite.plans.length, 0),
    suites
  }
}

function artifactForSpec ({ spec, roomId, competitionId, fixtureId, players, settlementMode, stakeMode, gameId, marketId, slateId, athletes }) {
  if (spec.mode === 'peer-game') {
    return game.createPeerGameSession({
      gameId,
      gameType: spec.gameType,
      roomId,
      players,
      stakeMode,
      resolverVersion: spec.runtime.resolver && `${spec.runtime.resolver}-v1` || `${spec.gameType}-v1`,
      status: 'invited'
    })
  }
  if (spec.mode === 'live-market') {
    return livePrediction.createPredictionMarket({
      marketId,
      roomId,
      competitionId,
      fixtureId,
      marketType: spec.runtime.marketType,
      mode: settlementMode,
      options: spec.commandDraft.payload.options,
      inputTemplate: spec.commandDraft.payload.inputTemplate,
      scoringConfig: spec.commandDraft.payload.scoringConfig,
      status: 'open'
    })
  }
  if (spec.mode === 'draft') {
    return draft.createDraftSlate({
      slateId,
      competitionId,
      title: spec.commandDraft.payload.title,
      rosterSize: spec.commandDraft.payload.rosterSize || 3,
      athletes: athletes || defaultAthletesForSpec(spec),
      scoringRules: scoringRulesForSpec(spec)
    })
  }
  throw new Error(`unsupported mini-game mode: ${spec.mode}`)
}

function resolveArtifact ({ plan, reveals, result, predictions, entries, athleteStats, marketResolutions, userIds, resolvedAt }) {
  if (plan.mode === 'peer-game') {
    return {
      resultKind: 'game-resolution',
      resolution: miniGame.resolveMiniGame({
        session: plan.artifact,
        reveals,
        result: result || {},
        resolvedAt
      })
    }
  }
  if (plan.mode === 'live-market') {
    if (plan.gameType === 'watch-party-streak' && marketResolutions.length > 0) {
      return {
        resultKind: 'streak-resolution',
        resolution: livePrediction.resolveWatchPredictionStreak({
          roomId: plan.roomId,
          marketResolutions,
          userIds: userIds.length ? userIds : plan.participants,
          resolvedAt
        })
      }
    }
    return {
      resultKind: 'market-resolution',
      resolution: livePrediction.resolvePredictionMarket({
        market: plan.artifact,
        predictions,
        result,
        resolvedAt
      })
    }
  }
  if (plan.mode === 'draft') {
    return {
      resultKind: 'draft-resolution',
      resolution: draft.resolveDraftSlate({
        slate: plan.artifact,
        entries,
        athleteStats,
        resolvedAt
      })
    }
  }
  throw new Error(`unsupported mini-game mode: ${plan.mode}`)
}

function createRefereePlan ({ spec, settlementMode }) {
  const reasons = qvacRefereeReasons(spec, { settlementMode })
  return {
    refereeVersion: REFEREE_VERSION,
    lane: 'game-fairness',
    attestorId: 'qvac-referee',
    required: reasons.length > 0,
    reasonCodes: reasons,
    evidencePolicy: reasons.length > 0 ? 'required-before-settlement' : 'optional-audit',
    triviaBankRequired: spec.gameType === 'trivia-duel'
  }
}

function qvacRefereeReasons (specOrPlan, options = {}) {
  const spec = normalizeSpec(specOrPlan)
  const settlementMode = options.settlementMode || settlementModeFor(specOrPlan)
  const reasons = []
  if (options.forceQvac || options.force) reasons.push('forced')
  if (spec.resultSource && spec.resultSource !== 'official-feed') reasons.push('non-official-result-source')
  if (spec.gameType === 'trivia-duel') reasons.push('question-bank-answer-key')
  if (spec.gameType === 'reaction-challenge') reasons.push('latency-window-fairness')
  if (spec.mode === 'draft') reasons.push('athlete-stat-verification')
  if (settlementMode === 'sponsor-prize' || settlementMode === 'real-money') reasons.push('prize-mode-settlement')
  return [...new Set(reasons)]
}

function normalizeSpec (specOrPlan) {
  if (!specOrPlan || typeof specOrPlan !== 'object') throw new TypeError('spec or plan is required')
  return specOrPlan.spec || specOrPlan
}

function settlementModeFor (specOrPlan) {
  if (specOrPlan.settlementMode) return specOrPlan.settlementMode
  const spec = normalizeSpec(specOrPlan)
  return spec.commandDraft && spec.commandDraft.payload && (spec.commandDraft.payload.mode || spec.commandDraft.payload.stakeMode) || 'demo'
}

function artifactTypeFor (spec) {
  if (spec.mode === 'peer-game') return 'session'
  if (spec.mode === 'live-market') return 'market'
  if (spec.mode === 'draft') return 'draft-slate'
  return 'artifact'
}

function artifactIdFor (artifact) {
  return artifact.gameId || artifact.marketId || artifact.slateId || null
}

function defaultAthletesForSpec (spec) {
  const stats = spec.sportTuning && spec.sportTuning.fantasyStats || ['points', 'assists', 'saves']
  return stats.slice(0, Math.max(3, stats.length)).map((statName, index) => ({
    athleteId: `${spec.fitId}:athlete:${index + 1}`,
    name: `${titleCase(statName)} ${index + 1}`,
    metadata: {
      primaryStat: statName,
      fitId: spec.fitId
    }
  }))
}

function scoringRulesForSpec (spec) {
  const stats = spec.sportTuning && spec.sportTuning.fantasyStats || []
  return Object.fromEntries(stats.map(statName => [statName, 1]))
}

function targetTypeFor ({ plan, resultKind }) {
  if (resultKind === 'game-resolution') return 'mini-game-resolution'
  if (resultKind === 'market-resolution') return 'prediction-market-resolution'
  if (resultKind === 'streak-resolution') return 'watch-streak-resolution'
  if (resultKind === 'draft-resolution') return 'draft-resolution'
  return `${plan.mode}-resolution`
}

function targetIdFor ({ plan, resolution }) {
  return resolution.resultId ||
    resolution.resolutionId ||
    resolution.streakId ||
    resolution.market && resolution.market.marketId ||
    plan.runId
}

function winnerUserIdsFor (resolution) {
  return cloneJson(resolution.winnerUserIds || [])
}

function resultHashFor (resolution) {
  return resolution.resultHash || hash32({
    rows: resolution.rows || [],
    winnerUserIds: resolution.winnerUserIds || [],
    marketId: resolution.market && resolution.market.marketId || null,
    slateId: resolution.slateId || null
  })
}

function refereeSummary ({ plan, resolution, reasons }) {
  const winners = winnerUserIdsFor(resolution)
  const winnerText = winners.length ? winners.join(', ') : 'no winner'
  const reasonText = reasons.length ? reasons.join(', ') : 'optional audit'
  return `${plan.gameType} resolved for ${winnerText}; QVAC referee reason: ${reasonText}.`
}

function uniqueStrings (items = []) {
  return [...new Set(items.filter(item => typeof item === 'string' && item.trim() !== ''))]
}

function titleCase (value) {
  return String(value || 'Athlete')
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase())
}

module.exports = {
  RUN_VERSION,
  REFEREE_VERSION,
  createMiniGameRunPlan,
  resolveMiniGameRun,
  createQvacRefereePacket,
  needsQvacReferee,
  createMiniGameRunMatrix
}
