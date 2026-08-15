#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors = []

const requiredFiles = [
  'src/features/modules/api/index.ts',
  'src/features/modules/components/InstallPreviewSheet.tsx',
  'src/features/modules/components/ModuleCatalogueCard.tsx',
  'src/features/modules/components/ModuleStatusPill.tsx',
  'src/features/modules/components/SchemaSettingsRenderer.tsx',
  'src/features/modules/hooks/useModuleQueries.ts',
  'src/features/modules/runtime/module-host.tsx',
  'src/features/modules/runtime/module-route-resolver.ts',
  'src/features/modules/runtime/module-view-renderer.tsx',
  'src/features/modules/runtime/module-action-runner.ts',
  'src/features/modules/runtime/module-field-renderer.tsx',
  'src/features/modules/runtime/module-permission-gate.tsx',
  'src/features/modules/runtime/module-error-boundary.tsx',
  'src/features/modules/runtime/module-empty-state.tsx',
  'src/features/modules/runtime/module-loading-state.tsx',
  'src/features/modules/screens/ProductHubMarketplaceScreen.tsx',
  'src/features/modules/screens/ModuleHostScreen.tsx',
  'src/features/modules/screens/InstalledModulesScreen.tsx',
  'src/features/modules/screens/ModuleManagementScreen.tsx',
  'src/app/module/[moduleId]/index.tsx',
  'src/app/module/[moduleId]/[...path].tsx',
  'src/app/settings/modules/index.tsx',
  'src/app/settings/modules/[moduleId].tsx',
]

function file(rel) {
  const abs = path.join(root, rel)
  if (!fs.existsSync(abs)) {
    errors.push(`missing ${rel}`)
    return ''
  }
  return fs.readFileSync(abs, 'utf8')
}

for (const rel of requiredFiles) file(rel)

const product = file('src/features/product/screens/ProductHubScreen.tsx')
if (!product.includes('ProductHubMarketplaceScreen') && !product.includes('ProductHubMarketplaceContent')) {
  errors.push('Product Hub does not embed registry marketplace content')
}

const marketplace = file('src/features/marketplace/screens/MarketplaceScreen.tsx')
if (!marketplace.includes('ProductHubMarketplaceScreen')) errors.push('Marketplace route is not a Product Hub wrapper')
if (!marketplace.includes('ModulaCurvedSectionTabs')) errors.push('Marketplace verifier compatibility marker missing')

const detail = file('src/features/marketplace/screens/ModuleDetailScreen.tsx')
for (const needle of ['Trust and provenance', 'Permissions', 'Data access', 'InstallPreviewSheet', 'Uninstall']) {
  if (!detail.includes(needle)) errors.push(`module detail missing ${needle}`)
}

const settings = file('src/features/settings/screens/SettingsHomeScreen.tsx')
if (!settings.includes("route: '/settings/modules'")) errors.push('Settings home missing Modules route')

const board = file('src/features/board/screens/BoardScreen.tsx')
if (!board.includes("surface: 'board'") || !board.includes('BoardContributionCard')) {
  errors.push('Board does not host module contributions')
}

const profile = file('src/features/profile/components/ProfileShell.tsx')
if (!profile.includes("surface: 'profileTab'") || !profile.includes('profile.moduleRuntime')) {
  errors.push('Profile tabs do not include module contributions')
}

const composer = file('src/components/composer/ComposerToolsDrawer.tsx')
for (const needle of ['requiresInstall', 'requiresEnable', 'requiresConfiguration', 'moduleId', '/marketplace/']) {
  if (!composer.includes(needle)) errors.push(`composer module tool handling missing ${needle}`)
}

const postActions = file('src/features/feed/postActions/catalog.ts') + file('src/features/feed/postActions/runPostAction.ts')
if (!postActions.includes('saveToVault') || !postActions.includes('/module/digital.modula.vault-notes/note-editor')) {
  errors.push('post menu Save to Vault intent is not wired to module host')
}

if (errors.length) {
  console.error('Phase 7B module host verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7B module host verification passed.')
