import {Text, type TextProps, type TextStyle} from 'react-native'

import {typography} from '@/theme/foundations/typography'
import {lightSemanticColours} from '@/theme/tokens/semantic'

export type AppTextVariant =
  | 'display'
  | 'title'
  | 'body'
  | 'label'
  | 'caption'

type AppTextProps = TextProps & {
  variant?: AppTextVariant
  colour?: 'text' | 'textSecondary' | 'accent' | 'accentForeground' | 'destructive'
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
  const typeStyle = typography[variant]
  const colourStyle: TextStyle = {
    color: lightSemanticColours[colour],
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
