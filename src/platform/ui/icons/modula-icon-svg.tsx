import Svg, {Path} from 'react-native-svg'

import {
  modulaIconDefinition,
  type ModulaIconName,
} from '@/platform/ui/icons/modula-icon-registry'

export type ModulaIconProps = {
  name: ModulaIconName
  size?: number
  colour: string
  /**
   * Icons are decorative by default; interactive parents (buttons, rows)
   * provide the action label. Pass a label only for standalone informative
   * icons.
   */
  accessibilityLabel?: string
  testID?: string
}

const STROKE_WIDTH = 1.7

/**
 * Modula-owned SVG glyph renderer. Deterministic markup — safe for static
 * render and hydration; no icon-font download, so no tofu/404 failure mode.
 */
export function ModulaIconSvg({
  name,
  size = 22,
  colour,
  accessibilityLabel,
  testID,
}: ModulaIconProps) {
  const definition = modulaIconDefinition(name)

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      aria-hidden={accessibilityLabel ? undefined : true}
      testID={testID}>
      {definition.paths.map((path, index) => (
        <Path
          key={index}
          d={path.d}
          fill={path.fill ? colour : 'none'}
          stroke={path.fill ? 'none' : colour}
          strokeWidth={path.fill ? 0 : STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  )
}
