(function attachPoolVariantHelpers (root) {
  const DEFAULT_VARIANTS = ['classic-bracket', 'confidence', 'survivor', 'upset-bounty']

  const VARIANT_LABELS = {
    'classic-bracket': 'Classic bracket',
    'confidence': 'Confidence card',
    'survivor': 'Survivor',
    'upset-bounty': 'Upset bounty',
    'head-to-head-duel': 'Head-to-head duel',
    'group-stage-card': 'Group stage card',
    'fantasy-lite-draft': 'Fantasy lite draft',
    'watch-party-bingo': 'Watch-party bingo',
    'next-event': 'Next event',
    'scoreline-lock': 'Scoreline lock',
    'player-prop': 'Player prop',
    'side-quest': 'Side quest'
  }

  function assignPoolVariants (pools, recommendedVariants) {
    const variants = Array.isArray(recommendedVariants) && recommendedVariants.length
      ? recommendedVariants
      : DEFAULT_VARIANTS
    return (pools || []).map((pool, index) => ({
      ...pool,
      variant: pool.variant || variants[index % variants.length] || 'classic-bracket'
    }))
  }

  function variantDisplayName (variant) {
    return VARIANT_LABELS[variant] || variant || 'Classic bracket'
  }

  function swapActivePicks (state, newVariant) {
    const currentVariant = state.selectedPoolVariant || 'classic-bracket'
    if (!state.variantPicks) state.variantPicks = {}
    state.variantPicks[currentVariant] = { ...(state.picks || {}) }
    state.picks = { ...(state.variantPicks[newVariant] || {}) }
    state.selectedPoolVariant = newVariant
  }

  function mirrorActivePicks (state) {
    const currentVariant = state.selectedPoolVariant || 'classic-bracket'
    if (!state.variantPicks) state.variantPicks = {}
    state.variantPicks[currentVariant] = { ...(state.picks || {}) }
  }

  function normalizeEnteredPools (enteredPools) {
    const normalized = {}
    for (const [tier, value] of Object.entries(enteredPools || {})) {
      if (value === true) {
        normalized[tier] = { variant: 'classic-bracket', enteredAt: null }
      } else if (value && typeof value === 'object') {
        normalized[tier] = { variant: value.variant || 'classic-bracket', enteredAt: value.enteredAt || null }
      }
    }
    return normalized
  }

  function validateConfidencePicks (picksArray, options = {}) {
    const list = Array.isArray(picksArray) ? picksArray : Object.values(picksArray || {})
    const requireUnique = options.requireUnique !== false
    const seen = new Set()
    const errors = []
    list.forEach((pick, index) => {
      const confidence = Number(pick && pick.confidence)
      if (!Number.isFinite(confidence) || confidence <= 0) {
        errors.push(`pick ${index + 1} must have a positive confidence`)
        return
      }
      if (requireUnique && seen.has(confidence)) {
        errors.push(`confidence ${confidence} is used more than once`)
      }
      seen.add(confidence)
    })
    return { ok: errors.length === 0, errors, seen: [...seen] }
  }

  function buildConfidenceSubmissionPicks (picksObject, matchIds) {
    const picks = []
    for (const matchId of matchIds || []) {
      const outcome = picksObject[matchId]
      const confidence = picksObject[`${matchId}-confidence`]
      if (outcome && confidence) {
        picks.push({ pickId: matchId, outcome, confidence: Number(confidence) })
      }
    }
    return picks
  }

  function buildSurvivorSubmissionPicks (picksObject) {
    const picks = []
    for (let round = 1; round <= 10; round++) {
      const entrantId = picksObject[`survivor-r${round}`]
      if (entrantId) {
        picks.push({ roundNumber: round, fixtureId: survivorFixtureIdForRound(round), entrantId })
      }
    }
    return picks
  }

  function survivorFixtureIdForRound (round) {
    const map = { 1: 'r32', 2: 'r16', 3: 'qf', 4: 'sf', 5: 'final' }
    const prefix = map[round] || `r${round}`
    return `${prefix}-survivor`
  }

  function survivorRoundName (round) {
    const names = { 1: 'Round of 32', 2: 'Round of 16', 3: 'Quarterfinal', 4: 'Semifinal', 5: 'Final' }
    return names[round] || `Round ${round}`
  }

  function bracketRoundForMatchId (matchId) {
    const id = String(matchId || '').toLowerCase()
    if (id.startsWith('r32')) return 1
    if (id.startsWith('r16')) return 2
    if (id.startsWith('qf')) return 3
    if (id.startsWith('sf')) return 4
    if (id.includes('final')) return 5
    return 1
  }

  function seedForTeamId (teamId, teams) {
    const list = Array.isArray(teams) ? teams : []
    const index = list.findIndex(team => team && team.id === teamId)
    if (index < 0) return null
    return index + 1
  }

  function buildUpsetBountySubmissionPicks (picksObject) {
    const picks = {}
    for (const [key, value] of Object.entries(picksObject || {})) {
      if (!key.includes('-confidence') && !key.startsWith('survivor-') && !key.includes('-slot-')) {
        picks[key] = value
      }
    }
    return picks
  }

  function buildSideQuestSubmissionPicks (picksObject) {
    const selected = []
    for (const value of Object.values(picksObject || {})) {
      if (typeof value === 'string') selected.push(value)
    }
    return { selectedEntrantIds: [...new Set(selected)] }
  }

  function buildSubmissionPicks (variant, picksObject, matchIds) {
    if (variant === 'confidence') return buildConfidenceSubmissionPicks(picksObject, matchIds)
    if (variant === 'survivor') return buildSurvivorSubmissionPicks(picksObject)
    if (variant === 'side-quest') return buildSideQuestSubmissionPicks(picksObject)
    return buildUpsetBountySubmissionPicks(picksObject)
  }

  const api = {
    DEFAULT_VARIANTS,
    VARIANT_LABELS,
    assignPoolVariants,
    variantDisplayName,
    swapActivePicks,
    mirrorActivePicks,
    normalizeEnteredPools,
    validateConfidencePicks,
    buildConfidenceSubmissionPicks,
    buildSurvivorSubmissionPicks,
    buildUpsetBountySubmissionPicks,
    buildSideQuestSubmissionPicks,
    buildSubmissionPicks,
    survivorFixtureIdForRound,
    survivorRoundName,
    bracketRoundForMatchId,
    seedForTeamId
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupPoolVariantHelpers = api
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this)
