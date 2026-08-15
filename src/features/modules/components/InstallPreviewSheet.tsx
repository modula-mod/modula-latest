import {ScrollView, StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {ModuleDetail, ModuleInstallPreview} from '@/data/repositories/contracts'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function InstallPreviewSheet({
  module,
  preview,
  isPresented,
  onDismiss,
  onInstall: _onInstall,
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
          <AppText variant="body" colour="textSecondary">{module?.publisherName ?? 'Publisher'}</AppText>
          <AppText variant="caption" colour="textSecondary">
            {module?.longDescription || module?.description || 'Private notes and knowledge, available wherever you use Modula.'}
          </AppText>
        </View>
        <Section title="Permissions">
          {(preview?.permissions ?? module?.permissions ?? []).length ? (
            (preview?.permissions ?? module?.permissions ?? []).map(permission => (
              <AppText key={permission.permission} variant="body" colour="textSecondary">
                • {permission.reason}
              </AppText>
            ))
          ) : (
            <AppText variant="caption" colour="textSecondary">No permissions declared for this state.</AppText>
          )}
        </Section>
        <Section title="Data">
          <AppText variant="body" colour="textSecondary">
            Your {module?.name ?? 'module'} data remains yours.
          </AppText>
        </Section>
        <View style={[styles.actions, {gap: spacing[2]}]}>
          <ModulaButton label="Install" accessibilityLabel="Install module" loading={pending} disabled={pending || preview?.compatible === false} onPress={onInstallAndEnable} />
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
