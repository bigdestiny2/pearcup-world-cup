(function attachPearCupCore (root) {
  const resolverVersion = 'penalty-clash-v1'

  // In the browser the shell loads engines.bundle.js before this file, so
  // root.UltimateEngines is already present. In Node tests we load the same
  // engines directly from src/ so the shell can delete its cloned demo logic
  // and always delegate to one source of truth.
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  let cachedNodeEngines = null
  function loadNodeEngines () {
    if (!canRequireLocal || cachedNodeEngines) return cachedNodeEngines
    try {
      cachedNodeEngines = {
        constants: require('../src/constants.js'),
        util: require('../src/util.js'),
        eventLog: require('../src/event-log.js'),
        scoring: require('../src/scoring-engine.js'),
        prediction: require('../src/prediction-engine.js'),
        pool: require('../src/pool-engine.js'),
        competition: require('../src/competition-engine.js')
      }
    } catch (err) {
      cachedNodeEngines = null
    }
    return cachedNodeEngines
  }
  function getEngines () {
    return (root && root.UltimateEngines) || loadNodeEngines()
  }

  function canonicalJson (value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
    }
    return JSON.stringify(value)
  }

  function hash32 (value) {
    let hash = 0x811c9dc5
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index)
      hash = Math.imul(hash, 0x01000193)
    }
    return hash >>> 0
  }

  function deterministicHash (value) {
    const text = typeof value === 'string' ? value : canonicalJson(value)
    const forward = hash32(text).toString(16).padStart(8, '0')
    const reverse = hash32(text.split('').reverse().join('')).toString(16).padStart(8, '0')
    return `0x${forward}${reverse}`
  }

  function commitmentPayload ({ gameId, roundId, playerId, input, nonce }) {
    return { gameId, roundId, playerId, input, nonce }
  }

  function createCommitment ({ gameId, roundId, playerId, input, nonce }) {
    return deterministicHash(commitmentPayload({ gameId, roundId, playerId, input, nonce }))
  }

  function verifyCommitment ({ commitment, gameId, roundId, playerId, input, nonce }) {
    return commitment === createCommitment({ gameId, roundId, playerId, input, nonce })
  }

  function sortedList (value) {
    return Array.isArray(value) ? value.map(item => String(item)).sort() : []
  }

  function sameList (left, right) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    const sortedLeft = sortedList(left)
    const sortedRight = sortedList(right)
    if (sortedLeft.length !== sortedRight.length) return false
    return sortedLeft.every((item, index) => item === sortedRight[index])
  }

  function bracketMatchWeight (matchId) {
    const id = String(matchId || '').toLowerCase()
    if (id.includes('final') || id === 'champion') return 16
    if (id.includes('semi') || id.startsWith('sf')) return 8
    if (id.includes('quarter') || id.startsWith('qf')) return 4
    if (id.includes('round16') || id.startsWith('r16')) return 2
    return 1
  }

  function roundOf (matchId) {
    const weight = bracketMatchWeight(matchId)
    if (weight >= 16) return 5
    if (weight >= 8) return 4
    if (weight >= 4) return 3
    if (weight >= 2) return 2
    return 1
  }

  function resultSnapshotFromOfficialResults (officialResults) {
    const winners = officialBracketWinners(officialResults)
    const results = {}
    for (const [matchId, winnerEntrantId] of Object.entries(winners)) {
      if (matchId == null || winnerEntrantId == null) continue
      results[matchId] = { winnerEntrantId, roundNumber: roundOf(matchId) }
    }
    return { snapshotId: deterministicHash(results), results }
  }

  function bracketPoolForEngine (rulesVersion) {
    const engines = getEngines()
    return engines.pool.createPool({
      competitionId: 'pearcup-bracket',
      variant: 'classic-bracket',
      payoutPolicy: 'demo',
      rulesVersion: rulesVersion || 'bracket-pool-v1'
    })
  }

  function deriveBracketPoolWinnersViaEngines ({ submissions, officialResults }) {
    const engines = getEngines()
    const resultSnapshot = resultSnapshotFromOfficialResults(officialResults)
    const totalMatches = Object.keys(resultSnapshot.results).length
    const rulesVersion = (submissions[0] && submissions[0].rulesVersion) || 'bracket-pool-v1'
    const pool = bracketPoolForEngine(rulesVersion)
    const entries = submissions.map(submission => engines.prediction.createPredictionEntry({
      poolId: pool.poolId,
      userId: submission.userId,
      entryId: submission.entryId || submission.submissionId,
      entryType: 'bracket',
      picks: submission.picks,
      submittedAt: submission.submittedAt,
      lockedAt: submission.submittedAt,
      status: 'locked'
    }))
    const resolution = engines.pool.resolvePoolWinners({ pool, entries, resultSnapshot })
    const rowByEntryId = new Map(resolution.leaderboard.map(row => [row.entryId, row]))
    const scoreboard = submissions.map(submission => {
      const entryId = submission.entryId || submission.submissionId
      const row = rowByEntryId.get(entryId) || {
        userId: submission.userId,
        score: 0,
        correctCount: 0,
        perfect: false
      }
      return {
        submissionId: submission.submissionId || null,
        userId: row.userId || submission.userId || null,
        entryId: submission.entryId || null,
        paymentId: submission.paymentId || null,
        picksHash: submission.picksHash || null,
        score: row.score,
        correctCount: row.correctCount,
        totalMatches,
        perfect: row.perfect
      }
    })
    const perfectRows = scoreboard.filter(row => row.perfect)
    const maxScore = scoreboard.reduce((max, row) => Math.max(max, row.score), 0)
    const winnerRows = perfectRows.length
      ? perfectRows
      : totalMatches > 0 && maxScore > 0
        ? scoreboard.filter(row => row.score === maxScore)
        : []
    const winnerUserIds = [...new Set(winnerRows.map(row => row.userId).filter(Boolean))]
    return {
      winnerUserIds,
      scoreboard,
      totalMatches,
      resolvedBy: winnerRows.length === 0
        ? 'no-qualified-bracket'
        : perfectRows.length
          ? 'perfect-bracket'
          : 'fallback-score'
    }
  }

  function officialBracketWinners (officialResults = {}) {
    if (!officialResults || typeof officialResults !== 'object') return {}
    if (officialResults.matchWinners && typeof officialResults.matchWinners === 'object') return { ...officialResults.matchWinners }
    if (officialResults.winners && typeof officialResults.winners === 'object') return { ...officialResults.winners }
    if (officialResults.results && typeof officialResults.results === 'object' && !Array.isArray(officialResults.results)) return { ...officialResults.results }
    if (Array.isArray(officialResults.matches)) {
      return officialResults.matches.reduce((winners, match) => {
        const matchId = match && (match.matchId || match.id)
        const winnerTeamId = match && (match.winnerTeamId || match.teamId || match.winner)
        if (matchId && winnerTeamId) winners[matchId] = winnerTeamId
        return winners
      }, {})
    }
    const winners = {}
    for (const [key, value] of Object.entries(officialResults)) {
      if (value && typeof value !== 'object') winners[key] = value
    }
    if (officialResults.champion && !winners.final) winners.final = officialResults.champion
    return winners
  }

  function createBracketSubmission ({
    poolId,
    entryId = null,
    paymentId = null,
    userId,
    username = null,
    picks = {},
    rulesVersion = 'bracket-pool-v1'
  }) {
    const normalizedPicks = picks && typeof picks === 'object' && !Array.isArray(picks) ? { ...picks } : {}
    const picksHash = deterministicHash(normalizedPicks)
    return {
      submissionId: deterministicHash({
        type: 'BracketSubmissionLocked',
        poolId,
        entryId,
        paymentId,
        userId,
        picksHash,
        rulesVersion
      }),
      poolId,
      entryId,
      paymentId,
      userId,
      username,
      picks: normalizedPicks,
      picksHash,
      rulesVersion,
      status: 'locked',
      submittedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function scoreBracketSubmission ({ submission, officialResults = {} } = {}) {
    const picks = submission && submission.picks && typeof submission.picks === 'object' ? submission.picks : {}
    const winners = officialBracketWinners(officialResults)
    const matchIds = Object.keys(winners).filter(matchId => winners[matchId] != null)

    // Always score through the Ultimate Sports engine (bundle in browser, src/ in Node).
    const engines = getEngines()
    const results = {}
    for (const matchId of matchIds) {
      results[matchId] = { winnerEntrantId: winners[matchId], roundNumber: roundOf(matchId) }
    }
    const engineResult = engines.scoring.scoreClassicBracket({
      entry: { picks },
      resultSnapshot: { results }
    })
    return {
      submissionId: submission && submission.submissionId || null,
      userId: submission && submission.userId || null,
      entryId: submission && submission.entryId || null,
      paymentId: submission && submission.paymentId || null,
      picksHash: submission && submission.picksHash || deterministicHash(picks),
      score: engineResult.score,
      correctCount: engineResult.correctCount,
      totalMatches: matchIds.length,
      perfect: engineResult.perfect
    }
  }

  function deriveBracketPoolWinners ({ bracketSubmissions = [], officialResults = {}, eligibleUserIds = [] } = {}) {
    const eligible = new Set(Array.isArray(eligibleUserIds) ? eligibleUserIds : [])
    const submissions = Array.isArray(bracketSubmissions)
      ? bracketSubmissions.filter(submission => {
          return submission &&
            submission.status !== 'rejected' &&
            submission.userId &&
            (eligible.size === 0 || eligible.has(submission.userId))
        })
      : []

    // Resolve through the Ultimate Sports engine (bundle in browser, src/ in Node).
    return deriveBracketPoolWinnersViaEngines({ submissions, officialResults })
  }

  function participantUserIdsForRoundResult (roundResult) {
    const ids = []
    if (roundResult && roundResult.shooter && roundResult.shooter.id) ids.push(roundResult.shooter.id)
    if (roundResult && roundResult.keeper && roundResult.keeper.id) ids.push(roundResult.keeper.id)
    return [...new Set(ids)]
  }

  function winnerUserIdForRoundResult (roundResult) {
    if (!roundResult) return null
    if (roundResult.outcome === 'forfeit') return roundResult.winnerUserId || null
    if (roundResult.outcome === 'disputed') return null
    if (roundResult.outcome === 'goal') return roundResult.shooter && roundResult.shooter.id || null
    return roundResult.keeper && roundResult.keeper.id || null
  }

  function outcomeLabel (outcome) {
    if (outcome === 'save') return 'Save confirmed'
    if (outcome === 'post') return 'Off the post'
    if (outcome === 'miss') return 'Miss confirmed'
    if (outcome === 'forfeit') return 'Forfeit'
    if (outcome === 'disputed') return 'Disputed'
    return 'Goal confirmed'
  }

  function createPenaltyClashRound ({
    gameId,
    roundIndex,
    shooter,
    keeper,
    shooterInput,
    keeperInput,
    shooterNonce = 'shooter-nonce',
    keeperNonce = 'keeper-nonce',
    sourceEventIds = null
  }) {
    const roundId = `pc-${roundIndex + 1}`
    const shooterCommitment = createCommitment({
      gameId,
      roundId,
      playerId: shooter.id,
      input: shooterInput,
      nonce: shooterNonce
    })
    const keeperCommitment = createCommitment({
      gameId,
      roundId,
      playerId: keeper.id,
      input: keeperInput,
      nonce: keeperNonce
    })
    const roundSeed = deterministicHash({ gameId, roundId, shooterCommitment, keeperCommitment })
    const timingGap = Math.abs(shooterInput.releaseTick - keeperInput.releaseTick)
    const keeperMatched = shooterInput.aimZone === keeperInput.diveZone && timingGap <= 2
    const overcooked = shooterInput.powerBand === 4 && Math.abs(shooterInput.curveBand) === 2 && shooterInput.aimZone.includes('high')
    const outcome = keeperMatched ? 'save' : overcooked ? 'post' : 'goal'
    const stateHash = deterministicHash({
      resolverVersion,
      gameId,
      roundId,
      roundSeed,
      shooterInput,
      keeperInput,
      outcome
    })
    const fallbackSourceEventIds = [
      deterministicHash({ type: 'GameCommitmentSubmitted', roundId, playerId: shooter.id, commitment: shooterCommitment }),
      deterministicHash({ type: 'GameCommitmentSubmitted', roundId, playerId: keeper.id, commitment: keeperCommitment }),
      deterministicHash({ type: 'GameInputRevealed', roundId, playerId: shooter.id, input: shooterInput }),
      deterministicHash({ type: 'GameInputRevealed', roundId, playerId: keeper.id, input: keeperInput })
    ]
    const evidenceSourceEventIds = Array.isArray(sourceEventIds) && sourceEventIds.length
      ? [...sourceEventIds]
      : fallbackSourceEventIds

    return {
      gameId,
      roundId,
      resolverVersion,
      shooter,
      keeper,
      shooterInput,
      keeperInput,
      shooterCommitment,
      keeperCommitment,
      shooterNonce,
      keeperNonce,
      roundSeed,
      timingGap,
      outcome,
      outcomeLabel: outcomeLabel(outcome),
      stateHash,
      sourceEventIds: evidenceSourceEventIds
    }
  }

  function createPenaltyClashForfeitRound ({
    gameId,
    roundIndex,
    roundId: explicitRoundId,
    shooter,
    keeper,
    forfeitingPlayerId,
    winnerUserId,
    claimantUserId,
    reason = 'timeout',
    sourceEventIds = null
  }) {
    const roundId = explicitRoundId || `pc-${roundIndex + 1}`
    const participantUserIds = [
      shooter && shooter.id,
      keeper && keeper.id
    ].filter(Boolean)
    const forfeiter = forfeitingPlayerId || null
    const fallbackWinner = participantUserIds.find(userId => userId !== forfeiter) || null
    const winner = winnerUserId || fallbackWinner
    const claimant = claimantUserId || winner
    const outcome = 'forfeit'
    const normalizedReason = String(reason || 'timeout')
    const fallbackSourceEventIds = [
      deterministicHash({
        type: 'GameRoundForfeitRecorded',
        gameId,
        roundId,
        forfeitingPlayerId: forfeiter,
        winnerUserId: winner,
        claimantUserId: claimant,
        reason: normalizedReason
      })
    ]
    const evidenceSourceEventIds = Array.isArray(sourceEventIds) && sourceEventIds.length
      ? [...sourceEventIds]
      : fallbackSourceEventIds
    const stateHash = deterministicHash({
      resolverVersion,
      gameId,
      roundId,
      outcome,
      forfeitingPlayerId: forfeiter,
      winnerUserId: winner,
      claimantUserId: claimant,
      reason: normalizedReason,
      sourceEventIds: evidenceSourceEventIds
    })

    return {
      gameId,
      roundId,
      resolverVersion,
      shooter,
      keeper,
      outcome,
      outcomeLabel: outcomeLabel(outcome),
      winnerUserId: winner,
      forfeitingPlayerId: forfeiter,
      claimantUserId: claimant,
      forfeitReason: normalizedReason,
      stateHash,
      sourceEventIds: evidenceSourceEventIds
    }
  }

  function reviewBlocksAttestation (review) {
    return Boolean(review && review.ruling !== 'verified')
  }

  function createQvacRefereeAttestation ({ roundResult, refereeId = 'qvac-demo-ref', review = null }) {
    const participantUserIds = participantUserIdsForRoundResult(roundResult)
    const hasResolvedRoundEvidence = Boolean(
      roundResult &&
      roundResult.shooterCommitment &&
      roundResult.keeperCommitment &&
      roundResult.stateHash &&
      Array.isArray(roundResult.sourceEventIds) &&
      roundResult.sourceEventIds.length >= 4
    )
    const hasForfeitEvidence = Boolean(
      roundResult &&
      roundResult.outcome === 'forfeit' &&
      roundResult.stateHash &&
      roundResult.winnerUserId &&
      roundResult.forfeitingPlayerId &&
      participantUserIds.length >= 2 &&
      Array.isArray(roundResult.sourceEventIds) &&
      roundResult.sourceEventIds.length >= 1
    )
    const hasRequiredEvidence = hasResolvedRoundEvidence || hasForfeitEvidence
    const ruling = hasRequiredEvidence && !reviewBlocksAttestation(review) ? roundResult.outcome : 'disputed'
    const stateHash = hasRequiredEvidence ? roundResult.stateHash : deterministicHash({ reason: 'missing-evidence', roundResult })
    const winnerUserId = hasRequiredEvidence ? winnerUserIdForRoundResult(roundResult) : null
    const signedParticipantUserIds = hasRequiredEvidence ? participantUserIds : []
    const attestationId = deterministicHash({
      refereeId,
      gameId: roundResult && roundResult.gameId,
      roundId: roundResult && roundResult.roundId,
      ruling,
      stateHash,
      winnerUserId,
      participantUserIds: sortedList(signedParticipantUserIds),
      reviewHash: review ? deterministicHash(review) : null
    })
    const rationale = review && review.rationale
      ? review.rationale
      : hasRequiredEvidence
      ? `QVAC verified commitments, reveals, and ${roundResult.resolverVersion} output before settlement.`
      : 'QVAC could not verify the full round evidence and marked the result disputed.'
    const signature = deterministicHash({
      attestationId,
      refereeId,
      ruling,
      stateHash,
      winnerUserId,
      participantUserIds: sortedList(signedParticipantUserIds),
      sourceEventIds: hasRequiredEvidence ? roundResult.sourceEventIds : [],
      reviewHash: review ? deterministicHash(review) : null
    })

    return {
      attestationId,
      refereeId,
      gameId: roundResult && roundResult.gameId,
      roundId: roundResult && roundResult.roundId,
      resolverVersion: roundResult && roundResult.resolverVersion,
      ruling,
      winnerUserId,
      participantUserIds: signedParticipantUserIds,
      stateHash,
      sourceEventIds: hasRequiredEvidence ? roundResult.sourceEventIds : [],
      rationale,
      confidence: typeof (review && review.confidence) === 'number' ? review.confidence : hasRequiredEvidence ? 0.98 : 0.34,
      createdAt: '2026-07-01T00:00:00.000Z',
      review,
      signature
    }
  }

  function verifyQvacRoundAttestation ({ roundResult, attestation }) {
    const errors = []
    if (!roundResult) errors.push('Round result is required before WDK release')
    if (!attestation) {
      errors.push('QVAC attestation signature is required')
      return { ok: false, errors }
    }
    if (!attestation.attestationId) errors.push('QVAC attestation id is required')
    if (!attestation.refereeId) errors.push('QVAC attestation refereeId is required')
    if (!attestation.signature) errors.push('QVAC attestation signature is required')
    if (attestation.ruling === 'disputed') errors.push('Disputed QVAC attestation cannot release settlement')
    if (!roundResult) return { ok: errors.length === 0, errors }

    if (attestation.gameId !== roundResult.gameId) errors.push('QVAC attestation gameId does not match round result')
    if (attestation.roundId !== roundResult.roundId) errors.push('QVAC attestation roundId does not match round result')
    if (attestation.resolverVersion && attestation.resolverVersion !== roundResult.resolverVersion) {
      errors.push('QVAC attestation resolverVersion does not match round result')
    }
    if (attestation.stateHash !== roundResult.stateHash) errors.push('QVAC attestation stateHash does not match round result')
    if (attestation.ruling !== roundResult.outcome) errors.push('QVAC attestation ruling does not match round outcome')
    const expectedWinnerUserId = winnerUserIdForRoundResult(roundResult)
    if (!attestation.winnerUserId) {
      errors.push('QVAC attestation winnerUserId is required')
    } else if (attestation.winnerUserId !== expectedWinnerUserId) {
      errors.push('QVAC attestation winnerUserId does not match round outcome')
    }
    const expectedParticipants = participantUserIdsForRoundResult(roundResult)
    if (!Array.isArray(attestation.participantUserIds) || attestation.participantUserIds.length === 0) {
      errors.push('QVAC attestation participantUserIds are required')
    } else if (!sameList(attestation.participantUserIds, expectedParticipants)) {
      errors.push('QVAC attestation participantUserIds do not match round players')
    }
    if (!Array.isArray(attestation.sourceEventIds) || attestation.sourceEventIds.length === 0) {
      errors.push('QVAC attestation sourceEventIds are required')
    } else if (!sameList(attestation.sourceEventIds, roundResult.sourceEventIds)) {
      errors.push('QVAC attestation sourceEventIds do not match round result')
    }

    if (attestation.refereeId) {
      const expected = createQvacRefereeAttestation({
        roundResult,
        refereeId: attestation.refereeId,
        review: attestation.review || null
      })
      if (attestation.attestationId !== expected.attestationId) errors.push('QVAC attestation id does not match signed round payload')
      if (attestation.signature !== expected.signature) errors.push('QVAC attestation signature does not match signed round payload')
    }

    return { ok: errors.length === 0, errors }
  }

  function createBracketPoolSettlementResult ({
    poolId,
    confirmedEntries,
    winnerUserIds,
    bracketSubmissions = [],
    officialResults = {},
    rulesVersion = 'bracket-pool-v1',
    sourceEventIds = null,
    sourceEventMode = null
  }) {
    const entries = Array.isArray(confirmedEntries) ? confirmedEntries : []
    const participantIds = new Set(entries.map(entry => entry.userId))
    const submissions = Array.isArray(bracketSubmissions) ? bracketSubmissions : []
    const eligibleSubmissions = submissions.filter(submission => submission && participantIds.has(submission.userId))
    const bracketResolution = eligibleSubmissions.length
      ? deriveBracketPoolWinners({
          bracketSubmissions: eligibleSubmissions,
          officialResults,
          eligibleUserIds: Array.from(participantIds)
        })
      : null
    const winners = bracketResolution
      ? bracketResolution.winnerUserIds
      : Array.isArray(winnerUserIds) ? [...new Set(winnerUserIds)] : []
    const valid = entries.length > 0 &&
      winners.length > 0 &&
      entries.every(entry => entry.status === 'confirmed') &&
      winners.every(userId => participantIds.has(userId))
    const sourcePaymentIds = entries.map(entry => entry.paymentId).sort()
    const sourceBracketSubmissionIds = eligibleSubmissions
      .map(submission => submission.submissionId)
      .filter(Boolean)
      .sort()
    const bracketScoreboard = bracketResolution ? bracketResolution.scoreboard : []
    const bracketScoreboardHash = bracketResolution ? deterministicHash(bracketScoreboard) : null
    const officialResultsHash = deterministicHash(officialResults || {})
    const resultHash = deterministicHash({
      poolId,
      sourcePaymentIds,
      sourceBracketSubmissionIds,
      winnerUserIds: [...winners].sort(),
      bracketScoreboardHash,
      bracketResolvedBy: bracketResolution && bracketResolution.resolvedBy || null,
      officialResults,
      officialResultsHash,
      rulesVersion,
      valid
    })
    const stateHash = deterministicHash({
      type: 'BracketPoolSettlementResult',
      poolId,
      resultHash,
      entryCount: entries.length,
      winnerCount: winners.length,
      rulesVersion
    })
    const fallbackSourceEventIds = [
      ...sourcePaymentIds.map(paymentId => deterministicHash({ type: 'TetherWdkEntryConfirmed', poolId, paymentId })),
      ...sourceBracketSubmissionIds.map(submissionId => deterministicHash({ type: 'BracketSubmissionLocked', poolId, submissionId })),
      deterministicHash({ type: 'OfficialResultsSnapshot', poolId, officialResults }),
      deterministicHash({ type: 'BracketPoolSettlementResolved', poolId, stateHash })
    ]
    const evidenceSourceEventIds = Array.isArray(sourceEventIds) && sourceEventIds.length
      ? [...sourceEventIds]
      : fallbackSourceEventIds
    const evidenceSourceEventMode = sourceEventMode || (Array.isArray(sourceEventIds) && sourceEventIds.length ? 'worker-log' : 'deterministic')

    return {
      poolId,
      rulesVersion,
      sourceEventMode: evidenceSourceEventMode,
      entryCount: entries.length,
      winnerUserIds: winners,
      sourcePaymentIds,
      sourceBracketSubmissionIds,
      bracketScoreboard,
      bracketScoreboardHash,
      bracketResolvedBy: bracketResolution && bracketResolution.resolvedBy || (submissions.length ? 'no-qualified-bracket' : 'manual-winners'),
      officialResults,
      officialResultsHash,
      resultHash,
      stateHash,
      sourceEventIds: evidenceSourceEventIds,
      ruling: valid ? 'verified' : 'disputed',
      rationale: valid
        ? bracketResolution
          ? `Pool settlement derived ${winners.length} winner(s) from locked bracket submissions and official results.`
          : 'Pool settlement matched confirmed entries, eligible winners, and the signed rules version.'
        : 'Pool settlement could not verify confirmed entries or eligible winners.'
    }
  }

  function createQvacPoolSettlementAttestation ({ poolResult, refereeId = 'qvac-demo-ref', review = null }) {
    const sourcePaymentIds = poolResult && Array.isArray(poolResult.sourcePaymentIds) ? poolResult.sourcePaymentIds : []
    const sourceBracketSubmissionIds = poolResult && Array.isArray(poolResult.sourceBracketSubmissionIds) ? poolResult.sourceBracketSubmissionIds : []
    const sourceEventIds = poolResult && Array.isArray(poolResult.sourceEventIds) ? poolResult.sourceEventIds : []
    const requiredSourceEventCount = sourcePaymentIds.length + sourceBracketSubmissionIds.length + 1
    const officialResultsHash = poolResult && (poolResult.officialResultsHash || deterministicHash(poolResult.officialResults || {}))
    const hasRequiredEvidence = Boolean(
      poolResult &&
      poolResult.poolId &&
      poolResult.stateHash &&
      sourcePaymentIds.length > 0 &&
      Array.isArray(poolResult.winnerUserIds) &&
      poolResult.winnerUserIds.length > 0 &&
      sourceEventIds.length >= requiredSourceEventCount &&
      officialResultsHash &&
      poolResult.ruling === 'verified'
    )
    const ruling = hasRequiredEvidence && !reviewBlocksAttestation(review) ? 'verified' : 'disputed'
    const stateHash = hasRequiredEvidence ? poolResult.stateHash : deterministicHash({ reason: 'missing-pool-evidence', poolResult })
    const attestationId = deterministicHash({
      refereeId,
      poolId: poolResult && poolResult.poolId,
      ruling,
      stateHash,
      officialResultsHash: hasRequiredEvidence ? officialResultsHash : null,
      reviewHash: review ? deterministicHash(review) : null
    })
    const signature = deterministicHash({
      attestationId,
      refereeId,
      ruling,
      stateHash,
      officialResultsHash: hasRequiredEvidence ? officialResultsHash : null,
      sourceEventIds: hasRequiredEvidence ? sourceEventIds : [],
      reviewHash: review ? deterministicHash(review) : null
    })

    return {
      attestationId,
      refereeId,
      poolId: poolResult && poolResult.poolId,
      rulesVersion: poolResult && poolResult.rulesVersion,
      ruling,
      stateHash,
      officialResultsHash: hasRequiredEvidence ? officialResultsHash : null,
      sourcePaymentIds: hasRequiredEvidence ? sourcePaymentIds : [],
      sourceBracketSubmissionIds: hasRequiredEvidence ? sourceBracketSubmissionIds : [],
      bracketScoreboardHash: hasRequiredEvidence ? poolResult.bracketScoreboardHash || null : null,
      bracketResolvedBy: hasRequiredEvidence ? poolResult.bracketResolvedBy || null : null,
      winnerUserIds: hasRequiredEvidence ? poolResult.winnerUserIds : [],
      sourceEventIds: hasRequiredEvidence ? sourceEventIds : [],
      rationale: review && review.rationale
        ? review.rationale
        : hasRequiredEvidence
        ? `QVAC verified ${poolResult.rulesVersion} pool settlement evidence before WDK payout.`
        : 'QVAC could not verify the pool settlement evidence and marked it disputed.',
      confidence: typeof (review && review.confidence) === 'number' ? review.confidence : hasRequiredEvidence ? 0.97 : 0.31,
      createdAt: '2026-07-01T00:00:00.000Z',
      review,
      signature
    }
  }

  function verifyQvacPoolSettlementAttestation ({ poolResult, attestation }) {
    const errors = []
    if (!poolResult) errors.push('Pool settlement result is required before WDK payout')
    if (!attestation) {
      errors.push('QVAC pool attestation signature is required')
      return { ok: false, errors }
    }
    if (!attestation.attestationId) errors.push('QVAC pool attestation id is required')
    if (!attestation.refereeId) errors.push('QVAC pool attestation refereeId is required')
    if (!attestation.signature) errors.push('QVAC pool attestation signature is required')
    if (attestation.ruling === 'disputed') errors.push('Disputed QVAC pool attestation cannot release payout')
    if (!poolResult) return { ok: errors.length === 0, errors }

    if (poolResult.ruling !== 'verified') errors.push('Pool settlement result must be verified before WDK payout')
    const poolOfficialResultsHash = poolResult.officialResultsHash || deterministicHash(poolResult.officialResults || {})
    const poolSourcePaymentIds = Array.isArray(poolResult.sourcePaymentIds) ? poolResult.sourcePaymentIds : []
    const poolSourceBracketSubmissionIds = Array.isArray(poolResult.sourceBracketSubmissionIds) ? poolResult.sourceBracketSubmissionIds : []
    const poolSourceEventIds = Array.isArray(poolResult.sourceEventIds) ? poolResult.sourceEventIds : []
    if (poolSourceEventIds.length < poolSourcePaymentIds.length + poolSourceBracketSubmissionIds.length + 1) {
      errors.push('Pool settlement sourceEventIds must include official results evidence')
    }
    if (attestation.poolId !== poolResult.poolId) errors.push('QVAC pool attestation poolId does not match settlement result')
    if (attestation.rulesVersion && attestation.rulesVersion !== poolResult.rulesVersion) {
      errors.push('QVAC pool attestation rulesVersion does not match settlement result')
    }
    if (attestation.stateHash !== poolResult.stateHash) errors.push('QVAC pool attestation stateHash does not match settlement result')
    if (attestation.ruling !== poolResult.ruling) errors.push('QVAC pool attestation ruling does not match settlement result')
    if (!attestation.officialResultsHash) {
      errors.push('QVAC pool attestation officialResultsHash is required')
    } else if (attestation.officialResultsHash !== poolOfficialResultsHash) {
      errors.push('QVAC pool attestation officialResultsHash does not match settlement result')
    }
    if (!Array.isArray(attestation.sourcePaymentIds) || attestation.sourcePaymentIds.length === 0) {
      errors.push('QVAC pool attestation sourcePaymentIds are required')
    } else if (!sameList(attestation.sourcePaymentIds, poolResult.sourcePaymentIds)) {
      errors.push('QVAC pool attestation sourcePaymentIds do not match settlement result')
    }
    if (poolSourceBracketSubmissionIds.length > 0) {
      if (!Array.isArray(attestation.sourceBracketSubmissionIds) || attestation.sourceBracketSubmissionIds.length === 0) {
        errors.push('QVAC pool attestation sourceBracketSubmissionIds are required')
      } else if (!sameList(attestation.sourceBracketSubmissionIds, poolSourceBracketSubmissionIds)) {
        errors.push('QVAC pool attestation sourceBracketSubmissionIds do not match settlement result')
      }
      if (attestation.bracketScoreboardHash !== poolResult.bracketScoreboardHash) {
        errors.push('QVAC pool attestation bracketScoreboardHash does not match settlement result')
      }
    }
    if (!Array.isArray(attestation.winnerUserIds) || attestation.winnerUserIds.length === 0) {
      errors.push('QVAC pool attestation winnerUserIds are required')
    } else if (!sameList(attestation.winnerUserIds, poolResult.winnerUserIds)) {
      errors.push('QVAC pool attestation winnerUserIds do not match settlement result')
    }
    if (!Array.isArray(attestation.sourceEventIds) || attestation.sourceEventIds.length === 0) {
      errors.push('QVAC pool attestation sourceEventIds are required')
    } else if (!sameList(attestation.sourceEventIds, poolResult.sourceEventIds)) {
      errors.push('QVAC pool attestation sourceEventIds do not match settlement result')
    }

    if (attestation.refereeId) {
      const expected = createQvacPoolSettlementAttestation({
        poolResult,
        refereeId: attestation.refereeId,
        review: attestation.review || null
      })
      if (attestation.attestationId !== expected.attestationId) errors.push('QVAC pool attestation id does not match signed settlement payload')
      if (attestation.signature !== expected.signature) errors.push('QVAC pool attestation signature does not match signed settlement payload')
    }

    return { ok: errors.length === 0, errors }
  }

  function createTetherWdkEscrowIntent ({
    gameId,
    players,
    amount,
    asset = 'USDT',
    rail = 'tether-wdk-demo',
    rulesVersion = 'penalty-clash-v1',
    sessionId = null,
    sessionEventId = null,
    sessionHash = null,
    sourceEventIds,
    stakeHash = null,
    prizeMode = false
  }) {
    const sessionSourceEventIds = Array.isArray(sourceEventIds) ? [...sourceEventIds] : []
    const base = { gameId, players, amount, asset, rail, rulesVersion }
    const hasSessionBinding = Boolean(
      sessionId ||
      sessionEventId ||
      sessionHash ||
      sessionSourceEventIds.length ||
      stakeHash ||
      prizeMode === true
    )
    const sessionBinding = hasSessionBinding
      ? {
          sessionId,
          sessionEventId,
          sessionHash,
          sourceEventIds: sessionSourceEventIds,
          stakeHash,
          prizeMode: prizeMode === true
        }
      : null
    const escrowId = deterministicHash(sessionBinding ? { ...base, ...sessionBinding } : base)
    return {
      escrowId,
      ...base,
      ...(sessionBinding || {}),
      status: 'locked',
      createdAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function releaseTetherWdkEscrow ({ escrow, attestation, winnerUserId }) {
    if (!escrow || escrow.status !== 'locked') throw new Error('Escrow must be locked before release')
    if (!attestation || !attestation.signature) throw new Error('QVAC attestation signature is required')
    if (attestation.ruling === 'disputed') throw new Error('Disputed QVAC attestation cannot release escrow')
    if (attestation.gameId && escrow.gameId !== attestation.gameId) throw new Error('Escrow gameId must match QVAC attestation')
    if (Array.isArray(attestation.participantUserIds) && attestation.participantUserIds.length > 0 && !sameList(escrow.players, attestation.participantUserIds)) {
      throw new Error('Escrow players must match QVAC attestation participants')
    }
    if (attestation.winnerUserId && attestation.winnerUserId !== winnerUserId) throw new Error('Winner must match QVAC attestation winner')
    if (!escrow.players.includes(winnerUserId)) throw new Error('Winner must be one of the escrow players')

    return {
      payoutId: deterministicHash({
        escrowId: escrow.escrowId,
        attestationId: attestation.attestationId,
        winnerUserId
      }),
      escrowId: escrow.escrowId,
      winnerUserId,
      amount: escrow.amount,
      asset: escrow.asset,
      rail: escrow.rail,
      status: 'prepared',
      qvacAttestationId: attestation.attestationId
    }
  }

  function refundTetherWdkEscrow ({
    escrow,
    reason = 'game-escrow-refunded',
    processorStatus = 'refunded',
    refundUserIds = null
  }) {
    if (!escrow || escrow.status !== 'locked') throw new Error('Locked escrow is required before refund')
    const recipients = Array.isArray(refundUserIds) && refundUserIds.length
      ? [...new Set(refundUserIds)]
      : Array.isArray(escrow.players) ? [...escrow.players] : []
    if (recipients.length === 0) throw new Error('At least one escrow refund recipient is required')
    if (recipients.some(userId => !escrow.players.includes(userId))) throw new Error('Escrow refund recipients must be escrow players')
    const amountEach = Number((Number(escrow.amount || 0) / recipients.length).toFixed(2))
    return {
      refundId: deterministicHash({
        escrowId: escrow.escrowId,
        gameId: escrow.gameId,
        refundUserIds: [...recipients].sort(),
        amount: escrow.amount,
        amountEach,
        asset: escrow.asset,
        rail: escrow.rail,
        reason,
        processorStatus,
        rulesVersion: escrow.rulesVersion
      }),
      escrowId: escrow.escrowId,
      gameId: escrow.gameId,
      refundUserIds: recipients,
      amount: escrow.amount,
      amountEach,
      asset: escrow.asset,
      rail: escrow.rail,
      rulesVersion: escrow.rulesVersion,
      status: 'refunded',
      processorStatus,
      reason,
      refundedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function createTetherWdkEntryIntent ({
    poolId,
    entryId,
    userId,
    username,
    amount,
    asset = 'USDT',
    rail = 'tether-wdk-demo',
    rulesVersion = 'bracket-pool-v1'
  }) {
    const intentId = deterministicHash({ poolId, entryId, userId, amount, asset, rail, rulesVersion })
    return {
      intentId,
      poolId,
      entryId,
      userId,
      username,
      amount,
      asset,
      rail,
      rulesVersion,
      status: 'requires-confirmation',
      createdAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function confirmTetherWdkEntryIntent ({ intent, confirmationId }) {
    if (!intent || intent.status !== 'requires-confirmation') throw new Error('Entry intent must require confirmation')
    return {
      paymentId: deterministicHash({
        intentId: intent.intentId,
        confirmationId: confirmationId || 'demo-confirmation',
        userId: intent.userId
      }),
      intentId: intent.intentId,
      poolId: intent.poolId,
      entryId: intent.entryId,
      userId: intent.userId,
      username: intent.username,
      amount: intent.amount,
      asset: intent.asset,
      rail: intent.rail,
      status: 'confirmed',
      confirmedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function createTetherWdkEntryPaymentPending ({
    intent,
    confirmationId,
    processorStatus = 'awaiting_payment',
    reason = 'WDK payment has not been confirmed yet'
  }) {
    if (!intent || !intent.intentId) throw new Error('Entry intent is required before payment reconciliation')
    return {
      checkId: deterministicHash({
        intentId: intent.intentId,
        confirmationId: confirmationId || null,
        processorStatus,
        reason
      }),
      intentId: intent.intentId,
      poolId: intent.poolId,
      entryId: intent.entryId,
      userId: intent.userId,
      username: intent.username,
      amount: intent.amount,
      asset: intent.asset,
      rail: intent.rail,
      status: 'pending',
      processorStatus,
      reason,
      checkedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function createTetherWdkEntryRefund ({
    payment,
    reason = 'entry-refunded',
    processorStatus = 'refunded'
  }) {
    if (!payment || payment.status !== 'confirmed') throw new Error('Confirmed entry payment is required before refund')
    return {
      refundId: deterministicHash({
        paymentId: payment.paymentId,
        intentId: payment.intentId,
        poolId: payment.poolId,
        entryId: payment.entryId,
        userId: payment.userId,
        amount: payment.amount,
        asset: payment.asset,
        rail: payment.rail,
        reason,
        processorStatus
      }),
      paymentId: payment.paymentId,
      intentId: payment.intentId,
      poolId: payment.poolId,
      entryId: payment.entryId,
      userId: payment.userId,
      username: payment.username,
      amount: payment.amount,
      asset: payment.asset,
      rail: payment.rail,
      status: 'refunded',
      processorStatus,
      reason,
      refundedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function createTetherWdkPoolPayout ({
    poolId,
    confirmedEntries,
    winnerUserIds,
    attestation,
    asset = 'USDT',
    rail = 'tether-wdk-demo',
    rulesVersion = 'bracket-pool-v1'
  }) {
    const entries = Array.isArray(confirmedEntries) ? confirmedEntries : []
    const winners = Array.isArray(winnerUserIds) ? [...new Set(winnerUserIds)] : []
    if (entries.length === 0) throw new Error('At least one confirmed entry is required')
    if (winners.length === 0) throw new Error('At least one winner is required')
    if (entries.some(entry => entry.status !== 'confirmed')) throw new Error('All entries must be confirmed before payout')
    const participantIds = new Set(entries.map(entry => entry.userId))
    if (winners.some(userId => !participantIds.has(userId))) throw new Error('Winner must have a confirmed entry')
    if (!attestation || !attestation.signature) throw new Error('QVAC pool attestation signature is required')
    if (attestation.ruling === 'disputed') throw new Error('Disputed QVAC pool attestation cannot release payout')
    if (attestation.poolId !== poolId) throw new Error('QVAC pool attestation must match the pool')
    if (attestation.rulesVersion && attestation.rulesVersion !== rulesVersion) throw new Error('QVAC pool attestation rulesVersion must match payout rules')
    const sourcePaymentIds = entries.map(entry => entry.paymentId)
    if (!Array.isArray(attestation.winnerUserIds) || attestation.winnerUserIds.length === 0) {
      throw new Error('QVAC pool attestation winnerUserIds are required')
    }
    if (!sameList(attestation.winnerUserIds, winners)) throw new Error('Payout winners must match QVAC pool attestation winners')
    if (!Array.isArray(attestation.sourcePaymentIds) || attestation.sourcePaymentIds.length === 0) {
      throw new Error('QVAC pool attestation sourcePaymentIds are required')
    }
    if (!sameList(attestation.sourcePaymentIds, sourcePaymentIds)) throw new Error('Payout payments must match QVAC pool attestation payments')

    const grossPool = entries.reduce((total, entry) => total + Number(entry.amount || 0), 0)
    const amountEach = Number((grossPool / winners.length).toFixed(2))
    return {
      payoutId: deterministicHash({
        poolId,
        sourcePaymentIds: [...sourcePaymentIds].sort(),
        winnerUserIds: winners.sort(),
        grossPool,
        attestationId: attestation.attestationId,
        asset,
        rail,
        rulesVersion
      }),
      poolId,
      winnerUserIds: winners,
      sourcePaymentIds,
      grossPool,
      amountEach,
      asset,
      rail,
      rulesVersion,
      status: 'prepared',
      qvacAttestationId: attestation.attestationId,
      preparedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  const api = {
    resolverVersion,
    canonicalJson,
    deterministicHash,
    createCommitment,
    verifyCommitment,
    bracketMatchWeight,
    officialBracketWinners,
    createBracketSubmission,
    scoreBracketSubmission,
    deriveBracketPoolWinners,
    winnerUserIdForRoundResult,
    participantUserIdsForRoundResult,
    createPenaltyClashRound,
    createPenaltyClashForfeitRound,
    createQvacRefereeAttestation,
    verifyQvacRoundAttestation,
    createBracketPoolSettlementResult,
    createQvacPoolSettlementAttestation,
    verifyQvacPoolSettlementAttestation,
    createTetherWdkEscrowIntent,
    releaseTetherWdkEscrow,
    refundTetherWdkEscrow,
    createTetherWdkEntryIntent,
    confirmTetherWdkEntryIntent,
    createTetherWdkEntryPaymentPending,
    createTetherWdkEntryRefund,
    createTetherWdkPoolPayout
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupCore = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupCore = resolverVersion
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
