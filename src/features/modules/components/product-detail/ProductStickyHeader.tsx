import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'
import type {ModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {HEADER_ICON_PAIR_GAP} from '@/platform/ui/navigation/plain-header-items'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Compact product chrome that morphs in while scrolling — full-width liquid
 * glass, back control, artwork, title, and primary action (App Store style).
 */
export function ProductStickyHeader({
  progress,
  top,
  moduleId,
  name,
  presentation,
  onBack,
  onPrimary,
}: {
  /** 0 = hidden, 1 = fully visible — driven by scroll offset. */
  progress: number
  top: number
  moduleId: string
  name: string
  presentation: ModuleInstallPresentation
  onBack: () => void
  onPrimary: () => void
}) {
  const {colours, spacing} = useThemeTokens()
  const visible = progress > 0.02
  const slideY = (1 - progress) * -10

  return (
    <View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        styles.shell,
        {
          opacity: progress,
          transform: [{translateY: slideY}],
        },
      ]}
      testID="product-sticky-header">
      <LiquidGlassChrome
        contentLayout="flow"
        fallback="regular"
        interactive
        style={[
          styles.bar,
          {
            borderBottomColor: colours.border,
          },
        ]}>
        <View
          style={[
            styles.row,
            {
              gap: HEADER_ICON_PAIR_GAP,
              paddingBottom: spacing[2],
              paddingHorizontal: spacing[3],
              paddingTop: top + spacing[1],
            },
          ]}>
          <ModulaBackButton accessibilityLabel="Back" chrome="glass" onPress={onBack} />
          <ModuleArtwork moduleId={moduleId} name={name} variant="compact" />
          <AppText variant="label" numberOfLines={1} style={styles.title}>
            {name}
          </AppText>
          <ModuleAction
            presentation={presentation}
            productName={name}
            onPress={onPrimary}
            tone="product"
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
    minHeight: 44,
    width: '100%',
  },
  shell: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 4,
  },
  title: {flex: 1, minWidth: 0},
})
