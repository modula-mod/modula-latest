#!/usr/bin/env node
import {existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

function isFile(filePath) {
  return existsSync(filePath) && statSync(filePath).isFile()
}

function isDirectory(filePath) {
  return existsSync(filePath) && statSync(filePath).isDirectory()
}

function containedIn(distDir, candidate) {
  const root = path.resolve(distDir)
  const resolved = path.resolve(candidate)
  return resolved === root || resolved.startsWith(`${root}${path.sep}`)
}

function isUnsafeSegment(segment) {
  return !segment || segment === '.' || segment === '..' || segment.includes('\0')
}

function stripHtmlExtension(name) {
  return name.endsWith('.html') ? name.slice(0, -5) : name
}

function isCatchAllName(name) {
  return name.startsWith('[...') && name.endsWith(']')
}

function isDynamicName(name) {
  return name.startsWith('[') && name.endsWith(']') && !name.startsWith('[...')
}

function listNames(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function matchExact(distDir, segments) {
  const clean = segments.join(path.sep)
  const candidates = [
    path.join(distDir, clean),
    path.join(distDir, `${clean}.html`),
    path.join(distDir, clean, 'index.html'),
  ]
  return candidates.find(candidate => isFile(candidate) && containedIn(distDir, candidate)) ?? null
}

function matchDynamic(dir, segments, distDir) {
  if (segments.length === 0) {
    const index = path.join(dir, 'index.html')
    return isFile(index) && containedIn(distDir, index) ? index : null
  }

  const [head, ...rest] = segments
  const names = listNames(dir)

  if (rest.length === 0) {
    const exactHtml = path.join(dir, `${head}.html`)
    if (isFile(exactHtml) && containedIn(distDir, exactHtml)) return exactHtml
    const exactIndex = path.join(dir, head, 'index.html')
    if (isFile(exactIndex) && containedIn(distDir, exactIndex)) return exactIndex
  }

  const exactDir = path.join(dir, head)
  if (isDirectory(exactDir)) {
    const nested = matchDynamic(exactDir, rest, distDir)
    if (nested) return nested
  }

  if (rest.length === 0) {
    const dynamicHtml = names.find(name => {
      const base = stripHtmlExtension(name)
      return name.endsWith('.html') && isDynamicName(base) && isFile(path.join(dir, name))
    })
    if (dynamicHtml) {
      const resolved = path.join(dir, dynamicHtml)
      if (containedIn(distDir, resolved)) return resolved
    }
  }

  const dynamicDirs = names.filter(name => isDynamicName(name) && isDirectory(path.join(dir, name)))
  for (const dynamicDir of dynamicDirs) {
    const nested = matchDynamic(path.join(dir, dynamicDir), rest, distDir)
    if (nested) return nested
  }

  const catchAllHtml = names.find(name => {
    const base = stripHtmlExtension(name)
    return name.endsWith('.html') && isCatchAllName(base) && isFile(path.join(dir, name))
  })
  if (catchAllHtml) {
    const resolved = path.join(dir, catchAllHtml)
    if (containedIn(distDir, resolved)) return resolved
  }

  const catchAllDirs = names.filter(name => isCatchAllName(name) && isDirectory(path.join(dir, name)))
  for (const catchAllDir of catchAllDirs) {
    const nested = matchDynamic(path.join(dir, catchAllDir), rest, distDir)
    if (nested) return nested
    const index = path.join(dir, catchAllDir, 'index.html')
    if (isFile(index) && containedIn(distDir, index)) return index
  }

  return null
}

export function resolveWebDistFile(distDir, requestUrl, origin = 'http://127.0.0.1') {
  const url = new URL(requestUrl, origin)
  const pathname = decodeURIComponent(url.pathname)
  const fallback = path.join(distDir, 'index.html')

  if (pathname === '/') {
    return isFile(fallback) ? fallback : null
  }

  const segments = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  if (segments.some(isUnsafeSegment)) {
    return isFile(fallback) ? fallback : null
  }

  const exact = matchExact(distDir, segments)
  if (exact) return exact

  const dynamic = matchDynamic(distDir, segments, distDir)
  if (dynamic) return dynamic

  return isFile(fallback) ? fallback : null
}

function walkFiles(dir) {
  const entries = []
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) entries.push(...walkFiles(absolute))
    else entries.push(absolute)
  }
  return entries
}

export function collectDynamicHtmlTemplates(distDir) {
  if (!existsSync(distDir)) return []
  return walkFiles(distDir)
    .filter(file => file.endsWith('.html') && path.basename(file).includes('['))
    .map(file => path.relative(distDir, file).split(path.sep).join('/'))
    .sort()
}

export function nginxRewriteForTemplate(relativeHtml) {
  const withoutExt = relativeHtml.replace(/\.html$/, '')
  const parts = withoutExt.split('/')
  const regexParts = parts.map(part => {
    if (isCatchAllName(part)) return '.+'
    if (isDynamicName(part)) return '[^/]+'
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  })
  return {
    regex: `^/${regexParts.join('/')}$`,
    target: `/${relativeHtml}`,
    specificity: parts.reduce((score, part) => {
      if (isCatchAllName(part)) return score + 1
      if (isDynamicName(part)) return score + 10
      return score + 100
    }, parts.length),
  }
}

export function renderNginxDynamicRewrites(distDir) {
  const rewrites = collectDynamicHtmlTemplates(distDir)
    .map(nginxRewriteForTemplate)
    .sort((left, right) => right.specificity - left.specificity || right.regex.length - left.regex.length)

  const lines = [
    '# Generated Expo Router dynamic HTML fallbacks.',
    '# Used only after exact $uri / $uri.html / $uri/index.html misses.',
    'location @expo_dynamic {',
  ]
  for (const rewrite of rewrites) {
    lines.push(`    rewrite "${rewrite.regex}" "${rewrite.target}" last;`)
  }
  lines.push('    rewrite ^ /index.html last;')
  lines.push('}')
  lines.push('')
  return lines.join('\n')
}

function fail(message) {
  console.error(`resolve_web_dist_file_failed ${message}`)
  process.exit(1)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label}: expected ${expected}, got ${actual}`)
}

export function selfTestResolveWebDistFile() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'modula-web-dist-'))
  try {
    const files = [
      'index.html',
      'profile/index.html',
      'profile/edit.html',
      'profile/[handle].html',
      'profile/[handle]/followers.html',
      'module/[moduleId].html',
      'module/[moduleId]/[...path].html',
      'product/gaia.html',
      'product/[slug].html',
    ]
    for (const file of files) {
      const absolute = path.join(root, file)
      mkdirSync(path.dirname(absolute), {recursive: true})
      writeFileSync(absolute, file)
    }

    const resolved = requestUrl => path.relative(root, resolveWebDistFile(root, requestUrl)).split(path.sep).join('/')
    assertEqual(resolved('/'), 'index.html', 'root')
    assertEqual(resolved('/profile'), 'profile/index.html', 'profile index')
    assertEqual(resolved('/profile/edit'), 'profile/edit.html', 'static profile sibling')
    assertEqual(resolved('/profile/alice'), 'profile/[handle].html', 'public profile')
    assertEqual(resolved('/profile/alice/followers'), 'profile/[handle]/followers.html', 'nested dynamic')
    assertEqual(
      resolved('/module/digital.modula.vault-notes'),
      'module/[moduleId].html',
      'module id',
    )
    assertEqual(
      resolved('/module/digital.modula.vault-notes/notes/1'),
      'module/[moduleId]/[...path].html',
      'module catch-all',
    )
    assertEqual(resolved('/product/gaia'), 'product/gaia.html', 'static product wins')
    assertEqual(resolved('/product/unknown-slug'), 'product/[slug].html', 'dynamic product slug')
    assertEqual(resolved('/missing-route'), 'index.html', 'unknown fallback')
    assertEqual(resolved('/profile/../index.html'), 'index.html', 'path traversal rejected')
  } finally {
    rmSync(root, {recursive: true, force: true})
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  selfTestResolveWebDistFile()
  console.log('resolve_web_dist_file_ok')
}
