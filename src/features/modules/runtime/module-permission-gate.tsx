import type {ReactNode} from 'react'

import {ModuleErrorState} from '@/features/modules/runtime/module-error-boundary'

export function ModulePermissionGate({
  available,
  reason,
  children,
}: {
  available: boolean
  reason?: string
  children: ReactNode
}) {
  if (!available) {
    return (
      <ModuleErrorState
        title={reason ?? 'Permission required'}
        body="Enable the module or review its permissions before this surface can run."
      />
    )
  }
  return <>{children}</>
}
