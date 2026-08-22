import {StyleSheet, View} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {ProductHubSearchChrome} from '@/features/modules/components/ProductHubSearchChrome'
import {PRODUCT_HUB_LIBRARY_ACTIONS} from '@/features/modules/components/ProductHubLibraryControl'
import {type ProductHubSegment} from '@/features/modules/components/ProductHubSegmentedControl'
import {
  isProductHubSearchActive,
  type ProductHubSearchModel,
} from '@/features/modules/state/productHubSearchMachine'
import {useReduceMotion} from '@/lib/accessibility'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {HEADER_ICON_PAIR_GAP} from '@/platform/ui/navigation/plain-header-items'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Matches Product Hub scroll collapse distance (`COMPACT_ON`). */
export const PRODUCT_HUB_TITLE_MORPH = 56

/**
 * Product Hub chrome contract (PVP-UI-1R).
 *
 * Progressive blur lives behind this row. Search + Discover share the Home
 * control group (44pt glyphs, 22pt gap, one glass capsule). Profile stays
 * outside the group. Native `Stack.SearchBar` remains evaluated and rejected
 * for production chrome (see docs/research/pvp-ui-1r-native-experiments.md).
 */
export function ProductHubHeader({
  compact,
  scrollY,
  search,
  profileName,
  profileUri,
  segment,
  onSegmentChange,
  updatesDisabled,
  wide: _wide,
  onSearchTrigger,
  onSearchChange,
  onSearchCancel,
  onSearchSettled,
  onProfilePress,
}: {
  compact: boolean
  scrollY?: SharedValue<number>
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
  const {spacing} = useThemeTokens()
  const searchActive = isProductHubSearchActive(search.state)

  return (
    <View
      testID="product-hub-header"
      style={[styles.chrome, {paddingHorizontal: spacing[4]}]}>
      <View style={styles.titleRow}>
        {searchActive ? null : (
          <ProductHubMorphTitle compact={compact} scrollY={scrollY} />
        )}
        <View style={[styles.titleActions, searchActive ? styles.titleActionsExpand : null]}>
          {searchActive ? (
            <ProductHubSearchChrome
              model={search}
              compact={!searchActive}
              onTrigger={onSearchTrigger}
              onChangeText={onSearchChange}
              onCancel={onSearchCancel}
              onSettled={onSearchSettled}
            />
          ) : (
            <ChromeGlassControlGroup
              items={[
                {
                  kind: 'button',
                  icon: 'search',
                  accessibilityLabel: 'Search Product Hub',
                  onPress: onSearchTrigger,
                },
                {
                  kind: 'menu',
                  icon: 'discover',
                  accessibilityLabel: `Library, ${libraryLabel(segment)}`,
                  title: 'Library',
                  actions: PRODUCT_HUB_LIBRARY_ACTIONS.map(action => ({
                    ...action,
                    disabled: action.id === 'updates' && updatesDisabled,
                  })),
                  onAction: id => {
                    if (id === 'discover' || id === 'installed' || id === 'updates') {
                      onSegmentChange(id)
                    }
                  },
                },
              ]}
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

function libraryLabel(segment: ProductHubSegment): string {
  if (segment === 'installed') return 'Installed'
  if (segment === 'updates') return 'Updates'
  return 'Discover'
}

function ProductHubMorphTitle({
  compact,
  scrollY,
}: {
  compact: boolean
  scrollY?: SharedValue<number>
}) {
  const {colours} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const collapsed = compact

  const largeStyle = useAnimatedStyle(() => {
    const p = scrollY
      ? interpolate(scrollY.value, [0, PRODUCT_HUB_TITLE_MORPH], [0, 1], Extrapolation.CLAMP)
      : collapsed
        ? 1
        : 0
    if (reduceMotion) {
      return {opacity: p > 0.5 ? 0 : 1}
    }
    return {
      opacity: 1 - p,
      transform: [{translateY: p * -8}, {scale: 1 - p * 0.42}],
    }
  })

  const compactStyle = useAnimatedStyle(() => {
    const p = scrollY
      ? interpolate(scrollY.value, [0, PRODUCT_HUB_TITLE_MORPH], [0, 1], Extrapolation.CLAMP)
      : collapsed
        ? 1
        : 0
    if (reduceMotion) {
      return {opacity: p > 0.5 ? 1 : 0}
    }
    return {
      opacity: p,
      transform: [{translateY: (1 - p) * 10}, {scale: 0.96 + p * 0.04}],
    }
  })

  return (
    <View style={styles.titleStack} accessibilityElementsHidden={false}>
      <Animated.View pointerEvents="none" style={[styles.titleLayer, largeStyle]}>
        <AppText
          variant="screenLargeTitle"
          numberOfLines={1}
          accessibilityRole="header"
          style={{color: colours.text}}>
          Product Hub
        </AppText>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessible={false}
        style={[styles.titleLayer, styles.titleCompact, compactStyle]}>
        <AppText variant="screenCompactTitle" numberOfLines={1} style={{color: colours.text}}>
          Product Hub
        </AppText>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  chrome: {width: '100%'},
  titleActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    gap: HEADER_ICON_PAIR_GAP,
    justifyContent: 'flex-end',
  },
  titleActionsExpand: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  titleCompact: {justifyContent: 'center'},
  titleLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingBottom: 8,
  },
  titleStack: {
    flexGrow: 1,
    flexShrink: 1,
    height: 36,
    justifyContent: 'center',
    minWidth: 0,
    paddingRight: 12,
  },
})
