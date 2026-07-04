const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')

const entrySource = readFileSync(join(__dirname, 'index.cjs'), 'utf8')

function sliceFunctionBlock (startName, endName) {
  const start = entrySource.indexOf(`function ${startName}`)
  assert.notEqual(start, -1, `missing function ${startName}`)
  const end = entrySource.indexOf(`function ${endName}`, start + 1)
  assert.notEqual(end, -1, `missing function ${endName}`)
  return entrySource.slice(start, end)
}

function createBridgeHarness () {
  const context = {}
  vm.createContext(context)
  vm.runInContext([
    sliceFunctionBlock('normalizeRootRendererUrl', 'shouldServeRawClassicScript'),
    sliceFunctionBlock('shouldServeRawClassicScript', 'shouldServeBootProbe'),
    sliceFunctionBlock('shouldServeBootProbe', 'writeResponse'),
    'this.normalizeRootRendererUrl = normalizeRootRendererUrl',
    'this.shouldServeRawClassicScript = shouldServeRawClassicScript',
    'this.shouldServeBootProbe = shouldServeBootProbe'
  ].join('\n'), context, { filename: 'pearcup-entry-bridge-functions.js' })
  return context
}

test('Pear entry normalizes root renderer requests without dropping deep links', () => {
  const { normalizeRootRendererUrl } = createBridgeHarness()
  const cases = [
    ['', '/index.html'],
    ['/', '/index.html'],
    ['//', '/index.html'],
    ['?join=abc123', '/index.html?join=abc123'],
    ['/?join=abc123', '/index.html?join=abc123'],
    ['//?join=abc123', '/index.html?join=abc123'],
    ['#games', '/index.html#games'],
    ['/#games', '/index.html#games'],
    ['//#games', '/index.html#games'],
    ['/+esm-wrap', '/index.html+esm-wrap'],
    ['//+esm-wrap', '/index.html+esm-wrap'],
    ['/+esm-wrap?join=abc123', '/index.html+esm-wrap?join=abc123'],
    ['/app.js', '/app.js'],
    ['app.js', 'app.js'],
    ['/index.cjs+esm-wrap', '/index.cjs+esm-wrap']
  ]

  for (const [input, expected] of cases) {
    assert.equal(normalizeRootRendererUrl(input), expected, input)
  }
})

test('Pear entry forces packaged classic scripts through raw bridge lookup', () => {
  const { shouldServeRawClassicScript } = createBridgeHarness()

  assert.equal(shouldServeRawClassicScript('app', 'app', '/app.js'), true)
  assert.equal(shouldServeRawClassicScript('app', 'app', '/peer-net.js?cache=1'), true)
  assert.equal(shouldServeRawClassicScript('app', 'app', '/watch-sync.js#hash'), true)
  assert.equal(shouldServeRawClassicScript('app', 'app', '/pearcup-boot.js?bootfix=abc#hash'), true)

  assert.equal(shouldServeRawClassicScript('app', 'raw', '/app.js'), false)
  assert.equal(shouldServeRawClassicScript('asset', 'app', '/app.js'), false)
  assert.equal(shouldServeRawClassicScript('app', 'app', '/index.cjs'), false)
  assert.equal(shouldServeRawClassicScript('app', 'app', '/gen-assets.mjs'), false)
  assert.equal(shouldServeRawClassicScript('app', 'app', '/styles.css'), false)
})

test('Pear entry consumes bridge boot probes without renderer file lookups', () => {
  const { shouldServeBootProbe } = createBridgeHarness()

  assert.equal(shouldServeBootProbe('/boot-probe-hit.gif'), true)
  assert.equal(shouldServeBootProbe('/boot-probe-hit.gif?payload=%7B%7D'), true)
  assert.equal(shouldServeBootProbe('/index.html'), false)
})

test('Pear entry normalizes IPC root file lookups to index.html', () => {
  const IPC = Symbol('ipc')
  const calls = []
  const context = {
    Pear: {
      constructor: { IPC },
      [IPC]: {
        exists (opts, ...args) {
          calls.push({ method: 'exists', opts, args })
          return true
        },
        get (opts, ...args) {
          calls.push({ method: 'get', opts, args })
          return Buffer.from('ok')
        }
      }
    }
  }
  vm.createContext(context)
  vm.runInContext([
    sliceFunctionBlock('patchPearIpcRootFileLookups', 'normalizeRootRendererUrl'),
    'patchPearIpcRootFileLookups()'
  ].join('\n'), context, { filename: 'pearcup-entry-ipc-patch.js' })

  context.Pear[IPC].exists({ key: '/' }, 'a')
  context.Pear[IPC].get({ key: '/app.js' }, 'b')

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { method: 'exists', opts: { key: '/index.html' }, args: ['a'] },
    { method: 'get', opts: { key: '/app.js' }, args: ['b'] }
  ])
})

test('Pear entry installs bridge shims before the renderer runtime starts', () => {
  const rootRequestPatch = entrySource.indexOf('patchPearBridgeRootRequests()')
  const ipcPatch = entrySource.indexOf('patchPearIpcRootFileLookups()')
  const runtimeRequire = entrySource.indexOf("require('pear-electron')")
  const bridgeRequire = entrySource.indexOf("require('pear-bridge')")
  const bridgeLookupPatch = entrySource.indexOf('patchPearBridgeRootLookups(Bridge)')

  assert.ok(rootRequestPatch >= 0 && rootRequestPatch < runtimeRequire, 'root request patch must run before pear-electron loads')
  assert.ok(ipcPatch >= 0 && ipcPatch < runtimeRequire, 'IPC root lookup patch must run before pear-electron loads')
  assert.ok(bridgeRequire >= 0 && bridgeRequire < bridgeLookupPatch, 'bridge lookup patch must run after pear-bridge loads')
  assert.ok(bridgeLookupPatch < entrySource.indexOf('async function main'), 'bridge lookup patch must install before main starts')
})
