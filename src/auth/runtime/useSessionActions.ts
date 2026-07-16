import {useContext} from 'react'

import {SessionActionsContext} from '@/auth/runtime/SessionActionsContext'

export function useSessionActions() {
  const actions = useContext(SessionActionsContext)
  if (!actions) throw new Error('useSessionActions must be used within SessionProvider')
  return actions
}
