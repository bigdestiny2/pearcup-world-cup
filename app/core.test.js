const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')

function sampleRound () {
  return core.createPenaltyClashRound({
    gameId: 'pc-test',
    roundIndex: 0,
    shooter: { id: 'user-captain', username: 'captain', teamId: 'br' },
    keeper: { id: 'user-vera', username: 'vera', teamId: 'no' },
    shooterInput: {
      role: 'shooter',
      aimZone: 'right-high',
      powerBand: 3,
      curveBand: 1,
      releaseTick: 42
    },
    keeperInput: {
      role: 'keeper',
      diveZone: 'right-high',
      releaseTick: 43
    }
  })
}

test('canonicalJson is stable for object key order', () => {
  assert.equal(
    core.deterministicHash({ b: 2, a: 1, nested: { z: true, c: 'x' } }),
    core.deterministicHash({ nested: { c: 'x', z: true }, a: 1, b: 2 })
  )
})

test('commitment verifies with matching reveal and rejects changed input', () => {
  const input = { role: 'shooter', aimZone: 'left-low', releaseTick: 20 }
  const commitment = core.createCommitment({
    gameId: 'pc-test',
    roundId: 'pc-1',
    playerId: 'user-a',
    input,
    nonce: 'secret'
  })

  assert.equal(core.verifyCommitment({
    commitment,
    gameId: 'pc-test',
    roundId: 'pc-1',
    playerId: 'user-a',
    input,
    nonce: 'secret'
  }), true)

  assert.equal(core.verifyCommitment({
    commitment,
    gameId: 'pc-test',
    roundId: 'pc-1',
    playerId: 'user-a',
    input: { ...input, aimZone: 'right-low' },
    nonce: 'secret'
  }), false)
})

test('penalty round resolves deterministically and produces referee evidence', () => {
  const first = sampleRound()
  const second = sampleRound()

  assert.equal(first.stateHash, second.stateHash)
  assert.equal(first.outcome, 'save')
  assert.equal(first.sourceEventIds.length, 4)
})

test('QVAC attestation signs a valid round and disputes missing evidence', () => {
  const attestation = core.createQvacRefereeAttestation({ roundResult: sampleRound() })
  assert.equal(attestation.ruling, 'save')
  assert.ok(attestation.signature.startsWith('0x'))
  assert.equal(attestation.confidence, 0.98)

  const disputed = core.createQvacRefereeAttestation({
    roundResult: { gameId: 'pc-test', roundId: 'pc-1', outcome: 'goal' }
  })
  assert.equal(disputed.ruling, 'disputed')
  assert.equal(disputed.confidence, 0.34)
})

test('QVAC attestation can sign replayable forfeit evidence for WDK release', () => {
  const normalRound = sampleRound()
  const forfeitRound = core.createPenaltyClashForfeitRound({
    gameId: normalRound.gameId,
    roundIndex: 0,
    shooter: normalRound.shooter,
    keeper: normalRound.keeper,
    forfeitingPlayerId: normalRound.keeper.id,
    winnerUserId: normalRound.shooter.id,
    claimantUserId: normalRound.shooter.id,
    reason: 'reveal-timeout',
    sourceEventIds: ['evt-commit-shooter', 'evt-commit-keeper', 'evt-forfeit']
  })
  const attestation = core.createQvacRefereeAttestation({ roundResult: forfeitRound })
  const escrow = core.createTetherWdkEscrowIntent({
    gameId: forfeitRound.gameId,
    players: [forfeitRound.shooter.id, forfeitRound.keeper.id],
    amount: 5,
    asset: 'USDT'
  })
  const payout = core.releaseTetherWdkEscrow({
    escrow,
    attestation,
    winnerUserId: forfeitRound.winnerUserId
  })

  assert.equal(forfeitRound.outcome, 'forfeit')
  assert.equal(core.winnerUserIdForRoundResult(forfeitRound), normalRound.shooter.id)
  assert.equal(forfeitRound.claimantUserId, normalRound.shooter.id)
  assert.equal(attestation.ruling, 'forfeit')
  assert.equal(attestation.winnerUserId, normalRound.shooter.id)
  assert.deepEqual(attestation.participantUserIds, [normalRound.shooter.id, normalRound.keeper.id])
  assert.deepEqual(core.verifyQvacRoundAttestation({ roundResult: forfeitRound, attestation }), { ok: true, errors: [] })
  assert.equal(payout.status, 'prepared')
  assert.equal(payout.winnerUserId, normalRound.shooter.id)
})

test('QVAC round attestation fails closed when supplied review is not explicitly verified', () => {
  const round = sampleRound()
  const attestation = core.createQvacRefereeAttestation({
    roundResult: round,
    review: {
      ruling: 'maybe',
      confidence: 0.99,
      rationale: 'The response looked confident but did not return a valid verified ruling.'
    }
  })
  const escrow = core.createTetherWdkEscrowIntent({
    gameId: round.gameId,
    players: [round.shooter.id, round.keeper.id],
    amount: 5,
    asset: 'USDT'
  })

  assert.equal(attestation.ruling, 'disputed')
  assert.equal(attestation.confidence, 0.99)
  assert.throws(() => core.releaseTetherWdkEscrow({
    escrow,
    attestation,
    winnerUserId: round.keeper.id
  }), /Disputed QVAC attestation/)
})

test('QVAC round attestation verification binds the signed state and evidence', () => {
  const round = sampleRound()
  const attestation = core.createQvacRefereeAttestation({ roundResult: round })
  const verified = core.verifyQvacRoundAttestation({ roundResult: round, attestation })
  const tampered = core.verifyQvacRoundAttestation({
    roundResult: round,
    attestation: {
      ...attestation,
      stateHash: '0xtampered',
      signature: '0xsigned-tampered'
    }
  })

  assert.equal(verified.ok, true)
  assert.deepEqual(verified.errors, [])
  assert.equal(tampered.ok, false)
  assert.match(tampered.errors.join('; '), /stateHash/)
  assert.match(tampered.errors.join('; '), /signature/)
})

test('QVAC round attestation verification requires a signed referee identity', () => {
  const round = sampleRound()
  const unsigned = {
    attestationId: 'sdk-attestation-without-referee',
    gameId: round.gameId,
    roundId: round.roundId,
    resolverVersion: round.resolverVersion,
    ruling: round.outcome,
    winnerUserId: core.winnerUserIdForRoundResult(round),
    participantUserIds: core.participantUserIdsForRoundResult(round),
    stateHash: round.stateHash,
    sourceEventIds: round.sourceEventIds,
    signature: 'sdk-arbitrary-signature'
  }
  const verified = core.verifyQvacRoundAttestation({ roundResult: round, attestation: unsigned })

  assert.equal(verified.ok, false)
  assert.match(verified.errors.join('; '), /refereeId/)
})

test('QVAC pool attestation fails closed when supplied review is not explicitly verified', () => {
  const intent = core.createTetherWdkEntryIntent({
    poolId: 'pool-invalid-review',
    entryId: 'entry-captain',
    userId: 'user-captain',
    username: 'captain',
    amount: 25,
    asset: 'USDT'
  })
  const payment = core.confirmTetherWdkEntryIntent({ intent, confirmationId: 'confirm-invalid-review' })
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-invalid-review',
    confirmedEntries: [payment],
    winnerUserIds: ['user-captain'],
    officialResults: { final: 'Brazil' }
  })
  const attestation = core.createQvacPoolSettlementAttestation({
    poolResult,
    review: {
      confidence: 0.98,
      rationale: 'No explicit verified ruling was supplied.'
    }
  })

  assert.equal(poolResult.ruling, 'verified')
  assert.equal(attestation.ruling, 'disputed')
  assert.throws(() => core.createTetherWdkPoolPayout({
    poolId: 'pool-invalid-review',
    confirmedEntries: [payment],
    winnerUserIds: ['user-captain'],
    attestation,
    asset: 'USDT'
  }), /Disputed QVAC pool attestation/)
})

test('QVAC pool attestation verification requires a signed referee identity', () => {
  const intent = core.createTetherWdkEntryIntent({
    poolId: 'pool-unsigned-qvac',
    entryId: 'entry-captain',
    userId: 'user-captain',
    username: 'captain',
    amount: 25,
    asset: 'USDT'
  })
  const payment = core.confirmTetherWdkEntryIntent({ intent, confirmationId: 'confirm-unsigned-qvac' })
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-unsigned-qvac',
    confirmedEntries: [payment],
    winnerUserIds: ['user-captain'],
    officialResults: { final: 'Brazil' }
  })
  const unsigned = {
    attestationId: 'sdk-pool-attestation-without-referee',
    poolId: poolResult.poolId,
    rulesVersion: poolResult.rulesVersion,
    ruling: poolResult.ruling,
    stateHash: poolResult.stateHash,
    officialResultsHash: poolResult.officialResultsHash,
    sourcePaymentIds: poolResult.sourcePaymentIds,
    winnerUserIds: poolResult.winnerUserIds,
    sourceEventIds: poolResult.sourceEventIds,
    signature: 'sdk-arbitrary-pool-signature'
  }
  const verified = core.verifyQvacPoolSettlementAttestation({ poolResult, attestation: unsigned })

  assert.equal(verified.ok, false)
  assert.match(verified.errors.join('; '), /refereeId/)
})

test('Tether WDK escrow release requires a signed non-disputed QVAC attestation', () => {
  const round = sampleRound()
  const attestation = core.createQvacRefereeAttestation({ roundResult: round })
  const escrow = core.createTetherWdkEscrowIntent({
    gameId: round.gameId,
    players: [round.shooter.id, round.keeper.id],
    amount: 5,
    asset: 'USDT'
  })
  const payout = core.releaseTetherWdkEscrow({
    escrow,
    attestation,
    winnerUserId: round.keeper.id
  })

  assert.equal(payout.status, 'prepared')
  assert.equal(payout.amount, 5)
  assert.equal(payout.asset, 'USDT')
  assert.equal(payout.rail, escrow.rail)
  assert.equal(payout.qvacAttestationId, attestation.attestationId)

  assert.throws(() => core.releaseTetherWdkEscrow({
    escrow,
    attestation: { ...attestation, ruling: 'disputed' },
    winnerUserId: round.keeper.id
  }), /Disputed QVAC attestation/)
  assert.throws(() => core.releaseTetherWdkEscrow({
    escrow,
    attestation,
    winnerUserId: round.shooter.id
  }), /Winner must match QVAC attestation winner/)
  assert.throws(() => core.releaseTetherWdkEscrow({
    escrow: { ...escrow, players: [round.shooter.id, 'user-other'] },
    attestation,
    winnerUserId: round.keeper.id
  }), /Escrow players must match QVAC attestation participants/)
})

test('Tether WDK escrow refunds are deterministic and split locked escrow value', () => {
  const escrow = core.createTetherWdkEscrowIntent({
    gameId: 'pc-refund',
    players: ['user-captain', 'user-vera'],
    amount: 5,
    asset: 'USDT'
  })
  const refund = core.refundTetherWdkEscrow({
    escrow,
    reason: 'qvac-dispute-held'
  })
  const repeat = core.refundTetherWdkEscrow({
    escrow,
    reason: 'qvac-dispute-held'
  })

  assert.equal(refund.refundId, repeat.refundId)
  assert.equal(refund.status, 'refunded')
  assert.equal(refund.escrowId, escrow.escrowId)
  assert.equal(refund.amount, 5)
  assert.equal(refund.amountEach, 2.5)
  assert.deepEqual(refund.refundUserIds, escrow.players)
  assert.throws(() => core.refundTetherWdkEscrow({
    escrow: { ...escrow, status: 'released' }
  }), /Locked escrow/)
  assert.throws(() => core.refundTetherWdkEscrow({
    escrow,
    refundUserIds: ['user-captain', 'user-other']
  }), /refund recipients/)
})

test('Tether WDK bracket entry intents confirm and split pool payout deterministically', () => {
  const firstIntent = core.createTetherWdkEntryIntent({
    poolId: 'pool-25',
    entryId: 'entry-captain',
    userId: 'user-captain',
    username: 'captain',
    amount: 25,
    asset: 'USDT'
  })
  const secondIntent = core.createTetherWdkEntryIntent({
    poolId: 'pool-25',
    entryId: 'entry-lina',
    userId: 'user-lina',
    username: 'lina',
    amount: 25,
    asset: 'USDT'
  })
  const firstPayment = core.confirmTetherWdkEntryIntent({ intent: firstIntent, confirmationId: 'confirm-a' })
  const secondPayment = core.confirmTetherWdkEntryIntent({ intent: secondIntent, confirmationId: 'confirm-b' })
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-25',
    confirmedEntries: [firstPayment, secondPayment],
    winnerUserIds: ['user-captain', 'user-lina'],
    officialResults: { final: 'Brazil' }
  })
  const attestation = core.createQvacPoolSettlementAttestation({ poolResult })
  const payout = core.createTetherWdkPoolPayout({
    poolId: 'pool-25',
    confirmedEntries: [firstPayment, secondPayment],
    winnerUserIds: ['user-captain', 'user-lina'],
    attestation,
    asset: 'USDT'
  })
  const payoutAgain = core.createTetherWdkPoolPayout({
    poolId: 'pool-25',
    confirmedEntries: [secondPayment, firstPayment],
    winnerUserIds: ['user-lina', 'user-captain'],
    attestation,
    asset: 'USDT'
  })

  assert.equal(firstIntent.status, 'requires-confirmation')
  assert.equal(firstPayment.status, 'confirmed')
  assert.equal(poolResult.ruling, 'verified')
  assert.equal(poolResult.sourceEventMode, 'deterministic')
  assert.equal(poolResult.officialResultsHash, core.deterministicHash(poolResult.officialResults))
  assert.equal(attestation.ruling, 'verified')
  assert.equal(attestation.officialResultsHash, poolResult.officialResultsHash)
  assert.equal(payout.grossPool, 50)
  assert.equal(payout.amountEach, 25)
  assert.equal(payout.qvacAttestationId, attestation.attestationId)
  assert.equal(payout.payoutId, payoutAgain.payoutId)
  assert.throws(() => core.createTetherWdkPoolPayout({
    poolId: 'pool-25',
    confirmedEntries: [firstPayment, secondPayment],
    winnerUserIds: ['user-captain'],
    attestation,
    asset: 'USDT'
  }), /Payout winners must match QVAC pool attestation winners/)
  assert.throws(() => core.createTetherWdkPoolPayout({
    poolId: 'pool-25',
    confirmedEntries: [firstPayment, { ...secondPayment, paymentId: 'payment-tampered' }],
    winnerUserIds: ['user-captain', 'user-lina'],
    attestation,
    asset: 'USDT'
  }), /Payout payments must match QVAC pool attestation payments/)
  assert.throws(() => core.createTetherWdkPoolPayout({
    poolId: 'pool-25',
    confirmedEntries: [firstPayment, secondPayment],
    winnerUserIds: ['user-captain', 'user-lina'],
    attestation,
    asset: 'USDT',
    rulesVersion: 'bracket-pool-v2'
  }), /rulesVersion/)
})

test('Tether WDK pending entry payment checks are deterministic and non-confirming', () => {
  const intent = core.createTetherWdkEntryIntent({
    poolId: 'pool-pending',
    entryId: 'entry-captain',
    userId: 'user-captain',
    username: 'captain',
    amount: 25,
    asset: 'USDT'
  })
  const pending = core.createTetherWdkEntryPaymentPending({
    intent,
    confirmationId: 'chain-check-1',
    processorStatus: 'awaiting_payment',
    reason: 'WDK payment has not been confirmed yet'
  })
  const repeat = core.createTetherWdkEntryPaymentPending({
    intent,
    confirmationId: 'chain-check-1',
    processorStatus: 'awaiting_payment',
    reason: 'WDK payment has not been confirmed yet'
  })

  assert.equal(pending.checkId, repeat.checkId)
  assert.equal(pending.status, 'pending')
  assert.equal(pending.intentId, intent.intentId)
  assert.equal(pending.poolId, 'pool-pending')
})

test('Tether WDK entry refunds are deterministic and bound to confirmed payments', () => {
  const intent = core.createTetherWdkEntryIntent({
    poolId: 'pool-refund',
    entryId: 'entry-captain',
    userId: 'user-captain',
    username: 'captain',
    amount: 25,
    asset: 'USDT'
  })
  const payment = core.confirmTetherWdkEntryIntent({ intent, confirmationId: 'confirm-refund' })
  const refund = core.createTetherWdkEntryRefund({
    payment,
    reason: 'pool-cancelled'
  })
  const repeat = core.createTetherWdkEntryRefund({
    payment,
    reason: 'pool-cancelled'
  })

  assert.equal(refund.refundId, repeat.refundId)
  assert.equal(refund.status, 'refunded')
  assert.equal(refund.paymentId, payment.paymentId)
  assert.equal(refund.intentId, intent.intentId)
  assert.equal(refund.poolId, 'pool-refund')
  assert.equal(refund.rail, payment.rail)
  assert.throws(() => core.createTetherWdkEntryRefund({
    payment: { ...payment, status: 'pending' }
  }), /Confirmed entry payment/)
})

test('QVAC pool attestation verification binds winners, payments, and state', () => {
  const firstIntent = core.createTetherWdkEntryIntent({
    poolId: 'pool-verified',
    entryId: 'entry-captain',
    userId: 'user-captain',
    username: 'captain',
    amount: 25,
    asset: 'USDT'
  })
  const secondIntent = core.createTetherWdkEntryIntent({
    poolId: 'pool-verified',
    entryId: 'entry-lina',
    userId: 'user-lina',
    username: 'lina',
    amount: 25,
    asset: 'USDT'
  })
  const firstPayment = core.confirmTetherWdkEntryIntent({ intent: firstIntent, confirmationId: 'confirm-a' })
  const secondPayment = core.confirmTetherWdkEntryIntent({ intent: secondIntent, confirmationId: 'confirm-b' })
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-verified',
    confirmedEntries: [firstPayment, secondPayment],
    winnerUserIds: ['user-captain', 'user-lina']
  })
  const attestation = core.createQvacPoolSettlementAttestation({ poolResult })
  const verified = core.verifyQvacPoolSettlementAttestation({ poolResult, attestation })
  const tampered = core.verifyQvacPoolSettlementAttestation({
    poolResult,
    attestation: {
      ...attestation,
      winnerUserIds: ['user-captain'],
      signature: '0xsigned-tampered'
    }
  })

  assert.equal(verified.ok, true)
  assert.deepEqual(verified.errors, [])
  assert.equal(attestation.officialResultsHash, poolResult.officialResultsHash)
  assert.equal(tampered.ok, false)
  assert.match(tampered.errors.join('; '), /winnerUserIds/)
  assert.match(tampered.errors.join('; '), /signature/)
})

test('QVAC pool attestation requires official results source evidence', () => {
  const intent = core.createTetherWdkEntryIntent({
    poolId: 'pool-official-source',
    entryId: 'entry-captain',
    userId: 'user-captain',
    username: 'captain',
    amount: 25,
    asset: 'USDT'
  })
  const payment = core.confirmTetherWdkEntryIntent({ intent, confirmationId: 'confirm-official-source' })
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-official-source',
    confirmedEntries: [payment],
    winnerUserIds: ['user-captain'],
    officialResults: { champion: 'Brazil' },
    sourceEventIds: ['evt-payment-only'],
    sourceEventMode: 'worker-log'
  })
  const attestation = core.createQvacPoolSettlementAttestation({ poolResult })
  const verification = core.verifyQvacPoolSettlementAttestation({ poolResult, attestation })

  assert.equal(poolResult.ruling, 'verified')
  assert.equal(poolResult.sourceEventMode, 'worker-log')
  assert.equal(attestation.ruling, 'disputed')
  assert.equal(attestation.officialResultsHash, null)
  assert.equal(verification.ok, false)
  assert.match(verification.errors.join('; '), /official results evidence/)
  assert.throws(() => core.createTetherWdkPoolPayout({
    poolId: 'pool-official-source',
    confirmedEntries: [payment],
    winnerUserIds: ['user-captain'],
    attestation,
    asset: 'USDT'
  }), /Disputed QVAC pool attestation/)
})

test('bracket pool settlement derives winners from locked submissions', () => {
  const firstIntent = core.createTetherWdkEntryIntent({
    poolId: 'pool-bracket-derived',
    entryId: 'entry-captain',
    userId: 'user-captain',
    username: 'captain',
    amount: 25,
    asset: 'USDT'
  })
  const secondIntent = core.createTetherWdkEntryIntent({
    poolId: 'pool-bracket-derived',
    entryId: 'entry-lina',
    userId: 'user-lina',
    username: 'lina',
    amount: 25,
    asset: 'USDT'
  })
  const firstPayment = core.confirmTetherWdkEntryIntent({ intent: firstIntent, confirmationId: 'confirm-captain-derived' })
  const secondPayment = core.confirmTetherWdkEntryIntent({ intent: secondIntent, confirmationId: 'confirm-lina-derived' })
  const officialResults = {
    matchWinners: {
      'r16-1': 'br',
      'qf-1': 'br',
      'semi-1': 'br',
      final: 'br'
    }
  }
  const captainSubmission = core.createBracketSubmission({
    poolId: 'pool-bracket-derived',
    entryId: 'entry-captain',
    paymentId: firstPayment.paymentId,
    userId: 'user-captain',
    username: 'captain',
    picks: {
      'r16-1': 'br',
      'qf-1': 'br',
      'semi-1': 'br',
      final: 'br'
    }
  })
  const linaSubmission = core.createBracketSubmission({
    poolId: 'pool-bracket-derived',
    entryId: 'entry-lina',
    paymentId: secondPayment.paymentId,
    userId: 'user-lina',
    username: 'lina',
    picks: {
      'r16-1': 'br',
      'qf-1': 'no',
      'semi-1': 'no',
      final: 'no'
    }
  })
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-bracket-derived',
    confirmedEntries: [firstPayment, secondPayment],
    bracketSubmissions: [captainSubmission, linaSubmission],
    officialResults,
    sourceEventIds: ['evt-payment-captain', 'evt-payment-lina', 'evt-submission-captain', 'evt-submission-lina', 'evt-official-results'],
    sourceEventMode: 'worker-log'
  })
  const attestation = core.createQvacPoolSettlementAttestation({ poolResult })
  const verification = core.verifyQvacPoolSettlementAttestation({ poolResult, attestation })

  assert.deepEqual(poolResult.winnerUserIds, ['user-captain'])
  assert.equal(poolResult.bracketResolvedBy, 'perfect-bracket')
  assert.equal(poolResult.sourceBracketSubmissionIds.length, 2)
  assert.equal(poolResult.bracketScoreboard.find(row => row.userId === 'user-captain').perfect, true)
  assert.equal(attestation.ruling, 'verified')
  assert.deepEqual(attestation.sourceBracketSubmissionIds, poolResult.sourceBracketSubmissionIds)
  assert.equal(attestation.bracketScoreboardHash, poolResult.bracketScoreboardHash)
  assert.deepEqual(verification, { ok: true, errors: [] })
})

test('Tether WDK bracket payout rejects unconfirmed entries and non-entry winners', () => {
  const intent = core.createTetherWdkEntryIntent({
    poolId: 'pool-10',
    entryId: 'entry-captain',
    userId: 'user-captain',
    username: 'captain',
    amount: 10,
    asset: 'USDT'
  })
  const payment = core.confirmTetherWdkEntryIntent({ intent })
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-10',
    confirmedEntries: [payment],
    winnerUserIds: ['user-captain']
  })
  const attestation = core.createQvacPoolSettlementAttestation({ poolResult })

  assert.throws(() => core.createTetherWdkPoolPayout({
    poolId: 'pool-10',
    confirmedEntries: [{ ...payment, status: 'pending' }],
    winnerUserIds: ['user-captain'],
    attestation,
    asset: 'USDT'
  }), /confirmed/)

  assert.throws(() => core.createTetherWdkPoolPayout({
    poolId: 'pool-10',
    confirmedEntries: [payment],
    winnerUserIds: ['user-lina'],
    attestation,
    asset: 'USDT'
  }), /confirmed entry/)

  assert.throws(() => core.createTetherWdkPoolPayout({
    poolId: 'pool-10',
    confirmedEntries: [payment],
    winnerUserIds: ['user-captain'],
    asset: 'USDT'
  }), /QVAC pool attestation/)

  assert.throws(() => core.createTetherWdkPoolPayout({
    poolId: 'pool-10',
    confirmedEntries: [payment],
    winnerUserIds: ['user-captain'],
    attestation: { ...attestation, ruling: 'disputed' },
    asset: 'USDT'
  }), /Disputed QVAC pool attestation/)
})
