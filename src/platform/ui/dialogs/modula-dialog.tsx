import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import type {ModulaDialogSize, ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet.types'

export type {ModulaDialogSize} from '@/platform/ui/sheets/modula-sheet.types'
export type ModulaDialogProps = Omit<ModulaSheetProps, 'desktopPresentation' | 'detent' | 'presentation'> & {
  size?: ModulaDialogSize
  presentation?: 'edit-profile' | 'command' | 'details' | 'configuration' | 'media'
}

/** Focused task surface: centered dialog on desktop, touch drawer on compact web. */
export function ModulaDialog({size = 'regular', presentation = 'configuration', ...props}: ModulaDialogProps) {
  return (
    <ModulaSheet
      {...props}
      desktopPresentation="dialog"
      dialogSize={size}
      detent={size === 'large' ? 'large' : size === 'small' ? 'medium' : undefined}
      presentation={presentation === 'media' ? 'media' : presentation === 'details' ? 'details' : 'interactive'}
    />
  )
}
