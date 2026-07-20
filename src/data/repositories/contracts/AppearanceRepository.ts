import type {AppearancePreferences} from '@/theme/contracts'

export type SyncedAppearancePreferences = {
  preferences: AppearancePreferences
  version: number
}

export interface AppearanceRepository {
  get(): Promise<SyncedAppearancePreferences>
  patch(input: SyncedAppearancePreferences): Promise<SyncedAppearancePreferences>
}
