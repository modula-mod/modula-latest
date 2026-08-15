import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModuleInstallStageId =
  | 'resolving'
  | 'validating'
  | 'compatibility'
  | 'permissions'
  | 'installing'
  | 'enabling'
  | 'ready'
  | 'failed'

export const MODULE_INSTALL_STAGES: {id: ModuleInstallStageId; label: string; activeLabel: string}[] = [
  {id: 'resolving', label: 'Release verified', activeLabel: 'Verifying release'},
  {id: 'validating', label: 'Manifest validated', activeLabel: 'Checking compatibility'},
  {id: 'compatibility', label: 'Compatible', activeLabel: 'Checking compatibility'},
  {id: 'permissions', label: 'Permissions granted', activeLabel: 'Reviewing permissions'},
  {id: 'installing', label: 'Module installed', activeLabel: 'Installing'},
  {id: 'enabling', label: 'Module enabled', activeLabel: 'Enabling'},
  {id: 'ready', label: 'Ready', activeLabel: 'Ready'},
]

const ORDER: ModuleInstallStageId[] = MODULE_INSTALL_STAGES.map(stage => stage.id)

export function stageIndex(stage: ModuleInstallStageId): number {
  return ORDER.indexOf(stage)
}

export function ModuleInstallProgress({
  productName,
  stage,
  failed,
  onOpen,
}: {
  productName: string
  stage: ModuleInstallStageId
  failed?: string | null
  onOpen?: () => void
}) {
  const {spacing} = useThemeTokens()
  const current = stageIndex(stage === 'failed' ? 'resolving' : stage)
  return (
    <View style={{gap: spacing[3]}} testID="module-install-progress">
      <AppText variant="headline">Installing {productName}…</AppText>
      {MODULE_INSTALL_STAGES.filter(item => item.id !== 'ready').map(item => {
        const index = stageIndex(item.id)
        const done = current > index || stage === 'ready'
        const active = current === index && stage !== 'ready' && stage !== 'failed'
        return (
          <AppText
            key={item.id}
            variant="body"
            colour={done ? 'text' : active ? 'accent' : 'textTertiary'}>
            {done ? `✓ ${item.label}` : active ? `… ${item.activeLabel}` : item.label}
          </AppText>
        )
      })}
      {failed ? (
        <AppText variant="caption" colour="destructive">
          {failed}
        </AppText>
      ) : null}
      {stage === 'ready' && onOpen ? (
        <ModulaButton label={`Open ${productName}`} accessibilityLabel={`Open ${productName}`} onPress={onOpen} />
      ) : null}
    </View>
  )
}
