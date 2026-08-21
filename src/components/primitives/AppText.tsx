import {StyleSheet, Text, useWindowDimensions, type TextProps, type TextStyle} from 'react-native'

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
  const {fontScale} = useWindowDimensions()
  const typeStyle = typography[resolveVariant(variant)]
  const suppliedStyle = StyleSheet.flatten(style)
  const baseLineHeight = suppliedStyle?.lineHeight ?? typeStyle.lineHeight
  const colourStyle: TextStyle = {
    color: colours[colour],
  }
  // React Native scales the glyph size for Dynamic Type but an explicit
  // lineHeight remains device-independent on iOS. Scale that metric alongside
  // the font so accessibility sizes do not crop ascenders and descenders.
  const dynamicLineHeight: TextStyle = {
    lineHeight: Math.round(baseLineHeight * Math.max(1, fontScale)),
  }

  return (
    <Text
      {...rest}
      allowFontScaling
      style={[typeStyle, colourStyle, style, dynamicLineHeight]}>
      {children}
    </Text>
  )
}
