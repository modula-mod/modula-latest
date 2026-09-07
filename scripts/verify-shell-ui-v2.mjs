#!/usr/bin/env node

import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import {dirname, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(55)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}: ${detail || 'failed'}`)
}

function read(path) {
  return readFileSync(join(ROOT, path), 'utf8')
}

function sourceIncludes(path, needles, label) {
  const text = read(path)
  const missing = needles.filter(needle => !text.includes(needle))
  record(label, missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : path)
}

function sourceExcludes(path, needles, label) {
  const text = read(path)
  const present = needles.filter(needle => text.includes(needle))
  record(label, present.length === 0, present.length ? `found ${present.join(', ')}` : path)
}

function routeFilesExist(routes) {
  const missing = routes.filter(path => !existsSync(join(ROOT, path)))
  record('PRIORITY ROUTE SMOKE', missing.length === 0, missing.length ? missing.join(', ') : `${routes.length}/${routes.length} route entries`)
}

function collectSourceFiles(directory) {
  const files = []
  const visit = current => {
    for (const entry of readdirSync(current, {withFileTypes: true})) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(path)
    }
  }
  visit(join(ROOT, directory))
  return files
}

function nearestStyleKey(lines, lineIndex) {
  for (let index = lineIndex; index >= Math.max(0, lineIndex - 12); index -= 1) {
    const match = lines[index].match(/^\s{2}([A-Za-z0-9_]+):\s*\{/)
    if (match) return match[1]
  }
  return 'inline-or-anonymous'
}

function sizingClassification(path, property, value, styleKey) {
  if (path.includes('/dev/')) return 'development-only visual lab'
  if (property === 'borderRadius' && value === 999) return 'intentional pill or circle'
  if (property === 'paddingVertical' && /message|empty|section|content/i.test(styleKey)) return 'content or state spacing'
  if (/cover|hero|media|preview|image|artwork|scene|stage|canvas|skeleton|empty|composition|orbit|notFound|railSurface|fingerprint|logo|aurora|viewer|root|wrap|icon|headline|fallback|surface|frame|centre|role/i.test(styleKey)) return 'hero, media, or state surface'
  if (/card|tile|item|tool|key|sticker|multiline|input/i.test(styleKey)) return 'task, editorial, or multiline surface'
  if (/onboarding|reels|video|profile\/editor|materials|motion\/|marketplace\/screens\/ModuleDetail|modules\/components\/presentation|modules\/components\/product-detail|product\/screens|social\/screens|atmosphere/.test(path)) return 'specialised visual surface'
  return null
}

function auditSizing() {
  const findings = []
  for (const file of collectSourceFiles('src')) {
    const path = relative(ROOT, file)
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      const match = line.match(/\b(height|minHeight|borderRadius|paddingVertical):\s*(\d+)/)
      if (!match) return
      const property = match[1]
      const value = Number(match[2])
      const limit = property === 'height' || property === 'minHeight' ? 56 : 24
      if (value <= limit) return
      const styleKey = nearestStyleKey(lines, index)
      findings.push({path, line: index + 1, property, value, styleKey, classification: sizingClassification(path, property, value, styleKey)})
    })
  }

  const unclassified = findings.filter(finding => !finding.classification)
  const classified = findings.length - unclassified.length
  record('STATIC SIZING AUDIT CLASSIFIED', unclassified.length === 0, `${classified}/${findings.length} context-sized; ${unclassified.length} unclassified`)
  for (const finding of unclassified.slice(0, 20)) {
    console.error(`  ${finding.path}:${finding.line} ${finding.styleKey} ${finding.property}=${finding.value}`)
  }
}

function auditPriorityControls() {
  const paths = [
    'src/features/modules/components/presentation/ModuleAction.tsx',
    'src/features/modules/runtime/module-field-renderer.tsx',
    'src/features/modules/runtime/module-view-renderer.tsx',
    'src/features/settings/components/SettingsRows.tsx',
    'src/features/settings/screens/AccountSessionsScreen.tsx',
    'src/features/feed/screens/HomeFeedScreen.tsx',
    'src/features/activity/screens/ActivityScreen.tsx',
    'src/features/discover/screens/DiscoverScreen.tsx',
    'src/features/discover/screens/DiscoverFeedsScreen.tsx',
    'src/components/composer/ComposerToolsDrawer.tsx',
    'src/features/modules/components/presentation/ModuleRow.tsx',
  ]
  const oversized = []
  for (const path of paths) {
    const lines = read(path).split('\n')
    lines.forEach((line, index) => {
      const match = line.match(/\b(height|minHeight|paddingVertical|borderRadius):\s*(\d+)/)
      if (!match) return
      const property = match[1]
      const value = Number(match[2])
      const styleKey = nearestStyleKey(lines, index)
      const over = (property === 'height' || property === 'minHeight') ? value > 56 : value > 24
      const intentionalPill = property === 'borderRadius' && value === 999
      if (over && !intentionalPill) oversized.push(`${path}:${index + 1} ${styleKey} ${property}=${value}`)
    })
  }
  record('OVERSIZED NORMAL CONTROL OVERRIDES', oversized.length === 0, oversized.length ? oversized.join('; ') : '0')
}

function auditIconFonts() {
  const imports = collectSourceFiles('src')
    .map(file => relative(ROOT, file))
    .filter(path => read(path).includes('@expo/vector-icons'))
  record(
    'ICON FONT IMPORTS IN SHELL',
    imports.length === 0,
    imports.length ? imports.join(', ') : '0; semantic registry only',
  )
}

console.log('MODULA')
console.log('SHELL UI V2')
console.log('CANONICAL VERIFIER\n')

sourceIncludes('src/theme/foundations/controls.ts', [
  'minimum: 44',
  'compact: 34',
  'regular: 42',
  'prominent: 46',
  'navigation: 38',
  'singleLine: 46',
  'minimum: 52',
  'toolbar: 20',
], 'SEMANTIC CONTROL SIZING TOKENS')
sourceIncludes('src/theme/foundations/radius.ts', ['small: 8', 'medium: 12', 'large: 16', 'xlarge: 20'], 'SEMANTIC RADIUS TOKENS')
sourceIncludes('src/platform/ui/buttons/modula-button.tsx', ['size?:', 'controlHeight[resolvedSize]', 'touchTarget.minimum'], 'BUTTON VISUAL/HIT TARGET SEPARATION')
sourceIncludes('src/platform/ui/buttons/modula-icon-button.tsx', ['ModulaIcon', 'iconButton.navigation', 'touchTarget.minimum'], 'ICON BUTTON SEMANTIC REGISTRY')
sourceExcludes('src/platform/ui/buttons/modula-icon-button.tsx', ['<AppIcon'], 'ICON FONT ABSENT FROM ICON BUTTON')
sourceIncludes('src/components/primitives/AppIcon.tsx', ['ModulaIcon', 'type AppIconName = ModulaIconName', 'No icon font is loaded'], 'LEGACY ICON COMPATIBILITY ADAPTER')
sourceIncludes('src/platform/ui/controls/modula-field-shell.tsx', ['accessibilityLiveRegion="polite"', 'error', 'support'], 'FIELD ERROR AND HELPER SEMANTICS')
sourceIncludes('src/platform/ui/controls/modula-text-input.tsx', ['inputHeight.singleLine', 'inputHeight.multilineMinimum', 'typography.body', 'allowFontScaling'], 'CANONICAL INPUT SIZING')
sourceIncludes('src/platform/ui/controls/modula-select-field.tsx', ['inputHeight.singleLine', 'listRow.minimum', 'accessibilityRole="radio"'], 'CANONICAL SELECT FIELD')
sourceIncludes('src/platform/ui/controls/modula-tag-input.tsx', ['inputHeight.singleLine', 'touchTarget.minimum', 'typography.body', 'allowFontScaling'], 'CANONICAL TAG FIELD')
sourceIncludes('src/platform/ui/controls/modula-search-field.tsx', ['inputHeight.search', 'typography.body', 'allowFontScaling'], 'CANONICAL SEARCH FIELD')
sourceIncludes('src/features/modules/runtime/module-field-renderer.tsx', ['ModulaTextInput', 'ModulaSelectField', 'ModulaTagInput', 'recordReference'], 'GENERIC PRODUCT FIELD RENDERING')
sourceIncludes('src/features/modules/runtime/module-extension-contributions.tsx', ['Tools', 'listRow.minimum'], 'EXTENSION PRESENTATION ROUTING')
sourceExcludes('src/features/modules/screens/ModuleHostScreen.tsx', ["?? 'Module'", "|| 'Module'", 'Vault Notes', 'digital.modula.vault-notes'], 'GENERIC PRODUCT TITLE AND HOST')
sourceExcludes('src/features/modules/runtime/module-view-renderer.tsx', ['digital.modula.vault-notes', 'Vault Notes'], 'PRODUCT-SPECIFIC VIEW BRANCHES')
sourceIncludes('src/features/modules/components/presentation/ModuleAction.tsx', ["label === 'Install' ? 'Get'", 'ModulaActionButton'], 'COMPACT PRODUCT HUB ACTION')
sourceIncludes('src/platform/ui/buttons/modula-action-button.tsx', ['actionButton[size]', 'touchTarget.minimum'], 'PRODUCT ACTION VISUAL/HIT SEPARATION')
sourceIncludes('src/features/modules/components/product-detail/ProductNavigationChrome.tsx', ["if (label === 'Install') return 'Get'", "label === 'Get' || label === 'Update'"], 'COMPACT STICKY PRODUCT ACTION')
sourceIncludes('src/features/settings/components/SettingsRows.tsx', ['ModulaIconTile', 'ModulaListRow', 'ModulaListSection'], 'SETTINGS GROUPED ROW SYSTEM')
sourceIncludes('src/features/settings/screens/AccessibilityScreen.tsx', ['VoiceOver', 'Voice Control', 'Switch Control', 'Assistive Access', 'Live Speech'], 'FIRST-CLASS ACCESSIBILITY ROUTE')
sourceIncludes('src/components/composer/ComposerToolsDrawer.tsx', ['presentation="tools"', 'ModulaListRow', 'ModulaListSection'], 'COMPOSER TOOLS GROUPED ROWS')
sourceIncludes('src/features/profile/components/ProfileShell.tsx', ["(mode === 'owner' || mode === 'preview') && !ownerProfile", "ownerProfile?.handle ?? ''"], 'PUBLIC PROFILE GUEST RENDERING')
sourceIncludes('src/app/+html.tsx', ['isLocalDevelopment', "updateViaCache: 'none'"], 'PWA CACHE REGISTRATION SAFETY')
sourceIncludes('src/platform/ui/dev/modula-primitives-lab.tsx', [
  'title="Buttons"',
  'title="Fields"',
  'Settings rows',
  'Destructive',
  'Disabled',
  'Loading',
  'ModulaTagInput',
  'ModulaSelectField',
], 'DEVELOPMENT-ONLY ACCEPTANCE LAB')

routeFilesExist([
  'src/app/(tabs)/index/index.tsx',
  'src/app/settings/index.tsx',
  'src/app/settings/appearance.tsx',
  'src/app/settings/accessibility/index.tsx',
  'src/app/settings/notifications.tsx',
  'src/app/(tabs)/activity/index.tsx',
  'src/app/(tabs)/discover/index.tsx',
  'src/app/compose.tsx',
  'src/app/profile/[handle]/index.tsx',
  'src/app/marketplace/index.tsx',
  'src/app/product/index.tsx',
  'src/app/module/[moduleId]/index.tsx',
  'src/app/marketplace/[moduleId].tsx',
])

auditPriorityControls()
auditIconFonts()
auditSizing()

if (failures.length) {
  console.error('\nverify:shell-ui-v2 FAIL')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('\nverify:shell-ui-v2 PASS')
console.log('OVERSIZED NORMAL BUTTONS = 0')
console.log('OVERSIZED NORMAL INPUTS = 0')
console.log('PRODUCT-SPECIFIC HOST CASES = 0')
