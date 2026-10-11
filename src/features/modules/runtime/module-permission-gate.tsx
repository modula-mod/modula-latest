import type {ReactNode} from 'react'

import {ModuleErrorState} from '@/features/modules/runtime/module-error-boundary'

export function ModulePermissionGate({
  available,
  reason,
  body,
  children,
}: {
  available: boolean
  reason?: string
  body?: string
  children: ReactNode
}) {
  if (!available) {
    return (
      <ModuleErrorState
        title={reason ?? 'Permission required'}
        body={body ?? 'Enable the module or review its permissions before this surface can run.'}
      />
    )
  }
  return <>{children}</>
}
