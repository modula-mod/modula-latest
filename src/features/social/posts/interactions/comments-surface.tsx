import {ActivityIndicator, StyleSheet, TextInput, View} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import type {SocialComment} from '@/domain/social'
import {CommentPreview} from '@/features/social/components/comment-preview'
import {PostBottomHandle} from '@/features/social/posts/components/post-bottom-handle'
import {PostSurface} from '@/features/social/posts/components/post-surface'
import {usePostInteraction} from '@/features/social/posts/interactions/post-interaction-context'
import {POST_GEOMETRY} from '@/features/social/posts/tokens/post-geometry'
import {postLayerZ} from '@/features/social/posts/tokens/post-layout'
import {useSession} from '@/auth/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type CommentsSurfaceProps = {
  postId: string
  commentCount: number
  comments: SocialComment[] | undefined
  isLoading: boolean
  isError: boolean
  isOffline?: boolean
  disabled?: boolean
}

export function CommentsSurface({
  postId,
  commentCount,
  comments,
  isLoading,
  isError,
  isOffline,
  disabled,
}: CommentsSurfaceProps) {
  const session = useSession()
  const {colours, spacing} = useThemeTokens()
  const {commentsProgress, shellHeight} = usePostInteraction()

  const sheetStyle = useAnimatedStyle(() => {
    const height = shellHeight.get()
    const progress = commentsProgress.get()
    return {
      transform: [{translateY: interpolate(progress, [0, 1], [height, height * 0.08])}],
    }
  })

  const chromeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(commentsProgress.get(), [0, 0.2, 0.55], [0, 0.65, 1]),
  }))

  let body = (
    <AppText variant="body" colour="textSecondary">
      No comments yet. Start the conversation.
    </AppText>
  )
  if (disabled) {
    body = <AppText variant="body" colour="textSecondary">Comments are disabled on this post.</AppText>
  } else if (isOffline) {
    body = <AppText variant="body" colour="textSecondary">You appear to be offline.</AppText>
  } else if (isError) {
    body = <AppText variant="body" colour="textSecondary">Could not load comments.</AppText>
  } else if (isLoading) {
    body = <ActivityIndicator color={colours.accent} />
  } else if (comments?.length) {
    body = (
      <View style={{gap: spacing[2]}}>
        {comments.slice(0, 4).map(comment => (
          <CommentPreview key={comment.id} comment={comment} />
        ))}
      </View>
    )
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.root, sheetStyle, {zIndex: postLayerZ('transient')}]}>
      <Animated.View style={[styles.sheet, chromeOpacity]}>
        <PostSurface
          role="comments"
          style={[
            styles.panel,
            {
              borderTopLeftRadius: POST_GEOMETRY.commentsRadius,
              borderTopRightRadius: POST_GEOMETRY.commentsRadius,
              paddingHorizontal: spacing[3],
              paddingTop: spacing[2],
              paddingBottom: spacing[4],
            },
          ]}>
          <PostBottomHandle progress={commentsProgress} />
          <View style={[styles.header, {marginBottom: spacing[2]}]}>
            <AppText variant="label" style={{color: colours.mediaOverlayText}}>
              Comments
            </AppText>
            <AppText variant="caption" style={{color: colours.mediaOverlaySecondary}}>
              {commentCount > 0 ? `View all ${commentCount}` : 'Be first'}
            </AppText>
          </View>
          {body}
          <View style={[styles.composer, {gap: spacing[2], marginTop: spacing[3]}]}>
            <Avatar
              name={session.status === 'signedIn' ? session.profile.displayName : 'You'}
              uri={session.status === 'signedIn' ? session.profile.avatarUri : undefined}
              size={32}
            />
            <AppPressable
              accessibilityLabel="Add a comment"
              style={[
                styles.input,
                {
                  backgroundColor: colours.mediaOverlayControlBackground,
                  borderColor: colours.borderStrong,
                  paddingHorizontal: spacing[3],
                },
              ]}>
              <TextInput
                editable={false}
                placeholder="Add a comment..."
                placeholderTextColor={colours.mediaOverlaySecondary}
                style={{color: colours.mediaOverlayText, flex: 1, minHeight: 36}}
              />
            </AppPressable>
          </View>
        </PostSurface>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  composer: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
  },
  panel: {
    minHeight: 180,
  },
  root: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
  },
})
