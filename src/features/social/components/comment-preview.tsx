import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {SocialComment} from '@/domain/social'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type CommentPreviewProps = {
  comment: SocialComment
  collapsed?: boolean
  onToggleReplies?: () => void
  onReply?: () => void
}

export function CommentPreview({comment, collapsed, onToggleReplies, onReply}: CommentPreviewProps) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.row, {borderLeftColor: comment.depth ? colours.border : 'transparent', gap: spacing[1], marginLeft: comment.depth * spacing[2], paddingLeft: comment.depth ? spacing[2] : 0}]}>
      <AppText variant="label">Member</AppText>
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
  )
}

const styles = StyleSheet.create({
  controls: {flexDirection: 'row', gap: 8},
  row: {borderLeftWidth: StyleSheet.hairlineWidth, paddingVertical: 8},
})
