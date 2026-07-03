'use strict'

const modules = {
  attestation: require('./attestation-engine'),
  constants: require('./constants'),
  util: require('./util'),
  eventLog: require('./event-log'),
  transport: require('./transport-engine'),
  tournamentExperience: require('./tournament-experience-engine'),
  runtime: require('./platform-runtime'),
  catalog: require('./catalog-engine'),
  challenge: require('./challenge-engine'),
  compliance: require('./compliance-engine'),
  compatibility: require('./compatibility-engine'),
  diagnostics: require('./diagnostics-engine'),
  launch: require('./launch-engine'),
  competition: require('./competition-engine'),
  card: require('./card-engine'),
  dispute: require('./dispute-engine'),
  draft: require('./draft-engine'),
  engagement: require('./engagement-engine'),
  prediction: require('./prediction-engine'),
  pick: require('./pick-engine'),
  pool: require('./pool-engine'),
  persistence: require('./persistence-engine'),
  policy: require('./policy-engine'),
  qvac: require('./qvac-engine'),
  scoring: require('./scoring-engine'),
  livePrediction: require('./live-prediction-engine'),
  game: require('./game-engine'),
  identity: require('./identity-engine'),
  miniGame: require('./mini-game-engine'),
  notification: require('./notification-engine'),
  ops: require('./ops-engine'),
  surface: require('./surface-engine'),
  watch: require('./watch-engine'),
  room: require('./room-engine'),
  feed: require('./feed-engine'),
  settlement: require('./settlement-engine'),
  wallet: require('./wallet-engine'),
  walletOps: require('./wallet-ops-engine'),
  wager: require('./wager-engine'),
  creator: require('./creator-engine'),
  scenarios: require('./scenarios')
}

function createUltimateSportsPlatform ({
  peerId = 'local-peer',
  events = [],
  transport = null,
  policyContext = {}
} = {}) {
  const runtime = modules.runtime.createPlatformRuntime({ events })
  const bus = transport || modules.transport.createTransportSim()
  const joinedTopics = new Set()
  let commandPolicyContext = modules.policy.normalizePolicyContext(policyContext)

  function dispatch (command) {
    modules.policy.assertCommandAllowed({
      command,
      view: runtime.view(),
      context: commandPolicyContext
    })
    return runtime.dispatch(command)
  }

  function evaluateCommand (command) {
    return modules.policy.evaluateCommandPolicy({
      command,
      view: runtime.view(),
      context: commandPolicyContext
    })
  }

  function setPolicyContext (nextContext = {}) {
    commandPolicyContext = modules.policy.normalizePolicyContext({
      ...commandPolicyContext,
      ...nextContext,
      gates: Object.prototype.hasOwnProperty.call(nextContext, 'gates')
        ? nextContext.gates
        : commandPolicyContext.gates
    })
    return getPolicyContext()
  }

  function getPolicyContext () {
    return modules.policy.normalizePolicyContext(commandPolicyContext)
  }

  function applyScenario (scenarioOrId, input = {}) {
    const scenario = typeof scenarioOrId === 'string'
      ? modules.scenarios.scenarioById(scenarioOrId, input)
      : scenarioOrId
    if (!scenario || !Array.isArray(scenario.commands)) throw new TypeError('scenario with commands is required')

    const events = scenario.commands.map(command => dispatch(command))
    return {
      scenario,
      scenarioRunId: modules.scenarios.scenarioRunId(scenario),
      events,
      view: runtime.view()
    }
  }

  function catalog (query = {}) {
    return modules.catalog.buildCatalog(query)
  }

  function recommendStack (input = {}) {
    return modules.catalog.recommendProductStack(input)
  }

  function catalogCompatibility (input = {}) {
    return modules.catalog.compatibilityFor(input)
  }

  function createLaunchPlan (input = {}) {
    return modules.launch.createLaunchPlan(input)
  }

  function createLaunchScenario (input = {}) {
    return modules.launch.createLaunchScenario(input)
  }

  function createLaunchMatrix (input = {}) {
    return modules.launch.createLaunchMatrix(input)
  }

  function draftCreatorCompetition (input = {}) {
    return dispatch({
      type: 'creator:draftCompetition',
      actorId: input.actorId || input.organizerId || peerId,
      occurredAt: input.occurredAt,
      payload: input
    })
  }

  function addCreatorDraftEntrant (draftRef, entrant, input = {}) {
    const draft = resolveCreatorDraft(draftRef)
    return dispatch({
      type: 'creator:addEntrant',
      actorId: input.actorId || draft.organizerId,
      occurredAt: input.occurredAt,
      payload: {
        draftId: draft.draftId,
        entrant,
        ...input.payload
      }
    })
  }

  function seedCreatorDraft (draftRef, input = {}) {
    const draft = resolveCreatorDraft(draftRef)
    return dispatch({
      type: 'creator:seedBracket',
      actorId: input.actorId || draft.organizerId,
      occurredAt: input.occurredAt,
      payload: {
        draftId: draft.draftId,
        ...input
      }
    })
  }

  function createCreatorPublishPlan (draftRef, input = {}) {
    return modules.creator.createCreatorPublishPlan(resolveCreatorDraft(draftRef), input)
  }

  function createCreatorLaunchScenario (draftRef, input = {}) {
    return modules.creator.createCreatorLaunchScenario(resolveCreatorDraft(draftRef), input)
  }

  function dispatchCreatorPublishPlan (draftOrPlan, input = {}) {
    const plan = draftOrPlan && Array.isArray(draftOrPlan.commands)
      ? draftOrPlan
      : createCreatorPublishPlan(draftOrPlan, input)
    const events = plan.commands.map(command => dispatch(command))
    return {
      plan,
      events,
      view: runtime.view()
    }
  }

  function createCreatorResultPlan (input = {}) {
    return modules.creator.createCreatorResultPlan(input)
  }

  function createCreatorWorkbench (input = {}) {
    return modules.creator.createCreatorWorkbench({
      ...input,
      userId: input.userId || peerId,
      view: runtime.view()
    })
  }

  function createPickWorkbench (input = {}) {
    return modules.pick.createPickWorkbench({
      ...input,
      userId: input.userId || peerId,
      view: runtime.view()
    })
  }

  function createWatchPartyWorkbench (input = {}) {
    return modules.watch.createWatchPartyWorkbench({
      ...input,
      userId: input.userId || peerId,
      view: runtime.view()
    })
  }

  function createWalletOpsWorkbench (input = {}) {
    return modules.walletOps.createWalletOpsWorkbench({
      ...input,
      userId: input.userId || peerId,
      view: runtime.view()
    })
  }

  function createChallengeWagerPlan (challengeRef, input = {}) {
    const challenge = resolveChallenge(challengeRef)
    return modules.wager.createChallengeWagerPlanFromView({
      ...input,
      challenge,
      view: runtime.view()
    })
  }

  function createOpsWorkbench (input = {}) {
    return modules.ops.createOpsWorkbench({
      ...input,
      userId: input.userId || peerId,
      view: runtime.view(),
      events: runtime.events(),
      transportStatus: input.transportStatus || bus.status()
    })
  }

  function dispatchCreatorResultPlan (input = {}) {
    const plan = input && Array.isArray(input.commands)
      ? input
      : createCreatorResultPlan(input)
    const events = plan.commands.map(command => dispatch(command))
    return {
      plan,
      events,
      view: runtime.view()
    }
  }

  function materializeChallenge (challengeRef, options = {}) {
    const input = typeof challengeRef === 'object'
      ? { ...challengeRef, ...options }
      : { ...options, challengeId: challengeRef }
    const current = runtime.view()
    const challenge = input.challenge || current.roomChallenges[input.challengeId]
    if (!challenge) throw new Error(`challenge not found: ${input.challengeId}`)
    const room = input.room || current.rooms[challenge.roomId]
    if (!room) throw new Error(`room not found: ${challenge.roomId}`)
    return modules.challenge.materializeAcceptedChallenge({
      ...input,
      challenge,
      room,
      competition: input.competition || current.competitions[room.competitionId] || null
    })
  }

  function dispatchMaterializedChallenge (challengeRef, options = {}) {
    const materialization = materializeChallenge(challengeRef, options)
    return {
      materialization,
      event: dispatch(materialization.command),
      view: runtime.view()
    }
  }

  function joinTopic (topicOrRef) {
    const topic = normalizeTopic(topicOrRef)
    const joined = bus.joinTopic({ peerId, topic })
    joinedTopics.add(topic)
    return joined
  }

  function leaveTopic (topicOrRef) {
    const topic = normalizeTopic(topicOrRef)
    joinedTopics.delete(topic)
    return bus.leaveTopic({ peerId, topic })
  }

  function publishTopic (topicOrRef, eventsToPublish = runtime.events()) {
    return bus.publish({
      peerId,
      topic: normalizeTopic(topicOrRef),
      events: eventsToPublish
    })
  }

  function pullTopic (topicOrRef, sinceEventIds = runtime.events().map(event => event.eventId)) {
    const pulled = bus.pull({
      peerId,
      topic: normalizeTopic(topicOrRef),
      sinceEventIds
    })
    runtime.merge(pulled.events)
    return {
      ...pulled,
      runtimeRoot: runtime.root()
    }
  }

  function syncTopic (topicOrRef) {
    return bus.syncRuntime({
      peerId,
      topic: normalizeTopic(topicOrRef),
      runtime
    })
  }

  function joinScenarioTopics (scenario) {
    return (scenario.topics || []).map(topicRef => joinTopic(topicRef))
  }

  function diagnoseTopic (topicOrRef, peerStates = {}) {
    const topic = normalizeTopic(topicOrRef)
    return modules.diagnostics.createPeerSyncDiagnostic({
      topic,
      topicRoot: bus.topicRoot(topic),
      topicEvents: bus.topicEvents(topic),
      peers: peerStates
    })
  }

  function diagnoseTransport () {
    return modules.diagnostics.summarizeTransportStatus(bus.status())
  }

  function createLoadReport () {
    return modules.diagnostics.createPlatformLoadReport({
      view: runtime.view(),
      transportStatus: bus.status()
    })
  }

  function createExperience (input = {}) {
    return modules.surface.createExperience({
      ...input,
      userId: input.userId || peerId,
      view: runtime.view(),
      events: runtime.events(),
      transportStatus: bus.status()
    })
  }

  function createTournamentLobby (input = {}) {
    return modules.tournamentExperience.createTournamentLobby({
      ...input,
      view: input.view || runtime.view()
    })
  }

  function createTournamentExperience (input = {}) {
    return modules.tournamentExperience.createTournamentExperience(input)
  }

  function createTournamentShell (input = {}) {
    return modules.tournamentExperience.createTournamentShell({
      ...input,
      view: input.view || runtime.view(),
      userId: input.userId || peerId
    })
  }

  function createAssetGenerationPlan (input = {}) {
    return modules.tournamentExperience.createAssetGenerationPlan(input)
  }

  function createSurface (surfaceId, input = {}) {
    return modules.surface.createSurface(surfaceId, {
      ...input,
      userId: input.userId || peerId,
      view: runtime.view(),
      events: runtime.events(),
      transportStatus: bus.status()
    })
  }

  function exportSnapshot (options = {}) {
    return modules.persistence.createPlatformSnapshot({
      events: runtime.events(),
      peerId,
      joinedTopics: [...joinedTopics],
      label: options.label || null,
      createdAt: options.createdAt
    })
  }

  function importSnapshot (snapshot) {
    const imported = modules.persistence.importPlatformSnapshot(snapshot)
    runtime.merge(imported.events)
    imported.joinedTopics.forEach(topic => {
      bus.joinTopic({ peerId, topic })
      joinedTopics.add(topic)
    })
    return {
      importedEventCount: imported.eventCount,
      eventRoot: runtime.root(),
      joinedTopics: [...joinedTopics].sort()
    }
  }

  function serializeSnapshot (options = {}) {
    return modules.persistence.serializePlatformSnapshot(exportSnapshot(options))
  }

  function parseSnapshot (text) {
    const imported = modules.persistence.parsePlatformSnapshot(text)
    runtime.merge(imported.events)
    imported.joinedTopics.forEach(topic => {
      bus.joinTopic({ peerId, topic })
      joinedTopics.add(topic)
    })
    return {
      importedEventCount: imported.eventCount,
      eventRoot: runtime.root(),
      joinedTopics: [...joinedTopics].sort()
    }
  }

  function normalizeTopic (topicOrRef) {
    if (typeof topicOrRef === 'string') return topicOrRef
    if (topicOrRef && typeof topicOrRef === 'object') {
      return modules.transport.topicFor(topicOrRef.kind, topicOrRef.id)
    }
    throw new TypeError('topic string or topic reference is required')
  }

  function resolveCreatorDraft (draftRef) {
    if (draftRef && typeof draftRef === 'object') return draftRef
    const draft = runtime.view().creatorCompetitionDrafts[draftRef]
    if (!draft) throw new Error(`creator draft not found: ${draftRef}`)
    return draft
  }

  function resolveChallenge (challengeRef) {
    if (challengeRef && typeof challengeRef === 'object') return challengeRef
    const challenge = runtime.view().roomChallenges[challengeRef]
    if (!challenge) throw new Error(`challenge not found: ${challengeRef}`)
    return challenge
  }

  return {
    peerId,
    dispatch,
    evaluateCommand,
    setPolicyContext,
    policyContext: getPolicyContext,
    applyScenario,
    catalog,
    recommendStack,
    catalogCompatibility,
    createLaunchPlan,
    createLaunchScenario,
    createLaunchMatrix,
    draftCreatorCompetition,
    addCreatorDraftEntrant,
    seedCreatorDraft,
    createCreatorPublishPlan,
    createCreatorLaunchScenario,
    dispatchCreatorPublishPlan,
    createCreatorResultPlan,
    createCreatorWorkbench,
    createPickWorkbench,
    createWatchPartyWorkbench,
    createWalletOpsWorkbench,
    createChallengeWagerPlan,
    createOpsWorkbench,
    dispatchCreatorResultPlan,
    materializeChallenge,
    dispatchMaterializedChallenge,
    joinScenarioTopics,
    diagnoseTopic,
    diagnoseTransport,
    createLoadReport,
    createExperience,
    createTournamentLobby,
    createTournamentExperience,
    createTournamentShell,
    createAssetGenerationPlan,
    createSurface,
    joinTopic,
    leaveTopic,
    publishTopic,
    pullTopic,
    syncTopic,
    exportSnapshot,
    importSnapshot,
    serializeSnapshot,
    parseSnapshot,
    events: runtime.events,
    view: runtime.view,
    root: runtime.root,
    merge: runtime.merge,
    bus,
    joinedTopics,
    modules
  }
}

module.exports = {
  createUltimateSportsPlatform,
  modules
}
