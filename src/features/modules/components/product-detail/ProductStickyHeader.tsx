import {Platform, StyleSheet, View} from 'react-native'
import {BlurView} from 'expo-blur'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {AppText} from '@/components/primitives/AppText'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {OVERLAY_GROUP_HIT, TOOLBAR_HIT} from '@/platform/ui/menus/toolbar-chrome'
import {
  CHROME_BLUR_INTENSITY,
  CHROME_FADE_EXTENSION,
} from '@/platform/ui/navigation/chrome-insets'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Space reserved for the fixed back control (44pt hit + edge inset). */
const FIXED_BACK_GUTTER = 12 + TOOLBAR_HIT
/** Matches control-group icon optical size; forces inline with title. */
const IDENTITY_ICON = 28

/**
 * Sticky product chrome: progressive blur + visible glass identity capsule.
 * Icon and title share one centered row inside the capsule.
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
  const {colours, scheme, spacing} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const visible = progress > 0.02
  const slideY = (1 - progress) * -8
  const rowHeight = top + OVERLAY_GROUP_HIT + spacing[2]
  const blurHeight = rowHeight + CHROME_FADE_EXTENSION
  const isDark = scheme === 'dark'
  const useBlur = !reduceTransparency && Platform.OS !== 'web'

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
        <View
          style={[
            styles.identityCapsule,
            {
              borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.1)',
              maxWidth: '100%',
              paddingHorizontal: spacing[2],
            },
          ]}>
          {useBlur ? (
            <BlurView
              intensity={72}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            />
          ) : (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDark ? 'rgba(40,48,52,0.88)' : 'rgba(245,247,248,0.92)',
                },
              ]}
            />
          )}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.35)',
              },
            ]}
          />
          <View style={styles.identityInner}>
            <ModuleArtwork moduleId={moduleId} name={name} size={IDENTITY_ICON} variant="icon" />
            <AppText
              numberOfLines={1}
              style={[styles.title, {color: colours.text}]}
              variant="label">
              {name}
            </AppText>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  identityCapsule: {
    alignSelf: 'flex-start',
    borderRadius: OVERLAY_GROUP_HIT / 2,
    borderWidth: StyleSheet.hairlineWidth,
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
    gap: 8,
    height: IDENTITY_ICON,
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
    lineHeight: IDENTITY_ICON,
    minWidth: 0,
    textAlignVertical: 'center',
  },
})
