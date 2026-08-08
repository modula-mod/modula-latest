#!/usr/bin/env node
/**
 * Phase 7F-B — product paths must not force demo/mock/deterministic data.
 */
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs'
import {join, relative} from 'node:path'

const root = process.cwd()
const errors = []
const warnings = []

function read(rel) {
  const abs = join(root, rel)
  if (!existsSync(abs)) {
    errors.push(`missing ${rel}`)
    return ''
  }
  return readFileSync(abs, 'utf8')
}

function fail(message) {
  errors.push(message)
}

function warn(message) {
  warnings.push(message)
  console.warn(`WARN ${message}`)
}

// 1) Stories rail / home must not import presenceRailSeed
for (const rel of [
  'src/features/presence/components/PresenceStoriesRail.tsx',
  'src/features/feed/screens/HomeFeedScreen.tsx',
]) {
  const text = read(rel)
  if (/presenceRailSeed/.test(text)) {
    fail(`${rel} imports or references presenceRailSeed`)
  }
}

// 2) .env.example may show owner as an example — warn only (not a hard fail)
const envExample = existsSync(join(root, '.env.example')) ? read('.env.example') : ''
if (/EXPO_PUBLIC_DEMO_SESSION\s*=\s*owner/.test(envExample)) {
  warn('.env.example sets EXPO_PUBLIC_DEMO_SESSION=owner (example only; product must not force this)')
}

// 3) Fail if product src forces demoSession='owner' outside SessionProvider opt-in path
const allowedOwnerRefs = new Set([
  'src/auth/runtime/SessionProvider.tsx',
  'src/auth/runtime/SessionBootstrap.ts',
  'src/config/runtimeEnvironment.ts',
])

const productRoots = ['src/app', 'src/features', 'src/auth', 'src/components', 'src/runtime', 'src/config']

function walk(dir, visit) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)
    const rel = relative(root, abs)
    if (rel.split('/').some(seg => ['node_modules', 'dist', '.expo'].includes(seg))) continue
    const stats = statSync(abs)
    if (stats.isDirectory()) {
      // Dev-only playgrounds
      if (rel.startsWith('src/app/dev') || rel.startsWith('src/platform/ui/dev')) continue
      walk(abs, visit)
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      visit(abs, rel)
    }
  }
}

for (const base of productRoots) {
  walk(join(root, base), (abs, rel) => {
    const text = readFileSync(abs, 'utf8')
    const lines = text.split(/\r?\n/)
    for (const [index, line] of lines.entries()) {
      // Forced assignment / literal product bootstrap — not env read / comment / comparison opt-in
      if (/demoSession\s*=\s*['"]owner['"]/.test(line) && !/===|!==|==|!=/.test(line)) {
        if (!allowedOwnerRefs.has(rel)) {
          fail(`${rel}:${index + 1}: forced demoSession='owner' outside SessionProvider opt-in`)
        }
      }
      if (/EXPO_PUBLIC_DEMO_SESSION\s*=\s*['"]owner['"]/.test(line) && !line.trim().startsWith('//')) {
        if (!allowedOwnerRefs.has(rel) && !rel.endsWith('.md')) {
          fail(`${rel}:${index + 1}: hardcoded EXPO_PUBLIC_DEMO_SESSION=owner in product source`)
        }
      }
    }
  })
}

// 4) Deterministic AI provider must not be enabled in product runtime paths
const aiPatterns = [
  /provider:development-mock/,
  /greenfield\.mock\.deterministic/,
  /allowDevelopmentMock\s*:\s*true/,
  /configurationMode\s*:\s*['"]development-mock['"]/,
]

const aiAllowed = [
  'services/greenfield-api/src/ai/providers/registry.ts',
  'services/greenfield-api/src/ai/providers/mock-provider.ts',
  'services/greenfield-api/src/ai/providers/resolver.ts',
  'services/greenfield-api/src/ai/provider-runtime-service.ts',
  'services/greenfield-api/src/database/types.ts',
]

for (const base of ['src', 'services/greenfield-api/src', 'services/greenfield-worker/src']) {
  walk(join(root, base), (abs, rel) => {
    if (rel.includes('/tests/') || rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) return
    if (aiAllowed.includes(rel)) return
    const text = readFileSync(abs, 'utf8')
    const lines = text.split(/\r?\n/)
    for (const [index, line] of lines.entries()) {
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue
      for (const pattern of aiPatterns) {
        if (pattern.test(line)) {
          // Guarded registry registration is OK only in allowed files (already returned)
          fail(`${rel}:${index + 1}: deterministic AI provider pattern in product runtime`)
        }
      }
    }
  })
}

// Soft check: API runtime only enables mock under NODE_ENV=test (if file present)
const runtime = existsSync(join(root, 'services/greenfield-api/src/ai/provider-runtime-service.ts'))
  ? read('services/greenfield-api/src/ai/provider-runtime-service.ts')
  : ''
if (runtime && !runtime.includes("allowDevelopmentMock: config.nodeEnv === 'test'") && !runtime.includes("allowDevelopmentMock: this.config.nodeEnv === 'test'")) {
  fail('AI provider runtime must gate allowDevelopmentMock to NODE_ENV=test')
}

if (errors.length) {
  console.error('Phase 7F-B no-native-product-mocks verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7F-B no-native-product-mocks verification passed.')
