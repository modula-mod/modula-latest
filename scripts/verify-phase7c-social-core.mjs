#!/usr/bin/env node
import {check, finish, includes, read} from './phase7c-verifier-utils.mjs'

includes('src/features/feed/screens/HomeFeedScreen.tsx', [
  'Following',
  'For You',
  'Modules',
], 'Home feed modes')

includes('src/domain/social/SocialPost.ts', [
  'author',
  'viewer',
  'reaction',
  'quotedPost',
], 'social post contract')

includes('src/features/social/components/reaction-control.tsx', [
  'Like',
  'Celebrate',
  'Insightful',
  'Support',
  'Curious',
], 'reaction control')

const postActions = read('src/features/feed/postActions/catalog.ts') + read('src/features/feed/postActions/runPostAction.ts')
for (const action of ['reply', 'react', 'repost', 'quote', 'save', 'share', 'saveToVault']) {
  check(`post action missing ${action}`, postActions.includes(action))
}

const routes = read('services/greenfield-api/src/app/register-routes.ts')
for (const path of [
  '/v1/posts',
  '/v1/feed/home',
  '/v1/search',
  '/v1/notifications',
  '/v1/profiles',
]) {
  check(`Greenfield route missing ${path}`, routes.includes(path))
}

check(
  'comments/replies backend must be completed for Founder Alpha',
  routes.includes('/v1/posts/:postId/comments') || routes.includes('/v1/comments'),
)
check(
  'multi-reaction backend must be completed for Founder Alpha',
  routes.includes('/reactions') && routes.includes('reactionType'),
)
check(
  'account-backed saved list must be completed for Founder Alpha',
  routes.includes('/v1/saves') || routes.includes('/v1/accounts/me/saves'),
)

finish('Phase 7C social core verification')
