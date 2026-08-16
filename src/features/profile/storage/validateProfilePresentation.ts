import {
  DEFAULT_PROFILE_PRESENTATION,
  type ProfileLayoutId,
  type ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'
import {
  DEFAULT_PROFILE_METRIC_ORDER,
  isProfileMetricId,
  type ProfileMetricId,
} from '@/features/profile/model/profile-metrics'

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

function migrateHiddenMetricIds(
  candidate: Partial<ProfilePresentationPreferences>,
): ProfileMetricId[] {
  if (isStringArray(candidate.hiddenMetricIds)) {
    return [...new Set(candidate.hiddenMetricIds.filter(isProfileMetricId))]
  }
  const hidden: ProfileMetricId[] = []
  if (candidate.showFollowerCount === false) {
    hidden.push('followers', 'following')
  }
  if (candidate.showModuleCount === false) {
    hidden.push('modules')
  }
  return hidden
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

  const orderedMetricIds = uniqueMetrics([
    ...(isStringArray(candidate.orderedMetricIds)
      ? candidate.orderedMetricIds.filter(isProfileMetricId)
      : []),
    ...DEFAULT_PROFILE_METRIC_ORDER,
  ])
  let hiddenMetricIds = migrateHiddenMetricIds(candidate)
  const visible = orderedMetricIds.filter(id => !hiddenMetricIds.includes(id))
  if (!visible.length) {
    hiddenMetricIds = hiddenMetricIds.filter(id => id !== 'posts')
  }
  const visibleAfter = orderedMetricIds.filter(id => !hiddenMetricIds.includes(id))
  const defaultMetricId =
    typeof candidate.defaultMetricId === 'string' &&
    isProfileMetricId(candidate.defaultMetricId) &&
    visibleAfter.includes(candidate.defaultMetricId)
      ? candidate.defaultMetricId
      : visibleAfter[0] ?? 'posts'

  const showFollowerCount =
    typeof candidate.showFollowerCount === 'boolean'
      ? candidate.showFollowerCount
      : !hiddenMetricIds.includes('followers')
  const showModuleCount =
    typeof candidate.showModuleCount === 'boolean'
      ? candidate.showModuleCount
      : !hiddenMetricIds.includes('modules')

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
    showModuleCount,
    showFollowerCount,
    orderedMetricIds,
    hiddenMetricIds,
    defaultMetricId,
  }
}

function uniqueMetrics(ids: ProfileMetricId[]): ProfileMetricId[] {
  return [...new Set(ids)]
}
