import {useRouter, type Href} from 'expo-router'
import {View} from 'react-native'

import {AuthPanel, AuthShell, AppButton} from '@/auth/screens/AuthScreenPrimitives'
import {useSessionActions} from '@/auth/runtime'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function WelcomeScreen() {
  const router = useRouter()
  const {continueAsGuest} = useSessionActions()
  const {spacing} = useThemeTokens()
  return (
    <AuthShell>
      <View style={{gap: spacing[6]}}>
        <View style={{gap: spacing[2]}}>
          <AppText variant="display">MODULA</AppText>
          <AppText variant="title2">Your profile.</AppText>
          <AppText variant="title2">Your tools.</AppText>
          <AppText variant="title2">Your digital environment.</AppText>
        </View>
        <AuthPanel>
          <AppButton onPress={() => router.push('/sign-in' as Href)}>
            Continue with local account
          </AppButton>
          <AppButton variant="secondary" onPress={continueAsGuest}>
            Explore as guest
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/create-account' as Href)}>
            Create local prototype account
          </AppButton>
          <AppText variant="caption" colour="textSecondary">
            This development build uses a local API simulation.
          </AppText>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
