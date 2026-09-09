import {useCallback, useEffect, useRef, useState, type PropsWithChildren} from 'react'

import {registerWebActionPresenter} from '@/platform/ui/menus/action-presenter.web'
import {ModulaTouchActionDrawer} from '@/platform/ui/menus/modula-menu.web'
import type {PresentModulaActionsOptions} from '@/platform/ui/menus/types'

type PendingAction = {
  options: PresentModulaActionsOptions
  resolve: (actionId: string | null) => void
}

/** One queued responsive host for legacy imperative semantic action calls. */
export function ModulaActionPresenterProvider({children}: PropsWithChildren) {
  const activeRef = useRef<PendingAction | null>(null)
  const queueRef = useRef<PendingAction[]>([])
  const [active, setActive] = useState<PendingAction | null>(null)

  const presentNext = useCallback((request: PendingAction | null) => {
    activeRef.current = request
    setActive(request)
  }, [])

  useEffect(() => registerWebActionPresenter(options => new Promise(resolve => {
    const request = {options, resolve}
    if (activeRef.current) {
      queueRef.current.push(request)
      return
    }
    presentNext(request)
  })), [presentNext])

  const finish = useCallback((actionId: string | null) => {
    const current = activeRef.current
    if (!current) return
    current.resolve(actionId)
    presentNext(queueRef.current.shift() ?? null)
  }, [presentNext])

  return (
    <>
      {children}
      <ModulaTouchActionDrawer
        actions={active?.options.actions ?? []}
        message={active?.options.message}
        onAction={finish}
        onDismiss={() => finish(null)}
        onOpenChange={() => undefined}
        open={Boolean(active)}
        title={active?.options.title}
      />
    </>
  )
}
