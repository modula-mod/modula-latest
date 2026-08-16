import {StyleSheet, View} from 'react-native'
import {type Href, useRouter} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {SocialPost} from '@/domain/social'
import {useRepostMutation, useSavePostMutation} from '@/features/feed/data'
import {runPostOverflowAction} from '@/features/feed/postActions'
import {selectionHaptic} from '@/lib/haptics'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import {useAppServices} from '@/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {ReactionControl} from './reaction-control'

export function PostActions({post}: {post: SocialPost}) {
  const router = useRouter()
  const {colours} = useThemeTokens()
  const {moderationRepository} = useAppServices()
  const save = useSavePostMutation()
  const repost = useRepostMutation()
  const action = (
    label: string,
    icon: 'comment' | 'repost' | 'share' | 'bookmark',
    count?: number,
    selected?: boolean,
    onPress?: () => void,
    accessibilityLabel?: string,
  ) => (
    <AppPressable
      key={label}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{selected}}
      onPress={onPress}
      style={styles.action}>
      <AppIcon name={icon} colour={selected ? colours.accent : colours.textSecondary} size={20} />
      {typeof count === 'number' && count > 0 ? (
        <AppText variant="caption" style={{color: selected ? colours.accent : colours.textSecondary}}>
          {count}
        </AppText>
      ) : null}
    </AppPressable>
  )

  const openRepostMenu = () => {
    void selectionHaptic()
    void presentModulaActions({
      title: 'Repost or quote',
      actions: [
        ...(post.reposted
          ? [{id: 'undo', label: 'Undo repost'}]
          : [{id: 'repost', label: 'Repost'}]),
        {id: 'quote', label: 'Quote post'},
      ],
      cancelLabel: 'Cancel',
    }).then(choice => {
      if (choice === 'repost') {
        repost.mutate({postId: post.id, reposted: true})
        return
      }
      if (choice === 'undo') {
        repost.mutate({postId: post.id, reposted: false})
        return
      }
      if (choice === 'quote') {
        router.push(`/compose?quotePostId=${encodeURIComponent(post.id)}` as Href)
      }
    })
  }

  return (
    <View style={styles.actions}>
      {action('Reply', 'comment', post.replyCount, false, () => router.push(`/post/${post.id}` as Href), 'Comment on post')}
      {action('Repost', 'repost', post.repostCount, post.reposted, openRepostMenu, 'Repost or quote')}
      <ReactionControl post={post} />
      {action('Share', 'share', undefined, false, () => void runPostOverflowAction('share', post, {moderationRepository}), 'Open post actions')}
      {action('Save', 'bookmark', undefined, post.saved, () => save.mutate({postId: post.id, saved: !post.saved}), 'Save post')}
    </View>
  )
}

const styles = StyleSheet.create({
  action: {alignItems: 'center', flexDirection: 'row', gap: 4},
  actions: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 2},
})
