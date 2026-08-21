import {StyleSheet, View, useWindowDimensions} from 'react-native'

import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ProductTabId = 'overview' | 'features' | 'permissions' | 'reviews' | 'related'

export const PRODUCT_TABS: {id: ProductTabId; label: string}[] = [
  {id: 'overview', label: 'Overview'},
  {id: 'features', label: 'Features'},
  {id: 'permissions', label: 'Permissions'},
  {id: 'reviews', label: 'Reviews'},
  {id: 'related', label: 'Related'},
]

export function ProductTabs({selected, onSelect}: {selected: ProductTabId; onSelect: (tab: ProductTabId) => void}) {
  const {colours, radius} = useThemeTokens()
  const {fontScale, width} = useWindowDimensions()
  const scrollable = fontScale > 1.08 || width < 390
  return (
    <View
      style={[
        styles.rail,
        {
          backgroundColor: scrollable ? colours.surface : 'transparent',
          borderRadius: radius.round,
        },
      ]}
      testID="product-tabs">
      <ModulaSegmentedPicker
        accessibilityLabel="Product sections"
        appearance={scrollable ? 'plain' : 'segmented'}
        maxWidth={Math.max(280, width - 32)}
        onValueChange={value => onSelect(value as ProductTabId)}
        options={PRODUCT_TABS.map(tab => ({value: tab.id, label: tab.label}))}
        scrollable={scrollable}
        segmentMinWidth={88}
        value={selected}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  rail: {justifyContent: 'center', minHeight: 42, overflow: 'hidden', paddingVertical: 4},
})
