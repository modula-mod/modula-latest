import {useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleHostExtensionContribution, ModuleRecord} from '@/data/repositories/contracts'
import {ModuleErrorBoundary} from '@/features/modules/runtime/module-error-boundary'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaIcon} from '@/platform/ui/icons'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useAppServices} from '@/runtime/useAppServices'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const RECORD_CONTRIBUTION_KINDS = new Set(['menu.item', 'contextMenu.item', 'editor.command', 'editor.attachment', 'record.decorator', 'background.action'])
const SURFACE_CONTRIBUTION_KINDS = new Set(['toolbar.action', 'home.section', 'composer.tool', 'view.section', 'widget'])

export function ModuleExtensionContributions({
  moduleId,
  contributions,
  record,
}: {
  moduleId: string
  contributions: ModuleHostExtensionContribution[]
  record?: ModuleRecord
}) {
  const allowed = record ? RECORD_CONTRIBUTION_KINDS : SURFACE_CONTRIBUTION_KINDS
  const visible = contributions.filter(contribution => allowed.has(contribution.contribution_kind))
  const {colours, spacing} = useThemeTokens()
  const [isPresented, setIsPresented] = useState(false)
  if (!visible.length) return null
  return (
    <View accessibilityLabel="Installed extension actions" testID={record ? 'record-extension-contributions' : 'module-extension-contributions'}>
      <ModulaButton
        label={visible.length === 1 ? 'Tools' : `Tools · ${visible.length}`}
        role="secondary"
        size="compact"
        accessibilityLabel={`${visible.length} installed product ${visible.length === 1 ? 'tool' : 'tools'}`}
        onPress={() => setIsPresented(true)}
        testID={record ? 'record-tools-button' : 'module-tools-button'}
      />
      <ModulaSheet
        isPresented={isPresented}
        onDismiss={() => setIsPresented(false)}
        detent="medium"
        presentation="tools"
        accessibilityLabel="Installed product tools"
        header={(
          <View style={{gap: spacing[1], paddingBottom: spacing[3]}}>
            <AppText variant="headline">{record ? 'Record tools' : 'Product tools'}</AppText>
            <AppText variant="caption" colour="textSecondary">
              Actions supplied by products you installed and enabled.
            </AppText>
          </View>
        )}
        testID={record ? 'record-tools-sheet' : 'module-tools-sheet'}>
        <View style={[styles.rows, {borderColor: colours.separator}]}>
          {visible.map(contribution => (
            <ModuleErrorBoundary
              key={contribution.contribution_registration_id}
              fallback={<UnavailableContribution contribution={contribution} />}>
              <ContributionAction moduleId={moduleId} contribution={contribution} record={record} />
            </ModuleErrorBoundary>
          ))}
        </View>
      </ModulaSheet>
    </View>
  )
}

function ContributionAction({moduleId, contribution, record}: {moduleId: string; contribution: ModuleHostExtensionContribution; record?: ModuleRecord}) {
  const {moduleRepository} = useAppServices()
  const {colours, controls, spacing} = useThemeTokens()
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const title = contribution.declaration.title || contribution.contribution_id
  const actionId = contribution.declaration.actionId || contribution.declaration.functionId || contribution.contract_id

  const invoke = async () => {
    setPending(true)
    setFailure(null)
    try {
      await moduleRepository.invokeExtensionContribution(contribution.extension_product_id, contribution.contribution_id, {
        targetProductId: moduleId,
        actionId,
        requiredCapabilities: contribution.required_capability ? [contribution.required_capability] : [],
        resource: record ? {type: 'moduleRecord', id: record.record_id, collection: record.collection} : undefined,
      })
    } catch {
      await moduleRepository.reportExtensionContributionFailure(
        contribution.extension_product_id,
        contribution.contribution_id,
        'CONTRIBUTION_INVOCATION_FAILED',
      ).catch(() => undefined)
      setFailure(`${title} is temporarily unavailable. The module is unaffected.`)
    } finally {
      setPending(false)
    }
  }

  return (
    <View>
      <AppPressable
        accessibilityLabel={`${title} from ${contribution.extension_product_id}`}
        accessibilityState={{disabled: pending}}
        disabled={pending}
        onPress={() => void invoke()}
        style={[
          styles.row,
          {
            borderBottomColor: colours.separator,
            gap: spacing[3],
            minHeight: controls.listRow.minimum,
            paddingHorizontal: spacing[2],
          },
        ]}>
        <View style={{flex: 1, gap: spacing[1]}}>
          <AppText variant="body">{pending ? `${title}…` : title}</AppText>
          <AppText variant="caption" colour="textSecondary">Installed product tool</AppText>
        </View>
        <ModulaIcon name="chevronRight" size={controls.iconSize.status} colour={colours.textTertiary} />
      </AppPressable>
      {failure ? (
        <AppText
          variant="caption"
          colour="destructive"
          accessibilityLiveRegion="polite"
          style={{paddingHorizontal: spacing[2], paddingVertical: spacing[2]}}>
          {failure}
        </AppText>
      ) : null}
    </View>
  )
}

function UnavailableContribution({contribution}: {contribution: ModuleHostExtensionContribution}) {
  return <AppText variant="caption" colour="textSecondary">{contribution.declaration.title || contribution.contribution_id} unavailable</AppText>
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  rows: {borderTopWidth: StyleSheet.hairlineWidth},
})
