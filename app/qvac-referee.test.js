const assert = require('node:assert/strict')
const test = require('node:test')
const core = require('./core.js')
const {
  createQvacCompletionCommentaryAdapter,
  createQvacCompletionRefereeAdapter,
  normalizeReview,
  commentaryPrompt,
  roundReviewPrompt,
  poolReviewPrompt,
  footballAnalysisPrompt,
  footballAnalysisFallback,
  normalizeFootballAnalysisOutput
} = require('./qvac-referee.js')

const gameId = 'pc-qvac-ref'
const shooter = { id: 'user-captain', username: 'captain', teamId: 'br' }
const keeper = { id: 'user-vera', username: 'vera', teamId: 'no' }
const roundResult = core.createPenaltyClashRound({
  gameId,
  roundIndex: 0,
  shooter,
  keeper,
  shooterInput: { role: 'shooter', aimZone: 'right-high', powerBand: 3, curveBand: 1, releaseTick: 42 },
  keeperInput: { role: 'keeper', diveZone: 'right-high', releaseTick: 43 }
})

test('QVAC referee prompt carries deterministic evidence only', () => {
  const prompt = roundReviewPrompt(roundResult)

  assert.equal(prompt.length, 2)
  assert.match(prompt[0].content, /Return strict JSON/)
  assert.match(prompt[0].content, /uncertain/)
  assert.match(prompt[1].content, /shooterCommitment/)
  assert.match(prompt[1].content, /winnerUserId/)
  assert.match(prompt[1].content, /participantUserIds/)
  assert.match(prompt[1].content, /stateHash/)
})

test('QVAC completion adapter seals a verified referee attestation', async () => {
  const adapter = createQvacCompletionRefereeAdapter({
    modelId: 'qvac-test-model',
    client: async ({ history }) => {
      assert.match(history[1].content, /verify_penalty_clash_round/)
      return '{"ruling":"verified","confidence":0.91,"rationale":"Evidence packet matches the resolver output."}'
    }
  })

  const attestation = await adapter.attestRound({ roundResult })

  assert.equal(attestation.ruling, 'save')
  assert.equal(attestation.review.ruling, 'verified')
  assert.equal(attestation.review.modelId, 'qvac-test-model')
  assert.equal(attestation.confidence, 0.91)
  assert.ok(attestation.signature.startsWith('0x'))
})

test('QVAC completion adapter disputes malformed round referee output', async () => {
  const adapter = createQvacCompletionRefereeAdapter({
    client: async () => 'I think it looks fine, but not JSON.'
  })

  const attestation = await adapter.attestRound({ roundResult })

  assert.equal(attestation.ruling, 'disputed')
  assert.equal(attestation.review.ruling, 'disputed')
  assert.match(attestation.review.rationale, /valid referee ruling/)
  assert.throws(() => {
    core.releaseTetherWdkEscrow({
      escrow: core.createTetherWdkEscrowIntent({ gameId, players: [shooter.id, keeper.id], amount: 5 }),
      attestation,
      winnerUserId: keeper.id
    })
  }, /Disputed QVAC attestation/)
})

test('QVAC disputed review holds settlement even when deterministic evidence exists', async () => {
  const adapter = createQvacCompletionRefereeAdapter({
    client: {
      completion () {
        return {
          tokenStream: ['{"ruling":"disputed",', '"confidence":0.22,', '"rationale":"Source evidence hash mismatch."}']
        }
      }
    }
  })

  const attestation = await adapter.attestRound({ roundResult })

  assert.equal(attestation.ruling, 'disputed')
  assert.equal(attestation.review.rationale, 'Source evidence hash mismatch.')
  assert.throws(() => {
    core.releaseTetherWdkEscrow({
      escrow: core.createTetherWdkEscrowIntent({ gameId, players: [shooter.id, keeper.id], amount: 5 }),
      attestation,
      winnerUserId: keeper.id
    })
  }, /Disputed QVAC attestation/)
})

test('QVAC completion adapter disputes pool output without explicit ruling', async () => {
  const confirmedEntries = [
    {
      paymentId: 'payment-captain',
      poolId: 'pool-qvac-ref',
      entryId: 'entry-captain',
      userId: shooter.id,
      username: shooter.username,
      amount: 25,
      asset: 'USDT',
      status: 'confirmed'
    },
    {
      paymentId: 'payment-vera',
      poolId: 'pool-qvac-ref',
      entryId: 'entry-vera',
      userId: keeper.id,
      username: keeper.username,
      amount: 25,
      asset: 'USDT',
      status: 'confirmed'
    }
  ]
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-qvac-ref',
    confirmedEntries,
    winnerUserIds: [shooter.id],
    officialResults: { champion: 'Brazil' }
  })
  const adapter = createQvacCompletionRefereeAdapter({
    client: async () => '{"confidence":0.99,"rationale":"Evidence appears complete."}'
  })

  const attestation = await adapter.attestPoolSettlement({ poolResult })

  assert.equal(attestation.ruling, 'disputed')
  assert.equal(attestation.review.ruling, 'disputed')
  assert.throws(() => {
    core.createTetherWdkPoolPayout({
      poolId: 'pool-qvac-ref',
      confirmedEntries,
      winnerUserIds: [shooter.id],
      attestation
    })
  }, /Disputed QVAC pool attestation/)
})

test('QVAC pool prompt binds official results hash and worker source mode', () => {
  const confirmedEntries = [
    {
      paymentId: 'payment-captain',
      poolId: 'pool-qvac-prompt',
      entryId: 'entry-captain',
      userId: shooter.id,
      username: shooter.username,
      amount: 25,
      asset: 'USDT',
      status: 'confirmed'
    }
  ]
  const poolResult = core.createBracketPoolSettlementResult({
    poolId: 'pool-qvac-prompt',
    confirmedEntries,
    winnerUserIds: [shooter.id],
    officialResults: { champion: 'Brazil' },
    sourceEventIds: ['evt-payment', 'evt-official-results'],
    sourceEventMode: 'worker-log'
  })
  const prompt = poolReviewPrompt(poolResult)

  assert.match(prompt[0].content, /official results snapshot evidence/)
  assert.match(prompt[1].content, /sourceBracketSubmissionIds/)
  assert.match(prompt[1].content, /bracketScoreboardHash/)
  assert.match(prompt[1].content, /officialResultsHash/)
  assert.match(prompt[1].content, /sourceEventMode/)
  assert.match(prompt[1].content, /worker-log/)
})

test('QVAC commentary prompt grounds multilingual output in match events and stats', () => {
  const prompt = commentaryPrompt({
    matchId: 'match-brazil-norway',
    language: 'pt',
    clock: '64:10',
    recentEvents: [{
      eventId: 'evt-shot',
      matchId: 'match-brazil-norway',
      clock: '64:10',
      type: 'shot',
      teamId: 'br'
    }],
    currentStats: {
      matchId: 'match-brazil-norway',
      clock: '64:10',
      score: { br: 2, no: 1 },
      shots: { br: 12, no: 6 }
    },
    roomPickDistribution: { br: 2, no: 1 }
  })

  assert.match(prompt[0].content, /Do not invent/)
  assert.match(prompt[0].content, /language PT/)
  assert.match(prompt[1].content, /generate_grounded_match_commentary/)
  assert.match(prompt[1].content, /evt-shot/)
  assert.match(prompt[1].content, /roomPickDistribution/)
})

test('QVAC completion commentary adapter creates grounded segments', async () => {
  const adapter = createQvacCompletionCommentaryAdapter({
    modelId: 'qvac-commentary-test',
    commentatorId: 'qvac-commentary-ref',
    client: async ({ history }) => {
      assert.match(history[1].content, /generate_grounded_match_commentary/)
      return '{"text":"Brasil pressure is rising from the latest shot.","confidence":0.88}'
    }
  })
  const segment = await adapter.generateSegment({
    matchId: 'match-brazil-norway',
    language: 'EN',
    clock: '64:10',
    recentEvents: [{
      eventId: 'evt-shot',
      matchId: 'match-brazil-norway',
      clock: '64:10',
      type: 'shot',
      teamId: 'br'
    }],
    currentStats: {
      matchId: 'match-brazil-norway',
      clock: '64:10',
      score: { br: 2, no: 1 }
    },
    roomPickDistribution: { br: 2, no: 1 }
  })

  assert.equal(segment.matchId, 'match-brazil-norway')
  assert.equal(segment.language, 'EN')
  assert.equal(segment.commentatorId, 'qvac-commentary-ref')
  assert.equal(segment.modelId, 'qvac-commentary-test')
  assert.equal(segment.confidence, 0.88)
  assert.deepEqual(segment.sourceEventIds, ['evt-shot'])
  assert.ok(segment.segmentId)
})

test('QVAC review normalization clamps confidence and extracts JSON from text', () => {
  const review = normalizeReview('Sure:\n{"ruling":"verified","confidence":4,"rationale":"ok"}')

  assert.equal(review.ruling, 'verified')
  assert.equal(review.confidence, 1)
  assert.equal(review.rationale, 'ok')

  const missingRuling = normalizeReview('Sure:\n{"confidence":0.9,"rationale":"looks okay"}')
  assert.equal(missingRuling.ruling, 'disputed')
  assert.equal(missingRuling.confidence, 0.9)
  assert.equal(missingRuling.rationale, 'looks okay')
})

test('QVAC football expert prompt requires grounded tactical and environmental parameters', () => {
  const prompt = footballAnalysisPrompt({
    matchId: 'fixture-spain-belgium',
    match: {
      id: 'fixture-spain-belgium',
      home: { name: 'Spain' },
      away: { name: 'Belgium' },
      status: 'TIMED',
      stage: 'QUARTER_FINALS'
    },
    recentForm: { home: ['W', 'D', 'W'], away: ['L', 'W', 'D'] },
    currentStats: { possession: 58, shots: [7, 4] },
    odds: [{ outcome: 'Spain', probability: 0.54 }, { outcome: 'Draw', probability: 0.25 }, { outcome: 'Belgium', probability: 0.21 }]
  })

  assert.equal(prompt.length, 2)
  assert.match(prompt[0].content, /tactical friction/)
  assert.match(prompt[0].content, /altitude/)
  assert.match(prompt[0].content, /extra time/)
  assert.match(prompt[0].content, /Not supplied by relay/)
  assert.match(prompt[1].content, /generate_grounded_football_expert_analysis/)
  assert.match(prompt[0].content, /Polymarket probabilities/)
})

test('QVAC football fallback is honest about missing data and produces a full prediction matrix', () => {
  const analysis = footballAnalysisFallback({
    matchId: 'fixture-spain-belgium',
    dataSource: 'relay',
    match: {
      id: 'fixture-spain-belgium',
      home: { name: 'Spain' },
      away: { name: 'Belgium' },
      status: 'TIMED',
      stage: 'QUARTER_FINALS'
    }
  })

  assert.equal(analysis.homeTeam, 'Spain')
  assert.equal(analysis.awayTeam, 'Belgium')
  assert.equal(analysis.progression.length, 4)
  assert.equal(analysis.parameterMatrix.length, 6)
  assert.equal(analysis.parameterMatrix[0].home, 'Not supplied by relay')
  assert.equal(analysis.parameterMatrix[2].status, 'not supplied')
  assert.match(analysis.tacticalFriction.homeAdvantages.join(' '), /No verified tactical edge/)
  assert.match(analysis.structuralXFactors.join(' '), /altitude|weather/i)
  assert.ok(['Spain', 'Belgium', 'Draw'].includes(analysis.prediction.winner))
  assert.ok(analysis.prediction.confidence <= 99)
  assert.match(analysis.explainer, /Polymarket/)
})

test('QVAC football output normalization rejects invented teams and clamps probabilities', () => {
  const input = {
    matchId: 'fixture-spain-belgium',
    match: { home: { name: 'Spain' }, away: { name: 'Belgium' }, status: 'TIMED' }
  }
  const normalized = normalizeFootballAnalysisOutput(JSON.stringify({
    homeTeam: 'Spain',
    awayTeam: 'Belgium',
    progression: [{ probabilities: { home: 900, draw: -2, away: 1 }, tacticalPlan: 'Use only supplied events.', adjustment: 'None.' }],
    prediction: { winner: 'Invented XI', method: 'Win by goals', confidence: 900 }
  }), input, { modelId: 'qvac-test' })

  assert.equal(normalized.homeTeam, 'Spain')
  assert.equal(normalized.awayTeam, 'Belgium')
  assert.notEqual(normalized.prediction.winner, 'Invented XI')
  assert.ok(normalized.prediction.confidence <= 100)
  assert.equal(normalized.progression[0].probabilities.home + normalized.progression[0].probabilities.draw + normalized.progression[0].probabilities.away, 100)
  assert.equal(normalized.modelId, 'qvac-test')
  assert.ok(normalized.analysisId)
})

test('QVAC completion commentary adapter returns a football expert analysis', async () => {
  const adapter = createQvacCompletionCommentaryAdapter({
    modelId: 'qvac-football-test',
    client: async ({ history }) => {
      assert.match(history[1].content, /generate_grounded_football_expert_analysis/)
      return JSON.stringify({
        prediction: { winner: 'Spain', method: 'Win by goals', target: 'Goes to full time', confidence: 61, rationale: 'Verified snapshot signals.' }
      })
    }
  })
  const analysis = await adapter.generateFootballAnalysis({
    matchId: 'fixture-spain-belgium',
    match: { home: { name: 'Spain' }, away: { name: 'Belgium' }, status: 'TIMED' }
  })
  assert.equal(analysis.prediction.winner, 'Spain')
  assert.equal(analysis.prediction.confidence, 61)
  assert.equal(analysis.modelId, 'qvac-football-test')
})
