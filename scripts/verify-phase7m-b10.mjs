#!/usr/bin/env node
/** Phase 7M-B10 source gate: truthful Marketplace metadata and founder fidelity. */
import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const failures = []
const read = name => existsSync(path.join(root, name)) ? readFileSync(path.join(root, name), 'utf8') : ''
const record = (label, ok, detail = '') => {
  console.log(`${label.padEnd(40)} ${ok ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(label)
}
const contains = (file, value, label) => record(label, read(file).includes(value), file)

console.log('PHASE 7M-B10 — Product Hub source verifier\n')

const b9 = spawnSync(process.execPath, ['scripts/verify-phase7m-b9.mjs'], {cwd: root, encoding: 'utf8'})
record('B9 ARCHITECTURE PRESERVED', b9.status === 0, b9.status === 0 ? 'existing route and lifecycle' : 'B9 verifier failed')

const detailName = 'src/features/marketplace/screens/ModuleDetailScreen.tsx'
const detail = read(detailName)
record('ONE MODULE DETAIL ROUTE', (read('src/app/marketplace/[moduleId].tsx').match(/<ModuleDetailScreen \/>/g) ?? []).length === 1)
record('NO DETAIL V2', !existsSync(path.join(root, 'src/app/marketplace/module-detail-v2.tsx')))
record('NO DEAD SAVE ACTION', !/label=["']Save["']/.test(detail))
record('NO DEAD NOTIFY ACTION', !/label=["']Notify["']/.test(detail))
record('NO FABRICATED MARKET VALUES', !/4\.8|1\.2K|18\.6\s*MB|13\+/.test(detail))
contains(detailName, "value: average === null ? '—'", 'UNKNOWN RATING IS DASH')
contains(detailName, "value: age ?? '—'", 'UNKNOWN AGE IS DASH')
contains(detailName, "value: chartRank === null ? '—'", 'UNKNOWN CHART IS DASH')
contains(detailName, 'booleanDeclarationPresentation', 'TRUE FALSE UNKNOWN SEMANTICS')
contains(detailName, "value: 'Not declared'", 'UNKNOWN CAPABILITY COPY')

console.log('\n# Product fidelity')
contains('src/features/modules/components/product-detail/ProductTabs.tsx', 'ModulaSegmentedPicker', 'NATIVE SEGMENTED ADAPTER')
contains('src/features/modules/components/product-detail/ProductMetadataStrip.tsx', 'minHeight: 66', 'COMPACT METRICS')
contains('src/features/modules/components/product-detail/ProductCapabilityStrip.tsx', 'minHeight: 78', 'COMPACT CAPABILITIES')
contains('src/features/modules/components/product-detail/ProductInformationStrip.tsx', 'minHeight: 76', 'COMPACT INFORMATION')
contains('src/features/modules/components/product-detail/ProductCover.tsx', 'ProgressiveBlurBand', 'PROGRESSIVE HERO TRANSITION')
contains('src/features/modules/components/product-detail/ProductPreviewCarousel.tsx', "type: 'image' | 'video'", 'IMAGE VIDEO PREVIEWS')
contains('src/features/modules/components/product-detail/ProductPreviewCarousel.tsx', 'Loading…', 'PREVIEW LOADING STATE')
contains('src/features/modules/components/product-detail/ProductPreviewCarousel.tsx', 'Preview unavailable', 'PREVIEW FAILURE STATE')
contains('src/features/modules/components/product-detail/ProductPreviewCarousel.tsx', 'ModulaReelPlayer', 'LAZY VIDEO VIEWER')
contains('src/features/modules/components/product-detail/ProductPreviewCarousel.tsx', 'Screenshots not available', 'TRUTHFUL EMPTY PREVIEW')
for (const role of ['moduleTitle', 'moduleSubtitle', 'publisher', 'metricValue', 'metricLabel', 'sectionTitle', 'secondaryBody', 'button']) {
  contains('src/theme/contracts/typography.ts', role, `TYPE ROLE ${role.toUpperCase()}`)
}

console.log('\n# Production metadata contract')
contains('packages/greenfield-module-registry-contracts/src/registry.ts', "state: 'unknown'", 'DECLARATION UNKNOWN STATE')
contains('packages/greenfield-module-registry-contracts/src/registry.ts', "type: 'image' | 'video'", 'PREVIEW CONTRACT')
contains('services/greenfield-api/src/modules/marketplace-service.ts', 'ratingAggregate', 'REAL RATING AGGREGATE')
contains('services/greenfield-api/src/modules/marketplace-service.ts', 'greenfield_extension_installations', 'REAL INSTALL AGGREGATE')
contains('services/greenfield-api/src/modules/marketplace-service.ts', 'chartPlacement', 'INSTALL-DERIVED CHART')
contains('services/greenfield-api/src/modules/routes/index.ts', '/v1/registry/modules/:moduleId/rating', 'AUTHENTICATED RATING ROUTE')
record('RATING MIGRATION', existsSync(path.join(root, 'services/greenfield-api/migrations/038_phase7m_b10_module_marketplace.sql')))
contains('src/data/repositories/api/ApiModuleRepository.ts', 'rateModule(moduleId', 'RATING CLIENT')
contains('src/features/modules/components/product-detail/ProductRatingPanel.tsx', 'Ratings are submitted by signed-in Modula accounts', 'RATING PRODUCT UI')

console.log('\n# Expo web-host audit')
const pkg = JSON.parse(read('package.json'))
record('LOCAL AUTH SDK RETIRED', !pkg.dependencies?.['expo-local-authentication'])
record('EXPO DEV CLIENT RETIRED', !pkg.dependencies?.['expo-dev-client'])

const diff = spawnSync('git', ['diff', '--check'], {cwd: root, encoding: 'utf8'})
record('GIT DIFF CHECK', diff.status === 0, diff.stderr.trim())

if (failures.length) {
  console.error(`\nverify:phase7m-b10 FAIL (${failures.length})`)
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}
console.log('\nverify:phase7m-b10 PASS')
console.log('PRODUCTION DEPLOYED = NO')
console.log('FOUNDER VISUAL APPROVAL = REQUIRED')
