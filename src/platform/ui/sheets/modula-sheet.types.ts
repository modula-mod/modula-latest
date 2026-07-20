import type {ReactNode} from 'react'

export type ModulaSheetProps = {
  isPresented: boolean
  onDismiss: () => void
  children: ReactNode
  /** Medium + large detents by default for Tools / account panel. */
  snapPoints?: ('half' | 'full' | {fraction: number} | {height: number})[]
  showDragIndicator?: boolean
  testID?: string
  /** Prefer glass material when Reduce Transparency is off. */
  material?: 'solid' | 'glass'
}
