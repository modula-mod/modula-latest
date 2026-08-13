#!/usr/bin/env node
import {createServer} from 'node:http'
import {existsSync, statSync, createReadStream} from 'node:fs'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const distDir = path.join(root, 'dist')
const port = Number(process.env.PORT ?? process.env.MODULA_WEB_PORT ?? 4174)
const host = process.env.HOST ?? '127.0.0.1'

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.ttf', 'font/ttf'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

function safeJoin(filePath) {
  const normalised = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '')
  const resolved = path.join(distDir, normalised)
  return resolved.startsWith(distDir) ? resolved : path.join(distDir, 'index.html')
}

function resolveFile(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${port}`)
  const pathname = decodeURIComponent(url.pathname)
  const candidates = []

  if (pathname === '/') {
    candidates.push('index.html')
  } else {
    const clean = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
    candidates.push(clean)
    candidates.push(`${clean}.html`)
    candidates.push(path.join(clean, 'index.html'))
  }

  for (const candidate of candidates) {
    const absolute = safeJoin(candidate)
    if (existsSync(absolute) && statSync(absolute).isFile()) return absolute
  }

  return safeJoin('index.html')
}

const server = createServer((request, response) => {
  if (!request.url) {
    response.writeHead(400)
    response.end('Bad Request')
    return
  }

  const file = resolveFile(request.url)
  const extension = path.extname(file)
  const cacheControl = file.includes(`${path.sep}_expo${path.sep}`)
    ? 'public, max-age=31536000, immutable'
    : 'no-store'

  response.writeHead(200, {
    'Cache-Control': cacheControl,
    'Content-Type': contentTypes.get(extension) ?? 'application/octet-stream',
  })
  createReadStream(file).pipe(response)
})

server.listen(port, host, () => {
  console.log(`serving ${distDir} at http://${host}:${port}`)
})
