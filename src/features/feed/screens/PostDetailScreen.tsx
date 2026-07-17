import {useLocalSearchParams, useRouter, type Href} from 'expo-router'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {parsePostId} from '@/api/contracts'
import {useSession} from '@/auth/runtime'
import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {DemoPostItem} from '@/components/feed/DemoPostItem'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {PublicationStatusBanner} from '@/features/atproto/components/PublicationStatusBanner'
import {usePrimaryAtprotoConnection} from '@/features/atproto/data/useAtprotoConnectionsQuery'
import {useUpdateAtprotoPreferencesMutation} from '@/features/atproto/data/useAtprotoPreferences'
import {mapConnectionToUiPublicationStatus} from '@/features/atproto/publishing/publicationStatus'
import {usePostQuery} from '@/features/feed/data'
import {
  buildPostOverflowActions,
  runPostOverflowAction,
  type PostOverflowActionId,
} from '@/features/feed/postActions'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
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
  {
    id: 'reply-3',
    text: 'Composer reply mode should feel like a sticky bar, not a dead-end card.',
    time: '3m',
  },
]

export function PostDetailScreen() {
  const {postId} = useLocalSearchParams<{postId: string}>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {colours, radius, spacing} = useThemeTokens()
  let parsedPostId = null
  try {
    parsedPostId = parsePostId(postId)
  } catch {
    parsedPostId = null
  }
  const postQuery = usePostQuery(parsedPostId ?? parsePostId('post-local-1'))
  const post = parsedPostId ? postQuery.data : null
  const {connection} = usePrimaryAtprotoConnection()
  const updatePreferences = useUpdateAtprotoPreferencesMutation()
  const publicationStatus = mapConnectionToUiPublicationStatus(connection)

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader
        title="Post"
        right={
          post ? (
            <ModulaMenu
              accessibilityLabel="Post options"
              title="Post options"
              actions={buildPostOverflowActions(post)}
              onAction={id => {
                void runPostOverflowAction(id as PostOverflowActionId, post)
              }}
              trigger={
                <View style={styles.headerMore}>
                  <AppIcon name="more" colour={colours.textSecondary} />
                </View>
              }
            />
          ) : null
        }
      />
      <ResponsiveContent>
        {post ? (
          <>
            <ScrollView contentContainerStyle={{paddingBottom: 120 + insets.bottom}}>
              <DemoPostItem post={post} />
              {publicationStatus === 'needsAttention' ||
              publicationStatus === 'connectionExpired' ? (
                <View style={{paddingHorizontal: spacing[4], paddingTop: spacing[3]}}>
                  <PublicationStatusBanner
                    status={publicationStatus}
                    onRetry={() => void postQuery.refetch()}
                    onKeepModulaOnly={() => {
                      void updatePreferences.mutateAsync({
                        defaultMode: 'modulaOnly',
                        enabled: false,
                      })
                    }}
                  />
                </View>
              ) : null}
              <View style={[styles.thread, {paddingHorizontal: spacing[4]}]}>
                <AppText variant="headline" style={{marginBottom: spacing[3]}}>
                  Replies
                </AppText>
                {replies.map(reply => (
                  <ModulaContextMenu
                    key={reply.id}
                    accessibilityLabel={`Reply actions for ${reply.id}`}
                    actions={[
                      {id: 'reply', label: 'Reply'},
                      {id: 'like', label: 'Like — Preview'},
                      {id: 'report', label: 'Report — Preview', style: 'destructive'},
                    ]}
                    onAction={id => {
                      if (id === 'reply') {
                        router.push(
                          `/compose?mode=reply&replyTo=${encodeURIComponent(post.id)}` as Href,
                        )
                      }
                    }}>
                    <ReplyRow reply={{...reply, author: post.author}} />
                  </ModulaContextMenu>
                ))}
              </View>
            </ScrollView>
            <View
              style={[
                styles.replyBar,
                {
                  backgroundColor: colours.surface,
                  borderTopColor: colours.border,
                  paddingBottom: Math.max(insets.bottom, spacing[2]),
                  paddingHorizontal: spacing[4],
                },
              ]}>
              <Avatar
                name={post.author.displayName}
                uri={post.author.avatarUri}
                colour={post.author.coverColour}
                size={34}
              />
              <AppPressable
                accessibilityLabel="Write a reply"
                onPress={() =>
                  router.push(
                    `/compose?mode=reply&replyTo=${encodeURIComponent(post.id)}` as Href,
                  )
                }
                style={[
                  styles.replyField,
                  {
                    backgroundColor: colours.surfaceMuted,
                    borderRadius: radius.round,
                  },
                ]}>
                <AppText variant="body" colour="textTertiary">
                  Post your reply…
                </AppText>
              </AppPressable>
            </View>
          </>
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
  headerMore: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  replyAvatarPress: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyBar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    left: 0,
    minHeight: 56,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
  },
  replyBody: {
    flex: 1,
    minWidth: 0,
  },
  replyField: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  replyIdentityPress: {
    justifyContent: 'center',
    minHeight: 42,
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
