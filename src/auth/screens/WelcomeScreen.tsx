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
          <AppButton onPress={() => router.push('/register' as Href)}>
            Create Modula Account
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/sign-in' as Href)}>
            Sign in
          </AppButton>
          <AppButton variant="ghost" onPress={continueAsGuest}>
            Explore as guest
          </AppButton>
          <AppText variant="caption" colour="textSecondary">
            Modula Accounts are owned by Greenfield. External Networks are optional under Settings →
            Connections.
          </AppText>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
