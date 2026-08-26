import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {TOOLBAR_HIT} from '@/platform/ui/menus/toolbar-chrome'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Space reserved for the fixed back control (44pt hit + edge inset). */
const FIXED_BACK_GUTTER = 12 + TOOLBAR_HIT

/**
 * Morphing liquid-glass backdrop + compact identity while scrolling.
 * Primary CTA morphs into the fixed trailing control group.
 */
export function ProductStickyHeader({
  progress,
  top,
  moduleId,
  name,
  trailingReservedWidth,
}: {
  /** 0 = hidden, 1 = fully visible — driven by scroll offset. */
  progress: number
  top: number
  moduleId: string
  name: string
  /** Width of the fixed trailing capsule so title doesn’t collide. */
  trailingReservedWidth: number
}) {
  const {colours, spacing} = useThemeTokens()
  const visible = progress > 0.02
  const slideY = (1 - progress) * -8

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
            paddingRight: 12 + trailingReservedWidth,
            paddingTop: top + spacing[1],
          },
        ]}>
        <ModuleArtwork moduleId={moduleId} name={name} variant="compact" />
        <AppText variant="label" numberOfLines={1} style={styles.title}>
          {name}
        </AppText>
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
