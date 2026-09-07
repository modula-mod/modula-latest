import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import type {ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet.types'

export type ModulaDrawerPresentation =
  | 'actions'
  | 'tools'
  | 'picker'
  | 'filters'
  | 'comments'
  | 'context'
  | 'configuration'
  | 'details'
  | 'media'

export type ModulaDrawerProps = Omit<ModulaSheetProps, 'presentation'> & {
  presentation?: ModulaDrawerPresentation
}

/** Gesture-first semantic overlay; mechanics are selected by the platform adapter. */
export function ModulaDrawer({presentation = 'actions', ...props}: ModulaDrawerProps) {
  return <ModulaSheet {...props} presentation={presentation} />
}
