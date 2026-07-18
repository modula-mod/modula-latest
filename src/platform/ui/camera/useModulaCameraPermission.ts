import {useCallback, useEffect} from 'react'
import {useCameraPermissions} from 'expo-camera'

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

/**
 * Camera permission helper for Appearance Advanced living backdrop Preview.
 * Pattern adapted from Motionary expo-camera-masked-blur (MIT).
 */
export function useModulaCameraPermission(
  autoRequest = false,
): UseModulaCameraPermissionResult {
  const [permission, requestCameraPermission] = useCameraPermissions()

  const status: ModulaCameraPermissionStatus = !permission
    ? 'loading'
    : permission.granted
      ? 'granted'
      : permission.canAskAgain
        ? 'denied'
        : 'blocked'

  const requestPermission = useCallback(async () => {
    try {
      await requestCameraPermission()
    } catch (error) {
      if (__DEV__) {
        console.warn('Camera permission request failed', error)
      }
    }
  }, [requestCameraPermission])

  useEffect(() => {
    if (autoRequest && status === 'denied') {
      void requestPermission()
    }
  }, [autoRequest, requestPermission, status])

  return {
    status,
    isReady: status === 'granted',
    isLoading: status === 'loading',
    canRetry: status === 'denied',
    requestPermission,
  }
}
