import {StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import type {ProfileLink} from '@/features/profile/contracts/profile'
import {ProfileVisibilityBadge} from '@/features/profile/components/ProfileVisibilityBadge'
import {openSafeExternalUrl} from '@/lib/safeExternalUrl'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileLinkCardProps = {
  link: ProfileLink
}

export function ProfileLinkCard({link}: ProfileLinkCardProps) {
  const {colours, spacing} = useThemeTokens()

  return (
    <AppPressable
      accessibilityLabel={`Open ${link.label}`}
      accessibilityHint={`Opens ${link.domain} in a browser`}
      onPress={() => void openSafeExternalUrl(link.url)}>
      <Surface
        variant="contained"
        style={[styles.row, {gap: spacing[3], padding: spacing[3]}]}>
        <View style={styles.icon}>
          <AppIcon name="link" colour={colours.accent} />
        </View>
        <View style={styles.body}>
          <AppText variant="label">{link.label}</AppText>
          <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
            {link.domain}
          </AppText>
        </View>
        <ProfileVisibilityBadge visibility={link.visibility} contextLabel={link.label} />
      </Surface>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minWidth: 0,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
