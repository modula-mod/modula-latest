import {useContext} from 'react'

import {SessionStateContext} from '@/auth/runtime/SessionStateContext'

export function useSession() {
  return useContext(SessionStateContext)
}
