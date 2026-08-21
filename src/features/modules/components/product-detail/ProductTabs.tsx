import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
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
  const scrollable = fontScale > 1.15 || width < 380
  const tabs = PRODUCT_TABS.map(tab => {
    const active = tab.id === selected
    return (
      <AppPressable
        key={tab.id}
        accessibilityRole="tab"
        accessibilityLabel={`${tab.label} tab`}
        accessibilityState={{selected: active}}
        onPress={() => onSelect(tab.id)}
        style={[
          styles.tab,
          scrollable ? styles.scrollTab : styles.fitTab,
          {backgroundColor: active ? colours.surfaceRaised : 'transparent', borderRadius: radius.round},
        ]}>
        <AppText variant="caption" numberOfLines={1} adjustsFontSizeToFit style={[styles.label, {fontWeight: active ? '700' : '500'}]}>
          {tab.label}
        </AppText>
        {active ? <View style={[styles.indicator, {backgroundColor: colours.accent}]} /> : null}
      </AppPressable>
    )
  })
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.rail, {backgroundColor: colours.surface, borderRadius: radius.round}]}
      testID="product-tabs">
      {scrollable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
          {tabs}
        </ScrollView>
      ) : (
        <View style={styles.content}>{tabs}</View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  content: {alignItems: 'stretch', flexDirection: 'row', flexGrow: 1},
  fitTab: {flex: 1, minWidth: 0},
  indicator: {bottom: 1, height: 2, left: 12, position: 'absolute', right: 12},
  label: {fontSize: 11, lineHeight: 14},
  rail: {minHeight: 44, overflow: 'hidden'},
  scrollTab: {minWidth: 92},
  tab: {alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 6},
})
