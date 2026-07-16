import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Surface} from '@/components/primitives/Surface'
import {
  type ModulaProfile,
} from '@/features/profile/contracts/profile'
import {demoProfileRelations} from '@/features/profile/data/demoProfiles'
import {getProfileRoute} from '@/features/profile/navigation/openProfile'
import {useProfile} from '@/features/profile/runtime/useProfile'
import {useProfileActions} from '@/features/profile/runtime/useProfileActions'
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
  const {profiles, ownerProfile} = useProfile()
  const {colours, radius, spacing} = useThemeTokens()
  const [query, setQuery] = useState('')
  const profile = profiles[handle] ?? null
  const ids = profile
    ? demoProfileRelations[mode][profile.handle] ?? []
    : []
  const connections = ids
    .map(id => Object.values(profiles).find(next => next.id === id))
    .filter((item): item is ModulaProfile => Boolean(item))
  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      connections.filter(item =>
        `${item.displayName} ${item.handle} ${item.bio}`.toLowerCase().includes(q),
      ),
    [connections, q],
  )

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={mode === 'followers' ? 'Followers' : 'Following'} />
      <ResponsiveContent maxWidth={760}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
          {profile ? (
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
                <View style={{gap: spacing[2]}}>
                  {filtered.map(item => (
                    <ConnectionRow
                      key={item.id}
                      profile={item}
                      ownerProfileId={ownerProfile.id}
                      description={relationshipDescription(item, ownerProfile.id)}
                    />
                  ))}
                </View>
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
        </ScrollView>
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

function ConnectionRow({
  profile,
  ownerProfileId,
  description,
}: {
  profile: ModulaProfile
  ownerProfileId: string
  description: string
}) {
  const router = useRouter()
  const {followProfile, unfollowProfile} = useProfileActions()
  const {colours, radius, spacing} = useThemeTokens()
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
            {description}
          </AppText>
        </View>
      </AppPressable>
      {!isOwner ? (
        <AppPressable
          accessibilityLabel={
            profile.isFollowing ? `Unfollow ${profile.displayName}` : `Follow ${profile.displayName}`
          }
          accessibilityState={{selected: profile.isFollowing}}
          onPress={() =>
            profile.isFollowing ? unfollowProfile(profile.id) : followProfile(profile.id)
          }
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
    </Surface>
  )
}

const styles = StyleSheet.create({
  content: {
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
