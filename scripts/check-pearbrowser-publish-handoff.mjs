#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const browserPublishScript = resolve(root, '..', '..', '01-browser', 'pearbrowser-desktop', 'scripts', 'publish-and-pin.js')
const approvedPublishWrapper = resolve(root, 'scripts', 'publish-approved-pearcup.mjs')
const args = parseArgs(process.argv.slice(2))
const errors = []
const checks = []

const receiptPath = args.receipt
  ? resolve(args.receipt)
  : prepareFreshCandidate()

const receipt = readReceipt(receiptPath)
if (receipt) validateReceipt(receipt, receiptPath)

if (errors.length > 0) {
  console.error('PearBrowser publish handoff failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  const bundle = resolve(receipt.bundle)
  console.log('PearBrowser publish handoff passed')
  for (const check of checks) console.log(`ok - ${check}`)
  console.log(`bundle - ${bundle}`)
  console.log(`receipt - ${receiptPath}`)
  console.log(`bundle sha256 - ${receipt.bundleSha256}`)
  console.log('approved publish command, after explicit approval:')
  if (receipt.publishHandoff && receipt.publishHandoff.approvedCommand) {
    console.log(receipt.publishHandoff.approvedCommand)
  } else {
    console.log(`npm run publish:approved -- --receipt ${JSON.stringify(receiptPath)} --sha ${receipt.bundleSha256} --publish`)
  }
  console.log('raw publish command:')
  if (existsSync(browserPublishScript)) {
    console.log(`node ${JSON.stringify(browserPublishScript)} ${JSON.stringify(bundle)} --name pearcup`)
  } else {
    console.log(`node <pearbrowser>/scripts/publish-and-pin.js ${JSON.stringify(bundle)} --name pearcup`)
  }
  console.log('approval - do not publish/pin until the user explicitly approves this exact bundle')
}

function prepareFreshCandidate () {
  const out = mkdtempSync(join(tmpdir(), 'pearcup-publish-handoff-'))
  runNode('scripts/prepare-pearbrowser-release.mjs', ['--out', out])
  return join(out, 'pearcup-release-receipt.json')
}

function validateReceipt (receipt, receiptPath) {
  if (receipt.app !== 'PearCup') errors.push('receipt app must be PearCup')
  if (!receipt.bundle) errors.push('receipt is missing bundle path')
  if (!receipt.bundleSha256 || !/^[0-9a-f]{64}$/i.test(receipt.bundleSha256)) errors.push('receipt is missing a valid bundleSha256')
  if (!Array.isArray(receipt.files) || receipt.files.length === 0) errors.push('receipt has no file inventory')

  const bundle = receipt.bundle ? resolve(receipt.bundle) : ''
  if (!bundle || !existsSync(bundle) || !statSync(bundle).isDirectory()) {
    errors.push(`receipt bundle directory does not exist: ${bundle || '(missing)'}`)
    return
  }

  runNode('scripts/smoke-pearbrowser-hyper.mjs', ['--bundle', bundle])
  checks.push('Hyper payload smoke')

  const manifest = readJson(join(bundle, 'manifest.json'), 'bundle manifest')
  if (manifest) {
    if (manifest.name !== 'PearCup') errors.push('bundle manifest name must be PearCup')
    if (manifest.entry !== '/index.html') errors.push('bundle manifest entry must be /index.html')
    if (!Array.isArray(manifest.permissions) || !manifest.permissions.includes('swarm.v1')) {
      errors.push('bundle manifest permissions must include swarm.v1')
    }
  }

  for (const forbidden of ['index.cjs', 'package.json', 'pear-worker.cjs', 'swarm-worker.cjs', 'node_modules']) {
    if (existsSync(join(bundle, forbidden))) errors.push(`publish bundle must not include /${forbidden}`)
  }

  const actualFiles = listFiles(bundle).map(filePath => {
    const data = readFileSync(filePath)
    return {
      path: '/' + relative(bundle, filePath).replace(/\\/g, '/'),
      bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex')
    }
  }).sort((a, b) => a.path.localeCompare(b.path))

  const receiptFiles = [...(receipt.files || [])].sort((a, b) => String(a.path).localeCompare(String(b.path)))
  if (JSON.stringify(actualFiles.map(file => file.path)) !== JSON.stringify(receiptFiles.map(file => file.path))) {
    errors.push('receipt file inventory does not match bundle files')
  }

  const receiptByPath = new Map(receiptFiles.map(file => [file.path, file]))
  for (const actual of actualFiles) {
    const expected = receiptByPath.get(actual.path)
    if (!expected) continue
    if (expected.bytes !== actual.bytes) errors.push(`receipt byte count mismatch for ${actual.path}`)
    if (expected.sha256 !== actual.sha256) errors.push(`receipt sha256 mismatch for ${actual.path}`)
  }

  const bundleSha256 = createHash('sha256')
    .update(actualFiles.map(file => `${file.sha256}  ${file.path}\n`).join(''))
    .digest('hex')
  if (bundleSha256 !== receipt.bundleSha256) errors.push('receipt bundleSha256 does not match recomputed inventory hash')

  const totals = {
    files: actualFiles.length,
    bytes: actualFiles.reduce((sum, file) => sum + file.bytes, 0)
  }
  if (!receipt.totals || receipt.totals.files !== totals.files) errors.push('receipt total file count mismatch')
  if (!receipt.totals || receipt.totals.bytes !== totals.bytes) errors.push('receipt total byte count mismatch')

  const receiptText = readFileSync(receiptPath, 'utf8')
  if (!receiptText.includes('explicit approval')) errors.push('receipt must document explicit approval before publishing')
  validateVerification(receipt.verification || {})
  if (!receipt.publishHandoff || receipt.publishHandoff.approvalRequired !== true) {
    errors.push('receipt publishHandoff must require explicit approval')
  }
  validatePublishHandoff(receipt.publishHandoff || {}, bundle, receipt.bundleSha256, receiptPath)
  if (!receipt.postPublishVerification || receipt.postPublishVerification.required !== true) {
    errors.push('receipt postPublishVerification must require a published PearBrowser smoke')
  }
  if (receipt.postPublishVerification && !String(receipt.postPublishVerification.command || '').includes('smoke:pearbrowser-published')) {
    errors.push('receipt postPublishVerification command must use smoke:pearbrowser-published')
  }
  if (receipt.postPublishVerification && receipt.postPublishVerification.enforcedByApprovedWrapper !== true) {
    errors.push('receipt postPublishVerification must be enforced by the approved publish wrapper')
  }
  if (receipt.postPublishVerification && !String(receipt.postPublishVerification.resultPath || '').endsWith('pearcup-publish-result.json')) {
    errors.push('receipt postPublishVerification must declare a pearcup-publish-result.json resultPath')
  }
  if (receipt.postPublishVerification && receipt.postPublishVerification.resultRequiresRemoteFriend !== true) {
    errors.push('receipt postPublishVerification must keep remote friend verification as a required follow-up')
  }
  validateApprovedPublishWrapper()

  if (existsSync(browserPublishScript)) checks.push('PearBrowser publish script located')
  else checks.push('PearBrowser publish script path not found; handoff command uses placeholder')
  checks.push(`${totals.files} files hashed`)
  checks.push(`${totals.bytes} bytes accounted`)
}

function validateApprovedPublishWrapper () {
  if (!existsSync(approvedPublishWrapper)) {
    errors.push('approved publish wrapper is missing')
    return
  }
  const wrapper = readFileSync(approvedPublishWrapper, 'utf8')
  if (!wrapper.includes('smoke:pearbrowser-published')) {
    errors.push('approved publish wrapper must run smoke:pearbrowser-published after publish')
  }
  if (!wrapper.includes('extractPublishedUrl')) {
    errors.push('approved publish wrapper must extract the published hyper:// URL')
  }
  if (!wrapper.includes('PearCup approved publish verified')) {
    errors.push('approved publish wrapper must clearly report verified publish completion')
  }
  if (!wrapper.includes('--gateway')) {
    errors.push('approved publish wrapper must pass optional --gateway through to published smoke')
  }
  if (!wrapper.includes('--gateway uses port 4190')) {
    errors.push('approved publish wrapper must reject browser-blocked gateway port 4190')
  }
  if (!wrapper.includes('runPostPublishSmokePreflight') || !wrapper.includes('--check') || !wrapper.includes('smoke-published-pearbrowser.mjs')) {
    errors.push('approved publish wrapper must syntax-check the post-publish smoke before publishing')
  }
  if (!wrapper.includes('runExactBundlePublishedSmoke') || !wrapper.includes('smoke-pearbrowser-published-local.mjs')) {
    errors.push('approved publish wrapper must run the exact bundle local published-gateway smoke before publishing')
  }
  if (!wrapper.includes('exact bundle published-gateway preflight - passed')) {
    errors.push('approved publish wrapper must clearly report the exact bundle published-gateway preflight')
  }
  if (!wrapper.includes('publishedLinkProofCommand') || !wrapper.includes('local published-link proof command')) {
    errors.push('approved publish wrapper must surface the local published-link proof command from the receipt')
  }
  if (!wrapper.includes('localPublishedLinkProofCommand')) {
    errors.push('approved publish wrapper result receipt must preserve the local published-link proof command field')
  }
  if (wrapper.includes('localPublishedBrowserCommand')) {
    errors.push('approved publish wrapper must not write the deprecated localPublishedBrowserCommand field')
  }
  if (!wrapper.includes('writePublishResultReceipt') || !wrapper.includes('pearcup-publish-result.json')) {
    errors.push('approved publish wrapper must write a pearcup-publish-result.json after verified publish')
  }
  if (!wrapper.includes('pending-remote-friend')) {
    errors.push('approved publish wrapper result receipt must preserve the remote friend verification gate')
  }
  for (const required of [
    'remote friend opens the final PearBrowser link',
    'remote friend reaches Games without fallback or boot error',
    'host and friend complete a live P2P invite join',
    'host and friend can start Penalty Clash from the joined room',
    'record the observed Penalty Clash room code'
  ]) {
    if (!wrapper.includes(required)) {
      errors.push(`approved publish wrapper result receipt must require: ${required}`)
    }
  }
  if (!wrapper.includes('record:friend-test') || !wrapper.includes('recordCommand')) {
    errors.push('approved publish wrapper result receipt must include a friend-test record command')
  }
  if (!wrapper.includes('record:friend-test -- --publish-result') || !wrapper.includes('--sha ${receipt.bundleSha256')) {
    errors.push('approved publish wrapper friend-test record command must require the exact bundle SHA')
  }
  if (!wrapper.includes('--room-code "<observed-room-code>"')) {
    errors.push('approved publish wrapper friend-test record command must require the observed room code')
  }
}

function validatePublishHandoff (handoff, bundle, bundleSha256, receiptPath) {
  const publishScript = handoff.publishScript ? resolve(handoff.publishScript) : ''
  const wrapper = handoff.approvedPublishWrapper ? resolve(handoff.approvedPublishWrapper) : ''
  const expectedArgs = [
    browserPublishScript,
    bundle,
    '--name',
    'pearcup'
  ]
  const expectedCommand = `node ${JSON.stringify(browserPublishScript)} ${JSON.stringify(bundle)} --name pearcup`
  const expectedApprovedCommand = `node ${JSON.stringify(approvedPublishWrapper)} --receipt ${JSON.stringify(receiptPath)} --sha ${bundleSha256} --publish`

  if (handoff.appName !== 'pearcup') errors.push('receipt publishHandoff appName must be pearcup')
  if (!publishScript) errors.push('receipt publishHandoff is missing publishScript')
  else if (publishScript !== browserPublishScript) errors.push('receipt publishHandoff publishScript path changed')
  if (!wrapper) errors.push('receipt publishHandoff is missing approvedPublishWrapper')
  else if (wrapper !== approvedPublishWrapper) errors.push('receipt publishHandoff approvedPublishWrapper path changed')
  if (handoff.updatesExistingDrive !== false) errors.push('receipt publishHandoff must declare updatesExistingDrive=false for fresh friend-test bundles')
  if (!Array.isArray(handoff.args) || JSON.stringify(handoff.args) !== JSON.stringify(expectedArgs)) {
    errors.push('receipt publishHandoff args must exactly match the approved fresh publish command')
  }
  if (handoff.command !== expectedCommand) errors.push('receipt publishHandoff command must exactly match the structured args')
  if (handoff.approvedCommand !== expectedApprovedCommand) {
    errors.push('receipt publishHandoff approvedCommand must route through the SHA-gated wrapper')
  }
  if (String(handoff.command || '').includes('--key') || String(handoff.command || '').includes('--storage')) {
    errors.push('receipt publishHandoff command must not update an existing drive unless the handoff flow is changed')
  }
}

function validateVerification (verification) {
  const sourceChecks = verification.sourceChecksBeforeBuild || []
  const bundleChecks = verification.bundleChecks || []
  const coverage = verification.requiredCoverage || []
  const bootProbeContract = verification.bootProbeContract || {}
  const bootProbeRequirements = Array.isArray(bootProbeContract.requires)
    ? bootProbeContract.requires
    : []
  const servedPreviewContract = verification.servedPreviewContract || {}
  const servedPreviewRequirements = Array.isArray(servedPreviewContract.requires)
    ? servedPreviewContract.requires
    : []
  const localPublishedGatewayContract = verification.localPublishedGatewayContract || {}
  const localPublishedGatewayRequirements = Array.isArray(localPublishedGatewayContract.requires)
    ? localPublishedGatewayContract.requires
    : []
  const localPublishedLinkContract = verification.localPublishedLinkContract || {}
  const localPublishedLinkRequirements = Array.isArray(localPublishedLinkContract.requires)
    ? localPublishedLinkContract.requires
    : []
  if (!sourceChecks.includes('node scripts/check-kawaii-runtime.mjs')) {
    errors.push('receipt verification must include Kawaii runtime source check before build')
  }
  if (!sourceChecks.includes('npm run test:kawaii-peer')) {
    errors.push('receipt verification must include P2P/deep-link tests before build')
  }
  if (!sourceChecks.includes('node --test scripts/record-friend-test-result.test.mjs')) {
    errors.push('receipt verification must include friend verification receipt tests before build')
  }
  if (!sourceChecks.includes('node --test scripts/record-latest-friend-test-result.test.mjs')) {
    errors.push('receipt verification must include latest friend-test recorder tests before build')
  }
  if (!sourceChecks.includes('node --test scripts/publish-approved-pearcup.test.mjs')) {
    errors.push('receipt verification must include approved publish wrapper tests before build')
  }
  if (!sourceChecks.includes('node --test scripts/publish-approved-latest-pearcup.test.mjs')) {
    errors.push('receipt verification must include latest approved publish wrapper tests before build')
  }
  if (!sourceChecks.includes('node --test scripts/prepare-pearbrowser-release.test.mjs')) {
    errors.push('receipt verification must include release handoff prep tests before build')
  }
  if (!sourceChecks.includes('node --test scripts/check-pear-seamless.test.mjs')) {
    errors.push('receipt verification must include seamless gate tests before build')
  }
  if (!sourceChecks.includes('node --test scripts/smoke-published-pearbrowser.test.mjs')) {
    errors.push('receipt verification must include published smoke regression tests before build')
  }
  if (!sourceChecks.includes('npm run smoke:kawaii-p2p-preview')) {
    errors.push('receipt verification must include explicit P2P preview/PearBrowser smoke before build')
  }
  if (!sourceChecks.includes('npm run smoke:kawaii-pear-run')) {
    errors.push('receipt verification must include actual Pear runtime launch smoke before build')
  }
  if (!sourceChecks.includes('npm run smoke:pearbrowser-serve')) {
    errors.push('receipt verification must include served PearBrowser preview smoke before build')
  }
  if (!sourceChecks.includes('npm run smoke:pearbrowser-published-local')) {
    errors.push('receipt verification must include local published-gateway smoke before build')
  }
  if (!bundleChecks.some(check => String(check).startsWith('node scripts/build-pearbrowser-hyper.mjs --out '))) {
    errors.push('receipt verification must include PearBrowser bundle build')
  }
  if (!bundleChecks.some(check => String(check).startsWith('node scripts/smoke-pearbrowser-hyper.mjs --bundle '))) {
    errors.push('receipt verification must include Hyper payload smoke')
  }
  if (!bundleChecks.some(check => String(check).startsWith('node scripts/smoke-pearbrowser-published-local.mjs --bundle '))) {
    errors.push('receipt verification must include local published-gateway smoke against the exact bundle')
  }
  for (const required of [
    'design/kawaii-app/index-entry.test.js',
    'design/kawaii-app/app-deeplink.test.js',
    'design/kawaii-app/peer-match.test.js',
    'design/kawaii-app/peer-net.test.js',
    'design/kawaii-app/peer-preview-smoke.test.js',
    'scripts/record-friend-test-result.test.mjs',
    'scripts/record-latest-friend-test-result.test.mjs',
    'scripts/publish-approved-pearcup.test.mjs',
    'scripts/publish-approved-latest-pearcup.test.mjs',
    'scripts/prepare-pearbrowser-release.test.mjs',
    'scripts/check-pear-seamless.test.mjs',
    'scripts/smoke-published-pearbrowser.test.mjs'
  ]) {
    if (!coverage.includes(required)) errors.push(`receipt verification must list required coverage: ${required}`)
  }
  validateP2PSmokeCoverage()
  if (bootProbeContract.command !== 'npm run smoke:kawaii-pear-run') {
    errors.push('receipt bootProbeContract must be tied to npm run smoke:kawaii-pear-run')
  }
  for (const required of [
    'bootReady=p2p',
    'p2pModules=ready',
    'appBooted=true',
    'appBootedDataset=true',
    'activeScreenDataset present',
    'uiHydrated=true',
    'teamCards>=32',
    'avatarImages include avatars/',
    'profileChipReady=true',
    'controllers.peerNet=true',
    'controllers.peerMatch=true',
    'controllers.peerLobby=true',
    'controllers.watchSync=true',
    'routeButtons include games',
    'runtimeSelfTest=ready',
    'runtimeSelfTest.activeScreen=games',
    'runtimeSelfTest.activeScreenDataset=games',
    'runtimeSelfTest.appBootedDataset=true',
    'runtimeSelfTest.activeNav includes Games',
    'runtimeSelfTest.hasLobbyMascot=true',
    'runtimeSelfTest.generatedAvatarImages include avatars/',
    'runtimeSelfTest.inviteModalOpen=true',
    'runtimeSelfTest.inviteLink includes ?join=',
    'runtimeSelfTest.peerMatch.active=true',
    'runtimeSelfTest.peerHandshake.started=true',
    'runtimeSelfTest.peerHandshake.guest.p2pModules=ready',
    'runtimeSelfTest.peerHandshake.guest.activeScreen=games',
    'runtimeSelfTest.peerHandshake.guest.activeScreenDataset=games',
    'runtimeSelfTest.peerHandshake.guest.appBootedDataset=true'
  ]) {
    if (!bootProbeRequirements.includes(required)) {
      errors.push(`receipt bootProbeContract must require ${required}`)
    }
  }
  if (servedPreviewContract.command !== 'npm run smoke:pearbrowser-serve') {
    errors.push('receipt servedPreviewContract must be tied to npm run smoke:pearbrowser-serve')
  }
  for (const required of [
    'initial boot bundle includes runtime self-test',
    'refreshed boot bundle includes runtime self-test',
    'served index requires every P2P readiness marker',
    'served app includes runtime self-test',
    'served app includes hidden guest invite handshake self-test',
    'served app references generated avatars',
    'served app references mascot art',
    'served app and boot bundle make no executable bare P2P controller calls',
    'served index does not rely on module scripts',
    'served styles reference stadium/ball/confetti art',
    'served generated avatar assets are non-empty',
    'served mascot/stadium assets are non-empty'
  ]) {
    if (!servedPreviewRequirements.includes(required)) {
      errors.push(`receipt servedPreviewContract must require ${required}`)
    }
  }
  if (localPublishedGatewayContract.command !== 'npm run smoke:pearbrowser-published-local') {
    errors.push('receipt localPublishedGatewayContract must be tied to npm run smoke:pearbrowser-published-local')
  }
  if (localPublishedGatewayContract.bundleCommand !== 'node scripts/smoke-pearbrowser-published-local.mjs --bundle <bundle>') {
    errors.push('receipt localPublishedGatewayContract must document the exact-bundle smoke command')
  }
  for (const required of [
    'local gateway serves /app/<64-hex-drive>/',
    'local gateway serves ?join= deep links',
    'local gateway reuses published PearBrowser smoke',
    'published-style smoke rejects preview-only paths',
    'published-style smoke verifies app/boot/P2P/assets contract before publish'
  ]) {
    if (!localPublishedGatewayRequirements.includes(required)) {
      errors.push(`receipt localPublishedGatewayContract must require ${required}`)
    }
  }
  if (localPublishedLinkContract.command !== 'npm run serve:pearbrowser-published -- --receipt <receipt> --port 4191') {
    errors.push('receipt localPublishedLinkContract must document the exact-receipt published-link server command')
  }
  if (!String(localPublishedLinkContract.exactReceiptCommand || '').includes('serve:pearbrowser-published') ||
    !String(localPublishedLinkContract.exactReceiptCommand || '').includes('--port 4191')) {
    errors.push('receipt localPublishedLinkContract must include an exact receipt command')
  }
  for (const required of [
    'exact receipt bundle is served at /app/<64-hex-drive>/',
    'local proof server uses a browser-safe fetch port',
    'published-link smoke fetches root and ?join= deep-link HTML',
    'published-link smoke verifies app/boot/P2P/assets contract before publish',
    'published-link smoke verifies generated avatar and game art assets',
    'published-link smoke rejects preview-only paths',
    'published-link smoke verifies hyper invite code paths do not leak localhost',
    'live browser runtime proof remains the remote friend gate'
  ]) {
    if (!localPublishedLinkRequirements.includes(required)) {
      errors.push(`receipt localPublishedLinkContract must require ${required}`)
    }
  }
  validateSmokeContracts()
  checks.push('release verification receipt')
}

function validateSmokeContracts () {
  const runtimeSmokePath = join(root, 'scripts', 'smoke-kawaii-pear-run.mjs')
  const servedSmokePath = join(root, 'scripts', 'smoke-pearbrowser-serve.mjs')
  const localPublishedSmokePath = join(root, 'scripts', 'smoke-pearbrowser-published-local.mjs')
  const publishedSmokePath = join(root, 'scripts', 'smoke-published-pearbrowser.mjs')
  const publishedServerPath = join(root, 'scripts', 'serve-pearbrowser-published-local.mjs')
  const friendReadyPath = join(root, 'scripts', 'check-friend-ready.mjs')
  const friendResultPath = join(root, 'scripts', 'record-friend-test-result.mjs')
  const seamlessPath = join(root, 'scripts', 'check-pear-seamless.mjs')
  for (const [filePath, label] of [
    [runtimeSmokePath, 'actual Pear runtime smoke'],
    [servedSmokePath, 'served PearBrowser preview smoke'],
    [localPublishedSmokePath, 'local published-gateway smoke'],
    [publishedSmokePath, 'published PearBrowser smoke'],
    [publishedServerPath, 'local published browser server'],
    [friendReadyPath, 'friend-ready preview gate'],
    [friendResultPath, 'friend-test result recorder'],
    [seamlessPath, 'seamless readiness gate']
  ]) {
    if (!existsSync(filePath)) errors.push(`${label} script is missing`)
  }
  if (existsSync(runtimeSmokePath)) {
    const runtimeSmoke = readFileSync(runtimeSmokePath, 'utf8')
    for (const required of [
      'pearcup:runtime-self-test',
      'runtime self-test activeScreen',
      'runtime self-test activeScreenDataset',
      'runtime self-test appBootedDataset',
      'runtime self-test invite link did not include ?join=',
      'runtime self-test did not leave a hosted peer match active',
      'runtime self-test did not complete hidden guest invite handshake',
      'runtime self-test guest activeScreenDataset',
      'runtime self-test guest appBootedDataset',
      'runtime self-test guest did not join the hosted peer match'
    ]) {
      if (!runtimeSmoke.includes(required)) errors.push(`actual Pear runtime smoke is missing contract text: ${required}`)
    }
  }
  if (existsSync(servedSmokePath)) {
    const servedSmoke = readFileSync(servedSmokePath, 'utf8')
    for (const required of [
      'assertServedRuntimeContract',
      'runBootRuntimeSelfTest',
      'runRuntimePeerHandshakeSelfTest',
      'pearcupRuntimeSelfTestGuest',
      'avatars/p-aria.png',
      'assets/mascot.png'
    ]) {
      if (!servedSmoke.includes(required)) errors.push(`served PearBrowser preview smoke is missing contract text: ${required}`)
    }
  }
  if (existsSync(localPublishedSmokePath)) {
    const localPublishedSmoke = readFileSync(localPublishedSmokePath, 'utf8')
    for (const required of [
      'smoke-published-pearbrowser.mjs',
      'app/${drive}/',
      'resolveGatewayRequest',
      'PearBrowser local published-gateway smoke passed'
    ]) {
      if (!localPublishedSmoke.includes(required)) errors.push(`local published-gateway smoke is missing contract text: ${required}`)
    }
  }
  if (existsSync(publishedSmokePath)) {
    const publishedSmoke = readFileSync(publishedSmokePath, 'utf8')
    for (const required of [
      'runBootRuntimeSelfTest',
      'runRuntimePeerHandshakeSelfTest',
      'pearcupRuntimeSelfTestGuest',
      'pearcup:runtime-self-test',
      'PearCupPeerMatch.host()',
      'published mascot art',
      '--gateway uses port 4190'
    ]) {
      if (!publishedSmoke.includes(required)) errors.push(`published PearBrowser smoke is missing contract text: ${required}`)
    }
  }
  if (existsSync(publishedServerPath)) {
    const publishedServer = readFileSync(publishedServerPath, 'utf8')
    for (const required of [
      'PearBrowser local published URL:',
      'PearBrowser local published deep link:',
      '/app/${drive}/',
      'resolveGatewayRequest',
      '--receipt',
      'args.port || 4191'
    ]) {
      if (!publishedServer.includes(required)) errors.push(`local published browser server is missing contract text: ${required}`)
    }
    if (publishedServer.includes('args.port || 4190')) {
      errors.push('local published browser server must not default to blocked fetch port 4190')
    }
  }
  if (existsSync(friendReadyPath)) {
    const friendReady = readFileSync(friendReadyPath, 'utf8')
    for (const required of [
      'runBootRuntimeSelfTest',
      'runRuntimePeerHandshakeSelfTest',
      'pearcupRuntimeSelfTestGuest',
      'pearcup:runtime-self-test',
      'preview app.js runtime self-test does not exercise friend invite hosting',
      'generated avatar p-aria'
    ]) {
      if (!friendReady.includes(required)) errors.push(`friend-ready preview gate is missing contract text: ${required}`)
    }
  }
  if (existsSync(friendResultPath)) {
    const friendResult = readFileSync(friendResultPath, 'utf8')
    for (const required of [
      'localPublishedLinkProofCommand',
      'deprecated localPublishedBrowserCommand',
      'remote friend opens the final PearBrowser link',
      'host and friend complete a live P2P invite join',
      'host and friend can start Penalty Clash from the joined room',
      'recording a passed friend test requires --room-code',
      'observedRoomCode'
    ]) {
      if (!friendResult.includes(required)) errors.push(`friend-test result recorder is missing contract text: ${required}`)
    }
  }
  if (existsSync(seamlessPath)) {
    const seamless = readFileSync(seamlessPath, 'utf8')
    for (const required of [
      'runExactReceiptPublishedProof',
      'serve-pearbrowser-published-local.mjs',
      'smoke-published-pearbrowser.mjs',
      'Exact receipt published-link proof',
      '--strict-port',
      '--proof-port 4190 is blocked'
    ]) {
      if (!seamless.includes(required)) errors.push(`seamless readiness gate is missing contract text: ${required}`)
    }
  }
}

function validateP2PSmokeCoverage () {
  const smokePath = join(root, 'design', 'kawaii-app', 'peer-preview-smoke.test.js')
  if (!existsSync(smokePath)) {
    errors.push('P2P preview/PearBrowser smoke test file is missing')
    return
  }
  const smoke = readFileSync(smokePath, 'utf8')
  for (const required of [
    'preview PeerNet and PeerMatch integrate across two clients',
    'PearBrowser swarm PeerNet and PeerMatch integrate across two clients',
    'PearBrowser swarm lobby challenge routes into a peer match',
    'PearBrowser swarm watch sync shares presence and chat',
    'createPearBrowserSwarmHub'
  ]) {
    if (!smoke.includes(required)) {
      errors.push(`P2P smoke coverage is missing: ${required}`)
    }
  }
}

function readReceipt (filePath) {
  if (!existsSync(filePath)) {
    errors.push(`receipt does not exist: ${filePath}`)
    return null
  }
  return readJson(filePath, 'receipt')
}

function readJson (filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (err) {
    errors.push(`could not read ${label}: ${err.message}`)
    return null
  }
}

function runNode (script, scriptArgs = []) {
  const result = spawnSync(process.execPath, [join(root, script), ...scriptArgs], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`${script} failed${detail ? `:\n${detail}` : ''}`)
  }
}

function listFiles (dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const filePath = join(dir, entry.name)
    if (entry.isDirectory()) listFiles(filePath, acc)
    else if (entry.isFile()) acc.push(filePath)
  }
  return acc
}

function parseArgs (argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--receipt') parsed.receipt = argv[++i]
    else if (arg.startsWith('--receipt=')) parsed.receipt = arg.slice('--receipt='.length)
  }
  return parsed
}
