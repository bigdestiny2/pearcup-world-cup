import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const root = resolve(new URL('..', import.meta.url).pathname)
const script = join(root, 'scripts', 'launch-status-latest.mjs')
const sha = '63209b225cc27814520b07a686cb5d7f08176ad4b43cbd2891752757b4de1fd5'
const drive = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

test('latest launch status reports release-ready but unpublished handoff', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-launch-status-unpublished-'))
  const receipt = writeReceipt(dir)

  const result = run(['--receipt', receipt, '--json'])
  assert.equal(result.status, 0, result.stderr)

  const status = JSON.parse(result.stdout)
  assert.equal(status.release.ready, true)
  assert.equal(status.publish.ready, false)
  assert.equal(status.friend.ready, false)
  assert.equal(status.complete, false)
  assert.match(status.next, /explicit approval/)
  assert.match(status.next, new RegExp(sha))
})

test('latest launch status require-published fails before publish result exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-launch-status-require-published-'))
  const receipt = writeReceipt(dir)

  const result = run(['--receipt', receipt, '--require-published'])
  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /publish - not published/)
})

test('latest launch status reports complete only after publish and remote friend evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-launch-status-complete-'))
  const receipt = writeReceipt(dir)
  const publishResult = writePublishResult(dir, receipt)
  writeFriendResult(dir, receipt, publishResult)

  const result = run(['--receipt', receipt, '--json', '--require-complete'])
  assert.equal(result.status, 0, result.stderr)

  const status = JSON.parse(result.stdout)
  assert.equal(status.release.ready, true)
  assert.equal(status.publish.ready, true)
  assert.equal(status.friend.ready, true)
  assert.equal(status.complete, true)
  assert.equal(status.publish.publishedUrl, `hyper://${drive}/`)
  assert.equal(status.friend.roomCode, 'pzw7kb')
  assert.match(status.next, /Launch complete/)
})

test('latest launch status refuses stale release receipts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-launch-status-stale-'))
  const receipt = writeReceipt(dir, {
    sourceGitHead: '0000000000000000000000000000000000000000'
  })

  const result = run(['--receipt', receipt])
  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /release - not ready/)
  assert.match(result.stdout, /does not match receipt/)
})

test('latest launch status rejects stale publish evidence for another bundle', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-launch-status-stale-publish-'))
  const receipt = writeReceipt(dir)
  writePublishResult(dir, receipt, {
    bundleSha256: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  })

  const result = run(['--receipt', receipt, '--json', '--require-published'])
  assert.notEqual(result.status, 0)

  const status = JSON.parse(result.stdout)
  assert.equal(status.release.ready, true)
  assert.equal(status.publish.ready, false)
  assert.match(status.publish.issue, /bundle SHA does not match/)
  assert.match(status.next, /explicit approval/)
})

test('latest launch status rejects incomplete remote friend evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pearcup-launch-status-incomplete-friend-'))
  const receipt = writeReceipt(dir)
  const publishResult = writePublishResult(dir, receipt)
  writeFriendResult(dir, receipt, publishResult, {
    evidence: {
      expectedBundleSha256: sha,
      friendOpenedFinalPearBrowserLink: true,
      friendReachedGamesWithoutFallbackOrBootError: true,
      hostAndFriendCompletedLiveP2PJoin: true,
      hostAndFriendStartedPenaltyClash: false,
      observedRoomCode: 'pzw7kb',
      notes: 'remote friend joined but did not start Penalty Clash'
    }
  })

  const result = run(['--receipt', receipt, '--json', '--require-complete'])
  assert.notEqual(result.status, 0)

  const status = JSON.parse(result.stdout)
  assert.equal(status.release.ready, true)
  assert.equal(status.publish.ready, true)
  assert.equal(status.friend.ready, false)
  assert.match(status.friend.issue, /starting Penalty Clash/)
  assert.match(status.next, /remote friend open/)
})

function writeReceipt (dir, overrides = {}) {
  const receiptPath = join(dir, 'pearcup-release-receipt.json')
  writeFileSync(receiptPath, JSON.stringify({
    app: 'PearCup',
    sourceGitHead: currentGitHead(),
    sourceGitBranch: 'main',
    sourceDirty: false,
    sourceGitStatus: [],
    bundleSha256: sha,
    postPublishVerification: {
      resultPath: join(dir, 'pearcup-publish-result.json')
    },
    ...overrides
  }, null, 2) + '\n')
  return receiptPath
}

function writePublishResult (dir, receipt, overrides = {}) {
  const publishResult = join(dir, 'pearcup-publish-result.json')
  writeFileSync(publishResult, JSON.stringify({
    app: 'PearCup',
    status: 'published-and-smoked',
    receipt,
    sourceGitHead: currentGitHead(),
    sourceGitBranch: 'main',
    sourceDirty: false,
    sourceGitStatus: [],
    publishedUrl: `hyper://${drive}/`,
    driveKey: drive,
    bundleSha256: sha,
    approvedPublishCommand: `node "/repo/scripts/publish-approved-pearcup.mjs" --receipt "${receipt}" --sha ${sha} --publish`,
    postPublishSmokeCommand: `npm run smoke:pearbrowser-published -- --url hyper://${drive}/`,
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
  }, null, 2) + '\n')
  return publishResult
}

function writeFriendResult (dir, receipt, publishResult, overrides = {}) {
  writeFileSync(join(dir, 'pearcup-friend-test-result.json'), JSON.stringify({
    app: 'PearCup',
    status: 'remote-friend-verified',
    publishResult,
    releaseReceipt: receipt,
    sourceGitHead: currentGitHead(),
    sourceGitBranch: 'main',
    sourceDirty: false,
    publishedUrl: `hyper://${drive}/`,
    driveKey: drive,
    bundleSha256: sha,
    approvedPublishCommand: `node "/repo/scripts/publish-approved-pearcup.mjs" --receipt "${receipt}" --sha ${sha} --publish`,
    friend: 'sam',
    evidence: {
      expectedBundleSha256: sha,
      friendOpenedFinalPearBrowserLink: true,
      friendReachedGamesWithoutFallbackOrBootError: true,
      hostAndFriendCompletedLiveP2PJoin: true,
      hostAndFriendStartedPenaltyClash: true,
      observedRoomCode: 'pzw7kb',
      notes: 'remote friend opened latest link, joined, and started Penalty Clash'
    },
    remaining: [],
    ...overrides
  }, null, 2) + '\n')
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
