import type {ReactNode} from 'react'
import type {ModulaNoticeTone} from '@/platform/ui/feedback/modula-feedback'

export type ModulaToastInput = {
  title?: string
  message: string
  tone?: ModulaNoticeTone
  actionLabel?: string
  onAction?: () => void
  duration?: number
  /** Stable IDs update an existing toast, preventing autosave spam. */
  id?: string
}

export type ModulaToastController = {
  show: (input: ModulaToastInput) => string
  close: (id?: string) => void
}

export type ModulaToastProviderProps = {children: ReactNode}
