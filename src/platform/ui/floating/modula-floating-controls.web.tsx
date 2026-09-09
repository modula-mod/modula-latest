import type {ReactNode} from 'react'

import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {KonstaFloatingControlGroup} from '@/platform/ui/adapters/konsta/toolbar-pane.web'
import {KonstaFloatingAction} from '@/platform/ui/adapters/konsta/fab.web'
import {ModulaIcon} from '@/platform/ui/icons'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'

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
    return (
      <KonstaFloatingAction
        icon={<ModulaIcon colour="currentColor" name={icon} size={20} />}
        label={label}
        onPress={onPress}
      />
    )
  }
  return <ModulaIconButton accessibilityLabel={label} chrome="glass" icon={icon} onPress={onPress} />
}

export function ModulaFloatingGroup({children}: {children: ReactNode}) {
  return <KonstaFloatingControlGroup>{children}</KonstaFloatingControlGroup>
}

export const ModulaFloatingToolbar = ModulaFloatingGroup
