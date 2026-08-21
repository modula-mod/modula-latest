import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'
import type {ModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'

export function ProductStickyHeader({
  visible,
  top,
  moduleId,
  name,
  presentation,
  onPrimary,
}: {
  visible: boolean
  top: number
  moduleId: string
  name: string
  presentation: ModuleInstallPresentation
  onPrimary: () => void
}) {
  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.position, {opacity: visible ? 1 : 0, top}]}
      testID="product-sticky-header">
      <LiquidGlassChrome interactive fallback="clear" contentLayout="flow" style={styles.chrome}>
        <ModuleArtwork moduleId={moduleId} name={name} variant="compact" />
        <AppText variant="label" numberOfLines={1} style={styles.title}>{name}</AppText>
        <ModuleAction presentation={presentation} productName={name} onPress={onPrimary} tone="product" />
      </LiquidGlassChrome>
    </View>
  )
}

const styles = StyleSheet.create({
  chrome: {alignItems: 'center', borderRadius: 28, flexDirection: 'row', gap: 10, minHeight: 56, paddingHorizontal: 8, paddingVertical: 6},
  position: {left: 16, position: 'absolute', right: 16, zIndex: 4},
  title: {flex: 1, minWidth: 0},
})
