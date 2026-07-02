(function attachPearCupQvacReferee (root) {
  const core = root.PearCupCore || (typeof require !== 'undefined' ? require('./core.js') : null)
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

  const api = {
    createQvacCompletionRefereeAdapter,
    extractJsonObject,
    normalizeReview,
    roundReviewPrompt,
    poolReviewPrompt
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupQvacReferee = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
