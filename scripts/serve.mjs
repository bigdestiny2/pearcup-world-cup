import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const appRoot = resolve(here, '../app')
const port = readPort(process.argv, 4174)

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp']
])

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname
    const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1))
    const normalizedPath = normalize(relativePath).replace(/^(\.\.[/\\])+/, '')
    const filePath = resolve(join(appRoot, normalizedPath))

    if (!filePath.startsWith(appRoot)) {
      writeText(res, 403, 'Forbidden')
      return
    }

    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) {
      writeText(res, 404, 'Not found')
      return
    }

    res.writeHead(200, {
      'content-type': mimeTypes.get(extname(filePath)) || 'application/octet-stream',
      'cache-control': 'no-store'
    })
    createReadStream(filePath).pipe(res)
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      writeText(res, 404, 'Not found')
      return
    }
    writeText(res, 500, 'Internal server error')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`PearCup preview: http://127.0.0.1:${port}/`)
})

function readPort (argv, fallback) {
  const index = argv.indexOf('--port')
  const value = index >= 0 ? Number(argv[index + 1]) : fallback
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : fallback
}

function writeText (res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(body)
}
