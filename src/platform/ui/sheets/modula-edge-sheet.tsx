import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import type {ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet.types'

export type ModulaEdgeSheetProps = Omit<ModulaSheetProps, 'desktopPresentation'>

/** Edge task panel on desktop; compact/touch web adapts to a bottom drawer. */
export function ModulaEdgeSheet(props: ModulaEdgeSheetProps) {
  return <ModulaSheet {...props} desktopPresentation="sheet" />
}
