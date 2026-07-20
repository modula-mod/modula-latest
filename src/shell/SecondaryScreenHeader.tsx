import type {ReactNode} from 'react'
import {useRouter} from 'expo-router'
import {StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {ChromeCircleButton} from '@/components/primitives/ChromeCircleButton'
import {AppText} from '@/components/primitives/AppText'
import {
  CHROME_BLUR_INTENSITY,
  CHROME_FADE_EXTENSION,
  CHROME_HEADER_ROW,
} from '@/platform/ui/navigation/chrome-insets'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type SecondaryScreenHeaderProps = {
  title: string
  right?: ReactNode
}

/**
 * Secondary-route chrome: progressive blur overlay + plain Expo UI back icon.
 *
 * In-flow spacer clears the nav row only. The fade is a sibling absolute overlay
 * so it can paint over the top of the body (Android does not clip it to the spacer).
 */
export function SecondaryScreenHeader({title, right}: SecondaryScreenHeaderProps) {
  const router = useRouter()
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
            <ChromeCircleButton
              icon="back"
              accessibilityLabel="Go back"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back()
                } else {
                  router.replace('/index' as never)
                }
              }}
            />
          </View>
          <AppText variant="headline" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
          <View style={[styles.side, styles.sideEnd]}>
            {right ?? <View style={styles.slotSpacer} />}
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
    zIndex: 4,
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
    alignItems: 'flex-end',
  },
  slotSpacer: {
    height: 36,
    width: 36,
  },
  title: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
})
