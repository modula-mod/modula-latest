import type {ReactNode} from 'react'

import {ModulaActionButton} from '@/platform/ui/buttons/modula-action-button'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'
import {ModulaToolbar} from '@/platform/ui/toolbars'

export function ModulaFloatingButton({
  icon,
  label,
  onPress,
  prominent = false,
}: {
  icon: ModulaIconName
  label: string
  onPress: () => void
  prominent?: boolean
}) {
  if (prominent) {
    return <ModulaActionButton emphasis="primary" icon={icon} label={label} onPress={onPress} size="prominent" />
  }
  return <ModulaIconButton accessibilityLabel={label} chrome="glass" icon={icon} onPress={onPress} />
}

export function ModulaFloatingGroup({children}: {children: ReactNode}) {
  return <ModulaToolbar variant="floating">{children}</ModulaToolbar>
}

export const ModulaFloatingToolbar = ModulaFloatingGroup
