import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(new URL('..', import.meta.url).pathname)
const script = resolve(root, 'scripts', 'smoke-published-pearbrowser.mjs')
const drive = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

test('published smoke rejects fallback text without the boot-error banner contract', async () => {
  const server = await startFixtureServer({
    indexHtml: `<!doctype html>
      <title>PearCup Prototype</title>
      <script src="./pearcup-boot.js"></script>
      <script src="./peer-net.js"></script>
      <script src="./peer-match.js"></script>
      <script src="./peer-lobby.js"></script>
      <script src="./watch-sync.js"></script>
      <script src="./app.js"></script>
      <script>
        // Old loose check could pass on this text alone:
        'PearCup fallback loaded the visual shell, but the app did not finish booting.'
        function p2pModulesReady () { return window.pearcupP2pModules === 'ready' }
        var pearcupPeerNetModule = true
        var pearcupPeerMatchModule = true
        var pearcupPeerLobbyModule = true
        var pearcupWatchSyncModule = true
      </script>`
  })

  try {
    const result = await runSmoke(server.gateway)

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /fallback does not define the visible boot failure notice renderer/)
    assert.match(result.stderr, /fallback does not render fallback\/boot errors into #bootErrorBar/)
  } finally {
    await server.close()
  }
})

test('published smoke rejects localhost proxy invite links', async () => {
  const server = await startFixtureServer({
    peerMatchJs: [
      'pearcupPeerMatchModule',
      'pearcupPeerMatchState',
      'pearcupPeerMatchStarted',
      'hyperLaunchBase',
      'hyper://',
      'const invite = location.origin + location.pathname'
    ].join('\n')
  })

  try {
    const result = await runSmoke(server.gateway)

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /published peer-match\.js still shares localhost proxy invite links/)
  } finally {
    await server.close()
  }
})

test('published smoke rejects watch sync without same-room challenges', async () => {
  const server = await startFixtureServer({
    watchSyncJs: [
      'PearCupPeerNet',
      'pearcupWatchSyncModule'
    ].join('\n')
  })

  try {
    const result = await runSmoke(server.gateway)

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /published watch-sync\.js does not expose same-room watcher challenges/)
    assert.match(result.stderr, /published watch-sync\.js does not host Penalty Clash from Watch challenges/)
  } finally {
    await server.close()
  }
})

function runSmoke (gateway) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--drive', drive, '--gateway', gateway], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('exit', (status, signal) => {
      resolve({
        status: status == null && signal ? 1 : status,
        stdout,
        stderr
      })
    })
  })
}

function startFixtureServer ({ indexHtml = validIndexHtml(), peerMatchJs = validPeerMatchJs(), watchSyncJs = validWatchSyncJs() }) {
  const files = new Map([
    ['index.html', text(indexHtml, 'text/html; charset=utf-8')],
    ['manifest.json', text(JSON.stringify({
      name: 'PearCup',
      entry: '/index.html',
      permissions: ['swarm.v1']
    }), 'application/json')],
    ['pearcup-boot.js', text([
      './settlement-receipts.js',
      './worker-sim.js',
      './storage-sim.js',
      './transport-sim.js',
      './worker-runtime.js',
      './settlement-service.js',
      './worker-client.js',
      './peer-net.js',
      './peer-match.js',
      './peer-lobby.js',
      './watch-sync.js',
      './app.js',
      'PearCupWorkerClient',
      'PearCupSettlementService',
      'PearCupWorkerSim',
      'PearCupStorageSim',
      'PearCupTransportSim',
      'pearcup:runtime-self-test',
      'runBootRuntimeSelfTest',
      'runRuntimePeerHandshakeSelfTest',
      'pearcupRuntimeSelfTestGuest'
    ].join('\n'), 'text/javascript; charset=utf-8')],
    ['styles.css', text([
      ".stadium{background:url('assets/stadium-bg.png')}",
      ".ball{background:url('assets/ball.png')}",
      ".confetti{background:url('assets/confetti.png')}"
    ].join('\n'), 'text/css; charset=utf-8')],
    ['app.js', text([
      '// p2pBackendBadge assertP2PModulesReady pearcupP2pModules syncRuntimeScreenDiagnostics',
      '// pearcupActiveScreen pearcupAppBooted bootRuntimeDiagnostics profileChipReady',
      "// emitBootReadyMarker URLSearchParams(location.search) get('join') tryJoinFriendInvite",
      '// pearcupPendingJoin completeProfileOnboarding peerMatch.join(code) Round of 32 AVATAR_PORTRAITS',
      '// avatars/p-aria.png avatars/p-tariq.png assets/mascot.png runBootRuntimeSelfTest',
      '// runtimeBracketEvidence Bracket board rendered Bracket route did not render generated avatar images',
      '// watchChallengePanel Watch route did not render the challenge panel',
      '// runRuntimeHashRouteSelfTest Same-document hash route changes did not activate Bracket, Games, and Watch',
      '// runRuntimePeerHandshakeSelfTest pearcupRuntimeSelfTestGuest pearcup:runtime-self-test',
      '// PearCupPeerMatch.host()'
    ].join('\n'), 'text/javascript; charset=utf-8')],
    ['peer-net.js', text([
      'pear.swarm.v1',
      'pearcup.peer-net.v1',
      'broadcast-channel',
      'pearcupPeerNetModule'
    ].join('\n'), 'text/javascript; charset=utf-8')],
    ['peer-match.js', text(peerMatchJs, 'text/javascript; charset=utf-8')],
    ['peer-lobby.js', text([
      'PearCupPeerNet',
      'PearCupPeerMatch',
      'pearcupPeerLobbyModule'
    ].join('\n'), 'text/javascript; charset=utf-8')],
    ['watch-sync.js', text(watchSyncJs, 'text/javascript; charset=utf-8')]
  ])

  for (const asset of [
    'assets/stadium-bg.png',
    'assets/ball.png',
    'assets/confetti.png',
    'assets/mascot.png',
    'avatars/captain-br.png',
    'avatars/p-aria.png',
    'avatars/p-tariq.png',
    'crests/wm26.png'
  ]) {
    files.set(asset, binary(12_000, 'image/png'))
  }

  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1')
    const match = requestUrl.pathname.match(/^\/app\/[0-9a-f]{64}\/?(.*)$/i)
    const key = match && match[1] ? match[1] : 'index.html'
    const file = files.get(key || 'index.html')
    if (!match || !file) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('not found')
      return
    }
    res.writeHead(200, {
      'content-type': file.type,
      'content-length': file.body.length,
      'cache-control': 'no-store'
    })
    res.end(file.body)
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({
        gateway: `http://127.0.0.1:${address.port}/`,
        close: () => new Promise(resolveClose => server.close(resolveClose))
      })
    })
  })
}

function validIndexHtml () {
  return `<!doctype html>
    <title>PearCup Prototype</title>
    <script src="./pearcup-boot.js"></script>
    <script src="./peer-net.js"></script>
    <script src="./peer-match.js"></script>
    <script src="./peer-lobby.js"></script>
    <script src="./watch-sync.js"></script>
    <script src="./app.js"></script>
    <script>
      function notice (title, detail) {
        const bar = document.createElement('div')
        bar.id = 'bootErrorBar'
        bar.textContent = title + (detail ? '\\n' + detail : '')
        sendBootProbe({ event: 'pearcup:fallback-notice', title, detail })
      }
      function clearNotice () {
        const bar = document.getElementById('bootErrorBar')
        if (bar) bar.remove()
      }
      function sendBootProbe () {}
      function p2pModulesReady () { return window.pearcupP2pModules === 'ready' }
      var pearcupPeerNetModule = true
      var pearcupPeerMatchModule = true
      var pearcupPeerLobbyModule = true
      var pearcupWatchSyncModule = true
      const root = document.documentElement
      root.addEventListener('pearcup:booted', clearNotice)
      root.addEventListener('error', function () {})
      root.addEventListener('unhandledrejection', function () {})
      notice('PearCup fallback loaded the visual shell, but the app did not finish booting.', 'waiting')
      notice('PearCup app script loaded, but boot did not complete.', 'waiting')
      notice('PearCup fallback failed.', 'script')
    </script>`
}

function validPeerMatchJs () {
  return [
    'pearcupPeerMatchModule',
    'pearcupPeerMatchState',
    'pearcupPeerMatchStarted',
    'hyperLaunchBase',
    'hyper://'
  ].join('\n')
}

function validWatchSyncJs () {
  return [
    'PearCupPeerNet',
    'pearcupWatchSyncModule',
    'function challenge (peerId) {}',
    'function acceptChallenge () {}',
    'function declineChallenge () {}',
    'function renderChallengeList () {}',
    'watch-peer-challenge',
    'watch-peer-accept',
    'watch-peer-decline',
    'challenge-accept',
    'challenge-decline',
    'root.PearCupPeerMatch.host',
    'root.PearCupPeerMatch.join'
  ].join('\n')
}

function text (value, type) {
  return { body: Buffer.from(value), type }
}

function binary (size, type) {
  return { body: Buffer.alloc(size, 1), type }
}
