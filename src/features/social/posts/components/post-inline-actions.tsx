import {StyleSheet, View} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ReactionType, SocialPost} from '@/domain/social'
import {formatCompactCount} from '@/features/social/posts/types/post'
import type {PostContextAction} from '@/features/social/posts/state/post-interaction-types'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PostInlineActionsProps = {
  post: SocialPost
  contextActions: PostContextAction[]
  onReact: (reaction: ReactionType | null) => void
  onSave: () => void
  onShare: () => void
  onCommentPress: () => void
}

function InlineAction({
  label,
  icon,
  count,
  selected,
  onPress,
}: {
  label: string
  icon: AppIconName
  count?: number
  selected?: boolean
  onPress: () => void
}) {
  const {colours, spacing, accessibility} = useThemeTokens()
  const ink = selected ? colours.accent : colours.textSecondary
  return (
    <AppPressable
      accessibilityLabel={
        typeof count === 'number' && count > 0 ? `${label}, ${count}` : label
      }
      accessibilityState={{selected}}
      onPress={onPress}
      style={[styles.action, {gap: spacing[1], minWidth: 44, minHeight: 44}]}>
      <AppIcon name={icon} colour={ink} size={20} />
      {typeof count === 'number' && count > 0 ? (
        <AppText variant="caption" style={{color: ink}}>
          {formatCompactCount(count)}
        </AppText>
      ) : null}
      {accessibility.differentiateWithoutColor && selected ? (
        <View
          accessible={false}
          style={[styles.selectedMark, {backgroundColor: colours.textMain}]}
        />
      ) : null}
    </AppPressable>
  )
}

export function PostInlineActions({
  post,
  contextActions,
  onReact,
  onSave,
  onShare,
  onCommentPress,
}: PostInlineActionsProps) {
  const {colours, spacing} = useThemeTokens()
  const liked = Boolean(post.liked || post.viewerReaction)

  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Post actions"
      style={[
        styles.row,
        {
          borderTopColor: colours.separator,
          paddingTop: spacing[1],
          marginTop: spacing[2],
        },
      ]}>
      <InlineAction
        label={liked ? 'Unlike' : 'Like'}
        icon="like"
        selected={liked}
        count={post.likeCount || undefined}
        onPress={() => onReact(post.viewerReaction === 'like' || post.liked ? null : 'like')}
      />
      <InlineAction
        label="Comment"
        icon="comment"
        count={post.replyCount || undefined}
        onPress={onCommentPress}
      />
      <InlineAction
        label="Share"
        icon="share"
        count={post.repostCount || undefined}
        onPress={onShare}
      />
      <InlineAction
        label={post.saved ? 'Unsave' : 'Save'}
        icon={post.saved ? 'saved' : 'bookmark'}
        selected={post.saved}
        onPress={onSave}
      />
      <AppPressable
        accessibilityLabel="More post actions"
        onPress={() => {
          void presentModulaActions({
            title: 'Post',
            actions: contextActions.map(action => ({
              id: action.id,
              label: action.label,
              style: action.destructive ? 'destructive' : undefined,
            })),
          }).then(id => {
            const match = contextActions.find(action => action.id === id)
            match?.handler()
          })
        }}
        style={[styles.action, {minWidth: 44, minHeight: 44}]}>
        <AppIcon name="more" colour={colours.textSecondary} size={20} />
      </AppPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  row: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  selectedMark: {
    borderRadius: 3,
    height: 6,
    marginLeft: 2,
    width: 6,
  },
})
