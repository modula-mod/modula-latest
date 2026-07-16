import {Link, Stack} from 'expo-router'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function NotFoundScreen() {
  const {colours, spacing} = useThemeTokens()

  return (
    <>
      <Stack.Screen options={{title: 'Not found'}} />
      <View
        style={[
          styles.screen,
          {backgroundColor: colours.canvas, padding: spacing[6], gap: spacing[3]},
        ]}>
        <AppText variant="title">Screen not found</AppText>
        <Link href="/index">
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
