import type {ReactNode} from 'react'
import {useRouter} from 'expo-router'
import {StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurEdges} from '@/components/materials/ProgressiveBlurEdges'
import {ChromeCircleButton} from '@/components/primitives/ChromeCircleButton'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type SecondaryScreenHeaderProps = {
  title: string
  right?: ReactNode
}

const HEADER_ROW_HEIGHT = 54

/**
 * Secondary-route chrome: progressive blur band + circular back / trailing actions.
 * Replaces the solid MaterialSurface navigation bar.
 */
export function SecondaryScreenHeader({title, right}: SecondaryScreenHeaderProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {spacing} = useThemeTokens()
  const bandHeight = insets.top + HEADER_ROW_HEIGHT

  return (
    <View style={[styles.wrap, {height: bandHeight}]}>
      <ProgressiveBlurEdges
        edges="top"
        sideAtmosphere={false}
        edgeHeight={bandHeight}
      />
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
  )
}

const styles = StyleSheet.create({
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
  title: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  wrap: {
    overflow: 'hidden',
    width: '100%',
  },
})
