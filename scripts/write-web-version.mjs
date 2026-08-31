import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const distDir = path.join(repoRoot, 'dist')
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))

function git(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? ''
const apiOrigin = apiUrl ? new URL(apiUrl).origin : null
const version = {
  app: 'modula',
  version: packageJson.version,
  phase: 'phase7e-block14',
  commit: git(['rev-parse', 'HEAD']),
  branch: git(['branch', '--show-current']),
  builtAt: new Date().toISOString(),
  environment: process.env.EXPO_PUBLIC_APP_ENV ?? null,
  dataSource: process.env.EXPO_PUBLIC_DATA_SOURCE ?? null,
  apiOrigin,
}

mkdirSync(distDir, {recursive: true})
writeFileSync(path.join(distDir, 'version.json'), `${JSON.stringify(version, null, 2)}\n`)
writeFileSync(path.join(distDir, 'release.json'), `${JSON.stringify(version, null, 2)}\n`)

function walk(dir) {
  const entries = []
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) entries.push(...walk(absolute))
    else entries.push(absolute)
  }
  return entries
}

const precacheUrls = [
  '/',
  ...walk(distDir)
    .map(file => path.relative(distDir, file).split(path.sep).join('/'))
    .filter(file =>
      file.startsWith('_expo/static/') ||
      file.startsWith('pwa/') ||
      file === 'favicon.ico' ||
      file === 'manifest.webmanifest',
    )
    .sort()
    .map(file => `/${file}`),
]

const serviceWorker = `/* Modula shell service worker. Generated from ${version.commit}. */
const RELEASE_SHA = ${JSON.stringify(version.commit)}
const CACHE_PREFIX = 'modula-shell-'
const RELEASE_CACHE = CACHE_PREFIX + RELEASE_SHA
const PRECACHE_URLS = ${JSON.stringify(precacheUrls)}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(RELEASE_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== RELEASE_CACHE)
          .map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/pwa/')) {
    event.respondWith(cacheFirstImmutable(request))
  }
})

async function networkFirstNavigation(request) {
  const cache = await caches.open(RELEASE_CACHE)
  try {
    const response = await fetch(new Request(request, {cache: 'reload'}))
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    return (await cache.match(request)) || (await cache.match('/')) || Response.error()
  }
}

async function cacheFirstImmutable(request) {
  const cache = await caches.open(RELEASE_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}
`

writeFileSync(path.join(distDir, 'service-worker.js'), serviceWorker)

const checksumLines = walk(distDir)
  .filter(file => path.basename(file) !== 'checksums.sha256')
  .sort()
  .map(file => {
    const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
    return `${hash}  ./${path.relative(distDir, file)}`
  })

writeFileSync(path.join(distDir, 'checksums.sha256'), `${checksumLines.join('\n')}\n`)

console.log(`web_version_marker_ok ${version.commit} files=${checksumLines.length}`)
