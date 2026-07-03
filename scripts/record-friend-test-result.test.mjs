import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(new URL('..', import.meta.url).pathname)
const script = join(root, 'scripts', 'record-friend-test-result.mjs')
const driveKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const bundleSha256 = '184244c9078de2892f9413fc33c1abd92ebd0edcb909cac3161c09ed0e4ddc1e'

test('records a passed remote friend test only with exact SHA and observed notes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-pass-'))
  const publishResult = writePublishResult(dir)
  const out = join(dir, 'friend-result.json')

  const result = run([
    '--publish-result', publishResult,
    '--out', out,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'friend opened final PearBrowser link and joined room wdk8yv'
  ])

  assert.equal(result.status, 0, result.stderr || result.stdout)
  const receipt = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(receipt.status, 'remote-friend-verified')
  assert.equal(receipt.friend, 'tariq')
  assert.equal(receipt.evidence.expectedBundleSha256, bundleSha256)
  assert.equal(receipt.evidence.observedRoomCode, 'wdk8yv')
  assert.equal(receipt.evidence.hostAndFriendCompletedLiveP2PJoin, true)
})

test('refuses a passed friend test when the operator omits the exact bundle SHA', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-no-sha-'))
  const publishResult = writePublishResult(dir)

  const result = run([
    '--publish-result', publishResult,
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'joined'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /requires --sha/)
})

test('refuses a passed friend test when the operator omits the observed room code', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-no-room-'))
  const publishResult = writePublishResult(dir)

  const result = run([
    '--publish-result', publishResult,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'friend opened final PearBrowser link and joined a room'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /requires --room-code/)
})

test('refuses malformed observed room codes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-bad-room-'))
  const publishResult = writePublishResult(dir)

  const result = run([
    '--publish-result', publishResult,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--room-code', '../wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'friend opened final PearBrowser link and joined a room'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /--room-code must be/)
})

test('refuses a passed friend test when the SHA does not match the publish result', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-wrong-sha-'))
  const publishResult = writePublishResult(dir)

  const result = run([
    '--publish-result', publishResult,
    '--sha', 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'joined'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /does not match publish result bundleSha256/)
})

test('refuses publish-result receipts whose driveKey does not match the hyper URL', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-wrong-drive-'))
  const publishResult = writePublishResult(dir, {
    driveKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  })

  const result = run([
    '--publish-result', publishResult,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'joined'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /driveKey must match/)
})

test('refuses publish-result receipts without the local published-link proof command', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-no-link-proof-'))
  const publishResult = writePublishResult(dir, {
    localPublishedLinkProofCommand: ''
  })

  const result = run([
    '--publish-result', publishResult,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'joined'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /local published-link proof command/)
})

test('refuses publish-result receipts without source release binding', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-no-source-binding-'))
  const publishResult = writePublishResult(dir, {
    receipt: '',
    sourceGitHead: '',
    sourceDirty: undefined
  })

  const result = run([
    '--publish-result', publishResult,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'joined'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /source release receipt/)
  assert.match(result.stderr, /clean source release receipt/)
})

test('refuses publish-result receipts whose source release receipt is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-missing-release-receipt-'))
  const publishResult = writePublishResult(dir, {
    receipt: join(dir, 'missing-pearcup-release-receipt.json')
  }, {}, { skipReleaseReceipt: true })

  const result = run([
    '--publish-result', publishResult,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'joined'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /source release receipt does not exist/)
})

test('refuses publish-result receipts from a different source release commit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-release-source-mismatch-'))
  const publishResult = writePublishResult(dir, {}, {
    sourceGitHead: '0000000000000000000000000000000000000000'
  })

  const result = run([
    '--publish-result', publishResult,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'joined'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /does not match source release receipt sourceGitHead/)
})

test('refuses publish-result receipts for a different source bundle SHA', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-release-bundle-mismatch-'))
  const publishResult = writePublishResult(dir, {}, {
    bundleSha256: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  })

  const result = run([
    '--publish-result', publishResult,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'joined'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /does not match source release receipt bundleSha256/)
})

test('refuses publish-result receipts recorded from an unexpected result path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-release-path-mismatch-'))
  const publishResult = writePublishResult(dir, {}, {
    postPublishVerification: {
      resultPath: join(dir, 'other-publish-result.json')
    }
  })

  const result = run([
    '--publish-result', publishResult,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'joined'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /does not match source release receipt postPublishVerification\.resultPath/)
})

test('refuses publish-result receipts without exact-bundle Pear runtime proof', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-no-runtime-proof-'))
  const publishResult = writePublishResult(dir, {
    evidence: {
      exactBundlePublishedGatewayPreflight: true,
      postPublishSmokePassed: true
    }
  })

  const result = run([
    '--publish-result', publishResult,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'joined'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /exact bundle Pear runtime preflight/)
})

test('refuses deprecated local published browser proof receipts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-deprecated-browser-proof-'))
  const publishResult = writePublishResult(dir, {
    localPublishedLinkProofCommand: undefined,
    localPublishedBrowserCommand: 'npm run serve:pearbrowser-published -- --receipt old.json --port 4191'
  })

  const result = run([
    '--publish-result', publishResult,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'joined'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /deprecated localPublishedBrowserCommand/)
})

test('refuses publish-result receipts without the full remote friend checklist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-missing-checklist-'))
  const publishResult = writePublishResult(dir, {
    friendTest: {
      status: 'pending-remote-friend',
      requires: ['remote friend opens the final PearBrowser link']
    }
  })

  const result = run([
    '--publish-result', publishResult,
    '--sha', bundleSha256,
    '--friend', 'tariq',
    '--room-code', 'wdk8yv',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'joined'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /host and friend complete a live P2P invite join/)
})

test('failed friend-test records still require notes but do not require a SHA', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-friend-failed-'))
  const publishResult = writePublishResult(dir)
  const out = join(dir, 'friend-result.json')

  const result = run([
    '--publish-result', publishResult,
    '--out', out,
    '--failed',
    '--notes', 'friend saw boot error before Games'
  ])

  assert.equal(result.status, 0, result.stderr || result.stdout)
  const receipt = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(receipt.status, 'remote-friend-failed')
  assert.equal(receipt.evidence.expectedBundleSha256, '')
  assert.deepEqual(receipt.remaining, ['repeat remote friend PearBrowser test after fixing noted issue'])
})

function writePublishResult (dir, overrides = {}, releaseReceiptOverrides = {}, opts = {}) {
  const file = join(dir, 'publish-result.json')
  const receipt = {
    app: 'PearCup',
    status: 'published-and-smoked',
    receipt: join(dir, 'pearcup-release-receipt.json'),
    sourceGitHead: '2573450565f8bf61eb64d38159fe5c553cf21b65',
    sourceGitBranch: 'main',
    sourceDirty: false,
    sourceGitStatus: [],
    publishedUrl: `hyper://${driveKey}/`,
    driveKey,
    bundleSha256,
    localPublishedLinkProofCommand: 'npm run serve:pearbrowser-published -- --receipt release.json --port 4191',
    friendTest: {
      status: 'pending-remote-friend',
      requires: [
        'remote friend opens the final PearBrowser link',
        'remote friend reaches Games without fallback or boot error',
        'host and friend complete a live P2P invite join',
        'host and friend can start Penalty Clash from the joined room',
        'record the observed Penalty Clash room code'
      ]
    },
    evidence: {
      exactBundlePublishedGatewayPreflight: true,
      exactBundlePearRuntimePreflight: true,
      postPublishSmokePassed: true
    },
    ...overrides
  }
  writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n')
  if (receipt.receipt && !opts.skipReleaseReceipt) {
    writeFileSync(receipt.receipt, JSON.stringify({
      app: 'PearCup',
      sourceGitHead: receipt.sourceGitHead,
      sourceGitBranch: receipt.sourceGitBranch,
      sourceDirty: receipt.sourceDirty,
      sourceGitStatus: receipt.sourceGitStatus,
      bundleSha256: receipt.bundleSha256,
      postPublishVerification: {
        resultPath: file
      },
      ...releaseReceiptOverrides
    }, null, 2) + '\n')
  }
  return file
}

function run (args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8'
  })
}
