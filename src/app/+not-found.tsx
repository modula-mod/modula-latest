import {Link, Stack} from 'expo-router'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

export default function NotFoundScreen() {
  const {colours, spacing} = useTheme()

  return (
    <>
      <Stack.Screen options={{title: 'Not found'}} />
      <View
        style={[
          styles.screen,
          {backgroundColor: colours.canvas, padding: spacing.xl, gap: spacing.md},
        ]}>
        <AppText variant="title">Screen not found</AppText>
        <Link href="/(tabs)/board">
          <AppText colour="accent">Return to Board</AppText>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
