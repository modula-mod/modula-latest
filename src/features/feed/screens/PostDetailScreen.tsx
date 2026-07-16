import {useLocalSearchParams, useRouter} from 'expo-router'
import {ScrollView, StyleSheet, View} from 'react-native'

import {parsePostId} from '@/api/contracts'
import {useSession} from '@/auth/runtime'
import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {DemoPostItem} from '@/components/feed/DemoPostItem'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {usePostQuery} from '@/features/feed/data'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {ModulaProfile} from '@/features/profile/contracts'

const replies = [
  {
    id: 'reply-1',
    text: 'This keeps the data runtime focused on transport semantics before remote protocols arrive.',
    time: '12m',
  },
  {
    id: 'reply-2',
    text: 'The repository boundary gives modules a clean place to attach later.',
    time: '7m',
  },
]

export function PostDetailScreen() {
  const {postId} = useLocalSearchParams<{postId: string}>()
  const {colours, spacing} = useThemeTokens()
  let parsedPostId = null
  try {
    parsedPostId = parsePostId(postId)
  } catch {
    parsedPostId = null
  }
  const postQuery = usePostQuery(parsedPostId ?? parsePostId('post-local-1'))
  const post = parsedPostId ? postQuery.data : null

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Post" />
      <ResponsiveContent>
        {post ? (
          <ScrollView contentContainerStyle={{paddingBottom: spacing[8]}}>
            <DemoPostItem post={post} />
            <View style={[styles.thread, {paddingHorizontal: spacing[4]}]}>
              {replies.map(reply => (
                <ReplyRow key={reply.id} reply={{...reply, author: post.author}} />
              ))}
            </View>
            <View
              style={[
                styles.replyPrompt,
                {
                  borderColor: colours.border,
                  margin: spacing[4],
                  padding: spacing[4],
                },
              ]}>
              <AppText variant="headline">Add a local reply</AppText>
              <AppText variant="body" colour="textSecondary">
                Reply composition will connect after the data runtime stabilises.
              </AppText>
            </View>
          </ScrollView>
        ) : postQuery.isLoading ? (
          <InitialLoadingState label="Loading post" />
        ) : postQuery.isError ? (
          <QueryErrorState error={postQuery.error} onRetry={() => void postQuery.refetch()} />
        ) : (
          <EmptyState
            icon="comment"
            title="Post unavailable"
            description="This post is not available from the local API simulator."
          />
        )}
      </ResponsiveContent>
    </View>
  )
}

function ReplyRow({
  reply,
}: {
  reply: (typeof replies)[number] & {author: ModulaProfile}
}) {
  const router = useRouter()
  const session = useSession()
  const {colours, spacing} = useThemeTokens()
  const ownerProfileId = session.status === 'signedIn' ? session.profile.id : ''
  const profileRoute = getProfileRouteForIdentity(reply.author, ownerProfileId)

  return (
    <View style={styles.replyRow}>
      <View style={styles.connectorWrap}>
        <AppPressable
          accessibilityLabel={`Open ${reply.author.displayName} profile`}
          onPress={() => router.push(profileRoute)}
          style={styles.replyAvatarPress}>
          <Avatar
            name={reply.author.displayName}
            uri={reply.author.avatarUri}
            colour={reply.author.coverColour}
            size={34}
          />
        </AppPressable>
        <View style={[styles.connector, {backgroundColor: colours.border}]} />
      </View>
      <View style={styles.replyBody}>
        <AppPressable
          accessibilityLabel={`Open ${reply.author.displayName} profile`}
          onPress={() => router.push(profileRoute)}
          style={styles.replyIdentityPress}>
          <AppText variant="label">{reply.author.displayName}</AppText>
          <AppText variant="caption" colour="textSecondary">
            @{reply.author.handle} · {reply.time}
          </AppText>
        </AppPressable>
        <AppText variant="body" style={{marginTop: spacing[1]}}>
          {reply.text}
        </AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  connector: {
    flex: 1,
    marginTop: 8,
    width: 2,
  },
  connectorWrap: {
    alignItems: 'center',
  },
  replyBody: {
    flex: 1,
    minWidth: 0,
  },
  replyAvatarPress: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyIdentityPress: {
    justifyContent: 'center',
    minHeight: 42,
  },
  replyPrompt: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  replyRow: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 92,
  },
  screen: {
    flex: 1,
  },
  thread: {
    paddingTop: 12,
  },
})
