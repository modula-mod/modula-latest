import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import type {SocialComment} from '@/domain/social'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type CommentPreviewProps = {
  comment: SocialComment
  collapsed?: boolean
  onToggleReplies?: () => void
  onReply?: () => void
  authorLabel?: string
}

export function CommentPreview({comment, collapsed, onToggleReplies, onReply, authorLabel = 'Member'}: CommentPreviewProps) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.row, {borderLeftColor: comment.depth ? colours.border : 'transparent', gap: spacing[2], marginLeft: comment.depth * spacing[2], paddingLeft: comment.depth ? spacing[2] : 0}]}>
      <Avatar name={authorLabel} size={32} />
      <View style={[styles.body, {gap: spacing[1]}]}>
        <AppText variant="label">{authorLabel}</AppText>
        <AppText variant="body" colour={comment.deletedAt ? 'textSecondary' : undefined}>
          {comment.deletedAt ? 'Comment deleted' : comment.text}
        </AppText>
        <View style={styles.controls}>
          {comment.replyCount ? (
            <AppPressable accessibilityLabel={`${collapsed ? 'Show' : 'Hide'} ${comment.replyCount} replies`} onPress={onToggleReplies}>
              <AppText variant="caption" colour="accent">{collapsed ? `Show ${comment.replyCount} replies` : 'Hide replies'}</AppText>
            </AppPressable>
          ) : null}
          {onReply ? (
            <AppPressable accessibilityLabel="Reply to comment" onPress={onReply}>
              <AppText variant="caption" colour="textSecondary">Reply</AppText>
            </AppPressable>
          ) : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  body: {flex: 1, minWidth: 0},
  controls: {flexDirection: 'row', gap: 8},
  row: {alignItems: 'flex-start', borderLeftWidth: StyleSheet.hairlineWidth, flexDirection: 'row', paddingVertical: 8},
})
