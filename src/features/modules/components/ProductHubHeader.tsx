import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {ProductHubLibraryControl} from '@/features/modules/components/ProductHubLibraryControl'
import {ProductHubSearchChrome} from '@/features/modules/components/ProductHubSearchChrome'
import type {ProductHubSegment} from '@/features/modules/components/ProductHubSegmentedControl'
import {
  isProductHubSearchActive,
  type ProductHubSearchModel,
} from '@/features/modules/state/productHubSearchMachine'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {marketplaceCanvas} from '@/features/modules/identity/marketplaceCanvas'

/**
 * Product Hub chrome contract (PVP-UI-1R).
 *
 * Native `Stack.SearchBar` / large titles were evaluated against SDK 57 types
 * and rejected as the production header: they force the system header visible
 * and cannot carry avatar + morphing search + Surface Types across iOS/Android/web.
 *
 * Idle search is a compact glass control, not a large grey field.
 * Discover / Installed / Updates lives in the chrome, not as a stacked utility block.
 */
export function ProductHubHeader({
  compact,
  search,
  profileName,
  profileUri,
  segment,
  onSegmentChange,
  updatesDisabled,
  wide,
  onSearchTrigger,
  onSearchChange,
  onSearchCancel,
  onSearchSettled,
  onProfilePress,
}: {
  compact: boolean
  search: ProductHubSearchModel
  profileName: string
  profileUri?: string
  segment: ProductHubSegment
  onSegmentChange: (value: ProductHubSegment) => void
  updatesDisabled?: boolean
  wide: boolean
  onSearchTrigger: () => void
  onSearchChange: (text: string) => void
  onSearchCancel: () => void
  onSearchSettled: () => void
  onProfilePress: () => void
}) {
  const {colours, spacing, resolvedColourMode} = useThemeTokens()
  const canvas = marketplaceCanvas(resolvedColourMode, colours.canvas)
  const searchActive = isProductHubSearchActive(search.state)
  const collapsed = compact || searchActive

  return (
    <View
      testID="product-hub-header"
      style={[styles.chrome, {paddingHorizontal: spacing[4], backgroundColor: canvas}]}>
      <View style={styles.titleRow}>
        {searchActive ? null : (
          <AppText
            variant={collapsed ? 'screenCompactTitle' : 'screenLargeTitle'}
            numberOfLines={1}
            accessibilityRole="header"
            style={styles.title}>
            Product Hub
          </AppText>
        )}
        <View style={styles.titleActions}>
          <ProductHubSearchChrome
            model={search}
            compact={!searchActive}
            onTrigger={onSearchTrigger}
            onChangeText={onSearchChange}
            onCancel={onSearchCancel}
            onSettled={onSearchSettled}
          />
          {searchActive ? null : (
            <ProductHubLibraryControl
              value={segment}
              onChange={onSegmentChange}
              updatesDisabled={updatesDisabled}
              wide={wide}
            />
          )}
          <AppPressable accessibilityLabel="Open profile" onPress={onProfilePress}>
            <Avatar name={profileName} uri={profileUri} size={32} />
          </AppPressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chrome: {width: '100%'},
  title: {flexShrink: 1, minWidth: 0, paddingRight: 12},
  titleActions: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingBottom: 8,
  },
})
