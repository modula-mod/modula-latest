import type {ReactNode} from 'react'
import {useRouter} from 'expo-router'
import {StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {IconButton} from '@/components/primitives/IconButton'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type SecondaryScreenHeaderProps = {
  title: string
  right?: ReactNode
}

export function SecondaryScreenHeader({title, right}: SecondaryScreenHeaderProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {colours, spacing} = useThemeTokens()

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top,
          backgroundColor: colours.canvas,
          borderBottomColor: colours.border,
        },
      ]}>
      <View style={[styles.row, {paddingHorizontal: spacing[3]}]}>
        <IconButton
          icon="back"
          label="Go back"
          onPress={() => {
            if (router.canGoBack()) {
              router.back()
            } else {
              router.replace('/')
            }
          }}
        />
        <AppText variant="headline" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  right: {
    alignItems: 'flex-end',
    minWidth: 44,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 54,
  },
  title: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
