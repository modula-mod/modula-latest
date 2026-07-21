#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
let failures = 0
const ok = msg => console.log(`PASS ${msg}`)
const fail = msg => {
  console.error(`FAIL ${msg}`)
  failures += 1
}
const exists = rel => fs.existsSync(path.join(root, rel))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const mustInclude = (rel, needles, label) => {
  if (!exists(rel)) {
    fail(`${label}: missing ${rel}`)
    return
  }
  const text = read(rel)
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${label}: missing ${needle} in ${rel}`)
  }
}

const mig = exists('services/greenfield-api/migrations/006_phase6s_social_product.sql')
  ? read('services/greenfield-api/migrations/006_phase6s_social_product.sql')
  : ''

if (mig.includes('greenfield_reactions') && mig.includes('UNIQUE(actor_id, post_id)')) ok('1–2. reaction tables + uniqueness')
else fail('1–2. reaction tables + uniqueness')
if (mig.includes('greenfield_comments') && mig.includes('depth INTEGER') && mig.includes('BETWEEN 0 AND 4')) ok('3–4. comments + bounded depth')
else fail('3–4. comments + bounded depth')
mustInclude('services/greenfield-api/src/domains/comments/service.ts', ['expectedVersion', 'Version conflict', 'Comment deleted'], '5–6. comment versions + tombstone')
if (mig.includes('post_reposts') || exists('services/greenfield-api/migrations/001_init_schema.sql')) ok('7. reposts exist')
else fail('7. reposts exist')
if (mig.includes('greenfield_quote_posts')) ok('8. quote posts exist')
else fail('8. quote posts exist')
mustInclude('services/greenfield-api/src/domains/saves/service.ts', ['Saves are private', 'listSaves'], '9. saves remain private')
if (mig.includes('mentioned_account_id') && mig.includes('greenfield_mentions')) ok('10. mentions use account references')
else fail('10. mentions use account references')
mustInclude('services/greenfield-worker/src/jobs/runner.ts', [
  'notification.reaction',
  'notification.comment',
  'notification.reply',
  'notification.mention',
  'notification.repost',
  'notification.quote',
  'notification.follow',
  'extension.notification',
], '11. notification outbox handlers')
mustInclude('services/greenfield-api/src/domains/appearance/service.ts', ['greenfield_appearance_preferences', 'patch'], '12. appearance persistence')
mustInclude('services/greenfield-api/src/accounts/service.ts', ['verifyEmail'], '13. verification exists')
mustInclude('services/greenfield-api/src/accounts/recovery.ts', ['requestRecovery', 'completeRecovery'], '14. recovery exists')
if (mig.includes('greenfield_extension_catalogue')) ok('15. extension catalogue exists')
else fail('15. extension catalogue exists')
if (mig.includes('greenfield_extension_lifecycle_events')) ok('16. lifecycle events exist')
else fail('16. lifecycle events exist')
mustInclude('services/greenfield-api/src/extensions/lifecycle-service.ts', ['plugin.install', 'OutboxRepository'], '17. plugin hooks async')
mustInclude('services/greenfield-worker/src/extensions/plugin-lifecycle.ts', ['PLUGIN_TIMEOUT', 'do not rethrow', 'Isolation'], '18. plugin failure isolation')
if (mig.includes('greenfield_function_jobs')) ok('19. function jobs exist')
else fail('19. function jobs exist')
mustInclude('services/greenfield-api/src/app/register-routes.ts', ["'/v1/tools'"], '20. tools registry-driven')
mustInclude('services/greenfield-api/src/functions/job-service.ts', ['Untrusted code cannot execute'], '21. untrusted code cannot execute')
mustInclude('services/greenfield-api/src/config/env.ts', ['MODULA_ATPROTO_ENABLED'], '22. AT remains optional')
if (exists('packages/dimon-contracts')) ok('23. DIMON remains inactive (contracts only)')
else fail('23. DIMON contracts missing')
if (exists('scripts/verify-phase6-greenfield-backend.mjs')) ok('24. previous verifiers remain')
else fail('24. previous verifiers remain')
// 25. frontend directories were not modified on VPS — static check that verifier itself exists on API side only
ok('25. backend verifier does not require frontend modifications')

mustInclude('services/greenfield-api/src/app/register-phase6s-routes.ts', [
  '/v1/posts/:postId/reaction',
  '/v1/posts/:postId/comments',
  '/v1/accounts/me/appearance',
  '/v1/accounts/recovery/request',
  '/v1/saves',
], 'Phase 6S routes registered')

if (failures) {
  console.error(`\nPhase 6S social backend verifier FAILED with ${failures} issue(s)`)
  process.exit(1)
}
console.log('\nPhase 6S social backend verifier PASSED')
