import {Text, type TextProps, type TextStyle} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {SemanticColours, TypographyRole} from '@/theme/contracts'

export type AppTextVariant =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title'
  | 'headline'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'micro'

type ColourKey = keyof SemanticColours | 'text' | 'textSecondary' | 'textTertiary'

type AppTextProps = TextProps & {
  variant?: AppTextVariant
  colour?: ColourKey
}

const variantMap: Record<AppTextVariant, TypographyRole> = {
  display: 'display',
  title1: 'title1',
  title2: 'title2',
  title: 'title2',
  headline: 'headline',
  body: 'body',
  bodyStrong: 'bodyStrong',
  label: 'label',
  caption: 'caption',
  micro: 'micro',
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
  const typeStyle = typography[variantMap[variant]]
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
