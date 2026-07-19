import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  DEFAULT_ACTIVITY_BLOCK_IDS,
  DEFAULT_DISCOVER_BLOCK_IDS,
  DEFAULT_HOME_BLOCK_IDS,
  DEFAULT_PROFILE_TAB_IDS,
  DEFAULT_TAB_BAR_IDS,
  ACTIVITY_LAYOUT_BLOCKS,
  DISCOVER_LAYOUT_BLOCKS,
  HOME_LAYOUT_BLOCKS,
  PROFILE_LAYOUT_BLOCKS,
  TAB_LAYOUT_BLOCKS,
  sanitizeOrderedIds,
  type ChromeDensity,
  type MotionDensity,
  type SurfacePreviewId,
} from '@/features/product/data/layoutBlocks'

const KEY = 'modula.product.preferences.v1'

export type FocusPresetId = 'off' | 'light' | 'deep' | 'custom'

export type ChatAssistMode = 'off' | 'on-device' | 'manual' | 'selected' | 'full'

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
  mergeFeedPresetName: string
  glassPrivacyLevel: 'disable-sharing' | 'protected-chat' | 'vault-chat'
  featureControl: FeatureControlRow[]
  boardWidgetIds: string[]
  automationEnabledIds: string[]
  forgeDraftName: string
  gaiaAllowedScopes: string[]
  chatAssistMode: ChatAssistMode
  chatAssistFunctions: string[]
  quietSendEnabled: boolean
  teamsRoleId: string
  /** Ordered enabled Home header blocks. */
  homeBlockIds: string[]
  /** Ordered enabled Discover sections. */
  discoverBlockIds: string[]
  /** Ordered visible tab bar ids (home + profile always kept). */
  tabBarIds: string[]
  /** Activity surface blocks (digest, filters, etc.). */
  activityBlockIds: string[]
  /** Preferred profile tab order/visibility Preview. */
  profileTabIds: string[]
  chromeDensity: ChromeDensity
  motionDensity: MotionDensity
  surfacePreview: SurfacePreviewId
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
  mergeFeedPresetName: 'Daily operating mix',
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
  boardWidgetIds: ['tasks', 'calendar', 'gaia-briefing', 'dimon-activity', 'nft-entitlements', 'notes', 'crm'],
  automationEnabledIds: ['1', '2'],
  forgeDraftName: 'My Module',
  gaiaAllowedScopes: ['composer', 'tasks'],
  chatAssistMode: 'off',
  chatAssistFunctions: ['summarise', 'suggested-replies', 'tone'],
  quietSendEnabled: false,
  teamsRoleId: 'admin',
  homeBlockIds: [...DEFAULT_HOME_BLOCK_IDS],
  discoverBlockIds: [...DEFAULT_DISCOVER_BLOCK_IDS],
  tabBarIds: [...DEFAULT_TAB_BAR_IDS],
  activityBlockIds: [...DEFAULT_ACTIVITY_BLOCK_IDS],
  profileTabIds: [...DEFAULT_PROFILE_TAB_IDS],
  chromeDensity: 'comfortable',
  motionDensity: 'full',
  surfacePreview: 'solid',
}

function isChatAssistMode(value: unknown): value is ChatAssistMode {
  return (
    value === 'off' ||
    value === 'on-device' ||
    value === 'manual' ||
    value === 'selected' ||
    value === 'full'
  )
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
    mergeFeedPresetName:
      typeof value.mergeFeedPresetName === 'string' && value.mergeFeedPresetName.trim()
        ? value.mergeFeedPresetName.trim()
        : DEFAULT_PRODUCT_PREFERENCES.mergeFeedPresetName,
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
    chatAssistMode: isChatAssistMode(value.chatAssistMode)
      ? value.chatAssistMode
      : DEFAULT_PRODUCT_PREFERENCES.chatAssistMode,
    chatAssistFunctions:
      Array.isArray(value.chatAssistFunctions) &&
      value.chatAssistFunctions.every(item => typeof item === 'string')
        ? value.chatAssistFunctions
        : DEFAULT_PRODUCT_PREFERENCES.chatAssistFunctions,
    quietSendEnabled:
      typeof value.quietSendEnabled === 'boolean'
        ? value.quietSendEnabled
        : DEFAULT_PRODUCT_PREFERENCES.quietSendEnabled,
    teamsRoleId:
      typeof value.teamsRoleId === 'string' && value.teamsRoleId.trim()
        ? value.teamsRoleId.trim()
        : DEFAULT_PRODUCT_PREFERENCES.teamsRoleId,
    homeBlockIds: sanitizeOrderedIds(
      value.homeBlockIds,
      HOME_LAYOUT_BLOCKS,
      DEFAULT_HOME_BLOCK_IDS,
    ),
    discoverBlockIds: sanitizeOrderedIds(
      value.discoverBlockIds,
      DISCOVER_LAYOUT_BLOCKS,
      DEFAULT_DISCOVER_BLOCK_IDS,
    ),
    tabBarIds: sanitizeOrderedIds(
      value.tabBarIds,
      TAB_LAYOUT_BLOCKS,
      DEFAULT_TAB_BAR_IDS,
    ),
    activityBlockIds: sanitizeOrderedIds(
      value.activityBlockIds,
      ACTIVITY_LAYOUT_BLOCKS,
      DEFAULT_ACTIVITY_BLOCK_IDS,
    ),
    profileTabIds: sanitizeOrderedIds(
      value.profileTabIds,
      PROFILE_LAYOUT_BLOCKS,
      DEFAULT_PROFILE_TAB_IDS,
    ),
    chromeDensity:
      value.chromeDensity === 'compact' ||
      value.chromeDensity === 'comfortable' ||
      value.chromeDensity === 'airy'
        ? value.chromeDensity
        : DEFAULT_PRODUCT_PREFERENCES.chromeDensity,
    motionDensity:
      value.motionDensity === 'full' ||
      value.motionDensity === 'reduced' ||
      value.motionDensity === 'minimal'
        ? value.motionDensity
        : DEFAULT_PRODUCT_PREFERENCES.motionDensity,
    surfacePreview:
      value.surfacePreview === 'solid' ||
      value.surfacePreview === 'glass' ||
      value.surfacePreview === 'minimal'
        ? value.surfacePreview
        : DEFAULT_PRODUCT_PREFERENCES.surfacePreview,
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
