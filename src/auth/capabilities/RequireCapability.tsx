import type {PropsWithChildren} from 'react'

import type {AuthCapability} from '@/auth/contracts'
import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {useCapability} from '@/auth/runtime/useCapability'
import {useHydrated} from '@/lib/useHydrated'

export function RequireCapability({
  capability,
  children,
  message,
}: PropsWithChildren<{
  capability: AuthCapability
  message?: string
}>) {
  const hydrated = useHydrated()
  const allowed = useCapability(capability)
  if (!hydrated) return null
  if (allowed) return <>{children}</>
  return (
    <ProtectedActionPrompt
      visible
      title="Sign in to continue"
      description={message ?? 'This Modula action needs a Modula Account.'}
    />
  )
}
