export type ModulaCameraPermissionStatus =
  | 'loading'
  | 'granted'
  | 'denied'
  | 'blocked'

export type UseModulaCameraPermissionResult = {
  status: ModulaCameraPermissionStatus
  isReady: boolean
  isLoading: boolean
  canRetry: boolean
  requestPermission: () => Promise<void>
}

/** Web: camera living backdrop is unavailable. */
export function useModulaCameraPermission(
  _autoRequest = false,
): UseModulaCameraPermissionResult {
  return {
    status: 'blocked',
    isReady: false,
    isLoading: false,
    canRetry: false,
    requestPermission: async () => undefined,
  }
}
