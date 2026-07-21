import {useState} from 'react'
import {useLocalSearchParams} from 'expo-router'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {parsePostId, type PostId} from '@/api/contracts'
import {useSession} from '@/auth/runtime'
import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {usePostQuery} from '@/features/feed/data'
import {CommentPreview} from '@/features/social/components/comment-preview'
import {SocialPost} from '@/features/social/components/social-post'
import {
  useCommentMutations,
  useCommentRepliesQuery,
  useCommentsQuery,
} from '@/features/social/data/useCommentsQuery'
import type {SocialComment} from '@/domain/social'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function PostDetailScreen() {
  const {postId} = useLocalSearchParams<{postId: string}>()
  const insets = useSafeAreaInsets()
  const {colours, spacing} = useThemeTokens()
  let parsedPostId = null
  try {
    parsedPostId = parsePostId(postId)
  } catch {
    parsedPostId = null
  }
  const postQuery = usePostQuery(parsedPostId ?? parsePostId('post-local-1'))
  const post = parsedPostId ? postQuery.data : null
  const commentsQuery = useCommentsQuery(parsedPostId)

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Post" />
      <ResponsiveContent>
        {post ? (
          <>
            <ScrollView contentContainerStyle={{paddingBottom: 120 + insets.bottom}}>
              <SocialPost post={post} />
              <View style={[styles.thread, {gap: spacing[2], paddingHorizontal: spacing[4]}]}>
                <View style={styles.threadHeader}>
                  <AppText variant="headline">Comments</AppText>
                  <AppPressable accessibilityLabel="Comment sort options, unavailable" disabled>
                    <AppText variant="caption" colour="textSecondary">Top ▾</AppText>
                  </AppPressable>
                </View>
                {commentsQuery.isLoading ? <InitialLoadingState label="Loading comments" /> : null}
                {commentsQuery.isError ? (
                  <QueryErrorState error={commentsQuery.error} onRetry={() => void commentsQuery.refetch()} />
                ) : null}
                {commentsQuery.data?.map(comment => <CommentThread key={comment.id} comment={comment} />)}
                {!commentsQuery.isLoading && !commentsQuery.isError && !commentsQuery.data?.length ? (
                  <AppText variant="body" colour="textSecondary">Start the conversation.</AppText>
                ) : null}
              </View>
            </ScrollView>
            <CommentComposer postId={post.id} />
          </>
        ) : postQuery.isLoading ? (
          <InitialLoadingState label="Loading post" />
        ) : postQuery.isError ? (
          <QueryErrorState error={postQuery.error} onRetry={() => void postQuery.refetch()} />
        ) : (
          <EmptyState icon="comment" title="Post unavailable" description="This post is no longer available." />
        )}
      </ResponsiveContent>
    </View>
  )
}

function CommentThread({comment}: {comment: SocialComment}) {
  const [collapsed, setCollapsed] = useState(false)
  const replies = useCommentRepliesQuery(comment.id, !collapsed && comment.replyCount > 0)
  return (
    <View>
      <CommentPreview comment={comment} collapsed={collapsed} onToggleReplies={() => setCollapsed(value => !value)} />
      {!collapsed ? replies.data?.map(reply => <CommentPreview key={reply.id} comment={reply} />) : null}
    </View>
  )
}

function CommentComposer({postId}: {postId: PostId}) {
  const [text, setText] = useState('')
  const insets = useSafeAreaInsets()
  const session = useSession()
  const {colours, radius, spacing} = useThemeTokens()
  const {create} = useCommentMutations(postId)
  const profile = session.status === 'signedIn' ? session.profile : null
  const send = () => {
    const value = text.trim()
    if (!value || create.isPending) return
    create.mutate(value, {onSuccess: () => setText('')})
  }

  return (
    <View style={[styles.composer, {backgroundColor: colours.surface, borderTopColor: colours.border, gap: spacing[2], paddingBottom: Math.max(insets.bottom, spacing[2]), paddingHorizontal: spacing[4]}]}>
      <Avatar name={profile?.displayName ?? 'You'} uri={profile?.avatarUri} colour={profile?.coverColour} size={34} />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Write a comment…"
        placeholderTextColor={colours.textTertiary}
        accessibilityLabel="Write a comment"
        multiline
        style={[styles.input, {backgroundColor: colours.surfaceMuted, borderRadius: radius.medium, color: colours.text, paddingHorizontal: spacing[3]}]}
      />
      <AppPressable accessibilityLabel="Send comment" disabled={!text.trim() || create.isPending} onPress={send} style={styles.send}>
        <AppIcon name="send" colour={text.trim() ? colours.accent : colours.textTertiary} size={20} />
      </AppPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  composer: {alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, bottom: 0, flexDirection: 'row', left: 0, minHeight: 60, paddingTop: 8, position: 'absolute', right: 0},
  input: {flex: 1, maxHeight: 100, minHeight: 44, paddingVertical: 10},
  screen: {flex: 1},
  send: {alignItems: 'center', justifyContent: 'center'},
  thread: {paddingTop: 12},
  threadHeader: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
})
