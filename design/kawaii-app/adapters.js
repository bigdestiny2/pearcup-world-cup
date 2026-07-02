(function attachPearCupAdapters (root) {
  const core = root.PearCupCore || (typeof require !== 'undefined' ? require('./core.js') : null)
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
      createEntryIntent (input) {
        return core.createTetherWdkEntryIntent({ ...input, rail })
      },
      confirmEntryIntent (input) {
        return core.confirmTetherWdkEntryIntent(input)
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
    return {
      id,
      mode: 'sdk',
      createGameEscrow (input) {
        return sdk.createGameEscrow(input)
      },
      releaseGameEscrow (input) {
        return sdk.releaseGameEscrow(input)
      },
      createEntryIntent (input) {
        return sdk.createEntryIntent(input)
      },
      confirmEntryIntent (input) {
        return sdk.confirmEntryIntent(input)
      },
      createPoolPayout (input) {
        return sdk.createPoolPayout(input)
      },
      disputeGameEscrow (input) {
        if (typeof sdk.disputeGameEscrow === 'function') return sdk.disputeGameEscrow(input)
        return createDemoTetherWdkAdapter({ rail: id }).disputeGameEscrow(input)
      }
    }
  }

  function normalizeQvacAdapter (qvac) {
    if (!qvac) return createDemoQvacAdapter()
    if (qvac.mode && typeof qvac.attestRound === 'function' && typeof qvac.attestPoolSettlement === 'function') return qvac
    return createSdkQvacAdapter(qvac)
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

  function createIntegrationAdapters ({ qvac, tetherWdk } = {}) {
    const qvacAdapter = normalizeQvacAdapter(qvac)
    const tetherWdkAdapter = normalizeTetherWdkAdapter(tetherWdk)
    return {
      qvac: qvacAdapter,
      tetherWdk: tetherWdkAdapter,
      mode: {
        qvac: qvacAdapter.mode,
        tetherWdk: tetherWdkAdapter.mode
      }
    }
  }

  const api = {
    createDemoQvacAdapter,
    createDemoTetherWdkAdapter,
    createSdkQvacAdapter,
    createSdkTetherWdkAdapter,
    createIntegrationAdapters
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupAdapters = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupAdapters = 'adapter-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
