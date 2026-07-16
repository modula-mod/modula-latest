import {onlineManager} from '@tanstack/react-query'

import type {NetworkStatus} from '@/data/network/NetworkStatusContext'

export function syncQueryOnlineManager(status: NetworkStatus) {
  onlineManager.setOnline(!status.isOffline)
}
