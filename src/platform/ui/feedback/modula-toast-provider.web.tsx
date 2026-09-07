import {Toast} from '@base-ui/react/toast'
import {createContext, useContext, useMemo} from 'react'

import type {
  ModulaToastController,
  ModulaToastInput,
  ModulaToastProviderProps,
} from '@/platform/ui/feedback/modula-toast-provider.types'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

type ToastData = Pick<ModulaToastInput, 'actionLabel' | 'onAction'>
const ToastContext = createContext<ModulaToastController | null>(null)

export function ModulaToastProvider({children}: ModulaToastProviderProps) {
  return (
    <Toast.Provider limit={3} timeout={5000}>
      <ToastBridge>{children}</ToastBridge>
    </Toast.Provider>
  )
}

function ToastBridge({children}: ModulaToastProviderProps) {
  const manager = Toast.useToastManager<ToastData>()
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const variables = modulaWebCssVariables(tokens, {reduceTransparency})
  const controller = useMemo<ModulaToastController>(() => ({
    show(input) {
      return manager.add({
        id: input.id,
        title: input.title,
        description: input.message,
        type: input.tone ?? 'info',
        priority: input.tone === 'error' ? 'high' : 'low',
        timeout: input.duration,
        data: {actionLabel: input.actionLabel, onAction: input.onAction},
      })
    },
    close: manager.close,
  }), [manager])
  return (
    <ToastContext.Provider value={controller}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="modula-web-ui modula-web-toast-viewport" style={variables}>
          {manager.toasts.map(toast => (
            <Toast.Root
              className="modula-web-toast"
              data-tone={toast.type}
              key={toast.id}
              swipeDirection={['down', 'right']}
              toast={toast}>
              <Toast.Content className="modula-web-toast-content">
                <div className="modula-web-toast-copy">
                  <Toast.Title className="modula-web-toast-title" />
                  <Toast.Description className="modula-web-toast-description" />
                </div>
                {toast.data?.actionLabel && toast.data.onAction ? (
                  <Toast.Action
                    className="modula-web-toast-action"
                    onClick={() => { toast.data?.onAction?.(); manager.close(toast.id) }}>
                    {toast.data.actionLabel}
                  </Toast.Action>
                ) : null}
                <Toast.Close aria-label="Dismiss notification" className="modula-web-toast-close">×</Toast.Close>
              </Toast.Content>
            </Toast.Root>
          ))}
        </Toast.Viewport>
      </Toast.Portal>
    </ToastContext.Provider>
  )
}

export function useModulaToast(): ModulaToastController {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useModulaToast must be used inside ModulaToastProvider')
  return value
}
