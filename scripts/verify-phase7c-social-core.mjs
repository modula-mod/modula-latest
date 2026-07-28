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

const postActions =
  read('src/features/feed/postActions/catalog.ts') +
  read('src/features/feed/postActions/runPostAction.ts') +
  read('src/features/social/components/post-actions.tsx') +
  read('src/features/social/components/reaction-control.tsx')
for (const [action, proof] of [
  ['reply', 'Reply'],
  ['react', 'ReactionControl'],
  ['repost', 'useRepostMutation'],
  ['quote', 'quote'],
  ['save', 'useSavePostMutation'],
  ['share', 'share'],
  ['saveToVault', 'saveToVault'],
]) {
  check(`post action missing ${action}`, postActions.includes(proof))
}

const routes =
  read('services/greenfield-api/src/app/register-routes.ts') +
  read('services/greenfield-api/src/app/register-phase6s-routes.ts')
const reactionService = read('services/greenfield-api/src/domains/reactions/service.ts')
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
  routes.includes('/v1/posts/:postId/comments') && routes.includes('/v1/comments/:commentId/replies'),
)
check(
  'multi-reaction backend must be completed for Founder Alpha',
  routes.includes('/v1/posts/:postId/reactions') && reactionService.includes('reaction_type'),
)
check(
  'account-backed saved list must be completed for Founder Alpha',
  routes.includes('/v1/saves') || routes.includes('/v1/accounts/me/saves'),
)

finish('Phase 7C social core verification')
