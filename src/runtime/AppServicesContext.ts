import {createContext} from 'react'

import type {AppServices} from '@/runtime/AppServices'

export const AppServicesContext = createContext<AppServices | null>(null)
