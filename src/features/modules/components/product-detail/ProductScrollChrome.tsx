import {StyleSheet, View} from 'react-native'

import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {HEADER_ICON_PAIR_GAP} from '@/platform/ui/navigation/plain-header-items'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

import {ProductTabs, type ProductTabId} from './ProductTabs'

/**
 * Sticky Product Hub navigation — liquid-glass bar with back, section tabs,
 * and trailing actions once the in-flow tab rail reaches the top edge.
 */
export function ProductScrollChrome({
  opacity,
  top,
  selected,
  onSelect,
  onBack,
  onShare,
  actions,
  onAction,
  productName,
}: {
  opacity: number
  top: number
  selected: ProductTabId
  onSelect: (tab: ProductTabId) => void
  onBack: () => void
  onShare: () => void
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  productName: string
}) {
  const {colours, spacing} = useThemeTokens()
  const visible = opacity > 0.02

  return (
    <View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[styles.shell, {opacity, paddingTop: top}]}
      testID="product-scroll-chrome">
      <LiquidGlassChrome
        contentLayout="flow"
        fallback="regular"
        interactive
        style={[
          styles.bar,
          {
            borderBottomColor: colours.border,
            paddingBottom: spacing[2],
            paddingHorizontal: spacing[3],
          },
        ]}>
        <View style={[styles.row, {gap: HEADER_ICON_PAIR_GAP}]}>
          <ModulaBackButton accessibilityLabel="Back" chrome="glass" onPress={onBack} />
          <View style={styles.tabsSlot}>
            <ProductTabs selected={selected} onSelect={onSelect} variant="inline" />
          </View>
          <ChromeGlassControlGroup
            items={[
              {
                kind: 'button',
                icon: 'share',
                accessibilityLabel: `Share ${productName}`,
                onPress: onShare,
              },
              {
                kind: 'menu',
                accessibilityLabel: 'More actions',
                title: productName,
                actions,
                onAction,
              },
            ]}
          />
        </View>
      </LiquidGlassChrome>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  shell: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 6,
  },
  tabsSlot: {
    flex: 1,
    minWidth: 0,
  },
})
