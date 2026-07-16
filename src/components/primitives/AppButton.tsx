import type {PropsWithChildren} from 'react'
import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

type AppButtonProps = PropsWithChildren<{
  onPress?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}>

export function AppButton({
  children,
  onPress,
  disabled,
  variant = 'primary',
  style,
  accessibilityLabel,
}: AppButtonProps) {
  const {colours, radius, spacing} = useTheme()

  const backgroundColor =
    variant === 'primary'
      ? colours.accent
      : variant === 'secondary'
        ? colours.surface
        : 'transparent'

  const borderColor = variant === 'secondary' ? colours.border : 'transparent'
  const labelColour =
    variant === 'primary' ? 'accentForeground' : ('text' as const)

  return (
    <AppPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderWidth: variant === 'secondary' ? 1 : 0,
        },
        style,
      ]}>
      {typeof children === 'string' ? (
        <AppText variant="label" colour={labelColour}>
          {children}
        </AppText>
      ) : (
        children
      )}
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
