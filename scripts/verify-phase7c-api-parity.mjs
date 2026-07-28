#!/usr/bin/env node
import {check, finish, includes, read} from './phase7c-verifier-utils.mjs'

const routes =
  read('services/greenfield-api/src/app/register-routes.ts') +
  read('services/greenfield-api/src/app/register-phase6s-routes.ts') +
  read('services/greenfield-api/src/modules/routes/index.ts')

for (const endpoint of [
  '/v1/accounts/register',
  '/v1/accounts/verify-email',
  '/v1/accounts/recovery/request',
  '/v1/sessions',
  '/v1/sessions/refresh',
  '/v1/sessions/current',
  '/v1/feed/home',
  '/v1/posts',
  '/v1/posts/:postId/comments',
  '/v1/comments/:commentId/replies',
  '/v1/posts/:postId/reactions',
  '/v1/posts/:postId/repost',
  '/v1/posts/:postId/quote',
  '/v1/posts/:postId/save',
  '/v1/saves',
  '/v1/search',
  '/v1/notifications',
  '/v1/notifications/:notificationId/read',
  '/v1/notifications/read-all',
  '/v1/accounts/me/notification-preferences',
  '/v1/profiles/:handle',
  '/v1/profiles/me',
  '/v1/profiles/:profileId/follow',
  '/v1/board/layout',
]) {
  check(`Greenfield route missing ${endpoint}`, routes.includes(endpoint))
}

includes('src/data/repositories/api/ApiActivityRepository.ts', [
  '/v1/notifications',
  '/v1/accounts/me/notification-preferences',
], 'activity and notification client')

includes('src/data/repositories/api/ApiPostRepository.ts', [
  '/v1/posts',
  '/v1/saves',
], 'post client')

includes('src/data/repositories/api/ApiProductPreferencesRepository.ts', [
  '/v1/board/layout',
], 'board layout client')

const searchRoute = read('services/greenfield-api/src/app/register-routes.ts')
const searchContract = read('packages/api-contracts/src/search.ts')
check(
  'search pagination is not exposed in SearchResultDto',
  searchContract.includes('nextCursor') && searchContract.includes('hasMore'),
)
check(
  'search route does not accept cursor for pagination',
  searchRoute.includes('query.cursor') && searchRoute.includes('decodeCursor(query.cursor)'),
)

const postWrites = read('services/greenfield-api/src/domains/posts/writes.ts')
check(
  'composer media has no backend upload/persistence parity',
  postWrites.includes('input.media') && postWrites.includes('post_media'),
)

finish('Phase 7C API parity verification')
