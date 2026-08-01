import {ScrollView, StyleSheet, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {MODULE_PERMISSION_CATALOGUE, RISK_LABEL} from '@/features/product/data/modulePermissions'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const RULES = [
  {
    title: 'External packages only',
    body: 'Never hardcode product modules into the host application tree.',
  },
  {
    title: 'Standard 2.0 manifests',
    body: 'Declare versioned contracts for identity, dependencies, services, APIs, events, hooks, permissions, storage, UI, automation, AI, health and marketplace metadata.',
  },
  {
    title: 'skill.md digital DNA',
    body: 'Ship skill.md with commands, AI actions, permissions, network, risk, and audit behaviour for GAIA, AKI, and the Governor.',
  },
  {
    title: 'Contract registries',
    body: 'Expose records, views, actions, functions, jobs, services, hooks and APIs through registries — not hardwired UI-only actions.',
  },
  {
    title: 'Least privilege',
    body: 'Permissions must match user-visible purpose and use Standard 2.0 categories for data, AI, DIMON, connectors, realtime, media, device and developer scopes.',
  },
  {
    title: 'Error boundaries',
    body: 'Module failure shows calm recovery — never takes down the shell.',
  },
  {
    title: 'No untrusted eval',
    body: 'No dynamic code fetch from raw GitHub. Registry + sandbox only.',
  },
  {
    title: 'Honest uninstall',
    body: 'Declare lifecycle hooks, storage policy, migrations, health states, and rollback limits before install, enable, disable, update or uninstall.',
  },
]

const PIPELINE = ['Forge', 'SDK', 'Validate', 'Registry', 'Marketplace']

export function ModuleStandardsScreen() {
  const router = useRouter()
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const wash =
    scheme === 'dark'
      ? ['#0B1416', colours.accentSubtle]
      : [colours.accentSubtle, colours.canvas]

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Module Standards" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <LinearGradient
            colors={wash as [string, string]}
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
              GREENFIELD · MODULE CONTRACT
            </AppText>
            <AppText variant="display">How Modula modules are built.</AppText>
            <AppText variant="body" colour="textSecondary">
              Standards for Registry packages. Standard 1.x modules still work; Standard 2.0
              modules declare richer contracts so the host stays launchable with zero modules.
            </AppText>
          </LinearGradient>

          <View style={[styles.pipeline, {gap: spacing[2]}]}>
            {PIPELINE.map((step, index) => (
              <View key={step} style={styles.pipelineItem}>
                <Surface
                  variant="contained"
                  style={[
                    styles.pipelineChip,
                    {
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                      borderRadius: radius.round,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                    },
                  ]}>
                  <AppText variant="caption" colour="accent">
                    {index + 1}. {step}
                  </AppText>
                </Surface>
                {index < PIPELINE.length - 1 ? (
                  <AppText variant="caption" colour="textTertiary">
                    →
                  </AppText>
                ) : null}
              </View>
            ))}
          </View>

          <View style={{gap: spacing[3]}}>
            {RULES.map(rule => (
              <Surface
                key={rule.title}
                variant="contained"
                style={[
                  styles.rule,
                  {
                    padding: spacing[4],
                    gap: spacing[2],
                    borderRadius: radius.large,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <View style={[styles.ruleTitle, {gap: spacing[2]}]}>
                  <AppIcon name="check" colour={colours.accent} size={18} />
                  <AppText variant="headline">{rule.title}</AppText>
                </View>
                <AppText variant="body" colour="textSecondary">
                  {rule.body}
                </AppText>
              </Surface>
            ))}
          </View>

          <AppText variant="headline">Permission catalogue</AppText>
          <AppText variant="body" colour="textSecondary">
            Plain-language strings users see at install time.
          </AppText>
          <View style={{gap: spacing[2]}}>
            {MODULE_PERMISSION_CATALOGUE.slice(0, 5).map(perm => (
              <AppPressable
                key={perm.id}
                onPress={() => router.push('/product/permissions' as Href)}>
                <Surface
                  variant="contained"
                  style={[
                    styles.perm,
                    {
                      padding: spacing[3],
                      gap: spacing[2],
                      borderRadius: radius.medium,
                      backgroundColor: colours.surfaceRaised,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppText variant="label">{perm.label}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {perm.userVisible} · {RISK_LABEL[perm.risk]}
                  </AppText>
                </Surface>
              </AppPressable>
            ))}
          </View>

          <AppButton onPress={() => router.push('/product/permissions' as Href)}>
            Open permissions matrix
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/commands' as Href)}>
            Command Layer catalogue
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/forge' as Href)}>
            Open Forge Builder
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/intelligence' as Href)}>
            Intelligence Hub
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/sandbox' as Href)}>
            Module sandbox
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  hero: {borderWidth: StyleSheet.hairlineWidth, width: '100%'},
  pipeline: {alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap'},
  pipelineItem: {alignItems: 'center', flexDirection: 'row', gap: 6},
  pipelineChip: {borderWidth: StyleSheet.hairlineWidth},
  rule: {borderWidth: StyleSheet.hairlineWidth},
  ruleTitle: {alignItems: 'center', flexDirection: 'row'},
  perm: {borderWidth: StyleSheet.hairlineWidth},
})
