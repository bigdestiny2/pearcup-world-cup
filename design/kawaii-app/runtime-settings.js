(function attachPearCupRuntimeSettings (root) {
  const DEFAULT_CONFIG_PATH = 'config/pearcup.runtime.json'

  function safeRequire (name) {
    try {
      return typeof require !== 'undefined' ? require(name) : null
    } catch {
      return null
    }
  }

  function parseBool (value, fallback = false) {
    if (value == null || value === '') return fallback
    if (typeof value === 'boolean') return value
    const normalized = String(value).trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
    return fallback
  }

  function parseList (value, fallback = []) {
    if (Array.isArray(value)) return value.filter(Boolean)
    if (typeof value !== 'string' || value.trim() === '') return fallback
    return value.split(',').map(item => item.trim()).filter(Boolean)
  }

  function parseNumber (value, fallback) {
    if (value == null || value === '') return fallback
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
  }

  function clone (value) {
    return JSON.parse(JSON.stringify(value || {}))
  }

  function readJsonConfig ({ env = {}, configPath, readFile, cwd, resolvePath } = {}) {
    const requestedPath = configPath || env.PEARCUP_RUNTIME_CONFIG || DEFAULT_CONFIG_PATH
    const fs = readFile ? null : safeRequire('node:fs')
    const path = resolvePath ? null : safeRequire('node:path')
    const base = cwd || (typeof process !== 'undefined' && process.cwd ? process.cwd() : '.')
    const resolvedPath = resolvePath
      ? resolvePath(requestedPath)
      : path && !path.isAbsolute(requestedPath)
        ? path.resolve(base, requestedPath)
        : requestedPath
    const fileWasExplicit = Boolean(configPath || env.PEARCUP_RUNTIME_CONFIG)

    try {
      const text = readFile ? readFile(resolvedPath) : fs && fs.readFileSync(resolvedPath, 'utf8')
      if (!text) return { config: {}, path: resolvedPath, loaded: false }
      return { config: JSON.parse(text), path: resolvedPath, loaded: true }
    } catch (err) {
      if (!fileWasExplicit && err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
        return { config: {}, path: resolvedPath, loaded: false }
      }
      throw err
    }
  }

  function qvacSettingsFrom ({ env = {}, config = {} } = {}) {
    const configured = (config.sdkPackages && config.sdkPackages.qvac) || config.qvac || {}
    const enabled = parseBool(env.PEARCUP_QVAC_ENABLED, parseBool(configured.enabled, Boolean(configured.modelSrc || configured.modelId || configured.modelExport)))
    if (!enabled) return null

    const settings = {}
    const modelSrc = env.PEARCUP_QVAC_MODEL_SRC || configured.modelSrc
    const modelId = env.PEARCUP_QVAC_MODEL_ID || configured.modelId
    const modelExport = env.PEARCUP_QVAC_MODEL_EXPORT || configured.modelExport
    if (modelSrc) settings.modelSrc = modelSrc
    if (modelId) settings.modelId = modelId
    if (modelExport) settings.modelExport = modelExport
    settings.autoUnload = parseBool(env.PEARCUP_QVAC_AUTO_UNLOAD, parseBool(configured.autoUnload, true))
    settings.preflightLoadModel = parseBool(env.PEARCUP_QVAC_PREFLIGHT_LOAD_MODEL, parseBool(configured.preflightLoadModel, false))
    if (configured.loadModelOptions) settings.loadModelOptions = configured.loadModelOptions
    if (configured.completionOptions) settings.completionOptions = configured.completionOptions
    return settings
  }

  function tetherWdkSettingsFrom ({ env = {}, config = {} } = {}) {
    const configured = (config.sdkPackages && (config.sdkPackages.tetherWdk || config.sdkPackages.tetherWDK)) || config.tetherWdk || {}
    const seedPhrase = env.PEARCUP_WDK_SEED || configured.seedPhrase
    const enabled = parseBool(env.PEARCUP_WDK_ENABLED, parseBool(configured.enabled, Boolean(seedPhrase)))
    if (!enabled || !seedPhrase) return null

    const assets = parseList(env.PEARCUP_WDK_ASSETS, parseList(configured.assets, ['usdt-evm']))
    return {
      seedPhrase,
      assets,
      evmProvider: env.PEARCUP_EVM_PROVIDER || configured.evmProvider,
      evmChainId: parseNumber(env.PEARCUP_EVM_CHAIN_ID, parseNumber(configured.evmChainId, 1)),
      btcNetwork: env.PEARCUP_BTC_NETWORK || configured.btcNetwork || 'bitcoin',
      btcClient: configured.btcClient,
      payoutAccountIndex: parseNumber(
        env.PEARCUP_WDK_PAYOUT_ACCOUNT_INDEX,
        parseNumber(configured.payoutAccountIndex, 0)
      ),
      defaultPayoutAddress: env.PEARCUP_WDK_DEFAULT_PAYOUT_ADDRESS || configured.defaultPayoutAddress || '',
      payoutRecipients: configured.payoutRecipients || {},
      broadcastPayouts: parseBool(
        env.PEARCUP_WDK_BROADCAST_PAYOUTS,
        parseBool(configured.broadcastPayouts, false)
      ),
      quotePayouts: parseBool(
        env.PEARCUP_WDK_QUOTE_PAYOUTS,
        parseBool(configured.quotePayouts, true)
      ),
      skipInitialBalanceProbe: parseBool(
        env.PEARCUP_WDK_SKIP_INITIAL_BALANCE_PROBE,
        parseBool(configured.skipInitialBalanceProbe, false)
      )
    }
  }

  function complianceSettingsFrom ({ env = {}, config = {} } = {}) {
    const configured = config.compliance || {}
    return {
      realMoneyEnabled: parseBool(env.PEARCUP_REAL_MONEY_ENABLED, configured.realMoneyEnabled === true),
      kycVerified: parseBool(env.PEARCUP_KYC_VERIFIED, configured.kycVerified === true),
      jurisdictionAllowed: parseBool(env.PEARCUP_JURISDICTION_ALLOWED, configured.jurisdictionAllowed === true),
      responsiblePlayAccepted: parseBool(env.PEARCUP_RESPONSIBLE_PLAY_ACCEPTED, configured.responsiblePlayAccepted === true)
    }
  }

  function createLiveRuntimeConfigTemplate ({ env = {} } = {}) {
    const qvacEnabled = parseBool(
      env.PEARCUP_QVAC_ENABLED,
      Boolean(env.PEARCUP_QVAC_MODEL_SRC || env.PEARCUP_QVAC_MODEL_ID || env.PEARCUP_QVAC_MODEL_EXPORT)
    )
    const tetherEnabled = parseBool(env.PEARCUP_WDK_ENABLED, Boolean(env.PEARCUP_WDK_SEED))

    return {
      sdkPackages: {
        qvac: {
          enabled: qvacEnabled,
          modelSrc: env.PEARCUP_QVAC_MODEL_SRC || '',
          modelExport: env.PEARCUP_QVAC_MODEL_EXPORT || 'LLAMA_3_2_1B_INST_Q4_0',
          modelId: env.PEARCUP_QVAC_MODEL_ID || 'qvac-pearcup-referee',
          autoUnload: parseBool(env.PEARCUP_QVAC_AUTO_UNLOAD, true),
          preflightLoadModel: parseBool(env.PEARCUP_QVAC_PREFLIGHT_LOAD_MODEL, false)
        },
        tetherWdk: {
          enabled: tetherEnabled,
          seedPhrase: env.PEARCUP_WDK_SEED || '',
          assets: parseList(env.PEARCUP_WDK_ASSETS, ['usdt-evm']),
          evmProvider: env.PEARCUP_EVM_PROVIDER || '',
          evmChainId: parseNumber(env.PEARCUP_EVM_CHAIN_ID, 1),
          btcNetwork: env.PEARCUP_BTC_NETWORK || 'bitcoin',
          payoutAccountIndex: parseNumber(env.PEARCUP_WDK_PAYOUT_ACCOUNT_INDEX, 0),
          defaultPayoutAddress: env.PEARCUP_WDK_DEFAULT_PAYOUT_ADDRESS || '',
          payoutRecipients: {},
          broadcastPayouts: parseBool(env.PEARCUP_WDK_BROADCAST_PAYOUTS, false),
          quotePayouts: parseBool(env.PEARCUP_WDK_QUOTE_PAYOUTS, true),
          skipInitialBalanceProbe: parseBool(env.PEARCUP_WDK_SKIP_INITIAL_BALANCE_PROBE, false)
        }
      },
      compliance: {
        realMoneyEnabled: parseBool(env.PEARCUP_REAL_MONEY_ENABLED, false),
        kycVerified: parseBool(env.PEARCUP_KYC_VERIFIED, false),
        jurisdictionAllowed: parseBool(env.PEARCUP_JURISDICTION_ALLOWED, false),
        responsiblePlayAccepted: parseBool(env.PEARCUP_RESPONSIBLE_PLAY_ACCEPTED, false)
      }
    }
  }

  function makeConfigIssue ({ key, label, source = 'runtime-settings', severity = 'error', detail }) {
    const issue = { key, label, source, severity }
    if (detail) issue.detail = detail
    return issue
  }

  function payoutRecipientCount (tetherWdk = {}) {
    return Object.values(tetherWdk.payoutRecipients || {}).filter(Boolean).length
  }

  function hasPayoutRecipientRoute (tetherWdk = {}) {
    return Boolean(tetherWdk.defaultPayoutAddress || payoutRecipientCount(tetherWdk) > 0)
  }

  function validateRuntimeSettings (settings = {}, opts = {}) {
    const requireLive = opts.requireLive === true
    const errors = []
    const warnings = []
    const requiredActions = []
    const sdkPackages = settings.sdkPackages || {}
    const qvac = sdkPackages.qvac
    const tetherWdk = sdkPackages.tetherWdk || sdkPackages.tetherWDK
    const compliance = settings.compliance || {}

    function addIssue (issue) {
      if (issue.severity === 'warning') warnings.push(issue)
      else errors.push(issue)
      if (issue.severity !== 'warning') {
        requiredActions.push({
          key: issue.key,
          label: issue.label,
          source: issue.source,
          severity: issue.severity
        })
      }
    }

    if (!settings.source || settings.source.loaded !== true) {
      addIssue(makeConfigIssue({
        key: 'runtime-config-file',
        label: 'Load a local config/pearcup.runtime.json or set PEARCUP_RUNTIME_CONFIG for auditable live setup.',
        severity: 'warning'
      }))
    }

    if (!qvac) {
      addIssue(makeConfigIssue({
        key: 'configure-qvac',
        label: 'Enable sdkPackages.qvac for the QVAC trusted referee path.',
        severity: requireLive ? 'error' : 'warning'
      }))
    } else if (!qvac.modelSrc && !qvac.modelExport && !qvac.preloadedModelId) {
      addIssue(makeConfigIssue({
        key: 'configure-qvac',
        label: 'Set a QVAC modelSrc, modelExport, or preloadedModelId for the trusted referee.',
        severity: requireLive ? 'error' : 'warning'
      }))
    }

    if (!tetherWdk || !tetherWdk.seedPhrase) {
      addIssue(makeConfigIssue({
        key: 'configure-tether-wdk',
        label: 'Set sdkPackages.tetherWdk.seedPhrase or PEARCUP_WDK_SEED for Tether WDK settlement.',
        severity: requireLive ? 'error' : 'warning'
      }))
    } else {
      const assets = parseList(tetherWdk.assets, ['usdt-evm'])
      if (assets.length === 0) {
        addIssue(makeConfigIssue({
          key: 'configure-tether-wdk',
          label: 'Configure at least one Tether WDK settlement asset.',
          severity: requireLive ? 'error' : 'warning'
        }))
      }
      if (assets.includes('usdt-evm') && !tetherWdk.evmProvider) {
        addIssue(makeConfigIssue({
          key: 'configure-tether-wdk',
          label: 'Set PEARCUP_EVM_PROVIDER or sdkPackages.tetherWdk.evmProvider for live USDT-EVM confirmation.',
          severity: requireLive ? 'error' : 'warning'
        }))
      }
      if (tetherWdk.skipInitialBalanceProbe === true) {
        addIssue(makeConfigIssue({
          key: 'configure-tether-wdk',
          label: 'Disable skipInitialBalanceProbe before live prize settlement.',
          severity: requireLive ? 'error' : 'warning'
        }))
      }
      if (!hasPayoutRecipientRoute(tetherWdk)) {
        addIssue(makeConfigIssue({
          key: 'configure-payout-recipients',
          label: 'Configure sdkPackages.tetherWdk.defaultPayoutAddress or payoutRecipients before live prize settlement.',
          severity: requireLive ? 'error' : 'warning'
        }))
      }
      if (tetherWdk.broadcastPayouts === true) {
        addIssue(makeConfigIssue({
          key: 'configure-tether-wdk-payouts',
          label: 'Broadcast payouts are enabled; verify payout recipients, operator custody, and legal release approval.',
          severity: 'warning'
        }))
      }
    }

    const complianceLabels = {
      realMoneyEnabled: 'Enable real-money mode only after legal review.',
      kycVerified: 'Verify KYC before allowing real-money prize pools.',
      jurisdictionAllowed: 'Confirm the user jurisdiction is allowed.',
      responsiblePlayAccepted: 'Require responsible-play terms before live prize pools.'
    }
    for (const key of Object.keys(complianceLabels)) {
      if (compliance[key] !== true) {
        addIssue(makeConfigIssue({
          key: 'complete-compliance',
          label: complianceLabels[key],
          source: `runtime-compliance:${key}`,
          severity: requireLive ? 'error' : 'warning'
        }))
      }
    }

    return {
      ok: errors.length === 0,
      requireLive,
      errors: clone(errors),
      warnings: clone(warnings),
      requiredActions: clone(requiredActions),
      redactedSettings: redactRuntimeSettings(settings)
    }
  }

  function loadRuntimeSettings (opts = {}) {
    const env = opts.env || (typeof process !== 'undefined' ? process.env : {})
    const loaded = opts.config
      ? { config: opts.config, path: opts.configPath || null, loaded: true }
      : readJsonConfig({ ...opts, env })
    const qvac = qvacSettingsFrom({ env, config: loaded.config })
    const tetherWdk = tetherWdkSettingsFrom({ env, config: loaded.config })
    const sdkPackages = {}
    if (qvac) sdkPackages.qvac = qvac
    if (tetherWdk) sdkPackages.tetherWdk = tetherWdk

    return {
      source: {
        path: loaded.path,
        loaded: loaded.loaded
      },
      sdkPackages,
      compliance: complianceSettingsFrom({ env, config: loaded.config })
    }
  }

  function redactRuntimeSettings (settings = {}) {
    const redacted = JSON.parse(JSON.stringify(settings || {}))
    if (redacted.sdkPackages && redacted.sdkPackages.tetherWdk && redacted.sdkPackages.tetherWdk.seedPhrase) {
      redacted.sdkPackages.tetherWdk.seedPhrase = '[redacted]'
    }
    if (redacted.sdkPackages && redacted.sdkPackages.tetherWdk && redacted.sdkPackages.tetherWdk.defaultPayoutAddress) {
      redacted.sdkPackages.tetherWdk.defaultPayoutAddress = '[redacted]'
    }
    if (redacted.sdkPackages && redacted.sdkPackages.tetherWdk && redacted.sdkPackages.tetherWdk.payoutRecipients) {
      redacted.sdkPackages.tetherWdk.payoutRecipients = Object.fromEntries(
        Object.keys(redacted.sdkPackages.tetherWdk.payoutRecipients).map(userId => [userId, '[redacted]'])
      )
    }
    return redacted
  }

  function applyRuntimeSettingsToRoot (rootObject = root, settings = loadRuntimeSettings()) {
    rootObject.PearCupRuntimeSettingsValue = settings
    if (settings.compliance) rootObject.PearCupCompliance = settings.compliance
    return settings
  }

  const api = {
    DEFAULT_CONFIG_PATH,
    parseBool,
    parseList,
    readJsonConfig,
    createLiveRuntimeConfigTemplate,
    payoutRecipientCount,
    hasPayoutRecipientRoute,
    loadRuntimeSettings,
    validateRuntimeSettings,
    redactRuntimeSettings,
    applyRuntimeSettingsToRoot
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupRuntimeSettings = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
