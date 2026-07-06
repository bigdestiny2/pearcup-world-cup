'use strict'

const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const { generateLobbyServers, OUTPUT_NAME } = require('../scripts/generate-lobby-servers')
const { createLobbyAppServer, listen } = require('../scripts/serve-lobby-app')

const rootDir = path.resolve(__dirname, '..')

test('lobby server generator creates a server list for every sport', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultimate-lobby-'))
  const result = generateLobbyServers({ rootDir, outDir: tempDir })
  const saved = JSON.parse(fs.readFileSync(path.join(tempDir, OUTPUT_NAME), 'utf8'))

  assert.equal(saved.length, 12)
  assert.ok(saved.some(server => server.fitId === 'world-cup'))
  assert.ok(saved.some(server => server.fitId === 'mma-boxing-fight-card'))
  assert.ok(saved.some(server => server.isLive))
  assert.ok(saved.some(server => server.isFeatured))
  assert.equal(saved.find(server => server.fitId === 'world-cup').appUrl, '/shell/index.html?fit=world-cup')
  assert.equal(saved.find(server => server.fitId === 'mma-boxing-fight-card').appUrl, '/shell/index.html?fit=mma-boxing-fight-card')
  assert.equal(result.outFile, path.join(tempDir, OUTPUT_NAME))
})

test('lobby app server serves lobby, mma, and kawaii index pages', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultimate-lobby-serve-'))
  generateLobbyServers({ rootDir, outDir: path.join(tempDir, 'lobby-app', 'data') })
  const server = createLobbyAppServer({ rootDir })
  const address = await listen(server, 0)
  const baseUrl = `http://127.0.0.1:${address.port}`

  try {
    const lobby = await fetchText(`${baseUrl}/`)
    const mma = await fetchText(`${baseUrl}/mma/`)
    const shell = await fetchText(`${baseUrl}/shell/index.html?fit=world-cup`)
    const kawaii = await fetchText(`${baseUrl}/kawaii/`)
    const health = await fetchJson(`${baseUrl}/health`)

    assert.ok(lobby.includes('Ultimate Sports'))
    assert.ok(lobby.includes('Server browser'))
    assert.ok(lobby.includes('Wallet'))
    assert.ok(lobby.includes('Friends'))
    assert.ok(lobby.includes('Private rooms'))
    assert.ok(mma.includes('Fight Card'))
    assert.ok(shell.includes('PearCup'))
    assert.ok(kawaii.includes('PearCup'))
    assert.equal(health.ok, true)
  } finally {
    server.close()
  }
})

function fetchText (url) {
  return new Promise((resolve, reject) => {
    http.get(url, response => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { text += chunk })
      response.on('end', () => resolve(text))
      response.on('error', reject)
    }).on('error', reject)
  })
}

function fetchJson (url) {
  return fetchText(url).then(text => JSON.parse(text))
}
