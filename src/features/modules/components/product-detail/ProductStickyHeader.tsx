import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {OVERLAY_GROUP_HIT, TOOLBAR_HIT} from '@/platform/ui/menus/toolbar-chrome'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Space reserved for the fixed back control (44pt hit + edge inset). */
const FIXED_BACK_GUTTER = 12 + TOOLBAR_HIT
const IDENTITY_ICON = 28

/**
 * Morphing liquid-glass backdrop + identity capsule (icon + title in-line).
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
            paddingBottom: spacing[2],
            paddingLeft: FIXED_BACK_GUTTER,
            paddingRight: 12 + trailingReservedWidth + spacing[2],
            paddingTop: top + spacing[1],
          },
        ]}>
        <LiquidGlassChrome
          contentLayout="flow"
          fallback="clear"
          interactive={false}
          style={[
            styles.identityCapsule,
            {
              borderColor: colours.border,
              gap: spacing[2],
              maxWidth: '100%',
              paddingHorizontal: spacing[2],
            },
          ]}>
          <ModuleArtwork
            moduleId={moduleId}
            name={name}
            size={IDENTITY_ICON}
            variant="compact"
          />
          <AppText
            variant="label"
            numberOfLines={1}
            style={styles.title}>
            {name}
          </AppText>
        </LiquidGlassChrome>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  identityCapsule: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: OVERLAY_GROUP_HIT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexShrink: 1,
    height: OVERLAY_GROUP_HIT,
    minHeight: OVERLAY_GROUP_HIT,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: OVERLAY_GROUP_HIT,
  },
  shell: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 4,
  },
  title: {
    flexShrink: 1,
    includeFontPadding: false,
    lineHeight: 18,
    minWidth: 0,
    textAlignVertical: 'center',
  },
})
