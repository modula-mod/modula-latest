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

type ExpoCameraModule = {
  getCameraPermissionsAsync?: () => Promise<CameraPermissionResponse>
  requestCameraPermissionsAsync?: () => Promise<CameraPermissionResponse>
  Camera?: {
    getCameraPermissionsAsync?: () => Promise<CameraPermissionResponse>
    requestCameraPermissionsAsync?: () => Promise<CameraPermissionResponse>
  }
}

function pickPermissionMethod(
  mod: ExpoCameraModule,
  key: 'getCameraPermissionsAsync' | 'requestCameraPermissionsAsync',
): (() => Promise<CameraPermissionResponse>) | null {
  const topLevel = mod[key]
  if (typeof topLevel === 'function') {
    return topLevel.bind(mod)
  }
  const nested = mod.Camera?.[key]
  if (typeof nested === 'function') {
    return nested.bind(mod.Camera)
  }
  return null
}

function loadCameraPermissionsApi(): ExpoCameraPermissionsApi | null {
  if (!isExpoCameraNativeAvailable()) {
    return null
  }
  try {
    // Dynamic require — static import crashes binaries without ExpoCamera linked.
    // Permission helpers live on `Camera` in current expo-camera; older builds
    // may also expose them as top-level named exports.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-camera') as ExpoCameraModule
    const getCameraPermissionsAsync = pickPermissionMethod(
      mod,
      'getCameraPermissionsAsync',
    )
    const requestCameraPermissionsAsync = pickPermissionMethod(
      mod,
      'requestCameraPermissionsAsync',
    )
    if (!getCameraPermissionsAsync || !requestCameraPermissionsAsync) {
      return null
    }
    return {getCameraPermissionsAsync, requestCameraPermissionsAsync}
  } catch {
    return null
  }
}

function statusFromPermission(
  permission: CameraPermissionResponse | null,
  apiAvailable: boolean | null,
): ModulaCameraPermissionStatus {
  if (apiAvailable === false) return 'unavailable'
  if (apiAvailable === null || !permission) return 'loading'
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
  const nativeAvailable = isExpoCameraNativeAvailable()
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(() =>
    nativeAvailable ? null : false,
  )
  const [permission, setPermission] = useState<CameraPermissionResponse | null>(
    null,
  )

  useEffect(() => {
    let active = true
    let id: ReturnType<typeof setTimeout> | null = null
    const markUnavailable = () => {
      if (!active) return
      setApiAvailable(false)
      setPermission(null)
    }
    if (!nativeAvailable) {
      id = setTimeout(markUnavailable, 0)
      return () => {
        active = false
        if (id) clearTimeout(id)
      }
    }

    const api = loadCameraPermissionsApi()
    if (!api) {
      id = setTimeout(markUnavailable, 0)
      return () => {
        active = false
        if (id) clearTimeout(id)
      }
    }

    void api
      .getCameraPermissionsAsync()
      .then(next => {
        if (active) {
          setApiAvailable(true)
          setPermission(next)
        }
      })
      .catch(error => {
        if (__DEV__) {
          console.warn('Camera permission lookup failed', error)
        }
        if (active) {
          setApiAvailable(false)
          setPermission(null)
        }
      })
    return () => {
      active = false
      if (id) clearTimeout(id)
    }
  }, [nativeAvailable])

  const requestPermission = useCallback(async () => {
    const api = loadCameraPermissionsApi()
    if (!api) {
      setApiAvailable(false)
      return
    }
    try {
      const next = await api.requestCameraPermissionsAsync()
      setApiAvailable(true)
      setPermission(next)
    } catch (error) {
      if (__DEV__) {
        console.warn('Camera permission request failed', error)
      }
    }
  }, [])

  const status = statusFromPermission(permission, apiAvailable)

  useEffect(() => {
    if (!autoRequest || status !== 'denied') return undefined
    const id = setTimeout(() => void requestPermission(), 0)
    return () => clearTimeout(id)
  }, [autoRequest, requestPermission, status])

  return {
    status,
    isReady: status === 'granted',
    isLoading: status === 'loading',
    canRetry: status === 'denied',
    requestPermission,
  }
}
