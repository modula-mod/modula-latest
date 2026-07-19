import * as Clipboard from 'expo-clipboard'
import {router, type Href} from 'expo-router'
import {Alert} from 'react-native'

import type {ReelItem} from '@/domain/discovery'
import {
  getReelPermalink,
  getReelShareMessage,
  type ReelChromeActionId,
  type ReelOverflowActionId,
} from '@/features/reels/reelActions/catalog'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {shareProfile} from '@/features/profile/services/shareProfile'
import {
  formatTranslatePreviewMessage,
  previewTranslatePostText,
} from '@/features/translate'
import {selectionHaptic} from '@/lib/haptics'

export async function runReelOverflowAction(
  actionId: ReelOverflowActionId,
  reel: ReelItem,
  ownerProfileId = '',
): Promise<void> {
  void selectionHaptic()

  switch (actionId) {
    case 'share': {
      const permalink = getReelPermalink(reel)
      const message = getReelShareMessage(reel)
      router.push(
        `/share?permalink=${encodeURIComponent(permalink)}&message=${encodeURIComponent(message)}&title=${encodeURIComponent('Share reel')}` as Href,
      )
      return
    }
    case 'copyLink': {
      await Clipboard.setStringAsync(getReelPermalink(reel))
      Alert.alert('Copied', 'Reel link copied to the clipboard.')
      return
    }
    case 'copyCaption': {
      const caption = reel.caption.trim()
      if (!caption) {
        Alert.alert('Copy caption', 'This reel has no caption.')
        return
      }
      await Clipboard.setStringAsync(caption)
      Alert.alert('Copied', 'Caption copied to the clipboard.')
      return
    }
    case 'save': {
      Alert.alert(
        'Save reel (Preview)',
        'Saved reels will sync once the collections API lands. Local preview only for now.',
      )
      return
    }
    case 'seeMore': {
      Alert.alert(
        'See more like this (Preview)',
        'Interest boost is local for this session. Ranking feedback is not persisted yet.',
      )
      return
    }
    case 'seeLess':
    case 'notInterested': {
      Alert.alert(
        actionId === 'seeLess' ? 'See less (Preview)' : 'Not interested (Preview)',
        'This hides the reel locally for this session preview. Ranking feedback is not persisted yet.',
      )
      return
    }
    case 'whyThis': {
      Alert.alert(
        'Why am I seeing this? (Preview)',
        `Suggested from activity around “${reel.source}” and creators like @${reel.author.handle}. Full ranking explanations land with the algorithm API.`,
      )
      return
    }
    case 'yourAlgorithm': {
      router.push('/reels/algorithm' as Href)
      return
    }
    case 'remix': {
      Alert.alert(
        'Remix (Preview)',
        'Remix and stitch land with the creator studio. Local preview only for now.',
      )
      return
    }
    case 'viewProfile': {
      router.push(getProfileRouteForIdentity(reel.author, ownerProfileId) as Href)
      return
    }
    case 'shareProfile': {
      await shareProfile(reel.author)
      return
    }
    case 'translateCaption': {
      const result = previewTranslatePostText(reel.caption ?? '')
      Alert.alert('Translate (Preview)', formatTranslatePreviewMessage(result))
      return
    }
    case 'muteAuthor': {
      router.push('/settings/mute-words' as Href)
      return
    }
    case 'report': {
      router.push('/report' as Href)
      return
    }
    default: {
      const _exhaustive: never = actionId
      return _exhaustive
    }
  }
}

export type RunReelChromeActionOptions = {
  onToggleFriends?: () => void
  onGoBack?: () => void
  onPolitical?: () => void
  onSensitive?: () => void
  onLearn?: () => void
}

/** Header / algorithm chrome menus (not per-reel). */
export function runReelChromeAction(
  actionId: string,
  options: RunReelChromeActionOptions = {},
): void {
  void selectionHaptic()
  const id = actionId as ReelChromeActionId | 'learn'

  switch (id) {
    case 'yourAlgorithm':
      router.push('/reels/algorithm' as Href)
      return
    case 'editInterests':
      router.push('/discover/interests' as Href)
      return
    case 'contentPrefs':
      router.push('/settings/content' as Href)
      return
    case 'muteWords':
      router.push('/settings/mute-words' as Href)
      return
    case 'compose':
      router.push('/compose' as Href)
      return
    case 'friendsOnly':
      options.onToggleFriends?.()
      return
    case 'goBack':
      options.onGoBack?.()
      return
    case 'political':
      options.onPolitical?.()
      return
    case 'sensitive':
      options.onSensitive?.()
      return
    case 'learn':
      options.onLearn?.()
      return
    default:
      return
  }
}
