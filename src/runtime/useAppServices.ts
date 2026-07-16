import {useContext} from 'react'

import {AppServicesContext} from '@/runtime/AppServicesContext'

export function useAppServices() {
  const services = useContext(AppServicesContext)
  if (!services) {
    throw new Error('useAppServices must be used within AppServicesProvider')
  }
  return services
}
