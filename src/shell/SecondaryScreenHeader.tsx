import type {ReactNode} from 'react'
import {useRouter} from 'expo-router'
import {StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {ChromeCircleButton} from '@/components/primitives/ChromeCircleButton'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type SecondaryScreenHeaderProps = {
  title: string
  right?: ReactNode
}

const HEADER_ROW_HEIGHT = 54
/** Blur dissolves into content below the nav row. */
const FADE_EXTENSION = 36

/**
 * Secondary-route chrome: progressive blur overlay + liquid-glass circular back.
 * Fade extension paints over the top of the scroll content so the edge softens.
 */
export function SecondaryScreenHeader({title, right}: SecondaryScreenHeaderProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {spacing} = useThemeTokens()
  const bandHeight = insets.top + HEADER_ROW_HEIGHT
  const blurHeight = bandHeight + FADE_EXTENSION

  return (
    <View style={[styles.spacer, {height: bandHeight}]}>
      <View style={[styles.overlay, {height: blurHeight}]} pointerEvents="box-none">
        <ProgressiveBlurBand height={blurHeight} topHeavy />
        <View
          style={[
            styles.row,
            {
              paddingTop: insets.top,
              paddingHorizontal: spacing[3],
              height: bandHeight,
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
    </View>
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
    zIndex: 1,
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
  spacer: {
    width: '100%',
    zIndex: 4,
  },
  title: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
})
