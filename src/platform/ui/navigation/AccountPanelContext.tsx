import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
} from 'react'
import {usePathname} from 'expo-router'

import {emitAccountPanelEvent} from '@/platform/ui/navigation/account-panel-events'
import {
  accountPanelReducer,
  initialPanelState,
  isAccountPanelVisible,
  type PanelCloseReason,
  type PanelState,
} from '@/platform/ui/navigation/account-panel-state'

type AccountPanelContextValue = {
  state: PanelState
  isVisible: boolean
  openAccountPanel: (source?: string) => void
  closeAccountPanel: (reason?: PanelCloseReason) => void
  notifyPresentationDismissed: (reason?: PanelCloseReason) => void
}

const AccountPanelContext = createContext<AccountPanelContextValue | null>(null)

export function AccountPanelProvider({children}: PropsWithChildren) {
  const [state, dispatch] = useReducer(accountPanelReducer, initialPanelState)
  const stateRef = useRef(state)
  stateRef.current = state
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)

  const openAccountPanel = useCallback((source = 'unknown') => {
    const current = stateRef.current
    const at = Date.now()
    emitAccountPanelEvent('accountPanel.open.request', current, {source})
    dispatch({type: 'OPEN_REQUEST', at, source})
  }, [])

  const closeAccountPanel = useCallback((reason: PanelCloseReason = 'explicit') => {
    const current = stateRef.current
    emitAccountPanelEvent('accountPanel.dismiss.request', current, {source: reason})
    dispatch({type: 'CLOSE_REQUEST', reason})
  }, [])

  const notifyPresentationDismissed = useCallback(
    (reason: PanelCloseReason = 'swipe') => {
      dispatch({type: 'PRESENTATION_DISMISSED', reason})
    },
    [],
  )

  useEffect(() => {
    if (state.status === 'opening') {
      emitAccountPanelEvent('accountPanel.opening', state)
      const frame = requestAnimationFrame(() => {
        dispatch({type: 'OPEN_COMPLETE'})
      })
      return () => cancelAnimationFrame(frame)
    }
    if (state.status === 'open') {
      emitAccountPanelEvent('accountPanel.open', state)
      return undefined
    }
    if (state.status === 'closing') {
      emitAccountPanelEvent('accountPanel.closing', state)
      const frame = requestAnimationFrame(() => {
        dispatch({type: 'CLOSE_COMPLETE'})
        emitAccountPanelEvent('accountPanel.closed', {status: 'closed'})
      })
      return () => cancelAnimationFrame(frame)
    }
    return undefined
  }, [state])

  useEffect(() => {
    if (pathnameRef.current === pathname) {
      return
    }
    pathnameRef.current = pathname
    emitAccountPanelEvent('accountPanel.route.changed', stateRef.current, {
      route: pathname,
    })
    dispatch({type: 'ROUTE_NAVIGATED'})
  }, [pathname])

  const value = useMemo<AccountPanelContextValue>(
    () => ({
      state,
      isVisible: isAccountPanelVisible(state),
      openAccountPanel,
      closeAccountPanel,
      notifyPresentationDismissed,
    }),
    [state, openAccountPanel, closeAccountPanel, notifyPresentationDismissed],
  )

  return (
    <AccountPanelContext.Provider value={value}>
      {children}
    </AccountPanelContext.Provider>
  )
}

export function useAccountPanel(): AccountPanelContextValue {
  const context = useContext(AccountPanelContext)
  if (!context) {
    throw new Error('useAccountPanel must be used within AccountPanelProvider')
  }
  return context
}
