#!/usr/bin/env node
import {check, finish, includes, read} from './phase7c-verifier-utils.mjs'

includes('src/features/profile/components/ProfileShell.tsx', [
  'resolveProfileTabs',
  'profile.moduleRuntime',
  "surface: 'profileTab'",
], 'profile shell')

includes('src/features/profile/registry/createCoreProfileTabs.ts', [
  'posts',
  'media',
  'about',
  'modules',
  'links',
], 'core profile tabs')

includes('src/features/profile/screens/EditProfileScreen.tsx', [
  'displayName',
  'bio',
  'website',
], 'profile editor')

const routes = read('services/greenfield-api/src/app/register-routes.ts')
for (const path of ['/v1/profiles/me', '/v1/profiles/:handle', '/followers', '/following', '/follow']) {
  check(`profile/follow route missing ${path}`, routes.includes(path))
}

check('profile editor must expose cover editing', read('src/features/profile/screens/EditProfileScreen.tsx').includes('cover'))
check('profile editor must expose visibility preview', read('src/features/profile/screens/EditProfileScreen.tsx').includes('preview'))

finish('Phase 7C profile verification')
