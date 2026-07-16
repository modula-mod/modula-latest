import {useMemo, useState} from 'react'

import type {AuthCapability} from '@/auth/contracts'
import {getSessionCapabilities} from '@/auth/capabilities/getSessionCapabilities'
import {useSession} from '@/auth/runtime/useSession'

export function useCapability(capability: AuthCapability): boolean {
  const session = useSession()
  return useMemo(
    () => getSessionCapabilities(session).has(capability),
    [capability, session],
  )
}

export function requireCapability(capability: AuthCapability, action: () => void) {
  return {
    run(canRun: boolean, prompt: () => void) {
      if (canRun) {
        action()
        return
      }
      prompt()
    },
    capability,
  }
}

export function useProtectedPrompt() {
  const [visible, setVisible] = useState(false)
  return {
    visible,
    show: () => setVisible(true),
    hide: () => setVisible(false),
  }
}
