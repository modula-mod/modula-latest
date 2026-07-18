import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {LinearGradient} from 'expo-linear-gradient'

import {AuthPanel, AuthShell, AppButton} from '@/auth/screens/AuthScreenPrimitives'
import {useSessionActions} from '@/auth/runtime'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const HERO_COPY =
  'Modula is a Profile-OS where modules add the tools you choose and governed intelligence stays scoped: GAIA executes, AKI verifies, and Governor sets limits. This build previews that model honestly; real automation remains visible and user-confirmed.'

export function WelcomeScreen() {
  const router = useRouter()
  const {continueAsGuest} = useSessionActions()
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const wash =
    scheme === 'dark'
      ? ['#0B1416', colours.accentSubtle, colours.canvas]
      : [colours.accentSubtle, colours.canvas, '#F3F7F8']

  return (
    <AuthShell>
      <View style={{gap: spacing[6]}}>
        <LinearGradient
          colors={wash as [string, string, ...string[]]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={[
            styles.hero,
            {
              borderRadius: radius.large,
              padding: spacing[5],
              gap: spacing[3],
              borderColor: colours.border,
            },
          ]}>
          <AppText variant="caption" colour="accent">
            SIMPLIFYING DIGITAL
          </AppText>
          <AppText variant="display">MODULA</AppText>
          <AppText variant="title2">Your digital world, built around you.</AppText>
          <AppText variant="body" colour="textSecondary">
            {HERO_COPY}
          </AppText>
        </LinearGradient>

        <AuthPanel>
          <AppButton onPress={() => router.push('/onboarding' as Href)}>
            Get started
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/sign-in' as Href)}>
            Sign in
          </AppButton>
          <AppButton
            variant="secondary"
            accessibilityLabel="Open Product Hub"
            onPress={() => router.push('/product' as Href)}>
            Open Product Hub
          </AppButton>
          <AppButton
            variant="ghost"
            accessibilityLabel="Open Design Lab"
            onPress={() => router.push('/settings/appearance-lab' as Href)}>
            Visit Design Lab
          </AppButton>
          <AppButton variant="ghost" onPress={continueAsGuest}>
            Explore as guest
          </AppButton>
          <AppText variant="caption" colour="textSecondary">
            Modula Accounts are owned by Greenfield. Product Hub and Design Lab are preview
            surfaces; module installs, DIMON ownership, and intelligence execution are still gated by
            future registry and governance work.
          </AppText>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    width: '100%',
  },
})
