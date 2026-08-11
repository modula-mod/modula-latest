import * as Clipboard from 'expo-clipboard'
import {router, type Href} from 'expo-router'
import {Alert} from 'react-native'

import type {SocialPost} from '@/domain/social'
import type {ModerationRepository} from '@/data/repositories/contracts'
import {
  getPostPermalink,
  getPostShareMessage,
  inferPostLinkUrl,
  type PostOverflowActionId,
} from '@/features/feed/postActions/catalog'
import {openSafeExternalUrl} from '@/lib/safeExternalUrl'
import {selectionHaptic} from '@/lib/haptics'
import {parseProfileId} from '@/api/contracts'

export type PostOverflowActionDeps = {
  moderationRepository: ModerationRepository
}

function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(title, message, [
      {text: 'Cancel', style: 'cancel', onPress: () => resolve(false)},
      {text: confirmLabel, style: 'destructive', onPress: () => resolve(true)},
    ])
  })
}

export async function runPostOverflowAction(
  actionId: PostOverflowActionId,
  post: SocialPost,
  deps?: PostOverflowActionDeps,
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
      if (!deps?.moderationRepository) {
        Alert.alert('Mute', 'Moderation services are unavailable.')
        return
      }
      const confirmed = await confirmAction(
        'Mute account',
        `Mute @${post.author.handle}? Their posts will be hidden from your feeds where Greenfield applies mutes.`,
        'Mute',
      )
      if (!confirmed) return
      try {
        await deps.moderationRepository.muteProfile(parseProfileId(post.author.id))
        Alert.alert('Muted', `@${post.author.handle} is muted.`)
      } catch (error) {
        Alert.alert(
          'Mute failed',
          error instanceof Error ? error.message : 'Could not mute this account.',
        )
      }
      return
    }
    case 'block': {
      if (!deps?.moderationRepository) {
        Alert.alert('Block', 'Moderation services are unavailable.')
        return
      }
      const confirmed = await confirmAction(
        'Block account',
        `Block @${post.author.handle}? You will stop seeing each other where Greenfield applies blocks.`,
        'Block',
      )
      if (!confirmed) return
      try {
        await deps.moderationRepository.blockProfile(parseProfileId(post.author.id))
        Alert.alert('Blocked', `@${post.author.handle} is blocked.`)
      } catch (error) {
        Alert.alert(
          'Block failed',
          error instanceof Error ? error.message : 'Could not block this account.',
        )
      }
      return
    }
    case 'hide': {
      Alert.alert(
        'Hide post unavailable',
        'Hiding individual posts is not available yet. Mute or block the author instead.',
      )
      return
    }
    case 'report': {
      router.push(
        `/report?targetType=post&targetId=${encodeURIComponent(post.id)}` as Href,
      )
      return
    }
    default: {
      const _exhaustive: never = actionId
      return _exhaustive
    }
  }
}
