import {StyleSheet, Text, View} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated'

import {AppPressable} from '@/components/primitives/AppPressable'
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
import {TOOLBAR_HIT} from '@/platform/ui/menus/toolbar-chrome'
import {HEADER_ICON_PAIR_GAP} from '@/platform/ui/navigation/plain-header-items'
import {TYPOGRAPHY_SEMANTIC_ALIASES} from '@/theme/contracts/typography'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Matches Product Hub scroll collapse distance (`COMPACT_ON`). */
export const PRODUCT_HUB_TITLE_MORPH = 56

/** screenLargeTitle → display (30 / 36 / 700). */
const TITLE_LARGE = TYPOGRAPHY_SEMANTIC_ALIASES.screenLargeTitle
/** screenCompactTitle → headline (17 / 22 / 600). */
const TITLE_COMPACT = TYPOGRAPHY_SEMANTIC_ALIASES.screenCompactTitle

const AnimatedText = Animated.createAnimatedComponent(Text)

/**
 * Product Hub chrome contract (PVP-UI-1R).
 *
 * Progressive blur lives behind this row. Search + Discover share the Home
 * control group (44pt glyphs, 22pt gap, one glass capsule). Profile stays
 * outside the group in a matching 44pt hit. Native `Stack.SearchBar` remains
 * evaluated and rejected for production chrome.
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
          <AppPressable
            accessibilityLabel="Open profile"
            onPress={onProfilePress}
            style={styles.avatarHit}>
            <Avatar name={profileName} uri={profileUri} size={PROFILE_AVATAR} />
          </AppPressable>
        </View>
      </View>
    </View>
  )
}

/** Diameter chosen to sit optically centred in the 44pt toolbar hit. */
const PROFILE_AVATAR = 32

function libraryLabel(segment: ProductHubSegment): string {
  if (segment === 'installed') return 'Installed'
  if (segment === 'updates') return 'Updates'
  return 'Discover'
}

/**
 * One title string — fontSize / lineHeight / weight interpolate together so
 * scroll feels like a morph, not a crossfade of two labels.
 */
function ProductHubMorphTitle({
  compact,
  scrollY,
}: {
  compact: boolean
  scrollY?: SharedValue<number>
}) {
  const {colours, typography} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const large = typography[TITLE_LARGE]
  const small = typography[TITLE_COMPACT]
  const collapsed = compact

  const titleStyle = useAnimatedStyle(() => {
    const p = scrollY
      ? interpolate(scrollY.value, [0, PRODUCT_HUB_TITLE_MORPH], [0, 1], Extrapolation.CLAMP)
      : collapsed
        ? 1
        : 0
    if (reduceMotion) {
      const done = p > 0.5
      return {
        fontSize: done ? small.fontSize : large.fontSize,
        lineHeight: done ? small.lineHeight : large.lineHeight,
        fontWeight: done ? small.fontWeight : large.fontWeight,
        letterSpacing: done ? (small.letterSpacing ?? 0) : (large.letterSpacing ?? 0),
      }
    }
    return {
      fontSize: interpolate(p, [0, 1], [large.fontSize, small.fontSize]),
      lineHeight: interpolate(p, [0, 1], [large.lineHeight, small.lineHeight]),
      // Weight steps once mid-scroll — continuous weight isn't available on RN text.
      fontWeight: p > 0.55 ? small.fontWeight : large.fontWeight,
      letterSpacing: interpolate(
        p,
        [0, 1],
        [large.letterSpacing ?? 0, small.letterSpacing ?? 0],
      ),
    }
  })

  return (
    <View style={styles.titleStack}>
      <AnimatedText
        numberOfLines={1}
        accessibilityRole="header"
        style={[styles.titleText, {color: colours.text}, titleStyle]}>
        Product Hub
      </AnimatedText>
    </View>
  )
}

const styles = StyleSheet.create({
  avatarHit: {
    alignItems: 'center',
    height: TOOLBAR_HIT,
    justifyContent: 'center',
    width: TOOLBAR_HIT,
  },
  chrome: {width: '100%'},
  titleActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    gap: HEADER_ICON_PAIR_GAP,
    height: TOOLBAR_HIT,
    justifyContent: 'flex-end',
  },
  titleActionsExpand: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: TOOLBAR_HIT,
    justifyContent: 'space-between',
    minHeight: TOOLBAR_HIT,
  },
  titleStack: {
    flexGrow: 1,
    flexShrink: 1,
    height: TOOLBAR_HIT,
    justifyContent: 'center',
    minWidth: 0,
    paddingRight: 12,
  },
  titleText: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
})
