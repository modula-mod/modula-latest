import {StyleSheet, View} from 'react-native'

import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {ExpoUiPlayground} from '@/platform/ui/dev/expo-ui-lab'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ExpoUiPlaygroundScreen() {
  const {spacing} = useThemeTokens()

  if (runtimeEnvironment.appEnvironment !== 'development') {
    return (
      <AppScreen>
        <AppText variant="headline">Developer settings are unavailable.</AppText>
      </AppScreen>
    )
  }

  return (
    <View style={styles.screen}>
      <SecondaryScreenHeader title="Full playground" />
      <AppScreen scroll>
        <View style={[styles.wrap, {gap: spacing[3], padding: spacing[4]}]}>
          <AppText variant="body" colour="textSub">
            Full Form host with every playground section — adapted from
            betomoedano/expo-ui-playground for SDK 57.
          </AppText>
          <ExpoUiPlayground />
        </View>
      </AppScreen>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  wrap: {
    alignSelf: 'center',
    maxWidth: 760,
    width: '100%',
  },
})
