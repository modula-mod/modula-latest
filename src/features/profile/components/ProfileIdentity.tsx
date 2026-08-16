import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  canViewerSeeProfileField,
  type ModulaProfile,
  type ProfileViewerContext,
} from '@/features/profile/contracts/profile'
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
    month: 'short',
    year: 'numeric',
  })

  return (
    <View style={[styles.wrap, {gap: compact ? spacing[2] : spacing[3]}]}>
      <View style={{gap: spacing[1]}}>
        <View style={[styles.handleRow, {gap: spacing[2]}]}>
          <AppText variant="title2" numberOfLines={3} style={styles.name}>
            {profile.displayName}
          </AppText>
          {verified ? <ModulaIcon name="verified" colour={colours.text} size={18} /> : null}
        </View>
        <AppText variant="caption" colour="textSecondary" selectable>
          @{profile.handle}
          {profile.pronouns ? ` · ${profile.pronouns}` : ''}
        </AppText>
      </View>

      {profile.bio ? (
        <AppText variant="body" style={styles.bio}>
          {profile.bio}
        </AppText>
      ) : null}

      <View style={[styles.metadata, {gap: spacing[1]}]}>
        <View style={[styles.metaRow, {gap: spacing[3]}]}>
          <View style={[styles.metaItem, {gap: spacing[1]}]}>
            <ModulaIcon name="clock" colour={colours.textSecondary} size={14} />
            <AppText variant="caption" colour="textSecondary">
              Joined {joined}
            </AppText>
          </View>
          {locationVisible ? (
            <View style={[styles.metaItem, {gap: spacing[1]}]}>
              <ModulaIcon name="community" colour={colours.textSecondary} size={14} />
              <AppText variant="caption" colour="textSecondary">
                {profile.location?.label}
              </AppText>
            </View>
          ) : null}
        </View>
        {websiteVisible && profile.website ? (
          <AppPressable
            accessibilityLabel={`Open ${profile.website.label}`}
            onPress={() => void openSafeExternalUrl(profile.website?.url ?? '')}
            style={[styles.metaItem, {gap: spacing[1]}]}>
            <ModulaIcon name="link" colour={colours.textSecondary} size={14} />
            <AppText variant="caption" colour="text">
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
  bio: {
    lineHeight: 22,
  },
  handleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 22,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metadata: {
    minWidth: 0,
  },
  name: {
    flexShrink: 1,
  },
  wrap: {
    minWidth: 0,
  },
})
