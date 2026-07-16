import {StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import type {ProfileModulePreview} from '@/features/profile/data/demoProfileModules'
import {ProfileVisibilityBadge} from '@/features/profile/components/ProfileVisibilityBadge'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileModuleCardProps = {
  module: ProfileModulePreview
}

const statusLabels: Record<ProfileModulePreview['status'], string> = {
  featured: 'Featured',
  available: 'Available',
  preview: 'Preview',
}

export function ProfileModuleCard({module}: ProfileModuleCardProps) {
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <Surface
      variant="contained"
      style={[styles.card, {gap: spacing[3], padding: spacing[3]}]}>
      <View
        style={[
          styles.icon,
          {backgroundColor: colours.accentSubtle, borderRadius: radius.medium},
        ]}>
        <AppIcon name={module.icon} colour={colours.accent} />
      </View>
      <View style={styles.body}>
        <View style={[styles.titleRow, {gap: spacing[2]}]}>
          <AppText variant="headline" numberOfLines={1} style={styles.title}>
            {module.name}
          </AppText>
          <AppText variant="caption" colour="accent">
            {statusLabels[module.status]}
          </AppText>
        </View>
        <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
          {module.description}
        </AppText>
      </View>
      <ProfileVisibilityBadge
        visibility={module.visibility}
        contextLabel={`${module.name} module`}
      />
    </Surface>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  card: {
    minHeight: 112,
  },
  icon: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
