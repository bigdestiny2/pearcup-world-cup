'use strict'

const catalog = require('./catalog-engine')
const { cloneJson } = require('./util')

const PROVIDER_PLAN_VERSION = 'ultimate-sports-data-provider-plan-v1'

const PROVIDERS = Object.freeze({
  sportradar: provider({
    providerId: 'sportradar',
    title: 'Sportradar',
    role: 'primary-official-sports-feed',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis'],
    strengths: ['broad enterprise official sports coverage', 'live data products', 'integrity services', 'betting/media maturity'],
    gaps: ['creator events', 'awards shows', 'local leagues', 'SailGP public API certainty', 'some esports depth requires specialist feed'],
    auth: 'server-side API keys by contracted product',
    recommendation: 'primary'
  }),
  sportsdataio: provider({
    providerId: 'sportsdataio',
    title: 'SportsDataIO',
    role: 'us-sports-and-mma-supplement',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis', 'combat-sports'],
    strengths: ['UFC / MMA API', 'US sports APIs', 'clear developer docs', 'HTTP GET with subscription header'],
    gaps: ['boxing, kickboxing, ONE Championship, and bareknuckle coverage must be verified per provider contract', 'esports majors', 'SailGP', 'creator events', 'awards shows', 'local leagues'],
    auth: 'Ocp-Apim-Subscription-Key server-side header',
    recommendation: 'supplement'
  }),
  statsPerform: provider({
    providerId: 'stats-perform',
    title: 'Stats Perform / Opta',
    role: 'premium-media-data-candidate',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis'],
    strengths: ['premium media products', 'Opta soccer heritage', 'predictive and editorial data'],
    gaps: ['opaque public API access', 'not the cleanest single integration for app MVP breadth'],
    auth: 'enterprise contract',
    recommendation: 'evaluate'
  }),
  oddsApi: provider({
    providerId: 'the-odds-api',
    title: 'The Odds API',
    role: 'odds-context',
    coverage: ['soccer', 'basketball', 'pro-sports', 'tennis', 'combat-sports'],
    strengths: ['broad odds endpoint', 'MMA sport key available', 'simple JSON API'],
    gaps: ['not a full official stats/result provider', 'not for settlement source of truth'],
    auth: 'server-side API key',
    recommendation: 'optional'
  }),
  pandascore: provider({
    providerId: 'pandascore',
    title: 'PandaScore or equivalent esports specialist',
    role: 'esports-specialist',
    coverage: ['esports'],
    strengths: ['esports schedules, teams, matches, and game-specific metadata'],
    gaps: ['traditional sports', 'SailGP', 'awards/local events'],
    auth: 'server-side token',
    recommendation: 'specialist'
  }),
  abios: provider({
    providerId: 'abios',
    title: 'Abios esports data API',
    role: 'esports-breadth-and-odds-supplement',
    coverage: ['esports'],
    strengths: ['major esports title breadth', 'match calendars and results', 'live player stats and odds products'],
    gaps: ['traditional sports', 'SailGP', 'awards/local events'],
    auth: 'server-side OAuth or API credentials by contract',
    recommendation: 'specialist'
  }),
  sailgpOfficial: provider({
    providerId: 'sailgp-official-or-partner',
    title: 'SailGP official or partner feed',
    role: 'sailing-specialist',
    coverage: ['sailing'],
    strengths: ['event schedule, official race results, standings, and telemetry if licensed'],
    gaps: ['no stable public developer API found; likely requires partnership, scraping is not a production plan'],
    auth: 'partner contract or manual evidence upload',
    recommendation: 'specialist'
  }),
  hostEvidence: provider({
    providerId: 'host-evidence-qvac',
    title: 'Host evidence + QVAC referee',
    role: 'manual-and-niche-fallback',
    coverage: ['creator', 'awards', 'local', 'sailing', 'combat-sports'],
    strengths: ['works for creator tournaments, awards, local leagues, manual corrections, unavailable feeds, and combat cards without settlement-grade APIs'],
    gaps: ['not a live official feed', 'requires evidence review for prize modes'],
    auth: 'local platform attestation',
    recommendation: 'fallback'
  })
})

const FIT_PROVIDER_OVERRIDES = Object.freeze({
  'mma-boxing-fight-card': ['sportsdataio', 'the-odds-api', 'sportradar', 'host-evidence-qvac'],
  'esports-major': ['pandascore', 'abios', 'sportradar', 'host-evidence-qvac'],
  'sailgp-companion': ['sailgp-official-or-partner', 'host-evidence-qvac', 'the-odds-api'],
  'creator-reality-brackets': ['host-evidence-qvac'],
  'awards-prediction-pools': ['host-evidence-qvac'],
  'local-leagues': ['host-evidence-qvac', 'sportsdataio']
})

function createSportsDataProviderPlan () {
  const fits = catalog.listEventFits().map(fit => providerPlanForFit(fit))
  const providerScores = scoreProviders(fits)

  return {
    planVersion: PROVIDER_PLAN_VERSION,
    recommendation: {
      headline: 'Use Sportradar as the primary contracted official-sports feed, then add specialist providers for MMA, esports, SailGP, odds, and manual events.',
      reason: 'The catalog spans mainstream sports, combat sports, esports, awards, creator events, local leagues, and SailGP. No single public provider cleanly covers all of that with settlement-grade data.',
      primaryProviderId: 'sportradar',
      requiredSpecialists: ['sportsdataio', 'pandascore', 'abios', 'sailgp-official-or-partner', 'host-evidence-qvac'],
      optionalProviders: ['the-odds-api', 'stats-perform']
    },
    providers: Object.values(PROVIDERS).map(cloneJson),
    fits,
    providerScores
  }
}

function providerPlanForFit (fitOrId) {
  const fit = typeof fitOrId === 'string' ? catalog.getEventFit(fitOrId) : fitOrId
  if (!fit) throw new Error(`unknown fit: ${fitOrId}`)
  const providerIds = FIT_PROVIDER_OVERRIDES[fit.fitId] || providerIdsForCategory(fit.category)
  const providers = providerIds.map(providerById)
  const primary = providers[0]

  return {
    fitId: fit.fitId,
    title: fit.title,
    category: fit.category,
    resultPolicy: fit.resultPolicy,
    providerIds,
    primaryProviderId: primary.providerId,
    providers: providers.map(provider => ({
      providerId: provider.providerId,
      role: provider.role,
      recommendation: provider.recommendation
    })),
    settlementSource: settlementSourceFor({ fit, primary }),
    fallback: fallbackForFit(fit)
  }
}

function recommendProviderStack ({ fitId = null } = {}) {
  if (fitId) return providerPlanForFit(fitId)
  return createSportsDataProviderPlan().recommendation
}

function providerIdsForCategory (category) {
  if (category === 'soccer') return ['sportradar', 'sportsdataio', 'the-odds-api']
  if (category === 'basketball') return ['sportradar', 'sportsdataio', 'the-odds-api']
  if (category === 'pro-sports') return ['sportradar', 'sportsdataio', 'the-odds-api']
  if (category === 'tennis') return ['sportradar', 'sportsdataio', 'the-odds-api']
  return ['host-evidence-qvac']
}

function providerById (providerId) {
  const provider = Object.values(PROVIDERS).find(item => item.providerId === providerId)
  if (!provider) throw new Error(`unknown sports data provider: ${providerId}`)
  return provider
}

function settlementSourceFor ({ fit, primary }) {
  if (fit.resultPolicy === 'host-entered') return 'qvac-reviewed-host-evidence'
  if (fit.resultPolicy === 'hybrid') return `${primary.providerId}-or-qvac-reviewed-evidence`
  return `${primary.providerId}-official-feed`
}

function fallbackForFit (fit) {
  if (fit.resultPolicy === 'official-feed') return 'host correction overlay with QVAC attestation when official feed is delayed or disputed'
  if (fit.resultPolicy === 'hybrid') return 'manual race result entry with source links, screenshots, or partner-feed snapshots reviewed by QVAC'
  return 'host result workbench with QVAC evidence before prize settlement'
}

function scoreProviders (fitPlans) {
  return Object.values(PROVIDERS)
    .map(provider => {
      const primaryFitIds = fitPlans.filter(fit => fit.primaryProviderId === provider.providerId).map(fit => fit.fitId)
      const coveredFitIds = fitPlans.filter(fit => fit.providerIds.includes(provider.providerId)).map(fit => fit.fitId)
      return {
        providerId: provider.providerId,
        title: provider.title,
        primaryFitIds,
        coveredFitIds,
        primaryFitCount: primaryFitIds.length,
        coveredFitCount: coveredFitIds.length,
        recommendation: provider.recommendation
      }
    })
    .sort((left, right) => {
      if (right.primaryFitCount !== left.primaryFitCount) return right.primaryFitCount - left.primaryFitCount
      if (right.coveredFitCount !== left.coveredFitCount) return right.coveredFitCount - left.coveredFitCount
      return left.providerId.localeCompare(right.providerId)
    })
}

function provider (input) {
  return Object.freeze({
    providerId: input.providerId,
    title: input.title,
    role: input.role,
    coverage: Object.freeze(input.coverage.slice()),
    strengths: Object.freeze(input.strengths.slice()),
    gaps: Object.freeze(input.gaps.slice()),
    auth: input.auth,
    recommendation: input.recommendation
  })
}

module.exports = {
  PROVIDER_PLAN_VERSION,
  PROVIDERS,
  createSportsDataProviderPlan,
  providerPlanForFit,
  recommendProviderStack
}
