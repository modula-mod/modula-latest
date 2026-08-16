import type {ReactNode} from 'react'

export type ModulaSheetDetent = 'medium' | 'large' | 'full'

export type ModulaSheetSnapPoint = 'half' | 'full' | {fraction: number} | {height: number}

export type ModulaSheetProps = {
  isPresented: boolean
  onDismiss: () => void
  children: ReactNode
  /** Stable header above the scroll body. */
  header?: ReactNode
  /** Fixed action footer above the safe area. Never place the primary CTA only in children. */
  footer?: ReactNode
  /**
   * Presentation height. Complex permission review should use `large`.
   * Defaults to medium + large so the user can expand.
   */
  detent?: ModulaSheetDetent
  /** Medium + large detents by default for Tools / account panel. */
  snapPoints?: ModulaSheetSnapPoint[]
  showDragIndicator?: boolean
  testID?: string
  /** Prefer glass material when Reduce Transparency is off. Chrome only — not content wallpaper. */
  material?: 'solid' | 'glass'
  /**
   * When true (default), the scrollable body is the `children` slot and the
   * footer stays pinned. Set false only for callers that manage their own layout.
   */
  scrollBody?: boolean
  /** Hide and inert the shell tab bar while this actionable sheet is open. */
  obscureShellChrome?: boolean
  accessibilityLabel?: string
}

export function snapPointsForDetent(detent: ModulaSheetDetent | undefined): ModulaSheetSnapPoint[] {
  if (detent === 'full') return ['full']
  if (detent === 'large') return [{fraction: 0.92}, 'full']
  if (detent === 'medium') return ['half', 'full']
  return ['half', 'full']
}
