(function attachPearCupLiveLaunchAudit (root) {
  const runtimeSettings = root.PearCupRuntimeSettings || (typeof require !== 'undefined' ? require('./runtime-settings.js') : null)
  const workerRuntime = root.PearCupWorkerRuntime || (typeof require !== 'undefined' ? require('./worker-runtime.js') : null)
  const settlementService = root.PearCupSettlementService || (typeof require !== 'undefined' ? require('./settlement-service.js') : null)
  const liveReadiness = root.PearCupLiveReadiness || (typeof require !== 'undefined' ? require('./live-readiness.js') : null)
  const trustedPathPreflight = root.PearCupTrustedPathPreflight || (typeof require !== 'undefined' ? require('./trusted-path-preflight.js') : null)

  if (!runtimeSettings) throw new Error('PearCupRuntimeSettings is required before PearCupLiveLaunchAudit')
  if (!workerRuntime) throw new Error('PearCupWorkerRuntime is required before PearCupLiveLaunchAudit')
  if (!settlementService) throw new Error('PearCupSettlementService is required before PearCupLiveLaunchAudit')
  if (!liveReadiness) throw new Error('PearCupLiveReadiness is required before PearCupLiveLaunchAudit')
  if (!trustedPathPreflight) throw new Error('PearCupTrustedPathPreflight is required before PearCupLiveLaunchAudit')

  function clone (value) {
    return value == null ? null : JSON.parse(JSON.stringify(value))
  }

  function wdkSettingsFrom (settings = {}) {
    return settings.sdkPackages && (settings.sdkPackages.tetherWdk || settings.sdkPackages.tetherWDK) || {}
  }

  function qvacSettingsFrom (settings = {}) {
    return settings.sdkPackages && settings.sdkPackages.qvac || {}
  }

  function qvacLoadableModelConfigured (qvac = {}) {
    return Boolean(qvac && (qvac.modelSrc || qvac.modelExport || qvac.preloadedModelId))
  }

  function configuredRecipientCount (settings = {}, payoutRecipients) {
    const wdk = wdkSettingsFrom(settings)
    return Object.keys({
      ...(wdk.payoutRecipients || {}),
      ...(payoutRecipients || {})
    }).length
  }

  function hasPayoutRecipientRoute ({ settings = {}, payoutAddress, payoutRecipients } = {}) {
    const wdk = wdkSettingsFrom(settings)
    return Boolean(
      payoutAddress ||
      wdk.defaultPayoutAddress ||
      configuredRecipientCount(settings, payoutRecipients) > 0
    )
  }

  function processorEvidenceReady (processor) {
    const status = processor && processor.status
    const transferCount = processor && processor.transferCount
    const transferStatuses = processor && processor.transferStatuses || {}
    return Boolean(
      processor &&
      ['quoted', 'planned', 'broadcast'].includes(status) &&
      status !== 'recipient-required' &&
      Number.isInteger(transferCount) &&
      transferCount > 0 &&
      transferStatuses[status] > 0 &&
      typeof processor.transfersHash === 'string'
    )
  }

  function usesAsset (wdk = {}, asset) {
    const assets = Array.isArray(wdk.assets) ? wdk.assets : ['usdt-evm']
    return assets.includes(asset)
  }

  function check ({ id, label, ok, severity = 'error', source = 'launch-audit', detail }) {
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

  function summarizeChecks (checks = []) {
    return {
      passed: checks.filter(item => item.ok).length,
      failed: checks.filter(item => !item.ok).length,
      blocking: checks.filter(item => !item.ok && item.severity === 'error').length,
      warnings: checks.filter(item => !item.ok && item.severity === 'warning').length
    }
  }

  function compactTrustedPathReport (report = {}) {
    return {
      id: report.id,
      ok: report.ok === true,
      skipped: report.skipped === true,
      liveReady: report.liveReady === true,
      reason: report.reason || null,
      settlementStatus: report.status && report.status.settlementStatus,
      summary: clone(report.summary),
      receiptVerification: clone(report.receiptVerification),
      receipt: report.receipt
        ? {
            receiptId: report.receipt.receiptId,
            receiptHash: report.receipt.receiptHash,
            settlementType: report.receipt.settlementType,
            qvacAttestationId: report.receipt.qvacAttestationId,
            wdkPayoutId: report.receipt.wdkPayoutId,
            wdkEscrowId: report.receipt.wdkEscrowId,
            wdkStatus: report.receipt.wdkStatus,
            wdkEventType: report.receipt.wdkEventType,
            wdkQvacAttestationId: report.receipt.wdkQvacAttestationId,
            game: clone(report.receipt.game),
            pool: clone(report.receipt.pool),
            payoutRecipients: clone(report.receipt.payoutRecipients),
            processorPayout: clone(report.receipt.processorPayout),
            processorRelease: clone(report.receipt.processorRelease)
          }
        : null
    }
  }

  function createLaunchChecks ({ settings = {}, status = {}, liveReport = {}, trustedReport, trustedGameReport, payoutAddress, payoutRecipients, allowBroadcast = false } = {}) {
    const qvac = qvacSettingsFrom(settings)
    const wdk = wdkSettingsFrom(settings)
    const readiness = status.readiness || {}
    const compliance = readiness.compliance || settings.compliance || {}
    const gate = status.settlementGate || liveReport.settlementGate || settlementService.settlementGateFor(status)
    const qvacConfigured = qvacLoadableModelConfigured(qvac)
    const wdkSeedConfigured = Boolean(wdk && wdk.seedPhrase)
    const usdtEvmProviderReady = !usesAsset(wdk, 'usdt-evm') || Boolean(wdk.evmProvider)
    const payoutRouteReady = hasPayoutRecipientRoute({ settings, payoutAddress, payoutRecipients })
    const trustedPathOk = trustedReport && trustedReport.ok === true && trustedReport.skipped !== true
    const trustedGamePathOk = trustedGameReport && trustedGameReport.ok === true && trustedGameReport.skipped !== true
    const trustedPathReceiptVerified = Boolean(
      trustedReport &&
      trustedReport.receiptVerification &&
      trustedReport.receiptVerification.ok === true
    )
    const trustedGameReceiptVerified = Boolean(
      trustedGameReport &&
      trustedGameReport.receiptVerification &&
      trustedGameReport.receiptVerification.ok === true
    )
    const trustedPathDeclarationReady = Boolean(
      trustedReport &&
      trustedReport.receipt &&
      trustedReport.receipt.payoutRecipients &&
      trustedReport.receipt.payoutRecipients.count > 0
    )
    const trustedPathProcessorReady = Boolean(
      trustedReport &&
      trustedReport.receipt &&
      processorEvidenceReady(trustedReport.receipt.processorPayout)
    )
    const trustedGameWinnerRouteReady = Boolean(
      trustedGameReport &&
      trustedGameReport.summary &&
      trustedGameReport.summary.winnerRecipientRoute &&
      trustedGameReport.summary.winnerRecipientRoute.available === true
    )
    const trustedGameProcessorReady = Boolean(
      trustedGameReport &&
      trustedGameReport.receipt &&
      processorEvidenceReady(trustedGameReport.receipt.processorRelease)
    )

    return [
      check({
        id: 'runtime-config-file',
        label: 'Auditable runtime config file is loaded',
        ok: settings.source && settings.source.loaded === true,
        severity: 'warning',
        source: 'runtime-settings',
        detail: settings.source && settings.source.path
      }),
      check({
        id: 'qvac-configured',
        label: 'QVAC trusted referee model is configured',
        ok: qvacConfigured,
        source: 'runtime-settings',
        detail: qvacConfigured ? qvac.modelExport || qvac.modelSrc || qvac.preloadedModelId : 'missing modelSrc, modelExport, or preloadedModelId'
      }),
      check({
        id: 'qvac-sdk-ready',
        label: 'QVAC referee adapter exposes required attestation methods',
        ok: readiness.qvac && readiness.qvac.sdkReady === true,
        source: readiness.qvac && readiness.qvac.source || 'runtime-config',
        detail: readiness.qvac && readiness.qvac.missing && readiness.qvac.missing.length
          ? `missing ${readiness.qvac.missing.join(', ')}`
          : undefined
      }),
      check({
        id: 'wdk-seed-configured',
        label: 'Tether WDK seed is configured and redacted from reports',
        ok: wdkSeedConfigured,
        source: 'runtime-settings',
        detail: wdkSeedConfigured ? '[redacted]' : 'missing sdkPackages.tetherWdk.seedPhrase or PEARCUP_WDK_SEED'
      }),
      check({
        id: 'wdk-sdk-ready',
        label: 'Tether WDK adapter exposes escrow, entry, confirmation, and payout methods',
        ok: readiness.tetherWdk && readiness.tetherWdk.sdkReady === true,
        source: readiness.tetherWdk && readiness.tetherWdk.source || 'runtime-config',
        detail: readiness.tetherWdk && readiness.tetherWdk.missing && readiness.tetherWdk.missing.length
          ? `missing ${readiness.tetherWdk.missing.join(', ')}`
          : undefined
      }),
      check({
        id: 'wdk-live-provider',
        label: 'Tether WDK live provider is configured for selected assets',
        ok: usdtEvmProviderReady,
        source: 'runtime-settings',
        detail: usdtEvmProviderReady ? undefined : 'usdt-evm requires sdkPackages.tetherWdk.evmProvider or PEARCUP_EVM_PROVIDER'
      }),
      check({
        id: 'wdk-balance-probe',
        label: 'Tether WDK balance probe is enabled for live confirmation',
        ok: wdk.skipInitialBalanceProbe !== true,
        source: 'runtime-settings',
        detail: wdk.skipInitialBalanceProbe === true ? 'skipInitialBalanceProbe must be false for live settlement' : undefined
      }),
      check({
        id: 'payout-recipient-route',
        label: 'Winner payout recipient route is available',
        ok: payoutRouteReady,
        source: 'runtime-settings',
        detail: payoutRouteReady
          ? `configured recipient entries: ${configuredRecipientCount(settings, payoutRecipients)}`
          : 'set defaultPayoutAddress, payoutRecipients, or PEARCUP_TRUSTED_PATH_PAYOUT_ADDRESS'
      }),
      check({
        id: 'payout-recipient-declarations',
        label: 'Winner payout recipient route is declared in the worker event log',
        ok: trustedPathDeclarationReady,
        source: 'trusted-path-preflight',
        detail: trustedPathDeclarationReady
          ? `declarations: ${trustedReport.receipt.payoutRecipients.count}`
          : 'trusted path must record PayoutRecipientDeclared before WDK payout preparation'
      }),
      check({
        id: 'game-winner-recipient-route',
        label: 'Game winner payout recipient route is available for WDK escrow release',
        ok: trustedGameWinnerRouteReady,
        source: 'trusted-game-preflight',
        detail: trustedGameWinnerRouteReady
          ? `source: ${trustedGameReport.summary.winnerRecipientRoute.source}`
          : 'trusted game preflight must prove the actual winner has defaultPayoutAddress or payoutRecipients mapping'
      }),
      check({
        id: 'payout-broadcast-policy',
        label: 'Broadcast payouts require an explicit operator override',
        ok: wdk.broadcastPayouts !== true || allowBroadcast === true,
        source: 'runtime-settings',
        detail: wdk.broadcastPayouts === true && allowBroadcast !== true
          ? 'broadcastPayouts is true but launch audit was not run with an explicit allow-broadcast override'
          : undefined
      }),
      check({
        id: 'compliance-real-money',
        label: 'Real-money mode has legal approval',
        ok: compliance.realMoneyEnabled === true,
        source: 'runtime-compliance:realMoneyEnabled'
      }),
      check({
        id: 'compliance-kyc',
        label: 'KYC is verified before prize pools unlock',
        ok: compliance.kycVerified === true,
        source: 'runtime-compliance:kycVerified'
      }),
      check({
        id: 'compliance-jurisdiction',
        label: 'User jurisdiction is allowed',
        ok: compliance.jurisdictionAllowed === true,
        source: 'runtime-compliance:jurisdictionAllowed'
      }),
      check({
        id: 'compliance-responsible-play',
        label: 'Responsible-play terms are accepted',
        ok: compliance.responsiblePlayAccepted === true,
        source: 'runtime-compliance:responsiblePlayAccepted'
      }),
      check({
        id: 'settlement-gate',
        label: 'Live settlement gate is ready',
        ok: liveReport.liveReady === true && gate.liveReady === true,
        source: 'settlement-service',
        detail: gate.status
      }),
      check({
        id: 'trusted-path-preflight',
        label: 'QVAC pool attestation flows into Tether WDK payout evidence and receipt recording',
        ok: trustedPathOk && trustedPathProcessorReady,
        source: 'trusted-path-preflight',
        detail: trustedReport
          ? trustedReport.reason || (trustedReport.summary && `${trustedReport.summary.attestationEvent} -> ${trustedReport.summary.settlementEvent}`)
          : 'not run'
      }),
      check({
        id: 'trusted-path-processor-evidence',
        label: 'Bracket payout WDK processor evidence includes at least one transfer',
        ok: trustedPathProcessorReady,
        source: 'trusted-path-preflight',
        detail: trustedPathProcessorReady
          ? `${trustedReport.receipt.processorPayout.status}, transfers=${trustedReport.receipt.processorPayout.transferCount}`
          : 'processor payout evidence must include non-empty transfer proof'
      }),
      check({
        id: 'trusted-path-receipt-verification',
        label: 'Bracket payout settlement receipt verifies independently',
        ok: trustedPathReceiptVerified,
        source: 'trusted-path-preflight',
        detail: trustedPathReceiptVerified
          ? 'receipt verifier passed'
          : trustedReport && trustedReport.receiptVerification
            ? trustedReport.receiptVerification.errors.join('; ')
            : 'trusted path receipt verification was not reported'
      }),
      check({
        id: 'trusted-game-preflight',
        label: 'QVAC game referee attestation flows into Tether WDK escrow release evidence and receipt recording',
        ok: trustedGamePathOk && trustedGameProcessorReady,
        source: 'trusted-game-preflight',
        detail: trustedGameReport
          ? trustedGameReport.reason || (trustedGameReport.summary && `${trustedGameReport.summary.attestationEvent} -> ${trustedGameReport.summary.settlementEvent}`)
          : 'not run'
      }),
      check({
        id: 'trusted-game-processor-evidence',
        label: 'Game escrow WDK processor evidence includes at least one transfer',
        ok: trustedGameProcessorReady,
        source: 'trusted-game-preflight',
        detail: trustedGameProcessorReady
          ? `${trustedGameReport.receipt.processorRelease.status}, transfers=${trustedGameReport.receipt.processorRelease.transferCount}`
          : 'processor release evidence must include non-empty transfer proof'
      }),
      check({
        id: 'trusted-game-receipt-verification',
        label: 'Game escrow settlement receipt verifies independently',
        ok: trustedGameReceiptVerified,
        source: 'trusted-game-preflight',
        detail: trustedGameReceiptVerified
          ? 'receipt verifier passed'
          : trustedGameReport && trustedGameReport.receiptVerification
            ? trustedGameReport.receiptVerification.errors.join('; ')
            : 'trusted game receipt verification was not reported'
      })
    ]
  }

  function assertNoSecretLeak ({ report, settings }) {
    const wdk = wdkSettingsFrom(settings)
    if (!wdk.seedPhrase) return true
    if (JSON.stringify(report).includes(wdk.seedPhrase)) {
      throw new Error('Launch audit leaked the WDK seed phrase')
    }
    return true
  }

  async function runLiveLaunchAudit ({
    settings,
    env,
    rootObject = root,
    service,
    runTrustedPath = true,
    requireLive = false,
    allowBroadcast = false,
    payoutAddress,
    payoutRecipients
  } = {}) {
    const loadedSettings = settings || runtimeSettings.loadRuntimeSettings({ env: env || (typeof process !== 'undefined' ? process.env : {}) })
    const ownsService = !service
    const activeService = service || settlementService.createGuardedSettlementService({
      workerRuntime: workerRuntime.createPearCupWorkerRuntime({
        settings: loadedSettings,
        rootObject
      })
    })

    try {
      const status = activeService.status()
      let trustedReport = null
      let trustedGameReport = null
      if (runTrustedPath) {
        trustedReport = await trustedPathPreflight.runTrustedPathPreflight({
          settings: loadedSettings,
          rootObject,
          service: activeService,
          requireLive,
          allowBroadcast,
          payoutAddress,
          payoutRecipients
        })
        trustedGameReport = await trustedPathPreflight.runTrustedGamePreflight({
          settings: loadedSettings,
          rootObject,
          service: activeService,
          requireLive,
          allowBroadcast,
          payoutAddress
        })
      }
      const liveReport = liveReadiness.createLiveReadinessReport({ settings: loadedSettings, status, smoke: null })
      const checks = createLaunchChecks({
        settings: loadedSettings,
        status,
        liveReport,
        trustedReport,
        trustedGameReport,
        payoutAddress,
        payoutRecipients,
        allowBroadcast
      })
      const summary = summarizeChecks(checks)
      const readyToLaunch = summary.blocking === 0
      const report = {
        id: 'pearcup-live-launch-audit',
        generatedAt: '2026-07-01T00:00:00.000Z',
        ok: readyToLaunch,
        readyToLaunch,
        liveReady: liveReport.liveReady === true,
        mode: clone(status.mode || {}),
        settlementStatus: status.settlementGate && status.settlementGate.status,
        guardMode: status.guardMode || 'unknown',
        summary,
        checks,
        liveReadiness: {
          id: liveReport.id,
          liveReady: liveReport.liveReady === true,
          requiredActionCount: liveReport.requiredActions.length,
          requiredActions: clone(liveReport.requiredActions),
          configValidation: clone(liveReport.configValidation),
          secrets: clone(liveReport.secrets)
        },
        trustedPath: compactTrustedPathReport(trustedReport),
        trustedGamePath: compactTrustedPathReport(trustedGameReport),
        settings: runtimeSettings.redactRuntimeSettings(loadedSettings),
        secrets: {
          wdkSeedRedacted: Boolean(wdkSettingsFrom(loadedSettings).seedPhrase),
          reportContainsRawWdkSeed: false
        }
      }
      assertNoSecretLeak({ report, settings: loadedSettings })
      return report
    } finally {
      if (ownsService && activeService && typeof activeService.close === 'function') await activeService.close()
    }
  }

  function formatLiveLaunchAuditReport (report) {
    const lines = [
      'PearCup live launch audit',
      `${report.readyToLaunch ? 'ok' : 'not ok'} - launch readiness: ${report.readyToLaunch ? 'ready' : 'blocked'}`,
      `ok - settlement gate: ${report.settlementStatus || 'unknown'}`,
      `ok - runtime mode: qvac=${report.mode.qvac || 'unknown'}, tetherWdk=${report.mode.tetherWdk || 'unknown'}`,
      `ok - checks: ${report.summary.passed} passed, ${report.summary.blocking} blocking, ${report.summary.warnings} warnings`
    ]
    for (const item of report.checks) {
      if (item.ok) continue
      const prefix = item.severity === 'warning' ? 'warn' : 'not ok'
      lines.push(`${prefix} - ${item.label}${item.detail ? `: ${item.detail}` : ''}`)
    }
    if (report.trustedPath) {
      if (report.trustedPath.ok) lines.push('ok - trusted path preflight passed')
      else if (report.trustedPath.skipped) lines.push(`not ok - trusted path skipped: ${report.trustedPath.reason}`)
      else lines.push(`not ok - trusted path preflight failed: ${report.trustedPath.reason || 'unknown'}`)
    }
    if (report.trustedGamePath) {
      if (report.trustedGamePath.ok) lines.push('ok - trusted game preflight passed')
      else if (report.trustedGamePath.skipped) lines.push(`not ok - trusted game skipped: ${report.trustedGamePath.reason}`)
      else lines.push(`not ok - trusted game preflight failed: ${report.trustedGamePath.reason || 'unknown'}`)
    }
    if (report.secrets.wdkSeedRedacted) lines.push('ok - WDK seed redacted from launch audit')
    return lines.join('\n')
  }

  const api = {
    runLiveLaunchAudit,
    formatLiveLaunchAuditReport,
    createLaunchChecks,
    summarizeChecks,
    hasPayoutRecipientRoute,
    processorEvidenceReady,
    qvacLoadableModelConfigured,
    assertNoSecretLeak
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupLiveLaunchAudit = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
