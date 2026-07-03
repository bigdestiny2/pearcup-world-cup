'use strict'

const modules = {
  attestation: require('./attestation-engine'),
  constants: require('./constants'),
  util: require('./util'),
  eventLog: require('./event-log'),
  transport: require('./transport-engine'),
  runtime: require('./platform-runtime'),
  catalog: require('./catalog-engine'),
  challenge: require('./challenge-engine'),
  launch: require('./launch-engine'),
  competition: require('./competition-engine'),
  card: require('./card-engine'),
  dispute: require('./dispute-engine'),
  draft: require('./draft-engine'),
  prediction: require('./prediction-engine'),
  pool: require('./pool-engine'),
  persistence: require('./persistence-engine'),
  policy: require('./policy-engine'),
  scoring: require('./scoring-engine'),
  livePrediction: require('./live-prediction-engine'),
  game: require('./game-engine'),
  identity: require('./identity-engine'),
  miniGame: require('./mini-game-engine'),
  room: require('./room-engine'),
  feed: require('./feed-engine'),
  settlement: require('./settlement-engine'),
  wallet: require('./wallet-engine'),
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
    materializeChallenge,
    dispatchMaterializedChallenge,
    joinScenarioTopics,
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
