import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModulaToggleGroupProps} from '@/platform/ui/controls/modula-toggle-group.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaToggleGroupItem, ModulaToggleGroupProps} from '@/platform/ui/controls/modula-toggle-group.types'

/** Compact semantic toolbar toggle set; native keeps the existing token stack. */
export function ModulaToggleGroup({
  items,
  value,
  onValueChange,
  selectionMode = 'multiple',
  accessibilityLabel = 'Options',
  disabled,
  testID,
}: ModulaToggleGroupProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const select = (id: string) => {
    if (selectionMode === 'single') return onValueChange(value.includes(id) ? [] : [id])
    onValueChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id])
  }
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="toolbar"
      style={[styles.group, {borderColor: colours.border, borderRadius: radius.medium, padding: spacing[1]}]}
      testID={testID}>
      {items.map(item => {
        const active = value.includes(item.id)
        return (
          <AppPressable
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityRole="button"
            accessibilityState={{selected: active, disabled: disabled || item.disabled}}
            disabled={disabled || item.disabled}
            key={item.id}
            onPress={() => select(item.id)}
            style={[styles.item, {backgroundColor: active ? colours.surfaceRaised : 'transparent', borderRadius: radius.small, paddingHorizontal: spacing[3]}]}>
            <AppText variant="label" colour={active ? 'text' : 'textSecondary'}>{item.label}</AppText>
          </AppPressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: {alignSelf: 'flex-start', flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth},
  item: {minHeight: 44, alignItems: 'center', justifyContent: 'center'},
})
