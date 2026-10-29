import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import {AppState, type AppStateStatus} from 'react-native'

import {
  disableAppLock,
  loadAppLockConfig,
  saveAppLockConfig,
  saveCredential,
  verifyCredential,
} from '@/features/security/app-lock/app-lock-storage'
import {
  DEFAULT_APP_LOCK_CONFIG,
  type AppLockConfig,
  type AppLockStepUpScope,
  type AutoLockPolicy,
  type UnlockMethod,
} from '@/features/security/app-lock/types'

type BiometricStatus = {
  available: boolean
  enrolled: boolean
  label: string
  error?: string
}

type AppLockApi = {
  ready: boolean
  config: AppLockConfig
  enabled: boolean
  locked: boolean
  biometric: BiometricStatus
  refresh: () => Promise<void>
  lock: () => void
  unlockWithCredential: (
    method: Exclude<UnlockMethod, 'biometric'>,
    plaintext: string,
  ) => Promise<{ok: boolean; message?: string}>
  biometricUnlock: () => Promise<{ok: boolean; message?: string}>
  setEnabled: (enabled: boolean) => Promise<void>
  setMethod: (method: UnlockMethod) => Promise<void>
  setAutoLock: (policy: AutoLockPolicy) => Promise<void>
  setStepUp: (scope: AppLockStepUpScope, value: boolean) => Promise<void>
  setupCredential: (
    method: Exclude<UnlockMethod, 'biometric'>,
    plaintext: string,
  ) => Promise<void>
  setupBiometric: () => Promise<{ok: boolean; message?: string}>
  requireFor: (scope: AppLockStepUpScope) => Promise<boolean>
  clearAll: () => Promise<void>
}

const AppLockContext = createContext<AppLockApi | null>(null)

function autoLockDelayMs(policy: AutoLockPolicy): number {
  switch (policy) {
    case 'immediately':
    case 'app_close':
      return 0
    case '1min':
      return 60_000
    case '5min':
      return 300_000
  }
}

async function probeBiometric(): Promise<BiometricStatus> {
  return {
    available: false,
    enrolled: false,
    label: 'Biometric',
    error: 'Biometric unlock is unavailable in the GreenField web host.',
  }
}

export function AppLockProvider({children}: PropsWithChildren) {
  const [ready, setReady] = useState(false)
  const [config, setConfig] = useState<AppLockConfig>(DEFAULT_APP_LOCK_CONFIG)
  const [locked, setLocked] = useState(false)
  const [biometric, setBiometric] = useState<BiometricStatus>({
    available: false,
    enrolled: false,
    label: 'Biometric',
  })
  const backgroundedAt = useRef<number | null>(null)
  const unlockWaiters = useRef<((ok: boolean) => void)[]>([])

  const refresh = useCallback(async () => {
    const [next, bio] = await Promise.all([loadAppLockConfig(), probeBiometric()])
    setConfig(next)
    setBiometric(bio)
    if (next.enabled && next.configuredMethods.length > 0) {
      setLocked(true)
    } else {
      setLocked(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    void (async () => {
      await refresh()
      if (mounted) setReady(true)
    })()
    return () => {
      mounted = false
    }
  }, [refresh])

  const resolveWaiters = useCallback((ok: boolean) => {
    const waiters = unlockWaiters.current
    unlockWaiters.current = []
    for (const resolve of waiters) resolve(ok)
  }, [])

  const lock = useCallback(() => {
    if (!config.enabled) return
    setLocked(true)
  }, [config.enabled])

  const markUnlocked = useCallback(
    (next: AppLockConfig) => {
      setConfig(next)
      setLocked(false)
      resolveWaiters(true)
    },
    [resolveWaiters],
  )

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (!config.enabled) return
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now()
        if (config.autoLock === 'immediately' || config.autoLock === 'app_close') {
          setLocked(true)
        }
        return
      }
      if (state === 'active' && backgroundedAt.current != null) {
        const elapsed = Date.now() - backgroundedAt.current
        backgroundedAt.current = null
        if (elapsed >= autoLockDelayMs(config.autoLock)) {
          setLocked(true)
        }
      }
    }
    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [config.enabled, config.autoLock])

  const unlockWithCredential = useCallback(
    async (method: Exclude<UnlockMethod, 'biometric'>, plaintext: string) => {
      const result = await verifyCredential(method, plaintext, config)
      setConfig(result.config)
      if (!result.ok) {
        if (result.reason === 'lockout') {
          const secs = Math.ceil((result.remainingMs ?? 0) / 1000)
          return {ok: false, message: `Too many attempts. Try again in ${secs}s.`}
        }
        if (result.reason === 'missing') {
          return {ok: false, message: 'No local credential configured for this method.'}
        }
        return {ok: false, message: 'Incorrect. Try again.'}
      }
      markUnlocked(result.config)
      return {ok: true}
    },
    [config, markUnlocked],
  )

  const biometricUnlock = useCallback(async () => {
    return {
      ok: false,
      message: biometric.error ?? 'Biometric unlock is unavailable.',
    }
  }, [biometric.error])

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (enabled && config.configuredMethods.length === 0) return
      const next = {...config, enabled}
      await saveAppLockConfig(next)
      setConfig(next)
      setLocked(enabled)
    },
    [config],
  )

  const setMethod = useCallback(
    async (method: UnlockMethod) => {
      if (!config.configuredMethods.includes(method)) return
      const next = {...config, method}
      await saveAppLockConfig(next)
      setConfig(next)
    },
    [config],
  )

  const setAutoLock = useCallback(
    async (policy: AutoLockPolicy) => {
      const next = {...config, autoLock: policy}
      await saveAppLockConfig(next)
      setConfig(next)
    },
    [config],
  )

  const setStepUp = useCallback(
    async (scope: AppLockStepUpScope, value: boolean) => {
      const next = {
        ...config,
        requireForWallet: scope === 'wallet' ? value : config.requireForWallet,
        requireForPurchases: scope === 'purchases' ? value : config.requireForPurchases,
        requireForSettings: scope === 'settings' ? value : config.requireForSettings,
      }
      await saveAppLockConfig(next)
      setConfig(next)
    },
    [config],
  )

  const setupCredential = useCallback(
    async (method: Exclude<UnlockMethod, 'biometric'>, plaintext: string) => {
      const next = await saveCredential(method, plaintext, config)
      setConfig(next)
      setLocked(false)
    },
    [config],
  )

  const setupBiometric = useCallback(async () => {
    const bio = await probeBiometric()
    setBiometric(bio)
    return {ok: false, message: bio.error ?? 'Biometric unlock is unavailable.'}
  }, [])

  const requireFor = useCallback(
    (scope: AppLockStepUpScope) => {
      if (!config.enabled) return Promise.resolve(true)
      const needed =
        scope === 'wallet'
          ? config.requireForWallet
          : scope === 'purchases'
            ? config.requireForPurchases
            : config.requireForSettings
      if (!needed) return Promise.resolve(true)
      if (!locked) {
        setLocked(true)
      }
      return new Promise<boolean>(resolve => {
        unlockWaiters.current.push(resolve)
      })
    },
    [config.enabled, config.requireForPurchases, config.requireForSettings, config.requireForWallet, locked],
  )

  const clearAll = useCallback(async () => {
    const next = await disableAppLock(config)
    setConfig(next)
    setLocked(false)
    resolveWaiters(false)
  }, [config, resolveWaiters])

  const value = useMemo<AppLockApi>(
    () => ({
      ready,
      config,
      enabled: config.enabled,
      locked: config.enabled && locked,
      biometric,
      refresh,
      lock,
      unlockWithCredential,
      biometricUnlock,
      setEnabled,
      setMethod,
      setAutoLock,
      setStepUp,
      setupCredential,
      setupBiometric,
      requireFor,
      clearAll,
    }),
    [
      biometric,
      biometricUnlock,
      clearAll,
      config,
      lock,
      locked,
      ready,
      refresh,
      requireFor,
      setAutoLock,
      setEnabled,
      setMethod,
      setStepUp,
      setupBiometric,
      setupCredential,
      unlockWithCredential,
    ],
  )

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>
}

export function useAppLock(): AppLockApi {
  const ctx = useContext(AppLockContext)
  if (!ctx) {
    throw new Error('useAppLock must be used within AppLockProvider')
  }
  return ctx
}

/** Soft hook for surfaces that may render outside the provider during boot. */
export function useAppLockOptional(): AppLockApi | null {
  return useContext(AppLockContext)
}
