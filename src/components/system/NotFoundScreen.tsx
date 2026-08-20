import {Link, Stack} from 'expo-router'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useHydrated} from '@/lib/useHydrated'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function NotFoundScreen() {
  const hydrated = useHydrated()
  const {colours, spacing} = useThemeTokens()

  if (!hydrated) {
    return <View testID="not-found-pending" style={[styles.screen, {backgroundColor: colours.canvas}]} />
  }

  return (
    <>
      <Stack.Screen options={{title: 'Not found'}} />
      <View
        style={[
          styles.screen,
          {backgroundColor: colours.canvas, padding: spacing[6], gap: spacing[3]},
        ]}>
        <AppText variant="title">Screen not found</AppText>
        <Link href="/">
          <AppText colour="accent">Return home</AppText>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
})
