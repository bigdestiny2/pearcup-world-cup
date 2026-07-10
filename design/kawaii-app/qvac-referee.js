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

  // Watch-party trivia deliberately has a narrower evidence boundary than open-ended
  // sports trivia. Every question must be answerable from the active match snapshot so
  // a local QVAC model cannot invent player history, injuries, or betting advice.
  function triviaFallbackRound (input = {}) {
    const match = input.match || input.currentStats || {}
    const home = String(match.home && match.home.name || input.homeTeam || 'the home team')
    const away = String(match.away && match.away.name || input.awayTeam || 'the away team')
    const stage = String(match.stage || input.stage || 'this match').replace(/_/g, ' ').toLowerCase()
    return {
      question: `Which team is listed first for ${home} vs ${away}?`,
      options: [home, away, `Winner of ${stage}`, 'No team is listed'],
      answerIndex: 0,
      explanation: `${home} is the home side in the active match snapshot.`
    }
  }

  function normalizeTriviaRound (input, fallbackInput = {}) {
    const parsed = extractJsonObject(input)
    const fallback = triviaFallbackRound(fallbackInput)
    const question = typeof parsed.question === 'string' && parsed.question.trim()
      ? parsed.question.trim().slice(0, 220)
      : fallback.question
    const rawOptions = Array.isArray(parsed.options)
      ? parsed.options.filter(option => typeof option === 'string' && option.trim()).map(option => option.trim().slice(0, 90))
      : []
    const options = rawOptions.length === 4 ? rawOptions : fallback.options
    let answerIndex = Number(parsed.answerIndex)
    if (!Number.isInteger(answerIndex) && typeof parsed.answer === 'string') answerIndex = options.indexOf(parsed.answer)
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) answerIndex = fallback.answerIndex
    const explanation = typeof parsed.explanation === 'string' && parsed.explanation.trim()
      ? parsed.explanation.trim().slice(0, 260)
      : fallback.explanation
    return { question, options, answerIndex, explanation }
  }

  function triviaPrompt (input = {}) {
    return [
      {
        role: 'system',
        content: [
          'You are the QVAC watch-party trivia host for PearCup.',
          'Create one friendly four-option trivia question using only the supplied active-match facts.',
          'Never ask about betting, odds, player history, injuries, or any fact absent from the snapshot.',
          'Return strict JSON: {"question":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"short grounded explanation"}.',
          'answerIndex must be an integer from 0 to 3.'
        ].join(' ')
      },
      {
        role: 'user',
        content: core.canonicalJson({
          task: 'generate_grounded_watch_party_trivia',
          requiredEvidence: ['match'],
          language: normalizeLanguage(input.language),
          match: input.match || input.currentStats || {},
          recentEvents: input.recentEvents || []
        })
      }
    ]
  }

  function createTriviaRound ({
    input = {},
    question,
    options,
    answerIndex,
    explanation,
    modelId = null,
    hostId = 'qvac-trivia'
  } = {}) {
    const normalized = normalizeTriviaRound({ question, options, answerIndex, explanation }, input)
    const match = input.match || input.currentStats || {}
    const payload = {
      matchId: input.matchId || match.id || 'unknown-match',
      language: normalizeLanguage(input.language),
      question: normalized.question,
      options: normalized.options,
      answerIndex: normalized.answerIndex,
      explanation: normalized.explanation,
      modelId,
      hostId,
      sourceHash: core.deterministicHash({ match, recentEvents: input.recentEvents || [] })
    }
    return { triviaId: core.deterministicHash(payload), ...payload }
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
      },
      async generateTriviaRound (input = {}) {
        const raw = await runCompletion(client, triviaPrompt(input), modelId)
        const trivia = normalizeTriviaRound(raw, input)
        return createTriviaRound({
          input,
          ...trivia,
          modelId,
          hostId: commentatorId
        })
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
    triviaFallbackRound,
    normalizeTriviaRound,
    triviaPrompt,
    createTriviaRound,
    roundReviewPrompt,
    poolReviewPrompt
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupQvacReferee = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
