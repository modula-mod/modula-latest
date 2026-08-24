import {useState} from 'react'
import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {ModuleHostExtensionContribution, ModuleRecord} from '@/data/repositories/contracts'
import {ModuleErrorBoundary} from '@/features/modules/runtime/module-error-boundary'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
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
  const {spacing} = useThemeTokens()
  if (!visible.length) return null
  return (
    <View accessibilityLabel="Installed extension actions" style={{gap: spacing[2]}} testID={record ? 'record-extension-contributions' : 'module-extension-contributions'}>
      {!record ? <AppText variant="label">Extensions</AppText> : null}
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2]}}>
        {visible.map(contribution => (
          <ModuleErrorBoundary
            key={contribution.contribution_registration_id}
            fallback={<UnavailableContribution contribution={contribution} />}>
            <ContributionAction moduleId={moduleId} contribution={contribution} record={record} />
          </ModuleErrorBoundary>
        ))}
      </View>
    </View>
  )
}

function ContributionAction({moduleId, contribution, record}: {moduleId: string; contribution: ModuleHostExtensionContribution; record?: ModuleRecord}) {
  const {moduleRepository} = useAppServices()
  const {spacing} = useThemeTokens()
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
    <View style={{gap: spacing[1]}}>
      <ModulaButton
        label={title}
        role="secondary"
        loading={pending}
        accessibilityLabel={`${title} from ${contribution.extension_product_id}`}
        onPress={() => void invoke()}
      />
      {failure ? <AppText variant="micro" colour="destructive" accessibilityLiveRegion="polite">{failure}</AppText> : null}
    </View>
  )
}

function UnavailableContribution({contribution}: {contribution: ModuleHostExtensionContribution}) {
  return <AppText variant="caption" colour="textSecondary">{contribution.declaration.title || contribution.contribution_id} unavailable</AppText>
}
