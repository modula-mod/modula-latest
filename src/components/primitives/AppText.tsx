import {Text, type TextProps, type TextStyle} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type AppTextVariant =
  | 'display'
  | 'title'
  | 'headline'
  | 'body'
  | 'label'
  | 'caption'

type ColourKey =
  | 'text'
  | 'textSecondary'
  | 'textTertiary'
  | 'accent'
  | 'accentForeground'
  | 'destructive'
  | 'success'

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
  const {colours, typography} = useThemeTokens()
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
