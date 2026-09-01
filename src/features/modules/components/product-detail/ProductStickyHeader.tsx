import {StyleSheet, Text, View} from 'react-native'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {OVERLAY_GROUP_HIT, TOOLBAR_HIT} from '@/platform/ui/menus/toolbar-chrome'
import {
  CHROME_BLUR_INTENSITY,
  CHROME_FADE_EXTENSION,
} from '@/platform/ui/navigation/chrome-insets'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Space reserved for the fixed back control (44pt hit + edge inset). */
const FIXED_BACK_GUTTER = 12 + TOOLBAR_HIT
const IDENTITY_ICON = 26

/**
 * Sticky product chrome: progressive blur + identity capsule using the same
 * liquid-glass material as {@link ChromeGlassControlGroup} (regular).
 */
export function ProductStickyHeader({
  progress,
  top,
  moduleId,
  name,
  trailingReservedWidth,
}: {
  progress: number
  top: number
  moduleId: string
  name: string
  trailingReservedWidth: number
}) {
  const {colours, spacing} = useThemeTokens()
  const visible = progress > 0.02
  const slideY = (1 - progress) * -6
  const rowHeight = top + OVERLAY_GROUP_HIT + spacing[2]
  const blurHeight = rowHeight + CHROME_FADE_EXTENSION

  return (
    <View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        styles.shell,
        {
          height: blurHeight,
          opacity: progress,
          transform: [{translateY: slideY}],
        },
      ]}
      testID="product-sticky-header">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ProgressiveBlurBand
          height={blurHeight}
          intensity={CHROME_BLUR_INTENSITY}
          strength="normal"
          topHeavy
        />
      </View>
      <View
        style={[
          styles.row,
          {
            height: rowHeight,
            paddingLeft: FIXED_BACK_GUTTER,
            paddingRight: 12 + trailingReservedWidth + spacing[2],
            paddingTop: top,
          },
        ]}>
        <LiquidGlassChrome
          contentLayout="flow"
          fallback="regular"
          interactive={false}
          style={[styles.identityCapsule, {maxWidth: '100%', paddingHorizontal: 10}]}>
          <View style={styles.identityInner}>
            <View style={styles.iconSlot}>
              <ModuleArtwork
                moduleId={moduleId}
                name={name}
                size={IDENTITY_ICON}
                variant="icon"
              />
            </View>
            <Text numberOfLines={1} style={[styles.title, {color: colours.text}]}>
              {name}
            </Text>
          </View>
        </LiquidGlassChrome>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  iconSlot: {
    alignItems: 'center',
    height: IDENTITY_ICON,
    justifyContent: 'center',
    width: IDENTITY_ICON,
  },
  identityCapsule: {
    alignSelf: 'flex-start',
    borderRadius: OVERLAY_GROUP_HIT / 2,
    flexShrink: 1,
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
    minHeight: OVERLAY_GROUP_HIT,
  },
  identityInner: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    height: OVERLAY_GROUP_HIT,
    minWidth: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  shell: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 4,
  },
  title: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    includeFontPadding: false,
    letterSpacing: -0.2,
    lineHeight: 18,
    minWidth: 0,
    paddingBottom: 1,
  },
})
