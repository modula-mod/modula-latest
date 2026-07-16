import {Text, type TextProps, type TextStyle} from 'react-native'

import {useTheme} from '@/theme/runtime/useTheme'

export type AppTextVariant =
  | 'display'
  | 'title'
  | 'body'
  | 'label'
  | 'caption'

type ColourKey = 'text' | 'textSecondary' | 'accent' | 'accentForeground' | 'destructive'

type AppTextProps = TextProps & {
  variant?: AppTextVariant
  colour?: ColourKey
}

/**
 * Central typography primitive. Prefer variants over ad-hoc font styles.
 */
export function AppText({
  variant = 'body',
  colour = 'text',
  style,
  children,
  ...rest
}: AppTextProps) {
  const {colours, typography} = useTheme()
  const typeStyle = typography[variant]
  const colourStyle: TextStyle = {
    color: colours[colour],
  }

  return (
    <Text
      {...rest}
      allowFontScaling
      style={[typeStyle, colourStyle, style]}>
      {children}
    </Text>
  )
}
