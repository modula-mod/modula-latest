import {useContext} from 'react'

import {NetworkStatusContext} from '@/data/network/NetworkStatusContext'

export function useNetworkStatus() {
  return useContext(NetworkStatusContext)
}
