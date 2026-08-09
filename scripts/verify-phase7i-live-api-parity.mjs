#!/usr/bin/env node
import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {join, relative} from 'node:path'

const root = process.cwd()
const errors = []
const warnings = []

const apiSourceRoot = join(root, 'services/greenfield-api/src')
const frontendSourceRoot = join(root, 'src/data/repositories/api')
const liveBaseUrl = (process.env.MODULA_LIVE_API_BASE_URL ?? 'https://api.modula.digital').replace(/\/+$/, '')
const timeoutMs = Number.parseInt(process.env.MODULA_LIVE_API_PARITY_TIMEOUT_MS ?? '5000', 10)

if (!existsSync(apiSourceRoot)) errors.push(`missing ${relative(root, apiSourceRoot)}`)
if (!existsSync(frontendSourceRoot)) errors.push(`missing ${relative(root, frontendSourceRoot)}`)
if (!/^https:\/\//.test(liveBaseUrl) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(liveBaseUrl)) {
  errors.push(`MODULA_LIVE_API_BASE_URL must be HTTPS or loopback HTTP, got ${liveBaseUrl}`)
}
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  errors.push(`MODULA_LIVE_API_PARITY_TIMEOUT_MS must be positive, got ${process.env.MODULA_LIVE_API_PARITY_TIMEOUT_MS}`)
}

const apiRoutes = new Set()
const frontendCalls = []

for (const file of listFiles(apiSourceRoot, file => file.endsWith('.ts'))) {
  const text = readFileSync(file, 'utf8')
  collectFastifyMethodRoutes(text, apiRoutes)
  collectFastifyRouteObjects(text, apiRoutes)
  collectTupleRouteDeclarations(text, apiRoutes)
}

for (const file of listFiles(frontendSourceRoot, file => file.endsWith('.ts') || file.endsWith('.tsx'))) {
  const text = readFileSync(file, 'utf8')
  collectClientCalls(text, file, frontendCalls)
}

const unsupportedVersions = frontendCalls.filter(call => /^\/v\d+\//.test(call.path) && !call.path.startsWith('/v1/'))
for (const call of unsupportedVersions) {
  errors.push(`${call.location} uses unsupported API version: ${call.method} ${call.path}`)
}

const sourceMissing = frontendCalls.filter(call => !apiRoutes.has(`${call.method} ${call.path}`))
for (const call of sourceMissing) {
  errors.push(`${call.location} missing Greenfield source route: ${call.method} ${call.path}`)
}

if (!apiRoutes.has('GET /v1/stories/rail')) {
  errors.push('Greenfield route inventory missing GET /v1/stories/rail')
}
if (!frontendCalls.some(call => call.method === 'GET' && call.path === '/v1/stories/rail')) {
  errors.push('frontend route inventory missing GET /v1/stories/rail')
}

if (frontendCalls.length === 0) warnings.push('no frontend API calls found')
if (apiRoutes.size === 0) warnings.push('no Greenfield API routes found')

if (!errors.length) {
  const liveProbeCalls = uniqueCalls(frontendCalls)
  for (const call of liveProbeCalls) {
    const result = await probeLiveRoute(call)
    if (!result.ok) errors.push(result.error)
  }

  if (!liveProbeCalls.some(call => call.method === 'GET' && call.path === '/v1/stories/rail')) {
    const result = await probeLiveRoute({method: 'GET', path: '/v1/stories/rail', location: 'required-stories-route'})
    if (!result.ok) errors.push(result.error)
  }
}

if (errors.length) {
  console.error('Phase 7I live API parity failed:')
  for (const error of errors) console.error(`- ${error}`)
  if (warnings.length) {
    console.error('Warnings:')
    for (const warning of warnings) console.error(`- ${warning}`)
  }
  process.exit(1)
}

for (const warning of warnings) console.warn(`warning: ${warning}`)
console.log(
  `Phase 7I live API parity passed: ${frontendCalls.length} frontend calls covered by ${apiRoutes.size} source routes and ${uniqueCalls(frontendCalls).length} live probes at ${liveBaseUrl}.`,
)

function listFiles(dir, predicate) {
  if (!existsSync(dir)) return []
  const files = []
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(abs, predicate))
    else if (entry.isFile() && predicate(abs)) files.push(abs)
  }
  return files
}

function collectFastifyMethodRoutes(text, out) {
  const regex = /\b(?:app|opts|routeConfig)\.(get|post|patch|put|delete)\(\s*(['"`])([^'"`]+)\2/g
  for (const match of text.matchAll(regex)) {
    const method = match[1].toUpperCase()
    const path = normalizeRoutePath(match[3])
    if (isProductPath(path)) out.add(`${method} ${path}`)
  }
}

function collectFastifyRouteObjects(text, out) {
  const regex = /app\.route\(\s*\{[\s\S]{0,300}?method:\s*(['"`])([A-Z]+)\1[\s\S]{0,300}?url:\s*(['"`])([^'"`]+)\3/g
  for (const match of text.matchAll(regex)) {
    const method = match[2].toUpperCase()
    const path = normalizeRoutePath(match[4])
    if (isProductPath(path)) out.add(`${method} ${path}`)
  }
}

function collectTupleRouteDeclarations(text, out) {
  const regex = /\[\s*(['"`])([A-Z]+)\1\s*,\s*(['"`])([^'"`]+)\3/g
  for (const match of text.matchAll(regex)) {
    const method = match[2].toUpperCase()
    const path = normalizeRoutePath(match[4])
    if (isProductPath(path)) out.add(`${method} ${path}`)
  }
}

function collectClientCalls(text, file, out) {
  const regex = /(?:this\.)?client\.(get|post|patch|put|delete)\(\s*\{[\s\S]{0,500}?path:\s*(['"`])([\s\S]*?)\2/g
  for (const match of text.matchAll(regex)) {
    const method = match[1].toUpperCase()
    const rawPath = match[3].replace(/\s+/g, '')
    if (!rawPath.startsWith('/')) continue
    const path = normalizeClientPath(rawPath)
    if (!isProductPath(path)) continue
    const location = `${relative(root, file)}:${lineForIndex(text, match.index ?? 0)}`
    out.push({method, path, location})
  }
}

function normalizeClientPath(path) {
  return normalizeRoutePath(
    path
      .replace(/\$\{[^}]+\}/g, ':param')
      .replace(/:param(?=\/|$)/g, ':param'),
  )
}

function normalizeRoutePath(path) {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/'
  return clean
    .split('/')
    .map(segment => {
      if (!segment) return segment
      if (segment.startsWith(':')) return ':param'
      return segment
    })
    .join('/')
}

function isProductPath(path) {
  return path.startsWith('/v1/') || path === '/v1' || path.startsWith('/api/modula/')
}

function lineForIndex(text, index) {
  return text.slice(0, index).split('\n').length
}

function uniqueCalls(calls) {
  const seen = new Set()
  const unique = []
  for (const call of calls) {
    const key = `${call.method} ${call.path}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(call)
  }
  return unique
}

async function probeLiveRoute(call) {
  const probePath = call.path.replace(/:param/g, 'phase7i-parity-probe')
  const url = `${liveBaseUrl}${probePath}`
  const init = {
    method: call.method,
    headers: {
      Accept: 'application/json',
      'X-Modula-Parity-Probe': 'phase7i',
    },
    signal: AbortSignal.timeout(timeoutMs),
  }
  if (!['GET', 'HEAD'].includes(call.method)) {
    init.headers['Content-Type'] = 'application/json'
    init.body = '{}'
  }

  let response
  let text = ''
  try {
    response = await fetch(url, init)
    text = await response.text()
  } catch (error) {
    return {ok: false, error: `${call.location} live probe failed: ${call.method} ${probePath} at ${liveBaseUrl}: ${error.message}`}
  }

  if (response.status === 503) {
    return {ok: false, error: `${call.location} live probe hit unavailable API: ${call.method} ${probePath} returned 503`}
  }
  if (response.status >= 500) {
    return {ok: false, error: `${call.location} live probe returned unexpected ${response.status}: ${call.method} ${probePath}`}
  }
  if (response.status === 404 && isRouteNotFoundBody(text, call.method, probePath)) {
    return {ok: false, error: `${call.location} live server missing route: ${call.method} ${probePath}`}
  }
  return {ok: true}
}

function isRouteNotFoundBody(text, method, path) {
  if (!text) return false
  if (text.includes(`Route ${method}:${path} not found`)) return true
  try {
    const parsed = JSON.parse(text)
    return parsed?.statusCode === 404 && parsed?.error === 'Not Found' && typeof parsed?.message === 'string' && parsed.message.startsWith('Route ')
  } catch {
    return false
  }
}
