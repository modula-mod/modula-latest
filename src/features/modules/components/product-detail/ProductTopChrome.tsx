import {StyleSheet, View} from 'react-native'

import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
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
      <View style={styles.trailing}>
        <ModulaIconButton
          icon="share"
          chrome="glass"
          accessibilityLabel={`Share ${productName}`}
          onPress={onShare}
          testID="product-share"
        />
        <ChromeOverflowMenu
          chrome="glass"
          title={productName}
          actions={actions}
          onAction={onAction}
          accessibilityLabel="More actions"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chrome: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 12,
    position: 'absolute',
    right: 12,
    zIndex: 2,
  },
  trailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
})
