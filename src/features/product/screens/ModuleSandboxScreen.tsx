import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const LAYERS = [
  {
    title: 'Host shell',
    body: 'Startup, tabs, theme tokens, SocialProvider — always launchable with zero modules.',
  },
  {
    title: 'Capability gate',
    body: 'Permissions declared in the manifest; host checks before tool/agent invocation.',
  },
  {
    title: 'Sandbox runtime',
    body: 'Future: isolated module process. No dynamic GitHub eval. Not active in this build.',
  },
  {
    title: 'Namespaced storage',
    body: 'Each module gets a storage prefix. Cannot read private host or sibling modules.',
  },
  {
    title: 'Error boundary',
    body: 'Module failure shows a calm recovery surface — never takes down the shell.',
  },
]

export function ModuleSandboxScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Module Sandbox" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">How modules stay safe.</AppText>
            <AppText variant="body" colour="textSecondary">
              Sandbox foreshadow for Registry installs. This screen is documentation UI — nothing
              executes untrusted code here.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.banner,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.large,
                backgroundColor: colours.accentSubtle,
                borderColor: colours.accentBorder,
              },
            ]}>
            <AppText variant="caption" colour="accent">
              STATUS
            </AppText>
            <AppText variant="title">Sandbox runtime inactive</AppText>
            <AppText variant="body" colour="textSecondary">
              Forge drafts manifests. Marketplace shows pre-screens. Install execution lands with
              Registry + sandbox.
            </AppText>
          </Surface>

          {LAYERS.map((layer, index) => (
            <Surface
              key={layer.title}
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
              <View
                style={[
                  styles.index,
                  {
                    backgroundColor: colours.accentSubtle,
                    borderRadius: radius.round,
                  },
                ]}>
                <AppText variant="caption" colour="accent">
                  {index + 1}
                </AppText>
              </View>
              <View style={{flex: 1, gap: 4}}>
                <AppText variant="headline">{layer.title}</AppText>
                <AppText variant="body" colour="textSecondary">
                  {layer.body}
                </AppText>
              </View>
            </Surface>
          ))}

          <AppButton onPress={() => router.push('/product/module-standards' as Href)}>
            Module standards
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/forge' as Href)}>
            Forge Builder
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/settings/extensions' as Href)}>
            Extension Centre
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  banner: {borderWidth: StyleSheet.hairlineWidth},
  row: {
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  index: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
})
