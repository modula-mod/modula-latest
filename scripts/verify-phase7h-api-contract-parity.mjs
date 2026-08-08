#!/usr/bin/env node
import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {join, relative} from 'node:path'

const root = process.cwd()
const errors = []
const warnings = []

const apiSourceRoot = join(root, 'services/greenfield-api/src')
const frontendSourceRoot = join(root, 'src/data/repositories/api')

if (!existsSync(apiSourceRoot)) errors.push(`missing ${relative(root, apiSourceRoot)}`)
if (!existsSync(frontendSourceRoot)) errors.push(`missing ${relative(root, frontendSourceRoot)}`)

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

const missing = frontendCalls.filter(call => !apiRoutes.has(`${call.method} ${call.path}`))
for (const call of missing) {
  errors.push(`${call.location} missing Greenfield route: ${call.method} ${call.path}`)
}

if (!apiRoutes.has('GET /v1/stories/rail')) {
  errors.push('Greenfield route inventory missing GET /v1/stories/rail')
}
if (!frontendCalls.some(call => call.method === 'GET' && call.path === '/v1/stories/rail')) {
  errors.push('frontend route inventory missing GET /v1/stories/rail')
}

if (frontendCalls.length === 0) warnings.push('no frontend API calls found')
if (apiRoutes.size === 0) warnings.push('no Greenfield API routes found')

if (errors.length) {
  console.error('Phase 7H API contract parity failed:')
  for (const error of errors) console.error(`- ${error}`)
  if (warnings.length) {
    console.error('Warnings:')
    for (const warning of warnings) console.error(`- ${warning}`)
  }
  process.exit(1)
}

for (const warning of warnings) console.warn(`warning: ${warning}`)
console.log(`Phase 7H API contract parity passed: ${frontendCalls.length} frontend calls covered by ${apiRoutes.size} Greenfield routes.`)

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
