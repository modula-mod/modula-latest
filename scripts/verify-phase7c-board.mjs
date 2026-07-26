#!/usr/bin/env node
import {check, finish, includes, read} from './phase7c-verifier-utils.mjs'

includes('src/features/board/screens/BoardScreen.tsx', [
  'BoardContributionCard',
  "surface: 'board'",
  'Vault Notes',
  'Product Hub',
  'Saved',
  'Activity',
], 'Board screen')

const preferences = read('src/features/product/storage/productPreferencesStorage.ts')
check('Board widget order persistence missing', preferences.includes('boardWidgetIds'))

const routes = read('services/greenfield-api/src/app/register-routes.ts')
check(
  'account-backed Board layout API must be completed for Founder Alpha',
  routes.includes('/v1/board') || routes.includes('board layout'),
)

finish('Phase 7C board verification')
