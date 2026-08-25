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

/** Longest product tab label — sized so nothing truncates in the scroll rail. */
const PRODUCT_TAB_SEGMENT_MIN_WIDTH = 108

export function ProductTabs({selected, onSelect}: {selected: ProductTabId; onSelect: (tab: ProductTabId) => void}) {
  const {colours, radius} = useThemeTokens()
  const {width} = useWindowDimensions()
  return (
    <View
      style={[
        styles.rail,
        {
          backgroundColor: colours.surface,
          borderRadius: radius.round,
        },
      ]}
      testID="product-tabs">
      <ModulaSegmentedPicker
        accessibilityLabel="Product sections"
        appearance="track"
        embedded
        maxWidth={Math.max(280, width - 32)}
        onValueChange={value => onSelect(value as ProductTabId)}
        options={PRODUCT_TABS.map(tab => ({value: tab.id, label: tab.label}))}
        scrollable
        segmentMinWidth={PRODUCT_TAB_SEGMENT_MIN_WIDTH}
        value={selected}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  rail: {justifyContent: 'center', minHeight: 42, overflow: 'hidden', paddingVertical: 4},
})
