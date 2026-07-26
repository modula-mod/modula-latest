import {ScrollView, StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {ModuleDetail, ModuleInstallPreview} from '@/data/repositories/contracts'
import {ModuleStatusPill} from '@/features/modules/components/ModuleStatusPill'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function InstallPreviewSheet({
  module,
  preview,
  isPresented,
  onDismiss,
  onInstall,
  onInstallAndEnable,
  pending,
}: {
  module: ModuleDetail | null
  preview: ModuleInstallPreview | null
  isPresented: boolean
  onDismiss: () => void
  onInstall: () => void
  onInstallAndEnable: () => void
  pending?: boolean
}) {
  const {spacing} = useThemeTokens()
  return (
    <ModulaSheet isPresented={isPresented} onDismiss={onDismiss} testID="module-install-preview" snapPoints={['half', 'full']}>
      <ScrollView contentContainerStyle={{gap: spacing[4], paddingBottom: spacing[6]}}>
        <View style={{gap: spacing[1]}}>
          <AppText variant="headline">{module?.name ?? 'Module'}</AppText>
          <AppText variant="caption" colour="textSecondary">
            {module?.publisherName ?? 'Publisher'} · {preview?.version ? `v${preview.version}` : 'Version pending'}
          </AppText>
        </View>
        <Section title="Trust">
          <ModuleStatusPill state={preview?.trust.level ?? module?.trustLevel ?? 'Unknown'} />
          <AppText variant="caption" colour="textSecondary">
            Publisher {preview?.trust.publisherStatus ?? 'pending'} · release {preview?.trust.releaseStatus ?? module?.installationState ?? 'unknown'}
          </AppText>
        </Section>
        <Section title="Permissions">
          {(preview?.permissions ?? module?.permissions ?? []).length ? (
            (preview?.permissions ?? module?.permissions ?? []).map(permission => (
              <View key={permission.permission} style={{gap: spacing[1]}}>
                <AppText variant="label">{permission.permission}</AppText>
                <AppText variant="caption" colour="textSecondary">{permission.reason}</AppText>
                <ModuleStatusPill state={permission.risk} />
              </View>
            ))
          ) : (
            <AppText variant="caption" colour="textSecondary">No permissions declared for this state.</AppText>
          )}
        </Section>
        <Section title="Data collections">
          <AppText variant="caption" colour="textSecondary">
            Declarative schemas register before records are created. Private module records stay account-scoped.
          </AppText>
        </Section>
        <Section title="Compatibility">
          <AppText variant="caption" colour="textSecondary">
            {preview?.compatible === false ? preview.incompatibilityReasons.join(', ') : module?.compatibility ?? 'Compatible'}
          </AppText>
        </Section>
        <View style={[styles.actions, {gap: spacing[2]}]}>
          <ModulaButton label="Install" accessibilityLabel="Install module" loading={pending} disabled={pending || preview?.compatible === false} onPress={onInstall} />
          <ModulaButton label="Install and enable" role="secondary" loading={pending} disabled={pending || preview?.compatible === false} onPress={onInstallAndEnable} />
          <ModulaButton label="Cancel" role="plain" disabled={pending} onPress={onDismiss} />
        </View>
      </ScrollView>
    </ModulaSheet>
  )
}

function Section({title, children}: {title: string; children: React.ReactNode}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[2]}}>
      <AppText variant="caption" colour="textTertiary">{title.toUpperCase()}</AppText>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  actions: {alignItems: 'stretch'},
})
