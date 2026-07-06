'use strict'

const { createUltimateSportsPlatform } = require('./platform')
const { stableId } = require('./util')

const BRIDGE_PROTOCOL_VERSION = 'ultimate-sports-platform-v1'
const BRIDGE_ACTIONS = Object.freeze([
  'dispatch',
  'evaluateCommand',
  'setPolicyContext',
  'policyContext',
  'applyScenario',
  'catalog',
  'recommendStack',
  'catalogCompatibility',
  'createLaunchPlan',
  'createLaunchScenario',
  'createLaunchMatrix',
  'createExperience',
  'createSurface',
  'createStandupAudit',
  'createSportsDataAggregatorPlan',
  'aggregatorRouteForFit',
  'normalizeSportsDataRecord',
  'createSportsDataAggregatorHealthPlan',
  'createSportsDataClientPlan',
  'sourceClientFor',
  'credentialReadinessForSource',
  'createSportsDataRequestPlan',
  'createSportsDataSmokePlan',
  'createSportsDataProviderPlan',
  'providerPlanForFit',
  'recommendSportsDataProviderStack',
  'createChallengeWagerPlan',
  'materializeChallenge',
  'dispatchMaterializedChallenge',
  'view',
  'events',
  'root',
  'joinTopic',
  'leaveTopic',
  'publishTopic',
  'pullTopic',
  'syncTopic',
  'merge',
  'exportSnapshot',
  'importSnapshot',
  'serializeSnapshot',
  'parseSnapshot',
  'status'
])

function createBridgeRequest ({ action, payload = {}, requestId = null, protocol = BRIDGE_PROTOCOL_VERSION } = {}) {
  if (typeof action !== 'string' || action.trim() === '') throw new TypeError('action is required')
  return {
    protocol,
    requestId: requestId || stableId(`bridge-${action}`, { action, payload }),
    action,
    payload
  }
}

function createBridgeHandler (options = {}) {
  const platform = options.platform || createUltimateSportsPlatform(options.platformOptions || {})

  function handle (request) {
    const validation = validateBridgeRequest(request)
    if (!validation.ok) {
      return bridgeResponse({
        request,
        ok: false,
        error: {
          code: 'invalid-request',
          message: validation.errors.join('; ')
        }
      })
    }

    try {
      return bridgeResponse({
        request,
        ok: true,
        result: routeAction(platform, request.action, request.payload || {})
      })
    } catch (error) {
      return bridgeResponse({
        request,
        ok: false,
        error: {
          code: 'handler-error',
          message: error.message,
          policy: error.policy || null
        }
      })
    }
  }

  return {
    platform,
    handle
  }
}

function validateBridgeRequest (request) {
  const errors = []
  if (!request || typeof request !== 'object') errors.push('request must be an object')
  if (request && request.protocol !== BRIDGE_PROTOCOL_VERSION) errors.push(`protocol must be ${BRIDGE_PROTOCOL_VERSION}`)
  if (request && typeof request.requestId !== 'string') errors.push('requestId must be a string')
  if (request && !BRIDGE_ACTIONS.includes(request.action)) errors.push(`unsupported action: ${request && request.action}`)
  return {
    ok: errors.length === 0,
    errors
  }
}

function routeAction (platform, action, payload) {
  switch (action) {
    case 'dispatch':
      return platform.dispatch(payload.command)
    case 'evaluateCommand':
      return platform.evaluateCommand(payload.command)
    case 'setPolicyContext':
      return platform.setPolicyContext(payload.context || payload)
    case 'policyContext':
      return platform.policyContext()
    case 'applyScenario':
      return platform.applyScenario(payload.scenario || payload.scenarioId, payload.input || {})
    case 'catalog':
      return platform.catalog(payload.query || payload)
    case 'recommendStack':
      return platform.recommendStack(payload.input || payload)
    case 'catalogCompatibility':
      return platform.catalogCompatibility(payload.input || payload)
    case 'createLaunchPlan':
      return platform.createLaunchPlan(payload.input || payload)
    case 'createLaunchScenario':
      return platform.createLaunchScenario(payload.input || payload)
    case 'createLaunchMatrix':
      return platform.createLaunchMatrix(payload.input || payload)
    case 'createExperience':
      return platform.createExperience(payload.input || payload)
    case 'createSurface':
      return platform.createSurface(payload.surfaceId, payload.input || {})
    case 'createStandupAudit':
      return platform.createStandupAudit(payload.input || payload)
    case 'createSportsDataAggregatorPlan':
      return platform.createSportsDataAggregatorPlan(payload.input || payload)
    case 'aggregatorRouteForFit':
      return platform.aggregatorRouteForFit(payload.fit || payload.fitId || payload, payload.options || {})
    case 'normalizeSportsDataRecord':
      return platform.normalizeSportsDataRecord(payload.input || payload)
    case 'createSportsDataAggregatorHealthPlan':
      return platform.createSportsDataAggregatorHealthPlan(payload.input || payload)
    case 'createSportsDataClientPlan':
      return platform.createSportsDataClientPlan(payload.input || payload)
    case 'sourceClientFor':
      return platform.sourceClientFor(payload.sourceId || payload)
    case 'credentialReadinessForSource':
      return platform.credentialReadinessForSource(payload.sourceId, payload.env || {})
    case 'createSportsDataRequestPlan':
      return platform.createSportsDataRequestPlan(payload.input || payload)
    case 'createSportsDataSmokePlan':
      return platform.createSportsDataSmokePlan(payload.input || payload)
    case 'createSportsDataProviderPlan':
      return platform.createSportsDataProviderPlan(payload.input || payload)
    case 'providerPlanForFit':
      return platform.providerPlanForFit(payload.fit || payload.fitId || payload)
    case 'recommendSportsDataProviderStack':
      return platform.recommendSportsDataProviderStack(payload.input || payload)
    case 'createChallengeWagerPlan':
      return platform.createChallengeWagerPlan(payload.challengeId || payload.challengeRef || payload.challenge, payload.input || {})
    case 'materializeChallenge':
      return platform.materializeChallenge(payload.challengeId || payload.challengeRef || payload, payload.options || {})
    case 'dispatchMaterializedChallenge':
      return platform.dispatchMaterializedChallenge(payload.challengeId || payload.challengeRef || payload, payload.options || {})
    case 'view':
      return platform.view()
    case 'events':
      return {
        events: platform.events(),
        eventRoot: platform.root()
      }
    case 'root':
      return {
        eventRoot: platform.root()
      }
    case 'joinTopic':
      return platform.joinTopic(payload.topic || payload)
    case 'leaveTopic':
      return platform.leaveTopic(payload.topic || payload)
    case 'publishTopic':
      return platform.publishTopic(payload.topic || payload, payload.events)
    case 'pullTopic':
      return platform.pullTopic(payload.topic || payload, payload.sinceEventIds)
    case 'syncTopic':
      return platform.syncTopic(payload.topic || payload)
    case 'merge':
      return {
        events: platform.merge(payload.events || []),
        eventRoot: platform.root()
      }
    case 'exportSnapshot':
      return platform.exportSnapshot(payload.options || payload)
    case 'importSnapshot':
      return platform.importSnapshot(payload.snapshot || payload)
    case 'serializeSnapshot':
      return {
        snapshotText: platform.serializeSnapshot(payload.options || payload)
      }
    case 'parseSnapshot':
      return platform.parseSnapshot(payload.snapshotText || payload.text)
    case 'status':
      return {
        peerId: platform.peerId,
        eventRoot: platform.root(),
        eventCount: platform.events().length,
        joinedTopics: [...platform.joinedTopics].sort(),
        policyContext: platform.policyContext(),
        transport: platform.bus.status()
      }
    default:
      throw new Error(`unsupported action: ${action}`)
  }
}

function bridgeResponse ({ request, ok, result = null, error = null }) {
  return {
    protocol: BRIDGE_PROTOCOL_VERSION,
    requestId: request && request.requestId || null,
    ok,
    result,
    error
  }
}

module.exports = {
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_ACTIONS,
  createBridgeRequest,
  createBridgeHandler,
  validateBridgeRequest,
  routeAction
}
