import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const STEPS = [
  {title: '1 · Forge', body: 'Visual editor + advanced code for screens, widgets, and actions.'},
  {title: '2 · Module SDK', body: 'Routes, permissions, storage, settings, lifecycle contracts.'},
  {title: '3 · FXDigital', body: 'Developer console, APIs, logs, testing, and management.'},
  {title: '4 · Fusion', body: 'Package, validate, sign, version, and publish.'},
  {title: '5 · Registry', body: 'Distribute approved packages with channels and integrity.'},
  {title: '6 · Marketplace', body: 'Users discover, install, purchase, and review.'},
]

export function ForgeStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Forge" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Build modules inside Modula.</AppText>
            <AppText variant="body" colour="textSecondary">
              Forge is the Module Builder — Lovable/Bolt-class craft for installable packages. Not
              executable yet. No raw GitHub eval.
            </AppText>
          </View>

          {STEPS.map(step => (
            <Surface
              key={step.title}
              variant="contained"
              style={[
                styles.step,
                {
                  padding: spacing[4],
                  gap: spacing[2],
                  borderRadius: radius.medium,
                  backgroundColor: colours.surface,
                  borderColor: colours.border,
                },
              ]}>
              <AppText variant="headline">{step.title}</AppText>
              <AppText variant="body" colour="textSecondary">
                {step.body}
              </AppText>
            </Surface>
          ))}

          <Surface
            variant="contained"
            style={[
              styles.security,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.medium,
                backgroundColor: colours.accentSubtle,
              },
            ]}>
            <AppText variant="label">Security posture</AppText>
            <AppText variant="caption" colour="textSecondary">
              Permission-aware sandboxed runtime with declarative components and controlled execution
              (Wasm where required). Untrusted JS from random repos must not run.
            </AppText>
          </Surface>

          <AppButton onPress={() => router.push('/marketplace/module-forge' as Href)}>
            Forge marketplace card
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/modules' as Href)}>
            Modules library
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  step: {borderWidth: StyleSheet.hairlineWidth},
  security: {},
})
