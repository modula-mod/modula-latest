import {createContext} from 'react'

import type {SessionState} from '@/auth/contracts'

export const SessionStateContext = createContext<SessionState>({status: 'booting'})
