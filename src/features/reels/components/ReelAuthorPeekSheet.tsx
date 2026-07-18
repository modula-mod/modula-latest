import {useEffect, useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {useFollowProfileMutation} from '@/features/profile/data-query/useFollowProfileMutation'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {shareProfile} from '@/features/profile/services/shareProfile'
import type {ProfileId} from '@/api/contracts'
import type {ModulaProfile} from '@/features/profile/contracts'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ReelAuthorPeekSheetProps = {
  author: ModulaProfile | null
  ownerProfileId: string
  isPresented: boolean
  onDismiss: () => void
}

/**
 * Long-press peek of a reel creator — summary + follow / open / share.
 * Distinct from `/profile/preview` (owner visitor mode).
 */
export function ReelAuthorPeekSheet({
  author,
  ownerProfileId,
  isPresented,
  onDismiss,
}: ReelAuthorPeekSheetProps) {
  const router = useRouter()
  const {colours, spacing, radius} = useThemeTokens()
  const followMutation = useFollowProfileMutation()
  const [following, setFollowing] = useState(author?.isFollowing ?? false)

  useEffect(() => {
    setFollowing(author?.isFollowing ?? false)
  }, [author?.id, author?.isFollowing])

  if (!author) {
    return (
      <ModulaSheet
        isPresented={isPresented}
        onDismiss={onDismiss}
        snapPoints={['half']}
        material="glass">
        <View />
      </ModulaSheet>
    )
  }

  const profileRoute = getProfileRouteForIdentity(author, ownerProfileId)

  return (
    <ModulaSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      snapPoints={['half']}
      material="glass"
      testID="reel-author-peek">
      <View style={[styles.body, {gap: spacing[4], padding: spacing[4]}]}>
        <View style={[styles.identity, {gap: spacing[3]}]}>
          <Avatar
            name={author.displayName}
            uri={author.avatarUri}
            colour={author.coverColour}
            size={64}
          />
          <View style={styles.identityText}>
            <AppText variant="title2" numberOfLines={1}>
              {author.displayName}
            </AppText>
            <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
              @{author.handle}
            </AppText>
          </View>
        </View>

        {author.bio.trim() ? (
          <AppText variant="body" colour="textSecondary" numberOfLines={3}>
            {author.bio}
          </AppText>
        ) : null}

        <View style={[styles.stats, {gap: spacing[4]}]}>
          <Stat label="Followers" value={author.followerCount} />
          <Stat label="Following" value={author.followingCount} />
          <Stat label="Posts" value={author.postCount} />
        </View>

        <View style={[styles.actions, {gap: spacing[2]}]}>
          <AppButton
            accessibilityLabel={following ? 'Unfollow' : 'Follow'}
            disabled={followMutation.isPending}
            onPress={() => {
              void selectionHaptic()
              const next = !following
              setFollowing(next)
              followMutation.mutate(
                {profileId: author.id as ProfileId, following: next},
                {
                  onError: () => setFollowing(!next),
                },
              )
            }}>
            {following ? 'Following' : 'Follow'}
          </AppButton>
          <AppButton
            variant="secondary"
            accessibilityLabel="Open profile"
            onPress={() => {
              onDismiss()
              router.push(profileRoute as Href)
            }}>
            View profile
          </AppButton>
        </View>

        <View
          style={[
            styles.secondaryRow,
            {
              borderTopColor: colours.separator,
              paddingTop: spacing[3],
              gap: spacing[3],
            },
          ]}>
          <AppPressable
            accessibilityLabel="Share profile"
            onPress={() => {
              void shareProfile(author)
            }}
            style={[
              styles.secondaryChip,
              {
                backgroundColor: colours.surfaceMuted,
                borderRadius: radius.medium,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
              },
            ]}>
            <AppText variant="label">Share</AppText>
          </AppPressable>
          <AppPressable
            accessibilityLabel="Report creator"
            onPress={() => {
              onDismiss()
              router.push('/report' as Href)
            }}
            style={[
              styles.secondaryChip,
              {
                backgroundColor: colours.surfaceMuted,
                borderRadius: radius.medium,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
              },
            ]}>
            <AppText variant="label" colour="textSecondary">
              Report
            </AppText>
          </AppPressable>
        </View>
      </View>
    </ModulaSheet>
  )
}

function Stat({label, value}: {label: string; value: number}) {
  return (
    <View style={styles.stat}>
      <AppText variant="headline">{value}</AppText>
      <AppText variant="caption" colour="textTertiary">
        {label}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  actions: {
    width: '100%',
  },
  body: {
    width: '100%',
  },
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  secondaryChip: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  secondaryRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    width: '100%',
  },
  stat: {
    alignItems: 'flex-start',
    gap: 2,
  },
  stats: {
    flexDirection: 'row',
    width: '100%',
  },
})
