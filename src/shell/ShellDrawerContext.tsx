import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import {
  runOnJS,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type DrawerPhase = 'closed' | 'opening' | 'open' | 'closing'

type CloseDrawerOptions = {
  afterClose?: () => void
}

type ShellDrawerContextValue = {
  phase: DrawerPhase
  progress: SharedValue<number>
  openDrawer: () => void
  closeDrawer: (options?: CloseDrawerOptions) => void
  /** Settle after a drag — pass velocity (and optional progress snapshot). */
  settleDrawer: (options?: {velocityX?: number; at?: number}) => void
}

const ShellDrawerContext = createContext<ShellDrawerContextValue | null>(null)

const OPEN_SPRING = {damping: 24, stiffness: 260, mass: 0.9}
const CLOSE_SPRING = {damping: 28, stiffness: 320, mass: 0.85}

/**
 * Left navigation drawer controller (Reanimated + Modal).
 * Avatar / shell chrome should call openDrawer — this is the live navigation surface.
 */
export function ShellDrawerProvider({children}: PropsWithChildren) {
  const {motion} = useThemeTokens()
  const progress = useSharedValue(0)
  const phaseRef = useRef<DrawerPhase>('closed')
  const afterCloseRef = useRef<(() => void) | undefined>(undefined)
  const [phase, setPhaseState] = useState<DrawerPhase>('closed')

  const setPhase = useCallback((next: DrawerPhase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const finishOpen = useCallback(() => {
    setPhase('open')
  }, [setPhase])

  const finishClose = useCallback(() => {
    setPhase('closed')
    const afterClose = afterCloseRef.current
    afterCloseRef.current = undefined
    afterClose?.()
  }, [setPhase])

  const openDrawer = useCallback(() => {
    if (phaseRef.current === 'opening' || phaseRef.current === 'open') {
      return
    }
    afterCloseRef.current = undefined
    setPhase('opening')
    progress.value = withSpring(1, OPEN_SPRING, finished => {
      if (finished) runOnJS(finishOpen)()
    })
  }, [finishOpen, progress, setPhase])

  const closeDrawer = useCallback(
    (options?: CloseDrawerOptions) => {
      if (phaseRef.current === 'closing' || phaseRef.current === 'closed') {
        return
      }
      afterCloseRef.current = options?.afterClose
      setPhase('closing')
      progress.value = withTiming(0, {duration: motion.fast}, finished => {
        if (finished) runOnJS(finishClose)()
      })
    },
    [finishClose, motion.fast, progress, setPhase],
  )

  const settleDrawer = useCallback(
    (options?: {velocityX?: number; at?: number}) => {
      if (phaseRef.current === 'closed') return
      const velocityX = options?.velocityX ?? 0
      const at = options?.at ?? progress.value
      const shouldClose = at < 0.55 || velocityX < -600
      if (shouldClose) {
        afterCloseRef.current = undefined
        setPhase('closing')
        progress.value = withSpring(0, CLOSE_SPRING, finished => {
          if (finished) runOnJS(finishClose)()
        })
        return
      }
      setPhase('opening')
      progress.value = withSpring(1, OPEN_SPRING, finished => {
        if (finished) runOnJS(finishOpen)()
      })
    },
    [finishClose, finishOpen, progress, setPhase],
  )

  const value = useMemo<ShellDrawerContextValue>(
    () => ({
      phase,
      progress,
      openDrawer,
      closeDrawer,
      settleDrawer,
    }),
    [phase, progress, openDrawer, closeDrawer, settleDrawer],
  )

  return (
    <ShellDrawerContext.Provider value={value}>{children}</ShellDrawerContext.Provider>
  )
}

export function useShellDrawer(): ShellDrawerContextValue {
  const context = useContext(ShellDrawerContext)
  if (!context) {
    throw new Error('useShellDrawer must be used within ShellDrawerProvider')
  }
  return context
}
