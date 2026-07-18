import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'modula.product.preferences.v1'

export type FocusPresetId = 'off' | 'light' | 'deep' | 'custom'

export type FocusPreferences = {
  /** Off / Light / Deep / Custom — drives FocusPolicyEngine Preview. */
  preset: FocusPresetId
  quietFeed: boolean
  hideNav: boolean
  suppressPings: boolean
  priorityWork: boolean
  showHalo: boolean
}

export type FeatureControlRow = {
  id: string
  enabled: boolean
  locked: boolean
}

export type ProductPreferences = {
  focus: FocusPreferences
  mergeFeedIds: string[]
  glassPrivacyLevel: 'disable-sharing' | 'protected-chat' | 'vault-chat'
  featureControl: FeatureControlRow[]
  boardWidgetIds: string[]
  automationEnabledIds: string[]
  forgeDraftName: string
  gaiaAllowedScopes: string[]
}

export const DEFAULT_PRODUCT_PREFERENCES: ProductPreferences = {
  focus: {
    preset: 'light',
    quietFeed: true,
    hideNav: false,
    suppressPings: true,
    priorityWork: true,
    showHalo: true,
  },
  mergeFeedIds: ['following', 'team'],
  glassPrivacyLevel: 'protected-chat',
  featureControl: [
    {id: 'reels', enabled: false, locked: false},
    {id: 'merge', enabled: true, locked: false},
    {id: 'focus', enabled: true, locked: false},
    {id: 'gaia', enabled: false, locked: true},
    {id: 'agents', enabled: true, locked: false},
    {id: 'forge', enabled: true, locked: false},
    {id: 'dimon', enabled: false, locked: true},
    {id: 'automations', enabled: false, locked: false},
  ],
  boardWidgetIds: ['tasks', 'calendar', 'notes', 'crm'],
  automationEnabledIds: ['1', '2'],
  forgeDraftName: 'My Module',
  gaiaAllowedScopes: ['composer', 'tasks'],
}

function mergePreferences(raw: unknown): ProductPreferences {
  if (!raw || typeof raw !== 'object') return DEFAULT_PRODUCT_PREFERENCES
  const value = raw as Partial<ProductPreferences>
  return {
    focus: (() => {
      const merged = {...DEFAULT_PRODUCT_PREFERENCES.focus, ...(value.focus ?? {})}
      const preset = merged.preset
      if (preset === 'off' || preset === 'light' || preset === 'deep' || preset === 'custom') {
        return {...merged, preset}
      }
      return {...merged, preset: DEFAULT_PRODUCT_PREFERENCES.focus.preset}
    })(),
    mergeFeedIds:
      Array.isArray(value.mergeFeedIds) && value.mergeFeedIds.every(item => typeof item === 'string')
        ? value.mergeFeedIds
        : DEFAULT_PRODUCT_PREFERENCES.mergeFeedIds,
    glassPrivacyLevel:
      value.glassPrivacyLevel === 'disable-sharing' ||
      value.glassPrivacyLevel === 'protected-chat' ||
      value.glassPrivacyLevel === 'vault-chat'
        ? value.glassPrivacyLevel
        : DEFAULT_PRODUCT_PREFERENCES.glassPrivacyLevel,
    featureControl: (() => {
      const stored = Array.isArray(value.featureControl)
        ? value.featureControl.filter(
            (row): row is FeatureControlRow =>
              !!row &&
              typeof row === 'object' &&
              typeof row.id === 'string' &&
              typeof row.enabled === 'boolean' &&
              typeof row.locked === 'boolean',
          )
        : []
      const byId = new Map(stored.map(row => [row.id, row]))
      return DEFAULT_PRODUCT_PREFERENCES.featureControl.map(
        row => byId.get(row.id) ?? row,
      )
    })(),
    boardWidgetIds:
      Array.isArray(value.boardWidgetIds) && value.boardWidgetIds.every(item => typeof item === 'string')
        ? value.boardWidgetIds
        : DEFAULT_PRODUCT_PREFERENCES.boardWidgetIds,
    automationEnabledIds:
      Array.isArray(value.automationEnabledIds) &&
      value.automationEnabledIds.every(item => typeof item === 'string')
        ? value.automationEnabledIds
        : DEFAULT_PRODUCT_PREFERENCES.automationEnabledIds,
    forgeDraftName:
      typeof value.forgeDraftName === 'string' && value.forgeDraftName.trim()
        ? value.forgeDraftName.trim()
        : DEFAULT_PRODUCT_PREFERENCES.forgeDraftName,
    gaiaAllowedScopes:
      Array.isArray(value.gaiaAllowedScopes) &&
      value.gaiaAllowedScopes.every(item => typeof item === 'string')
        ? value.gaiaAllowedScopes
        : DEFAULT_PRODUCT_PREFERENCES.gaiaAllowedScopes,
  }
}

export async function loadProductPreferences(): Promise<ProductPreferences> {
  try {
    const stored = await AsyncStorage.getItem(KEY)
    if (!stored) return DEFAULT_PRODUCT_PREFERENCES
    return mergePreferences(JSON.parse(stored))
  } catch {
    return DEFAULT_PRODUCT_PREFERENCES
  }
}

export async function saveProductPreferences(preferences: ProductPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(mergePreferences(preferences)))
  } catch {
    // Non-critical local craft preferences.
  }
}

export async function patchProductPreferences(
  patch: Partial<ProductPreferences>,
): Promise<ProductPreferences> {
  const current = await loadProductPreferences()
  const next = mergePreferences({...current, ...patch})
  await saveProductPreferences(next)
  return next
}
