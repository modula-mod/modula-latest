import {createContext, useContext, useMemo, useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaInlineNotice} from '@/platform/ui/feedback/modula-feedback'
import type {
  ModulaToastController,
  ModulaToastInput,
  ModulaToastProviderProps,
} from '@/platform/ui/feedback/modula-toast-provider.types'
import {LAYERS} from '@/theme/tokens/layers'

const ToastContext = createContext<ModulaToastController | null>(null)

export function ModulaToastProvider({children}: ModulaToastProviderProps) {
  const [toasts, setToasts] = useState<(ModulaToastInput & {id: string})[]>([])
  const controller = useMemo<ModulaToastController>(() => ({
    show(input) {
      const id = input.id ?? `modula-toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
      setToasts(current => [...current.filter(toast => toast.id !== id), {...input, id}].slice(-3))
      if (input.duration !== 0) {
        setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), input.duration ?? 5000)
      }
      return id
    },
    close(id) {
      setToasts(current => id ? current.filter(toast => toast.id !== id) : [])
    },
  }), [])
  return (
    <ToastContext.Provider value={controller}>
      {children}
      <View pointerEvents="box-none" style={styles.viewport}>
        {toasts.map(toast => (
          <ModulaInlineNotice
            key={toast.id}
            action={toast.actionLabel && toast.onAction ? (
              <ModulaButton label={toast.actionLabel} onPress={() => { toast.onAction?.(); controller.close(toast.id) }} role="inline" />
            ) : undefined}
            message={toast.message}
            title={toast.title}
            tone={toast.tone}
          />
        ))}
      </View>
    </ToastContext.Provider>
  )
}

export function useModulaToast(): ModulaToastController {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useModulaToast must be used inside ModulaToastProvider')
  return value
}

const styles = StyleSheet.create({
  viewport: {
    gap: 8,
    left: 16,
    maxWidth: 360,
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: LAYERS.toast,
  },
})
