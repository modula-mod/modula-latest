import {
  DEFAULT_PROFILE_PRESENTATION,
  type ProfileLayoutId,
  type ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'

const VALID_LAYOUT_IDS = new Set<ProfileLayoutId>([
  'social',
  'creator',
  'professional',
  'minimal',
])

const CORE_TAB_IDS = ['posts', 'media', 'about', 'modules', 'links', 'shop', 'agents']

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

export function validateProfilePresentation(
  value: unknown,
): ProfilePresentationPreferences {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PROFILE_PRESENTATION
  }

  const candidate = value as Partial<ProfilePresentationPreferences>
  const layoutId = VALID_LAYOUT_IDS.has(candidate.layoutId as ProfileLayoutId)
    ? candidate.layoutId as ProfileLayoutId
    : DEFAULT_PROFILE_PRESENTATION.layoutId
  const enabledTabIds = isStringArray(candidate.enabledTabIds)
    ? candidate.enabledTabIds.filter(tabId => CORE_TAB_IDS.includes(tabId))
    : DEFAULT_PROFILE_PRESENTATION.enabledTabIds
  const tabOrder = isStringArray(candidate.tabOrder)
    ? candidate.tabOrder.filter(tabId => CORE_TAB_IDS.includes(tabId))
    : DEFAULT_PROFILE_PRESENTATION.tabOrder
  const uniqueOrder = [...new Set(['posts', ...tabOrder, ...CORE_TAB_IDS])]
  const uniqueEnabled = [...new Set(['posts', ...enabledTabIds])]
  const defaultTabId =
    typeof candidate.defaultTabId === 'string' &&
    uniqueEnabled.includes(candidate.defaultTabId)
      ? candidate.defaultTabId
      : 'posts'

  return {
    schemaVersion: 1,
    layoutId,
    enabledTabIds: uniqueEnabled,
    tabOrder: uniqueOrder,
    defaultTabId,
    showFocusHalo:
      typeof candidate.showFocusHalo === 'boolean'
        ? candidate.showFocusHalo
        : DEFAULT_PROFILE_PRESENTATION.showFocusHalo,
    showModuleCount:
      typeof candidate.showModuleCount === 'boolean'
        ? candidate.showModuleCount
        : DEFAULT_PROFILE_PRESENTATION.showModuleCount,
    showFollowerCount:
      typeof candidate.showFollowerCount === 'boolean'
        ? candidate.showFollowerCount
        : DEFAULT_PROFILE_PRESENTATION.showFollowerCount,
  }
}
