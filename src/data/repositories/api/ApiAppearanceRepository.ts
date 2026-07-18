import type {ApiClient} from '@/api/client'
import type {
  AppearanceRepository,
  SyncedAppearancePreferences,
} from '@/data/repositories/contracts/AppearanceRepository'
import type {AppearancePreferences, TextScale} from '@/theme/contracts'
import {migrateAppearancePreferences} from '@/theme/storage/migrateAppearancePreferences'

function decodeAppearance(value: unknown): SyncedAppearancePreferences {
  const row = (value ?? {}) as Record<string, unknown>
  const preferences = migrateAppearancePreferences({
    mode: row.mode,
    family: row.variant,
    accentId: row.accentId,
    customAccent: row.customAccent,
    surfaceType: row.surface,
    textScale: row.textScale,
    boldText: row.boldText,
    reduceMotion: row.reduceMotion,
    reduceTransparency: row.reduceTransparency,
    increaseContrast: row.increaseContrast,
  })
  return {
    preferences,
    version: typeof row.version === 'number' && row.version >= 0 ? row.version : 0,
  }
}

function encodeAppearance(
  preferences: AppearancePreferences,
  expectedVersion: number,
): Record<string, unknown> {
  return {
    mode: preferences.mode,
    variant: preferences.family,
    surface: preferences.surfaceType,
    accentId: preferences.accentId,
    customAccent: preferences.customAccent,
    textScale: preferences.textScale as TextScale,
    boldText: preferences.boldText,
    reduceMotion: preferences.reduceMotion,
    reduceTransparency: preferences.reduceTransparency,
    increaseContrast: preferences.increaseContrast,
    expectedVersion,
  }
}

export class ApiAppearanceRepository implements AppearanceRepository {
  constructor(private readonly client: ApiClient) {}

  get(): Promise<SyncedAppearancePreferences> {
    return this.client.get(
      {path: '/v1/accounts/me/appearance', authenticated: true},
      decodeAppearance,
    )
  }

  patch(input: SyncedAppearancePreferences): Promise<SyncedAppearancePreferences> {
    return this.client.patch(
      {
        path: '/v1/accounts/me/appearance',
        body: encodeAppearance(input.preferences, input.version),
        authenticated: true,
      },
      decodeAppearance,
    )
  }
}
