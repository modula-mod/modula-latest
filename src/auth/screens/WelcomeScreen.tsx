import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {LinearGradient} from 'expo-linear-gradient'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useSessionActions} from '@/auth/runtime'
import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * First viewport: brand-first composition (Apple clarity).
 * One brand signal, one headline, one supporting line, one CTA group.
 */
export function WelcomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {continueAsGuest} = useSessionActions()
  const {colours, spacing, scheme} = useThemeTokens()
  const wash =
    scheme === 'dark'
      ? ['#071012', '#0B1416', colours.accentSubtle]
      : [colours.accentSubtle, '#F3F7F8', colours.canvas]

  return (
    <View style={[styles.root, {backgroundColor: colours.canvas}]}>
      <LinearGradient
        colors={wash as [string, string, ...string[]]}
        start={{x: 0.15, y: 0}}
        end={{x: 0.85, y: 1}}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.composition,
          {
            paddingTop: insets.top + spacing[8],
            paddingBottom: insets.bottom + spacing[6],
            paddingHorizontal: spacing[5],
          },
        ]}>
        <View style={[styles.hero, {gap: spacing[3]}]}>
          <AppText variant="caption" colour="accent">
            SIMPLIFYING DIGITAL
          </AppText>
          <AppText variant="display" style={styles.brand}>
            MODULA
          </AppText>
          <AppText variant="title2">Your digital world, built around you.</AppText>
          <AppText variant="body" colour="textSecondary" style={styles.support}>
            A Profile-OS where modules add the tools you choose — calm, private, and under your
            control.
          </AppText>
        </View>

        <View style={[styles.cta, {gap: spacing[3]}]}>
          <AppButton onPress={() => router.push('/onboarding' as Href)}>Get started</AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/sign-in' as Href)}>
            Sign in
          </AppButton>
          <AppButton variant="ghost" onPress={continueAsGuest}>
            Explore as guest
          </AppButton>
          <AppText variant="caption" colour="textTertiary" style={styles.footnote}>
            Accounts are owned by Greenfield. DIMON ownership and autonomous AI stay inactive until
            foundations are ready.
          </AppText>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  brand: {
    letterSpacing: 1.2,
  },
  composition: {
    flex: 1,
    justifyContent: 'space-between',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  cta: {
    width: '100%',
  },
  footnote: {
    textAlign: 'center',
  },
  hero: {
    width: '100%',
  },
  root: {
    flex: 1,
  },
  support: {
    maxWidth: 360,
  },
})
