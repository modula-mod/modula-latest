import {useCallback, useEffect, useState} from 'react'

import {isExpoCameraNativeAvailable} from '@/platform/ui/native-modules/expo-native-availability'

export type ModulaCameraPermissionStatus =
  | 'unavailable'
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

type CameraPermissionResponse = {
  granted: boolean
  canAskAgain: boolean
}

type ExpoCameraPermissionsApi = {
  getCameraPermissionsAsync: () => Promise<CameraPermissionResponse>
  requestCameraPermissionsAsync: () => Promise<CameraPermissionResponse>
}

function loadCameraPermissionsApi(): ExpoCameraPermissionsApi | null {
  if (!isExpoCameraNativeAvailable()) {
    return null
  }
  try {
    // Dynamic require — static import crashes binaries without ExpoCamera linked.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-camera') as ExpoCameraPermissionsApi
  } catch {
    return null
  }
}

function statusFromPermission(
  permission: CameraPermissionResponse | null,
  available: boolean,
): ModulaCameraPermissionStatus {
  if (!available) return 'unavailable'
  if (!permission) return 'loading'
  if (permission.granted) return 'granted'
  if (!permission.canAskAgain) return 'blocked'
  return 'denied'
}

/**
 * Camera permission helper for Appearance Advanced living backdrop Preview.
 * Safe when ExpoCamera is not linked (shows unavailable instead of crashing).
 */
export function useModulaCameraPermission(
  autoRequest = false,
): UseModulaCameraPermissionResult {
  const available = isExpoCameraNativeAvailable()
  const [permission, setPermission] = useState<CameraPermissionResponse | null>(
    null,
  )

  useEffect(() => {
    if (!available) {
      setPermission(null)
      return
    }
    const api = loadCameraPermissionsApi()
    if (!api) {
      setPermission(null)
      return
    }
    let active = true
    void api.getCameraPermissionsAsync().then(next => {
      if (active) setPermission(next)
    })
    return () => {
      active = false
    }
  }, [available])

  const requestPermission = useCallback(async () => {
    const api = loadCameraPermissionsApi()
    if (!api) return
    try {
      const next = await api.requestCameraPermissionsAsync()
      setPermission(next)
    } catch (error) {
      if (__DEV__) {
        console.warn('Camera permission request failed', error)
      }
    }
  }, [])

  const status = statusFromPermission(permission, available)

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
