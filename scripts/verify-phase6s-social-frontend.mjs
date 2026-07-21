#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
let failures = 0
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const check = (file, needles, label) => {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`FAIL ${label}: missing ${file}`)
    failures += 1
    return
  }
  const text = read(file)
  const missing = needles.filter(needle => !text.includes(needle))
  if (missing.length) {
    console.error(`FAIL ${label}: missing ${missing.join(', ')}`)
    failures += 1
  } else {
    console.log(`PASS ${label}`)
  }
}

check('src/features/feed/FeedPostRow.tsx', ['FeedPostRow'], 'shared post renderer')
check('src/features/social/data/useReactionMutation.ts', ['/reaction'], 'reactions')
check('src/features/social/data/useCommentsQuery.ts', ['/comments', '/replies'], 'comments and depth')
check('src/features/social/components/post-actions.tsx', ['repost'], 'repost actions')
check('src/features/social/components/comment-preview.tsx', ['comment.depth'], 'comment depth')
check('src/features/composer/screens/ComposerScreen.tsx', ['draft'], 'draft-capable composer')
check('src/features/saved/screens/SavedPostsScreen.tsx', ['useCapability', 'saved:manage'], 'private saved posts')
check('src/features/activity/screens/ActivityScreen.tsx', [
  'Replies', 'Mentions', 'Reactions', 'Follows', 'Extensions', 'System', 'markAllRead',
], 'notification filters and read actions')
check('src/features/profile/screens/EditProfileScreen.tsx', ['save'], 'profile editing')
check('src/theme/runtime/AppearanceProvider.tsx', ['appearanceRepository', 'reduceTransparency'], 'appearance sync and transparency')
check('src/data/repositories/api/ApiExtensionRepository.ts', ['/v1/extensions/catalogue', '/install', '/enable', '/disable'], 'extension catalogue lifecycle')
check('src/components/composer/ComposerToolsDrawer.tsx', ['listComposerTools'], 'tools registry')
check('src/features/atproto/screens/ConnectionsScreen.tsx', ['Optional'], 'optional AT Protocol')
check('src/features/settings/screens/DimonPlaceholderScreen.tsx', ['DIMON is not active yet'], 'inactive DIMON')
check('src/features/settings/screens/ExtensionCentreScreen.tsx', ['separate repositories'], 'external module boundary')

if (failures) {
  console.error(`\n${failures} Phase 6S social frontend check(s) failed.`)
  process.exit(1)
}
console.log('\nAll Phase 6S social frontend checks passed.')
