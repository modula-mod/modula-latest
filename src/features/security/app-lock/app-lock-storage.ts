/**
 * LOCAL ONLY — App Lock credential material never leaves this device and is
 * never sent to Modula servers. Hashes only; plaintext is never persisted.
 */
import {createSalt, hashCredential} from '@/features/security/app-lock/hash'
import {
  DEFAULT_APP_LOCK_CONFIG,
  LOCKOUT_MS,
  MAX_FAIL_ATTEMPTS,
  type AppLockConfig,
  type UnlockMethod,
} from '@/features/security/app-lock/types'

const CONFIG_KEY = 'modula.appLock.config.v1'
const CREDENTIAL_PREFIX = 'modula.appLock.cred.v1.'

const fallbackStorage = new Map<string, string>()

function browserStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage
  } catch {
    return null
  }
}

function credentialKey(method: Exclude<UnlockMethod, 'biometric'>): string {
  return `${CREDENTIAL_PREFIX}${method}`
}

function parseConfig(raw: string | null): AppLockConfig {
  if (!raw) return {...DEFAULT_APP_LOCK_CONFIG}
  try {
    const parsed = JSON.parse(raw) as Partial<AppLockConfig>
    return {
      ...DEFAULT_APP_LOCK_CONFIG,
      ...parsed,
      configuredMethods: Array.isArray(parsed.configuredMethods)
        ? (parsed.configuredMethods.filter(Boolean) as UnlockMethod[])
        : [],
      failCount: typeof parsed.failCount === 'number' ? parsed.failCount : 0,
      salt: typeof parsed.salt === 'string' ? parsed.salt : '',
    }
  } catch {
    return {...DEFAULT_APP_LOCK_CONFIG}
  }
}

async function readItem(key: string): Promise<string | null> {
  return browserStorage()?.getItem(key) ?? fallbackStorage.get(key) ?? null
}

async function writeItem(key: string, value: string): Promise<void> {
  const storage = browserStorage()
  if (storage) storage.setItem(key, value)
  else fallbackStorage.set(key, value)
}

async function deleteItem(key: string): Promise<void> {
  browserStorage()?.removeItem(key)
  fallbackStorage.delete(key)
}

export async function loadAppLockConfig(): Promise<AppLockConfig> {
  return parseConfig(await readItem(CONFIG_KEY))
}

export async function saveAppLockConfig(config: AppLockConfig): Promise<void> {
  const safe: AppLockConfig = {
    ...config,
    // Never persist secrets in config JSON.
    salt: config.salt,
  }
  await writeItem(CONFIG_KEY, JSON.stringify(safe))
}

export async function ensureSalt(config: AppLockConfig): Promise<AppLockConfig> {
  if (config.salt) return config
  const next = {...config, salt: createSalt()}
  await saveAppLockConfig(next)
  return next
}

export async function saveCredential(
  method: Exclude<UnlockMethod, 'biometric'>,
  plaintext: string,
  config: AppLockConfig,
): Promise<AppLockConfig> {
  const withSalt = await ensureSalt(config)
  const digest = await hashCredential(withSalt.salt, plaintext)
  await writeItem(credentialKey(method), digest)
  const configured = new Set(withSalt.configuredMethods)
  configured.add(method)
  const next: AppLockConfig = {
    ...withSalt,
    configuredMethods: Array.from(configured),
    method,
    enabled: true,
    failCount: 0,
    lockoutUntil: undefined,
  }
  await saveAppLockConfig(next)
  return next
}

export async function enableBiometricMethod(config: AppLockConfig): Promise<AppLockConfig> {
  const withSalt = await ensureSalt(config)
  const configured = new Set(withSalt.configuredMethods)
  configured.add('biometric')
  const next: AppLockConfig = {
    ...withSalt,
    configuredMethods: Array.from(configured),
    method: 'biometric',
    enabled: true,
  }
  await saveAppLockConfig(next)
  return next
}

export async function clearCredential(
  method: Exclude<UnlockMethod, 'biometric'>,
  config: AppLockConfig,
): Promise<AppLockConfig> {
  await deleteItem(credentialKey(method))
  const configured = config.configuredMethods.filter(m => m !== method)
  const next: AppLockConfig = {
    ...config,
    configuredMethods: configured,
    enabled: configured.length > 0 ? config.enabled : false,
    method: configured.includes(config.method)
      ? config.method
      : (configured[0] ?? 'pin'),
  }
  await saveAppLockConfig(next)
  return next
}

export async function disableAppLock(config: AppLockConfig): Promise<AppLockConfig> {
  for (const method of ['pin', 'password', 'pattern'] as const) {
    await deleteItem(credentialKey(method))
  }
  const next: AppLockConfig = {
    ...DEFAULT_APP_LOCK_CONFIG,
    salt: config.salt || createSalt(),
    requireForWallet: config.requireForWallet,
    requireForPurchases: config.requireForPurchases,
    requireForSettings: config.requireForSettings,
    autoLock: config.autoLock,
  }
  await saveAppLockConfig(next)
  return next
}

export type VerifyResult =
  | {ok: true; config: AppLockConfig}
  | {ok: false; reason: 'mismatch' | 'lockout' | 'missing'; config: AppLockConfig; remainingMs?: number}

export async function verifyCredential(
  method: Exclude<UnlockMethod, 'biometric'>,
  plaintext: string,
  config: AppLockConfig,
): Promise<VerifyResult> {
  if (config.lockoutUntil) {
    const until = Date.parse(config.lockoutUntil)
    if (!Number.isNaN(until) && until > Date.now()) {
      return {ok: false, reason: 'lockout', config, remainingMs: until - Date.now()}
    }
  }

  const stored = await readItem(credentialKey(method))
  if (!stored || !config.salt) {
    return {ok: false, reason: 'missing', config}
  }

  const digest = await hashCredential(config.salt, plaintext)
  if (digest === stored) {
    const next: AppLockConfig = {
      ...config,
      failCount: 0,
      lockoutUntil: undefined,
      lastUnlockedAt: new Date().toISOString(),
    }
    await saveAppLockConfig(next)
    return {ok: true, config: next}
  }

  const failCount = (config.failCount ?? 0) + 1
  const next: AppLockConfig = {
    ...config,
    failCount,
    lockoutUntil:
      failCount >= MAX_FAIL_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MS).toISOString()
        : config.lockoutUntil,
  }
  await saveAppLockConfig(next)
  return {ok: false, reason: 'mismatch', config: next}
}

export function patternToCredential(nodes: number[]): string {
  return nodes.join('-')
}
