import {StyleSheet, View} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ProfileAction = {
  label: string
  icon: AppIconName
  primary?: boolean
  onPress: () => void
}

export function ProfileActions({actions}: {actions: ProfileAction[]}) {
  const {colours, spacing} = useThemeTokens()

  return (
    <View style={[styles.wrap, {gap: spacing[2]}]}>
      {actions.map(action => (
        <AppPressable
          key={action.label}
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={[
            styles.action,
            {
              backgroundColor: action.primary ? colours.accent : colours.surface2,
              borderColor: action.primary ? colours.accent : colours.border,
            },
          ]}>
          <AppIcon
            name={action.icon}
            colour={action.primary ? colours.accentForeground : colours.textSub}
          />
          <AppText
            variant="label"
            colour={action.primary ? 'accentForeground' : 'textMain'}>
            {action.label}
          </AppText>
        </AppPressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
