import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileTabEmptyStateProps = {
  icon: ModulaIconName
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function ProfileTabEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: ProfileTabEmptyStateProps) {
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.wrap, {gap: spacing[3], padding: spacing[5]}]}>
      <ModulaIcon name={icon} colour={colours.textTertiary} size={28} />
      <View style={{gap: spacing[1]}}>
        <AppText variant="headline" style={styles.center}>
          {title}
        </AppText>
        <AppText variant="body" colour="textSecondary" style={styles.center}>
          {description}
        </AppText>
      </View>
      {actionLabel && onAction ? (
        <AppPressable
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={[
            styles.action,
            {
              backgroundColor: colours.accent,
              borderRadius: radius.round,
              paddingHorizontal: spacing[4],
            },
          ]}>
          <AppText variant="label" style={{color: colours.accentForeground}}>
            {actionLabel}
          </AppText>
        </AppPressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  center: {
    textAlign: 'center',
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
