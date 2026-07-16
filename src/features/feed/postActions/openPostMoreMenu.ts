import type {SocialPost} from '@/domain/social'
import {
  buildPostOverflowActions,
  type PostOverflowActionId,
} from '@/features/feed/postActions/catalog'
import {runPostOverflowAction} from '@/features/feed/postActions/runPostAction'
import {presentModulaActions} from '@/platform/ui/menus'

/** Opens the native More / overflow menu for a post. */
export async function openPostMoreMenu(post: SocialPost): Promise<void> {
  const actions = buildPostOverflowActions(post)
  const selected = await presentModulaActions({
    title: 'Post options',
    message: `@${post.author.handle}`,
    actions,
  })

  if (!selected) return
  await runPostOverflowAction(selected as PostOverflowActionId, post)
}
