import * as Clipboard from 'expo-clipboard'
import {router, type Href} from 'expo-router'
import {Alert} from 'react-native'

import type {ReelItem} from '@/domain/discovery'
import {
  getReelPermalink,
  getReelShareMessage,
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
    case 'notInterested': {
      Alert.alert(
        'Not interested (Preview)',
        'This hides the reel locally for this session preview. Ranking feedback is not persisted yet.',
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
