#!/usr/bin/env node
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs'
import {join, relative} from 'node:path'

const root = process.cwd()
const failures = []

const sourceRoots = [
  'src/app',
  'src/components',
  'src/data/repositories/api',
  'src/domain',
  'src/features',
  'src/runtime',
  'services/greenfield-api/src',
  'services/greenfield-worker/src',
]

const ignoredSegments = new Set([
  'node_modules',
  'dist',
  'build',
  '.expo',
  'coverage',
])

const devOnlyPrefixes = [
  'src/app/dev/',
  'src/platform/ui/dev/',
  'src/features/settings/screens/DeveloperSettingsScreen.tsx',
  'src/features/settings/screens/ExpoUiLabScreen.tsx',
  'src/features/settings/screens/ExpoUiPlaygroundScreen.tsx',
  'src/features/settings/screens/ExpoUiSectionScreen.tsx',
]

const localOnlyPrefixes = [
  'src/api/local/',
]

const allowedAiMockPaths = [
  'services/greenfield-api/src/ai/provider-runtime-service.ts',
  'services/greenfield-api/src/ai/providers/mock-provider.ts',
  'services/greenfield-api/src/ai/providers/resolver.ts',
  'services/greenfield-api/src/database/types.ts',
]

const prohibitedDataImports = [
  '@/demo/',
  '@/features/social/data/seededSurfaces',
  '@/features/marketplace/data/catalog',
  '@/features/profile/data/demo',
  '@/features/presence/data/presenceRailSeed',
  '@/features/reels/data/algorithmSeeds',
]

const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

function pass(message) {
  console.log(`PASS ${message}`)
}

function isIgnoredPath(path) {
  if (devOnlyPrefixes.some(prefix => path.startsWith(prefix))) return true
  if (localOnlyPrefixes.some(prefix => path.startsWith(prefix))) return true
  return path.split('/').some(segment => ignoredSegments.has(segment))
}

function sourceFiles(paths) {
  const output = []

  function walk(absolute) {
    if (!existsSync(absolute)) return
    const rel = relative(root, absolute)
    if (rel && isIgnoredPath(rel)) return
    const stats = statSync(absolute)
    if (stats.isDirectory()) {
      for (const entry of readdirSync(absolute)) walk(join(absolute, entry))
      return
    }
    if (!stats.isFile()) return
    if ([...allowedExtensions].some(extension => absolute.endsWith(extension))) output.push(absolute)
  }

  for (const path of paths) walk(join(root, path))
  return output
}

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function scanProductSource() {
  for (const absolute of sourceFiles(sourceRoots)) {
    const path = relative(root, absolute)
    const text = readFileSync(absolute, 'utf8')
    const lines = text.split(/\r?\n/)
    for (const [index, line] of lines.entries()) {
      const lineNumber = index + 1
      for (const importPath of prohibitedDataImports) {
        if (line.includes(importPath)) {
          fail(`${path}:${lineNumber}: product runtime imports prohibited demo/seed data (${importPath})`)
        }
      }
      if (/\bconsole\.log\s*\(/.test(line)) {
        fail(`${path}:${lineNumber}: product action/log handler uses console.log`)
      }
      if (/\bmockPosts\b|\bmockUsers\b|\bmockNotifications\b/.test(line)) {
        fail(`${path}:${lineNumber}: product runtime references mock social data`)
      }
      if (/setTimeout\s*\(\s*\(\)\s*=>\s*setManualRefreshing/.test(line)) {
        fail(`${path}:${lineNumber}: refresh state is timed instead of driven by network completion`)
      }
      if (/fake upload|simulated upload|simulate upload|fake progress|simulated progress/i.test(line)) {
        fail(`${path}:${lineNumber}: simulated progress text remains in product runtime`)
      }
      if (/provider:development-mock|greenfield\.mock\.deterministic|development-mock/.test(line)) {
        if (!allowedAiMockPaths.includes(path) && !path.endsWith('/providers/registry.ts')) {
          fail(`${path}:${lineNumber}: product runtime references deterministic AI provider`)
        }
      }
    }
    if (/Demo[A-Z][A-Za-z0-9_]*\.(?:tsx?|jsx?)$/.test(path)) {
      fail(`${path}: demo-named component remains in product source`)
    }
  }
}

function assertGuardedLocalFallbacks() {
  const moduleRepository = read('src/data/repositories/api/ApiModuleRepository.ts')
  if (!moduleRepository.includes("runtimeEnvironment.dataSource === 'local'")) {
    fail('ApiModuleRepository must guard local catalogue/record fallbacks behind explicit local runtime')
  }
  for (const marker of ['LOCAL_CATALOGUE', 'LOCAL_RECORD_STORE', 'createLocalRecord']) {
    if (moduleRepository.includes(marker) && !moduleRepository.includes('localOnlyFallback')) {
      fail(`ApiModuleRepository ${marker} fallback is not routed through localOnlyFallback`)
    }
  }

  const toolsRepository = read('src/data/repositories/api/ApiToolsRepository.ts')
  if (toolsRepository.includes('BUILTIN_TOOLS') && !toolsRepository.includes("runtimeEnvironment.dataSource === 'local'")) {
    fail('ApiToolsRepository built-in composer tools must be local-simulator only')
  }

  const activityRepository = read('src/data/repositories/api/ApiActivityRepository.ts')
  if (activityRepository.includes('/v1/activity') && !activityRepository.includes("runtimeEnvironment.dataSource === 'local'")) {
    fail('ApiActivityRepository legacy activity fallback must be local-simulator only')
  }
}

function assertAiMockIsTestOnly() {
  const registry = read('services/greenfield-api/src/ai/providers/registry.ts')
  if (!registry.includes('allowDevelopmentMock') || !registry.includes('if (input.allowDevelopmentMock)')) {
    fail('AI provider adapter registry must not register the deterministic provider unconditionally')
  }
  const runtime = read('services/greenfield-api/src/ai/provider-runtime-service.ts')
  if (!runtime.includes("allowDevelopmentMock: config.nodeEnv === 'test'")) {
    fail('AI provider runtime must enable deterministic provider adapters only under NODE_ENV=test')
  }
  if (!runtime.includes("allowDevelopmentMock: this.config.nodeEnv === 'test'")) {
    fail('AI provider runtime resolver must skip deterministic provider models outside NODE_ENV=test')
  }
  const resolver = read('services/greenfield-api/src/ai/providers/resolver.ts')
  if (!resolver.includes("provider.configurationMode === 'development-mock' && !input.allowDevelopmentMock")) {
    fail('AI provider resolver must exclude development-mock providers outside test runtime')
  }
}

scanProductSource()
assertGuardedLocalFallbacks()
assertAiMockIsTestOnly()

if (failures.length > 0) {
  console.error(`Phase 7E no-product-mocks verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

pass('no prohibited product mock/demo/fallback patterns found')
console.log('Phase 7E no-product-mocks verifier passed')
