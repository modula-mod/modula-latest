import {Fab} from 'konsta/react'
import type {ReactNode} from 'react'

export function KonstaFloatingAction({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode
  label: string
  onPress: () => void
}) {
  return (
    <Fab
      aria-label={label}
      className="modula-konsta-fab"
      component="button"
      icon={icon}
      onClick={onPress}
      text={label}
      type="button"
    />
  )
}
