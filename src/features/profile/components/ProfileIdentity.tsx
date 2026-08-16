import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {
  ModulaProfile,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileIdentityProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
  compact?: boolean
}

/**
 * Display name, verification, handle, and pronouns. Bio and metadata live in
 * the information column so the name is not duplicated.
 */
export function ProfileIdentity({profile, compact}: ProfileIdentityProps) {
  const {colours, spacing} = useThemeTokens()
  const verified = profile.identityClaims.some(claim => claim.status === 'verified')
  const handleLine = profile.pronouns
    ? `@${profile.handle} · ${profile.pronouns}`
    : `@${profile.handle}`

  return (
    <View style={[styles.wrap, {gap: compact ? 2 : spacing[1]}]}>
      <View style={[styles.handleRow, {gap: spacing[1]}]}>
        <AppText variant="title2" numberOfLines={3} style={styles.name}>
          {profile.displayName}
        </AppText>
        {verified ? <ModulaIcon name="verified" colour={colours.text} size={16} /> : null}
      </View>
      <AppText variant="caption" colour="textSecondary" selectable numberOfLines={2}>
        {handleLine}
      </AppText>
    </View>
  )
}

export function ProfileBio({
  profile,
  compact,
}: {
  profile: ModulaProfile
  compact?: boolean
}) {
  if (!profile.bio) return null
  return (
    <AppText variant="body" style={[styles.bio, compact ? styles.bioCompact : null]}>
      {profile.bio}
    </AppText>
  )
}

const styles = StyleSheet.create({
  bio: {
    lineHeight: 20,
  },
  bioCompact: {
    lineHeight: 19,
  },
  handleRow: {
    alignItems: 'center',
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
