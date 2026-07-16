import {useMemo, type PropsWithChildren} from 'react'

import {AppServicesContext} from '@/runtime/AppServicesContext'
import {createAppServices} from '@/runtime/createAppServices'

export function AppServicesProvider({children}: PropsWithChildren) {
  const services = useMemo(() => createAppServices(), [])
  return (
    <AppServicesContext.Provider value={services}>
      {children}
    </AppServicesContext.Provider>
  )
}
