import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import {Linking} from 'react-native'
import {
  runOnJS,
  useSharedValue,
  withSpring,
  withTiming,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function urlRequestsDrawer(url: string | null): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('openDrawer') === '1'
  } catch {
    return /[?&]openDrawer=1(?:&|$)/.test(url)
  }
}

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
  const drawerSpring = motion.springs.drawer
  const closeSpring = motion.springs.navigation

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
    if (phaseRef.current === 'open') {
      return
    }
    afterCloseRef.current = undefined
    setPhase('opening')
    cancelAnimation(progress)
    // Reanimated shared value, not React state.
    // eslint-disable-next-line react-hooks/immutability
    progress.value = withSpring(1, drawerSpring, finished => {
      if (finished) runOnJS(finishOpen)()
    })
  }, [drawerSpring, finishOpen, progress, setPhase])

  const closeDrawer = useCallback(
    (options?: CloseDrawerOptions) => {
      if (phaseRef.current === 'closed') {
        return
      }
      afterCloseRef.current = options?.afterClose
      setPhase('closing')
      cancelAnimation(progress)
      if (motion.fast === 0) {
        // Reduce Motion: snap closed without travel.
        // eslint-disable-next-line react-hooks/immutability
        progress.value = 0
        finishClose()
        return
      }
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
      cancelAnimation(progress)
      if (shouldClose) {
        afterCloseRef.current = undefined
        setPhase('closing')
        if (motion.fast === 0) {
          // eslint-disable-next-line react-hooks/immutability
          progress.value = 0
          finishClose()
          return
        }
        progress.value = withSpring(0, closeSpring, finished => {
          if (finished) runOnJS(finishClose)()
        })
        return
      }
      setPhase('opening')
      progress.value = withSpring(1, drawerSpring, finished => {
        if (finished) runOnJS(finishOpen)()
      })
    },
    [closeSpring, drawerSpring, finishClose, finishOpen, motion.fast, progress, setPhase],
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

  // Dev-only deep link for Simulator smoke when UI automation lacks assistive access.
  // Same openDrawer() path as the header menu button: modula:///?openDrawer=1
  useEffect(() => {
    if (!__DEV__) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const maybeOpen = (url: string | null) => {
      if (!urlRequestsDrawer(url)) return
      // Delay past splash / route settle so the drawer is not immediately closed.
      clearTimeout(timer)
      timer = setTimeout(() => openDrawer(), 600)
    }
    void Linking.getInitialURL().then(maybeOpen)
    const sub = Linking.addEventListener('url', ({url}) => maybeOpen(url))
    return () => {
      clearTimeout(timer)
      sub.remove()
    }
  }, [openDrawer])

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
