import * as Network from 'expo-network'
import {useEffect, useMemo, useState, type PropsWithChildren} from 'react'

import {NetworkStatusContext, initialNetworkStatus, type NetworkStatus} from '@/data/network/NetworkStatusContext'
import {syncQueryOnlineManager} from '@/data/query/queryOnlineManager'

function toStatus(state: Network.NetworkState): NetworkStatus {
  const isConnected = state.isConnected ?? null
  const isInternetReachable = state.isInternetReachable ?? null
  const isOffline = isConnected === false || isInternetReachable === false
  return {
    isConnected,
    isInternetReachable,
    type: state.type ?? Network.NetworkStateType.UNKNOWN,
    isOffline,
  }
}

export function NetworkRuntime({children}: PropsWithChildren) {
  const [status, setStatus] = useState<NetworkStatus>(initialNetworkStatus)

  useEffect(() => {
    let mounted = true
    Network.getNetworkStateAsync()
      .then(state => {
        if (mounted) setStatus(toStatus(state))
      })
      .catch(() => {
        if (mounted) setStatus(initialNetworkStatus)
      })
    const subscription = Network.addNetworkStateListener(state => {
      setStatus(toStatus(state))
    })
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    syncQueryOnlineManager(status)
  }, [status])

  const value = useMemo(() => status, [status])

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  )
}
