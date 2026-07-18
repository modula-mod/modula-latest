import type {ReelItem} from '@/domain/discovery'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

export type ReelOverflowActionId =
  | 'share'
  | 'copyLink'
  | 'copyCaption'
  | 'save'
  | 'notInterested'
  | 'viewProfile'
  | 'shareProfile'
  | 'muteAuthor'
  | 'translateCaption'
  | 'report'

export function getReelPermalink(reel: ReelItem): string {
  return `https://modula.digital/reels/${encodeURIComponent(reel.id)}`
}

export function getReelShareMessage(reel: ReelItem): string {
  const caption = reel.caption.trim()
  const lead = caption.length > 0 ? caption : `Reel by @${reel.author.handle}`
  return `${lead}\n${getReelPermalink(reel)}`
}

/** Overflow actions for ModulaMenu / ModulaContextMenu (and ActionSheet fallback). */
export function buildReelOverflowActions(reel: ReelItem): ModulaActionItem[] {
  return [
    {id: 'share', label: 'Share reel'},
    {id: 'copyLink', label: 'Copy link'},
    {
      id: 'copyCaption',
      label: 'Copy caption',
      disabled: !reel.caption.trim(),
      disabledReason: 'No caption',
    },
    {id: 'save', label: 'Save'},
    {id: 'notInterested', label: 'Not interested'},
    {id: 'viewProfile', label: `View @${reel.author.handle}`},
    {id: 'shareProfile', label: 'Share creator'},
    {
      id: 'translateCaption',
      label: 'Translate caption',
      disabled: !reel.caption.trim(),
      disabledReason: 'No caption',
    },
    {id: 'muteAuthor', label: 'Mute creator'},
    {id: 'report', label: 'Report', style: 'destructive'},
  ]
}
