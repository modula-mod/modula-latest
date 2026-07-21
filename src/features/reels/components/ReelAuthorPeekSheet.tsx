import {useEffect, useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {useFollowProfileMutation} from '@/features/profile/data-query/useFollowProfileMutation'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {shareProfile} from '@/features/profile/services/shareProfile'
import type {ProfileId} from '@/api/contracts'
import type {ModulaProfile} from '@/features/profile/contracts'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaTitleIconButton} from '@/platform/ui/buttons/modula-title-icon-button'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ReelAuthorPeekSheetProps = {
  author: ModulaProfile | null
  ownerProfileId: string
  isPresented: boolean
  onDismiss: () => void
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`
  return String(value)
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
  const {colours, spacing} = useThemeTokens()
  const followMutation = useFollowProfileMutation()
  const [following, setFollowing] = useState(author?.isFollowing ?? false)

  useEffect(() => {
    const next = author?.isFollowing ?? false
    const id = setTimeout(() => setFollowing(next), 0)
    return () => clearTimeout(id)
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
  const metaBits = [
    author.pronouns?.trim(),
    author.location?.label?.trim(),
  ].filter(Boolean)

  return (
    <ModulaSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      snapPoints={['half']}
      material="glass"
      testID="reel-author-peek">
      <View style={[styles.body, {gap: spacing[4]}]}>
        <View style={[styles.identity, {gap: spacing[3]}]}>
          <Avatar
            name={author.displayName}
            uri={author.avatarUri}
            colour={author.coverColour}
            size={72}
          />
          <View style={[styles.identityText, {gap: spacing[1]}]}>
            <AppText variant="title2" numberOfLines={1}>
              {author.displayName}
            </AppText>
            <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
              @{author.handle}
            </AppText>
            {metaBits.length > 0 ? (
              <AppText variant="caption" colour="textTertiary" numberOfLines={1}>
                {metaBits.join(' · ')}
              </AppText>
            ) : null}
          </View>
        </View>

        {author.bio.trim() ? (
          <AppText
            variant="body"
            colour="textSecondary"
            numberOfLines={3}
            style={styles.bio}>
            {author.bio}
          </AppText>
        ) : null}

        <View style={[styles.stats, {gap: spacing[5]}]}>
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
              void selectionHaptic()
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
              gap: spacing[4],
            },
          ]}>
          <ModulaTitleIconButton
            icon="share"
            label="Share"
            chrome="plain"
            stretch
            onPress={() => {
              void selectionHaptic()
              void shareProfile(author)
            }}
            style={styles.secondaryAction}
          />
          <ModulaTitleIconButton
            icon="warning"
            label="Report"
            chrome="plain"
            stretch
            onPress={() => {
              void selectionHaptic()
              onDismiss()
              router.push('/report' as Href)
            }}
            style={styles.secondaryAction}
          />
        </View>
      </View>
    </ModulaSheet>
  )
}

function Stat({label, value}: {label: string; value: number}) {
  return (
    <View style={styles.stat}>
      <AppText variant="headline">{formatCompact(value)}</AppText>
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
  bio: {
    lineHeight: 22,
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
  secondaryAction: {
    flex: 1,
    minHeight: 44,
  },
  secondaryRow: {
    alignItems: 'center',
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
