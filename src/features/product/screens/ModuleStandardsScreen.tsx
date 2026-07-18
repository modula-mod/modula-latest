import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const RULES = [
  'External packages only — never hardcode product modules into the host',
  'Declare GreenfieldModuleManifest fields completely',
  'Least-privilege permissions; namespaced storage',
  'Error boundaries — module failure must not crash the shell',
  'No dynamic code fetch / eval of untrusted GitHub sources',
  'Honest uninstall behaviour (retain / purge / exportThenPurge)',
]

export function ModuleStandardsScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Module Standards" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">How Modula modules are built.</AppText>
            <AppText variant="body" colour="textSecondary">
              Standards for Registry packages. Boilerplate lives in templates/modula-module — copy
              it into a separate repository.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="caption" colour="textTertiary">
              PIPELINE
            </AppText>
            <AppText variant="headline">
              Forge → SDK → Fusion → Registry → Marketplace
            </AppText>
            <AppText variant="body" colour="textSecondary">
              Sandboxed install required. Forge Preview drafts manifests only.
            </AppText>
          </Surface>

          <View style={{gap: spacing[3]}}>
            {RULES.map(rule => (
              <Surface
                key={rule}
                variant="contained"
                style={[
                  styles.row,
                  {
                    padding: spacing[4],
                    gap: spacing[3],
                    borderRadius: radius.medium,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <AppIcon name="check" colour={colours.accent} size={18} />
                <AppText variant="body" style={{flex: 1}}>
                  {rule}
                </AppText>
              </Surface>
            ))}
          </View>

          <AppButton onPress={() => router.push('/product/forge' as Href)}>Open Forge Builder</AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/sandbox' as Href)}>
            Module sandbox foreshadow
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/marketplace/module-standards' as Href)}>
            Standards marketplace card
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/marketplace/module-agents' as Href)}>
            Agents module card
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
