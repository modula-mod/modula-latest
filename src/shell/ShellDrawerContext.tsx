import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react'
import {Animated} from 'react-native'

import {useAccountPanel} from '@/platform/ui/navigation/AccountPanelContext'

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
 * Compatibility shim over AccountPanelProvider.
 * Prefer openAccountPanel / closeAccountPanel in new code.
 */
export function ShellDrawerProvider({children}: PropsWithChildren) {
  const {state, openAccountPanel, closeAccountPanel} = useAccountPanel()
  const [progress] = useMemo(() => [new Animated.Value(0)], [])

  const openDrawer = useCallback(() => {
    openAccountPanel('shell-drawer-shim')
  }, [openAccountPanel])

  const closeDrawer = useCallback(
    (options?: CloseDrawerOptions) => {
      closeAccountPanel('explicit')
      options?.afterClose?.()
    },
    [closeAccountPanel],
  )

  const value = useMemo<ShellDrawerContextValue>(
    () => ({
      phase: state.status,
      progress,
      openDrawer,
      closeDrawer,
    }),
    [state.status, progress, openDrawer, closeDrawer],
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
