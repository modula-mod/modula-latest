import {StyleSheet, View} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileTabEmptyStateProps = {
  icon: AppIconName
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
      <View
        style={[
          styles.icon,
          {
            backgroundColor: colours.accentSubtle,
            borderColor: colours.accentBorder,
            borderRadius: radius.round,
          },
        ]}>
        <AppIcon name={icon} colour={colours.accent} />
      </View>
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
  },
  center: {
    textAlign: 'center',
  },
  icon: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
