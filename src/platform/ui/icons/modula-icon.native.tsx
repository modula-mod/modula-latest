import {Icon} from '@expo/ui'
import {Platform, View} from 'react-native'

import {
  ModulaIconSvg,
  type ModulaIconProps,
} from '@/platform/ui/icons/modula-icon-svg'
import {modulaIconDefinition} from '@/platform/ui/icons/modula-icon-registry'

/**
 * Canonical Modula icon — native adapter.
 * iOS renders the mapped SF Symbol through the installed `@expo/ui`
 * universal Icon (no Host required for universal components).
 * Android renders the Modula-owned SVG glyph (no `@expo/material-symbols`
 * dependency admitted; react-native-svg is the legitimate fallback).
 */
export function ModulaIcon(props: ModulaIconProps) {
  const {name, size = 22, colour, accessibilityLabel, testID} = props

  if (Platform.OS === 'ios') {
    const definition = modulaIconDefinition(name)
    return (
      <View
        accessible={Boolean(accessibilityLabel)}
        accessibilityRole={accessibilityLabel ? 'image' : undefined}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={{width: size, height: size}}>
        <Icon name={definition.sf} size={size} color={colour} />
      </View>
    )
  }

  return <ModulaIconSvg {...props} />
}
