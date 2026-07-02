(function attachPearCupPearBrowserCompat (root) {
  const defaultRendererScripts = [
    './core.js',
    './adapters.js',
    './qvac-referee.js',
    './tether-wdk-bridge.js',
    './runtime-settings.js',
    './runtime-config.js',
    './worker-sim.js',
    './worker-client.js',
    './worker-runtime.js',
    './settlement-receipts.js',
    './settlement-service.js',
    './transport-sim.js',
    './storage-sim.js',
    './app.js'
  ]

  const stageRuntimeFiles = [
    '/index.cjs',
    '/package.json',
    '/app/index.html',
    '/app/styles.css',
    '/app/core.js',
    '/app/adapters.js',
    '/app/qvac-referee.js',
    '/app/tether-wdk-bridge.js',
    '/app/runtime-settings.js',
    '/app/runtime-config.js',
    '/app/worker-sim.js',
    '/app/worker-client.js',
    '/app/worker-bridge-protocol.js',
    '/app/pear-worker.cjs',
    '/app/worker-runtime.js',
    '/app/settlement-receipts.js',
    '/app/settlement-service.js',
    '/app/transport-sim.js',
    '/app/storage-sim.js',
    '/app/sdk-runtime.js',
    '/app/live-readiness.js',
    '/app/trusted-path-preflight.js',
    '/app/live-launch-audit.js',
    '/app/app.js',
    '/config/pearcup.runtime.example.json'
  ]

  const workerOnlyRuntimeFiles = [
    '/app/pear-worker.cjs',
    '/app/worker-bridge-protocol.js',
    '/app/sdk-runtime.js',
    '/app/live-readiness.js',
    '/app/trusted-path-preflight.js',
    '/app/live-launch-audit.js'
  ]

  const requiredStageIgnores = [
    '/.git',
    '/.claude',
    '/coverage',
    '/config/pearcup.runtime.json',
    '/design',
    '/docs',
    '/app/*.test.js',
    '/scripts'
  ]

  function clone (value) {
    return JSON.parse(JSON.stringify(value || {}))
  }

  function normalizePath (value) {
    if (!value) return ''
    const text = String(value).replace(/\\/g, '/')
    return text.startsWith('/') ? text : `/${text.replace(/^\.\//, '')}`
  }

  function isRelativeLocalRef (value) {
    const text = String(value || '').trim()
    return Boolean(text) &&
      !/^[a-z][a-z0-9+.-]*:/i.test(text) &&
      !text.startsWith('//') &&
      !text.startsWith('/') &&
      !text.includes('..') &&
      !text.includes('\\')
  }

  function scriptRefsFromHtml (html = '') {
    const refs = []
    const pattern = /<script\b([^>]*)>/gi
    let match
    while ((match = pattern.exec(html))) {
      const attrs = match[1] || ''
      const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)
      const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs)
      refs.push({
        src: src && src[1],
        type: type && type[1] || '',
        attrs
      })
    }
    return refs
  }

  function stylesheetRefsFromHtml (html = '') {
    const refs = []
    const pattern = /<link\b([^>]*\brel\s*=\s*["']stylesheet["'][^>]*)>/gi
    let match
    while ((match = pattern.exec(html))) {
      const attrs = match[1] || ''
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs)
      refs.push(href && href[1])
    }
    return refs.filter(Boolean)
  }

  function cspFromHtml (html = '') {
    const pattern = /<meta\b[^>]*>/gi
    let match
    while ((match = pattern.exec(html))) {
      const tag = match[0]
      if (!/http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(tag)) continue
      const content = /content\s*=\s*(["'])([\s\S]*?)\1/i.exec(tag)
      return content ? content[2] : ''
    }
    return ''
  }

  function inlineScriptCount (html = '') {
    const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
    let count = 0
    let match
    while ((match = pattern.exec(html))) {
      const attrs = match[1] || ''
      const body = match[2] || ''
      if (!/\bsrc\s*=/i.test(attrs) && body.trim()) count += 1
    }
    return count
  }

  function sourceRefsFromHtml (html = '') {
    return [
      ...scriptRefsFromHtml(html).map(item => item.src).filter(Boolean),
      ...stylesheetRefsFromHtml(html)
    ]
  }

  function stagePathFromHtmlRef (ref) {
    return normalizePath(`/app/${String(ref || '').replace(/^\.\//, '')}`)
  }

  function fileExists (files = {}, path) {
    return files[normalizePath(path)] === true
  }

  function check ({ id, label, ok, severity = 'error', detail, source = 'pear-browser-compat' }) {
    const item = {
      id,
      label,
      ok: ok === true,
      status: ok === true ? 'pass' : 'fail',
      severity,
      source
    }
    if (detail) item.detail = detail
    return item
  }

  function summarizeChecks (checks) {
    return {
      passed: checks.filter(item => item.ok).length,
      failed: checks.filter(item => !item.ok).length,
      blocking: checks.filter(item => !item.ok && item.severity === 'error').length,
      warnings: checks.filter(item => !item.ok && item.severity === 'warning').length
    }
  }

  function packageChecks ({ packageJson = {}, files = {} } = {}) {
    const pear = packageJson.pear || {}
    const stage = pear.stage || {}
    const include = new Set((stage.include || []).map(normalizePath))
    const ignore = new Set((stage.ignore || []).map(normalizePath))
    const optionalDeps = packageJson.optionalDependencies || {}

    return [
      check({
        id: 'main-entry',
        label: 'Pear main entrypoint exists',
        ok: packageJson.main === 'index.cjs' && fileExists(files, '/index.cjs'),
        source: 'package.json',
        detail: packageJson.main || 'missing'
      }),
      check({
        id: 'pear-electron-pre',
        label: 'Pear Electron preloader is configured',
        ok: pear.pre === 'pear-electron/pre',
        source: 'package.json',
        detail: pear.pre || 'missing'
      }),
      check({
        id: 'gui-main',
        label: 'Pear GUI main points at app/index.html',
        ok: pear.gui && pear.gui.main === 'app/index.html' && fileExists(files, '/app/index.html'),
        source: 'package.json',
        detail: pear.gui && pear.gui.main || 'missing'
      }),
      check({
        id: 'stage-include-runtime-assets',
        label: 'Pear stage explicitly includes renderer and runtime assets',
        ok: stageRuntimeFiles.every(path => include.has(path)),
        source: 'package.json',
        detail: stageRuntimeFiles.filter(path => !include.has(path)).join(', ')
      }),
      check({
        id: 'pear-worker-bootstrap-staged',
        label: 'Pear worker bootstrap is staged outside the renderer script graph',
        ok: include.has('/app/pear-worker.cjs') &&
          fileExists(files, '/app/pear-worker.cjs') &&
          !defaultRendererScripts.includes('./pear-worker.cjs'),
        source: 'package.json',
        detail: include.has('/app/pear-worker.cjs') ? '' : '/app/pear-worker.cjs'
      }),
      check({
        id: 'stage-ignore-dev-files',
        label: 'Pear stage ignores local-only and sensitive development files',
        ok: requiredStageIgnores.every(path => ignore.has(path)),
        source: 'package.json',
        detail: requiredStageIgnores.filter(path => !ignore.has(path)).join(', ')
      }),
      check({
        id: 'sdk-optional-dependencies',
        label: 'QVAC and Tether WDK packages stay optional for browser startup',
        ok: Boolean(optionalDeps['@qvac/sdk'] && optionalDeps['@tetherto/wdk'] && optionalDeps['@tetherto/wdk-wallet-evm'] && optionalDeps['@tetherto/wdk-wallet-btc']),
        source: 'package.json'
      })
    ]
  }

  function htmlChecks ({ html = '', files = {} } = {}) {
    const scripts = scriptRefsFromHtml(html)
    const scriptSrcs = scripts.map(item => item.src).filter(Boolean)
    const stylesheets = stylesheetRefsFromHtml(html)
    const refs = sourceRefsFromHtml(html)
    const csp = cspFromHtml(html)
    const expectedScriptOrder = defaultRendererScripts.join('|')
    const actualScriptOrder = scriptSrcs.join('|')

    return [
      check({
        id: 'html-local-assets',
        label: 'Renderer HTML uses local relative assets only',
        ok: refs.every(isRelativeLocalRef),
        source: 'app/index.html',
        detail: refs.filter(ref => !isRelativeLocalRef(ref)).join(', ')
      }),
      check({
        id: 'html-assets-exist',
        label: 'Renderer HTML asset references exist in app folder',
        ok: refs.every(ref => fileExists(files, `/app/${ref.replace(/^\.\//, '')}`)),
        source: 'app/index.html',
        detail: refs.filter(ref => !fileExists(files, `/app/${ref.replace(/^\.\//, '')}`)).join(', ')
      }),
      check({
        id: 'classic-scripts',
        label: 'Renderer uses classic scripts instead of module/import-map loading',
        ok: scripts.every(item => !item.type || item.type === 'text/javascript' || item.type === 'application/javascript'),
        source: 'app/index.html',
        detail: scripts.filter(item => item.type && item.type !== 'text/javascript' && item.type !== 'application/javascript').map(item => item.type).join(', ')
      }),
      check({
        id: 'no-inline-scripts',
        label: 'Renderer has no inline scripts',
        ok: inlineScriptCount(html) === 0,
        source: 'app/index.html',
        detail: `${inlineScriptCount(html)} inline script block(s)`
      }),
      check({
        id: 'no-sdk-runtime-in-renderer',
        label: 'Renderer does not load package-backed QVAC/WDK SDK runtime directly',
        ok: !scriptSrcs.includes('./sdk-runtime.js'),
        source: 'app/index.html'
      }),
      check({
        id: 'script-order',
        label: 'Renderer scripts load in dependency order',
        ok: actualScriptOrder === expectedScriptOrder,
        source: 'app/index.html',
        detail: actualScriptOrder
      }),
      check({
        id: 'stylesheet-present',
        label: 'Renderer stylesheet is local and present',
        ok: stylesheets.includes('./styles.css') && fileExists(files, '/app/styles.css'),
        source: 'app/index.html'
      }),
      check({
        id: 'content-security-policy',
        label: 'Renderer declares a local-only Content Security Policy',
        ok: Boolean(csp) &&
          /default-src\s+'self'/.test(csp) &&
          /script-src\s+'self'/.test(csp) &&
          /object-src\s+'none'/.test(csp) &&
          !/unsafe-eval/.test(csp),
        source: 'app/index.html',
        detail: csp || 'missing'
      })
    ]
  }

  function stageHtmlAssetChecks ({ packageJson = {}, html = '' } = {}) {
    const include = new Set((((packageJson.pear || {}).stage || {}).include || []).map(normalizePath))
    const refs = sourceRefsFromHtml(html)
    const stageRefs = refs
      .filter(isRelativeLocalRef)
      .map(stagePathFromHtmlRef)
    const workerOnly = new Set(workerOnlyRuntimeFiles.map(normalizePath))
    const workerOnlyRefs = stageRefs.filter(ref => workerOnly.has(ref))
    const missingStageRefs = stageRefs.filter(ref => !include.has(ref))

    return [
      check({
        id: 'html-assets-staged',
        label: 'Renderer HTML assets are included in the Pear stage manifest',
        ok: missingStageRefs.length === 0,
        source: 'package.json',
        detail: missingStageRefs.join(', ')
      }),
      check({
        id: 'worker-runtime-isolated-from-renderer',
        label: 'Worker-only QVAC, WDK, launch, and bridge runtime files stay out of the renderer graph',
        ok: workerOnlyRefs.length === 0,
        source: 'app/index.html',
        detail: workerOnlyRefs.join(', ')
      })
    ]
  }

  function sourceChecks ({ files = {}, sources = {} } = {}) {
    const appSource = sources['/app/app.js'] || ''
    const coreSource = sources['/app/core.js'] || ''
    const workerClientSource = sources['/app/worker-client.js'] || ''
    const workerBridgeProtocolSource = sources['/app/worker-bridge-protocol.js'] || ''
    const settlementServiceSource = sources['/app/settlement-service.js'] || ''
    const settlementReceiptsSource = sources['/app/settlement-receipts.js'] || ''
    const workerSimSource = sources['/app/worker-sim.js'] || ''
    const adaptersSource = sources['/app/adapters.js'] || ''
    const trustedPathPreflightSource = sources['/app/trusted-path-preflight.js'] || ''
    const liveLaunchAuditSource = sources['/app/live-launch-audit.js'] || ''
    const runtimeSettingsSource = sources['/app/runtime-settings.js'] || ''
    const sdkRuntimeSource = sources['/app/sdk-runtime.js'] || ''
    const tetherWdkBridgeSource = sources['/app/tether-wdk-bridge.js'] || ''
    const qvacRefereeSource = sources['/app/qvac-referee.js'] || ''
    const rendererSources = defaultRendererScripts.map(ref => `/app/${ref.replace(/^\.\//, '')}`)
    const missingSources = rendererSources.filter(path => !sources[path] && fileExists(files, path))
    const nodeTokens = rendererSources.flatMap(path => {
      const source = sources[path] || ''
      if (!source) return []
      const risky = []
      if (/\brequire\s*\(/.test(source) && !/typeof require !== 'undefined'/.test(source)) risky.push(`${path}:require`)
      if (/\bprocess\./.test(source) && !/typeof process !== 'undefined'/.test(source)) risky.push(`${path}:process`)
      if (/\bBuffer\b/.test(source)) risky.push(`${path}:Buffer`)
      if (/from\s+['"]node:|require\(['"]node:/.test(source)) risky.push(`${path}:node-builtin`)
      return risky
    })

    return [
      check({
        id: 'renderer-sources-readable',
        label: 'All renderer script sources are readable for compatibility audit',
        ok: missingSources.length === 0,
        detail: missingSources.join(', ')
      }),
      check({
        id: 'renderer-node-globals-guarded',
        label: 'Renderer scripts avoid unguarded Node globals',
        ok: nodeTokens.length === 0,
        detail: nodeTokens.join(', ')
      }),
      check({
        id: 'local-storage-guarded',
        label: 'Renderer state persistence is guarded for restricted webviews',
        ok: /function loadState[\s\S]*try[\s\S]*localStorage/.test(appSource) &&
          /function persist[\s\S]*try[\s\S]*localStorage/.test(appSource),
        source: 'app/app.js'
      }),
      check({
        id: 'pear-worker-bridge-fallback',
        label: 'Renderer worker client supports Pear bridge detection and local fallback',
        ok: /function createAutoWorkerClient/.test(workerClientSource) &&
          /function createBridgeWorkerClient/.test(workerClientSource) &&
          /function createLocalWorkerClient/.test(workerClientSource) &&
          /PearCupWorkerBridge/.test(workerClientSource) &&
          /\.Pear\.worker/.test(workerClientSource) &&
          /\.Pear\.bridge/.test(workerClientSource) &&
          /PearCupWorkerClient\.createAutoWorkerClient/.test(appSource),
        source: 'app/worker-client.js'
      }),
      check({
        id: 'bracket-submissions-worker-evidence',
        label: 'Renderer bracket submissions use worker evidence instead of manual winners',
        ok: /type:\s*['"]bracket:submit['"]/.test(appSource) &&
          /submittedPicksByTier/.test(appSource) &&
          /settleBracketPoolWithReceipt/.test(appSource) &&
          /sourceBracketSubmissionIds/.test(appSource) &&
          !/winnerUserIds:\s*\[[^\]]*entrants\[0\]\.userId/.test(appSource),
        source: 'app/app.js'
      }),
      check({
        id: 'profile-bracket-state-worker-owned',
        label: 'Worker owns signed profile and bracket draft state before renderer settlement',
        ok: /'profile:set'/.test(workerSimSource) &&
          /'bracket:updateDraft'/.test(workerSimSource) &&
          /'bracket:resetDraft'/.test(workerSimSource) &&
          /ProfileUpdated/.test(workerSimSource) &&
          /BracketDraftUpdated/.test(workerSimSource) &&
          /function profileMatchesReplay/.test(workerSimSource) &&
          /function bracketDraftMatchesReplay/.test(workerSimSource) &&
          /return profileMatchesReplay\(event\)/.test(workerSimSource) &&
          /return bracketDraftMatchesReplay\(event\)/.test(workerSimSource) &&
          /Profile update actorId must match userId/.test(workerSimSource) &&
          /Bracket draft actorId must match userId/.test(workerSimSource) &&
          /profilesByTeam/.test(workerSimSource) &&
          /bracketDraftsByPool/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'profile-bracket-renderer-worker-backed',
        label: 'Renderer profile and bracket draft actions use the Pear worker client',
        ok: /const appStateClient = PearCupWorkerClient\.createAutoWorkerClient/.test(appSource) &&
          /function ensureAppStateSeeded/.test(appSource) &&
          /appStateClient\.view\(\)/.test(appSource) &&
          /appStateClient\.dispatchAsync\(command\)/.test(appSource) &&
          /appStateClient\.refresh/.test(appSource) &&
          /type:\s*'profile:set'/.test(appSource) &&
          /type:\s*'bracket:updateDraft'/.test(appSource) &&
          /type:\s*'bracket:resetDraft'/.test(appSource) &&
          /type:\s*'bracket:submit'/.test(appSource) &&
          /bracketDraftForTier/.test(appSource) &&
          /bracketSubmissionForTier/.test(appSource) &&
          /app-state\/profile-brackets\/events/.test(appSource) &&
          !/state\.picks\[button\.dataset\.match\]\s*=/.test(appSource),
        source: 'app/app.js'
      }),
      check({
        id: 'payout-recipients-guarded-service',
        label: 'Renderer payout recipient declarations go through the guarded settlement service',
        ok: /declarePayoutRecipient/.test(appSource) &&
          /settleBracketPoolWithReceipt/.test(appSource) &&
          !/type:\s*['"]payout:declareRecipient['"]/.test(appSource),
        source: 'app/app.js'
      }),
      check({
        id: 'qvac-referee-via-trusted-settlement',
        label: 'Renderer does not dispatch low-level QVAC referee commands directly',
        ok: /settleGameRoundWithReceipt/.test(appSource) &&
          /settleBracketPoolWithReceipt/.test(appSource) &&
          !/type:\s*['"]qvac:(?:refereeAttest|attestPoolSettlement)['"]/.test(appSource),
        source: 'app/app.js'
      }),
      check({
        id: 'game-settlement-storage-durable',
        label: 'Renderer Penalty Clash settlement replays durable game namespace evidence instead of a memory-only log',
        ok: /const GAME_SETTLEMENT_ID = 'pc-brazil-norway-room'/.test(appSource) &&
          /function createGameSettlementEventStore/.test(appSource) &&
          /pearcup-game-settlement-storage/.test(appSource) &&
          /function gameSettlementNamespace \(gameId = GAME_SETTLEMENT_ID\) \{\s*return PearCupStorageSim\.gameNamespace\(gameId\)\s*\}/.test(appSource) &&
          /const eventStore = createGameSettlementEventStore\(gameId\)/.test(appSource) &&
          /function existingGameEscrowEvent/.test(appSource) &&
          /dispatchGameEvidenceIfNeeded\(worker, 'commitments'/.test(appSource) &&
          /dispatchGameEvidenceIfNeeded\(worker, 'reveals'/.test(appSource) &&
          !/backend:\s*PearCupStorageSim\.createMemoryBackend\(\),\s*rootId:\s*'pearcup-demo',\s*namespace:\s*PearCupStorageSim\.gameNamespace\(gameId\)/.test(appSource),
        source: 'app/app.js'
      }),
      check({
        id: 'demo-settlement-local-fallback',
        label: 'Renderer demo settlement uses local workers while live-ready settlement can prefer the Pear bridge',
        ok: /function createBracketSettlementWorker[\s\S]*const local = \(\) =>[\s\S]*if \(!integrationRuntime\.canUseRealMoney\) return local\(\)[\s\S]*PearCupWorkerClient\.createAutoWorkerClient/.test(appSource) &&
          /function createPenaltySettlementWorker[\s\S]*const local = \(\) =>[\s\S]*if \(!integrationRuntime\.canUseRealMoney\) return local\(\)[\s\S]*PearCupWorkerClient\.createAutoWorkerClient/.test(appSource),
        source: 'app/app.js'
      }),
      check({
        id: 'renderer-game-state-hash-before-settlement',
        label: 'Renderer submits peer state hashes before trusted Penalty Clash settlement',
        ok: /PearCupCore\.createPenaltyClashRound/.test(appSource) &&
          /expectedRound\.stateHash/.test(appSource) &&
          /dispatchGameEvidenceIfNeeded\(worker, 'roundStateHashes'/.test(appSource) &&
          /type:\s*'game:submitRoundStateHash'/.test(appSource) &&
          /settleGameRoundWithReceipt/.test(appSource) &&
          appSource.indexOf("type: 'game:submitRoundStateHash'") < appSource.indexOf('settleGameRoundWithReceipt({'),
        source: 'app/app.js'
      }),
      check({
        id: 'bridge-events-opt-in',
        label: 'Pear worker bridge returns event history only when explicitly requested',
        ok: /function envelopeWantsEvents/.test(workerBridgeProtocolSource) &&
          /eventsIncluded:\s*includeEvents === true/.test(workerBridgeProtocolSource) &&
          /events:\s*includeEvents\s*\?\s*workerEventsFrom\(activeHarness\)\s*:\s*\[\]/.test(workerBridgeProtocolSource) &&
          /includeEvents:\s*true/.test(workerClientSource),
        source: 'app/worker-bridge-protocol.js'
      }),
      check({
        id: 'bridge-trusted-settlement-demo-guard',
        label: 'Pear worker bridge lets trusted settlement helpers opt into demo-allowed mode without unlocking raw prize dispatch',
        ok: /function settlementServiceForRequest/.test(workerBridgeProtocolSource) &&
          /typeof opts\.requireLive !== 'boolean'/.test(workerBridgeProtocolSource) &&
          /requireLive:\s*opts\.requireLive/.test(workerBridgeProtocolSource) &&
          /responseService = settlementServiceForRequest\(\{ activeService, harness, opts: requestOpts \}\)/.test(workerBridgeProtocolSource) &&
          /result = await responseService\.settleGameRoundWithReceipt/.test(workerBridgeProtocolSource) &&
          /result = await responseService\.settleBracketPoolWithReceipt/.test(workerBridgeProtocolSource) &&
          /service:\s*responseService/.test(workerBridgeProtocolSource) &&
          /service\.assertLive\(command\.type\)/.test(workerBridgeProtocolSource) &&
          /requireLive:\s*integrationRuntime\.canUseRealMoney/.test(appSource),
        source: 'app/worker-bridge-protocol.js, app/app.js'
      }),
      check({
        id: 'settlement-receipts-guarded',
        label: 'Settlement receipt recording is guarded and not renderer-dispatched',
        ok: /'settlement:recordReceipt'/.test(settlementServiceSource) &&
          /guardPrizeCommand\('settlement:recordReceipt'\)/.test(settlementServiceSource) &&
          !/type:\s*['"]settlement:recordReceipt['"]/.test(appSource),
        source: 'app/settlement-service.js'
      }),
      check({
        id: 'settlement-receipts-evidence-gated',
        label: 'Receipt-producing helpers wait for QVAC and WDK evidence before recording',
        ok: /function receiptEvidenceStatus \(summary = \{\}\)/.test(settlementServiceSource) &&
          /Settlement receipt requires \$\{missing\.join\(', '\)\} before recording/.test(settlementServiceSource) &&
          /const evidence = receiptEvidenceStatus\(summary\)/.test(settlementServiceSource) &&
          /receipt:\s*null/.test(settlementServiceSource) &&
          /receiptEvent:\s*null/.test(settlementServiceSource) &&
          /held:\s*true/.test(settlementServiceSource) &&
          /receiptHeld:\s*recorded\.held === true/.test(settlementServiceSource) &&
          /receiptMissing:\s*recorded\.missing \|\| \[\]/.test(settlementServiceSource),
        source: 'app/settlement-service.js'
      }),
      check({
        id: 'raw-settlement-evidence-guarded',
        label: 'Raw settlement resolution commands are guarded behind trusted settlement paths',
        ok: /'game:resolveRound'/.test(settlementServiceSource) &&
          /'game:submitRoundStateHash'/.test(settlementServiceSource) &&
          /'game:recordForfeit'/.test(settlementServiceSource) &&
          /'results:recordOfficialSnapshot'/.test(settlementServiceSource) &&
          /'pool:resolveSettlement'/.test(settlementServiceSource) &&
          /settleGameRoundWithReceipt/.test(appSource) &&
          /settleBracketPoolWithReceipt/.test(appSource) &&
          !/type:\s*['"]game:resolveRound['"]/.test(appSource) &&
          !/type:\s*['"]game:recordForfeit['"]/.test(appSource) &&
          !/type:\s*['"]results:recordOfficialSnapshot['"]/.test(appSource) &&
          !/type:\s*['"]pool:resolveSettlement['"]/.test(appSource),
        source: 'app/settlement-service.js'
      }),
      check({
        id: 'peer-settlement-artifacts-dependent',
        label: 'Peer-merged WDK and receipt artifacts require replay dependencies',
        ok: /function settlementEventDependenciesSatisfied/.test(workerSimSource) &&
          /TetherWdkEscrowReleased/.test(workerSimSource) &&
          /QvacRefereeAttestationCreated/.test(workerSimSource) &&
          /TetherWdkPoolPayoutPrepared/.test(workerSimSource) &&
          /QvacPoolSettlementAttestationCreated/.test(workerSimSource) &&
          /SettlementReceiptCreated/.test(workerSimSource) &&
          /indexedSourceEventsPresent/.test(workerSimSource) &&
          /verifiedGameReleaseMatchesReplay/.test(workerSimSource) &&
          /verifiedPoolPayoutMatchesReplay/.test(workerSimSource) &&
          /settlementReceiptMatchesReplay/.test(workerSimSource) &&
          /receiptEventRootMatchesReplay/.test(workerSimSource) &&
          /eventRefMatchesReplay/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'settlement-receipt-actor-refs-bound',
        label: 'Settlement receipts bind QVAC and WDK event refs to signer actors',
        ok: /actorId: event\.actorId \|\| null/.test(settlementReceiptsSource) &&
          /eventActorId: attestationEvent\.actorId \|\| null/.test(settlementReceiptsSource) &&
          /eventActorId: settlementEvent\.actorId \|\| null/.test(settlementReceiptsSource) &&
          /Settlement receipt QVAC event actorId must match referee id/.test(settlementReceiptsSource) &&
          /Settlement receipt WDK event actorId must match rail/.test(settlementReceiptsSource) &&
          /Settlement receipt QVAC snapshot actorId does not match event ref/.test(settlementReceiptsSource) &&
          /Settlement receipt WDK snapshot actorId does not match event ref/.test(settlementReceiptsSource) &&
          /if \(ref\.actorId && event\.actorId !== ref\.actorId\) return false/.test(workerSimSource),
        source: 'app/settlement-receipts.js'
      }),
      check({
        id: 'processor-transfer-evidence-required',
        label: 'Trusted path preflight and launch audit require non-empty WDK processor transfer evidence',
        ok: /function processorEvidenceReady/.test(trustedPathPreflightSource) &&
          /transferCount > 0/.test(trustedPathPreflightSource) &&
          /transferStatuses\[status\] > 0/.test(trustedPathPreflightSource) &&
          /processorEvidenceReady\(processor\)/.test(trustedPathPreflightSource) &&
          /processorEvidenceReady\(release\)/.test(trustedPathPreflightSource) &&
          /function processorEvidenceReady/.test(liveLaunchAuditSource) &&
          /trusted-path-processor-evidence/.test(liveLaunchAuditSource) &&
          /trusted-game-processor-evidence/.test(liveLaunchAuditSource) &&
          /processorEvidenceReady\(trustedReport\.receipt\.processorPayout\)/.test(liveLaunchAuditSource) &&
          /processorEvidenceReady\(trustedGameReport\.receipt\.processorRelease\)/.test(liveLaunchAuditSource),
        source: 'app/trusted-path-preflight.js'
      }),
      check({
        id: 'qvac-loadable-model-required',
        label: 'Launch gates require a loadable QVAC model source, not only a model label',
        ok: /function qvacLoadableModelConfigured/.test(liveLaunchAuditSource) &&
          /qvac\.modelSrc \|\| qvac\.modelExport \|\| qvac\.preloadedModelId/.test(liveLaunchAuditSource) &&
          !/qvac\.modelSrc \|\| qvac\.modelExport \|\| qvac\.modelId \|\| qvac\.preloadedModelId/.test(liveLaunchAuditSource) &&
          /missing modelSrc, modelExport, or preloadedModelId/.test(liveLaunchAuditSource) &&
          /PEARCUP_QVAC_PRELOADED_MODEL_ID/.test(runtimeSettingsSource) &&
          /configured\.preloadedModelId/.test(runtimeSettingsSource) &&
          /if \(preloadedModelId\) settings\.preloadedModelId = preloadedModelId/.test(runtimeSettingsSource) &&
          /!qvac\.modelSrc && !qvac\.modelExport && !qvac\.preloadedModelId/.test(runtimeSettingsSource) &&
          /Set a QVAC modelSrc, modelExport, or preloadedModelId/.test(runtimeSettingsSource),
        source: 'app/live-launch-audit.js'
      }),
      check({
        id: 'qvac-auto-unload-honored',
        label: 'Package-backed QVAC referee honors autoUnload for worker-loaded models',
        ok: /let ownsLoadedModel = false/.test(sdkRuntimeSource) &&
          /async function unloadOwnedModel/.test(sdkRuntimeSource) &&
          /if \(autoUnload === true\) await unloadOwnedModel\(\)/.test(sdkRuntimeSource) &&
          /loadedModelId = preloadedModelId \|\| null/.test(sdkRuntimeSource) &&
          /ownsLoadedModel/.test(sdkRuntimeSource),
        source: 'app/sdk-runtime.js'
      }),
      check({
        id: 'qvac-review-fail-closed',
        label: 'QVAC attestations fail closed unless supplied reviews are explicitly verified',
        ok: /function reviewBlocksAttestation/.test(coreSource) &&
          /review && review\.ruling !== 'verified'/.test(coreSource) &&
          (coreSource.match(/reviewBlocksAttestation\(review\)/g) || []).length >= 2,
        source: 'app/core.js'
      }),
      check({
        id: 'qvac-referee-id-required',
        label: 'QVAC attestation verification requires referee identity before accepting signatures',
        ok: /QVAC attestation refereeId is required/.test(coreSource) &&
          /QVAC pool attestation refereeId is required/.test(coreSource) &&
          /attestation\.attestationId !== expected\.attestationId/.test(coreSource) &&
          /attestation\.signature !== expected\.signature/.test(coreSource),
        source: 'app/core.js'
      }),
      check({
        id: 'qvac-adapter-output-verified-before-log',
        label: 'Worker verifies QVAC adapter output before appending referee attestation events',
        ok: /function appendVerifiedRoundAttestation/.test(workerSimSource) &&
          /core\.verifyQvacRoundAttestation/.test(workerSimSource) &&
          /function appendVerifiedPoolAttestation/.test(workerSimSource) &&
          /core\.verifyQvacPoolSettlementAttestation/.test(workerSimSource) &&
          /QVAC attestation failed verification/.test(workerSimSource) &&
          /QVAC pool attestation failed verification/.test(workerSimSource) &&
          /appendVerifiedRoundAttestation\(\{ roundResult, attestation, actorId \}\)/.test(workerSimSource) &&
          /appendVerifiedPoolAttestation\(\{ poolResult, attestation, actorId \}\)/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'qvac-attestation-signer-bound',
        label: 'Worker binds replayed QVAC attestation events to the referee actor before WDK settlement',
        ok: /function qvacAttestationSignerMatches/.test(workerSimSource) &&
          /function qvacAttestationSignerMatches \(event\) \{\s*const payload = event && event\.payload \|\| \{\}\s*return Boolean\(payload\.refereeId && event\.actorId === payload\.refereeId\)\s*\}/.test(workerSimSource) &&
          /function qvacAttestationSignerMismatchReason/.test(workerSimSource) &&
          /QVAC attestation actorId must match refereeId/.test(workerSimSource) &&
          /event\.type === 'QvacRefereeAttestationCreated' \|\| event\.type === 'QvacPoolSettlementAttestationCreated'/.test(workerSimSource) &&
          /if \(!qvacAttestationSignerMatches\(event\)\) continue/.test(workerSimSource) &&
          /append\('QvacRefereeAttestationCreated', attestation, attestation\.refereeId\)/.test(workerSimSource) &&
          /append\('QvacPoolSettlementAttestationCreated', attestation, attestation\.refereeId\)/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'qvac-commentary-replay-grounded',
        label: 'Worker-owned QVAC commentary is grounded in replayed match events and source-signed stats',
        ok: /createQvacCompletionCommentaryAdapter/.test(qvacRefereeSource) &&
          /commentaryPrompt/.test(qvacRefereeSource) &&
          /createDemoQvacCommentaryAdapter/.test(adaptersSource) &&
          /qvacCommentary/.test(adaptersSource) &&
          /MatchEventIngested/.test(workerSimSource) &&
          /function matchEventSignerMatches/.test(workerSimSource) &&
          /function statSnapshotForEvents/.test(workerSimSource) &&
          /function commentarySegmentMatchesReplay/.test(workerSimSource) &&
          /payload\.eventHash !== core\.deterministicHash\(sourceEventIds\)/.test(workerSimSource) &&
          /sourceEvent\.type === 'MatchEventIngested'/.test(workerSimSource) &&
          /sourceEvent\.payload\.matchId === payload\.matchId/.test(workerSimSource) &&
          /matchEventSignerMatches\(sourceEvent\)/.test(workerSimSource) &&
          /event\.type === 'CommentaryGenerated'/.test(workerSimSource) &&
          /commentary:generate/.test(workerSimSource) &&
          /createQvacSdkCommentaryAdapter/.test(sdkRuntimeSource),
        source: 'app/qvac-referee.js, app/adapters.js, app/worker-sim.js, app/sdk-runtime.js'
      }),
      check({
        id: 'live-match-renderer-worker-backed',
        label: 'Renderer live stats and QVAC commentary read from worker-owned match events',
        ok: /const liveMatchClient = PearCupWorkerClient\.createAutoWorkerClient/.test(appSource) &&
          /function ensureLiveMatchSeeded/.test(appSource) &&
          /liveMatchClient\.view\(\)/.test(appSource) &&
          /liveMatchClient\.dispatchAsync\(command\)/.test(appSource) &&
          /liveMatchClient\.refresh/.test(appSource) &&
          /type:\s*'match:ingestEvent'/.test(appSource) &&
          /type:\s*'commentary:setLanguage'/.test(appSource) &&
          /type:\s*'commentary:generate'/.test(appSource) &&
          /matches\/\$\{matchId\}\/events/.test(appSource) &&
          /liveMatchStatRows\(\)\.map/.test(appSource) &&
          /liveCommentaryLines\(state\.language\)\.map/.test(appSource) &&
          !/commentary\[state\.language\]\.map/.test(appSource) &&
          !/matchStats\.map/.test(appSource),
        source: 'app/app.js'
      }),
      check({
        id: 'p2p-game-session-lifecycle-replay-bound',
        label: 'Worker-owned P2P game sessions are invite, accept, and join events bound to replayed signer evidence',
        ok: /'game:invite'/.test(workerSimSource) &&
          /'game:acceptInvite'/.test(workerSimSource) &&
          /'game:join'/.test(workerSimSource) &&
          /GameInviteCreated/.test(workerSimSource) &&
          /GameInviteAccepted/.test(workerSimSource) &&
          /GameSessionStarted/.test(workerSimSource) &&
          /GameSessionJoined/.test(workerSimSource) &&
          /function gameInviteSignerMatches/.test(workerSimSource) &&
          /function gameInviteAcceptanceMatchesReplay/.test(workerSimSource) &&
          /function gameSessionStartedMatchesReplay/.test(workerSimSource) &&
          /function gameSessionJoinMatchesReplay/.test(workerSimSource) &&
          /return gameInviteSignerMatches\(event\)/.test(workerSimSource) &&
          /return gameInviteAcceptanceMatchesReplay\(event, index\)/.test(workerSimSource) &&
          /return gameSessionStartedMatchesReplay\(event, index\)/.test(workerSimSource) &&
          /return gameSessionJoinMatchesReplay\(event, index\)/.test(workerSimSource) &&
          /gameTopicHash/.test(workerSimSource) &&
          /openGameInvites/.test(workerSimSource) &&
          /activeGameSessions/.test(workerSimSource) &&
          /Game invite accept actorId must match opponent userId/.test(workerSimSource) &&
          /Only invited players can join as participants/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'watch-party-social-worker-owned',
        label: 'Worker owns watch-party room, chat, voice, and stream state with replayed membership and rights checks',
        ok: /'room:join'/.test(workerSimSource) &&
          /'chat:send'/.test(workerSimSource) &&
          /'voice:update'/.test(workerSimSource) &&
          /'stream:start'/.test(workerSimSource) &&
          /'stream:stop'/.test(workerSimSource) &&
          /function roomJoinMatchesReplay/.test(workerSimSource) &&
          /function chatMessageMatchesReplay/.test(workerSimSource) &&
          /function voiceStateMatchesReplay/.test(workerSimSource) &&
          /function streamStartMatchesReplay/.test(workerSimSource) &&
          /function streamStopMatchesReplay/.test(workerSimSource) &&
          /return roomJoinMatchesReplay\(event\)/.test(workerSimSource) &&
          /return chatMessageMatchesReplay\(event, index\)/.test(workerSimSource) &&
          /return voiceStateMatchesReplay\(event, index\)/.test(workerSimSource) &&
          /return streamStartMatchesReplay\(event, index\)/.test(workerSimSource) &&
          /return streamStopMatchesReplay\(event, index\)/.test(workerSimSource) &&
          /Replayed room join is required before chat send/.test(workerSimSource) &&
          /Streaming rights must be confirmed before stream start/.test(workerSimSource) &&
          /payload\.rightsConfirmed === true/.test(workerSimSource) &&
          /roomParticipants/.test(workerSimSource) &&
          /chatMessagesByRoom/.test(workerSimSource) &&
          /voiceStatesByRoom/.test(workerSimSource) &&
          /activeStreamsByRoom/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'watch-room-renderer-worker-backed',
        label: 'Renderer watch room reads and writes room state through the Pear worker client',
        ok: /const watchRoomClient = PearCupWorkerClient\.createAutoWorkerClient/.test(appSource) &&
          /function ensureWatchRoomSeeded/.test(appSource) &&
          /watchRoomClient\.view\(\)/.test(appSource) &&
          /watchRoomClient\.dispatchAsync\(command\)/.test(appSource) &&
          /watchRoomClient\.refresh/.test(appSource) &&
          /type:\s*'room:join'/.test(appSource) &&
          /type:\s*'chat:send'/.test(appSource) &&
          /type:\s*'voice:update'/.test(appSource) &&
          /type:\s*'stream:start'/.test(appSource) &&
          /type:\s*'stream:stop'/.test(appSource) &&
          /watchRoomNamespace/.test(appSource) &&
          /rooms\/\$\{roomId\}\/events/.test(appSource) &&
          /#streamToggle/.test(appSource) &&
          !/state\.chat\.map/.test(appSource) &&
          !/state\.voice\s*=/.test(appSource),
        source: 'app/app.js'
      }),
      check({
        id: 'wdk-adapter-output-verified-before-log',
        label: 'Worker verifies WDK adapter output before appending release or payout events',
        ok: /function appendVerifiedGameRelease/.test(workerSimSource) &&
          /verifiedGameReleaseMatchesReplay\(\{ payload: payout, actorId: rail \}, index\)/.test(workerSimSource) &&
          /function appendVerifiedPoolPayout/.test(workerSimSource) &&
          /verifiedPoolPayoutMatchesReplay\(\{ payload: poolPayout, actorId: rail \}, index\)/.test(workerSimSource) &&
          /WDK escrow release output did not match replayed QVAC, escrow, and round evidence/.test(workerSimSource) &&
          /WDK pool payout output did not match replayed QVAC, payment, and pool evidence/.test(workerSimSource) &&
          /appendVerifiedGameRelease\(\{ payload, payout, actorId, awaitAdapters \}\)/.test(workerSimSource) &&
          /appendVerifiedPoolPayout\(\{ payload, poolPayout, actorId \}\)/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'p2p-state-hash-consensus-before-qvac',
        label: 'Worker rejects missing or mismatched peer state hashes before QVAC attestation and WDK release',
        ok: /GameRoundStateHashSubmitted/.test(workerSimSource) &&
          /function verifyRoundStateHashConsensus/.test(workerSimSource) &&
          /Peer state hash missing/.test(workerSimSource) &&
          /Peer state hash mismatch/.test(workerSimSource) &&
          /submittedBy\.has/.test(workerSimSource) &&
          /const stateHashConsensus = verifyRoundStateHashConsensus/.test(workerSimSource) &&
          /if \(!stateHashConsensus\.ok\)/.test(workerSimSource) &&
          /peerStateHashEventIds/.test(workerSimSource) &&
          /roundResult\.sourceEventIds = \[\.\.\.baseSourceEventIds, \.\.\.peerStateHashEventIds\]/.test(workerSimSource) &&
          /Peer state hash source event mismatch/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'p2p-player-evidence-signer-bound',
        label: 'Worker binds P2P round evidence to the player that signed it',
        ok: /function playerEvidenceSignerMatches/.test(workerSimSource) &&
          /Boolean\(payload\.playerId && event\.actorId === payload\.playerId\)/.test(workerSimSource) &&
          /function playerEvidenceSignerMismatchReason/.test(workerSimSource) &&
          /appendPlayerEvidenceSignerDispute/.test(workerSimSource) &&
          /evidenceType: 'Commitment'/.test(workerSimSource) &&
          /evidenceType: 'Reveal'/.test(workerSimSource) &&
          /evidenceType: 'Peer state hash'/.test(workerSimSource) &&
          /Round source event/.test(workerSimSource) &&
          /signer must match playerId/.test(workerSimSource) &&
          /Peer state hash source event signer must match playerId/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'bracket-submission-signer-bound',
        label: 'Worker binds bracket submissions to the entrant signature before pool settlement',
        ok: /function bracketSubmissionSignerMatches/.test(workerSimSource) &&
          /function bracketSubmissionSignerMatches \(event\) \{\s*const payload = event && event\.payload \|\| \{\}\s*return Boolean\(payload\.userId && event\.actorId === payload\.userId\)\s*\}/.test(workerSimSource) &&
          /function bracketSubmissionSignerMismatchReason/.test(workerSimSource) &&
          /Bracket submission actorId must match userId/.test(workerSimSource) &&
          /BracketSubmissionRejected/.test(workerSimSource) &&
          /Bracket submission source event signer must match userId/.test(workerSimSource) &&
          (workerSimSource.match(/bracketSubmissionSignerMatches\(event\)/g) || []).length >= 2,
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'entry-intent-signer-bound',
        label: 'Worker binds WDK entry intents to the entrant signature before pool payment evidence',
        ok: /function entryIntentSignerMatches/.test(workerSimSource) &&
          /function entryIntentSignerMatches \(event\) \{\s*const payload = event && event\.payload \|\| \{\}\s*return Boolean\(payload\.userId && event\.actorId === payload\.userId\)\s*\}/.test(workerSimSource) &&
          /function paymentMatchesSignedEntryIntent/.test(workerSimSource) &&
          /function entryIntentSignerMismatchReason/.test(workerSimSource) &&
          /Entry intent actorId must match userId/.test(workerSimSource) &&
          /TetherWdkEntryIntentRejected/.test(workerSimSource) &&
          /Pool payment source event missing entrant-signed TetherWdkEntryIntentCreated/.test(workerSimSource) &&
          /Entry intent source event signer must match userId/.test(workerSimSource) &&
          /Pool payment source event does not match signed entry intent/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'entry-payment-rail-signer-bound',
        label: 'Worker binds WDK entry confirmations to the rail actor before pool settlement',
        ok: /function entryPaymentSignerMatches/.test(workerSimSource) &&
          /function entryPaymentSignerMatches \(\{ event, intentEvent \}\) \{\s*const payment = event && event\.payload \|\| null\s*const intent = intentEvent && intentEvent\.payload \|\| null\s*const rail = entryPaymentRailFor\(\{ payment, intent \}\)\s*return Boolean\(rail && event\.actorId === rail\)\s*\}/.test(workerSimSource) &&
          /function entryPaymentSignerMismatchReason/.test(workerSimSource) &&
          /Entry payment actorId must match WDK rail/.test(workerSimSource) &&
          /appendEntryPaymentConfirmed/.test(workerSimSource) &&
          /append\('TetherWdkEntryConfirmed', confirmed, rail \|\| actorId\)/.test(workerSimSource) &&
          /if \(!entryPaymentSignerMatches\(\{ event, intentEvent \}\)\) continue/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'entry-payment-check-rail-signer-bound',
        label: 'Worker binds WDK pending entry checks to the rail actor before replay',
        ok: /function entryPaymentCheckMatchesReplay/.test(workerSimSource) &&
          /function entryPaymentCheckSignerMatches/.test(workerSimSource) &&
          /TetherWdkEntryPaymentPending/.test(workerSimSource) &&
          /if \(event\.type === 'TetherWdkEntryPaymentPending'\) \{\s*return entryPaymentCheckMatchesReplay\(event, index\)\s*\}/.test(workerSimSource) &&
          /if \(!entryPaymentCheckMatchesSignedEntryIntent\(\{ check: payload, intentEvent \}\)\) continue/.test(workerSimSource) &&
          /if \(!entryPaymentCheckSignerMatches\(\{ event, intentEvent \}\)\) continue/.test(workerSimSource) &&
          /append\('TetherWdkEntryPaymentPending', pending, rail \|\| actorId\)/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'entry-refund-rail-signer-bound',
        label: 'Worker binds WDK entry refunds to the rail actor and excludes refunded payments from settlement',
        ok: /function entryRefundMatchesReplay/.test(workerSimSource) &&
          /function entryRefundSignerMatches/.test(workerSimSource) &&
          /Entry refund actorId must match WDK rail/.test(workerSimSource) &&
          /TetherWdkEntryRefunded/.test(workerSimSource) &&
          /if \(event\.type === 'TetherWdkEntryRefunded'\) \{\s*return entryRefundMatchesReplay\(event, index\)\s*\}/.test(workerSimSource) &&
          /delete view\.entryPayments\[payload\.paymentId\]/.test(workerSimSource) &&
          /current\.entryRefundsByPayment\[entry\.paymentId\]/.test(workerSimSource) &&
          /Pool source payment \$\{paymentId \|\| 'unknown-payment'\} has been refunded by WDK rail/.test(workerSimSource) &&
          /'wdk:refundEntryIntent'/.test(settlementServiceSource) &&
          /refundEntryIntent/.test(adaptersSource),
        source: 'app/worker-sim.js, app/settlement-service.js, app/adapters.js'
      }),
      check({
        id: 'wdk-settlement-rail-signer-bound',
        label: 'Worker binds WDK release and payout events to the rail actor before replay',
        ok: /function wdkSettlementSignerMatches/.test(workerSimSource) &&
          /function wdkSettlementSignerMatches \(event\) \{\s*const payload = event && event\.payload \|\| \{\}\s*const rail = wdkSettlementRailFor\(payload\)\s*return Boolean\(rail && event\.actorId === rail\)\s*\}/.test(workerSimSource) &&
          /function wdkSettlementSignerMismatchReason/.test(workerSimSource) &&
          /WDK settlement actorId must match rail/.test(workerSimSource) &&
          /if \(!wdkSettlementSignerMatches\(event\)\) return false/.test(workerSimSource) &&
          /payload\.rail === escrow\.rail/.test(workerSimSource) &&
          /confirmedEntries\.some\(entry => entry\.rail !== payload\.rail\)/.test(workerSimSource) &&
          /append\('TetherWdkEscrowReleased', payout, rail \|\| actorId\)/.test(workerSimSource) &&
          /append\('TetherWdkPoolPayoutPrepared', poolPayout, rail \|\| actorId\)/.test(workerSimSource) &&
          /if \(!wdkSettlementSignerMatches\(event\)\) continue/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'game-escrow-refund-rail-signer-bound',
        label: 'Worker binds WDK game escrow refunds to held escrow and rail-signed dispute evidence',
        ok: /function gameEscrowRefundMatchesReplay/.test(workerSimSource) &&
          /TetherWdkEscrowRefunded/.test(workerSimSource) &&
          /if \(event\.type === 'TetherWdkEscrowRefunded'\) \{\s*return gameEscrowRefundMatchesReplay\(event, index\)\s*\}/.test(workerSimSource) &&
          /WDK escrow dispute is required before refund/.test(workerSimSource) &&
          /validEscrowDisputeEventForRefund/.test(workerSimSource) &&
          /append\('TetherWdkEscrowRefunded', refunded, rail \|\| actorId\)/.test(workerSimSource) &&
          /'wdk:refundGameEscrow'/.test(settlementServiceSource) &&
          /refundGameEscrow/.test(adaptersSource),
        source: 'app/worker-sim.js, app/settlement-service.js, app/adapters.js'
      }),
      check({
        id: 'trusted-game-refund-receipts',
        label: 'Trusted game settlement can refund held escrow disputes and receipt the refund evidence',
        ok: /refundOnDispute/.test(workerSimSource) &&
          /gameEscrowRefundCommand/.test(workerSimSource) &&
          /new Set\(\['TetherWdkEscrowReleased', 'TetherWdkEscrowDisputed', 'TetherWdkEscrowRefunded'\]\)/.test(settlementServiceSource) &&
          /refundId: settlement\.refundId \|\| null/.test(settlementReceiptsSource) &&
          /refundUserIdsHash: settlement\.refundUserIds \? listHash\(settlement\.refundUserIds\) : null/.test(settlementReceiptsSource) &&
          /processorRefund: processorEvidenceSnapshot\(settlement\.processorRefund\)/.test(settlementReceiptsSource) &&
          /label: 'refund'/.test(settlementReceiptsSource),
        source: 'app/worker-sim.js, app/settlement-service.js, app/settlement-receipts.js'
      }),
      check({
        id: 'wdk-dispute-rail-signer-bound',
        label: 'Worker binds WDK dispute events to the rail actor before replay',
        ok: /function wdkDisputeSignerMatches \(event\) \{\s*return wdkSettlementSignerMatches\(event\)\s*\}/.test(workerSimSource) &&
          /if \(event\.type === 'TetherWdkEscrowDisputed' \|\| event\.type === 'TetherWdkPoolPayoutDisputed'\) \{\s*return wdkDisputeSignerMatches\(event\)\s*\}/.test(workerSimSource) &&
          /if \(event\.type === 'TetherWdkEscrowDisputed' \|\| event\.type === 'TetherWdkPoolPayoutDisputed'\) \{\s*if \(!wdkDisputeSignerMatches\(event\)\) continue\s*view\.disputes\.push\(payload\)\s*\}/.test(workerSimSource) &&
          /append\('TetherWdkEscrowDisputed', \{ \.\.\.dispute, rail: disputeRail \}, disputeRail \|\| actorId\)/.test(workerSimSource) &&
          /function appendPoolPayoutDispute \(\{ payload, reason, actorId \}\) \{\s*const rail = adapterActorId\(adapters\.tetherWdk, actorId\)[\s\S]*append\('TetherWdkPoolPayoutDisputed'[\s\S]*rail\s*\}, rail \|\| actorId\)/.test(workerSimSource) &&
          /if \(typeof sdk\.disputeGameEscrow === 'function'\) return mapRail\(sdk\.disputeGameEscrow\(input\)\)/.test(adaptersSource),
        source: 'app/worker-sim.js, app/adapters.js'
      }),
      check({
        id: 'wdk-escrow-rail-signer-bound',
        label: 'Worker binds WDK game escrow events to the rail actor before release',
        ok: /function wdkEscrowSignerMatches/.test(workerSimSource) &&
          /function wdkEscrowSignerMatches \(event\) \{\s*const payload = event && event\.payload \|\| \{\}\s*const rail = wdkSettlementRailFor\(payload\)\s*return Boolean\(rail && event\.actorId === rail\)\s*\}/.test(workerSimSource) &&
          /WDK escrow actorId must match rail/.test(workerSimSource) &&
          /function gameEscrowMatchesReplay/.test(workerSimSource) &&
          /if \(!wdkEscrowSignerMatches\(event\)\) return false/.test(workerSimSource) &&
          /if \(event\.type === 'TetherWdkEscrowCreated'\) \{\s*return gameEscrowMatchesReplay\(event, index\)\s*\}/.test(workerSimSource) &&
          /if \(!gameEscrowMatchesReplay\(escrowEvent, index\)\) return false/.test(workerSimSource) &&
          /if \(!gameEscrowMatchesReplay\(event, replayIndex\)\) continue/.test(workerSimSource) &&
          /appendVerifiedGameEscrow/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'game-escrow-session-replay-bound',
        label: 'Worker binds prize game escrows to replayed game session players, stake, and topic evidence',
        ok: /function gameEscrowSessionMatches/.test(workerSimSource) &&
          /function gameEscrowInputForPayload/.test(workerSimSource) &&
          /sessionEventId/.test(workerSimSource) &&
          /sessionHash/.test(workerSimSource) &&
          /stakeHash/.test(workerSimSource) &&
          /gameSessionStartedMatchesReplay\(sessionEvent, index\)/.test(workerSimSource) &&
          /WDK game escrow players must match replayed game session participants/.test(workerSimSource) &&
          /WDK game escrow amount must match replayed game session stake/.test(workerSimSource) &&
          /WDK game escrow output must preserve replayed game session evidence/.test(workerSimSource) &&
          /escrowsBySession/.test(workerSimSource) &&
          /core\.createTetherWdkEscrowIntent\(\{[\s\S]*sessionId: escrow\.sessionId[\s\S]*stakeHash: escrow\.stakeHash/.test(workerSimSource),
        source: 'app/core.js, app/worker-sim.js'
      }),
      check({
        id: 'official-results-signer-bound',
        label: 'Worker binds official results snapshots to the configured results-feed signature',
        ok: /recordOfficialResultsSnapshot/.test(settlementServiceSource) &&
          /recordOfficialResultsSnapshot/.test(appSource) &&
          /function officialResultsSnapshotSignerMatches/.test(workerSimSource) &&
          /function officialResultsSnapshotSignerMatches \(event\) \{\s*const payload = event && event\.payload \|\| \{\}\s*const sourceActorId = officialResultsSourceActorIdFor\(payload\)\s*return Boolean\(sourceActorId && event\.actorId === sourceActorId\)\s*\}/.test(workerSimSource) &&
          /sourceActorId/.test(workerSimSource) &&
          /Official results snapshot actorId must match sourceActorId/.test(workerSimSource) &&
          /OfficialResultsSnapshotRejected/.test(workerSimSource) &&
          /Pool settlement must use worker-log source events before QVAC attestation or WDK payout/.test(workerSimSource) &&
          /signed OfficialResultsSnapshotRecorded/.test(workerSimSource) &&
          /Official results source event signer must match sourceActorId/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'payout-recipient-signer-bound',
        label: 'Worker binds payout recipient declarations to the declaring user signature',
        ok: /function payoutRecipientSignerMatches/.test(workerSimSource) &&
          /function payoutRecipientSignerMatches \(event\) \{\s*const payload = event && event\.payload \|\| \{\}\s*return Boolean\(payload\.userId && event\.actorId === payload\.userId\)\s*\}/.test(workerSimSource) &&
          /function payoutRecipientSignerMismatchReason/.test(workerSimSource) &&
          /Payout recipient declaration actorId must match userId/.test(workerSimSource) &&
          /PayoutRecipientDeclarationRejected/.test(workerSimSource) &&
          (workerSimSource.match(/if \(!payoutRecipientSignerMatches\(event\)\) continue/g) || []).length >= 2,
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'forfeit-round-qvac-wdk-path',
        label: 'Timeout forfeits resolve through replayed evidence before QVAC attestation and WDK release',
        ok: /function createPenaltyClashForfeitRound/.test(coreSource) &&
          /roundResult\.outcome === 'forfeit'/.test(coreSource) &&
          /GameRoundForfeitRecorded/.test(workerSimSource) &&
          /'game:recordForfeit'/.test(workerSimSource) &&
          /Round source events missing GameRoundForfeitRecorded for forfeit/.test(workerSimSource) &&
          /Forfeit source event winner does not match round result/.test(workerSimSource) &&
          /core\.createPenaltyClashForfeitRound/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'forfeit-claim-signer-bound',
        label: 'Worker binds timeout forfeit claims to the winning claimant signature',
        ok: /claimantUserId: claimant/.test(coreSource) &&
          /function forfeitClaimSignerMatches/.test(workerSimSource) &&
          /Boolean\(claimantUserId && actorId === claimantUserId && claimantUserId === winnerUserId && claimantUserId !== forfeitingPlayerId\)/.test(workerSimSource) &&
          /Forfeit claim must be signed by winning claimant/.test(workerSimSource) &&
          /Forfeit source event claimant must match the winning player/.test(workerSimSource) &&
          /Forfeit source event signer must match claimantUserId/.test(workerSimSource),
        source: 'app/worker-sim.js'
      }),
      check({
        id: 'tether-wdk-usdt-method',
        label: 'Tether WDK bridge maps USDT-EVM receive intents to a USDT processor method',
        ok: /function paymentMethodForAsset/.test(tetherWdkBridgeSource) &&
          /crypto_usdt/.test(tetherWdkBridgeSource) &&
          !/crypto_usdc/.test(tetherWdkBridgeSource),
        source: 'app/tether-wdk-bridge.js'
      }),
      check({
        id: 'tether-wdk-confirmation-paid-required',
        label: 'Processor-backed WDK confirmations require captured processor payment evidence',
        ok: /async confirmEntryIntent/.test(tetherWdkBridgeSource) &&
          /confirmPayment is required before confirming entry payment/.test(tetherWdkBridgeSource) &&
          /WDK transaction id is required before payment confirmation/.test(tetherWdkBridgeSource) &&
          /if \(!isProcessorPaid\(confirmation\)\) throw new Error\('WDK payment has not been confirmed yet'\)/.test(tetherWdkBridgeSource),
        source: 'app/tether-wdk-bridge.js'
      })
    ]
  }

  function createPearBrowserCompatibilityReport ({ packageJson = {}, html = '', files = {}, sources = {} } = {}) {
    const checks = [
      ...packageChecks({ packageJson, files }),
      ...htmlChecks({ html, files }),
      ...stageHtmlAssetChecks({ packageJson, html }),
      ...sourceChecks({ files, sources })
    ]
    const summary = summarizeChecks(checks)
    return {
      id: 'pearcup-pear-browser-compat',
      generatedAt: '2026-07-01T00:00:00.000Z',
      ok: summary.blocking === 0,
      summary,
      checks,
      package: {
        name: packageJson.name,
        version: packageJson.version,
        main: packageJson.main,
        pear: clone(packageJson.pear)
      }
    }
  }

  function formatPearBrowserCompatibilityReport (report) {
    const lines = [
      'PearCup Pear Browser compatibility audit',
      `${report.ok ? 'ok' : 'not ok'} - browser compatibility gate`,
      `ok - checks: ${report.summary.passed} passed, ${report.summary.blocking} blocking, ${report.summary.warnings} warnings`
    ]
    for (const item of report.checks) {
      if (item.ok) continue
      const prefix = item.severity === 'warning' ? 'warn' : 'not ok'
      lines.push(`${prefix} - ${item.label}${item.detail ? `: ${item.detail}` : ''}`)
    }
    return lines.join('\n')
  }

  const api = {
    defaultRendererScripts,
    stageRuntimeFiles,
    workerOnlyRuntimeFiles,
    requiredStageIgnores,
    createPearBrowserCompatibilityReport,
    formatPearBrowserCompatibilityReport,
    scriptRefsFromHtml,
    stylesheetRefsFromHtml,
    cspFromHtml,
    isRelativeLocalRef
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupPearBrowserCompat = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
