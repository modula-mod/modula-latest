#!/usr/bin/env node
import {check, finish, includes, maybeSh, read, sh} from './phase7c-verifier-utils.mjs'

for (const rel of [
  'docs/audits/phase7c-starting-baseline.md',
  'docs/audits/phase7c-expo-native-baseline.md',
  'docs/product/modula-founder-alpha.md',
  'docs/product/modula-product-language.md',
  'docs/design/phase7c-product-inspiration.md',
  'docs/design/modula-product-principles.md',
  'docs/architecture/adr/ADR-014-modula-root-navigation.md',
  'docs/audits/phase7c-greenfield-social-gap-analysis.md',
]) {
  includes(rel, ['Phase 7C'], rel)
}

for (const rel of [
  'scripts/verify-phase7c-product-shell.mjs',
  'scripts/verify-phase7c-social-core.mjs',
  'scripts/verify-phase7c-profile.mjs',
  'scripts/verify-phase7c-board.mjs',
  'scripts/verify-phase7c-settings.mjs',
  'scripts/verify-phase7c-product-complete.mjs',
  'scripts/verify-phase7c-api-parity.mjs',
  'scripts/verify-phase7c-placeholder-free.mjs',
  'scripts/verify-phase7c-release-candidate.mjs',
]) {
  read(rel)
}

for (const rel of [
  'docs/validation/phase7c-after/README.md',
  'docs/validation/phase7c-native-acceptance.md',
  'docs/validation/phase7c-live-acceptance.md',
  'docs/validation/phase7c-final-report.md',
  'docs/validation/phase7c-verifier-reconciliation.md',
]) {
  read(rel)
}

for (const verifier of [
  'verify-phase7c-product-shell.mjs',
  'verify-phase7c-social-core.mjs',
  'verify-phase7c-profile.mjs',
  'verify-phase7c-board.mjs',
  'verify-phase7c-settings.mjs',
  'verify-phase7c-product-complete.mjs',
  'verify-phase7c-api-parity.mjs',
  'verify-phase7c-placeholder-free.mjs',
  'verify-phase7c-release-candidate.mjs',
]) {
  const output = maybeSh(['node', `scripts/${verifier}`])
  check(`${verifier} did not pass`, output.includes('passed'))
}

const tabs = read('src/platform/ui/navigation/modula-tabs.ts')
check('one canonical root navigation missing', ['home', 'discover', 'create', 'activity', 'profile'].every(id => tabs.includes(`id: '${id}'`)))
check('Board is still a root tab', !tabs.includes("id: 'board'"))

const profile = read('src/features/profile/components/ProfileShell.tsx')
check('one profile architecture missing registry resolver', profile.includes('resolveProfileTabs'))

const productHub = read('src/features/product/screens/ProductHubScreen.tsx') + read('src/features/modules/screens/ProductHubMarketplaceScreen.tsx')
check('Product Hub architecture missing', productHub.includes('ProductHubMarketplaceContent'))

const auth = read('src/auth/runtime/SessionProvider.tsx') + read('src/data/repositories/api/ApiAuthRepository.ts')
check('real Greenfield auth missing', auth.includes('Greenfield') || auth.includes('/v1/accounts'))
check('session restoration missing', auth.includes('restore') || auth.includes('refresh'))

const home = read('src/features/feed/screens/HomeFeedScreen.tsx')
for (const label of ['Following', 'For You', 'Modules']) check(`feed mode missing ${label}`, home.includes(label))

const postActions =
  read('src/features/feed/postActions/catalog.ts') +
  read('src/features/feed/postActions/runPostAction.ts') +
  read('src/features/social/components/post-actions.tsx')
for (const action of ['saveToVault', 'repost', 'quote', 'share']) check(`post action missing ${action}`, postActions.includes(action))

const composer =
  read('src/components/composer/ComposerToolsDrawer.tsx') +
  read('src/app/compose.tsx') +
  read('src/features/composer/screens/ComposerScreen.tsx')
check('composer drafts missing', composer.includes('draft'))
check('publication flow missing', composer.includes('publish') || composer.includes('Post'))

const search = read('src/features/discover/screens/DiscoverScreen.tsx') + read('src/features/product/data/launcherSearch.ts')
check('search missing', search.includes('Search'))

const activity = read('src/features/activity/screens/ActivityScreen.tsx')
check('activity read state missing', activity.includes('read'))

check('profile editing missing', read('src/features/profile/screens/EditProfileScreen.tsx').includes('displayName'))
check('follow graph missing', read('services/greenfield-api/src/app/register-routes.ts').includes('/follow'))
check(
  'Board persistence missing',
  read('src/features/product/storage/productPreferencesStorage.ts').includes('boardWidgetIds') &&
    read('services/greenfield-api/src/app/register-routes.ts').includes('/v1/board/layout'),
)
check('module lifecycle missing', read('src/features/modules/screens/ModuleManagementScreen.tsx').includes('Uninstall'))
check('Vault Notes missing', read('scripts/verify-phase7b-vault-notes.mjs').includes('0.2.0'))
check('schema-driven settings missing', read('src/features/modules/components/SchemaSettingsRenderer.tsx').includes('schema'))

const directImports = maybeSh(['rg', '-n', '@expo/ui/(swift-ui|jetpack-compose)', 'src', '--glob', '!src/platform/**'])
check(`direct feature-level SwiftUI/Compose imports:\n${directImports}`, !directImports)

const moduleBoundary = read('docs/architecture/adr/ADR-013-module-execution-boundary.md') + read('docs/architecture/module-host-runtime.md')
check('arbitrary module execution boundary missing', moduleBoundary.includes('Remote HTTP is disabled') || moduleBoundary.includes('remoteHttp'))
check('DIMON must remain inactive', read('docs/audits/phase7c-starting-baseline.md').includes('greenfieldDimon` | false'))
check('AT dependency must remain optional', read('docs/audits/phase7c-starting-baseline.md').includes('atproto` | false'))
const finalReport = read('docs/validation/phase7c-final-report.md')
check('final report must be accepted under revised Phase 7C criteria', /^Status:\s+ACCEPTED\s*$/m.test(finalReport))
check('final report must include deployment record', finalReport.includes('## Deployment Record'))
check('final report must include backup record', finalReport.includes('## Backup Record'))
check('final report must include migration record', finalReport.includes('## Migration Versions'))
check('final report must include live validation record', finalReport.includes('## Live Acceptance'))
check('final report must explicitly block Phase 7D', finalReport.includes('Phase 7D work has not started'))

const status = sh(['git', 'status', '--short'])
check(`working tree is not clean:\n${status}`, status.length === 0)

finish('Phase 7C Founder Alpha verification')
