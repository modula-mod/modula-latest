import type {CSSProperties} from 'react'

import {scrimColour} from '@/theme/tokens/scrim'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaWebCssVariables = CSSProperties & Record<`--modula-${string}`, string | number>

/** Bridge runtime theme values into web-only headless primitives. */
export function modulaWebCssVariables(
  tokens: ReturnType<typeof useThemeTokens>,
  options: {reduceTransparency?: boolean} = {},
): ModulaWebCssVariables {
  const {colours, motion, radius, resolvedColourMode, spacing} = tokens
  return {
    '--modula-web-accent': colours.accent,
    '--modula-web-accent-foreground': colours.accentForeground,
    '--modula-web-border': colours.border,
    '--modula-web-canvas': colours.canvas,
    '--modula-web-destructive': colours.destructive,
    '--modula-web-focus': colours.accent,
    '--modula-web-overlay': scrimColour(resolvedColourMode, options.reduceTransparency),
    '--modula-web-radius-lg': `${radius.lg}px`,
    '--modula-web-radius-md': `${radius.md}px`,
    '--modula-web-separator': colours.separator,
    '--modula-web-surface': colours.surface,
    '--modula-web-surface-raised': colours.surfaceRaised,
    '--modula-web-text': colours.text,
    '--modula-web-text-secondary': colours.textSecondary,
    '--modula-web-text-tertiary': colours.textTertiary,
    '--modula-web-space-1': `${spacing[1]}px`,
    '--modula-web-space-2': `${spacing[2]}px`,
    '--modula-web-space-3': `${spacing[3]}px`,
    '--modula-web-space-4': `${spacing[4]}px`,
    '--modula-web-space-5': `${spacing[5]}px`,
    '--modula-web-motion-fast': `${motion.fast}ms`,
    '--modula-web-motion-overlay': `${motion.overlay}ms`,
  }
}
