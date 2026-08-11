import type {AppConfig} from '../../config/index.js'

export const MODULA_PASSKEY_RP_NAME = 'Modula'
export const MODULA_PASSKEY_RP_ID = 'modula.digital'
export const MODULA_PASSKEY_PRIMARY_ORIGIN = 'https://modula.digital'

export type PasskeyRelyingPartyConfig = {
  rpName: typeof MODULA_PASSKEY_RP_NAME
  rpID: typeof MODULA_PASSKEY_RP_ID
  expectedOrigins: string[]
}

export function passkeyRelyingPartyConfig(
  config: Pick<AppConfig, 'publicWebUrl' | 'publicApiUrl' | 'allowedOrigins'>,
): PasskeyRelyingPartyConfig {
  const origins = new Set<string>([MODULA_PASSKEY_PRIMARY_ORIGIN])
  for (const value of [config.publicWebUrl, config.publicApiUrl, ...config.allowedOrigins]) {
    const origin = toOrigin(value)
    if (origin) origins.add(origin)
  }
  return {
    rpName: MODULA_PASSKEY_RP_NAME,
    rpID: MODULA_PASSKEY_RP_ID,
    expectedOrigins: Array.from(origins).filter(origin => origin.startsWith('https://') || origin.startsWith('http://localhost')),
  }
}

function toOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}
