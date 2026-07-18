import type {ReelItem} from '@/domain/discovery'
import {
  buildReelOverflowActions,
  type ReelOverflowActionId,
} from '@/features/reels/reelActions/catalog'
import {runReelOverflowAction} from '@/features/reels/reelActions/runReelAction'
import {presentModulaActions} from '@/platform/ui/menus'

/**
 * Imperative ActionSheet overflow (Android / non-Menu hosts).
 * Prefer ModulaMenu / ModulaContextMenu on the Reels surface.
 */
export async function openReelMoreMenu(
  reel: ReelItem,
  ownerProfileId = '',
): Promise<ReelOverflowActionId | null> {
  const actions = buildReelOverflowActions(reel)
  const selected = await presentModulaActions({
    title: 'Reel options',
    message: `@${reel.author.handle}`,
    actions,
  })

  if (!selected) return null
  const actionId = selected as ReelOverflowActionId
  await runReelOverflowAction(actionId, reel, ownerProfileId)
  return actionId
}
