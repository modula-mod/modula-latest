import {createContext} from 'react'
import {NetworkStateType, type NetworkState} from 'expo-network'

export type NetworkConnectionType = NetworkState['type']

export type NetworkStatus = {
  isConnected: boolean | null
  isInternetReachable: boolean | null
  type: NetworkConnectionType
  isOffline: boolean
}

export const initialNetworkStatus: NetworkStatus = {
  isConnected: null,
  isInternetReachable: null,
  type: NetworkStateType.UNKNOWN,
  isOffline: false,
}

export const NetworkStatusContext = createContext<NetworkStatus>(initialNetworkStatus)
