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
        <AppText variant="body" colour="textSecondary">
          Labs and builder foreshadow. Modules stay external — never hardcoded into the host.
        </AppText>
        <AppButton onPress={() => router.push('/product/forge' as Href)}>Forge Builder</AppButton>
        <AppButton variant="secondary" onPress={() => router.push('/product/module-standards' as Href)}>
          Module standards
        </AppButton>
        <AppButton variant="secondary" onPress={() => router.push('/product/agents' as Href)}>
          Agents studio
        </AppButton>
        <AppButton variant="ghost" onPress={() => router.push('/settings/extensions' as Href)}>
          Extension Centre
        </AppButton>
        <AppButton variant="ghost" onPress={() => router.push('/settings/developer/data-runtime' as Href)}>
          Data Runtime Lab
        </AppButton>
        <AppButton variant="ghost" onPress={() => router.push('/settings/developer/session' as Href)}>
          Session Lab
        </AppButton>
        <AppText variant="caption" colour="textTertiary">
          Boilerplate path: templates/modula-module · SDK foreshadow in docs/architecture/modula-module-sdk.md
        </AppText>
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
