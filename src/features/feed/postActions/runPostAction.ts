import * as Clipboard from 'expo-clipboard'
import {router, type Href} from 'expo-router'
import {Alert, Share} from 'react-native'

import type {SocialPost} from '@/domain/social'
import {
  formatTranslatePreviewMessage,
  previewTranslatePostText,
} from '@/features/translate'
import {
  getPostPermalink,
  getPostShareMessage,
  inferPostLinkUrl,
  type PostOverflowActionId,
} from '@/features/feed/postActions/catalog'
import {openSafeExternalUrl} from '@/lib/safeExternalUrl'
import {selectionHaptic} from '@/lib/haptics'

export async function runPostOverflowAction(
  actionId: PostOverflowActionId,
  post: SocialPost,
): Promise<void> {
  void selectionHaptic()

  switch (actionId) {
    case 'translate': {
      const result = previewTranslatePostText(post.text ?? '')
      Alert.alert('Translate (Preview)', formatTranslatePreviewMessage(result))
      return
    }
    case 'copyText': {
      const text = post.text?.trim()
      if (!text) {
        Alert.alert('Copy text', 'This post has no text to copy.')
        return
      }
      await Clipboard.setStringAsync(text)
      Alert.alert('Copied', 'Post text copied to the clipboard.')
      return
    }
    case 'copyLink': {
      await Clipboard.setStringAsync(getPostPermalink(post))
      Alert.alert('Copied', 'Post link copied to the clipboard.')
      return
    }
    case 'share': {
      try {
        await Share.share({
          message: getPostShareMessage(post),
          url: getPostPermalink(post),
        })
      } catch {
        Alert.alert('Share unavailable', getPostShareMessage(post))
      }
      return
    }
    case 'quote': {
      Alert.alert(
        'Quote (Preview)',
        'Quote drafts will open in Composer in a later phase. Your selection is local-only for now.',
      )
      return
    }
    case 'viewEngagement': {
      router.push(`/post/${post.id}/analytics` as Href)
      return
    }
    case 'openInBrowser': {
      if (post.kind !== 'link') return
      await openSafeExternalUrl(inferPostLinkUrl(post.link.domain))
      return
    }
    case 'mute': {
      router.push('/settings/mute-words' as Href)
      return
    }
    case 'hide': {
      Alert.alert(
        'Hide post (Preview)',
        'Hiding posts is a local preview. The feed will not permanently remove this item yet.',
      )
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
