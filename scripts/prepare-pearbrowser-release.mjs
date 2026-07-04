#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const browserPublishScript = resolve(root, '..', '..', '01-browser', 'pearbrowser-desktop', 'scripts', 'publish-and-pin.js')
const args = parseArgs(process.argv.slice(2))
const out = args.out
  ? resolve(args.out)
  : mkdtempSync(join(tmpdir(), 'pearcup-release-candidate-'))
const bundle = join(out, 'bundle')
const receiptPath = join(out, 'pearcup-release-receipt.json')
const publishResultPath = join(out, 'pearcup-publish-result.json')

if (args.force && args.out && existsSync(out)) {
  assertSafeForceOut(out)
  assertNoProtectedEvidence(out)
  rmSync(out, { recursive: true, force: true })
}
if (existsSync(bundle)) throw new Error(`bundle output already exists: ${bundle}`)
mkdirSync(out, { recursive: true })

runNode('scripts/check-kawaii-runtime.mjs')
runNpm('test:kawaii-peer')
runNodeTest('scripts/record-friend-test-result.test.mjs')
runNodeTest('scripts/record-latest-friend-test-result.test.mjs')
runNodeTest('scripts/publish-approved-pearcup.test.mjs')
runNodeTest('scripts/publish-approved-latest-pearcup.test.mjs')
runNodeTest('scripts/prepare-pearbrowser-release.test.mjs')
runNodeTest('scripts/check-pear-seamless.test.mjs')
runNodeTest('scripts/smoke-published-pearbrowser.test.mjs')
runNpm('smoke:kawaii-p2p-preview')
runNpm('smoke:kawaii-pear-run')
runNpm('smoke:pearbrowser-serve')
runNpm('smoke:pearbrowser-published-local')
runNode('scripts/build-pearbrowser-hyper.mjs', ['--out', bundle])
runNode('scripts/smoke-pearbrowser-hyper.mjs', ['--bundle', bundle])
runNode('scripts/smoke-pearbrowser-published-local.mjs', ['--bundle', bundle])
runNode('scripts/smoke-published-pearbrowser-runtime.mjs', ['--bundle', bundle])

const files = listFiles(bundle).map(filePath => {
  const data = readFileSync(filePath)
  return {
    path: '/' + relative(bundle, filePath).replace(/\\/g, '/'),
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex')
  }
}).sort((a, b) => a.path.localeCompare(b.path))

const manifest = JSON.parse(readFileSync(join(bundle, 'manifest.json'), 'utf8'))
const bundleSha256 = createHash('sha256')
  .update(files.map(file => `${file.sha256}  ${file.path}\n`).join(''))
  .digest('hex')
const sourceGit = readSourceGitState()
const approvedPublishWrapper = join(root, 'scripts', 'publish-approved-pearcup.mjs')
const receipt = {
  app: 'PearCup',
  generatedAt: new Date().toISOString(),
  sourceGitHead: sourceGit.head,
  sourceGitBranch: sourceGit.branch,
  sourceDirty: sourceGit.dirty,
  sourceGitStatus: sourceGit.status,
  bundle,
  manifest,
  totals: {
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0)
  },
  bundleSha256,
  files,
  verification: {
    sourceChecksBeforeBuild: [
      'node scripts/check-kawaii-runtime.mjs',
      'npm run test:kawaii-peer',
      'node --test scripts/record-friend-test-result.test.mjs',
      'node --test scripts/record-latest-friend-test-result.test.mjs',
      'node --test scripts/publish-approved-pearcup.test.mjs',
      'node --test scripts/publish-approved-latest-pearcup.test.mjs',
      'node --test scripts/prepare-pearbrowser-release.test.mjs',
      'node --test scripts/check-pear-seamless.test.mjs',
      'node --test scripts/smoke-published-pearbrowser.test.mjs',
      'npm run smoke:kawaii-p2p-preview',
      'npm run smoke:kawaii-pear-run',
      'npm run smoke:pearbrowser-serve',
      'npm run smoke:pearbrowser-published-local'
    ],
    bundleChecks: [
      `node scripts/build-pearbrowser-hyper.mjs --out ${bundle}`,
      `node scripts/smoke-pearbrowser-hyper.mjs --bundle ${bundle}`,
      `node scripts/smoke-pearbrowser-published-local.mjs --bundle ${bundle}`,
      `node scripts/smoke-published-pearbrowser-runtime.mjs --bundle ${bundle}`
    ],
    requiredCoverage: [
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
    ],
    bootProbeContract: {
      command: 'npm run smoke:kawaii-pear-run',
      requires: [
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
        'runtimeSelfTest.bracket.activeScreen=bracket',
        'runtimeSelfTest.bracket.matchCards>=31',
        'runtimeSelfTest.bracket.pickButtons>=32',
        'runtimeSelfTest.bracket.roundTitles include Round of 32/Round of 16/Quarterfinals/Semifinals/Final',
        'runtimeSelfTest.bracket.generatedAvatarImages include avatars/',
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
      ]
    },
    exactBundlePearRuntimeContract: {
      command: 'node scripts/smoke-published-pearbrowser-runtime.mjs --bundle <bundle>',
      requires: [
        'temporary Pear app uses exact generated renderer bundle',
        'actual Pear runtime boots exact bundle renderer',
        'bootReady=p2p',
        'p2pModules=ready',
        'runtimeSelfTest=ready',
        'runtimeSelfTest.bracket.activeScreen=bracket',
        'runtimeSelfTest.bracket.matchCards>=31',
        'runtimeSelfTest.bracket.pickButtons>=32',
        'runtimeSelfTest.bracket.roundTitles include Round of 32/Round of 16/Quarterfinals/Semifinals/Final',
        'runtimeSelfTest.bracket.generatedAvatarImages include avatars/',
        'runtimeSelfTest.activeScreen=games',
        'runtimeSelfTest.inviteModalOpen=true',
        'runtimeSelfTest.inviteLink includes ?join=',
        'runtimeSelfTest.peerHandshake.started=true',
        'runtimeSelfTest.peerHandshake.guest.p2pModules=ready',
        'runtimeSelfTest.peerHandshake.guest.activeScreen=games'
      ]
    },
    servedPreviewContract: {
      command: 'npm run smoke:pearbrowser-serve',
      requires: [
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
      ]
    },
    localPublishedGatewayContract: {
      command: 'npm run smoke:pearbrowser-published-local',
      bundleCommand: 'node scripts/smoke-pearbrowser-published-local.mjs --bundle <bundle>',
      requires: [
        'local gateway serves /app/<64-hex-drive>/',
        'local gateway serves ?join= deep links',
        'local gateway reuses published PearBrowser smoke',
        'published-style smoke rejects preview-only paths',
        'published-style smoke verifies app/boot/P2P/assets contract before publish',
        'published-style smoke verifies worker/settlement stack before publish'
      ]
    },
    localPublishedLinkContract: {
      command: 'npm run serve:pearbrowser-published -- --receipt <receipt> --port 4191',
      exactReceiptCommand: `npm run serve:pearbrowser-published -- --receipt ${receiptPath} --port 4191`,
      requires: [
        'exact receipt bundle is served at /app/<64-hex-drive>/',
        'local proof server uses a browser-safe fetch port',
        'published-link smoke fetches root and ?join= deep-link HTML',
        'published-link smoke verifies app/boot/P2P/assets contract before publish',
        'published-link smoke verifies worker/settlement stack before publish',
        'published-link smoke verifies generated avatar and game art assets',
        'published-link smoke rejects preview-only paths',
        'published-link smoke verifies hyper invite code paths do not leak localhost',
        'exact PearBrowser bundle is a manifest renderer payload; exact renderer Pear runtime proof comes from temporary Pear app smoke',
        'live browser runtime proof remains the remote friend gate'
      ]
    }
  },
  publishHandoff: {
    approvalRequired: true,
    appName: 'pearcup',
    publishScript: browserPublishScript,
    approvedPublishWrapper,
    args: [
      browserPublishScript,
      bundle,
      '--name',
      'pearcup'
    ],
    command: `node ${JSON.stringify(browserPublishScript)} ${JSON.stringify(bundle)} --name pearcup`,
    approvedCommand: `node ${JSON.stringify(approvedPublishWrapper)} --receipt ${JSON.stringify(receiptPath)} --sha ${bundleSha256} --publish`,
    updatesExistingDrive: false
  },
  postPublishVerification: {
    required: true,
    command: 'npm run smoke:pearbrowser-published -- --url hyper://<drive-key>/',
    acceptsGatewayUrl: true,
    enforcedByApprovedWrapper: true,
    resultPath: publishResultPath,
    resultRequiresRemoteFriend: true
  },
  nextStep: 'Publish/pin this bundle only after explicit approval.'
}

writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n')
console.log(`PearBrowser release candidate: ${bundle}`)
console.log(`PearBrowser release receipt: ${receiptPath}`)
console.log(`Files: ${receipt.totals.files}`)
console.log(`Bytes: ${receipt.totals.bytes}`)
console.log(`Bundle SHA-256: ${receipt.bundleSha256}`)
console.log(`Source git head: ${receipt.sourceGitHead || '(unknown)'}`)
console.log(`Source dirty: ${receipt.sourceDirty ? 'yes' : 'no'}`)
console.log('Next: publish/pin only after explicit approval.')

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

function runNpm (scriptName) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(npm, ['run', scriptName], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`npm run ${scriptName} failed${detail ? `:\n${detail}` : ''}`)
  }
}

function runNodeTest (script) {
  const result = spawnSync(process.execPath, ['--test', join(root, script)], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`node --test ${script} failed${detail ? `:\n${detail}` : ''}`)
  }
}

function readSourceGitState () {
  const head = runGit(['rev-parse', 'HEAD']).trim()
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  const status = runGit(['status', '--short'])
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  return {
    head,
    branch,
    dirty: status.length > 0,
    status
  }
}

function runGit (gitArgs) {
  const result = spawnSync('git', gitArgs, {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`git ${gitArgs.join(' ')} failed${detail ? `:\n${detail}` : ''}`)
  }
  return result.stdout
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
  const parsed = { force: false, forceEvidence: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--out') parsed.out = argv[++i]
    else if (arg.startsWith('--out=')) parsed.out = arg.slice('--out='.length)
    else if (arg === '--force') parsed.force = true
    else if (arg === '--force-evidence') parsed.forceEvidence = true
  }
  return parsed
}

function assertSafeForceOut (outPath) {
  const releaseRoot = resolve(root, '.pearcup-release')
  const tmpRoot = resolve(tmpdir())
  if (isInside(outPath, releaseRoot) || isInside(outPath, tmpRoot)) return
  throw new Error(`--force may only remove outputs inside ${releaseRoot} or ${tmpRoot}: ${outPath}`)
}

function assertNoProtectedEvidence (outPath) {
  if (args.forceEvidence) return
  const protectedFiles = [
    'pearcup-publish-result.json',
    'pearcup-friend-test-result.json'
  ].map(file => join(outPath, file))
  const found = protectedFiles.filter(file => existsSync(file))
  if (found.length === 0) return
  throw new Error(`--force refuses to remove publish/friend evidence (${found.join(', ')}); use --force-evidence only when intentionally replacing stale or incorrect evidence`)
}

function isInside (target, parent) {
  const normalizedTarget = resolve(target)
  const normalizedParent = resolve(parent)
  return normalizedTarget === normalizedParent || normalizedTarget.startsWith(normalizedParent + '/')
}
