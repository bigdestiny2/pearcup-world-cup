(function attachPearCupAdapters (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const core = root.PearCupCore || (canRequireLocal ? require('./core.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupAdapters')

  function createDemoQvacAdapter ({ refereeId = 'qvac-demo-ref' } = {}) {
    return {
      id: refereeId,
      mode: 'demo',
      attestRound ({ roundResult, review = null }) {
        return core.createQvacRefereeAttestation({ roundResult, refereeId, review })
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
