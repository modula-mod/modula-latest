import {useMemo, useState} from 'react'
import {FlatList, StyleSheet, TextInput, View} from 'react-native'
import {useRouter} from 'expo-router'

import {parseProfileId} from '@/api/contracts'
import {useCapability, useProtectedPrompt, useSession} from '@/auth/runtime'
import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {InitialLoadingState, PaginationIndicator, QueryErrorState} from '@/components/data'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Surface} from '@/components/primitives/Surface'
import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {useFollowProfileMutation, useFollowersQuery, useFollowingQuery, useProfileQuery} from '@/features/profile/data-query'
import {getProfileRoute} from '@/features/profile/navigation/openProfile'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

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
  const {colours, radius, spacing} = useThemeTokens()
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
              <View
                style={[
                  styles.search,
                  {
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                    borderRadius: radius.round,
                    paddingHorizontal: spacing[4],
                  },
                ]}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search profiles"
                  placeholderTextColor={colours.textTertiary}
                  style={[styles.searchInput, {color: colours.text}]}
                  returnKeyType="search"
                />
              </View>
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
  const {colours, radius, spacing} = useThemeTokens()
  const ownerProfileId = session.status === 'signedIn' ? session.profile.id : ''
  const isOwner = profile.id === ownerProfileId

  return (
    <Surface variant="plain" style={[styles.row, {gap: spacing[3], paddingVertical: spacing[2]}]}>
      <AppPressable
        accessibilityLabel={`Open ${profile.displayName} profile`}
        onPress={() => router.push(getProfileRoute(profile, ownerProfileId))}
        style={styles.identityPress}>
        <Avatar
          name={profile.displayName}
          uri={profile.avatarUri}
          colour={profile.coverColour}
          size={44}
        />
        <View style={styles.rowText}>
          <AppText variant="label">{profile.displayName}</AppText>
          <AppText variant="caption" colour="textSecondary">
            @{profile.handle}
          </AppText>
          <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
            {relationshipDescription(profile, ownerProfileId)}
          </AppText>
        </View>
      </AppPressable>
      {!isOwner ? (
        <AppPressable
          accessibilityLabel={
            profile.isFollowing ? `Unfollow ${profile.displayName}` : `Follow ${profile.displayName}`
          }
          accessibilityState={{selected: profile.isFollowing}}
          onPress={() => {
            if (!canFollow) {
              prompt.show()
              return
            }
            followMutation.mutate({
              profileId: parseProfileId(profile.id),
              following: !profile.isFollowing,
            })
          }}
          style={[
            styles.followButton,
            {
              backgroundColor: profile.isFollowing ? colours.surfaceRaised : colours.accent,
              borderColor: profile.isFollowing ? colours.border : 'transparent',
              borderRadius: radius.round,
              paddingHorizontal: spacing[3],
            },
          ]}>
          <AppText
            variant="label"
            style={{color: profile.isFollowing ? colours.text : colours.accentForeground}}>
            {profile.isFollowing ? 'Following' : 'Follow'}
          </AppText>
        </AppPressable>
      ) : null}
      <ProtectedActionPrompt
        visible={prompt.visible}
        onClose={prompt.hide}
        description="Sign in to follow profiles in this local Modula build."
      />
    </Surface>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingBottom: 48,
  },
  followButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  identityPress: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  screen: {
    flex: 1,
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 48,
  },
  searchInput: {
    minHeight: 44,
  },
})
