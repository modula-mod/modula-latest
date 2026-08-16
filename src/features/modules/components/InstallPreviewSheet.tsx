import {useMemo, useState} from 'react'
import {View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleDetail, ModuleInstallPreview} from '@/data/repositories/contracts'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleInstallProgress, type ModuleInstallStageId} from '@/features/modules/components/ModuleInstallProgress'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {
  permissionDetent,
  presentPermissions,
} from '@/features/modules/identity/permissionPresentation'
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
  stage = null,
  failed = null,
  onOpen,
}: {
  module: ModuleDetail | null
  preview: ModuleInstallPreview | null
  isPresented: boolean
  onDismiss: () => void
  onInstall: () => void
  onInstallAndEnable: () => void
  pending?: boolean
  stage?: ModuleInstallStageId | null
  failed?: string | null
  onOpen?: () => void
}) {
  const {spacing} = useThemeTokens()
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const copy = productCopyFor(module?.moduleId ?? '', module?.name, module?.description)
  const presentation = useMemo(
    () => presentPermissions(preview?.permissions ?? module?.permissions, copy.name),
    [copy.name, module?.permissions, preview?.permissions],
  )
  const detent = permissionDetent(presentation)
  const installing = Boolean(stage && stage !== 'ready' && stage !== 'failed')
  const ready = stage === 'ready'

  const header = (
    <View style={{gap: spacing[2], paddingBottom: spacing[3]}}>
      <View style={{alignItems: 'center', flexDirection: 'row', gap: spacing[3]}}>
        {module ? <ModuleArtwork moduleId={module.moduleId} name={copy.name} size={44} /> : null}
        <View style={{flex: 1, minWidth: 0}}>
          <AppText variant="headline">{copy.name}</AppText>
          <AppText variant="caption" colour="textSecondary">
            by {copy.publisher}
          </AppText>
        </View>
      </View>
    </View>
  )

  const footer = ready ? (
    <View style={{gap: spacing[2]}}>
      <ModulaButton
        label={`Open ${copy.name}`}
        accessibilityLabel={`Open ${copy.name}`}
        fullWidth
        onPress={onOpen}
        testID="module-install-open"
      />
      <ModulaButton label="Done" role="plain" onPress={onDismiss} />
    </View>
  ) : (
    <View style={{gap: spacing[2]}}>
      <ModulaButton
        label={`Install ${copy.name}`}
        accessibilityLabel={`Install ${copy.name}`}
        loading={pending || installing}
        disabled={pending || installing || preview?.compatible === false}
        fullWidth
        onPress={onInstallAndEnable}
        testID="module-install-confirm"
      />
      <ModulaButton label="Cancel" role="plain" disabled={pending || installing} onPress={onDismiss} />
    </View>
  )

  return (
    <ModulaSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      header={header}
      footer={footer}
      detent={detent}
      obscureShellChrome
      accessibilityLabel={`${copy.name} install review`}
      testID="module-install-preview">
      {stage && stage !== 'failed' ? (
        <ModuleInstallProgress productName={copy.name} stage={stage} failed={failed} />
      ) : (
        <View style={{gap: spacing[4]}}>
          <AppText variant="body" colour="textSecondary">
            {copy.description}
          </AppText>
          <View style={{gap: spacing[2]}}>
            <AppText variant="micro" colour="textTertiary">
              ACCESS
            </AppText>
            {presentation.groups.map(group => {
              const open = openGroup === group.id
              return (
                <View key={group.id} style={{gap: spacing[1]}}>
                  <AppPressable
                    accessibilityLabel={`${group.title}. ${open ? 'Hide' : 'Show'} details`}
                    onPress={() => setOpenGroup(current => (current === group.id ? null : group.id))}>
                    <AppText variant="label">{group.title}</AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {group.summary}
                    </AppText>
                  </AppPressable>
                  {open
                    ? group.permissions.map(permission => (
                        <AppText key={permission.permission} variant="caption" colour="textTertiary">
                          {permission.reason}
                        </AppText>
                      ))
                    : null}
                </View>
              )
            })}
          </View>
          <AppText variant="caption" colour="textSecondary">
            {copy.privacy}
          </AppText>
          <AppPressable
            accessibilityLabel={technicalOpen ? 'Hide technical permissions' : 'Technical permissions'}
            onPress={() => setTechnicalOpen(open => !open)}>
            <AppText variant="label" colour="accent">
              Technical permissions {technicalOpen ? '⌃' : '>'}
            </AppText>
          </AppPressable>
          {technicalOpen ? (
            <View style={{gap: spacing[2]}} testID="module-install-technical">
              {(presentation.technical.length
                ? presentation.technical
                : (preview?.permissions ?? module?.permissions ?? [])
              ).map(permission => (
                <View key={permission.permission} style={{gap: 2}}>
                  <AppText variant="caption">{permission.permission}</AppText>
                  <AppText variant="caption" colour="textTertiary">
                    {permission.reason}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
          {preview?.compatible === false ? (
            <AppText variant="caption" colour="destructive">
              {preview.incompatibilityReasons.join(', ') || 'This module is not compatible.'}
            </AppText>
          ) : null}
        </View>
      )}
    </ModulaSheet>
  )
}
