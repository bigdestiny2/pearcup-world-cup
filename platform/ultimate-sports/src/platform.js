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
  sportsDataAggregator: require('./sports-data-aggregator-engine'),
  sportsDataClients: require('./sports-data-client-engine'),
  sportsDataSmoke: require('./sports-data-smoke-engine'),
  sportsDataProviders: require('./sports-data-provider-engine'),
  socialFeedProviders: require('./social-feed-provider-engine'),
  socialFeedAggregator: require('./social-feed-aggregator-engine'),
  socialFeedClients: require('./social-feed-client-engine'),
  livePrediction: require('./live-prediction-engine'),
  game: require('./game-engine'),
  identity: require('./identity-engine'),
  mmaCardAssets: require('./mma-card-asset-engine'),
  miniGame: require('./mini-game-engine'),
  miniGameSpec: require('./mini-game-spec-engine'),
  miniGameRunner: require('./mini-game-runner-engine'),
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
  standupAudit: require('./standup-audit-engine'),
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

  function createMiniGameSpec (input = {}) {
    return modules.miniGameSpec.createMiniGameSpec(input)
  }

  function createMiniGameSuite (input = {}) {
    return modules.miniGameSpec.createMiniGameSuite(input)
  }

  function createMiniGameBuildMatrix (input = {}) {
    return modules.miniGameSpec.createMiniGameBuildMatrix(input)
  }

  function createMiniGameRunPlan (input = {}) {
    return modules.miniGameRunner.createMiniGameRunPlan(input)
  }

  function resolveMiniGameRun (input = {}) {
    return modules.miniGameRunner.resolveMiniGameRun(input)
  }

  function createQvacMiniGameReferee (input = {}) {
    return modules.miniGameRunner.createQvacRefereePacket(input)
  }

  function createMiniGameRunMatrix (input = {}) {
    return modules.miniGameRunner.createMiniGameRunMatrix(input)
  }

  function createAssetGenerationPlan (input = {}) {
    return modules.tournamentExperience.createAssetGenerationPlan(input)
  }

  function createStandupAudit (input = {}) {
    return modules.standupAudit.createUltimateSportsStandupAudit(input)
  }

  function createSportsDataProviderPlan (input = {}) {
    return modules.sportsDataProviders.createSportsDataProviderPlan(input)
  }

  function createSportsDataAggregatorPlan (input = {}) {
    return modules.sportsDataAggregator.createSportsDataAggregatorPlan(input)
  }

  function aggregatorRouteForFit (fitOrInput, options = {}) {
    return modules.sportsDataAggregator.aggregatorRouteForFit(fitOrInput, options)
  }

  function normalizeSportsDataRecord (input = {}) {
    return modules.sportsDataAggregator.normalizeSportsDataRecord(input)
  }

  function createSportsDataAggregatorHealthPlan (input = {}) {
    return modules.sportsDataAggregator.createAggregatorHealthCheckPlan(input)
  }

  function createSportsDataClientPlan (input = {}) {
    return modules.sportsDataClients.createSportsDataClientPlan(input)
  }

  function sourceClientFor (sourceId) {
    return modules.sportsDataClients.sourceClientFor(sourceId)
  }

  function credentialReadinessForSource (sourceId, env = {}) {
    return modules.sportsDataClients.credentialReadinessForSource(sourceId, env)
  }

  function createSportsDataRequestPlan (input = {}) {
    return modules.sportsDataClients.createSportsDataRequestPlan(input)
  }

  function executeSportsDataRequest (input = {}) {
    return modules.sportsDataClients.executeSportsDataRequest(input)
  }

  function createSportsDataSmokePlan (input = {}) {
    return modules.sportsDataSmoke.createSportsDataSmokePlan(input)
  }

  function runSportsDataSmokeChecks (input = {}) {
    return modules.sportsDataSmoke.runSportsDataSmokeChecks(input)
  }

  function providerPlanForFit (fitOrId) {
    return modules.sportsDataProviders.providerPlanForFit(fitOrId)
  }

  function recommendSportsDataProviderStack (input = {}) {
    return modules.sportsDataProviders.recommendProviderStack(input)
  }

  function createSocialFeedProviderPlan (input = {}) {
    return modules.socialFeedProviders.createSocialFeedProviderPlan(input)
  }

  function socialFeedProviderPlanForFit (fitOrId) {
    return modules.socialFeedProviders.providerPlanForFit(fitOrId)
  }

  function createSocialFeedAggregatorPlan (input = {}) {
    return modules.socialFeedAggregator.createSocialFeedAggregatorPlan(input)
  }

  function socialFeedRouteForFit (fitOrId) {
    return modules.socialFeedAggregator.aggregatorRouteForFit(fitOrId)
  }

  function normalizeSocialPost (input = {}) {
    return modules.socialFeedAggregator.normalizeSocialPost(input)
  }

  function dedupeSocialPosts (posts) {
    return modules.socialFeedAggregator.dedupeSocialPosts(posts)
  }

  function createSocialFeedClientPlan (input = {}) {
    return modules.socialFeedClients.createSocialFeedClientPlan(input)
  }

  function socialFeedSourceClientFor (sourceId) {
    return modules.socialFeedClients.sourceClientFor(sourceId)
  }

  function socialFeedCredentialReadinessForSource (sourceId, env = {}) {
    return modules.socialFeedClients.credentialReadinessForSource(sourceId, env)
  }

  function createSocialFeedRequestPlan (input = {}) {
    return modules.socialFeedClients.createSocialFeedRequestPlan(input)
  }

  function executeSocialFeedRequest (input = {}) {
    return modules.socialFeedClients.executeSocialFeedRequest(input)
  }

  function assertNoSocialFeedSettlementLeak (command) {
    return modules.socialFeedAggregator.assertNoSettlementLeak(command)
  }

  function assertNoSocialFeedPrizeProximityLeak (targetEngineId, payload) {
    return modules.socialFeedAggregator.assertNoPrizeProximityLeak(targetEngineId, payload)
  }

  function createMmaCardAssetPlan (input = {}) {
    return modules.mmaCardAssets.createMmaCardAssetPlan(input)
  }

  function createMmaCardHiggsfieldQueue (input = {}) {
    return modules.mmaCardAssets.createMmaCardHiggsfieldQueue(input)
  }

  function createMmaCardHiggsfieldApiRequestPlan (input = {}) {
    return modules.mmaCardAssets.createMmaCardHiggsfieldApiRequestPlan(input)
  }

  function submitMmaCardHiggsfieldJobs (input = {}) {
    return modules.mmaCardAssets.submitMmaCardHiggsfieldJobs(input)
  }

  function createMmaCardGeneratedAssetAudit (input = {}) {
    return modules.mmaCardAssets.createMmaCardGeneratedAssetAudit(input)
  }

  function listMmaCardApiRequirements () {
    return modules.mmaCardAssets.listMmaCardApiRequirements()
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
    createMiniGameSpec,
    createMiniGameSuite,
    createMiniGameBuildMatrix,
    createMiniGameRunPlan,
    resolveMiniGameRun,
    createQvacMiniGameReferee,
    createMiniGameRunMatrix,
    createAssetGenerationPlan,
    createStandupAudit,
    createSportsDataAggregatorPlan,
    aggregatorRouteForFit,
    normalizeSportsDataRecord,
    createSportsDataAggregatorHealthPlan,
    createSportsDataClientPlan,
    sourceClientFor,
    credentialReadinessForSource,
    createSportsDataRequestPlan,
    executeSportsDataRequest,
    createSportsDataSmokePlan,
    runSportsDataSmokeChecks,
    createSportsDataProviderPlan,
    providerPlanForFit,
    recommendSportsDataProviderStack,
    createSocialFeedProviderPlan,
    socialFeedProviderPlanForFit,
    createSocialFeedAggregatorPlan,
    socialFeedRouteForFit,
    normalizeSocialPost,
    dedupeSocialPosts,
    createSocialFeedClientPlan,
    socialFeedSourceClientFor,
    socialFeedCredentialReadinessForSource,
    createSocialFeedRequestPlan,
    executeSocialFeedRequest,
    assertNoSocialFeedSettlementLeak,
    assertNoSocialFeedPrizeProximityLeak,
    createMmaCardAssetPlan,
    createMmaCardHiggsfieldQueue,
    createMmaCardHiggsfieldApiRequestPlan,
    submitMmaCardHiggsfieldJobs,
    createMmaCardGeneratedAssetAudit,
    listMmaCardApiRequirements,
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
