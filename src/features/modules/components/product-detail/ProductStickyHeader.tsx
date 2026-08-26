import {StyleSheet, View} from 'react-native'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {AppText} from '@/components/primitives/AppText'
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
const IDENTITY_ICON = 28

/**
 * Sticky product chrome: Expo progressive blur band + liquid-glass identity capsule.
 * Primary CTA morphs into the fixed trailing {@link ChromeGlassControlGroup}.
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
  /** Width of the fixed trailing chrome so title doesn’t collide. */
  trailingReservedWidth: number
}) {
  const {spacing} = useThemeTokens()
  const visible = progress > 0.02
  const slideY = (1 - progress) * -8
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
          style={[
            styles.identityCapsule,
            {
              gap: spacing[2],
              maxWidth: '100%',
              paddingHorizontal: spacing[2],
            },
          ]}>
          <View style={styles.identityInner}>
            <ModuleArtwork
              moduleId={moduleId}
              name={name}
              size={IDENTITY_ICON}
              variant="compact"
            />
            <View style={styles.titleWrap}>
              <AppText variant="label" numberOfLines={1} style={styles.title}>
                {name}
              </AppText>
            </View>
          </View>
        </LiquidGlassChrome>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  identityCapsule: {
    alignSelf: 'flex-start',
    borderRadius: OVERLAY_GROUP_HIT / 2,
    flexShrink: 1,
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
    minHeight: OVERLAY_GROUP_HIT,
    overflow: 'hidden',
  },
  identityInner: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
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
    includeFontPadding: false,
    lineHeight: 17,
    textAlignVertical: 'center',
  },
  titleWrap: {
    flexShrink: 1,
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
    minWidth: 0,
  },
})
