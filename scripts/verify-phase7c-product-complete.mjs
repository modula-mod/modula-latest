#!/usr/bin/env node
import {check, finish, includes, read} from './phase7c-verifier-utils.mjs'

includes('docs/audits/phase7c-b-founder-alpha-completion-audit.md', [
  'Phase 7C-B Founder Alpha Completion Audit',
  'Authentication',
  'Home',
  'Discover',
  'Activity',
  'Profile',
  'Board',
  'Product Hub',
  'Settings',
  'Release Blockers',
], 'Phase 7C-B product audit')

for (const rel of [
  'docs/validation/phase7c-after/README.md',
  'docs/validation/phase7c-native-acceptance.md',
  'docs/validation/phase7c-live-acceptance.md',
]) {
  includes(rel, ['Status:', 'Evidence', 'Verification commands'], rel)
}

const notifications =
  read('src/features/settings/screens/SettingsExtraScreens.tsx') +
  read('src/data/repositories/api/ApiActivityRepository.ts') +
  read('services/greenfield-api/src/domains/notifications/preferences.ts') +
  read('services/greenfield-api/src/app/register-routes.ts')
check(
  'notification preferences must be account-backed end to end',
  notifications.includes('/v1/accounts/me/notification-preferences') &&
    notifications.includes('getNotificationPreferences') &&
    notifications.includes('updateNotificationPreferences') &&
    notifications.includes('NotificationPreferencesService'),
)
check(
  'notification settings must not be labelled as local-only',
  !read('src/features/settings/screens/SettingsExtraScreens.tsx').includes('Local preference toggles'),
)

const postWrites = read('services/greenfield-api/src/domains/posts/writes.ts')
const metadata = read('packages/api-contracts/src/metadata.ts')
check(
  'media publishing remains incomplete: backend post writer does not persist input.media',
  postWrites.includes('input.media') && !postWrites.includes("kind: 'text'"),
)
check(
  'media upload capability remains disabled',
  metadata.includes('PHASE6_PREVIEW_CAPABILITIES') &&
    metadata.includes('mediaUpload: true'),
)

const discover =
  read('src/features/discover/screens/DiscoverScreen.tsx') +
  read('src/features/discover/data/useDiscoverQuery.ts') +
  read('src/data/repositories/api/ApiDiscoverRepository.ts')
check(
  'Discover search must use Greenfield search API, not only local payload filtering',
  discover.includes('useDiscoverSearchQuery') &&
    discover.includes('useInfiniteQuery') &&
    discover.includes('/v1/search'),
)

finish('Phase 7C product completeness verification')
