import {View, StyleSheet} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function DeveloperSettingsScreen() {
  const router = useRouter()
  const {spacing} = useThemeTokens()
  if (runtimeEnvironment.appEnvironment !== 'development') {
    return (
      <AppScreen>
        <AppText variant="headline">Developer settings are unavailable.</AppText>
      </AppScreen>
    )
  }
  return (
    <AppScreen scroll>
      <View style={[styles.wrap, {gap: spacing[4], padding: spacing[4]}]}>
        <AppText variant="display">Developer</AppText>
        <AppText variant="body" colour="textSub">
          Runtime labs and the Expo UI component gallery for picking patterns by
          product context.
        </AppText>
        <AppButton
          onPress={() => router.push('/settings/developer/expo-ui' as Href)}>
          Expo UI Lab
        </AppButton>
        <AppButton
          variant="secondary"
          onPress={() =>
            router.push('/settings/developer/expo-ui/playground' as Href)
          }>
          Full Expo UI playground
        </AppButton>
        <AppButton
          variant="secondary"
          onPress={() => router.push('/settings/developer/data-runtime' as Href)}>
          Data Runtime Lab
        </AppButton>
        <AppButton
          variant="secondary"
          onPress={() => router.push('/settings/developer/session' as Href)}>
          Session Lab
        </AppButton>
      </View>
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    maxWidth: 760,
    width: '100%',
  },
})
