#!/usr/bin/env node

import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {dirname, extname, join, relative} from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(58)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}: ${detail || 'failed'}`)
}

function read(path) {
  return readFileSync(join(ROOT, path), 'utf8')
}

function source(path, needles, label) {
  if (!existsSync(join(ROOT, path))) {
    record(label, false, `missing ${path}`)
    return
  }
  const text = read(path)
  const missing = needles.filter(needle => !text.includes(needle))
  record(label, missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : path)
}

function sourceFiles(directories) {
  const found = []
  const visit = current => {
    if (!existsSync(current)) return
    for (const entry of readdirSync(current, {withFileTypes: true})) {
      if (['node_modules', 'dist', '.git', 'build', 'coverage'].includes(entry.name)) continue
      const path = join(current, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css'].includes(extname(entry.name))) found.push(path)
    }
  }
  directories.forEach(directory => visit(join(ROOT, directory)))
  return found
}

const files = sourceFiles(['src', 'packages', 'services'])
const matches = pattern => files.flatMap(file => pattern.test(readFileSync(file, 'utf8')) ? [relative(ROOT, file)] : [])

console.log('MODULA')
console.log('KONSTA WEB PRESENTATION')
console.log('CANONICAL VERIFIER\n')

const packageJson = JSON.parse(read('package.json'))
const dependencies = {...packageJson.dependencies, ...packageJson.devDependencies}
record('KONSTA EXACT VERSION', dependencies.konsta === '5.4.0', dependencies.konsta ?? 'missing')
record('TAILWIND EXACT VERSION', dependencies.tailwindcss === '4.3.3', dependencies.tailwindcss ?? 'missing')
record('POSTCSS PLUGIN EXACT VERSION', dependencies['@tailwindcss/postcss'] === '4.3.3', dependencies['@tailwindcss/postcss'] ?? 'missing')
record('POSTCSS EXACT VERSION', dependencies.postcss === '8.5.28', dependencies.postcss ?? 'missing')
record('NO MUI', !dependencies['@mui/material'] && !dependencies['@material-ui/core'], '0')
record('NO NATIVEWIND', !dependencies.nativewind, '0')

const directKonstaImports = matches(/(?:from\s+['"]konsta(?:\/react)?['"]|require\(['"]konsta)/)
const invalidKonstaImports = directKonstaImports.filter(path => !/^src\/platform\/ui\/adapters\/konsta\/.*\.web\.(?:ts|tsx)$/.test(path))
record('DIRECT KONSTA IMPORTS STAY IN WEB ADAPTER', invalidKonstaImports.length === 0, invalidKonstaImports.join(', ') || String(directKonstaImports.length))

const nativeLeaks = matches(/(?:from\s+['"]konsta|require\(['"]konsta|tailwindcss|k-ios|k-material)/i).filter(path => /\.(?:native|ios|android)\.(?:ts|tsx)$/.test(path))
record('NATIVE SOURCE HAS NO WEB PRESENTATION LEAK', nativeLeaks.length === 0, nativeLeaks.join(', ') || '0')

const compilerLeaks = matches(/konsta|tailwindcss|k-ios|k-material/i).filter(path => /^packages\/greenfield-(?:module-ui-contracts|module-sdk|module-manifest|product-standard)\//.test(path))
record('AUTHORING AND COMPILER SOURCES REMAIN CLEAN', compilerLeaks.length === 0, compilerLeaks.join(', ') || '0')

source('src/styles/web.css', [
  "@import 'tailwindcss/theme.css'",
  "@import 'konsta/react/theme.css'",
  "@import 'tailwindcss/utilities.css'",
  'Deliberately omit tailwindcss/preflight.css',
], 'WEB CSS PIPELINE WITHOUT PREFLIGHT')
source('src/styles/load-web-styles.web.ts', ["import './web.css'"], 'WEB-ONLY CSS ENTRY')
source('src/app/_layout.tsx', ["import '@/styles/load-web-styles'", "from '@/shell/RootLayout'"], 'SHARED ROOT DELEGATION')
source('src/platform/ui/adapters/konsta/konsta-theme.ts', ["return presentation === 'material' ? 'material' : 'ios'", "'k-material'", "'k-ios'"], 'CENTRAL THEME AND CLASS RESOLVER')
source('src/platform/ui/adapters/konsta/konsta-provider.web.tsx', ['data-modula-presentation', 'autoThemeDetection={false}', "root.classList.toggle('k-ios'", "root.classList.toggle('k-material'", 'konstaCssVariables'], 'ATOMIC PROVIDER AND PORTAL ROOT')
source('src/platform/ui/presentation/web-presentation-provider.native.tsx', ['return children'], 'NATIVE NO-OP PROVIDER')
source('src/platform/ui/adapters/konsta/tokens.web.ts', ['--k-color-primary', '--k-color-md-light-on-primary', '--k-color-md-dark-on-primary', '--k-color-md-light-surface', '--k-color-md-dark-outline', '--k-hairline-color'], 'RUNTIME GENERATED-COLOUR BRIDGE')
source('src/platform/ui/adapters/konsta/overlay-surfaces.web.tsx', ['focus, dismissal, portal placement, scroll', 'no Konsta overlay primitive', 'transition: \'none\''], 'ONE OVERLAY BEHAVIOUR OWNER')
source('src/platform/ui/overlays/modula-overlay-stack.tsx', ['ModulaOverlayLayerScope', 'OverlayParentLayerContext', 'Math.max'], 'PARENT-AWARE OVERLAY LAYERS')
source('src/platform/ui/drawers/modula-drawer-frame.web.tsx', ['Base UI exclusively owns', 'passive token-driven surface', 'finalFocus', 'initialFocus'], 'PANEL OWNERSHIP BOUNDARY')
source('src/platform/ui/drawers/modula-drawer-navigator.web.tsx', ['ResizeObserver', 'hidden={!active}', 'scrollTop', 'focusOrigin'], 'ONE-SHELL DRAWER DRILL-IN')
source('src/platform/ui/sheets/modula-sheet.web.tsx', ['requestedSnapInteraction', 'snap points and detents require the drawer presentation', 'Drawer.VirtualKeyboardProvider', 'finalFocus', 'initialFocus'], 'SUPPORTED SNAP OR EXPLICIT WARNING')
source('src/features/settings/components/web-presentation-settings-section.web.tsx', ['Web interface', 'Liquid', 'Material', 'Native apps always use their native platform UI'], 'WEB APPEARANCE CONTROL')
source('src/platform/ui/dev/web-ui-adapter-lab.tsx', ['Appearance evidence', 'State continuity', 'List primitives', 'Floating action', 'web-adapter-open-font', 'web-adapter-open-overlay-presentation'], 'EARLY COMPLETE UI LAB SLICE')
source('tests/konsta-web-presentation.test.ts', ['preserves the route', 'keeps draft, selection, drawer route', 'presentation-aware in their portals', 'Escape cancels destructive confirmation', 'Axe'], 'PRESENTATION INTERACTION TESTS')
source('docs/ui/web-presentation.md', ['Why Konsta exists', 'Overlay ownership', 'Product authoring and host boundary', 'Coverage decisions'], 'ARCHITECTURE DOCUMENTATION')
source('docs/architecture/dependency-register.md', ['Konsta UI', '5.4.0', 'Native use prohibited'], 'DEPENDENCY PROVENANCE')

const contract = read('src/platform/ui/product-ui.ts').match(/MODULA_PRODUCT_UI_V1_COMPONENTS = \[([\s\S]*?)\] as const/)?.[1] ?? ''
const contractItems = [...contract.matchAll(/'([^']+)'/g)].map(match => match[1])
const expectedContract = ['button', 'field', 'search', 'recordList', 'recordRow', 'section', 'toolbar', 'tabs', 'picker', 'menu', 'badge', 'emptyState', 'errorState', 'loadingState']
record('FROZEN PRODUCT ARTIFACT CONTRACT UNCHANGED', JSON.stringify(contractItems) === JSON.stringify(expectedContract), contractItems.join(', '))

const cssImportLocations = matches(/@import\s+['"]konsta\/react\/theme\.css/)
record('KONSTA CSS HAS ONE WEB-ONLY OWNER', cssImportLocations.length === 1 && cssImportLocations[0] === 'src/styles/web.css', cssImportLocations.join(', '))

const unit = spawnSync('pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '--tsconfig', '../../tsconfig.json', '../../scripts/test-konsta-web-presentation.ts'], {cwd: ROOT, encoding: 'utf8'})
record('THEME SETTING AND MIGRATION UNIT TESTS', unit.status === 0, unit.status === 0 ? 'PASS' : (unit.stderr || unit.stdout).trim())
if (unit.status === 0 && unit.stdout.trim()) console.log(unit.stdout.trim())

if (failures.length) {
  console.error('\nverify:konsta-web-presentation FAIL')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('\nverify:konsta-web-presentation PASS')
console.log(`APPROVED DIRECT KONSTA IMPORTS = ${directKonstaImports.length}`)
console.log('NATIVE SOURCE LEAKS = 0')
console.log('AUTHORING OR COMPILER SOURCE LEAKS = 0')
