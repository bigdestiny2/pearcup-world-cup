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

  // The model does not invent sports facts. It selects one item from this reviewed bank;
  // that gives every room a richer question while keeping the answer and explanation
  // independently verifiable. Team questions are used when either side has a profile,
  // with general World Cup knowledge deliberately mixed in between them.
  const WORLD_CUP_TEAM_TRIVIA = {
    'algeria': [{
      id: 'algeria-2014-knockout',
      question: 'At which World Cup did Algeria first reach the knockout stage?',
      options: ['1982', '1986', '2010', '2014'], answerIndex: 3,
      explanation: 'Algeria reached the round of 16 for the first time at Brazil 2014.'
    }],
    'argentina': [
      {
        id: 'argentina-2022-title',
        question: 'Argentina won its third World Cup title in which year?',
        options: ['1978', '1986', '2014', '2022'], answerIndex: 3,
        explanation: 'Argentina added its third title at Qatar 2022, after wins in 1978 and 1986.'
      },
      {
        id: 'argentina-2022-final-opponent',
        question: 'Which team did Argentina beat in the 2022 World Cup final?',
        options: ['Croatia', 'France', 'Morocco', 'Netherlands'], answerIndex: 1,
        explanation: 'Argentina and France drew 3–3 before Argentina won the 2022 final on penalties.'
      }
    ],
    'australia': [{
      id: 'australia-2006-knockout',
      question: 'At which World Cup did Australia first reach the round of 16?',
      options: ['1974', '1998', '2006', '2014'], answerIndex: 2,
      explanation: 'Australia reached the knockout stage for the first time at Germany 2006.'
    }],
    'austria': [{
      id: 'austria-1954-third',
      question: 'What was Austria’s best men’s World Cup finish?',
      options: ['Champions', 'Runners-up', 'Third place', 'Fourth place'], answerIndex: 2,
      explanation: 'Austria finished third at the 1954 World Cup in Switzerland.'
    }],
    'belgium': [
      {
        id: 'belgium-2018-third',
        question: 'What was Belgium’s best men’s World Cup finish?',
        options: ['Champions in 1986', 'Runners-up in 2002', 'Third place in 2018', 'Fourth place in 2014'], answerIndex: 2,
        explanation: 'Belgium finished third at Russia 2018, its best World Cup finish.'
      },
      {
        id: 'belgium-2018-bronze-opponent',
        question: 'Which team did Belgium beat to finish third at the 2018 World Cup?',
        options: ['Brazil', 'Croatia', 'England', 'France'], answerIndex: 2,
        explanation: 'Belgium beat England 2–0 in the 2018 third-place play-off.'
      }
    ],
    'bosnia and herzegovina': [{
      id: 'bosnia-2014-debut',
      question: 'At which World Cup did Bosnia and Herzegovina make its debut?',
      options: ['1998', '2002', '2010', '2014'], answerIndex: 3,
      explanation: 'Bosnia and Herzegovina made its first World Cup appearance at Brazil 2014.'
    }],
    'brazil': [{
      id: 'brazil-five-titles',
      question: 'How many men’s World Cup titles has Brazil won?',
      options: ['Three', 'Four', 'Five', 'Six'], answerIndex: 2,
      explanation: 'Brazil has won five men’s World Cups: 1958, 1962, 1970, 1994 and 2002.'
    }],
    'canada': [{
      id: 'canada-1986-debut',
      question: 'At which World Cup did Canada make its men’s tournament debut?',
      options: ['1974', '1982', '1986', '1994'], answerIndex: 2,
      explanation: 'Canada made its first men’s World Cup appearance at Mexico 1986.'
    }],
    'colombia': [{
      id: 'colombia-2014-quarterfinal',
      question: 'What was Colombia’s best men’s World Cup finish?',
      options: ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'], answerIndex: 1,
      explanation: 'Colombia reached the quarter-finals at Brazil 2014, its best World Cup finish.'
    }],
    'dr congo': [{
      id: 'dr-congo-zaire-1974',
      question: 'Under which name did DR Congo appear at the 1974 World Cup?',
      options: ['Congo', 'Leopoldville', 'Zaire', 'Katanga'], answerIndex: 2,
      explanation: 'DR Congo competed as Zaire at West Germany 1974.'
    }],
    'ecuador': [{
      id: 'ecuador-2002-debut',
      question: 'At which World Cup did Ecuador make its debut?',
      options: ['1994', '1998', '2002', '2006'], answerIndex: 2,
      explanation: 'Ecuador made its first World Cup appearance at Korea/Japan 2002.'
    }],
    'egypt': [{
      id: 'egypt-1934-africa-first',
      question: 'Egypt was the first African nation to play at a World Cup. In which year?',
      options: ['1930', '1934', '1938', '1950'], answerIndex: 1,
      explanation: 'Egypt competed at Italy 1934, the first African team to appear at a World Cup.'
    }],
    'england': [
      {
        id: 'england-1966-title',
        question: 'In which year did England win its men’s World Cup?',
        options: ['1950', '1966', '1970', '1990'], answerIndex: 1,
        explanation: 'England won the 1966 World Cup on home soil.'
      },
      {
        id: 'england-hurst-hattrick',
        question: 'Who scored the only hat-trick in a men’s World Cup final, for England in 1966?',
        options: ['Bobby Charlton', 'Geoff Hurst', 'Gary Lineker', 'Bobby Moore'], answerIndex: 1,
        explanation: 'Geoff Hurst scored three times in England’s 1966 final win.'
      }
    ],
    'france': [{
      id: 'france-1998-home-title',
      question: 'France won its first men’s World Cup title on home soil in which year?',
      options: ['1982', '1990', '1998', '2006'], answerIndex: 2,
      explanation: 'France won the 1998 World Cup as host nation.'
    }],
    'ghana': [{
      id: 'ghana-2010-quarterfinal',
      question: 'What was Ghana’s best men’s World Cup finish?',
      options: ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'], answerIndex: 1,
      explanation: 'Ghana reached the quarter-finals at South Africa 2010.'
    }],
    'germany': [{
      id: 'germany-2014-final',
      question: 'Which team did Germany beat in the 2014 World Cup final?',
      options: ['Argentina', 'Brazil', 'Netherlands', 'Spain'], answerIndex: 0,
      explanation: 'Germany beat Argentina 1–0 after extra time in the 2014 final.'
    }],
    'ivory coast': [{
      id: 'ivory-coast-2006-debut',
      question: 'At which World Cup did Ivory Coast make its debut?',
      options: ['1998', '2002', '2006', '2010'], answerIndex: 2,
      explanation: 'Ivory Coast made its first World Cup appearance at Germany 2006.'
    }],
    'japan': [{
      id: 'japan-2002-cohost',
      question: 'Which country co-hosted the 2002 World Cup with Japan?',
      options: ['China', 'South Korea', 'Thailand', 'Vietnam'], answerIndex: 1,
      explanation: 'Japan and South Korea co-hosted the 2002 World Cup.'
    }],
    'mexico': [{
      id: 'mexico-two-hosts',
      question: 'Which pair of World Cups did Mexico host?',
      options: ['1966 and 1982', '1970 and 1986', '1974 and 1990', '1978 and 1994'], answerIndex: 1,
      explanation: 'Mexico hosted the World Cup in 1970 and 1986.'
    }],
    'morocco': [{
      id: 'morocco-2022-semifinal',
      question: 'Morocco became the first team from which continent to reach a men’s World Cup semi-final in 2022?',
      options: ['Africa', 'Asia', 'North America', 'Oceania'], answerIndex: 0,
      explanation: 'Morocco became the first African team to reach a men’s World Cup semi-final at Qatar 2022.'
    }],
    'netherlands': [{
      id: 'netherlands-three-finals',
      question: 'How many men’s World Cup finals have the Netherlands reached?',
      options: ['One', 'Two', 'Three', 'Four'], answerIndex: 2,
      explanation: 'The Netherlands reached the finals in 1974, 1978 and 2010.'
    }],
    'norway': [{
      id: 'norway-1998-brazil',
      question: 'Which team did Norway beat for its men’s World Cup win in 1998?',
      options: ['Brazil', 'Germany', 'Italy', 'Mexico'], answerIndex: 0,
      explanation: 'Norway beat Brazil 2–1 at France 1998.'
    }],
    'paraguay': [{
      id: 'paraguay-2010-quarterfinal',
      question: 'What was Paraguay’s best men’s World Cup finish?',
      options: ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'], answerIndex: 1,
      explanation: 'Paraguay reached the quarter-finals at South Africa 2010.'
    }],
    'portugal': [{
      id: 'portugal-1966-third',
      question: 'What was Portugal’s best men’s World Cup finish?',
      options: ['Champions', 'Runners-up', 'Third place', 'Fourth place'], answerIndex: 2,
      explanation: 'Portugal finished third at England 1966.'
    }],
    'senegal': [{
      id: 'senegal-2002-quarterfinal',
      question: 'What was Senegal’s best men’s World Cup finish?',
      options: ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'], answerIndex: 1,
      explanation: 'Senegal reached the quarter-finals at Korea/Japan 2002.'
    }],
    'south africa': [{
      id: 'south-africa-2010-host',
      question: 'South Africa hosted the first men’s World Cup held on which continent?',
      options: ['Africa', 'Asia', 'North America', 'Oceania'], answerIndex: 0,
      explanation: 'South Africa 2010 was the first men’s World Cup staged in Africa.'
    }],
    'spain': [
      {
        id: 'spain-2010-first-title',
        question: 'In which year did Spain win its first men’s World Cup?',
        options: ['1982', '1994', '2006', '2010'], answerIndex: 3,
        explanation: 'Spain won its first World Cup at South Africa 2010.'
      },
      {
        id: 'spain-2010-final-opponent',
        question: 'Which team did Spain beat in the 2010 World Cup final?',
        options: ['Germany', 'Netherlands', 'Portugal', 'Uruguay'], answerIndex: 1,
        explanation: 'Spain beat the Netherlands 1–0 after extra time in the 2010 final.'
      }
    ],
    'sweden': [{
      id: 'sweden-1958-final',
      question: 'What was Sweden’s best men’s World Cup finish?',
      options: ['Champions', 'Runners-up', 'Third place', 'Fourth place'], answerIndex: 1,
      explanation: 'Sweden finished runners-up as host nation in 1958.'
    }],
    'switzerland': [
      {
        id: 'switzerland-1954-host',
        question: 'Which World Cup did Switzerland host?',
        options: ['1938', '1950', '1954', '1958'], answerIndex: 2,
        explanation: 'Switzerland hosted the 1954 World Cup.'
      },
      {
        id: 'switzerland-1954-quarterfinal',
        question: 'What was Switzerland’s best men’s World Cup finish?',
        options: ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'], answerIndex: 1,
        explanation: 'Switzerland has reached the quarter-finals, including as host in 1954.'
      }
    ],
    'united states': [{
      id: 'united-states-1930-semifinal',
      question: 'At which World Cup did the United States reach the semi-finals?',
      options: ['1930', '1950', '1994', '2002'], answerIndex: 0,
      explanation: 'The United States reached the semi-finals at the inaugural 1930 World Cup.'
    }]
  }

  const WORLD_CUP_GENERAL_TRIVIA = [
    {
      id: 'general-1930-first-host',
      question: 'Which country hosted and won the first men’s World Cup in 1930?',
      options: ['Argentina', 'Brazil', 'Italy', 'Uruguay'], answerIndex: 3,
      explanation: 'Uruguay hosted and won the inaugural World Cup in 1930.'
    },
    {
      id: 'general-2002-cohosts',
      question: 'Which two countries co-hosted the 2002 World Cup?',
      options: ['Japan and South Korea', 'China and Japan', 'Germany and Austria', 'Spain and Portugal'], answerIndex: 0,
      explanation: 'Japan and South Korea co-hosted the 2002 World Cup.'
    },
    {
      id: 'general-2010-africa',
      question: 'Which country hosted the first men’s World Cup held in Africa?',
      options: ['Egypt', 'Morocco', 'Nigeria', 'South Africa'], answerIndex: 3,
      explanation: 'South Africa hosted the 2010 World Cup, the first held in Africa.'
    },
    {
      id: 'general-2022-final',
      question: 'Which two teams played in the 2022 World Cup final?',
      options: ['Argentina and France', 'Brazil and France', 'Croatia and Argentina', 'France and Morocco'], answerIndex: 0,
      explanation: 'Argentina and France drew 3–3 before Argentina won the 2022 final on penalties.'
    },
    {
      id: 'general-rimet-trophy',
      question: 'Which country permanently retained the Jules Rimet Trophy after winning its third World Cup in 1970?',
      options: ['Brazil', 'Germany', 'Italy', 'Uruguay'], answerIndex: 0,
      explanation: 'Brazil won its third World Cup in 1970 and permanently received the Jules Rimet Trophy.'
    },
    {
      id: 'general-four-year-cycle',
      question: 'In the usual cycle, how often is the men’s FIFA World Cup held?',
      options: ['Every two years', 'Every three years', 'Every four years', 'Every five years'], answerIndex: 2,
      explanation: 'The men’s FIFA World Cup is normally held every four years.'
    }
  ]

  function normalizeTeamTriviaKey (value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function triviaTeamNames (input = {}) {
    const match = input.match || input.currentStats || {}
    return [
      match.home && match.home.name || input.homeTeam,
      match.away && match.away.name || input.awayTeam
    ].map(normalizeTeamTriviaKey).filter(Boolean)
  }

  function stableTriviaIndex (value, length) {
    if (!length) return 0
    let hash = 2166136261
    for (const character of String(value || '')) {
      hash ^= character.charCodeAt(0)
      hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0) % length
  }

  function triviaCandidates (input = {}) {
    const [homeKey, awayKey] = triviaTeamNames(input)
    const home = WORLD_CUP_TEAM_TRIVIA[homeKey] || []
    const away = WORLD_CUP_TEAM_TRIVIA[awayKey] || []
    const combined = [...home, ...away]
    const fallback = WORLD_CUP_GENERAL_TRIVIA
    const ordinal = Math.max(0, Number.parseInt(input.roundOrdinal, 10) || 0)
    const pool = ordinal % 4 === 0
      ? (home.length ? home : fallback)
      : ordinal % 4 === 1
        ? (away.length ? away : fallback)
        : ordinal % 4 === 2
          ? (combined.length ? combined : fallback)
          : fallback
    const ordered = pool.slice()
    const featured = ordered[stableTriviaIndex(`${input.matchId || ''}:${ordinal}:${homeKey}:${awayKey}`, ordered.length)]
    return featured ? [featured, ...ordered.filter(candidate => candidate.id !== featured.id)] : fallback.slice()
  }

  function triviaFallbackRound (input = {}) {
    const fallback = triviaCandidates(input)[0] || WORLD_CUP_GENERAL_TRIVIA[0]
    return { ...fallback, category: fallback.id.startsWith('general-') ? 'General football knowledge' : 'Team World Cup history' }
  }

  function normalizeTriviaRound (input, fallbackInput = {}) {
    const parsed = extractJsonObject(input)
    const candidates = triviaCandidates(fallbackInput)
    const requestedId = typeof parsed.questionId === 'string' ? parsed.questionId.trim() : ''
    const questionText = typeof parsed.question === 'string' ? parsed.question.trim() : ''
    const selected = candidates.find(candidate => candidate.id === requestedId || candidate.question === questionText) || triviaFallbackRound(fallbackInput)
    return { ...selected, category: selected.category || (selected.id && selected.id.startsWith('general-') ? 'General football knowledge' : 'Team World Cup history') }
  }

  function triviaPrompt (input = {}) {
    const candidates = triviaCandidates(input)
    return [
      {
        role: 'system',
        content: [
          'You are the QVAC watch-party trivia host for PearCup.',
          'Choose exactly one friendly question from the verified candidate list.',
          'Prefer a question about a team in the active fixture; use the general World Cup choice only when that is the featured category.',
          'Never invent facts, alter a candidate’s answer, give betting advice, or ask about injuries or current player rumours.',
          'Return strict JSON only: {"questionId":"the exact candidate id"}.'
        ].join(' ')
      },
      {
        role: 'user',
        content: core.canonicalJson({
          task: 'select_verified_world_cup_watch_party_trivia',
          language: normalizeLanguage(input.language),
          match: input.match || input.currentStats || {},
          roundOrdinal: Math.max(0, Number.parseInt(input.roundOrdinal, 10) || 0),
          candidates: candidates.map(({ id, question, options, answerIndex, explanation }) => ({ id, question, options, answerIndex, explanation }))
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
      questionId: normalized.id || null,
      category: normalized.category || null,
      question: normalized.question,
      options: normalized.options,
      answerIndex: normalized.answerIndex,
      explanation: normalized.explanation,
      modelId,
      hostId,
      sourceHash: core.deterministicHash({
        match,
        recentEvents: input.recentEvents || [],
        roundOrdinal: Math.max(0, Number.parseInt(input.roundOrdinal, 10) || 0),
        questionId: normalized.id || null
      })
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
    triviaCandidates,
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
