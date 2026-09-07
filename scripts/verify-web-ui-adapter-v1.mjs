#!/usr/bin/env node

import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {dirname, extname, join, relative} from 'node:path'
import {spawnSync} from 'node:child_process'
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

function source(path, needles, label) {
  if (!existsSync(join(ROOT, path))) {
    record(label, false, `missing ${path}`)
    return
  }
  const text = read(path)
  const missing = needles.filter(needle => !text.includes(needle))
  record(label, missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : path)
}

function sourceFiles(directory) {
  const found = []
  const visit = current => {
    for (const entry of readdirSync(current, {withFileTypes: true})) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(extname(entry.name))) found.push(path)
    }
  }
  visit(join(ROOT, directory))
  return found
}

function importsMatching(pattern) {
  return sourceFiles('src').flatMap(file => {
    const path = relative(ROOT, file)
    return pattern.test(readFileSync(file, 'utf8')) ? [path] : []
  })
}

console.log('MODULA')
console.log('WEB UI ADAPTER V1')
console.log('CANONICAL VERIFIER\n')

source('src/platform/ui/responsive/presentation-resolver.ts', ['pointer', 'hover', 'standalone', 'platform', 'viewport', "return 'drawer'", "return 'sheet'", "return 'dialog'", "return 'menu'", "return 'popover'"], 'CENTRAL PRESENTATION RESOLVER')
source('src/platform/ui/sheets/modula-sheet.web.tsx', ['Drawer.VirtualKeyboardProvider', 'Drawer.Content', 'snapPoints', 'onSnapPointChange', 'finalFocus', 'initialFocus'], 'DRAWER FOCUS GESTURE AND SCROLL ADAPTER')
source('src/platform/ui/drawers/modula-drawer-navigator.web.tsx', ['const push', 'const pop', 'const replace', 'const reset', 'focusOrigin', 'scrollTop', 'ResizeObserver', 'aria-hidden', 'hidden={!active}'], 'SINGLE-SURFACE DRAWER NAVIGATION')
source('src/platform/ui/motion/modula-motion-spec.ts', ['drawerPage.forward', 'drawerPage.back', 'drawerHeight.change', 'drawerModal.enter', 'drawerModal.exit'], 'DRAWER NAVIGATION MOTION TOKENS')
source('src/platform/web-ui/styles.ts', ['100dvh', 'env(safe-area-inset-bottom)', 'prefers-reduced-motion', 'prefers-contrast: more', 'body {', 'position: relative'], 'PWA SAFE AREA VIEWPORT AND A11Y CSS')
source('src/platform/ui/menus/modula-menu.web.tsx', ['CheckboxItem', 'RadioGroup', 'SubmenuRoot', 'TouchModulaMenu', 'ModulaTouchActionDrawer', 'ModulaDrawerNavigator', 'touchActionScreens'], 'ADAPTIVE MENU CONTRACT')
source('src/platform/ui/menus/modula-context-menu.web.tsx', ["useResponsivePresentation('context'", 'TouchContextMenu', 'ModulaTouchActionDrawer'], 'ADAPTIVE CONTEXT MENU CONTRACT')
source('src/platform/ui/controls/modula-text-input.web.tsx', ['autoComplete', 'onChange:', 'spellCheck', 'HTMLInputElement', 'HTMLTextAreaElement'], 'WEB-NATIVE TEXT INPUT')
source('src/platform/ui/controls/modula-select-field.web.tsx', ["useResponsivePresentation('picker'", 'TouchSelectField', 'DesktopSelectField'], 'ADAPTIVE SELECT CONTRACT')
source('src/platform/ui/controls/modula-combobox.web.tsx', ["useResponsivePresentation('picker'", 'TouchCombobox', 'DesktopCombobox'], 'ADAPTIVE COMBOBOX CONTRACT')
source('src/platform/ui/controls/modula-toggle-group.web.tsx', ['aria-pressed', 'ArrowLeft', 'ArrowRight', 'role="toolbar"'], 'TOGGLE GROUP KEYBOARD CONTRACT')
source('src/platform/ui/feedback/modula-tooltip.web.tsx', ['Tooltip.Trigger', 'Tooltip.Popup', 'Supplemental hover/focus'], 'DESKTOP TOOLTIP CONTRACT')
source('src/platform/ui/dev/web-ui-adapter-lab.tsx', ['Drawer matrix', 'Drill-in navigation', 'True nested modal', 'web-adapter-open-formatting', 'web-adapter-open-font', 'Sheet matrix', 'Dialog matrix', 'Menu and popover', 'Command and feedback', 'Form adapters', 'Tabs and toggles'], 'UI LAB WEB ADAPTER MATRIX')
source('src/features/modules/components/product-detail/ProductMetadataStrip.tsx', ['ModulaHorizontalScroll', "colour=\"textSecondary\""], 'MODULE DETAIL SCROLLER AND CONTRAST')
source('src/platform/ui/product-ui.ts', ['ModulaDrawer', 'ModulaDrawerNavigator', 'ModulaDialog', 'ModulaCommand', 'ModulaCombobox', 'ModulaButtonGroup', 'ModulaToggleGroup', 'ModulaTooltip'], 'SEMANTIC PRODUCT UI EXPORTS')
source('docs/architecture/web-ui-adapter-v1.md', ['@base-ui/react` 1.8.0', 'Database work: **none**', 'MultiSelect was not added', 'Installed-iPhone PWA'], 'ARCHITECTURE PROVENANCE AND OPEN GATES')
source('docs/architecture/dependency-register.md', ['@base-ui/react', 'Web UI Adapter V1'], 'DEPENDENCY ADMISSION REGISTER')

const baseImports = importsMatching(/from\s+['"]@base-ui\/react/)
const baseOutsideAdapters = baseImports.filter(path => !path.startsWith('src/platform/web-ui/') && !(path.startsWith('src/platform/ui/') && path.endsWith('.web.tsx')))
record('DIRECT BASE UI IMPORTS OUTSIDE APPROVED ADAPTER', baseOutsideAdapters.length === 0, baseOutsideAdapters.length ? baseOutsideAdapters.join(', ') : '0')

const radixOutsideAdapters = importsMatching(/from\s+['"]@radix-ui\//).filter(path => !path.startsWith('src/platform/web-ui/') && !(path.startsWith('src/platform/ui/') && path.endsWith('.web.tsx')))
record('DIRECT RADIX IMPORTS OUTSIDE APPROVED ADAPTER', radixOutsideAdapters.length === 0, radixOutsideAdapters.length ? radixOutsideAdapters.join(', ') : '0')

const shadcnScreenImports = importsMatching(/(?:@\/)?components\/ui\//).filter(path => !path.startsWith('src/platform/ui/') && !path.startsWith('src/platform/web-ui/'))
record('DIRECT SHADCN IMPORTS IN NORMAL SCREENS', shadcnScreenImports.length === 0, shadcnScreenImports.length ? shadcnScreenImports.join(', ') : '0')

const nativeLeaks = baseImports.filter(path => !path.endsWith('.web.tsx'))
record('WEB-ONLY HEADLESS IMPORTS IN NATIVE ENTRY FILES', nativeLeaks.length === 0, nativeLeaks.length ? nativeLeaks.join(', ') : '0')

const packageJson = JSON.parse(read('package.json'))
const dependencies = {...packageJson.dependencies, ...packageJson.devDependencies}
const forbiddenDependencies = Object.keys(dependencies).filter(name => name === 'svelte' || name.startsWith('@svelte/') || name === 'vaul-svelte' || name === 'bits-ui')
record('SVELTE RUNTIME', forbiddenDependencies.length === 0, forbiddenDependencies.length ? forbiddenDependencies.join(', ') : '0')
record('TAILWIND-WIDE MIGRATION', !dependencies.tailwindcss, dependencies.tailwindcss ? 'tailwindcss present' : 'NO')
record('BASE UI VERSION', dependencies['@base-ui/react'] === '1.8.0', dependencies['@base-ui/react'] ?? 'missing')

const hostCases = [read('src/platform/ui/product-ui.ts'), read('src/features/modules/runtime/module-view-renderer.tsx')]
  .flatMap((text, index) => /digital\.modula\.|Vault Notes|Reference Tasks/.test(text) ? [index] : [])
record('PRODUCT-SPECIFIC HOST CASES', hostCases.length === 0, hostCases.length ? String(hostCases.length) : '0')

const newAdapterSource = [read('src/platform/web-ui/styles.ts'), read('src/platform/ui/sheets/modula-sheet.web.tsx')].join('\n')
record('LEGACY 100VH IN NEW ADAPTER', !/(^|[^dls])100vh/.test(newAdapterSource), '0')

const unit = spawnSync('pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '--tsconfig', '../../tsconfig.json', '../../scripts/test-web-ui-adapter-v1.ts'], {cwd: ROOT, encoding: 'utf8'})
record('RESOLVER AND SNAP UNIT TESTS', unit.status === 0, unit.status === 0 ? 'PASS' : (unit.stderr || unit.stdout).trim())
if (unit.status === 0 && unit.stdout.trim()) console.log(unit.stdout.trim())

if (failures.length) {
  console.error('\nverify:web-ui-adapter-v1 FAIL')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('\nverify:web-ui-adapter-v1 PASS')
console.log(`APPROVED WEB ADAPTER BASE UI IMPORTS = ${baseImports.length}`)
console.log('DIRECT BASE UI IMPORTS OUTSIDE APPROVED ADAPTER = 0')
console.log('DIRECT SHADCN IMPORTS IN NORMAL SCREENS = 0')
console.log('WEB-ONLY HEADLESS LIBRARY IMPORTS IN NATIVE ENTRY FILES = 0')
console.log('PRODUCT-SPECIFIC HOST CASES = 0')
