import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  canViewerSeeProfileField,
  type ModulaProfile,
  type ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {ProfileVisibilityBadge} from '@/features/profile/components/ProfileVisibilityBadge'
import {openSafeExternalUrl} from '@/lib/safeExternalUrl'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileIdentityProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
  compact?: boolean
}

export function ProfileIdentity({profile, viewer, compact}: ProfileIdentityProps) {
  const {colours, spacing} = useThemeTokens()
  const locationVisible =
    profile.location &&
    canViewerSeeProfileField(profile.location.visibility, viewer.relationship)
  const websiteVisible =
    profile.website &&
    canViewerSeeProfileField(profile.website.visibility, viewer.relationship)
  const verified = profile.identityClaims.some(claim => claim.status === 'verified')
  const joined = new Date(profile.joinedAt).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <View style={[styles.wrap, {gap: compact ? spacing[2] : spacing[3]}]}>
      <View style={{gap: spacing[1]}}>
        <View style={[styles.handleRow, {gap: spacing[2]}]}>
          <AppText variant={compact ? 'title2' : 'display'} numberOfLines={2} style={styles.name}>
            {profile.displayName}
          </AppText>
          {verified ? <ModulaIcon name="verified" colour={colours.text} size={18} /> : null}
        </View>
        <AppText variant="body" colour="textSecondary" selectable>
          @{profile.handle}
          {profile.pronouns ? ` · ${profile.pronouns}` : ''}
        </AppText>
      </View>

      {profile.bio ? <AppText variant="body">{profile.bio}</AppText> : null}

      <View style={[styles.metadata, {gap: spacing[2]}]}>
        <View style={[styles.metaItem, {gap: spacing[1]}]}>
          <ModulaIcon name="clock" colour={colours.textSecondary} size={16} />
          <AppText variant="caption" colour="textSecondary">
            Joined {joined}
          </AppText>
        </View>
        {locationVisible ? (
          <View style={[styles.metaItem, {gap: spacing[1]}]}>
            <ModulaIcon name="community" colour={colours.textSecondary} size={16} />
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
            <ModulaIcon name="link" colour={colours.text} size={16} />
            <AppText variant="caption" colour="textSecondary">
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
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 28,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  name: {
    flexShrink: 1,
  },
  wrap: {
    minWidth: 0,
  },
})
