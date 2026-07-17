import type {PropsWithChildren} from 'react'

import type {AuthCapability} from '@/auth/contracts'
import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {useCapability} from '@/auth/runtime/useCapability'

export function RequireCapability({
  capability,
  children,
  message,
}: PropsWithChildren<{
  capability: AuthCapability
  message?: string
}>) {
  const allowed = useCapability(capability)
  if (allowed) return <>{children}</>
  return (
    <ProtectedActionPrompt
      visible
      title="Sign in to continue"
      description={message ?? 'This Modula action needs a Modula Account.'}
    />
  )
}
