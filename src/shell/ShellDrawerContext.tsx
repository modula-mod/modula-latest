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
import {Animated} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type DrawerPhase = 'closed' | 'opening' | 'open' | 'closing'

type CloseDrawerOptions = {
  afterClose?: () => void
}

type ShellDrawerContextValue = {
  phase: DrawerPhase
  progress: Animated.Value
  openDrawer: () => void
  closeDrawer: (options?: CloseDrawerOptions) => void
}

const ShellDrawerContext = createContext<ShellDrawerContextValue | null>(null)

/**
 * Left navigation drawer controller (animated Modal).
 * Avatar / shell chrome should call openDrawer — this is the live navigation surface.
 */
export function ShellDrawerProvider({children}: PropsWithChildren) {
  const {motion} = useThemeTokens()
  const [progress] = useState(() => new Animated.Value(0))
  const phaseRef = useRef<DrawerPhase>('closed')
  const afterCloseRef = useRef<(() => void) | undefined>(undefined)
  const [phase, setPhaseState] = useState<DrawerPhase>('closed')

  const setPhase = useCallback((next: DrawerPhase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const openDrawer = useCallback(() => {
    if (phaseRef.current === 'opening' || phaseRef.current === 'open') {
      return
    }
    progress.stopAnimation()
    afterCloseRef.current = undefined
    setPhase('opening')
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.normal,
      useNativeDriver: true,
    }).start(({finished}) => {
      setPhase(finished ? 'open' : 'closed')
    })
  }, [motion.normal, progress, setPhase])

  const closeDrawer = useCallback(
    (options?: CloseDrawerOptions) => {
      if (phaseRef.current === 'closing' || phaseRef.current === 'closed') {
        return
      }
      progress.stopAnimation()
      afterCloseRef.current = options?.afterClose
      setPhase('closing')
      Animated.timing(progress, {
        toValue: 0,
        duration: motion.fast,
        useNativeDriver: true,
      }).start(({finished}) => {
        setPhase(finished ? 'closed' : 'open')
        if (finished) {
          const afterClose = afterCloseRef.current
          afterCloseRef.current = undefined
          afterClose?.()
        }
      })
    },
    [motion.fast, progress, setPhase],
  )

  useEffect(() => {
    return () => {
      progress.stopAnimation()
    }
  }, [progress])

  const value = useMemo<ShellDrawerContextValue>(
    () => ({phase, progress, openDrawer, closeDrawer}),
    [phase, progress, openDrawer, closeDrawer],
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
