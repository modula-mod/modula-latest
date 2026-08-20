#!/usr/bin/env node
/**
 * Phase 7M-B7 source gate.
 *
 * This verifier deliberately does not turn browser, deployment, or visual review
 * into source-only PASS claims. Those gates are recorded separately after an
 * exact-SHA production build.
 */
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const failures = []

function file(name) {
  return path.join(root, name)
}

function read(name) {
  if (!existsSync(file(name))) return ''
  return readFileSync(file(name), 'utf8')
}

function record(label, ok, detail = '') {
  console.log(`${label.padEnd(34)} ${ok ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ''}`)
}

function contains(name, needle, label) {
  const source = read(name)
  record(label, source.includes(needle), source ? `source=${name}` : `missing ${name}`)
}

function absent(name, needle, label) {
  const source = read(name)
  record(label, Boolean(source) && !source.includes(needle), source ? `source=${name}` : `missing ${name}`)
}

function countFiles(directory, predicate) {
  let count = 0
  for (const entry of readdirSync(file(directory))) {
    const relative = path.join(directory, entry)
    if (statSync(file(relative)).isDirectory()) count += countFiles(relative, predicate)
    else if (predicate(relative)) count += 1
  }
  return count
}

console.log('Phase 7M-B7 source verifier\n')

console.log('# Inventory and design')
const routeFiles = countFiles('src/app', name => name.endsWith('.tsx') && !name.endsWith('_layout.tsx'))
record('FULL ROUTE INVENTORY', routeFiles >= 120, `${routeFiles} Expo Router screens`)
contains('docs/validation/phase7m-b7-full-route-audit.md', '| Route | Screenshot | Source SHA |', 'ROUTE AUDIT')
contains('docs/design/post-v2-reference-map.md', 'ONE SURFACE', 'FOUNDER REFERENCE MAP')
contains('docs/research/phase7m-b6-overlay-classification.md', 'Post context actions', 'OVERLAY INVENTORY')

console.log('\n# Auth')
contains('src/auth/screens/WelcomeScreen.tsx', 'WelcomeIdentityField', 'WELCOME')
absent('src/auth/screens/WelcomeScreen.tsx', 'Accounts are owned by Greenfield', 'NO INTERNAL WELCOME COPY')
contains('src/auth/screens/VerifyEmailScreen.tsx', 'maskedEmail', 'VERIFY CONTEXT')
contains('src/auth/screens/VerifyEmailScreen.tsx', 'RESEND_SECONDS', 'VERIFY RESEND')
contains('src/auth/screens/VerifyEmailScreen.tsx', 'useHydrated', 'VERIFY HYDRATION')
contains('src/platform/ui/controls/modula-otp-field.tsx', 'textContentType="oneTimeCode"', 'OTP AUTOFILL')

console.log('\n# Post Experience V2')
for (const [label, name] of [
  ['POST TEXT', 'text-post-renderer.tsx'],
  ['POST IMAGE', 'image-post-renderer.tsx'],
  ['POST CAROUSEL', 'carousel-post-renderer.tsx'],
  ['POST VIDEO', 'video-post-renderer.tsx'],
  ['POST MUSIC UI', 'music-post-renderer.tsx'],
]) {
  record(label, existsSync(file(`src/features/social/posts/renderers/${name}`)))
}
contains('src/features/social/posts/components/post-shell.tsx', "presentation?: 'feed' | 'detail'", 'ONE POST SHELL')
contains('src/features/feed/screens/PostDetailScreen.tsx', 'presentation="detail"', 'DETAIL USES POST SHELL')
absent('src/features/feed/screens/PostDetailScreen.tsx', 'CommentComposer', 'NO DUPLICATE COMPOSER')
contains('src/features/social/posts/components/post-action-rail.tsx', 'Open post menu', 'WEB CONTEXT MENU')
contains('src/features/social/posts/components/post-action-rail.tsx', 'canStartReaction', 'REACTION STATE GATE')
contains('src/features/social/posts/components/post-action-rail.tsx', 'canOpenContext', 'CONTEXT STATE GATE')
contains('src/features/social/posts/components/post-shell.tsx', 'canOpenComments', 'COMMENTS STATE GATE')
contains('src/features/social/posts/interactions/reaction-picker.tsx', 'reactionIndexFromX', 'HORIZONTAL SELECTION')
contains('src/features/social/posts/renderers/carousel-post-renderer.tsx', 'CONTROLLED_MEDIA_FALLBACKS', 'CONTROLLED CAROUSEL MEDIA')
contains('src/features/social/posts/interactions/reaction-picker.tsx', "event.key !== 'Escape'", 'REACTION KEYBOARD')
contains('src/features/social/posts/interactions/media-full-player.tsx', 'presentationStyle="fullScreen"', 'VIDEO FULL PLAYER')
contains('src/platform/ui/video/modula-reel-player.tsx', 'useVideoPlayer', 'WEB VIDEO')
absent('src/features/social/posts/types/resolve-post-content.ts', "includes('city lights')", 'NO FAKE MUSIC HEURISTIC')

console.log('\n# Reactions and comments')
const reactionContract = read('packages/greenfield-contracts/src/reaction.ts')
const reactionUi = read('src/features/social/posts/state/post-interaction-types.ts')
for (const reaction of ['like', 'love', 'laugh', 'fire', 'celebrate', 'insightful', 'support', 'curious']) {
  record(`REACTION ${reaction.toUpperCase()}`, reactionContract.includes(`'${reaction}'`) && reactionUi.includes(`'${reaction}'`))
}
contains('src/api/local/LocalApiRouter.ts', 'createCommentRoutes', 'COMMENTS API')
contains('src/api/local/routes/commentRoutes.ts', "path: '/v1/posts/:postId/comments'", 'COMMENTS ROUTE')
contains('src/api/local/seedLocalApiDatabase.ts', 'comment-local-bali-1', 'COMMENTS FIXTURE')
contains('src/features/social/posts/interactions/comments-surface.tsx', "Comments couldn&apos;t load.", 'COMMENTS FALLBACK')
contains('src/features/social/posts/interactions/comments-surface.tsx', 'post-comments-sheet', 'COMMENTS DRAWER')
contains('src/features/social/posts/interactions/comments-surface.tsx', 'Write a comment', 'COMMENT COMPOSER')
contains('src/features/social/posts/interactions/comments-surface.tsx', "event.key !== 'Escape'", 'COMMENTS KEYBOARD')

console.log('\n# Regression surfaces')
contains('src/features/modules/screens/ProductHubMarketplaceScreen.tsx', 'FEATURED', 'PRODUCT HUB')
absent('src/features/modules/hooks/useModuleQueries.ts', "enabled: session.status === 'signedIn',\n    queryFn: () => moduleRepository.listCatalogue", 'PUBLIC MODULE CATALOGUE')
contains('src/data/repositories/api/ApiModuleRepository.ts', 'if (!options.includeInstalled) return filterCatalogue(remote, input)', 'PUBLIC REGISTRY FALLBACK')
contains('src/features/modules/runtime/module-host.tsx', 'if (detail.isPending) return', 'PUBLIC MODULE DETAIL')
contains('src/features/marketplace/screens/ModuleDetailScreen.tsx', 'module-sticky-install', 'INSTALL CTA')
contains('src/platform/ui/sheets/modula-sheet-layout.tsx', 'fixed above safe area', 'FIXED SHEET ACTION')
record('VAULT NOTES', existsSync(file('scripts/verify-vault-notes-canonical.mjs')))
contains('src/app/module/[moduleId]/index.tsx', 'useHydrated', 'MODULE HYDRATION')
contains('src/components/system/NotFoundScreen.tsx', 'useHydrated', 'NOT FOUND HYDRATION')
contains('src/components/system/HydratedRouteBoundary.tsx', 'useHydrated', 'ROUTE HYDRATION BOUNDARY')
contains('src/app/discover/feeds.tsx', 'HydratedRouteBoundary', 'DISCOVER SHEET HYDRATION')
contains('src/app/messages/index.tsx', 'HydratedRouteBoundary', 'MESSAGES HYDRATION')
contains('src/app/saved.tsx', 'HydratedRouteBoundary', 'SAVED HYDRATION')
contains('src/app/share.tsx', 'HydratedRouteBoundary', 'SHARE HYDRATION')
contains('src/app/product/intelligence/[slug].tsx', 'HydratedRouteBoundary', 'DYNAMIC PRODUCT HYDRATION')
contains('scripts/resolve-web-dist-file.mjs', "'+not-found.html'", 'NOT FOUND ROUTING')
contains('ops/nginx/modula.digital-web.conf.snippet', 'location = /index', 'CANONICAL HOME REDIRECT')
contains('scripts/serve-web-dist.mjs', "requestUrl.pathname === '/index'", 'LOCAL HOME REDIRECT')
contains('tests/phase7m-b7-web.test.ts', 'collectCriticalEvents', 'BROWSER ERROR GATE')

const diffCheck = spawnSync('git', ['diff', '--check'], {cwd: root, encoding: 'utf8'})
record('GIT DIFF CHECK', diffCheck.status === 0, diffCheck.stderr.trim())

console.log('\n# Deferred exact-SHA runtime gates')
console.log('BROWSER / VISUAL / PUBLIC / EVIDENCE   DEFERRED UNTIL DEPLOYMENT')
console.log('MUSIC PERSISTENCE                     NOT EXPOSED — NO AUDIO CONTRACT')
console.log('DATABASE MIGRATION                    NONE')
console.log('7M-C                                  NOT STARTED')

if (failures.length) {
  console.error(`\nPhase 7M-B7 source verifier failed (${failures.length}):`)
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('\nPhase 7M-B7 source gate passed.')
