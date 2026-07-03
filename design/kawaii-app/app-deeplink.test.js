const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')

const appSource = readFileSync(join(__dirname, 'app.js'), 'utf8')

function sliceFunctionBlock (startName, endName) {
  const start = appSource.indexOf(`function ${startName}`)
  assert.notEqual(start, -1, `missing function ${startName}`)
  const end = appSource.indexOf(`function ${endName}`, start + 1)
  assert.notEqual(end, -1, `missing function ${endName}`)
  return appSource.slice(start, end)
}

const deepLinkSource = [
  sliceFunctionBlock('pendingFriendJoinCode', 'tryJoinFriendInvite'),
  sliceFunctionBlock('tryJoinFriendInvite', 'completeProfileOnboarding'),
  sliceFunctionBlock('completeProfileOnboarding', 'renderGameLobby')
].join('\n')

const runtimeDiagnosticsSource = sliceFunctionBlock('syncRuntimeScreenDiagnostics', 'setView')
const p2pGuardSource = sliceFunctionBlock('assertP2PModulesReady', 'boot')

function bareControllerCallLines (source, globalName, methods) {
  const methodPattern = methods.map(method => method.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const callPattern = new RegExp(`(^|[^\\w.])${globalName}\\.(${methodPattern})\\s*\\(`)
  return source.split('\n').map((line, index) => {
    const withoutStrings = line
      .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')
      .replace(/\/\/.*$/, '')
    return { line: index + 1, source: line, withoutStrings }
  }).filter(entry => callPattern.test(entry.withoutStrings) && !entry.withoutStrings.includes(`window.${globalName}.`))
    .map(entry => `${entry.line}: ${entry.source.trim()}`)
}

function createHarness ({ search = '?join=Room-42!!', inputValue = 'guest_beta ', peerMatch } = {}) {
  const calls = {
    joins: [],
    persisted: 0,
    rendered: 0,
    timers: [],
    toasts: [],
    views: []
  }
  const context = {
    URLSearchParams,
    location: { search },
    document: { documentElement: { dataset: {} } },
    window: {},
    setTimeout: (fn, ms) => {
      calls.timers.push({ fn, ms })
      return calls.timers.length
    },
    state: { username: 'captain', team: 'br' },
    $: selector => {
      assert.equal(selector, '#usernameInput')
      return { value: inputValue }
    },
    persist: () => { calls.persisted += 1 },
    renderAll: () => { calls.rendered += 1 },
    setView: view => { calls.views.push(view) },
    showToast: message => { calls.toasts.push(message) },
    teamById: id => ({ id, name: id === 'br' ? 'Brazil' : id })
  }
  if (peerMatch !== undefined) context.window.PearCupPeerMatch = peerMatch
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(deepLinkSource, context, { filename: 'app-deeplink-functions.js' })
  return { calls, context }
}

function createP2PGuardHarness ({ globals = {}, dataset = {} } = {}) {
  const context = {
    document: { documentElement: { dataset: { ...dataset } } },
    window: { ...globals }
  }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(p2pGuardSource, context, { filename: 'app-p2p-guard-functions.js' })
  return context
}

test('tryJoinFriendInvite sanitizes ?join= and opens the peer match on Games', () => {
  let harness
  const peerMatch = {
    _state: { active: false },
    join: code => harness.calls.joins.push(code)
  }
  harness = createHarness({ peerMatch })

  assert.equal(harness.context.tryJoinFriendInvite(), true)
  assert.equal(harness.context.document.documentElement.dataset.pearcupPendingJoin, 'room-42')
  assert.equal(harness.context.document.documentElement.dataset.pearcupJoinState, 'joining')
  assert.deepEqual(harness.calls.views, ['games'])
  assert.deepEqual(harness.calls.joins, ['room-42'])
  assert.deepEqual(harness.calls.timers, [])
})

test('tryJoinFriendInvite preserves an already-started matching room', () => {
  const peerMatch = {
    _state: { active: true, code: 'abc123', started: true },
    join: () => { throw new Error('join should not be called for an active room') }
  }
  const harness = createHarness({ search: '?join=abc123', peerMatch })

  assert.equal(harness.context.tryJoinFriendInvite(), true)
  assert.equal(harness.context.document.documentElement.dataset.pearcupPendingJoin, 'abc123')
  assert.equal(harness.context.document.documentElement.dataset.pearcupJoinState, 'started')
  assert.deepEqual(harness.calls.views, ['games'])
})

test('tryJoinFriendInvite retries until the peer match controller is available', () => {
  const harness = createHarness({ search: '?join=late99' })

  assert.equal(harness.context.tryJoinFriendInvite(), false)
  assert.equal(harness.context.document.documentElement.dataset.pearcupPendingJoin, 'late99')
  assert.equal(harness.calls.timers.length, 1)
  assert.equal(harness.calls.timers[0].ms, 0)

  harness.context.window.PearCupPeerMatch = {
    _state: { active: false },
    join: code => harness.calls.joins.push(code)
  }
  harness.calls.timers[0].fn()

  assert.equal(harness.context.document.documentElement.dataset.pearcupJoinState, 'joining')
  assert.deepEqual(harness.calls.views, ['games'])
  assert.deepEqual(harness.calls.joins, ['late99'])
})

test('completeProfileOnboarding carries first-run users into pending friend invites', () => {
  let harness
  const peerMatch = {
    _state: { active: false },
    join: code => harness.calls.joins.push(code)
  }
  harness = createHarness({ search: '?join=fresh1', peerMatch })

  harness.context.completeProfileOnboarding()

  assert.equal(harness.context.state.username, 'guest_beta')
  assert.equal(harness.calls.persisted, 1)
  assert.equal(harness.calls.rendered, 1)
  assert.ok(!harness.calls.views.includes('home'))
  assert.deepEqual(harness.calls.views, ['games', 'games'])
  assert.deepEqual(harness.calls.joins, ['fresh1'])
  assert.deepEqual(harness.calls.toasts, ['guest_beta joined as Brazil'])
})

test('completeProfileOnboarding keeps the normal home flow without an invite', () => {
  const harness = createHarness({ search: '' })

  harness.context.completeProfileOnboarding()

  assert.equal(harness.context.state.username, 'guest_beta')
  assert.equal(harness.calls.persisted, 1)
  assert.equal(harness.calls.rendered, 1)
  assert.deepEqual(harness.calls.views, ['home'])
  assert.deepEqual(harness.calls.toasts, ['guest_beta joined as Brazil'])
  assert.equal(harness.context.document.documentElement.dataset.pearcupPendingJoin, undefined)
})

test('renderGameLobby friend buttons use the window-scoped peer controller', () => {
  assert.match(appSource, /window\.PearCupPeerMatch && window\.PearCupPeerMatch\.host\(\)/)
  assert.match(appSource, /window\.PearCupPeerMatch && window\.PearCupPeerMatch\.promptJoin\(\)/)
  assert.doesNotMatch(appSource, /window\.PearCupPeerMatch && PearCupPeerMatch\./)
  assert.doesNotMatch(appSource, /window\.PearCupPeerNet && PearCupPeerNet\./)
  assert.doesNotMatch(appSource, /window\.PearCupLobby\) \{ PearCupLobby\./)
  assert.doesNotMatch(appSource, /window\.PearCupWatchSync\) PearCupWatchSync\./)
  assert.doesNotMatch(appSource, /window\.PearCupWatchSync\) \{ PearCupWatchSync\./)
})

test('settlement receipt calls preserve demo mode through the worker bridge', () => {
  assert.match(appSource, /createAutoWorkerClient\([\s\S]*?preferLocal: !integrationRuntime\.canUseRealMoney[\s\S]*?createLocalWorkerClient/)
  assert.match(appSource, /settleBracketPoolWithReceipt\([\s\S]*?actorId: 'settlement-worker',\s*requireLive: integrationRuntime\.canUseRealMoney/)
  assert.match(appSource, /settleGameRoundWithReceipt\([\s\S]*?actorId: 'settlement-worker',\s*requireLive: integrationRuntime\.canUseRealMoney/)
})

test('runtime diagnostics mirror normal app boot and active screen', () => {
  const context = {
    document: {
      documentElement: { dataset: {} },
      querySelector: selector => selector === '.screen.is-active' ? { id: 'home' } : null
    },
    window: { __pearcupAppBooted: true }
  }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(runtimeDiagnosticsSource, context, { filename: 'app-runtime-diagnostics.js' })

  context.syncRuntimeScreenDiagnostics()
  assert.equal(context.document.documentElement.dataset.pearcupActiveScreen, 'home')
  assert.equal(context.document.documentElement.dataset.pearcupAppBooted, 'true')

  context.syncRuntimeScreenDiagnostics('games')
  assert.equal(context.document.documentElement.dataset.pearcupActiveScreen, 'games')
})

test('hydrated app does not make executable bare P2P controller calls', () => {
  const leaks = [
    ...bareControllerCallLines(appSource, 'PearCupPeerMatch', ['host', 'join', 'promptJoin', 'onZone', 'isActive', 'leave', 'render', 'reset']),
    ...bareControllerCallLines(appSource, 'PearCupPeerNet', ['digest', 'createChannel', 'newPeerId', 'topicFor']),
    ...bareControllerCallLines(appSource, 'PearCupLobby', ['join', 'renderList']),
    ...bareControllerCallLines(appSource, 'PearCupWatchSync', ['ensureRoom', 'bindReactionBar', 'updatePresence', 'broadcastChat'])
  ]
  assert.deepEqual(leaks, [])
})

test('assertP2PModulesReady marks the app ready only when every P2P module is attached', () => {
  const context = createP2PGuardHarness({
    globals: {
      PearCupPeerNet: {},
      PearCupPeerMatch: {},
      PearCupLobby: {},
      PearCupWatchSync: {}
    },
    dataset: {
      pearcupPeerNetModule: 'ready',
      pearcupPeerMatchModule: 'ready',
      pearcupPeerLobbyModule: 'ready',
      pearcupWatchSyncModule: 'ready'
    }
  })

  context.assertP2PModulesReady()

  assert.equal(context.document.documentElement.dataset.pearcupP2pModules, 'ready')
})

test('assertP2PModulesReady fails closed when a P2P module did not attach', () => {
  const context = createP2PGuardHarness({
    globals: {
      PearCupPeerNet: {},
      PearCupLobby: {},
      PearCupWatchSync: {}
    },
    dataset: {
      pearcupPeerNetModule: 'ready',
      pearcupPeerLobbyModule: 'ready',
      pearcupWatchSyncModule: 'ready'
    }
  })

  assert.throws(
    () => context.assertP2PModulesReady(),
    /PearCup P2P modules missing: PearCupPeerMatch/
  )
  assert.equal(context.document.documentElement.dataset.pearcupP2pModules, 'missing')
})
