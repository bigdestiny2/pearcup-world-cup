// Generated PearCup renderer boot bundle.
// Regenerate with: npm run build:kawaii-boot
// Sources: ./core.js, ./adapters.js, ./qvac-referee.js, ./tether-wdk-bridge.js, ./runtime-settings.js, ./runtime-config.js, ./settlement-receipts.js, ./worker-sim.js, ./storage-sim.js, ./transport-sim.js, ./worker-runtime.js, ./settlement-service.js, ./worker-client.js, ./peer-net.js, ./peer-match.js, ./peer-lobby.js, ./watch-sync.js, ./app.js

;/* source: ./core.js */
(function attachPearCupCore (root) {
  const resolverVersion = 'penalty-clash-v1'

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
    let score = 0
    let correctCount = 0
    for (const matchId of matchIds) {
      const picked = picks[matchId]
      const actual = winners[matchId]
      if (picked != null && String(picked) === String(actual)) {
        correctCount++
        score += bracketMatchWeight(matchId)
      }
    }
    return {
      submissionId: submission && submission.submissionId || null,
      userId: submission && submission.userId || null,
      entryId: submission && submission.entryId || null,
      paymentId: submission && submission.paymentId || null,
      picksHash: submission && submission.picksHash || deterministicHash(picks),
      score,
      correctCount,
      totalMatches: matchIds.length,
      perfect: matchIds.length > 0 && correctCount === matchIds.length
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
    const scoreboard = submissions.map(submission => scoreBracketSubmission({ submission, officialResults }))
    const totalMatches = scoreboard.reduce((max, row) => Math.max(max, row.totalMatches), 0)
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



;/* source: ./adapters.js */
(function attachPearCupAdapters (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const core = root.PearCupCore || (canRequireLocal ? require('./core.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupAdapters')

  function createDemoQvacAdapter ({ refereeId = 'qvac-demo-ref' } = {}) {
    return {
      id: refereeId,
      mode: 'demo',
      attestRound ({ roundResult }) {
        return core.createQvacRefereeAttestation({ roundResult, refereeId })
      },
      attestPoolSettlement ({ poolResult }) {
        return core.createQvacPoolSettlementAttestation({ poolResult, refereeId })
      }
    }
  }

  function normalizeLanguage (language) {
    const normalized = String(language || 'EN')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16)
    return normalized || 'EN'
  }

  function demoCommentaryText (input = {}) {
    const events = Array.isArray(input.recentEvents) ? input.recentEvents : []
    const latest = events[events.length - 1] || {}
    const language = normalizeLanguage(input.language)
    const team = latest.teamId ? String(latest.teamId).toUpperCase() : 'the room'
    const clock = input.clock || latest.clock || input.currentStats && input.currentStats.clock || '00:00'
    const pickDistribution = input.roomPickDistribution || {}
    const pickShare = latest.teamId && pickDistribution[latest.teamId] != null
      ? ` ${pickDistribution[latest.teamId]} room picks are riding with ${team}.`
      : ''
    if (latest.type === 'goal') return `[${language}] ${team} score at ${clock}; pool paths are moving fast.${pickShare}`
    if (latest.type === 'save') return `[${language}] ${team} make a save at ${clock}; the room stays tense.${pickShare}`
    if (latest.type === 'shot') return `[${language}] ${team} generate another shot at ${clock}; pressure is climbing.${pickShare}`
    return `[${language}] Live match momentum at ${clock} is grounded in the synced event feed.${pickShare}`
  }

  function createDemoQvacCommentaryAdapter ({ commentatorId = 'qvac-demo-commentary' } = {}) {
    function createSegment (input = {}, text = demoCommentaryText(input), confidence = 0.7) {
      const events = Array.isArray(input.recentEvents) ? input.recentEvents : []
      const latest = events[events.length - 1] || {}
      const sourceEventIds = events.map(event => event && (event.sourceEventId || event.workerEventId || event.eventId)).filter(Boolean)
      const language = normalizeLanguage(input.language)
      const clock = input.clock || latest.clock || input.currentStats && input.currentStats.clock || '00:00'
      const payload = {
        matchId: input.matchId || latest.matchId || 'unknown-match',
        language,
        clock,
        text,
        sourceEventIds,
        eventHash: core.deterministicHash(sourceEventIds),
        statHash: core.deterministicHash(input.currentStats || null),
        confidence,
        modelId: 'demo-template-commentary',
        commentatorId,
        createdAt: '2026-07-01T00:00:00.000Z'
      }
      return {
        segmentId: core.deterministicHash(payload),
        ...payload
      }
    }

    return {
      id: commentatorId,
      mode: 'demo',
      generateSegment (input) {
        return createSegment(input)
      },
      translateSegment (segment, language) {
        return createSegment({
          matchId: segment.matchId,
          language,
          clock: segment.clock,
          recentEvents: (segment.sourceEventIds || []).map(eventId => ({
            eventId,
            matchId: segment.matchId,
            clock: segment.clock
          }))
        }, `[${normalizeLanguage(language)}] ${segment.text}`)
      },
      summarizeWindow (input = {}) {
        const sourceSegmentIds = Array.isArray(input.segments)
          ? input.segments.map(segment => segment && segment.segmentId).filter(Boolean)
          : []
        const payload = {
          summaryId: core.deterministicHash({
            matchId: input.matchId || 'unknown-match',
            language: normalizeLanguage(input.language),
            sourceSegmentIds
          }),
          matchId: input.matchId || 'unknown-match',
          language: normalizeLanguage(input.language),
          text: `[${normalizeLanguage(input.language)}] ${sourceSegmentIds.length} commentary segments summarized from the synced watch room.`,
          sourceSegmentIds,
          confidence: 0.68,
          modelId: 'demo-template-commentary',
          createdAt: '2026-07-01T00:00:00.000Z'
        }
        return payload
      }
    }
  }

  function createDemoTetherWdkAdapter ({ rail = 'tether-wdk-demo' } = {}) {
    return {
      id: rail,
      mode: 'demo',
      createGameEscrow (input) {
        return core.createTetherWdkEscrowIntent({ ...input, rail })
      },
      releaseGameEscrow ({ escrow, attestation, winnerUserId }) {
        return core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
      },
      refundGameEscrow ({ escrow, reason, refundUserIds }) {
        return core.refundTetherWdkEscrow({ escrow, reason, refundUserIds })
      },
      createEntryIntent (input) {
        return core.createTetherWdkEntryIntent({ ...input, rail })
      },
      confirmEntryIntent (input) {
        return core.confirmTetherWdkEntryIntent(input)
      },
      refundEntryIntent ({ payment, reason }) {
        return core.createTetherWdkEntryRefund({ payment, reason })
      },
      createPoolPayout (input) {
        return core.createTetherWdkPoolPayout({ ...input, rail })
      },
      disputeGameEscrow ({ gameId, roundId, escrowId, reason }) {
        return {
          disputeId: core.deterministicHash({ gameId, roundId, escrowId, reason, rail }),
          gameId,
          roundId,
          escrowId,
          reason,
          status: 'held',
          rail
        }
      }
    }
  }

  function createSdkQvacCommentaryAdapter (sdk, { id = 'qvac-commentary-sdk' } = {}) {
    if (!sdk || typeof sdk.generateSegment !== 'function') {
      throw new Error('QVAC commentary SDK adapter missing required methods: generateSegment')
    }
    return {
      id,
      mode: 'sdk',
      async: sdk.async === true,
      generateSegment (input) {
        return sdk.generateSegment(input)
      },
      translateSegment (segment, language) {
        if (typeof sdk.translateSegment === 'function') return sdk.translateSegment(segment, language)
        return createDemoQvacCommentaryAdapter({ commentatorId: id }).translateSegment(segment, language)
      },
      summarizeWindow (input) {
        if (typeof sdk.summarizeWindow === 'function') return sdk.summarizeWindow(input)
        return createDemoQvacCommentaryAdapter({ commentatorId: id }).summarizeWindow(input)
      }
    }
  }

  function createSdkQvacAdapter (sdk, { id = 'qvac-sdk' } = {}) {
    const requiredMethods = ['attestRound', 'attestPoolSettlement']
    const missing = requiredMethods.filter(method => !sdk || typeof sdk[method] !== 'function')
    if (missing.length > 0) {
      throw new Error(`QVAC SDK adapter missing required methods: ${missing.join(', ')}`)
    }
    return {
      id,
      mode: 'sdk',
      attestRound (input) {
        return sdk.attestRound(input)
      },
      attestPoolSettlement (input) {
        return sdk.attestPoolSettlement(input)
      }
    }
  }

  function createSdkTetherWdkAdapter (sdk, { id = 'tether-wdk-sdk' } = {}) {
    const requiredMethods = ['createGameEscrow', 'releaseGameEscrow', 'createEntryIntent', 'confirmEntryIntent', 'createPoolPayout']
    const missing = requiredMethods.filter(method => !sdk || typeof sdk[method] !== 'function')
    if (missing.length > 0) {
      throw new Error(`Tether WDK SDK adapter missing required methods: ${missing.join(', ')}`)
    }
    function withRail (value) {
      if (!value || typeof value !== 'object' || value.rail) return value
      return { ...value, rail: id }
    }
    function mapRail (value) {
      return value && typeof value.then === 'function' ? value.then(withRail) : withRail(value)
    }
    return {
      id,
      mode: 'sdk',
      createGameEscrow (input) {
        return mapRail(sdk.createGameEscrow({ ...input, rail: input && input.rail || id }))
      },
      releaseGameEscrow (input) {
        return mapRail(sdk.releaseGameEscrow(input))
      },
      refundGameEscrow (input) {
        if (typeof sdk.refundGameEscrow === 'function') return mapRail(sdk.refundGameEscrow(input))
        return createDemoTetherWdkAdapter({ rail: id }).refundGameEscrow(input)
      },
      createEntryIntent (input) {
        return mapRail(sdk.createEntryIntent({ ...input, rail: input && input.rail || id }))
      },
      confirmEntryIntent (input) {
        return mapRail(sdk.confirmEntryIntent(input))
      },
      refundEntryIntent (input) {
        if (typeof sdk.refundEntryIntent === 'function') return mapRail(sdk.refundEntryIntent(input))
        return createDemoTetherWdkAdapter({ rail: id }).refundEntryIntent(input)
      },
      createPoolPayout (input) {
        return mapRail(sdk.createPoolPayout({ ...input, rail: input && input.rail || id }))
      },
      disputeGameEscrow (input) {
        if (typeof sdk.disputeGameEscrow === 'function') return mapRail(sdk.disputeGameEscrow(input))
        return createDemoTetherWdkAdapter({ rail: id }).disputeGameEscrow(input)
      }
    }
  }

  function normalizeQvacAdapter (qvac) {
    if (!qvac) return createDemoQvacAdapter()
    if (qvac.mode && typeof qvac.attestRound === 'function' && typeof qvac.attestPoolSettlement === 'function') return qvac
    return createSdkQvacAdapter(qvac)
  }

  function normalizeQvacCommentaryAdapter (qvacCommentary) {
    if (!qvacCommentary) return createDemoQvacCommentaryAdapter()
    if (qvacCommentary.mode && typeof qvacCommentary.generateSegment === 'function') return qvacCommentary
    return createSdkQvacCommentaryAdapter(qvacCommentary)
  }

  function normalizeTetherWdkAdapter (tetherWdk) {
    if (!tetherWdk) return createDemoTetherWdkAdapter()
    if (
      tetherWdk.mode &&
      typeof tetherWdk.createGameEscrow === 'function' &&
      typeof tetherWdk.releaseGameEscrow === 'function' &&
      typeof tetherWdk.createEntryIntent === 'function' &&
      typeof tetherWdk.confirmEntryIntent === 'function' &&
      typeof tetherWdk.createPoolPayout === 'function'
    ) return tetherWdk
    return createSdkTetherWdkAdapter(tetherWdk)
  }

  function createIntegrationAdapters ({ qvac, tetherWdk, qvacCommentary } = {}) {
    const qvacAdapter = normalizeQvacAdapter(qvac)
    const tetherWdkAdapter = normalizeTetherWdkAdapter(tetherWdk)
    const qvacCommentaryAdapter = normalizeQvacCommentaryAdapter(qvacCommentary)
    return {
      qvac: qvacAdapter,
      tetherWdk: tetherWdkAdapter,
      qvacCommentary: qvacCommentaryAdapter,
      mode: {
        qvac: qvacAdapter.mode,
        tetherWdk: tetherWdkAdapter.mode,
        qvacCommentary: qvacCommentaryAdapter.mode
      }
    }
  }

  const api = {
    createDemoQvacAdapter,
    createDemoQvacCommentaryAdapter,
    createDemoTetherWdkAdapter,
    createSdkQvacAdapter,
    createSdkQvacCommentaryAdapter,
    createSdkTetherWdkAdapter,
    createIntegrationAdapters
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupAdapters = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupAdapters = 'adapter-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./qvac-referee.js */
(function attachPearCupQvacReferee (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const core = root.PearCupCore || (canRequireLocal ? require('./core.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupQvacReferee')

  function extractJsonObject (value) {
    if (!value) return {}
    if (typeof value === 'object') return value
    const text = String(value).trim()
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1 || end < start) return {}
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      return {}
    }
  }

  function normalizeReview (input) {
    const parsed = extractJsonObject(input)
    const explicitRuling = parsed.ruling === 'verified' || parsed.ruling === 'disputed'
    const ruling = parsed.ruling === 'verified' ? 'verified' : 'disputed'
    const confidence = Number(parsed.confidence)
    return {
      ruling,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : ruling === 'disputed' ? 0.35 : 0.95,
      rationale: typeof parsed.rationale === 'string' && parsed.rationale.trim()
        ? parsed.rationale.trim().slice(0, 500)
        : !explicitRuling
          ? 'QVAC response did not include a valid referee ruling.'
          : ruling === 'disputed'
          ? 'QVAC marked the evidence disputed.'
          : 'QVAC verified the deterministic evidence packet.',
      modelId: typeof parsed.modelId === 'string' ? parsed.modelId : null
    }
  }

  function roundReviewPrompt (roundResult) {
    return [
      {
        role: 'system',
        content: [
          'You are the QVAC trusted referee for PearCup prize-linked minigames.',
          'Verify only the supplied deterministic evidence.',
          'Return strict JSON: {"ruling":"verified|disputed","confidence":0..1,"rationale":"short reason"}.',
          'If evidence or JSON validity is uncertain, return disputed.',
          'Never invent missing commitments, reveals, state hashes, or winners.'
        ].join(' ')
      },
      {
        role: 'user',
        content: core.canonicalJson({
          task: 'verify_penalty_clash_round',
          requiredEvidence: ['shooterCommitment', 'keeperCommitment', 'stateHash', 'sourceEventIds', 'winnerUserId', 'participantUserIds'],
          roundResult
        })
      }
    ]
  }

  function poolReviewPrompt (poolResult) {
    return [
      {
        role: 'system',
        content: [
          'You are the QVAC trusted referee for PearCup bracket-pool settlement.',
          'Verify only confirmed entries, locked bracket submissions, eligible winners, official result evidence, and the rules version.',
          'Return strict JSON: {"ruling":"verified|disputed","confidence":0..1,"rationale":"short reason"}.',
          'If evidence or JSON validity is uncertain, return disputed.',
          'Never authorize payout when entries, bracket submissions, winners, settlement hashes, payment events, or official results snapshot evidence are missing.'
        ].join(' ')
      },
      {
        role: 'user',
        content: core.canonicalJson({
          task: 'verify_bracket_pool_settlement',
          requiredEvidence: ['sourcePaymentIds', 'sourceBracketSubmissionIds', 'winnerUserIds', 'bracketScoreboardHash', 'officialResultsHash', 'stateHash', 'sourceEventMode', 'sourceEventIds'],
          poolResult
        })
      }
    ]
  }

  function normalizeLanguage (language) {
    const normalized = String(language || 'EN')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16)
    return normalized || 'EN'
  }

  function commentarySourceEventIds (input = {}) {
    return Array.isArray(input.recentEvents)
      ? input.recentEvents.map(event => event && (event.sourceEventId || event.workerEventId || event.eventId)).filter(Boolean)
      : []
  }

  function commentaryFallbackText (input = {}) {
    const events = Array.isArray(input.recentEvents) ? input.recentEvents : []
    const latest = events[events.length - 1] || {}
    const language = normalizeLanguage(input.language)
    const team = latest.teamId ? String(latest.teamId).toUpperCase() : 'the room'
    const clock = input.clock || latest.clock || input.currentStats && input.currentStats.clock || '00:00'
    if (latest.type === 'goal') return `[${language}] ${team} score at ${clock}; the room picks just shifted.`
    if (latest.type === 'save') return `[${language}] ${team} produce a save at ${clock}; momentum is still alive.`
    if (latest.type === 'shot') return `[${language}] ${team} create another shot at ${clock}; pressure is building.`
    return `[${language}] Live match events at ${clock} are being summarized from the replayed feed.`
  }

  function normalizeCommentaryOutput (input, fallbackInput = {}) {
    const parsed = extractJsonObject(input)
    const rawText = typeof input === 'string' && !Object.keys(parsed).length ? input.trim() : ''
    const text = typeof parsed.text === 'string' && parsed.text.trim()
      ? parsed.text.trim().slice(0, 360)
      : rawText
        ? rawText.slice(0, 360)
        : commentaryFallbackText(fallbackInput)
    const confidence = Number(parsed.confidence)
    return {
      text,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.72,
      modelId: typeof parsed.modelId === 'string' ? parsed.modelId : null
    }
  }

  function commentaryPrompt (input = {}) {
    const language = normalizeLanguage(input.language)
    return [
      {
        role: 'system',
        content: [
          'You are the QVAC live commentary lane for PearCup watch parties.',
          'Use only the supplied match events, stats, and pick distribution.',
          'Return strict JSON: {"text":"one concise segment","confidence":0..1}.',
          `Write in language ${language}.`,
          'Do not invent goals, cards, injuries, substitutions, or official facts.'
        ].join(' ')
      },
      {
        role: 'user',
        content: core.canonicalJson({
          task: 'generate_grounded_match_commentary',
          requiredEvidence: ['recentEvents', 'currentStats', 'roomPickDistribution'],
          matchId: input.matchId || null,
          language,
          clock: input.clock || null,
          score: input.score || input.currentStats && input.currentStats.score || {},
          recentEvents: input.recentEvents || [],
          currentStats: input.currentStats || null,
          roomPickDistribution: input.roomPickDistribution || {},
          tone: input.tone || 'broadcast'
        })
      }
    ]
  }

  function createCommentarySegment ({
    input = {},
    text,
    confidence = 0.72,
    modelId = null,
    commentatorId = 'qvac-commentary'
  } = {}) {
    const recentEvents = Array.isArray(input.recentEvents) ? input.recentEvents : []
    const latest = recentEvents[recentEvents.length - 1] || {}
    const language = normalizeLanguage(input.language)
    const sourceEventIds = commentarySourceEventIds(input)
    const clock = input.clock || latest.clock || input.currentStats && input.currentStats.clock || '00:00'
    const matchId = input.matchId || latest.matchId || 'unknown-match'
    const eventHash = core.deterministicHash(sourceEventIds)
    const statHash = core.deterministicHash(input.currentStats || null)
    const payload = {
      matchId,
      language,
      clock,
      text: String(text || commentaryFallbackText(input)).trim().slice(0, 360),
      sourceEventIds,
      eventHash,
      statHash,
      confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
      modelId,
      commentatorId,
      createdAt: '2026-07-01T00:00:00.000Z'
    }
    return {
      segmentId: core.deterministicHash(payload),
      ...payload
    }
  }

  function commentarySummary (input = {}, normalized = {}) {
    const sourceSegmentIds = Array.isArray(input.segments)
      ? input.segments.map(segment => segment && segment.segmentId).filter(Boolean)
      : []
    const language = normalizeLanguage(input.language)
    const payload = {
      matchId: input.matchId || 'unknown-match',
      language,
      text: String(normalized.text || commentaryFallbackText(input)).trim().slice(0, 500),
      sourceSegmentIds,
      confidence: Math.max(0, Math.min(1, Number(normalized.confidence) || 0)),
      modelId: normalized.modelId || null,
      createdAt: '2026-07-01T00:00:00.000Z'
    }
    return {
      summaryId: core.deterministicHash(payload),
      ...payload
    }
  }

  async function collectTokenStream (tokenStream) {
    let text = ''
    for await (const token of tokenStream) text += token
    return text
  }

  async function runCompletion (client, history, modelId) {
    if (!client) throw new Error('QVAC completion client is required')

    if (typeof client.completeJson === 'function') {
      return client.completeJson({ history, modelId })
    }

    if (typeof client.completion === 'function') {
      const result = await client.completion({ modelId: modelId || client.modelId, history, stream: true })
      if (result && result.tokenStream) return collectTokenStream(result.tokenStream)
      if (typeof result === 'string') return result
      if (result && typeof result.text === 'string') return result.text
      return result
    }

    if (typeof client === 'function') {
      return client({ modelId, history })
    }

    if (client.chat && client.chat.completions && typeof client.chat.completions.create === 'function') {
      const result = await client.chat.completions.create({
        model: modelId || client.model || 'qvac-local-referee',
        messages: history,
        response_format: { type: 'json_object' }
      })
      return result && result.choices && result.choices[0] && result.choices[0].message
        ? result.choices[0].message.content
        : result
    }

    throw new Error('Unsupported QVAC completion client')
  }

  function createQvacCompletionRefereeAdapter ({
    client,
    modelId = 'qvac-local-referee',
    refereeId = 'qvac-ai-referee'
  } = {}) {
    return {
      id: refereeId,
      mode: 'sdk',
      async: true,
      async attestRound ({ roundResult }) {
        const raw = await runCompletion(client, roundReviewPrompt(roundResult), modelId)
        const review = normalizeReview(raw)
        return core.createQvacRefereeAttestation({ roundResult, refereeId, review: { ...review, modelId } })
      },
      async attestPoolSettlement ({ poolResult }) {
        const raw = await runCompletion(client, poolReviewPrompt(poolResult), modelId)
        const review = normalizeReview(raw)
        return core.createQvacPoolSettlementAttestation({ poolResult, refereeId, review: { ...review, modelId } })
      }
    }
  }

  function createQvacCompletionCommentaryAdapter ({
    client,
    modelId = 'qvac-local-commentary',
    commentatorId = 'qvac-ai-commentary'
  } = {}) {
    return {
      id: commentatorId,
      mode: 'sdk',
      async: true,
      async generateSegment (input = {}) {
        const raw = await runCompletion(client, commentaryPrompt(input), modelId)
        const normalized = normalizeCommentaryOutput(raw, input)
        return createCommentarySegment({
          input,
          text: normalized.text,
          confidence: normalized.confidence,
          modelId: normalized.modelId || modelId,
          commentatorId
        })
      },
      async translateSegment (segment, language) {
        const normalizedLanguage = normalizeLanguage(language)
        const raw = await runCompletion(client, [
          {
            role: 'system',
            content: `Translate this PearCup commentary segment into ${normalizedLanguage}. Return strict JSON: {"text":"translation","confidence":0..1}.`
          },
          {
            role: 'user',
            content: core.canonicalJson({ segment, language: normalizedLanguage })
          }
        ], modelId)
        const normalized = normalizeCommentaryOutput(raw, { ...segment, language: normalizedLanguage })
        return createCommentarySegment({
          input: {
            matchId: segment.matchId,
            language: normalizedLanguage,
            clock: segment.clock,
            recentEvents: (segment.sourceEventIds || []).map(eventId => ({ eventId, matchId: segment.matchId, clock: segment.clock }))
          },
          text: normalized.text,
          confidence: normalized.confidence,
          modelId: normalized.modelId || modelId,
          commentatorId
        })
      },
      async summarizeWindow (input = {}) {
        const raw = await runCompletion(client, [
          {
            role: 'system',
            content: 'Summarize this PearCup commentary window. Return strict JSON: {"text":"summary","confidence":0..1}. Do not invent facts.'
          },
          {
            role: 'user',
            content: core.canonicalJson(input)
          }
        ], modelId)
        return commentarySummary(input, normalizeCommentaryOutput(raw, input))
      }
    }
  }

  const api = {
    createQvacCompletionRefereeAdapter,
    createQvacCompletionCommentaryAdapter,
    extractJsonObject,
    normalizeReview,
    normalizeLanguage,
    normalizeCommentaryOutput,
    commentaryPrompt,
    createCommentarySegment,
    roundReviewPrompt,
    poolReviewPrompt
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupQvacReferee = api
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./tether-wdk-bridge.js */
(function attachPearCupTetherWdkBridge (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const core = root.PearCupCore || (canRequireLocal ? require('./core.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupTetherWdkBridge')

  function toAmountCents (amount) {
    return Math.round(Number(amount || 0) * 100)
  }

  function normalizeAsset (asset) {
    const value = String(asset || 'USDT').toLowerCase()
    if (value === 'btc' || value === 'bitcoin') return 'btc'
    return 'usdt-evm'
  }

  function paymentMethodForAsset (asset) {
    return normalizeAsset(asset) === 'btc' ? 'crypto_btc' : 'crypto_usdt'
  }

  async function createProcessorTransaction (processor, input, reference) {
    if (!processor || typeof processor.createTransaction !== 'function') return null
    const transaction = await processor.createTransaction({
      amountCents: toAmountCents(input.amount),
      asset: normalizeAsset(input.asset),
      method: paymentMethodForAsset(input.asset),
      reference
    })
    if (processor && typeof processor.collectPaymentMethod === 'function') {
      await processor.collectPaymentMethod(transaction)
    }
    return transaction
  }

  function attachTransactionFields (value, transaction) {
    if (!transaction) return value
    return {
      ...value,
      wdkTransactionId: transaction.id || transaction.processorId || null,
      receiveAddress: transaction.address || null,
      paymentUri: transaction.qrData || null,
      chain: transaction.chain || null,
      token: transaction.token || null,
      processorStatus: transaction.status || null
    }
  }

  function isProcessorPaid (status = {}) {
    return status.paid === true ||
      status.status === 'captured' ||
      status.status === 'confirmed' ||
      status.status === 'paid'
  }

  function isProcessorRefunded (status = {}) {
    return status.refunded === true ||
      status.status === 'refunded' ||
      status.status === 'voided' ||
      status.status === 'reversed'
  }

  function confirmationIdFor ({ confirmationId, confirmation, status, intent } = {}) {
    return confirmationId ||
      confirmation && (confirmation.id || confirmation.confirmationId || confirmation.transactionId) ||
      status && (status.confirmationId || status.transactionId || status.id) ||
      intent && intent.wdkTransactionId
  }

  function pendingEntryPayment ({ intent, confirmationId, processorStatus, reason }) {
    if (!intent) {
      return {
        checkId: core.deterministicHash({
          intentId: null,
          confirmationId: confirmationId || null,
          processorStatus,
          reason
        }),
        intentId: null,
        status: 'pending',
        processorStatus,
        reason,
        checkedAt: '2026-07-01T00:00:00.000Z'
      }
    }
    return core.createTetherWdkEntryPaymentPending({
      intent,
      confirmationId,
      processorStatus,
      reason
    })
  }

  function createTetherWdkProcessorAdapter ({ processor, rail = 'tether-wdk-processor' } = {}) {
    return {
      id: rail,
      mode: 'sdk',
      async: true,

      async createGameEscrow (input) {
        const escrow = core.createTetherWdkEscrowIntent({ ...input, rail })
        const transaction = await createProcessorTransaction(processor, input, escrow.escrowId)
        return attachTransactionFields(escrow, transaction)
      },

      async releaseGameEscrow ({ escrow, attestation, winnerUserId, payoutAddress, payoutRecipients }) {
        const payout = core.releaseTetherWdkEscrow({ escrow, attestation, winnerUserId })
        if (processor && typeof processor.releaseEscrow === 'function') {
          const processorRelease = await processor.releaseEscrow({
            escrow,
            attestation,
            winnerUserId,
            payout,
            payoutAddress,
            payoutRecipients
          })
          return { ...payout, processorRelease }
        }
        return payout
      },

      async refundGameEscrow ({ escrow, reason = 'game-escrow-refunded', refundUserIds, payoutAddress, payoutRecipients }) {
        if (!escrow || !escrow.escrowId) throw new Error('Locked escrow is required before WDK refund')
        if (!escrow.wdkTransactionId) throw new Error('WDK transaction id is required before refunding game escrow')
        const refundMethod = processor && typeof processor.refundEscrow === 'function'
          ? 'refundEscrow'
          : processor && typeof processor.refundPayment === 'function'
            ? 'refundPayment'
            : null
        if (!refundMethod) throw new Error('WDK refundEscrow or refundPayment is required before refunding game escrow')
        const processorRefund = await processor[refundMethod]({ id: escrow.wdkTransactionId }, {
          escrow,
          reason,
          refundUserIds,
          payoutAddress,
          payoutRecipients
        })
        if (!isProcessorRefunded(processorRefund)) throw new Error('WDK game escrow has not been refunded yet')
        return {
          ...core.refundTetherWdkEscrow({
            escrow,
            reason,
            refundUserIds,
            processorStatus: processorRefund && processorRefund.status ? processorRefund.status : 'refunded'
          }),
          processorRefund
        }
      },

      async createEntryIntent (input) {
        const intent = core.createTetherWdkEntryIntent({ ...input, rail })
        const transaction = await createProcessorTransaction(processor, input, intent.intentId)
        return attachTransactionFields(intent, transaction)
      },

      async confirmEntryIntent ({ intent, confirmationId }) {
        if (!intent || !intent.intentId) throw new Error('Entry intent is required before WDK confirmation')
        if (!intent.wdkTransactionId) throw new Error('WDK transaction id is required before payment confirmation')
        if (!processor || typeof processor.confirmPayment !== 'function') {
          throw new Error('WDK confirmPayment is required before confirming entry payment')
        }
        const confirmation = await processor.confirmPayment({ id: intent.wdkTransactionId }, {
          confirmationId,
          timeoutMs: 0,
          pollMs: 0
        })
        if (!isProcessorPaid(confirmation)) throw new Error('WDK payment has not been confirmed yet')
        return {
          ...core.confirmTetherWdkEntryIntent({
            intent,
            confirmationId: confirmationIdFor({ confirmationId, confirmation, intent })
          }),
          wdkTransactionId: intent.wdkTransactionId || null,
          processorConfirmation: confirmation
        }
      },

      async reconcileEntryIntent ({ intent, confirmationId }) {
        if (!intent) {
          return pendingEntryPayment({
            intent,
            confirmationId,
            processorStatus: 'missing_intent',
            reason: 'Entry intent is required before payment reconciliation'
          })
        }
        if (processor && typeof processor.checkStatus === 'function' && intent.wdkTransactionId) {
          try {
            const status = await processor.checkStatus(intent.wdkTransactionId)
            if (!isProcessorPaid(status)) {
              return pendingEntryPayment({
                intent,
                confirmationId,
                processorStatus: status && status.status ? status.status : 'awaiting_payment',
                reason: 'WDK payment has not been confirmed yet'
              })
            }
            return {
              ...core.confirmTetherWdkEntryIntent({
                intent,
                confirmationId: confirmationIdFor({ confirmationId, status, intent })
              }),
              wdkTransactionId: intent.wdkTransactionId || null,
              processorConfirmation: status
            }
          } catch (error) {
            return pendingEntryPayment({
              intent,
              confirmationId,
              processorStatus: 'check_failed',
              reason: error.message
            })
          }
        }
        try {
          return await this.confirmEntryIntent({ intent, confirmationId })
        } catch (error) {
          return pendingEntryPayment({
            intent,
            confirmationId,
            processorStatus: 'confirmation_failed',
            reason: error.message
          })
        }
      },

      async refundEntryIntent ({ payment, reason = 'entry-refunded' }) {
        if (!payment || !payment.paymentId) throw new Error('Confirmed entry payment is required before WDK refund')
        if (!payment.wdkTransactionId) throw new Error('WDK transaction id is required before refunding entry payment')
        if (!processor || typeof processor.refundPayment !== 'function') {
          throw new Error('WDK refundPayment is required before refunding entry payment')
        }
        const processorRefund = await processor.refundPayment({ id: payment.wdkTransactionId }, {
          payment,
          reason
        })
        if (!isProcessorRefunded(processorRefund)) throw new Error('WDK entry payment has not been refunded yet')
        return {
          ...core.createTetherWdkEntryRefund({
            payment,
            reason,
            processorStatus: processorRefund && processorRefund.status ? processorRefund.status : 'refunded'
          }),
          processorRefund
        }
      },

      async createPoolPayout (input) {
        const payout = core.createTetherWdkPoolPayout({ ...input, rail })
        if (processor && typeof processor.preparePoolPayout === 'function') {
          const processorPayout = await processor.preparePoolPayout({ ...input, payout })
          return { ...payout, processorPayout }
        }
        return payout
      },

      disputeGameEscrow ({ gameId, roundId, escrowId, reason }) {
        return {
          disputeId: core.deterministicHash({ gameId, roundId, escrowId, reason, rail }),
          gameId,
          roundId,
          escrowId,
          reason,
          status: 'held',
          rail
        }
      }
    }
  }

  const api = {
    createTetherWdkProcessorAdapter,
    normalizeAsset,
    paymentMethodForAsset,
    isProcessorRefunded
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupTetherWdkBridge = api
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./runtime-settings.js */
(function attachPearCupRuntimeSettings (root) {
  const DEFAULT_CONFIG_PATH = 'config/pearcup.runtime.json'
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'

  function safeRequire (name) {
    try {
      return canRequireLocal ? require(name) : null
    } catch {
      return null
    }
  }

  function parseBool (value, fallback = false) {
    if (value == null || value === '') return fallback
    if (typeof value === 'boolean') return value
    const normalized = String(value).trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
    return fallback
  }

  function parseList (value, fallback = []) {
    if (Array.isArray(value)) return value.filter(Boolean)
    if (typeof value !== 'string' || value.trim() === '') return fallback
    return value.split(',').map(item => item.trim()).filter(Boolean)
  }

  function parseNumber (value, fallback) {
    if (value == null || value === '') return fallback
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
  }

  function clone (value) {
    return JSON.parse(JSON.stringify(value || {}))
  }

  function readJsonConfig ({ env = {}, configPath, readFile, cwd, resolvePath } = {}) {
    const requestedPath = configPath || env.PEARCUP_RUNTIME_CONFIG || DEFAULT_CONFIG_PATH
    const fs = readFile ? null : safeRequire('node:fs')
    const path = resolvePath ? null : safeRequire('node:path')
    const base = cwd || (typeof process !== 'undefined' && process.cwd ? process.cwd() : '.')
    const resolvedPath = resolvePath
      ? resolvePath(requestedPath)
      : path && !path.isAbsolute(requestedPath)
        ? path.resolve(base, requestedPath)
        : requestedPath
    const fileWasExplicit = Boolean(configPath || env.PEARCUP_RUNTIME_CONFIG)

    try {
      const text = readFile ? readFile(resolvedPath) : fs && fs.readFileSync(resolvedPath, 'utf8')
      if (!text) return { config: {}, path: resolvedPath, loaded: false }
      return { config: JSON.parse(text), path: resolvedPath, loaded: true }
    } catch (err) {
      if (!fileWasExplicit && err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
        return { config: {}, path: resolvedPath, loaded: false }
      }
      throw err
    }
  }

  function qvacSettingsFrom ({ env = {}, config = {} } = {}) {
    const configured = (config.sdkPackages && config.sdkPackages.qvac) || config.qvac || {}
    const enabled = parseBool(env.PEARCUP_QVAC_ENABLED, parseBool(configured.enabled, Boolean(configured.modelSrc || configured.modelExport || configured.preloadedModelId)))
    if (!enabled) return null

    const settings = {}
    const modelSrc = env.PEARCUP_QVAC_MODEL_SRC || configured.modelSrc
    const modelId = env.PEARCUP_QVAC_MODEL_ID || configured.modelId
    const modelExport = env.PEARCUP_QVAC_MODEL_EXPORT || configured.modelExport
    const preloadedModelId = env.PEARCUP_QVAC_PRELOADED_MODEL_ID || configured.preloadedModelId
    if (modelSrc) settings.modelSrc = modelSrc
    if (modelId) settings.modelId = modelId
    if (modelExport) settings.modelExport = modelExport
    if (preloadedModelId) settings.preloadedModelId = preloadedModelId
    settings.autoUnload = parseBool(env.PEARCUP_QVAC_AUTO_UNLOAD, parseBool(configured.autoUnload, true))
    settings.preflightLoadModel = parseBool(env.PEARCUP_QVAC_PREFLIGHT_LOAD_MODEL, parseBool(configured.preflightLoadModel, false))
    if (configured.loadModelOptions) settings.loadModelOptions = configured.loadModelOptions
    if (configured.completionOptions) settings.completionOptions = configured.completionOptions
    return settings
  }

  function tetherWdkSettingsFrom ({ env = {}, config = {} } = {}) {
    const configured = (config.sdkPackages && (config.sdkPackages.tetherWdk || config.sdkPackages.tetherWDK)) || config.tetherWdk || {}
    const seedPhrase = env.PEARCUP_WDK_SEED || configured.seedPhrase
    const enabled = parseBool(env.PEARCUP_WDK_ENABLED, parseBool(configured.enabled, Boolean(seedPhrase)))
    if (!enabled || !seedPhrase) return null

    const assets = parseList(env.PEARCUP_WDK_ASSETS, parseList(configured.assets, ['usdt-evm']))
    return {
      seedPhrase,
      assets,
      evmProvider: env.PEARCUP_EVM_PROVIDER || configured.evmProvider,
      evmChainId: parseNumber(env.PEARCUP_EVM_CHAIN_ID, parseNumber(configured.evmChainId, 1)),
      btcNetwork: env.PEARCUP_BTC_NETWORK || configured.btcNetwork || 'bitcoin',
      btcClient: configured.btcClient,
      payoutAccountIndex: parseNumber(
        env.PEARCUP_WDK_PAYOUT_ACCOUNT_INDEX,
        parseNumber(configured.payoutAccountIndex, 0)
      ),
      defaultPayoutAddress: env.PEARCUP_WDK_DEFAULT_PAYOUT_ADDRESS || configured.defaultPayoutAddress || '',
      payoutRecipients: configured.payoutRecipients || {},
      broadcastPayouts: parseBool(
        env.PEARCUP_WDK_BROADCAST_PAYOUTS,
        parseBool(configured.broadcastPayouts, false)
      ),
      quotePayouts: parseBool(
        env.PEARCUP_WDK_QUOTE_PAYOUTS,
        parseBool(configured.quotePayouts, true)
      ),
      skipInitialBalanceProbe: parseBool(
        env.PEARCUP_WDK_SKIP_INITIAL_BALANCE_PROBE,
        parseBool(configured.skipInitialBalanceProbe, false)
      )
    }
  }

  function complianceSettingsFrom ({ env = {}, config = {} } = {}) {
    const configured = config.compliance || {}
    return {
      realMoneyEnabled: parseBool(env.PEARCUP_REAL_MONEY_ENABLED, configured.realMoneyEnabled === true),
      kycVerified: parseBool(env.PEARCUP_KYC_VERIFIED, configured.kycVerified === true),
      jurisdictionAllowed: parseBool(env.PEARCUP_JURISDICTION_ALLOWED, configured.jurisdictionAllowed === true),
      responsiblePlayAccepted: parseBool(env.PEARCUP_RESPONSIBLE_PLAY_ACCEPTED, configured.responsiblePlayAccepted === true)
    }
  }

  function createLiveRuntimeConfigTemplate ({ env = {} } = {}) {
    const qvacEnabled = parseBool(
      env.PEARCUP_QVAC_ENABLED,
      Boolean(env.PEARCUP_QVAC_MODEL_SRC || env.PEARCUP_QVAC_MODEL_EXPORT || env.PEARCUP_QVAC_PRELOADED_MODEL_ID)
    )
    const tetherEnabled = parseBool(env.PEARCUP_WDK_ENABLED, Boolean(env.PEARCUP_WDK_SEED))

    return {
      sdkPackages: {
        qvac: {
          enabled: qvacEnabled,
          modelSrc: env.PEARCUP_QVAC_MODEL_SRC || '',
          modelExport: env.PEARCUP_QVAC_MODEL_EXPORT || 'LLAMA_3_2_1B_INST_Q4_0',
          preloadedModelId: env.PEARCUP_QVAC_PRELOADED_MODEL_ID || '',
          modelId: env.PEARCUP_QVAC_MODEL_ID || 'qvac-pearcup-referee',
          autoUnload: parseBool(env.PEARCUP_QVAC_AUTO_UNLOAD, true),
          preflightLoadModel: parseBool(env.PEARCUP_QVAC_PREFLIGHT_LOAD_MODEL, false)
        },
        tetherWdk: {
          enabled: tetherEnabled,
          seedPhrase: env.PEARCUP_WDK_SEED || '',
          assets: parseList(env.PEARCUP_WDK_ASSETS, ['usdt-evm']),
          evmProvider: env.PEARCUP_EVM_PROVIDER || '',
          evmChainId: parseNumber(env.PEARCUP_EVM_CHAIN_ID, 1),
          btcNetwork: env.PEARCUP_BTC_NETWORK || 'bitcoin',
          payoutAccountIndex: parseNumber(env.PEARCUP_WDK_PAYOUT_ACCOUNT_INDEX, 0),
          defaultPayoutAddress: env.PEARCUP_WDK_DEFAULT_PAYOUT_ADDRESS || '',
          payoutRecipients: {},
          broadcastPayouts: parseBool(env.PEARCUP_WDK_BROADCAST_PAYOUTS, false),
          quotePayouts: parseBool(env.PEARCUP_WDK_QUOTE_PAYOUTS, true),
          skipInitialBalanceProbe: parseBool(env.PEARCUP_WDK_SKIP_INITIAL_BALANCE_PROBE, false)
        }
      },
      compliance: {
        realMoneyEnabled: parseBool(env.PEARCUP_REAL_MONEY_ENABLED, false),
        kycVerified: parseBool(env.PEARCUP_KYC_VERIFIED, false),
        jurisdictionAllowed: parseBool(env.PEARCUP_JURISDICTION_ALLOWED, false),
        responsiblePlayAccepted: parseBool(env.PEARCUP_RESPONSIBLE_PLAY_ACCEPTED, false)
      }
    }
  }

  function makeConfigIssue ({ key, label, source = 'runtime-settings', severity = 'error', detail }) {
    const issue = { key, label, source, severity }
    if (detail) issue.detail = detail
    return issue
  }

  function payoutRecipientCount (tetherWdk = {}) {
    return Object.values(tetherWdk.payoutRecipients || {}).filter(Boolean).length
  }

  function hasPayoutRecipientRoute (tetherWdk = {}) {
    return Boolean(tetherWdk.defaultPayoutAddress || payoutRecipientCount(tetherWdk) > 0)
  }

  function validateRuntimeSettings (settings = {}, opts = {}) {
    const requireLive = opts.requireLive === true
    const errors = []
    const warnings = []
    const requiredActions = []
    const sdkPackages = settings.sdkPackages || {}
    const qvac = sdkPackages.qvac
    const tetherWdk = sdkPackages.tetherWdk || sdkPackages.tetherWDK
    const compliance = settings.compliance || {}

    function addIssue (issue) {
      if (issue.severity === 'warning') warnings.push(issue)
      else errors.push(issue)
      if (issue.severity !== 'warning') {
        requiredActions.push({
          key: issue.key,
          label: issue.label,
          source: issue.source,
          severity: issue.severity
        })
      }
    }

    if (!settings.source || settings.source.loaded !== true) {
      addIssue(makeConfigIssue({
        key: 'runtime-config-file',
        label: 'Load a local config/pearcup.runtime.json or set PEARCUP_RUNTIME_CONFIG for auditable live setup.',
        severity: 'warning'
      }))
    }

    if (!qvac) {
      addIssue(makeConfigIssue({
        key: 'configure-qvac',
        label: 'Enable sdkPackages.qvac for the QVAC trusted referee path.',
        severity: requireLive ? 'error' : 'warning'
      }))
    } else if (!qvac.modelSrc && !qvac.modelExport && !qvac.preloadedModelId) {
      addIssue(makeConfigIssue({
        key: 'configure-qvac',
        label: 'Set a QVAC modelSrc, modelExport, or preloadedModelId for the trusted referee.',
        severity: requireLive ? 'error' : 'warning'
      }))
    }

    if (!tetherWdk || !tetherWdk.seedPhrase) {
      addIssue(makeConfigIssue({
        key: 'configure-tether-wdk',
        label: 'Set sdkPackages.tetherWdk.seedPhrase or PEARCUP_WDK_SEED for Tether WDK settlement.',
        severity: requireLive ? 'error' : 'warning'
      }))
    } else {
      const assets = parseList(tetherWdk.assets, ['usdt-evm'])
      if (assets.length === 0) {
        addIssue(makeConfigIssue({
          key: 'configure-tether-wdk',
          label: 'Configure at least one Tether WDK settlement asset.',
          severity: requireLive ? 'error' : 'warning'
        }))
      }
      if (assets.includes('usdt-evm') && !tetherWdk.evmProvider) {
        addIssue(makeConfigIssue({
          key: 'configure-tether-wdk',
          label: 'Set PEARCUP_EVM_PROVIDER or sdkPackages.tetherWdk.evmProvider for live USDT-EVM confirmation.',
          severity: requireLive ? 'error' : 'warning'
        }))
      }
      if (tetherWdk.skipInitialBalanceProbe === true) {
        addIssue(makeConfigIssue({
          key: 'configure-tether-wdk',
          label: 'Disable skipInitialBalanceProbe before live prize settlement.',
          severity: requireLive ? 'error' : 'warning'
        }))
      }
      if (!hasPayoutRecipientRoute(tetherWdk)) {
        addIssue(makeConfigIssue({
          key: 'configure-payout-recipients',
          label: 'Configure sdkPackages.tetherWdk.defaultPayoutAddress or payoutRecipients before live prize settlement.',
          severity: requireLive ? 'error' : 'warning'
        }))
      }
      if (tetherWdk.broadcastPayouts === true) {
        addIssue(makeConfigIssue({
          key: 'configure-tether-wdk-payouts',
          label: 'Broadcast payouts are enabled; verify payout recipients, operator custody, and legal release approval.',
          severity: 'warning'
        }))
      }
    }

    const complianceLabels = {
      realMoneyEnabled: 'Enable real-money mode only after legal review.',
      kycVerified: 'Verify KYC before allowing real-money prize pools.',
      jurisdictionAllowed: 'Confirm the user jurisdiction is allowed.',
      responsiblePlayAccepted: 'Require responsible-play terms before live prize pools.'
    }
    for (const key of Object.keys(complianceLabels)) {
      if (compliance[key] !== true) {
        addIssue(makeConfigIssue({
          key: 'complete-compliance',
          label: complianceLabels[key],
          source: `runtime-compliance:${key}`,
          severity: requireLive ? 'error' : 'warning'
        }))
      }
    }

    return {
      ok: errors.length === 0,
      requireLive,
      errors: clone(errors),
      warnings: clone(warnings),
      requiredActions: clone(requiredActions),
      redactedSettings: redactRuntimeSettings(settings)
    }
  }

  function loadRuntimeSettings (opts = {}) {
    const env = opts.env || (typeof process !== 'undefined' ? process.env : {})
    const loaded = opts.config
      ? { config: opts.config, path: opts.configPath || null, loaded: true }
      : readJsonConfig({ ...opts, env })
    const qvac = qvacSettingsFrom({ env, config: loaded.config })
    const tetherWdk = tetherWdkSettingsFrom({ env, config: loaded.config })
    const sdkPackages = {}
    if (qvac) sdkPackages.qvac = qvac
    if (tetherWdk) sdkPackages.tetherWdk = tetherWdk

    return {
      source: {
        path: loaded.path,
        loaded: loaded.loaded
      },
      sdkPackages,
      compliance: complianceSettingsFrom({ env, config: loaded.config })
    }
  }

  function redactRuntimeSettings (settings = {}) {
    const redacted = JSON.parse(JSON.stringify(settings || {}))
    if (redacted.sdkPackages && redacted.sdkPackages.tetherWdk && redacted.sdkPackages.tetherWdk.seedPhrase) {
      redacted.sdkPackages.tetherWdk.seedPhrase = '[redacted]'
    }
    if (redacted.sdkPackages && redacted.sdkPackages.tetherWdk && redacted.sdkPackages.tetherWdk.defaultPayoutAddress) {
      redacted.sdkPackages.tetherWdk.defaultPayoutAddress = '[redacted]'
    }
    if (redacted.sdkPackages && redacted.sdkPackages.tetherWdk && redacted.sdkPackages.tetherWdk.payoutRecipients) {
      redacted.sdkPackages.tetherWdk.payoutRecipients = Object.fromEntries(
        Object.keys(redacted.sdkPackages.tetherWdk.payoutRecipients).map(userId => [userId, '[redacted]'])
      )
    }
    return redacted
  }

  function applyRuntimeSettingsToRoot (rootObject = root, settings = loadRuntimeSettings()) {
    rootObject.PearCupRuntimeSettingsValue = settings
    if (settings.compliance) rootObject.PearCupCompliance = settings.compliance
    return settings
  }

  const api = {
    DEFAULT_CONFIG_PATH,
    parseBool,
    parseList,
    readJsonConfig,
    createLiveRuntimeConfigTemplate,
    payoutRecipientCount,
    hasPayoutRecipientRoute,
    loadRuntimeSettings,
    validateRuntimeSettings,
    redactRuntimeSettings,
    applyRuntimeSettingsToRoot
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupRuntimeSettings = api
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./runtime-config.js */
(function attachPearCupRuntimeConfig (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const adapterFactory = root.PearCupAdapters || (canRequireLocal ? require('./adapters.js') : null)
  if (!adapterFactory) throw new Error('PearCupAdapters is required before PearCupRuntimeConfig')
  const qvacRefereeFactory = root.PearCupQvacReferee || (canRequireLocal ? safeRequire('./qvac-referee.js') : null)
  const tetherWdkBridgeFactory = root.PearCupTetherWdkBridge || (canRequireLocal ? safeRequire('./tether-wdk-bridge.js') : null)
  const packageSdkFactory = root.PearCupSdkRuntime || (canRequireLocal ? safeRequire('./sdk-runtime.js') : null)

  const qvacRequiredMethods = ['attestRound', 'attestPoolSettlement']
  const qvacCommentaryRequiredMethods = ['generateSegment']
  const tetherWdkRequiredMethods = ['createGameEscrow', 'releaseGameEscrow', 'createEntryIntent', 'confirmEntryIntent', 'createPoolPayout']
  const tetherWdkOptionalMethods = ['reconcileEntryIntent', 'disputeGameEscrow', 'refundEntryIntent', 'refundGameEscrow']

  function safeRequire (path) {
    try {
      return canRequireLocal ? require(path) : null
    } catch {
      return null
    }
  }

  function pickClient (rootObject, names) {
    for (const name of names) {
      if (rootObject && rootObject[name]) return { name, client: rootObject[name] }
    }
    return null
  }

  function methodStatus (client, requiredMethods, optionalMethods = []) {
    return {
      required: requiredMethods.map(name => ({
        name,
        present: Boolean(client && typeof client[name] === 'function')
      })),
      optional: optionalMethods.map(name => ({
        name,
        present: Boolean(client && typeof client[name] === 'function')
      }))
    }
  }

  function missingRequiredMethods (status) {
    return status.required.filter(method => !method.present).map(method => method.name)
  }

  function hasRequiredMethods (client, requiredMethods) {
    return Boolean(client && requiredMethods.every(name => typeof client[name] === 'function'))
  }

  function detectSdkGlobals (rootObject = root) {
    return {
      qvac: pickClient(rootObject, ['PearCupQVAC', 'QVAC', 'qvac']),
      qvacCompletion: pickClient(rootObject, ['PearCupQVACCompletion', 'QVACCompletion', 'qvacCompletion']),
      tetherWdk: pickClient(rootObject, ['PearCupTetherWDK', 'TetherWDK', 'TetherWdk', 'tetherWdk']),
      tetherWdkProcessor: pickClient(rootObject, ['PearCupTetherWDKProcessor', 'TetherWDKProcessor', 'TetherWdkProcessor', 'tetherWdkProcessor'])
    }
  }

  function normalizePackageConfig (value) {
    if (value === true) return {}
    if (value && typeof value === 'object') return value
    return null
  }

  function runtimeOptionsFor (rootObject, explicitSdkPackages) {
    const options = rootObject.PearCupRuntimeOptions || root.PearCupRuntimeOptions || {}
    const settings = rootObject.PearCupRuntimeSettingsValue || root.PearCupRuntimeSettingsValue || {}
    return {
      sdkPackages: explicitSdkPackages || options.sdkPackages || settings.sdkPackages || null,
      compliance: options.compliance || settings.compliance || null
    }
  }

  function sdkFactoryFor (rootObject) {
    return rootObject.PearCupSdkRuntime || root.PearCupSdkRuntime || packageSdkFactory
  }

  function createPackageAdapters (rootObject, sdkPackages) {
    const sdkFactory = sdkFactoryFor(rootObject)
    const qvacConfig = normalizePackageConfig(sdkPackages && sdkPackages.qvac)
    const tetherConfig = normalizePackageConfig(sdkPackages && (sdkPackages.tetherWdk || sdkPackages.tetherWDK))
    const adapters = {}

    if (
      qvacConfig &&
      sdkFactory &&
      typeof sdkFactory.createQvacSdkRefereeAdapter === 'function'
    ) {
      adapters.qvac = {
        client: sdkFactory.createQvacSdkRefereeAdapter(qvacConfig),
        detected: { name: '@qvac/sdk', source: 'package:@qvac/sdk' }
      }
    }

    if (
      qvacConfig &&
      sdkFactory &&
      typeof sdkFactory.createQvacSdkCommentaryAdapter === 'function'
    ) {
      adapters.qvacCommentary = {
        client: sdkFactory.createQvacSdkCommentaryAdapter(qvacConfig),
        detected: { name: '@qvac/sdk', source: 'package:@qvac/sdk' }
      }
    }

    if (
      tetherConfig &&
      tetherConfig.seedPhrase &&
      sdkFactory &&
      typeof sdkFactory.createTetherWdkPackageAdapter === 'function'
    ) {
      adapters.tetherWdk = {
        client: sdkFactory.createTetherWdkPackageAdapter(tetherConfig),
        detected: { name: '@tetherto/wdk', source: 'package:@tetherto/wdk' }
      }
    }

    return adapters
  }

  function normalizeCompliance (compliance = {}) {
    return {
      realMoneyEnabled: compliance.realMoneyEnabled === true,
      kycVerified: compliance.kycVerified === true,
      jurisdictionAllowed: compliance.jurisdictionAllowed === true,
      responsiblePlayAccepted: compliance.responsiblePlayAccepted === true
    }
  }

  function createServiceReadiness ({ key, label, adapter, detected, explicitClient, requiredMethods, optionalMethods = [] }) {
    const client = explicitClient || (detected && detected.client) || null
    const methodClient = adapter.mode === 'sdk' ? adapter : client
    const methods = methodStatus(methodClient, requiredMethods, optionalMethods)
    const missing = missingRequiredMethods(methods)
    const source = explicitClient ? 'injected' : detected && detected.source ? detected.source : detected ? `global:${detected.name}` : 'demo'

    return {
      key,
      label,
      mode: adapter.mode,
      adapterId: adapter.id,
      source,
      sdkDetected: Boolean(client || adapter.mode === 'sdk'),
      sdkReady: adapter.mode === 'sdk' && missing.length === 0,
      methods,
      missing
    }
  }

  function readinessSummary ({ qvac, tetherWdk, compliance }) {
    const sdkReady = qvac.sdkReady && tetherWdk.sdkReady
    const complianceReady = compliance.realMoneyEnabled &&
      compliance.kycVerified &&
      compliance.jurisdictionAllowed &&
      compliance.responsiblePlayAccepted

    if (sdkReady && complianceReady) {
      return {
        status: 'live-ready',
        label: 'Live settlement ready',
        tone: 'ready',
        realMoneyEnabled: true
      }
    }

    if (sdkReady) {
      return {
        status: 'compliance-locked',
        label: 'SDK ready, prizes locked',
        tone: 'warn',
        realMoneyEnabled: false
      }
    }

    return {
      status: 'demo-locked',
      label: 'Demo settlement locked',
      tone: 'locked',
      realMoneyEnabled: false
    }
  }

  function createRuntimeConfig ({
    rootObject = root,
    qvac,
    qvacCommentary,
    tetherWdk,
    sdkPackages,
    compliance,
    forceDemo = false
  } = {}) {
    const detected = forceDemo ? { qvac: null, tetherWdk: null } : detectSdkGlobals(rootObject)
    const runtimeOptions = forceDemo ? { sdkPackages: null } : runtimeOptionsFor(rootObject, sdkPackages)
    const packageAdapters = runtimeOptions.sdkPackages ? createPackageAdapters(rootObject, runtimeOptions.sdkPackages) : {}
    let selectedQvac = forceDemo ? null : (qvac || (detected.qvac && detected.qvac.client))
    let selectedQvacDetected = detected.qvac
    if (
      !forceDemo &&
      !selectedQvac &&
      detected.qvacCompletion &&
      qvacRefereeFactory &&
      typeof qvacRefereeFactory.createQvacCompletionRefereeAdapter === 'function'
    ) {
      selectedQvac = qvacRefereeFactory.createQvacCompletionRefereeAdapter({
        client: detected.qvacCompletion.client,
        modelId: rootObject.PearCupQvacModelId || root.PearCupQvacModelId
      })
      selectedQvacDetected = detected.qvacCompletion
    }
    if (!forceDemo && !selectedQvac && packageAdapters.qvac) {
      selectedQvac = packageAdapters.qvac.client
      selectedQvacDetected = packageAdapters.qvac.detected
    }

    let selectedQvacCommentary = forceDemo ? null : qvacCommentary
    if (
      !forceDemo &&
      !selectedQvacCommentary &&
      detected.qvacCompletion &&
      qvacRefereeFactory &&
      typeof qvacRefereeFactory.createQvacCompletionCommentaryAdapter === 'function'
    ) {
      selectedQvacCommentary = qvacRefereeFactory.createQvacCompletionCommentaryAdapter({
        client: detected.qvacCompletion.client,
        modelId: rootObject.PearCupQvacCommentaryModelId || rootObject.PearCupQvacModelId || root.PearCupQvacCommentaryModelId || root.PearCupQvacModelId
      })
    }
    if (!forceDemo && !selectedQvacCommentary && packageAdapters.qvacCommentary) {
      selectedQvacCommentary = packageAdapters.qvacCommentary.client
    }

    let selectedTetherWdk = forceDemo ? null : (tetherWdk || (detected.tetherWdk && detected.tetherWdk.client))
    let selectedTetherWdkDetected = detected.tetherWdk
    if (
      !forceDemo &&
      !selectedTetherWdk &&
      detected.tetherWdkProcessor &&
      tetherWdkBridgeFactory &&
      typeof tetherWdkBridgeFactory.createTetherWdkProcessorAdapter === 'function'
    ) {
      selectedTetherWdk = tetherWdkBridgeFactory.createTetherWdkProcessorAdapter({
        processor: detected.tetherWdkProcessor.client
      })
      selectedTetherWdkDetected = detected.tetherWdkProcessor
    }
    if (!forceDemo && !selectedTetherWdk && packageAdapters.tetherWdk) {
      selectedTetherWdk = packageAdapters.tetherWdk.client
      selectedTetherWdkDetected = packageAdapters.tetherWdk.detected
    }

    const runtimeAdapters = adapterFactory.createIntegrationAdapters({
      qvac: hasRequiredMethods(selectedQvac, qvacRequiredMethods) ? selectedQvac : null,
      tetherWdk: hasRequiredMethods(selectedTetherWdk, tetherWdkRequiredMethods) ? selectedTetherWdk : null,
      qvacCommentary: hasRequiredMethods(selectedQvacCommentary, qvacCommentaryRequiredMethods) ? selectedQvacCommentary : null
    })
    const normalizedCompliance = normalizeCompliance(compliance || runtimeOptions.compliance || rootObject.PearCupCompliance || root.PearCupCompliance || {})
    const qvacReadiness = createServiceReadiness({
      key: 'qvac',
      label: 'QVAC referee',
      adapter: runtimeAdapters.qvac,
      detected: selectedQvacDetected,
      explicitClient: qvac,
      requiredMethods: qvacRequiredMethods
    })
    const tetherReadiness = createServiceReadiness({
      key: 'tetherWdk',
      label: 'Tether WDK rail',
      adapter: runtimeAdapters.tetherWdk,
      detected: selectedTetherWdkDetected,
      explicitClient: tetherWdk,
      requiredMethods: tetherWdkRequiredMethods,
      optionalMethods: tetherWdkOptionalMethods
    })
    const settlement = readinessSummary({
      qvac: qvacReadiness,
      tetherWdk: tetherReadiness,
      compliance: normalizedCompliance
    })

    function createWorker ({ workerFactory = root.PearCupWorkerSim, events = [], storage } = {}) {
      if (!workerFactory || typeof workerFactory.createWorkerSim !== 'function') {
        throw new Error('createWorker requires PearCupWorkerSim.createWorkerSim')
      }
      return workerFactory.createWorkerSim({ events, adapters: runtimeAdapters, storage })
    }

    async function close () {
      await Promise.all([
        runtimeAdapters.qvac && typeof runtimeAdapters.qvac.close === 'function' ? runtimeAdapters.qvac.close() : null,
        runtimeAdapters.tetherWdk && typeof runtimeAdapters.tetherWdk.close === 'function' ? runtimeAdapters.tetherWdk.close() : null,
        runtimeAdapters.qvacCommentary && typeof runtimeAdapters.qvacCommentary.close === 'function' ? runtimeAdapters.qvacCommentary.close() : null
      ])
    }

    return {
      adapters: runtimeAdapters,
      mode: { ...runtimeAdapters.mode },
      readiness: {
        qvac: qvacReadiness,
        tetherWdk: tetherReadiness,
        compliance: normalizedCompliance,
        settlement
      },
      canUseRealMoney: settlement.realMoneyEnabled,
      createWorker,
      close
    }
  }

  const api = {
    qvacRequiredMethods,
    tetherWdkRequiredMethods,
    tetherWdkOptionalMethods,
    detectSdkGlobals,
    hasRequiredMethods,
    createPackageAdapters,
    createRuntimeConfig
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupRuntimeConfig = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupRuntimeConfig = 'runtime-config-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./settlement-receipts.js */
(function attachPearCupSettlementReceipts (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const core = root.PearCupCore || (canRequireLocal ? require('./core.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupSettlementReceipts')

  const receiptVersion = 'pearcup-settlement-receipt-v1'

  function clone (value) {
    return value == null ? null : JSON.parse(JSON.stringify(value))
  }

  function listHash (value) {
    return core.deterministicHash(Array.isArray(value) ? value.map(item => String(item)).sort() : [])
  }

  function eventRef (event) {
    if (!event) return null
    return {
      eventId: event.eventId,
      type: event.type,
      actorId: event.actorId || null,
      sequence: event.sequence,
      payloadHash: core.deterministicHash(event.payload || null)
    }
  }

  function serviceReadinessSnapshot (readiness = {}) {
    return {
      key: readiness.key || 'unknown',
      label: readiness.label || 'unknown',
      mode: readiness.mode || 'unknown',
      adapterId: readiness.adapterId || null,
      source: readiness.source || 'unknown',
      sdkDetected: readiness.sdkDetected === true,
      sdkReady: readiness.sdkReady === true,
      missing: Array.isArray(readiness.missing) ? [...readiness.missing] : []
    }
  }

  function settingsSnapshot (settings = {}) {
    return {
      source: settings.source
        ? {
            path: settings.source.path || null,
            loaded: settings.source.loaded === true
          }
        : { path: null, loaded: false },
      redactedHash: core.deterministicHash(settings || {}),
      qvacConfigured: Boolean(settings.sdkPackages && settings.sdkPackages.qvac),
      tetherWdkConfigured: Boolean(settings.sdkPackages && settings.sdkPackages.tetherWdk),
      tetherWdkSeedRedacted: Boolean(
        settings.sdkPackages &&
        settings.sdkPackages.tetherWdk &&
        settings.sdkPackages.tetherWdk.seedPhrase === '[redacted]'
      )
    }
  }

  function createRuntimeProvenance ({ status = {}, settings = status.settings || {} } = {}) {
    const readiness = status.readiness || {}
    return {
      runtimeId: status.id || 'pearcup-worker-runtime',
      mode: clone(status.mode || {}),
      guardMode: status.guardMode || 'unknown',
      canUseRealMoney: status.canUseRealMoney === true,
      settings: settingsSnapshot(settings),
      qvac: serviceReadinessSnapshot(readiness.qvac),
      tetherWdk: serviceReadinessSnapshot(readiness.tetherWdk),
      compliance: clone(readiness.compliance || {}),
      settlement: clone(readiness.settlement || {}),
      secrets: {
        wdkSeedExposed: status.secrets && status.secrets.wdkSeedExposed === true,
        wdkSeedRedacted: Boolean(
          settings &&
          settings.sdkPackages &&
          settings.sdkPackages.tetherWdk &&
          settings.sdkPackages.tetherWdk.seedPhrase === '[redacted]'
        )
      }
    }
  }

  function inferSettlementType (summary = {}) {
    if (summary.roundEvent || summary.type === 'TrustedGameSettlementCompleted' || summary.type === 'TrustedGameSettlementHeld') return 'game-round'
    if (summary.poolResultEvent || summary.type === 'TrustedPoolSettlementCompleted' || summary.type === 'TrustedPoolSettlementHeld') return 'bracket-pool'
    return 'unknown'
  }

  function gateSnapshot (gate = {}) {
    return {
      liveReady: gate.liveReady === true,
      status: gate.status || 'unknown',
      label: gate.label || 'Settlement readiness unknown',
      tone: gate.tone || 'locked',
      mode: clone(gate.mode || {}),
      missing: Array.isArray(gate.missing)
        ? gate.missing.map(item => ({
            key: item.key || 'unknown',
            label: item.label || 'unknown',
            source: item.source || 'unknown'
          }))
        : []
    }
  }

  function qvacSnapshot (attestationEvent) {
    const attestation = attestationEvent && attestationEvent.payload
    if (!attestation) return null
    return {
      eventId: attestationEvent.eventId,
      eventType: attestationEvent.type,
      eventActorId: attestationEvent.actorId || null,
      attestationId: attestation.attestationId,
      refereeId: attestation.refereeId || null,
      ruling: attestation.ruling,
      stateHash: attestation.stateHash,
      officialResultsHash: attestation.officialResultsHash || null,
      confidence: attestation.confidence,
      sourceEventIdsHash: listHash(attestation.sourceEventIds),
      sourcePaymentIdsHash: attestation.sourcePaymentIds ? listHash(attestation.sourcePaymentIds) : null,
      sourceBracketSubmissionIdsHash: attestation.sourceBracketSubmissionIds ? listHash(attestation.sourceBracketSubmissionIds) : null,
      bracketScoreboardHash: attestation.bracketScoreboardHash || null,
      bracketResolvedBy: attestation.bracketResolvedBy || null,
      winnerUserIdHash: attestation.winnerUserId ? core.deterministicHash(String(attestation.winnerUserId)) : null,
      winnerUserIdsHash: attestation.winnerUserIds ? listHash(attestation.winnerUserIds) : null,
      participantUserIdsHash: attestation.participantUserIds ? listHash(attestation.participantUserIds) : null
    }
  }

  function processorTransferSnapshot (transfer = {}) {
    return {
      userIdHash: transfer.userId ? core.deterministicHash(String(transfer.userId)) : null,
      recipientHash: transfer.recipient ? core.deterministicHash(String(transfer.recipient)) : null,
      referenceHash: transfer.reference ? core.deterministicHash(String(transfer.reference)) : null,
      status: transfer.status || null,
      asset: transfer.asset || null,
      chain: transfer.chain || null,
      sourceAccountIndex: transfer.sourceAccountIndex == null ? null : transfer.sourceAccountIndex,
      amount: transfer.amount == null ? null : transfer.amount,
      baseAmount: transfer.baseAmount == null ? null : String(transfer.baseAmount),
      tokenHash: transfer.token ? core.deterministicHash(String(transfer.token)) : null,
      broadcast: transfer.broadcast === true,
      hash: transfer.hash || null,
      fee: transfer.fee == null ? null : String(transfer.fee)
    }
  }

  function transferStatusCounts (transfers = []) {
    return transfers.reduce((counts, transfer) => {
      const status = transfer.status || 'unknown'
      counts[status] = (counts[status] || 0) + 1
      return counts
    }, {})
  }

  function processorEvidenceSnapshot (processor = null) {
    if (!processor) return null
    const transfers = Array.isArray(processor.transfers)
      ? processor.transfers.map(processorTransferSnapshot)
      : []
    return {
      id: processor.id || null,
      status: processor.status || null,
      poolId: processor.poolId || null,
      escrowId: processor.escrowId || null,
      winnerUserIdHash: processor.winnerUserId ? core.deterministicHash(String(processor.winnerUserId)) : null,
      broadcast: processor.broadcast === true,
      missingRecipientUserIdsHash: processor.missingRecipientUserIds ? listHash(processor.missingRecipientUserIds) : null,
      transferCount: transfers.length,
      transferStatuses: transferStatusCounts(transfers),
      transfersHash: core.deterministicHash(transfers),
      transfers
    }
  }

  function wdkSnapshot (settlementEvent) {
    const settlement = settlementEvent && settlementEvent.payload
    if (!settlement) return null
    return {
      eventId: settlementEvent.eventId,
      eventType: settlementEvent.type,
      eventActorId: settlementEvent.actorId || null,
      status: settlement.status || null,
      payoutId: settlement.payoutId || null,
      disputeId: settlement.disputeId || null,
      refundId: settlement.refundId || null,
      escrowId: settlement.escrowId || null,
      poolId: settlement.poolId || null,
      qvacAttestationId: settlement.qvacAttestationId || null,
      winnerUserId: settlement.winnerUserId || null,
      winnerUserIds: settlement.winnerUserIds || null,
      refundUserIdsHash: settlement.refundUserIds ? listHash(settlement.refundUserIds) : null,
      sourcePaymentIdsHash: settlement.sourcePaymentIds ? listHash(settlement.sourcePaymentIds) : null,
      grossPool: settlement.grossPool == null ? null : settlement.grossPool,
      amountEach: settlement.amountEach == null ? null : settlement.amountEach,
      asset: settlement.asset || null,
      rail: settlement.rail || null,
      reason: settlement.reason || null,
      processorPayout: processorEvidenceSnapshot(settlement.processorPayout),
      processorRelease: processorEvidenceSnapshot(settlement.processorRelease),
      processorRefund: processorEvidenceSnapshot(settlement.processorRefund)
    }
  }

  function gameSnapshot (roundEvent) {
    const round = roundEvent && roundEvent.payload
    if (!round) return null
    return {
      gameId: round.gameId,
      roundId: round.roundId,
      resolverVersion: round.resolverVersion,
      outcome: round.outcome,
      stateHash: round.stateHash,
      sourceEventIdsHash: listHash(round.sourceEventIds),
      shooterId: round.shooter && round.shooter.id,
      keeperId: round.keeper && round.keeper.id
    }
  }

  function poolSnapshot (poolResultEvent) {
    const pool = poolResultEvent && poolResultEvent.payload
    if (!pool) return null
    return {
      poolId: pool.poolId,
      rulesVersion: pool.rulesVersion,
      ruling: pool.ruling,
      stateHash: pool.stateHash,
      officialResultsHash: pool.officialResultsHash || core.deterministicHash(pool.officialResults || {}),
      sourceEventMode: pool.sourceEventMode || null,
      entryCount: pool.entryCount,
      winnerUserIdsHash: listHash(pool.winnerUserIds),
      sourcePaymentIdsHash: listHash(pool.sourcePaymentIds),
      sourceBracketSubmissionIdsHash: pool.sourceBracketSubmissionIds ? listHash(pool.sourceBracketSubmissionIds) : null,
      bracketScoreboardHash: pool.bracketScoreboardHash || null,
      bracketResolvedBy: pool.bracketResolvedBy || null,
      sourceEventIdsHash: listHash(pool.sourceEventIds)
    }
  }

  function payoutRecipientDeclarationSnapshot (events = []) {
    const declarations = events.map(event => {
      const payload = event && event.payload || {}
      return {
        eventId: event.eventId,
        type: event.type,
        sequence: event.sequence,
        poolId: payload.poolId || null,
        userIdHash: payload.userId ? core.deterministicHash(String(payload.userId)) : null,
        recipientHash: payload.recipientHash || (payload.recipient ? core.deterministicHash(String(payload.recipient)) : null),
        asset: payload.asset || null,
        status: payload.status || null
      }
    })
    return {
      count: declarations.length,
      declarationsHash: core.deterministicHash(declarations),
      declarations
    }
  }

  function verifyProcessorEvidence ({ processor, label, errors }) {
    if (!processor) return
    const transfers = Array.isArray(processor.transfers) ? processor.transfers : []
    if (processor.transferCount !== transfers.length) {
      errors.push(`Settlement receipt WDK processor ${label} transfer count does not match transfers`)
    }
    if (processor.transfersHash !== core.deterministicHash(transfers)) {
      errors.push(`Settlement receipt WDK processor ${label} transfer hash does not match transfers`)
    }
    if (core.deterministicHash(processor.transferStatuses || {}) !== core.deterministicHash(transferStatusCounts(transfers))) {
      errors.push(`Settlement receipt WDK processor ${label} transfer status counts do not match transfers`)
    }
  }

  function verifyCompletedEventShape ({ payload, expected, errors }) {
    if (!payload.completed) return
    if (payload.summaryType !== expected.summaryType) {
      errors.push(`Settlement receipt completed path requires ${expected.summaryType}`)
    }
    if (payload.status !== 'prepared') {
      errors.push('Settlement receipt completed path requires prepared settlement status')
    }
    if (!payload.events || !payload.events.result || payload.events.result.type !== expected.resultType) {
      errors.push(`Settlement receipt completed path requires ${expected.resultType} result event`)
    }
    if (!payload.events || !payload.events.attestation || payload.events.attestation.type !== expected.attestationType) {
      errors.push(`Settlement receipt completed path requires ${expected.attestationType} event`)
    }
    if (!payload.events || !payload.events.settlement || payload.events.settlement.type !== expected.settlementType) {
      errors.push(`Settlement receipt completed path requires ${expected.settlementType} event`)
    }
    if (!payload.events || !payload.events.attestation || !payload.events.attestation.actorId) {
      errors.push('Settlement receipt QVAC event ref must include actorId')
    }
    if (!payload.events || !payload.events.settlement || !payload.events.settlement.actorId) {
      errors.push('Settlement receipt WDK event ref must include actorId')
    }
    if (!payload.qvac || payload.qvac.eventType !== expected.attestationType) {
      errors.push(`Settlement receipt QVAC snapshot must reference ${expected.attestationType}`)
    }
    if (!payload.qvac || payload.qvac.ruling === 'disputed') {
      errors.push('Settlement receipt completed path requires non-disputed QVAC ruling')
    }
    if (expected.qvacRuling && (!payload.qvac || payload.qvac.ruling !== expected.qvacRuling)) {
      errors.push(`Settlement receipt completed path requires ${expected.qvacRuling} QVAC ruling`)
    }
    if (!payload.wdk || payload.wdk.eventType !== expected.settlementType) {
      errors.push(`Settlement receipt WDK snapshot must reference ${expected.settlementType}`)
    }
    if (!payload.wdk || payload.wdk.status !== 'prepared') {
      errors.push('Settlement receipt completed path requires prepared WDK settlement status')
    }
    if (
      payload.qvac &&
      payload.events &&
      payload.events.attestation &&
      payload.qvac.eventActorId !== payload.events.attestation.actorId
    ) {
      errors.push('Settlement receipt QVAC snapshot actorId does not match event ref')
    }
    if (
      payload.wdk &&
      payload.events &&
      payload.events.settlement &&
      payload.wdk.eventActorId !== payload.events.settlement.actorId
    ) {
      errors.push('Settlement receipt WDK snapshot actorId does not match event ref')
    }
  }

  function verifyCompletedTrustedPath ({ payload, errors }) {
    if (!payload || payload.completed !== true) return
    if (!payload.qvac || !payload.qvac.attestationId) {
      errors.push('Settlement receipt completed path requires QVAC attestation id')
    }
    if (!payload.qvac || !payload.qvac.eventActorId) {
      errors.push('Settlement receipt completed path requires QVAC event actorId')
    }
    if (!payload.qvac || !payload.qvac.refereeId) {
      errors.push('Settlement receipt completed path requires QVAC referee id')
    }
    if (payload.qvac && payload.qvac.eventActorId && payload.qvac.refereeId && payload.qvac.eventActorId !== payload.qvac.refereeId) {
      errors.push('Settlement receipt QVAC event actorId must match referee id')
    }
    if (!payload.wdk || !payload.wdk.qvacAttestationId) {
      errors.push('Settlement receipt WDK settlement must reference QVAC attestation id')
    }
    if (!payload.wdk || !payload.wdk.eventActorId) {
      errors.push('Settlement receipt completed path requires WDK event actorId')
    }
    if (!payload.wdk || !payload.wdk.rail) {
      errors.push('Settlement receipt completed path requires WDK rail')
    }
    if (payload.wdk && payload.wdk.eventActorId && payload.wdk.rail && payload.wdk.eventActorId !== payload.wdk.rail) {
      errors.push('Settlement receipt WDK event actorId must match rail')
    }
    if (payload.qvac && payload.wdk && payload.qvac.attestationId !== payload.wdk.qvacAttestationId) {
      errors.push('Settlement receipt QVAC attestation id does not match WDK settlement')
    }

    if (payload.settlementType === 'game-round') {
      verifyCompletedEventShape({
        payload,
        expected: {
          summaryType: 'TrustedGameSettlementCompleted',
          resultType: 'GameRoundResolved',
          attestationType: 'QvacRefereeAttestationCreated',
          settlementType: 'TetherWdkEscrowReleased',
          qvacRuling: null
        },
        errors
      })
      const qvacWinnerHash = payload.qvac && payload.qvac.winnerUserIdHash
      const wdkWinnerHash = payload.wdk && payload.wdk.winnerUserId
        ? core.deterministicHash(String(payload.wdk.winnerUserId))
        : null
      const processorWinnerHash = payload.wdk &&
        payload.wdk.processorRelease &&
        payload.wdk.processorRelease.winnerUserIdHash
      const gameParticipantHash = payload.game && payload.game.shooterId && payload.game.keeperId
        ? listHash([payload.game.shooterId, payload.game.keeperId])
        : null

      if (!qvacWinnerHash) errors.push('Settlement receipt game path requires QVAC winner hash')
      if (!wdkWinnerHash) errors.push('Settlement receipt game path requires WDK winner user id')
      if (qvacWinnerHash && wdkWinnerHash && qvacWinnerHash !== wdkWinnerHash) {
        errors.push('Settlement receipt WDK winner does not match QVAC winner')
      }
      if (processorWinnerHash && qvacWinnerHash && processorWinnerHash !== qvacWinnerHash) {
        errors.push('Settlement receipt WDK processor release winner does not match QVAC winner')
      }
      if (!payload.qvac || !payload.qvac.participantUserIdsHash) {
        errors.push('Settlement receipt game path requires QVAC participant hash')
      } else if (gameParticipantHash && payload.qvac.participantUserIdsHash !== gameParticipantHash) {
        errors.push('Settlement receipt QVAC participants do not match game participants')
      }
      if (payload.qvac && payload.game && payload.qvac.sourceEventIdsHash !== payload.game.sourceEventIdsHash) {
        errors.push('Settlement receipt QVAC source events do not match game result')
      }
    }

    if (payload.settlementType === 'bracket-pool') {
      verifyCompletedEventShape({
        payload,
        expected: {
          summaryType: 'TrustedPoolSettlementCompleted',
          resultType: 'BracketPoolSettlementResolved',
          attestationType: 'QvacPoolSettlementAttestationCreated',
          settlementType: 'TetherWdkPoolPayoutPrepared',
          qvacRuling: 'verified'
        },
        errors
      })
      const wdkWinnerIdsHash = payload.wdk && payload.wdk.winnerUserIds ? listHash(payload.wdk.winnerUserIds) : null
      if (!payload.qvac || !payload.qvac.winnerUserIdsHash) {
        errors.push('Settlement receipt pool path requires QVAC winner ids hash')
      }
      if (!payload.pool || !payload.pool.winnerUserIdsHash) {
        errors.push('Settlement receipt pool path requires pool winner ids hash')
      }
      if (!payload.qvac || !payload.qvac.officialResultsHash) {
        errors.push('Settlement receipt pool path requires QVAC official results hash')
      }
      if (!payload.pool || !payload.pool.officialResultsHash) {
        errors.push('Settlement receipt pool path requires pool official results hash')
      }
      if (payload.qvac && payload.pool && payload.qvac.winnerUserIdsHash !== payload.pool.winnerUserIdsHash) {
        errors.push('Settlement receipt QVAC pool winners do not match pool result')
      }
      if (payload.qvac && payload.pool && payload.qvac.officialResultsHash !== payload.pool.officialResultsHash) {
        errors.push('Settlement receipt QVAC official results do not match pool result')
      }
      if (payload.qvac && wdkWinnerIdsHash && payload.qvac.winnerUserIdsHash !== wdkWinnerIdsHash) {
        errors.push('Settlement receipt WDK pool winners do not match QVAC winners')
      }
      if (payload.qvac && payload.pool && payload.qvac.sourcePaymentIdsHash !== payload.pool.sourcePaymentIdsHash) {
        errors.push('Settlement receipt QVAC payment evidence does not match pool result')
      }
      if (payload.pool && payload.pool.sourceBracketSubmissionIdsHash) {
        if (!payload.qvac || payload.qvac.sourceBracketSubmissionIdsHash !== payload.pool.sourceBracketSubmissionIdsHash) {
          errors.push('Settlement receipt QVAC bracket submission evidence does not match pool result')
        }
        if (payload.qvac && payload.qvac.bracketScoreboardHash !== payload.pool.bracketScoreboardHash) {
          errors.push('Settlement receipt QVAC bracket scoreboard does not match pool result')
        }
      }
      if (payload.qvac && payload.pool && payload.qvac.sourceEventIdsHash !== payload.pool.sourceEventIdsHash) {
        errors.push('Settlement receipt QVAC source events do not match pool result')
      }
      if (payload.wdk && payload.pool && payload.wdk.sourcePaymentIdsHash && payload.wdk.sourcePaymentIdsHash !== payload.pool.sourcePaymentIdsHash) {
        errors.push('Settlement receipt WDK payment evidence does not match pool result')
      }
    }
  }

  function createSettlementReceipt ({
    summary,
    eventRoot = null,
    gate = {},
    mode = null,
    runtimeId = 'pearcup-worker-runtime',
    provenance = null
  } = {}) {
    if (!summary) throw new Error('Settlement summary is required for a receipt')
    const settlementType = inferSettlementType(summary)
    const resultEvent = summary.roundEvent || summary.poolResultEvent || null
    const gateState = gateSnapshot({
      ...gate,
      mode: mode || gate.mode
    })
    const payload = {
      receiptVersion,
      createdAt: '2026-07-01T00:00:00.000Z',
      trustedPath: 'qvac-referee-to-tether-wdk',
      runtimeId,
      settlementType,
      summaryType: summary.type || null,
      status: summary.status || 'unknown',
      completed: summary.type === 'TrustedGameSettlementCompleted' || summary.type === 'TrustedPoolSettlementCompleted',
      eventRoot,
      gate: gateState,
      provenance: provenance ? clone(provenance) : null,
      events: {
        result: eventRef(resultEvent),
        attestation: eventRef(summary.attestationEvent),
        settlement: eventRef(summary.settlementEvent)
      },
      game: settlementType === 'game-round' ? gameSnapshot(summary.roundEvent) : null,
      pool: settlementType === 'bracket-pool' ? poolSnapshot(summary.poolResultEvent) : null,
      payoutRecipients: settlementType === 'bracket-pool'
        ? payoutRecipientDeclarationSnapshot(summary.recipientDeclarationEvents || [])
        : null,
      qvac: qvacSnapshot(summary.attestationEvent),
      wdk: wdkSnapshot(summary.settlementEvent)
    }
    const receiptHash = core.deterministicHash(payload)
    return {
      receiptId: core.deterministicHash({ receiptVersion, receiptHash }),
      receiptHash,
      ...payload
    }
  }

  function verifySettlementReceipt (receipt) {
    const errors = []
    if (!receipt) {
      return { ok: false, errors: ['Settlement receipt is required'] }
    }
    const { receiptId, receiptHash, ...payload } = receipt
    const expectedHash = core.deterministicHash(payload)
    const expectedId = core.deterministicHash({ receiptVersion: payload.receiptVersion, receiptHash: expectedHash })
    if (payload.receiptVersion !== receiptVersion) errors.push('Settlement receipt version is unsupported')
    if (receiptHash !== expectedHash) errors.push('Settlement receipt hash does not match payload')
    if (receiptId !== expectedId) errors.push('Settlement receipt id does not match hash')
    if (!payload.eventRoot) errors.push('Settlement receipt event root is required')
    if (!payload.events || !payload.events.attestation) errors.push('Settlement receipt QVAC attestation event is required')
    if (!payload.events || !payload.events.settlement) errors.push('Settlement receipt WDK settlement event is required')
    if (payload.provenance && payload.provenance.secrets && payload.provenance.secrets.wdkSeedExposed === true) {
      errors.push('Settlement receipt provenance reports exposed WDK seed material')
    }
    verifyCompletedTrustedPath({ payload, errors })
    if (payload.wdk) {
      verifyProcessorEvidence({
        processor: payload.wdk.processorPayout,
        label: 'payout',
        errors
      })
      verifyProcessorEvidence({
        processor: payload.wdk.processorRelease,
        label: 'release',
        errors
      })
      verifyProcessorEvidence({
        processor: payload.wdk.processorRefund,
        label: 'refund',
        errors
      })
    }
    if (
      payload.payoutRecipients &&
      payload.payoutRecipients.count !== payload.payoutRecipients.declarations.length
    ) {
      errors.push('Settlement receipt payout recipient declaration count does not match declarations')
    }
    if (
      payload.payoutRecipients &&
      payload.payoutRecipients.declarationsHash !== core.deterministicHash(payload.payoutRecipients.declarations)
    ) {
      errors.push('Settlement receipt payout recipient declaration hash does not match declarations')
    }
    return { ok: errors.length === 0, errors }
  }

  const api = {
    receiptVersion,
    createSettlementReceipt,
    verifySettlementReceipt,
    createRuntimeProvenance,
    eventRef,
    listHash,
    transferStatusCounts
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupSettlementReceipts = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupSettlementReceipts = receiptVersion
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./worker-sim.js */
(function attachPearCupWorkerSim (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const core = root.PearCupCore || (canRequireLocal ? require('./core.js') : null)
  const adapterFactory = root.PearCupAdapters || (canRequireLocal ? require('./adapters.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupWorkerSim')
  if (!adapterFactory) throw new Error('PearCupAdapters is required before PearCupWorkerSim')

  function getSettlementReceipts () {
    return root.PearCupSettlementReceipts || (canRequireLocal ? require('./settlement-receipts.js') : null)
  }

  function eventEnvelope ({ type, actorId = 'system', payload, previousEventId = null, sequence }) {
    const createdAt = `2026-07-01T00:00:${String(sequence).padStart(2, '0')}.000Z`
    const unsigned = { type, actorId, payload, previousEventId, sequence, createdAt }
    const eventId = core.deterministicHash(unsigned)
    return {
      eventId,
      type,
      version: 1,
      actorId,
      deviceId: 'local-worker-sim',
      sequence,
      createdAt,
      payload,
      previousEventId,
      signature: core.deterministicHash({ eventId, unsigned, signer: actorId })
    }
  }

  function eventCreatedAtForSequence (sequence) {
    return `2026-07-01T00:00:${String(sequence).padStart(2, '0')}.000Z`
  }

  function validateEventEnvelope (event) {
    const errors = []
    if (!event || typeof event !== 'object') {
      return { ok: false, errors: ['event envelope is required'] }
    }
    if (event.version !== 1) errors.push('event version must be 1')
    if (!event.type || typeof event.type !== 'string') errors.push('event type is required')
    if (!event.actorId || typeof event.actorId !== 'string') errors.push('event actorId is required')
    if (!Number.isInteger(event.sequence) || event.sequence < 1) errors.push('event sequence must be a positive integer')
    if (event.previousEventId !== null && event.previousEventId !== undefined && typeof event.previousEventId !== 'string') {
      errors.push('event previousEventId must be null or a string')
    }
    if (event.payload === undefined) errors.push('event payload is required')

    const expectedCreatedAt = Number.isInteger(event.sequence)
      ? eventCreatedAtForSequence(event.sequence)
      : null
    if (expectedCreatedAt && event.createdAt !== expectedCreatedAt) {
      errors.push('event createdAt does not match sequence')
    }

    if (errors.length) return { ok: false, errors }

    const unsigned = {
      type: event.type,
      actorId: event.actorId,
      payload: event.payload,
      previousEventId: event.previousEventId == null ? null : event.previousEventId,
      sequence: event.sequence,
      createdAt: event.createdAt
    }
    const expectedEventId = core.deterministicHash(unsigned)
    if (event.eventId !== expectedEventId) errors.push('eventId does not match event payload')
    const expectedSignature = core.deterministicHash({
      eventId: expectedEventId,
      unsigned,
      signer: event.actorId
    })
    if (event.signature !== expectedSignature) errors.push('event signature does not match event payload')

    return {
      ok: errors.length === 0,
      errors,
      expectedEventId,
      expectedSignature
    }
  }

  function eventRoot (events) {
    return core.deterministicHash(events
      .map(event => ({
        eventId: event.eventId,
        signature: event.signature,
        type: event.type
      }))
      .sort((a, b) => a.eventId.localeCompare(b.eventId)))
  }

  function typeCounts (events) {
    return events.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] || 0) + 1
      return counts
    }, {})
  }

  function eventIndex (events = []) {
    const byId = new Map()
    const byType = new Map()
    for (const event of events) {
      if (!event || !event.eventId) continue
      byId.set(event.eventId, event)
      if (!byType.has(event.type)) byType.set(event.type, [])
      byType.get(event.type).push(event)
    }
    return { byId, byType }
  }

  function findIndexedEvent (index, type, predicate) {
    const events = index.byType.get(type) || []
    return events.find(event => predicate(event.payload || {}, event))
  }

  function indexedSourceEventsPresent (index, sourceEventIds = []) {
    return Array.isArray(sourceEventIds) && sourceEventIds.every(eventId => index.byId.has(eventId))
  }

  function sortedStrings (value = []) {
    return Array.isArray(value) ? value.map(item => String(item)).sort() : []
  }

  function sameStringList (left, right) {
    const leftItems = sortedStrings(left)
    const rightItems = sortedStrings(right)
    return leftItems.length === rightItems.length && leftItems.every((item, index) => item === rightItems[index])
  }

  function normalizeLanguage (language) {
    const normalized = String(language || 'EN')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16)
    return normalized || 'EN'
  }

  function normalizeMatchEventPayload (payload = {}, actorId = 'sports-feed') {
    const sourceActorId = payload.sourceActorId || actorId
    const normalized = {
      matchId: payload.matchId || null,
      clock: payload.clock || '00:00',
      period: payload.period || '2H',
      type: payload.type || 'commentary_seed',
      teamId: payload.teamId || null,
      playerId: payload.playerId || null,
      value: payload.value === undefined ? null : payload.value,
      x: payload.x === undefined ? null : payload.x,
      y: payload.y === undefined ? null : payload.y,
      createdAt: payload.createdAt || '2026-07-01T00:00:00.000Z',
      sourceActorId
    }
    return {
      eventId: payload.eventId || core.deterministicHash(normalized),
      ...normalized
    }
  }

  function matchEventSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.sourceActorId && event.actorId === payload.sourceActorId)
  }

  function emptyStatSnapshot (matchId) {
    return {
      matchId,
      clock: '00:00',
      score: {},
      possession: {},
      shots: {},
      shotsOnTarget: {},
      xg: {},
      corners: {},
      saves: {},
      threat: {}
    }
  }

  function ensureTeamStats (stats, teamId) {
    if (!teamId) return
    for (const key of ['score', 'possession', 'shots', 'shotsOnTarget', 'xg', 'corners', 'saves']) {
      if (stats[key][teamId] == null) stats[key][teamId] = 0
    }
    if (!stats.threat[teamId]) stats.threat[teamId] = 'low'
  }

  function applyMatchEventToStats (stats, event = {}) {
    const teamId = event.teamId || null
    if (event.clock) stats.clock = event.clock
    if (!teamId) return stats
    ensureTeamStats(stats, teamId)
    const numericValue = Number(event.value)
    if (event.type === 'goal') {
      stats.score[teamId] += 1
      stats.shots[teamId] += 1
      stats.shotsOnTarget[teamId] += 1
      if (Number.isFinite(numericValue)) stats.xg[teamId] = Number((stats.xg[teamId] + numericValue).toFixed(2))
    }
    if (event.type === 'shot') {
      stats.shots[teamId] += 1
      if (event.value === 'on-target' || Number.isFinite(numericValue)) stats.shotsOnTarget[teamId] += 1
      if (Number.isFinite(numericValue)) stats.xg[teamId] = Number((stats.xg[teamId] + numericValue).toFixed(2))
    }
    if (event.type === 'save') stats.saves[teamId] += 1
    if (event.type === 'possession' && Number.isFinite(numericValue)) {
      stats.possession[teamId] = Math.max(0, Math.min(100, numericValue))
    }
    const pressure = stats.shots[teamId] + stats.shotsOnTarget[teamId] + stats.xg[teamId]
    stats.threat[teamId] = pressure >= 6 ? 'high' : pressure >= 3 ? 'medium' : 'low'
    return stats
  }

  function statSnapshotForEvents (matchId, events = []) {
    const stats = emptyStatSnapshot(matchId)
    for (const event of events) applyMatchEventToStats(stats, event)
    stats.statHash = core.deterministicHash({
      matchId,
      sourceEventIds: events.map(event => event.sourceEventId || event.workerEventId || event.eventId),
      score: stats.score,
      possession: stats.possession,
      shots: stats.shots,
      shotsOnTarget: stats.shotsOnTarget,
      xg: stats.xg,
      corners: stats.corners,
      saves: stats.saves,
      threat: stats.threat
    })
    return stats
  }

  function commentarySignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.commentatorId && event.actorId === payload.commentatorId)
  }

  function commentarySegmentMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    if (!commentarySignerMatches(event)) return false
    if (!payload.matchId || !payload.language || !payload.segmentId) return false
    const sourceEventIds = Array.isArray(payload.sourceEventIds) ? payload.sourceEventIds : []
    if (sourceEventIds.length === 0) return false
    if (payload.eventHash !== core.deterministicHash(sourceEventIds)) return false
    const sourceEvents = sourceEventIds.map(eventId => index.byId.get(eventId))
    return sourceEvents.every(sourceEvent => {
      return sourceEvent &&
        sourceEvent.type === 'MatchEventIngested' &&
        sourceEvent.payload &&
        sourceEvent.payload.matchId === payload.matchId &&
        matchEventSignerMatches(sourceEvent)
    })
  }

  function payoutRecipientSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.userId && event.actorId === payload.userId)
  }

  function payoutRecipientSignerMismatchReason ({ actorId, userId }) {
    return `Payout recipient declaration actorId must match userId ${userId || 'unknown-user'} (received ${actorId || 'unknown-actor'})`
  }

  function bracketSubmissionSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.userId && event.actorId === payload.userId)
  }

  function bracketSubmissionSignerMismatchReason ({ actorId, userId }) {
    return `Bracket submission actorId must match userId ${userId || 'unknown-user'} (received ${actorId || 'unknown-actor'})`
  }

  function entryIntentSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.userId && event.actorId === payload.userId)
  }

  function entryIntentSignerMismatchReason ({ actorId, userId }) {
    return `Entry intent actorId must match userId ${userId || 'unknown-user'} (received ${actorId || 'unknown-actor'})`
  }

  function paymentMatchesSignedEntryIntent ({ payment, intentEvent }) {
    const intent = intentEvent && intentEvent.payload || null
    return Boolean(payment && intent && entryIntentSignerMatches(intentEvent) &&
      payment.intentId === intent.intentId &&
      payment.poolId === intent.poolId &&
      payment.entryId === intent.entryId &&
      payment.userId === intent.userId &&
      Number(payment.amount || 0) === Number(intent.amount || 0) &&
      payment.asset === intent.asset &&
      (!payment.rail || !intent.rail || payment.rail === intent.rail))
  }

  function entryPaymentRailFor ({ payment, intent } = {}) {
    return payment && payment.rail || intent && intent.rail || null
  }

  function entryPaymentSignerMatches ({ event, intentEvent }) {
    const payment = event && event.payload || null
    const intent = intentEvent && intentEvent.payload || null
    const rail = entryPaymentRailFor({ payment, intent })
    return Boolean(rail && event.actorId === rail)
  }

  function entryPaymentSignerMismatchReason ({ actorId, rail }) {
    return `Entry payment actorId must match WDK rail ${rail || 'unknown-rail'} (received ${actorId || 'unknown-actor'})`
  }

  function entryPaymentCheckMatchesSignedEntryIntent ({ check, intentEvent }) {
    return paymentMatchesSignedEntryIntent({ payment: check, intentEvent })
  }

  function entryPaymentCheckSignerMatches ({ event, intentEvent }) {
    return entryPaymentSignerMatches({ event, intentEvent })
  }

  function indexedEntryIntentEventForPayment (index, payment = {}) {
    return findIndexedEvent(index, 'TetherWdkEntryIntentCreated', intent => {
      return intent.intentId === payment.intentId
    })
  }

  function entryPaymentCheckMatchesReplay (event, index) {
    const check = event && event.payload || {}
    const intentEvent = indexedEntryIntentEventForPayment(index, check)
    return entryPaymentCheckMatchesSignedEntryIntent({ check, intentEvent }) &&
      entryPaymentCheckSignerMatches({ event, intentEvent })
  }

  function entryRefundMatchesConfirmedPayment ({ refund, paymentEvent }) {
    const payment = paymentEvent && paymentEvent.payload || null
    return Boolean(refund && payment &&
      refund.paymentId === payment.paymentId &&
      refund.intentId === payment.intentId &&
      refund.poolId === payment.poolId &&
      refund.entryId === payment.entryId &&
      refund.userId === payment.userId &&
      Number(refund.amount || 0) === Number(payment.amount || 0) &&
      refund.asset === payment.asset &&
      (!refund.rail || !payment.rail || refund.rail === payment.rail))
  }

  function entryRefundSignerMatches ({ event, paymentEvent }) {
    const refund = event && event.payload || null
    const payment = paymentEvent && paymentEvent.payload || null
    const rail = entryPaymentRailFor({ payment: refund, intent: payment })
    return Boolean(rail && event && event.actorId === rail)
  }

  function entryRefundSignerMismatchReason ({ actorId, rail }) {
    return `Entry refund actorId must match WDK rail ${rail || 'unknown-rail'} (received ${actorId || 'unknown-actor'})`
  }

  function indexedEntryPaymentEventForRefund (index, refund = {}) {
    return findIndexedEvent(index, 'TetherWdkEntryConfirmed', payment => {
      return payment.paymentId === refund.paymentId
    })
  }

  function entryRefundMatchesReplay (event, index) {
    const refund = event && event.payload || {}
    const paymentEvent = indexedEntryPaymentEventForRefund(index, refund)
    const payment = paymentEvent && paymentEvent.payload || {}
    const intentEvent = indexedEntryIntentEventForPayment(index, payment)
    return entryRefundMatchesConfirmedPayment({ refund, paymentEvent }) &&
      paymentMatchesSignedEntryIntent({ payment, intentEvent }) &&
      entryPaymentSignerMatches({ event: paymentEvent, intentEvent }) &&
      entryRefundSignerMatches({ event, paymentEvent })
  }

  function validEntryRefundEventForPayment (index, paymentId, poolId) {
    return findIndexedEvent(index, 'TetherWdkEntryRefunded', (refund, event) => {
      return refund.paymentId === paymentId &&
        (!poolId || refund.poolId === poolId) &&
        entryRefundMatchesReplay(event, index)
    })
  }

  function wdkSettlementRailFor (payload = {}) {
    return payload && payload.rail || null
  }

  function wdkSettlementSignerMatches (event) {
    const payload = event && event.payload || {}
    const rail = wdkSettlementRailFor(payload)
    return Boolean(rail && event.actorId === rail)
  }

  function wdkSettlementSignerMismatchReason ({ actorId, rail }) {
    return `WDK settlement actorId must match rail ${rail || 'unknown-rail'} (received ${actorId || 'unknown-actor'})`
  }

  function wdkDisputeSignerMatches (event) {
    return wdkSettlementSignerMatches(event)
  }

  function indexedEscrowEventForRefund (index, refund = {}) {
    return findIndexedEvent(index, 'TetherWdkEscrowCreated', escrow => {
      return escrow.escrowId === refund.escrowId
    })
  }

  function validEscrowDisputeEventForRefund (index, refund = {}) {
    return findIndexedEvent(index, 'TetherWdkEscrowDisputed', (dispute, event) => {
      return dispute.escrowId === refund.escrowId &&
        wdkDisputeSignerMatches(event)
    })
  }

  function validEscrowReleaseEventForEscrow (index, escrowId) {
    return findIndexedEvent(index, 'TetherWdkEscrowReleased', (payout, event) => {
      return payout.escrowId === escrowId &&
        wdkSettlementSignerMatches(event)
    })
  }

  function wdkEscrowSignerMatches (event) {
    const payload = event && event.payload || {}
    const rail = wdkSettlementRailFor(payload)
    return Boolean(rail && event.actorId === rail)
  }

  function wdkEscrowSignerMismatchReason ({ actorId, rail }) {
    return `WDK escrow actorId must match rail ${rail || 'unknown-rail'} (received ${actorId || 'unknown-actor'})`
  }

  function officialResultsSourceActorIdFor ({ officialResults = {}, source, sourceActorId } = {}) {
    if (sourceActorId) return sourceActorId
    if (officialResults && officialResults.sourceActorId) return officialResults.sourceActorId
    const resultSource = source || officialResults && officialResults.source
    if (resultSource && resultSource !== 'trusted-results-feed') return resultSource
    return 'official-results-feed'
  }

  function officialResultsSnapshotSignerMatches (event) {
    const payload = event && event.payload || {}
    const sourceActorId = officialResultsSourceActorIdFor(payload)
    return Boolean(sourceActorId && event.actorId === sourceActorId)
  }

  function officialResultsSnapshotSignerMismatchReason ({ actorId, sourceActorId }) {
    return `Official results snapshot actorId must match sourceActorId ${sourceActorId || 'unknown-source'} (received ${actorId || 'unknown-actor'})`
  }

  function qvacAttestationSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.refereeId && event.actorId === payload.refereeId)
  }

  function qvacAttestationSignerMismatchReason ({ actorId, refereeId }) {
    return `QVAC attestation actorId must match refereeId ${refereeId || 'unknown-referee'} (received ${actorId || 'unknown-actor'})`
  }

  function cloneValue (value) {
    return value == null ? value : JSON.parse(JSON.stringify(value))
  }

  function normalizeGameMode (mode) {
    const value = String(mode || 'quick').trim().toLowerCase()
    if (value === 'private' || value === 'room-tournament' || value === 'ranked') return value
    return 'quick'
  }

  function normalizeGamePlayer (player = {}, fallbackUserId = null, fallbackRole = 'shooter') {
    const userId = player.userId || player.id || fallbackUserId || null
    return {
      userId,
      username: player.username || (userId ? String(userId) : null),
      teamId: player.teamId || null,
      avatarRecipe: player.avatarRecipe || null,
      role: player.role || fallbackRole,
      connected: player.connected === true
    }
  }

  function normalizeProfilePayload (payload = {}, actorId = 'system') {
    const userId = payload.userId || actorId
    const username = String(payload.username || userId || 'captain').trim().slice(0, 18) || 'captain'
    const teamId = payload.teamId || null
    const avatarRecipe = payload.avatarRecipe || null
    return {
      profileId: core.deterministicHash({
        type: 'ProfileUpdated',
        userId,
        username,
        teamId,
        avatarRecipe
      }),
      userId,
      username,
      teamId,
      avatarRecipe,
      updatedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function profileSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.userId && event.actorId === payload.userId)
  }

  function profileMatchesReplay (event) {
    const payload = event && event.payload || {}
    const expected = normalizeProfilePayload(payload, event && event.actorId)
    return profileSignerMatches(event) &&
      payload.profileId === expected.profileId &&
      payload.userId === expected.userId &&
      payload.username === expected.username &&
      payload.teamId === expected.teamId
  }

  function normalizePicksMap (picks = {}) {
    return Object.keys(picks || {})
      .sort()
      .reduce((copy, key) => {
        const value = picks[key]
        if (value) copy[key] = value
        return copy
      }, {})
  }

  function normalizeBracketDraftPayload (payload = {}, actorId = 'system', previousPicks = {}) {
    const poolId = payload.poolId || null
    const userId = payload.userId || actorId
    let picks = Object.prototype.hasOwnProperty.call(payload, 'picks')
      ? normalizePicksMap(payload.picks)
      : normalizePicksMap(previousPicks)
    if (payload.matchId && payload.winnerTeamId) {
      picks = normalizePicksMap({
        ...picks,
        [payload.matchId]: payload.winnerTeamId
      })
    }
    if (payload.clear === true) picks = {}
    const rulesVersion = payload.rulesVersion || 'bracket-pool-v1'
    return {
      draftId: core.deterministicHash({
        type: 'BracketDraftUpdated',
        poolId,
        userId,
        picks,
        rulesVersion
      }),
      poolId,
      userId,
      username: payload.username || null,
      teamId: payload.teamId || null,
      picks,
      picksHash: core.deterministicHash(picks),
      rulesVersion,
      updatedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function bracketDraftSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.userId && event.actorId === payload.userId)
  }

  function bracketDraftMatchesReplay (event) {
    const payload = event && event.payload || {}
    const expected = normalizeBracketDraftPayload(payload, event && event.actorId)
    return bracketDraftSignerMatches(event) &&
      payload.draftId === expected.draftId &&
      payload.poolId === expected.poolId &&
      payload.userId === expected.userId &&
      payload.picksHash === expected.picksHash
  }

  function gameTopic (gameId) {
    return `pearcup:v1:game:${gameId || 'unknown-game'}`
  }

  function gameTopicHash (gameId) {
    return core.deterministicHash(gameTopic(gameId))
  }

  function roomTopic (matchId, roomId) {
    return `pearcup:v1:room:${matchId || roomId || 'unknown-room'}`
  }

  function roomTopicHash ({ matchId, roomId } = {}) {
    return core.deterministicHash(roomTopic(matchId, roomId))
  }

  function normalizeRoomId (payload = {}) {
    return payload.roomId || core.deterministicHash({
      type: 'WatchRoom',
      matchId: payload.matchId || null
    })
  }

  function normalizeRoomJoinPayload (payload = {}, actorId = 'system') {
    const roomId = normalizeRoomId(payload)
    const matchId = payload.matchId || roomId
    const userId = payload.userId || actorId
    return {
      joinId: core.deterministicHash({
        type: 'RoomJoined',
        roomId,
        matchId,
        userId
      }),
      roomId,
      matchId,
      userId,
      username: payload.username || userId,
      teamId: payload.teamId || null,
      avatarRecipe: payload.avatarRecipe || null,
      role: payload.role || 'viewer',
      topic: roomTopic(matchId, roomId),
      topicHash: roomTopicHash({ matchId, roomId }),
      joinedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function roomJoinSignerMatches (event) {
    const payload = event && event.payload || {}
    return Boolean(payload.userId && event.actorId === payload.userId)
  }

  function roomJoinMatchesReplay (event) {
    const payload = event && event.payload || {}
    const expected = normalizeRoomJoinPayload(payload, event && event.actorId)
    return roomJoinSignerMatches(event) &&
      payload.roomId === expected.roomId &&
      payload.matchId === expected.matchId &&
      payload.joinId === expected.joinId &&
      payload.topic === expected.topic &&
      payload.topicHash === expected.topicHash
  }

  function roomJoinEventForUser (index, roomId, userId) {
    return findIndexedEvent(index, 'RoomJoined', (joined, event) => {
      return joined.roomId === roomId &&
        joined.userId === userId &&
        roomJoinMatchesReplay(event)
    })
  }

  function normalizeRoomLeavePayload (payload = {}, actorId = 'system') {
    const userId = payload.userId || actorId
    return {
      leaveId: core.deterministicHash({
        type: 'RoomLeft',
        roomId: payload.roomId || null,
        userId
      }),
      roomId: payload.roomId || null,
      userId,
      leftAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function roomLeaveMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const expected = normalizeRoomLeavePayload(payload, event && event.actorId)
    return Boolean(payload.roomId && payload.userId && event.actorId === payload.userId) &&
      payload.leaveId === expected.leaveId &&
      Boolean(roomJoinEventForUser(index, payload.roomId, payload.userId))
  }

  function normalizeChatMessagePayload (payload = {}, actorId = 'system') {
    const userId = payload.userId || actorId
    const body = String(payload.body || '').trim().slice(0, 500)
    return {
      messageId: core.deterministicHash({
        type: 'ChatMessageSent',
        roomId: payload.roomId || null,
        userId,
        body,
        clientNonce: payload.clientNonce || null
      }),
      roomId: payload.roomId || null,
      userId,
      username: payload.username || userId,
      teamId: payload.teamId || null,
      clientNonce: payload.clientNonce || null,
      body,
      sentAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function chatMessageMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const expected = normalizeChatMessagePayload(payload, event && event.actorId)
    return Boolean(payload.roomId && payload.userId && payload.body && event.actorId === payload.userId) &&
      payload.messageId === expected.messageId &&
      Boolean(roomJoinEventForUser(index, payload.roomId, payload.userId))
  }

  function normalizeVoiceStatePayload (payload = {}, actorId = 'system') {
    const userId = payload.userId || actorId
    const status = payload.status === 'speaking' || payload.status === 'muted' ? payload.status : 'idle'
    return {
      voiceStateId: core.deterministicHash({
        type: 'VoiceStateUpdated',
        roomId: payload.roomId || null,
        userId,
        status,
        muted: payload.muted === true,
        handRaised: payload.handRaised === true
      }),
      roomId: payload.roomId || null,
      userId,
      status,
      muted: payload.muted === true,
      handRaised: payload.handRaised === true,
      updatedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function voiceStateMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const expected = normalizeVoiceStatePayload(payload, event && event.actorId)
    return Boolean(payload.roomId && payload.userId && event.actorId === payload.userId) &&
      payload.voiceStateId === expected.voiceStateId &&
      Boolean(roomJoinEventForUser(index, payload.roomId, payload.userId))
  }

  function normalizeStreamStartPayload (payload = {}, actorId = 'system') {
    const userId = payload.userId || actorId
    const roomId = payload.roomId || null
    const source = payload.source === 'licensed-feed' || payload.source === 'match-visualization'
      ? payload.source
      : 'user-owned-screen-share'
    const streamId = payload.streamId || core.deterministicHash({
      type: 'StreamStarted',
      roomId,
      userId,
      source,
      clientNonce: payload.clientNonce || null
    })
    return {
      streamId,
      roomId,
      userId,
      username: payload.username || userId,
      source,
      title: payload.title || 'Shared match view',
      rightsConfirmed: payload.rightsConfirmed === true,
      topic: `pearcup:v1:media:${streamId}`,
      topicHash: core.deterministicHash(`pearcup:v1:media:${streamId}`),
      startedAt: '2026-07-01T00:00:00.000Z',
      status: 'live'
    }
  }

  function streamStartMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const expected = normalizeStreamStartPayload(payload, event && event.actorId)
    return Boolean(payload.roomId && payload.userId && event.actorId === payload.userId) &&
      payload.streamId === expected.streamId &&
      payload.topic === expected.topic &&
      payload.topicHash === expected.topicHash &&
      payload.rightsConfirmed === true &&
      Boolean(roomJoinEventForUser(index, payload.roomId, payload.userId))
  }

  function normalizeStreamStopPayload (payload = {}, actorId = 'system') {
    const userId = payload.userId || actorId
    return {
      stopId: core.deterministicHash({
        type: 'StreamStopped',
        streamId: payload.streamId || null,
        roomId: payload.roomId || null,
        userId
      }),
      streamId: payload.streamId || null,
      roomId: payload.roomId || null,
      userId,
      stoppedAt: '2026-07-01T00:00:00.000Z',
      status: 'stopped'
    }
  }

  function streamStopMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const expected = normalizeStreamStopPayload(payload, event && event.actorId)
    const started = findIndexedEvent(index, 'StreamStarted', (stream, streamEvent) => {
      return stream.streamId === payload.streamId && streamStartMatchesReplay(streamEvent, index)
    })
    const streamerId = started && started.payload && started.payload.userId
    return Boolean(started && payload.streamId && payload.roomId && payload.userId) &&
      event.actorId === payload.userId &&
      payload.userId === streamerId &&
      payload.stopId === expected.stopId
  }

  function normalizeGameInvitePayload (payload = {}, actorId = 'system') {
    const mode = normalizeGameMode(payload.mode)
    const roomId = payload.roomId || null
    const inviter = normalizeGamePlayer(
      payload.inviter || payload.inviterPlayer || {
        userId: payload.inviterUserId || actorId,
        username: payload.inviterUsername,
        teamId: payload.inviterTeamId,
        avatarRecipe: payload.inviterAvatarRecipe
      },
      payload.inviterUserId || actorId,
      'shooter'
    )
    const opponent = normalizeGamePlayer(
      payload.opponent || payload.opponentPlayer || {
        userId: payload.opponentUserId,
        username: payload.opponentUsername,
        teamId: payload.opponentTeamId,
        avatarRecipe: payload.opponentAvatarRecipe
      },
      payload.opponentUserId,
      'keeper'
    )
    const rulesVersion = payload.rulesVersion || core.resolverVersion
    const gameType = payload.gameType || 'penalty-clash'
    const clientNonce = payload.clientNonce || payload.inviteNonce || null
    const gameId = payload.gameId || core.deterministicHash({
      type: 'GameInviteCreated',
      roomId,
      mode,
      gameType,
      inviterUserId: inviter.userId,
      opponentUserId: opponent.userId,
      rulesVersion,
      clientNonce
    })
    const inviteCore = {
      gameId,
      roomId,
      mode,
      gameType,
      inviterUserId: inviter.userId,
      opponentUserId: opponent.userId,
      rulesVersion,
      clientNonce
    }
    const players = [
      { ...inviter, role: 'shooter', connected: true },
      { ...opponent, role: 'keeper', connected: false }
    ]
    return {
      inviteId: core.deterministicHash({ type: 'GameInviteCreated', ...inviteCore }),
      ...inviteCore,
      topic: gameTopic(gameId),
      topicHash: gameTopicHash(gameId),
      inviter: players[0],
      opponent: players[1],
      players,
      spectators: [],
      stake: payload.stake || null,
      prizeMode: payload.prizeMode === true,
      status: 'inviting',
      expiresAt: payload.expiresAt || null,
      createdAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function gameInviteSignerMatches (event) {
    const payload = event && event.payload || {}
    const inviter = payload.inviter || {}
    const opponent = payload.opponent || {}
    const expectedInviteId = core.deterministicHash({
      type: 'GameInviteCreated',
      gameId: payload.gameId,
      roomId: payload.roomId || null,
      mode: normalizeGameMode(payload.mode),
      gameType: payload.gameType || 'penalty-clash',
      inviterUserId: inviter.userId || payload.inviterUserId || null,
      opponentUserId: opponent.userId || payload.opponentUserId || null,
      rulesVersion: payload.rulesVersion || core.resolverVersion,
      clientNonce: payload.clientNonce || null
    })
    return Boolean(
      payload.gameId &&
      payload.inviteId === expectedInviteId &&
      payload.topic === gameTopic(payload.gameId) &&
      payload.topicHash === gameTopicHash(payload.gameId) &&
      inviter.userId &&
      opponent.userId &&
      inviter.userId !== opponent.userId &&
      event.actorId === inviter.userId
    )
  }

  function gameInviteSignerMismatchReason ({ actorId, inviterUserId }) {
    return `Game invite actorId must match inviter userId ${inviterUserId || 'unknown-user'} (received ${actorId || 'unknown-actor'})`
  }

  function gameInviteAcceptancePayload ({ inviteEvent, actorId }) {
    const invite = inviteEvent && inviteEvent.payload || {}
    return {
      acceptanceId: core.deterministicHash({
        type: 'GameInviteAccepted',
        gameId: invite.gameId,
        inviteId: invite.inviteId,
        inviteEventId: inviteEvent && inviteEvent.eventId,
        acceptedByUserId: actorId
      }),
      gameId: invite.gameId,
      inviteId: invite.inviteId,
      inviteEventId: inviteEvent && inviteEvent.eventId,
      acceptedByUserId: actorId,
      status: 'accepted',
      acceptedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function gameInviteAcceptanceMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const inviteEvent = index.byId.get(payload.inviteEventId)
    const invite = inviteEvent && inviteEvent.payload || {}
    const opponent = invite.opponent || {}
    const expected = gameInviteAcceptancePayload({ inviteEvent, actorId: event && event.actorId })
    return Boolean(
      inviteEvent &&
      inviteEvent.type === 'GameInviteCreated' &&
      gameInviteSignerMatches(inviteEvent) &&
      payload.gameId === invite.gameId &&
      payload.inviteId === invite.inviteId &&
      payload.acceptedByUserId === opponent.userId &&
      event.actorId === opponent.userId &&
      payload.acceptanceId === expected.acceptanceId
    )
  }

  function gameSessionStartPayload ({ inviteEvent, acceptedEvent }) {
    const invite = inviteEvent && inviteEvent.payload || {}
    const accepted = acceptedEvent && acceptedEvent.payload || {}
    const players = (invite.players || []).map(player => ({
      ...player,
      connected: true
    }))
    const score = players.reduce((next, player) => {
      if (player.userId) next[player.userId] = 0
      return next
    }, {})
    return {
      sessionId: core.deterministicHash({
        type: 'GameSessionStarted',
        gameId: invite.gameId,
        inviteId: invite.inviteId,
        inviteEventId: inviteEvent && inviteEvent.eventId,
        acceptedEventId: acceptedEvent && acceptedEvent.eventId
      }),
      gameId: invite.gameId,
      roomId: invite.roomId || null,
      mode: normalizeGameMode(invite.mode),
      gameType: invite.gameType || 'penalty-clash',
      topic: gameTopic(invite.gameId),
      topicHash: gameTopicHash(invite.gameId),
      stake: invite.stake || null,
      stakeHash: invite.stake ? core.deterministicHash(invite.stake) : null,
      prizeMode: invite.prizeMode === true,
      status: 'playing',
      players,
      spectators: [],
      currentRound: 0,
      score,
      inviteId: invite.inviteId,
      inviteEventId: inviteEvent && inviteEvent.eventId,
      acceptedEventId: acceptedEvent && acceptedEvent.eventId,
      sourceEventIds: [inviteEvent && inviteEvent.eventId, acceptedEvent && acceptedEvent.eventId].filter(Boolean),
      startedByUserId: accepted.acceptedByUserId || null,
      createdAt: invite.createdAt || '2026-07-01T00:00:00.000Z',
      startedAt: '2026-07-01T00:00:00.000Z',
      completedAt: null
    }
  }

  function gameSessionStartedMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const inviteEvent = index.byId.get(payload.inviteEventId)
    const acceptedEvent = index.byId.get(payload.acceptedEventId)
    const expected = gameSessionStartPayload({ inviteEvent, acceptedEvent })
    return Boolean(
      inviteEvent &&
      acceptedEvent &&
      inviteEvent.type === 'GameInviteCreated' &&
      acceptedEvent.type === 'GameInviteAccepted' &&
      gameInviteSignerMatches(inviteEvent) &&
      gameInviteAcceptanceMatchesReplay(acceptedEvent, index) &&
      event.actorId === acceptedEvent.actorId &&
      payload.sessionId === expected.sessionId &&
      payload.gameId === expected.gameId &&
      payload.topicHash === expected.topicHash &&
      sameStringList(payload.sourceEventIds, expected.sourceEventIds)
    )
  }

  function gameSessionPlayerIds (session = {}) {
    return (session.players || []).map(player => player.userId).filter(Boolean)
  }

  function gameSessionJoinPayload ({ session, payload = {}, actorId }) {
    const userId = payload.userId || actorId
    const asSpectator = payload.asSpectator === true
    const players = session && session.players || []
    const participant = players.find(player => player.userId === userId)
    const role = asSpectator ? 'spectator' : participant && participant.role || payload.role || 'spectator'
    return {
      joinId: core.deterministicHash({
        type: 'GameSessionJoined',
        gameId: session && session.gameId || payload.gameId,
        userId,
        asSpectator
      }),
      gameId: session && session.gameId || payload.gameId,
      userId,
      username: payload.username || participant && participant.username || userId,
      teamId: payload.teamId || participant && participant.teamId || null,
      avatarRecipe: payload.avatarRecipe || participant && participant.avatarRecipe || null,
      role,
      asSpectator,
      connected: true,
      joinedAt: '2026-07-01T00:00:00.000Z'
    }
  }

  function stakeAmount (stake = {}) {
    if (!stake || stake.amount === undefined || stake.amount === null) return null
    const amount = Number(stake.amount)
    return Number.isFinite(amount) ? amount : null
  }

  function stakeAsset (stake = {}) {
    return stake && stake.asset || null
  }

  function gameEscrowHasSessionBinding (escrow = {}) {
    return Boolean(
      escrow.sessionId ||
      escrow.sessionEventId ||
      escrow.sessionHash ||
      Array.isArray(escrow.sourceEventIds) && escrow.sourceEventIds.length > 0 ||
      escrow.stakeHash ||
      escrow.prizeMode === true
    )
  }

  function gameEscrowSessionMatches ({ escrow = {}, sessionEvent }) {
    const session = sessionEvent && sessionEvent.payload || null
    if (!session) return false
    if (escrow.gameId !== session.gameId) return false
    if (escrow.sessionId !== session.sessionId) return false
    if (escrow.sessionEventId !== sessionEvent.eventId) return false
    if (escrow.sessionHash !== core.deterministicHash(session)) return false
    if (!Array.isArray(escrow.sourceEventIds) || !escrow.sourceEventIds.includes(sessionEvent.eventId)) return false
    if (!sameStringList(escrow.players, gameSessionPlayerIds(session))) return false
    if (session.stake) {
      const expectedAmount = stakeAmount(session.stake)
      const expectedAsset = stakeAsset(session.stake)
      if (expectedAmount !== null && Number(escrow.amount) !== expectedAmount) return false
      if (expectedAsset && escrow.asset !== expectedAsset) return false
      if (escrow.stakeHash !== core.deterministicHash(session.stake)) return false
    }
    if (session.prizeMode === true && escrow.prizeMode !== true) return false
    const expected = core.createTetherWdkEscrowIntent({
      gameId: escrow.gameId,
      players: escrow.players,
      amount: escrow.amount,
      asset: escrow.asset,
      rail: escrow.rail,
      rulesVersion: escrow.rulesVersion,
      sessionId: escrow.sessionId,
      sessionEventId: escrow.sessionEventId,
      sessionHash: escrow.sessionHash,
      sourceEventIds: escrow.sourceEventIds,
      stakeHash: escrow.stakeHash,
      prizeMode: escrow.prizeMode
    })
    return escrow.escrowId === expected.escrowId &&
      escrow.status === 'locked'
  }

  function gameEscrowMatchesReplay (event, index) {
    const escrow = event && event.payload || {}
    if (!wdkEscrowSignerMatches(event)) return false
    if (!gameEscrowHasSessionBinding(escrow)) return true
    const sessionEvent = index.byId.get(escrow.sessionEventId)
    if (!sessionEvent || sessionEvent.type !== 'GameSessionStarted') return false
    if (!gameSessionStartedMatchesReplay(sessionEvent, index)) return false
    return gameEscrowSessionMatches({ escrow, sessionEvent })
  }

  function gameSessionJoinMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const startedEvent = findIndexedEvent(index, 'GameSessionStarted', session => session.gameId === payload.gameId)
    const session = startedEvent && startedEvent.payload || null
    const expected = gameSessionJoinPayload({ session, payload, actorId: event && event.actorId })
    const participantIds = new Set(gameSessionPlayerIds(session))
    return Boolean(
      session &&
      gameSessionStartedMatchesReplay(startedEvent, index) &&
      payload.userId &&
      event.actorId === payload.userId &&
      payload.joinId === expected.joinId &&
      (payload.asSpectator === true || participantIds.has(payload.userId))
    )
  }

  function eventRefMatchesReplay (index, ref) {
    if (!ref || !ref.eventId) return false
    const event = index.byId.get(ref.eventId)
    if (!event) return false
    if (ref.type && event.type !== ref.type) return false
    if (ref.actorId && event.actorId !== ref.actorId) return false
    if (ref.payloadHash && ref.payloadHash !== core.deterministicHash(event.payload || null)) return false
    return true
  }

  function previousEventChain (index, previousEventId) {
    const chain = []
    const seen = new Set()
    let eventId = previousEventId || null
    while (eventId) {
      if (seen.has(eventId)) return null
      seen.add(eventId)
      const event = index.byId.get(eventId)
      if (!event) return null
      chain.push(event)
      eventId = event.previousEventId || null
    }
    return chain.reverse()
  }

  function receiptRefs (receipt = {}) {
    const refs = receipt.events || {}
    return [refs.result, refs.attestation, refs.settlement].filter(Boolean)
  }

  function receiptReferencesMatchReplay (receipt, index) {
    const refs = receiptRefs(receipt)
    if (refs.length === 0 && receipt && receipt.completed !== true) return true
    return refs.length === 3 && refs.every(ref => eventRefMatchesReplay(index, ref))
  }

  function receiptEventRootMatchesReplay (event, index) {
    const receipt = event && event.payload
    if (!receipt || !receipt.eventRoot) return false
    const chain = previousEventChain(index, event.previousEventId)
    if (!chain) return false
    const chainIds = new Set(chain.map(item => item.eventId))
    if (!receiptRefs(receipt).every(ref => chainIds.has(ref.eventId))) return false
    return eventRoot(chain) === receipt.eventRoot
  }

  function settlementReceiptMatchesReplay (event, index) {
    const receipt = event && event.payload
    if (!receiptReferencesMatchReplay(receipt, index)) return false
    if (!receiptEventRootMatchesReplay(event, index)) return false
    const receiptTools = getSettlementReceipts()
    if (receiptTools && typeof receiptTools.verifySettlementReceipt === 'function') {
      return receiptTools.verifySettlementReceipt(receipt).ok
    }
    return true
  }

  function verifiedGameReleaseMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const attestationEvent = findIndexedEvent(index, 'QvacRefereeAttestationCreated', attestation => {
      return attestation.attestationId === payload.qvacAttestationId
    })
    const escrowEvent = findIndexedEvent(index, 'TetherWdkEscrowCreated', escrow => {
      return escrow.escrowId === payload.escrowId
    })
    const attestation = attestationEvent && attestationEvent.payload
    const escrow = escrowEvent && escrowEvent.payload
    const roundEvent = attestation && findIndexedEvent(index, 'GameRoundResolved', round => {
      return round.gameId === attestation.gameId && round.roundId === attestation.roundId
    })
    const roundResult = roundEvent && roundEvent.payload
    if (!attestation || !escrow || !roundResult) return false
    if (!qvacAttestationSignerMatches(attestationEvent)) return false
    if (!gameEscrowMatchesReplay(escrowEvent, index)) return false
    if (!wdkSettlementSignerMatches(event)) return false
    if (validGameEscrowRefundEventForEscrow(index, payload.escrowId)) return false
    if (!indexedSourceEventsPresent(index, attestation.sourceEventIds)) return false
    if (!core.verifyQvacRoundAttestation({ roundResult, attestation }).ok) return false
    const expectedPayoutId = core.deterministicHash({
      escrowId: payload.escrowId,
      attestationId: attestation.attestationId,
      winnerUserId: payload.winnerUserId
    })
    return payload.qvacAttestationId === attestation.attestationId &&
      payload.winnerUserId === attestation.winnerUserId &&
      payload.payoutId === expectedPayoutId &&
      payload.amount === escrow.amount &&
      payload.asset === escrow.asset &&
      payload.rail === escrow.rail &&
      escrow.gameId === attestation.gameId &&
      sameStringList(escrow.players, attestation.participantUserIds)
  }

  function gameEscrowRefundMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const escrowEvent = indexedEscrowEventForRefund(index, payload)
    const disputeEvent = validEscrowDisputeEventForRefund(index, payload)
    const escrow = escrowEvent && escrowEvent.payload
    if (!escrow || !disputeEvent) return false
    if (!gameEscrowMatchesReplay(escrowEvent, index)) return false
    if (!wdkSettlementSignerMatches(event)) return false
    if (validEscrowReleaseEventForEscrow(index, payload.escrowId)) return false
    const expected = core.refundTetherWdkEscrow({
      escrow,
      reason: payload.reason,
      processorStatus: payload.processorStatus,
      refundUserIds: payload.refundUserIds
    })
    return payload.refundId === expected.refundId &&
      payload.gameId === escrow.gameId &&
      payload.amount === escrow.amount &&
      payload.amountEach === expected.amountEach &&
      payload.asset === escrow.asset &&
      payload.rail === escrow.rail &&
      payload.rulesVersion === escrow.rulesVersion &&
      payload.status === 'refunded'
  }

  function validGameEscrowRefundEventForEscrow (index, escrowId) {
    return findIndexedEvent(index, 'TetherWdkEscrowRefunded', (refund, event) => {
      const escrowEvent = indexedEscrowEventForRefund(index, refund)
      const disputeEvent = validEscrowDisputeEventForRefund(index, refund)
      const escrow = escrowEvent && escrowEvent.payload
      if (refund.escrowId !== escrowId || !escrow || !disputeEvent) return false
      if (!gameEscrowMatchesReplay(escrowEvent, index)) return false
      if (!wdkSettlementSignerMatches(event)) return false
      const expected = core.refundTetherWdkEscrow({
        escrow,
        reason: refund.reason,
        processorStatus: refund.processorStatus,
        refundUserIds: refund.refundUserIds
      })
      return refund.refundId === expected.refundId &&
        refund.gameId === escrow.gameId &&
        refund.amount === escrow.amount &&
        refund.amountEach === expected.amountEach &&
        refund.asset === escrow.asset &&
        refund.rail === escrow.rail &&
        refund.rulesVersion === escrow.rulesVersion &&
        refund.status === 'refunded'
    })
  }

  function verifiedPoolPayoutMatchesReplay (event, index) {
    const payload = event && event.payload || {}
    const attestationEvent = findIndexedEvent(index, 'QvacPoolSettlementAttestationCreated', attestation => {
      return attestation.attestationId === payload.qvacAttestationId &&
        (!payload.poolId || attestation.poolId === payload.poolId)
    })
    const attestation = attestationEvent && attestationEvent.payload
    const poolResultEvent = findIndexedEvent(index, 'BracketPoolSettlementResolved', result => {
      return result.poolId === payload.poolId &&
        (!attestation || result.stateHash === attestation.stateHash)
    })
    const poolResult = poolResultEvent && poolResultEvent.payload
    if (!attestation || !poolResult) return false
    if (!qvacAttestationSignerMatches(attestationEvent)) return false
    if (!wdkSettlementSignerMatches(event)) return false
    if (!indexedSourceEventsPresent(index, attestation.sourceEventIds)) return false
    if (!core.verifyQvacPoolSettlementAttestation({ poolResult, attestation }).ok) return false

    const sourcePaymentIds = Array.isArray(payload.sourcePaymentIds) ? payload.sourcePaymentIds : []
    const paymentEvents = sourcePaymentIds.map(paymentId => {
      return findIndexedEvent(index, 'TetherWdkEntryConfirmed', payment => {
        return payment.paymentId === paymentId && (!payload.poolId || payment.poolId === payload.poolId)
      })
    })
    if (paymentEvents.some(event => !event)) return false
    const validPaymentEvents = paymentEvents.every(event => {
      const payment = event && event.payload || {}
      const intentEvent = findIndexedEvent(index, 'TetherWdkEntryIntentCreated', intent => {
        return intent.intentId === payment.intentId
      })
      return paymentMatchesSignedEntryIntent({ payment, intentEvent }) &&
        entryPaymentSignerMatches({ event, intentEvent })
    })
    if (!validPaymentEvents) return false
    if (paymentEvents.some(event => validEntryRefundEventForPayment(index, event.payload.paymentId, payload.poolId))) return false
    const confirmedEntries = paymentEvents.map(event => event.payload)
    if (confirmedEntries.some(entry => entry.rail !== payload.rail)) return false
    const grossPool = confirmedEntries.reduce((total, entry) => total + Number(entry.amount || 0), 0)
    const winnerUserIds = Array.isArray(payload.winnerUserIds) ? payload.winnerUserIds : []
    const amountEach = winnerUserIds.length ? Number((grossPool / winnerUserIds.length).toFixed(2)) : 0
    const expectedPayoutId = core.deterministicHash({
      poolId: payload.poolId,
      sourcePaymentIds: [...sourcePaymentIds].sort(),
      winnerUserIds: [...winnerUserIds].sort(),
      grossPool,
      attestationId: attestation.attestationId,
      asset: payload.asset,
      rail: payload.rail,
      rulesVersion: payload.rulesVersion
    })
    return payload.qvacAttestationId === attestation.attestationId &&
      sameStringList(winnerUserIds, attestation.winnerUserIds) &&
      sameStringList(winnerUserIds, poolResult.winnerUserIds) &&
      sameStringList(sourcePaymentIds, attestation.sourcePaymentIds) &&
      sameStringList(sourcePaymentIds, poolResult.sourcePaymentIds) &&
      payload.grossPool === grossPool &&
      payload.amountEach === amountEach &&
      payload.payoutId === expectedPayoutId &&
      payload.status === 'prepared'
  }

  function settlementEventDependenciesSatisfied (event, index) {
    if (!event || !index) return false

    if (event.type === 'MatchEventIngested') {
      return matchEventSignerMatches(event)
    }

    if (event.type === 'CommentaryGenerated') {
      return commentarySegmentMatchesReplay(event, index)
    }

    if (event.type === 'ProfileUpdated') {
      return profileMatchesReplay(event)
    }

    if (event.type === 'BracketDraftUpdated') {
      return bracketDraftMatchesReplay(event)
    }

    if (event.type === 'RoomJoined') {
      return roomJoinMatchesReplay(event)
    }

    if (event.type === 'RoomLeft') {
      return roomLeaveMatchesReplay(event, index)
    }

    if (event.type === 'ChatMessageSent') {
      return chatMessageMatchesReplay(event, index)
    }

    if (event.type === 'VoiceStateUpdated') {
      return voiceStateMatchesReplay(event, index)
    }

    if (event.type === 'StreamStarted') {
      return streamStartMatchesReplay(event, index)
    }

    if (event.type === 'StreamStopped') {
      return streamStopMatchesReplay(event, index)
    }

    if (event.type === 'GameInviteCreated') {
      return gameInviteSignerMatches(event)
    }

    if (event.type === 'GameInviteAccepted') {
      return gameInviteAcceptanceMatchesReplay(event, index)
    }

    if (event.type === 'GameSessionStarted') {
      return gameSessionStartedMatchesReplay(event, index)
    }

    if (event.type === 'GameSessionJoined') {
      return gameSessionJoinMatchesReplay(event, index)
    }

    if (event.type === 'QvacRefereeAttestationCreated' || event.type === 'QvacPoolSettlementAttestationCreated') {
      return qvacAttestationSignerMatches(event)
    }

    if (event.type === 'TetherWdkEscrowCreated') {
      return gameEscrowMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkEntryPaymentPending') {
      return entryPaymentCheckMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkEntryRefunded') {
      return entryRefundMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkEscrowReleased') {
      return verifiedGameReleaseMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkEscrowRefunded') {
      return gameEscrowRefundMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkPoolPayoutPrepared') {
      return verifiedPoolPayoutMatchesReplay(event, index)
    }

    if (event.type === 'TetherWdkEscrowDisputed' || event.type === 'TetherWdkPoolPayoutDisputed') {
      return wdkDisputeSignerMatches(event)
    }

    if (event.type === 'SettlementReceiptCreated') {
      return settlementReceiptMatchesReplay(event, index)
    }

    return true
  }

  function createView (events) {
    const view = {
      events,
      profiles: {},
      profilesByTeam: {},
      bracketDrafts: {},
      bracketDraftsByPool: {},
      matchEvents: {},
      matchEventsByMatch: {},
      statSnapshots: {},
      commentarySegments: {},
      commentaryByMatchLanguage: {},
      commentaryLanguages: {},
      commentaryRejections: [],
      rooms: {},
      roomsByMatch: {},
      roomParticipants: {},
      chatMessages: {},
      chatMessagesByRoom: {},
      voiceStates: {},
      voiceStatesByRoom: {},
      streams: {},
      activeStreams: {},
      activeStreamsByRoom: {},
      gameInvites: {},
      openGameInvites: {},
      gameInviteAcceptances: {},
      gameSessions: {},
      gameSessionsByRoom: {},
      gameSessionTopics: {},
      gameParticipants: {},
      gameSpectators: {},
      activeGameSessions: {},
      commitments: {},
      reveals: {},
      roundStateHashes: {},
      roundStateHashEvents: {},
      forfeitRecords: {},
      forfeitRecordEvents: {},
      roundResults: {},
      attestations: {},
      escrows: {},
      escrowsByGame: {},
      escrowsBySession: {},
      payouts: {},
      escrowRefunds: {},
      escrowRefundsByEscrow: {},
      entryIntents: {},
      entryPayments: {},
      entryPaymentsByIntent: {},
      entryPaymentChecks: {},
      entryPaymentChecksByIntent: {},
      entryRefunds: {},
      entryRefundsByPayment: {},
      entryRefundsByIntent: {},
      bracketSubmissions: {},
      bracketSubmissionsByPool: {},
      officialResultsSnapshots: {},
      officialResultsSnapshotEvents: {},
      payoutRecipientDeclarations: {},
      payoutRecipientDeclarationsByPool: {},
      poolResults: {},
      poolAttestations: {},
      poolPayouts: {},
      settlementReceipts: {},
      settlementReceiptEvents: {},
      settlementReceiptsBySettlementEvent: {},
      settlementReceiptEventsBySettlementEvent: {},
      settlementReceiptRejections: [],
      disputes: [],
      eventRoot: eventRoot(events),
      typeCounts: typeCounts(events)
    }

    const replayIndex = eventIndex(events)
    for (const event of events) {
      const payload = event.payload
      if (event.type === 'MatchEventIngested') {
        if (!matchEventSignerMatches(event)) continue
        const matchPayload = {
          ...payload,
          sourceEventId: event.eventId
        }
        view.matchEvents[payload.eventId] = matchPayload
        if (!view.matchEventsByMatch[payload.matchId]) view.matchEventsByMatch[payload.matchId] = []
        view.matchEventsByMatch[payload.matchId].push(matchPayload)
      }
      if (event.type === 'CommentaryLanguageSelected') {
        const language = normalizeLanguage(payload.language)
        view.commentaryLanguages[payload.matchId] = language
      }
      if (event.type === 'CommentaryGenerated') {
        if (!commentarySegmentMatchesReplay(event, replayIndex)) continue
        view.commentarySegments[payload.segmentId] = payload
        const key = `${payload.matchId}:${payload.language}`
        if (!view.commentaryByMatchLanguage[key]) view.commentaryByMatchLanguage[key] = []
        view.commentaryByMatchLanguage[key].push(payload)
      }
      if (event.type === 'CommentaryRejected') {
        view.commentaryRejections.push(payload)
      }
      if (event.type === 'ProfileUpdated') {
        if (!profileMatchesReplay(event)) continue
        view.profiles[payload.userId] = payload
        if (payload.teamId) {
          if (!view.profilesByTeam[payload.teamId]) view.profilesByTeam[payload.teamId] = {}
          view.profilesByTeam[payload.teamId][payload.userId] = payload
        }
      }
      if (event.type === 'BracketDraftUpdated') {
        if (!bracketDraftMatchesReplay(event)) continue
        const key = `${payload.poolId}:${payload.userId}`
        view.bracketDrafts[key] = payload
        if (!view.bracketDraftsByPool[payload.poolId]) view.bracketDraftsByPool[payload.poolId] = {}
        view.bracketDraftsByPool[payload.poolId][payload.userId] = payload
      }
      if (event.type === 'RoomJoined') {
        if (!roomJoinMatchesReplay(event)) continue
        view.rooms[payload.roomId] = {
          roomId: payload.roomId,
          matchId: payload.matchId,
          topic: payload.topic,
          topicHash: payload.topicHash
        }
        if (!view.roomsByMatch[payload.matchId]) view.roomsByMatch[payload.matchId] = {}
        view.roomsByMatch[payload.matchId][payload.roomId] = view.rooms[payload.roomId]
        if (!view.roomParticipants[payload.roomId]) view.roomParticipants[payload.roomId] = {}
        view.roomParticipants[payload.roomId][payload.userId] = payload
      }
      if (event.type === 'RoomLeft') {
        if (!roomLeaveMatchesReplay(event, replayIndex)) continue
        if (view.roomParticipants[payload.roomId]) delete view.roomParticipants[payload.roomId][payload.userId]
        if (view.voiceStatesByRoom[payload.roomId]) delete view.voiceStatesByRoom[payload.roomId][payload.userId]
      }
      if (event.type === 'ChatMessageSent') {
        if (!chatMessageMatchesReplay(event, replayIndex)) continue
        view.chatMessages[payload.messageId] = payload
        if (!view.chatMessagesByRoom[payload.roomId]) view.chatMessagesByRoom[payload.roomId] = []
        view.chatMessagesByRoom[payload.roomId].push(payload)
      }
      if (event.type === 'VoiceStateUpdated') {
        if (!voiceStateMatchesReplay(event, replayIndex)) continue
        const key = `${payload.roomId}:${payload.userId}`
        view.voiceStates[key] = payload
        if (!view.voiceStatesByRoom[payload.roomId]) view.voiceStatesByRoom[payload.roomId] = {}
        view.voiceStatesByRoom[payload.roomId][payload.userId] = payload
      }
      if (event.type === 'StreamStarted') {
        if (!streamStartMatchesReplay(event, replayIndex)) continue
        view.streams[payload.streamId] = payload
        view.activeStreams[payload.streamId] = payload
        view.activeStreamsByRoom[payload.roomId] = payload
      }
      if (event.type === 'StreamStopped') {
        if (!streamStopMatchesReplay(event, replayIndex)) continue
        const stream = view.streams[payload.streamId]
        if (stream) view.streams[payload.streamId] = { ...stream, status: 'stopped', stoppedAt: payload.stoppedAt }
        delete view.activeStreams[payload.streamId]
        if (view.activeStreamsByRoom[payload.roomId] && view.activeStreamsByRoom[payload.roomId].streamId === payload.streamId) {
          delete view.activeStreamsByRoom[payload.roomId]
        }
      }
      if (event.type === 'GameInviteCreated') {
        if (!gameInviteSignerMatches(event)) continue
        view.gameInvites[payload.gameId] = payload
        view.openGameInvites[payload.gameId] = payload
        view.gameSessionTopics[payload.gameId] = payload.topicHash
      }
      if (event.type === 'GameInviteAccepted') {
        if (!gameInviteAcceptanceMatchesReplay(event, replayIndex)) continue
        view.gameInviteAcceptances[payload.gameId] = payload
        delete view.openGameInvites[payload.gameId]
      }
      if (event.type === 'GameSessionStarted') {
        if (!gameSessionStartedMatchesReplay(event, replayIndex)) continue
        const session = cloneValue(payload)
        view.gameSessions[payload.gameId] = session
        view.activeGameSessions[payload.gameId] = session
        view.gameSessionTopics[payload.gameId] = payload.topicHash
        if (payload.roomId) {
          if (!view.gameSessionsByRoom[payload.roomId]) view.gameSessionsByRoom[payload.roomId] = {}
          view.gameSessionsByRoom[payload.roomId][payload.gameId] = session
        }
        view.gameParticipants[payload.gameId] = {}
        for (const player of payload.players || []) {
          if (player.userId) view.gameParticipants[payload.gameId][player.userId] = player
        }
        view.gameSpectators[payload.gameId] = {}
      }
      if (event.type === 'GameSessionJoined') {
        if (!gameSessionJoinMatchesReplay(event, replayIndex)) continue
        const session = view.gameSessions[payload.gameId]
        if (!session) continue
        if (!view.gameParticipants[payload.gameId]) view.gameParticipants[payload.gameId] = {}
        if (!view.gameSpectators[payload.gameId]) view.gameSpectators[payload.gameId] = {}
        if (payload.asSpectator) {
          view.gameSpectators[payload.gameId][payload.userId] = payload
          if (!session.spectators.includes(payload.userId)) session.spectators.push(payload.userId)
        } else {
          view.gameParticipants[payload.gameId][payload.userId] = payload
          session.players = session.players.map(player => {
            return player.userId === payload.userId ? { ...player, ...payload, role: player.role } : player
          })
        }
      }
      if (event.type === 'GameCommitmentSubmitted') {
        const key = `${payload.gameId}:${payload.roundId}:${payload.playerId}`
        view.commitments[key] = payload
      }
      if (event.type === 'GameInputRevealed') {
        const key = `${payload.gameId}:${payload.roundId}:${payload.playerId}`
        view.reveals[key] = payload
      }
      if (event.type === 'GameRoundStateHashSubmitted') {
        const key = `${payload.gameId}:${payload.roundId}:${payload.playerId}`
        view.roundStateHashes[key] = payload
        view.roundStateHashEvents[key] = event
      }
      if (event.type === 'GameRoundForfeitRecorded') {
        const key = `${payload.gameId}:${payload.roundId}`
        view.forfeitRecords[key] = payload
        view.forfeitRecordEvents[key] = event
      }
      if (event.type === 'GameRoundResolved') {
        view.roundResults[`${payload.gameId}:${payload.roundId}`] = payload
      }
      if (event.type === 'QvacRefereeAttestationCreated') {
        if (!qvacAttestationSignerMatches(event)) continue
        view.attestations[`${payload.gameId}:${payload.roundId}`] = payload
      }
      if (event.type === 'TetherWdkEscrowCreated') {
        if (!gameEscrowMatchesReplay(event, replayIndex)) continue
        view.escrows[payload.escrowId] = payload
        if (payload.gameId) view.escrowsByGame[payload.gameId] = payload
        if (payload.sessionId) view.escrowsBySession[payload.sessionId] = payload
      }
      if (event.type === 'TetherWdkEscrowReleased') {
        if (!wdkSettlementSignerMatches(event)) continue
        view.payouts[payload.payoutId] = payload
      }
      if (event.type === 'TetherWdkEscrowRefunded') {
        if (!gameEscrowRefundMatchesReplay(event, replayIndex)) continue
        view.escrowRefunds[payload.refundId] = payload
        view.escrowRefundsByEscrow[payload.escrowId] = payload
      }
      if (event.type === 'TetherWdkEntryIntentCreated') {
        if (!entryIntentSignerMatches(event)) continue
        view.entryIntents[payload.intentId] = payload
      }
      if (event.type === 'TetherWdkEntryConfirmed') {
        const intentEvent = events.find(item =>
          item.type === 'TetherWdkEntryIntentCreated' &&
          item.payload &&
          item.payload.intentId === payload.intentId)
        if (!paymentMatchesSignedEntryIntent({ payment: payload, intentEvent })) continue
        if (!entryPaymentSignerMatches({ event, intentEvent })) continue
        if (validEntryRefundEventForPayment(replayIndex, payload.paymentId, payload.poolId)) continue
        view.entryPayments[payload.paymentId] = payload
        view.entryPaymentsByIntent[payload.intentId] = payload
      }
      if (event.type === 'TetherWdkEntryPaymentPending') {
        const intentEvent = events.find(item =>
          item.type === 'TetherWdkEntryIntentCreated' &&
          item.payload &&
          item.payload.intentId === payload.intentId)
        if (!entryPaymentCheckMatchesSignedEntryIntent({ check: payload, intentEvent })) continue
        if (!entryPaymentCheckSignerMatches({ event, intentEvent })) continue
        view.entryPaymentChecks[payload.checkId] = payload
        if (payload.intentId) view.entryPaymentChecksByIntent[payload.intentId] = payload
      }
      if (event.type === 'TetherWdkEntryRefunded') {
        if (!entryRefundMatchesReplay(event, replayIndex)) continue
        view.entryRefunds[payload.refundId] = payload
        view.entryRefundsByPayment[payload.paymentId] = payload
        if (payload.intentId) view.entryRefundsByIntent[payload.intentId] = payload
        delete view.entryPayments[payload.paymentId]
        if (payload.intentId) delete view.entryPaymentsByIntent[payload.intentId]
      }
      if (event.type === 'BracketSubmissionLocked') {
        if (!bracketSubmissionSignerMatches(event)) continue
        view.bracketSubmissions[payload.submissionId] = payload
        if (!view.bracketSubmissionsByPool[payload.poolId]) view.bracketSubmissionsByPool[payload.poolId] = {}
        view.bracketSubmissionsByPool[payload.poolId][payload.userId] = payload
      }
      if (event.type === 'OfficialResultsSnapshotRecorded') {
        if (!officialResultsSnapshotSignerMatches(event)) continue
        view.officialResultsSnapshots[payload.poolId] = payload
        view.officialResultsSnapshotEvents[payload.poolId] = event
      }
      if (event.type === 'PayoutRecipientDeclared') {
        if (!payoutRecipientSignerMatches(event)) continue
        const key = `${payload.poolId}:${payload.userId}`
        view.payoutRecipientDeclarations[key] = payload
        if (!view.payoutRecipientDeclarationsByPool[payload.poolId]) view.payoutRecipientDeclarationsByPool[payload.poolId] = {}
        view.payoutRecipientDeclarationsByPool[payload.poolId][payload.userId] = payload
      }
      if (event.type === 'BracketPoolSettlementResolved') {
        view.poolResults[payload.poolId] = payload
      }
      if (event.type === 'QvacPoolSettlementAttestationCreated') {
        if (!qvacAttestationSignerMatches(event)) continue
        view.poolAttestations[payload.poolId] = payload
      }
      if (event.type === 'TetherWdkPoolPayoutPrepared') {
        if (!wdkSettlementSignerMatches(event)) continue
        view.poolPayouts[payload.payoutId] = payload
      }
      if (event.type === 'SettlementReceiptCreated') {
        view.settlementReceipts[payload.receiptId] = payload
        view.settlementReceiptEvents[payload.receiptId] = event
        const settlementEventId = payload.events && payload.events.settlement && payload.events.settlement.eventId
        if (settlementEventId) {
          view.settlementReceiptsBySettlementEvent[settlementEventId] = payload
          view.settlementReceiptEventsBySettlementEvent[settlementEventId] = event
        }
      }
      if (event.type === 'SettlementReceiptRejected') {
        view.settlementReceiptRejections.push(payload)
      }
      if (event.type === 'GameSessionDisputed') {
        view.disputes.push(payload)
        if (payload.gameId && view.gameSessions[payload.gameId]) {
          view.gameSessions[payload.gameId].status = 'disputed'
          delete view.activeGameSessions[payload.gameId]
        }
      }
      if (event.type === 'TetherWdkEscrowDisputed' || event.type === 'TetherWdkPoolPayoutDisputed') {
        if (!wdkDisputeSignerMatches(event)) continue
        view.disputes.push(payload)
      }
    }

    for (const [matchId, matchEvents] of Object.entries(view.matchEventsByMatch)) {
      view.statSnapshots[matchId] = statSnapshotForEvents(matchId, matchEvents)
    }

    for (const session of Object.values(view.gameSessions)) {
      session.score = (session.players || []).reduce((score, player) => {
        if (player.userId) score[player.userId] = 0
        return score
      }, {})
      session.currentRound = 0
    }
    const roundResults = Object.values(view.roundResults).sort((left, right) => {
      if (left.gameId !== right.gameId) return String(left.gameId).localeCompare(String(right.gameId))
      return String(left.roundId).localeCompare(String(right.roundId))
    })
    for (const roundResult of roundResults) {
      const session = view.gameSessions[roundResult.gameId]
      if (!session) continue
      const winnerUserId = core.winnerUserIdForRoundResult(roundResult)
      if (winnerUserId) session.score[winnerUserId] = (session.score[winnerUserId] || 0) + 1
      const roundIndex = roundIndexFromRoundId(roundResult.roundId)
      if (roundIndex !== null) session.currentRound = Math.max(session.currentRound, roundIndex + 1)
      if (roundResult.outcome === 'disputed') {
        session.status = 'disputed'
        delete view.activeGameSessions[roundResult.gameId]
      }
    }

    return view
  }

  function mergeUniqueEvents (target, incomingEvents, opts = {}) {
    let merged = 0
    const candidates = []
    const seenEventIds = new Set(target.map(event => event.eventId))
    for (const event of incomingEvents || []) {
      if (!event || !event.eventId || seenEventIds.has(event.eventId)) continue
      if (opts.validate !== false && !validateEventEnvelope(event).ok) continue
      candidates.push(event)
      seenEventIds.add(event.eventId)
    }
    const dependencyIndex = eventIndex([...target, ...candidates])
    for (const event of candidates) {
      if (!settlementEventDependenciesSatisfied(event, dependencyIndex)) continue
      target.push(event)
      if (opts.mergedEvents) opts.mergedEvents.push(event)
      merged++
    }
    return merged
  }

  function roundIdFromIndex (roundIndex) {
    return `pc-${roundIndex + 1}`
  }

  function roundIndexFromRoundId (roundId) {
    const match = /^pc-([1-9]\d*)$/.exec(String(roundId || ''))
    return match ? Number(match[1]) - 1 : null
  }

  function normalizeRoundIdentity (payload = {}) {
    const explicitRoundId = payload.roundId == null ? null : String(payload.roundId)
    const hasRoundIndex = payload.roundIndex !== undefined && payload.roundIndex !== null
    const parsedRoundIndex = explicitRoundId ? roundIndexFromRoundId(explicitRoundId) : null

    if (explicitRoundId && parsedRoundIndex === null) {
      return {
        ok: false,
        roundId: explicitRoundId,
        roundIndex: hasRoundIndex ? payload.roundIndex : null,
        expectedRoundId: null,
        reason: `roundId ${explicitRoundId} must use pc-N format`
      }
    }

    if (hasRoundIndex && (!Number.isInteger(payload.roundIndex) || payload.roundIndex < 0)) {
      return {
        ok: false,
        roundId: explicitRoundId,
        roundIndex: payload.roundIndex,
        expectedRoundId: null,
        reason: 'roundIndex must be a non-negative integer'
      }
    }

    const roundIndex = hasRoundIndex ? payload.roundIndex : parsedRoundIndex
    if (roundIndex === null) {
      return {
        ok: false,
        roundId: explicitRoundId,
        roundIndex: null,
        expectedRoundId: null,
        reason: 'roundIndex or roundId is required'
      }
    }

    const expectedRoundId = roundIdFromIndex(roundIndex)
    if (explicitRoundId && explicitRoundId !== expectedRoundId) {
      return {
        ok: false,
        roundId: explicitRoundId,
        roundIndex,
        expectedRoundId,
        reason: `roundId ${explicitRoundId} does not match roundIndex ${roundIndex} (${expectedRoundId})`
      }
    }

    return {
      ok: true,
      roundId: explicitRoundId || expectedRoundId,
      roundIndex,
      expectedRoundId
    }
  }

  function createWorkerSim ({ events = [], adapters = adapterFactory.createIntegrationAdapters(), storage } = {}) {
    const storedEvents = storage && typeof storage.readEvents === 'function' ? storage.readEvents() : []
    const log = []
    mergeUniqueEvents(log, storedEvents)
    const providedEvents = []
    mergeUniqueEvents(log, events, { mergedEvents: providedEvents })
    if (storage && typeof storage.appendEvents === 'function' && providedEvents.length > 0) storage.appendEvents(providedEvents)

    function hasEvent (eventId) {
      return log.some(event => event.eventId === eventId)
    }

    function mergeEvents (incomingEvents) {
      const mergedEvents = []
      mergeUniqueEvents(log, incomingEvents, { mergedEvents })
      if (storage && typeof storage.appendEvents === 'function' && mergedEvents.length > 0) storage.appendEvents(mergedEvents)
      return mergedEvents.length
    }

    function append (type, payload, actorId = 'system') {
      const event = eventEnvelope({
        type,
        actorId,
        payload,
        previousEventId: log.length ? log[log.length - 1].eventId : null,
        sequence: log.length + 1
      })
      log.push(event)
      if (storage && typeof storage.appendEvents === 'function') storage.appendEvents([event])
      return event
    }

    function isPromiseLike (value) {
      return value && typeof value.then === 'function'
    }

    function completeAdapterResult (value, mapResult, awaitAdapters) {
      if (!isPromiseLike(value)) return mapResult(value)
      if (!awaitAdapters) throw new Error('Async adapter result received; use dispatchAsync')
      return value.then(mapResult)
    }

    function attemptAdapterResult (createValue, mapResult, mapError, awaitAdapters) {
      try {
        const value = createValue()
        if (!isPromiseLike(value)) return mapResult(value)
        if (!awaitAdapters) throw new Error('Async adapter result received; use dispatchAsync')
        return value.then(mapResult, mapError)
      } catch (error) {
        if (mapError) return mapError(error)
        throw error
      }
    }

    function assertAdapterCanRun (adapter, methodName, awaitAdapters) {
      const method = adapter && adapter[methodName]
      const methodIsAsync = method && method.constructor && method.constructor.name === 'AsyncFunction'
      if (!awaitAdapters && (adapter && adapter.async === true || methodIsAsync)) {
        throw new Error('Async adapter configured; use dispatchAsync')
      }
    }

    function adapterActorId (adapter, fallback) {
      return adapter && adapter.id || fallback
    }

    function qvacCommandActorId (payload = {}, fallback = 'qvac-ref') {
      return payload.qvacActorId || adapterActorId(adapters.qvac, fallback)
    }

    function qvacCommentaryCommandActorId (payload = {}, fallback = 'qvac-commentary') {
      return payload.qvacCommentaryActorId || adapterActorId(adapters.qvacCommentary, fallback)
    }

    function tetherWdkCommandActorId (payload = {}, fallback = 'tether-wdk') {
      return payload.wdkActorId || adapterActorId(adapters.tetherWdk, fallback)
    }

    function findEvent (type, predicate) {
      return log.find(event => event.type === type && (!predicate || predicate(event.payload, event)))
    }

    function findLatestEvent (type, predicate) {
      for (let index = log.length - 1; index >= 0; index--) {
        const event = log[index]
        if (event.type === type && (!predicate || predicate(event.payload, event))) return event
      }
      return null
    }

    function processorStatusFor (payload = {}) {
      const processor = payload.processorRelease || payload.processorPayout
      return processor && processor.status || payload.status || null
    }

    function isRecipientRequiredSettlement (event) {
      return Boolean(event && event.payload && processorStatusFor(event.payload) === 'recipient-required')
    }

    function appendCommentaryRejected ({ payload = {}, reason, actorId }) {
      return append('CommentaryRejected', {
        matchId: payload.matchId || null,
        language: normalizeLanguage(payload.language),
        reason,
        status: 'rejected'
      }, actorId)
    }

    function commentaryCacheKeyFor ({ matchId, language, sourceEventIds = [], tone = 'broadcast' }) {
      return core.deterministicHash({
        matchId,
        language: normalizeLanguage(language),
        sourceEventIds,
        tone
      })
    }

    function recentMatchEventsForCommentary ({ matchId, current, windowSize = 6 }) {
      const events = current.matchEventsByMatch[matchId] || []
      return events.slice(Math.max(0, events.length - windowSize))
    }

    function commentaryInputForPayload (payload, current) {
      const matchId = payload.matchId || null
      const language = normalizeLanguage(payload.language || current.commentaryLanguages[matchId] || 'EN')
      const recentEvents = recentMatchEventsForCommentary({
        matchId,
        current,
        windowSize: Number.isInteger(payload.windowSize) ? payload.windowSize : 6
      })
      const currentStats = current.statSnapshots[matchId] || statSnapshotForEvents(matchId, recentEvents)
      return {
        matchId,
        language,
        clock: payload.clock || currentStats.clock,
        score: currentStats.score,
        recentEvents,
        currentStats,
        roomPickDistribution: payload.roomPickDistribution || {},
        tone: payload.tone || 'broadcast'
      }
    }

    function findExistingCommentaryEvent ({ matchId, language, sourceEventIds, tone }) {
      const cacheKey = commentaryCacheKeyFor({ matchId, language, sourceEventIds, tone })
      return findLatestEvent('CommentaryGenerated', segment => segment.cacheKey === cacheKey)
    }

    function appendVerifiedCommentarySegment ({ segment, input, actorId }) {
      const language = normalizeLanguage(input.language)
      const sourceEventIds = input.recentEvents.map(event => event.sourceEventId || event.workerEventId || event.eventId)
      const basePayload = {
        matchId: input.matchId,
        language,
        clock: segment && segment.clock || input.clock || '00:00',
        text: String(segment && segment.text || '').trim().slice(0, 360),
        sourceEventIds,
        eventHash: core.deterministicHash(sourceEventIds),
        statHash: segment && segment.statHash || core.deterministicHash(input.currentStats || null),
        confidence: Math.max(0, Math.min(1, Number(segment && segment.confidence) || 0)),
        modelId: segment && segment.modelId || null,
        commentatorId: actorId,
        cacheKey: commentaryCacheKeyFor({
          matchId: input.matchId,
          language,
          sourceEventIds,
          tone: input.tone
        }),
        createdAt: segment && segment.createdAt || '2026-07-01T00:00:00.000Z'
      }
      const payload = {
        segmentId: core.deterministicHash(basePayload),
        ...basePayload
      }
      const event = { payload, actorId: payload.commentatorId }
      if (!payload.text) {
        return appendCommentaryRejected({
          payload: input,
          reason: 'QVAC commentary text is required',
          actorId
        })
      }
      if (!commentarySegmentMatchesReplay(event, eventIndex(log))) {
        return appendCommentaryRejected({
          payload: input,
          reason: 'QVAC commentary output must reference replayed match events',
          actorId
        })
      }
      return append('CommentaryGenerated', payload, payload.commentatorId)
    }

    function winnerRoutesAvailable ({ winnerUserIds = [], payoutRecipients = {}, payoutAddress } = {}) {
      const winners = Array.isArray(winnerUserIds) ? winnerUserIds.filter(Boolean) : []
      if (winners.length === 0) return false
      if (payoutAddress) return true
      return winners.every(userId => payoutRecipients && payoutRecipients[userId])
    }

    function winnerFromRoundResult (roundResult) {
      if (!roundResult) return null
      if (core.winnerUserIdForRoundResult) return core.winnerUserIdForRoundResult(roundResult)
      if (roundResult.outcome === 'goal') return roundResult.shooter && roundResult.shooter.id
      return roundResult.keeper && roundResult.keeper.id
    }

    function sameStringList (left = [], right = []) {
      if (!Array.isArray(left) || !Array.isArray(right)) return false
      const sortedLeft = left.map(item => String(item)).sort()
      const sortedRight = right.map(item => String(item)).sort()
      return sortedLeft.length === sortedRight.length && sortedLeft.every((item, index) => item === sortedRight[index])
    }

    function participantUserIdsForRoundResult (roundResult) {
      return core.participantUserIdsForRoundResult
        ? core.participantUserIdsForRoundResult(roundResult)
        : [
            roundResult && roundResult.shooter && roundResult.shooter.id,
            roundResult && roundResult.keeper && roundResult.keeper.id
          ].filter(Boolean)
    }

    function playerEvidenceSignerMatches (event) {
      const payload = event && event.payload || {}
      return Boolean(payload.playerId && event.actorId === payload.playerId)
    }

    function playerEvidenceSignerMismatchReason ({ evidenceType, actorId, playerId }) {
      return `${evidenceType} actorId must match playerId ${playerId || 'unknown-player'} (received ${actorId || 'unknown-actor'})`
    }

    function appendPlayerEvidenceSignerDispute ({ payload = {}, actorId, evidenceType }) {
      return append('GameSessionDisputed', {
        gameId: payload.gameId || null,
        roundId: payload.roundId || null,
        playerId: payload.playerId || null,
        reason: playerEvidenceSignerMismatchReason({
          evidenceType,
          actorId,
          playerId: payload.playerId
        }),
        status: 'held'
      }, actorId)
    }

    function forfeitClaimSignerMatches ({ actorId, claimantUserId, winnerUserId, forfeitingPlayerId }) {
      return Boolean(claimantUserId && actorId === claimantUserId && claimantUserId === winnerUserId && claimantUserId !== forfeitingPlayerId)
    }

    function forfeitClaimSignerMismatchReason ({ actorId, claimantUserId }) {
      return `Forfeit claim must be signed by winning claimant ${claimantUserId || 'unknown-claimant'} (received ${actorId || 'unknown-actor'})`
    }

    function verifyEscrowReleaseTarget ({ escrow, roundResult, attestation, winnerUserId }) {
      const errors = []
      if (!escrow) errors.push('Escrow is required before WDK release')
      if (!roundResult) errors.push('Round result is required before WDK release')
      if (!attestation) errors.push('QVAC attestation is required before WDK release')
      if (!escrow || !roundResult) return { ok: errors.length === 0, errors }

      if (escrow.gameId !== roundResult.gameId) errors.push('Escrow gameId does not match round result')
      const expectedWinnerUserId = winnerFromRoundResult(roundResult)
      if (winnerUserId !== expectedWinnerUserId) errors.push('Winner must match QVAC-decided round outcome')
      const expectedParticipants = participantUserIdsForRoundResult(roundResult)
      if (!sameStringList(escrow.players, expectedParticipants)) errors.push('Escrow players do not match round participants')
      if (attestation && attestation.winnerUserId && attestation.winnerUserId !== winnerUserId) {
        errors.push('Winner must match QVAC attestation winner')
      }
      if (attestation && Array.isArray(attestation.participantUserIds) && attestation.participantUserIds.length > 0 && !sameStringList(attestation.participantUserIds, escrow.players)) {
        errors.push('Escrow players must match QVAC attestation participants')
      }

      return { ok: errors.length === 0, errors }
    }

    function samePayloadEvidence (left, right) {
      if (!left || !right) return false
      return core.deterministicHash(left) === core.deterministicHash(right)
    }

    function verifyLoggedRoundAttestation ({ gameId, roundId, attestation }) {
      const errors = []
      if (!attestation) return { ok: false, errors: ['QVAC attestation is required before WDK release'] }
      const event = findEvent('QvacRefereeAttestationCreated', item =>
        item.gameId === gameId &&
        item.roundId === roundId &&
        item.attestationId === attestation.attestationId)
      if (!event) {
        errors.push('QVAC attestation event must be present in the worker log before WDK release')
      } else if (!samePayloadEvidence(event.payload, attestation)) {
        errors.push('WDK release attestation must match the replayed QVAC event payload')
      } else if (!qvacAttestationSignerMatches(event)) {
        errors.push(qvacAttestationSignerMismatchReason({
          actorId: event.actorId,
          refereeId: event.payload && event.payload.refereeId
        }))
      }
      return { ok: errors.length === 0, errors }
    }

    function verifyLoggedPoolAttestation ({ poolId, attestation }) {
      const errors = []
      if (!attestation) return { ok: false, errors: ['QVAC pool attestation is required before WDK payout'] }
      const event = findEvent('QvacPoolSettlementAttestationCreated', item =>
        item.poolId === poolId &&
        item.attestationId === attestation.attestationId)
      if (!event) {
        errors.push('QVAC pool attestation event must be present in the worker log before WDK payout')
      } else if (!samePayloadEvidence(event.payload, attestation)) {
        errors.push('WDK pool payout attestation must match the replayed QVAC event payload')
      } else if (!qvacAttestationSignerMatches(event)) {
        errors.push(qvacAttestationSignerMismatchReason({
          actorId: event.actorId,
          refereeId: event.payload && event.payload.refereeId
        }))
      }
      return { ok: errors.length === 0, errors }
    }

    function roundEvidenceEvents ({ gameId, roundId, shooter, keeper } = {}) {
      const shooterId = shooter && shooter.id
      const keeperId = keeper && keeper.id
      return {
        shooterCommitmentEvent: findEvent('GameCommitmentSubmitted', (item, event) => item.gameId === gameId && item.roundId === roundId && item.playerId === shooterId && playerEvidenceSignerMatches(event)),
        keeperCommitmentEvent: findEvent('GameCommitmentSubmitted', (item, event) => item.gameId === gameId && item.roundId === roundId && item.playerId === keeperId && playerEvidenceSignerMatches(event)),
        shooterRevealEvent: findEvent('GameInputRevealed', (item, event) => item.gameId === gameId && item.roundId === roundId && item.playerId === shooterId && playerEvidenceSignerMatches(event)),
        keeperRevealEvent: findEvent('GameInputRevealed', (item, event) => item.gameId === gameId && item.roundId === roundId && item.playerId === keeperId && playerEvidenceSignerMatches(event))
      }
    }

    function roundStateHashEvents ({ gameId, roundId, participantUserIds = [] } = {}) {
      const participants = new Set((participantUserIds || []).filter(Boolean))
      return log.filter(event => {
        const payload = event.payload || {}
        return event.type === 'GameRoundStateHashSubmitted' &&
          payload.gameId === gameId &&
          payload.roundId === roundId &&
          (!participants.size || participants.has(payload.playerId))
      })
    }

    function verifyRoundStateHashConsensus ({ gameId, roundId, participantUserIds = [], stateHash, resolverVersion }) {
      const errors = []
      const participants = new Set((participantUserIds || []).filter(Boolean))
      const events = roundStateHashEvents({ gameId, roundId })
      const submittedBy = new Set()
      if (participants.size === 0) errors.push('Round participants are required before peer state hash consensus')
      for (const event of events) {
        const payload = event.payload || {}
        if (!participants.has(payload.playerId)) errors.push(`Peer state hash submitted by non-participant ${payload.playerId || 'unknown-player'}`)
        if (payload.playerId && event.actorId !== payload.playerId) {
          errors.push(playerEvidenceSignerMismatchReason({
            evidenceType: 'Peer state hash',
            actorId: event.actorId,
            playerId: payload.playerId
          }))
        }
        if (payload.playerId && event.actorId === payload.playerId) submittedBy.add(payload.playerId)
        if (payload.stateHash !== stateHash) errors.push(`Peer state hash mismatch for ${payload.playerId || 'unknown-player'}`)
        if (payload.resolverVersion && payload.resolverVersion !== resolverVersion) {
          errors.push(`Peer state hash resolverVersion mismatch for ${payload.playerId || 'unknown-player'}`)
        }
      }
      for (const playerId of participants) {
        if (!submittedBy.has(playerId)) errors.push(`Peer state hash missing for ${playerId}`)
      }
      return { ok: errors.length === 0, errors, events }
    }

    function verifyRoundSourceEvents (roundResult) {
      const errors = []
      if (!roundResult) return { ok: false, errors: ['Round result is required before source event verification'] }
      const sourceEventIds = Array.isArray(roundResult.sourceEventIds) ? roundResult.sourceEventIds : []
      const isForfeitRound = roundResult.outcome === 'forfeit'
      if (!isForfeitRound && sourceEventIds.length < 4) errors.push('Round result sourceEventIds must include commitment and reveal events')
      const byId = new Map(log.map(event => [event.eventId, event]))
      for (const eventId of sourceEventIds) {
        if (!byId.has(eventId)) errors.push(`Round source event ${eventId} is missing from the worker log`)
      }

      if (isForfeitRound) {
        const participants = new Set(participantUserIdsForRoundResult(roundResult))
        const forfeitEvents = sourceEventIds
          .map(eventId => byId.get(eventId))
          .filter(event => event && event.type === 'GameRoundForfeitRecorded')
        if (forfeitEvents.length === 0) {
          errors.push('Round source events missing GameRoundForfeitRecorded for forfeit')
        }
        for (const event of forfeitEvents) {
          const payload = event.payload || {}
          if (payload.gameId !== roundResult.gameId || payload.roundId !== roundResult.roundId) {
            errors.push('Forfeit source event does not match round identity')
          }
          if (!participants.has(payload.forfeitingPlayerId)) {
            errors.push(`Forfeit source event forfeiting player is not a participant: ${payload.forfeitingPlayerId || 'unknown-player'}`)
          }
          if (!participants.has(payload.winnerUserId)) {
            errors.push(`Forfeit source event winner is not a participant: ${payload.winnerUserId || 'unknown-player'}`)
          }
          if (payload.forfeitingPlayerId === payload.winnerUserId) {
            errors.push('Forfeit source event winner cannot be the forfeiting player')
          }
          if (payload.forfeitingPlayerId !== roundResult.forfeitingPlayerId) {
            errors.push('Forfeit source event forfeiting player does not match round result')
          }
          if (payload.winnerUserId !== roundResult.winnerUserId) {
            errors.push('Forfeit source event winner does not match round result')
          }
          if (!participants.has(payload.claimantUserId)) {
            errors.push(`Forfeit source event claimant is not a participant: ${payload.claimantUserId || 'unknown-claimant'}`)
          }
          if (payload.claimantUserId !== payload.winnerUserId) {
            errors.push('Forfeit source event claimant must match the winning player')
          }
          if (roundResult.claimantUserId && payload.claimantUserId !== roundResult.claimantUserId) {
            errors.push('Forfeit source event claimant does not match round result')
          }
          if (payload.claimantUserId && event.actorId !== payload.claimantUserId) {
            errors.push(`Forfeit source event signer must match claimantUserId ${payload.claimantUserId}`)
          }
        }
      } else {
        const required = [
          ['GameCommitmentSubmitted', roundResult.shooter && roundResult.shooter.id],
          ['GameCommitmentSubmitted', roundResult.keeper && roundResult.keeper.id],
          ['GameInputRevealed', roundResult.shooter && roundResult.shooter.id],
          ['GameInputRevealed', roundResult.keeper && roundResult.keeper.id]
        ]
        for (const [type, playerId] of required) {
          const matched = sourceEventIds
            .map(eventId => byId.get(eventId))
            .some(event => event &&
              event.type === type &&
              event.payload &&
              event.payload.gameId === roundResult.gameId &&
              event.payload.roundId === roundResult.roundId &&
              event.payload.playerId === playerId &&
              event.actorId === playerId)
          if (!matched) errors.push(`Round source events missing ${type} for ${playerId || 'unknown-player'}`)
        }
      }

      const playerEvidenceSourceEvents = sourceEventIds
        .map(eventId => byId.get(eventId))
        .filter(event => event && (event.type === 'GameCommitmentSubmitted' || event.type === 'GameInputRevealed'))
      for (const event of playerEvidenceSourceEvents) {
        const payload = event.payload || {}
        if (payload.playerId && event.actorId !== payload.playerId) {
          errors.push(`Round source event ${event.type} signer must match playerId ${payload.playerId}`)
        }
      }

      const participants = new Set(participantUserIdsForRoundResult(roundResult))
      const peerStateHashEvents = sourceEventIds
        .map(eventId => byId.get(eventId))
        .filter(event => event && event.type === 'GameRoundStateHashSubmitted')
      for (const event of peerStateHashEvents) {
        const payload = event.payload || {}
        if (payload.gameId !== roundResult.gameId || payload.roundId !== roundResult.roundId) {
          errors.push('Peer state hash source event does not match round identity')
        }
        if (!participants.has(payload.playerId)) {
          errors.push(`Peer state hash source event submitted by non-participant ${payload.playerId || 'unknown-player'}`)
        }
        if (payload.playerId && event.actorId !== payload.playerId) {
          errors.push(`Peer state hash source event signer must match playerId ${payload.playerId}`)
        }
        if (payload.stateHash !== roundResult.stateHash) {
          errors.push(`Peer state hash source event mismatch for ${payload.playerId || 'unknown-player'}`)
        }
        if (payload.resolverVersion && payload.resolverVersion !== roundResult.resolverVersion) {
          errors.push(`Peer state hash source event resolverVersion mismatch for ${payload.playerId || 'unknown-player'}`)
        }
      }
      if (Array.isArray(roundResult.peerStateHashEventIds) && roundResult.peerStateHashEventIds.length > 0) {
        const actualEventIds = peerStateHashEvents.map(event => event.eventId)
        if (!sameStringList(actualEventIds, roundResult.peerStateHashEventIds)) {
          errors.push('Round result peerStateHashEventIds must match replayed peer state hash source events')
        }
      }

      return { ok: errors.length === 0, errors }
    }

    function poolPaymentSourceEvents ({ poolId, confirmedEntries = [] } = {}) {
      return confirmedEntries.map(entry => {
        return findEvent('TetherWdkEntryConfirmed', payment => {
          return payment.poolId === poolId && payment.paymentId === entry.paymentId
        })
      }).filter(Boolean)
    }

    function bracketSubmissionSourceEvents ({ poolId, confirmedEntries = [] } = {}) {
      return confirmedEntries.map(entry => {
        return findEvent('BracketSubmissionLocked', (submission, event) => {
          return submission.poolId === poolId &&
            submission.userId === entry.userId &&
            bracketSubmissionSignerMatches(event) &&
            (!submission.entryId || !entry.entryId || submission.entryId === entry.entryId)
        })
      }).filter(Boolean)
    }

    function officialResultsHash (officialResults = {}) {
      return core.deterministicHash(officialResults || {})
    }

    function officialResultsSnapshotPayload ({ poolId, officialResults = {}, rulesVersion = 'bracket-pool-v1', source = 'trusted-results-feed', sourceActorId } = {}) {
      const results = officialResults || {}
      const resultsHash = officialResultsHash(results)
      const trustedSourceActorId = officialResultsSourceActorIdFor({ officialResults: results, source, sourceActorId })
      return {
        snapshotId: core.deterministicHash({
          type: 'OfficialResultsSnapshotRecorded',
          poolId,
          officialResultsHash: resultsHash,
          rulesVersion,
          source,
          sourceActorId: trustedSourceActorId
        }),
        poolId,
        officialResults: results,
        officialResultsHash: resultsHash,
        rulesVersion,
        source,
        sourceActorId: trustedSourceActorId,
        recordedAt: '2026-07-01T00:00:00.000Z'
      }
    }

    function officialResultsSnapshotEventFor ({ poolId, officialResults = {}, source, sourceActorId } = {}) {
      const expectedHash = officialResultsHash(officialResults)
      const expectedSourceActorId = officialResultsSourceActorIdFor({ officialResults, source, sourceActorId })
      return findEvent('OfficialResultsSnapshotRecorded', (snapshot, event) => {
        return snapshot.poolId === poolId &&
          snapshot.officialResultsHash === expectedHash &&
          snapshot.sourceActorId === expectedSourceActorId &&
          officialResultsSnapshotSignerMatches(event)
      })
    }

    function ensureOfficialResultsSnapshotEvent ({ poolId, officialResults = {}, rulesVersion = 'bracket-pool-v1', source = 'trusted-results-feed', sourceActorId, actorId }) {
      const snapshotPayload = officialResultsSnapshotPayload({
        poolId,
        officialResults,
        rulesVersion,
        source,
        sourceActorId
      })
      const existing = officialResultsSnapshotEventFor({
        poolId,
        officialResults,
        source,
        sourceActorId: snapshotPayload.sourceActorId
      })
      if (existing) return existing
      if (actorId !== snapshotPayload.sourceActorId) {
        return append('OfficialResultsSnapshotRejected', {
          poolId: poolId || null,
          officialResultsHash: snapshotPayload.officialResultsHash,
          source: snapshotPayload.source,
          sourceActorId: snapshotPayload.sourceActorId,
          reason: officialResultsSnapshotSignerMismatchReason({ actorId, sourceActorId: snapshotPayload.sourceActorId }),
          status: 'rejected'
        }, actorId)
      }
      return append('OfficialResultsSnapshotRecorded', snapshotPayload, actorId)
    }

    function verifyPoolSourceEvents (poolResult) {
      const errors = []
      if (!poolResult) return { ok: false, errors: ['Pool settlement result is required before source event verification'] }
      if (poolResult.sourceEventMode !== 'worker-log') {
        return { ok: false, errors: ['Pool settlement must use worker-log source events before QVAC attestation or WDK payout'] }
      }
      const sourceEventIds = Array.isArray(poolResult.sourceEventIds) ? poolResult.sourceEventIds : []
      const sourcePaymentIds = Array.isArray(poolResult.sourcePaymentIds) ? poolResult.sourcePaymentIds : []
      const sourceBracketSubmissionIds = Array.isArray(poolResult.sourceBracketSubmissionIds) ? poolResult.sourceBracketSubmissionIds : []
      if (sourceEventIds.length < sourcePaymentIds.length + sourceBracketSubmissionIds.length + 1) {
        errors.push('Pool result sourceEventIds must include confirmed entry payment events, bracket submissions, and official results snapshot')
      }

      const byId = new Map(log.map(event => [event.eventId, event]))
      const replayIndex = eventIndex(log)
      for (const eventId of sourceEventIds) {
        if (!byId.has(eventId)) errors.push(`Pool source event ${eventId} is missing from the worker log`)
      }

      for (const paymentId of sourcePaymentIds) {
        const matchedPaymentEvent = sourceEventIds
          .map(eventId => byId.get(eventId))
          .find(event => event &&
            event.type === 'TetherWdkEntryConfirmed' &&
            event.payload &&
            event.payload.poolId === poolResult.poolId &&
            event.payload.paymentId === paymentId)
        if (!matchedPaymentEvent) {
          errors.push(`Pool source events missing TetherWdkEntryConfirmed for ${paymentId || 'unknown-payment'}`)
          continue
        }
        const payment = matchedPaymentEvent.payload || {}
        const intentEvent = log.find(event =>
          event.type === 'TetherWdkEntryIntentCreated' &&
          event.payload &&
          event.payload.intentId === payment.intentId)
        if (!intentEvent) {
          errors.push(`Pool payment source event missing entrant-signed TetherWdkEntryIntentCreated for ${payment.intentId || 'unknown-intent'}`)
        } else {
          if (!entryIntentSignerMatches(intentEvent)) errors.push(`Entry intent source event signer must match userId ${intentEvent.payload && intentEvent.payload.userId || 'unknown-user'}`)
          if (!entryPaymentSignerMatches({ event: matchedPaymentEvent, intentEvent })) {
            errors.push(entryPaymentSignerMismatchReason({
              actorId: matchedPaymentEvent.actorId,
              rail: entryPaymentRailFor({ payment, intent: intentEvent.payload })
            }))
          }
          if (!paymentMatchesSignedEntryIntent({ payment, intentEvent })) {
            errors.push(`Pool payment source event does not match signed entry intent ${payment.intentId || 'unknown-intent'}`)
          }
        }
        if (validEntryRefundEventForPayment(replayIndex, paymentId, poolResult.poolId)) {
          errors.push(`Pool source payment ${paymentId || 'unknown-payment'} has been refunded by WDK rail`)
        }
      }

      for (const submissionId of sourceBracketSubmissionIds) {
        const matched = sourceEventIds
          .map(eventId => byId.get(eventId))
          .some(event => event &&
            event.type === 'BracketSubmissionLocked' &&
            event.payload &&
            event.payload.poolId === poolResult.poolId &&
            event.payload.submissionId === submissionId &&
            bracketSubmissionSignerMatches(event))
        if (!matched) errors.push(`Pool source events missing BracketSubmissionLocked for ${submissionId || 'unknown-submission'}`)
      }

      const bracketSourceEvents = sourceEventIds
        .map(eventId => byId.get(eventId))
        .filter(event => event && event.type === 'BracketSubmissionLocked')
      for (const event of bracketSourceEvents) {
        const payload = event.payload || {}
        if (payload.poolId !== poolResult.poolId) {
          errors.push('Bracket submission source event does not match pool identity')
        }
        if (payload.userId && event.actorId !== payload.userId) {
          errors.push(`Bracket submission source event signer must match userId ${payload.userId}`)
        }
      }

      const expectedResultsHash = officialResultsHash(poolResult.officialResults || {})
      const expectedSourceActorId = officialResultsSourceActorIdFor({
        officialResults: poolResult.officialResults || {},
        source: poolResult.officialResults && poolResult.officialResults.source,
        sourceActorId: poolResult.officialResults && poolResult.officialResults.sourceActorId
      })
      const matchedOfficialResults = sourceEventIds
        .map(eventId => byId.get(eventId))
        .some(event => event &&
          event.type === 'OfficialResultsSnapshotRecorded' &&
          event.payload &&
          event.payload.poolId === poolResult.poolId &&
          event.payload.officialResultsHash === expectedResultsHash &&
          event.payload.sourceActorId === expectedSourceActorId &&
          officialResultsSnapshotSignerMatches(event))
      if (!matchedOfficialResults) {
        errors.push(`Pool source events missing signed OfficialResultsSnapshotRecorded for ${poolResult.poolId || 'unknown-pool'}`)
      }

      const officialResultSourceEvents = sourceEventIds
        .map(eventId => byId.get(eventId))
        .filter(event => event && event.type === 'OfficialResultsSnapshotRecorded')
      for (const event of officialResultSourceEvents) {
        const payload = event.payload || {}
        if (payload.poolId !== poolResult.poolId) {
          errors.push('Official results source event does not match pool identity')
        }
        if (payload.officialResultsHash !== expectedResultsHash) {
          errors.push('Official results source event hash does not match settlement officialResultsHash')
        }
        if (payload.sourceActorId !== expectedSourceActorId) {
          errors.push(`Official results source event sourceActorId must match ${expectedSourceActorId}`)
        }
        if (!officialResultsSnapshotSignerMatches(event)) {
          errors.push(`Official results source event signer must match sourceActorId ${payload.sourceActorId || expectedSourceActorId}`)
        }
      }

      return { ok: errors.length === 0, errors }
    }

    function appendRoundIdentityDispute ({ payload = {}, identity, actorId }) {
      return append('GameSessionDisputed', {
        gameId: payload.gameId || null,
        roundId: identity && (identity.roundId || identity.expectedRoundId) || payload.roundId || null,
        roundIndex: identity && identity.roundIndex !== undefined ? identity.roundIndex : payload.roundIndex,
        expectedRoundId: identity && identity.expectedRoundId || null,
        reason: identity && identity.reason || 'Round identity is invalid',
        status: 'held'
      }, actorId)
    }

    function gameSettlementSummary ({ roundEvent, attestationEvent, settlementEvent }) {
      const released = settlementEvent && settlementEvent.type === 'TetherWdkEscrowReleased'
      const refunded = settlementEvent && settlementEvent.type === 'TetherWdkEscrowRefunded'
      const routeBlocked = released && isRecipientRequiredSettlement(settlementEvent)
      return {
        type: released && !routeBlocked
          ? 'TrustedGameSettlementCompleted'
          : 'TrustedGameSettlementHeld',
        status: released
          ? routeBlocked ? 'recipient-required' : 'prepared'
          : refunded ? 'refunded' : 'held',
        roundEvent,
        attestationEvent,
        settlementEvent
      }
    }

    function poolSettlementSummary ({ poolResultEvent, attestationEvent, settlementEvent, recipientDeclarationEvents = [] }) {
      const prepared = settlementEvent && settlementEvent.type === 'TetherWdkPoolPayoutPrepared'
      const routeBlocked = prepared && isRecipientRequiredSettlement(settlementEvent)
      return {
        type: prepared && !routeBlocked
          ? 'TrustedPoolSettlementCompleted'
          : 'TrustedPoolSettlementHeld',
        status: prepared
          ? routeBlocked ? 'recipient-required' : 'prepared'
          : 'held',
        poolResultEvent,
        attestationEvent,
        settlementEvent,
        recipientDeclarationEvents
      }
    }

    function declaredPayoutRecipientsFor ({ poolId, winnerUserIds = [], current = createView(log) }) {
      const byPool = current.payoutRecipientDeclarationsByPool[poolId] || {}
      return winnerUserIds.reduce((recipients, userId) => {
        const declaration = byPool[userId]
        if (declaration && declaration.recipient) recipients[userId] = declaration.recipient
        return recipients
      }, {})
    }

    function payoutRecipientsForSettlementPayload (payload, current = createView(log)) {
      const explicit = payload.payoutRecipients && Object.keys(payload.payoutRecipients).length
        ? payload.payoutRecipients
        : null
      if (explicit) return explicit
      return declaredPayoutRecipientsFor({
        poolId: payload.poolId,
        winnerUserIds: payload.winnerUserIds || [],
        current
      })
    }

    function shouldRetryGameRelease ({ existingRelease, winnerUserId, payload = {} }) {
      return existingRelease &&
        isRecipientRequiredSettlement(existingRelease) &&
        winnerRoutesAvailable({
          winnerUserIds: [winnerUserId],
          payoutRecipients: payload.payoutRecipients || {},
          payoutAddress: payload.payoutAddress
        })
    }

    function existingGameRefundEvent (escrowId) {
      return escrowId
        ? findLatestEvent('TetherWdkEscrowRefunded', refund => refund.escrowId === escrowId)
        : null
    }

    function shouldRefundHeldGameEscrow ({ settlementEvent, payload = {} }) {
      return payload.refundOnDispute === true &&
        settlementEvent &&
        settlementEvent.type === 'TetherWdkEscrowDisputed' &&
        payload.escrowId
    }

    function gameEscrowRefundCommand ({ payload, roundId, settlementEvent, actorId }) {
      const dispute = settlementEvent && settlementEvent.payload || {}
      return {
        type: 'wdk:refundGameEscrow',
        actorId: tetherWdkCommandActorId(payload, actorId),
        payload: {
          gameId: payload.gameId,
          roundId,
          escrowId: payload.escrowId,
          reason: payload.refundReason || dispute.reason || 'game-escrow-refunded',
          refundUserIds: payload.refundUserIds,
          payoutAddress: payload.payoutAddress,
          payoutRecipients: payload.payoutRecipients
        }
      }
    }

    function shouldRetryPoolPayout ({ existingPayout, winnerUserIds = [], payoutRecipients = {}, payoutAddress }) {
      return existingPayout &&
        isRecipientRequiredSettlement(existingPayout) &&
        winnerRoutesAvailable({
          winnerUserIds,
          payoutRecipients,
          payoutAddress
        })
    }

    function recipientDeclarationEventsFor ({ poolId, winnerUserIds = [] }) {
      const wanted = new Set(winnerUserIds)
      const latest = new Map()
      for (const event of log) {
        if (event.type !== 'PayoutRecipientDeclared') continue
        if (!payoutRecipientSignerMatches(event)) continue
        const payload = event.payload || {}
        if (payload.poolId !== poolId) continue
        if (wanted.size > 0 && !wanted.has(payload.userId)) continue
        latest.set(payload.userId, event)
      }
      return Array.from(latest.values())
    }

    function appendEscrowDispute ({ payload, reason, actorId, awaitAdapters }) {
      const rail = adapterActorId(adapters.tetherWdk, actorId)
      const disputeInput = {
        gameId: payload.gameId,
        roundId: payload.roundId,
        escrowId: payload.escrowId,
        reason
      }
      const createDispute = adapters.tetherWdk && typeof adapters.tetherWdk.disputeGameEscrow === 'function'
        ? () => adapters.tetherWdk.disputeGameEscrow(disputeInput)
        : () => ({
            disputeId: core.deterministicHash(disputeInput),
            ...disputeInput,
            status: 'held',
            rail
          })
      return attemptAdapterResult(
        createDispute,
        dispute => {
          const disputeRail = wdkSettlementRailFor(dispute) || rail
          return append('TetherWdkEscrowDisputed', { ...dispute, rail: disputeRail }, disputeRail || actorId)
        },
        null,
        awaitAdapters
      )
    }

    function appendPoolPayoutDispute ({ payload, reason, actorId }) {
      const rail = adapterActorId(adapters.tetherWdk, actorId)
      return append('TetherWdkPoolPayoutDisputed', {
        disputeId: core.deterministicHash({
          poolId: payload.poolId,
          winnerUserIds: payload.winnerUserIds || [],
          reason,
          rail
        }),
        poolId: payload.poolId,
        winnerUserIds: payload.winnerUserIds || [],
        reason,
        status: 'held',
        rail
      }, rail || actorId)
    }

    function sessionEventForEscrowPayload (payload = {}) {
      return findEvent('GameSessionStarted', (session, event) => {
        return (!payload.gameId || session.gameId === payload.gameId) &&
          (!payload.sessionId || session.sessionId === payload.sessionId) &&
          (!payload.sessionEventId || event.eventId === payload.sessionEventId)
      })
    }

    function appendGameEscrowCreationDispute ({ payload = {}, reason, actorId }) {
      const rail = adapterActorId(adapters.tetherWdk, actorId)
      return append('TetherWdkEscrowDisputed', {
        disputeId: core.deterministicHash({
          gameId: payload.gameId || null,
          sessionId: payload.sessionId || null,
          sessionEventId: payload.sessionEventId || null,
          escrowId: payload.escrowId || null,
          reason,
          rail
        }),
        gameId: payload.gameId || null,
        sessionId: payload.sessionId || null,
        sessionEventId: payload.sessionEventId || null,
        escrowId: payload.escrowId || null,
        reason,
        status: 'held',
        rail
      }, rail || actorId)
    }

    function gameEscrowInputForPayload (payload = {}) {
      const sessionEvent = sessionEventForEscrowPayload(payload)
      const requiresSession = payload.prizeMode === true ||
        payload.sessionBound === true ||
        payload.sessionId ||
        payload.sessionEventId
      if (!sessionEvent) {
        return requiresSession
          ? {
              ok: false,
              reason: 'Replayed game session is required before session-bound WDK escrow'
            }
          : { ok: true, input: { ...payload }, sessionEvent: null }
      }
      const session = sessionEvent.payload || {}
      const sessionPlayers = gameSessionPlayerIds(session)
      if (Array.isArray(payload.players) && payload.players.length > 0 && !sameStringList(payload.players, sessionPlayers)) {
        return {
          ok: false,
          reason: 'WDK game escrow players must match replayed game session participants'
        }
      }
      const expectedAmount = stakeAmount(session.stake)
      const expectedAsset = stakeAsset(session.stake)
      if (payload.amount !== undefined && payload.amount !== null && expectedAmount !== null && Number(payload.amount) !== expectedAmount) {
        return {
          ok: false,
          reason: 'WDK game escrow amount must match replayed game session stake'
        }
      }
      if (payload.asset && expectedAsset && payload.asset !== expectedAsset) {
        return {
          ok: false,
          reason: 'WDK game escrow asset must match replayed game session stake'
        }
      }
      const sourceEventIds = [...new Set([...(Array.isArray(payload.sourceEventIds) ? payload.sourceEventIds : []), sessionEvent.eventId])]
      return {
        ok: true,
        sessionEvent,
        input: {
          ...payload,
          gameId: session.gameId,
          players: sessionPlayers,
          amount: payload.amount !== undefined && payload.amount !== null ? payload.amount : expectedAmount,
          asset: payload.asset || expectedAsset || 'USDT',
          rulesVersion: payload.rulesVersion || session.rulesVersion || core.resolverVersion,
          sessionId: session.sessionId,
          sessionEventId: sessionEvent.eventId,
          sessionHash: core.deterministicHash(session),
          sourceEventIds,
          stakeHash: session.stakeHash || (session.stake ? core.deterministicHash(session.stake) : payload.stakeHash || null),
          prizeMode: payload.prizeMode === true || session.prizeMode === true
        }
      }
    }

    function appendVerifiedGameEscrow ({ payload = {}, escrow, actorId }) {
      const rail = wdkSettlementRailFor(escrow)
      if (!rail) {
        return appendGameEscrowCreationDispute({
          payload: { ...payload, escrowId: escrow && escrow.escrowId },
          reason: wdkEscrowSignerMismatchReason({ actorId, rail }),
          actorId
        })
      }
      const inputWasSessionBound = gameEscrowHasSessionBinding(payload)
      if (inputWasSessionBound && !gameEscrowHasSessionBinding(escrow)) {
        return appendGameEscrowCreationDispute({
          payload: { ...payload, escrowId: escrow && escrow.escrowId },
          reason: 'WDK game escrow output must preserve replayed game session evidence',
          actorId
        })
      }
      if (!gameEscrowMatchesReplay({ payload: escrow, actorId: rail }, eventIndex(log))) {
        return appendGameEscrowCreationDispute({
          payload: { ...payload, escrowId: escrow && escrow.escrowId },
          reason: inputWasSessionBound
            ? 'WDK game escrow output did not match replayed game session evidence'
            : 'WDK game escrow output did not match trusted rail evidence',
          actorId
        })
      }
      return append('TetherWdkEscrowCreated', escrow, rail)
    }

    function appendVerifiedRoundAttestation ({ roundResult, attestation, actorId }) {
      const verification = core.verifyQvacRoundAttestation({ roundResult, attestation })
      if (!verification.ok) {
        return append('GameSessionDisputed', {
          gameId: roundResult && roundResult.gameId || null,
          roundId: roundResult && roundResult.roundId || null,
          attestationId: attestation && attestation.attestationId || null,
          reason: `QVAC attestation failed verification: ${verification.errors.join('; ')}`,
          status: 'held'
        }, actorId)
      }
      return append('QvacRefereeAttestationCreated', attestation, attestation.refereeId)
    }

    function appendVerifiedPoolAttestation ({ poolResult, attestation, actorId }) {
      const verification = core.verifyQvacPoolSettlementAttestation({ poolResult, attestation })
      if (!verification.ok) {
        return appendPoolPayoutDispute({
          payload: {
            poolId: poolResult && poolResult.poolId || attestation && attestation.poolId || null,
            winnerUserIds: poolResult && poolResult.winnerUserIds || attestation && attestation.winnerUserIds || []
          },
          reason: `QVAC pool attestation failed verification: ${verification.errors.join('; ')}`,
          actorId
        })
      }
      return append('QvacPoolSettlementAttestationCreated', attestation, attestation.refereeId)
    }

    function appendVerifiedGameRelease ({ payload, payout, actorId, awaitAdapters }) {
      const index = eventIndex(log)
      const rail = wdkSettlementRailFor(payout)
      if (!verifiedGameReleaseMatchesReplay({ payload: payout, actorId: rail }, index)) {
        const reason = !rail
          ? wdkSettlementSignerMismatchReason({ actorId, rail })
          : 'WDK escrow release output did not match replayed QVAC, escrow, and round evidence'
        return appendEscrowDispute({
          payload,
          reason,
          actorId,
          awaitAdapters
        })
      }
      return append('TetherWdkEscrowReleased', payout, rail || actorId)
    }

    function normalizeGameEscrowRefundRail ({ refund, escrow }) {
      if (!refund || typeof refund !== 'object' || refund.rail || !escrow || !escrow.rail) return refund
      return { ...refund, rail: escrow.rail }
    }

    function appendGameEscrowRefundRejected ({ payload, reason, actorId }) {
      return append('TetherWdkEscrowRefundRejected', {
        escrowId: payload.escrowId || (payload.escrow && payload.escrow.escrowId) || null,
        gameId: payload.gameId || (payload.escrow && payload.escrow.gameId) || null,
        reason,
        status: 'rejected'
      }, actorId)
    }

    function appendGameEscrowRefunded ({ refund, escrow, actorId }) {
      const refunded = normalizeGameEscrowRefundRail({ refund, escrow })
      const rail = wdkSettlementRailFor(refunded)
      const index = eventIndex(log)
      if (!gameEscrowRefundMatchesReplay({ payload: refunded, actorId: rail }, index)) {
        const reason = !rail
          ? wdkSettlementSignerMismatchReason({ actorId, rail })
          : 'WDK escrow refund output did not match replayed escrow and dispute evidence'
        return appendGameEscrowRefundRejected({
          payload: { escrowId: escrow && escrow.escrowId, gameId: escrow && escrow.gameId },
          reason,
          actorId
        })
      }
      return append('TetherWdkEscrowRefunded', refunded, rail || actorId)
    }

    function appendVerifiedPoolPayout ({ payload, poolPayout, actorId }) {
      const index = eventIndex(log)
      const rail = wdkSettlementRailFor(poolPayout)
      if (!verifiedPoolPayoutMatchesReplay({ payload: poolPayout, actorId: rail }, index)) {
        const reason = !rail
          ? wdkSettlementSignerMismatchReason({ actorId, rail })
          : 'WDK pool payout output did not match replayed QVAC, payment, and pool evidence'
        return appendPoolPayoutDispute({
          payload,
          reason,
          actorId
        })
      }
      return append('TetherWdkPoolPayoutPrepared', poolPayout, rail || actorId)
    }

    function appendEntryPaymentPending ({ intent, payload, reason, actorId }) {
      const pending = intent
        ? core.createTetherWdkEntryPaymentPending({
            intent,
            confirmationId: payload.confirmationId,
            processorStatus: 'confirmation_failed',
            reason
          })
        : {
            checkId: core.deterministicHash({
              intentId: payload.intentId || null,
              confirmationId: payload.confirmationId || null,
              reason
            }),
            intentId: payload.intentId || null,
            status: 'pending',
            processorStatus: 'missing_intent',
            reason,
            checkedAt: '2026-07-01T00:00:00.000Z'
          }
      const rail = entryPaymentRailFor({ payment: pending, intent })
      return append('TetherWdkEntryPaymentPending', pending, rail || actorId)
    }

    function normalizeEntryPaymentRail ({ payment, intent }) {
      if (!payment || typeof payment !== 'object' || payment.rail || !intent || !intent.rail) return payment
      return { ...payment, rail: intent.rail }
    }

    function appendEntryPaymentConfirmed ({ payment, intent, actorId }) {
      const confirmed = normalizeEntryPaymentRail({ payment, intent })
      const rail = entryPaymentRailFor({ payment: confirmed, intent })
      return append('TetherWdkEntryConfirmed', confirmed, rail || actorId)
    }

    function normalizeEntryRefundRail ({ refund, payment }) {
      if (!refund || typeof refund !== 'object' || refund.rail || !payment || !payment.rail) return refund
      return { ...refund, rail: payment.rail }
    }

    function appendEntryRefundRejected ({ payload, reason, actorId }) {
      return append('TetherWdkEntryRefundRejected', {
        paymentId: payload.paymentId || payload.payment && payload.payment.paymentId || null,
        intentId: payload.intentId || payload.payment && payload.payment.intentId || null,
        poolId: payload.poolId || payload.payment && payload.payment.poolId || null,
        reason,
        status: 'rejected'
      }, actorId)
    }

    function appendEntryRefunded ({ refund, payment, actorId }) {
      const refunded = normalizeEntryRefundRail({ refund, payment })
      const rail = entryPaymentRailFor({ payment: refunded, intent: payment })
      const index = eventIndex(log)
      if (!entryRefundMatchesReplay({ payload: refunded, actorId: rail }, index)) {
        const reason = !rail
          ? entryRefundSignerMismatchReason({ actorId, rail })
          : 'WDK entry refund output did not match replayed payment evidence'
        return appendEntryRefundRejected({
          payload: { paymentId: payment && payment.paymentId, intentId: payment && payment.intentId, poolId: payment && payment.poolId },
          reason,
          actorId
        })
      }
      return append('TetherWdkEntryRefunded', refunded, rail || actorId)
    }

    function mapEntryReconciliation ({ payment, intent, actorId }) {
      if (payment && payment.status === 'confirmed') return appendEntryPaymentConfirmed({ payment, intent, actorId })
      const pending = normalizeEntryPaymentRail({
        payment: payment || (intent
          ? core.createTetherWdkEntryPaymentPending({
              intent,
              processorStatus: 'unknown',
              reason: 'WDK reconciliation returned no payment status'
            })
          : {
              checkId: core.deterministicHash({ reason: 'WDK reconciliation returned no payment status' }),
              status: 'pending',
              processorStatus: 'unknown',
              reason: 'WDK reconciliation returned no payment status',
              checkedAt: '2026-07-01T00:00:00.000Z'
            }),
        intent
      })
      const rail = entryPaymentRailFor({ payment: pending, intent })
      return append('TetherWdkEntryPaymentPending', pending, rail || actorId)
    }

    function confirmedEntriesForPool ({ poolId, confirmedEntries, current }) {
      const entries = Array.isArray(confirmedEntries)
        ? confirmedEntries
        : Object.values(current.entryPayments).filter(payment => payment.poolId === poolId)
      return entries.filter(entry => {
        return entry &&
          entry.status === 'confirmed' &&
          entry.poolId === poolId &&
          !current.entryRefundsByPayment[entry.paymentId]
      })
    }

    function recordSettlementReceipt ({ payload, actorId }) {
      const receipt = payload.receipt || payload
      const current = createView(log)
      const settlementEventId = receipt && receipt.events && receipt.events.settlement && receipt.events.settlement.eventId
      if (settlementEventId && current.settlementReceiptEventsBySettlementEvent[settlementEventId]) {
        return current.settlementReceiptEventsBySettlementEvent[settlementEventId]
      }
      if (receipt && receipt.receiptId && current.settlementReceiptEvents[receipt.receiptId]) {
        return current.settlementReceiptEvents[receipt.receiptId]
      }
      if (!receipt || !receipt.receiptId || !receipt.receiptHash) {
        return append('SettlementReceiptRejected', {
          receiptId: receipt && receipt.receiptId,
          reason: 'Settlement receipt id and hash are required',
          status: 'rejected'
        }, actorId)
      }
      if (receipt.eventRoot !== current.eventRoot) {
        return append('SettlementReceiptRejected', {
          receiptId: receipt.receiptId,
          receiptHash: receipt.receiptHash,
          reason: 'Settlement receipt eventRoot does not match current worker event root',
          expectedEventRoot: current.eventRoot,
          receivedEventRoot: receipt.eventRoot,
          status: 'rejected'
        }, actorId)
      }
      if (!receiptReferencesMatchReplay(receipt, eventIndex(log))) {
        return append('SettlementReceiptRejected', {
          receiptId: receipt.receiptId,
          receiptHash: receipt.receiptHash,
          reason: 'Settlement receipt event references do not match replayed worker events',
          status: 'rejected'
        }, actorId)
      }
      const receiptTools = getSettlementReceipts()
      if (receiptTools && typeof receiptTools.verifySettlementReceipt === 'function') {
        const verification = receiptTools.verifySettlementReceipt(receipt)
        if (!verification.ok) {
          return append('SettlementReceiptRejected', {
            receiptId: receipt.receiptId,
            receiptHash: receipt.receiptHash,
            reason: verification.errors.join('; '),
            status: 'rejected'
          }, actorId)
        }
      }
      return append('SettlementReceiptCreated', receipt, actorId)
    }

    function settleGameRoundSync (payload, actorId) {
      const identity = normalizeRoundIdentity(payload)
      if (!identity.ok) return gameSettlementSummary({ roundEvent: appendRoundIdentityDispute({ payload, identity, actorId }) })
      const { roundId, roundIndex } = identity
      const existingRound = findEvent('GameRoundResolved', result => result.gameId === payload.gameId && result.roundId === roundId)
      const roundEvent = existingRound || dispatchCommand({
        type: 'game:resolveRound',
        actorId,
        payload: {
          gameId: payload.gameId,
          roundIndex,
          roundId,
          shooter: payload.shooter,
          keeper: payload.keeper
        }
      }, false)
      if (roundEvent.type !== 'GameRoundResolved') {
        return gameSettlementSummary({ roundEvent })
      }

      const existingAttestation = findEvent('QvacRefereeAttestationCreated', (attestation, event) =>
        attestation.gameId === payload.gameId &&
        attestation.roundId === roundId &&
        qvacAttestationSignerMatches(event))
      const attestationEvent = existingAttestation || dispatchCommand({
        type: 'qvac:refereeAttest',
        actorId: qvacCommandActorId(payload, actorId),
        payload: { gameId: payload.gameId, roundId }
      }, false)
      const winnerUserId = payload.winnerUserId || winnerFromRoundResult(roundEvent.payload)
      const existingRefund = existingGameRefundEvent(payload.escrowId)
      if (existingRefund) return gameSettlementSummary({ roundEvent, attestationEvent, settlementEvent: existingRefund })
      const existingRelease = findLatestEvent('TetherWdkEscrowReleased', payout => payout.escrowId === payload.escrowId)
      const retryRelease = shouldRetryGameRelease({ existingRelease, winnerUserId, payload })
      const releaseEvent = existingRelease && !retryRelease ? existingRelease : dispatchCommand({
        type: 'wdk:releaseGameEscrow',
        actorId: tetherWdkCommandActorId(payload, actorId),
        payload: {
          gameId: payload.gameId,
          roundId,
          escrowId: payload.escrowId,
          winnerUserId,
          qvacAttestation: attestationEvent.payload,
          payoutAddress: payload.payoutAddress,
          payoutRecipients: payload.payoutRecipients
        }
      }, false)
      const settlementEvent = shouldRefundHeldGameEscrow({ settlementEvent: releaseEvent, payload })
        ? dispatchCommand(gameEscrowRefundCommand({ payload, roundId, settlementEvent: releaseEvent, actorId }), false)
        : releaseEvent
      return gameSettlementSummary({ roundEvent, attestationEvent, settlementEvent })
    }

    async function settleGameRoundAsync (payload, actorId) {
      const identity = normalizeRoundIdentity(payload)
      if (!identity.ok) return gameSettlementSummary({ roundEvent: appendRoundIdentityDispute({ payload, identity, actorId }) })
      const { roundId, roundIndex } = identity
      const existingRound = findEvent('GameRoundResolved', result => result.gameId === payload.gameId && result.roundId === roundId)
      const roundEvent = existingRound || await dispatchCommand({
        type: 'game:resolveRound',
        actorId,
        payload: {
          gameId: payload.gameId,
          roundIndex,
          roundId,
          shooter: payload.shooter,
          keeper: payload.keeper
        }
      }, true)
      if (roundEvent.type !== 'GameRoundResolved') {
        return gameSettlementSummary({ roundEvent })
      }

      const existingAttestation = findEvent('QvacRefereeAttestationCreated', (attestation, event) =>
        attestation.gameId === payload.gameId &&
        attestation.roundId === roundId &&
        qvacAttestationSignerMatches(event))
      const attestationEvent = existingAttestation || await dispatchCommand({
        type: 'qvac:refereeAttest',
        actorId: qvacCommandActorId(payload, actorId),
        payload: { gameId: payload.gameId, roundId }
      }, true)
      const winnerUserId = payload.winnerUserId || winnerFromRoundResult(roundEvent.payload)
      const existingRefund = existingGameRefundEvent(payload.escrowId)
      if (existingRefund) return gameSettlementSummary({ roundEvent, attestationEvent, settlementEvent: existingRefund })
      const existingRelease = findLatestEvent('TetherWdkEscrowReleased', payout => payout.escrowId === payload.escrowId)
      const retryRelease = shouldRetryGameRelease({ existingRelease, winnerUserId, payload })
      const releaseEvent = existingRelease && !retryRelease ? existingRelease : await dispatchCommand({
        type: 'wdk:releaseGameEscrow',
        actorId: tetherWdkCommandActorId(payload, actorId),
        payload: {
          gameId: payload.gameId,
          roundId,
          escrowId: payload.escrowId,
          winnerUserId,
          qvacAttestation: attestationEvent.payload,
          payoutAddress: payload.payoutAddress,
          payoutRecipients: payload.payoutRecipients
        }
      }, true)
      const settlementEvent = shouldRefundHeldGameEscrow({ settlementEvent: releaseEvent, payload })
        ? await dispatchCommand(gameEscrowRefundCommand({ payload, roundId, settlementEvent: releaseEvent, actorId }), true)
        : releaseEvent
      return gameSettlementSummary({ roundEvent, attestationEvent, settlementEvent })
    }

    function settleBracketPoolSync (payload, actorId) {
      const existingPoolResult = findEvent('BracketPoolSettlementResolved', result => result.poolId === payload.poolId)
      const poolResultEvent = existingPoolResult || dispatchCommand({
        type: 'pool:resolveSettlement',
        actorId,
        payload: {
          poolId: payload.poolId,
          confirmedEntries: payload.confirmedEntries,
          winnerUserIds: payload.winnerUserIds,
          bracketSubmissions: payload.bracketSubmissions,
          officialResults: payload.officialResults,
          officialResultsSource: payload.officialResultsSource || payload.source,
          rulesVersion: payload.rulesVersion
        }
      }, false)
      const existingAttestation = findEvent('QvacPoolSettlementAttestationCreated', (attestation, event) =>
        attestation.poolId === payload.poolId &&
        qvacAttestationSignerMatches(event))
      const attestationEvent = existingAttestation || dispatchCommand({
        type: 'qvac:attestPoolSettlement',
        actorId: qvacCommandActorId(payload, actorId),
        payload: { poolId: payload.poolId, poolResult: poolResultEvent.payload }
      }, false)
      const current = createView(log)
      const settlementWinnerUserIds = poolResultEvent && poolResultEvent.payload && poolResultEvent.payload.winnerUserIds || payload.winnerUserIds || []
      const settlementPayload = { ...payload, winnerUserIds: settlementWinnerUserIds }
      const payoutRecipients = payoutRecipientsForSettlementPayload(settlementPayload, current)
      const recipientDeclarationEvents = recipientDeclarationEventsFor({
        poolId: payload.poolId,
        winnerUserIds: settlementWinnerUserIds
      })
      const existingPayout = findLatestEvent('TetherWdkPoolPayoutPrepared', payout => payout.poolId === payload.poolId)
      const retryPayout = shouldRetryPoolPayout({
        existingPayout,
        winnerUserIds: settlementWinnerUserIds,
        payoutRecipients,
        payoutAddress: payload.payoutAddress
      })
      const settlementEvent = existingPayout && !retryPayout ? existingPayout : dispatchCommand({
        type: 'wdk:createPoolPayout',
        actorId: tetherWdkCommandActorId(payload, actorId),
        payload: {
          poolId: payload.poolId,
          confirmedEntries: payload.confirmedEntries,
          winnerUserIds: settlementWinnerUserIds,
          qvacAttestation: attestationEvent.payload,
          asset: payload.asset,
          payoutRecipients,
          payoutAddress: payload.payoutAddress,
          rulesVersion: payload.rulesVersion
        }
      }, false)
      return poolSettlementSummary({ poolResultEvent, attestationEvent, settlementEvent, recipientDeclarationEvents })
    }

    async function settleBracketPoolAsync (payload, actorId) {
      const existingPoolResult = findEvent('BracketPoolSettlementResolved', result => result.poolId === payload.poolId)
      const poolResultEvent = existingPoolResult || await dispatchCommand({
        type: 'pool:resolveSettlement',
        actorId,
        payload: {
          poolId: payload.poolId,
          confirmedEntries: payload.confirmedEntries,
          winnerUserIds: payload.winnerUserIds,
          bracketSubmissions: payload.bracketSubmissions,
          officialResults: payload.officialResults,
          officialResultsSource: payload.officialResultsSource || payload.source,
          rulesVersion: payload.rulesVersion
        }
      }, true)
      const existingAttestation = findEvent('QvacPoolSettlementAttestationCreated', (attestation, event) =>
        attestation.poolId === payload.poolId &&
        qvacAttestationSignerMatches(event))
      const attestationEvent = existingAttestation || await dispatchCommand({
        type: 'qvac:attestPoolSettlement',
        actorId: qvacCommandActorId(payload, actorId),
        payload: { poolId: payload.poolId, poolResult: poolResultEvent.payload }
      }, true)
      const current = createView(log)
      const settlementWinnerUserIds = poolResultEvent && poolResultEvent.payload && poolResultEvent.payload.winnerUserIds || payload.winnerUserIds || []
      const settlementPayload = { ...payload, winnerUserIds: settlementWinnerUserIds }
      const payoutRecipients = payoutRecipientsForSettlementPayload(settlementPayload, current)
      const recipientDeclarationEvents = recipientDeclarationEventsFor({
        poolId: payload.poolId,
        winnerUserIds: settlementWinnerUserIds
      })
      const existingPayout = findLatestEvent('TetherWdkPoolPayoutPrepared', payout => payout.poolId === payload.poolId)
      const retryPayout = shouldRetryPoolPayout({
        existingPayout,
        winnerUserIds: settlementWinnerUserIds,
        payoutRecipients,
        payoutAddress: payload.payoutAddress
      })
      const settlementEvent = existingPayout && !retryPayout ? existingPayout : await dispatchCommand({
        type: 'wdk:createPoolPayout',
        actorId: tetherWdkCommandActorId(payload, actorId),
        payload: {
          poolId: payload.poolId,
          confirmedEntries: payload.confirmedEntries,
          winnerUserIds: settlementWinnerUserIds,
          qvacAttestation: attestationEvent.payload,
          asset: payload.asset,
          payoutRecipients,
          payoutAddress: payload.payoutAddress,
          rulesVersion: payload.rulesVersion
        }
      }, true)
      return poolSettlementSummary({ poolResultEvent, attestationEvent, settlementEvent, recipientDeclarationEvents })
    }

    function dispatchCommand (command, awaitAdapters) {
      const actorId = command.actorId || 'system'
      const payload = command.payload || {}

      if (command.type === 'profile:set' || command.type === 'profile:update') {
        const profile = normalizeProfilePayload(payload, actorId)
        if (!profile.userId || !profile.username || !profile.teamId) {
          return append('ProfileUpdateRejected', {
            userId: profile.userId || null,
            username: profile.username || null,
            teamId: profile.teamId || null,
            reason: 'userId, username, and teamId are required before profile update',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== profile.userId) {
          return append('ProfileUpdateRejected', {
            userId: profile.userId,
            username: profile.username,
            teamId: profile.teamId,
            reason: `Profile update actorId must match userId ${profile.userId}`,
            status: 'rejected'
          }, actorId)
        }
        const existingProfile = findEvent('ProfileUpdated', item => item.profileId === profile.profileId)
        if (existingProfile) return existingProfile
        return append('ProfileUpdated', profile, profile.userId)
      }

      if (command.type === 'bracket:updateDraft' || command.type === 'bracket:resetDraft') {
        const current = createView(log)
        const userId = payload.userId || actorId
        const poolId = payload.poolId || null
        const previousDraft = poolId && userId &&
          current.bracketDraftsByPool[poolId] &&
          current.bracketDraftsByPool[poolId][userId]
        const draft = normalizeBracketDraftPayload({
          ...payload,
          userId,
          clear: command.type === 'bracket:resetDraft' || payload.clear === true,
          picks: command.type === 'bracket:resetDraft' ? {} : payload.picks
        }, actorId, previousDraft && previousDraft.picks || {})
        if (!draft.poolId || !draft.userId) {
          return append('BracketDraftRejected', {
            poolId: draft.poolId || null,
            userId: draft.userId || null,
            reason: 'poolId and userId are required before bracket draft update',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== draft.userId) {
          return append('BracketDraftRejected', {
            poolId: draft.poolId,
            userId: draft.userId,
            reason: `Bracket draft actorId must match userId ${draft.userId}`,
            status: 'rejected'
          }, actorId)
        }
        const existingDraft = findEvent('BracketDraftUpdated', item => item.draftId === draft.draftId)
        if (existingDraft) return existingDraft
        return append('BracketDraftUpdated', draft, draft.userId)
      }

      if (command.type === 'room:join') {
        const joined = normalizeRoomJoinPayload(payload, actorId)
        if (!joined.roomId || !joined.matchId || !joined.userId) {
          return append('RoomJoinRejected', {
            roomId: joined.roomId || null,
            matchId: joined.matchId || null,
            userId: joined.userId || null,
            reason: 'roomId or matchId and userId are required before room join',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== joined.userId) {
          return append('RoomJoinRejected', {
            roomId: joined.roomId,
            matchId: joined.matchId,
            userId: joined.userId,
            reason: `Room join actorId must match userId ${joined.userId}`,
            status: 'rejected'
          }, actorId)
        }
        const existingJoin = findEvent('RoomJoined', item => item.joinId === joined.joinId)
        if (existingJoin) return existingJoin
        return append('RoomJoined', joined, joined.userId)
      }

      if (command.type === 'room:leave') {
        const left = normalizeRoomLeavePayload(payload, actorId)
        const current = createView(log)
        if (!left.roomId || !left.userId) {
          return append('RoomLeaveRejected', {
            roomId: left.roomId || null,
            userId: left.userId || null,
            reason: 'roomId and userId are required before room leave',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== left.userId) {
          return append('RoomLeaveRejected', {
            roomId: left.roomId,
            userId: left.userId,
            reason: `Room leave actorId must match userId ${left.userId}`,
            status: 'rejected'
          }, actorId)
        }
        if (!current.roomParticipants[left.roomId] || !current.roomParticipants[left.roomId][left.userId]) {
          return append('RoomLeaveRejected', {
            roomId: left.roomId,
            userId: left.userId,
            reason: 'Replayed room join is required before room leave',
            status: 'rejected'
          }, actorId)
        }
        const existingLeave = findEvent('RoomLeft', item => item.leaveId === left.leaveId)
        if (existingLeave) return existingLeave
        return append('RoomLeft', left, left.userId)
      }

      if (command.type === 'chat:send') {
        const message = normalizeChatMessagePayload(payload, actorId)
        const current = createView(log)
        if (!message.roomId || !message.userId || !message.body) {
          return append('ChatMessageRejected', {
            roomId: message.roomId || null,
            userId: message.userId || null,
            reason: 'roomId, userId, and body are required before chat send',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== message.userId) {
          return append('ChatMessageRejected', {
            roomId: message.roomId,
            userId: message.userId,
            reason: `Chat message actorId must match userId ${message.userId}`,
            status: 'rejected'
          }, actorId)
        }
        if (!current.roomParticipants[message.roomId] || !current.roomParticipants[message.roomId][message.userId]) {
          return append('ChatMessageRejected', {
            roomId: message.roomId,
            userId: message.userId,
            reason: 'Replayed room join is required before chat send',
            status: 'rejected'
          }, actorId)
        }
        const existingMessage = findEvent('ChatMessageSent', item => item.messageId === message.messageId)
        if (existingMessage) return existingMessage
        return append('ChatMessageSent', message, message.userId)
      }

      if (command.type === 'voice:update' || command.type === 'voice:set-state' || command.type === 'voice:setState') {
        const voice = normalizeVoiceStatePayload(payload, actorId)
        const current = createView(log)
        if (!voice.roomId || !voice.userId) {
          return append('VoiceStateRejected', {
            roomId: voice.roomId || null,
            userId: voice.userId || null,
            reason: 'roomId and userId are required before voice state update',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== voice.userId) {
          return append('VoiceStateRejected', {
            roomId: voice.roomId,
            userId: voice.userId,
            reason: `Voice state actorId must match userId ${voice.userId}`,
            status: 'rejected'
          }, actorId)
        }
        if (!current.roomParticipants[voice.roomId] || !current.roomParticipants[voice.roomId][voice.userId]) {
          return append('VoiceStateRejected', {
            roomId: voice.roomId,
            userId: voice.userId,
            reason: 'Replayed room join is required before voice state update',
            status: 'rejected'
          }, actorId)
        }
        return append('VoiceStateUpdated', voice, voice.userId)
      }

      if (command.type === 'stream:start') {
        const stream = normalizeStreamStartPayload(payload, actorId)
        const current = createView(log)
        if (!stream.roomId || !stream.userId) {
          return append('StreamStartRejected', {
            roomId: stream.roomId || null,
            userId: stream.userId || null,
            reason: 'roomId and userId are required before stream start',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== stream.userId) {
          return append('StreamStartRejected', {
            roomId: stream.roomId,
            userId: stream.userId,
            reason: `Stream actorId must match userId ${stream.userId}`,
            status: 'rejected'
          }, actorId)
        }
        if (!current.roomParticipants[stream.roomId] || !current.roomParticipants[stream.roomId][stream.userId]) {
          return append('StreamStartRejected', {
            roomId: stream.roomId,
            userId: stream.userId,
            reason: 'Replayed room join is required before stream start',
            status: 'rejected'
          }, actorId)
        }
        if (stream.rightsConfirmed !== true) {
          return append('StreamStartRejected', {
            roomId: stream.roomId,
            userId: stream.userId,
            reason: 'Streaming rights must be confirmed before stream start',
            status: 'rejected'
          }, actorId)
        }
        const existingStream = findEvent('StreamStarted', item => item.streamId === stream.streamId)
        if (existingStream) return existingStream
        return append('StreamStarted', stream, stream.userId)
      }

      if (command.type === 'stream:stop') {
        const stopped = normalizeStreamStopPayload(payload, actorId)
        const current = createView(log)
        const active = stopped.streamId && current.activeStreams[stopped.streamId]
        if (!stopped.streamId || !stopped.roomId || !stopped.userId) {
          return append('StreamStopRejected', {
            streamId: stopped.streamId || null,
            roomId: stopped.roomId || null,
            userId: stopped.userId || null,
            reason: 'streamId, roomId, and userId are required before stream stop',
            status: 'rejected'
          }, actorId)
        }
        if (!active) {
          return append('StreamStopRejected', {
            streamId: stopped.streamId,
            roomId: stopped.roomId,
            userId: stopped.userId,
            reason: 'Active stream is required before stream stop',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== stopped.userId || active.userId !== stopped.userId) {
          return append('StreamStopRejected', {
            streamId: stopped.streamId,
            roomId: stopped.roomId,
            userId: stopped.userId,
            reason: `Stream stop actorId must match streamer userId ${active.userId}`,
            status: 'rejected'
          }, actorId)
        }
        const existingStop = findEvent('StreamStopped', item => item.stopId === stopped.stopId)
        if (existingStop) return existingStop
        return append('StreamStopped', stopped, stopped.userId)
      }

      if (command.type === 'game:invite') {
        const invite = normalizeGameInvitePayload(payload, actorId)
        if (!invite.inviter.userId || !invite.opponent.userId) {
          return append('GameInviteRejected', {
            gameId: invite.gameId || null,
            inviterUserId: invite.inviter.userId || null,
            opponentUserId: invite.opponent.userId || null,
            reason: 'inviter and opponent user ids are required before game invite',
            status: 'rejected'
          }, actorId)
        }
        if (invite.inviter.userId === invite.opponent.userId) {
          return append('GameInviteRejected', {
            gameId: invite.gameId,
            inviterUserId: invite.inviter.userId,
            opponentUserId: invite.opponent.userId,
            reason: 'Game invite requires two different players',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== invite.inviter.userId) {
          return append('GameInviteRejected', {
            gameId: invite.gameId,
            inviterUserId: invite.inviter.userId,
            opponentUserId: invite.opponent.userId,
            reason: gameInviteSignerMismatchReason({ actorId, inviterUserId: invite.inviter.userId }),
            status: 'rejected'
          }, actorId)
        }
        const existingInvite = findEvent('GameInviteCreated', item => item.inviteId === invite.inviteId)
        if (existingInvite) return existingInvite
        return append('GameInviteCreated', invite, invite.inviter.userId)
      }

      if (command.type === 'game:acceptInvite') {
        const inviteEvent = findEvent('GameInviteCreated', invite => {
          return (payload.gameId && invite.gameId === payload.gameId) ||
            (payload.inviteId && invite.inviteId === payload.inviteId)
        })
        const invite = inviteEvent && inviteEvent.payload || null
        if (!inviteEvent || !gameInviteSignerMatches(inviteEvent)) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId || null,
            inviteId: payload.inviteId || null,
            reason: 'A valid signed game invite is required before accept',
            status: 'held'
          }, actorId)
        }
        if (actorId !== invite.opponent.userId) {
          return append('GameSessionDisputed', {
            gameId: invite.gameId,
            inviteId: invite.inviteId,
            playerId: actorId,
            reason: `Game invite accept actorId must match opponent userId ${invite.opponent.userId}`,
            status: 'held'
          }, actorId)
        }
        const existingStarted = findEvent('GameSessionStarted', session => session.gameId === invite.gameId)
        if (existingStarted) return existingStarted
        const existingAccepted = findEvent('GameInviteAccepted', accepted => accepted.gameId === invite.gameId)
        const acceptedEvent = existingAccepted || append('GameInviteAccepted', gameInviteAcceptancePayload({
          inviteEvent,
          actorId
        }), actorId)
        return append('GameSessionStarted', gameSessionStartPayload({
          inviteEvent,
          acceptedEvent
        }), actorId)
      }

      if (command.type === 'game:join') {
        const current = createView(log)
        const session = current.gameSessions[payload.gameId]
        const userId = payload.userId || actorId
        if (!session) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId || null,
            playerId: userId,
            reason: 'Game session must be started before join',
            status: 'held'
          }, actorId)
        }
        if (actorId !== userId) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId,
            playerId: userId,
            reason: `Game session join actorId must match userId ${userId}`,
            status: 'held'
          }, actorId)
        }
        const asSpectator = payload.asSpectator === true
        const participantIds = new Set(gameSessionPlayerIds(session))
        if (!asSpectator && !participantIds.has(userId)) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId,
            playerId: userId,
            reason: 'Only invited players can join as participants',
            status: 'held'
          }, actorId)
        }
        const existingJoin = findEvent('GameSessionJoined', joined => {
          return joined.gameId === payload.gameId &&
            joined.userId === userId &&
            joined.asSpectator === asSpectator
        })
        if (existingJoin) return existingJoin
        return append('GameSessionJoined', gameSessionJoinPayload({
          session,
          payload,
          actorId
        }), userId)
      }

      if (command.type === 'match:ingestEvent') {
        const matchEvent = normalizeMatchEventPayload(payload, actorId)
        if (!matchEvent.matchId) {
          return append('MatchEventRejected', {
            matchId: null,
            reason: 'matchId is required before match event ingestion',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== matchEvent.sourceActorId) {
          return append('MatchEventRejected', {
            matchId: matchEvent.matchId,
            eventId: matchEvent.eventId,
            reason: `Match event actorId must match sourceActorId ${matchEvent.sourceActorId}`,
            status: 'rejected'
          }, actorId)
        }
        const existingEvent = findEvent('MatchEventIngested', event => event.eventId === matchEvent.eventId)
        if (existingEvent) return existingEvent
        return append('MatchEventIngested', matchEvent, matchEvent.sourceActorId)
      }

      if (command.type === 'commentary:setLanguage') {
        return append('CommentaryLanguageSelected', {
          matchId: payload.matchId || null,
          language: normalizeLanguage(payload.language),
          selectedAt: '2026-07-01T00:00:00.000Z'
        }, actorId)
      }

      if (command.type === 'commentary:generate') {
        assertAdapterCanRun(adapters.qvacCommentary, 'generateSegment', awaitAdapters)
        const current = createView(log)
        const input = commentaryInputForPayload(payload, current)
        if (!input.matchId) {
          return appendCommentaryRejected({
            payload,
            reason: 'matchId is required before QVAC commentary generation',
            actorId
          })
        }
        if (!input.recentEvents.length) {
          return appendCommentaryRejected({
            payload: input,
            reason: 'Replayed match events are required before QVAC commentary generation',
            actorId
          })
        }
        const sourceEventIds = input.recentEvents.map(event => event.sourceEventId || event.workerEventId || event.eventId)
        const existingCommentary = findExistingCommentaryEvent({
          matchId: input.matchId,
          language: input.language,
          sourceEventIds,
          tone: input.tone
        })
        if (existingCommentary) return existingCommentary
        const commentaryActorId = qvacCommentaryCommandActorId(payload, actorId)
        return attemptAdapterResult(
          () => adapters.qvacCommentary.generateSegment(input),
          segment => appendVerifiedCommentarySegment({ segment, input, actorId: commentaryActorId }),
          error => appendCommentaryRejected({ payload: input, reason: error.message, actorId }),
          awaitAdapters
        )
      }

      if (command.type === 'wdk:createGameEscrow') {
        assertAdapterCanRun(adapters.tetherWdk, 'createGameEscrow', awaitAdapters)
        const escrowInput = gameEscrowInputForPayload(payload)
        if (!escrowInput.ok) {
          return appendGameEscrowCreationDispute({
            payload,
            reason: escrowInput.reason,
            actorId
          })
        }
        return attemptAdapterResult(
          () => adapters.tetherWdk.createGameEscrow(escrowInput.input),
          escrow => appendVerifiedGameEscrow({ payload: escrowInput.input, escrow, actorId }),
          null,
          awaitAdapters
        )
      }

      if (command.type === 'wdk:refundGameEscrow') {
        assertAdapterCanRun(adapters.tetherWdk, 'refundGameEscrow', awaitAdapters)
        const current = createView(log)
        const escrowId = payload.escrowId || (payload.escrow && payload.escrow.escrowId) || null
        const existingRefund = escrowId && current.escrowRefundsByEscrow[escrowId]
        if (existingRefund) return findEvent('TetherWdkEscrowRefunded', refund => refund.refundId === existingRefund.refundId)
        const escrow = payload.escrow || (escrowId && current.escrows[escrowId]) || null
        if (!escrow) {
          return appendGameEscrowRefundRejected({
            payload,
            reason: 'Locked escrow is required before WDK refund',
            actorId
          })
        }
        const existingRelease = Object.values(current.payouts).find(payout => payout.escrowId === escrow.escrowId)
        if (existingRelease) {
          return appendGameEscrowRefundRejected({
            payload: { ...payload, escrow },
            reason: 'Released WDK escrow cannot be refunded',
            actorId
          })
        }
        const disputeEvent = findLatestEvent('TetherWdkEscrowDisputed', dispute => {
          return dispute.escrowId === escrow.escrowId && dispute.rail === escrow.rail
        })
        if (!disputeEvent) {
          return appendGameEscrowRefundRejected({
            payload: { ...payload, escrow },
            reason: 'WDK escrow dispute is required before refund',
            actorId
          })
        }
        return attemptAdapterResult(
          () => adapters.tetherWdk.refundGameEscrow({
            escrow,
            reason: payload.reason || disputeEvent.payload.reason || 'game-escrow-refunded',
            refundUserIds: payload.refundUserIds,
            payoutAddress: payload.payoutAddress,
            payoutRecipients: payload.payoutRecipients
          }),
          refund => appendGameEscrowRefunded({ refund, escrow, actorId }),
          error => appendGameEscrowRefundRejected({ payload: { ...payload, escrow }, reason: error.message, actorId }),
          awaitAdapters
        )
      }

      if (command.type === 'wdk:createEntryIntent') {
        assertAdapterCanRun(adapters.tetherWdk, 'createEntryIntent', awaitAdapters)
        if (payload.userId && actorId !== payload.userId) {
          return append('TetherWdkEntryIntentRejected', {
            poolId: payload.poolId || null,
            entryId: payload.entryId || null,
            userId: payload.userId,
            amount: payload.amount || null,
            asset: payload.asset || 'USDT',
            reason: entryIntentSignerMismatchReason({ actorId, userId: payload.userId }),
            status: 'rejected'
          }, actorId)
        }
        return attemptAdapterResult(
          () => adapters.tetherWdk.createEntryIntent(payload),
          intent => append('TetherWdkEntryIntentCreated', intent, actorId),
          null,
          awaitAdapters
        )
      }

      if (command.type === 'wdk:confirmEntryIntent') {
        assertAdapterCanRun(adapters.tetherWdk, 'confirmEntryIntent', awaitAdapters)
        const current = createView(log)
        const intent = payload.intent || current.entryIntents[payload.intentId]
        const existingPayment = intent && current.entryPaymentsByIntent[intent.intentId]
        if (existingPayment) return findEvent('TetherWdkEntryConfirmed', payment => payment.intentId === intent.intentId)
        return attemptAdapterResult(
          () => adapters.tetherWdk.confirmEntryIntent({
            intent,
            confirmationId: payload.confirmationId
          }),
          payment => appendEntryPaymentConfirmed({ payment, intent, actorId }),
          error => appendEntryPaymentPending({ intent, payload, reason: error.message, actorId }),
          awaitAdapters
        )
      }

      if (command.type === 'wdk:reconcileEntryIntent') {
        const reconcileMethod = adapters.tetherWdk && typeof adapters.tetherWdk.reconcileEntryIntent === 'function'
          ? 'reconcileEntryIntent'
          : 'confirmEntryIntent'
        assertAdapterCanRun(adapters.tetherWdk, reconcileMethod, awaitAdapters)
        const current = createView(log)
        const intent = payload.intent || current.entryIntents[payload.intentId]
        const existingPayment = intent && current.entryPaymentsByIntent[intent.intentId]
        if (existingPayment) return findEvent('TetherWdkEntryConfirmed', payment => payment.intentId === intent.intentId)
        return attemptAdapterResult(
          () => adapters.tetherWdk[reconcileMethod]({
            intent,
            confirmationId: payload.confirmationId
          }),
          payment => mapEntryReconciliation({ payment, intent, actorId }),
          error => appendEntryPaymentPending({ intent, payload, reason: error.message, actorId }),
          awaitAdapters
        )
      }

      if (command.type === 'wdk:refundEntryIntent') {
        assertAdapterCanRun(adapters.tetherWdk, 'refundEntryIntent', awaitAdapters)
        const current = createView(log)
        const paymentId = payload.paymentId || (payload.payment && payload.payment.paymentId) || null
        const existingRefund = (paymentId && current.entryRefundsByPayment[paymentId]) ||
          (payload.intentId && current.entryRefundsByIntent[payload.intentId]) ||
          null
        if (existingRefund) return findEvent('TetherWdkEntryRefunded', refund => refund.refundId === existingRefund.refundId)
        const payment = payload.payment ||
          (paymentId && current.entryPayments[paymentId]) ||
          (payload.intentId && current.entryPaymentsByIntent[payload.intentId]) ||
          null
        if (!payment) {
          return appendEntryRefundRejected({
            payload,
            reason: 'Confirmed entry payment is required before WDK refund',
            actorId
          })
        }
        return attemptAdapterResult(
          () => adapters.tetherWdk.refundEntryIntent({
            payment,
            reason: payload.reason || 'entry-refunded'
          }),
          refund => appendEntryRefunded({ refund, payment, actorId }),
          error => appendEntryRefundRejected({ payload: { ...payload, payment }, reason: error.message, actorId }),
          awaitAdapters
        )
      }

      if (command.type === 'results:recordOfficialSnapshot') {
        return ensureOfficialResultsSnapshotEvent({
          poolId: payload.poolId,
          officialResults: payload.officialResults || {},
          rulesVersion: payload.rulesVersion || 'bracket-pool-v1',
          source: payload.source || payload.officialResultsSource || payload.officialResults && payload.officialResults.source || 'trusted-results-feed',
          sourceActorId: payload.sourceActorId || payload.officialResultsSourceActorId || payload.officialResults && payload.officialResults.sourceActorId,
          actorId
        })
      }

      if (command.type === 'bracket:submit') {
        const current = createView(log)
        const existing = payload.submissionId && current.bracketSubmissions[payload.submissionId]
        if (existing) return findEvent('BracketSubmissionLocked', submission => submission.submissionId === payload.submissionId)
        if (payload.userId && actorId !== payload.userId) {
          return append('BracketSubmissionRejected', {
            poolId: payload.poolId || null,
            entryId: payload.entryId || null,
            userId: payload.userId,
            reason: bracketSubmissionSignerMismatchReason({ actorId, userId: payload.userId }),
            status: 'rejected'
          }, actorId)
        }
        const submission = core.createBracketSubmission({
          poolId: payload.poolId,
          entryId: payload.entryId || null,
          paymentId: payload.paymentId || null,
          userId: payload.userId,
          username: payload.username || null,
          picks: payload.picks || {},
          rulesVersion: payload.rulesVersion || 'bracket-pool-v1'
        })
        const duplicate = findEvent('BracketSubmissionLocked', item => item.submissionId === submission.submissionId)
        if (duplicate) return duplicate
        return append('BracketSubmissionLocked', submission, actorId)
      }

      if (command.type === 'pool:resolveSettlement') {
        const current = createView(log)
        const confirmedEntries = confirmedEntriesForPool({
          poolId: payload.poolId,
          confirmedEntries: payload.confirmedEntries,
          current
        })
        const hasPayloadOfficialResults = Object.prototype.hasOwnProperty.call(payload, 'officialResults') && payload.officialResults !== undefined
        const currentSnapshot = current.officialResultsSnapshots[payload.poolId]
        const officialResults = hasPayloadOfficialResults
          ? payload.officialResults || {}
          : currentSnapshot && currentSnapshot.officialResults || {}
        const officialResultsEvent = ensureOfficialResultsSnapshotEvent({
          poolId: payload.poolId,
          officialResults,
          rulesVersion: payload.rulesVersion || currentSnapshot && currentSnapshot.rulesVersion || 'bracket-pool-v1',
          source: payload.officialResultsSource || payload.source || currentSnapshot && currentSnapshot.source || 'trusted-results-feed',
          sourceActorId: payload.officialResultsSourceActorId || payload.sourceActorId || currentSnapshot && currentSnapshot.sourceActorId,
          actorId
        })
        const officialResultsSourceEvent = officialResultsEvent && officialResultsEvent.type === 'OfficialResultsSnapshotRecorded'
          ? officialResultsEvent
          : null
        const paymentSourceEvents = poolPaymentSourceEvents({
          poolId: payload.poolId,
          confirmedEntries
        })
        const submissionSourceEvents = payload.bracketSubmissions
          ? []
          : bracketSubmissionSourceEvents({
              poolId: payload.poolId,
              confirmedEntries
            })
        const bracketSubmissions = payload.bracketSubmissions || submissionSourceEvents.map(event => event.payload)
        const sourceEvents = [...paymentSourceEvents, ...submissionSourceEvents, officialResultsSourceEvent].filter(Boolean)
        const sourceEventIds = paymentSourceEvents.length === confirmedEntries.length && confirmedEntries.length > 0 && officialResultsSourceEvent
          ? sourceEvents.map(event => event.eventId)
          : null
        const poolResult = core.createBracketPoolSettlementResult({
          poolId: payload.poolId,
          confirmedEntries,
          winnerUserIds: payload.winnerUserIds,
          bracketSubmissions,
          officialResults,
          rulesVersion: payload.rulesVersion,
          sourceEventIds,
          sourceEventMode: sourceEventIds ? 'worker-log' : 'deterministic'
        })
        return append('BracketPoolSettlementResolved', poolResult, actorId)
      }

      if (command.type === 'payout:declareRecipient') {
        if (!payload.poolId || !payload.userId || !payload.recipient) {
          return append('PayoutRecipientDeclarationRejected', {
            poolId: payload.poolId || null,
            userId: payload.userId || null,
            reason: 'poolId, userId, and recipient are required',
            status: 'rejected'
          }, actorId)
        }
        if (actorId !== payload.userId) {
          return append('PayoutRecipientDeclarationRejected', {
            poolId: payload.poolId,
            userId: payload.userId,
            reason: payoutRecipientSignerMismatchReason({ actorId, userId: payload.userId }),
            status: 'rejected'
          }, actorId)
        }
        return append('PayoutRecipientDeclared', {
          poolId: payload.poolId,
          userId: payload.userId,
          username: payload.username || null,
          teamId: payload.teamId || null,
          asset: payload.asset || 'USDT',
          recipient: payload.recipient,
          recipientHash: core.deterministicHash(String(payload.recipient)),
          status: 'active',
          declaredAt: '2026-07-01T00:00:00.000Z'
        }, actorId)
      }

      if (command.type === 'qvac:attestPoolSettlement') {
        assertAdapterCanRun(adapters.qvac, 'attestPoolSettlement', awaitAdapters)
        const poolId = payload.poolId || payload.poolResult && payload.poolResult.poolId
        const poolResultEvent = findEvent('BracketPoolSettlementResolved', result => result.poolId === poolId)
        const poolResult = poolResultEvent && poolResultEvent.payload
        if (!poolResult) {
          return appendPoolPayoutDispute({
            payload: {
              poolId: poolId || null,
              winnerUserIds: payload.poolResult && payload.poolResult.winnerUserIds || []
            },
            reason: 'Bracket pool settlement result event must be present in the worker log before QVAC attestation',
            actorId
          })
        }
        if (payload.poolResult && !samePayloadEvidence(payload.poolResult, poolResult)) {
          return appendPoolPayoutDispute({
            payload: {
              poolId,
              winnerUserIds: payload.poolResult.winnerUserIds || []
            },
            reason: 'QVAC pool attestation payload must match the replayed pool settlement event',
            actorId
          })
        }
        const sourceVerification = verifyPoolSourceEvents(poolResult)
        if (!sourceVerification.ok) {
          return appendPoolPayoutDispute({
            payload: {
              poolId: poolId || poolResult && poolResult.poolId,
              winnerUserIds: poolResult && poolResult.winnerUserIds || []
            },
            reason: sourceVerification.errors.join('; '),
            actorId
          })
        }
        return attemptAdapterResult(
          () => adapters.qvac.attestPoolSettlement({ poolResult }),
          attestation => appendVerifiedPoolAttestation({ poolResult, attestation, actorId }),
          null,
          awaitAdapters
        )
      }

      if (command.type === 'wdk:createPoolPayout') {
        assertAdapterCanRun(adapters.tetherWdk, 'createPoolPayout', awaitAdapters)
        const current = createView(log)
        const confirmedEntries = confirmedEntriesForPool({
          poolId: payload.poolId,
          confirmedEntries: payload.confirmedEntries,
          current
        })
        const payoutRecipients = payoutRecipientsForSettlementPayload(payload, current)
        const attestation = payload.qvacAttestation || current.poolAttestations[payload.poolId]
        const poolResult = current.poolResults[payload.poolId]
        if (poolResult) {
          const sourceVerification = verifyPoolSourceEvents(poolResult)
          if (!sourceVerification.ok) {
            return appendPoolPayoutDispute({
              payload,
              reason: sourceVerification.errors.join('; '),
              actorId
            })
          }
        }
        const loggedAttestation = verifyLoggedPoolAttestation({ poolId: payload.poolId, attestation })
        if (!loggedAttestation.ok) {
          return appendPoolPayoutDispute({
            payload,
            reason: loggedAttestation.errors.join('; '),
            actorId
          })
        }
        const verification = core.verifyQvacPoolSettlementAttestation({ poolResult, attestation })
        if (!verification.ok) {
          return appendPoolPayoutDispute({
            payload,
            reason: verification.errors.join('; '),
            actorId
          })
        }
        return attemptAdapterResult(
          () => adapters.tetherWdk.createPoolPayout({
            poolId: payload.poolId,
            confirmedEntries,
            winnerUserIds: payload.winnerUserIds,
            attestation,
            asset: payload.asset,
            payoutRecipients,
            payoutAddress: payload.payoutAddress,
            rulesVersion: payload.rulesVersion
          }),
          poolPayout => appendVerifiedPoolPayout({ payload, poolPayout, actorId }),
          error => appendPoolPayoutDispute({
            payload,
            reason: error.message,
            actorId
          }),
          awaitAdapters
        )
      }

      if (command.type === 'game:submitCommitment') {
        if (payload.playerId && actorId !== payload.playerId) {
          return appendPlayerEvidenceSignerDispute({
            payload,
            actorId,
            evidenceType: 'Commitment'
          })
        }
        return append('GameCommitmentSubmitted', payload, actorId)
      }

      if (command.type === 'game:revealInput') {
        if (payload.playerId && actorId !== payload.playerId) {
          return appendPlayerEvidenceSignerDispute({
            payload,
            actorId,
            evidenceType: 'Reveal'
          })
        }
        const current = createView(log)
        const key = `${payload.gameId}:${payload.roundId}:${payload.playerId}`
        const commitment = current.commitments[key]
        const valid = Boolean(commitment && core.verifyCommitment({
          commitment: commitment.commitment,
          gameId: payload.gameId,
          roundId: payload.roundId,
          playerId: payload.playerId,
          input: payload.input,
          nonce: payload.nonce
        }))

        if (!valid) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId,
            roundId: payload.roundId,
            playerId: payload.playerId,
            reason: 'Reveal did not match prior commitment'
          }, actorId)
        }

        return append('GameInputRevealed', payload, actorId)
      }

      if (command.type === 'game:submitRoundStateHash') {
        const identity = normalizeRoundIdentity(payload)
        if (!identity.ok) return appendRoundIdentityDispute({ payload, identity, actorId })
        if (!payload.gameId || !payload.playerId || !payload.stateHash) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId || null,
            roundId: identity.roundId,
            playerId: payload.playerId || null,
            reason: 'gameId, playerId, and stateHash are required before peer state hash submission',
            status: 'held'
          }, actorId)
        }
        if (actorId !== payload.playerId) {
          return appendPlayerEvidenceSignerDispute({
            payload: { ...payload, roundId: identity.roundId },
            actorId,
            evidenceType: 'Peer state hash'
          })
        }
        return append('GameRoundStateHashSubmitted', {
          gameId: payload.gameId,
          roundId: identity.roundId,
          roundIndex: identity.roundIndex,
          playerId: payload.playerId,
          stateHash: payload.stateHash,
          resolverVersion: payload.resolverVersion || core.resolverVersion,
          submittedAt: '2026-07-01T00:00:00.000Z'
        }, actorId)
      }

      if (command.type === 'game:recordForfeit') {
        const identity = normalizeRoundIdentity(payload)
        if (!identity.ok) return appendRoundIdentityDispute({ payload, identity, actorId })
        const { gameId, shooter, keeper } = payload
        const { roundId, roundIndex } = identity
        const participants = [
          shooter && shooter.id,
          keeper && keeper.id
        ].filter(Boolean)
        const forfeitingPlayerId = payload.forfeitingPlayerId || payload.playerId || null
        const winnerUserId = payload.winnerUserId || participants.find(userId => userId !== forfeitingPlayerId) || null
        const claimantUserId = payload.claimantUserId || winnerUserId
        const existingRound = findEvent('GameRoundResolved', result => result.gameId === gameId && result.roundId === roundId)
        if (existingRound) return existingRound
        if (!gameId || !shooter || !keeper || !forfeitingPlayerId || !winnerUserId) {
          return append('GameSessionDisputed', {
            gameId: gameId || null,
            roundId,
            playerId: forfeitingPlayerId,
            reason: 'gameId, shooter, keeper, forfeitingPlayerId, and winnerUserId are required before forfeit resolution',
            status: 'held'
          }, actorId)
        }
        if (!participants.includes(forfeitingPlayerId) || !participants.includes(winnerUserId) || forfeitingPlayerId === winnerUserId) {
          return append('GameSessionDisputed', {
            gameId,
            roundId,
            playerId: forfeitingPlayerId,
            reason: 'Forfeit winner and forfeiting player must be different round participants',
            status: 'held'
          }, actorId)
        }
        if (!forfeitClaimSignerMatches({ actorId, claimantUserId, winnerUserId, forfeitingPlayerId })) {
          return append('GameSessionDisputed', {
            gameId,
            roundId,
            playerId: claimantUserId,
            reason: forfeitClaimSignerMismatchReason({ actorId, claimantUserId }),
            status: 'held'
          }, actorId)
        }
        const evidence = roundEvidenceEvents({ gameId, roundId, shooter, keeper })
        const priorSourceEventIds = [
          evidence.shooterCommitmentEvent,
          evidence.keeperCommitmentEvent,
          evidence.shooterRevealEvent,
          evidence.keeperRevealEvent
        ].filter(Boolean).map(event => event.eventId)
        const forfeitEvent = append('GameRoundForfeitRecorded', {
          gameId,
          roundId,
          roundIndex,
          forfeitingPlayerId,
          winnerUserId,
          claimantUserId,
          reason: payload.reason || 'timeout',
          evidenceEventIds: priorSourceEventIds,
          recordedAt: '2026-07-01T00:00:00.000Z'
        }, actorId)
        const roundResult = core.createPenaltyClashForfeitRound({
          gameId,
          roundIndex,
          roundId,
          shooter,
          keeper,
          forfeitingPlayerId,
          winnerUserId,
          claimantUserId,
          reason: payload.reason || 'timeout',
          sourceEventIds: [...priorSourceEventIds, forfeitEvent.eventId]
        })
        return append('GameRoundResolved', roundResult, actorId)
      }

      if (command.type === 'game:resolveRound') {
        const current = createView(log)
        const identity = normalizeRoundIdentity(payload)
        if (!identity.ok) return appendRoundIdentityDispute({ payload, identity, actorId })
        const { gameId, shooter, keeper } = payload
        const { roundId, roundIndex } = identity
        const shooterReveal = current.reveals[`${gameId}:${roundId}:${shooter.id}`]
        const keeperReveal = current.reveals[`${gameId}:${roundId}:${keeper.id}`]
        const evidence = roundEvidenceEvents({ gameId, roundId, shooter, keeper })

        if (!shooterReveal || !keeperReveal) {
          return append('GameSessionDisputed', {
            gameId,
            roundId,
            reason: 'Both reveals are required before round resolution'
          }, actorId)
        }

        const baseSourceEventIds = [
          evidence.shooterCommitmentEvent,
          evidence.keeperCommitmentEvent,
          evidence.shooterRevealEvent,
          evidence.keeperRevealEvent
        ].map(event => event && event.eventId)
        if (baseSourceEventIds.some(eventId => !eventId)) {
          return append('GameSessionDisputed', {
            gameId,
            roundId,
            reason: 'Commitment and reveal source events are required before round resolution',
            status: 'held'
          }, actorId)
        }

        const roundResult = core.createPenaltyClashRound({
          gameId,
          roundIndex,
          shooter,
          keeper,
          shooterInput: shooterReveal.input,
          keeperInput: keeperReveal.input,
          shooterNonce: shooterReveal.nonce,
          keeperNonce: keeperReveal.nonce,
          sourceEventIds: baseSourceEventIds
        })
        const stateHashConsensus = verifyRoundStateHashConsensus({
          gameId,
          roundId,
          participantUserIds: [shooter.id, keeper.id],
          stateHash: roundResult.stateHash,
          resolverVersion: roundResult.resolverVersion
        })
        if (!stateHashConsensus.ok) {
          return append('GameSessionDisputed', {
            gameId,
            roundId,
            reason: stateHashConsensus.errors.join('; '),
            status: 'held'
          }, actorId)
        }
        const peerStateHashEventIds = stateHashConsensus.events.map(event => event.eventId)
        if (peerStateHashEventIds.length > 0) {
          roundResult.peerStateHashEventIds = peerStateHashEventIds
          roundResult.peerStateHashes = stateHashConsensus.events.map(event => ({
            eventId: event.eventId,
            playerId: event.payload.playerId,
            stateHash: event.payload.stateHash,
            resolverVersion: event.payload.resolverVersion || null
          }))
          roundResult.sourceEventIds = [...baseSourceEventIds, ...peerStateHashEventIds]
        }

        return append('GameRoundResolved', roundResult, actorId)
      }

      if (command.type === 'qvac:refereeAttest') {
        assertAdapterCanRun(adapters.qvac, 'attestRound', awaitAdapters)
        const identity = normalizeRoundIdentity(payload)
        if (!identity.ok) return appendRoundIdentityDispute({ payload, identity, actorId })
        const current = createView(log)
        const key = `${payload.gameId}:${identity.roundId}`
        const roundResult = current.roundResults[key]
        const sourceVerification = verifyRoundSourceEvents(roundResult)
        if (!sourceVerification.ok) {
          return append('GameSessionDisputed', {
            gameId: payload.gameId,
            roundId: identity.roundId,
            reason: sourceVerification.errors.join('; '),
            status: 'held'
          }, actorId)
        }
        return attemptAdapterResult(
          () => adapters.qvac.attestRound({ roundResult }),
          attestation => appendVerifiedRoundAttestation({ roundResult, attestation, actorId }),
          null,
          awaitAdapters
        )
      }

      if (command.type === 'wdk:releaseGameEscrow') {
        assertAdapterCanRun(adapters.tetherWdk, 'releaseGameEscrow', awaitAdapters)
        const identity = normalizeRoundIdentity(payload)
        if (!identity.ok) {
          return appendEscrowDispute({
            payload,
            reason: identity.reason,
            actorId,
            awaitAdapters
          })
        }
        const current = createView(log)
        const escrow = current.escrows[payload.escrowId]
        if (payload.escrowId && current.escrowRefundsByEscrow[payload.escrowId]) {
          return appendEscrowDispute({
            payload,
            reason: 'Refunded WDK escrow cannot be released',
            actorId,
            awaitAdapters
          })
        }
        const attestation = payload.qvacAttestation || Object.values(current.attestations)
          .find(item => item.gameId === payload.gameId && item.roundId === identity.roundId)
        const roundResult = current.roundResults[`${payload.gameId}:${identity.roundId}`]
        const sourceVerification = verifyRoundSourceEvents(roundResult)
        if (!sourceVerification.ok) {
          return appendEscrowDispute({
            payload,
            reason: sourceVerification.errors.join('; '),
            actorId,
            awaitAdapters
          })
        }
        const targetVerification = verifyEscrowReleaseTarget({
          escrow,
          roundResult,
          attestation,
          winnerUserId: payload.winnerUserId
        })
        if (!targetVerification.ok) {
          return appendEscrowDispute({
            payload,
            reason: targetVerification.errors.join('; '),
            actorId,
            awaitAdapters
          })
        }
        const loggedAttestation = verifyLoggedRoundAttestation({ gameId: payload.gameId, roundId: identity.roundId, attestation })
        if (!loggedAttestation.ok) {
          return appendEscrowDispute({
            payload,
            reason: loggedAttestation.errors.join('; '),
            actorId,
            awaitAdapters
          })
        }
        const verification = core.verifyQvacRoundAttestation({ roundResult, attestation })

        if (!verification.ok) {
          return appendEscrowDispute({
            payload,
            reason: verification.errors.join('; '),
            actorId,
            awaitAdapters
          })
        }

        return attemptAdapterResult(
          () => adapters.tetherWdk.releaseGameEscrow({
            escrow,
            attestation,
            winnerUserId: payload.winnerUserId,
            payoutAddress: payload.payoutAddress,
            payoutRecipients: payload.payoutRecipients
          }),
          payout => appendVerifiedGameRelease({ payload, payout, actorId, awaitAdapters }),
          error => {
            return appendEscrowDispute({
              payload,
              reason: error.message,
              actorId,
              awaitAdapters
            })
          },
          awaitAdapters
        )
      }

      if (command.type === 'settlement:settleGameRound') {
        return awaitAdapters ? settleGameRoundAsync(payload, actorId) : settleGameRoundSync(payload, actorId)
      }

      if (command.type === 'settlement:settleBracketPool') {
        return awaitAdapters ? settleBracketPoolAsync(payload, actorId) : settleBracketPoolSync(payload, actorId)
      }

      if (command.type === 'settlement:recordReceipt') {
        return recordSettlementReceipt({ payload, actorId })
      }

      throw new Error(`Unsupported command: ${command.type}`)
    }

    function dispatch (command) {
      return completeAdapterResult(dispatchCommand(command, false), result => result, false)
    }

    function dispatchAsync (command) {
      return Promise.resolve(dispatchCommand(command, true))
    }

    return {
      dispatch,
      dispatchAsync,
      events: () => [...log],
      mergeEvents,
      adapterMode: () => ({ ...adapters.mode }),
      view: () => createView(log)
    }
  }

  const api = { createWorkerSim, createView, eventEnvelope, validateEventEnvelope, eventRoot, mergeUniqueEvents }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupWorkerSim = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupWorkerSim = 'event-log-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./storage-sim.js */
(function attachPearCupStorageSim (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const core = root.PearCupCore || (canRequireLocal ? require('./core.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupStorageSim')

  function eventRoot (events) {
    return core.deterministicHash(events
      .map(event => ({
        eventId: event.eventId,
        signature: event.signature,
        type: event.type
      }))
      .sort((a, b) => a.eventId.localeCompare(b.eventId)))
  }

  function typeCounts (events) {
    return events.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] || 0) + 1
      return counts
    }, {})
  }

  function namespaceKey ({ rootId = 'pearcup-local', namespace }) {
    if (!namespace) throw new Error('namespace is required')
    return `${rootId}:${namespace}`
  }

  function gameNamespace (gameId) {
    if (!gameId) throw new Error('gameId is required')
    return `games/${gameId}/events`
  }

  function normalizeEvents (events) {
    if (!Array.isArray(events)) return []
    return events.filter(event => event && event.eventId && event.type)
  }

  function dedupeEvents (events) {
    const seen = new Set()
    const deduped = []
    for (const event of normalizeEvents(events)) {
      if (seen.has(event.eventId)) continue
      seen.add(event.eventId)
      deduped.push(event)
    }
    return deduped
  }

  function createMemoryBackend (initial = {}) {
    const buckets = new Map(Object.entries(initial).map(([key, value]) => [key, dedupeEvents(value)]))
    return {
      kind: 'memory',
      read (key) {
        return [...(buckets.get(key) || [])]
      },
      write (key, events) {
        buckets.set(key, dedupeEvents(events))
      },
      keys () {
        return [...buckets.keys()].sort()
      },
      clear (key) {
        if (key) buckets.delete(key)
        else buckets.clear()
      }
    }
  }

  function createLocalStorageBackend ({ localStorage = root.localStorage, prefix = 'pearcup-storage' } = {}) {
    if (!localStorage) throw new Error('localStorage is required for createLocalStorageBackend')

    function storageKey (key) {
      return `${prefix}:${key}`
    }

    return {
      kind: 'localStorage',
      read (key) {
        try {
          return dedupeEvents(JSON.parse(localStorage.getItem(storageKey(key)) || '[]'))
        } catch {
          return []
        }
      },
      write (key, events) {
        localStorage.setItem(storageKey(key), JSON.stringify(dedupeEvents(events)))
      },
      keys () {
        const keys = []
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index)
          if (key && key.startsWith(`${prefix}:`)) keys.push(key.slice(prefix.length + 1))
        }
        return keys.sort()
      },
      clear (key) {
        if (key) {
          localStorage.removeItem(storageKey(key))
          return
        }
        for (const bucket of this.keys()) localStorage.removeItem(storageKey(bucket))
      }
    }
  }

  function createEventStore ({
    backend = createMemoryBackend(),
    rootId = 'pearcup-local',
    namespace = 'events'
  } = {}) {
    const key = namespaceKey({ rootId, namespace })

    function readEvents () {
      return dedupeEvents(backend.read(key))
    }

    function writeEvents (events) {
      backend.write(key, dedupeEvents(events))
    }

    function appendEvents (events) {
      const current = readEvents()
      const existingIds = new Set(current.map(event => event.eventId))
      const incoming = normalizeEvents(events)
      const merged = [...current]
      let appended = 0

      for (const event of incoming) {
        if (existingIds.has(event.eventId)) continue
        existingIds.add(event.eventId)
        merged.push(event)
        appended++
      }

      if (appended > 0) writeEvents(merged)
      return appended
    }

    function clear () {
      backend.clear(key)
    }

    function snapshot () {
      const events = readEvents()
      return {
        rootId,
        namespace,
        key,
        backend: backend.kind || 'custom',
        events: events.length,
        eventRoot: eventRoot(events),
        typeCounts: typeCounts(events)
      }
    }

    return {
      key,
      rootId,
      namespace,
      readEvents,
      writeEvents,
      appendEvents,
      clear,
      snapshot
    }
  }

  const api = {
    createEventStore,
    createLocalStorageBackend,
    createMemoryBackend,
    dedupeEvents,
    eventRoot,
    gameNamespace,
    namespaceKey,
    typeCounts
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupStorageSim = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupStorageSim = 'storage-sim-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./transport-sim.js */
(function attachPearCupTransportSim (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const core = root.PearCupCore || (canRequireLocal ? require('./core.js') : null)
  const workerSim = root.PearCupWorkerSim || (canRequireLocal ? require('./worker-sim.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupTransportSim')
  if (!workerSim) throw new Error('PearCupWorkerSim is required before PearCupTransportSim')

  function gameTopic (gameId) {
    return `pearcup:v1:game:${gameId}`
  }

  function duplicateEveryOther (events) {
    const delivered = []
    events.forEach((event, index) => {
      delivered.push(event)
      if (index % 2 === 0) delivered.push(event)
    })
    return delivered
  }

  function outOfOrder (events) {
    return [...events].sort((a, b) => b.eventId.localeCompare(a.eventId))
  }

  function createTopicBus ({ topic }) {
    const peers = new Map()
    const deliveries = []

    function workerEvents (worker) {
      return typeof worker.events === 'function' ? worker.events() : []
    }

    function workerView (worker) {
      return typeof worker.view === 'function' ? worker.view() : {}
    }

    async function refreshWorker (worker) {
      if (worker && typeof worker.refresh === 'function') await worker.refresh()
      return {
        view: workerView(worker),
        events: workerEvents(worker)
      }
    }

    function joinPeer (peerId, worker = workerSim.createWorkerSim()) {
      peers.set(peerId, { peerId, worker })
      return peers.get(peerId)
    }

    function getPeer (peerId) {
      const peer = peers.get(peerId)
      if (!peer) throw new Error(`Unknown peer: ${peerId}`)
      return peer
    }

    function publishFrom (peerId, options = {}) {
      const source = getPeer(peerId)
      const sourceEvents = workerEvents(source.worker)
      const deliveredEvents = options.outOfOrder ? outOfOrder(sourceEvents) : sourceEvents
      const payload = options.duplicates ? duplicateEveryOther(deliveredEvents) : deliveredEvents
      const report = []

      for (const peer of peers.values()) {
        if (peer.peerId === peerId) continue
        const beforeRoot = workerView(peer.worker).eventRoot
        const merged = peer.worker.mergeEvents(payload)
        const afterRoot = workerView(peer.worker).eventRoot
        const delivery = {
          topic,
          from: peerId,
          to: peer.peerId,
          offered: payload.length,
          merged,
          beforeRoot,
          afterRoot
        }
        deliveries.push(delivery)
        report.push(delivery)
      }

      return report
    }

    async function publishFromAsync (peerId, options = {}) {
      const source = getPeer(peerId)
      await refreshWorker(source.worker)
      const sourceEvents = workerEvents(source.worker)
      const deliveredEvents = options.outOfOrder ? outOfOrder(sourceEvents) : sourceEvents
      const payload = options.duplicates ? duplicateEveryOther(deliveredEvents) : deliveredEvents
      const report = []

      for (const peer of peers.values()) {
        if (peer.peerId === peerId) continue
        await refreshWorker(peer.worker)
        const beforeRoot = workerView(peer.worker).eventRoot
        const merged = typeof peer.worker.mergeEventsAsync === 'function'
          ? await peer.worker.mergeEventsAsync(payload)
          : peer.worker.mergeEvents(payload)
        await refreshWorker(peer.worker)
        const afterRoot = workerView(peer.worker).eventRoot
        const delivery = {
          topic,
          from: peerId,
          to: peer.peerId,
          offered: payload.length,
          merged,
          beforeRoot,
          afterRoot
        }
        deliveries.push(delivery)
        report.push(delivery)
      }

      return report
    }

    function syncAll (options = {}) {
      const reports = []
      for (const peerId of peers.keys()) reports.push(...publishFrom(peerId, options))
      return {
        topic,
        reports,
        roots: roots(),
        converged: converged()
      }
    }

    async function syncAllAsync (options = {}) {
      const reports = []
      for (const peerId of peers.keys()) reports.push(...await publishFromAsync(peerId, options))
      return {
        topic,
        reports,
        roots: await rootsAsync(),
        converged: await convergedAsync()
      }
    }

    function roots () {
      return Array.from(peers.values()).map(peer => ({
        peerId: peer.peerId,
        root: workerView(peer.worker).eventRoot,
        events: workerEvents(peer.worker).length
      }))
    }

    async function rootsAsync () {
      const rows = []
      for (const peer of peers.values()) {
        await refreshWorker(peer.worker)
        rows.push({
          peerId: peer.peerId,
          root: workerView(peer.worker).eventRoot,
          events: workerEvents(peer.worker).length
        })
      }
      return rows
    }

    function converged () {
      const currentRoots = roots()
      return currentRoots.length > 0 && currentRoots.every(peer => peer.root === currentRoots[0].root)
    }

    async function convergedAsync () {
      const currentRoots = await rootsAsync()
      return currentRoots.length > 0 && currentRoots.every(peer => peer.root === currentRoots[0].root)
    }

    return {
      topic,
      joinPeer,
      publishFrom,
      publishFromAsync,
      syncAll,
      syncAllAsync,
      roots,
      rootsAsync,
      converged,
      convergedAsync,
      deliveries: () => [...deliveries]
    }
  }

  const api = { createTopicBus, gameTopic, duplicateEveryOther, outOfOrder }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupTransportSim = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupTransportSim = 'topic-sync-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./worker-runtime.js */
(function attachPearCupWorkerRuntime (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const runtimeSettings = root.PearCupRuntimeSettings || (canRequireLocal ? require('./runtime-settings.js') : null)
  const runtimeConfigFactory = root.PearCupRuntimeConfig || (canRequireLocal ? require('./runtime-config.js') : null)
  const workerFactory = root.PearCupWorkerSim || (canRequireLocal ? require('./worker-sim.js') : null)
  const sdkRuntime = root.PearCupSdkRuntime || (canRequireLocal ? require('./sdk-runtime.js') : null)

  if (!runtimeSettings) throw new Error('PearCupRuntimeSettings is required before PearCupWorkerRuntime')
  if (!runtimeConfigFactory) throw new Error('PearCupRuntimeConfig is required before PearCupWorkerRuntime')
  if (!workerFactory) throw new Error('PearCupWorkerSim is required before PearCupWorkerRuntime')

  function runtimeRootFor ({ rootObject, settings, sdkPackages, compliance } = {}) {
    const parentRoot = rootObject || root || {}
    const runtimeRoot = Object.create(parentRoot)
    runtimeRoot.PearCupRuntimeSettingsValue = {
      ...settings,
      sdkPackages: sdkPackages || settings.sdkPackages || {},
      compliance: compliance || settings.compliance || {}
    }
    runtimeRoot.PearCupCompliance = runtimeRoot.PearCupRuntimeSettingsValue.compliance
    if (sdkRuntime && !runtimeRoot.PearCupSdkRuntime) runtimeRoot.PearCupSdkRuntime = sdkRuntime
    return runtimeRoot
  }

  function statusFor ({ settings, runtime }) {
    return {
      id: 'pearcup-worker-runtime',
      settings: runtimeSettings.redactRuntimeSettings(settings),
      mode: { ...runtime.mode },
      readiness: runtime.readiness,
      canUseRealMoney: runtime.canUseRealMoney,
      secrets: {
        wdkSeedExposed: false
      }
    }
  }

  function createPearCupWorkerRuntime ({
    settings,
    rootObject = root,
    sdkPackages,
    compliance,
    storage,
    events = [],
    forceDemo = false,
    createWorkerFactory = workerFactory
  } = {}) {
    const resolvedSettings = settings || runtimeSettings.loadRuntimeSettings()
    const runtimeRoot = runtimeRootFor({
      rootObject,
      settings: resolvedSettings,
      sdkPackages,
      compliance
    })
    const runtime = runtimeConfigFactory.createRuntimeConfig({
      rootObject: runtimeRoot,
      sdkPackages: sdkPackages || runtimeRoot.PearCupRuntimeSettingsValue.sdkPackages,
      compliance: compliance || runtimeRoot.PearCupRuntimeSettingsValue.compliance,
      forceDemo
    })
    const worker = runtime.createWorker({
      workerFactory: createWorkerFactory,
      storage,
      events
    })

    function dispatch (command) {
      return worker.dispatch(command)
    }

    function dispatchAsync (command) {
      return worker.dispatchAsync(command)
    }

    function settleGameRound (payload, { actorId = 'settlement-worker' } = {}) {
      return dispatchAsync({
        type: 'settlement:settleGameRound',
        actorId,
        payload
      })
    }

    function settleBracketPool (payload, { actorId = 'settlement-worker' } = {}) {
      return dispatchAsync({
        type: 'settlement:settleBracketPool',
        actorId,
        payload
      })
    }

    async function close () {
      if (runtime && typeof runtime.close === 'function') await runtime.close()
    }

    return {
      runtime,
      worker,
      dispatch,
      dispatchAsync,
      settleGameRound,
      settleBracketPool,
      status: () => statusFor({ settings: resolvedSettings, runtime }),
      close
    }
  }

  const api = {
    createPearCupWorkerRuntime,
    runtimeRootFor,
    statusFor
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupWorkerRuntime = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupWorkerRuntime = 'worker-runtime-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./settlement-service.js */
(function attachPearCupSettlementService (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const workerRuntimeFactory = root.PearCupWorkerRuntime || (canRequireLocal ? require('./worker-runtime.js') : null)
  const settlementReceipts = root.PearCupSettlementReceipts || (canRequireLocal ? require('./settlement-receipts.js') : null)
  if (!workerRuntimeFactory) throw new Error('PearCupWorkerRuntime is required before PearCupSettlementService')

  const SETTLEMENT_LOCKED_CODE = 'PEARCUP_SETTLEMENT_LOCKED'
  const prizeCommandTypes = new Set([
    'wdk:createGameEscrow',
    'wdk:refundGameEscrow',
    'wdk:createEntryIntent',
    'wdk:confirmEntryIntent',
    'wdk:reconcileEntryIntent',
    'wdk:refundEntryIntent',
    'payout:declareRecipient',
    'game:resolveRound',
    'game:submitRoundStateHash',
    'game:recordForfeit',
    'results:recordOfficialSnapshot',
    'pool:resolveSettlement',
    'qvac:refereeAttest',
    'qvac:attestPoolSettlement',
    'wdk:releaseGameEscrow',
    'wdk:createPoolPayout',
    'settlement:settleGameRound',
    'settlement:settleBracketPool',
    'settlement:recordReceipt'
  ])

  function complianceRequirements (compliance = {}) {
    return {
      realMoneyEnabled: compliance.realMoneyEnabled === true,
      kycVerified: compliance.kycVerified === true,
      jurisdictionAllowed: compliance.jurisdictionAllowed === true,
      responsiblePlayAccepted: compliance.responsiblePlayAccepted === true
    }
  }

  function missingComplianceLabels (requirements) {
    const labels = []
    if (!requirements.realMoneyEnabled) labels.push('real money mode is not enabled')
    if (!requirements.kycVerified) labels.push('KYC is not verified')
    if (!requirements.jurisdictionAllowed) labels.push('jurisdiction is not allowed')
    if (!requirements.responsiblePlayAccepted) labels.push('responsible play terms are not accepted')
    return labels
  }

  function settlementGateFor (status = {}) {
    const readiness = status.readiness || {}
    const qvac = readiness.qvac || {}
    const tetherWdk = readiness.tetherWdk || {}
    const compliance = readiness.compliance || {}
    const settlement = readiness.settlement || {}
    const complianceFlags = complianceRequirements(compliance)
    const complianceReady = Object.values(complianceFlags).every(Boolean)
    const requirements = {
      qvacSdkReady: qvac.sdkReady === true,
      tetherWdkSdkReady: tetherWdk.sdkReady === true,
      complianceReady,
      compliance: complianceFlags
    }
    const missing = []

    if (!requirements.qvacSdkReady) {
      missing.push({
        key: 'qvac',
        label: 'QVAC referee SDK is not ready',
        source: qvac.source || 'unknown',
        mode: qvac.mode || (status.mode && status.mode.qvac) || 'unknown',
        missingMethods: qvac.missing || []
      })
    }
    if (!requirements.tetherWdkSdkReady) {
      missing.push({
        key: 'tetherWdk',
        label: 'Tether WDK rail is not ready',
        source: tetherWdk.source || 'unknown',
        mode: tetherWdk.mode || (status.mode && status.mode.tetherWdk) || 'unknown',
        missingMethods: tetherWdk.missing || []
      })
    }
    for (const label of missingComplianceLabels(complianceFlags)) {
      missing.push({
        key: 'compliance',
        label,
        source: 'runtime-compliance'
      })
    }

    const liveReady = settlement.status === 'live-ready' &&
      status.canUseRealMoney === true &&
      requirements.qvacSdkReady &&
      requirements.tetherWdkSdkReady &&
      complianceReady

    return {
      liveReady,
      status: settlement.status || 'unknown',
      label: settlement.label || 'Settlement readiness unknown',
      tone: settlement.tone || 'locked',
      requirements,
      missing,
      mode: status.mode || {}
    }
  }

  function createSettlementLockedError ({ gate, action }) {
    const detail = gate.missing.length
      ? gate.missing.map(item => item.label).join('; ')
      : 'settlement readiness is incomplete'
    const err = new Error(`Live settlement is locked for ${action}: ${detail}`)
    err.code = SETTLEMENT_LOCKED_CODE
    err.action = action
    err.gate = gate
    return err
  }

  function assertLiveSettlementReady (status, action = 'settlement') {
    const gate = settlementGateFor(status)
    if (!gate.liveReady) throw createSettlementLockedError({ gate, action })
    return gate
  }

  function commandActor (opts = {}, fallback = 'settlement-worker') {
    return opts.actorId || fallback
  }

  function receiptEvidenceStatus (summary = {}) {
    const settlementType = summary.roundEvent || summary.type === 'TrustedGameSettlementCompleted' || summary.type === 'TrustedGameSettlementHeld'
      ? 'game-round'
      : summary.poolResultEvent || summary.type === 'TrustedPoolSettlementCompleted' || summary.type === 'TrustedPoolSettlementHeld'
        ? 'bracket-pool'
        : 'unknown'
    const resultEvent = summary.roundEvent || summary.poolResultEvent || null
    const expectedQvacType = settlementType === 'game-round'
      ? 'QvacRefereeAttestationCreated'
      : settlementType === 'bracket-pool'
        ? 'QvacPoolSettlementAttestationCreated'
        : null
    const allowedWdkTypes = settlementType === 'game-round'
      ? new Set(['TetherWdkEscrowReleased', 'TetherWdkEscrowDisputed', 'TetherWdkEscrowRefunded'])
      : settlementType === 'bracket-pool'
        ? new Set(['TetherWdkPoolPayoutPrepared', 'TetherWdkPoolPayoutDisputed'])
        : new Set()
    const missing = []
    if (settlementType === 'unknown') missing.push('settlement type')
    if (!resultEvent) missing.push('settlement result event')
    if (!summary.attestationEvent || summary.attestationEvent.type !== expectedQvacType) missing.push('QVAC attestation event')
    if (!summary.settlementEvent || !allowedWdkTypes.has(summary.settlementEvent.type)) missing.push('WDK settlement event')
    return {
      ok: missing.length === 0,
      missing,
      reason: missing.length
        ? `Settlement receipt requires ${missing.join(', ')} before recording`
        : null
    }
  }

  function createGuardedSettlementService ({
    workerRuntime,
    settings,
    rootObject = root,
    sdkPackages,
    compliance,
    storage,
    events,
    requireLive = true
  } = {}) {
    const harness = workerRuntime || workerRuntimeFactory.createPearCupWorkerRuntime({
      settings,
      rootObject,
      sdkPackages,
      compliance,
      storage,
      events
    })

    function status () {
      const current = typeof harness.status === 'function'
        ? harness.status()
        : {
            mode: harness.runtime && harness.runtime.mode,
            readiness: harness.runtime && harness.runtime.readiness,
            canUseRealMoney: harness.runtime && harness.runtime.canUseRealMoney
          }
      return {
        ...current,
        settlementGate: settlementGateFor(current),
        guardMode: requireLive ? 'live-only' : 'demo-allowed'
      }
    }

    function guardPrizeCommand (action) {
      const current = status()
      if (requireLive) assertLiveSettlementReady(current, action)
      return current.settlementGate
    }

    async function dispatchPrizeCommand ({ type, actorId, payload }) {
      if (!prizeCommandTypes.has(type)) throw new Error(`Unsupported prize command: ${type}`)
      guardPrizeCommand(type)
      return harness.dispatchAsync({ type, actorId, payload })
    }

    function createGameEscrow (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'wdk:createGameEscrow',
        actorId: commandActor(opts, 'tether-wdk'),
        payload
      })
    }

    function refundGameEscrow (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'wdk:refundGameEscrow',
        actorId: commandActor(opts, 'tether-wdk'),
        payload
      })
    }

    function createEntryIntent (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'wdk:createEntryIntent',
        actorId: commandActor(opts, payload && payload.userId ? payload.userId : 'tether-wdk'),
        payload
      })
    }

    function confirmEntryIntent (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'wdk:confirmEntryIntent',
        actorId: commandActor(opts, 'tether-wdk'),
        payload
      })
    }

    function reconcileEntryIntent (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'wdk:reconcileEntryIntent',
        actorId: commandActor(opts, 'tether-wdk'),
        payload
      })
    }

    function refundEntryIntent (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'wdk:refundEntryIntent',
        actorId: commandActor(opts, 'tether-wdk'),
        payload
      })
    }

    function recordOfficialResultsSnapshot (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'results:recordOfficialSnapshot',
        actorId: commandActor(opts, payload && (payload.sourceActorId || payload.officialResultsSourceActorId) ? payload.sourceActorId || payload.officialResultsSourceActorId : 'official-results-feed'),
        payload
      })
    }

    function declarePayoutRecipient (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'payout:declareRecipient',
        actorId: commandActor(opts, payload && payload.userId ? payload.userId : 'settlement-recipient'),
        payload
      })
    }

    function settleGameRound (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'settlement:settleGameRound',
        actorId: commandActor(opts),
        payload
      })
    }

    function settleBracketPool (payload, opts = {}) {
      return dispatchPrizeCommand({
        type: 'settlement:settleBracketPool',
        actorId: commandActor(opts),
        payload
      })
    }

    function createSettlementReceipt (summary, opts = {}) {
      if (!settlementReceipts || typeof settlementReceipts.createSettlementReceipt !== 'function') {
        throw new Error('PearCupSettlementReceipts is required to create settlement receipts')
      }
      const current = status()
      const workerView = harness &&
        harness.worker &&
        typeof harness.worker.view === 'function'
        ? harness.worker.view()
        : null
      const provenance = opts.provenance || (
        typeof settlementReceipts.createRuntimeProvenance === 'function'
          ? settlementReceipts.createRuntimeProvenance({
              status: current,
              settings: current.settings
            })
          : null
      )
      return settlementReceipts.createSettlementReceipt({
        summary,
        eventRoot: opts.eventRoot || (workerView && workerView.eventRoot) || null,
        gate: opts.gate || current.settlementGate,
        mode: opts.mode || current.mode,
        runtimeId: current.id || 'pearcup-worker-runtime',
        provenance
      })
    }

    async function recordSettlementReceipt (summary, opts = {}) {
      guardPrizeCommand('settlement:recordReceipt')
      const workerView = harness &&
        harness.worker &&
        typeof harness.worker.view === 'function'
        ? harness.worker.view()
        : null
      const settlementEventId = summary &&
        summary.settlementEvent &&
        summary.settlementEvent.eventId
      if (
        settlementEventId &&
        workerView &&
        workerView.settlementReceiptEventsBySettlementEvent &&
        workerView.settlementReceiptEventsBySettlementEvent[settlementEventId]
      ) {
        const receiptEvent = workerView.settlementReceiptEventsBySettlementEvent[settlementEventId]
        return {
          receipt: receiptEvent.payload,
          receiptEvent,
          existing: true
        }
      }
      const evidence = receiptEvidenceStatus(summary)
      if (!evidence.ok) {
        return {
          receipt: null,
          receiptEvent: null,
          existing: false,
          held: true,
          reason: evidence.reason,
          missing: evidence.missing
        }
      }
      const receipt = createSettlementReceipt(summary, {
        ...opts,
        eventRoot: opts.eventRoot || (workerView && workerView.eventRoot) || null
      })
      const receiptEvent = await harness.dispatchAsync({
        type: 'settlement:recordReceipt',
        actorId: commandActor(opts, 'settlement-auditor'),
        payload: { receipt }
      })
      return {
        receipt: receiptEvent.payload,
        receiptEvent,
        existing: false
      }
    }

    async function settleGameRoundWithReceipt (payload, opts = {}) {
      if (harness && typeof harness.settleGameRoundWithReceipt === 'function') {
        if (requireLive) guardPrizeCommand('settlement:settleGameRound')
        return harness.settleGameRoundWithReceipt(payload, opts)
      }
      const summary = await settleGameRound(payload, opts)
      const recorded = await recordSettlementReceipt(summary, opts)
      return {
        summary,
        receipt: recorded.receipt,
        receiptEvent: recorded.receiptEvent,
        existingReceipt: recorded.existing,
        receiptHeld: recorded.held === true,
        receiptReason: recorded.reason || null,
        receiptMissing: recorded.missing || []
      }
    }

    async function settleBracketPoolWithReceipt (payload, opts = {}) {
      if (harness && typeof harness.settleBracketPoolWithReceipt === 'function') {
        if (requireLive) guardPrizeCommand('settlement:settleBracketPool')
        return harness.settleBracketPoolWithReceipt(payload, opts)
      }
      const summary = await settleBracketPool(payload, opts)
      const recorded = await recordSettlementReceipt(summary, opts)
      return {
        summary,
        receipt: recorded.receipt,
        receiptEvent: recorded.receiptEvent,
        existingReceipt: recorded.existing,
        receiptHeld: recorded.held === true,
        receiptReason: recorded.reason || null,
        receiptMissing: recorded.missing || []
      }
    }

    async function close () {
      if (harness && typeof harness.close === 'function') await harness.close()
    }

    return {
      harness,
      requireLive,
      status,
      assertLive: (action) => assertLiveSettlementReady(status(), action),
      createGameEscrow,
      refundGameEscrow,
      createEntryIntent,
      confirmEntryIntent,
      reconcileEntryIntent,
      refundEntryIntent,
      recordOfficialResultsSnapshot,
      declarePayoutRecipient,
      settleGameRound,
      settleBracketPool,
      createSettlementReceipt,
      recordSettlementReceipt,
      settleGameRoundWithReceipt,
      settleBracketPoolWithReceipt,
      close
    }
  }

  const api = {
    SETTLEMENT_LOCKED_CODE,
    prizeCommandTypes,
    settlementGateFor,
    assertLiveSettlementReady,
    createSettlementLockedError,
    createGuardedSettlementService
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupSettlementService = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupSettlementService = 'settlement-service-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./worker-client.js */
(function attachPearCupWorkerClient (root) {
  function clone (value) {
    return value == null ? value : JSON.parse(JSON.stringify(value))
  }

  function emptyView () {
    return {
      eventRoot: null,
      typeCounts: {},
      profiles: {},
      profilesByTeam: {},
      bracketDrafts: {},
      bracketDraftsByPool: {},
      matchEvents: {},
      matchEventsByMatch: {},
      statSnapshots: {},
      commentarySegments: {},
      commentaryByMatchLanguage: {},
      commentaryLanguages: {},
      commentaryRejections: [],
      rooms: {},
      roomsByMatch: {},
      roomParticipants: {},
      chatMessages: {},
      chatMessagesByRoom: {},
      voiceStates: {},
      voiceStatesByRoom: {},
      streams: {},
      activeStreams: {},
      activeStreamsByRoom: {},
      gameInvites: {},
      openGameInvites: {},
      gameInviteAcceptances: {},
      gameSessions: {},
      gameSessionsByRoom: {},
      gameSessionTopics: {},
      gameParticipants: {},
      gameSpectators: {},
      activeGameSessions: {},
      commitments: {},
      reveals: {},
      roundStateHashes: {},
      roundStateHashEvents: {},
      forfeitRecords: {},
      forfeitRecordEvents: {},
      roundResults: {},
      attestations: {},
      escrows: {},
      escrowsByGame: {},
      escrowsBySession: {},
      payouts: {},
      escrowRefunds: {},
      escrowRefundsByEscrow: {},
      entryPayments: {},
      entryPaymentChecks: {},
      payoutRecipientDeclarations: {},
      payoutRecipientDeclarationsByPool: {},
      poolPayouts: {},
      settlementReceipts: {},
      settlementReceiptsBySettlementEvent: {},
      settlementReceiptEventsBySettlementEvent: {},
      settlementReceiptRejections: [],
      disputes: []
    }
  }

  function createLocalWorkerClient ({ worker, runtime, workerFactory, storage, events = [] } = {}) {
    const localWorker = worker || (
      runtime && typeof runtime.createWorker === 'function'
        ? runtime.createWorker({ workerFactory, storage, events })
        : null
    )
    if (!localWorker) throw new Error('createLocalWorkerClient requires a worker or runtime.createWorker')

    return {
      kind: 'local',
      dispatch: command => localWorker.dispatch(command),
      dispatchAsync: command => localWorker.dispatchAsync(command),
      events: () => localWorker.events(),
      mergeEvents: events => localWorker.mergeEvents(events),
      mergeEventsAsync: async events => localWorker.mergeEvents(events),
      refresh: async () => ({
        view: clone(localWorker.view()),
        events: clone(localWorker.events())
      }),
      view: () => localWorker.view(),
      adapterMode: () => typeof localWorker.adapterMode === 'function' ? localWorker.adapterMode() : null,
      close: async () => {
        if (typeof localWorker.close === 'function') await localWorker.close()
      },
      localWorker
    }
  }

  function responsePayload (response) {
    if (response && response.ok === false) {
      const err = new Error(response.error || response.reason || 'Pear worker bridge request failed')
      err.response = response
      err.code = response.code
      err.gate = response.gate || response.status && response.status.settlementGate
      throw err
    }
    if (response && Object.prototype.hasOwnProperty.call(response, 'result')) return response.result
    if (response && Object.prototype.hasOwnProperty.call(response, 'payload')) return response.payload
    return response
  }

  function bridgeRequestFunction (bridge) {
    if (!bridge) return null
    if (typeof bridge === 'function') return bridge
    for (const name of ['request', 'call', 'invoke', 'send']) {
      if (typeof bridge[name] === 'function') return bridge[name].bind(bridge)
    }
    return null
  }

  function createBridgeWorkerClient ({ bridge, initialView, initialEvents = [] } = {}) {
    const request = bridgeRequestFunction(bridge)
    if (!request) throw new Error('createBridgeWorkerClient requires a request-capable bridge')
    let cachedView = clone(initialView) || emptyView()
    let cachedEvents = clone(initialEvents) || []
    let cachedStatus = null
    let requestIndex = 0

    function updateCache (response) {
      if (response && response.view) cachedView = clone(response.view)
      if (response && response.eventsIncluded === true && Array.isArray(response.events)) {
        cachedEvents = clone(response.events)
      } else if (response && response.eventsIncluded == null && Array.isArray(response.events)) {
        cachedEvents = clone(response.events)
      }
      if (response && response.status) cachedStatus = clone(response.status)
      return response
    }

    async function ask (action, payload = {}, opts = {}) {
      const requestPayload = opts.includeEvents
        ? { ...payload, includeEvents: true }
        : payload
      const envelope = {
        protocol: 'pearcup-worker-v1',
        requestId: `pearcup-worker-${++requestIndex}`,
        action,
        payload: requestPayload
      }
      return updateCache(await request(envelope))
    }

    async function dispatchAsync (command) {
      return responsePayload(await ask('dispatch', { command }))
    }

    async function mergeEventsAsync (events) {
      return responsePayload(await ask('mergeEvents', { events }, { includeEvents: true }))
    }

    async function settleGameRoundWithReceipt (payload, opts = {}) {
      return responsePayload(await ask('settleGameRoundWithReceipt', { payload, opts }))
    }

    async function settleBracketPoolWithReceipt (payload, opts = {}) {
      return responsePayload(await ask('settleBracketPoolWithReceipt', { payload, opts }))
    }

    async function refresh () {
      await ask('snapshot', {}, { includeEvents: true })
      return {
        view: clone(cachedView),
        events: clone(cachedEvents)
      }
    }

    return {
      kind: 'bridge',
      dispatch () {
        throw new Error('Pear bridge worker client requires dispatchAsync')
      },
      dispatchAsync,
      mergeEvents () {
        throw new Error('Pear bridge worker client requires mergeEventsAsync')
      },
      mergeEventsAsync,
      settleGameRoundWithReceipt,
      settleBracketPoolWithReceipt,
      refresh,
      events: () => clone(cachedEvents),
      view: () => clone(cachedView),
      status: () => clone(cachedStatus),
      adapterMode: () => cachedView && cachedView.adapterMode || null,
      close: async () => {
        if (bridge && typeof bridge.close === 'function') await bridge.close()
      }
    }
  }

  function detectBridge (rootObject = root) {
    if (!rootObject) return null
    return rootObject.PearCupWorkerBridge ||
      rootObject.__PEARCUP_WORKER_BRIDGE__ ||
      rootObject.PearCupBridge ||
      (rootObject.Pear && rootObject.Pear.worker) ||
      (rootObject.Pear && rootObject.Pear.bridge) ||
      null
  }

  function createAutoWorkerClient ({ rootObject = root, local, bridge, preferLocal = false } = {}) {
    if (preferLocal && typeof local === 'function') return local()
    const detectedBridge = bridge || detectBridge(rootObject)
    if (detectedBridge) return createBridgeWorkerClient({ bridge: detectedBridge })
    if (typeof local === 'function') return local()
    return createLocalWorkerClient(local)
  }

  const api = {
    createLocalWorkerClient,
    createBridgeWorkerClient,
    createAutoWorkerClient,
    detectBridge,
    emptyView
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupWorkerClient = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupWorkerClient = 'worker-client-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./peer-net.js */
// PearCup live peer transport.
//
// A minimal channel surface: { topic, backend, send(msg), onMessage(fn), close() }.
// Backends are selected in production-first order:
//   1. PearBrowser window.pear.swarm.v1, using drive-scoped Tier A subtopics.
//   2. Optional Pear Runtime Bare worker hyperswarm, enabled only by explicit opt-in.
//   3. BroadcastChannel for local preview and same-browser smoke tests.
//
// The game/watch code stays transport-agnostic. Topic strings match the settlement
// convention: pearcup:v1:game:<id>, pearcup:v1:watch:<id>.
(function attachPearCupPeerNet (root) {
  const GAME_TOPIC = id => `pearcup:v1:game:${id}`
  const WATCH_TOPIC = id => `pearcup:v1:watch:${id}`
  const PROTOCOL = 'pearcup.peer-net.v1'

  const hasBroadcast = typeof root.BroadcastChannel === 'function'

  function truthy (value) {
    return value === true || value === '1' || value === 'true' || value === 'yes' || value === 'on'
  }

  function bareSwarmEnabled () {
    if (truthy(root.PearCupEnableBareSwarm)) return true
    if (root.PearCupPeerNetOptions && truthy(root.PearCupPeerNetOptions.enableBareSwarm)) return true
    try {
      const params = root.location && root.location.search ? new root.URLSearchParams(root.location.search) : null
      if (params && truthy(params.get('pearcupBareSwarm'))) return true
    } catch (e) {}
    try {
      const env = root.PearCupRuntimeEnv || (root.process && root.process.env) || {}
      if (truthy(env.PEARCUP_ENABLE_BARE_SWARM) || truthy(env.PEARCUP_HYPERSWARM_ENABLED)) return true
    } catch (e) {}
    return false
  }

  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.pearcupPeerNetModule = status
    }
  }

  function setBackendLabel (label) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.pearcupPeerNet = label
    }
    if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
      try { root.dispatchEvent(new root.CustomEvent('pearcup:p2p-backend', { detail: { backend: label } })) } catch (e) {}
    }
  }

  function hasPearBrowserSwarm () {
    return Boolean(root.pear && root.pear.swarm && root.pear.swarm.v1 && typeof root.pear.swarm.v1.join === 'function')
  }

  function encodeFrame (msg) {
    return new root.TextEncoder().encode(JSON.stringify(msg))
  }

  function decodeFrame (data) {
    if (typeof data === 'string') return JSON.parse(data)
    if (data && typeof data.byteLength === 'number') return JSON.parse(new root.TextDecoder().decode(data))
    if (data && data.buffer && typeof data.buffer.byteLength === 'number') return JSON.parse(new root.TextDecoder().decode(data))
    return data
  }

  function createBroadcastChannel (topic, listeners, pending, label) {
    let bc = null
    if (hasBroadcast) {
      bc = new root.BroadcastChannel(topic)
      bc.onmessage = ev => listeners.forEach(fn => { try { fn(ev.data) } catch (e) { /* listener error */ } })
    }
    setBackendLabel(label || (hasBroadcast ? 'broadcast-channel' : 'noop'))
    const api = {
      backend: hasBroadcast ? 'broadcast-channel' : 'noop',
      send (msg) { if (bc) bc.postMessage(msg) },
      close () { try { if (bc) bc.close() } catch (e) { /* already closed */ } }
    }
    while (pending && pending.length) api.send(pending.shift())
    return api
  }

  function createPearBrowserSwarmChannel (topic) {
    const listeners = new Set()
    const pending = []
    const peers = new Map()
    let joined = null
    let fallback = null
    let closed = false
    let backend = 'pearbrowser-swarm-v1'

    function emit (msg) {
      listeners.forEach(fn => { try { fn(msg) } catch (e) { /* listener error */ } })
    }

    function sendToPeer (peer, msg) {
      try { peer.send(encodeFrame(msg)) } catch (e) { /* peer may have left */ }
    }

    function flushToPeer (peer) {
      if (!peer || pending.length === 0) return
      for (const msg of pending) sendToPeer(peer, msg)
    }

    function startFallback () {
      if (closed || fallback) return
      backend = hasBroadcast ? 'broadcast-channel' : 'noop'
      fallback = createBroadcastChannel(topic, listeners, pending, backend)
    }

    ;(async () => {
      try {
        joined = await root.pear.swarm.v1.join(null, {
          subtopic: topic,
          protocol: PROTOCOL,
          version: 1,
          server: true,
          client: true,
          appName: 'PearCup',
          reason: 'Connect PearCup game and watch peers in this room.'
        })
        if (closed) {
          try { joined.destroy() } catch (e) {}
          return
        }
        setBackendLabel('pearbrowser-swarm-v1')
        joined.on('peer', peer => {
          if (!peer || closed) return
          peers.set(peer.id, peer)
          flushToPeer(peer)
        })
        joined.on('message', (peer, data) => {
          if (closed) return
          try { emit(decodeFrame(data)) } catch (e) { /* ignore malformed peer frames */ }
        })
        joined.on('peer-leave', peer => { if (peer) peers.delete(peer.id) })
        joined.on('error', err => {
          if (root.console && root.console.warn) root.console.warn('PearBrowser swarm failed, using fallback transport', err && err.message ? err.message : err)
          startFallback()
        })
        joined.on('closed', () => {
          peers.clear()
          if (!closed) startFallback()
        })
      } catch (err) {
        if (root.console && root.console.warn) root.console.warn('PearBrowser swarm unavailable, using fallback transport', err && err.message ? err.message : err)
        startFallback()
      }
    })()

    return {
      topic,
      get backend () { return fallback ? fallback.backend : backend },
      send (msg) {
        if (closed) return
        if (fallback) { fallback.send(msg); return }
        if (peers.size === 0) {
          pending.push(msg)
          if (pending.length > 32) pending.shift()
          return
        }
        peers.forEach(peer => sendToPeer(peer, msg))
      },
      onMessage (fn) { listeners.add(fn); return () => listeners.delete(fn) },
      close () {
        closed = true
        pending.length = 0
        peers.clear()
        try { if (joined) joined.destroy() } catch (e) { /* already closed */ }
        try { if (fallback) fallback.close() } catch (e) { /* already closed */ }
        listeners.clear()
      }
    }
  }

  // ---- Hyperswarm backend (cross-device) via the Bare worker, when under Pear ----
  const swarm = { pipe: null, tried: false, ready: false, buf: '', listeners: new Set(), peers: 0 }
  function initSwarm () {
    if (swarm.tried) return swarm.ready
    swarm.tried = true
    try {
      const Pear = root.Pear
      if (Pear && Pear.worker && typeof Pear.worker.run === 'function') {
        swarm.pipe = Pear.worker.run('./swarm-worker.cjs')
        swarm.pipe.on('data', d => {
          swarm.buf += (typeof d === 'string' ? d : d.toString())
          let i
          while ((i = swarm.buf.indexOf('\n')) >= 0) {
            const line = swarm.buf.slice(0, i); swarm.buf = swarm.buf.slice(i + 1)
            if (!line) continue
            try {
              const m = JSON.parse(line)
              if (m.event === 'peers') swarm.peers = m.count
              swarm.listeners.forEach(fn => { try { fn(m) } catch (e) {} })
            } catch (e) {}
          }
        })
        swarm.ready = true
      }
    } catch (e) { swarm.ready = false }
    return swarm.ready
  }
  function swarmSend (obj) { if (swarm.pipe) { try { swarm.pipe.write(JSON.stringify(obj) + '\n') } catch (e) {} } }

  function createChannel (topic) {
    // Prefer PearBrowser's native direct P2P bridge for hyper:// apps.
    if (hasPearBrowserSwarm()) return createPearBrowserSwarmChannel(topic)

    // PearBrowser's native swarm is the production P2P path. The older Bare worker
    // bridge is useful for dedicated Pear Runtime testing, but it is too heavy to
    // spawn during normal renderer boot, so it requires an explicit opt-in.
    if (bareSwarmEnabled() && initSwarm()) {
      const listeners = new Set()
      const onMsg = m => { if (m.event === 'message' && m.topic === topic) listeners.forEach(fn => { try { fn(m.data) } catch (e) {} }) }
      swarm.listeners.add(onMsg)
      swarmSend({ cmd: 'join', topic })
      setBackendLabel('hyperswarm')
      return {
        topic,
        backend: 'hyperswarm',
        send (msg) { swarmSend({ cmd: 'send', topic, data: msg }) },
        onMessage (fn) { listeners.add(fn); return () => listeners.delete(fn) },
        close () { swarm.listeners.delete(onMsg); swarmSend({ cmd: 'leave', topic }) }
      }
    }
    // Fallback: BroadcastChannel (same-origin windows/tabs — dev + same-browser play).
    const listeners = new Set()
    const fallback = createBroadcastChannel(topic, listeners, [], hasBroadcast ? 'broadcast-channel' : 'noop')
    return {
      topic,
      backend: fallback.backend,
      send (msg) { fallback.send(msg) },
      onMessage (fn) { listeners.add(fn); return () => listeners.delete(fn) },
      close () { fallback.close(); listeners.clear() }
    }
  }

  // Short, human-shareable room code (invite link fragment).
  function newRoomCode () {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
    let out = ''
    // Deterministic-free randomness is fine for a room code (not security-critical).
    for (let i = 0; i < 6; i++) out += alphabet[(Math.random() * alphabet.length) | 0]
    return out
  }

  function newPeerId () {
    return `${Date.now().toString(36)}-${((Math.random() * 1e9) | 0).toString(36)}`
  }

  // djb2 string hash → hex. Used for commit-reveal (anti-peek in a friendly match).
  function digest (str) {
    let h = 5381
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
    return h.toString(16).padStart(8, '0')
  }
  function commitHash (aim, nonce) { return digest(`${aim}|${nonce}`) }
  function newNonce () { return `${((Math.random() * 1e9) | 0).toString(36)}${((Math.random() * 1e9) | 0).toString(36)}` }

  const api = { GAME_TOPIC, WATCH_TOPIC, createChannel, newRoomCode, newPeerId, commitHash, newNonce, digest }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupPeerNet = api
  markModule('ready')
  setBackendLabel(hasPearBrowserSwarm() ? 'pearbrowser-swarm-v1' : (hasBroadcast ? 'broadcast-channel' : 'noop'))
})(typeof globalThis !== 'undefined' ? globalThis : window)



;/* source: ./peer-match.js */
// PearCup peer penalty match — a REAL two-client shootout.
//
// Two peers join the same room topic (PearCupPeerNet channel). They alternate:
// each round player A shoots (B keeps) then player B shoots (A keeps), five rounds.
// Every kick uses commit-reveal so the keeper can't see the aim before diving and
// the shooter can't change the aim after seeing the dive:
//   shooter → commit H(aim|nonce)   keeper → dive zone   shooter → reveal aim,nonce
// Both clients then resolve the kick deterministically (identical inputs) and animate
// from their own perspective. Reuses app.js's pitch/HUD helpers + `state` (shared
// classic-script globals, referenced bare).
//
// Transport is PearCupPeerNet.createChannel: PearBrowser swarm.v1 for published
// hyper:// apps, Pear Runtime hyperswarm for pear run, BroadcastChannel for local preview.
(function attachPearCupPeerMatch (root) {
  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.pearcupPeerMatchModule = status
    }
  }

  const Net = root.PearCupPeerNet
  if (!Net) { markModule('missing-peer-net'); console.warn('PearCupPeerNet missing — peer match disabled'); return }

  const TOTAL = 5 // rounds (each player takes 5, keeps 5)
  const PM = {
    active: false, started: false, over: false,
    channel: null, code: null,
    self: null, opp: null, role: null,
    kIndex: 0, busy: false,
    commit: null,        // {aim, nonce, power} while I'm shooting
    remoteCommit: null,  // hash received while I'm keeping
    myDive: null,
    helloTimer: null,
    helloAttempts: 0
  }

  const $ = sel => document.querySelector(sel)
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  function syncDiagnostics (stateName) {
    const ds = root.document && root.document.documentElement && root.document.documentElement.dataset
    if (!ds) return
    ds.pearcupPeerMatchState = stateName || (PM.over ? 'over' : PM.started ? 'started' : PM.active ? 'joining' : 'idle')
    ds.pearcupPeerMatchActive = String(Boolean(PM.active))
    ds.pearcupPeerMatchStarted = String(Boolean(PM.started))
    if (PM.code) ds.pearcupPeerMatchCode = PM.code
    else delete ds.pearcupPeerMatchCode
    if (PM.role) ds.pearcupPeerMatchRole = PM.role
    else delete ds.pearcupPeerMatchRole
    if (PM.opp && PM.opp.name) ds.pearcupPeerMatchOpponent = PM.opp.name
    else delete ds.pearcupPeerMatchOpponent
    if (ds.pearcupPendingJoin && PM.code && ds.pearcupPendingJoin === PM.code && PM.started) {
      ds.pearcupJoinState = 'started'
    }
  }

  function reset () {
    stopAnnouncing()
    if (PM.channel) { try { PM.channel.close() } catch (e) {} }
    Object.assign(PM, {
      active: false, started: false, over: false, channel: null, code: null,
      self: null, opp: null, role: null, kIndex: 0, busy: false,
      commit: null, remoteCommit: null, myDive: null, helloTimer: null, helloAttempts: 0
    })
    syncDiagnostics('idle')
  }

  function shooterRoleForKick (k) { return k % 2 === 0 ? 'A' : 'B' } // A shoots first each round
  function iAmShooter () { return shooterRoleForKick(PM.kIndex) === PM.role }
  function roundOf (k) { return Math.floor(k / 2) }

  // ---- lifecycle ----
  function host (code, silent) {
    reset()
    PM.active = true
    PM.code = code || Net.newRoomCode()
    PM.self = { peerId: Net.newPeerId(), name: state.username || 'captain', team: state.team || 'br' }
    openChannel()
    syncDiagnostics('hosting')
    if (!silent) { showToast('Room created — invite your friend'); renderInvite() }
    else showToast('Challenge sent — waiting for them to accept…')
    startAnnouncing()
  }

  function join (code) {
    reset()
    PM.active = true
    PM.code = code
    PM.self = { peerId: Net.newPeerId(), name: state.username || 'captain', team: state.team || 'br' }
    openChannel()
    syncDiagnostics('joining')
    renderConnecting(code)
    startAnnouncing()
  }

  function openChannel () {
    PM.channel = Net.createChannel(Net.GAME_TOPIC(PM.code))
    PM.channel.onMessage(onMessage)
  }

  function announce () { send({ t: 'hello', peer: PM.self }) }
  function send (msg) { if (PM.channel) PM.channel.send({ ...msg, room: PM.code, sender: PM.self.peerId }) }

  function startAnnouncing () {
    stopAnnouncing()
    PM.helloAttempts = 0
    announce()
    if (typeof root.setInterval !== 'function') return
    PM.helloTimer = root.setInterval(() => {
      if (!PM.active || PM.started) {
        stopAnnouncing()
        return
      }
      PM.helloAttempts += 1
      announce()
      if (PM.helloAttempts >= 40) stopAnnouncing()
    }, 500)
  }

  function stopAnnouncing () {
    if (!PM.helloTimer) return
    if (typeof root.clearInterval === 'function') root.clearInterval(PM.helloTimer)
    PM.helloTimer = null
  }

  function onMessage (msg) {
    if (!msg || msg.room !== PM.code || msg.sender === PM.self.peerId) return
    switch (msg.t) {
      case 'hello': return onHello(msg.peer)
      case 'commit': return onCommit(msg)
      case 'dive': return onDive(msg)
      case 'reveal': return onReveal(msg)
      case 'leave': return onOppLeft()
    }
  }

  function onHello (peer) {
    if (PM.started || !peer) return
    if (!PM.opp) { PM.opp = peer; announce() } // re-announce so a late joiner learns me
    syncDiagnostics(PM.role ? undefined : 'connected')
    maybeStart()
  }

  function maybeStart () {
    if (PM.started || !PM.opp) return
    PM.started = true
    stopAnnouncing()
    PM.role = PM.self.peerId < PM.opp.peerId ? 'A' : 'B'
    // Both players on default names would read "captain vs captain" — disambiguate the
    // opponent (they also get a distinct pool avatar from the new name).
    if ((PM.opp.name || '').toLowerCase() === (PM.self.name || '').toLowerCase()) PM.opp.name = 'Rival'
    state.match = { opponent: { name: PM.opp.name, team: PM.opp.team }, stake: 0, peer: true }
    state.shootout = { round: 0, mode: 'shoot', you: 0, opp: 0, youDots: [], oppDots: [], phase: 'aim', busy: false, lastResult: null, peer: true }
    closeModal()
    showToast(`Connected to ${PM.opp.name} — best of five!`)
    setView('games')
    syncDiagnostics('started')
    render()
  }

  function onOppLeft () {
    if (PM.over) return
    showToast(`${PM.opp ? PM.opp.name : 'Opponent'} left the match`)
    leave(true)
  }

  function leave (silent) {
    if (!silent) send({ t: 'leave' })
    reset()
    state.match = null
    ensureShootout(true)
    hideOverlay()
    renderGames()
  }

  // ---- render / turn setup ----
  function render () {
    if (!PM.active || !PM.started) return
    ensureShootoutDom()
    const arena = document.querySelector('#games .game-arena')
    if (arena) arena.classList.remove('is-lobby')
    if (PM.over) return
    setupKick()
  }

  function setupKick () {
    const so = state.shootout
    so.round = roundOf(PM.kIndex)
    so.mode = iAmShooter() ? 'shoot' : 'keep'
    so.phase = 'aim'
    PM.busy = false; PM.myDive = null; PM.remoteCommit = null

    const me = { name: PM.self.name, team: PM.self.team }
    const opp = { name: PM.opp.name, team: PM.opp.team }
    const shooterP = iAmShooter() ? me : opp
    const keeperP = iAmShooter() ? opp : me
    const sTeam = teamById(shooterP.team), kTeam = teamById(keeperP.team)

    const shooter = $('#gameShooter'), keeper = $('#gameKeeper'), ball = $('#gameBall')
    if (shooter) shooter.innerHTML = avatarSvg(shooterP.name, sTeam)
    if (keeper) { keeper.innerHTML = avatarSvg(keeperP.name, kTeam); keeper.style.left = '50%'; keeper.classList.remove('dive-left', 'dive-right', 'dive-mid') }
    if (ball) { ball.classList.remove('is-kicking'); ball.style.left = '50%'; ball.style.top = '80%' }

    setScoreboard(shooterP.name, sTeam, keeperP.name, kTeam,
      `Round ${so.round + 1} of ${TOTAL}`,
      iAmShooter() ? 'Your shot' : `${opp.name} shoots`,
      iAmShooter() ? 'Pick a corner' : 'Read the striker')

    const dock = $('#powerDock')
    if (dock) {
      dock.classList.toggle('is-keep', !iAmShooter())
      const label = dock.querySelector('.power-label')
      if (label) label.innerHTML = iAmShooter() ? 'Power &amp; timing — click a corner to shoot' : `${esc(opp.name)} is lining up — get ready to dive…`
    }

    hideShootBanner()
    renderShootoutHud()

    if (iAmShooter()) { showAimGrid(); startPowerMeter() } else { hideAimGrid(); stopPowerMeter(); showShootBanner('Keeper ready — waiting for their strike…', 'is-wait') }
  }

  // Aim-grid click router (called from app.js when a peer match is active).
  function onZone (zone) {
    if (!PM.active || !PM.started || PM.over || PM.busy) return
    const so = state.shootout
    if (so.phase !== 'aim') return
    if (iAmShooter()) {
      const power = (typeof readPowerPct === 'function') ? readPowerPct() : 60
      const nonce = Net.newNonce()
      PM.commit = { aim: zone, nonce, power }
      so.phase = 'committed'
      hideAimGrid(); stopPowerMeter()
      showShootBanner('Struck! keeper diving…', 'is-stop')
      send({ t: 'commit', kickId: PM.kIndex, hash: Net.commitHash(zone, nonce) })
    } else {
      if (!PM.remoteCommit) return
      PM.myDive = zone
      so.phase = 'dived'
      hideAimGrid()
      showShootBanner('Dive called…', 'is-stop')
      send({ t: 'dive', kickId: PM.kIndex, zone })
    }
  }

  function onCommit (msg) {
    if (msg.kickId !== PM.kIndex || iAmShooter()) return
    PM.remoteCommit = msg.hash
    const so = state.shootout
    if (so.phase !== 'aim') return
    showAimGrid()
    showShootBanner('Now! pick your dive', 'is-goal')
    setTimeout(() => hideShootBanner(), 700)
  }

  function onDive (msg) {
    if (msg.kickId !== PM.kIndex || !iAmShooter() || !PM.commit) return
    send({ t: 'reveal', kickId: PM.kIndex, aim: PM.commit.aim, nonce: PM.commit.nonce, power: PM.commit.power })
    resolveKick(PM.commit.aim, msg.zone, PM.commit.power, PM.commit.nonce)
  }

  function onReveal (msg) {
    if (msg.kickId !== PM.kIndex || iAmShooter() || PM.myDive == null) return
    if (PM.remoteCommit && Net.commitHash(msg.aim, msg.nonce) !== PM.remoteCommit) {
      showToast('⚠ Opponent commitment mismatch — kick voided')
    }
    resolveKick(msg.aim, PM.myDive, msg.power, msg.nonce)
  }

  async function resolveKick (aim, dive, power, nonce) {
    if (PM.busy) return
    PM.busy = true
    const so = state.shootout
    // Shared outcome model from app.js: pure function of (aim, dive, power, entropy),
    // entropy = hash(aim|dive|nonce) with the shooter's revealed nonce — both clients
    // hold identical inputs after reveal, so both derive the identical outcome.
    const outcome = kickOutcome(aim, dive, power, kickEntropy(aim, dive, nonce))
    const iShot = iAmShooter()
    const aimPos = zonePosition(aim)
    const divePos = zonePosition(dive)
    const keeperEl = $('#gameKeeper'), ballEl = $('#gameBall')

    requestAnimationFrame(() => {
      if (keeperEl) {
        keeperEl.style.left = `${divePos.x}%`
        keeperEl.classList.add(divePos.x < 50 ? 'dive-left' : divePos.x > 50 ? 'dive-right' : 'dive-mid')
      }
    })
    let bx = aimPos.x, by = aimPos.y
    if (outcome === 'post') by = (typeof overBarY === 'function') ? overBarY() : 4
    if (outcome === 'save') { bx = divePos.x; by = Math.min(aimPos.y, divePos.y) }
    if (ballEl) { ballEl.classList.add('is-kicking'); requestAnimationFrame(() => { ballEl.style.left = `${bx}%`; ballEl.style.top = `${by}%` }) }
    await sleep(720)

    const scored = outcome === 'goal'
    let good, label
    if (iShot) {
      good = scored
      label = scored ? 'GOAL!' : outcome === 'save' ? 'SAVED!' : 'OVER!'
      if (scored) so.you += 1
      so.youDots.push(scored ? 'goal' : 'miss')
    } else {
      good = !scored
      label = scored ? 'GOAL!' : outcome === 'post' ? 'OVER THE BAR!' : 'SAVED!'
      if (scored) so.opp += 1
      so.oppDots.push(scored ? 'goal' : 'save')
    }
    showShootBanner(label, good ? 'is-goal' : 'is-stop')
    if (good) fireConfetti()
    renderShootoutHud()
    await sleep(1150)
    hideShootBanner()
    if (ballEl) ballEl.classList.remove('is-kicking')
    if (keeperEl) keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid')

    PM.commit = null; PM.myDive = null; PM.remoteCommit = null; PM.busy = false
    PM.kIndex += 1
    if (PM.kIndex >= TOTAL * 2) endMatch()
    else setupKick()
  }

  function endMatch () {
    PM.over = true
    const so = state.shootout
    so.phase = 'over'
    hideAimGrid(); stopPowerMeter()
    const win = so.you > so.opp, draw = so.you === so.opp
    const title = $('#overTitle'), score = $('#overScore'), overlay = $('#shootoutOver'), prizeEl = $('#overPrize'), trophy = $('#overTrophy')
    if (title) { title.textContent = win ? 'You win! 🎉' : draw ? 'Dead level!' : 'You lost'; title.className = 'over-title ' + (win ? 'is-win' : 'is-lose') }
    if (score) score.textContent = `You ${so.you} – ${so.opp} ${PM.opp.name}`
    if (prizeEl) { prizeEl.textContent = win ? 'Bragging rights secured' : draw ? 'Honours even' : 'Rematch to settle it'; prizeEl.className = 'over-prize' }
    if (trophy) trophy.hidden = !win
    if (win) fireConfetti()
    if (overlay) overlay.hidden = false
    const again = $('#playAgain'); if (again) again.textContent = 'New match'
    showToast(win ? `You beat ${PM.opp.name} ${so.you}–${so.opp}!` : draw ? `Level with ${PM.opp.name} ${so.you}–${so.opp}` : `${PM.opp.name} won ${so.opp}–${so.you}`)
    syncDiagnostics('over')
  }

  // ---- invite / connect modals ----
  function hyperLaunchBase () {
    const candidates = []
    const baseEl = document.querySelector('base[href]')
    if (baseEl && baseEl.href) candidates.push(baseEl.href)
    candidates.push(location.href)
    for (const href of candidates) {
      try {
        const url = new URL(href, location.href)
        if (url.protocol === 'hyper:' && url.hostname) return `hyper://${url.hostname}/`
        const match = url.pathname.match(/\/(?:app|hyper)\/([0-9a-f]{64})(?:\/|$)/i)
        if (match) return `hyper://${match[1].toLowerCase()}/`
      } catch (e) {}
    }
    return null
  }

  function inviteLink (code) {
    const hyperBase = hyperLaunchBase()
    if (hyperBase) return `${hyperBase}?join=${encodeURIComponent(code)}`
    const url = new URL(location.href)
    url.search = ''
    url.hash = ''
    url.searchParams.set('join', code)
    return url.toString()
  }
  function closeModal () {
    const m = $('#peerModal')
    if (m) { if (m._onKey) document.removeEventListener('keydown', m._onKey); m.remove() }
  }
  function modal (html) {
    closeModal()
    const el = document.createElement('div')
    el.id = 'peerModal'
    el.className = 'peer-modal'
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    el.innerHTML = `<div class="peer-modal-card">${html}</div>`
    document.body.appendChild(el)
    // Escape mirrors the Cancel button (falls back to just closing).
    el._onKey = e => { if (e.key === 'Escape') { const c = el.querySelector('#peerCancel'); c ? c.click() : closeModal() } }
    document.addEventListener('keydown', el._onKey)
    requestAnimationFrame(() => el.classList.add('is-open'))
    return el
  }
  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s))
  function renderInvite () {
    const link = inviteLink(PM.code)
    const el = modal(`
      <p class="eyebrow">Penalty Clash · Friends</p>
      <h2 class="peer-title">Invite a friend</h2>
      <p class="peer-sub">Open the link in another window/tab now, or send it to a friend on this device. Cross-device runs on the Pear swarm.</p>
      <div class="peer-code">${PM.code}</div>
      <div class="peer-link"><code>${esc(link)}</code></div>
      <div class="peer-actions">
        <button class="secondary-button" id="peerCancel" type="button">Cancel</button>
        <button class="primary-button" id="peerCopy" type="button">Copy invite link</button>
      </div>
      <p class="peer-wait"><i></i> Waiting for your friend…</p>`)
    el.querySelector('#peerCancel').onclick = () => { closeModal(); leave() }
    el.querySelector('#peerCopy').onclick = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {})
      showToast('Invite link copied')
    }
  }
  function renderConnecting (code) {
    const el = modal(`
      <p class="eyebrow">Penalty Clash · Friends</p>
      <h2 class="peer-title">Joining ${esc(code)}…</h2>
      <p class="peer-sub">Connecting to the room. Keep your friend's invite window open.</p>
      <p class="peer-wait" id="peerWaitLine"><i></i> Handshaking…</p>
      <div class="peer-actions"><button class="secondary-button" id="peerCancel" type="button">Cancel</button></div>`)
    el.querySelector('#peerCancel').onclick = () => { closeModal(); leave() }
    // Don't spin forever: if no handshake in 30s, say so and offer the way out.
    setTimeout(() => {
      if (PM.started || !document.body.contains(el)) return
      const wait = el.querySelector('#peerWaitLine')
      if (wait) { wait.innerHTML = 'Connection timed out — ask your friend for a fresh invite code.'; wait.style.color = 'var(--pink-deep)' }
      const cancel = el.querySelector('#peerCancel')
      if (cancel) cancel.textContent = 'Back to lobby'
    }, 30000)
  }
  function promptJoin () {
    const el = modal(`
      <p class="eyebrow">Penalty Clash · Friends</p>
      <h2 class="peer-title">Join a friend</h2>
      <p class="peer-sub">Enter the room code your friend shared.</p>
      <input class="peer-input" id="peerJoinCode" placeholder="e.g. k7m2ph" autocomplete="off">
      <div class="peer-actions">
        <button class="secondary-button" id="peerCancel" type="button">Cancel</button>
        <button class="primary-button" id="peerJoinGo" type="button">Join match</button>
      </div>`)
    el.querySelector('#peerCancel').onclick = closeModal
    el.querySelector('#peerJoinGo').onclick = () => {
      const code = (el.querySelector('#peerJoinCode').value || '').trim().toLowerCase()
      if (code) join(code)
    }
  }

  function isActive () { return PM.active && PM.started && !PM.over }

  root.PearCupPeerMatch = { host, join, promptJoin, onZone, isActive, leave, render, reset, _state: PM }
  syncDiagnostics('idle')
  markModule('ready')
})(typeof window !== 'undefined' ? window : globalThis)



;/* source: ./peer-lobby.js */
// PearCup real matchmaking lobby.
//
// Every open client announces itself on a shared lobby topic and listens for others,
// so the "open challenges" list is LIVE peers — not hardcoded bots. Challenge a peer
// and both drop into a P2P penalty match on a shared game code (via PearCupPeerMatch).
// Transport = PearCupPeerNet (PearBrowser swarm.v1 for published hyper:// apps,
// Pear Runtime hyperswarm, BroadcastChannel for local preview; topic `pearcup:v1:lobby`).
// Presence uses a heartbeat + stale timeout.
(function attachPearCupLobby (root) {
  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.pearcupPeerLobbyModule = status
    }
  }

  const Net = root.PearCupPeerNet
  if (!Net) { markModule('missing-peer-net'); console.warn('PearCupPeerNet missing — matchmaking disabled'); return }

  const LOBBY_TOPIC = 'pearcup:v1:lobby'
  const HEARTBEAT_MS = 4000
  const STALE_MS = 12000

  const L = { channel: null, self: null, peers: new Map(), heartbeat: null, sweeper: null }
  const $ = s => document.querySelector(s)
  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s))

  function selfId () { return L.self && L.self.peerId }

  function ensureSelf () {
    if (!L.self) L.self = { peerId: Net.newPeerId(), name: (typeof state !== 'undefined' && state.username) || 'captain', team: (typeof state !== 'undefined' && state.team) || 'br' }
    else { L.self.name = state.username || L.self.name; L.self.team = state.team || L.self.team }
    return L.self
  }

  // Join the lobby topic + start announcing. Idempotent.
  function join () {
    ensureSelf()
    if (!L.channel) {
      L.channel = Net.createChannel(LOBBY_TOPIC)
      L.channel.onMessage(onMsg)
    }
    announce()
    renderList()
    // Heartbeat: re-announce AND re-render so peers converge even if pings crossed
    // and the list reflects the current roster regardless of message timing.
    if (!L.heartbeat) L.heartbeat = setInterval(() => { announce(); renderList() }, HEARTBEAT_MS)
    if (!L.sweeper) L.sweeper = setInterval(sweep, HEARTBEAT_MS)
  }

  function leave () {
    send({ t: 'gone' })
    if (L.heartbeat) { clearInterval(L.heartbeat); L.heartbeat = null }
    if (L.sweeper) { clearInterval(L.sweeper); L.sweeper = null }
    if (L.channel) { try { L.channel.close() } catch (e) {} L.channel = null }
    L.peers.clear()
  }

  function send (m) { if (L.channel) L.channel.send({ ...m, from: selfId() }) }
  function announce () {
    ensureSelf()
    send({ t: 'here', name: L.self.name, team: L.self.team, ts: nowStamp() })
  }
  // Wall-clock stamp — fine in the browser/Pear renderer.
  function nowStamp () { return (new Date()).getTime() }

  function onMsg (m) {
    if (!m || m.from === selfId()) return
    switch (m.t) {
      case 'here':
        L.peers.set(m.from, { peerId: m.from, name: m.name || 'guest', team: m.team || 'br', last: nowStamp() })
        renderList(); break
      case 'gone':
        L.peers.delete(m.from); renderList(); break
      case 'challenge':
        if (m.to === selfId()) acceptChallenge(m); break
    }
  }

  function sweep () {
    const cut = nowStamp() - STALE_MS
    let changed = false
    for (const [id, p] of L.peers) if (p.last < cut) { L.peers.delete(id); changed = true }
    if (changed) renderList()
  }

  // ---- challenge flow ----
  function challenge (peerId) {
    const peer = L.peers.get(peerId)
    if (!peer || !root.PearCupPeerMatch) return
    const code = Net.newRoomCode()
    // I host the game silently, opponent auto-joins on accept.
    root.PearCupPeerMatch.host(code, true)
    send({ t: 'challenge', to: peerId, code, name: L.self.name })
  }

  function acceptChallenge (m) {
    if (!root.PearCupPeerMatch) return
    showToast(`${esc(m.name || 'A player')} challenged you — joining…`)
    if (typeof setView === 'function') setView('games')
    root.PearCupPeerMatch.join(m.code)
  }

  // ---- render the live list into the lobby ----
  function renderList () {
    const host = $('#lobbyLivePeers')
    if (!host) return
    const peers = [...L.peers.values()]
    if (!peers.length) {
      host.innerHTML = '<p class="lobby-empty">No players online yet — open PearCup in another window, or invite a friend with a code.</p>'
      return
    }
    host.innerHTML = peers.map(p => `
      <div class="lobby-card is-live-peer">
        ${typeof avatarSvg === 'function' ? avatarSvg(p.name, teamById(p.team), true) : ''}
        <div class="lobby-info">
          <strong>${esc(p.name)}</strong>
          <span>${teamById(p.team).flag} online now</span>
        </div>
        <span class="lobby-live-dot" title="online"><i></i>live</span>
        <button class="primary-button compact-action lobby-live-challenge" data-peer="${esc(p.peerId)}" type="button">Challenge</button>
      </div>`).join('')
    host.querySelectorAll('.lobby-live-challenge').forEach(btn =>
      btn.addEventListener('click', () => challenge(btn.dataset.peer)))
  }

  root.PearCupLobby = { join, leave, challenge, renderList, peerCount: () => L.peers.size, _state: L }
  markModule('ready')
})(typeof window !== 'undefined' ? window : globalThis)



;/* source: ./watch-sync.js */
// PearCup watch-party sync — shared chat, reactions, and presence between peers
// watching the same match, over the same PearCupPeerNet transport as the game.
//
// The room topic is derived from the current match (home vs away), so two friends
// watching the same live game land in the same room automatically — no code to
// exchange. Chat lines and reaction emojis broadcast to every peer; presence is a
// lightweight "here"/"bye" ping. Transport = PearBrowser swarm.v1 for published
// hyper:// apps, Pear Runtime hyperswarm, BroadcastChannel for local preview.
(function attachPearCupWatchSync (root) {
  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.pearcupWatchSyncModule = status
    }
  }

  const Net = root.PearCupPeerNet
  if (!Net) { markModule('missing-peer-net'); console.warn('PearCupPeerNet missing — watch sync disabled'); return }

  const WS = { channel: null, topic: null, self: null, peers: new Map(), heartbeat: null }
  const $ = s => document.querySelector(s)

  function selfId () { return WS.self || (WS.self = Net.newPeerId()) }

  function matchKey () {
    try {
      const st = feedState()
      const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
      return `${norm(st.home.name)}-${norm(st.away.name)}` || 'lobby'
    } catch (e) { return 'lobby' }
  }

  // Join (or re-join when the match changes) the watch room for the current game.
  function ensureRoom () {
    const topic = Net.WATCH_TOPIC(matchKey())
    if (WS.topic === topic && WS.channel) { ping(); return }
    if (WS.channel) { try { WS.channel.close() } catch (e) {} }
    WS.peers.clear()
    WS.topic = topic
    WS.channel = Net.createChannel(topic)
    WS.channel.onMessage(onMsg)
    ping()
    updatePresence()
    // Heartbeat so peers always converge even if their initial pings crossed, and so
    // presence drops when someone goes quiet.
    if (WS.heartbeat) clearInterval(WS.heartbeat)
    WS.heartbeat = setInterval(() => { if (WS.channel) ping() }, 5000)
  }

  function send (m) { if (WS.channel) WS.channel.send({ ...m, from: selfId() }) }
  function ping () { send({ t: 'here', name: (typeof state !== 'undefined' && state.username) || 'guest' }) }

  function onMsg (m) {
    if (!m || m.from === selfId()) return
    switch (m.t) {
      case 'here':
        if (!WS.peers.has(m.from)) { WS.peers.set(m.from, m.name || 'guest'); ping() } // reply so they learn me
        else WS.peers.set(m.from, m.name || 'guest')
        updatePresence(); break
      case 'bye': WS.peers.delete(m.from); updatePresence(); break
      case 'chat': receiveChat(m); break
      case 'react': floatReaction(m.emoji); break
    }
  }

  function receiveChat (m) {
    if (typeof state === 'undefined') return
    state.chat.push({ user: m.user, text: m.text, time: m.time })
    state.chat = state.chat.slice(-8)
    if ($('#chatFeed') && typeof renderWatch === 'function') renderWatch()
  }

  // Called by app.js after a local chat send.
  function broadcastChat (user, text, time) { send({ t: 'chat', user, text, time }) }

  // Local + broadcast reaction.
  function react (emoji) { floatReaction(emoji); send({ t: 'react', emoji }) }

  function floatReaction (emoji) {
    const layer = $('#reactionLayer')
    if (!layer) return
    const el = document.createElement('span')
    el.className = 'reaction-pop'
    el.textContent = emoji
    el.style.left = `${10 + Math.random() * 80}%`
    el.style.setProperty('--drift', `${(Math.random() * 60 - 30) | 0}px`)
    layer.appendChild(el)
    setTimeout(() => el.remove(), 2200)
  }

  function updatePresence () {
    const n = WS.peers.size + 1
    if (typeof state !== 'undefined') state.spectators = n
    const label = $('#wrPeers')
    if (label) label.textContent = n <= 1 ? 'Just you' : `${n} watching together`
    const count = $('#spectatorCount')
    if (count) count.textContent = `${n} peers watching`
  }

  function leave () {
    send({ t: 'bye' })
    if (WS.channel) { try { WS.channel.close() } catch (e) {} }
    WS.channel = null; WS.topic = null; WS.peers.clear()
  }

  function bindReactionBar () {
    const bar = $('#watchReactions')
    if (!bar || bar.dataset.bound) return
    bar.dataset.bound = '1'
    bar.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-react]')
      if (btn) react(btn.dataset.react)
    })
  }

  root.PearCupWatchSync = { ensureRoom, broadcastChat, react, bindReactionBar, updatePresence, leave, peerCount: () => WS.peers.size + 1 }
  markModule('ready')
})(typeof window !== 'undefined' ? window : globalThis)



;/* source: ./app.js */
// The Pear renderer has no visible console — surface ANY uncaught error on-screen so a
// pre-boot throw can't leave a blank shell with no explanation.
if (typeof window !== 'undefined') window.__pearcupAppScriptSeen = true
if (typeof window !== 'undefined' && !window.__pearcupErrHook) {
  window.__pearcupErrHook = true
  window.addEventListener('error', e => {
    if (document.getElementById('bootErrorBar')) return
    const bar = document.createElement('pre')
    bar.id = 'bootErrorBar'
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:45vh;overflow:auto;margin:0;padding:12px 16px;background:#3a1030;color:#ffd9ec;font:12px/1.5 ui-monospace,monospace;z-index:99999;white-space:pre-wrap;border-top:3px solid #ff8fc0'
    bar.textContent = 'PearCup error:\n' + (e.error && e.error.stack ? e.error.stack : (e.message || String(e)))
    if (document.body) document.body.appendChild(bar)
  })
}

const teams = [
  { id: 'br', name: 'Brazil', flag: '🇧🇷', colors: ['#139b49', '#ffd447', '#1b55a5'] },
  { id: 'jp', name: 'Japan', flag: '🇯🇵', colors: ['#f6f6f6', '#d91f3c', '#0a2f68'] },
  { id: 'ci', name: 'Ivory Coast', flag: '🇨🇮', colors: ['#f27b22', '#ffffff', '#159759'] },
  { id: 'no', name: 'Norway', flag: '🇳🇴', colors: ['#d91f3c', '#ffffff', '#143d8d'] },
  { id: 'mx', name: 'Mexico', flag: '🇲🇽', colors: ['#0c8c57', '#ffffff', '#d43f3a'] },
  { id: 'ec', name: 'Ecuador', flag: '🇪🇨', colors: ['#f9d33a', '#1f5aa6', '#d13d32'] },
  { id: 'eng', name: 'England', flag: '🏴', colors: ['#ffffff', '#d41f35', '#1c3764'] },
  { id: 'cd', name: 'DR Congo', flag: '🇨🇩', colors: ['#2a9bd8', '#f3d13d', '#d84a3a'] },
  { id: 'ch', name: 'Switzerland', flag: '🇨🇭', colors: ['#d71920', '#ffffff', '#901019'] },
  { id: 'dz', name: 'Algeria', flag: '🇩🇿', colors: ['#ffffff', '#00843d', '#d21034'] },
  { id: 'pt', name: 'Portugal', flag: '🇵🇹', colors: ['#d71920', '#006b3f', '#f6c343'] },
  { id: 'hr', name: 'Croatia', flag: '🇭🇷', colors: ['#ffffff', '#d7272f', '#1f5aa6'] },
  { id: 'es', name: 'Spain', flag: '🇪🇸', colors: ['#c60b1e', '#ffc400', '#75131a'] },
  { id: 'at', name: 'Austria', flag: '🇦🇹', colors: ['#ed2939', '#ffffff', '#8f1d27'] },
  { id: 'fr', name: 'France', flag: '🇫🇷', colors: ['#1d3d8f', '#ffffff', '#d84a3a'] },
  { id: 'ar', name: 'Argentina', flag: '🇦🇷', colors: ['#75aadb', '#ffffff', '#f6b33f'] },
  { id: 'us', name: 'United States', flag: '🇺🇸', colors: ['#ffffff', '#b31942', '#0a3161'] },
  { id: 'ca', name: 'Canada', flag: '🇨🇦', colors: ['#ff0000', '#ffffff', '#8a1538'] },
  { id: 'de', name: 'Germany', flag: '🇩🇪', colors: ['#000000', '#dd0000', '#ffce00'] },
  { id: 'ma', name: 'Morocco', flag: '🇲🇦', colors: ['#c1272d', '#006233', '#ffffff'] },
  { id: 'nl', name: 'Netherlands', flag: '🇳🇱', colors: ['#ae1c28', '#ffffff', '#21468b'] },
  { id: 'sn', name: 'Senegal', flag: '🇸🇳', colors: ['#00853f', '#fdef42', '#e31b23'] },
  { id: 'za', name: 'South Africa', flag: '🇿🇦', colors: ['#007749', '#ffb81c', '#de3831'] },
  { id: 'py', name: 'Paraguay', flag: '🇵🇾', colors: ['#d52b1e', '#ffffff', '#0038a8'] },
  { id: 'co', name: 'Colombia', flag: '🇨🇴', colors: ['#fcd116', '#003893', '#ce1126'] },
  { id: 'gh', name: 'Ghana', flag: '🇬🇭', colors: ['#ce1126', '#fcd116', '#006b3f'] },
  { id: 'se', name: 'Sweden', flag: '🇸🇪', colors: ['#006aa7', '#fecc00', '#0b4f7a'] },
  { id: 'au', name: 'Australia', flag: '🇦🇺', colors: ['#012169', '#ffcd00', '#00843d'] },
  { id: 'be', name: 'Belgium', flag: '🇧🇪', colors: ['#000000', '#fae042', '#ed2939'] },
  { id: 'ba', name: 'Bosnia and Herzegovina', flag: '🇧🇦', colors: ['#002395', '#fecb00', '#ffffff'] },
  { id: 'eg', name: 'Egypt', flag: '🇪🇬', colors: ['#ce1126', '#ffffff', '#000000'] },
  { id: 'cv', name: 'Cabo Verde', flag: '🇨🇻', colors: ['#003893', '#f7d116', '#cf2027'] }
]

// Runtime modules attach via <script> before app.js. In some runtimes (notably the Pear
// renderer, where injected SDK globals can throw during adaptation) a module can be missing
// or its runtime config can throw — never let that blank the whole app. Record issues,
// surface them, and boot the core UI (teams / avatars / game / watch) with safe fallbacks.
const bootIssues = []
function needModule (name) {
  const v = window[name]
  if (!v) bootIssues.push(name + ' missing')
  return v
}
function optionalModule (name) {
  return window[name] || null
}
const PearCupCore = needModule('PearCupCore')
const PearCupAdapters = needModule('PearCupAdapters')
const PearCupRuntimeConfig = needModule('PearCupRuntimeConfig')
const PearCupWorkerSim = optionalModule('PearCupWorkerSim')
const PearCupWorkerClient = optionalModule('PearCupWorkerClient')
const PearCupTransportSim = optionalModule('PearCupTransportSim')
const PearCupStorageSim = optionalModule('PearCupStorageSim')
const PearCupSettlementService = optionalModule('PearCupSettlementService')

// Correctly-shaped demo runtime used when the real runtime config can't initialize.
const DEMO_RUNTIME = {
  adapters: { qvac: { mode: 'demo' }, tetherWdk: { mode: 'demo' }, mode: 'demo' },
  mode: 'demo',
  readiness: {
    qvac: { mode: 'demo', adapterId: 'qvac-demo', label: 'QVAC referee' },
    tetherWdk: { mode: 'demo', adapterId: 'tether-wdk-demo', label: 'Tether WDK rail' },
    compliance: {},
    settlement: { realMoneyEnabled: false }
  },
  canUseRealMoney: false,
  createWorker: (o = {}) => (PearCupWorkerSim && PearCupWorkerSim.createWorkerSim)
    ? PearCupWorkerSim.createWorkerSim({ events: o.events || [], adapters: { mode: 'demo' }, storage: o.storage })
    : null,
  close: async () => {}
}
let integrationRuntime = DEMO_RUNTIME
try {
  if (PearCupRuntimeConfig) integrationRuntime = PearCupRuntimeConfig.createRuntimeConfig()
} catch (e1) {
  bootIssues.push('runtimeConfig threw: ' + (e1 && e1.message))
  try { if (PearCupRuntimeConfig) integrationRuntime = PearCupRuntimeConfig.createRuntimeConfig({ forceDemo: true }) } catch (e2) { integrationRuntime = DEMO_RUNTIME }
}
let bracketRenderSequence = 0
let gameRenderSequence = 0

const pools = [
  { tier: 10, entrants: 124, closes: '12h', max: 256, prize: '$1,240', heat: 'Open', rail: 'USDT demo' },
  { tier: 25, entrants: 82, closes: '9h', max: 160, prize: '$2,050', heat: 'Hot', rail: 'USDT demo' },
  { tier: 50, entrants: 38, closes: '7h', max: 96, prize: '$1,900', heat: 'Sharp', rail: 'USDT demo' },
  { tier: 100, entrants: 19, closes: '5h', max: 64, prize: '$1,900', heat: 'Elite', rail: 'USDT demo' }
]

const round32Matches = [
  { id: 'r32-1', time: 'Sat, 06/28', status: 'FT', slots: ['ca', 'za'], score: [1, 0], sample: { ca: ['noah'], za: ['zola'] } },
  { id: 'r32-2', time: 'Sun, 06/29', status: 'PEN 3-2', slots: ['ma', 'nl'], score: [1, 1], sample: { ma: ['youssef'], nl: ['daan'] } },
  { id: 'r32-3', time: 'Sun, 06/29', status: 'FT', slots: ['br', 'jp'], score: [2, 1], sample: { br: ['lina', 'ash'], jp: ['ken'] } },
  { id: 'r32-4', time: 'Mon, 06/30', status: 'FT', slots: ['no', 'ci'], score: [2, 1], sample: { no: ['vera', 'jo'], ci: ['paz'] } },
  { id: 'r32-5', time: 'Sun, 06/29', status: 'PEN 4-3', slots: ['py', 'de'], score: [1, 1], sample: { py: ['santi'], de: ['fritz'] } },
  { id: 'r32-6', time: 'Mon, 06/30', status: 'FT', slots: ['fr', 'se'], score: [3, 0], sample: { fr: ['cam'], se: ['ingrid'] } },
  { id: 'r32-7', time: 'Mon, 06/30', status: 'FT', slots: ['mx', 'ec'], score: [2, 0], sample: { mx: ['milo'], ec: ['rio'] } },
  { id: 'r32-8', time: 'Tue, 07/01', status: 'FT', slots: ['eng', 'cd'], score: [2, 1], sample: { eng: ['sasha'], cd: ['kito'] } },
  { id: 'r32-9', time: 'Tue, 07/01', status: 'AET', slots: ['be', 'sn'], score: [3, 2], sample: { be: ['eline'], sn: ['amina'] } },
  { id: 'r32-10', time: 'Tue, 07/01', status: 'FT', slots: ['us', 'ba'], score: [2, 0], sample: { us: ['maya'], ba: ['dado'] } },
  { id: 'r32-11', time: 'Today, 15:00', status: 'Open', slots: ['es', 'at'], score: [null, null], sample: { es: ['sol'], at: ['finn'] } },
  { id: 'r32-12', time: 'Today, 19:00', status: 'Open', slots: ['pt', 'hr'], score: [null, null], sample: { pt: ['ines'], hr: ['marko'] } },
  { id: 'r32-13', time: 'Today, 23:00', status: 'Open', slots: ['ch', 'dz'], score: [null, null], sample: { ch: ['noa'], dz: ['samir'] } },
  { id: 'r32-14', time: 'Fri, 07/03, 14:00', status: 'Open', slots: ['au', 'eg'], score: [null, null], sample: { au: ['matilda'], eg: ['omar'] } },
  { id: 'r32-15', time: 'Fri, 07/03, 18:00', status: 'Open', slots: ['ar', 'cv'], score: [null, null], sample: { ar: ['leo'], cv: ['sofia'] } },
  { id: 'r32-16', time: 'Fri, 07/03, 21:30', status: 'Open', slots: ['co', 'gh'], score: [null, null], sample: { co: ['vale'], gh: ['kwame'] } }
]

const commentary = {
  EN: [
    ['Today', 'Spain vs Austria is the next Round of 32 room. Picks are open until kickoff.'],
    ['19:00Z', 'Portugal vs Croatia follows later today, then Switzerland vs Algeria closes the slate.'],
    ['R32', 'Pool impact is live, but the fallback feed will not invent scores before kickoff.']
  ],
  PT: [
    ['Today', 'Espanha vs Austria e a proxima sala do Round of 32. Palpites abertos ate o inicio.'],
    ['19:00Z', 'Portugal vs Croacia vem depois, e Suica vs Argelia fecha o dia.'],
    ['R32', 'O impacto do bolao esta ativo, mas o fallback nao inventa placares antes do jogo.']
  ],
  ES: [
    ['Today', 'Espana vs Austria es la proxima sala de Round of 32. Picks abiertos hasta el inicio.'],
    ['19:00Z', 'Portugal vs Croacia sigue mas tarde, y Suiza vs Argelia cierra el dia.'],
    ['R32', 'El impacto del pool esta activo, pero el fallback no inventa marcadores antes del partido.']
  ],
  FR: [
    ['Today', 'Espagne vs Autriche est la prochaine salle du Round of 32. Picks ouverts jusqu au coup d envoi.'],
    ['19:00Z', 'Portugal vs Croatie suit ensuite, puis Suisse vs Algerie ferme la journee.'],
    ['R32', 'L impact du pool est actif, mais le fallback ne fabrique pas de score avant le match.']
  ]
}

const defaultChat = [
  { user: 'lina', text: 'Spain/Austria room is up. No fake score until the feed lands.', time: 'Today' },
  { user: 'vera', text: 'Portugal/Croatia pool is next on my list.', time: '19:00Z' },
  { user: 'ash', text: 'Good, bracket is still Round of 32.', time: 'R32' }
]

const liveTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'stats', label: 'Stats' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'games', label: 'Games' },
  { id: 'qvac', label: 'QVAC' }
]

const homeFixtures = [
  { status: 'Today, 15:00', title: 'Spain vs Austria', detail: 'Round of 32 match room', live: false },
  { status: 'Today, 19:00', title: 'Portugal vs Croatia', detail: '$50 pool closing', live: false },
  { status: 'Today, 23:00', title: 'Switzerland vs Algeria', detail: 'Late room opening', live: false }
]

const matchStats = [
  ['Possession', '58%', '42%', 58],
  ['Shots', '12', '6', 67],
  ['xG', '1.82', '0.74', 71],
  ['Pass accuracy', '89%', '81%', 62],
  ['Corners', '5', '2', 71],
  ['Saves', '1', '4', 20]
]

const leaders = [
  { user: 'lina', team: 'br', score: '12/15', prize: '$812' },
  { user: 'amara', team: 'ci', score: '12/15', prize: '$540' },
  { user: 'vera', team: 'no', score: '11/15', prize: '$410' },
  { user: 'diego', team: 'ar', score: '11/15', prize: '$305' },
  { user: 'milo', team: 'mx', score: '10/15', prize: '$190' },
  { user: 'kenji', team: 'jp', score: '10/15', prize: '$120' }
]

const gameRounds = [
  {
    shooter: 'captain',
    shooterTeam: 'br',
    keeper: 'vera',
    keeperTeam: 'no',
    aim: 'right-high',
    dive: 'right-high',
    power: 3,
    curve: 1,
    releaseTick: 42,
    keeperTick: 43
  },
  {
    shooter: 'vera',
    shooterTeam: 'no',
    keeper: 'captain',
    keeperTeam: 'br',
    aim: 'left-low',
    dive: 'center-low',
    power: 4,
    curve: -1,
    releaseTick: 39,
    keeperTick: 41
  },
  {
    shooter: 'captain',
    shooterTeam: 'br',
    keeper: 'milo',
    keeperTeam: 'mx',
    aim: 'center-high',
    dive: 'left-high',
    power: 4,
    curve: 2,
    releaseTick: 45,
    keeperTick: 44
  }
]

const gameLeaderboardRows = [
  { user: 'captain', team: 'br', record: '4-1', trust: '99.2%' },
  { user: 'freya', team: 'hr', record: '4-1', trust: '98.9%' },
  { user: 'vera', team: 'no', record: '3-2', trust: '98.7%' },
  { user: 'kwame', team: 'ci', record: '3-2', trust: '98.1%' },
  { user: 'milo', team: 'mx', record: '3-2', trust: '97.9%' }
]

const bracketLinks = [
  { from: ['r32-1', 'r32-2'], to: 'r16-1' },
  { from: ['r32-3', 'r32-4'], to: 'r16-2' },
  { from: ['r32-5', 'r32-6'], to: 'r16-3' },
  { from: ['r32-7', 'r32-8'], to: 'r16-4' },
  { from: ['r32-9', 'r32-10'], to: 'r16-5' },
  { from: ['r32-11', 'r32-12'], to: 'r16-6' },
  { from: ['r32-13', 'r32-14'], to: 'r16-7' },
  { from: ['r32-15', 'r32-16'], to: 'r16-8' },
  { from: ['r16-1', 'r16-2'], to: 'qf-1' },
  { from: ['r16-3', 'r16-4'], to: 'qf-2' },
  { from: ['r16-5', 'r16-6'], to: 'qf-3' },
  { from: ['r16-7', 'r16-8'], to: 'qf-4' },
  { from: ['qf-1', 'qf-2'], to: 'sf-1' },
  { from: ['qf-3', 'qf-4'], to: 'sf-2' },
  { from: ['sf-1', 'sf-2'], to: 'final-1' }
]

const bracketMatchIds = [
  'r32-1', 'r32-2', 'r32-3', 'r32-4',
  'r32-5', 'r32-6', 'r32-7', 'r32-8',
  'r32-9', 'r32-10', 'r32-11', 'r32-12',
  'r32-13', 'r32-14', 'r32-15', 'r32-16',
  'r16-1', 'r16-2', 'r16-3', 'r16-4',
  'r16-5', 'r16-6', 'r16-7', 'r16-8',
  'qf-1', 'qf-2', 'qf-3', 'qf-4',
  'sf-1', 'sf-2',
  'final-1'
]

const state = loadState()

if (typeof history !== 'undefined' && 'scrollRestoration' in history) history.scrollRestoration = 'manual'

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

function loadState () {
  const fallback = {
    view: 'onboarding',
    username: 'captain',
    team: 'br',
    selectedTier: 25,
    picks: {},
    language: 'EN',
    liveTab: 'overview',
    gameRound: 0,
    gameSpectating: false,
    voice: false,
    payoutAddresses: {},
    wallet: {
      balance: 500,
      currency: 'USDT',
      pendingPayout: 120,
      ledger: [{ label: 'Welcome bonus', amount: 500, kind: 'credit' }]
    },
    enteredPools: {},
    liveConfig: { enabled: false, provider: 'football-data', apiKey: '', matchId: '', proxy: '', pollSec: 30 },
    theme: 'kawaii',
    themeChosen: false,
    chat: defaultChat
  }

  try {
    const saved = JSON.parse(localStorage.getItem('pearcup-prototype') || 'null')
    if (!saved) return fallback
    const merged = {
      ...fallback,
      ...saved,
      chat: saved.chat || defaultChat,
      payoutAddresses: { ...fallback.payoutAddresses, ...(saved.payoutAddresses || {}) },
      wallet: { ...fallback.wallet, ...(saved.wallet || {}) },
      enteredPools: saved.enteredPools || {},
      liveConfig: { ...fallback.liveConfig, ...(saved.liveConfig || {}) }
    }
    // A live peer match can't survive a reload (the connection is gone) — start in the lobby.
    if (merged.match && merged.match.peer) merged.match = null
    merged.picks = normalizeBracketPicks(merged.picks)
    return merged
  } catch {
    return fallback
  }
}

function normalizeBracketPicks (picks = {}) {
  const source = picks && typeof picks === 'object' && !Array.isArray(picks) ? picks : {}
  const next = { ...source }
  const hasRound32 = Object.keys(next).some(id => id.startsWith('r32-'))
  if (!hasRound32) {
    for (let i = 1; i <= 8; i++) {
      if (next[`r16-${i}`] && !next[`r32-${i}`]) next[`r32-${i}`] = next[`r16-${i}`]
      if (next[`qf-${i}`] && !next[`r16-${i}`]) next[`r16-${i}`] = next[`qf-${i}`]
    }
    for (let i = 1; i <= 4; i++) {
      if (next[`sf-${i}`] && !next[`qf-${i}`]) next[`qf-${i}`] = next[`sf-${i}`]
    }
    if (next['final-1'] && !next['sf-1']) next['sf-1'] = next['final-1']
  }
  const knownTeamIds = new Set(teams.map(team => team.id))
  const round32ById = new Map(round32Matches.map(match => [match.id, match]))
  for (const id of Object.keys(next)) {
    const teamId = next[id]
    if (!bracketMatchIds.includes(id) || !knownTeamIds.has(teamId)) {
      delete next[id]
      continue
    }
    const round32Match = round32ById.get(id)
    if (round32Match && !round32Match.slots.includes(teamId)) delete next[id]
  }
  return next
}

function persist () {
  try {
    localStorage.setItem('pearcup-prototype', JSON.stringify(state))
  } catch {}
}

function teamById (id) {
  return teams.find(team => team.id === id) || teams[0]
}

function escapeHtml (value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function serviceModeLabel (service) {
  return service.mode === 'sdk' ? 'SDK' : 'Demo'
}

function serviceStatusText (service) {
  if (service.sdkReady) return `${serviceModeLabel(service)} connected`
  if (service.sdkDetected) return `SDK missing ${service.missing.join(', ')}`
  return 'Demo adapter'
}

function settlementStatusClass (settlement) {
  if (settlement.tone === 'ready') return 'is-ready'
  if (settlement.tone === 'warn') return 'is-warn'
  return 'is-locked'
}

function createUiSettlementService (worker) {
  function workerStatusOrRendererStatus () {
    const workerStatus = worker && typeof worker.status === 'function' ? worker.status() : null
    if (workerStatus) return workerStatus
    return {
      id: 'pearcup-renderer-settlement',
      mode: { ...integrationRuntime.mode },
      readiness: integrationRuntime.readiness,
      canUseRealMoney: integrationRuntime.canUseRealMoney,
      secrets: {
        wdkSeedExposed: false
      }
    }
  }

  const workerRuntime = {
    runtime: integrationRuntime,
    worker,
    dispatchAsync: command => worker.dispatchAsync(command),
    status: workerStatusOrRendererStatus,
    close: async () => {}
  }
  if (worker && typeof worker.settleGameRoundWithReceipt === 'function') {
    workerRuntime.settleGameRoundWithReceipt = (payload, opts) => worker.settleGameRoundWithReceipt(payload, opts)
  }
  if (worker && typeof worker.settleBracketPoolWithReceipt === 'function') {
    workerRuntime.settleBracketPoolWithReceipt = (payload, opts) => worker.settleBracketPoolWithReceipt(payload, opts)
  }

  return PearCupSettlementService.createGuardedSettlementService({
    workerRuntime,
    requireLive: integrationRuntime.canUseRealMoney
  })
}

function renderSettlementError (target, err, title = 'Settlement blocked') {
  const gate = err && err.gate
  const missing = gate && Array.isArray(gate.missing) && gate.missing.length
    ? gate.missing.map(item => `<li>${escapeHtml(item.label)}</li>`).join('')
    : '<li>Runtime readiness is incomplete.</li>'
  target.innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header">
        <p class="eyebrow">Settlement</p>
        <strong>${escapeHtml(title)}</strong>
      </div>
      <ul class="runtime-missing-list">${missing}</ul>
    </article>
  `
}

function renderSignalPanel () {
  const readiness = integrationRuntime.readiness
  return `
    <div class="rail-header">
      <p class="eyebrow">Pear</p>
      <strong>Room signal</strong>
    </div>
    <div class="signal-row">
      <span>Peers</span>
      <strong>${state.spectators || 38}</strong>
    </div>
    <div class="signal-row">
      <span>Core lag</span>
      <strong>0.4s</strong>
    </div>
    <div class="signal-row">
      <span>Ref status</span>
      <strong>${serviceModeLabel(readiness.qvac)}</strong>
    </div>
    <div class="signal-row">
      <span>Payments</span>
      <strong>${serviceModeLabel(readiness.tetherWdk)}</strong>
    </div>
    <div class="signal-row">
      <span>Prize gate</span>
      <strong>${readiness.settlement.realMoneyEnabled ? 'Live' : 'Locked'}</strong>
    </div>
  `
}

function initials (name) {
  const clean = String(name || 'you').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return clean.slice(0, 2).toUpperCase()
}

function hashString (value) {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function mixHex (hex, target, amount) {
  const normalize = value => {
    const clean = value.replace('#', '')
    const full = clean.length === 3 ? clean.split('').map(char => char + char).join('') : clean
    return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16))
  }
  const from = normalize(hex)
  const to = normalize(target)
  const mixed = from.map((channel, index) => {
    const value = Math.round(channel + (to[index] - channel) * amount)
    return value.toString(16).padStart(2, '0')
  })
  return `#${mixed.join('')}`
}

// Registry for AI-generated Higgsfield portraits, keyed by `${name}-${team.id}`.
// The static SVG shell remains a pre-boot fallback; hydrated avatars use these assets.
const AVATAR_PORTRAITS = (typeof window !== 'undefined' && (window.__pearcupPortraits = window.__pearcupPortraits || {})) || {}
Object.assign(AVATAR_PORTRAITS, {
  'captain-br': 'avatars/captain-br.png',
  captain: 'avatars/captain-br.png',
  vera: 'avatars/vera-no.png',
  milo: 'avatars/milo-mx.png',
  lina: 'avatars/lina-no.png',
  kaito: 'avatars/kaito-jp.png',
  mateo: 'avatars/mateo-ar.png',
  emre: 'avatars/emre-ch.png',
  zola: 'avatars/zola-ci.png',
  samir: 'avatars/samir.png',
  saki: 'avatars/saki.png',
  dado: 'avatars/dado.png',
  ash: 'avatars/ash.png'
})
Object.assign(AVATAR_PORTRAITS, {
  aria: 'avatars/p-aria.png', rico: 'avatars/p-rico.png', kenji: 'avatars/p-kenji.png',
  amara: 'avatars/p-amara.png', luca: 'avatars/p-luca.png', sofia: 'avatars/p-sofia.png',
  omar: 'avatars/p-omar.png', nina: 'avatars/p-nina.png', diego: 'avatars/p-diego.png',
  yuki: 'avatars/p-yuki.png', kwame: 'avatars/p-kwame.png', ingrid: 'avatars/p-ingrid.png',
  rafa: 'avatars/p-rafa.png', mei: 'avatars/p-mei.png', tariq: 'avatars/p-tariq.png',
  freya: 'avatars/p-freya.png', santi: 'avatars/p-santi.png', kofi: 'avatars/p-kofi.png'
})

const AVATAR_POOL = [
  'p-aria', 'p-rico', 'p-kenji', 'p-amara', 'p-luca', 'p-sofia', 'p-omar', 'p-nina',
  'p-diego', 'p-yuki', 'p-kwame', 'p-ingrid', 'p-rafa', 'p-mei', 'p-tariq', 'p-freya',
  'p-santi', 'p-kofi'
]

function pooledPortrait (name, team) {
  const h = hashString(`${name}-${team && team.id ? team.id : ''}`)
  return `avatars/${AVATAR_POOL[h % AVATAR_POOL.length]}.png`
}

function avatarPortrait (name, team) {
  if (!team || !team.id) return AVATAR_PORTRAITS[String(name).toLowerCase()] || null
  return AVATAR_PORTRAITS[`${name}-${team.id}`] ||
    AVATAR_PORTRAITS[String(name).toLowerCase()] ||
    pooledPortrait(name, team)
}

// Pick a jersey base color that stays visible on light backgrounds:
// prefer the iconic primary, but skip past any near-white team color.
function pickJerseyColor (colors) {
  const isNearWhite = hex => {
    const clean = hex.replace('#', '')
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
    const rgb = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16))
    return Math.min(...rgb) > 214
  }
  return colors.find(c => !isNearWhite(c)) || colors[0]
}

const KAWAII_HAIR = ['#ff8fc0', '#b79bff', '#7cc4ff', '#ffd76b', '#8a5a3c', '#5a4a6b']
const KAWAII_SKIN = ['#ffe6d3', '#ffd9c0', '#f0c09b', '#d9a17a', '#b97e58']

function avatarSvg (name, team, compact = false) {
  const seed = hashString(`${name}-${team.id}`)
  const scaleClass = compact ? 'compact-avatar' : 'showcase-avatar'
  const prefix = `av-${compact ? 'sm' : 'lg'}-${team.id}-${seed}`.replace(/[^a-z0-9-]/gi, '')
  const jersey = pickJerseyColor(team.colors)
  const jerseyLight = mixHex(jersey, '#ffffff', 0.32)
  const jerseyDeep = mixHex(jersey, '#3a1030', 0.28)
  const accent = team.colors.find(c => c !== jersey) || '#ff8fc0'
  const label = escapeHtml(initials(name))
  const shoe = mixHex(accent, '#ff8fc0', 0.15)
  const skin = KAWAII_SKIN[seed % KAWAII_SKIN.length]
  const skinShade = mixHex(skin, '#e08a6a', 0.45)
  const ariaLabel = `${escapeHtml(name)} anime avatar wearing ${escapeHtml(team.name)} kit`

  const portrait = avatarPortrait(name, team)
  if (portrait) {
    const pv = compact ? '10 10 180 180' : '0 0 200 200'
    return `
    <svg class="avatar-art ${scaleClass}" viewBox="${pv}" role="img" aria-label="${ariaLabel}">
      <defs><clipPath id="${prefix}-pc"><rect x="14" y="14" width="172" height="172" rx="46"/></clipPath></defs>
      <rect x="10" y="10" width="180" height="180" rx="50" fill="${jerseyLight}"/>
      <text x="100" y="113" text-anchor="middle" font-size="44" font-weight="900" fill="${jerseyDeep}" opacity="0.72" font-family="Arial, sans-serif">${label}</text>
      <image href="${escapeHtml(portrait)}" x="14" y="14" width="172" height="172" clip-path="url(#${prefix}-pc)" preserveAspectRatio="xMidYMid slice"/>
      <rect x="14" y="14" width="172" height="172" rx="46" fill="none" stroke="#ffffff" stroke-width="6"/>
      <rect x="14" y="14" width="172" height="172" rx="46" fill="none" stroke="${jersey}" stroke-width="3" opacity="0.6"/>
    </svg>`
  }

  // ---- Seeded cosmetic traits (decorrelated so each user/team reads as a distinct character) ----
  const hair = KAWAII_HAIR[Math.floor(seed / 3) % KAWAII_HAIR.length]
  const hairDeep = mixHex(hair, '#5a2a4a', 0.35)
  const hairLite = mixHex(hair, '#ffffff', 0.28)
  const eyeColors = ['#6b4a2f', '#7a5aa0', '#3f7fbf', '#3fa07f', '#a0567f', '#c06a3a']
  const eyeCol = eyeColors[Math.floor(seed / 19) % eyeColors.length]
  const eyeDeep = mixHex(eyeCol, '#160b0c', 0.5)
  const styleId = Math.floor(seed / 7) % 7
  const eyeId = Math.floor(seed / 11) % 4
  const mouthId = Math.floor(seed / 13) % 4
  const accId = Math.floor(seed / 17) % 5
  const jerseyNumber = String((seed % 89) + 10)
  const hf = `url(#${prefix}-hair)`

  const crown = `<path d="M44 76c-4-36 22-60 56-60s60 24 56 60c-6-16-16-22-24-18 2-8-3-14-10-14 1 7-4 12-10 12 2-9-6-16-12-16s-14 7-12 16c-6 0-11-5-10-12-7 0-12 6-10 14-8-4-18 2-24 18Z" fill="${hf}"/>`

  // Hair drawn BEHIND the head (tails, length).
  const hairBack = [
    '',
    `<path d="M42 78c-18 10-24 40-16 74 12-6 20-8 28-4-8-24-10-48-4-70Z" fill="${hairDeep}"/><path d="M158 78c18 10 24 40 16 74-12-6-20-8-28-4 8-24 10-48 4-70Z" fill="${hairDeep}"/>`,
    `<path d="M150 66c34 6 42 44 26 82-8 20-22 26-30 18 16-30 16-70 4-100Z" fill="${hairDeep}"/>`,
    '',
    `<path d="M38 74c-8 42-6 78 4 100 8-2 14-2 20 2-2-42-2-82-4-108Z" fill="${hairDeep}"/><path d="M162 74c8 42 6 78-4 100-8-2-14-2-20 2 2-42 2-82 4-108Z" fill="${hairDeep}"/>`,
    '',
    ''
  ][styleId]

  // Hair drawn OVER the head (crown, bangs, buns).
  const hairFront = [
    `${crown}<circle cx="46" cy="66" r="16" fill="${hf}"/><circle cx="154" cy="66" r="16" fill="${hf}"/>`,
    `${crown}<circle cx="40" cy="80" r="7" fill="${accent}"/><circle cx="160" cy="80" r="7" fill="${accent}"/>`,
    `${crown}<circle cx="150" cy="64" r="7" fill="${accent}"/>`,
    `<path d="M40 82c-6-26 6-38 14-30-2-16 8-24 16-14 0-16 12-22 20-10 4-16 16-18 22-4 2-16 16-18 22-4 8-12 20-6 20 10 8-8 20 0 14 18-12-8-28-10-44-10s-32 2-44 10Z" fill="${hf}"/>`,
    `<path d="M46 74c0-34 24-56 54-56s54 22 54 56c-6-14-16-20-26-16-6-6-14-6-20 0-6-4-14-4-20 2-8-6-30-2-42 14Z" fill="${hf}"/><path d="M100 20v22" stroke="${hairDeep}" stroke-width="2.5" opacity="0.55" fill="none"/>`,
    `${crown}<circle cx="70" cy="22" r="14" fill="${hf}"/><circle cx="130" cy="22" r="14" fill="${hf}"/><circle cx="70" cy="22" r="6" fill="${hairDeep}" opacity="0.4"/><circle cx="130" cy="22" r="6" fill="${hairDeep}" opacity="0.4"/>`,
    `${crown}<circle cx="52" cy="52" r="12" fill="${hf}"/><circle cx="148" cy="52" r="12" fill="${hf}"/><circle cx="70" cy="34" r="12" fill="${hf}"/><circle cx="130" cy="34" r="12" fill="${hf}"/><circle cx="100" cy="27" r="13" fill="${hf}"/>`
  ][styleId]

  const shine = `<path d="M66 40q34-22 68 2" stroke="${hairLite}" stroke-width="4" opacity="0.5" fill="none" stroke-linecap="round"/>`

  // Eyes.
  const eyes = [
    `<ellipse cx="76" cy="74" rx="13" ry="16" fill="#fff"/><ellipse cx="124" cy="74" rx="13" ry="16" fill="#fff"/>
     <circle cx="77" cy="76" r="11" fill="${eyeCol}"/><circle cx="125" cy="76" r="11" fill="${eyeCol}"/>
     <circle cx="77" cy="77" r="6" fill="${eyeDeep}"/><circle cx="125" cy="77" r="6" fill="${eyeDeep}"/>
     <circle cx="81" cy="71" r="4" fill="#fff"/><circle cx="129" cy="71" r="4" fill="#fff"/>
     <circle cx="73" cy="81" r="2" fill="#fff"/><circle cx="121" cy="81" r="2" fill="#fff"/>`,
    `<path d="M66 79q10-13 20 0" stroke="${eyeDeep}" stroke-width="4" fill="none" stroke-linecap="round"/>
     <path d="M114 79q10-13 20 0" stroke="${eyeDeep}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    `<ellipse cx="76" cy="74" rx="13" ry="16" fill="#fff"/><circle cx="77" cy="76" r="11" fill="${eyeCol}"/><circle cx="77" cy="77" r="6" fill="${eyeDeep}"/><circle cx="81" cy="71" r="4" fill="#fff"/>
     <path d="M114 80q10-13 20 0" stroke="${eyeDeep}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    `<ellipse cx="76" cy="74" rx="14" ry="18" fill="#fff"/><ellipse cx="124" cy="74" rx="14" ry="18" fill="#fff"/>
     <ellipse cx="77" cy="76" rx="11" ry="13" fill="${eyeCol}"/><ellipse cx="125" cy="76" rx="11" ry="13" fill="${eyeCol}"/>
     <circle cx="77" cy="78" r="6" fill="${eyeDeep}"/><circle cx="125" cy="78" r="6" fill="${eyeDeep}"/>
     <circle cx="80" cy="70" r="5" fill="#fff"/><circle cx="128" cy="70" r="5" fill="#fff"/>`
  ][eyeId]

  const brows = (eyeId === 0 || eyeId === 3)
    ? `<path d="M64 58q12-6 22 0" stroke="${hairDeep}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M114 58q12-6 22 0" stroke="${hairDeep}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : ''

  // Mouth.
  const mouth = [
    `<path d="M92 96q8 7 16 0" stroke="${skinShade}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    `<path d="M93 94q7 11 14 0Z" fill="#d16a7a"/><path d="M94 95q6 3 12 0" stroke="#fff" stroke-width="2" fill="none"/>`,
    `<path d="M92 95q4 4 8 0 4 4 8 0" stroke="${skinShade}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    `<ellipse cx="100" cy="97" rx="4" ry="5" fill="#d16a7a"/>`
  ][mouthId]

  // Accessory (headband / clip / cap / bow).
  const accessory = [
    '',
    `<path d="M52 52q48-32 96 0" stroke="${accent}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
    `<g transform="translate(60 50)"><path d="M0 -8 2.4 -2.4 8 -2.4 3.4 1.4 5 7 0 3.4 -5 7 -3.4 1.4 -8 -2.4 -2.4 -2.4Z" fill="${mixHex(accent, '#ffffff', 0.12)}" stroke="#fff" stroke-width="0.8"/></g>`,
    `<path d="M46 54c2-30 22-46 54-46s52 16 54 46c-30-12-78-12-108 0Z" fill="${jersey}"/><path d="M150 54c14-2 24 2 24 8 0 4-8 6-18 4Z" fill="${jerseyDeep}"/><path d="M46 54q54-16 108 0" stroke="${jerseyDeep}" stroke-width="2" opacity="0.5" fill="none"/>`,
    `<g transform="translate(66 30)"><path d="M0 0 -12 -7 -12 7Z" fill="${accent}"/><path d="M0 0 12 -7 12 7Z" fill="${accent}"/><circle r="4" fill="${mixHex(accent, '#ffffff', 0.2)}"/></g>`
  ][accId]

  const viewBox = compact ? '24 4 152 168' : '0 0 200 250'

  return `
    <svg class="avatar-art ${scaleClass}" viewBox="${viewBox}" role="img" aria-label="${ariaLabel}">
      <defs>
        <linearGradient id="${prefix}-kit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${jerseyLight}"/><stop offset="1" stop-color="${jersey}"/>
        </linearGradient>
        <radialGradient id="${prefix}-hair" cx="0.4" cy="0.25" r="0.95">
          <stop offset="0" stop-color="${hairLite}"/><stop offset="1" stop-color="${hair}"/>
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="240" rx="50" ry="8" fill="#e56fa6" opacity="0.2"/>
      <rect x="76" y="178" width="18" height="42" rx="9" fill="${jerseyDeep}"/>
      <rect x="106" y="178" width="18" height="42" rx="9" fill="${jerseyDeep}"/>
      <ellipse cx="82" cy="224" rx="15" ry="8" fill="${shoe}"/>
      <ellipse cx="118" cy="224" rx="15" ry="8" fill="${shoe}"/>
      <path d="M64 158c0-22 16-34 36-34s36 12 36 34l3 26c0 7-5 12-13 12H74c-8 0-13-5-13-12Z" fill="url(#${prefix}-kit)"/>
      <circle cx="100" cy="150" r="15" fill="#ffffff" opacity="0.85"/>
      <text x="100" y="188" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="800" font-size="26" fill="#ffffff">${jerseyNumber}</text>
      <rect x="48" y="152" width="17" height="38" rx="8.5" fill="url(#${prefix}-kit)"/>
      <rect x="135" y="152" width="17" height="38" rx="8.5" fill="url(#${prefix}-kit)"/>
      <circle cx="56" cy="192" r="10" fill="${skin}"/>
      <circle cx="144" cy="192" r="10" fill="${skin}"/>
      ${hairBack}
      <rect x="90" y="106" width="20" height="18" rx="8" fill="${skinShade}"/>
      <circle cx="100" cy="74" r="56" fill="${skin}"/>
      <circle cx="44" cy="80" r="9" fill="${skinShade}"/>
      <circle cx="156" cy="80" r="9" fill="${skinShade}"/>
      ${hairFront}
      ${shine}
      ${accessory}
      <ellipse cx="72" cy="86" rx="12" ry="8" fill="#ff9ec4" opacity="0.6"/>
      <ellipse cx="128" cy="86" rx="12" ry="8" fill="#ff9ec4" opacity="0.6"/>
      ${brows}
      ${eyes}
      ${mouth}
      <path d="M132 132l12 4v14l-12-3Z" fill="#ffffff" opacity="0.9"/>
      <text x="138" y="145" text-anchor="middle" font-size="11" font-family="Arial, sans-serif">${team.flag}</text>
    </svg>
  `
}

function showToast (message) {
  const toast = $('#toast')
  toast.textContent = message
  toast.classList.add('is-visible')
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2200)
}

function resetScrollPosition () {
  window.scrollTo(0, 0)
  requestAnimationFrame(() => window.scrollTo(0, 0))
  setTimeout(() => window.scrollTo(0, 0), 80)
  setTimeout(() => window.scrollTo(0, 0), 320)
  setTimeout(() => window.scrollTo(0, 0), 640)
}

function syncRuntimeScreenDiagnostics (view) {
  if (typeof document === 'undefined' || !document.documentElement) return
  const active = view || (document.querySelector('.screen.is-active') && document.querySelector('.screen.is-active').id) || ''
  if (active) document.documentElement.dataset.pearcupActiveScreen = active
  if (typeof window !== 'undefined' && window.__pearcupAppBooted) {
    document.documentElement.dataset.pearcupAppBooted = 'true'
  }
}

function setView (view) {
  state.view = view
  persist()
  renderView(view)
  $$('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === view))
  $$('.topnav button').forEach(button => {
    button.classList.toggle('is-active', button.dataset.view === view)
  })
  syncRuntimeScreenDiagnostics(view)
  if (view === 'bracket') scheduleBracketConnectors()
  if (view === 'games') renderGames()
  resetScrollPosition()
}

function renderView (view) {
  if (view === 'onboarding') {
    renderTeams()
    renderProfile()
    return
  }
  if (view === 'profile') {
    renderTeams()
    renderProfile()
    return
  }
  if (view === 'home') {
    renderHomeDashboard()
    renderPools()
    return
  }
  if (view === 'bracket') {
    renderBracket()
    return
  }
  if (view === 'watch') {
    renderWatch()
    return
  }
  if (view === 'games') {
    renderGames()
  }
}

// ==================== Shared Wallet ====================
// One wallet used everywhere: header chip (all pages), profile management,
// bracket entry debits, game escrow, payout credits. Demo balance now; real
// funding/withdrawal is the Tether WDK deposit/withdraw seam.
function fmtMoney (n) { return `${Number(n).toLocaleString('en-US')} ${state.wallet.currency}` }
function walletLog (label, amount, kind) {
  state.wallet.ledger = state.wallet.ledger || []
  state.wallet.ledger.unshift({ label, amount, kind })
  state.wallet.ledger = state.wallet.ledger.slice(0, 8)
}
function fundWallet (amount) {
  state.wallet.balance += amount
  walletLog('Funded wallet', amount, 'credit')
  persist(); refreshWallet(); showToast(`Added ${fmtMoney(amount)} to your wallet`)
}
function withdrawWallet () {
  const amount = state.wallet.balance
  if (amount <= 0) { showToast('Nothing to withdraw'); return }
  state.wallet.balance = 0
  walletLog('Withdraw to payout address', amount, 'debit')
  persist(); refreshWallet(); showToast(`Withdrawing ${fmtMoney(amount)} to your address`)
}
function collectPayouts () {
  const amount = state.wallet.pendingPayout || 0
  if (amount <= 0) { showToast('No payouts to collect yet'); return }
  state.wallet.balance += amount
  state.wallet.pendingPayout = 0
  walletLog('Collected pool payout', amount, 'credit')
  persist(); refreshWallet(); showToast(`Collected ${fmtMoney(amount)} in payouts 🎉`)
}
function debitWallet (amount, memo) {
  if (state.wallet.balance < amount) return false
  state.wallet.balance -= amount
  walletLog(memo || 'Entry', amount, 'debit')
  persist(); refreshWallet(); return true
}
function refreshWallet () {
  renderWalletChip()
  if ($('#walletManage')) renderWalletManage()
  if (state.view === 'bracket' && $('#bracketPoolSelect')) renderPoolSelect()
}

function renderWalletChip () {
  const chip = $('#walletChip')
  if (!chip) return
  chip.innerHTML = `<span class="wallet-ico">💰</span><span class="wallet-amt">${escapeHtml(fmtMoney(state.wallet.balance))}</span>`
}

function renderWalletManage () {
  const el = $('#walletManage')
  if (!el) return
  const w = state.wallet
  el.innerHTML = `
    <div class="wallet-card">
      <div class="wallet-top">
        <div>
          <p class="eyebrow">Wallet · Tether WDK</p>
          <p class="wallet-balance">${escapeHtml(fmtMoney(w.balance))}</p>
        </div>
        <span class="wallet-badge ${w.pendingPayout > 0 ? 'is-live' : ''}">${w.pendingPayout > 0 ? `${fmtMoney(w.pendingPayout)} to collect` : 'All collected'}</span>
      </div>
      <div class="wallet-actions">
        <button class="primary-button" type="button" data-fund="50">+ Fund 50</button>
        <button class="secondary-button" type="button" data-fund="100">+ 100</button>
        <button class="secondary-button" type="button" data-fund="250">+ 250</button>
        <button class="primary-button wallet-collect" type="button" id="collectPayoutBtn"${w.pendingPayout > 0 ? '' : ' disabled'}>Collect payouts</button>
        <button class="secondary-button" type="button" id="withdrawBtn">Withdraw</button>
      </div>
      <div class="wallet-ledger">
        ${(w.ledger || []).map(row => `
          <div class="wallet-row">
            <span>${escapeHtml(row.label)}</span>
            <strong class="${row.kind}">${row.kind === 'credit' ? '+' : '−'}${escapeHtml(fmtMoney(row.amount))}</strong>
          </div>`).join('')}
      </div>
      <p class="wallet-note">Demo balance. Real funding/withdrawal routes through the Tether WDK deposit &amp; payout rails. Shared across brackets, games, and payouts.</p>
    </div>`
  $$('#walletManage [data-fund]').forEach(b => b.addEventListener('click', () => fundWallet(Number(b.dataset.fund))))
  const collect = $('#collectPayoutBtn'); if (collect) collect.addEventListener('click', collectPayouts)
  const withdraw = $('#withdrawBtn'); if (withdraw) withdraw.addEventListener('click', withdrawWallet)
}

function showOperatorLiveDataSettings () {
  try {
    const params = new URLSearchParams(location.search)
    if (params.has('operator') || params.has('debug') || params.get('liveData') === '1') return true
    return window.localStorage && window.localStorage.getItem('pearcupOperatorMode') === 'true'
  } catch (e) {
    return false
  }
}

function renderLiveDataSettings () {
  const el = $('#liveDataSettings')
  if (!el) return
  if (!showOperatorLiveDataSettings()) {
    el.innerHTML = ''
    return
  }
  const c = state.liveConfig
  el.innerHTML = `
    <div class="wallet-card livedata-card">
      <div class="wallet-top">
        <div>
          <p class="eyebrow">Live match data</p>
          <p class="livedata-status ${c.enabled ? 'is-on' : ''}">${c.enabled ? '● Live API feed' : 'Simulated feed'}</p>
        </div>
        <label class="livedata-switch"><input type="checkbox" id="liveEnabled" ${c.enabled ? 'checked' : ''}><span></span></label>
      </div>
      <div class="livedata-fields">
        <label>Provider
          <select id="liveProvider">
            <option value="football-data" ${c.provider === 'football-data' ? 'selected' : ''}>Football-Data.org</option>
            <option value="api-football" ${c.provider === 'api-football' ? 'selected' : ''}>API-Football</option>
          </select>
        </label>
        <label>API key
          <input type="password" id="liveKey" value="${escapeHtml(c.apiKey)}" placeholder="paste your key" autocomplete="off" spellcheck="false">
        </label>
        <label>Match / fixture ID <em>(blank = auto-pick a live match)</em>
          <input type="text" id="liveMatch" value="${escapeHtml(c.matchId)}" placeholder="e.g. 497501" spellcheck="false">
        </label>
        <label>CORS proxy <em>(browser testing only)</em>
          <input type="text" id="liveProxy" value="${escapeHtml(c.proxy)}" placeholder="https://your-proxy/?url=" spellcheck="false">
        </label>
      </div>
      <div class="wallet-actions">
        <button class="primary-button" id="liveSaveBtn" type="button">Save &amp; apply</button>
        <button class="secondary-button" id="liveTestBtn" type="button">Test connection</button>
      </div>
      <p class="livedata-result" id="liveTestResult"></p>
      <p class="wallet-note">Browsers can't call these APIs directly (CORS). In the Pear runtime a worker fetches (no CORS) and relays over the room topic; for browser testing add a CORS proxy. Free keys: football-data.org or dashboard.api-football.com. World Cup 2026 is live now.</p>
    </div>`
  $('#liveSaveBtn').addEventListener('click', () => {
    state.liveConfig = {
      enabled: $('#liveEnabled').checked,
      provider: $('#liveProvider').value,
      apiKey: $('#liveKey').value.trim(),
      matchId: $('#liveMatch').value.trim(),
      proxy: $('#liveProxy').value.trim(),
      pollSec: 30
    }
    persist()
    startLiveFeed()
    renderLiveDataSettings()
    showToast(state.liveConfig.enabled && state.liveConfig.apiKey ? 'Live data feed enabled' : 'Using the simulated feed')
  })
  $('#liveTestBtn').addEventListener('click', async () => {
    const res = $('#liveTestResult')
    res.textContent = 'Testing connection…'
    res.className = 'livedata-result'
    const cfg = {
      provider: $('#liveProvider').value,
      apiKey: $('#liveKey').value.trim(),
      matchId: $('#liveMatch').value.trim(),
      proxy: $('#liveProxy').value.trim()
    }
    if (!cfg.apiKey) { res.textContent = 'Add your API key first.'; res.className = 'livedata-result is-err'; return }
    try {
      const data = await apiRequest(cfg)
      const st = { home: {}, away: {}, minute: 0 }
      mapFeed(st, cfg.provider, data)
      res.textContent = `✓ Connected · ${st.home.name} ${st.home.goals}–${st.away.goals} ${st.away.name} (${st.minute}')`
      res.className = 'livedata-result is-ok'
    } catch (err) {
      res.textContent = `✕ ${err.message} — usually CORS in a browser. Use a proxy, or fetch from the Pear worker.`
      res.className = 'livedata-result is-err'
    }
  })
}

// ==================== Themes (shared avatars, swappable GUI) ====================
const THEMES = [
  { id: 'kawaii', name: 'Kawaii Cup', tag: 'Soft & cute', swatch: ['#ff8fc0', '#6fe0c8', '#ffd76b'] },
  { id: 'shonen', name: 'Shonen Blitz', tag: 'Bold & electric', swatch: ['#ff2e63', '#ffd23f', '#12e6d0'] },
  { id: 'neo', name: 'Neo-Tokyo', tag: 'Dark & neon', swatch: ['#28f0ff', '#ff2fb0', '#b6ff3c'] }
]

function applyTheme (id) {
  document.documentElement.dataset.theme = THEMES.some(t => t.id === id) ? id : 'kawaii'
}

function setTheme (id) {
  state.theme = id
  state.themeChosen = true
  persist()
  applyTheme(id)
  renderThemeSwitcher()
  const t = THEMES.find(x => x.id === id)
  if (t) showToast(`${t.name} theme applied`)
}

function themePreview (t) {
  return `<span class="theme-preview theme-preview-${t.id}">${t.swatch.map(c => `<i style="background:${c}"></i>`).join('')}</span>`
}

function showThemePicker (firstRun) {
  if ($('#themePicker')) return
  const ov = document.createElement('div')
  ov.id = 'themePicker'
  ov.className = 'theme-picker'
  ov.innerHTML = `
    <div class="theme-picker-card">
      ${firstRun === false ? '<button class="theme-close" type="button" aria-label="Close">✕</button>' : ''}
      <p class="eyebrow">${firstRun === false ? 'Appearance' : 'Welcome to PearCup'}</p>
      <h2 class="theme-picker-title">Pick your look</h2>
      <p class="theme-picker-sub">${firstRun === false ? 'Switch your style — everything else stays the same.' : 'Choose a style to start — you can switch it anytime.'}</p>
      <div class="theme-options">
        ${THEMES.map(t => `
          <button class="theme-opt" data-theme-pick="${t.id}" type="button">
            ${themePreview(t)}
            <strong>${t.name}</strong>
            <span class="theme-tag">${t.tag}</span>
          </button>`).join('')}
      </div>
    </div>`
  ov.setAttribute('role', 'dialog')
  ov.setAttribute('aria-modal', 'true')
  ov.setAttribute('aria-label', 'Choose a theme')
  document.body.appendChild(ov)
  setTimeout(() => ov.classList.add('is-open'), 30)
  const close = () => {
    document.removeEventListener('keydown', onKey)
    ov.classList.remove('is-open')
    setTimeout(() => ov.remove(), 300)
  }
  // Escape closes (re-open picker only: first-run must pick a theme to continue)
  const onKey = e => { if (e.key === 'Escape' && firstRun === false) close() }
  document.addEventListener('keydown', onKey)
  ov.addEventListener('click', event => {
    if (event.target.closest('.theme-close') || event.target === ov) { close(); return }
    const btn = event.target.closest('[data-theme-pick]')
    if (!btn) return
    setTheme(btn.dataset.themePick)
    close()
  })
}

function renderThemeSwitcher () {
  const el = $('#themeSwitcher')
  if (!el) return
  el.innerHTML = `
    <div class="wallet-card">
      <p class="eyebrow">Appearance · Theme</p>
      <div class="theme-switch">
        ${THEMES.map(t => `
          <button class="theme-chip ${state.theme === t.id ? 'is-active' : ''}" data-theme-pick="${t.id}" type="button">
            ${themePreview(t)}
            <strong>${t.name}</strong>
            <span class="theme-tag">${t.tag}</span>
          </button>`).join('')}
      </div>
      <p class="wallet-note">Your avatars, wallet, and progress stay the same across every theme.</p>
    </div>`
  $$('#themeSwitcher [data-theme-pick]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themePick)))
}

function renderProfile () {
  const team = teamById(state.team)
  const name = state.username || 'captain'
  renderWalletChip()
  renderWalletManage()
  renderLiveDataSettings()
  renderThemeSwitcher()

  $('#profileChip').innerHTML = `
    ${avatarSvg(name, team, true)}
    <div>
      <span class="chip-name">${escapeHtml(name)}</span>
      <span class="chip-team">${team.flag} ${escapeHtml(team.name)}</span>
    </div>
  `

  $('#avatarPreview').innerHTML = avatarSvg(name, team)
  $('#kitCountry').textContent = `${team.flag} ${team.name}`
  $('#kitSubtitle').textContent = `${name}'s jersey is ready`
  $('#primarySwatch').style.background = team.colors[0]
  $('#secondarySwatch').style.background = team.colors[1]
  $('#accentSwatch').style.background = team.colors[2]
}

// The big hero scoreline mirrors whatever the Watch feed is showing (live relay or sim).
function renderHomeHero () {
  const snap = livePanelSnapshot()
  const st = snap.st
  const flag = t => t && t.flag && t.flag !== '⚽'
    ? t.flag
    : (t && t.crest ? `<img class="score-crest" src="${escapeHtml(t.crest)}" alt="" onerror="this.replaceWith(document.createTextNode('⚽'))">` : '⚽')
  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html }
  set('#heroHomeFlag', flag(snap.home)); set('#heroAwayFlag', flag(snap.away))
  set('#heroHomeName', escapeHtml(snap.home.name)); set('#heroAwayName', escapeHtml(snap.away.name))
  set('#heroScore', snap.st && snap.st.hasScore === false ? 'vs' : `${snap.home.goals} - ${snap.away.goals}`)
  const poss = (st && st.possession && st.possession !== 50) ? `${st.possession}% possession` : (snap.live ? 'World Cup' : 'Pre-match room')
  set('#heroHomeSub', escapeHtml(poss))
  set('#heroAwaySub', escapeHtml(st ? stageLabel(st) || 'World Cup' : 'Round of 32'))
  const clockEl = $('#heroClock')
  if (clockEl) clockEl.textContent = st ? (st.matchStatus === 'FINISHED' ? 'FT' : st.minute ? `${st.minute}'` : snap.status) : '15:00 ET'
  const stateEl = $('#heroState')
  if (stateEl) { stateEl.textContent = snap.status; stateEl.className = snap.live && st && /IN_PLAY|LIVE|PAUSED/.test(st.matchStatus) ? 'is-live' : '' }
}

function renderHomeDashboard () {
  const activeTab = liveTabs.some(tab => tab.id === state.liveTab) ? state.liveTab : 'overview'
  state.liveTab = activeTab
  renderHomeHero()

  $('#liveMenu').innerHTML = liveTabs.map(tab => `
    <button type="button" class="${tab.id === activeTab ? 'is-active' : ''}" data-live-tab="${tab.id}">
      ${tab.label}
    </button>
  `).join('')

  $('#liveDetail').innerHTML = renderLivePanel(activeTab)

  // First fixture card mirrors the live feed; the rest are the upcoming schedule.
  const snap = livePanelSnapshot()
  const liveFixture = {
    status: snap.status,
    title: snap.st && snap.st.hasScore === false
      ? `${snap.home.name} vs ${snap.away.name}`
      : `${snap.home.name} ${snap.home.goals} - ${snap.away.goals} ${snap.away.name}`,
    detail: `${state.spectators || 38} peers watching`,
    live: true
  }
  const fixtureList = [liveFixture, ...homeFixtures.filter(f => !f.live)]
  $('#homeFixtures').innerHTML = fixtureList.map(fixture => `
    <div class="mini-fixture ${fixture.live ? 'is-current' : ''}">
      <div>
        <span class="fixture-time">${fixture.status}</span>
        <strong>${fixture.title}</strong>
        <small>${fixture.detail}</small>
      </div>
      <button class="icon-button ${fixture.live ? 'is-live' : ''}" type="button" data-view="watch" aria-label="Open watch room">
        <svg viewBox="0 0 24 24"><path d="${fixture.live ? 'M8 5v14l11-7Z' : 'M4 12h16M12 4v16'}"/></svg>
      </button>
    </div>
  `).join('')

  $('#leaderPanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Bracket</p>
      <strong>Leaders</strong>
    </div>
    <div class="leader-list">
      ${leaders.map((leader, index) => `
        <div class="leader-row">
          <span class="leader-rank">${index + 1}</span>
          ${avatarSvg(leader.user, teamById(leader.team), true)}
          <div>
            <strong>${escapeHtml(leader.user)}</strong>
            <span>${leader.score} correct</span>
          </div>
          <em>${leader.prize}</em>
        </div>
      `).join('')}
    </div>
  `
  $('#signalPanel').innerHTML = renderSignalPanel()

  $$('#liveMenu [data-live-tab]').forEach(button => {
    button.addEventListener('click', () => {
      state.liveTab = button.dataset.liveTab
      persist()
      renderHomeDashboard()
    })
  })
  bindViewButtons($('#home'))
}

// Snapshot of whatever the live/sim feed currently holds, for the Home dashboard.
function livePanelSnapshot () {
  let st = null
  try { st = feedState() } catch { st = null }
  const live = isLiveApi()
  const home = st ? st.home : { name: 'Spain', flag: '🇪🇸', goals: 0, teamId: 'es' }
  const away = st ? st.away : { name: 'Austria', flag: '🇦🇹', goals: 0, teamId: 'at' }
  const status = st ? matchStateLabel(st).txt : 'Kicks off 15:00 ET'
  const events = (state.feedEvents || [])
  return { st, live, home, away, status, events }
}

function renderMomentumChart (snap, lead, momentum) {
  const clamp = value => Math.max(10, Math.min(96, value))
  const diff = Math.abs(snap.home.goals - snap.away.goals)
  const possession = snap.st && Number.isFinite(Number(snap.st.possession)) ? Number(snap.st.possession) : 55 + diff * 4
  const leadBias = lead === snap.home ? possession - 50 : 50 - possession
  const eventBoost = snap.events.slice(0, 6).reduce((boost, ev) => {
    const weight = ev.type === 'goal' ? 12 : ev.type === 'shot' ? 7 : ev.type === 'corner' ? 5 : 3
    return boost + (ev.team === lead.name ? weight : -weight / 2)
  }, 0)
  const base = [32, 38, 46, 43, 54, 61, 58, 69, 74, 71, 82, 78, 88, 92]
  const values = base.map((value, index) => {
    const progress = index / Math.max(1, base.length - 1)
    return clamp(value + leadBias * 0.45 + eventBoost * 0.16 + momentum * 0.24 * progress)
  })
  const width = 360
  const top = 22
  const bottom = 126
  const chartHeight = bottom - top
  const left = 18
  const step = (width - left * 2) / Math.max(1, values.length - 1)
  const points = values.map((value, index) => {
    const x = left + step * index
    const y = bottom - (value / 100) * chartHeight
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) }
  })
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const area = `${line} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`
  const grid = [25, 50, 75].map(tick => {
    const y = Number((bottom - (tick / 100) * chartHeight).toFixed(1))
    return `<line x1="${left}" y1="${y}" x2="${width - left}" y2="${y}"></line>`
  }).join('')
  const bars = points.map((point, index) => index % 2 === 0
    ? `<rect class="momentum-band" x="${Number((point.x - 4).toFixed(1))}" y="${point.y}" width="8" height="${Number((bottom - point.y).toFixed(1))}" rx="4"></rect>`
    : '').join('')
  const aria = `${lead.name} momentum plus ${momentum}, ${snap.home.name} ${snap.home.goals} to ${snap.away.goals} ${snap.away.name}`

  return `
    <div class="momentum-chart" role="img" aria-label="${escapeHtml(aria)}">
      <svg viewBox="0 0 ${width} 150" aria-hidden="true" focusable="false">
        <g class="momentum-grid">${grid}</g>
        <path class="momentum-area" d="${area}"></path>
        <g>${bars}</g>
        <path class="momentum-line" d="${line}"></path>
        <g class="momentum-points">
          ${points.filter((_, index) => index % 3 === 1 || index === points.length - 1).map(point => `<circle cx="${point.x}" cy="${point.y}" r="4"></circle>`).join('')}
        </g>
        <text class="momentum-axis" x="${left}" y="16">Pressure</text>
        <text class="momentum-axis is-right" x="${width - left}" y="16">${escapeHtml(lead.name)}</text>
      </svg>
    </div>
    <div class="momentum-meta">
      <span>${escapeHtml(snap.home.name)}</span>
      <strong>+${momentum}</strong>
      <span>${escapeHtml(snap.away.name)}</span>
    </div>
  `
}

function renderLivePanel (tab) {
  const snap = livePanelSnapshot()

  if (tab === 'stats') {
    const st = snap.st
    // Live football-data feed carries score but not possession/shots — fall back to a projection so the card isn't empty.
    const poss = (st && st.possession && st.possession !== 50) ? st.possession : 54
    const shots = (st && st.shots && (st.shots[0] || st.shots[1])) ? st.shots : [7, 4]
    const shotShare = Math.round((shots[0] / Math.max(1, shots[0] + shots[1])) * 100)
    const threat = (st && st.threat && st.threat !== 50) ? st.threat : 61
    const rows = [
      ['Score', String(snap.home.goals), String(snap.away.goals), snap.home.goals + snap.away.goals ? Math.round((snap.home.goals / Math.max(1, snap.home.goals + snap.away.goals)) * 100) : 50],
      ['Possession', `${poss}%`, `${100 - poss}%`, poss],
      ['Shots', String(shots[0]), String(shots[1]), shotShare],
      ['Attacking threat', threat > 66 ? 'High' : threat > 45 ? 'Medium' : 'Low', '', threat]
    ]
    return `
      <div class="live-stat-head">
        <strong>${escapeHtml(snap.home.name)} vs ${escapeHtml(snap.away.name)}</strong>
        <span class="live-pill ${snap.live ? 'is-live' : ''}">${snap.live ? '<i></i>' : ''}${escapeHtml(snap.status)}</span>
      </div>
      <div class="live-stat-grid">
        ${rows.map(([label, home, away, share]) => `
          <article class="live-stat-card">
            <span>${label}</span>
            <div class="split-stat">
              <strong>${escapeHtml(home)}</strong>
              ${away ? `<em>${escapeHtml(away)}</em>` : ''}
            </div>
            <div class="meter"><i style="width:${share}%"></i></div>
          </article>
        `).join('')}
      </div>
    `
  }

  if (tab === 'rooms') {
    const peers = state.spectators || 38
    const roster = ['captain', 'amara', 'diego', 'kenji']
    const rteams = ['br', 'ci', 'ar', 'jp']
    return `
      <div class="room-dashboard">
        <article class="live-card room-card">
          <div class="rail-header">
            <p class="eyebrow">Watch room</p>
            <strong>${peers} peers</strong>
          </div>
          <p class="live-copy">${escapeHtml(snap.home.name)} vs ${escapeHtml(snap.away.name)} · ${escapeHtml(snap.status)}</p>
          <div class="room-preview-avatars">
            ${roster.map((name, index) => avatarSvg(name === 'captain' ? (state.username || 'captain') : name, teamById(rteams[index]), true)).join('')}
          </div>
          <button class="primary-button" type="button" data-view="watch">
            <span class="button-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7Z"/></svg>
            </span>
            Join the couch
          </button>
        </article>
        <article class="live-card">
          <div class="metric-list">
            <div><span>On the couch</span><strong>5 seated</strong></div>
            <div><span>Peers watching</span><strong>${peers}</strong></div>
            <div><span>Chat lines</span><strong>${(state.chat || []).length}</strong></div>
          </div>
        </article>
      </div>
    `
  }

  if (tab === 'qvac') {
    const parsed = snap.events.length
    return `
      <div class="qvac-dashboard">
        <article class="live-card">
          <div class="rail-header">
            <p class="eyebrow">QVAC</p>
            <strong>Multilingual</strong>
          </div>
          <div class="language-pills">
            <span>EN</span><span>PT</span><span>ES</span><span>FR</span><span>AR</span><span>JA</span>
          </div>
          <p class="live-copy">Following ${escapeHtml(snap.home.name)} vs ${escapeHtml(snap.away.name)} — the ${snap.live ? 'live' : 'match'} event stream is summarized into commentary and pool impact on device.</p>
        </article>
        <article class="live-card">
          <div class="metric-list">
            <div><span>Feed</span><strong>${snap.live ? 'Live data' : 'Simulated'}</strong></div>
            <div><span>Events parsed</span><strong>${parsed}</strong></div>
            <div><span>Languages</span><strong>6</strong></div>
          </div>
        </article>
      </div>
    `
  }

  if (tab === 'games') {
    const round = currentGameRound()
    const previewHash = PearCupCore.deterministicHash({ preview: 'PenaltyClash', roundIndex: state.gameRound, round })
    const settlement = integrationRuntime.readiness.settlement
    return `
      <div class="game-live-preview">
        <article class="live-card">
          <div class="rail-header">
            <p class="eyebrow">Penalty Clash</p>
            <strong>${round.aim === round.dive ? 'Save' : 'Goal'}</strong>
          </div>
          <p class="live-copy">QVAC referee verified both reveals and matched the deterministic state hash for round ${state.gameRound + 1}.</p>
          <button class="primary-button inline-action" type="button" data-view="games">
            <span class="button-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
            Open games
          </button>
        </article>
        <article class="live-card">
          <div class="metric-list">
            <div><span>Sync</span><strong>${previewHash.slice(0, 12)}</strong></div>
            <div><span>Escrow</span><strong>${serviceModeLabel(integrationRuntime.readiness.tetherWdk)} WDK</strong></div>
            <div><span>Prize gate</span><strong>${settlement.realMoneyEnabled ? 'Live' : 'Locked'}</strong></div>
          </div>
        </article>
      </div>
    `
  }

  // Overview
  const lead = snap.home.goals >= snap.away.goals ? snap.home : snap.away
  const diff = Math.abs(snap.home.goals - snap.away.goals)
  const momentum = 6 + diff * 8
  const evText = ev => {
    const t = ev.type
    const verb = t === 'goal' ? 'find the net' : t === 'save' ? 'are denied by a save' : t === 'shot' ? 'threaten with a shot' : t === 'corner' ? 'win a corner' : `see a ${t}`
    return `${ev.team} ${verb}.`
  }
  const timeline = snap.events.length
    ? snap.events.slice(0, 4).map(ev => `<div><time>${escapeHtml(ev.clock || '·')}</time><span>${escapeHtml(evText(ev))}</span></div>`).join('')
    : `<div><time>—</time><span>Waiting for the next event…</span></div>`
  const pools = Object.keys(state.enteredPools || {}).length
  return `
    <div class="overview-dashboard">
      <article class="live-card momentum-card">
        <div class="rail-header">
          <p class="eyebrow">Momentum</p>
          <strong>${escapeHtml(lead.name)} +${momentum}</strong>
        </div>
        ${renderMomentumChart(snap, lead, momentum)}
      </article>
      <article class="live-card timeline-card">
        <div class="rail-header">
          <p class="eyebrow">Timeline</p>
          <strong>${snap.live ? 'Live' : 'Latest'}</strong>
        </div>
        <div class="timeline-list">${timeline}</div>
      </article>
      <article class="live-card impact-card">
        <div class="rail-header">
          <p class="eyebrow">Pool impact</p>
          <strong>${pools ? `${pools} entered` : `${snap.home.goals}–${snap.away.goals}`}</strong>
        </div>
        <p class="live-copy">${pools
          ? `Your bracket outcome swings on ${escapeHtml(lead.name)} holding ${escapeHtml(snap.home.name)} ${snap.home.goals}–${snap.away.goals} ${escapeHtml(snap.away.name)}.`
          : `Enter a bracket pool to track how ${escapeHtml(snap.home.name)} vs ${escapeHtml(snap.away.name)} moves your payout.`}</p>
      </article>
    </div>
  `
}

function renderTeams () {
  $('#usernameInput').value = state.username
  $('#teamGrid').innerHTML = teams.map(team => `
    <button class="team-card ${team.id === state.team ? 'is-selected' : ''}" type="button" data-team="${team.id}" aria-pressed="${team.id === state.team}">
      <span class="flag-tile">${team.flag}</span>
      <span>
        <span class="team-name">${escapeHtml(team.name)}</span>
        <span class="team-colors" aria-hidden="true">
          <i style="background:${team.colors[0]}"></i>
          <i style="background:${team.colors[1]}"></i>
          <i style="background:${team.colors[2]}"></i>
        </span>
      </span>
      <span class="check-dot" aria-hidden="true"></span>
    </button>
  `).join('')

  $$('#teamGrid .team-card').forEach(button => {
    button.addEventListener('click', () => {
      state.team = button.dataset.team
      persist()
      renderTeams()
      renderProfile()
    })
  })
}

function renderPools () {
  const sampleTeams = ['es', 'at', 'pt']
  const railMode = serviceModeLabel(integrationRuntime.readiness.tetherWdk)
  const railState = integrationRuntime.canUseRealMoney ? 'Live USDT' : `${railMode} locked`
  $('#poolGrid').innerHTML = pools.map(pool => `
    <article class="pool-card">
      <div class="pool-top">
        <div>
          <p class="stake">$${pool.tier} <span>entry</span></p>
          <span class="rail-chip ${integrationRuntime.canUseRealMoney ? 'is-live' : 'is-locked'}">Tether WDK ${railState}</span>
        </div>
        <span class="pool-badge">${pool.heat}</span>
      </div>
      <div class="pool-meta">
        <div><span>Prize pool</span><strong>${pool.prize}</strong></div>
        <div><span>Entrants</span><strong>${pool.entrants}/${pool.max}</strong></div>
        <div><span>Closes</span><strong>${pool.closes}</strong></div>
      </div>
      <div class="pool-footer">
        <div class="avatar-stack" aria-hidden="true">
          ${sampleTeams.map((id, index) => avatarSvg(['lina', 'vera', 'milo'][index], teamById(id), true)).join('')}
        </div>
        <button class="primary-button" type="button" data-pool="${pool.tier}">
          <span class="button-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
          Enter
        </button>
      </div>
    </article>
  `).join('')

  $$('#poolGrid [data-pool]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedTier = Number(button.dataset.pool)
      persist()
      renderBracket()
      setView('bracket')
    })
  })
}

function poolNamespace (poolId) {
  return `pools/${poolId}/wdk-events`
}

function currentUserId () {
  return gameUserId(state.username || 'captain')
}

function normalizePayoutAddress (value) {
  return String(value || '').trim()
}

function demoPayoutAddress (userId) {
  const seed = PearCupCore.deterministicHash({ scope: 'demo-payout-address', userId }).replace(/^0x/, '')
  return `0x${seed.repeat(3).slice(0, 40)}`
}

function savedPayoutAddressFor (userId) {
  return normalizePayoutAddress(state.payoutAddresses && state.payoutAddresses[userId])
}

function payoutAddressForEntrant (entrant) {
  const savedAddress = savedPayoutAddressFor(entrant.userId)
  if (savedAddress) return savedAddress
  if (!integrationRuntime.canUseRealMoney && entrant.userId !== currentUserId()) return demoPayoutAddress(entrant.userId)
  return ''
}

function payoutRecipientsForEntrants (entrants, winnerUserIds) {
  const winners = new Set(winnerUserIds || [])
  return entrants.reduce((recipients, entrant) => {
    if (!winners.has(entrant.userId)) return recipients
    const address = payoutAddressForEntrant(entrant)
    if (address) recipients[entrant.userId] = address
    return recipients
  }, {})
}

function createDemoProcessorPayout ({ input = {}, payout = {} }) {
  const winnerUserIds = Array.isArray(input.winnerUserIds) ? input.winnerUserIds : []
  const payoutRecipients = input.payoutRecipients || {}
  const recipientFor = userId => normalizePayoutAddress(input.payoutAddress || payoutRecipients[userId])
  const missingRecipientUserIds = winnerUserIds.filter(userId => !recipientFor(userId))
  if (missingRecipientUserIds.length > 0) {
    return {
      id: PearCupCore.deterministicHash({
        type: 'DemoWdkPoolPayoutRecipientRequired',
        poolId: input.poolId,
        winnerUserIds,
        missingRecipientUserIds
      }),
      status: 'recipient-required',
      poolId: input.poolId,
      missingRecipientUserIds,
      broadcast: false,
      transfers: []
    }
  }
  const amountEach = Number(payout.amountEach || 0)
  const baseAmount = String(Math.round(amountEach * 1000000))
  return {
    id: PearCupCore.deterministicHash({
      type: 'DemoWdkPoolPayoutQuote',
      poolId: input.poolId,
      winnerUserIds,
      amountEach,
      payoutRecipients
    }),
    status: 'quoted',
    poolId: input.poolId,
    broadcast: false,
    transfers: winnerUserIds.map(userId => ({
      userId,
      reference: `${input.poolId || 'pool'}:${userId}`,
      asset: 'usdt-evm',
      chain: 'ethereum',
      sourceAccountIndex: 0,
      recipient: recipientFor(userId),
      amount: amountEach,
      baseAmount,
      token: null,
      broadcast: false,
      status: 'quoted',
      hash: null,
      fee: 'demo'
    }))
  }
}

function createBracketUiTetherWdkAdapter () {
  const base = integrationRuntime.adapters.tetherWdk
  if (!base || typeof base.reconcileEntryIntent === 'function' || integrationRuntime.canUseRealMoney) return base
  const pendingIntentIds = new Set()

  return {
    ...base,
    reconcileEntryIntent ({ intent, confirmationId }) {
      if (!intent || !intent.intentId) {
        return {
          checkId: PearCupCore.deterministicHash({ intentId: null, confirmationId, reason: 'Entry intent missing' }),
          intentId: null,
          status: 'pending',
          processorStatus: 'missing_intent',
          reason: 'Entry intent is required before payment reconciliation',
          checkedAt: '2026-07-01T00:00:00.000Z'
        }
      }
      if (!pendingIntentIds.has(intent.intentId)) {
        pendingIntentIds.add(intent.intentId)
        return PearCupCore.createTetherWdkEntryPaymentPending({
          intent,
          confirmationId,
          processorStatus: 'demo-awaiting-payment',
          reason: 'Demo WDK rail records a pending check before confirmation.'
        })
      }
      return base.confirmEntryIntent({ intent, confirmationId })
    },

    createPoolPayout (input) {
      const payout = base.createPoolPayout(input)
      return {
        ...payout,
        processorPayout: createDemoProcessorPayout({ input, payout })
      }
    }
  }
}

function createBracketSettlementWorker (eventStore) {
  const rootObject = typeof window !== 'undefined' ? window : globalThis
  return PearCupWorkerClient.createAutoWorkerClient({
    rootObject,
    preferLocal: !integrationRuntime.canUseRealMoney,
    local: () => {
      const tetherWdk = createBracketUiTetherWdkAdapter()
      const worker = PearCupWorkerSim.createWorkerSim({
        storage: eventStore,
        adapters: {
          qvac: integrationRuntime.adapters.qvac,
          tetherWdk,
          mode: {
            qvac: integrationRuntime.adapters.qvac.mode,
            tetherWdk: tetherWdk.mode
          }
        }
      })
      return PearCupWorkerClient.createLocalWorkerClient({ worker })
    }
  })
}

function createPenaltySettlementWorker (eventStore) {
  const rootObject = typeof window !== 'undefined' ? window : globalThis
  return PearCupWorkerClient.createAutoWorkerClient({
    rootObject,
    preferLocal: !integrationRuntime.canUseRealMoney,
    local: () => PearCupWorkerClient.createLocalWorkerClient({
      runtime: integrationRuntime,
      workerFactory: PearCupWorkerSim,
      storage: eventStore
    })
  })
}

function entryRailState (entry) {
  if (entry.payment) return { label: 'Confirmed', className: 'is-confirmed' }
  if (entry.pendingChecks.length > 0) return { label: 'Pending', className: 'is-pending' }
  return { label: 'Intent', className: 'is-intent' }
}

function renderEntryLedger (settlement) {
  return `
    <div class="entry-ledger">
      ${settlement.entryLedger.map(entry => {
        const team = teamById(entry.entrant.teamId)
        const status = entryRailState(entry)
        const latestPending = entry.pendingChecks[entry.pendingChecks.length - 1]
        const proofId = entry.payment
          ? entry.payment.paymentId
          : latestPending
          ? latestPending.checkId
          : entry.intent.intentId
        return `
          <div class="entry-ledger-row ${status.className}">
            <div class="entry-person">
              ${avatarSvg(entry.entrant.username, team, true)}
              <div>
                <strong>${escapeHtml(entry.entrant.username)}</strong>
                <span>${team.flag} ${escapeHtml(team.name)} · ${entry.intent.amount} ${entry.intent.asset}</span>
              </div>
            </div>
            <div class="entry-status-stack">
              <span class="entry-status ${status.className}">${status.label}</span>
              <code>${escapeHtml(proofId)}</code>
            </div>
          </div>
        `
      }).join('')}
    </div>
  `
}

function payoutStatusMeta (status) {
  if (status === 'quoted') return { label: 'Quoted', className: 'is-confirmed' }
  if (status === 'broadcast') return { label: 'Broadcast', className: 'is-confirmed' }
  if (status === 'planned') return { label: 'Planned', className: 'is-pending' }
  if (status === 'recipient-ready') return { label: 'Ready', className: 'is-confirmed' }
  if (status === 'recipient-required') return { label: 'Needs address', className: 'is-pending' }
  if (status === 'prepared') return { label: 'Prepared', className: 'is-confirmed' }
  return { label: 'Held', className: 'is-pending' }
}

function transferForUser (processorPayout, userId) {
  const transfers = processorPayout && Array.isArray(processorPayout.transfers)
    ? processorPayout.transfers
    : []
  return transfers.find(transfer => transfer.userId === userId) || null
}

function renderPayoutRecipients (settlement) {
  const processorPayout = settlement.payout && settlement.payout.processorPayout
  const missing = new Set(processorPayout && processorPayout.missingRecipientUserIds || [])
  const winners = new Set(settlement.winnerUserIds || [])
  const rows = settlement.entrants
    .filter(entrant => winners.has(entrant.userId))
    .map(entrant => {
      const team = teamById(entrant.teamId)
      const transfer = transferForUser(processorPayout, entrant.userId)
      const address = transfer && transfer.recipient
        ? transfer.recipient
        : (settlement.payoutRecipients || {})[entrant.userId] || savedPayoutAddressFor(entrant.userId)
      const status = payoutStatusMeta(transfer
        ? transfer.status
        : missing.has(entrant.userId)
          ? 'recipient-required'
          : address
            ? 'recipient-ready'
            : processorPayout && processorPayout.status)
      const proof = transfer && (transfer.hash || transfer.baseAmount || transfer.reference) || processorPayout && processorPayout.id || 'recipient-pending'
      const canUseDemoFill = !integrationRuntime.canUseRealMoney && !address

      return `
        <div class="payout-recipient-row ${status.className}">
          <div class="entry-person">
            ${avatarSvg(entrant.username, team, true)}
            <div>
              <strong>${escapeHtml(entrant.username)}</strong>
              <span>${team.flag} ${escapeHtml(team.name)} · ${settlement.payout.amountEach || 0} ${settlement.payout.asset || 'USDT'}</span>
            </div>
          </div>
          <label class="payout-address-field">
            <span>Recipient</span>
            <input type="text" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeHtml(address)}" placeholder="0x..." data-payout-user="${escapeHtml(entrant.userId)}">
          </label>
          <div class="entry-status-stack">
            <span class="entry-status ${status.className}">${status.label}</span>
            <code>${escapeHtml(proof)}</code>
          </div>
          ${canUseDemoFill ? `
            <button class="icon-button payout-demo-button" type="button" title="Use demo recipient" aria-label="Use demo recipient for ${escapeHtml(entrant.username)}" data-demo-payout-user="${escapeHtml(entrant.userId)}">
              <svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M3 12h4M17 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            </button>
          ` : ''}
        </div>
      `
    })

  return `<div class="payout-recipient-list">${rows.join('')}</div>`
}

function bindPayoutControls () {
  $$('#bracketEntriesPanel [data-payout-user]').forEach(input => {
    input.addEventListener('change', () => {
      const userId = input.dataset.payoutUser
      const address = normalizePayoutAddress(input.value)
      state.payoutAddresses = state.payoutAddresses || {}
      if (address) state.payoutAddresses[userId] = address
      else delete state.payoutAddresses[userId]
      persist()
      renderBracket()
    })
  })
  $$('#bracketEntriesPanel [data-demo-payout-user]').forEach(button => {
    button.addEventListener('click', () => {
      const userId = button.dataset.demoPayoutUser
      state.payoutAddresses = state.payoutAddresses || {}
      state.payoutAddresses[userId] = demoPayoutAddress(userId)
      persist()
      renderBracket()
    })
  })
}

async function resolveBracketSettlement (selectedPool) {
  const poolId = `world-cup-${selectedPool.tier}`
  const amount = selectedPool.tier
  const entrants = [
    { username: state.username || 'captain', userId: gameUserId(state.username || 'captain'), teamId: state.team },
    { username: 'lina', userId: 'user-lina', teamId: 'br' },
    { username: 'amara', userId: 'user-amara', teamId: 'ci' },
    { username: 'diego', userId: 'user-diego', teamId: 'ar' },
    { username: 'vera', userId: 'user-vera', teamId: 'no' },
    { username: 'kenji', userId: 'user-kenji', teamId: 'jp' }
  ]
  const eventStore = PearCupStorageSim.createEventStore({
    backend: PearCupStorageSim.createMemoryBackend(),
    rootId: 'pearcup-demo',
    namespace: poolNamespace(poolId)
  })
  const worker = createBracketSettlementWorker(eventStore)
  const settlementService = createUiSettlementService(worker)
  const tetherActor = integrationRuntime.readiness.tetherWdk.adapterId || 'tether-wdk'
  const qvacActor = integrationRuntime.readiness.qvac.adapterId || 'qvac-ref'
  const entryLedger = []

  for (const [index, entrant] of entrants.entries()) {
    const entryId = `${poolId}-${entrant.userId}`
    const intent = await settlementService.createEntryIntent({
      poolId,
      entryId,
      userId: entrant.userId,
      username: entrant.username,
      amount,
      asset: 'USDT',
      rulesVersion: 'bracket-pool-v1'
    }, {
      actorId: entrant.userId
    })
    const firstCheck = await settlementService.reconcileEntryIntent({
      intentId: intent.payload.intentId,
      confirmationId: `demo-check-${index + 1}`
    }, {
      actorId: tetherActor
    })
    const finalCheck = firstCheck.type === 'TetherWdkEntryConfirmed'
      ? firstCheck
      : await settlementService.reconcileEntryIntent({
          intentId: intent.payload.intentId,
          confirmationId: `demo-confirmation-${index + 1}`
        }, {
          actorId: tetherActor
        })
    entryLedger.push({
      entrant,
      intent: intent.payload,
      pendingChecks: [firstCheck, finalCheck]
        .filter(event => event && event.type === 'TetherWdkEntryPaymentPending')
        .map(event => event.payload),
      payment: finalCheck && finalCheck.type === 'TetherWdkEntryConfirmed' ? finalCheck.payload : null,
      eventIds: {
        intent: intent.eventId,
        firstCheck: firstCheck.eventId,
        finalCheck: finalCheck.eventId
      }
    })
  }

  const winnerUserIds = [entrants[0].userId, entrants[1].userId]
  const payoutRecipients = payoutRecipientsForEntrants(entrants, winnerUserIds)
  const winnerEntrants = entrants.filter(entrant => winnerUserIds.includes(entrant.userId))
  for (const entrant of winnerEntrants) {
    const recipient = payoutRecipients[entrant.userId]
    if (!recipient) continue
    await worker.dispatchAsync({
      type: 'payout:declareRecipient',
      actorId: entrant.userId,
      payload: {
        poolId,
        userId: entrant.userId,
        username: entrant.username,
        teamId: entrant.teamId,
        asset: 'USDT',
        recipient
      }
    })
  }
  const settlementResult = await settlementService.settleBracketPoolWithReceipt({
    poolId,
    winnerUserIds,
    officialResults: {
      final: 'Brazil',
      rule: 'perfect-bracket-split'
    },
    asset: 'USDT',
    rulesVersion: 'bracket-pool-v1',
    qvacActorId: qvacActor,
    wdkActorId: tetherActor
  }, {
    actorId: 'settlement-worker',
    requireLive: integrationRuntime.canUseRealMoney
  })
  const settlementSummary = settlementResult.summary
  const serviceStatus = settlementService.status()
  await settlementService.close()
  if (typeof worker.refresh === 'function') await worker.refresh()
  const view = worker.view()
  const snapshot = eventStore.snapshot()
  const externalWorkerStorage = worker.kind === 'bridge'
  let replayView = { eventRoot: view.eventRoot }
  let replayMatched = true
  if (!externalWorkerStorage) {
    const replayWorker = createBracketSettlementWorker(eventStore)
    replayView = replayWorker.view()
    replayMatched = replayView.eventRoot === view.eventRoot
  }

  return {
    poolId,
    entrants,
    winnerUserIds,
    payoutRecipients,
    entryLedger,
    events: worker.events(),
    entryCount: Object.keys(view.entryPayments).length,
    pendingEntryChecks: Object.keys(view.entryPaymentChecks).length,
    poolResult: settlementSummary.poolResultEvent.payload,
    qvacAttestation: settlementSummary.attestationEvent.payload,
    payout: settlementSummary.settlementEvent.payload,
    settlementSummary,
    settlementReceipt: settlementResult.receipt,
    settlementReceiptEvent: settlementResult.receiptEvent,
    existingReceipt: settlementResult.existingReceipt,
    recipientDeclarationCount: settlementSummary.recipientDeclarationEvents
      ? settlementSummary.recipientDeclarationEvents.length
      : 0,
    settlementGate: serviceStatus.settlementGate,
    guardMode: serviceStatus.guardMode,
    storage: {
      namespace: externalWorkerStorage ? 'pearcup-worker-bridge' : snapshot.namespace,
      events: externalWorkerStorage ? worker.events().length : snapshot.events,
      eventRoot: externalWorkerStorage ? view.eventRoot : snapshot.eventRoot,
      replayRoot: replayView.eventRoot,
      replayMatched,
      external: externalWorkerStorage
    }
  }
}

function getPick (matchId) {
  return state.picks[matchId] || null
}

function makeMatch (id, time, status, slots, score = [null, null], sample = {}) {
  return { id, time, status, slots, score, sample }
}

function buildRounds () {
  const round32 = round32Matches.map(match => makeMatch(match.id, match.time, match.status, match.slots, match.score, match.sample))
  const round16 = [
    makeMatch('r16-1', 'Sat, 07/04, 00:00', 'Next', [getPick('r32-1'), getPick('r32-2')], [null, null], {}),
    makeMatch('r16-2', 'Sat, 07/04, 04:00', 'Next', [getPick('r32-3'), getPick('r32-4')], [null, null], {}),
    makeMatch('r16-3', 'Sun, 07/05, 00:00', 'Next', [getPick('r32-5'), getPick('r32-6')], [null, null], {}),
    makeMatch('r16-4', 'Sun, 07/05, 04:00', 'Next', [getPick('r32-7'), getPick('r32-8')], [null, null], {}),
    makeMatch('r16-5', 'Mon, 07/06, 00:00', 'Next', [getPick('r32-9'), getPick('r32-10')], [null, null], {}),
    makeMatch('r16-6', 'Mon, 07/06, 04:00', 'Next', [getPick('r32-11'), getPick('r32-12')], [null, null], {}),
    makeMatch('r16-7', 'Tue, 07/07, 00:00', 'Next', [getPick('r32-13'), getPick('r32-14')], [null, null], {}),
    makeMatch('r16-8', 'Tue, 07/07, 04:00', 'Next', [getPick('r32-15'), getPick('r32-16')], [null, null], {})
  ]
  const qf = [
    makeMatch('qf-1', 'Thu, 07/09, 00:00', 'Open', [getPick('r16-1'), getPick('r16-2')], [null, null], {}),
    makeMatch('qf-2', 'Fri, 07/10, 00:00', 'Open', [getPick('r16-3'), getPick('r16-4')], [null, null], {}),
    makeMatch('qf-3', 'Fri, 07/10, 04:00', 'Open', [getPick('r16-5'), getPick('r16-6')], [null, null], {}),
    makeMatch('qf-4', 'Sat, 07/11, 00:00', 'Open', [getPick('r16-7'), getPick('r16-8')], [null, null], {})
  ]
  const semi = [
    makeMatch('sf-1', 'Tue, 07/14, 00:00', 'Open', [getPick('qf-1'), getPick('qf-2')], [null, null], {}),
    makeMatch('sf-2', 'Wed, 07/15, 00:00', 'Open', [getPick('qf-3'), getPick('qf-4')], [null, null], {})
  ]
  const final = [
    makeMatch('final-1', 'Sun, 07/19, 01:00', 'Open', [getPick('sf-1'), getPick('sf-2')], [null, null], {})
  ]

  return [
    { key: 'round32', label: 'Round of 32', matches: round32 },
    { key: 'round16', label: 'Round of 16', matches: round16 },
    { key: 'quarter', label: 'Quarterfinals', matches: qf },
    { key: 'semi', label: 'Semifinals', matches: semi },
    { key: 'final', label: 'Final', matches: final }
  ]
}

function ownersFor (match, teamId) {
  const owners = [...(match.sample[teamId] || [])]
  if (getPick(match.id) === teamId) owners.unshift(state.username || 'you')
  return owners.slice(0, 2)
}

function renderTeamRow (match, teamId, index) {
  const team = teamId ? teamById(teamId) : null
  const picked = team && getPick(match.id) === team.id
  const score = match.score[index]

  if (!team) {
    return `
      <button class="team-row" type="button" disabled>
        <span class="team-flag" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z" fill="#717982"/></svg>
        </span>
        <span class="team-title">A determ.</span>
        <span class="score"></span>
      </button>
    `
  }

  const chips = ownersFor(match, team.id).map(owner => `<span class="pick-chip">${escapeHtml(owner)}</span>`).join('')

  return `
    <button class="team-row ${picked ? 'is-picked' : ''}" type="button" data-match="${match.id}" data-pick="${team.id}" aria-pressed="${picked}">
      <span class="team-flag">${team.flag}</span>
      <span class="team-title">${escapeHtml(team.name)}</span>
      <span class="pick-side">
        ${chips}
        <span class="score">${score === null ? '' : score}</span>
      </span>
    </button>
  `
}

function renderPoolSelect () {
  const el = $('#bracketPoolSelect')
  if (!el) return
  el.innerHTML = pools.map(pool => {
    const entered = !!state.enteredPools[pool.tier]
    const selected = pool.tier === state.selectedTier
    const affordable = state.wallet.balance >= pool.tier
    const cta = entered ? '✓ Entered' : selected ? (affordable ? `Enter · $${pool.tier}` : 'Fund to enter') : 'Select'
    const badge = pool.tier >= 100 ? 'pool-elite' : pool.tier >= 50 ? 'pool-gold' : pool.tier >= 25 ? 'pool-silver' : 'pool-bronze'
    return `
      <button class="pool-pick${selected ? ' is-selected' : ''}${entered ? ' is-entered' : ''}" type="button" data-pool="${pool.tier}">
        <img class="pool-pick-badge" src="assets/${badge}.png" alt="">
        <span class="pool-pick-heat">${pool.heat}</span>
        <span class="pool-pick-fee">$${pool.tier}</span>
        <span class="pool-pick-meta">${pool.prize} prize · ${pool.entrants} in</span>
        <span class="pool-pick-cta${entered ? ' is-entered' : affordable ? '' : ' is-locked'}">${cta}</span>
      </button>`
  }).join('')
  $$('#bracketPoolSelect .pool-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = Number(btn.dataset.pool)
      if (state.selectedTier !== tier) { state.selectedTier = tier; persist(); renderBracket(); return }
      enterSelectedPool()
    })
  })
}

function enterSelectedPool () {
  const tier = state.selectedTier
  if (state.enteredPools[tier]) { showToast(`You're already in the $${tier} bracket`); return }
  if (!debitWallet(tier, `$${tier} bracket entry`)) {
    showToast('Not enough balance — fund your wallet first')
    setView('onboarding')
    return
  }
  state.enteredPools[tier] = true
  persist()
  renderBracket()
  showToast(`Entered the $${tier} bracket · ${fmtMoney(tier)} escrowed via WDK`)
}

function renderBracketEntrants (settlement) {
  const el = $('#bracketEntrants')
  if (!el) return
  const ledger = settlement.entryLedger || []
  const youIn = !!state.enteredPools[state.selectedTier]
  const you = youIn
    ? [{ username: state.username || 'captain', teamId: state.team, you: true }]
    : []
  const others = ledger.map(entry => ({ username: entry.entrant.username, teamId: entry.entrant.teamId }))
  const everyone = [...you, ...others].slice(0, 14)
  const count = $('#enteredCount')
  if (count) count.textContent = `· ${(settlement.entryCount || others.length) + (youIn ? 1 : 0)} in this pool`
  el.innerHTML = everyone.length
    ? everyone.map(person => `
        <span class="entered-chip${person.you ? ' is-you' : ''}">
          ${avatarSvg(person.username, teamById(person.teamId), true)}
          <em>${escapeHtml(person.you ? 'You' : person.username)}</em>
        </span>`).join('')
    : '<p class="live-copy">No entries yet — be the first to enter this bracket.</p>'
}

function settlementStackAvailable () {
  return Boolean(
    PearCupWorkerSim &&
    PearCupWorkerClient &&
    PearCupStorageSim &&
    PearCupTransportSim &&
    PearCupSettlementService
  )
}

function demoBracketEntrants () {
  return [
    { entrant: { username: 'lina', userId: 'user-lina', teamId: 'br' } },
    { entrant: { username: 'amara', userId: 'user-amara', teamId: 'ci' } },
    { entrant: { username: 'diego', userId: 'user-diego', teamId: 'ar' } },
    { entrant: { username: 'vera', userId: 'user-vera', teamId: 'no' } },
    { entrant: { username: 'kenji', userId: 'user-kenji', teamId: 'jp' } }
  ]
}

function renderBracketDemoStats (selectedPool) {
  const entered = !!state.enteredPools[selectedPool.tier]
  const remaining = remainingPicks()
  const status = integrationRuntime.readiness.settlement
  if ($('#bracketStats')) $('#bracketStats').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Pool</p><strong>${selectedPool.prize}</strong></div>
      <div class="settlement-kpis">
        <div><span>Entrants</span><strong>${selectedPool.entrants}/${selectedPool.max}</strong></div>
        <div><span>Your entry</span><strong>${entered ? 'Entered' : 'Open'}</strong></div>
        <div><span>Picks</span><strong>${remaining > 0 ? `${remaining} left` : 'Complete'}</strong></div>
      </div>
    </article>
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Settlement</p><strong>${status.label}</strong></div>
      <p class="live-copy">Demo entries are ready for tonight; real payouts stay locked until the worker settlement stack is explicitly enabled.</p>
    </article>`

  if ($('#bracketEntriesPanel')) $('#bracketEntriesPanel').innerHTML = `
    <article class="settlement-rail-card entry-ledger-card">
      <div class="rail-header"><p class="eyebrow">Entries</p><strong>Pick'em pool</strong></div>
      <div class="entry-ledger">
        ${demoBracketEntrants().map(row => {
          const team = teamById(row.entrant.teamId)
          return `
            <div class="entry-ledger-row is-confirmed">
              <div class="entry-person">
                ${avatarSvg(row.entrant.username, team, true)}
                <div>
                  <strong>${escapeHtml(row.entrant.username)}</strong>
                  <span>${team.flag} ${escapeHtml(team.name)}</span>
                </div>
              </div>
              <span class="rail-state is-confirmed">Ready</span>
            </div>`
        }).join('')}
      </div>
    </article>`

  if ($('#bracketAudit')) $('#bracketAudit').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Audit</p><strong>P2P game mode ready</strong></div>
      <div class="hash-list compact-hash">
        <div><span>Prize gate</span><code>${status.status}</code></div>
        <div><span>Payouts</span><code>disabled</code></div>
        <div><span>P2P modules</span><code>${document.documentElement.dataset.pearcupP2pModules || 'checking'}</code></div>
        <div><span>Backend</span><code>${document.documentElement.dataset.pearcupPeerNet || 'detecting'}</code></div>
      </div>
    </article>`

  renderBracketEntrants({
    entryLedger: demoBracketEntrants(),
    entryCount: selectedPool.entrants
  })
}

function renderBracketBoard () {
  const placements = {
    round32: index => ({ column: 1, row: index + 2, span: 1 }),
    round16: index => ({ column: 2, row: 2 + (index * 2), span: 2 }),
    quarter: index => ({ column: 3, row: 3 + (index * 4), span: 4 }),
    semi: index => ({ column: 4, row: 5 + (index * 8), span: 8 }),
    final: () => ({ column: 5, row: 9, span: 8 })
  }
  const rounds = buildRounds()

  $('#bracketBoard').innerHTML = `
    <svg class="bracket-lines" id="bracketLines" aria-hidden="true"></svg>
    ${rounds.map((round, roundIndex) => `
    <p class="round-title" style="grid-column:${roundIndex + 1};grid-row:1">${round.label}</p>
    ${round.matches.map((match, index) => {
      const place = placements[round.key](index)
      return `
        <article class="match-card bracket-match" data-round="${round.key}" data-match-card="${match.id}" style="grid-column:${place.column};grid-row:${place.row} / span ${place.span}">
          <div class="match-meta">
            <span>${match.time}</span>
            <span class="match-status">${match.status}</span>
          </div>
          ${renderTeamRow(match, match.slots[0], 0)}
          ${renderTeamRow(match, match.slots[1], 1)}
        </article>
      `
    }).join('')}
    `).join('')}
  `

  $$('#bracketBoard [data-pick]').forEach(button => {
    button.addEventListener('click', () => {
      state.picks[button.dataset.match] = button.dataset.pick
      clearDownstream(button.dataset.match)
      persist()
      renderBracket()
    })
  })
  scheduleBracketConnectors()
}

async function renderBracket () {
  const renderId = ++bracketRenderSequence
  const selectedPool = pools.find(pool => pool.tier === state.selectedTier) || pools[1]
  const wdk = integrationRuntime.readiness.tetherWdk
  const entered = !!state.enteredPools[selectedPool.tier]
  $('#bracketTierLabel').textContent = `$${selectedPool.tier} pool${entered ? ' · entered' : ''}`
  renderPoolSelect()
  const remaining = remainingPicks()
  const pr = $('#picksRemaining')
  if (pr) pr.textContent = remaining > 0 ? `${remaining} left` : 'complete ✓'
  // Signpost the flow: highlight the step the user should act on next.
  const steps = $$('#bracket .bracket-step')
  if (steps.length >= 3) {
    steps.forEach(s => s.classList.remove('step-active'))
    steps[!entered ? 0 : remaining > 0 ? 2 : 2].classList.add('step-active')
    if (entered && remaining === 0) steps[2].classList.remove('step-active')
  }
  const statsEl = $('#bracketStats')
  if (statsEl) statsEl.innerHTML = '<p class="live-copy">Building WDK entry intents, QVAC attestation, and replay roots…</p>'
  renderBracketBoard()

  if (!settlementStackAvailable()) {
    renderBracketDemoStats(selectedPool)
    return
  }

  let settlement
  try {
    settlement = await resolveBracketSettlement(selectedPool)
  } catch (err) {
    if (renderId !== bracketRenderSequence) return
    renderSettlementError($('#bracketStats'), err, 'Bracket settlement blocked')
    return
  }
  if (renderId !== bracketRenderSequence) return

  const processorPayout = settlement.payout && settlement.payout.processorPayout
  const processorStatus = processorPayout
    ? processorPayout.status
    : settlement.payout && settlement.payout.status === 'prepared' ? 'prepared' : 'held'
  const payoutPrepared = settlement.payout &&
    settlement.payout.status === 'prepared' &&
    processorStatus !== 'recipient-required'
  const payoutStatus = payoutStatusMeta(processorStatus)
  const grossPool = settlement.payout && settlement.payout.grossPool != null
    ? `${settlement.payout.grossPool} ${settlement.payout.asset}`
    : 'Held'
  const splitAmount = settlement.payout && settlement.payout.amountEach != null
    ? `${settlement.payout.amountEach} each`
    : settlement.payout && settlement.payout.reason
    ? 'Disputed'
    : 'Pending'

  if ($('#bracketStats')) $('#bracketStats').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Tether WDK</p><strong>${serviceModeLabel(wdk)} bracket rail</strong></div>
      <div class="settlement-kpis">
        <div><span>Confirmed entries</span><strong>${settlement.entryCount}</strong></div>
        <div><span>Pending checks</span><strong>${settlement.pendingEntryChecks}</strong></div>
        <div><span>Payout</span><strong>${payoutStatus.label}</strong></div>
      </div>
    </article>
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Pool</p><strong>${grossPool}</strong></div>
      <div class="settlement-kpis single-row">
        <div><span>Split</span><strong>${splitAmount}</strong></div>
        <div><span>Events</span><strong>${settlement.storage.events}</strong></div>
        <div><span>Replay</span><strong>${settlement.storage.replayMatched ? 'Matched' : 'Mismatch'}</strong></div>
      </div>
    </article>`

  if ($('#bracketEntriesPanel')) $('#bracketEntriesPanel').innerHTML = `
    <article class="settlement-rail-card entry-ledger-card">
      <div class="rail-header"><p class="eyebrow">WDK entries</p><strong>Intent → reconcile → confirm</strong></div>
      ${renderEntryLedger(settlement)}
    </article>
    <article class="settlement-rail-card payout-recipient-card">
      <div class="rail-header"><p class="eyebrow">WDK payout</p><strong>${payoutPrepared ? 'Recipient quoted' : payoutStatus.label}</strong></div>
      ${renderPayoutRecipients(settlement)}
    </article>`

  if ($('#bracketAudit')) $('#bracketAudit').innerHTML = `
    <article class="settlement-rail-card">
      <div class="rail-header"><p class="eyebrow">Audit</p><strong>${settlement.qvacAttestation.ruling === 'verified' ? 'QVAC verified' : 'QVAC disputed'}</strong></div>
      <div class="hash-list compact-hash">
        <div><span>Guard mode</span><code>${settlement.guardMode}</code></div>
        <div><span>Prize gate</span><code>${settlement.settlementGate.status}</code></div>
        <div><span>QVAC attestation</span><code>${settlement.qvacAttestation.attestationId}</code></div>
        <div><span>Recipient declarations</span><code>${settlement.recipientDeclarationCount}</code></div>
        <div><span>Receipt hash</span><code>${escapeHtml(settlement.settlementReceipt && settlement.settlementReceipt.receiptHash || 'pending')}</code></div>
        <div><span>Receipt event</span><code>${escapeHtml(settlement.settlementReceiptEvent && settlement.settlementReceiptEvent.eventId || 'pending')}</code></div>
        <div><span>Pool namespace</span><code>${settlement.storage.namespace}</code></div>
        <div><span>Event root</span><code>${settlement.storage.eventRoot}</code></div>
        <div><span>Replay root</span><code>${settlement.storage.replayRoot}</code></div>
      </div>
    </article>`

  renderBracketEntrants(settlement)
  bindPayoutControls()
  const placements = {
    round32: index => ({ column: 1, row: index + 2, span: 1 }),
    round16: index => ({ column: 2, row: 2 + (index * 2), span: 2 }),
    quarter: index => ({ column: 3, row: 3 + (index * 4), span: 4 }),
    semi: index => ({ column: 4, row: 5 + (index * 8), span: 8 }),
    final: () => ({ column: 5, row: 9, span: 8 })
  }
  const rounds = buildRounds()

  $('#bracketBoard').innerHTML = `
    <svg class="bracket-lines" id="bracketLines" aria-hidden="true"></svg>
    ${rounds.map((round, roundIndex) => `
    <p class="round-title" style="grid-column:${roundIndex + 1};grid-row:1">${round.label}</p>
    ${round.matches.map((match, index) => {
      const place = placements[round.key](index)
      return `
        <article class="match-card bracket-match" data-round="${round.key}" data-match-card="${match.id}" style="grid-column:${place.column};grid-row:${place.row} / span ${place.span}">
          <div class="match-meta">
            <span>${match.time}</span>
            <span class="match-status">${match.status}</span>
          </div>
          ${renderTeamRow(match, match.slots[0], 0)}
          ${renderTeamRow(match, match.slots[1], 1)}
        </article>
      `
    }).join('')}
    `).join('')}
  `

  $$('#bracketBoard [data-pick]').forEach(button => {
    button.addEventListener('click', () => {
      state.picks[button.dataset.match] = button.dataset.pick
      clearDownstream(button.dataset.match)
      persist()
      renderBracket()
    })
  })
  scheduleBracketConnectors()
}

function scheduleBracketConnectors () {
  requestAnimationFrame(() => {
    updateBracketConnectors()
    requestAnimationFrame(updateBracketConnectors)
  })
}

function updateBracketConnectors () {
  const board = $('#bracketBoard')
  const svg = $('#bracketLines')
  if (!board || !svg || !board.offsetWidth) return

  if (window.matchMedia('(max-width: 720px)').matches) {
    svg.replaceChildren()
    svg.setAttribute('width', 0)
    svg.setAttribute('height', 0)
    return
  }

  const boardRect = board.getBoundingClientRect()
  const width = board.scrollWidth
  const height = board.scrollHeight
  const pointFor = (id, side = 'right') => {
    const card = board.querySelector(`[data-match-card="${id}"]`)
    if (!card) return null
    const rect = card.getBoundingClientRect()
    return {
      x: (side === 'right' ? rect.right : rect.left) - boardRect.left + board.scrollLeft,
      y: rect.top + (rect.height / 2) - boardRect.top + board.scrollTop
    }
  }

  const paths = []
  for (const link of bracketLinks) {
    const sourceA = pointFor(link.from[0], 'right')
    const sourceB = pointFor(link.from[1], 'right')
    const target = pointFor(link.to, 'left')
    if (!sourceA || !sourceB || !target) continue
    const joinX = Math.round((Math.max(sourceA.x, sourceB.x) + target.x) / 2)
    const y1 = Math.round(sourceA.y)
    const y2 = Math.round(sourceB.y)
    const yt = Math.round(target.y)
    paths.push(`M${Math.round(sourceA.x)} ${y1}H${joinX}`)
    paths.push(`M${Math.round(sourceB.x)} ${y2}H${joinX}`)
    paths.push(`M${joinX} ${Math.min(y1, y2, yt)}V${Math.max(y1, y2, yt)}`)
    paths.push(`M${joinX} ${yt}H${Math.round(target.x)}`)
  }

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('width', width)
  svg.setAttribute('height', height)
  svg.replaceChildren()
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', paths.join(' '))
  path.setAttribute('pathLength', '1')
  svg.append(path)
}

function clearDownstream (matchId) {
  const queue = bracketLinks
    .filter(link => link.from.includes(matchId))
    .map(link => link.to)
  const seen = new Set()
  while (queue.length) {
    const id = queue.shift()
    if (seen.has(id)) continue
    seen.add(id)
    bracketLinks
      .filter(link => link.from.includes(id))
      .forEach(link => queue.push(link.to))
  }
  for (const id of seen) delete state.picks[id]
}

function watchParticipants () {
  const livePick = ['es', 'at'].includes(state.picks['r32-11']) ? state.picks['r32-11'] : 'es'
  return [
    { name: state.username || 'captain', pick: livePick, role: 'you' },
    { name: 'lina', pick: 'es', role: 'stream host' },
    { name: 'amara', pick: 'at', role: 'voice' },
    { name: 'vera', pick: 'at', role: 'voice' },
    { name: 'diego', pick: 'es', role: 'chat' },
    { name: 'kwame', pick: 'at', role: 'chat' }
  ]
}

// ==================== Live Watch Party ====================
// Live match feed. `createSimLiveFeed` drives a believable match now; a real feed
// (a host peer polls API-Football / Football-Data.org and rebroadcasts events over
// the Pear room topic so peers don't each hit the API) drops in behind this same
// interface — see createApiLiveFeed seam below.
const WATCH_LANGS = ['EN', 'PT', 'ES', 'FR']
const COMMENTARY_TEMPLATES = {
  goal:   { EN: '⚽ GOAL! {t} score — the room erupts!', PT: '⚽ GOL! {t} marca — a sala explode!', ES: '⚽ ¡GOL de {t}! La sala estalla.', FR: '⚽ BUT de {t} ! La salle explose.' },
  shot:   { EN: '{t} force a sharp save — pressure rising.', PT: '{t} obriga a boa defesa — pressao subindo.', ES: '{t} obliga a una gran atajada — sube la presion.', FR: '{t} obligent a un arret — la pression monte.' },
  chance: { EN: 'Big chance for {t}! Inches wide.', PT: 'Grande chance do {t}! Passou perto.', ES: '¡Ocasion clara de {t}! Rozo el palo.', FR: 'Grosse occasion pour {t} ! Tout pres.' },
  corner: { EN: 'Corner to {t} — bodies in the box.', PT: 'Escanteio para o {t} — area lotada.', ES: 'Corner para {t} — todos al area.', FR: 'Corner pour {t} — la surface se remplit.' },
  save:   { EN: 'Huge save denies {t}! What a moment.', PT: 'Que defesa nega o {t}! Momento enorme.', ES: '¡Paradon que niega a {t}! Momentazo.', FR: 'Quel arret face a {t} ! Moment enorme.' },
  poss:   { EN: '{t} keep the ball and probe for openings.', PT: '{t} tocam a bola buscando espacos.', ES: '{t} manejan el balon buscando espacios.', FR: '{t} gardent le ballon et cherchent la faille.' },
  preview: { EN: '{t}', PT: '{t}', ES: '{t}', FR: '{t}' }
}
// Real seam: replace with a QVAC completion call { event, language } -> line.
function commentaryLine (type, teamName, lang) {
  const row = COMMENTARY_TEMPLATES[type] || COMMENTARY_TEMPLATES.poss
  return (row[lang] || row.EN).replace('{t}', teamName)
}

function createSimLiveFeed () {
  const listeners = new Set()
  let timer = null
  const st = {
    minute: 0,
    home: { name: 'Spain', flag: '🇪🇸', teamId: 'es', goals: 0 },
    away: { name: 'Austria', flag: '🇦🇹', teamId: 'at', goals: 0 },
    possession: 50,
    shots: [0, 0],
    threat: 50,
    hasScore: false,
    matchStatus: 'TIMED',
    utcDate: '2026-07-02T19:00:00Z',
    stage: 'LAST_32',
    competition: { name: 'FIFA World Cup' }
  }
  const emit = ev => listeners.forEach(fn => fn(ev, st))
  function tick () {
    if (st.matchStatus === 'TIMED' || st.matchStatus === 'SCHEDULED') {
      emit({ type: 'preview', team: 'Spain vs Austria room is open. Kickoff is 15:00 ET.', clock: 'Soon', minute: 0 })
      return
    }
    st.minute += 1
    st.possession = Math.max(35, Math.min(72, st.possession + Math.round((Math.random() - 0.5) * 8)))
    st.threat = Math.max(20, Math.min(96, st.threat + Math.round((Math.random() - 0.5) * 22)))
    const attackingHome = st.possession >= 50
    const team = attackingHome ? st.home : st.away
    const idx = attackingHome ? 0 : 1
    const roll = Math.random()
    let type = 'poss'
    if (roll > 0.9) { type = 'goal'; team.goals += 1; st.shots[idx] += 1 }
    else if (roll > 0.72) { type = 'shot'; st.shots[idx] += 1 }
    else if (roll > 0.58) { type = 'save' }
    else if (roll > 0.44) { type = 'chance'; st.shots[idx] += 1 }
    else if (roll > 0.3) { type = 'corner' }
    emit({ type, team: team.name, teamId: team.teamId, clock: `${st.minute}'`, minute: st.minute })
    if (st.minute >= 90) { stop(); emit({ type: 'ft', team: '', clock: 'FT', minute: 90 }) }
  }
  function start () { if (!timer) timer = setInterval(tick, 3400) }
  function stop () { if (timer) { clearInterval(timer); timer = null } }
  return { start, stop, subscribe (fn) { listeners.add(fn); return () => listeners.delete(fn) }, state () { return st }, source: 'sim' }
}
// Real live feed — fetches a football data API and maps it to the same interface.
// NOTE: browsers can't call these APIs directly (no CORS). In the Pear runtime a
// worker fetches (no CORS) and relays over the room topic; for browser testing set
// a CORS `proxy` prefix in the Live-data settings.
function mapFeed (st, provider, data) {
  if (provider === 'football-data') {
    const m = Array.isArray(data.matches) ? data.matches[0] : data
    if (!m) throw new Error('No live match found')
    st.home.name = m.homeTeam.shortName || m.homeTeam.name || 'Home'
    st.away.name = m.awayTeam.shortName || m.awayTeam.name || 'Away'
    st.home.tla = m.homeTeam.tla || ''
    st.away.tla = m.awayTeam.tla || ''
    st.home.crest = m.homeTeam.crest || ''
    st.away.crest = m.awayTeam.crest || ''
    const ft = m.score && (m.score.fullTime || m.score.regularTime) || {}
    const hasScore = ft.home != null || ft.away != null
    st.home.goals = ft.home ?? 0
    st.away.goals = ft.away ?? 0
    st.hasScore = hasScore
    st.minute = m.minute ?? st.minute
    st.matchStatus = m.status || 'IN_PLAY'
    st.competition = { name: (m.competition && m.competition.name) || 'FIFA World Cup', emblem: (m.competition && m.competition.emblem) || '' }
    st.utcDate = m.utcDate || ''
    st.stage = m.stage || ''
    st.matchday = m.matchday || null
    st.venue = m.venue || ''
    st.lastUpdated = m.lastUpdated || ''
  } else {
    const r = (data.response || [])[0]
    if (!r) throw new Error('No fixture found')
    st.home.name = r.teams.home.name
    st.away.name = r.teams.away.name
    st.home.goals = r.goals.home ?? 0
    st.away.goals = r.goals.away ?? 0
    st.minute = (r.fixture.status && r.fixture.status.elapsed) ?? st.minute
    st.matchStatus = r.fixture.status && r.fixture.status.short || 'LIVE'
  }
  st.home.flag = st.home.flag || '⚽'
  st.away.flag = st.away.flag || '⚽'
}

function apiRequest (config) {
  const provider = config.provider || 'football-data'
  const proxy = config.proxy || ''
  // Same-origin relay: a Pear worker (or fetch-live.mjs) writes a JSON file the
  // renderer polls — no CORS, no key in the browser. This IS the production path.
  if (proxy && /\.json(\?|$)/.test(proxy)) {
    return fetch(proxy, { cache: 'no-store' }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
  }
  let url, headers
  if (provider === 'football-data') {
    url = config.matchId
      ? `https://api.football-data.org/v4/matches/${config.matchId}`
      : 'https://api.football-data.org/v4/matches?status=LIVE'
    headers = { 'X-Auth-Token': config.apiKey }
  } else {
    url = `https://v3.football.api-sports.io/fixtures?id=${config.matchId}`
    headers = { 'x-apisports-key': config.apiKey }
  }
  return fetch(proxy + url, { headers }).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  })
}

function createApiLiveFeed (config) {
  const listeners = new Set()
  let timer = null
  const st = {
    minute: 0,
    home: { name: 'Home', flag: '⚽', teamId: 'es', goals: 0 },
    away: { name: 'Away', flag: '⚽', teamId: 'at', goals: 0 },
    possession: 50, shots: [0, 0], threat: 50, matchStatus: 'connecting'
  }
  const emit = ev => listeners.forEach(fn => fn(ev, st))
  async function poll () {
    try {
      const data = await apiRequest(config)
      const first = st._total === undefined
      const prevHome = st.home.goals
      const prevTotal = st._total
      mapFeed(st, config.provider, data)
      const total = st.home.goals + st.away.goals
      const clk = st.minute ? `${st.minute}'` : ''
      // First poll seeds the baseline (don't announce the existing score as new goals).
      let ev = { type: 'tick', clock: clk, minute: st.minute }
      if (!first && total > prevTotal) ev = { type: 'goal', team: st.home.goals > prevHome ? st.home.name : st.away.name, clock: clk, minute: st.minute }
      st._total = total
      emit(ev)
    } catch (err) {
      st.matchStatus = 'error'
      emit({ type: 'error', message: String(err.message || err) })
    }
  }
  return {
    start () { if (!timer) { poll(); timer = setInterval(poll, (config.pollSec || 30) * 1000) } },
    stop () { if (timer) { clearInterval(timer); timer = null } },
    subscribe (fn) { listeners.add(fn); return () => listeners.delete(fn) },
    state () { return st },
    poll,
    source: 'api'
  }
}

const simFeed = createSimLiveFeed()
let apiFeed = null
let activeFeed = simFeed
let feedUnsub = null
function feedState () { return activeFeed.state() }

function seedFeedEvents () {
  if (!state.feedEvents || !state.feedEvents.length) {
    state.feedEvents = [
      { clock: 'Today', type: 'preview', team: 'Spain vs Austria room is open.' },
      { clock: '19:00Z', type: 'preview', team: 'Kickoff at SoFi Stadium.' },
      { clock: 'R32', type: 'preview', team: 'Portugal vs Croatia and Switzerland vs Algeria follow later today.' }
    ]
  }
}

function renderCommentaryFeed () {
  const feed = $('#commentaryFeed')
  if (!feed) return
  // Live API: show only real goals for this match (+ an intro), not the sim lines.
  if (isLiveApi()) {
    const st = feedState()
    const goals = (state.feedEvents || []).filter(e => e.type === 'goal')
    const intro = `<div class="commentary-line"><time>LIVE</time><p>Following ${escapeHtml(st.home.name)} vs ${escapeHtml(st.away.name)} — QVAC commentary updates as goals go in.</p></div>`
    feed.innerHTML = intro + goals.map(ev => `
      <div class="commentary-line is-goal">
        <time>${escapeHtml(ev.clock || 'LIVE')}</time>
        <p>${escapeHtml(commentaryLine(ev.type, ev.team, state.language))}</p>
      </div>`).join('')
    return
  }
  seedFeedEvents()
  feed.innerHTML = state.feedEvents.map(ev => `
    <div class="commentary-line${ev.type === 'goal' ? ' is-goal' : ''}">
      <time>${escapeHtml(ev.clock)}</time>
      <p>${escapeHtml(commentaryLine(ev.type, ev.team, state.language))}</p>
    </div>
  `).join('')
}

function isLiveApi () { return activeFeed && activeFeed.source === 'api' }

function fmtTime (iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

function matchStateLabel (st) {
  const s = st.matchStatus
  if (s === 'FINISHED') return { txt: 'Full time', cls: 'is-ft', dot: false }
  if (s === 'PAUSED') return { txt: 'Half time', cls: 'is-live', dot: true }
  if (s === 'IN_PLAY' || s === 'LIVE') return { txt: st.minute ? `${st.minute}'` : 'LIVE', cls: 'is-live', dot: true }
  if (s === 'TIMED' || s === 'SCHEDULED') return { txt: `Kicks off ${fmtTime(st.utcDate) || 'soon'}`, cls: 'is-soon', dot: false }
  return { txt: s || 'Scheduled', cls: 'is-soon', dot: false }
}

function stageLabel (st) {
  const map = { LAST_32: 'Round of 32', LAST_16: 'Round of 16', ROUND_OF_16: 'Round of 16', QUARTER_FINALS: 'Quarter-final', SEMI_FINALS: 'Semi-final', FINAL: 'Final', GROUP_STAGE: 'Group stage', THIRD_PLACE: 'Third place' }
  return map[st.stage] || (st.stage ? String(st.stage).replace(/_/g, ' ').toLowerCase() : '')
}

function renderLiveBoard (st) {
  const el = $('#tvLiveBoard')
  if (!el) return
  const info = matchStateLabel(st)
  const scoreMid = st.hasScore ? `${st.home.goals}<span>–</span>${st.away.goals}` : '<span class="lb-vs">vs</span>'
  const crest = url => url
    ? `<span class="lb-crestwrap"><img class="lb-crest" src="${escapeHtml(url)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="lb-crest lb-crest-blank" style="display:none">⚽</span></span>`
    : '<div class="lb-crest lb-crest-blank">⚽</div>'
  el.innerHTML = `
    <div class="lb-comp">
      ${st.competition && st.competition.emblem ? `<img class="lb-emblem" src="${escapeHtml(st.competition.emblem)}" alt="">` : ''}
      <span>${escapeHtml((st.competition && st.competition.name) || 'FIFA World Cup')}${stageLabel(st) ? ' · ' + stageLabel(st) : ''}</span>
    </div>
    <div class="lb-teams">
      <div class="lb-team">${crest(st.home.crest)}<strong>${escapeHtml(st.home.name)}</strong></div>
      <div class="lb-score">${scoreMid}</div>
      <div class="lb-team">${crest(st.away.crest)}<strong>${escapeHtml(st.away.name)}</strong></div>
    </div>
    <div class="lb-state ${info.cls}">${info.dot ? '<i></i>' : ''}${escapeHtml(info.txt)}</div>`
}

function renderLiveSource (st) {
  const el = $('#liveSource')
  if (!el) return
  el.innerHTML = `
    <span class="ls-badge"><i></i>LIVE DATA</span>
    <span class="ls-src">Football-Data.org${st.lastUpdated ? ` · updated ${fmtTime(st.lastUpdated)}` : ''}</span>
    <button class="ls-refresh" id="liveRefresh" type="button">↻ Refresh</button>`
  const r = $('#liveRefresh')
  if (r) r.onclick = () => { if (activeFeed && activeFeed.poll) { activeFeed.poll(); showToast('Refreshing live data…') } }
}

function renderWatchStats (st) {
  const el = $('#watchStats')
  if (!el) return
  if (isLiveApi()) {
    el.className = 'stats-strip is-live-meta'
    const chip = (label, val) => `<div class="live-meta"><span>${label}</span><strong>${escapeHtml(val || '—')}</strong></div>`
    el.innerHTML =
      chip('Status', matchStateLabel(st).txt) +
      chip('Kickoff', fmtTime(st.utcDate)) +
      chip('Round', stageLabel(st))
    return
  }
  el.className = 'stats-strip'
  const poss = st.possession
  const shotsPct = Math.round((st.shots[0] / Math.max(1, st.shots[0] + st.shots[1])) * 100)
  const threatLabel = st.threat > 78 ? 'High' : st.threat > 50 ? 'Medium' : 'Low'
  const meter = (label, pct, value) => `
    <div class="stat-meter">
      <span>${label}</span>
      <div class="meter"><i style="width:${pct}%"></i></div>
      <strong>${value}</strong>
    </div>`
  el.innerHTML =
    meter('Possession', poss, `${poss} / ${100 - poss}`) +
    meter('Shots', shotsPct, `${st.shots[0]} / ${st.shots[1]}`) +
    meter('Threat', st.threat, threatLabel)
}

function flashTv () {
  const flash = $('#tvFlash')
  if (!flash) return
  flash.classList.remove('is-on')
  void flash.offsetWidth
  flash.classList.add('is-on')
}

let lastLiveMatchKey = ''
function applyFeedTick (ev, st) {
  // Clear commentary when the live match changes (or on entering live mode).
  if (isLiveApi()) {
    const key = `${st.home.name}|${st.away.name}`
    if (key !== lastLiveMatchKey) { lastLiveMatchKey = key; state.feedEvents = [] }
  }
  const clockTxt = st.matchStatus === 'FINISHED' || st.minute >= 90
    ? 'FT'
    : st.minute ? `${st.minute}'`
    : (st.matchStatus === 'IN_PLAY' || st.matchStatus === 'PAUSED' || st.matchStatus === 'LIVE') ? 'LIVE'
    : st.matchStatus === 'TIMED' || st.matchStatus === 'SCHEDULED' ? 'Soon'
    : `${st.minute || 0}'`
  const clock = $('#tvClock'); if (clock) clock.textContent = clockTxt
  const score = $('#tvScore'); if (score) score.textContent = st.hasScore === false
    ? `${st.home.name} vs ${st.away.name}`
    : `${st.home.name} ${st.home.goals} - ${st.away.goals} ${st.away.name}`
  const title = $('#watchTitle'); if (title) title.textContent = `${st.home.name} vs ${st.away.name}`
  // Live vs simulated presentation: real API → rich scoreboard + source badge.
  const tv = document.querySelector('#watch .stadium-tv')
  const board = $('#tvLiveBoard'); const src = $('#liveSource')
  if (isLiveApi()) {
    if (tv) tv.classList.add('is-live')
    if (board) { board.hidden = false; renderLiveBoard(st) }
    if (src) { src.hidden = false; renderLiveSource(st) }
  } else {
    if (tv) tv.classList.remove('is-live')
    if (board) board.hidden = true
    if (src) src.hidden = true
  }
  renderWatchStats(st)
  if (isLiveApi()) renderCommentaryFeed()
  // Only log real events with a team (skip API poll 'tick' refreshes).
  if (ev && ev.type && ev.type !== 'ft' && ev.type !== 'tick' && ev.team) {
    seedFeedEvents()
    state.feedEvents.unshift({ clock: ev.clock, type: ev.type, team: ev.team })
    state.feedEvents = state.feedEvents.slice(0, 24)
    renderCommentaryFeed()
  }
  if (ev && ev.type === 'goal') { flashTv(); showToast(`⚽ GOAL! ${ev.team} — ${st.home.goals}-${st.away.goals}`) }
  // Keep the Home dashboard live too (hero/fixtures/timeline/stats reflect the same feed).
  if (document.querySelector('#home')?.classList.contains('is-active') && $('#liveDetail')) {
    renderHomeDashboard()
  }
  // Watch room key follows the current match — re-join if it changed (e.g. sim → live).
  if (window.PearCupWatchSync && document.querySelector('#watch')?.classList.contains('is-active')) {
    window.PearCupWatchSync.ensureRoom()
  }
}

// Same-origin relay file a Pear worker / fetch-live.mjs writes. When present it
// IS the production live path (no CORS, no key in the browser).
const RELAY_FILE = 'live-match.json'
function isRelay (proxy) { return /\.json(\?|$)/.test(proxy || '') }

// Auto-detect the relay: if live-match.json is being written (real match data),
// switch the Watch feed to it automatically — no manual settings needed.
async function detectLiveRelay () {
  const cfg = state.liveConfig || {}
  if (cfg.apiKey && cfg.enabled) return           // an explicit API/proxy config wins
  try {
    const res = await fetch(`${RELAY_FILE}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const m = await res.json()                     // ensure it parses
    // Staleness guard: the packaged app ships whatever snapshot was staged. A finished
    // match whose data is >12h old is yesterday's news — don't present it as live.
    const stamp = Date.parse(m.lastUpdated || m.utcDate || 0) || 0
    const finished = (m.status || '') === 'FINISHED'
    if (finished && Date.now() - stamp > 12 * 3600 * 1000) {
      // Also unwind a previously auto-enabled relay so persisted configs go stale-safe.
      if (cfg.enabled && isRelay(cfg.proxy)) {
        state.liveConfig = { ...cfg, enabled: false, proxy: '' }
        persist()
        startLiveFeed()
      }
      return
    }
    state.liveConfig = { ...cfg, enabled: true, proxy: RELAY_FILE }
    startLiveFeed()
    if (document.querySelector('#watch')?.classList.contains('is-active')) renderWatch()
  } catch { /* no relay yet — stay on the simulated feed */ }
}

function startLiveFeed () {
  const cfg = state.liveConfig
  const useApi = cfg && cfg.enabled && (cfg.apiKey || isRelay(cfg.proxy))
  const cfgKey = JSON.stringify(cfg || {})
  if (useApi) {
    // Reuse the same feed instance across re-renders so the goal baseline isn't reset.
    if (!apiFeed || apiFeed._cfgKey !== cfgKey) {
      if (apiFeed) apiFeed.stop()
      apiFeed = createApiLiveFeed(cfg)
      apiFeed._cfgKey = cfgKey
    }
    simFeed.stop()
    activeFeed = apiFeed
  } else {
    if (apiFeed) apiFeed.stop()
    activeFeed = simFeed
  }
  if (feedUnsub) feedUnsub()
  feedUnsub = activeFeed.subscribe(applyFeedTick)
  activeFeed.start()
}

// ---- Screen share (real getDisplayMedia capture; P2P relay to peers is the Pear/WebRTC seam) ----
let shareStream = null
async function startScreenShare () {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showToast('Screen share needs the Pear runtime / a supported browser')
    return
  }
  try {
    shareStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false })
  } catch (err) { showToast('Screen share cancelled'); return }
  const video = $('#shareVideo')
  if (video) { video.srcObject = shareStream; video.hidden = false; video.play().catch(() => {}) }
  const pitch = $('#tvPitch'); if (pitch) pitch.style.opacity = '0'
  const badge = $('#shareBadge'); if (badge) { badge.hidden = false; badge.innerHTML = `<i></i>You are sharing your screen · relaying to ${Math.max(1, (state.spectators || 2) - 1)} peer${(state.spectators || 2) - 1 === 1 ? '' : 's'}` }
  const btn = $('#shareScreenBtn'); if (btn) btn.classList.add('is-live')
  showToast('Sharing your screen to the room')
  const track = shareStream.getVideoTracks()[0]
  if (track) track.addEventListener('ended', stopScreenShare)
}
function stopScreenShare () {
  if (shareStream) { shareStream.getTracks().forEach(t => t.stop()); shareStream = null }
  const video = $('#shareVideo'); if (video) { video.hidden = true; video.srcObject = null }
  const pitch = $('#tvPitch'); if (pitch) pitch.style.opacity = ''
  const badge = $('#shareBadge'); if (badge) badge.hidden = true
  const btn = $('#shareScreenBtn'); if (btn) btn.classList.remove('is-live')
}
function toggleScreenShare () { shareStream ? stopScreenShare() : startScreenShare() }

// ---- Share the room / spectate (surfaces the existing P2P topic; sim peers join now) ----
let spectatorTimer = null
function roomCode () {
  const st = feedState()
  const seed = hashString(`${st.home.teamId}-${st.away.teamId}-${state.username || 'host'}`)
  return `pear://pearcup/watch/${st.home.teamId}-${st.away.teamId}-${(seed % 100000).toString(36)}`
}
function toggleInviteBar () {
  const bar = $('#roomShareBar')
  if (!bar) return
  if (!bar.hidden) { bar.hidden = true; stopSpectatorSim(); return }
  const code = roomCode()
  state.spectators = state.spectators || 38
  bar.hidden = false
  bar.innerHTML = `
    <div class="share-room-head"><strong>Watching together</strong><span id="spectatorCount">${state.spectators} peers watching</span></div>
    <div class="share-room-link">
      <code id="roomLink">${escapeHtml(code)}</code>
      <button class="secondary-button compact-action" type="button" id="copyRoomLink">Copy invite</button>
    </div>
    <p class="share-room-note">Peers join over the Pear room topic — no server. Your Penalty Clash already broadcasts to spectators on the same swarm.</p>`
  const copy = $('#copyRoomLink')
  if (copy) copy.addEventListener('click', () => {
    if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {})
    showToast('Invite link copied')
  })
  startSpectatorSim()
}
function startSpectatorSim () {
  stopSpectatorSim()
  spectatorTimer = setInterval(() => {
    state.spectators = Math.max(12, (state.spectators || 38) + (Math.random() > 0.4 ? 1 : -1))
    const el = $('#spectatorCount')
    if (el) el.textContent = `${state.spectators} peers watching`
    else stopSpectatorSim()
  }, 2600)
}
function stopSpectatorSim () { if (spectatorTimer) { clearInterval(spectatorTimer); spectatorTimer = null } }

function renderWatch () {
  startLiveFeed()
  seedFeedEvents()
  renderWatchStats(feedState())
  applyFeedTick(null, feedState())
  const room = watchParticipants()
  const grouped = ['es', 'at'].map(teamId => {
    const picked = room.filter(person => person.pick === teamId)
    return { team: teamById(teamId), picked }
  })

  $('#watchPickBoard').innerHTML = `
    <p class="party-label"><span class="party-dot"></span>Watch party · ${room.length} on the couch</p>
    <div class="couches">
      ${grouped.map((group, gi) => `
        <div class="couch-group">
          <div class="couch-team">
            <span class="score-flag">${group.team.flag}</span>
            <strong>${escapeHtml(group.team.name)}</strong>
            <span>${group.picked.length} watching</span>
          </div>
          <div class="couch-scene">
            <div class="couch-seated">
              ${group.picked.map(person => `
                <span class="seated">
                  <span class="seated-av">${avatarSvg(person.name, group.team, true)}</span>
                  <em>${escapeHtml(person.name)}</em>
                </span>`).join('')}
            </div>
            <img class="couch-img" src="assets/${gi === 0 ? 'couch' : 'couch2'}.png" alt="">
          </div>
        </div>`).join('')}
    </div>`

  $('#languageTabs').innerHTML = WATCH_LANGS.map(language => `
    <button type="button" class="${language === state.language ? 'is-active' : ''}" data-language="${language}">
      ${language}
    </button>
  `).join('')

  $$('#languageTabs button').forEach(button => {
    button.addEventListener('click', () => {
      state.language = button.dataset.language
      persist()
      $$('#languageTabs button').forEach(b => b.classList.toggle('is-active', b === button))
      renderCommentaryFeed()
    })
  })

  renderCommentaryFeed()

  $('#chatFeed').innerHTML = state.chat.length
    ? state.chat.map(message => `
    <div class="chat-message">
      <time>${message.time}</time>
      <strong>${escapeHtml(message.user)}</strong>
      <p>${escapeHtml(message.text)}</p>
    </div>
  `).join('')
    : '<p class="chat-empty">Quiet in here — say something to the room! 💬</p>'

  $('#voiceToggle').classList.toggle('is-live', state.voice)

  // Join the shared watch room for this match (chat + reactions + presence sync).
  if (window.PearCupWatchSync) { window.PearCupWatchSync.ensureRoom(); window.PearCupWatchSync.bindReactionBar(); window.PearCupWatchSync.updatePresence() }
}

function currentGameRound () {
  const round = gameRounds[state.gameRound % gameRounds.length]
  const username = state.username || 'captain'
  if (round.shooter === 'captain') return { ...round, shooter: username, shooterTeam: state.team }
  if (round.keeper === 'captain') return { ...round, keeper: username, keeperTeam: state.team }
  return round
}

function gameUserId (name) {
  return `user-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

async function resolvePenaltyRound (roundOverride) {
  const round = roundOverride || currentGameRound()
  const gameId = 'pc-brazil-norway-room'
  const roundIndex = state.gameRound
  const roundId = `pc-${roundIndex + 1}`
  const shooter = { id: gameUserId(round.shooter), username: round.shooter, teamId: round.shooterTeam }
  const keeper = { id: gameUserId(round.keeper), username: round.keeper, teamId: round.keeperTeam }
  const shooterInput = {
    role: 'shooter',
    aimZone: round.aim,
    powerBand: round.power,
    curveBand: round.curve,
    releaseTick: round.releaseTick
  }
  const keeperInput = {
    role: 'keeper',
    diveZone: round.dive,
    releaseTick: round.keeperTick
  }
  const expectedRound = PearCupCore.createPenaltyClashRound({
    gameId,
    roundIndex,
    shooter,
    keeper,
    shooterInput,
    keeperInput
  })
  const payoutRecipients = payoutRecipientForResolvedRound(round, expectedRound)
  const eventStore = PearCupStorageSim.createEventStore({
    backend: PearCupStorageSim.createMemoryBackend(),
    rootId: 'pearcup-demo',
    namespace: PearCupStorageSim.gameNamespace(gameId)
  })
  const worker = createPenaltySettlementWorker(eventStore)
  const settlementService = createUiSettlementService(worker)
  const tetherActor = integrationRuntime.readiness.tetherWdk.adapterId || 'tether-wdk'
  const qvacActor = integrationRuntime.readiness.qvac.adapterId || 'qvac-ref'
  const escrowEvent = await settlementService.createGameEscrow({
    gameId,
    players: [shooter.id, keeper.id],
    amount: 5,
    asset: 'USDT',
    rulesVersion: PearCupCore.resolverVersion
  }, {
    actorId: tetherActor
  })
  const shooterCommitment = PearCupCore.createCommitment({
    gameId,
    roundId,
    playerId: shooter.id,
    input: shooterInput,
    nonce: 'shooter-nonce'
  })
  const keeperCommitment = PearCupCore.createCommitment({
    gameId,
    roundId,
    playerId: keeper.id,
    input: keeperInput,
    nonce: 'keeper-nonce'
  })
  await worker.dispatchAsync({
    type: 'game:submitCommitment',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, commitment: shooterCommitment }
  })
  await worker.dispatchAsync({
    type: 'game:submitCommitment',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, commitment: keeperCommitment }
  })
  await worker.dispatchAsync({
    type: 'game:revealInput',
    actorId: shooter.id,
    payload: { gameId, roundId, playerId: shooter.id, input: shooterInput, nonce: 'shooter-nonce' }
  })
  await worker.dispatchAsync({
    type: 'game:revealInput',
    actorId: keeper.id,
    payload: { gameId, roundId, playerId: keeper.id, input: keeperInput, nonce: 'keeper-nonce' }
  })
  await worker.dispatchAsync({
    type: 'game:submitRoundStateHash',
    actorId: shooter.id,
    payload: {
      gameId,
      roundId,
      roundIndex,
      playerId: shooter.id,
      stateHash: expectedRound.stateHash,
      resolverVersion: expectedRound.resolverVersion
    }
  })
  await worker.dispatchAsync({
    type: 'game:submitRoundStateHash',
    actorId: keeper.id,
    payload: {
      gameId,
      roundId,
      roundIndex,
      playerId: keeper.id,
      stateHash: expectedRound.stateHash,
      resolverVersion: expectedRound.resolverVersion
    }
  })
  const settlementResult = await settlementService.settleGameRoundWithReceipt({
    gameId,
    roundIndex,
    roundId,
    shooter,
    keeper,
    escrowId: escrowEvent.payload.escrowId,
    qvacActorId: qvacActor,
    wdkActorId: tetherActor,
    payoutRecipients
  }, {
    actorId: 'settlement-worker',
    requireLive: integrationRuntime.canUseRealMoney
  })
  const settlementSummary = settlementResult.summary
  const serviceStatus = settlementService.status()
  await settlementService.close()
  if (typeof worker.refresh === 'function') await worker.refresh()
  const resolved = settlementSummary.roundEvent.payload
  const workerEvents = worker.events()
  const localView = worker.view()
  const storageSnapshot = eventStore.snapshot()
  let replayView = { eventRoot: localView.eventRoot }
  let replayEvents = workerEvents.length
  let replayMatched = true
  let externalWorkerStorage = worker.kind === 'bridge'
  if (!externalWorkerStorage) {
    const replayWorker = createPenaltySettlementWorker(eventStore)
    replayView = replayWorker.view()
    replayEvents = replayWorker.events().length
    replayMatched = replayView.eventRoot === localView.eventRoot
  }
  const heldReason = settlementSummary.settlementEvent && settlementSummary.settlementEvent.payload && settlementSummary.settlementEvent.payload.reason ||
    settlementSummary.roundEvent && settlementSummary.roundEvent.payload && settlementSummary.roundEvent.payload.reason ||
    settlementResult.receiptReason ||
    'Settlement held pending trusted evidence'
  const qvacAttestation = settlementSummary.attestationEvent && settlementSummary.attestationEvent.payload
    ? settlementSummary.attestationEvent.payload
    : {
        attestationId: 'pending-qvac-attestation',
        ruling: settlementSummary.status || 'held',
        rationale: heldReason,
        gameId,
        roundId,
        winnerUserId: null,
        participantUserIds: [shooter.id, keeper.id]
      }
  const tetherPayout = settlementSummary.settlementEvent && settlementSummary.settlementEvent.payload
    ? settlementSummary.settlementEvent.payload
    : {
        status: settlementSummary.status || 'held',
        reason: heldReason,
        gameId,
        roundId,
        escrowId: escrowEvent.payload.escrowId,
        disputeId: 'held-settlement',
        amount: escrowEvent.payload.amount,
        asset: escrowEvent.payload.asset
      }
  const topic = PearCupTransportSim.gameTopic(gameId)
  const topicBus = PearCupTransportSim.createTopicBus({ topic })
  topicBus.joinPeer('host', worker)
  topicBus.joinPeer('away')
  topicBus.joinPeer('spectator')
  const syncReport = await topicBus.syncAllAsync({ duplicates: true, outOfOrder: true })
  const syncRoots = syncReport.roots
  const spectatorRoot = syncRoots.find(peer => peer.peerId === 'spectator').root
  const spectatorEvents = syncRoots.find(peer => peer.peerId === 'spectator').events
  const mergedToSpectator = syncReport.reports
    .filter(report => report.to === 'spectator')
    .reduce((total, report) => total + report.merged, 0)

  return {
    ...resolved,
    ...round,
    aim: round.aim,
    dive: round.dive,
    power: round.power,
    curve: round.curve,
    qvacAttestation,
    tetherEscrow: escrowEvent.payload,
    tetherPayout,
    settlementSummary,
    settlementReceipt: settlementResult.receipt,
    settlementReceiptEvent: settlementResult.receiptEvent,
    existingReceipt: settlementResult.existingReceipt,
    settlementGate: serviceStatus.settlementGate,
    guardMode: serviceStatus.guardMode,
    runtime: integrationRuntime.readiness,
    canUseRealMoney: integrationRuntime.canUseRealMoney,
    workerEvents,
    sync: {
      topic,
      localRoot: localView.eventRoot,
      spectatorRoot,
      spectatorMerged: mergedToSpectator,
      spectatorEvents,
      matched: syncReport.converged,
      typeCounts: localView.typeCounts
    },
    storage: {
      namespace: externalWorkerStorage ? 'pearcup-worker-bridge' : storageSnapshot.namespace,
      key: externalWorkerStorage ? 'pearcup-worker-v1' : storageSnapshot.key,
      backend: externalWorkerStorage ? 'pear-worker-bridge' : storageSnapshot.backend,
      external: externalWorkerStorage,
      persistedEvents: externalWorkerStorage ? workerEvents.length : storageSnapshot.events,
      eventRoot: externalWorkerStorage ? localView.eventRoot : storageSnapshot.eventRoot,
      replayRoot: replayView.eventRoot,
      replayEvents,
      replayMatched
    }
  }
}

// Ball/keeper target for an aim zone, as a % of the penalty stage. Derived from the
// actual aim-grid cell so the ball always lands INSIDE the goal mouth (the grid and
// goal frame share the same rect) — fixes "goal" balls flying wide/under the net.
function zonePosition (zone) {
  const stage = document.querySelector('#penaltyStage')
  const cell = document.querySelector(`.aim-zone[data-zone="${zone}"]`)
  if (stage && cell) {
    const s = stage.getBoundingClientRect()
    const c = cell.getBoundingClientRect()
    if (s.width > 0 && s.height > 0 && c.width > 0) {
      return {
        x: Math.round(((c.left + c.width / 2 - s.left) / s.width) * 1000) / 10,
        y: Math.round(((c.top + c.height / 2 - s.top) / s.height) * 1000) / 10
      }
    }
  }
  // Fallback before the grid is laid out — tuned to sit inside the goal frame.
  const [side, height] = zone.split('-')
  const x = side === 'left' ? 30 : side === 'right' ? 70 : 50
  const y = height === 'high' ? 22 : 40
  return { x, y }
}

// Just above the crossbar — where an over-hit ball should sail.
function overBarY () {
  const stage = document.querySelector('#penaltyStage')
  const frame = document.querySelector('#penaltyStage .goal-frame')
  if (stage && frame) {
    const s = stage.getBoundingClientRect(), f = frame.getBoundingClientRect()
    if (s.height > 0) return Math.max(1, Math.round(((f.top - s.top) / s.height) * 1000) / 10 - 4)
  }
  return 4
}

// ---------------- Interactive Penalty Shootout ----------------
const SHOOTOUT_TOTAL = 5
const AIM_ZONES = ['left-high', 'center-high', 'right-high', 'left-low', 'center-low', 'right-low']
const KEEPER_ROSTER = [
  { name: 'vera', team: 'no' },
  { name: 'milo', team: 'mx' },
  { name: 'lina', team: 'no' },
  { name: 'saki', team: 'jp' },
  { name: 'dado', team: 'ci' }
]

// Players waiting in the lobby (sim now; real = peers announcing on the
// `pearcup-penalty-lobby` hyperswarm topic).
const LOBBY_PLAYERS = [
  { name: 'Kaito', team: 'jp', record: '7-2', stake: 25, wait: '0:12' },
  { name: 'Mateo', team: 'ar', record: '5-4', stake: 10, wait: '0:31' },
  { name: 'Emre', team: 'ch', record: '9-1', stake: 50, wait: '0:04' },
  { name: 'Zola', team: 'ci', record: '4-3', stake: 10, wait: '1:02' }
]

// The keeper for the whole shootout is the matched opponent (falls back to the roster).
function currentOpponent () {
  if (state.match && state.match.opponent) return state.match.opponent
  const pick = KEEPER_ROSTER[(state.shootout ? state.shootout.round : 0) % KEEPER_ROSTER.length]
  return { name: pick.name, team: pick.team }
}

function sleep (ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

function ensureShootout (reset) {
  if (reset || !state.shootout || state.shootout.you === undefined) {
    // Alternating shootout: each round you SHOOT then you KEEP the opponent's shot.
    state.shootout = { round: 0, mode: 'shoot', you: 0, opp: 0, youDots: [], oppDots: [], phase: 'aim', busy: false, lastResult: null }
  }
  return state.shootout
}

function powerToBand (pct) { return pct < 40 ? 1 : pct < 62 ? 2 : pct < 85 ? 3 : 4 }

// ---- Kick outcome model (shared by AI matches and peer matches) ----
// Deterministic: outcome is a pure function of (aim, dive, power, entropy). In peer
// matches the entropy comes from hash(aim|dive|nonce) with the shooter's revealed
// nonce, so BOTH clients derive the identical result — no trust, no desync.
// Feel: aim is the core read (wrong-way keeper = goal), power is risk/reward —
//   soft  (<66)   safe but an easy save if the keeper guesses right
//   sweet (66-86) matches the striped meter zone; corners still sneak through
//   blast (>=86)  can burst through a matched dive… but >=92 on a HIGH aim
//                 risks ballooning it over the bar.
function kickOutcome (aim, dive, powerPct, entropy) {
  const e = entropy % 100                     // over-the-bar roll
  const e2 = Math.floor(entropy / 100) % 100  // independent burst/sneak roll
  const high = aim.indexOf('high') !== -1
  const matched = dive === aim
  if (powerPct >= 92 && high && e < 45) return 'post'
  if (!matched) return 'goal'
  if (powerPct >= 86) return e2 < 45 ? 'goal' : 'save'
  if (powerPct >= 66) return e2 < 18 ? 'goal' : 'save'
  return 'save'
}

function kickEntropy (aim, dive, nonce) {
  const s = `${aim}|${dive}|${nonce}`
  const h = (window.PearCupPeerNet && window.PearCupPeerNet.digest) ? parseInt(window.PearCupPeerNet.digest(s), 16) : hashString(s)
  return h >>> 0
}

// AI keeper skill from the opponent's lobby record (e.g. '9-1' → hard to beat).
function opponentDifficulty (pick) {
  const rec = (pick && pick.record) || ((LOBBY_PLAYERS.find(p => p.name === (pick && pick.name)) || {}).record)
  if (!rec) return 0.34
  const parts = String(rec).split('-').map(Number)
  const w = parts[0]; const l = parts[1]
  if (!(w >= 0) || !(l >= 0) || w + l === 0) return 0.34
  return 0.25 + 0.35 * (w / (w + l))
}

function aiKeeperDive (aim, matchP = 0.34) {
  if (Math.random() < matchP) return aim
  const options = AIM_ZONES.filter(zone => zone !== aim)
  return options[Math.floor(Math.random() * options.length)]
}

function buildKickRound (aim, powerPct) {
  const pick = currentOpponent()
  const dive = aiKeeperDive(aim, opponentDifficulty(pick))
  const nonce = `${(Math.random() * 1e9 | 0).toString(36)}${(Math.random() * 1e9 | 0).toString(36)}`
  const outcome = kickOutcome(aim, dive, powerPct, kickEntropy(aim, dive, nonce))
  // Shape the commit-reveal resolver inputs so the QVAC settlement reproduces this
  // exact outcome (resolver: save if matched && gap<=2, post if band4+curve2+high):
  //   save         → matched dive, on time (gap 1)
  //   matched goal → keeper got a hand but was late (gap 3)
  //   post         → overcooked (band 4, curve 2) — only reachable on high aims
  const over = outcome === 'post'
  return {
    shooter: state.username || 'captain',
    shooterTeam: state.team,
    keeper: pick.name,
    keeperTeam: pick.team,
    aim,
    dive,
    power: over ? 4 : powerToBand(powerPct),
    curve: over ? 2 : 0,
    releaseTick: 42,
    keeperTick: outcome === 'save' ? 43 : dive === aim ? 45 : 47,
    plannedOutcome: outcome
  }
}

function payoutRecipientForResolvedRound (round, resolved) {
  if (!round) return {}
  const resolvedWinner = resolved && PearCupCore.winnerUserIdForRoundResult
    ? PearCupCore.winnerUserIdForRoundResult(resolved)
    : null
  const outcome = resolved && resolved.outcome || round.plannedOutcome
  const winnerId = resolvedWinner || (outcome === 'goal'
    ? gameUserId(round.shooter)
    : gameUserId(round.keeper))
  if (!winnerId) return {}
  return { [winnerId]: demoPayoutAddress(winnerId) }
}

function readPowerPct () {
  const fill = $('#shootPowerFill')
  const track = $('#shootPowerTrack')
  if (!fill || !track) return 60
  const w = fill.getBoundingClientRect().width
  const t = track.getBoundingClientRect().width || 1
  return Math.max(4, Math.min(100, Math.round((w / t) * 100)))
}

function setScoreboard (sName, sTeam, kName, kTeam, top, mid, sub) {
  $('#gameScoreboard').innerHTML = `
    <div class="game-player-card">
      ${avatarSvg(sName, sTeam, true)}
      <div><span>Shooter</span><strong>${escapeHtml(sName)}</strong><em>${sTeam.flag} ${escapeHtml(sTeam.name)}</em></div>
    </div>
    <div class="game-score-core">
      <span>${escapeHtml(top)}</span><strong>${escapeHtml(mid)}</strong><em>${escapeHtml(sub)}</em>
    </div>
    <div class="game-player-card is-away">
      ${avatarSvg(kName, kTeam, true)}
      <div><span>Keeper</span><strong>${escapeHtml(kName)}</strong><em>${kTeam.flag} ${escapeHtml(kTeam.name)}</em></div>
    </div>`
}

function ensureShootoutDom () {
  const stage = $('#penaltyStage')
  if (!stage) return
  if (!$('#shootoutHud')) {
    stage.insertAdjacentHTML('beforebegin', `
      <div class="shootout-hud" id="shootoutHud">
        <div class="hud-side">
          <span class="hud-side-name">You</span>
          <div class="hud-dots" id="hudDotsYou"></div>
        </div>
        <div class="hud-core">
          <strong class="hud-score-num" id="hudYou">0</strong>
          <span class="hud-round" id="hudKick">Round 1 of ${SHOOTOUT_TOTAL}</span>
          <strong class="hud-score-num is-opp" id="hudOpp">0</strong>
        </div>
        <div class="hud-side is-away">
          <span class="hud-side-name" id="hudOppName">Rival</span>
          <div class="hud-dots" id="hudDotsOpp"></div>
        </div>
      </div>`)
  }
  if (!$('#aimGrid')) {
    stage.insertAdjacentHTML('beforeend', `
      <div class="aim-grid" id="aimGrid" aria-label="Pick where to shoot">
        ${AIM_ZONES.map(zone => `<button class="aim-zone" type="button" data-zone="${zone}" aria-label="Aim ${zone.replace('-', ' ')}"><span></span></button>`).join('')}
      </div>
      <div class="power-dock" id="powerDock">
        <span class="power-label">Power &amp; timing — click a corner to shoot</span>
        <div class="power-track" id="shootPowerTrack"><i class="power-fill" id="shootPowerFill"></i><b class="power-sweet"></b></div>
      </div>
      <div class="confetti-burst" id="confettiBurst" aria-hidden="true"></div>
      <div class="shoot-banner" id="shootBanner" aria-live="polite"></div>
      <div class="shootout-over" id="shootoutOver" hidden>
        <div class="shootout-over-card">
          <img class="over-trophy" id="overTrophy" src="assets/trophy.png" alt="" hidden>
          <p class="over-title" id="overTitle"></p>
          <p class="over-score" id="overScore"></p>
          <p class="over-prize" id="overPrize"></p>
          <div class="over-actions">
            <button class="secondary-button" id="backToLobby" type="button">Back to lobby</button>
            <button class="primary-button" id="playAgain" type="button">Rematch</button>
          </div>
        </div>
      </div>`)
  }
  const actions = $('.game-actions')
  if (actions && !$('#leaveGameToLobby')) {
    const lobby = document.createElement('button')
    lobby.className = 'secondary-button'
    lobby.id = 'leaveGameToLobby'
    lobby.type = 'button'
    lobby.innerHTML = `
      <span class="button-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-5h-4v5H5a1 1 0 0 1-1-1Z"/></svg>
      </span>
      Lobby`
    actions.insertBefore(lobby, actions.firstChild)
  }
  const grid = $('#aimGrid')
  if (grid && !grid.dataset.bound) {
    grid.dataset.bound = '1'
    grid.addEventListener('click', event => {
      const zone = event.target.closest('.aim-zone')
      if (!zone) return
      if (window.PearCupPeerMatch && window.PearCupPeerMatch.isActive()) window.PearCupPeerMatch.onZone(zone.dataset.zone)
      else takeKick(zone.dataset.zone)
    })
  }
  const again = $('#playAgain')
  if (again && !again.dataset.bound) {
    again.dataset.bound = '1'
    again.addEventListener('click', () => {
      restartShootout({ message: '' })
    })
  }
  const back = $('#backToLobby')
  if (back && !back.dataset.bound) { back.dataset.bound = '1'; back.addEventListener('click', leaveMatch) }
  const lobby = $('#leaveGameToLobby')
  if (lobby && !lobby.dataset.bound) { lobby.dataset.bound = '1'; lobby.addEventListener('click', leaveMatch) }
  ;[['#advanceGameRound', 'Random kick'], ['#spectateGame', 'Rematch']].forEach(([sel, label]) => {
    const btn = $(sel)
    if (btn && !btn.dataset.relabel) {
      btn.dataset.relabel = '1'
      const textNode = Array.from(btn.childNodes).find(node => node.nodeType === 3 && node.textContent.trim())
      if (textNode) textNode.textContent = label
      else btn.append(label)
    }
  })
}

function renderShootoutHud () {
  const so = state.shootout
  const over = so.round >= SHOOTOUT_TOTAL
  if ($('#hudKick')) $('#hudKick').textContent = over ? 'Full time' : `Round ${Math.min(so.round + 1, SHOOTOUT_TOTAL)} of ${SHOOTOUT_TOTAL}`
  if ($('#hudYou')) $('#hudYou').textContent = String(so.you)
  if ($('#hudOpp')) $('#hudOpp').textContent = String(so.opp)
  if ($('#hudOppName')) $('#hudOppName').textContent = currentOpponent().name
  // Your shots: goal = green, miss = pink. Active if it's your turn to shoot this round.
  if ($('#hudDotsYou')) {
    $('#hudDotsYou').innerHTML = Array.from({ length: SHOOTOUT_TOTAL }, (_, i) => {
      const r = so.youDots[i]
      const cls = r === 'goal' ? 'is-goal' : r === 'miss' ? 'is-miss' : (!over && i === so.round && so.mode === 'shoot' ? 'is-next' : '')
      return `<i class="hud-dot ${cls}"></i>`
    }).join('')
  }
  // Their shots from your keeper POV: save (you stopped it) = green, goal (they scored) = pink.
  if ($('#hudDotsOpp')) {
    $('#hudDotsOpp').innerHTML = Array.from({ length: SHOOTOUT_TOTAL }, (_, i) => {
      const r = so.oppDots[i]
      const cls = r === 'save' ? 'is-goal' : r === 'goal' ? 'is-miss' : (!over && i === so.round && so.mode === 'keep' ? 'is-next' : '')
      return `<i class="hud-dot ${cls}"></i>`
    }).join('')
  }
}

function showAimGrid () { const g = $('#aimGrid'); if (g) g.classList.add('is-live') }
function hideAimGrid () { const g = $('#aimGrid'); if (g) g.classList.remove('is-live') }
function startPowerMeter () { const f = $('#shootPowerFill'); if (f) f.classList.add('is-live') }
function stopPowerMeter () { const f = $('#shootPowerFill'); if (f) f.classList.remove('is-live') }
function hideOverlay () { const o = $('#shootoutOver'); if (o) o.hidden = true }
function showShootBanner (label, tone) {
  const b = $('#shootBanner')
  if (!b) return
  b.textContent = label
  b.className = `shoot-banner is-show ${tone}`
}
function hideShootBanner () { const b = $('#shootBanner'); if (b) b.className = 'shoot-banner' }
function fireConfetti () {
  const el = $('#confettiBurst')
  if (!el) return
  el.classList.remove('is-on')
  void el.offsetWidth
  el.classList.add('is-on')
}

function startAimPhase () {
  const so = ensureShootout()
  if (so.round >= SHOOTOUT_TOTAL) return
  so.phase = 'aim'
  const opp = currentOpponent()
  const you = { name: state.username || 'captain', team: state.team }
  const isShoot = so.mode === 'shoot'
  // In shoot mode you are the shooter (bottom) and the rival keeps (top).
  // In keep mode the rival shoots (bottom) and YOU are the keeper (top).
  const shooterP = isShoot ? you : { name: opp.name, team: opp.team }
  const keeperP = isShoot ? { name: opp.name, team: opp.team } : you
  const sTeam = teamById(shooterP.team)
  const kTeam = teamById(keeperP.team)
  const ball = $('#gameBall')
  const keeper = $('#gameKeeper')
  const shooter = $('#gameShooter')
  if (shooter) shooter.innerHTML = avatarSvg(shooterP.name, sTeam)
  if (shooter) shooter.classList.remove('lean-left', 'lean-right', 'lean-center')
  if (keeper) { keeper.innerHTML = avatarSvg(keeperP.name, kTeam); keeper.style.left = '50%'; keeper.classList.remove('dive-left', 'dive-right', 'dive-mid') }
  if (ball) { ball.classList.remove('is-kicking'); ball.style.left = '50%'; ball.style.top = '80%' }
  if (!isShoot) {
    // Keeper turn vs AI: the striker decides NOW and telegraphs it in the run-up.
    // Better strikers disguise the lean more often (a feint points the wrong way).
    const diff = opponentDifficulty(opp)
    so.aiAim = AIM_ZONES[Math.floor(Math.random() * AIM_ZONES.length)]
    so.aiPower = Math.round(55 + diff * 45)
    const feint = Math.random() < (0.12 + 0.35 * diff)
    const side = z => z.indexOf('left') !== -1 ? 'left' : z.indexOf('right') !== -1 ? 'right' : 'center'
    const flip = { left: 'right', right: 'left', center: Math.random() < 0.5 ? 'left' : 'right' }
    const tell = feint ? flip[side(so.aiAim)] : side(so.aiAim)
    if (shooter) setTimeout(() => shooter.classList.add(`lean-${tell}`), 650)
  }
  setScoreboard(shooterP.name, sTeam, keeperP.name, kTeam,
    `Round ${so.round + 1} of ${SHOOTOUT_TOTAL}`,
    isShoot ? 'Your shot' : `${opp.name} shoots`,
    isShoot ? 'Pick a corner' : 'Dive to save!')
  const dock = $('#powerDock')
  if (dock) {
    dock.classList.toggle('is-keep', !isShoot)
    const label = dock.querySelector('.power-label')
    if (label) label.innerHTML = isShoot ? 'Power — sweet spot is safe, full blast can burst through… or balloon over' : 'Watch the run-up — the striker leans before the strike (don\'t trust every lean)'
  }
  hideShootBanner()
  showAimGrid()
  if (isShoot) startPowerMeter(); else stopPowerMeter()
  renderShootoutHud()
}

async function takeKick (zone) {
  const so = state.shootout
  if (!so || so.busy || so.phase !== 'aim') return
  so.busy = true
  so.phase = 'shooting'
  hideAimGrid()
  const isShoot = so.mode === 'shoot'
  const keeperEl = $('#gameKeeper')
  const ballEl = $('#gameBall')
  let good = false
  let label = ''
  let tone = 'is-stop'
  let result = null

  if (isShoot) {
    // You shoot; the rival keeper (top) dives.
    const powerPct = readPowerPct()
    stopPowerMeter()
    const round = buildKickRound(zone, powerPct)
    const aimPos = zonePosition(zone)
    const divePos = zonePosition(round.dive)
    requestAnimationFrame(() => {
      if (keeperEl) {
        keeperEl.style.left = `${divePos.x}%`
        keeperEl.classList.add(divePos.x < 50 ? 'dive-left' : divePos.x > 50 ? 'dive-right' : 'dive-mid')
      }
    })
    try {
      result = await resolvePenaltyRound(round)
    } catch (err) {
      console.warn('penalty settlement failed', err)
      renderSettlementError($('#gameResolver'), err, 'Penalty settlement blocked')
      showToast('Settlement evidence blocked — check resolver panel')
      result = null
    }
    const outcome = result ? result.outcome : round.plannedOutcome
    // The resolver inputs were shaped to reproduce plannedOutcome — flag drift loudly.
    if (result && result.outcome !== round.plannedOutcome) console.warn('kick outcome drift', { planned: round.plannedOutcome, settled: result.outcome, round })
    let bx = aimPos.x, by = aimPos.y
    if (outcome === 'post') by = overBarY()
    if (outcome === 'save') { bx = divePos.x; by = Math.min(aimPos.y, divePos.y) }
    if (ballEl) { ballEl.classList.add('is-kicking'); requestAnimationFrame(() => { ballEl.style.left = `${bx}%`; ballEl.style.top = `${by}%` }) }
    await sleep(720)
    good = outcome === 'goal'
    label = good ? 'GOAL!' : outcome === 'save' ? 'SAVED!' : 'OVER!'
    if (good) so.you += 1
    so.youDots.push(good ? 'goal' : 'miss')
    so.lastResult = result
    if (result) applyKickResult(result)
  } else {
    // Rival shoots; YOU are the keeper (top) — `zone` is where you dive. The AI's aim
    // and power were decided at the start of the run-up (see startAimPhase telegraph),
    // and the SAME kickOutcome model applies: your correct read can still be burst
    // through by a blast, and blasted high shots can balloon over.
    const aiAim = so.aiAim || AIM_ZONES[Math.floor(Math.random() * AIM_ZONES.length)]
    const aiPower = so.aiPower || 70
    const nonce = `${(Math.random() * 1e9 | 0).toString(36)}`
    const outcome = kickOutcome(aiAim, zone, aiPower, kickEntropy(aiAim, zone, nonce))
    const aimPos = zonePosition(aiAim)
    const divePos = zonePosition(zone)
    requestAnimationFrame(() => {
      if (keeperEl) {
        keeperEl.style.left = `${divePos.x}%`
        keeperEl.classList.add(divePos.x < 50 ? 'dive-left' : divePos.x > 50 ? 'dive-right' : 'dive-mid')
      }
    })
    let bx = aimPos.x, by = aimPos.y
    if (outcome === 'post') by = overBarY()
    if (outcome === 'save') { bx = divePos.x; by = Math.min(aimPos.y, divePos.y) }
    if (ballEl) { ballEl.classList.add('is-kicking'); requestAnimationFrame(() => { ballEl.style.left = `${bx}%`; ballEl.style.top = `${by}%` }) }
    await sleep(720)
    good = outcome !== 'goal' // save or over-the-bar both go your way
    label = outcome === 'save' ? 'SAVED!' : outcome === 'post' ? 'OVER THE BAR!' : 'GOAL!'
    if (outcome === 'goal') so.opp += 1
    so.oppDots.push(outcome === 'goal' ? 'goal' : 'save')
  }

  showShootBanner(label, good ? 'is-goal' : 'is-stop')
  if (good) fireConfetti()
  renderShootoutHud()
  showToast(result ? `QVAC ref sealed ${result.outcome} · ${String(result.stateHash).slice(0, 10)}` : label)
  await sleep(1150)
  hideShootBanner()
  if (ballEl) ballEl.classList.remove('is-kicking')
  if (keeperEl) keeperEl.classList.remove('dive-left', 'dive-right', 'dive-mid')
  so.busy = false
  // Advance: shoot -> keep (same round); keep -> next round, back to shoot.
  if (so.mode === 'shoot') so.mode = 'keep'
  else { so.mode = 'shoot'; so.round += 1 }
  if (so.round >= SHOOTOUT_TOTAL && so.mode === 'shoot') endShootout()
  else startAimPhase()
}

function endShootout () {
  const so = state.shootout
  so.phase = 'over'
  hideAimGrid()
  stopPowerMeter()
  const pick = currentOpponent()
  const win = so.you > so.opp
  const draw = so.you === so.opp
  const title = $('#overTitle')
  const score = $('#overScore')
  const overlay = $('#shootoutOver')
  const stake = state.match && state.match.stake || 0
  const prizeEl = $('#overPrize')
  if (win && stake > 0) {
    const prize = stake * 2
    state.wallet.balance += prize
    walletLog(`Won penalty match vs ${pick.name}`, prize, 'credit')
    persist(); refreshWallet()
    if (prizeEl) { prizeEl.textContent = `+ ${fmtMoney(prize)} won 💰`; prizeEl.className = 'over-prize is-win' }
  } else if (draw && stake > 0) {
    state.wallet.balance += stake
    walletLog(`Penalty match drawn vs ${pick.name} — stake refunded`, stake, 'credit')
    persist(); refreshWallet()
    if (prizeEl) { prizeEl.textContent = `${fmtMoney(stake)} stake refunded`; prizeEl.className = 'over-prize' }
  } else if (prizeEl) {
    prizeEl.textContent = stake > 0 ? `− ${fmtMoney(stake)} staked` : ''
    prizeEl.className = 'over-prize'
  }
  if (title) { title.textContent = win ? 'You win! 🎉' : draw ? 'Dead level!' : 'So close!'; title.className = 'over-title ' + (win ? 'is-win' : 'is-lose') }
  if (score) score.textContent = `You ${so.you} – ${so.opp} ${pick.name}`
  const trophy = $('#overTrophy'); if (trophy) trophy.hidden = !win
  if (win) fireConfetti()
  if (overlay) overlay.hidden = false
  setScoreboard(state.username || 'captain', teamById(state.team), pick.name, teamById(pick.team), 'Shootout', win ? 'WINNER' : draw ? 'DRAW' : 'DEFEAT', `You ${so.you} – ${so.opp}`)
  showToast(win ? `You beat ${pick.name} ${so.you}–${so.opp}!` : draw ? `Level with ${pick.name} ${so.you}–${so.opp}` : `${pick.name} won ${so.opp}–${so.you}`)
}

function renderGameLeaderboard () {
  $('#gameLeaderboard').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Games</p>
      <strong>${integrationRuntime.readiness.settlement.realMoneyEnabled ? 'Trusted results' : 'Demo results'}</strong>
    </div>
    <div class="leader-list">
      ${gameLeaderboardRows.map((row, index) => `
        <div class="game-leader-row">
          <span class="leader-rank">${index + 1}</span>
          ${avatarSvg(row.user === 'captain' ? (state.username || 'captain') : row.user, teamById(row.team), true)}
          <div>
            <strong>${escapeHtml(row.user === 'captain' ? (state.username || 'captain') : row.user)}</strong>
            <span>${row.record} record</span>
          </div>
          <em>${row.trust}</em>
        </div>
      `).join('')}
    </div>`
}

function renderGamePlaceholders () {
  const ph = (title, sub) => `<div class="rail-header"><p class="eyebrow">${title}</p><strong>${sub}</strong></div><p class="live-copy">Take a kick to generate a QVAC-signed, WDK-escrowed settlement.</p>`
  $('#gameResolver').innerHTML = ph('Resolver', 'Awaiting kick')
  $('#gameSync').innerHTML = ph('P2P sync', 'Idle')
  $('#gameReplay').innerHTML = ph('Replay log', '0 events')
  $('#runtimePanel').innerHTML = ph('Runtime', 'Ready')
  $('#tetherPanel').innerHTML = ph('Tether WDK', 'Escrow ready')
  $('#qvacRefPanel').innerHTML = ph('QVAC', 'Referee standby')
  renderGameLeaderboard()
}

function peerBackendInfo () {
  const backend = document.documentElement.dataset.pearcupPeerNet || ''
  if (backend === 'pearbrowser-swarm-v1') return { label: 'P2P PearBrowser swarm', tone: 'is-online' }
  if (backend === 'hyperswarm') return { label: 'P2P Pear runtime', tone: 'is-online' }
  if (backend === 'broadcast-channel') return { label: 'Local preview P2P', tone: 'is-preview' }
  if (backend === 'noop') return { label: 'P2P unavailable', tone: 'is-offline' }
  return { label: 'P2P starting', tone: 'is-preview' }
}

function renderPeerBackendBadge () {
  const el = $('#p2pBackendBadge')
  if (!el) return
  const info = peerBackendInfo()
  el.textContent = info.label
  el.className = `p2p-backend-pill ${info.tone}`
}

function pendingFriendJoinCode () {
  try {
    const raw = new URLSearchParams(location.search).get('join') || ''
    return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
  } catch (e) {
    return ''
  }
}

function tryJoinFriendInvite (attempt = 0) {
  const code = pendingFriendJoinCode()
  if (!code) return false
  document.documentElement.dataset.pearcupPendingJoin = code
  const peerMatch = window.PearCupPeerMatch
  const matchState = peerMatch && peerMatch._state
  if (matchState && matchState.active && matchState.code === code) {
    document.documentElement.dataset.pearcupJoinState = matchState.started ? 'started' : 'joining'
    setView('games')
    return true
  }
  if (peerMatch && typeof peerMatch.join === 'function') {
    document.documentElement.dataset.pearcupJoinState = 'joining'
    setView('games')
    peerMatch.join(code)
    return true
  }
  if (attempt < 6) {
    const retryMs = [0, 80, 180, 360, 720, 1200, 1800][attempt] ?? 1800
    setTimeout(() => tryJoinFriendInvite(attempt + 1), retryMs)
  } else {
    document.documentElement.dataset.pearcupJoinState = 'missing-peer-match'
  }
  return false
}

function completeProfileOnboarding () {
  const name = $('#usernameInput').value.trim()
  state.username = name || 'captain'
  persist()
  if (typeof renderProfile === 'function') renderProfile()
  else if (typeof renderAll === 'function') renderAll()
  if (pendingFriendJoinCode()) {
    setView('games')
    tryJoinFriendInvite()
    showToast(`${state.username} joined as ${teamById(state.team).name}`)
    return
  }
  setView('home')
  showToast(`${state.username} joined as ${teamById(state.team).name}`)
}

function renderGameLobby () {
  const el = $('#gameLobby')
  if (!el) return
  el.innerHTML = `
    <div class="lobby-hero">
      <img class="lobby-mascot" src="assets/mascot.png" alt="">
      <div class="lobby-hero-copy">
        <p class="eyebrow">Penalty Clash · Lobby</p>
        <h2 class="lobby-title">Find a match</h2>
        <p class="lobby-sub">Best-of-five Penalty Clash — you take 5 penalties and keep their 5. Outscore them for the win.</p>
      </div>
      <button class="lobby-quick" id="quickMatchBtn" type="button">⚡ Practice vs AI</button>
    </div>

    <div class="lobby-friend">
      <div class="lobby-friend-copy">
        <strong>Play a real friend</strong>
        <span>Peer-to-peer over the room topic — you both take penalties, live.</span>
        <span class="p2p-backend-pill" id="p2pBackendBadge">P2P starting</span>
      </div>
      <div class="lobby-friend-actions">
        <button class="secondary-button compact-action" id="joinFriendBtn" type="button">Join with code</button>
        <button class="primary-button compact-action" id="inviteFriendBtn" type="button">Invite a friend</button>
      </div>
    </div>

    <p class="lobby-label">Players online <span class="lobby-live-badge"><i></i>live</span></p>
    <div class="lobby-list" id="lobbyLivePeers"></div>

    <p class="lobby-label lobby-label-muted">AI opponents · practice free or stake up</p>
    <div class="lobby-list">
      ${LOBBY_PLAYERS.map((p, i) => `
        <div class="lobby-card">
          ${avatarSvg(p.name, teamById(p.team), true)}
          <div class="lobby-info">
            <strong>${escapeHtml(p.name)}</strong>
            <span>${teamById(p.team).flag} ${p.record} record · ${opponentDifficulty(p) > 0.5 ? 'sharp' : 'steady'} keeper</span>
          </div>
          <div class="lobby-stake">$${p.stake}</div>
          <button class="secondary-button compact-action lobby-challenge" data-lobby="${i}" type="button">Challenge</button>
        </div>`).join('')}
    </div>`
  const practice = p => ({ ...p, stake: 0 })
  const quick = $('#quickMatchBtn')
  if (quick) quick.addEventListener('click', () => startMatch(practice(LOBBY_PLAYERS[Math.floor(Math.random() * LOBBY_PLAYERS.length)])))
  $$('#gameLobby .lobby-challenge').forEach(btn => btn.addEventListener('click', () => showStakeConfirm(LOBBY_PLAYERS[Number(btn.dataset.lobby)])))
  const invite = $('#inviteFriendBtn')
  if (invite) invite.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.host())
  const joinFriend = $('#joinFriendBtn')
  if (joinFriend) joinFriend.addEventListener('click', () => window.PearCupPeerMatch && window.PearCupPeerMatch.promptJoin())
  renderPeerBackendBadge()
  // Live matchmaking: announce on the lobby topic + render online peers.
  if (window.PearCupLobby) { window.PearCupLobby.join(); window.PearCupLobby.renderList() }
}

// Staked AI challenge: explicit consent before any wallet debit (practice stays free).
function showStakeConfirm (player) {
  const old = $('#stakeConfirm'); if (old) old.remove()
  const stake = player.stake || 0
  const ov = document.createElement('div')
  ov.id = 'stakeConfirm'
  ov.className = 'peer-modal'
  ov.setAttribute('role', 'dialog')
  ov.setAttribute('aria-modal', 'true')
  ov.innerHTML = `
    <div class="peer-modal-card">
      <p class="eyebrow">Penalty Clash · Challenge</p>
      <h2 class="peer-title">${escapeHtml(player.name)} puts up ${fmtMoney(stake)}</h2>
      <p class="peer-sub">Match the stake and the winner takes ${fmtMoney(stake * 2)} — a draw refunds both. Or warm up for free.</p>
      <div class="peer-actions">
        <button class="secondary-button" id="stakePractice" type="button">Practice free</button>
        <button class="primary-button" id="stakeAccept" type="button">Stake ${fmtMoney(stake)}</button>
      </div>
    </div>`
  document.body.appendChild(ov)
  requestAnimationFrame(() => ov.classList.add('is-open'))
  const close = () => { document.removeEventListener('keydown', onKey); ov.classList.remove('is-open'); setTimeout(() => ov.remove(), 250) }
  const onKey = e => { if (e.key === 'Escape') close() }
  document.addEventListener('keydown', onKey)
  ov.addEventListener('click', e => {
    if (e.target === ov) { close(); return }
    if (e.target.closest('#stakePractice')) { close(); startMatch({ ...player, stake: 0 }) }
    if (e.target.closest('#stakeAccept')) { close(); startMatch(player) }
  })
}

function startMatch (player, joined) {
  const stake = player.stake || 0
  if (stake > 0 && !debitWallet(stake, `Penalty match stake vs ${player.name}`)) {
    showToast(`Need ${fmtMoney(stake)} to stake — fund your wallet`)
    setView('onboarding')
    return
  }
  // Carry the record so the AI keeper difficulty matches the lobby card.
  state.match = { opponent: { name: player.name, team: player.team, record: player.record }, stake }
  ensureShootout(true)
  persist()
  showToast(stake > 0
    ? `${joined ? 'Opponent found' : 'Matched'} · ${player.name} — beat them to win ${fmtMoney(stake * 2)}`
    : `${joined ? 'Opponent found' : 'Matched'} · ${player.name} — practice match, bragging rights only`)
  renderGames()
}

function leaveMatch () {
  if (state.match && state.match.peer && window.PearCupPeerMatch) { window.PearCupPeerMatch.leave(); return }
  state.match = null
  ensureShootout(true)
  persist()
  hideOverlay()
  renderGames()
}

function restartShootout ({ blockActiveStake = false, message = 'New penalty shootout — pick your corners!' } = {}) {
  // Peer match: starting over mid-room would desync the two clients, so leave cleanly.
  if (state.match && state.match.peer && window.PearCupPeerMatch) { window.PearCupPeerMatch.leave(); return false }
  const stake = state.match && state.match.stake || 0
  const so = ensureShootout()
  if (stake > 0 && blockActiveStake && so.phase !== 'over') {
    showToast('Finish this staked match before starting a rematch')
    return false
  }
  if (stake > 0 && !debitWallet(stake, `Rematch stake vs ${state.match.opponent.name}`)) {
    showToast('Not enough balance to rematch')
    leaveMatch()
    return false
  }
  ensureShootout(true)
  hideOverlay()
  renderGames()
  if (message) showToast(message)
  return true
}

async function renderGames () {
  const so = ensureShootout()
  ensureShootoutDom()
  // A live peer match owns its own turn loop.
  if (state.match && state.match.peer && window.PearCupPeerMatch) {
    const arena0 = document.querySelector('#games .game-arena')
    if (arena0) arena0.classList.remove('is-lobby')
    if (so.phase !== 'over') window.PearCupPeerMatch.render()
    return null
  }
  const arena = document.querySelector('#games .game-arena')
  if (!state.match) {
    if (arena) arena.classList.add('is-lobby')
    renderGameLobby()
    return null
  }
  if (arena) arena.classList.remove('is-lobby')
  if (so.phase === 'over') { renderShootoutHud(); if (so.lastResult) applyKickResult(so.lastResult); return so.lastResult }
  startAimPhase()
  if (so.lastResult) applyKickResult(so.lastResult)
  else renderGamePlaceholders()
  return so.lastResult
}

function applyKickResult (result) {
  const shooterTeam = teamById(result.shooterTeam)
  const keeperTeam = teamById(result.keeperTeam)
  const ball = zonePosition(result.aim)
  const keeper = zonePosition(result.dive)
  const settlement = result.runtime.settlement
  const qvac = result.runtime.qvac
  const tetherWdk = result.runtime.tetherWdk
  const compliance = result.runtime.compliance
  const escrowAmount = result.tetherEscrow.amount ?? 5
  const escrowAsset = result.tetherEscrow.asset || 'USDT'
  const payoutId = result.tetherPayout.payoutId || result.tetherPayout.disputeId || 'pending'
  const payoutStatus = result.tetherPayout.status || 'prepared'

  $('#gameResolver').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Resolver</p>
      <strong>Deterministic</strong>
    </div>
    <div class="metric-list">
      <div><span>Aim</span><strong>${result.aim}</strong></div>
      <div><span>Dive</span><strong>${result.dive}</strong></div>
      <div><span>Timing gap</span><strong>${result.timingGap} ticks</strong></div>
    </div>
  `

  $('#gameSync').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">P2P sync</p>
      <strong>${result.sync.matched ? 'Roots matched' : 'Mismatch'}</strong>
    </div>
    <div class="hash-list">
      <div><span>Shooter commit</span><code>${result.shooterCommitment}</code></div>
      <div><span>Keeper commit</span><code>${result.keeperCommitment}</code></div>
      <div><span>State hash</span><code>${result.stateHash}</code></div>
      <div><span>Game topic</span><code>${result.sync.topic}</code></div>
      <div><span>Local root</span><code>${result.sync.localRoot}</code></div>
      <div><span>Spectator root</span><code>${result.sync.spectatorRoot}</code></div>
      <div><span>Receipt hash</span><code>${escapeHtml(result.settlementReceipt && result.settlementReceipt.receiptHash || 'pending')}</code></div>
      <div><span>Storage namespace</span><code>${result.storage.namespace}</code></div>
      <div><span>Replay root</span><code>${result.storage.replayRoot}</code></div>
    </div>
  `

  $('#gameReplay').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Replay log</p>
      <strong>${result.workerEvents.length} events</strong>
    </div>
    <ol class="game-steps">
      <li>${escapeHtml(result.workerEvents[1].type)} and ${escapeHtml(result.workerEvents[2].type)} over Pear game topic.</li>
      <li>${escapeHtml(result.workerEvents[3].type)} events verified against nonces.</li>
      <li>${escapeHtml(result.workerEvents[6].type)} signed ${result.outcome} ruling.</li>
      <li>${escapeHtml(result.workerEvents[7].type)} prepared WDK payout.</li>
      <li>${escapeHtml(result.settlementReceiptEvent && result.settlementReceiptEvent.type || 'SettlementReceiptCreated')} sealed ${escapeHtml(result.settlementReceipt && result.settlementReceipt.receiptHash || 'pending')}.</li>
      <li>Spectator peer merged ${result.sync.spectatorMerged} events on ${result.sync.topic} and matched the event root.</li>
      <li>${result.storage.external
        ? `Pear worker bridge retained ${result.storage.persistedEvents} redacted events at ${escapeHtml(result.storage.eventRoot)}.`
        : `Stored ${result.storage.persistedEvents} events and replayed ${result.storage.replayEvents} after restart with ${result.storage.replayMatched ? 'the same root' : 'a root mismatch'}.`}
      </li>
    </ol>
  `

  $('#runtimePanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Runtime</p>
      <strong class="runtime-pill ${settlementStatusClass(settlement)}">${settlement.realMoneyEnabled ? 'Live' : 'Locked'}</strong>
    </div>
    <div class="runtime-summary ${settlementStatusClass(settlement)}">
      <span>Prize gate</span>
      <strong>${settlement.label}</strong>
      <em>${qvac.sdkReady && tetherWdk.sdkReady ? `Guard ${result.guardMode}; QVAC and WDK adapters are in SDK mode.` : `Guard ${result.guardMode}; demo adapters keep real payouts disabled.`}</em>
    </div>
    <div class="status-list compact-status">
      <div class="${result.settlementGate.liveReady ? 'is-complete' : 'is-warn'}">
        <span>Settlement guard</span>
        <strong>${result.settlementGate.status}</strong>
      </div>
      <div class="${qvac.sdkReady ? 'is-complete' : 'is-warn'}">
        <span>QVAC referee</span>
        <strong>${serviceStatusText(qvac)}</strong>
      </div>
      <div class="${tetherWdk.sdkReady ? 'is-complete' : 'is-warn'}">
        <span>Tether WDK rail</span>
        <strong>${serviceStatusText(tetherWdk)}</strong>
      </div>
      <div class="${compliance.kycVerified && compliance.jurisdictionAllowed ? 'is-complete' : 'is-warn'}">
        <span>Compliance</span>
        <strong>${settlement.realMoneyEnabled ? 'Cleared' : 'Pending'}</strong>
      </div>
    </div>
  `

  $('#tetherPanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Tether WDK</p>
      <strong>${serviceModeLabel(tetherWdk)} rail</strong>
    </div>
    <div class="settlement-card">
      <span>Prize intent</span>
      <strong>${escrowAmount} ${escrowAsset}${result.canUseRealMoney ? '' : ' demo'}</strong>
      <em>${settlement.label}; QVAC signature required</em>
    </div>
    <div class="status-list">
      <div class="${tetherWdk.sdkReady ? 'is-complete' : 'is-warn'}">
        <span>Wallet</span>
        <strong>${serviceStatusText(tetherWdk)}</strong>
      </div>
      <div class="is-complete">
        <span>Escrow</span>
        <strong>${result.tetherEscrow.status || 'locked'}</strong>
      </div>
      <div class="${qvac.sdkReady ? 'is-complete' : 'is-warn'}">
        <span>Referee</span>
        <strong>${serviceStatusText(qvac)}</strong>
      </div>
      <div class="${payoutStatus === 'prepared' ? 'is-complete' : 'is-warn'}">
        <span>Settlement</span>
        <strong>${payoutStatus}</strong>
      </div>
      <div class="is-complete">
        <span>Escrow ID</span>
        <code>${result.tetherEscrow.escrowId}</code>
      </div>
      <div>
        <span>Payout ID</span>
        <code>${payoutId}</code>
      </div>
    </div>
  `

  $('#qvacRefPanel').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">QVAC</p>
      <strong>${serviceModeLabel(qvac)} AI referee</strong>
    </div>
    <div class="referee-verdict">
      <span>${result.outcomeLabel}</span>
      <p>${escapeHtml(result.qvacAttestation.rationale)} The deterministic resolver produced ${result.outcome}; QVAC signs the result hash for settlement.</p>
      <code>${result.qvacAttestation.attestationId}</code>
      <code>${result.stateHash}</code>
    </div>
  `

  $('#gameLeaderboard').innerHTML = `
    <div class="rail-header">
      <p class="eyebrow">Games</p>
      <strong>${integrationRuntime.readiness.settlement.realMoneyEnabled ? 'Trusted results' : 'Demo results'}</strong>
    </div>
    <div class="leader-list">
      ${gameLeaderboardRows.map((row, index) => `
        <div class="game-leader-row">
          <span class="leader-rank">${index + 1}</span>
          ${avatarSvg(row.user === 'captain' ? (state.username || 'captain') : row.user, teamById(row.team), true)}
          <div>
            <strong>${escapeHtml(row.user === 'captain' ? (state.username || 'captain') : row.user)}</strong>
            <span>${row.record} record</span>
          </div>
          <em>${row.trust}</em>
        </div>
      `).join('')}
    </div>
  `
  return result
}

function remainingPicks () {
  return bracketMatchIds.filter(id => !state.picks[id]).length
}

function bindViewButtons (root = document) {
  $$('[data-view]', root).forEach(button => {
    if (button.dataset.viewBound) return
    button.dataset.viewBound = 'true'
    button.addEventListener('click', () => setView(button.dataset.view))
  })
}

function bindCoreFallbackEvents () {
  if (document.documentElement.dataset.coreFallbackBound) return
  document.documentElement.dataset.coreFallbackBound = 'true'

  document.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view]')
    if (viewButton && viewButton.dataset.view) {
      event.preventDefault()
      event.stopPropagation()
      setView(viewButton.dataset.view)
      return
    }

    const teamButton = event.target.closest('#teamGrid .team-card[data-team]')
    if (teamButton) {
      event.preventDefault()
      event.stopPropagation()
      state.team = teamButton.dataset.team
      persist()
      $$('#teamGrid .team-card').forEach(button => {
        const selected = button.dataset.team === state.team
        button.classList.toggle('is-selected', selected)
        button.setAttribute('aria-pressed', String(selected))
      })
      renderProfile()
      return
    }

    const saveButton = event.target.closest('#saveProfile')
    if (saveButton) {
      event.preventDefault()
      event.stopPropagation()
      completeProfileOnboarding()
    }
  }, true)

  document.addEventListener('input', event => {
    if (event.target && event.target.id === 'usernameInput') {
      state.username = event.target.value.trim() || 'captain'
      persist()
      renderProfile()
    }
  }, true)
}

function bindEvents () {
  sendBootCheckpoint('bindEvents:start')
  bindViewButtons()
  sendBootCheckpoint('bindEvents:view-buttons')

  $('#usernameInput').addEventListener('input', event => {
    state.username = event.target.value.trim() || 'captain'
    persist()
    renderProfile()
  })

  $('#saveProfile').addEventListener('click', () => {
    completeProfileOnboarding()
  })
  sendBootCheckpoint('bindEvents:profile')

  $('#resetPicks').addEventListener('click', () => {
    state.picks = {}
    persist()
    renderBracket()
    showToast('Bracket picks cleared')
  })

  $('#submitPicks').addEventListener('click', () => {
    const remaining = remainingPicks()
    if (remaining > 0) {
      showToast(`${remaining} picks left before this bracket is sealed`)
      return
    }
    showToast(`$${state.selectedTier} bracket submitted for ${state.username}`)
  })
  sendBootCheckpoint('bindEvents:bracket')

  $('#voiceToggle').addEventListener('click', () => {
    state.voice = !state.voice
    persist()
    $('#voiceToggle').classList.toggle('is-live', state.voice)
    showToast(state.voice ? 'Voice chat unmuted' : 'Voice chat muted')
  })

  $('#shareScreenBtn').addEventListener('click', toggleScreenShare)
  $('#shareGameBtn').addEventListener('click', toggleInviteBar)
  const themeBtn = $('#themeBtn'); if (themeBtn) themeBtn.addEventListener('click', () => showThemePicker(false))
  sendBootCheckpoint('bindEvents:watch')

  $('#advanceGameRound').addEventListener('click', () => {
    const zone = AIM_ZONES[Math.floor(Math.random() * AIM_ZONES.length)]
    // Peer match: route through the peer controller so both clients stay in lockstep.
    if (window.PearCupPeerMatch && window.PearCupPeerMatch.isActive()) { window.PearCupPeerMatch.onZone(zone); return }
    const so = ensureShootout()
    if (so.phase === 'over') { ensureShootout(true); hideOverlay(); renderGames(); return }
    if (so.phase === 'aim' && !so.busy) takeKick(zone)
  })

  $('#spectateGame').addEventListener('click', () => {
    restartShootout({ blockActiveStake: true })
  })
  sendBootCheckpoint('bindEvents:games')

  $('#chatForm').addEventListener('submit', event => {
    event.preventDefault()
    const input = $('#chatInput')
    const text = input.value.trim()
    if (!text) return
    state.chat.push({
      user: state.username || 'you',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    })
    state.chat = state.chat.slice(-8)
    const last = state.chat[state.chat.length - 1]
    if (window.PearCupWatchSync) window.PearCupWatchSync.broadcastChat(last.user, last.text, last.time)
    input.value = ''
    persist()
    renderWatch()
  })
  sendBootCheckpoint('bindEvents:chat')
}

function renderAll () {
  sendBootCheckpoint('renderAll:start')
  renderTeams()
  renderProfile()
  sendBootCheckpoint('renderAll:shell')
  renderView(state.view || 'onboarding')
  sendBootCheckpoint('renderAll:active-view', state.view || 'onboarding')
}

function assertP2PModulesReady () {
  if (typeof window === 'undefined' || !document.documentElement) return
  const required = [
    ['PearCupPeerNet', 'pearcupPeerNetModule'],
    ['PearCupPeerMatch', 'pearcupPeerMatchModule'],
    ['PearCupLobby', 'pearcupPeerLobbyModule'],
    ['PearCupWatchSync', 'pearcupWatchSyncModule']
  ]
  const missing = []
  for (const [globalName, datasetName] of required) {
    if (!window[globalName]) missing.push(globalName)
    else if (document.documentElement.dataset[datasetName] !== 'ready') {
      missing.push(`${globalName}:${document.documentElement.dataset[datasetName] || 'unmarked'}`)
    }
  }
  if (missing.length) {
    document.documentElement.dataset.pearcupP2pModules = 'missing'
    throw new Error(`PearCup P2P modules missing: ${missing.join(', ')}`)
  }
  document.documentElement.dataset.pearcupP2pModules = 'ready'
}

function emitBootReadyMarker () {
  if (typeof window === 'undefined' || !document.documentElement) return
  const backend = document.documentElement.dataset.pearcupPeerNet || 'unknown'
  document.documentElement.dataset.pearcupBootReady = 'p2p'
  sendBootReadyProbe(backend)
  if (typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log(`[pearcup:boot-ready] p2p=ready backend=${backend}`)
  }
}

function sendBootCheckpoint (status, detail = '') {
  if (typeof window === 'undefined' || window.__pearcupBootCheckpointDebug !== true) return
  if (typeof window === 'undefined' || !document.documentElement) return
  const payload = {
    event: 'pearcup:boot-checkpoint',
    status,
    detail,
    appScriptSeen: Boolean(window.__pearcupAppScriptSeen),
    appBooted: Boolean(window.__pearcupAppBooted),
    p2pModules: document.documentElement.dataset.pearcupP2pModules || null,
    backend: document.documentElement.dataset.pearcupPeerNet || null,
    screens: Array.from(document.querySelectorAll('.screen.is-active')).map(el => el.id)
  }
  sendBootProbePayload('./boot-probe-hit.gif', payload)
  resolveBootProbeUrl().then(url => {
    if (!url || url === './boot-probe-hit.gif') return
    sendBootProbePayload(url, payload)
  }).catch(() => {})
}

function controllerReady (controller, methods) {
  return Boolean(controller && methods.every(method => typeof controller[method] === 'function'))
}

function bootRuntimeDiagnostics () {
  const avatarImages = Array.from(document.querySelectorAll('svg.avatar-art image'))
    .map(el => el.getAttribute('href') || '')
    .filter(Boolean)
  const activeScreens = Array.from(document.querySelectorAll('.screen.is-active')).map(el => el.id)
  const ds = document.documentElement.dataset

  return {
    uiHydrated: ds.pearcupUiHydrated || null,
    activeScreens,
    routeButtons: Array.from(document.querySelectorAll('[data-view]')).map(el => el.getAttribute('data-view')).filter(Boolean),
    teamCards: document.querySelectorAll('#teamGrid .team-card').length,
    avatarImages: avatarImages.slice(0, 4),
    profileChipReady: Boolean(document.querySelector('#profileChip svg.avatar-art')),
    peerMatchDataset: {
      state: ds.pearcupPeerMatchState || null,
      active: ds.pearcupPeerMatchActive || null,
      started: ds.pearcupPeerMatchStarted || null,
      code: ds.pearcupPeerMatchCode || null,
      role: ds.pearcupPeerMatchRole || null
    },
    controllers: {
      peerNet: controllerReady(window.PearCupPeerNet, ['createChannel', 'newRoomCode', 'newPeerId']),
      peerMatch: controllerReady(window.PearCupPeerMatch, ['host', 'join', 'promptJoin', 'onZone']),
      peerLobby: controllerReady(window.PearCupLobby, ['join', 'renderList']),
      watchSync: controllerReady(window.PearCupWatchSync, ['ensureRoom', 'broadcastChat', 'react'])
    }
  }
}

function sendBootProbeEvent (payload) {
  sendBootProbePayload('./boot-probe-hit.gif', payload)
  resolveBootProbeUrl().then(url => {
    if (!url || url === './boot-probe-hit.gif') return
    sendBootProbePayload(url, payload)
  }).catch(() => {})
}

function sendBootReadyProbe (backend) {
  const ds = document.documentElement.dataset
  const payload = {
    event: 'pearcup:boot-ready',
    status: 'ready',
    bootReady: ds.pearcupBootReady || null,
    p2pModules: ds.pearcupP2pModules || null,
    backend,
    appBooted: Boolean(window.__pearcupAppBooted),
    appBootedDataset: ds.pearcupAppBooted || null,
    activeScreen: ds.pearcupActiveScreen || null,
    modules: {
      net: ds.pearcupPeerNetModule || null,
      match: ds.pearcupPeerMatchModule || null,
      lobby: ds.pearcupPeerLobbyModule || null,
      watch: ds.pearcupWatchSyncModule || null
    },
    screens: Array.from(document.querySelectorAll('.screen.is-active')).map(el => el.id),
    runtime: bootRuntimeDiagnostics()
  }
  sendBootProbeEvent(payload)
}

function sendBootProbePayload (url, payload) {
  const body = JSON.stringify(payload)
  if (typeof Image === 'function') {
    window.__pearcupBootProbeImages = window.__pearcupBootProbeImages || []
    const image = new Image()
    const sep = url.indexOf('?') === -1 ? '?' : '&'
    image.src = url + sep + 'payload=' + encodeURIComponent(body)
    window.__pearcupBootProbeImages.push(image)
    setTimeout(() => {
      const list = window.__pearcupBootProbeImages || []
      const index = list.indexOf(image)
      if (index >= 0) list.splice(index, 1)
    }, 5000)
    return
  }
  if (typeof fetch === 'function') {
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body
    }).catch(() => {})
  }
}

async function resolveBootProbeUrl () {
  try {
    const config = await loadBootProbeConfig()
    return config.url || ''
  } catch (e) {
    return ''
  }
}

let bootProbeConfigPromise = null
function loadBootProbeConfig () {
  if (bootProbeConfigPromise) return bootProbeConfigPromise
  bootProbeConfigPromise = (async () => {
    const env = (typeof process !== 'undefined' && process && process.env) || null
    const config = {}
    const direct = normalizeBootProbeUrl(env && env.PEARCUP_BOOT_PROBE_URL)
    if (direct) config.url = direct
    if (truthyEnv(env && env.PEARCUP_BOOT_PROBE_RUNTIME_SELF_TEST)) config.runtimeSelfTest = true
    const delay = Number(env && env.PEARCUP_BOOT_PROBE_RUNTIME_SELF_TEST_DELAY_MS)
    if (Number.isFinite(delay) && delay >= 0) config.runtimeSelfTestDelayMs = delay
    if (typeof fetch === 'function') {
      try {
        const res = await fetch('./boot-probe.json', { cache: 'no-store' })
        if (res && res.ok) {
          const fileConfig = await res.json()
          if (fileConfig && typeof fileConfig === 'object') Object.assign(config, fileConfig)
        }
      } catch (e) {}
    }
    config.url = normalizeBootProbeUrl(config.url) || ''
    return config
  })()
  return bootProbeConfigPromise
}

function truthyEnv (value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

function normalizeBootProbeUrl (raw) {
  if (!raw) return ''
  if (raw === './boot-probe-hit.gif' || raw.indexOf('./boot-probe-hit.gif?') === 0) return raw
  if (raw === '/boot-probe-hit.gif' || raw.indexOf('/boot-probe-hit.gif?') === 0) return raw
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:') return ''
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) return ''
    return parsed.href
  } catch (e) {
    return ''
  }
}

function runtimeSelfTestSnapshot (status, errors = [], extra = {}) {
  const active = document.querySelector('.screen.is-active')
  const modal = document.querySelector('#peerModal')
  const link = modal ? modal.querySelector('.peer-link code') : null
  const modalCode = modal && modal.querySelector('.peer-code')
  const peerState = window.PearCupPeerMatch && window.PearCupPeerMatch._state
  const activeAvatarImages = active
    ? Array.from(active.querySelectorAll('svg.avatar-art image')).map(el => el.getAttribute('href') || '').filter(Boolean).slice(0, 6)
    : []
  return {
    event: 'pearcup:runtime-self-test',
    status,
    errors,
    bootReady: document.documentElement.dataset.pearcupBootReady || null,
    p2pModules: document.documentElement.dataset.pearcupP2pModules || null,
    appBootedDataset: document.documentElement.dataset.pearcupAppBooted || null,
    backend: document.documentElement.dataset.pearcupPeerNet || null,
    activeScreen: active ? active.id : null,
    activeScreenDataset: document.documentElement.dataset.pearcupActiveScreen || null,
    activeNav: Array.from(document.querySelectorAll('.topnav button.is-active')).map(el => el.textContent.trim()),
    hasGamesLobby: Boolean(document.querySelector('#gameLobby')),
    hasLobbyMascot: Boolean(active && active.querySelector('img.lobby-mascot[src="assets/mascot.png"]')),
    p2pBackendBadge: (document.querySelector('#p2pBackendBadge') && document.querySelector('#p2pBackendBadge').textContent.trim()) || '',
    generatedAvatarImages: activeAvatarImages,
    inviteModalOpen: Boolean(modal) || extra.inviteModalOpen === true,
    inviteCode: (modalCode && modalCode.textContent.trim()) || extra.inviteCode || '',
    inviteLink: (link && link.textContent.trim()) || extra.inviteLink || '',
    peerMatch: peerState
      ? {
          active: Boolean(peerState.active),
          started: Boolean(peerState.started),
          code: peerState.code || '',
          role: peerState.role || ''
        }
      : null,
    peerHandshake: extra.peerHandshake || null,
    runtime: bootRuntimeDiagnostics()
  }
}

function runtimeSelfTestGuestUrl (code) {
  const url = new URL(location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('join', code)
  url.searchParams.set('pearcupRuntimeSelfTestGuest', '1')
  return url.toString()
}

function runtimeSelfTestGuestSnapshot (iframe) {
  const win = iframe && iframe.contentWindow
  const doc = iframe && iframe.contentDocument
  const peerState = win && win.PearCupPeerMatch && win.PearCupPeerMatch._state
  const ds = doc && doc.documentElement && doc.documentElement.dataset || {}
  return {
    url: win && win.location ? win.location.href : '',
    booted: ds.pearcupBooted || null,
    bootReady: ds.pearcupBootReady || null,
    p2pModules: ds.pearcupP2pModules || null,
    appBootedDataset: ds.pearcupAppBooted || null,
    joinState: ds.pearcupJoinState || null,
    activeScreen: doc && doc.querySelector('.screen.is-active') ? doc.querySelector('.screen.is-active').id : null,
    activeScreenDataset: ds.pearcupActiveScreen || null,
    bootError: doc && doc.querySelector('#bootErrorBar') ? doc.querySelector('#bootErrorBar').textContent : null,
    peerMatch: peerState
      ? {
          active: Boolean(peerState.active),
          started: Boolean(peerState.started),
          code: peerState.code || '',
          role: peerState.role || ''
        }
      : null
  }
}

function runRuntimePeerHandshakeSelfTest (code) {
  return new Promise(resolve => {
    if (!code || !document.body || typeof document.createElement !== 'function') {
      resolve({ started: false, reason: 'iframe unavailable', guest: null })
      return
    }
    const iframe = document.createElement('iframe')
    iframe.title = 'PearCup runtime peer self-test guest'
    iframe.setAttribute('aria-hidden', 'true')
    iframe.tabIndex = -1
    iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-10000px;top:-10000px;border:0;opacity:0;pointer-events:none'
    iframe.src = runtimeSelfTestGuestUrl(code)
    document.body.appendChild(iframe)

    const startedAt = Date.now()
    let last = { started: false, reason: 'waiting for guest', guest: null }
    const finish = result => {
      try { iframe.remove() } catch (e) {}
      resolve(result)
    }
    const poll = () => {
      let guest = null
      try {
        guest = runtimeSelfTestGuestSnapshot(iframe)
      } catch (err) {
        last = { started: false, reason: err && err.message ? err.message : String(err), guest: null }
      }
      const hostState = window.PearCupPeerMatch && window.PearCupPeerMatch._state
      const hostStarted = Boolean(hostState && hostState.started && hostState.code === code)
      const guestStarted = Boolean(guest && guest.peerMatch && guest.peerMatch.started && guest.peerMatch.code === code)
      if (hostStarted && guestStarted) {
        finish({
          started: true,
          host: {
            active: Boolean(hostState.active),
            started: Boolean(hostState.started),
            code: hostState.code || '',
            role: hostState.role || ''
          },
          guest
        })
        return
      }
      if (guest) last = { started: false, reason: 'waiting for peer handshake', guest }
      if (Date.now() - startedAt > 8000) {
        finish(last)
        return
      }
      setTimeout(poll, 120)
    }
    setTimeout(poll, 120)
  })
}

function isRuntimeSelfTestGuest () {
  try {
    return new URLSearchParams(location.search).get('pearcupRuntimeSelfTestGuest') === '1'
  } catch (e) {
    return false
  }
}

async function runBootRuntimeSelfTest () {
  const errors = []
  const evidence = {}
  try {
    if (document.documentElement.dataset.pearcupBootReady !== 'p2p') errors.push('bootReady was not p2p')
    if (document.documentElement.dataset.pearcupP2pModules !== 'ready') errors.push('P2P modules were not ready')
    if (!window.PearCupPeerMatch || typeof window.PearCupPeerMatch.host !== 'function') errors.push('PearCupPeerMatch.host missing')
    setView('games')
    const active = document.querySelector('.screen.is-active')
    if (!active || active.id !== 'games') errors.push('Games route did not become active')
    if (!document.querySelector('#inviteFriendBtn')) errors.push('Invite button did not render')
    if (!document.querySelector('img.lobby-mascot[src="assets/mascot.png"]')) errors.push('Lobby mascot did not render')
    const avatarImages = Array.from(document.querySelectorAll('#games svg.avatar-art image')).map(el => el.getAttribute('href') || '')
    if (!avatarImages.some(src => /avatars\//.test(src))) errors.push('Games view did not render generated avatar images')
    if (window.PearCupPeerMatch && typeof window.PearCupPeerMatch.host === 'function') {
      window.PearCupPeerMatch.host()
    }
    const modal = document.querySelector('#peerModal')
    const code = modal && modal.querySelector('.peer-code')
    const link = modal && modal.querySelector('.peer-link code')
    const peerState = window.PearCupPeerMatch && window.PearCupPeerMatch._state
    evidence.inviteModalOpen = Boolean(modal)
    evidence.inviteCode = code ? code.textContent.trim() : ''
    evidence.inviteLink = link ? link.textContent.trim() : ''
    if (!modal) errors.push('Invite modal did not open')
    if (!code || !/^[a-z0-9]{6}$/i.test(evidence.inviteCode)) errors.push('Invite modal did not show a room code')
    if (!link || !/\?join=/.test(evidence.inviteLink)) errors.push('Invite link did not include ?join=')
    if (!peerState || peerState.active !== true || !peerState.code) errors.push('Peer match host state was not active')
    if (evidence.inviteCode && !errors.length) {
      const handshake = await runRuntimePeerHandshakeSelfTest(evidence.inviteCode)
      evidence.peerHandshake = handshake
      if (!handshake.started) errors.push(`Runtime peer guest did not complete invite handshake: ${handshake.reason || 'not started'}`)
    }
    sendBootProbeEvent(runtimeSelfTestSnapshot(errors.length ? 'error' : 'ready', errors, evidence))
  } catch (err) {
    errors.push(err && err.message ? err.message : String(err))
    sendBootProbeEvent(runtimeSelfTestSnapshot('error', errors, evidence))
  }
}

function scheduleBootRuntimeSelfTest () {
  if (typeof window === 'undefined' || typeof setTimeout !== 'function') return
  if (isRuntimeSelfTestGuest()) return
  loadBootProbeConfig().then(config => {
    if (!config || config.runtimeSelfTest !== true) return
    const delay = Number(config.runtimeSelfTestDelayMs || 350)
    setTimeout(runBootRuntimeSelfTest, Number.isFinite(delay) ? delay : 350)
  }).catch(() => {})
}

function scheduleBootReadyProbe () {
  if (typeof window === 'undefined' || typeof setTimeout !== 'function') return
  setTimeout(() => {
    if (!document.documentElement) return
    const ds = document.documentElement.dataset
    if (ds.pearcupBootReady !== 'p2p' || ds.pearcupP2pModules !== 'ready') return
    sendBootReadyProbe(ds.pearcupPeerNet || 'unknown')
  }, 500)
}

function boot () {
  sendBootCheckpoint('boot:start')
  applyTheme(state.theme)
  bindCoreFallbackEvents()
  window.addEventListener('pearcup:p2p-backend', renderPeerBackendBadge)
  assertP2PModulesReady()
  sendBootCheckpoint('boot:p2p-ready')
  bindEvents()
  sendBootCheckpoint('boot:events-bound')
  hydrateStaticShell()
  // If any runtime module was missing or the runtime config degraded to demo, say so
  // (non-blocking) — tells us the real cause without a console.
  if (bootIssues.length) { try { console.warn('PearCup boot issues:', bootIssues); showToast('Runtime note: ' + bootIssues.join(' · ')) } catch (e) {} }
  if (!state.themeChosen) {
    state.themeChosen = true
    persist()
  }
  // Deep link: ?join=<code> auto-joins a friend's peer match, including first-run users.
  tryJoinFriendInvite()
  window.addEventListener('load', resetScrollPosition)
  window.addEventListener('pageshow', resetScrollPosition)
  window.addEventListener('resize', scheduleBracketConnectors)
}

function hydrateStaticShell () {
  try {
    if ($('#teamGrid')) renderTeams()
    if ($('#profileChip') || $('#avatarPreview')) renderProfile()
    document.documentElement.dataset.pearcupUiHydrated = 'true'
    sendBootCheckpoint('boot:ui-hydrated')
  } catch (err) {
    document.documentElement.dataset.pearcupUiHydrated = 'partial'
    bootIssues.push('ui hydrate threw: ' + (err && err.message ? err.message : String(err)))
  }
}

scheduleBootReadyProbe()
scheduleBootRuntimeSelfTest()

try {
  boot()
  if (typeof window !== 'undefined') {
    window.__pearcupAppBooted = true
    document.documentElement.setAttribute('data-pearcup-booted', 'true')
    document.documentElement.dataset.pearcupAppBooted = 'true'
    syncRuntimeScreenDiagnostics()
    try { window.sessionStorage && window.sessionStorage.removeItem('pearcupBootRetryVisualShell') } catch (e) {}
    const bar = document.getElementById('bootErrorBar')
    if (bar && !/^PearCup boot error:/.test(bar.textContent || '')) bar.remove()
    emitBootReadyMarker()
    try { window.dispatchEvent(new Event('pearcup:booted')) } catch (e) {}
  }
} catch (err) {
  // The Pear renderer has no visible console — surface the real boot error ON SCREEN so a
  // single early throw can't leave a blank, dead app (and tells us exactly what failed).
  try {
    const banner = document.createElement('pre')
    banner.id = 'bootErrorBar'
    banner.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:45vh;overflow:auto;margin:0;padding:12px 16px;background:#3a1030;color:#ffd9ec;font:12px/1.5 ui-monospace,monospace;z-index:99999;white-space:pre-wrap;border-top:3px solid #ff8fc0'
    banner.textContent = 'PearCup boot error:\n' + (err && err.stack ? err.stack : String(err))
    document.body.appendChild(banner)
  } catch (e2) { /* DOM unavailable */ }
  if (typeof console !== 'undefined') console.error('PearCup boot error', err)
}

