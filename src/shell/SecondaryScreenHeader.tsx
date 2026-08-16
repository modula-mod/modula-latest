import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {ChromeCircleButton} from '@/components/primitives/ChromeCircleButton'
import {AppText} from '@/components/primitives/AppText'
import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
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
  /** Intercept the circular glass back control (dirty forms, custom leave). */
  onBack?: () => void
  /** App Store-style circular share. Combines with `right` when both are set. */
  onShare?: () => void
}

/**
 * Secondary-route chrome: progressive blur overlay + circular glass back
 * (App Store overlay). Share and overflow sit on the trailing edge.
 *
 * In-flow spacer clears the nav row only. The fade is a sibling absolute overlay
 * so it can paint over the top of the body (Android does not clip it to the spacer).
 */
export function SecondaryScreenHeader({title, right, onBack, onShare}: SecondaryScreenHeaderProps) {
  const insets = useSafeAreaInsets()
  const {spacing} = useThemeTokens()
  const rowHeight = insets.top + CHROME_HEADER_ROW
  const blurHeight = rowHeight + CHROME_FADE_EXTENSION

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
          <View style={[styles.side, styles.sideEnd]}>
            {onShare ? (
              <ChromeCircleButton
                icon="share"
                accessibilityLabel="Share"
                onPress={onShare}
              />
            ) : null}
            {right ?? (onShare ? null : <View style={styles.slotSpacer} />)}
          </View>
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
    minWidth: 44,
  },
  sideEnd: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  slotSpacer: {
    height: 44,
    width: 44,
  },
  title: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
})
