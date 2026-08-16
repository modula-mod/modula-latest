import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {AppText} from '@/components/primitives/AppText'
import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {ChromeCircleButton} from '@/components/primitives/ChromeCircleButton'
import {
  ChromeGlassControlGroup,
  type ChromeGlassGroupMenu,
} from '@/platform/ui/menus/chrome-glass-control-group'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
import {OVERLAY_GLASS_HIT} from '@/platform/ui/menus/toolbar-chrome'
import {
  CHROME_BLUR_INTENSITY,
  CHROME_FADE_EXTENSION,
  CHROME_HEADER_ROW,
} from '@/platform/ui/navigation/chrome-insets'
import {LAYERS} from '@/theme/tokens/layers'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type SecondaryScreenHeaderProps = {
  title: string
  right?: ReactNode
  onBack?: () => void
  onShare?: () => void
  /** Trailing overflow — grouped with share when both are set. */
  overflow?: Omit<ChromeGlassGroupMenu, 'kind'>
}

/**
 * Secondary-route chrome: extraLarge glass back + trailing ControlGroup
 * when share and overflow are both present (Expo UI ControlGroup).
 */
export function SecondaryScreenHeader({
  title,
  right,
  onBack,
  onShare,
  overflow,
}: SecondaryScreenHeaderProps) {
  const insets = useSafeAreaInsets()
  const {spacing} = useThemeTokens()
  const rowHeight = insets.top + CHROME_HEADER_ROW
  const blurHeight = rowHeight + CHROME_FADE_EXTENSION

  const trail = (() => {
    if (onShare && overflow) {
      return (
        <ChromeGlassControlGroup
          items={[
            {
              kind: 'button',
              icon: 'share',
              accessibilityLabel: 'Share',
              onPress: onShare,
            },
            {kind: 'menu', ...overflow},
          ]}
        />
      )
    }
    if (overflow) {
      return (
        <ChromeOverflowMenu
          chrome="glass"
          accessibilityLabel={overflow.accessibilityLabel}
          title={overflow.title}
          actions={overflow.actions}
          onAction={overflow.onAction}
        />
      )
    }
    if (onShare) {
      return (
        <ChromeCircleButton icon="share" accessibilityLabel="Share" onPress={onShare} />
      )
    }
    return right ?? <View style={styles.slotSpacer} />
  })()

  return (
    <>
      <View style={{height: rowHeight}} />
      <View style={[styles.overlay, {height: blurHeight}]} pointerEvents="box-none">
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ProgressiveBlurBand
            height={blurHeight}
            topHeavy
            intensity={CHROME_BLUR_INTENSITY}
          />
        </View>
        <View
          style={[
            styles.row,
            {
              paddingTop: insets.top,
              paddingHorizontal: spacing[3],
              height: rowHeight,
            },
          ]}>
          <View style={styles.side}>
            <ModulaBackButton onPress={onBack} />
          </View>
          <AppText variant="headline" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
          <View style={[styles.side, styles.sideEnd]}>{trail}</View>
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  overlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: LAYERS.sticky,
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    paddingBottom: 10,
    width: '100%',
    zIndex: 2,
  },
  side: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: OVERLAY_GLASS_HIT,
  },
  sideEnd: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  slotSpacer: {
    height: OVERLAY_GLASS_HIT,
    width: OVERLAY_GLASS_HIT,
  },
  title: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
})
