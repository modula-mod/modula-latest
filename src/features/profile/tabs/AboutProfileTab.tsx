import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useSession} from '@/auth/runtime'
import {usePrimaryAtprotoConnection} from '@/features/atproto/data/useAtprotoConnectionsQuery'
import {useAtprotoCapability} from '@/features/atproto/data/useApiMetadataQuery'
import {
  canViewerSeeProfileField,
  type ProfileKind,
} from '@/features/profile/contracts/profile'
import {SectionHeader} from '@/platform/ui/chrome/section-header'
import {IdentityIndicator} from '@/features/profile/components/IdentityIndicator'
import type {ProfileTabRendererProps} from '@/features/profile/contracts/profileTabs'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const kindLabels: Record<ProfileKind, string> = {
  person: 'Person',
  creator: 'Creator',
  professional: 'Professional',
  organisation: 'Organisation',
  team: 'Team',
}

export function AboutProfileTab({profile, viewer}: ProfileTabRendererProps) {
  const {spacing} = useThemeTokens()
  const session = useSession()
  const oauthEnabled = useAtprotoCapability('atprotoOAuth')
  const {connection} = usePrimaryAtprotoConnection()
  const visibleClaims = profile.identityClaims.filter(claim =>
    canViewerSeeProfileField(claim.visibility, viewer.relationship),
  )
  const isOwnProfile =
    session.status === 'signedIn' &&
    (session.profile.handle === profile.handle || session.profile.id === profile.id)
  const showAtConnection =
    oauthEnabled && isOwnProfile && connection?.status === 'connected' && connection.handle

  return (
    <View style={[styles.wrap, {gap: spacing[4], padding: spacing[4]}]}>
      <View style={{gap: spacing[2]}}>
        <SectionHeader title="About" icon="profile" />
        {profile.bio ? <AppText variant="body">{profile.bio}</AppText> : null}
      </View>
      <Surface variant="plain" style={[styles.infoGrid, {gap: spacing[3]}]}>
        <InfoItem label="Profile type" value={kindLabels[profile.kind]} />
        {profile.location &&
        canViewerSeeProfileField(profile.location.visibility, viewer.relationship) ? (
          <InfoItem label="Location" value={profile.location.label} />
        ) : null}
        {profile.website &&
        canViewerSeeProfileField(profile.website.visibility, viewer.relationship) ? (
          <InfoItem label="Website" value={profile.website.domain} />
        ) : null}
        <InfoItem
          label="Modula member since"
          value={new Date(profile.joinedAt).toLocaleDateString(undefined, {
            month: 'long',
            year: 'numeric',
          })}
        />
        {showAtConnection ? (
          <InfoItem label="Connected networks" value={`AT Protocol · @${connection.handle}`} />
        ) : null}
      </Surface>
      {visibleClaims.length ? (
        <View style={{gap: spacing[2]}}>
          <SectionHeader title="Identity indicators" icon="verified" />
          <View style={[styles.claims, {gap: spacing[2]}]}>
            {visibleClaims.map(claim => (
              <IdentityIndicator key={claim.id} claim={claim} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={{gap: spacing[2]}}>
        <SectionHeader title="Interests" icon="sparkles" />
        <AppText variant="body" colour="textSecondary">
          Profile OS, governed intelligence, modular tools, design systems and public workflows.
        </AppText>
      </View>
    </View>
  )
}

function InfoItem({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.infoItem}>
      <AppText variant="caption" colour="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  claims: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    flexBasis: '46%',
    flexGrow: 1,
    gap: 3,
    minWidth: 180,
  },
  wrap: {
    minWidth: 0,
  },
})
