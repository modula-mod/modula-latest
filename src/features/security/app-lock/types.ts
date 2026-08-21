export type UnlockMethod = 'pin' | 'password' | 'pattern' | 'biometric'

export type AutoLockPolicy = 'immediately' | '1min' | '5min' | 'app_close'

export type AppLockStepUpScope = 'wallet' | 'purchases' | 'settings'

export type AppLockConfig = {
  enabled: boolean
  /** Preferred unlock surface when the gate appears. */
  method: UnlockMethod
  /** Knowledge / biometric methods that have local material configured. */
  configuredMethods: UnlockMethod[]
  autoLock: AutoLockPolicy
  requireForWallet: boolean
  requireForPurchases: boolean
  requireForSettings: boolean
  /** Random salt for local credential hashing — never leaves the device. */
  salt: string
  lastUnlockedAt?: string
  failCount: number
  lockoutUntil?: string
}

export const DEFAULT_APP_LOCK_CONFIG: AppLockConfig = {
  enabled: false,
  method: 'pin',
  configuredMethods: [],
  autoLock: 'immediately',
  requireForWallet: true,
  requireForPurchases: true,
  requireForSettings: false,
  salt: '',
  failCount: 0,
}

/** Amber accent for App Lock surfaces (founder security mockups). */
export const APP_LOCK_ACCENT = '#F5A623'

export const PIN_LENGTH = 6
export const PATTERN_MIN_NODES = 4
export const MAX_FAIL_ATTEMPTS = 5
export const LOCKOUT_MS = 30_000

export const AUTO_LOCK_OPTIONS: {id: AutoLockPolicy; label: string}[] = [
  {id: 'immediately', label: 'Immediately'},
  {id: '1min', label: '1 min'},
  {id: '5min', label: '5 min'},
  {id: 'app_close', label: 'When app closes'},
]

export const UNLOCK_METHOD_COPY: Record<
  UnlockMethod,
  {label: string; description: string}
> = {
  pin: {label: 'PIN', description: 'Enter a numeric PIN.'},
  password: {label: 'Password', description: 'Enter a secure password.'},
  pattern: {label: 'Pattern', description: 'Draw an unlock pattern.'},
  biometric: {label: 'Biometric', description: 'Use Face ID or Touch ID.'},
}
