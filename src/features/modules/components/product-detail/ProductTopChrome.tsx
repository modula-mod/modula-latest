import {StyleSheet, View} from 'react-native'

import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {HEADER_ICON_PAIR_GAP} from '@/platform/ui/navigation/plain-header-items'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

export function ProductTopChrome({
  productName,
  top,
  onBack,
  onShare,
  actions,
  onAction,
}: {
  productName: string
  top: number
  onBack: () => void
  onShare: () => void
  actions: ModulaActionItem[]
  onAction: (id: string) => void
}) {
  return (
    <View pointerEvents="box-none" style={[styles.chrome, {top}]} testID="product-top-chrome">
      <ModulaBackButton accessibilityLabel="Back" chrome="glass" onPress={onBack} />
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
  )
}

const styles = StyleSheet.create({
  chrome: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: HEADER_ICON_PAIR_GAP,
    justifyContent: 'space-between',
    left: 12,
    position: 'absolute',
    right: 12,
    zIndex: 2,
  },
})
