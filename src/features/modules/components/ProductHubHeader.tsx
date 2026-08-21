import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {ProductHubSearchChrome} from '@/features/modules/components/ProductHubSearchChrome'
import {
  isProductHubSearchActive,
  type ProductHubSearchModel,
} from '@/features/modules/state/productHubSearchMachine'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Product Hub chrome contract.
 *
 * Native `Stack.SearchBar` / large titles were evaluated against SDK 57 types
 * and rejected as the production header: they force the system header visible
 * and cannot carry avatar + morphing search + Surface Types across iOS/Android/web.
 */
export function ProductHubHeader({
  compact,
  search,
  profileName,
  profileUri,
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
  onSearchTrigger: () => void
  onSearchChange: (text: string) => void
  onSearchCancel: () => void
  onSearchSettled: () => void
  onProfilePress: () => void
}) {
  const {colours, spacing} = useThemeTokens()
  const searchActive = isProductHubSearchActive(search.state)
  const collapsed = compact || searchActive

  return (
    <View
      testID="product-hub-header"
      style={[styles.chrome, {paddingHorizontal: spacing[4], backgroundColor: colours.canvas}]}>
      <View style={styles.titleRow}>
        <AppText
          variant={collapsed ? 'screenCompactTitle' : 'screenLargeTitle'}
          numberOfLines={1}
          accessibilityRole="header"
          style={styles.title}>
          Product Hub
        </AppText>
        <View style={styles.titleActions}>
          {collapsed ? (
            <ProductHubSearchChrome
              model={search}
              compact={compact && !searchActive}
              onTrigger={onSearchTrigger}
              onChangeText={onSearchChange}
              onCancel={onSearchCancel}
              onSettled={onSearchSettled}
            />
          ) : null}
          <AppPressable accessibilityLabel="Open profile" onPress={onProfilePress}>
            <Avatar name={profileName} uri={profileUri} size={32} />
          </AppPressable>
        </View>
      </View>
      {!collapsed && !searchActive ? (
        <View style={{gap: spacing[3], paddingBottom: spacing[3]}} testID="product-hub-header-idle">
          <AppText variant="editorialSubtitle" colour="textSecondary">
            Discover modules, tools and more.
          </AppText>
          <ProductHubSearchChrome
            model={search}
            compact={false}
            onTrigger={onSearchTrigger}
            onChangeText={onSearchChange}
            onCancel={onSearchCancel}
            onSettled={onSearchSettled}
          />
        </View>
      ) : null}
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
  },
})
