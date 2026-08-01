#!/usr/bin/env node
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs'
import {join, relative} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const failures = []

function pass(message) {
  console.log(`PASS ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    shell: false,
    stdio: 'inherit',
  })
  if (result.status === 0) {
    pass(label)
    return
  }
  fail(`${label} exited ${result.status ?? 'without status'}`)
}

function sourceFiles(paths) {
  const output = []
  const ignoredSegments = new Set(['node_modules', 'dist', 'build', '.expo', 'coverage'])
  const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

  function walk(path) {
    if (!existsSync(path)) return
    const name = path.split('/').at(-1)
    if (name && ignoredSegments.has(name)) return
    const stats = statSync(path)
    if (stats.isDirectory()) {
      for (const entry of readdirSync(path)) walk(join(path, entry))
      return
    }
    if (!stats.isFile()) return
    if ([...allowedExtensions].some(extension => path.endsWith(extension))) output.push(path)
  }

  for (const path of paths) walk(join(root, path))
  return output
}

function scanFiles(paths, matcher, label) {
  let matches = 0
  for (const absolute of sourceFiles(paths)) {
    const path = relative(root, absolute)
    const text = readFileSync(absolute, 'utf8')
    const lines = text.split(/\r?\n/)
    for (const [index, line] of lines.entries()) {
      const reason = matcher({path, line, text, lineNumber: index + 1})
      if (!reason) continue
      matches += 1
      fail(`${label}: ${path}:${index + 1}: ${reason}`)
    }
  }
  if (matches === 0) pass(label)
}

run('pnpm', ['lint'], 'lint has zero warnings')
run('pnpm', ['typecheck'], 'typecheck passes')

scanFiles(
  ['src', 'services/greenfield-api/src', 'services/greenfield-worker/src', 'packages'],
  ({line}) => (/TODO[:\s-]*Phase\s*7E/i.test(line) || /Phase\s*7E[:\s-]*TODO/i.test(line)) && 'Phase 7E TODO marker remains',
  'no Phase 7E TODO markers in production code',
)

scanFiles(
  ['services/greenfield-api/src/app'],
  ({line}) => {
    if (!/\b(app\.(?:get|post|put|patch|delete)|route:|handler:)\b/.test(line)) return null
    if (!/\b(placeholder|stub|dummy|mock|coming soon|not implemented)\b/i.test(line)) return null
    return 'placeholder API route marker remains'
  },
  'no placeholder APIs are exposed from route handlers',
)

scanFiles(
  ['src', 'services/greenfield-api/src', 'services/greenfield-worker/src', 'packages'],
  ({line}) => {
    if (!/(?:console|logger|request\.log)\.(?:trace|debug|info|warn|error|fatal|log)\s*\(/.test(line)) return null
    if (!/\b(accessToken|refreshToken|clientSecret|pkceVerifier|privateKey|secret|password|credentials)\b/i.test(line)) return null
    return 'direct secret-bearing log call remains'
  },
  'no direct secret logging',
)

const arbitraryExecutionAllowed = new Set([
  'services/greenfield-api/src/extensions/trust-policy.ts',
  'packages/greenfield-module-ui-contracts/src/index.ts',
])

scanFiles(
  ['src', 'services/greenfield-api/src', 'services/greenfield-worker/src', 'packages'],
  ({path, line}) => {
    if (arbitraryExecutionAllowed.has(path)) return null
    if (/\beval\s*\(/.test(line)) return 'eval primitive remains'
    if (/\bnew\s+Function\s*\(/.test(line)) return 'Function constructor remains'
    if (/\bchild_process\b/.test(line)) return 'child_process import remains'
    if (/(^|[^\.\w$])(?:exec|execFile|spawn|fork)\s*\(/.test(line)) return 'process execution primitive remains'
    if (/\bWebView\b/.test(line)) return 'WebView primitive remains'
    if (/\bdangerouslySetInnerHTML\b/.test(line)) return 'dangerous HTML injection primitive remains'
    if (/import\s*\(\s*['"]https?:\/\//.test(line)) return 'remote dynamic import remains'
    return null
  },
  'no forbidden arbitrary execution primitives',
)

if (failures.length > 0) {
  console.error(`Phase 7E code quality verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log('Phase 7E code quality verifier passed')
