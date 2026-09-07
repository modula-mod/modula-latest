import type {ReactElement} from 'react'

export type ModulaTooltipProps = {
  children: ReactElement
  label: string
  disabled?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
}

/** Native surfaces must never depend on hover for essential information. */
export function ModulaTooltip({children}: ModulaTooltipProps) {
  return children
}
