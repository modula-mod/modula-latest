import type {ReactNode} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaToolbarVariant = 'navigation' | 'content' | 'editor' | 'floating' | 'module'

export type ModulaToolbarProps = {
  children: ReactNode
  variant?: ModulaToolbarVariant
  leading?: ReactNode
  trailing?: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Shared alignment, density and inherited surface treatment for toolbars. */
export function ModulaToolbar({
  children,
  variant = 'content',
  leading,
  trailing,
  style,
  testID,
}: ModulaToolbarProps) {
  const {controls, radius, spacing} = useThemeTokens()
  const floating = variant === 'floating'
  return (
    <MaterialSurface
      accessibilityRole="toolbar"
      role={floating ? 'floating' : variant === 'navigation' ? 'navigation' : 'control'}
      style={[
        styles.root,
        {
          borderRadius: floating ? radius.round : radius.medium,
          gap: spacing[2],
          minHeight: floating ? controls.toolbar.floating : controls.toolbar.minimum,
          paddingHorizontal: spacing[2],
        },
        style,
      ]}
      testID={testID}>
      {leading}
      <View style={[styles.body, {gap: spacing[2]}]}>{children}</View>
      {trailing}
    </MaterialSurface>
  )
}

export const NavigationToolbar = (props: Omit<ModulaToolbarProps, 'variant'>) => (
  <ModulaToolbar {...props} variant="navigation" />
)
export const ContentToolbar = (props: Omit<ModulaToolbarProps, 'variant'>) => (
  <ModulaToolbar {...props} variant="content" />
)
export const EditorToolbar = (props: Omit<ModulaToolbarProps, 'variant'>) => (
  <ModulaToolbar {...props} variant="editor" />
)
export const FloatingToolbar = (props: Omit<ModulaToolbarProps, 'variant'>) => (
  <ModulaToolbar {...props} variant="floating" />
)
export const ModuleToolbar = (props: Omit<ModulaToolbarProps, 'variant'>) => (
  <ModulaToolbar {...props} variant="module" />
)

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  root: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
