import type {ReactNode} from 'react'

export type ModulaSheetDetent = 'medium' | 'large' | 'full'
export type ModulaSheetPresentation = 'compact' | 'tools' | 'context' | 'picker' | 'interactive'
export type ModulaSheetSemanticDetent = 'content' | 'medium' | 'large' | 'full'

export type ModulaSheetSnapPoint = 'half' | 'full' | {fraction: number} | {height: number}

export type NativeSheetSnapPoint = 'half' | 'full'

export type ModulaSheetProps = {
  isPresented: boolean
  onDismiss: () => void
  children: ReactNode
  /** Semantic sheet category. Products describe intent, not platform mechanics. */
  presentation?: ModulaSheetPresentation
  /** Optional shared heading. Supplying a title creates a stable header. */
  title?: string
  subtitle?: string
  /** Stable header above the scroll body. */
  header?: ReactNode
  /** Fixed action footer above the safe area. Never place the primary CTA only in children. */
  footer?: ReactNode
  /**
   * Presentation height. Complex permission review should use `large`.
   * Defaults to medium + large so the user can expand.
   */
  detent?: ModulaSheetDetent
  /** Semantic detents; translated to each platform's supported values. */
  detents?: ModulaSheetSemanticDetent[]
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

export function detentForPresentation(
  presentation: ModulaSheetPresentation | undefined,
): ModulaSheetDetent {
  if (presentation === 'interactive') return 'full'
  if (presentation === 'tools' || presentation === 'context') return 'large'
  return 'medium'
}

export function snapPointsForSemanticDetents(
  detents: ModulaSheetSemanticDetent[] | undefined,
): ModulaSheetSnapPoint[] | undefined {
  if (!detents?.length) return undefined
  return detents.map(detent => (detent === 'content' || detent === 'medium' ? 'half' : 'full'))
}

export function snapPointsForDetent(detent: ModulaSheetDetent | undefined): NativeSheetSnapPoint[] {
  if (detent === 'full' || detent === 'large') return ['full']
  return ['half', 'full']
}

/**
 * Expo UI 57 BottomSheet accepts `'half' | 'full'`. Fraction/height objects
 * prevent presentation while chrome-obscure still hides the tab bar.
 */
export function nativeSnapPoints(points: ModulaSheetSnapPoint[] | undefined): NativeSheetSnapPoint[] {
  if (!points?.length) return ['half', 'full']
  const mapped = points.map(point => {
    if (point === 'half' || point === 'full') return point
    if (typeof point === 'object' && point && 'fraction' in point) {
      return point.fraction >= 0.75 ? 'full' : 'half'
    }
    return 'full'
  })
  return [...new Set(mapped)]
}
