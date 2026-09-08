import {useCallback, useEffect, useRef, useState, type PropsWithChildren} from 'react'
import {StyleSheet, View} from 'react-native'

import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaDialog} from '@/platform/ui/dialogs/modula-dialog'
import {
  registerWebConfirmationPresenter,
  type WebConfirmationOptions,
} from '@/platform/ui/menus/confirmation-presenter.web'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PendingConfirmation = {
  options: WebConfirmationOptions
  resolve: (confirmed: boolean) => void
}

/** One accessible, queued confirmation host for every imperative product action. */
export function ModulaConfirmationProvider({children}: PropsWithChildren) {
  const {spacing} = useThemeTokens()
  const activeRef = useRef<PendingConfirmation | null>(null)
  const queueRef = useRef<PendingConfirmation[]>([])
  const [active, setActive] = useState<PendingConfirmation | null>(null)

  const presentNext = useCallback((request: PendingConfirmation | null) => {
    activeRef.current = request
    setActive(request)
  }, [])

  useEffect(() => registerWebConfirmationPresenter(options => new Promise(resolve => {
    const request = {options, resolve}
    if (activeRef.current) {
      queueRef.current.push(request)
      return
    }
    presentNext(request)
  })), [presentNext])

  const finish = useCallback((confirmed: boolean) => {
    const current = activeRef.current
    if (!current) return
    current.resolve(confirmed)
    presentNext(queueRef.current.shift() ?? null)
  }, [presentNext])

  return (
    <>
      {children}
      <ModulaDialog
        dismissOnOutsidePress={false}
        footer={active ? (
          <View style={[styles.actions, {gap: spacing[2]}]}>
            <View style={styles.action}>
              <ModulaButton
                fullWidth
                label={active.options.cancelLabel ?? 'Cancel'}
                onPress={() => finish(false)}
                role="secondary"
              />
            </View>
            <View style={styles.action}>
              <ModulaButton
                fullWidth
                label={active.options.confirmLabel ?? 'Confirm'}
                onPress={() => finish(true)}
                role={active.options.destructive === false ? 'primary' : 'destructive'}
              />
            </View>
          </View>
        ) : undefined}
        isPresented={Boolean(active)}
        onDismiss={() => finish(false)}
        presentation="configuration"
        size="small"
        subtitle={active?.options.message}
        testID="modula-confirmation-dialog"
        title={active?.options.title}>
        <View />
      </ModulaDialog>
    </>
  )
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
  },
})
