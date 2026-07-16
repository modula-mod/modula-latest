import {StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  canViewerSeeProfileField,
  type ModulaProfile,
  type ProfileKind,
  type ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {IdentityIndicator} from '@/features/profile/components/IdentityIndicator'
import {ProfileVisibilityBadge} from '@/features/profile/components/ProfileVisibilityBadge'
import {openSafeExternalUrl} from '@/lib/safeExternalUrl'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileIdentityProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
  compact?: boolean
}

const kindLabels: Record<ProfileKind, string> = {
  person: 'Modula profile',
  creator: 'Creator profile',
  professional: 'Professional profile',
  organisation: 'Organisation profile',
  team: 'Team profile',
}

export function ProfileIdentity({profile, viewer, compact}: ProfileIdentityProps) {
  const {colours, spacing} = useThemeTokens()
  const visibleClaims = profile.identityClaims.filter(claim =>
    canViewerSeeProfileField(claim.visibility, viewer.relationship),
  )
  const locationVisible =
    profile.location &&
    canViewerSeeProfileField(profile.location.visibility, viewer.relationship)
  const websiteVisible =
    profile.website &&
    canViewerSeeProfileField(profile.website.visibility, viewer.relationship)

  return (
    <View style={[styles.wrap, {gap: compact ? spacing[2] : spacing[3]}]}>
      <View style={{gap: spacing[1]}}>
        <AppText variant={compact ? 'title2' : 'display'} numberOfLines={2}>
          {profile.displayName}
        </AppText>
        <View style={[styles.handleRow, {gap: spacing[2]}]}>
          <AppText variant="body" colour="textSecondary" selectable>
            @{profile.handle}
          </AppText>
          <AppText variant="caption" colour="textSecondary">
            {kindLabels[profile.kind]}
          </AppText>
        </View>
      </View>

      {visibleClaims.length ? (
        <View style={[styles.indicators, {gap: spacing[2]}]}>
          {visibleClaims.map(claim => (
            <IdentityIndicator key={claim.id} claim={claim} />
          ))}
        </View>
      ) : null}

      <AppText variant="body">{profile.bio}</AppText>

      <View style={[styles.metadata, {gap: spacing[2]}]}>
        {profile.pronouns && viewer.relationship === 'owner' ? (
          <AppText variant="caption" colour="textSecondary">
            {profile.pronouns}
          </AppText>
        ) : null}
        {locationVisible ? (
          <View style={[styles.metaItem, {gap: spacing[1]}]}>
            <AppIcon name="discover" colour={colours.textSecondary} size={16} />
            <AppText variant="caption" colour="textSecondary">
              {profile.location?.label}
            </AppText>
            {profile.location ? (
              <ProfileVisibilityBadge
                visibility={profile.location.visibility}
                contextLabel="Location"
              />
            ) : null}
          </View>
        ) : null}
        {websiteVisible && profile.website ? (
          <AppPressable
            accessibilityLabel={`Open ${profile.website.label}`}
            onPress={() => void openSafeExternalUrl(profile.website?.url ?? '')}
            style={[styles.metaItem, {gap: spacing[1]}]}>
            <AppIcon name="link" colour={colours.accent} size={16} />
            <AppText variant="caption" colour="accent">
              {profile.website.domain}
            </AppText>
          </AppPressable>
        ) : null}
        {viewer.relationship !== 'owner' && profile.followsViewer ? (
          <View
            accessibilityRole="text"
            accessibilityLabel={`${profile.displayName} follows you`}
            style={styles.metaItem}>
            <AppText variant="caption" colour="textSecondary">
              Follows you
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  handleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  indicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 28,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wrap: {
    minWidth: 0,
  },
})
