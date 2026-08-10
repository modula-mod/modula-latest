import * as Clipboard from 'expo-clipboard'
import {router, type Href} from 'expo-router'
import {Alert} from 'react-native'

import type {SocialPost} from '@/domain/social'
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
      const permalink = getPostPermalink(post)
      const message = getPostShareMessage(post)
      router.push(
        `/share?permalink=${encodeURIComponent(permalink)}&message=${encodeURIComponent(message)}&title=${encodeURIComponent('Share post')}` as Href,
      )
      return
    }
    case 'saveToVault': {
      const permalink = getPostPermalink(post)
      const title = post.text?.trim().split('\n')[0]?.slice(0, 80) || `Post by ${post.author.displayName}`
      router.push(
        `/module/digital.modula.vault-notes/note-editor?postId=${encodeURIComponent(post.id)}&sourceUri=${encodeURIComponent(permalink)}&title=${encodeURIComponent(title)}` as Href,
      )
      return
    }
    case 'quote': {
      router.push(`/compose?quotePostId=${encodeURIComponent(post.id)}` as Href)
      return
    }
    case 'edit': {
      if (typeof post.version !== 'number') {
        Alert.alert('Edit post', 'This post cannot be edited yet (missing version).')
        return
      }
      router.push(
        `/compose?editPostId=${encodeURIComponent(post.id)}&expectedVersion=${post.version}` as Href,
      )
      return
    }
    case 'delete': {
      Alert.alert('Delete post', 'Delete this post permanently?', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            router.push(`/post/${post.id}?confirmDelete=1` as Href)
          },
        },
      ])
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
