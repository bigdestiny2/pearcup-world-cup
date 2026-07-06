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
    const workerClientSource = sources['/app/worker-client.js'] || ''
    const workerBridgeProtocolSource = sources['/app/worker-bridge-protocol.js'] || ''
    const settlementServiceSource = sources['/app/settlement-service.js'] || ''
    const workerSimSource = sources['/app/worker-sim.js'] || ''
    const trustedPathPreflightSource = sources['/app/trusted-path-preflight.js'] || ''
    const liveLaunchAuditSource = sources['/app/live-launch-audit.js'] || ''
    const runtimeSettingsSource = sources['/app/runtime-settings.js'] || ''
    const sdkRuntimeSource = sources['/app/sdk-runtime.js'] || ''
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
        id: 'bridge-events-opt-in',
        label: 'Pear worker bridge returns event history only when explicitly requested',
        ok: /function envelopeWantsEvents/.test(workerBridgeProtocolSource) &&
          /eventsIncluded:\s*includeEvents === true/.test(workerBridgeProtocolSource) &&
          /events:\s*includeEvents\s*\?\s*workerEventsFrom\(activeHarness\)\s*:\s*\[\]/.test(workerBridgeProtocolSource) &&
          /includeEvents:\s*true/.test(workerClientSource),
        source: 'app/worker-bridge-protocol.js'
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
        id: 'raw-settlement-evidence-guarded',
        label: 'Raw settlement evidence commands are guarded behind trusted settlement paths',
        ok: /'game:resolveRound'/.test(settlementServiceSource) &&
          /'results:recordOfficialSnapshot'/.test(settlementServiceSource) &&
          /'pool:resolveSettlement'/.test(settlementServiceSource) &&
          /settleGameRoundWithReceipt/.test(appSource) &&
          /settleBracketPoolWithReceipt/.test(appSource) &&
          !/type:\s*['"]game:resolveRound['"]/.test(appSource) &&
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
