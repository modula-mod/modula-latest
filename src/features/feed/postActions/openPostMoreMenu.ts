import type {SocialPost} from '@/domain/social'
import type {ModerationRepository} from '@/data/repositories/contracts'
import {
  buildPostOverflowActions,
  type PostOverflowActionId,
} from '@/features/feed/postActions/catalog'
import {runPostOverflowAction} from '@/features/feed/postActions/runPostAction'
import {presentModulaActions} from '@/platform/ui/menus'

/** Opens the native More / overflow menu for a post. */
export async function openPostMoreMenu(
  post: SocialPost,
  options?: {isOwner?: boolean; moderationRepository?: ModerationRepository},
): Promise<void> {
  const actions = buildPostOverflowActions(post, options)
  const selected = await presentModulaActions({
    title: 'Post options',
    message: `@${post.author.handle}`,
    actions,
  })

  if (!selected) return
  await runPostOverflowAction(
    selected as PostOverflowActionId,
    post,
    options?.moderationRepository
      ? {moderationRepository: options.moderationRepository}
      : undefined,
  )
}
