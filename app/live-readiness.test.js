const assert = require('node:assert/strict')
const test = require('node:test')
const liveReadiness = require('./live-readiness.js')

function settingsWithSeed ({ compliance = false, payoutRoute = true } = {}) {
  const tetherWdk = {
    seedPhrase: 'valid live readiness seed phrase',
    assets: ['usdt-evm'],
    evmProvider: 'https://rpc.example.invalid',
    skipInitialBalanceProbe: false
  }
  if (payoutRoute) tetherWdk.defaultPayoutAddress = '0xreadinesswinner000000000000000000000000'

  return {
    source: {
      path: 'config/pearcup.runtime.test.json',
      loaded: true
    },
    sdkPackages: {
      qvac: {
        modelId: 'qvac-live-readiness-test',
        modelExport: 'LLAMA_3_2_1B_INST_Q4_0'
      },
      tetherWdk
    },
    compliance: {
      realMoneyEnabled: compliance,
      kycVerified: compliance,
      jurisdictionAllowed: compliance,
      responsiblePlayAccepted: compliance
    }
  }
}

function statusFor ({ qvac = 'demo', tetherWdk = 'demo', compliance = false } = {}) {
  const qvacReady = qvac === 'sdk'
  const tetherReady = tetherWdk === 'sdk'
  const complianceFlags = {
    realMoneyEnabled: compliance,
    kycVerified: compliance,
    jurisdictionAllowed: compliance,
    responsiblePlayAccepted: compliance
  }
  const liveReady = qvacReady && tetherReady && compliance
  const sdkReady = qvacReady && tetherReady
  return {
    mode: { qvac, tetherWdk },
    guardMode: liveReady ? 'live-only' : 'demo-allowed',
    canUseRealMoney: liveReady,
    readiness: {
      qvac: {
        mode: qvac,
        source: qvacReady ? 'package:@qvac/sdk' : 'demo',
        sdkReady: qvacReady,
        missing: qvacReady ? [] : ['attestRound', 'attestPoolSettlement']
      },
      tetherWdk: {
        mode: tetherWdk,
        source: tetherReady ? 'package:@tetherto/wdk' : 'demo',
        sdkReady: tetherReady,
        missing: tetherReady ? [] : ['createGameEscrow', 'releaseGameEscrow']
      },
      compliance: complianceFlags,
      settlement: {
        status: liveReady ? 'live-ready' : sdkReady ? 'compliance-locked' : 'demo-locked',
        label: liveReady ? 'Live settlement ready' : sdkReady ? 'SDK ready, prizes locked' : 'Demo settlement locked',
        tone: liveReady ? 'ready' : sdkReady ? 'warn' : 'locked',
        realMoneyEnabled: liveReady
      }
    }
  }
}

test('live readiness report explains demo-locked missing QVAC, WDK, and compliance gates', () => {
  const report = liveReadiness.createLiveReadinessReport({
    settings: settingsWithSeed(),
    status: statusFor()
  })
  const actionKeys = report.requiredActions.map(action => action.key)

  assert.equal(report.liveReady, false)
  assert.equal(report.settlementGate.status, 'demo-locked')
  assert.ok(actionKeys.includes('configure-qvac'))
  assert.ok(actionKeys.includes('configure-tether-wdk'))
  assert.ok(actionKeys.includes('complete-compliance'))
  assert.equal(report.settings.sdkPackages.tetherWdk.seedPhrase, '[redacted]')
  assert.equal(JSON.stringify(report).includes('valid live readiness seed phrase'), false)
  assert.equal(report.secrets.wdkSeedRedacted, true)
})

test('live readiness report separates compliance lock from SDK configuration', () => {
  const report = liveReadiness.createLiveReadinessReport({
    settings: settingsWithSeed(),
    status: statusFor({ qvac: 'sdk', tetherWdk: 'sdk', compliance: false })
  })
  const actionKeys = report.requiredActions.map(action => action.key)

  assert.equal(report.liveReady, false)
  assert.equal(report.settlementGate.status, 'compliance-locked')
  assert.equal(actionKeys.includes('configure-qvac'), false)
  assert.equal(actionKeys.includes('configure-tether-wdk'), false)
  assert.ok(actionKeys.includes('complete-compliance'))
})

test('live readiness report is clean when QVAC, WDK, and compliance are live ready', () => {
  const report = liveReadiness.createLiveReadinessReport({
    settings: settingsWithSeed({ compliance: true }),
    status: statusFor({ qvac: 'sdk', tetherWdk: 'sdk', compliance: true }),
    smoke: {
      ok: true,
      label: 'QvacRefereeAttestationCreated -> TetherWdkEscrowReleased'
    }
  })

  assert.equal(report.liveReady, true)
  assert.equal(report.configValidation.ok, true)
  assert.equal(report.requiredActions.length, 0)
  assert.equal(report.settlementGate.status, 'live-ready')
  assert.equal(report.smoke.ok, true)
  assert.match(liveReadiness.formatLiveReadinessReport(report), /ok - no missing live-readiness actions/)
})

test('live readiness report blocks live status without a payout recipient route', () => {
  const report = liveReadiness.createLiveReadinessReport({
    settings: settingsWithSeed({ compliance: true, payoutRoute: false }),
    status: statusFor({ qvac: 'sdk', tetherWdk: 'sdk', compliance: true })
  })

  assert.equal(report.settlementGate.status, 'live-ready')
  assert.equal(report.configValidation.ok, false)
  assert.equal(report.liveReady, false)
  assert.ok(report.requiredActions.map(action => action.key).includes('configure-payout-recipients'))
  assert.match(report.requiredActions.map(action => action.label).join('\n'), /defaultPayoutAddress or payoutRecipients/)
})

test('live readiness report blocks SDK-ready status when live config is unsafe', () => {
  const settings = settingsWithSeed({ compliance: true })
  settings.sdkPackages.tetherWdk.evmProvider = ''
  settings.sdkPackages.tetherWdk.skipInitialBalanceProbe = true

  const report = liveReadiness.createLiveReadinessReport({
    settings,
    status: statusFor({ qvac: 'sdk', tetherWdk: 'sdk', compliance: true })
  })

  assert.equal(report.settlementGate.status, 'live-ready')
  assert.equal(report.configValidation.ok, false)
  assert.equal(report.liveReady, false)
  assert.match(report.requiredActions.map(action => action.label).join('\n'), /evmProvider/)
})
