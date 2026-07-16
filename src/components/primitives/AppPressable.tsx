import type {PropsWithChildren} from 'react'
import {Pressable, type PressableProps, type StyleProp, type ViewStyle} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type AppPressableProps = PropsWithChildren<
  Omit<PressableProps, 'style'> & {
    style?: StyleProp<ViewStyle>
  }
>

/**
 * Consistent pressable wrapper. Not a full button system.
 */
export function AppPressable({
  children,
  disabled,
  style,
  accessibilityRole = 'button',
  ...rest
}: AppPressableProps) {
  const {motion} = useThemeTokens()

  return (
    <Pressable
      {...rest}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      style={({pressed}) => [
        style,
        {minHeight: 44, minWidth: 44},
        disabled ? {opacity: 0.4} : null,
        pressed && !disabled
          ? {opacity: 0.85, transform: [{scale: motion.pressScale}]}
          : null,
      ]}
    >
      {children}
    </Pressable>
  )
}
