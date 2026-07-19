import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ModulaTitleIconButtonProps = {
  icon: AppIconName
  label: string
  onPress?: () => void
  disabled?: boolean
  chrome?: 'plain' | 'bordered' | 'prominent'
  stretch?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Web / Android fallback — stretched icon + label pill (no glass disc).
 */
export function ModulaTitleIconButton({
  icon,
  label,
  onPress,
  disabled,
  chrome = 'plain',
  stretch = false,
  style,
  testID,
}: ModulaTitleIconButtonProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const prominent = chrome === 'prominent'
  const bordered = chrome === 'bordered' || prominent

  return (
    <AppPressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: prominent
            ? colours.accent
            : bordered
              ? colours.surfaceRaised
              : 'transparent',
          borderColor: prominent
            ? colours.accentBorder
            : bordered
              ? colours.border
              : 'transparent',
          borderRadius: radius.round,
          gap: spacing[2],
          minWidth: stretch ? 132 : undefined,
          paddingHorizontal: stretch ? spacing[4] : spacing[3],
        },
        style,
      ]}>
      <AppIcon
        name={icon}
        size={16}
        colour={prominent ? colours.accentForeground : colours.accent}
      />
      <AppText
        variant="label"
        style={{
          color: prominent ? colours.accentForeground : colours.text,
          flexShrink: 0,
        }}>
        {label}
      </AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 40,
  },
})
