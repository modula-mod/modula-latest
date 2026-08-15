import {Text, type TextProps, type TextStyle} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {TYPOGRAPHY_SEMANTIC_ALIASES} from '@/theme/contracts/typography'
import type {
  SemanticColours,
  TypographyRole,
  TypographySemanticAlias,
} from '@/theme/contracts'

export type AppTextVariant = TypographyRole | TypographySemanticAlias

type ColourKey = keyof SemanticColours | 'text' | 'textSecondary' | 'textTertiary'

type AppTextProps = TextProps & {
  variant?: AppTextVariant
  colour?: ColourKey
}

function resolveVariant(variant: AppTextVariant): TypographyRole {
  if (variant in TYPOGRAPHY_SEMANTIC_ALIASES) {
    return TYPOGRAPHY_SEMANTIC_ALIASES[variant as TypographySemanticAlias]
  }
  return variant as TypographyRole
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
  const typeStyle = typography[resolveVariant(variant)]
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
