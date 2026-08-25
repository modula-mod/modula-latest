import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'
import type {ModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {OVERLAY_GROUP_MIN_WIDTH, TOOLBAR_HIT} from '@/platform/ui/menus/toolbar-chrome'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Space reserved for the fixed back control (44pt hit + edge inset). */
const FIXED_BACK_GUTTER = 12 + TOOLBAR_HIT

/**
 * Morphing liquid-glass backdrop + compact product row while scrolling.
 * Back / trailing actions live in {@link ProductFixedChrome} and never move.
 */
export function ProductStickyHeader({
  progress,
  top,
  moduleId,
  name,
  presentation,
  onPrimary,
}: {
  /** 0 = hidden, 1 = fully visible — driven by scroll offset. */
  progress: number
  top: number
  moduleId: string
  name: string
  presentation: ModuleInstallPresentation
  onPrimary: () => void
}) {
  const {colours, spacing} = useThemeTokens()
  const visible = progress > 0.02
  const slideY = (1 - progress) * -8
  const trailingGutter = 12 + OVERLAY_GROUP_MIN_WIDTH

  return (
    <View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[styles.shell, {opacity: progress, transform: [{translateY: slideY}]}]}
      testID="product-sticky-header">
      <LiquidGlassChrome
        contentLayout="flow"
        fallback="regular"
        interactive={false}
        style={[styles.backdrop, {borderBottomColor: colours.border}]}
      />
      <View
        style={[
          styles.row,
          {
            gap: spacing[2],
            paddingBottom: spacing[2],
            paddingLeft: FIXED_BACK_GUTTER,
            paddingRight: trailingGutter,
            paddingTop: top + spacing[1],
          },
        ]}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
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
