import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const root = resolve(new URL('..', import.meta.url).pathname)
const script = join(root, 'scripts', 'record-latest-friend-test-result.mjs')
const sha = '63209b225cc27814520b07a686cb5d7f08176ad4b43cbd2891752757b4de1fd5'
const drive = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

test('latest friend-test recorder binds publish result and SHA from the release receipt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-latest-friend-'))
  const receipt = writeFixture(dir)

  const result = run([
    '--receipt', receipt,
    '--friend', 'sam',
    '--room-code', 'pzw7kb',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'remote friend opened latest link, joined, and started Penalty Clash'
  ])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /remote-friend-verified/)
  const recorded = JSON.parse(readFileSync(join(dir, 'pearcup-friend-test-result.json'), 'utf8'))
  assert.equal(recorded.publishResult, join(dir, 'pearcup-publish-result.json'))
  assert.equal(recorded.bundleSha256, sha)
  assert.equal(recorded.evidence.expectedBundleSha256, sha)
  assert.equal(recorded.evidence.observedRoomCode, 'pzw7kb')
  assert.equal(recorded.evidence.hostAndFriendStartedPenaltyClash, true)
})

test('latest friend-test recorder refuses manual SHA overrides', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-latest-friend-sha-'))
  const receipt = writeFixture(dir)

  const result = run([
    '--receipt', receipt,
    '--sha', sha,
    '--friend', 'sam',
    '--room-code', 'pzw7kb',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'should be refused before recording'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /supplies --sha from the release receipt/)
})

test('latest friend-test recorder refuses stale source receipts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-latest-friend-stale-'))
  const receipt = writeFixture(dir, {
    sourceGitHead: '0000000000000000000000000000000000000000'
  })

  const result = run([
    '--receipt', receipt,
    '--friend', 'sam',
    '--room-code', 'pzw7kb',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'should be refused before recording'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /does not match current HEAD/)
})

test('latest friend-test recorder refuses dirty source receipts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-latest-friend-dirty-'))
  const receipt = writeFixture(dir, {
    sourceDirty: true,
    sourceGitStatus: ['M design/kawaii-app/app.js']
  })

  const result = run([
    '--receipt', receipt,
    '--friend', 'sam',
    '--room-code', 'pzw7kb',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'should be refused before recording'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /generated from a dirty worktree/)
})

test('latest friend-test recorder refuses publish results from another source commit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-latest-friend-publish-stale-'))
  const receipt = writeFixture(dir, {}, {
    sourceGitHead: '0000000000000000000000000000000000000000'
  })

  const result = run([
    '--receipt', receipt,
    '--friend', 'sam',
    '--room-code', 'pzw7kb',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'should be refused before recording'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /publish result sourceGitHead/)
})

test('latest friend-test recorder refuses publish results for another receipt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-latest-friend-publish-receipt-'))
  const receipt = writeFixture(dir, {}, {
    receipt: join(dir, 'old-pearcup-release-receipt.json')
  })

  const result = run([
    '--receipt', receipt,
    '--friend', 'sam',
    '--room-code', 'pzw7kb',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'should be refused before recording'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /does not match latest release receipt/)
})

test('latest friend-test recorder refuses publish results with an approved command for another SHA', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-latest-friend-approved-command-sha-'))
  const receipt = writeFixture(dir, {}, {
    approvedPublishCommand: `node "/repo/scripts/publish-approved-pearcup.mjs" --receipt "${join(dir, 'pearcup-release-receipt.json')}" --sha ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff --publish`
  })

  const result = run([
    '--receipt', receipt,
    '--friend', 'sam',
    '--room-code', 'pzw7kb',
    '--friend-opened',
    '--reached-games',
    '--joined-p2p',
    '--started-penalty-clash',
    '--notes', 'should be refused before recording'
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /approvedPublishCommand must target the publish result bundle SHA/)
})

function writeFixture (dir, overrides = {}, publishResultOverrides = {}) {
  const receiptPath = join(dir, 'pearcup-release-receipt.json')
  const publishResult = {
    app: 'PearCup',
    status: 'published-and-smoked',
    receipt: receiptPath,
    sourceGitHead: currentGitHead(),
    sourceGitBranch: 'main',
    sourceDirty: false,
    sourceGitStatus: [],
    publishedUrl: `hyper://${drive}/`,
    driveKey: drive,
    bundleSha256: sha,
    approvedPublishCommand: `node "/repo/scripts/publish-approved-pearcup.mjs" --receipt "${receiptPath}" --sha ${sha} --publish`,
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
    ...publishResultOverrides
  }
  const publishResultPath = join(dir, 'pearcup-publish-result.json')
  writeFileSync(publishResultPath, JSON.stringify(publishResult, null, 2) + '\n')

  writeFileSync(receiptPath, JSON.stringify({
    app: 'PearCup',
    sourceGitHead: currentGitHead(),
    sourceGitBranch: 'main',
    sourceDirty: false,
    sourceGitStatus: [],
    bundleSha256: sha,
    postPublishVerification: {
      resultPath: publishResultPath
    },
    ...overrides
  }, null, 2) + '\n')
  return receiptPath
}

function run (args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8'
  })
}

function currentGitHead () {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
