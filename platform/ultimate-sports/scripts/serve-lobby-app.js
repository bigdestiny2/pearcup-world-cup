#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { generateLobbyServers } = require('./generate-lobby-servers')

const DEFAULT_PORT = 4198

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon'
}

function createLobbyAppServer (input = {}) {
  const rootDir = input.rootDir || path.resolve(__dirname, '..')
  const lobbyDir = path.join(rootDir, 'lobby-app')
  const mmaDir = path.join(rootDir, 'mma-app')
  const shellDir = path.join(rootDir, 'shell')
  const generatedDir = path.join(rootDir, 'generated-assets')
  const kawaiiDir = path.resolve(rootDir, '..', '..', 'design', 'kawaii-app')

  return http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`)
    const pathname = decodeURIComponent(url.pathname)

    if (pathname === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ ok: true, path: 'lobby-app' }))
      return
    }

    let filePath
    if (pathname.startsWith('/kawaii/')) {
      filePath = path.join(kawaiiDir, pathname.slice('/kawaii/'.length))
    } else if (pathname.startsWith('/shell/')) {
      filePath = path.join(shellDir, pathname.slice('/shell/'.length))
    } else if (pathname.startsWith('/mma/')) {
      filePath = path.join(mmaDir, pathname.slice('/mma/'.length))
    } else if (pathname.startsWith('/generated/')) {
      filePath = path.join(generatedDir, pathname.slice('/generated/'.length))
    } else {
      filePath = path.join(lobbyDir, pathname === '/' ? 'index.html' : pathname)
    }

    if (filePath.endsWith(path.sep) || fs.statSync(filePath, { throwIfNoEntry: false })?.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' })
        response.end(error.code === 'ENOENT' ? 'Not found' : error.message)
        return
      }
      const ext = path.extname(filePath).toLowerCase()
      response.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
      response.end(data)
    })
  })
}

function listen (server, port) {
  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      resolve(address)
    })
    server.once('error', reject)
  })
}

function parseArgs (argv = process.argv.slice(2)) {
  const parsed = {}
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--port') parsed.port = Number(argv[++index])
    else if (arg === '--root') parsed.rootDir = argv[++index]
  }
  return parsed
}

async function main () {
  const args = parseArgs()
  const rootDir = args.rootDir || path.resolve(__dirname, '..')
  generateLobbyServers({ rootDir })
  const server = createLobbyAppServer({ rootDir })
  const address = await listen(server, args.port || DEFAULT_PORT)
  console.log(`Ultimate Sports lobby app: http://127.0.0.1:${address.port}/`)
  console.log(`Kawaii app via proxy: http://127.0.0.1:${address.port}/kawaii/`)
  console.log(`MMA app via proxy: http://127.0.0.1:${address.port}/mma/`)
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}

module.exports = {
  createLobbyAppServer,
  listen
}
