#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
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

if (existsSync(bundle)) throw new Error(`bundle output already exists: ${bundle}`)
mkdirSync(out, { recursive: true })

runNode('scripts/check-kawaii-runtime.mjs')
runNpm('test:kawaii-peer')
runNpm('smoke:kawaii-p2p-preview')
runNpm('smoke:kawaii-pear-run')
runNpm('smoke:pearbrowser-serve')
runNpm('smoke:pearbrowser-published-local')
runNode('scripts/build-pearbrowser-hyper.mjs', ['--out', bundle])
runNode('scripts/smoke-pearbrowser-hyper.mjs', ['--bundle', bundle])
runNode('scripts/smoke-pearbrowser-published-local.mjs', ['--bundle', bundle])

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
const approvedPublishWrapper = join(root, 'scripts', 'publish-approved-pearcup.mjs')
const receipt = {
  app: 'PearCup',
  generatedAt: new Date().toISOString(),
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
      'npm run smoke:kawaii-p2p-preview',
      'npm run smoke:kawaii-pear-run',
      'npm run smoke:pearbrowser-serve',
      'npm run smoke:pearbrowser-published-local'
    ],
    bundleChecks: [
      `node scripts/build-pearbrowser-hyper.mjs --out ${bundle}`,
      `node scripts/smoke-pearbrowser-hyper.mjs --bundle ${bundle}`,
      `node scripts/smoke-pearbrowser-published-local.mjs --bundle ${bundle}`
    ],
    requiredCoverage: [
      'design/kawaii-app/app-deeplink.test.js',
      'design/kawaii-app/peer-match.test.js',
      'design/kawaii-app/peer-net.test.js',
      'design/kawaii-app/peer-preview-smoke.test.js'
    ],
    bootProbeContract: {
      command: 'npm run smoke:kawaii-pear-run',
      requires: [
        'bootReady=p2p',
        'p2pModules=ready',
        'appBooted=true',
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
        'runtimeSelfTest.activeNav includes Games',
        'runtimeSelfTest.hasLobbyMascot=true',
        'runtimeSelfTest.generatedAvatarImages include avatars/',
        'runtimeSelfTest.inviteModalOpen=true',
        'runtimeSelfTest.inviteLink includes ?join=',
        'runtimeSelfTest.peerMatch.active=true',
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
        'published-style smoke verifies app/boot/P2P/assets contract before publish'
      ]
    },
    localPublishedBrowserContract: {
      command: 'npm run serve:pearbrowser-published -- --receipt <receipt>',
      exactReceiptCommand: `npm run serve:pearbrowser-published -- --receipt ${receiptPath}`,
      requires: [
        'exact receipt bundle boots at /app/<64-hex-drive>/',
        'browser reports bootReady=p2p',
        'browser reports p2pModules=ready',
        'Games route activates from published-style URL',
        'generated avatar images render in Games',
        'Invite a friend opens a valid room code',
        'published-style invite link is hyper://<drive>/?join=<code>',
        'published-style invite link does not leak localhost',
        '?join=<code> deep link opens Games join flow',
        'browser console has no renderer errors or warnings'
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
    if (arg === '--out') parsed.out = argv[++i]
    else if (arg.startsWith('--out=')) parsed.out = arg.slice('--out='.length)
  }
  return parsed
}
