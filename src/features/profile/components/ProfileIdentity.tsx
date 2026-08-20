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
  /**
   * `trailing` is the hero composition: the identity rides the raised plateau
   * and reads back towards the portrait in the leading gutter.
   */
  align?: 'leading' | 'trailing'
  emphasis?: 'hero' | 'inline'
}

/**
 * Display name, verification, handle, and pronouns. Bio and metadata live in
 * the information column so the name is not duplicated.
 */
export function ProfileIdentity({
  profile,
  compact,
  align = 'leading',
  emphasis = 'inline',
}: ProfileIdentityProps) {
  const {colours, spacing} = useThemeTokens()
  const verified = profile.identityClaims.some(claim => claim.status === 'verified')
  const handleLine = profile.pronouns
    ? `@${profile.handle} · ${profile.pronouns}`
    : `@${profile.handle}`
  const trailing = align === 'trailing'

  return (
    <View
      style={[
        styles.wrap,
        {gap: compact ? 2 : spacing[1]},
        trailing ? styles.wrapTrailing : null,
      ]}>
      <View
        style={[
          styles.handleRow,
          {gap: spacing[1]},
          trailing ? styles.handleRowTrailing : null,
        ]}>
        <AppText
          variant={emphasis === 'hero' ? 'title1' : 'title2'}
          numberOfLines={3}
          style={[styles.name, trailing ? styles.nameTrailing : null]}>
          {profile.displayName}
        </AppText>
        {verified ? (
          <ModulaIcon
            name="verified"
            colour={colours.info}
            size={emphasis === 'hero' ? 18 : 16}
          />
        ) : null}
      </View>
      <AppText
        variant="caption"
        colour="textSecondary"
        selectable
        numberOfLines={2}
        style={trailing ? styles.nameTrailing : null}>
        {handleLine}
      </AppText>
    </View>
  )
}

export function ProfileBio({
  profile,
  compact,
  maxLines,
}: {
  profile: ModulaProfile
  compact?: boolean
  maxLines?: number
}) {
  if (!profile.bio) return null
  return (
    <AppText
      variant="body"
      numberOfLines={maxLines}
      style={[styles.bio, compact ? styles.bioCompact : null]}>
      {profile.bio}
    </AppText>
  )
}

const styles = StyleSheet.create({
  bio: {
    lineHeight: 20,
  },
  bioCompact: {
    lineHeight: 18,
  },
  handleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  handleRowTrailing: {
    justifyContent: 'flex-end',
  },
  name: {
    flexShrink: 1,
  },
  nameTrailing: {
    textAlign: 'right',
  },
  wrap: {
    minWidth: 0,
  },
  wrapTrailing: {
    alignItems: 'flex-end',
  },
})
