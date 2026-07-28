import type {ReelItem} from '@/domain/discovery'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

export type ReelOverflowActionId =
  | 'share'
  | 'copyLink'
  | 'copyCaption'
  | 'save'
  | 'seeMore'
  | 'seeLess'
  | 'notInterested'
  | 'whyThis'
  | 'yourAlgorithm'
  | 'viewProfile'
  | 'shareProfile'
  | 'muteAuthor'
  | 'remix'
  | 'report'

export type ReelChromeActionId =
  | 'yourAlgorithm'
  | 'editInterests'
  | 'contentPrefs'
  | 'muteWords'
  | 'political'
  | 'sensitive'
  | 'friendsOnly'
  | 'compose'
  | 'goBack'

export function getReelPermalink(reel: ReelItem): string {
  return `https://modula.digital/reels/${encodeURIComponent(reel.id)}`
}

export function getReelShareMessage(reel: ReelItem): string {
  const caption = reel.caption.trim()
  const lead = caption.length > 0 ? caption : `Reel by @${reel.author.handle}`
  return `${lead}\n${getReelPermalink(reel)}`
}

/** Per-reel overflow for ModulaMenu / ModulaContextMenu. */
export function buildReelOverflowActions(reel: ReelItem): ModulaActionItem[] {
  return [
    {id: 'seeMore', label: 'See more like this'},
    {id: 'seeLess', label: 'See less like this'},
    {id: 'share', label: 'Share reel'},
    {id: 'save', label: 'Save'},
    {id: 'copyLink', label: 'Copy link'},
    {
      id: 'copyCaption',
      label: 'Copy caption',
      disabled: !reel.caption.trim(),
      disabledReason: 'No caption',
    },
    {id: 'remix', label: 'Remix'},
    {id: 'whyThis', label: 'Why am I seeing this?'},
    {id: 'yourAlgorithm', label: 'Your algorithm'},
    {id: 'viewProfile', label: `View @${reel.author.handle}`},
    {id: 'shareProfile', label: 'Share creator'},
    {id: 'notInterested', label: 'Not interested'},
    {id: 'muteAuthor', label: 'Mute creator'},
    {id: 'report', label: 'Report', style: 'destructive'},
  ]
}

/** Header ··· menu on the Reels feed. */
export function buildReelHeaderMoreActions(): ModulaActionItem[] {
  return [
    {id: 'yourAlgorithm', label: 'Your algorithm'},
    {id: 'political', label: 'Political content'},
    {id: 'sensitive', label: 'Sensitive content'},
    {id: 'contentPrefs', label: 'More content preferences'},
    {id: 'editInterests', label: 'Edit interests'},
    {id: 'muteWords', label: 'Mute words'},
    {id: 'goBack', label: 'Close reels'},
  ]
}

/** Header filter / controls menu on the Reels feed. */
export function buildReelHeaderFilterActions(
  mode: 'reels' | 'friends',
): ModulaActionItem[] {
  return [
    {
      id: 'friendsOnly',
      label: mode === 'friends' ? 'Show all reels' : 'Friends only',
    },
    {id: 'yourAlgorithm', label: 'Your algorithm'},
    {id: 'editInterests', label: 'Edit interests'},
    {id: 'contentPrefs', label: 'Content & media'},
    {id: 'compose', label: 'Create'},
  ]
}

/** ··· menu on Your algorithm. */
export function buildAlgorithmMoreActions(): ModulaActionItem[] {
  return [
    {id: 'political', label: 'Political content'},
    {id: 'sensitive', label: 'Sensitive content'},
    {id: 'contentPrefs', label: 'More content preferences'},
    {id: 'editInterests', label: 'Edit interests'},
    {id: 'learn', label: 'Learn more about your algorithm'},
  ]
}
