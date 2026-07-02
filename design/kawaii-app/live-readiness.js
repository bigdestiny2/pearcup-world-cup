(function attachPearCupLiveReadiness (root) {
  const runtimeSettings = root.PearCupRuntimeSettings || (typeof require !== 'undefined' ? require('./runtime-settings.js') : null)
  const settlementService = root.PearCupSettlementService || (typeof require !== 'undefined' ? require('./settlement-service.js') : null)
  if (!runtimeSettings) throw new Error('PearCupRuntimeSettings is required before PearCupLiveReadiness')
  if (!settlementService) throw new Error('PearCupSettlementService is required before PearCupLiveReadiness')

  function clone (value) {
    return JSON.parse(JSON.stringify(value || {}))
  }

  function missingActionsFor (missing = []) {
    return missing.map(item => {
      if (item.key === 'qvac') {
        return {
          key: 'configure-qvac',
          label: 'Configure a QVAC SDK referee model and verify attestRound/attestPoolSettlement are ready.',
          source: item.source,
          missingMethods: item.missingMethods || []
        }
      }
      if (item.key === 'tetherWdk') {
        return {
          key: 'configure-tether-wdk',
          label: 'Configure Tether WDK seed/provider settings and verify WDK prize methods are ready.',
          source: item.source,
          missingMethods: item.missingMethods || []
        }
      }
      if (item.key === 'compliance') {
        return {
          key: 'complete-compliance',
          label: item.label,
          source: item.source
        }
      }
      return {
        key: item.key || 'unknown',
        label: item.label || 'Resolve the missing readiness requirement.',
        source: item.source || 'unknown'
      }
    })
  }

  function mergeRequiredActions (...groups) {
    const seen = new Set()
    const seenKeys = new Set()
    const merged = []
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex]
      for (const action of group || []) {
        const keyOnly = action.key || 'unknown'
        const source = action.source || ''
        if (groupIndex > 0 && seenKeys.has(keyOnly) && String(source).startsWith('runtime-')) continue
        const key = `${action.key || 'unknown'}:${action.label || ''}:${action.source || ''}`
        if (seen.has(key)) continue
        seen.add(key)
        seenKeys.add(keyOnly)
        merged.push(action)
      }
    }
    return merged
  }

  function assertNoSecretLeak ({ report, settings }) {
    const seed = settings &&
      settings.sdkPackages &&
      settings.sdkPackages.tetherWdk &&
      settings.sdkPackages.tetherWdk.seedPhrase
    if (!seed) return true
    if (JSON.stringify(report).includes(seed)) {
      throw new Error('Live readiness report leaked the WDK seed phrase')
    }
    return true
  }

  function createLiveReadinessReport ({ settings = {}, status = {}, smoke = null } = {}) {
    const redactedSettings = runtimeSettings.redactRuntimeSettings(settings)
    const gate = status.settlementGate || settlementService.settlementGateFor(status)
    const configValidation = typeof runtimeSettings.validateRuntimeSettings === 'function'
      ? runtimeSettings.validateRuntimeSettings(settings, { requireLive: true })
      : { ok: true, errors: [], warnings: [], requiredActions: [] }
    const requiredActions = mergeRequiredActions(
      missingActionsFor(gate.missing),
      configValidation.requiredActions
    )
    const report = {
      id: 'pearcup-live-readiness',
      generatedAt: '2026-07-01T00:00:00.000Z',
      liveReady: gate.liveReady === true && configValidation.ok === true,
      mode: clone(status.mode),
      guardMode: status.guardMode || 'unknown',
      settlementGate: clone(gate),
      settings: redactedSettings,
      configValidation: {
        ok: configValidation.ok === true,
        requireLive: configValidation.requireLive === true,
        errors: clone(configValidation.errors),
        warnings: clone(configValidation.warnings)
      },
      readiness: {
        qvac: clone(status.readiness && status.readiness.qvac),
        tetherWdk: clone(status.readiness && status.readiness.tetherWdk),
        compliance: clone(status.readiness && status.readiness.compliance),
        settlement: clone(status.readiness && status.readiness.settlement)
      },
      requiredActions,
      smoke,
      secrets: {
        wdkSeedRedacted: Boolean(
          settings &&
          settings.sdkPackages &&
          settings.sdkPackages.tetherWdk &&
          settings.sdkPackages.tetherWdk.seedPhrase
        ),
        reportContainsRawWdkSeed: false
      }
    }
    assertNoSecretLeak({ report, settings })
    return report
  }

  function formatLiveReadinessReport (report) {
    const lines = [
      'PearCup live readiness doctor',
      `${report.liveReady ? 'ok' : 'not ok'} - settlement gate: ${report.settlementGate.status}`,
      `ok - guard mode: ${report.guardMode}`,
      `ok - runtime mode: qvac=${report.mode.qvac || 'unknown'}, tetherWdk=${report.mode.tetherWdk || 'unknown'}`
    ]
    if (report.secrets.wdkSeedRedacted) lines.push('ok - WDK seed redacted from report')
    if (report.requiredActions.length === 0) {
      lines.push('ok - no missing live-readiness actions')
    } else {
      for (const action of report.requiredActions) lines.push(`not ok - ${action.label}`)
    }
    if (report.configValidation) {
      for (const warning of report.configValidation.warnings || []) lines.push(`warn - ${warning.label}`)
    }
    if (report.smoke) {
      lines.push(`${report.smoke.ok ? 'ok' : 'not ok'} - trusted settlement smoke: ${report.smoke.label}`)
    }
    return lines.join('\n')
  }

  const api = {
    createLiveReadinessReport,
    formatLiveReadinessReport,
    missingActionsFor,
    mergeRequiredActions,
    assertNoSecretLeak
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupLiveReadiness = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
