import {useMemo, useState} from 'react'
import {FlatList, StyleSheet, View} from 'react-native'
import {useRouter} from 'expo-router'

import {parseProfileId} from '@/api/contracts'
import {useCapability, useProtectedPrompt, useSession} from '@/auth/runtime'
import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {InitialLoadingState, PaginationIndicator, QueryErrorState} from '@/components/data'
import {EmptyState} from '@/components/primitives/EmptyState'
import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {useFollowProfileMutation, useFollowersQuery, useFollowingQuery, useProfileQuery} from '@/features/profile/data-query'
import {getProfileRoute} from '@/features/profile/navigation/openProfile'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
import {ModulaUserRow} from '@/platform/ui/identity'

export type ProfileConnectionsMode = 'followers' | 'following'

type ProfileConnectionsScreenProps = {
  handle: string
  mode: ProfileConnectionsMode
}

export function ProfileConnectionsScreen({
  handle,
  mode,
}: ProfileConnectionsScreenProps) {
  const profileQuery = useProfileQuery(handle)
  const followersQuery = useFollowersQuery(handle)
  const followingQuery = useFollowingQuery(handle)
  const connectionsQuery = mode === 'followers' ? followersQuery : followingQuery
  const {colours, spacing} = useThemeTokens()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const connectionPages = connectionsQuery.data?.pages
  const filtered = useMemo(
    () => {
      const connections = connectionPages?.flatMap(page => page.items) ?? []
      return connections.filter(item =>
        `${item.displayName} ${item.handle} ${item.bio}`.toLowerCase().includes(q),
      )
    },
    [connectionPages, q],
  )

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={mode === 'followers' ? 'Followers' : 'Following'} />
      <ResponsiveContent maxWidth={760}>
        <View style={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
          {profileQuery.isLoading || connectionsQuery.isLoading ? (
            <InitialLoadingState label="Loading connections" />
          ) : profileQuery.isError || connectionsQuery.isError ? (
            <QueryErrorState
              error={profileQuery.error ?? connectionsQuery.error}
              onRetry={() => {
                void profileQuery.refetch()
                void connectionsQuery.refetch()
              }}
            />
          ) : profileQuery.data ? (
            <>
              <ModulaSearchField
                accessibilityLabel="Search profiles"
                onChangeText={setQuery}
                placeholder="Search profiles"
                value={query}
              />
              {filtered.length ? (
                <FlatList
                  data={filtered}
                  keyExtractor={item => item.id}
                  renderItem={({item}) => <ConnectionRow profile={item} />}
                  onEndReached={() => {
                    if (connectionsQuery.hasNextPage && !connectionsQuery.isFetchingNextPage) {
                      void connectionsQuery.fetchNextPage()
                    }
                  }}
                  ListFooterComponent={
                    connectionsQuery.isFetchingNextPage
                      ? <PaginationIndicator label="Loading more" />
                      : null
                  }
                />
              ) : (
                <EmptyState
                  icon="search"
                  title="No profiles match this search."
                  description="Try a display name, handle, or biography keyword."
                />
              )}
            </>
          ) : (
            <EmptyState
              icon="profile"
              title="Profile not found"
              description="This profile may have moved or may not be available."
            />
          )}
        </View>
      </ResponsiveContent>
    </View>
  )
}

function relationshipDescription(profile: ModulaProfile, ownerProfileId: string): string {
  if (profile.id === ownerProfileId) return 'Your profile'
  if (profile.isFollowing && profile.followsViewer) return 'Mutual connection'
  if (profile.followsViewer) return 'Follows you'
  if (profile.isFollowing) return 'Following'
  return 'Public profile'
}

function ConnectionRow({profile}: {profile: ModulaProfile}) {
  const router = useRouter()
  const session = useSession()
  const canFollow = useCapability('social:follow')
  const prompt = useProtectedPrompt()
  const followMutation = useFollowProfileMutation()
  const ownerProfileId = session.status === 'signedIn' ? session.profile.id : ''
  const isOwner = profile.id === ownerProfileId

  return (
    <View>
      <ModulaUserRow
        action={!isOwner ? {
          accessibilityLabel: profile.isFollowing
            ? `Unfollow ${profile.displayName}`
            : `Follow ${profile.displayName}`,
          emphasis: profile.isFollowing ? 'neutral' : 'primary',
          label: profile.isFollowing ? 'Following' : 'Follow',
          loading: followMutation.isPending,
          onPress: () => {
            if (!canFollow) {
              prompt.show()
              return
            }
            followMutation.mutate({
              profileId: parseProfileId(profile.id),
              following: !profile.isFollowing,
            })
          },
          selected: profile.isFollowing,
        } : undefined}
        avatarUri={profile.avatarUri}
        handle={`@${profile.handle}`}
        metadata={relationshipDescription(profile, ownerProfileId)}
        name={profile.displayName}
        onPress={() => router.push(getProfileRoute(profile, ownerProfileId))}
      />
      <ProtectedActionPrompt
        visible={prompt.visible}
        onClose={prompt.hide}
        description="Sign in to follow profiles in this local Modula build."
      />
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingBottom: 48,
  },
  screen: {
    flex: 1,
  },
})
