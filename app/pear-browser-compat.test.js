const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const compat = require('./pear-browser-compat.js')

const rootDir = path.resolve(__dirname, '..')

function readText (relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

function readJson (relativePath) {
  return JSON.parse(readText(relativePath))
}

function listFiles (dir, acc = {}) {
  for (const entry of fs.readdirSync(path.join(rootDir, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name).replace(/\\/g, '/')
    if (entry.isDirectory()) listFiles(relative, acc)
    else acc[`/${relative}`] = true
  }
  return acc
}

function projectFiles () {
  return {
    '/index.cjs': fs.existsSync(path.join(rootDir, 'index.cjs')),
    '/package.json': fs.existsSync(path.join(rootDir, 'package.json')),
    ...listFiles('app'),
    ...listFiles('config')
  }
}

function projectSources (files) {
  const sources = {}
  for (const filePath of Object.keys(files)) {
    if (!filePath.startsWith('/app/') || !filePath.endsWith('.js')) continue
    sources[filePath] = readText(filePath.slice(1))
  }
  return sources
}

function projectReport () {
  const files = projectFiles()
  return compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources: projectSources(files)
  })
}

test('Pear Browser compatibility audit passes for the staged renderer surface', () => {
  const report = projectReport()

  assert.equal(report.ok, true)
  assert.equal(report.summary.blocking, 0)
  assert.equal(report.checks.find(item => item.id === 'no-sdk-runtime-in-renderer').ok, true)
  assert.equal(report.checks.find(item => item.id === 'stage-include-runtime-assets').ok, true)
  assert.equal(report.checks.find(item => item.id === 'html-assets-staged').ok, true)
  assert.equal(report.checks.find(item => item.id === 'pear-worker-bootstrap-staged').ok, true)
  assert.equal(report.checks.find(item => item.id === 'worker-runtime-isolated-from-renderer').ok, true)
  assert.equal(report.checks.find(item => item.id === 'content-security-policy').ok, true)
  assert.equal(report.checks.find(item => item.id === 'bracket-submissions-worker-evidence').ok, true)
  assert.equal(report.checks.find(item => item.id === 'profile-bracket-state-worker-owned').ok, true)
  assert.equal(report.checks.find(item => item.id === 'profile-bracket-renderer-worker-backed').ok, true)
  assert.equal(report.checks.find(item => item.id === 'bridge-events-opt-in').ok, true)
  assert.equal(report.checks.find(item => item.id === 'bridge-trusted-settlement-demo-guard').ok, true)
  assert.equal(report.checks.find(item => item.id === 'settlement-receipts-guarded').ok, true)
  assert.equal(report.checks.find(item => item.id === 'settlement-receipts-evidence-gated').ok, true)
  assert.equal(report.checks.find(item => item.id === 'raw-settlement-evidence-guarded').ok, true)
  assert.equal(report.checks.find(item => item.id === 'peer-settlement-artifacts-dependent').ok, true)
  assert.equal(report.checks.find(item => item.id === 'settlement-receipt-actor-refs-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'processor-transfer-evidence-required').ok, true)
  assert.equal(report.checks.find(item => item.id === 'qvac-loadable-model-required').ok, true)
  assert.equal(report.checks.find(item => item.id === 'qvac-auto-unload-honored').ok, true)
  assert.equal(report.checks.find(item => item.id === 'qvac-review-fail-closed').ok, true)
  assert.equal(report.checks.find(item => item.id === 'qvac-referee-id-required').ok, true)
  assert.equal(report.checks.find(item => item.id === 'qvac-adapter-output-verified-before-log').ok, true)
  assert.equal(report.checks.find(item => item.id === 'qvac-attestation-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'qvac-commentary-replay-grounded').ok, true)
  assert.equal(report.checks.find(item => item.id === 'live-match-renderer-worker-backed').ok, true)
  assert.equal(report.checks.find(item => item.id === 'game-settlement-storage-durable').ok, true)
  assert.equal(report.checks.find(item => item.id === 'demo-settlement-local-fallback').ok, true)
  assert.equal(report.checks.find(item => item.id === 'renderer-game-state-hash-before-settlement').ok, true)
  assert.equal(report.checks.find(item => item.id === 'p2p-game-session-lifecycle-replay-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'watch-party-social-worker-owned').ok, true)
  assert.equal(report.checks.find(item => item.id === 'watch-room-renderer-worker-backed').ok, true)
  assert.equal(report.checks.find(item => item.id === 'wdk-adapter-output-verified-before-log').ok, true)
  assert.equal(report.checks.find(item => item.id === 'p2p-state-hash-consensus-before-qvac').ok, true)
  assert.equal(report.checks.find(item => item.id === 'p2p-player-evidence-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'bracket-submission-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'entry-intent-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'entry-payment-rail-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'entry-payment-check-rail-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'entry-refund-rail-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'wdk-settlement-rail-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'game-escrow-refund-rail-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'wdk-dispute-rail-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'wdk-escrow-rail-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'game-escrow-session-replay-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'official-results-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'payout-recipient-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'forfeit-round-qvac-wdk-path').ok, true)
  assert.equal(report.checks.find(item => item.id === 'forfeit-claim-signer-bound').ok, true)
  assert.equal(report.checks.find(item => item.id === 'tether-wdk-usdt-method').ok, true)
  assert.equal(report.checks.find(item => item.id === 'tether-wdk-confirmation-paid-required').ok, true)
})

test('Pear Browser compatibility audit rejects external renderer assets', () => {
  const files = projectFiles()
  const html = readText('app/index.html').replace('./styles.css', 'https://cdn.example.invalid/styles.css')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html,
    files,
    sources: projectSources(files)
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'html-local-assets').ok, false)
})

test('Pear Browser compatibility audit rejects package SDK runtime in renderer scripts', () => {
  const files = projectFiles()
  const html = readText('app/index.html').replace(
    '<script src="./runtime-settings.js"></script>',
    '<script src="./sdk-runtime.js"></script>\n    <script src="./runtime-settings.js"></script>'
  )
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html,
    files,
    sources: projectSources(files)
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'no-sdk-runtime-in-renderer').ok, false)
  assert.equal(report.checks.find(item => item.id === 'worker-runtime-isolated-from-renderer').ok, false)
  assert.equal(report.checks.find(item => item.id === 'script-order').ok, false)
})

test('Pear Browser compatibility audit rejects worker bridge runtime in renderer scripts', () => {
  const files = projectFiles()
  const html = readText('app/index.html').replace(
    '<script src="./runtime-settings.js"></script>',
    '<script src="./worker-bridge-protocol.js"></script>\n    <script src="./runtime-settings.js"></script>'
  )
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html,
    files,
    sources: projectSources(files)
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'worker-runtime-isolated-from-renderer').ok, false)
  assert.equal(report.checks.find(item => item.id === 'script-order').ok, false)
})

test('Pear Browser compatibility audit rejects missing stage include assets', () => {
  const packageJson = readJson('package.json')
  packageJson.pear.stage.include = packageJson.pear.stage.include.filter(item => item !== '/app/index.html')

  const files = projectFiles()
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson,
    html: readText('app/index.html'),
    files,
    sources: projectSources(files)
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'stage-include-runtime-assets').ok, false)
})

test('Pear Browser compatibility audit rejects renderer assets omitted from stage manifest', () => {
  const packageJson = readJson('package.json')
  packageJson.pear.stage.include = packageJson.pear.stage.include.filter(item => item !== '/app/styles.css')

  const files = projectFiles()
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson,
    html: readText('app/index.html'),
    files,
    sources: projectSources(files)
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'html-assets-staged').ok, false)
})

test('Pear Browser compatibility audit rejects missing Pear worker bridge fallback', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-client.js'] = sources['/app/worker-client.js'].replace(
    /function detectBridge[\s\S]*?function createAutoWorkerClient/,
    'function detectBridge (rootObject = root) {\n    return null\n  }\n\n  function createAutoWorkerClient'
  )
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'pear-worker-bridge-fallback').ok, false)
})

test('Pear Browser compatibility audit rejects renderer-only bracket submissions', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/app.js'] = sources['/app/app.js']
    .replace(/type:\s*'bracket:submit'/g, "type: 'bracket:preview'")
    .replace(/sourceBracketSubmissionIds/g, 'rendererOnlySubmissionIds')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'bracket-submissions-worker-evidence').ok, false)
})

test('Pear Browser compatibility audit rejects profile and bracket draft worker state without replay checks', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function profileMatchesReplay \(event\) \{[\s\S]*?\n  \}/, "function profileMatchesReplay (event) {\n    return true\n  }")
    .replace(/function bracketDraftMatchesReplay \(event\) \{[\s\S]*?\n  \}/, "function bracketDraftMatchesReplay (event) {\n    return true\n  }")
    .replace(/Profile update actorId must match userId/g, 'Profile update can be unsigned')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'profile-bracket-state-worker-owned').ok, false)
})

test('Pear Browser compatibility audit rejects renderer-only profile and bracket draft state', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/app.js'] = sources['/app/app.js']
    .replace(/const appStateClient = PearCupWorkerClient\.createAutoWorkerClient/, 'const appStateClient = createRendererOnlyAppState')
    .replace(/appStateClient\.dispatchAsync\(command\)/g, 'Promise.resolve(command)')
    .replace(/appStateClient\.view\(\)/g, '({})')
    .replace(/state\.picks = nextPicks\n      persist\(\)\n      dispatchAppStateCommand/, 'state.picks[button.dataset.match] = button.dataset.pick\n      persist()\n      dispatchAppStateCommand')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'profile-bracket-renderer-worker-backed').ok, false)
})

test('Pear Browser compatibility audit rejects direct renderer payout recipient dispatch', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/app.js'] = sources['/app/app.js']
    .replace(/settlementService\.declarePayoutRecipient\(\{/, "worker.dispatchAsync({\n      type: 'payout:declareRecipient',\n      payload: {")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'payout-recipients-guarded-service').ok, false)
})

test('Pear Browser compatibility audit rejects direct renderer QVAC referee dispatch', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/app.js'] += "\nworker.dispatchAsync({ type: 'qvac:refereeAttest', payload: { gameId: 'pc-audit', roundId: 'pc-1' } })\n"
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'qvac-referee-via-trusted-settlement').ok, false)
})

test('Pear Browser compatibility audit rejects bridge responses that always include event history', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-bridge-protocol.js'] = sources['/app/worker-bridge-protocol.js']
    .replace(/events:\s*includeEvents\s*\?\s*workerEventsFrom\(activeHarness\)\s*:\s*\[\]/, 'events: workerEventsFrom(activeHarness)')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'bridge-events-opt-in').ok, false)
})

test('Pear Browser compatibility audit rejects bridge trusted settlement helpers that ignore demo guard opts', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-bridge-protocol.js'] = sources['/app/worker-bridge-protocol.js']
    .replace(/function settlementServiceForRequest/, 'function missingSettlementServiceForRequest')
    .replace(/responseService = settlementServiceForRequest\(\{ activeService, harness, opts: requestOpts \}\)/g, 'responseService = activeService')
    .replace(/service:\s*responseService/, 'service: activeService')
  sources['/app/app.js'] = sources['/app/app.js']
    .replace(/,\n      requireLive: integrationRuntime\.canUseRealMoney/g, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'bridge-trusted-settlement-demo-guard').ok, false)
})

test('Pear Browser compatibility audit rejects unguarded settlement receipt recording', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/settlement-service.js'] = sources['/app/settlement-service.js']
    .replace(/,\n    'settlement:recordReceipt'/, '')
    .replace(/\n      guardPrizeCommand\('settlement:recordReceipt'\)/, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'settlement-receipts-guarded').ok, false)
})

test('Pear Browser compatibility audit rejects receipt recording without evidence gating', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/settlement-service.js'] = sources['/app/settlement-service.js']
    .replace(/function receiptEvidenceStatus \(summary = \{\}\) \{[\s\S]*?\n  \}\n\n  function createGuardedSettlementService/, 'function createGuardedSettlementService')
    .replace(/      const evidence = receiptEvidenceStatus\(summary\)[\s\S]*?      const receipt = createSettlementReceipt/, '      const receipt = createSettlementReceipt')
    .replace(/,\n        receiptHeld: recorded\.held === true,\n        receiptReason: recorded\.reason \|\| null,\n        receiptMissing: recorded\.missing \|\| \[\]/g, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'settlement-receipts-evidence-gated').ok, false)
})

test('Pear Browser compatibility audit rejects unguarded raw settlement evidence commands', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/settlement-service.js'] = sources['/app/settlement-service.js']
    .replace(/\n    'game:submitRoundStateHash',/, '')
    .replace(/\n    'game:recordForfeit',/, '')
    .replace(/\n    'results:recordOfficialSnapshot',/, '')
    .replace(/\n    'pool:resolveSettlement',/, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'raw-settlement-evidence-guarded').ok, false)
})

test('Pear Browser compatibility audit rejects peer-merged settlement artifacts without dependency checks', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function settlementEventDependenciesSatisfied/, 'function settlementArtifactDependenciesSatisfied')
    .replace(/indexedSourceEventsPresent/g, 'sourceEventsPresentWithoutIndex')
    .replace(/verifiedGameReleaseMatchesReplay/g, 'gameReleaseDependenciesOnly')
    .replace(/verifiedPoolPayoutMatchesReplay/g, 'poolPayoutDependenciesOnly')
    .replace(/settlementReceiptMatchesReplay/g, 'settlementReceiptDependenciesOnly')
    .replace(/receiptEventRootMatchesReplay/g, 'receiptRootUnchecked')
    .replace(/eventRefMatchesReplay/g, 'eventRefUnchecked')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'peer-settlement-artifacts-dependent').ok, false)
})

test('Pear Browser compatibility audit rejects settlement receipts without actor-bound event refs', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/settlement-receipts.js'] = sources['/app/settlement-receipts.js']
    .replace(/actorId: event\.actorId \|\| null,\n/, '')
    .replace(/eventActorId: attestationEvent\.actorId \|\| null,\n/, '')
    .replace(/eventActorId: settlementEvent\.actorId \|\| null,\n/, '')
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/if \(ref\.actorId && event\.actorId !== ref\.actorId\) return false\n/, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'settlement-receipt-actor-refs-bound').ok, false)
})

test('Pear Browser compatibility audit rejects launch gates without processor transfer evidence checks', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/trusted-path-preflight.js'] = sources['/app/trusted-path-preflight.js']
    .replace(/function processorEvidenceReady/g, 'function processorStatusLooksReady')
    .replace(/transferCount > 0/g, 'transferCount >= 0')
    .replace(/transferStatuses\[status\] > 0/g, 'true')
  sources['/app/live-launch-audit.js'] = sources['/app/live-launch-audit.js']
    .replace(/function processorEvidenceReady/g, 'function processorStatusLooksReady')
    .replace(/trusted-path-processor-evidence/g, 'trusted-path-status-only')
    .replace(/trusted-game-processor-evidence/g, 'trusted-game-status-only')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'processor-transfer-evidence-required').ok, false)
})

test('Pear Browser compatibility audit rejects QVAC launch gates that treat modelId as a loadable model', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/live-launch-audit.js'] = sources['/app/live-launch-audit.js']
    .replace(/qvac\.modelSrc \|\| qvac\.modelExport \|\| qvac\.preloadedModelId/g, 'qvac.modelSrc || qvac.modelExport || qvac.modelId || qvac.preloadedModelId')
    .replace(/missing modelSrc, modelExport, or preloadedModelId/g, 'missing modelSrc, modelExport, modelId, or preloadedModelId')
  sources['/app/runtime-settings.js'] = sources['/app/runtime-settings.js']
    .replace(/const preloadedModelId = env\.PEARCUP_QVAC_PRELOADED_MODEL_ID \|\| configured\.preloadedModelId\n/, '')
    .replace(/if \(preloadedModelId\) settings\.preloadedModelId = preloadedModelId\n/, '')
    .replace(/!qvac\.modelSrc && !qvac\.modelExport && !qvac\.preloadedModelId/g, '!qvac.modelSrc && !qvac.modelExport && !qvac.modelId && !qvac.preloadedModelId')
    .replace(/Set a QVAC modelSrc, modelExport, or preloadedModelId/g, 'Set a QVAC modelSrc, modelExport, modelId, or preloadedModelId')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'qvac-loadable-model-required').ok, false)
})

test('Pear Browser compatibility audit rejects QVAC clients that ignore autoUnload', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/sdk-runtime.js'] = sources['/app/sdk-runtime.js']
    .replace(/let ownsLoadedModel = false\n/, '')
    .replace(/if \(autoUnload === true\) await unloadOwnedModel\(\)/, 'if (autoUnload === true) await Promise.resolve()')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'qvac-auto-unload-honored').ok, false)
})

test('Pear Browser compatibility audit rejects QVAC attestations that only block disputed reviews', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/core.js'] = sources['/app/core.js']
    .replace(/review && review\.ruling !== 'verified'/, "review && review.ruling === 'disputed'")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'qvac-review-fail-closed').ok, false)
})

test('Pear Browser compatibility audit rejects QVAC verification without referee identity requirements', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/core.js'] = sources['/app/core.js']
    .replace(/if \(!attestation\.refereeId\) errors\.push\('QVAC attestation refereeId is required'\)\n/, '')
    .replace(/if \(!attestation\.refereeId\) errors\.push\('QVAC pool attestation refereeId is required'\)\n/, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'qvac-referee-id-required').ok, false)
})

test('Pear Browser compatibility audit rejects worker QVAC appends without adapter output verification', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/attestation => appendVerifiedRoundAttestation\(\{ roundResult, attestation, actorId \}\)/, "attestation => append('QvacRefereeAttestationCreated', attestation, actorId)")
    .replace(/attestation => appendVerifiedPoolAttestation\(\{ poolResult, attestation, actorId \}\)/, "attestation => append('QvacPoolSettlementAttestationCreated', attestation, actorId)")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'qvac-adapter-output-verified-before-log').ok, false)
})

test('Pear Browser compatibility audit rejects QVAC attestation events without referee signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function qvacAttestationSignerMatches \(event\) \{[\s\S]*?\n  \}/, "function qvacAttestationSignerMatches (event) {\n    return true\n  }")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'qvac-attestation-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects QVAC commentary without replay grounding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function commentarySegmentMatchesReplay \(event, index\) \{[\s\S]*?\n  \}/, "function commentarySegmentMatchesReplay (event, index) {\n    return true\n  }")
    .replace(/if \(event\.type === 'CommentaryGenerated'\) \{\s*return commentarySegmentMatchesReplay\(event, index\)\s*\}/, "if (event.type === 'CommentaryGenerated') {\n      return true\n    }")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'qvac-commentary-replay-grounded').ok, false)
})

test('Pear Browser compatibility audit rejects renderer-only live stats and commentary', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/app.js'] = sources['/app/app.js']
    .replace(/const liveMatchClient = PearCupWorkerClient\.createAutoWorkerClient/, 'const liveMatchClient = createRendererOnlyLiveMatch')
    .replace(/liveMatchClient\.dispatchAsync\(command\)/g, 'Promise.resolve(command)')
    .replace(/liveMatchClient\.view\(\)/g, '({})')
    .replace(/liveMatchStatRows\(\)\.map/g, 'matchStats.map')
    .replace(/liveCommentaryLines\(state\.language\)\.map/g, 'commentary[state.language].map')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'live-match-renderer-worker-backed').ok, false)
})

test('Pear Browser compatibility audit rejects memory-only game settlement storage', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/app.js'] = sources['/app/app.js']
    .replace(/const eventStore = createGameSettlementEventStore\(gameId\)/, "const eventStore = PearCupStorageSim.createEventStore({\n    backend: PearCupStorageSim.createMemoryBackend(),\n    rootId: 'pearcup-demo',\n    namespace: PearCupStorageSim.gameNamespace(gameId)\n  })")
    .replace(/function existingGameEscrowEvent/, 'function missingExistingGameEscrowEvent')
    .replace(/dispatchGameEvidenceIfNeeded\(worker, 'commitments'/g, "worker.dispatchAsync({ type: 'game:submitCommitment' }) && dispatchGameEvidenceIfNeeded(worker, 'commitments'")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'game-settlement-storage-durable').ok, false)
})

test('Pear Browser compatibility audit rejects bridge-first demo settlement workers', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/app.js'] = sources['/app/app.js']
    .replace(/if \(!integrationRuntime\.canUseRealMoney\) return local\(\)/g, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'demo-settlement-local-fallback').ok, false)
})

test('Pear Browser compatibility audit rejects Penalty Clash settlement without renderer state hashes', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/app.js'] = sources['/app/app.js']
    .replace(/const expectedRound = PearCupCore\.createPenaltyClashRound\([\s\S]*?}\)\n  await dispatchGameEvidenceIfNeeded\(worker, 'roundStateHashes'[\s\S]*?}\)\n  await dispatchGameEvidenceIfNeeded\(worker, 'roundStateHashes'[\s\S]*?}\)\n  const settlementResult = await settlementService\.settleGameRoundWithReceipt/, 'const settlementResult = await settlementService.settleGameRoundWithReceipt')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'renderer-game-state-hash-before-settlement').ok, false)
})

test('Pear Browser compatibility audit rejects P2P game sessions without replay-bound lifecycle checks', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function gameSessionStartedMatchesReplay \(event, index\) \{[\s\S]*?\n  \}/, "function gameSessionStartedMatchesReplay (event, index) {\n    return true\n  }")
    .replace(/if \(event\.type === 'GameSessionStarted'\) \{\s*return gameSessionStartedMatchesReplay\(event, index\)\s*\}/, "if (event.type === 'GameSessionStarted') {\n      return true\n    }")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'p2p-game-session-lifecycle-replay-bound').ok, false)
})

test('Pear Browser compatibility audit rejects watch-party social state without worker replay checks', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function chatMessageMatchesReplay \(event, index\) \{[\s\S]*?\n  \}/, "function chatMessageMatchesReplay (event, index) {\n    return true\n  }")
    .replace(/function streamStartMatchesReplay \(event, index\) \{[\s\S]*?\n  \}/, "function streamStartMatchesReplay (event, index) {\n    return true\n  }")
    .replace(/Streaming rights must be confirmed before stream start/g, 'Streaming rights are optional')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'watch-party-social-worker-owned').ok, false)
})

test('Pear Browser compatibility audit rejects renderer-only watch-room chat and voice state', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/app.js'] = sources['/app/app.js']
    .replace(/const watchRoomClient = PearCupWorkerClient\.createAutoWorkerClient/, 'const watchRoomClient = createRendererOnlyWatchRoom')
    .replace(/watchRoomClient\.dispatchAsync\(command\)/g, 'Promise.resolve(command)')
    .replace(/watchRoomClient\.view\(\)/g, '({})')
    .replace(/watchChatMessages\(\)\.map/g, 'state.chat.map')
    .replace(/watchVoiceIsLive\(\)/g, 'state.voice')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'watch-room-renderer-worker-backed').ok, false)
})

test('Pear Browser compatibility audit rejects worker WDK appends without adapter output verification', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/payout => appendVerifiedGameRelease\(\{ payload, payout, actorId, awaitAdapters \}\)/, "payout => append('TetherWdkEscrowReleased', payout, actorId)")
    .replace(/poolPayout => appendVerifiedPoolPayout\(\{ payload, poolPayout, actorId \}\)/, "poolPayout => append('TetherWdkPoolPayoutPrepared', poolPayout, actorId)")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'wdk-adapter-output-verified-before-log').ok, false)
})

test('Pear Browser compatibility audit rejects worker round resolution without peer state hash consensus', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/const stateHashConsensus = verifyRoundStateHashConsensus\(\{[\s\S]*?if \(!stateHashConsensus\.ok\) \{[\s\S]*?\n        \}\n        const peerStateHashEventIds = stateHashConsensus\.events\.map\(event => event\.eventId\)/, "const stateHashConsensus = { ok: true, errors: [], events: [] }\n        const peerStateHashEventIds = stateHashConsensus.events.map(event => event.eventId)")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'p2p-state-hash-consensus-before-qvac').ok, false)
})

test('Pear Browser compatibility audit rejects player evidence without signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function playerEvidenceSignerMatches \(event\) \{[\s\S]*?\n    \}/, "function playerEvidenceSignerMatches (event) {\n      return true\n    }")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'p2p-player-evidence-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects bracket submissions without signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function bracketSubmissionSignerMatches \(event\) \{[\s\S]*?\n  \}/, "function bracketSubmissionSignerMatches (event) {\n    return true\n  }")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'bracket-submission-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects WDK entry intents without signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function entryIntentSignerMatches \(event\) \{[\s\S]*?\n  \}/, "function entryIntentSignerMatches (event) {\n    return true\n  }")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'entry-intent-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects WDK entry confirmations without rail signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function entryPaymentSignerMatches \(\{ event, intentEvent \}\) \{[\s\S]*?\n  \}/, "function entryPaymentSignerMatches ({ event, intentEvent }) {\n    return true\n  }")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'entry-payment-rail-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects WDK pending entry checks without rail signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function entryPaymentCheckSignerMatches \(\{ event, intentEvent \}\) \{[\s\S]*?\n  \}/, "function entryPaymentCheckSignerMatches ({ event, intentEvent }) {\n    return true\n  }")
    .replace(/if \(event\.type === 'TetherWdkEntryPaymentPending'\) \{\s*return entryPaymentCheckMatchesReplay\(event, index\)\s*\}/, "if (event.type === 'TetherWdkEntryPaymentPending') {\n      return true\n    }")
    .replace(/if \(!entryPaymentCheckSignerMatches\(\{ event, intentEvent \}\)\) continue\n/, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'entry-payment-check-rail-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects WDK entry refunds without rail signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function entryRefundSignerMatches \(\{ event, paymentEvent \}\) \{[\s\S]*?\n  \}/, "function entryRefundSignerMatches ({ event, paymentEvent }) {\n    return true\n  }")
    .replace(/if \(event\.type === 'TetherWdkEntryRefunded'\) \{\s*return entryRefundMatchesReplay\(event, index\)\s*\}/, "if (event.type === 'TetherWdkEntryRefunded') {\n      return true\n    }")
    .replace(/delete view\.entryPayments\[payload\.paymentId\]\n/, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'entry-refund-rail-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects WDK settlement outputs without rail signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function wdkSettlementSignerMatches \(event\) \{[\s\S]*?\n  \}/, "function wdkSettlementSignerMatches (event) {\n    return true\n  }")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'wdk-settlement-rail-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects WDK game escrow refunds without held-dispute replay binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function validEscrowDisputeEventForRefund[\s\S]*?\n  \}/, "function validEscrowDisputeEventForRefund (index, refund = {}) {\n    return true\n  }")
    .replace(/if \(event\.type === 'TetherWdkEscrowRefunded'\) \{\s*return gameEscrowRefundMatchesReplay\(event, index\)\s*\}/, "if (event.type === 'TetherWdkEscrowRefunded') {\n      return true\n    }")
    .replace(/return append\('TetherWdkEscrowRefunded', refunded, rail \|\| actorId\)/, "return append('TetherWdkEscrowRefunded', refunded, actorId)")
  sources['/app/settlement-service.js'] = sources['/app/settlement-service.js']
    .replace(/'wdk:refundGameEscrow',\n/, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'game-escrow-refund-rail-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects trusted game refunds without receipt evidence handling', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/settlement-service.js'] = sources['/app/settlement-service.js']
    .replace(/, 'TetherWdkEscrowRefunded'/, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'trusted-game-refund-receipts').ok, false)
})

test('Pear Browser compatibility audit rejects WDK disputes without rail signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function wdkDisputeSignerMatches \(event\) \{[\s\S]*?\n  \}/, "function wdkDisputeSignerMatches (event) {\n    return true\n  }")
    .replace(/if \(event\.type === 'TetherWdkEscrowDisputed' \|\| event\.type === 'TetherWdkPoolPayoutDisputed'\) \{\s*return wdkDisputeSignerMatches\(event\)\s*\}/, "if (event.type === 'TetherWdkEscrowDisputed' || event.type === 'TetherWdkPoolPayoutDisputed') {\n      return true\n    }")
    .replace(/if \(event\.type === 'TetherWdkEscrowDisputed' \|\| event\.type === 'TetherWdkPoolPayoutDisputed'\) \{\s*if \(!wdkDisputeSignerMatches\(event\)\) continue\s*view\.disputes\.push\(payload\)\s*\}/, "if (event.type === 'TetherWdkEscrowDisputed' || event.type === 'TetherWdkPoolPayoutDisputed') {\n        view.disputes.push(payload)\n      }")
  sources['/app/adapters.js'] = sources['/app/adapters.js']
    .replace(/if \(typeof sdk\.disputeGameEscrow === 'function'\) return mapRail\(sdk\.disputeGameEscrow\(input\)\)/, "if (typeof sdk.disputeGameEscrow === 'function') return sdk.disputeGameEscrow(input)")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'wdk-dispute-rail-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects WDK game escrows without rail signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function wdkEscrowSignerMatches \(event\) \{[\s\S]*?\n  \}/, "function wdkEscrowSignerMatches (event) {\n    return true\n  }")
    .replace(/if \(!wdkEscrowSignerMatches\(escrowEvent\)\) return false\n/, '')
    .replace(/if \(!wdkEscrowSignerMatches\(event\)\) continue\n/, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'wdk-escrow-rail-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects game escrows without session replay binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function gameEscrowSessionMatches \(\{ escrow = \{\}, sessionEvent \}\) \{[\s\S]*?\n  \}/, "function gameEscrowSessionMatches ({ escrow = {}, sessionEvent }) {\n    return true\n  }")
    .replace(/WDK game escrow players must match replayed game session participants/g, 'WDK game escrow accepts renderer players')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'game-escrow-session-replay-bound').ok, false)
})

test('Pear Browser compatibility audit rejects official results snapshots without signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function officialResultsSnapshotSignerMatches \(event\) \{[\s\S]*?\n  \}/, "function officialResultsSnapshotSignerMatches (event) {\n    return true\n  }")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'official-results-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects payout recipient declarations without signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function payoutRecipientSignerMatches \(event\) \{[\s\S]*?\n    \}/, "function payoutRecipientSignerMatches (event) {\n      return true\n    }")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'payout-recipient-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects worker forfeit rounds without replayed evidence', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/GameRoundForfeitRecorded/g, 'GameRoundTimeoutClaimed')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'forfeit-round-qvac-wdk-path').ok, false)
})

test('Pear Browser compatibility audit rejects forfeit claims without signer binding', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/worker-sim.js'] = sources['/app/worker-sim.js']
    .replace(/function forfeitClaimSignerMatches \(\{ actorId, claimantUserId, winnerUserId, forfeitingPlayerId \}\) \{[\s\S]*?\n    \}/, "function forfeitClaimSignerMatches ({ actorId, claimantUserId, winnerUserId, forfeitingPlayerId }) {\n      return true\n    }")
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'forfeit-claim-signer-bound').ok, false)
})

test('Pear Browser compatibility audit rejects Tether WDK bridges that map USDT to USDC methods', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/tether-wdk-bridge.js'] = sources['/app/tether-wdk-bridge.js']
    .replace(/crypto_usdt/g, 'crypto_usdc')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'tether-wdk-usdt-method').ok, false)
})

test('Pear Browser compatibility audit rejects processor WDK confirmations without paid evidence', () => {
  const files = projectFiles()
  const sources = projectSources(files)
  sources['/app/tether-wdk-bridge.js'] = sources['/app/tether-wdk-bridge.js']
    .replace(/if \(!isProcessorPaid\(confirmation\)\) throw new Error\('WDK payment has not been confirmed yet'\)\n/, '')
  const report = compat.createPearBrowserCompatibilityReport({
    packageJson: readJson('package.json'),
    html: readText('app/index.html'),
    files,
    sources
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(item => item.id === 'tether-wdk-confirmation-paid-required').ok, false)
})
